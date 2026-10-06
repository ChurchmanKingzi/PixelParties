'use strict';
const { startServer, guestClient, check, sleep, finish } = require('./lib');
(async () => {
  const srv = await startServer();
  try {
    const A = await guestClient('A');
    const B = await guestClient('B');
    console.log('Lobby');
    A.emit('create_room', { type: 'ranked', format: 3, skillTest: { prepTimerSec: 120, turnTimerDisabled: true } });
    const room = await A.waitFor('room_joined');
    check('Raum hat skillTest-Konfig', room.skillTest && room.skillTest.phase === 'lobby', room.skillTest);
    check('Timer-Konfig übernommen', room.skillTest.prepTimerSec === 120 && room.skillTest.turnTimerDisabled === true, room.skillTest);
    check('maxPlayers 8', room.maxPlayers === 8, room.maxPlayers);
    check('Typ immer unranked', room.type === 'unranked', room.type);
    check('8 Sitze, Host auf Sitz 0', room.seats?.length === 8 && room.seats[0]?.isHost, room.seats);

    B.emit('join_room', { roomId: room.id, password: '', asSpectator: false, deckId: null });
    const afterB = await B.waitFor('room_joined');
    check('B sitzt ohne Deck', afterB.players.includes(B.user.username), afterB.players);

    A.emit('st_add_cpu', { roomId: room.id });
    A.emit('st_add_cpu', { roomId: room.id });
    A.emit('st_add_cpu', { roomId: room.id });
    await sleep(400);
    const upd = A.last('room_update');
    const cpus = upd.seats.filter(s => s && s.isBot);
    check('3 CPU-Sitze mit Hero-Persona', cpus.length === 3 && cpus.every(c => c.persona?.hero), upd.seats);
    check('Persona-Namen unterschiedlich', new Set(cpus.map(c => c.username)).size === 3);

    B.emit('st_add_cpu', { roomId: room.id });
    await sleep(200);
    check('Nicht-Host kann keine CPU hinzufügen', A.last('room_update').seats.filter(s => s?.isBot).length === 3);

    A.emit('st_remove_cpu', { roomId: room.id, username: cpus[0].username });
    await sleep(300);
    check('CPU entfernbar', A.last('room_update').seats.filter(s => s?.isBot).length === 2);

    A.emit('get_rooms');
    const list = await A.waitFor('rooms', l => l.some(r => r.id === room.id));
    const entry = list.find(r => r.id === room.id);
    check('Raumliste zeigt skillTest + 4/8', entry.skillTest && entry.playerCount === 4 && entry.maxPlayers === 8, entry);

    B.emit('start_game', { roomId: room.id });
    await sleep(300);
    check('start_game wird für Skill Test ignoriert', A.last('room_update')?.skillTest?.phase === 'lobby');

    A.emit('st_start', { roomId: room.id });
    await sleep(600);
    const started = A.last('room_update');
    check('st_start → Phase prep, status playing', started.skillTest.phase === 'prep' && started.status === 'playing', started);

    const C = await guestClient('C');
    C.emit('join_room', { roomId: room.id, password: '', asSpectator: false, deckId: null });
    const joinedC = await C.waitFor('room_joined');
    check('Späte Beitritte werden Zuschauer', joinedC.spectators.includes(C.user.username) && !joinedC.players.includes(C.user.username), joinedC);
    [A, B, C].forEach(c => c.close());
  } catch (e) { console.error(e); process.exitCode = 1; }
  srv.child.kill();
  process.exit(finish() ? 1 : (process.exitCode || 0));
})();
