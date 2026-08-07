// ═══════════════════════════════════════════
//  CARD EFFECT: "Great Detective Doq"
//  Hero (500 HP, 100 ATK — Fighting + Premonition)
//
//  When this Hero attacks, the controller clicks
//  any card in the opponent's hand to choose it,
//  then declares one of five card-type groups:
//    • Attack / Spell / Creature
//    • Artifact
//    • Ability
//    • Hero / Ascended Hero
//    • Potion
//  The chosen card is then revealed to both
//  players. If it belongs to the declared group,
//  the Attack's damage is increased by 150 AND
//  the controller draws 2 cards.
//
//  The pick UX uses the existing `pickFromOppHand`
//  prompt — cards already revealed to Doq's
//  controller (auto-reveal Crystals, Premonition,
//  Bamboo Shield, etc.) stay face-up in the picker,
//  letting the controller cherry-pick a known card
//  for a guaranteed correct declaration. Hidden
//  cards stay face-down — picking one of those is
//  a blind guess.
//
//  Wiring: listens to `onAttackDeclare`, the
//  engine hook fired AFTER target selection but
//  BEFORE the attack animation + damage land
//  (see `engine._fireAttackDeclare` and the
//  Attack-side fire sites in `executeAttack`,
//  hammer-throw, rocket-fist, whirlwind-strike).
//  Doq's pick + declare prompts surface BEFORE
//  the swoosh, then the +150 / draw 2 land before
//  the engine deals damage with the modified
//  amount.
//
//  Source gate: `source.heroIdx === doq's heroIdx`
//  and `source.owner === doq's controller` —
//  matches every Attack Doq makes regardless of
//  the card name / damage formula.
//
//  Empty opp hand → effect quietly skips (no card
//  to pick, no prompt, no bonus, no draw).
// ═══════════════════════════════════════════

const CARD_NAME = 'Great Detective Doq';
const ATK_BONUS = 150;
const DRAW_ON_HIT = 2;

// Declarable type groups. Each `match` consults the card-DB entry
// `cd.cardType`. The order here is the order shown in the picker.
const TYPE_GROUPS = [
  {
    id: 'action',
    label: '⚔️ Attack / Spell / Creature',
    description: 'Any Attack-, Spell-, or Creature-type card.',
    match: (cd) => cd?.cardType === 'Attack' || cd?.cardType === 'Spell' || cd?.cardType === 'Creature',
  },
  {
    id: 'artifact',
    label: '🪄 Artifact',
    description: 'Any Artifact (Equipment, Reaction, targeting, etc.).',
    match: (cd) => cd?.cardType === 'Artifact',
  },
  {
    id: 'ability',
    label: '✨ Ability',
    description: 'Any Ability card.',
    match: (cd) => cd?.cardType === 'Ability',
  },
  {
    id: 'hero',
    label: '🛡️ Hero / Ascended Hero',
    description: 'Any Hero or Ascended Hero card.',
    match: (cd) => cd?.cardType === 'Hero' || cd?.cardType === 'Ascended Hero',
  },
  {
    id: 'potion',
    label: '🧪 Potion',
    description: 'Any Potion card.',
    match: (cd) => cd?.cardType === 'Potion',
  },
];

/** True iff `source` is Doq's own Hero making an Attack. */
function isOwnAttack(ctx, source) {
  if (!source) return false;
  if (source.heroIdx !== ctx.card.heroIdx) return false;
  const srcOwner = source.owner ?? source.controller ?? -1;
  if (srcOwner !== ctx.cardOwner) return false;
  return true;
}

/**
 * Run the detective guess. Returns the damage bonus to apply (0 or
 * ATK_BONUS) and handles the draw on hit. Caller is responsible for
 * applying the bonus to its own damage path (modifyAmount for the
 * hero pipeline, e.amount += bonus for the creature batch).
 *
 * Flow:
 *   1. Empty opp hand → bail with 0.
 *   2. Open a `pickFromOppHand` prompt covering every opp hand slot.
 *      Cards already revealed to Doq's controller (auto-reveal
 *      Crystals, Premonition, Bamboo Shield, etc.) render face-up in
 *      the picker without us touching `_revealedHandIndices`. Hidden
 *      slots render face-down — clicking one is a blind pick.
 *   3. Declare a type via `optionPicker`.
 *   4. Broadcast `card_reveal` so the picked card is publicly visible
 *      on the verdict beat, then check the match.
 */
async function runGuess(engine, pi, doqHeroIdx) {
  const oppIdx = pi === 0 ? 1 : 0;
  const ops = engine.gs.players[oppIdx];
  const hand = ops?.hand || [];
  if (hand.length === 0) return 0;

  const eligibleIndices = hand.map((_, i) => i);
  const pickResult = await engine.promptGeneric(pi, {
    type: 'pickFromOppHand',
    title: CARD_NAME,
    description: `Click a card in ${ops.username}'s hand to investigate. `
      + 'You will then declare its type — a correct guess grants +150 to this Attack '
      + 'and 2 free draws.',
    eligibleIndices,
    cancellable: false,
  });

  const pickedHandIdx = pickResult?.handIndex;
  if (!Number.isInteger(pickedHandIdx) || pickedHandIdx < 0 || pickedHandIdx >= hand.length) return 0;
  const pickedCard = hand[pickedHandIdx];
  if (!pickedCard) return 0;

  const choice = await engine.promptGeneric(pi, {
    type: 'optionPicker',
    title: CARD_NAME,
    description: 'Declare the picked card\'s type. If you guess correctly, '
      + 'this Attack deals +150 damage and you draw 2 cards.',
    options: TYPE_GROUPS.map(g => ({
      id: g.id, label: g.label, description: g.description,
    })),
    cancellable: false,
  });

  const declaredId = choice?.optionId;
  const group = TYPE_GROUPS.find(g => g.id === declaredId);

  // Reveal the picked card to both players for the verdict beat.
  engine._broadcastEvent('card_reveal', { cardName: pickedCard, playerIdx: oppIdx });
  await engine._delay(800);

  const cd = engine._getCardDB()[pickedCard];
  const matched = !!group?.match(cd);

  if (matched) {
    engine.log('doq_guess_hit', {
      player: engine.gs.players[pi]?.username,
      declared: group.label, card: pickedCard,
    });
    // Golden sparkles on Doq for the verdict beat. Staggered triple-
    // burst mirrors the `ability_activated` flourish pattern so the
    // "correct prediction!" beat reads as a celebratory hit rather
    // than a flicker. Uses sequential `engine._delay` (not setTimeout)
    // so the entire burst stays inside the fast-mode window during
    // MCTS rollouts — otherwise the late macrotask emits leak past the
    // rollout's snapshot/restore and broadcast phantom sparkles to live
    // clients with stale coordinates.
    const sparkleAt = { type: 'gold_sparkle', owner: pi, heroIdx: doqHeroIdx, zoneSlot: -1 };
    engine._broadcastEvent('play_zone_animation', { ...sparkleAt, duration: 1400 });
    await engine._delay(200);
    engine._broadcastEvent('play_zone_animation', { ...sparkleAt, duration: 1200 });
    await engine._delay(200);
    engine._broadcastEvent('play_zone_animation', { ...sparkleAt, duration: 1000 });
    await engine._delay(100);
    await engine.actionDrawCards(pi, DRAW_ON_HIT);
    return ATK_BONUS;
  }

  engine.log('doq_guess_miss', {
    player: engine.gs.players[pi]?.username,
    declared: group?.label || '?', card: pickedCard,
    actualType: cd?.cardType || 'unknown',
  });
  return 0;
}

module.exports = {
  // BORIS-SPERRE (Klausel 1): holt Karten des Gegners auf die eigene Seite
  // Solange der Gegner einen wirksamen Boris hat, ist diese Karte
  // gar nicht erst aktivierbar. Siehe engine.borisBlockIdx.
  stealsOpponentCards: true,

  activeIn: ['hero'],

  hooks: {
    // Fires once per Attack — AFTER target selection, BEFORE the
    // attack animation and damage. ctx.modifyAmount adds the bonus
    // to hookCtx.amount, which the calling Attack flow reads back
    // and feeds into the actual damage call.
    onAttackDeclare: async (ctx) => {
      if (!isOwnAttack(ctx, ctx.source)) return;
      const bonus = await runGuess(ctx._engine, ctx.cardOwner, ctx.card.heroIdx);
      if (bonus > 0) ctx.modifyAmount(bonus);
    },
  },
};
