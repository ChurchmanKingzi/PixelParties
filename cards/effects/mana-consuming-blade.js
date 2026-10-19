// ═══════════════════════════════════════════
//  CARD EFFECT: „Mana-Consuming Blade"
//  Artifact (Equipment)
//
//  „Equip this card to a Hero you control. The equipped Hero's Attack
//   stat is increased by 10. Additionally, the equipped Hero is
//   unaffected by the effects of all Mana Spells."
//
//  ① +10 ATK ueber `grantAtk` / `revokeAtk` (Bauform Blade of the Swamp
//    Witch). W16e (F02-01): das Skript trug bisher nur die Seitenbindung —
//    der ATK-Bonus fehlte ganz.
//  ② „Mana Spells" — Namensregel (Teilstring im Kartennamen, wie „Aquatic"):
//    im Kartenpool ist das nur „Mana Beacon", und dessen Wirkung trifft
//    keinen Helden (Karten abwerfen, Pollution Tokens entfernen, Zusatzaktion
//    fuer den Zaubernden). Es gibt also nichts, wovon der Traeger
//    auszunehmen waere; kommt ein Mana-Zauber mit Heldenwirkung hinzu,
//    gehoert die Ausnahme in seine Heldenwirkung ueber diese Karte.
// ═══════════════════════════════════════════

const ATK_BONUS = 10;

module.exports = {
  isEquip: true,
  equipOwnSideOnly: true,
  activeIn: ['support'],

  hooks: {
    onPlay: (ctx) => {
      ctx.grantAtk(ATK_BONUS);
    },

    onGameStart: (ctx) => {
      if ((ctx.card.counters.atkGranted || 0) > 0) return;
      ctx.grantAtk(ATK_BONUS);
    },

    onCardLeaveZone: (ctx) => {
      if (ctx.fromZone !== 'support') return;
      if ((ctx.fromOwner !== ctx.cardOwner && ctx.fromOwner !== ctx.cardHeroOwner) || ctx.fromHeroIdx !== ctx.card.heroIdx || ctx.fromZoneSlot !== ctx.card.zoneSlot) return;   // Styx 28.9.: Brettseite
      ctx.revokeAtk();
    },
  },
};
