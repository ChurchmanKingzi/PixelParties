'use strict';
// F03-artifacts-18 · Staff of the Teleporter / Staff of Uncontrollable Destruction: setzen die volle Hand-Sperre (`handLocked`) – damit sind auch Suchen/Hinzufügen gesperrt, der Kartentext nennt nur „draw"
// Kartentexte: Teleporter „… You cannot draw cards or move any cards out of your discard pile for the rest of the turn." · Uncontrollable „You cannot draw or move cards out of your discard pile for the rest of the turn."
// Regel (CARD_API.md Z. ~15805–15818): `handLocked` sperrt Draws UND Suchen/Adds; `drawLocked` (Sacred Jewel) nur Draws – „Als Ruling: das Jewel sperrt NUR Draws, NICHT Searches".
// Aufbau: Sitz 0 spielt den Stab (Hand außer Stab: nichts gewählt/leer) und danach einen Deck-Sucher: Sickly Cheese (Decay-Spell „Accusation" im Deck) bzw. Spice Mortar.
// Erwartung (Lesart Text/Jewel-Ruling): Suchen bleibt erlaubt; nur Ziehen ist gesperrt. Das Skript sperrt zusätzlich `blockedByHandLock`-Karten (Cheese ist damit unspielbar).
// Beobachtet (✗): Sickly Cheese / Spice Mortar sind nach dem Stab nicht spielbar (`handLocked`).
// Ursache: `staff-of-the-teleporter.js` (Z. ~156 `ps.handLocked = true`) und `staff-of-uncontrollable-destruction.js` setzen `handLocked` statt `drawLocked`.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const staff of ['Staff of the Teleporter', 'Staff of Uncontrollable Destruction']) {
    for (const sucher of ['Sickly Cheese', 'Spice Mortar']) {
      const t = await H.fresh({ hand: [[staff, sucher], []], deck: [['Accusation', 'Bird', 'Bird'], ['Acid Vial', 'Bird', 'Bird']], gold: 100 });
      t.script.push({ match: d => d.type === 'handPick', answer: () => ({ selectedCards: [] }), once: false });
      t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Sickly Cheese', answer: () => ({ cardName: 'Accusation', source: 'deck' }), once: false });
      t.script.push({ match: d => d.type === 'deckPeekPick', answer: () => ({ cancelled: true }), once: false });
      t.script.push({ match: d => d.type === 'confirm' && d.title === 'Spice Mortar', answer: () => ({ confirmed: false }), once: false });
      t.targetFn = (valid) => { const v = valid.find(v => v.type === 'hero' && v.owner === 0); return v ? [v.id] : undefined; };
      await t.play(0, staff);
      const r = await t.play(0, sucher);
      R.check(`${staff} → ${sucher} bleibt spielbar (nur Ziehen ist gesperrt)`, r === true, { r, handLocked: t.gs.players[0].handLocked, drawLocked: t.gs.players[0].drawLocked, hand: t.pile(0, 'hand') });
    }
  }
  R.finish();
})();
