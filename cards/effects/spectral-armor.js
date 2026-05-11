// ═══════════════════════════════════════════
//  CARD EFFECT: "Spectral Armor"
//  Spell (Reaction, Magic Arts / Support Magic Lv1)
//
//  Play this card immediately when a target you
//  control would take any damage. Halve that
//  damage (rounded up).
//
//  Wiring (pre-damage reaction):
//    • `isPreDamageReaction: true` — the engine
//      offers this card BEFORE the damage applies,
//      so the halving can save a Hero from lethal
//      damage (an after-damage restore-half would
//      arrive after the death-check already fired).
//    • `preDamageResolve` returns
//      `{ amountOverride: ceil(amount / 2) }` — the
//      damage still LANDS (animations, afterDamage,
//      armed-arrow riders, on-hit status apply all
//      fire normally) but the dealt amount is
//      halved before HP loss.
//    • No lingering buff (this is the only
//      difference from Cloud in a Bottle).
//
//  CPU decision-making:
//    • PUZZLE mode → activate iff halving would
//      save the targeted Hero from lethal damage
//      (otherwise hold). The user wants the puzzle
//      brain to make the optimal save without
//      wasting Spectral Armor on a non-lethal hit.
//    • COMBAT mode → MCTS-evaluate "halve now vs
//      hold for later" via `mctsPickFromOptions`.
//      The rollout naturally weighs whether the
//      target is worth protecting, whether the
//      damage is lethal, whether opp has bigger
//      hits queued, and what the rest-of-turn
//      score looks like with vs without the
//      Spectral Armor still in hand.
//      → No heuristics inside the decision; the
//      engine's `evaluateState` does the arithmetic.
// ═══════════════════════════════════════════

const CARD_NAME = 'Spectral Armor';

module.exports = {
  isPreDamageReaction: true,

  // Strictly reactive — never proactively played, never a chain-link
  // candidate. Hand-side card stays dimmed in the normal action UI.
  canActivate: () => false,
  neverPlayable: true,
  activeIn: ['hand'],

  /**
   * Trigger: any positive incoming damage to a Hero we control. No
   * source-type filter (the card text says "any damage"). The engine
   * already gates target ownership before reaching this — `ownerIdx`
   * is the target Hero's controller.
   */
  preDamageCondition(_gs, _ownerIdx, _engine, _target, _heroIdx, _source, amount, _type) {
    return amount > 0;
  },

  /**
   * Halve the incoming damage (rounded up). Pre-damage path, so the
   * HP drop uses the halved amount — saves from lethal when
   * original > hp ≥ halved. `amountOverride` keeps the hit live for
   * downstream effects (Reiza Poison+Stun, armed-arrow Burn riders,
   * etc.); only the HP-loss number is reduced.
   */
  async preDamageResolve(engine, ownerIdx, target, heroIdx, _source, amount, _type) {
    const halved = Math.ceil(amount / 2);
    // Knight-armor + teal-tint animation on the protected Hero. The
    // animation duration (~700ms) overlaps the damage-floater +
    // hp-bar tween so the player sees the armor materialise as the
    // (now-halved) damage lands.
    engine._broadcastEvent('play_zone_animation', {
      type: 'spectral_armor', owner: ownerIdx, heroIdx, zoneSlot: -1,
    });
    await engine._delay(450);

    const ps = engine.gs.players[ownerIdx];
    engine.log('spectral_armor', {
      player: ps?.username, hero: target?.name,
      originalDamage: amount, halvedDamage: halved,
    });
    return { amountOverride: halved };
  },

  /**
   * CPU decision-maker. Async — returns a Promise that the engine's
   * `_getCpuGenericResponse` plumbing awaits. Returning `undefined`
   * defers to the engine's default (which would activate every
   * reaction ASAP — wrong for a "save it for the lethal hit" card).
   *
   * Puzzle mode: deterministic save-from-lethal heuristic, matching
   * the user's spec ("always use if reduced damage is not lethal").
   * Combat mode: MCTS over [confirm, decline] with a rollout that
   * applies the halved-damage / full-damage hit and then plays the
   * rest of the turn out — the engine's evaluator scores both
   * resulting states and picks the better one.
   */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (promptData?.type !== 'confirm') return undefined;
    if ((promptData?._gerryOriginalTitle || promptData?.title) !== CARD_NAME) return undefined;

    const ctx = promptData._preDamageContext;
    if (!ctx) return undefined; // No structured context — fall through.

    const { targetOwner, targetHeroIdx, amount } = ctx;
    const target = engine.gs?.players?.[targetOwner]?.heroes?.[targetHeroIdx];
    if (!target) return null;

    const halved = Math.ceil(amount / 2);
    const wouldLethal = target.hp <= amount;
    const halvedSaves = wouldLethal && target.hp > halved;

    // ── PUZZLE MODE — deterministic ─────────────────────────────
    // Always use Spectral Armor when it cleanly saves the Hero
    // from a lethal hit. Otherwise hold — puzzle solutions are
    // single-turn so "save for later" usually means "don't burn
    // resource on a non-lethal hit". A puzzle whose intended
    // solution wants the halving for chip damage can drop the
    // Spectral Armor from the CPU's hand entirely.
    if (engine.isPuzzle) {
      return halvedSaves ? { confirmed: true } : null;
    }

    // ── COMBAT MODE — MCTS ──────────────────────────────────────
    // Lazy-require to avoid a CPU↔card-script load cycle, same
    // pattern Barker uses for its placement MCTS.
    let mctsPick = null;
    try { ({ mctsPickFromOptions: mctsPick } = require('./_cpu')); } catch {}
    if (typeof mctsPick !== 'function' || engine._inMctsSim) {
      // Inside a rollout (or _cpu unavailable) — fall back to the
      // same deterministic save-from-lethal we use for puzzles.
      // This isn't the main heuristic the user warned against
      // because it only fires inside nested rollouts; the outer
      // MCTS pick decides the real activation choice.
      return halvedSaves ? { confirmed: true } : null;
    }

    const options = [
      { id: 'confirm', value: { confirmed: true } },
      { id: 'decline', value: null },
    ];

    const apply = async (eng, opt) => {
      const t = eng.gs?.players?.[targetOwner]?.heroes?.[targetHeroIdx];
      const ps = eng.gs?.players?.[targetOwner];
      if (!t || !ps) return false;
      if (opt.id === 'confirm') {
        // Spectral Armor activates: damage halved, card consumed.
        const dealt = Math.min(t.hp, halved);
        t.hp -= dealt;
        const hIdx = (ps.hand || []).indexOf(CARD_NAME);
        if (hIdx >= 0) ps.hand.splice(hIdx, 1);
      } else {
        // Decline: full damage, Spectral Armor stays in hand.
        const dealt = Math.min(t.hp, amount);
        t.hp -= dealt;
      }
      return true;
    };

    // Async — engine's `_getCpuGenericResponse` plumbing returns the
    // value as-is, and `promptGeneric`'s caller awaits the result.
    // Wrap in a Promise so the engine sees a thenable and unwraps it
    // correctly (sibling pattern to Barker's MCTS branch).
    return (async () => {
      try {
        const best = await mctsPick(engine, options, apply, { horizon: 4 });
        return best?.value ?? null;
      } catch (err) {
        console.error('[Spectral Armor MCTS]', err.message);
        // Last-ditch fallback if MCTS itself throws: save-from-lethal.
        return halvedSaves ? { confirmed: true } : null;
      }
    })();
  },
};
