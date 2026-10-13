'use strict';
// C01-creatures-12 · 3-Headed Giant: ein von Spearman NEGIERTER Aktivierungsversuch sperrt alle drei Nutzungen des Zuges
// Kartentext 3-Headed Giant: „You may up to 3 times per turn choose a target and deal 80 damage to it."
// Kartentext Spearman: „Once per turn, when your opponent activates one of their Creatures' active effects, you may negate that effect and deal 50 damage to that Creature instead."
// Aufbau: Seed 1234. Sitz 0: 3-Headed Giant (alt). Sitz 1: Spearman (alt). Main Phase 1, Zielwahl = Gegner-Held 1. Spearman bestätigt (Ja).
// Erwartung: Die erste Aktivierung wird negiert (zählt als EINE der drei Nutzungen). Der Spearman ist verbraucht; Aktivierung 2 und 3 laufen normal (je 80 Schaden), Aktivierung 4 wird abgelehnt.
// Beobachtet: Aktivierung 1 negiert (Giant nimmt 50), Aktivierung 2-4 werden abgelehnt (`false`): die Engine stempelt bei Negation die Rundensperre `gs.hoptUsed['creature-effect:<id>']`
//   (server.js doActivateCreatureEffect, „Negation path"), der Verbrauchszähler des Giant (`_ptuthreeHeadedGiantUsed`) bleibt dabei unverändert.
// Ursache: server.js ~Z. 9235-9255: `gs.hoptUsed[hoptKey] = gs.turn` ohne `ctx._skipCreatureEffectHopt`-Logik; das Skript hat bei Negation keinen Einfluss auf die Sperre.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({});
  const gs = t.gs;
  const g = t.put(0, 0, 0, '3-Headed Giant'); g.turnPlayed = 1;
  t.put(1, 0, 0, 'Spearman').turnPlayed = 1;
  t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 1).id];
  t.script.push({ match: d => d.type === 'confirm' && /Spearman/.test(JSON.stringify(d)), answer: () => ({ confirmed: true }), once: true });
  gs.currentPhase = 2;
  const res = [];
  for (let i = 0; i < 4; i++) {
    const h0 = t.hp(1, 1);
    const r = await t.activateCreature(0, 0, 0);
    res.push({ r, dmg: h0 - t.hp(1, 1) });
  }
  R.note('Aktivierungen 1-4', res);
  R.check('Aktivierung 1 wurde negiert (kein Schaden)', res[0].dmg === 0, res[0]);
  R.check('Aktivierung 2 läuft (80 Schaden)', res[1].r === true && res[1].dmg === 80, res[1]);
  R.check('Aktivierung 3 läuft (80 Schaden)', res[2].r === true && res[2].dmg === 80, res[2]);
  R.check('Aktivierung 4 wird abgelehnt', res[3].r === false, res[3]);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
