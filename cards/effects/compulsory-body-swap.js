// ═══════════════════════════════════════════
//  CARD EFFECT: "Compulsory Body Swap"
//  Spell (Magic Arts Lv3, Normal)
//
//  Choose any 2 Heroes any player controls and
//  swap all their Abilities. If the user is one
//  of those Heroes, it may immediately perform
//  an additional Action afterwards.
//
//  Implementation
//  ──────────────
//  • Targets: any 2 alive heroes on the board
//    (own side OR opposing). Same-hero pick is
//    rejected at validation time.
//  • Swap is performed on two layers:
//      1. The `abilityZones[heroIdx]` arrays —
//         these drive UI rendering and the
//         ability-name listings.
//      2. Any tracked card instance whose
//         `zone === 'ability'` and `(owner,
//         heroIdx)` matches one of the swap
//         pair gets re-pointed at the OTHER
//         hero (`owner` and `heroIdx` flipped).
//         `originalOwner` is preserved — the
//         physical card still belongs to its
//         original deck for discard-pile routing.
//  • Animation: per-hero "soul ghost" copies
//    cross paths between the two hero slots over
//    a single second (broadcast to the client as
//    a `body_swap_souls` event with the two
//    coordinates). The actual swap of state
//    happens at the midpoint of the animation
//    so the visual + state changes feel
//    simultaneous.
//  • Additional Action rider — when the user
//    hero is one of the swapped pair, hand them
//    an additional Action via the engine's
//    performImmediateAction helper (same pattern
//    as Coffee, Trample Sounds in the Forest,
//    Mana Beacon). The popup is hero-locked so
//    only the user's eligible Spells / Attacks /
//    Creatures in hand and action-cost Abilities
//    on the user hero are clickable; effects on
//    other Heroes (e.g. another Hero's
//    Adventurousness) are not eligible. The
//    helper also auto-skips when the user has
//    nothing to play.
// ═══════════════════════════════════════════

const CARD_NAME = 'Compulsory Body Swap';
const ANIM_MS   = 1000;

module.exports = {
  activeIn: ['hand'],

  /**
   * Pre-cast condition: at least two alive heroes must exist on the
   * board (otherwise there's nothing to swap with). The engine still
   * runs the standard spell-school + level checks separately.
   */
  spellPlayCondition(gs /* , playerIdx, engine */) {
    let alive = 0;
    for (let pi = 0; pi < (gs.players?.length || 0); pi++) {
      const ps = gs.players[pi];
      if (!ps) continue;
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const h = ps.heroes[hi];
        if (h?.name && h.hp > 0) alive++;
        if (alive >= 2) return true;
      }
    }
    return false;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine     = ctx._engine;
      const gs         = engine.gs;
      const pi         = ctx.cardOwner;
      const userHeroId = ctx.cardHeroIdx;
      const ps         = gs.players[pi];
      if (!ps) { gs._spellCancelled = true; return; }

      // ── Step 1: build target list of all alive heroes ──
      const targets = [];
      for (let pIdx = 0; pIdx < gs.players.length; pIdx++) {
        const tp = gs.players[pIdx];
        if (!tp) continue;
        for (let hi = 0; hi < (tp.heroes || []).length; hi++) {
          const h = tp.heroes[hi];
          if (!h?.name || h.hp <= 0) continue;
          targets.push({
            id: `hero-${pIdx}-${hi}`, type: 'hero',
            owner: pIdx, heroIdx: hi, cardName: h.name,
          });
        }
      }
      if (targets.length < 2) { gs._spellCancelled = true; return; }

      // ── Step 2: prompt for exactly 2 heroes ──
      // exclusiveTypes:false means heroes from both sides are clickable
      // in one shot. minRequired/maxTotal pin the pick at exactly 2.
      const picked = await engine.promptEffectTarget(pi, targets, {
        title: CARD_NAME,
        description: 'Choose any 2 Heroes (any player) to swap all their Abilities.',
        confirmLabel: '🔄 Swap!',
        confirmClass: 'btn-info',
        cancellable: false,
        exclusiveTypes: false,
        minRequired: 2,
        maxTotal: 2,
      });
      if (!picked || picked.length < 2) { gs._spellCancelled = true; return; }

      const a = targets.find(t => t.id === picked[0]);
      const b = targets.find(t => t.id === picked[1]);
      if (!a || !b) { gs._spellCancelled = true; return; }
      // Same-hero pick guard — promptEffectTarget already enforces
      // distinct ids, but defend against future config drift.
      if (a.owner === b.owner && a.heroIdx === b.heroIdx) {
        gs._spellCancelled = true; return;
      }

      const aPs = gs.players[a.owner];
      const bPs = gs.players[b.owner];
      if (!aPs || !bPs) { gs._spellCancelled = true; return; }

      // ── Step 3: kick off the soul-ghost animation, then swap at midpoint ──
      // The client owns the actual ghost rendering; we just hand it the
      // two coordinates and a duration so it can lerp between them.
      engine._broadcastEvent('body_swap_souls', {
        a: { owner: a.owner, heroIdx: a.heroIdx, name: aPs.heroes[a.heroIdx]?.name || '' },
        b: { owner: b.owner, heroIdx: b.heroIdx, name: bPs.heroes[b.heroIdx]?.name || '' },
        durationMs: ANIM_MS,
      });
      // Swap state at the visual crossing point.
      await engine._delay(ANIM_MS / 2);

      // ── Step 4: swap abilityZones arrays ──
      // Make sure both sides have the slots initialised so the swap
      // doesn't lose data into undefined.
      if (!aPs.abilityZones) aPs.abilityZones = [];
      if (!bPs.abilityZones) bPs.abilityZones = [];
      if (!aPs.abilityZones[a.heroIdx]) aPs.abilityZones[a.heroIdx] = [[], [], []];
      if (!bPs.abilityZones[b.heroIdx]) bPs.abilityZones[b.heroIdx] = [[], [], []];

      const tmp = aPs.abilityZones[a.heroIdx];
      aPs.abilityZones[a.heroIdx] = bPs.abilityZones[b.heroIdx];
      bPs.abilityZones[b.heroIdx] = tmp;

      // ── Step 5: re-point any tracked ability card instances ──
      // Each instance currently attached to A flips to B (and vice
      // versa). We collect first then mutate to avoid mid-iteration
      // reassignment muddying the comparison check.
      const toFlipToB = [];
      const toFlipToA = [];
      for (const inst of engine.cardInstances) {
        if (inst.zone !== 'ability') continue;
        if (inst.owner === a.owner && inst.heroIdx === a.heroIdx) {
          toFlipToB.push(inst);
        } else if (inst.owner === b.owner && inst.heroIdx === b.heroIdx) {
          toFlipToA.push(inst);
        }
      }
      const repoint = (inst, newOwner, newHeroIdx) => {
        inst.owner       = newOwner;
        inst.controller  = newOwner;
        inst.heroOwner   = newOwner;
        inst.heroIdx     = newHeroIdx;
        // originalOwner stays put — the deck the card came from
        // determines discard-pile routing; the body swap doesn't
        // transfer card ownership across decks.
      };
      for (const inst of toFlipToB) repoint(inst, b.owner, b.heroIdx);
      for (const inst of toFlipToA) repoint(inst, a.owner, a.heroIdx);

      engine.log('compulsory_body_swap', {
        player: ps.username,
        a: { owner: a.owner, hero: aPs.heroes[a.heroIdx]?.name },
        b: { owner: b.owner, hero: bPs.heroes[b.heroIdx]?.name },
        userIncluded: (a.owner === pi && a.heroIdx === userHeroId) ||
                      (b.owner === pi && b.heroIdx === userHeroId),
      });

      // Wait out the rest of the animation so the visual finishes
      // before the engine moves on.
      await engine._delay(ANIM_MS / 2);

      // ── Step 6: additional Action rider ──
      // If the user (the casting hero) is one of the two swapped
      // heroes, hand them an additional Action locked to that hero.
      // performImmediateAction:
      //  • Surfaces the engine's standard `heroAction` prompt with a
      //    "You may perform an additional Action with [Hero]!" banner
      //    and the eligible-cards / activatable-abilities lists scoped
      //    to the user hero only. Other heroes' actions are filtered
      //    out client-side (heroAction prompt + per-hero gates).
      //  • Returns early without prompting if the user hero has no
      //    eligible Spell/Attack/Creature in hand and no action-cost
      //    Ability ready — so the popup never fires when there's
      //    nothing to do, matching the user spec.
      //  • The cast itself fires through the engine's regular onPlay /
      //    afterSpellResolved path (Wisdom, Bartas, Reiza, etc. all
      //    compose correctly), and ability activations run their
      //    onActivate. The action does NOT count as the player's
      //    main turn-Action (no heroesActedThisTurn push from this
      //    path), which is what "additional Action afterwards" means.
      const userInSwap =
        (a.owner === pi && a.heroIdx === userHeroId) ||
        (b.owner === pi && b.heroIdx === userHeroId);
      if (userInSwap) {
        const userHero = ps.heroes?.[userHeroId];
        const userHeroName = userHero?.name || 'the user';
        await engine.performImmediateAction(pi, userHeroId, {
          title: CARD_NAME,
          description: `You may perform an additional Action with ${userHeroName}!`,
        });
      }

      engine.sync();
    },
  },
};
