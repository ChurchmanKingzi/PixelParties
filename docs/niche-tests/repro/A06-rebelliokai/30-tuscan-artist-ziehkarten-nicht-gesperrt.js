'use strict';
// A06-rebelliokai-30 · Pawn Sacrifice / Rebelliokai Timid Tanuki unter Tuscan Artist: nicht ausgegraut, Opfer/Einmal-Nutzung gehen verloren
// Kartentext Tuscan Artist: „While you control this Creature, any effect that would allow your opponent to draw 2 or 3 cards is negated."
// Ruling 16.8. (Kopf von cards/effects/_draw-block-shared.js, „verbindlich"): Ist der Zug der einzige Nutzen (auch mit Kosten), ist die Karte bzw. der
//   aktive Effekt GESPERRT und wird ausgegraut; „Ein Effekt, der so nicht feuern kann, verbraucht auch sein Once-per-turn NICHT."
// Pawn Sacrifice: „Sacrifice a "Pawn of Kings" to draw 3 cards OR delete a "Pawn of Kings" from your discard pile to draw 2 cards." (immer 2 oder 3 → immer negiert)
// Timid Tanuki: „You may once per turn draw as many cards as there are "Rebelliokai" Creatures with different names in your discard pile (max 3)."
// Beobachtung: `pawn-sacrifice.js` `spellPlayCondition` und `rebelliokai-timid-tanuki.js` `canActivateCreatureEffect` fragen `drawWouldBeBlocked` nicht;
//   `pawn-sacrifice.js:139` prüft es erst NACH dem Opfer (Pawn weg, nichts gezogen, Zug-Stempel gesetzt), der Tanuki zieht 0 und ist für den Zug verbraucht.
// Erwartung: beides ist unter Tuscan Artist nicht spielbar/aktivierbar, nichts wird geopfert, kein Stempel.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const K = 'Rebelliokai ';
  let t, r;
  // ── Pawn Sacrifice ──
  t = await H.fresh({ hand: [['Pawn Sacrifice'], []] });
  t.put(0, 0, 0, 'Pawn of Kings [W]').turnPlayed = t.gs.turn - 1;
  t.put(0, 0, 1, 'Knight of Kings [W]');
  t.put(1, 0, 0, 'Tuscan Artist');
  r = await t.play(0, 'Pawn Sacrifice', { hero: 0 });
  R.check('Pawn Sacrifice unter Tuscan Artist: nicht spielbar (Pawn bleibt, Karte bleibt auf der Hand)',
    r === false && t.zone(0, 0, 0) === 'Pawn of Kings [W]' && t.pile(0, 'hand').includes('Pawn Sacrifice'),
    { r, board: [t.zone(0, 0, 0), t.zone(0, 0, 1)], hand: t.pile(0, 'hand'), disc: t.pile(0, 'discardPile'), hopt: t.gs.hoptUsed });
  // ── Timid Tanuki ──
  t = await H.fresh({ discard: [[K + 'Kind Kitsune', K + 'Backup Bakus', K + 'Camouflaged Kappa'], []] });
  t.put(0, 0, 0, K + 'Timid Tanuki').turnPlayed = t.gs.turn - 1;
  t.put(1, 0, 0, 'Tuscan Artist');
  t.gs.currentPhase = 2; t.resetActions(0);
  const h0 = t.pile(0, 'hand').length;
  r = await t.activateCreature(0, 0, 0);
  const hoptTanuki = Object.keys(t.gs.hoptUsed || {}).filter(k => /creature-effect/.test(k));
  R.check('Timid Tanuki unter Tuscan Artist (Ziehen von 3 negiert): nicht aktivierbar, Einmal-Nutzung nicht verbraucht',
    r === false && hoptTanuki.length === 0,
    { r, drew: t.pile(0, 'hand').length - h0, hoptTanuki });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
