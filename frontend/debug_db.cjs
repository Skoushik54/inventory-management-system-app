const Database = require('better-sqlite3');
const db = new Database('C:/Users/samba/GreyhoundsInventory/inventory.db');
const products = db.prepare("SELECT name, status FROM products").all();
console.log(JSON.stringify(products, null, 2));
