// ═══════════════════════════════════════════
//  CARD EFFECT: "Lizbeth, the Reaper of the Light"
//  Hero (500 HP, 100 ATK — Resistance + Support
//  Magic starting abilities)
//
//  Phases 1-3 of the Lizbeth / Smugbeth feature.
//  During her owner's turn, while alive and not
//  Frozen / Stunned / Negated / Bound, she:
//
//    • PASSIVE (`heroMeetsLevelReq`): opponent
//      ability zones (excluding Toughness) count
//      toward her own spell-school / level
//      requirements and Wisdom discard cost.
//
//    • ACTIVE: opponent ability slots become
//      activatable, sharing HOPT with her own
//      copies of the same ability.
//
//    • PASSIVE MIRROR (auto): opponent ability
//      hooks auto-fire a second time with
//      cardOwner / cardHeroIdx redirected to
//      Lizbeth. Wealth, Mana Mining, Divinity,
//      Wisdom benefit Lizbeth via this path or
//      via Phase 1's effective zone merging.
//
//  Bespoke per-ability handlers (auto-mirror is
//  unsuitable because each script re-walks the
//  borrower's `ps.abilityZones[heroIdx]` for a
//  level lookup that resolves to 0 on Lizbeth's
//  side):
//
//    • FIGHTING (override): max opponent
//      Fighting bonus replaces Lizbeth's own if
//      greater. Recomputed each turn boundary.
//
//    • SMUGNESS: when Lizbeth takes opponent
//      damage on her own turn, retaliate at
//      scaled damage based on opponent's highest
//      Smugness level.
//
//    • RESISTANCE: blocks first N status / non-
//      damage effects targeting Lizbeth, where
//      N = opponent's highest Resistance level
//      (Lv3 = unlimited). Reset on Lizbeth's
//      turn start.
//
//    • CREATIVITY: when an Ability enters
//      Lizbeth's zone, draw cards equal to
//      opponent's highest Creativity level. Soft
//      HOPT per turn.
//
//    • FRIENDSHIP: grants one borrowed Support
//      Magic additional Action per turn (uses
//      Friendship's Lv1 restriction / Lv2-3 draw
//      semantics, but anchored on Lizbeth's
//      hero card as the provider).
//
//    • BIOMANCY: when Lizbeth's owner uses a
//      Potion, optionally convert it to a
//      Biomancy Token on Lizbeth's side, scaled
//      by opponent's highest Biomancy level.
//      Soft HOPT per turn.
//
//  All bespoke handlers gate on the same rule:
//  Lizbeth alive + capable + on her owner's
//  turn. Reactive triggers (Smugness, Resistance)
//  also gate on activePlayer being Lizbeth's
//  owner — borrowing only "exists" during her
//  turn per spec.
// ═══════════════════════════════════════════

const CARD_NAME = 'Lizbeth, the Reaper of the Light';
const FIGHTING_DELTA_KEY = 'lizbethBorrowedFightingDelta';
const RESISTANCE_BLOCKS_KEY = 'lizbethBorrowedResistanceBlocks';
const CREATIVITY_HOPT_KEY = '_lizbethCreativityDrew';
const BIOMANCY_HOPT_KEY = '_lizbethBiomancyToken';
const FRIENDSHIP_DRAW_HOPT_KEY = '_lizbethFriendshipDrew';
const FRIENDSHIP_TYPE_ID = 'lizbeth_borrowed_friendship';

/** Common "Lizbeth can borrow" gate: alive, not incapacitated, on
 *  her owner's turn. Used by every bespoke handler so the borrow
 *  flips on/off cleanly each turn boundary. */
function lizbethActiveBorrower(ctx) {
  const engine = ctx._engine;
  const hero = ctx.attachedHero;
  if (!hero?.name || hero.hp <= 0) return false;
  const s = hero.statuses || {};
  if (s.frozen || s.stunned || s.negated || s.bound) return false;
  if ((engine.gs.activePlayer ?? -1) !== ctx.cardOwner) return false;
  return true;
}

/** Highest stack length of `abilityName` across opponent's heroes
 *  (capable hosts only — dead / frozen / stunned / negated opponents
 *  contribute nothing). */
function maxOpponentAbilityLevel(engine, pi, abilityName) {
  const oi = pi === 0 ? 1 : 0;
  const ops = engine.gs.players[oi];
  if (!ops) return 0;
  let max = 0;
  for (let hi = 0; hi < (ops.heroes || []).length; hi++) {
    const hero = ops.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) continue;
    const abZones = ops.abilityZones?.[hi] || [];
    for (const slot of abZones) {
      if (!slot || slot.length === 0) continue;
      if (slot[0] === abilityName && slot.length > max) max = slot.length;
    }
  }
  return max;
}

// ────────────────────────────────────────────────────
//  FIGHTING (Phase 2 — override)
// ────────────────────────────────────────────────────

function fightingTotalForHero(engine, pi, heroIdx) {
  const hero = engine.gs.players[pi]?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return 0;
  let total = 0;
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'ability') continue;
    if (inst.name !== 'Fighting') continue;
    if ((inst.controller ?? inst.owner) !== pi) continue;
    if (inst.heroIdx !== heroIdx) continue;
    total += inst.counters?.atkGranted || 0;
  }
  return total;
}

function recomputeFighting(ctx) {
  const engine = ctx._engine;
  const pi = ctx.cardOwner;
  const heroIdx = ctx.cardHeroIdx;
  const hero = ctx.attachedHero;
  if (!hero?.name) return;

  const isMyTurn = (engine.gs.activePlayer ?? -1) === pi;
  const canAct = hero.hp > 0
    && !hero.statuses?.frozen
    && !hero.statuses?.stunned
    && !hero.statuses?.negated
    && !hero.statuses?.bound;

  let desiredDelta = 0;
  if (isMyTurn && canAct) {
    const ownTotal = fightingTotalForHero(engine, pi, heroIdx);
    const oi = pi === 0 ? 1 : 0;
    const ops = engine.gs.players[oi];
    let oppHighest = 0;
    for (let hi = 0; hi < (ops?.heroes || []).length; hi++) {
      const t = fightingTotalForHero(engine, oi, hi);
      if (t > oppHighest) oppHighest = t;
    }
    desiredDelta = Math.max(0, oppHighest - ownTotal);
  }

  const prevDelta = hero[FIGHTING_DELTA_KEY] || 0;
  if (desiredDelta === prevDelta) return;
  const diff = desiredDelta - prevDelta;
  hero.atk = (hero.atk || 0) + diff;
  hero[FIGHTING_DELTA_KEY] = desiredDelta;
  engine._broadcastEvent('fighting_atk_change', {
    owner: pi, heroIdx, amount: diff,
  });
  engine.log('lizbeth_fighting_borrow', {
    delta: desiredDelta, prev: prevDelta, atk: hero.atk,
  });
  engine.sync();
}

// ────────────────────────────────────────────────────
//  SMUGNESS — retaliate when Lizbeth takes damage
// ────────────────────────────────────────────────────

async function handleSmugnessMirror(ctx) {
  if (!lizbethActiveBorrower(ctx)) return;
  const engine = ctx._engine;
  const gs = engine.gs;
  const pi = ctx.cardOwner;
  const heroIdx = ctx.cardHeroIdx;
  const hero = ctx.attachedHero;

  // Damage event must target THIS Lizbeth.
  const target = ctx.target;
  if (!target || target.hp === undefined) return;
  if (target !== hero) return;

  // No status / DOT damage.
  if (['status', 'burn', 'poison'].includes(ctx.type)) return;

  // Must be from the opponent.
  const srcOwner = ctx.source?.controller ?? ctx.source?.owner ?? -1;
  if (srcOwner < 0 || srcOwner === pi) return;

  const amount = ctx.amount;
  if (!amount || amount <= 0) return;

  const level = maxOpponentAbilityLevel(engine, pi, 'Smugness');
  if (level <= 0) return;

  const retDamage = level === 1 ? Math.ceil(amount / 2)
                  : level === 2 ? amount
                  : amount * 2;
  if (retDamage <= 0) return;

  // Use Lizbeth's hero card instance as the prompt context. Reuse
  // ctx.promptDamageTarget — same UX as native Smugness.
  const picked = await ctx.promptDamageTarget({
    side: 'any',
    types: ['hero', 'creature'],
    damageType: 'other',
    baseDamage: retDamage,
    title: 'Smugness (Lizbeth)',
    description: `${hero.name} took ${amount} damage! Deal ${retDamage} to a target.`,
    confirmLabel: `🦝 Retaliate! (${retDamage})`,
    confirmClass: 'btn-danger',
    cancellable: true,
    noSpellCancel: true,
    _skipDamageLog: true,
  });
  if (!picked) return;

  const tgtZoneSlot = picked.type === 'equip' ? picked.slotIdx : -1;
  engine._broadcastEvent('play_projectile_animation', {
    sourceOwner: pi,
    sourceHeroIdx: heroIdx,
    targetOwner: picked.owner,
    targetHeroIdx: picked.heroIdx,
    targetZoneSlot: tgtZoneSlot,
    emoji: '🦝',
    emojiStyle: { fontSize: '72px', filter: 'drop-shadow(0 0 16px rgba(80,50,20,.9)) drop-shadow(0 0 32px rgba(139,90,43,.7))' },
    trailClass: 'projectile-raccoon-trail',
    duration: 600,
  });
  await engine._delay(500);
  engine._broadcastEvent('play_zone_animation', {
    type: 'explosion', owner: picked.owner,
    heroIdx: picked.heroIdx, zoneSlot: tgtZoneSlot,
  });
  await engine._delay(300);

  const dmgSource = { name: 'Smugness', owner: pi, heroIdx };
  if (picked.type === 'hero') {
    const h = gs.players[picked.owner]?.heroes?.[picked.heroIdx];
    if (h && h.hp > 0) await engine.actionDealDamage(dmgSource, h, retDamage, 'other');
  } else if (picked.cardInstance) {
    await engine.actionDealCreatureDamage(
      dmgSource, picked.cardInstance, retDamage, 'other',
      { sourceOwner: pi, canBeNegated: true },
    );
  }
  engine.log('lizbeth_smugness', {
    hero: hero.name, damageTaken: amount, retDamage, level,
  });
  engine.sync();
}

// ────────────────────────────────────────────────────
//  RESISTANCE — block effects targeting Lizbeth
// ────────────────────────────────────────────────────

function getResistanceBudget(ctx) {
  const level = maxOpponentAbilityLevel(ctx._engine, ctx.cardOwner, 'Resistance');
  if (level <= 0) return { level: 0, max: 0 };
  return { level, max: level >= 3 ? Infinity : level };
}

function tryResistanceBlock(ctx) {
  const hero = ctx.attachedHero;
  const { level, max } = getResistanceBudget(ctx);
  if (level <= 0) return false;
  const used = hero[RESISTANCE_BLOCKS_KEY] || 0;
  if (used >= max) return false;
  hero[RESISTANCE_BLOCKS_KEY] = used + 1;
  const engine = ctx._engine;
  engine._broadcastEvent('play_zone_animation', {
    type: 'gold_sparkle', owner: ctx.cardOwner, heroIdx: ctx.cardHeroIdx, zoneSlot: -1,
  });
  engine.log('lizbeth_resistance_block', {
    hero: hero.name, level, blocksUsed: used + 1,
  });
  engine.sync();
  return true;
}

// ────────────────────────────────────────────────────
//  CREATIVITY — draw on ability gain to Lizbeth's slot
// ────────────────────────────────────────────────────

async function handleCreativityMirror(ctx) {
  if (!lizbethActiveBorrower(ctx)) return;
  const engine = ctx._engine;
  const gs = engine.gs;
  const pi = ctx.cardOwner;
  const heroIdx = ctx.cardHeroIdx;

  // Only when an ability enters Lizbeth's own zone, owned by Lizbeth's
  // controller — same gate as native Creativity.
  if (ctx.toZone !== 'ability') return;
  if (ctx.toHeroIdx !== heroIdx) return;
  if (ctx.enteringCard?.owner !== pi) return;

  // Soft HOPT per turn.
  if (!gs.hoptUsed) gs.hoptUsed = {};
  const soptKey = `${CREATIVITY_HOPT_KEY}:${pi}:${heroIdx}`;
  if (gs.hoptUsed[soptKey] === gs.turn) return;

  const level = maxOpponentAbilityLevel(engine, pi, 'Creativity');
  if (level <= 0) return;

  gs.hoptUsed[soptKey] = gs.turn;
  engine.sync();
  await engine._delay(350);
  await engine.actionDrawCards(pi, level);
  engine.log('lizbeth_creativity_draw', { level });
}

// ────────────────────────────────────────────────────
//  FRIENDSHIP — borrowed Support Magic additional Action
// ────────────────────────────────────────────────────

function setupBorrowedFriendship(ctx) {
  const engine = ctx._engine;
  const gs = engine.gs;
  const pi = ctx.cardOwner;
  const heroIdx = ctx.cardHeroIdx;

  const level = maxOpponentAbilityLevel(engine, pi, 'Friendship');
  if (level <= 0 || !lizbethActiveBorrower(ctx)) {
    // Drop any previously-granted action if borrow no longer applies.
    const lizbethInst = engine.cardInstances.find(c =>
      c.zone === 'hero' && c.owner === pi && c.heroIdx === heroIdx && c.name === CARD_NAME);
    if (lizbethInst?.counters?.additionalActionType === FRIENDSHIP_TYPE_ID) {
      engine.expireAdditionalAction(lizbethInst);
    }
    return;
  }

  // (Re)register the type each turn so the closures capture fresh
  // engine state (level can shift mid-game).
  engine.registerAdditionalActionType(FRIENDSHIP_TYPE_ID, {
    label: 'Friendship (Lizbeth)',
    allowedCategories: ['spell'],
    heroRestricted: true,
    filter: (cardData) => {
      if (!cardData || cardData.cardType !== 'Spell' || cardData.spellSchool1 !== 'Support Magic') return false;
      const ps = engine.gs.players[pi];
      if (!ps) return false;
      const lvl = maxOpponentAbilityLevel(engine, pi, 'Friendship');
      // Lv1 restriction: no Support Spells used yet this turn.
      if (lvl <= 1 && (ps.supportSpellUsedThisTurn || ps.supportSpellLocked)) return false;
      if (ps.supportSpellLocked) return false;
      // Lizbeth-as-caster level check.
      if ((cardData.level || 0) > 0) {
        if (!engine.heroMeetsLevelReq(pi, heroIdx, cardData)) return false;
      }
      return true;
    },
  });

  const lizbethInst = engine.cardInstances.find(c =>
    c.zone === 'hero' && c.owner === pi && c.heroIdx === heroIdx && c.name === CARD_NAME);
  if (lizbethInst) {
    engine.grantAdditionalAction(lizbethInst, FRIENDSHIP_TYPE_ID);
  }
}

async function handleFriendshipDrawMirror(ctx) {
  if (!lizbethActiveBorrower(ctx)) return;
  const engine = ctx._engine;
  const gs = engine.gs;
  const pi = ctx.cardOwner;
  const heroIdx = ctx.cardHeroIdx;

  // Only fires when Lizbeth herself cast a Support Magic Spell.
  if (ctx.casterIdx !== pi || ctx.heroIdx !== heroIdx) return;
  const spellData = ctx.spellCardData;
  if (!spellData || spellData.spellSchool1 !== 'Support Magic') return;

  const level = maxOpponentAbilityLevel(engine, pi, 'Friendship');
  if (level < 2) return;

  if (!gs.hoptUsed) gs.hoptUsed = {};
  const hoptKey = `${FRIENDSHIP_DRAW_HOPT_KEY}:${pi}:${heroIdx}`;
  if (gs.hoptUsed[hoptKey] === gs.turn) return;
  gs.hoptUsed[hoptKey] = gs.turn;

  const draws = level >= 3 ? 3 : 1;
  await engine.actionDrawCards(pi, draws);
  engine.log('lizbeth_friendship_draw', { level, draws });
  engine.sync();
}

// ────────────────────────────────────────────────────
//  BIOMANCY — convert potion to token on Lizbeth's side
// ────────────────────────────────────────────────────

const BIOMANCY_LEVEL_STATS = { 1: 40, 2: 60, 3: 80 };

async function handleBiomancyMirror(ctx) {
  if (!lizbethActiveBorrower(ctx)) return;
  if (ctx.placed) return;
  const engine = ctx._engine;
  const gs = engine.gs;
  const pi = ctx.cardOwner;
  const heroIdx = ctx.cardHeroIdx;

  if (ctx.potionOwner !== pi) return;
  if (ctx._biomancyHandled) return; // native Biomancy already ran

  const ps = gs.players[pi];
  // Lizbeth herself must have a free Support slot.
  const supZones = ps.supportZones?.[heroIdx] || [[], [], []];
  if (![0, 1, 2].some(z => (supZones[z] || []).length === 0)) return;

  // Soft HOPT per turn.
  if (!gs.hoptUsed) gs.hoptUsed = {};
  const hoptKey = `${BIOMANCY_HOPT_KEY}:${pi}:${heroIdx}`;
  if (gs.hoptUsed[hoptKey] === gs.turn) return;

  const level = maxOpponentAbilityLevel(engine, pi, 'Biomancy');
  if (level <= 0) return;
  const stats = BIOMANCY_LEVEL_STATS[Math.min(level, 3)];

  const result = await engine.promptGeneric(pi, {
    type: 'confirm',
    title: `Biomancy Lv${level} (Lizbeth)`,
    description: `Convert the spent Potion into a Biomancy Token (${stats} HP, ${stats} damage) on ${ctx.attachedHero?.name || CARD_NAME}?`,
    confirmLabel: '🌿 Create Token!',
    confirmClass: 'btn-success',
    cancellable: true,
    gerrymanderEligible: true, // True "you may" — opt-in Biomancy Token creation.
  });
  if (!result || result.cancelled) return;

  gs.hoptUsed[hoptKey] = gs.turn;

  engine._broadcastEvent('card_reveal', { cardName: 'Biomancy' });
  await engine._delay(300);

  const potionName = ctx.potionName;
  const cardDB = engine._getCardDB();
  const potionData = cardDB[potionName];
  const placeResult = engine.safePlaceInSupport(potionName, pi, heroIdx, -1);
  if (!placeResult) return;
  const { inst, actualSlot } = placeResult;

  inst.counters._cardDataOverride = {
    ...(potionData || {}),
    cardType: 'Creature/Token',
    hp: stats,
    effect: `Once per turn: Deal ${stats} damage to any target on the board.`,
  };
  inst.counters._effectOverride = 'Biomancy Token';
  inst.counters.currentHp = stats;
  inst.counters.maxHp = stats;
  inst.counters.biomancyDamage = stats;
  inst.counters.biomancyLevel = level;

  engine._broadcastEvent('play_zone_animation', {
    type: 'biomancy_bloom',
    owner: pi, heroIdx, zoneSlot: actualSlot,
  });
  await engine._delay(600);
  engine.log('lizbeth_biomancy_token', {
    potion: potionName, level, hp: stats, damage: stats,
  });

  await engine.runHooks('onCardEnterZone', {
    enteringCard: inst, toZone: 'support', toHeroIdx: heroIdx,
    _skipReactionCheck: true,
  });

  ctx.setFlag('placed', true);
  engine.sync();
}

// ────────────────────────────────────────────────────
//  HOOK WIRING
// ────────────────────────────────────────────────────

module.exports = {
  activeIn: ['hero'],

  hooks: {
    onTurnStart: (ctx) => {
      // Reset Lizbeth's borrowed-Resistance block budget on her own
      // turn boundary (matches native Resistance's reset). Opponent's
      // turn start sets it to 0 too — borrow doesn't apply there
      // anyway and clearing keeps the counter clean.
      if (ctx.attachedHero) ctx.attachedHero[RESISTANCE_BLOCKS_KEY] = 0;

      // Recompute borrowed Fighting delta.
      recomputeFighting(ctx);

      // Refresh borrowed Friendship additional Action grant (or
      // expire it if borrow no longer applies — opponent's turn
      // start, status flip, etc.).
      setupBorrowedFriendship(ctx);
    },

    /**
     * When ANY hero dies, recompute borrowed bonuses. The most visible
     * case is opponent's highest-Fighting hero dying — Lizbeth's
     * borrowed ATK delta must drop. Other passive borrows that depend
     * on opponent state (Friendship grant, Resistance budget) are
     * also revalidated. The borrow-active gate inside each handler
     * means this is safe to fire on any hero death (own or opponent's).
     */
    onHeroKO: (ctx) => {
      recomputeFighting(ctx);
      setupBorrowedFriendship(ctx);
    },

    onCardEnterZone: (ctx) => {
      // Fighting recompute when any Fighting joins any ability zone.
      if (ctx.toZone === 'ability' && ctx.enteringCard?.name === 'Fighting') {
        recomputeFighting(ctx);
      }
      // Friendship recompute when any Friendship joins any ability
      // zone — opponent gaining/losing Friendship mid-turn updates the
      // borrowed grant.
      if (ctx.toZone === 'ability' && ctx.enteringCard?.name === 'Friendship') {
        setupBorrowedFriendship(ctx);
      }
      // Creativity-mirror draw when an ability lands on Lizbeth's own
      // slot (the handler does its own gate).
      if (ctx.toZone === 'ability') {
        return handleCreativityMirror(ctx);
      }
    },

    onStatusApplied: (ctx) => {
      if (!lizbethActiveBorrower(ctx)) return;
      const hero = ctx.attachedHero;
      if (ctx.heroOwner !== ctx.cardOwner) return;
      if (ctx.heroIdx !== ctx.cardHeroIdx) return;
      if (!hero?.name || hero.hp <= 0) return;

      const statusName = ctx.statusName;
      if (!statusName) return;
      if (!hero.statuses?.[statusName]) return; // already cleared by another listener

      // Resistance blocks any status; budget = level (Lv3 = unlimited).
      if (!tryResistanceBlock(ctx)) return;
      delete hero.statuses[statusName];
    },

    beforeHeroEffect: (ctx) => {
      if (!lizbethActiveBorrower(ctx)) return;
      // Effects targeting Lizbeth herself.
      if (ctx.playerIdx !== ctx.cardOwner) return;
      if (ctx.heroIdx !== ctx.cardHeroIdx) return;
      if (!tryResistanceBlock(ctx)) return;
      ctx.cancel();
    },

    afterDamage: async (ctx) => {
      await handleSmugnessMirror(ctx);
    },

    afterPotionUsed: async (ctx) => {
      await handleBiomancyMirror(ctx);
    },

    afterSpellResolved: async (ctx) => {
      await handleFriendshipDrawMirror(ctx);
    },
  },
};
