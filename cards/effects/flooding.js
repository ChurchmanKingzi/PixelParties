// ═══════════════════════════════════════════
//  CARD EFFECT: "Flooding"
//  Spell (Surprise) — Magic Arts Lv 2
//
//  "Activate this Surprise when the user is chosen
//   by an Attack or Spell. Negate the Attack or
//   Spell."
//
//  Same general shape as Frost Rune / Booby Trap —
//  the engine's pre-resolution Surprise window
//  fires once per Hero chosen as a target, and
//  returning `{ effectNegated: true }` aborts the
//  triggering effect with no targets hit.
//
//  Source-type gate: ONLY Attack and Spell card
//  sources qualify. Creature effects, Artifact
//  effects, and Hero effects whose damage is
//  merely "treated as a Spell" (Alice the Puppeteer
//  Girl etc.) do NOT trigger Flooding — per card
//  text "an Attack or Spell".
//
//  Multi-target Attacks & Spells DO trigger
//  Flooding when the user is one of the chosen
//  targets — Whirlwind Strike, Pyroblast,
//  Fireball, Explosion, Chain Lightning all flow
//  through `promptMultiTarget` /
//  `promptDamageTarget`, which open the surprise
//  window per selected Hero in the post-pick list.
//
//  Full AoE (Flame Avalanche, Divine Gift of Fire,
//  any future `ctx.aoeHit()` full-side damage) is
//  filtered out via `_isAoeCheck` — the engine
//  stamps `cardInst._isAoeCheck = true` on the
//  source CardInstance for the duration of its AoE
//  surprise window (see `_engine.js#actionAoeHit`).
//  Mountain Tear River uses the same gate; this
//  matches the "auto-fan-out across every matching
//  target on the board does NOT count as targeting
//  the host" convention.
//
//  Telekinesis can't activate Flooding — there'd
//  be no Attack/Spell to negate (same opt-out as
//  Frost Rune / Magic Mirror).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Flooding';

module.exports = {
  isSurprise: true,
  canTelekinesisActivate: false,

  surpriseTrigger: (gs, ownerIdx, heroIdx, sourceInfo, engine) => {
    if (!sourceInfo) return false;
    if (sourceInfo.owner == null || sourceInfo.owner < 0) return false;

    // AoE gate — full-side fan-out effects stamp `_isAoeCheck` on the
    // source CardInstance for the duration of their AoE surprise
    // window. Bail so Flame Avalanche / Divine Gift of Fire / etc.
    // never open Flooding.
    if (sourceInfo.cardInstance?._isAoeCheck) return false;

    // Source must be an actual Attack or Spell CARD. Effective card
    // data (handles type overrides like Living Illusion / Spell-
    // transforms) → fall back to the static card DB by name.
    const cd = sourceInfo.cardInstance
      ? (engine.getEffectiveCardData?.(sourceInfo.cardInstance)
        || engine._getCardDB()[sourceInfo.cardName])
      : engine._getCardDB()[sourceInfo.cardName];
    if (!cd) return false;
    if (!hasCardType(cd, 'Attack') && !hasCardType(cd, 'Spell')) return false;

    return true;
  },

  onSurpriseActivate: async (ctx, sourceInfo) => {
    const engine = ctx._engine;
    const gs = engine.gs;
    const ownerIdx = ctx.cardOwner;
    const hostHeroIdx = ctx.cardHeroIdx;

    // Battlefield-wide flooding — a wall of blue water surges up from
    // below and engulfs the whole playing field for a beat, then
    // drains back out. The `flooding` animation is a fullscreen anchor
    // (renders in viewport space, ignores its (x,y) the same way
    // `cataclysm` does), but we still pass (owner, heroIdx) so the
    // engine's broadcast plumbing resolves a selector for
    // playAnimation. `duration: 2500` keeps the component mounted
    // through the full 2400ms rise → hold → drain cycle (the default
    // 1000ms would unmount it mid-rise).
    engine._broadcastEvent('play_zone_animation', {
      type: 'flooding', owner: ownerIdx, heroIdx: hostHeroIdx, zoneSlot: -1,
      duration: 2500,
    });
    // Wait for the water to fully cover the board before resolving
    // the negation — the rise lands around 670ms, holds through
    // ~1700ms. Returning at the peak makes the "the cast is drowned"
    // beat land while the screen is fully blue; the drain plays out
    // alongside the engine's post-negation cleanup.
    await engine._delay(1100);

    engine.log('flooding', {
      player: gs.players[ownerIdx]?.username,
      negated: sourceInfo.cardName || '?',
    });
    engine.sync();

    return { effectNegated: true };
  },
};
