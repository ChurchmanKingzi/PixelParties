// ═══════════════════════════════════════════
//  CARD EFFECT: "Metal Harpyformer"
//  Creature (Summoning Magic Lv0)
//  Archetype: Harpyformers
//
//  ① First Creature of turn = additional Action.
//  ② On summon: may search deck for a "Fighting"
//    Ability, reveal and add it to hand.
//  ③ Once per turn: discard a Fighting Ability
//    from hand to deal 50 damage to any target.
// ═══════════════════════════════════════════

const { harpyformerInherentAction, harpyformerDiscardCost } = require('./_harpyformer-shared');

const CARD_NAME    = 'Metal Harpyformer';
const ABILITY_NAME = 'Fighting';

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  inherentAction: harpyformerInherentAction,

  // ── On summon: search deck for Fighting ───────────────────────────────────
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

  // ── Once-per-turn creature effect: deal 50 damage ─────────────────────────
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

    const ok = await harpyformerDiscardCost(engine, pi, ABILITY_NAME, {
      costKind: 'damage',        // ★ v1038: Lernkanal-Lage passend zur Gegenleistung
      title: CARD_NAME,
      description: `Discard "${ABILITY_NAME}" to deal 50 damage to any target.`,
      source: CARD_NAME,
      logType: 'metal_discard',
    });
    if (!ok) return false;
    engine.sync();

    // Prompt for target
    const target = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero', 'creature'],
      damageType: 'other',
      baseDamage: 50,
      title: CARD_NAME,
      description: 'Deal 50 damage to any target.',
      confirmLabel: '⚔️ 50 Damage!',
      confirmClass: 'btn-danger',
      cancellable: false, // Fighting already discarded
    });
    if (!target) return true;

    const tgtOwner   = target.owner;
    const tgtHeroIdx = target.heroIdx;
    const tgtSlot    = target.type === 'hero' ? -1 : target.slotIdx;

    engine._broadcastEvent('play_zone_animation', {
      type: 'explosion', owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: tgtSlot,
    });
    await engine._delay(400);

    // ★ v1038: Fuer den Kosten-Lernkanal zaehlt nicht nur die LAGE vor
    // der Zahlung, sondern auch, was dabei herauskam — „hat der Schaden
    // getoetet?" (Als Praezisierung 12.9.). Deshalb den Zustand VORHER
    // festhalten und danach als Ausgangs-Tag nachtragen.
    const warGegner = tgtOwner !== pi;
    let getoetet = false;
    if (target.type === 'hero') {
      const tgtHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
      if (tgtHero && tgtHero.hp > 0) {
        await ctx.dealDamage(tgtHero, 50, 'creature');
        getoetet = !!(tgtHero && tgtHero.hp <= 0);
      }
    } else if (target.cardInstance) {
      const inst = target.cardInstance;
      await engine.actionDealCreatureDamage(
        { name: CARD_NAME, owner: pi, heroIdx },
        inst, 50, 'creature',
        { sourceOwner: pi, canBeNegated: true },
      );
      getoetet = inst.zone !== 'support';
    }
    engine.noteCostDiscardOutcome(pi, CARD_NAME, [
      getoetet ? 'killed' : 'noKill',
      warGegner ? 'hitOpp' : 'hitSelf',
      target.type === 'hero' ? 'hitHero' : 'hitCreature',
    ]);

    engine.log('metal_strike', { player: ps.username, target: target.cardName });
    engine.sync();
    return true;
  },
};
