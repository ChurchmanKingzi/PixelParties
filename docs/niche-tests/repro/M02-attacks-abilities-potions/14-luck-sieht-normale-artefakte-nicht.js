'use strict';
// M02-14 · Luck löst nicht aus, wenn der Gegner ein Normal-Artefakt spielt (obwohl der Namens-Wähler Artefakte anbietet)
// Kartentext Luck: „Whenever your opponent plays a card of that name until the beginning of your next turn, draw 2/3/4 cards."
// Erwartung: der Gegner spielt die deklarierte Karte (Treasure Chest / Golden Bananas / Snow Cannon / Magic Cobalt) ⇒ du ziehst 2 Karten.
// Beobachtet: 0 gezogen. Zum Vergleich: Zauber, Attacke, Trank, Ausrüstung, Fähigkeit lösen aus.
// Ursache: `luck.js` hört auf afterSpellResolved / onCardEnterZone / afterPotionUsed, NICHT auf `afterArtifactUsed` (server.js ~11562, ~12284);
//   Normal-Artefakte betreten keine Zone und lösen keinen der drei Hooks aus. `allNames` im Wähler schließt nur Token/Reaction/Surprise aus.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const name of ['Life Serum', 'Treasure Chest', 'Golden Bananas', 'Snow Cannon', 'Magic Cobalt']) {
    const t = await H.fresh({ hand: [[], [name]], hp: 800, deck: [Array(10).fill('ZZ Dummy'), Array(10).fill('ZZ Dummy')], gold: 100 });
    t.setAbilities(0, 0, [['Luck'], [], []]);
    t.script.push({ match: d => d.type === 'cardNamePicker', answer: () => ({ cardName: name }) });
    t.gs.activePlayer = 0; t.phase(2);
    await t.run(() => t.host.doActivateFreeAbility(t.room, 0, { heroIdx: 0, zoneIdx: 0 }));
    const vor = t.pile(0, 'hand').length;
    await t.endTurn();
    t.targetFn = (valid) => { const v = valid.find(x => x.owner === 0); return v ? [v.id] : null; };
    const r = await t.play(1, name, { hero: 0 });
    const gezogen = t.pile(0, 'hand').length - vor;
    R.check(`Luck Lv1 auf "${name}" (${name === 'Life Serum' ? 'Kontrolle: Trank' : 'Normal-Artefakt'}): 2 Karten gezogen`, r === true && gezogen === 2, { r, gezogen });
  }
  R.finish();
})();
