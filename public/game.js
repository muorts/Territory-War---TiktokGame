/* =========================================================
   TERRITORY WAR — Android x iPhone (lives do TikTok)
   Canvas 1080x1920 (9:16) com fundo transparente para o OBS
   Tecla S = MODO SIMULAÇÃO (liga/desliga eventos falsos)
   Teclas extras: 1/2 chat, L curtida, R rosa, M meteoros,
                  B tanque, F seguir, V forçar vitória
   ========================================================= */
(() => {
  'use strict';

  // ---------------- Configuração ----------------
  const W = 1080, H = 1920;
  const COLS = 20, ROWS = 26, CELL = 48;
  const AX = 60, AY = 242;                       // canto da arena
  const AW = COLS * CELL, AH = ROWS * CELL;      // 960 x 1248
  const ROUND_TIME = 180;                        // segundos por rodada
  const WIN_PCT = 0.8;                           // domínio para vencer antes do tempo
  const BALL_LIFE = 10;                          // bolinha do chat (segundos)
  const ENERGY_MAX = 100;                        // curtidas para sobrecarga
  const OVERDRIVE_TIME = 5;
  const FREEZE_TIME = 4;
  const SHIELD_TIME = 4;
  const VICTORY_TIME = 7;
  const FF = 'Rubik, "Arial Black", "Segoe UI", system-ui, sans-serif';
  const font = (size, weight = 900) => `${weight} ${size}px ${FF}`;

  const TEAMS = [
    {
      name: 'GTA VI', short: 'GTA VI', sub: 'VICE CITY', victoryName: 'GTA VI',
      color: '#ff2e97', rgb: '255,46,151', light: '#ffc2e5', deep: '#780846',
      tile: ['#380f2b', '#200718'], tileLit: ['#6b1950', '#3d0c2c'],
      rim: 'rgba(255,46,151,0.55)', rimLit: 'rgba(255,194,229,0.95)',
    },
    {
      name: 'ZELDA', short: 'Zelda OoT', sub: 'OCARINA OF TIME', victoryName: 'ZELDA OoT',
      color: '#2eff8a', rgb: '46,255,138', light: '#ffe680', deep: '#086935',
      tile: ['#0f3824', '#082115'], tileLit: ['#1a633e', '#0e3b24'],
      rim: 'rgba(46,255,138,0.55)', rimLit: 'rgba(255,230,128,0.95)',
    },
  ];

  // Logos oficiais (PNG) + fallback vetorial
  const LOGO_GTAVI = new Path2D(
    'M2 3.8h20v2.2H2zM3.5 18h17v2.2h-17zM3 6.6h3.8l2.5 8.8 2.5-8.8h3.6l-4.2 10.8H7.2zM16.8 6.6h3.7v10.8h-3.7z'
  );
  const LOGO_TRIFORCE = new Path2D(
    'M12 2.4L6.6 11.8h10.8L12 2.4zM6.6 12.2L1.2 21.6h10.8L6.6 12.2zM17.4 12.2L12 21.6h10.8l-5.4-9.4z'
  );
  function loadImg(src) {
    const entry = { img: new Image(), ok: false };
    entry.img.onload = () => { entry.ok = true; };
    entry.img.src = src;
    return entry;
  }
  const logoAssets = {
    gta: loadImg('/assets/gta-logo.png'),
    zeldaEmblem: loadImg('/assets/zelda-emblem.png'),
    zeldaFull: loadImg('/assets/zelda-logo.png'),
  };
  function drawLogo(c, team, x, y, size, color = '#ffffff', useFullZelda = false) {
    const asset = team === 0 ? logoAssets.gta : (useFullZelda ? logoAssets.zeldaFull : logoAssets.zeldaEmblem);
    if (asset && asset.ok) {
      const iw = asset.img.naturalWidth || 1, ih = asset.img.naturalHeight || 1;
      const scale = Math.min(size / iw, size / ih);
      const dw = iw * scale, dh = ih * scale;
      c.save();
      c.shadowColor = 'rgba(0,0,0,0.75)';
      c.shadowBlur = Math.max(4, size * 0.08);
      c.drawImage(asset.img, x - dw / 2, y - dh / 2, dw, dh);
      c.restore();
      return;
    }
    c.save();
    c.translate(x - size / 2, y - size / 2);
    c.scale(size / 24, size / 24);
    c.fillStyle = color;
    c.fill(team === 0 ? LOGO_GTAVI : LOGO_TRIFORCE);
    c.restore();
  }

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  function resize() {
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    canvas.style.width = W * s + 'px';
    canvas.style.height = H * s + 'px';
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------------- Utilidades ----------------
  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const easeOutBack = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);

  function roundRect(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  // Sprites de brilho (mais leve que shadowBlur)
  const glowCache = new Map();
  function glow(rgb, size = 64) {
    const key = rgb + size;
    if (glowCache.has(key)) return glowCache.get(key);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grd.addColorStop(0, `rgba(${rgb},1)`);
    grd.addColorStop(0.25, `rgba(${rgb},0.55)`);
    grd.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
    glowCache.set(key, c);
    return c;
  }
  function drawGlow(rgb, x, y, r) {
    ctx.drawImage(glow(rgb), x - r, y - r, r * 2, r * 2);
  }

  // Painel de vidro moderno
  function glass(x, y, w, h, r, border1, border2, alpha = 0.72) {
    ctx.save();
    roundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = `rgba(8,10,22,${alpha})`;
    ctx.fill();
    const hl = ctx.createLinearGradient(0, y, 0, y + h);
    hl.addColorStop(0, 'rgba(255,255,255,0.10)');
    hl.addColorStop(0.4, 'rgba(255,255,255,0.02)');
    hl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hl;
    ctx.fill();
    const bg = ctx.createLinearGradient(x, 0, x + w, 0);
    bg.addColorStop(0, border1);
    bg.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    bg.addColorStop(1, border2);
    ctx.strokeStyle = bg;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }

  function pill(x, y, w, h, fill, stroke) {
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
  }

  function text(str, x, y, size, color, align = 'center', weight = 900, outline = 0, outlineColor = 'rgba(0,0,0,0.85)') {
    ctx.font = font(size, weight);
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    if (outline) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = outline;
      ctx.strokeStyle = outlineColor;
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }
  function fitFont(str, maxW, size, weight = 900) {
    ctx.font = font(size, weight);
    while (ctx.measureText(str).width > maxW && size > 12) { size -= 2; ctx.font = font(size, weight); }
    return size;
  }

  // ---------------- Som (Web Audio, sem arquivos) ----------------
  const sfx = (() => {
    let ac = null, master = null, noiseBuf = null;
    let lastPop = 0;
    function init() {
      if (ac) return;
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        master = ac.createGain();
        master.gain.value = 0.55;
        master.connect(ac.destination);
        noiseBuf = ac.createBuffer(1, ac.sampleRate * 1.2, ac.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { ac = null; }
    }
    function resume() { init(); if (ac && ac.state === 'suspended') ac.resume(); }
    function tone(freq, dur, type = 'sine', vol = 0.1, slideTo = null, delay = 0) {
      if (!ac || ac.state !== 'running') return;
      const t0 = ac.currentTime + delay;
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(master);
      o.start(t0); o.stop(t0 + dur + 0.02);
    }
    function noise(dur, vol, freqFrom, freqTo) {
      if (!ac || ac.state !== 'running') return;
      const t0 = ac.currentTime;
      const s = ac.createBufferSource();
      s.buffer = noiseBuf;
      const f = ac.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(freqFrom, t0);
      f.frequency.exponentialRampToValueAtTime(freqTo, t0 + dur);
      const g = ac.createGain();
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      s.connect(f); f.connect(g); g.connect(master);
      s.start(t0); s.stop(t0 + dur);
    }
    return {
      resume,
      pop(team) {
        const now = performance.now();
        if (now - lastPop < 45) return;
        lastPop = now;
        tone(team === 0 ? rand(520, 640) : rand(760, 900), 0.07, 'triangle', 0.05, team === 0 ? 900 : 1300);
      },
      burst() { tone(1200, 0.08, 'square', 0.03, 500); },
      boom() { noise(0.6, 0.45, 2500, 60); tone(120, 0.45, 'sine', 0.35, 35); },
      bigBoom() { noise(1.1, 0.55, 3000, 40); tone(90, 0.9, 'sine', 0.45, 25); tone(60, 1.0, 'sawtooth', 0.12, 30); },
      meteor() { noise(0.35, 0.2, 5000, 300); tone(900, 0.3, 'sawtooth', 0.04, 200); },
      shield() { tone(300, 0.35, 'sawtooth', 0.06, 900); tone(600, 0.4, 'sine', 0.06, 1200, 0.05); },
      freeze() { for (let i = 0; i < 5; i++) tone(1800 + i * 300, 0.25, 'sine', 0.04, 2600, i * 0.04); },
      join(team) { tone(team === 0 ? 523 : 659, 0.1, 'triangle', 0.08); tone(team === 0 ? 784 : 988, 0.14, 'triangle', 0.08, null, 0.08); },
      overdrive() { tone(200, 0.6, 'sawtooth', 0.08, 1600); },
      whoosh() { noise(0.4, 0.18, 800, 6000); },
      tick(last) { tone(last ? 1320 : 880, 0.09, 'square', 0.06); },
      win() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, 'square', 0.07, null, i * 0.12)); },
    };
  })();
  window.addEventListener('keydown', () => sfx.resume());
  window.addEventListener('pointerdown', () => sfx.resume());
  sfx.resume();

  // ---------------- Avatares ----------------
  const avatarCache = new Map();
  function letterAvatar(name, hue) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 128, 128);
    grd.addColorStop(0, `hsl(${hue},85%,60%)`);
    grd.addColorStop(1, `hsl(${(hue + 60) % 360},80%,38%)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.beginPath(); g.arc(30, 20, 60, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff';
    g.font = font(64);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText((name || '?').trim().charAt(0).toUpperCase() || '?', 64, 70);
    return c;
  }
  function hashHue(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % 360;
  }
  function getAvatar(user) {
    const key = user.id + '|' + (user.avatar || '');
    if (avatarCache.has(key)) return avatarCache.get(key);
    const av = { fallback: letterAvatar(user.name, hashHue(user.id + user.name)), img: null, ok: false };
    if (user.avatar) {
      const img = new Image();
      img.referrerPolicy = 'no-referrer';
      img.onload = () => { av.ok = true; };
      img.onerror = () => { av.ok = false; };
      img.src = user.avatar;
      av.img = img;
    }
    avatarCache.set(key, av);
    if (avatarCache.size > 400) avatarCache.delete(avatarCache.keys().next().value);
    return av;
  }
  function drawAvatar(av, x, y, r, ring, ringW = 5, ring2 = null) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.save();
    ctx.clip();
    const src = av && av.ok ? av.img : av ? av.fallback : null;
    if (src) ctx.drawImage(src, x - r, y - r, r * 2, r * 2);
    ctx.restore();
    if (ring) {
      ctx.beginPath();
      ctx.arc(x, y, r + ringW / 2, 0, Math.PI * 2);
      if (ring2) {
        const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
        g.addColorStop(0, ring); g.addColorStop(1, ring2);
        ctx.strokeStyle = g;
      } else ctx.strokeStyle = ring;
      ctx.lineWidth = ringW;
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------------- Estado do jogo ----------------
  const grid = new Uint8Array(COLS * ROWS);
  const flash = new Float32Array(COLS * ROWS);
  const counts = [0, 0];
  let projectiles = [], balls = [], tanks = [], particles = [], rings = [], floaters = [], confetti = [];
  const shields = [{ until: 0, y: 0 }, { until: 0, y: 0 }];
  const coreBase = [AY + CELL * 4.5, AY + AH - CELL * 4.5];
  const cores = [
    { x: AX + AW / 2, y: coreBase[0], angle: Math.PI / 2, fireT: 0, frozenUntil: 0, overUntil: 0, energy: 0, recoil: 0 },
    { x: AX + AW / 2, y: coreBase[1], angle: -Math.PI / 2, fireT: 0, frozenUntil: 0, overUntil: 0, energy: 0, recoil: 0 },
  ];
  const users = new Map();   // id -> time escolhido
  const scores = new Map();  // id -> { name, av, team, pts } (pontos da rodada)
  let tops = [[], []];
  let topsT = 0;
  const banners = [];
  let bannerCur = null;
  let callout = null;        // texto grande no centro
  let screenFlash = null;    // { rgb, born, dur }
  const actionFlash = { chat: -10, like: -10, follow: -10, rose: -10, meteor: -10, boss: -10 };
  let toasts = [];
  let shake = 0;
  let t = 0;
  let leader = -1;
  let lastTick = -1;
  const round = { start: 0, over: false, winner: -1, endAt: 0, extra: 0, mvp: null };
  let history = { 0: 0, 1: 0 };
  try {
    const saved = JSON.parse(localStorage.getItem('tw_history') || 'null');
    if (saved && typeof saved[0] === 'number') history = saved;
  } catch (e) { /* ignora */ }
  let liveStatus = { state: 'no-user', user: '' };
  let simOn = false;
  const dispPct = [0.5, 0.5]; // porcentagem animada

  // Sprites dos blocos (normal e "aceso" na linha de frente)
  function makeCellSprite(team, lit) {
    const c = document.createElement('canvas');
    c.width = c.height = CELL;
    const g = c.getContext('2d');
    const T = TEAMS[team];
    const cols = lit ? T.tileLit : T.tile;
    const grd = g.createLinearGradient(0, 0, 0, CELL);
    grd.addColorStop(0, cols[0]);
    grd.addColorStop(1, cols[1]);
    g.fillStyle = grd;
    roundRect(g, 2.5, 2.5, CELL - 5, CELL - 5, 11);
    g.fill();
    // brilho de vidro no topo
    const hl = g.createLinearGradient(0, 3, 0, CELL * 0.55);
    hl.addColorStop(0, `rgba(255,255,255,${lit ? 0.22 : 0.13})`);
    hl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = hl;
    roundRect(g, 5, 4, CELL - 10, CELL * 0.45, 8);
    g.fill();
    // borda neon
    g.lineWidth = lit ? 2.2 : 1.6;
    g.strokeStyle = lit ? T.rimLit : T.rim;
    roundRect(g, 2.5, 2.5, CELL - 5, CELL - 5, 11);
    g.stroke();
    // ponto central sutil
    g.fillStyle = `rgba(${T.rgb},${lit ? 0.5 : 0.18})`;
    g.beginPath();
    g.arc(CELL / 2, CELL / 2 + 2, 3, 0, Math.PI * 2);
    g.fill();
    return c;
  }
  const cellSprites = [[makeCellSprite(0, false), makeCellSprite(0, true)], [makeCellSprite(1, false), makeCellSprite(1, true)]];

  function idxAt(x, y) {
    const c = Math.floor((x - AX) / CELL), r = Math.floor((y - AY) / CELL);
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return -1;
    return r * COLS + c;
  }
  const cellCX = (i) => AX + (i % COLS) * CELL + CELL / 2;
  const cellCY = (i) => AY + Math.floor(i / COLS) * CELL + CELL / 2;

  function convert(i, team, fx = true) {
    if (i < 0 || grid[i] === team) return false;
    counts[grid[i]]--;
    grid[i] = team;
    counts[team]++;
    flash[i] = t;
    if (fx) {
      const x = cellCX(i), y = cellCY(i);
      for (let k = 0; k < 4; k++) {
        spawnParticle(x, y, rand(-240, 240), rand(-240, 240), TEAMS[team].color, rand(0.3, 0.6), rand(4, 8), Math.random() < 0.5);
      }
      sfx.pop(team);
    }
    return true;
  }

  function spawnParticle(x, y, vx, vy, color, life, size, dot = false) {
    if (particles.length > 1800) return;
    particles.push({ x, y, vx, vy, color, life, max: life, size, dot });
  }
  function explosion(x, y, color, n = 30, power = 500) {
    for (let k = 0; k < n; k++) {
      const a = rand(0, Math.PI * 2), s = rand(power * 0.2, power);
      spawnParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, Math.random() < 0.3 ? '#ffffff' : color, rand(0.4, 0.9), rand(5, 12), Math.random() < 0.4);
    }
    rings.push({ x, y, r: 10, max: power * 0.35, life: 0.45, maxLife: 0.45, color });
  }
  function addShake(v) { shake = Math.min(40, shake + v); }
  function floatText(x, y, str, color, size = 40) {
    floaters.push({ x, y, str, color, size, born: t, life: 1.1 });
    if (floaters.length > 30) floaters.shift();
  }
  function showCallout(str, sub, team, dur = 1.4) {
    callout = { str, sub, team, born: t, dur };
    sfx.whoosh();
  }
  function flashScreen(rgb, dur = 0.35) { screenFlash = { rgb, born: t, dur }; }

  function addScore(user, team, pts) {
    let s = scores.get(user.id);
    if (!s) { s = { name: user.name, av: getAvatar(user), team, pts: 0 }; scores.set(user.id, s); }
    s.team = team;
    s.pts += pts;
  }
  function refreshTops() {
    const all = [...scores.values()];
    tops = [0, 1].map((tm) => all.filter((s) => s.team === tm).sort((a, b) => b.pts - a.pts).slice(0, 3));
  }

  function losingTeam() {
    if (counts[0] === counts[1]) return Math.random() < 0.5 ? 0 : 1;
    return counts[0] < counts[1] ? 0 : 1;
  }
  function enemyCells(team) {
    const out = [];
    for (let i = 0; i < grid.length; i++) if (grid[i] !== team) out.push(i);
    return out;
  }
  function frontY() { return AY + (counts[0] / COLS) * CELL; }

  // ---------------- Rodada ----------------
  function resetRound() {
    counts[0] = counts[1] = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        const team = r < ROWS / 2 ? 0 : 1;
        grid[i] = team;
        counts[team]++;
        flash[i] = t + Math.abs(r - ROWS / 2 + 0.5) * 0.03;
      }
    }
    projectiles = []; balls = []; tanks = [];
    shields[0].until = shields[1].until = 0;
    cores.forEach((cr) => { cr.frozenUntil = 0; cr.overUntil = 0; cr.energy = 0; cr.fireT = 0; });
    scores.clear();
    tops = [[], []];
    round.start = t;
    round.over = false;
    round.winner = -1;
    round.extra = 0;
    round.mvp = null;
    leader = -1;
    lastTick = -1;
  }

  function endRound(winner) {
    if (round.over) return;
    refreshTops();
    round.over = true;
    round.winner = winner;
    round.endAt = t + VICTORY_TIME;
    round.mvp = tops[winner][0] || null;
    history[winner] = (history[winner] || 0) + 1;
    try { localStorage.setItem('tw_history', JSON.stringify(history)); } catch (e) { /* ignora */ }
    sfx.win();
    addShake(25);
    flashScreen(TEAMS[winner].rgb, 0.6);
    balls.forEach((b) => explosion(b.x, b.y, TEAMS[b.team].color, 12, 300));
    tanks.forEach((tk) => explosion(tk.x, tk.y, TEAMS[tk.team].color, 30, 500));
    projectiles = []; balls = []; tanks = [];
    banners.length = 0;
    bannerCur = null;
    callout = null;
    const palette = [TEAMS[winner].color, TEAMS[winner].light, '#ffffff', '#ffd84d', '#ff5fa2'];
    for (let k = 0; k < 220; k++) {
      confetti.push({
        x: rand(0, W), y: rand(-600, -20), vx: rand(-80, 80), vy: rand(150, 420),
        rot: rand(0, Math.PI * 2), vr: rand(-8, 8), w: rand(10, 18), h: rand(6, 10),
        color: pick(palette), phase: rand(0, 10), life: rand(4, 6.5),
      });
    }
  }

  // ---------------- Ações ----------------
  function fireProjectile(team, angle, speed, kind = 'basic', extra = {}) {
    if (projectiles.length > 600 && kind === 'basic') return;
    const cr = cores[team];
    projectiles.push({
      team, kind,
      x: cr.x + Math.cos(angle) * 46, y: cr.y + Math.sin(angle) * 46,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      r: kind === 'giant' ? 32 : kind === 'burst' ? 9 : kind === 'meteor' ? 12 : 7,
      life: kind === 'giant' ? 6 : kind === 'meteor' ? 5 : 3.5,
      ...extra,
    });
    cr.recoil = Math.min(1, cr.recoil + (kind === 'giant' ? 1 : 0.35));
  }

  function spawnBall(team, user) {
    if (balls.length > 30) balls.shift();
    const cr = cores[team];
    const a = (team === 0 ? Math.PI / 2 : -Math.PI / 2) + rand(-0.9, 0.9);
    const sp = 560;
    balls.push({
      team, x: cr.x + rand(-30, 30), y: cr.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      r: 34, life: BALL_LIFE, av: getAvatar(user), name: user.name, trail: [], born: t,
    });
    explosion(cr.x, cr.y, TEAMS[team].color, 10, 260);
  }

  function likeBurst(team, likeCount) {
    const cr = cores[team];
    for (let k = 0; k < 3; k++) fireProjectile(team, cr.angle + rand(-0.35, 0.35), 1500, 'burst');
    sfx.burst();
    cr.energy += Math.max(1, likeCount);
    if (cr.energy >= ENERGY_MAX) {
      cr.energy = 0;
      cr.overUntil = Math.max(cr.overUntil, t) + OVERDRIVE_TIME;
      sfx.overdrive();
      addShake(8);
      flashScreen('255,190,40', 0.3);
      showCallout('SOBRECARGA!', `${TEAMS[team].name} • tiro rápido 5s`, team, 1.3);
    }
  }

  function giantShot(team, user) {
    const cr = cores[team];
    fireProjectile(team, cr.angle + rand(-0.2, 0.2), 900, 'giant', { av: getAvatar(user) });
    sfx.boom();
    addShake(6);
  }

  function meteorShower(team) {
    if (!enemyCells(team).length) return;
    addShake(18);
    sfx.meteor();
    flashScreen('255,140,50', 0.3);
    showCallout('CHUVA DE METEOROS!', `15 mísseis do ${TEAMS[team].name}`, team, 1.3);
    for (let k = 0; k < 15; k++) {
      setTimeout(() => {
        if (round.over) return;
        const cr = cores[team];
        const a = (team === 0 ? Math.PI / 2 : -Math.PI / 2) + rand(-1.6, 1.6);
        const list = enemyCells(team);
        if (!list.length) return;
        fireProjectile(team, a, 700, 'meteor', { target: pick(list), trail: [] });
        if (k % 3 === 0) { sfx.meteor(); addShake(4); }
        spawnParticle(cr.x, cr.y, rand(-100, 100), rand(-100, 100), '#ffb347', 0.5, 10, true);
      }, k * 70);
    }
  }

  function summonTank(team, user) {
    const enemy = 1 - team;
    let best = 0, bestScore = -1;
    for (let c0 = 0; c0 <= COLS - 5; c0++) {
      let s = 0;
      for (let c = c0; c < c0 + 5; c++) for (let r = 0; r < ROWS; r++) if (grid[r * COLS + c] !== team) s++;
      s += Math.random() * 6;
      if (s > bestScore) { bestScore = s; best = c0; }
    }
    tanks.push({
      team, c0: best, x: AX + (best + 2.5) * CELL,
      y: team === 0 ? AY - 70 : AY + AH + 70,
      vy: team === 0 ? 400 : -400,
      av: getAvatar(user), name: user.name, total: 0,
    });
    cores[enemy].frozenUntil = Math.max(cores[enemy].frozenUntil, t) + FREEZE_TIME;
    sfx.bigBoom();
    sfx.freeze();
    addShake(22);
    flashScreen(TEAMS[team].rgb, 0.45);
    showCallout('TANQUE INVOCADO!', `${TEAMS[enemy].name} congelado por 4s`, team, 1.6);
  }

  function activateShield(team) {
    shields[team].until = Math.max(shields[team].until, t) + SHIELD_TIME;
    sfx.shield();
  }

  // ---------------- Banners e alertas ----------------
  function pushBanner(b) {
    b.queued = t;
    banners.push(b);
    if (banners.length > 12) banners.shift();
  }
  function pushToast(str, team, av, icon = '') {
    toasts.unshift({ text: str, team, av, icon, born: t });
    if (toasts.length > 4) toasts.pop();
  }

  // ---------------- Eventos da live ----------------
  function normalizeText(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  function parseTeam(str) {
    const tokens = normalizeText(str).split(/[^a-z0-9]+/).filter(Boolean);
    for (const tk of tokens) {
      if (tk === 'gta' || tk === 'gtavi' || tk === 'gta6' || tk === 'vice' || tk === 'vi' || tk === '1') return 0;
      if (tk === 'zelda' || tk === 'oot' || tk === 'ocarina' || tk === 'link' || tk === 'hyrule' || tk === '2') return 1;
    }
    return null;
  }
  function teamOf(user) {
    if (users.has(user.id)) return users.get(user.id);
    const team = losingTeam();
    users.set(user.id, team);
    pushToast(`${user.name} → ${TEAMS[team].name}`, team, getAvatar(user), '⚖️');
    return team;
  }

  function handleEvent(ev) {
    if (!ev || !ev.user) return;
    const user = ev.user;
    user.name = String(user.name || 'Anônimo').slice(0, 20);
    switch (ev.type) {
      case 'chat': {
        const team = parseTeam(ev.text);
        if (team === null) return;
        actionFlash.chat = t;
        const before = users.get(user.id);
        users.set(user.id, team);
        if (before !== team) {
          pushToast(`${user.name} entrou no ${TEAMS[team].name}`, team, getAvatar(user), '✨');
          sfx.join(team);
        }
        if (!round.over) { spawnBall(team, user); addScore(user, team, 3); }
        break;
      }
      case 'like': {
        const team = teamOf(user);
        actionFlash.like = t;
        if (!round.over) { likeBurst(team, Number(ev.likeCount) || 1); addScore(user, team, Number(ev.likeCount) || 1); }
        break;
      }
      case 'gift': {
        const team = teamOf(user);
        const d = Number(ev.diamonds) || 1;
        const n = clamp(Number(ev.count) || 1, 1, 10);
        const T = TEAMS[team];
        const gname = ev.giftName || 'Presente';
        let sub, icon;
        if (d <= 1) { actionFlash.rose = t; sub = `${gname}${n > 1 ? ' x' + n : ''} • TIRO GIGANTE (1 FILEIRA)`; icon = '🌹'; }
        else if (d < 20) { actionFlash.meteor = t; sub = `${gname}${n > 1 ? ' x' + n : ''} • 15 METEOROS TELEGUIADOS`; icon = '☄️'; }
        else { actionFlash.boss = t; sub = `${gname}${n > 1 ? ' x' + n : ''} • TANQUE BOSS + CONGELAR 4s`; icon = '🚀'; }
        pushBanner({ text: `${user.name} apoiou ${T.name}!`, team, av: getAvatar(user), sub, icon });
        if (!round.over) addScore(user, team, d * n * 20);
        for (let k = 0; k < n; k++) {
          setTimeout(() => {
            if (round.over) return;
            if (d <= 1) giantShot(team, user);
            else if (d < 20) meteorShower(team);
            else summonTank(team, user);
          }, k * (d <= 1 ? 250 : 900));
        }
        break;
      }
      case 'follow': {
        const team = teamOf(user);
        actionFlash.follow = t;
        pushToast(`${user.name} seguiu! Escudo ${TEAMS[team].name}`, team, getAvatar(user), '🛡️');
        if (!round.over) { activateShield(team); addScore(user, team, 20); }
        break;
      }
      default:
        break;
    }
  }

  // Socket.IO (eventos reais vindos do servidor)
  if (typeof io === 'function') {
    const socket = io();
    socket.on('live-event', (ev) => handleEvent(ev));
    socket.on('status', (s) => { liveStatus = s || liveStatus; });
    socket.on('disconnect', () => { liveStatus = { state: 'server-off', user: liveStatus.user }; });
  }

  // ---------------- MODO SIMULAÇÃO ----------------
  const SIM_NAMES = ['Lucas', 'Ana_Clara', 'PedroGamer', 'Juju', 'Rafa.tv', 'Mari', 'Gui_007', 'Bia', 'TioZé', 'Leo',
    'Carol', 'Davi', 'Fer', 'Nina', 'Thiago', 'Duda', 'Caio', 'Lari', 'Vini', 'Isa', 'Bruno', 'Manu'];
  const simUsers = SIM_NAMES.map((n, i) => ({ id: 'sim_' + i, name: n, avatar: '' }));
  const GIFTS_1 = ['Rosa', 'Rose', 'TikTok'];
  const GIFTS_5 = [['Rosquinha', 5], ['Casquinha', 5], ['GG', 5], ['Finger Heart', 5], ['Picolé', 10]];
  const GIFTS_20 = [['Coração', 20], ['Perfume', 20], ['Chapéu', 99], ['Galáxia', 1000]];

  function simEvent(kind) {
    const user = pick(simUsers);
    switch (kind) {
      case 'chat1': return handleEvent({ type: 'chat', user, text: pick(['1', 'gta', 'GTA VI!!', 'vai gta 6', 'gtavi 1']) });
      case 'chat2': return handleEvent({ type: 'chat', user, text: pick(['2', 'zelda', 'ocarina', 'Zelda OoT 2', 'link 2']) });
      case 'like': return handleEvent({ type: 'like', user, likeCount: randi(1, 15) });
      case 'rose': return handleEvent({ type: 'gift', user, diamonds: 1, giftName: pick(GIFTS_1), count: 1 });
      case 'meteor': { const g = pick(GIFTS_5); return handleEvent({ type: 'gift', user, diamonds: g[1], giftName: g[0], count: 1 }); }
      case 'boss': { const g = pick(GIFTS_20); return handleEvent({ type: 'gift', user, diamonds: g[1], giftName: g[0], count: 1 }); }
      case 'follow': return handleEvent({ type: 'follow', user });
      default: {
        const r = Math.random();
        if (r < 0.32) return simEvent(Math.random() < 0.5 ? 'chat1' : 'chat2');
        if (r < 0.75) return simEvent('like');
        if (r < 0.86) return simEvent('rose');
        if (r < 0.93) return simEvent('meteor');
        if (r < 0.96) return simEvent('boss');
        return simEvent('follow');
      }
    }
  }
  let simTimer = null;
  function setSim(on) {
    simOn = on;
    clearInterval(simTimer);
    if (on) simTimer = setInterval(() => simEvent(), 420);
    console.log('MODO SIMULAÇÃO:', on ? 'LIGADO' : 'DESLIGADO');
  }
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 's') setSim(!simOn);
    else if (k === '1') simEvent('chat1');
    else if (k === '2') simEvent('chat2');
    else if (k === 'l') simEvent('like');
    else if (k === 'r') simEvent('rose');
    else if (k === 'm') simEvent('meteor');
    else if (k === 'b') simEvent('boss');
    else if (k === 'f') simEvent('follow');
    else if (k === 'v' && !round.over) endRound(counts[0] >= counts[1] ? 0 : 1);
  });
  if (new URLSearchParams(location.search).has('sim')) setSim(true);
  window.__tw = {
    handleEvent, simEvent, setSim, counts, endRound: (w) => endRound(w),
    state: () => ({ projectiles: projectiles.length, balls: balls.length, tanks: tanks.length, particles: particles.length, round }),
  };

  // ---------------- Atualização ----------------
  function crossesShield(p, prevY) {
    const st = 1 - p.team;
    const s = shields[st];
    if (s.until <= t) return false;
    if (st === 0 && p.vy < 0 && prevY > s.y && p.y <= s.y) { p.y = s.y + 1; return true; }
    if (st === 1 && p.vy > 0 && prevY < s.y && p.y >= s.y) { p.y = s.y - 1; return true; }
    return false;
  }

  function updateCores(dt) {
    cores.forEach((cr, team) => {
      const base = team === 0 ? Math.PI / 2 : -Math.PI / 2;
      cr.angle = base + Math.sin(t * (team === 0 ? 1.25 : 1.1) + team * 1.7) * 1.15;
      cr.y = coreBase[team] + Math.sin(t * 2 + team * 2) * 4; // flutuando
      cr.recoil = Math.max(0, cr.recoil - dt * 6);
      if (cr.frozenUntil > t) return;
      const interval = cr.overUntil > t ? 0.05 : 0.3;
      cr.fireT -= dt;
      while (cr.fireT <= 0) {
        cr.fireT += interval;
        const isOver = cr.overUntil > t;
        fireProjectile(team, cr.angle + (isOver ? rand(-0.25, 0.25) : 0), isOver ? 1300 : 950, 'basic');
      }
    });
  }

  function updateProjectiles(dt) {
    for (let n = projectiles.length - 1; n >= 0; n--) {
      const p = projectiles[n];
      p.life -= dt;
      let dead = p.life <= 0;
      if (p.kind === 'meteor' && !dead) {
        if (grid[p.target] === p.team) {
          const list = enemyCells(p.team);
          if (!list.length) dead = true; else p.target = pick(list);
        }
        if (!dead) {
          const tx = cellCX(p.target), ty = cellCY(p.target);
          const dx = tx - p.x, dy = ty - p.y, dist = Math.hypot(dx, dy) || 1;
          const sp = 1250;
          const k = Math.min(1, dt * 5);
          p.vx += ((dx / dist) * sp - p.vx) * k;
          p.vy += ((dy / dist) * sp - p.vy) * k;
          p.x += p.vx * dt; p.y += p.vy * dt;
          p.trail.push(p.x, p.y);
          if (p.trail.length > 20) p.trail.splice(0, 2);
          if (Math.random() < 0.6) spawnParticle(p.x, p.y, rand(-40, 40), rand(-40, 40), pick(['#ffb347', '#ff5e3a', '#fff3b0']), 0.35, rand(5, 10), true);
          if (dist < 22) {
            const c = p.target % COLS, r = Math.floor(p.target / COLS);
            let got = 0;
            [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([oc, or]) => {
              const cc = c + oc, rr = r + or;
              if (cc >= 0 && cc < COLS && rr >= 0 && rr < ROWS && convert(rr * COLS + cc, p.team)) got++;
            });
            explosion(tx, ty, '#ffb347', 14, 320);
            if (got) floatText(tx, ty - 10, `+${got}`, '#ffd27a', 30);
            addShake(2.5);
            dead = true;
          }
        }
        if (dead) projectiles.splice(n, 1);
        continue;
      }
      const steps = Math.max(1, Math.ceil((Math.hypot(p.vx, p.vy) * dt) / (CELL * 0.4)));
      const sdt = dt / steps;
      for (let s = 0; s < steps && !dead; s++) {
        const prevY = p.y;
        p.x += p.vx * sdt; p.y += p.vy * sdt;
        if (p.x < AX + p.r) { p.x = AX + p.r; p.vx = Math.abs(p.vx); }
        if (p.x > AX + AW - p.r) { p.x = AX + AW - p.r; p.vx = -Math.abs(p.vx); }
        if (p.y < AY + p.r) { p.y = AY + p.r; p.vy = Math.abs(p.vy); }
        if (p.y > AY + AH - p.r) { p.y = AY + AH - p.r; p.vy = -Math.abs(p.vy); }
        if (p.kind !== 'giant' && crossesShield(p, prevY)) {
          p.vy = -p.vy;
          p.team = 1 - p.team;
          p.life = Math.max(p.life, 1.5);
          for (let k = 0; k < 5; k++) spawnParticle(p.x, p.y, rand(-200, 200), rand(-200, 200), '#ffffff', 0.3, 5, true);
          continue;
        }
        const i = idxAt(p.x, p.y);
        if (i >= 0 && grid[i] !== p.team) {
          if (p.kind === 'giant') {
            const r = Math.floor(i / COLS);
            let got = 0;
            for (let c = 0; c < COLS; c++) if (convert(r * COLS + c, p.team)) got++;
            for (let c = 0; c < COLS; c += 2) explosion(AX + c * CELL + CELL, AY + r * CELL + CELL / 2, TEAMS[p.team].color, 8, 380);
            explosion(p.x, p.y, '#ffffff', 40, 700);
            floatText(p.x, p.y - 40, `+${got}`, TEAMS[p.team].light, 52);
            flashScreen(TEAMS[p.team].rgb, 0.25);
            sfx.boom();
            addShake(16);
          } else {
            convert(i, p.team);
          }
          dead = true;
        }
      }
      if (p.kind === 'giant' && !dead && Math.random() < 0.9) {
        spawnParticle(p.x, p.y, rand(-60, 60), rand(-60, 60), TEAMS[p.team].color, 0.5, rand(8, 14), true);
      }
      if (dead) projectiles.splice(n, 1);
    }
  }

  const PROBES = [];
  for (let k = 0; k < 8; k++) PROBES.push([Math.round(Math.cos((k * Math.PI) / 4) * 1000) / 1000, Math.round(Math.sin((k * Math.PI) / 4) * 1000) / 1000]);

  function updateBalls(dt) {
    for (let n = balls.length - 1; n >= 0; n--) {
      const b = balls[n];
      b.life -= dt;
      if (b.life <= 0) {
        explosion(b.x, b.y, TEAMS[b.team].color, 16, 300);
        balls.splice(n, 1);
        continue;
      }
      b.trail.push(b.x, b.y);
      if (b.trail.length > 16) b.trail.splice(0, 2);
      const steps = Math.max(1, Math.ceil((Math.hypot(b.vx, b.vy) * dt) / (CELL * 0.4)));
      const sdt = dt / steps;
      for (let s = 0; s < steps; s++) {
        const prevY = b.y;
        b.x += b.vx * sdt; b.y += b.vy * sdt;
        if (b.x < AX + b.r) { b.x = AX + b.r; b.vx = Math.abs(b.vx); }
        if (b.x > AX + AW - b.r) { b.x = AX + AW - b.r; b.vx = -Math.abs(b.vx); }
        if (b.y < AY + b.r) { b.y = AY + b.r; b.vy = Math.abs(b.vy); }
        if (b.y > AY + AH - b.r) { b.y = AY + AH - b.r; b.vy = -Math.abs(b.vy); }
        const es = shields[1 - b.team];
        if (es.until > t) {
          if (b.team === 1 && b.vy < 0 && prevY - b.r > es.y && b.y - b.r <= es.y) b.vy = Math.abs(b.vy);
          if (b.team === 0 && b.vy > 0 && prevY + b.r < es.y && b.y + b.r >= es.y) b.vy = -Math.abs(b.vy);
        }
        let flipX = false, flipY = false, diag = null;
        for (let k = 0; k < 8; k++) {
          const [dx, dy] = PROBES[k];
          const i = idxAt(b.x + dx * b.r, b.y + dy * b.r);
          if (i < 0 || grid[i] === b.team) continue;
          convert(i, b.team);
          if (k % 2 === 0) {
            if (dx !== 0 && Math.sign(dx) === Math.sign(b.vx)) flipX = true;
            if (dy !== 0 && Math.sign(dy) === Math.sign(b.vy)) flipY = true;
          } else if (!diag) diag = [dx, dy];
        }
        if (!flipX && !flipY && diag) {
          if (Math.sign(diag[0]) === Math.sign(b.vx)) flipX = true;
          if (Math.sign(diag[1]) === Math.sign(b.vy)) flipY = true;
        }
        if (flipX) b.vx = -b.vx;
        if (flipY) b.vy = -b.vy;
      }
    }
  }

  function updateTanks(dt) {
    for (let n = tanks.length - 1; n >= 0; n--) {
      const tk = tanks[n];
      tk.y += tk.vy * dt;
      const r0 = Math.floor((tk.y - 60 - AY) / CELL), r1 = Math.floor((tk.y + 60 - AY) / CELL);
      for (let r = Math.max(0, r0); r <= Math.min(ROWS - 1, r1); r++) {
        for (let c = tk.c0; c < tk.c0 + 5; c++) if (convert(r * COLS + c, tk.team)) tk.total++;
      }
      if (Math.random() < 0.7) {
        spawnParticle(tk.x + rand(-110, 110), tk.y - Math.sign(tk.vy) * 70, rand(-60, 60), -Math.sign(tk.vy) * rand(60, 200), pick(['#888', '#bbb', TEAMS[tk.team].color]), 0.7, rand(8, 16), true);
      }
      shake = Math.max(shake, 4);
      if ((tk.vy > 0 && tk.y > AY + AH + 90) || (tk.vy < 0 && tk.y < AY - 90)) {
        if (tk.total) floatText(tk.x, tk.vy > 0 ? AY + AH - 80 : AY + 80, `+${tk.total}`, TEAMS[tk.team].light, 60);
        tanks.splice(n, 1);
      }
    }
  }

  function updateParticles(dt) {
    for (let n = particles.length - 1; n >= 0; n--) {
      const p = particles[n];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(n, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.96; p.vy *= 0.96;
    }
    for (let n = rings.length - 1; n >= 0; n--) {
      const r = rings[n];
      r.life -= dt;
      if (r.life <= 0) { rings.splice(n, 1); continue; }
      r.r += (r.max - r.r) * Math.min(1, dt * 10);
    }
    floaters = floaters.filter((f) => t - f.born < f.life);
    for (let n = confetti.length - 1; n >= 0; n--) {
      const c = confetti[n];
      c.life -= dt;
      if (c.life <= 0 || c.y > H + 40) { confetti.splice(n, 1); continue; }
      c.phase += dt * 6;
      c.x += (c.vx + Math.sin(c.phase) * 60) * dt;
      c.y += c.vy * dt;
      c.rot += c.vr * dt;
    }
  }

  function updateBanners() {
    if (!bannerCur && banners.length) {
      while (banners.length > 1 && t - banners[0].queued > 6) banners.shift();
      bannerCur = banners.shift();
      bannerCur.born = t;
      bannerCur.dur = banners.length > 2 ? 1.1 : 2.0;
    }
    if (bannerCur && t - bannerCur.born > bannerCur.dur) bannerCur = null;
    toasts = toasts.filter((x) => t - x.born < 3.5);
    if (callout && t - callout.born > callout.dur) callout = null;
    if (screenFlash && t - screenFlash.born > screenFlash.dur) screenFlash = null;
  }

  function update(dt) {
    t += dt;
    shake *= Math.exp(-dt * 7);
    updateParticles(dt);
    updateBanners();
    const total = COLS * ROWS;
    const target0 = counts[0] / total;
    dispPct[0] += (target0 - dispPct[0]) * Math.min(1, dt * 6);
    dispPct[1] = 1 - dispPct[0];
    if (t > topsT) { refreshTops(); topsT = t + 0.5; }
    if (round.over) {
      if (t >= round.endAt) resetRound();
      return;
    }
    const fy = frontY();
    shields[0].y = clamp(fy - CELL * 0.7, AY + CELL, AY + AH - CELL * 2);
    shields[1].y = clamp(fy + CELL * 0.7, AY + CELL * 2, AY + AH - CELL);
    updateCores(dt);
    updateProjectiles(dt);
    updateBalls(dt);
    updateTanks(dt);
    // virada (com folga de 3% para não ficar piscando)
    const diff = (counts[0] - counts[1]) / total;
    const nowLeader = diff > 0.03 ? 0 : diff < -0.03 ? 1 : leader;
    if (nowLeader !== leader) {
      if (leader !== -1 && t - round.start > 8 && !callout) {
        showCallout('VIRADA!', `${TEAMS[nowLeader].name} assumiu a liderança`, nowLeader, 1.3);
        flashScreen(TEAMS[nowLeader].rgb, 0.3);
      }
      leader = nowLeader;
    }
    // contagem regressiva
    const tl = timeLeft();
    if (tl <= 10 && tl > 0) {
      const sec = Math.ceil(tl);
      if (sec !== lastTick) { lastTick = sec; sfx.tick(sec <= 3); }
    }
    // vitória
    if (counts[0] / total >= WIN_PCT) endRound(0);
    else if (counts[1] / total >= WIN_PCT) endRound(1);
    else if (tl <= 0) {
      if (counts[0] !== counts[1]) endRound(counts[0] > counts[1] ? 0 : 1);
      else round.extra += 10;
    }
  }
  function timeLeft() { return ROUND_TIME + round.extra - (t - round.start); }

  // ---------------- Desenho ----------------
  function drawArenaBack() {
    ctx.save();
    roundRect(ctx, AX - 14, AY - 14, AW + 28, AH + 28, 26);
    ctx.fillStyle = 'rgba(6,8,18,0.78)';
    ctx.fill();
    // borda com gradiente girando
    let g;
    if (ctx.createConicGradient) {
      g = ctx.createConicGradient(t * 0.6, AX + AW / 2, AY + AH / 2);
      g.addColorStop(0, TEAMS[0].color);
      g.addColorStop(0.25, '#ffffff');
      g.addColorStop(0.5, TEAMS[1].color);
      g.addColorStop(0.75, '#ffffff');
      g.addColorStop(1, TEAMS[0].color);
    } else {
      g = ctx.createLinearGradient(0, AY, 0, AY + AH);
      g.addColorStop(0, TEAMS[0].color);
      g.addColorStop(1, TEAMS[1].color);
    }
    ctx.strokeStyle = g;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 10;
    ctx.stroke();
    ctx.restore();
  }

  function drawGrid() {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        const tm = grid[i];
        const lit = (c > 0 && grid[i - 1] !== tm) || (c < COLS - 1 && grid[i + 1] !== tm) ||
          (r > 0 && grid[i - COLS] !== tm) || (r < ROWS - 1 && grid[i + COLS] !== tm) ? 1 : 0;
        const x = AX + c * CELL, y = AY + r * CELL;
        const age = t - flash[i];
        if (age >= 0 && age < 0.4) {
          const k = 1 - age / 0.4;
          const s = 1 + 0.22 * Math.sin(k * Math.PI) ;
          const off = (CELL * (s - 1)) / 2;
          ctx.drawImage(cellSprites[tm][1], x - off, y - off, CELL * s, CELL * s);
          ctx.fillStyle = `rgba(255,255,255,${0.7 * k * k})`;
          roundRect(ctx, x + 2.5 - off, y + 2.5 - off, CELL * s - 5, CELL * s - 5, 11);
          ctx.fill();
        } else {
          ctx.drawImage(cellSprites[tm][lit], x, y);
        }
      }
    }
    // brilho diagonal passando (efeito "sheen")
    ctx.save();
    roundRect(ctx, AX, AY, AW, AH, 12);
    ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    const cyc = (t % 5) / 5;
    const sx = AX - 600 + cyc * (AW + 1200);
    const g = ctx.createLinearGradient(sx - 200, AY, sx + 200, AY + 400);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.06)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(AX, AY, AW, AH);
    ctx.restore();
  }

  function frontPath() {
    const path = new Path2D();
    const edges = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        if (c < COLS - 1 && grid[i] !== grid[i + 1]) {
          const x = AX + (c + 1) * CELL;
          path.moveTo(x, AY + r * CELL); path.lineTo(x, AY + (r + 1) * CELL);
          edges.push([x, AY + r * CELL + CELL / 2]);
        }
        if (r < ROWS - 1 && grid[i] !== grid[i + COLS]) {
          const y = AY + (r + 1) * CELL;
          path.moveTo(AX + c * CELL, y); path.lineTo(AX + (c + 1) * CELL, y);
          edges.push([AX + c * CELL + CELL / 2, y]);
        }
      }
    }
    return { path, edges };
  }
  function drawFrontLine() {
    const { path, edges } = frontPath();
    const pulse = 0.75 + 0.25 * Math.sin(t * 6);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,255,255,${0.08 * pulse})`;
    ctx.lineWidth = 18;
    ctx.stroke(path);
    ctx.strokeStyle = `rgba(255,255,255,${0.25 * pulse})`;
    ctx.lineWidth = 8;
    ctx.stroke(path);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = `rgba(255,255,255,${0.85 * pulse + 0.15})`;
    ctx.lineWidth = 3;
    ctx.stroke(path);
    ctx.restore();
    // faíscas na linha de frente
    if (edges.length && !round.over) {
      for (let k = 0; k < 2; k++) {
        const e = pick(edges);
        spawnParticle(e[0], e[1], rand(-60, 60), rand(-60, 60), '#ffffff', rand(0.2, 0.45), rand(3, 6), true);
      }
    }
  }

  function drawShields() {
    shields.forEach((s, team) => {
      if (s.until <= t) return;
      const left = s.until - t;
      const alpha = Math.min(1, left * 2) * (0.8 + 0.2 * Math.sin(t * 20));
      const T = TEAMS[team];
      ctx.save();
      ctx.globalAlpha = alpha;
      const g = ctx.createLinearGradient(0, s.y - 26, 0, s.y + 26);
      g.addColorStop(0, `rgba(${T.rgb},0)`);
      g.addColorStop(0.5, `rgba(${T.rgb},0.35)`);
      g.addColorStop(1, `rgba(${T.rgb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(AX, s.y - 26, AW, 52);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(AX, s.y); ctx.lineTo(AX + AW, s.y); ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = T.color;
      for (let x = AX + 24; x < AX + AW; x += 48) {
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k * Math.PI) / 3 + t * 2;
          const px = x + Math.cos(a) * 14, py = s.y + Math.sin(a) * 14;
          k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      pill(AX + AW - 170, s.y + (team === 0 ? -58 : 22), 150, 36, 'rgba(8,10,22,0.85)', T.color);
      text(`🛡️ ESCUDO ${Math.ceil(left)}s`, AX + AW - 95, s.y + (team === 0 ? -40 : 40), 18, '#fff', 'center', 800);
      ctx.restore();
    });
  }

  function drawCores() {
    cores.forEach((cr, team) => {
      const T = TEAMS[team];
      const frozen = cr.frozenUntil > t;
      const over = cr.overUntil > t;
      const col = over ? '#ffbe28' : T.color;
      const colRgb = over ? '255,190,40' : T.rgb;
      ctx.save();
      // brilho de fundo
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(colRgb, cr.x, cr.y, over ? 120 + Math.sin(t * 25) * 10 : 95);
      ctx.globalCompositeOperation = 'source-over';
      ctx.translate(cr.x, cr.y);
      // anel de energia (sobrecarga)
      const prog = over ? (cr.overUntil - t) / OVERDRIVE_TIME : cr.energy / ENERGY_MAX;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 8;
      ctx.beginPath(); ctx.arc(0, 0, 60, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = col;
      ctx.beginPath(); ctx.arc(0, 0, 60, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(prog, 0, 1)); ctx.stroke();
      // anel tracejado girando
      ctx.save();
      ctx.rotate(t * (team === 0 ? 1.5 : -1.5));
      ctx.strokeStyle = `rgba(${colRgb},0.6)`;
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 12]);
      ctx.beginPath(); ctx.arc(0, 0, 74, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      // cano
      ctx.save();
      ctx.rotate(cr.angle);
      const rec = cr.recoil * 8;
      const bg = ctx.createLinearGradient(0, -12, 0, 12);
      bg.addColorStop(0, '#ffffff'); bg.addColorStop(1, frozen ? '#9fdcff' : '#9aa3b5');
      ctx.fillStyle = bg;
      roundRect(ctx, 14 - rec, -12, 50, 24, 8);
      ctx.fill();
      ctx.fillStyle = col;
      roundRect(ctx, 52 - rec, -13, 14, 26, 5);
      ctx.fill();
      if (cr.recoil > 0.3 && !frozen) {
        ctx.globalCompositeOperation = 'lighter';
        drawGlow(colRgb, 72 - rec, 0, 22 * cr.recoil);
      }
      ctx.restore();
      // núcleo (círculo escuro com borda neon + logo oficial grande)
      const g = ctx.createRadialGradient(0, -10, 4, 0, 0, 44);
      g.addColorStop(0, '#1c2238');
      g.addColorStop(0.75, '#0b0e1a');
      g.addColorStop(1, T.deep);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, 42, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = T.light;
      ctx.lineWidth = 3;
      ctx.stroke();
      drawLogo(ctx, team, 0, 0, 84, T.color);
      // energia de curtidas
      if (!frozen) {
        pill(-58, 72, 116, 26, 'rgba(8,10,22,0.88)', `rgba(${colRgb},0.85)`);
        text(over ? '⚡ TIRO RÁPIDO!' : `❤️ ${cr.energy}/100 LIKES`, 0, 85, 13, '#fff', 'center', 800);
      }
      if (frozen) {
        ctx.fillStyle = 'rgba(170,230,255,0.55)';
        ctx.beginPath(); ctx.arc(0, 0, 64, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#e8f9ff';
        ctx.lineWidth = 3;
        ctx.stroke();
        text('❄️', 0, 2, 44, '#fff');
        pill(-46, 74, 92, 28, 'rgba(10,40,70,0.9)', '#bfefff');
        text(`CONGELADO ${Math.ceil(cr.frozenUntil - t)}s`, 0, 88, 12, '#fff', 'center', 800);
      }
      ctx.restore();
    });
  }

  function drawProjectiles() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of projectiles) {
      const T = TEAMS[p.team];
      if (p.kind === 'basic' || p.kind === 'burst') {
        const len = p.kind === 'burst' ? 0.045 : 0.035;
        const tg = ctx.createLinearGradient(p.x - p.vx * len, p.y - p.vy * len, p.x, p.y);
        tg.addColorStop(0, `rgba(${T.rgb},0)`);
        tg.addColorStop(1, `rgba(${T.rgb},0.9)`);
        ctx.strokeStyle = tg;
        ctx.lineWidth = p.r * 1.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x - p.vx * len, p.y - p.vy * len);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        drawGlow(T.rgb, p.x, p.y, p.r * 3);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.6, 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === 'meteor') {
        const tr = p.trail;
        for (let k = 0; k < tr.length; k += 2) {
          const a = k / tr.length;
          drawGlow('255,140,50', tr[k], tr[k + 1], 6 + a * 14);
        }
        drawGlow('255,200,90', p.x, p.y, 30);
        ctx.fillStyle = '#fff6d0';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.8, 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === 'giant') {
        drawGlow(T.rgb, p.x, p.y, p.r * 3 + Math.sin(t * 30) * 4);
      }
    }
    ctx.restore();
    for (const p of projectiles) {
      if (p.kind !== 'giant') continue;
      const T = TEAMS[p.team];
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(t * 8);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.arc(0, 0, p.r + 12, (k * Math.PI * 2) / 3, (k * Math.PI * 2) / 3 + 1.2);
        ctx.stroke();
      }
      ctx.restore();
      drawAvatar(p.av, p.x, p.y, p.r, T.color, 6, '#ffffff');
      pill(p.x - 74, p.y - p.r - 36, 148, 24, 'rgba(8,10,22,0.9)', T.color);
      text('🌹 TIRO GIGANTE', p.x, p.y - p.r - 24, 13, '#fff', 'center', 800);
    }
  }

  function drawBalls() {
    for (const b of balls) {
      const T = TEAMS[b.team];
      const a = b.life < 0.6 ? b.life / 0.6 : 1;
      const born = Math.min(1, (t - b.born) / 0.35);
      const sc = easeOutBack(born);
      ctx.save();
      ctx.globalAlpha = a;
      // rastro
      ctx.globalCompositeOperation = 'lighter';
      const tr = b.trail;
      for (let k = 0; k < tr.length; k += 2) {
        const f = (k + 2) / tr.length;
        drawGlow(T.rgb, tr[k], tr[k + 1], b.r * (0.4 + f * 0.8));
      }
      drawGlow(T.rgb, b.x, b.y, b.r * 2.2);
      ctx.globalCompositeOperation = 'source-over';
      drawAvatar(b.av, b.x, b.y, b.r * sc, T.color, 5, '#ffffff');
      // arco de tempo
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * sc + 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (b.life / BALL_LIFE));
      ctx.stroke();
      // nome em pílula
      ctx.font = font(17, 800);
      const w = ctx.measureText(b.name).width + 22;
      pill(b.x - w / 2, b.y + b.r + 12, w, 26, 'rgba(8,10,22,0.85)', T.color);
      text(b.name, b.x, b.y + b.r + 25.5, 17, '#fff', 'center', 800);
      ctx.restore();
    }
  }

  function drawTanks() {
    for (const tk of tanks) {
      const T = TEAMS[tk.team];
      // faixa de conversão
      ctx.save();
      roundRect(ctx, AX, AY, AW, AH, 12);
      ctx.clip();
      const y0 = tk.vy > 0 ? AY : tk.y, y1 = tk.vy > 0 ? tk.y : AY + AH;
      const g = ctx.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(tk.vy > 0 ? 0 : 1, `rgba(${T.rgb},0)`);
      g.addColorStop(tk.vy > 0 ? 1 : 0, `rgba(${T.rgb},0.35)`);
      ctx.fillStyle = g;
      ctx.fillRect(tk.x - CELL * 2.5, y0, CELL * 5, y1 - y0);
      ctx.restore();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(T.rgb, tk.x, tk.y, 170);
      ctx.restore();
      ctx.save();
      ctx.translate(tk.x, tk.y);
      if (tk.vy < 0) ctx.rotate(Math.PI);
      // esteiras
      ctx.fillStyle = '#15171f';
      roundRect(ctx, -122, -78, 42, 156, 14); ctx.fill();
      roundRect(ctx, 80, -78, 42, 156, 14); ctx.fill();
      ctx.fillStyle = '#4a5063';
      for (let k = 0; k < 7; k++) {
        const yy = -72 + ((k * 22 + t * 300) % 150);
        ctx.fillRect(-117, yy, 32, 6);
        ctx.fillRect(85, yy, 32, 6);
      }
      // corpo
      const bg = ctx.createLinearGradient(0, -70, 0, 70);
      bg.addColorStop(0, T.light);
      bg.addColorStop(0.35, T.color);
      bg.addColorStop(1, T.deep);
      ctx.fillStyle = bg;
      roundRect(ctx, -88, -68, 176, 136, 26);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = '#e8ecf5';
      roundRect(ctx, -13, 40, 26, 74, 8);
      ctx.fill();
      ctx.restore();
      drawAvatar(tk.av, tk.x, tk.y, 48, '#ffffff', 6, T.color);
      ctx.font = font(20, 800);
      const label = `🚀 ${tk.name}`;
      const w = ctx.measureText(label).width + 28;
      const ty = tk.y + (tk.vy > 0 ? -104 : 104);
      pill(tk.x - w / 2, ty - 16, w, 32, 'rgba(8,10,22,0.92)', T.color);
      text(label, tk.x, ty, 20, '#fff', 'center', 800);
    }
  }

  function drawParticles() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of particles) {
      const k = clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = k;
      const s = p.size * (0.5 + 0.5 * k);
      if (p.dot) {
        ctx.drawImage(glow(hexToRgb(p.color)), p.x - s * 1.5, p.y - s * 1.5, s * 3, s * 3);
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      }
    }
    ctx.globalAlpha = 1;
    for (const r of rings) {
      ctx.globalAlpha = r.life / r.maxLife;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 6 * (r.life / r.maxLife) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
  const rgbCache = new Map();
  function hexToRgb(hex) {
    if (rgbCache.has(hex)) return rgbCache.get(hex);
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    const n = parseInt(h, 16);
    const v = `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
    rgbCache.set(hex, v);
    return v;
  }

  function drawFloaters() {
    for (const f of floaters) {
      const age = (t - f.born) / f.life;
      const s = age < 0.2 ? easeOutBack(age / 0.2) : 1;
      ctx.save();
      ctx.globalAlpha = 1 - Math.max(0, (age - 0.6) / 0.4);
      ctx.translate(f.x, f.y - easeOutCubic(age) * 60);
      ctx.scale(s, s);
      text(f.str, 0, 0, f.size, f.color, 'center', 900, 8);
      ctx.restore();
    }
  }

  // ---------------- HUD ----------------
  function drawHUD() {
    const x0 = 30, y0 = 16, w = W - 60, h = 206;
    glass(x0, y0, w, h, 30, TEAMS[0].color, TEAMS[1].color);
    const p0 = dispPct[0];
    const pct0 = Math.round(p0 * 100), pct1 = 100 - pct0;
    // logos
    [0, 1].forEach((team) => {
      const T = TEAMS[team];
      const cx = team === 0 ? 100 : W - 100, cy = 86;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(T.rgb, cx, cy, 70 + (leader === team ? Math.sin(t * 5) * 6 : 0));
      ctx.restore();
      const g = ctx.createRadialGradient(cx, cy - 12, 6, cx, cy, 48);
      g.addColorStop(0, '#1d233b'); g.addColorStop(0.75, '#0a0d1a'); g.addColorStop(1, T.deep);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, 46, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = T.color;
      ctx.lineWidth = 3;
      ctx.stroke();
      drawLogo(ctx, team, cx, cy, 96, T.color);
      if (leader === team && !round.over) text('👑', cx, cy - 58, 28, '#fff');
      // nome, subtítulo e porcentagem
      const align = team === 0 ? 'left' : 'right';
      const tx = team === 0 ? 160 : W - 160;
      text(T.name, tx, 50, 30, T.color, align, 900);
      if (T.sub) text(T.sub, tx, 75, 13, 'rgba(255,255,255,0.72)', align, 800);
      const pg = ctx.createLinearGradient(0, 98, 0, 148);
      pg.addColorStop(0, '#ffffff'); pg.addColorStop(1, T.light);
      ctx.font = font(60);
      ctx.textAlign = align;
      ctx.textBaseline = 'middle';
      ctx.fillStyle = pg;
      ctx.fillText(`${team === 0 ? pct0 : pct1}%`, tx, 124);
    });
    // centro: tempo + rodadas
    const tl = Math.max(0, Math.ceil(timeLeft()));
    const mm = String(Math.floor(tl / 60)).padStart(2, '0'), ss = String(tl % 60).padStart(2, '0');
    const urgent = tl <= 10 && !round.over;
    pill(W / 2 - 90, 40, 180, 54, urgent ? 'rgba(255,40,70,0.9)' : 'rgba(255,255,255,0.08)', urgent ? '#ff8095' : 'rgba(255,255,255,0.25)');
    text(`${mm}:${ss}`, W / 2, 68, 38, '#ffffff', 'center', 900);
    text('RODADAS', W / 2, 114, 14, 'rgba(255,255,255,0.6)', 'center', 800);
    ctx.font = font(30);
    const a = String(history[0]), b = String(history[1]);
    text(a, W / 2 - 24, 140, 30, TEAMS[0].color, 'right');
    text('•', W / 2, 140, 26, 'rgba(255,255,255,0.6)');
    text(b, W / 2 + 24, 140, 30, TEAMS[1].color, 'left');
    // barra de domínio
    const bx = 62, by = 172, bw = W - 124, bh = 32;
    ctx.save();
    roundRect(ctx, bx, by, bw, bh, bh / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fill();
    ctx.clip();
    const split = bx + bw * p0;
    let g = ctx.createLinearGradient(bx, 0, split, 0);
    g.addColorStop(0, TEAMS[0].deep); g.addColorStop(1, TEAMS[0].color);
    ctx.fillStyle = g;
    ctx.fillRect(bx, by, split - bx, bh);
    g = ctx.createLinearGradient(split, 0, bx + bw, 0);
    g.addColorStop(0, TEAMS[1].light); g.addColorStop(0.3, TEAMS[1].color); g.addColorStop(1, TEAMS[1].deep);
    ctx.fillStyle = g;
    ctx.fillRect(split, by, bx + bw - split, bh);
    // listras animadas
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#ffffff';
    const off = (t * 60) % 40;
    for (let x = bx - 40 + off; x < bx + bw + 40; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, by + bh); ctx.lineTo(x + 18, by + bh); ctx.lineTo(x + 18 + bh, by); ctx.lineTo(x + bh, by);
      ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(bx, by + 3, bw, 7);
    ctx.restore();
    // marcas de 80%
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(bx + bw * WIN_PCT - 1, by + 4, 2, bh - 8);
    ctx.fillRect(bx + bw * (1 - WIN_PCT) - 1, by + 4, 2, bh - 8);
    // marcador VS
    const split2 = bx + bw * p0;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    drawGlow('255,255,255', split2, by + bh / 2, 46);
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(split2, by + bh / 2, 24, 0, Math.PI * 2); ctx.fill();
    text('VS', split2, by + bh / 2 + 1, 18, '#0a0d18', 'center', 900);
  }

  const ACTION_CARDS = [
    { key: 'chat', icon: '💬', tag: 'COMENTAR 1 ou 2', title: 'BOLINHA COM FOTO', desc: 'Quica 10s conquistando blocos', color: '#38e8ff', rgb: '56,232,255' },
    { key: 'like', icon: '❤️', tag: 'CURTIR A LIVE', title: '3 TIROS + ENERGIA', desc: '100 likes = 5s de tiro rápido', color: '#ff4d79', rgb: '255,77,121' },
    { key: 'follow', icon: '➕', tag: 'SEGUIR PERFIL', title: 'ESCUDO DEFENSIVO', desc: 'Rebate tiros inimigos por 4s', color: '#3dff8b', rgb: '61,255,139' },
    { key: 'rose', icon: '🌹', tag: '🪙 1 MOEDA (Rosa)', title: 'TIRO GIGANTE', desc: 'Destrói 1 fileira inteira', color: '#ffd84d', rgb: '255,216,77' },
    { key: 'meteor', icon: '☄️', tag: '🪙 5–10 MOEDAS', title: '15 METEOROS', desc: 'Mísseis teleguiados na arena', color: '#ff8a2b', rgb: '255,138,43' },
    { key: 'boss', icon: '🚀', tag: '🪙 20+ MOEDAS', title: 'TANQUE + CONGELA', desc: 'Varre 5 colunas + ❄️4s inimigo', color: '#d96bff', rgb: '217,107,255' },
  ];

  function drawBottom() {
    const x0 = 30, y0 = AY + AH + 20, w = W - 60, h = H - y0 - 14;
    glass(x0, y0, w, h, 28, TEAMS[0].color, TEAMS[1].color, 0.82);

    // 1. Botões de escolha de time (Topo do painel)
    const cy = y0 + 38;
    [0, 1].forEach((team) => {
      const T = TEAMS[team];
      const pulse = 1 + Math.max(0, Math.sin(t * 4 + team * Math.PI)) * 0.035;
      const cw = 468, chx = team === 0 ? x0 + 22 : x0 + w - 22 - cw;
      ctx.save();
      ctx.translate(chx + cw / 2, cy);
      ctx.scale(pulse, pulse);
      const g = ctx.createLinearGradient(-cw / 2, 0, cw / 2, 0);
      g.addColorStop(0, `rgba(${T.rgb},0.38)`); g.addColorStop(1, `rgba(${T.rgb},0.14)`);
      pill(-cw / 2, -25, cw, 50, g, T.color);
      ctx.fillStyle = T.color;
      ctx.beginPath(); ctx.arc(-cw / 2 + 28, 0, 19, 0, Math.PI * 2); ctx.fill();
      text(team === 0 ? '1' : '2', -cw / 2 + 28, 1, 24, '#06101a', 'center', 900);
      text('DIGITE', -cw / 2 + 58, 1, 16, 'rgba(255,255,255,0.8)', 'left', 800);
      text(team === 0 ? '1 ou GTA' : '2 ou ZELDA', -cw / 2 + 124, 1, 27, '#ffffff', 'left', 900);
      drawLogo(ctx, team, cw / 2 - 36, 0, 46, T.color);
      ctx.restore();
    });

    // 2. Grade sempre visível com as 6 ações da live (2 linhas x 3 colunas)
    const cols = 3, cw = 316, ch = 98, gx = 14, gy = 12;
    const gridW = cols * cw + (cols - 1) * gx;
    const sx = (W - gridW) / 2;
    const sy = y0 + 74;

    ACTION_CARDS.forEach((c, idx) => {
      const col = idx % cols, row = Math.floor(idx / cols);
      const cx0 = sx + col * (cw + gx), cy0 = sy + row * (ch + gy);
      const age = t - (actionFlash[c.key] ?? -10);
      const active = age >= 0 && age < 0.9 ? 1 - age / 0.9 : 0;
      const sc = 1 + Math.sin(active * Math.PI) * 0.045;

      ctx.save();
      ctx.translate(cx0 + cw / 2, cy0 + ch / 2);
      ctx.scale(sc, sc);
      ctx.translate(-cw / 2, -ch / 2);

      // Fundo do card
      roundRect(ctx, 0, 0, cw, ch, 18);
      const bg = ctx.createLinearGradient(0, 0, cw, ch);
      bg.addColorStop(0, `rgba(${c.rgb},${0.22 + active * 0.35})`);
      bg.addColorStop(1, 'rgba(10,13,26,0.92)');
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.lineWidth = active > 0 ? 3.5 : 2;
      ctx.strokeStyle = active > 0 ? '#ffffff' : `rgba(${c.rgb},0.75)`;
      ctx.stroke();

      // Ícone em destaque à esquerda
      roundRect(ctx, 10, 14, 64, 70, 14);
      ctx.fillStyle = `rgba(${c.rgb},0.22)`;
      ctx.fill();
      text(c.icon, 42, 50, 38, '#fff');

      // Tag da ação (topo)
      ctx.font = font(13, 900);
      const tw = ctx.measureText(c.tag).width + 18;
      pill(84, 11, tw, 22, c.color);
      text(c.tag, 84 + tw / 2, 22.5, 13, '#071018', 'center', 900);

      // Efeito principal + descrição
      text(c.title, 84, 52, 21, '#ffffff', 'left', 900);
      text(c.desc, 84, 77, 14, 'rgba(255,255,255,0.82)', 'left', 700);
      ctx.restore();
    });

    // 3. Barra inferior: Top 3 apoiadores de cada lado + status da live
    const ry = sy + 2 * ch + gy + 40;
    [0, 1].forEach((team) => {
      const T = TEAMS[team];
      const list = tops[team];
      const labelX = team === 0 ? x0 + 22 : x0 + w - 22;
      text(`👑 TOP`, labelX, ry - 9, 12, T.color, team === 0 ? 'left' : 'right', 900);
      text(T.name, labelX, ry + 9, 14, '#ffffff', team === 0 ? 'left' : 'right', 900);
      const startX = team === 0 ? x0 + 135 : x0 + w - 115;
      for (let k = 0; k < 3; k++) {
        const ax = team === 0 ? startX + k * 96 : startX - k * 96;
        const s = list[k];
        if (s) {
          drawAvatar(s.av, ax - 18, ry, 20, k === 0 ? '#ffd84d' : T.color, 3);
          text(shortNum(s.pts), ax + 10, ry, 14, '#ffffff', 'left', 800);
        } else {
          ctx.strokeStyle = `rgba(${T.rgb},0.35)`;
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath(); ctx.arc(ax - 18, ry, 18, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    });

    // Status discreto no centro
    let st = '', col = 'rgba(255,255,255,0.45)';
    if (simOn) { st = '● SIMULAÇÃO (S)'; col = '#ffd23f'; }
    else if (liveStatus.state === 'connected') { st = `● AO VIVO @${liveStatus.user}`; col = '#ff3b5c'; }
    else if (liveStatus.state === 'connecting') st = `conectando @${liveStatus.user}...`;
    else if (liveStatus.state === 'offline') st = `@${liveStatus.user} offline`;
    else if (liveStatus.state === 'server-off') st = 'servidor desligado';
    if (st) text(st, W / 2, ry, 13, col, 'center', 800);
  }
  function shortNum(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
    return String(n);
  }

  function drawBanner() {
    if (!bannerCur) return;
    const b = bannerCur;
    const age = t - b.born;
    const inK = easeOutBack(Math.min(1, age / 0.35));
    const outK = Math.min(1, (b.dur - age) / 0.25);
    const T = TEAMS[b.team];
    const bw = 880, bh = 120;
    const bx = W / 2 - bw / 2 + (1 - inK) * -900 * (b.team === 0 ? 1 : -1);
    const by = AY + 28;
    ctx.save();
    ctx.globalAlpha = Math.max(0, outK);
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(T.rgb, bx + 80, by + bh / 2, 140);
    ctx.globalCompositeOperation = 'source-over';
    roundRect(ctx, bx, by, bw, bh, 28);
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    g.addColorStop(0, `rgba(${T.rgb},0.55)`);
    g.addColorStop(0.35, 'rgba(10,12,26,0.92)');
    g.addColorStop(1, 'rgba(10,12,26,0.92)');
    ctx.fillStyle = g;
    ctx.fill();
    const sg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    sg.addColorStop(0, '#ffffff'); sg.addColorStop(0.5, T.color); sg.addColorStop(1, `rgba(${T.rgb},0.2)`);
    ctx.strokeStyle = sg;
    ctx.lineWidth = 3;
    ctx.stroke();
    // brilho passando
    ctx.save();
    ctx.clip();
    const sx = bx - 200 + ((age * 900) % (bw + 400));
    const sh = ctx.createLinearGradient(sx - 80, 0, sx + 80, 0);
    sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(0.5, 'rgba(255,255,255,0.12)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sh;
    ctx.fillRect(bx, by, bw, bh);
    ctx.restore();
    if (b.av) drawAvatar(b.av, bx + 72, by + bh / 2, 44, '#ffffff', 5, T.color);
    if (b.icon) text(b.icon, bx + 106, by + bh - 24, 30, '#fff');
    const size = fitFont(b.text, bw - 200, 38);
    text(b.text, bx + 148, by + 44, size, '#ffffff', 'left', 900);
    if (b.sub) text(b.sub, bx + 148, by + 84, 22, T.color, 'left', 800);
    ctx.restore();
  }

  function drawToasts() {
    toasts.forEach((ts, n) => {
      const age = t - ts.born;
      const a = Math.min(1, age / 0.2) * Math.min(1, (3.5 - age) / 0.4);
      const y = AY + AH - 46 - n * 60;
      const x = AX + 14 - (1 - easeOutCubic(Math.min(1, age / 0.3))) * 120;
      const T = TEAMS[ts.team];
      ctx.save();
      ctx.globalAlpha = Math.max(0, a);
      ctx.font = font(19, 800);
      const str = (ts.icon ? ts.icon + '  ' : '') + ts.text;
      const w = ctx.measureText(str).width + 80;
      roundRect(ctx, x, y - 24, w, 48, 24);
      ctx.fillStyle = 'rgba(8,10,22,0.85)';
      ctx.fill();
      ctx.strokeStyle = `rgba(${T.rgb},0.9)`;
      ctx.lineWidth = 2;
      ctx.stroke();
      drawAvatar(ts.av, x + 25, y, 18, T.color, 3);
      text(str, x + 54, y + 1, 19, '#ffffff', 'left', 800);
      ctx.restore();
    });
  }

  function drawCallout() {
    if (!callout) return;
    const c = callout;
    const age = t - c.born;
    const k = age / c.dur;
    const s = easeOutBack(Math.min(1, age / 0.3)) * (1 + k * 0.08);
    const a = k > 0.75 ? (1 - k) / 0.25 : 1;
    const T = c.team != null ? TEAMS[c.team] : { color: '#fff', rgb: '255,255,255', light: '#fff' };
    const cy = AY + AH / 2;
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    const g = ctx.createLinearGradient(0, cy - 110, 0, cy + 110);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(AX, cy - 110, AW, 220);
    ctx.translate(W / 2, cy);
    ctx.scale(s, s);
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(T.rgb, 0, -10, 260);
    ctx.globalCompositeOperation = 'source-over';
    const size = fitFont(c.str, AW - 60, 96);
    ctx.font = font(size);
    const tg = ctx.createLinearGradient(0, -50, 0, 30);
    tg.addColorStop(0, '#ffffff'); tg.addColorStop(1, T.light);
    ctx.lineJoin = 'round';
    ctx.lineWidth = 14;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText(c.str, 0, -14);
    ctx.fillStyle = tg;
    ctx.fillText(c.str, 0, -14);
    if (c.sub) text(c.sub, 0, 54, 28, T.color, 'center', 800, 7);
    ctx.restore();
  }

  function drawCountdown() {
    if (round.over) return;
    const tl = timeLeft();
    if (tl > 10 || tl <= 0) return;
    const sec = Math.ceil(tl);
    const frac = sec - tl; // 0 -> 1 dentro do segundo
    const s = 1.6 - easeOutCubic(Math.min(1, frac * 2)) * 0.6;
    ctx.save();
    ctx.globalAlpha = 0.55 * (1 - frac);
    ctx.translate(W / 2, AY + AH / 2);
    ctx.scale(s, s);
    text(String(sec), 0, 0, 260, sec <= 3 ? '#ff4d6a' : '#ffffff', 'center', 900, 16);
    ctx.restore();
  }

  function drawScreenFlash() {
    if (!screenFlash) return;
    const k = 1 - (t - screenFlash.born) / screenFlash.dur;
    ctx.save();
    roundRect(ctx, AX, AY, AW, AH, 12);
    ctx.clip();
    const g = ctx.createRadialGradient(W / 2, AY + AH / 2, 100, W / 2, AY + AH / 2, AH * 0.75);
    g.addColorStop(0, `rgba(${screenFlash.rgb},${0.05 * k})`);
    g.addColorStop(1, `rgba(${screenFlash.rgb},${0.45 * k})`);
    ctx.fillStyle = g;
    ctx.fillRect(AX, AY, AW, AH);
    ctx.restore();
  }

  function drawVictory() {
    if (!round.over) return;
    const age = t - (round.endAt - VICTORY_TIME);
    const T = TEAMS[round.winner];
    const k = Math.min(1, age / 0.4);
    const fadeOut = Math.min(1, (round.endAt - t) / 0.5);
    ctx.save();
    ctx.globalAlpha = fadeOut;
    // escurece tudo
    ctx.fillStyle = `rgba(4,6,14,${0.72 * k})`;
    roundRect(ctx, AX - 14, AY - 14, AW + 28, AH + 28, 26);
    ctx.fill();
    // raios girando
    const cx = W / 2, cy = AY + AH / 2 - 150;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.4);
    ctx.globalCompositeOperation = 'lighter';
    for (let r = 0; r < 14; r++) {
      ctx.rotate((Math.PI * 2) / 14);
      const g = ctx.createLinearGradient(0, 0, 700, 0);
      g.addColorStop(0, `rgba(${T.rgb},0.28)`);
      g.addColorStop(1, `rgba(${T.rgb},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(700, -70); ctx.lineTo(700, 70); ctx.closePath(); ctx.fill();
    }
    drawGlow(T.rgb, 0, 0, 340);
    ctx.restore();
    // logo grande
    const ls = easeOutBack(Math.min(1, age / 0.5));
    ctx.save();
    ctx.translate(cx, cy - 40);
    ctx.scale(ls, ls);
    const lg = ctx.createRadialGradient(0, -20, 10, 0, 0, 102);
    lg.addColorStop(0, '#1e2540'); lg.addColorStop(0.75, '#090c18'); lg.addColorStop(1, T.deep);
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.arc(0, 0, 98, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = T.color; ctx.lineWidth = 5; ctx.stroke();
    drawLogo(ctx, round.winner, 0, 0, 190, T.color, false);
    text('🏆', 78, -76, 60, '#fff');
    ctx.restore();
    // texto de vitória
    const ts = easeOutBack(Math.min(1, Math.max(0, age - 0.15) / 0.5)) * (1 + Math.sin(t * 4) * 0.015);
    ctx.save();
    ctx.translate(cx, cy + 150);
    ctx.scale(ts, ts);
    const vName = T.victoryName || T.name;
    const vSize = fitFont(vName, AW - 80, 114);
    ctx.font = font(vSize);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 16;
    ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    const tg = ctx.createLinearGradient(0, -60, 0, 60);
    tg.addColorStop(0, '#ffffff'); tg.addColorStop(0.5, T.light); tg.addColorStop(1, T.color);
    ctx.strokeText(vName, 0, 0);
    ctx.fillStyle = tg;
    ctx.fillText(vName, 0, 0);
    ctx.font = font(84);
    ctx.strokeText('VENCEU!', 0, 100);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('VENCEU!', 0, 100);
    ctx.restore();
    // placar + MVP
    if (age > 0.7) {
      const a2 = Math.min(1, (age - 0.7) / 0.4);
      ctx.globalAlpha = fadeOut * a2;
      const py = cy + 380 + (1 - a2) * 30;
      glass(cx - 330, py - 60, 660, 120, 30, TEAMS[0].color, TEAMS[1].color, 0.85);
      text('PLACAR DE RODADAS', cx, py - 34, 16, 'rgba(255,255,255,0.65)', 'center', 800);
      drawLogo(ctx, 0, cx - 262, py + 18, 52, TEAMS[0].color);
      text(TEAMS[0].short, cx - 222, py + 18, 28, TEAMS[0].color, 'left', 900);
      text(`${history[0]}  x  ${history[1]}`, cx, py + 18, 44, '#ffffff', 'center', 900);
      text(TEAMS[1].short, cx + 222, py + 18, 28, TEAMS[1].color, 'right', 900);
      drawLogo(ctx, 1, cx + 262, py + 16, 52, TEAMS[1].color);
      if (round.mvp) {
        const my = py + 140;
        glass(cx - 260, my - 46, 520, 92, 46, '#ffd84d', T.color, 0.85);
        drawAvatar(round.mvp.av, cx - 214, my, 34, '#ffd84d', 4);
        text('⭐ MVP DA RODADA', cx - 166, my - 16, 16, '#ffd84d', 'left', 900);
        const size = fitFont(round.mvp.name, 300, 30);
        text(round.mvp.name, cx - 166, my + 16, size, '#ffffff', 'left', 900);
        text(`${shortNum(round.mvp.pts)} pts`, cx + 236, my, 22, T.color, 'right', 900);
      }
      // barra de próxima rodada
      const by = AY + AH - 60;
      const prog = 1 - (round.endAt - t) / (VICTORY_TIME - 0.7);
      text(`Nova rodada em ${Math.max(0, Math.ceil(round.endAt - t))}s`, cx, by - 26, 22, '#ffffff', 'center', 800);
      pill(cx - 200, by - 6, 400, 12, 'rgba(255,255,255,0.15)');
      pill(cx - 200, by - 6, Math.max(12, 400 * clamp(prog, 0, 1)), 12, T.color);
    }
    ctx.restore();
  }

  function drawConfetti() {
    for (const c of confetti) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, c.life);
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.scale(1, Math.abs(Math.sin(c.phase)) * 0.8 + 0.2);
      ctx.fillStyle = c.color;
      ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
      ctx.restore();
    }
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (shake > 0.3) ctx.translate(rand(-shake, shake), rand(-shake, shake));
    drawArenaBack();
    drawGrid();
    drawFrontLine();
    drawScreenFlash();
    drawShields();
    drawCores();
    drawProjectiles();
    drawTanks();
    drawBalls();
    drawParticles();
    drawFloaters();
    drawCountdown();
    ctx.restore();
    drawHUD();
    drawBottom();
    drawToasts();
    drawCallout();
    drawBanner();
    drawVictory();
    drawConfetti();
  }

  // ---------------- Loop ----------------
  let last = performance.now();
  function frame(now) {
    const dt = clamp((now - last) / 1000, 0, 0.033);
    last = now;
    try {
      update(dt);
      render();
    } catch (err) {
      console.error('Erro no loop do jogo:', err);
    }
    requestAnimationFrame(frame);
  }
  resetRound();
  for (let i = 0; i < flash.length; i++) flash[i] = -10;
  requestAnimationFrame(frame);
})();
