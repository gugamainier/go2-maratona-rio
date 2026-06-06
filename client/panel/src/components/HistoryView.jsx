import { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';

export default function HistoryView({ allRoutes = [], selectedEventId, eventSelector }) {
  const [sessions, setSessions]           = useState([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [positions, setPositions]         = useState([]);
  const [loading, setLoading]             = useState(false);
  const [loadingList, setLoadingList]     = useState(true);
  const [lastUpdated, setLastUpdated]     = useState(null);
  const mapRef       = useRef(null);
  const containerRef = useRef(null);
  const layerRef     = useRef(null);

  // ── Busca a lista de sessões ─────────────────────────────────────────────
  const fetchSessions = useCallback(() => {
    fetch('/api/sessions/all')
      .then(r => r.json())
      .then(data => {
        setSessions(data);
        setLastUpdated(new Date());
        setLoadingList(false);
      })
      .catch(() => setLoadingList(false));
  }, []);

  // Carrega na montagem + recarrega a cada 10 segundos
  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 10000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  // Filtro por evento — mostra tudo se nenhum evento selecionado
  const filteredSessions = selectedEventId
    ? sessions.filter(s => {
        const route = allRoutes.find(r => r.id === s.route_id);
        return route && String(route.event_id) === selectedEventId;
      })
    : sessions;

  // ── Mapa ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [-22.97, -43.28],
      zoom: 11,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CartoDB',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
  }, []);

  // ── Carrega histórico do motorista selecionado ───────────────────────────
  async function loadHistory() {
    if (!selectedSession) return;
    setLoading(true);
    try {
      const res  = await fetch(`/api/history/${selectedSession}`);
      const data = await res.json();
      setPositions(data);
      drawHistory(data);
    } finally {
      setLoading(false);
    }
  }

  // Auto-carrega quando troca de sessão
  useEffect(() => {
    if (selectedSession) loadHistory();
    else {
      setPositions([]);
      if (layerRef.current) { layerRef.current.forEach(l => l.remove()); layerRef.current = null; }
    }
  }, [selectedSession]);

  function drawHistory(pts) {
    const map = mapRef.current;
    if (!map) return;

    if (layerRef.current) {
      layerRef.current.forEach(l => l.remove());
    }
    layerRef.current = [];

    if (!pts.length) return;

    const session = filteredSessions.find(s => s.id === selectedSession);
    const color   = session?.color || '#1565c0';
    const latlngs = pts.map(p => [p.lat, p.lng]);

    const line = L.polyline(latlngs, { color, weight: 5, opacity: 0.85 }).addTo(map);
    layerRef.current.push(line);

    // Início
    const start = L.circleMarker(latlngs[0], {
      radius: 9, fillColor: '#2e7d32', color: '#fff', weight: 2.5, fillOpacity: 1,
    }).bindTooltip('🟢 Início', { permanent: false }).addTo(map);
    layerRef.current.push(start);

    // Fim
    const end = L.circleMarker(latlngs[latlngs.length - 1], {
      radius: 9, fillColor: '#c62828', color: '#fff', weight: 2.5, fillOpacity: 1,
    }).bindTooltip('🏁 Fim', { permanent: false }).addTo(map);
    layerRef.current.push(end);

    // Pontos fora da rota
    pts.filter(p => p.off_route).forEach(p => {
      const m = L.circleMarker([p.lat, p.lng], {
        radius: 5, fillColor: '#e65100', color: '#fff', weight: 1.5, fillOpacity: 0.9,
      }).bindTooltip(`⚠️ Fora da rota · ${new Date(p.timestamp).toLocaleTimeString('pt-BR')}`).addTo(map);
      layerRef.current.push(m);
    });

    map.fitBounds(line.getBounds(), { padding: [40, 40] });
  }

  const session = filteredSessions.find(s => s.id === selectedSession);
  const offCount = positions.filter(p => p.off_route).length;

  const statusBadge = (s) => {
    if (s.status === 'active')   return <span className="badge badge-active">🟢 Ativo</span>;
    if (s.status === 'offline')  return <span className="badge badge-offline">⚫ Offline</span>;
    return <span className="badge badge-done">✅ Concluído</span>;
  };

  return (
    <div className="history-page">

      {/* ── Toolbar ── */}
      <div className="history-toolbar">

        {/* Seletor de evento */}
        {eventSelector && <div style={{ alignSelf: 'center' }}>{eventSelector}</div>}

        {/* Selector de motorista */}
        <div className="history-select-wrap">
          <label>Motorista / Sessão</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <select
              value={selectedSession}
              onChange={e => setSelectedSession(e.target.value)}
              className="history-select"
            >
              <option value="">
                {loadingList ? 'Carregando...' : filteredSessions.length === 0 ? 'Nenhuma sessão neste evento' : 'Selecione um motorista...'}
              </option>
              {filteredSessions.map(s => (
                <option key={s.id} value={s.id}>
                  {s.driver_name} · {s.route_name} ·{' '}
                  {new Date(s.created_at).toLocaleString('pt-BR', {
                    day: '2-digit', month: '2-digit',
                    hour: '2-digit', minute: '2-digit',
                  })}
                  {s.status === 'active' ? ' 🟢' : ' ⚫'}
                </option>
              ))}
            </select>

            {/* Botão de atualizar manual */}
            <button
              className="btn-refresh"
              onClick={fetchSessions}
              title="Atualizar lista"
            >
              🔄
            </button>
          </div>

          {lastUpdated && (
            <span className="updated-at">
              Atualizado às {lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              &nbsp;· auto-refresh a cada 10s
            </span>
          )}
        </div>

        {/* Stats da sessão selecionada */}
        {session && (
          <div className="session-stats">
            <div className="stat-item">
              <span className="stat-label">Motorista</span>
              <span className="stat-value">{session.driver_name}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Rota</span>
              <span className="stat-value" style={{ color: session.color }}>{session.route_name}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Saída</span>
              <span className="stat-value">{session.departure_time || '—'}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Status</span>
              {statusBadge(session)}
            </div>
            {positions.length > 0 && (
              <>
                <div className="stat-item">
                  <span className="stat-label">Posições</span>
                  <span className="stat-value">{positions.length}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Alertas</span>
                  <span className="stat-value" style={{ color: offCount > 0 ? '#e65100' : '#2e7d32' }}>
                    {offCount > 0 ? `⚠️ ${offCount}` : '✅ 0'}
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Botão ver trajeto se não carregou ainda */}
        {selectedSession && positions.length === 0 && !loading && (
          <button className="btn-load" onClick={loadHistory}>
            Ver trajeto no mapa
          </button>
        )}
        {loading && <span style={{ fontSize: 13, color: '#888' }}>⏳ Carregando trajeto...</span>}
      </div>

      {/* ── Mapa ── */}
      <div className="history-map" ref={containerRef}>
        {!selectedSession && !loading && (
          <div className="empty-state" style={{ position: 'absolute', zIndex: 500, inset: 0, background: 'rgba(238,242,247,.85)' }}>
            <span className="icon">🚗</span>
            <span>
              {filteredSessions.length === 0
                ? 'Nenhum motorista neste evento ainda. A lista atualiza automaticamente.'
                : 'Selecione um motorista para ver o trajeto'}
            </span>
          </div>
        )}
      </div>

    </div>
  );
}
