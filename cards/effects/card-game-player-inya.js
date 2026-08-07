// ═══════════════════════════════════════════
//  CARD EFFECT: "Card Game Player Inya"
//  Hero — 400 HP, 20 ATK (Creativity + Friendship)
//
//  ① Whenever Inya casts a Spell DURING HER
//    CONTROLLER'S TURN that would head to the
//    discard pile after resolving, the controller
//    may instead summon it into one of Inya's
//    free Support Zones as a "Fantasy Buddy
//    Token" with 10 HP.
//
//    Eligibility filter:
//     • Spell must NOT have placed itself on the
//       board during its own onPlay (Areas /
//       Attachments set `gs._spellPlacedOnBoard
//       = true` — we skip those).
//     • Trigger only fires on the controller's
//       turn — `gs.activePlayer === cardOwner`.
//       Naturally excludes Reactions / Surprises
//       Inya casts during the OPPONENT's turn.
//     • Inya needs at least one free base Support
//       Zone slot.
//
//    Implementation: place a fresh Token inst in
//    Inya's free Support Zone via
//    `engine.safePlaceInSupport`, override its
//    card data + HP via `_cardDataOverride`, and
//    flag it with `_fantasyBuddyToken` so the
//    damage-shield count finds it. Then set
//    `gs._spellPlacedOnBoard = true` to suppress
//    the standard post-resolve discard (works
//    both for initial casts in doPlaySpell AND
//    for reaction-chain casts via the matching
//    flag check in `_resolveReactionChain`).
//
//    Same Token-creation pattern Biomancy Token
//    uses — keeps the spell's card image while
//    the tooltip / cardType reads as a Token.
//
//  ② While the controller has 1+ Fantasy Buddy
//    Tokens on the board, Inya takes no damage.
//    Hooked via beforeDamage: target=Inya AND
//    any live Buddy → setAmount(0).
//
//  bypassStatusFilter is set so Inya's damage
//  shield keeps protecting her while she's
//  frozen / stunned / negated — passive
//  protection isn't an "effect she activates."
// ═══════════════════════════════════════════

const CARD_NAME = 'Card Game Player Inya';
const TOKEN_HP = 10;

/**
 * Count the Fantasy Buddy Tokens currently controlled by `pi`. A Buddy
 * is any cardInstance in zone='support' belonging to `pi` with the
 * `_fantasyBuddyToken` marker counter set and currentHp > 0.
 */
function _countBuddies(engine, pi) {
  let n = 0;
  for (const inst of engine.cardInstances) {
    if ((inst.controller ?? inst.owner) !== pi) continue;
    if (inst.zone !== 'support') continue;
    if (!inst.counters?._fantasyBuddyToken) continue;
    const hp = inst.counters?.currentHp ?? inst.counters?._cardDataOverride?.hp ?? 0;
    if (hp <= 0) continue;
    n++;
  }
  return n;
}

module.exports = {
  /**
   * CPU-Antwort auf die "Buddy beschwoeren?"-Abfrage.
   *
   * WARUM NOETIG (Als Befund 5.8.: "Inya beschwoert bei der CPU nicht"):
   * Der heuristische Standard fuer ABBRECHBARE confirm-Abfragen ist
   * ABLEHNEN (`_cpu.js`: "Confirm-cancellable default: decline"). Die
   * MCTS-Kandidatenliste bietet zwar zusaetzlich "confirm" an — waehrend
   * einer Reaktionskette und im Puzzle laeuft aber kein MCTS, also greift
   * der Standard und Inya lehnte immer ab.
   *
   * Als Vorgabe: "Sie SOLLTE immer beschwoeren, wenn sie kann." Der
   * Hook wird nur erreicht, wenn `onSpellDiscard` die Vorbedingungen
   * schon geprueft hat (freie Support-Zone vorhanden), ein Ja ist hier
   * also immer ausfuehrbar.
   *
   * Der GLOBALE Standard bleibt bewusst unangetastet — er ist fuer
   * "may"-Abfragen richtig, deren Nutzen nicht feststeht.
   */
  cpuResponse(engine, promptType, promptData) {
    if (promptType !== 'generic') return undefined;
    if (promptData?.type !== 'confirm') return undefined;
    return { confirmed: true };
  },

  activeIn: ['hero'],
  // Damage shield is a passive — keep it active even when Inya is
  // frozen / stunned / negated.
  bypassStatusFilter: true,

  hooks: {
    /**
     * Spell-cast trigger — fires after the spell's effect has resolved
     * (and after any chain resolution wraps up). Gates on:
     *   • Inya is the caster (cardHeroIdx + cardOwner match).
     *   • It IS Inya's controller's turn.
     *   • Spell did NOT self-place on the board (no Areas /
     *     Attachments).
     *   • Inya has at least one free base Support Zone slot.
     */
    afterSpellResolved: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;

      // Caster must be THIS Inya.
      if (ctx.casterIdx !== ctx.cardOwner) return;
      if (ctx.heroIdx !== ctx.cardHeroIdx) return;
      // Must be Inya's controller's turn — excludes opp-turn reactions
      // / surprises Inya casts.
      if (gs.activePlayer !== ctx.cardOwner) return;
      // Defensive: only Spell-type cards. afterSpellResolved fires
      // only for Spells in practice but check the field on hookCtx.
      if (ctx.spellCardData?.cardType !== 'Spell') return;
      // Spell already self-placed somewhere on the board (Area /
      // Attachment) → not eligible. The flag was set during the
      // spell's onPlay; we read it BEFORE setting our own
      // suppress-discard flag below.
      if (gs._spellPlacedOnBoard) return;

      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      if (!ps) return;

      // Must have a free base support zone on Inya.
      const supZones = ps.supportZones?.[heroIdx] || [];
      let hasFree = false;
      for (let z = 0; z < 3; z++) {
        if ((supZones[z] || []).length === 0) { hasFree = true; break; }
      }
      if (!hasFree) return;

      const spellName = ctx.spellName;

      // Player prompt — "you may" effect.
      const confirmed = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `Summon ${spellName} as a Fantasy Buddy Token (${TOKEN_HP} HP) on Inya's free Support Zone instead of discarding it?`,
        showCard: spellName,
        confirmLabel: '🦄 Summon Buddy!',
        cancelLabel: 'Discard normally',
        cancellable: true,
        gerrymanderEligible: true,
      });
      if (!confirmed) return;

      // safePlaceInSupport finds the first free base zone and creates
      // a fresh tracked inst. Same primitive Biomancy Token uses for
      // its spell-as-creature placement.
      const placeResult = engine.safePlaceInSupport(spellName, pi, heroIdx, -1);
      if (!placeResult) return; // Race: zone filled mid-prompt.

      const { inst, actualSlot } = placeResult;

      // Mark + override card data so the engine + UI treat this as a
      // Creature/Token. The card image stays as the original spell.
      // Tooltip / cardType / hp / effect text read as the Buddy.
      const cardDB = engine._getCardDB();
      const baseSpell = cardDB[spellName] || {};
      inst.counters._fantasyBuddyToken = true;
      inst.counters.currentHp = TOKEN_HP;
      inst.counters.maxHp = TOKEN_HP;
      inst.counters._cardDataOverride = {
        ...baseSpell,
        name: 'Fantasy Buddy Token',
        cardType: 'Creature/Token',
        subtype: 'Token',
        hp: TOKEN_HP,
        atk: null,
        level: null,
        cost: null,
        effect: 'Fantasy Buddy Token. While its controller has at least 1 of these Tokens, Card Game Player Inya takes no damage.',
      };

      // Suppress the standard post-resolve discard. Honored by
      // doPlaySpell (initial casts) AND _resolveReactionChain
      // (chain links — see the matching flag-check block there).
      gs._spellPlacedOnBoard = true;

      // Sparkle on the Buddy's slot.
      engine._broadcastEvent('play_zone_animation', {
        type: 'gold_sparkle', owner: pi,
        heroIdx, zoneSlot: actualSlot,
      });

      // Fire onCardEnterZone so support-zone listeners (Pes'zet, Maya,
      // Ingo, etc.) react to the Buddy landing in Inya's zone.
      await engine.runHooks('onCardEnterZone', {
        enteringCard: inst, toZone: 'support', toHeroIdx: heroIdx,
        _skipReactionCheck: true,
      });

      engine.log('inya_buddy_summoned', {
        player: ps.username, spell: spellName, slot: actualSlot,
      });
      engine.sync();
    },

    /**
     * Damage immunity while a Fantasy Buddy is on the controller's
     * side. Hooks hero damage. Creature damage to the Buddy itself is
     * handled normally — the Buddy CAN be killed; killing the last
     * Buddy ends the immunity.
     */
    beforeDamage: (ctx) => {
      const engine = ctx._engine;
      // Only protect Inya herself.
      if (ctx.target !== ctx.attachedHero) return;
      if (_countBuddies(engine, ctx.cardOwner) <= 0) return;
      ctx.setAmount(0);
    },
  },
};
