// ═══════════════════════════════════════════
//  CARD EFFECT: "Mischief Militia - SnowItAll"
//  Creature — Summoning Magic Lv1, 50 HP
//
//  • Cannot be Frozen — stamps `counters.freeze_immune`
//    on `onPlay`. Engine's `canApplyCreatureStatus`
//    short-circuits any freeze attempt automatically.
//
//  • HOPT — once per turn (engine-default soft per-
//    instance), you may summon a level 1 or lower
//    Creature from your hand as an additional
//    Action, then Freeze it for 2 turns. The
//    picker filters OUT freeze-immune Creatures:
//    Cardinal Beasts (omni-immune) and anything
//    flagged `selfFreezeImmune: true` on its
//    script (currently just SnowItAll itself).
//    Being able to land the Freeze is a hard
//    requirement to summon.
//
//  • Haste — may activate the effect the turn
//    SnowItAll was summoned IFF a Frozen target
//    already exists on the board. We set
//    `inst.counters._hasHaste = true` so the
//    engine's summoning-sickness gate clears, and
//    enforce the Frozen-target requirement inside
//    `canActivateCreatureEffect`. `turnPlayed`
//    stays accurate, so Alice / Hive's Crown /
//    Bomblebee tribute filters still see this
//    Creature as fresh on its summon turn.
// ═══════════════════════════════════════════

const { hasCardType, isOwnSideSummonableCreature } = require('./_hooks');
const { loadCardEffect } = require('./_loader');
const { CARDINAL_NAMES } = require('./_cardinal-shared');
const { countFrozenTargets } = require('./_mischief-militia-shared');

const CARD_NAME = 'Mischief Militia - SnowItAll';
const FREEZE_DURATION = 2;

/**
 * Would the card with this name, if summoned as a fresh instance, be
 * Frozen-able? Filters out:
 *   • Cardinal Beasts (omni-immune at all times)
 *   • Creatures whose script stamps freeze_immune in their onPlay
 *     (opt-in via `selfFreezeImmune: true`)
 *   • SnowItAll itself (carries its own freeze_immune)
 */
function _isFreezableOnSummon(cardName) {
  if (!cardName) return false;
  if (cardName === CARD_NAME) return false;
  if (CARDINAL_NAMES.includes(cardName)) return false;
  const script = loadCardEffect(cardName);
  if (script?.selfFreezeImmune === true) return false;
  return true;
}

/**
 * Hand indices that are eligible to be summoned by SnowItAll:
 * Creatures, level ≤ 1, freeze-landable on entry. Returned as raw
 * indices so the `pickHandCard` picker can highlight the exact
 * physical copies (matches Saint Nicolas's pattern — see
 * cards/effects/saint-nicolas.js).
 */
function _getSummonableHandIndices(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps?.hand) return [];
  const cardDB = engine._getCardDB();
  const out = [];
  for (let i = 0; i < ps.hand.length; i++) {
    const cn = ps.hand[i];
    const cd = cardDB[cn];
    if (!cd) continue;
    if (!isOwnSideSummonableCreature(cd, cn)) continue;
    // Effective level via the canonical helper — passes the specific
    // hand index so Rocky-Slime-style per-slot offsets count toward
    // the Lv≤1 gate.
    const lvl = engine.effectiveCardLevel(cd, pi, { handIdx: i });
    if (lvl > 1) continue;
    if (!_isFreezableOnSummon(cn)) continue;
    out.push(i);
  }
  return out;
}

function _findFreeOwnSupportSlots(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const slots = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    const zones = ps.supportZones?.[hi] || [];
    for (let zi = 0; zi < 3; zi++) {
      if ((zones[zi] || []).length === 0) {
        slots.push({ heroIdx: hi, slotIdx: zi, label: `${hero.name} — Slot ${zi + 1}` });
      }
    }
  }
  return slots;
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js.
  activeIn: ['support'],
  creatureEffect: true,
  // Opt-in marker the SnowItAll picker (and any future "freeze-as-cost"
  // card) consults to filter out Creatures that stamp freeze_immune in
  // onPlay. SnowItAll is its own first consumer.
  selfFreezeImmune: true,

  cpuMeta: {
    onDeathBenefit: 0,
  },

  hooks: {
    onPlay: async (ctx) => {
      const inst = ctx.card;
      if (!inst || ctx.playedCard?.id !== inst.id) return;
      if (inst.zone !== 'support') return;
      // Permanent freeze immunity.
      inst.counters.freeze_immune = 1;
      // Always-on haste flag. The Frozen-target check inside
      // `canActivateCreatureEffect` enforces the actual summon-turn
      // gate; the engine just needs the flag set for its sickness
      // shortcut to clear.
      inst.counters._hasHaste = true;
    },
  },

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;

    // Must have at least one Lv≤1 freezable Creature in hand.
    if (_getSummonableHandIndices(engine, pi).length === 0) return false;
    // Must have at least one free own Support Zone to land into.
    if (_findFreeOwnSupportSlots(engine, pi).length === 0) return false;

    // Summon-turn gate: a Frozen target must already exist for the
    // haste to apply. Off-summon-turn, the standard sickness gate
    // already cleared and this branch is skipped.
    const inst = ctx.card;
    const isSummonTurn = inst.turnPlayed === engine.gs.turn;
    if (isSummonTurn && countFrozenTargets(engine) < 1) return false;

    return true;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    if (!ps?.hand) return false;

    // Two-step picker loop. The Creature pick and the Support-Zone
    // pick are reversible: cancelling the zone-picker returns the
    // player to the hand picker so they can re-choose a Creature (or
    // cancel out entirely). The effect is only OFFICIALLY committed
    // when the zone is confirmed — the engine's
    // `doActivateCreatureEffect` path defers HOPT stamping until
    // `onCreatureEffect` returns non-false, and we defer the card-
    // reveal stream ourselves (see below) so a top-level cancel
    // costs the player nothing (no reveal to opp, no HOPT burned).
    //
    // Defer the card-reveal stream: `doActivateCreatureEffect`
    // stashes `gs._pendingCardReveal` upfront so it fires on the
    // FIRST prompt-response (resolveGenericPrompt). Without this
    // save+restore, opp would see SnowItAll's activation banner the
    // moment the player picks a hand card — i.e. before they've
    // committed. Hold the stash off-side and only put it back when
    // the player confirms a destination zone.
    const savedReveal = engine.gs._pendingCardReveal;
    delete engine.gs._pendingCardReveal;
    const savedPlayLog = engine.gs._pendingPlayLog;
    delete engine.gs._pendingPlayLog;

    let chosenName = null;
    let dest = null;
    while (!dest) {
      // ── Step 1: pick the Creature to summon ──
      // In-hand picker (no gallery popup): the hand stays visible and
      // eligible Creatures get the picker's highlight outline.
      // Pattern mirrors Saint Nicolas / Freshya — see
      // cards/effects/saint-nicolas.js and freshya-beauty-of-coolness.js.
      const eligibleIndices = _getSummonableHandIndices(engine, pi);
      if (eligibleIndices.length === 0) return false;
      let chosenIdx;
      if (eligibleIndices.length === 1) {
        chosenIdx = eligibleIndices[0];
        chosenName = ps.hand[chosenIdx];
      } else {
        const picked = await engine.promptGeneric(pi, {
          type: 'pickHandCard',
          title: CARD_NAME,
          description: 'Click a Level ≤ 1 Creature in your hand to summon. SnowItAll will Freeze it for 2 turns.',
          eligibleIndices,
          confirmLabel: '❄️ Summon!',
          cancellable: true,
        });
        if (!picked || picked.cancelled || picked.handIndex == null) return false;
        chosenIdx = picked.handIndex;
        chosenName = ps.hand[chosenIdx];
      }
      if (!chosenName) return false;

      // ── Step 2: pick destination slot ──
      // Cancellable: a cancel here loops back to the Creature picker
      // so the player can re-choose. With exactly 1 free slot AND
      // exactly 1 eligible Creature, both steps auto-pick — no way
      // to cancel back, which matches the "single legal choice"
      // expectation.
      const freeSlots = _findFreeOwnSupportSlots(engine, pi);
      if (freeSlots.length === 0) return false;
      if (freeSlots.length === 1) {
        dest = freeSlots[0];
        break;
      }
      // The zonePick UI renders a "← Back" button and honours Escape
      // when `cancellable: true` — both paths return
      // `{ cancelled: true }`, which loops back to the Creature pick.
      const pick = await ctx.promptZonePick(freeSlots, {
        title: CARD_NAME,
        description: `Place ${chosenName} into a free Support Zone. Cancel to pick a different Creature.`,
        cancellable: true,
      });
      if (!pick || pick.cancelled) {
        // Back-button / Escape: clear the chosen Creature and loop
        // back to the hand picker. If only 1 eligible Creature was
        // in hand, the next iteration will auto-pick it again — that's
        // fine, the player still gets the zone picker re-opened.
        chosenName = null;
        continue;
      }
      dest = freeSlots.find(z => z.heroIdx === pick.heroIdx && z.slotIdx === pick.slotIdx) || null;
      if (!dest) {
        chosenName = null;
        continue;
      }
    }

    // ── Step 3: splice from hand + summon with full hooks ──
    // Zone confirmed → the effect is now officially committing.
    // Restore the engine's pending card reveal + play log and fire
    // them so opp sees SnowItAll's activation banner exactly at the
    // moment of commitment (not at hand-pick time). HOPT stamping
    // is handled by the engine on our non-false return.
    if (savedReveal) engine.gs._pendingCardReveal = savedReveal;
    if (savedPlayLog) engine.gs._pendingPlayLog = savedPlayLog;
    engine._firePendingCardReveal();

    const handIdx = ps.hand.indexOf(chosenName);
    if (handIdx < 0) return false;
    ps.hand.splice(handIdx, 1);

    const summonResult = await engine.summonCreatureWithHooks(
      chosenName, pi, dest.heroIdx, dest.slotIdx,
      { source: CARD_NAME },
    );
    if (!summonResult?.inst) {
      // Race / cancelled by a beforeSummon cost — refund the hand card.
      ps.hand.splice(handIdx, 0, chosenName);
      return false;
    }

    // ── Step 4: Freeze the freshly-summoned Creature for 2 turns ──
    await engine.applyCreatureStatus(summonResult.inst, 'frozen', {
      duration: FREEZE_DURATION,
      sourceOwner: pi,
      source: CARD_NAME,
      animationType: 'ice_encase',
    });

    engine.log('snowitall_summon', {
      player: ps.username, summoned: chosenName,
      heroIdx: dest.heroIdx, slotIdx: dest.slotIdx,
    });
    engine.sync();
    return true;
  },
};
