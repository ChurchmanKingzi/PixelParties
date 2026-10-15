// W11b · Q69 (C01-07) · 500 Piranhas in a Monster Suit: „The corresponding Hero takes 80 damage at the end of each of its controller's turns."
// Al: „Der Schaden wird am Ende der Runde des Spielers applied, der aktuell die permanente Kontrolle über den Hero in question hält."
// Erwartung: A) Standard: Wirtsheld (Gegnerseite) nimmt am Ende der GEGNERzüge Schaden. B) Nach dauerhafter Übernahme (actionTakeHeroPermanently)
//   fällt er am Ende MEINER Züge, nicht mehr der Gegnerzüge. C) Nach Rückgabe der Kontrolle wieder am Ende der Gegnerzüge. Exit 0 = korrekt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const P = '500 Piranhas in a Monster Suit';
  const t = await H.fresh({ hand: [[P], []] });
  const gs = t.gs;
  t.put(1, 0, 1, H.INERT.creature);
  t.targetFn = (valid) => [valid.find(x => x.cardName === H.INERT.creature).id];
  await t.play(0, P);
  async function runde(n) {
    const out = [];
    for (let i = 0; i < n; i++) { const h0 = t.hp(1, 0); const wer = gs.activePlayer; await t.endTurn(); out.push({ von: wer, schaden: h0 - t.hp(1, 0) }); }
    return out;
  }
  const sum = (a, s) => a.filter(z => z.von === s).reduce((x, z) => x + z.schaden, 0);
  // Der Zugwechsel startet bei Sitz 0: zwei Zugenden je Spieler
  let a = await runde(2);
  R.check('A: Gegnerzugende: 80, eigenes Zugende: 0', sum(a, 1) === 80 && sum(a, 0) === 0, a);
  await t.engine.actionTakeHeroPermanently(0, 1, 0, {});
  let b = await runde(2);
  R.check('B: dauerhaft übernommen: nur am Ende MEINER Züge (80), nicht der Gegnerzüge', sum(b, b[0].von) === 80 && sum(b, 1 - b[0].von) === 0 && sum(b, 0) === 80, b);
  await t.engine.actionReturnHeroControl(1, 0, {});
  let c = await runde(2);
  R.check('C: Kontrolle zurück beim Gegner: wieder am Ende der Gegnerzüge', sum(c, 1) === 80 && sum(c, 0) === 0, c);
  R.check('keine Engine-/Audit-Fehler', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  R.finish();
})();
