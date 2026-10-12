// H02-heroes-06 · Ida, the Adept of Destruction – nach Tod und Wiederbelebung im selben Zug fehlt der Einzelziel-Deckel
//
// Kartentext Ida: „This Hero can never hit more than 1 target with a Destruction Spell."
// Erwartung: Ida, mitten im Zug besiegt und wiederbelebt (Golden Ankh, Styx, …), deckelt ihre Destruction-Zauber sofort wieder auf 1 Ziel.
// Beobachtung: `onHeroKO` löscht `gs.heroFlags["0-0"].forcesSingleTarget`; gesetzt wird die Flagge nur in `onGameStart`, `onPlay`
//   und `onTurnStart` (`ida-the-adept-of-destruction.js:50-86`) – nicht in `onHeroRevive`. Bis zum nächsten Zugbeginn trifft Fireball 2 Ziele.
// Aufruf: node docs/niche-tests/repro/H02-heroes/06-ida-nach-wiederbelebung-ohne-deckel.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const IDA = 'Ida, the Adept of Destruction';
(async () => {
  const R = H.runner();
  const t = await H.fresh({ heroes: [[IDA, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [['Fireball'], []] });
  await t.run(() => t.engine.runHooks('onGameStart', {}));
  await t.run(() => t.engine.actionDefeatHero({ name: 'test', owner: 1 }, t.hero(0, 0), { reason: 'test' }));
  await t.run(() => t.engine.actionReviveHero(0, 0, 300, { source: 'test' }));
  R.check('Ida lebt wieder (300 HP)', t.hp(0, 0) === 300, t.hp(0, 0));
  R.note('heroFlags nach Wiederbelebung', t.gs.heroFlags);
  t.targetFn = (valid, cfg) => { const n = (cfg && (cfg.maxTotal || cfg.max)) || valid.length; return valid.slice(0, n).map(v => v.id); };
  const r = await t.play(0, 'Fireball', { hero: 0 });
  const verwundet = [0, 1, 2].filter(i => t.hp(1, i) < 800);
  R.check('Fireball behandelt', r === true, r);
  R.check('Fireball trifft unter Ida nur 1 Ziel', verwundet.length === 1, verwundet);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
