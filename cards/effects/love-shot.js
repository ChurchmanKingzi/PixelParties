// ═══════════════════════════════════════════
//  CARD EFFECT: "Love Shot"
//  Spell (Magic Arts Lv1, Normal)
//
//  Draw a card. Then, choose a Hero the opponent
//  controls and perform a Spell or Attack from
//  your hand with it, if possible, as if you
//  control it. For that Spell or Attack only,
//  the Hero is treated as controlled by you. The
//  controlled Hero cannot take any damage while
//  it is controlled by this effect.
//
//  Implementation
//  ──────────────
//  Reuses the existing charmedBy mechanic (the
//  same one Charme Lv3 uses), but only for the
//  duration of the inner Spell/Attack:
//   • charmedBy = pi → engine target builds
//     auto-include the Hero in "own" lists and
//     exclude it from "enemy" lists. Healing
//     Melody's charmedBy-aware fan-out and Flame
//     Avalanche's enemy-only scope fall out for
//     free.
//   • statuses.charmed → triggers the engine's
//     absolute damage gate (_actionDealDamageImpl
//     ~line 5066) — implements the "cannot take
//     damage" clause without any new plumbing.
//   • inst.heroOwner = oppPi on the inner cast's
//     instance — mirrors doPlaySpell's charmed-
//     Owner branch so ctx.attachedHero resolves
//     to the opp-side Hero.
//
//  Inner cast resolves via a custom mini-loop
//  modelled on performImmediateAction's Spell/
//  Attack branch (the hero-locked variant), with
//  the wisdomCost lookup keyed to the opp side
//  (the Hero's ability zones determine Wisdom)
//  while the discard prompt lands on the caster.
//  The inner cast does NOT consume the caster's
//  Action nor the Hero's per-turn slot — it is
//  truly additional.
//
//  Cleanup
//  ───────
//  charmedBy + statuses.charmed are restored to
//  their prior state in the `finally`. The end-
//  of-turn charm-sweep is a safety net only —
//  the inner cast is single-frame so we never
//  leak past this Spell's resolution.
// ═══════════════════════════════════════════

const CARD_NAME = 'Love Shot';

module.exports = {
  requiresTarget: true,
  // ^ Blinded gating — Blinded Heroes can't play targeting cards.
  activeIn: ['hand'],

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const oi = pi === 0 ? 1 : 0;
      const ps = gs.players[pi];
      const ops = gs.players[oi];
      if (!ps || !ops) return;

      // ── Draw (always — first clause) ─────────────────
      await ctx.drawCards(pi, 1);

      // ── Build opp-Hero target list ───────────────────
      // Per the card's intent, only Heroes that can actually
      // perform an Action are valid (no point picking a Frozen
      // Hero just to fizzle the cast). Per-card eligibility
      // (school/level/Wisdom/etc.) is checked later via
      // getHeroPlayableCards once a Hero is locked in.
      const heroTargets = [];
      for (let hi = 0; hi < (ops.heroes || []).length; hi++) {
        const h = ops.heroes[hi];
        if (!h?.name || h.hp <= 0) continue;
        if (h.statuses?.frozen || h.statuses?.stunned || h.statuses?.webbed
            || h.statuses?.bound || h.statuses?.negated) continue;
        if (engine.isHeroSkillLocked(oi, hi)) continue;
        if (h._maxActionsPerTurn && (h._actionsThisTurn || 0) >= h._maxActionsPerTurn) continue;
        if (h._actionLockedTurn === gs.turn) continue;
        heroTargets.push({
          id: `hero-${oi}-${hi}`, type: 'hero',
          owner: oi, heroIdx: hi, cardName: h.name,
        });
      }

      if (heroTargets.length === 0) {
        engine.log('love_shot_no_target', { player: ps.username });
        return;
      }

      // Non-cancellable: the draw has already committed, and per
      // the card's intent the player must lock in a Hero once it
      // resolves to that step. The follow-up "pick a Spell/Attack"
      // handPick remains cancellable so the player can still bail
      // before committing a card from hand.
      const picked = await engine.promptEffectTarget(pi, heroTargets, {
        title: CARD_NAME,
        description: "Choose an opponent's Hero. You will perform a Spell or Attack from your hand with it.",
        confirmLabel: '💘 Choose!',
        confirmClass: 'btn-info',
        cancellable: false,
        exclusiveTypes: true,
        maxPerType: { hero: 1 },
        maxTotal: 1,
        minRequired: 1,
        damageType: 'status',
        // ^ Non-damage targeting — keeps the Wall-of-Deri filter on
        // the protective side and the Truth-Seeing-Eye picker gates
        // routing correctly.
        greenSelect: true,
      });
      if (!picked || picked.length === 0) return;

      const sel = heroTargets.find(t => t.id === picked[0]);
      if (!sel) return;
      const targetHero = ops.heroes[sel.heroIdx];
      if (!targetHero?.name || targetHero.hp <= 0) return;

      // ── Heart projectile (fires ALWAYS, even against protected
      //    targets) ────────────────────────────────────
      // API rule: immunities block EFFECTS, never animations. The
      // big light-pink heart flies + lands regardless of whether
      // Anti Magic Enchantment or Resistance is about to fizzle
      // the effect — the player should still see the throw land so
      // the protection itself reads as a visible "block", not as a
      // missing animation. `play_projectile_animation` is the
      // engine's existing src→tgt projectile chokepoint; CSS lives
      // in `style.css` (`.projectile-love-heart` +
      // `.projectile-love-trail`).
      const PROJECTILE_MS = 1100;
      engine._broadcastEvent('play_projectile_animation', {
        sourceOwner: pi,
        sourceHeroIdx: ctx.cardHeroIdx,
        targetOwner: oi,
        targetHeroIdx: sel.heroIdx,
        targetZoneSlot: -1,
        projectileClass: 'projectile-love-heart',
        trailClass: 'projectile-love-trail',
        duration: PROJECTILE_MS,
      });
      await engine._delay(PROJECTILE_MS);

      // Landing burst on the target — a flutter of small pink
      // hearts. Plays unconditionally (see the rule above).
      engine._broadcastEvent('play_zone_animation', {
        type: 'love_burst', owner: oi, heroIdx: sel.heroIdx, zoneSlot: -1,
      });
      engine.sync();
      await engine._delay(250);

      // ── Spell-protection gates on the chosen Hero ────
      // Love Shot is a non-damage Magic Arts Lv1 Spell touching a
      // Hero, so the standard Spell-protection chokepoints apply:
      //   • Anti Magic Enchantment (`magic_immune` buff): the
      //     engine's `_isHeroSpellProtected` fizzles the effect
      //     when the target's buff level ≥ Love Shot's printed
      //     level. Same gate every non-damage hero-touching Spell
      //     consults (status applies, heals, etc.).
      //   • Resistance: listens on the `beforeHeroEffect` hook and
      //     cancels the first non-damage effect each turn. Mirror
      //     of Charme Lv3's gate — without this, the charm and the
      //     inner cast would land directly and bypass Resistance.
      //
      // Both fire AFTER the visuals have landed: immunity blocks
      // the effect, not the animation. The outer Anti-Magic-Shield
      // REACTION (Spell-level negation during the chain) is
      // handled by the standard `executeCardWithChain` window that
      // wraps every Spell cast and runs BEFORE this `onPlay`, so
      // we don't re-check it here.
      if (engine._isHeroSpellProtected(targetHero, CARD_NAME)) {
        engine._broadcastEvent('play_zone_animation', {
          type: 'anti_magic_block', owner: oi, heroIdx: sel.heroIdx, zoneSlot: -1,
        });
        engine.log('love_shot_blocked', {
          player: ps.username, target: targetHero.name, reason: 'anti_magic',
        });
        engine.sync();
        return;
      }
      const beforeEffectCtx = {
        playerIdx: oi, heroIdx: sel.heroIdx, hero: targetHero,
        effectType: 'love_shot', cancelled: false, _skipReactionCheck: true,
      };
      await engine.runHooks('beforeHeroEffect', beforeEffectCtx);
      if (beforeEffectCtx.cancelled) {
        engine.log('love_shot_blocked', {
          player: ps.username, target: targetHero.name, reason: 'resistance',
        });
        engine.sync();
        return;
      }

      // ── Install temporary charm ──────────────────────
      // Preserve any pre-existing charm state (e.g. the Hero is
      // already charmed-by-us via Charme Lv3) so the `finally`
      // restores it instead of stripping it. delete-via-undefined
      // is significant: a real `{...}` value must come back.
      const prev = {
        charmedBy: targetHero.charmedBy,
        charmedFromOwner: targetHero.charmedFromOwner,
        charmedHeroIdx: targetHero.charmedHeroIdx,
        statusCharmed: targetHero.statuses?.charmed,
      };
      targetHero.charmedBy = pi;
      targetHero.charmedFromOwner = oi;
      targetHero.charmedHeroIdx = sel.heroIdx;
      if (!targetHero.statuses) targetHero.statuses = {};
      targetHero.statuses.charmed = { controller: pi, appliedTurn: gs.turn, _loveShot: true };
      engine.sync();

      try {
        // ── Build eligible Spell/Attack list ───────────
        // getHeroPlayableCards's `charmed` branch already honors
        // school/level, Wisdom hand-size, status gates (nulled /
        // magic_silenced / berserked), per-hero canPlayCard, equip
        // canPlayCard, Spell lock, summon-lock & free-zone checks
        // — keyed to the now-charmed Hero. Trial-of-Coolness's
        // _attackSpellLockedTurn isn't covered by that path; check
        // separately.
        const playableMap = engine.getHeroPlayableCards(pi);
        const fromCharmed = (playableMap.charmed && playableMap.charmed[sel.heroIdx]) || [];
        const cardDB = engine._getCardDB();
        const eligibleNames = new Set();
        const attackSpellLocked = ps._attackSpellLockedTurn === gs.turn;
        for (const name of fromCharmed) {
          const cd = cardDB[name];
          if (!cd) continue;
          if (cd.cardType !== 'Spell' && cd.cardType !== 'Attack') continue;
          // No Love Shot inside Love Shot — would recurse and re-
          // pin the charm to itself.
          if (name === CARD_NAME) continue;
          if (attackSpellLocked) continue;
          eligibleNames.add(name);
        }

        const eligibleIndices = [];
        for (let i = 0; i < ps.hand.length; i++) {
          if (eligibleNames.has(ps.hand[i])) eligibleIndices.push(i);
        }

        if (eligibleIndices.length === 0) {
          engine.log('love_shot_no_action', {
            player: ps.username, target: targetHero.name,
          });
          return;
        }

        // ── Hand pick for the inner Spell / Attack ─────
        // Canonical handPick — per the API rule, picks-from-hand
        // never use a modal gallery.
        const result = await engine.promptGeneric(pi, {
          type: 'handPick',
          title: CARD_NAME,
          description: `Click a Spell or Attack in your hand to perform with ${targetHero.name}.`,
          eligibleIndices,
          minSelect: 0,
          maxSelect: 1,
          cancellable: true,
          confirmLabel: '💘 Perform!',
        });

        if (!result || result.cancelled
            || !result.selectedCards || result.selectedCards.length === 0) {
          return;
        }

        const { handIndex, cardName: chosenName } = result.selectedCards[0];
        if (handIndex < 0 || handIndex >= ps.hand.length
            || ps.hand[handIndex] !== chosenName) return;
        const chosenCd = cardDB[chosenName];
        if (!chosenCd) return;

        // ── Resolve the inner cast (charmedOwner semantics) ──
        // Splice from caster's hand, track with heroOwner = oi so
        // ctx.attachedHero resolves to the opp-side Hero, run
        // onPlay + afterSpellResolved with _skipReactionCheck (we
        // are inside Love Shot's resolution — its own reaction
        // window already fired).
        ps.hand.splice(handIndex, 1);
        const inst = engine._trackCard(chosenName, pi, 'hand', sel.heroIdx, -1);
        inst.heroOwner = oi;

        if (chosenCd.cardType === 'Spell') {
          const wisdomCost = engine.getWisdomDiscardCost(oi, sel.heroIdx, chosenCd);
          if (wisdomCost > 0) {
            await engine.actionPromptForceDiscard(pi, wisdomCost, {
              title: 'Wisdom Cost', source: 'Wisdom', selfInflicted: true,
            });
          }
        }

        gs._immediateActionContext = true;
        gs._spellCancelled = false;
        const hadPriorLog = gs._spellDamageLog !== undefined;
        if (!hadPriorLog) gs._spellDamageLog = [];
        gs._spellResolutionDepth = (gs._spellResolutionDepth || 0) + 1;
        if (chosenCd.cardType === 'Spell') engine._pushResolvingSpell(chosenName);

        let innerCancelled = false;
        try {
          await engine.runHooks('onPlay', {
            _onlyCard: inst, playedCard: inst,
            cardName: chosenName, zone: 'hand',
            heroIdx: sel.heroIdx, _skipReactionCheck: true,
          });
          delete gs._immediateActionContext;

          if (gs._spellCancelled && !gs._spellNegatedByEffect) {
            // Player backed out of the inner Spell/Attack's own
            // picker — refund the card (matches the convention in
            // performImmediateActionAnyHero).
            innerCancelled = true;
            gs._spellCancelled = false;
          } else if (!gs._spellNegatedByEffect) {
            const uniqueTargets = [];
            const seenIds = new Set();
            for (const t of (gs._spellDamageLog || [])) {
              if (!seenIds.has(t.id)) { seenIds.add(t.id); uniqueTargets.push(t); }
            }
            await engine.runHooks('afterSpellResolved', {
              spellName: chosenName, spellCardData: chosenCd,
              heroIdx: sel.heroIdx, casterIdx: pi,
              damageTargets: uniqueTargets,
              isSecondCast: !!gs._bartasSecondCast,
              _skipReactionCheck: true,
            });
          }
          if (!hadPriorLog) delete gs._spellDamageLog;
          delete gs._spellNegatedByEffect;
        } finally {
          gs._spellResolutionDepth = Math.max(0, (gs._spellResolutionDepth || 1) - 1);
          if (chosenCd.cardType === 'Spell') engine._popResolvingSpell();
        }

        if (innerCancelled) {
          const _retIdx = ps.hand.length;
          engine._broadcastEvent('play_pile_transfer', {
            owner: pi, cardName: chosenName, from: 'hand', to: 'hand',
            fromHandIdx: _retIdx, toHandIdx: _retIdx,
          });
          ps.hand.push(chosenName);
          engine._untrackCard(inst.id);
        } else {
          ps.discardPile.push(chosenName);
          engine._untrackCard(inst.id);
          engine.log('love_shot_action', {
            player: ps.username, target: targetHero.name,
            card: chosenName, cardType: chosenCd.cardType,
          });
        }

        engine.sync();
        await engine._delay(300);
      } finally {
        // ── Revert temporary charm ───────────────────────
        if (prev.charmedBy === undefined) delete targetHero.charmedBy;
        else targetHero.charmedBy = prev.charmedBy;
        if (prev.charmedFromOwner === undefined) delete targetHero.charmedFromOwner;
        else targetHero.charmedFromOwner = prev.charmedFromOwner;
        if (prev.charmedHeroIdx === undefined) delete targetHero.charmedHeroIdx;
        else targetHero.charmedHeroIdx = prev.charmedHeroIdx;
        if (prev.statusCharmed === undefined) {
          if (targetHero.statuses) delete targetHero.statuses.charmed;
        } else {
          if (!targetHero.statuses) targetHero.statuses = {};
          targetHero.statuses.charmed = prev.statusCharmed;
        }
        engine.sync();
      }
    },
  },
};
