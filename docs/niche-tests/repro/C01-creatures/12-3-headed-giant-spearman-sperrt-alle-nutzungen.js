'use strict';
// C01-creatures-12 · 3-Headed Giant: ein von Spearman GANZ NEGIERTER Aktivierungsversuch verbraucht KEINE der drei Nutzungen (Als Entscheidung, Welle 3)
// Kartentext 3-Headed Giant: „You may up to 3 times per turn choose a target and deal 80 damage to it."
// Kartentext Spearman: „Once per turn, when your opponent activates one of their Creatures' active effects, you may negate that effect and deal 50 damage to that Creature instead."
// REGEL (CARD_API.md „★ Z7b"): die komplette Aktivierung wurde negiert und hat nie aufgelöst → weder die Rundensperre noch eine der drei Nutzungen ist verbraucht.
// Aufbau: Seed 1234. Sitz 0: 3-Headed Giant (alt). Sitz 1: Spearman (alt). Main Phase 1, Zielwahl = Gegner-Held 1. Spearman bestätigt (Ja, nur einmal).
// Erwartung: Aktivierung 1 wird negiert (Giant nimmt 50, Gegner-Held unverletzt); Aktivierungen 2, 3 und 4 laufen (je 80 Schaden = die drei Nutzungen), Aktivierung 5 wird abgelehnt.
// Exit 1 (Fehler tritt auf) = die negierte Aktivierung hat Nutzungen/Rundensperre verbraucht.
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
  for (let i = 0; i < 5; i++) {
    const h0 = t.hp(1, 1);
    const r = await t.activateCreature(0, 0, 0);
    res.push({ r, dmg: h0 - t.hp(1, 1) });
  }
  R.note('Aktivierungen 1-4', res);
  R.check('Aktivierung 1 wurde negiert (kein Schaden)', res[0].dmg === 0, res[0]);
  R.check('Aktivierung 2 läuft (80 Schaden)', res[1].r === true && res[1].dmg === 80, res[1]);
  R.check('Aktivierung 3 läuft (80 Schaden)', res[2].r === true && res[2].dmg === 80, res[2]);
  R.check('Aktivierung 4 läuft (80 Schaden): die negierte hat keine Nutzung verbraucht', res[3].r === true && res[3].dmg === 80, res[3]);
  R.check('Aktivierung 5 wird abgelehnt (drei echte Nutzungen verbraucht)', res[4].r === false, res[4]);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
