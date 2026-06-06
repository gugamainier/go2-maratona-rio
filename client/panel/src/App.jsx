import { useState, useEffect, useRef, useCallback } from 'react';
import socket from './socket.js';
import MapView from './components/MapView.jsx';
import CarList from './components/CarList.jsx';
import AlertPanel from './components/AlertPanel.jsx';
import QRManager from './components/QRManager.jsx';
import HistoryView from './components/HistoryView.jsx';
import EventsManager from './components/EventsManager.jsx';

// ── Sons de alerta ────────────────────────────────────────────────────────────
function playBeep(freq = 880, times = 3) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    Array.from({ length: times }, (_, i) => i * 0.28).forEach(offset => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.2);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.25);
    });
  } catch {}
}

export default function App() {
  const [tab, setTab] = useState('map');
  const [events, setEvents]     = useState([]);
  const [allRoutes, setAllRoutes] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');

  const [sessions, setSessions]   = useState([]);
  const [positions, setPositions] = useState({});
  const [selectedId, setSelectedId] = useState(null);

  // ── Fila de alertas ───────────────────────────────────────────────────────
  const [alerts, setAlerts] = useState([]); // [{ id, type, ...data }]
  const alertIdRef = useRef(0);

  function addAlert(type, data) {
    const id = ++alertIdRef.current;
    setAlerts(prev => [{ id, type, ts: Date.now(), ...data }, ...prev].slice(0, 20));
    return id;
  }
  function dismissAlert(id) {
    setAlerts(prev => prev.filter(a => a.id !== id));
  }

  // ── Carregar dados ────────────────────────────────────────────────────────
  const reload = useCallback(() => {
    fetch('/api/events').then(r => r.json()).then(setEvents).catch(() => {});
    fetch('/api/routes').then(r => r.json()).then(setAllRoutes).catch(() => {});
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // ── Filtros ───────────────────────────────────────────────────────────────
  // Rota filtrada pelo evento selecionado
  const routes = selectedEventId
    ? allRoutes.filter(r => String(r.event_id) === selectedEventId)
    : [];

  // Sessões com posição
  const sessionsWithPos = sessions.map(s => ({
    ...s,
    lastPos: positions[s.id] ?? s.lastPos ?? null,
  }));

  // Filtro defensivo: se allRoutes não carregou ainda, mostra todas as sessões
  const filteredSessions = selectedEventId && allRoutes.length > 0
    ? sessionsWithPos.filter(s => {
        const route = allRoutes.find(r => String(r.id) === String(s.route_id));
        return route && String(route.event_id) === selectedEventId;
      })
    : sessionsWithPos;

  // ── Socket ────────────────────────────────────────────────────────────────
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

    socket.on('session:update', ({ session_id, status }) => {
      updateSession(session_id, { status });

      // ── Alerta: motorista ficou offline ──
      if (status === 'offline') {
        setSessions(prev => {
          const s = prev.find(x => x.id === session_id);
          if (s) {
            addAlert('offline', {
              session_id,
              driver_name: s.driver_name,
              route_name: s.route_name,
              driver_phone: s.driver_phone,
            });
            playBeep(440, 2); // tom mais grave = offline
          }
          return prev;
        });
      }
    });

    // ── Alerta: motorista fora da rota ──
    socket.on('alert:off_route', (data) => {
      addAlert('off_route', data);
      playBeep(880, 3);
    });

    return () => {
      socket.off('panel:state');
      socket.off('position:update');
      socket.off('session:update');
      socket.off('alert:off_route');
    };
  }, [updateSession]);

  // ── Seletor de evento compartilhado ──────────────────────────────────────
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

  // ── Tela de prompt ────────────────────────────────────────────────────────
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
          <button className="btn-link" onClick={() => setTab('events')}>Criar evento →</button>
        </p>
      )}
    </div>
  );

  // ── Alertas ativos do evento selecionado ─────────────────────────────────
  const activeOffRoute = alerts.filter(a => a.type === 'off_route' && !a.dismissed);
  const activeOffline  = alerts.filter(a => a.type === 'offline'   && !a.dismissed);

  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="layout">
      <header className="topbar">
        <span className="topbar-brand">🚗 GO2 — Painel de Despacho</span>
        <nav className="topbar-nav">
          {[
            { key: 'map',     label: '🗺 Mapa ao vivo' },
            { key: 'history', label: '📋 Histórico' },
            { key: 'qr',      label: '📲 QR Codes' },
            { key: 'events',  label: '📅 Eventos' },
          ].map(({ key, label }) => (
            <button
              key={key}
              className={`nav-btn ${tab === key ? 'active' : ''}`}
              onClick={() => setTab(key)}
            >
              {label}
              {key === 'map' && alerts.length > 0 && (
                <span className="nav-badge">{alerts.length}</span>
              )}
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
              <CarList
                sessions={filteredSessions}
                selectedId={selectedId}
                onSelect={setSelectedId}
                alerts={alerts}
                onDismissAlert={dismissAlert}
              />
              <div className="map-area">
                {/* Painel de alertas inline */}
                <AlertPanel
                  alerts={alerts}
                  onDismiss={dismissAlert}
                />
                <div className="map-event-bar">
                  <EventSelector compact />
                  <span className="map-event-hint">
                    {selectedEvent?.name} ·{' '}
                    {routes.length} rota{routes.length !== 1 ? 's' : ''} ·{' '}
                    {filteredSessions.filter(s => s.status === 'active').length} online
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
