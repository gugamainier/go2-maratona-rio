import { useState, useEffect } from 'react';

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)  return `${s}s atrás`;
  if (s < 3600) return `${Math.floor(s/60)}min atrás`;
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function AlertPanel({ alerts, onDismiss }) {
  const [expanded, setExpanded] = useState(true);
  const [tick, setTick] = useState(0);

  // Atualiza o "X min atrás" a cada 15s
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 15000);
    return () => clearInterval(t);
  }, []);

  const offRoute = alerts.filter(a => a.type === 'off_route');
  const offline  = alerts.filter(a => a.type === 'offline');
  const online   = alerts.filter(a => a.type === 'online');
  const total    = alerts.length;

  if (total === 0) return null;

  return (
    <div className={`alert-panel ${expanded ? 'expanded' : 'collapsed'}`}>
      {/* Cabeçalho */}
      <div className="alert-panel-header" onClick={() => setExpanded(e => !e)}>
        <span className="alert-panel-icon">🚨</span>
        <span className="alert-panel-title">
          {total} alerta{total !== 1 ? 's' : ''} ativos
        </span>
        {online.length > 0 && (
          <span className="alert-chip chip-online">🟢 {online.length} online</span>
        )}
        {offRoute.length > 0 && (
          <span className="alert-chip chip-offroute">⚠️ {offRoute.length} fora da rota</span>
        )}
        {offline.length > 0 && (
          <span className="alert-chip chip-offline">📡 {offline.length} offline</span>
        )}
        <button className="alert-panel-toggle">{expanded ? '▲' : '▼'}</button>
      </div>

      {/* Lista de alertas */}
      {expanded && (
        <div className="alert-list">
          {alerts.map(a => (
            <div
              key={a.id}
              className={`alert-item ${
                a.type === 'off_route' ? 'alert-offroute'
                : a.type === 'online'  ? 'alert-online'
                : 'alert-offline'
              }`}
            >
              <div className="alert-item-icon">
                {a.type === 'off_route' ? '⚠️' : a.type === 'online' ? '🟢' : '📡'}
              </div>
              <div className="alert-item-body">
                <strong className="alert-item-driver">{a.driver_name}</strong>
                <span className="alert-item-desc">
                  {a.type === 'off_route'
                    ? `Fora da rota · ${a.dist ? a.dist + 'm' : ''} · ${a.route_name}`
                    : a.type === 'online'
                    ? `Entrou online · ${a.route_name}`
                    : `Perdeu sinal · ${a.route_name}`}
                </span>
                <span className="alert-item-meta">
                  {timeAgo(a.ts)}
                  {a.driver_phone && ` · 📞 ${a.driver_phone}`}
                </span>
              </div>
              <button
                className="alert-dismiss"
                onClick={() => onDismiss(a.id)}
                title="Dispensar"
              >✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
