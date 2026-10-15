// W12b · Q105 (F03-15) · Teal Fishing Rod: nur eine Instanz, die zu Rundenbeginn schon im Discard lag (exakte Instanzverfolgung statt Namensnäherung)
// Al: „Es darf nur eine Instanz geangelt werden, die zu Rundenbeginn bereits im Discard lag."
// Kartentext: „Choose a level 0 Creature from your discard pile that was not sent there this turn …"
// Erwartung: (a) Kontrolle: ein Bird, der seit Zugbeginn unberührt liegt, ist wählbar; (b) derselbe Bird wird herausgenommen und im selben Zug wieder abgelegt → nicht wählbar (gleichnamig, aber neue Instanz);
//   (c) ZWEI gleichnamige Birds: einer lag seit Zugbeginn dort, einer kam in diesem Zug dazu → die Galerie zählt genau EINEN (count 1), geangelt wird nur einer, der zweite bleibt in der Ablage;
//   (d) ein in diesem Zug neu abgelegter Bird (anderer Name im Schnappschuss fehlt) ist nicht wählbar (Regression der alten Näherung); (e) Zugwechsel: im nächsten eigenen Zug ist auch der zuvor neue Bird wählbar.
//   Exit 0 = korrekt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const TR = 'Teal Fishing Rod';
  const frisch = async (ablage = ['Bird'], hand = [TR]) => {
    const t = await H.fresh({ hand: [hand, []], discard: [ablage, []], gold: 100 });
    await t.endTurn(); await t.endTurn();           // echter Zugbeginn: Verfolgung läuft ab hier
    return t;
  };
  const scriptRod = (t, o) => {
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === TR, answer: (d) => { o.gal = d.cards.map(c => c.name + ':' + c.count); return d.cards.length ? { cardName: d.cards[0].name, source: 'discard' } : null; }, once: false });
    t.script.push({ match: d => d.type === 'zonePick' && d.title === TR, answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx }), once: false });
  };
  const aufBrett = (t, n) => [0, 1, 2].reduce((a, h) => a + [0, 1, 2].filter(s => t.zone(0, h, s) === n).length, 0);
  { // (a)
    const t = await frisch(); const o = {}; scriptRod(t, o);
    await t.play(0, TR);
    R.check('(a) Bird aus der Zugbeginn-Ablage wird geangelt', aufBrett(t, 'Bird') === 1 && !t.pile(0, 'discardPile').includes('Bird'), { gal: o.gal });
  }
  { // (b)
    const t = await frisch(); const o = {}; scriptRod(t, o);
    await t.run(() => t.engine.actionPlaceCreature('Bird', 0, 0, 0, { source: 'discard' }));
    const bi = t.inst(c => c.name === 'Bird' && c.zone === 'support')[0];
    await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: 1, heroIdx: 0 }, bi));
    const r = await t.play(0, TR);
    R.check('(b) wieder abgelegter (gleichnamiger) Bird ist in diesem Zug nicht wählbar', aufBrett(t, 'Bird') === 0 && t.pile(0, 'discardPile').includes('Bird') && !(o.gal || []).some(x => /^Bird/.test(x)), { r, gal: o.gal });
    R.check('(b) Rod bleibt auf der Hand (kein Kandidat → nicht spielbar)', t.pile(0, 'hand').includes(TR), t.pile(0, 'hand'));
  }
  { // (c) zwei Birds, einer alt, einer neu
    const t = await frisch(['Bird']); const o = {}; scriptRod(t, o);
    t.gs.players[0].discardPile.push('Bird');   // neue Instanz in diesem Zug
    await t.play(0, TR);
    R.check('(c) Galerie zählt genau einen Bird (die Zugbeginn-Instanz)', (o.gal || []).join() === 'Bird:1', o.gal);
    R.check('(c) ein Bird geangelt, der neue bleibt in der Ablage', aufBrett(t, 'Bird') === 1 && t.pile(0, 'discardPile').filter(c => c === 'Bird').length === 1, { board: aufBrett(t, 'Bird'), disc: t.pile(0, 'discardPile') });
  }
  { // (d) nur ein neu abgelegter Bird
    const t = await frisch([], [TR, 'ZZ Filler']); const o = {};
    t.gs.players[0].discardPile.push('Bird');
    scriptRod(t, o);
    const r = await t.play(0, TR);
    R.check('(d) in diesem Zug abgelegter Bird ist nicht wählbar (Rod nicht spielbar)', aufBrett(t, 'Bird') === 0 && t.pile(0, 'hand').includes(TR), { r, gal: o.gal });
  }
  { // (e) im nächsten eigenen Zug ist er wählbar
    const t = await frisch([], [TR]); const o = {};
    t.gs.players[0].discardPile.push('Bird');
    await t.endTurn(); await t.endTurn();
    scriptRod(t, o);
    await t.play(0, TR);
    R.check('(e) im nächsten eigenen Zug ist der Bird wählbar', aufBrett(t, 'Bird') === 1, { gal: o.gal, disc: t.pile(0, 'discardPile') });
    R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
