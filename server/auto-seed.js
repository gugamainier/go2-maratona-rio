/**
 * Auto-seed: insere as 5 rotas se a tabela estiver vazia.
 * Chamado pelo server/index.js na inicialização.
 */
const db = require('./db');

const count = db.prepare('SELECT COUNT(*) as n FROM routes').get().n;
if (count > 0) return;  // já tem dados

const GAVEA_ATE_LUCIO_COSTA = [
  [-22.9737, -43.2261],
  [-22.9763, -43.2300],
  [-22.9897, -43.2579],
  [-22.9937, -43.2680],
  [-22.9967, -43.2810],
  [-22.9990, -43.2940],
  [-23.0003, -43.3010],
  [-23.0038, -43.3065],
  [-23.0060, -43.3130],
  [-23.0083, -43.3270],
  [-23.0083, -43.3450],
  [-23.0067, -43.3640],
  [-23.0183, -43.4100],
  [-23.0233, -43.4367],
];

const routes = [
  {
    name: 'Novotel → Av. Lúcio Costa',
    color: '#e74c3c',
    coordinates: JSON.stringify([
      [-22.9476, -43.1783],[-22.9490, -43.1810],[-22.9424, -43.1869],
      [-22.9360, -43.1910],[-22.9330, -43.1950],[-22.9530, -43.2100],
      [-22.9640, -43.2170],[-22.9687, -43.2192],...GAVEA_ATE_LUCIO_COSTA,
    ]),
    checkpoints: JSON.stringify([
      { lat: -22.9424, lng: -43.1869, name: 'Rua São Clemente' },
      { lat: -22.9530, lng: -43.2100, name: 'Rua Jardim Botânico' },
      { lat: -22.9687, lng: -43.2192, name: 'Av. Rodrigo Otávio (Jockey Club)' },
      { lat: -22.9763, lng: -43.2300, name: 'Túnel Rafael Mascarenhas (entrada)' },
      { lat: -23.0038, lng: -43.3065, name: 'Túnel do Pepino (saída Barra)' },
    ]),
    departure_times: JSON.stringify(['03:30','03:31','03:32','03:33','03:34','03:35','03:36','03:37','03:38','03:39','03:40']),
  },
  {
    name: 'JW Marriott → Av. Lúcio Costa',
    color: '#2980b9',
    coordinates: JSON.stringify([
      [-22.9710, -43.1831],[-22.9710, -43.1870],[-22.9710, -43.1897],
      [-22.9694, -43.1933],[-22.9680, -43.1980],[-22.9716, -43.1992],
      [-22.9716, -43.2075],[-22.9667, -43.2167],[-22.9680, -43.2210],
      [-22.9700, -43.2250],...GAVEA_ATE_LUCIO_COSTA,
    ]),
    checkpoints: JSON.stringify([
      { lat: -22.9710, lng: -43.1897, name: 'Rua Barão de Ipanema' },
      { lat: -22.9716, lng: -43.2075, name: 'Av. Epitácio Pessoa (Lagoa)' },
      { lat: -22.9667, lng: -43.2167, name: 'Av. Borges de Medeiros' },
      { lat: -22.9763, lng: -43.2300, name: 'Túnel Rafael Mascarenhas (entrada)' },
      { lat: -23.0038, lng: -43.3065, name: 'Túnel do Pepino (saída Barra)' },
    ]),
    departure_times: JSON.stringify([
      '03:17','03:18','03:19','03:20','03:21','03:22','03:23','03:24',
      '03:25','03:26','03:27','03:28','03:29','03:30','03:31','03:32',
      '03:33','03:34','03:35','03:36','03:37','03:38','03:39','03:40',
    ]),
  },
  {
    name: 'Hotel H (Niterói) → Av. Lúcio Costa',
    color: '#27ae60',
    coordinates: JSON.stringify([
      [-22.9027, -43.1309],[-22.9000, -43.1267],[-22.8967, -43.1200],
      [-22.8933, -43.1133],[-22.8900, -43.1067],[-22.8850, -43.1000],
      [-22.8803, -43.1104],[-22.8700, -43.1450],[-22.8683, -43.1700],
      [-22.8767, -43.1867],[-22.8900, -43.2200],[-22.8917, -43.2600],
      [-22.8900, -43.3083],[-22.9100, -43.3500],[-22.9433, -43.3833],
      [-22.9767, -43.3983],[-23.0183, -43.4100],[-23.0233, -43.4367],
    ]),
    checkpoints: JSON.stringify([
      { lat: -22.8803, lng: -43.1104, name: 'Ponte Rio-Niterói (lado Niterói)' },
      { lat: -22.8683, lng: -43.1700, name: 'Ponte Rio-Niterói (lado Rio)' },
      { lat: -22.8900, lng: -43.3083, name: 'Entroncamento Linha Amarela' },
      { lat: -22.9433, lng: -43.3833, name: 'Av. Ayrton Senna' },
      { lat: -23.0183, lng: -43.4100, name: 'Av. Gláucio Gil' },
    ]),
    departure_times: JSON.stringify(['03:00','03:01','03:02','03:03']),
  },
  {
    name: 'Hotel Novo Mundo → Av. Lúcio Costa',
    color: '#8e44ad',
    coordinates: JSON.stringify([
      [-22.9215, -43.1744],[-22.9240, -43.1753],[-22.9310, -43.1780],
      [-22.9380, -43.1803],[-22.9476, -43.1783],[-22.9424, -43.1869],
      [-22.9360, -43.1910],[-22.9330, -43.1950],[-22.9530, -43.2100],
      [-22.9640, -43.2170],[-22.9687, -43.2192],...GAVEA_ATE_LUCIO_COSTA,
    ]),
    checkpoints: JSON.stringify([
      { lat: -22.9310, lng: -43.1780, name: 'Praia do Flamengo' },
      { lat: -22.9424, lng: -43.1869, name: 'Rua São Clemente' },
      { lat: -22.9530, lng: -43.2100, name: 'Rua Jardim Botânico' },
      { lat: -22.9763, lng: -43.2300, name: 'Túnel Rafael Mascarenhas (entrada)' },
      { lat: -23.0038, lng: -43.3065, name: 'Túnel do Pepino (saída Barra)' },
    ]),
    departure_times: JSON.stringify([
      '03:16','03:17','03:18','03:19','03:20','03:21','03:22','03:23',
      '03:24','03:25','03:26','03:27','03:28','03:29','03:30','03:31',
      '03:32','03:33','03:34','03:35','03:36','03:37','03:38','03:39',
      '03:40','03:41','03:42',
    ]),
  },
  {
    name: 'Hotel Janeiro (Leblon) → Av. Lúcio Costa',
    color: '#d35400',
    coordinates: JSON.stringify([
      [-22.9876, -43.2237],[-22.9820, -43.2270],[-22.9750, -43.2267],
      ...GAVEA_ATE_LUCIO_COSTA,
    ]),
    checkpoints: JSON.stringify([
      { lat: -22.9750, lng: -43.2267, name: 'Rua Mario Ribeiro (Gávea)' },
      { lat: -22.9763, lng: -43.2300, name: 'Túnel Rafael Mascarenhas (entrada)' },
      { lat: -22.9897, lng: -43.2579, name: 'São Conrado (saída Túnel)' },
      { lat: -23.0038, lng: -43.3065, name: 'Túnel do Pepino (saída Barra)' },
    ]),
    departure_times: JSON.stringify(['03:30','03:31','03:32','03:33','03:34','03:35','03:36']),
  },
];

const insert = db.prepare(
  'INSERT INTO routes (name, color, coordinates, checkpoints, departure_times) VALUES (@name, @color, @coordinates, @checkpoints, @departure_times)'
);

db.exec('BEGIN');
try {
  for (const r of routes) insert.run(r);
  db.exec('COMMIT');
  console.log(`✅ Auto-seed: ${routes.length} rotas inseridas.`);
} catch (e) {
  db.exec('ROLLBACK');
  console.error('❌ Auto-seed falhou:', e.message);
}
