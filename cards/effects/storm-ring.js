// ═══════════════════════════════════════════
//  CARD EFFECT: "Storm Ring"
//  Artifact (Reaction, Cost 4)
//
//  EFFECT:
//   "Play this card immediately when your opponent
//    plays a Spell that would hit more than 1
//    target. Negate that Spell."
//
//  ── Reaction-only (never proactive) ──
//  Same contract as Boots of Hermes / Spiky Armor:
//  cards.json subtype is "Reaction" and this script
//  exports NEITHER `proactivePlay` NOR `isReaction`,
//  so `validateActionPlay` refuses every attempt to
//  click it in hand and the reaction-CHAIN collector
//  skips it. It acts ONLY through the post-target
//  hand-reaction hub below.
//
//  ── Why `isPostTargetReaction` ──
//  The engine's post-target hub
//  (`_checkPostTargetHandReactions`) fires ONCE per
//  Spell, AFTER the caster has chosen targets but
//  BEFORE the Spell resolves, with the FULL list of
//  the targets it will actually hit. That is exactly
//  the "would hit more than 1 target" decision point:
//   • promptDamageTarget single-target → list len 1
//     → never triggers (a 1-target Spell).
//   • promptMultiTarget → the real selected list.
//     A Spell that CAN hit many but the caster only
//     picked 1 (e.g. Pyroblast at 1 target) arrives
//     with length 1 → correctly does NOT trigger.
//     The user picking 2+ → length ≥ 2 → triggers.
//   • AoE Spells (actionDealAoeDamage) → every hit
//     hero + creature.
//  So the count test is on the ACTUAL targets, never
//  the Spell's potential — per the card's intent.
//
//  ── Counts BOTH sides ──
//  The hub passes the FULL target list unfiltered
//  (the engine only uses target owners to order the
//  defender-first check, never to trim the list). So
//  the count spans every target the Spell hits on
//  EITHER side: a Spell that hits just 1 of Storm
//  Ring's controller's targets PLUS 1+ targets the
//  Spell's own caster controls = 2+ total → triggers.
//  We count DISTINCT targets (dedup by target id, or
//  a type|owner|hero|slot key for AoE entries that
//  carry no id) so the same target listed twice is
//  one "target", and every distinct target across
//  both sides is tallied.
//
//  Returning `{ effectNegated: true }` from
//  `postTargetResolve` makes the engine set
//  `gs._spellNegatedByEffect` and abort the Spell
//  with zero targets hit — a full "Negate that
//  Spell" (same mechanism Invisibility Cloak uses).
//
//  The hub auto-handles the prompt, the hand→discard
//  flight, the gold payment (cost 4) and the reveal;
//  Storm Ring is an Artifact so the hub skips the
//  hero-casting check (only gold is required).
//
//  ── Scope: Spells ONLY, not Attacks / Hero effects
//  `sourceCard` is the played card's CardInstance.
//  We require its effective card type to be exactly
//  "Spell" — this excludes Attack cards (type
//  "Attack"), Creature/Artifact effects, and Hero
//  effects whose damage is merely "treated as a
//  Spell" (Alice the Puppeteer Girl: the source is
//  the Hero, not a Spell card). Only an actual Spell
//  card the opponent plays qualifies.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Storm Ring';

module.exports = {
  isPostTargetReaction: true,

  /**
   * Offer Storm Ring iff: the source is the OPPONENT's, it is an
   * actual Spell card, and it will hit 2+ targets for real.
   */
  postTargetCondition(gs, pi, engine, targetedHeroes, sourceCard, _opts) {
    // Opponent's play only ("when your OPPONENT plays a Spell").
    const srcOwner = sourceCard?.controller ?? sourceCard?.owner ?? -1;
    if (srcOwner < 0 || srcOwner === pi) return false;

    // Must be an actual Spell CARD. Effective card data (handles any
    // type override) → fall back to the static DB by name. Excludes
    // Attacks, Creatures, Artifacts, and Hero/ability effects whose
    // damage is only "treated as a Spell".
    const cd = (sourceCard && engine.getEffectiveCardData
      ? engine.getEffectiveCardData(sourceCard)
      : null) || (sourceCard?.name ? engine._getCardDB()[sourceCard.name] : null);
    if (!cd || !hasCardType(cd, 'Spell')) return false;

    // ACTUAL targets, not potential — the hub passes the real
    // post-selection list, UNFILTERED by side. Count DISTINCT targets
    // across BOTH sides: "1 of my targets + 1 of the caster's own =
    // 2 total" must trigger. Dedup by target id; AoE entries have no
    // id, so fall back to a type|owner|hero|slot key. "more than 1
    // target" → 2 or more distinct.
    if (!Array.isArray(targetedHeroes) || targetedHeroes.length < 2) return false;
    const seen = new Set();
    for (const t of targetedHeroes) {
      if (!t) continue;
      const key = (t.id != null)
        ? `id:${t.id}`
        : `${t.type}|${t.owner}|${t.heroIdx}|${t.slotIdx ?? -1}`;
      seen.add(key);
      if (seen.size >= 2) return true;
    }
    return false;
  },

  /**
   * Negate the triggering Spell. The hub propagates `effectNegated`
   * to the spell-resolution sites which set `gs._spellNegatedByEffect`
   * and abort the Spell with no targets hit.
   */
  async postTargetResolve(engine, pi, targetedHeroes, sourceCard, _opts) {
    engine.log('storm_ring_negate', {
      player: engine.gs.players[pi]?.username,
      spell: sourceCard?.name || '?',
      targets: Array.isArray(targetedHeroes) ? targetedHeroes.length : 0,
    });
    return { effectNegated: true };
  },
};
