'use strict';
// ═══════════════════════════════════════════════════════════════════
//  PFADWAHL — „ist genau EIN Pfad frei, wird automatisch dieser genommen"
//
//  Spielgestalter-Entscheidung 18.11.2026 (allgemeine Regel): Bietet eine Karte oder ein Effekt mehrere alternative Pfade an (Modus A oder B; Quelle Hand/Deck/Ablage;
//  Ziel Hand/Deck/Ablage; „choose one"-Optionen) und verbieten Sperren (Stab-Sperre/Ablage-Ausgang, `handLocked`, `drawLocked`, `searchLocked`, Knight of Kings [B],
//  Tuscan Artist, Gold-/Beschwörungs-/Aktionssperren …) einzelne Pfade, dann gilt:
//    • GENAU EIN Pfad frei  → er wird automatisch genommen, ohne Menü und ohne Abfrage (der folgende Prompt darf höchstens einen kurzen Hinweis tragen, z. B. „You cannot
//      draw cards right now, so you will not draw." wie bei Meditation unter der Stab-Sperre);
//    • MEHRERE Pfade frei   → unverändert die Auswahl, aber nur unter den freien Pfaden (ein gesperrter Pfad ist nie wählbar);
//    • KEIN Pfad frei       → unverändert (Karte nicht spielbar bzw. wie bisher, der Effekt tut nichts).
//  Nicht gemeint: ein Pfad, der laut Kartentext nur eine Zusatzoption ist („you may …", Ja/Nein) — dort bleibt die Abfrage; und das Warnungsprinzip (nutzlose Ziele/
//  Aktivierungen bleiben wählbar, `engine._nutzlosHinweis`) — das ist eine andere Regel.
//
//  Nutzung (Kartenskripte, die Pfadliste mit lazy `offen`-Prüfungen):
//
//    const { waehlePfad, ablageAusgangGesperrt } = require('./_pfad-shared');
//    const pfade = [
//      { id: 'sacrifice', label: '…', offen: pawnsOnBoard(engine, pi).length > 0 },
//      { id: 'delete',    label: '…', offen: !ablageAusgangGesperrt(engine, pi) && hatPawnInAblage },
//    ];
//    const w = await waehlePfad(engine, pi, pfade, { title: CARD_NAME, description: 'Choose one:', cancellable: true });
//    if (w.keiner) …;  if (w.abgebrochen) …;  w.id / w.automatisch
//
//  Gesperrte Pfade werden NICHT im Menü gezeigt (nur die freien); der CPU-Antwortweg (`cpuResponse` der Karte) bleibt unverändert — wählt er eine Kennung, die nicht angeboten
//  wurde, nimmt der Baustein den ersten freien Pfad. Bei einem einzigen freien Pfad gibt es gar keine Abfrage, die CPU/MCTS bekommt also nie einen hängenden Prompt.
// ═══════════════════════════════════════════════════════════════════

/** `offen` darf ein Wahrheitswert oder eine Funktion sein; fehlt es, gilt der Pfad als frei. */
const istFrei = (p) => !!p && (typeof p.offen === 'function' ? !!p.offen() : p.offen !== false);

/** Alle freien Pfade, in der Reihenfolge der Liste. */
function freiePfade(pfade) {
  return (pfade || []).filter(istFrei);
}

/** Genau ein freier Pfad → dieser Pfad, sonst `null` (kein oder mehrere freie). */
function einzigerFreierPfad(pfade) {
  const frei = freiePfade(pfade);
  return frei.length === 1 ? frei[0] : null;
}

/**
 * Pfad wählen nach der Regel oben.
 * @param {object} engine
 * @param {number} pi  der Entscheidende (bei „der Gegner entscheidet" der Gegner)
 * @param {Array<{id:string, label?:string, description?:string, color?:string, offen?:boolean|Function}>} pfade
 * @param {object} [prompt]  Felder des optionPicker-Prompts (title, description, cancellable, gerrymanderEligible …)
 * @returns {Promise<{id:string|null, automatisch?:boolean, keiner?:boolean, abgebrochen?:boolean, frei:Array}>}
 *   `keiner`: kein Pfad frei (kein Prompt gestellt); `automatisch`: genau ein Pfad frei (kein Prompt gestellt); `abgebrochen`: der Spieler hat das Menü abgebrochen.
 */
async function waehlePfad(engine, pi, pfade, prompt = {}) {
  const frei = freiePfade(pfade);
  if (frei.length === 0) return { id: null, keiner: true, frei };
  if (frei.length === 1) return { id: frei[0].id, automatisch: true, frei };
  const antwort = await engine.promptGeneric(pi, {
    type: 'optionPicker',
    ...prompt,
    options: frei.map(({ id, label, description, color }) => ({
      id, label,
      ...(description !== undefined ? { description } : {}),
      ...(color !== undefined ? { color } : {}),
    })),
  });
  if (!antwort || antwort.cancelled) return { id: null, abgebrochen: true, frei };
  const gewaehlt = antwort.optionId ?? antwort.id;
  return { id: frei.some(p => p.id === gewaehlt) ? gewaehlt : frei[0].id, frei };
}

// ── Bausteine für die häufigsten Sperren (eine Auslegungsstelle statt je Karte eine eigene Fassung) ──

/**
 * Kann `pi` gerade keine Karten aus der Ablage bewegen? Ablage-Ausgangssperre dieses Zuges (Staff of the Teleporter/Uncontrollable Destruction, „cannot move any cards out of
 * your discard pile"; The Eye of Ren, wenn die Zusatzkosten nicht bezahlt wurden — Spielgestalter-Entscheidung 18.11.2026: auch die Eye-Sperre ist hart, kein Freikauf) oder
 * Knight of Kings [B]. `opts.sourceOwner`: wer bewegt (Standard: `pi`).
 */
function ablageAusgangGesperrt(engine, pi, opts = {}) {
  if (!engine?.gs?.players?.[pi]) return false;
  if (typeof engine.pileOutAllowed === 'function' && !engine.pileOutAllowed(pi, 'discard', { sourceOwner: opts.sourceOwner ?? pi })) return true;
  return !!engine.isDiscardOutHardLocked?.(pi);
}

/** Kann `pi` gerade keine Karten aus dem Deck bewegen? (Knight of Kings [B]; Ziehen zählt hier nicht.) */
function deckAusgangGesperrt(engine, pi, opts = {}) {
  if (!engine || engine.gs?.players?.[pi] == null) return false;
  return typeof engine.pileOutAllowed === 'function' && !engine.pileOutAllowed(pi, 'deck', { sourceOwner: opts.sourceOwner ?? pi });
}

/** Wäre ein Zug von `menge` Karten für `pi` gerade ganz wirkungslos? (Hand-/Zieh-Sperre, Tuscan Artist bei genau 2/3.) */
function ziehenGesperrt(engine, pi, menge) {
  return require('./_draw-block-shared').drawBlockedFor(engine, pi, menge);
}

module.exports = {
  freiePfade,
  einzigerFreierPfad,
  waehlePfad,
  ablageAusgangGesperrt,
  deckAusgangGesperrt,
  ziehenGesperrt,
};
