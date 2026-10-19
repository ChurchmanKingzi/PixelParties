'use strict';
// A01-pollution-09 · Warrior of Teocuilatl schützt nicht vor Statuseffekten (Freeze, Stun, Negation)
// Kartentext: „Whenever a Creature either player controls would be affected by a card or effect, you may remove 1 Doom Counter from a „Doom Clock“
//   to negate all effects that card or effect would have on that Creature.“
// Erwartung: Cold Coffin (Freeze), Medusa's Curse (Stun) und Null Zone (Negation) auf eine Creature, während der Warrior auf dem Brett liegt und die
//   Uhr Counter hat, öffnen das Angebot „Remove 1 Doom Counter to negate all effects?“; bei „Ja“ bleibt die Creature unberührt, 1 Counter weg.
// Beobachtet: kein Angebot, die Creature wird gefroren/betäubt/negiert, die Uhr behält alle Counter. Dagegen reagiert der Warrior auf Goldify (Zerstörung),
//   Sun Beam, Eraser Beam und Basketskull (Schaden) wie vorgesehen. `beforeCreatureAffected` wird nur von Heilung, Gift, Zerstörung und Bewegung ausgelöst
//   (cards/effects/_engine.js:10139, 10845, 12368, 13419), nicht von `applyCreatureStatus` / `actionNegateCreature`.
// Ursache: Engine – `applyCreatureStatus` / `actionNegateCreature` laufen ohne `beforeCreatureAffected`-Fenster (gilt auch für Cool Rescuer Monia).
// Aufruf: node docs/niche-tests/repro/A01-pollution/09-warrior-teocuilatl-schuetzt-nicht-vor-status.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const tgt = (v) => [v.find(x => x.type === 'equip' && x.owner === 1 && x.heroIdx === 0 && x.slotIdx === 0).id];
(async () => {
  const R = H.runner();
  for (const [spell, wirkt] of [['Cold Coffin', (ba) => ba.counters.frozen], ["Medusa's Curse", (ba) => ba.counters.stunned], ['Null Zone', (ba) => ba.counters.nulled], ['Goldify', (ba) => false]]) {
    R.section(spell + (spell === 'Goldify' ? ' (Gegenprobe: Zerstörung wird vom Warrior abgefragt)' : ''));
    const t = await H.fresh({ hand: [[spell], []] });
    const uhr = t.putArea(0, 'Doom Clock'); uhr.counters.doom = 5;
    t.put(1, 0, 0, 'Soul Shard Ba');
    t.put(1, 0, 1, 'Warrior of Teocuilatl');
    t.targetFn = tgt;
    t.policy.confirm = true;                                   // der Warrior-Besitzer sagt überall „Ja“
    t.script.push({ match: d => d && d.type === 'optionPicker' && d.title === 'Warrior of Teocuilatl', answer: () => ({ optionId: '0' }) });
    await t.play(0, spell, { hero: 0 });
    const ba = t.find('Soul Shard Ba', 'support');
    R.check('Warrior bot das Negieren an', t.prompts.some(p => p.d.title === 'Warrior of Teocuilatl'), t.prompts.map(p => p.d.title));
    R.check('Ba unberührt (kein Freeze/Stun/Null) und lebt', !!ba && !wirkt(ba), ba && ba.counters);
    // ★ W16b: Medusa's Curse und Null Zone treffen ALLE Kreaturen — also auch den Warrior selbst; jede betroffene Kreatur öffnet ihr eigenes Fenster
    //   („Ja" überall) → ein Counter je Kreatur (Ba + Warrior = 2). Cold Coffin / Goldify treffen nur Ba (1).
    const erwartet = (spell === "Medusa's Curse" || spell === 'Null Zone') ? 2 : 1;
    R.check(`${erwartet} Counter von der Uhr entfernt (5 → ${5 - erwartet}), je betroffener Kreatur einer`, uhr.counters.doom === 5 - erwartet, uhr.counters.doom);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
