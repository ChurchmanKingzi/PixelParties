'use strict';
// H04-21 · Tsu'Ki: der Lunatic-Cycle-Rabatt (`equipCostReduction`) gilt auch bei NEGIERTER und BETÄUBTER Tsu'Ki  [Stufe B]
//
// Kartentext Tsu'Ki: „'Lunatic Cycle' cards that are equipped to this Hero have their Cost reduced by 10."
// Engine-Regel: Negated/Frozen/Stunned schalten Heldeneffekte stumm (`_isHeroEffectSilenced`); Vertragsfunktionen wie `equipCostReduction`
//   sind hier keine Hooks – `engine.artifactPlayCost` (`_engine.js` ~Z. 24369) liest sie per `loadCardEffect(eqHero.name)` ohne Statusprüfung (gleiche Klasse wie H04-02/-09/-13).
// Erwartung: Bei negierter (und betäubter) Tsu'Ki kostet „Lunatic Cycle - New Moon" (Kosten 12) die vollen 12 Gold; mit 2 Gold ist die Ausrüstung nicht bezahlbar.
// Beobachtet: Mit 2 Gold wird New Moon an die negierte bzw. betäubte Tsu'Ki ausgerüstet (Preis 2).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const TK = "Tsu'Ki, the Lunatic Princess", LC = 'Lunatic Cycle - New Moon';
  async function lauf(status) {
    const t = await H.fresh({ heroes: [[TK, 'Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker']], hand: [[LC], []], deckSize: 20 });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    const kosten = t.engine._getCardDB()[LC].cost;
    if (status) await t.run(() => t.engine.addHeroStatus(0, 0, status, { appliedBy: 1 }));
    t.setGold(0, kosten - 10);
    const r = await t.play(0, LC, { hero: 0 });
    return { kosten, r, gold: t.gs.players[0].gold, ausgeruestet: t.engine.cardInstances.some(i => i.name === LC && i.zone === 'support'), err: t.errors };
  }
  const norm = await lauf(null);
  R.check('Kontrolle: gesunde Tsu\'Ki – Rabatt gilt (Ausrüstung für 2 Gold)', norm.ausgeruestet === true, norm);
  for (const st of ['negated', 'stunned']) {
    const o = await lauf(st);
    R.check(`${st === "negated" ? "negierte" : "betäubte"} Tsu'Ki: kein Rabatt (Ausrüstung für 2 Gold nicht bezahlbar)`, o.ausgeruestet === false, o);
  }
  R.finish();
})();
