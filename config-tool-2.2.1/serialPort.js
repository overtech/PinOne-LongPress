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
exports.Board = void 0;
const serialport_1 = require("serialport");
const models_1 = require("./models");
let serialPort;
let serialPortString;
class RS232 {
    constructor(portName, baudRate = 2000000) {
        if (serialPort && serialPort.isOpen) {
            try { serialPort.close(); } catch (e) {}
        }
        serialPort = new serialport_1.SerialPort({ path: portName, baudRate: baudRate, autoOpen: false });
        serialPort.on('error', (err) => {
            console.warn(`[RS232] Ignored serial error on ${portName}:`, err.message);
        });
    }
    open() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                if (!serialPort.isOpen) {
                    serialPort.open((err) => {
                        if (err) {
                            reject(err);
                        }
                        else {
                            serialPort.set({ dtr: true, rts: true }, () => {
                                resolve();
                            });
                        }
                    });
                }
                else {
                    serialPort.set({ dtr: true, rts: true }, () => {
                        resolve();
                    });
                }
            });
        });
    }
    close() {
        if (serialPort && serialPort.isOpen) {
            try { serialPort.close(); } catch (e) {}
        }
    }
    read(timeoutMs = 1200) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                let data = '';
                const timer = setTimeout(() => {
                    cleanup();
                    reject(new Error('Serial read timeout'));
                }, timeoutMs);
                const onData = (chunk) => {
                    data += chunk.toString();
                    if (data.includes('\n')) {
                        cleanup();
                        resolve(data.trim());
                    }
                };
                const onError = (err) => {
                    cleanup();
                    reject(err);
                };
                const cleanup = () => {
                    clearTimeout(timer);
                    if (serialPort) {
                        serialPort.removeListener('data', onData);
                        serialPort.removeListener('error', onError);
                    }
                };
                serialPort.on('data', onData);
                serialPort.on('error', onError);
            });
        });
    }
    send(data) {
        if (serialPort && serialPort.isOpen) {
            serialPort.write(Buffer.from(data), (err) => {
                if (err) {
                    console.warn('[RS232] Write error:', err.message);
                }
            });
        }
    }
}
class Board {
    constructor() {
        this.CSDConnection = null;
    }
    getSerialPort() {
        return serialPort || { isOpen: false, path: '', close: () => {}, on: () => {} };
    }
    setBootloader(port) {
        return __awaiter(this, void 0, void 0, function* () {
            const ports = yield serialport_1.SerialPort.list();
            console.log('port set to: ', port);
            const portPaths = ports.map((port) => port.path);
            let pinOnePort = yield this.connect(port);
            if (pinOnePort === "") {
                return "";
            }
            yield this.enableAdminFunction(models_1.ADMIN.RESET);
            this.CSDConnection.close();
            console.log('found pinOnePort: ', pinOnePort);
            let counter = 0;
            while (counter < 25) {
                yield new Promise(resolve => setTimeout(resolve, 150));
                const newPorts = yield serialport_1.SerialPort.list();
                for (const sp of newPorts) {
                    let isNewPort = true;
                    for (const oldPort of portPaths) {
                        if (sp.path === oldPort) {
                            isNewPort = false;
                        }
                    }
                    if (isNewPort) {
                        console.log('found bootloader port: ', sp.path);
                        return sp.path;
                    }
                }
                counter++;
            }
            return pinOnePort;
        });
    }
    connect(port) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(port);
            if (port === "Auto" && !serialPortString) {
                const allPorts = yield serialport_1.SerialPort.list();
                // Prioritize USB serial ports (especially PinOne VID 0E8F / Arduino VID 2341) and skip non-USB ports first
                const sortedPorts = [...allPorts].sort((a, b) => {
                    const aPin = (a.vendorId && a.vendorId.toUpperCase() === '0E8F') ? 2 : (a.vendorId ? 1 : 0);
                    const bPin = (b.vendorId && b.vendorId.toUpperCase() === '0E8F') ? 2 : (b.vendorId ? 1 : 0);
                    return bPin - aPin;
                });
                for (const sp of sortedPorts) {
                    // Skip legacy ACPI COM1 and Bluetooth SPP virtual ports during Auto scan if they lack a USB vendorId
                    if (!sp.vendorId) {
                        continue;
                    }
                    this.CSDConnection = new RS232(sp.path);
                    try {
                        yield this.CSDConnection.open();
                        yield this.enableAdminFunction(models_1.ADMIN.CONNECT);
                        const start = Date.now();
                        while (Date.now() - start < 1500) {
                            const result = yield this.CSDConnection.read(1200);
                            if (result.includes("DEBUG,CSD Board Connected")) {
                                serialPortString = sp.path;
                                return serialPortString;
                            }
                        }
                        this.CSDConnection.close();
                    }
                    catch (err) {
                        this.CSDConnection.close();
                    }
                }
            }
            else {
                const targetPort = (port === "Auto") ? serialPortString : port;
                this.CSDConnection = new RS232(targetPort);
                try {
                    yield this.CSDConnection.open();
                    yield this.enableAdminFunction(models_1.ADMIN.CONNECT);
                    const start = Date.now();
                    while (Date.now() - start < 2000) {
                        const result = yield this.CSDConnection.read(1500);
                        if (result.includes("DEBUG,CSD Board Connected")) {
                            return targetPort;
                        }
                    }
                    this.CSDConnection.close();
                }
                catch (err) {
                    this.CSDConnection.close();
                }
            }
            return "";
        });
    }
    enableAdminFunction(admin) {
        return __awaiter(this, void 0, void 0, function* () {
            this.CSDConnection.send([0, 250, admin, 0, 0, 0, 0, 0, 0]);
            yield new Promise(resolve => setTimeout(resolve, 100));
            return true;
        });
    }
    sendOutputValue(output, value) {
        this.CSDConnection.send([0, 252, output, value, 0, 0, 0, 0, 0]);
    }
    sendBleMap(mapBytes) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.enableAdminFunction(models_1.ADMIN.SET_BLE_MAP);
                yield new Promise(resolve => setTimeout(resolve, 100));
                this.CSDConnection.send(Array.from(mapBytes));
            }
            catch (error) {
                return false;
            }
            return true;
        });
    }
    sendConfig(config) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.enableAdminFunction(models_1.ADMIN.GET_CONFIG);
                // Wait for 100 milliseconds after enabling admin function
                yield new Promise(resolve => setTimeout(resolve, 100));
                const chunkSize = 50;
                const waitTime = 100; // Wait time in milliseconds
                for (let i = 0; i < config.length; i += chunkSize) {
                    // Determine the size of the current chunk and convert it to an array of numbers
                    const currentChunk = Array.from(config.slice(i, i + chunkSize));
                    // Send the current chunk as an array of numbers
                    this.CSDConnection.send(currentChunk);
                    // Wait for the specified time before sending the next chunk
                    yield new Promise(resolve => setTimeout(resolve, waitTime));
                }
            }
            catch (error) {
                return false;
            }
            return true;
        });
    }
    close() {
        this.CSDConnection.close();
    }
}
exports.Board = Board;
//# sourceMappingURL=serialPort.js.map