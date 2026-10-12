'use strict';
// H04-06 · Silent Water Mizune: Bonus „Hero that could activate it" zählt auch bei gefrorenem/betäubtem/negiertem Träger  [Stufe C]
//
// Kartentext: „You may once per turn send a Surprise from your side of the board to the discard pile to draw a card. If the Surprise
//   was in the Surprise or Support Zone of a Hero that could activate it, draw another card. If the Surprise was face-up, draw another card."
// Engine-Definition „kann aktivieren": `_canHeroActivateSurprise` (lebt, nicht Frozen/Stunned/Webbed/Negated, Schule/Stufe, Sperren).
// Beobachtet: Mizune prüft nur `heroMeetsLevelReq` (Schule/Stufe); ein gefrorener, betäubter oder negierter Träger zählt trotzdem als
//   „could activate" (2 statt 1 Karte). Ein toter Träger gibt (zufällig über heroMeetsLevelReq) keinen Bonus.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const MZ = 'Silent Water Mizune';
  async function lauf(status) {
    const t = await H.fresh({ heroes: [[MZ, 'Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker']], hand: [[], []], deck: [Array(20).fill(H.INERT.creature), []] });
    t.setAbilities(0, 1, [['Decay Magic'], [], []]);
    t.putSurprise(0, 1, 'Toxic Trap');                          // Lv1 Decay-Surprise, verdeckt, Träger = Held 1
    if (status) t.heroStatus(0, 1, status);
    t.targetFn = (valid) => { const v = valid.find(x => x.type === 'surprise'); return v ? [v.id] : null; };
    const h0 = t.pile(0, 'hand').length;
    const r = await t.activateHero(0, 0, { effect: MZ });
    return { r, draw: t.pile(0, 'hand').length - h0, can: t.engine._canHeroActivateSurprise(0, 1, 'Toxic Trap'), err: t.errors };
  }
  const norm = await lauf(null);
  R.check('Kontrolle: gesunder Träger → 2 Karten (1 + „could activate")', norm.draw === 2, norm);
  for (const st of ['frozen', 'stunned', 'negated']) {
    const o = await lauf(st);
    R.check(`Träger ${st}: Engine sagt „kann nicht aktivieren" (${o.can}) → nur 1 Karte`, o.can === false && o.draw === 1, o);
  }
  R.finish();
})();
