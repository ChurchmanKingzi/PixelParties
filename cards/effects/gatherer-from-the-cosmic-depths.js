// ═══════════════════════════════════════════
//  CARD EFFECT: "Gatherer from the Cosmic Depths"
//  Creature (Summoning Magic Lv2, Normal, 100 HP)
//  Cosmic Depths archetype.
//
//  PASSIVE: Whenever your opponent draws or adds
//  cards to their hand via an effect, place 1
//  Change Counter onto this Creature. Resource-
//  phase auto-draws are excluded.
//
//  ACTIVE 1 (once/turn): Move any number of
//  Change Counters from a card YOU CONTROL onto
//  a "Cosmic Depths" Creature you control. Source
//  may be ANY card you control (hero or creature)
//  with counters; destination MUST be a CD
//  Creature you control.
//
//  ACTIVE 2 (once/turn): Remove up to 3 Change
//  Counters from this Creature to draw that many
//  cards.
//
//  Both actives have INDEPENDENT once-per-turn
//  slots — same `_skipCreatureEffectHopt` pattern
//  as Analyzer.
// ═══════════════════════════════════════════

const {
  addChangeCounters, removeChangeCounters, moveChangeCounters,
  getChangeCounters, changeCounterCardsOnSide, ownCosmicCreatures,
  targetToPromptEntry,
} = require('./_cosmic-shared');

const { drawBlockedFor } = require('./_draw-block-shared');

const CARD_NAME = 'Gatherer from the Cosmic Depths';
const HOPT_MOVE = 'gatherer-move';
const HOPT_DRAW = 'gatherer-draw';
const MAX_DRAW = 3;

function hoptUsed(gs, key, instId) {
  return gs.hoptUsed?.[`${key}:${instId}`] === gs.turn;
}
function stampHopt(gs, key, instId) {
  if (!gs.hoptUsed) gs.hoptUsed = {};
  gs.hoptUsed[`${key}:${instId}`] = gs.turn;
}

// ── ACTIVE 1: Move counters between own cards (sink: CD Creature) ──
async function runMove(engine, inst, ctx) {
  const gs = engine.gs;
  const pi = inst.controller ?? inst.owner;

  const sources = changeCounterCardsOnSide(engine, pi);
  if (sources.length === 0) return false;

  const destCreatures = ownCosmicCreatures(engine, pi);
  if (destCreatures.length === 0) return false;

  // Step 1: pick the source card.
  const sourceEntries = sources.map(targetToPromptEntry);
  // Darion: Equips eines Stapels teilen die Ziel-ID — die Rueckfrage „welches Equip?" soll nur die Karten MIT Change Counters anbieten.
  for (const e of sourceEntries) {
    if (e.type === 'equip' && e.cardInstance) e._erlaubteInstanzen = sourceEntries.filter(x => x.id === e.id && x.cardInstance).map(x => x.cardInstance.id);
  }
  const srcPicked = await engine.promptEffectTarget(pi, sourceEntries, {
    maxTotal: 1,   // Einfachauswahl: ein Klick TAUSCHT das Ziel
    title: CARD_NAME,
    description: 'Move Change Counters FROM which of your cards?',
    confirmLabel: '🌌 Source',
    confirmClass: 'btn-info',
    cancellable: true,
    exclusiveTypes: false,
    maxPerType: { hero: 1, equip: 1 },
  });
  if (!srcPicked || srcPicked.length === 0) return false;
  const src = sources.find(s => targetToPromptEntry(s).id === srcPicked[0]);
  if (!src) return false;
  // Darion: bei einem Equip-Stapel liegt die gewaehlte Karte auf dem Eintrag der Zielliste (`src` waere immer die erste Karte des Stapels).
  const srcEintrag = sourceEntries.find(e => e.id === srcPicked[0]);
  const srcRef = (srcEintrag && srcEintrag.type === 'equip' && srcEintrag.cardInstance) ? srcEintrag.cardInstance : src.ref;
  const have = getChangeCounters(srcRef);
  if (have <= 0) return false;

  // Step 2: pick how many.
  const countOpts = [];
  for (let n = 1; n <= have; n++) {
    countOpts.push({ id: String(n), label: `${n} counter${n === 1 ? '' : 's'}` });
  }
  const countPick = await engine.promptGeneric(pi, {
    type: 'optionPicker',
    title: CARD_NAME,
    description: `Move how many counters from ${srcRef.name}? (Source has ${have}.)`,
    options: countOpts,
    cancellable: true,
  });
  if (!countPick || countPick.cancelled) return false;
  const n = parseInt(countPick.optionId, 10);
  if (!Number.isInteger(n) || n < 1 || n > have) return false;

  // Step 3: pick destination CD Creature.
  const destEntries = destCreatures.map(c => ({
    id: `equip-${c.owner}-${c.heroIdx}-${c.zoneSlot}`,
    type: 'equip', owner: c.owner, heroIdx: c.heroIdx, slotIdx: c.zoneSlot,
    cardName: c.name, cardInstance: c,
  }));
  const dstPicked = await engine.promptEffectTarget(pi, destEntries, {
    maxTotal: 1,   // Einfachauswahl: ein Klick TAUSCHT das Ziel
    title: CARD_NAME,
    description: `Move ${n} counter${n === 1 ? '' : 's'} ONTO which "Cosmic Depths" Creature?`,
    confirmLabel: '🌌 Destination',
    confirmClass: 'btn-info',
    cancellable: true,
    exclusiveTypes: true,
    maxPerType: { equip: 1 },
  });
  if (!dstPicked || dstPicked.length === 0) return false;
  const dst = destCreatures.find(c => `equip-${c.owner}-${c.heroIdx}-${c.zoneSlot}` === dstPicked[0]);
  if (!dst) return false;

  moveChangeCounters(engine, srcRef, dst, n);
  if (!ctx._borrowedUse) stampHopt(gs, HOPT_MOVE, inst.id);   // W13 (Al, Rueckfrage 9): geliehene Verwendung verbraucht den Stempel NICHT
  ctx._skipCreatureEffectHopt = true;
  return true;
}

// ── ACTIVE 2: Remove ≤3 counters → draw N ─────────────────────────
async function runDraw(engine, inst, ctx) {
  const gs = engine.gs;
  const pi = inst.controller ?? inst.owner;
  const ps = gs.players[pi];
  const have = getChangeCounters(inst);
  if (have <= 0) return false;
  if (drawBlockedFor(engine, pi)) return false; // Defensive — Hand-/Zieh-Sperre (Z6, A02-20: Jewel zaehlte nicht)

  const max = Math.min(have, MAX_DRAW);
  const opts = [];
  for (let n = 1; n <= max; n++) {
    opts.push({ id: String(n), label: `Draw ${n} card${n === 1 ? '' : 's'} (cost ${n})` });
  }
  const pick = await engine.promptGeneric(pi, {
    type: 'optionPicker',
    title: CARD_NAME,
    description: `Remove up to ${MAX_DRAW} Change Counters from ${CARD_NAME} to draw that many cards.`,
    options: opts,
    cancellable: true,
  });
  if (!pick || pick.cancelled) return false;
  const n = parseInt(pick.optionId, 10);
  if (!Number.isInteger(n) || n < 1 || n > max) return false;

  removeChangeCounters(engine, inst, n);
  await engine.actionDrawCards(pi, n);

  engine.log('gatherer_draw', {
    player: ps?.username, drawn: n,
  });
  if (!ctx._borrowedUse) stampHopt(gs, HOPT_DRAW, inst.id);   // W13 (Al, Rueckfrage 9)
  ctx._skipCreatureEffectHopt = true;
  return true;
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  activeIn: ['support'],
  creatureEffect: true,

  // Gerrymander redirect (sub-ability picker only) — pick `move` over
  // `draw`. Draws give opp future plays; Move just rearranges
  // counters with no card advantage.
  cpuGerrymanderResponse(/* engine, gerryOwnerPi, promptData */) {
    return { optionId: 'move' };
  },

  // CPU eval declaration — Gatherer accumulates Change Counters and
  // converts up to 3 of them into draws. Counter-consumer so the
  // eval values its side's counters at the higher rate.
  cpuMeta: {
    counterConsumer: true,
  },

  canActivateCreatureEffect(ctx) {
    const inst = ctx.card;
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = inst.controller ?? inst.owner;

    const moveAvail = (ctx._borrowedUse || !hoptUsed(gs, HOPT_MOVE, inst.id))
      && changeCounterCardsOnSide(engine, pi).length > 0
      && ownCosmicCreatures(engine, pi).length > 0;

    const ps = gs.players[pi];
    const drawAvail = (ctx._borrowedUse || !hoptUsed(gs, HOPT_DRAW, inst.id))
      && getChangeCounters(inst) > 0
      && !drawBlockedFor(engine, pi);

    return moveAvail || drawAvail;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const inst = ctx.card;
    const pi = inst.controller ?? inst.owner;
    const ps = gs.players[pi];

    const moveAvail = (ctx._borrowedUse || !hoptUsed(gs, HOPT_MOVE, inst.id))
      && changeCounterCardsOnSide(engine, pi).length > 0
      && ownCosmicCreatures(engine, pi).length > 0;
    const drawAvail = (ctx._borrowedUse || !hoptUsed(gs, HOPT_DRAW, inst.id))
      && getChangeCounters(inst) > 0
      && !drawBlockedFor(engine, pi);

    if (!moveAvail && !drawAvail) return false;

    let pickedAbility;
    if (moveAvail && !drawAvail) pickedAbility = 'move';
    else if (drawAvail && !moveAvail) pickedAbility = 'draw';
    else {
      const opts = [];
      opts.push({ id: 'move', label: 'Move Counters → CD Creature' });
      opts.push({ id: 'draw', label: 'Spend Counters → Draw cards' });
      const pick = await engine.promptGeneric(pi, {
        type: 'optionPicker',
        title: CARD_NAME,
        description: 'Choose which once-per-turn ability to activate.',
        options: opts,
        cancellable: true,
        // Sub-ability picker — Move vs Draw are distinct effects.
        // The count pickers below are parameters, NOT distinct
        // effects, so they intentionally lack this flag.
        gerrymanderEligible: true,
      });
      if (!pick || pick.cancelled) return false;
      pickedAbility = pick.optionId;
    }

    if (pickedAbility === 'move') return await runMove(engine, inst, ctx);
    if (pickedAbility === 'draw') return await runDraw(engine, inst, ctx);
    return false;
  },

  // ── PASSIVE TRIGGER ──────────────────────────────────────────────
  //
  // 1 Change Counter per draw / hand-add EFFECT — NOT per card. See
  // Analyzer's matching block for the full rationale. Listening to
  // `beforeDrawBatch` fires once per draw call regardless of card
  // count, so Elixir of Quickness (3 draws) yields 1 counter.
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
    // ★ Welle 9 (Al, 15.10.2026, A02-deepsea-21): „Ja, das soll zählen" — auch die Rückgabe vom Brett auf die Hand des Gegners per Effekt
    // (Deepsea-Bounce, Shapeshift, Castle, Encounter, Monstrosity …) ist „adds cards to their hand". Ein Counter je Rückgabe-Ereignis
    // (`onCardsReturnedToHand`), nicht je Karte. Tokens verschwinden beim Verlassen und landen nie auf der Hand → zählen nicht.
    // Gezählt wird, wenn die Hand des GEGNERS (`ownerIdx`) Karten erhält; die eigene Rückgabe zählt nicht.
    onCardsReturnedToHand: (ctx) => {
      if (ctx.ownerIdx === ctx.cardOwner) return;
      const insts = ctx.returnedInsts || [];
      if ((ctx.returnedCards || []).length === 0) return;
      if (insts.length > 0 && insts.every(i => ctx._engine.isTokenCard(i))) return;
      addChangeCounters(ctx._engine, ctx.card, 1);
    },
  },
};
