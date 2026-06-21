// ═══════════════════════════════════════════
//  Shared helpers for the "Cycling Demons"
//  archetype.
//
//  Five Level-1 / 50 HP / no-ATK Creatures
//  (Summoning Magic, no Cost):
//    Hydrogen Demon, Herbithorn Demon,
//    Bouldor Demon, Infernous Demon,
//    Serpentous Demon.
//
//  They form a CLOSED SELF-REPLACING CYCLE.
//  Each demon has three clauses:
//
//   ① ON-SUMMON BONUS — fires ONLY when the
//      demon was placed by its specific
//      PREDECESSOR's defeat effect (i.e. the
//      `_summonedByDemon` provenance flag equals
//      the predecessor's name). Summoning a demon
//      any other way — notably a normal hand
//      summon — leaves the flag unset and produces
//      no bonus. This is the literal card text:
//      "When you summon this Creature with the
//      effect of <predecessor>, you may …".
//
//   ② ON-DEFEAT — when the demon is defeated, you
//      MAY tutor its SUCCESSOR from your deck and
//      PLACE it into the Support Zone the defeated
//      demon occupied. That placement fires the
//      successor's onPlay, which (because the
//      placement stamps `_summonedByDemon`) fires
//      the successor's own ① bonus. Defeat → place
//      → bonus → (later) defeat → … perpetuates
//      the cycle off the opponent killing your
//      demons.
//
//   ③ PER-NAME 1/TURN CAP — "You can only summon 1
//      <name> per turn." Counts EVERY arrival
//      (hand summon AND defeat-chain placement),
//      stamped in onPlay via
//      `ps._cyclingDemonSummonedThisTurn[<name>]`
//      and consulted by `canSummonDemon` (grays the
//      hand card) AND by the defeat handler (loop
//      breaker — the cycle can't place a name that
//      already arrived this turn, so wrapping all
//      five back to the start in one turn stops).
//      Engine wipes the map at turn start (see
//      `_engine.js` startTurn, beside the Soul
//      Shard reset).
//
//  The loader skips files starting with "_", so
//  this module is private infrastructure and
//  never loaded as a card.
// ═══════════════════════════════════════════

const ARCHETYPE = 'Cycling Demons';

// name → { predecessor (whose defeat placed me → fires my bonus),
//          successor   (whom my defeat places),
//          onDeathBenefit (CPU sacrifice-value of THIS demon dying) }
//
// onDeathBenefit reflects what the SUCCESSOR this demon places (and the
// bonus that successor then fires) is worth — all net positive so every
// demon reads as worthwhile sacrifice fodder:
//   • Bouldor (→ Infernous: 150 burst damage)        = most  (55)
//   • Serpentous (→ Hydrogen: Freeze a Hero 1 turn)  = least (18)
//   • the middle three (discard-grab / opp-discard-2 /
//     draw-2 payloads)                               = 30 each
const CYCLE = {
  'Hydrogen Demon':   { predecessor: 'Serpentous Demon', successor: 'Herbithorn Demon', onDeathBenefit: 30 },
  'Herbithorn Demon': { predecessor: 'Hydrogen Demon',   successor: 'Bouldor Demon',    onDeathBenefit: 30 },
  'Bouldor Demon':    { predecessor: 'Herbithorn Demon', successor: 'Infernous Demon',  onDeathBenefit: 55 },
  'Infernous Demon':  { predecessor: 'Bouldor Demon',    successor: 'Serpentous Demon', onDeathBenefit: 30 },
  'Serpentous Demon': { predecessor: 'Infernous Demon',  successor: 'Hydrogen Demon',   onDeathBenefit: 18 },
};

const CYCLING_DEMON_NAMES = new Set(Object.keys(CYCLE));

/** Is this card name one of the five Cycling Demons? */
function isCyclingDemon(cardName) {
  return CYCLING_DEMON_NAMES.has(cardName);
}

// ── Per-name 1/turn cap (counts hand summons AND chain placements) ──

function wasDemonSummonedThisTurn(gs, pi, name) {
  const ps = gs?.players?.[pi];
  if (!ps?._cyclingDemonSummonedThisTurn) return false;
  return !!ps._cyclingDemonSummonedThisTurn[name];
}

function markDemonSummoned(gs, pi, name) {
  const ps = gs?.players?.[pi];
  if (!ps) return;
  if (!ps._cyclingDemonSummonedThisTurn) ps._cyclingDemonSummonedThisTurn = {};
  ps._cyclingDemonSummonedThisTurn[name] = true;
}

/**
 * Shared `canSummon(ctx)` predicate. Returns false once a copy of THIS
 * demon name has arrived this turn — covers hand plays AND defeat-chain
 * placements (both stamp the cap in onPlay). `ctx.cardName` is the
 * canonical "what's about to be summoned" handle inside canSummon.
 */
function canSummonDemon(ctx) {
  const engine = ctx?._engine;
  const pi = ctx?.cardOwner;
  const name = ctx?.cardName;
  if (engine == null || pi == null || !name) return true;
  return !wasDemonSummonedThisTurn(engine.gs, pi, name);
}

// ═══════════════════════════════════════════
//  On-summon bonuses (one per demon). Each is
//  "you may …" — targeting prompts are
//  cancellable, non-targeted ones gate on a
//  confirm. `pi` is the controller.
// ═══════════════════════════════════════════

// Hydrogen Demon — Freeze an opponent Hero for 1 turn.
async function bonusFreezeOppHero(ctx, engine, pi) {
  const target = await ctx.promptDamageTarget({
    side: 'enemy', types: ['hero'], damageType: 'status',
    title: 'Hydrogen Demon',
    description: 'Freeze an opponent Hero for 1 turn.',
    confirmLabel: '❄️ Freeze!', confirmClass: 'btn-info', cancellable: true,
  });
  if (!target || target.type !== 'hero') return;
  const hero = engine.gs.players[target.owner]?.heroes?.[target.heroIdx];
  if (!hero?.name || hero.hp <= 0) return;
  if (hero.statuses?.immune || hero.statuses?.freeze_immune) return;
  engine._broadcastEvent('play_zone_animation', {
    type: 'freeze', owner: target.owner, heroIdx: target.heroIdx, zoneSlot: -1,
  });
  await engine._delay(300);
  await engine.addHeroStatus(target.owner, target.heroIdx, 'frozen', { appliedBy: pi });
  engine.log('hydrogen_demon_freeze', { target: hero.name });
}

// Herbithorn Demon — take a card from ANY discard pile to your hand.
async function bonusGrabFromAnyDiscard(ctx, engine, pi) {
  const gs = engine.gs;
  const oppIdx = pi === 0 ? 1 : 0;
  // Gallery entries from BOTH discard piles. `source: 'discard'` is the
  // canonical value the gallery renderer styles (purple "DISCARD" badge);
  // the description tells the player it spans any pile. De-dup by name so
  // a card present in both piles shows once — either copy is identical, so
  // the pull below just prefers your own pile.
  const entries = [];
  const seen = new Set();
  const addPile = (ownerIdx) => {
    const pile = gs.players[ownerIdx]?.discardPile || [];
    for (const name of pile) {
      if (seen.has(name)) continue;
      seen.add(name);
      entries.push({ name, source: 'discard' });
    }
  };
  addPile(pi);
  addPile(oppIdx);
  if (entries.length === 0) return;

  const selected = await ctx.promptCardGallery(entries, {
    title: 'Herbithorn Demon',
    description: 'Choose a card from any discard pile and add it to your hand.',
    cancellable: true,
  });
  if (!selected) return;

  // Pull from your OWN pile first; fall back to the opponent's. (If a
  // name exists in both piles it's the same card — either is correct.)
  let fromIdx = pi;
  if (!(gs.players[pi]?.discardPile || []).includes(selected.cardName)) fromIdx = oppIdx;

  // Explicit discard→hand flight, anchored to the SOURCE discard pile
  // (own or opponent's). `addCardFromDiscardToHand` emits no animation of
  // its own, so without this the client's hand-grew watcher falls back to
  // a default deck→hand "draw" visual — wrong source. Broadcasting the
  // transfer BEFORE the state mutation lets the client capture both rects
  // and bumps its hand-grew suppression counter so the draw anim is
  // skipped. Cross-owner form (`fromOwner`/`toOwner`) so a pull from the
  // opponent's pile flies from THEIR discard. (Pattern: divine-gift-of-time.)
  const toHandIdx = (gs.players[pi]?.hand || []).length;
  engine._broadcastEvent('play_pile_transfer', {
    fromOwner: fromIdx, toOwner: pi,
    cardName: selected.cardName,
    from: 'discard', to: 'hand',
    toHandIdx,
  });
  await engine.addCardFromDiscardToHand(pi, selected.cardName, fromIdx, {
    source: 'Herbithorn Demon',
  });
  // Let the flight land before any follow-up sync re-renders the hand.
  await engine._delay(500);
}

// Bouldor Demon — opponent discards 2 cards of their choice.
async function bonusOppDiscards2(ctx, engine, pi) {
  const oppIdx = pi === 0 ? 1 : 0;
  const opp = engine.gs.players[oppIdx];
  if (!opp || (opp.hand || []).length === 0) return;
  const confirmed = await engine.promptGeneric(pi, {
    type: 'confirm', title: 'Bouldor Demon',
    message: 'Make your opponent discard 2 cards of their choice?',
    confirmLabel: '🪨 Yes', cancelLabel: 'No', cancellable: true,
  });
  if (!confirmed) return;
  await engine.actionPromptForceDiscard(oppIdx, 2, {
    source: 'Bouldor Demon', title: 'Bouldor Demon',
  });
}

// Infernous Demon — deal 50 damage to a chosen target 3 times.
async function bonusDeal50x3(ctx, engine, pi) {
  const target = await ctx.promptDamageTarget({
    side: 'any', types: ['hero', 'creature'],
    damageType: 'destruction_spell', baseDamage: 50,
    title: 'Infernous Demon',
    description: 'Deal 50 damage to a target 3 times.',
    confirmLabel: '🔥 Burn! (50×3)', confirmClass: 'btn-danger', cancellable: true,
  });
  if (!target) return;
  const sourceMeta = {
    name: 'Infernous Demon', owner: pi, heroIdx: ctx.cardHeroIdx, controller: pi,
  };
  // Three SEPARATE 50-damage hits, each landing AFTER its own explosion.
  // The hero floater is diff-based between state snapshots, so we
  // `sync()` after every hit — otherwise the three drops coalesce into a
  // single -150 at the next sync. A pause after each lets the -50 read
  // before the next explosion fires. Re-resolve the target each pass so a
  // mid-sequence death cleanly stops the remaining hits.
  for (let i = 0; i < 3; i++) {
    if (target.type === 'hero') {
      const hero = engine.gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (!hero?.name || hero.hp <= 0) break;
      engine._broadcastEvent('play_zone_animation', {
        type: 'explosion', owner: target.owner, heroIdx: target.heroIdx, zoneSlot: -1,
      });
      await engine._delay(300);
      await engine.actionDealDamage(sourceMeta, hero, 50, 'destruction_spell');
    } else {
      const inst = target.cardInstance || engine.cardInstances.find(c =>
        (c.owner === target.owner || c.controller === target.owner)
        && c.zone === 'support' && c.heroIdx === target.heroIdx
        && c.zoneSlot === target.slotIdx);
      if (!inst || inst.zone !== 'support') break;
      engine._broadcastEvent('play_zone_animation', {
        type: 'explosion', owner: inst.owner, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
      });
      await engine._delay(300);
      await engine.processCreatureDamageBatch([{
        inst, amount: 50, type: 'destruction_spell', source: ctx.card, sourceOwner: pi,
      }]);
    }
    // Render THIS hit's -50 before pacing into the next explosion.
    engine.sync();
    await engine._delay(350);
  }
}

// Serpentous Demon — draw 2 cards.
async function bonusDraw2(ctx, engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps || ps.handLocked) return;
  const confirmed = await engine.promptGeneric(pi, {
    type: 'confirm', title: 'Serpentous Demon',
    message: 'Draw 2 cards?', confirmLabel: '🐍 Draw', cancelLabel: 'No', cancellable: true,
  });
  if (!confirmed) return;
  await engine.actionDrawCards(pi, 2);
}

const BONUS = {
  'Hydrogen Demon':   bonusFreezeOppHero,
  'Herbithorn Demon': bonusGrabFromAnyDiscard,
  'Bouldor Demon':    bonusOppDiscards2,
  'Infernous Demon':  bonusDeal50x3,
  'Serpentous Demon': bonusDraw2,
};

/**
 * Build the full `module.exports` for one Cycling Demon. Each card file
 * is a one-liner that calls this with its own name.
 */
function buildDemonHooks(cardName) {
  const def = CYCLE[cardName];
  return {
    activeIn: ['support'],
    canSummon: canSummonDemon,

    // Mirror Grave Worm: the onCreatureDeath listener must still fire
    // when an AoE kills the demon AND its host Hero in the same batch
    // (the defeat-chain placement onto the now-empty slot is a valid
    // "place", which `isPlacement` permits even on a dead host).
    bypassDeadHeroFilter: true,

    // The whole archetype's value is ON-DEATH: dying tutors + places the
    // next demon and fires its bonus. Same "preferred dead" handling as
    // Hell Fox / Exploding Skull:
    //   • onDeathBenefit (per-demon, from CYCLE — see table) discounts this
    //     slot's "alive value", so the eval treats own copies as attractive
    //     sacrifice fodder and opp copies as unattractive Attack targets
    //     (don't feed the opponent's chain). The magnitude scales with what
    //     the successor this demon places is worth.
    //   • preferDead keeps the CPU from ever spending defensive resources
    //     (heals / cleanses / buffs) on a demon — every turn it lives
    //     without dying is a turn its payload + cycle aren't firing.
    cpuMeta: { onDeathBenefit: def.onDeathBenefit, preferDead: true },

    hooks: {
      // On-summon: stamp the per-turn cap for EVERY arrival, then fire
      // the bonus only when placed by the specific predecessor.
      onPlay: async (ctx) => {
        if (ctx.playedCard?.id !== ctx.card.id) return;
        if (ctx.cardZone !== 'support') return;
        const engine = ctx._engine;
        const pi = ctx.cardController ?? ctx.cardOwner;

        markDemonSummoned(engine.gs, pi, cardName);

        if (ctx._summonedByDemon !== def.predecessor) return;
        const bonus = BONUS[cardName];
        if (bonus) await bonus(ctx, engine, pi);
      },

      // On-defeat: tutor the successor from the deck and PLACE it into
      // the vacated Support Zone (which re-fires the successor's bonus).
      onCreatureDeath: async (ctx) => {
        const death = ctx.creature;
        if (!death) return;
        // Self-detect: only react to THIS demon instance dying.
        if (death.name !== cardName || death.instId !== ctx.card.id) return;

        const engine = ctx._engine;
        const gs = engine.gs;
        const pi = death.controller ?? death.owner ?? ctx.cardOwner;
        const ps = gs.players[pi];
        if (!ps) return;

        const successor = def.successor;

        // Loop breaker + per-turn cap: the cycle cannot place a demon
        // name that already arrived this turn.
        if (wasDemonSummonedThisTurn(gs, pi, successor)) return;
        if (ps.summonLocked) return;

        // Need a copy in the deck. The deck array is `mainDeck` (NOT
        // `deck`, which doesn't exist on player state).
        const deckIdx = (ps.mainDeck || []).indexOf(successor);
        if (deckIdx < 0) return;

        // The vacated slot must still be free.
        const sup = ps.supportZones?.[death.heroIdx] || [];
        if ((sup[death.zoneSlot] || []).length !== 0) return;

        // "You may."
        const confirmed = await engine.promptGeneric(pi, {
          type: 'confirm', title: cardName,
          message: `${cardName} was defeated. Place "${successor}" from your deck into its Support Zone?`,
          showCard: successor,
          confirmLabel: '😈 Cycle!', cancelLabel: 'No', cancellable: true,
        });
        if (!confirmed) return;

        // Re-verify after the prompt (parallel reactions could move state).
        const deckIdx2 = (ps.mainDeck || []).indexOf(successor);
        if (deckIdx2 < 0) return;
        if (wasDemonSummonedThisTurn(gs, pi, successor)) return;
        const sup2 = ps.supportZones?.[death.heroIdx] || [];
        if ((sup2[death.zoneSlot] || []).length !== 0) return;

        // Pull from deck, then PLACE (not summon) into the vacated slot.
        // `isPlacement` bypasses host summon-gates and fires the
        // successor's onPlay even on a dead host; `_summonedByDemon`
        // is the provenance the successor's onPlay reads to fire its
        // own on-summon bonus.
        ps.mainDeck.splice(deckIdx2, 1);
        const placed = await engine.summonCreatureWithHooks(
          successor, pi, death.heroIdx, death.zoneSlot,
          {
            source: cardName,
            isPlacement: true,
            hookExtras: { _summonedByDemon: cardName, _placedByCyclingDemon: true },
          },
        );
        if (!placed) {
          // Roll back the deck removal if the placement bailed defensively.
          ps.mainDeck.splice(deckIdx2, 0, successor);
          return;
        }

        engine.log('cycling_demon_cycle', {
          from: cardName, to: successor,
          heroIdx: death.heroIdx, zoneSlot: death.zoneSlot,
        });
        engine.sync();
      },
    },
  };
}

module.exports = {
  ARCHETYPE,
  CYCLE,
  CYCLING_DEMON_NAMES,
  isCyclingDemon,
  wasDemonSummonedThisTurn,
  markDemonSummoned,
  canSummonDemon,
  buildDemonHooks,
};
