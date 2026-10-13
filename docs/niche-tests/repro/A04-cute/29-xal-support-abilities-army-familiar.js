'use strict';
// A04-cute-29 (B) · Army of the Cute und Cute Familiar zählen Xals Ability-Stapel in den Support Zones nicht (Klasse S01-20)
//
// Xal, the Animated Armor: „You may place Abilities into the Support Zones of this Hero." – diese Stapel zählen für den Level-Vertrag (`heroMeetsLevelReq`, `effectiveSchoolLevelForCaster`).
// Army of the Cute: „Choose "Cute" Creatures … whose combined levels do not exceed 1/2/3" (Stufe = Summoning Magic des Wirkers).
// Cute Familiar: „You may once per turn make a Hero you control with at least Charme 2 perform an additional Action …"; „… free Support Zone of a Hero you control with at least Charme 2".
// Aufbau wie S01-20: Xal als Held 0 von Sitz 0, die Abilities liegen als Stapel in seiner ersten Support Zone (Ability-Zonen leer). Vergleich: dieselben Karten in der Ability-Zone.
// Erwartet: Army bietet Cute Phoenix (Level 3) an; ein Familiar-Tod schickt den Familiar am Zugende zu Xal zurück.
// Beobachtet (✗): Army rechnet cap = 1 (`levelBudget` → `countAbilitiesForSchool(…, abilityZones[heroIdx])`, army-of-the-cute.js:51-54); Familiar findet keinen Charme-2-Held (`countCharme` liest nur `abilityZones`, cute-familiar.js:48).
const H = require('../../lib/h.js');
const XAL = 'Xal, the Animated Armor';
async function szene(hand, schule, inSupport, extra = {}) {
  const t0 = await H.fresh({ hand: [[], []] });
  const t = await H.fresh(Object.assign({ heroes: [[XAL, t0.gs.players[0].heroes[1].name, t0.gs.players[0].heroes[2].name], t0.gs.players[1].heroes.map(h => h.name)],
    hand: [hand, []], deck: [Array(6).fill(H.INERT.creature), Array(6).fill(H.INERT.creature)],
    abilities: { 0: { 0: [inSupport ? [] : Array(3).fill(schule), [], []] } } }, extra));
  if (inSupport) { t.gs.players[0].supportZones[0][0] = Array(3).fill(schule); for (let k = 0; k < 3; k++) t.engine._trackCard(schule, 0, 'support', 0, 0); }
  return t;
}
(async () => {
  const R = H.runner();
  for (const inSupport of [false, true]) {
    const wo = inSupport ? 'in Xals Support Zone' : 'in der Ability-Zone';
    const t = await szene(['Army of the Cute', 'Cute Phoenix', 'Cute Bunny'], 'Summoning Magic', inSupport);
    let gal = null;
    t.script.push({ match: d => d.type === 'cardGalleryMulti', answer: (d) => { gal = d; return { selectedCards: [], selectedIndices: [] }; } });
    await t.play(0, 'Army of the Cute', { hero: 0, noGrant: true });
    R.check(`Army mit Summoning Magic 3 ${wo}: Budget 3`, gal && gal.maxBudget === 3, gal && { maxBudget: gal.maxBudget });
  }
  for (const inSupport of [false, true]) {
    const wo = inSupport ? 'in Xals Support Zone' : 'in der Ability-Zone';
    const t = await szene([], 'Charme', inSupport);
    const f = t.put(0, 1, 0, 'Cute Familiar'); f.turnPlayed = 0;
    t.gs.activePlayer = 0; t.phase(2);
    const r = await t.activateCreature(0, 1, 0);
    R.check(`Familiar mit Charme 3 ${wo}: Zusatzaktions-Effekt aktivierbar`, r !== false, { r });
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
