'use strict';
// N4-archetypen-01 · Spider Silk Bridge: die OFFEN liegende Bridge löst bei jedem weiteren schadenlosen Gegnerzug erneut aus (Ziehen 2)
// Kartentext: „Activate this Surprise when your opponent ends their turn without dealing damage to any target you control that turn. Draw 2 cards. Additionally, this card
//   remains face-up in the user's Surprise Zone until your opponent deals damage to a target you control. If this card is face-up in your Hero's Surprise Zone at the beginning
//   of your turn, draw 1 card."
// Ruling/Konvention (_engine.js:37158, 12.10. Glass Wall): „eine OFFEN liegende Surprise wurde schon ausgelöst – sie ist kein Kandidat dieses Fensters mehr".
// Erwartung: Aktivierung genau einmal (Ziehen 2, danach offen); in den folgenden schadenlosen Gegnerzügen nur noch das Ziehen von 1 zu Beginn des eigenen Zuges.
// Beobachtet: `_checkSurpriseOnTurnEnd` bietet die offene Bridge erneut an (kein Offen-Filter): nach JEDEM schadenlosen Gegnerzug wieder Ziehen 2 (+1 Zugbeginn) = 3 Karten pro Runde.
// Gegenprobe: erste Aktivierung zieht genau 2 (✓), das Zugbeginn-Ziehen läuft (✓).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['ZZ Filler'], ['ZZ Filler']], deckSize: 30, active: 1 });
  t.gs.activePlayer = 1;
  t.setAbilities(0, 0, [['Support Magic'], [], []]);
  t.putSurprise(0, 0, 'Spider Silk Bridge');
  t.put(0, 1, 0, H.INERT.big); t.put(1, 0, 0, H.INERT.big);
  const aktivierungen = [];
  for (let i = 0; i < 4; i++) {
    t.reset();
    await t.endTurn();                         // i gerade: Gegner (Sitz 1) beendet seinen Zug; i ungerade: Sitz 0 beendet seinen
    if (i % 2 === 0) aktivierungen.push(t.logs.filter(l => l.type === 'spider_silk_bridge_draw' && l.data.phase === 'activation').length);
  }
  R.check('Kontrolle: erster schadenloser Gegnerzug aktiviert die Bridge genau einmal', aktivierungen[0] === 1, aktivierungen);
  R.check('Bridge bleibt offen liegen', t.inst(c => c.name === 'Spider Silk Bridge' && c.faceDown === false).length === 1);
  R.check('zweiter schadenloser Gegnerzug: keine erneute Aktivierung (Ziehen 2) einer bereits offenen Bridge', aktivierungen[1] === 0, aktivierungen);
  R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  R.finish();
})();
