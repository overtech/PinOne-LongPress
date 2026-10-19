const { contextBridge, ipcRenderer } = require('electron');
const { uploadBootloader } = require('./api');

contextBridge.exposeInMainWorld('electronAPI', {
  getBoardSerialPorts: () => ipcRenderer.invoke('get-board-serial-ports'),
  connectToBoard: (port) => ipcRenderer.invoke('connect-to-board', port),
  enableAdmin: (admin) => ipcRenderer.invoke('enable-admin', admin),
  onComPortData: (callback) => {
    ipcRenderer.on('com-port-data', callback);
    // Return a function to remove this specific listener
    return () => ipcRenderer.removeListener('com-port-data', callback);
  },
  onFirmwareProgress: (callback) => {
    ipcRenderer.on('firmware-progress', callback);
    // Return a function to remove this specific listener
    return () => ipcRenderer.removeListener('firmware-progress', callback);
  },
  getConnectedStatus: () => ipcRenderer.invoke('get-connected-status'),
  getConnectedComPort: () => ipcRenderer.invoke('get-connected-com-port'),
  setOutputValue: (output, value) => ipcRenderer.invoke('set-output-value', output, value),
  disconnectFromBoard: () => ipcRenderer.invoke('disconnect-from-board'),
  sendBoardConfiguration: (config) => ipcRenderer.invoke('send-board-configuration', config),
  sendVDFFile: (tbSteamSettings, tbVDFFile, bleSettings) => ipcRenderer.invoke('send-vdf-file', tbSteamSettings, tbVDFFile, bleSettings),
  backupConfiguration: (configurationString) => ipcRenderer.invoke('backup-configuration', configurationString),
  restoreConfiguration: () => ipcRenderer.invoke('restore-configuration'),
  uploadBootloader: (port, resetButton, xInput) => ipcRenderer.invoke('upload-bootloader', port, resetButton, xInput),
  uploadBluetoothFirmware: (port) => ipcRenderer.invoke('upload-bluetooth-firmware', port),
  setSimulationMode: (enabled) => ipcRenderer.invoke('set-simulation-mode', enabled),
  getSimulationMode: () => ipcRenderer.invoke('get-simulation-mode'),
  saveAdditionalConfig: (inputNames, outputNames, steamMappings, deviceName) => ipcRenderer.invoke('save-additional-config', inputNames, outputNames, steamMappings, deviceName),
  loadAdditionalConfig: () => ipcRenderer.invoke('load-additional-config'),
  sendBleMap: (mapBytes) => ipcRenderer.invoke('send-ble-map', mapBytes),
  setBootloader: (port) => ipcRenderer.invoke('set-bootloader', port),
  createFirmwareUpdateFiles: (port, xInput) => ipcRenderer.invoke('create-firmware-update-files', port, xInput),
  listBleOutputDevices: () => ipcRenderer.invoke('list-ble-output-devices'),
  sendBleOutputReport: (outputId, value) => ipcRenderer.invoke('send-ble-output-report', outputId, value),
  sendBleOutputBankReport: (bankIndex, values) => ipcRenderer.invoke('send-ble-output-bank-report', bankIndex, values),
});