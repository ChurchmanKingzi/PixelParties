'use strict';
// S02-04 · Divine Gift of The Light: „the first time every turn" – je Held oder einmal je Zug? (Regelfrage)
// Kartentext: „While this card remains in play, the first time every turn a Hero uses a Support Magic Spell that does not heal …,
//   that Spell's controller may choose any target on the board and heal it for 100 HP."
// Skript (Kopfkommentar): „Per-hero HOPT" – jeder Held löst einmal je Zug aus. Wörtlich („the first time every turn") wäre es EINMAL JE ZUG insgesamt.
// Beobachtet: Divine Zeal mit Held 0, danach Divine Zeal mit Held 1 im selben Zug → zwei Heilfenster.
// Die Probe ✗ gilt der Lesart „einmal je Zug insgesamt".
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Divine Gift of The Light'], []] });
  await t.play(0, 'Divine Gift of The Light', { hero: 0 });
  t.heroStatus(0, 0, 'burned'); t.heroStatus(0, 1, 'burned');
  t.reset();
  t.targetFn = (valid) => [valid[0].id];
  const n = () => t.targets.filter(x => x.config && x.config.title === 'Divine Gift of The Light').length;
  await t.play(0, 'Divine Zeal', { hero: 0 });
  const nach1 = n();
  t.heroStatus(0, 0, 'burned'); t.heroStatus(0, 1, 'burned');
  await t.play(0, 'Divine Zeal', { hero: 1 });
  const nach2 = n();
  R.note('Heilfenster', { nachZeal_Held0: nach1, nachZeal_Held1_selber_Zug: nach2 });
  R.check('(Lesart „einmal je Zug insgesamt") zweiter Held im selben Zug löst nicht erneut aus', nach2 === 1, { nach1, nach2 });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
