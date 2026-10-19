# PinOne Firmware & Config Tool 2.2.1 — Long Press Feature Documentation

## 1. Overview
This customization adds **per-input Long Press button support** to both the **PinOne Controller Firmware** (ATmega32U4 / Pro Micro) and the **PinOne Config Tool 2.2.1** desktop application.

Any physical input (`Input 1` through `Input 24`) can now optionally be configured with a **Long Press** hold timer (`1–60` whole seconds, `Off` by default) and an independent **Long Press Keyboard Mapping** and/or **Long Press Button Mapping** (`Button 1`–`Button 32`, `Toggle Night Mode`, or `Toggle KB/Gamepad Mode`).

---

## 2. File Locations

| Component | Path | Description |
| :--- | :--- | :--- |
| **Firmware Source Repo** | `d:\DevWork\AntiGrav\arduino-virtual-pinball-board` | Modified Arduino sketch (`PinOne.ino`, `Buttons.*`, `Config.*`, `MPU6050.*`, `Outputs.*`) |
| **Compiled Firmware Hex** | `D:\vPinball\PinOne-LongPress.ino.hex` | Standalone compiled `.hex` (`26,560 / 28,672` bytes Flash, `1,973 / 2,560` bytes SRAM) |
| **Updated Config Tool App** | `D:\vPinball\PinOne-Config-Tool-2.2.1-LongPress\pinone-config-tool.exe` | Runnable Config Tool 2.2.1 with Long Press UI, bundled firmware hex, and Windows COM/Bluetooth fixes |
| **Unpacked UI Source** | `d:\DevWork\AntiGrav\pinone-config-tool-2.2.1` | Modified `main.9375c7e6c5178d47.js`, `api.js`, `serialPort.js`, `simulatedBoard.js` |
| **Stock 2.2.1 Backups** | `D:\vPinball\PinOne-Config-Tool-2.2.1-LongPress\resources\app.asar.bak`<br>`D:\vPinball\PinOne-Config-Tool-2.2.1-LongPress\resources\resources\PinOne.ino.hex.bak` | Original unmodified `2.2.1` UI archive and firmware hex for instant rollback |

---

## 3. Runtime Button Behavior (Firmware State Machine)

Implemented in `Buttons.h` and `Buttons.cpp` using a non-blocking 4-state machine per physical input (`LP_IDLE = 0`, `LP_WAITING = 1`, `LP_FIRED_HOLD = 2`, `LP_SHORT_PULSE = 3`):

### A. When Long Press is OFF (`buttonLongPressTime[i] == 0`)
* **Zero Latency:** Pressing the physical button immediately sends the normal Keyboard/Gamepad press on the rising edge (`0 -> 1`) and releases on the falling edge (`1 -> 0`).
* Flippers, Magna-Save, and Nudge buttons should always keep Long Press **OFF**.

### B. When Long Press is ON (`buttonLongPressTime[i] = 1..60` seconds)
* **Short Press (Released before `Seconds` threshold):**
  * When the physical button is released prior to the hold threshold, the firmware triggers a non-blocking **`50ms` pulse** (`SHORT_PRESS_PULSE_MS = 50`) of the input's normal **Keyboard Mapping** and **Button Mapping** (as well as any shifted button, solenoid trigger, or IR command), then automatically releases it after `50ms`.
  * Ensures USB HID polling in Visual Pinball (VPX), Future Pinball, PinUP Popper, and Steam/FX reliably registers every short tap.
* **Long Press (Held `>= Seconds` threshold):**
  * As soon as the physical button has been held for `buttonLongPressTime[i] * 1000` ms, the firmware **immediately** triggers the input's **Long Press Keyboard Mapping** and/or **Long Press Button Mapping** (`LP_FIRED_HOLD`) without waiting for release.
  * The Long Press output remains held until the physical button is released (at which point the normal short press is suppressed).
* **Special Long Press Button Mapping Codes:**
  * `0` (`None`): No gamepad button sent on long press (only Long Press Keyboard Mapping if set).
  * `1..32`: Presses USB Gamepad `Button 1`–`Button 32` (and updates `processedButtonState` / `lastButtonState[24..31]` for virtual buttons `25–32`, plus fires any matching `Button Trigger 1–4` solenoid output).
  * `253` (`Toggle Night Mode`): Toggles `config.nightMode` on/off and flashes any configured Light Show outputs. When Night Mode is **disabled** (`config.nightMode == false`), it also triggers a sequential left-then-right (`Output 1` then `Output 2`) `60ms` pulse for audible/tactile confirmation that solenoids are active again.
  * `254` (`Toggle KB/Gamepad Mode`): Toggles `config.disableButtonPressWhenKeyboardEnabled` between Keyboard and Gamepad mode and flashes the cabinet lights (replaces the old hardcoded 5-second hold on Button 9).

---

## 4. EEPROM Layout & Serial Protocol Specification

### EEPROM Storage (`Config.cpp`)
To preserve existing user calibrations when upgrading from stock `2.2.1` firmware, a schema marker byte is stored at **`EEPROM[999] = 102`**:
* **`EEPROM[619..642]` (24 bytes):** `buttonLongPressTime[0..23]` (`0` = Off, `1..60` = hold time in whole seconds)
* **`EEPROM[643..666]` (24 bytes):** `buttonLongPressKeyboard[0..23]` (`0` = None, or USB HID keycode)
* **`EEPROM[667..690]` (24 bytes):** `buttonLongPressRemap[0..23]` (`0` = None, `1..32` = Button 1–32, `253` = Toggle Night Mode, `254` = Toggle KB/Gamepad Mode)

### Serial Protocol (`GET_CONFIG` / `SEND_CONFIG` / `BUTTONS`)
* **Host → Board (`GET_CONFIG`, `toConfigBytes()`):**
  * Extended from `401` bytes to **`473` bytes** (`bytes 0..399` unchanged; `400..423` = `buttonLongPressTime[24]`; `424..447` = `buttonLongPressKeyboard[24]`; `448..471` = `buttonLongPressRemap[24]`; `472` = end marker `42`).
* **Board → Host (`SEND_CONFIG`, `C,...`):**
  * Extended from `392` comma-separated values + `E` to **`464` comma-separated values + `E`**.
  * The Config Tool parser (`qr.stringToConfig`) accepts **both** `392`-field legacy strings and `464`-field Long Press strings.
* **Board → Host (`BUTTONS`, `B,...`):**
  * Each of the 32 button slots now reports:
    * `0` = Released (Gray indicator in UI)
    * `1` = Pressed / Held before Long Press threshold (Red indicator in UI)
    * `2` = Long Press threshold achieved (`LP_FIRED_HOLD`) while still held (Green indicator in UI)

---

## 5. ATmega32U4 Flash & SRAM Optimizations
To fit the Long Press state machine, EEPROM persistence, and serial protocol on the ATmega32U4 (`28,672` bytes max Flash, `2,560` bytes max SRAM):
1. **Direct `<Wire.h>` I2C Driver in `MPU6050.h` / `MPU6050.cpp`:** Replaced the heavy `Adafruit_BusIO_Register` and `Adafruit_Sensor` object wrappers with lightweight `<Wire.h>` register reads/writes (`readReg8`, `writeReg8`), saving **>3,100 bytes of Flash**.
2. **16-Bit Output Timers in `Outputs.h` / `Outputs.cpp`:** Compacted `timeTurnedOn[63]` from 32-bit `long int` to 16-bit `uint16_t`, saving **126 bytes of SRAM**.
3. **Prologue/Epilogue Call Compaction:** Compiled with `-mcall-prologues`.

---

## 6. PinOne Config Tool 2.2.1 UI & Serial Improvements

1. **Inputs Tab (`<app-input-control>` & `<app-inputs>`):**
   * Aligned 2-row CSS Grid on each physical input card (`Input 1`–`Input 24`):
     * **Row 1 (Normal Press):** `Input N [✎]` | `( N )` Indicator Circle | `Keyboard Mapping` | `Button Mapping` | `Debounce` (stacked label + toggle)
     * **Row 2 (Long Press):** `Long Press` (stacked label + toggle) | `Seconds` (`1–60` number input, default `2`) | `Keyboard Mapping` | `Button Mapping` (`None`, `1`–`32`, `Toggle Night Mode`, `Toggle KB/Gamepad Mode`)
   * When the **Long Press** toggle is OFF, Row 2 remains visible with `Seconds`, `Keyboard Mapping`, and `Button Mapping` disabled/grayed out.
   * **Red → Green Indicator Circle:** Lights up **red** on initial button press and transitions to **green** (`#2e7d32`) once the Long Press threshold is reached, remaining green until released.
2. **Settings Tab (`Night Mode Options`):**
   * Added **`Night Mode Long Press Button`** radio option alongside `Night Mode Toggle Button` and `Night Mode Push Button`.
   * Two-way synchronized with the **Inputs** tab: selecting `Night Mode Long Press Button` on a button in **Settings** configures that input's Long Press to `Toggle Night Mode` (`253`), and disabling Long Press on that input in **Inputs** automatically unselects `Night Mode Long Press Button` in **Settings**.
3. **Windows COM Port & Simulated Board Fixes (`serialPort.js` & `api.js`):**
   * Added **`SIMULATED_PORT`** directly to the COM Port dropdown for hardware-free testing.
   * Fixed `Auto` port scan hang/crash on Windows systems with motherboard `COM1` or disconnected Bluetooth Serial ports (`COM16`/`COM17`) by prioritizing USB Vendor ID `0E8F`, adding read timeouts, attaching safe serial error handlers, and asserting `DTR`/`RTS` on port open.
