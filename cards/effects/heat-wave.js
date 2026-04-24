// ═══════════════════════════════════════════
//  CARD EFFECT: "Heat Wave"
//  Spell (Destruction Magic Lv3, Normal)
//
//  Every target on the board EXCEPT the casting
//  Hero either:
//    • gets permanently Burned (if not already
//      Burned and not burn-immune), OR
//    • takes 150 `destruction_spell` damage (if
//      it was already Burned before resolution).
//
//  Burn-immune targets that aren't already
//  Burned do nothing — the flame animation still
//  plays on them (per user spec: "animation for
//  this should be wide lines of flames shooting
//  at all targets except the user (even immune
//  ones!)").
//
//  Damage-lock edge case: if the caster's own
//  state carries `damageLocked` (Flame Avalanche's
//  rest-of-turn debuff), the damage branch is
//  suppressed. Burns still apply to the non-
//  already-burned, non-immune targets. The card
//  is still CAST (spell-school cost paid, HOPT
//  consumed) — it just skips the damage leg.
//
//  Play-time usability:
//    • Normal: usable if at least one non-caster
//      target would do something (take a new Burn
//      OR take damage because it's already Burned).
//    • Damage-locked: usable only if at least one
//      non-caster target can still be Burned
//      (i.e. not already Burned AND not immune).
//      Matches the user spec: "Heat Wave is still
//      usable unless ALL possible targets are
//      already Burned or immune to being Burned".
//
//  spellPlayCondition runs before we know which
//  Hero will cast, so it enumerates every live
//  Hero on both sides as a potential non-caster
//  target — over-inclusive, but the per-hero
//  level-/lock-check gates the bad cases.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Heat Wave';
const DAMAGE    = 150;

/**
 * Is a resolved target currently Burned?
 * Heroes check `statuses.burned`, creatures check `counters.burned`.
 */
function targetIsBurned(engine, t) {
  if (t.type === 'hero') {
    return !!engine.gs.players[t.owner]?.heroes?.[t.heroIdx]?.statuses?.burned;
  }
  return !!t.inst?.counters?.burned;
}

/**
 * Can the target receive a new Burned status right now?
 * Leans on the engine's canApplyCreatureStatus for creatures, and
 * mirrors the hero-side gates that addHeroStatus would hit (immune /
 * charmed / burn_immune).
 */
function targetCanBeBurned(engine, t) {
  if (t.type === 'hero') {
    const hero = engine.gs.players[t.owner]?.heroes?.[t.heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;
    if (hero.statuses?.burned) return false; // Already — not "can-be-newly".
    if (hero.statuses?.immune) return false;
    if (hero.statuses?.charmed) return false;
    if (hero.statuses?.burn_immune) return false;
    return true;
  }
  if (!t.inst) return false;
  if (t.inst.counters?.burned) return false;
  return engine.canApplyCreatureStatus(t.inst, 'burned');
}

/**
 * Gather every live non-caster target on the board.
 * If `casterIdx` is provided (at resolution time), the caster's hero is
 * filtered out. At play-condition time the caster isn't known yet, so
 * `casterIdx = -1` keeps all heroes in the pool.
 */
function collectTargets(engine, pi, casterHeroIdx) {
  const gs = engine.gs;
  const cardDB = engine._getCardDB();
  const targets = [];
  for (let tpi = 0; tpi < 2; tpi++) {
    const ps = gs.players[tpi];
    if (!ps) continue;
    // Heroes
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const h = ps.heroes[hi];
      if (!h?.name || h.hp <= 0) continue;
      if (tpi === pi && hi === casterHeroIdx) continue; // Skip caster
      targets.push({ type: 'hero', owner: tpi, heroIdx: hi });
    }
    // Creatures (both owned + stolen render on this side)
    for (const inst of engine.cardInstances) {
      if ((inst.owner !== tpi && inst.controller !== tpi) || inst.zone !== 'support') continue;
      if (inst.faceDown) continue;
      const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
      if (!cd || !hasCardType(cd, 'Creature')) continue;
      targets.push({
        type: 'creature',
        owner: inst.owner,
        heroIdx: inst.heroIdx,
        slotIdx: inst.zoneSlot,
        inst,
      });
    }
  }
  return targets;
}

module.exports = {
  /**
   * Gate the card out of hand-playability when it would do literally
   * nothing. Over-inclusive on caster identity (see header), which is
   * fine — the worst case is showing the card as playable when only
   * the caster's own hero would qualify, which is still a legal cast
   * (the spell just does nothing to that slot either way).
   */
  spellPlayCondition(gs, playerIdx, engine) {
    const ps = gs.players[playerIdx];
    if (!ps) return false;
    // casterHeroIdx = -1 → nothing is excluded. The gate only cares
    // "would SOMETHING happen to at least one target?".
    const pool = collectTargets(engine, playerIdx, -1);
    if (pool.length === 0) return false;
    const damageLocked = !!ps.damageLocked;
    for (const t of pool) {
      const burned = targetIsBurned(engine, t);
      const canBurn = targetCanBeBurned(engine, t);
      if (damageLocked) {
        // Only the burn leg is live. Need a non-burned, non-immune target.
        if (canBurn) return true;
      } else {
        // Either a new burn or a damage-the-already-burned hit counts.
        if (canBurn || burned) return true;
      }
    }
    return false;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine  = ctx._engine;
      const gs      = engine.gs;
      const pi      = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps      = gs.players[pi];
      if (!ps) return;
      const damageLocked = !!ps.damageLocked;

      const targets = collectTargets(engine, pi, heroIdx);
      if (targets.length === 0) return;

      // ── Animation: flame projectiles from caster to EVERY target ──
      // User spec: "wide lines of flames shooting at all targets except
      // the user (even immune ones!)". We fire the projectiles first
      // (all at once — the client handles each one's fly-time in
      // parallel), wait briefly for impact, then resolve effects.
      for (const t of targets) {
        engine._broadcastEvent('play_projectile_animation', {
          sourceOwner:   ctx.cardHeroOwner,
          sourceHeroIdx: heroIdx,
          targetOwner:   t.owner,
          targetHeroIdx: t.heroIdx,
          targetZoneSlot: t.type === 'creature' ? t.slotIdx : -1,
          emoji: '🔥',
          emojiStyle: { fontSize: 44 },
          trailClass: 'projectile-flame-trail',
          duration: 520,
        });
      }
      await engine._delay(460);

      // ── Resolve effects ──
      // Snapshot burn-state BEFORE any status/damage application so the
      // "already Burned?" test isn't muddled by this card's own burns.
      // (A target that becomes Burned mid-resolution should NOT then
      // take 150 damage from a later iteration — card text is "already
      // Burned", meaning prior to this cast.)
      const preBurned = targets.map(t => targetIsBurned(engine, t));

      for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        const wasBurned = preBurned[i];
        if (wasBurned) {
          // Already Burned → 150 damage (suppressed by damage-lock).
          if (damageLocked) continue;
          if (t.type === 'hero') {
            const hero = gs.players[t.owner]?.heroes?.[t.heroIdx];
            if (hero && hero.hp > 0) {
              await ctx.dealDamage(hero, DAMAGE, 'destruction_spell');
            }
          } else {
            const inst = engine.cardInstances.find(c => c.id === t.inst.id);
            if (inst && inst.zone === 'support') {
              await engine.actionDealCreatureDamage(
                { name: CARD_NAME, owner: pi, heroIdx },
                inst, DAMAGE, 'destruction_spell',
                { sourceOwner: pi, canBeNegated: true },
              );
            }
          }
        } else if (targetCanBeBurned(engine, t)) {
          // Not yet burned + not immune → apply Burned (permanent).
          if (t.type === 'hero') {
            await engine.addHeroStatus(t.owner, t.heroIdx, 'burned', {
              permanent: true,
              appliedBy: pi,
              _skipReactionCheck: true,
            });
          } else {
            const inst = engine.cardInstances.find(c => c.id === t.inst.id);
            if (inst && engine.canApplyCreatureStatus(inst, 'burned')) {
              inst.counters.burned = true;
              engine.log('creature_burned', {
                card: inst.name, owner: inst.owner, by: CARD_NAME,
              });
            }
          }
        }
        // Else: burn-immune + not yet burned → nothing (animation
        // already played, which matches the user's spec).
      }

      engine.log('heat_wave', {
        player: ps.username,
        damageLocked,
        targetCount: targets.length,
      });
      engine.sync();
    },
  },
};
