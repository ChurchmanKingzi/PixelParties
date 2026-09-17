// ═══════════════════════════════════════════
//  „PERFORMS AN ACTION" — gemeinsamer Ausloeser (v1157)
//
//  Al 17.9.: Karten mit „Whenever the equipped Hero performs an Action"
//  reagieren auch auf REAKTIONEN, die dieser Held wirkt (z.B.
//  Decapitating Strike).
//
//  Zwei Engine-Kanaele ergeben zusammen die Handlung eines Helden:
//    • `onAnyActionResolved` — jede Aktion aus jedem Aktionspfad,
//      inklusive inhaerenter und Zusatzaktionen; Heldeneffekte nur mit
//      Aktionskosten (Als Ruling 4.8.);
//    • `onReactionResolved`  — eine Hand-/Kettenreaktion, die ein Held
//      gewirkt hat (`engine._rxAufgeloest`). Artefakte und Potions ohne
//      Wirker melden sich dort nicht.
//  Beide liefern `playerIdx`, `heroIdx`, `actionType`, `playedCardName`;
//  der Reaktionskanal zusaetzlich `isReaction: true`.
//
//  `onAnyActionResolved` selbst bleibt reaktionsfrei: Flashbang („first
//  Action"), Bleed und die Aktions-Oekonomie haengen daran.
//
//  Verwendung im Kartenskript:
//    hooks: { ...handlungsHooks(async (ctx) => { … }) }
// ═══════════════════════════════════════════

function handlungsHooks(fn) {
  return { onAnyActionResolved: fn, onReactionResolved: fn };
}

module.exports = { handlungsHooks };
