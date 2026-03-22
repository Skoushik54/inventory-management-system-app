'use strict';
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');

app.name = 'Greyhounds Telangana';

// Prevent multiple instances of the app from running simultaneously
const gotTheLock = app.requestSingleInstanceLock();

const fs = require('fs');
const os = require('os');
// Portable Mode: Prioritize GreyhoundsInventory in the same folder as the app/exe
const BASE_DIR = fs.existsSync(path.join(process.cwd(), 'GreyhoundsInventory')) 
    ? path.join(process.cwd(), 'GreyhoundsInventory')
    : path.join(process.cwd(), 'GreyhoundsInventory'); // Force creation here for "In the zip" request

const HISTORY_DIR = path.join(BASE_DIR, 'transaction_history');

function ensureDirectories() {
    [BASE_DIR, HISTORY_DIR, path.join(HISTORY_DIR, 'issue'), path.join(HISTORY_DIR, 'return'), path.join(HISTORY_DIR, 'damaged'), path.join(BASE_DIR, 'images')].forEach(dir => {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });
}

if (!gotTheLock) {
    app.quit();
    process.exit(0); 
} else {
    ensureDirectories();
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
            plugins: true // Enable plugins for PDF/Print preview
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
                    silent: false,
                    printBackground: true,
                    deviceName: ''
                }, (success, failureReason) => {
                    if (!success) console.log(failureReason);
                    console.log('Print Finished');
                });
            }
        });

        ipcMain.on('print-document', async (event, htmlContent) => {
            const printWin = new BrowserWindow({
                show: false,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true
                }
            });
            const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent);
            await printWin.loadURL(dataUrl);
            
            // Give extra time for rendering QR codes/Ledger fonts
            await new Promise(r => setTimeout(r, 800));
            
            try {
                const printers = printWin.webContents.getPrinters();
                const defaultPrinter = printers.find(p => p.isDefault);
                
                // If the default printer is a "real" printer, use it. 
                // Otherwise, try to find any printer that doesn't say "PDF" or "Fax".
                const targetPrinter = (defaultPrinter && !defaultPrinter.name.toLowerCase().includes('pdf')) 
                    ? defaultPrinter 
                    : printers.find(p => 
                        !p.name.toLowerCase().includes('pdf') && 
                        !p.name.toLowerCase().includes('onenote') &&
                        !p.name.toLowerCase().includes('fax') &&
                        !p.name.toLowerCase().includes('document writer')
                    );

                if (targetPrinter) {
                    // Physical printer found! Print instantly and silently.
                    printWin.webContents.print({
                        silent: true,
                        deviceName: targetPrinter.name,
                        printBackground: true
                    }, (success, failureReason) => {
                        if (!success) {
                            console.error('Hardware print failed:', failureReason);
                            // Fallback to manual dialog if silent failed
                            printWin.webContents.print({ silent: false, printBackground: true });
                        }
                        setTimeout(() => printWin.destroy(), 1000);
                    });
                } else {
                    // No physical printer detected, show the dialog so user can choose.
                    printWin.webContents.print({ silent: false, printBackground: true });
                    setTimeout(() => printWin.destroy(), 1000);
                }
            } catch (err) {
                console.error('Print processor error:', err);
                printWin.destroy();
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

        ipcMain.on('app-quit', () => {
            app.quit();
        });

        // ── Auto-save receipts as PDF to GreyhoundsInventory/Invoices/ ──────────
        ipcMain.handle('save-receipt-pdf', async (event, htmlContent, filename, type) => {
            try {
                const os = require('os');
                const fs = require('fs');
                const path = require('path');

                ensureDirectories();
                const base = BASE_DIR;

                const subfolder = type === 'return' ? 'return' : 'issue';
                const targetDir = path.join(base, 'transaction_history', subfolder);

                const safeFilename = filename.replace(/[<>:"/\\|?*]/g, '-');
                const filePath = path.join(targetDir, safeFilename);

                const hidden = new BrowserWindow({
                    show: false,
                    width: 794,
                    height: 1123,
                    webPreferences: { nodeIntegration: false, contextIsolation: true }
                });

                const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent);
                await hidden.loadURL(dataUrl);
                await new Promise(r => setTimeout(r, 800));

                const pdfBuffer = await hidden.webContents.printToPDF({
                    printBackground: true,
                    pageSize: 'A4',
                    landscape: false,
                    margins: { marginType: 'custom', top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 }
                });

                hidden.destroy();
                fs.writeFileSync(filePath, pdfBuffer);
                
                // Show a small notification so user knows where it went
                const { shell, dialog } = require('electron');
                // We do this quietly if it's the auto-save, but since user complained, maybe show a box?
                // Actually, let's just make sure it's saved.
                
                return { success: true, path: filePath, folder: subfolder };
            } catch (err) {
                console.error('Failed to save PDF receipt:', err);
                return { success: false, error: err.message };
            }
        });

        // ── Backup & Restore (Data Portability) ──────────────────────────────────
        ipcMain.handle('export-backup', async () => {
            const fs = require('fs');
            const os = require('os');
            const { getDbPath } = require('./server.cjs');
            const dbPath = getDbPath();

            if (!fs.existsSync(dbPath)) return { success: false, error: 'Database not found' };

            const result = await dialog.showSaveDialog(mainWindow, {
                title: 'Export Inventory Data',
                defaultPath: path.join(os.userInfo().homedir, 'Desktop', `Inventory_Backup_${new Date().toISOString().split('T')[0]}.db`),
                filters: [{ name: 'Inventory Data', extensions: ['db'] }]
            });

            if (result.filePath) {
                try {
                    fs.copyFileSync(dbPath, result.filePath);
                    return { success: true, path: result.filePath };
                } catch (err) {
                    return { success: false, error: err.message };
                }
            }
            return { success: false, cancelled: true };
        });

        ipcMain.on('app-focus', () => {
            if (mainWindow) {
                mainWindow.focus();
                mainWindow.show();
            }
        });

        ipcMain.handle('import-backup', async () => {
            const fs = require('fs');
            const { getDbPath, stopServer } = require('./server.cjs');
            const dbPath = getDbPath();

            const result = await dialog.showOpenDialog(mainWindow, {
                title: 'Import Inventory Data (This will overwrite current data)',
                filters: [{ name: 'Inventory Data', extensions: ['db'] }],
                properties: ['openFile']
            });

            if (result.filePaths.length > 0) {
                const source = result.filePaths[0];
                try {
                    // Close DB connections
                    stopServer();
                    
                    // Small delay to ensure handles are released
                    await new Promise(r => setTimeout(r, 500));
                    
                    fs.copyFileSync(source, dbPath);
                    
                    // Relaunch the app to reload with new DB
                    app.relaunch();
                    app.exit(0);
                    return { success: true };
                } catch (err) {
                    return { success: false, error: err.message };
                }
            }
            return { success: false, cancelled: true };
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
