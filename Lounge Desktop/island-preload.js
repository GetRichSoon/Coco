// The island's only bridge to Coco: data in, a fixed list of actions out (no Node in the page).
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('cocoIsland', {
  onData: (f) => ipcRenderer.on('island-data', (_e, d) => f(d)),
  onMedia: (f) => ipcRenderer.on('island-media', (_e, d) => f(d)),
  onModules: (f) => ipcRenderer.on('island-modules', (_e, d) => f(d)),
  onSys: (f) => ipcRenderer.on('island-sys', (_e, d) => f(d)),
  onHover: (f) => ipcRenderer.on('island-hover', (_e, v) => f(!!v)),
  rect: (r) => ipcRenderer.send('island-rect', { w: Number(r.w) || 0, h: Number(r.h) || 0 }),
  close: () => ipcRenderer.send('island-close'),
  blur: () => ipcRenderer.send('island-blur'),
  openCoco: (page) => ipcRenderer.send('island-open', String(page)),
  openSettings: (uri) => ipcRenderer.send('island-settings', String(uri)),
  act: (action, args) => ipcRenderer.invoke('island-act', { action, args }),
});
