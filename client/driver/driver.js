'use strict';

// ── Estado ───────────────────────────────────────────────────────────────────
let socket       = null;
let sessionId    = null;
let routeData    = null;
let map          = null;
let driverMarker = null;
let routeLine    = null;
let wakeLock     = null;
let muted        = false;
let followDriver = true;

// Navegação turn-by-turn
let steps        = [];   // lista de manobras do OSRM
let stepIndex    = 0;    // índice da manobra atual
let announced    = new Set(); // índices já anunciados

// ── Helpers ──────────────────────────────────────────────────────────────────
function getParam(k) { return new URLSearchParams(window.location.search).get(k); }

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.remove('hidden');
}
function hideError(id) { document.getElementById(id).classList.add('hidden'); }

function fmtDist(m) {
  if (m == null) return '—';
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

function fmtTime(seconds) {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const min = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${min}min`;
  return `${min} min`;
}

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000, toR = d => d * Math.PI / 180;
  const dLat = toR(lat2 - lat1), dLng = toR(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toR(lat1))*Math.cos(toR(lat2))*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ── Tradução de manobras OSRM → Português ────────────────────────────────────
const MODIFIER_PT = {
  'uturn':        'Faça o retorno',
  'sharp right':  'Vire à direita (acentuado)',
  'right':        'Vire à direita',
  'slight right': 'Mantenha à direita',
  'straight':     'Siga em frente',
  'slight left':  'Mantenha à esquerda',
  'left':         'Vire à esquerda',
  'sharp left':   'Vire à esquerda (acentuado)',
};

const TYPE_PT = {
  'depart':           'Siga em frente',
  'arrive':           'Você chegou ao destino',
  'merge':            'Entre na via',
  'on ramp':          'Entre na rampa',
  'off ramp':         'Saída',
  'fork':             'Mantenha-se',
  'end of road':      'No fim da rua',
  'use lane':         'Use a faixa',
  'continue':         'Continue em',
  'roundabout':       'Entre na rotatória',
  'rotary':           'Entre na rotatória',
  'roundabout turn':  'Na rotatória, vire',
  'notification':     'Atenção',
  'exit roundabout':  'Saia da rotatória',
  'exit rotary':      'Saia da rotatória',
  'turn':             null, // usa modifier
};

const ARROW = {
  'uturn':        '↩',
  'sharp right':  '↱',
  'right':        '→',
  'slight right': '↗',
  'straight':     '↑',
  'slight left':  '↖',
  'left':         '←',
  'sharp left':   '↰',
  'roundabout':   '🔄',
  'rotary':       '🔄',
  'arrive':       '🏁',
  'depart':       '↑',
  'merge':        '↑',
  'default':      '↑',
};

function translateStep(step) {
  const type     = step.maneuver?.type || '';
  const modifier = step.maneuver?.modifier || '';
  const street   = step.name || '';

  let action = TYPE_PT[type] ?? MODIFIER_PT[modifier] ?? 'Siga em frente';
  if (type === 'turn' || type === 'continue' || type === 'fork' || type === 'end of road') {
    action = MODIFIER_PT[modifier] || action;
  }
  if (type === 'arrive') action = 'Você chegou ao destino';

  let arrow = ARROW[modifier] || ARROW[type] || ARROW['default'];
  if (type === 'arrive')                    arrow = '🏁';
  if (type === 'roundabout' || type === 'rotary') arrow = '🔄';

  const streetLabel = street ? `em ${street}` : '';
  const voice = street ? `${action} ${streetLabel}` : action;

  return { action, arrow, street, voice };
}

// ── Voz (Web Speech API) ─────────────────────────────────────────────────────
function speak(text) {
  if (muted || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'pt-BR';
  u.rate = 1.05;
  u.pitch = 1;
  // tentar usar voz pt-BR se disponível
  const voices = speechSynthesis.getVoices();
  const ptVoice = voices.find(v => v.lang.startsWith('pt'));
  if (ptVoice) u.voice = ptVoice;
  speechSynthesis.speak(u);
}

window.toggleMute = function () {
  muted = !muted;
  const btn = document.getElementById('btn-mute');
  btn.textContent = muted ? '🔇' : '🔊';
  btn.classList.toggle('muted', muted);
  if (!muted) speak('Som ativado');
};

// ── OSRM: buscar rota com turn-by-turn ───────────────────────────────────────
async function fetchNavRoute(waypoints) {
  // waypoints: [[lat,lng], ...] — OSRM usa lng,lat
  const coords = waypoints.map(([lat, lng]) => `${lng},${lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}`
            + `?steps=true&overview=full&geometries=geojson&annotations=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Erro OSRM');
  const data = await res.json();
  if (data.code !== 'Ok') throw new Error('Rota não encontrada');
  return data.routes[0];
}

// ── Inicializar mapa ─────────────────────────────────────────────────────────
function initMap(centerLatLng) {
  map = L.map('driver-map', {
    center: centerLatLng,
    zoom: 15,
    zoomControl: true,
    attributionControl: true,
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CartoDB',
    maxZoom: 19,
  }).addTo(map);

  // Marcador do motorista
  driverMarker = L.marker(centerLatLng, { icon: makeDriverIcon(routeData?.color) })
    .addTo(map);

  map.on('dragstart', () => { followDriver = false; });
}

function makeDriverIcon(color) {
  const bg = color || '#1565c0';
  return L.divIcon({
    className: '',
    html: `<div style="
      width:42px;height:42px;border-radius:50% 50% 50% 0;
      background:${bg};border:3px solid #fff;
      box-shadow:0 3px 10px rgba(0,0,0,.5);
      transform:rotate(-45deg);
      display:flex;align-items:center;justify-content:center;
    "><span style="transform:rotate(45deg);font-size:20px">🚗</span></div>`,
    iconSize: [42, 42],
    iconAnchor: [21, 42],
  });
}

function makeCheckpointIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:14px;height:14px;border-radius:50%;
      background:#ff9800;border:3px solid #fff;
      box-shadow:0 1px 5px rgba(0,0,0,.35);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

// Desenhar rota OSRM no mapa
function drawOSRMRoute(osrmRoute, color) {
  if (routeLine) { routeLine.remove(); routeLine = null; }

  const coords = osrmRoute.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  routeLine = L.polyline(coords, {
    color: color || '#1565c0',
    weight: 7,
    opacity: 0.85,
    lineJoin: 'round',
  }).addTo(map);

  map.fitBounds(routeLine.getBounds(), { padding: [60, 60] });
}

// Desenhar checkpoints e destino
function drawExtras(route) {
  // Checkpoints
  (route.checkpoints || []).forEach(cp => {
    L.marker([cp.lat, cp.lng], { icon: makeCheckpointIcon() })
      .bindTooltip(cp.name, { direction: 'top' })
      .addTo(map);
  });

  // Destino
  const coords = route.coordinates;
  const dest = coords[coords.length - 1];
  L.marker(dest, {
    icon: L.divIcon({
      className: '',
      html: `<div style="font-size:30px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.4))">🏁</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 30],
    })
  }).bindTooltip(`🏁 Destino: ${routeData.name.split('→').pop()?.trim() || 'Destino final'}`).addTo(map);
}

// ── Atualizar instrução na tela ───────────────────────────────────────────────
function updateInstruction(step, distToStep) {
  const { action, arrow, street } = translateStep(step);

  document.getElementById('nav-arrow').textContent  = arrow;
  document.getElementById('nav-action').textContent = action;
  document.getElementById('nav-street').textContent = street;
  document.getElementById('nav-dist').textContent   = fmtDist(distToStep);

  // Próxima manobra
  const nextStep = steps[stepIndex + 1];
  const nextEl   = document.getElementById('nav-next');
  if (nextStep && step.maneuver?.type !== 'arrive') {
    const next = translateStep(nextStep);
    document.getElementById('nav-next-arrow').textContent = next.arrow;
    document.getElementById('nav-next-text').textContent  =
      `Depois: ${next.action}${nextStep.name ? ' em ' + nextStep.name : ''}`;
    nextEl.classList.remove('hidden');
  } else {
    nextEl.classList.add('hidden');
  }
}

// ── Encontrar e avançar instrução com base na posição GPS ─────────────────────
function processPosition(lat, lng) {
  if (!steps.length) return;

  // Calcular distância para o ponto de manobra do step atual
  const cur = steps[stepIndex];
  const [mLng, mLat] = cur.maneuver.location;
  const distToManeuver = haversineM(lat, lng, mLat, mLng);

  updateInstruction(cur, distToManeuver);

  // Anunciar quando a menos de 250m do próximo step (e não chegou ainda)
  const announceKey = `${stepIndex}-250`;
  if (distToManeuver < 250 && !announced.has(announceKey)) {
    announced.add(announceKey);
    const { voice } = translateStep(cur);
    if (stepIndex > 0) speak(voice); // não anunciar o primeiro "depart"
  }

  // Anunciar quando muito próximo (50m)
  const immKey = `${stepIndex}-50`;
  if (distToManeuver < 50 && !announced.has(immKey)) {
    announced.add(immKey);
    const { voice } = translateStep(cur);
    speak(voice);
  }

  // Avançar para o próximo step se chegou perto o suficiente
  if (distToManeuver < 40 && stepIndex < steps.length - 1) {
    stepIndex++;
    announced.delete(`${stepIndex}-250`); // permitir anunciar o novo
    announced.delete(`${stepIndex}-50`);
  }

  // Atualizar distância total restante (soma dos steps restantes)
  let remaining = distToManeuver;
  for (let i = stepIndex + 1; i < steps.length; i++) remaining += steps[i].distance;
  document.getElementById('b-dist').textContent = fmtDist(remaining);
}

// ── Atualizar posição do marcador no mapa ─────────────────────────────────────
function updateMapPosition(lat, lng) {
  if (!driverMarker) return;
  driverMarker.setLatLng([lat, lng]);
  if (followDriver) {
    map.setView([lat, lng], Math.max(map.getZoom(), 16), { animate: true, duration: 0.5 });
  }
}

window.centerOnMe = function () {
  followDriver = true;
  if (driverMarker) map.setView(driverMarker.getLatLng(), 16, { animate: true });
};

// ── Carregar rota da API + OSRM ───────────────────────────────────────────────
async function loadRoute(routeId) {
  try {
    const res = await fetch(`/api/routes/${routeId}`);
    if (!res.ok) throw new Error();
    routeData = await res.json();

    document.getElementById('route-id').value      = routeData.id;
    document.getElementById('route-label').textContent = routeData.name;
    document.getElementById('route-dot').style.background = routeData.color || '#1565c0';

    const sel = document.getElementById('departure-time');
    (routeData.departure_times || []).forEach(t => {
      const opt = document.createElement('option');
      opt.value = t; opt.textContent = t;
      sel.appendChild(opt);
    });
  } catch {
    document.getElementById('route-label').textContent = 'Rota não encontrada';
    showError('form-error', 'Não foi possível carregar a rota. Verifique o QR Code.');
  }
}

// ── Formulário ────────────────────────────────────────────────────────────────
document.getElementById('driver-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError('form-error');

  const name      = document.getElementById('driver-name').value.trim();
  const phone     = document.getElementById('driver-phone').value.trim();
  const routeId   = document.getElementById('route-id').value;
  const departure = document.getElementById('departure-time').value;

  if (!name)    { showError('form-error', 'Informe seu nome completo.'); return; }
  if (!phone)   { showError('form-error', 'Informe seu telefone.'); return; }
  if (!routeId) { showError('form-error', 'Rota não carregada. Escaneie o QR novamente.'); return; }

  const btn = document.getElementById('btn-start');
  btn.disabled = true;
  btn.textContent = 'Registrando...';

  try {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driver_name: name, driver_phone: phone, route_id: routeId, departure_time: departure }),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Erro ao registrar');
    const data = await res.json();
    sessionId = data.session_id;
    showScreen('screen-gps');
  } catch (err) {
    showError('form-error', err.message);
    btn.disabled = false;
    btn.textContent = 'Iniciar navegação';
  }
});

// ── GPS ───────────────────────────────────────────────────────────────────────
document.getElementById('btn-gps').addEventListener('click', () => {
  hideError('gps-error');
  document.getElementById('btn-gps').disabled = true;
  document.getElementById('btn-gps').textContent = 'Aguardando permissão...';
  requestGPS();
});

function requestGPS() {
  if (!('geolocation' in navigator)) {
    showGPSError('Seu navegador não suporta GPS. Use o Chrome ou Safari no celular.');
    return;
  }
  // Tentar com alta precisão primeiro
  navigator.geolocation.getCurrentPosition(
    (pos) => startNavigation(pos.coords.latitude, pos.coords.longitude),
    (err) => {
      if (err.code === 1) {
        // Permissão negada — não tem fallback
        showGPSError(
          'Permissão de localização negada.\n\n' +
          '📱 No celular: Configurações → Safari/Chrome → Localização → Permitir.\n' +
          '💻 No Mac: Preferências do Sistema → Segurança e Privacidade → Privacidade → Serviços de Localização → ative para o Safari/Chrome.'
        );
      } else if (err.code === 2 || err.code === 3) {
        // GPS indisponível ou timeout — tentar sem alta precisão
        navigator.geolocation.getCurrentPosition(
          (pos) => startNavigation(pos.coords.latitude, pos.coords.longitude),
          () => showGPSFallback(),
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 }
        );
      }
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

function showGPSError(msg) {
  document.getElementById('gps-error').style.whiteSpace = 'pre-line';
  showError('gps-error', msg);
  resetGPSBtn();
}

// Fallback para desktop/teste: deixar o motorista pular o GPS e navegar sem posição real
function showGPSFallback() {
  const errEl = document.getElementById('gps-error');
  errEl.style.whiteSpace = 'pre-line';
  errEl.innerHTML = `
    <strong>GPS indisponível neste dispositivo.</strong><br><br>
    Se você está no <strong>celular</strong>:<br>
    • Verifique se o GPS está ativado<br>
    • Ative Serviços de Localização nas configurações do sistema<br>
    • Tente pelo Chrome se estiver no Safari<br><br>
    Se você está no <strong>computador</strong> (apenas para testes):
  `;
  errEl.classList.remove('hidden');

  // Botão de teste sem GPS
  const btnTest = document.createElement('button');
  btnTest.className = 'btn-primary';
  btnTest.style.marginTop = '10px';
  btnTest.textContent = '🖥 Abrir sem GPS (modo teste)';
  btnTest.onclick = () => {
    // Usar o início da rota como posição inicial
    const coords = routeData?.coordinates;
    if (coords?.length) {
      startNavigation(coords[0][0], coords[0][1], true);
    }
  };
  errEl.appendChild(btnTest);
  resetGPSBtn();
}

function resetGPSBtn() {
  document.getElementById('btn-gps').disabled = false;
  document.getElementById('btn-gps').textContent = 'Tentar novamente';
}

// ── Iniciar navegação ─────────────────────────────────────────────────────────
async function startNavigation(startLat, startLng, testMode = false) {
  showScreen('screen-tracking');
  initMap([startLat, startLng]);
  connectSocket();
  requestWakeLock();

  // Pré-voz: avisar que está calculando
  document.getElementById('nav-action').textContent = 'Calculando rota...';

  try {
    // Montar waypoints: posição atual + checkpoints + destino final
    const coords   = routeData.coordinates;
    const dest     = coords[coords.length - 1];
    const cps      = (routeData.checkpoints || []).map(cp => [cp.lat, cp.lng]);
    // máx 10 waypoints intermediários pra não sobrecarregar OSRM
    const sample   = cps.filter((_, i) => i % Math.ceil(cps.length / 8) === 0);
    const waypoints = [[startLat, startLng], ...sample, dest];

    const osrmRoute = await fetchNavRoute(waypoints);

    // Desenhar rota no mapa
    drawOSRMRoute(osrmRoute, routeData.color);
    drawExtras(routeData);

    // Extrair steps de todos os legs — pular o step "depart" (ponto de partida)
    steps = osrmRoute.legs.flatMap(leg => leg.steps);
    // Começa no step 1 (pula o "depart" que é exatamente onde o motorista está)
    stepIndex = steps.length > 1 ? 1 : 0;
    announced.clear();

    // Info de duração total
    const eta = new Date(Date.now() + osrmRoute.duration * 1000);
    document.getElementById('b-eta').textContent =
      eta.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('b-dist').textContent = fmtDist(osrmRoute.distance);

    // Primeira instrução real (não o depart)
    if (steps.length) updateInstruction(steps[stepIndex], steps[stepIndex].distance);

    speak(`Navegação iniciada. ${routeData.name}. Distância total: ${fmtDist(osrmRoute.distance)}.`);

  } catch (err) {
    console.warn('OSRM falhou, usando rota estática:', err);
    // Fallback: desenhar a rota do seed sem turn-by-turn
    const coords = routeData.coordinates;
    const line = L.polyline(coords, { color: routeData.color || '#1565c0', weight: 7, opacity: .85 }).addTo(map);
    map.fitBounds(line.getBounds(), { padding: [60, 60] });
    drawExtras(routeData);
    document.getElementById('nav-action').textContent = 'Siga a rota indicada';
    document.getElementById('nav-arrow').textContent  = '↑';
    document.getElementById('nav-street').textContent = routeData.name;
    speak('Rota carregada. Siga o trajeto indicado no mapa.');
  }

  // Iniciar watchPosition (só se houver GPS real)
  if (!testMode) {
    navigator.geolocation.watchPosition(
      onPosition,
      err => console.warn('GPS:', err.message),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
    );
  } else {
    // Modo teste: simular movimento ao longo da rota
    document.getElementById('b-gps').textContent = 'Modo teste';
    document.getElementById('conn-pill').style.background = '#fff3e0';
    simulateMovement();
  }
}

// ── Receber posição GPS ───────────────────────────────────────────────────────
function onPosition(pos) {
  const { latitude: lat, longitude: lng, accuracy, speed, heading } = pos.coords;

  updateMapPosition(lat, lng);
  if (steps.length) processPosition(lat, lng);

  document.getElementById('b-gps').textContent = accuracy ? `±${Math.round(accuracy)}m` : '—';

  if (socket?.connected) {
    socket.emit('driver:position', { session_id: sessionId, lat, lng, accuracy, speed, heading });
  }
}

// ── Socket.IO ─────────────────────────────────────────────────────────────────
function connectSocket() {
  socket = io({ transports: ['websocket', 'polling'] });

  socket.on('connect', () => {
    setConn('connected', 'Online');
    socket.emit('driver:join', { session_id: sessionId });
  });

  socket.on('disconnect', () => setConn('disconnected', 'Sem conexão'));
  socket.on('connect_error', () => setConn('connecting', 'Reconectando...'));
  socket.on('reconnect', () => {
    setConn('connected', 'Online');
    socket.emit('driver:join', { session_id: sessionId });
  });

  socket.on('driver:off_route', ({ off_route }) => {
    const el = document.getElementById('alert-off-route');
    el.classList.toggle('hidden', !off_route);
    if (off_route) speak('Atenção! Você saiu da rota. Retorne ao trajeto indicado.');
  });
}

function setConn(state, text) {
  const dot = document.getElementById('conn-dot');
  dot.className = 'conn-dot ' + state;
  document.getElementById('conn-text').textContent = text;
}

// ── Screen Wake Lock ──────────────────────────────────────────────────────────
async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => {
      if (document.visibilityState === 'visible') requestWakeLock();
    });
  } catch { }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !wakeLock) requestWakeLock();
});

// ── Modo teste: simular carro percorrendo a rota ──────────────────────────────
function simulateMovement() {
  if (!routeData?.coordinates?.length) return;
  const coords = routeData.coordinates;
  let i = 0;

  // Interpolar pontos para movimento suave
  const allPoints = [];
  for (let k = 0; k < coords.length - 1; k++) {
    const [lat1, lng1] = coords[k];
    const [lat2, lng2] = coords[k + 1];
    const steps = 8;
    for (let s = 0; s < steps; s++) {
      allPoints.push([
        lat1 + (lat2 - lat1) * s / steps,
        lng1 + (lng2 - lng1) * s / steps,
      ]);
    }
  }
  allPoints.push(coords[coords.length - 1]);

  const interval = setInterval(() => {
    if (i >= allPoints.length) { clearInterval(interval); return; }
    const [lat, lng] = allPoints[i++];
    updateMapPosition(lat, lng);
    if (steps.length) processPosition(lat, lng);
    if (socket?.connected) {
      socket.emit('driver:position', { session_id: sessionId, lat, lng, accuracy: 10, speed: 50/3.6, heading: 0 });
    }
  }, 800);
}

// ── Init ──────────────────────────────────────────────────────────────────────
(function init() {
  const routeId = getParam('rota');
  if (routeId) {
    loadRoute(routeId);
  } else {
    document.getElementById('route-label').textContent = 'Nenhuma rota';
    showError('form-error', 'Escaneie o QR Code da sua rota para continuar.');
  }
  // Pré-carregar vozes pt-BR
  if (window.speechSynthesis) {
    speechSynthesis.getVoices();
    speechSynthesis.addEventListener('voiceschanged', () => speechSynthesis.getVoices());
  }
})();
