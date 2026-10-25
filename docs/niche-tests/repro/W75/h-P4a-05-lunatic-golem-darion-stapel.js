'use strict';
// W75 · Audit P4a · Lunatic Golem × Darion (geteilte Equip-Zone)
// Kartentext: „This Creature gains the following effects depending on the number of different "Lunatic Cycle" cards on the board:
//   1+: You may choose a target and deal 100 damage times the number of different "Lunatic Cycle" cards on the board to it. … 2+: This Creature is immune to negative status effects. …"
// Darion: „All Artifacts equipped to this Hero share 1 Support Zone."
// Erwartet: alle fuenf Lunatic Cycle in EINEM Darion-Stapel zaehlen als fuenf verschiedene Karten (Schaden 100 x 5 bzw. Stufen 1-5). Faellt eine nach der anderen aus dem Stapel (Abwurf),
//   verlaufen Zaehlung und Immunitaet (ab 2 Karten) exakt wie bei fuenf einzeln liegenden Karten.
// Aufruf: node docs/niche-tests/repro/W75/h-P4a-05-lunatic-golem-darion-stapel.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler, G = 'Lunatic Golem';
const { countDistinctLunaticCycle } = require('../../../../cards/effects/_lunatic-shared.js');
const CYC = ['Lunatic Cycle - New Moon', 'Lunatic Cycle - Crescent Moon', 'Lunatic Cycle - Half Moon', 'Lunatic Cycle - Gibbous Moon', 'Lunatic Cycle - Full Moon'];

async function verlauf(stapelModus) {
  const heroes = stapelModus ? [['Tushu, the Knowledge Keeper', D, null], [F, null, null]] : [['Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], [F, null, null]];
  const t = await H.fresh({ active: 0, heroes, hand: [[F], [F]], gold: 500, deck: [Array(15).fill(F), Array(15).fill(F)] });
  const golem = t.put(0, 0, 0, G); golem.turnPlayed = 1;
  const insts = [];
  if (stapelModus) {
    const ps = t.gs.players[0]; ps.supportZones[1][0] = [];
    for (const n of CYC) { ps.supportZones[1][0].push(n); const i = t.engine._trackCard(n, 0, 'support', 1, 0); i.turnPlayed = 1; insts.push(i); }
  } else {
    // 5 Karten auf 2 Helden verteilt (3 + 2), Tushu hat die Golem-Zone 0 schon belegt
    const plaetze = [[1, 0], [1, 1], [1, 2], [2, 0], [2, 1]];
    CYC.forEach((n, k) => insts.push(t.put(0, plaetze[k][0], plaetze[k][1], n)));
  }
  await t.turnStart(0);   // `reevalImmunity` am Zugbeginn
  const proto = [];
  const lies = () => ({ n: countDistinctLunaticCycle(t.engine), immun: !!(golem.counters.buffs && golem.counters.buffs.negative_status_immune) });
  proto.push(lies());
  for (const i of [insts[2], insts[0], insts[4], insts[1]]) {   // Half, New, Full, Crescent
    await t.run(() => t.engine.sendBoardCardToDiscard(i, { source: 'test' }));
    proto.push(lies());
  }
  return { t, proto };
}
(async () => {
  const R = H.runner();
  R.section('Verlauf (Anzahl, Immunitaet) nach jedem Abwurf: Stapel gegen einzeln liegende Karten');
  const a = await verlauf(true), b = await verlauf(false);
  R.note('stapel', JSON.stringify(a.proto)); R.note('einzeln', JSON.stringify(b.proto));
  R.check('Start: fuenf verschiedene Lunatic Cycle im Stapel', a.proto[0].n === 5 && a.proto[0].immun === true, a.proto[0]);
  R.check('Zaehlung nach jedem Abwurf: 5,4,3,2,1', JSON.stringify(a.proto.map(p => p.n)) === JSON.stringify([5, 4, 3, 2, 1]), a.proto.map(p => p.n));
  R.check('Immunitaet verlaeuft wie bei einzeln liegenden Karten', JSON.stringify(a.proto) === JSON.stringify(b.proto), [a.proto, b.proto]);
  R.check('Ab einer Karte ohne Immunitaet (n=1)', a.proto[4].immun === false, a.proto[4]);
  R.check('Stapel: nur die Namen der uebrigen Karten bleiben (Gibbous)', JSON.stringify(a.t.gs.players[0].supportZones[1][0]) === JSON.stringify([CYC[3]]), a.t.gs.players[0].supportZones[1][0]);
  R.check('Sauber', a.t.errors.length === 0 && a.t.audit().length === 0 && b.t.errors.length === 0, [a.t.errors, a.t.audit(), b.t.errors]);

  R.section('Aktiver Effekt: 100 x 5 Schaden bzw. Sofort-Besiegen bei fuenf verschiedenen Karten im Stapel');
  {
    const heroes = [['Tushu, the Knowledge Keeper', D, null], [F, null, null]];
    const t = await H.fresh({ active: 0, heroes, hand: [[F], [F]], gold: 500, deck: [Array(15).fill(F), Array(15).fill(F)] });
    const golem = t.put(0, 0, 0, G); golem.turnPlayed = 1;
    const ps = t.gs.players[0]; ps.supportZones[1][0] = [];
    for (const n of CYC) { ps.supportZones[1][0].push(n); const i = t.engine._trackCard(n, 0, 'support', 1, 0); i.turnPlayed = 1; }
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    t.phase(2);
    const hp0 = t.hp(1, 0);
    const res = await t.activateCreature(0, 0, 0);
    await t.drain();
    R.note('lauf', JSON.stringify({ res, hp0, hp1: t.hp(1, 0) }));
    R.check('Fuenf verschiedene Karten im Stapel = Stufe 5: der Zielheld ist besiegt', t.hp(1, 0) <= 0, t.hp(1, 0));
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
