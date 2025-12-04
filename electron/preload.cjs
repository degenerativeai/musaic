const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Add any API you want to expose to the renderer here
    // example: ping: () => ipcRenderer.invoke('ping')
});
