// H02-heroes-03 · Gon, the Frostbringer – verlängert Freezes nach „aktiver Spieler", nicht nach „deinem Effekt"
//
// Kartentext Gon: „All your effects that Freeze one or more targets Freeze them for an additional turn."
// Erwartung: nur Freezes, die EFFEKTE DES GON-BESITZERS auslösen, dauern 1 Zug länger – gleichgültig, wessen Zug läuft.
//   (a) Frost Rune des GEGNERS (Surprise, „Freeze the attacker … 2 turns") friert im Zug des Gon-Besitzers dessen Angreifer: Dauer 2.
//   (b) Frost Rune des GON-BESITZERS friert im Zug des Gegners dessen Angreifer: Dauer 3.
// Beobachtung: (a) Dauer 3 (der Feind-Effekt wird von Gon verlängert, der Gon-Besitzer verliert 1 Zug mehr),
//   (b) Dauer 2 (der eigene Effekt bekommt den Bonus nicht).
// Ursache: `gon-the-frostbringer.js:onStatusApplied` prüft `gs.activePlayer !== ctx.cardOwner` statt `ctx.opts.appliedBy`.
// Aufruf: node docs/niche-tests/repro/H02-heroes/03-gon-aktiver-spieler-statt-eigener-effekt.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const GON = 'Gon, the Frostbringer';
function pickHero(owner, hi) { return (valid) => [valid.find(v => v.type === 'hero' && v.owner === owner && v.heroIdx === hi).id]; }
(async () => {
  const R = H.runner();
  R.section('(a) Gegnerische Frost Rune friert den Angreifer des Gon-Besitzers (Zug von Sitz 0) – erwartet Dauer 2');
  {
    const t = await H.fresh({ heroes: [[GON, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [['Fireball'], []] });
    t.grantFor(1, 0, 'Frost Rune');
    t.putSurprise(1, 0, 'Frost Rune');
    t.targetFn = pickHero(1, 0);
    const r = await t.play(0, 'Fireball', { hero: 1 });
    const f = t.hero(0, 1).statuses.frozen;
    R.check('Fireball behandelt, Angreifer gefroren', r === true && !!f, { r, f });
    R.check('Dauer 2 (Frost Rune ist ein Effekt des Gegners, nicht von Gon-Besitzer)', f && f.duration === 2, f && f.duration);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.section('(b) Frost Rune des Gon-Besitzers (Sitz 0) friert im Zug des Gegners dessen Angreifer – erwartet Dauer 3');
  {
    const t = await H.fresh({ heroes: [[GON, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [[], ['Fireball']], active: 1 });
    t.grantFor(0, 1, 'Frost Rune');
    t.putSurprise(0, 1, 'Frost Rune');
    t.targetFn = pickHero(0, 1);
    const r = await t.play(1, 'Fireball', { hero: 0 });
    const f = t.hero(1, 0).statuses.frozen;
    R.check('Fireball behandelt, Angreifer gefroren', r === true && !!f, { r, f });
    R.check('Dauer 3 (eigener Effekt des Gon-Besitzers, +1 Zug)', f && f.duration === 3, f && f.duration);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
