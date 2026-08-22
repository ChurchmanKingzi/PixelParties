// ═══════════════════════════════════════════════════════════════════
//  SHARED: "Future Tech" — der Archetyp, dessen Ressource die ABLAGE ist
//
//  29 Karten, und fast jede liest denselben Satz: „… so oft, wie
//  <Kartenname> in deiner Ablage liegt". Ein Deck, das sich selbst
//  entsorgt, um stärker zu werden. Dieses Modul hält die Zählung an
//  EINER Stelle — nicht, weil es kürzer wäre, sondern weil zwei
//  spätere Karten sie verbiegen werden:
//
//   • „Future Tech Prototypes" ändert im Discard SEINEN EIGENEN Namen
//     auf den einer beliebigen anderen Karte, bis der Zug endet.
//   • „Future Tech Copy Device" verleiht einer zurückgemischten Karte
//     Name, Kosten und Effekt einer anderen.
//
//  Beide wirken auf die Zählung ALLER anderen Karten. Stünde
//  `discardPile.filter(n => n === X).length` in zwanzig Dateien, wären
//  das zwanzig Fundstellen zum Nachziehen — und mit Sicherheit
//  vergisst man drei. Deshalb geht JEDE Zählung durch
//  `zaehleInAblage()`, schon bevor es die beiden Karten gibt.
//
//  ── ★★★ ALS RULING 21.8.: KEINE KARTE ZAEHLT SICH SELBST MIT ★★★ ──
//  „Karten zählen sich NICHT selbst mit, sie sind im Moment der
//   Auslösung noch in der Hand oder auf dem Feld! Das heißt, mit 0
//   Barrages im Discard wird Future Tech Barrage zu einem Spell, der
//   nichts tut, außer eine Action zu verschwenden und in den Discard
//   zu wandern!"
//
//  Das ist KEIN Randfall, sondern die Bauanleitung des Archetyps:
//
//   • `zaehleInAblage()` liest ausschliesslich, was WIRKLICH in der
//     Ablage liegt. Die ausloesende Karte ist dort noch nicht. Nichts
//     nachrechnen, nichts „+1 fuer mich selbst".
//
//   • **Diese Karten bleiben trotzdem SPIELBAR, wenn ihr Zaehler 0
//     ist.** Das widerspricht der sonstigen Gate-Regel („nie eine
//     Aktion verbrennen lassen, die nichts bewirkt") — hier ist der
//     Leerlauf der ERSTE SCHRITT: die verpuffte Barrage landet in der
//     Ablage und macht die zweite scharf. Wer diese Karten hinter ein
//     `canActivate`/`spellPlayCondition` sperrt, das Kopien in der
//     Ablage verlangt, macht den Archetyp unspielbar. NICHT TUN.
//
//   • Unterschied im Wortlaut, der zaehlt:
//       „Trigger this effect as many times as …"  → GENAU N Mal
//         (Barrage: bei 0 Kopien passiert nichts)
//       „Repeat this effect as many times as …"   → 1 + N Mal
//         (Mech, wie Elven Leader: der Grundtreffer kommt immer)
//
//  ── Datenlage ──
//  `ps.discardPile` und `ps.mainDeck` sind Arrays von KARTENNAMEN
//  (Zeichenketten), keine Instanzen. Ein Namensvergleich ist damit die
//  natürliche Operation; Instanz-Identität gibt es hier nicht.
// ═══════════════════════════════════════════════════════════════════

'use strict';

/** Namenspräfix des Archetyps. */
const FT_PRAEFIX = 'Future Tech';

/**
 * Aliasse, die im Discard aktiv sind — gesetzt von Prototypes/Copy
 * Device. Form:
 *   ps._ftAliase = [{ echt: 'Future Tech Copy Device',
 *                     als: 'Future Tech Mech', turn: 7, basis: 0 }]
 * Ein Alias zählt nur in dem Zug, in dem er gesetzt wurde.
 *
 * ★ `basis` — WIEVIELE Träger lagen beim Setzen schon in der Ablage?
 * (Als Vorgabe 22.8.: „Wird Copy Device als Equip zerstört, soll es bis
 * zum Ende der Runde auch im Discard als seine aktuelle Identität
 * zählen.")
 *
 * Der Alias wird gesetzt, sobald die Identität feststeht — da liegt die
 * Trägerkarte aber je nach Fall noch in der Hand oder gleich auf dem
 * Brett. Zählen darf er erst, wenn sie WIRKLICH in der Ablage
 * angekommen ist. Genau das misst `basis`: der Alias greift, sobald
 * mehr Träger in der Ablage liegen als bei seinem Setzen.
 *
 *  • Einmal-Effekt: basis 0 → der Server legt die Karte ab → 1 > 0,
 *    Alias greift. Während der eigenen Auflösung liegt sie noch in der
 *    Hand, der kopierte Effekt zählt sich also NICHT selbst mit (Als
 *    Ruling im Kopf dieser Datei).
 *  • Ausrüstung auf dem Brett: basis 0, Ablage 0 → Alias schläft.
 *  • Ausrüstung mitten im Zug zerstört: sie fällt in die Ablage,
 *    1 > 0 → Alias greift, ganz ohne einen weiteren Auslöser. Ein
 *    Karten-Hook wäre hier NICHT gegangen: bei geliehener Identität
 *    liest `getHook` die Hooks der KOPIERTEN Karte, ein eigenes
 *    `onCardLeaveZone` wäre überschattet.
 *  • Zweite Kopie liegt schon in der Ablage: basis 1, also greift der
 *    Alias erst beim zweiten Eintrag — die Zählung bleibt exakt.
 */
function aktiveAliase(gs, pi) {
  const ps = gs?.players?.[pi];
  const liste = ps?._ftAliase;
  if (!Array.isArray(liste) || liste.length === 0) return [];
  const ablage = ps.discardPile || [];
  return liste.filter((a) => {
    if (!a || a.turn !== gs.turn) return false;
    if (a.basis == null) return true;               // Altform: wie bisher
    let da = 0;
    for (const k of ablage) if (k === a.echt) da++;
    return da > a.basis;
  });
}

/**
 * Wie viele Träger des Namens `echt` sind gerade umbenannt?
 * Für Anzeige und Zählung — jede Kopie einzeln, nicht der Name als Ganzes.
 */
function aliasAnzahl(gs, pi, echt) {
  return aktiveAliase(gs, pi).filter(a => a.echt === echt).length;
}

/**
 * Wie oft liegt `name` in der Ablage von `pi`?
 *
 * ★ DIE zentrale Funktion des Archetyps. Zählt echte Vorkommen plus
 * aktive Aliasse, und zieht Karten ab, die ihren Namen gerade
 * VERLIEHEN haben (eine umbenannte Prototypes ist für diesen Zug keine
 * Prototypes mehr).
 */
function zaehleInAblage(gs, pi, name) {
  const ps = gs?.players?.[pi];
  if (!ps || !name) return 0;
  let n = (ps.discardPile || []).reduce((s, k) => s + (k === name ? 1 : 0), 0);
  for (const a of aktiveAliase(gs, pi)) {
    if (a.als === name) n++;
    if (a.echt === name) n--;
  }
  return Math.max(0, n);
}

/**
 * Einen Alias in der Ablage EINTRAGEN — die Gegenseite von
 * `aktiveAliase`. Bisher hatte die Liste nur Leser.
 *
 * Gesetzt wird er, sobald die Identität feststeht; wirksam wird er
 * erst, wenn die Trägerkarte in der Ablage ankommt. Den Zeitpunkt
 * regelt `basis` — siehe die Begründung bei `aktiveAliase`.
 *
 * Je Trägerkarte gilt höchstens EIN Alias: ein zweiter Aufruf ersetzt
 * den ersten (Copy Device, das zu Prototypes wurde und sich danach
 * noch einmal umbenennt).
 */
function setzeAblageAlias(gs, pi, echt, als, opts = {}) {
  const ps = gs?.players?.[pi];
  if (!ps || !echt || !als) return;
  if (!Array.isArray(ps._ftAliase)) ps._ftAliase = [];
  let basis = 0;
  for (const k of (ps.discardPile || [])) if (k === echt) basis++;
  // ★ `basisOffset` — für Karten, die beim Setzen SCHON in der Ablage
  //   liegen (Future Tech Prototypes benennt sich von dort aus um).
  //   Ohne `-1` läge die Schwelle über dem Ist-Stand und der eigene
  //   Alias schliefe sofort ein. Copy Device braucht es nicht: die
  //   Karte kommt erst danach dort an.
  basis = Math.max(0, basis + (opts.basisOffset || 0));
  // ★ EIN ALIAS JE TRAEGERKARTE, NICHT JE NAME (Als Befund 22.8.:
  //   „Ich hatte einen Prototype von Anfang an im Discard, bringe einen
  //   zweiten dorthin, aktiviere den zweiten — und jetzt sind BEIDE
  //   Laser Cannons.")
  //
  //   Der Eintrag wurde bisher ueber `echt` ersetzt und gelesen. Damit
  //   galt eine Umbenennung fuer JEDE gleichnamige Karte in der Ablage,
  //   und eine zweite Umbenennung haette die erste ueberschrieben.
  //   Geschluesselt wird jetzt ueber die Instanz.
  const instId = opts.instId ?? null;
  const i = ps._ftAliase.findIndex(a =>
    a && a.echt === echt && a.turn === gs.turn && (a.instId ?? null) === instId);
  // Beim ERSETZEN die alte Basis behalten: die Trägerkarte hat ihren
  // Platz seither nicht gewechselt, und ein Neuzählen würde eine
  // bereits abgelegte Karte fälschlich wieder unter die Schwelle
  // drücken (Copy Device → Prototypes → noch einmal umbenannt).
  if (i >= 0) basis = ps._ftAliase[i].basis ?? basis;
  const eintrag = { echt, als, turn: gs.turn, basis, instId };
  if (i >= 0) ps._ftAliase[i] = eintrag;
  else ps._ftAliase.push(eintrag);
}

/** Alias einer Trägerkarte wieder entfernen (Ablauf am Zugende). */
function loescheAblageAlias(gs, pi, echt, instId = undefined) {
  const ps = gs?.players?.[pi];
  if (!Array.isArray(ps?._ftAliase)) return;
  ps._ftAliase = ps._ftAliase.filter((a) => {
    if (!a || a.echt !== echt || a.turn !== gs.turn) return true;
    // Ohne Instanz-Angabe alle dieses Namens — mit Angabe nur den einen.
    if (instId === undefined) return false;
    return (a.instId ?? null) !== instId;
  });
}

/**
 * Welche Namen in der Ablage von `pi` tragen gerade eine fremde
 * Identität? Form `{ 'Future Tech Copy Device': 'Future Tech Gun' }`.
 *
 * Für die OBERFLÄCHE gedacht: Al will beim Überfahren einer solchen
 * Karte im Discard ihre aktuelle Identität sehen, so wie eine als
 * Equip liegende Kopie das kopierte Bild zeigt (Vorgabe 22.8.).
 * Liest denselben Filter wie die Zählung — was hier auftaucht, zählt
 * auch, und umgekehrt.
 */
function ablageIdentitaeten(gs, pi) {
  // ★ LISTE statt Namenskarte (Als Befund 22.8.): eine Karte
  //   `{ echt: als }` konnte nicht sagen, WIE VIELE Kopien eines Namens
  //   umbenannt sind — der Client markierte alle. Jetzt ein Eintrag je
  //   umbenannter Karte; der Client hakt sie beim Durchlaufen der Liste
  //   einzeln ab.
  return aktiveAliase(gs, pi).map(a => ({ echt: a.echt, als: a.als }));
}

/** Trägt die Karte den Archetyp-Namen? (Präfixregel, deckneutral) */
function istFutureTech(name) {
  return typeof name === 'string' && name.startsWith(FT_PRAEFIX);
}

/**
 * Zahl VERSCHIEDENER „Future Tech"-Namen in der Ablage — die zweite
 * Zählart des Archetyps (Bomb, Doping).
 */
function verschiedeneFutureTechInAblage(gs, pi) {
  const ps = gs?.players?.[pi];
  if (!ps) return 0;
  const namen = new Set();
  for (const k of (ps.discardPile || [])) if (istFutureTech(k)) namen.add(k);
  for (const a of aktiveAliase(gs, pi)) {
    if (istFutureTech(a.als)) namen.add(a.als);
    // Der verliehene Name faellt nur weg, wenn KEINE weitere Kopie
    // gleichen Namens mehr liegt.
    if (istFutureTech(a.echt) && zaehleInAblage(gs, pi, a.echt) === 0) namen.delete(a.echt);
  }
  return namen.size;
}

/**
 * Karten aus dem DECK in die Ablage schicken (Mysterious Core,
 * Iterative Testing). Gibt die tatsächlich verschobenen Namen zurück —
 * der Aufrufer soll nie annehmen, dass alles Gewünschte da war.
 *
 * ★ ALS REGEL 21.8.: JEDE BEWEGUNG VON EINEM STAPEL ZUM ANDEREN WIRD
 *   ANIMIERT. Deshalb laeuft das hier NICHT ueber `splice`/`push`,
 *   sondern ueber `engine.actionMillCards(..., { targetCardName })` —
 *   denselben Weg, den Cute Nerd Magentas Self-Mill nimmt. Der Helfer
 *   laesst die Karte sichtbar vom Deck zur Ablage fliegen, feuert
 *   `onMill` und schreibt das Log. Eine stille Umbuchung sieht im
 *   Spiel aus wie ein Fehler.
 *
 * `selfInflicted: true` umgeht den Erstzug-Schutz (es ist der eigene,
 * freiwillige Effekt), `holdDuration: 0` haelt den Zug nicht an — den
 * Takt macht stattdessen der Versatz zwischen den Karten, damit sie
 * EINE NACH DER ANDEREN fliegen statt uebereinander.
 *
 * Bewusst KEIN Ziehen und kein Mischen: der Kartentext sagt
 * „send … to your discard pile", das ist eine gezielte Entnahme.
 */
const MILL_TAKT_MS = 260;

async function schickeVonDeckInAblage(engine, pi, namen, quelle) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const bewegt = [];
  for (const name of namen) {
    if ((ps.mainDeck || []).indexOf(name) < 0) continue;   // Rennen: Karte ist weg
    const vorher = ps.discardPile.length;
    await engine.actionMillCards(pi, 1, {
      targetCardName: name,
      holdDuration: 0,
      source: quelle || 'Future Tech',
      selfInflicted: true,
    });
    if (ps.discardPile.length > vorher) bewegt.push(name);
    if (namen.length > 1) await engine._delay(MILL_TAKT_MS);
  }
  return bewegt;
}

/**
 * Galerie-Auswahl aus einer Namensliste (Deck oder Ablage).
 * Fasst gleiche Namen zusammen und zeigt die Stückzahl — dieselbe
 * Bauform wie Brilliant Idea.
 *
 * @returns {Promise<string|null>} gewählter Name oder null bei Abbruch
 */
async function waehleAusNamen(engine, pi, namen, config = {}) {
  const anzahl = {};
  for (const n of namen) anzahl[n] = (anzahl[n] || 0) + 1;
  const karten = Object.entries(anzahl)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, count]) => ({ name, source: config.source || 'deck', count }));
  if (karten.length === 0) return null;

  const ergebnis = await engine.promptGeneric(pi, {
    type: 'cardGallery',
    cards: karten,
    title: config.title || FT_PRAEFIX,
    description: config.description || '',
    cancellable: config.cancellable !== false,
  });
  if (!ergebnis || ergebnis.cancelled || !ergebnis.cardName) return null;
  return ergebnis.cardName;
}

module.exports = {
  FT_PRAEFIX,
  zaehleInAblage,
  setzeAblageAlias,
  loescheAblageAlias,
  ablageIdentitaeten,
  aliasAnzahl,
  istFutureTech,
  verschiedeneFutureTechInAblage,
  schickeVonDeckInAblage,
  waehleAusNamen,
};
