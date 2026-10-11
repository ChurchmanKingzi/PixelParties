'use strict';
// ═══════════════════════════════════════════
//  GETEILT: „Reveal the top card of your deck … Otherwise, put it on top or bottom of your deck (your choice)." (Als Vorgabe 10.10.)
//
//  Gemeinsamer Unterbau von Sky Archeologist („If it is an Artifact, you may immediately play it without paying its Cost") und Slave Trader
//  („If it is a Creature, immediately summon it as an additional Action with any of your Heroes, if possible"). Die Karten bauen nur ihr
//  „Wenn …" selbst; Aufdecken und „top or bottom" stehen hier EINMAL.
//
//    oberste(engine, pi)                            → Name der obersten Deckkarte | null
//    decke(engine, pi, name, { source, dest, … })   → Flug Deck → Bildmitte (umgedreht) → Ziel; wartet bis zur Landung; Log `hand_card_revealed`
//    obenOderUnten(engine, pi, name, { source })    → Abfrage „oben oder unten?"; legt die Karte bei „unten" unter das Deck. `'top' | 'bottom'`
//
//  ── AUFDECKEN IST KEINE SUCHE ───────────────────────────────────────────
//  Wie bei Pinta/Deepsea Treasure: keine Such-Sperre (`searchLocked`). Die Karte bleibt im Zustand, wo sie ist (oben im Deck), bis die
//  aufrufende Karte sie bewegt; `decke` ändert nichts am Zustand, es zeigt nur das Bild (beide Spieler sehen die Karte aufgedeckt).
//  Ziele des Flugs (`mill_center_reveal`): `'deck'` (zurück), `'hand'`, `'support'` (+ `destHeroIdx`/`destSlotIdx`, auf den Brettplatz).
//
//  ── „OTHERWISE, PUT IT ON TOP OR BOTTOM" ────────────────────────────────
//  Welche Karten diese Wahl bekommen, entscheidet die AUFRUFENDE Karte (Als Vorgabe 10.10.):
//    • Sky Archeologist: nur Karten, die KEIN Artifact sind. Ein nicht gespieltes Artifact (abgelehnt wie unspielbar) geht ohne Wahl zurück ins Deck.
//    • Slave Trader: jede aufgedeckte Karte, die nicht beschworen wurde (keine Creature, unbeschwörbar).
//  Unten = ans Ende von `mainDeck` (`engine.moveWithinDeck`), die Sichtbarkeitsmarke der obersten Karte (`deckTopVisible`) fällt dann weg wie bei
//  `reorderDeck`. Die CPU legt eine Karte, die sie für gut hält (Handwert ≥ Durchschnitt des Decks), oben auf; sonst unten.
// ═══════════════════════════════════════════

const REVEAL_MS = 1100;    // Deck → Mitte → Umdrehen → Weiterflug (wie Pinta / Chaos-Diamond)

function oberste(engine, pi) {
  const ps = engine.gs.players[pi];
  return (ps?.mainDeck || [])[0] || null;
}

async function decke(engine, pi, name, opts = {}) {
  const ps = engine.gs.players[pi];
  const dest = opts.dest || 'deck';
  engine.log('hand_card_revealed', { player: ps?.username, card: name, by: opts.source || null });
  engine._broadcastEvent('mill_center_reveal', {
    owner: pi, cardNames: [name], revealMs: REVEAL_MS, dest,
    ...(dest === 'support' ? { destHeroIdx: opts.destHeroIdx, destSlotIdx: opts.destSlotIdx } : {}),
  });
  // Zurück ins Deck: erst abwarten, bis die Karte dort liegt; auf den Platz/in die Hand: umgebucht wird genau zur Landung.
  await engine._delay(dest === 'deck' ? REVEAL_MS + 100 : REVEAL_MS);
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

module.exports = { REVEAL_MS, oberste, decke, obenOderUnten, cpuBehaeltOben };
