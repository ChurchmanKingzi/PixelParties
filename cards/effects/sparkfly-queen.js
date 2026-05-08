// ═══════════════════════════════════════════
//  CARD EFFECT: "Sparkfly Queen"
//  Creature (Summoning Magic, Lv 3, Sparkfly) — 150 HP
//
//  • You can only control 1 "Sparkfly Queen". Cannot be summoned
//    except by the effect of "Hive's Crown" — gated by `canSummon`,
//    which only allows the placement when the engine is mid-resolve
//    of Hive's Crown (it stamps `gs._hivesCrownActive`).
//
//  • Activated effect (creatureEffect, free, multi-mode):
//
//    – MAIN: declare a card-type bucket and make your opponent
//      choose N cards of that type from their deck (or potion deck,
//      for "Potion") and add them to your hand. N = number of
//      "Sparkfly" Creatures you control.
//
//      Buckets:
//        • Attack/Spell/Creature  (combined — covers all three types)
//        • Ability
//        • Artifact
//        • Potion                 (drawn from potionDeck)
//        • Hero                   (covers "Hero" and "Ascended Hero")
//
//      Each card added this way is tagged with `originalOwner = oppIdx`
//      so when it leaves the thief's hand it routes back to the
//      original side's discard / deleted / deck pile (Magic Lamp
//      pattern). Attacks, Spells AND Creatures additionally get a -3
//      hand-level offset via the engine's generic `_handLevelOffsets`
//      map, pinned to the Queen's host hero through the sibling
//      filter map `_handLevelOffsetHeroFilter` — only that hero may
//      use the card at reduced level ("the corresponding Hero" per
//      card text). Ability / Artifact / Potion / Hero buckets do NOT
//      get the rebate. The filter persists even if the Queen later
//      leaves play; the reduction expires the moment the card itself
//      leaves the hand (the splice rebases both maps in lockstep).
//      Once-per-turn per Queen instance.
//
//    – ARCHITECT GIFT (granted by sacrificing Sparkfly Architect):
//      Once per turn, draw cards until your hand size matches the
//      opponent's.
//
//    – WORKER GIFT (granted by sacrificing Sparkfly Worker): once
//      per turn, the OPPONENT picks any non-Hero card on their side
//      of the board and adds it to your hand.
//
//    – ATTENDANT GIFT (granted by sacrificing Sparkfly Attendant):
//      passive — the Queen carries `_cardinalImmune` for the rest of
//      its life. Stamped by `grantInheritedAbility` at place time;
//      this file doesn't activate it.
//
//  Modes share the same `creatureEffect` slot but each has its own
//  per-instance HOPT counter, so a Queen with all three gifts can
//  fire all of MAIN + ARCHITECT + WORKER on the same turn (each
//  used once). The engine's global creature-effect HOPT is opted out
//  via `ctx._skipCreatureEffectHopt = true` whenever an unused mode
//  remains; on the final mode the engine claims it normally so the
//  activation UI greys out for the rest of the turn.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const {
  QUEEN_NAME,
  SPARKFLY_NAMES,
  collectNonHeroBoardTargets,
  stealBoardCardToHand,
} = require('./_sparkfly-shared');

const CARD_NAME = QUEEN_NAME;

const TYPE_BUCKETS = [
  { id: 'attack-spell-creature', label: 'Attack / Spell / Creature',
    matches: cd => ['Attack', 'Spell', 'Creature'].includes(cd?.cardType),
    deck: 'main' },
  { id: 'ability',  label: 'Ability',  matches: cd => cd?.cardType === 'Ability',  deck: 'main' },
  { id: 'artifact', label: 'Artifact', matches: cd => cd?.cardType === 'Artifact', deck: 'main' },
  { id: 'potion',   label: 'Potion',   matches: cd => cd?.cardType === 'Potion',   deck: 'potion' },
  { id: 'hero',     label: 'Hero',     matches: cd => cd?.cardType === 'Hero' || cd?.cardType === 'Ascended Hero', deck: 'main' },
];

/**
 * Per-instance per-mode HOPT helpers. Stored on `inst.counters._sparkflyQueenModeUsed`
 * with values equal to the turn number on which each mode last fired.
 */
function isModeUsed(inst, mode, turn) {
  return inst?.counters?._sparkflyQueenModeUsed?.[mode] === turn;
}
function markModeUsed(inst, mode, turn) {
  if (!inst.counters._sparkflyQueenModeUsed) inst.counters._sparkflyQueenModeUsed = {};
  inst.counters._sparkflyQueenModeUsed[mode] = turn;
}

/**
 * Count "Sparkfly" Creatures the player controls (Queen included —
 * matches the natural read of "as many as you control").
 */
function countSparkflies(engine, pi) {
  let n = 0;
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if (!SPARKFLY_NAMES.includes(inst.name)) continue;
    if ((inst.controller ?? inst.owner) !== pi) continue;
    n++;
  }
  return n;
}

module.exports = {
  activeIn: ['support'],

  /**
   * CPU response handlers for the Queen's prompts. Two prompts to
   * cover when the CPU is the OPP being squeezed by the player's Queen:
   *   • cardGalleryMulti — opp picks N cards from their deck to give
   *     the player. Pick the LOWEST-cost / lowest-archetype-value names
   *     so the CPU surrenders its weakest cards first.
   *   • promptEffectTarget (Worker gift) — opp picks a non-Hero card
   *     on their side to surrender. Prefer high-cost / high-archetype
   *     value — wait, no: opp WANTS to keep their best, so surrender
   *     the LEAST valuable.
   *
   * When the CPU is the active player using the Queen:
   *   • optionPicker for mode — pick the first available (default brain
   *     already does this, but make it explicit for the type bucket
   *     picker too, which we want to drive based on opp's deck).
   *   • optionPicker for type bucket — pick the bucket where opp has
   *     the most matching deck cards (= biggest forced give-up).
   */
  cpuResponse(engine, kind, promptData) {
    // Worker-gift target prompt: CPU is the opp being asked to give up
    // a non-Hero card on their side. Surrender the LEAST valuable
    // (lowest-cost) target so the CPU keeps its better pieces.
    if (kind === 'target') {
      const { validTargets, config } = promptData || {};
      if (!Array.isArray(validTargets) || validTargets.length === 0) return undefined;
      if (!config?.title || config.title !== CARD_NAME) return undefined;
      const cardDB = engine._getCardDB();
      let pickId = null; let pickScore = Infinity;
      for (const t of validTargets) {
        const cd = cardDB[t.cardName];
        const cost = cd?.cost || 0;
        const lvl  = cd?.level || 0;
        const hp   = t._cardInstance?.counters?.currentHp || cd?.hp || 0;
        const score = cost * 100 + lvl * 10 + hp / 100;
        if (score < pickScore) { pickScore = score; pickId = t.id; }
      }
      return pickId ? [pickId] : undefined;
    }

    if (kind !== 'generic') return undefined;
    if (promptData?.title !== CARD_NAME) return undefined;
    const cpuIdx = engine._cpuPlayerIdx;

    // Mode picker — default (pick first) is already correct (MAIN if
    // available, else first gift). No override needed.

    // Type bucket picker — pick the bucket maximizing opp's deck matches.
    if (promptData.type === 'optionPicker'
        && (promptData.title === CARD_NAME + ' — Declare a Type')) {
      const options = promptData.options || [];
      if (options.length === 0) return undefined;
      const oi = cpuIdx === 0 ? 1 : 0;
      const oppPs = engine.gs.players?.[oi];
      if (!oppPs) return { optionId: options[0].id };
      const cardDB = engine._getCardDB();
      let best = options[0]; let bestN = -1;
      for (const opt of options) {
        const bucket = TYPE_BUCKETS.find(b => b.id === opt.id);
        if (!bucket) continue;
        const pile = bucket.deck === 'potion' ? (oppPs.potionDeck || []) : (oppPs.mainDeck || []);
        let n = 0;
        for (const name of pile) {
          const cd = cardDB[name];
          if (cd && bucket.matches(cd)) n++;
        }
        if (n > bestN) { bestN = n; best = opt; }
      }
      return { optionId: best.id };
    }

    // Card-gallery-multi — when CPU is the OPP being asked to give cards.
    if (promptData.type === 'cardGalleryMulti') {
      const cards = promptData.cards || [];
      const need = promptData.minSelect || promptData.selectCount || 0;
      if (cards.length === 0 || need === 0) return { selectedCards: [] };
      const cardDB = engine._getCardDB();
      // Score: prefer to surrender LOW-cost / LOW-level cards first.
      const scored = cards.map(c => {
        const cd = cardDB[c.name];
        const cost = cd?.cost || 0;
        const lvl  = cd?.level || 0;
        return { name: c.name, count: c.count || 1, score: cost * 10 + lvl };
      }).sort((a, b) => a.score - b.score);
      const out = [];
      for (const s of scored) {
        for (let k = 0; k < s.count && out.length < need; k++) out.push(s.name);
        if (out.length >= need) break;
      }
      return { selectedCards: out };
    }

    return undefined;
  },

  /**
   * Block all summon paths except Hive's Crown's resolve. Hive's Crown
   * stamps `gs._hivesCrownActive = true` around its `actionPlaceCreature`
   * call so the placement-side hooks (which also pass through this gate
   * indirectly via `isCreatureSummonable`) accept it.
   *
   * Also enforce the "you can only control 1" clause defensively here
   * — Hive's Crown's canActivate already blocks playing the artifact
   * while a Queen is alive, but a future tutor or a desync could try
   * to summon a second; refusing here keeps the invariant.
   */
  canSummon(ctx) {
    const engine = ctx._engine;
    if (!engine) return false;
    if (!engine.gs?._hivesCrownActive) return false;
    const pi = ctx.cardOwner;
    for (const inst of engine.cardInstances) {
      if (inst.zone !== 'support') continue;
      if (inst.name !== QUEEN_NAME) continue;
      if ((inst.controller ?? inst.owner) !== pi) continue;
      return false; // already controlling one
    }
    return true;
  },

  // ── Activated multi-mode effect ───────────────────────────────────
  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    const turn = ctx._engine.gs.turn || 0;
    const inst = ctx.card;
    const gifts = inst?.counters?._sparkflyGifts || {};
    // MAIN mode is always available (subject to per-mode HOPT). Gifts
    // require their respective tags. Any unused mode → activatable.
    if (!isModeUsed(inst, 'main', turn)) return true;
    if (gifts.architect && !isModeUsed(inst, 'architect', turn)) return true;
    if (gifts.worker    && !isModeUsed(inst, 'worker',    turn)) return true;
    return false;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs     = engine.gs;
    const turn   = gs.turn || 0;
    const pi     = ctx.cardOwner;
    const oi     = pi === 0 ? 1 : 0;
    const inst   = ctx.card;
    const gifts  = inst?.counters?._sparkflyGifts || {};

    // Build the mode picker — only show modes still unused this turn.
    const modeOptions = [];
    if (!isModeUsed(inst, 'main', turn)) {
      modeOptions.push({ id: 'main', label: '👑  Declare a card type' });
    }
    if (gifts.architect && !isModeUsed(inst, 'architect', turn)) {
      modeOptions.push({ id: 'architect', label: '✏️  Architect gift: draw to opponent\'s hand size' });
    }
    if (gifts.worker && !isModeUsed(inst, 'worker', turn)) {
      modeOptions.push({ id: 'worker', label: '🪲  Worker gift: opponent picks a non-Hero card → your hand' });
    }
    if (modeOptions.length === 0) return false;

    let chosenMode;
    if (modeOptions.length === 1) {
      chosenMode = modeOptions[0].id;
    } else {
      const choice = await engine.promptGeneric(pi, {
        type: 'optionPicker',
        title: CARD_NAME,
        description: 'Which effect of Sparkfly Queen do you want to use?',
        options: modeOptions,
        cancellable: true,
      });
      if (!choice || choice.cancelled || !choice.optionId) return false;
      chosenMode = choice.optionId;
    }

    // Track whether ANY mode actually committed this activation, so we
    // can opt out of the engine's global HOPT when we still have other
    // modes unused after this run.
    let resolvedSomething = false;
    if (chosenMode === 'main') {
      resolvedSomething = await runMainEffect(ctx, engine, gs, pi, oi, inst);
      if (resolvedSomething) markModeUsed(inst, 'main', turn);
    } else if (chosenMode === 'architect') {
      resolvedSomething = await runArchitectGift(ctx, engine, gs, pi, oi);
      if (resolvedSomething) markModeUsed(inst, 'architect', turn);
    } else if (chosenMode === 'worker') {
      resolvedSomething = await runWorkerGift(ctx, engine, gs, pi, oi);
      if (resolvedSomething) markModeUsed(inst, 'worker', turn);
    }

    if (!resolvedSomething) {
      // The mode was picked but cancelled mid-flow — don't burn the
      // engine HOPT (allow re-activation this turn).
      ctx._skipCreatureEffectHopt = true;
      return false;
    }

    // After this run, are there modes still unused? If so, opt out of
    // the global creature-effect HOPT so the player can fire another
    // mode this turn.
    const stillAnyUnused =
      !isModeUsed(inst, 'main', turn)
      || (gifts.architect && !isModeUsed(inst, 'architect', turn))
      || (gifts.worker    && !isModeUsed(inst, 'worker',    turn));
    if (stillAnyUnused) ctx._skipCreatureEffectHopt = true;

    return true;
  },

  hooks: {
    onTurnStart: (ctx) => {
      // Reset per-instance per-mode HOPT counters for THIS Queen.
      const inst = ctx.card;
      if (inst?.counters?._sparkflyQueenModeUsed) {
        inst.counters._sparkflyQueenModeUsed = {};
      }
    },
  },
};

// ═══════════════════════════════════════════
//  MODE: MAIN — declare a type, opp picks N cards from their deck.
// ═══════════════════════════════════════════
async function runMainEffect(ctx, engine, gs, pi, oi, inst) {
  const ps = gs.players[pi];
  const oppPs = gs.players[oi];
  if (!ps || !oppPs) return false;

  // 1) Pick a bucket.
  const choice = await engine.promptGeneric(pi, {
    type: 'optionPicker',
    title: CARD_NAME + ' — Declare a Type',
    description: `Make your opponent reveal cards of one type. They will pick ${countSparkflies(engine, pi)} from their deck.`,
    options: TYPE_BUCKETS.map(b => ({ id: b.id, label: b.label })),
    cancellable: true,
  });
  if (!choice || choice.cancelled || !choice.optionId) return false;
  const bucket = TYPE_BUCKETS.find(b => b.id === choice.optionId);
  if (!bucket) return false;

  // 2) Filter opp's deck (main vs potion) by the bucket.
  const cardDB = engine._getCardDB();
  const sourcePile = bucket.deck === 'potion' ? (oppPs.potionDeck || []) : (oppPs.mainDeck || []);
  const matchingNames = [];
  for (const name of sourcePile) {
    const cd = cardDB[name];
    if (!cd) continue;
    if (!bucket.matches(cd)) continue;
    matchingNames.push(name);
  }

  const N = countSparkflies(engine, pi);
  const pickCount = Math.min(N, matchingNames.length);
  if (pickCount === 0) {
    engine.log('sparkfly_queen_no_match', {
      player: ps.username, type: bucket.label, deck: bucket.deck,
    });
    engine.sync();
    return true; // The mode still resolved (player committed) — burn the per-mode HOPT.
  }

  // 3) Build a deduped gallery for the opponent's picker. Show cardName
  //    + repeat-count so the opp sees if they have multiples.
  const counts = {};
  for (const n of matchingNames) counts[n] = (counts[n] || 0) + 1;
  const gallery = Object.keys(counts)
    .sort((a, b) => a.localeCompare(b))
    .map(name => ({ name, source: bucket.deck === 'potion' ? 'potion' : 'deck', count: counts[name] }));

  // Reveal Queen / declared type to opponent.
  const oppSid = oppPs.socketId;
  if (oppSid && engine.io) {
    engine.io.to(oppSid).emit('card_reveal', { cardName: CARD_NAME });
  }
  await engine._delay(200);

  // 4) Opponent must pick `pickCount` (different copies — duplicates allowed
  //    via `allowDuplicates: true` since the same name may appear N times
  //    in their deck and the rules text doesn't restrict to "different").
  const oppResult = await engine.promptGeneric(oi, {
    type: 'cardGalleryMulti',
    cards: gallery,
    selectCount: pickCount,
    minSelect: pickCount,
    title: CARD_NAME,
    description: `Choose ${pickCount} ${bucket.label} card${pickCount > 1 ? 's' : ''} from your ${bucket.deck === 'potion' ? 'Potion ' : ''}deck. They will be added to your opponent's hand.`,
    confirmLabel: '📤 Hand over',
    confirmClass: 'btn-warning',
    cancellable: false,
    allowDuplicates: true,
  });

  // Validate picks against the offered list — defensive against desync.
  // Each pick must come from the available copies pool (we track remaining
  // counts as we accept names, so picking the same name twice is only
  // allowed up to the available copies in opp's deck).
  const remaining = { ...counts };
  const accepted = [];
  for (const name of (oppResult?.selectedCards || [])) {
    if (typeof name !== 'string') continue;
    if ((remaining[name] || 0) <= 0) continue;
    remaining[name]--;
    accepted.push(name);
    if (accepted.length >= pickCount) break;
  }
  // Backfill if the opp returned fewer than pickCount — pull leftmost
  // available names so the effect isn't silently shortchanged on a
  // misbehaving client.
  while (accepted.length < pickCount) {
    const next = Object.entries(remaining).find(([, c]) => c > 0);
    if (!next) break;
    accepted.push(next[0]);
    remaining[next[0]]--;
  }

  // 5) Move accepted cards from opp's deck → player's hand. Tag each
  //    instance with originalOwner = oi for reverse-routing on leave.
  //    For Attack/Spell/Creature, stamp -3 in the player's TRANSIENT
  //    hand-level-offset map (dies the moment the card leaves the
  //    hand — including being summoned to the board, per card text:
  //    "may use ... as if their levels were reduced by 3" only while
  //    held in hand). Pinned to the Queen's host hero via the parallel
  //    filter map — "the corresponding Hero" per card text.
  if (!ps._handLevelOffsetsTransient) ps._handLevelOffsetsTransient = {};
  if (!ps._handLevelOffsetHeroFilter) ps._handLevelOffsetHeroFilter = {};
  const queenHostHeroIdx = inst.heroIdx;

  for (const name of accepted) {
    const sourceArr = bucket.deck === 'potion' ? oppPs.potionDeck : oppPs.mainDeck;
    const srcIdx = sourceArr.indexOf(name);
    if (srcIdx < 0) continue; // race — already gone
    sourceArr.splice(srcIdx, 1);
    ps.hand.push(name);
    const newHandIdx = ps.hand.length - 1;

    const newInst = engine._trackCard(name, pi, 'hand');
    newInst.originalOwner = oi;

    // -3 transient level offset on Attack / Spell / Creature (per
    // card text), pinned to the Queen's host hero via the parallel
    // filter map. The TRANSIENT map evaporates on splice — so the
    // moment the card is played / discarded / summoned, the offset
    // disappears (no carry onto the support instance the way Rocky
    // Slime's persistent offsets behave). Other declarable types
    // (Ability, Artifact, Potion, Hero) are excluded from the rebate
    // by the rules text.
    const cd = cardDB[name];
    if (cd && (cd.cardType === 'Attack' || cd.cardType === 'Spell' || cd.cardType === 'Creature') && (cd.level || 0) > 0) {
      ps._handLevelOffsetsTransient[newHandIdx] = -3;
      ps._handLevelOffsetHeroFilter[newHandIdx] = queenHostHeroIdx;
    }

    // Cross-player flight animation: card flies from the OPPONENT'S
    // deck pile (main vs potion picks the pile selector) into the
    // CASTER'S hand. `play_pile_transfer` with separate fromOwner /
    // toOwner is what makes this paint cross-side rather than the
    // default "from receiver's hand" auto-detect would do.
    engine._broadcastEvent('play_pile_transfer', {
      fromOwner: oi,
      toOwner: pi,
      cardName: name,
      from: bucket.deck === 'potion' ? 'potionDeck' : 'deck',
      to: 'hand',
      toHandIdx: newHandIdx,
    });
    engine.log('sparkfly_queen_steal', {
      player: ps.username, fromOpp: oppPs.username, card: name,
    });
    await engine.runHooks('onCardAddedToHand', {
      playerIdx: pi, card: newInst, cardName: name,
      source: CARD_NAME, _skipReactionCheck: true,
    });
    engine.sync();
    await engine._delay(200);
  }

  if (bucket.deck === 'potion') engine.shuffleDeck(oi, 'potion');
  else engine.shuffleDeck(oi, 'main');

  engine.sync();
  return true;
}

// ═══════════════════════════════════════════
//  MODE: ARCHITECT GIFT — draw to opponent's hand size.
// ═══════════════════════════════════════════
async function runArchitectGift(ctx, engine, gs, pi, oi) {
  const ps    = gs.players[pi];
  const oppPs = gs.players[oi];
  if (!ps || !oppPs) return false;

  const myHand = (ps.hand || []).length;
  const oppHand = (oppPs.hand || []).length;
  const need = Math.max(0, oppHand - myHand);
  if (need === 0) {
    engine.log('sparkfly_queen_architect_skip', {
      player: ps.username, myHand, oppHand,
    });
    engine.sync();
    return true; // Mode resolved (player committed) — burn the HOPT.
  }

  // Draw clamped to actual deck size; actionDrawCards already handles
  // hand-lock / mill-out gracefully.
  const drawn = await engine.actionDrawCards(pi, need, { source: CARD_NAME });
  engine.log('sparkfly_queen_architect_draw', {
    player: ps.username, drew: drawn?.length || 0, target: oppHand,
  });
  engine.sync();
  return true;
}

// ═══════════════════════════════════════════
//  MODE: WORKER GIFT — opponent picks a non-Hero card on their side.
// ═══════════════════════════════════════════
async function runWorkerGift(ctx, engine, gs, pi, oi) {
  const ps    = gs.players[pi];
  const oppPs = gs.players[oi];
  if (!ps || !oppPs) return false;

  // Build the target list from opp's side only.
  const allTargets = collectNonHeroBoardTargets(gs, engine);
  const oppTargets = allTargets.filter(t => t.owner === oi);
  if (oppTargets.length === 0) {
    engine.log('sparkfly_queen_worker_skip', {
      player: ps.username, reason: 'no_targets',
    });
    engine.sync();
    return true; // Mode resolved (player committed) — burn the HOPT.
  }

  // Reveal Queen to opponent.
  const oppSid = oppPs.socketId;
  if (oppSid && engine.io) {
    engine.io.to(oppSid).emit('card_reveal', { cardName: CARD_NAME });
  }
  await engine._delay(200);

  // Opponent MUST pick (non-cancellable).
  const picked = await engine.promptEffectTarget(oi, oppTargets, {
    title: CARD_NAME,
    description: 'Choose any non-Hero card on YOUR side of the board. It will move to your opponent\'s hand.',
    confirmLabel: '📤 Surrender',
    confirmClass: 'btn-warning',
    cancellable: false,
    exclusiveTypes: true,
    maxPerType: { equip: 1, ability: 1, perm: 1, area: 1, surprise: 1 },
  });
  if (!picked || picked.length === 0) {
    // Forced prompt with no pick — pick the first target as fallback
    // so the effect doesn't fizzle on a misbehaving client.
    const sel = oppTargets[0];
    if (!sel?._cardInstance) return false;
    await stealBoardCardToHand(engine, pi, sel._cardInstance, CARD_NAME);
    return true;
  }

  const sel = oppTargets.find(t => t.id === picked[0]);
  if (!sel?._cardInstance) {
    // Defensive: opponent picked something off-list — fallback.
    const fb = oppTargets[0];
    if (fb?._cardInstance) await stealBoardCardToHand(engine, pi, fb._cardInstance, CARD_NAME);
    return true;
  }

  await stealBoardCardToHand(engine, pi, sel._cardInstance, CARD_NAME);
  return true;
}
