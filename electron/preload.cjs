const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Add any API you want to expose to the renderer here
    saveImage: (filename, base64Data, subfolder) => ipcRenderer.invoke('save-image', { filename, base64Data, subfolder }),
    apiRequest: (url, options) => ipcRenderer.invoke('api-request', { url, options })
});
