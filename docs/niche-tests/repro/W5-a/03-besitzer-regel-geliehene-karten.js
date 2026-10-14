'use strict';
// W5-a-03 · W3 (Entscheidung Al 14.10.2026): „Karten landen *immer* im Deck/Discard/Deleted Pile ihres permanenten Besitzers, durch alles." / „… immer ins Deck ihres originalen Besitzers gemischt."
// Fälle: (a) Life-Searcher geliehen → ins Deck des Besitzers gemischt (A02-04); (b) Dive Bomblebee: wählbar nur, was der Gegner KONTROLLIERT (Auslegung Al: „Nomenklatur"),
//   unter das Deck des Besitzers (A05-03); (c) Missing People: nur Kreaturen, die der Gegner kontrolliert; eine vom Gegner gestohlene eigene Kreatur wird angeboten und geht unter MEIN Deck (S03-06);
//   (d) Gold Trap („add it to your hand"): Hand des Spielers, aber Ablage später beim Besitzer; (e) Opfer aus der Hand (gestohlene Handkarte) → Ablage des Besitzers.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const alle = (t, nm) => [0, 1].reduce((n, s) => n + ['hand', 'discardPile', 'mainDeck', 'deletedPile'].reduce((m, k) => m + t.pile(s, k).filter(x => x === nm).length, 0), 0);

  R.section('(a) Geliehener Life-Searcher wird ins Deck des Besitzers gemischt');
  {
    const INV = 'Invader from the Cosmic Depths', LS = 'Life-Searcher from the Cosmic Depths', AN = 'Analyzer from the Cosmic Depths';
    const t = await H.fresh({ hand: [['Deepsea Succubus'], []], deck: [[INV, H.INERT.creature, H.INERT.creature], [H.INERT.creature, H.INERT.creature]] });
    const ls = t.put(1, 0, 0, LS); ls.turnPlayed = 1;
    t.put(0, 2, 0, AN, { counters: { changeCounter: 3 } });
    t.targetFn = (valid) => [valid.find(v => v.type === 'equip' && v.owner === 1 && v.cardName === LS).id];
    await t.play(0, 'Deepsea Succubus', { hero: 0 });
    t.targetFn = null;
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: INV }) });
    t.phase(4); t.gs.activePlayer = 0;
    await t.run(() => t.host.doActivateCreatureEffect(t.room, 0, { heroIdx: 0, zoneSlot: 0, charmedOwner: 1 }));
    R.check('Life-Searcher liegt im Deck des BESITZERS (Sitz 1), nicht in dem des Kontrolleurs', t.pile(1, 'mainDeck').includes(LS) && !t.pile(0, 'mainDeck').includes(LS), { d0: t.pile(0, 'mainDeck'), d1: t.pile(1, 'mainDeck') });
    R.check('Der Invader (aus dem Deck des Kontrolleurs) steht in der Zone des Life-Searchers (Brettseite Sitz 1, Held 0, Slot 0), kontrolliert von Sitz 0', t.zone(1, 0, 0) === INV && !t.pile(0, 'mainDeck').includes(INV), { z: t.zone(1, 0, 0) });
    const inv = t.find(INV, 'support');
    R.check('Invader gehört dem Kontrolleur (Kontrolle Sitz 0)', !!inv && t.engine.kontrolleurVon(inv) === 0, inv && { owner: inv.owner, controller: inv.controller });
    R.check('Zustand sauber, Bilanz Life-Searcher genau 1, keine Engine-Fehler', t.audit().length === 0 && alle(t, LS) === 1 && t.errors.length === 0, { a: t.audit(), n: alle(t, LS), e: t.errors });
  }

  R.section('(b) Dive Bomblebee: nur Karten, die der Gegner kontrolliert; unter das Deck des Besitzers');
  {   // i) von mir gestohlene Gegnerkreatur (liegt auf der Gegnerseite, ich kontrolliere sie) ist KEIN Ziel
    const t = await H.fresh({});
    const dive = t.put(0, 0, 0, 'Dive Bomblebee'); dive.turnPlayed = 1;
    const opfer = t.put(1, 2, 2, H.INERT.frail);
    const meine = t.put(1, 0, 1, 'ZZ Dummy Big');
    await t.engine.actionStealCreature(0, meine); await H.sleep(250);
    t.put(1, 0, 0, H.INERT.creature);
    let namen = [];
    t.targetFn = (valid) => { namen = valid.map(v => v.cardName); const v = valid.find(x => x.cardName === H.INERT.creature); return v ? [v.id] : [valid[0].id]; };
    await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 0 }, opfer));
    R.check('i) die von mir gestohlene Kreatur wird nicht angeboten', namen.length > 0 && !namen.includes('ZZ Dummy Big'), namen);
    R.check('i) gewählte Gegnerkarte liegt unten im Deck des Gegners (Besitzer)', t.pile(1, 'mainDeck').slice(-1)[0] === H.INERT.creature, t.pile(1, 'mainDeck').slice(-2));
  }
  {   // ii) meine eigene Kreatur, vom Gegner gestohlen (liegt auf MEINER Seite, der Gegner kontrolliert sie): Ziel; geht unter MEIN Deck
    const t = await H.fresh({});
    const dive = t.put(0, 0, 0, 'Dive Bomblebee'); dive.turnPlayed = 1;
    const opfer = t.put(1, 2, 2, H.INERT.frail);
    const x = t.put(0, 1, 0, 'ZZ Dummy Big');
    await t.engine.actionStealCreature(1, x); await H.sleep(250);
    let namen = [];
    t.targetFn = (valid) => { namen = valid.map(v => v.cardName); const v = valid.find(q => q.cardName === 'ZZ Dummy Big'); return v ? [v.id] : [valid[0].id]; };
    const c0 = t.census();
    await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 0 }, opfer));
    R.check('ii) die vom Gegner kontrollierte (eigene, gestohlene) Kreatur wird angeboten', namen.includes('ZZ Dummy Big'), namen);
    R.check('ii) sie liegt unten im Deck ihres Besitzers (Sitz 0), nicht des Gegners', t.pile(0, 'mainDeck').slice(-1)[0] === 'ZZ Dummy Big' && !t.pile(1, 'mainDeck').includes('ZZ Dummy Big'), { d0: t.pile(0, 'mainDeck').slice(-2), d1: t.pile(1, 'mainDeck').slice(-2) });
    R.check('ii) Zone leer, Bilanz sauber, keine Engine-Fehler', !t.zone(0, 1, 0) && t.audit().length === 0 && t.errors.length === 0 && t.censusDiff(c0, t.census()).filter(s => s.startsWith('ZZ Dummy Big')).length === 0, { z: t.zone(0, 1, 0), a: t.audit(), e: t.errors });
  }

  R.section('(c) Missing People');
  {   // i) meine eigene Kreatur wurde vom Gegner gestohlen: angeboten, geht unter MEIN Deck
    const t = await H.fresh({ hand: [['Missing People'], []], deckSize: 5 });
    const x = t.put(0, 0, 0, 'ZZ Dummy');
    await t.engine.actionStealCreature(1, x); await H.sleep(250);
    let namen = [];
    t.targetFn = (valid) => { namen = valid.map(v => v.cardName); const v = valid.find(q => q.type === 'equip'); return v ? [v.id] : null; };
    const r = await t.play(0, 'Missing People', { hero: 0 });
    R.check('i) gespielt und die vom Gegner kontrollierte eigene Kreatur wird angeboten', r === true && namen.includes('ZZ Dummy'), { r, namen });
    R.check('i) sie liegt unten in MEINEM Deck (Besitzer), Zone leer', t.pile(0, 'mainDeck').slice(-1)[0] === 'ZZ Dummy' && !t.zone(0, 0, 0), { d0: t.pile(0, 'mainDeck').slice(-1), z: t.zone(0, 0, 0) });
    R.check('i) Zustand sauber', t.audit().length === 0 && t.errors.length === 0, { a: t.audit(), e: t.errors });
  }
  {   // ii) die einzige Gegnerkreatur habe ICH gestohlen: der Gegner kontrolliert keine → Karte nicht spielbar
    const t = await H.fresh({ hand: [['Missing People'], []], deckSize: 5 });
    const x = t.put(1, 0, 0, 'ZZ Dummy');
    await t.engine.actionStealCreature(0, x); await H.sleep(250);
    const spielbar = !!t.engine.validateActionPlay(0, 'Missing People', 0, 0, ['Spell', 'Attack'], {});
    R.check('ii) Zielliste leer (Gegner kontrolliert nichts) → Missing People ist nicht spielbar', !spielbar, spielbar);
  }

  R.section('(d) Gold Trap: Hand des Fallenstellers, Ablage später beim Besitzer');
  {
    const t = await H.fresh({ gold: [100, 100] });
    t.putSurprise(0, 0, 'Gold Trap'); t.grantFor(0, 0, 'Gold Trap');
    t.put(1, 0, 0, 'ZZ Dummy');
    t.gs.activePlayer = 1;
    t.targetFn = (valid) => { const v = valid.find(x => x.cardName === 'ZZ Dummy'); return v ? [v.id] : undefined; };
    await t.run(() => t.engine.actionGainGold(1, 30));
    R.check('Gold Trap: die Kreatur liegt auf der Hand des Fallenstellers („your hand")', t.pile(0, 'hand').includes('ZZ Dummy'), t.pile(0, 'hand'));
    await t.run(() => t.engine.actionDiscardHandCard(0, 'ZZ Dummy', t.pile(0, 'hand').indexOf('ZZ Dummy')));
    R.check('abgeworfen: Ablage des Besitzers (Sitz 1)', t.pile(1, 'discardPile').includes('ZZ Dummy') && !t.pile(0, 'discardPile').includes('ZZ Dummy'), { a0: t.pile(0, 'discardPile'), a1: t.pile(1, 'discardPile') });
  }
  R.finish();
})();
