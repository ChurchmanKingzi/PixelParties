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
//  W5a (Al 14.10.2026): wählbar sind Nicht-Helden-Karten, die der GEGNER kontrolliert ("opponent's side" = Nomenklatur
//  für "vom Gegner kontrolliert"); sie kommen unter das Deck ihres PERMANENTEN Besitzers. Tokens verschwinden vollständig.
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

// Every non-Hero card on the opponent's side. Includes equips,
// creatures, ability cards (Pollution Tokens zählen als Karte) and — Als
// Ruling (Al 26.10.: „Pollution Tokens und verdeckte Surprises sind bei
// ‚card … that is not a Hero' WÄHLBAR") — verdeckte Surprises (Surprise Zone
// und verdeckte Surprise-Creatures in Support Zones; der Name erscheint dem
// Wähler maskiert, `potionTargetingFuer`). (Areas live in their own zone and don't
// contribute to the per-hero support array, so they're naturally
// excluded — text says "card on your opponent's side of the board",
// which we read as the support+ability+surprise zones, the standard "board" set.)
//
// Cardinal Beasts and other `_omniImmune` creatures REMAIN TARGETABLE —
// the picker offers them, the animation plays on them, but the actual
// deck-bottom move fizzles silently inside the resolve. This matches
// the engine convention used by Bomb Arrow and other "absolute" effects
// (see `canTargetForStatus` vs `canApplyCreatureStatus` in engine.js).
function pickableOppCards(engine, listenerOwner) {
  const oi = engine.opponentOf(listenerOwner);
  const ops = engine.gs.players[oi];
  if (!ops) return [];

  const cardDB = engine._getCardDB();
  const out = [];

  // Support zone instances (creatures + equips).
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    // 25.10.2026 (Xal-Runde 4): eine Ability in einer Support Zone ist eine Ability — ein Stapel ist EIN Ziel (oberste Kopie), nicht eins je Karte.
    if (engine.istAbilityImSupport(inst) && engine.supportAbilitySpitze(inst) !== inst) continue;
    // W5a (Al 14.10.2026, A05-03; Praezisierung: „'Opponent's side of the board' ist einfach Nomenklatur fuer 'Creature, die der
    // Opponent kontrolliert'"): waehlbar sind Karten, die der GEGNER kontrolliert (nach KONTROLLE, nicht nach Brettseite) —
    // nie eine, die der Wirker selbst kontrolliert. Ziel-IDs/Zonenzugriffe nennen die BRETTSEITE (`physicalSide`, Z1); die Karte
    // kommt unter das Deck ihres PERMANENTEN Besitzers (W3, siehe unten).
    if (engine.kontrolleurVon(inst) !== oi) continue;
    const seite = engine.physicalSide(inst);
    const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
    if (!cd) continue;
    if (hasCardType(cd, 'Hero') || hasCardType(cd, 'Ascended Hero')) continue;
    out.push({
      id: `equip-${seite}-${inst.heroIdx}-${inst.zoneSlot}`,
      type: 'equip',
      owner: seite, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
      cardName: inst.name, cardInstance: inst,
      _zone: 'support',
    });
  }

  // Als Ruling (Al 26.10.): verdeckte Surprises in der Surprise Zone. „Opponent's side" = der Kontrolleur des Helden (W5a), wie bei den übrigen Zonen nach KONTROLLE.
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'surprise') continue;
    if (inst.counters?.immovable) continue;
    if (engine.surpriseKontrolleur(inst.owner, inst.heroIdx) !== oi) continue;
    out.push({
      id: `surprise-${inst.owner}-${inst.heroIdx}`,
      type: 'surprise',
      owner: inst.owner, heroIdx: inst.heroIdx,
      cardName: inst.name, cardInstance: inst,
      _zone: 'surprise',
    });
  }

  // Ability zone instances.
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'ability') continue;
    if (engine.kontrolleurVon(inst) !== oi) continue;   // W5a (A05-03), s. o.
    out.push({
      id: `ability-${engine.physicalSide(inst)}-${inst.heroIdx}-${inst.zoneSlot}`,
      type: 'ability',
      owner: engine.physicalSide(inst), heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
      cardName: inst.name, cardInstance: inst,
      _zone: 'ability',
    });
  }

  return out;
}

async function runOpponentDeathPayload(engine, inst, opts = {}) {
  const gs = engine.gs;
  const pi = inst.controller ?? inst.owner;
  const oi = engine.opponentOf(pi);

  const hoptKey = `${HOPT_PREFIX}:${inst.id}`;
  if (!opts.bypassHopt) {
    if (gs.hoptUsed?.[hoptKey] === gs.turn) return;
  }

  const targets = pickableOppCards(engine, pi);
  if (targets.length === 0) return;

  const picked = await engine.promptEffectTarget(pi, targets, {
    maxTotal: 1,   // Einfachauswahl: ein Klick TAUSCHT das Ziel
    title: CARD_NAME,
    description: 'Choose a non-Hero card on your opponent\'s side. It will be placed at the bottom of their deck.',
    confirmLabel: '🛬 Send to Bottom!',
    confirmClass: 'btn-info',
    cancellable: true,
    exclusiveTypes: false,
    maxPerType: { equip: 1, ability: 1, surprise: 1 },
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
  // Brettseite des Ziels: eine gestohlene Kreatur liegt weiter auf der Seite
  // ihres Besitzers (`physicalSide`), obwohl `oi` sie kontrolliert (A05-03).
  const feldSeite = engine.physicalSide(targetInst);
  const fps = gs.players[feldSeite] || ops;
  const fromZone = targetInst.zone;
  const fromHeroIdx = targetInst.heroIdx;
  const fromZoneSlot = targetInst.zoneSlot;
  const cardName = targetInst.name;
  const istToken = engine.isTokenCard(targetInst);   // Z5 (A05-02)

  // Defending the Gate: support-zone targets only (ability-zone displacement
  // is outside the gate's scope, which protects Support Zone cards).
  if (fromZone === 'support') {
    await engine._triggerGateCheck(targetInst.controller ?? targetInst.owner, CARD_NAME);
    if (engine._isGateShielded(targetInst.controller ?? targetInst.owner)) {
      engine.log('dive_bomblebee_blocked', {
        player: gs.players[pi]?.username,
        target: cardName, reason: 'Defending the Gate',
      });
      engine.sync();
      return;
    }
  }

  // W16c (A05-20): das rohe Splice-and-Push umgeht `actionMoveCard`, das `beforeCreatureAffected` ('move') feuert - Schutzkarten
  // (Winged Skeleton: "chosen by an opponent's card ... negate") muessen auch hier zum Zug kommen.
  if (fromZone === 'support' && !istToken) {
    const affCtx = {
      creature: targetInst, effectType: 'move',
      source: { name: CARD_NAME, owner: pi, heroIdx: inst.heroIdx },
      cancelled: false, _skipReactionCheck: true,
    };
    await engine.runHooks('beforeCreatureAffected', affCtx);
    if (affCtx.cancelled) {
      engine.log('dive_bomblebee_blocked', { player: gs.players[pi]?.username, target: cardName, reason: 'creature protection' });
      engine.sync();
      return;
    }
  }

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

  // 25.10.2026: Leafagami Snake — eine Ability (Ability Zone oder Support Zone) bleibt liegen, der Kontrolleur der Schlange zieht (HOPT ist verbraucht).
  if (await engine.abilityEntfernungVerhindert(targetInst, 'deck', { source: { name: CARD_NAME, owner: pi } })) {
    engine.sync();
    return;
  }

  // Animation on the target zone — plays even on omni-immune targets
  // (the dive happens, the impact lands, but the actual displacement
  // fizzles below).
  engine._broadcastEvent('play_zone_animation', {
    type: ANIM_TYPE,
    owner: feldSeite,
    heroIdx: fromHeroIdx,
    zoneSlot: fromZone === 'support' ? fromZoneSlot : -1,
    zoneType: fromZone,   // 'support' | 'ability' | 'surprise'
  });

  // Cardinal Beasts / `_omniImmune` creatures: the dive-bomb visual
  // plays but the removal silently fizzles. HOPT was already stamped
  // above (the slot is consumed regardless — same convention as Bomb
  // Arrow's fizzling 100-damage on Cardinal Beasts). No
  // `creature_zone_move` broadcast either, since no creature is
  // actually moving zones.
  if (engine.isOmniImmune(targetInst, pi)) {   // W17b: Golden Wings quellenbewusst
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
      owner: feldSeite, heroIdx: fromHeroIdx, zoneSlot: fromZoneSlot,
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
    const slotArr = (fps.supportZones?.[fromHeroIdx] || [])[fromZoneSlot] || [];
    const idx = slotArr.indexOf(cardName);
    if (idx >= 0) slotArr.splice(idx, 1);
  } else if (fromZone === 'ability') {
    const slotArr = (fps.abilityZones?.[fromHeroIdx] || [])[fromZoneSlot] || [];
    const idx = slotArr.indexOf(cardName);
    if (idx >= 0) slotArr.splice(idx, 1);
  } else if (fromZone === 'surprise') {
    // Als Ruling (Al 26.10.): verdeckte Surprise aus der Surprise Zone des Helden (`surpriseZones[heroIdx]`).
    const slotArr = (fps.surpriseZones?.[fromHeroIdx]) || [];
    const idx = slotArr.indexOf(cardName);
    if (idx >= 0) slotArr.splice(idx, 1);
  }

  // Untrack the inst BEFORE pushing onto deck — the deck holds names
  // only, no instance tracking.
  engine._untrackCard(targetInst.id);

  // Bottom-of-deck. W5a (Al 14.10.2026): Tokens verschwinden vollstaendig (eine echte Karte darunter wird gelöscht);
  // jede andere Karte kommt unter das Deck ihres PERMANENTEN Besitzers (W3), nicht des Kontrolleurs/Brettbesitzers.
  if (istToken) {
    engine.tokenAbgang(targetInst);
  } else {
    const dps = gs.players[engine.kartenBesitzerVon(targetInst)] || ops;
    if (!dps.mainDeck) dps.mainDeck = [];
    dps.mainDeck.push(cardName);
  }

  engine.log('dive_bomblebee_strike', {
    player: gs.players[pi]?.username,
    target: cardName,
    bypassHopt: !!opts.bypassHopt,
  });
  engine.sync();
}

module.exports = {
  // v1376 (Boris-Errata): Klausel 1 sperrt nur noch das Hinzufuegen zur
  // HAND — diese Karte bringt keine gegnerische Karte auf die Hand und
  // ist deshalb nicht mehr gesperrt (vorher `stealsOpponentCards`).

  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
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
