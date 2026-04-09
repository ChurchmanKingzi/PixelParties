// ═══════════════════════════════════════════
//  CARD EFFECT: "Mummy Token"
//  Token (Creature) — placed by Mummy Maker Machine
//
//  Replaces the corresponding Hero's active effect.
//  The new effect: once per turn, place a Mummy Token
//  into a free Support Zone of an opponent's Hero
//  that has no Mummy Tokens yet.
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['support'],
  heroEffect: 'Place a Mummy Token into the free Support Zone of a Hero your opponent controls that has no Mummy Tokens in its Support Zones yet.',

  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const oppIdx = pi === 0 ? 1 : 0;
    const oppPs = gs.players[oppIdx];
    if (!oppPs) return false;

    // Need at least 1 opponent hero with free support zone and no Mummy Token
    for (let hi = 0; hi < (oppPs.heroes || []).length; hi++) {
      const hero = oppPs.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      const supportZones = oppPs.supportZones[hi] || [];
      const hasMummy = supportZones.some(slot => (slot || []).includes('Mummy Token'));
      if (hasMummy) continue;
      const hasFreeSlot = supportZones.slice(0, 3).some(slot => (slot || []).length === 0);
      if (hasFreeSlot) return true;
    }
    return false;
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const oppIdx = pi === 0 ? 1 : 0;
    const oppPs = gs.players[oppIdx];

    // Build targets: opponent heroes with free support zone and no Mummy Token
    const targets = [];
    for (let hi = 0; hi < (oppPs.heroes || []).length; hi++) {
      const hero = oppPs.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      const supportZones = oppPs.supportZones[hi] || [];
      const hasMummy = supportZones.some(slot => (slot || []).includes('Mummy Token'));
      if (hasMummy) continue;
      const hasFreeSlot = supportZones.slice(0, 3).some(slot => (slot || []).length === 0);
      if (!hasFreeSlot) continue;
      targets.push({
        id: `hero-${oppIdx}-${hi}`,
        type: 'hero',
        owner: oppIdx,
        heroIdx: hi,
        cardName: hero.name,
      });
    }

    if (targets.length === 0) return false;

    let targetHeroIdx;
    if (targets.length === 1) {
      targetHeroIdx = targets[0].heroIdx;
    } else {
      const selectedIds = await engine.promptEffectTarget(pi, targets, {
        title: 'Mummy Token',
        description: 'Choose a Hero to place a Mummy Token on.',
        confirmLabel: '👻 Place Token!',
        confirmClass: 'btn-danger',
        cancellable: true,
        maxTotal: 1,
      });
      if (!selectedIds || selectedIds.length === 0) return false;
      const sel = targets.find(t => t.id === selectedIds[0]);
      if (!sel) return false;
      targetHeroIdx = sel.heroIdx;
    }

    // Find first free support slot
    const supportZones = oppPs.supportZones[targetHeroIdx] || [[], [], []];
    let freeSlot = -1;
    for (let si = 0; si < 3; si++) {
      if ((supportZones[si] || []).length === 0) { freeSlot = si; break; }
    }
    if (freeSlot < 0) return false;

    // Place the Mummy Token
    if (!oppPs.supportZones[targetHeroIdx]) oppPs.supportZones[targetHeroIdx] = [[], [], []];
    if (!oppPs.supportZones[targetHeroIdx][freeSlot]) oppPs.supportZones[targetHeroIdx][freeSlot] = [];
    oppPs.supportZones[targetHeroIdx][freeSlot].push('Mummy Token');

    const inst = engine._trackCard('Mummy Token', oppIdx, 'support', targetHeroIdx, freeSlot);

    engine._broadcastEvent('summon_effect', { owner: oppIdx, heroIdx: targetHeroIdx, zoneSlot: freeSlot, cardName: 'Mummy Token' });

    const heroName = oppPs.heroes[targetHeroIdx]?.name || 'Hero';
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
    await engine._delay(300);
    return true;
  },
};
