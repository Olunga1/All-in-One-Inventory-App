import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const dataDirectory = process.env.DATA_DIR || path.join(root, '.data');
mkdirSync(dataDirectory, { recursive: true });

const db = new DatabaseSync(path.join(dataDirectory, 'stockroom.sqlite'));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    business_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sku TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Other',
    supplier TEXT NOT NULL DEFAULT '',
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    reorder_point INTEGER NOT NULL DEFAULT 0 CHECK (reorder_point >= 0),
    unit_cost REAL NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
    lead_time_days INTEGER NOT NULL DEFAULT 0 CHECK (lead_time_days >= 0),
    weekly_sales REAL NOT NULL DEFAULT 0 CHECK (weekly_sales >= 0),
    location TEXT NOT NULL DEFAULT '',
    emoji TEXT NOT NULL DEFAULT '📦',
    color TEXT NOT NULL DEFAULT 'sage',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (user_id, sku)
  );
  CREATE TABLE IF NOT EXISTS restocks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    supplier TEXT NOT NULL DEFAULT '',
    expected_date TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'ordered' CHECK (status IN ('draft', 'ordered', 'received')),
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS movements (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    quantity_change INTEGER NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS products_user_idx ON products(user_id);
  CREATE INDEX IF NOT EXISTS restocks_user_idx ON restocks(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS movements_user_idx ON movements(user_id, created_at DESC);
`);

const COOKIE_NAME = 'stockroom_session';
const SESSION_LIFETIME_SECONDS = 60 * 60 * 24 * 14;
const DEMO_EMAIL = 'demo@stockroom.app';
const DEMO_PASSWORD = 'stockroom24';
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

function nowIso() {
  return new Date().toISOString();
}

function dateDaysFromToday(days, hour = 12) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function makePasswordHash(password) {
  const salt = randomBytes(16).toString('hex');
  const digest = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${digest}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, savedHex] = storedHash.split(':');
  const saved = Buffer.from(savedHex, 'hex');
  const candidate = scryptSync(password, salt, 64);
  return saved.length === candidate.length && timingSafeEqual(saved, candidate);
}

function userFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    businessName: row.business_name,
    createdAt: row.created_at,
  };
}

function productFromRow(row) {
  if (!row) return null;
  const quantity = Number(row.quantity);
  const reorderPoint = Number(row.reorder_point);
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    category: row.category,
    supplier: row.supplier,
    quantity,
    reorderPoint,
    unitCost: Number(row.unit_cost),
    leadTimeDays: Number(row.lead_time_days),
    weeklySales: Number(row.weekly_sales),
    location: row.location,
    emoji: row.emoji,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lowStock: quantity <= reorderPoint,
    stockValue: quantity * Number(row.unit_cost),
  };
}

function restockFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    productSku: row.product_sku,
    emoji: row.emoji,
    color: row.color,
    quantity: Number(row.quantity),
    supplier: row.supplier,
    expectedDate: row.expected_date,
    status: row.status,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function movementFromRow(row) {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    productSku: row.product_sku,
    emoji: row.emoji,
    color: row.color,
    kind: row.kind,
    quantityChange: Number(row.quantity_change),
    note: row.note,
    createdAt: row.created_at,
  };
}

function addMovement(userId, productId, kind, quantityChange, note, createdAt = nowIso()) {
  db.prepare(`
    INSERT INTO movements (id, user_id, product_id, kind, quantity_change, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), userId, productId, kind, quantityChange, note, createdAt);
}

function parseCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }
  return null;
}

function writeSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_LIFETIME_SECONDS}${secure}`,
  );
}

function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}

function startSession(res, userId) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS;
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .run(hashToken(token), userId, expiresAt, nowIso());
  writeSessionCookie(res, token);
}

function requireAuth(req, res, next) {
  const token = parseCookie(req, COOKIE_NAME);
  if (!token) return res.status(401).json({ error: 'Please sign in to continue.' });
  const row = db.prepare(`
    SELECT u.id, u.name, u.email, u.business_name, u.created_at
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).get(hashToken(token), Math.floor(Date.now() / 1000));
  if (!row) {
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }
  req.user = userFromRow(row);
  req.sessionTokenHash = hashToken(token);
  next();
}

function integer(value, label, { min = 0, max = 100000000 } = {}) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw Object.assign(new Error(`${label} must be a whole number between ${min} and ${max}.`), { status: 400 });
  }
  return parsed;
}

function nonNegativeNumber(value, label, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100000000) {
    throw Object.assign(new Error(`${label} must be a valid non-negative number.`), { status: 400 });
  }
  return parsed;
}

function getProduct(userId, productId) {
  const row = db.prepare('SELECT * FROM products WHERE id = ? AND user_id = ?').get(productId, userId);
  return productFromRow(row);
}

function getRestockRow(userId, restockId) {
  return db.prepare(`
    SELECT r.*, p.name AS product_name, p.sku AS product_sku, p.emoji, p.color
    FROM restocks r JOIN products p ON p.id = r.product_id
    WHERE r.id = ? AND r.user_id = ?
  `).get(restockId, userId);
}

function listProducts(userId) {
  return db.prepare('SELECT * FROM products WHERE user_id = ? ORDER BY name COLLATE NOCASE')
    .all(userId)
    .map(productFromRow);
}

function listRestocks(userId) {
  return db.prepare(`
    SELECT r.*, p.name AS product_name, p.sku AS product_sku, p.emoji, p.color
    FROM restocks r JOIN products p ON p.id = r.product_id
    WHERE r.user_id = ?
    ORDER BY CASE r.status WHEN 'ordered' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, r.created_at DESC
  `).all(userId).map(restockFromRow);
}

function listMovements(userId, limit = 50) {
  return db.prepare(`
    SELECT m.*, p.name AS product_name, p.sku AS product_sku, p.emoji, p.color
    FROM movements m JOIN products p ON p.id = m.product_id
    WHERE m.user_id = ?
    ORDER BY m.created_at DESC
    LIMIT ?
  `).all(userId, limit).map(movementFromRow);
}

function createDemoWorkspace() {
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(DEMO_EMAIL)) return;

  const userId = randomUUID();
  db.prepare(`INSERT INTO users (id, name, email, business_name, password_hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?)`).run(
    userId,
    'Maya Chen',
    DEMO_EMAIL,
    'Juniper & Loom Studio',
    makePasswordHash(DEMO_PASSWORD),
    nowIso(),
  );

  const demoProducts = [
    { name: 'Sunroom soy candle · 8 oz', sku: 'CAN-008', category: 'Candles', supplier: 'Cedar & Sage Wax Co.', quantity: 18, reorderPoint: 24, unitCost: 7.4, leadTimeDays: 12, weeklySales: 22, location: 'Shelf A · Front room', emoji: '🕯️', color: 'sand' },
    { name: 'Sunday morning candle', sku: 'CAN-014', category: 'Candles', supplier: 'Cedar & Sage Wax Co.', quantity: 36, reorderPoint: 18, unitCost: 7.4, leadTimeDays: 12, weeklySales: 13, location: 'Shelf A · Front room', emoji: '🕯️', color: 'peach' },
    { name: 'Ceramic match striker', sku: 'ACC-002', category: 'Accessories', supplier: 'Wild Clay Studio', quantity: 9, reorderPoint: 12, unitCost: 8.5, leadTimeDays: 14, weeklySales: 8, location: 'Display table', emoji: '🏺', color: 'clay' },
    { name: 'Linen room mist · 100 ml', sku: 'FRG-006', category: 'Home fragrance', supplier: 'Aroma House Supply', quantity: 42, reorderPoint: 14, unitCost: 5.2, leadTimeDays: 5, weeklySales: 17, location: 'Shelf B · Back room', emoji: '🌿', color: 'sage' },
    { name: 'Botanical soap trio', sku: 'BTH-003', category: 'Bath & body', supplier: 'Juniper Botanicals', quantity: 6, reorderPoint: 10, unitCost: 5.1, leadTimeDays: 10, weeklySales: 12, location: 'Shelf B · Front room', emoji: '🧼', color: 'lilac' },
    { name: 'Wick trimmer · brushed brass', sku: 'ACC-011', category: 'Accessories', supplier: 'Sienna Metal Works', quantity: 11, reorderPoint: 10, unitCost: 4.8, leadTimeDays: 18, weeklySales: 6, location: 'Display table', emoji: '✂️', color: 'blue' },
    { name: 'Gift box · medium', sku: 'PKG-004', category: 'Packaging', supplier: 'Wrapwell Paper Co.', quantity: 128, reorderPoint: 30, unitCost: 1.2, leadTimeDays: 7, weeklySales: 28, location: 'Packing station', emoji: '🎁', color: 'peach' },
    { name: 'The slow Sunday gift set', sku: 'KIT-001', category: 'Gift sets', supplier: 'Juniper & Loom Studio', quantity: 15, reorderPoint: 8, unitCost: 14.5, leadTimeDays: 3, weeklySales: 7, location: 'Shelf C · Front room', emoji: '🧺', color: 'sage' },
    { name: 'Amber grove candle · 8 oz', sku: 'CAN-021', category: 'Candles', supplier: 'Cedar & Sage Wax Co.', quantity: 4, reorderPoint: 9, unitCost: 7.4, leadTimeDays: 12, weeklySales: 18, location: 'Shelf A · Front room', emoji: '🕯️', color: 'clay' },
    { name: 'Cotton care card set', sku: 'PKG-008', category: 'Packaging', supplier: 'Paperfield Print House', quantity: 88, reorderPoint: 24, unitCost: 0.68, leadTimeDays: 9, weeklySales: 17, location: 'Packing station', emoji: '📜', color: 'lilac' },
  ];

  const productIds = {};
  const insertProduct = db.prepare(`
    INSERT INTO products (
      id, user_id, name, sku, category, supplier, quantity, reorder_point, unit_cost,
      lead_time_days, weekly_sales, location, emoji, color, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const [index, product] of demoProducts.entries()) {
    const id = randomUUID();
    productIds[product.sku] = id;
    const addedAt = dateDaysFromToday(-(18 - index));
    insertProduct.run(
      id, userId, product.name, product.sku, product.category, product.supplier,
      product.quantity, product.reorderPoint, product.unitCost, product.leadTimeDays,
      product.weeklySales, product.location, product.emoji, product.color, addedAt, addedAt,
    );
  }

  const insertRestock = db.prepare(`
    INSERT INTO restocks (id, user_id, product_id, quantity, supplier, expected_date, status, note, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const restockOneId = randomUUID();
  insertRestock.run(
    restockOneId, userId, productIds['ACC-002'], 36, 'Wild Clay Studio', dateDaysFromToday(4).slice(0, 10),
    'ordered', 'White speckle glaze · next kiln run', dateDaysFromToday(-2), dateDaysFromToday(-2),
  );
  const restockTwoId = randomUUID();
  insertRestock.run(
    restockTwoId, userId, productIds['CAN-021'], 48, 'Cedar & Sage Wax Co.', dateDaysFromToday(11).slice(0, 10),
    'draft', 'Amber jars and cedar blend wax', dateDaysFromToday(-1), dateDaysFromToday(-1),
  );

  const events = [
    ['CAN-008', 'sale', -2, 'Shopify order #2048 · 2 items', -0, 16],
    ['CAN-014', 'sale', -3, 'Etsy order #1087 · 3 items', -1, 11],
    ['ACC-002', 'restock', 12, 'PO-1042 · partial delivery', -1, 15],
    ['PKG-004', 'sale', -6, 'Shopify order #2042 · 6 items', -2, 14],
    ['CAN-021', 'sale', -1, 'In-store sale', -3, 12],
    ['BTH-003', 'sale', -2, 'Etsy order #1079 · 2 items', -4, 10],
    ['FRG-006', 'restock', 24, 'PO-1038 · Aroma House Supply', -5, 9],
    ['CAN-008', 'sale', -4, 'Shopify order #2026 · 4 items', -6, 13],
  ];
  for (const [sku, kind, change, note, daysAgo, hour] of events) {
    addMovement(userId, productIds[sku], kind, change, note, dateDaysFromToday(daysAgo, hour));
  }
}

createDemoWorkspace();

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/auth/me', (req, res) => {
  const token = parseCookie(req, COOKIE_NAME);
  if (!token) return res.json({ user: null });
  const row = db.prepare(`
    SELECT u.id, u.name, u.email, u.business_name, u.created_at
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).get(hashToken(token), Math.floor(Date.now() / 1000));
  res.json({ user: userFromRow(row) });
});

app.post('/api/auth/login', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!row || !verifyPassword(password, row.password_hash)) {
    return res.status(401).json({ error: 'That email and password combination did not match.' });
  }
  startSession(res, row.id);
  return res.json({ user: userFromRow(row) });
});

app.post('/api/auth/demo', (_req, res) => {
  if (process.env.DISABLE_DEMO === 'true') {
    return res.status(404).json({ error: 'Demo access is disabled.' });
  }
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(DEMO_EMAIL);
  if (!row) return res.status(503).json({ error: 'The demo workspace is not available right now.' });
  startSession(res, row.id);
  return res.json({ user: userFromRow(row) });
});

app.post('/api/auth/register', (req, res) => {
  const name = String(req.body?.name || '').trim();
  const businessName = String(req.body?.businessName || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (name.length < 2 || name.length > 80) return res.status(400).json({ error: 'Please enter your name.' });
  if (businessName.length < 2 || businessName.length > 100) return res.status(400).json({ error: 'Please enter your shop name.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  if (password.length < 8) return res.status(400).json({ error: 'Use a password with at least 8 characters.' });

  const id = randomUUID();
  try {
    db.prepare(`INSERT INTO users (id, name, email, business_name, password_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`).run(id, name, email, businessName, makePasswordHash(password), nowIso());
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) return res.status(409).json({ error: 'An account with this email already exists.' });
    throw error;
  }
  const user = userFromRow(db.prepare('SELECT * FROM users WHERE id = ?').get(id));
  startSession(res, id);
  return res.status(201).json({ user });
});

app.post('/api/auth/logout', (req, res) => {
  const token = parseCookie(req, COOKIE_NAME);
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
  clearSessionCookie(res);
  return res.json({ ok: true });
});

app.patch('/api/profile', requireAuth, (req, res) => {
  const name = String(req.body?.name ?? req.user.name).trim();
  const businessName = String(req.body?.businessName ?? req.user.businessName).trim();
  if (name.length < 2 || name.length > 80) return res.status(400).json({ error: 'Name must be between 2 and 80 characters.' });
  if (businessName.length < 2 || businessName.length > 100) return res.status(400).json({ error: 'Shop name must be between 2 and 100 characters.' });
  db.prepare('UPDATE users SET name = ?, business_name = ? WHERE id = ?').run(name, businessName, req.user.id);
  return res.json({ user: userFromRow(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) });
});

app.get('/api/dashboard', requireAuth, (req, res) => {
  const products = listProducts(req.user.id);
  const movements = listMovements(req.user.id, 8);
  const lowStockProducts = products.filter((product) => product.lowStock)
    .sort((a, b) => (a.quantity - a.reorderPoint) - (b.quantity - b.reorderPoint));
  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 6));
  const grouped = db.prepare(`
    SELECT substr(created_at, 1, 10) AS day,
      SUM(CASE WHEN quantity_change > 0 THEN quantity_change ELSE 0 END) AS incoming,
      SUM(CASE WHEN quantity_change < 0 THEN -quantity_change ELSE 0 END) AS outgoing
    FROM movements
    WHERE user_id = ? AND created_at >= ?
    GROUP BY substr(created_at, 1, 10)
  `).all(req.user.id, start.toISOString());
  const groupByDay = new Map(grouped.map((row) => [row.day, row]));
  const activityByDay = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setUTCDate(day.getUTCDate() + index);
    const key = day.toISOString().slice(0, 10);
    const row = groupByDay.get(key);
    return {
      date: key,
      label: new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: 'UTC' }).format(day),
      incoming: Number(row?.incoming || 0),
      outgoing: Number(row?.outgoing || 0),
    };
  });
  const totalUnits = products.reduce((sum, product) => sum + product.quantity, 0);
  const stockValue = products.reduce((sum, product) => sum + product.stockValue, 0);
  const restockCounts = db.prepare(`
    SELECT
      SUM(CASE WHEN status IN ('draft', 'ordered') THEN 1 ELSE 0 END) AS open_count,
      SUM(CASE WHEN status = 'ordered' THEN 1 ELSE 0 END) AS ordered_count
    FROM restocks WHERE user_id = ?
  `).get(req.user.id);
  return res.json({
    stats: {
      products: products.length,
      totalUnits,
      stockValue,
      lowStock: lowStockProducts.length,
      openRestocks: Number(restockCounts?.open_count || 0),
      orderedRestocks: Number(restockCounts?.ordered_count || 0),
    },
    lowStockProducts: lowStockProducts.slice(0, 4),
    topProducts: [...products].sort((a, b) => b.weeklySales - a.weeklySales).slice(0, 4),
    recentMovements: movements,
    activityByDay,
  });
});

app.get('/api/products', requireAuth, (req, res) => {
  let products = listProducts(req.user.id);
  const query = String(req.query.q || '').trim().toLowerCase();
  const category = String(req.query.category || '').trim().toLowerCase();
  const filter = String(req.query.filter || '').trim();
  if (query) products = products.filter((product) =>
    [product.name, product.sku, product.category, product.supplier, product.location]
      .some((value) => value.toLowerCase().includes(query)),
  );
  if (category && category !== 'all') products = products.filter((product) => product.category.toLowerCase() === category);
  if (filter === 'low') products = products.filter((product) => product.lowStock);
  if (filter === 'healthy') products = products.filter((product) => !product.lowStock);
  return res.json({ products });
});

app.post('/api/products', requireAuth, (req, res) => {
  const body = req.body || {};
  const name = String(body.name || '').trim();
  if (name.length < 2 || name.length > 120) return res.status(400).json({ error: 'Product name must be between 2 and 120 characters.' });
  const sku = String(body.sku || `SKU-${randomBytes(3).toString('hex').toUpperCase()}`).trim().slice(0, 40);
  const category = String(body.category || 'Other').trim().slice(0, 60) || 'Other';
  const supplier = String(body.supplier || '').trim().slice(0, 100);
  const quantity = integer(body.quantity ?? 0, 'On-hand quantity');
  const reorderPoint = integer(body.reorderPoint ?? 0, 'Reorder point');
  const unitCost = nonNegativeNumber(body.unitCost, 'Unit cost');
  const leadTimeDays = integer(body.leadTimeDays ?? 0, 'Lead time', { max: 3650 });
  const weeklySales = nonNegativeNumber(body.weeklySales, 'Weekly sales');
  const location = String(body.location || '').trim().slice(0, 100);
  const emoji = String(body.emoji || '📦').slice(0, 12);
  const color = String(body.color || 'sage').slice(0, 30);
  const id = randomUUID();
  const timestamp = nowIso();
  try {
    db.prepare(`
      INSERT INTO products (id, user_id, name, sku, category, supplier, quantity, reorder_point,
        unit_cost, lead_time_days, weekly_sales, location, emoji, color, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.user.id, name, sku, category, supplier, quantity, reorderPoint, unitCost,
      leadTimeDays, weeklySales, location, emoji, color, timestamp, timestamp);
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) return res.status(409).json({ error: 'That SKU is already in your catalog.' });
    throw error;
  }
  if (quantity > 0) addMovement(req.user.id, id, 'initial', quantity, 'Opening stock');
  return res.status(201).json({ product: getProduct(req.user.id, id) });
});

app.put('/api/products/:id', requireAuth, (req, res) => {
  const existing = getProduct(req.user.id, req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found.' });
  const body = req.body || {};
  const name = String(body.name ?? existing.name).trim();
  if (name.length < 2 || name.length > 120) return res.status(400).json({ error: 'Product name must be between 2 and 120 characters.' });
  const sku = String(body.sku ?? existing.sku).trim().slice(0, 40);
  const category = String(body.category ?? existing.category).trim().slice(0, 60) || 'Other';
  const supplier = String(body.supplier ?? existing.supplier).trim().slice(0, 100);
  const quantity = integer(body.quantity ?? existing.quantity, 'On-hand quantity');
  const reorderPoint = integer(body.reorderPoint ?? existing.reorderPoint, 'Reorder point');
  const unitCost = nonNegativeNumber(body.unitCost, 'Unit cost', existing.unitCost);
  const leadTimeDays = integer(body.leadTimeDays ?? existing.leadTimeDays, 'Lead time', { max: 3650 });
  const weeklySales = nonNegativeNumber(body.weeklySales, 'Weekly sales', existing.weeklySales);
  const location = String(body.location ?? existing.location).trim().slice(0, 100);
  const emoji = String(body.emoji ?? existing.emoji).slice(0, 12);
  const color = String(body.color ?? existing.color).slice(0, 30);
  try {
    db.prepare(`
      UPDATE products SET name = ?, sku = ?, category = ?, supplier = ?, quantity = ?, reorder_point = ?,
        unit_cost = ?, lead_time_days = ?, weekly_sales = ?, location = ?, emoji = ?, color = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(name, sku, category, supplier, quantity, reorderPoint, unitCost, leadTimeDays,
      weeklySales, location, emoji, color, nowIso(), req.params.id, req.user.id);
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) return res.status(409).json({ error: 'That SKU is already in your catalog.' });
    throw error;
  }
  const delta = quantity - existing.quantity;
  if (delta !== 0) addMovement(req.user.id, req.params.id, 'adjustment', delta, 'Count corrected in product details');
  return res.json({ product: getProduct(req.user.id, req.params.id) });
});

app.delete('/api/products/:id', requireAuth, (req, res) => {
  const existing = getProduct(req.user.id, req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found.' });
  db.prepare('DELETE FROM products WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  return res.json({ ok: true });
});

app.post('/api/products/:id/adjust', requireAuth, (req, res) => {
  const product = getProduct(req.user.id, req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  const amount = integer(req.body?.quantity, 'Adjustment quantity', { min: 1 });
  const direction = req.body?.direction === 'out' ? 'out' : 'in';
  const kind = ['sale', 'restock', 'adjustment'].includes(req.body?.kind)
    ? req.body.kind
    : (direction === 'out' ? 'sale' : 'restock');
  const delta = direction === 'out' ? -amount : amount;
  if (product.quantity + delta < 0) return res.status(400).json({ error: 'There is not enough stock for that adjustment.' });
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('UPDATE products SET quantity = quantity + ?, updated_at = ? WHERE id = ? AND user_id = ?')
      .run(delta, nowIso(), product.id, req.user.id);
    const note = String(req.body?.note || (kind === 'sale' ? 'Stock sold' : kind === 'restock' ? 'Stock received' : 'Manual count adjustment')).trim().slice(0, 180);
    addMovement(req.user.id, product.id, kind, delta, note);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return res.json({ product: getProduct(req.user.id, product.id) });
});

app.get('/api/restocks', requireAuth, (req, res) => res.json({ restocks: listRestocks(req.user.id) }));

app.post('/api/restocks', requireAuth, (req, res) => {
  const product = getProduct(req.user.id, String(req.body?.productId || ''));
  if (!product) return res.status(400).json({ error: 'Choose a product from your catalog.' });
  const quantity = integer(req.body?.quantity, 'Order quantity', { min: 1 });
  const status = ['draft', 'ordered', 'received'].includes(req.body?.status) ? req.body.status : 'ordered';
  const supplier = String(req.body?.supplier || product.supplier || '').trim().slice(0, 100);
  const expectedDate = String(req.body?.expectedDate || '').slice(0, 10);
  const note = String(req.body?.note || '').trim().slice(0, 180);
  const id = randomUUID();
  const timestamp = nowIso();

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`INSERT INTO restocks (id, user_id, product_id, quantity, supplier, expected_date, status, note, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, req.user.id, product.id, quantity, supplier, expectedDate, status, note, timestamp, timestamp,
    );
    if (status === 'received') {
      db.prepare('UPDATE products SET quantity = quantity + ?, updated_at = ? WHERE id = ? AND user_id = ?')
        .run(quantity, timestamp, product.id, req.user.id);
      addMovement(req.user.id, product.id, 'restock', quantity, note || `Received order from ${supplier || 'supplier'}`);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return res.status(201).json({ restock: restockFromRow(getRestockRow(req.user.id, id)) });
});

app.put('/api/restocks/:id', requireAuth, (req, res) => {
  const existingRow = getRestockRow(req.user.id, req.params.id);
  if (!existingRow) return res.status(404).json({ error: 'Purchase order not found.' });
  const existing = restockFromRow(existingRow);
  const product = getProduct(req.user.id, String(req.body?.productId || existing.productId));
  if (!product) return res.status(400).json({ error: 'Choose a product from your catalog.' });
  if (existing.status === 'received' && product.id !== existing.productId) {
    return res.status(409).json({ error: 'A received order can no longer be moved to another product.' });
  }
  const quantity = integer(req.body?.quantity ?? existing.quantity, 'Order quantity', { min: 1 });
  const status = ['draft', 'ordered', 'received'].includes(req.body?.status) ? req.body.status : existing.status;
  if (existing.status === 'received' && status !== 'received') {
    return res.status(409).json({ error: 'A received order is complete and cannot be reopened.' });
  }
  const supplier = String(req.body?.supplier ?? existing.supplier).trim().slice(0, 100);
  const expectedDate = String(req.body?.expectedDate ?? existing.expectedDate).slice(0, 10);
  const note = String(req.body?.note ?? existing.note).trim().slice(0, 180);
  const timestamp = nowIso();

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`UPDATE restocks SET product_id = ?, quantity = ?, supplier = ?, expected_date = ?, status = ?, note = ?, updated_at = ?
      WHERE id = ? AND user_id = ?`).run(
      product.id, quantity, supplier, expectedDate, status, note, timestamp, req.params.id, req.user.id,
    );
    if (status === 'received' && existing.status !== 'received') {
      db.prepare('UPDATE products SET quantity = quantity + ?, updated_at = ? WHERE id = ? AND user_id = ?')
        .run(quantity, timestamp, product.id, req.user.id);
      addMovement(req.user.id, product.id, 'restock', quantity, note || `Received order from ${supplier || 'supplier'}`);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return res.json({ restock: restockFromRow(getRestockRow(req.user.id, req.params.id)) });
});

app.delete('/api/restocks/:id', requireAuth, (req, res) => {
  const row = getRestockRow(req.user.id, req.params.id);
  if (!row) return res.status(404).json({ error: 'Purchase order not found.' });
  if (row.status === 'received') return res.status(409).json({ error: 'Received orders are kept in your history and cannot be deleted.' });
  db.prepare('DELETE FROM restocks WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  return res.json({ ok: true });
});

app.get('/api/movements', requireAuth, (req, res) => {
  const limit = Math.min(200, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
  return res.json({ movements: listMovements(req.user.id, limit) });
});

app.get('/api/products/export.csv', requireAuth, (req, res) => {
  const escapeCell = (value) => {
    let text = String(value ?? '');
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const products = listProducts(req.user.id);
  const rows = [
    ['Product', 'SKU', 'Category', 'Supplier', 'On hand', 'Reorder point', 'Unit cost', 'Stock value', 'Lead time (days)', 'Avg. sales / week', 'Location'],
    ...products.map((product) => [product.name, product.sku, product.category, product.supplier,
      product.quantity, product.reorderPoint, product.unitCost.toFixed(2), product.stockValue.toFixed(2),
      product.leadTimeDays, product.weeklySales, product.location]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(escapeCell).join(',')).join('\r\n')}`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="stockroom-products.csv"');
  return res.send(csv);
});

const distDirectory = path.join(root, 'dist');
if (existsSync(distDirectory)) app.use(express.static(distDirectory));
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
  if (existsSync(path.join(distDirectory, 'index.html'))) return res.sendFile(path.join(distDirectory, 'index.html'));
  return res.status(404).send('Stockroom frontend is not built yet. Run npm run build.');
});

app.use((error, _req, res, _next) => {
  console.error(error);
  if (res.headersSent) return;
  const status = Number(error.status) || 500;
  return res.status(status).json({ error: status >= 500 ? 'Something went wrong. Please try again.' : error.message });
});

const port = Number(process.env.PORT || process.env.API_PORT || 4174);
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Stockroom API listening on http://0.0.0.0:${port}`);
  if (process.env.DISABLE_DEMO !== 'true') {
    console.log(`Demo sign-in available (${DEMO_EMAIL} / ${DEMO_PASSWORD})`);
  }
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
