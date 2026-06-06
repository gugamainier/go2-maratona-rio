import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';

export default function HistoryView() {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(false);
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    fetch('/api/sessions/all')
      .then(r => r.json())
      .then(setSessions)
      .catch(() => {});
  }, []);

  // Init map
  useEffect(() => {
    if (mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [-22.9068, -43.1729],
      zoom: 12,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CartoDB',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
  }, []);

  async function loadHistory() {
    if (!selectedSession) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/history/${selectedSession}`);
      const data = await res.json();
      setPositions(data);
      drawHistory(data);
    } finally {
      setLoading(false);
    }
  }

  function drawHistory(pts) {
    const map = mapRef.current;
    if (!map) return;

    if (layerRef.current) {
      layerRef.current.forEach(l => l.remove());
    }

    if (!pts.length) return;

    const session = sessions.find(s => s.id === selectedSession);
    const color = session?.color || '#1565c0';

    const latlngs = pts.map(p => [p.lat, p.lng]);

    const line = L.polyline(latlngs, { color, weight: 4, opacity: 0.8 }).addTo(map);

    // Start marker
    const start = L.circleMarker(latlngs[0], {
      radius: 8, fillColor: '#2e7d32', color: '#fff', weight: 2, fillOpacity: 1
    }).bindTooltip('Início').addTo(map);

    // End marker
    const end = L.circleMarker(latlngs[latlngs.length - 1], {
      radius: 8, fillColor: '#c62828', color: '#fff', weight: 2, fillOpacity: 1
    }).bindTooltip('Fim').addTo(map);

    // Off-route segments highlighted
    const offPts = pts.filter(p => p.off_route);
    const offMarkers = offPts.map(p =>
      L.circleMarker([p.lat, p.lng], {
        radius: 5, fillColor: '#e65100', color: '#fff', weight: 1, fillOpacity: 0.9
      }).bindTooltip(`⚠️ Fora da rota\n${new Date(p.timestamp).toLocaleTimeString('pt-BR')}`).addTo(map)
    );

    layerRef.current = [line, start, end, ...offMarkers];
    map.fitBounds(line.getBounds(), { padding: [32, 32] });
  }

  const session = sessions.find(s => s.id === selectedSession);

  return (
    <div className="history-page">
      <div className="history-toolbar">
        <div>
          <label>Sessão do motorista</label>
          <select
            value={selectedSession}
            onChange={e => setSelectedSession(e.target.value)}
            style={{ marginLeft: 8, minWidth: 260 }}
          >
            <option value="">Selecione...</option>
            {sessions.map(s => (
              <option key={s.id} value={s.id}>
                {s.driver_name} · {s.route_name} ·{' '}
                {new Date(s.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                {s.status === 'active' ? ' 🟢' : ' ⚫'}
              </option>
            ))}
          </select>
        </div>

        <button className="btn-load" onClick={loadHistory} disabled={!selectedSession || loading}>
          {loading ? 'Carregando...' : 'Ver trajeto'}
        </button>

        {positions.length > 0 && (
          <div style={{ fontSize: 13, color: '#607d8b' }}>
            {positions.length} posições registradas ·{' '}
            {positions.filter(p => p.off_route).length} fora da rota
            {session && <> · <span style={{ color: session.color, fontWeight: 700 }}>{session.route_name}</span></>}
          </div>
        )}
      </div>

      <div className="history-map" ref={containerRef}>
        {positions.length === 0 && !loading && (
          <div className="empty-state" style={{ position: 'absolute', zIndex: 500, inset: 0, background: 'rgba(238,242,247,.7)' }}>
            <span className="icon">📋</span>
            <span>Selecione uma sessão e clique em "Ver trajeto"</span>
          </div>
        )}
      </div>
    </div>
  );
}
