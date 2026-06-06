export default function CarList({ sessions, selectedId, onSelect, alerts = [] }) {
  const active  = sessions.filter(s => s.status === 'active').length;
  const offline = sessions.filter(s => s.status !== 'active').length;

  function fmtTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60)   return `${s}s atrás`;
    if (s < 3600) return `${Math.floor(s/60)}min atrás`;
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function getAlerts(sessionId) {
    return alerts.filter(a => a.session_id === sessionId);
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span>Veículos</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {active > 0  && <span className="car-count online">{active} online</span>}
          {offline > 0 && <span className="car-count offline-count">{offline} sem sinal</span>}
        </div>
      </div>

      <div className="sidebar-list">
        {sessions.length === 0 && (
          <div style={{ padding: '24px 16px', color: '#90a4ae', fontSize: 13, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🚗</div>
            Nenhum motorista ativo.<br />
            Escaneie um QR Code para iniciar.
          </div>
        )}

        {sessions.map(s => {
          const sessionAlerts = getAlerts(s.id);
          const hasOffRoute   = s.off_route || sessionAlerts.some(a => a.type === 'off_route');
          const isOffline     = s.status !== 'active';

          return (
            <div
              key={s.id}
              className={[
                'car-card',
                s.id === selectedId ? 'selected' : '',
                hasOffRoute ? 'off-route' : '',
                isOffline   ? 'car-offline' : '',
              ].join(' ')}
              onClick={() => onSelect(s.id === selectedId ? null : s.id)}
            >
              {/* Header */}
              <div className="car-header">
                <span className="car-color-dot" style={{ background: s.color || '#607d8b' }} />
                <span className="car-driver">{s.driver_name}</span>
                <span className={`status-badge ${isOffline ? 'offline' : 'active'}`}>
                  {isOffline ? '📡 Sem sinal' : '🟢 Online'}
                </span>
              </div>

              {/* Rota */}
              <div className="car-route">{s.route_name}</div>

              {/* Meta */}
              <div className="car-meta">
                📞 {s.driver_phone}
                {s.departure_time && <> · Saída {s.departure_time}</>}
              </div>

              <div className="car-meta">
                🕐 {fmtTime(s.lastPos?.timestamp)}
                {s.lastPos?.speed != null && s.lastPos.speed > 0 && (
                  <> · {Math.round(s.lastPos.speed * 3.6)} km/h</>
                )}
              </div>

              {/* Alertas inline */}
              {hasOffRoute && (
                <div className="car-alert-tag tag-offroute">
                  ⚠️ Fora da rota {s.lastPos?.dist_to_route ? `· ${s.lastPos.dist_to_route}m` : ''}
                </div>
              )}
              {isOffline && (
                <div className="car-alert-tag tag-offline">
                  📡 Sinal perdido
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
