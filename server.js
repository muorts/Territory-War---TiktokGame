// Servidor: conecta na live do TikTok e envia os eventos para a página do jogo (Socket.IO)
import 'dotenv/config';
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const USERNAME = (process.env.TIKTOK_USERNAME || '').replace('@', '').trim();
const RETRY_MS = 30000;

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use('/fonts', express.static(path.join(__dirname, 'node_modules/@fontsource/rubik/files')));
const httpServer = createServer(app);
const io = new Server(httpServer);

let status = { state: USERNAME ? 'connecting' : 'no-user', user: USERNAME };
function setStatus(state, extra = {}) {
  status = { state, user: USERNAME, ...extra };
  io.emit('status', status);
}
io.on('connection', (socket) => socket.emit('status', status));

// ---------- Normalização dos dados ----------
function pickUser(u) {
  if (!u) return { id: 'anon', name: 'Anônimo', avatar: '' };
  const avatar =
    u.avatarThumb?.urlList?.[0] || u.avatarMedium?.urlList?.[0] || u.avatarLarge?.urlList?.[0] || '';
  return {
    id: String(u.id || u.displayId || u.nickname || 'anon'),
    name: u.nickname || u.displayId || 'Anônimo',
    handle: u.displayId || '',
    avatar,
  };
}

// Mostra no terminal os campos crus do 1º evento de cada tipo (para conferir)
const loggedTypes = new Set();
function logFirst(type, data, fields) {
  if (loggedTypes.has(type)) return;
  loggedTypes.add(type);
  const sample = {};
  for (const f of fields) sample[f] = f.split('.').reduce((o, k) => (o == null ? o : o[k]), data);
  console.log(`[campos ${type}]`, JSON.stringify(sample, null, 0).slice(0, 800));
}

function send(ev) {
  io.emit('live-event', ev);
}

// ---------- Conexão com o TikTok ----------
const giftStreaks = new Map(); // controla combos de presentes (rosas em sequência)
let connection = null;
let retryTimer = null;

function scheduleRetry() {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(connectTikTok, RETRY_MS);
}

async function connectTikTok() {
  if (!USERNAME) return;
  setStatus('connecting');
  if (connection) {
    connection.removeAllListeners();
    connection.disconnect().catch(() => {});
  }
  connection = new TikTokLiveConnection(USERNAME, {});

  connection.on(WebcastEvent.CHAT, (data) => {
    logFirst('CHAT', data, ['content', 'user.nickname', 'user.displayId', 'user.avatarThumb.urlList']);
    send({ type: 'chat', user: pickUser(data.user), text: String(data.content || '') });
  });

  connection.on(WebcastEvent.LIKE, (data) => {
    logFirst('LIKE', data, ['count', 'total', 'user.nickname']);
    send({ type: 'like', user: pickUser(data.user), likeCount: Number(data.count) || 1 });
  });

  connection.on(WebcastEvent.GIFT, (data) => {
    logFirst('GIFT', data, ['giftId', 'repeatCount', 'repeatEnd', 'groupId', 'gift.name', 'gift.diamondCount', 'gift.type', 'user.nickname']);
    const diamonds = Number(data.gift?.diamondCount) || 1;
    const streakable = Number(data.gift?.type) === 1;
    const repeat = Number(data.repeatCount) || 1;
    let count = 1;
    if (streakable) {
      // Em combos o TikTok manda vários eventos; enviamos só os presentes novos
      const key = `${data.user?.id}-${data.giftId}-${data.groupId}`;
      const last = giftStreaks.get(key) || 0;
      count = Math.max(0, repeat - last);
      giftStreaks.set(key, repeat);
      if (data.repeatEnd) setTimeout(() => giftStreaks.delete(key), 5000);
    } else {
      count = Math.max(1, repeat);
    }
    if (count <= 0) return;
    send({
      type: 'gift',
      user: pickUser(data.user),
      diamonds,
      giftName: data.gift?.name || 'Presente',
      count,
    });
  });

  connection.on(WebcastEvent.FOLLOW, (data) => {
    logFirst('FOLLOW', data, ['user.nickname', 'user.displayId']);
    send({ type: 'follow', user: pickUser(data.user) });
  });

  connection.on(WebcastEvent.MEMBER, (data) => {
    logFirst('MEMBER', data, ['user.nickname', 'user.displayId']);
    send({ type: 'member', user: pickUser(data.user) });
  });

  connection.on(WebcastEvent.STREAM_END, () => {
    console.log('⛔ A live terminou. Tentando de novo em 30s...');
    setStatus('offline', { msg: 'Live encerrada' });
    scheduleRetry();
  });

  connection.on(ControlEvent.DISCONNECTED, () => {
    console.log('🔌 Desconectado da live. Tentando de novo em 30s...');
    setStatus('offline', { msg: 'Desconectado' });
    scheduleRetry();
  });

  connection.on(ControlEvent.ERROR, (err) => {
    const info = String(err?.info || '');
    if (info.includes('while connecting')) return; // já mostrado abaixo
    console.log('⚠️  Erro da conexão:', info, err?.exception?.message || '');
  });

  try {
    const state = await connection.connect();
    console.log(`✅ Conectado na live de @${USERNAME} (sala ${state?.roomId || '?'})`);
    setStatus('connected');
  } catch (err) {
    console.log(`❌ Não conectou em @${USERNAME}: ${err?.message || err}`);
    console.log('   (A live precisa estar NO AR. Tentando de novo em 30s...)');
    setStatus('offline', { msg: err?.message || 'Live fora do ar' });
    scheduleRetry();
  }
}

httpServer.listen(PORT, () => {
  console.log(`🎮 Jogo rodando em http://localhost:${PORT}`);
  console.log('   Tecla S na página = MODO SIMULAÇÃO');
  if (!USERNAME) {
    console.log('ℹ️  Nenhum @ no arquivo .env (TIKTOK_USERNAME). Use o modo simulação.');
  } else {
    connectTikTok();
  }
});
