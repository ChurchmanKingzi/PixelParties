// ═══════════════════════════════════════════
//  CREATURE: "Bonded Companion Mellvy"
//
//  Gemeinsame Saetze: `_bonded-companions-shared.js`. Eigener Satz:
//
//    „Once per turn, when the corresponding Hero performs an Action,
//     draw a card from your Potion Deck."
//
//  „the corresponding Hero" = der Held der eigenen Spalte, also
//  `ctx.heroIdx === ctx.cardHeroIdx`.
//
//  ★ v1326: der Ablauf (Einmal pro Runde, Auftritt, Zwischenstand vor
//  dem Zug, Potion-Zug, Log) liegt jetzt im geteilten Modul
//  `_potion-draw-trigger-shared.js` — „The Brewer's Blade" traegt
//  denselben Satz mit Attack statt Action. Dabei zwei Luecken
//  geschlossen: bei gesperrtem Ziehen loeste Mellvy aus und verbrauchte
//  die Nutzung, obwohl nichts kam; und ihre Logzeile hatte keinen
//  Formatierer im Client (unsichtbar).
// ═══════════════════════════════════════════

const { companion, companionGlow } = require('./_bonded-companions-shared');
const { potionZugBeiHandlung } = require('./_potion-draw-trigger-shared');

const CARD_NAME = 'Bonded Companion Mellvy';

module.exports = companion({
  name: CARD_NAME,
  eigeneHooks: {
    // v1157: auch Reaktionen dieses Helden (`_action-shared.js`)
    ...potionZugBeiHandlung({
      name: CARD_NAME,
      useKey: 'mellvyPotion',          // unveraendert — laufende Spiele behalten ihren Stand
      held: (ctx) => ({ owner: ctx.cardOwner, heroIdx: ctx.cardHeroIdx }),
      anlass: 'Action',
      glow: (engine, inst) => companionGlow(engine, inst),
    }),
  },
});
