// ═══════════════════════════════════════════
//  PIXEL PARTIES — CPU OPPONENT BRAIN
//  Drives the CPU player's turn in Singleplayer mode.
//  Puzzle mode does NOT use this module.
// ═══════════════════════════════════════════
//
// Sub-phase 2a: Attach Abilities only (random eligible Hero).
// Later sub-phases add Artifacts, Potions, Surprises, Creatures/Spells/Attacks,
// active effects, Ascension, and the targeting engine.

const { loadCardEffect } = require('./_loader');
const { PHASES } = require('./_hooks');

// Small pauses between CPU actions / phase advances so a human spectator
// can actually follow the sequence. Kept deliberately modest — longer
// values make the CPU feel sluggish on complex decks.
const PAUSE_BETWEEN_ACTIONS = 600;
const PAUSE_BETWEEN_PHASES = 450;
// Delay for each CPU prompt decision during card resolution (targeting, picks,
// confirms). Puzzle mode keeps the original 50ms via the original prompt path.
const CPU_PROMPT_DELAY = 350;

// Set to false when the CPU is stable. Keep verbose while we're still shaking
// out freeze bugs — every major decision point logs so a hang can be traced.
const CPU_DEBUG = true;
// Silenced during MCTS rollouts so the rollout's MainPhase/ActionPhase chatter
// doesn't drown out the real turn's log. Toggled by mctsRunOneRollout.
let _cpuLogSilent = false;
// Externally controllable verbose toggle. DEFAULT OFF so live CPU-vs-human
// games don't spam stdout on tester builds. Console-fired test tools
// (self-play batches, A/B runs) can enable it explicitly via setCpuVerbose
// when they want per-decision traces.
let _cpuVerbose = false;
// Optional transcription function. When set, cpuLog calls it INSTEAD of
// console.log, regardless of _cpuVerbose. Used by self-play to capture
// detailed decision traces for a subset of games without flooding stdout.
// _cpuLogSilent (inner-rollout silencing) still applies, so transcripts
// show real-turn decisions only, not the per-rollout chatter.
let _cpuTranscribeFn = null;
function cpuLog(...args) {
  if (!CPU_DEBUG || _cpuLogSilent) return;
  if (_cpuTranscribeFn) {
    try { _cpuTranscribeFn(args.join(' ')); } catch {}
    return;
  }
  if (!_cpuVerbose) return;
  console.log('[CPU]', ...args);
}
function setCpuVerbose(v) { _cpuVerbose = !!v; }
function getCpuVerbose() { return _cpuVerbose; }
function setCpuTranscribeFn(fn) { _cpuTranscribeFn = typeof fn === 'function' ? fn : null; }

// Legacy module-level delay — kept for any stray callers. Brain functions
// should use engine._delay(ms) so MCTS fast-mode silences every pause.
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function pauseAction(engine) { return engine._delay(PAUSE_BETWEEN_ACTIONS); }
function pausePhase(engine) { return engine._delay(PAUSE_BETWEEN_PHASES); }
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function stillCpuTurn(engine, cpuIdx) {
  return !engine.gs.result && engine.gs.activePlayer === cpuIdx;
}

/**
 * True when the CPU's current turn is gated by Flashbang — the first
 * Action they perform will end the turn immediately.
 *
 * The brain uses this to disincentivise inherent / additional / hero-
 * effect plays in Main Phase 1, saving the one available Action for
 * Action Phase (widest card pool, highest impact, "as late as
 * possible"). The flag is set on the affected player's state by
 * Flashbang's resolve(), persists through onTurnStart, and clears
 * either when an Action consumes the trigger or when the turn ends
 * unused.
 */
function isCpuFlashbanged(engine) {
  const cpuIdx = engine._cpuPlayerIdx;
  if (cpuIdx < 0) return false;
  return !!engine.gs.players[cpuIdx]?._flashbangedDebuff;
}

function broadcast(helpers) {
  for (let p = 0; p < 2; p++) helpers.sendGameState(helpers.room, p);
  if (helpers.sendSpectatorGameState) helpers.sendSpectatorGameState(helpers.room);
}

/**
 * Entry point. Called from the engine's _cpuDriver hook after the CPU's Start
 * and Resource phases have auto-advanced us into Main Phase 1.
 *
 * Phase sequence: Main1 → Action → Main2 → End.
 * advancePhase transitions one phase at a time, so skipping the Action Phase
 * still requires two calls (Main1→Action, then Action→Main2).
 */
async function runCpuTurn(engine, helpers) {
  const cpuIdx = engine._cpuPlayerIdx;
  const gs = engine.gs;
  const ps = gs.players[cpuIdx];
  if (!stillCpuTurn(engine, cpuIdx)) return;
  // Stash helpers on the engine so card-script-level MCTS picks
  // (mctsPickFromOptions, …) can reuse them for rollouts without
  // re-plumbing helper construction.
  engine._cpuHelpers = helpers;

  const turnStartT = Date.now();
  cpuLog(`===== TURN START turn=${gs.turn} phase=${gs.currentPhase} hand=${ps.hand.length} gold=${ps.gold} fast=${!!engine._fastMode} =====`);
  cpuLog('hand:', ps.hand);

  cpuLog('→ Main Phase 1');
  await runMainPhase(engine, helpers);
  cpuLog('← Main Phase 1 done');

  if (!stillCpuTurn(engine, cpuIdx)) return;
  await pausePhase(engine);
  cpuLog(`advancePhase Main1→Action`);
  await engine.advancePhase(cpuIdx);
  broadcast(helpers);

  if (!stillCpuTurn(engine, cpuIdx)) return;
  cpuLog(`→ Action Phase (currentPhase=${gs.currentPhase})`);
  await runActionPhase(engine, helpers);

  // Combo continuation: if an action left the phase open (Ghuanjun-style
  // bonus actions — ps.bonusActions.remaining > 0, allowedTypes gated by the
  // hero's canPlayCard), keep firing Action-Phase plays until either the
  // bonus is exhausted, no legal play remains, or the phase advances on its
  // own. Safety-capped in case a mechanic somehow keeps the gate open
  // forever without actually consuming cards.
  let comboSafety = 6;
  while (stillCpuTurn(engine, cpuIdx)
         && engine.gs.currentPhase === 3
         && (gs.players[cpuIdx]?.bonusActions?.remaining || 0) > 0
         && comboSafety-- > 0) {
    cpuLog(`→ Action Phase (combo follow-up) bonus=${gs.players[cpuIdx].bonusActions.remaining}`);
    const handBefore = gs.players[cpuIdx].hand.length;
    await runActionPhase(engine, helpers);
    if (gs.players[cpuIdx].hand.length >= handBefore) {
      cpuLog('  (no combo Attack played — stopping loop)');
      break;
    }
  }

  cpuLog(`← Action Phase done (currentPhase=${engine.gs.currentPhase})`);
  if (!stillCpuTurn(engine, cpuIdx)) return;
  // Force-advance if still in Action Phase (no play, or combo ended with the
  // gate held open for a fraction of a frame).
  if (engine.gs.currentPhase === 3) {
    await pausePhase(engine);
    cpuLog('advancePhase Action→Main2 (phase still open)');
    await engine.advancePhase(cpuIdx);
    broadcast(helpers);
  }

  if (!stillCpuTurn(engine, cpuIdx)) return;
  cpuLog(`→ Main Phase 2 (currentPhase=${gs.currentPhase})`);
  await runMainPhase(engine, helpers);
  cpuLog('← Main Phase 2 done');

  if (!stillCpuTurn(engine, cpuIdx)) return;
  cpuLog('→ tryAscend');
  const ascended = await tryAscend(engine, helpers);
  cpuLog(`← tryAscend done (ascended=${ascended})`);
  if (!stillCpuTurn(engine, cpuIdx)) return;
  if (ascended) {
    // performAscension returns { skipEndPhase: true } by default — the
    // normal SP flow reads that and auto-advances to End Phase. Self-play
    // has to do it itself. Without this, the turn chain exits with the
    // ascender stuck in Main Phase 2, startGame resolves with no winner,
    // and we get a no-result tie (the Butterflies tie cluster).
    if (engine.gs.currentPhase === PHASES.MAIN2 && !engine.gs.result) {
      await engine.advancePhase(cpuIdx);
      broadcast(helpers);
    }
    return;
  }

  await pausePhase(engine);
  cpuLog(`advancePhase Main2→End`);
  await engine.advancePhase(cpuIdx);
  broadcast(helpers);
  cpuLog(`===== TURN END (${Date.now() - turnStartT}ms) =====`);
}

// ─── Action Phase ──────────────────────────────────────────────────────
// Per user spec: "the CPU will go into the Action Phase only once it cannot
// do anything in Main 1 anymore. It will then use the highest-level
// Creature > Spell > Attack in its hand that it can use (Creature has highest
// prio, Attack lowest, but higher level trumps type priority)."

async function runActionPhase(engine, helpers) {
  const cpuIdx = engine._cpuPlayerIdx;
  const gs = engine.gs;
  const ps = gs.players[cpuIdx];
  const cardDB = engine._getCardDB();

  // Build candidate list: every (cardName, handIdx, heroIdx) that is a legal
  // Action-Phase play right now (Spell/Attack/Creature with a hero able to
  // cast it — including for Creatures, a free Support Zone). `let` not
  // `const` because mctsRankCandidates returns a re-sorted array we assign
  // back for the subsequent try-in-order loop.
  let candidates = [];
  const typePriority = { Creature: 3, Spell: 2, Attack: 1 };
  for (let handIdx = 0; handIdx < ps.hand.length; handIdx++) {
    const cardName = ps.hand[handIdx];
    const cd = cardDB[cardName];
    if (!cd || typePriority[cd.cardType] == null) continue;
    // Surprise cards (regardless of cardType) must be SET face-down in
    // surprise zones, not played as a regular Spell/Attack/Creature.
    // placeSurprises() handles them from the Main Phase. Including them
    // here would let the CPU waste-cast Booby Trap (no effect) or play
    // Pure Advantage Camel / Cactus Creature as a regular creature.
    if ((cd.subtype || '').toLowerCase() === 'surprise') continue;
    // Same Reaction-only opt-out as fireAdditionalActions.
    const script = loadCardEffect(cardName);
    if (script?.cpuSkipProactive) continue;
    if (!isFirstTurnSafe(engine, cpuIdx, cardName, cd)) continue;
    // Per user spec: if this is an Attack/Spell whose enemy-side targets are
    // ALL immune right now, don't even consider it — better to skip the
    // action entirely than waste a card on an immune target. Creatures are
    // exempt (the body still lands even if their onPlay fizzles).
    if (!cardHasAnyViableEnemyTarget(engine, cpuIdx, cardName, cd)) continue;

    // Enumerate one candidate per eligible hero — MCTS evaluates hero
    // assignment as a decision dimension instead of collapsing to the
    // heuristic-picked hero. If no hero is eligible, skip the card.
    const eligible = listEligibleHeroesForActionCard(engine, cpuIdx, cd);
    if (!eligible.length) continue;

    // For Creatures: always route to the hero with the LOWEST matching
    // spell-school level among eligible heroes (tightest-fit rule —
    // Lv0 creature goes on a Lv0 hero before a Lv2 hero, saving the
    // higher-level slot for a higher-level summon later). Enumerate
    // candidates only for that single hero's free zones so MCTS can't
    // drift onto a higher-level hero by accident.
    let heroPool;
    if (cd.cardType === 'Creature') {
      const lowHi = pickHeroForActionCard(engine, cpuIdx, cd, cardName);
      heroPool = (lowHi >= 0) ? eligible.filter(e => e.hi === lowHi) : eligible;
    } else if (cd.cardType === 'Attack') {
      // Sort by current atk stat DESC. Most Attack cards scale damage
      // with the caster's atk; with the rollout count this brain runs
      // on (3 per candidate), two same-card / different-caster
      // candidates routinely fall inside statistical noise of each
      // other and the input order decides via stable sort. Putting the
      // bigger stick first means a noisy tie correctly resolves toward
      // the higher-atk hero. MCTS still gets to override when a
      // lower-atk hero has a synergy that actually beats raw damage.
      heroPool = [...eligible].sort((a, b) =>
        (ps.heroes[b.hi]?.atk || 0) - (ps.heroes[a.hi]?.atk || 0));
    } else {
      heroPool = eligible;
    }

    for (const e of heroPool) {
      const heroIdx = e.hi;
      const v = engine.validateActionPlay(cpuIdx, cardName, handIdx, heroIdx, [cd.cardType]);
      if (!v) continue;
      if (!v.isActionPhase) continue;
      // Inherent additional Action cards (Divine Gift of Sacrifice, etc.)
      // are designed to be played in MAIN PHASE on top of the regular
      // Action Phase action — they're "additional" by intent. The engine
      // currently still consumes the Action-Phase action slot when one
      // is played at phase 3, so enumerating them here makes the CPU
      // burn its real action on a card that should have been free. Defer
      // them entirely to fireAdditionalActions in Main Phase.
      if (v.isInherentAction) continue;
      // `casterAtk` is the casting hero's CURRENT atk stat — used by the
      // candidate-ranking tiebreak so Attack candidates that score
      // similarly under MCTS deterministically resolve to the higher-
      // atk caster. Stamped on every candidate (cheap, ignored for
      // non-Attack types in the tiebreak path).
      const casterAtk = ps.heroes[heroIdx]?.atk || 0;
      // For Creatures, enumerate one candidate per free support-zone slot so
      // MCTS evaluates zone placement (adjacency effects, Slippery-Skates /
      // Cool-Fridge positioning, etc.) as a first-class decision. For Spells/
      // Attacks there's no zone choice — emit a single candidate.
      if (cd.cardType === 'Creature') {
        const ps2 = engine.gs.players[cpuIdx];
        const zones = ps2.supportZones?.[heroIdx] || [[], [], []];
        for (let z = 0; z < zones.length; z++) {
          if ((zones[z] || []).length !== 0) continue;
          candidates.push({
            cardName, handIdx, heroIdx, zoneSlot: z,
            cardType: cd.cardType,
            level: cd.level || 0,
            typeScore: typePriority[cd.cardType],
            casterAtk,
          });
        }
      } else {
        candidates.push({
          cardName, handIdx, heroIdx,
          cardType: cd.cardType,
          level: cd.level || 0,
          typeScore: typePriority[cd.cardType],
          casterAtk,
        });
      }
    }
  }

  // ── Action-costing Ability activations as first-class candidates ──
  // Adventurousness, and any other Ability with `actionCost: true +
  // onActivate`, consumes the turn's Action just like a Spell/Attack/
  // Creature play from hand. Without these in the candidate list, the
  // CPU skips its Action Phase whenever the hand has no playable card —
  // even if Adventurousness could generate 20+ gold. HOPT is per-player-
  // per-ability-name, so we emit ONE candidate per ability name, picking
  // the highest-level-hero copy (Adventurousness scales with level).
  const actionAbilityBest = new Map();
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    if (hero.statuses?.frozen || hero.statuses?.stunned) continue;
    const zones = ps.abilityZones?.[hi] || [];
    for (let zi = 0; zi < zones.length; zi++) {
      const slot = zones[zi] || [];
      if (slot.length === 0) continue;
      const abilityName = slot[0];
      const script = loadCardEffect(abilityName);
      if (!script?.actionCost || !script?.onActivate) continue;
      const hoptKey = `ability-action:${abilityName}:${cpuIdx}`;
      if (gs.hoptUsed?.[hoptKey] === gs.turn) continue;
      if (script.canActivateAction && !script.canActivateAction(gs, cpuIdx, hi, slot.length, engine)) continue;
      const prev = actionAbilityBest.get(abilityName);
      if (!prev || slot.length > prev.level) {
        actionAbilityBest.set(abilityName, { heroIdx: hi, zoneIdx: zi, level: slot.length });
      }
    }
  }
  for (const [abilityName, best] of actionAbilityBest) {
    candidates.push({
      cardType: 'AbilityAction',
      cardName: abilityName,
      abilityName,
      heroIdx: best.heroIdx,
      zoneIdx: best.zoneIdx,
      level: best.level,
      typeScore: 0,
    });
  }

  cpuLog(`  Action Phase candidates: ${candidates.length}`);
  if (candidates.length === 0) {
    const picked = await tryActionCostingAbility(engine, helpers);
    if (picked) return true;
    return false;
  }

  // Rank candidates. MCTS evaluates each via rollout (snapshot → apply →
  // play rest of turn → evaluate → restore, averaged over N trials) AND
  // enumerates target-prompt alternatives within each rollout. Combo
  // continuation (Ghuanjun bonus actions) skips MCTS — each re-run pays
  // its full cost and attacks are simple enough to rank by level and
  // type without rollouts.
  const inBonusAction = (ps.bonusActions?.remaining || 0) > 0;
  if (MCTS_ENABLED && candidates.length > 0 && !inBonusAction) {
    candidates = await mctsRankCandidates(engine, helpers, candidates);
  } else {
    candidates.sort((a, b) =>
      (b.level - a.level)
      || (b.typeScore - a.typeScore)
      || ((b.casterAtk || 0) - (a.casterAtk || 0)));
  }

  // Ascension hard-priority: if the CPU has an unfulfilled Ascended Hero
  // and any candidate would directly progress the Ascension condition
  // (Beato casting a Spell / summoning a Creature of an uncollected
  // school, etc.), float ALL such candidates to the front — even over a
  // higher-MCTS-scoring alternative. Matches the spec: "fulfilling the
  // Ascension condition should be the AI's number-one priority." Relative
  // order within each bucket preserves the MCTS ranking, so the best
  // progresser is tried first and non-progressers remain ordered as a
  // fallback chain if the progressers can't resolve for some reason.
  if (playerHasUnfulfilledAscension(engine, cpuIdx)) {
    const progressers = [];
    const others = [];
    for (const c of candidates) {
      if (candidateProgressesAscension(engine, cpuIdx, c, cardDB)) progressers.push(c);
      else others.push(c);
    }
    if (progressers.length > 0) {
      cpuLog(`  [Ascension] ${progressers.length} candidate(s) progress Ascension — floating to front`);
      candidates = [...progressers, ...others];
    }
  }

  for (const pick of candidates) {
    if (!stillCpuTurn(engine, cpuIdx)) return false;
    if (engine.gs.currentPhase !== 3) {
      cpuLog(`  Action Phase: currentPhase=${engine.gs.currentPhase}, early-exit`);
      return true;
    }

    const handLenBefore = ps.hand.length;
    const abilityHoptKey = pick.cardType === 'AbilityAction'
      ? `ability-action:${pick.abilityName}:${cpuIdx}`
      : null;
    const hoptBefore = abilityHoptKey ? gs.hoptUsed?.[abilityHoptKey] : null;
    cpuLog(`    → Action Phase try: ${pick.cardType} "${pick.cardName}" (lvl ${pick.level}) hero=${pick.heroIdx}${pick.scriptedTargetPlan ? ' [scripted targets]' : ''}`);
    await pausePhase(engine);
    // If MCTS found a better target plan than the heuristic, inject it so the
    // real play follows it. The promptEffectTarget override consumes entries
    // one-by-one and falls through to heuristics for null/invalid slots.
    const hadPlan = Array.isArray(pick.scriptedTargetPlan) && pick.scriptedTargetPlan.length > 0;
    if (hadPlan) engine._mctsTargetPlan = [...pick.scriptedTargetPlan];
    try {
      if (pick.cardType === 'AbilityAction') {
        // Action-costing ability activation (Adventurousness, etc.) — no
        // hand card, no zoneSlot; fires via doActivateAbility on the chosen
        // hero+ability zone.
        await helpers.doActivateAbility(helpers.room, cpuIdx, {
          heroIdx: pick.heroIdx,
          zoneIdx: pick.zoneIdx,
        });
      } else if (pick.cardType === 'Creature') {
        // MCTS picked the zone slot during candidate enumeration; honor
        // it if still free, else fall back to the heuristic picker.
        let zoneSlot = pick.zoneSlot;
        const ps3 = engine.gs.players[cpuIdx];
        const slotTaken = zoneSlot != null
          && (((ps3.supportZones?.[pick.heroIdx] || [])[zoneSlot] || []).length > 0);
        if (zoneSlot == null || zoneSlot < 0 || slotTaken) {
          zoneSlot = pickCreatureZoneSlot(engine, cpuIdx, pick.heroIdx);
        }
        if (zoneSlot < 0) { cpuLog(`    ← no free slot for creature`); continue; }
        await helpers.doPlayCreature(helpers.room, cpuIdx, {
          cardName: pick.cardName,
          handIndex: pick.handIdx,
          heroIdx: pick.heroIdx,
          zoneSlot,
        });
      } else {
        await helpers.doPlaySpell(helpers.room, cpuIdx, {
          cardName: pick.cardName,
          handIndex: pick.handIdx,
          heroIdx: pick.heroIdx,
        });
      }
    } finally {
      if (hadPlan) delete engine._mctsTargetPlan;
    }

    const shrank = ps.hand.length < handLenBefore;
    const phaseChanged = engine.gs.currentPhase !== 3;
    const hoptClaimed = abilityHoptKey
      && gs.hoptUsed?.[abilityHoptKey] === gs.turn
      && hoptBefore !== gs.turn;
    cpuLog(`    ← Action Phase result: shrank=${shrank} phaseChanged=${phaseChanged}${hoptClaimed ? ' hoptClaimed=true' : ''} newPhase=${engine.gs.currentPhase}`);
    if (shrank || phaseChanged || hoptClaimed) return true;
  }
  return false;
}

// ─── Action-costing Ability fallback ───────────────────────────────────
// Per user spec: if nothing else is available in the Action Phase, fire an
// action-costing Ability instead. HOPT-gated, canActivateAction-gated.
async function tryActionCostingAbility(engine, helpers) {
  const cpuIdx = engine._cpuPlayerIdx;
  const gs = engine.gs;
  const ps = gs.players[cpuIdx];
  if (!ps) return false;
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    if (hero.statuses?.frozen || hero.statuses?.stunned) continue;
    const zones = ps.abilityZones?.[hi] || [];
    for (let zi = 0; zi < zones.length; zi++) {
      const slot = zones[zi] || [];
      if (slot.length === 0) continue;
      const abilityName = slot[0];
      const script = loadCardEffect(abilityName);
      if (!script?.actionCost || !script?.onActivate) continue;
      const hoptKey = `ability-action:${abilityName}:${cpuIdx}`;
      if (gs.hoptUsed?.[hoptKey] === gs.turn) continue;
      if (script.canActivateAction && !script.canActivateAction(gs, cpuIdx, hi, slot.length, engine)) continue;
      cpuLog(`    → action-costing ability "${abilityName}" hero=${hi}`);
      await helpers.doActivateAbility(helpers.room, cpuIdx, { heroIdx: hi, zoneIdx: zi });
      return true;
    }
  }
  return false;
}

// ─── Ascension ─────────────────────────────────────────────────────────
// Per user spec: "If a CPU can Ascend, it will do so as the LAST game action
// of its turn." Random pick if multiple Heroes are ready.

async function tryAscend(engine, helpers) {
  const cpuIdx = engine._cpuPlayerIdx;
  const gs = engine.gs;
  const ps = gs.players[cpuIdx];
  const cardDB = engine._getCardDB();

  // Find ascension candidates: (handIdx, heroIdx) where handIdx holds an
  // Ascended Hero card and heroIdx points to a Hero that's ascensionReady.
  const candidates = [];
  for (let handIdx = 0; handIdx < ps.hand.length; handIdx++) {
    const cardName = ps.hand[handIdx];
    const cd = cardDB[cardName];
    if (!cd || cd.cardType !== 'Ascended Hero') continue;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (!hero.ascensionReady) continue;
      candidates.push({ cardName, handIdx, heroIdx: hi });
    }
  }
  if (!candidates.length) return false;

  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  cpuLog(`  → ascend "${pick.cardName}" onto hero ${pick.heroIdx}`);
  await pauseAction(engine);
  // Ascension is an enormous, near-always-positive boon: HP/ATK upgrade,
  // free Ascension Bonus, and unlocks the Ascended hero's effect/passive.
  // The MCTS evaluator can't always see that through the noisy short-
  // horizon rollout (esp. when the bonus prompt is interactive), so we
  // route the activation through the gate with `alwaysCommit: true` —
  // MCTS still gets to explore bonus-prompt variations to pick the best
  // one, but the gate will not refuse the ascension itself.
  const actionFn = async () => {
    await engine.performAscension(cpuIdx, pick.heroIdx, pick.cardName, pick.handIdx, {});
  };
  const committed = await mctsGatedActivation(engine, helpers, `ascend ${pick.cardName}`, actionFn,
    { alwaysCommit: true });
  if (!committed) {
    cpuLog(`  ← ascension skipped by MCTS gate`);
    return false;
  }
  cpuLog(`  ← ascension done`);
  broadcast(helpers);
  return true;
}

async function runMainPhase(engine, helpers) {
  for (let guard = 0; guard < 12; guard++) {
    const before = snapshotProgress(engine);
    cpuLog(`  MainPhase pass ${guard + 1} — snapshot=${before}`);

    cpuLog('    → playArtifacts');
    await playArtifacts(engine, helpers);
    cpuLog('    ← playArtifacts');
    if (!stillCpuTurn(engine, engine._cpuPlayerIdx)) return;

    cpuLog('    → playPotions');
    await playPotions(engine, helpers);
    cpuLog('    ← playPotions');
    if (!stillCpuTurn(engine, engine._cpuPlayerIdx)) return;

    cpuLog('    → attachAbilities');
    await attachAbilities(engine, helpers);
    cpuLog('    ← attachAbilities');
    if (!stillCpuTurn(engine, engine._cpuPlayerIdx)) return;

    cpuLog('    → placeSurprises');
    await placeSurprises(engine, helpers);
    cpuLog('    ← placeSurprises');
    if (!stillCpuTurn(engine, engine._cpuPlayerIdx)) return;

    cpuLog('    → fireAdditionalActions');
    await fireAdditionalActions(engine, helpers);
    cpuLog('    ← fireAdditionalActions');
    if (!stillCpuTurn(engine, engine._cpuPlayerIdx)) return;

    cpuLog('    → activateBoardEffects');
    await activateBoardEffects(engine, helpers);
    cpuLog('    ← activateBoardEffects');
    if (!stillCpuTurn(engine, engine._cpuPlayerIdx)) return;

    const after = snapshotProgress(engine);
    cpuLog(`  MainPhase pass ${guard + 1} end — before=${before} after=${after}`);
    if (after === before) { cpuLog('  MainPhase: no progress, breaking'); break; }
  }
}

// ─── 2h: Active board effects ─────────────────────────────────────────
// Per user spec: CPU activates every free active effect it can (Main Phase
// only for 2h). Covers free-activation Abilities (script.freeActivation +
// onFreeActivate). Hero effects, Creature/Equipment/Attachment actives, and
// Area effects are deferred — their socket handlers aren't extracted yet.
//
// HOPT is per-ability-name per-player, so we only fire a given name once per
// turn even if multiple Heroes stack the same Ability. The handler claims
// HOPT on successful activation; we just need to skip if gs.hoptUsed says so.

async function activateBoardEffects(engine, helpers) {
  await activateFreeAbilities(engine, helpers);
  if (!stillCpuTurn(engine, engine._cpuPlayerIdx)) return;
  await activateCreatureEffects(engine, helpers);
  if (!stillCpuTurn(engine, engine._cpuPlayerIdx)) return;
  await activateHeroEffects(engine, helpers);
  if (!stillCpuTurn(engine, engine._cpuPlayerIdx)) return;
  await activateEquipEffects(engine, helpers);
  if (!stillCpuTurn(engine, engine._cpuPlayerIdx)) return;
  await activateAreaEffects(engine, helpers);
  if (!stillCpuTurn(engine, engine._cpuPlayerIdx)) return;
  await activatePermanents(engine, helpers);
}

async function activateHeroEffects(engine, helpers) {
  const cpuIdx = engine._cpuPlayerIdx;
  const gs = engine.gs;
  const ps = gs.players[cpuIdx];
  if (!ps) return;

  // Flashbang gate — Hero Effect activations now fire onAnyActionResolved
  // (so they trigger Flashbang's turn-end). Skip in Main Phase 1 to
  // preserve the one allowed Action for the Action Phase's wider
  // card pool; allow in Main Phase 2 as a fallback. Same rationale
  // as the gate in fireAdditionalActions above.
  if (isCpuFlashbanged(engine) && gs.currentPhase === 2) {
    cpuLog('  activateHeroEffects: skipping in MP1 (Flashbanged)');
    return;
  }
  const tried = new Set();
  for (let safety = 0; safety < 6; safety++) {
    if (!stillCpuTurn(engine, cpuIdx)) return;
    let pickIdx = -1;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) continue;
      if (tried.has(hi)) continue;
      // Check if hero has ANY available hero-effect we haven't claimed HOPT on.
      const script = loadCardEffect(hero.name);
      const hoptKey = `hero-effect:${hero.name}:${cpuIdx}:${hi}`;
      const available = (script?.heroEffect && script?.onHeroEffect && gs.hoptUsed?.[hoptKey] !== gs.turn);
      // Also check equipped hero-effect providers (e.g. Mummy Token, treatAsEquip heroes).
      const hasEquippedEffect = engine.cardInstances.some(ci => {
        if (ci.owner !== cpuIdx || ci.zone !== 'support' || ci.heroIdx !== hi) return false;
        if (!ci.counters?.treatAsEquip) return false;
        const eq = loadCardEffect(ci.name);
        if (!eq?.heroEffect || !eq?.onHeroEffect) return false;
        const hk = `hero-effect:${ci.name}:${cpuIdx}:${hi}`;
        return gs.hoptUsed?.[hk] !== gs.turn;
      });
      if (available || hasEquippedEffect) { pickIdx = hi; break; }
    }
    if (pickIdx < 0) return;
    cpuLog(`      → activate hero effect hero=${pickIdx}`);
    const handBefore = JSON.stringify(gs.hoptUsed || {});
    const committed = await mctsGatedActivation(engine, helpers, `hero-effect h${pickIdx}`,
      () => helpers.doActivateHeroEffect(helpers.room, cpuIdx, { heroIdx: pickIdx }));
    const handAfter = JSON.stringify(gs.hoptUsed || {});
    if (!committed || handBefore === handAfter) {
      cpuLog(`      ← hero effect hero=${pickIdx} did NOT claim HOPT — marking as tried`);
      tried.add(pickIdx);
    } else {
      cpuLog(`      ← hero effect hero=${pickIdx} OK`);
    }
    await pauseAction(engine);
  }
}

async function activateEquipEffects(engine, helpers) {
  const cpuIdx = engine._cpuPlayerIdx;
  const gs = engine.gs;
  const tried = new Set();
  for (let safety = 0; safety < 12; safety++) {
    if (!stillCpuTurn(engine, cpuIdx)) return;
    let pick = null;
    for (const inst of engine.cardInstances) {
      if (inst.owner !== cpuIdx || inst.zone !== 'support') continue;
      const key = inst.id;
      if (tried.has(key)) continue;
      const hoptKey = `equip-effect:${inst.id}`;
      if (gs.hoptUsed?.[hoptKey] === gs.turn) continue;
      const script = loadCardEffect(inst.name);
      if (!script?.equipEffect || !script?.onEquipEffect) continue;
      if (script.canActivateEquipEffect) {
        const ctx = engine._createContext(inst, { event: 'canEquipEffectCheck' });
        if (!script.canActivateEquipEffect(ctx)) continue;
      }
      pick = { instId: inst.id, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot, name: inst.name };
      break;
    }
    if (!pick) return;
    // Per-card CPU activation guard: lets the card itself defer proactive
    // activation based on current board context (e.g. Skates declining to
    // clog up summoner zones during MP1 / Action Phase). Guarded with try
    // so a buggy script can't hang the turn.
    const pickScript = loadCardEffect(pick.name);
    if (typeof pickScript?.cpuCanActivateEquip === 'function') {
      let ok = true;
      try { ok = !!pickScript.cpuCanActivateEquip(engine, cpuIdx, pick.heroIdx, pick.zoneSlot); }
      catch { ok = true; }
      if (!ok) {
        cpuLog(`      ← equip effect "${pick.name}" deferred by card guard`);
        tried.add(pick.instId);
        await pauseAction(engine);
        continue;
      }
    }
    cpuLog(`      → activate equip effect "${pick.name}" hero=${pick.heroIdx}`);
    const committed = await mctsGatedActivation(engine, helpers, `equip-effect ${pick.name}`,
      () => helpers.doActivateEquipEffect(helpers.room, cpuIdx, { heroIdx: pick.heroIdx, zoneSlot: pick.zoneSlot }));
    const hoptKey = `equip-effect:${pick.instId}`;
    if (!committed || gs.hoptUsed?.[hoptKey] !== gs.turn) tried.add(pick.instId);
    await pauseAction(engine);
  }
}

async function activateAreaEffects(engine, helpers) {
  const cpuIdx = engine._cpuPlayerIdx;
  const gs = engine.gs;
  const tried = new Set();
  for (let safety = 0; safety < 6; safety++) {
    if (!stillCpuTurn(engine, cpuIdx)) return;
    let pick = null;
    // Areas belong to a specific player but both players can activate each
    // (the rules allow Area activations from either player). Scan both sides.
    for (let owner = 0; owner < 2; owner++) {
      const areas = gs.areaZones?.[owner] || [];
      for (const areaName of areas) {
        const key = `${owner}|${areaName}`;
        if (tried.has(key)) continue;
        const script = loadCardEffect(areaName);
        if (!script?.onAreaEffect) continue;
        if (script.canActivateAreaEffect) {
          try {
            if (!script.canActivateAreaEffect(gs, cpuIdx, owner, engine)) continue;
          } catch { continue; }
        }
        pick = { owner, areaName, key };
        break;
      }
      if (pick) break;
    }
    if (!pick) return;
    cpuLog(`      → activate area effect "${pick.areaName}" owner=${pick.owner}`);
    const handBefore = JSON.stringify(gs.hoptUsed || {});
    const committed = await mctsGatedActivation(engine, helpers, `area ${pick.areaName}`,
      () => helpers.doActivateAreaEffect(helpers.room, cpuIdx, { areaOwner: pick.owner, areaName: pick.areaName }));
    const handAfter = JSON.stringify(gs.hoptUsed || {});
    if (!committed || handBefore === handAfter) tried.add(pick.key);
    await pauseAction(engine);
  }
}

async function activatePermanents(engine, helpers) {
  const cpuIdx = engine._cpuPlayerIdx;
  const gs = engine.gs;
  const tried = new Set();
  for (let safety = 0; safety < 10; safety++) {
    if (!stillCpuTurn(engine, cpuIdx)) return;
    let pick = null;
    // Permanents can belong to either player (stored in ps.permanents).
    // canActivatePermanent gates whether the CPU (pi=cpuIdx) can act.
    for (let owner = 0; owner < 2; owner++) {
      for (const perm of (gs.players[owner]?.permanents || [])) {
        const key = `${owner}|${perm.id}`;
        if (tried.has(key)) continue;
        const script = loadCardEffect(perm.name);
        if (!script?.onActivatePermanent || !script?.canActivatePermanent) continue;
        try {
          if (!script.canActivatePermanent(gs, cpuIdx, owner, engine)) continue;
        } catch { continue; }
        pick = { owner, permId: perm.id, name: perm.name, key };
        break;
      }
      if (pick) break;
    }
    if (!pick) return;
    cpuLog(`      → activate permanent "${pick.name}"`);
    await mctsGatedActivation(engine, helpers, `permanent ${pick.name}`,
      () => helpers.doActivatePermanent(helpers.room, cpuIdx, { permId: pick.permId, ownerIdx: pick.owner }));
    // No simple HOPT proxy — add to tried after one attempt regardless.
    tried.add(pick.key);
    await pauseAction(engine);
  }
}

async function activateFreeAbilities(engine, helpers) {
  const cpuIdx = engine._cpuPlayerIdx;
  const gs = engine.gs;
  const ps = gs.players[cpuIdx];
  if (!ps) return;

  const tried = new Set();
  for (let safety = 0; safety < 12; safety++) {
    if (!stillCpuTurn(engine, cpuIdx)) return;

    let pick = null;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (hero.statuses?.frozen || hero.statuses?.stunned) continue;
      const zones = ps.abilityZones?.[hi] || [];
      for (let zi = 0; zi < zones.length; zi++) {
        const slot = zones[zi] || [];
        if (slot.length === 0) continue;
        const abilityName = slot[0];
        const key = `${abilityName}|${hi}|${zi}`;
        if (tried.has(key)) continue;
        const script = loadCardEffect(abilityName);
        if (!script?.freeActivation || !script.onFreeActivate) continue;
        const hoptKey = `free-ability:${abilityName}:${cpuIdx}`;
        if (gs.hoptUsed?.[hoptKey] === gs.turn) continue;
        pick = { heroIdx: hi, zoneIdx: zi, abilityName, key };
        break;
      }
      if (pick) break;
    }
    if (!pick) return;

    const hoptKey = `free-ability:${pick.abilityName}:${cpuIdx}`;
    const wasClaimed = gs.hoptUsed?.[hoptKey] === gs.turn;
    cpuLog(`      → activate free ability "${pick.abilityName}" hero=${pick.heroIdx} zone=${pick.zoneIdx}`);
    const pickAbilityScript = loadCardEffect(pick.abilityName);
    const pickAbilityIsDrawOnly = !!pickAbilityScript?.blockedByHandLock;
    const committed = await mctsGatedActivation(engine, helpers, `free-ability ${pick.abilityName}`,
      () => helpers.doActivateFreeAbility(helpers.room, cpuIdx, { heroIdx: pick.heroIdx, zoneIdx: pick.zoneIdx }),
      { alwaysCommit: pickAbilityIsDrawOnly });
    const nowClaimed = gs.hoptUsed?.[hoptKey] === gs.turn;
    cpuLog(`      ← free ability "${pick.abilityName}" ${committed && nowClaimed ? 'OK' : 'SKIPPED/FAILED'}`);
    if (!committed || (!wasClaimed && !nowClaimed)) tried.add(pick.key);
    await pauseAction(engine);
  }
}

async function activateCreatureEffects(engine, helpers) {
  const cpuIdx = engine._cpuPlayerIdx;
  const gs = engine.gs;
  const ps = gs.players[cpuIdx];
  if (!ps) return;

  const tried = new Set();
  for (let safety = 0; safety < 12; safety++) {
    if (!stillCpuTurn(engine, cpuIdx)) return;

    let pick = null;
    for (let hi = 0; hi < (ps.supportZones || []).length; hi++) {
      const zones = ps.supportZones[hi] || [];
      for (let zi = 0; zi < zones.length; zi++) {
        const slot = zones[zi] || [];
        if (slot.length === 0) continue;
        const cardName = slot[0];
        const inst = engine.cardInstances.find(c =>
          c.owner === cpuIdx && c.zone === 'support' && c.heroIdx === hi && c.zoneSlot === zi
        );
        if (!inst) continue;
        if (inst.faceDown) continue; // face-down surprises aren't actives
        if (inst.turnPlayed === gs.turn) continue; // summoning sickness
        const hoptKey = `creature-effect:${inst.id}`;
        if (gs.hoptUsed?.[hoptKey] === gs.turn) continue;

        const effectName = inst.counters?._effectOverride || cardName;
        const script = loadCardEffect(effectName);
        if (!script?.creatureEffect || !script.onCreatureEffect) continue;

        const key = `${cardName}|${hi}|${zi}|${inst.id}`;
        if (tried.has(key)) continue;

        pick = { heroIdx: hi, zoneSlot: zi, cardName, instId: inst.id, key };
        break;
      }
      if (pick) break;
    }
    if (!pick) return;

    const hoptKey = `creature-effect:${pick.instId}`;
    const wasClaimed = gs.hoptUsed?.[hoptKey] === gs.turn;
    cpuLog(`      → activate creature effect "${pick.cardName}" hero=${pick.heroIdx} zone=${pick.zoneSlot}`);
    const pickScript = loadCardEffect(pick.cardName);
    const pickAlwaysCommit = !!pickScript?.cpuMeta?.alwaysCommit;
    const pickEvalThroughTurnEnd = !!pickScript?.cpuMeta?.evaluateThroughTurnEnd;
    const committed = await mctsGatedActivation(engine, helpers, `creature-effect ${pick.cardName}`,
      () => helpers.doActivateCreatureEffect(helpers.room, cpuIdx, { heroIdx: pick.heroIdx, zoneSlot: pick.zoneSlot }),
      { alwaysCommit: pickAlwaysCommit, evaluateThroughTurnEnd: pickEvalThroughTurnEnd });
    const nowClaimed = gs.hoptUsed?.[hoptKey] === gs.turn;
    cpuLog(`      ← creature effect "${pick.cardName}" ${committed && nowClaimed ? 'OK' : 'SKIPPED/FAILED'}`);
    if (!committed || (!wasClaimed && !nowClaimed)) tried.add(pick.key);
    await pauseAction(engine);
  }
}

// Coarse fingerprint of CPU progress during a Main Phase. If a full loop pass
// doesn't change this, there's nothing more to do.
function snapshotProgress(engine) {
  const ps = engine.gs.players[engine._cpuPlayerIdx];
  const supportCount = (ps.supportZones || []).reduce(
    (sum, hz) => sum + hz.reduce((s, slot) => s + (slot?.length || 0), 0), 0,
  );
  return ps.hand.length + '|' + ps.gold + '|' + supportCount + '|' + ps.abilityGivenThisTurn.filter(Boolean).length;
}

// ─── Artifacts ──────────────────────────────────────────────────────────
// Per user spec: "Artifacts are played as soon as they can be afforded, with
// Equips going on random Heroes, but any that give bonus atk will instead go
// on the highest-atk own Hero." Non-Equipment Artifacts that need targeting
// are skipped in 2b — they come back in sub-phase 2i with the targeting brain.

async function playArtifacts(engine, helpers) {
  const cpuIdx = engine._cpuPlayerIdx;
  const gs = engine.gs;
  const ps = gs.players[cpuIdx];
  const cardDB = engine._getCardDB();
  const tried = new Set(); // card names that look playable but failed to actually play

  for (let safety = 0; safety < 20; safety++) {
    if (!stillCpuTurn(engine, cpuIdx)) return;

    let pick = null;
    for (let handIdx = 0; handIdx < ps.hand.length; handIdx++) {
      const cardName = ps.hand[handIdx];
      if (tried.has(cardName)) continue;
      const cd = cardDB[cardName];
      if (!cd || cd.cardType !== 'Artifact') continue;
      const plan = planArtifactPlay(engine, cpuIdx, cardName, handIdx, cd);
      if (plan) { pick = plan; break; }
    }
    if (!pick) return;

    const handLenBefore = ps.hand.length;
    cpuLog(`      → play artifact "${pick.cardName}" (${pick.kind}) hero=${pick.heroIdx}`);
    const actionFn = async () => {
      if (pick.kind === 'equipment' || pick.kind === 'artifactCreature') {
        await helpers.doPlayArtifact(helpers.room, cpuIdx, {
          cardName: pick.cardName,
          handIndex: pick.handIdx,
          heroIdx: pick.heroIdx,
          zoneSlot: -1,
        });
      } else {
        await helpers.doUseArtifactEffect(helpers.room, cpuIdx, {
          cardName: pick.cardName,
          handIndex: pick.handIdx,
        });
        if (engine.gs.potionTargeting?.potionName === pick.cardName && engine.gs.potionTargeting.ownerIdx === cpuIdx) {
          await resolveTargetingPrompt(engine, helpers);
        }
      }
    };
    const pickScript = loadCardEffect(pick.cardName);
    const pickIsDrawOnly = !!pickScript?.blockedByHandLock;
    const pickEvalThroughTurnEnd = !!pickScript?.cpuMeta?.evaluateThroughTurnEnd;
    const pickAlwaysCommit = !!pickScript?.cpuMeta?.alwaysCommit;
    // Equipment / Artifact-Creature plays are long-term investments: the
    // body lands on the board and pays off over many turns. The
    // immediate-state gate sees only "−gold −1 hand card +30 slot",
    // which often nets negative — so the CPU has been refusing to
    // equip even when it has the gold and an eligible hero. Match
    // the user's intuition by always committing equipment plays once
    // planArtifactPlay has filtered for an eligible hero+zone.
    // Use-effect Artifacts (Fire Bomb, Magnetic Glove, …) still go
    // through the regular score gate.
    const pickIsEquipment = pick.kind === 'equipment' || pick.kind === 'artifactCreature';
    const committed = await mctsGatedActivation(engine, helpers, `artifact ${pick.cardName}`, actionFn,
      {
        alwaysCommit: pickIsDrawOnly || pickIsEquipment || pickAlwaysCommit,
        evaluateThroughTurnEnd: pickEvalThroughTurnEnd,
      });
    const shrank = ps.hand.length < handLenBefore;
    cpuLog(`      ← artifact "${pick.cardName}" ${committed && shrank ? 'OK' : 'SKIPPED/FAILED'} (hand ${handLenBefore}→${ps.hand.length})`);
    if (!committed || !shrank) tried.add(pick.cardName);
    await pauseAction(engine);
  }
}

function planArtifactPlay(engine, pi, cardName, handIdx, cardData) {
  const gs = engine.gs;
  const ps = gs.players[pi];

  if (ps.itemLocked && (ps.hand || []).length < 2) return null;
  if (ps._creationLockedNames?.has(cardName)) return null;

  const rawCost = cardData.cost || 0;
  const costReduction = ps._nextArtifactCostReduction || 0;
  const cost = Math.max(0, rawCost - costReduction);
  if ((ps.gold || 0) < cost) return null;

  const subLower = (cardData.subtype || '').toLowerCase();
  const isEquip = subLower === 'equipment';
  const isArtifactCreature = subLower.split('/').some(t => t.trim() === 'creature');

  if (isEquip) {
    const heroIdx = pickHeroForEquip(engine, pi, cardName, cardData);
    if (heroIdx < 0) return null;
    return { kind: 'equipment', cardName, handIdx, heroIdx };
  }

  if (isArtifactCreature) {
    const heroIdx = pickHeroForArtifactCreature(engine, pi);
    if (heroIdx < 0) return null;
    return { kind: 'artifactCreature', cardName, handIdx, heroIdx };
  }

  // Normal / Reaction / Area Artifacts → doUseArtifactEffect path
  const script = loadCardEffect(cardName);
  if (!script) return null;
  if (subLower === 'surprise') return null;
  if (subLower === 'reaction' && !script.proactivePlay) return null;
  if (script.canActivate && !script.canActivate(gs, pi)) return null;
  if (script.blockedByHandLock && ps.handLocked) return null;
  // Juice: server-side `canActivate` returns true if EITHER side has a
  // cleansable status, so without this CPU-side guard the CPU happily
  // plays it when only the opponent has statuses (and the targeting
  // brain then either picks []-confirms a no-op or actively cleanses
  // an opponent's debuff, both bad). Gate on own cleansable targets.
  if (cardName === 'Juice' && !hasCleansableOwnTarget(engine)) return null;
  // Targeted artifacts (getValidTargets + targetingConfig) also go through
  // doUseArtifactEffect — the CPU brain's post-play step picks targets and
  // calls doConfirmPotion to finish resolution.
  const isTargeted = !!(script.getValidTargets && script.targetingConfig);
  if (!isTargeted && !script.resolve) return null;
  return { kind: 'useEffect', cardName, handIdx, isTargeted };
}

function pickHeroForEquip(engine, pi, cardName, cardData) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  const script = loadCardEffect(cardName);

  if (script?.oncePerGame) {
    const opgKey = script.oncePerGameKey || cardName;
    if (ps._oncePerGameUsed?.has(opgKey)) return -1;
  }

  const eligible = [];
  for (let hi = 0; hi < 3; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    if (hero.statuses?.frozen) continue;
    if (hero.statuses?.charmed) continue;
    if (script?.canEquipToHero && !script.canEquipToHero(gs, pi, hi, engine)) continue;
    const zones = ps.supportZones?.[hi] || [[], [], []];
    let hasFree = false;
    for (let z = 0; z < 3; z++) {
      if ((zones[z] || []).length === 0) { hasFree = true; break; }
    }
    if (hasFree) eligible.push(hi);
  }
  if (!eligible.length) return -1;

  // Ascension priority: if one of the eligible heroes needs this equipment
  // for their ascension (Arthor's Sword/Circle, Layn's Hammer, etc.), send
  // it there first — overrides every other selector.
  const ascHi = ascensionTargetHero(engine, pi, cardName, cardData);
  if (ascHi >= 0 && eligible.includes(ascHi)) return ascHi;

  // Card-specific preference: Slippery Skates / future equipments can export
  // `cpuPrefersEquipTarget(engine, pi, hi, cardData)` to narrow eligible to
  // the heroes that actually benefit (e.g. Skates prefers summoner heroes).
  // If ANY eligible hero matches, restrict to that subset; otherwise keep
  // the full list so a suboptimal placement still beats not playing at all.
  let pool = eligible;
  if (typeof script?.cpuPrefersEquipTarget === 'function') {
    const preferred = pool.filter(hi => {
      try { return !!script.cpuPrefersEquipTarget(engine, pi, hi, cardData); }
      catch { return false; }
    });
    if (preferred.length > 0) pool = preferred;
  }

  // Numeric ranking within the preferred pool. Skates uses this to send
  // itself to the highest-summoning-level hero (Ascended Beato = Lv9
  // virtual, beats any real-Lv1 summoner) instead of picking at random.
  if (typeof script?.cpuEquipTargetScore === 'function') {
    const scored = pool.map(hi => {
      let score = 0;
      try { score = Number(script.cpuEquipTargetScore(engine, pi, hi, cardData)) || 0; }
      catch { score = 0; }
      return { hi, score };
    });
    const maxScore = Math.max(...scored.map(s => s.score));
    if (Number.isFinite(maxScore) && maxScore > 0) {
      const top = scored.filter(s => s.score === maxScore).map(s => s.hi);
      return top[Math.floor(Math.random() * top.length)];
    }
  }

  // Atk-boost Equipments go on the highest-atk eligible hero; ties broken at random.
  if (isAtkBoostEquip(cardData)) {
    let topAtk = -Infinity;
    for (const hi of pool) topAtk = Math.max(topAtk, ps.heroes[hi].atk || 0);
    const tied = pool.filter(hi => (ps.heroes[hi].atk || 0) === topAtk);
    return tied[Math.floor(Math.random() * tied.length)];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickHeroForArtifactCreature(engine, pi) {
  const ps = engine.gs.players[pi];
  const eligible = [];
  for (let hi = 0; hi < 3; hi++) {
    const zones = ps.supportZones?.[hi] || [[], [], []];
    let hasFree = false;
    for (let z = 0; z < 3; z++) {
      if ((zones[z] || []).length === 0) { hasFree = true; break; }
    }
    if (hasFree) eligible.push(hi);
  }
  if (!eligible.length) return -1;
  return eligible[Math.floor(Math.random() * eligible.length)];
}

// ─── Potions ────────────────────────────────────────────────────────────
// Per user spec: "Potions are always used as soon as possible (be mindful of
// the 'You cannot use more Potions this turn' lock!)". Targeted Potions are
// deferred to sub-phase 2i — the targeting brain.

async function playPotions(engine, helpers) {
  const cpuIdx = engine._cpuPlayerIdx;
  const gs = engine.gs;
  const ps = gs.players[cpuIdx];
  const cardDB = engine._getCardDB();
  const tried = new Set();

  for (let safety = 0; safety < 20; safety++) {
    if (!stillCpuTurn(engine, cpuIdx)) return;
    if (ps.potionLocked) return;

    let pick = null;
    for (let handIdx = 0; handIdx < ps.hand.length; handIdx++) {
      const cardName = ps.hand[handIdx];
      if (tried.has(cardName)) continue;
      const cd = cardDB[cardName];
      if (!cd || cd.cardType !== 'Potion') continue;
      if (isPotionPlayable(engine, cpuIdx, cardName)) {
        pick = { cardName, handIdx };
        break;
      }
    }
    if (!pick) return;

    const handLenBefore = ps.hand.length;
    cpuLog(`      → use potion "${pick.cardName}"`);
    const actionFn = async () => {
      await helpers.doUsePotion(helpers.room, cpuIdx, {
        cardName: pick.cardName,
        handIndex: pick.handIdx,
      });
      if (engine.gs.potionTargeting?.potionName === pick.cardName && engine.gs.potionTargeting.ownerIdx === cpuIdx) {
        await resolveTargetingPrompt(engine, helpers);
      }
    };
    const pickScript = loadCardEffect(pick.cardName);
    const pickIsDrawOnly = !!pickScript?.blockedByHandLock;
    const pickEvalThroughTurnEnd = !!pickScript?.cpuMeta?.evaluateThroughTurnEnd;
    // Future-trigger / permanent-placing potions (Elixir of Immortality,
    // any "place this card openly in front of you" effect) opt into
    // alwaysCommit so the gate doesn't refuse them just because the
    // immediate post-play eval doesn't see the multi-turn payoff.
    const pickAlwaysCommit = !!pickScript?.cpuMeta?.alwaysCommit;
    const committed = await mctsGatedActivation(engine, helpers, `potion ${pick.cardName}`, actionFn,
      {
        alwaysCommit: pickIsDrawOnly || pickAlwaysCommit,
        evaluateThroughTurnEnd: pickEvalThroughTurnEnd,
      });
    const shrank = ps.hand.length < handLenBefore;
    cpuLog(`      ← potion "${pick.cardName}" ${committed && shrank ? 'OK' : 'SKIPPED/FAILED'}`);
    if (!committed || !shrank) tried.add(pick.cardName);
    await pauseAction(engine);
  }
}

function isPotionPlayable(engine, pi, cardName) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  if (ps.potionLocked) return false;
  if (ps._creationLockedNames?.has(cardName)) return false;

  const script = loadCardEffect(cardName);
  if (!script?.isPotion) return false;
  if (script.canActivate && !script.canActivate(gs, pi, engine)) return false;
  if (script.blockedByHandLock && ps.handLocked) return false;
  // Targeted Potions play via doUsePotion → gs.potionTargeting → resolveTargetingPrompt.
  const isTargeted = !!(script.getValidTargets && script.targetingConfig);
  if (!isTargeted && !script.resolve) return false;
  // First-turn shield: damage / debuff / forced-discard Potions (Bottled
  // Flame, Bottled Lightning, …) waste their effect under the opponent's
  // turn-1 immunity. The same gate that filters Spells/Attacks applies.
  const cd = engine._getCardDB()[cardName];
  if (cd && !isFirstTurnSafe(engine, pi, cardName, cd)) return false;
  return true;
}

// ─── Surprises ──────────────────────────────────────────────────────────
// Per user spec: "CPU will only place Surprises face-down with Heroes that
// can actually use them." Bakhm's Support Zones count as legal placements
// for Surprise Creatures.

async function placeSurprises(engine, helpers) {
  const cpuIdx = engine._cpuPlayerIdx;
  const gs = engine.gs;
  const ps = gs.players[cpuIdx];
  const cardDB = engine._getCardDB();
  const tried = new Set();

  for (let safety = 0; safety < 20; safety++) {
    if (!stillCpuTurn(engine, cpuIdx)) return;

    let pick = null;
    for (let handIdx = 0; handIdx < ps.hand.length; handIdx++) {
      const cardName = ps.hand[handIdx];
      if (tried.has(cardName)) continue;
      const cd = cardDB[cardName];
      if (!cd || (cd.subtype || '').toLowerCase() !== 'surprise') continue;
      const script = loadCardEffect(cardName);
      if (!script?.isSurprise) continue;
      const placement = pickSurprisePlacement(engine, cpuIdx, cd);
      if (!placement) continue;
      pick = { cardName, handIdx, ...placement };
      break;
    }
    if (!pick) return;

    const handLenBefore = ps.hand.length;
    cpuLog(`      → set surprise "${pick.cardName}" hero=${pick.heroIdx} bakhmSlot=${pick.bakhmSlot}`);
    await helpers.doPlaySurprise(helpers.room, cpuIdx, {
      cardName: pick.cardName,
      handIndex: pick.handIdx,
      heroIdx: pick.heroIdx,
      bakhmSlot: pick.bakhmSlot,
    });
    const shrank = ps.hand.length < handLenBefore;
    cpuLog(`      ← surprise "${pick.cardName}" ${shrank ? 'OK' : 'FAILED'}`);
    if (!shrank) tried.add(pick.cardName);
    await pauseAction(engine);
  }
}

// Returns { heroIdx, bakhmSlot } describing where to place the Surprise, or
// null if no Hero can both host AND activate it. bakhmSlot is -1 for a normal
// Surprise-Zone placement and 0..2 for a Bakhm Support-Zone slot.
function pickSurprisePlacement(engine, pi, cardData) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  const options = [];

  for (let hi = 0; hi < 3; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    // The rules allow preparing Surprises with Heroes that can't activate them,
    // but the user's CPU spec explicitly requires placement only on Heroes that
    // CAN — so we gate on the level-requirement check used by Attacks/Spells.
    if (!engine.heroMeetsLevelReq(pi, hi, cardData)) continue;

    // Regular Surprise-Zone placement — one per Hero.
    if ((ps.surpriseZones?.[hi] || []).length === 0) {
      options.push({ heroIdx: hi, bakhmSlot: -1 });
    }

    // Bakhm Support-Zone placement for Surprise Creatures only. Bakhm must
    // not be Frozen / Stunned / Negated at placement time (the handler also
    // enforces this, and will reject).
    if (cardData.cardType === 'Creature'
        && !hero.statuses?.frozen
        && !hero.statuses?.stunned
        && !hero.statuses?.negated) {
      const heroScript = loadCardEffect(hero.name);
      if (heroScript?.isBakhmHero) {
        const zones = ps.supportZones?.[hi] || [[], [], []];
        for (let z = 0; z < 3; z++) {
          if ((zones[z] || []).length === 0) {
            options.push({ heroIdx: hi, bakhmSlot: z });
          }
        }
      }
    }
  }

  if (!options.length) return null;
  return options[Math.floor(Math.random() * options.length)];
}

// Resolve the gs.potionTargeting picker that doUsePotion / doUseArtifactEffect
// open for targeted Artifacts and Potions. Uses the targeting brain's picker
// (same one that drives _getCpuTargetResponse) to choose, then calls
// doConfirmPotion to finish the play. Safety-cap iteration in case resolution
// triggers a re-enter-targeting flow (aborted picks).
async function resolveTargetingPrompt(engine, helpers) {
  for (let safety = 0; safety < 4; safety++) {
    const tgt = engine.gs.potionTargeting;
    if (!tgt || tgt.ownerIdx !== engine._cpuPlayerIdx) return;
    const picks = engine._getCpuTargetResponse(tgt.validTargets || [], tgt.config || {});
    const selectedIds = Array.isArray(picks) ? picks : [];
    cpuLog(`      → confirm targeting "${tgt.potionName}" selectedIds=${JSON.stringify(selectedIds)}`);
    await helpers.doConfirmPotion(helpers.room, engine._cpuPlayerIdx, { selectedIds });
    // If doConfirmPotion re-opened targeting (aborted pick), loop to try again
    // with fresh targets.
    if (engine.gs.potionTargeting?.potionName !== tgt.potionName) return;
  }
  // Safety exceeded — clear stuck targeting so the turn can continue.
  if (engine.gs.potionTargeting?.ownerIdx === engine._cpuPlayerIdx) {
    cpuLog('      ← resolveTargetingPrompt safety cap hit — clearing');
    engine.gs.potionTargeting = null;
  }
}

// ─── First-turn safety ────────────────────────────────────────────────
// Per user spec: on the CPU's first turn when going FIRST, the engine's
// firstTurnProtectedPlayer shield makes any damage/debuff/enemy-targeting
// effect fizzle. Skip cards that would be wasted.
//   • Attacks → always skip (they exist to deal damage).
//   • Spells → skip if getValidTargets only returns enemy-side targets.
//     Spells without getValidTargets (draws, own-side buffs, areas) play.
//   • Creatures → always play (the body lands on the board even if the
//     onPlay effect fizzles — matches "mandatory effects still fire" from
//     the user spec; Fiery Slime summons and its burn on the opponent
//     simply no-ops under the shield).
// A script can explicitly set `firstTurnSafe: true|false` to override.
// Check whether this card has at least one non-immune viable target right
// now. For Creatures we always return true — the body lands on the board
// regardless of whether any onPlay effect would fizzle into immunity.
// For Attacks / Spells with a `getValidTargets` function, we run it and
// verify that either (a) any own-side or neutral target is present (the
// spell is a buff/heal/area — self-targeting makes it useful), or (b) at
// least one enemy-side target is not immune via isTargetImmune. Cards
// that don't export getValidTargets get a "true" fallback — we can't
// tell statically, so let the picker / MCTS handle it at runtime.
function cardHasAnyViableEnemyTarget(engine, cpuIdx, cardName, cardData) {
  if (!cardData) return true;
  if (cardData.cardType === 'Creature') return true; // body always useful
  const script = loadCardEffect(cardName);
  if (!script?.getValidTargets) return true;
  let targets;
  try {
    targets = script.getValidTargets(engine.gs, cpuIdx, engine);
  } catch { return true; }
  if (!Array.isArray(targets) || targets.length === 0) return true;
  // Any own-side or ownerless target = usable (buff / heal / area).
  if (targets.some(t => t.owner === cpuIdx || t.owner == null)) return true;
  // All remaining targets are enemy-side. At least one must be non-immune.
  return targets.some(t => !isTargetImmune(engine, t));
}

// ─── Ascension / virtual-school helpers ─────────────────────────────────
// Hero card scripts may export:
//   ascensionNeedsCard(cardName, cardData, engine, pi, hi) → bool
//   ascensionProgress(engine, pi, hi) → 0..1
//   virtualSpellSchoolLevel → number or (school, engine, pi, hi) → number
//   rejectsAbility(abilityName, cardData) → bool
// The helpers below read those off the live hero's script and let the CPU
// route cards onto the hero that benefits most (Arthor's Sword, Beato's
// spells of an unclaimed school, etc.) and block wasteful attachments
// (Spell-School abilities onto Ascended Beato).

function heroNeedsCardForAscension(engine, pi, hi, cardName, cardData) {
  const hero = engine.gs.players[pi]?.heroes?.[hi];
  if (!hero?.name || hero.hp <= 0) return false;
  const script = loadCardEffect(hero.name);
  if (typeof script?.ascensionNeedsCard !== 'function') return false;
  try { return !!script.ascensionNeedsCard(cardName, cardData, engine, pi, hi); }
  catch { return false; }
}

function ascensionTargetHero(engine, pi, cardName, cardData) {
  const ps = engine.gs.players[pi];
  if (!ps) return -1;
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    if (heroNeedsCardForAscension(engine, pi, hi, cardName, cardData)) return hi;
  }
  return -1;
}

// True when the player owns at least one living, not-yet-Ascended Hero whose
// script declares an `ascensionNeedsCard` contract — i.e. the CPU has an
// active Ascension plan to work toward. Used to gate the hard-priority
// overrides (candidate pre-sort, gallery tutor preference, hand-value boost)
// so the overrides don't fire when no Ascended Hero is in play.
function playerHasUnfulfilledAscension(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return false;
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    if (hero.ascensionReady) continue;
    const script = loadCardEffect(hero.name);
    if (typeof script?.ascensionNeedsCard === 'function') return true;
  }
  return false;
}

// True when the given card would progress SOME hero's Ascension right now.
// Walks every hero and asks its script's `ascensionNeedsCard`. For Beato
// that matches Spells / Creatures of an uncollected school; for Layn/Arthor
// that matches the named Equip(s) they still need.
function cardIsAscensionCriticalForAnyHero(engine, pi, cardName, cardData) {
  const ps = engine.gs.players[pi];
  if (!ps) return false;
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    if (heroNeedsCardForAscension(engine, pi, hi, cardName, cardData)) return true;
  }
  return false;
}

// True when playing this Action-Phase candidate (Spell / Creature / Attack)
// would progress an Ascension. Restricted to `candidate.heroIdx` because
// Beato only ticks an orb when SHE is the caster — a spell of her missing
// school cast by a different hero does NOT progress her. Layn/Arthor's
// critical cards are equipments played in the Main Phase and don't reach
// this check, but the same per-hero rule applies.
function candidateProgressesAscension(engine, pi, candidate, cardDB) {
  if (!candidate || candidate.cardType === 'AbilityAction') return false;
  const hi = candidate.heroIdx;
  if (hi == null) return false;
  const cd = cardDB[candidate.cardName];
  if (!cd) return false;
  return heroNeedsCardForAscension(engine, pi, hi, candidate.cardName, cd);
}

// True when a hero is either (a) already in their Ascended form, or
// (b) in a pre-Ascension form whose script declares an `ascensionNeedsCard`
// contract. These heroes are the deck's plan pieces — losing one derails
// the whole win condition — so revive / protection / healing effects
// should treat them as the highest-priority target.
function isAscendedOrAscendableHero(engine, pi, hi) {
  const hero = engine.gs.players[pi]?.heroes?.[hi];
  if (!hero?.name) return false;
  const cd = engine._getCardDB()[hero.name];
  if (cd?.cardType === 'Ascended Hero') return true;
  const script = loadCardEffect(hero.name);
  return typeof script?.ascensionNeedsCard === 'function';
}

function targetIsAscendedOrAscendableHero(engine, t) {
  if (t?.type !== 'hero') return false;
  return isAscendedOrAscendableHero(engine, t.owner, t.heroIdx);
}

function heroRejectsAbility(engine, pi, hi, abilityName, cardData) {
  const hero = engine.gs.players[pi]?.heroes?.[hi];
  if (!hero?.name) return false;
  const script = loadCardEffect(hero.name);
  if (typeof script?.rejectsAbility !== 'function') return false;
  try { return !!script.rejectsAbility(abilityName, cardData); }
  catch { return false; }
}

function effectiveSpellSchoolLevel(engine, pi, hi, school) {
  const ps = engine.gs.players[pi];
  const hero = ps?.heroes?.[hi];
  if (!hero?.name) return 0;
  const abZones = ps.abilityZones?.[hi] || [];
  const real = engine.countAbilitiesForSchool(school, abZones);
  const heroScript = loadCardEffect(hero.name);
  const v = heroScript?.virtualSpellSchoolLevel;
  let floor = 0;
  if (typeof v === 'function') {
    try { const f = v(school, engine, pi, hi); if (f != null) floor = f; } catch {}
  } else if (typeof v === 'number') {
    floor = v;
  }
  return Math.max(real, floor);
}

function isFirstTurnSafe(engine, cpuIdx, cardName, cardData) {
  const gs = engine.gs;
  const oppIdx = cpuIdx === 0 ? 1 : 0;
  // Not turn 1, or opponent isn't the shielded side → all plays are fine.
  if (gs.firstTurnProtectedPlayer !== oppIdx) return true;
  // Creatures always play — only their effects might fizzle, not their presence.
  if (cardData.cardType === 'Creature') return true;
  // Abilities, Heroes, Areas, Permanents play freely; only attack-shaped
  // cards (Spells/Attacks/Potions) can waste damage/debuffs on the shield.
  if (cardData.cardType !== 'Attack' && cardData.cardType !== 'Spell' && cardData.cardType !== 'Potion') return true;

  const script = loadCardEffect(cardName);
  if (script?.firstTurnSafe === true) return true;
  if (script?.firstTurnSafe === false) return false;

  // Attacks all deal damage — always wasted under the first-turn shield.
  if (cardData.cardType === 'Attack') return false;

  // Spells with a declared `getValidTargets`: play only if at least one
  // non-enemy target is available (own-side, areas, or no-owner targets).
  if (cardData.cardType === 'Spell' && script?.getValidTargets) {
    try {
      const targets = script.getValidTargets(gs, cpuIdx, engine) || [];
      if (targets.length === 0) return true; // Nothing to hit either way; don't block on this.
      return targets.some(t => t.owner === cpuIdx || t.owner == null);
    } catch {
      return true; // If the script throws, fall back to playing.
    }
  }

  // No `getValidTargets` — does NOT imply "no targeting". A large class of
  // damage Spells (Icebolt, Eraser Beam, etc.) use inline
  // `ctx.promptDamageTarget` calls inside their onPlay hook rather than
  // declaring the target set upfront. Inspect the card's effect text for
  // verbs that describe enemy-directed effects; when any fire, treat as
  // UNSAFE so the CPU holds the spell instead of wasting it on a shielded
  // target. Generic drawn / self-buff / area Spells contain none of these
  // verbs and stay safe. Card authors can still force either side via the
  // `firstTurnSafe` flag above — that wins over this heuristic.
  const effect = (cardData.effect || '').toLowerCase();
  // "deal X damage" / "deals damage" — direct damage Spells.
  if (/\bdeal(s|ing)?\b[^.]*\bdamage\b/.test(effect)) return false;
  // "takes X damage" / "take damage" — indirect-target damage where the
  // opponent picks (Chain Lightning, Bottled Lightning), or where status
  // ticks land on a target. Either way the damage routes through someone
  // who is shielded turn 1.
  if (/\btake(s|n)?\b[^.]*\bdamage\b/.test(effect)) return false;
  // "X damage" without an explicit verb — covers "150 damage to each enemy"
  // and similar patterns where the verb is implicit.
  if (/\b\d+\s*damage\b/.test(effect)) return false;
  if (/\bdestroy(s|ed|ing)?\b/.test(effect)) return false;
  // Status / debuff / disruption verbs. "are Burned", "is Frozen" etc.
  // need the bare adjectives to match because the card text uses the
  // status as a state ("All targets that player controls are Burned").
  if (/\b(freeze|frozen|stun|stunned|burn|burned|poison|poisoned|negate|negated|silence|silenced|steal|stole|stolen|discard|mill)\b/.test(effect)) return false;
  // Cards that explicitly route effects through the opponent's choice
  // ("your opponent has to choose", "opponent chooses") almost certainly
  // resolve on opponent-controlled targets — wasted under the shield.
  if (/your opponent[^.]*\b(choose|choos|pick|select|discard|lose|take)/.test(effect)) return false;
  return true;
}

// ─── Additional-Action Attacks / Spells / Creatures in Main Phase ──────
// Per user spec: "Use additional Actions as soon as they are available; if an
// Attack/Spell/Creature summon is an inherent or conditional additional Action
// and the condition is met, the CPU should just fire it out!"
// Hero selection rules (Main-Phase firing):
//   • Spells    → highest matching Spell-School level (preferred)
//   • Creatures → lowest matching Spell-School level, tiebreak: most free
//                 Support Zones, then random
//   • Attacks   → highest atk
// Targeting is left to the engine's default CPU auto-responder until 2i.

async function fireAdditionalActions(engine, helpers) {
  const cpuIdx = engine._cpuPlayerIdx;
  const gs = engine.gs;
  const ps = gs.players[cpuIdx];
  const cardDB = engine._getCardDB();

  // ── Flashbang gate ──
  // Each inherent / additional Spell / Attack / Creature play counts
  // as an Action and would burn Flashbang's one-shot trigger here in
  // Main Phase 1 — leaving Action Phase impotent. Skip in MP1 so the
  // brain saves its action for Action Phase's full card pool. Allow
  // in Main Phase 2 as a fallback if Action Phase had no legal play
  // (otherwise the turn ends with the trigger wasted on nothing).
  if (isCpuFlashbanged(engine) && gs.currentPhase === 2) {
    cpuLog('  fireAdditionalActions: skipping in MP1 (Flashbanged — saving sole Action for Action Phase)');
    return;
  }

  // Remember which (card, hero) pairs we've already TRIED so we don't retry
  // the same pick if the play silently fails and leaves the card in hand.
  // This prevents a 20-iteration stall when a card passes eligibility but
  // the handler rejects it on a deeper check we didn't foresee.
  const tried = new Set();

  for (let safety = 0; safety < 20; safety++) {
    if (!stillCpuTurn(engine, cpuIdx)) return;

    let pick = null;
    for (let handIdx = 0; handIdx < ps.hand.length; handIdx++) {
      const cardName = ps.hand[handIdx];
      const cd = cardDB[cardName];
      if (!cd) continue;
      const ct = cd.cardType;
      if (ct !== 'Spell' && ct !== 'Attack' && ct !== 'Creature') continue;
      // Surprises must be set, not played (handled by placeSurprises).
      if ((cd.subtype || '').toLowerCase() === 'surprise') continue;

      // Per-card opt-out: card can declare itself "never proactively played"
      // (e.g. Golden Wings — Reaction-only). Also: a per-game runtime
      // skip list (`gs._cpuSkipProactiveNames`) lets self-play tests
      // and puzzle/scripted scenarios block specific cards from being
      // proactively played without modifying their scripts.
      const script = loadCardEffect(cardName);
      if (script?.cpuSkipProactive) continue;
      if (engine.gs?._cpuSkipProactiveNames?.has?.(cardName)) continue;
      // Hero-removal / sacrifice-style cards (Divine Gift of Sacrifice, etc.)
      // should fire in Main Phase 2 — AFTER the Action Phase has already
      // used the heroes they'd remove. Playing them in Main Phase 1 can
      // eliminate the CPU's only caster for an Action-Phase Spell / Attack,
      // silently forfeiting the turn's action. `currentPhase === 2` is
      // Main Phase 1; `=== 4` is Main Phase 2. Delayed cards naturally
      // fire when this loop runs again in the MP2 pass.
      if (script?.cpuDelayToMainPhase2 && engine.gs.currentPhase === 2) continue;
      // First-turn-protected-opponent check: skip damage/enemy-target plays
      // that would fizzle under the shield.
      if (!isFirstTurnSafe(engine, cpuIdx, cardName, cd)) continue;
      // Don't waste Attacks/Spells when every enemy target is immune.
      if (!cardHasAnyViableEnemyTarget(engine, cpuIdx, cardName, cd)) continue;

      const heroIdx = pickHeroForActionCard(engine, cpuIdx, cd, cardName);
      if (heroIdx < 0) continue;

      const key = cardName + '|' + heroIdx;
      if (tried.has(key)) continue;

      const v = engine.validateActionPlay(cpuIdx, cardName, handIdx, heroIdx, [ct]);
      if (!v) continue;
      if (!v.isMainPhase) continue;
      if (!v.isInherentAction) {
        const typeId = engine.findAdditionalActionForCard(cpuIdx, cardName, heroIdx);
        if (!typeId) continue;
      }
      pick = { cardName, handIdx, heroIdx, cardType: ct };
      break;
    }
    if (!pick) return;

    const handLenBefore = ps.hand.length;
    cpuLog(`      → fire additional ${pick.cardType.toLowerCase()} "${pick.cardName}" hero=${pick.heroIdx}`);
    let zoneSlot = -1;
    if (pick.cardType === 'Creature') {
      zoneSlot = pickCreatureZoneSlot(engine, cpuIdx, pick.heroIdx);
      if (zoneSlot < 0) { tried.add(pick.cardName + '|' + pick.heroIdx); continue; }
    }
    const actionFn = async () => {
      if (pick.cardType === 'Creature') {
        await helpers.doPlayCreature(helpers.room, cpuIdx, {
          cardName: pick.cardName,
          handIndex: pick.handIdx,
          heroIdx: pick.heroIdx,
          zoneSlot,
        });
      } else {
        await helpers.doPlaySpell(helpers.room, cpuIdx, {
          cardName: pick.cardName,
          handIndex: pick.handIdx,
          heroIdx: pick.heroIdx,
        });
      }
    };
    const committed = await mctsGatedActivation(engine, helpers, `additional ${pick.cardType} ${pick.cardName}`, actionFn);
    const shrank = ps.hand.length < handLenBefore;
    cpuLog(`      ← additional "${pick.cardName}" ${committed && shrank ? 'OK' : 'SKIPPED/FAILED'}`);
    if (!committed || !shrank) tried.add(pick.cardName + '|' + pick.heroIdx);
    await pauseAction(engine);
  }
}

// Hero selection per spec, given a card. Returns -1 if no hero qualifies.
// Enumerate every hero that could legally play this Action-Phase card.
// Returns an array of { hi, freeZones? }. Empty array means no hero is
// eligible. Used by the MCTS candidate expander to evaluate per-hero
// variations AND by pickHeroForActionCard (the non-MCTS heuristic path).
function listEligibleHeroesForActionCard(engine, pi, cardData) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  const eligible = [];
  for (let hi = 0; hi < 3; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    if (hero.statuses?.frozen || hero.statuses?.stunned) continue;
    if (hero.statuses?.negated && cardData.cardType === 'Spell') continue;
    if (!engine.heroMeetsLevelReq(pi, hi, cardData)) continue;

    if (cardData.cardType === 'Creature') {
      const zones = ps.supportZones?.[hi] || [[], [], []];
      let freeCount = 0;
      for (let z = 0; z < 3; z++) {
        if ((zones[z] || []).length === 0) freeCount++;
      }
      if (freeCount === 0) continue;
      eligible.push({ hi, freeZones: freeCount });
    } else {
      eligible.push({ hi });
    }
  }

  // Destruction Spell routing: if the caster has a hero with the
  // `forcesSingleTarget` flag (currently: Ida, the Adept of Destruction)
  // AND that hero is eligible to cast this Destruction Spell, restrict
  // the eligible list to those heroes only. Without this, the candidate
  // enumerator emits one per eligible hero — MCTS then scores "cast via
  // Ida" (single target) vs "cast via another Lv3 Destruction hero"
  // (AoE) and naturally picks the AoE route for higher raw damage,
  // silently bypassing Ida's signature restriction. Users expect Ida's
  // passive to be respected while she's on the team, so we force the
  // CPU to route Destruction Spells through her whenever she's a valid
  // caster. If no flagged hero is eligible, the unrestricted list is
  // returned unchanged.
  if (cardData?.cardType === 'Spell' && eligible.length > 1) {
    const s1 = cardData.spellSchool1;
    const s2 = cardData.spellSchool2;
    if (s1 === 'Destruction Magic' || s2 === 'Destruction Magic') {
      const flags = gs.heroFlags || {};
      const restricted = eligible.filter(e => !!flags[`${pi}-${e.hi}`]?.forcesSingleTarget);
      if (restricted.length > 0) return restricted;
    }
  }

  return eligible;
}

function pickHeroForActionCard(engine, pi, cardData, cardName) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  const eligible = listEligibleHeroesForActionCard(engine, pi, cardData);
  if (!eligible.length) return -1;

  // Ascension priority: if any eligible hero declares this card progresses
  // their ascension (e.g. Beato wants a Spell of an uncollected school),
  // route the play to that hero first. Overrides the heuristics below.
  if (cardName) {
    for (const e of eligible) {
      if (heroNeedsCardForAscension(engine, pi, e.hi, cardName, cardData)) return e.hi;
    }
  }

  if (cardData.cardType === 'Attack') {
    let topAtk = -Infinity;
    for (const e of eligible) topAtk = Math.max(topAtk, ps.heroes[e.hi].atk || 0);
    const tied = eligible.filter(e => (ps.heroes[e.hi].atk || 0) === topAtk);
    return tied[Math.floor(Math.random() * tied.length)].hi;
  }

  if (cardData.cardType === 'Spell' || cardData.cardType === 'Creature') {
    const school1 = cardData.spellSchool1;
    const school2 = cardData.spellSchool2;
    let scored = eligible.map(e => {
      let schoolLvl = 0;
      if (school1) schoolLvl = Math.max(schoolLvl, effectiveSpellSchoolLevel(engine, pi, e.hi, school1));
      if (school2) schoolLvl = Math.max(schoolLvl, effectiveSpellSchoolLevel(engine, pi, e.hi, school2));
      return { ...e, schoolLvl };
    });

    // Card-specific summoner-hero preference hook. Cards whose effect
    // depends on the host hero having specific abilities (e.g. Cosmic
    // Skeleton needs a non-Summoning spell school attached) narrow the
    // pool here. If any hero matches, restrict to those — otherwise
    // fall back to the full pool so play isn't blocked.
    if (cardName) {
      const script = loadCardEffect(cardName);
      if (typeof script?.cpuPrefersSummonerHero === 'function') {
        const preferred = scored.filter(s => {
          try { return !!script.cpuPrefersSummonerHero(engine, pi, s.hi, cardData); }
          catch { return false; }
        });
        if (preferred.length > 0) scored = preferred;
      }
    }

    if (cardData.cardType === 'Spell') {
      // Highest matching Spell-School level preferred. Tie → random.
      const topLvl = Math.max(...scored.map(s => s.schoolLvl));
      const tied = scored.filter(s => s.schoolLvl === topLvl);
      return tied[Math.floor(Math.random() * tied.length)].hi;
    }

    // Creatures: lowest matching Spell-School level preferred.
    // Tiebreak 1: most free Support Zones. Tiebreak 2: random.
    const lowLvl = Math.min(...scored.map(s => s.schoolLvl));
    const lowest = scored.filter(s => s.schoolLvl === lowLvl);
    const maxFree = Math.max(...lowest.map(s => s.freeZones));
    const mostFree = lowest.filter(s => s.freeZones === maxFree);
    return mostFree[Math.floor(Math.random() * mostFree.length)].hi;
  }

  return eligible[Math.floor(Math.random() * eligible.length)].hi;
}

function pickCreatureZoneSlot(engine, pi, heroIdx) {
  const ps = engine.gs.players[pi];
  const zones = ps.supportZones?.[heroIdx] || [[], [], []];
  const free = [];
  for (let z = 0; z < 3; z++) {
    if ((zones[z] || []).length === 0) free.push(z);
  }
  if (!free.length) return -1;
  return free[Math.floor(Math.random() * free.length)];
}

// Heuristic detection of "this Equipment increases the equipped Hero's Attack."
// Pattern-based on the card effect text. False positives are harmless (CPU just
// equips on highest-atk Hero instead of random); false negatives mean a buff
// Equipment lands on a random Hero, which is the fallback the user accepted.
function isAtkBoostEquip(cardData) {
  const effect = (cardData.effect || '').toLowerCase();
  if (!effect) return false;
  if (/attack\s+stat\s+is\s+increased\s+by/.test(effect)) return true;
  if (/\+\s*\d+\s*(?:base\s+)?attack\b/.test(effect)) return true;
  if (/\battack\s*\+\s*\d+/.test(effect)) return true;
  if (/gains?\s+\d+\s+attack/.test(effect)) return true;
  return false;
}

// ─── Abilities ──────────────────────────────────────────────────────────
// Per user spec: max 1 Ability per Hero per turn. Attach priority is
// tiered — always keep stacking onto already-present abilities until none
// can stack further, only then spread to new heroes:
//
//   TIER 1 STACK:  living hero ALREADY has this ability at lvl < 3.
//   TIER 2 NEW:    the ability is on NO living hero yet — bring it in fresh.
//   TIER 3 SPREAD: the ability is on ≥1 living hero but at max (lvl 3)
//                  or only on dead heroes — attach to a hero who doesn't
//                  have it yet, filling an empty slot.
//
// On each attach we pick the highest available tier; within a tier we pick
// randomly so the CPU doesn't deterministically funnel every ability into
// Hero 0. Resolves around abilityGivenThisTurn (1 attach per hero per turn).

function heroHasAbility(ps, hi, cardName) {
  const abZones = ps.abilityZones?.[hi] || [];
  for (const slot of abZones) {
    if ((slot || []).length > 0 && slot[0] === cardName) return true;
  }
  return false;
}

function heroHasAbilityAtMaxLevel(ps, hi, cardName) {
  const abZones = ps.abilityZones?.[hi] || [];
  for (const slot of abZones) {
    if ((slot || []).length >= 3 && slot[0] === cardName) return true;
  }
  return false;
}

function anyLivingHeroHasAbility(ps, cardName) {
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    if (heroHasAbility(ps, hi, cardName)) return true;
  }
  return false;
}

// Score an (ability, hero) attachment candidate. Higher = better. The
// dominant term is "how many spells/attacks/creatures in hand (and, less
// weighted, in deck) would become legally castable on THIS hero once this
// copy is placed", level-weighted so unlocking a Lv3 card is worth more
// than unlocking a Lv1. A small current-level bias breaks ties toward
// stacks that climb higher (Zsos'Ssar at Decay 2 → 3 beats Medea at
// Decay 1 → 2 when neither unlocks a new card), and — more importantly —
// lets lv3-in-hand dominate the choice even when the lower-level stack
// would unlock a lv2 card (600+ vs 400+).
//
// Also handles non-school abilities (Leadership, Toughness, Wisdom,
// Performance): unlock term is 0, so the tie-break elects the hero
// closest to level 3.
function scoreAbilityPlacement(engine, pi, heroIdx, cardName) {
  const ps = engine.gs.players[pi];
  const abZones = ps?.abilityZones?.[heroIdx];
  if (!abZones) return 0;
  const cardDB = engine._getCardDB();

  // Current level the hero has in this ability (max across zones).
  let currentLevel = 0;
  for (const slot of abZones) {
    if (!slot) continue;
    if (slot[0] === cardName) currentLevel = Math.max(currentLevel, slot.length);
  }
  const newLevel = currentLevel + 1;

  // Walk hand+deck ONCE to gather everything we need:
  //   • `unlock` — level-weighted count of cards that were NOT castable
  //     pre-stack (`lvl > currentLevel`) but ARE post-stack
  //     (`lvl <= newLevel`) AND require this specific school.
  //   • `maxNeededLevel` — highest level requirement across ALL cards in
  //     hand+deck that need this school. Drives the saturation gate
  //     below: stacking past this ceiling unlocks nothing the deck
  //     can't already cast.
  //   • `scalingValue` — generic bonus from cards that declare
  //     `cpuMeta.scalesWithSchool === cardName` in their script. These
  //     are spells/attacks whose effect strength keeps scaling with the
  //     school's level beyond the cast threshold (Heal: 150/200/300 by
  //     Support Magic count; Phoenix Tackle: 100/200/300 by Destruction
  //     Magic count). Optional numeric `cpuMeta.schoolScalingValue`
  //     overrides the default per-card weight (60).
  let unlock = 0;
  let maxNeededLevel = 0;
  let scalingValue = 0;
  const scan = (arr, weight) => {
    for (const cn of (arr || [])) {
      const cd = cardDB[cn];
      if (!cd) continue;
      const t = cd.cardType;
      if (t !== 'Spell' && t !== 'Attack' && t !== 'Creature') continue;
      const lvl = cd.level || 0;
      const needsThisSchool = (cd.spellSchool1 === cardName || cd.spellSchool2 === cardName);
      if (needsThisSchool && lvl > maxNeededLevel) maxNeededLevel = lvl;
      if (needsThisSchool && lvl > currentLevel && lvl <= newLevel) {
        unlock += lvl * weight;
      }
      // School-scaling spells (declared via cpuMeta — generic, no
      // per-card hardcoding here). Each scaling card in hand/deck
      // contributes `scalingValue * weight` per level reached: stacking
      // higher = stronger Heal / bigger Phoenix Tackle / etc., even
      // when the spell was already castable at the current school
      // level. Picked up dynamically from the script — any future
      // scaling card just sets the meta field.
      const script = (() => {
        try { return require('./_loader').loadCardEffect(cn); }
        catch { return null; }
      })();
      const meta = script?.cpuMeta;
      const scalesWith = meta?.scalesWithSchool;
      if (typeof scalesWith === 'string' && scalesWith === cardName) {
        const v = typeof meta.schoolScalingValue === 'number' ? meta.schoolScalingValue : 60;
        scalingValue += v * weight;
      }
    }
  };
  scan(ps.hand, 2);      // hand cards will be played sooner — worth more
  scan(ps.mainDeck, 1);  // deck cards count too, at half weight

  // Saturation gate: if stacking past `currentLevel` unlocks nothing
  // (no card in hand/deck requires this school at level > currentLevel)
  // AND no scaling spell benefits from a higher school count, the stack
  // is dead weight. Return a tiny score so the CPU prefers ANY other
  // ability placement (or doesn't bother placing this copy at all).
  // Saturation only applies when the ability IS a school the deck
  // actually uses — non-school abilities (Leadership, Toughness,
  // Wisdom, Performance) skip the gate because `maxNeededLevel === 0`
  // would otherwise misclassify them.
  const isSchoolAbility = maxNeededLevel > 0
    || scalingValue > 0
    || (cd_anyDeckCardNeedsSchool(cardDB, ps, cardName));
  if (isSchoolAbility && newLevel > maxNeededLevel && scalingValue === 0) {
    return 0;
  }

  // Scaling cards add value proportional to the new level (each level
  // reached cranks Heal/Phoenix Tackle/etc. higher). Heuristically the
  // bonus is `scalingValue * newLevel`; combined with the unlock term
  // it lets a 3-Heal deck still want Support Magic Lv3 even when the
  // deck has nothing requiring Support Magic Lv2/Lv3 to cast.
  return unlock * 100 + scalingValue * newLevel + currentLevel * 10;
}

// Cheap helper: does ANY card in hand+deck require this school for its
// cast (independent of level)? Used by the saturation gate to decide
// "is this even a school-typed ability for our deck" — non-school
// abilities (Leadership, Toughness, …) shouldn't be saturation-gated.
function cd_anyDeckCardNeedsSchool(cardDB, ps, schoolName) {
  const sources = [ps?.hand, ps?.mainDeck];
  for (const arr of sources) {
    for (const cn of (arr || [])) {
      const cd = cardDB[cn];
      if (!cd) continue;
      if (cd.spellSchool1 === schoolName || cd.spellSchool2 === schoolName) return true;
    }
  }
  return false;
}

// Predicate: would placing this ability copy be a useless saturated
// stack of a Spell-School ability? Used by the candidate-builder loop
// to drop these placements ENTIRELY (as opposed to scoring 0 and
// tying with other genuinely-zero placements like Toughness on a
// fresh hero). Saturation triggers when:
//   • The ability is one this deck actually uses as a school (some
//     hand/deck card lists it as spellSchool1/2 OR a scaling card
//     declares it via cpuMeta.scalesWithSchool).
//   • The would-be new level exceeds the highest level any hand/deck
//     card needs for that school.
//   • No hand/deck card declares scaling for this school (those
//     keep wanting more levels even past the cast threshold).
function isAbilityStackSaturated(engine, pi, heroIdx, cardName) {
  const ps = engine.gs.players[pi];
  const abZones = ps?.abilityZones?.[heroIdx];
  if (!abZones) return false;
  const cardDB = engine._getCardDB();
  let currentLevel = 0;
  for (const slot of abZones) {
    if (!slot) continue;
    if (slot[0] === cardName) currentLevel = Math.max(currentLevel, slot.length);
  }
  const newLevel = currentLevel + 1;
  // Walk hand+deck once. Same logic as scoreAbilityPlacement but only
  // computes the gate-relevant numbers (no scoring math).
  let maxNeededLevel = 0;
  let hasScaler = false;
  let isSchoolAbility = false;
  const { loadCardEffect } = require('./_loader');
  const scan = (arr) => {
    for (const cn of (arr || [])) {
      const cd = cardDB[cn];
      if (!cd) continue;
      if (cd.spellSchool1 === cardName || cd.spellSchool2 === cardName) {
        isSchoolAbility = true;
        const lvl = cd.level || 0;
        if (lvl > maxNeededLevel) maxNeededLevel = lvl;
      }
      const meta = loadCardEffect(cn)?.cpuMeta;
      if (meta?.scalesWithSchool === cardName) {
        isSchoolAbility = true;
        hasScaler = true;
      }
    }
  };
  scan(ps.hand);
  scan(ps.mainDeck);
  if (!isSchoolAbility) return false; // Non-school ability — never gated.
  if (hasScaler) return false;        // Scaling spells want more levels.
  return newLevel > maxNeededLevel;
}

async function attachAbilities(engine, helpers) {
  const cpuIdx = engine._cpuPlayerIdx;
  const gs = engine.gs;
  const ps = gs.players[cpuIdx];
  const cardDB = engine._getCardDB();

  // Once an ability has been attached this turn (by ANY tier — stack,
  // new, or spread), further copies in hand are barred from tier-3
  // placements for the rest of the turn. The goal is to hold remaining
  // copies until next turn, where they can stack on the holder(s) via
  // tier 1 instead of thinly spreading across more heroes now.
  const placedThisTurn = new Set();

  // Safety cap: at most 6 passes — one pass can attach one (hero, ability).
  // Each hero only gets one attach per turn, so the loop naturally terminates
  // once every hero is filled or no tiered candidate remains.
  for (let safety = 0; safety < 6; safety++) {
    if (!stillCpuTurn(engine, cpuIdx)) return;

    // ── Per-pass placement biases (recomputed each pass since the
    // ability board state changes between attaches). These are
    // archetype-aware overrides on top of the generic tier/score
    // logic — when a bias matches, candidates not satisfying it are
    // dropped from this pass entirely, even if they'd otherwise score
    // higher. Add new biases here as new archetypes need them.
    const heroes = ps.heroes || [];

    // Divinity → middle Hero (heroIdx 1) preference. If hero 1 can
    // legally receive a Divinity copy this pass, skip non-middle
    // heroes for any Divinity in hand. Falls through to all-hero
    // candidates if hero 1 is dead / max-leveled / locked out.
    const divinityMiddleEligible = (() => {
      const hi = 1;
      const hero = heroes[hi];
      if (!hero?.name || hero.hp <= 0) return false;
      if (ps.abilityGivenThisTurn[hi]) return false;
      if (heroHasAbilityAtMaxLevel(ps, hi, 'Divinity')) return false;
      const divCd = cardDB['Divinity'];
      if (!divCd) return false;
      if (heroRejectsAbility(engine, cpuIdx, hi, 'Divinity', divCd)) return false;
      return resolveAbilitySlot(engine, cpuIdx, hi, 'Divinity') !== null;
    })();

    // Performance → boost an existing Divinity stack if any. Maps
    // heroIdx → the zoneSlot of that hero's Divinity stack (1 or 2
    // cards deep, since Performance can't go on full Lv3 zones).
    // When the map is non-empty, Performance is filtered to those
    // (hero, slot) pairs only; resolveAbilitySlot's normal random
    // pick is overridden to land on the Divinity zone specifically.
    const performanceDivinitySlots = (() => {
      const map = new Map();
      for (let hi = 0; hi < heroes.length; hi++) {
        const hero = heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        if (ps.abilityGivenThisTurn[hi]) continue;
        const abZones = ps.abilityZones?.[hi] || [];
        for (let z = 0; z < 3; z++) {
          const zoneArr = abZones[z] || [];
          if (zoneArr.length === 0 || zoneArr.length >= 3) continue;
          if (zoneArr[0] !== 'Divinity') continue;
          map.set(hi, z);
          break;
        }
      }
      return map;
    })();

    const tier1 = [], tier2 = [], tier3 = [];
    for (let handIdx = 0; handIdx < ps.hand.length; handIdx++) {
      const cardName = ps.hand[handIdx];
      const cd = cardDB[cardName];
      if (!cd || cd.cardType !== 'Ability') continue;

      for (let hi = 0; hi < heroes.length; hi++) {
        const hero = heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        if (ps.abilityGivenThisTurn[hi]) continue;

        // Rule exception: hero already has this ability at lvl 3 — don't
        // send another copy to THIS hero (nothing to stack onto, and the
        // user explicitly excludes max-leveled heroes from stacking).
        if (heroHasAbilityAtMaxLevel(ps, hi, cardName)) continue;

        // Per-hero ability reject list (e.g. Ascended Beato refuses Spell-
        // School abilities — she's already at effective level 9 in every
        // school, so the copy is always better placed elsewhere).
        if (heroRejectsAbility(engine, cpuIdx, hi, cardName, cd)) continue;

        // ── Per-card placement biases ──
        if (cardName === 'Divinity' && divinityMiddleEligible && hi !== 1) continue;
        if (cardName === 'Performance' && performanceDivinitySlots.size > 0
            && !performanceDivinitySlots.has(hi)) continue;

        let slot = resolveAbilitySlot(engine, cpuIdx, hi, cardName);
        if (slot === null) continue;

        // Spell-School saturation gate: if stacking this Ability would
        // exceed the deck's highest needed level for that school AND
        // no scaling Spell in hand/deck wants more, drop the candidate
        // entirely. Without this filter, a saturated stack with score
        // 0 still ties with genuinely-zero non-school placements
        // (Toughness etc.) and gets randomly chosen — re-introducing
        // the dead-stack behaviour the user reported. Dropping the
        // candidate keeps the copy in hand for a turn where it can
        // land somewhere useful (e.g. on a freshly-summoned hero).
        if (isAbilityStackSaturated(engine, cpuIdx, hi, cardName)) continue;

        // Performance bias: override the random custom-placement slot
        // pick to land specifically on the hero's Divinity zone.
        if (cardName === 'Performance' && performanceDivinitySlots.has(hi)) {
          slot = performanceDivinitySlots.get(hi);
        }

        const entry = { handIdx, cardName, heroIdx: hi, zoneSlot: slot };
        const thisHeroHasIt = heroHasAbility(ps, hi, cardName);
        if (thisHeroHasIt) {
          // Tier 1 (stack): always allowed — stacking improves an existing
          // holder regardless of what was placed earlier this turn.
          tier1.push(entry);
        } else if (!anyLivingHeroHasAbility(ps, cardName)) {
          // Tier 2 (new): still allowed even if another copy of the same
          // name was placed earlier this turn — in practice this can't
          // happen (the earlier placement would have made a living hero
          // hold it, invalidating the tier-2 check here), but leave it
          // for robustness.
          tier2.push(entry);
        } else {
          // Tier 3 (spread to a fresh hero). Bar if this ability was
          // already placed this turn — save the copy in hand instead.
          if (placedThisTurn.has(cardName)) continue;
          tier3.push(entry);
        }
      }
    }

    let pick = null;
    let tierLabel = '';
    const pickBestByScore = (bucket) => {
      if (bucket.length === 0) return null;
      const scored = bucket.map(e => ({
        e, s: scoreAbilityPlacement(engine, cpuIdx, e.heroIdx, e.cardName),
      }));
      const maxS = Math.max(...scored.map(x => x.s));
      const top = scored.filter(x => x.s === maxS).map(x => x.e);
      return top[Math.floor(Math.random() * top.length)];
    };
    if (tier1.length) { pick = pickBestByScore(tier1); tierLabel = 'stack'; }
    else if (tier2.length) { pick = pickBestByScore(tier2); tierLabel = 'new'; }
    else if (tier3.length) { pick = pickBestByScore(tier3); tierLabel = 'spread'; }
    if (!pick) return;

    // Record every placement regardless of tier so tier 3 is blocked for
    // remaining copies of the same ability this turn.
    placedThisTurn.add(pick.cardName);

    cpuLog(`      → attach ability "${pick.cardName}" to hero ${pick.heroIdx} [${tierLabel}]`);
    await helpers.doPlayAbility(helpers.room, cpuIdx, {
      cardName: pick.cardName,
      handIndex: pick.handIdx,
      heroIdx: pick.heroIdx,
      zoneSlot: pick.zoneSlot,
    });
    cpuLog(`      ← ability "${pick.cardName}" done`);
    await pauseAction(engine);
  }
}

/**
 * Returns a zoneSlot to use when calling doPlayAbility, or null if the Ability
 * cannot be attached to this Hero right now.
 *   >=0  : the specific zone to place into (required for customPlacement cards)
 *   -1   : let doPlayAbility auto-place (stack onto existing or first free zone)
 *   null : not attachable
 */
function resolveAbilitySlot(engine, pi, hi, cardName) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  const hero = ps.heroes[hi];
  if (!hero?.name || hero.hp <= 0) return null;
  if (ps.abilityGivenThisTurn[hi]) return null;

  const script = loadCardEffect(cardName);
  if (script?.canAttachToHero && !script.canAttachToHero(gs, pi, hi, engine)) return null;

  const abZones = ps.abilityZones[hi] || [[], [], []];

  if (script?.customPlacement) {
    // Custom placement cards (e.g. Performance) dictate which zones are legal.
    const candidates = [];
    for (let z = 0; z < 3; z++) {
      if (script.customPlacement.canPlace(abZones[z] || [])) candidates.push(z);
    }
    if (!candidates.length) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  // Stack onto existing same-name zone (up to level 3)
  for (let z = 0; z < 3; z++) {
    const zone = abZones[z] || [];
    if (zone.length > 0 && zone[0] === cardName && zone.length < 3) return -1;
  }
  // Otherwise need a free zone
  for (let z = 0; z < 3; z++) {
    if ((abZones[z] || []).length === 0) return -1;
  }
  return null;
}

// ═══════════════════════════════════════════
//  TARGETING & CHOICE BRAIN (2i + 2j)
// ═══════════════════════════════════════════
// Installed once per engine instance. Overrides _getCpuTargetResponse and
// _getCpuGenericResponse so ALL CPU prompts follow the user's spec instead
// of the puzzle defaults ("pick first option").

// ─── MCTS plan format ─────────────────────────────────────────────────────
// engine._mctsTargetPlan is an array of entries, each one of:
//   • null
//       → placeholder for "this slot uses heuristic" (still consumed)
//   • { kind: 'target', ids: [id, ...] }
//       → scripted promptEffectTarget pick (target IDs validated vs validTargets)
//   • { kind: 'generic:<type>', value: ... }
//       → scripted promptGeneric pick (value validated vs promptData), where
//         <type> is one of 'zonePick', 'cardGallery', 'cardGalleryMulti',
//         'playerPicker'. value is the shape the engine expects as the
//         prompt's return value.
// Each CPU-controlled prompt consumes one entry (by shifting plan[0]) IF it
// matches the prompt's kind and passes validation. On mismatch, the entry
// stays in the queue and the prompt falls through to heuristics — this keeps
// the plan resilient to unexpected extra prompts in the real play.
const MCTS_BRANCHABLE_GENERIC_TYPES = ['zonePick', 'cardGallery', 'cardGalleryMulti', 'playerPicker', 'optionPicker', 'confirm'];

function mctsValidateTargetEntry(entry, validTargets) {
  if (!entry || entry.kind !== 'target') return false;
  if (!Array.isArray(entry.ids) || entry.ids.length === 0) return false;
  return entry.ids.every(id => validTargets.some(t => t.id === id));
}

function mctsValidateGenericEntry(entry, promptData) {
  if (!entry || typeof entry.kind !== 'string' || !entry.kind.startsWith('generic:')) return false;
  const type = entry.kind.slice('generic:'.length);
  if (type !== promptData.type) return false;
  const v = entry.value;
  if (!v) return false;
  if (type === 'zonePick') {
    const zones = promptData.zones || [];
    return zones.some(z => z.heroIdx === v.heroIdx && z.slotIdx === v.slotIdx);
  }
  if (type === 'cardGallery') {
    const cards = promptData.cards || [];
    return cards.some(c => c.name === v.cardName);
  }
  if (type === 'cardGalleryMulti') {
    if (!Array.isArray(v.selectedCards)) return false;
    const names = new Set((promptData.cards || []).map(c => c.name));
    return v.selectedCards.every(n => names.has(n));
  }
  if (type === 'playerPicker') {
    return v.playerIdx === 0 || v.playerIdx === 1;
  }
  if (type === 'optionPicker') {
    const options = promptData.options || [];
    return options.some(o => o.id === v.optionId);
  }
  if (type === 'confirm') {
    return v.confirmed === true;
  }
  return false;
}

// Enumerate alternative values for a branchable generic prompt. Returns an
// array of { value, label } entries usable as plan values.
function mctsEnumerateGenericAlternatives(promptData) {
  const type = promptData.type;
  if (type === 'zonePick') {
    return (promptData.zones || []).map(z => ({
      value: { heroIdx: z.heroIdx, slotIdx: z.slotIdx },
      label: `zone=h${z.heroIdx}s${z.slotIdx}`,
    }));
  }
  if (type === 'cardGallery') {
    // Sort by `_galleryScore` (stamped by `pickBestGalleryCard` during
    // the heuristic recon) descending so the first MCTS_MAX_ALTS_PER_BRANCH
    // variations actually explore the highest-impact cards. Without this,
    // a 30-card-deck gallery only tested the alphabetically-first 6 and
    // routinely missed the right pick (the user-reported "Magnetic Glove
    // tutored another Magnetic Glove" case is exactly this — ascension
    // pieces and high-impact spells got dropped because they sit later
    // alphabetically). Cards without a stamped score fall to the back.
    const cards = (promptData.cards || []).slice();
    cards.sort((a, b) => (b._galleryScore || -Infinity) - (a._galleryScore || -Infinity));
    return cards.map(c => ({
      value: { cardName: c.name, source: c.source },
      label: `card=${c.name}`,
    }));
  }
  if (type === 'cardGalleryMulti') {
    // Single-pick variations only (combinatorial explosion otherwise).
    // Same gallery-score ordering as the single-select path above.
    const cards = (promptData.cards || []).slice();
    cards.sort((a, b) => (b._galleryScore || -Infinity) - (a._galleryScore || -Infinity));
    return cards.map(c => ({
      value: { selectedCards: [c.name] },
      label: `pickOne=${c.name}`,
    }));
  }
  if (type === 'playerPicker') {
    return [
      { value: { playerIdx: 0 }, label: 'player=0' },
      { value: { playerIdx: 1 }, label: 'player=1' },
    ];
  }
  if (type === 'optionPicker') {
    return (promptData.options || []).map(opt => ({
      value: { optionId: opt.id },
      label: `opt=${opt.id}`,
    }));
  }
  if (type === 'confirm') {
    // Only cancellable confirms are interesting to branch on — non-
    // cancellable ones have no alternative. The heuristic default
    // declines (returns null) for cancellable, so the "confirm"
    // alternative is the only thing to test.
    if (!promptData.cancellable) return [];
    return [{ value: { confirmed: true }, label: 'confirm' }];
  }
  return [];
}

function installCpuBrain(engine) {
  if (engine._cpuBrainInstalled) return;
  engine._cpuBrainInstalled = true;

  const origTarget = engine._getCpuTargetResponse.bind(engine);
  const origGeneric = engine._getCpuGenericResponse.bind(engine);

  // ── Dynamic-tracking wrappers ────────────────────────────────────────
  // Captures per-hero / per-creature contribution data on the live game
  // state so the dynamic valuation has real history to reason about.
  // Wraps the engine's `runHooks` so we can observe `afterDamage`,
  // `afterCreatureDamageBatch`, `afterSpellResolved`, `onCardEnterZone`,
  // and `onTurnEnd` without each card having to opt in. The hooks fire
  // both during live play AND inside MCTS rollouts; rollout state lives
  // on the cloned snapshot, so the live hero objects never see rollout
  // mutations.
  const origRunHooks = engine.runHooks.bind(engine);
  engine.runHooks = async function (hookName, hookCtx = {}) {
    const result = await origRunHooks(hookName, hookCtx);
    try {
      if (hookName === 'afterDamage') {
        // Damage to a single hero target. `hookCtx.amount` is the actual
        // dealt amount as recorded by the engine before firing the hook.
        const target = hookCtx.target;
        const targetSide = target ? engine._findHeroOwner?.(target) : -1;
        recordDamageDealt(engine, hookCtx.source, hookCtx.amount, targetSide);
        // Kill attribution — afterDamage fires post-HP-application, so
        // target.hp <= 0 here means this damage event killed the hero.
        // Credit the source so later target valuation knows who's been
        // dropping enemy heroes.
        if (target && target.hp !== undefined && target.hp <= 0
            && targetSide != null && targetSide >= 0) {
          recordKill(engine, hookCtx.source, 'hero', targetSide);
        }
      } else if (hookName === 'afterCreatureDamageBatch') {
        // Each entry already carries the actual amount (`actualAmount`)
        // after all clamps & shields. Fall back to `amount` if the
        // batch handler didn't expose it explicitly — keeps tracking
        // alive even if the engine's internal field name evolves.
        const entries = hookCtx.entries || [];
        for (const e of entries) {
          const dealt = e.actualAmount != null ? e.actualAmount : (e.amount || 0);
          if (!(dealt > 0)) continue;
          recordDamageDealt(engine, e.source, dealt, e.inst?.owner);
          // Creature kill attribution. `currentHp` already reflects
          // the post-damage value at this hook fire.
          if (e.inst && (e.inst.counters?.currentHp ?? 1) <= 0) {
            recordKill(engine, e.source, 'creature', e.inst.owner);
          }
        }
      } else if (hookName === 'afterSpellResolved') {
        recordSpellCast(engine, hookCtx.casterIdx, hookCtx.heroIdx, hookCtx.spellCardData);
      } else if (hookName === 'onCardEnterZone') {
        const enteringCard = hookCtx.enteringCard;
        const toZone = hookCtx.toZone;
        if (enteringCard && toZone === 'support') {
          const cd = engine._getCardDB()[enteringCard.name];
          if (cd && cd.cardType === 'Creature') {
            const owner = enteringCard.controller ?? enteringCard.owner;
            const hi = enteringCard.heroIdx;
            const hero = (owner != null && hi != null && hi >= 0)
              ? engine.gs?.players?.[owner]?.heroes?.[hi]
              : null;
            if (hero?.name) {
              const stats = ensureHeroCpuStats(hero);
              stats.lastSummonTurn = engine.gs.turn;
              stats.summonsThisGame++;
            }
            const cstats = ensureCreatureCpuStats(enteringCard);
            if (cstats) cstats.summonedOnTurn = engine.gs.turn;
          }
        }
      } else if (hookName === 'onTurnEnd') {
        rolloverPerTurnStats(engine);
        // Snapshot the active player's end-of-turn gold for the
        // hoarder/spender history used by mctsOpponentGoldEconomy.
        recordEndOfTurnGold(engine);
      } else if (hookName === 'onDraw') {
        // Active player got a card. We don't have per-hero attribution
        // for most draws, so credit the active player's heroes weighted
        // by their declared `supportYield.drawsPerTurn` if any. When no
        // hero declares a draw yield, skip — the draw came from a
        // generic source (Resource Phase, Trade, …) we can't attribute.
        const ap = engine.gs?.activePlayer;
        const ps = ap != null ? engine.gs.players[ap] : null;
        if (ps) attributeAggregateValue(engine, ap, 'draw', 1);
      } else if (hookName === 'onResourceGain') {
        // Gold gained — attribute proportionally to gold-yielding heroes.
        const ap = hookCtx.playerIdx;
        const amount = hookCtx.amount;
        if (ap != null && amount > 0) {
          attributeAggregateValue(engine, ap, 'gold', amount);
        }
      }
    } catch (err) {
      // Tracking must never break the hook chain — it's a side observer.
      cpuLog(`  [tracking] ${hookName} hook observer threw:`, err.message);
    }
    return result;
  };

  // Slow down CPU prompt responses so the human can see each decision. We
  // override promptGeneric / promptEffectTarget to replace the engine's
  // built-in 50ms delay (too fast to follow) with a human-pacing delay.
  // Puzzle mode is unaffected — puzzles don't install the CPU brain.
  const origPromptGeneric = engine.promptGeneric.bind(engine);
  engine.promptGeneric = async function (playerIdx, promptData) {
    // ── Gerrymander redirect (BEFORE the CPU/human dispatch below) ──
    // The original engine.promptGeneric also runs this redirect, but
    // the wrapper short-circuits CPU prompts and would otherwise skip
    // it. Re-running here ensures the redirect fires regardless of
    // who's prompted. The `_gerryRewritten` guard inside the helper
    // prevents double-application if origPromptGeneric is reached.
    const _gerryRedirect = engine._tryGerrymanderRedirect(playerIdx, promptData);
    if (_gerryRedirect) {
      playerIdx = _gerryRedirect.targetPi;
      promptData = _gerryRedirect.rewrittenData;
    }

    // ── MCTS scripted plan (peek, consume only on match) ──
    let scriptedValue = null;
    if (engine.isCpuPlayer(playerIdx) && Array.isArray(engine._mctsTargetPlan) && engine._mctsTargetPlan.length > 0) {
      const head = engine._mctsTargetPlan[0];
      if (head === null) {
        engine._mctsTargetPlan.shift(); // null placeholder → consume, use heuristic
      } else if (mctsValidateGenericEntry(head, promptData)) {
        engine._mctsTargetPlan.shift();
        scriptedValue = head.value;
      }
      // else: leave in queue for a future matching prompt.
    }

    // During MCTS rollouts (fast mode), BOTH players' prompts auto-respond
    // — otherwise non-CPU reaction-window prompts would hang forever since
    // there's no socket to resolve them. Cancellable → decline, mandatory
    // → CPU brain's default pick.
    if (engine._fastMode && !engine.isCpuPlayer(playerIdx)) {
      if (promptData.cancellable) return null;
      return engine._getCpuGenericResponse(promptData, playerIdx);
    }
    if (engine.isCpuPlayer(playerIdx)) {
      if (!engine._fastMode) await engine._delay(CPU_PROMPT_DELAY);
      const picked = scriptedValue != null ? scriptedValue : engine._getCpuGenericResponse(promptData, playerIdx);
      // ── MCTS recon recording ──
      // Only record branchable types — confirms/forceDiscards don't enumerate
      // alternatives we care to explore.
      if (Array.isArray(engine._mctsTargetRecord) && MCTS_BRANCHABLE_GENERIC_TYPES.includes(promptData.type)) {
        engine._mctsTargetRecord.push({
          kind: `generic:${promptData.type}`,
          title: promptData.title,
          cancellable: !!promptData.cancellable,
          alternatives: mctsEnumerateGenericAlternatives(promptData),
          picked,
          wasScripted: scriptedValue != null,
        });
      }
      return picked;
    }
    return origPromptGeneric(playerIdx, promptData);
  };

  const origPromptEffectTarget = engine.promptEffectTarget.bind(engine);
  engine.promptEffectTarget = async function (playerIdx, validTargets, config = {}) {
    if (!validTargets || validTargets.length === 0) return [];

    // ── MCTS scripted plan (peek, consume only on match) ──
    let scriptedPick = null;
    if (engine.isCpuPlayer(playerIdx) && Array.isArray(engine._mctsTargetPlan) && engine._mctsTargetPlan.length > 0) {
      const head = engine._mctsTargetPlan[0];
      if (head === null) {
        engine._mctsTargetPlan.shift();
      } else if (mctsValidateTargetEntry(head, validTargets)) {
        engine._mctsTargetPlan.shift();
        scriptedPick = head.ids;
      }
      // else: leave in queue.
    }

    // ── Fast-mode non-CPU: auto-respond (prevents hangs in rollouts) ──
    if (engine._fastMode && !engine.isCpuPlayer(playerIdx)) {
      if (config.cancellable) return [];
      return engine._getCpuTargetResponse(validTargets, config, playerIdx);
    }

    if (engine.isCpuPlayer(playerIdx)) {
      if (!engine._fastMode) await engine._delay(CPU_PROMPT_DELAY);
      // Pass playerIdx through so the picker uses the CARD CONTROLLER's
      // own/enemy sides — critical for reactive cards fired on the
      // opponent's turn (Shield of Life, Cure, etc.).
      const picked = scriptedPick || engine._getCpuTargetResponse(validTargets, config, playerIdx);
      // ── MCTS recon recording ──
      if (Array.isArray(engine._mctsTargetRecord)) {
        const maxSel = Math.max(1, config.maxTotal || config.maxSelect || 1);
        engine._mctsTargetRecord.push({
          kind: 'target',
          title: config.title,
          cancellable: !!config.cancellable,
          maxSelect: maxSel,
          validTargets: validTargets.map(t => ({
            id: t.id,
            owner: t.owner,
            heroIdx: t.heroIdx,
            name: t.name,
            hp: t.hp,
            type: t.type,
          })),
          picked,
          wasScripted: !!scriptedPick,
        });
      }
      return picked;
    }
    return origPromptEffectTarget(playerIdx, validTargets, config);
  };

  // promptGeneric wrapper — same playerIdx passthrough guarantee. Without
  // this, reactive/generic prompts fired during the opponent's turn hit
  // the engine default's _cpuPlayerIdx fallback and flip own/enemy logic
  // (same class of bug as promptEffectTarget above).

  engine._getCpuTargetResponse = function (validTargets, config = {}, promptedPlayerIdx) {
    try {
      const picked = cpuPickTargets(engine, validTargets, config, promptedPlayerIdx);
      if (picked !== undefined) return picked;
    } catch (err) {
      console.error('[CPU brain] target picker threw:', err.message);
    }
    return origTarget(validTargets, config, promptedPlayerIdx);
  };

  engine._getCpuGenericResponse = function (promptData, promptedPlayerIdx) {
    try {
      const res = cpuGenericChoice(engine, promptData, promptedPlayerIdx);
      if (res !== undefined) return res;
    } catch (err) {
      console.error('[CPU brain] generic chooser threw:', err.message, err.stack);
    }
    return origGeneric(promptData, promptedPlayerIdx);
  };
}

// ─── Target picker ─────────────────────────────────────────────────────
// Returns an array of selected target IDs (same contract as
// _getCpuTargetResponse) or undefined to let the default handler run.

function cpuPickTargets(engine, validTargets, config, promptedPlayerIdx) {
  if (!Array.isArray(validTargets) || validTargets.length === 0) {
    return config.cancellable ? [] : undefined;
  }
  // `promptedPlayerIdx` is the CARD CONTROLLER — the player whose prompt
  // this is. Fall back to _cpuPlayerIdx only if the caller didn't pass it
  // (older call sites). Using the active player for reactive cards fired
  // on the OPPONENT's turn (Shield of Life, Cure) flipped own/enemy and
  // caused the CPU to heal the enemy.
  const cpuIdx = promptedPlayerIdx != null ? promptedPlayerIdx : engine._cpuPlayerIdx;
  const cardName = config.title;
  const cd = cardName ? engine._getCardDB()[cardName] : null;

  // Per-card target override: cards can export `cpuResponse(engine, 'target',
  // { validTargets, config })` and return an array of selected IDs. Falls
  // through to the generic targeting brain if the card returns undefined.
  if (cardName) {
    const script = loadCardEffect(cardName);
    if (script?.cpuResponse) {
      try {
        const override = script.cpuResponse(engine, 'target', { validTargets, config });
        if (override !== undefined) return override;
      } catch (err) {
        console.error(`[CPU] ${cardName} cpuResponse (target) threw:`, err.message);
      }
    }
  }

  // Classify by whom the targets affect. If everything points to the opponent,
  // it's an enemy effect; all-own → ally effect; mixed → fall back to enemy
  // logic (most damage cards let you pick enemy despite "any" side flag).
  const ownTargets = validTargets.filter(t => t.owner === cpuIdx);
  const enemyTargets = validTargets.filter(t => t.owner != null && t.owner !== cpuIdx);

  // Attack cards that reach this picker weren't classified as a buff/heal
  // above — they deal damage. Targeting own units just self-damages for
  // no gain. Filter own-side targets out when ANY enemy target is
  // available. The notable trap this closes is Ghuanjun: his afterDamage
  // grants own targets an 'immortal' buff that expires at the END of
  // his own turn, so attacking own units to "buff" them is almost
  // useless — without this drop, the CPU would keep picking own targets
  // because the picker otherwise falls through to the enemy branch only
  // when ownTargets is empty. `config.isBuff === true` still gets
  // respected (looksLikeBuff catches those above). `allowOwnSide`
  // lets a rare attack-shaped card opt out of this guard.
  if (cd?.cardType === 'Attack' && ownTargets.length > 0 && enemyTargets.length > 0
      && !config.allowOwnSide) {
    ownTargets.length = 0;
  }

  // Self-damage prompts (Fire Bolts recoil, any future "pay HP" cost):
  // the prompt asks the caster to pick an OWN target that will take
  // real damage. The generic ally-fallback below would shuffle and
  // pick a random hero — a coin flip that has been observed killing
  // the CPU's last living hero and ending the game on its own turn.
  // Route to the harm-minimizing picker instead.
  const isSelfDamage = config.selfDamage === true
    || /recoil/i.test(config.title || '')
    || /recoil/i.test(config.description || '');
  if (isSelfDamage && ownTargets.length > 0) {
    const picked = pickSelfDamageTarget(engine, ownTargets, config);
    if (picked) return [picked.id];
  }

  // Self-status cards (Sickly Cheese self-poison, Zsos'Ssar Decay-cost
  // self-poison, …). The card's `targetingConfig.appliesStatus` names the
  // status it lands, and the picker routes to status-beneficiary scoring
  // so Fiona / Stellan get preferentially hit (and Layn is avoided).
  // Runs BEFORE the heal/buff heuristics because those would otherwise
  // win ties by shuffling randomly and wash out the signal.
  const appliesStatus = typeof config.appliesStatus === 'string' ? config.appliesStatus : null;
  if (appliesStatus && ownTargets.length > 0) {
    const picked = pickSelfStatusTarget(engine, ownTargets, appliesStatus);
    if (picked) return [picked.id];
  }

  // Determine intent. Healing/buff cards typically have side='own' or only
  // own-targets valid. Damage cards have baseDamage or damageType, or target
  // the opponent side.
  const isHealCard = looksLikeHeal(cd, config);
  const isBuffCard = !isHealCard && looksLikeBuff(cd, config);

  // Multi-select bound: promptMultiTarget passes `maxTotal`, simpler callers
  // pass `maxSelect`. Clamp to ≥1 and to total target count so we don't try
  // to return more IDs than exist.
  const totalEligible = ownTargets.length + enemyTargets.length;
  const maxSelect = Math.min(totalEligible, Math.max(1, config.maxTotal || config.maxSelect || 1));

  if (isHealCard) {
    const picks = pickHealTargetsMulti(engine, ownTargets, enemyTargets, cardName, maxSelect);
    if (picks.length) return picks.map(p => p.id);
    // No sensible heal target (no injured own things, no Overheal-Shocked
    // enemy). DO NOT fall through to enemy-damage targeting — that would
    // heal an enemy hero for free. Decline the cancellable prompt so the
    // heal stays in hand for a better moment.
    if (config.cancellable !== false) return [];
    // Forced heal with no great target — heal the highest-HP own hero as a
    // no-op fallback. Never heal an enemy unless Overheal-Shocked.
    const fallback = ownTargets.find(t => t.type === 'hero') || ownTargets[0];
    return fallback ? [fallback.id] : [];
  }

  if (isBuffCard) {
    const picks = pickBuffTargetsMulti(engine, ownTargets, cardName, maxSelect);
    if (picks.length) return picks.map(p => p.id);
  }

  // Enemy-side damage targeting (or ambiguous — default to enemy side).
  if (enemyTargets.length > 0) {
    const damage = inferDamage(config);
    const picks = pickEnemyTargets(engine, enemyTargets, damage, maxSelect);
    if (picks.length) return picks.map(p => p.id);
    // All enemy targets are immune. If the prompt is cancellable, decline
    // to avoid wasting the Attack/Spell/effect; the card stays in hand.
    // If it's not cancellable, fall through so we still pick SOMETHING.
    const allEnemyImmune = enemyTargets.every(t => isTargetImmune(engine, t));
    if (allEnemyImmune && config.cancellable !== false) return [];
  }

  // Ally-only fallthrough (e.g. cards whose side is 'own' but don't look
  // like heal/buff by our heuristic — revive, restore, etc.). Ascended /
  // Ascendable heroes come first so Resuscitation Potion / Elixir of
  // Immortality / any own-side revive-shaped effect prefers them over a
  // generic hero.
  if (ownTargets.length > 0) {
    const ascended = shuffle(ownTargets.filter(t => targetIsAscendedOrAscendableHero(engine, t)));
    const others = shuffle(ownTargets.filter(t => !targetIsAscendedOrAscendableHero(engine, t)));
    const ordered = [...ascended, ...others];
    return ordered.slice(0, maxSelect).map(t => t.id);
  }

  return undefined; // Let default pick from the full list
}

// Multi-select version of pickHealTarget. Picks up to maxSelect own targets
// that most need healing/cleansing, plus any enemy hero with Overheal Shock
// attached (free kill). Falls back to the single-pick ordering when only
// one target is allowed.
function pickHealTargetsMulti(engine, ownTargets, enemyTargets, cardName, maxSelect) {
  if (maxSelect <= 1) {
    const single = pickHealTarget(engine, ownTargets, enemyTargets, cardName, null);
    return single ? [single] : [];
  }
  const gs = engine.gs;
  const picks = [];
  const seen = new Set();
  const add = (t) => {
    if (!t || seen.has(t.id) || picks.length >= maxSelect) return;
    seen.add(t.id);
    picks.push(t);
  };
  // 1) Overheal Shock lethal on enemy heroes (always valuable)
  for (const t of enemyTargets) {
    if (t.type === 'hero' && heroHasAttachment(engine, t, 'Overheal Shock')) add(t);
  }
  // 2) Own targets — skip own-hero with Overheal Shock (would kill us)
  const safeOwn = ownTargets.filter(t =>
    !(t.type === 'hero' && heroHasAttachment(engine, t, 'Overheal Shock')));
  // 3) Fresh Lifeforce Howitzer priority
  for (const t of safeOwn) {
    if (targetHasFreshLifeforceHowitzer(engine, t)) add(t);
  }
  // 4) Injured heroes — Ascended / Ascendable heroes first, then by HP
  //    missing desc. See `pickHealTarget` for the rationale.
  const ownHeroesByMissing = safeOwn
    .filter(t => t.type === 'hero')
    .map(t => {
      const h = gs.players[t.owner]?.heroes?.[t.heroIdx];
      return { t, missing: (h?.maxHp || 0) - (h?.hp || 0) };
    })
    .filter(x => x.missing > 0)
    .sort((a, b) => {
      const aAsc = targetIsAscendedOrAscendableHero(engine, a.t) ? 1 : 0;
      const bAsc = targetIsAscendedOrAscendableHero(engine, b.t) ? 1 : 0;
      if (aAsc !== bAsc) return bAsc - aAsc;
      return b.missing - a.missing;
    });
  for (const { t } of ownHeroesByMissing) add(t);
  // 5) Own creatures by lowest HP
  const ownCreatures = safeOwn
    .filter(t => t.type === 'creature' || t.type === 'equip')
    .map(t => {
      const inst = t.cardInstance || findSupportInstance(engine, t);
      return { t, hp: creatureCurrentHp(engine, inst, t) ?? Infinity };
    })
    .sort((a, b) => a.hp - b.hp);
  for (const { t } of ownCreatures) add(t);
  return picks;
}

// Multi-select version of pickBuffTarget. Prefers heroes without the buff
// already applied; falls back to heroes with it, then creatures. Ascended
// / Ascendable heroes float to the front of each hero bucket.
function pickBuffTargetsMulti(engine, ownTargets, cardName, maxSelect) {
  if (maxSelect <= 1) {
    const single = pickBuffTarget(engine, ownTargets, cardName);
    return single ? [single] : [];
  }
  const heroes = ownTargets.filter(t => t.type === 'hero');
  const creatures = ownTargets.filter(t => t.type !== 'hero');
  const ascFirst = (a, b) => {
    const aAsc = targetIsAscendedOrAscendableHero(engine, a) ? 1 : 0;
    const bAsc = targetIsAscendedOrAscendableHero(engine, b) ? 1 : 0;
    return bAsc - aAsc;
  };
  const heroesWithout = shuffle(heroes.filter(t => !targetHasBuff(engine, t, cardName))).sort(ascFirst);
  const heroesWith = shuffle(heroes.filter(t => targetHasBuff(engine, t, cardName))).sort(ascFirst);
  const creatureShuffled = shuffle(creatures);
  const ordered = [...heroesWithout, ...heroesWith, ...creatureShuffled];
  return ordered.slice(0, maxSelect);
}

// ─── Generic choice picker ─────────────────────────────────────────────

function cpuGenericChoice(engine, promptData, promptedPlayerIdx) {
  const type = promptData.type;
  // Use the CARD CONTROLLER's pi (not the active player) so reactive
  // prompts fired during the opponent's turn answer from their OWN side.
  const cpuIdx = promptedPlayerIdx != null ? promptedPlayerIdx : engine._cpuPlayerIdx;

  // ── Gerrymander redirect handling ──
  // When `_gerryRewritten` is set, the prompt was redirected from opp
  // to us (the Gerrymander owner). We're picking FOR opp — invert the
  // intent. The card's per-card `cpuGerrymanderResponse` (looked up by
  // the ORIGINAL title before the Gerrymander prefix was added) names
  // the option that's worst for opp; if missing, fall back to safe
  // defaults below.
  if (promptData._gerryRewritten) {
    const origTitle = promptData._gerryOriginalTitle || '';
    const script = origTitle ? loadCardEffect(origTitle) : null;
    if (script?.cpuGerrymanderResponse) {
      try {
        const override = script.cpuGerrymanderResponse(engine, cpuIdx, promptData);
        if (override !== undefined) return override;
      } catch (err) {
        console.error(`[CPU] ${origTitle} cpuGerrymanderResponse threw:`, err.message);
      }
    }
    // Confirm-cancellable default: decline. Most "may" prompts give
    // the prompted player a beneficial option; declining hurts them.
    if (type === 'confirm' && promptData.cancellable) return null;
    // optionPicker default: pick the first option. Safer than picking
    // the last (which the standard heuristic does — usually "all-in").
    if (type === 'optionPicker') {
      const options = promptData.options || [];
      if (options.length > 0) return { optionId: options[0].id };
    }
    // Fall through to standard handling for other prompt types.
  }

  // Per-card override wins over the generic brain. Card authors export
  // `cpuResponse(engine, promptKind, promptData)` to customize how the CPU
  // responds to prompts their card raises (Barker hero-ability, etc.).
  const cardName = promptData._gerryOriginalTitle || promptData.title || promptData.source;
  if (cardName) {
    const script = loadCardEffect(cardName);
    if (script?.cpuResponse) {
      try {
        const override = script.cpuResponse(engine, 'generic', promptData);
        if (override !== undefined) return override;
      } catch (err) {
        console.error(`[CPU] ${cardName} cpuResponse threw:`, err.message);
      }
    }
  }

  // Reactions: prompt type='confirm' that surfaces a specific card via
  // `showCard` (the "this is THE card you're being asked to activate"
  // signal). Covers reaction confirmLabels beyond the original
  // "Activate" prefix — Cosmic Malfunction's "🌌 Negate!", Deepsea
  // Idol's "🌊 Negate!", Bamboo Staff's "🕸️ Redirect!", Bamboo
  // Shield's "🛡️ Defend!", etc. Any cancellable card-effect confirm
  // with `showCard` is a reaction opt-in; route through the smarter
  // decision-maker rather than the blanket-decline branch below.
  if (type === 'confirm'
      && promptData.cancellable
      && (promptData.showCard
          || (promptData.confirmLabel && /activate/i.test(promptData.confirmLabel)))) {
    return cpuReactionDecision(engine, promptData);
  }

  // ── Ability-attach prompts (Sacrifice to Divinity, Megu, Alex, …) ──
  // The card hands us an eligibleHeroIdxs allowlist + an ability cardName
  // and asks "which hero gets it?". Mirror the same per-card placement
  // biases the in-hand attachAbilities loop applies — Divinity always
  // prefers the middle hero (heroIdx 1) when it's in the allowlist.
  if (type === 'abilityAttachTarget') {
    const eligible = Array.isArray(promptData.eligibleHeroIdxs)
      ? promptData.eligibleHeroIdxs
      : null;
    const attachName = promptData.cardName;
    const pickHero = (hi) => ({ heroIdx: hi });
    if (attachName === 'Divinity' && eligible && eligible.includes(1)) {
      return pickHero(1);
    }
    if (eligible && eligible.length > 0) {
      return pickHero(eligible[0]);
    }
    return null;
  }

  // Confirm prompts fall into two shapes:
  //   • `promptConfirmEffect` / similar: caller checks `result?.confirmed === true`
  //   • Plain reaction/trigger confirm: caller checks `if (result)`
  // Returning `{ confirmed: true }` satisfies both. Returning null declines.
  if (type === 'confirm') {
    // Cancellable confirms = OPTIONAL actions (combo follow-ups, sacrifice
    // costs, "do you want to X" opt-ins). Default to DECLINE — opting into a
    // follow-up without the CPU knowing how to execute it leaves the turn
    // stuck (e.g. Ghuanjun combo sets _preventPhaseAdvance and expects a
    // second action). Cards that need a "yes" on the CPU's behalf should
    // export `cpuResponse` to override (checked above this branch).
    // Reactions (confirmLabel ~ "Activate!") are handled in the branch above.
    if (promptData.cancellable) return null;
    return { confirmed: true };
  }

  // Player-picker prompts (Divine Gift of Fire, etc.). Default: pick the
  // HUMAN — most player-picker effects are damage / debuff flavored. A card
  // whose intent is self-affecting can opt out via its own `cpuResponse`.
  if (type === 'playerPicker') {
    return { playerIdx: cpuIdx === 0 ? 1 : 0 };
  }

  // Option-picker prompts (Siphem "remove N counters", Reincarnation mode,
  // Wheels mode, etc.). The engine's default declines cancellable prompts;
  // that was making Siphem never fire. Default to the LAST option — for
  // ramp-style cards ("remove more for more damage") this is usually the
  // "all in" choice. MCTS variations explore other options and pick the
  // best-scoring one; this fallback is for live play without MCTS branching.
  if (type === 'optionPicker') {
    const options = promptData.options || [];
    if (!options.length) return null;
    // Gold-vs-draw auto-detection: any optionPicker offering exactly one
    // `gold` option and one `draw` option (Willy today) gets routed through
    // the multi-factor evaluator. Covers future cards with the same choice
    // for free. Cards can still override via their own `cpuResponse`
    // (checked at the top of cpuGenericChoice).
    const hasGold = options.some(o => o.id === 'gold');
    const hasDraw = options.some(o => o.id === 'draw');
    if (hasGold && hasDraw && options.length === 2) {
      const pick = mctsValueGoldVsDraw(engine, cpuIdx);
      return { optionId: pick };
    }
    return { optionId: options[options.length - 1].id };
  }

  // Blind-hand-pick prompts — Thieving Strike, Loot the Leftovers, any
  // "steal N face-down cards from your opponent's hand" effect. The
  // engine's default declines cancellable prompts (Thieving Strike's
  // post-hit prompt is cancellable, so the steal silently fizzled),
  // and falls through to a generic `return true` for non-cancellable
  // ones (Loot the Leftovers — `prompt = true` has no
  // `selectedIndices`, so the steal validates to an empty list and
  // returns `{ stolen: [] }`). Both paths drop the entire steal.
  // Always pick: random distinct indices, capped at maxSelect /
  // oppHandCount. The pick is genuinely blind by card spec — we
  // deliberately don't peek at opponent's hand.
  if (type === 'blindHandPick') {
    const oppHandCount = promptData.oppHandCount || 0;
    const maxSelect = Math.max(1, promptData.maxSelect || 1);
    if (oppHandCount === 0) return { selectedIndices: [] };
    const pool = Array.from({ length: oppHandCount }, (_, i) => i);
    const picked = [];
    const n = Math.min(maxSelect, oppHandCount);
    for (let i = 0; i < n; i++) {
      const r = Math.floor(Math.random() * pool.length);
      picked.push(pool[r]);
      pool.splice(r, 1);
    }
    return { selectedIndices: picked };
  }

  // Card-gallery prompts (deck searches, tutors, ascension bonuses).
  // The user-reported case: Magnetic Glove tutored another Magnetic
  // Glove because the heuristic picked the gallery's first random
  // card and the variation cap (6 alts) only explored alphabetically-
  // first alternatives. Score every gallery card by
  // `estimateHandCardValueFor` (same valuation `evaluateState` uses
  // for hand-value scoring) and pick the highest-scoring — duplicates
  // of cards already in hand drop to half value, ascension-critical
  // cards floor at 80, unaffordable cards drop to 5, etc. MCTS still
  // overrides via `mctsBuildVariationsFromRecord` (which now also
  // sorts alts by this score), so the heuristic only seeds the recon
  // with a sensible pick — variations still test alternatives.
  if (type === 'cardGallery') {
    const cards = promptData.cards || [];
    if (!cards.length) return null;
    const c = pickBestGalleryCard(engine, cpuIdx, cards);
    return { cardName: c.name, source: c.source };
  }
  if (type === 'cardGalleryMulti') {
    const cards = promptData.cards || [];
    if (!cards.length) return { selectedCards: [] };
    const c = pickBestGalleryCard(engine, cpuIdx, cards);
    return { selectedCards: [c.name] };
  }
  // Card-name picker — the prompt Luck raises on activation. Engine default
  // declines cancellable prompts, so Luck never fired for the CPU. Free
  // activation with no downside: the right answer is always "pick the most
  // likely card the opponent will play next." User-sanctioned small cheat:
  // peek at opp.hand / mainDeck / potionDeck and weight by likelihood. Log
  // of last turn's plays adds a pattern bonus for cards opp already cast.
  if (type === 'cardNamePicker') {
    const allowed = promptData.cardNames;
    if (!Array.isArray(allowed) || allowed.length === 0) return null;
    const oppIdx = cpuIdx === 0 ? 1 : 0;
    const opp = engine.gs.players[oppIdx];
    if (!opp) return null;
    const cardDB = engine._getCardDB();
    const allowedSet = new Set(allowed);
    // Heroes / Ascended Heroes / Tokens never "play from hand" and can't
    // trigger Luck — exclude so we don't waste the declaration on them.
    const isPlayable = (name) => {
      if (!allowedSet.has(name)) return false;
      const cd = cardDB[name];
      if (!cd) return false;
      const t = cd.cardType;
      return t !== 'Hero' && t !== 'Ascended Hero' && t !== 'Token';
    };
    const scores = new Map();
    const bump = (name, amt) => {
      if (!isPlayable(name)) return;
      scores.set(name, (scores.get(name) || 0) + amt);
    };
    // Opp's hand — about to be played, strongest signal.
    for (const n of (opp.hand || [])) bump(n, 4);
    // Main deck + potion deck — future draws, ~1 per turn.
    for (const n of (opp.mainDeck || [])) bump(n, 1);
    for (const n of (opp.potionDeck || [])) bump(n, 1);
    // Last-turn plays via the engine's action log. Each entry carries the
    // turn it fired on; we bump anything tagged `card_played` /
    // `creature_summoned` for opp in `turn === gs.turn - 1`.
    const prevTurn = (engine.gs.turn || 1) - 1;
    if (prevTurn >= 1) {
      const oppName = opp.username;
      const log = engine.actionLog || [];
      for (let i = log.length - 1; i >= 0; i--) {
        const e = log[i];
        if (e.turn == null) continue;
        if (e.turn < prevTurn) break;
        if (e.turn !== prevTurn) continue;
        if (e.player !== oppName) continue;
        if (!e.card) continue;
        if (e.type === 'card_played' || e.type === 'creature_summoned') {
          bump(e.card, 3);
        }
      }
    }
    if (scores.size === 0) {
      // Opponent is empty (or holds only heroes / tokens) — still declare
      // SOMETHING so Luck fires. Free activation, no downside.
      const fallback = allowed.find(isPlayable);
      return fallback ? { cardName: fallback } : null;
    }
    let best = null, bestScore = -Infinity;
    for (const [name, sc] of scores) {
      if (sc > bestScore) { best = name; bestScore = sc; }
    }
    return best ? { cardName: best } : null;
  }
  if (type === 'zonePick') {
    const zones = promptData.zones || [];
    if (!zones.length) return null;
    const z = zones[Math.floor(Math.random() * zones.length)];
    return { heroIdx: z.heroIdx, slotIdx: z.slotIdx };
  }
  // Hand-pick (mulligan) prompts: Leadership, Horn in a Bottle, etc.
  // These expect `{ selectedCards: [{ cardName, handIndex }, ...] }`.
  // Use the same valuation as forced-discard: scarce cards, Ascended Heroes,
  // and evaluator-rewarded cards (Cardinal Beasts, OHS pieces) are preserved;
  // low-value filler gets mulliganed. With minSelect=0 (Horn in a Bottle)
  // we may return zero cards for a pure +1 draw; with minSelect≥1
  // (Leadership) we always return at least that many of the worst cards.
  if (type === 'handPick') {
    const ps = engine.gs.players[cpuIdx];
    if (!ps?.hand?.length) return null;
    const eligible = promptData.eligibleIndices || ps.hand.map((_, i) => i);
    if (!eligible.length) return null;
    const maxSelect = promptData.maxSelect || 1;
    const minSelect = promptData.minSelect != null ? promptData.minSelect : 1;
    const cardDB = engine._getCardDB();
    const baseScore = (() => {
      try { return evaluateState(engine, cpuIdx); } catch { return 0; }
    })();
    const scored = eligible.map(idx => {
      const name = ps.hand[idx];
      const cd = cardDB[name];
      let value = 0;
      const countIn = (arr) => (arr || []).filter(c => c === name).length;
      const copiesLeft = countIn(ps.hand) + countIn(ps.mainDeck) + countIn(ps.potionDeck);
      if (copiesLeft === 1) value += 100;
      else if (copiesLeft === 2) value += 25;
      if (cd?.cardType === 'Ascended Hero') value += 200;
      const removed = ps.hand[idx];
      ps.hand.splice(idx, 1);
      let scoreWithout = baseScore;
      try { scoreWithout = evaluateState(engine, cpuIdx); } catch {}
      ps.hand.splice(idx, 0, removed);
      value += Math.max(0, baseScore - scoreWithout);
      return { idx, name, value };
    });
    scored.sort((a, b) => a.value - b.value);
    // Threshold 50 ≈ "not scarce, not a tracked combo piece" — safe to return.
    // Past minSelect, stop once we'd be shuffling back something useful.
    const selected = [];
    for (const s of scored) {
      if (selected.length >= maxSelect) break;
      if (selected.length >= minSelect && s.value >= 50) break;
      selected.push({ cardName: s.name, handIndex: s.idx });
    }
    return { selectedCards: selected };
  }
  if (type === 'pickHandCard') {
    const ps = engine.gs.players[engine._cpuPlayerIdx];
    if (!ps?.hand?.length) return null;
    const eligible = promptData.eligibleIndices || ps.hand.map((_, i) => i);
    if (!eligible.length) return null;
    const idx = eligible[Math.floor(Math.random() * eligible.length)];
    return { cardName: ps.hand[idx], handIndex: idx };
  }
  // Forced/voluntary discards: pick the LEAST valuable card. "Value" is
  // derived from (a) the evaluator delta if the card were removed — this
  // automatically protects Cardinal Beasts, OHS/Howitzer setup pieces,
  // and any other card the evaluator already rewards as in-hand/in-deck,
  // (b) scarcity (cards with only 1 copy remaining across hand+deck are
  // preserved over plentiful copies), and (c) card type — Ascended Hero
  // cards are irreplaceable plan pieces and almost always worth keeping.
  // Avoids hard-coded per-card rules; the evaluator handles the logic.
  if (type === 'forceDiscard' || type === 'forceDiscardCancellable') {
    const ps = engine.gs.players[cpuIdx];
    if (!ps?.hand?.length) return null;
    let eligible = promptData.eligibleIndices || ps.hand.map((_, i) => i);
    // Defensive resolving-card exclusion. When a script prompts for a
    // forced discard / delete during its own resolve and forgets to
    // pass eligibleIndices, the prompt accepts ANY hand card —
    // including the still-in-hand resolving card itself. The CPU's
    // discard scorer would then happily nominate Wheels itself as
    // a "delete 2" target. Strip the resolving card here so the
    // brain never picks the in-flight card even if the script
    // didn't filter it. Scripts should still pass eligibleIndices
    // explicitly for correctness against the human player too.
    if (ps._resolvingCard) {
      const { name: rname, nth } = ps._resolvingCard;
      let count = 0;
      let resolvingIdx = -1;
      for (let i = 0; i < ps.hand.length; i++) {
        if (ps.hand[i] !== rname) continue;
        count++;
        if (count === (nth || 1)) { resolvingIdx = i; break; }
      }
      if (resolvingIdx >= 0) {
        const filtered = eligible.filter(i => i !== resolvingIdx);
        if (filtered.length > 0) eligible = filtered;
      }
    }
    if (!eligible.length) return null;
    const cardDB = engine._getCardDB();
    const baseScore = (() => {
      try { return evaluateState(engine, cpuIdx); } catch { return 0; }
    })();
    const scored = eligible.map(idx => {
      const name = ps.hand[idx];
      const cd = cardDB[name];
      let value = 0;
      // Scarcity: only copy anywhere accessible = irreplaceable
      const countIn = (arr) => (arr || []).filter(c => c === name).length;
      const copiesLeft = countIn(ps.hand) + countIn(ps.mainDeck) + countIn(ps.potionDeck);
      if (copiesLeft === 1) value += 100;
      else if (copiesLeft === 2) value += 25;
      // Ascended Hero cards are critical win-condition pieces
      if (cd?.cardType === 'Ascended Hero') value += 200;
      // Evaluator delta — tentatively MOVE the card from hand to
      // discard pile and re-score. Pushing to discardPile (not just
      // splicing out of hand) lets the evaluator see post-discard
      // synergies — e.g. Cute Phoenix's HOPT damage scaling with the
      // count of Creatures in the controller's discard pile flips a
      // Creature discard from "neutral" into "actively beneficial",
      // so the brain prefers to feed Phoenix when armed instead of
      // burning Spells. Mirror the move via splice + push, then
      // restore both halves afterwards.
      const removed = ps.hand[idx];
      ps.hand.splice(idx, 1);
      ps.discardPile.push(removed);
      let scoreWithout = baseScore;
      try { scoreWithout = evaluateState(engine, cpuIdx); } catch {}
      ps.discardPile.pop();
      ps.hand.splice(idx, 0, removed);
      value += Math.max(0, baseScore - scoreWithout);
      return { idx, name, value };
    });
    scored.sort((a, b) => a.value - b.value);
    const pick = scored[0];
    // For forceDiscardCancellable ("discard a card OR take the effect"),
    // refuse the discard if the least-bad card is still too precious to
    // lose. Threshold 150 ≈ "this card is more valuable than ~150 HP
    // of damage" — roughly what Bottled Lightning's heaviest tick hits
    // for. Covers Ascended Heroes (score ~310), Cardinal Beasts (~150),
    // and any eval-tracked combo piece. Regular scarce cards (~110)
    // still get discarded; only clear win-condition pieces cancel.
    if (type === 'forceDiscardCancellable' && pick.value >= 150) {
      return null; // "Take it!" — eat the damage to save the card
    }
    return { cardName: pick.name, handIndex: pick.idx };
  }
  return undefined; // Defer to default
}

// ─── Reaction decisions ────────────────────────────────────────────────

function cpuReactionDecision(engine, promptData) {
  const cpuIdx = engine._cpuPlayerIdx;
  const reactionName = promptData.title;
  const rxCd = reactionName ? engine._getCardDB()[reactionName] : null;
  const chainInit = engine.chain?.[0];
  const chainOwnerIsCpu = chainInit && chainInit.owner === cpuIdx;

  // Juice: CPU only plays it when one of their own targets actually
  // has a cleansable negative status. The card removes statuses, NOT
  // HP — gating on HP missing (the previous behaviour) made the CPU
  // burn Juice on a full-HP own hero with no statuses for 0 effect.
  if (reactionName === 'Juice') {
    if (!hasCleansableOwnTarget(engine)) return null; // decline
    return true;
  }

  // Any other negation-style reaction: only fire against a player's card.
  if (rxCd && isLikelyNegation(rxCd)) {
    if (chainOwnerIsCpu) return null; // decline — don't negate own cards
    return true;
  }

  // Default: fire reactions ASAP.
  return true;
}

function isLikelyNegation(cd) {
  const effect = (cd.effect || '').toLowerCase();
  if (!effect) return false;
  // Exclude phrases that say "cannot be negated" / "may not be negated" —
  // those mention negation but aren't themselves negations.
  const negatedProtections = /(cannot|can ?not|may not|will not) be negated/.test(effect);
  if (negatedProtections && !/negate (the|this|that)/.test(effect)) return false;
  // Positive detection: "negate this spell", "negate the effect", "negate the activation"
  return /negate (the|this|an|its) /i.test(effect);
}

// ─── Heal / buff detection heuristics ───────────────────────────────────

function looksLikeHeal(cd, config) {
  if (!cd && !config) return false;
  if (config?.isHeal === true) return true;
  const effect = (cd?.effect || '').toLowerCase();
  // "heal", "restore N HP", "recover"
  if (/\bheal(s|ed|ing)?\b/.test(effect)) return true;
  if (/restore .* hp/.test(effect)) return true;
  if (/recover .* hp/.test(effect)) return true;
  return false;
}

function looksLikeBuff(cd, config) {
  if (!cd) return false;
  if (config?.isBuff === true) return true;
  const effect = (cd.effect || '').toLowerCase();
  if (/\bincreas(e|es|ed) (the )?(attack|hp|max hp)/.test(effect)) return true;
  if (/gain(s)? (\d+|an?) /.test(effect) && /attack|hp/.test(effect)) return true;
  return false;
}

function inferDamage(config) {
  const d = config.baseDamage ?? config.damage ?? 0;
  return Number.isFinite(d) ? d : 0;
}

// ─── Enemy targeting ──────────────────────────────────────────────────
// Rule (user spec):
//   • If damage would defeat an enemy Hero → target that Hero (100%).
//   • Else weighted random: 60% big-damage (≥50% HP) enemy Hero,
//                           30% killable enemy Creature,
//                           10% enemy Creature that survives the damage.
// If we can't pick by those tiers (empty category), fall through to the
// next tier so the CPU always picks SOMETHING when damage targeting an
// enemy is legal.

// Check whether a target is fully immune — damage / targeting effects
// against it will fizzle entirely. Returns true for:
//   • first-turn grace shield on the target's owner
//   • hero-level generic `immune` status (CC immune)
//   • hero petrified via Baihu (stunned + _baihuPetrify)
//   • hero charmed by someone other than its owner (Charme Lv3 damage-immune)
//   • creature that's face-down (surprise), targeting_immune, control_immune,
//     _cardinalImmune, or _baihuPetrify
// Conservative: when in doubt, treat as non-immune so we don't over-skip.
function isTargetImmune(engine, target) {
  const gs = engine.gs;
  if (!target) return false;
  if (target.owner != null && gs.firstTurnProtectedPlayer === target.owner) return true;

  if (target.type === 'hero') {
    const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
    if (!hero || hero.hp <= 0) return true;
    if (hero.statuses?.immune) return true;
    if (hero.statuses?.stunned?._baihuPetrify) return true;
    if (hero.charmedBy != null && hero.charmedBy !== target.owner) return true;
    return false;
  }

  if (target.type === 'creature' || target.type === 'equip') {
    const inst = target.cardInstance
      || engine.cardInstances.find(c =>
        c.owner === target.owner && c.zone === 'support' &&
        c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx);
    if (!inst) return true;
    if (inst.faceDown) return true;
    if (inst.counters?.targeting_immune) return true;
    if (inst.counters?.control_immune) return true;
    if (inst.counters?._cardinalImmune) return true;
    if (inst.counters?._baihuPetrify) return true;
    return false;
  }
  return false;
}

function pickEnemyTargets(engine, enemyTargets, damage, maxSelect) {
  const gs = engine.gs;
  // Drop fully immune targets up front — hitting them does nothing useful
  // and the user explicitly wants to avoid wasting effects on them. If this
  // empties the pool, the caller (cpuPickTargets) will decline cancellable
  // prompts, which cancels the spell and leaves the card in hand.
  const viable = enemyTargets.filter(t => !isTargetImmune(engine, t));
  if (viable.length === 0) return [];

  // Score each viable target by *expected value of the hit*, combining:
  //   • the unit's dynamic value (hero: spell history, recent damage,
  //     redundancy, summoner state, atk; creature: level, recent
  //     contribution, on-death-fuel discount)
  //   • the actual damage that will land (capped by HP — we don't reward
  //     overkill on a 40 HP creature)
  //   • a kill-shot bonus that scales with the unit's value (lethal on a
  //     deadweight creature is still much less valuable than lethal on
  //     the team's main carry)
  // This replaces the old fixed-tier weighted random — the "300 damage
  // wasted on a 40 HP creature" symptom comes directly from that tier
  // system not knowing how much the creature was actually worth.
  const teamMaxSchoolLvls = {};
  const teamMax = (oppIdx) => {
    if (teamMaxSchoolLvls[oppIdx] == null) teamMaxSchoolLvls[oppIdx] = mctsTeamMaxSchoolLvl(gs, oppIdx);
    return teamMaxSchoolLvls[oppIdx];
  };
  const scoreTarget = (t) => {
    if (t.type === 'hero') {
      const h = gs.players[t.owner]?.heroes?.[t.heroIdx];
      if (!h || h.hp <= 0) return -Infinity;
      const immortal = !!h.buffs?.immortal;
      if (immortal && h.hp <= 1 && damage > 0) return -Infinity; // wasted
      const value = mctsEnemyHeroDynamicValue(engine, t.owner, t.heroIdx, teamMax(t.owner));
      const effDamage = Math.min(damage, immortal ? Math.max(0, h.hp - 1) : h.hp);
      const lethal = !immortal && damage > 0 && damage >= h.hp;
      // Kill-shot reward scales with hero value — lethal on a 1.0× hero
      // is OK, lethal on a 3.0× carry is nearly always the right pick.
      const killBonus = lethal ? 250 * value : 0;
      // Low-HP focus tiebreaker: small bonus for hitting a hero already
      // close to dying (consistent focus-fire across turns).
      const focusBonus = Math.max(0, 40 - h.hp * 0.3);
      return effDamage * value + killBonus + focusBonus;
    }
    if (t.type === 'creature' || t.type === 'equip') {
      const inst = t.cardInstance || findSupportInstance(engine, t);
      const hp = creatureCurrentHp(engine, inst, t);
      if (hp == null) return 0;
      const immortal = !!inst?.counters?.buffs?.immortal;
      if (immortal && hp <= 1 && damage > 0) return -Infinity;
      const value = mctsEnemyCreatureValue(engine, inst);
      const effDamage = Math.min(damage, immortal ? Math.max(0, hp - 1) : hp);
      const killable = !immortal && damage > 0 && damage >= hp;
      const killBonus = killable ? 80 * value : 0;
      // Creatures generally rank below heroes — same effective damage on
      // an equally-valued creature should not beat an equally-valued
      // hero. The kill-shot multiplier is also smaller (80 vs 250).
      return effDamage * value + killBonus - 30;
    }
    return 0;
  };

  const scored = viable.map(t => ({ t, s: scoreTarget(t) }))
    .filter(x => x.s > -Infinity)
    .sort((a, b) => b.s - a.s);
  if (scored.length === 0) return [];

  // ── Multi-target path (maxSelect > 1) ──
  // Pyroblast-style "hit up to N targets" prompts: greedy-fill from
  // best to worst by score.
  if (maxSelect > 1) {
    return scored.slice(0, maxSelect).map(x => x.t);
  }

  // Single-target: pick the best score. Random tiebreak among targets
  // within ~3% of the top score so the CPU isn't perfectly predictable
  // and so that ties (e.g. equally valued heroes) are spread fairly.
  const top = scored[0].s;
  const epsilon = Math.max(1, Math.abs(top) * 0.03);
  const tied = scored.filter(x => x.s >= top - epsilon).map(x => x.t);
  return [randomOf(tied)];
}

// ─── Ally targeting ───────────────────────────────────────────────────
// Heal:
//   • Always heal enemy Hero with Overheal Shock (kills them).
//   • Never heal own Hero with Overheal Shock attached.
//   • Prioritize own Hero/Creature equipped with Lifeforce Howitzer (fresh).
//   • Else heal own Hero with most missing HP. If all Heroes full → heal
//     own Creature with lowest HP.
// Buff:
//   • Prefer Hero targets; de-prioritize targets that already have the buff.
//   • Random among top tier.

function pickHealTarget(engine, ownTargets, enemyTargets, cardName, _config) {
  const gs = engine.gs;
  // 1) Overheal Shock on enemy Hero → kill shot: always target.
  for (const t of enemyTargets) {
    if (t.type !== 'hero') continue;
    if (heroHasAttachment(engine, t, 'Overheal Shock')) return t;
  }

  // 2) Skip own Heroes with Overheal Shock attached.
  const safeOwn = ownTargets.filter(t => {
    if (t.type === 'hero' && heroHasAttachment(engine, t, 'Overheal Shock')) return false;
    return true;
  });

  // 3) Priority: own target equipped with Lifeforce Howitzer that hasn't used effect yet.
  const lifeforce = safeOwn.filter(t => targetHasFreshLifeforceHowitzer(engine, t));
  if (lifeforce.length) return randomOf(lifeforce);

  // 4) Most-missing-HP own Hero; else lowest-HP own Creature.
  const ownHeroes = safeOwn.filter(t => t.type === 'hero').map(t => {
    const h = gs.players[t.owner]?.heroes?.[t.heroIdx];
    return { t, missing: (h?.maxHp || 0) - (h?.hp || 0) };
  }).filter(x => x.missing > 0);
  if (ownHeroes.length) {
    // Ascended / Ascendable heroes get the top tier — keeping the deck's
    // plan piece alive beats a bigger-number heal on a regular hero.
    // Within the same Ascension tier, sort by most HP missing.
    ownHeroes.sort((a, b) => {
      const aAsc = targetIsAscendedOrAscendableHero(engine, a.t) ? 1 : 0;
      const bAsc = targetIsAscendedOrAscendableHero(engine, b.t) ? 1 : 0;
      if (aAsc !== bAsc) return bAsc - aAsc;
      return b.missing - a.missing;
    });
    return ownHeroes[0].t;
  }
  const ownCreatures = safeOwn.filter(t => t.type === 'creature' || t.type === 'equip').map(t => {
    const inst = t.cardInstance || findSupportInstance(engine, t);
    return { t, hp: creatureCurrentHp(engine, inst, t) ?? Infinity };
  });
  if (ownCreatures.length) {
    ownCreatures.sort((a, b) => a.hp - b.hp);
    return ownCreatures[0].t;
  }
  return null;
}

// ─── Self-status target scoring ───────────────────────────────────────
// For cards that apply a NEGATIVE status to one of the caster's own
// targets (Sickly Cheese self-poisons, Zsos'Ssar's Decay-Spell cost
// self-poisons, …), the CPU needs to know *which* own-side target
// actually wants the status. Card scripts opt in by exporting
//   `cpuStatusSelfValue(statusName, { engine, owner, heroIdx, hero })
//     → number`
// returning a positive score when the target benefits (Fiona gains
// gold per negative status; Stellan triggers a free-summon on any
// negative status) or a negative score when it hurts (Layn loses her
// creature-HP bonus on CC).
//
// The picker walks the hero's own script + every ability attached to
// the hero and sums their scores. A self-status card's
// `targetingConfig.appliesStatus = 'poisoned' | 'frozen' | …` opts the
// prompt into this picker; otherwise the generic own-side fall-through
// at the end of cpuPickTargets picks randomly.
function scoreSelfStatusTarget(engine, target, statusName) {
  if (!target || target.type !== 'hero' || target.heroIdx == null) return 0;
  const gs = engine.gs;
  const ps = gs.players[target.owner];
  const hero = ps?.heroes?.[target.heroIdx];
  if (!hero?.name) return 0;
  let total = 0;
  const ctx = { engine, owner: target.owner, heroIdx: target.heroIdx, hero };
  const applyScript = (script) => {
    if (typeof script?.cpuStatusSelfValue !== 'function') return;
    try {
      const v = Number(script.cpuStatusSelfValue(statusName, ctx)) || 0;
      total += v;
    } catch { /* ignore card errors, treat as 0 */ }
  };
  applyScript(loadCardEffect(hero.name));
  const abZones = ps.abilityZones?.[target.heroIdx] || [[], [], []];
  for (const slot of abZones) {
    for (const abName of (slot || [])) applyScript(loadCardEffect(abName));
  }
  // Also scan the target's owner's HAND for cards that value a self-status.
  // Luna Kiai, for example, wants all own Heroes Burned so she can be free-
  // summoned — her `cpuStatusSelfValueInHand` returns a positive score
  // while she's in hand. Deduplicated per card name so holding 3 copies
  // doesn't triple-count.
  const seenHandNames = new Set();
  for (const cn of (ps.hand || [])) {
    if (seenHandNames.has(cn)) continue;
    seenHandNames.add(cn);
    const script = loadCardEffect(cn);
    if (typeof script?.cpuStatusSelfValueInHand !== 'function') continue;
    try {
      const v = Number(script.cpuStatusSelfValueInHand(statusName, ctx)) || 0;
      total += v;
    } catch { /* ignore */ }
  }
  return total;
}

function pickSelfStatusTarget(engine, ownTargets, statusName) {
  if (!ownTargets || ownTargets.length === 0) return null;
  const scored = ownTargets.map(t => ({ t, s: scoreSelfStatusTarget(engine, t, statusName) }));
  let maxScore = -Infinity;
  for (const x of scored) if (x.s > maxScore) maxScore = x.s;
  const top = scored.filter(x => x.s === maxScore).map(x => x.t);
  return randomOf(top);
}

// ─── Self-damage target picker (Fire Bolts recoil etc.) ─────────────────
// Rule-based harm minimization. Lower cost = better pick.
//
//   • Lethal on the caster's ONLY remaining live hero  → Infinity (never
//     pick; doing so loses the game on our own turn).
//   • Lethal on a doomed-anyway hero (Golden Ankh's `_forceKillAtTurnEnd`)
//     → near-free: the hero would die at End Phase anyway, so taking a
//     hit there costs nothing real.
//   • Lethal on a regular hero (not the only living) → expensive, but
//     fine if the alternative is the only-hero lethal trap.
//   • Non-lethal on a hero → priced by HP lost; doomed heroes again
//     nearly free; live heroes take a hit to their post-damage HP.
//   • Creatures → cheap compared to hero loss; creatures that die from
//     the damage cost a bit more than survivors, but far less than a
//     live hero kill.
function pickSelfDamageTarget(engine, ownTargets, config) {
  if (!ownTargets || ownTargets.length === 0) return null;
  const gs = engine.gs;
  const damage = Number(config.damage ?? config.baseDamage ?? 0) || 0;
  const cardDB = engine._getCardDB();

  // Helper: living own heroes count (for game-loss detection on hero kills).
  const livingHeroCount = (pi) => {
    const ps = gs.players[pi];
    return (ps?.heroes || []).filter(h => h?.name && h.hp > 0).length;
  };

  const score = (t) => {
    if (t.type === 'hero') {
      const hero = gs.players[t.owner]?.heroes?.[t.heroIdx];
      if (!hero) return Infinity;
      const doomed = hero._forceKillAtTurnEnd === gs.turn;
      const lethal = damage > 0 && hero.hp > 0 && hero.hp <= damage;
      if (lethal) {
        // Would this kill leave 0 living own heroes? That's a loss
        // condition on our own turn — never pick.
        if (livingHeroCount(t.owner) <= 1) return Infinity;
        // Doomed heroes die at End Phase anyway — cheap to sacrifice now.
        if (doomed) return 10;
        // Regular hero kill: very expensive, but not game-ending.
        return 600;
      }
      // Non-lethal hit.
      if (doomed) {
        // Partial damage to a hero that's already on a death timer.
        // Almost free — the only downside is losing their End-Phase
        // Adventurousness / onTurnEnd utility. Give it a small cost.
        return 20;
      }
      // Live hero takes non-lethal damage. Prefer higher-HP heroes so
      // we keep the low-HP ones safer. Cost scales with post-hit
      // vulnerability.
      const postHp = hero.hp - damage;
      // 200 base + "how close to death are we now" bonus up to +150.
      return 200 + Math.max(0, 150 - Math.floor(postHp / 2));
    }
    // Creatures + equipment-creatures
    const inst = t.cardInstance;
    if (!inst) return 1000;
    const cd = cardDB[inst.name];
    const maxHp = inst.counters?.maxHp ?? cd?.hp ?? 0;
    const currentHp = inst.counters?.currentHp ?? maxHp;
    const lethal = damage > 0 && currentHp <= damage;
    // Creatures are far cheaper than hero kills — worst case ~120.
    return lethal ? 120 : 50;
  };

  const scored = ownTargets.map(t => ({ t, s: score(t) }));
  scored.sort((a, b) => a.s - b.s);
  // If every candidate is Infinity (every pick ends the game), there's
  // nothing we can do cleanly — fall back to `null` and let the caller
  // (or the default ally-fallback) pick something. A forced pick is a
  // forced pick; at least this path doesn't pretend the trap is safe.
  if (!scored.length || scored[0].s === Infinity) return null;
  return scored[0].t;
}

function pickBuffTarget(engine, ownTargets, cardName) {
  if (!ownTargets.length) return null;
  // Prefer Hero targets; de-prioritize targets already carrying the buff
  // (naive check by card name in their counters).
  const heroes = ownTargets.filter(t => t.type === 'hero');
  const creatures = ownTargets.filter(t => t.type !== 'hero');
  const pool = heroes.length ? heroes : creatures;
  const withoutBuff = pool.filter(t => !targetHasBuff(engine, t, cardName));
  const final = withoutBuff.length ? withoutBuff : pool;
  // Ascended / Ascendable heroes get the buff / shield / protection first
  // — these are the deck's plan pieces and the most important to keep
  // alive & functional. Fall through to the regular random pick only when
  // no Ascended candidate is in the pool.
  const ascended = final.filter(t => targetIsAscendedOrAscendableHero(engine, t));
  if (ascended.length) return randomOf(ascended);
  return randomOf(final);
}

// ─── Helpers for targeting ────────────────────────────────────────────

function randomOf(arr) {
  if (!arr?.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function findSupportInstance(engine, t) {
  if (!t || t.owner == null || t.heroIdx == null || t.slotIdx == null) return null;
  return engine.cardInstances.find(c =>
    c.owner === t.owner && c.zone === 'support' && c.heroIdx === t.heroIdx && c.zoneSlot === t.slotIdx
  ) || null;
}

function creatureCurrentHp(engine, inst, t) {
  if (inst) {
    const cd = engine.getEffectiveCardData(inst);
    if (cd?.hp != null) {
      const dmg = inst.counters?.damageTaken || 0;
      return Math.max(0, cd.hp - dmg);
    }
  }
  if (t?.cardName) {
    const cd = engine._getCardDB()[t.cardName];
    if (cd?.hp != null) return cd.hp;
  }
  return null;
}

function heroHasAttachment(engine, t, attachmentName) {
  if (t?.type !== 'hero') return false;
  const ps = engine.gs.players[t.owner];
  const zones = ps?.supportZones?.[t.heroIdx] || [];
  for (const slot of zones) {
    if ((slot || []).includes(attachmentName)) return true;
  }
  return false;
}

function targetHasFreshLifeforceHowitzer(engine, t) {
  if (t?.type !== 'hero') return false;
  const ps = engine.gs.players[t.owner];
  const zones = ps?.supportZones?.[t.heroIdx] || [];
  for (let z = 0; z < zones.length; z++) {
    if (!(zones[z] || []).includes('Lifeforce Howitzer')) continue;
    const inst = engine.cardInstances.find(c =>
      c.owner === t.owner && c.zone === 'support' && c.heroIdx === t.heroIdx
      && c.zoneSlot === z && c.name === 'Lifeforce Howitzer'
    );
    // "Fresh" = this-turn effect not used. Lifeforce Howitzer tracks via a
    // per-turn counter; if not present or not spent this turn, consider fresh.
    if (!inst) continue;
    const used = inst.counters?.lifeforceHowitzerUsedTurn;
    if (used !== engine.gs.turn) return true;
  }
  return false;
}

function targetHasBuff(engine, t, cardName) {
  if (!cardName) return false;
  if (t?.type === 'hero') {
    const h = engine.gs.players[t.owner]?.heroes?.[t.heroIdx];
    if (h?.buffs && h.buffs[cardName]) return true;
    if (h?.counters && h.counters[cardName]) return true;
  }
  // Creature-side buffs: check instance counters.
  const inst = t.cardInstance || findSupportInstance(engine, t);
  if (inst?.counters?.buffs?.[cardName]) return true;
  return false;
}

function hasHealableOwnTarget(engine) {
  const cpuIdx = engine._cpuPlayerIdx;
  const ps = engine.gs.players[cpuIdx];
  // Any alive hero missing HP?
  for (const h of (ps?.heroes || [])) {
    if (h?.name && h.hp > 0 && h.hp < h.maxHp) return true;
  }
  // Any own creature missing HP?
  for (let hi = 0; hi < (ps?.supportZones || []).length; hi++) {
    for (let zi = 0; zi < (ps.supportZones[hi] || []).length; zi++) {
      const inst = engine.cardInstances.find(c =>
        c.owner === cpuIdx && c.zone === 'support' && c.heroIdx === hi && c.zoneSlot === zi
      );
      if (!inst) continue;
      const cd = engine.getEffectiveCardData(inst);
      if (cd?.hp && (inst.counters?.damageTaken || 0) > 0) return true;
    }
  }
  return false;
}

/**
 * True when the CPU controls at least one Hero or Creature with a
 * cleansable negative status (Frozen / Stunned / Burned / Poisoned /
 * Bound). Distinct from `hasHealableOwnTarget` which gates HP-healing
 * cards — Juice and friends remove STATUSES, not HP, so the HP-based
 * gate would let the CPU play Juice on a target with full HP and no
 * status (the user-reported "0 effect" misplay).
 */
function hasCleansableOwnTarget(engine) {
  const cpuIdx = engine._cpuPlayerIdx;
  const ps = engine.gs.players[cpuIdx];
  const { getCleansableStatuses } = require('./_hooks');
  const negKeys = getCleansableStatuses();
  for (const h of (ps?.heroes || [])) {
    if (!h?.name || h.hp <= 0) continue;
    if (h.statuses && negKeys.some(k => h.statuses[k])) return true;
  }
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if ((inst.controller ?? inst.owner) !== cpuIdx) continue;
    if (negKeys.some(k => inst.counters?.[k])) return true;
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════════════
//  MCTS — 1-ply action evaluator
//  For each candidate action, run N rollouts (apply → play to turn end
//  → evaluate → restore). Rank candidates by average score, pick best.
//  Currently wired into the Action Phase card pick only; expandable to
//  any decision point.
// ═══════════════════════════════════════════════════════════════════════

const MCTS_ENABLED = true;
// Dropped 5 → 3 with the multi-turn rollout extension (opp's full turn is
// simulated after ours). Per-rollout cost roughly tripled; cutting rollout
// count by 40% keeps total Action-Phase budget close to pre-extension.
const MCTS_ROLLOUTS_PER_CANDIDATE = 3;
// Rollout turn horizon. Number of FULL simulated turns after our current
// turn's rest-of-play. 0 = no extension. 1 = opp's full turn. 2 = our
// next full turn too. 3 = opp again. 4 = us again. Each +1 adds ~one
// full turn of simulated play cost per rollout.
let _rolloutHorizon = 2;
function setRolloutHorizon(h) {
  if (Number.isInteger(h) && h >= 0 && h <= 4) _rolloutHorizon = h;
}
function getRolloutHorizon() { return _rolloutHorizon; }

// Rollout policy: controls how the CPU picks Action-Phase candidates
// when running INSIDE a multi-turn rollout (the recursive runCpuTurn
// calls for opp's turn and our next turn).
//   'heuristic' = simple type priority (Creature > Spell > Attack) + level.
//                 Cheap, fast, but can't see synergies (casts Creature
//                 before Heal even when OHS is on the enemy).
//   'evalGreedy' = for each candidate, tentatively apply + evaluate + undo.
//                  Pick the highest-scoring. Orders of magnitude smarter —
//                  lets the rollout actually discover combos at the cost
//                  of O(candidates) extra snapshot/evaluate per decision.
// A/B validated as 'evalGreedy' (h=2 23.3% WR vs heuristic 3.3% on the
// Heal Burn / Spell Industrialization matchup).
let _rolloutBrain = 'evalGreedy';
function setRolloutBrain(b) {
  if (b === 'heuristic' || b === 'evalGreedy') _rolloutBrain = b;
}
function getRolloutBrain() { return _rolloutBrain; }

// Hard per-decision wall-clock cap. Some combos of decks (e.g. Heal Burn
// vs Butterflies) produce pathological Action-Phase turns where each
// rollout plays through long heal/ascension chains — without this cap a
// single decision could run for minutes while the watchdog sees gs.turn
// unchanged and never aborts. On timeout, mctsRankCandidates returns the
// best-scored candidates so far (or falls back to heuristic if none).
const MCTS_RANK_BUDGET_MS = 10000;
// UCB1 total-pull cap per decision. Hard ceiling on how many rollouts a
// single decision can burn; typically cut short by the wall-clock budget.
const MCTS_UCB1_TOTAL_PULLS = 80;
// UCB1 exploration constant. √2 is the textbook default. Higher = more
// exploration (visit undervisited arms), lower = more exploitation.
const MCTS_UCB1_EXPLORE_C = 1.414;
// ─── Adaptive extension phase ──────────────────────────────────────────
// When the regular UCB1 phase ends with the top arms still clustered
// inside the noise band, spend up to MCTS_EXT_PULLS_MAX extra rollouts
// re-pulling ONLY those clustered arms (round-robin by lowest visits)
// so the cluster either resolves to a clear winner or gets averaged
// flat. Prevents the "noise picks the loser" failure mode where a
// genuinely-better arm is within 1-2 points of the runner-up after
// the standard pulls and stable-sort decides via input order. Capped
// so a perpetually-tied cluster doesn't bleed wall-clock on
// diminishing-returns resampling — once the cap is hit, the
// deterministic tiebreaker (e.g. casterAtk for Attack candidates)
// takes over.
const MCTS_EXT_PULLS_MAX = 60;
// Noise band for cluster detection. Same shape as the final-sort
// epsilon — max(absolute, percentage) of the top arm's avg. Arms
// within this band of the leader are considered "clustered" and
// eligible for extension pulls.
const MCTS_EXT_EPSILON_ABS = 3;
const MCTS_EXT_EPSILON_PCT = 0.01;
// Late-game bypass: past this turn count, skip MCTS and fall through to the
// heuristic sort / direct activation. Normal games end well under turn 50;
// matches that pass turn 80 are almost always attritional stalls (Heal Burn
// vs Lightning Caller, etc.) where MCTS's snapshot storm outruns GC before
// its marginal decision quality gets to matter.
const MCTS_LATE_GAME_TURN_THRESHOLD = 80;

// ═══════════════════════════════════════════════════════════════════════
//  DYNAMIC HERO / CREATURE TRACKING
//  Captures HOW each unit has been used so far this game (spells cast,
//  damage dealt, summon cadence, value generated last turn). Wired in
//  via `installCpuBrain` which wraps `engine.runHooks` to capture the
//  relevant signals as the engine fires its existing hook events. Lives
//  on `hero._cpuStats` and `inst.counters._cpuStats` so engine.snapshot/
//  restore preserves it across MCTS rollouts (rollouts can mutate the
//  cloned copies; the live values resume after restore).
// ═══════════════════════════════════════════════════════════════════════

function ensureHeroCpuStats(hero) {
  if (!hero) return null;
  if (!hero._cpuStats) {
    hero._cpuStats = {
      spellsCast: 0,
      spellLevelsTotal: 0,
      attackDamageThisTurn: 0,
      attackDamageLastTurn: 0,
      attackDamageTotal: 0,
      // Kill counters — incremented when this hero's damage drops a
      // target to 0. `heroKills` is the strongest carry signal we
      // track; `creatureKills` is the secondary cleaner signal. These
      // are cumulative for the whole game so a hero who killed the
      // opponent's main carry on turn 5 is still flagged as high-value
      // on turn 12 even after several quiet turns.
      heroKills: 0,
      creatureKills: 0,
      // Aggregated "value generated" per turn — damage / draws caused / gold
      // earned attributed to this hero. Used by the dynamic valuation to
      // tell apart a deadweight hero from one that produced real swing
      // on the previous turn.
      valueThisTurn: 0,
      valueLastTurn: 0,
      lastSummonTurn: -1,
      summonsThisGame: 0,
    };
  }
  return hero._cpuStats;
}

function ensureCreatureCpuStats(inst) {
  if (!inst) return null;
  if (!inst.counters) inst.counters = {};
  if (!inst.counters._cpuStats) {
    inst.counters._cpuStats = {
      damageThisTurn: 0,
      damageLastTurn: 0,
      valueThisTurn: 0,
      valueLastTurn: 0,
      summonedOnTurn: null,
    };
  }
  return inst.counters._cpuStats;
}

/**
 * Roll over current-turn deltas into "last turn" fields. Called when the
 * engine fires `onTurnEnd` so the next eval pass sees deltas for the
 * turn that just finished, not for an arbitrary mid-turn slice.
 */
function rolloverPerTurnStats(engine) {
  const gs = engine.gs;
  if (!gs?.players) return;
  for (const ps of gs.players) {
    for (const h of (ps.heroes || [])) {
      const s = h?._cpuStats;
      if (!s) continue;
      s.attackDamageLastTurn = s.attackDamageThisTurn;
      s.attackDamageThisTurn = 0;
      s.valueLastTurn = s.valueThisTurn;
      s.valueThisTurn = 0;
    }
  }
  for (const inst of (engine.cardInstances || [])) {
    const s = inst.counters?._cpuStats;
    if (!s) continue;
    s.damageLastTurn = s.damageThisTurn;
    s.damageThisTurn = 0;
    s.valueLastTurn = s.valueThisTurn;
    s.valueThisTurn = 0;
  }
}

/**
 * Attribute `dealt` damage to source's hero/creature. Source object comes
 * from actionDealDamage / actionDealCreatureDamage — fields used:
 *   • source.owner / source.controller — player index of the source
 *   • source.heroIdx — hero index when the source is hero/ability/equip
 *   • source.id + source.zone === 'support' — when source is a creature
 *     instance, attribute to the creature too
 * `targetSide` is the player index whose unit took the hit, so we can
 * skip self-damage (Fire Bolts recoil) which we don't want counted.
 */
function recordDamageDealt(engine, source, dealt, targetSide) {
  if (!dealt || dealt <= 0) return;
  if (!source) return;
  const srcOwner = source.owner ?? source.controller ?? -1;
  if (srcOwner < 0) return;
  if (targetSide === srcOwner) return; // own-side damage doesn't count as offense

  // Source is a creature instance on the support zone — credit goes to the
  // creature itself (the host hero shouldn't double-collect for what its
  // creature did). Tracked instances always carry an `id` plus a zone of
  // 'support', so this check is a clean "is this a tracked CardInstance?".
  const isCreatureSource = source.id != null && source.zone === 'support';
  if (isCreatureSource) {
    const stats = ensureCreatureCpuStats(source);
    if (stats) {
      stats.damageThisTurn += dealt;
      stats.valueThisTurn += dealt * 0.5;
    }
    return;
  }

  // Hero-initiated damage (own Spell/Attack/Hero-Effect/Equip-Effect with
  // hero attribution). `srcHi` is the casting hero; credit damage there.
  const srcHi = source.heroIdx;
  const hero = (srcHi != null && srcHi >= 0)
    ? engine.gs.players[srcOwner]?.heroes?.[srcHi]
    : null;
  if (hero?.name) {
    const stats = ensureHeroCpuStats(hero);
    stats.attackDamageThisTurn += dealt;
    stats.attackDamageTotal += dealt;
    stats.valueThisTurn += dealt * 0.5;
  }
}

/**
 * Attribute a spell cast to its caster hero. Called from the wrapper
 * around `runHooks('afterSpellResolved', ctx)` — `ctx.casterIdx` and
 * `ctx.heroIdx` identify the caster, and `ctx.spellCardData.level`
 * gives the spell's level. We skip Attack-card "spells" (those use the
 * same hook path but aren't really Spells the user reasons about).
 */
/**
 * Attribute a kill to its source hero. Called from the runHooks
 * observer right after `afterDamage` / `afterCreatureDamageBatch`
 * detects that the damaged target is now at 0 HP. Mirrors the
 * `recordDamageDealt` attribution logic — credit goes to the
 * casting hero, NOT the attacking creature's host. `kind` is
 * 'hero' or 'creature'; the dynamic value formula weights hero
 * kills more heavily because they're a larger swing event.
 */
function recordKill(engine, source, kind, targetSide) {
  if (!source) return;
  const srcOwner = source.owner ?? source.controller ?? -1;
  if (srcOwner < 0) return;
  if (targetSide === srcOwner) return; // own-side kill (shouldn't happen normally)
  // Creature-instance source — kills attributed to the creature, not
  // the hero hosting it. Currently no-op (creature stats don't track
  // kills); kept here so the structure mirrors recordDamageDealt and
  // can be extended later if "creature that wiped out a hero" turns
  // out to be a useful signal.
  const isCreatureSource = source.id != null && source.zone === 'support';
  if (isCreatureSource) return;
  const srcHi = source.heroIdx;
  if (srcHi == null || srcHi < 0) return;
  const hero = engine.gs.players[srcOwner]?.heroes?.[srcHi];
  if (!hero?.name) return;
  const stats = ensureHeroCpuStats(hero);
  if (kind === 'hero') stats.heroKills++;
  else if (kind === 'creature') stats.creatureKills++;
}

function recordSpellCast(engine, casterIdx, heroIdx, spellCardData) {
  if (casterIdx == null || casterIdx < 0) return;
  if (heroIdx == null || heroIdx < 0) return;
  if (!spellCardData) return;
  if (spellCardData.cardType !== 'Spell') return;
  const hero = engine.gs.players[casterIdx]?.heroes?.[heroIdx];
  if (!hero?.name) return;
  const stats = ensureHeroCpuStats(hero);
  stats.spellsCast++;
  stats.spellLevelsTotal += (spellCardData.level || 0);
  // Casting spells generates "value" — fold the level into the per-turn
  // accumulator so a hero that just cast a Lv5 spell registers as more
  // valuable than one that just cast a Lv1.
  stats.valueThisTurn += (spellCardData.level || 0) * 8;
}

/**
 * Fold a draws/gold gain at the player level into per-hero "value
 * generated" buckets. We don't have per-hero attribution for these
 * generic sources, so the accumulator is split across the player's
 * draw/gold-yielding heroes weighted by their declared supportYield.
 * When no hero declares a yield, the value is dropped (we can't tell
 * who deserves it). `kind` is 'draw' (1 unit each) or 'gold' (per gold).
 */
function attributeAggregateValue(engine, pi, kind, amount) {
  if (!amount || amount <= 0) return;
  const ps = engine.gs.players[pi];
  if (!ps) return;
  // Weights: draw worth 15 value-units, gold worth 2 value-units each.
  // Roughly comparable to how the existing evaluator weights each
  // resource (avg card ~15 score, gold-on-demand ~2× gold).
  const valuePerUnit = kind === 'gold' ? 2 : kind === 'draw' ? 15 : 0;
  if (valuePerUnit <= 0) return;
  const totalValue = amount * valuePerUnit;

  const yields = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    const ctx = { engine, pi, hi, cpuIdx: engine._cpuPlayerIdx };
    let drawWeight = 0, goldWeight = 0;
    const apply = (y) => {
      if (!y) return;
      drawWeight += (y.drawsPerTurn || 0) + (y.potionDrawsPerTurn || 0) * 3;
      goldWeight += y.goldPerTurn || 0;
    };
    const heroScript = loadCardEffect(hero.name);
    if (typeof heroScript?.supportYield === 'function') {
      try { apply(heroScript.supportYield(ctx)); } catch {}
    }
    const abZones = ps.abilityZones?.[hi] || [];
    for (const slot of abZones) {
      if (!slot || slot.length === 0) continue;
      const abScript = loadCardEffect(slot[0]);
      if (typeof abScript?.supportYield !== 'function') continue;
      try { apply(abScript.supportYield(slot.length, ctx)); } catch {}
    }
    const w = kind === 'gold' ? goldWeight : drawWeight;
    if (w > 0) yields.push({ hi, w });
  }
  if (yields.length === 0) return;
  const totalW = yields.reduce((s, y) => s + y.w, 0);
  if (!(totalW > 0)) return;
  for (const y of yields) {
    const share = (y.w / totalW) * totalValue;
    const hero = ps.heroes[y.hi];
    if (!hero) continue;
    const stats = ensureHeroCpuStats(hero);
    stats.valueThisTurn += share;
  }
}

// ─── Dynamic valuation ────────────────────────────────────────────────
// Builds on the existing static threat (atk, school level, supportYield)
// by layering in the live game history captured above. Used to weight
// enemy HP in the evaluator and to score targets when the CPU picks
// who to damage with an offensive Spell/Attack/Potion.

const SPELL_SCHOOL_ROLE_TAG_PREFIX = 'caster:';

/**
 * Tag the role(s) this hero fills for redundancy detection. A hero
 * tagged "caster:Destruction Magic" duplicates another caster of the
 * same school; "supporter" duplicates any draw/gold engine; etc.
 */
function mctsHeroRoleTags(engine, oppIdx, hi) {
  const tags = new Set();
  const gs = engine.gs;
  const ps = gs.players[oppIdx];
  const hero = ps?.heroes?.[hi];
  if (!hero?.name) return tags;

  // Schools the hero can cast at level ≥ 1 — anything castable counts as
  // "caster-of-school" because the user explicitly mentioned that another
  // hero "capable of casting Spells of the same or even higher levels"
  // makes the original caster redundant.
  const abZones = ps.abilityZones?.[hi] || [];
  const schoolLevels = {};
  for (const slot of abZones) {
    if (!slot || slot.length === 0) continue;
    if (SPELL_SCHOOL_ABILITIES.has(slot[0])) {
      schoolLevels[slot[0]] = Math.max(schoolLevels[slot[0]] || 0, slot.length);
    }
  }
  for (const sc of Object.keys(schoolLevels)) {
    tags.add(SPELL_SCHOOL_ROLE_TAG_PREFIX + sc);
  }
  if (schoolLevels['Summoning Magic']) tags.add('summoner');

  const { supportUnits, damagePerTurn } = mctsHeroSupportDetails(engine, oppIdx, hi);
  if (supportUnits >= 1) tags.add('supporter');
  if (damagePerTurn > 0) tags.add('damage_supporter');
  if ((hero.atk || 0) >= 130) tags.add('attacker');

  // Game-history-derived tags.
  const stats = hero._cpuStats;
  if (stats && stats.spellsCast >= 2) tags.add('active_caster');
  if (stats && (stats.attackDamageLastTurn || 0) >= 60) tags.add('active_attacker');

  return tags;
}

/**
 * Schools where another LIVING hero can match or exceed this hero's
 * spell-school level. When the user's spec says "their other hero can
 * cast the same or higher Spells", picking off this hero is a softer
 * blow than killing the team's only carry of that school.
 */
function mctsCasterIsCovered(engine, oppIdx, hi) {
  const ps = engine.gs.players[oppIdx];
  const hero = ps?.heroes?.[hi];
  if (!hero?.name) return false;
  const myAbZones = ps.abilityZones?.[hi] || [];
  const mySchoolLevels = {};
  for (const slot of myAbZones) {
    if (!slot || slot.length === 0) continue;
    if (SPELL_SCHOOL_ABILITIES.has(slot[0])) {
      mySchoolLevels[slot[0]] = Math.max(mySchoolLevels[slot[0]] || 0, slot.length);
    }
  }
  if (Object.keys(mySchoolLevels).length === 0) return false;

  for (let other = 0; other < (ps.heroes || []).length; other++) {
    if (other === hi) continue;
    const oh = ps.heroes[other];
    if (!oh?.name || oh.hp <= 0) continue;
    const oZones = ps.abilityZones?.[other] || [];
    for (const slot of oZones) {
      if (!slot || slot.length === 0) continue;
      if (!SPELL_SCHOOL_ABILITIES.has(slot[0])) continue;
      // Same school + matching/higher level = full coverage of that school.
      if (mySchoolLevels[slot[0]] != null && slot.length >= mySchoolLevels[slot[0]]) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Discount (in threat units) for redundancy with same-side teammates.
 * Each living teammate that shares a role tag adds up to ~0.5 of
 * discount, capped at 1.0 total. Using a per-tag overlap check rather
 * than counting tag intersections directly keeps the discount sensible
 * even when one teammate fills multiple of the same roles.
 */
function mctsRoleRedundancyDiscount(engine, oppIdx, hi) {
  const ps = engine.gs.players[oppIdx];
  if (!ps) return 0;
  const myTags = mctsHeroRoleTags(engine, oppIdx, hi);
  if (myTags.size === 0) return 0;
  let overlapCount = 0;
  for (let other = 0; other < (ps.heroes || []).length; other++) {
    if (other === hi) continue;
    const oh = ps.heroes[other];
    if (!oh?.name || oh.hp <= 0) continue;
    const otherTags = mctsHeroRoleTags(engine, oppIdx, other);
    for (const tag of myTags) {
      if (otherTags.has(tag)) {
        overlapCount++;
        break;
      }
    }
  }
  return Math.min(1.0, overlapCount * 0.5);
}

/**
 * Combined dynamic threat multiplier for enemy hero `hi`. Replaces the
 * raw mctsEnemyHeroThreat call inside the evaluator so target-selection
 * follows the same scoring as state evaluation. Returns a multiplier on
 * the hero's HP — higher means hitting them hurts the opponent more.
 *
 * The static base (school presence, supportYield, atk) lives in the
 * existing mctsEnemyHeroThreat. This function layers on:
 *   + 0.4 × avg spell level cast (heavy spellcaster signal)
 *   + 0.05 × spells cast  (frequency)
 *   + ≤ 2.0 from attackDamageLastTurn (recent damage output)
 *   + ≤ 2.0 from cumulative attackDamageTotal (sustained-attacker
 *     signal — captures a carry who's quiet THIS turn but has been
 *     hammering the CPU all game)
 *   + ≤ 2.5 from heroKills, ≤ 1.0 from creatureKills (impact —
 *     a hero who has actually KO'd one of our pieces is the priority
 *     remove regardless of last-turn activity)
 *   + ≤ 1.0 from non-creature support cards equipped on this hero
 *     (Swords, equipment artifacts, etc. — a kitted-up hero is more
 *     dangerous than a vanilla body)
 *   + ≤ 1.5 from valueLastTurn (recent broad-sense value)
 *   - up to 0.6 if a summoner has all support zones full AND didn't
 *     summon last turn (their effect is parked for now)
 *   - up to 1.0 from same-role redundancy with living teammates
 *   - up to 0.6 if another teammate already covers their highest school
 */
function mctsEnemyHeroDynamicValue(engine, oppIdx, hi, teamMaxSchoolLvl) {
  const gs = engine.gs;
  const ps = gs.players[oppIdx];
  const hero = ps?.heroes?.[hi];
  if (!hero?.name || hero.hp <= 0) return 1.0;

  let value = mctsEnemyHeroThreat(engine, oppIdx, hi, teamMaxSchoolLvl);
  const stats = hero._cpuStats || null;

  if (stats) {
    if (stats.spellsCast > 0) {
      const avgLvl = stats.spellLevelsTotal / stats.spellsCast;
      value += 0.4 * avgLvl + 0.05 * Math.min(stats.spellsCast, 6);
    }
    const recentDmg = stats.attackDamageLastTurn || 0;
    if (recentDmg > 0) value += Math.min(2.0, recentDmg / 100);
    // Cumulative damage — sustained carry signal. A hero who's dealt
    // 700+ damage over the game stays a high-priority target even on
    // a quiet turn where they happened not to attack. Using a square-
    // root-ish ramp so the first 200 damage matters proportionally
    // more than the next 500 (diminishing returns).
    const totalDmg = stats.attackDamageTotal || 0;
    if (totalDmg > 0) value += Math.min(2.0, Math.sqrt(totalDmg) / 14);
    // Kill history. Hero kills swing the game far harder than
    // creature kills, so weighted asymmetrically.
    if ((stats.heroKills || 0) > 0) value += Math.min(2.5, stats.heroKills * 1.0);
    if ((stats.creatureKills || 0) > 0) value += Math.min(1.0, stats.creatureKills * 0.25);
    const recentValue = stats.valueLastTurn || 0;
    if (recentValue > 0) value += Math.min(1.5, recentValue * 0.005);
  }

  // Equipment / kit bonus. Counts non-Creature cards in the hero's
  // own support zones — Swords, weapon artifacts, attachments. An
  // equipped hero with even one weapon is a notably bigger threat
  // than the same hero with nothing on them. Equipment-Creatures
  // (Pollution Spewer-style hybrids) and pure Creatures don't count
  // here — they're tracked separately as board presence.
  const supportZones = ps.supportZones?.[hi] || [];
  let equipCount = 0;
  if (supportZones.length > 0) {
    const cardDB = engine._getCardDB();
    for (const slot of supportZones) {
      for (const cardName of (slot || [])) {
        const cd = cardDB[cardName];
        if (!cd) continue;
        // Skip Creatures (including Artifact-Creature hybrids) — they
        // contribute via creature valuation, not equipment.
        if (cd.cardType === 'Creature') continue;
        if (cd.cardType === 'Artifact' && (cd.subtype || '').toLowerCase() === 'creature') continue;
        equipCount++;
      }
    }
  }
  if (equipCount > 0) value += Math.min(1.0, equipCount * 0.4);

  // ── Demand-weighted gold engine ──────────────────────────────────────
  // The static threat above already added a flat
  //   0.25 × SUPPORT_UNIT_WEIGHTS.gold × goldYield
  // contribution from this hero's gold supportYield (Trade, Wealth,
  // Adventurousness, Semi, Fiona, …). That assumes every gold/turn
  // is equally valuable, which is wrong: gold engines on a hoarder
  // (already saving 15+ each turn, nothing in hand to spend on) are
  // near-worthless to remove, while the same engine on an opponent
  // who spends every coin and has unplayed artifacts in hand is
  // critical. We rescale the gold portion by the demand-aware
  // multiplier — only for POSITIVE goldYield (gold makers). Gold
  // SINKS (Alchemy's −cost) leave the static math alone; their value
  // is already dominated by their potion-draw side and the user
  // spec's "gold gain valuation" is about the maker side.
  const { goldYield } = mctsHeroSupportDetails(engine, oppIdx, hi);
  if (goldYield > 0) {
    const flatStaticGold = 0.25 * SUPPORT_UNIT_WEIGHTS.gold * goldYield;
    const econMult = mctsOpponentGoldEconomy(engine, oppIdx);
    // Adjust toward the demand-aware weighting. econMult=1 → no change;
    // econMult<1 → subtract from the flat baseline (saturated opp);
    // econMult>1 → add to it (starved opp). Bounded by mctsOpponent-
    // GoldEconomy's own [0.3, 1.8] range, so the swing on this hero
    // is at most ±80% of the original gold contribution.
    value += flatStaticGold * (econMult - 1);
  }

  // Summoner-with-no-room discount. Only matters when the hero has
  // Summoning Magic AND every support zone is occupied AND the hero
  // didn't just summon last turn (a fresh chain of summons projects
  // continued threat — full zones immediately after summoning means
  // the threat is still LIVE).
  const myTags = mctsHeroRoleTags(engine, oppIdx, hi);
  if (myTags.has('summoner')) {
    const supportZones = ps.supportZones?.[hi] || [[], [], []];
    const allFull = supportZones.length > 0 && supportZones.every(z => (z || []).length > 0);
    const summonedRecently = stats && stats.lastSummonTurn === gs.turn - 1;
    if (allFull && !summonedRecently) value -= 0.6;
  }

  // Redundancy: same-role teammates dilute the loss.
  value -= mctsRoleRedundancyDiscount(engine, oppIdx, hi);

  // Caster-coverage: if another teammate can already cast same-or-higher
  // spells of this hero's main school, this hero is partially fungible.
  if (mctsCasterIsCovered(engine, oppIdx, hi)) value -= 0.6;

  // ── Spent one-shot effect ─────────────────────────────────────────────
  // Some heroes carry a single very strong turn-1 effect (Willy's Draw 5
  // / Gain 30, Barker's free Lv ≤ 1 summon, …) and once that's fired
  // they're effectively a generic body — the abilities they host still
  // matter (and feed the school/support tracks above) but the hero's own
  // contribution is mostly gone. Heavy flat discount so the CPU doesn't
  // burn 200-damage spells on a spent Willy when a live carry is also
  // available. Hero scripts opt in via `cpuMeta.oneShotEffectSpent`.
  const heroScript = loadCardEffect(hero.name);
  const oneShotSpent = heroScript?.cpuMeta?.oneShotEffectSpent;
  if (typeof oneShotSpent === 'function') {
    const heroInst = engine.cardInstances.find(c =>
      c.owner === oppIdx && c.zone === 'hero' && c.heroIdx === hi
    );
    try {
      if (oneShotSpent(engine, oppIdx, hi, hero, heroInst)) value -= 1.5;
    } catch { /* swallow — observer must not break eval */ }
  }

  return Math.max(0.5, value);
}

/**
 * Threat multiplier on an opponent's Creature/Equipment-creature target.
 * Built around level + recent damage + last-turn value, minus an
 * on-death-fuel discount so we don't gleefully kill creatures that
 * fuel the opponent's chains (Hell Fox, Loyal Bone Dog, …).
 */
function mctsEnemyCreatureValue(engine, inst) {
  if (!inst) return 1.0;
  const cd = engine._getCardDB()[inst.name];
  if (!cd) return 1.0;
  let value = 1.0;
  const lvl = cd.level || 0;
  if (lvl > 0) value += lvl * 0.4;
  const stats = inst.counters?._cpuStats;
  if (stats) {
    if ((stats.damageLastTurn || 0) > 0) value += Math.min(1.8, stats.damageLastTurn / 100);
    if ((stats.valueLastTurn || 0) > 0) value += Math.min(1.0, stats.valueLastTurn * 0.005);
  }
  // On-death fuel — discount.
  const script = loadCardEffect(inst.name);
  const onDeath = script?.cpuMeta?.onDeathBenefit || 0;
  if (onDeath > 0) value -= Math.min(0.7, onDeath / 30);
  // Chain sources should be killed eagerly when armed (denying their
  // window) — slight bump.
  if (script?.cpuMeta?.chainSource) value += 0.4;
  return Math.max(0.3, value);
}

/**
 * Score for "how valuable would `cardName` be sitting in pi's hand right
 * now". Mirrors the in-eval logic in evaluateState's hand-value pass —
 * promoted to a top-level helper so deck-search prompts (Magnetic Glove,
 * Magnetic Potion, future tutors) can rank gallery options without
 * paying for a full state snapshot per candidate. Combines:
 *   • Affordability (cost vs current gold + 1–2 turn lookahead)
 *   • Type lock (Potion/Artifact/Creature locks zero out playability)
 *   • Tutor cap (`blockedByHandLock + resolve` — drawing a card to draw
 *     another card double-counts the second card otherwise)
 *   • Ascension-critical floor (Beato's missing-school spells, Layn's
 *     Hammer, Arthor's Sword — these are the carry pieces a tutor
 *     should always grab if available)
 *   • Duplicate penalty — drawing a second copy of a HOPT-locked /
 *     once-per-turn-relevant card is worth half.
 */
/**
 * Pick the highest-value gallery card for `pi` to tutor / select. Used
 * by both the cpuGenericChoice heuristic seed and by
 * mctsEnumerateGenericAlternatives' sort, so the variation cap of 6
 * alternatives lands on the most promising 6 cards instead of the
 * alphabetically-first 6. Scores via `estimateHandCardValueFor` with
 * a duplicate count derived from the player's CURRENT hand — drawing
 * a second copy of a card already in hand correctly drops to
 * half-value. Ties resolved randomly so the CPU isn't perfectly
 * predictable on equal-value gallery picks.
 */
function pickBestGalleryCard(engine, pi, cards) {
  if (!Array.isArray(cards) || cards.length === 0) return null;
  const ps = engine.gs.players[pi];
  const handCounts = {};
  if (ps?.hand) {
    for (const name of ps.hand) handCounts[name] = (handCounts[name] || 0) + 1;
  }
  let best = -Infinity;
  for (const c of cards) {
    const seen = handCounts[c.name] || 0;
    const score = estimateHandCardValueFor(engine, pi, c.name, seen);
    c._galleryScore = score;
    if (score > best) best = score;
  }
  const top = cards.filter(c => c._galleryScore >= best - 0.01);
  const pick = top[Math.floor(Math.random() * top.length)] || cards[0];
  // Hard invariant: the returned pick MUST be one of the input cards
  // (checked by reference identity since the caller passes a fresh
  // object array per prompt). If somehow not — e.g., a future bug
  // mutates the cards array mid-pick — fall back to the first input
  // card so callers like Magic Lamp's `chosenNames.includes(picked)`
  // gate never sees a phantom card.
  if (!cards.includes(pick)) return cards[0];
  return pick;
}

function estimateHandCardValueFor(engine, pi, cardName, seenCount = 0) {
  const cardDB = engine._getCardDB();
  const cd = cardDB[cardName];
  if (!cd) return 15;
  const ps = engine.gs.players[pi];
  const gold = ps?.gold || 0;
  const cost = cd.cost || 0;
  const typeLocked =
    (cd.cardType === 'Potion' && ps?.potionLocked) ||
    (cd.cardType === 'Artifact' && ps?.itemLocked) ||
    (cd.cardType === 'Creature' && ps?.creatureLocked);
  let base;
  if (typeLocked) base = 10;
  else if (cost <= gold) base = 25;
  else if (cost <= gold + 6) base = 20;
  else if (cost <= gold + 12) base = 15;
  else base = 5;
  if (!typeLocked) {
    const script = loadCardEffect(cardName);
    if (script?.blockedByHandLock && typeof script.resolve === 'function') {
      base = Math.min(base, 12);
    }
    // Per-card override: cards whose ENTIRE on-play value is gaining a
    // fixed amount of gold (Treasure Chest's +10) should rate their hand-
    // value at the demand-aware value of that gold, NOT the generic
    // "any 0-cost playable card is worth 25" base. This keeps the
    // apply-vs-skip delta in mctsGatedActivation honest:
    //   • low gold (high demand) → gold worth ~×2 → hand-value ~20 → small
    //     positive delta to play (10 gold gained, 1 hand card lost worth 20,
    //     net ~0 to slightly positive depending on demand math).
    //   • high gold (saturated demand) → gold worth ~×0.2 → hand-value ~2
    //     → strong negative delta to play, so the gate skips.
    //   • interference (Hammer Throw +1 forced discard) → recon eval sees
    //     the extra hand cost and skips even at low gold.
    const goldGain = script?.cpuMeta?.handValueAsGoldGain;
    if (typeof goldGain === 'number' && goldGain > 0) {
      const demand = computeGoldDemand(engine, pi);
      const willMeet  = Math.max(0, Math.min(goldGain, demand - gold));
      const willSpill = goldGain - willMeet;
      base = willMeet * 2 + willSpill * 0.2;
    }
  }
  if (cardIsAscensionCriticalForAnyHero(engine, pi, cardName, cd)) {
    base = Math.max(base, 80);
  }
  // Direct-from-deck summon synergy with Cosmic Manipulation. Cards
  // that opt into `cpuMeta.directDeckSummon` are worth more when CM is
  // in hand to react to them; CM itself is worth more when a
  // directDeckSummon trigger is in hand. Generic — any future card
  // wearing either flag gets the same lift.
  const script = loadCardEffect(cardName);
  const ps2 = engine.gs.players[pi];
  if (script?.cpuMeta?.directDeckSummon || cardName === 'Cosmic Manipulation') {
    const hand = ps2?.hand || [];
    const partnerInHand = (() => {
      if (cardName === 'Cosmic Manipulation') {
        for (const cn of hand) {
          if (cn === cardName) continue;
          if (loadCardEffect(cn)?.cpuMeta?.directDeckSummon) return true;
        }
        return false;
      }
      return hand.includes('Cosmic Manipulation');
    })();
    if (partnerInHand) base += 25;
  }
  if (seenCount >= 1) base *= 0.5;
  return base;
}

// Scalar evaluation of a game state from the CPU's perspective. Higher is
// better for the CPU. Feature weights are educated guesses — tune after
// playing games with MCTS active and observing where the brain under- or
// over-values things.
// ─── Threat weighting for enemy heroes ────────────────────────────────────
// The base evaluator treats all enemy HP uniformly, so different enemy
// targets tie whenever the damage dealt is equal. We weight enemy HP by a
// threat multiplier that combines two signals:
//   (a) Spell-school presence — hard-coded set of ability names below,
//       since being a "caster" is a structural property of ability TYPE.
//   (b) Support-kit yield — inferred dynamically from each script's
//       `supportYield(level)` (abilities) or `supportYield()` (heroes).
//       Cards self-declare the draws / potion-draws / gold they generate
//       per turn; the CPU sums them into a single "support units" score
//       with potion draw worth 3× a regular draw and gold discounted.
const SPELL_SCHOOL_ABILITIES = new Set([
  'Destruction Magic', 'Decay Magic', 'Magic Arts', 'Support Magic', 'Summoning Magic',
]);

// Weightings for combining a hero's declared supportYield into one number.
// Matches the user-specified rule "potion draw = 3 regular draws"; the gold
// weight approximates a typical cheap spell costing ~4 gold (so 4 gold ≈ 1
// draw worth of support). Damage is surfaced separately (see
// mctsHeroSupportDetails) because damage supporters get a dedicated threat
// bonus instead of flowing through the generic support-units weight.
const SUPPORT_UNIT_WEIGHTS = { draws: 1.0, potionDraws: 3.0, gold: 0.25 };

// Read supportYield from each stacked Ability (called with `(level, ctx)`)
// and from the hero's own card script (called with `(ctx)`). Returns the
// per-turn support breakdown: `supportUnits` for draws/potions/gold, and
// `damagePerTurn` for damage-supporter assessment (separate threat track).
// ctx gives scripts access to the engine so their yields can scale with
// current board state (creature counts, poison stacks, atk deltas, etc.).
function mctsHeroSupportDetails(engine, pi, hi) {
  const ps = engine.gs.players[pi];
  const hero = ps?.heroes?.[hi];
  if (!hero?.name || hero.hp <= 0) {
    return { supportUnits: 0, damagePerTurn: 0, goldYield: 0 };
  }
  let draws = 0, potionDraws = 0, gold = 0, damage = 0;
  const ctx = { engine, pi, hi, cpuIdx: engine._cpuPlayerIdx };
  const apply = (y) => {
    if (!y) return;
    draws += y.drawsPerTurn || 0;
    potionDraws += y.potionDrawsPerTurn || 0;
    gold += y.goldPerTurn || 0;
    damage += y.damagePerTurn || 0;
  };
  const abZones = ps.abilityZones?.[hi] || [];
  for (const slot of abZones) {
    if (!slot || slot.length === 0) continue;
    const script = loadCardEffect(slot[0]);
    if (typeof script?.supportYield !== 'function') continue;
    try { apply(script.supportYield(slot.length, ctx)); } catch {}
  }
  const heroScript = loadCardEffect(hero.name);
  if (typeof heroScript?.supportYield === 'function') {
    try { apply(heroScript.supportYield(ctx)); } catch {}
  }
  const supportUnits =
    SUPPORT_UNIT_WEIGHTS.draws * draws +
    SUPPORT_UNIT_WEIGHTS.potionDraws * potionDraws +
    SUPPORT_UNIT_WEIGHTS.gold * gold;
  // `goldYield` is the raw per-turn gold contribution surfaced
  // separately so the dynamic-value layer can re-weight it by the
  // opponent's actual gold demand instead of using the flat
  // 0.25-per-gold weight baked into supportUnits. Positive = gold
  // generator, negative = gold sink (Alchemy).
  return { supportUnits, damagePerTurn: damage, goldYield: gold };
}

// ─── Gold vs Card-Draw decision helper ────────────────────────────────
// Used whenever a card offers the CPU a binary choice between gaining
// Gold and drawing Cards (Willy today; potentially other cards later).
// Returns 'gold' or 'draw'.
//
// Factors, per the design spec:
//   1. Current gold (more → gaining Gold is worth less)
//   2. Average cost of artifacts in deck/hand/discard, multiplied by
//      on-board cost modifiers (Alchemy doubles artifact cost). Higher
//      effective cost, especially compared to gold already owned, makes
//      Gold worth more.
//   3. Hand size (more in hand → drawing is worth less — new tools may
//      not even fit comfortably)
//   4. Kit lean — abilities and heroes in play that self-declare
//      supportYield with goldPerTurn or drawsPerTurn. If the kit ALREADY
//      generates lots of gold, the OTHER resource (draws) is more
//      precious, and vice-versa (per the user's rule).
//
// Score > 0 → GOLD wins. Score < 0 → DRAW wins. Weights are first-pass
// estimates; tune after playtesting. Exported so card scripts can call
// it directly via their `cpuResponse` hook if they want the same logic
// without relying on auto-detection by option ID.
function mctsValueGoldVsDraw(engine, pi) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  if (!ps) return 'gold';
  const cardDB = engine._getCardDB();

  // (1) Gold already owned.
  const gold = ps.gold || 0;

  // (2) Average artifact cost across everything the CPU might eventually
  //     play. We look at hand + main deck + discard pile — anything not
  //     yet permanently deleted. 0-cost artifacts (tokens, freebies) are
  //     excluded so they don't drag the average down.
  let artifactCostSum = 0, artifactCostCount = 0;
  const pools = [ps.hand, ps.mainDeck, ps.discardPile];
  for (const pool of pools) {
    for (const name of (pool || [])) {
      const cd = cardDB[name];
      if (!cd || cd.cardType !== 'Artifact') continue;
      const cost = cd.cost || 0;
      if (cost <= 0) continue;
      artifactCostSum += cost;
      artifactCostCount++;
    }
  }
  const avgArtifactCost = artifactCostCount > 0 ? artifactCostSum / artifactCostCount : 0;

  // (2b) On-board cost modifiers. Alchemy (support-zone spell) doubles
  //      artifact cost per stack. We cap the compounded multiplier at
  //      4× so pathological stacks don't skew the score off the charts.
  let alchemyLayers = 0;
  for (const inst of engine.cardInstances) {
    if (inst.controller !== pi || inst.zone !== 'support' || inst.faceDown) continue;
    if (inst.name === 'Alchemy') alchemyLayers++;
  }
  const costMult = Math.min(4, Math.pow(2, alchemyLayers));
  const effAvgCost = avgArtifactCost * costMult;

  // (3) Hand size. 4 is the rough "neutral" point; > 4 → gold preferred
  //     (new draws fit less well), < 4 → draws preferred (fill the hand).
  const handSize = (ps.hand || []).length;

  // (4) Kit lean via supportYield on alive, non-incapacitated heroes and
  //     their attached abilities (same data source as mctsHeroSupportDetails).
  let kitGoldRate = 0, kitDrawRate = 0;
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) continue;
    if (engine._isHeroMummified && engine._isHeroMummified(pi, hi)) continue;
    const ctx = { engine, pi, hi, cpuIdx: engine._cpuPlayerIdx };
    const apply = (y) => {
      if (!y) return;
      kitGoldRate += y.goldPerTurn || 0;
      // Potion-draws count as 3× regular draws (matches SUPPORT_UNIT_WEIGHTS).
      kitDrawRate += (y.drawsPerTurn || 0) + (y.potionDrawsPerTurn || 0) * 3;
    };
    const heroScript = loadCardEffect(hero.name);
    if (typeof heroScript?.supportYield === 'function') {
      try { apply(heroScript.supportYield(ctx)); } catch {}
    }
    const abZones = ps.abilityZones?.[hi] || [];
    for (const slot of abZones) {
      if (!slot || slot.length === 0) continue;
      const abScript = loadCardEffect(slot[0]);
      if (typeof abScript?.supportYield !== 'function') continue;
      try { apply(abScript.supportYield(slot.length, ctx)); } catch {}
    }
  }

  // Combine. Positive score → GOLD wins.
  let score = 0;
  score += (effAvgCost - gold) * 0.5;   // Deck pricier than current purse → want gold
  score += (handSize - 4) * 1.0;        // Full hand → draws waste slots; empty → want draws
  score += kitDrawRate * 2.5;           // Kit drawing a lot already → gain gold for variety
  score -= kitGoldRate * 2.5;           // Kit golding a lot already → gain draws for variety

  return score >= 0 ? 'gold' : 'draw';
}

// Highest Spell-School ability level on pi's live team. Used to identify
// which hero is "the team's main spellcaster" — higher threat than a
// secondary spellcaster with the same spell-school ability at the same level.
function mctsTeamMaxSchoolLvl(gs, pi) {
  const ps = gs.players[pi];
  if (!ps) return 0;
  let topLvl = 0;
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    const abZones = ps.abilityZones?.[hi] || [];
    for (const slot of abZones) {
      if (!slot || slot.length === 0) continue;
      if (SPELL_SCHOOL_ABILITIES.has(slot[0])) {
        if (slot.length > topLvl) topLvl = slot.length;
      }
    }
  }
  return topLvl;
}

// Threat multiplier on a single enemy hero's HP. Base is 1.0. Layered:
//   +0.5   Spell-School Ability at level ≥ 2 (established caster)
//   +0.5   their top spell-school level ties the team's top (main carry)
//   +0.25 × support units (draws/potions/gold, from supportYield)
//   +1.2   flat bonus if the hero is a damage supporter (damagePerTurn > 0),
//          +0.01 per damage point (capped at +1.5) — by user spec damage
//          supporters outrank even main carries
//   +0.3 × each full 20 atk over 120 — large-stick heroes are a scaling
//          threat on their own attack actions, independent of kit
function mctsEnemyHeroThreat(engine, oppIdx, hi, teamMaxSchoolLvl) {
  const gs = engine.gs;
  const ps = gs.players[oppIdx];
  const hero = ps?.heroes?.[hi];
  if (!hero?.name || hero.hp <= 0) return 1.0;
  const abZones = ps.abilityZones?.[hi] || [];
  let myMaxSchoolLvl = 0;
  for (const slot of abZones) {
    if (!slot || slot.length === 0) continue;
    if (SPELL_SCHOOL_ABILITIES.has(slot[0]) && slot.length > myMaxSchoolLvl) {
      myMaxSchoolLvl = slot.length;
    }
  }
  let threat = 1.0;
  if (myMaxSchoolLvl >= 2) threat += 0.5;
  if (myMaxSchoolLvl >= 2 && myMaxSchoolLvl === teamMaxSchoolLvl) threat += 0.5;

  const { supportUnits, damagePerTurn } = mctsHeroSupportDetails(engine, oppIdx, hi);
  threat += 0.25 * supportUnits;
  if (damagePerTurn > 0) {
    threat += 1.2 + Math.min(1.5, 0.01 * damagePerTurn);
  }

  // High-attack heroes are dangerous on their Attack cards; +0.3 per 20 atk
  // step past 120. Stepwise so atk 139 and 140 cleanly differ.
  const atk = hero.atk || 0;
  if (atk > 120) {
    threat += Math.floor((atk - 120) / 20) * 0.3;
  }
  return threat;
}

// How much gold could this player productively spend RIGHT NOW on plays
// that are otherwise ready to go? Sums:
//   • Artifact cards in hand that would be playable if gold weren't a
//     constraint (has a valid hero/slot, not locked, HOPT unclaimed, etc.).
//     Each artifact name counts once — two copies of the same card only
//     add one copy's cost (the second still sits until the first lands).
//   • On-board activations that charge gold. Cards opt in via
//     `cpuGoldCostForActivation(engine, pi, heroIdx, level, inst?)` which
//     must return the gold it would consume right now, or 0 if activation
//     isn't possible (HOPT claimed, wrong phase, missing prerequisite).
// Used by the evaluator to decide whether a gold gain is genuinely valuable
// (unmet demand) or near-worthless filler (demand already met).
function computeGoldDemand(engine, pi) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  if (!ps) return 0;
  const cardDB = engine._getCardDB();
  let demand = 0;

  // (a) Artifacts in hand — playability-filtered. planArtifactPlay checks
  // gold internally, so we briefly inflate ps.gold to bypass that gate
  // while keeping every OTHER check (targets, locks, HOPT). Safe because
  // planArtifactPlay is read-only and everything runs synchronously.
  const seenArtifact = new Set();
  const origGold = ps.gold;
  ps.gold = 1e9;
  try {
    for (let handIdx = 0; handIdx < (ps.hand || []).length; handIdx++) {
      const name = ps.hand[handIdx];
      if (seenArtifact.has(name)) continue;
      const cd = cardDB[name];
      if (!cd || cd.cardType !== 'Artifact') continue;
      const plan = planArtifactPlay(engine, pi, name, handIdx, cd);
      if (!plan) continue;
      seenArtifact.add(name);
      const rawCost = cd.cost || 0;
      const reduction = ps._nextArtifactCostReduction || 0;
      demand += Math.max(0, rawCost - reduction);
    }
  } finally {
    ps.gold = origGold;
  }

  // (b) On-board activatable effects that charge gold. Ability zones +
  // support-zone card instances that implement cpuGoldCostForActivation.
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    const abZones = ps.abilityZones?.[hi] || [];
    for (const slot of abZones) {
      if (!Array.isArray(slot) || slot.length === 0) continue;
      const abilityName = slot[0];
      const script = loadCardEffect(abilityName);
      if (typeof script?.cpuGoldCostForActivation !== 'function') continue;
      try {
        const c = script.cpuGoldCostForActivation(engine, pi, hi, slot.length);
        if (c > 0) demand += c;
      } catch {}
    }
  }
  for (const inst of engine.cardInstances) {
    if (inst.owner !== pi || inst.zone !== 'support') continue;
    const script = loadCardEffect(inst.name);
    if (typeof script?.cpuGoldCostForActivation !== 'function') continue;
    try {
      const c = script.cpuGoldCostForActivation(engine, pi, inst.heroIdx, null, inst);
      if (c > 0) demand += c;
    } catch {}
  }

  return demand;
}

/**
 * Demand-aware multiplier for an opponent's gold-yielding hero. Returned
 * value scales the static gold contribution to the hero's threat:
 *   ≈ 0.3  → opponent has plenty of gold and nothing to spend it on;
 *            their gold engine is redundant, killing it doesn't sting
 *   ≈ 0.6  → mild over-supply
 *   = 1.0  → balanced
 *   ≈ 1.4  → starved, every gold counts
 *   ≈ 1.8  → severely starved, gold engine is critical to remove
 *
 * Combines two signals:
 *   • Snapshot — current gold vs computeGoldDemand. Demand is what
 *     they could productively spend RIGHT NOW (artifacts in hand,
 *     gold-cost activations on board).
 *   • Historical — average end-of-turn gold across the game so far.
 *     A hoarder ending most turns with 15+ gold doesn't actually
 *     need more; a spender at 0–2 each turn is genuinely starved.
 *     Blends in once we have ≥3 turns of data so early-game noise
 *     doesn't swing the multiplier.
 */
function mctsOpponentGoldEconomy(engine, oppIdx) {
  const opp = engine.gs.players[oppIdx];
  if (!opp) return 1.0;
  const gold = opp.gold || 0;
  const demand = computeGoldDemand(engine, oppIdx);

  let snapshotMult;
  if (demand <= 0) {
    // No measurable demand — gold engines have nothing to feed. Heavy
    // discount when there's already a stockpile; mild discount when
    // gold is low (opp may be priming for next turn).
    snapshotMult = gold > 10 ? 0.3 : 0.6;
  } else {
    const ratio = gold / demand;
    if (ratio >= 2) snapshotMult = 0.3;          // ≥2× supply: saturated
    else if (ratio >= 1) snapshotMult = 0.6 - 0.3 * Math.min(1, ratio - 1);
    else snapshotMult = 1.0 + 0.8 * Math.min(1, 1 - ratio);
  }

  const hist = opp._cpuGoldHistory;
  if (hist && hist.turnsTracked >= 3) {
    const avgEnd = hist.totalGold / hist.turnsTracked;
    let histMult;
    if (avgEnd > 15)      histMult = 0.4; // hoarder
    else if (avgEnd > 10) histMult = 0.6;
    else if (avgEnd > 5)  histMult = 1.0;
    else if (avgEnd > 2)  histMult = 1.4;
    else                  histMult = 1.7; // spends everything
    return (snapshotMult + histMult) / 2;
  }
  return snapshotMult;
}

/**
 * Snapshot the active player's gold pool when their turn ends. Builds
 * up a per-player rolling average that `mctsOpponentGoldEconomy`
 * consults to tell hoarders apart from spenders.
 */
function recordEndOfTurnGold(engine) {
  const gs = engine.gs;
  const ap = gs?.activePlayer;
  if (ap == null || ap < 0) return;
  const ps = gs.players?.[ap];
  if (!ps) return;
  if (!ps._cpuGoldHistory) ps._cpuGoldHistory = { totalGold: 0, turnsTracked: 0 };
  ps._cpuGoldHistory.totalGold += (ps.gold || 0);
  ps._cpuGoldHistory.turnsTracked++;
}

function evaluateState(engine, cpuIdx) {
  const gs = engine.gs;
  const ps = gs.players[cpuIdx];
  const oppIdx = cpuIdx === 0 ? 1 : 0;
  const opp = gs.players[oppIdx];
  if (!ps || !opp) return 0;

  // Game end: terminal ±value.
  if (gs.result) {
    if (gs.result.winnerIdx === cpuIdx) return 100000;
    return -100000;
  }

  let score = 0;

  // ── Doomed-hero projection ──────────────────────────────────────────
  // Heroes flagged with `_forceKillAtTurnEnd === gs.turn` (Golden Ankh,
  // any future "revive for one turn only" effect) are alive RIGHT NOW
  // but un-negatably die at this turn's End Phase. The evaluator
  // measures end-of-turn outcomes for activations gated mid-turn, so
  // treat doomed heroes as already dead in the structural HP / dead-
  // bonus terms — they shouldn't credit the +HP / -dead-penalty that
  // a real revive would. Spell/Attack/Hero-Effect contributions made
  // during their forced-life DO persist (cards drawn, gold gained,
  // damage dealt) and show up via the other eval terms.
  const isDoomed = (h) => !!h && h._forceKillAtTurnEnd === gs.turn;
  const isAliveForEval = (h) => !!h?.name && h.hp > 0 && !isDoomed(h);
  const isDeadForEval = (h) => !!h?.name && (h.hp <= 0 || isDoomed(h));

  // Hero HP deltas. Own HP counts raw; opp HP is threat-weighted so damage
  // to a carry/supporter breaks ties over damage to a plain bruiser.
  let ownHp = 0;
  for (const h of (ps.heroes || [])) if (isAliveForEval(h)) ownHp += h.hp;

  const oppTeamMaxSchoolLvl = mctsTeamMaxSchoolLvl(gs, oppIdx);
  let oppWeightedHp = 0;
  let minOppHp = Infinity;
  for (let hi = 0; hi < (opp.heroes || []).length; hi++) {
    const h = opp.heroes[hi];
    if (!isAliveForEval(h)) continue;
    // Dynamic threat: layers spell-cast history, recent damage output,
    // role-redundancy with teammates, and summoner-no-room discount on
    // top of the static threat function. See mctsEnemyHeroDynamicValue.
    const threat = mctsEnemyHeroDynamicValue(engine, oppIdx, hi, oppTeamMaxSchoolLvl);
    oppWeightedHp += h.hp * threat;
    if (h.hp < minOppHp) minOppHp = h.hp;
  }
  score += ownHp - oppWeightedHp;

  // Final tiebreaker: focus-fire the enemy hero with the lowest current HP.
  // Reducing minOppHp raises score, so among targets that deal the same
  // weighted damage, the low-HP enemy wins — consistent focus across turns.
  // Weight kept small so it doesn't overwhelm threat or board-state terms.
  if (minOppHp !== Infinity) score -= 0.3 * minOppHp;

  // Killed-hero swing — huge, because losing a hero is close to losing.
  // Doomed-but-alive heroes count as dead here too (they will be by End
  // Phase, and that's what eval is projecting toward).
  for (const h of (ps.heroes || [])) if (isDeadForEval(h)) score -= 500;
  for (const h of (opp.heroes || [])) if (isDeadForEval(h)) score += 500;

  // ── Support zone occupancy (creatures + equips) ──────────────────
  // Per-zone base value is +30. Each card's own death may have
  // value to its owner (Hell Fox-style on-death tutors / damage /
  // gold), and other own creatures may be "chain sources" that fire
  // beneficial effects when an ally dies (Loyal Terrier window,
  // Loyal Shepherd revive, future cards with the same shape). Both
  // are read GENERICALLY off the per-card `cpuMeta` declaration:
  //
  //    cpuMeta: {
  //      onDeathBenefit: <number>,           // value to owner when this dies
  //      chainSource: {                       // declares: I react to ally deaths
  //        isArmed(engine, inst) → bool,      //   ready to fire?
  //        triggersOn(engine, tributeInst, sourceInst) → bool,
  //        valuePerTrigger: <number>,         //   chain payoff magnitude
  //      },
  //    }
  //
  // The eval combines these to compute "effective on-death value to
  // owner" per creature: own intrinsic benefit + sum of chain
  // bonuses from armed same-side sources whose `triggersOn` matches
  // this creature. The slot's "alive value" is then `30 - effective`
  // (clamped to a small floor so creatures keep some board-presence
  // value). On the OWN side this discounts sacrifice-fodder
  // creatures so MCTS prefers to feed them to chains. On the OPP
  // side it disincentivises killing opp's death-engines (we don't
  // want to fuel their plan).
  //
  // Chain sources themselves are NEVER discounted by chain bonuses —
  // killing your own Terrier ends the window, killing your own
  // Shepherd ends the revive HOPT for the rest of the turn. The
  // eval skips applying chain bonuses to any creature whose own
  // script declares `cpuMeta.chainSource`.
  const SLOT_BASE         = 30;
  const SLOT_FLOOR        = 5;
  // Pre-collect armed chain sources per side so each per-slot calc
  // doesn't re-walk cardInstances.
  const collectArmedChainSources = (ownerIdx) => {
    const sources = [];
    for (const inst of engine.cardInstances) {
      if (inst.owner !== ownerIdx) continue;
      if (inst.zone !== 'support') continue;
      if (inst.faceDown) continue;
      const script = loadCardEffect(inst.name);
      const chain = script?.cpuMeta?.chainSource;
      if (!chain) continue;
      try {
        if (chain.isArmed && !chain.isArmed(engine, inst)) continue;
      } catch { continue; }
      sources.push({ inst, chain, script });
    }
    return sources;
  };
  const ownChainSources = collectArmedChainSources(cpuIdx);
  const oppChainSources = collectArmedChainSources(oppIdx);
  /**
   * Effective "value to owner of this Creature dying" — sum of the
   * Creature's own `onDeathBenefit` plus every armed same-side
   * chain source that would fire on this death. Chain sources
   * themselves don't get chain bonuses applied (we don't want the
   * CPU killing its own engine).
   */
  const effectiveOnDeathValue = (inst, ownerIdx) => {
    if (!inst) return 0;
    const script = loadCardEffect(inst.name);
    const meta = script?.cpuMeta;
    let value = meta?.onDeathBenefit || 0;
    if (meta?.chainSource) return value; // chain sources skip chain bonuses
    const sources = ownerIdx === cpuIdx ? ownChainSources : oppChainSources;
    for (const { inst: srcInst, chain } of sources) {
      if (srcInst.id === inst.id) continue; // can't trigger off self
      try {
        if (chain.triggersOn && !chain.triggersOn(engine, inst, srcInst)) continue;
      } catch { continue; }
      value += chain.valuePerTrigger || 0;
    }
    return value;
  };
  let ownSupVal = 0, oppSupVal = 0;
  for (let hi = 0; hi < 3; hi++) {
    for (let z = 0; z < 3; z++) {
      const ownSlot = ps.supportZones?.[hi]?.[z] || [];
      const oppSlot = opp.supportZones?.[hi]?.[z] || [];
      if (ownSlot.length > 0) {
        const inst = engine.cardInstances.find(c =>
          c.owner === cpuIdx && c.zone === 'support'
          && c.heroIdx === hi && c.zoneSlot === z
        );
        const onDeath = effectiveOnDeathValue(inst, cpuIdx);
        ownSupVal += Math.max(SLOT_FLOOR, SLOT_BASE - onDeath);
      }
      if (oppSlot.length > 0) {
        const inst = engine.cardInstances.find(c =>
          c.owner === oppIdx && c.zone === 'support'
          && c.heroIdx === hi && c.zoneSlot === z
        );
        const onDeath = effectiveOnDeathValue(inst, oppIdx);
        oppSupVal += Math.max(SLOT_FLOOR, SLOT_BASE - onDeath);
      }
    }
  }
  score += ownSupVal - oppSupVal;

  // ── Change Counters (Cosmic Depths) ──────────────────────────────
  // Generic counter resource — Analyzer / Gatherer / Argos accumulate
  // them passively from opponent draws and tutor effects. Counters
  // power downstream payoffs:
  //   • Argos hero effect: remove N → place a Lv N CD Creature.
  //   • Gatherer: remove ≤3 → draw N.
  //   • Analyzer: remove ≤6 → spawn 1 Invader Token per 2.
  //   • Cosmic Manipulation places counters on shuffle-back-this-turn.
  //   • Invader Token punishes the turn player who owns NO counters.
  //
  // Eval values each owned counter at a small flat amount, scaled UP
  // when the side has consumers on board (cards that turn counters
  // into payoff). Without consumers, counters are dead weight (worth
  // ~1 each — still > 0 so the eval prefers acquiring them, but
  // doesn't over-weight stockpiling). With consumers the per-counter
  // value rises so MCTS values both the buildup and the eventual
  // spend.
  //
  // The "consumer" detection uses the same `cpuMeta.counterConsumer`
  // declaration that future cards can opt into. Today: Argos,
  // Gatherer, Analyzer.
  const COUNTER_VALUE_BASE     = 1;
  const COUNTER_VALUE_CONSUMER = 4;
  const hasCounterConsumer = (ownerIdx) => {
    const ps2 = gs.players[ownerIdx];
    if (!ps2) return false;
    for (const h of (ps2.heroes || [])) {
      if (!h?.name || h.hp <= 0) continue;
      if (loadCardEffect(h.name)?.cpuMeta?.counterConsumer) return true;
    }
    for (const inst of engine.cardInstances) {
      if ((inst.controller ?? inst.owner) !== ownerIdx) continue;
      if (inst.zone !== 'support') continue;
      if (inst.faceDown) continue;
      if (inst.counters?.negated || inst.counters?.nulled) continue;
      if (loadCardEffect(inst.name)?.cpuMeta?.counterConsumer) return true;
    }
    return false;
  };
  const tallyChangeCountersForSide = (ownerIdx) => {
    let total = 0;
    const ps2 = gs.players[ownerIdx];
    if (!ps2) return 0;
    for (const h of (ps2.heroes || [])) {
      if (!h?.name || h.hp <= 0) continue;
      total += h._changeCounters || 0;
    }
    for (const inst of engine.cardInstances) {
      if (inst.zone !== 'support') continue;
      if (inst.faceDown) continue;
      if ((inst.controller ?? inst.owner) !== ownerIdx) continue;
      total += inst.counters?.changeCounter || 0;
    }
    return total;
  };
  const ownCounters = tallyChangeCountersForSide(cpuIdx);
  const oppCounters = tallyChangeCountersForSide(oppIdx);
  const ownPerCounter = hasCounterConsumer(cpuIdx) ? COUNTER_VALUE_CONSUMER : COUNTER_VALUE_BASE;
  const oppPerCounter = hasCounterConsumer(oppIdx) ? COUNTER_VALUE_CONSUMER : COUNTER_VALUE_BASE;
  score += ownCounters * ownPerCounter - oppCounters * oppPerCounter;

  // ── Invader Token end-of-turn pressure ───────────────────────────
  // Generic "punishes-turn-player-with-no-counters" eval term. Cards
  // can opt in via:
  //   cpuMeta.endOfTurnPunisher: {
  //     conditionFor: 'noChangeCounters',
  //     // expected damage when the punishment fires (50 for Invader
  //     // Token's damage mode); the discard branch is roughly worth
  //     // half the token's average impact, so we use the damage
  //     // amount as the projection — under-rewards discard, over-
  //     // rewards damage, but the median signal is right.
  //     expectedDamage: <number>,
  //   }
  // For the active player at eval time: if THEIR side controls 0
  // counters AND any opp-controlled punisher, project the damage
  // hit AT END OF TURN. Score deducts for own side (we'll get hit)
  // or rewards (opp will get hit).
  const punisherDamageAgainst = (sufferIdx) => {
    const ps2 = gs.players[sufferIdx];
    if (!ps2) return 0;
    if (tallyChangeCountersForSide(sufferIdx) > 0) return 0;
    let dmg = 0;
    for (const inst of engine.cardInstances) {
      if (inst.zone !== 'support') continue;
      if (inst.faceDown) continue;
      if ((inst.controller ?? inst.owner) !== sufferIdx) continue;
      const meta = loadCardEffect(inst.name)?.cpuMeta?.endOfTurnPunisher;
      if (!meta || meta.conditionFor !== 'noChangeCounters') continue;
      dmg += meta.expectedDamage || 0;
    }
    return dmg;
  };
  // The PROJECTED hit lands on whichever side is the active player at
  // eval time. If we're evaluating mid-CPU-turn, the CPU gets hit. Mid-
  // opp-turn, the opp gets hit. Use gs.activePlayer as the discriminator.
  const turnPi = gs.activePlayer;
  if (turnPi === cpuIdx) score -= punisherDamageAgainst(cpuIdx);
  else if (turnPi === oppIdx) score += punisherDamageAgainst(oppIdx);

  // ── Generic "pile-fuel" scaling ────────────────────────────────────
  // Cards that benefit from cards in their controller's discard pile
  // (and optionally still in the deck as latent fuel) opt in via:
  //
  //   cpuMeta: {
  //     pileFuel: {
  //       // Where this card's scaling counts FROM, with weights.
  //       // Default: support 1.0 + hand 0.5. A Phoenix-class card
  //       // that's still in hand contributes at half value because
  //       // the bonus only realises after it's summoned.
  //       presenceWeights: { support: 1.0, hand: 0.5 },
  //
  //       // True (default) → multiple copies sum their weights.
  //       // False           → uniqueness-locked cards take MAX weight
  //       //                   across copies (extras are redundant).
  //       stackable: true,
  //
  //       // What counts as fuel in the controller's discard pile.
  //       // Predicate against cards.json data.
  //       discardFilter: (cardData) => boolean,
  //       discardValue: <number per match>,
  //
  //       // Optional latent fuel — cards still in the deck that
  //       // COULD become discard fuel via mill / draw + discard.
  //       // Disabled unless all three deck* fields are set. The
  //       // deckMinSize floor makes self-mill cards (Cute Cat etc.)
  //       // look positive while decking out isn't a risk; below the
  //       // floor the deck-out penalty (further down) takes over.
  //       deckFilter: (cardData) => boolean,
  //       deckValue: <number per match>,
  //       deckMinSize: <int — deck.length must be >= this>,
  //     },
  //   }
  //
  // The brain reads this generically:
  //   • Walk active cardInstances on the controller's side; group
  //     by name; collect each instance's presenceWeight.
  //   • For unique scripts (stackable: false) take MAX weight,
  //     for stackable take SUM. (Caps at 1.0 effective for unique
  //     cards no matter how many in-hand copies sit there.)
  //   • For each name, multiply effective weight by:
  //       discardValue × (matching cards in controller's discard)
  //     plus, if deckMinSize gate passes:
  //       deckValue    × (matching cards still in deck)
  //   • Subtract the symmetric value computed for the opponent.
  //
  // Combined with the forceDiscard simulator above pushing candidates
  // into discardPile before re-scoring, every prompted discard sees
  // pileFuel-relevant cards becoming "actively beneficial to drop"
  // when the controller has a matching pile-fuel card anywhere. No
  // per-card hardcoding inside the eval — just a cpuMeta declaration
  // on the relying card.
  const computePileFuelContribution = (player, ownerIdx) => {
    // Group active sources by card name.
    const byName = new Map();
    for (const inst of engine.cardInstances) {
      if ((inst.controller ?? inst.owner) !== ownerIdx) continue;
      if (inst.faceDown) continue;
      if (inst.counters?.negated || inst.counters?.nulled) continue;
      const meta = loadCardEffect(inst.name)?.cpuMeta?.pileFuel;
      if (!meta) continue;
      const weights = meta.presenceWeights || { support: 1.0, hand: 0.5 };
      const w = weights[inst.zone];
      if (!w) continue;
      let entry = byName.get(inst.name);
      if (!entry) { entry = { meta, weights: [] }; byName.set(inst.name, entry); }
      entry.weights.push(w);
    }
    if (byName.size === 0) return 0;

    const cardDB = engine._getCardDB();
    let total = 0;
    for (const { meta, weights } of byName.values()) {
      const effective = (meta.stackable === false)
        ? Math.max(...weights)
        : weights.reduce((a, b) => a + b, 0);
      if (effective <= 0) continue;

      // Discard fuel
      if (meta.discardFilter && meta.discardValue) {
        let matches = 0;
        for (const cn of (player.discardPile || [])) {
          const cd = cardDB[cn];
          if (cd && meta.discardFilter(cd)) matches++;
        }
        total += meta.discardValue * matches * effective;
      }

      // Latent deck fuel — gated on a min deck size so the brain
      // doesn't chase mill into deck-out.
      if (meta.deckFilter && meta.deckValue && meta.deckMinSize != null) {
        if ((player.mainDeck || []).length >= meta.deckMinSize) {
          let matches = 0;
          for (const cn of (player.mainDeck || [])) {
            const cd = cardDB[cn];
            if (cd && meta.deckFilter(cd)) matches++;
          }
          total += meta.deckValue * matches * effective;
        }
      }
    }
    return total;
  };
  score += computePileFuelContribution(ps, cpuIdx);
  score -= computePileFuelContribution(opp, oppIdx);

  // ── Cute Hydra damage potential ────────────────────────────────────
  // Each Head Counter caps the number of distinct targets her HOPT
  // can hit for 100 each. Useful damage tops out at the count of
  // viable enemy targets (heroes + creatures), so we credit
  // 100 × min(heads, viableTargets) as the per-turn damage threat.
  // Symmetric across sides — opp's loaded Hydra is our future pain.
  const countViableTargetsAgainst = (player) => {
    let n = 0;
    for (const h of (player.heroes || [])) {
      if (h?.name && h.hp > 0) n++;
    }
    for (let hi = 0; hi < (player.heroes || []).length; hi++) {
      for (let z = 0; z < 3; z++) {
        const slot = player.supportZones?.[hi]?.[z] || [];
        if (slot.length > 0) n++;
      }
    }
    return n;
  };
  const hydraDamagePotential = (ownerIdx, opposingPlayer) => {
    const targets = countViableTargetsAgainst(opposingPlayer);
    if (targets === 0) return 0;
    let total = 0;
    for (const inst of engine.cardInstances) {
      if (inst.name !== 'Cute Hydra') continue;
      if (inst.owner !== ownerIdx) continue;
      if (inst.zone !== 'support') continue;
      if (inst.faceDown) continue;
      if (inst.counters?.negated || inst.counters?.nulled) continue;
      const heads = inst.counters?.headCounter || 0;
      if (heads <= 0) continue;
      total += 100 * Math.min(heads, targets);
    }
    return total;
  };
  score += hydraDamagePotential(cpuIdx, opp);
  score -= hydraDamagePotential(oppIdx, ps);

  // Ability totals — cumulative stacked abilities matter more than fresh ones.
  let ownAb = 0, oppAb = 0;
  for (let hi = 0; hi < 3; hi++) {
    for (let z = 0; z < 3; z++) {
      ownAb += (ps.abilityZones?.[hi]?.[z] || []).length;
      oppAb += (opp.abilityZones?.[hi]?.[z] || []).length;
    }
  }
  score += 15 * (ownAb - oppAb);

  // ── Engine-tier ability bonus ────────────────────────────────────
  // Some abilities are deck-defining "engines" — Divinity's free
  // level coverage, future engine abilities of similar weight. Each
  // such ability declares its magnitude on its script:
  //
  //    cpuMeta: { engineValue: 120 }
  //
  // The eval reads it generically. For each ability slot on each
  // hero we look up the BASE ability's script (zone[0]) — that
  // determines the engine identity, since Performance copies on top
  // inherit the base's school. Stack size multiplies the bonus, so
  // a Lv2 Divinity (or Divinity + Performance) is twice as valuable
  // as a Lv1.
  //
  // Symmetric: opp engine stacks count negatively, so MCTS values
  // stripping/disrupting an opp's engine ability proportionally.
  const sumEngineValue = (pl) => {
    let total = 0;
    for (let hi = 0; hi < (pl.heroes || []).length; hi++) {
      const zones = pl.abilityZones?.[hi] || [];
      for (const slot of zones) {
        if (!slot || slot.length === 0) continue;
        // zone[0] is the BASE ability — that's what governs the
        // engine identity. Performance copies stacked on top
        // inherit the base's role.
        const baseScript = loadCardEffect(slot[0]);
        const engineValue = baseScript?.cpuMeta?.engineValue || 0;
        if (engineValue > 0) total += engineValue * slot.length;
      }
    }
    return total;
  };
  score += sumEngineValue(ps) - sumEngineValue(opp);

  // Hand-value differential — weighted by card PLAYABILITY rather than
  // flat size. A card that can plausibly be played within the next ~2
  // turns is worth full value; a "dead" card (unaffordable within the
  // lookahead horizon, or locked out by current status) is worth much
  // less. This lets MCTS reward mulligans/searches/draws generically
  // based on hand QUALITY, not just card COUNT:
  //   • Mulligan: return dead cards (~5 value), draw replacements
  //     (~15 average) → positive delta, gate passes.
  //   • Search: pick the specific high-value card from deck → big delta.
  //   • Draw: expected-value new card (~15) beats gate threshold.
  // Duplicate copies beyond the first are half-value (HOPT / once-per-
  // turn cards don't benefit from multiple copies in hand).
  // Opponent hand is opaque — value it flat at 20/card (status quo).
  // Hand-value scoring — uses the shared `estimateHandCardValueFor`
  // helper so the same valuation drives both `evaluateState`'s hand
  // term and the deck-search heuristic in cpuGenericChoice (Magnetic
  // Glove / Potion picking the highest-impact card from deck instead
  // of random).
  let ownHandValue = 0;
  {
    const counts = {};
    for (const name of (ps.hand || [])) {
      const seen = counts[name] || 0;
      ownHandValue += estimateHandCardValueFor(engine, cpuIdx, name, seen);
      counts[name] = seen + 1;
    }
  }
  const oppHandValue = 20 * (opp.hand?.length || 0);
  score += ownHandValue - oppHandValue;

  // ── Deck-out awareness ─────────────────────────────────────────────
  // When the CPU's deck is shrinking OR the opponent has shown ANY
  // mill capability this game, deck cards become a precious resource.
  // Penalty grows as the deck approaches 0, pulling MCTS away from
  // Trade / self-mill / aggressive draw plays that would hasten deck-
  // out. Symmetric bonus when the opponent's deck is thin (our own
  // mill pressure pays off).
  //
  // Tiers (stack):
  //   milled this game (sticky) → −2 per missing card below 30
  //                               (kicks in at any deck size once the
  //                                opponent has shown mill threat)
  //   deck ≤ 20                 → additional −5 per missing card below 20
  //   deck ≤ 10                 → additional −30 per missing card below 10
  //                               (drawing itself becomes net-negative:
  //                                each card pulled erodes this tier more
  //                                than the +15 average card is worth)
  //
  // At deck=0 with the mill flag the combined crisis term is ~−420, enough
  // to dominate local eval noise.
  const ownDeckSize = ps.mainDeck?.length || 0;
  const oppDeckSize = opp.mainDeck?.length || 0;
  const applyDeckOut = (deckSize, milled) => {
    let penalty = 0;
    if (milled && deckSize < 30) penalty += (30 - deckSize) * 2;
    if (deckSize <= 20) penalty += (20 - deckSize) * 5;
    if (deckSize <= 10) penalty += (10 - deckSize) * 30;
    return penalty;
  };
  score -= applyDeckOut(ownDeckSize, !!ps._oppHasMilledMe);
  score += applyDeckOut(oppDeckSize, !!opp._oppHasMilledMe);
  // Gold value depends on demand vs supply, not absolute amount. Demand =
  // gold the CPU could productively spend right now (artifacts in hand it
  // could actually play, on-board effects that charge gold to activate).
  //   • Every gold up to demand: 2× each — it unlocks a play
  //   • Every gold beyond demand: 0.2× each — hoarded, rarely useful
  // Turns Adventurousness (Action → +20 gold) from a flat +40 eval into a
  // context-dependent decision: strong when demand > supply, weak when
  // already covered. Symmetric for the opponent — draining gold from a
  // spend-ready opp is powerful, from a hoarder is nearly worthless.
  const ownGoldDemand = computeGoldDemand(engine, cpuIdx);
  const oppGoldDemand = computeGoldDemand(engine, oppIdx);
  const goldValue = (gold, demand) => {
    const met = Math.min(gold, demand);
    const excess = Math.max(0, gold - demand);
    return met * 2 + excess * 0.2;
  };
  score += goldValue(ps.gold || 0, ownGoldDemand) - goldValue(opp.gold || 0, oppGoldDemand);

  // Opponent-turn lookahead via status damage anticipation. Burn/poison
  // stacks on a living hero will tick on the respective owner's next turn;
  // bake that expected damage into the score now so MCTS sees "my 40 HP
  // hero with 2 burn stacks is effectively dead" and "their low-HP burn'd
  // hero is worth leaving alone for the poison to finish". Pending kill
  // = full kill-swing; pending non-lethal burn = ~0.5× expected HP loss.
  //
  // Own-side poison is NOT treated as a standing downside unless the tick
  // is lethal: several of our own cards deliberately poison friendly
  // targets (Zsos'Ssar's Decay-cast cost, Pet Snake's summon cure-swap,
  // Poison Pollen's AoE that also tags our creatures) because the same
  // stacks are the fuel for damage-scaling effects (Zsos'Ssar's "+40 per
  // poisoned target" single-target multiplier, etc.). Penalizing non-
  // lethal self-poison causes MCTS to shy away from the very plays those
  // decks are built around. Lethal ticks still trigger the full crisis
  // penalty — we still care about not actually LOSING the hero.
  const STATUS_DMG_PER_STACK = 30; // baseline; matches Medea's 30-per-stack doubling
  for (const h of (ps.heroes || [])) {
    if (!h?.name || h.hp <= 0) continue;
    const burn = h.statuses?.burn || 0;
    const poison = h.statuses?.poison || 0;
    const totalDmg = STATUS_DMG_PER_STACK * (burn + poison);
    if (totalDmg >= h.hp) { score -= 400; continue; } // anticipated kill — crisis
    // Burn always drains (no "good burn" synergy exists in this game).
    if (burn > 0) score -= 0.5 * STATUS_DMG_PER_STACK * burn;
    // Non-lethal own poison is intentionally ignored — see comment above.
  }
  for (let hi = 0; hi < (opp.heroes || []).length; hi++) {
    const h = opp.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    const stacks = (h.statuses?.burn || 0) + (h.statuses?.poison || 0);
    if (stacks <= 0) continue;
    const dmg = STATUS_DMG_PER_STACK * stacks;
    if (dmg >= h.hp) score += 400; // anticipated kill
    else {
      const threat = mctsEnemyHeroDynamicValue(engine, oppIdx, hi, oppTeamMaxSchoolLvl);
      score += 0.5 * dmg * threat;
    }
  }

  // Opponent-turn attack anticipation. The opp's highest-atk living,
  // un-CC'd hero is a proxy for their next-turn damage output — assume one
  // of their Attack cards scales with that stat and lands on the CPU's
  // most vulnerable hero. This is the "my 40-HP hero dies next turn to
  // their 180-atk bruiser" signal that status-anticipation alone misses.
  // Deliberately conservative: we don't peek at their hand, we don't
  // try to simulate their whole turn; one atk-worth of pressure per turn.
  let oppMaxAtk = 0;
  for (const h of (opp.heroes || [])) {
    if (!h?.name || h.hp <= 0) continue;
    if (h.statuses?.frozen || h.statuses?.stunned || h.statuses?.negated) continue;
    const a = h.atk || 0;
    if (a > oppMaxAtk) oppMaxAtk = a;
  }
  if (oppMaxAtk > 0) {
    // Effective HP of our weakest hero — Immortal floors at 1 since the
    // buff expires before the opp can actually attack, but it still buys
    // a turn of survival in some corner cases.
    let weakestOwnHp = Infinity;
    for (const h of (ps.heroes || [])) {
      if (!h?.name || h.hp <= 0) continue;
      if (h.hp < weakestOwnHp) weakestOwnHp = h.hp;
    }
    if (weakestOwnHp !== Infinity) {
      if (oppMaxAtk >= weakestOwnHp) score -= 400; // anticipated kill next turn
      else score -= 0.4 * oppMaxAtk;                // expected chip damage
    }
  }

  // Ascension progress. When a hero becomes ascensionReady, the next hand
  // ascension play flips them into a far stronger form — credit this both
  // at the incremental-progress level (so MCTS can see "equipping the Sword
  // moved me from 0.0 → 0.5") and as a jump when fully ready. Symmetric
  // penalty for opponent progress. Uses each hero's script-declared
  // ascensionProgress(engine, pi, hi) → 0..1 when available.
  const scoreAscension = (ownerIdx, sign) => {
    const pss = gs.players[ownerIdx];
    if (!pss) return;
    for (let hi = 0; hi < (pss.heroes || []).length; hi++) {
      const h = pss.heroes[hi];
      if (!h?.name || h.hp <= 0) continue;
      if (h.ascensionReady) { score += sign * 300; continue; }
      const script = loadCardEffect(h.name);
      if (typeof script?.ascensionProgress !== 'function') continue;
      try {
        const p = script.ascensionProgress(engine, ownerIdx, hi) || 0;
        if (p > 0) score += sign * 250 * p;
      } catch {}
    }
  };
  scoreAscension(cpuIdx, +1);
  scoreAscension(oppIdx, -1);

  // ── Cardinal Beasts alt win condition ──
  // All 4 Cardinal Beasts on your Support Zones = instant win. Reward
  // progress aggressively so MCTS rollouts + candidate scoring steer
  // decks like Dance of the Butterflies toward assembly rather than
  // playing for HP-based victories they can't actually win.
  //   - Per beast on board: +250 (comparable to ascension-ready bonus)
  //   - Bonus for having 3 on board (one more = win): +500
  //   - All 4 on board: +100000 (terminal-value equivalent to game win)
  //   - Each accessible beast (hand/deck, not yet on board): +40
  //   - Can-potentially-complete bonus (all 4 reachable): +400
  // Symmetric penalty when the opponent is progressing.
  const CARDINAL_BEAST_NAMES = [
    'Cardinal Beast Baihu',
    'Cardinal Beast Qinglong',
    'Cardinal Beast Xuanwu',
    'Cardinal Beast Zhuque',
  ];
  const scoreCardinalBeasts = (pi) => {
    const pss = gs.players[pi];
    if (!pss) return 0;
    const onBoard = new Set();
    for (let hi = 0; hi < (pss.heroes || []).length; hi++) {
      for (let zi = 0; zi < (pss.supportZones?.[hi] || []).length; zi++) {
        const slot = (pss.supportZones[hi] || [])[zi] || [];
        if (slot.length > 0 && CARDINAL_BEAST_NAMES.includes(slot[0])) {
          onBoard.add(slot[0]);
        }
      }
    }
    if (onBoard.size >= 4) return 100000;
    const pool = [...(pss.hand || []), ...(pss.mainDeck || [])];
    const accessible = new Set();
    for (const n of CARDINAL_BEAST_NAMES) {
      if (onBoard.has(n)) continue;
      if (pool.includes(n)) accessible.add(n);
    }
    let s = onBoard.size * 250 + accessible.size * 40;
    if (onBoard.size === 3) s += 500; // one away from the win
    if (onBoard.size + accessible.size === 4) s += 400; // complete set reachable
    return s;
  };
  score += scoreCardinalBeasts(cpuIdx);
  score -= scoreCardinalBeasts(oppIdx);

  return score;
}

// Dispatches an Action-Phase candidate to the right helper. Returns true
// if the play actually shrank the CPU's hand (a real play occurred).
async function applyActionCandidate(engine, helpers, candidate) {
  const cpuIdx = engine._cpuPlayerIdx;
  const handBefore = engine.gs.players[cpuIdx].hand.length;
  const { cardName, cardType, handIdx, heroIdx } = candidate;
  if (cardType === 'AbilityAction') {
    // Ability-action activation during rollout. Track HOPT claim as the
    // "did this fire" signal since hand won't shrink.
    const hoptKey = `ability-action:${candidate.abilityName}:${cpuIdx}`;
    const hoptBefore = engine.gs.hoptUsed?.[hoptKey];
    await helpers.doActivateAbility(helpers.room, cpuIdx, {
      heroIdx, zoneIdx: candidate.zoneIdx,
    });
    return engine.gs.hoptUsed?.[hoptKey] === engine.gs.turn && hoptBefore !== engine.gs.turn;
  }
  if (cardType === 'Creature') {
    // Prefer the pre-chosen zone from candidate enumeration; fall back to
    // the heuristic picker if the candidate didn't specify one (legacy /
    // non-Action-Phase caller) or the chosen slot is no longer free.
    let zoneSlot = candidate.zoneSlot;
    const ps2 = engine.gs.players[cpuIdx];
    const slotTaken = zoneSlot != null
      && (((ps2.supportZones?.[heroIdx] || [])[zoneSlot] || []).length > 0);
    if (zoneSlot == null || zoneSlot < 0 || slotTaken) {
      zoneSlot = pickCreatureZoneSlot(engine, cpuIdx, heroIdx);
    }
    if (zoneSlot < 0) return false;
    await helpers.doPlayCreature(helpers.room, cpuIdx, {
      cardName, handIndex: handIdx, heroIdx, zoneSlot,
    });
  } else if (cardType === 'Spell' || cardType === 'Attack') {
    await helpers.doPlaySpell(helpers.room, cpuIdx, {
      cardName, handIndex: handIdx, heroIdx,
    });
  } else {
    return false;
  }
  return engine.gs.players[cpuIdx].hand.length < handBefore;
}

// Plays out the rest of the CPU's turn after a candidate action. Advances
// through the End Phase so onTurnEnd hooks fire (Ghuanjun removing self-
// Immortal, timed buffs cleaning up, expiring effects, etc.) — evaluating
// before those fire systematically overvalues self-buffs that clean up
// at end-of-turn. Stops before switchTurn: the human's turn is not modeled.
async function rolloutRestOfTurn(engine, helpers) {
  const cpuIdx = engine._cpuPlayerIdx;
  // If phase is still Action (combo mechanics held it open), advance once.
  if (engine.gs.currentPhase === 3) {
    try { await engine.advancePhase(cpuIdx); } catch {}
  }
  // Play Main Phase 2 if we're there. runMainPhase is idempotent — it
  // stops when no further progress can be made.
  if (engine.gs.currentPhase === 4) {
    try { await runMainPhase(engine, helpers); } catch (err) {
      // Swallow — evaluator scores the partial state.
      cpuLog(`  [MCTS] rollout runMainPhase threw:`, err.message);
    }
  }
  // tryAscend runs as the last Main-2 action — include it for accurate eval.
  try { await tryAscend(engine, helpers); } catch {}
  // Advance Main2 → End so onTurnEnd hooks fire. This is the key difference
  // between "what the board looks like at end of Main 2" and "what the
  // opponent will actually see" — timed self-buffs (e.g. Ghuanjun Immortal)
  // are explicitly cleaned up here, so MCTS stops rewarding them.
  if (engine.gs.currentPhase === 4) {
    try { await engine.advancePhase(cpuIdx); } catch {}
  }
  // ── Opp-upkeep sim ─────────────────────────────────────────────────────
  // Extend rollout past End Phase into the opponent's Start + Resource
  // phases. Their status-damage ticks, onTurnStart hooks, draws, and
  // resource gain all fire now — so the evaluator sees the REAL post-turn
  // state rather than an approximation.
  if (engine.gs.currentPhase === 5 && engine.gs.activePlayer === cpuIdx && !engine.gs.result) {
    try { await engine.advancePhase(cpuIdx); } catch {}
    // After advancePhase from End, switchTurn fires and activePlayer flips.
    // Bounded loop: advance up to a handful of times until we reach opp's
    // Main 1 (phase 2) or the game ends. A couple of phases are typically
    // auto-advanced by the engine; this covers any manual steps left over.
    let guard = 6;
    while (guard-- > 0) {
      if (engine.gs.result) break;
      if (engine.gs.activePlayer === cpuIdx) break; // defensive: back to us
      if (engine.gs.currentPhase >= 2) break; // reached opp Main 1
      try { await engine.advancePhase(engine.gs.activePlayer); } catch { break; }
    }
  }

  // ── Multi-turn simulation loop (horizon 1..4) ──────────────────────────
  // Each iteration simulates ONE full turn. After each runCpuTurn, the
  // engine's End→switchTurn→auto-advance cascade parks us in the NEXT
  // player's Main 1. Flip `_cpuPlayerIdx` to the current active player
  // each iteration so the brain plays for the right side. `_inMctsSim`
  // is true throughout → nested MCTS short-circuits to heuristic/eval-
  // greedy depending on _rolloutBrain.
  const savedCpuIdx = engine._cpuPlayerIdx;
  try {
    for (let t = 1; t <= _rolloutHorizon; t++) {
      if (engine.gs.result) break;
      if (engine.gs.currentPhase !== 2) break; // not in Main 1, can't invoke
      engine._cpuPlayerIdx = engine.gs.activePlayer;
      try {
        await runCpuTurn(engine, helpers);
      } catch (err) {
        cpuLog(`  [MCTS] horizon turn ${t} (pi=${engine._cpuPlayerIdx}) sim threw:`, err.message);
        // Don't break — next turn might still run fine. Evaluator scores
        // the partial state at the end.
      }
    }
  } finally {
    engine._cpuPlayerIdx = savedCpuIdx;
  }
}

// One rollout of a candidate with an optional scripted target plan. Returns
// { score, record, completed }. Record is only populated when requested.
async function mctsRunOneRollout(engine, helpers, candidate, { plan = null, record = false } = {}) {
  const cpuIdx = engine._cpuPlayerIdx;
  const snap = engine.snapshot();
  // Mark "inside MCTS sim" so the engine's CPU driver (fired by switchTurn
  // during opp-upkeep advances) doesn't recurse into the opp's brain. This
  // is separate from _fastMode — self-play games run with _fastMode=true
  // end-to-end, so we can't use that flag as the "don't invoke driver"
  // signal any more.
  const prevInSim = engine._inMctsSim;
  engine._inMctsSim = true;
  engine.enterFastMode();
  engine._mctsTargetPlan = plan ? [...plan] : null;
  const recordBuf = record ? [] : null;
  if (recordBuf) engine._mctsTargetRecord = recordBuf;
  // Save+restore _cpuLogSilent rather than blindly setting it to false at
  // the end — nested rollouts (e.g. a Main-Phase gate fired inside an
  // outer Action-Phase rollout) would otherwise unsilence the outer scope
  // halfway through and spam stdout for the rest of the outer rollout.
  const prevSilent = _cpuLogSilent;
  _cpuLogSilent = true;
  let score = -Infinity;
  let completed = false;
  try {
    const applied = await applyActionCandidate(engine, helpers, candidate);
    if (applied) await rolloutRestOfTurn(engine, helpers);
    score = evaluateState(engine, cpuIdx);
    completed = true;
  } catch (err) {
    _cpuLogSilent = prevSilent;
    cpuLog(`  [MCTS] rollout threw on "${candidate.cardName}":`, err.message);
    _cpuLogSilent = true;
  } finally {
    delete engine._mctsTargetPlan;
    if (recordBuf) delete engine._mctsTargetRecord;
    engine.exitFastMode();
    engine.restore(snap);
    engine._inMctsSim = prevInSim;
    _cpuLogSilent = prevSilent;
  }
  return { score, record: recordBuf || [], completed };
}

// Gate a Main-Phase activation through MCTS-style evaluation. The caller
// passes an actionFn that performs the activation via helpers.doXxx. We:
//   1. Snapshot + fast-mode execute it once (recon), recording any CPU
//      prompts along the way; score the resulting state.
//   2. Compare against the "skip" score (don't do the activation at all).
//   3. If a prompt branched (≥2 alternatives), re-run the action per
//      alternative via a scripted plan, scoring each.
//   4. Pick the best-scoring variation. Commit it for real ONLY if it
//      beats the skip score by MCTS_ACTIVATION_GATE_THRESHOLD — otherwise
//      leave state untouched and return false.
//
// Returns true if the action was committed for real, false if skipped.
// Used by every Main-Phase sub-function so useless/net-negative
// activations (Cool Fridge to a random hero, artifact-with-nothing-to-do)
// get filtered out before firing.
const MCTS_ACTIVATION_GATE_THRESHOLD = 3;

// How many distinct branchable prompts to explore per recon. Each branchable
// prompt contributes its own set of variations (one per alternative pick),
// additively — NOT a Cartesian product, so cost scales linearly with branch
// count rather than exponentially. 2 covers most real spells (damage spell
// with two sequential target prompts, zonePick + cardGallery, etc.).
const MCTS_MAX_BRANCHES_PER_RECON = 2;
// Cap alternatives we score at any single branch. Prevents combinatorial
// blowup on "pick a hero from 6 enemies" style prompts.
const MCTS_MAX_ALTS_PER_BRANCH = 6;

// ─── Chain-source helpers (extracted from evaluateState) ──────────────
// Module-level so the MCTS variation builder can read chain-source data
// without instantiating a full evaluator. Both `cpuMeta.chainSource` and
// `cpuMeta.onDeathBenefit` are GENERIC card-level declarations — any
// future card that opts into the same shape gets the same treatment.
// See loyal-terrier.js for the prototype.

function _mctsCollectArmedChainSources(engine, ownerIdx) {
  const sources = [];
  for (const inst of engine.cardInstances) {
    if (inst.owner !== ownerIdx) continue;
    if (inst.zone !== 'support') continue;
    if (inst.faceDown) continue;
    const script = loadCardEffect(inst.name);
    const chain = script?.cpuMeta?.chainSource;
    if (!chain) continue;
    try {
      if (chain.isArmed && !chain.isArmed(engine, inst)) continue;
    } catch { continue; }
    sources.push({ inst, chain });
  }
  return sources;
}

function _mctsEffectiveOnDeathValue(engine, inst, sources) {
  if (!inst) return 0;
  const script = loadCardEffect(inst.name);
  const meta = script?.cpuMeta;
  let value = meta?.onDeathBenefit || 0;
  // Chain sources themselves don't compound chain bonuses on their own
  // death — killing the Terrier ends the window, killing the Shepherd
  // ends the revive. Mirror evaluateState's logic exactly.
  if (meta?.chainSource) return value;
  for (const { inst: srcInst, chain } of sources) {
    if (srcInst.id === inst.id) continue;
    try {
      if (chain.triggersOn && !chain.triggersOn(engine, inst, srcInst)) continue;
    } catch { continue; }
    value += chain.valuePerTrigger || 0;
  }
  return value;
}

// Turn a recorded prompt sequence into a list of plan variations. Each
// variation is `{ plan, label }`: plan is an array consumed by the target/
// generic override (null = heuristic placeholder, entries = scripted pick).
// We walk the record finding up to `maxBranches` branchable prompts with
// ≥2 alternatives each; for each, we emit one variation per non-heuristic
// alternative at that single position (other positions get null). Because
// variations are independent (one scripted slot at a time), explored cost
// is O(sum of alternatives), not O(product).
function mctsBuildVariationsFromRecord(record, { maxBranches = MCTS_MAX_BRANCHES_PER_RECON, maxAltsPerBranch = MCTS_MAX_ALTS_PER_BRANCH } = {}, engine = null) {
  const variations = [];
  let branchesFound = 0;
  for (let i = 0; i < record.length; i++) {
    if (branchesFound >= maxBranches) break;
    const r = record[i];
    if (r.wasScripted) continue;
    const isTarget = r.kind === 'target' && (r.validTargets || []).length >= 2;
    // >= 1 (not >= 2): for confirm prompts, the heuristic default is
    // decline (null) and the only meaningful alternative is confirm.
    // The emission loop below filters out alternatives matching the
    // heuristic pick, so a 1-alt case with a mismatching alt still
    // produces one variation; a matching 1-alt case produces none.
    const isGeneric = r.kind && r.kind.startsWith('generic:') && (r.alternatives || []).length >= 1;
    if (!isTarget && !isGeneric) continue;
    branchesFound++;
    const heuristicKey = JSON.stringify(r.picked);
    const emitted = [];
    if (isTarget) {
      // ── Single-identity alternatives: pick just one different target ──
      for (const alt of r.validTargets) {
        if (emitted.length >= maxAltsPerBranch) break;
        const entry = { kind: 'target', ids: [alt.id] };
        if (JSON.stringify(entry.ids) === heuristicKey) continue;
        const plan = new Array(i).fill(null);
        plan.push(entry);
        const label = `#${i} target=${alt.name || alt.id}` + (alt.owner != null ? ` (p${alt.owner})` : '');
        variations.push({ plan, label });
        emitted.push(alt);
      }
      // ── Subset-size variations (Pyroblast / Beer-style multi-select) ──
      // When the prompt allows >1 targets and the heuristic actually picked
      // multiple, also try SMALLER subset sizes of the same ordered picks.
      // Useful when per-target costs (Beer's 4g each) make fewer picks
      // score better, or when a Pollution-placing spell would clog zones.
      const heuristicIds = Array.isArray(r.picked) ? r.picked : [];
      const maxSel = r.maxSelect || 1;
      if (maxSel > 1 && heuristicIds.length > 1) {
        for (let k = heuristicIds.length - 1; k >= 1; k--) {
          const subsetIds = heuristicIds.slice(0, k);
          const entry = { kind: 'target', ids: subsetIds };
          if (JSON.stringify(subsetIds) === heuristicKey) continue;
          const plan = new Array(i).fill(null);
          plan.push(entry);
          variations.push({ plan, label: `#${i} top-${k} of ${heuristicIds.length}` });
        }
      }

      // ── "Kill own chain-fuel" variant (Loyal Terrier + Book of
      //     Doom-style synergies) ──────────────────────────────────────
      // For multi-select damage cards, also try TARGETING OWN CREATURES
      // that have positive `effectiveOnDeathValue` — i.e., own creatures
      // whose death would trigger an armed chain source on our side.
      // This is a GENERIC variant: any card that opts into
      // `cpuMeta.chainSource` (Loyal Terrier today, future cards
      // tomorrow) feeds it. The MCTS rollout plays out the deaths +
      // chain-trigger damage; the evaluator sees the result and the
      // arm wins if the payoff exceeds the cost. For non-chain decks
      // the chain fuel set is empty and this branch is skipped.
      const ownChainFuelEligible = engine && r.maxSelect > 1 && Array.isArray(r.validTargets);
      if (ownChainFuelEligible) {
        const cpuIdx = engine._cpuPlayerIdx;
        const ownChainSources = _mctsCollectArmedChainSources(engine, cpuIdx);
        if (ownChainSources.length > 0) {
          const ownChainFuel = [];
          for (const t of r.validTargets) {
            if (t.owner !== cpuIdx) continue;
            if (t.type !== 'equip' && t.type !== 'creature') continue;
            const inst = engine.cardInstances.find(c =>
              c.zone === 'support' && c.owner === t.owner
              && c.heroIdx === t.heroIdx && c.zoneSlot === t.slotIdx);
            if (!inst) continue;
            const v = _mctsEffectiveOnDeathValue(engine, inst, ownChainSources);
            if (v > 0) ownChainFuel.push({ target: t, value: v });
          }
          if (ownChainFuel.length >= 1) {
            ownChainFuel.sort((a, b) => b.value - a.value);
            const take = Math.min(r.maxSelect, ownChainFuel.length);
            const ids = ownChainFuel.slice(0, take).map(f => f.target.id);
            const idsKey = JSON.stringify(ids);
            if (idsKey !== heuristicKey) {
              const plan = new Array(i).fill(null);
              plan.push({ kind: 'target', ids });
              variations.push({ plan, label: `#${i} chain-fuel × ${take}` });
            }
          }
        }
      }
    } else {
      for (const alt of r.alternatives) {
        if (emitted.length >= maxAltsPerBranch) break;
        const entry = { kind: r.kind, value: alt.value };
        if (JSON.stringify(entry.value) === heuristicKey) continue;
        const plan = new Array(i).fill(null);
        plan.push(entry);
        variations.push({ plan, label: `#${i} ${alt.label}` });
        emitted.push(alt);
      }
    }
  }
  return variations;
}

async function mctsGatedActivation(engine, helpers, desc, actionFn, options = {}) {
  // `alwaysCommit` — run the recon + variations to pick the best target plan,
  // but commit regardless of whether the score beats skip. Intended for
  // pure-draw / tutor activations: the evaluator's gold-vs-hand-value model
  // systematically under-rewards "trade gold for a card" plays (a cost-10
  // artifact that draws a card loses ~20 gold-met value but gains at most
  // 25 hand value, so the delta often reads negative), and draws/tutors are
  // basically always tempo-positive for the caller. We still want the
  // variation loop so that, e.g., Magnetic Glove picks the best card from
  // the gallery instead of a random one.
  const alwaysCommit = !!options.alwaysCommit;
  // `evaluateThroughTurnEnd` — after the activation's actionFn, also
  // play out the REST of the CPU's turn (rolloutRestOfTurn) before
  // scoring. Required for "alive only this turn" effects like Golden
  // Ankh: without rest-of-turn projection, the immediate eval shows
  // a free +500 dead-bonus revert; with it, the End-Phase forceKill
  // fires and the eval correctly sees the hero is dead again — the
  // gate then commits IFF the revived hero actually generated value
  // during the simulated action phase (cards drawn, damage dealt,
  // …). Pricier than the default gate (full rest-of-turn rollout per
  // recon + per variation), so opt-in only.
  const evaluateThroughTurnEnd = !!options.evaluateThroughTurnEnd;

  // ── Nested-rollout / late-game short-circuit ──
  // Skip the gate when we're already inside an MCTS simulation — running
  // another full recon+variation per gated activation compounds cost
  // exponentially. The signal is `_inMctsSim`, not `_fastMode`; the
  // latter also fires for whole-game self-play, which would disable the
  // gate everywhere and never invoke the evaluator's synergy terms.
  // Also bypass past MCTS_LATE_GAME_TURN_THRESHOLD — long stalls OOM
  // before the gate's marginal filter value matters.
  if (engine._inMctsSim || (engine.gs?.turn || 0) >= MCTS_LATE_GAME_TURN_THRESHOLD) {
    try { await actionFn(); return true; }
    catch { return false; }
  }

  const cpuIdx = engine._cpuPlayerIdx;
  // ── Skip baseline ──
  // Default: immediate-state score with the activation NOT played.
  // When `evaluateThroughTurnEnd` is on, the recon below ALSO plays
  // out the rest of the turn before scoring — comparing that to an
  // immediate-state skip is unfair: the rest-of-turn's natural play
  // value (Action Phase plays, MP2 activations, end-of-turn ticks)
  // would inflate the post-play score regardless of whether the
  // activation itself contributed anything. To isolate the
  // activation's incremental value, also play the rest-of-turn for
  // the skip baseline. This is the fix for "Golden Ankh revives a
  // hero who's never used in the action phase but the rollout's
  // natural value still made the gate commit" — under the new
  // baseline, both rollouts produce the same natural value and the
  // delta correctly drops to ~0 (or negative once you subtract the
  // gold + hand-card cost).
  let skipScore;
  if (evaluateThroughTurnEnd) {
    const snapSkip = engine.snapshot();
    const prevInSimSkip = engine._inMctsSim;
    engine._inMctsSim = true;
    engine.enterFastMode();
    const prevSilentSkip = _cpuLogSilent;
    _cpuLogSilent = true;
    try {
      try { await rolloutRestOfTurn(engine, helpers); } catch {}
      skipScore = evaluateState(engine, cpuIdx);
    } finally {
      _cpuLogSilent = prevSilentSkip;
      engine.exitFastMode();
      engine.restore(snapSkip);
      engine._inMctsSim = prevInSimSkip;
    }
  } else {
    skipScore = evaluateState(engine, cpuIdx);
  }

  // ── Recon rollout ──
  const snap = engine.snapshot();
  const prevInSim = engine._inMctsSim;
  engine._inMctsSim = true;
  engine.enterFastMode();
  engine._mctsTargetRecord = [];
  // Save+restore the silence flag so a nested gate (this one being called
  // FROM inside an outer rollout's runMainPhase) doesn't unsilence the
  // outer scope. See mctsRunOneRollout for the same pattern.
  const prevSilent = _cpuLogSilent;
  _cpuLogSilent = true;
  let reconScore = -Infinity;
  let reconCompleted = false;
  try {
    await actionFn();
    if (evaluateThroughTurnEnd) {
      try { await rolloutRestOfTurn(engine, helpers); } catch {}
    }
    reconScore = evaluateState(engine, cpuIdx);
    reconCompleted = true;
  } catch (err) {
    // Action threw during recon — treat as unable-to-activate.
  }
  const record = engine._mctsTargetRecord || [];
  delete engine._mctsTargetRecord;
  _cpuLogSilent = prevSilent;
  engine.exitFastMode();
  engine.restore(snap);
  engine._inMctsSim = prevInSim;

  if (!reconCompleted) return false;

  const variations = [{ plan: null, label: '(heuristic)', score: reconScore }];

  // Enumerate variations across multiple branchable prompts (first
  // MCTS_MAX_BRANCHES_PER_RECON non-scripted prompts with ≥2 alternatives).
  // Pass `engine` so the chain-fuel variant (Loyal Terrier-style
  // self-kill synergy) gets enumerated when applicable.
  const extras = mctsBuildVariationsFromRecord(record, undefined, engine);
  for (const v of extras) variations.push({ plan: v.plan, label: v.label, score: -Infinity });

  if (extras.length > 0) {
    for (const variation of variations) {
      if (variation.plan === null) continue;
      const snap2 = engine.snapshot();
      const prevInSim2 = engine._inMctsSim;
      engine._inMctsSim = true;
      engine.enterFastMode();
      engine._mctsTargetPlan = [...variation.plan];
      const prevSilent2 = _cpuLogSilent;
      _cpuLogSilent = true;
      try {
        await actionFn();
        if (evaluateThroughTurnEnd) {
          try { await rolloutRestOfTurn(engine, helpers); } catch {}
        }
        variation.score = evaluateState(engine, cpuIdx);
      } catch {}
      delete engine._mctsTargetPlan;
      _cpuLogSilent = prevSilent2;
      engine.exitFastMode();
      engine.restore(snap2);
      engine._inMctsSim = prevInSim2;
    }
  }

  variations.sort((a, b) => b.score - a.score);
  const best = variations[0];
  // Threshold for COMMIT: usually MCTS_ACTIVATION_GATE_THRESHOLD = 3.
  // For `evaluateThroughTurnEnd` activations the bar is HIGHER —
  // these activations cost real resources (gold + hand card) for a
  // state mutation that only persists for the current turn (Golden
  // Ankh's revival re-dies at the End Phase forceKill). The eval's
  // gold/hand penalty for the cost is small (~20-50 score points)
  // and easily drowned out by rollout noise from the rest-of-turn
  // simulation, so the gate would otherwise green-light any tiny
  // positive delta and waste the card. The higher threshold demands
  // the temporary mutation produce SUBSTANTIAL value above the
  // natural rest-of-turn noise floor — i.e. the revived hero must
  // actually do something meaningful (Action, ability activation,
  // hero effect that gains gold / draws cards / deals damage), not
  // just exist briefly while the CPU passes.
  // Per-card override: `cpuMeta.activationGateThreshold` lets a card
  // tune this for itself (high value = strict gate, 0 = use default).
  // Card name is parsed from the gate `desc` — covers every caller in
  // _cpu.js (artifact, potion, free-ability, creature-effect, hero-
  // effect, equip-effect, area, permanent, ascend, additional X).
  // `additional` and `hero-effect h<idx>` are non-name patterns and
  // resolve to null (falling through to the default threshold).
  const cardScript = (() => {
    let m = /^(?:artifact|potion|spell|attack|free-ability|creature-effect|equip-effect|area|permanent|ascend) (.+)$/.exec(desc);
    if (!m) m = /^additional (?:Spell|Attack|Creature) (.+)$/.exec(desc);
    return m ? loadCardEffect(m[1]) : null;
  })();
  const overrideThreshold = cardScript?.cpuMeta?.activationGateThreshold;
  const threshold = (typeof overrideThreshold === 'number')
    ? overrideThreshold
    : (evaluateThroughTurnEnd ? 30 : MCTS_ACTIVATION_GATE_THRESHOLD);
  const beats = best.score > skipScore + threshold;
  const commit = beats || alwaysCommit;
  cpuLog(`      [gate] ${desc}: skip=${skipScore.toFixed(1)} best=${best.score.toFixed(1)} threshold=${threshold} via ${best.label} → ${commit ? (beats ? 'COMMIT' : 'FORCE-COMMIT') : 'SKIP'}`);

  if (!commit) return false;

  if (best.plan) engine._mctsTargetPlan = [...best.plan];
  try {
    await actionFn();
  } finally {
    delete engine._mctsTargetPlan;
  }
  return true;
}

// Evaluator-greedy candidate ranking, used as the in-rollout brain when
// `_rolloutBrain === 'evalGreedy'`. For each candidate:
//   snapshot → apply → evaluate → restore
// Then sort by post-apply score. This is the action-selection equivalent
// of "look one move ahead with the evaluator" — expensive (O(candidates)
// snapshots per decision), but lets recursive rollouts actually discover
// synergies (e.g. Heal triggering OHS for damage) which the pure-heuristic
// type/level sort misses. Must be called with `_inMctsSim` already true
// so nested MCTS short-circuits stay in place.
async function rankCandidatesEvalGreedy(engine, helpers, candidates) {
  const cpuIdx = engine._cpuPlayerIdx;
  const scored = [];
  for (const cand of candidates) {
    const snap = engine.snapshot();
    let score = -Infinity;
    try {
      const applied = await applyActionCandidate(engine, helpers, cand);
      if (applied) score = evaluateState(engine, cpuIdx);
    } catch {
      // Throwing candidates are scored -Infinity → sorted last.
    } finally {
      engine.restore(snap);
    }
    scored.push({ cand, score });
  }
  // Noise-tolerant Attack tiebreak — same rationale as the main MCTS
  // ranking sort. Single-rollout evals in nested simulations are even
  // noisier than the ~3-rollout outer loop, so the epsilon band is a
  // touch wider here. Within it, prefer the higher-atk caster.
  scored.sort((a, b) => {
    const diff = b.score - a.score;
    const epsilon = Math.max(5, Math.abs(b.score) * 0.015);
    if (Math.abs(diff) <= epsilon
        && a.cand.cardType === 'Attack'
        && b.cand.cardType === 'Attack') {
      const atkDiff = (b.cand.casterAtk || 0) - (a.cand.casterAtk || 0);
      if (atkDiff !== 0) return atkDiff;
    }
    return diff;
  });
  return scored.map(s => s.cand);
}

// Rank candidates by MCTS with target enumeration. For each candidate:
//   1. Recon rollout (heuristic targeting) — records all CPU target prompts.
//   2. Identify the first non-cancellable prompt with ≥2 valid targets.
//   3. Enumerate alternative targets as variations (plus the heuristic default).
//   4. Run N rollouts per variation; average the scores.
//   5. Return candidates sorted by best variation score, each decorated with
//      a scriptedTargetPlan that the real play should follow.
async function mctsRankCandidates(engine, helpers, candidates, rollouts = MCTS_ROLLOUTS_PER_CANDIDATE) {
  // ── Nested-MCTS / late-game short-circuit ──
  // Skip MCTS inside an outer rollout (nested simulations explode the cost
  // of a single rollout exponentially). The correct signal is `_inMctsSim`,
  // set only while simulating; `_fastMode` alone also fires for whole-game
  // self-play, which would disable MCTS everywhere and defeat the point.
  // Also skip past MCTS_LATE_GAME_TURN_THRESHOLD — at that point the match
  // is stalling and snapshot pressure is the actual risk.
  if (engine._inMctsSim || (engine.gs?.turn || 0) >= MCTS_LATE_GAME_TURN_THRESHOLD) {
    // Inside rollouts: rank candidates per the configured rollout brain.
    // evalGreedy: try each, score post-apply, pick highest (lets rollouts
    // discover synergies). Late-game bypass uses heuristic regardless —
    // it's explicitly the "stop thinking" cheap path.
    if (engine._inMctsSim && _rolloutBrain === 'evalGreedy') {
      return await rankCandidatesEvalGreedy(engine, helpers, candidates);
    }
    const sorted = [...candidates].sort((a, b) =>
      (b.level - a.level)
      || (b.typeScore - a.typeScore)
      || ((b.casterAtk || 0) - (a.casterAtk || 0)));
    return sorted;
  }

  const t0 = Date.now();
  let totalRollouts = 0;
  let budgetExceeded = false;

  // ── Recon phase: one rollout per candidate to enumerate variations ──
  // Seeds the heuristic arm of each candidate with the recon score; opens
  // additional "arms" per target-plan variation found in the recon trace.
  // Each arm = (candidate, variation). UCB1 allocates pulls across arms.
  const arms = []; // { candidate, variation:{plan,label}, scoreSum, visits }
  for (const candidate of candidates) {
    if ((Date.now() - t0) >= MCTS_RANK_BUDGET_MS) {
      budgetExceeded = true;
      break;
    }
    const recon = await mctsRunOneRollout(engine, helpers, candidate, { record: true });
    totalRollouts++;

    // Heuristic arm (seed score = recon's score if the rollout completed).
    arms.push({
      candidate,
      variation: { plan: null, label: '(heuristic)' },
      scoreSum: recon.completed ? recon.score : 0,
      visits: recon.completed ? 1 : 0,
    });

    // Target-plan variation arms (unseeded — will be pulled at least once
    // during the min-pulls phase below). Pass `engine` so the chain-fuel
    // variant gets enumerated for multi-select damage cards with own
    // chain-source synergies on the board.
    const extras = mctsBuildVariationsFromRecord(recon.record, undefined, engine);
    for (const v of extras) {
      arms.push({
        candidate,
        variation: { plan: v.plan, label: v.label },
        scoreSum: 0,
        visits: 0,
      });
    }
  }

  // ── Ensure-min-pulls phase: pull each zero-visit arm once ──
  for (const arm of arms) {
    if (arm.visits > 0) continue;
    if ((Date.now() - t0) >= MCTS_RANK_BUDGET_MS) {
      budgetExceeded = true;
      break;
    }
    const r = await mctsRunOneRollout(engine, helpers, arm.candidate, { plan: arm.variation.plan });
    totalRollouts++;
    if (r.completed) {
      arm.scoreSum += r.score;
      arm.visits++;
    }
  }

  // ── UCB1 phase: pull the highest-UCB arm, repeat until budget ──
  // UCB1(arm) = avg(arm) + C * sqrt(ln(N) / visits(arm))
  // where N is the sum of visits across all arms. Unvisited arms get
  // infinite UCB (they'd have been pulled in the min-pulls phase — this
  // is defensive).
  while (!budgetExceeded && totalRollouts < MCTS_UCB1_TOTAL_PULLS) {
    if ((Date.now() - t0) >= MCTS_RANK_BUDGET_MS) {
      budgetExceeded = true;
      break;
    }
    const visitedArms = arms.filter(a => a.visits > 0);
    if (visitedArms.length === 0) break;
    const totalVisits = visitedArms.reduce((s, a) => s + a.visits, 0);
    const lnN = Math.log(totalVisits);
    let bestArm = null, bestUCB = -Infinity;
    for (const arm of arms) {
      const ucb = arm.visits === 0
        ? Infinity
        : (arm.scoreSum / arm.visits) + MCTS_UCB1_EXPLORE_C * Math.sqrt(lnN / arm.visits);
      if (ucb > bestUCB) { bestUCB = ucb; bestArm = arm; }
    }
    if (!bestArm) break;
    const r = await mctsRunOneRollout(engine, helpers, bestArm.candidate, { plan: bestArm.variation.plan });
    totalRollouts++;
    if (r.completed) {
      bestArm.scoreSum += r.score;
      bestArm.visits++;
    } else {
      // Rollout failed — give up on further UCB exploration to avoid loops.
      break;
    }
  }

  // ── Adaptive extension phase ─────────────────────────────────────────
  // When the regular UCB1 budget ended with the top arms clustered
  // inside the noise band (avg gap small enough that variance is
  // deciding the winner instead of real differences), spend remaining
  // wall-clock on ONLY those clustered arms. Each extra pull goes to
  // the cluster arm with the fewest visits — balances precision
  // across the cluster, drives standard error down fastest where it
  // matters, and re-checks the cluster after every pull (arms that
  // drift outside the band are dropped). Stops as soon as one arm
  // wins outright OR the cluster genuinely settles. The deterministic
  // tiebreaker downstream (casterAtk for Attacks, etc.) handles the
  // truly-equal case without spending more pulls on it.
  let extensionPulls = 0;
  while (!budgetExceeded && extensionPulls < MCTS_EXT_PULLS_MAX) {
    if ((Date.now() - t0) >= MCTS_RANK_BUDGET_MS) {
      budgetExceeded = true;
      break;
    }
    const visited = arms.filter(a => a.visits > 0);
    if (visited.length < 2) break;
    let topAvg = -Infinity;
    for (const a of visited) {
      const avg = a.scoreSum / a.visits;
      if (avg > topAvg) topAvg = avg;
    }
    const epsilon = Math.max(MCTS_EXT_EPSILON_ABS, Math.abs(topAvg) * MCTS_EXT_EPSILON_PCT);
    const cluster = visited.filter(a => (a.scoreSum / a.visits) >= topAvg - epsilon);
    if (cluster.length < 2) break; // only one arm in the cluster — done
    // Pick the cluster member with the fewest visits to drive its SE
    // down fastest. Ties on visits → first one (deterministic).
    cluster.sort((a, b) => a.visits - b.visits);
    const target = cluster[0];
    const r = await mctsRunOneRollout(engine, helpers, target.candidate, { plan: target.variation.plan });
    totalRollouts++;
    extensionPulls++;
    if (r.completed) {
      target.scoreSum += r.score;
      target.visits++;
    } else {
      break; // rollout failed — bail before the loop tightens
    }
  }
  if (extensionPulls > 0) {
    cpuLog(`  [MCTS/EXT] +${extensionPulls} cluster-resolution pulls`);
  }

  // ── Build ranked results from arm stats ──
  const results = arms.map(arm => ({
    candidate: arm.candidate,
    variation: arm.variation,
    avg: arm.visits > 0 ? arm.scoreSum / arm.visits : -Infinity,
    visits: arm.visits,
    scored: arm.visits > 0,
  }));

  // If no arm ever got scored, fall back to heuristic sort so the turn
  // doesn't crash.
  if (results.every(r => !r.scored)) {
    const sorted = [...candidates].sort((a, b) =>
      (b.level - a.level)
      || (b.typeScore - a.typeScore)
      || ((b.casterAtk || 0) - (a.casterAtk || 0)));
    cpuLog(`  [MCTS] budget exhausted with 0 scored arms → heuristic fallback`);
    return sorted;
  }

  // Scored arms first, by avg desc. Unscored drop to the tail.
  // Within an epsilon band — accounting for the inherent noise of running
  // ~3 rollouts per candidate — Attack candidates tiebreak by the
  // caster's atk stat. Without this, a same-card-different-caster pair
  // whose avgs land within noise of each other would resolve via stable
  // sort to the lower-atk hero whenever they happened to be emitted
  // first. The emission-side sort (heroPool sorted by atk DESC) plus
  // this ranking-side tiebreak together ensure raw-atk ties go to the
  // bigger stick. MCTS still wins outright when the avg gap exceeds
  // noise — a real synergy on a low-atk hero still beats raw damage.
  results.sort((a, b) => {
    if (a.scored !== b.scored) return a.scored ? -1 : 1;
    const avgDiff = b.avg - a.avg;
    const epsilon = Math.max(3, Math.abs(b.avg) * 0.01);
    if (Math.abs(avgDiff) <= epsilon
        && a.candidate.cardType === 'Attack'
        && b.candidate.cardType === 'Attack') {
      const atkDiff = (b.candidate.casterAtk || 0) - (a.candidate.casterAtk || 0);
      if (atkDiff !== 0) return atkDiff;
    }
    return avgDiff;
  });

  const elapsed = Date.now() - t0;
  cpuLog(`  [MCTS/UCB1] ${candidates.length} cand → ${arms.length} arms, ${totalRollouts} rollouts in ${elapsed}ms${budgetExceeded ? ' [BUDGET]' : ''}:`);
  for (const r of results) {
    const vStr = r.visits > 0 ? `v=${r.visits}` : '(unscored)';
    cpuLog(`    ${r.avg.toFixed(1).padStart(8)} ${vStr.padStart(6)} — ${r.candidate.cardType} "${r.candidate.cardName}" (lvl ${r.candidate.level}) hero=${r.candidate.heroIdx} ${r.variation.label}`);
  }

  // De-dupe by candidate identity — keep the best-scoring variation per
  // candidate. Sorted-by-avg means first occurrence wins.
  const seen = new Set();
  const out = [];
  for (const r of results) {
    if (seen.has(r.candidate)) continue;
    seen.add(r.candidate);
    out.push({ ...r.candidate, scriptedTargetPlan: r.variation.plan });
  }
  // Any candidate not touched at all (budget cut off recon loop) → append
  // in heuristic order so the turn still has fallback plays.
  const unseen = candidates.filter(c => !seen.has(c));
  unseen.sort((a, b) =>
    (b.level - a.level)
    || (b.typeScore - a.typeScore)
    || ((b.casterAtk || 0) - (a.casterAtk || 0)));
  for (const c of unseen) out.push({ ...c, scriptedTargetPlan: null });
  return out;
}

// ─── Turbo mode runner ─────────────────────────────────────────────────
// Runs a full CPU turn (or any async fn that drives the engine) in fast
// mode — all pacing delays, broadcasts, logs, and socket emissions are
// silenced. Exposes timing so MCTS can budget its simulations.
//
// Callers typically snapshot engine state before, run N simulations via
// this helper, then restore and pick the best action. Snapshot/restore is
// the MCTS layer's responsibility — this helper only gates perf.
async function runTurbo(engine, fn) {
  const t0 = Date.now();
  engine.enterFastMode();
  try {
    return await fn(engine);
  } finally {
    engine.exitFastMode();
    const elapsed = Date.now() - t0;
    if (CPU_DEBUG) console.log(`[CPU turbo] elapsed=${elapsed}ms`);
  }
}

// ═══════════════════════════════════════════
//  SMART MULLIGAN
//  Invoked once at game start to decide whether the CPU's opening hand is
//  worth keeping or should be shuffled back and redrawn. Conservative: we
//  only mulligan when the hand has almost nothing actionable in the first
//  couple of turns. The 5-card shuffle-and-redraw has a real variance cost
//  (you might draw worse), so bias toward keeping.
// ═══════════════════════════════════════════

/**
 * Decide whether the CPU player `pi` should mulligan its starting hand.
 * A card counts as "playable in the opening" if:
 *   • Ability — always (will attach to some hero)
 *   • Potion — always (no resource gate)
 *   • Artifact — cost fits current gold
 *   • Creature / Spell / Attack — at least one hero meets its level req
 * Mulligan when fewer than max(3, 40% of handSize) cards qualify.
 */
function shouldMulliganStartingHand(engine, pi) {
  const gs = engine.gs;
  const ps = gs?.players?.[pi];
  if (!ps?.hand?.length) return false;
  const cardDB = engine._getCardDB();
  const gold = ps.gold || 0;
  let playable = 0;
  for (const cardName of ps.hand) {
    const cd = cardDB[cardName];
    if (!cd) continue;
    switch (cd.cardType) {
      case 'Ability':
      case 'Potion':
        playable++;
        break;
      case 'Artifact': {
        const cost = cd.cost || 0;
        if (cost <= gold + 4) playable++; // allow room for 1 turn of gold gain
        break;
      }
      case 'Creature':
      case 'Spell':
      case 'Attack': {
        const eligible = listEligibleHeroesForActionCard(engine, pi, cd);
        if (eligible.length > 0) playable++;
        break;
      }
      default:
        // Unknown types pessimistically don't count.
        break;
    }
  }
  const threshold = Math.max(3, Math.ceil(ps.hand.length * 0.4));
  const mull = playable < threshold;
  cpuLog(`  [mulligan] hand=${ps.hand.length} playable=${playable} threshold=${threshold} → ${mull ? 'MULLIGAN' : 'KEEP'}`);
  return mull;
}

/**
 * MCTS-style scoring for a card-gallery / option picker that the engine
 * exposes as a `cpuResponse` prompt. Caller passes:
 *   • `engine`    — the live engine (snapshot/restore + simulation host)
 *   • `options`   — array of { id?, ...payload }; the chosen entry is
 *                   returned verbatim. Must be a non-empty list.
 *   • `applyFn`   — async (engine, option) => boolean. The caller mutates
 *                   the engine to reflect choosing this option (e.g.
 *                   placing a creature, attaching an ability). Throw or
 *                   return false to score this option as -Infinity.
 *
 * For each option: snapshot → applyFn → rolloutRestOfTurn → evaluateState
 * → restore. The option with the highest evaluator score wins. Behaviour
 * matches the existing `rankCandidatesEvalGreedy` flow but is exposed for
 * card-script use. Recursive calls (engine already inside `_inMctsSim`)
 * fall back to the option list as-is so nested rollouts don't explode
 * exponentially — the caller should treat the first entry as the cheap
 * default in that case.
 *
 * The picker is generic: works for any cardGallery / optionPicker that
 * a card script intercepts in its `cpuResponse`. Barker, future picker
 * cards, and any "choose one" prompt with non-trivial downstream value
 * differences should route through here rather than keying off card
 * level / name heuristics.
 */
async function mctsPickFromOptions(engine, options, applyFn, opts = {}) {
  if (!Array.isArray(options) || options.length === 0) return null;
  if (options.length === 1) return options[0];
  // Inside an outer rollout — don't recurse. Return the first option;
  // the caller's heuristic ordering (if any) acts as the cheap default.
  if (engine._inMctsSim) return options[0];

  const cpuIdx = engine._cpuPlayerIdx;
  const prevSilent = _cpuLogSilent;
  let best = options[0];
  let bestScore = -Infinity;
  // Per-call horizon override. For one-shot decisions like Barker's
  // turn-1 placement (fires once per game), callers can pay the cost
  // of a deeper rollout so latent-value Creatures (e.g. Goff's Burn-
  // doubling at end of subsequent turns) get more turns of simulated
  // play to actually fire and show their value, instead of losing to
  // immediate-action Creatures (Harpyformers) that score deterministic
  // free-summon value within the default 2-turn window.
  const prevHorizon = _rolloutHorizon;
  const horizonOverride = Number.isInteger(opts.horizon) ? Math.max(0, opts.horizon) : null;
  if (horizonOverride !== null) _rolloutHorizon = horizonOverride;
  engine._inMctsSim = true;
  engine.enterFastMode();
  _cpuLogSilent = true;
  try {
    for (const opt of options) {
      const snap = engine.snapshot();
      let score = -Infinity;
      try {
        const ok = await applyFn(engine, opt);
        if (ok !== false) {
          // Run the rest of the turn so timed buffs / cleanups score
          // realistically. Helpers come from the engine's CPU brain
          // installation (runMainPhase / advancePhase).
          try {
            const helpers = engine._cpuHelpers || null;
            if (helpers) await rolloutRestOfTurn(engine, helpers);
          } catch { /* swallow — partial state still scores */ }
          score = evaluateState(engine, cpuIdx);
        }
      } catch { /* score stays -Infinity */ }
      finally { engine.restore(snap); }
      if (score > bestScore) { bestScore = score; best = opt; }
    }
  } finally {
    engine._inMctsSim = false;
    engine.exitFastMode();
    _cpuLogSilent = prevSilent;
    if (horizonOverride !== null) _rolloutHorizon = prevHorizon;
  }
  return best;
}

module.exports = { runCpuTurn, installCpuBrain, runTurbo, shouldMulliganStartingHand, setCpuVerbose, getCpuVerbose, setCpuTranscribeFn, setRolloutHorizon, getRolloutHorizon, setRolloutBrain, getRolloutBrain, mctsValueGoldVsDraw, mctsPickFromOptions };
