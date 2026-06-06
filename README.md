# TransporteRJ — Sistema de Rastreamento

Sistema web de rastreamento em tempo real para transporte executivo.

## Requisitos

- Node.js 18+
- npm 9+

## Rodando localmente

### 1. Instalar dependências

```bash
cd transport-tracker
npm run setup
```

### 2. Popular o banco com rotas de exemplo

```bash
npm run seed
```

### 3. Iniciar o servidor (modo desenvolvimento)

```bash
npm run dev
```

### 4. Em outro terminal, iniciar o painel React (desenvolvimento)

```bash
cd client/panel
npm run dev
```

### URLs de desenvolvimento

| O quê | URL |
|---|---|
| Painel (React dev) | http://localhost:5173/panel/ |
| Página do motorista — Linha 1 | http://localhost:3000/driver/?rota=1 |
| Página do motorista — Linha 2 | http://localhost:3000/driver/?rota=2 |
| API | http://localhost:3000/api/routes |

> Para testar o GPS em dois dispositivos na mesma rede:
> Abra `http://SEU-IP-LOCAL:3000/driver/?rota=1` no celular.
> Descubra seu IP com `ipconfig` (Windows) ou `ifconfig` / `ip addr` (Mac/Linux).

---

## Build para produção (painel + servidor)

```bash
# Na raiz do projeto
npm run build          # compila o React

# Inicia o servidor (serve painel + motorista + API tudo junto)
npm start
```

Acesse tudo em: `http://localhost:3000`

---

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `3000` | Porta do servidor |
| `OFFLINE_THRESHOLD_MS` | `15000` | Tempo em ms sem posição para marcar como "sem sinal" |
| `OFF_ROUTE_THRESHOLD_M` | `200` | Distância em metros da rota para disparar alerta |

Exemplo:
```bash
OFFLINE_THRESHOLD_MS=10000 OFF_ROUTE_THRESHOLD_M=150 npm start
```

---

## Subindo para produção (VPS simples)

### Opção recomendada: Railway / Render (gratuito para começar)

1. Crie um repositório Git e faça push do projeto
2. No [Railway](https://railway.app) ou [Render](https://render.com): conecte o repo
3. Build command: `npm run setup && npm run seed && npm run build`
4. Start command: `npm start`
5. Configure as variáveis de ambiente no painel da plataforma

### Opção VPS (DigitalOcean, Contabo, etc.)

```bash
# No servidor
git clone seu-repo transport-tracker
cd transport-tracker
npm run setup
npm run seed
npm run build

# Instale PM2 para manter o servidor rodando
npm install -g pm2
pm2 start server/index.js --name transport-tracker
pm2 save
pm2 startup

# Nginx (reverse proxy)
# Aponte /  →  http://localhost:3000
```

Exemplo de config Nginx:
```nginx
server {
    listen 80;
    server_name seudominio.com.br;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Depois, instale SSL com Let's Encrypt:
```bash
certbot --nginx -d seudominio.com.br
```

---

## Estrutura do projeto

```
transport-tracker/
├── server/
│   ├── index.js        # Express + Socket.IO + API REST
│   ├── db.js           # SQLite (better-sqlite3)
│   └── seed.js         # Dados de exemplo (4 rotas do Rio)
├── client/
│   ├── driver/         # Página do motorista (HTML puro, mobile-first)
│   │   ├── index.html
│   │   ├── style.css
│   │   ├── driver.js
│   │   └── manifest.json  # PWA
│   └── panel/          # Painel do despachante (React + Vite)
│       └── src/
│           ├── App.jsx
│           └── components/
│               ├── MapView.jsx      # Mapa Leaflet + marcadores em tempo real
│               ├── CarList.jsx      # Lista lateral de veículos
│               ├── AlertBanner.jsx  # Alerta visual + sonoro fora da rota
│               ├── QRManager.jsx    # Gerador/visualizador de QR Codes
│               └── HistoryView.jsx  # Histórico de percursos
└── data/
    └── tracker.db      # Banco SQLite (gerado automaticamente)
```

## Próximas etapas (Fase 2+)

- Login/autenticação no painel
- Edição de rotas diretamente no mapa (draw)
- Notificações push quando motorista sai da rota
- Painel multi-empresa
- Migração para PostgreSQL
