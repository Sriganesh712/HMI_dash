import os
import time
import struct
from pymodbus.client import ModbusSerialClient

def decode_float_abcd(reg1, reg2):
    """Decode 32-bit float from two 16-bit Modbus registers (ABCD/Big-endian)."""
    try:
        packed = struct.pack('>HH', reg1, reg2)
        return struct.unpack('>f', packed)[0]
    except Exception:
        return 0.0

def main():
    # Configure the Modbus Serial Client
    client = ModbusSerialClient(
        port="COM8",
        baudrate=9600,
        parity="N",
        stopbits=1,
        bytesize=8,
        timeout=3
    )
    
    # Establish connection
    if not client.connect():
        print("Error: Could not connect to Modbus on COM6")
        return
        
    print("Connecting to Modbus HMI on COM6 (Device ID: 3)...")
    
    # Define the register mapping (Address, Item Name, Type)
    # Note: 32-bit float values consume 2 registers each (e.g. 48 & 49, 50 & 51).
    # Reading them at overlapping offsets (like 49 & 50) results in garbled/incorrect values.
    register_map = [
        (0, "FCU In", "float"),
        (2, "Condenser Out", "float"),
        (4, "Evaporator Out", "float"),
        (6, "FCU Out", "float"),
        (8, "Evaporator In", "float"),
        (10, "Geyser Out", "float"),
        (12, "LP (in psi)", "float"),
        (14, "HP (in psi)", "float"),
        (16, "Water Pressure (in bar)", "float"),
        (18, "Condenser In", "float"),
        (20, "Geyser In", "float"),
        (22, "Air Condition Chamber Temperature", "float"),
        (24, "Cut ON Temp Cooler", "float"),
        (26, "Cut ON Temp Heater", "float"),
        (28, "Evaporator Out Set Point", "float"),
        (30, "Air Chamber Set Temperature - Cooler Mode", "float"),
        (32, "Air Chamber Set Temperature - Heater Mode", "float"),
        (34, "Room Temperature", "float"),
        (36, "Heater Actuator Feedback (%)", "float"),
        (38, "Chilled Water Inlet Actuator Feedback (%)", "float"),
        (40, "Supply Actuator Feedback (%)", "float"),
        (42, "Return Actuator Feedback (%)", "float"),
        (44, "FCU Bypass Actuator Feedback (%)", "float"),
        (46, "Condenser Inlet Actuator Feedback (%)", "float"),
        # The actuator command outputs are 32-bit floats, spaced 2 registers apart:
        (48, "Heater Actuator", "float"),
        (50, "Chilled Water Inlet Actuator", "float"),
        (52, "FCU Bypass Actuator", "float"),
        (54, "Return Actuator", "float"),
    ]

    try:
        while True:
            # Read the first 56 holding registers (0 to 55)
            rr = client.read_holding_registers(address=0, count=56, device_id=3)
            
            # Clear terminal screen
            os.system('cls' if os.name == 'nt' else 'clear')
            
            if rr.isError():
                print(f"Error reading holding registers: {rr}")
                print("Retrying in 2 seconds...")
                time.sleep(2)
                continue

            regs = rr.registers
            print(f"Modbus HMI Dashboard (COM6 - Device ID: 3) | Press Ctrl+C to Exit")
            print(f"Last Updated: {time.strftime('%Y-%m-%d %H:%M:%S')}")
            print("=" * 75)
            print(f"{'Modbus Addr':<12} | {'Item Name':<45} | {'Value':<12}")
            print("-" * 75)
            
            for addr, name, dtype in register_map:
                modbus_addr = 40001 + addr
                if dtype == "float":
                    if addr + 1 < len(regs):
                        r1 = regs[addr]
                        r2 = regs[addr+1]
                        val = decode_float_abcd(r1, r2)
                        print(f"{modbus_addr:<12} | {name:<45} | {val:.4f}")
                    else:
                        print(f"{modbus_addr:<12} | {name:<45} | Out of bounds")
                else:
                    if addr < len(regs):
                        val = regs[addr]
                        signed_val = val if val < 32768 else val - 65536
                        print(f"{modbus_addr:<12} | {name:<45} | {signed_val}")
                    else:
                        print(f"{modbus_addr:<12} | {name:<45} | Out of bounds")
            
            # Wait 2 seconds before refreshing
            time.sleep(2)
            
    except KeyboardInterrupt:
        print("\nExiting dashboard...")
    finally:
        client.close()
        print("Modbus connection closed.")

if __name__ == '__main__':
    main()