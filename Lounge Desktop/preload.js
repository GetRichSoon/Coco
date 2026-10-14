// Gives the Lounge screens one safe desktop ability: saving the cloud rules for Claude sessions on this PC.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('cocoDesktop', {
  saveRules: (text) => ipcRenderer.send('save-rules', String(text)),
  getStartup: () => ipcRenderer.invoke('get-startup'),
  setStartup: (on) => ipcRenderer.invoke('set-startup', !!on),
  platform: 'windows',
});
