////////////////////////////////////////////////////////
//
// Прелоад окна заезда: флаг десктопа без Node API.
//
////////////////////////////////////////////////////////

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rnrDesktop', {
  isDesktop: true,
  quit() {
    return ipcRenderer.invoke('game:quit');
  }
});
