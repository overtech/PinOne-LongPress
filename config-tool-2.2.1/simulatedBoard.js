"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimulatedBoard = void 0;
const events_1 = require("events");
const models_1 = require("./models");
/**
 * Mock SerialPort class for simulation
 * Implements the SerialPort interface needed by the application
 */
class MockSerialPort extends events_1.EventEmitter {
    constructor(options) {
        super();
        this.isOpen = false;
        this.path = options.path;
        this.baudRate = options.baudRate;
    }
    open(callback) {
        setTimeout(() => {
            this.isOpen = true;
            if (callback)
                callback();
        }, 10);
    }
    close(callback) {
        this.isOpen = false;
        if (callback)
            callback();
    }
    write(buffer, callback) {
        // Simulate write operation
        setTimeout(() => {
            if (callback)
                callback();
        }, 5);
        return true;
    }
}
/**
 * Simulated Board Implementation
 * Emulates the behavior of the PinOne board for testing without hardware
 */
class SimulatedBoard {
    constructor() {
        this.currentAdminMode = null;
        this.dataInterval = null;
        this.simulatedConfig = null;
        // Simulation state
        this.plungerPosition = 500; // 0-1023
        this.accelX = 0;
        this.accelY = 0;
        this.buttonStates = new Array(32).fill(0);
        this.outputStates = new Array(32).fill(0);
        this.version = [2, 3, 0];
        this.mockSerialPort = new MockSerialPort({
            path: 'SIMULATED',
            baudRate: 2000000,
            autoOpen: false
        });
    }
    getSerialPort() {
        return this.mockSerialPort;
    }
    setBootloader(port) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('[Simulated Board] Setting bootloader mode');
            yield this.connect(port);
            yield this.enableAdminFunction(models_1.ADMIN.RESET);
            this.close();
            // Simulate bootloader port appearing
            yield new Promise(resolve => setTimeout(resolve, 200));
            return 'SIMULATED_BOOTLOADER';
        });
    }
    connect(port) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('[Simulated Board] Connecting to simulated board on port:', port);
            return new Promise((resolve) => {
                this.mockSerialPort.open(() => {
                    // Simulate the initial connection response after a short delay
                    setTimeout(() => {
                        const connectionMessage = 'DEBUG,CSD Board Connected\n';
                        this.mockSerialPort.emit('data', Buffer.from(connectionMessage));
                    }, 50);
                    // Don't send version automatically - wait for GET_VERSION admin command
                    // This matches real board behavior where version is only sent when requested
                    resolve(port === 'Auto' ? 'SIMULATED' : port);
                });
            });
        });
    }
    enableAdminFunction(admin) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('[Simulated Board] Enabling admin function:', models_1.ADMIN[admin]);
            // Stop any existing data stream
            if (this.dataInterval) {
                clearInterval(this.dataInterval);
                this.dataInterval = null;
            }
            this.currentAdminMode = admin;
            // Start sending appropriate data based on admin mode
            switch (admin) {
                case models_1.ADMIN.BUTTONS:
                    this.startButtonStream();
                    break;
                case models_1.ADMIN.OUTPUTS:
                    this.startOutputStream();
                    break;
                case models_1.ADMIN.PLUNGER:
                    this.startPlungerStream();
                    break;
                case models_1.ADMIN.ACCEL:
                    this.startAccelStream();
                    break;
                case models_1.ADMIN.SEND_CONFIG:
                    // Board should send its config to the app
                    this.sendConfigData();
                    break;
                case models_1.ADMIN.GET_CONFIG:
                    // Board is ready to receive config from the app
                    // (actual config data comes via sendConfig method)
                    break;
                case models_1.ADMIN.SAVE_CONFIG:
                    // Save config to board EEPROM (simulated - already in memory)
                    setTimeout(() => {
                        const response = 'R,S\n';
                        this.mockSerialPort.emit('data', Buffer.from(response));
                    }, 100);
                    break;
                case models_1.ADMIN.GET_VERSION:
                    this.sendVersion();
                    break;
                case models_1.ADMIN.OFF:
                    // Stop all data streams
                    break;
                case models_1.ADMIN.CONNECT:
                    // Connection message already sent in connect()
                    break;
            }
            return true;
        });
    }
    sendOutputValue(output, value) {
        console.log('[Simulated Board] Setting output', output, 'to value', value);
        if (output >= 0 && output < this.outputStates.length) {
            this.outputStates[output] = value;
        }
    }
    sendBleMap(mapBytes) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('[Simulated Board] Received BLE button map, size:', mapBytes.length);
            return true;
        });
    }
    sendConfig(config) {
        return __awaiter(this, void 0, void 0, function* () {
            if (config) {
                console.log('[Simulated Board] Receiving configuration, size:', config.length);
                // Store the configuration
                this.simulatedConfig = config;
                console.log('[Simulated Board] Configuration saved successfully');
                // Send acknowledgment
                setTimeout(() => {
                    const response = 'R,Config Saved\n';
                    this.mockSerialPort.emit('data', Buffer.from(response));
                }, 100);
                return true;
            }
            else {
                // Send current config
                this.sendConfigData();
                return true;
            }
        });
    }
    close() {
        console.log('[Simulated Board] Closing connection');
        if (this.dataInterval) {
            clearInterval(this.dataInterval);
            this.dataInterval = null;
        }
        this.mockSerialPort.close();
    }
    // Private helper methods for streaming data
    startButtonStream() {
        this.dataInterval = setInterval(() => {
            // Simulate some button presses randomly
            if (Math.random() > 0.95) {
                const buttonIndex = Math.floor(Math.random() * 10);
                this.buttonStates[buttonIndex] = this.buttonStates[buttonIndex] ? 0 : 1;
            }
            const buttonData = this.buttonStates.slice(0, 32).join(',');
            const message = `B,${buttonData}\n`;
            this.mockSerialPort.emit('data', Buffer.from(message));
        }, 50); // 20Hz update rate
    }
    startOutputStream() {
        this.dataInterval = setInterval(() => {
            const outputData = this.outputStates.slice(0, 32).join(',');
            const message = `O,${outputData}\n`;
            this.mockSerialPort.emit('data', Buffer.from(message));
        }, 100); // 10Hz update rate
    }
    startPlungerStream() {
        this.dataInterval = setInterval(() => {
            // Simulate plunger movement (smooth sine wave)
            const time = Date.now() / 1000;
            this.plungerPosition = Math.floor(512 + Math.sin(time) * 200);
            // Add some noise
            this.plungerPosition += Math.floor((Math.random() - 0.5) * 10);
            // Clamp to valid range
            this.plungerPosition = Math.max(0, Math.min(1023, this.plungerPosition));
            const message = `P,${this.plungerPosition}\n`;
            this.mockSerialPort.emit('data', Buffer.from(message));
        }, 20); // 50Hz update rate
    }
    startAccelStream() {
        this.dataInterval = setInterval(() => {
            // Simulate accelerometer movement (smooth circular motion)
            const time = Date.now() / 1000;
            const normalizedX = Math.sin(time * 0.5) * 0.3;
            const normalizedY = Math.cos(time * 0.5) * 0.3;
            // Convert to raw values (simulating +/- 2g range mapped to +/- 16384)
            const rawX = Math.floor(normalizedX * 16384);
            const rawY = Math.floor(normalizedY * 16384);
            this.accelX = normalizedX;
            this.accelY = normalizedY;
            const message = `A,${this.accelX.toFixed(3)},${this.accelY.toFixed(3)},${rawX},${rawY}\n`;
            this.mockSerialPort.emit('data', Buffer.from(message));
        }, 50); // 20Hz update rate
    }
    sendConfigData() {
        // Send simulated configuration
        setTimeout(() => {
            // Always send the default config for simplicity
            // The byte array format (sent to board) and string format (sent from board)
            // have completely different memory layouts, making conversion complex
            // For simulation purposes, always returning a valid default config is sufficient
            const defaultConfig = this.createDefaultConfig();
            const message = `C,${defaultConfig}\n`;
            this.mockSerialPort.emit('data', Buffer.from(message));
        }, 100);
    }
    sendVersion() {
        setTimeout(() => {
            const message = `V,${this.version.join('.')}\n`;
            this.mockSerialPort.emit('data', Buffer.from(message));
        }, 50);
    }
    createDefaultConfig() {
        // Create a default configuration string (464 bytes + 'E' marker)
        // This should match the default BoardConfiguration values
        const config = new Array(464).fill(0);
        // toySpecialOption (indices 0-62): First 15 are 1, next 16 are 2, rest are 0
        for (let i = 0; i < 15; i++)
            config[i] = 1;
        for (let i = 15; i < 31; i++)
            config[i] = 2;
        // turnOffState (indices 63-125): all 0 (already filled)
        // maxOutputState (indices 126-188): all 255
        for (let i = 126; i < 189; i++)
            config[i] = 255;
        // maxOutputTime (indices 189-251): all 0 (already filled)
        // Plunger settings
        config[252] = 800; // plungerMax
        config[253] = 20; // plungerMin
        config[254] = 200; // plungerMid
        // solenoidButtonMap (indices 255-258)
        config[255] = 1;
        config[256] = 3;
        config[257] = 0;
        config[258] = 0;
        // solenoidOutputMap (indices 259-262)
        config[259] = 1;
        config[260] = 2;
        config[261] = 0;
        config[262] = 0;
        config[263] = 0; // orientation
        config[264] = 1; // accelerometer (boolean - true)
        config[265] = 0; // accelerometerMultiplier
        config[266] = 150; // accelerometerDeadZone
        config[267] = 0; // buttonOption
        config[268] = 5000; // accelerometerTilt
        config[269] = 6000; // accelerometerMax
        config[270] = 10; // plungerAverageRead
        config[271] = 13; // nightModeButton
        config[272] = 23; // plungerLaunchButton
        config[273] = 22; // tiltButton
        config[274] = 3; // shiftButton
        // buttonKeys (indices 275-306): all 0 (already filled)
        config[307] = 0; // disableAccelOnPlungerMove (boolean - false)
        config[308] = 150; // enablePlungerQuickRelease
        config[309] = 0; // disablePlungerWhenNotInUse (boolean - false)
        config[310] = 0; // disableButtonPressWhenKeyboardEnabled (boolean - false)
        config[311] = 5000; // accelerometerTiltY
        config[312] = 6000; // accelerometerMaxY
        // buttonKeyDebounce (indices 313-336): all 0 (already filled)
        config[337] = 0; // buttonDebounceCounter
        config[338] = 1; // enablePlunger (boolean - true)
        config[339] = 200; // tiltSuppression
        config[340] = 1; // enableLightShowAttract (boolean - true)
        config[341] = 10; // lightShowTime
        config[342] = 1; // reverseButtonOutputPolarity (boolean - true)
        config[343] = 1; // disableUSBSuspend (boolean - true)
        config[344] = 0; // bluetoothEnabled (boolean - false)
        config[345] = 0; // debug (boolean - false)
        // buttonRemap (indices 346-377): default mapping 1-32
        for (let i = 0; i < 32; i++)
            config[346 + i] = i + 1;
        config[378] = 9; // tiltButtonUp
        config[379] = 10; // tiltButtonDown
        config[380] = 11; // tiltButtonLeft
        config[381] = 12; // tiltButtonRight
        config[382] = 255; // irOutputPin
        config[383] = 0; // irProtocol
        // irCode (indices 384-387): 32-bit value, default 0
        config[384] = 0;
        config[385] = 0;
        config[386] = 0;
        config[387] = 0;
        config[388] = 0; // irBits
        config[389] = 0; // irButton
        config[390] = 0; // lowLatencyMode (false)
        config[391] = 50; // plungerRestingDeadZone
        // indices 392-415: buttonLongPressTime (24 bytes, default 0)
        // indices 416-439: buttonLongPressKeyboard (24 bytes, default 0)
        // indices 440-463: buttonLongPressRemap (24 bytes, default 0)
        // Add end marker
        return config.join(',') + ',E';
    }
    // Public methods to control simulation for testing
    /**
     * Set the simulated plunger position (for testing)
     */
    setSimulatedPlungerPosition(position) {
        this.plungerPosition = Math.max(0, Math.min(1023, position));
    }
    /**
     * Set the simulated accelerometer values (for testing)
     */
    setSimulatedAccel(x, y) {
        this.accelX = x;
        this.accelY = y;
    }
    /**
     * Simulate a button press (for testing)
     */
    simulateButtonPress(buttonIndex, pressed) {
        if (buttonIndex >= 0 && buttonIndex < this.buttonStates.length) {
            this.buttonStates[buttonIndex] = pressed ? 1 : 0;
        }
    }
    /**
     * Set the simulated firmware version (for testing)
     */
    setSimulatedVersion(major, minor, patch) {
        this.version = [major, minor, patch];
    }
}
exports.SimulatedBoard = SimulatedBoard;
//# sourceMappingURL=simulatedBoard.js.map