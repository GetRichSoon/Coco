// The Dock's only bridge to Coco: the pinned apps and open programs in, launch/focus/Start out (no Node in the page).
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('cocoDock', {
  onApps: (f) => ipcRenderer.on('dock-apps', (_e, d) => f(d)),
  onProcs: (f) => ipcRenderer.on('dock-procs', (_e, d) => f(d)),
  size: (w) => ipcRenderer.send('dock-size', Number(w) || 0),
  launch: (lnk, proc) => ipcRenderer.send('dock-launch', { lnk: String(lnk), proc: String(proc || '') }),
  start: () => ipcRenderer.send('dock-start'),
});
