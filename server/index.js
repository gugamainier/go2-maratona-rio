const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const db = require('./db');
const auth = require('./auth');
require('./auto-seed'); // insere as 5 rotas se a tabela estiver vazia

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.set('trust proxy', 1); // Railway fica atrás de proxy reverso
app.use(cors());
app.use(express.json());

// ── Config ───────────────────────────────────────────────────────────────────
const OFFLINE_THRESHOLD_MS  = parseInt(process.env.OFFLINE_THRESHOLD_MS  || '15000');
const OFF_ROUTE_THRESHOLD_M = parseInt(process.env.OFF_ROUTE_THRESHOLD_M || '200');
const PORT = parseInt(process.env.PORT || '3000');
const SESSION_SECRET = process.env.SESSION_SECRET || 'go2-maratona-rio-secret-2024';

// ── Sessions ─────────────────────────────────────────────────────────────────
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');
const fs = require('fs');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: DATA_DIR }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 12 * 60 * 60 * 1000, // 12 horas
  },
}));

// ── Rotas públicas (sem auth) ─────────────────────────────────────────────────
// Página do motorista (acessada via QR Code no celular)
app.use('/driver', express.static(path.join(__dirname, '../client/driver')));

// Página de login
app.use('/login', express.static(path.join(__dirname, '../client/login')));
app.get('/login', (req, res) => {
  if (req.session?.user) return res.redirect('/panel/');
  res.sendFile(path.join(__dirname, '../client/login/index.html'));
});

// ── Auth endpoints ────────────────────────────────────────────────────────────
app.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Preencha usuário e senha.' });

  const user = auth.findUser(username.toLowerCase().trim());
  if (!user || !auth.validatePassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
  }

  req.session.user = { id: user.id, username: user.username, full_name: user.full_name, role: user.role };
  res.json({ ok: true, redirect: '/panel/' });
});

app.post('/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/auth/me', (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: 'Não autenticado' });
  res.json(req.session.user);
});

app.post('/auth/change-password', auth.requireAuth, (req, res) => {
  const { current_password, new_password } = req.body;
  const user = auth.findUser(req.session.user.username);
  if (!auth.validatePassword(current_password, user.password_hash)) {
    return res.status(400).json({ error: 'Senha atual incorreta.' });
  }
  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ error: 'Nova senha deve ter pelo menos 6 caracteres.' });
  }
  auth.changePassword(user.id, new_password);
  res.json({ ok: true });
});

// ── Painel (protegido) ────────────────────────────────────────────────────────
app.use('/panel', (req, res, next) => {
  if (!req.session?.user) return res.redirect('/login');
  next();
}, express.static(path.join(__dirname, '../client/panel/dist')));

// ── Raiz → login ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  if (req.session?.user) return res.redirect('/panel/');
  res.redirect('/login');
});

// ── API pública (driver usa essas rotas sem login) ────────────────────────────
app.get('/api/routes', (req, res) => {
  const rows = db.prepare('SELECT * FROM routes').all();
  res.json(rows.map(parseRoute));
});

app.get('/api/routes/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM routes WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Rota não encontrada' });
  res.json(parseRoute(row));
});

app.post('/api/sessions', (req, res) => {
  const { driver_name, driver_phone, route_id, departure_time } = req.body;
  if (!driver_name || !driver_phone || !route_id)
    return res.status(400).json({ error: 'Campos obrigatórios: driver_name, driver_phone, route_id' });

  const route = db.prepare('SELECT id FROM routes WHERE id = ?').get(route_id);
  if (!route) return res.status(404).json({ error: 'Rota não encontrada' });

  const id = uuidv4();
  const now = Date.now();
  db.prepare(`INSERT INTO sessions (id, driver_name, driver_phone, route_id, departure_time, status, last_seen, created_at)
    VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`)
    .run(id, driver_name.trim(), driver_phone.trim(), route_id, departure_time || '', now, now);

  res.json({ session_id: id, route_id });
});

// ── API protegida (requer login) ──────────────────────────────────────────────
app.use('/api', auth.requireAuth);

app.get('/api/sessions', (req, res) => {
  const rows = db.prepare(`
    SELECT s.*, r.name AS route_name, r.color, r.coordinates, r.checkpoints
    FROM sessions s JOIN routes r ON s.route_id = r.id
    WHERE s.status != 'completed'
    ORDER BY s.created_at DESC
  `).all();
  res.json(rows.map(s => ({
    ...s,
    coordinates: JSON.parse(s.coordinates),
    checkpoints: JSON.parse(s.checkpoints || '[]'),
  })));
});

app.get('/api/sessions/all', (req, res) => {
  const rows = db.prepare(`
    SELECT s.id, s.driver_name, s.driver_phone, s.departure_time, s.status, s.created_at,
           r.name AS route_name, r.color
    FROM sessions s JOIN routes r ON s.route_id = r.id
    ORDER BY s.created_at DESC LIMIT 200
  `).all();
  res.json(rows);
});

app.get('/api/history/:sessionId', (req, res) => {
  const positions = db.prepare(
    'SELECT * FROM positions WHERE session_id = ? ORDER BY timestamp ASC'
  ).all(req.params.sessionId);
  res.json(positions);
});

app.get('/api/qr/:routeId', async (req, res) => {
  const row = db.prepare('SELECT * FROM routes WHERE id = ?').get(req.params.routeId);
  if (!row) return res.status(404).json({ error: 'Rota não encontrada' });

  const proto = req.get('x-forwarded-proto') || req.protocol;
  const host  = req.get('x-forwarded-host') || req.get('host');
  const url   = `${proto}://${host}/driver/?rota=${req.params.routeId}`;

  try {
    const qr = await QRCode.toDataURL(url, { width: 400, margin: 2 });
    res.json({ qr, url, route_name: row.name });
  } catch {
    res.status(500).json({ error: 'Erro ao gerar QR Code' });
  }
});

app.get('/api/config', (req, res) => {
  res.json({ offline_threshold_ms: OFFLINE_THRESHOLD_MS, off_route_threshold_m: OFF_ROUTE_THRESHOLD_M });
});

// Gerenciar usuários (apenas admin)
app.get('/api/users', auth.requireAdmin, (req, res) => {
  res.json(auth.listUsers());
});

app.post('/api/users', auth.requireAdmin, (req, res) => {
  const { username, full_name, role, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username e password obrigatórios' });
  try {
    auth.createUser({ username, full_name, role, password });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: 'Usuário já existe ou dados inválidos.' });
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseRoute(r) {
  return {
    ...r,
    coordinates: JSON.parse(r.coordinates),
    checkpoints: JSON.parse(r.checkpoints || '[]'),
    departure_times: JSON.parse(r.departure_times || '[]'),
  };
}

// ── Geo utils ─────────────────────────────────────────────────────────────────
function toRad(deg) { return deg * Math.PI / 180; }

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function pointToSegmentDist(plat, plng, alat, alng, blat, blng) {
  const dx = blat - alat, dy = blng - alng;
  if (dx === 0 && dy === 0) return haversineM(plat, plng, alat, alng);
  const t = Math.max(0, Math.min(1, ((plat-alat)*dx + (plng-alng)*dy) / (dx*dx + dy*dy)));
  return haversineM(plat, plng, alat + t*dx, alng + t*dy);
}

function distToRoute(lat, lng, coords) {
  let min = Infinity;
  for (let i = 0; i < coords.length - 1; i++) {
    const d = pointToSegmentDist(lat, lng, coords[i][0], coords[i][1], coords[i+1][0], coords[i+1][1]);
    if (d < min) min = d;
  }
  return min;
}

// ── Socket.IO ─────────────────────────────────────────────────────────────────
const cache = new Map();

io.on('connection', (socket) => {

  socket.on('driver:join', ({ session_id }) => {
    const row = db.prepare(`
      SELECT s.*, r.name AS route_name, r.color, r.coordinates, r.checkpoints
      FROM sessions s JOIN routes r ON s.route_id = r.id WHERE s.id = ?
    `).get(session_id);
    if (!row) { socket.emit('error', { message: 'Sessão inválida' }); return; }

    socket.join(`session:${session_id}`);
    socket.data = { role: 'driver', session_id };

    const coords = JSON.parse(row.coordinates);
    if (!cache.has(session_id)) {
      cache.set(session_id, { coords, lastPos: null, driverName: row.driver_name, routeName: row.route_name });
    }

    db.prepare('UPDATE sessions SET status = ?, last_seen = ? WHERE id = ?').run('active', Date.now(), session_id);
    io.to('panel').emit('session:update', { session_id, status: 'active' });
    socket.emit('driver:joined', { session_id, driver_name: row.driver_name, route_name: row.route_name, departure_time: row.departure_time });
  });

  socket.on('driver:position', ({ session_id, lat, lng, accuracy, speed, heading }) => {
    const entry = cache.get(session_id);
    if (!entry) return;
    const now = Date.now();
    const dist = distToRoute(lat, lng, entry.coords);
    const offRoute = dist > OFF_ROUTE_THRESHOLD_M;

    db.prepare(`INSERT INTO positions (session_id, lat, lng, accuracy, speed, heading, timestamp, off_route) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(session_id, lat, lng, accuracy ?? null, speed ?? null, heading ?? null, now, offRoute ? 1 : 0);
    db.prepare('UPDATE sessions SET last_seen = ?, off_route = ?, status = ? WHERE id = ?').run(now, offRoute ? 1 : 0, 'active', session_id);

    const pos = { session_id, lat, lng, accuracy, speed, heading, timestamp: now, off_route: offRoute, dist_to_route: Math.round(dist) };
    entry.lastPos = pos;
    io.to('panel').emit('position:update', pos);
    socket.emit('driver:off_route', { off_route: offRoute, dist: Math.round(dist) });

    if (offRoute) {
      io.to('panel').emit('alert:off_route', {
        session_id, driver_name: entry.driverName, route_name: entry.routeName,
        lat, lng, timestamp: now, dist: Math.round(dist),
      });
    }
  });

  socket.on('panel:join', () => {
    socket.join('panel');
    socket.data = { role: 'panel' };
    const rows = db.prepare(`
      SELECT s.*, r.name AS route_name, r.color, r.coordinates, r.checkpoints
      FROM sessions s JOIN routes r ON s.route_id = r.id WHERE s.status != 'completed'
    `).all();
    socket.emit('panel:state', rows.map(s => ({
      ...s,
      coordinates: JSON.parse(s.coordinates),
      checkpoints: JSON.parse(s.checkpoints || '[]'),
      lastPos: cache.get(s.id)?.lastPos ?? null,
    })));
  });

  socket.on('disconnect', () => {
    if (socket.data?.role === 'driver' && socket.data.session_id) {
      const sid = socket.data.session_id;
      db.prepare('UPDATE sessions SET status = ? WHERE id = ?').run('offline', sid);
      io.to('panel').emit('session:update', { session_id: sid, status: 'offline' });
    }
  });
});

// ── Offline heartbeat ─────────────────────────────────────────────────────────
setInterval(() => {
  const cutoff = Date.now() - OFFLINE_THRESHOLD_MS;
  const stale = db.prepare("SELECT id FROM sessions WHERE status = 'active' AND last_seen < ?").all(cutoff);
  for (const { id } of stale) {
    db.prepare('UPDATE sessions SET status = ? WHERE id = ?').run('offline', id);
    io.to('panel').emit('session:update', { session_id: id, status: 'offline' });
  }
}, 5000);

// ── Start ─────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🚗  GO2 Maratona do Rio — Transport Tracker`);
  console.log(`    URL: http://localhost:${PORT}`);
  console.log(`    Painel:    /panel/`);
  console.log(`    Login:     /login`);
  console.log(`    Motorista: /driver/?rota=1\n`);
});
