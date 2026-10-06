'use strict';
// Sitzwechsel im Kampf: (1) Verbindung eines Menschen bricht ab → CPU übernimmt, (2) Aufgeben scheidet nur diesen Sitz aus.
// 2 Menschen + 1 CPU.
const { boardHeroIdxs, startServer, createAccount, check, sleep, finish, BASE } = require('./lib');
const { io } = require('socket.io-client');
const cards = require('../../data/cards.json'); const db = {}; cards.forEach(c => db[c.name] = c);

async function client(label) {
  const acc = await createAccount(label + Date.now().toString(36));
  const res = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: acc.username, password: acc.password }) });
  const { token } = await res.json();
  const socket = io(BASE, { transports: ['websocket'], forceNew: true });
  const events = [];
  socket.onAny((ev, ...a) => events.push({ ev, a }));
  await new Promise(r => socket.on('connect', r));
  socket.emit('auth', token); await new Promise(r => socket.once('auth_ok', r));
  const c = { label, socket, events, acc, token };
  c.last = (ev) => { for (let i = events.length - 1; i >= 0; i--) if (events[i].ev === ev) return events[i].a[0]; return null; };
  // Prompts ablehnen, damit nichts blockiert.
  socket.on('game_state', (g) => {
    const ep = g.effectPrompt;
    if (ep && ep.ownerIdx === g.myIndex) socket.emit('effect_prompt_response', { roomId: c.roomId, response: ep.type === 'confirm' ? { confirmed: false } : { cancelled: true }, promptId: ep.promptId });
  });
  return c;
}
const waitFor = async (pred, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = pred(); if (v) return v; await sleep(100); } return null; };

async function prepAndReady(c) {
  let cur = await waitFor(() => c.last('st_prep_state'));
  c.socket.on('st_prep_state', (s) => { cur = s; });
  const plan = boardHeroIdxs(db, cur.me.hand);
  for (let hi = 0; hi < plan.length; hi++) {
    const idx = plan[hi];
    c.socket.emit('st_prep_move', { roomId: c.roomId, move: { type: 'place', from: { kind: 'hand', idx }, to: { kind: 'hero', hi } } });
    await sleep(250);
  }
  c.socket.emit('st_prep_ready', { roomId: c.roomId, ready: true });
}

async function setup(label) {
  const a = await client(label + 'A'), b = await client(label + 'B');
  // Zug-Timer an (kürzester Wert): Fragt eine Karte den Test-Menschen etwas (z. B. „Slippery Movement" zu Zugbeginn), beantwortet der Wächter
  // den Prompt nach Ablauf mit der CPU-Vorgabe — sonst hinge das Spiel, weil der Test-Mensch nie antwortet.
  a.socket.emit('create_room', { skillTest: { prepTimerDisabled: true, turnTimerDisabled: false, turnTimerSec: 15 } });
  const room = await waitFor(() => a.last('room_joined'));
  a.roomId = b.roomId = room.id;
  b.socket.emit('join_room', { roomId: room.id });
  await waitFor(() => b.last('room_joined'));
  a.socket.emit('st_add_cpu', { roomId: room.id });
  await sleep(400);
  a.socket.emit('st_start', { roomId: room.id });
  await Promise.all([prepAndReady(a), prepAndReady(b)]);
  await waitFor(() => { const s = a.last('game_state'); return s && s.skillTest ? s : null; });
  return { a, b, room };
}

// Der Test-Mensch passt jede eigene Round, bis das Spiel endet.
async function passUntilOver(c, limitMs = 90000) {
  const t0 = Date.now();
  while (!c.last('st_game_over') && Date.now() - t0 < limitMs) {
    const g = c.last('game_state');
    if (g && g.skillTest && g.activePlayer === g.myIndex && !g.result && !g.skillTest.busy && !g.skillTest.eliminated.includes(g.myIndex)) {
      c.socket.emit('st_pass_round', { roomId: c.roomId }); await sleep(250);
    } else await sleep(150);
  }
  return c.last('st_game_over');
}

(async () => {
  const srv = await startServer();
  try {
    console.log('Szenario 1: Verbindungsabbruch → CPU übernimmt');
    {
      const { a, b } = await setup('S1');
      const gB = b.last('game_state'); const seatB = gB.myIndex;
      b.socket.close();
      const bot = await waitFor(() => { const g = a.last('game_state'); return g && g.skillTest.botSeats.includes(seatB) ? g : null; }, 8000);
      check('Sitz des Getrennten wird von der CPU gespielt', !!bot, a.last('game_state') && a.last('game_state').skillTest.botSeats);
      const over = await passUntilOver(a);
      check('Spiel endet trotz getrenntem Menschen', !!over && Number.isInteger(over.winnerIdx), over);
      if (over) check('Platzierungen für alle 3 Sitze', Object.keys(over.placements).length === 3, over.placements);
      a.socket.close();
    }
    console.log('Szenario 2: Aufgeben scheidet nur diesen Sitz aus');
    {
      const { a, b } = await setup('S2');
      const seatA = a.last('game_state').myIndex;
      a.socket.emit('surrender_game', { roomId: a.roomId });
      const g = await waitFor(() => { const s = b.last('game_state'); return s && s.skillTest.eliminated.includes(seatA) ? s : null; }, 10000);
      check('Aufgebender Sitz ist ausgeschieden', !!g, b.last('game_state') && b.last('game_state').skillTest.eliminated);
      check('Spiel läuft weiter (kein Ergebnis)', g && !g.result, g && g.result);
      const over = await passUntilOver(b);
      check('Spiel endet mit Sieger', !!over && Number.isInteger(over.winnerIdx), over);
      if (over) {
        check('Aufgebender ist nicht Sieger', over.winnerIdx !== seatA, over.winnerIdx);
        check('Aufgebender liegt hinter dem Sieger', over.placements[seatA] > over.placements[over.winnerIdx], over.placements);
      }
      a.socket.close(); b.socket.close();
    }
  } catch (e) { console.error(e); process.exitCode = 1; }
  if (process.env.ST_SHOW_LOG) console.log(srv.log().split('\n').filter(l => /skilltest|Error|Fehler/.test(l)).slice(-15).join('\n'));
  srv.child.kill();
  process.exit(finish() ? 1 : (process.exitCode || 0));
})();
