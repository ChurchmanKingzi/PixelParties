// ═══════════════════════════════════════════
//  CARD EFFECT: "Invader from the Cosmic Depths"
//  Creature (Summoning Magic Lv4, Normal, 150 HP)
//  Cosmic Depths archetype.
//
//  SUMMON RESTRICTION: this card can only be
//  summoned by the effect of a "Cosmic" card.
//  - Real summons (`summonCreatureWithHooks`):
//    `beforeSummon` rejects unless
//    `ctx._summonedByCosmic === true` (or the
//    fallback _summonedBy name matches isCosmic
//    Card). Hand plays don't carry the flag, so
//    they're blocked.
//  - "Place" paths (`summonCreature`, silent):
//    each placing card pre-filters its picker via
//    `canSummonInvaderViaSource`, so Argos can't
//    even pick Invader from its menu.
//
//  CONTROL CAP: at most 1 Invader on your side at
//  any time. Enforced in `beforeSummon` (real
//  summons) and surfaced via `canSummon` for
//  picker-time UX clarity.
//
//  ON-PLAY: when a Cosmic card summons Invader,
//  you MAY place up to 2 Invader Tokens into free
//  Support Zones of any Hero either player
//  controls. Fires from `onPlay`, so it's silenced
//  by The Cosmic Depths' "effects negated for the
//  rest of the turn" clause (intentional — the
//  Depths' negation IS the trade-off for its
//  free-additional-Action summon). Real summon
//  paths (Life-Searcher's place-into-the-same-
//  zone upgrade, Arrival's second half via the
//  Lv3→Lv4 chain) are NOT silenced and DO place
//  the tokens.
//
//  ACTIVATED: discard a Lv≤4 Attack or Spell from
//  hand → deal 80×lvl damage to a chosen target.
//  HOPT.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { isCosmicCard } = require('./_cosmic-shared');

const CARD_NAME = 'Invader from the Cosmic Depths';
const INVADER_TOKEN = 'Invader Token';
const MAX_TOKEN_PLACES_ON_SUMMON = 2;
const DAMAGE_PER_LEVEL = 80;

/** Count Invaders this player currently controls (alive, on board). */
function countOwnInvaders(engine, pi) {
  let n = 0;
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if (inst.faceDown) continue;
    if ((inst.controller ?? inst.owner) !== pi) continue;
    if (inst.name === CARD_NAME) n++;
  }
  return n;
}

/**
 * All free Support Zones on either player's heroes — dead Heroes
 * included (Tokens are "placed," and "place" targets any Hero's
 * Support Zone per the universal rule, including KO'd Heroes).
 */
function allFreeSupportSlotsBothSides(engine) {
  const out = [];
  for (let pi = 0; pi < 2; pi++) {
    const ps = engine.gs.players[pi];
    if (!ps) continue;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const h = ps.heroes[hi];
      if (!h?.name) continue;
      const zones = ps.supportZones?.[hi] || [[], [], []];
      for (let zi = 0; zi < 3; zi++) {
        if ((zones[zi] || []).length === 0) {
          out.push({ owner: pi, heroIdx: hi, slotIdx: zi, heroName: h.name });
        }
      }
    }
  }
  return out;
}

/**
 * Prompt the controller to place up to 2 Invader Tokens into free
 * Support Zones (any Hero, either side). Used by Invader's beforeSummon
 * so the place-tokens effect lands BEFORE the summoning source can
 * silence the placed Invader (The Cosmic Depths' negation path).
 *
 * `reservedSlot` (optional) is the slot Invader itself is about to
 * land in. Excluded from the option list so a careless player doesn't
 * fill Invader's destination with a token and fizzle the summon.
 */
async function placeInvaderTokens(engine, pi, reservedSlot = null) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  if (!ps) return;

  const slotsAvailable = () => {
    const all = allFreeSupportSlotsBothSides(engine);
    if (!reservedSlot) return all;
    return all.filter(s => !(s.owner === reservedSlot.owner
      && s.heroIdx === reservedSlot.heroIdx
      && s.slotIdx === reservedSlot.slotIdx));
  };
  let freeSlots = slotsAvailable();
  if (freeSlots.length === 0) return;

  const initialCap = Math.min(freeSlots.length, MAX_TOKEN_PLACES_ON_SUMMON);
  const opts = [{ id: '0', label: 'Place 0 (skip)' }];
  for (let n = 1; n <= initialCap; n++) {
    opts.push({ id: String(n), label: `Place ${n} Invader Token${n === 1 ? '' : 's'}` });
  }
  const pick = await engine.promptGeneric(pi, {
    type: 'optionPicker',
    title: CARD_NAME,
    description: `Place up to ${initialCap} Invader Token${initialCap === 1 ? '' : 's'} into free Support Zones (any Hero, either side).`,
    options: opts,
    cancellable: false,
  });
  const requested = parseInt(pick?.optionId || '0', 10);
  if (!Number.isFinite(requested) || requested <= 0) return;

  // Synthetic ctx for promptZonePick — Invader isn't on the board yet
  // (we're inside beforeSummon, before placement), so we build a
  // pseudo instance routed through the activator.
  const pseudoInst = {
    id: 'invader-summon-pseudo',
    name: CARD_NAME, owner: pi, controller: pi,
    zone: 'none', heroIdx: -1, zoneSlot: -1, counters: {}, faceDown: false,
  };
  const promptCtx = engine._createContext(pseudoInst, {});

  let placed = 0;
  for (let i = 0; i < requested; i++) {
    const slots = slotsAvailable();
    if (slots.length === 0) break;

    let chosen;
    if (slots.length === 1) {
      chosen = slots[0];
    } else {
      const zones = slots.map(s => ({
        owner: s.owner, heroIdx: s.heroIdx, slotIdx: s.slotIdx,
        label: `${s.owner === pi ? '(You) ' : '(Opp) '}${s.heroName} — Slot ${s.slotIdx + 1}`,
      }));
      const zp = await promptCtx.promptZonePick(zones, {
        title: CARD_NAME,
        description: `Place Invader Token #${i + 1} into which zone?`,
        cancellable: false,
        allowEitherSide: true,
      });
      if (!zp) break;
      chosen = { owner: zp.owner ?? pi, heroIdx: zp.heroIdx, slotIdx: zp.slotIdx };
    }

    const placeRes = engine.summonCreature(INVADER_TOKEN, chosen.owner, chosen.heroIdx, chosen.slotIdx, {
      source: CARD_NAME,
    });
    if (!placeRes) continue;
    placed++;
    engine._broadcastEvent('play_zone_animation', {
      type: 'cosmic_token_drop',
      owner: chosen.owner, heroIdx: chosen.heroIdx, zoneSlot: chosen.slotIdx,
    });
    await engine._delay(220);
  }

  engine.log('invader_tokens_placed', { player: ps.username, placed });
  engine.sync();
}

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,

  // ── Pre-placement gate ─────────────────────────────────────────
  async beforeSummon(ctx) {
    // Reject hand plays (no _summonedByCosmic flag) and any non-Cosmic
    // effect summon. Real summons by Arrival / Life-Searcher / The
    // Cosmic Depths / Cosmic Manipulation pass.
    const byCosmic = ctx._summonedByCosmic
      || (typeof ctx._summonedBy === 'string' && isCosmicCard(ctx._summonedBy));
    if (!byCosmic) {
      ctx._engine.log('invader_summon_blocked', { reason: 'not_summoned_by_cosmic_card' });
      return false;
    }
    // 1-at-a-time control limit.
    if (countOwnInvaders(ctx._engine, ctx.cardOwner) >= 1) {
      ctx._engine.log('invader_summon_blocked', { reason: 'already_control_one' });
      return false;
    }
    return true;
  },

  // Surface the restriction in client UX (greyed-out hand card etc.).
  // Engine signature is `(ctx)`, NOT `(gs, pi, ...)` — passing the wrong
  // shape used to make `engine` undefined and the function returned
  // `false` unconditionally. With the fixed signature this gates both
  // hand plays (no cosmic flag → grey out) AND the per-source filters
  // used by other summoners (Cosmic Depths, Necromancy, Reincarnation,
  // …) that route through `engine.isCreatureSummonable`. Effect-summons
  // by a Cosmic source pass `_summonedByCosmic` (or `_summonedBy` with a
  // Cosmic name) in `ctxExtras` and are allowed.
  canSummon(ctx) {
    const engine = ctx?._engine;
    const pi = ctx?.cardOwner;
    if (!engine || pi == null) return false;
    if (countOwnInvaders(engine, pi) >= 1) return false;
    const byCosmic = ctx._summonedByCosmic
      || (typeof ctx._summonedBy === 'string' && isCosmicCard(ctx._summonedBy));
    return !!byCosmic;
  },

  // ── ON-PLAY: place up to 2 Invader Tokens (optional) ───────────
  // Fires only on REAL summons that don't get silenced afterwards —
  // i.e. Life-Searcher's place-into-the-same-zone path (a real summon
  // with full hooks). The Cosmic Depths' negation path uses
  // `summonCreature` (silent) + `actionNegateCreature` BEFORE its
  // manual onCardEnterZone broadcast, so the runHooks negation filter
  // suppresses Invader's onPlay there — exactly the design intent
  // (effects negated for the rest of the turn).
  hooks: {
    onPlay: async (ctx) => {
      if (ctx.playedCard?.id !== ctx.card.id) return;
      const reservedSlot = {
        owner: ctx.cardOwner,
        heroIdx: ctx.card.heroIdx,
        slotIdx: ctx.card.zoneSlot,
      };
      await placeInvaderTokens(ctx._engine, ctx.cardOwner, reservedSlot);
    },
  },

  // ── ACTIVATED: discard Lv≤4 Attack/Spell → 80×lvl damage ────────
  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.card.controller ?? ctx.card.owner;
    const ps = engine.gs.players[pi];
    if (!ps) return false;

    const cardDB = engine._getCardDB();
    const hasFood = (ps.hand || []).some(cn => {
      const cd = cardDB[cn];
      if (!cd) return false;
      if (cd.cardType !== 'Attack' && cd.cardType !== 'Spell') return false;
      const lvl = cd.level || 0;
      return lvl >= 1 && lvl <= 4;
    });
    return hasFood;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const inst = ctx.card;
    const pi = inst.controller ?? inst.owner;
    const ps = gs.players[pi];
    if (!ps) return false;

    const cardDB = engine._getCardDB();

    // Step 1: pick the discard from hand (Lv1-4 Attack/Spell).
    const eligibleIndices = [];
    for (let i = 0; i < ps.hand.length; i++) {
      const cn = ps.hand[i];
      const cd = cardDB[cn];
      if (!cd) continue;
      if (cd.cardType !== 'Attack' && cd.cardType !== 'Spell') continue;
      const lvl = cd.level || 0;
      if (lvl < 1 || lvl > 4) continue;
      eligibleIndices.push(i);
    }
    if (eligibleIndices.length === 0) return false;

    const handPick = await engine.promptGeneric(pi, {
      type: 'pickHandCard',
      title: CARD_NAME,
      description: `Discard a Lv1-4 Attack or Spell to deal ${DAMAGE_PER_LEVEL}×lvl damage to a target.`,
      eligibleIndices,
      confirmLabel: '🌌 Discard',
      cancellable: true,
    });
    // pickHandCard returns `{ cardName, handIndex }` on confirm, or
    // `{ cancelled: true }` on cancel — NOT a `selectedCards` array
    // (that's the cardGalleryMulti shape). Read both fields directly.
    if (!handPick || handPick.cancelled || !handPick.cardName) return false;
    const discardName = handPick.cardName;
    const discardCd = cardDB[discardName];
    if (!discardCd) return false;
    const lvl = discardCd.level || 0;
    const damage = DAMAGE_PER_LEVEL * lvl;

    // Step 2: pick the target.
    const targets = [];
    for (let pIdx = 0; pIdx < 2; pIdx++) {
      const p = gs.players[pIdx];
      for (let hi = 0; hi < (p?.heroes || []).length; hi++) {
        const h = p.heroes[hi];
        if (!h?.name || h.hp <= 0) continue;
        targets.push({ id: `hero-${pIdx}-${hi}`, type: 'hero', owner: pIdx, heroIdx: hi, cardName: h.name });
      }
    }
    for (const cInst of engine.cardInstances) {
      if (cInst.zone !== 'support') continue;
      if (cInst.faceDown) continue;
      const cd = engine.getEffectiveCardData(cInst) || cardDB[cInst.name];
      if (!cd || !hasCardType(cd, 'Creature')) continue;
      targets.push({
        id: `equip-${cInst.owner}-${cInst.heroIdx}-${cInst.zoneSlot}`, type: 'equip',
        owner: cInst.owner, heroIdx: cInst.heroIdx, slotIdx: cInst.zoneSlot,
        cardName: cInst.name, cardInstance: cInst,
      });
    }
    if (targets.length === 0) return false;

    const tgtPicked = await engine.promptEffectTarget(pi, targets, {
      title: CARD_NAME,
      description: `Deal ${damage} damage to which target?`,
      confirmLabel: `💥 ${damage} Damage!`,
      confirmClass: 'btn-danger',
      cancellable: true,
      exclusiveTypes: false,
      maxPerType: { hero: 1, equip: 1 },
    });
    if (!tgtPicked || tgtPicked.length === 0) return false;
    const tgt = targets.find(t => t.id === tgtPicked[0]);
    if (!tgt) return false;

    // Pay the discard cost — splice the EXACT copy the player clicked
    // (handIndex), not the first matching name. Multiple copies of the
    // same name in hand would otherwise route the wrong physical copy.
    const handIdx = handPick.handIndex != null
      ? handPick.handIndex
      : ps.hand.indexOf(discardName);
    if (handIdx >= 0 && ps.hand[handIdx] === discardName) {
      ps.hand.splice(handIdx, 1);
      ps.discardPile.push(discardName);
      engine.log('invader_discard', { player: ps.username, discarded: discardName, lvl });
    }

    const source = { name: CARD_NAME, owner: pi, heroIdx: inst.heroIdx, cardInstance: inst };

    engine._broadcastEvent('play_zone_animation', {
      type: 'cosmic_invader_strike',
      owner: tgt.owner,
      heroIdx: tgt.heroIdx,
      zoneSlot: tgt.type === 'hero' ? -1 : tgt.slotIdx,
    });
    await engine._delay(380);

    if (tgt.type === 'hero') {
      const h = gs.players[tgt.owner]?.heroes?.[tgt.heroIdx];
      if (h && h.hp > 0) await engine.actionDealDamage(source, h, damage, 'creature');
    } else if (tgt.cardInstance) {
      await engine.actionDealCreatureDamage(
        source, tgt.cardInstance, damage, 'creature',
        { sourceOwner: pi, canBeNegated: true },
      );
    }

    engine.log('invader_strike', {
      player: ps.username, target: tgt.cardName, damage,
    });
    engine.sync();
    return true;
  },
};
