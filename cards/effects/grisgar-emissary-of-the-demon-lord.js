// ═══════════════════════════════════════════
//  CARD EFFECT: "Grisgar, Emissary of the Demon Lord"
//  Hero — Decay-Magic mirror of Bomb Berserker
//  Bartas. When this Hero hits exactly 1 target
//  with a Normal Decay Magic Spell whose level is
//  lower than this Hero's Decay Magic level, the
//  controller may choose a second target for the
//  Spell to hit afterwards.
//
//  Re-cast skips costs but re-runs onPlay, so all
//  on-hit effects (status applications, recoil,
//  follow-ups) compose naturally with any current
//  or future Decay Magic Spell.
//
//  Reuses the engine's existing second-cast plumbing:
//    • `gs._bartasSecondCast` — historical name, but
//      it's the *generic* second-cast flag the engine
//      and other cards already key off of (see the
//      "Shared flag" note in andras-the-human-weapon
//      .js, and the `isSecondCast` read in server.js
//      :3384 + engine.js:8283). Sharing it means
//      Fire Bolts' second-cast clause, Victory Phoenix
//      Cannon's recoil cleanup, etc. all work for
//      Grisgar with zero new wiring.
//    • `gs._spellExcludeTargets` — the engine's per-
//      spell "don't re-pick this target" list, also
//      shared with Bartas / Andras.
// ═══════════════════════════════════════════
//
//  W76a (Al): die Prüfungen (exakt 1 Ziel, Spell-Merkmale `neverMultiTarget` / `opponentChoosesTarget` / `fixedTargetCount`, Vorabprüfung
//  „legales zweites Ziel", Ausschluss des ersten Ziels in ALLEN Zielwählern, Einzelziel-Zweitwurf) liegen im gemeinsamen Baustein
//  `_second-target-shared.js` (wie Bartas und Andras).
// ═══════════════════════════════════════════

const { zweitzielAngebot } = require('./_second-target-shared');

const CARD_NAME = 'Grisgar, Emissary of the Demon Lord';

module.exports = {
  // CPU: confirm this Hero's beneficial "you may" prompt — the default brain
  // declines cancellable confirms raised outside a card-cast (afterSpell
  // trigger), which would otherwise make the second-cast a no-op for the CPU.
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
      heldName: CARD_NAME, kind: 'Spell',
      zauberSchule: 'Decay Magic', faehigkeit: 'Decay Magic',
      logTyp: 'grisgar_second_cast', logFeld: 'spell',
    }),
  },
};
