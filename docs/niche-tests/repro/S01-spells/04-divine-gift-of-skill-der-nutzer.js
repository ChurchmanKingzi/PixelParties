'use strict';
// S01-04 · Divine Gift of Skill: „unless the USER has at least Magic Arts 1" wird auf den GEWÄHLTEN Helden gelesen
// Kartentext: „Choose a Hero you control. You can attach up to 4 additional Abilities to that Hero this turn. That Hero cannot perform an Action for the rest of the
//   turn unless the user has at least Magic Arts 1. This counts as an additional Action."  („the user" = der Held, der die Karte spielt; vgl. Big Oopsie „If the user is an Ascended Hero")
// Skript: divine-gift-of-skill.js Kopf („… unless they have at least Magic Arts 1"), Sperre `engine.isHeroSkillLocked(playerIdx, heroIdx)` (_engine.js:43381) prüft die Magic-Arts-Stufe des GESPERRTEN Helden.
// Szene A: Nutzer = Held 0 (Magic Arts 1), gewählt = Held 1 (Destruction Magic 1, kein Magic Arts).  Erwartet nach Text: Held 1 NICHT gesperrt (der Nutzer hat Magic Arts 1).
// Szene B: Nutzer = Held 0 (keine Schule; Lv0-Zauber), gewählt = Held 1 (Magic Arts 2 + Destruction Magic).  Erwartet nach Text: Held 1 GESPERRT (der Nutzer hat kein Magic Arts).
// Beobachtet: A: Held 1 gesperrt (lock = true).  B: Held 1 nicht gesperrt (lock = false).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  let t = await H.fresh({ hand: [['Divine Gift of Skill'], []], abilities: { 0: { 0: [['Magic Arts'], [], []], 1: [['Destruction Magic'], [], []] } } });
  t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 1).id];
  await t.play(0, 'Divine Gift of Skill', { hero: 0, noGrant: true });
  R.check('(A) Gift gewirkt: 4 Bonus-Anhänge für Held 1', (t.gs.players[0]._bonusAbilityAttachments || {})[1] === 4, t.gs.players[0]._bonusAbilityAttachments);
  R.check('(A) Nutzer hat Magic Arts 1 → der gewählte Held 1 ist nicht gesperrt', t.engine.isHeroSkillLocked(0, 1) === false, { lock: t.engine.isHeroSkillLocked(0, 1) });

  t = await H.fresh({ hand: [['Divine Gift of Skill'], []], abilities: { 0: { 1: [['Magic Arts', 'Magic Arts'], ['Destruction Magic'], []] } } });
  t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 1).id];
  const r = await t.play(0, 'Divine Gift of Skill', { hero: 0, noGrant: true });
  R.check('(B) Gift von einem Helden ohne Schule gespielt (Lv 0)', r === true && (t.gs.players[0]._bonusAbilityAttachments || {})[1] === 4, { r, bonus: t.gs.players[0]._bonusAbilityAttachments });
  R.check('(B) Nutzer hat KEIN Magic Arts → der gewählte Held 1 ist gesperrt', t.engine.isHeroSkillLocked(0, 1) === true, { lock: t.engine.isHeroSkillLocked(0, 1) });
  R.finish();
})();
