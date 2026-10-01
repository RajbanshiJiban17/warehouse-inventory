const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  getServerUrl: () => ipcRenderer.invoke('config:get-server-url'),
  setServerUrl: (url) => ipcRenderer.invoke('config:set-server-url', url),
  checkBackendHealth: () => ipcRenderer.invoke('app:check-backend'),
  onBackendStatusChange: (callback) => {
    ipcRenderer.on('backend:status', (_event, value) => callback(value));
  },
});
