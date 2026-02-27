'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    pickExcelFile: () => ipcRenderer.invoke('pick-excel-file'),
});
