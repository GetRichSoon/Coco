// The Dock's only bridge to Coco: pinned apps and open windows in; open, focus, previews, Start and the menu out (no Node in the page).
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('cocoDock', {
  onApps: (f) => ipcRenderer.on('dock-apps', (_e, d) => f(d)),
  onWins: (f) => ipcRenderer.on('dock-wins', (_e, d) => f(d)),
  rects: (r) => ipcRenderer.send('dock-rects', r),
  preview: (hwnds) => ipcRenderer.invoke('dock-preview', hwnds.map(Number)),
  focusWin: (hwnd) => ipcRenderer.send('dock-focuswin', Number(hwnd)),
  launch: (lnk) => ipcRenderer.send('dock-launch', String(lnk)),
  start: () => ipcRenderer.send('dock-start'),
  coco: () => ipcRenderer.send('dock-coco'),
  menu: () => ipcRenderer.send('dock-menu'),
  appMenu: (a) => ipcRenderer.send('dock-appmenu', { lnk: String(a.lnk || ''), exe: String(a.exe || ''), hwnds: (a.hwnds || []).map(Number) }),
  add: () => ipcRenderer.send('dock-add'),
});
