'use strict';
// Who's Online: Klick auf einen Spieler im laufenden Duell -> `spectate_lookup` liefert den Raum, danach tritt der Client per `join_room` (asSpectator) bei.
// Voraussetzung: socket.io-client per NODE_PATH (siehe lib.js).
const { startServer, createAccount, check, sleep, finish, BASE } = require('./lib');
const { io } = require('socket.io-client');

async function login(name, pw) {
  const res = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: name, password: pw }) });
  const { token, user } = await res.json();
  const socket = io(BASE, { transports: ['websocket'] });
  const events = [];
  socket.onAny((ev, ...args) => events.push({ ev, args }));
  await new Promise(r => socket.on('connect', r));
  socket.emit('auth', token);
  await new Promise(r => socket.once('auth_ok', r));
  const waitFor = (ev, pred, ms = 8000) => new Promise((resolve, reject) => {
    const hit = [...events].reverse().find(e => e.ev === ev && (!pred || pred(e.args[0])));
    if (hit) return resolve(hit.args[0]);
    const t = setTimeout(() => { socket.off(ev, h); reject(new Error('Timeout wartet auf ' + ev + ' (' + name + ')')); }, ms);
    const h = (d) => { if (!pred || pred(d)) { clearTimeout(t); socket.off(ev, h); resolve(d); } };
    socket.on(ev, h);
  });
  const ask = (ev, data) => new Promise(r => socket.emit(ev, data, r));
  return { name, socket, user, events, waitFor, ask, close: () => socket.close() };
}

(async () => {
  const srv = await startServer();
  try {
    const sfx = String(Date.now()).slice(-6);
    const names = ['spA' + sfx, 'spB' + sfx, 'spC' + sfx, 'spD' + sfx];
    for (const n of names) await createAccount(n, 'test1234');
    const [A, B, C, D] = await Promise.all(names.map(n => login(n, 'test1234')));
    await sleep(500);

    console.log('Kein Duell');
    let r = await C.ask('spectate_lookup', { userId: A.user.id });
    check('Spieler ohne Duell: Fehlermeldung', r && r.error && /not in a running duel/i.test(r.error), r);
    r = await C.ask('spectate_lookup', { userId: C.user.id });
    check('Auf sich selbst: Fehlermeldung', r && !!r.error, r);
    r = await C.ask('spectate_lookup', {});
    check('Ohne Nutzer: Fehlermeldung', r && !!r.error, r);

    console.log('Duell A gegen B (Herausforderung)');
    const ch = await new Promise(res => A.socket.emit('challenge_send', { to: B.user.id, ranked: false }, res));
    check('Herausforderung gesendet', ch && ch.ok, ch);
    const resp = await new Promise(res => B.socket.emit('challenge_respond', { id: ch.message.id, accept: true }, res));
    check('Herausforderung angenommen', resp && !resp.error, resp);
    await A.waitFor('game_state', null, 20000);
    await sleep(1000);

    r = await C.ask('spectate_lookup', { userId: A.user.id });
    check('Lookup liefert den Raum des laufenden Duells', r && r.ok && !!r.roomId, r);
    const room = { id: r && r.roomId };
    check('…ohne Zuschauer-Passwort', r && r.hasSpecPw === false, r);
    r = await C.ask('spectate_lookup', { userId: B.user.id });
    check('Lookup über den Gegner liefert denselben Raum', r && r.ok && r.roomId === room.id, r);

    console.log('Zuschauen (Yes)');
    C.socket.emit('join_room', { roomId: room.id, password: '', asSpectator: true, deckId: null });
    const joined = await C.waitFor('room_joined', d => d.id === room.id);
    check('C sitzt als Zuschauer im Raum', (joined.spectators || []).includes(C.user.username) && !(joined.players || []).includes(C.user.username), joined);
    const gs = await C.waitFor('game_state', null, 8000).catch(() => null);
    check('C bekommt den Spielzustand als Zuschauer', !!gs && gs.isSpectator === true, gs && Object.keys(gs).slice(0, 8));

    console.log('Zuschauer-Grenzen');
    r = await D.ask('spectate_lookup', { userId: A.user.id });
    check('Dritter Zuschauer: weiter erlaubt', r && r.ok, r);
    r = await A.ask('spectate_lookup', { userId: B.user.id });
    check('Mitspieler fragt nach dem Gegner: erlaubt (derselbe Raum)', r && r.ok && r.roomId === room.id, r);
    [A, B, C, D].forEach(c => c.close());
  } catch (e) { console.error(e); process.exitCode = 1; }
  srv.child.kill();
  process.exit(finish() ? 1 : (process.exitCode || 0));
})();
