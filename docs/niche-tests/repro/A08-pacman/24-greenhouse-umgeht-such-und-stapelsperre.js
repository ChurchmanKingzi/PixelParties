// A08-24 · Paraseed Greenhouse: die Pflanz-Suche umgeht die Such-Sperre (Cats of the Pharaoh) und wird unter einer Stapelsperre (Knight of Kings [B]) zum reinen Kostenverlust
//
// Kartentext: „You may once per turn discard a card from your hand to search your deck for a "Paraseed" and place it into the free Support Zone of any Hero you control that does not have a "Paraseed" … ."
// Cats of the Pharaoh: „you cannot search or add cards to your hand …" (Skript: `ps.searchLocked = true`, „Draws bleiben frei"); Knight of Kings [B]: „your opponent cannot move cards from their deck or discard pile …"
// Aufbau: Sitz 0 hat die Area Paraseed Greenhouse, zwei Handkarten, zwei Paraseeds im Deck. (a) ohne Sperre; (b) `ps.searchLocked = true` (wie Cats of the Pharaoh sie setzt);
//   (c) Sitz 1 hat Knight of Kings [B] + Rook of Kings [B] + Board of Kings (Stapelsperre gegen Sitz 0, `pileOutAllowed(0,'deck') === false`).
// ★ W5b-B11 (Al, Welle 5): die Such-Sperre gilt bewusst NICHT für Deck-Suchen ohne Hand-Ziel – (b) erwartet jetzt: Paraseed wird gepflanzt. (c) bleibt.
// Erwartung (alt): (b) die Suche ist gesperrt – Area nicht aktivierbar / kein Abwurf / keine Paraseed; (c) dasselbe: weder Abwurf-Kosten noch HOPT-Verbrauch ohne Wirkung (`canActivateAreaEffect` müsste es erkennen).
// Beobachtet: (b) Die Paraseed wird aus dem Deck geholt und eingesetzt. (c) `activateAreaEffect` liefert true, die Handkarte wird abgeworfen (Kosten), die Paraseed bleibt im Deck, das HOPT ist verbraucht.
// Ursache: `canActivateAreaEffect` (paraseed-greenhouse.js ~Z. 195) prüft nur `ps.handLocked`; der Aktivierungsweg `_engine.js activateAreaEffect` (~Z. 42208) liest keine Sperr-Marken (`blockedBySearchLock` /
//   `blockedByPileLock` werden nur an Hand-/Fähigkeits-/Held-Wegen ausgewertet); `pflanzen()` ignoriert das `null` von `deckEntnahme` (return true = „Kosten sind bezahlt").
// Aufruf: node docs/niche-tests/repro/A08-pacman/24-greenhouse-umgeht-such-und-stapelsperre.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const F = H.INERT.filler;
  async function lauf(lock) {
    const t = await H.fresh({ hand: [[F, F], []], deck: [['Paraseed', 'Paraseed', F, F, F], [F, F, F, F]] });
    t.putArea(0, 'Paraseed Greenhouse');
    if (lock === 'Knight of Kings') { t.put(1, 0, 0, 'Knight of Kings [B]').turnPlayed = 1; t.put(1, 0, 1, 'Rook of Kings [B]').turnPlayed = 1; t.putArea(1, 'Board of Kings'); }
    if (lock === 'searchLocked') t.gs.players[0].searchLocked = true;
    t.gs.activePlayer = 0; t.phase(2);
    t.reset();
    t.script.push({ match: d => d && /forceDiscard/.test(d.type), answer: () => ({ cardName: t.pile(0, 'hand')[0], handIndex: 0 }) });
    const handVorher = t.pile(0, 'hand').length, deckPara = t.pile(0, 'mainDeck').filter(n => n === 'Paraseed').length;
    await t.run(() => t.engine.activateAreaEffect(0, 0, 'Paraseed Greenhouse'));
    return {
      abgeworfen: handVorher - t.pile(0, 'hand').length,
      gepflanzt: deckPara - t.pile(0, 'mainDeck').filter(n => n === 'Paraseed').length,
      hopt: t.gs.hoptUsed && t.gs.hoptUsed['area-effect:Paraseed Greenhouse:0'] === t.gs.turn,
      err: t.errors.length,
    };
  }
  const a = await lauf('keine');
  R.note('(a) ohne Sperre', JSON.stringify(a));
  R.check('(a) ohne Sperre: 1 abgeworfen, 1 Paraseed gepflanzt', a.abgeworfen === 1 && a.gepflanzt === 1, a);
  const b = await lauf('searchLocked');
  R.note('(b) Such-Sperre', JSON.stringify(b));
  R.check('(b) Such-Sperre: Paraseed wird trotzdem gepflanzt (W5b-B11: bewusst, kein Hand-Ziel)', b.gepflanzt === 1 && b.abgeworfen === 1, b);
  const c = await lauf('Knight of Kings');
  R.note('(c) Stapelsperre', JSON.stringify(c));
  R.check('(c) Stapelsperre: nichts abgeworfen und kein HOPT verbraucht', c.abgeworfen === 0 && !c.hopt, c);
  // (d) Gleiche Wurzel bei Crystal Well: unter der Zieh-Sperre (Sacred Jewel, `ps.drawLocked`) wird die Karte verschenkt, ohne dass gezogen wird
  {
    const t = await H.fresh({ hand: [[F, F], []], deck: [Array(4).fill(F), Array(3).fill(F)] });
    t.putArea(0, 'Crystal Well');
    t.gs.players[0].drawLocked = true;
    t.gs.activePlayer = 0; t.phase(2); t.reset();
    t.script.push({ match: d => d && d.type === 'pickHandCard', answer: (d) => ({ handIndex: d.eligibleIndices[0], cardName: t.pile(0, 'hand')[d.eligibleIndices[0]] }) });
    await t.run(() => t.engine.activateAreaEffect(0, 0, 'Crystal Well'));
    const verschenkt = 2 - t.pile(0, 'hand').length;   // Hand 2 -> 1 und nichts gezogen
    R.note('(d) Crystal Well unter Zieh-Sperre', JSON.stringify({ hand0: t.pile(0, 'hand').length, hand1: t.pile(1, 'hand').length }));
    // ★ ENTSCHIEDEN (Al, Welle 3 / D1): Karte-geben ist eigenständig – die Aktivierung bleibt unter der Zieh-Sperre möglich, nur das Ziehen verpufft.
    R.check('(d) Crystal Well unter Zieh-Sperre: Mischeffekt bleibt aktivierbar (Karte wird gegeben, nichts gezogen)', verschenkt === 1 && t.pile(1, 'hand').length === 1, { hand0: t.pile(0, 'hand').length, hand1: t.pile(1, 'hand').length });
  }
  R.check('keine Engine-Fehler', a.err + b.err + c.err === 0);
  R.finish();
})();
