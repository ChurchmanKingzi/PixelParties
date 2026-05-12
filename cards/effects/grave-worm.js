// ═══════════════════════════════════════════
//  CARD EFFECT: "Grave Worm"
//  Creature (Normal, Lv0, Summoning Magic) — BANNED
//
//  ① REVIVE-ON-DEATH (in-discard listener) —
//    when ANOTHER Creature you control dies and
//    is sent to YOUR discard pile while a Grave
//    Worm is in your discard pile, you may
//    summon Grave Worm into the SAME Support
//    Zone as an additional Action. Once per turn
//    per controller.
//
//  ② ON-SUMMON — when Grave Worm is summoned
//    (any path), draw 1 card.
//
//  Implementation:
//   • `activeIn: ['support', 'discard']` — the
//     listener has to live in BOTH zones: in
//     support so on-summon's draw fires for
//     hand-summoned copies and any other paths
//     that route through `summonCreatureWithHooks`,
//     and in discard so the revive trigger fires
//     when ANOTHER own Creature dies.
//   • `onCreatureDeath` from a discard-zone
//     listener watches for the trigger; verifies
//     dying creature was on OUR side, isn't
//     Grave Worm, AND landed in the discard
//     pile (not deletedPile — `_redirectToDeleted`
//     would route around).
//   • Per-turn HOPT keyed by controller (one
//     Grave Worm summon per turn, regardless of
//     how many copies are in discard).
//   • Splice from discardPile array, untrack
//     the listener inst, then `summonCreatureWith-
//     Hooks` re-creates a fresh inst at the
//     dying creature's slot. The on-summon draw
//     fires through the standard onPlay hook.
//   • `_summonedAsAdditional: true` hookExtra so
//     downstream listeners (additional-action
//     trackers) recognize this as not consuming
//     the controller's main Action.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Grave Worm';
const HOPT_KEY = 'grave-worm-revive';

module.exports = {
  // Broad activeIn — same rationale as Rebelliokai Backup Bakus.
  // Different discard paths in the engine don't all keep `inst.zone`
  // synchronised when a card lands in the discard pile (the damage-
  // batch death path UNTRACKS the dying inst entirely; mill of a
  // card without onMill never tracks; some manual splices skip the
  // zone update). Listening from any zone PLUS a state-based
  // `discardPile.indexOf` check below makes the trigger fire
  // reliably no matter how the inst is currently tracked.
  activeIn: ['hand', 'support', 'discard', 'deleted', 'deck'],

  // Bypass the runHooks dead-hero filter so the onCreatureDeath
  // re-track below still fires when an AoE wipes Grave Worm AND
  // its hosting Hero in the same batch — without this the dying
  // worm's listener gets dropped before we can re-track it in
  // discard.
  bypassDeadHeroFilter: true,

  hooks: {
    /**
     * On-summon draw 1. Engine fires `onPlay` for any creature
     * placement that goes through `summonCreatureWithHooks` — covers
     * both hand-played summons and the revive path below. Filter to
     * THIS Grave Worm's own summon to avoid sibling triggers.
     */
    onPlay: async (ctx) => {
      if (ctx.playedCard?.id !== ctx.card.id) return;
      if (ctx.cardZone !== 'support') return;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;

      // Burrow-out animation — black particles bursting upward from
      // the support slot, indicating the worm clawing out of fresh
      // black earth. Fired in PARALLEL with the on-summon effect:
      // the broadcast goes out, then the draw begins immediately
      // — no `_delay` between them, so the animation runs while the
      // draw resolves rather than gating the effect.
      engine._broadcastEvent('play_zone_animation', {
        type: 'grave_worm_burrow',
        owner: pi,
        heroIdx: ctx.cardHeroIdx,
        zoneSlot: ctx.card.zoneSlot,
      });

      await engine.actionDrawCards(pi, 1);
      engine.log('grave_worm_summon_draw', {
        player: engine.gs.players[pi]?.username, drew: 1,
      });
      engine.sync();
    },

    /**
     * Combat-death re-track — same shape as Bakus. The damage-batch
     * death path untracks the dying instance, so without this hook
     * a Grave Worm killed in combat lands in the discard pile with
     * NO listener. Re-track a fresh discard-zone instance so the
     * revive trigger fires for subsequent own-creature deaths.
     *
     * Self-detect via instId so this only fires for THIS Grave Worm
     * death event. Skip when Worm didn't actually land in the
     * discard pile (deleted, etc. — the trigger only revives "from
     * your discard pile" per card text).
     */
    onCreatureDeath: async (ctx) => {
      const death = ctx.creature;
      if (!death) return;
      const engine = ctx._engine;

      // ── Path A: re-track when GRAVE WORM ITSELF dies ──
      if (death.name === CARD_NAME && death.instId === ctx.card.id) {
        const ownerPs = engine.gs.players[death.originalOwner ?? death.owner];
        if (!ownerPs) return;
        if ((ownerPs.discardPile || []).indexOf(CARD_NAME) < 0) return;
        engine._trackCard(CARD_NAME, death.originalOwner ?? death.owner, 'discard');
        return;
      }

      // ── Path B: revive trigger ──
      // Multi-copy dedup. The first Grave Worm listener to clear the
      // gates sets the flag; sibling listeners in the same runHooks
      // dispatch see the spread-in flag at their entry and bail.
      if (ctx._graveWormPromptFired) return;

      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;

      // Filter: dying creature is OURS (we currently controlled it)
      // and is an actual Creature. Side attribution uses CONTROLLER —
      // a Creature you gave to opp via Chilly Wizard's cross-side
      // placement counts as opp's creature dying, not yours. The card
      // text's "except Grave Worm" carve-out is an anti-self-revive
      // guard, NOT a blanket exclusion of Grave Worm deaths — sibling
      // Worms in discard SHOULD react to a Grave Worm dying. So we
      // only skip when the dying inst IS this listener (via id match
      // at Path A above).
      const dyingController = death.controller ?? death.owner;
      if (dyingController !== pi) return;
      const cardDB = engine._getCardDB();
      const dyingCd = cardDB[death.name];
      if (!dyingCd || !hasCardType(dyingCd, 'Creature')) return;

      // Card text: "sent to the discard pile" — verify the dying
      // creature actually landed in our discard pile (not deleted /
      // exiled).
      if (!(ps.discardPile || []).includes(death.name)) return;

      // State-based "am I in the discard pile?" gate. This is the
      // real check that lets us listen broadly across zones — works
      // whether the inst is tracked at zone='discard' (canonical)
      // or stale-tracked elsewhere by a non-canonical splice.
      if ((ps.discardPile || []).indexOf(CARD_NAME) < 0) return;

      // Per-controller HOPT — one Grave Worm summon per turn,
      // shared across every Worm in this player's discard.
      const hoptKey = `${HOPT_KEY}:${pi}`;
      if (gs.hoptUsed?.[hoptKey] === gs.turn) return;

      // Slot must still be free for the summon (a chained reaction
      // could have re-filled it).
      const sup = ps.supportZones?.[death.heroIdx] || [];
      if ((sup[death.zoneSlot] || []).length !== 0) return;

      // Host hero must be ABLE TO SUMMON Grave Worm — this is a
      // SUMMON, not a placement, so the standard summon-eligibility
      // gates apply: alive, not Frozen / Stunned / Bound, meets the
      // Lv0 Summoning Magic requirement, and the player isn't
      // summon-locked. Hard-negation is folded into
      // `heroMeetsLevelReq` (it blanks the ability zones); the
      // lighter Weakening-Crystal form intentionally permits
      // summons.
      const hostHero = ps.heroes?.[death.heroIdx];
      if (!hostHero?.name || hostHero.hp <= 0) return;
      if (hostHero.statuses?.frozen
          || hostHero.statuses?.stunned
          || hostHero.statuses?.bound) return;
      if (ps.summonLocked) return;
      const ourCardData = cardDB[CARD_NAME];
      if (!ourCardData) return;
      if (!engine.heroMeetsLevelReq(pi, death.heroIdx, ourCardData)) return;

      // Claim the dedup flag BEFORE the prompt awaits — sibling
      // listeners spawned in the same dispatch window see the flag
      // in their initial spread and bail at the early return above.
      ctx.setFlag('_graveWormPromptFired', true);

      const confirmed = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `${death.name} just hit your discard pile. Summon ${CARD_NAME} into its slot as an additional Action?`,
        showCard: CARD_NAME,
        confirmLabel: '🪱 Crawl out!',
        cancelLabel: 'No',
        cancellable: true,
      });
      if (!confirmed) return;

      // Re-verify the discard still has Grave Worm AND the slot is
      // still free (a parallel reaction during the prompt could have
      // moved either).
      const dpIdx = (ps.discardPile || []).indexOf(CARD_NAME);
      if (dpIdx < 0) return;
      const sup2 = ps.supportZones?.[death.heroIdx] || [];
      if ((sup2[death.zoneSlot] || []).length !== 0) return;

      // Claim the per-turn lock now that the player has committed.
      if (!engine.claimHOPT(HOPT_KEY, pi)) return;

      // Splice Grave Worm out of the discard pile array. Untrack
      // ONLY the listener that fired this prompt — sibling Grave
      // Worm trackers (other copies still in discard) keep their
      // listeners so future deaths can still trigger them.
      ps.discardPile.splice(dpIdx, 1);
      if (ctx.card?.id != null) engine._untrackCard(ctx.card.id);

      // SUMMON (not placement) at the dying creature's slot —
      // honours the host Hero's normal summon gates (already
      // verified above). `summonCreatureWithHooks` creates a fresh
      // inst, fires onPlay (which fires the burrow animation +
      // draw 1), and runs onCardEnterZone.
      const placed = await engine.summonCreatureWithHooks(
        CARD_NAME, pi, death.heroIdx, death.zoneSlot,
        {
          source: CARD_NAME,
          hookExtras: {
            _summonedBy: CARD_NAME,
            _summonedFromDiscard: true,
            _summonedAsAdditional: true,
          },
        },
      );
      if (!placed) {
        // Roll back if the placement failed for any defensive reason.
        if (gs.hoptUsed) delete gs.hoptUsed[`${HOPT_KEY}:${pi}`];
        ps.discardPile.push(CARD_NAME);
        return;
      }

      engine.log('grave_worm_revive', {
        player: ps.username, fallen: death.name,
        heroIdx: death.heroIdx, zoneSlot: death.zoneSlot,
      });
      engine.sync();
    },
  },
};
