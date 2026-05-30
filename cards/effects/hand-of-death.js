// ═══════════════════════════════════════════
//  CARD EFFECT: "Hand of Death"
//  Spell (Destruction Magic Lv 1) — Normal,
//  HOPT (1/turn).
//
//  "If the user is not defeated, Frozen or
//   Stunned at the end of your opponent's next
//   turn, you may choose any target and defeat
//   it. This effect can never affect more than 1
//   target. If a target is defeated by this
//   effect, skip your next turn. You can only
//   play 1 «Hand of Death» per turn."
//
//  Architecture
//  ────────────
//  Hand of Death resolves like a normal Spell —
//  the card goes to the caster's discard pile.
//  The pending delayed-defeat effect lives on
//  `ps._handOfDeathArmed` (per-player state, set
//  in onPlay). At end-of-turn, ANY Hand of Death
//  instance in either player's discard pile fires
//  its `onTurnEnd` listener — instances in piles
//  are auto-tracked by `_ensurePileListeners`
//  because `onTurnEnd` is in the engine's
//  PILE_RELEVANT_HOOKS set. The listener reads
//  `ps._handOfDeathArmed`, gates on the trigger
//  window, fires the effect, and clears the flag.
//
//  ── Trigger window ──
//  Fires at the END of the OPPONENT's NEXT turn —
//  the first turn-end after the cast where the
//  active player is the OPPOSITE side of the
//  caster. Concretely:
//    `gs.turn === armedOnTurn + 1`
//        AND
//    `gs.activePlayer !== ownerIdx`
//
//  Worked example: P0 casts on turn 5.
//    • Turn 5 end (P0): turn=5, skipped (`turn !==
//      armedOnTurn+1`). Flag still armed.
//    • Turn 6 end (P1): turn=6, activePlayer=1,
//      ownerIdx=0 → fires.
//
//  ── Immunities respected at trigger time ──
//  Hero targets:
//    • Anti Magic — `engine._isHeroSpellProtected`
//      returns true if the target wears an Anti
//      Magic buff at Lv 1+ (Hand of Death is Lv 1
//      Destruction Spell).
//    • Resistance — fire `BEFORE_HERO_EFFECT`
//      hook; Resistance's listener may cancel.
//    • First-turn protection — already gated by
//      `actionDefeatHero` internally.
//  Creature targets:
//    • Cardinal Beast, Defending the Gate, first-
//      turn shield, _stealImmortal, etc. — all
//      gated by `actionDestroyCard` internally.
//      We sniff `inst.zone` post-call to verify
//      the destroy actually landed.
// ═══════════════════════════════════════════

const CARD_NAME = 'Hand of Death';
const HOPT_KEY = 'hand-of-death';

module.exports = {
  activeIn: ['hand', 'discard'],

  /** Greys out in hand after one cast this turn. */
  spellPlayCondition(gs, pi) {
    if (gs.hoptUsed?.[`${HOPT_KEY}:${pi}`] === gs.turn) return false;
    return true;
  },

  hooks: {
    onPlay: async (ctx) => {
      // Self-cast gate: only fire when THIS specific hand instance is
      // the played card (filters cross-fires from siblings in discard).
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;

      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      if (!ps) { gs._spellCancelled = true; return; }

      // HOPT — defensive double-check (the play-gate already runs the
      // same check; this catches a chained / race cast on the same turn).
      if (!ctx.hardOncePerTurn(HOPT_KEY)) {
        gs._spellCancelled = true;
        return;
      }

      // Arm the pending effect on player state. The discarded Hand of
      // Death instance's `onTurnEnd` listener (fired via
      // `_ensurePileListeners` for the engine's PILE_RELEVANT_HOOKS
      // set) reads this flag at the trigger window. Overwrites any
      // previous armed entry — HOPT enforces 1/turn so there's only
      // ever at most one pending effect per player.
      ps._handOfDeathArmed = {
        armedOnTurn: gs.turn,
        casterHeroIdx: heroIdx,
      };

      // Pre-fire flourish on the caster — dark swarm rising. The
      // serious animation lands later at trigger time on the picked
      // target.
      engine._broadcastEvent('play_zone_animation', {
        type: 'dark_swarm', owner: pi, heroIdx, zoneSlot: -1,
      });
      await engine._delay(400);

      engine.log('hand_of_death_armed', {
        player: ps.username,
        hero: ps.heroes[heroIdx]?.name,
        armedOnTurn: gs.turn,
      });
      engine.sync();
      // No `_spellPlacedOnBoard` — the Spell flows through the
      // standard hand → discard disposition.
    },

    /**
     * Delayed trigger — fires at the END of the OPPONENT's NEXT turn.
     *   `gs.turn === armedOnTurn + 1  AND  gs.activePlayer !== ownerIdx`
     *
     * Skips the cast-turn end (active player is still the caster) and
     * fires on the very next turn-end after the opponent's turn rolls
     * back through end-of-turn handling.
     */
    onTurnEnd: async (ctx) => {
      // Only listen from discard. `_ensurePileListeners` auto-tracks
      // an instance for the discarded card name, so the listener fires
      // even though `onPlay` doesn't manually re-track.
      if (ctx.card.zone !== 'discard') return;

      const engine = ctx._engine;
      const gs = engine.gs;
      const ownerIdx = ctx.card.originalOwner ?? ctx.cardOwner;
      const ps = gs.players[ownerIdx];
      if (!ps) return;

      const armed = ps._handOfDeathArmed;
      if (!armed || typeof armed.armedOnTurn !== 'number') return;

      // ── Trigger window: end of OPPONENT's NEXT turn ──
      if (gs.turn !== armed.armedOnTurn + 1 || gs.activePlayer === ownerIdx) return;

      // Claim the armed slot immediately. Multiple HoD instances may
      // share the discard pile (e.g. casts across different turns) —
      // clearing the flag here ensures only one listener resolves
      // the effect.
      delete ps._handOfDeathArmed;

      // ── User-status gate ──
      const userHeroIdx = armed.casterHeroIdx;
      const userHero = ps.heroes?.[userHeroIdx];
      if (!userHero?.name || userHero.hp <= 0) {
        engine.log('hand_of_death_fizzle', {
          player: ps.username, reason: 'user_defeated',
        });
        return;
      }
      if (userHero.statuses?.frozen) {
        engine.log('hand_of_death_fizzle', {
          player: ps.username, reason: 'user_frozen',
        });
        return;
      }
      if (userHero.statuses?.stunned || userHero.statuses?.webbed) {
        engine.log('hand_of_death_fizzle', {
          player: ps.username, reason: 'user_stunned',
        });
        return;
      }

      // Caster flourish — same dark-swarm cue tying the trigger to the
      // user before the picker opens.
      engine._broadcastEvent('play_zone_animation', {
        type: 'dark_swarm', owner: ownerIdx,
        heroIdx: userHeroIdx, zoneSlot: -1,
      });
      await engine._delay(300);

      // ── Prompt: pick any target ──
      // `dealsDamage: false` opts out of damage-mitigation post-target
      // reactions (Spectral Armor / Bamboo Shield / Sculpture Guards).
      // `damageType: 'destruction_spell'` keeps the school tag.
      const sourceMeta = {
        name: CARD_NAME, owner: ownerIdx, heroIdx: userHeroIdx,
        controller: ownerIdx,
      };
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'destruction_spell',
        dealsDamage: false,
        title: CARD_NAME,
        description: 'Choose any target — it is defeated.',
        confirmLabel: '💀 Defeat!',
        confirmClass: 'btn-danger',
        cancellable: true,
      });

      if (!target) {
        engine.log('hand_of_death_fizzle', {
          player: ps.username, reason: 'cancelled',
        });
        return;
      }

      // ── Resolve the defeat ──
      let defeated = false;
      if (target.type === 'hero') {
        const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (hero?.name && hero.hp > 0) {

          // Anti Magic gate (Lv 1 Destruction Spell — covered by AM 1+).
          if (engine._isHeroSpellProtected(hero, CARD_NAME)) {
            engine.log('hand_of_death_blocked', {
              target: hero.name, reason: 'magic_immune',
            });
            engine._playAntiMagicBlockedAnim(hero);
            return; // No defeat → no skip-next-turn rider.
          }

          // Resistance gate (and any other `BEFORE_HERO_EFFECT`
          // listener). The hook gives Resistance — and future
          // similar non-damage-effect-cancellers — a chance to
          // cancel before any visible mutation lands.
          const blockCtx = {
            playerIdx: target.owner,
            heroIdx: target.heroIdx,
            hero,
            effectType: 'defeat',
            cancelled: false,
            _skipReactionCheck: true,
          };
          await engine.runHooks('beforeHeroEffect', blockCtx);
          if (blockCtx.cancelled) {
            engine.log('hand_of_death_blocked', {
              target: hero.name, reason: 'effect_cancelled',
            });
            return; // No defeat → no skip-next-turn rider.
          }

          // ── Strike animation — the flashy bit ──
          // Anchored to the target Hero's slot. Pass `duration` to keep
          // the component mounted through its full 1700ms lifespan.
          engine._broadcastEvent('play_zone_animation', {
            type: 'hand_of_death_strike',
            owner: target.owner, heroIdx: target.heroIdx, zoneSlot: -1,
            duration: 1700,
          });
          await engine._delay(900); // sync the defeat with the impact

          const result = await engine.actionDefeatHero(sourceMeta, hero);
          defeated = !!result?.defeated;

          // Let the strike animation finish blooming after the defeat
          // numbers settle.
          await engine._delay(400);
        }
      } else {
        // 'equip' / 'creature' — a Creature in a Support Zone.
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          (c.owner === target.owner || c.controller === target.owner)
          && c.zone === 'support' && c.heroIdx === target.heroIdx
          && c.zoneSlot === target.slotIdx,
        );
        if (inst && inst.zone === 'support') {
          // ── Strike animation on the Creature's slot ──
          engine._broadcastEvent('play_zone_animation', {
            type: 'hand_of_death_strike',
            owner: inst.owner, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
            duration: 1700,
          });
          await engine._delay(900);

          // `actionDestroyCard` handles every creature immunity
          // (Cardinal Beast, Defending the Gate, first-turn shield,
          // _stealImmortal, _damageDestroyImmune, Sparkfly Attendant
          // gift, etc.) internally and is silent on success/failure.
          // Sniff `inst.zone` post-call to verify the destroy landed.
          await engine.actionDestroyCard(sourceMeta, inst);
          defeated = inst.zone !== 'support';

          await engine._delay(400);
        }
      }

      // ── Skip-next-turn rider ──
      // Only when a target was actually defeated. Uses the engine's
      // canonical `_skipNextTurn` flag (Guardian Beast Zhu's
      // mechanism) — `switchTurn` reads it and skips the player's
      // upcoming turn automatically.
      if (defeated) {
        ps._skipNextTurn = true;
        engine.log('hand_of_death_skip_turn', {
          player: ps.username, target: target.cardName,
        });
      }

      engine.log('hand_of_death_resolved', {
        player: ps.username, target: target.cardName, defeated,
      });
      engine.sync();
    },
  },
};
