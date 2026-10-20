'use strict';
// W24d · Gegenprobe zu N4-02/12/13: die Alleria-Sperre „that Attack's or Spell's damage cannot be reduced or negated, except by a Surprise" wirkt weiter auf den umgeleiteten Schaden.
// Aufbau: Sitz 0: Alleria (Held 0), Carris (Held 1, „Any damage this Hero would take becomes 0"), Surprise in Carris' Zone. Sitz 1 wirft Fireball (150) auf Alleria; Alleria leitet auf Carris um.
// Erwartung: der umgeleitete Schaden trifft Carris trotz seiner Fähigkeit mit 150 (nicht verringer-/negierbar); die Marke ist danach verbraucht (ein späterer eigener Treffer auf Carris wird wieder auf 0 gesetzt).
// Zweite Probe (Kreatur, N4-13): wird eine einzelne Kreatur gewählt und umgeleitet, gilt dieselbe Sperre für den Schaden am Helden.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const heroes = [['Alleria, the Queen of Spiders', 'Carris, the Time Keeper', H.BLANK_HEROES[2]], [H.BLANK_HEROES[0], H.BLANK_HEROES[1], H.BLANK_HEROES[2]]];
  for (const ziel of ['held', 'kreatur']) {
    const t = await H.fresh({ heroes, hand: [['ZZ Filler'], ['Fireball', 'Fireball']], deckSize: 30, active: 1 });
    t.putSurprise(0, 1, 'Spider Avalanche');
    const c = t.put(0, 2, 0, H.INERT.big);
    t.script.push({ match: d => d.type === 'confirm' && /Alleria/.test(d.title || ''), answer: () => ({ confirmed: true }) });
    t.targetFn = (valid) => [(ziel === 'held' ? valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 0) : valid.find(v => v.type === 'equip' && v.owner === 0)).id];
    await t.play(1, 'Fireball', { hero: 0 });
    R.check(`${ziel}: umgeleitet – Carris nimmt 150 trotz „Damage becomes 0"`, t.hp(0, 1) === 650, t.hp(0, 1));
    R.check(`${ziel}: Marke verbraucht`, !t.gs._redirectedOnlyReducibleBySurprise && !t.gs._redirectedOnlyReducibleStamp, { f: t.gs._redirectedOnlyReducibleBySurprise });
    // zweiter Fireball (Alleria schon verbraucht für diesen Zug) direkt auf Carris: wieder auf 0 gesetzt
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 1).id];
    t.reset();
    await t.play(1, 'Fireball', { hero: 0 });
    R.check(`${ziel}: späterer Fireball auf Carris wird von dessen Fähigkeit auf 0 gesetzt (und wurde wirklich gespielt)`, t.hp(0, 1) === 650 && t.pile(1, 'hand').filter(n => n === 'Fireball').length === 0, { hp: t.hp(0, 1), hand: t.pile(1, 'hand') });
    R.check(`${ziel}: keine Engine-Fehler / Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  R.finish();
})();
