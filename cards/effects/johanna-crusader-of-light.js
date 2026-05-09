// ═══════════════════════════════════════════
//  CARD EFFECT: "Johanna, Crusader of Light"
//  Hero — Two passive effects:
//    1) Other Heroes you control are immune to
//       negative status effects, while Johanna is
//       alive and not incapacitated (Frozen,
//       Stunned, Negated).
//    2) Once per turn, when another target you
//       control takes damage, you may redirect
//       half of it (rounded up) to this Hero.
//
//  Wiring:
//    • Status-immunity gate lives ENGINE-SIDE in
//      `actionAddStatus` (right next to the first-
//      turn-protection / charmed / immune blocks).
//      Heroes can still be CHOSEN as targets — the
//      status simply doesn't land. Johanna herself
//      isn't covered by her own protection. See
//      `_engine.js` for the gate.
//    • When Johanna becomes un-incapacitated
//      (frozen/stunned/negated removed, or revived
//      via heal-from-zero), `cleanseAllies` strips
//      every cleansable negative status from her
//      sibling Heroes and fires the
//      `johanna_cleanse` golden-light animation on
//      each affected slot. Triggered from
//      `onStatusRemoved` and `afterHeal`.
//    • Damage redirect uses `beforeDamage` (Hero
//      target) and `beforeCreatureDamageBatch`
//      (Creature targets, batched). The handler
//      prompts the controller; on accept, splits
//      the entry's amount and queues a follow-up
//      `actionDealDamage` to Johanna for the
//      redirected half. The recursive damage call
//      to Johanna re-enters beforeDamage, but the
//      `target === johannaHero` self-skip prevents
//      re-redirect, and the HOPT lockout prevents
//      double-trigger across instances even if
//      somehow re-entered.
//    • HOPT key: `johanna_redirect:<ownerIdx>:<heroIdx>`.
//      Per-instance (each Johanna copy is
//      independent — multi-Johanna setups are rare
//      but possible via Mary's Lv-bypass etc.).
// ═══════════════════════════════════════════

const { getCleansableStatuses } = require('./_hooks');

const CARD_NAME = 'Johanna, Crusader of Light';

/**
 * True when Johanna is alive and not incapacitated by frozen / stunned
 * / negated. The status-immunity gate (in `_engine.js`'s
 * `actionAddStatus`) and the redirect hooks below all key off this.
 */
function _johannaActive(johannaHero) {
  if (!johannaHero || johannaHero.hp <= 0) return false;
  const s = johannaHero.statuses;
  if (s?.frozen || s?.stunned || s?.negated) return false;
  return true;
}

/**
 * Strip every cleansable negative status from Johanna's sibling Heroes.
 * Fires the golden-light animation per slot that actually had something
 * removed. Called when Johanna transitions back to "active" (frozen/
 * stunned/negated removed, or healed from 0 HP).
 */
async function _cleanseAllies(engine, ownerIdx, johannaIdx) {
  const ps = engine.gs.players[ownerIdx];
  if (!ps) return;
  const cleansable = getCleansableStatuses();
  let anyCleansed = false;
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    if (hi === johannaIdx) continue;
    const ally = ps.heroes[hi];
    if (!ally?.name || ally.hp <= 0) continue;
    if (!ally.statuses) continue;
    // Quick gate: skip if the ally has nothing to cleanse.
    const has = cleansable.some(k => ally.statuses[k]);
    if (!has) continue;

    const removed = engine.cleanseHeroStatuses(ally, ownerIdx, hi, cleansable, CARD_NAME);
    if ((removed || []).length === 0) continue;

    anyCleansed = true;
    engine._broadcastEvent('play_zone_animation', {
      type:    'johanna_cleanse',
      owner:   ownerIdx,
      heroIdx: hi,
      zoneSlot: -1,
    });
  }
  if (anyCleansed) {
    engine.log('johanna_cleanse', { player: ps.username });
    engine.sync();
  }
}

module.exports = {
  activeIn: ['hero'],

  // CPU threat assessment: passive blanket immunity for the team plus a
  // ~50%-of-one-damage-instance shield per turn. Hard to model
  // numerically — value is highly position-dependent. Mark her as a
  // priority target so the CPU prioritizes opening with attacks that
  // hit Johanna directly (her own protection doesn't cover her).
  threatTags: ['priority_target'],

  hooks: {
    /**
     * Hero-target damage redirect. Half (rounded up) of the incoming
     * damage to a sibling hero is rerouted to Johanna. The "split" is
     * done by reducing `ctx.amount` and dealing a fresh damage call to
     * Johanna for the redirected amount.
     */
    beforeDamage: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const johannaInst = ctx.card;
      if (!johannaInst || johannaInst.zone !== 'hero') return;
      const target = ctx.target;
      if (!target || target.hp == null) return;
      if (ctx.amount == null || ctx.amount <= 0) return;

      const ownerIdx = johannaInst.owner;
      const ownerPs = gs.players[ownerIdx];
      if (!ownerPs) return;
      const johannaHero = ownerPs.heroes?.[johannaInst.heroIdx];
      if (!_johannaActive(johannaHero)) return;
      if (johannaHero === target) return; // self-target — no redirect

      // Target must be one of Johanna's sibling Heroes.
      if (!(ownerPs.heroes || []).includes(target)) return;

      const hoptKey = `johanna_redirect:${ownerIdx}:${johannaInst.heroIdx}`;
      if (gs.hoptUsed?.[hoptKey] === gs.turn) return;

      const redirected = Math.ceil(ctx.amount / 2);
      if (redirected <= 0) return;

      // Prompt the controller. Decline → leave the damage intact and
      // DON'T mark HOPT, so a later damage instance this turn can still
      // be redirected.
      const choice = await engine.promptGeneric(ownerIdx, {
        type:        'confirm',
        title:       CARD_NAME,
        message:     `Redirect ${redirected} of ${ctx.amount} damage from ${target.name || 'your Hero'} to ${CARD_NAME}? (Once per turn — accepting locks out further redirects this turn.)`,
        confirmLabel: '✨ Yes, redirect!',
        cancelLabel:  'No',
        cancellable: true,
      });
      if (!choice) return;
      if (typeof choice === 'object' && (choice.cancelled || choice.confirmed === false)) return;

      // Commit the redirect.
      if (!gs.hoptUsed) gs.hoptUsed = {};
      gs.hoptUsed[hoptKey] = gs.turn;
      // `ctx.amount` is a COPY of `hookCtx.amount` (the engine spreads
      // hookCtx into ctx, which clones primitives by value). Writing
      // through `ctx.modifyAmount` is the canonical path — it updates
      // `hookCtx.amount`, which is what the engine reads after the
      // hook returns. The previous `ctx.amount -= redirected` only
      // mutated the local copy, so the original target still took
      // full damage AND Johanna ate the redirected half on top.
      ctx.modifyAmount(-redirected);

      // Deal the redirected half to Johanna. The recursive damage call
      // re-enters this hook, but target === johannaHero short-circuits
      // immediately, and the HOPT lockout above is the belt-and-
      // suspenders backstop.
      await engine.actionDealDamage(ctx.source, johannaHero, redirected, ctx.type || 'normal');
    },

    /**
     * Creature-target damage redirect. The damage path for Creatures is
     * batched — a single Attack/Spell can hit multiple creatures in one
     * call. Walks the entries in order; for each sibling-controlled
     * Creature entry, prompts the controller. Decline keeps walking
     * (the player might want to redirect from a bigger entry later in
     * the batch); accept commits HOPT and breaks out of the loop.
     */
    beforeCreatureDamageBatch: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const johannaInst = ctx.card;
      if (!johannaInst || johannaInst.zone !== 'hero') return;
      const ownerIdx = johannaInst.owner;
      const ownerPs = gs.players[ownerIdx];
      if (!ownerPs) return;
      const johannaHero = ownerPs.heroes?.[johannaInst.heroIdx];
      if (!_johannaActive(johannaHero)) return;

      const hoptKey = `johanna_redirect:${ownerIdx}:${johannaInst.heroIdx}`;
      if (gs.hoptUsed?.[hoptKey] === gs.turn) return;

      const entries = ctx.entries || [];
      for (const e of entries) {
        if (gs.hoptUsed?.[hoptKey] === gs.turn) break; // accepted earlier
        if (e.cancelled) continue;
        if (!e.inst || e.inst.zone !== 'support') continue;
        if (e.amount == null || e.amount <= 0) continue;
        const targetCtrl = e.inst.controller ?? e.inst.owner;
        if (targetCtrl !== ownerIdx) continue;

        const redirected = Math.ceil(e.amount / 2);
        if (redirected <= 0) continue;

        const choice = await engine.promptGeneric(ownerIdx, {
          type:        'confirm',
          title:       CARD_NAME,
          message:     `Redirect ${redirected} of ${e.amount} damage from ${e.inst.name} to ${CARD_NAME}? (Once per turn — accepting locks out further redirects this turn.)`,
          confirmLabel: '✨ Yes, redirect!',
          cancelLabel:  'No',
          cancellable: true,
        });
        if (!choice) continue;
        if (typeof choice === 'object' && (choice.cancelled || choice.confirmed === false)) continue;

        if (!gs.hoptUsed) gs.hoptUsed = {};
        gs.hoptUsed[hoptKey] = gs.turn;
        e.amount -= redirected;

        await engine.actionDealDamage(e.source, johannaHero, redirected, e.type || 'normal');
        break;
      }
    },

    /**
     * Re-evaluate the protection on Johanna's allies when a status is
     * removed from Johanna. If she's now alive AND no longer
     * incapacitated, cleanse every sibling Hero's negative statuses
     * with a golden-light animation on each affected slot.
     */
    onStatusRemoved: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const inst = ctx.card;
      if (!inst || inst.zone !== 'hero') return;
      const ownerPs = gs.players[inst.owner];
      const johannaHero = ownerPs?.heroes?.[inst.heroIdx];
      if (!johannaHero) return;
      // Only react when the status removal was on Johanna herself, and
      // only for the three incapacitating statuses (other status
      // removals don't change her active/inactive state).
      if (ctx.target !== johannaHero) return;
      if (!['frozen', 'stunned', 'negated'].includes(ctx.status)) return;
      if (!_johannaActive(johannaHero)) return;
      await _cleanseAllies(engine, inst.owner, inst.heroIdx);
    },

    /**
     * Re-evaluate the protection when Johanna is healed (e.g. revived
     * from 0 HP). Same cleanse path as `onStatusRemoved` — fires only
     * when Johanna is in a fully-active state after the heal.
     */
    afterHeal: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const inst = ctx.card;
      if (!inst || inst.zone !== 'hero') return;
      const ownerPs = gs.players[inst.owner];
      const johannaHero = ownerPs?.heroes?.[inst.heroIdx];
      if (!johannaHero) return;
      if (ctx.target !== johannaHero) return;
      if (!_johannaActive(johannaHero)) return;
      await _cleanseAllies(engine, inst.owner, inst.heroIdx);
    },
  },
};
