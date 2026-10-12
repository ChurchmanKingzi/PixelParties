'use strict';
// A04-cute-08 · Wildur: Umleitung der ersten Ablage-Karte funktioniert nach "Guard Duty" nicht mehr
//
// Kartentext (Wildur): "The first card that would be sent to your discard pile every turn while you control this Creature is placed
//   on top of your Coolness Stack instead."
// Erwartung: Auch nach einem Guard Duty (mischt die Ablage ins Deck zurück) wird weiter die erste Ablage-Karte jedes Zuges umgeleitet.
// Beobachtet: Guard Duty selbst landet in der Ablage (statt auf dem Stack), und alle späteren Karten gehen ebenfalls in die Ablage.
// Ursache: cards/effects/wildur-the-shining-coolness.js `_installRedirect` überschreibt `ps.discardPile.push` auf der AKTUELLEN
//   Array-Instanz und merkt sich nur ein Flag (`_wildurRedirectInstalled`). cards/effects/guard-duty.js (Z. 52 und 77) ersetzt
//   `ps.discardPile = []` durch ein neues Array → der Override ist weg, das Flag verhindert die Neuinstallation (auch in onTurnStart).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const WI = 'Wildur, the Shining Coolness';
  // Gegenprobe: ohne Guard Duty lenkt Wildur den ersten Ablage-Kandidaten (hier: der gespielte Zauber) um.
  {
    const c = await H.fresh({ deck: [[H.INERT.creature, H.INERT.creature], []], hand: [['Fireball'], []] });
    c.putArea(0, 'Wowhalla, the Hall of the Cool');
    const cp = c.gs.players[0]; cp.coolnessStack.push('Cute Bunny'); c.engine._trackCard('Cute Bunny', 0, 'coolnessStack');
    const cw = c.put(0, 0, 0, WI); cw.turnPlayed = 0;
    await c.turnStart(0);
    c.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    await c.play(0, 'Fireball', { hero: 0 });
    R.check('Gegenprobe (ohne Guard Duty): der gespielte Zauber landet auf dem Stack statt in der Ablage', cp.coolnessStack[cp.coolnessStack.length - 1] === 'Fireball', { stack: cp.coolnessStack.slice(), ablage: cp.discardPile.slice() });
  }
  const t = await H.fresh({ deck: [[H.INERT.creature, H.INERT.creature, H.INERT.creature], []], hand: [['Guard Duty', H.INERT.filler], []], discard: [[H.INERT.creature, H.INERT.creature], []] });
  t.putArea(0, 'Wowhalla, the Hall of the Cool');
  const ps = t.gs.players[0];
  ps.coolnessStack.push('Cute Bunny'); t.engine._trackCard('Cute Bunny', 0, 'coolnessStack');
  const w = t.put(0, 0, 0, WI); w.turnPlayed = 0;
  t.put(0, 0, 1, H.INERT.frail);
  await t.turnStart(0);   // Wildur installiert seine Umleitung (wie am Zugbeginn)
  const r = await t.play(0, 'Guard Duty', { hero: 0 });
  R.check('Guard Duty gespielt', r === true, r);
  R.check('Guard Duty (erste Karte, die in die Ablage ginge) liegt stattdessen auf dem Coolness Stack', ps.coolnessStack[ps.coolnessStack.length - 1] === 'Guard Duty', { stack: ps.coolnessStack.slice(), ablage: ps.discardPile.slice() });
  // zweiter Test: später im selben Spiel (neuer Zug) wird die erste Ablage-Karte weiterhin umgeleitet
  ps._wildurDiscardRedirectedThisTurn = false;   // Zugbeginn-Reset (onTurnStart setzt das Flag zurück)
  const f = t.find(H.INERT.frail, 'support');
  await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: 1 }, f));
  R.check('auch danach lenkt Wildur die erste Ablage-Karte des Zuges auf den Stack', ps.coolnessStack[ps.coolnessStack.length - 1] === H.INERT.frail, { stack: ps.coolnessStack.slice(), ablage: ps.discardPile.slice() });
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
