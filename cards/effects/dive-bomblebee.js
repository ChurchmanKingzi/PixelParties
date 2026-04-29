// ═══════════════════════════════════════════
//  CARD EFFECT: "Dive Bomblebee"
//  Creature (Summoning Magic Lv1, Normal, 50 HP)
//
//  Once per turn, when a target your opponent
//  controls is defeated, choose a card on your
//  opponent's side of the board that is not a
//  Hero and place it at the bottom of your
//  opponent's deck.
//
//  Targets every face-up non-Hero card in any
//  opponent support / ability / area zone. The
//  selected card fires `onCardLeaveZone` (full
//  canonical payload — same shape as the
//  death/move paths and the Slippery Fridge fix)
//  before being spliced out and pushed onto the
//  bottom of the opp's main deck. No shuffle —
//  text says "place at the bottom."
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { isOpponentTargetDeath } = require('./_bomblebee-shared');

const CARD_NAME   = 'Dive Bomblebee';
const ANIM_TYPE   = 'bomblebee_dive';
const HOPT_PREFIX = 'dive-bomblebee';

// Every face-up non-Hero card on the opponent's side. Includes equips,
// creatures, and ability cards. (Areas live in their own zone and don't
// contribute to the per-hero support array, so they're naturally
// excluded — text says "card on your opponent's side of the board",
// which we read as the support+ability zones, the standard "board" set.)
//
// Cardinal Beasts and other `_omniImmune` creatures REMAIN TARGETABLE —
// the picker offers them, the animation plays on them, but the actual
// deck-bottom move fizzles silently inside the resolve. This matches
// the engine convention used by Bomb Arrow and other "absolute" effects
// (see `canTargetForStatus` vs `canApplyCreatureStatus` in engine.js).
function pickableOppCards(engine, listenerOwner) {
  const oi = listenerOwner === 0 ? 1 : 0;
  const ops = engine.gs.players[oi];
  if (!ops) return [];

  const cardDB = engine._getCardDB();
  const out = [];

  // Support zone instances (creatures + equips).
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if (inst.faceDown) continue;
    if (inst.owner !== oi) continue; // Use raw owner, not controller — we
    // want the physical opponent side. A stolen creature on opp's side
    // still lives there; a charmed-hero equip likewise.
    const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
    if (!cd) continue;
    if (hasCardType(cd, 'Hero') || hasCardType(cd, 'Ascended Hero')) continue;
    out.push({
      id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
      type: 'equip',
      owner: inst.owner, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
      cardName: inst.name, cardInstance: inst,
      _zone: 'support',
    });
  }

  // Ability zone instances.
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'ability') continue;
    if (inst.owner !== oi) continue;
    out.push({
      id: `ability-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
      type: 'ability',
      owner: inst.owner, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
      cardName: inst.name, cardInstance: inst,
      _zone: 'ability',
    });
  }

  return out;
}

async function runOpponentDeathPayload(engine, inst, opts = {}) {
  const gs = engine.gs;
  const pi = inst.controller ?? inst.owner;
  const oi = pi === 0 ? 1 : 0;

  const hoptKey = `${HOPT_PREFIX}:${inst.id}`;
  if (!opts.bypassHopt) {
    if (gs.hoptUsed?.[hoptKey] === gs.turn) return;
  }

  const targets = pickableOppCards(engine, pi);
  if (targets.length === 0) return;

  const picked = await engine.promptEffectTarget(pi, targets, {
    title: CARD_NAME,
    description: 'Choose a non-Hero card on your opponent\'s side. It will be placed at the bottom of their deck.',
    confirmLabel: '🛬 Send to Bottom!',
    confirmClass: 'btn-info',
    cancellable: true,
    exclusiveTypes: false,
    maxPerType: { equip: 1, ability: 1 },
  });
  if (!picked || picked.length === 0) return;

  const target = targets.find(t => t.id === picked[0]);
  if (!target?.cardInstance) return;

  if (!opts.bypassHopt) {
    if (!gs.hoptUsed) gs.hoptUsed = {};
    gs.hoptUsed[hoptKey] = gs.turn;
  }

  const targetInst = target.cardInstance;
  const ops = gs.players[oi];
  const fromZone = targetInst.zone;
  const fromHeroIdx = targetInst.heroIdx;
  const fromZoneSlot = targetInst.zoneSlot;
  const cardName = targetInst.name;

  // Cosmic Depths "removal of own CD Creature" hand-reaction window —
  // gives the target's owner a chance to negate the deck-bottom move
  // via Cosmic Malfunction. The helper returns `true` if cancelled.
  // Dive Bomblebee's custom splice-and-push doesn't go through
  // actionDestroyCard / actionMoveCard, so we call the helper
  // explicitly here.
  const cmSource = { name: CARD_NAME, owner: pi, heroIdx: inst.heroIdx, cardInstance: inst };
  const cmCancelled = await engine._checkCdMovementHandReactions(targetInst, cmSource, 'move');
  if (cmCancelled) {
    engine.log('dive_bomblebee_blocked', {
      player: gs.players[pi]?.username,
      target: cardName, reason: 'cosmic-malfunction',
    });
    engine.sync();
    return;
  }

  // Animation on the target zone — plays even on omni-immune targets
  // (the dive happens, the impact lands, but the actual displacement
  // fizzles below).
  engine._broadcastEvent('play_zone_animation', {
    type: ANIM_TYPE,
    owner: oi,
    heroIdx: fromHeroIdx,
    zoneSlot: fromZone === 'support' ? fromZoneSlot : -1,
    zoneType: fromZone,
  });

  // Cardinal Beasts / `_omniImmune` creatures: the dive-bomb visual
  // plays but the removal silently fizzles. HOPT was already stamped
  // above (the slot is consumed regardless — same convention as Bomb
  // Arrow's fizzling 100-damage on Cardinal Beasts). No
  // `creature_zone_move` broadcast either, since no creature is
  // actually moving zones.
  if (engine.isOmniImmune(targetInst)) {
    await engine._delay(450);
    engine.log('dive_bomblebee_fizzle', {
      player: gs.players[pi]?.username,
      target: cardName, reason: 'omni-immune',
    });
    engine.sync();
    return;
  }

  // Suppress the client's damage-number popup for the disappearing
  // creature. The client's HP-diff watcher (app-board.jsx ~14652) treats
  // any "creature was here last frame, gone now" as lethal damage and
  // displays its previous HP — the deck-bottom move isn't damage, so we
  // flag this slot for the watcher to skip via `creature_zone_move`.
  // No-op for ability-zone targets (the watcher only tracks creatures).
  if (fromZone === 'support') {
    engine._broadcastEvent('creature_zone_move', {
      owner: oi, heroIdx: fromHeroIdx, zoneSlot: fromZoneSlot,
    });
  }

  await engine._delay(450);

  // Fire the leave-zone hook with full canonical payload (mirrors the
  // engine's own death/move paths so equipment scripts that gate on
  // fromOwner/fromHeroIdx/fromZoneSlot run their cleanup correctly).
  await engine.runHooks('onCardLeaveZone', {
    _onlyCard: targetInst, card: targetInst, leavingCard: targetInst,
    fromZone,
    fromOwner: targetInst.owner,
    fromHeroIdx,
    fromZoneSlot,
    _skipReactionCheck: true,
  });

  // Splice the name out of the proper zone array.
  if (fromZone === 'support') {
    const slotArr = (ops.supportZones?.[fromHeroIdx] || [])[fromZoneSlot] || [];
    const idx = slotArr.indexOf(cardName);
    if (idx >= 0) slotArr.splice(idx, 1);
  } else if (fromZone === 'ability') {
    const slotArr = (ops.abilityZones?.[fromHeroIdx] || [])[fromZoneSlot] || [];
    const idx = slotArr.indexOf(cardName);
    if (idx >= 0) slotArr.splice(idx, 1);
  }

  // Untrack the inst BEFORE pushing onto deck — the deck holds names
  // only, no instance tracking.
  engine._untrackCard(targetInst.id);

  // Bottom-of-deck.
  if (!ops.mainDeck) ops.mainDeck = [];
  ops.mainDeck.push(cardName);

  engine.log('dive_bomblebee_strike', {
    player: gs.players[pi]?.username,
    target: cardName,
    bypassHopt: !!opts.bypassHopt,
  });
  engine.sync();
}

module.exports = {
  activeIn: ['support'],

  runOpponentDeathPayload,

  hooks: {
    onCreatureDeath: async (ctx) => {
      if (!isOpponentTargetDeath(ctx, ctx.cardOwner)) return;
      await runOpponentDeathPayload(ctx._engine, ctx.card);
    },
    onHeroKO: async (ctx) => {
      if (!isOpponentTargetDeath(ctx, ctx.cardOwner)) return;
      await runOpponentDeathPayload(ctx._engine, ctx.card);
    },
  },
};
