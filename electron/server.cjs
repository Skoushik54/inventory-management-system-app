'use strict';
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const XLSX = require('xlsx');

// All storage vars are initialized lazily inside startServer()
// so they are only resolved AFTER Electron app.whenReady() fires.
let USER_DATA, DB_PATH, IMG_DIR, db, upload;

function initPaths() {
    try {
        const { app: electronApp } = require('electron');
        USER_DATA = electronApp.getPath('userData');
    } catch {
        // Fallback when running outside Electron (e.g. tests)
        USER_DATA = path.join(require('os').homedir(), 'GreyhoundsInventory');
    }
    DB_PATH = path.join(USER_DATA, 'inventory.db');
    IMG_DIR = path.join(USER_DATA, 'images');
    if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });
}

function initDb() {
    const Database = require('better-sqlite3');
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        barcode TEXT NOT NULL UNIQUE,
        totalQuantity INTEGER DEFAULT 0,
        availableQuantity INTEGER DEFAULT 0,
        imageUrl TEXT,
        status TEXT DEFAULT 'ACTIVE',
        orderIndex INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS officers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        badgeNumber TEXT NOT NULL UNIQUE,
        name TEXT, department TEXT, phone TEXT, others TEXT, imageUrl TEXT
      );
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        productId INTEGER, officerId INTEGER,
        quantity INTEGER, returnedQuantity INTEGER DEFAULT 0,
        purpose TEXT, status TEXT DEFAULT 'ISSUED',
        issuedAt TEXT DEFAULT (datetime('now','localtime')),
        returnedAt TEXT
      );
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'ADMIN'
      );
      INSERT OR IGNORE INTO users (username, password, role) VALUES ('admin', 'admin123', 'ADMIN');
    `);
}

function initUpload() {
    const multer = require('multer');
    const storage = multer.diskStorage({
        destination: (req, file, cb) => cb(null, IMG_DIR),
        filename: (req, file, cb) => cb(null, Date.now() + '_' + file.originalname),
    });
    upload = multer({ storage });
}

// ── Excel helpers ─────────────────────────────────────────────────────────────
function getExcelPath() {
    const row = db.prepare("SELECT value FROM settings WHERE key='excelPath'").get();
    return row ? row.value : null;
}
function setExcelPath(p) {
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('excelPath', ?)").run(p);
}

function syncFromExcel(filePath) {
    if (!fs.existsSync(filePath)) throw new Error('Excel file not found at: ' + filePath);
    const wb = XLSX.readFile(filePath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    // Detect columns or use defaults
    let colName = 2; // Default column for names
    let colTotal = 8;
    let colAvail = 7;
    let startRow = 2;

    const seen = new Map();
    let idx = 0;

    for (let i = startRow; i < rows.length; i++) {
        const row = rows[i];

        // Product name is usually in col 2, but fallback to col 1 (handles bottom items)
        const sn = String(row[0] ?? '').trim();
        let name = String(row[2] ?? '').trim();
        if (!name) name = String(row[1] ?? '').trim();

        // Skip if basically empty or a header
        if (!name || name.length < 3 || /^\d+$/.test(name)) continue;
        if (!sn || isNaN(parseInt(sn))) continue;

        // Skip actual transaction sentences and metadata
        const upper = name.toUpperCase();
        if (upper.includes('EQUIPMENT TRANSACTION') ||
            upper.includes('HANDOVER') ||
            upper.includes('SENT TO') ||
            upper.includes('RETURNED TO') ||
            upper.includes('RECEIVED FROM')) continue;

        const parseNum = (v) => {
            if (!v) return 0;
            const match = String(v).match(/\d+/);
            return match ? parseInt(match[0]) : 0;
        };

        const total = parseNum(row[colTotal] || row[8]);
        const availValue = row[colAvail] || row[7];
        const avail = availValue ? parseNum(availValue) : total;

        const finalName = name;

        // Barcode generation
        let barcode = String(row[1] ?? '').trim();
        // If col 1 was the name, or is empty, generate barcode
        if (!barcode || barcode === name.trim() || barcode.match(/^\d+$/)) {
            barcode = finalName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '-');
            if (sn) barcode += '-' + sn; // Ensure uniqueness
        }

        if (!seen.has(barcode)) {
            seen.set(barcode, { name: finalName, barcode, total, avail, idx: idx++ });
        }
    }

    // Refresh the products table
    db.transaction(() => {
        db.prepare('DELETE FROM products').run();
        const insert = db.prepare(`
            INSERT INTO products (name, barcode, totalQuantity, availableQuantity, status, orderIndex)
            VALUES (@name, @barcode, @total, @avail, 'ACTIVE', @idx)
        `);
        for (const [, item] of seen) insert.run(item);
    })();

    return seen.size;
}

// ── Token auth ────────────────────────────────────────────────────────────────
const TOKENS = new Set();
function auth(req, res, next) {
    const header = req.headers['authorization'] || '';
    if (!header.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    if (!TOKENS.has(header.slice(7))) return res.status(401).json({ error: 'Invalid token' });
    next();
}

// ── Express ───────────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// ── Auth ──────────────────────────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE username=? AND password=?').get(req.body.username, req.body.password);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const token = Math.random().toString(36).slice(2) + Date.now();
    TOKENS.add(token);
    res.json({ token, role: user.role });
});

// ── Products ──────────────────────────────────────────────────────────────────
app.get('/api/inventory/products', auth, (req, res) =>
    res.json(db.prepare('SELECT * FROM products ORDER BY orderIndex ASC').all()));

app.post('/api/inventory/products', auth, (req, res) => {
    const { name, barcode, totalQuantity, availableQuantity, imageUrl, status } = req.body;
    try {
        const r = db.prepare('INSERT INTO products (name,barcode,totalQuantity,availableQuantity,imageUrl,status) VALUES (?,?,?,?,?,?)').run(name, barcode, totalQuantity || 0, availableQuantity || 0, imageUrl || null, status || 'ACTIVE');
        res.json(db.prepare('SELECT * FROM products WHERE id=?').get(r.lastInsertRowid));
    } catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/inventory/products/:id', auth, (req, res) => {
    const { name, barcode, totalQuantity, availableQuantity, imageUrl, status } = req.body;
    db.prepare('UPDATE products SET name=?,barcode=?,totalQuantity=?,availableQuantity=?,imageUrl=?,status=? WHERE id=?').run(name, barcode, totalQuantity, availableQuantity, imageUrl, status, req.params.id);
    res.json(db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id));
});

app.delete('/api/inventory/products/:id', auth, (req, res) => {
    db.prepare('DELETE FROM products WHERE id=?').run(req.params.id);
    res.json({ success: true });
});

// ── Excel ─────────────────────────────────────────────────────────────────────
app.post('/api/inventory/sync', auth, (req, res) => {
    const p = getExcelPath();
    if (!p) return res.status(400).json({ error: 'No Excel path configured' });
    try { res.json({ message: `Successfully synced ${syncFromExcel(p)} products` }); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/inventory/set-excel-path', auth, (req, res) => {
    const { path: p } = req.body;
    if (!p || !fs.existsSync(p)) return res.status(400).json({ error: 'File not found at: ' + p });
    setExcelPath(p);
    res.json({ message: 'Excel path saved' });
});

app.get('/api/inventory/open-local', (req, res) => {
    const p = getExcelPath();
    if (!p || !fs.existsSync(p)) return res.status(404).json({ error: 'Excel file not configured' });
    const cmd = process.platform === 'win32' ? `start "" "${p}"` : `open "${p}"`;
    exec(cmd, err => err ? res.status(500).json({ error: err.message }) : res.json({ message: 'Opening...' }));
});

app.get('/api/inventory/export', (req, res) => {
    try {
        const products = db.prepare('SELECT * FROM products ORDER BY orderIndex ASC').all();
        const wb = XLSX.utils.book_new();

        // Build rows: title rows + header + data
        const rows = [
            ['Greyhounds', '', '', '', ''],
            ['Telangana', '', '', '', ''],
            ['', '', '', '', ''],
            ['Name of the Equipment', 'QR Data', 'Total Stock', 'On Hand (Present Stock)', 'Status'],
            ...products.map(p => [p.name, p.barcode, p.totalQuantity, p.availableQuantity, p.status]),
        ];

        const ws = XLSX.utils.aoa_to_sheet(rows);

        // Merge title rows across columns A-E
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
        ];

        // Set column widths
        ws['!cols'] = [{ wch: 35 }, { wch: 20 }, { wch: 12 }, { wch: 22 }, { wch: 10 }];

        XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="inventory_export.xlsx"');
        res.send(buf);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── Transactions ──────────────────────────────────────────────────────────────
const TX = `SELECT t.*,
    p.id as p_id, p.name as p_name, p.barcode as p_barcode, p.totalQuantity as p_total, p.availableQuantity as p_avail, p.imageUrl as p_img,
    o.id as o_id, o.badgeNumber as o_badge, o.name as o_name, o.department as o_dept, o.phone as o_phone
    FROM transactions t JOIN products p ON t.productId=p.id JOIN officers o ON t.officerId=o.id`;

function fmt(t) {
    return {
        id: t.id, quantity: t.quantity, returnedQuantity: t.returnedQuantity,
        purpose: t.purpose, status: t.status, issuedAt: t.issuedAt, returnedAt: t.returnedAt,
        product: { id: t.p_id, name: t.p_name, barcode: t.p_barcode, totalQuantity: t.p_total, availableQuantity: t.p_avail, imageUrl: t.p_img },
        officer: { id: t.o_id, badgeNumber: t.o_badge, name: t.o_name, department: t.o_dept, phone: t.o_phone },
    };
}

app.get('/api/transactions/pending', auth, (req, res) =>
    res.json(db.prepare(TX + " WHERE t.status != 'RETURNED' ORDER BY t.issuedAt DESC").all().map(fmt)));

app.get('/api/transactions/all', auth, (req, res) =>
    res.json(db.prepare(TX + ' ORDER BY t.issuedAt DESC').all().map(fmt)));

app.post('/api/transactions/issue', auth, (req, res) => {
    const { barcode, badgeNumber, name, department, phone, others, quantity, purpose } = req.body;
    const product = db.prepare('SELECT * FROM products WHERE barcode=?').get(barcode);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (product.availableQuantity < quantity) return res.status(400).json({ error: 'Insufficient stock' });

    db.prepare(`INSERT INTO officers (badgeNumber,name,department,phone,others) VALUES (?,?,?,?,?)
        ON CONFLICT(badgeNumber) DO UPDATE SET name=excluded.name,department=excluded.department,phone=excluded.phone,others=excluded.others`
    ).run(badgeNumber, name || '', department || '', phone || '', others || '');
    const officer = db.prepare('SELECT * FROM officers WHERE badgeNumber=?').get(badgeNumber);

    db.prepare('UPDATE products SET availableQuantity=? WHERE id=?').run(product.availableQuantity - quantity, product.id);
    const r = db.prepare("INSERT INTO transactions (productId,officerId,quantity,purpose,status) VALUES (?,?,?,?,'ISSUED')").run(product.id, officer.id, quantity, purpose || '');
    res.json(fmt(db.prepare(TX + ' WHERE t.id=?').get(r.lastInsertRowid)));
});

app.post('/api/transactions/return/:id', auth, (req, res) => {
    const qty = parseInt(req.query.quantity);
    const t = db.prepare('SELECT * FROM transactions WHERE id=?').get(req.params.id);
    if (!t) return res.status(404).json({ error: 'Transaction not found' });
    if (t.status === 'RETURNED') return res.status(400).json({ error: 'Already fully returned' });

    const remaining = t.quantity - t.returnedQuantity;
    if (qty > remaining) return res.status(400).json({ error: `Return qty exceeds remaining (${remaining})` });

    const product = db.prepare('SELECT * FROM products WHERE id=?').get(t.productId);
    const newRet = t.returnedQuantity + qty;
    const newStatus = newRet >= t.quantity ? 'RETURNED' : 'PARTIALLY_RETURNED';
    db.prepare('UPDATE products SET availableQuantity=availableQuantity+? WHERE id=?').run(qty, t.productId);
    db.prepare('UPDATE transactions SET returnedQuantity=?, status=?, returnedAt=CURRENT_TIMESTAMP WHERE id=?').run(newRet, newStatus, req.params.id);
    res.json({ success: true, status: newStatus });
});

app.delete('/api/transactions/clear-all', auth, (req, res) => {
    try {
        db.prepare('DELETE FROM transactions').run();
        res.json({ success: true, message: 'Transaction history cleared' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── Officers ──────────────────────────────────────────────────────────────────
app.get('/api/officers', auth, (req, res) =>
    res.json(db.prepare('SELECT * FROM officers').all()));

app.post('/api/officers', auth, (req, res) => {
    const { badgeNumber, name, department, phone, others, imageUrl } = req.body;
    try {
        const r = db.prepare('INSERT INTO officers (badgeNumber,name,department,phone,others,imageUrl) VALUES (?,?,?,?,?,?)').run(badgeNumber, name, department, phone, others, imageUrl);
        res.json(db.prepare('SELECT * FROM officers WHERE id=?').get(r.lastInsertRowid));
    } catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/officers/:id', auth, (req, res) => {
    const { badgeNumber, name, department, phone, others, imageUrl } = req.body;
    db.prepare('UPDATE officers SET badgeNumber=?,name=?,department=?,phone=?,others=?,imageUrl=? WHERE id=?').run(badgeNumber, name, department, phone, others, imageUrl, req.params.id);
    res.json(db.prepare('SELECT * FROM officers WHERE id=?').get(req.params.id));
});

app.delete('/api/officers/:id', auth, (req, res) => {
    db.prepare('DELETE FROM officers WHERE id=?').run(req.params.id);
    res.json({ success: true });
});

// ── File Upload ───────────────────────────────────────────────────────────────
app.post('/api/files/upload', auth, (req, res) => {
    upload.single('file')(req, res, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        res.json({ url: `http://localhost:9876/uploads/${req.file.filename}` });
    });
});

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = 9876;
let serverInstance = null;

async function startServer() {
    initPaths();
    initDb();
    initUpload();
    app.use('/uploads', express.static(IMG_DIR));

    return new Promise(resolve => {
        serverInstance = app.listen(PORT, '127.0.0.1', () => {
            console.log(`[Server] http://localhost:${PORT}  |  DB: ${DB_PATH}`);
            resolve(PORT);
        });

        serverInstance.on('error', (e) => {
            if (e.code === 'EADDRINUSE') {
                console.log(`[Server] Port ${PORT} already in use. Assuming another instance is running.`);
                resolve(PORT);
            } else {
                throw e;
            }
        });
    });
}

function stopServer() {
    if (serverInstance) {
        serverInstance.close();
    }
}

module.exports = { startServer, stopServer, getExcelPath, setExcelPath };
