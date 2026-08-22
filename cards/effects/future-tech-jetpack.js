// ═══════════════════════════════════════════
//  CARD EFFECT: "Future Tech Jetpack"
//  Artifact (Equipment, Cost 4)
//
//  "Equip this card to a Hero you control. The equipped Hero cannot be
//   chosen or hit by Attacks whose levels are lower than or equal to the
//   number of \"Future Tech Jetpack\" cards in your discard pile."
//
//  ── Der Ausweicher ──
//  Mit leerer Ablage schützt sie gegen NICHTS (Stufe ≤ 0 trifft nur
//  stufenlose Angriffe), mit drei Kopien gegen fast jeden Angriff. Nur
//  gegen ATTACKEN — Zauber und Karteneffekte kommen weiter durch, das
//  ist der Preis gegenüber Escape Device.
//
//  ── „chosen OR hit" sind ZWEI Dinge ──
//  Ein Angriff mit Zielwahl darf den Helden nicht anbieten; ein
//  Flächenangriff wählt gar nicht und muss trotzdem an ihm abprallen.
//  Der Vertrag `blocksTargeting` wird deshalb an drei Stellen gelesen
//  (beide Zielfilter + der Schadenspfad) — die Karte selbst beantwortet
//  nur die Frage „schützt du gegen DIESE Quelle?".
//
//  ── Warum kein Status ──
//  `untargetable` und `invisible` sind pauschal: sie kennen weder
//  Kartentyp noch Stufe der Quelle. Dieser Schutz hängt von beidem ab,
//  also muss die Karte selbst gefragt werden.
//
//  ── Rein passiv ──
//  Kein Auftritt links am Feld (Als Regel 21.8.): die Karte aktiviert
//  sich nicht, sie liegt da und wirkt — wie Angler Angel.
// ═══════════════════════════════════════════

const { zaehleInAblage } = require('./_future-tech-shared');

const CARD_NAME = 'Future Tech Jetpack';

module.exports = {
  activeIn: ['support'],

  /**
   * @param {object} info { heroOwner, heroIdx, sourceData, damageType,
   *                        cardName, chooserIdx }
   */
  blocksTargeting(gs, engine, info) {
    // NUR Attacken. Der Kartentyp entscheidet; ohne Katalogeintrag gibt
    // es keine Stufe und damit keine Entscheidung (Lehre aus Escape
    // Device, 21.8.).
    const src = info?.sourceData;
    if (!src || src.cardType !== 'Attack') return false;

    // Der Schutz gehoert dem Besitzer der Jetpack — das ist der Held,
    // an dem sie haengt.
    const kopien = zaehleInAblage(gs, info.heroOwner, CARD_NAME);
    return (src.level || 0) <= kopien && kopien > 0;
  },
};
