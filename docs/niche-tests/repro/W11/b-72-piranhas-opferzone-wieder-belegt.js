// W11b · Q72 (C01-13) · 500 Piranhas in a Monster Suit: die Zone des Opfers wird sofort wieder belegt (Cute Bird → Cute Phoenix)
// Al: „b falls möglich, aber es muss eine Zone desselben Heroes sein, wähle automatisch die erstbeste, sonst c."
//  b) Piranhas liegt in der ersten freien Support Zone DESSELBEN Helden (ohne Wahl); c) gibt es dort keine, wird die Karte abgelegt.
// Exit 0 = korrekt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const P = '500 Piranhas in a Monster Suit';
  async function lauf(belegeAndere) {
    const t = await H.fresh({ hand: [[P], ['ZZ Filler', 'ZZ Filler', 'ZZ Filler']], deck: [[], ['Cute Phoenix', 'ZZ Filler', 'ZZ Filler']] });
    const gs = t.gs, ps = gs.players[0];
    t.put(1, 0, 1, 'Cute Bird');
    for (const s of belegeAndere) t.put(1, 0, s, H.INERT.creature);
    t.targetFn = (valid) => [valid.find(v => v.cardName === 'Cute Bird').id];
    t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
    t.script.push({ match: d => d.type === 'handPick' || d.type === 'multiHandPick', answer: () => ({ selectedCards: [{ handIndex: 0, cardName: 'ZZ Filler' }, { handIndex: 1, cardName: 'ZZ Filler' }] }) });
    const vor = t.census();
    const r = await t.play(0, P);
    return { t, gs, ps, r, vor };
  }
  // b) Slot 0 und 2 des Helden frei -> erste freie Zone (Slot 0) desselben Helden
  {
    const { t, ps } = await lauf([]);
    const phoenix = t.find('Cute Phoenix', 'support');
    const pir = t.find(P, 'support');
    R.check('b: Vogel besiegt, Phoenix steht in Zone 1', !!phoenix && phoenix.zoneSlot === 1 && phoenix.heroIdx === 0, phoenix && [phoenix.heroIdx, phoenix.zoneSlot]);
    R.check('b: Piranhas steht beim selben Helden (Held 0) in der ersten freien Zone (Slot 0)', !!pir && pir.heroIdx === 0 && pir.zoneSlot === 0, pir && [pir.heroIdx, pir.zoneSlot]);
    R.check('b: Piranhas nicht mehr auf der Hand / nicht in der Ablage', !ps.hand.includes(P) && !ps.discardPile.includes(P), { hand: ps.hand, dp: ps.discardPile });
    R.check('b: Piranhas liegt auf der Gegnerseite (Seite 1)', !!pir && t.engine.physicalSide(pir) === 1, pir && t.engine.physicalSide(pir));
    R.check('b: Rundengrenze verbraucht (zweite Piranhas nicht spielbar)', t.gs.hoptUsed?.[`piranhas-suit:0`] === t.gs.turn, t.gs.hoptUsed);
    R.check('b: keine Engine-/Audit-Fehler', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  // c) restliche Zonen des Helden belegt -> Piranhas in die Ablage
  {
    const { t, ps } = await lauf([0, 2]);
    const phoenix = t.find('Cute Phoenix', 'support');
    const pir = t.find(P, 'support');
    R.check('c: Vogel besiegt, Phoenix im Platz', !!phoenix && phoenix.zoneSlot === 1, phoenix && phoenix.zoneSlot);
    R.check('c: Piranhas nicht auf dem Brett', !pir, pir && [pir.heroIdx, pir.zoneSlot]);
    R.check('c: Piranhas in meiner Ablage, nicht mehr auf der Hand', ps.discardPile.includes(P) && !ps.hand.includes(P), { hand: ps.hand, dp: ps.discardPile });
    R.check('c: Piranhas nicht in der Ablage des Gegners', !t.gs.players[1].discardPile.includes(P));
    R.check('c: keine Engine-/Audit-Fehler', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  R.finish();
})();
