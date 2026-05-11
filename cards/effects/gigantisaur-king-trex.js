// ═══════════════════════════════════════════
//  CARD EFFECT: "Gigantisaur King Trex"
//  Creature (Normal, Lv3, Summoning Magic) — Gigantisaurs
//  HP 400, secret_rare
//
//  ① UNIQUENESS — Trex's per-Hero archetype rule
//    is RELAXED: he CAN be summoned onto a Hero
//    that already hosts another Gigantisaur, but
//    only if that Gigantisaur is sacrificable
//    (i.e. not another Trex). In that case Trex's
//    `beforeSummon` auto-picks that Hero's
//    Gigantisaur as the tribute — no player
//    prompt. If the target Hero has NO Gigantisaur,
//    `beforeSummon` falls back to the standard
//    sacrifice-pick prompt (any sacrificable
//    Gigantisaur on our side).
//
//    Card-effect placements that BYPASS
//    `beforeSummon` (Necromancy, Forceful Revival,
//    Soul Shard revives, Skullmael, …) don't run
//    the auto-sacrifice. Those paths typically
//    pre-check `canSummon` via
//    `isCreatureSummonable` and would see the
//    loose gate — `_bypassBeforeSummon: true` in
//    the ctxExtras of those calls re-applies the
//    strict per-Hero rule. Callers that don't
//    pass the flag inherit the loose gate as
//    accepted behaviour.
//
//  ② TRIBUTE SUMMON — Summoning is an additional
//    Action (`inherentAction: true` so the action
//    slot isn't consumed).
//
//  ③ PASSIVE — While controlled, every "Gigantisaur"
//    Creature in your hand is treated as Lv0 for
//    spell-school checks. Implemented by stamping
//    `levelOverrideCards[name] = 0` on every alive
//    own Hero for each Gigantisaur Creature name,
//    tracked via a per-player registry so we only
//    tear down the entries WE wrote (no clobbering
//    Sol Rym / Fiedel-style overrides).
//
//  Negation note: if a King Trex is negated while
//  in play, its hooks stop firing — the override
//  CAN go stale until the negated copy leaves play
//  (death / bounce will fire onCardLeaveZone and
//  trigger cleanup). Accepted edge case.
// ═══════════════════════════════════════════

const {
  isGigantisaurCreature,
} = require('./_gigantisaurs-shared');

const CARD_NAME = 'Gigantisaur King Trex';

/**
 * Sacrifice candidates for King Trex: own Gigantisaur Creatures in
 * support, excluding any King Trex (the card text explicitly
 * exempts itself) and the just-being-summoned dummy if present.
 */
function _trexSacrificeCandidates(engine, pi, selfId) {
  const cs = engine.getSacrificableCreatures(pi);
  return cs.filter(c =>
    isGigantisaurCreature(c.cardName, engine)
    && c.cardName !== CARD_NAME
    && (!selfId || c.inst.id !== selfId)
  );
}

/**
 * Number of NON-NEGATED King Trex instances the player still
 * controls. Used to know whether the "I just left, clean up" cleanup
 * should fire (only the LAST King Trex leaving triggers a sweep).
 */
function _activeKingTrexCount(engine, pi, excludeInstId = null) {
  let n = 0;
  for (const c of engine.cardInstances) {
    if (c.zone !== 'support') continue;
    if ((c.controller ?? c.owner) !== pi) continue;
    if (c.name !== CARD_NAME) continue;
    if (excludeInstId && c.id === excludeInstId) continue;
    if (c.counters?.negated || c.counters?.nulled) continue;
    n++;
  }
  return n;
}

/**
 * Apply Lv0 overrides on every alive own Hero for every Gigantisaur
 * Creature card name. Stamps `levelOverrideCards[name] = 0` ONLY when
 * no override (or a higher override) is currently set — preserves
 * lower-wins semantics so an unrelated `Chain Lightning = 0`-style
 * override is never disturbed. Tracks which names WE stamped per Hero
 * in `ps._kingTrexOverrideRegistry` so cleanup can be precise.
 */
function _applyOverrides(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return;
  if (!ps._kingTrexOverrideRegistry) ps._kingTrexOverrideRegistry = {};
  const registry = ps._kingTrexOverrideRegistry;

  const cardDB = engine._getCardDB();
  const gigantisaurNames = [];
  for (const name of Object.keys(cardDB)) {
    if (isGigantisaurCreature(name, engine)) gigantisaurNames.push(name);
  }

  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    if (!hero.levelOverrideCards) hero.levelOverrideCards = {};
    if (!registry[hi]) registry[hi] = [];

    for (const name of gigantisaurNames) {
      const existing = hero.levelOverrideCards[name];
      // Lower wins — leave a Sol Rym-style hard zero alone, but also
      // re-stamp our own 0 when nothing's there.
      if (existing == null || existing > 0) {
        // Only track in the registry if we ACTUALLY set it (i.e. no
        // prior value). If there was a higher prior override, we're
        // replacing it — but we still want cleanup to restore the
        // prior value rather than blindly deleting. Snapshot under
        // an inner key.
        if (!registry[hi].some(e => e.name === name)) {
          registry[hi].push({
            name,
            prevValue: existing === undefined ? null : existing,
          });
        }
        hero.levelOverrideCards[name] = 0;
      }
    }
  }
}

/**
 * Roll back every override we stamped — delete the level entry when
 * `prevValue` was null (didn't exist before us) OR restore the prior
 * value when we replaced an existing higher override.
 */
function _clearOverrides(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return;
  const registry = ps._kingTrexOverrideRegistry;
  if (!registry) return;

  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    const entries = registry[hi];
    if (!hero || !entries) continue;
    if (!hero.levelOverrideCards) continue;
    for (const e of entries) {
      // Only roll back if the current value is still our 0. If
      // something LOWER got installed since (unlikely — 0 is the
      // floor), leave it alone.
      if (hero.levelOverrideCards[e.name] === 0) {
        if (e.prevValue == null) {
          delete hero.levelOverrideCards[e.name];
        } else {
          hero.levelOverrideCards[e.name] = e.prevValue;
        }
      }
    }
  }
  delete ps._kingTrexOverrideRegistry;
}

module.exports = {
  activeIn: ['support'],
  // Free additional Action — the play itself doesn't consume the
  // host Hero's action slot. Same pattern as 500 Piranhas.
  inherentAction: true,

  /**
   * Hero already host another Gigantisaur for the per-Hero check?
   * Self-excludes the in-flight Trex dummy.
   */
  // (internal helper — defined as a closure over isGigantisaurCreature)

  /**
   * canSummon — relaxed per-Hero rule:
   *   • Need ≥1 sacrificable Gigantisaur (any Hero) overall.
   *   • Per-Hero (cardHeroIdx >= 0): allow if the target Hero is
   *     Gigantisaur-free, OR if a sacrificable Gigantisaur sits ON
   *     THAT HERO (auto-sacrifice path frees its slot of the rule).
   *   • Card-wide (cardHeroIdx === -1): allow iff SOME capable Hero
   *     satisfies the per-Hero check above.
   *
   * Heroes with only a non-sacrificable Gigantisaur (another Trex)
   * are refused — the auto-sacrifice would fail and the strict
   * archetype rule kicks in.
   */
  canSummon(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const selfId = ctx.card?.id;
    const ps = engine.gs?.players?.[pi];
    if (!ps) return false;

    const candidates = _trexSacrificeCandidates(engine, pi, selfId);
    if (candidates.length === 0) return false;

    // STRICT mode — auto-sacrifice path won't run (card-effect
    // placement that bypasses beforeSummon). Callers opt in via
    // `isCreatureSummonable(..., { _bypassBeforeSummon: true })`.
    // In strict mode the standard archetype rule applies: refuse
    // any Hero already hosting a Gigantisaur (other than the
    // in-flight Trex dummy).
    const strict = ctx._bypassBeforeSummon === true;

    const heroHostsAnotherGigantisaur = (hi) => {
      for (const c of engine.cardInstances) {
        if (c.zone !== 'support') continue;
        if ((c.controller ?? c.owner) !== pi) continue;
        if (c.heroIdx !== hi) continue;
        if (selfId && c.id === selfId) continue;
        if (isGigantisaurCreature(c.name, engine)) return true;
      }
      return false;
    };

    if (typeof heroIdx === 'number' && heroIdx >= 0) {
      if (!heroHostsAnotherGigantisaur(heroIdx)) return true;
      if (strict) return false;
      // Hero hosts a Gigantisaur — must be sacrificable.
      return candidates.some(c => c.inst.heroIdx === heroIdx);
    }

    const cardData = engine._getCardDB()[ctx.cardName];
    if (!cardData) return true;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (hero.statuses?.frozen || hero.statuses?.stunned) continue;
      if (!engine.heroMeetsLevelReq(pi, hi, cardData)) continue;
      if (!heroHostsAnotherGigantisaur(hi)) return true;
      if (strict) continue;
      if (candidates.some(c => c.inst.heroIdx === hi)) return true;
    }
    return false;
  },

  /**
   * Pay the tribute cost.
   *   • If the target Hero already hosts a sacrificable Gigantisaur,
   *     AUTO-PICK that one as the tribute (no prompt) — fulfilling
   *     the "summon to that Hero ⇒ sacrifice that Hero's Gigantisaur"
   *     rule. Runs the same `onCreatureSacrificed` + `actionDestroyCard`
   *     pair `resolveSacrificeCost` uses, so on-sacrifice / on-death
   *     triggers (Hell Fox, etc.) fire identically.
   *   • Otherwise, run the standard pick-from-anywhere prompt.
   *   • Cancel or no valid candidate → refuse the summon.
   */
  beforeSummon: async (ctx) => {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const selfId = ctx.card?.id;
    const candidates = _trexSacrificeCandidates(engine, pi, selfId);
    if (candidates.length === 0) return false;

    // Auto-sacrifice path: a sacrificable Gigantisaur sits ON the
    // target Hero. Pick it without prompting.
    const onHero = candidates.find(c => c.inst.heroIdx === heroIdx);
    if (onHero) {
      const tribute = onHero.inst;
      const tributeName = onHero.cardName;
      const source = { name: CARD_NAME, owner: pi, heroIdx };
      // ON_CREATURE_SACRIFICED before destroy — same ordering
      // `resolveSacrificeCost` uses so listeners see the live inst.
      try {
        // Flavor: Trex chomps its tribute — same `dino_bite` animation
        // Spinor uses, scaled to a moderate-strong bite.
        engine._broadcastEvent('play_zone_animation', {
          type: 'dino_bite',
          owner: tribute.owner,
          heroIdx: tribute.heroIdx,
          zoneSlot: tribute.zoneSlot,
          damage: 300,
        });
        await engine._delay(550);
        await engine.runHooks('onCreatureSacrificed', {
          creature: tribute,
          cardName: tributeName,
          owner: tribute.owner,
          heroIdx: tribute.heroIdx,
          zoneSlot: tribute.zoneSlot,
          source,
          _skipReactionCheck: true,
        });
        await engine.actionDestroyCard(source, tribute, {
          fireCreatureDeath: true,
        });
      } catch (err) {
        console.error(`[${CARD_NAME}] auto-tribute failed:`, err.message);
        return false;
      }
      engine.log('king_trex_auto_tribute', {
        player: engine.gs.players[pi]?.username,
        tribute: tributeName, heroIdx,
      });
      return true;
    }

    // Standard prompt path — Hero has no Gigantisaur, pick one from
    // anywhere on our side. `sacrificeAnimation: 'dino_bite'`
    // overrides the default knife-plunge so the tribute gets chomped
    // by Trex's jaws (matches Spinor's bite visual).
    const sacrificed = await engine.resolveSacrificeCost(ctx, {
      minCount: 1,
      maxCount: 1,
      // Re-narrow inside resolveSacrificeCost — defense in depth.
      filter: (c) => isGigantisaurCreature(c.cardName, engine)
        && c.cardName !== CARD_NAME
        && (!selfId || c.inst.id !== selfId),
      title: `${CARD_NAME} — Tribute`,
      description: 'Sacrifice 1 of your Gigantisaur Creatures (other than Gigantisaur King Trex) to summon Gigantisaur King Trex.',
      confirmLabel: '🦖 Sacrifice & Summon!',
      confirmClass: 'btn-danger',
      cancellable: true,
      sacrificeAnimation: 'dino_bite',
      sacrificeAnimationDelay: 550,
      sacrificeAnimationExtras: { damage: 300 },
    });
    return !!sacrificed;
  },

  hooks: {
    /**
     * Apply overrides when THIS King Trex enters support.
     */
    onPlay: (ctx) => {
      if (ctx.playedCard?.id !== ctx.card.id) return;
      if (ctx.cardZone !== 'support') return;
      _applyOverrides(ctx._engine, ctx.cardOwner);
    },

    /**
     * Re-apply each turn start (defensive — covers Hero swaps, Ascension,
     * future "hero added mid-game" cases, and re-asserts the override on
     * Heroes whose levelOverrideCards map might have been wiped).
     */
    onTurnStart: (ctx) => {
      const engine = ctx._engine;
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support') return;
      if (inst.counters?.negated || inst.counters?.nulled) return;
      _applyOverrides(engine, ctx.cardOwner);
    },

    /**
     * Cleanup on leave (death, bounce, deletion, etc.). Only the LAST
     * King Trex leaving triggers the rollback — sibling copies keep
     * the override alive.
     */
    onCardLeaveZone: (ctx) => {
      const engine = ctx._engine;
      const inst = ctx.card;
      const leaving = ctx.leavingCard;
      if (!inst || !leaving) return;
      if (leaving.id !== inst.id) return;
      if (ctx.fromZone !== 'support') return;
      // Sibling check: any OTHER non-negated King Trex still in play
      // on the same controller's side?
      const pi = ctx.cardOwner;
      if (_activeKingTrexCount(engine, pi, inst.id) > 0) return;
      _clearOverrides(engine, pi);
    },
  },
};
