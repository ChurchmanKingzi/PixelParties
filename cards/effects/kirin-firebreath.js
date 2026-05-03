// ═══════════════════════════════════════════
//  CARD EFFECT: "Kirin Firebreath"
//  Spell (Destruction Magic Lv0, Normal)
//  Archetype: Rebelliokai
//
//  Effect:
//    Delete 1 "Rebelliokai Courtly Kirin" from
//    your discard pile to play this card. Choose
//    a target and deal 50 damage to it as many
//    times as you have "Rebelliokai" Creatures
//    with different names in your discard pile.
//
//  House clarifications (per user spec):
//    • Cost (delete Courtly Kirin) is paid AFTER
//      the first target is selected, BEFORE damage
//      is calculated. The chain-reaction window is
//      the player's last cancellation point — once
//      the first target is locked in, the cost
//      becomes mandatory and the strikes resolve.
//    • The deleted Kirin does NOT count toward the
//      strike scaling (count snapshots after cost
//      is paid).
//    • The player picks a NEW target for each
//      individual 50-damage strike. Each strike is
//      its own damage instance — per-hit reactions
//      (Anti Magic Shield, Fireshield, …) negate
//      ONLY their own strike; the rest continue.
//      A whole-Spell negation (`_spellNegatedByEffect`)
//      breaks the loop early.
//
//  Wiring:
//    • `spellPlayCondition` gates play on a
//      Courtly Kirin sitting in the controller's
//      discard pile.
//    • Cost lives inside `onPlay` (no
//      `payActivationCost`). The chain-reaction
//      window precedes onPlay; if the Spell is
//      negated mid-chain, onPlay never fires and
//      no Kirin is deleted.
//    • `payRebelliokaiCost` does the visible
//      discard→deleted transit (sync + chained
//      flying-card animation + 560 ms wait + push
//      to deletedPile). Must `await` so the count
//      below sees the post-cost discard pile.
//    • Damage type 'destruction_spell' — Anti
//      Magic Shield / Smug Coin / Fireshield each
//      see one independent strike per loop tick.
// ═══════════════════════════════════════════

const {
  countDifferentRebelliokaiInDiscard,
  payRebelliokaiCost,
} = require('./_rebelliokai-shared');

const CARD_NAME    = 'Kirin Firebreath';
const COST_NAME    = 'Rebelliokai Courtly Kirin';
const STRIKE_DMG   = 50;
const STRIKE_DELAY = 280; // ms between strikes — readable but snappy

module.exports = {
  spellPlayCondition(gs, pi /*, engine */) {
    const ps = gs.players[pi];
    return (ps?.discardPile || []).indexOf(COST_NAME) >= 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs     = engine.gs;
      const pi     = ctx.cardOwner;
      const ps     = gs.players[pi];
      if (!ps) return;

      // ── Step 1: pick the FIRST target (commitment point) ──
      // This is the player's last chance to back out — promptDamageTarget
      // returns null on cancel. If they cancel, refund the Spell so the
      // Action isn't burned and Courtly Kirin stays in discard.
      const firstTarget = await ctx.promptDamageTarget({
        side:        'any',
        types:       ['hero', 'creature'],
        damageType:  'destruction_spell',
        title:       CARD_NAME,
        description: `Choose your first target. You will deal ${STRIKE_DMG} damage as many times as you have "Rebelliokai" Creatures with different names in your discard pile (after paying the cost).`,
        confirmLabel: `🔥 Strike #1 (${STRIKE_DMG})`,
        confirmClass: 'btn-danger',
        cancellable: true,
      });
      if (!firstTarget) {
        gs._spellCancelled = true;
        return;
      }

      // ── Step 2: pay the cost (commits the player past return) ──
      // Re-check the cost is still in discard — a parallel reaction
      // (rare) could have moved it during the prompt. Defensive bail.
      if ((ps.discardPile || []).indexOf(COST_NAME) < 0) {
        gs._spellCancelled = true;
        return;
      }
      await payRebelliokaiCost(engine, pi, COST_NAME, { source: CARD_NAME });

      // ── Step 3: snap N AFTER cost (deleted Kirin doesn't count) ──
      const N = countDifferentRebelliokaiInDiscard(ps, engine);
      if (N <= 0) {
        // Cost paid, no strikes. Spell resolves silently.
        engine.log('kirin_firebreath_fizzle', {
          player: ps.username, reason: 'no_rebelliokai_in_discard',
        });
        return;
      }

      // ── Step 4: deliver N strikes, one target per strike ──
      // strike 0 already has its target (firstTarget). Strikes 1..N-1
      // re-prompt for a new target each time. Per-strike target prompts
      // are non-cancellable — once the cost is paid, the player must
      // see the spell through.
      let strikesLanded = 0;
      const targetsPicked = [firstTarget];
      for (let i = 0; i < N; i++) {
        // Whole-Spell negation breaks the loop. Per-strike negation
        // (Anti Magic Shield etc.) is handled inside the damage call
        // and only suppresses ITS strike — execution continues.
        if (gs._spellNegatedByEffect) break;

        let target = (i === 0) ? firstTarget : null;
        if (target == null) {
          target = await ctx.promptDamageTarget({
            side:        'any',
            types:       ['hero', 'creature'],
            damageType:  'destruction_spell',
            title:       CARD_NAME,
            description: `Choose target for strike #${i + 1} of ${N}.`,
            confirmLabel: `🔥 Strike #${i + 1} (${STRIKE_DMG})`,
            confirmClass: 'btn-danger',
            cancellable: false,
          });
          // promptDamageTarget returns null when no targets exist (every
          // hero / creature is dead). Bail out of the remaining strikes.
          if (!target) break;
          targetsPicked.push(target);
        }

        // Per-strike animation + sync. The fireball animation lands on
        // the target's specific zone slot (or the hero card for hero
        // targets) so each strike reads as its own VFX hit.
        engine._broadcastEvent('play_zone_animation', {
          type:     'fireball',
          owner:    target.owner,
          heroIdx:  target.heroIdx,
          zoneSlot: target.type === 'hero' ? -1 : (target.slotIdx ?? -1),
        });
        await engine._delay(STRIKE_DELAY);

        // Standard damage routing. Each strike runs its own damage
        // batch → after-damage hooks → reaction window. Anti Magic
        // Shield, Fireshield, etc. each see this one strike in
        // isolation.
        if (target.type === 'hero') {
          const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
          if (hero && hero.hp > 0) {
            await ctx.dealDamage(hero, STRIKE_DMG, 'destruction_spell');
            strikesLanded++;
          }
        } else if (target.cardInstance) {
          const inst = engine.cardInstances.find(c => c.id === target.cardInstance.id);
          if (inst && inst.zone === 'support') {
            await engine.actionDealCreatureDamage(
              { name: CARD_NAME, owner: pi, heroIdx: ctx.cardHeroIdx },
              inst, STRIKE_DMG, 'destruction_spell',
              { sourceOwner: pi, canBeNegated: true },
            );
            strikesLanded++;
          }
        }
      }

      engine.log('kirin_firebreath', {
        player:  ps.username,
        strikes: N,
        landed:  strikesLanded,
        targets: targetsPicked.map(t => t.cardName || `hero-${t.heroIdx}`),
      });
      engine.sync();
    },
  },
};
