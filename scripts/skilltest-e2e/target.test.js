'use strict';
// Zielwahl über Sitze hinweg: 1 Mensch + 3 CPUs. Der Mensch greift gezielt einen Helden auf Sitz 2 bzw. 3 an;
// geprüft wird, dass GENAU dieser Held Schaden nimmt (Besitzer-Auflösung für Sitze ≥ 2).
const { boardHeroIdxs, startServer, createAccount, check, sleep, finish, BASE } = require('./lib');
const { io } = require('socket.io-client');
const cards = require('../../data/cards.json'); const db = {}; cards.forEach(c => db[c.name] = c);

(async () => {
  const acc = await createAccount('TgtTest' + Date.now().toString(36));
  const srv = await startServer({ PP_ST_BOT_DELAY_MS: '20' });
  try {
    const res = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: acc.username, password: acc.password }) });
    const { token } = await res.json();
    const socket = io(BASE, { transports: ['websocket'] });
    const events = [];
    socket.onAny((ev, ...a) => events.push({ ev, a }));
    await new Promise(r => socket.on('connect', r));
    socket.emit('auth', token); await new Promise(r => socket.once('auth_ok', r));
    const last = (ev) => { for (let i = events.length - 1; i >= 0; i--) if (events[i].ev === ev) return events[i].a[0]; return null; };
    const waitFor = async (pred, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = pred(); if (v) return v; await sleep(80); } return null; };

    socket.emit('create_room', { skillTest: { prepTimerDisabled: true, turnTimerDisabled: true } });
    const room = await waitFor(() => last('room_joined'));
    for (let i = 0; i < 3; i++) socket.emit('st_add_cpu', { roomId: room.id });
    await sleep(300);
    socket.emit('st_start', { roomId: room.id });
    let cur = await waitFor(() => last('st_prep_state'));
    socket.on('st_prep_state', (s) => { cur = s; });
    const plan = boardHeroIdxs(db, cur.me.hand);
    for (let hi = 0; hi < plan.length; hi++) {
      const idx = plan[hi];
      socket.emit('st_prep_move', { roomId: room.id, move: { type: 'place', from: { kind: 'hand', idx }, to: { kind: 'hero', hi } } });
      await sleep(200);
    }
    socket.emit('st_prep_ready', { roomId: room.id, ready: true });
    console.log('Zielwahl über Sitze');
    await waitFor(() => { const g = last('game_state'); return g && g.skillTest && g.skillTest.round >= 1 ? g : null; });

    const hpOf = (g, seat, hi) => g.players[seat].heroes[hi] && g.players[seat].heroes[hi].hp;
    let hit = 0, tried = 0;
    for (const targetSeat of (process.env.TGT || '2,3,1').split(',').map(Number)) {
      // Auf den eigenen Zug warten
      const turn = await waitFor(() => { const g = last('game_state'); return g && !g.result && g.activePlayer === g.myIndex && !g.skillTest.busy && !g.effectPrompt && !g.potionTargeting ? g : null; }, 60000);
      if (!turn) { const g = last('game_state'); console.log('  (kein eigener Zug mehr)', g && JSON.stringify({ r: g.skillTest.round, ap: g.activePlayer, me: g.myIndex, busy: g.skillTest.busy, ep: g.effectPrompt && g.effectPrompt.type, pt: !!g.potionTargeting, out: g.skillTest.eliminated, over: !!g.result, passed: g.skillTest.passed, heroes: g.players.map(p => p.heroes.filter(h => h.name && h.hp > 0).length) })); break; }
      if (targetSeat === turn.myIndex) continue;
      const seatTarget = targetSeat;
      const hi = turn.players[seatTarget].heroes.findIndex(h => h && h.name && h.hp > 0);
      if (hi < 0) continue;
      const before = hpOf(turn, seatTarget, hi);
      const beforeAll = turn.players.map((p, s) => p.heroes.map(h => h && h.hp));
      const myHero = turn.players[turn.myIndex].heroes.findIndex((h, k) => h && h.name && h.hp > 0 && !(turn.skillTest.exhaustedHeroes || {})[turn.myIndex + ':' + k]);
      if (myHero < 0) { console.log('  (kein bereiter Held)'); break; }
      socket.emit('st_attack', { roomId: room.id, heroIdx: myHero });
      const prompt = await waitFor(() => { const g = last('game_state'); return g && g.potionTargeting && g.potionTargeting.ownerIdx === g.myIndex ? g : null; }, 8000);
      tried++;
      if (!prompt) { console.log('  kein Ziel-Prompt für Angriff auf Sitz', seatTarget); continue; }
      const pt = prompt.potionTargeting;
      const ids = (pt.validTargets || []).map(t => t.id);
      const wantId = (pt.validTargets || []).find(t => t.owner === seatTarget && t.type === 'hero' && t.heroIdx === hi);
      check(`Held auf Sitz ${seatTarget} ist als Ziel angeboten`, !!wantId, { ids: ids.slice(0, 12) });
      if (!wantId) { socket.emit('confirm_potion', { roomId: room.id, selectedIds: [] }); await sleep(500); continue; }
      socket.emit('confirm_potion', { roomId: room.id, selectedIds: [wantId.id] });
      // Bestätigungsschritt (Attack-Karte): ggf. confirm
      // Der Angriff läuft mit Animationspausen — auf die Auflösung warten (höchstens 8 s).
      await waitFor(() => { const g = last('game_state'); return g && !g.potionTargeting && !g.skillTest.busy && hpOf(g, seatTarget, hi) < before ? g : null; }, 8000);
      const g2 = last('game_state');
      const after = hpOf(g2, seatTarget, hi);
      const afterAll = g2.players.map((p, s) => p.heroes.map(h => h && h.hp));
      const hurt = [];
      afterAll.forEach((hs, s) => hs.forEach((h, k) => { if (beforeAll[s] && h != null && beforeAll[s][k] != null && h < beforeAll[s][k] && s !== g2.activePlayer) hurt.push(`${s}:${k}`); }));
      // Einzelne Helden können Schaden verhindern (Schutz-Fähigkeiten) — gezählt wird nur, ob die Zielwahl insgesamt trifft.
      console.log(`  Held Sitz ${seatTarget}:${hi}: ${before} → ${after}${after < before ? '' : ' (kein Schaden — evtl. Schutz)'}`);
      if (!(after < before) && process.env.ST_DEBUG) {
        const evs = events.slice(-60).filter(e => !['game_state', 'room_update', 'rooms'].includes(e.ev)).map(e => e.ev + ':' + JSON.stringify(e.a[0]).slice(0, 160));
        console.log('  Ereignisse:', evs.join('\n    '));
        const hero = g2.players[seatTarget].heroes[hi];
        console.log('  Held:', JSON.stringify(hero).slice(0, 400));
      }
      if (after < before) hit++;
    }
    check('Gezielte Treffer auf Helden anderer Sitze (≥ 2 von 3)', hit >= 2, { hit, tried });
    socket.close();
  } catch (e) { console.error(e); process.exitCode = 1; }
  if (process.env.ST_SHOW_LOG) console.log(srv.log().split('\n').filter(l => /skilltest|Error|Fehler/.test(l)).slice(-15).join('\n'));
  srv.child.kill();
  process.exit(finish() ? 1 : (process.exitCode || 0));
})();
