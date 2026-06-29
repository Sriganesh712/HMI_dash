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

def decode_float_cdab(reg1, reg2):
    """Decode 32-bit float from two 16-bit Modbus registers (CDAB/Word-swap)."""
    try:
        packed = struct.pack('>HH', reg2, reg1)
        return struct.unpack('>f', packed)[0]
    except Exception:
        return 0.0

def main():
    # Configure the Modbus Serial Client
    client = ModbusSerialClient(
        port="COM9",
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

    em_register_map = [
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
        # Gap 104-123
        (124, "thd_voltage_v1n", "float"),
        (126, "thd_voltage_v2n", "float"),
        (128, "thd_voltage_v3n", "float"),
        (130, "thd_voltage_v12", "float"),
        (132, "thd_voltage_v23", "float"),
        (134, "thd_voltage_v31", "float"),
        (136, "thd_current_i1", "float"),
        (138, "thd_current_i2", "float"),
        (140, "thd_current_i3", "float"),
        # Gap 142-683
        (684, "serial_number", "float"),
    ]

    try:
        while True:
            # Clear terminal screen
            os.system('cls' if os.name == 'nt' else 'clear')
            print(f"Modbus Dashboard | Press Ctrl+C to Exit")
            print(f"Last Updated: {time.strftime('%Y-%m-%d %H:%M:%S')}")
            print("=" * 75)
            
            # --- Device 3: HVAC HMI ---
            print("DEVICE 3: HVAC HMI (Holding Registers)")
            print("-" * 75)
            rr3 = client.read_holding_registers(address=0, count=56, device_id=3)
            if rr3.isError():
                print(f"Error reading Device 3: {rr3}")
            else:
                regs3 = rr3.registers
                print(f"{'Modbus Addr':<12} | {'Item Name':<45} | {'Value':<12}")
                print("-" * 75)
                for addr, name, dtype in register_map:
                    modbus_addr = 40001 + addr
                    if dtype == "float" and addr + 1 < len(regs3):
                        val = decode_float_abcd(regs3[addr], regs3[addr+1])
                        print(f"{modbus_addr:<12} | {name:<45} | {val:.4f}")
                    elif dtype != "float" and addr < len(regs3):
                        val = regs3[addr]
                        signed_val = val if val < 32768 else val - 65536
                        print(f"{modbus_addr:<12} | {name:<45} | {signed_val}")

            print("\n" + "=" * 75)
            # --- Device 2: Energy Meter ---
            print("DEVICE 2: Energy Meter (Input Registers)")
            print("-" * 75)
            
            # Split reads for Device 2 to handle gaps
            regs2_parts = {}
            # Read Part 1: 0-103
            rr2_1 = client.read_input_registers(address=0, count=104, device_id=2)
            if not rr2_1.isError():
                for idx, val in enumerate(rr2_1.registers):
                    regs2_parts[idx] = val
                    
            # Read Part 2: 124-141
            rr2_2 = client.read_input_registers(address=124, count=18, device_id=2)
            if not rr2_2.isError():
                for idx, val in enumerate(rr2_2.registers):
                    regs2_parts[124 + idx] = val
                    
            # Read Part 3: 684-685
            rr2_3 = client.read_input_registers(address=684, count=2, device_id=2)
            if not rr2_3.isError():
                for idx, val in enumerate(rr2_3.registers):
                    regs2_parts[684 + idx] = val
                    
            if not regs2_parts:
                print("Error reading Device 2 (All parts failed)")
            else:
                print(f"{'Modbus Addr':<12} | {'Item Name':<45} | {'Value':<12}")
                print("-" * 75)
                for addr, name, dtype in em_register_map:
                    modbus_addr = 30001 + addr
                    if dtype == "float" and addr in regs2_parts and (addr+1) in regs2_parts:
                        val = decode_float_cdab(regs2_parts[addr], regs2_parts[addr+1])
                        print(f"{modbus_addr:<12} | {name:<45} | {val:.4f}")
                    elif dtype != "float" and addr in regs2_parts:
                        val = regs2_parts[addr]
                        signed_val = val if val < 32768 else val - 65536
                        print(f"{modbus_addr:<12} | {name:<45} | {signed_val}")
            
            # Wait 2 seconds before refreshing
            time.sleep(2)
            
    except KeyboardInterrupt:
        print("\nExiting dashboard...")
    finally:
        client.close()
        print("Modbus connection closed.")

if __name__ == '__main__':
    main()