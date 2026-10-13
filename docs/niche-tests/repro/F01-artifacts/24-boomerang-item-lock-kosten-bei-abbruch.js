'use strict';
// F01-artifacts-24 · Item Lock (Hammer Throw): die Lösch-Kosten bleiben bezahlt, wenn die Boomerang-Galerie abgebrochen wird (Frage an Al)
// Kartentexte: Hammer Throw „The target's controller must delete a card from their hand whenever they play an Artifact during their next turn."; Boomerang „Choose an Artifact from your discard pile
//   and add it to your hand. …"; Regel 23.9 (CARD_API.md): Abbruch einer zielenden/wählenden Karte = nichts ist passiert (Karte bleibt auf der Hand, kein Gold).
// Aufbau: Sitz 0 steht unter Item Lock (`ps.itemLocked`), Hand [Boomerang, Füller, Füller], Ablage [Beer]; die Löschwahl zeigt auf einen Füller; in der Boomerang-Galerie wird abgebrochen.
// Erwartung: Entweder wird die Löschwahl erst nach der Galerie verlangt (Abbruch → nichts gelöscht) oder bei Abbruch zurückgegeben.
// Beobachtet: Boomerang bleibt auf der Hand, kein Gold weg, der Füller ist aber gelöscht (Kosten verloren). Gegenprobe: bei zielenden Artefakten (Burned Contract, Book of Doom) wird bei Abbruch NICHTS gelöscht.
// Ursache: `server.js` `doUseArtifactEffect` (Z. ~12226) fordert die Item-Lock-Löschung VOR Kette und `resolve`; `boomerang.js` gibt bei Galerie-Abbruch nur `{ cancelled: true }` zurück,
//   der Abbruchzweig bucht Gold, aber nicht die gelöschte Karte zurück. (`doConfirmPotion` Z. 11323 macht es bei zielenden Artefakten nach der Zielwahl und ist damit sauber.)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  {
    const t = await H.fresh({ hand: [['Boomerang', 'ZZ Filler', 'ZZ Filler'], []], gold: [200, 100], discard: [['Beer'], []] });
    t.gs.players[0].itemLocked = true;
    t.script.push({ match: d => d.type === 'forceDiscard', answer: () => ({ cardIdx: 1, handIdx: 1, index: 1, cardName: 'ZZ Filler' }) });
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => null });
    await t.play(0, 'Boomerang', { hero: 0 });
    const behalten = t.pile(0, 'hand').includes('Boomerang');
    R.check('Boomerang nach Galerie-Abbruch auf der Hand (Voraussetzung)', behalten, t.pile(0, 'hand'));
    R.check('Abbruch: keine Karte wurde als Item-Lock-Kosten gelöscht', t.pile(0, 'deletedPile').length === 0, { gelöscht: t.pile(0, 'deletedPile'), hand: t.pile(0, 'hand') });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
