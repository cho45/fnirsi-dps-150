# FNIRSI DPS-150 – Reverse‑Engineered USB Protocol
*A complete developer‑oriented reference for automation, scripting and custom GUIs*

---

## ⚠️ Disclaimer
This protocol description is **not official**.  
It was reverse‑engineered by USB sniffing of the official FNIRSI software and validated by live testing on real DPS‑150 hardware.

Nevertheless, the protocol is **stable, deterministic and fully usable** for production tools.

---

## 1. Device Overview

- Device: **FNIRSI DPS‑150**
- Type: Programmable DC power supply
- Control interface: **USB CDC (Virtual COM port)**
- Control model: **Memory‑mapped registers**

The DPS‑150 does **not** use textual commands or request/response semantics.  
Instead, the device exposes an internal memory map where:

- Writing a register **immediately changes behavior**
- Reading a register returns **current internal state**
- Periodic telemetry is **pushed by the device**

---

## 2. Transport Layer

| Parameter | Value |
|--------|------|
| Interface | USB CDC (COM port) |
| Baud rate | 115200 |
| Data bits | 8 |
| Parity | None |
| Stop bits | 1 |
| Flow control | None |
| Endianness | Little‑endian |

All floating‑point values are **IEEE‑754 float32**.

---

## 3. Frame Structure

### 3.1 Register Frames (main protocol)

```
TX: F1 <GROUP> <REG> <LEN> <DATA…> <CHK>
RX: F0 <GROUP> <REG> <LEN> <DATA…> <CHK>
```

| Field | Meaning |
|----|----|
| `F1 / F0` | Direction (TX / RX) |
| `GROUP` | B1 = write, A1 = read/response |
| `REG` | Register address |
| `LEN` | Length of DATA |
| `DATA` | Payload |
| `CHK` | Checksum |

### 3.2 Checksum Rule

```
CHK = (REG + LEN + sum(DATA)) & 0xFF
```

- GROUP byte is **not included**
- Used consistently across all register writes and reads

---

## 4. Session Control (mandatory)

Before accessing any registers, communication must be enabled.

| Function | TX Frame | Notes |
|------|---------|------|
| Enable session | `F1 C1 00 01 01 02` | Must be sent once |
| Disable session | `F1 C1 00 01 00 01` | Graceful close |

---

## 5. Baud rate

Baud rate must be send to device after session activation

Send `F1 B0 00 01 XX 06` where `XX` is

| Value | Baud Rate |
|----|----|
| 0 | AUTO (??? / original software only send 1-5) |
| 1 | 9600 |
| 2 | 19200 |
| 3 | 38400 |
| 4 | 57600 |
| 5 | 115200 |

---

## 6. Active Output Control

### 6.1 Voltage Setpoint (C1)

- Type: float32
- Unit: volts

**Example: set 12.3 V**

```
TX: F1 B1 C1 04 CD CC 44 41 E3
RX: F0 A1 C1 04 CD CC 44 41 E3
```

### 6.2 Current Limit (C2)

- Type: float32
- Unit: amperes

**Example: set 0.5 A**
```
TX: F1 B1 C2 04 FD FF FF 3E FF
```

⚠️ Writing C1/C2 works even when output is OFF.

---

## 7. Output Enable (RUN / STOP)

| Register | Description | Type |
|------|-------------|----|
| DB | Output relay state | u8 |

| Value | Meaning |
|----|----|
| 0 | STOP |
| 1 | RUN |

**RUN**
```
TX: F1 B1 DB 01 01 DD
RX: F0 A1 DB 01 01 DD
```

**STOP**
```
TX: F1 B1 DB 01 00 DC
RX: F0 A1 DB 01 00 DC
```

---

## 8. Preset Memory (M1–M6)

Each preset consists of **Voltage + Current** registers.

| Preset | Voltage | Current |
|------|--------|---------|
| M1 | C5 | C6 |
| M2 | C7 | C8 |
| M3 | C9 | CA |
| M4 | CB | CC |
| M5 | CD | CE |
| M6 | CF | D0 |

### Example – Program M2 = 5.5 V / 0.5 A
```
TX: F1 B1 C7 04 00 00 B0 40 BB
TX: F1 B1 C8 04 FD FF FF 3E 05
```

When selecting a preset via UI, FNIRSI software:
1. Writes preset registers
2. Mirrors values into C1/C2

---

## 9. Protection Settings

| Register | Protection | Unit |
|------|-------------|------|
| D1 | OVP | V |
| D2 | OCP | A |
| D3 | OPP | W |
| D4 | OTP | °C |
| D5 | LVP | V |

### Example – Change OTP from 75 → 64 °C
```
TX: F1 B1 D4 04 00 00 80 42 9A
```

All protection writes are followed by:
```
TX: F1 A1 FF 01 00 00
```
(request full state refresh)

---

## 10. UI / System Settings

| Register | Function | Type |
|------|----------|----|
| D6 | Brightness | u8 |
| D7 | Volume | u8 |

**Brightness 11 → 12**
```
TX: F1 B1 D6 01 0C E3
```

**Volume 10 → 9**
```
TX: F1 B1 D7 01 09 E1
```

---

## 11. Telemetry (RX only)

DPS‑150 periodically transmits telemetry (period - 500ms).

| Register | Meaning | Type |
|------|---------|----|
| C0 | Input voltage | float32 |
| E2 | Maximum voltage (usually input voltage - 0.2v) | float32 |
| E3 | Maximum current (usually 5.1A) | float32 |
| C4 | Internal temperature | float32 |
| C3 | Measurement | 12 bytes, 3 float32 values in row - Measured Voltage, Measured Current, Measured Power |

Telemetry frames are **unsolicited** and **must not be acknowledged**.

---

## 12. Additional telemetry (RX - Energy + Capacity)

You can request additional telemetry for energy and capacity:

| Register | Meaning | Type |
|------|---------|----|
| D8 | Energy and Capacity measurement | bool (0 or 1) |
| D9 | Measured Capacity | float32 |
| DA | Measured Energy | float32 |

### Example

Energy and capacity metering:

```
TX: F1 A1 D8 01 01 02

...additionally with main telemetry data there will be 2 additional frames...
RX: F0 A1 D9 04 9B D6 34 00 81
RX: F0 A1 DA 04 CF AE 28 35 B8
```

Note that energy and capacity values only send when Output is `RUN` (see #7), however main telemetry is sent even when output is `STOP`

---

## 13. Telemetry on change

Some frames are automatically sent by device on register change (no need to request it)

| Register | Meaning | Type |
|------|---------|----|
| DB | Running mode | `0 = STOP, 1 = RUN` |
| DC | Protection mode | `0 = OK, 1 = OVP, 2 = OCP, 3 = OPP, 4 = OTP, 5 = LVP, 6 = REP` |
| DD | CC/CV | `0 = CC, 1 = CV` |

## 14. Full Memory Dump

The entire internal state can be requested explicitly.

```
TX: F1 A1 FF 00 FF
RX: F0 A1 FF 8B <139 bytes> <CHK>
```

Contains:
- Active setpoints
- Presets M1–M6
- Protection thresholds
- UI settings
- Status flags

FNIRSI software issues this **after every write**.

---

## 15. Recommended Control Sequence

```text
1. Enable session
2. Choose baud rate
3. Write C1 / C2
4. Write DB = RUN
5. Monitor telemetry
6. Write DB = STOP
7. Disable session
```

---

## 16. Notes for Implementers

- No timing‑critical delays required
- Writes are idempotent
- Protocol is endian‑safe
- Device ignores unknown registers
- Ideal for scripting, CI test rigs, production fixtures

---

## 17. Project Status

✔ Core protocol understood  
✔ All known registers mapped  
✔ Suitable for open‑source libraries  

Future work:
- Bit‑level decode of C3 status
- Offset map of FF dump
- Error condition simulation

---

**End of document**
