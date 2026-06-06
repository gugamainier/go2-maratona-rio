import { useState, useEffect, useRef, useCallback } from 'react';
import socket from './socket.js';
import MapView from './components/MapView.jsx';
import CarList from './components/CarList.jsx';
import AlertBanner from './components/AlertBanner.jsx';
import QRManager from './components/QRManager.jsx';
import HistoryView from './components/HistoryView.jsx';

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
  const [routes, setRoutes] = useState([]);      // todas as rotas cadastradas
  const [sessions, setSessions] = useState([]);   // sessões ativas
  const [positions, setPositions] = useState({});
  const [alert, setAlert] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const alertTimeout = useRef(null);

  // Carregar todas as rotas ao iniciar
  useEffect(() => {
    fetch('/api/routes')
      .then(r => r.json())
      .then(setRoutes)
      .catch(() => {});
  }, []);

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

  return (
    <div className="layout">
      <header className="topbar">
        <span className="topbar-brand">🚗 TransporteRJ — Painel de Despacho</span>
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
          <CarList sessions={sessionsWithPos} selectedId={selectedId} onSelect={setSelectedId} />
          <div className="map-area">
            {alert && <AlertBanner alert={alert} onClose={() => setAlert(null)} />}
            <MapView
              routes={routes}
              sessions={sessionsWithPos}
              selectedId={selectedId}
              onSelectSession={setSelectedId}
            />
          </div>
        </div>
      )}

      {tab === 'qr' && <QRManager />}
      {tab === 'history' && <HistoryView />}
    </div>
  );
}
