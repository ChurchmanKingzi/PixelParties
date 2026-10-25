'use strict';
// W75 · Audit P5 · Darion × Toras, Master of all Weapons / Taio, the Sun Fencer — Equips wandern aus dem Darion-Stapel zu einem anderen eigenen Helden (Umhaengen) und wieder weg (Ablage): die Boni folgen genau der bewegten Karte.
// Kartentexte: Toras „+40 ATK for each Artifact with a different name equipped to this Hero."; Taio „Taio's Attack stat is increased by 20 for every Artifact equipped to him."; Darion „All Artifacts equipped to this Hero share 1 Support Zone."
// Erwartet: Darion (Held 1) traegt Club / Crown / Blade (regulaer gespielt); Blade und danach Crown wandern per `fuehreUmhaengenAus` (der Weg von Slippery Fridge / Inheritance Ceremony) zu Held 0: dessen ATK waechst um 40 (Toras) bzw. 20 (Taio) je Karte (+ ATK-Bonus der Karte selbst), Darions ATK sinkt nur um den Bonus der gehenden Karte; der Rest-Stapel bleibt in EINEM Platz; wird Blade bei Held 0 abgelegt, gehen die Boni wieder weg.
// Aufruf: node docs/niche-tests/repro/W75/h-P5-08-toras-taio-umhaengen-aus-dem-stapel.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const { fuehreUmhaengenAus } = require('../../../../cards/effects/_equip-shared.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler;
const EQ = ['Club of Gobbo', 'Cute Crown', 'Blade of the Frostbringer'];
(async () => {
  const R = H.runner();
  for (const [held, je] of [['Toras, Master of all Weapons', 40], ['Taio, the Sun Fencer', 20]]) {
    R.section(held);
    const t = await H.fresh({ active: 0, heroes: [[held, D, null], [F, null, null]], hand: [[F, ...EQ], [F]], gold: 500, deck: [Array(15).fill(F), Array(15).fill(F)] });
    for (const n of EQ) await t.play(0, n, { hero: 1, slot: 2 });
    const atk = (hi) => t.gs.players[0].heroes[hi].atk;
    const zoneD = () => t.gs.players[0].supportZones[1];
    const insts = t.inst(c => c.zone === 'support' && c.owner === 0 && c.heroIdx === 1);
    const blade = insts.find(i => i.name === EQ[2]), crown = insts.find(i => i.name === EQ[1]);
    R.check('Darion traegt alle drei im selben Platz', zoneD().flat().length === 3 && zoneD().filter(z => z.length).length === 1, zoneD());
    const a0 = atk(0), d0 = atk(1);

    const umhaengen = (inst, destSlot) => t.run(() => fuehreUmhaengenAus(t.engine, [{ inst, owner: 0, srcHeroIdx: 1, srcSlot: inst.zoneSlot, destHeroIdx: 0, destSlot }], { anleger: 0, quelle: 'Test' }));
    await umhaengen(blade, 0);
    const bladeBonus = d0 - atk(1);
    R.check('Blade umgehaengt', t.gs.players[0].supportZones[0][0].includes(EQ[2]), t.gs.players[0].supportZones[0]);
    R.check(`Held 0 gewinnt ${je} + Bonus der Klinge (${bladeBonus})`, atk(0) - a0 === je + bladeBonus, [a0, atk(0), bladeBonus]);
    R.check('Darion verliert nur den Bonus der gehenden Karte; Rest-Stapel bleibt in einem Platz', zoneD().flat().length === 2 && zoneD().filter(z => z.length).length === 1, [atk(1), zoneD()]);

    const a1 = atk(0), d1 = atk(1);
    await umhaengen(crown, 1);
    R.check(`Crown umgehaengt: Held 0 gewinnt weitere ${je}, Darion aendert sich nicht (Crown ohne ATK)`, t.gs.players[0].supportZones[0][1].includes(EQ[1]) && atk(0) - a1 === je && atk(1) === d1, [a1, atk(0), d1, atk(1)]);

    const a2 = atk(0);
    await t.run(() => t.engine.sendBoardCardToDiscard(blade, {}));
    R.check(`Blade bei Held 0 abgelegt: ${je} + Klingen-Bonus gehen wieder weg`, a2 - atk(0) === je + bladeBonus, [a2, atk(0)]);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})();
