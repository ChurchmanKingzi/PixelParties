// ═══════════════════════════════════════════
//  CARD EFFECT: "Cute Wings"
//  Artifact (Equipment, Cost 10)
//
//  "Equip this card to a Hero you control. All Creatures that Hero
//   summons count as 'Cute' Creatures."
//
//  This is a PURELY PASSIVE equip — it has no hooks / active behaviour of
//  its own (same shape as Diver Helmet). The grant is enforced by every
//  consumer reading the shared helper `heroHasCuteWings` in
//  `_cute-shared.js`. Because a Hero summons Creatures into its OWN
//  Support Zones, "Creatures that Hero summons" shows up two ways:
//   • SUMMON-DECISION gates — "would a Creature summoned by THIS Hero
//     count as Cute?" — Cute Princess Mary's "only Cute / Cute ignores
//     level" gate and Army of the Cute's "Cute target" pick both add
//     `|| heroHasCuteWings(engine, pi, heroIdx)`, so a Wings Hero may
//     summon ANY Creature (Mary) / pick ANY Creature (Army caster).
//   • BOARD membership — a Creature occupying a Wings Hero's Support
//     Zone counts as Cute via `isCuteCreatureInst` (the board-side
//     reading; summons land in the summoning Hero's own zone). Consumed
//     by future "Cute Creatures you control" board effects (Cute Crown,
//     Pink Sky).
//
//  Equipment placement is driven by the card DB subtype ('Equipment') in
//  server.js `doPlayArtifact`, not by this module, so no placement logic
//  is needed here. `isEquip: true` is declared so the loader recognises
//  the module (it has no hooks) and treats it as an equip consistently.
//
//  When authoring a NEW card that checks whether a Creature is "Cute",
//  consult the `_cute-shared.js` helpers — never read `cardData.archetype`
//  directly, or the Wings grant is silently ignored.
// ═══════════════════════════════════════════

module.exports = {
  isEquip: true,
  activeIn: ['support'],
};
