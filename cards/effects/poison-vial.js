// ═══════════════════════════════════════════
//  CARD EFFECT: "Poison Vial"
//  Potion — Choose a target and inflict 2 Stacks
//  of Poison to it. Goes to deleted pile after use.
//  ★ Spielgestalter-Entscheidung 16.11.2026: gift-immune Ziele (Helden UND Kreaturen, `poison_immune`)
//  bleiben WÄHLBAR — das Gift fizzelt einfach (der Trank wird normal verbraucht, kein Gift, `status_blocked`-Log
//  wie sonst bei Immunität). Nur die Zielregeln (Stealth, Taunt, Erstzug-Schutz …) nehmen Ziele aus der Liste.
// ═══════════════════════════════════════════

const { STATUS_EFFECTS, hasCardType } = require('./_hooks');

module.exports = {
  isPotion: true,

  canActivate(gs, playerIdx) {
    return this.getValidTargets(gs, playerIdx).length > 0;
  },

  getValidTargets(gs, playerIdx, engine) {
    const targets = [];
    const pvCardDB = engine ? engine._getCardDB() : {};
    for (let pi = 0; pi < gs.players.length; pi++) {
      const ps = gs.players[pi];
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        // Der HELD ist nur als Ziel waehlbar, solange er lebt. Gift-Immunitaet nimmt ihn NICHT aus der Liste (Spielgestalter-Entscheidung
        // 16.11.2026): `addHeroStatus` weist das Gift ab (`status_blocked`), der Trank ist trotzdem gespielt …
        if (hero?.name && hero.hp > 0) {
          targets.push({
            id: `hero-${pi}-${hi}`,
            type: 'hero',
            owner: pi,
            heroIdx: hi,
            cardName: hero.name,
          });
        }
        // … seine Kreaturen aber unabhaengig von ihm (Acid Vial, Healing Potion & Co.: Kreaturen bleiben nach dem Tod ihres Helden auf dem Brett
        // und gelten weiter als Ziele) — vorher stand hier ein `continue` fuer den ganzen Helden, das auch seine Kreaturen aussperrte.
        // Creatures in support zones
        for (let si = 0; si < (ps.supportZones[hi] || []).length; si++) {
          const slot = (ps.supportZones[hi] || [])[si] || [];
          if (slot.length === 0) continue;
          const pvCD = pvCardDB[slot[0]];
          if (!pvCD || !hasCardType(pvCD, 'Creature')) continue;
          targets.push({
            id: `equip-${pi}-${hi}-${si}`,
            type: 'equip',
            owner: pi,
            heroIdx: hi,
            slotIdx: si,
            cardName: slot[0],
          });
        }
      }
    }
    return targets;
  },

  targetingConfig: {
    description: 'Select a target to Poison (2 stacks).',
    confirmLabel: '☠️ Poison!',
    confirmClass: 'btn-danger',
    cancellable: true,
    exclusiveTypes: true,
    maxPerType: { hero: 1, equip: 1 },
  },

  validateSelection(selectedIds, validTargets) {
    return selectedIds && selectedIds.length === 1;
  },

  animationType: 'poison_vial',

  async resolve(engine, pi, selectedIds, validTargets) {
    if (!selectedIds || selectedIds.length === 0) return;
    const target = validTargets.find(t => t.id === selectedIds[0]);
    if (!target) return;

    // Spielgestalter-Entscheidung 16.11.2026: ein gift-immunes Ziel ist waehlbar, das Gift fizzelt (kein Stapel, kein `poison_applied`).
    let applied = false;
    if (target.type === 'hero') {
      const hero = engine.gs.players[target.owner]?.heroes?.[target.heroIdx];
      const vorher = hero?.statuses?.poisoned?.stacks || 0;
      // Apply 2 stacks of poison (`addHeroStatus` weist es bei Gift-Immunitaet, Schilden usw. ab und loggt `status_blocked`).
      await engine.addHeroStatus(target.owner, target.heroIdx, 'poisoned', { addStacks: 2, appliedBy: pi });
      applied = (hero?.statuses?.poisoned?.stacks || 0) > vorher;
    } else if (target.type === 'equip') {
      const inst = engine.cardInstances.find(c =>
        c.owner === target.owner && c.zone === 'support' &&
        c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
      );
      if (inst) {
        // canApplyCreatureStatus enforces every absolute-immunity gate
        // (Cardinal Beast / Golden Wings / face-down / Defending the Gate
        // shield / Monia shield) along with the per-status `*_immune`
        // counter — no need to inline-check `poison_immune` separately.
        // Note: the parent potion-resolution framework plays the
        // `potion_resolved` animation regardless of whether the status
        // actually applies, so a fizzle still gives the player visual
        // feedback that the throw landed.
        applied = await engine.applyCreatureStatus(inst, 'poisoned', {
          stacks: 2, addStacks: true,
          sourceOwner: pi,
          source: 'Poison Vial',
        });
        if (!applied) engine.log('status_blocked', { target: inst.name, status: 'poisoned', reason: 'immune' });
      }
    }

    // Animation is handled by the potion_resolved event
    if (applied) engine.log('poison_applied', { target: target.cardName, stacks: 2, by: 'Poison Vial' });
    engine.sync();
  },

  cpuMeta: {
    // Welche Statuszustaende legt diese Karte an? Deckneutraler
    // Vertrag — Formen, die Zaehler aus einem Status ziehen
    // (Flamebathed/Burn, Swampborne/Poison), fragen darueber ab,
    // ob ein passender Applier zur Hand ist. Kartentext: "Choose a target and inflict 2 Stacks of Poison to it."
    appliesStatuses: ['poisoned'],
  },
};
