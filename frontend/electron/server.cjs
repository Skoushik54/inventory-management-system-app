'use strict';
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const XLSX = require('xlsx');

// All storage vars are initialized lazily inside startServer()
// so they are only resolved AFTER Electron app.whenReady() fires.
let USER_DATA, DB_PATH, IMG_DIR, INV_DIR, DAMAGED_DIR, PERSONS_DIR, db, upload;

function initPaths() {
    // Priority 1: Check if a folder named 'GreyhoundsInventory' exists right next to the app/executable
    // Priority 2: Check if it exists in the User's Home folder (fallback for previous versions)
    // Priority 3: Default Electron AppData

    const possiblePaths = [
        path.join(process.cwd(), 'GreyhoundsInventory'), // Dev/Default
        path.join(process.cwd(), '..', 'GreyhoundsInventory'), // Portable: next to App folder
        path.join(require('os').homedir(), 'GreyhoundsInventory') // Fallback
    ];

    // Use the first path (Portable) by default for new installations, or where inventory.db already exists
    USER_DATA = possiblePaths.find(p => fs.existsSync(path.join(p, 'inventory.db'))) || possiblePaths[0];

    const HISTORY_DIR = path.join(USER_DATA, 'transaction_history');
    DB_PATH = path.join(USER_DATA, 'inventory.db');
    IMG_DIR = path.join(USER_DATA, 'images');
    PERSONS_DIR = path.join(HISTORY_DIR, 'persons');
    DAMAGED_DIR = path.join(HISTORY_DIR, 'damaged');

    if (!fs.existsSync(USER_DATA)) fs.mkdirSync(USER_DATA, { recursive: true });
    if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });
    if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR, { recursive: true });
    if (!fs.existsSync(path.join(HISTORY_DIR, 'issue'))) fs.mkdirSync(path.join(HISTORY_DIR, 'issue'), { recursive: true });
    if (!fs.existsSync(path.join(HISTORY_DIR, 'return'))) fs.mkdirSync(path.join(HISTORY_DIR, 'return'), { recursive: true });
    if (!fs.existsSync(PERSONS_DIR)) fs.mkdirSync(PERSONS_DIR, { recursive: true });
    if (!fs.existsSync(DAMAGED_DIR)) fs.mkdirSync(DAMAGED_DIR, { recursive: true });
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
      CREATE TABLE IF NOT EXISTS product_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        productId INTEGER,
        barcode TEXT UNIQUE,
        serialNumber TEXT,
        status TEXT DEFAULT 'AVAILABLE',
        lastOfficerName TEXT,
        lastOfficerBadgeNumber TEXT,
        FOREIGN KEY(productId) REFERENCES products(id)
      );
      CREATE TABLE IF NOT EXISTS spare_parts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        productId INTEGER,
        name TEXT,
        FOREIGN KEY(productId) REFERENCES products(id)
      );
      CREATE TABLE IF NOT EXISTS officers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        badgeNumber TEXT NOT NULL UNIQUE,
        name TEXT, department TEXT, phone TEXT, others TEXT, imageUrl TEXT
      );
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        productItemId INTEGER, officerId INTEGER,
        batchId TEXT,
        issuerName TEXT,
        extraAccessories TEXT,
        quantity INTEGER DEFAULT 1, returnedQuantity INTEGER DEFAULT 0,
        purpose TEXT, status TEXT DEFAULT 'ISSUED',
        issuedAt TEXT DEFAULT (datetime('now','localtime')),
        returnedAt TEXT,
        personPhotoUrl TEXT,
        returnPersonPhotoUrl TEXT,
        isDamaged INTEGER DEFAULT 0,
        missingSpares TEXT,
        damagePhotoUrl TEXT,
        FOREIGN KEY(productItemId) REFERENCES product_items(id),
        FOREIGN KEY(officerId) REFERENCES officers(id)
      );
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'ADMIN'
      );
      INSERT OR IGNORE INTO users (username, password, role) VALUES ('admin', 'admin123', 'ADMIN');
      
      CREATE INDEX IF NOT EXISTS idx_product_items_productId ON product_items(productId);
      
      -- Strictly Excel-driven or manual
      CREATE INDEX IF NOT EXISTS idx_spare_parts_productId ON spare_parts(productId);
    `);

    // Migration for existing DBs
    try { db.prepare("ALTER TABLE product_items ADD COLUMN serialNumber TEXT").run(); } catch (e) { }
    try { db.prepare("ALTER TABLE product_items ADD COLUMN lastOfficerBadgeNumber TEXT").run(); } catch (e) { }
    try { db.prepare("ALTER TABLE transactions ADD COLUMN productItemId INTEGER").run(); } catch (e) { }
    try { db.prepare("ALTER TABLE transactions ADD COLUMN officerId INTEGER").run(); } catch (e) { }
    try { db.prepare("ALTER TABLE transactions ADD COLUMN batchId TEXT").run(); } catch (e) { }
    try { db.prepare("ALTER TABLE transactions ADD COLUMN issuerName TEXT").run(); } catch (e) { }
    try { db.prepare("ALTER TABLE transactions ADD COLUMN extraAccessories TEXT").run(); } catch (e) { }
    try { db.prepare("ALTER TABLE transactions ADD COLUMN purpose TEXT").run(); } catch (e) { }
    try { db.prepare("ALTER TABLE transactions ADD COLUMN personPhotoUrl TEXT").run(); } catch (e) { }
    try { db.prepare("ALTER TABLE transactions ADD COLUMN returnPersonPhotoUrl TEXT").run(); } catch (e) { }
    try { db.prepare("ALTER TABLE transactions ADD COLUMN isDamaged INTEGER DEFAULT 0").run(); } catch (e) { }
    try { db.prepare("ALTER TABLE transactions ADD COLUMN missingSpares TEXT").run(); } catch (e) { }
    try { db.prepare("ALTER TABLE transactions ADD COLUMN damagePhotoUrl TEXT").run(); } catch (e) { }
    try { db.prepare("ALTER TABLE products ADD COLUMN excelPath TEXT").run(); } catch (e) { }

    // Performance Indexes for transactions (Must be created after migrations)
    try { db.prepare("CREATE INDEX IF NOT EXISTS idx_transactions_productItemId ON transactions(productItemId)").run(); } catch (e) { }
    try { db.prepare("CREATE INDEX IF NOT EXISTS idx_transactions_batchId ON transactions(batchId)").run(); } catch (e) { }
    try { db.prepare("CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status)").run(); } catch (e) { }
    try { db.prepare("CREATE INDEX IF NOT EXISTS idx_transactions_officerId ON transactions(officerId)").run(); } catch (e) { }

    // DATA MIGRATION: Permanent resolution for stuck items
    try {
        db.transaction(() => {
            // 1. Force all old 'PARTIALLY_RETURNED' items to AVAILABLE
            db.prepare("UPDATE product_items SET status = 'AVAILABLE' WHERE status = 'PARTIALLY_RETURNED'").run();

            // 1a. One-time clean of old samples that keep reappearing
            db.prepare("DELETE FROM products WHERE barcode IN ('TV001', 'PB505', 'RS999') AND status = 'ACTIVE'").run();

            // 2. Force all transactions to 'RETURNED' if they were 'PARTIALLY_RETURNED'
            db.prepare("UPDATE transactions SET status = 'RETURNED' WHERE status = 'PARTIALLY_RETURNED'").run();

            // 3. Global sanity check: Recalculate availableQuantity for ALL products
            const allProducts = db.prepare("SELECT id FROM products").all();
            for (const p of allProducts) {
                const total = db.prepare('SELECT COUNT(*) as count FROM product_items WHERE productId=?').get(p.id).count;
                const avail = db.prepare("SELECT COUNT(*) as count FROM product_items WHERE productId=? AND status='AVAILABLE'").get(p.id).count;
                db.prepare('UPDATE products SET totalQuantity=?, availableQuantity=? WHERE id=?').run(total, avail, p.id);
            }
        })();
        console.log('✅ Inventory database synchronized successfully.');
    } catch (e) {
        console.error('❌ Sync migration failed:', e);
    }
}

function initUpload() {
    const multer = require('multer');
    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            let dest = IMG_DIR;
            if (req.query.type === 'damaged') dest = DAMAGED_DIR;
            else if (req.query.type === 'person') dest = PERSONS_DIR;
            cb(null, dest);
        },
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

    // ── Dynamic header detection ─────────────────────────────────────────────
    let colName = -1, colTotal = -1, colSNo = -1;
    let startRow = -1;

    for (let i = 0; i < Math.min(25, rows.length); i++) {
        const row = rows[i];
        if (!row || row.length < 2) continue;
        for (let j = 0; j < row.length; j++) {
            const val = String(row[j] || '').toLowerCase().trim();
            // Name column: contains 'name' or 'equipment' but NOT 's.no'
            if ((val.includes('name') || val.includes('equipment')) && !val.includes('s.no') && !val.includes('s. no')) colName = j;
            // Total column: 'ledger', 'per led', or 'total' (but not loan/available/on hand)
            if (val.includes('ledger') || val.includes('per led') || (val.includes('total') && !val.includes('loan') && !val.includes('on hand') && !val.includes('avail'))) colTotal = j;
            // Serial / row number column
            if (val === 's.no' || val === 's. no' || val === 'no' || val === 'sn' || val === 'sl' || val === 'sl.no' || val === 'no.') colSNo = j;
        }
        if (colName !== -1 && colTotal !== -1) {
            startRow = i + 1;
            break;
        }
    }

    // Fallback if auto-detection fails: assume columns C(2)=Name, D(3)=Total, A(0)=S.No
    if (startRow === -1) { startRow = 2; colName = 2; colTotal = 3; colSNo = 0; }

    console.log(`Excel Sync: StartRow=${startRow}, ColName=${colName}, ColTotal=${colTotal}, ColSNo=${colSNo}`);

    const parseNum = (v) => {
        if (v === null || v === undefined || v === '') return 0;
        const match = String(v).replace(/,/g, '').match(/\d+/);
        return match ? parseInt(match[0]) : 0;
    };

    const seen = new Map();
    let autoIdx = 1;

    for (let i = startRow; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length <= Math.max(colName, colTotal)) continue;

        let name = String(row[colName] ?? '').trim();
        const snRaw = colSNo !== -1 ? String(row[colSNo] ?? '').trim() : '';
        const snNumParsed = parseInt(snRaw);

        // Required: Name and if S.No column exists, it must have a number
        if (!name || name.length < 2) continue;
        if (colSNo !== -1 && isNaN(snNumParsed)) continue;

        const upper = name.toUpperCase();
        if (upper.includes('EQUIVALENT') || upper.includes('COMMUNICATION') || upper.includes('DATE') || upper.includes('S.NO') || upper.includes('TOTAL') || upper.includes('REMARKS')) continue;
        if (/^[\d.]+$/.test(name)) continue;

        const total = parseNum(row[colTotal]);
        if (total <= 0) { autoIdx++; continue; }

        // STABLE BARCODE: Derive purely from the Name. 
        // This ensures that deleting a row or shifting items doesn't change the ID.
        const barcode = name.trim().toUpperCase().replace(/[^A-Z0-9/]/g, '-');

        if (!seen.has(barcode)) {
            // idx is for sorting order, snNumParsed or autoIdx works fine
            const snNum = !isNaN(snNumParsed) ? snNumParsed : autoIdx;
            seen.set(barcode, { name, barcode, total, idx: snNum - 1 });
        }
        autoIdx++;
    }

    // Atomic Full Overwrite
    db.transaction(() => {
        db.prepare("UPDATE products SET status = 'INACTIVE'").run();

        const upsert = db.prepare(`
            INSERT INTO products (name, barcode, totalQuantity, availableQuantity, status, orderIndex)
            VALUES (@name, @barcode, @total, @total, 'ACTIVE', @idx)
            ON CONFLICT(barcode) DO UPDATE SET
                name = excluded.name,
                totalQuantity = excluded.totalQuantity,
                status = 'ACTIVE',
                orderIndex = excluded.orderIndex
        `);

        for (const [, item] of seen) {
            upsert.run(item);
        }

        const inactiveProducts = db.prepare("SELECT id FROM products WHERE status = 'INACTIVE'").all();
        for (const { id } of inactiveProducts) {
            const hasItems = db.prepare("SELECT COUNT(*) as c FROM product_items WHERE productId=? AND status != 'AVAILABLE'").get(id).c;
            const hasHistory = db.prepare("SELECT COUNT(*) as c FROM transactions WHERE productItemId IN (SELECT id FROM product_items WHERE productId=?)").get(id).c;
            if (hasItems === 0 && hasHistory === 0) {
                db.prepare("DELETE FROM transactions WHERE productItemId IN (SELECT id FROM product_items WHERE productId=?)").run(id);
                db.prepare("DELETE FROM product_items WHERE productId=?").run(id);
                db.prepare("DELETE FROM spare_parts WHERE productId=?").run(id);
                db.prepare("DELETE FROM products WHERE id=?").run(id);
            }
        }
    })();

    for (const [, item] of seen) {
        const product = db.prepare("SELECT id FROM products WHERE barcode=? AND status='ACTIVE'").get(item.barcode);
        if (product) {
            // We NO LONGER call syncProductItems here because the user wants to manage custom IDs manually.
            // Instead, we just refresh the available count based on what's in the DB.
            const avail = db.prepare("SELECT COUNT(*) as count FROM product_items WHERE productId=? AND status='AVAILABLE'").get(product.id).count;
            db.prepare('UPDATE products SET availableQuantity=? WHERE id=?').run(avail, product.id);
        }
    }

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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ── Auth ──────────────────────────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE username=? AND password=?').get(req.body.username, req.body.password);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const token = Math.random().toString(36).slice(2) + Date.now();
    TOKENS.add(token);
    res.json({ token, role: user.role });
});

app.post('/api/auth/verify-password', auth, (req, res) => {
    try {
        const user = db.prepare("SELECT * FROM users WHERE password=? AND role='ADMIN'").get(req.body.password);
        if (!user) return res.status(401).json({ error: 'Incorrect password' });
        res.json({ success: true, message: 'Password verified' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/auth/update', auth, (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });

        db.prepare("UPDATE users SET username=?, password=? WHERE id=1").run(username, password);

        // Invalidate all tokens to force re-login with new credentials
        TOKENS.clear();
        res.json({ success: true, message: 'Credentials updated successfully' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

function syncProductItems(productId) {
    const product = db.prepare('SELECT * FROM products WHERE id=?').get(productId);
    if (!product) return;

    const currentCount = db.prepare('SELECT COUNT(*) as count FROM product_items WHERE productId=?').get(productId).count;
    const targetCount = parseInt(product.totalQuantity || 0);

    if (currentCount < targetCount) {
        const insert = db.prepare("INSERT INTO product_items (productId, barcode, status) VALUES (?, ?, 'AVAILABLE')");
        const checkExists = db.prepare('SELECT id FROM product_items WHERE barcode=?');

        db.transaction(() => {
            for (let i = currentCount + 1; i <= targetCount; i++) {
                const suffix = String(i).padStart(3, '0');
                const bc = `${product.barcode}-${suffix}`;
                if (!checkExists.get(bc)) {
                    insert.run(productId, bc);
                }
            }
        })();
    } else if (currentCount > targetCount) {
        const diff = currentCount - targetCount;
        const availableItems = db.prepare("SELECT id FROM product_items WHERE productId=? AND status='AVAILABLE' ORDER BY barcode DESC LIMIT ?")
                                 .all(productId, diff);
        
        db.transaction(() => {
            const del = db.prepare('DELETE FROM product_items WHERE id=?');
            for (const item of availableItems) del.run(item.id);
        })();
        console.log(`Reduced ${product.name} by ${availableItems.length} units.`);
    }

    const total = db.prepare('SELECT COUNT(*) as count FROM product_items WHERE productId=?').get(productId).count;
    const avail = db.prepare("SELECT COUNT(*) as count FROM product_items WHERE productId=? AND status='AVAILABLE'").get(productId).count;
    db.prepare('UPDATE products SET totalQuantity=?, availableQuantity=? WHERE id=?').run(total, avail, productId);
}

// ── Stats Summary ─────────────────────────────────────────────────────────────
app.get('/api/stats/summary', auth, (req, res) => {
    try {
        const products = db.prepare("SELECT totalQuantity, availableQuantity FROM products WHERE status = 'ACTIVE'").all();
        const totalStock = products.reduce((acc, p) => acc + p.totalQuantity, 0);
        const availStock = products.reduce((acc, p) => acc + p.availableQuantity, 0);

        const pendingCount = db.prepare("SELECT COUNT(*) as count FROM transactions WHERE status != 'RETURNED'").get().count;
        const totalTx = db.prepare("SELECT COUNT(*) as count FROM transactions").get().count;

        res.json({
            totalProducts: products.length,
            totalStock,
            availableStock: availStock,
            issuedItems: totalStock - availStock,
            pendingReturns: pendingCount,
            damagedItems: db.prepare("SELECT COUNT(*) as count FROM product_items WHERE status='DAMAGED'").get().count,
            missingSparesItems: db.prepare("SELECT COUNT(*) as count FROM transactions WHERE missingSpares IS NOT NULL AND missingSpares != '' AND missingSpares != 'none'").get().count,
            totalTransactions: totalTx
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/stats/missing-spares', auth, (req, res) => {
    try {
        const rows = db.prepare(TX + " WHERE t.missingSpares IS NOT NULL AND t.missingSpares != '' AND t.missingSpares != 'none' ORDER BY t.returnedAt DESC").all().map(fmt);
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/stats/clear-spares/:id', auth, (req, res) => {
    try {
        db.prepare("UPDATE transactions SET missingSpares = NULL WHERE id = ?").run(req.params.id);
        res.json({ success: true, message: 'Spare parts debt cleared' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Update (partially reduce) missing spares debt
app.patch('/api/stats/update-spares/:id', auth, (req, res) => {
    try {
        const { missingSpares } = req.body;
        if (!missingSpares || missingSpares.trim() === '' || missingSpares.trim().toLowerCase() === 'none') {
            // If cleared out, treat as fully cleared
            db.prepare("UPDATE transactions SET missingSpares = NULL WHERE id = ?").run(req.params.id);
        } else {
            db.prepare("UPDATE transactions SET missingSpares = ? WHERE id = ?").run(missingSpares.trim(), req.params.id);
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/stats/damaged', auth, (req, res) => {
    try {
        const damaged = db.prepare(`
            SELECT pi.*, p.name as product_name,
                   o.name as officer_name, o.badgeNumber as officer_badge,
                   t.returnedAt as damaged_at,
                   t.damagePhotoUrl, t.returnPersonPhotoUrl
            FROM product_items pi
            JOIN products p ON pi.productId = p.id
            LEFT JOIN transactions t ON t.productItemId = pi.id AND t.isDamaged = 1
            LEFT JOIN officers o ON o.id = t.officerId
            WHERE pi.status = 'DAMAGED'
            ORDER BY t.returnedAt DESC
        `).all();

        const formatted = damaged.map(item => ({
            ...item,
            product: { name: item.product_name },
            damagedBy: item.officer_name
                ? { name: item.officer_name, badgeNumber: item.officer_badge }
                : null,
            damagedAt: item.damaged_at,
            damagePhotoUrl: item.damagePhotoUrl,
            returnPersonPhotoUrl: item.returnPersonPhotoUrl
        }));

        res.json(formatted);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/stats/restore/:id', auth, (req, res) => {
    try {
        const item = db.prepare('SELECT * FROM product_items WHERE id=?').get(req.params.id);
        if (!item) return res.status(404).json({ error: 'Item not found' });

        db.transaction(() => {
            db.prepare("UPDATE product_items SET status='AVAILABLE', lastOfficerName=NULL, lastOfficerBadgeNumber=NULL WHERE id=?").run(req.params.id);
            db.prepare('UPDATE products SET availableQuantity = availableQuantity + 1 WHERE id=?').run(item.productId);
        })();

        res.json({ success: true, message: 'Item restored to inventory' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── Products ──────────────────────────────────────────────────────────────────
app.get('/api/inventory/products', auth, (req, res) =>
    res.json(db.prepare("SELECT * FROM products WHERE status = 'ACTIVE' ORDER BY orderIndex ASC").all()));

app.post('/api/inventory/products', auth, (req, res) => {
    const { name, barcode, totalQuantity, imageUrl, status } = req.body;
    try {
        const r = db.prepare('INSERT INTO products (name,barcode,totalQuantity,availableQuantity,imageUrl,status) VALUES (?,?,?,?,?,?)').run(name, barcode, totalQuantity || 0, totalQuantity || 0, imageUrl || null, status || 'ACTIVE');
        const productId = r.lastInsertRowid;
        syncProductItems(productId);
        res.json(db.prepare('SELECT * FROM products WHERE id=?').get(productId));
    } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/inventory/products/id/:id', auth, (req, res) => {
    const product = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    // Auto-sync if count is mismatched before returning
    const currentCount = db.prepare('SELECT COUNT(*) as count FROM product_items WHERE productId=?').get(product.id).count;
    if (currentCount < product.totalQuantity) {
        syncProductItems(product.id);
    }

    // Fetch nested collections
    const items = db.prepare('SELECT * FROM product_items WHERE productId=?').all(product.id);
    const spareParts = db.prepare('SELECT * FROM spare_parts WHERE productId=?').all(product.id);

    res.json({
        ...product,
        items,
        spareParts
    });
});

app.put('/api/inventory/products/:id', auth, (req, res) => {
    const { name, barcode, totalQuantity, imageUrl, status } = req.body;
    db.prepare('UPDATE products SET name=?,barcode=?,totalQuantity=?,imageUrl=?,status=? WHERE id=?').run(name, barcode, totalQuantity, imageUrl, status, req.params.id);
    syncProductItems(req.params.id);
    res.json(db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id));
});

app.delete('/api/inventory/products/:id', auth, (req, res) => {
    try {
        const productId = parseInt(req.params.id);
        
        // 1. Check if any unit is currently NOT AVAILABLE (Issued, Damaged, etc.)
        const busyItems = db.prepare("SELECT barcode, status FROM product_items WHERE productId=? AND status != 'AVAILABLE'").all(productId);
        
        if (busyItems.length > 0) {
            const examples = busyItems.slice(0, 3).map(i => `${i.barcode} (${i.status})`).join(', ');
            return res.status(400).json({ 
                error: `Cannot delete: ${busyItems.length} unit(s) are still in use/damaged. (Examples: ${examples}). Please return/fix them first.` 
            });
        }

        db.transaction(() => {
            // 2. Delete related transactions
            db.prepare(`
                DELETE FROM transactions 
                WHERE productItemId IN (SELECT id FROM product_items WHERE productId=?)
            `).run(productId);

            // 3. Delete units
            db.prepare('DELETE FROM product_items WHERE productId=?').run(productId);

            // 4. Delete spare parts
            db.prepare('DELETE FROM spare_parts WHERE productId=?').run(productId);

            // 5. Delete the product itself
            const result = db.prepare('DELETE FROM products WHERE id=?').run(productId);
            
            if (result.changes === 0) {
                throw new Error('Product not found in database');
            }
        })();

        res.json({ success: true, message: 'Product and all history deleted' });
    } catch (e) {
        console.error('Delete product error:', e);
        res.status(500).json({ error: e.message || 'Server error during deletion' });
    }
});


app.post('/api/inventory/products/:id/image', auth, (req, res) => {
    upload.single('image')(req, res, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        try {
            if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
            const filePath = `/uploads/${req.file.filename}`;
            db.prepare('UPDATE products SET imageUrl = ? WHERE id = ?').run(filePath, req.params.id);
            res.json({ success: true, imageUrl: filePath });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
});

app.delete('/api/inventory/products/:id/image', auth, (req, res) => {
    try {
        const product = db.prepare('SELECT imageUrl FROM products WHERE id = ?').get(req.params.id);
        if (product && product.imageUrl) {
            const fileName = product.imageUrl.split('/').pop();
            const fullPath = path.join(IMG_DIR, fileName);
            if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        }
        db.prepare('UPDATE products SET imageUrl = NULL WHERE id = ?').run(req.params.id);
        res.json({ success: true, message: 'Image removed' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/inventory/items/:barcode(*)', auth, (req, res) => {
    const searchCode = req.params.barcode;
    const raw = db.prepare(`
        SELECT p_i.*, p.name, p.barcode as p_barcode, p.totalQuantity, p.availableQuantity, p.imageUrl, p.status as p_status 
        FROM product_items p_i 
        JOIN products p ON p_i.productId = p.id 
        WHERE p_i.barcode = ? COLLATE NOCASE 
           OR p_i.serialNumber = ? COLLATE NOCASE
    `).get(searchCode, searchCode);
    if (!raw) return res.status(404).json({ error: 'Item not found' });

    let badgeNumber = raw.lastOfficerBadgeNumber;

    // First fallback: Look up in active transactions
    if (!badgeNumber && raw.status !== 'AVAILABLE') {
        const tx = db.prepare("SELECT o.badgeNumber FROM transactions t JOIN officers o ON t.officerId = o.id WHERE t.productItemId = ? AND t.status != 'RETURNED' ORDER BY t.issuedAt DESC LIMIT 1").get(raw.id);
        if (tx) {
            badgeNumber = tx.badgeNumber;
        } else if (raw.lastOfficerName) {
            // Second fallback: Directly lookup the officer by name
            const officer = db.prepare("SELECT badgeNumber FROM officers WHERE name = ? COLLATE NOCASE LIMIT 1").get(raw.lastOfficerName.trim());
            if (officer) badgeNumber = officer.badgeNumber;
        }
    }

    // Structure to match Spring Boot
    res.json({
        id: raw.id,
        barcode: raw.barcode,
        serialNumber: raw.serialNumber,
        status: raw.status,
        lastOfficerName: raw.lastOfficerName,
        lastOfficerBadgeNumber: badgeNumber,
        product: {
            id: raw.productId,
            name: raw.name,
            barcode: raw.p_barcode,
            totalQuantity: raw.totalQuantity,
            availableQuantity: raw.availableQuantity,
            imageUrl: raw.imageUrl,
            status: raw.p_status
        }
    });
});

app.post('/api/inventory/products/:id/items', auth, (req, res) => {
    try {
        const itemsToProcess = req.body;
        const productId = parseInt(req.params.id);

        const process = db.transaction((list) => {
            for (const itemData of list) {
                const bc = typeof itemData === 'string' ? itemData : itemData.barcode;
                const sn = typeof itemData === 'string' ? null : itemData.serialNumber;

                const exists = db.prepare('SELECT id FROM product_items WHERE barcode=?').get(bc);
                if (exists) throw new Error(`Item with ID ${bc} already exists`);
                db.prepare("INSERT INTO product_items (productId, barcode, serialNumber, status) VALUES (?, ?, ?, 'AVAILABLE')").run(productId, bc, sn);
            }
        });

        process(itemsToProcess);

        // Update quantities
        const total = db.prepare('SELECT COUNT(*) as count FROM product_items WHERE productId=?').get(productId)?.count || 0;
        const avail = db.prepare("SELECT COUNT(*) as count FROM product_items WHERE productId=? AND status='AVAILABLE'").get(productId)?.count || 0;
        db.prepare('UPDATE products SET totalQuantity=?, availableQuantity=? WHERE id=?').run(total, avail, productId);

        res.json({ success: true });
    } catch (e) {
        console.error('Error adding units:', e);
        res.status(400).json({ error: e.message });
    }
});

app.post('/api/inventory/products/:id/spare-parts', auth, (req, res) => {
    const { name } = req.body;
    db.prepare('INSERT INTO spare_parts (productId, name) VALUES (?, ?)').run(req.params.id, name);
    res.json({ success: true });
});

app.delete('/api/inventory/items/:id', auth, (req, res) => {
    const item = db.prepare('SELECT * FROM product_items WHERE id=?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    db.prepare('DELETE FROM product_items WHERE id=?').run(req.params.id);

    // Update quantities
    const total = db.prepare('SELECT COUNT(*) as count FROM product_items WHERE productId=?').get(item.productId).count;
    const avail = db.prepare("SELECT COUNT(*) as count FROM product_items WHERE productId=? AND status='AVAILABLE'").get(item.productId).count;
    db.prepare('UPDATE products SET totalQuantity=?, availableQuantity=? WHERE id=?').run(total, avail, item.productId);

    res.json({ success: true });
});

app.post('/api/inventory/items/bulk-delete', auth, (req, res) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'IDs array required' });

    try {
        const firstItem = db.prepare('SELECT productId FROM product_items WHERE id=?').get(ids[0]);
        if (!firstItem) return res.status(404).json({ error: 'Items not found' });

        db.transaction(() => {
            const del = db.prepare('DELETE FROM product_items WHERE id=?');
            for (const id of ids) del.run(id);

            // Update quantities for the product
            const total = db.prepare('SELECT COUNT(*) as count FROM product_items WHERE productId=?').get(firstItem.productId).count;
            const avail = db.prepare("SELECT COUNT(*) as count FROM product_items WHERE productId=? AND status='AVAILABLE'").get(firstItem.productId).count;
            db.prepare('UPDATE products SET totalQuantity=?, availableQuantity=? WHERE id=?').run(total, avail, firstItem.productId);
        })();

        res.json({ success: true, message: `Deleted ${ids.length} items` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/inventory/items/:id', auth, (req, res) => {
    const { barcode, serialNumber, status } = req.body;
    try {
        const item = db.prepare('SELECT id FROM product_items WHERE id=?').get(req.params.id);
        if (!item) return res.status(404).json({ error: 'Item not found' });

        db.prepare('UPDATE product_items SET barcode=?, serialNumber=?, status=? WHERE id=?')
            .run(barcode, serialNumber || null, status || 'AVAILABLE', req.params.id);

        res.json(db.prepare('SELECT * FROM product_items WHERE id=?').get(req.params.id));
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

app.delete('/api/inventory/spare-parts/:id', auth, (req, res) => {
    db.prepare('DELETE FROM spare_parts WHERE id=?').run(req.params.id);
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

app.post('/api/inventory/unlink-excel', auth, (req, res) => {
    try {
        db.prepare("DELETE FROM settings WHERE key='excelPath'").run();
        res.json({ message: 'Excel file unlinked successfully' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── PRODUCT SPECIFIC SYNC ─────────────────────────────────────────────
app.post('/api/inventory/products/:id/set-excel-path', auth, (req, res) => {
    try {
        db.prepare("UPDATE products SET excelPath = ? WHERE id = ?").run(req.body.path, req.params.id);
        res.json({ success: true, message: 'Product Excel path updated' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/inventory/products/:id/sync-from-excel', auth, (req, res) => {
    try {
        const product = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
        if (!product || !product.excelPath || !fs.existsSync(product.excelPath)) {
            return res.status(404).json({ error: 'Excel file not found or not linked for this product' });
        }

        const wb = XLSX.readFile(product.excelPath);
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

        // Expects columns: "QR ID" (required), "Serial Number" (optional)
        db.transaction(() => {
            const excelBarcodes = rows.map(row => {
                const id = (row["QR ID"] || row["Barcode"] || row["ID"] || "").toString().trim();
                return id;
            }).filter(Boolean);

            // REPLACE LOGIC: Delete AVAILABLE items that are no longer in the Excel for this specific product
            if (excelBarcodes.length > 0) {
                const placeholders = excelBarcodes.map(() => '?').join(',');
                db.prepare(`DELETE FROM product_items WHERE productId = ? AND status = 'AVAILABLE' AND barcode NOT IN (${placeholders})`)
                  .run(product.id, ...excelBarcodes);
            } else {
                // If Excel is empty, remove all available units for this product
                db.prepare(`DELETE FROM product_items WHERE productId = ? AND status = 'AVAILABLE'`).run(product.id);
            }

            const check = db.prepare("SELECT id, productId FROM product_items WHERE barcode = ?");
            const insert = db.prepare("INSERT INTO product_items (productId, barcode, serialNumber, status) VALUES (?, ?, ?, 'AVAILABLE')");
            const update = db.prepare("UPDATE product_items SET serialNumber = ?, productId = ? WHERE barcode = ?");

            for (const row of rows) {
                const qrId = (row["QR ID"] || row["Barcode"] || row["ID"] || "").toString().trim();
                const serial = (row["Serial Number"] || row["Serial No"] || "").toString().trim();

                if (!qrId) continue;

                const existing = check.get(qrId);
                if (existing) {
                    // Update existing unit (even if issued, we update serial/product link)
                    update.run(serial, product.id, qrId);
                } else {
                    // Add as new available unit
                    insert.run(product.id, qrId, serial);
                }
            }

            // Final step: Update product master counts
            const total = db.prepare('SELECT COUNT(*) as count FROM product_items WHERE productId=?').get(product.id).count || 0;
            const avail = db.prepare("SELECT COUNT(*) as count FROM product_items WHERE productId=? AND status='AVAILABLE'").get(product.id).count || 0;
            db.prepare('UPDATE products SET totalQuantity=?, availableQuantity=? WHERE id=?').run(total, avail, product.id);
        })();

        res.json({ success: true, message: `Synced ${rows.length} units from Excel` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/inventory/products/:id/open-excel', auth, (req, res) => {
    const product = db.prepare("SELECT excelPath FROM products WHERE id = ?").get(req.params.id);
    if (!product || !product.excelPath || !fs.existsSync(product.excelPath)) {
        return res.status(404).json({ error: 'Excel file not linked or not found' });
    }
    const cmd = process.platform === 'win32' ? `start "" "${product.excelPath}"` : `open "${product.excelPath}"`;
    exec(cmd, err => err ? res.status(500).json({ error: err.message }) : res.json({ message: 'Opening...' }));
});

app.get('/api/inventory/open-local', (req, res) => {
    const p = getExcelPath();
    if (!p || !fs.existsSync(p)) return res.status(404).json({ error: 'Excel file not configured' });
    const cmd = process.platform === 'win32' ? `start "" "${p}"` : `open "${p}"`;
    exec(cmd, err => err ? res.status(500).json({ error: err.message }) : res.json({ message: 'Opening...' }));
});

app.post('/api/inventory/reset-all-stock', auth, (req, res) => {
    try {
        db.transaction(() => {
            // Reset all units to available
            db.prepare("UPDATE product_items SET status='AVAILABLE', lastOfficerName=NULL").run();
            // Reset all product available quantities to their totals
            db.prepare("UPDATE products SET availableQuantity = totalQuantity").run();
            // Clear all transactions so current status matches stock
            db.prepare('DELETE FROM transactions').run();
        })();
        res.json({ success: true, message: 'All stock restored to full' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
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
    o.id as o_id, o.badgeNumber as o_badge, o.name as o_name, o.department as o_dept, o.phone as o_phone,
    pi.barcode as pi_barcode, pi.serialNumber as pi_sn
    FROM transactions t 
    LEFT JOIN product_items pi ON t.productItemId = pi.id
    LEFT JOIN products p ON pi.productId = p.id 
    LEFT JOIN officers o ON t.officerId = o.id`;

function fmt(t) {
    return {
        id: t.id,
        batchId: t.batchId,
        issuerName: t.issuerName,
        extraAccessories: t.extraAccessories,
        quantity: t.quantity,
        returnedQuantity: t.returnedQuantity,
        purpose: t.purpose,
        status: t.status,
        issuedAt: t.issuedAt,
        returnedAt: t.returnedAt,
        isDamaged: t.isDamaged || 0,
        missingSpares: t.missingSpares || '',
        damagePhotoUrl: t.damagePhotoUrl,
        personPhotoUrl: t.personPhotoUrl,
        returnPersonPhotoUrl: t.returnPersonPhotoUrl,
        officer: t.o_id ? { id: t.o_id, badgeNumber: t.o_badge, name: t.o_name, department: t.o_dept, phone: t.o_phone } : { id: 0, name: 'Unknown', badgeNumber: 'N/A' },
        productItem: t.pi_barcode ? {
            barcode: t.pi_barcode,
            serialNumber: t.pi_sn,
            product: t.p_id ? { id: t.p_id, name: t.p_name, barcode: t.p_barcode, totalQuantity: t.p_total, availableQuantity: t.p_avail, imageUrl: t.p_img } : { name: 'Unknown Product' }
        } : null
    };
}

app.get('/api/transactions/pending', auth, (req, res) =>
    res.json(db.prepare(TX + " WHERE t.status != 'RETURNED' ORDER BY t.issuedAt DESC").all().map(fmt)));

app.get('/api/transactions/all', auth, (req, res) =>
    res.json(db.prepare(TX + ' ORDER BY t.issuedAt DESC').all().map(fmt)));

app.get('/api/transactions', auth, (req, res) =>
    res.json(db.prepare(TX + ' ORDER BY t.issuedAt DESC').all().map(fmt)));

app.post('/api/transactions/issue', auth, (req, res) => {
    const { barcodes, badgeNumber, name, department, phone, others, purpose, issuerName, extraAccessories, personPhotoUrl } = req.body;

    // Create/Update officer
    db.prepare(`INSERT INTO officers (badgeNumber,name,department,phone,others) VALUES (?,?,?,?,?)
        ON CONFLICT(badgeNumber) DO UPDATE SET name=excluded.name,department=excluded.department,phone=excluded.phone,others=excluded.others`
    ).run(badgeNumber, name || '', department || '', phone || '', others || '');
    const officer = db.prepare('SELECT * FROM officers WHERE badgeNumber=?').get(badgeNumber);

    const batchId = Math.random().toString(36).slice(2) + Date.now();
    const transactions = [];

    const processIssue = db.transaction(() => {
        for (const code of barcodes) {
            const item = db.prepare('SELECT * FROM product_items WHERE barcode=?').get(code);
            if (!item) throw new Error('Item ' + code + ' not found');
            if (item.status !== 'AVAILABLE') throw new Error('Item ' + code + ' is already ' + item.status);

            // Ensure lastOfficerBadgeNumber column exists
            try { db.prepare('ALTER TABLE product_items ADD COLUMN lastOfficerBadgeNumber TEXT').run(); } catch (e) { }

            db.prepare(`UPDATE product_items SET status='ISSUED', lastOfficerName=?, lastOfficerBadgeNumber=? WHERE id=?`).run(officer.name, officer.badgeNumber, item.id);
            db.prepare('UPDATE products SET availableQuantity = availableQuantity - 1 WHERE id=?').run(item.productId);
            db.prepare(`INSERT INTO transactions (productItemId, officerId, batchId, issuerName, extraAccessories, purpose, status, personPhotoUrl) 
                         VALUES (?, ?, ?, ?, ?, ?, 'ISSUED', ?)`).run(item.id, officer.id, batchId, issuerName, extraAccessories, purpose || '', personPhotoUrl || null);
        }
    });

    try {
        processIssue();
        // Fetch all created transactions AFTER the transaction commits
        const result = db.prepare(TX + ' WHERE t.batchId=?').all(batchId).map(fmt);
        res.json(result);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

app.post('/api/transactions/return/:id', auth, (req, res) => {
    const t = db.prepare('SELECT * FROM transactions WHERE id=?').get(req.params.id);
    if (!t) return res.status(404).json({ error: 'Transaction not found' });
    if (t.status === 'RETURNED') return res.status(400).json({ error: 'Already fully returned' });

    const item = db.prepare('SELECT * FROM product_items WHERE id=?').get(t.productItemId);

    // Ensure lastOfficerBadgeNumber column exists
    try { db.prepare('ALTER TABLE product_items ADD COLUMN lastOfficerBadgeNumber TEXT').run(); } catch (e) { }

    // Simplification as requested: If a return is triggered, always mark as RETURNED and free unit
    db.prepare("UPDATE product_items SET status='AVAILABLE', lastOfficerName=NULL, lastOfficerBadgeNumber=NULL WHERE id=?").run(item.id);
    db.prepare('UPDATE products SET availableQuantity = availableQuantity + 1 WHERE id=?').run(item.productId);
    db.prepare(`UPDATE transactions SET returnedQuantity=1, status='RETURNED', returnedAt=CURRENT_TIMESTAMP WHERE id=?`).run(req.params.id);

    res.json({ success: true, status: 'RETURNED' });
});

app.post('/api/transactions/return-detailed/:id', auth, (req, res) => {
    try {
        const { isDamaged, damagePhotoUrl, missingSpares, returnPersonPhotoUrl } = req.body;
        const transactionId = req.params.id;

        const t = db.prepare('SELECT * FROM transactions WHERE id=?').get(transactionId);
        if (!t) return res.status(404).json({ error: 'Transaction not found' });
        if (t.status === 'RETURNED') return res.status(400).json({ error: 'Already fully returned' });

        const item = db.prepare('SELECT * FROM product_items WHERE id=?').get(t.productItemId);
        if (!item) return res.status(404).json({ error: 'Item not found' });

        db.transaction(() => {
            // Add extra columns if they don't exist
            try { db.prepare('ALTER TABLE transactions ADD COLUMN isDamaged INTEGER DEFAULT 0').run(); } catch (e) { }
            try { db.prepare('ALTER TABLE transactions ADD COLUMN damagePhotoUrl TEXT').run(); } catch (e) { }
            try { db.prepare('ALTER TABLE transactions ADD COLUMN missingSpares TEXT').run(); } catch (e) { }

            // Determine item and transaction status
            let itemStatus = 'AVAILABLE';
            if (isDamaged) {
                itemStatus = 'DAMAGED';
            }
            // User requested: Product should not be held up for missing spare parts if back and good.
            // So we always set itemStatus to AVAILABLE or DAMAGED.

            // Update transaction details
            db.prepare(`
                UPDATE transactions 
                SET status = 'RETURNED', 
                    returnedQuantity = 1, 
                    returnedAt = CURRENT_TIMESTAMP,
                    isDamaged = ?,
                    damagePhotoUrl = ?,
                    missingSpares = ?,
                    returnPersonPhotoUrl = ?
                WHERE id = ?
            `).run(
                isDamaged ? 1 : 0,
                damagePhotoUrl || null,
                missingSpares || '',
                returnPersonPhotoUrl || null,
                transactionId
            );

            // Update item status and metadata
            db.prepare(`
                UPDATE product_items 
                SET status = ?, 
                    lastOfficerName = ?, 
                    lastOfficerBadgeNumber = ? 
                WHERE id = ?
            `).run(
                itemStatus,
                isDamaged ? t.issuerName : null,
                null,
                item.id
            );

            // Update product available quantity only if it's truly available for re-issue
            if (itemStatus === 'AVAILABLE') {
                db.prepare('UPDATE products SET availableQuantity = availableQuantity + 1 WHERE id = ?').run(item.productId);
            }
        })();

        res.json({ success: true, status: 'RETURNED' });
    } catch (e) {
        console.error('Error in return-detailed:', e);
        res.status(500).json({ error: e.message });
    }
});


app.post('/api/transactions/return/barcode/:barcode(*)', auth, (req, res) => {
    const item = db.prepare('SELECT * FROM product_items WHERE barcode=?').get(req.params.barcode);
    if (!item) return res.status(404).json({ error: 'Item not registered' });

    const t = db.prepare("SELECT * FROM transactions WHERE productItemId=? AND status != 'RETURNED' ORDER BY issuedAt DESC LIMIT 1").get(item.id);
    if (!t) return res.status(404).json({ error: 'No active issue record found for this unit' });

    // Ensure lastOfficerBadgeNumber column exists
    try { db.prepare('ALTER TABLE product_items ADD COLUMN lastOfficerBadgeNumber TEXT').run(); } catch (e) { }

    db.prepare("UPDATE product_items SET status='AVAILABLE', lastOfficerName=NULL, lastOfficerBadgeNumber=NULL WHERE id=?").run(item.id);
    db.prepare('UPDATE products SET availableQuantity = availableQuantity + 1 WHERE id=?').run(item.productId);
    db.prepare(`UPDATE transactions SET returnedQuantity=1, status='RETURNED', returnedAt=CURRENT_TIMESTAMP WHERE id=?`).run(t.id);

    res.json({ success: true, status: 'RETURNED' });
});

app.delete('/api/transactions/clear-all', auth, (req, res) => {
    try {
        db.transaction(() => {
            // Find all items that are NOT available
            const items = db.prepare("SELECT id, productId FROM product_items WHERE status IN ('ISSUED', 'PARTIALLY_RETURNED')").all();

            // Reset items to available
            db.prepare("UPDATE product_items SET status='AVAILABLE', lastOfficerName=NULL, lastOfficerBadgeNumber=NULL WHERE status IN ('ISSUED', 'PARTIALLY_RETURNED')").run();

            // Increment availableQuantity for each unique product affected
            const productIds = [...new Set(items.map(i => i.productId))];
            for (const pid of productIds) {
                const count = items.filter(i => i.productId === pid).length;
                db.prepare('UPDATE products SET availableQuantity = availableQuantity + ? WHERE id = ?').run(count, pid);
            }

            // Finally clear the transactions
            db.prepare('DELETE FROM transactions').run();
        })();
        res.json({ success: true, message: 'History cleared and items restored to inventory' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/transactions/:id', auth, (req, res) => {
    try {
        db.prepare('DELETE FROM transactions WHERE id=?').run(req.params.id);
        res.json({ success: true, message: 'Transaction record deleted' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/transactions/batch/:batchId', auth, (req, res) => {
    try {
        db.prepare('DELETE FROM transactions WHERE batchId=?').run(req.params.batchId);
        res.json({ success: true, message: 'Batch transactions deleted' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// ── Officers ──────────────────────────────────────────────────────────────────
app.get('/api/officers', auth, (req, res) =>
    res.json(db.prepare('SELECT * FROM officers').all()));

app.post('/api/officers', auth, (req, res) => {
    const { badgeNumber, name, department, phone, others, imageUrl, idCardUrl } = req.body;
    const finalImageUrl = imageUrl || idCardUrl;
    try {
        const r = db.prepare('INSERT INTO officers (badgeNumber,name,department,phone,others,imageUrl) VALUES (?,?,?,?,?,?)').run(badgeNumber, name, department, phone, others, finalImageUrl);
        res.json(db.prepare('SELECT * FROM officers WHERE id=?').get(r.lastInsertRowid));
    } catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/officers/:id', auth, (req, res) => {
    const { badgeNumber, name, department, phone, others, imageUrl, idCardUrl } = req.body;
    const finalImageUrl = imageUrl || idCardUrl;
    db.prepare('UPDATE officers SET badgeNumber=?,name=?,department=?,phone=?,others=?,imageUrl=? WHERE id=?').run(badgeNumber, name, department, phone, others, finalImageUrl, req.params.id);
    res.json(db.prepare('SELECT * FROM officers WHERE id=?').get(req.params.id));
});

app.delete('/api/officers/:id', auth, (req, res) => {
    db.prepare('DELETE FROM officers WHERE id=?').run(req.params.id);
    res.json({ success: true });
});

app.post('/api/files/upload', auth, (req, res) => {
    upload.single('file')(req, res, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        let folder = 'uploads';
        if (req.query.type === 'damaged') folder = 'damaged';
        if (req.query.type === 'person') folder = 'files';
        res.json({ url: `http://localhost:9876/${folder}/${req.file.filename}` });
    });
});

app.post('/api/files/save-invoice', auth, (req, res) => {
    try {
        const { filename, pdfBase64, type } = req.body;
        if (!filename || !pdfBase64) return res.status(400).json({ error: 'Missing data' });
        const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, "");
        
        const subfolder = type === 'return' ? 'return' : 'issue';
        const targetDir = path.join(USER_DATA, 'transaction_history', subfolder);
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
        
        const filePath = path.join(targetDir, filename);
        fs.writeFileSync(filePath, base64Data, 'base64');
        res.json({ success: true, path: filePath });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = 9876;
let serverInstance = null;

async function startServer() {
    initPaths();
    initDb();
    initUpload();
    // Fallback for older DB records that don't have /api prefix in stored URLs
    app.use('/uploads', express.static(IMG_DIR));
    app.use('/damaged', express.static(DAMAGED_DIR));
    app.use('/files', express.static(PERSONS_DIR));

    app.use('/api/uploads', express.static(IMG_DIR));
    app.use('/api/damaged', express.static(DAMAGED_DIR));
    app.use('/api/files', express.static(PERSONS_DIR));

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

function getDbPath() {
    return DB_PATH;
}

module.exports = { startServer, stopServer, getExcelPath, setExcelPath, getDbPath };
