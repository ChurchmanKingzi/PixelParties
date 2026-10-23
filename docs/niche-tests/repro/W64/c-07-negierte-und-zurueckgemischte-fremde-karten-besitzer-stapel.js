'use strict';
// W64c-07 · Zentrale Restwege (Al, 23.10.2026: Karten gehen IMMER in die Stapel ihres permanenten Besitzers), beide Sitze:
//   a) NEGIERTE Handkarte (`routeNegatedInitialCard`: Ablage, Löschstapel [Lunar Eclipse], zurück ins Deck [Off Duty]) einer gestohlenen/geschenkten Karte → Stapel des Besitzers
//   b) negierte Platzierung aus der Hand (`_negatedPlacementRoute`, Quelle 'hand')
//   c) Staff of Illusions: die vom Dieb aus der gestohlenen Hand beschworene Kreatur wird am Ende des gegnerischen Zugs ins Deck ihres BESITZERS gemischt
//   d) Gegenprobe: eigene Karten bleiben in den eigenen Stapeln
// Exit 0 = korrekt.
const B = require('../../lib/besitzer.js');
const { H } = B;
(async () => {
  const R = H.runner();
  const decks = [Array(10).fill('ZZ Trinket'), Array(10).fill('ZZ Trinket')];
  const gestohlen = async (karte, dieb, o = {}) => {
    const besitzer = 1 - dieb;
    const hand = [[], []]; hand[besitzer] = [karte, ...(o.besitzerHand || [])]; hand[dieb] = o.diebHand || ['ZZ Filler'];
    const t = await H.fresh({ hand, deck: decks, gold: [100, 100], ...(o.fresh || {}) });
    const w = B.waechter(t); t.dieb = dieb; t.besitzer = besitzer;
    const r = await t.run(() => t.engine.actionStealFromHand(dieb, { sourceName: 'Test', preselectedIndices: [t.pile(besitzer, 'hand').indexOf(karte)] }));
    R.check(`${karte}: gestohlen (Dieb ${dieb})`, r && r.stolen && r.stolen[0] === karte, r);
    return { t, w };
  };
  for (const dieb of [0, 1]) {
    R.section(`══ Dieb = Sitz ${dieb}, Besitzer = Sitz ${1 - dieb} ══`);
    for (const [label, chain, stapel] of [
      ['Ablage', {}, 'discardPile'],
      ['Löschstapel (Lunar Eclipse)', { negatedToDeleted: true }, 'deletedPile'],
      ['zurück ins Deck (Off Duty)', { negatedToDeck: true }, 'mainDeck'],
    ]) {
      const { t, w } = await gestohlen('Fireball', dieb);
      const hi = t.pile(dieb, 'hand').indexOf('Fireball');
      t.engine.takeFromPileSync(t.gs.players[dieb], 'hand', hi);   // wie der Server: Karte verlässt die Hand, dann Negierung
      await t.run(() => t.engine.routeNegatedInitialCard(dieb, 'Fireball', { negated: true, ...chain }, hi));
      B.erwarteStapel(R, t, `negierte gestohlene Karte → ${label} (Dieb ${dieb})`, 'Fireball', t.besitzer, stapel);
      R.check('  Besitzer-Wächter ohne Verstoß', w.echte().length === 0, w.echte().map(f => f.karte + '→' + f.stapel));
    }
    {   // b) negierte Platzierung aus der Hand
      const { t, w } = await gestohlen('ZZ Dummy', dieb);
      const hi = t.pile(dieb, 'hand').indexOf('ZZ Dummy');
      await t.run(() => t.engine._negatedPlacementRoute('ZZ Dummy', dieb, 'hand', { sourceIdx: hi }, {}));
      B.erwarteStapel(R, t, `negierte Platzierung einer gestohlenen Handkarte → Ablage des Besitzers (Dieb ${dieb})`, 'ZZ Dummy', t.besitzer, 'discardPile');
    }
    {   // d) Gegenprobe: eigene Karte
      const t = await H.fresh({ hand: [[], []], deck: decks });
      t.setHand(dieb, ['Fireball']);
      t.engine.takeFromPileSync(t.gs.players[dieb], 'hand', 0);
      await t.run(() => t.engine.routeNegatedInitialCard(dieb, 'Fireball', { negated: true }, 0));
      R.check(`Gegenprobe: eigene negierte Karte → eigene Ablage (Sitz ${dieb})`, B.anzahl(t, dieb, 'discardPile', 'Fireball') === 1 && B.anzahl(t, 1 - dieb, 'discardPile', 'Fireball') === 0, B.ort(t, 'Fireball'));
    }
    {   // c) Staff of Illusions
      const { t, w } = await gestohlen('ZZ Dummy', dieb, { diebHand: ['Staff of Illusions'] });
      t.gs.turn = 6;
      t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'ZZ Dummy', source: 'hand' }) });
      await t.play(dieb, 'Staff of Illusions', {});
      const inst = t.engine.cardInstances.find(c => c.name === 'ZZ Dummy' && c.zone === 'support');
      R.check(`Staff of Illusions (Dieb ${dieb}): die gestohlene Kreatur steht auf dem Brett, Herkunft = Besitzer`, !!inst && inst.originalOwner === t.besitzer, inst && { o: inst.originalOwner, owner: inst.owner });
      if (inst) {
        t.gs.activePlayer = t.besitzer;   // Ende des ersten Gegnerzugs nach dem Zug, in dem sie kam
        await t.run(() => t.engine._illusionenZurueck());
        t.gs.turn = 8; t.gs.activePlayer = t.besitzer;
        await t.run(() => t.engine._illusionenZurueck());
        B.erwarteStapel(R, t, `Staff of Illusions: zurückgemischt ins Deck des BESITZERS (Dieb ${dieb})`, 'ZZ Dummy', t.besitzer, 'mainDeck');
        R.check('  Besitzer-Wächter ohne Verstoß', w.echte().length === 0, w.echte().map(f => f.karte + '→' + f.stapel));
      }
    }
  }
  R.finish();
})();
