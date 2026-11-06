// ═══════════════════════════════════════════
//  CARD EFFECT: "Experimental Potion"
//  Potion (Normal) — Textfassung des Users (Abweichung von der DB):
//
//  „Choose a target you control and inflict 1 Stack of Poison to it. All
//   Poison damage the target would receive for the rest of the game is
//   applied as healing instead, and any Poison that would reduce its max
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
//    fuer Kreaturen).
//  • „any Poison that would reduce its max HP": NUR Gift — das ist Paraseeds
//    Giftschaden, der sonst die Obergrenze des Wirts frisst. Weil der Gifttick des
//    markierten Helden zu Heilung wird, feuert die Engine dabei den Haken
//    `onPoisonHealedInstead`; Paraseed erhoeht dann die Max HP um den Betrag statt
//    sie zu senken. Andere Max-HP-Senkungen (Toughness, Gobbo, Rha-Bi …) bleiben
//    unberuehrt.
// ═══════════════════════════════════════════

const CARD_NAME = 'Experimental Potion';

module.exports = {
  isPotion: true,

  canActivate(gs, playerIdx, engine) {
    return this.getValidTargets(gs, playerIdx, engine).length > 0;
  },

  getValidTargets(gs, playerIdx, engine) {
    if (!engine) return [];
    // W28a (Al, 21.10.2026: „'you control' = aktuelle Kontrolle, nicht Besitzer"): „a target you control" gilt fuer Helden wie fuer Kreaturen nach Kontrolle
    // (`getControlledHeroTargets`: abgegebener eigener Held nein, uebernommener Gegnerheld ja). Ein TEMPORAER uebernommener Gegnerheld (Charme Lv3: „unaffected by
    // other cards and effects") nimmt das Gift nicht an. W31a (Al, 22.10.2026: „temporäre Heroes sind mögliche Ziele, auch wenn der Schaden verpufft"): er bleibt trotzdem
    // wählbares Ziel; das Gift verpufft (Kosten bezahlt).
    const helden = engine.getControlledHeroTargets(playerIdx);
    return [...helden, ...engine.getCreatureTargets(playerIdx)];
  },

  targetingConfig: {
    description: 'Choose a target you control: Poison it (1 stack). Poison damage heals it and Poison that would reduce its max HP raises it instead — for the rest of the game.',
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
      // W31a (Al, 22.10.2026): ein temporaer uebernommener (Charme-)Gegnerheld ist gueltiges Ziel, die Wirkung verpufft aber vollstaendig (Charme: „unaffected") — auch die Dauermarke.
      if (!engine._charmBlocksFrom(hero, pi)) hero._experimentalPotion = true;
      await engine.addHeroStatus(target.owner, target.heroIdx, 'poisoned', { addStacks: 1, appliedBy: pi });
    } else {
      const inst = target.cardInstance || engine.cardInstances.find(c =>
        c.owner === target.owner && c.zone === 'support'
        && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx);
      if (!inst || inst.zone !== 'support') return;
      // W71b (Al, 25.10.2026): Dauermarke + Gift sind EIN Effekt auf die Kreatur — Schutzfenster (Cool Rescuer Monia & Co.) VOR der Marke; negiert = verbraucht, nichts geschieht.
      if (!(await engine.kreaturBetroffen(inst, 'status', CARD_NAME, { sourceOwner: pi, statusName: 'poisoned' }))) return;
      if (!inst.counters) inst.counters = {};
      inst.counters.experimentalPotion = true;
      await engine.applyCreatureStatus(inst, 'poisoned', {
        stacks: 1, addStacks: true, sourceOwner: pi, source: CARD_NAME, _skipAffectedWindow: true,
      });
    }

    engine.log('experimental_potion', { target: target.cardName, by: pi });
    engine.sync();
  },

  cpuMeta: { appliesStatuses: ['poisoned'] },
};
