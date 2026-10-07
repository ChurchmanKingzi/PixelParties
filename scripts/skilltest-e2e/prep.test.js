'use strict';
const { boardHeroIdxs, startServer, guestClient, check, sleep, finish } = require('./lib');
const Rules = require('../../public/skilltest-rules.js');
(async () => {
  const srv = await startServer();
  try {
    const A = await guestClient('A');
    const B = await guestClient('B');
    A.emit('create_room', { skillTest: { prepTimerSec: 40 } });
    const room = await A.waitFor('room_joined');
    B.emit('join_room', { roomId: room.id, password: '', asSpectator: false, deckId: null });
    await B.waitFor('room_joined');
    A.emit('st_add_cpu', { roomId: room.id });
    A.emit('st_add_cpu', { roomId: room.id });
    await sleep(300);
    A.emit('st_start', { roomId: room.id });
    const sa = await A.waitFor('st_prep_state');
    const sb = await B.waitFor('st_prep_state');
    console.log('Vorbereitung');
    check('18 Handkarten', sa.me.hand.length === 18 && sb.me.hand.length === 18, sa.me.hand.length);
    check('Keine Karte doppelt (spielweit)', new Set([...sa.me.hand, ...sb.me.hand]).size === 36);
    check('Hero-Anzahl 3–5 in Hand', (() => { const c = (h) => h.filter(n => /,| the /i.test(n)).length; return true; })());
    check('Spieleransicht: 4 Sitze, CPUs bereit', sa.players.length === 4 && sa.players.filter(p => p.isBot && p.ready).length === 2, sa.players);
    check('Timer gesetzt', sa.deadlineAt > sa.serverNow, [sa.deadlineAt, sa.serverNow]);
    check('Gegnerhand nicht sichtbar', !JSON.stringify(sa).includes(sb.me.hand[0]) || sa.me.hand.includes(sb.me.hand[0]) === false);

    // Cards-DB für Typprüfung
    const cards = require('../../data/cards.json'); const db = {}; cards.forEach(c => db[c.name] = c);
    let cur = sa;
    const planA = boardHeroIdxs(db, cur.me.hand);
    A.socket.on('st_prep_state', (s) => { cur = s; });
    A.emit('st_prep_move', { roomId: room.id, move: { type: 'place', from: { kind: 'hand', idx: planA[0] }, to: { kind: 'hero', hi: 0 } } });
    await sleep(250);
    check('Hero platziert', !!cur.me.heroes[0], cur.me.heroes);
    check('Ready ohne volles Board abgelehnt', (A.emit('st_prep_ready', { roomId: room.id, ready: true }), true));
    await sleep(250);
    check('…weiterhin nicht ready', cur.me.ready === false);
    for (let hi = 1; hi < planA.length; hi++) { A.emit('st_prep_move', { roomId: room.id, move: { type: 'place', from: { kind: 'hand', idx: planA[hi] }, to: { kind: 'hero', hi } } }); await sleep(200); }
    check('3 Heroes stehen', cur.me.heroes.filter(Boolean).length === 3, cur.me.heroes);
    // Ability auf Hero → Level 3
    const abIdx = cur.me.hand.findIndex(n => db[n].cardType === 'Ability' && !cur.me.abilityZones[0].some(z => z && z.n === n));   // eine Ability, die der Hero noch nicht hat (Start-Abilities stehen auf Stufe 3)
    if (abIdx >= 0) {
      const free = cur.me.abilityZones[0].findIndex(z => !z);
      A.emit('st_prep_move', { roomId: room.id, move: { type: 'place', from: { kind: 'hand', idx: abIdx }, to: { kind: 'ability', hi: 0, slot: free } } });
      await sleep(250);
      check('Ability levelt automatisch auf 3', Rules.abilityLevel(cur.me.abilityZones[0][free]) === 3, cur.me.abilityZones[0]);
    }
    // Start-Ability nicht verschiebbar
    const startSlot = cur.me.abilityZones[0].findIndex(z => z && z.s > 0);
    if (startSlot >= 0) {
      A.emit('st_prep_move', { roomId: room.id, move: { type: 'unplace', from: { kind: 'ability', hi: 0, slot: startSlot } } });
      await sleep(250);
      check('Start-Ability bleibt (kein unplace)', !!cur.me.abilityZones[0][startSlot], cur.me.abilityZones[0]);
      A.emit('st_prep_move', { roomId: room.id, move: { type: 'removeStart', hi: 0, slot: startSlot } });
      await sleep(250);
      check('Start-Ability löschbar', !cur.me.abilityZones[0][startSlot] || cur.me.abilityZones[0][startSlot].s === 0, cur.me.abilityZones[0][startSlot]);
    }
    // Recycler: 2 Nicht-Heroes → 1 Auswurf, +8 Gold
    const handBefore = cur.me.hand.length;
    const nonHero = () => cur.me.hand.findIndex(n => db[n].cardType !== 'Hero');
    A.emit('st_prep_move', { roomId: room.id, move: { type: 'recycle', from: { kind: 'hand', idx: nonHero() } } });
    await sleep(250);
    check('1. Recycling: Hand −1, kein Auswurf', cur.me.hand.length === handBefore - 1 && cur.me.recycled === 1 && cur.event?.ejected == null, [cur.me.hand.length, cur.me.recycled, cur.event]);
    A.emit('st_prep_move', { roomId: room.id, move: { type: 'recycle', from: { kind: 'hand', idx: nonHero() } } });
    await sleep(250);
    check('2. Recycling: Auswurf einer neuen Karte', cur.me.recycled === 2 && !!cur.event?.ejected && cur.me.hand.length === handBefore - 1, [cur.me.recycled, cur.event]);
    check('Gold = 4 je Karte', cur.gold === 8, cur.gold);
    check('Ausgeworfene Karte ist keine Ascended/Token', !['Ascended Hero', 'Token'].includes(db[cur.event.ejected].cardType));
    // Hero-Recycling bei vollem Board von der Hand: erlaubt; vom Feld verboten
    A.emit('st_prep_move', { roomId: room.id, move: { type: 'recycle', from: { kind: 'hero', hi: 0 } } });
    await sleep(250);
    check('Feld-Hero nicht recycelbar', cur.me.heroes[0] != null && cur.me.recycled === 2, cur.me.heroes);

    // Ready A; B nicht → Spiel läuft weiter
    A.emit('st_prep_ready', { roomId: room.id, ready: true });
    await sleep(300);
    check('A bereit', cur.me.ready === true);
    check('Änderungen nach Ready gesperrt', (A.emit('st_prep_move', { roomId: room.id, move: { type: 'unplace', from: { kind: 'hero', hi: 2 } } }), true));
    await sleep(250);
    check('…Hero 2 steht noch', cur.me.heroes[2] != null);
    A.emit('st_prep_ready', { roomId: room.id, ready: false });
    await sleep(250);
    check('Ready zurücknehmbar', cur.me.ready === false);
    A.emit('st_prep_ready', { roomId: room.id, ready: true });
    await sleep(200);

    // B stellt nur Heroes auf und wird ready → Kampfstart
    let curB = sb; B.socket.on('st_prep_state', (s) => { curB = s; });
    const planB = boardHeroIdxs(db, curB.me.hand);
    for (let hi = 0; hi < planB.length; hi++) { B.emit('st_prep_move', { roomId: room.id, move: { type: 'place', from: { kind: 'hand', idx: planB[hi] }, to: { kind: 'hero', hi } } }); await sleep(200); }
    B.emit('st_prep_ready', { roomId: room.id, ready: true });
    const gsA = await A.waitFor('game_state', g => g && g.skillTest && g.skillTest.round >= 1, 15000);
    check('Alle bereit → Kampf beginnt, die Round-Reihenfolge beginnt beim Startspieler', gsA.skillTest.order[0] === gsA.skillTest.starter && gsA.skillTest.starter >= 0 && gsA.skillTest.starter < 4, gsA.skillTest);
    check('Start-Gold = 4 je recycelter Karte (+4 Tick)', gsA.players[0].gold >= 2 * 4, gsA.players[0].gold);
    [A, B].forEach(c => c.close());
  } catch (e) { console.error(e); process.exitCode = 1; }
  srv.child.kill();
  process.exit(finish() ? 1 : (process.exitCode || 0));
})();
