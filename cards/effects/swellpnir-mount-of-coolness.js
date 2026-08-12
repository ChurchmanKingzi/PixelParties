const { heroCanBeEquipped } = require('./_hooks');
// ═══════════════════════════════════════════
//  EQUIPMENT: "Swellpnir, Mount of Coolness"
//  Has no effect from your hand.
//
//  When it is the top of your Coolness Stack, you
//  may equip it to a Hero from there. The equipped
//  Hero may perform a second Action during the
//  Action Phase each turn, but it can only use
//  that Action for an Attack.
//
//  Implementation
//  ──────────────
//  Uses the shared `_second-action-shared` module
//  (same lifecycle Reiza, Soul Shard Ba, etc.
//  use). The shared module owns:
//   • Per-instance additional-action type registration.
//   • Host Hero badge.
//   • `_preventPhaseAdvance` gate that keeps the
//     player in Action Phase until the second
//     Action is reachable.
//   • Mid-phase fizzle when the player's universal
//     second-action slot is consumed elsewhere.
//   • Cleanup at phase-end / card-leave.
//
//  Swellpnir's only customisation is restricting
//  `allowedCategories` to `['attack']` so the
//  bonus Action can ONLY be used for an Attack.
// ═══════════════════════════════════════════

const { secondActionGrant, secondActionHooks } = require('./_second-action-shared');

const CARD_NAME = 'Swellpnir, Mount of Coolness';
const ALLOWED = ['attack'];

module.exports = {
  // ── CPU: Ziel-Intercept (Shield-of-Life-Klasse) ──────────────────
  // Cancellable Utility-Ziel ohne baseDamage fällt sonst auf den
  // Engine-Decline durch. Politik: Coolness-Equip auf den ersten legalen eigenen Helden
  cpuResponse(engine, kind, payload) {
    if (kind !== 'effectTarget') return undefined;
    const vt = payload?.validTargets || [];
    if (vt.length === 0) return undefined;
    const pick = vt[0];
    return [typeof pick === 'object' ? pick.id : pick];
  },


  isEquip: true,
  playableFromCoolnessStack: true,
  // Hand-grey: Stack-only equip. Plays from hand do nothing.
  neverPlayable: true,
  // Listeners fire only while equipped in a Support Zone.
  activeIn: ['support'],

  hooks: {
    // Pull in onActionUsed (phase-advance gate + universal-slot
    // fizzle), onAdditionalActionUsed (badge cleanup), onPhaseEnd
    // (end-of-Action-Phase cleanup), onCardLeaveZone (de-equip
    // cleanup) from the shared module.
    ...secondActionHooks,

    onPlay: async (ctx) => {
      // Only fires once Swellpnir lands in a support zone — the
      // Stack-equip flow places it via safePlaceInSupport then runs
      // onPlay scoped to this inst. Initial grant for the turn it
      // was equipped.
      await secondActionGrant(ctx, {
        sourceLabel: CARD_NAME,
        allowedCategories: ALLOWED,
      });
    },

    onTurnStart: async (ctx) => {
      // Re-grant at the start of each of the controller's turns —
      // the card text is "EACH turn", so every Action Phase gets a
      // fresh second-Action slot. Only fires while equipped (active
      // in 'support').
      if (ctx.activePlayer !== ctx.cardOwner) return;
      await secondActionGrant(ctx, {
        sourceLabel: CARD_NAME,
        allowedCategories: ALLOWED,
      });
    },
  },

  async resolveFromCoolnessStack(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    if (engine.getCoolnessStackTop(pi) !== CARD_NAME) return { aborted: true, reason: 'not_top' };
    const ps = engine.gs.players[pi];
    if (!ps) return { aborted: true, reason: 'no_player' };

    // Build hero + free-slot target list (same shape as Modnir).
    const targets = [];
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      // v341: kanonische Ausruest-Regel (tot / eingefroren / bezaubert)
      // aus `_hooks.js` statt einer eigenen Teilpruefung. Die
      // Frozen-Sperre stand hier schon, `charmed` fehlte.
      if (!heroCanBeEquipped(hero)) continue;
      // Frozen Heroes can't accept new equipment.
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
      description: 'Equip Swellpnir to a Hero (auto-leftmost-free) or click a specific empty Support Zone.',
      confirmLabel: '🐎 Mount up!',
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

    // Fly first, commit after — see Modnir for the timing rationale.
    const popInst = engine.getCoolnessStackTopInst(pi);
    engine._broadcastEvent('attach_hero_fly', {
      ownerIdx: pi, source: 'coolnessStack', cardName: CARD_NAME,
      destOwner: pi, destHeroIdx: heroIdx, destZoneSlot: slotIdx,
    });
    await engine._delay(620);

    const popped = await ctx.popCoolnessStackTo(pi, 'board', { source: CARD_NAME });
    if (!popped) return { aborted: true, reason: 'pop_failed' };
    const placed = engine.safePlaceInSupport(CARD_NAME, pi, heroIdx, slotIdx);
    if (!placed?.inst) return { aborted: true, reason: 'placement_failed' };
    placed.inst.zone = 'support';

    engine.log('swellpnir_equip', { player: ps.username, hero: heroName, slot: placed.actualSlot });
    engine.sync();

    await engine.runHooks('onCardLeaveZone', {
      card: popInst, cardName: CARD_NAME,
      fromZone: 'coolnessStack', fromOwner: pi, toZone: 'support',
    });
    await engine.runHooks('onPlay', {
      _onlyCard: placed.inst,
      playedCard: placed.inst, cardName: CARD_NAME,
      zone: 'support', heroIdx, zoneSlot: placed.actualSlot,
      _skipReactionCheck: true,
    });
    await engine.runHooks('onCardEnterZone', {
      enteringCard: placed.inst, cardName: CARD_NAME,
      toZone: 'support', toOwner: pi, toHeroIdx: heroIdx, fromZone: 'coolnessStack',
    });
    return { played: true };
  },
};
