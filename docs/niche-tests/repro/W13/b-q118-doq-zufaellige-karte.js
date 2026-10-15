'use strict';
// W13 / Q118 (H02-heroes-28) · Great Detective Doq: „choose a random card from your opponent's hand" (Al: „Bestimme eine zufällige.")
// Erwartung: kein Anklicken (kein `pickFromOppHand`-Prompt); die Karte folgt dem Zufall (Math.random fest: Index 0 / 1 / 2);
// bekannte Karten garantieren keinen Treffer. Exit 0 = korrekt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  // Hand Sitz 1: [Fireball (Spell), Diver Helmet (Artifact), Fireball]; Deklaration immer „Artifact".
  for (const [zufall, idx, treffer] of [[0.0, 0, false], [0.4, 1, true], [0.9, 2, false]]) {
    const t = await H.fresh({ heroes: [['Great Detective Doq', H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [['Attack'], ['Fireball', 'Diver Helmet', 'Fireball']] });
    t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
    t.script.push({ match: d => d.type === 'optionPicker', answer: () => ({ optionId: 'artifact' }) });
    const d0 = t.pile(0, 'mainDeck').length;
    const _r = Math.random; Math.random = () => zufall;
    const r = await t.play(0, 'Attack', { hero: 0 });
    Math.random = _r;
    const gezogen = d0 - t.pile(0, 'mainDeck').length;
    R.check(`Zufall ${zufall} (Index ${idx}): Attack gespielt, kein Anklick-Prompt`, r === true && t.prompts.every(p => p.d.type !== 'pickFromOppHand'), { r, prompts: t.prompts.map(p => p.d.type) });
    R.check(`Zufall ${zufall} (Index ${idx}): Treffer = ${treffer}`, treffer ? (t.hp(1, 0) === 550 && gezogen === 2) : (t.hp(1, 0) === 700 && gezogen === 0), { hp: t.hp(1, 0), gezogen });
    R.check(`Zufall ${zufall}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.finish();
})();
