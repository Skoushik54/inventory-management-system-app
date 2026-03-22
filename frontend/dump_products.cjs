const Database = require('better-sqlite3');
const db = new Database('C:/Users/samba/GreyhoundsInventory/inventory.db');
const activeProducts = db.prepare("SELECT name, barcode, status FROM products WHERE status = 'ACTIVE'").all();
const inactiveProducts = db.prepare("SELECT name, barcode, status FROM products WHERE status = 'INACTIVE'").all();
const fs = require('fs');
fs.writeFileSync('product_dump.json', JSON.stringify({ active: activeProducts, inactive: inactiveProducts }, null, 2));
console.log('Dumped ' + activeProducts.length + ' active and ' + inactiveProducts.length + ' inactive products');
