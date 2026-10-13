'use strict';
// M02-13 · Luck zieht doppelt, wenn der Gegner einen Area- oder Attachment-Zauber spielt (4/6/8 statt 2/3/4 Karten)
// Kartentext Luck: „You may once per turn declare a card name. Whenever your opponent plays a card of that name until the beginning of your next turn, draw 2/3/4 cards."
// Erwartung: ein Ausspielen der deklarierten Karte = ein Auslösen = 2 (Lv1) / 3 (Lv2) / 4 (Lv3) Karten.
// Beobachtet: Fireball (Normal-Zauber) und Regeneration zeigen 2/3/4 ✓; Slippery Ice (Area) und Invisibility (Attachment) lösen ZWEIMAL aus (4/6/8).
// Ursache: `luck.js` hört auf `afterSpellResolved` UND `onCardEnterZone` (luck.js:144 und :161) – beide rufen `_triggerLuck`; Areas/Attachments erzeugen beide Ereignisse, keine Entdoppelung.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const lv of [1, 2, 3]) {
    for (const name of ['Fireball', 'Slippery Ice', 'Invisibility']) {
      const t = await H.fresh({ hand: [[], [name]], hp: 800, deck: [Array(10).fill('ZZ Dummy'), Array(10).fill('ZZ Dummy')], gold: 100 });
      t.setAbilities(0, 0, [Array(lv).fill('Luck'), [], []]);
      t.script.push({ match: d => d.type === 'cardNamePicker', answer: () => ({ cardName: name }) });
      t.gs.activePlayer = 0; t.phase(2);
      await t.run(() => t.host.doActivateFreeAbility(t.room, 0, { heroIdx: 0, zoneIdx: 0 }));
      const vor = t.pile(0, 'hand').length;
      await t.endTurn();
      t.targetFn = (valid) => { const v = valid.find(x => x.owner === 0); return v ? [v.id] : null; };
      const r = await t.play(1, name, { hero: 0 });
      const gezogen = t.pile(0, 'hand').length - vor;
      R.check(`Luck Lv${lv} auf "${name}": ${lv + 1} Karten gezogen`, r === true && gezogen === lv + 1, { r, gezogen });
    }
  }
  R.finish();
})();
