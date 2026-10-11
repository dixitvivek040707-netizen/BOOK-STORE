'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const DB = path.join(DATA_DIR, 'store.json');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1'; // local-only by default; set HOST=0.0.0.0 only when intentionally exposing it
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const sessions = new Map();
const rateBuckets = new Map();
const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.ico':'image/x-icon', '.txt':'text/plain; charset=utf-8' };

function readDB() { return JSON.parse(fs.readFileSync(DB, 'utf8')); }
function writeDB(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const temp = DB + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.renameSync(temp, DB);
}
function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Cache-Control', 'no-store');
  if (IS_PRODUCTION) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}
function send(res, status, data, extraHeaders = {}) {
  res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', ...extraHeaders });
  res.end(JSON.stringify(data));
}
function getClientKey(req) { return req.socket.remoteAddress || 'unknown'; }
function rateLimit(req, res, bucketName, limit, windowMs) {
  const now = Date.now();
  const key = `${bucketName}:${getClientKey(req)}`;
  let entry = rateBuckets.get(key);
  if (!entry || now >= entry.resetAt) entry = { count: 0, resetAt: now + windowMs };
  entry.count++;
  rateBuckets.set(key, entry);
  if (rateBuckets.size > 5000) for (const [k, v] of rateBuckets) if (now >= v.resetAt) rateBuckets.delete(k);
  if (entry.count > limit) {
    send(res, 429, { error: 'Too many requests. Please try again later.' }, { 'Retry-After': String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))) });
    return false;
  }
  return true;
}
function safeEqual(a, b) {
  const aa = Buffer.from(String(a)); const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }
  return out;
}
function getSession(req) {
  const token = parseCookies(req.headers.cookie).enginuity_admin;
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) { sessions.delete(token); return null; }
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  return { token, session };
}
function requireSameOrigin(req, res) {
  const origin = req.headers.origin;
  if (!origin) return true; // non-browser clients may omit Origin; admin uses same-site cookies
  let expected;
  try { expected = new URL(`http://${req.headers.host || 'localhost'}`).host; } catch { return false; }
  let supplied;
  try { supplied = new URL(origin).host; } catch { supplied = ''; }
  if (supplied.toLowerCase() !== expected.toLowerCase()) {
    send(res, 403, { error: 'Cross-origin request blocked.' });
    return false;
  }
  return true;
}
function body(req) {
  return new Promise((resolve, reject) => {
    let raw = ''; let tooLarge = false;
    req.on('data', chunk => {
      if (tooLarge) return;
      raw += chunk.toString('utf8');
      if (Buffer.byteLength(raw) > 32 * 1024) { tooLarge = true; reject(Object.assign(new Error('Request body too large.'), { statusCode: 413 })); }
    });
    req.on('end', () => {
      if (tooLarge) return;
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(Object.assign(new Error('Invalid JSON body.'), { statusCode: 400 })); }
    });
    req.on('error', reject);
  });
}
function validText(value, max) { return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max; }
function validEmail(value) { return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()); }
function adminConfigured() { return ADMIN_PASSWORD.length >= 14; }

const server = http.createServer(async (req, res) => {
  securityHeaders(res);
  let url;
  try { url = new URL(req.url, `http://${req.headers.host || 'localhost'}`); }
  catch { return send(res, 400, { error: 'Invalid request URL.' }); }

  if (req.method === 'OPTIONS') return send(res, 405, { error: 'Method not allowed.' }, { 'Allow': 'GET, POST, HEAD' });
  if (req.method === 'TRACE' || req.method === 'CONNECT') return send(res, 405, { error: 'Method not allowed.' });

  try {
    if (url.pathname.startsWith('/api/')) {
      if (req.method === 'POST' && !requireSameOrigin(req, res)) return;
      if (req.method === 'POST' && !/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) return send(res, 415, { error: 'Content-Type must be application/json.' });

      if (url.pathname === '/api/health' && req.method === 'GET') return send(res, 200, { status: 'ok', service: 'Enginuity Bookstore API' });

      if (url.pathname === '/api/books' && req.method === 'GET') {
        if (!rateLimit(req, res, 'books', 120, 60_000)) return;
        const db = readDB(); let books = db.books;
        const q = (url.searchParams.get('q') || '').slice(0, 100).toLowerCase().trim();
        const branch = (url.searchParams.get('branch') || 'All branches').slice(0, 40);
        const year = (url.searchParams.get('year') || 'All years').slice(0, 30);
        const sort = (url.searchParams.get('sort') || 'featured').slice(0, 20);
        if (q) books = books.filter(b => [b.title, b.author, b.branch, b.description, ...b.tags].join(' ').toLowerCase().includes(q));
        if (branch !== 'All branches') books = books.filter(b => b.branch === branch || (branch === 'ECE' && b.branch === 'ECE / EEE') || (branch === 'Electrical' && b.branch === 'ECE / EEE') || (branch === 'CSE / IT' && b.branch === 'Common'));
        if (year !== 'All years') books = books.filter(b => b.year === year || b.year === 'All years');
        if (sort === 'price-low') books.sort((a,b) => a.price-b.price);
        if (sort === 'price-high') books.sort((a,b) => b.price-a.price);
        if (sort === 'title') books.sort((a,b) => a.title.localeCompare(b.title));
        return send(res, 200, { books, total: books.length });
      }

      if (url.pathname === '/api/newsletter' && req.method === 'POST') {
        if (!rateLimit(req, res, 'newsletter', 5, 60 * 60_000)) return;
        const input = await body(req);
        const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
        if (!validEmail(email)) return send(res, 400, { error: 'Enter a valid email address.' });
        const db = readDB();
        if (!Array.isArray(db.newsletterSubscribers)) db.newsletterSubscribers = [];
        if (!db.newsletterSubscribers.some(item => item.email === email)) {
          db.newsletterSubscribers.push({ email, subscribedAt: new Date().toISOString() });
          writeDB(db);
        }
        return send(res, 200, { message: 'Thanks. Your email has been saved for bookstore updates.' });
      }

      if (url.pathname === '/api/orders/track' && req.method === 'POST') {
        if (!rateLimit(req, res, 'order-track', 12, 15 * 60_000)) return;
        const input = await body(req);
        const orderId = typeof input.orderId === 'string' ? input.orderId.trim().toUpperCase() : '';
        const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
        if (!/^ENG-[A-F0-9]{16}$/.test(orderId) || !validEmail(email)) return send(res, 400, { error: 'Enter a valid order ID and the email used at checkout.' });
        const order = readDB().orders.find(o => o.id === orderId && o.customer.email === email);
        if (!order) return send(res, 404, { error: 'We could not find an order with those details. Check the order ID and checkout email.' });
        return send(res, 200, { order: { id: order.id, createdAt: order.createdAt, items: order.items, total: order.total, status: order.status } });
      }

      if (url.pathname === '/api/orders' && req.method === 'POST') {
        if (!rateLimit(req, res, 'checkout', 10, 15 * 60_000)) return;
        const input = await body(req);
        if (!input || !Array.isArray(input.items) || input.items.length < 1 || input.items.length > 30) return send(res, 400, { error: 'Cart must contain between 1 and 30 items.' });
        const c = input.customer || {};
        if (!validText(c.name, 100) || !validEmail(c.email) || !validText(c.address, 500)) return send(res, 400, { error: 'Please provide a name, valid email and delivery address within the allowed lengths.' });
        let sharedLocation = null;
        if (input.location !== undefined && input.location !== null) {
          const loc = input.location;
          if (!loc || typeof loc !== 'object' || !Number.isFinite(loc.latitude) || !Number.isFinite(loc.longitude) || loc.latitude < -90 || loc.latitude > 90 || loc.longitude < -180 || loc.longitude > 180) return send(res, 400, { error: 'Shared location coordinates are invalid.' });
          sharedLocation = { latitude: Number(loc.latitude.toFixed(6)), longitude: Number(loc.longitude.toFixed(6)), accuracy: Number.isFinite(loc.accuracy) ? Math.max(0, Math.min(100000, Math.round(loc.accuracy))) : null, sharedAt: new Date().toISOString() };
        }
        const db = readDB(); const lines = []; let total = 0; const seen = new Set();
        for (const item of input.items) {
          const book = db.books.find(b => b.id === item.id);
          const qty = Number(item.quantity);
          if (!book || !Number.isSafeInteger(qty) || qty < 1 || qty > 20 || seen.has(book.id)) return send(res, 400, { error: 'One or more cart items are invalid.' });
          seen.add(book.id); lines.push({ id: book.id, title: book.title, price: book.price, quantity: qty }); total += book.price * qty;
          if (!Number.isSafeInteger(total) || total > 10_000_000) return send(res, 400, { error: 'Order total exceeds the allowed limit.' });
        }
        const order = { id: 'ENG-' + crypto.randomBytes(8).toString('hex').toUpperCase(), createdAt: new Date().toISOString(), customer: { name: c.name.trim(), email: c.email.trim().toLowerCase(), address: c.address.trim() }, location: sharedLocation, items: lines, total, status: 'Received' };
        db.orders.unshift(order); writeDB(db);
        return send(res, 201, { message: 'Order placed successfully.', order: { id: order.id, createdAt: order.createdAt, items: order.items, total: order.total, status: order.status } });
      }

      if (url.pathname === '/api/admin/login' && req.method === 'POST') {
        if (!rateLimit(req, res, 'admin-login', 5, 15 * 60_000)) return;
        if (!adminConfigured()) return send(res, 503, { error: 'Admin login is disabled. Set ADMIN_PASSWORD to a strong password of at least 14 characters.' });
        const input = await body(req);
        if (!safeEqual(input.password || '', ADMIN_PASSWORD)) return send(res, 401, { error: 'Invalid credentials.' });
        const token = crypto.randomBytes(32).toString('hex');
        sessions.set(token, { createdAt: Date.now(), expiresAt: Date.now() + SESSION_TTL_MS });
        return send(res, 200, { message: 'Admin session created.' }, { 'Set-Cookie': `enginuity_admin=${token}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=28800${IS_PRODUCTION ? '; Secure' : ''}` });
      }

      if (url.pathname.startsWith('/api/admin/')) {
        const active = getSession(req);
        if (!active) return send(res, 401, { error: 'Admin authentication required.' });
        if (url.pathname === '/api/admin/session' && req.method === 'GET') return send(res, 200, { authenticated: true });
        if (url.pathname === '/api/admin/orders' && req.method === 'GET') {
          if (!rateLimit(req, res, 'admin-orders', 60, 60_000)) return;
          return send(res, 200, { orders: readDB().orders });
        }
        if (url.pathname === '/api/admin/orders/status' && req.method === 'POST') {
          if (!requireSameOrigin(req, res)) return;
          if (!rateLimit(req, res, 'admin-status', 30, 60_000)) return;
          const input = await body(req);
          const allowed = ['Received', 'Confirmed', 'Packed', 'Shipped', 'Out for delivery', 'Delivered', 'Cancelled'];
          if (typeof input.orderId !== 'string' || !allowed.includes(input.status)) return send(res, 400, { error: 'Provide an order ID and a valid status.' });
          const db = readDB();
          const order = db.orders.find(o => o.id === input.orderId.trim().toUpperCase());
          if (!order) return send(res, 404, { error: 'Order not found.' });
          order.status = input.status;
          order.updatedAt = new Date().toISOString();
          writeDB(db);
          return send(res, 200, { message: 'Order status updated.', order: { id: order.id, status: order.status, updatedAt: order.updatedAt } });
        }
        if (url.pathname === '/api/admin/logout' && req.method === 'POST') {
          sessions.delete(active.token);
          return send(res, 200, { message: 'Logged out.' }, { 'Set-Cookie': `enginuity_admin=; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=0${IS_PRODUCTION ? '; Secure' : ''}` });
        }
        return send(res, 404, { error: 'Admin route not found.' });
      }

      return send(res, 404, { error: 'API route not found.' });
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Method not allowed.' }, { 'Allow': 'GET, HEAD' });
    let requested;
    try { requested = decodeURIComponent(url.pathname); } catch { return send(res, 400, { error: 'Invalid path.' }); }
    if (requested === '/') requested = '/index.html';
    const target = path.resolve(PUBLIC, '.' + requested);
    if (!target.startsWith(PUBLIC + path.sep)) return send(res, 403, { error: 'Forbidden.' });
    fs.stat(target, (statErr, stat) => {
      if (statErr || !stat.isFile()) return send(res, 404, { error: 'File not found.' });
      fs.readFile(target, (err, content) => {
        if (err) return send(res, 500, { error: 'Could not read file.' });
        res.writeHead(200, { 'Content-Type': MIME[path.extname(target)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
        if (req.method === 'HEAD') return res.end();
        res.end(content);
      });
    });
  } catch (err) {
    if (res.headersSent) return;
    if (err.statusCode === 413) return send(res, 413, { error: 'Request body is too large.' });
    if (err.statusCode === 400) return send(res, 400, { error: 'Invalid JSON request.' });
    console.error('Request failed:', err.message);
    return send(res, 500, { error: 'Something went wrong on the server.' });
  }
});
server.requestTimeout = 15_000;
server.headersTimeout = 20_000;
server.keepAliveTimeout = 5_000;
server.listen(PORT, HOST, () => console.log(`Enginuity Books backend running at http://${HOST}:${PORT}\nHealth check: http://localhost:${PORT}/api/health`));
