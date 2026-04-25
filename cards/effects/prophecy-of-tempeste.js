// ═══════════════════════════════════════════
//  CARD EFFECT: "Prophecy of Tempeste"
//  Spell (Magic Arts Lv3, Attachment)
//
//  Attach to a Hero you control. Once per turn,
//  when another target you control would take
//  damage, you may redirect that damage to this
//  Hero. Damage this Hero would take cannot
//  exceed 100. Damage this Hero takes cannot be
//  reduced or negated by other cards or effects.
//
//  Implementation
//  ──────────────
//  • Attachment: drops into a free Support Zone
//    on the caster's chosen Hero. Falls back to
//    the casting Hero, then any other own Hero
//    with a free slot, then fizzles.
//  • Hero damage redirect: `beforeDamage` hook.
//    Cancels the original damage and immediately
//    re-fires actionDealDamage on the host with
//    a 100-cap and `cannotBeNegated: true`.
//  • Creature damage redirect: handled in the
//    `beforeCreatureDamageBatch` hook by
//    cancelling individual entries and firing
//    a follow-up actionDealDamage on the host.
//  • Once per turn: HOPT key scoped per
//    Tempeste instance (`tempeste_redirect:
//    <instId>`). Each Tempeste fires once per
//    turn independently.
//  • Damage cap (100): applied locally by
//    Tempeste before re-firing. Internal — the
//    "cannot be reduced" rule doesn't apply to
//    Tempeste's own caps.
//  • "Cannot be reduced or negated": passes
//    `cannotBeNegated: true` to the redirect's
//    actionDealDamage, which the engine reads to
//    skip Cloudy / buff multipliers. Smug Coin /
//    pre-damage hand reactions still fire by
//    design — the rule keeps board effects from
//    cancelling the redirect, not hand-card
//    reactions which are emergency saves.
//  • Re-entry guard: a `_tempesteRedirected`
//    flag stamped on the synthetic source +
//    cleared after the redirect resolves
//    prevents the same Tempeste from
//    catching its own redirected hit and
//    re-routing again.
//  • Permanent rain: client-side overlay,
//    started on attach (`tempeste_rain_start`)
//    and stopped on leave-zone
//    (`tempeste_rain_stop`).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME    = 'Prophecy of Tempeste';
const DAMAGE_CAP   = 100;
const ANIM_FLY_MS  = 700;

function findFreeSlot(ps, heroIdx) {
  const sz = ps.supportZones?.[heroIdx] || [[], [], []];
  for (let si = 0; si < 3; si++) {
    if (((sz[si] || []).length) === 0) return si;
  }
  return -1;
}

/** True if there's at least one own hero with a free Support Zone. */
function ownerHasAttachableHero(ps) {
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const h = ps.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    if (findFreeSlot(ps, hi) >= 0) return true;
  }
  return false;
}

module.exports = {
  activeIn: ['hand', 'support'],

  spellPlayCondition(gs, playerIdx /* , engine */) {
    const ps = gs.players[playerIdx];
    if (!ps) return false;
    return ownerHasAttachableHero(ps);
  },

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;

      const engine  = ctx._engine;
      const gs      = engine.gs;
      const pi      = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps      = gs.players[pi];
      if (!ps) { gs._spellCancelled = true; return; }

      // ── Pick destination Hero + slot ──
      let destHero = -1;
      let destSlot = -1;
      if (gs._attachmentZoneSlot != null && gs._attachmentZoneSlot >= 0) {
        const si = gs._attachmentZoneSlot;
        const slot = (ps.supportZones[heroIdx] || [])[si] || [];
        if (slot.length === 0) { destHero = heroIdx; destSlot = si; }
      }
      if (destSlot < 0) {
        const si = findFreeSlot(ps, heroIdx);
        if (si >= 0) { destHero = heroIdx; destSlot = si; }
      }
      if (destSlot < 0) {
        for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
          if (hi === heroIdx) continue;
          const h = ps.heroes[hi];
          if (!h?.name || h.hp <= 0) continue;
          const si = findFreeSlot(ps, hi);
          if (si >= 0) { destHero = hi; destSlot = si; break; }
        }
      }
      if (destSlot < 0) { gs._spellCancelled = true; return; }

      // ── Place into the chosen Support Zone ──
      if (!ps.supportZones[destHero]) ps.supportZones[destHero] = [[], [], []];
      if (!ps.supportZones[destHero][destSlot]) ps.supportZones[destHero][destSlot] = [];
      ps.supportZones[destHero][destSlot].push(CARD_NAME);

      // Re-track from hand → support
      const oldInst = engine.cardInstances.find(c =>
        c.owner === pi && c.name === CARD_NAME && c.zone === 'hand' && c.id === ctx.card.id
      );
      if (oldInst) engine._untrackCard(oldInst.id);

      const inst = engine._trackCard(CARD_NAME, pi, 'support', destHero, destSlot);
      gs._spellPlacedOnBoard = true;

      // Permanent rain overlay — client owns the lifetime by listening
      // to start + stop pairs keyed on (owner, heroIdx, zoneSlot).
      engine._broadcastEvent('tempeste_rain_start', {
        instId: inst.id,
        owner: pi, heroIdx: destHero, zoneSlot: destSlot,
      });

      engine.log('prophecy_of_tempeste_attached', {
        player: ps.username, hero: ps.heroes[destHero]?.name,
      });

      await engine.runHooks('onCardEnterZone', {
        enteringCard: inst, toZone: 'support', toHeroIdx: destHero,
        _skipReactionCheck: true,
      });
      engine.sync();
    },

    /**
     * Stop the rain overlay when this card leaves its support zone
     * (destroyed, swapped, etc.).
     */
    onCardLeaveZone: async (ctx) => {
      if (ctx.leavingCard?.id !== ctx.card.id) return;
      if (ctx.fromZone !== 'support') return;
      ctx._engine._broadcastEvent('tempeste_rain_stop', {
        instId: ctx.card.id,
      });
    },

    /**
     * Hero damage redirect. Fires on every hero damage instance — we
     * filter here for "another target on the controller's side, not the
     * host" and prompt the controller for an opt-in redirect.
     */
    beforeDamage: async (ctx) => {
      if (ctx.cardZone !== 'support') return;
      if (ctx.cancelled) return;
      // Re-entry guard: skip the redirected hit so we don't loop.
      if (ctx.source?._tempesteRedirected) return;

      const engine = ctx._engine;
      const gs     = engine.gs;
      const ownerIdx = ctx.cardOwner;
      const ps     = gs.players[ownerIdx];
      if (!ps) return;

      // Host must still be alive + functional.
      const host = ctx.attachedHero;
      if (!host?.name || host.hp <= 0) return;
      if (host.statuses?.frozen || host.statuses?.stunned || host.statuses?.negated) return;

      // Target must be a hero on the SAME side, NOT the host itself.
      const target = ctx.target;
      if (!target || target.hp === undefined || target.hp <= 0) return;
      if (target === host) return;
      const targetOwnerIdx = engine._findHeroOwner(target);
      if (targetOwnerIdx !== ownerIdx) return;

      // Once per turn (per Tempeste instance).
      const hoptKey = `tempeste_redirect:${ctx.card.id}`;
      if (gs.hoptUsed?.[hoptKey] === gs.turn) return;

      // Prompt the controller (the player holding Tempeste).
      const heroName = target.name || 'Hero';
      const srcName  = ctx.source?.name || 'An effect';
      const incoming = ctx.amount || 0;
      const confirmed = await engine.promptGeneric(ownerIdx, {
        type: 'confirm',
        title: CARD_NAME,
        message: `${heroName} is about to take ${incoming} damage from ${srcName}. Redirect to ${host.name}? (Capped at ${DAMAGE_CAP})`,
        showCard: CARD_NAME,
        confirmLabel: '🌧️ Redirect!',
        cancelLabel: 'No',
        cancellable: true,
      });
      if (!confirmed) return;

      // Claim HOPT NOW so the same instance can't be re-prompted by a
      // mid-redirect cascade (extremely unlikely but defensive).
      if (!gs.hoptUsed) gs.hoptUsed = {};
      gs.hoptUsed[hoptKey] = gs.turn;

      // Cap before the redirect — Tempeste's own cap is exempt from
      // "cannot be reduced".
      const cappedAmount = Math.min(DAMAGE_CAP, incoming);

      // Cancel the original hit.
      ctx.cancelled = true;

      // Visual: brief lightning thread from the original target to host.
      engine._broadcastEvent('tempeste_redirect_strike', {
        srcOwner: ownerIdx, srcHeroIdx: targetOwnerIdx === ownerIdx ? ctx.cardHeroIdx : -1,
        fromOwner: targetOwnerIdx,
        fromHeroIdx: ps.heroes.indexOf(target),
        toOwner: ownerIdx, toHeroIdx: ctx.cardHeroIdx,
      });
      await engine._delay(ANIM_FLY_MS);

      // Re-fire the damage on the host. The synthetic source carries the
      // redirect flag so this hook doesn't catch its own re-entry, and
      // `cannotBeNegated: true` skips Cloudy / buff multipliers in the
      // engine's damage path.
      const syntheticSource = {
        ...(ctx.source || {}),
        _tempesteRedirected: true,
      };
      await engine.actionDealDamage(syntheticSource, host, cappedAmount, ctx.type, {
        cannotBeNegated: true,
      });

      engine.log('prophecy_of_tempeste_redirect', {
        player: ps.username,
        from: target.name,
        to: host.name,
        original: incoming,
        applied: cappedAmount,
      });
      engine.sync();
    },

    /**
     * Creature damage redirect. The engine batches creature damage —
     * this hook receives the full entries[] and we cancel any entry
     * whose target is on the controller's side (a redirect candidate),
     * then fire actionDealDamage on the host for the capped amount.
     *
     * Limitation: the engine doesn't fan-out per-entry prompts before
     * batch resolution, so we prompt per entry inline. The HOPT lock
     * applies to the Tempeste instance, so at most one creature
     * redirect happens per turn even if a multi-target damage spell
     * dumps on multiple of our creatures simultaneously.
     */
    beforeCreatureDamageBatch: async (ctx) => {
      if (ctx.cardZone !== 'support') return;

      const engine = ctx._engine;
      const gs     = engine.gs;
      const ownerIdx = ctx.cardOwner;
      const ps     = gs.players[ownerIdx];
      if (!ps) return;

      const host = ctx.attachedHero;
      if (!host?.name || host.hp <= 0) return;
      if (host.statuses?.frozen || host.statuses?.stunned || host.statuses?.negated) return;

      const hoptKey = `tempeste_redirect:${ctx.card.id}`;
      if (gs.hoptUsed?.[hoptKey] === gs.turn) return;

      const entries = ctx.entries || [];
      // First eligible entry whose target belongs to the controller.
      let candidate = null;
      for (const e of entries) {
        if (e.cancelled) continue;
        if (!e.inst) continue;
        if (e.inst.controller !== ownerIdx && e.inst.owner !== ownerIdx) continue;
        // Skip entries whose source is our own redirect re-fire.
        if (e.source?._tempesteRedirected) continue;
        if (e.amount <= 0) continue;
        candidate = e;
        break;
      }
      if (!candidate) return;

      const incoming = candidate.amount || 0;
      const srcName  = candidate.source?.name || 'An effect';
      const confirmed = await engine.promptGeneric(ownerIdx, {
        type: 'confirm',
        title: CARD_NAME,
        message: `${candidate.inst.name} is about to take ${incoming} damage from ${srcName}. Redirect to ${host.name}? (Capped at ${DAMAGE_CAP})`,
        showCard: CARD_NAME,
        confirmLabel: '🌧️ Redirect!',
        cancelLabel: 'No',
        cancellable: true,
      });
      if (!confirmed) return;

      if (!gs.hoptUsed) gs.hoptUsed = {};
      gs.hoptUsed[hoptKey] = gs.turn;

      const cappedAmount = Math.min(DAMAGE_CAP, incoming);
      candidate.cancelled = true;

      engine._broadcastEvent('tempeste_redirect_strike', {
        fromOwner: candidate.inst.owner,
        fromHeroIdx: candidate.inst.heroIdx,
        fromZoneSlot: candidate.inst.zoneSlot,
        toOwner: ownerIdx, toHeroIdx: ctx.cardHeroIdx,
      });
      await engine._delay(ANIM_FLY_MS);

      const syntheticSource = {
        ...(candidate.source || {}),
        _tempesteRedirected: true,
      };
      await engine.actionDealDamage(syntheticSource, host, cappedAmount, candidate.type || 'normal', {
        cannotBeNegated: true,
      });

      engine.log('prophecy_of_tempeste_redirect', {
        player: ps.username,
        from: candidate.inst.name,
        to: host.name,
        original: incoming,
        applied: cappedAmount,
      });
      engine.sync();
    },
  },
};
