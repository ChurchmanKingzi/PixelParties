'use strict';
// S01-20 · Stufen-Zauber zählen die Ability-Stapel in den Support Zones von Xal nicht (Divine Gift of Death, Create Illusion)
// Xal, the Animated Armor: „You may place Abilities into the Support Zones of this Hero." – diese Stapel zählen für den Level-Vertrag (`heroMeetsLevelReq`, `effectiveSchoolLevelForCaster`, _engine.js ~Z. 43140/43290).
// Divine Gift of Death: „Choose up to 1/2/3 defeated Heroes …" (Stufe = Support Magic); Create Illusion: „Choose a level 1/2/3 or lower Creature …" (Stufe = Magic Arts).
// Beide Skripte zählen mit `engine.countAbilitiesForSchool(school, ps.abilityZones[heroIdx])` – ohne die Support-Zonen-Stapel. Aurora Borealis nutzt dagegen `effectiveSchoolLevelForCaster` (korrekt).
// Aufbau: Xal als Held 0 von Sitz 0, Support Magic ×3 bzw. Magic Arts ×3 liegen als Stapel in seiner ersten Support Zone (Ability-Zonen leer). Vergleich: dieselben Karten in der Ability-Zone.
// Erwartet: Death erlaubt bis zu 3 Helden (hier 2 gefallene → beide), Create Illusion bietet Level-3-Kreaturen an.
// Beobachtet: Death: `maxPicks = 0` → der Zauber wird abgebrochen (Karte zurück auf die Hand, kein Held erweckt); Create Illusion: nur Level-1-Kreaturen im Angebot.
const H = require('../../lib/h.js');
async function szene(zauber, schule, inSupport, deck) {
  const t0 = await H.fresh({ hand: [[], []] });
  const t = await H.fresh({ heroes: [['Xal, the Animated Armor', t0.gs.players[0].heroes[1].name, t0.gs.players[0].heroes[2].name], t0.gs.players[1].heroes.map(h => h.name)],
    hand: [[zauber], []], deck: [deck || [], ['ZZ Dummy']],
    abilities: { 0: { 0: [inSupport ? [] : Array(3).fill(schule), [], []] } } });
  if (inSupport) { t.gs.players[0].supportZones[0][0] = Array(3).fill(schule); for (let k = 0; k < 3; k++) t.engine._trackCard(schule, 0, 'support', 0, 0); }
  return t;
}
(async () => {
  const R = H.runner();
  for (const inSupport of [false, true]) {
    const wo = inSupport ? 'in Xals Support Zone' : 'in der Ability-Zone';
    let t = await szene('Divine Gift of Death', 'Support Magic', inSupport);
    t.gs.players[0].heroes[1].hp = 0; t.gs.players[0].heroes[2].hp = 0;
    t.targetFn = (v, cfg) => v.map(x => x.id).slice(0, cfg.maxTotal || 1);
    await t.play(0, 'Divine Gift of Death', { hero: 0, noGrant: true });
    const erweckt = t.gs.players[0].heroes.filter((h, i) => i > 0 && h.hp > 0).length;
    R.check(`Divine Gift of Death mit Support Magic 3 ${wo}: beide gefallenen Helden werden erweckt`, erweckt === 2, { erweckt, hand: t.pile(0, 'hand') });
    t = await szene('Create Illusion', 'Magic Arts', inSupport, ['Elven Archer', 'Field Cannon']);
    let angebot = [];
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Create Illusion', answer: (d) => { angebot = d.cards.map(c => c.name); return { cardName: d.cards[0].name }; } });
    await t.play(0, 'Create Illusion', { hero: 0, noGrant: true });
    R.check(`Create Illusion mit Magic Arts 3 ${wo}: die Level-3-Kreatur (Field Cannon) wird angeboten`, angebot.includes('Field Cannon'), angebot);
  }
  R.finish();
})();
