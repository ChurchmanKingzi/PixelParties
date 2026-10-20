'use strict';
// N3-09 · Gangster Angel: „deal 10 damage to all targets your opponent controls" überspringt Kreaturen, die „cannot be chosen" sind (Thicket)
// Kartentext: „You may once per turn deal 10 damage to all targets your opponent controls."
// Ruling (Kopfkommentar thicket.js, CARD_API „Thicket"): „Flächen-Effekte, die gar nicht WÄHLEN, sondern über jedes legale Ziel fahren (Heat Wave, Cataclysm), bleiben unberührt" –
//   der Schutz „cannot be chosen" gilt nur für Wahl-Effekte. Spirit of the Barbarian Sword (gleicher Wortlaut „all targets your opponent controls") und Embodiment of Biseria (Frost auf alle)
//   treffen eine so geschützte Kreatur ebenfalls (Gegenprobe unten).
// Aufbau: Sitz 1 hat zwei Dummies (A, B) und spielt Thicket auf B (echter Spielweg, Zugwechsel). Sitz 0 aktiviert Gangster Angel.
// Erwartet: A und B verlieren je 10 HP, alle drei Helden von Sitz 1 ebenfalls.   Beobachtet: B bleibt unversehrt (die Liste kommt aus `engine.getCreatureTargets`, das `untargetable_all` ausfiltert).
// Ursache: cards/effects/gangster-angel.js `onCreatureEffect` (Z. 96 und 105: `engine.getCreatureTargets(oi)`), _engine.js `getCreatureTargets` Z. ~43027 `if (inst?.counters?.untargetable_all) continue;`.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  async function aufbau() {
    const t = await H.fresh({ hand: [[], ['Thicket']], gold: [100, 100], active: 1 });
    t.put(0, 0, 0, 'Gangster Angel').turnPlayed = 1;
    const a = t.put(1, 0, 0, H.INERT.big); a.turnPlayed = 1;
    const b = t.put(1, 1, 0, H.INERT.big); b.turnPlayed = 1;
    t.targetFn = (valid) => [valid.find(v => v.cardName === H.INERT.big && v.heroIdx === 1).id];
    const r = await t.play(1, 'Thicket', { hero: 0 });
    return { t, a, b, r };
  }
  const { t, a, b, r } = await aufbau();
  R.check('Aufbau: Thicket auf B gespielt (B ist unwählbar markiert)', r === true && !!b.counters.untargetable_all, { r, counters: Object.keys(b.counters) });
  await t.endTurn();                                                // Sitz 0 ist am Zug
  t.phase(2); t.resetActions(0); t.reset();
  const hp = (i) => t.engine.creatureCurrentHp(i);
  const heldenVor = t.gs.players[1].heroes.map(h => h.hp);
  const rr = await t.activateCreature(0, 0, 0);
  R.check('Gangster Angel aktivierbar', rr === true, rr);
  R.check('Kreatur A (normal) verliert 10 HP', hp(a) === 990, hp(a));
  R.check('alle Helden von Sitz 1 verlieren 10 HP', t.gs.players[1].heroes.every((h, i) => h.hp === heldenVor[i] - 10), t.gs.players[1].heroes.map(h => h.hp));
  R.check('Kreatur B (Thicket) verliert 10 HP – Flächeneffekt wählt nicht', hp(b) === 990, hp(b));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  // Gegenprobe: Biseria-Frost („Freeze all Creatures your opponent controls") trifft eine ebenso markierte Kreatur
  {
    const u = await H.fresh({});
    const bis = u.put(0, 0, 0, 'Embodiment of Biseria'); bis.turnPlayed = 1;
    const y = u.put(1, 1, 0, H.INERT.big); y.counters.untargetable_all = 1;
    u.script.push({ match: d => d.type === 'optionPicker' && d.title === 'Embodiment of Biseria', answer: () => ({ optionId: 'freeze' }) });
    u.gs.activePlayer = 0; u.phase(2); u.resetActions(0);
    await u.activateCreature(0, 0, 0);
    R.check('Gegenprobe: Biseria-Frost trifft die „cannot be chosen"-Kreatur', !!y.counters.frozen, Object.keys(y.counters));
  }
  R.finish();
})();
