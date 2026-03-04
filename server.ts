import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

const db = new Database('pos.db');

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT,
    name TEXT
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    barcode TEXT UNIQUE,
    name TEXT,
    price REAL,
    cost REAL,
    stock INTEGER,
    category TEXT,
    vat_rate REAL DEFAULT 15.0
  );

  CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    invoice_number TEXT UNIQUE,
    user_id TEXT,
    total REAL,
    subtotal REAL,
    tax REAL,
    discount REAL,
    payment_method TEXT,
    amount_paid REAL,
    change_amount REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sale_items (
    id TEXT PRIMARY KEY,
    sale_id TEXT,
    product_id TEXT,
    quantity INTEGER,
    unit_price REAL,
    total REAL,
    FOREIGN KEY(sale_id) REFERENCES sales(id),
    FOREIGN KEY(product_id) REFERENCES products(id)
  );
`);

// Seed initial data if empty
const userCount = db.prepare('SELECT count(*) as count FROM users').get() as { count: number };
if (userCount.count === 0) {
  db.prepare('INSERT INTO users (id, username, password, role, name) VALUES (?, ?, ?, ?, ?)').run(
    uuidv4(), 'admin', 'admin123', 'admin', 'System Admin'
  );
  db.prepare('INSERT INTO users (id, username, password, role, name) VALUES (?, ?, ?, ?, ?)').run(
    uuidv4(), 'cashier', 'cashier123', 'cashier', 'John Doe'
  );

  const products = [
    { name: 'Milk 1L', barcode: '6001234567890', price: 18.50, cost: 14.00, stock: 50, category: 'Dairy' },
    { name: 'Bread White', barcode: '6009876543210', price: 15.00, cost: 10.00, stock: 100, category: 'Bakery' },
    { name: 'Coca Cola 2L', barcode: '5449000000996', price: 24.00, cost: 18.00, stock: 40, category: 'Beverages' },
    { name: 'Eggs 18pk', barcode: '6005554443332', price: 45.00, cost: 35.00, stock: 20, category: 'Dairy' },
    { name: 'Sugar 2kg', barcode: '6001112223334', price: 38.00, cost: 30.00, stock: 60, category: 'Pantry' },
  ];

  const insertProduct = db.prepare('INSERT INTO products (id, barcode, name, price, cost, stock, category) VALUES (?, ?, ?, ?, ?, ?, ?)');
  products.forEach(p => insertProduct.run(uuidv4(), p.barcode, p.name, p.price, p.cost, p.stock, p.category));
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // API Routes
  app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password) as any;
    if (user) {
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });

  app.get('/api/products', (req, res) => {
    const products = db.prepare('SELECT * FROM products').all();
    res.json(products);
  });

  app.get('/api/products/search', (req, res) => {
    const { q } = req.query;
    const products = db.prepare('SELECT * FROM products WHERE name LIKE ? OR barcode = ?').all(`%${q}%`, q);
    res.json(products);
  });

  app.post('/api/sales', (req, res) => {
    const { items, payment, userId } = req.body;
    
    const transaction = db.transaction(() => {
      const saleId = uuidv4();
      const invoiceNumber = `INV-${Date.now()}`;
      
      // Calculate totals
      let subtotal = 0;
      let tax = 0;
      items.forEach((item: any) => {
        subtotal += item.price * item.quantity;
        tax += (item.price * item.quantity) * (item.vat_rate / 100);
      });
      
      const total = subtotal + tax - (payment.discount || 0);

      db.prepare(`
        INSERT INTO sales (id, invoice_number, user_id, total, subtotal, tax, discount, payment_method, amount_paid, change_amount)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        saleId, 
        invoiceNumber, 
        userId, 
        total, 
        subtotal, 
        tax, 
        payment.discount || 0, 
        payment.method, 
        payment.amountPaid, 
        payment.amountPaid - total
      );

      const insertItem = db.prepare(`
        INSERT INTO sale_items (id, sale_id, product_id, quantity, unit_price, total)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const updateStock = db.prepare(`
        UPDATE products SET stock = stock - ? WHERE id = ?
      `);

      items.forEach((item: any) => {
        insertItem.run(uuidv4(), saleId, item.id, item.quantity, item.price, item.price * item.quantity);
        updateStock.run(item.quantity, item.id);
      });

      return { saleId, invoiceNumber, total, tax, subtotal };
    });

    try {
      const result = transaction();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/reports/daily', (req, res) => {
    const report = db.prepare(`
      SELECT 
        COUNT(*) as total_sales,
        SUM(total) as total_revenue,
        SUM(tax) as total_tax,
        SUM(discount) as total_discount
      FROM sales
      WHERE date(created_at) = date('now')
    `).get();
    res.json(report);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => res.sendFile(path.resolve('dist/index.html')));
  }

  app.listen(3000, '0.0.0.0', () => {
    console.log('Server running on http://localhost:3000');
  });
}

startServer();
