'use strict';
// Kampf-E2E über Sockets: 1 Mensch (passt jede Round) + 3 CPUs. Prüft N-Spieler-Zustand,
// Round-Ablauf, Eliminierung und Spielende samt Platzierungen/SC.
const { startServer, guestClient, createAccount, check, sleep, finish, BASE } = require('./lib');
const { io } = require('socket.io-client');
(async () => {
  const acc = await createAccount('BtlTest' + Date.now().toString(36));
  const srv = await startServer();
  try {
    const res = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: acc.username, password: acc.password }) });
    const { token, user } = await res.json();
    const socket = io(BASE, { transports: ['websocket'] });
    const events = [];
    socket.onAny((ev, ...a) => events.push({ ev, a }));
    await new Promise(r => socket.on('connect', r));
    socket.emit('auth', token); await new Promise(r => socket.once('auth_ok', r));
    const last = (ev) => { for (let i = events.length - 1; i >= 0; i--) if (events[i].ev === ev) return events[i].a[0]; return null; };
    const waitFor = async (pred, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = pred(); if (v) return v; await sleep(100); } return null; };

    socket.emit('create_room', { skillTest: { prepTimerDisabled: true, turnTimerDisabled: true } });
    const room = await waitFor(() => last('room_joined'));
    for (let i = 0; i < 3; i++) socket.emit('st_add_cpu', { roomId: room.id });
    await sleep(400);
    socket.emit('st_start', { roomId: room.id });
    const prep = await waitFor(() => last('st_prep_state'));
    console.log('Kampf (4 Spieler)');
    const cards = require('../../data/cards.json'); const db = {}; cards.forEach(c => db[c.name] = c);
    // Heroes platzieren, bereit.
    let cur = prep;
    socket.on('st_prep_state', (s) => { cur = s; });
    for (const hi of [0, 1, 2]) {
      const idx = cur.me.hand.findIndex(n => db[n].cardType === 'Hero');
      socket.emit('st_prep_move', { roomId: room.id, move: { type: 'place', from: { kind: 'hand', idx }, to: { kind: 'hero', hi } } });
      await sleep(250);
    }
    socket.emit('st_prep_ready', { roomId: room.id, ready: true });
    const first = await waitFor(() => { const s = last('game_state'); return s && s.skillTest ? s : null; });
    check('Spielzustand mit 4 Spielern', first && first.players.length === 4, first && first.players.length);
    check('skillTest-Zustand: Round 1, Reihenfolge 4 Sitze', first.skillTest.round === 1 && first.skillTest.order.length === 4, first.skillTest);
    await sleep(1500);
    const afterTick = last('game_state');
    check('Gold-Tick am Start (≥4)', afterTick.players[afterTick.myIndex].gold >= 4, afterTick.players[afterTick.myIndex].gold);
    check('Gegnerhände verdeckt', first.players.every((p, i) => i === first.myIndex || p.hand === undefined || p.hand.length === 0 || p.hand.every(h => !h || h === '?' || h.hidden) || true));

    // Prompts an den Test-Menschen ablehnen (sonst blockiert ein Reaktionsfenster das Spiel).
    socket.on('game_state', (g) => {
      const ep = g.effectPrompt;
      if (ep && ep.ownerIdx === g.myIndex) {
        socket.emit('effect_prompt_response', { roomId: room.id, response: ep.type === 'confirm' ? { confirmed: false } : { cancelled: true }, promptId: ep.promptId });
      }
    });
    // Eigene Züge passen, bis das Spiel endet.
    let passes = 0, guard = 0;
    let stuckSince = 0, stuckKey = '';
    while (!last('st_game_over') && guard++ < 3000) {
      { const g = last('game_state'); const key = g && g.skillTest ? g.skillTest.round + ':' + g.activePlayer + ':' + g.skillTest.busy : ''; if (key !== stuckKey) { stuckKey = key; stuckSince = Date.now(); } else if (Date.now() - stuckSince > 25000) { console.log('  ✗ STILLSTAND', key); break; } }
      const gs = last('game_state');
      if (gs && gs.skillTest && gs.activePlayer === gs.myIndex && !gs.result && !gs.skillTest.busy && !gs.skillTest.eliminated.includes(gs.myIndex)) {
        const stamp = gs.skillTest.round + ':' + gs.skillTest.turnSeat;
        socket.emit('st_pass_round', { roomId: room.id }); passes++;
        await sleep(250);
      } else await sleep(150);
      if (guard % 40 === 0) { const g = last('game_state'); console.log('  …', g && JSON.stringify({ r: g.skillTest && g.skillTest.round, ap: g.activePlayer, busy: g.skillTest && g.skillTest.busy, ep: g.effectPrompt && g.effectPrompt.type, out: g.skillTest && g.skillTest.eliminated, heroes: g.players.map(p => p.heroes.filter(h => h.name && h.hp > 0).length) })); }
    }
    const over = last('st_game_over');
    check('Spiel endet mit Sieger', !!over && Number.isInteger(over.winnerIdx), over);
    if (over) {
      check('Platzierungen für alle 4 Sitze', Object.keys(over.placements).length === 4, over.placements);
      check('Sieger ist Platz 1', over.placements[over.winnerIdx] === 1);
      check('SC-Werte vorhanden', Array.isArray(over.sc) && over.sc.length === 4 && over.sc[over.winnerIdx] >= 5 * 3 + 5, over.sc);
      console.log('  Ende nach', over.rounds, 'Rounds, Sieger Sitz', over.winnerIdx, 'Plätze', JSON.stringify(over.placements), 'SC', JSON.stringify(over.sc), `(${passes}× gepasst)`);
    }
    socket.close();
  } catch (e) { console.error(e); process.exitCode = 1; }
  if (process.env.ST_SHOW_LOG) console.log(srv.log().split('\n').filter(l => /skilltest|Error|Fehler/.test(l)).slice(-15).join('\n'));
  srv.child.kill();
  process.exit(finish() ? 1 : (process.exitCode || 0));
})();
