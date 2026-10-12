'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  H03-heroes-05 · Omikrons Illusion löst keine „Creature placed"-Trigger aus (Nero Zira, Maya, Pes'zet, Madame Guillotine …)
//
//  Karten: Omikron, the Faceless Illusionist (`cards/effects/omikron-the-faceless-illusionist.js`, „Hooks are intentionally SKIPPED"),
//          Nero Zira, the Mastermind (Trigger); Vergleich: Create Illusion / Staff of Illusions feuern `onCardEnterZone`.
//  Kartentext Omikron: „You may once per turn place a copy of any Creature into one of this Hero's free Support Zones, but its effects
//  are negated until the start of your next turn and its current and max HP become 1."
//  Kartentext Nero: „Up to 5 times per turn, when a Creature is placed into one of your Heroes' Support Zones, permanently increase
//  this Hero's Attack by 30."  (gleich: Maya +50 HP, Pes'zet Poison; Madame Guillotine „places a Creature")
//  Erwartung: Das Platzieren ist ein Ereignis für fremde Beobachter; negiert werden nur die EIGENEN Effekte der Illusion. Nero (+30 ATK)
//  und Maya (Zielwahl +50 HP) lösen aus – so wie bei Create Illusion/Staff of Illusions (deren Kommentar: „Fire enter-zone hooks (Ingo, Maya, …)").
//  Beobachtung (✗): Omikron ruft nach dem Platzieren kein `onCardEnterZone` auf (Zeile ~190: „No runHooks('onCardEnterZone') call here"),
//  weder Nero noch Maya reagieren.
//  Aufruf: node docs/niche-tests/repro/H03-heroes/05-omikron-platzierung-ohne-ausloeser.js   (✗ = Fehler tritt auf)
// ═══════════════════════════════════════════════════════════════════════════
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ heroes: [['Nero Zira, the Mastermind', 'Omikron, the Faceless Illusionist', 'Maya, the Nature Fairy'], null], hp: 400 });
  t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Skeleton Healer' }) });
  t.targetFn = (valid) => [valid[0].id];
  const atk0 = t.hero(0, 0).atk;
  const r = await t.activateHero(0, 1, { effect: 'Omikron, the Faceless Illusionist' });
  R.note('Omikron aktiviert', { r, illusion: t.zone(0, 1, 0), nero: [atk0, t.hero(0, 0).atk], zielwahlen: t.targets.length });
  R.check('Illusion liegt auf dem Brett (Aufbau stimmt)', t.zone(0, 1, 0) === 'Skeleton Healer', t.zone(0, 1, 0));
  R.check('Nero Zira: +30 ATK für das platzierte Creature', t.hero(0, 0).atk === atk0 + 30, [atk0, t.hero(0, 0).atk]);
  R.check('Maya: Zielwahl „+50 HP" wird angeboten', t.targets.length > 0, t.targets.length);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
