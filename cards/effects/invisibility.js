// ═══════════════════════════════════════════
//  CARD EFFECT: "Invisibility"
//  Spell (Magic Arts Lv 1, Attachment).
//
//  "Attach this card to a Hero you control. That
//   Hero cannot be chosen by Attacks, Spells or
//   Creature effects by your opponent. If the
//   Hero chooses a target your opponent controls
//   with an Attack or Spell, deals damage to 1 or
//   more targets your opponent controls, or if
//   you control no other Heroes that can be
//   chosen by Attacks or Spells, send this card
//   to your discard pile."
//
//  Implementation
//  ──────────────
//  • Same Attachment shape as Curse / Gathering
//    Storm — the Spell self-places into a free
//    Support Zone of the chosen own Hero. Per-
//    target stamp lives on `hero.statuses.invisible`
//    (new status — registered alongside the
//    existing `untargetable` in the engine's
//    hero-targeting filter so the pool is SHARED:
//    if every hero on a side carries any
//    combination of `invisible` + `untargetable`,
//    the protection collapses and all are
//    choosable).
//  • Anti Magic gate at cast time (Lv 1 Spell).
//  • Self-discard triggers:
//      (1) `onAttackDeclare` — Invisibility-Hero
//          attacks any opp target.
//      (2) `afterSpellResolved` — Invisibility-
//          Hero's Spell damaged any opp target
//          (the engine's damage log filled by the
//          standard pickers).
//      (3) `afterDamage` / `afterCreatureDamageBatch`
//          — any damage from Invisibility-Hero
//          landed on an opp Hero / Creature.
//          Covers paths the spell-log doesn't
//          (Attack damage routed through
//          `actionDealDamage` directly, hero-
//          effect damage, etc.).
//      (4) `onTurnStart` / `onTurnEnd` / `onHeroKO`
//          — periodic "no other choosable hero
//          on my side" check. Mirrors the
//          engine's pool-filter logic exactly: a
//          hero is "choosable by opp" iff the
//          filter would keep it (non-tagged when
//          others are non-tagged; all heroes
//          choosable when all are tagged).
//  • On `onCardLeaveZone` (self-discard OR
//    external destroy — Fire Bomb, Defending the
//    Gate cleanup, etc.), clear the host hero's
//    `invisible` status, but ONLY when this was
//    the last Invisibility on that hero (multi-
//    attach safe).
// ═══════════════════════════════════════════

const CARD_NAME = 'Invisibility';

/** Free Support Zone slot index on `heroIdx` of `ps`, or -1. */
function findFreeSlot(ps, heroIdx) {
  const sz = ps.supportZones?.[heroIdx] || [];
  for (let si = 0; si < 3; si++) {
    if (((sz[si] || []).length) === 0) return si;
  }
  return -1;
}

/** Mirror of the engine's pool-filter logic — true iff at least one
 *  OTHER hero on the same side would be "choosable by opp" right now.
 *
 *  Filter shape (matches `_engine.js#promptDamageTarget` block):
 *    • A hero is "tagged" if it carries `invisible` OR `untargetable`.
 *    • If any hero on the side is non-tagged: only non-tagged are
 *      choosable. Other-non-tagged → choosable.
 *    • If every hero on the side is tagged: filter collapses, all are
 *      choosable. Other-tagged-other → also choosable.
 *
 *  Excludes the Invisibility-Hero itself ("OTHER heroes" in card
 *  text) and dead heroes.
 */
function _hasChoosableOtherHero(ps, invisibilityHeroIdx) {
  const living = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const h = ps.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    living.push({ hi, h });
  }
  const nonTagged = living.filter(({ h }) =>
    !h.statuses?.untargetable && !h.statuses?.invisible);
  if (nonTagged.length === 0) {
    // All-tagged → pool collapses → every living hero is choosable.
    return living.some(({ hi }) => hi !== invisibilityHeroIdx);
  }
  return nonTagged.some(({ hi }) => hi !== invisibilityHeroIdx);
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating (the Spell prompts for a target Hero).
  activeIn: ['hand', 'support'],

  /**
   * Playable iff:
   *   • At least one own Hero has a free Support Zone slot (to host
   *     the attachment), AND
   *   • At least one OTHER own living Hero exists (otherwise trigger
   *     (4) would fire on the same tick as the cast — pointless to
   *     play).
   */
  spellPlayCondition(gs, pi) {
    const ps = gs.players[pi];
    if (!ps) return false;
    const heroes = ps.heroes || [];
    let livingCount = 0;
    let hasFreeSlotHost = false;
    for (let hi = 0; hi < heroes.length; hi++) {
      const h = heroes[hi];
      if (!h?.name || h.hp <= 0) continue;
      livingCount++;
      if (findFreeSlot(ps, hi) >= 0) hasFreeSlotHost = true;
    }
    return livingCount >= 2 && hasFreeSlotHost;
  },

  hooks: {
    onPlay: async (ctx) => {
      // Self-cast gate.
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;

      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const casterHeroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      if (!ps) { gs._spellCancelled = true; return; }

      // ── Pick host Hero ──
      // Build target list — every own living Hero with at least one
      // free Support slot. Honour the drag-drop hint
      // (`gs._attachmentZoneSlot`) when the player dropped on a
      // specific free slot of the caster Hero.
      const targets = [];
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        if (findFreeSlot(ps, hi) < 0) continue;
        targets.push({
          id: `hero-${pi}-${hi}`, type: 'hero',
          owner: pi, heroIdx: hi, cardName: hero.name,
        });
      }
      if (targets.length === 0) { gs._spellCancelled = true; return; }

      let destHero;
      let destSlot;
      if (gs._attachmentZoneSlot != null && gs._attachmentZoneSlot >= 0) {
        const si = gs._attachmentZoneSlot;
        const slot = (ps.supportZones[casterHeroIdx] || [])[si] || [];
        if (slot.length === 0) { destHero = casterHeroIdx; destSlot = si; }
      }
      if (destHero == null) {
        let picked;
        if (targets.length === 1) {
          picked = targets[0];
        } else {
          // `engine.promptEffectTarget` is the correct call — the
          // ctx wrapper doesn't expose a `promptEffectTarget`
          // method. Curse / Gathering Storm / Divine Zeal all go
          // through the engine path directly.
          const result = await engine.promptEffectTarget(pi, targets, {
            title: CARD_NAME,
            description: 'Choose one of your Heroes to make Invisible.',
            confirmLabel: '👻 Hide!',
            confirmClass: 'btn-info',
            cancellable: true,
            exclusiveTypes: true,
            maxPerType: { hero: 1 },
            maxTotal: 1,
            greenSelect: true,
          });
          if (!result || result.length === 0) { gs._spellCancelled = true; return; }
          picked = targets.find(t => t.id === result[0]);
          if (!picked) { gs._spellCancelled = true; return; }
        }
        destHero = picked.heroIdx;
        destSlot = findFreeSlot(ps, destHero);
        if (destSlot < 0) { gs._spellCancelled = true; return; }
      }

      // ── Anti Magic gate ──
      // Lv 1 Spell — any Anti Magic Lv 1+ on the host covers it.
      // Bail BEFORE the support-zone push so the server routes the
      // card to the caster's discard via the standard fizzle path.
      const destHeroObj = ps.heroes?.[destHero];
      if (destHeroObj && engine._isHeroSpellProtected(destHeroObj, CARD_NAME)) {
        engine.log('equip_blocked', {
          card: CARD_NAME, target: destHeroObj.name, reason: 'magic_immune',
        });
        engine._playAntiMagicBlockedAnim(destHeroObj);
        return;
      }

      // ── Attach into the chosen Support Zone ──
      if (!ps.supportZones[destHero]) ps.supportZones[destHero] = [[], [], []];
      if (!ps.supportZones[destHero][destSlot]) ps.supportZones[destHero][destSlot] = [];
      ps.supportZones[destHero][destSlot].push(CARD_NAME);

      // Re-track from hand → support. originalOwner stamping keeps
      // the discard routed to the caster regardless of any future
      // control flip.
      const oldInst = engine.cardInstances.find(c =>
        c.owner === pi && c.name === CARD_NAME && c.zone === 'hand' && c.id === ctx.card.id,
      );
      if (oldInst) engine._untrackCard(oldInst.id);
      const inst = engine._trackCard(CARD_NAME, pi, 'support', destHero, destSlot);
      inst.originalOwner = pi;

      // Stamp the hero. `invisible` is the new status — the engine's
      // hero-targeting filter pools it with `untargetable` (any-combo
      // → if all heroes on a side are tagged, the filter collapses).
      if (!destHeroObj.statuses) destHeroObj.statuses = {};
      destHeroObj.statuses.invisible = true;

      gs._spellPlacedOnBoard = true;

      engine._broadcastEvent('play_zone_animation', {
        type: 'gold_sparkle', owner: pi, heroIdx: destHero, zoneSlot: -1,
      });
      await engine._delay(400);

      await engine.runHooks('onCardEnterZone', {
        enteringCard: inst, toZone: 'support', toHeroIdx: destHero,
        _skipReactionCheck: true,
      });

      engine.log('invisibility_attached', {
        player: ps.username, hero: destHeroObj.name,
      });
      engine.sync();
    },

    /**
     * Self-discard trigger (1): Invisibility-Hero attacks any opp
     * target. `onAttackDeclare` fires after target pick, before
     * damage — captures the "chooses with an Attack" event even when
     * the Attack gets fully negated by a reaction afterwards.
     */
    onAttackDeclare: async (ctx) => {
      if (ctx.card.zone !== 'support') return;
      const src = ctx.source;
      if (src?.heroIdx !== ctx.cardHeroIdx) return;
      if ((src.owner ?? src.controller) !== ctx.cardOwner) return;

      const oppIdx = ctx.cardOwner === 0 ? 1 : 0;
      const targets = Array.isArray(ctx.target)
        ? ctx.target
        : (ctx.target ? [ctx.target] : []);
      if (targets.some(t => t?.owner === oppIdx)) {
        await _selfDiscard(ctx, 'attacked_opp');
      }
    },

    /**
     * Self-discard trigger (2): Invisibility-Hero's Spell damaged
     * 1+ opp targets. `afterSpellResolved` carries the damage log
     * (built up by `promptDamageTarget` / `promptMultiTarget` and the
     * AoE / manual-loop spells via `gs._spellDamageLog`).
     */
    afterSpellResolved: async (ctx) => {
      if (ctx.card.zone !== 'support') return;
      if (ctx.casterIdx !== ctx.cardOwner) return;
      if (ctx.heroIdx !== ctx.cardHeroIdx) return;
      const oppIdx = ctx.cardOwner === 0 ? 1 : 0;
      const dmg = ctx.damageTargets || [];
      if (dmg.some(t => t?.owner === oppIdx)) {
        await _selfDiscard(ctx, 'spell_targeted_opp');
      }
    },

    /**
     * Self-discard trigger (3a): direct hero damage from
     * Invisibility-Hero to opp Hero. `afterDamage` fires per-hit so
     * a single direct damage call lands here. Covers Attack damage
     * routed straight through `actionDealDamage` without going
     * through `afterSpellResolved`'s damage log (some heavy hero-
     * effect attacks etc.).
     */
    afterDamage: async (ctx) => {
      if (ctx.card.zone !== 'support') return;
      if (ctx.sourceHeroIdx !== ctx.cardHeroIdx) return;
      const srcOwner = ctx.source?.owner ?? ctx.source?.controller;
      if (srcOwner !== ctx.cardOwner) return;
      if ((ctx.amount || 0) <= 0) return;
      const oppIdx = ctx.cardOwner === 0 ? 1 : 0;
      // `ctx.target` here is the damaged Hero object — locate its owner.
      const engine = ctx._engine;
      const tgtOwner = engine._findHeroOwner ? engine._findHeroOwner(ctx.target) : -1;
      if (tgtOwner === oppIdx) {
        await _selfDiscard(ctx, 'damaged_opp_hero');
      }
    },

    /**
     * Self-discard trigger (3b): creature-batch damage from
     * Invisibility-Hero. `afterCreatureDamageBatch` fires once per
     * batch with all damaged Creature entries.
     */
    afterCreatureDamageBatch: async (ctx) => {
      if (ctx.card.zone !== 'support') return;
      const oppIdx = ctx.cardOwner === 0 ? 1 : 0;
      for (const e of (ctx.entries || [])) {
        if (!e || e.cancelled) continue;
        if ((e.amount || 0) <= 0) continue;
        const srcHeroIdx = e.source?.heroIdx;
        if (srcHeroIdx !== ctx.cardHeroIdx) continue;
        const srcOwner = e.source?.owner ?? e.sourceOwner;
        if (srcOwner !== ctx.cardOwner) continue;
        const tgtOwner = e.inst?.controller ?? e.inst?.owner;
        if (tgtOwner === oppIdx) {
          await _selfDiscard(ctx, 'damaged_opp_creature');
          return;
        }
      }
    },

    /**
     * Self-discard trigger (4) — periodic "no other choosable hero"
     * check. Fires at every turn boundary and on every hero death,
     * which is when the side's choosable-hero set realistically
     * changes (statuses can change mid-turn but the rare cases are
     * picked up at the next turn tick — the protection just stays
     * one tick longer, never breaks correctness).
     */
    onTurnStart: async (ctx) => {
      if (ctx.card.zone !== 'support') return;
      await _maybeDiscardForNoOthers(ctx);
    },
    onTurnEnd: async (ctx) => {
      if (ctx.card.zone !== 'support') return;
      await _maybeDiscardForNoOthers(ctx);
    },
    onHeroKO: async (ctx) => {
      if (ctx.card.zone !== 'support') return;
      await _maybeDiscardForNoOthers(ctx);
    },

    /**
     * Cleanup — when Invisibility leaves the Support Zone for ANY
     * reason (self-discard, Fire Bomb, Cosmic Manipulation, …),
     * clear the host hero's `invisible` flag. Multi-attach safe:
     * only clears when no other Invisibility instance remains on
     * the same hero.
     */
    onCardLeaveZone: async (ctx) => {
      const card = ctx.card;
      if (!card || card.name !== CARD_NAME) return;
      if (ctx.leavingCard?.id !== card.id) return;
      if (ctx.fromZone !== 'support') return;

      const engine = ctx._engine;
      const hostOwner = card.owner;
      const hostHeroIdx = ctx.fromHeroIdx ?? card.heroIdx;
      const hero = engine.gs.players[hostOwner]?.heroes?.[hostHeroIdx];
      if (!hero?.statuses?.invisible) return;

      // Other Invisibility copies still attached?
      const otherInvisibilities = engine.cardInstances.some(c =>
        c.id !== card.id
        && c.name === CARD_NAME
        && c.zone === 'support'
        && c.owner === hostOwner
        && c.heroIdx === hostHeroIdx,
      );
      if (otherInvisibilities) return;

      delete hero.statuses.invisible;
      engine.log('invisibility_cleared', {
        target: hero.name,
      });
      engine.sync();
    },
  },
};

/** Discard this Invisibility instance to the caster's discard pile.
 *  Idempotent via `inst.zone !== 'support'` short-circuit. The
 *  `onCardLeaveZone` listener above handles the status-clear so this
 *  helper just needs to drive the destroy.
 */
async function _selfDiscard(ctx, reason) {
  const engine = ctx._engine;
  if (!ctx.card || ctx.card.zone !== 'support') return;
  // Auftritt links am Feld (Als Regel 21.8.: „Invisibility, wenn sie
  // sich selbst mit ihrem Effekt entfernt"). In der gemeinsamen
  // Abwurffunktion, damit ALLE vier Ausloeser ihn bekommen.
  await engine.announceHookActivation(CARD_NAME, ctx.cardOwner);
  engine.log('invisibility_self_discard', {
    player: engine.gs.players[ctx.cardOwner]?.username,
    reason,
  });
  await engine.actionDestroyCard(
    { name: CARD_NAME, owner: ctx.cardOwner, heroIdx: ctx.cardHeroIdx },
    ctx.card,
    { ignoreGateShield: true },
  );
}

/** Trigger (4) check — discard Invisibility if no OTHER own Hero is
 *  currently choosable by the opponent. */
async function _maybeDiscardForNoOthers(ctx) {
  const engine = ctx._engine;
  const ps = engine.gs.players[ctx.cardOwner];
  if (!ps) return;
  if (_hasChoosableOtherHero(ps, ctx.cardHeroIdx)) return;
  await _selfDiscard(ctx, 'no_other_choosable_hero');
}
