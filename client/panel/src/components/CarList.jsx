export default function CarList({ sessions, selectedId, onSelect }) {
  const active = sessions.filter(s => s.status === 'active').length;

  function fmtTime(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleTimeString('pt-BR');
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span>Veículos</span>
        <span className="car-count">{active} online</span>
      </div>

      <div className="sidebar-list">
        {sessions.length === 0 && (
          <div style={{ padding: '24px 16px', color: '#90a4ae', fontSize: 13 }}>
            Nenhum motorista ativo. Escaneie um QR Code para iniciar.
          </div>
        )}

        {sessions.map(s => (
          <div
            key={s.id}
            className={[
              'car-card',
              s.id === selectedId ? 'selected' : '',
              s.off_route ? 'off-route' : '',
            ].join(' ')}
            onClick={() => onSelect(s.id === selectedId ? null : s.id)}
          >
            <div className="car-header">
              <span className="car-color-dot" style={{ background: s.color || '#607d8b' }} />
              <span className="car-driver">{s.driver_name}</span>
              <span className={`status-badge ${s.status === 'active' ? 'active' : 'offline'}`}>
                {s.status === 'active' ? 'Online' : 'Sem sinal'}
              </span>
            </div>

            <div className="car-route">{s.route_name}</div>

            <div className="car-meta">
              📞 {s.driver_phone}
              {s.departure_time && <> · Saída {s.departure_time}</>}
            </div>

            <div className="car-meta">
              Última pos.: {fmtTime(s.lastPos?.timestamp)}
              {s.lastPos?.accuracy && <> · ±{Math.round(s.lastPos.accuracy)}m</>}
            </div>

            {s.off_route ? (
              <span className="car-off-route-tag">⚠️ Fora da rota</span>
            ) : null}
          </div>
        ))}
      </div>
    </aside>
  );
}
