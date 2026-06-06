import { useState, useEffect } from 'react';

export default function QRManager({ routes = [], eventSelector }) {
  const [qrData, setQrData] = useState({});

  // Gera QR para cada rota nova
  useEffect(() => {
    routes.forEach(r => {
      if (qrData[r.id]) return;
      fetch(`/api/qr/${r.id}`)
        .then(res => res.json())
        .then(data => setQrData(prev => ({ ...prev, [r.id]: data })));
    });
  }, [routes]);

  function downloadQR(routeId, routeName) {
    const d = qrData[routeId];
    if (!d) return;
    const a = document.createElement('a');
    a.href = d.qr;
    a.download = `qr-${routeName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`;
    a.click();
  }

  function printQR(routeId) {
    const d = qrData[routeId];
    if (!d) return;
    const route = routes.find(r => r.id === routeId);
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>QR Code — ${route.name}</title>
      <style>
        body { font-family: sans-serif; text-align: center; padding: 40px; }
        img { width: 300px; height: 300px; display: block; margin: 20px auto; }
        h2 { font-size: 20px; margin-bottom: 8px; }
        p { font-size: 13px; color: #666; }
        @media print { button { display: none; } }
      </style></head>
      <body>
        <h2>${route.name}</h2>
        <img src="${d.qr}" alt="QR Code">
        <p>Escaneie para registrar e iniciar o rastreamento</p>
        <p style="font-size:11px;color:#999">${d.url}</p>
        <button onclick="window.print()" style="margin-top:16px;padding:10px 20px;font-size:14px;cursor:pointer">Imprimir</button>
      </body></html>
    `);
    win.document.close();
  }

  return (
    <div className="qr-page">
      <div className="qr-header">
        <div>
          <h2>📲 QR Codes por Rota</h2>
          <p style={{ color: '#607d8b', fontSize: 13, marginTop: 4 }}>
            Entregue o QR Code ao motorista. Ao escanear, ele abre a página de registro com a rota já selecionada.
          </p>
        </div>
        {eventSelector}
      </div>

      {routes.length === 0 && (
        <div className="events-empty">
          <span style={{ fontSize: 48 }}>📲</span>
          <p>Nenhuma rota neste evento.</p>
          <p style={{ color: '#aaa', fontSize: 13 }}>Crie rotas na aba Eventos.</p>
        </div>
      )}

      <div className="qr-grid">
        {routes.map(r => (
          <div key={r.id} className="qr-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: r.color, display: 'inline-block', flexShrink: 0 }} />
              <h3 style={{ textAlign: 'left', flex: 1 }}>{r.name}</h3>
            </div>

            {qrData[r.id] ? (
              <>
                <a href={qrData[r.id].url} target="_blank" rel="noreferrer" title="Abrir página do motorista">
                  <img src={qrData[r.id].qr} alt={`QR ${r.name}`}
                    style={{ cursor: 'pointer', borderRadius: 8, border: '2px solid #eee' }} />
                </a>
                <div className="qr-url">{qrData[r.id].url}</div>
                <div className="qr-actions" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
                  <a href={qrData[r.id].url} target="_blank" rel="noreferrer" className="btn-sm"
                    style={{ background: '#1565c0', color: '#fff', textDecoration: 'none', padding: '8px 16px', borderRadius: 6, fontWeight: 700, fontSize: 13 }}>
                    🔗 Abrir página
                  </a>
                  <button className="btn-sm btn-download" onClick={() => downloadQR(r.id, r.name)}>⬇ Baixar QR</button>
                  <button className="btn-sm btn-print" onClick={() => printQR(r.id)}>🖨 Imprimir</button>
                </div>
              </>
            ) : (
              <div style={{ color: '#90a4ae', fontSize: 13, padding: '20px 0' }}>Gerando QR...</div>
            )}

            {r.departure_times?.length > 0 && (
              <div style={{ fontSize: 11, color: '#90a4ae', textAlign: 'center' }}>
                Horários: {r.departure_times.join(' · ')}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
