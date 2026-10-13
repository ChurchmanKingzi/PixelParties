'use strict';
// M02-12 · Terror erzwingt das Zugende auch, wenn sein Träger gefroren / betäubt ist (nur „negiert" legt es still)
// Kartentext Terror (Lv3): „After a player has resolved a total of 5 cards or effects with different names during their turn, their turn immediately moves to the End Phase."
// Konvention (B-querschnitt B-01…B-03, B-09; CARD_API.md): Abilities eines gefrorenen/betäubten/negierten Helden sind stillgelegt.
// Erwartung: Terror-Held gefroren oder betäubt ⇒ die 5. verschiedene Karte löst KEIN Zugende aus (`gs._terrorForceEndTurn` bleibt leer).
// Beobachtet: nur `negated` legt Terror still (`terrorSchwelle` -> Infinity); gefroren und betäubt lösen bei der 5. Karte `_terrorForceEndTurn = 0` aus.
// Ursache: `_engine.js` `terrorSchwelle()` (~Z. 28555) prüft nur `hero.hp <= 0` und `hero.statuses?.negated`.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const potions = ['Smoke Vial', 'Tears of Creation', 'Life Serum', 'Poison Vial', 'Magnetic Potion'];
  for (const st of [null, 'negated', 'frozen', 'stunned']) {
    const t = await H.fresh({ hand: [[], []], hp: 800, deck: [Array(10).fill('ZZ Dummy'), Array(10).fill('ZZ Dummy')] });
    t.setAbilities(0, 0, [['Terror', 'Terror', 'Terror'], [], []]);   // Lv3 -> Schwelle 5
    if (st) t.heroStatus(0, 0, st);
    t.targetFn = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0); return v ? [v.id] : null; };
    for (const p of potions) await t.play(0, p, { hero: 0, keepActions: true });
    const ausgeloest = t.gs._terrorForceEndTurn != null;
    if (st === null) R.check('Kontrolle: unversehrter Terror-Held löst nach 5 verschiedenen Karten das Zugende aus', ausgeloest, t.gs._terrorForceEndTurn);
    else R.check(`Terror-Held ${st}: kein erzwungenes Zugende`, !ausgeloest, t.gs._terrorForceEndTurn);
  }
  R.finish();
})();
