// H02-heroes-17 · Gobbo (negiert) – die Level-Freigabe gilt weiter, die HP-Kosten entfallen: eine Lv-3-Attack ohne Fighting, gratis
//
// Kartentext Gobbo: „This Hero can use Attacks regardless of their levels. After performing an Attack with a higher level than this Hero's Fighting level, reduce this Hero's current and max HP by 100 times the difference."
// Konvention (B-09, `_isHeroEffectSilenced`): ein negierter Held verliert seine Heldeneffekte; seine Ability-Zonen zählen als leer. Gobbos Freigabe ist ein statischer Vertrag
//   (`canBypassLevelReqForCard`), den `heroMeetsLevelReq` (_engine.js ~43819) OHNE Status-Prüfung abfragt; der Kostenhaken `afterSpellResolved` ist dagegen still (Hook-Filter).
// Erwartung: negierter Gobbo ohne Fighting kann Critical Strike (Lv 3) nicht spielen (wie jeder Held ohne Fighting 3). Beobachtung: wird gespielt, Gegner −180, Gobbos HP/Max-HP unverändert.
// Aufruf: node docs/niche-tests/repro/H02-heroes/17-gobbo-negiert-spielt-weiter-gratis.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const GOBBO = 'Gobbo, Chief of Goblin';
(async () => {
  const R = H.runner();
  const pick = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
  // Kontrolle: Gobbo ohne Status zahlt 300 HP und Max-HP.
  { const t = await H.fresh({ heroes: [[GOBBO, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [['Critical Strike'], []], hp: 800 });
    t.setHero(0, 0, GOBBO, 600); t.targetFn = pick;
    const r = await t.play(0, 'Critical Strike', { hero: 0, noGrant: true });
    R.check('Kontrolle: Gobbo (ohne Status) spielt Lv 3 und zahlt 300 (HP/Max 300/300)', r === true && t.hp(0, 0) === 300 && t.hero(0, 0).maxHp === 300, { r, hp: t.hp(0, 0), max: t.hero(0, 0).maxHp }); }
  // Prüfling: negiert.
  { const t = await H.fresh({ heroes: [[GOBBO, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [['Critical Strike'], []], hp: 800 });
    t.setHero(0, 0, GOBBO, 600); t.heroStatus(0, 0, 'negated'); t.targetFn = pick;
    const r = await t.play(0, 'Critical Strike', { hero: 0, noGrant: true });
    R.check('negierter Gobbo: Critical Strike (Lv 3, kein Fighting) nicht spielbar', r !== true || t.hp(1, 0) === 800, { r, gegner: t.hp(1, 0), gobboHp: t.hp(0, 0), max: t.hero(0, 0).maxHp });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }
  R.finish();
})();
