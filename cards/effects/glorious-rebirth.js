// ═══════════════════════════════════════════
//  SPELL: "Glorious Rebirth"
//  Play only when the top of your Coolness Stack
//  is a level 3 or lower Creature. Place that
//  Creature into a free Support Zone of the user.
// ═══════════════════════════════════════════

const CARD_NAME = 'Glorious Rebirth';
const MAX_LEVEL = 3;

module.exports = {
  spellPlayCondition(gs, pi, engine) {
    const ps = gs.players[pi];
    if (!ps?.coolnessStack?.length) return false;
    const topName = ps.coolnessStack[ps.coolnessStack.length - 1];
    const cd = engine?._getCardDB?.()[topName];
    if (!cd || cd.cardType !== 'Creature') return false;
    if ((cd.level ?? 0) > MAX_LEVEL) return false;
    return true;
  },

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const ps = engine.gs.players[pi];
      const topName = engine.getCoolnessStackTop(pi);
      const cardDB = engine._getCardDB();
      const cd = topName ? cardDB[topName] : null;
      if (!cd || cd.cardType !== 'Creature' || (cd.level ?? 0) > MAX_LEVEL) {
        engine.gs._spellCancelled = true;
        return;
      }
      // User = the casting Hero. Place into a free support slot of the user.
      const heroIdx = ctx.cardHeroIdx >= 0 ? ctx.cardHeroIdx : ctx.heroIdx;
      const slots = ps.supportZones?.[heroIdx] || [];
      const hasFree = slots.some(s => !s || s.length === 0);
      if (heroIdx == null || heroIdx < 0 || !hasFree) {
        engine.gs._spellCancelled = true;
        return;
      }

      // Pre-compute the leftmost-free slot for the user's hero so we
      // can broadcast the fly animation BEFORE mutating Stack/Support.
      const heroSlots = ps.supportZones?.[heroIdx] || [];
      let slotIdx = -1;
      for (let si = 0; si < heroSlots.length; si++) {
        if (!heroSlots[si] || heroSlots[si].length === 0) { slotIdx = si; break; }
      }
      if (slotIdx < 0) { engine.gs._spellCancelled = true; return; }

      // Fly first, commit after — keeps the card on the Stack until
      // the animation lands, then atomically Stack→empty + Support→
      // populated in a single sync.
      const popInst = engine.getCoolnessStackTopInst(pi);
      engine._broadcastEvent('attach_hero_fly', {
        ownerIdx: pi, source: 'coolnessStack', cardName: topName,
        destOwner: pi, destHeroIdx: heroIdx, destZoneSlot: slotIdx,
      });
      await engine._delay(620);

      const popped = await ctx.popCoolnessStackTo(pi, 'board', { source: CARD_NAME });
      if (!popped) { engine.gs._spellCancelled = true; return; }
      const placed = engine.safePlaceInSupport(topName, pi, heroIdx, slotIdx);
      if (!placed?.inst) return;
      placed.inst.zone = 'support';

      engine.sync();
      engine._broadcastEvent('summon_zone_animation', { owner: pi, heroIdx, zoneSlot: placed.actualSlot });

      await engine.runHooks('onCardLeaveZone', {
        card: popInst, cardName: topName,
        fromZone: 'coolnessStack', fromOwner: pi, toZone: 'support',
      });
      await engine.runHooks('onPlay', {
        _onlyCard: placed.inst,
        playedCard: placed.inst, cardName: topName,
        zone: 'support', heroIdx, zoneSlot: placed.actualSlot,
        _skipReactionCheck: true,
      });
      await engine.runHooks('onCardEnterZone', {
        enteringCard: placed.inst, cardName: topName,
        toZone: 'support', toOwner: pi, toHeroIdx: heroIdx,
        fromZone: 'coolnessStack',
      });
    },
  },
};
