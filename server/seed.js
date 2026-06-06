const db = require('./db');

db.exec('DELETE FROM positions; DELETE FROM sessions; DELETE FROM routes;');
db.exec("DELETE FROM sqlite_sequence WHERE name IN ('routes','sessions','positions')");

// Segmento final compartilhado por 4 rotas:
// Av. Padre Leonel Franca → Túneis → Barra → Av. Lúcio Costa
const GAVEA_ATE_LUCIO_COSTA = [
  [-22.9737, -43.2261], // Av. Padre Leonel Franca (Gávea/PUC-Rio)
  [-22.9763, -43.2300], // Túnel Acústico Rafael Mascarenhas (entrada)
  [-22.9897, -43.2579], // São Conrado (saída Túnel Rafael Mascarenhas)
  [-22.9937, -43.2680], // Túnel Zuzu Angel
  [-22.9967, -43.2810], // Autoestrada Eng. Fernando Mac Dowell
  [-22.9990, -43.2940], // Estrada da Gávea
  [-23.0003, -43.3010], // Túnel do Pepino (entrada São Conrado)
  [-23.0038, -43.3065], // Túnel do Pepino (saída Barra)
  [-23.0060, -43.3130], // Elevado Presidente Itamar Franco
  [-23.0083, -43.3270], // Av. Min. Ivan Lins
  [-23.0083, -43.3450], // Av. Armando Lombardi
  [-23.0067, -43.3640], // Av. das Américas
  [-23.0183, -43.4100], // Av. Gláucio Gil
  [-23.0233, -43.4367], // Av. Lúcio Costa (Recreio — destino)
];

const routes = [
  // ──────────────────────────────────────────────────────────────────────
  // ROTA 1 — Novotel Botafogo → Av. Lúcio Costa
  // Novotel (Praia de Botafogo 330) → São Clemente → Humaitá →
  // Jardim Botânico → Rodrigo Otávio → Padre Leonel Franca → Túneis → Barra
  // ──────────────────────────────────────────────────────────────────────
  {
    name: 'Novotel → Av. Lúcio Costa',
    color: '#e74c3c',
    coordinates: JSON.stringify([
      [-22.9476, -43.1783], // Novotel, Praia de Botafogo 330 (origem)
      [-22.9490, -43.1810], // Praia de Botafogo (sentido sul)
      [-22.9424, -43.1869], // Rua São Clemente
      [-22.9360, -43.1910], // Rua Humaitá
      [-22.9330, -43.1950], // Humaitá (continuação)
      [-22.9530, -43.2100], // Rua Jardim Botânico
      [-22.9640, -43.2170], // Jardim Botânico (continuação)
      [-22.9687, -43.2192], // Av. Rodrigo Otávio (Jockey Club)
      ...GAVEA_ATE_LUCIO_COSTA,
    ]),
    checkpoints: JSON.stringify([
      { lat: -22.9424, lng: -43.1869, name: 'Rua São Clemente' },
      { lat: -22.9530, lng: -43.2100, name: 'Rua Jardim Botânico' },
      { lat: -22.9687, lng: -43.2192, name: 'Av. Rodrigo Otávio (Jockey Club)' },
      { lat: -22.9763, lng: -43.2300, name: 'Túnel Rafael Mascarenhas (entrada)' },
      { lat: -23.0038, lng: -43.3065, name: 'Túnel do Pepino (saída Barra)' },
    ]),
    departure_times: JSON.stringify([
      '03:30','03:31','03:32','03:33','03:34','03:35','03:36',
      '03:37','03:38','03:39','03:40',
    ]),
  },

  // ──────────────────────────────────────────────────────────────────────
  // ROTA 2 — JW Marriott (Copacabana) → Av. Lúcio Costa
  // Av. Atlântica → Barão de Ipanema → Pompeu Loureiro → Henrique Dodsworth →
  // Viaduto Schmidt → Epitácio Pessoa (Lagoa) → Borges de Medeiros →
  // Mario Ribeiro → Padre Leonel Franca → Túneis → Barra
  // ──────────────────────────────────────────────────────────────────────
  {
    name: 'JW Marriott → Av. Lúcio Costa',
    color: '#2980b9',
    coordinates: JSON.stringify([
      [-22.9710, -43.1831], // JW Marriott, Av. Atlântica 2600 (origem)
      [-22.9710, -43.1870], // Av. Atlântica (sentido Ipanema)
      [-22.9710, -43.1897], // Rua Barão de Ipanema
      [-22.9694, -43.1933], // Rua Pompeu Loureiro
      [-22.9680, -43.1980], // Av. Henrique Dodsworth
      [-22.9716, -43.1992], // Viaduto Augusto Frederico Schmidt
      [-22.9716, -43.2075], // Av. Epitácio Pessoa (Lagoa)
      [-22.9667, -43.2167], // Av. Borges de Medeiros (Lagoa)
      [-22.9680, -43.2210], // Rua Gilberto Cardoso
      [-22.9700, -43.2250], // Rua Mario Ribeiro
      ...GAVEA_ATE_LUCIO_COSTA,
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

  // ──────────────────────────────────────────────────────────────────────
  // ROTA 3 — Hotel H (Niterói) → Av. Lúcio Costa
  // Rua Dr Paulo Alves (Ingá/Niterói) → Av. Washington Luiz →
  // Ponte Pres. Costa e Silva → Linha Vermelha → Linha Amarela →
  // Av. Ayrton Senna → Av. das Américas → Gláucio Gil → Lúcio Costa
  // ──────────────────────────────────────────────────────────────────────
  {
    name: 'Hotel H (Niterói) → Av. Lúcio Costa',
    color: '#27ae60',
    coordinates: JSON.stringify([
      [-22.9027, -43.1309], // Rua Dr Paulo Alves 14, Ingá — Niterói (origem)
      [-22.9000, -43.1267], // Rua São Sebastião
      [-22.8967, -43.1200], // Av. Badger da Silva
      [-22.8933, -43.1133], // Av. Visconde do Rio Branco
      [-22.8900, -43.1067], // Av. Feliciano Sodré
      [-22.8850, -43.1000], // Av. Washington Luiz
      [-22.8803, -43.1104], // Pte. Pres. Costa e Silva — lado Niterói
      [-22.8700, -43.1450], // Meio da ponte (Rio-Niterói)
      [-22.8683, -43.1700], // Pte. Pres. Costa e Silva — lado Rio (Caju)
      [-22.8767, -43.1867], // Início Linha Vermelha (Rio)
      [-22.8900, -43.2200], // Linha Vermelha (norte do Rio)
      [-22.8917, -43.2600], // Linha Vermelha (continuação)
      [-22.8900, -43.3083], // Entroncamento Linha Amarela
      [-22.9100, -43.3500], // Linha Amarela (sentido Barra)
      [-22.9433, -43.3833], // Av. Ayrton Senna
      [-22.9767, -43.3983], // Av. das Américas (início, Barra)
      [-23.0183, -43.4100], // Av. Gláucio Gil
      [-23.0233, -43.4367], // Av. Lúcio Costa (Recreio — destino)
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

  // ──────────────────────────────────────────────────────────────────────
  // ROTA 4 — Hotel Novo Mundo (Glória/Flamengo) → Av. Lúcio Costa
  // Rua do Russel 804 → Praia do Flamengo → Oswaldo Cruz →
  // Praia de Botafogo → São Clemente → Humaitá → Jardim Botânico →
  // Rodrigo Otávio → Padre Leonel Franca → Túneis → Barra
  // ──────────────────────────────────────────────────────────────────────
  {
    name: 'Hotel Novo Mundo → Av. Lúcio Costa',
    color: '#8e44ad',
    coordinates: JSON.stringify([
      [-22.9215, -43.1744], // Rua do Russel 804, Glória (origem)
      [-22.9240, -43.1753], // Praia do Flamengo (início)
      [-22.9310, -43.1780], // Praia do Flamengo (continuação)
      [-22.9380, -43.1803], // Av. Oswaldo Cruz
      [-22.9476, -43.1783], // Praia de Botafogo
      [-22.9424, -43.1869], // Rua São Clemente
      [-22.9360, -43.1910], // Rua Humaitá
      [-22.9330, -43.1950], // Humaitá (continuação)
      [-22.9530, -43.2100], // Rua Jardim Botânico
      [-22.9640, -43.2170], // Jardim Botânico (continuação)
      [-22.9687, -43.2192], // Av. Rodrigo Otávio
      ...GAVEA_ATE_LUCIO_COSTA,
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

  // ──────────────────────────────────────────────────────────────────────
  // ROTA 5 — Hotel Janeiro (Leblon) → Av. Lúcio Costa
  // Av. Bartolomeu Mitre 24 → Rua Mario Ribeiro →
  // Av. Padre Leonel Franca → Túneis → Barra
  // (rota mais curta — já sai de Leblon/Gávea)
  // ──────────────────────────────────────────────────────────────────────
  {
    name: 'Hotel Janeiro (Leblon) → Av. Lúcio Costa',
    color: '#d35400',
    coordinates: JSON.stringify([
      [-22.9876, -43.2237], // Av. Bartolomeu Mitre 24, Leblon (origem)
      [-22.9820, -43.2270], // Av. Bartolomeu Mitre (continuação)
      [-22.9750, -43.2267], // Rua Mario Ribeiro
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

const insert = db.prepare(`
  INSERT INTO routes (name, color, coordinates, checkpoints, departure_times)
  VALUES (@name, @color, @coordinates, @checkpoints, @departure_times)
`);

db.exec('BEGIN');
try {
  for (const r of routes) insert.run(r);
  db.exec('COMMIT');
} catch (e) {
  db.exec('ROLLBACK');
  throw e;
}

console.log(`\n✅ ${routes.length} rotas inseridas:\n`);
routes.forEach((r, i) => console.log(`   ${i + 1}. ${r.name}`));
console.log('');
