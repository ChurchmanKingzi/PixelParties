// ═══════════════════════════════════════════
//  CARD EFFECT: "Poisoned Meat"
//  Artifact (Normal, Cost 2)
//
//  „Choose a Creature any player controls. Deal 20 damage to it and
//   inflict 1 Stack of Poison to it."   (neuer Text, Al 29.8. — in
//   cards.json v615 nachgezogen; vorher „Poison it for the rest of
//   the game".)
//
//  ── Umsetzung ─────────────────────────────────────────────────
//  · Targeting-Artefakt: Zielliste = alle Kreaturen BEIDER Seiten
//    ueber `getCreatureTargets`, minus Targeting-Immunitaet (deckt
//    auch den Erstzug-Schutz) und minus die vom Gegner-Boris
//    verborgene Seite (Capture-Net-Muster). Great Wall of Deri greift
//    NICHT — sie schuetzt nur vor Nicht-Schadens-Effekten.
//  · Reihenfolge wie im Text: erst 20 Schaden (Typ 'artifact',
//    ueber `actionDealCreatureDamage`, damit Reduktionen, Immunitaeten
//    und Tod normal laufen), dann — falls die Kreatur noch liegt —
//    1 Stack Poison ueber `actionApplyCreaturePoison` (zentral:
//    Immunitaet, beforeCreatureAffected, Stack-Buchhaltung).
//  · Auftritt `poison_skulls` (v615, Als Vorgabe): Totenschaedel
//    kreisen ueber der Kreatur und verblassen; Klang `poison`.
// ═══════════════════════════════════════════

const CARD_NAME = 'Poisoned Meat';
const DAMAGE = 20;
const ANIM = 'poison_skulls';

function meatTargets(engine, pi) {
  const oppIdx = pi === 0 ? 1 : 0;
  const sides = engine.borisHidesOpponentSide?.(pi) ? [pi] : [pi, oppIdx];
  const out = [];
  for (const side of sides) {
    for (const t of (engine.getCreatureTargets(side) || [])) {
      const inst = t.cardInstance;
      if (!inst) continue;
      if (engine.isCreatureImmune(inst, 'targeting_immune')) continue;
      out.push(t);
    }
  }
  return out;
}

module.exports = {
  isTargetingArtifact: true,
  requiresTarget: true,
  animationType: 'none',

  canActivate(gs, pi, engine) {
    const eng = engine || gs._engineRef;
    return !!eng && meatTargets(eng, pi).length > 0;
  },
  getValidTargets(gs, pi, engine) {
    const eng = engine || gs._engineRef;
    return eng ? meatTargets(eng, pi) : [];
  },
  targetingConfig: {
    description: `Choose a Creature any player controls: deal ${DAMAGE} damage to it and inflict 1 Stack of Poison.`,
    confirmLabel: '💀 Feed it!',
    confirmClass: 'btn-danger',
    cancellable: true,
    exclusiveTypes: true,
    maxPerType: { equip: 1 },
  },
  validateSelection: (selectedIds) => !!selectedIds && selectedIds.length === 1,

  async resolve(engine, pi, selectedIds, validTargets) {
    if (!selectedIds || selectedIds.length === 0) return { aborted: true };
    const target = validTargets.find(t => t.id === selectedIds[0]);
    if (!target) return { aborted: true };
    const inst = (target.cardInstance && engine.cardInstances.find(c => c.id === target.cardInstance.id))
      || engine.cardInstances.find(c => c.zone === 'support'
        && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx && c.name === target.cardName);
    if (!inst || inst.zone !== 'support') return { aborted: true };
    const gs = engine.gs;
    const ps = gs.players[pi];

    engine._broadcastEvent('play_zone_animation', {
      type: ANIM, owner: inst.controller ?? inst.owner, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
    });
    await engine._delay(500);

    const source = { name: CARD_NAME, owner: pi, heroIdx: -1 };
    await engine.actionDealCreatureDamage(source, inst, DAMAGE, 'artifact',
      { sourceOwner: pi, canBeNegated: true });

    let poisoned = false;
    if (inst.zone === 'support' && !inst._deathResolved && (inst.counters?.currentHp ?? 1) > 0) {
      const before = inst.counters?.poisonStacks || 0;
      await engine.actionApplyCreaturePoison(source, inst);
      poisoned = (inst.counters?.poisonStacks || 0) > before;
    }

    engine.log('poisoned_meat', {
      player: ps?.username, target: inst.name, damage: DAMAGE, poisoned,
    });
    engine.sync();
    return true;
  },
};
