// ═══════════════════════════════════════════
//  CARD EFFECT: "Grand Inquisitor Karian"
//  Hero (500 HP, 60 ATK — Support Magic + Toughness)
//
//  Three-part passive that splits negative statuses
//  into three buckets via STATUS_EFFECTS metadata
//  (`paralysisLike` / `dealsTickDamage`):
//
//  ┌── BUCKET 1 — damaging negatives (burned,
//  │   poisoned, future). The status sticks (icon
//  │   + tick continue) but every damage tick is
//  │   redirected to healing for the same amount.
//  │   Detected by engine source-name match against
//  │   `getStatusDamageSourceNames()`.
//  │
//  ├── BUCKET 2 — paralysisLike negatives (frozen,
//  │   stunned, future). Status sticks (icon shows,
//  │   duration ticks normally), BUT during Karian's
//  │   own Action Phase she is briefly de-statused
//  │   so the engine's incapacitation gates pass.
//  │   The statuses are restored at phase end so the
//  │   END-phase tick decrements them on schedule.
//  │   While afflicted she also gets one bonus
//  │   Action via the canonical `ps.bonusActions`
//  │   channel (Ghuanjun's combo / Shamanic Curse
//  │   refund use the same field; engine.js:7606).
//  │
//  └── BUCKET 3 — every other negative status
//      (negated, nulled, bound, future). Blocked at
//      apply time by stamping each status's own
//      `immuneKey` (e.g. `hero.statuses.negate_immune
//      = 1`) — engine.js:16102 reads this and short-
//      circuits addHeroStatus.
//
//  Forward-compat: a new negative status auto-
//  integrates by setting `paralysisLike` /
//  `dealsTickDamage`+`damageSourceName` on its
//  STATUS_EFFECTS entry. No edits to this file
//  required — both helpers are queried at runtime.
//
//  Hooks fire while Karian is paralysed thanks to
//  `bypassStatusFilter: true` (Beato's pattern,
//  engine.js:1764). Without it her own onPhaseStart
//  would be silenced by the very status it's trying
//  to suspend.
// ═══════════════════════════════════════════

const {
  STATUS_EFFECTS, PHASES,
  getStatusDamageSourceNames, getParalysisStatuses, getNegativeStatuses,
} = require('./_hooks');

const CARD_NAME = 'Grand Inquisitor Karian';
const SUSPENDED_KEY = '_karianSuspendedParalysis';

/**
 * Resolve Karian's hero object from a hook ctx. Uses
 * `cardOriginalOwner` (immune to charm-redirected ctx fields) and the
 * card-instance's `heroIdx`. Returns null if Karian's slot is empty.
 */
function _karianHero(ctx) {
  const engine = ctx._engine;
  const ps = engine.gs.players[ctx.cardOriginalOwner];
  return ps?.heroes?.[ctx.cardHeroIdx] || null;
}

/**
 * Stamp Bucket-3 immunities (every negative status that's neither
 * paralysisLike nor dealsTickDamage) onto Karian's `hero.statuses`
 * via each status's `immuneKey`. Idempotent — re-applied on
 * onGameStart / onPlay / onTurnStart / onHeroRevive so revives
 * (which clear `hero.statuses`, engine.js:4346) and any future
 * status-clear paths never silently turn the immunity off.
 *
 * Generic over STATUS_EFFECTS — adding a new "other" negative
 * status auto-grants Karian immunity once it's listed in _hooks.js.
 */
function _applyImmunities(hero) {
  if (!hero?.name || hero.hp <= 0) return;
  if (!hero.statuses) hero.statuses = {};
  for (const name of getNegativeStatuses()) {
    const def = STATUS_EFFECTS[name];
    if (!def?.immuneKey) continue;
    if (def.paralysisLike) continue;     // Bucket 2 — should still apply.
    if (def.dealsTickDamage) continue;   // Bucket 1 — should still apply (heal-redirect).
    hero.statuses[def.immuneKey] = 1;
  }
}

/**
 * Move every paralysisLike status off `hero.statuses` into a stash
 * so the engine's frozen/stunned gates (engine.js:7574, :7891, etc.)
 * see her as un-paralysed. Returns true iff anything was suspended.
 *
 * Stash format mirrors the original `hero.statuses[name]` value verbatim
 * so duration / appliedBy / icon-render data round-trips on restore.
 */
function _suspendParalysis(hero) {
  if (!hero?.statuses) return false;
  const stash = hero[SUSPENDED_KEY] || {};
  let touched = false;
  for (const name of getParalysisStatuses()) {
    const cur = hero.statuses[name];
    if (cur == null) continue;
    stash[name] = cur;
    delete hero.statuses[name];
    touched = true;
  }
  if (touched) hero[SUSPENDED_KEY] = stash;
  return touched;
}

/**
 * Restore stashed paralysisLike statuses back onto `hero.statuses`.
 * Skips any name that has been re-applied during the suspension window
 * (a late freeze landing while Karian is acting): the live entry wins
 * over the stale stash, so the new duration is what ticks at END.
 */
function _restoreParalysis(hero) {
  const stash = hero?.[SUSPENDED_KEY];
  if (!stash) return;
  if (!hero.statuses) hero.statuses = {};
  for (const [name, val] of Object.entries(stash)) {
    if (hero.statuses[name] == null) hero.statuses[name] = val;
  }
  delete hero[SUSPENDED_KEY];
}

/**
 * Grant Karian one bonus Action via the engine's canonical
 * `ps.bonusActions = { heroIdx, remaining }` channel — the same slot
 * Ghuanjun's combo / Shamanic Curse refund / engine.js:7606 hand-card
 * gating already read. Idempotent: a second call while a Karian-
 * scoped grant is still live just refreshes `remaining` to 1, never
 * stacks (the rule says "a second Action", singular).
 */
function _grantBonusAction(engine, pi, heroIdx) {
  const ps = engine.gs.players[pi];
  if (!ps) return;
  const cur = ps.bonusActions;
  if (cur && cur.heroIdx !== heroIdx) return; // Don't override another card's grant.
  ps.bonusActions = { heroIdx, remaining: 1 };
}

module.exports = {
  activeIn: ['hero'],
  // Beato pattern — let Karian's own hooks fire while she's frozen /
  // stunned / negated, otherwise the very phase hook that's supposed
  // to lift her paralysis would itself be silenced.
  bypassStatusFilter: true,

  hooks: {
    // ─── Bucket 3 — block "other" negatives ─────────────────────
    onGameStart: (ctx) => _applyImmunities(_karianHero(ctx)),
    onPlay:      (ctx) => _applyImmunities(_karianHero(ctx)),
    onTurnStart: (ctx) => _applyImmunities(_karianHero(ctx)),
    onHeroRevive: (ctx) => {
      // Revival clears hero.statuses (engine.js:4346) — re-stamp every
      // immune key the moment Karian wakes up. Filter to Karian's own
      // slot since this hook fires for every revive on the board.
      if (ctx.playerIdx !== ctx.cardOriginalOwner) return;
      if (ctx.heroIdx !== ctx.cardHeroIdx) return;
      _applyImmunities(_karianHero(ctx));
    },

    // ─── Bucket 2 — paralysisLike: act despite + bonus Action ───
    onPhaseStart: async (ctx) => {
      if (ctx.phaseIndex !== PHASES.ACTION) return;
      const engine = ctx._engine;
      // Only the active player gets the bonus Action — the rule says
      // "during your Action Phase".
      if (engine.gs.activePlayer !== ctx.cardOriginalOwner) return;
      const hero = _karianHero(ctx);
      if (!hero?.name || hero.hp <= 0) return;
      const wasAfflicted = _suspendParalysis(hero);
      if (!wasAfflicted) return;
      _grantBonusAction(engine, ctx.cardOriginalOwner, ctx.cardHeroIdx);
      engine.log('karian_shake_off', { hero: hero.name });
      engine.sync();
    },

    onPhaseEnd: async (ctx) => {
      if (ctx.phaseIndex !== PHASES.ACTION) return;
      const engine = ctx._engine;
      if (engine.gs.activePlayer !== ctx.cardOriginalOwner) return;
      const hero = _karianHero(ctx);
      if (!hero) return;
      _restoreParalysis(hero);
      engine.sync();
    },

    // Defensive restore: if Karian dies during the Action Phase the
    // onPhaseEnd hook is filtered out by the dead-hero gate
    // (engine.js:1761), leaving the suspended stash dangling. Wipe it
    // so a later revive doesn't re-apply a stale freeze.
    onHeroKO: (ctx) => {
      if (!ctx.hero || ctx.hero !== _karianHero(ctx)) return;
      delete ctx.hero[SUSPENDED_KEY];
    },

    // Keep the Action Phase open while the Karian-locked bonus is
    // still unspent. The engine's auto-advance gate
    // (advanceToPhase, engine.js:8981-8999) only honours
    // `_bonusMainActions` and `isSecondActionGrant`-tagged provider
    // instances — hero-locked `ps.bonusActions.remaining` is NOT in
    // that list. Ghuanjun's combo (ghuanjun-the-undead-martial-
    // artist.js:107-109) papers over the same gap by stamping
    // `gs._preventPhaseAdvance = true` from `onActionUsed`; we mirror
    // that pattern. The flag is one-shot — server.js:3554 deletes it
    // after the auto-advance check — so we re-stamp on every action
    // while the bonus is still pending.
    //
    // Bonus consumption rule: drop `bonusActions.remaining` to 0 only
    // when KARIAN herself is the actor AND it isn't her first action
    // of the phase. That keeps the bonus available across:
    //   • Action 1 by Karian → bonus pending for Action 2.
    //   • Action 1 by another hero → bonus pending for Karian.
    //   • Action 1 by Karian + Action 2 via Coffee/Friendship/etc. on
    //     another hero → bonus still pending for Karian's 3rd Action,
    //     since her bonus is independent of generic additional-Action
    //     providers.
    onActionUsed: (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      if (gs.currentPhase !== PHASES.ACTION) return;
      if (ctx.playerIdx !== ctx.cardOriginalOwner) return;
      const ps = gs.players[ctx.cardOriginalOwner];
      if (!ps?.bonusActions) return;
      if (ps.bonusActions.heroIdx !== ctx.cardHeroIdx) return;
      if (!(ps.bonusActions.remaining > 0)) return;

      const wasKarianAction = ctx.heroIdx === ctx.cardHeroIdx;
      const actionsPlayed = ps._actionsPlayedThisPhase || 0;
      if (wasKarianAction && actionsPlayed > 1) {
        ps.bonusActions.remaining = 0;
      }
      if (ps.bonusActions.remaining > 0) {
        gs._preventPhaseAdvance = true;
      }
    },

    // Late-applied paralysis during Karian's own Action Phase (e.g. a
    // Snow Cannon Surprise reacting to her first action). Re-suspend
    // immediately so the rest of the phase stays usable, and refresh
    // the bonus Action — the rule grants it "while" afflicted, so
    // becoming afflicted mid-phase still qualifies.
    onStatusApplied: async (ctx) => {
      const def = STATUS_EFFECTS[ctx.statusName];
      if (!def?.paralysisLike) return;
      const engine = ctx._engine;
      if (engine.gs.currentPhase !== PHASES.ACTION) return;
      if (engine.gs.activePlayer !== ctx.cardOriginalOwner) return;
      const hero = _karianHero(ctx);
      if (!hero || hero !== ctx.target) return;
      const touched = _suspendParalysis(hero);
      if (!touched) return;
      _grantBonusAction(engine, ctx.cardOriginalOwner, ctx.cardHeroIdx);
      engine.log('karian_shake_off', { hero: hero.name, from: ctx.statusName });
      engine.sync();
    },

    // ─── Bucket 1 — redirect status-tick damage to healing ──────
    beforeDamage: async (ctx) => {
      const hero = _karianHero(ctx);
      if (!hero || ctx.target !== hero) return;
      const sourceName = ctx.source?.name;
      if (!sourceName) return;
      const damageSourceNames = new Set(getStatusDamageSourceNames());
      if (!damageSourceNames.has(sourceName)) return;
      const amount = ctx.amount || 0;
      ctx.cancel();
      if (amount <= 0 || hero.hp <= 0) return;
      await ctx.healHero(hero, amount);
      ctx._engine.log('karian_status_heal', {
        hero: hero.name, source: sourceName, amount,
      });
    },
  },
};
