// ═══════════════════════════════════════════
//  CARD EFFECT: "Carpet Bomblebee"
//  Creature (Summoning Magic Lv2, Normal, 50 HP)
//
//  Once per turn, when a target your opponent
//  controls is defeated, deal 80 damage to all
//  Heroes your opponent controls.
//
//  Mandatory (no "may") and no target picker —
//  AOE on every live opp Hero. HOPT keyed per
//  inst, same shape as the other Bomblebees.
// ═══════════════════════════════════════════

const { isOpponentTargetDeath } = require('./_bomblebee-shared');

const CARD_NAME   = 'Carpet Bomblebee';
const DAMAGE      = 80;
const ANIM_TYPE   = 'bomblebee_carpet';
const HOPT_PREFIX = 'carpet-bomblebee';

async function runOpponentDeathPayload(engine, inst, opts = {}) {
  const gs = engine.gs;
  const pi = inst.controller ?? inst.owner;
  const heroIdx = inst.heroIdx;
  const oi = pi === 0 ? 1 : 0;

  const hoptKey = `${HOPT_PREFIX}:${inst.id}`;
  if (!opts.bypassHopt) {
    if (gs.hoptUsed?.[hoptKey] === gs.turn) return;
  }

  const ops = gs.players[oi];
  if (!ops) return;

  const heroHits = [];
  for (let hi = 0; hi < (ops.heroes || []).length; hi++) {
    const h = ops.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    heroHits.push({ hi, hero: h });
  }
  if (heroHits.length === 0) return;

  if (!opts.bypassHopt) {
    if (!gs.hoptUsed) gs.hoptUsed = {};
    gs.hoptUsed[hoptKey] = gs.turn;
  }

  const source = {
    name: CARD_NAME, owner: pi,
    heroIdx, cardInstance: inst,
  };

  // Per-hero animation broadcast (the carpet-style cascade is emitted as
  // a sequence of small bursts walking across the opp's side; the client
  // animation component renders the cascade itself).
  for (const { hi } of heroHits) {
    engine._broadcastEvent('play_zone_animation', {
      type: ANIM_TYPE, owner: oi, heroIdx: hi, zoneSlot: -1,
    });
  }
  await engine._delay(550);

  for (const { hi, hero } of heroHits) {
    if (hero.hp <= 0) continue; // May have died from a prior hit in this loop
    await engine.actionDealDamage(source, hero, DAMAGE, 'creature');
  }

  engine.log('carpet_bomblebee_strike', {
    player: gs.players[pi]?.username,
    targets: heroHits.length,
    damage: DAMAGE,
    bypassHopt: !!opts.bypassHopt,
  });
  engine.sync();
}

module.exports = {
  activeIn: ['support'],

  runOpponentDeathPayload,

  hooks: {
    onCreatureDeath: async (ctx) => {
      if (!isOpponentTargetDeath(ctx, ctx.cardOwner)) return;
      await runOpponentDeathPayload(ctx._engine, ctx.card);
    },
    onHeroKO: async (ctx) => {
      if (!isOpponentTargetDeath(ctx, ctx.cardOwner)) return;
      await runOpponentDeathPayload(ctx._engine, ctx.card);
    },
  },
};
