// ═══════════════════════════════════════════
//  CARD EFFECT: "Mummy Maker Machine"
//  Creature (Surprise) — Summoning Magic Lv1
//
//  Activate when the opponent activates a
//  Hero's active effect.
//  Place a Mummy Token into a free Support
//  Zone of an opponent's Hero that has no
//  Mummy Tokens yet. If placed on the Hero
//  that used the effect, negate that effect.
//
//  While in Support Zone: once per turn, if
//  the Hero's Surprise Zone is empty, may
//  move itself back face-down into that
//  Surprise Zone (re-set).
// ═══════════════════════════════════════════

module.exports = {
  isSurprise: true,
  surpriseHeroEffectTrigger: true,

  canTelekinesisActivate(engine, ownerIdx) {
    const oppIdx = ownerIdx === 0 ? 1 : 0;
    const oppPs = engine.gs.players[oppIdx];
    if (!oppPs) return false;
    for (let hi = 0; hi < (oppPs.heroes || []).length; hi++) {
      const hero = oppPs.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      const supportZones = oppPs.supportZones[hi] || [];
      if (supportZones.some(slot => (slot || []).includes('Mummy Token'))) continue;
      if (!supportZones.slice(0, 3).some(slot => (slot || []).length === 0)) continue;
      return true;
    }
    return false;
  },

  /**
   * Trigger condition: opponent activates a Hero's active effect,
   * AND there is at least 1 opponent hero with a free Support Zone
   * and no Mummy Token.
   */
  surpriseTrigger: (gs, ownerIdx, heroIdx, heroEffectInfo, engine) => {
    // Only trigger on opponent hero effects
    if (heroEffectInfo.activatorIdx === ownerIdx) return false;
    // Check that at least 1 eligible target exists
    const actPs = gs.players[heroEffectInfo.activatorIdx];
    if (!actPs) return false;
    for (let hi = 0; hi < (actPs.heroes || []).length; hi++) {
      const hero = actPs.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      const supportZones = actPs.supportZones[hi] || [];
      const hasMummy = supportZones.some(slot => (slot || []).includes('Mummy Token'));
      if (hasMummy) continue;
      const hasFreeSlot = supportZones.slice(0, 3).some(slot => (slot || []).length === 0);
      if (hasFreeSlot) return true;
    }
    return false;
  },

  /**
   * On activation: place a Mummy Token on an opponent's Hero.
   * If placed on the Hero that used the effect, return { negateEffect: true }.
   */
  onSurpriseActivate: async (ctx, sourceInfo) => {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const actIdx = sourceInfo.telekinesis ? (pi === 0 ? 1 : 0) : sourceInfo.activatorIdx;
    const actPs = gs.players[actIdx];

    // Build targets: opponent heroes with free support zone and no Mummy Token
    const targets = [];
    for (let hi = 0; hi < (actPs.heroes || []).length; hi++) {
      const hero = actPs.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      const supportZones = actPs.supportZones[hi] || [];
      const hasMummy = supportZones.some(slot => (slot || []).includes('Mummy Token'));
      if (hasMummy) continue;
      const hasFreeSlot = supportZones.slice(0, 3).some(slot => (slot || []).length === 0);
      if (!hasFreeSlot) continue;
      targets.push({
        id: `hero-${actIdx}-${hi}`,
        type: 'hero',
        owner: actIdx,
        heroIdx: hi,
        cardName: hero.name,
      });
    }

    if (targets.length === 0) return null;

    let targetHeroIdx;
    if (targets.length === 1) {
      targetHeroIdx = targets[0].heroIdx;
    } else {
      const selectedIds = await engine.promptEffectTarget(pi, targets, {
        title: 'Mummy Maker Machine',
        description: 'Choose a Hero to place a Mummy Token on.',
        confirmLabel: '👻 Place Token!',
        confirmClass: 'btn-danger',
        cancellable: false,
        maxTotal: 1,
      });
      if (!selectedIds || selectedIds.length === 0) return null;
      const sel = targets.find(t => t.id === selectedIds[0]);
      if (!sel) return null;
      targetHeroIdx = sel.heroIdx;
    }

    // Find first free support slot
    const supportZones = actPs.supportZones[targetHeroIdx] || [[], [], []];
    let freeSlot = -1;
    for (let si = 0; si < 3; si++) {
      if ((supportZones[si] || []).length === 0) { freeSlot = si; break; }
    }
    if (freeSlot < 0) return null;

    // Mummy wrap animation on the target hero
    engine._broadcastEvent('play_zone_animation', {
      type: 'mummy_wrap', owner: actIdx,
      heroIdx: targetHeroIdx, zoneSlot: -1,
    });
    await engine._delay(500);

    // Place the Mummy Token
    if (!actPs.supportZones[targetHeroIdx]) actPs.supportZones[targetHeroIdx] = [[], [], []];
    if (!actPs.supportZones[targetHeroIdx][freeSlot]) actPs.supportZones[targetHeroIdx][freeSlot] = [];
    actPs.supportZones[targetHeroIdx][freeSlot].push('Mummy Token');

    const inst = engine._trackCard('Mummy Token', actIdx, 'support', targetHeroIdx, freeSlot);

    engine._broadcastEvent('summon_effect', { owner: actIdx, heroIdx: targetHeroIdx, zoneSlot: freeSlot, cardName: 'Mummy Token' });

    const heroName = actPs.heroes[targetHeroIdx]?.name || 'Hero';
    engine.log('token_placed', {
      player: gs.players[pi]?.username, card: 'Mummy Token', hero: heroName,
    });

    await engine.runHooks('onPlay', {
      _onlyCard: inst, playedCard: inst,
      cardName: 'Mummy Token', zone: 'support',
      heroIdx: targetHeroIdx, zoneSlot: freeSlot,
      _skipReactionCheck: true,
    });
    await engine.runHooks('onCardEnterZone', {
      enteringCard: inst, toZone: 'support', toHeroIdx: targetHeroIdx,
      _skipReactionCheck: true,
    });

    engine.sync();
    await engine._delay(125);

    // If placed on the hero that used the effect, negate it
    if (targetHeroIdx === sourceInfo.heroIdx) {
      engine.log('hero_effect_negated', {
        hero: heroName, by: 'Mummy Maker Machine',
        player: gs.players[pi]?.username,
      });
      return { negateEffect: true };
    }

    return null;
  },

  // ── Support Zone creature effect: re-set into Surprise Zone ──
  activeIn: ['support'],
  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    return ctx._engine.canSurpriseCreatureReset(ctx);
  },

  async onCreatureEffect(ctx) {
    return ctx._engine.surpriseCreatureReset(ctx);
  },
};
