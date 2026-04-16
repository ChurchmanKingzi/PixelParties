// ═══════════════════════════════════════════
//  CARD EFFECT: "Grunge Harpyformer"
//  Creature (Summoning Magic Lv0)
//  Archetype: Harpyformers
//
//  ① First Creature of turn = additional Action.
//  ② On summon: may search deck for a
//    "Destruction Magic" Ability, reveal and
//    add it to hand.
//  ③ Once per turn: discard a Destruction Magic
//    Ability from hand to Burn any target
//    permanently. Only unbured targets are valid.
// ═══════════════════════════════════════════

const { harpyformerInherentAction } = require('./_harpyformer-shared');
const { hasCardType } = require('./_hooks');

const CARD_NAME    = 'Grunge Harpyformer';
const ABILITY_NAME = 'Destruction Magic';

module.exports = {
  inherentAction: harpyformerInherentAction,

  // ── On summon: search deck for Destruction Magic ──────────────────────────
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const ps = engine.gs.players[pi];
      if (!ps) return;

      if (!(ps.mainDeck || []).includes(ABILITY_NAME)) return;

      const confirm = await ctx.promptConfirmEffect({
        title: CARD_NAME,
        message: `Search your deck for a "${ABILITY_NAME}" Ability and add it to your hand?`,
      });
      if (!confirm) return;

      await engine.searchDeckForNamedCard(pi, ABILITY_NAME, CARD_NAME);
    },
  },

  // ── Once-per-turn creature effect: Burn a target permanently ─────────────
  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    const ps = ctx.players[ctx.cardOwner];
    return (ps?.hand || []).includes(ABILITY_NAME);
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps = gs.players[pi];
    if (!ps) return false;

    // Confirm discard
    const result = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: [{ name: ABILITY_NAME, source: 'hand' }],
      title: CARD_NAME,
      description: `Discard "${ABILITY_NAME}" to permanently Burn any target.`,
      confirmLabel: '🔥 Discard & Burn',
      confirmClass: 'btn-danger',
      cancellable: true,
    });
    if (!result || result.cancelled) return false;

    const idx = ps.hand.indexOf(ABILITY_NAME);
    if (idx < 0) return false;
    ps.hand.splice(idx, 1);
    ps.discardPile.push(ABILITY_NAME);
    engine.log('grunge_discard', { player: ps.username, card: ABILITY_NAME });
    engine.sync();

    // Prompt for an unburned target
    const target = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero', 'creature'],
      damageType: null,
      title: CARD_NAME,
      description: 'Choose an unburned target to Burn permanently.',
      confirmLabel: '🔥 Burn!',
      confirmClass: 'btn-danger',
      cancellable: false, // Destruction Magic already discarded
      condition: (t) => {
        if (t.type === 'hero') {
          const h = gs.players[t.owner]?.heroes?.[t.heroIdx];
          return h && !h.statuses?.burned;
        }
        if (t.type === 'equip' && t.cardInstance) {
          return !t.cardInstance.counters?.burned;
        }
        return true;
      },
    });
    if (!target) return true;

    const tgtOwner   = target.owner;
    const tgtHeroIdx = target.heroIdx;
    const tgtSlot    = target.type === 'hero' ? -1 : target.slotIdx;

    engine._broadcastEvent('play_zone_animation', {
      type: 'flame_strike', owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: tgtSlot,
    });
    await engine._delay(500);

    if (target.type === 'hero') {
      const tgtHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
      if (tgtHero && tgtHero.hp > 0 && !tgtHero.statuses?.burned) {
        await engine.addHeroStatus(tgtOwner, tgtHeroIdx, 'burned', { permanent: true });
      }
    } else if (target.cardInstance) {
      const inst = target.cardInstance;
      if (engine.canApplyCreatureStatus(inst, 'burned') && !inst.counters.burned) {
        const hookCtx = {
          creature: inst, effectType: 'status',
          source: { name: CARD_NAME, owner: pi, heroIdx },
          cancelled: false, _skipReactionCheck: true,
        };
        await engine.runHooks('beforeCreatureAffected', hookCtx);
        if (!hookCtx.cancelled) {
          inst.counters.burned = true;
          engine.log('creature_burned', { card: inst.name, owner: inst.owner, by: CARD_NAME });
        }
      }
    }

    engine.log('grunge_burn', { player: ps.username, target: target.cardName });
    engine.sync();
    return true;
  },
};
