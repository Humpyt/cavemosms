require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = Number(process.env.PORT || 8081);
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const ADMIN_COOKIE = 'uglive_admin';
const DB_PATH = path.join(__dirname, 'data.json');

function nowIso() { return new Date().toISOString(); }

function loadDb() {
  if (!fs.existsSync(DB_PATH)) {
    const init = { users: [], licenses: [], auditLogs: [], counters: { user: 0, license: 0, log: 0 } };
    fs.writeFileSync(DB_PATH, JSON.stringify(init, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}

function saveDb(db) { fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2)); }

function nextId(db, key) { db.counters[key] += 1; return db.counters[key]; }

function logAction(db, actorUserId, action, meta = {}) {
  db.auditLogs.push({ id: nextId(db, 'log'), actorUserId: actorUserId || null, action, meta, createdAt: nowIso() });
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/assets', express.static(path.join(__dirname, 'public-site')));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

function signUserToken(user, license, deviceId) {
  return jwt.sign({ sub: user.id, role: user.role, licenseId: license.id, deviceId, email: user.email }, JWT_SECRET, { expiresIn: '12h' });
}

function requireAppAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try { req.auth = jwt.verify(token, JWT_SECRET); next(); } catch { return res.status(401).json({ error: 'Invalid token' }); }
}

function requireAdmin(req, res, next) {
  const token = req.cookies[ADMIN_COOKIE];
  if (!token) return res.redirect('/admin/login');
  try {
    const parsed = jwt.verify(token, JWT_SECRET);
    if (parsed.role !== 'admin') return res.redirect('/admin/login');
    req.admin = parsed;
    next();
  } catch { return res.redirect('/admin/login'); }
}

app.get('/', (_req, res) => {
  res.send(`<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>UG Live BulkSMS</title><style>body{margin:0;font-family:Inter,system-ui;background:linear-gradient(140deg,#091226,#0f1f3d 45%,#0f5132);color:#f4f8ff}.wrap{max-width:980px;margin:0 auto;padding:32px 20px}.card{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);border-radius:18px;padding:20px}.cta{display:flex;gap:10px;flex-wrap:wrap}.btn{padding:12px 16px;border-radius:12px;background:#2dd4bf;color:#062b2a;text-decoration:none;font-weight:700}.btn.alt{background:#e8eefc;color:#0c1d3d}ul{line-height:1.8}small{opacity:.8}</style></head><body><div class='wrap'><div class='card'><img src='/assets/uglive-logo.svg' style='height:72px'><h1>UG Live BulkSMS Pro</h1><p>Enterprise-grade Android bulk SMS platform with campaign controls, queue reliability, and delivery analytics.</p><div class='cta'><a class='btn' href='mailto:2humpyt@gmail.com'>Email to Buy</a><a class='btn alt' href='tel:+254787022105'>Call 0787 022 105</a><a class='btn alt' href='https://wa.me/254787022105' target='_blank'>WhatsApp</a></div></div><div class='card' style='margin-top:14px'><h3>What You Get</h3><ul><li>Fast contact import, grouping, and segmentation</li><li>Native Android SMS dispatch engine</li><li>Retry queue + delivery tracking</li><li>Licensed access for paying customers only</li></ul><small>uglive.io</small></div></div></body></html>`);
});

app.post('/api/activate', (req, res) => {
  const { email, password, deviceId, deviceName } = req.body;
  if (!email || !password || !deviceId) return res.status(400).json({ error: 'email, password, and deviceId are required' });

  const db = loadDb();
  const user = db.users.find((u) => u.email === String(email).toLowerCase());
  if (!user || !bcrypt.compareSync(String(password), user.passwordHash)) return res.status(401).json({ error: 'Invalid credentials' });

  const license = [...db.licenses].reverse().find((l) => l.userId === user.id && l.status === 'active');
  if (!license) return res.status(403).json({ error: 'No active license' });
  if (license.expiresAt && new Date(license.expiresAt).getTime() < Date.now()) return res.status(403).json({ error: 'License expired' });
  if (license.deviceId && license.deviceId !== deviceId) return res.status(409).json({ error: 'License already bound to another device' });

  license.deviceId = deviceId;
  license.deviceName = deviceName || null;
  license.lastSeenAt = nowIso();
  license.updatedAt = nowIso();
  logAction(db, user.id, 'app_activate', { deviceId, licenseId: license.id });
  saveDb(db);

  const token = signUserToken(user, license, deviceId);
  res.json({ token, license: { key: license.licenseKey, status: license.status, expiresAt: license.expiresAt, deviceId: license.deviceId }, user: { id: user.id, email: user.email, name: user.name } });
});

app.get('/api/license/status', requireAppAuth, (req, res) => {
  const db = loadDb();
  const auth = req.auth;
  const license = db.licenses.find((l) => l.id === auth.licenseId);
  if (!license || license.status !== 'active') return res.status(403).json({ ok: false, reason: 'inactive' });
  if (license.expiresAt && new Date(license.expiresAt).getTime() < Date.now()) return res.status(403).json({ ok: false, reason: 'expired' });
  if (license.deviceId !== auth.deviceId) return res.status(403).json({ ok: false, reason: 'device_mismatch' });
  license.lastSeenAt = nowIso();
  license.updatedAt = nowIso();
  saveDb(db);
  res.json({ ok: true, license: { status: license.status, expiresAt: license.expiresAt } });
});

app.post('/api/license/heartbeat', requireAppAuth, (req, res) => {
  const db = loadDb();
  const license = db.licenses.find((l) => l.id === req.auth.licenseId);
  if (license) { license.lastSeenAt = nowIso(); license.updatedAt = nowIso(); saveDb(db); }
  res.json({ ok: true });
});

app.get('/admin/login', (_req, res) => {
  res.send(`<!doctype html><html><body style='font-family:Inter;padding:28px'><h2>UG Live Admin Login</h2><form method='post' action='/admin/login'><input name='email' type='email' placeholder='Email' required/><br/><br/><input name='password' type='password' placeholder='Password' required/><br/><br/><button type='submit'>Login</button></form></body></html>`);
});

app.post('/admin/login', (req, res) => {
  const db = loadDb();
  const { email, password } = req.body;
  const user = db.users.find((u) => u.email === String(email).toLowerCase() && u.role === 'admin');
  if (!user || !bcrypt.compareSync(String(password), user.passwordHash)) return res.status(401).send('Invalid credentials');
  const token = jwt.sign({ sub: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '8h' });
  res.cookie(ADMIN_COOKIE, token, { httpOnly: true, sameSite: 'lax' });
  res.redirect('/admin');
});

app.post('/admin/logout', (_req, res) => { res.clearCookie(ADMIN_COOKIE); res.redirect('/admin/login'); });

app.get('/admin', requireAdmin, (req, res) => {
  const db = loadDb();
  const customers = db.users.filter((u) => u.role === 'customer');
  const usersById = Object.fromEntries(db.users.map((u) => [u.id, u]));
  const userOptions = customers.map((u) => `<option value='${u.id}'>${u.name} (${u.email})</option>`).join('');

  res.send(`<!doctype html><html><body style='font-family:Inter;padding:24px'><h2>UG Live Admin</h2><form method='post' action='/admin/logout'><button>Logout</button></form><h3>Create Customer</h3><form method='post' action='/admin/customers'><input name='name' placeholder='Name' required/><input name='email' placeholder='Email' required type='email'/><input name='password' placeholder='Temp Password' required/><button>Create</button></form><h3>Create License</h3><form method='post' action='/admin/licenses'><select name='userId' required>${userOptions}</select><input name='days' type='number' min='1' value='365' required/><input name='notes' placeholder='Notes'/><button>Create License</button></form><h3>Licenses</h3><table border='1' cellpadding='8' cellspacing='0'><tr><th>User</th><th>Key</th><th>Status</th><th>Device</th><th>Expires</th><th>Actions</th></tr>${db.licenses.slice().reverse().map((l)=>{const u=usersById[l.userId];return `<tr><td>${u?.name||'-'} (${u?.email||'-'})</td><td>${l.licenseKey}</td><td>${l.status}</td><td>${l.deviceId||'-'}</td><td>${l.expiresAt||'-'}</td><td><form style='display:inline' method='post' action='/admin/licenses/${l.id}/reset-device'><button>Reset Device</button></form> <form style='display:inline' method='post' action='/admin/licenses/${l.id}/toggle'><button>${l.status === 'active' ? 'Revoke' : 'Activate'}</button></form></td></tr>`;}).join('')}</table></body></html>`);
});

app.post('/admin/customers', requireAdmin, (req, res) => {
  const db = loadDb();
  const { name, email, password } = req.body;
  const e = String(email).toLowerCase();
  if (db.users.find((u) => u.email === e)) return res.status(409).send('Email already exists');
  db.users.push({ id: nextId(db, 'user'), name: String(name), email: e, passwordHash: bcrypt.hashSync(String(password), 10), role: 'customer', createdAt: nowIso() });
  logAction(db, req.admin.sub, 'create_customer', { email: e });
  saveDb(db);
  res.redirect('/admin');
});

app.post('/admin/licenses', requireAdmin, (req, res) => {
  const db = loadDb();
  const userId = Number(req.body.userId);
  const days = Number(req.body.days || 365);
  const makeChunk = () => crypto.randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
  const key = `UG-${makeChunk()}-${makeChunk()}`;
  db.licenses.push({ id: nextId(db, 'license'), licenseKey: key, userId, status: 'active', deviceId: null, deviceName: null, expiresAt: new Date(Date.now()+days*86400000).toISOString(), notes: req.body.notes ? String(req.body.notes) : null, lastSeenAt: null, createdAt: nowIso(), updatedAt: nowIso() });
  logAction(db, req.admin.sub, 'create_license', { userId, key, days });
  saveDb(db);
  res.redirect('/admin');
});

app.post('/admin/licenses/:id/reset-device', requireAdmin, (req, res) => {
  const db = loadDb();
  const id = Number(req.params.id);
  const lic = db.licenses.find((l) => l.id === id);
  if (lic) { lic.deviceId = null; lic.deviceName = null; lic.updatedAt = nowIso(); }
  logAction(db, req.admin.sub, 'reset_device', { licenseId: id });
  saveDb(db);
  res.redirect('/admin');
});

app.post('/admin/licenses/:id/toggle', requireAdmin, (req, res) => {
  const db = loadDb();
  const id = Number(req.params.id);
  const lic = db.licenses.find((l) => l.id === id);
  if (lic) { lic.status = lic.status === 'active' ? 'revoked' : 'active'; lic.updatedAt = nowIso(); }
  logAction(db, req.admin.sub, 'toggle_license', { licenseId: id, status: lic?.status });
  saveDb(db);
  res.redirect('/admin');
});

app.listen(PORT, () => {
  console.log(`UG Live licensing platform listening on :${PORT}`);
});
