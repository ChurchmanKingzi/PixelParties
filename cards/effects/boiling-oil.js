// ═══════════════════════════════════════════
//  CARD EFFECT: "Boiling Oil"
//  Spell (Destruction Magic Lv 2, Normal)
//
//  Deal 80 damage to all targets your opponent
//  controls — every alive enemy Hero plus every
//  enemy Creature in any Support Zone.
//
//  Implementation
//  ──────────────
//  • Pure AoE — no targeting prompt, no buffs,
//    no follow-up. `ctx.aoeHit` handles target
//    enumeration, per-target damage application,
//    and per-zone animation broadcasts.
//  • Damage type `destruction_spell` so the hit
//    routes through the standard fire/spell
//    paths (Fireshield reactions, Anti Magic
//    Shield, Smug Coin, etc. all see it as a
//    Spell hit).
//  • Animation: `acid_splash` per target — the
//    closest existing oil-themed animation. Can
//    swap to a dedicated `boiling_oil` overlay
//    later without touching this script.
// ═══════════════════════════════════════════

const CARD_NAME = 'Boiling Oil';

module.exports = {
  hooks: {
    onPlay: async (ctx) => {
      await ctx.aoeHit({
        damage: 80,
        damageType: 'destruction_spell',
        side: 'enemy',
        types: ['hero', 'creature'],
        animationType: 'boiling_oil',
        sourceName: CARD_NAME,
      });
    },
  },
};
