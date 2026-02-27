'use strict';
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');

app.name = 'Greyhounds Telangana';

// Prevent multiple instances of the app from running simultaneously
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
    process.exit(0); // Force exit to prevent further initialization
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // If user tries to open a second instance, focus the main window
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();

            // Show a friendly message instead of a crash error
            dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'App Already Running',
                message: 'Greyhounds Telangana is already open. We have brought it to the front for you.',
                buttons: ['OK']
            });
        }
    });
}

let mainWindow;
let server;

async function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        title: 'Greyhounds Telangana',
        icon: path.join(__dirname, 'gt_logo.ico'),
        backgroundColor: '#1a1c2e',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.cjs'),
        },
        autoHideMenuBar: true,
        show: false, // Don't show until ready
    });

    // Load the built React app
    try {
        if (!app.isPackaged && process.env.NODE_ENV === 'development') {
            await mainWindow.loadURL('http://localhost:3000');
        } else {
            const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
            await mainWindow.loadFile(indexPath);
        }
    } catch (e) {
        console.error('Failed to load index.html:', e);
    }

    // Show the window immediately with a dark background to feel responsive
    mainWindow.maximize();
    mainWindow.show();

    mainWindow.on('page-title-updated', (e) => {
        e.preventDefault();
        mainWindow.setTitle('Greyhounds Telangana');
    });
}

app.whenReady().then(async () => {
    try {
        // Start the local Express+SQLite server first
        const { startServer } = require('./server.cjs');
        await startServer();

        await createWindow();

        ipcMain.on('print-receipt', (event) => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) {
                win.webContents.print({
                    silent: false, // Set to true for direct printing without a dialog
                    printBackground: true,
                    deviceName: ''
                }, (success, failureReason) => {
                    if (!success) console.log(failureReason);
                    console.log('Print Finished');
                });
            }
        });

        ipcMain.handle('pick-excel-file', async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
                title: 'Select your Excel Inventory File',
                filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }],
                properties: ['openFile'],
            });
            return result.filePaths.length > 0 ? result.filePaths[0] : null;
        });

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) createWindow();
        });
    } catch (err) {
        console.error('[Electron Main] Fatal startup error:', err);
        const { dialog: d } = require('electron');
        d.showErrorBox('Startup Error', String(err));
        app.quit();
    }
}).catch(err => {
    console.error('[Electron Main] app.whenReady() rejected:', err);
});

app.on('window-all-closed', () => {
    try {
        const { stopServer } = require('./server.cjs');
        stopServer();
    } catch (e) { }
    if (process.platform !== 'darwin') app.quit();
});
