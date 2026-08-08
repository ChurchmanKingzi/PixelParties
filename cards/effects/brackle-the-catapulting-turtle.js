// ═══════════════════════════════════════════
//  CARD EFFECT: "Brackle, the Catapulting Turtle"
//  Hero — 400 HP, 60 ATK. Starting abilities:
//  Cannibalism × 2.
//
//  Hero Effect (once per turn):
//  Sacrifice a Creature you control that was NOT
//  summoned this turn → choose a target → deal
//  damage to it equal to the sacrificed Creature's
//  current HP, max 300. Treated as an Attack.
//
//  Implementation
//  ──────────────
//  • `heroEffect: true` + standard `onHeroEffect`
//    contract. The engine auto-stamps the per-hero
//    HOPT on truthy return (see `doActivateHeroEffect`
//    in `server.js` ~L5582). Returning false at any
//    cancel point refunds the slot for the turn.
//
//  • Sacrifice candidate filter: own-side, in
//    support, face-up, NOT summoned this turn
//    (`inst.turnPlayed !== gs.turn`). The engine's
//    `getSacrificableCreatures` already handles
//    Cardinal Beast immunity / tokens / etc., so
//    we only add the per-turn summoning-sickness
//    layer on top. Note that `getSacrificableCreatures`
//    intentionally does NOT filter by summoning
//    sickness itself — the Brackle rule is a
//    card-specific overlay.
//
//  • Damage snapshot: read `currentHp` at the
//    moment the sacrifice is committed (after
//    the player confirms the target). Capped at
//    300 per text. Snapshot survives the subsequent
//    destroyCard so even if the sacrifice timing
//    is later than the damage, the amount stays
//    correct.
//
//  • "Treated as an Attack" → damage type `'attack'`.
//    Composes with attack-keyed hooks (Sacred Hammer,
//    Sun Sword burn rider, Smug Coin, Bear Rider's
//    stun-on-attack, …) the same way a Hero's
//    direct attack would. The 300 cap applies to
//    the BASE amount; attack-side modifiers compose
//    on top, mirroring how `hero.atk` interacts
//    with arrow / Hammer riders.
//
//  • Animation: the sacrificed Creature visually
//    moves on top of Brackle (phase 1 `play_ram_animation`
//    sourced from the Creature's support slot,
//    targeting Brackle's hero zone), THEN dashes
//    from Brackle to the chosen target (phase 2,
//    sourced from Brackle's hero zone). `isSupportRamming`
//    on the client side hides the source slot's
//    card during phase 1, and `isRamming` hides
//    Brackle during phase 2 — visually selling
//    "Brackle picks up the Creature, then catapults
//    it". `cardName` on both broadcasts is the
//    SACRIFICED Creature's name so the same card
//    is what flies the full route. Same `play_ram_animation`
//    event "The Yeeting" uses for its dash.
//
//  • Sacrifice timing: destroyCard fires AFTER
//    the damage lands. Lets the catapulted Creature
//    stay tracked through phase 1 + phase 2 + the
//    damage application; only then does
//    `onCreatureSacrificed` fire and the corpse
//    routes to discard. The order matches every
//    other sacrifice-then-payoff card in the
//    codebase (Loyal Rottweiler, Gigantisaur King
//    Trex auto-tribute, etc.).
// ═══════════════════════════════════════════

const CARD_NAME = 'Brackle, the Catapulting Turtle';
const MAX_DAMAGE = 300;

// Catapult animation phases — driven by a single client event
// (`play_brackle_catapult`) that owns the full visual flow. The
// client interpolates ONE flying card across FIVE phases via three
// chained CSS animations (load → fire → discard-fly) with two
// `forwards`-filled gaps (hold on Brackle, impact at target) between
// them, so the Creature visibly LIFTS off its slot → LANDS on
// Brackle → HOLDS there for a beat → CATAPULTS to the target →
// IMPACTS while an explosion plays → FLIES from target to the
// discard pile. The source slot is hidden client-side for the entire
// window so the original render doesn't show through the flying
// overlay — and the client-side diff-detector that would otherwise
// animate the destroy's discard-flight from the source slot is
// pre-suppressed so it doesn't double-up.
const LOAD_MS    = 1100;        // Creature slot → Brackle (slow, weighty).
const HOLD_MS    =  400;        // Creature visibly parked on Brackle.
const FIRE_MS    =  300;        // Brackle → target (snappy release).
const IMPACT_MS  =  300;        // Creature parked at target while the
                                // explosion plays — sells the hit
                                // before the body flies to discard.
const DISCARD_MS =  500;        // Target → discard pile.

// Damage lands ~70% through the fire phase — early enough that the
// impact reads as "the catapulted Creature hit the target" before
// the fire keyframes resolve.
const DAMAGE_LAND_MS = LOAD_MS + HOLD_MS + Math.round(FIRE_MS * 0.7);
// Destroy lands at the end of the IMPACT phase — the Creature has
// finished its hit visual and is about to fly to discard. By doing
// the engine-side destroy here we make the client's pre-suppressed
// diff-detector see the discard-pile entry exactly when the visual
// flight begins (no early pop, no late ghost).
const DESTROY_AT_MS  = LOAD_MS + HOLD_MS + FIRE_MS + IMPACT_MS;
// The full animation runtime — server holds the resolve open until
// the discard-fly keyframes complete so the calling stack doesn't
// race ahead of the visual.
const ANIM_TOTAL_MS  = DESTROY_AT_MS + DISCARD_MS;

/** Sacrifice candidates: engine pool intersected with the per-turn
 *  summoning-sickness filter. Pure read, side-effect-free. */
function _eligibleSacrificeCandidates(engine, pi) {
  const turn = engine.gs.turn || 0;
  return engine.getSacrificableCreatures(pi).filter(c =>
    c.inst.turnPlayed !== turn,
  );
}

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,
  // Rein schaedlich: eigene Kreatur opfern, um Schaden auszuteilen. Unter
  // dem Spielstart-Schutz nicht nutzbar (Als Ruling 8.8.) — sonst waere
  // das Opfer bezahlt und der Schaden verpufft.
  heroEffectHarmfulOnly: true,

  /**
   * Pre-gate. Engine's standard checks (Hero alive / not frozen /
   * not stunned / HOPT clear) run first; we layer the card-specific
   * "at least one Creature is sacrificable this turn" check on top.
   */
  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    if (engine.gs.players[pi] == null) return false;
    return _eligibleSacrificeCandidates(engine, pi).length > 0;
  },

  /**
   * Per-card CPU brain — only for the SACRIFICE prompt. The damage
   * target picker uses `promptDamageTarget`, which routes through the
   * standard MCTS-driven `_getCpuTargetResponse` (already capable of
   * picking the best damage target). This hook handles the OTHER
   * prompt: which Creature to load into the catapult.
   *
   * Heuristic — pick the highest currentHp Creature among the
   * candidates, capped at MAX_DAMAGE. Extra HP beyond 350 is wasted
   * (capped damage), so a 500-HP and a 350-HP sacrifice score
   * identically. Falls back to the generic brain (returns undefined)
   * if the payload shape isn't recognisable.
   */
  cpuResponse(engine, kind, payload) {
    if (kind !== 'target') return undefined;
    const { validTargets } = payload || {};
    if (!Array.isArray(validTargets) || validTargets.length === 0) return undefined;
    // Sacrifice prompt: all valid targets are own-side equips with a
    // cardInstance. The damage-target prompt won't reach here — it
    // doesn't pass `title: CARD_NAME` so the `_getCpuTargetResponse`
    // lookup doesn't route to this hook.
    const own = validTargets.filter(t => t.type === 'equip' && t.cardInstance);
    if (own.length === 0) return undefined;
    const sorted = own.slice().sort((a, b) => {
      const aHp = Math.min(a.cardInstance.counters?.currentHp || 0, MAX_DAMAGE);
      const bHp = Math.min(b.cardInstance.counters?.currentHp || 0, MAX_DAMAGE);
      return bHp - aHp;
    });
    return [sorted[0].id];
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    const brackleHeroIdx = ctx.cardHeroIdx;
    if (!ps) return false;

    // ── Pick loop ────────────────────────────────────────────────────────
    // Sacrifice + target picks live in a `while` loop so the target
    // prompt's "Back" button (cancel) returns to the sacrifice prompt
    // instead of aborting the whole Hero effect. Cancelling the
    // sacrifice prompt ends the effect entirely (HOPT refunded).
    let creatureInst;
    let baseDamage;
    let target;
    while (true) {
      const candidates = _eligibleSacrificeCandidates(engine, pi);
      if (candidates.length === 0) return false;

      const sacTargets = candidates.map(c => ({
        id: `equip-${c.inst.owner}-${c.inst.heroIdx}-${c.inst.zoneSlot}`,
        type: 'equip',
        owner: c.inst.owner, heroIdx: c.inst.heroIdx, slotIdx: c.inst.zoneSlot,
        cardName: c.cardName, cardInstance: c.inst,
        _meta: { maxHp: c.maxHp, level: c.level },
      }));

      // Sacrifice picker — `autoConfirm: true` + `maxTotal: 1` commits
      // the click immediately, so there's no "Load!" confirm submenu
      // between selecting the Creature and the target picker. Click
      // the creature → straight into the target prompt.
      const sacPick = await engine.promptEffectTarget(pi, sacTargets, {
        title: CARD_NAME,
        description: 'Click one of your Creatures (not summoned this turn) to load into the catapult.',
        confirmLabel: '🐢 Load!',     // Unreached with autoConfirm, kept for clarity in headers.
        confirmClass: 'btn-warning',
        cancellable: true,
        exclusiveTypes: true,
        maxPerType: { equip: 1 },
        maxTotal: 1,
        minRequired: 1,
        autoConfirm: true,
        redSelect: true,
      });
      // Sacrifice prompt cancelled → end the effect, refund HOPT.
      if (!sacPick || sacPick.length === 0) return false;

      const sacSel = sacTargets.find(t => t.id === sacPick[0]);
      if (!sacSel?.cardInstance) return false;
      creatureInst = sacSel.cardInstance;

      // Defensive re-validate — eligibility filter ran at pick-time; an
      // interleaved effect could have moved / destroyed / sickness-flipped
      // the Creature between picker render and pick.
      if ((creatureInst.controller ?? creatureInst.owner) !== pi) continue;
      if (creatureInst.zone !== 'support') continue;
      if (creatureInst.turnPlayed === gs.turn) continue;
      if (creatureInst.faceDown) continue;

      // Snapshot the damage amount NOW so subsequent damage application
      // doesn't read a stale value (defensive — nothing should mutate
      // currentHp between here and the actionDealDamage call, but the
      // snapshot is the contract value per the card text).
      baseDamage = Math.min(creatureInst.counters?.currentHp || 0, MAX_DAMAGE);

      // ── Target picker — Cancel reads as "Back" (return to sac picker) ──
      target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'attack',
        baseDamage,
        title: CARD_NAME,
        description: `Choose a target to deal ${baseDamage} damage to (treated as an Attack).`,
        confirmLabel: `💥 Catapult! (${baseDamage})`,
        confirmClass: 'btn-danger',
        cancellable: true,
        // Override the default "Cancel" label — cancelling here goes
        // BACK to the sacrifice picker, doesn't abort the effect.
        cancelLabel: '↩ Back',
      });
      if (target) break;     // Have both a sacrifice AND a target — proceed.
      // Target prompt cancelled → loop back to sacrifice picker.
    }

    // ── Step 3: catapult animation (load → hold → fire) ─────────────────
    // Single broadcast event — the client owns the full multi-phase
    // visual via two chained CSS animations. The source slot is
    // hidden for the entire window via a dedicated `bracklSourceHidden`
    // set (separate from `isSupportRamming` so the two never collide).
    // `targetZoneSlot` is included for support-zone targets so the
    // fire phase lands on the Creature, not the column's Hero zone.
    const catapultEvent = {
      sourceOwner: pi,
      sourceHeroIdx: creatureInst.heroIdx,
      sourceZoneSlot: creatureInst.zoneSlot,
      brackleOwner: pi,
      brackleHeroIdx,
      targetOwner: target.owner,
      targetHeroIdx: target.heroIdx >= 0 ? target.heroIdx : 0,
      targetType: target.type,
      // Where the corpse ends up. Creatures route to their original
      // owner's discard pile per the engine's standard
      // discard-routing rule — see `_engine.js` ~L20020.
      discardOwner: creatureInst.originalOwner ?? creatureInst.owner,
      cardName: creatureInst.name,
      loadMs:    LOAD_MS,
      holdMs:    HOLD_MS,
      fireMs:    FIRE_MS,
      impactMs:  IMPACT_MS,
      discardMs: DISCARD_MS,
    };
    if (target.type === 'creature' || target.type === 'equip') {
      catapultEvent.targetZoneSlot = target.slotIdx;
    }
    engine._broadcastEvent('play_brackle_catapult', catapultEvent);
    await engine._delay(DAMAGE_LAND_MS);

    // ── Step 5: deal damage as an Attack ─────────────────────────────────
    const source = { name: CARD_NAME, owner: pi, heroIdx: brackleHeroIdx };
    if (target.type === 'hero') {
      const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (hero && hero.hp > 0) {
        await engine.actionDealDamage(source, hero, baseDamage, 'attack');
      }
    } else if ((target.type === 'creature' || target.type === 'equip') && target.cardInstance) {
      await engine.actionDealCreatureDamage(
        source, target.cardInstance, baseDamage, 'attack',
        { sourceOwner: pi, canBeNegated: true },
      );
    }

    // Wait for the IMPACT phase to finish before running the
    // sacrifice — the explosion at the target plays during this
    // window, and we want the destroy to land at the moment the
    // catapulted Creature is about to fly off to the discard pile.
    // The client's pre-suppressed diff-detector will see the new
    // discard entry and skip its own animation, leaving our
    // brackle_catapult overlay's third-phase (target → discard) as
    // the sole visual flight.
    await engine._delay(DESTROY_AT_MS - DAMAGE_LAND_MS);

    // ── Step 6: sacrifice the Creature ───────────────────────────────────
    // Fire ON_CREATURE_SACRIFICED with the live inst BEFORE the destroy
    // so listeners (Loyal Shepherd-style chain triggers, future
    // sacrifice-counters) see the right zone + counters. destroyCard
    // then fires ON_CREATURE_DEATH downstream — sacrificing is a
    // sub-type of dying.
    await engine.runHooks('onCreatureSacrificed', {
      creature: creatureInst,
      cardName: creatureInst.name,
      owner: creatureInst.owner,
      heroIdx: creatureInst.heroIdx,
      zoneSlot: creatureInst.zoneSlot,
      source,
      _skipReactionCheck: true,
    });
    // `skipPileTransfer: true` — the catapult animation owns the
    // corpse's flight from target → discard via the `play_brackle_
    // catapult` overlay's third phase. Letting actionDestroyCard's
    // auto-emit fire would overlay a SECOND slot-anchored flight
    // on top of the catapult arc and double-animate. The card's
    // dedicated `brackleDiscardSuppressRef` suppression in the
    // frontend already covers the diff-detector flight.
    await engine.actionDestroyCard(source, creatureInst, { fireCreatureDeath: true, skipPileTransfer: true });

    engine.log('brackle_catapult', {
      player: ps.username,
      hero: CARD_NAME,
      sacrificed: creatureInst.name,
      damage: baseDamage,
      target: target.cardName,
    });

    engine.sync();

    // Hold the resolve open until the discard-fly keyframes finish —
    // otherwise the engine starts processing the next thing (next
    // hero effect, phase advance, etc.) before the catapult overlay
    // has visibly landed in the discard pile.
    await engine._delay(ANIM_TOTAL_MS - DESTROY_AT_MS);
    return true;
  },
};
