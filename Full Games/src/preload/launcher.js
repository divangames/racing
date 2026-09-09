////////////////////////////////////////////////////////
//
// Мост лаунчера: только белый список IPC.
//
////////////////////////////////////////////////////////

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rnrLauncher', {
  status() {
    return ipcRenderer.invoke('launcher:status');
  },
  verify(full) {
    return ipcRenderer.invoke('launcher:verify', { full: Boolean(full) });
  },
  play() {
    return ipcRenderer.invoke('launcher:play');
  },
  lab() {
    return ipcRenderer.invoke('launcher:lab');
  },
  setFullscreen(value) {
    return ipcRenderer.invoke('launcher:set-fullscreen', value);
  },
  sync() {
    return ipcRenderer.invoke('launcher:sync');
  },
  selfUpdate() {
    return ipcRenderer.invoke('launcher:self-update');
  },
  quit() {
    return ipcRenderer.invoke('launcher:quit');
  },
  onVerifyProgress(fn) {
    const listen = (_event, info) => fn(info);
    ipcRenderer.on('launcher:verify-progress', listen);
    return () => ipcRenderer.removeListener('launcher:verify-progress', listen);
  },
  onSyncProgress(fn) {
    const listen = (_event, info) => fn(info);
    ipcRenderer.on('launcher:sync-progress', listen);
    return () => ipcRenderer.removeListener('launcher:sync-progress', listen);
  },
  onSelfProgress(fn) {
    const listen = (_event, info) => fn(info);
    ipcRenderer.on('launcher:self-progress', listen);
    return () => ipcRenderer.removeListener('launcher:self-progress', listen);
  }
});
