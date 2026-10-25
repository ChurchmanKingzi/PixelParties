'use strict';
// ═══════════════════════════════════════════
//  GEMEINSAMER BAUSTEIN: Mehrfachwahl aus mehreren Quellen mit Quellensperre
//  (CARD_API „Mehrere Quellen = ein Picker mit Herkunfts-Label", 26.10.2026)
//
//  Eine Galerie (`cardGalleryMulti`) zeigt die wählbaren Karten ALLER Quellen, jeder Eintrag mit seinem Herkunfts-Abzeichen (HAND / DECK …). Die Quellenregeln stehen am Prompt:
//    `sourceMax`        Höchstzahl je Quelle, z. B. { hand: 3, deck: 1 }
//    `exclusiveSources` sobald ein Eintrag gewählt ist, sind alle Einträge anderer Quellen ausgegraut („1 aus dem Deck ODER bis zu 3 aus der Hand")
//  Der Client sperrt entsprechend; der Server prüft die Antwort trotzdem noch einmal (Automat, CPU, Puzzle-Standardantwort): nur EINE Quelle, höchstens `sourceMax`.
//
//  Rückgabe `{ source, names, indices }` oder `null` (abgebrochen / nichts gewählt). Gleichnamige Karten aus zwei Quellen sind zwei Einträge — die Quelle gehört zur Wahl.
// ═══════════════════════════════════════════

/**
 * @param {object} engine
 * @param {number} pi
 * @param {object} o  { cards:[{name, source, count?}], maxJeQuelle:{[quelle]:n}, minSelect=1, title, description, confirmLabel, confirmClass, cancellable=true, extra:{} }
 */
async function pickAusQuellen(engine, pi, o) {
  let cards = o.cards || [];
  const maxJeQuelle = o.maxJeQuelle || {};
  if (cards.length === 0) return null;
  // Gerrymander („whenever a card lets your opponent decide between different effects, YOU choose for them"): die Wahl der Quelle IST eine Wahl zwischen verschiedenen Effekten
  // („bis zu 3 aus der Hand" gegen „1 aus dem Deck"). Nur wenn der Gegner eine Gerrymander steuert, gibt es sie als eigene Frage — sie geht an dessen Besitzer; die Galerie zeigt
  // dann nur die gewählte Quelle. Ohne Gerrymander keine Vorfrage (ein Picker).
  const quellen = [...new Set(cards.map(c => c.source))];
  if (o.gerrymanderEligible !== false && quellen.length > 1 && typeof engine._findActiveGerrymander === 'function' && engine._findActiveGerrymander(engine.opponentOf(pi))) {
    const symbol = { hand: '✋', deck: '📚', discard: '♻️' };
    const opt = await engine.promptGeneric(pi, {
      type: 'optionPicker',
      title: o.title,
      description: 'Choose an effect:',
      options: quellen.map(q => ({ id: q, label: (o.optionLabels && o.optionLabels[q]) || `${symbol[q] || ''} Up to ${maxJeQuelle[q] ?? 1} from ${q}` })),
      cancellable: o.cancellable !== false,
      gerrymanderEligible: true,
    });
    if (!opt || opt.cancelled || !opt.optionId) return null;
    cards = cards.filter(c => c.source === opt.optionId);
    if (cards.length === 0) return null;
  }
  const res = await engine.promptGeneric(pi, {
    type: 'cardGalleryMulti',
    cards,
    selectCount: Math.max(1, ...Object.values(maxJeQuelle)),
    minSelect: o.minSelect ?? 1,
    sourceMax: maxJeQuelle,
    exclusiveSources: true,
    title: o.title,
    description: o.description,
    confirmLabel: o.confirmLabel,
    confirmClass: o.confirmClass,
    cancellable: o.cancellable !== false,
    ...(o.extra || {}),
  });
  if (!res || res.cancelled) return null;
  // Antwort auf Galerie-Indizes zurückführen (der Client schickt sie; Automaten nur Namen → erste passende Einträge).
  let idx = Array.isArray(res.selectedIndices) ? res.selectedIndices.filter(i => Number.isInteger(i) && cards[i]) : [];
  if (idx.length === 0) {
    const benutzt = new Set();
    for (const n of (res.selectedCards || [])) {
      const i = cards.findIndex((c, k) => c.name === n && !benutzt.has(k));
      if (i >= 0) { benutzt.add(i); idx.push(i); }
    }
  }
  if (idx.length === 0) return null;
  const quelle = cards[idx[0]].source;
  idx = [...new Set(idx)].filter(i => cards[i].source === quelle).slice(0, maxJeQuelle[quelle] ?? 1);
  return { source: quelle, names: idx.map(i => cards[i].name), indices: idx };
}

module.exports = { pickAusQuellen };
