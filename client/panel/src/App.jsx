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
  } catch { }
}

export default function App() {
  const [tab, setTab] = useState('map');

  // Eventos e filtro global
  const [events, setEvents]               = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');

  // Rotas e sessões
  const [allRoutes, setAllRoutes]   = useState([]);
  const [sessions, setSessions]     = useState([]);
  const [positions, setPositions]   = useState({});
  const [alert, setAlert]           = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const alertTimeout = useRef(null);

  // Carregar eventos na inicialização
  useEffect(() => {
    fetch('/api/events')
      .then(r => r.json())
      .then(data => {
        setEvents(data);
        // seleciona o evento mais recente automaticamente
        if (data.length > 0) setSelectedEventId(String(data[0].id));
      })
      .catch(() => {});
  }, []);

  // Carregar todas as rotas
  useEffect(() => {
    fetch('/api/routes')
      .then(r => r.json())
      .then(setAllRoutes)
      .catch(() => {});
  }, []);

  // Recarregar rotas quando voltar da aba Eventos
  const reloadRoutes = useCallback(() => {
    fetch('/api/routes').then(r => r.json()).then(setAllRoutes).catch(() => {});
    fetch('/api/events').then(r => r.json()).then(setEvents).catch(() => {});
  }, []);

  // Rotas filtradas pelo evento selecionado
  const routes = selectedEventId
    ? allRoutes.filter(r => String(r.event_id) === selectedEventId)
    : allRoutes;

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
    });

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

  // Sessões filtradas pelo evento selecionado
  const filteredSessions = selectedEventId
    ? sessionsWithPos.filter(s => {
        const route = allRoutes.find(r => r.id === s.route_id);
        return route && String(route.event_id) === selectedEventId;
      })
    : sessionsWithPos;

  // Seletor de evento (compartilhado entre abas)
  const EventSelector = () => (
    <div className="event-selector">
      <label>📅 Evento:</label>
      <select
        value={selectedEventId}
        onChange={e => setSelectedEventId(e.target.value)}
        className="event-selector-select"
      >
        <option value="">Todos os eventos</option>
        {events.map(e => (
          <option key={e.id} value={String(e.id)}>
            {e.name}{e.event_date ? ` · ${e.event_date}` : ''}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="layout">
      <header className="topbar">
        <span className="topbar-brand">🚗 GO2 — Painel de Despacho</span>
        <nav className="topbar-nav">
          <button className={`nav-btn ${tab === 'map' ? 'active' : ''}`} onClick={() => setTab('map')}>
            🗺 Mapa ao vivo
          </button>
          <button className={`nav-btn ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
            📋 Histórico
          </button>
          <button className={`nav-btn ${tab === 'qr' ? 'active' : ''}`} onClick={() => setTab('qr')}>
            📲 QR Codes
          </button>
          <button className={`nav-btn ${tab === 'events' ? 'active' : ''}`}
            onClick={() => { setTab('events'); }}>
            📅 Eventos
          </button>
          <button className="nav-btn logout-btn" onClick={async () => {
            await fetch('/auth/logout', { method: 'POST' });
            window.location.href = '/login';
          }}>
            🚪 Sair
          </button>
        </nav>
      </header>

      {tab === 'map' && (
        <div className="body-area">
          <CarList sessions={filteredSessions} selectedId={selectedId} onSelect={setSelectedId} />
          <div className="map-area">
            {alert && <AlertBanner alert={alert} onClose={() => setAlert(null)} />}
            <div className="map-event-bar">
              <EventSelector />
              <span className="map-event-hint">
                {routes.length > 0
                  ? `${routes.length} rota${routes.length > 1 ? 's' : ''} · ${filteredSessions.filter(s => s.status === 'active').length} ativo${filteredSessions.filter(s => s.status === 'active').length !== 1 ? 's' : ''}`
                  : events.length === 0 ? 'Crie um evento na aba Eventos' : 'Selecione um evento para ver as rotas'}
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
      )}

      {tab === 'qr' && (
        <QRManager
          routes={routes}
          eventSelector={<EventSelector />}
        />
      )}

      {tab === 'history' && (
        <HistoryView
          selectedEventId={selectedEventId}
          eventSelector={<EventSelector />}
        />
      )}

      {tab === 'events' && (
        <EventsManager onSave={reloadRoutes} />
      )}
    </div>
  );
}
