// ═══════════════════════════════════════════
//  CARD EFFECT: "Cardinal Beast Xuanwu"
//  Creature (Lv5, 500HP) — Immune to opponent.
//  Once per turn: Revive a lv3 or lower Creature
//  from discard with 1HP into a free Support Zone.
// ═══════════════════════════════════════════

const { _checkCardinalWin, _setCardinalImmune } = require('./_cardinal-shared');

module.exports = {
  creatureEffect: true,

  // Always commit the active. See cardinal-beast-zhuque.js for full
  // rationale — Cardinal Beast actives are always worth firing when
  // available, and the +3 commit threshold can underweight them.
  cpuMeta: { alwaysCommit: true },

  hooks: {
    onPlay: async (ctx) => { _setCardinalImmune(ctx); },
    onCardEnterZone: async (ctx) => {
      if (ctx.enteringCard?.name?.startsWith('Cardinal Beast')) await _checkCardinalWin(ctx);
    },
  },

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOriginalOwner;
    const ps = gs.players[pi];
    if (!ps) return false;

    const cardDB = engine._getCardDB();

    // Must have 1+ lv3 or lower Creature in discard
    const hasEligible = (ps.discardPile || []).some(cn => {
      const cd = cardDB[cn];
      return cd && cd.cardType === 'Creature' && (cd.level || 0) <= 3;
    });
    if (!hasEligible) return false;

    // Must have 1+ free Support Zone
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      for (let zi = 0; zi < 3; zi++) {
        if (((ps.supportZones[hi] || [])[zi] || []).length === 0) return true;
      }
    }
    return false;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOriginalOwner;
    const ps = gs.players[pi];
    if (!ps) return false;

    const cardDB = engine._getCardDB();

    // Build gallery of eligible creatures from discard
    const seen = new Set();
    const galleryCards = [];
    for (const cn of (ps.discardPile || [])) {
      if (seen.has(cn)) continue;
      const cd = cardDB[cn];
      if (!cd || cd.cardType !== 'Creature' || (cd.level || 0) > 3) continue;
      seen.add(cn);
      galleryCards.push({ name: cn, source: 'discard' });
    }
    galleryCards.sort((a, b) => a.name.localeCompare(b.name));
    if (galleryCards.length === 0) return false;

    // Pick a creature
    const result = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: galleryCards,
      title: 'Cardinal Beast Xuanwu',
      description: 'Choose a Lv3 or lower Creature from your discard pile to revive with 1 HP.',
      cancellable: true,
    });
    if (!result || result.cancelled || !result.cardName) return false;
    const chosenName = result.cardName;

    // Remove from discard
    const discardIdx = ps.discardPile.indexOf(chosenName);
    if (discardIdx < 0) return false;

    // Pick a free Support Zone
    const freeZones = [];
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      for (let zi = 0; zi < 3; zi++) {
        if (((ps.supportZones[hi] || [])[zi] || []).length === 0) {
          freeZones.push({ heroIdx: hi, slotIdx: zi });
        }
      }
    }
    if (freeZones.length === 0) return false;

    let destHeroIdx, destSlot;
    if (freeZones.length === 1) {
      destHeroIdx = freeZones[0].heroIdx;
      destSlot = freeZones[0].slotIdx;
    } else {
      const zoneResult = await engine.promptGeneric(pi, {
        type: 'zonePick',
        title: 'Cardinal Beast Xuanwu',
        description: `Place ${chosenName} in which zone?`,
        zones: freeZones,
        cancellable: true,
      });
      if (!zoneResult || zoneResult.cancelled) return false;
      destHeroIdx = zoneResult.heroIdx;
      destSlot = zoneResult.slotIdx;
    }
    if (destHeroIdx == null || destSlot == null) return false;

    // Place the creature
    ps.discardPile.splice(discardIdx, 1);
    if (!ps.supportZones[destHeroIdx]) ps.supportZones[destHeroIdx] = [[], [], []];
    ps.supportZones[destHeroIdx][destSlot] = [chosenName];
    const inst = engine._trackCard(chosenName, pi, 'support', destHeroIdx, destSlot);
    inst.turnPlayed = gs.turn; // Summoning sickness
    // Set HP to 1
    inst.counters.currentHp = 1;
    inst.counters.maxHp = 1;
    inst.counters._xuanwuRevived = true; // Visual indicator (blue tint)

    // Track creature summon
    ps._creaturesSummonedThisTurn = (ps._creaturesSummonedThisTurn || 0) + 1;

    engine._broadcastEvent('summon_effect', { owner: pi, heroIdx: destHeroIdx, zoneSlot: destSlot, cardName: chosenName });
    engine.log('xuanwu_revive', { player: ps.username, card: chosenName, hp: 1 });

    await engine.runHooks('onCardEnterZone', {
      enteringCard: inst, toZone: 'support', toHeroIdx: destHeroIdx,
      _skipReactionCheck: true,
    });

    engine.sync();
    return true;
  },
};
