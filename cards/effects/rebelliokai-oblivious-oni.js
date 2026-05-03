// ═══════════════════════════════════════════
//  CARD EFFECT: "Rebelliokai Oblivious Oni"
//  Creature (Summoning Magic Lv1) — 200 HP
//  Archetype: Rebelliokai
//
//  Self-deletes when sent to discard from
//  outside hand or board.
//
//  Summon-gated: cannot be played unless 5+
//  differently-named Rebelliokai Creatures are
//  in your discard pile. The gate runs through
//  `canSummon`, so the engine's pre-summon
//  validation already filters it out of summon
//  prompts and ban-lists it from the hand
//  highlight when the threshold isn't met.
//
//  Active effect (1×/turn PER PLAYER, shared
//  across all Oni copies of that player): deal
//  150 damage to all targets the opponent
//  controls (heroes + creatures).
//
//  Wiring:
//    • `creatureEffect: true` — engine handles
//      per-instance HOPT, summoning sickness,
//      Main-Phase gating.
//    • Card text adds a SECOND constraint on top
//      of the per-instance lock: "You can only
//      activate this effect of 'Rebelliokai
//      Oblivious Oni' once per turn." That's a
//      per-name-per-player lock — claim via
//      `engine.claimHOPT('rebelliokai-oblivious-oni-aoe', pi)`.
//      Without that, two Onis would each fire
//      their own per-instance HOPT and the
//      150-damage AoE would land twice.
//    • AoE goes through `ctx.aoeHit` so all the
//      standard target collection / animation /
//      damage routing applies (Smug Coin, Gate
//      Shield, status-gated immunity, etc.).
// ═══════════════════════════════════════════

const {
  countDifferentRebelliokaiInDiscard,
} = require('./_rebelliokai-shared');

const CARD_NAME       = 'Rebelliokai Oblivious Oni';
const HOPT_KEY        = 'rebelliokai-oblivious-oni-aoe';
const SUMMON_THRESHOLD = 5;

module.exports = {
  selfDeleteOnExternalDiscard: true,
  activeIn: ['support'],
  creatureEffect: true,

  cpuMeta: {
    // 200 HP, board-wipe-tier AoE on a heavily-gated summon. The CPU
    // brain doesn't yet model the summon gate per-card, but once the
    // gate is satisfied this is a high-value board piece. Keep
    // onDeathBenefit ≈ 0 — we don't want the CPU sacrificing its own
    // Oni for graveyard fuel; the threshold to play it again is steep.
    onDeathBenefit: 0,
  },

  // ── Summon gate ──
  // 5+ different-name Rebelliokai Creatures in OWN discard pile.
  // Skipping the threshold-met check at summon-time is the only way
  // the rule can apply (the engine doesn't have a separate "play
  // condition" hook for Creatures the way Spells do).
  canSummon(ctx) {
    const engine = ctx._engine;
    const ps     = engine.gs.players[ctx.cardOwner];
    if (!ps) return false;
    return countDifferentRebelliokaiInDiscard(ps, engine) >= SUMMON_THRESHOLD;
  },

  // ── Active-effect gate ──
  // Per-name-per-player HOPT shared across all Oni copies. We PEEK at
  // the lock without claiming so the prompt UI can grey out the
  // second Oni's effect without burning the slot for nothing.
  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi     = ctx.cardOriginalOwner ?? ctx.cardOwner;
    const hopt   = engine.gs.hoptUsed?.[`${HOPT_KEY}:${pi}`];
    return hopt !== engine.gs.turn;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi     = ctx.cardOriginalOwner;
    const ps     = engine.gs.players[pi];
    if (!ps) return false;

    // Claim the shared lock — second Oni in the same turn fizzles.
    if (!engine.claimHOPT(HOPT_KEY, pi)) return false;

    await ctx.aoeHit({
      damage:        150,
      damageType:    'creature',
      side:          'enemy',
      types:         ['hero', 'creature'],
      animationType: 'club_bash',
      sourceName:    CARD_NAME,
    });

    engine.log('rebelliokai_oblivious_oni_aoe', {
      player: ps.username, damage: 150,
    });
    engine.sync();
    return true;
  },
};
