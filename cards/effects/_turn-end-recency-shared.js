// ═══════════════════════════════════════════
//  SHARED: „… before / since the end of your last turn"
//
//  Zwei Helden lesen dieselbe Zeitmarke mit umgekehrtem Vorzeichen:
//    • Ralzish darf KEINE Creature waehlen, die SEIT dem Ende seiner
//      letzten Runde beschworen wurde  →  turnPlayed >  tick  ist tabu
//    • Heragas darf NUR eine Creature waehlen, die VOR dem Ende seiner
//      letzten Runde beschworen wurde  →  turnPlayed <= tick  ist erlaubt
//
//  Die Marke ist `gs.turn` im Moment des eigenen Rundenendes und wird
//  von JEDEM Helden mit diesem Modul gestempelt (der Wert ist fuer alle
//  derselbe, deshalb ein gemeinsamer Schluessel). Ohne Stempel — noch
//  kein eigenes Rundenende — gilt „zwei Zuege zurueck", aber nie unter
//  0: `turnPlayed = 0` ist die Konvention fuer „lag schon vor
//  Spielbeginn" (Puzzle-Loader) und darf nie als frisch gelten (Als
//  Befund 1.9., Ralzish ohne Creature-Ziele im Puzzle-Editor).
// ═══════════════════════════════════════════

const TICK_KEY = '_lastTurnEndTick';

/** gs.turn am Ende der letzten eigenen Runde des Spielers. */
function lastTurnEndTick(ps, gs) {
  const tick = ps?.[TICK_KEY];
  if (typeof tick === 'number') return tick;
  return Math.max(0, (gs?.turn || 0) - 2);
}

/** Im onTurnEnd des Traegers aufrufen — stempelt nur die eigene Runde. */
function stampTurnEnd(ctx) {
  const controller = ctx.cardController ?? ctx.cardOwner;
  if (ctx.activePlayer !== controller) return;
  const ps = ctx._engine.gs.players[controller];
  if (ps) ps[TICK_KEY] = ctx._engine.gs.turn;
}

/** „summoned since the end of your last turn" */
function summonedSinceLastTurnEnd(inst, ps, gs) {
  return (inst?.turnPlayed || 0) > lastTurnEndTick(ps, gs);
}

/** „summoned before the end of your last turn" */
function summonedBeforeLastTurnEnd(inst, ps, gs) {
  return !summonedSinceLastTurnEnd(inst, ps, gs);
}

module.exports = {
  TICK_KEY,
  lastTurnEndTick,
  stampTurnEnd,
  summonedSinceLastTurnEnd,
  summonedBeforeLastTurnEnd,
};
