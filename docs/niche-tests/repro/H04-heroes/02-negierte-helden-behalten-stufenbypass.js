'use strict';
// H04-02 · Negierte Helden behalten ihren Level-/Schul-Bypass (Sol Rym, Sorin, Tsu'Ki)
//
// Kartentexte: Sol Rym „This Hero may use the Spell "Chain Lightning" regardless of its level."
//              Sorin „This Hero can use level 3 or lower Attacks regardless of their level."
//              Tsu'Ki „This Hero can summon "Lunatic" Creatures regardless of their level."
// Engine-Regel (_engine.js `runHooks`, `_isHeroEffectSilenced`; CARD_API „Negated"): Frozen/Stunned/Negated schalten den
//   Heldeneffekt stumm; Tempestes Ruling nennt es ausdrücklich („NUR solange sie nicht Frozen, Stunned oder Negated … ist");
//   `heroMeetsLevelReq` blankt bei „harter" Negation außerdem die Ability-Zonen („nur Lv0 ohne Schulanforderung bleibt spielbar").
// Erwartung: Ein NEGIERTER Held (ohne Schulen) kann die Karte NICHT mehr per Heldentext-Bypass spielen.
// Beobachtet: Alle drei Bypässe wirken weiter (hero-seitige Verträge `canBypassLevelReqForCard` / `levelOverrideCards` werden nicht auf
//   Negation geprüft, nur Hook-basierte Passive werden von runHooks stummgeschaltet).
// Ursache: _engine.js `_testLevelReqForZones` ruft `heroScript.canBypassLevelReqForCard` ohne `_isHeroEffectSilenced`-Prüfung auf
//   (und `hero.levelOverrideCards` liegt als Zustand am Helden).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const BLANK = ['Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker'];
  async function lauf(heldName, karte, negiert) {
    const t = await H.fresh({ heroes: [[heldName, ...BLANK]], hand: [[karte], []] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    t.setAbilities(0, 0, [[], [], []]);                       // nackter Held: keine Schule
    if (negiert) t.heroStatus(0, 0, 'negated');
    t.targetFn = (valid) => { const v = valid.find(x => x.owner === 1 && x.heroIdx === 0); return v ? [v.id] : null; };
    const r = await t.play(0, karte, { hero: 0, noGrant: true });
    const gespielt = t.pile(0, 'hand').indexOf(karte) < 0;
    return { r, gespielt, err: t.errors };
  }
  for (const [held, karte] of [['Sol Rym, the Thunder Djinn', 'Chain Lightning'], ['Sorin, the Warden of Blood Rock', 'Quick Attack'], ["Tsu'Ki, the Lunatic Princess", 'Lunatic Golem']]) {
    const norm = await lauf(held, karte, false);
    R.check(`Kontrolle: ${held} spielt ${karte} ohne Schule (nicht negiert)`, norm.gespielt, norm);
    const neg = await lauf(held, karte, true);
    R.check(`${held} NEGIERT: ${karte} ist ohne Schule NICHT mehr spielbar`, !neg.gespielt, neg);
  }
  R.finish();
})();
