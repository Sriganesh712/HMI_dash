import asyncio
import os
import time
import struct
import sqlite3
from typing import List, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pymodbus.client import ModbusSerialClient
import serial.tools.list_ports

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# SQLite setup for logging
DB_FILE = "datalog.db"

def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS modbus_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            fcu_in REAL,
            condenser_out REAL,
            evaporator_out REAL,
            fcu_out REAL,
            evaporator_in REAL,
            geyser_out REAL,
            lp_psi REAL,
            hp_psi REAL,
            water_pressure_bar REAL,
            condenser_in REAL,
            geyser_in REAL,
            ac_chamber_temp REAL,
            cut_on_temp_cooler REAL,
            cut_on_temp_heater REAL,
            evaporator_out_set_point REAL,
            ac_chamber_set_temp_cooler REAL,
            ac_chamber_set_temp_heater REAL,
            room_temp REAL,
            heater_actuator_feedback REAL,
            chilled_water_inlet_actuator_feedback REAL,
            supply_actuator_feedback REAL,
            return_actuator_feedback REAL,
            fcu_bypass_actuator_feedback REAL,
            condenser_inlet_actuator_feedback REAL,
            heater_actuator REAL,
            chilled_water_inlet_actuator REAL,
            fcu_bypass_actuator REAL,
            return_actuator REAL
        )
    ''')
    conn.commit()
    conn.close()

init_db()

# --- Modbus Client Management ---
class ModbusManager:
    def __init__(self):
        self.client: Optional[ModbusSerialClient] = None
        self.port: str = ""
        self.is_connected = False
        self.running = False
        self.latest_data = {}
        self.device_id = 3

    def connect(self, port: str) -> bool:
        if self.is_connected and self.client:
            self.client.close()
        
        self.port = port
        self.client = ModbusSerialClient(
            port=self.port,
            baudrate=9600,
            parity="N",
            stopbits=1,
            bytesize=8,
            timeout=1
        )
        self.is_connected = self.client.connect()
        return self.is_connected

    def disconnect(self):
        if self.client:
            self.client.close()
        self.is_connected = False
        self.client = None

modbus_manager = ModbusManager()

# --- Helpers ---
def decode_float_abcd(reg1, reg2):
    try:
        packed = struct.pack('>HH', reg1, reg2)
        return struct.unpack('>f', packed)[0]
    except Exception:
        return 0.0

REGISTER_MAP = [
    (0, "fcu_in", "float"),
    (2, "condenser_out", "float"),
    (4, "evaporator_out", "float"),
    (6, "fcu_out", "float"),
    (8, "evaporator_in", "float"),
    (10, "geyser_out", "float"),
    (12, "lp_psi", "float"),
    (14, "hp_psi", "float"),
    (16, "water_pressure_bar", "float"),
    (18, "condenser_in", "float"),
    (20, "geyser_in", "float"),
    (22, "ac_chamber_temp", "float"),
    (24, "cut_on_temp_cooler", "float"),
    (26, "cut_on_temp_heater", "float"),
    (28, "evaporator_out_set_point", "float"),
    (30, "ac_chamber_set_temp_cooler", "float"),
    (32, "ac_chamber_set_temp_heater", "float"),
    (34, "room_temp", "float"),
    (36, "heater_actuator_feedback", "float"),
    (38, "chilled_water_inlet_actuator_feedback", "float"),
    (40, "supply_actuator_feedback", "float"),
    (42, "return_actuator_feedback", "float"),
    (44, "fcu_bypass_actuator_feedback", "float"),
    (46, "condenser_inlet_actuator_feedback", "float"),
    (48, "heater_actuator", "float"),
    (50, "chilled_water_inlet_actuator", "float"),
    (52, "fcu_bypass_actuator", "float"),
    (54, "return_actuator", "float"),
]

def read_modbus_data():
    if not modbus_manager.is_connected or not modbus_manager.client:
        return None
    
    try:
        rr = modbus_manager.client.read_holding_registers(address=0, count=56, device_id=modbus_manager.device_id)
        if rr.isError():
            return None
        
        regs = rr.registers
        data = {}
        for addr, key_name, dtype in REGISTER_MAP:
            if dtype == "float" and addr + 1 < len(regs):
                r1 = regs[addr]
                r2 = regs[addr+1]
                data[key_name] = round(decode_float_abcd(r1, r2), 4)
            elif dtype != "float" and addr < len(regs):
                val = regs[addr]
                signed_val = val if val < 32768 else val - 65536
                data[key_name] = signed_val
            else:
                data[key_name] = None
        return data
    except Exception as e:
        print(f"Modbus read error: {e}")
        return None

def log_data_to_db(data):
    if not data:
        return
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    columns = ', '.join(data.keys())
    placeholders = ', '.join(['?'] * len(data))
    values = tuple(data.values())
    c.execute(f"INSERT INTO modbus_data ({columns}) VALUES ({placeholders})", values)
    conn.commit()
    conn.close()

# --- Background Task ---
async def data_poller():
    modbus_manager.running = True
    while modbus_manager.running:
        if modbus_manager.is_connected:
            data = read_modbus_data()
            if data:
                data['timestamp'] = time.time()
                modbus_manager.latest_data = data
                log_data_to_db(data)
        await asyncio.sleep(2)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(data_poller())

@app.on_event("shutdown")
async def shutdown_event():
    modbus_manager.running = False
    modbus_manager.disconnect()

# --- API Endpoints ---
class ConnectRequest(BaseModel):
    port: str

@app.get("/api/ports")
def get_ports():
    ports = serial.tools.list_ports.comports()
    return {"ports": [port.device for port in ports]}

@app.post("/api/connect")
def connect_modbus(req: ConnectRequest):
    success = modbus_manager.connect(req.port)
    if success:
        return {"status": "connected", "port": req.port}
    raise HTTPException(status_code=400, detail="Failed to connect to Modbus port")

@app.post("/api/disconnect")
def disconnect_modbus():
    modbus_manager.disconnect()
    return {"status": "disconnected"}

@app.get("/api/status")
def get_status():
    return {
        "is_connected": modbus_manager.is_connected,
        "port": modbus_manager.port
    }

@app.get("/api/history")
def get_history(limit: int = 100):
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute(f"SELECT * FROM modbus_data ORDER BY id DESC LIMIT {limit}")
    rows = c.fetchall()
    conn.close()
    return [dict(row) for row in reversed(rows)]

# --- WebSocket ---
active_connections: List[WebSocket] = []

@app.websocket("/ws/data")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    try:
        while True:
            if modbus_manager.is_connected and modbus_manager.latest_data:
                await websocket.send_json(modbus_manager.latest_data)
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        active_connections.remove(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
