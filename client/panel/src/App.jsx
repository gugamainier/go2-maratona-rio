import { useState, useEffect, useRef, useCallback } from 'react';
import socket from './socket.js';
import MapView from './components/MapView.jsx';
import CarList from './components/CarList.jsx';
import AlertBanner from './components/AlertBanner.jsx';
import QRManager from './components/QRManager.jsx';
import HistoryView from './components/HistoryView.jsx';
import EventsManager from './components/EventsManager.jsx';

function playAlert() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach(offset => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.2);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.2);
    });
  } catch {}
}

export default function App() {
  const [tab, setTab]   = useState('map');
  const [events, setEvents]   = useState([]);
  const [allRoutes, setAllRoutes] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(''); // '' = nenhum selecionado

  const [sessions, setSessions]   = useState([]);
  const [positions, setPositions] = useState({});
  const [alert, setAlert]         = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const alertTimeout = useRef(null);

  // ── Carregar dados ──────────────────────────────────────────────────────
  const reload = useCallback(() => {
    fetch('/api/events').then(r => r.json()).then(setEvents).catch(() => {});
    fetch('/api/routes').then(r => r.json()).then(setAllRoutes).catch(() => {});
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // ── Rotas e sessões filtradas pelo evento ───────────────────────────────
  const routes = selectedEventId
    ? allRoutes.filter(r => String(r.event_id) === selectedEventId)
    : [];

  // ── Socket ──────────────────────────────────────────────────────────────
  const updateSession = useCallback((id, patch) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }, []);

  useEffect(() => {
    socket.emit('panel:join');
    socket.on('panel:state', (state) => {
      setSessions(state);
      const pos = {};
      state.forEach(s => { if (s.lastPos) pos[s.id] = s.lastPos; });
      setPositions(pos);
    });
    socket.on('position:update', (pos) => {
      setPositions(prev => ({ ...prev, [pos.session_id]: pos }));
      updateSession(pos.session_id, { off_route: pos.off_route ? 1 : 0, status: 'active' });
    });
    socket.on('session:update', ({ session_id, status }) => updateSession(session_id, { status }));
    socket.on('alert:off_route', (data) => {
      setAlert(data);
      playAlert();
      if (alertTimeout.current) clearTimeout(alertTimeout.current);
      alertTimeout.current = setTimeout(() => setAlert(null), 12000);
    });
    return () => {
      socket.off('panel:state');
      socket.off('position:update');
      socket.off('session:update');
      socket.off('alert:off_route');
    };
  }, [updateSession]);

  const sessionsWithPos = sessions.map(s => ({
    ...s,
    lastPos: positions[s.id] ?? s.lastPos ?? null,
  }));

  // Filtra sessões pelo evento (só se tiver evento selecionado)
  const filteredSessions = selectedEventId
    ? sessionsWithPos.filter(s => {
        const route = allRoutes.find(r => r.id === s.route_id);
        return route && String(route.event_id) === selectedEventId;
      })
    : sessionsWithPos;

  // ── Seletor de evento compartilhado ─────────────────────────────────────
  const selectedEvent = events.find(e => String(e.id) === selectedEventId);

  const EventSelector = ({ compact = false }) => (
    <div className="event-selector">
      {!compact && <label>📅 Evento</label>}
      <select
        value={selectedEventId}
        onChange={e => setSelectedEventId(e.target.value)}
        className="event-selector-select"
      >
        <option value="">— Selecione um evento —</option>
        {events.map(e => (
          <option key={e.id} value={String(e.id)}>
            {e.name}{e.event_date ? ` · ${e.event_date}` : ''}
          </option>
        ))}
      </select>
    </div>
  );

  // ── Tela de "selecione um evento" ───────────────────────────────────────
  const SelectEventPrompt = ({ icon, label }) => (
    <div className="select-event-prompt">
      <span className="sep-icon">{icon}</span>
      <p className="sep-title">{label}</p>
      <p className="sep-sub">Selecione o evento para continuar</p>
      <div style={{ marginTop: 20 }}>
        <EventSelector />
      </div>
      {events.length === 0 && (
        <p className="sep-hint">
          Nenhum evento cadastrado ainda.{' '}
          <button className="btn-link" onClick={() => setTab('events')}>
            Criar evento →
          </button>
        </p>
      )}
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════
  return (
    <div className="layout">
      <header className="topbar">
        <span className="topbar-brand">🚗 GO2 — Painel de Despacho</span>
        <nav className="topbar-nav">
          {['map','history','qr','events'].map(t => (
            <button
              key={t}
              className={`nav-btn ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              { t === 'map'     ? '🗺 Mapa ao vivo'
              : t === 'history' ? '📋 Histórico'
              : t === 'qr'      ? '📲 QR Codes'
              :                   '📅 Eventos' }
            </button>
          ))}
          <button className="nav-btn logout-btn" onClick={async () => {
            await fetch('/auth/logout', { method: 'POST' });
            window.location.href = '/login';
          }}>🚪 Sair</button>
        </nav>
      </header>

      {/* ── MAPA AO VIVO ── */}
      {tab === 'map' && (
        !selectedEventId
          ? <SelectEventPrompt icon="🗺" label="Mapa ao Vivo" />
          : (
            <div className="body-area">
              <CarList sessions={filteredSessions} selectedId={selectedId} onSelect={setSelectedId} />
              <div className="map-area">
                {alert && <AlertBanner alert={alert} onClose={() => setAlert(null)} />}
                <div className="map-event-bar">
                  <EventSelector compact />
                  <span className="map-event-hint">
                    {selectedEvent?.name} ·{' '}
                    {routes.length} rota{routes.length !== 1 ? 's' : ''} ·{' '}
                    {filteredSessions.filter(s => s.status === 'active').length} ativo{filteredSessions.filter(s => s.status === 'active').length !== 1 ? 's' : ''}
                  </span>
                </div>
                <MapView
                  routes={routes}
                  sessions={filteredSessions}
                  selectedId={selectedId}
                  onSelectSession={setSelectedId}
                />
              </div>
            </div>
          )
      )}

      {/* ── HISTÓRICO ── */}
      {tab === 'history' && (
        <HistoryView
          allRoutes={allRoutes}
          selectedEventId={selectedEventId}
          eventSelector={<EventSelector />}
        />
      )}

      {/* ── QR CODES ── */}
      {tab === 'qr' && (
        !selectedEventId
          ? <SelectEventPrompt icon="📲" label="QR Codes" />
          : <QRManager routes={routes} eventSelector={<EventSelector compact />} selectedEvent={selectedEvent} />
      )}

      {/* ── EVENTOS ── */}
      {tab === 'events' && (
        <EventsManager
          onSave={reload}
          onSelectEvent={(id) => { setSelectedEventId(String(id)); setTab('map'); }}
        />
      )}
    </div>
  );
}
