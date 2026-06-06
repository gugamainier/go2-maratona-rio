import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';

// ── Cores disponíveis para rotas ─────────────────────────────────────────────
const COLORS = [
  '#e74c3c','#2980b9','#27ae60','#8e44ad','#d35400',
  '#16a085','#c0392b','#2471a3','#1e8449','#6c3483',
  '#f39c12','#1abc9c','#e91e63','#00bcd4','#ff5722',
];

export default function EventsManager({ onSave, onSelectEvent }) {
  const [events, setEvents]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [view, setView]           = useState('list');   // 'list' | 'new-event' | 'edit-route'
  const [activeEvent, setActiveEvent] = useState(null);
  const [editingRoute, setEditingRoute] = useState(null); // null = nova rota

  // Formulário do evento
  const [evtName, setEvtName]     = useState('');
  const [evtDate, setEvtDate]     = useState('');
  const [evtLoc,  setEvtLoc]      = useState('');

  // Formulário da rota
  const [rtName,  setRtName]      = useState('');
  const [rtColor, setRtColor]     = useState(COLORS[0]);
  const [rtTimes, setRtTimes]     = useState('');
  const [rtCoords, setRtCoords]   = useState([]);  // [[lat,lng], ...]
  const [rtOsrm,   setRtOsrm]     = useState([]);  // rota OSRM desenhada
  const [saving,   setSaving]     = useState(false);
  const [msg,      setMsg]        = useState('');

  // Mapa do editor de rota
  const mapRef       = useRef(null);
  const mapContRef   = useRef(null);
  const waypointLayer = useRef([]);
  const routeLayer    = useRef(null);

  // ── Carregar eventos ────────────────────────────────────────────────────
  useEffect(() => {
    fetchEvents();
  }, []);

  async function fetchEvents() {
    setLoading(true);
    const res  = await fetch('/api/events');
    const data = await res.json();
    setEvents(data);
    setLoading(false);
  }

  // ── Inicializar mapa quando entrar na view de rota ───────────────────────
  useEffect(() => {
    if (view !== 'edit-route') return;

    // Aguarda DOM
    setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      waypointLayer.current = [];
      routeLayer.current = null;

      const map = L.map(mapContRef.current, {
        center: [-22.97, -43.28],
        zoom: 12,
      });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CartoDB', maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;

      // Carrega waypoints existentes se estiver editando
      if (editingRoute?.coordinates?.length) {
        setRtCoords(editingRoute.coordinates);
        editingRoute.coordinates.forEach((c, i) => addWaypointMarker(map, c, i));
        fetchOsrmRoute(editingRoute.coordinates, map);
      }

      // Click no mapa = adiciona waypoint
      map.on('click', e => {
        setRtCoords(prev => {
          const next = [...prev, [e.latlng.lat, e.latlng.lng]];
          const idx  = next.length - 1;
          addWaypointMarker(map, [e.latlng.lat, e.latlng.lng], idx);
          fetchOsrmRoute(next, map);
          return next;
        });
      });
    }, 100);

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, [view]);

  function addWaypointMarker(map, [lat, lng], idx) {
    const isFirst = idx === 0;
    const marker = L.circleMarker([lat, lng], {
      radius: isFirst ? 10 : 8,
      fillColor: isFirst ? '#27ae60' : rtColor || COLORS[0],
      color: '#fff',
      weight: 2.5,
      fillOpacity: 1,
    })
    .bindTooltip(isFirst ? '📍 Origem' : `Ponto ${idx + 1}`, { permanent: false })
    .addTo(map);

    // Duplo clique remove o waypoint
    marker.on('dblclick', () => {
      setRtCoords(prev => {
        const next = prev.filter((_, i) => i !== idx);
        // Redesenhar todos
        waypointLayer.current.forEach(m => m.remove());
        waypointLayer.current = [];
        next.forEach((c, i) => addWaypointMarker(map, c, i));
        fetchOsrmRoute(next, map);
        return next;
      });
    });

    waypointLayer.current.push(marker);
  }

  async function fetchOsrmRoute(coords, map) {
    if (coords.length < 2) {
      if (routeLayer.current) { routeLayer.current.remove(); routeLayer.current = null; }
      setRtOsrm([]);
      return;
    }
    try {
      const wps  = coords.map(c => `${c[1]},${c[0]}`).join(';');
      const url  = `https://router.project-osrm.org/route/v1/driving/${wps}?overview=full&geometries=geojson`;
      const res  = await fetch(url);
      const data = await res.json();
      if (data.code !== 'Ok') return;

      const latlngs = data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
      setRtOsrm(latlngs);

      if (routeLayer.current) routeLayer.current.remove();
      routeLayer.current = L.polyline(latlngs, {
        color: rtColor || COLORS[0], weight: 5, opacity: 0.85,
      }).addTo(map);
    } catch {}
  }

  function clearMap() {
    waypointLayer.current.forEach(m => m.remove());
    waypointLayer.current = [];
    if (routeLayer.current) { routeLayer.current.remove(); routeLayer.current = null; }
    setRtCoords([]);
    setRtOsrm([]);
  }

  // ── Salvar evento ────────────────────────────────────────────────────────
  async function saveEvent() {
    if (!evtName.trim()) { setMsg('Digite o nome do evento.'); return; }
    setSaving(true);
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: evtName, event_date: evtDate, location: evtLoc }),
    });
    const data = await res.json();
    setEvents(prev => [data, ...prev]);
    setEvtName(''); setEvtDate(''); setEvtLoc('');
    setMsg('');
    setView('list');
    setSaving(false);
  }

  // ── Deletar evento ───────────────────────────────────────────────────────
  async function deleteEvent(id) {
    if (!confirm('Excluir este evento e todas as rotas dele?')) return;
    await fetch(`/api/events/${id}`, { method: 'DELETE' });
    setEvents(prev => prev.filter(e => e.id !== id));
  }

  // ── Abrir editor de rota ─────────────────────────────────────────────────
  function openRouteEditor(event, route = null) {
    setActiveEvent(event);
    setEditingRoute(route);
    setRtName(route?.name || '');
    setRtColor(route?.color || COLORS[0]);
    setRtTimes(route?.departure_times?.join(', ') || '');
    setRtCoords(route?.coordinates || []);
    setRtOsrm([]);
    setMsg('');
    setView('edit-route');
  }

  // ── Salvar rota ──────────────────────────────────────────────────────────
  async function saveRoute() {
    if (!rtName.trim()) { setMsg('Digite o nome da rota.'); return; }
    if (rtCoords.length < 2) { setMsg('Clique no mapa para desenhar a rota (mínimo 2 pontos).'); return; }

    // Converte horários: "03:30, 03:31" → ["03:30","03:31"]
    const times = rtTimes.split(/[\n,;]+/).map(t => t.trim()).filter(Boolean);

    // Usa a rota OSRM como coordenadas principais (mais precisa)
    const finalCoords = rtOsrm.length > 1 ? rtOsrm : rtCoords;

    const body = {
      name: rtName.trim(),
      color: rtColor,
      coordinates: finalCoords,
      checkpoints: rtCoords.slice(1, -1).map((c, i) => ({ lat: c[0], lng: c[1], name: `Ponto ${i + 1}` })),
      departure_times: times,
    };

    setSaving(true);
    try {
      if (editingRoute) {
        await fetch(`/api/routes/${editingRoute.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        await fetch(`/api/events/${activeEvent.id}/routes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
      await fetchEvents();
      onSave?.();
      setView('list');
    } catch {
      setMsg('Erro ao salvar. Tente novamente.');
    }
    setSaving(false);
  }

  // ── Deletar rota ─────────────────────────────────────────────────────────
  async function deleteRoute(routeId, e) {
    e.stopPropagation();
    if (!confirm('Excluir esta rota?')) return;
    await fetch(`/api/routes/${routeId}`, { method: 'DELETE' });
    await fetchEvents();
  }

  // ════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════

  // ── Lista de eventos ────────────────────────────────────────────────────
  if (view === 'list') return (
    <div className="events-page">
      <div className="events-header">
        <div>
          <h2 className="events-title">📅 Eventos</h2>
          <p className="events-sub">Gerencie eventos e suas rotas</p>
        </div>
        <button className="btn-primary" onClick={() => { setMsg(''); setView('new-event'); }}>
          + Novo Evento
        </button>
      </div>

      {loading && <div className="events-empty">Carregando...</div>}

      {!loading && events.length === 0 && (
        <div className="events-empty">
          <span style={{ fontSize: 48 }}>📅</span>
          <p>Nenhum evento ainda.</p>
          <p style={{ color: '#aaa', fontSize: 13 }}>Clique em "Novo Evento" para começar.</p>
        </div>
      )}

      <div className="events-list">
        {events.map(evt => (
          <div key={evt.id} className="event-card">
            <div className="event-card-header">
              <div>
                <h3 className="event-card-name">{evt.name}</h3>
                <div className="event-card-meta">
                  {evt.event_date && <span>📆 {evt.event_date}</span>}
                  {evt.location   && <span>📍 {evt.location}</span>}
                  <span>🛣 {evt.routes.length} {evt.routes.length === 1 ? 'rota' : 'rotas'}</span>
                </div>
              </div>
              <div className="event-card-actions">
                <button className="btn-outline-green" onClick={() => onSelectEvent?.(evt.id)}>
                  🗺 Ver no mapa
                </button>
                <button className="btn-outline" onClick={() => openRouteEditor(evt)}>
                  + Rota
                </button>
                <button className="btn-danger-sm" onClick={() => deleteEvent(evt.id)}>🗑</button>
              </div>
            </div>

            {evt.routes.length > 0 && (
              <div className="route-list">
                {evt.routes.map(r => (
                  <div key={r.id} className="route-item">
                    <span className="route-dot" style={{ background: r.color }} />
                    <span className="route-item-name">{r.name}</span>
                    <span className="route-item-times">
                      {r.departure_times.length > 0
                        ? `${r.departure_times.length} horários`
                        : 'sem horários'}
                    </span>
                    <button className="btn-icon" onClick={() => openRouteEditor(evt, { ...r, coordinates: [] })} title="Editar">✏️</button>
                    <button className="btn-icon" onClick={(e) => deleteRoute(r.id, e)} title="Excluir">🗑</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  // ── Novo evento ─────────────────────────────────────────────────────────
  if (view === 'new-event') return (
    <div className="events-page">
      <div className="events-header">
        <button className="btn-back" onClick={() => setView('list')}>← Voltar</button>
        <h2 className="events-title">Novo Evento</h2>
      </div>

      <div className="form-card">
        {msg && <div className="form-error">{msg}</div>}

        <div className="form-field">
          <label>Nome do evento *</label>
          <input value={evtName} onChange={e => setEvtName(e.target.value)}
                 placeholder="Ex: Maratona do Rio 2025" autoFocus />
        </div>
        <div className="form-row">
          <div className="form-field">
            <label>Data</label>
            <input type="date" value={evtDate} onChange={e => setEvtDate(e.target.value)} />
          </div>
          <div className="form-field">
            <label>Local / Cidade</label>
            <input value={evtLoc} onChange={e => setEvtLoc(e.target.value)}
                   placeholder="Ex: Rio de Janeiro, RJ" />
          </div>
        </div>

        <div className="form-actions">
          <button className="btn-ghost" onClick={() => setView('list')}>Cancelar</button>
          <button className="btn-primary" onClick={saveEvent} disabled={saving}>
            {saving ? 'Salvando...' : 'Criar Evento'}
          </button>
        </div>
      </div>
    </div>
  );

  // ── Editor de rota ───────────────────────────────────────────────────────
  if (view === 'edit-route') return (
    <div className="route-editor">
      {/* Sidebar */}
      <div className="route-editor-sidebar">
        <button className="btn-back" onClick={() => setView('list')}>← Voltar</button>
        <h3 className="sidebar-title">{editingRoute ? 'Editar Rota' : 'Nova Rota'}</h3>
        <p className="sidebar-event-name">📅 {activeEvent.name}</p>

        {msg && <div className="form-error">{msg}</div>}

        <div className="form-field">
          <label>Nome da rota *</label>
          <input value={rtName} onChange={e => setRtName(e.target.value)}
                 placeholder="Ex: Hotel Copacabana → Largada" />
        </div>

        <div className="form-field">
          <label>Cor</label>
          <div className="color-grid">
            {COLORS.map(c => (
              <button key={c}
                className={`color-swatch ${rtColor === c ? 'selected' : ''}`}
                style={{ background: c }}
                onClick={() => {
                  setRtColor(c);
                  if (routeLayer.current) routeLayer.current.setStyle({ color: c });
                  waypointLayer.current.forEach((m, i) => { if (i > 0) m.setStyle({ fillColor: c }); });
                }}
              />
            ))}
          </div>
        </div>

        <div className="form-field">
          <label>Horários de saída</label>
          <textarea
            value={rtTimes}
            onChange={e => setRtTimes(e.target.value)}
            placeholder="03:30, 03:31, 03:32&#10;(separados por vírgula ou linha)"
            rows={4}
          />
          <span className="field-hint">Separe por vírgula ou uma por linha</span>
        </div>

        <div className="route-map-instructions">
          <strong>Como desenhar:</strong>
          <ol>
            <li>Clique no mapa para adicionar pontos</li>
            <li>A rota segue as ruas automaticamente</li>
            <li>Duplo clique num ponto para removê-lo</li>
            <li>Primeiro ponto = origem da rota</li>
          </ol>
          <div className="route-waypoint-count">
            {rtCoords.length === 0 && <span style={{ color: '#888' }}>Nenhum ponto ainda</span>}
            {rtCoords.length === 1 && <span style={{ color: '#f39c12' }}>1 ponto — adicione mais</span>}
            {rtCoords.length >= 2 && <span style={{ color: '#27ae60' }}>✅ {rtCoords.length} pontos</span>}
          </div>
          {rtCoords.length > 0 && (
            <button className="btn-ghost-sm" onClick={clearMap}>🗑 Limpar mapa</button>
          )}
        </div>

        <div className="form-actions">
          <button className="btn-ghost" onClick={() => setView('list')}>Cancelar</button>
          <button className="btn-primary" onClick={saveRoute} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar Rota'}
          </button>
        </div>
      </div>

      {/* Mapa */}
      <div className="route-editor-map" ref={mapContRef} />
    </div>
  );
}
