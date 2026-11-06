// ═══════════════════════════════════════════
//  CARD EFFECT: "Andras, the Human Weapon"
//  Hero — 400 HP, 80 ATK — BANNED
//  Starting abilities: Fighting, Resistance
//
//  When this Hero hits exactly 1 target with a
//  normal Attack whose original level is lower
//  than this Hero's Fighting level, you may
//  choose a second target for the Attack to hit
//  afterwards.
//
//  Mirrors Bomb Berserker Bartas exactly, but
//  for Attacks instead of Destruction Magic Spells:
//  - Checks cardType 'Attack' + subtype 'Normal'
//  - Level check against Fighting level (via
//    engine.countAbilitiesForSchool, which
//    includes Performance wildcards)
//  - Re-runs onPlay on a temporary instance with
//    _bartasSecondCast = true and the first
//    target excluded
//
//  W76a (Al): die Prüfungen (exakt 1 Ziel, Attack-Merkmale `neverMultiTarget` / `opponentChoosesTarget` / `fixedTargetCount`, Vorabprüfung
//  „legales zweites Ziel", Ausschluss des ersten Ziels in ALLEN Zielwählern, Einzelziel-Zweitschlag) liegen im gemeinsamen Baustein
//  `_second-target-shared.js` (wie Bartas und Grisgar).
// ═══════════════════════════════════════════

const { zweitzielAngebot } = require('./_second-target-shared');

const CARD_NAME = 'Andras, the Human Weapon';

module.exports = {
  // W80a: deklarativ fuer die CPU-Bilanz (Monia): dieser Held darf nach einem Treffer auf genau 1 Ziel einen Zweitwurf anbieten (`_kreaturen-bilanz.js` `zweitwurfChance`).
  zusatzziel: { kind: 'Attack', faehigkeit: 'Fighting' },
  // CPU: confirm this Hero's beneficial "you may" prompt — the default brain
  // declines cancellable confirms raised outside a card-cast (afterSpell
  // trigger), which would otherwise make the second-hit a no-op for the CPU.
  // (The prompt title must equal the card name for this lookup.)
  cpuResponse(engine, kind, promptData) {
    // KEINE !showCard-Bedingung: promptConfirmEffect defaultet showCard
    // inzwischen IMMER auf den Kartennamen — die alte Bedingung war nie
    // erfüllt und der Confirm wurde still declined (Barker-Bugklasse).
    if (promptData?.type === 'confirm') return { confirmed: true };
    return undefined;
  },
  activeIn: ['hero'],

  hooks: {
    afterSpellResolved: (ctx) => zweitzielAngebot(ctx, {
      heldName: CARD_NAME, kind: 'Attack',
      faehigkeit: 'Fighting',
      logTyp: 'andras_second_hit', logFeld: 'attack',
    }),
  },
};
