// Gives the Lounge screens one safe desktop ability: saving the cloud rules for Claude sessions on this PC.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('cocoDesktop', {
  saveRules: (text) => ipcRenderer.send('save-rules', String(text)),
  getStartup: () => ipcRenderer.invoke('get-startup'),
  setStartup: (on) => ipcRenderer.invoke('set-startup', !!on),
  pcCommand: (action, args) => ipcRenderer.invoke('pc-command', { action, args }),
  liveSnapshot: () => ipcRenderer.invoke('live-snapshot'),
  islandPush: (d) => ipcRenderer.send('island-push', d),
  onApprove: (f) => ipcRenderer.on('island-approve', (_e, d) => f(d)),
  getIsland: () => ipcRenderer.invoke('island-enabled-get'),
  setIsland: (on) => ipcRenderer.invoke('island-enabled-set', !!on),
  onIsland: (f) => ipcRenderer.on('island-enabled', (_e, v) => f(!!v)),
  beat: () => ipcRenderer.send('lounge-beat'),
  needSignIn: (which) => ipcRenderer.send('lounge-need', String(which)),
  transcribe: (bytes, mime) => ipcRenderer.invoke('transcribe', { bytes, mime }),
  atOffice: () => ipcRenderer.sendSync('at-office'),
  platform: 'windows',
});
