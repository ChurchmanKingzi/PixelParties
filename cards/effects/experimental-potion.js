// ═══════════════════════════════════════════
//  CARD EFFECT: "Experimental Potion"
//  Potion (Normal) — Textfassung des Users (Abweichung von der DB):
//
//  „Choose a target you control and inflict 1 Stack of Poison to it. All
//   Poison damage the target would receive for the rest of the game is
//   applied as healing instead, and any effects that would reduce its max
//   HP increase its max HP instead."
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  • Ziel: ein eigener Held ODER eine eigene Kreatur (wie Poison Vial, nur
//    eigene Seite). Gift: 1 Stapel (`addHeroStatus` / `applyCreatureStatus`).
//  • „for the rest of the game": ein DAUERHAFTES Zielmerkmal, das auch dann
//    gesetzt wird, wenn das Gift selbst wirkungslos bleibt (Immunitaet) — der
//    Satz haengt nicht am Status. Held: `hero._experimentalPotion`; Kreatur:
//    `counters.experimentalPotion` (verschwindet mit der Kreatur im Spiel).
//  • Giftschaden → Heilung: zentral in der Engine (`actionDealDamage` bei Typ
//    `poison` nach allen Zu-/Abschlaegen; `_processCreatureDamageBatchKern`
//    fuer Kreaturen). Max-HP-Senkung → Erhoehung: `decreaseMaxHp` (Held) und
//    `decreaseCreatureMaxHp` (Kreatur); sie erhoehen ueber `increaseMaxHp`
//    (aktuelle HP steigen wie dort ueblich mit). Paraseeds direkte
//    Obergrenzen-Abzuege treffen nie, weil der Gifttick zuvor zu Heilung wird.
// ═══════════════════════════════════════════

const CARD_NAME = 'Experimental Potion';

module.exports = {
  isPotion: true,

  canActivate(gs, playerIdx, engine) {
    return this.getValidTargets(gs, playerIdx, engine).length > 0;
  },

  getValidTargets(gs, playerIdx, engine) {
    if (!engine) return [];
    return [...engine.getHeroTargets(playerIdx), ...engine.getCreatureTargets(playerIdx)];
  },

  targetingConfig: {
    description: 'Choose a target you control: Poison it (1 stack). Poison damage heals it and max HP reductions raise its max HP — for the rest of the game.',
    confirmLabel: '🧪 Experiment!',
    confirmClass: 'btn-success',
    cancellable: true,
    exclusiveTypes: true,
    maxPerType: { hero: 1, equip: 1 },
  },

  validateSelection(selectedIds) {
    return !!selectedIds && selectedIds.length === 1;
  },

  animationType: 'poison_vial',

  async resolve(engine, pi, selectedIds, validTargets) {
    if (!selectedIds || selectedIds.length === 0) return;
    const target = validTargets.find(t => t.id === selectedIds[0]);
    if (!target) return;

    if (target.type === 'hero') {
      const hero = engine.gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (!hero?.name || hero.hp <= 0) return;
      hero._experimentalPotion = true;
      await engine.addHeroStatus(target.owner, target.heroIdx, 'poisoned', { addStacks: 1, appliedBy: pi });
    } else {
      const inst = target.cardInstance || engine.cardInstances.find(c =>
        c.owner === target.owner && c.zone === 'support'
        && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx);
      if (!inst || inst.zone !== 'support') return;
      if (!inst.counters) inst.counters = {};
      inst.counters.experimentalPotion = true;
      await engine.applyCreatureStatus(inst, 'poisoned', {
        stacks: 1, addStacks: true, sourceOwner: pi, source: CARD_NAME,
      });
    }

    engine.log('experimental_potion', { target: target.cardName, by: pi });
    engine.sync();
  },

  cpuMeta: { appliesStatuses: ['poisoned'] },
};
