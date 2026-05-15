// ═══════════════════════════════════════════
//  CARD EFFECT: "Lunatic Hawk"
//  Creature (Lv3, 100 HP, Summoning Magic, Lunatic)
//
//  Tiered on the number of DIFFERENT "Lunatic
//  Cycle" cards on the board (either side):
//   • 1+  While you control no Creatures,
//         summoning THIS counts as an additional
//         Action (conditional `inherentAction`).
//   • 2+  Whenever you equip an Artifact to a
//         Hero, its controller draws 1 card.
//   • 3+  The current and max HP of all Creatures
//         you summon are doubled.
//   • 4+  Activated, once/turn, FREE: summon a
//         "Lunatic" Creature from your hand as an
//         additional Action.
//   • 5   You may perform a second Action during
//         the Action Phase of each of your turns.
//
//  All tiers read the count live at trigger time.
//  Tier 5 re-grants the second Action at the start
//  of each of the controller's turns while ≥5
//  (the engine's _second-action-shared lifecycle
//  hooks handle fizzle / cleanup).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const {
  countDistinctLunaticCycle,
  isLunaticCreature,
} = require('./_lunatic-shared');
const { secondActionGrant, secondActionHooks } = require('./_second-action-shared');

const CARD_NAME = 'Lunatic Hawk';

/** Does player `pi` control NO Creatures (support-zone Creature insts)? */
function controlsNoCreatures(engine, pi) {
  const cardDB = engine._getCardDB();
  for (const c of (engine.cardInstances || [])) {
    if (!c || c.zone !== 'support') continue;
    if ((c.controller ?? c.owner) !== pi) continue;
    if (c.faceDown) continue;
    const cd = engine.getEffectiveCardData?.(c) || cardDB[c.name];
    if (cd && hasCardType(cd, 'Creature')) return false;
  }
  return true;
}

/** Lunatic Creature names currently in `pi`'s hand. */
function handLunaticCreatures(engine, pi) {
  const cardDB = engine._getCardDB();
  const ps = engine.gs.players[pi];
  const out = [];
  const seen = new Set();
  for (const n of (ps?.hand || [])) {
    if (seen.has(n)) continue;
    if (isLunaticCreature(cardDB[n])) { seen.add(n); out.push(n); }
  }
  return out;
}

/** First free Support Zone across the player's living Heroes, honoring
 *  the Creature's own summon gate. Returns [{heroIdx,slotIdx}, …]. */
function freeZonesFor(engine, pi, creatureName) {
  const ps = engine.gs.players[pi];
  const out = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    if (!engine.isCreatureSummonable(creatureName, pi, hi, { _bypassBeforeSummon: true })) continue;
    for (let zi = 0; zi < 3; zi++) {
      if (((ps.supportZones[hi] || [])[zi] || []).length === 0) out.push({ heroIdx: hi, slotIdx: zi });
    }
  }
  return out;
}

module.exports = {
  activeIn: ['support'],
  creatureEffect: true, // tier 4+ activated (free; engine HOPT = once/turn)

  // ── Tier 1+: conditional inherent (additional) Action ──
  // Engine evaluates this with (gs, playerIdx, heroIdx, engine[, opts]).
  inherentAction(gs, playerIdx, heroIdx, engine) {
    if (!engine) return false;
    return countDistinctLunaticCycle(engine) >= 1 && controlsNoCreatures(engine, playerIdx);
  },

  // ── Tier 4+ activated: summon a Lunatic Creature from hand ──
  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const inst = ctx.card;
    if (!inst || inst.zone !== 'support') return false;
    if (countDistinctLunaticCycle(engine) < 4) return false;
    const pi = ctx.cardOriginalOwner;
    const candidates = handLunaticCreatures(engine, pi);
    if (candidates.length === 0) return false;
    return candidates.some(n => freeZonesFor(engine, pi, n).length > 0);
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOriginalOwner;
    const ps = gs.players[pi];
    const inst = ctx.card;
    if (!ps || !inst) return false;
    if (countDistinctLunaticCycle(engine) < 4) return false;

    // Must still have a Lunatic Creature in hand that could legally be
    // summoned somewhere (same gate as canActivateCreatureEffect).
    const candidates = handLunaticCreatures(engine, pi)
      .filter(n => freeZonesFor(engine, pi, n).length > 0);
    if (candidates.length === 0) return false;

    // Grant a ONE-SHOT additional Action that may ONLY be spent
    // summoning a "Lunatic" Creature from hand. The player then plays
    // it through the NORMAL summon UX (eligible hand Creatures light
    // up, click or drag onto a Hero) — `doPlayCreature` enforces every
    // summon restriction (Summoning Magic level, dead/Frozen/Stunned
    // Heroes can't summon, Negated can't summon Lv>0, per-Hero
    // canSummon gates, …) AND runs onPlay / onCardEnterZone, exactly
    // like an Action-Phase summon. NOT an `isSecondActionGrant`, so
    // it's usable immediately (not gated to the Action-Phase 2nd-action
    // slot) and by ANY Hero (`heroRestricted: false`).
    const typeId = `lunatic_hawk_summon:${inst.id}`;
    engine.registerAdditionalActionType(typeId, {
      label: CARD_NAME,
      allowedCategories: ['creature'],
      heroRestricted: false,
      sourceLabel: CARD_NAME,
      filter: (cd) => isLunaticCreature(cd),
    });
    engine.grantAdditionalAction(inst, typeId);
    engine.log('lunatic_hawk_summon_granted', { player: ps.username });
    engine.sync();
    return true;
  },

  hooks: {
    // _second-action-shared lifecycle (fizzle / phase / cleanup / leave).
    ...secondActionHooks,

    // ── Tier 5: persistent second Action each of the controller's turns ──
    onTurnStart: async (ctx) => {
      const engine = ctx._engine;
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support') return;
      if (ctx.activePlayer !== ctx.cardOwner) return;            // our turn
      if (countDistinctLunaticCycle(engine) < 5) return;          // tier 5
      // No double-grant guard needed — `secondActionGrant` is
      // idempotent (no-ops if THIS inst's second-action grant is
      // already live) and ADDITIVE (a co-resident tier-4 grant on the
      // same Hawk inst is preserved, not clobbered).
      await secondActionGrant(ctx, {
        sourceLabel: CARD_NAME,
        animationType: 'soul_shard_dark_grant',
        // "perform a second Action" — ANY Hero may cash it in, not
        // just Hawk's host Hero (unlike Soul Shard Ba's hero-locked
        // grant). The engine's findAdditionalActionForCard drops the
        // per-Hero match when heroRestricted is false.
        heroRestricted: false,
      });
    },

    // ── Tier 4 cleanup: an UNUSED Lunatic-summon grant must not carry
    //    into a later turn (it's "once/turn", tied to that activation).
    //    Expire ONLY the tier-4 typeId so a co-resident tier-5
    //    second-action grant on the same Hawk inst is left intact.
    onTurnEnd: async (ctx) => {
      const engine = ctx._engine;
      const inst = ctx.card;
      if (!inst) return;
      if (ctx.activePlayer !== ctx.cardOwner) return; // our turn ending
      const t4 = `lunatic_hawk_summon:${inst.id}`;
      if (inst.counters?.aaGrants?.[t4] > 0) {
        engine.expireAdditionalActionType(inst, t4);
        engine.sync();
      }
    },

    onCardEnterZone: async (ctx) => {
      const engine = ctx._engine;
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support') return;
      if (ctx.toZone !== 'support') return;
      const entering = ctx.enteringCard;
      if (!entering || entering.id === inst.id) return; // ignore our own entry
      const n = countDistinctLunaticCycle(engine);
      const pi = ctx.cardOwner;
      const cardDB = engine._getCardDB();
      const cd = cardDB[entering.name];
      if (!cd) return;

      // ── Tier 2+: an Artifact equipped to a Hero → its controller
      //    (= you, the equipper) draws 1. Only when YOU equip. ──
      if (n >= 2
        && cd.cardType === 'Artifact'
        && (cd.subtype || '').toLowerCase() === 'equipment'
        && entering.owner === pi
        && !ctx._isMove) {
        await engine.actionDrawCards(pi, 1);
        engine.log('lunatic_hawk_equip_draw', {
          player: engine.gs.players[pi]?.username, artifact: entering.name,
        });
        engine.sync();
        return;
      }

      // ── Tier 3+: double current & max HP of Creatures YOU summon ──
      if (n >= 3
        && hasCardType(cd, 'Creature')
        && entering.owner === pi
        && !ctx._isMove) {
        const curMax = entering.counters?.maxHp ?? (cd.hp || 0);
        if (curMax > 0) {
          engine.increaseMaxHp(entering, curMax); // +maxHp == double
          engine._broadcastEvent('play_zone_animation', {
            type: 'green_pulse', owner: entering.owner,
            heroIdx: entering.heroIdx, zoneSlot: entering.zoneSlot,
          });
          engine.log('lunatic_hawk_double_hp', {
            player: engine.gs.players[pi]?.username, creature: entering.name, to: curMax * 2,
          });
          engine.sync();
        }
      }
    },
  },
};
