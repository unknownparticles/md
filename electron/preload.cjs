const {contextBridge, ipcRenderer} = require('electron');

// Keep all file access in the main process. The renderer receives a tiny,
// explicit API instead of direct Node permissions, which keeps Electron's
// sandbox enabled while still allowing native menu actions.
contextBridge.exposeInMainWorld('alunReader', {
  openMarkdown: () => ipcRenderer.invoke('dialog:open-markdown'),
  openRecent: (filePath) => ipcRenderer.invoke('file:open-recent', filePath),
  reloadMarkdown: (filePath) => ipcRenderer.invoke('file:reload-markdown', filePath),
  saveMarkdown: (payload) => ipcRenderer.invoke('file:save-markdown', payload),
  newWindow: () => ipcRenderer.invoke('window:new-document'),
  downloadUpdate: (asset) => ipcRenderer.invoke('update:download-open', asset),
  onMenuCommand: (callback) => {
    const listener = (_event, message) => callback(message);
    ipcRenderer.on('menu-command', listener);
    return () => ipcRenderer.removeListener('menu-command', listener);
  },
});
