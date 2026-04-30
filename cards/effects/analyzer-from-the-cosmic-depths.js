// ═══════════════════════════════════════════
//  CARD EFFECT: "Analyzer from the Cosmic Depths"
//  Creature (Summoning Magic Lv1, Normal, 50 HP)
//  Cosmic Depths archetype.
//
//  PASSIVE: Whenever your opponent draws or adds
//  cards to their hand via an effect, place 1
//  Change Counter onto this Creature. The
//  resource-phase auto-draw is excluded — see
//  the `_isResourceDraw` flag plumbing in
//  _engine.js.
//
//  ACTIVE 1 (once/turn): Move any number of
//  Change Counters from this Creature to ANOTHER
//  card on the board. Either side; heroes or
//  creatures.
//
//  ACTIVE 2 (once/turn): Remove up to 6 Change
//  Counters from this Creature to place 1 Invader
//  Token into an opponent free Support Zone for
//  every 2 counters removed (so 2/4/6 counters →
//  1/2/3 Tokens).
//
//  Both actives have INDEPENDENT once-per-turn
//  slots — the engine's per-instance creature-
//  effect HOPT is bypassed via
//  `_skipCreatureEffectHopt`, and we track each
//  ability's HOPT under its own gs.hoptUsed key.
// ═══════════════════════════════════════════

const {
  addChangeCounters, removeChangeCounters, moveChangeCounters,
  getChangeCounters, allBoardTargets, targetToPromptEntry,
} = require('./_cosmic-shared');

const CARD_NAME = 'Analyzer from the Cosmic Depths';
const INVADER_TOKEN = 'Invader Token';
const HOPT_MOVE  = 'analyzer-move';
const HOPT_SPAWN = 'analyzer-spawn';

function hoptUsed(gs, key, instId) {
  return gs.hoptUsed?.[`${key}:${instId}`] === gs.turn;
}
function stampHopt(gs, key, instId) {
  if (!gs.hoptUsed) gs.hoptUsed = {};
  gs.hoptUsed[`${key}:${instId}`] = gs.turn;
}

function oppFreeSupportSlots(engine, oppIdx) {
  const ops = engine.gs.players[oppIdx];
  if (!ops) return [];
  const out = [];
  for (let hi = 0; hi < (ops.heroes || []).length; hi++) {
    const h = ops.heroes[hi];
    // "Place" semantics — any opp Hero's Support Zone qualifies
    // (including dead / Frozen / Stunned / negated Heroes). Only an
    // empty Hero slot (no Hero card) is skipped.
    if (!h?.name) continue;
    const zones = ops.supportZones?.[hi] || [[], [], []];
    for (let zi = 0; zi < 3; zi++) {
      if ((zones[zi] || []).length === 0) {
        out.push({ heroIdx: hi, slotIdx: zi });
      }
    }
  }
  return out;
}

// ── ACTIVE 1: Move counters ────────────────────────────────────────
async function runMove(engine, inst, ctx) {
  const gs = engine.gs;
  const pi = inst.controller ?? inst.owner;
  const have = getChangeCounters(inst);
  if (have <= 0) return false;

  // How many to move?
  const countOptions = [];
  for (let n = 1; n <= have; n++) {
    countOptions.push({ id: String(n), label: `${n} counter${n === 1 ? '' : 's'}` });
  }
  const countPick = await engine.promptGeneric(pi, {
    type: 'optionPicker',
    title: CARD_NAME,
    description: `Move how many Change Counters from ${CARD_NAME}? (You have ${have}.)`,
    options: countOptions,
    cancellable: true,
  });
  if (!countPick || countPick.cancelled) return false;
  const n = parseInt(countPick.optionId, 10);
  if (!Number.isInteger(n) || n < 1 || n > have) return false;

  // Pick destination — any board card except this Analyzer.
  const allTargets = allBoardTargets(engine).filter(t => !(t.kind === 'creature' && t.ref?.id === inst.id));
  if (allTargets.length === 0) return false;
  const targetEntries = allTargets.map(targetToPromptEntry);

  const picked = await engine.promptEffectTarget(pi, targetEntries, {
    title: CARD_NAME,
    description: `Move ${n} Change Counter${n === 1 ? '' : 's'} onto which card?`,
    confirmLabel: '🌌 Move!',
    confirmClass: 'btn-info',
    cancellable: true,
    exclusiveTypes: false,
    maxPerType: { hero: 1, equip: 1 },
  });
  if (!picked || picked.length === 0) return false;
  const tgt = allTargets.find(t => targetToPromptEntry(t).id === picked[0]);
  if (!tgt) return false;

  moveChangeCounters(engine, inst, tgt.ref, n);
  stampHopt(gs, HOPT_MOVE, inst.id);
  ctx._skipCreatureEffectHopt = true; // engine HOPT bypassed; script-level wins
  return true;
}

// ── ACTIVE 2: Remove ≤6 counters → place Invader Tokens ──────────────
async function runSpawn(engine, inst, ctx) {
  const gs = engine.gs;
  const pi = inst.controller ?? inst.owner;
  const oi = pi === 0 ? 1 : 0;
  const have = getChangeCounters(inst);
  if (have < 2) return false; // Need at least 2 counters for 1 Token

  // Build option list — only counts that produce a valid Token output.
  // Capped by both 6-counter ceiling AND by current opp free slots.
  const freeSlots = oppFreeSupportSlots(engine, oi);
  if (freeSlots.length === 0) return false;

  const maxByCounters = Math.min(have, 6);
  const maxByTokens = Math.min(Math.floor(maxByCounters / 2), freeSlots.length);
  if (maxByTokens < 1) return false;

  const opts = [];
  for (let tokens = 1; tokens <= maxByTokens; tokens++) {
    const cost = tokens * 2;
    opts.push({
      id: String(tokens),
      label: `Spawn ${tokens} Invader Token${tokens === 1 ? '' : 's'} (cost ${cost})`,
    });
  }
  const pick = await engine.promptGeneric(pi, {
    type: 'optionPicker',
    title: CARD_NAME,
    description: `Remove 2 Counters per Invader Token (max 6 / 3 Tokens). Opp free slots: ${freeSlots.length}.`,
    options: opts,
    cancellable: true,
  });
  if (!pick || pick.cancelled) return false;
  const tokens = parseInt(pick.optionId, 10);
  if (!Number.isInteger(tokens) || tokens < 1 || tokens > maxByTokens) return false;

  // Pay the cost.
  const cost = tokens * 2;
  removeChangeCounters(engine, inst, cost);

  // Place Tokens into opp free slots — pick which ones if more options
  // than tokens. Simple sequential prompt per token.
  for (let i = 0; i < tokens; i++) {
    const slots = oppFreeSupportSlots(engine, oi);
    if (slots.length === 0) break;

    let chosen;
    if (slots.length === 1) {
      chosen = slots[0];
    } else {
      // Use promptZonePick on a synthetic activator-context. The picker
      // expects `zones` with {heroIdx, slotIdx, label, owner?}. `owner`
      // is critical here: Tokens land on OPP'S side, so we must tell
      // the client to highlight opp's free zones, not ours. Without it
      // the client falls back to `myIdx` and lets the player click
      // their own zones — visually wrong, and the placement still
      // resolves on opp's side from the matching index, so the user
      // sees Tokens "teleport" to opp's identical slot.
      const ops = gs.players[oi];
      const zones = slots.map(s => ({
        heroIdx: s.heroIdx, slotIdx: s.slotIdx, owner: oi,
        label: `${ops.heroes?.[s.heroIdx]?.name || 'Hero'} — Slot ${s.slotIdx + 1}`,
      }));
      const promptCtx = engine._createContext(inst, {});
      const zp = await promptCtx.promptZonePick(zones, {
        title: CARD_NAME,
        description: `Place Invader Token #${i + 1} into which opponent zone?`,
        cancellable: false,
      });
      if (!zp) break;
      chosen = { heroIdx: zp.heroIdx, slotIdx: zp.slotIdx };
    }

    // Silent place — Invader Token has its own onTurnEnd; no place-side
    // hooks needed. Owner is the OPP since the Token sits in their zone.
    const placeRes = engine.summonCreature(INVADER_TOKEN, oi, chosen.heroIdx, chosen.slotIdx, {
      source: CARD_NAME,
    });
    if (!placeRes) continue;
    engine._broadcastEvent('play_zone_animation', {
      type: 'cosmic_token_drop',
      owner: oi, heroIdx: chosen.heroIdx, zoneSlot: chosen.slotIdx,
    });
    await engine._delay(220);
  }

  engine.log('analyzer_spawn', {
    player: gs.players[pi]?.username, tokens, cost,
  });
  stampHopt(gs, HOPT_SPAWN, inst.id);
  ctx._skipCreatureEffectHopt = true;
  return true;
}

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,

  // Gerrymander redirect (sub-ability picker only) — pick `move` over
  // `spawn`. The Spawn path puts harmful Invader Tokens on our side;
  // forcing Move keeps the counters defensive instead.
  cpuGerrymanderResponse(/* engine, gerryOwnerPi, promptData */) {
    return { optionId: 'move' };
  },

  // CPU eval declaration — Analyzer accumulates Change Counters and
  // can spend them (move them onto allies, or remove pairs to spawn
  // Invader Tokens on opp's side). Counts as a counter-consumer so
  // the eval values its side's counters at the higher rate.
  cpuMeta: {
    counterConsumer: true,
  },

  // Engine HOPT is bypassed inside each ability's resolve via
  // _skipCreatureEffectHopt. We expose creatureEffect=true so the engine
  // surfaces the activate-button, but the actual gating below.
  canActivateCreatureEffect(ctx) {
    const inst = ctx.card;
    const engine = ctx._engine;
    const gs = engine.gs;
    const have = getChangeCounters(inst);

    const moveAvail = !hoptUsed(gs, HOPT_MOVE, inst.id) && have > 0
      && allBoardTargets(engine).some(t => !(t.kind === 'creature' && t.ref?.id === inst.id));

    const pi = inst.controller ?? inst.owner;
    const oi = pi === 0 ? 1 : 0;
    const spawnAvail = !hoptUsed(gs, HOPT_SPAWN, inst.id)
      && have >= 2 && oppFreeSupportSlots(engine, oi).length > 0;

    return moveAvail || spawnAvail;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const inst = ctx.card;
    const pi = inst.controller ?? inst.owner;
    const oi = pi === 0 ? 1 : 0;
    const have = getChangeCounters(inst);

    const moveAvail = !hoptUsed(gs, HOPT_MOVE, inst.id) && have > 0
      && allBoardTargets(engine).some(t => !(t.kind === 'creature' && t.ref?.id === inst.id));
    const spawnAvail = !hoptUsed(gs, HOPT_SPAWN, inst.id)
      && have >= 2 && oppFreeSupportSlots(engine, oi).length > 0;

    if (!moveAvail && !spawnAvail) return false;

    // If exactly one is available, skip the picker and go straight to it.
    let pickedAbility;
    if (moveAvail && !spawnAvail) pickedAbility = 'move';
    else if (spawnAvail && !moveAvail) pickedAbility = 'spawn';
    else {
      const opts = [];
      opts.push({ id: 'move',  label: 'Move Change Counters to another card' });
      opts.push({ id: 'spawn', label: 'Spend Counters → Invader Tokens (opp side)' });
      const pick = await engine.promptGeneric(pi, {
        type: 'optionPicker',
        title: CARD_NAME,
        description: 'Choose which once-per-turn ability to activate.',
        options: opts,
        cancellable: true,
        // Sub-ability picker — Move vs Spawn are distinct effects.
        // The count pickers below are parameters, NOT distinct
        // effects, so they intentionally lack this flag.
        gerrymanderEligible: true,
      });
      if (!pick || pick.cancelled) return false;
      pickedAbility = pick.optionId;
    }

    if (pickedAbility === 'move')  return await runMove(engine, inst, ctx);
    if (pickedAbility === 'spawn') return await runSpawn(engine, inst, ctx);
    return false;
  },

  // ── PASSIVE TRIGGER ─────────────────────────────────────────────
  //
  // 1 Change Counter per draw / hand-add EFFECT — NOT per card. Listening
  // to `beforeDrawBatch` fires once per `actionDrawCards` /
  // `actionDrawFromPotionDeck` invocation regardless of how many cards
  // come out, so Elixir of Quickness (3 draws) yields 1 counter, matching
  // the user-facing rule. Resource-phase auto-draws don't fire this hook
  // (the engine gates the runHooks call on phase), so no extra filter is
  // needed. `onCardAddedToHand` / `onCardAddedFromDiscardToHand` fire
  // once per card-add call — almost every search / recovery effect adds
  // exactly one card per call (Magnetic Potion, Hell Fox, Bamboo Staff,
  // etc.), so per-call ≈ per-effect for those paths.
  hooks: {
    beforeDrawBatch: (ctx) => {
      if (ctx.playerIdx === ctx.cardOwner) return;
      if ((ctx.amount || 0) <= 0) return;
      addChangeCounters(ctx._engine, ctx.card, 1);
    },
    onCardAddedToHand: (ctx) => {
      if (ctx.playerIdx === ctx.cardOwner) return;
      addChangeCounters(ctx._engine, ctx.card, 1);
    },
    onCardAddedFromDiscardToHand: (ctx) => {
      if (ctx.playerIdx === ctx.cardOwner) return;
      addChangeCounters(ctx._engine, ctx.card, 1);
    },
  },
};
