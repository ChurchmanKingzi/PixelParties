'use strict';
// Platzhalter — Rounds/Turns folgen in M5. Hier landet die Vorbereitung,
// sobald alle bereit sind.
const { CONFIG } = require('./config');

/** Startspieler: wer die meisten Karten recycelt hat; bei Gleichstand der Zufall. */
function pickStarter(prep) {
  const best = Math.max(...prep.players.map(p => p.recycled));
  const cands = prep.players.map((p, i) => ({ p, i })).filter(x => x.p.recycled === best).map(x => x.i);
  return cands[Math.floor(Math.random() * cands.length)];
}

async function start(room, host, prep) {
  const starter = pickStarter(prep);
  room.skillTest.phase = 'battle';
  room.skillTest.starter = starter;
  console.log(`[skilltest] Raum ${room.id}: Kampf beginnt, Startspieler ${room.players[starter].username} (recycelt: ${prep.players.map(p => p.recycled).join('/')}) — M5 fehlt noch`);
  host.io.to('room:' + room.id).emit('room_update', host.sanitizeRoom(room));
  host.io.to('room:' + room.id).emit('st_battle_pending', { starter, recycled: prep.players.map(p => p.recycled), gold: prep.players.map(p => p.recycled * CONFIG.RECYCLE_GOLD) });
}

module.exports = { start, pickStarter };
