'use strict';
// H01-heroes-16 · Devlin: Abwurf trifft bei einem übernommenen Helden-Ziel den Besitzer der Spalte statt den Kontrolleur
//
// Kartentext: „… When this Hero hits 1 or more Bleeding targets with an Attack, **those targets' controller** must discard 2 cards from their hand per
//   Bleeding target hit."
// Aufbau: Sitz 0: Devlin auf Held 0, Held 1 (Rick) wird von Sitz 1 dauerhaft übernommen (`actionTakeHeroPermanently(1, 0, 1)`). Sitz 0 greift diesen
//   Helden zweimal mit „Attack" an (1. Treffer: Blutung, 2. Treffer: Abwurf). Beide Hände haben 5 Karten.
// Erwartet: Sitz 1 (Kontrolleur des Ziels) wirft 2 Karten ab; Sitz 0 behält seine Hand.
// Beobachtet: Sitz 0 – Devlins eigener Kontrolleur – wirft 2 Karten ab, Sitz 1 nichts. (Kreaturen-Ziele laufen dagegen über `inst.controller`, korrekt.)
// Ursache: `devlin-the-masked-butcher.js` `afterDamage` (~Z. 65): `owner = engine._findHeroOwner(t)` (Brettspalte) → `forceDiscard(engine, owner, …)`; für Kreaturen
//   (~Z. 90) wird `inst.controller ?? inst.owner` benutzt.
const H = require('../../lib/h.js');
const DE = 'Devlin, the Masked Butcher';
(async () => {
  const R = H.runner();
  const t = await H.fresh({ heroes: [[DE, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [['Attack', 'Attack', 'ZZ Filler', 'ZZ Filler', 'ZZ Filler'], ['ZZ Filler', 'ZZ Filler', 'ZZ Filler', 'ZZ Filler', 'ZZ Filler']] });
  t.setAbilities(0, 0, [['Fighting'], [], []]);
  await t.run(() => t.engine.actionTakeHeroPermanently(1, 0, 1, { sourceName: 'Test' }));
  t.targetFn = (valid) => [(valid.find(x => x.type === 'hero' && x.owner === 0 && x.heroIdx === 1) || valid.find(x => x.type === 'hero')).id];
  await t.play(0, 'Attack', { hero: 0, noGrant: true });
  R.check('Vorprobe: Ziel blutet nach dem 1. Treffer', !!t.hero(0, 1).statuses.bleeding, Object.keys(t.hero(0, 1).statuses));
  const h0 = t.pile(0, 'hand').length, h1 = t.pile(1, 'hand').length;
  await t.play(0, 'Attack', { hero: 0, noGrant: true });
  const nach0 = t.pile(0, 'hand').length, nach1 = t.pile(1, 'hand').length;
  R.check('Sitz 1 (Kontrolleur des blutenden Ziels) wirft 2 Karten ab', h1 - nach1 === 2, { sitz1: [h1, nach1] });
  R.check('Sitz 0 (Devlin) verliert nur die gespielte Attack-Karte', h0 - nach0 === 1, { sitz0: [h0, nach0] });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
