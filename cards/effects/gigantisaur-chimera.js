// ═══════════════════════════════════════════
//  CARD EFFECT: "Gigantisaur Chimera"
//  Creature (Normal, Lv3, Summoning Magic) — Gigantisaurs
//  HP 900, secret_rare
//
//  ① UNIQUENESS — shared archetype rule.
//
//  ② TRIBUTE SUMMON — can only be summoned by
//    sending 3 different-named "Gigantisaur"
//    Creatures from your hand to the discard
//    pile. Summoning is an additional Action
//    (`inherentAction: true`), BUT the summoning
//    player's turn ends immediately afterwards
//    via `engine.advanceToPhase(pi, 5)`.
//
//  ③ ACTIVE (HOPT) — once per turn, choose any
//    target and deal damage equal to 100 × the
//    number of different "Gigantisaur" Creature
//    names in your discard pile.
// ═══════════════════════════════════════════

const {
  gigantisaursCanSummon, isGigantisaurCreature,
  countDistinctGigantisaursInPile,
} = require('./_gigantisaurs-shared');

const CARD_NAME = 'Gigantisaur Chimera';
const HOPT_KEY = 'chimera-blast';
const DMG_PER_NAME = 100;

/**
 * How many DISTINCT Gigantisaur Creature names are AVAILABLE to be
 * sent to the discard pile to pay Chimera's cost? The in-flight
 * Chimera (the one being summoned) doesn't count — it's moving from
 * hand to support, not to the discard pile. A sibling Chimera in
 * another hand slot IS countable (different physical card, same
 * name).
 *
 * Optional `excludeHandIdx` pins the in-flight slot when known
 * (chain-summon path via Raptoren). When omitted (the standard
 * `canSummon` gate, which fires BEFORE `_resolvingCard` is set),
 * we approximate: if the hand holds exactly one Chimera, that one
 * is the in-flight copy — subtract Chimera from the distinct-name
 * count.
 */
function _availableDistinctGigantisaurNames(ps, engine, excludeHandIdx = -1) {
  const seenByIdx = new Map(); // name → count (excluding the in-flight slot)
  for (let i = 0; i < (ps.hand || []).length; i++) {
    if (i === excludeHandIdx) continue;
    const cn = ps.hand[i];
    if (!isGigantisaurCreature(cn, engine)) continue;
    seenByIdx.set(cn, (seenByIdx.get(cn) || 0) + 1);
  }
  if (excludeHandIdx >= 0) return seenByIdx.size;
  // canSummon-time approximation: subtract Chimera if it's only
  // present once (= the in-flight copy).
  const chimeraCount = (ps.hand || []).filter(cn => cn === CARD_NAME).length;
  let count = seenByIdx.size;
  if (chimeraCount <= 1 && seenByIdx.has(CARD_NAME)) count -= 1;
  return count;
}

module.exports = {
  activeIn: ['support'],
  // Free additional Action — the summon itself doesn't consume the
  // host's action slot. The post-summon advanceToPhase(END) is what
  // limits the play, not an action gate.
  inherentAction: true,

  cpuMeta: {
    /**
     * Massive eval bonus while Chimera is on the board. Game-defining
     * body + once-per-turn N×100 blast off the discard pile — easily
     * outweighs the 3 hand-card discard cost (typical Lv≤3 Gigantisaurs
     * are ~30–60 in hand value, so 3 discards ≈ -150). +300 here keeps
     * the summon a clearly positive play whenever the cost is payable.
     */
    cpuInstBonus(engine, inst /*, ownerIdx */) {
      if (inst.zone !== 'support') return 0;
      if (inst.faceDown) return 0;
      return 300;
    },

    /**
     * Chimera's onPlay force-ends the controller's turn, so the CPU
     * must defer its summon until every OTHER viable play has been
     * exhausted. The `fireAdditionalActions` loop's two-pass hand
     * ordering respects this flag — non-deferred cards fire first,
     * Chimera only gets considered once nothing else is left to do.
     */
    cpuDeferUntilLast: true,
  },

  /**
   * Layered canSummon: standard per-Hero archetype gate PLUS the
   * cost gate (≥3 distinct Gigantisaur names in hand). Chimera in
   * hand counts toward the 3-different cost only if a SECOND copy
   * is present — the in-flight Chimera being summoned isn't itself
   * being "sent to the discard pile" by the cost.
   */
  canSummon(ctx) {
    if (!gigantisaursCanSummon(ctx)) return false;
    const engine = ctx._engine;
    const ps = engine.gs.players[ctx.cardOwner];
    if (!ps) return false;
    return _availableDistinctGigantisaurNames(ps, engine) >= 3;
  },

  /**
   * Pay the 3-different-name discard cost. Iterative `forceDiscard-
   * Cancellable` prompts — same pattern as Pteranos's distinct-name
   * draw, but mandatory (3 picks; cancel any of them = refuse summon).
   */
  beforeSummon: async (ctx) => {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    if (!ps) return false;

    // When the in-flight Chimera is still physically in hand (chain-
    // summon paths like Raptoren's that defer the splice until after
    // a successful summon — see gigantisaur-raptoren.js), exclude
    // that slot so the player can't pay for the summon by discarding
    // the Chimera they're trying to summon. `_resolvingCard` is the
    // standard engine signal for "this hand slot is the in-flight
    // copy."
    const resolvingIdx = (() => {
      if (!ps._resolvingCard || ps._resolvingCard.name !== CARD_NAME) return -1;
      const { name, nth } = ps._resolvingCard;
      let count = 0;
      for (let i = 0; i < (ps.hand || []).length; i++) {
        if (ps.hand[i] === name) {
          count++;
          if (count === nth) return i;
        }
      }
      return -1;
    })();

    if (_availableDistinctGigantisaurNames(ps, engine, resolvingIdx) < 3) return false;

    // Destination zone Chimera is about to land on — populated by
    // doPlayCreature (see server.js) before beforeSummon runs. Used
    // for the gore-bite animation site so each tribute reads as
    // being devoured by the incoming Chimera in its arrival slot.
    // Falls back to slot 0 / heroIdx in case the request flag isn't
    // set (defensive — every drag-drop path stamps it).
    const destSlot = (ps._requestedNormalSummonSlot?.heroIdx === ctx.cardHeroIdx
      ? ps._requestedNormalSummonSlot.slotIdx
      : 0);

    // All 3 tribute discards land in one forced-discard batch so any
    // on-discard reactors (Glass of Marbles, Skull Necklace) wait
    // until every tribute is in the pile before resolving — matches
    // the engine-wide "discards first, reactors after" ordering.
    return await engine.withDiscardBatch(pi, { source: CARD_NAME }, async () => {
      const discardedNames = new Set();
      let discarded = 0;
      while (discarded < 3) {
        const eligibleIndices = [];
        for (let i = 0; i < (ps.hand || []).length; i++) {
          if (i === resolvingIdx) continue;
          const cn = ps.hand[i];
          if (!isGigantisaurCreature(cn, engine)) continue;
          if (discardedNames.has(cn)) continue;
          eligibleIndices.push(i);
        }
        if (eligibleIndices.length === 0) return false;

        const remaining = 3 - discarded;
        const result = await engine.promptGeneric(pi, {
          type: 'forceDiscardCancellable',
          title: CARD_NAME,
          description: `Send ${remaining} more different-named Gigantisaur Creature${remaining === 1 ? '' : 's'} to the discard pile to summon Gigantisaur Chimera.`,
          instruction: 'Click a highlighted Gigantisaur in your hand.',
          eligibleIndices,
          cancellable: true,
          cancelLabel: 'Back',
        });
        if (!result || result.cancelled || result.cardName == null) return false;

        const ok = await engine.actionDiscardHandCard(pi, result.cardName, result.handIndex, {
          source: CARD_NAME,
        });
        if (!ok) return false;
        discardedNames.add(result.cardName);
        discarded++;

        // Bloodier dino-bite on the Chimera's arrival zone — same
        // jaw visual Spinor / Trex use, but in gore mode (deeper
        // crimson, denser splatter, DEVOUR! roar, blood drips).
        // Fires per discarded tribute so the player sees three
        // distinct chomps, ramping the brutality of the summon.
        engine._broadcastEvent('play_zone_animation', {
          type: 'dino_bite',
          owner: pi,
          heroIdx: ctx.cardHeroIdx,
          zoneSlot: destSlot,
          damage: 400,
          gore: true,
        });
        await engine._delay(420);
      }
      return true;
    });
  },

  hooks: {
    /**
     * Post-summon turn end. Filter to THIS Chimera's own summon
     * (sibling Chimera onPlay fires would otherwise re-end the turn
     * needlessly). The advance is async — let it run in the same
     * tick as Cooldin / Tengu Windstorm, both established prior art
     * for in-effect turn-end via `advanceToPhase(pi, 5)`.
     */
    onPlay: async (ctx) => {
      if (ctx.playedCard?.id !== ctx.card.id) return;
      if (ctx.cardZone !== 'support') return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;
      if (gs.result) return; // game already over

      // Brief beat so the summon's onPlay visuals settle before the
      // turn-end housekeeping begins.
      await engine._delay(300);

      engine.log('chimera_force_end_turn', {
        player: ps.username, turn: gs.turn,
      });

      const phase = gs.currentPhase;
      if (phase >= 2 && phase <= 4) {
        await engine.advanceToPhase(pi, 5);
      }
    },
  },

  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const hoptKey = `${HOPT_KEY}:${ctx.card?.id ?? 'inst'}`;
    if (gs.hoptUsed?.[hoptKey] === gs.turn) return false;
    const ps = gs.players[pi];
    if (!ps) return false;
    // Effect is meaningless with 0 distinct Gigantisaurs in discard.
    const { count } = countDistinctGigantisaursInPile(ps.discardPile, engine);
    return count > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return false;

    const { count } = countDistinctGigantisaursInPile(ps.discardPile, engine);
    if (count <= 0) return false;
    const damage = DMG_PER_NAME * count;

    const target = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero', 'creature'],
      title: CARD_NAME,
      description: `Deal ${damage} damage (${count} different Gigantisaurs × ${DMG_PER_NAME}) to a target.`,
      confirmLabel: `🦖 Blast! (${damage})`,
      confirmClass: 'btn-danger',
      cancellable: true,
    });
    if (!target) return false;

    if (!gs.hoptUsed) gs.hoptUsed = {};
    const hoptKey = `${HOPT_KEY}:${ctx.card?.id ?? 'inst'}`;
    gs.hoptUsed[hoptKey] = gs.turn;

    const tgtZoneSlot = target.type === 'hero' ? -1 : target.slotIdx;
    // Chimera's signature chomp — `dino_bite` in gore mode (deeper
    // crimson, darker jaws, denser splatter, blood drips, DEVOUR! roar).
    // `damage` is forwarded as-is so the jaw size still scales with the
    // blast magnitude on top of the gore bump.
    engine._broadcastEvent('play_zone_animation', {
      type: 'dino_bite', owner: target.owner,
      heroIdx: target.heroIdx, zoneSlot: tgtZoneSlot,
      damage, gore: true,
    });
    // Spinor's bite waits ~420ms for jaws to drop and snap before the
    // damage number pops — match that beat so the visual lands with
    // the actual HP change instead of fizzling out behind it.
    await engine._delay(420);

    const dmgSource = { name: CARD_NAME, owner: pi, heroIdx: ctx.cardHeroIdx };
    if (target.type === 'hero') {
      const h = gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (h && h.hp > 0) {
        await engine.actionDealDamage(dmgSource, h, damage, 'creature');
      }
    } else if (target.cardInstance) {
      await engine.actionDealCreatureDamage(
        dmgSource, target.cardInstance, damage, 'creature',
        { sourceOwner: pi, canBeNegated: true },
      );
    }

    engine.log('chimera_blast', {
      player: ps.username, target: target.cardName,
      distinct: count, damage,
    });
    engine.sync();
    return true;
  },
};
