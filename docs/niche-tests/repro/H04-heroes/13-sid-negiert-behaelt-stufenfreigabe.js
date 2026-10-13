'use strict';
// H04-13 · Sid, the King of Thieves: die Stufe-0-Freigabe der geraubten Karten gilt auch bei NEGIERTEM Sid  [Stufe B]
//
// Kartentext: „… This Hero may use any level 3 or lower Attacks, Spells and Creatures added this way as if they were level 0."
// Engine-Regel: Negated/Frozen/Stunned schalten Heldeneffekte stumm; bei harter Negation sind die Ability-Zonen geblankt (nur Lv0 ohne Schule spielbar).
// Beobachtet: Sid stempelt die Freigabe als Hand-Offset (`ps._handLevelOffsetsTransient[handIdx] = -level`, gefiltert auf seinen Heldenplatz,
//   `ps._handLevelOffsetHeroFilter`). `heroMeetsLevelReq` liest diese Offsets ohne `_isHeroEffectSilenced`: ein negierter Sid (keine Schule, Abilities geblankt)
//   wirkt trotzdem Fireball (Lv 2). Gleiche Klasse wie H04-02 (dort Skript-Verträge, hier Hand-Offset-Karte).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const SID = 'Sid, the King of Thieves';
  async function lauf(status) {
    const t = await H.fresh({ heroes: [[SID, 'Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker']], hand: [[], []],
      deck: [[H.INERT.creature, H.INERT.creature], ['Fireball', 'Chain Lightning', 'Icebolt', H.INERT.creature]] });
    t.script.push({ match: d => d.type === 'cardGalleryMulti' && d.title === SID, answer: () => ({ selectedCards: ['Chain Lightning', 'Fireball'] }), once: true });
    await t.run(() => t.engine.runHooks('onBeforeHandDraw', {}));
    if (status) t.heroStatus(0, 0, status);
    t.targetFn = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0); return v ? [v.id] : null; };
    const meets = t.engine.heroMeetsLevelReq(0, 0, H.DB['Fireball']);
    const r = await t.play(0, 'Fireball', { hero: 0, noGrant: true });
    return { meets, r, hpOpp: t.hp(1, 0), err: t.errors };
  }
  const norm = await lauf(null);
  R.check('Kontrolle: Sid ohne Schule wirkt den geraubten Lv-2-Fireball', norm.meets === true && norm.hpOpp === 650, norm);
  const neg = await lauf('negated');
  R.check('Sid NEGIERT: Freigabe entfällt, der Fireball ist nicht spielbar', neg.meets === false && neg.hpOpp === 800, neg);
  R.finish();
})();
