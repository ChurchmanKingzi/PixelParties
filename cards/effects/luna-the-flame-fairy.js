// ═══════════════════════════════════════════
//  CARD EFFECT: "Luna, the Flame Fairy"
//  Hero (300 HP, 30 ATK — Destruction Magic + Friendship)
//
//  „This Hero can use the Spell "Firewall" regardless of its level. This
//   Hero's "Firewall" Spells deal 100 additional damage and Burns all
//   targets your opponent controls, not just the attacker."
//
//  ① `canBypassLevelReqForCard` (Princess-Mary-Vertrag) fuer genau
//     „Firewall" — greift beim Setzen der Surprise unter Luna und bei
//     der Aktivierung (`_canHeroActivateSurprise` → heroMeetsLevelReq).
//  ② `firewallModifiers` (v633, Helden-Vertrag, gelesen von firewall.js):
//     +100 Schaden auf den Angreifer und permanenter Burn auf ALLE
//     Ziele des Gegners (lebende Helden + Kreaturen), zusaetzlich zum
//     Angreifer. Gilt nur, wenn Luna lebt (firewall.js prueft).
// ═══════════════════════════════════════════

const CARD_NAME = 'Luna, the Flame Fairy';
const FIREWALL = 'Firewall';

module.exports = {
  activeIn: ['hero'],

  canBypassLevelReqForCard(gs, playerIdx, heroIdx, cardData) {
    return !!cardData && cardData.name === FIREWALL;
  },

  firewallModifiers: { extraDamage: 100, burnAllOpponentTargets: true },
};
