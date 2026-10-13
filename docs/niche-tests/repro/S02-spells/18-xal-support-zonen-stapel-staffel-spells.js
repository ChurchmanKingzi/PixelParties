'use strict';
// S02-18 · Stufen-Zauber zählen die Ability-Stapel in den Support Zones von Xal nicht (Haste, Heal, Healing Melody, Instant Cryo Stasis)
// Xal, the Animated Armor: „You may place Abilities into the Support Zones of this Hero." – diese Stapel zählen für den Level-Vertrag
// (`heroMeetsLevelReq`, `effectiveSchoolLevelForCaster`, _engine.js ~Z. 43140/43290). Gleiche Klasse wie S01-20.
// Haste „Draw 2/3/4 cards." · Heal „… heal it for 150/200/300 HP." · Healing Melody „Heal all targets you control for 100/150/200 HP."
// Instant Cryo Stasis „If the user has at least Decay Magic 2, this counts as an additional Action."
// Aufbau: Xal als Held 0 von Sitz 0; die Schule ×3 (Cryo: Decay ×2) liegt als Stapel in Xals erster Support Zone (Ability-Zonen leer). Vergleich: dieselbe Karte in der Ability-Zone.
// Erwartet: gleiche Wirkung wie in der Ability-Zone (Haste 4 Karten, Heal +300, Melody +200, Cryo als Zusatzaktion).
// Beobachtet: Support-Stapel zählt nicht: Haste 2 Karten, Heal +150, Melody +100, Cryo ohne Zusatzaktion. (Gegenprobe Draw nutzt `effectiveSchoolLevelForCaster`: Xal-Support-Stapel zählt ✓.)
const H = require('../../lib/h.js');
async function szene(hand, schule, n, inSupport) {
  const t0 = await H.fresh({ hand: [[], []] });
  const t = await H.fresh({ heroes: [['Xal, the Animated Armor', t0.gs.players[0].heroes[1].name, t0.gs.players[0].heroes[2].name], t0.gs.players[1].heroes.map(h => h.name)],
    hand: [hand, []], deckSize: 30,
    abilities: { 0: { 0: [inSupport ? [] : Array(n).fill(schule), [], []] } } });
  if (inSupport) { t.gs.players[0].supportZones[0][0] = Array(n).fill(schule); for (let k = 0; k < n; k++) t.engine._trackCard(schule, 0, 'support', 0, 0); }
  return t;
}
(async () => {
  const R = H.runner();
  for (const inSupport of [false, true]) {
    const wo = inSupport ? 'Stapel in Xals Support Zone' : 'Stapel in der Ability-Zone';
    let t = await szene(['Haste', H.INERT.filler], 'Support Magic', 3, inSupport);
    let h0 = t.pile(0, 'hand').length;
    await t.play(0, 'Haste', { hero: 0, noGrant: true });
    R.check(`Haste mit Support Magic 3 (${wo}): 4 Karten`, t.pile(0, 'hand').length === h0 - 1 + 4, t.pile(0, 'hand').length - (h0 - 1));
    t = await szene(['Heal'], 'Support Magic', 3, inSupport);
    t.hero(0, 0).hp = 400; t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 0 && x.heroIdx === 0).id];
    await t.play(0, 'Heal', { hero: 0, noGrant: true });
    R.check(`Heal mit Support Magic 3 (${wo}): +300`, t.hp(0, 0) === 700, t.hp(0, 0) - 400);
    t = await szene(['Healing Melody'], 'Support Magic', 3, inSupport);
    t.hero(0, 0).hp = 100; await t.play(0, 'Healing Melody', { hero: 0, noGrant: true });
    R.check(`Healing Melody mit Support Magic 3 (${wo}): +200`, t.hp(0, 0) === 300, t.hp(0, 0) - 100);
    t = await szene(['Instant Cryo Stasis', H.INERT.filler], 'Decay Magic', 2, inSupport);
    t.put(1, 0, 0, H.INERT.big); t.targetFn = (v) => [v.find(x => x.type === 'equip').id];
    await t.play(0, 'Instant Cryo Stasis', { hero: 0, noGrant: true });
    const r2 = await t.play(0, H.INERT.filler, { hero: 0, noGrant: true, keepActions: true });
    R.check(`Instant Cryo Stasis mit Decay Magic 2 (${wo}): Zusatzaktion`, r2 === true, r2);
  }
  R.finish();
})();
