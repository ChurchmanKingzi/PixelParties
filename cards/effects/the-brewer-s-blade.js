// ═══════════════════════════════════════════
//  CARD EFFECT: „The Brewer's Blade"
//  Artifact (Equipment, 12 Gold — v1326, vorher 24)
//
//  „Equip this card to a Hero you control. Once per turn, when the
//   equipped Hero performs an Attack, draw 1 card from your Potion
//   Deck."
//
//  ── BAUFORM ─────────────────────────────────────────────────────
//  Der Ablauf „Handlung → Einmal pro Runde → Potion-Zug" ist derselbe
//  wie bei „Bonded Companion Mellvy" und liegt deshalb im geteilten
//  Modul `_potion-draw-trigger-shared.js`. Diese Datei sagt nur noch:
//    • WER handelt   — der ausgeruestete Held;
//    • WAS zaehlt    — eine Attack.
//
//  ── AUSLEGUNG ───────────────────────────────────────────────────
//  • „performs an Attack" umfasst jeden Weg, auf dem der Held eine
//    Attack ausfuehrt: Hauptaktion, Zusatzaktion, inhaerente Aktion
//    (Quick Attack) und Attacks, die er als REAKTION spielt (Decapitating
//    Strike) — Als Vorgabe 17.9. zu „performs", `handlungsHooks`.
//  • Blosses „Once per turn" = SOFT, je Instanz (Wortlaut-Regel v249):
//    zwei Klingen an zwei Helden ziehen je einmal. Frisch in jeder
//    Runde, also auch in der des Gegners (Reaktions-Attacks).
//  • Kein Ausloesen bei leerem Potion Deck oder gesperrtem Ziehen —
//    die Nutzung bleibt dann fuer eine spaetere Attack erhalten.
//  • An einem toten Helden wirkt Ausruestung nicht
//    (`isCardEffectActive`), das prueft die Engine zentral.
//  • „Equip this card to a Hero you control" — Seitenbindung ueber
//    `equipOwnSideOnly` (Al, 5.9.: der Kartentext ist bindend).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { potionZugBeiHandlung } = require('./_potion-draw-trigger-shared');

const CARD_NAME = "The Brewer's Blade";

/** Der ausgeruestete Held als {owner, heroIdx} — nur, solange die Klinge wirklich haengt. */
function ausgeruesteterHeld(ctx) {
  const inst = ctx.card;
  if (!inst || inst.zone !== 'support') return null;
  if (inst.heroIdx == null || inst.heroIdx < 0) return null;
  return { owner: ctx.cardHeroOwner ?? inst.controller ?? inst.owner, heroIdx: inst.heroIdx };
}

/** Ist die gerade ausgefuehrte Handlung eine Attack? */
function istAttack(ctx) {
  if (ctx.actionType === 'attack') return true;
  const cd = ctx._engine?._getCardDB?.()?.[ctx.playedCardName];
  return !!cd && hasCardType(cd, 'Attack');
}

module.exports = {
  isEquip: true,
  equipOwnSideOnly: true,
  activeIn: ['support'],

  hooks: {
    ...potionZugBeiHandlung({
      name: CARD_NAME,
      useKey: 'brewersBladePotion',
      held: ausgeruesteterHeld,
      passt: istAttack,
      anlass: 'Attack',
    }),
  },
};
