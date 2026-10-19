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
const electron_1 = require("electron");
const path = require("path");
const fs = require("fs");
const api_1 = require("./api");
const models_1 = require("./models");
let win = null;
const args = process.argv.slice(1), serve = args.some(val => val === '--serve');
function createWindow() {
    const size = electron_1.screen.getPrimaryDisplay().workAreaSize;
    // Create the browser window.
    win = new electron_1.BrowserWindow({
        x: 0,
        y: 0,
        width: size.width,
        height: size.height,
        autoHideMenuBar: false,
        webPreferences: {
            nodeIntegration: true,
            preload: path.join(__dirname, 'preload.js'),
            allowRunningInsecureContent: (serve),
            contextIsolation: true,
            //enableRemoteModule: false,
        },
    });
    if (serve) {
        (() => __awaiter(this, void 0, void 0, function* () {
            try {
                // const debug = await import('electron-debug');
                // debug.default();  // electron-debug has a default export
                // const reloader = await import('electron-reloader');
                // reloader(module); // Directly call the function since there's no default export
            }
            catch (error) {
                console.error('Error loading debug or reloader modules:', error);
            }
        }))();
        win.loadURL('http://localhost:4200');
    }
    else {
        // Path when running electron executable
        let pathIndex = './index.html';
        if (fs.existsSync(path.join(__dirname, '../dist/index.html'))) {
            // Path when running electron in local folder
            pathIndex = '../dist/index.html';
        }
        const url = new URL(path.join('file:', __dirname, pathIndex));
        win.loadURL(url.href);
    }
    // Emitted when the window is closed.
    win.on('closed', () => {
        // Dereference the window object, usually you would store window
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        win = null;
    });
    return win;
}
try {
    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.
    // Added 400 ms to fix the black background issue while using transparent window. More detais at https://github.com/electron/electron/issues/15947
    electron_1.app.on('ready', () => setTimeout(createWindow, 400));
    let disconnecting = false;
    electron_1.app.on('before-quit', (event) => __awaiter(void 0, void 0, void 0, function* () {
        if (disconnecting) {
            console.log('Returning');
            return;
        }
        if ((yield (0, api_1.getConnectedStatus)()) == true) {
            event.preventDefault();
            disconnecting = true;
            // Stop immediate exit
            console.log('Performing async cleanup before quitting...');
            (0, api_1.enableAdminFunction)(models_1.ADMIN.OFF)
                .then(() => {
                (0, api_1.disconnectFromBoard)();
                console.log('Cleanup complete. Now exiting.');
                electron_1.app.quit(); // Exit after cleanup
            })
                .catch((error) => {
                console.error('Error during cleanup:', error);
                electron_1.app.exit(1); // Exit with an error code
            });
        }
        else {
            console.log('No cleanup needed. Now exiting.');
            disconnecting = false;
            electron_1.app.quit(); // Exit without cleanup
        }
    }));
    // Quit when all windows are closed.
    electron_1.app.on('window-all-closed', () => {
        // On OS X it is common for applications and their menu bar
        // to stay active until the user quits explicitly with Cmd + Q
        console.log('closing windows...');
        if (process.platform !== 'darwin') {
            electron_1.app.quit();
        }
    });
    electron_1.app.on('activate', () => {
        // On OS X it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (win === null) {
            createWindow();
        }
    });
    // Handle fetching users via IPC
    electron_1.ipcMain.handle('connect-to-board', (event, port) => __awaiter(void 0, void 0, void 0, function* () {
        return yield (0, api_1.connectToBoard)(port);
    }));
    electron_1.ipcMain.handle('enable-admin', (event, admin) => __awaiter(void 0, void 0, void 0, function* () {
        return yield (0, api_1.enableAdminFunction)(admin);
    }));
    electron_1.ipcMain.handle('get-board-serial-ports', (event, port) => __awaiter(void 0, void 0, void 0, function* () {
        return yield (0, api_1.getBoardSerialPorts)();
    }));
    electron_1.ipcMain.handle('get-connected-status', () => __awaiter(void 0, void 0, void 0, function* () {
        return yield (0, api_1.getConnectedStatus)();
    }));
    electron_1.ipcMain.handle('get-connected-com-port', () => __awaiter(void 0, void 0, void 0, function* () {
        return yield (0, api_1.getConnectedComPort)();
    }));
    electron_1.ipcMain.handle('set-output-value', (event, output, value) => __awaiter(void 0, void 0, void 0, function* () {
        return yield (0, api_1.setOutputValue)(output, value);
    }));
    electron_1.ipcMain.handle('disconnect-from-board', () => __awaiter(void 0, void 0, void 0, function* () {
        return yield (0, api_1.disconnectFromBoard)();
    }));
    electron_1.ipcMain.handle('send-board-configuration', (event, config) => __awaiter(void 0, void 0, void 0, function* () {
        return yield (0, api_1.sendBoardConfiguration)(config);
    }));
    electron_1.ipcMain.handle('send-ble-map', (event, mapBytes) => __awaiter(void 0, void 0, void 0, function* () {
        return yield (0, api_1.sendBleMap)(mapBytes);
    }));
    electron_1.ipcMain.handle('send-vdf-file', (event, tbSteamSettings, tbVDFFile, bleSettings) => __awaiter(void 0, void 0, void 0, function* () {
        return yield (0, api_1.sendVDFFile)(tbSteamSettings, tbVDFFile, bleSettings);
    }));
    electron_1.ipcMain.handle('backup-configuration', (event, configurationString) => __awaiter(void 0, void 0, void 0, function* () {
        return yield (0, api_1.backupConfiguration)(configurationString);
    }));
    electron_1.ipcMain.handle('restore-configuration', (event) => __awaiter(void 0, void 0, void 0, function* () {
        return yield (0, api_1.restoreConfiguration)();
    }));
    electron_1.ipcMain.handle('upload-bootloader', (event, port, resetButton, xInput) => __awaiter(void 0, void 0, void 0, function* () {
        return yield (0, api_1.uploadBootloader)(port, resetButton, xInput, win);
    }));
    electron_1.ipcMain.handle('upload-bluetooth-firmware', (event, port) => __awaiter(void 0, void 0, void 0, function* () {
        return yield (0, api_1.uploadBluetoothFirmware)(port, win);
    }));
    electron_1.ipcMain.handle('set-simulation-mode', (event, enabled) => __awaiter(void 0, void 0, void 0, function* () {
        return yield (0, api_1.setSimulationMode)(enabled);
    }));
    electron_1.ipcMain.handle('get-simulation-mode', () => __awaiter(void 0, void 0, void 0, function* () {
        return yield (0, api_1.getSimulationMode)();
    }));
    electron_1.ipcMain.handle('save-additional-config', (event, inputNames, outputNames, steamMappings, deviceName) => __awaiter(void 0, void 0, void 0, function* () {
        return yield (0, api_1.saveAdditionalConfig)(inputNames, outputNames, steamMappings, deviceName);
    }));
    electron_1.ipcMain.handle('load-additional-config', () => __awaiter(void 0, void 0, void 0, function* () {
        return yield (0, api_1.loadAdditionalConfig)();
    }));
    electron_1.ipcMain.handle('set-bootloader', (event, port) => __awaiter(void 0, void 0, void 0, function* () {
        return yield (0, api_1.setBootloader)(port);
    }));
    electron_1.ipcMain.handle('create-firmware-update-files', (event, port, xInput) => __awaiter(void 0, void 0, void 0, function* () {
        return yield (0, api_1.createFirmwareUpdateFiles)(port, xInput);
    }));
    electron_1.ipcMain.handle('list-ble-output-devices', () => __awaiter(void 0, void 0, void 0, function* () {
        return yield (0, api_1.listBleOutputDevices)();
    }));
    electron_1.ipcMain.handle('send-ble-output-report', (event, outputId, value) => __awaiter(void 0, void 0, void 0, function* () {
        return yield (0, api_1.sendBleOutputReport)(outputId, value);
    }));
    electron_1.ipcMain.handle('send-ble-output-bank-report', (event, bankIndex, values) => __awaiter(void 0, void 0, void 0, function* () {
        return yield (0, api_1.sendBleOutputBankReport)(bankIndex, values);
    }));
}
catch (e) {
    console.error('Error during app initialization', e);
}
//# sourceMappingURL=main.js.map