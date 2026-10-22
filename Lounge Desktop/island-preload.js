// The island's only bridge to Coco: data in, a fixed list of actions out (no Node in the page).
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('cocoIsland', {
  onData: (f) => ipcRenderer.on('island-data', (_e, d) => f(d)),
  onMedia: (f) => ipcRenderer.on('island-media', (_e, d) => f(d)),
  onModules: (f) => ipcRenderer.on('island-modules', (_e, d) => f(d)),
  mouse: (inside) => ipcRenderer.send('island-mouse', !!inside),
  blur: () => ipcRenderer.send('island-blur'),
  openCoco: (page) => ipcRenderer.send('island-open', String(page)),
  openSettings: (uri) => ipcRenderer.send('island-settings', String(uri)),
  act: (action, args) => ipcRenderer.invoke('island-act', { action, args }),
});
