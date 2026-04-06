// ═══════════════════════════════════════════
//  CARD EFFECT: "Charme"
//  Ability — Free activation (Main Phase)
//
//  Lv1: Copy-activate an opponent's ability
//       using this Hero's stats.
//  Lv2: Opponent gives you 1 card from hand.
//       Fizzles during turn-1 protection.
//  Lv3: Take control of opponent's hero for
//       the turn (charmed + immune).
//       Fizzles on turn-1-protected heroes.
//
//  Standard free-ability HOPT covers shared
//  lock (all Charme copies share one name).
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');

module.exports = {
  activeIn: ['ability'],
  freeActivation: true,
  actionPhaseEligible: true, // Lv1 can also activate during Action Phase to copy action-cost abilities

  canFreeActivate(ctx, level) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const hero = gs.players[pi]?.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;

    const oi = pi === 0 ? 1 : 0;
    const ops = gs.players[oi];
    const isActionPhase = gs.currentPhase === 3;
    const isMainPhase = gs.currentPhase === 2 || gs.currentPhase === 4;

    if (level >= 3) {
      // Lv3: need opponent hero alive (Main Phase only)
      if (!isMainPhase) return false;
      return (ops.heroes || []).some(h => h?.name && h.hp > 0 && !h.charmedBy);
    } else if (level >= 2) {
      // Lv2: opponent must have 1+ cards in hand (Main Phase only)
      if (!isMainPhase) return false;
      return (ops.hand || []).length > 0;
    } else {
      // Lv1: opponent must have activatable abilities
      // During Main Phase: free-activation abilities
      // During Action Phase: action-cost abilities
      const abilities = _getOpponentActivatableAbilities(gs, pi, engine);
      if (isMainPhase) return abilities.some(a => a.isFree);
      if (isActionPhase) return abilities.some(a => !a.isFree);
      return false;
    }
  },

  onFreeActivate: async (ctx, level) => {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const hero = gs.players[pi]?.heroes?.[heroIdx];
    if (!hero?.name) return false;

    const oi = pi === 0 ? 1 : 0;
    const ops = gs.players[oi];

    if (level >= 3) {
      return await _activateLv3(engine, gs, pi, heroIdx, hero, oi, ops);
    } else if (level >= 2) {
      return await _activateLv2(engine, gs, pi, heroIdx, hero, oi, ops);
    } else {
      return await _activateLv1(engine, gs, pi, heroIdx, hero, oi, ops);
    }
  },
};

// ═══════════════════════════════════════════
//  LEVEL 1: Copy-activate opponent's ability
// ═══════════════════════════════════════════

function _getOpponentActivatableAbilities(gs, pi, engine) {
  const oi = pi === 0 ? 1 : 0;
  const ops = gs.players[oi];
  const results = [];

  for (let hi = 0; hi < (ops.heroes || []).length; hi++) {
    const h = ops.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    for (let zi = 0; zi < (ops.abilityZones[hi] || []).length; zi++) {
      const slot = (ops.abilityZones[hi] || [])[zi] || [];
      if (slot.length === 0) continue;
      const abName = slot[0];
      const script = loadCardEffect(abName);
      const isFree = !!script?.freeActivation;
      const isAction = !!script?.actionCost;
      // Must have either onActivate (action) or onFreeActivate (free)
      if (!script?.onActivate && !script?.onFreeActivate) continue;
      // Cannot copy another Charme
      if (abName === 'Charme') continue;
      // Check standard HOPT for the original ability
      const abHoptKey = isFree ? `free-ability:${abName}:${oi}` : `ability-action:${abName}:${oi}`;
      if (gs.hoptUsed?.[abHoptKey] === gs.turn) continue;
      results.push({ abName, abLevel: slot.length, ownerHeroIdx: hi, zoneIdx: zi, heroName: h.name, script, isFree });
    }
  }
  return results;
}

async function _activateLv1(engine, gs, pi, heroIdx, hero, oi, ops) {
  const allAbilities = _getOpponentActivatableAbilities(gs, pi, engine);
  const isActionPhase = gs.currentPhase === 3;
  // During Action Phase: only action-cost abilities; during Main Phase: only free abilities
  const abilities = isActionPhase
    ? allAbilities.filter(a => !a.isFree)
    : allAbilities.filter(a => a.isFree);
  if (abilities.length === 0) return false;

  const options = abilities.map((ab, i) => ({
    id: `ab-${i}`,
    label: `${ab.abName} Lv${ab.abLevel} (${ab.heroName})`,
  }));

  const result = await engine.promptGeneric(pi, {
    type: 'optionPicker',
    title: `${hero.name} — Charme Lv1`,
    description: "Choose an opponent's Ability to use as your own!",
    options,
    cancellable: true,
  });

  if (!result || result.cancelled || !result.optionId) return false;

  const match = result.optionId.match(/^ab-(\d+)$/);
  if (!match) return false;
  const selectedAb = abilities[parseInt(match[1])];
  if (!selectedAb) return false;

  const script = selectedAb.script;
  const activateFn = script.onFreeActivate || script.onActivate;
  if (!activateFn) return false;

  // Create a fake context as if the ability were on this Hero
  const fakeInst = {
    id: 'charme-copy-' + Date.now(),
    name: selectedAb.abName,
    owner: pi,
    controller: pi,
    zone: 'ability',
    heroIdx: heroIdx,
    zoneSlot: -1,
    counters: {},
    faceDown: false,
    getHook: () => null,
    isActiveIn: () => true,
  };

  const fakeCtx = engine._createContext(fakeInst, {});

  engine.log('charme_copy', {
    player: gs.players[pi].username, hero: hero.name,
    ability: selectedAb.abName, level: selectedAb.abLevel,
    from: selectedAb.heroName,
  });

  await activateFn(fakeCtx, selectedAb.abLevel);
  engine.sync();
  return true;
}

// ═══════════════════════════════════════════
//  LEVEL 2: Steal card from opponent's hand
// ═══════════════════════════════════════════

async function _activateLv2(engine, gs, pi, heroIdx, hero, oi, ops) {
  if ((ops.hand || []).length === 0) return false;

  // Turn-1 protection: opponent is protected from hand theft
  if (gs.firstTurnProtectedPlayer === oi) {
    engine.log('charme_fizzle', { player: gs.players[pi].username, reason: 'turn-1 protection' });
    engine.sync();
    return true; // Effect was attempted (HOPT consumed) but fizzled
  }

  engine.log('charme_steal_start', { player: gs.players[pi].username, hero: hero.name });

  // Prompt the OPPONENT to choose a card to give away
  const result = await engine.promptGeneric(oi, {
    type: 'forceDiscard',
    title: `${hero.name} used Charme!`,
    description: 'Choose 1 card to give to your opponent.',
    instruction: 'Click a card in your hand to give it away.',
    opponentTitle: '💕 Opponent is choosing a card to give you...',
    opponentSubtitle: 'Waiting for opponent to select a card...',
  });

  let cardName;
  if (result?.cardName) {
    cardName = result.cardName;
    const handIdx = result.handIndex != null ? result.handIndex : ops.hand.indexOf(cardName);
    if (handIdx >= 0) ops.hand.splice(handIdx, 1);
    else { const idx = ops.hand.indexOf(cardName); if (idx >= 0) ops.hand.splice(idx, 1); }
  } else if (ops.hand.length > 0) {
    // Fallback: take the last card
    cardName = ops.hand.pop();
  }

  if (cardName) {
    gs.players[pi].hand.push(cardName);
    const charmerSid = gs.players[pi]?.socketId;
    if (charmerSid && engine.io) {
      engine.io.to(charmerSid).emit('card_reveal', { cardName });
    }
    engine.log('charme_steal', { player: gs.players[pi].username, card: cardName, from: ops.username });
  }

  engine.sync();
  return true;
}

// ═══════════════════════════════════════════
//  LEVEL 3: Take control of opponent's hero
// ═══════════════════════════════════════════

async function _activateLv3(engine, gs, pi, heroIdx, hero, oi, ops) {
  const heroTargets = [];
  for (let hi = 0; hi < (ops.heroes || []).length; hi++) {
    const h = ops.heroes[hi];
    if (!h?.name || h.hp <= 0 || h.charmedBy != null) continue;
    heroTargets.push({
      id: `hero-${oi}-${hi}`,
      type: 'hero', owner: oi, heroIdx: hi, cardName: h.name,
    });
  }

  if (heroTargets.length === 0) return false;

  const picked = await engine.promptEffectTarget(pi, heroTargets, {
    title: `${hero.name} — Charme Lv3`,
    description: 'Choose an opponent\'s Hero to take control of!',
    confirmLabel: '💕 Charm!',
    confirmClass: 'btn-success',
    cancellable: true,
    exclusiveTypes: true,
    maxPerType: { hero: 1 },
    greenSelect: true,
  });

  if (!picked || picked.length === 0) return false;

  const sel = heroTargets.find(t => t.id === picked[0]);
  if (!sel) return false;

  const targetHero = ops.heroes[sel.heroIdx];
  if (!targetHero?.name) return false;

  // Turn-1 protection: hero is protected — fizzle
  if (gs.firstTurnProtectedPlayer === oi) {
    engine.log('charme_fizzle', { player: gs.players[pi].username, target: targetHero.name, reason: 'turn-1 protection' });
    engine.sync();
    return true; // HOPT consumed but fizzled
  }

  // ── Take control ──
  targetHero.charmedBy = pi;
  targetHero.charmedFromOwner = oi;
  targetHero.charmedHeroIdx = sel.heroIdx;

  if (!targetHero.statuses) targetHero.statuses = {};
  targetHero.statuses.charmed = { controller: pi, appliedTurn: gs.turn };

  if (!gs._charmedSupportLocked) gs._charmedSupportLocked = [];
  gs._charmedSupportLocked.push({ owner: oi, heroIdx: sel.heroIdx });

  engine.log('charme_control', {
    player: gs.players[pi].username, hero: hero.name,
    target: targetHero.name, targetOwner: ops.username,
  });

  engine._broadcastEvent('play_zone_animation', {
    type: 'heal_sparkle', owner: oi, heroIdx: sel.heroIdx, zoneSlot: -1,
  });

  engine.sync();
  return true;
}
