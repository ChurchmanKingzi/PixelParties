'use strict';
// W63d-08 · Verdeckte Information bleibt verdeckt: verdeckt gelegte Surprise auf der Leitung, Vorschau der Zusatzaktions-Wahl (Al, 22.10.2026)
//
// Regel (CARD_API „Auftritt streamen — erst nach dem Commit"): was der Gegner (noch) nicht sehen darf, darf auch nicht auf der LEITUNG zu seinem Client stehen — der Client blendet vieles nur aus.
//   • Eine verdeckt gelegte Surprise flog mit `hand_to_board_fly` { cardName, faceDown: true } zum Gegner: der Client zeichnete eine Rückseite, aber der Kartenname war im Ereignis. Jetzt fehlt er.
//   • Die Vorschau „diese Creature soll hierhin" (`pending_placement` → `opponent_pending_placement` mit `cardName`) zeigte dem Gegner die Geisterkarte, während der Spieler noch den Zusatzaktions-Geber wählt
//     (abbrechbar). Der Server leitet sie nicht mehr weiter (statische Prüfung des Handlers).
// Exit 0 = korrekt.
const fs = require('fs'), path = require('path');
const W = require('../../lib/wire.js');
(async () => {
  const R = W.runner();
  R.section('Surprise verdeckt legen: kein Kartenname zum Gegner/Zuschauer');
  const SURPRISE = Object.values(W.DB).find(c => c.cardType === 'Spell' && (c.subtype || '') === 'Surprise' && W.loadCardEffect(c.name));
  R.check('eine Surprise-Karte ist da', !!SURPRISE);
  for (const seat of [0, 1]) {
    const t = await W.reicheSzene({ seat, karten: [SURPRISE.name] });
    const r = await W.spiele(t, seat, SURPRISE.name, { hero: 0 });
    const fremd = r.tl.filter(e => e.k === 'wire' && e.sid !== 'S' + seat);
    const fly = fremd.filter(e => e.ev === 'hand_to_board_fly');
    R.check(`Sitz ${seat}: die Surprise liegt verdeckt`, t.gs.players[seat].surpriseZones.some(z => (z || []).includes(SURPRISE.name)), t.gs.players[seat].surpriseZones);
    R.check(`Sitz ${seat}: der Flug ging an Gegner und Zuschauer`, fly.some(e => e.sid === 'SPEC') && fly.some(e => e.sid !== 'SPEC'), fly.length);
    R.check(`Sitz ${seat}: … ohne Kartenname (faceDown)`, fly.every(e => e.data && e.data.faceDown === true && e.data.cardName === undefined), fly.map(e => e.data));
    R.check(`Sitz ${seat}: kein Ereignis an Gegner/Zuschauer nennt die verdeckte Karte`, !fremd.some(e => e.ev !== 'game_state' && e.ev !== 'spectator_state' && JSON.stringify(e.data).includes(SURPRISE.name)), fremd.filter(e => JSON.stringify(e.data).includes(SURPRISE.name)).map(e => e.ev));
    R.check(`Sitz ${seat}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.section('Geisterkarte der Zusatzaktions-Wahl: der Server leitet `pending_placement` nicht mehr weiter');
  {
    const src = fs.readFileSync(path.resolve(__dirname, '../../../../server.js'), 'utf8');
    const i = src.indexOf("socket.on('pending_placement',");
    const j = src.indexOf("socket.on('pending_placement_clear'", i);
    const rumpf = src.slice(i, j);
    R.check('Handler `pending_placement` gefunden', i > 0 && j > i);
    R.check('… sendet nichts an den Gegner (kein emitToOpponentsGs, kein io.to, kein sendToSpectators)', !/emitToOpponentsGs|io\.to\(|sendToSpectators|opponent_pending_placement/.test(rumpf.replace(/\/\/[^\n]*/g, '')), rumpf.slice(0, 200));
  }
  R.finish();
})();
