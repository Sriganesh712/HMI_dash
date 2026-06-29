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
    c.execute('DROP TABLE IF EXISTS modbus_data')
    c.execute('''
        CREATE TABLE modbus_data (
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
            evaporator_out_diff REAL,
            air_chamber_diff_chiller REAL,
            air_chamber_diff_heater REAL,
            heater_actuator_feedback REAL,
            co_supply REAL,
            co_return REAL,
            unknown2 REAL,
            chilled_water REAL,
            fcu_bypass_actuator REAL,
            return_actuator REAL,
            voltage_v1n REAL,
            voltage_v2n REAL,
            voltage_v3n REAL,
            avg_voltage_ln REAL,
            voltage_v12 REAL,
            voltage_v23 REAL,
            voltage_v31 REAL,
            avg_voltage_ll REAL,
            current_i1 REAL,
            current_i2 REAL,
            current_i3 REAL,
            avg_current REAL,
            kw1 REAL,
            kw2 REAL,
            kw3 REAL,
            total_kw REAL,
            kvar2 REAL,
            kvar3 REAL,
            kva1 REAL,
            kva2 REAL,
            kva3 REAL,
            pf1 REAL,
            pf2 REAL,
            pf3 REAL,
            avg_pf REAL,
            frequency REAL,
            total_kw_2 REAL,
            total_kvar REAL,
            total_kva REAL,
            active_power_max_demand REAL,
            active_power_min_demand REAL,
            reactive_power_max_demand REAL,
            reactive_power_min_demand REAL,
            apparent_power_max_demand REAL,
            max_voltage_v1n REAL,
            max_voltage_v2n REAL,
            max_voltage_v3n REAL,
            max_voltage_v12 REAL,
            max_voltage_v23 REAL,
            max_voltage_v31 REAL,
            max_current_i1 REAL,
            max_current_i2 REAL,
            max_current_i3 REAL,
            import_active_energy REAL,
            export_active_energy REAL,
            total_active_energy REAL,
            import_reactive_energy REAL,
            export_reactive_energy REAL,
            total_reactive_energy REAL,
            total_apparent_energy REAL,
            run_hour REAL,
            aux_interrupts REAL,
            thd_voltage_v1n REAL,
            thd_voltage_v2n REAL,
            thd_voltage_v3n REAL,
            thd_voltage_v12 REAL,
            thd_voltage_v23 REAL,
            thd_voltage_v31 REAL,
            thd_current_i1 REAL,
            thd_current_i2 REAL,
            thd_current_i3 REAL,
            serial_number REAL
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

def decode_float_cdab(reg1, reg2):
    try:
        packed = struct.pack('>HH', reg2, reg1)
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
    (36, "evaporator_out_diff", "float"),
    (38, "air_chamber_diff_chiller", "float"),
    (40, "air_chamber_diff_heater", "float"),
    (42, "heater_actuator_feedback", "float"),
    (44, "co_supply", "float"),
    (46, "co_return", "float"),
    (48, "chilled_water", "float"),
    (50, "fcu_bypass_actuator", "float"),
    (52, "unknown2", "float"),
    (54, "return_actuator", "float"),
]

EM_REGISTER_MAP = [
    (0, "voltage_v1n", "float"),
    (2, "voltage_v2n", "float"),
    (4, "voltage_v3n", "float"),
    (6, "avg_voltage_ln", "float"),
    (8, "voltage_v12", "float"),
    (10, "voltage_v23", "float"),
    (12, "voltage_v31", "float"),
    (14, "avg_voltage_ll", "float"),
    (16, "current_i1", "float"),
    (18, "current_i2", "float"),
    (20, "current_i3", "float"),
    (22, "avg_current", "float"),
    (24, "kw1", "float"),
    (26, "kw2", "float"),
    (28, "kw3", "float"),
    (30, "total_kw", "float"),
    (32, "kvar2", "float"),
    (34, "kvar3", "float"),
    (36, "kva1", "float"),
    (38, "kva2", "float"),
    (40, "kva3", "float"),
    (42, "pf1", "float"),
    (44, "pf2", "float"),
    (46, "pf3", "float"),
    (48, "avg_pf", "float"),
    (50, "frequency", "float"),
    (52, "total_kw_2", "float"),
    (54, "total_kvar", "float"),
    (56, "total_kva", "float"),
    (58, "active_power_max_demand", "float"),
    (60, "active_power_min_demand", "float"),
    (62, "reactive_power_max_demand", "float"),
    (64, "reactive_power_min_demand", "float"),
    (66, "apparent_power_max_demand", "float"),
    (68, "max_voltage_v1n", "float"),
    (70, "max_voltage_v2n", "float"),
    (72, "max_voltage_v3n", "float"),
    (74, "max_voltage_v12", "float"),
    (76, "max_voltage_v23", "float"),
    (78, "max_voltage_v31", "float"),
    (80, "max_current_i1", "float"),
    (82, "max_current_i2", "float"),
    (84, "max_current_i3", "float"),
    (86, "import_active_energy", "float"),
    (88, "export_active_energy", "float"),
    (90, "total_active_energy", "float"),
    (92, "import_reactive_energy", "float"),
    (94, "export_reactive_energy", "float"),
    (96, "total_reactive_energy", "float"),
    (98, "total_apparent_energy", "float"),
    (100, "run_hour", "float"),
    (102, "aux_interrupts", "float"),
    (124, "thd_voltage_v1n", "float"),
    (126, "thd_voltage_v2n", "float"),
    (128, "thd_voltage_v3n", "float"),
    (130, "thd_voltage_v12", "float"),
    (132, "thd_voltage_v23", "float"),
    (134, "thd_voltage_v31", "float"),
    (136, "thd_current_i1", "float"),
    (138, "thd_current_i2", "float"),
    (140, "thd_current_i3", "float"),
    (684, "serial_number", "float"),
]

def read_modbus_data():
    if not modbus_manager.is_connected or not modbus_manager.client:
        return None
    
    data = {}
    try:
        # --- Device 3 (HVAC HMI) ---
        rr3 = modbus_manager.client.read_holding_registers(address=0, count=56, device_id=3)
        if not rr3.isError():
            regs3 = rr3.registers
            for addr, key_name, dtype in REGISTER_MAP:
                if dtype == "float" and addr + 1 < len(regs3):
                    data[key_name] = round(decode_float_abcd(regs3[addr], regs3[addr+1]), 4)
                elif dtype != "float" and addr < len(regs3):
                    val = regs3[addr]
                    data[key_name] = val if val < 32768 else val - 65536
                else:
                    data[key_name] = None
        else:
            print(f"Device 3 error: {rr3}")
            # Populate None to maintain schema consistency
            for _, key_name, _ in REGISTER_MAP:
                data[key_name] = None

        # --- Device 2 (Energy Meter) ---
        regs2_parts = {}
        # Read Part 1: 0-103
        rr2_1 = modbus_manager.client.read_input_registers(address=0, count=104, device_id=2)
        if not rr2_1.isError():
            for idx, val in enumerate(rr2_1.registers):
                regs2_parts[idx] = val
                
        # Read Part 2: 124-141
        rr2_2 = modbus_manager.client.read_input_registers(address=124, count=18, device_id=2)
        if not rr2_2.isError():
            for idx, val in enumerate(rr2_2.registers):
                regs2_parts[124 + idx] = val
                
        # Read Part 3: 684-685
        rr2_3 = modbus_manager.client.read_input_registers(address=684, count=2, device_id=2)
        if not rr2_3.isError():
            for idx, val in enumerate(rr2_3.registers):
                regs2_parts[684 + idx] = val

        for addr, key_name, dtype in EM_REGISTER_MAP:
            if dtype == "float" and addr in regs2_parts and (addr+1) in regs2_parts:
                data[key_name] = round(decode_float_cdab(regs2_parts[addr], regs2_parts[addr+1]), 4)
            elif dtype != "float" and addr in regs2_parts:
                val = regs2_parts[addr]
                data[key_name] = val if val < 32768 else val - 65536
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
