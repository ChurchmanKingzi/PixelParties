'use strict';
// F02-11 · „You can only play 1 X per turn"-Artefakte: ein GANZ negierter Spielzug verbraucht die Grenze NICHT (Als Entscheidung, Welle 3)
// Karten (Kartentext jeweils „You can only play 1 "<Name>" per turn."): Magic Emerald, Magic Cobalt (beide Magic Gems), Magnetic Glove, Relic in the Sky, Heart of the Mountain, Heart of Cards.
// REGEL (CARD_API.md „★ Z7b"): eine komplett negierte Karte (Rusty Touch: Kosten bezahlt) hat nie aufgelöst → der Zug-Slot ist unverbraucht. (Entscheidung gilt auch bei bezahlten Kosten.)
// Aufbau: Sitz 0: 2 Kopien der Karte auf der Hand, 100 Gold; Sitz 1: Rusty Touch (negiert einen Artifact-Spielzug).
// Schritte: 1. Karte spielen, Sitz 1 negiert. 2. Zweite Kopie im selben Zug spielen (ohne weitere Reaktion).
// Exit 1 (Fehler tritt auf) = die zweite Kopie ist nach der Negierung nicht spielbar (der Slot wurde verbraucht).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const cases = [
    { name: 'Magic Emerald' }, { name: 'Magic Cobalt', hero: true }, { name: 'Magnetic Glove', gallery: 'Magnetic Glove' },
    { name: 'Relic in the Sky', discard: ['Fireball'] }, { name: 'Heart of the Mountain' }, { name: 'Heart of Cards', picker: true },
  ];
  for (const c of cases) {
    const t = await H.fresh({ hand: [[c.name, c.name, 'ZZ Filler', 'ZZ Filler'], ['Rusty Touch']], gold: [100, 100], discard: [c.discard || [], []],
      deck: [['Fireball', 'Attack', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy'], ['ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy']] });
    t.grantFor(1, 0, 'Rusty Touch');
    t.script.push({ match: d => d.type === 'cardNamePicker', answer: () => ({ cardName: 'Fireball' }) });
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Magnetic Glove', answer: () => ({ cardName: 'Fireball' }) });
    const spiele = async () => {
      await t.play(0, c.name, { noAutoConfirm: true });
      const pt = t.gs.potionTargeting;
      if (pt) { const v = (pt.validTargets || []).filter(x => !x.ineligible); return { geoeffnet: true, c: await t.run(() => t.host.doConfirmPotion(t.room, 0, { selectedIds: c.hero ? [v.find(x => x.type === 'hero' && x.owner === 0).id] : [] })) }; }
      return { geoeffnet: !!t.pile(0, 'hand').length };
    };
    t.policy.confirm = true;
    const hand0 = t.pile(0, 'hand').length;
    await spiele();
    const negiert = t.pile(1, 'discardPile').includes('Rusty Touch');
    t.policy.confirm = false; t.reset();
    const vorher = t.pile(0, 'hand').length;
    await t.play(0, c.name, { noAutoConfirm: true });
    const zweitesAngenommen = t.pile(0, 'hand').filter(n => n === c.name).length < 1 || !!t.gs.potionTargeting || t.pile(0, 'discardPile').filter(n => n === c.name).length >= 2;
    t.gs.potionTargeting = null;
    R.check(`${c.name}: 1. Spielzug negiert`, negiert, null);
    R.check(`${c.name}: 2. Kopie im selben Zug ist spielbar`, zweitesAngenommen, { hand: t.pile(0, 'hand'), disc: t.pile(0, 'discardPile'), hopt: t.gs.hoptUsed });
  }
  R.finish();
})();
