// ═══════════════════════════════════════════
//  CARD EFFECT: "Time Bomblebee"
//  Creature (Summoning Magic Lv1, Normal, 50 HP)
//
//  Whenever a target your opponent controls is
//  defeated, place a Bomb Counter onto this
//  Creature. While this Creature has Bomb
//  Counters on it, it cannot take damage or be
//  defeated.
//
//  At the start of your opponent's turn, remove
//  all Bomb Counters from this Creature, and if
//  you removed at least 1, choose a Creature and
//  deal 150 damage to it.
//
//  • Counter accrual is NOT once-per-turn — text
//    says "Whenever," so multiple opp deaths in
//    one turn each add a counter.
//  • While charged, `_damageDestroyImmune` is
//    stamped on this inst — the engine's damage
//    batch and `actionDestroyCard` both honor it.
//  • The opp-turn-start payoff is mandatory and
//    targets ANY Creature (own or opponent). If
//    Time Bomblebee is the only living creature,
//    it must self-target and dies — counters are
//    cleared FIRST so the immunity is gone by
//    the time the damage lands.
//  • Burning Fuse re-fires `runOpponentDeath
//    Payload` (HOPT-bypass) which adds a counter
//    just like the natural trigger would.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { isOpponentTargetDeath } = require('./_bomblebee-shared');

const CARD_NAME       = 'Time Bomblebee';
const DAMAGE          = 150;
const ANIM_TICK       = 'bomblebee_tick';
const ANIM_DETONATE   = 'bomblebee_detonate';

function setCharged(inst, charged) {
  if (charged) {
    inst.counters._damageDestroyImmune = true;
  } else {
    delete inst.counters._damageDestroyImmune;
  }
}

/**
 * Per-counter accrual. Called both by the natural opp-defeat listener
 * AND by Burning Fuse's "as if a defeat happened" re-trigger path.
 * Mandatory — always adds a counter when called.
 */
async function runOpponentDeathPayload(engine, inst, _opts = {}) {
  if (!inst || inst.zone !== 'support') return;
  inst.counters.bombCounters = (inst.counters.bombCounters || 0) + 1;
  setCharged(inst, true);

  engine._broadcastEvent('play_zone_animation', {
    type: ANIM_TICK,
    owner: inst.owner,
    heroIdx: inst.heroIdx,
    zoneSlot: inst.zoneSlot,
  });

  engine.log('time_bomblebee_charge', {
    player: engine.gs.players[inst.controller ?? inst.owner]?.username,
    counters: inst.counters.bombCounters,
  });
  engine.sync();
}

// Every live Creature on the board (own + opponent). Used by the opp-
// turn-start detonation picker — text says "choose a Creature" with no
// side restriction, so the picker is fully open.
function allLivingCreatureTargets(engine) {
  const out = [];
  const cardDB = engine._getCardDB();
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if (inst.faceDown) continue;
    const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    out.push({
      id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
      type: 'equip',
      owner: inst.owner, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
      cardName: inst.name, cardInstance: inst,
    });
  }
  return out;
}

module.exports = {
  activeIn: ['support'],

  runOpponentDeathPayload,

  hooks: {
    // ── Charge on any opp defeat ────────────────────────────────────
    onCreatureDeath: async (ctx) => {
      if (!isOpponentTargetDeath(ctx, ctx.cardOwner)) return;
      await runOpponentDeathPayload(ctx._engine, ctx.card);
    },
    onHeroKO: async (ctx) => {
      if (!isOpponentTargetDeath(ctx, ctx.cardOwner)) return;
      await runOpponentDeathPayload(ctx._engine, ctx.card);
    },

    // ── Detonate at opp turn start ──────────────────────────────────
    onTurnStart: async (ctx) => {
      // Fires for every card every turn; only the OPP's turn matters here.
      if (ctx.isMyTurn) return;
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support') return;
      const counters = inst.counters?.bombCounters || 0;
      if (counters <= 0) return;

      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const gs = engine.gs;

      // Clear counters AND immunity FIRST. Critical for the "only
      // creature on the board" case — Time Bomblebee may be the
      // mandatory target and must be vulnerable when the damage lands.
      inst.counters.bombCounters = 0;
      setCharged(inst, false);

      // Detonation animation on self.
      engine._broadcastEvent('play_zone_animation', {
        type: ANIM_DETONATE,
        owner: inst.owner,
        heroIdx: inst.heroIdx,
        zoneSlot: inst.zoneSlot,
      });
      await engine._delay(500);

      const targets = allLivingCreatureTargets(engine);
      if (targets.length === 0) {
        // Nothing on the board to hit — shouldn't happen because Time
        // Bomblebee itself is a valid target, but defensive against
        // race conditions (e.g. another effect destroying it during the
        // animation delay).
        engine.log('time_bomblebee_detonate_fizzle', {
          player: gs.players[pi]?.username, counters,
        });
        engine.sync();
        return;
      }

      // Mandatory pick — non-cancellable, always exactly 1 target.
      const picked = await engine.promptEffectTarget(pi, targets, {
        title: CARD_NAME,
        description: `Time Bomblebee detonates! Choose a Creature to deal ${DAMAGE} damage to. (Mandatory — pick any Creature on the board.)`,
        confirmLabel: `💥 ${DAMAGE} Damage!`,
        confirmClass: 'btn-danger',
        cancellable: false,
        exclusiveTypes: true,
        maxPerType: { equip: 1 },
      });
      if (!picked || picked.length === 0) return;

      const target = targets.find(t => t.id === picked[0]);
      if (!target?.cardInstance) return;

      const source = {
        name: CARD_NAME, owner: pi,
        heroIdx: inst.heroIdx, cardInstance: inst,
      };

      await engine.actionDealCreatureDamage(
        source, target.cardInstance, DAMAGE, 'creature',
        { sourceOwner: pi, canBeNegated: true },
      );

      engine.log('time_bomblebee_detonate', {
        player: gs.players[pi]?.username,
        target: target.cardName,
        damage: DAMAGE,
        counters,
      });
      engine.sync();
    },
  },
};
