const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'data.json');

function initDb() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(
      DB_PATH,
      JSON.stringify({ users: [], licenses: [], auditLogs: [], counters: { user: 0, license: 0, log: 0 } }, null, 2)
    );
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}

const db = initDb();
const email = (process.env.ADMIN_EMAIL || '2humpyt@gmail.com').toLowerCase();
const password = process.env.ADMIN_PASSWORD || 'ChangeMeNow#2026';
const name = process.env.ADMIN_NAME || 'UG Live Admin';

if (db.users.find((u) => u.email === email)) {
  console.log('Admin already exists:', email);
  process.exit(0);
}

db.counters.user += 1;
db.users.push({
  id: db.counters.user,
  email,
  name,
  passwordHash: bcrypt.hashSync(password, 10),
  role: 'admin',
  createdAt: new Date().toISOString(),
});

fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
console.log('Admin created');
console.log('email:', email);
console.log('password:', password);
