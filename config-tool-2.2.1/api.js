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
exports.sendBleOutputBankReport = exports.sendBleOutputReport = exports.listBleOutputDevices = exports.createFirmwareUpdateFiles = exports.uploadBluetoothFirmware = exports.uploadBootloader = exports.sendVDFFile = exports.restoreConfiguration = exports.backupConfiguration = exports.loadAdditionalConfig = exports.saveAdditionalConfig = exports.setBootloader = exports.getSimulationMode = exports.setSimulationMode = exports.sendBleMap = exports.sendBoardConfiguration = exports.setOutputValue = exports.getConnectedComPort = exports.enableAdminFunction = exports.getConnectedStatus = exports.getBoardSerialPorts = exports.connectToBoard = exports.disconnectFromBoard = void 0;
const serialport_1 = require("serialport");
const boardFactory_1 = require("./boardFactory");
const electron_1 = require("electron");
const string_decoder_1 = require("string_decoder");
const child_process_1 = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const HID = require("node-hid");
// HID report ID of the DOF-compatible output report on the PinOne ESP32
const BLE_OUTPUT_REPORT_ID = 3;
// VID/PID used by the ESP32 BLE device (fixed in firmware, independent of device name)
const BLE_VENDOR_ID = 0x0E8F;
const BLE_PRODUCT_ID = 0x9208;
let board = boardFactory_1.BoardFactory.createBoard();
const disconnectFromBoard = () => __awaiter(void 0, void 0, void 0, function* () {
    if (board.getSerialPort().isOpen) {
        board.getSerialPort().close();
    }
});
exports.disconnectFromBoard = disconnectFromBoard;
const connectToBoard = (port) => __awaiter(void 0, void 0, void 0, function* () {
    if (board.getSerialPort().isOpen) {
        board.getSerialPort().close();
    }
    const useSim = (port === 'SIMULATED_PORT');
    boardFactory_1.BoardFactory.setSimulationMode(useSim);
    board = boardFactory_1.BoardFactory.createBoard();
    let connected = yield board.connect(port);
    board.getSerialPort().on('data', onData);
    if (connected) {
        return { connected: true };
    }
    else {
        return { connected: false };
    }
});
exports.connectToBoard = connectToBoard;
const getBoardSerialPorts = () => __awaiter(void 0, void 0, void 0, function* () {
    const ports = yield serialport_1.SerialPort.list();
    return [...ports, { path: 'SIMULATED_PORT', manufacturer: 'Cleveland Software Design (Simulated)' }];
});
exports.getBoardSerialPorts = getBoardSerialPorts;
const getConnectedStatus = () => __awaiter(void 0, void 0, void 0, function* () {
    return board.getSerialPort().isOpen;
});
exports.getConnectedStatus = getConnectedStatus;
const enableAdminFunction = (admin) => __awaiter(void 0, void 0, void 0, function* () {
    yield board.enableAdminFunction(admin);
    console.log('admin function:', admin);
});
exports.enableAdminFunction = enableAdminFunction;
const getConnectedComPort = () => __awaiter(void 0, void 0, void 0, function* () {
    return board.getSerialPort().path;
});
exports.getConnectedComPort = getConnectedComPort;
const setOutputValue = (output, value) => __awaiter(void 0, void 0, void 0, function* () {
    yield board.sendOutputValue(output, value);
});
exports.setOutputValue = setOutputValue;
const sendBoardConfiguration = (config) => __awaiter(void 0, void 0, void 0, function* () {
    return yield board.sendConfig(config);
});
exports.sendBoardConfiguration = sendBoardConfiguration;
const sendBleMap = (mapBytes) => __awaiter(void 0, void 0, void 0, function* () {
    return yield board.sendBleMap(mapBytes);
});
exports.sendBleMap = sendBleMap;
const setSimulationMode = (enabled) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('Setting simulation mode to:', enabled);
    // Disconnect current board if connected
    if (board.getSerialPort().isOpen) {
        board.getSerialPort().close();
    }
    // Set simulation mode
    boardFactory_1.BoardFactory.setSimulationMode(enabled);
    // Create new board instance
    board = boardFactory_1.BoardFactory.createBoard();
    return { simulationMode: enabled };
});
exports.setSimulationMode = setSimulationMode;
const getSimulationMode = () => __awaiter(void 0, void 0, void 0, function* () {
    return { simulationMode: boardFactory_1.BoardFactory.getSimulationMode() };
});
exports.getSimulationMode = getSimulationMode;
const setBootloader = (port) => __awaiter(void 0, void 0, void 0, function* () {
    return yield board.setBootloader(port);
});
exports.setBootloader = setBootloader;
// Helper function to get app data directory
function getAppDataDir() {
    const platform = os.platform();
    let appDataPath;
    if (platform === 'win32') {
        appDataPath = path.join(process.env.APPDATA || '', 'PinOne');
    }
    else if (platform === 'darwin') {
        appDataPath = path.join(os.homedir(), 'Library', 'Application Support', 'PinOne');
    }
    else {
        appDataPath = path.join(os.homedir(), '.pinone');
    }
    // Ensure directory exists
    if (!fs.existsSync(appDataPath)) {
        fs.mkdirSync(appDataPath, { recursive: true });
    }
    return appDataPath;
}
// Save additional config (input/output names and steam mappings) to local storage
const saveAdditionalConfig = (inputNames, outputNames, steamMappings, deviceName) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const appDataDir = getAppDataDir();
        const configPath = path.join(appDataDir, 'pinone-additional-config.pinc');
        const additionalConfig = {
            inputNames,
            outputNames,
            steamMappings: steamMappings || {},
            deviceName: deviceName || 'PinOne',
            version: 3 // Incremented for device name support
        };
        fs.writeFileSync(configPath, JSON.stringify(additionalConfig, null, 2), 'utf-8');
        console.log('[API] Additional config saved to:', configPath);
        return true;
    }
    catch (error) {
        console.error('[API] Error saving additional config:', error);
        return false;
    }
});
exports.saveAdditionalConfig = saveAdditionalConfig;
// Load additional config (input/output names and steam mappings) from local storage
const loadAdditionalConfig = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const appDataDir = getAppDataDir();
        const configPath = path.join(appDataDir, 'pinone-additional-config.pinc');
        if (!fs.existsSync(configPath)) {
            console.log('[API] No additional config found, using defaults');
            return null;
        }
        const fileContent = fs.readFileSync(configPath, 'utf-8');
        const additionalConfig = JSON.parse(fileContent);
        // Backward compatibility: add steamMappings if not present (for version 1 configs)
        if (!additionalConfig.steamMappings) {
            additionalConfig.steamMappings = {};
        }
        // Backward compatibility: add deviceName if not present (for version 1-2 configs)
        if (!additionalConfig.deviceName) {
            additionalConfig.deviceName = 'PinOne';
        }
        console.log('[API] Additional config loaded from:', configPath);
        return additionalConfig;
    }
    catch (error) {
        console.error('[API] Error loading additional config:', error);
        return null;
    }
});
exports.loadAdditionalConfig = loadAdditionalConfig;
const backupConfiguration = (configurationString) => __awaiter(void 0, void 0, void 0, function* () {
    const { filePath } = yield electron_1.dialog.showSaveDialog({
        title: 'Save PinOneConfig File',
        defaultPath: 'backup.pinc',
        filters: [{ name: 'PinOneConfig Files', extensions: ['pinc'] }]
    });
    if (!filePath) {
        return false;
    }
    try {
        console.log('Saving configuration to:', filePath);
        console.log('Configuration:', configurationString);
        fs.writeFileSync(filePath, configurationString);
        return true;
    }
    catch (error) {
        console.error('Error backing up configuration:', error);
        return false;
    }
});
exports.backupConfiguration = backupConfiguration;
const restoreConfiguration = () => __awaiter(void 0, void 0, void 0, function* () {
    const { filePaths } = yield electron_1.dialog.showOpenDialog({
        title: 'Open PinOneConfig File',
        filters: [{ name: 'PinOneConfig Files', extensions: ['pinc'] }]
    });
    if (!filePaths || filePaths.length === 0) {
        return "false";
    }
    const filePath = filePaths[0];
    try {
        console.log('Restoring configuration from:', filePath);
        const configurationString = fs.readFileSync(filePath, 'utf-8');
        return configurationString;
    }
    catch (error) {
        console.error('Error restoring configuration:', error);
        return "false";
    }
});
exports.restoreConfiguration = restoreConfiguration;
const sendVDFFile = (tbSteamSettings, tbVDFFile, bleSettings) => __awaiter(void 0, void 0, void 0, function* () {
    const filePath = tbVDFFile.trim();
    const appendString = tbSteamSettings;
    // Check if the file exists
    if (!fs.existsSync(filePath)) {
        return false;
    }
    try {
        // Read all lines of the file
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const lines = fileContent.split(/\r?\n/);
        // Create a new array to store the modified lines
        const modifiedLines = [];
        // Iterate through each line
        for (const line of lines) {
            // Remove any previously-injected PinOne lines (USB, BT-classic, or BLE)
            const isOldPinOneLine = line.includes("Clev Soft PinOne") || line.includes("PinOne BLE");
            if (isOldPinOneLine && line.endsWith('"')) {
                modifiedLines.push('"');
            }
            else if (!isOldPinOneLine) {
                modifiedLines.push(line);
            }
            if (line.includes("SDL_GamepadBind")) {
                // USB entry (primary)
                modifiedLines.push(appendString);
                // BT-classic entry (same mappings, different GUID prefix)
                modifiedLines.push(appendString.replace("030000008f0e00000792000000000000,0x0e8f Clev Soft PinOne,crc:f7d4", "030047518f0e00000792000000000000,Clev Soft PinOne,crc:5147"));
                // BLE entry — different GUID prefix and fixed button/axis layout
                if (bleSettings) {
                    modifiedLines.push(bleSettings);
                }
            }
        }
        // Write the modified lines back to the file
        fs.writeFileSync(filePath, modifiedLines.join('\n'), 'utf8');
        return true;
    }
    catch (error) {
        console.error("An error occurred:", error);
        return false;
    }
});
exports.sendVDFFile = sendVDFFile;
const uploadBootloader = (port, resetButton, xInput, mainWindow) => __awaiter(void 0, void 0, void 0, function* () {
    if (boardFactory_1.BoardFactory.getSimulationMode()) {
        if (board.getSerialPort().isOpen) {
            board.getSerialPort().close();
        }
        boardFactory_1.BoardFactory.setSimulationMode(false);
        board = boardFactory_1.BoardFactory.createBoard();
    }
    let bootloaderPort = port;
    if (!resetButton) {
        bootloaderPort = yield board.setBootloader(port);
    }
    if (bootloaderPort === "" || bootloaderPort === "SIMULATED_BOOTLOADER") {
        return false;
    }
    try {
        const resourcesPath = electron_1.app.isPackaged
            ? path.join(process.resourcesPath, 'resources')
            : path.join(__dirname, '..', 'resources');
        // Determine the correct avrdude executable based on platform
        const platform = os.platform();
        let avrdudeExePath;
        if (platform === 'win32') {
            avrdudeExePath = path.join(resourcesPath, 'avrdude.exe');
        }
        else if (platform === 'darwin') {
            avrdudeExePath = path.join(resourcesPath, 'avrdude_mac');
        }
        else {
            // Linux and other Unix-like systems
            avrdudeExePath = path.join(resourcesPath, 'avrdude');
        }
        const avrdudeConfPath = path.join(resourcesPath, 'avrdude.conf');
        const hexFilePath = xInput
            ? path.join(resourcesPath, 'PinOneX.ino.hex')
            : path.join(resourcesPath, 'PinOne.ino.hex');
        console.log('Platform:', platform);
        console.log('avrdudeExePath:', avrdudeExePath);
        console.log('avrdudeConfPath:', avrdudeConfPath);
        console.log('hexFilePath:', hexFilePath);
        console.log('bootloaderPort:', bootloaderPort);
        // Make avrdude executable on Unix-like systems (Linux and macOS)
        if (platform !== 'win32') {
            try {
                fs.chmodSync(avrdudeExePath, 0o755);
                console.log('Made avrdude executable');
            }
            catch (chmodError) {
                console.error('Error making avrdude executable:', chmodError);
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('firmware-progress', `Error: Could not make avrdude executable - ${chmodError}`);
                }
                return false;
            }
        }
        const args = [
            '-C', avrdudeConfPath,
            '-v',
            '-patmega32u4',
            '-cavr109',
            '-P', bootloaderPort,
            '-b57600',
            '-D',
            `-Uflash:w:${hexFilePath}:i`,
        ];
        // Send initial progress message
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('firmware-progress', 'Starting firmware update...');
        }
        // Step 5: Execute avrdude
        yield executeAvrdude(avrdudeExePath, args, mainWindow);
        // Send completion message
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('firmware-progress', 'Firmware update completed successfully!');
        }
        return true;
    }
    catch (error) {
        // Send error message
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('firmware-progress', `Error: ${error}`);
        }
        return false;
    }
});
exports.uploadBootloader = uploadBootloader;
const uploadBluetoothFirmware = (port, mainWindow) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const resourcesPath = electron_1.app.isPackaged
            ? path.join(process.resourcesPath, 'resources')
            : path.join(__dirname, '..', 'resources');
        const platform = os.platform();
        let esptoolPath;
        if (platform === 'win32') {
            esptoolPath = path.join(resourcesPath, 'esptool.exe');
        }
        else {
            esptoolPath = path.join(resourcesPath, 'esptool');
        }
        const bootloaderBinPath = path.join(resourcesPath, 'ESP32_VR_Pinball_Controller.ino.bootloader.bin');
        const partitionsBinPath = path.join(resourcesPath, 'ESP32_VR_Pinball_Controller.ino.partitions.bin');
        const bootApp0BinPath = path.join(resourcesPath, 'boot_app0.bin');
        const mainBinPath = path.join(resourcesPath, 'ESP32_VR_Pinball_Controller.ino.bin');
        console.log('Platform:', platform);
        console.log('esptoolPath:', esptoolPath);
        console.log('port:', port);
        if (platform !== 'win32') {
            try {
                fs.chmodSync(esptoolPath, 0o755);
            }
            catch (chmodError) {
                console.error('Error making esptool executable:', chmodError);
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('firmware-progress', `Error: Could not make esptool executable - ${chmodError}`);
                }
                return false;
            }
        }
        const args = [
            '--chip', 'esp32',
            '--port', port,
            '--baud', '921600',
            '--before', 'default-reset',
            '--after', 'hard-reset',
            'write-flash',
            '-z',
            '--flash-mode', 'keep',
            '--flash-freq', 'keep',
            '--flash-size', 'keep',
            '0x1000', bootloaderBinPath,
            '0x8000', partitionsBinPath,
            '0xe000', bootApp0BinPath,
            '0x10000', mainBinPath,
        ];
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('firmware-progress', 'Starting Bluetooth firmware update...');
        }
        yield executeAvrdude(esptoolPath, args, mainWindow, 20000);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('firmware-progress', 'Bluetooth firmware update completed successfully!');
        }
        return true;
    }
    catch (error) {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('firmware-progress', `Error: ${error}`);
        }
        return false;
    }
});
exports.uploadBluetoothFirmware = uploadBluetoothFirmware;
const createFirmwareUpdateFiles = (port, xInput) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const resourcesPath = electron_1.app.isPackaged
            ? path.join(process.resourcesPath, 'resources')
            : path.join(__dirname, '..', 'resources');
        const platform = os.platform();
        const userHomeDir = os.homedir();
        const outputDir = path.join(userHomeDir, 'PinOne-Firmware-Update');
        // Create output directory if it doesn't exist
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        // Determine source files based on platform
        let avrdudeExeName;
        if (platform === 'win32') {
            avrdudeExeName = 'avrdude.exe';
        }
        else if (platform === 'darwin') {
            avrdudeExeName = 'avrdude_mac';
        }
        else {
            avrdudeExeName = 'avrdude';
        }
        const avrdudeExeSrc = path.join(resourcesPath, avrdudeExeName);
        const avrdudeConfSrc = path.join(resourcesPath, 'avrdude.conf');
        const hexFileName = xInput ? 'PinOneX.ino.hex' : 'PinOne.ino.hex';
        const hexFileSrc = path.join(resourcesPath, hexFileName);
        // Copy files to output directory
        const avrdudeExeDest = path.join(outputDir, avrdudeExeName);
        const avrdudeConfDest = path.join(outputDir, 'avrdude.conf');
        const hexFileDest = path.join(outputDir, hexFileName);
        fs.copyFileSync(avrdudeExeSrc, avrdudeExeDest);
        fs.copyFileSync(avrdudeConfSrc, avrdudeConfDest);
        fs.copyFileSync(hexFileSrc, hexFileDest);
        // Make avrdude executable on Unix-like systems
        if (platform !== 'win32') {
            fs.chmodSync(avrdudeExeDest, 0o755);
        }
        // Try to get bootloader port
        let bootloaderPort = '';
        let portObtained = false;
        try {
            bootloaderPort = yield board.setBootloader(port);
            if (bootloaderPort && bootloaderPort !== '') {
                portObtained = true;
            }
        }
        catch (error) {
            console.log('Could not auto-detect bootloader port:', error);
        }
        // Create the script
        let scriptContent;
        let scriptFileName;
        if (platform === 'win32') {
            scriptFileName = 'update-firmware.cmd';
            const portPlaceholder = portObtained ? bootloaderPort : 'COM_PORT_HERE';
            scriptContent = `@echo off
REM PinOne Firmware Update Script
REM ${xInput ? 'XInput Firmware' : 'Standard Firmware'}
REM Generated by PinOne Config Tool

${!portObtained ? `REM ============================================
REM IMPORTANT: Replace COM_PORT_HERE with your actual COM port!
REM To find your COM port:
REM   1. Press the reset button on your PinOne board
REM   2. Open Device Manager and look for a new COM port
REM   3. Replace COM_PORT_HERE below with that port (e.g., COM5)
REM ============================================
` : `REM Bootloader port detected: ${bootloaderPort}
`}
cd /d "%~dp0"

echo Starting firmware update...
avrdude.exe -C avrdude.conf -v -patmega32u4 -cavr109 -P ${portPlaceholder} -b57600 -D -Uflash:w:${hexFileName}:i

if %ERRORLEVEL% EQU 0 (
    echo.
    echo Firmware update completed successfully!
) else (
    echo.
    echo Firmware update failed. Please check the COM port and try again.
)

pause
`;
        }
        else {
            // macOS or Linux
            scriptFileName = 'update-firmware.sh';
            const portPlaceholder = portObtained ? bootloaderPort : '/dev/tty.usbmodemXXXX';
            const avrdudeCmd = platform === 'darwin' ? './avrdude_mac' : './avrdude';
            scriptContent = `#!/bin/bash
# PinOne Firmware Update Script
# ${xInput ? 'XInput Firmware' : 'Standard Firmware'}
# Generated by PinOne Config Tool

${!portObtained ? `# ============================================
# IMPORTANT: Replace the port below with your actual port!
# To find your port:
#   1. Press the reset button on your PinOne board
#   2. Run: ls /dev/tty.usb* (macOS) or ls /dev/ttyACM* (Linux)
#   3. Replace the PORT variable below with the new port that appears
# ============================================
PORT="${portPlaceholder}"
` : `# Bootloader port detected: ${bootloaderPort}
PORT="${bootloaderPort}"
`}
cd "$(dirname "$0")"

echo "Starting firmware update..."
${avrdudeCmd} -C avrdude.conf -v -patmega32u4 -cavr109 -P "$PORT" -b57600 -D -Uflash:w:${hexFileName}:i

if [ $? -eq 0 ]; then
    echo ""
    echo "Firmware update completed successfully!"
else
    echo ""
    echo "Firmware update failed. Please check the port and try again."
fi
`;
        }
        const scriptPath = path.join(outputDir, scriptFileName);
        fs.writeFileSync(scriptPath, scriptContent, 'utf-8');
        // Make script executable on Unix-like systems
        if (platform !== 'win32') {
            fs.chmodSync(scriptPath, 0o755);
        }
        return {
            success: true,
            outputDir: outputDir,
            portObtained: portObtained,
            bootloaderPort: bootloaderPort,
            scriptFileName: scriptFileName
        };
    }
    catch (error) {
        console.error('Error creating firmware update files:', error);
        return {
            success: false,
            error: String(error)
        };
    }
});
exports.createFirmwareUpdateFiles = createFirmwareUpdateFiles;
function executeAvrdude(avrdudeExePath, args, mainWindow, timeout = 10000) {
    return new Promise((resolve, reject) => {
        let timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true;
            if (child) {
                child.kill(); // Terminate the process
                reject(new Error('Execution timed out after 10 seconds.'));
            }
        }, timeout);
        const child = (0, child_process_1.execFile)(avrdudeExePath, args, (error, stdout, stderr) => {
            clearTimeout(timer); // Clear the timeout when the process ends
            if (timedOut)
                return; // Ignore any further processing if already timed out
            if (error) {
                console.error(`Error: ${error}`);
                reject(error);
            }
            else {
                console.log(`stdout: ${stdout}`);
                resolve();
            }
        });
        // Send stdout data to renderer in real-time
        if (child.stdout) {
            child.stdout.on('data', (data) => {
                const message = data.toString().trim();
                console.log(`stdout: ${message}`);
                if (mainWindow && !mainWindow.isDestroyed() && message) {
                    mainWindow.webContents.send('firmware-progress', message);
                }
            });
        }
        // Send stderr data to renderer in real-time (avrdude outputs progress to stderr)
        if (child.stderr) {
            child.stderr.on('data', (data) => {
                const message = data.toString().trim();
                console.error(`stderr: ${message}`);
                if (mainWindow && !mainWindow.isDestroyed() && message) {
                    mainWindow.webContents.send('firmware-progress', message);
                }
            });
        }
    });
}
// ---------------------------------------------------------------------------
//  BLE HID output report helpers
//  Writes directly to the PinOne BLE HID device so commands travel:
//  Config Tool → BLE HID Output Report (ID 3) → ESP32 → SPI MISO → PinOne
// ---------------------------------------------------------------------------
// Returns a list of all connected HID interfaces matching the PinOne BLE
// VID/PID.  Windows creates one HID interface per top-level Application
// Collection in the descriptor, so the device will appear multiple times:
//   • keyboard  usagePage=0x01 usage=0x06
//   • gamepad   usagePage=0x01 usage=0x05  ← Feature Report 3 lives here
const listBleOutputDevices = () => __awaiter(void 0, void 0, void 0, function* () {
    const all = HID.devices().filter(d => d.vendorId === BLE_VENDOR_ID && d.productId === BLE_PRODUCT_ID);
    console.log('[BLE] All PinOne BLE HID interfaces:', JSON.stringify(all, null, 2));
    return all;
});
exports.listBleOutputDevices = listBleOutputDevices;
// Find the best HID interface to send the feature report to.
// Feature Report 3 is declared inside the Gamepad Application Collection
// (usage=0x05) in the HID descriptor, so Windows exposes it through the
// gamepad interface.  We use HidD_SetFeature() (sendFeatureReport) which
// bypasses class-driver filters, so any interface can be tried.
// Prefer the gamepad interface since that collection owns the report.
function findBleInterfaces() {
    const all = HID.devices().filter(d => d.vendorId === BLE_VENDOR_ID && d.productId === BLE_PRODUCT_ID);
    if (all.length === 0)
        return [];
    // Prefer gamepad collection (usagePage=0x01 usage=0x05) — Feature Report 3
    // is defined here after moving it out of the keyboard collection.
    const gamepads = all.filter(d => d.usagePage === 0x01 && d.usage === 0x05);
    if (gamepads.length > 0) {
        console.log('[BLE] Using gamepad interface for feature report:', gamepads.map(d => d.path));
        return gamepads;
    }
    // Fallback: try all interfaces if the gamepad one is missing
    console.log('[BLE] No gamepad interface found — will try all PinOne BLE interfaces');
    return all;
}
// Attempt to write a raw HID output report to the device, trying each
// candidate interface in order.  Returns on the first successful write.
function writeHidOutputReport(reportBytes) {
    return __awaiter(this, void 0, void 0, function* () {
        const candidates = findBleInterfaces();
        if (candidates.length === 0) {
            return {
                success: false,
                error: 'PinOne BLE not found — ensure the ESP32 is paired and connected via Bluetooth.'
            };
        }
        const errors = [];
        for (const dev of candidates) {
            if (!dev.path)
                continue;
            let hid;
            try {
                hid = new HID.HID(dev.path);
                // node-hid on Windows requires the report ID as byte 0 of the write
                // buffer.  The BLE GATT layer strips the report ID before delivering
                // the payload to the NimBLE onWrite() callback (8 remaining bytes).
                // sendFeatureReport uses HidD_SetFeature() which goes directly to
                // the HID minidriver, bypassing the kbdhid.sys class-filter that
                // blocks plain WriteFile() on Windows keyboard interfaces.
                hid.sendFeatureReport(reportBytes);
                hid.close();
                console.log(`[BLE] Feature report succeeded on interface: usagePage=${dev.usagePage} usage=${dev.usage} path=${dev.path}`);
                return { success: true };
            }
            catch (err) {
                if (hid) {
                    try {
                        hid.close();
                    }
                    catch (_) { }
                }
                const msg = `usagePage=${dev.usagePage} usage=${dev.usage}: ${String(err)}`;
                console.warn('[BLE] Write failed on interface:', msg);
                errors.push(msg);
            }
        }
        return {
            success: false,
            error: `All PinOne BLE interfaces rejected the write:\n${errors.join('\n')}`
        };
    });
}
// Sends a single-output command (outputId 0-62, value 0-255) to the
// PinOne BLE via BLE HID Feature Report 3.
// Report layout: [reportId=3, 0xFF, outputId, value, 0, 0, 0, 0, 0]
const sendBleOutputReport = (outputId, value) => __awaiter(void 0, void 0, void 0, function* () {
    console.log(`[BLE] Sending single output ${outputId} = ${value}`);
    const result = yield writeHidOutputReport([BLE_OUTPUT_REPORT_ID, 0xFF, outputId & 0xFF, value & 0xFF, 0, 0, 0, 0, 0]);
    if (result.success) {
        console.log(`[BLE] Single output ${outputId} = ${value} sent`);
    }
    else {
        console.error('[BLE] sendBleOutputReport failed:', result.error);
    }
    return result;
});
exports.sendBleOutputReport = sendBleOutputReport;
// Sends a bank output command (bankIndex 0-8, 7 values 0-255) to the
// PinOne BLE via BLE HID Feature Report 3.
// Report layout: [reportId=3, bankIndex, v0, v1, v2, v3, v4, v5, v6]
const sendBleOutputBankReport = (bankIndex, values) => __awaiter(void 0, void 0, void 0, function* () {
    const v = values.slice(0, 7).map(x => x & 0xFF);
    while (v.length < 7)
        v.push(0);
    console.log(`[BLE] Sending bank ${bankIndex} [${v.join(',')}]`);
    const result = yield writeHidOutputReport([BLE_OUTPUT_REPORT_ID, bankIndex & 0xFF, ...v]);
    if (result.success) {
        console.log(`[BLE] Bank ${bankIndex} sent`);
    }
    else {
        console.error('[BLE] sendBleOutputBankReport failed:', result.error);
    }
    return result;
});
exports.sendBleOutputBankReport = sendBleOutputBankReport;
const decoder = new string_decoder_1.StringDecoder('utf-8');
let lineData = '';
const onData = (data) => {
    // Append incoming data to the buffer, decoding it to handle encoding issues
    lineData += decoder.write(data);
    // Use a regex to split lines based on CRLF (or just LF)
    const splitString = lineData.split(/\r?\n/);
    // Process complete lines (everything except the last element)
    if (splitString.length > 1) {
        for (let i = 0; i < splitString.length - 1; i++) {
            const completeLine = splitString[i].trim();
            //console.log('RS232 actual Data:', completeLine);
            // Forward the data to the renderer process
            electron_1.webContents.getAllWebContents().forEach((contents) => {
                contents.send('com-port-data', completeLine); // Send each complete line to the front end
            });
        }
        // Clear the buffer and keep only the last incomplete line segment
        lineData = splitString[splitString.length - 1];
    }
};
// const onData = (data: Buffer) => {
//   console.log('Data received from the board:', data.toString());
//   // Forward the data to the renderer process
//   webContents.getAllWebContents().forEach((contents) => {
//     contents.send('com-port-data', data.toString()); // Send data as a string to the front end
//   });
// };
//# sourceMappingURL=api.js.map