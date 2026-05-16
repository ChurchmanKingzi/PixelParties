// ═══════════════════════════════════════════
//  CARD EFFECT: "Diver Helmet"
//  Artifact (Equipment, Cost 4)
//
//  "The equipped Hero and all cards in its Support
//   Zones are unaffected by Areas."
//
//  This is a PURELY PASSIVE equip — it has no
//  hooks/active behaviour of its own. The helmet
//  works by every Area card (and the engine, for
//  engine-level Area rules) consulting
//  `_diver-helmet-shared.js` and skipping any Hero
//  / Creature it protects.
//
//  Equipment placement is driven by the card DB
//  subtype ('Equipment') in server.js
//  `doPlayArtifact`, not by this module, so no
//  placement logic is needed here. `isEquip: true`
//  is declared only so the loader recognises the
//  module (it has no hooks) and treats it as an
//  equip consistently.
//
//  When authoring a NEW Area, see CARD_API.md →
//  "Areas — respect Diver Helmet".
// ═══════════════════════════════════════════

module.exports = {
  isEquip: true,
  activeIn: ['support'],

  // CPU: Diver Helmet is a binary ON/OFF protection toggle, not a
  // stackable stat stick. `protectiveToggleEquip` tells the CPU equip
  // planner (pickHeroForEquip in _cpu.js) to (a) never put a 2nd one on
  // an already-protected Hero, (b) skip playing it entirely when every
  // eligible Hero is already protected, and (c) otherwise send it to
  // the most valuable Hero by the engine's own MCTS hero-value criteria.
  cpuMeta: { protectiveToggleEquip: true },
};
