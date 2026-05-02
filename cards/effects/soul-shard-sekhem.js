// ═══════════════════════════════════════════
//  CARD EFFECT: "Soul Shard Sekhem" (Power)
//  Creature (Summoning Magic Lv2, Normal, 80 HP)
//  Archetype: Soul Shards.
//
//  PASSIVE: This Creature's effects don't get
//    negated when it's summoned by the effect
//    of Necromancy.
//
//  ON SUMMON FROM DISCARD: choose a target and
//    deal 50 × (# of different "Soul Shard"
//    Creatures on the board, including this one)
//    damage to it.
//
//  HARD 1/TURN by name.
// ═══════════════════════════════════════════

const {
  canSummonSoulShard, markSoulShardSummoned,
  distinctSoulShardsOnBoard,
  SOUL_SHARD_PILE_FUEL,
} = require('./_soul-shards-shared');

const CARD_NAME = 'Soul Shard Sekhem';
const DAMAGE_PER_SHARD = 50;

module.exports = {
  activeIn: ['support'],
  bypassNecromancyNegation: true,
  canSummon: canSummonSoulShard,
  cpuMeta: { pileFuel: SOUL_SHARD_PILE_FUEL },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      markSoulShardSummoned(gs, pi, CARD_NAME);
      if (!ctx._summonedFromDiscard) return;

      // Count distinct Soul Shard names across BOTH sides — the text
      // says "on the board" without "you control", so opp's mirror-
      // match Shards count too. The just-summoned Sekhem is in the
      // support zone by the time onPlay runs, so passing no ownerIdx
      // (= count both sides) naturally includes "this one".
      const distinct = distinctSoulShardsOnBoard(engine);
      const damage = DAMAGE_PER_SHARD * Math.max(1, distinct);

      // Mandatory effect — the card text doesn't say "may", so the
      // player has to commit to a target. cancellable: false locks the
      // prompt until a valid target is picked.
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'creature',
        title: CARD_NAME,
        description: `Deal ${damage} damage to a target. (${distinct} distinct Soul Shard${distinct === 1 ? '' : 's'} on the board × ${DAMAGE_PER_SHARD}.)`,
        confirmLabel: `🔥 ${damage} Damage!`,
        confirmClass: 'btn-danger',
        cancellable: false,
      });
      if (!target) return;

      // Scaling fire animation: the more Soul Shards fueling the
      // strike, the bigger the inferno. Tier breakdown lives in the
      // `soul_shard_inferno` registry component (app-board.jsx /
      // app.jsx) — at 1 shard a small ember, at 7+ a screen-shaking
      // white-hot blast with a delayed second wave and shockwave.
      engine._broadcastEvent('play_zone_animation', {
        type: 'soul_shard_inferno',
        owner: target.owner, heroIdx: target.heroIdx,
        zoneSlot: target.type === 'hero' ? -1 : target.slotIdx,
        intensity: distinct,
      });
      // Higher intensities animate longer — give the visual time to
      // resolve before the damage number appears.
      await engine._delay(distinct >= 5 ? 600 : 420);

      const source = { name: CARD_NAME, owner: pi, heroIdx: ctx.card.heroIdx, cardInstance: ctx.card };
      if (target.type === 'hero') {
        const tHero = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (tHero?.name && tHero.hp > 0) {
          await engine.actionDealDamage(source, tHero, damage, 'creature');
        }
      } else if (target.cardInstance) {
        await engine.actionDealCreatureDamage(
          source, target.cardInstance, damage, 'creature',
          { sourceOwner: pi, canBeNegated: true },
        );
      }
      engine.log('soul_shard_sekhem_strike', {
        player: gs.players[pi]?.username, distinct, damage,
      });
      engine.sync();
    },
  },
};
