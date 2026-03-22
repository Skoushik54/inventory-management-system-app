'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    pickExcelFile: () => ipcRenderer.invoke('pick-excel-file'),
    printReceipt: () => ipcRenderer.send('print-receipt'),
    quitApp: () => ipcRenderer.send('app-quit'),
    saveReceiptPdf: (htmlContent, filename, type) => ipcRenderer.invoke('save-receipt-pdf', htmlContent, filename, type),
    exportBackup: () => ipcRenderer.invoke('export-backup'),
    importBackup: () => ipcRenderer.invoke('import-backup'),
    forceFocus: () => ipcRenderer.send('app-focus'),
    printDocument: (html, silent) => ipcRenderer.send('print-document', html, silent),
});
