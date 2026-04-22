// ═══════════════════════════════════════════
//  CARD EFFECT: "Pet Snake"
//  Creature (Summoning Magic Lv0) — 10 HP
//
//  Two independent features:
//
//  [A] Alt summon from hand
//      When any of your Heroes has the Poisoned
//      status and the once-per-turn token
//      `pet-snake-alt:<pi>` is unclaimed, this
//      creature plays as an additional Action
//      (no Main/Action-Phase cost). The onPlay
//      hook prompts for which poisoned Hero to
//      cure as the payment, then claims HOPT.
//      Limited to 1 alt-summon per turn per
//      player total (across all copies of Pet
//      Snake in hand).
//
//      If Stinky Stables is in play, poison
//      removal is engine-blocked, so the alt
//      summon also fails gracefully (the Area
//      gate takes precedence).
//
//  [B] On-board active effect
//      Once per turn per copy, inflict 1 Stack
//      of Poison onto a Poisoned target (hero
//      or creature, any side). Standard creature
//      HOPT key — managed by the engine.
// ═══════════════════════════════════════════

module.exports = {
  // [A] Alt summon gate.
  inherentAction: (gs, pi, _heroIdx, engine) => {
    if (gs.hoptUsed?.[`pet-snake-alt:${pi}`] === gs.turn) return false;
    const ps = gs.players[pi];
    if (!ps) return false;
    for (const h of (ps.heroes || [])) {
      if (h?.name && h.hp > 0 && h.statuses?.poisoned) return true;
    }
    return false;
  },

  // [B] On-board active effect.
  creatureEffect: true,
  canActivateCreatureEffect() { return true; },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;

    // Every Poisoned target on the board, either side.
    const targets = [];
    for (let p = 0; p < 2; p++) {
      const ps = gs.players[p];
      if (!ps) continue;
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const h = ps.heroes[hi];
        if (!h?.name || h.hp <= 0) continue;
        if (!h.statuses?.poisoned) continue;
        targets.push({
          id: `hero-${p}-${hi}`, type: 'hero',
          owner: p, heroIdx: hi, cardName: h.name,
        });
      }
    }
    for (const inst of engine.cardInstances) {
      if (inst.zone !== 'support' || inst.faceDown) continue;
      if (!inst.counters?.poisoned) continue;
      targets.push({
        id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
        type: 'equip',
        owner: inst.owner, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
        cardName: inst.name, cardInstance: inst,
      });
    }

    if (targets.length === 0) return false;

    const picked = await engine.promptEffectTarget(pi, targets, {
      title: 'Pet Snake',
      description: 'Inflict 1 Stack of Poison to a Poisoned target.',
      confirmLabel: '🐍 Poison!',
      confirmClass: 'btn-danger',
      cancellable: true,
      maxTotal: 1,
    });
    if (!picked || picked.length === 0) return false;
    const chosen = targets.find(t => t.id === picked[0]);
    if (!chosen) return false;

    engine._broadcastEvent('play_zone_animation', {
      type: 'poison_pollen_rain',
      owner: chosen.owner,
      heroIdx: chosen.heroIdx,
      zoneSlot: chosen.type === 'hero' ? -1 : chosen.slotIdx,
    });
    await engine._delay(400);

    if (chosen.type === 'hero') {
      await engine.addHeroStatus(chosen.owner, chosen.heroIdx, 'poisoned', {
        addStacks: 1, appliedBy: pi,
      });
    } else if (chosen.cardInstance) {
      await engine.actionApplyCreaturePoison(
        { name: 'Pet Snake', owner: pi }, chosen.cardInstance,
      );
    }
    engine.sync();
    return true;
  },

  hooks: {
    // [A] continued — pay the poison-cleanse cost when the alt-summon fires.
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;

      // Only fire the alt path on the fresh cast from hand. Skip if:
      //   • HOPT already claimed this turn.
      //   • No own hero is poisoned (could've changed mid-chain).
      if (gs.hoptUsed?.[`pet-snake-alt:${pi}`] === gs.turn) return;

      const poisonedHeroes = [];
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const h = ps.heroes[hi];
        if (!h?.name || h.hp <= 0) continue;
        if (!h.statuses?.poisoned) continue;
        poisonedHeroes.push({
          id: `hero-${pi}-${hi}`, type: 'hero',
          owner: pi, heroIdx: hi, cardName: h.name,
        });
      }
      if (poisonedHeroes.length === 0) return;

      const picked = await engine.promptEffectTarget(pi, poisonedHeroes, {
        title: 'Pet Snake',
        description: 'Heal a Poisoned Hero to complete this free summon.',
        confirmLabel: '🐍 Cure & Summon!',
        confirmClass: 'btn-success',
        cancellable: false,
        maxTotal: 1,
      });
      if (!picked || picked.length === 0) return;
      const chosen = poisonedHeroes.find(t => t.id === picked[0]);
      if (!chosen) return;

      engine._broadcastEvent('play_zone_animation', {
        type: 'heal_sparkle', owner: pi, heroIdx: chosen.heroIdx, zoneSlot: -1,
      });
      await engine._delay(400);

      await engine.removeHeroStatus(pi, chosen.heroIdx, 'poisoned');
      engine.claimHOPT('pet-snake-alt', pi);

      engine.log('pet_snake_alt_summon', {
        player: ps.username,
        cured: ps.heroes?.[chosen.heroIdx]?.name,
      });
      engine.sync();
    },
  },
};
