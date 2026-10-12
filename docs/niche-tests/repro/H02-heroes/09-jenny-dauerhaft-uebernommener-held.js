// H02-heroes-09 · Jenny, the Class Fairy – Abilities eines DAUERHAFT übernommenen Gegnerhelden sind nicht wählbar
//
// Kartentext Jenny: „You may once per turn add any number of Abilities from Heroes you permanently control back to your hand, and if you do, draw that many cards. …"
// Ruling (CARD_API.md Z. 6046, 4.9.): „Ein dauerhaft gestohlener Held zählt genau wie ein Held, den man von Anfang an beherrscht."
// Erwartung: hat Sitz 0 den Gegnerhelden (1,0) per Paraseed-Mechanik (`actionTakeHeroPermanently`) dauerhaft übernommen, bietet Jenny dessen Abilities zum Zurückholen an.
// Beobachtung: `canActivateHeroEffect` verneint (keine Ziele): `jenny-the-class-fairy.js` `permanentlyControlledHeroIndices` läuft nur über die EIGENE Spalte `ps.heroes`
//   und schließt `charmedBy != null` aus – der übernommene Held steht in der Gegnerspalte, seine `abilityZones` liegen dort.
// Aufruf: node docs/niche-tests/repro/H02-heroes/09-jenny-dauerhaft-uebernommener-held.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const JENNY = 'Jenny, the Class Fairy';
(async () => {
  const R = H.runner();
  const t = await H.fresh({ heroes: [[JENNY, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], abilities: { 1: { 0: [['Fighting', 'Fighting'], [], []] } }, deckSize: 20 });
  const ok = await t.run(() => t.engine.actionTakeHeroPermanently(0, 1, 0, { sourceName: 'Paraseed' }));
  R.check('Held (1,0) dauerhaft übernommen', ok === true && t.engine.heroSideOf(1, t.hero(1, 0)) === 0, ok);
  t.targetFn = (valid) => valid.filter(v => v.type === 'ability').map(v => v.id);
  t.script.push({ match: d => d.type === 'optionPicker', answer: () => ({ optionId: '2' }), once: true });
  const hand0 = t.pile(0, 'hand').length;
  const r = await t.activateHero(0, 0, { effect: JENNY });
  R.note('activateHero ->', r);
  R.check('Jenny konnte aktiviert werden und holte die Fighting-Karten des übernommenen Helden zurück (Hand +4)', t.pile(0, 'hand').length - hand0 === 4, { r, hand: t.pile(0, 'hand') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
