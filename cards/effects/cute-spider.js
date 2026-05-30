// ═══════════════════════════════════════════
//  CARD EFFECT: "Cute Spider"
//  Creature (Summoning Magic Lv1, Normal) — 50 HP
//
//  "Once per turn, when you discard a Surprise one of your Heroes can
//   use through an effect, you may immediately activate and resolve
//   that Surprise as if any target of your choice met its activation
//   condition. Delete the Surprise afterwards."
//
//  Mechanics
//  ─────────
//   • Listens on `onDiscard` for Surprise cards discarded from the
//     controller's hand.
//   • Soft once-per-turn (per Cute Spider instance) — gated via the
//     `cute_spider_used:<inst.id>` HOPT key.
//   • Eligibility: at least one of the controller's Heroes must be
//     able to legally cast the Surprise (school + level + Wisdom
//     coverage, living, not Frozen / Stunned / Webbed).
//   • Prompts the controller to confirm activation. On confirm,
//     delegates to `engine._activateSurprise(..., { fromDiscard: true })`
//     — the same canonical activation pipeline Baby Spider and
//     Telekinesis use. The engine handles `onSurpriseActivated`,
//     the synthetic-target activation, Wisdom cost, and the final
//     discard→deleted disposition. No card-side duplication.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Cute Spider';

/**
 * First living Hero on `pi`'s side that legitimately meets the
 * Surprise's school / level / Wisdom-affordability requirement.
 * Returns -1 if none qualify. The Cute Spider trigger uses this
 * Hero as the activator for the engine's
 * `_activateSurprise(..., { fromDiscard: true })` call.
 *
 * Free Support Zone is NOT required even for Creature surprises —
 * the Surprise gets deleted (not placed) in this flow, so the
 * standard `_canHeroActivateSurprise` Creature-slot gate would be
 * a false negative here.
 */
function pickActivatingHero(engine, pi, cardData) {
  const ps = engine.gs.players[pi];
  if (!ps) return -1;
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.webbed) continue;
    if (!engine.heroMeetsLevelReq(pi, hi, cardData)) continue;
    // Wisdom affordability gate: if `heroMeetsLevelReq` only passed
    // by leaning on Wisdom paying down a level gap, the player must
    // actually be able to pay it. Surprise card is already in
    // discard (not hand), so the full current hand counts toward
    // the available pool — same convention `_canHeroActivateSurprise`
    // uses for non-`spellInHand` activations.
    if (cardData.cardType === 'Spell') {
      const wisdomCost = engine.getWisdomDiscardCost(pi, hi, cardData);
      if (wisdomCost > 0 && (ps.hand || []).length < wisdomCost) continue;
    }
    return hi;
  }
  return -1;
}

module.exports = {
  activeIn: ['support'],

  hooks: {
    onDiscard: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;

      const spiderInst = ctx.card;
      if (!spiderInst || spiderInst.zone !== 'support') return;
      const owner = spiderInst.controller ?? spiderInst.owner;

      // Discard must be the Spider's controller's. ctx.playerIdx is the
      // discarding player (set by the engine's discard fires).
      if (ctx.playerIdx !== owner) return;

      const discardedCardName = ctx.discardedCardName || ctx.cardName;
      if (!discardedCardName) return;
      const cardDB = engine._getCardDB();
      const discardedData = cardDB[discardedCardName];
      if (!discardedData) return;
      if (discardedData.cardType !== 'Spell' && !hasCardType(discardedData, 'Creature')) {
        // Surprises are subtype-tagged Spells or Creatures.
        return;
      }
      if ((discardedData.subtype || '').toLowerCase() !== 'surprise') return;
      // "Discarded ... through an effect" — onDiscard fires for any
      // discard. The engine's `_fromHand` flag distinguishes hand
      // discards (which is the natural reading of "discard a Surprise"
      // — Surprises in hand). On-board face-down Surprises going to
      // discard go through different code paths.
      if (!ctx._fromHand) return;

      // Soft HOPT per Cute Spider instance.
      if (!gs.hoptUsed) gs.hoptUsed = {};
      const hoptKey = `cute_spider_used:${spiderInst.id}`;
      if (gs.hoptUsed[hoptKey] === gs.turn) return;

      // Eligibility: pick the first Hero who can legally cast this
      // Surprise. The engine's force-activation path still pays Wisdom
      // if there's a school / level gap on that Hero, matching the
      // semantics of a normal Surprise activation.
      const activatingHeroIdx = pickActivatingHero(engine, owner, discardedData);
      if (activatingHeroIdx < 0) return;

      // Confirm — soft once per turn, players may want to save the
      // trigger for a different Surprise.
      const confirmed = await engine.promptGeneric(owner, {
        type: 'confirm',
        title: CARD_NAME,
        message: `Activate the discarded ${discardedCardName} for free? It will be deleted afterwards.`,
        showCard: discardedCardName,
        confirmLabel: '🕷️ Activate!',
        cancelLabel: 'No',
        cancellable: true,
      });
      if (!confirmed) return;

      // Mark HOPT before resolving so a nested discard from the
      // activation can't re-fire Cute Spider on the same trigger.
      gs.hoptUsed[hoptKey] = gs.turn;

      const surpriseScript = loadCardEffect(discardedCardName);
      if (!surpriseScript?.onSurpriseActivate) return;

      // Spider-themed flourish on the Cute Spider itself so the player
      // sees WHICH Spider triggered this activation. The engine's
      // `_activateSurprise` then emits its standard card_reveal to opp
      // and runs the activation pipeline.
      engine._broadcastEvent('play_zone_animation', {
        type: 'gold_sparkle',
        owner, heroIdx: spiderInst.heroIdx, zoneSlot: spiderInst.zoneSlot,
      });
      await engine._delay(200);

      // Delegate to the canonical activation pipeline. `fromDiscard`
      // tells the engine to (a) skip the surprise-zone flip / splice,
      // (b) skip Creature-placement and stays-face-up dispositions,
      // and (c) route the card from discard → deleted at the end —
      // exactly the "delete the Surprise afterwards" clause.
      // `telekinesis: true` opts the activated Surprise into its
      // "any target you choose" branch (Booby Trap / Magic Mirror /
      // Frost Rune / Spider Avalanche all read the flag).
      const sourceInfo = {
        telekinesis: true,
        forcedByCard: CARD_NAME,
        activatorIdx: owner === 0 ? 1 : 0,
      };

      // Cute Spider counts as the Surprise's SOURCE — any retaliation
      // (Booby Trap, Fireshield, Spiky Armor, …) must target the
      // Spider, not the host Hero we picked just to satisfy the
      // school / level requirement. Set the engine's creature-caster
      // annotation (same channel Baby Spider uses) so source-rewriting
      // throughout damage / reaction pipelines points at the Spider's
      // live inst. The Spider stays alive after triggering, so
      // retaliations have a real target to hit (unlike Baby Spider,
      // whose dead snapshot lets them bail out).
      const spiderSnapshot = {
        id: spiderInst.id,
        name: CARD_NAME,
        owner, controller: owner,
        heroIdx: spiderInst.heroIdx,
        zoneSlot: spiderInst.zoneSlot,
      };
      const prevCasterCreature = gs._spellCasterCreature;
      gs._spellCasterCreature = spiderSnapshot;
      try {
        await engine._activateSurprise(
          owner, activatingHeroIdx, discardedCardName,
          sourceInfo, surpriseScript,
          {
            fromDiscard: true,
            // Precise inst handoff so duplicate-named copies already in
            // discard don't get confused with the one Cute Spider is
            // reacting to. The onDiscard ctx carries the just-discarded
            // inst's id verbatim.
            fromDiscardInstId: ctx.discardedInstId ?? null,
          },
        );
      } finally {
        if (prevCasterCreature === undefined) delete gs._spellCasterCreature;
        else gs._spellCasterCreature = prevCasterCreature;
      }

      engine.log('cute_spider_force_activate', {
        player: gs.players[owner]?.username,
        surprise: discardedCardName,
      });
      engine.sync();
    },
  },
};
