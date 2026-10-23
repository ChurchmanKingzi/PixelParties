'use strict';
// NK2-03b · See through the Ruse: Zustandsversand (Leitungs-Harness `wire.js`, Socket-Aufzeichnung)
// Der Wirker sieht eine aufgedeckte Gegner-Surprise mit Namen und der Markierung „bekannt" (`surpriseKnown`, halbtransparent wie nach dem Neusetzen), die Karte bleibt verdeckt
// (`surpriseFaceDown`). Vorher zeigt der Zustand `'?'`. Der Besitzer sieht seine Karte ohnehin, die Markierung gilt ihm gegenüber ebenfalls.
const W = require('../../lib/wire.js');
(async () => {
  const R = W.H ? W.H.runner() : require('../../lib/h.js').runner();
  const RUSE = 'See through the Ruse', FLOOD = 'Flooding';
  const t = await W.fresh({ hand: [[RUSE], []], deck: [Array(10).fill('ZZ Dummy'), Array(10).fill('ZZ Dummy')], gold: 100, scanState: true });
  t.setAbilities(0, 0, [['Decay Magic', 'Decay Magic'], [], []]);
  t.grantFor(1, 0, FLOOD); t.putSurprise(1, 0, FLOOD);
  const letzter = (sid, ev = 'game_state') => { for (let i = t.tl.length - 1; i >= 0; i--) { const e = t.tl[i]; if (e.k === 'wire' && e.sid === sid && e.ev === ev && e.json) return JSON.parse(e.json); } return null; };
  const sende = () => { t.host.sendGameStateErzwungen(t.room, 0); t.host.sendGameStateErzwungen(t.room, 1); };
  const gegner = (st) => st && st.players && st.players[1];
  sende();
  let s0 = gegner(letzter('S0'));
  R.check('vorher: der Wirker sieht „?" in der Surprise Zone des Gegners, unbekannt', s0 && s0.surpriseZones[0][0] === '?' && s0.surpriseKnown[0] === false, s0 && { sz: s0.surpriseZones, k: s0.surpriseKnown });
  await t.play(0, RUSE, { hero: 0, phase: 'MAIN1' });
  sende();
  s0 = gegner(letzter('S0')); const s1 = gegner(letzter('S1'));
  R.check('nachher: der Wirker sieht den Namen, „bekannt" gesetzt, Karte weiter verdeckt', s0 && s0.surpriseZones[0][0] === FLOOD && s0.surpriseKnown[0] === true && s0.surpriseFaceDown[0] === true, s0 && { sz: s0.surpriseZones, k: s0.surpriseKnown, fd: s0.surpriseFaceDown });
  R.check('der Besitzer sieht seine Karte wie zuvor (Name), verdeckt', s1 && s1.surpriseZones[0][0] === FLOOD && s1.surpriseFaceDown[0] === true, s1 && { sz: s1.surpriseZones, fd: s1.surpriseFaceDown });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
