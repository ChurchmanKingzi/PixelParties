'use strict';
// A03-futuretech-18 · Future Tech Fists: „once per turn" gilt je Kopie, nicht je Kartenname
//
// Kartentext: „… You may once per turn choose as many targets on the board as there are "Future Tech Fists" cards in your discard pile and deal damage equal to
//   the equipped Hero's Base Attack stat to them. **You can only activate the effect of "Future Tech Fists" once per turn.**“
// Erwartung: Der zweite Satz nennt den KARTENNAMEN (nicht „this card"): trägt man zwei Fists (zwei Helden), darf der Effekt in einem Zug nur ein einziges Mal aktiviert werden.
// Beobachtet: Beide Fists lassen sich im selben Zug aktivieren (Gegner-Held 0 verliert 40 + 80 = 120).
// Ursache: `_engine.js` ~42332 stempelt die Einmal-pro-Zug-Sperre je Instanz (`hoptUsed['equip-effect:'+inst.id]`); die Karte (cards/effects/future-tech-fists.js) hat keine
//   eigene Namenssperre.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const F = 'Future Tech Fists';
  const t = await H.fresh({ discard: [[F, F], []], gold: [200, 100] });
  t.put(0, 0, 0, F); t.put(0, 1, 0, F);
  t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
  const base0 = t.hero(0, 0).baseAtk, base1 = t.hero(0, 1).baseAtk;
  const a = await t.activateEquip(0, 0, 0);
  const hpNachErster = t.hp(1, 0);
  const b = await t.activateEquip(0, 1, 0);
  R.check('erste Fists: Schaden = Basis-ATK von Held 0', hpNachErster === 800 - base0, { hp: hpNachErster, base0, a });
  R.check('zweite Fists im selben Zug: darf NICHT mehr wirken (Text: „only activate … once per turn“)', t.hp(1, 0) === hpNachErster, { hp: t.hp(1, 0), base1, b });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
