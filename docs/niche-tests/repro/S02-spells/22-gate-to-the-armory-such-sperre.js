'use strict';
// S02-22 · Gate to the Armory ignoriert die Such-Sperre (Deck-Suche und Hand-Zugang)
// Gate: „Choose an Artifact from your deck or discard pile and add it to your hand."
// Regel (CARD_API.md „Such-Sperre"/`_engine.js` ~Z. 10618–10660): `searchLocked` sperrt Suchen und Adds (Deck), `searchLockedIncludesDiscard` zusätzlich die Ablage; `handLocked` sperrt „ALLES: Draws UND Suchen/Tutoren/Adds".
// Aufbau: Deck [Glass Sword, Gravedigger's Shovel, Füllkarten], Ablage [ZZ Trinket]; (a) `ps.searchLocked = true`, (b) `searchLocked` + `searchLockedIncludesDiscard`, (c) `handLocked`.
// Erwartet: (a) die Galerie bietet KEINE Deck-Einträge an (nur die Ablage); (b)/(c) nichts wählbar (Karte nicht spielbar bzw. kein Add).
// Beobachtet: in (a), (b) und (c) bietet Gate Deck- und Ablage-Einträge an und legt den Artifact auf die Hand/rüstet ihn aus.
// Ursache: `gate-to-the-armory.js` Z. 52–72 (`_getEligibleArtifacts`) liest `ps.mainDeck`/`ps.discardPile` ohne `searchLockLevel`/`pileOutAllowed`; Z. 267–270 `sourcePile.splice`; kein `blockedBySearchLock` (Loader-Erkennung greift nicht, Karte hat zwei Zweige: Add oder Ausrüsten).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const [lock, setze] of [['searchLocked', (ps) => { ps.searchLocked = true; }], ['searchLocked + IncludesDiscard', (ps) => { ps.searchLocked = true; ps.searchLockedIncludesDiscard = true; }], ['handLocked', (ps) => { ps.handLocked = true; }]]) {
    const t = await H.fresh({ hand: [['Gate to the Armory', H.INERT.filler], []], deck: [['Glass Sword', "Gravedigger's Shovel", H.INERT.filler, H.INERT.filler], []], discard: [[H.INERT.artifact], []] });
    setze(t.gs.players[0]);
    let angebot = null;
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Gate to the Armory', answer: (d) => { angebot = d.cards.map(c => c.name + '/' + c.source); const c = d.cards[0]; return { cardName: c.name, source: c.source }; } });
    t.script.push({ match: d => d.type === 'confirm', answer: () => null });
    const r = await t.play(0, 'Gate to the Armory', { hero: 0 });
    const ps = t.gs.players[0];
    const ausDeck = (angebot || []).some(x => x.endsWith('/deck'));
    const ausAblage = (angebot || []).some(x => x.endsWith('/discard'));
    R.note(lock, `play ${r}, Angebot ${JSON.stringify(angebot)}, Deck ${ps.mainDeck.length}, Hand ${JSON.stringify(ps.hand)}`);
    if (lock === 'searchLocked') R.check('(a) Deck-Einträge werden nicht angeboten', !ausDeck, angebot);
    else R.check(`(${lock === 'handLocked' ? 'c' : 'b'}) ${lock}: nichts wählbar (nicht spielbar bzw. kein Angebot)`, r === false || angebot === null, { r, angebot });
  }
  R.finish();
})();
