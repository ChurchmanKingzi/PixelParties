'use strict';
// ═══════════════════════════════════════════
//  GETEILT: „Reveal the top card of your deck … Otherwise, put it on top or bottom of your deck (your choice)." (Als Vorgabe 10.10.)
//
//  Gemeinsamer Unterbau von Sky Archeologist („If it is an Artifact, you may immediately play it without paying its Cost") und Slave Trader
//  („If it is a Creature, immediately summon it as an additional Action with any of your Heroes, if possible"). Die Karten bauen nur ihr
//  „Wenn …" selbst; Aufdecken und „top or bottom" stehen hier EINMAL.
//
//    oberste(engine, pi)                            → Name der obersten Deckkarte | null
//    haltenImZentrum(engine, pi, name, { source })  → Flug Deck → Bildmitte (umgedreht); die Karte BLEIBT dort liegen. Gibt den Halte-Schlüssel zurück
//    gibFrei(engine, pi, key, name, { dest, … })    → die gehaltene Karte fliegt von der Bildmitte weiter (`deck` | `discard` | `deleted` | `hand` | `support` | `ability` | `center`)
//    decke(engine, pi, name, { source, dest, … })   → Flug Deck → Bildmitte (umgedreht) → Ziel in EINEM Zug (ohne Halt); wartet bis zur Landung; Log `hand_card_revealed`
//    obenOderUnten(engine, pi, name, { source })    → Abfrage „oben oder unten?"; legt die Karte bei „unten" unter das Deck. `'top' | 'bottom'`
//
//  ── AUFDECKEN IST KEINE SUCHE ───────────────────────────────────────────
//  Wie bei Pinta/Deepsea Treasure: keine Such-Sperre (`searchLocked`). Die Karte bleibt im Zustand, wo sie ist (oben im Deck), bis die
//  aufrufende Karte sie bewegt; `decke` ändert nichts am Zustand, es zeigt nur das Bild (beide Spieler sehen die Karte aufgedeckt).
//  Ziele des Flugs (`mill_center_reveal`): `'deck'` (zurück), `'hand'`, `'support'` (+ `destHeroIdx`/`destSlotIdx`, auf den Brettplatz).
//
//  ── DIE KARTE BLEIBT IN DER MITTE (Als Vorgabe 10.10.) ──────────────────────────────────────────────
//  „Bei Slave Trader/Archeologist sollte die aufgedeckte Karte, wenn sie nutzbar ist, in der Screen-Mitte verbleiben, bis man entschieden hat, wohin
//  sie beschworen/ob sie aktiviert und ggf. wohin sie equipped werden soll." → `haltenImZentrum` zeigt die Karte (`mill_center_reveal` mit `hold`), während der
//  Spieler wählt (Zone, Ziel, Ja/Nein); erst `gibFrei` (`mill_center_release`, gleicher Schlüssel) schickt sie weiter. Der Zustand ändert sich beim Halten
//  nicht: die Karte liegt im Deck, bis die aufrufende Karte sie bewegt.
//
//  ── „OTHERWISE, PUT IT ON TOP OR BOTTOM" ────────────────────────────────
//  Welche Karten diese Wahl bekommen, entscheidet die AUFRUFENDE Karte (Als Vorgabe 10.10.):
//    • Sky Archeologist: jede aufgedeckte Karte, die nicht gespielt wurde (kein Artifact, unspielbar, abgelehnt mit „Not now", abgebrochen).
//    • Slave Trader: jede aufgedeckte Karte, die nicht beschworen wurde (keine Creature, unbeschwörbar).
//  Unten = ans Ende von `mainDeck` (`engine.moveWithinDeck`), die Sichtbarkeitsmarke der obersten Karte (`deckTopVisible`) fällt dann weg wie bei
//  `reorderDeck`. Die CPU legt eine Karte, die sie für gut hält (Handwert ≥ Durchschnitt des Decks), oben auf; sonst unten.
// ═══════════════════════════════════════════

const REVEAL_MS = 1100;    // Deck → Mitte → Umdrehen → Weiterflug (wie Pinta / Chaos-Diamond)
const HALT_EIN_MS = 800;   // Deck → Mitte → Umdrehen; danach liegt die Karte still
const FREIGABE_MS = 650;   // Mitte → Ziel

function oberste(engine, pi) {
  const ps = engine.gs.players[pi];
  return (ps?.mainDeck || [])[0] || null;
}

async function decke(engine, pi, name, opts = {}) {
  const ps = engine.gs.players[pi];
  const dest = opts.dest || 'deck';
  engine.log('hand_card_revealed', { player: ps?.username, card: name, by: opts.source || null });
  engine.meldeAufgedeckt?.(pi, [name], { zone: 'deck', source: opts.source || null });   // Atta: aufgedeckt aus dem Deck
  engine._broadcastEvent('mill_center_reveal', {
    owner: pi, cardNames: [name], revealMs: REVEAL_MS, dest,
    ...(dest === 'support' ? { destHeroIdx: opts.destHeroIdx, destSlotIdx: opts.destSlotIdx, destSide: opts.destSide } : {}),
  });
  // Zurück ins Deck: erst abwarten, bis die Karte dort liegt; auf den Platz/in die Hand: umgebucht wird genau zur Landung.
  await engine._delay(dest === 'deck' ? REVEAL_MS + 100 : REVEAL_MS);
}

/**
 * Deckt die oberste Karte in der Bildmitte auf und LÄSST SIE DORT LIEGEN (beide Spieler sehen sie). Der Schlüssel gehört zu genau dieser Karte; `gibFrei`
 * schickt sie weiter. Wer die Karte nicht freigibt, behält sie als Bild liegen (der Client räumt sie nach 90 s von selbst ab).
 */
async function haltenImZentrum(engine, pi, name, opts = {}) {
  const ps = engine.gs.players[pi];
  engine._haltZaehler = (engine._haltZaehler || 0) + 1;
  const key = `${pi}-${engine.gs.turn}-${engine._haltZaehler}`;
  engine.log('hand_card_revealed', { player: ps?.username, card: name, by: opts.source || null });
  engine.meldeAufgedeckt?.(pi, [name], { zone: 'deck', source: opts.source || null });   // Atta: aufgedeckt aus dem Deck
  engine._broadcastEvent('mill_center_reveal', {
    owner: pi, cardNames: [name], revealMs: HALT_EIN_MS, dest: 'center', hold: true, holdKey: key,
  });
  await engine._delay(HALT_EIN_MS + 100);
  return key;
}

/**
 * Die gehaltene Karte fliegt von der Bildmitte zum Ziel. `dest`: `'deck'` (zurück), `'discard'` / `'deleted'` (Stapel; der Aufrufer bucht die Karte erst NACH
 * dem Flug um), `'hand'`, `'support'` / `'ability'` (+ `destHeroIdx`/`destSlotIdx`, `destSide` = Brettseite des Platzes; `'ability'` = Ability Zone, Super Fan) oder `'center'` (ausblenden). Wartet, bis die Karte angekommen ist.
 */
async function gibFrei(engine, pi, key, name, opts = {}) {
  const dest = opts.dest || 'deck';
  // Zurück ins Deck: das Aufdecken läuft RÜCKWÄRTS (die Karte dreht sich wieder um) — gleiche Dauer wie das Aufdecken.
  const dauer = dest === 'deck' ? HALT_EIN_MS : FREIGABE_MS;
  engine._broadcastEvent('mill_center_release', {
    owner: pi, holdKey: key, cardName: name, dest, revealMs: dauer,
    ...((dest === 'support' || dest === 'ability') ? { destHeroIdx: opts.destHeroIdx, destSlotIdx: opts.destSlotIdx, destSide: opts.destSide } : {}),
  });
  await engine._delay(dauer + 100);
}

/** CPU: behält eine gute Karte oben, schickt eine schwache nach unten. */
function cpuBehaeltOben(engine, pi, name) {
  const wert = engine._cpuEstimateHandValue;
  if (typeof wert !== 'function') return true;
  try {
    const ps = engine.gs.players[pi];
    const namen = [...new Set(ps.mainDeck || [])];
    if (namen.length === 0) return true;
    const w = (n) => { const v = wert(pi, n); return Number.isFinite(v) ? v : 0; };
    const schnitt = namen.reduce((s, n) => s + w(n), 0) / namen.length;
    return w(name) >= schnitt;
  } catch { return true; }
}

async function obenOderUnten(engine, pi, name, opts = {}) {
  const ps = engine.gs.players[pi];
  const source = opts.source || null;
  const wahl = await engine.promptGeneric(pi, {
    type: 'confirm',
    title: source || 'Top or bottom',
    message: `Put ${name} on top or on the bottom of your deck?`,
    showCard: name,
    confirmLabel: '⬆️ Top of the deck',
    cancelLabel: '⬇️ Bottom of the deck',
    cancellable: true,
    equalButtons: true,
    gerrymanderEligible: false,
    _topOrBottom: true,
  });
  const oben = !!wahl && !wahl.cancelled;
  if (!oben && (ps.mainDeck || [])[0] === name) {
    engine.moveWithinDeck(pi, 0, ps.mainDeck.length);
    if (ps.deckTopVisible && ps.deckTopVisible.length > 0) ps.deckTopVisible.length = 0;
  }
  engine.log('deck_top_or_bottom', { player: ps.username, card: name, bottom: !oben, by: source });
  engine.sync();
  return oben ? 'top' : 'bottom';
}

module.exports = { REVEAL_MS, HALT_EIN_MS, FREIGABE_MS, oberste, haltenImZentrum, gibFrei, decke, obenOderUnten, cpuBehaeltOben };
