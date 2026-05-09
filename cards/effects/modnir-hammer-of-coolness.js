// ═══════════════════════════════════════════
//  EQUIPMENT: "Modnir, Hammer of Coolness"
//  Has no effect from your hand.
//
//  When it is the top of your Coolness Stack, you
//  may equip it to one of your Heroes from there.
//  Equipped Hero gains +100 ATK.
// ═══════════════════════════════════════════

const CARD_NAME = 'Modnir, Hammer of Coolness';
const ATK_BONUS = 100;

module.exports = {
  isEquip: true,
  playableFromCoolnessStack: true,
  // Hand-grey: this card has no effect when played from hand, so dim
  // it in the hand row to signal "Stack-only". Stack-top play still
  // resolves via `play_from_coolness_stack`.
  neverPlayable: true,

  hooks: {
    onPlay: async (ctx) => {
      // Hand cast → no effect. The card hits discard via the normal funnel.
      if (ctx.cardZone === 'hand') return;
      // Equipped: grant +100 ATK to the holder.
      if (ctx.cardZone === 'support') {
        ctx.grantAtk(ATK_BONUS);
      }
    },
    onCardLeaveZone: async (ctx) => {
      if (ctx.fromZone !== 'support') return;
      ctx.revokeAtk();
    },
  },

  async resolveFromCoolnessStack(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    if (engine.getCoolnessStackTop(pi) !== CARD_NAME) return { aborted: true, reason: 'not_top' };

    const ps = engine.gs.players[pi];
    if (!ps) return { aborted: true, reason: 'no_player' };

    // Build target list: every living owned Hero with at least one
    // free Support slot, plus each free Support slot itself. Clicking
    // the Hero auto-picks the leftmost free slot; clicking a specific
    // empty slot places there directly.
    const targets = [];
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      // Frozen Heroes cannot be equipped (they can't accept new gear
      // while frozen). Stunned + Negated are also disqualified for the
      // same reason — the Hero is incapacitated.
      if (hero.statuses?.frozen) continue;
      const slots = ps.supportZones?.[hi] || [];
      let leftmostFree = -1;
      for (let si = 0; si < slots.length; si++) {
        if (!slots[si] || slots[si].length === 0) {
          if (leftmostFree < 0) leftmostFree = si;
          targets.push({
            id: `equip-${pi}-${hi}-${si}`,
            type: 'equip',
            owner: pi, heroIdx: hi, slotIdx: si,
            cardName: '',
          });
        }
      }
      if (leftmostFree >= 0) {
        targets.push({
          id: `hero-${pi}-${hi}`,
          type: 'hero',
          owner: pi, heroIdx: hi,
          cardName: hero.name,
          _autoSlot: leftmostFree,
        });
      }
    }
    if (targets.length === 0) return { aborted: true, reason: 'no_legal_target' };

    const pick = await engine.promptEffectTarget(pi, targets, {
      title: CARD_NAME,
      description: 'Equip Modnir to a Hero (auto-leftmost-free) or click a specific empty Support Zone.',
      confirmLabel: '⚔️ Equip',
      confirmClass: 'btn-success',
      cancellable: true,
      exclusiveTypes: true,
      maxPerType: { hero: 1, equip: 1 },
    });
    if (!pick || pick.length === 0) return { aborted: true, reason: 'cancelled' };
    const sel = targets.find(t => t.id === pick[0]);
    if (!sel) return { aborted: true, reason: 'invalid_pick' };

    const heroIdx = sel.heroIdx;
    const slotIdx = sel.type === 'hero' ? sel._autoSlot : sel.slotIdx;
    const heroName = ps.heroes?.[heroIdx]?.name;

    // ── Animation phase: fly the card from Stack to Support ──
    // The card is STILL on the Stack at this point — broadcasting
    // first lets the source rect resolve correctly while the Stack
    // still shows Modnir. State only changes AFTER the flight lands,
    // exposed in a single sync — Stack empties + Support populates
    // atomically so there's no vanish/flash gap.
    const popInst = engine.getCoolnessStackTopInst(pi);
    engine._broadcastEvent('attach_hero_fly', {
      ownerIdx: pi, source: 'coolnessStack', cardName: CARD_NAME,
      destOwner: pi, destHeroIdx: heroIdx, destZoneSlot: slotIdx,
    });
    await engine._delay(620);

    // ── Commit phase: pop Stack + place in support, single sync ──
    const popped = await ctx.popCoolnessStackTo(pi, 'board', { source: CARD_NAME });
    if (!popped) return { aborted: true, reason: 'pop_failed' };
    const placed = engine.safePlaceInSupport(CARD_NAME, pi, heroIdx, slotIdx);
    if (!placed?.inst) return { aborted: true, reason: 'placement_failed' };
    placed.inst.zone = 'support';

    engine.log('modnir_equip', { player: ps.username, hero: heroName, slot: placed.actualSlot });
    engine.sync();

    // ── Hooks ──
    await engine.runHooks('onCardLeaveZone', {
      card: popInst, cardName: CARD_NAME,
      fromZone: 'coolnessStack', fromOwner: pi, toZone: 'support',
    });
    await engine.runHooks('onPlay', {
      _onlyCard: placed.inst,
      playedCard: placed.inst,
      cardName: CARD_NAME,
      zone: 'support',
      heroIdx,
      zoneSlot: placed.actualSlot,
      _skipReactionCheck: true,
    });
    await engine.runHooks('onCardEnterZone', {
      enteringCard: placed.inst, cardName: CARD_NAME,
      toZone: 'support', toOwner: pi, toHeroIdx: heroIdx,
      fromZone: 'coolnessStack',
    });
    return { played: true };
  },
};
