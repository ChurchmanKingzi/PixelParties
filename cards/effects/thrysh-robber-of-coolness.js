// ═══════════════════════════════════════════
//  CREATURE: "Thrysh, Robber of Coolness"
//  Lvl 2 base, 100 HP. Level (in hand and on the
//  board) is reduced by the size of your Coolness
//  Stack.
//
//  Once per turn (per Thrysh): search your deck OR
//  Coolness Stack for an Equip Artifact that can be
//  played from the top of your Coolness Stack, and
//  equip it.
//   • Deck pick: equip lands directly on a chosen
//     Hero/Zone — no Stack visit.
//   • Stack pick (anywhere in the Stack): splice it
//     to the top, then trigger its normal Stack
//     resolver.
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Thrysh, Robber of Coolness';
const HOPT_KEY  = 'thryshRobbedThisTurn';

/**
 * Collect deck + Stack Equip Artifacts that declare
 * `playableFromCoolnessStack`. Per the user's design intent the
 * "search for an Artifact" is narrowed to Equip-Artifacts only — the
 * only Artifacts in the set that satisfy this filter today are
 * Modnir/Swellpnir.
 */
function _collectCandidates(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const cardDB = engine._getCardDB();
  const out = [];
  const isPlayable = (name) => {
    const cd = cardDB[name];
    if (cd?.cardType !== 'Artifact') return false;
    const script = loadCardEffect(name);
    return script?.isEquip === true && script?.playableFromCoolnessStack === true;
  };
  // Per-source dedup so the player gets one entry per distinct name
  // per source. A name in BOTH deck AND Stack must surface both
  // entries — they play differently (deck = direct equip, Stack =
  // pop the Stack first), so the player picks intentionally.
  const deckSeen = new Set();
  for (const name of (ps.mainDeck || [])) {
    if (!deckSeen.has(name) && isPlayable(name)) { deckSeen.add(name); out.push({ name, source: 'deck' }); }
  }
  const stackSeen = new Set();
  // Anywhere in the Stack — not just the top. Lower picks get
  // spliced to the top before resolving (see Stack path below).
  for (const name of (ps.coolnessStack || [])) {
    if (!stackSeen.has(name) && isPlayable(name)) { stackSeen.add(name); out.push({ name, source: 'stack' }); }
  }
  return out;
}

/**
 * Owned Heroes that are alive and NOT Frozen and have at least one
 * free Support Zone, plus each free Zone as its own clickable
 * target. Mirrors the shape used by Modnir/Swellpnir's own resolvers
 * so the picker UX is identical.
 */
function _buildEquipTargets(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const targets = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    if (hero.statuses?.frozen) continue;
    const slots = ps.supportZones?.[hi] || [];
    let leftmostFree = -1;
    for (let si = 0; si < slots.length; si++) {
      if (!slots[si] || slots[si].length === 0) {
        if (leftmostFree < 0) leftmostFree = si;
        targets.push({
          id: `equip-${pi}-${hi}-${si}`,
          type: 'equip',
          owner: pi, heroIdx: hi, slotIdx: si,
          cardName: '',
        });
      }
    }
    if (leftmostFree >= 0) {
      targets.push({
        id: `hero-${pi}-${hi}`,
        type: 'hero',
        owner: pi, heroIdx: hi,
        cardName: hero.name,
        _autoSlot: leftmostFree,
      });
    }
  }
  return targets;
}

module.exports = {
  activeIn: ['support', 'hand'],
  // Creatures with active effects use the `creatureEffect` API, NOT
  // the Ability `actionCost` flag — without this the engine never
  // surfaces an activate button on the board.
  creatureEffect: true,
  requiresTarget: true,

  /**
   * Engine reads `reduceCardLevel` to recompute the effective level
   * for gate-checks (hand level filter and board summon checks).
   */
  reduceCardLevel(cardData, engine, ownerIdx /* , inst */) {
    if (cardData?.name !== CARD_NAME) return 0;
    const size = engine.gs.players[ownerIdx]?.coolnessStack?.length || 0;
    return size;
  },

  canActivateCreatureEffect(ctx) {
    if (ctx.card?.counters?.[HOPT_KEY] === ctx._engine.gs.turn) return false;
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    if (_collectCandidates(engine, pi).length === 0) return false;
    // No equip-able destination → can't equip anywhere → block
    // activation entirely. Per the user's spec: dead/Frozen-only
    // Heroes or no-free-zones means Thrysh can't fire.
    if (_buildEquipTargets(engine, pi).length === 0) return false;
    return true;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    if (ctx.card?.counters?.[HOPT_KEY] === engine.gs.turn) return false;
    const ps = engine.gs.players[pi];

    const candidates = _collectCandidates(engine, pi);
    if (candidates.length === 0) return false;
    const equipTargets = _buildEquipTargets(engine, pi);
    if (equipTargets.length === 0) return false;

    // ── Stage 1: pick which Equip to rob ──
    const choice = await engine.promptGeneric(pi, {
      type: 'cardGallery', cards: candidates,
      title: CARD_NAME,
      description: 'Choose an Equip Artifact to play from your Deck or Coolness Stack.',
      confirmLabel: '🎒 Rob!',
      confirmClass: 'btn-info',
      cancellable: true,
    });
    if (!choice?.cardName) return false;
    // Match BOTH name AND source — the same card can appear in deck
    // AND on the Stack, and the gallery passes back which one the
    // player clicked. Without the source check, `find` always
    // returned the first candidate (deck) regardless of which copy
    // was selected, so a Stack pick wrongly equipped from the deck.
    const picked = candidates.find(c => c.name === choice.cardName && c.source === choice.source)
                || candidates.find(c => c.name === choice.cardName);
    if (!picked) return false;

    // ── Stage 2: pick equip target (unified for deck and Stack) ──
    const pick = await engine.promptEffectTarget(pi, equipTargets, {
      title: choice.cardName,
      description: 'Equip to a Hero (auto-leftmost-free) or click a specific empty Support Zone.',
      confirmLabel: '⚔️ Equip',
      confirmClass: 'btn-success',
      cancellable: true,
      exclusiveTypes: true,
      maxPerType: { hero: 1, equip: 1 },
    });
    if (!pick || pick.length === 0) return false;
    const sel = equipTargets.find(t => t.id === pick[0]);
    if (!sel) return false;

    const heroIdx = sel.heroIdx;
    const slotIdx = sel.type === 'hero' ? sel._autoSlot : sel.slotIdx;

    // ── Commit HOPT — both prompts confirmed. ──
    // Cancelling either prompt above bails out before this line, so
    // a cancel never burns Thrysh's once-per-turn slot.
    if (!ctx.card.counters) ctx.card.counters = {};
    ctx.card.counters[HOPT_KEY] = engine.gs.turn;

    // ── Stage 3: remove from source + animate from source ──
    // Both paths feed into the same placement+hooks block below; the
    // only difference is what we strip from (deck array vs. Stack
    // array + inst untrack + Stack-pop broadcast).
    let flySource;
    let stackInstId = null;
    if (picked.source === 'deck') {
      const deckIdx = ps.mainDeck.indexOf(choice.cardName);
      if (deckIdx < 0) return false;
      ps.mainDeck.splice(deckIdx, 1);
      flySource = undefined; // omitted → 'attach_hero_fly' uses deck pile
    } else {
      // Stack pick — splice ANY occurrence by name; the inst we
      // untrack has to be one in the COOLNESS_STACK zone, but
      // because all copies of the same name are functionally
      // equivalent, popping any of them keeps the Stack consistent
      // with the array.
      const stIdx = ps.coolnessStack.lastIndexOf(choice.cardName);
      if (stIdx < 0) return false;
      ps.coolnessStack.splice(stIdx, 1);
      const insts = engine.findCards({ owner: pi, zone: 'coolnessStack', name: choice.cardName });
      const stackInst = insts[insts.length - 1] || null;
      if (stackInst) {
        stackInstId = stackInst.id;
        engine._untrackCard(stackInst.id);
      }
      // Tell the client to decrement the Stack's hidden-mask counter
      // synchronously with the next sync — same dest='board'
      // semantics actionPopCoolnessStackTo uses.
      engine._broadcastEvent('coolness_stack_change', {
        owner: pi, mode: 'pop', card: choice.cardName, dest: 'board',
      });
      flySource = 'coolnessStack';
    }

    engine._broadcastEvent('attach_hero_fly', {
      ownerIdx: pi, source: flySource, cardName: choice.cardName,
      destOwner: pi, destHeroIdx: heroIdx, destZoneSlot: slotIdx,
    });
    await engine._delay(620);

    // ── Stage 4: place in support + lifecycle hooks ──
    const placed = engine.safePlaceInSupport(choice.cardName, pi, heroIdx, slotIdx);
    if (!placed?.inst) return false;
    placed.inst.zone = 'support';
    engine.log('thrysh_equip', {
      player: ps.username, card: choice.cardName,
      from: picked.source,
      hero: ps.heroes?.[heroIdx]?.name, slot: placed.actualSlot,
    });
    engine.sync();

    if (picked.source === 'stack') {
      // Stack-source needs the standard leave-zone hook so anything
      // listening for cards leaving the Stack (Hipdall recovery,
      // …) fires. Deck path skips this — the deck isn't tracked.
      await engine.runHooks('onCardLeaveZone', {
        card: { id: stackInstId, name: choice.cardName },
        cardName: choice.cardName,
        fromZone: 'coolnessStack', fromOwner: pi, toZone: 'support',
      });
    }
    await engine.runHooks('onPlay', {
      _onlyCard: placed.inst,
      playedCard: placed.inst, cardName: choice.cardName,
      zone: 'support', heroIdx, zoneSlot: placed.actualSlot,
      _skipReactionCheck: true,
    });
    await engine.runHooks('onCardEnterZone', {
      enteringCard: placed.inst, cardName: choice.cardName,
      toZone: 'support', toOwner: pi, toHeroIdx: heroIdx,
      fromZone: picked.source === 'deck' ? 'mainDeck' : 'coolnessStack',
    });
    return true;
  },
};
