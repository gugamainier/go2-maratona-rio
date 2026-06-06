import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Zona Sul / Barra como centro inicial
const RIO_CENTER = [-22.9700, -43.2800];
const RIO_ZOOM = 11;

function carIcon(color, offRoute) {
  const bg = offRoute ? '#e65100' : (color || '#1565c0');
  return L.divIcon({
    className: '',
    html: `<div style="
      width:34px;height:34px;border-radius:50% 50% 50% 0;
      background:${bg};border:3px solid #fff;
      box-shadow:0 2px 8px rgba(0,0,0,.5);
      transform:rotate(-45deg);
      display:flex;align-items:center;justify-content:center;
    "><span style="transform:rotate(45deg);font-size:15px">🚗</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -36],
  });
}

function checkpointIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:13px;height:13px;border-radius:50%;
      background:#ff9800;border:2px solid #fff;
      box-shadow:0 1px 4px rgba(0,0,0,.3);
    "></div>`,
    iconSize: [13, 13],
    iconAnchor: [6, 6],
  });
}

export default function MapView({ routes, sessions, selectedId, onSelectSession }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const routeLayersRef = useRef({});   // routeId → { polyline, checkpoints[], startMarker }
  const sessionLayersRef = useRef({}); // sessionId → { marker }

  // ── Init mapa ──────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: RIO_CENTER,
      zoom: RIO_ZOOM,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CartoDB',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // ── Desenhar todas as rotas cadastradas (sempre visíveis) ──────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !routes.length) return;

    // Remove rotas que não existem mais
    for (const id of Object.keys(routeLayersRef.current)) {
      if (!routes.find(r => r.id === String(id) || r.id === Number(id))) {
        routeLayersRef.current[id].polyline?.remove();
        routeLayersRef.current[id].checkpoints?.forEach(m => m.remove());
        routeLayersRef.current[id].startMarker?.remove();
        delete routeLayersRef.current[id];
      }
    }

    for (const route of routes) {
      if (routeLayersRef.current[route.id]) continue; // já desenhada

      const coords = route.coordinates;
      if (!coords?.length) continue;

      // Polyline da rota
      const polyline = L.polyline(coords, {
        color: route.color || '#1565c0',
        weight: 5,
        opacity: 0.75,
      }).addTo(map);

      polyline.bindTooltip(route.name, { sticky: true, direction: 'top' });

      // Marcador de início (bolinha colorida)
      const startMarker = L.circleMarker(coords[0], {
        radius: 8,
        fillColor: route.color || '#1565c0',
        color: '#fff',
        weight: 2,
        fillOpacity: 1,
      }).bindTooltip(`Início: ${route.name}`, { direction: 'top' }).addTo(map);

      // Marcador de fim
      const endMarker = L.circleMarker(coords[coords.length - 1], {
        radius: 8,
        fillColor: '#333',
        color: '#fff',
        weight: 2,
        fillOpacity: 1,
      }).bindTooltip(`Destino: Av. Lúcio Costa`, { direction: 'top' }).addTo(map);

      // Checkpoints
      const checkpoints = (route.checkpoints || []).map(cp =>
        L.marker([cp.lat, cp.lng], { icon: checkpointIcon() })
          .bindTooltip(cp.name, { direction: 'top' })
          .addTo(map)
      );

      routeLayersRef.current[route.id] = { polyline, startMarker, endMarker, checkpoints };
    }
  }, [routes]);

  // ── Marcadores dos carros ativos ───────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const activeIds = new Set(sessions.map(s => s.id));

    // Remove marcadores de sessões encerradas
    for (const [id, layer] of Object.entries(sessionLayersRef.current)) {
      if (!activeIds.has(id)) {
        layer.marker?.remove();
        delete sessionLayersRef.current[id];
      }
    }

    for (const s of sessions) {
      if (!s.lastPos) continue;
      const { lat, lng } = s.lastPos;
      const icon = carIcon(s.color, s.off_route);
      const updated = new Date(s.lastPos.timestamp).toLocaleTimeString('pt-BR');

      const popupHtml = `
        <strong>${s.driver_name}</strong><br>
        ${s.route_name}<br>
        📞 ${s.driver_phone}<br>
        ${s.departure_time ? `Saída: ${s.departure_time}<br>` : ''}
        Atualizado: ${updated}<br>
        ${s.off_route ? '<span style="color:#e65100;font-weight:bold">⚠️ Fora da rota</span>' : '✅ Na rota'}
      `;

      if (!sessionLayersRef.current[s.id]) {
        const marker = L.marker([lat, lng], { icon })
          .addTo(map)
          .on('click', () => onSelectSession(s.id));
        marker.bindPopup(popupHtml);
        sessionLayersRef.current[s.id] = { marker };
      } else {
        sessionLayersRef.current[s.id].marker.setLatLng([lat, lng]);
        sessionLayersRef.current[s.id].marker.setIcon(icon);
        sessionLayersRef.current[s.id].marker.setPopupContent(popupHtml);
      }
    }
  }, [sessions, onSelectSession]);

  // ── Pan para carro selecionado ─────────────────────────────────────
  useEffect(() => {
    if (!selectedId || !mapRef.current) return;
    const s = sessions.find(s => s.id === selectedId);
    if (s?.lastPos) {
      mapRef.current.setView([s.lastPos.lat, s.lastPos.lng], 15, { animate: true });
      sessionLayersRef.current[selectedId]?.marker?.openPopup();
    }
  }, [selectedId, sessions]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Legenda */}
      <div className="map-legend">
        <h4>Rotas</h4>
        {routes.map(r => (
          <div key={r.id} className="legend-row">
            <div className="legend-line" style={{ background: r.color }} />
            <span style={{ fontSize: 11 }}>{r.name.split('→')[0].trim()}</span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid #eee', marginTop: 6, paddingTop: 6 }}>
          <div className="legend-row">
            <div className="legend-dot" style={{ background: '#ff9800' }} />
            <span style={{ fontSize: 11 }}>Checkpoint</span>
          </div>
          <div className="legend-row">
            <div className="legend-dot" style={{ background: '#e65100' }} />
            <span style={{ fontSize: 11 }}>Fora da rota</span>
          </div>
        </div>
      </div>
    </div>
  );
}
