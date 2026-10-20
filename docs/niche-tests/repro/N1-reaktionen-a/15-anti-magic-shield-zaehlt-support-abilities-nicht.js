'use strict';
// N1-15 · Anti Magic Shield: die Stufenprüfung „Spell's level is not higher than the user's Magic Arts level" zählt Magic Arts in Support Zones (Xal) nicht mit
// Kartentext: „Play this card immediately when a Hero that can use this Spell is hit by an opponent's Spell. If that Spell's level is not higher than the user's Magic Arts level, negate it."
// Engine: `effectiveSchoolLevelForCaster` zählt Ability-Zonen UND Ability-Stapel in Support Zones (Xal, v767) und blankt bei negierten Abilities; `heroMeetsLevelReq` (Wirker-Prüfung) nutzt dieselben Mengen.
// Skript (`anti-magic-shield.js` `postTargetCondition`): zählt die Magic Arts selbst, nur aus `gs.players[seite].abilityZones[hi]` (+ Performance).
// Aufbau: Sitz 1: Xal, the Animated Armor (Abilities in Support Zones erlaubt) mit Magic Arts 2 – einmal in den Ability-Zonen (Gegenprobe), einmal als Stapel in einer Support Zone; AMS auf der Hand.
//   Sitz 0 wirkt Fire Bolts (Level 1) auf Xal.
// Erwartet: Xal kann AMS wirken (Level-1-Reaktion, Magic Arts 2) und negiert den Level-1-Zauber – in beiden Varianten.
// Beobachtet: Variante Support Zone: `_canHeroActivateSurprise` sagt ja, die Engine zählt Magic Arts 2, AMS wird aber nie angeboten; Fire Bolts trifft (700).
const H = require('../../lib/h.js');
const heroPick = (s, h) => (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === s && x.heroIdx === h); return v ? [v.id] : undefined; };
(async () => {
  const R = H.runner();
  for (const wo of ['ability-zone', 'support-zone']) {
    const t = await H.fresh({ hand: [['Fire Bolts'], ['Anti Magic Shield']] });
    t.setHero(1, 0, 'Xal, the Animated Armor', 800);
    if (wo === 'ability-zone') t.setAbilities(1, 0, [['Magic Arts', 'Magic Arts'], [], []]);
    else { t.gs.players[1].supportZones[0][0] = ['Magic Arts', 'Magic Arts']; t.engine._trackCard('Magic Arts', 1, 'support', 0, 0); t.engine._trackCard('Magic Arts', 1, 'support', 0, 0); }
    R.check(`${wo}: die Engine zählt Magic Arts 2 und Xal kann Anti Magic Shield wirken`, t.engine.effectiveSchoolLevelForCaster('Magic Arts', 1, 0) === 2 && t.engine._canHeroActivateSurprise(1, 0, 'Anti Magic Shield', { spellInHand: true }), t.engine.effectiveSchoolLevelForCaster('Magic Arts', 1, 0));
    t.targetFn = heroPick(1, 0);
    await t.play(0, 'Fire Bolts', { hero: 0 });
    R.check(`${wo}: Anti Magic Shield wird angeboten`, t.prompts.some(p => p.pi === 1 && p.d.title === 'Anti Magic Shield'), t.prompts.map(p => p.pi + ':' + p.d.title));
    R.check(`${wo}: Fire Bolts (Level 1) wird negiert (Xal bei 800 HP)`, t.hp(1, 0) === 800, t.hp(1, 0));
    R.check(`${wo}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.finish();
})();
