const bcrypt = require('bcryptjs');
const db = require('./db');

// ── Criar tabela de usuários ─────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator',
    created_at INTEGER NOT NULL
  );
`);

// ── Criar usuários iniciais (roda só se a tabela estiver vazia) ───────────────
const count = db.prepare('SELECT COUNT(*) as n FROM users').get().n;

if (count === 0) {
  const users = [
    { username: 'gustavo',   full_name: 'Gustavo',         role: 'admin',    pw: 'GO2@Gustavo24' },
    { username: 'pedro',     full_name: 'Pedro',           role: 'admin',    pw: 'GO2@Pedro24'   },
    { username: 'vinicius',  full_name: 'Vinicius',        role: 'admin',    pw: 'GO2@Vinicius24'},
    { username: 'operacoes', full_name: 'Time Operações',  role: 'operator', pw: 'GO2@Ops2024'   },
  ];

  const ins = db.prepare(`
    INSERT INTO users (username, password_hash, full_name, role, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  console.log('\n👤 Criando usuários iniciais:');
  for (const u of users) {
    const hash = bcrypt.hashSync(u.pw, 10);
    ins.run(u.username, hash, u.full_name, u.role, Date.now());
    console.log(`   ${u.username} / ${u.pw}  [${u.role}]`);
  }
  console.log('   ⚠️  Anote as senhas acima e altere após o primeiro acesso!\n');
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function findUser(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function validatePassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

function changePassword(userId, newPassword) {
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, userId);
}

function listUsers() {
  return db.prepare('SELECT id, username, full_name, role, created_at FROM users ORDER BY id').all();
}

function createUser({ username, full_name, role, password }) {
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (username, password_hash, full_name, role, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(username, hash, full_name, role || 'operator', Date.now());
}

// ── Middleware de proteção de rotas ──────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session?.user) return next();
  // API: retorna 401
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Não autenticado' });
  // Páginas: redireciona para login
  res.redirect('/login');
}

function requireAdmin(req, res, next) {
  if (req.session?.user?.role === 'admin') return next();
  res.status(403).json({ error: 'Acesso restrito a administradores' });
}

module.exports = { findUser, validatePassword, changePassword, listUsers, createUser, requireAuth, requireAdmin };
