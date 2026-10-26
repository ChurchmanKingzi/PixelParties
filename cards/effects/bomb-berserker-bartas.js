// ═══════════════════════════════════════════
//  CARD EFFECT: "Bomb Berserker Bartas"
//  Hero — When this Hero hits exactly 1 target
//  with a normal Destruction Magic Spell whose
//  original level is lower than this Hero's DM
//  level (+ Performance), you may choose a second
//  target for the Spell to hit afterwards.
//
//  The second cast skips costs but applies all
//  effects including recoil (W75a: je ein Recoil nach
//  JEDEM Schaden, also auch nach dem Zweitwurf — Fire
//  Bolts ruft seinen Recoil selbst direkt nach dem
//  Schaden). Works generically with all current and
//  future Destruction Spells.
//
//  Ausnahmen am Spell-Skript (deklarativ gelesen):
//    neverMultiTarget: true       — Karte darf nie mehr als 1 Ziel treffen (Basketskull)
//    opponentChoosesTarget: true  — der GEGNER waehlt das Ziel (Big Oopsie)
//    fixedTargetCount: true       — die Zahl der Ziele legt der Kartentext fest (Chain Lightning: 3 Ziele, auch wenn nur 1 getroffen wurde) (W75b)
//
//  W75b: das Angebot kommt nur, wenn der Spell im Zweitwurf mindestens ein LEGALES zweites Ziel haette
//  (`engine.zweitwurfHatLegalesZiel`: Trockenlauf der Zielsammlung des Spells — z. B. Frost Breaker braucht ein zweites GEFRORENES Ziel).
//
//  W76a (Al): „exakt 1 Ziel" (Anzahl verschiedener getroffener Ziele laut Wurfprotokoll), das zweite Ziel ist NIE das erste (Ausschluss in ALLEN Zielwählern),
//  der Zweitwurf trifft genau EIN weiteres Ziel. Die Logik liegt im gemeinsamen Baustein `_second-target-shared.js` (Bartas, Grisgar, Andras).
// ═══════════════════════════════════════════

const { zweitzielAngebot } = require('./_second-target-shared');

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
      heldName: 'Bomb Berserker Bartas', kind: 'Spell',
      zauberSchule: 'Destruction Magic', faehigkeit: 'Destruction Magic',
      logTyp: 'bartas_second_cast', logFeld: 'spell',
    }),
  },
};
