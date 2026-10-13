'use strict';
// H04-09 · Taio, the Sun Fencer: die Stufensenkung („levels reduced by this Hero's Fighting level") gilt auch bei NEGIERTEM Taio  [Stufe B]
//
// Kartentext: „While this Hero has an Artifact with a cost of 10 or more equipped to it, all Destruction Spells it uses have their
//   levels reduced by this Hero's Fighting level."
// Engine-Regel: Negated/Frozen/Stunned schalten Heldeneffekte stumm; `heroMeetsLevelReq` blankt bei harter Negation die Ability-Zonen
//   (nur Lv0-Karten ohne Schule bleiben spielbar). Thalia (`thalia-the-fun-fairy.js`) prüft den Status deshalb in ihrem eigenen
//   `reduceCardLevel` selbst.
// Aufbau: Taio (Held 0) mit Fighting Lv2, KEINE Destruction Magic; „Bamboo Staff" (Equipment, Kosten 10) in Taios Support Zone;
//   Hand: Fireball (Destruction Lv2).
// Erwartung: normal → Fireball spielbar (Lv2 − 2 = 0). Taio negiert → Senkung entfällt, Fireball NICHT spielbar.
// Beobachtet: auch bei negiertem Taio ist Fireball spielbar und wird gewirkt (650 HP beim Gegner), obwohl er keine einzige Schule hat.
// Ursache: `_engine.js` `_applyCardLevelReductions` (~Z. 43880–43960) ruft `script.reduceCardLevel` jeder aktiven Instanz auf, auch der
//   Helden-Instanz, ohne `_isHeroEffectSilenced`; `taio-the-sun-fencer.js` `reduceCardLevel` liest `ps.abilityZones` direkt (nicht die
//   geblankten Zonen) und prüft keinen Status.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const TAIO = 'Taio, the Sun Fencer';
  async function lauf(status) {
    const t = await H.fresh({ heroes: [[TAIO, 'Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker']], hand: [['Fireball'], []] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    t.setAbilities(0, 0, [['Fighting', 'Fighting'], [], []]);
    t.put(0, 0, 0, 'Bamboo Staff');
    if (status) t.heroStatus(0, 0, status);
    t.targetFn = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0); return v ? [v.id] : null; };
    const meets = t.engine.heroMeetsLevelReq(0, 0, H.DB['Fireball']);
    const r = await t.play(0, 'Fireball', { hero: 0, noGrant: true });
    return { meets, r, hpOpp: t.hp(1, 0), err: t.errors };
  }
  const norm = await lauf(null);
  R.check('Kontrolle: Taio mit cost-10-Artefakt und Fighting 2 wirkt Fireball ohne Destruction Magic', norm.meets === true && norm.hpOpp < 800, norm);
  const neg = await lauf('negated');
  R.check('Taio NEGIERT: Senkung entfällt, Fireball ist ohne Schule nicht spielbar', neg.meets === false && neg.hpOpp === 800, neg);
  R.finish();
})();
