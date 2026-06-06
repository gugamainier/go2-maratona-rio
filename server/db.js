const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');
const DB_PATH  = path.join(DATA_DIR, 'tracker.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    event_date TEXT DEFAULT '',
    location   TEXT DEFAULT '',
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS routes (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id        INTEGER REFERENCES events(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    color           TEXT DEFAULT '#3388ff',
    coordinates     TEXT NOT NULL,
    checkpoints     TEXT DEFAULT '[]',
    departure_times TEXT DEFAULT '[]',
    created_at      INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id             TEXT PRIMARY KEY,
    driver_name    TEXT NOT NULL,
    driver_phone   TEXT NOT NULL,
    route_id       INTEGER NOT NULL,
    departure_time TEXT DEFAULT '',
    status         TEXT DEFAULT 'active',
    last_seen      INTEGER,
    off_route      INTEGER DEFAULT 0,
    created_at     INTEGER NOT NULL,
    FOREIGN KEY (route_id) REFERENCES routes(id)
  );

  CREATE TABLE IF NOT EXISTS positions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    lat        REAL NOT NULL,
    lng        REAL NOT NULL,
    accuracy   REAL,
    speed      REAL,
    heading    REAL,
    timestamp  INTEGER NOT NULL,
    off_route  INTEGER DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_positions_session   ON positions(session_id);
  CREATE INDEX IF NOT EXISTS idx_positions_timestamp ON positions(timestamp);
  CREATE INDEX IF NOT EXISTS idx_routes_event        ON routes(event_id);
`);

// Migração: adicionar event_id e created_at se não existirem
try {
  db.exec(`ALTER TABLE routes ADD COLUMN event_id INTEGER REFERENCES events(id) ON DELETE CASCADE`);
} catch {}
try {
  db.exec(`ALTER TABLE routes ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0`);
} catch {}

module.exports = db;
