'use strict';
// F03-artifacts-16 · Wheels und die Stäbe (Teleporter, Uncontrollable Destruction) sind unter einer Zieh-/Handsperre spielbar – Kosten fallen an, gezogen wird nichts
// Kartentext: „Draw 3 cards and discard 1 OR draw 4 cards and delete 2 cards from your hand. You can only play 1 "Wheels" per turn."
// Regel (CARD_API.md Z. ~15760 / _draw-block-shared.js Kopf): ist das Ziehen der einzige Nutzen, ist die Karte unter der Sperre unspielbar (ausgegraut), "auch wenn dafür Kosten anfallen";
//   die Hand-Sperren-Staffel (`blockedByHandLock`/`blockedByDrawLock`) wird beim Laden nur für reine Zieh-Karten automatisch gesetzt – Wheels hat keine der Marken (Loader: `{}`).
// Aufbau: Sitz 0 spielt in demselben Zug erst The Sacred Jewel (Ja ⇒ beide ziehen, danach `drawLocked`) bzw. Staff of the Teleporter (⇒ `handLocked`), dann Wheels.
// Erwartung: Wheels ist unspielbar (Karte bleibt auf der Hand, kein Gold weg, nichts abgelegt/gelöscht). Alternativ: die Karte darf nur die Optionen anbieten, die ziehen können.
// Beobachtet (✗): Wheels wird gespielt: −10 Gold, 1 Karte abgelegt (Draw 3) bzw. 2 Karten GELÖSCHT (Draw 4), 0 Karten gezogen. Nach dem Jewel mischt der Teleporter die ganze Hand ins Deck bzw.
//   wirft Uncontrollable Destruction sie komplett ab – beide ziehen nichts nach (Hand 0).
// Ursache: `cards/effects/wheels.js` – kein `blockedByDrawLock`/`blockedByHandLock`; `wheelsOptionen` (Z. ~25) filtert nur Tuscan Artist, nicht `ps.drawLocked`/`ps.handLocked`;
//   `actionDrawCards` kehrt unter der Sperre still zurück, danach läuft `actionPromptForceDiscard` trotzdem.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const [label, sperrKarte, wahl] of [['Sacred Jewel (drawLocked), Draw 4/Delete 2', 'The Sacred Jewel', 'draw4'], ['Sacred Jewel (drawLocked), Draw 3/Discard 1', 'The Sacred Jewel', 'draw3'], ['Staff of the Teleporter (handLocked)', 'Staff of the Teleporter', 'draw4']]) {
    const t = await H.fresh({ hand: [[sperrKarte, 'Wheels', 'Bird', 'Bird', 'Bird'], []], deckSize: 20, gold: 100 });
    t.script.push({ match: d => d.type === 'handPick' && d.title === 'Staff of the Teleporter', answer: () => ({ selectedCards: [] }), once: false });
    t.script.push({ match: d => d.type === 'confirm' && d.title === 'The Sacred Jewel', answer: () => ({ confirmed: true }), once: false });
    t.script.push({ match: d => d.type === 'optionPicker' && d.title === 'Wheels', answer: (d) => ({ optionId: (d.options || []).some(o => o.id === wahl) ? wahl : (d.options || [])[0]?.id }), once: false });
    await t.play(0, sperrKarte);
    const vor = { hand: t.pile(0, 'hand').length, gold: t.gs.players[0].gold, del: t.pile(0, 'deletedPile').length, disc: t.pile(0, 'discardPile').length };
    const r = await t.play(0, 'Wheels');
    const nach = { hand: t.pile(0, 'hand').length, gold: t.gs.players[0].gold, del: t.pile(0, 'deletedPile').length, disc: t.pile(0, 'discardPile').length };
    R.check(`${label}: Wheels nicht spielbar bzw. ohne Kosten`, r === false || (nach.gold === vor.gold && nach.del === vor.del && nach.disc === vor.disc), { r, vor, nach, sperre: { draw: t.gs.players[0].drawLocked, hand: t.gs.players[0].handLocked } });
  }
  // Die Stäbe nach dem Sacred Jewel (`drawLocked`): sie tragen nur `blockedByHandLock`, das `drawLocked` nicht liest.
  for (const staff of ['Staff of the Teleporter', 'Staff of Uncontrollable Destruction']) {
    const t = await H.fresh({ hand: [['The Sacred Jewel', staff, 'Bird', 'Bird', 'Bird'], []], deckSize: 20, gold: 100 });
    t.script.push({ match: d => d.type === 'confirm' && d.title === 'The Sacred Jewel', answer: () => ({ confirmed: true }), once: false });
    t.script.push({ match: d => d.type === 'handPick', answer: (d) => ({ selectedCards: d.eligibleIndices.map(i => ({ handIndex: i, cardName: t.pile(0, 'hand')[i] })) }), once: false });
    await t.play(0, 'The Sacred Jewel');
    const vor = t.pile(0, 'hand').length;
    const r = await t.play(0, staff);
    const nach = t.pile(0, 'hand').length;
    // ★ ENTSCHIEDEN (Al, Welle 3 / D1): die Stäbe sind Mischeffekte (Mischen bzw. Abwerfen ist eigenständig) – unter der Zieh-Sperre bleiben sie
    // spielbar, nur der Nachzug entfällt (die Hand geht dann ins Deck bzw. in die Ablage). Wheels (reiner Zieher + Nachteil) bleibt gesperrt.
    R.check(`Jewel dann ${staff}: bleibt spielbar (Mischeffekt, nur der Nachzug entfällt)`, r === true && nach < vor - 1, { r, handVorher: vor, handNachher: nach, drawLocked: t.gs.players[0].drawLocked });
  }
  R.finish();
})();
