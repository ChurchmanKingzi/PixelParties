// ═══════════════════════════════════════════
//  GETEILT: EINMAL-PRO-ZUG-SPERRE VON HELDENEFFEKTEN (v1275)
//
//  ★ ALS RULING 22.9. (bindend, zu Pseudonia): „Hero-Effekte, die once
//  per turn sind, sind generell IMMER hard once per turn" — und „once per
//  turn gilt, unless specified otherwise, immer nur pro Spieler".
//
//  Die Sperre haengt deshalb am SPIELER und an der KARTE (ueber einen
//  kartenspezifischen `teil`), nie am Heldenplatz oder an einer
//  Karteninstanz. Nur so teilen sich zwei Traeger desselben Effekts auf
//  einer Seite den einen Ausloeser — der typische Fall: Pseudonia hat den
//  Effekt eines besiegten Verbuendeten aufgenommen, der danach
//  wiederbelebt wird. Im normalen Spiel steht nie ein Name zweimal auf
//  einer Seite; dort verhaelt sich die Sperre wie vorher.
//
//  Die AKTIVEN Heldeneffekte stempelt die Engine selbst
//  (`engine.heroHoptKey(name, pi)`). Diese Datei ist fuer die passiven:
//  Ausloeser, die ein Skript in eigenen Hooks prueft. Waechter:
//  `scripts/check-hero-hopt.js` meldet Heldenskripte, die ihre Sperre
//  wieder an Platz oder Instanz binden.
//
//  Der Stempel ist `gs.turn` (zaehlt je Spielerzug hoch) — damit gilt die
//  Sperre fuer „diesen Zug", egal wessen, und braucht kein Zuruecksetzen.
// ═══════════════════════════════════════════

/** Schluessel der Sperre: `teil` ist kartenspezifisch (z.B. 'alleria_redirect'). */
function heldenSperreKey(teil, pi) {
  return `${teil}:${pi}`;
}

/** Ist die Sperre in diesem Zug noch frei? */
function heldenSperreFrei(gs, teil, pi) {
  return gs?.hoptUsed?.[heldenSperreKey(teil, pi)] !== gs?.turn;
}

/** Sperre fuer diesen Zug belegen. */
function heldenSperreSetzen(gs, teil, pi) {
  if (!gs) return;
  if (!gs.hoptUsed) gs.hoptUsed = {};
  gs.hoptUsed[heldenSperreKey(teil, pi)] = gs.turn;
}

/** Sperre zurueckgeben (Ausloeser wurde abgelehnt oder verpuffte). */
function heldenSperreFreigeben(gs, teil, pi) {
  if (gs?.hoptUsed) delete gs.hoptUsed[heldenSperreKey(teil, pi)];
}

module.exports = {
  heldenSperreKey,
  heldenSperreFrei,
  heldenSperreSetzen,
  heldenSperreFreigeben,
};
