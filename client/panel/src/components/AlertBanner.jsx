export default function AlertBanner({ alert, onClose }) {
  return (
    <div className="alert-banner">
      <span style={{ fontSize: 22 }}>⚠️</span>
      <div>
        <strong>{alert.driver_name} saiu da rota!</strong>
        <small>
          Rota: {alert.route_name} · {alert.dist ? `${alert.dist}m fora da rota` : ''} ·{' '}
          {new Date(alert.timestamp).toLocaleTimeString('pt-BR')}
        </small>
      </div>
      <button className="alert-close" onClick={onClose} aria-label="Fechar">✕</button>
    </div>
  );
}
