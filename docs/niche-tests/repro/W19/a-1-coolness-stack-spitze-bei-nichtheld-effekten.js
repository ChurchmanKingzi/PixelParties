'use strict';
// W19a-1 · „any card on the board that is not a Hero" bietet die OBERSTE Karte des Coolness Stacks an (Al, 19.10.2026)
//
// Frage an Al: „Sollen Tengu Windstorm und Sparkfly Worker bei ‚any card on the board that is not a Hero' auch die oberste Karte des Coolness Stacks
//   anbieten (wie Coolness Overcharge, Ralzish)?" – Al: „ja. Yeeting und andere vergleichbare Effekte auch."
// Geprüft für alle Karten dieses Textmusters: Tengu Windstorm (oben/unten ins Deck des Besitzers), Sparkfly Worker, Sparkfly Queen (Worker-Geschenk,
//   der Gegner gibt SEINE Stack-Spitze), The Yeeting, Destructive Puppet Shishi (3 Karten, Gegner wählt), Smug Mastermind Antonia,
//   Debt-O-Tron Model Scrap Plow (vorher: Karte stand danach in Stack UND Ablage), Coolness Overcharge, Wall Breaker General Ralzish:
//   (1) beide Stack-Spitzen (`coolness-0`/`coolness-1`, Typ coolnessStackTop) stehen in der Zielmenge (bei Queen: nur die des Gegners);
//   (2) Wahl der gegnerischen Spitze: genau diese Karte wandert an den Zielort, der Stapel schrumpft um 1, nichts doppelt/verschwunden (Bilanz), keine Engine-Fehler.
// Exit 0 = korrekt.
const H = require('../../lib/h.js');
const D = H.INERT.creature, F = H.INERT.filler;
const OBEN0 = 'Cute Cat', OBEN1 = 'Cute Bird';             // Spitzen (Seat 0 / Seat 1)
function stapel(t) {
  for (const [s, namen] of [[0, ['Cute Familiar', OBEN0]], [1, ['Cute Familiar', OBEN1]]]) {
    t.gs.players[s].coolnessStack = namen.slice();
    namen.forEach(n => t.engine._trackCard(n, s, 'coolnessStack'));
  }
}
const st = (t, s) => t.gs.players[s].coolnessStack.slice();
const hatSpitze = (liste, s) => (liste || []).some(x => x.id === `coolness-${s}` && x.type === 'coolnessStackTop' && x.name === (s === 0 ? OBEN0 : OBEN1));
const kurz = (v) => v.map(x => ({ id: x.id, type: x.type, name: x.cardName }));
function wahl(t, merke, welcher = 1) {   // wählt die Spitze von Seat `welcher`; merkt die Liste der Zielwahl mit Stack-Spitzen
  t.targetFn = (valid) => {
    if (valid.every(v => v.type === 'hero')) return [valid[0].id];   // Yeeting: erst „Choose a Hero you control"
    const k = kurz(valid);
    if (k.some(x => x.type === 'coolnessStackTop')) { merke.liste = k; const z = valid.find(v => v.id === `coolness-${welcher}`); return z ? [z.id] : null; }
    return [valid[0].id];                                 // Vorstufen (z. B. Heldenwahl der Yeeting)
  };
}
function sauber(R, t) {
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.check('Zustand sauber (audit)', t.audit().length === 0, t.audit());
}

(async () => {
  const R = H.runner();

  R.section('Tengu Windstorm');
  for (const pos of ['top', 'bottom']) {
    const t = await H.fresh({ hand: [['Tengu Windstorm'], []], deckSize: 10 });
    t.setDiscard(0, ['Rebelliokai Terror Tengu']); stapel(t);
    const m = {}; wahl(t, m);
    t.script.push({ match: d => d && d.type === 'optionPicker', answer: () => ({ optionId: pos }) });
    const deck1 = t.pile(1, 'mainDeck').slice();
    await t.play(0, 'Tengu Windstorm');
    R.check('beide Stack-Spitzen werden angeboten', hatSpitze(m.liste, 0) && hatSpitze(m.liste, 1), m.liste);
    const d = t.pile(1, 'mainDeck');
    R.check(`gegnerische Spitze landet ${pos === 'top' ? 'oben' : 'unten'} im Deck des Besitzers`,
      d.length === deck1.length + 1 && (pos === 'top' ? d[0] : d[d.length - 1]) === OBEN1, { d: d.slice(0, 2), ende: d.slice(-2) });
    R.check('Stapel des Gegners um die Spitze kleiner, eigener Stapel unberührt', JSON.stringify(st(t, 1)) === JSON.stringify(['Cute Familiar']) && st(t, 0).length === 2, [st(t, 0), st(t, 1)]);
    R.check('Stack-Instanz ist abgeräumt (keine Geisterkarte)', t.inst(c => c.zone === 'coolnessStack' && c.owner === 1).length === 1);
    sauber(R, t); }

  R.section('Sparkfly Worker');
  { const t = await H.fresh({ hand: [['Sparkfly Worker'], []] }); stapel(t);
    t.put(0, 0, 0, 'Sparkfly Queen').turnPlayed = 1;
    const m = {}; wahl(t, m);
    await t.play(0, 'Sparkfly Worker', { hero: 0, slot: 1 });
    R.check('beide Stack-Spitzen werden angeboten', hatSpitze(m.liste, 0) && hatSpitze(m.liste, 1), m.liste);
    R.check('gegnerische Spitze liegt auf meiner Hand, Stapel des Gegners schrumpft', t.pile(0, 'hand').includes(OBEN1) && JSON.stringify(st(t, 1)) === JSON.stringify(['Cute Familiar']), { hand: t.pile(0, 'hand'), stapel: st(t, 1) });
    const hi = t.inst(c => c.zone === 'hand' && c.owner === 0 && c.name === OBEN1)[0];
    R.check('Karte bleibt Eigentum des Gegners (originalOwner)', hi && (hi.originalOwner ?? 1) === 1, hi && hi.originalOwner);
    sauber(R, t); }

  R.section('Sparkfly Queen (Worker-Geschenk: der Gegner gibt seine Spitze)');
  { const t = await H.fresh({ hand: [[F], []] }); stapel(t);
    const q = t.put(0, 0, 0, 'Sparkfly Queen'); q.turnPlayed = 1; q.counters._sparkflyGifts = { worker: true };
    t.gs.activePlayer = 0; t.phase(2);
    const m = {}; wahl(t, m);
    t.script.push({ match: d => d && d.type === 'optionPicker', answer: (d) => ({ optionId: (d.options.find(o => o.id === 'worker') || d.options[0]).id }) });
    await t.activateCreature(0, 0, 0);
    R.check('nur die Spitze des Gegners wird angeboten (eigene Seite des Wählenden)', hatSpitze(m.liste, 1) && !hatSpitze(m.liste, 0), m.liste);
    R.check('Spitze des Gegners liegt auf meiner Hand', t.pile(0, 'hand').includes(OBEN1) && st(t, 1).length === 1, { hand: t.pile(0, 'hand'), stapel: st(t, 1) });
    sauber(R, t); }

  R.section('The Yeeting');
  { const t = await H.fresh({ hand: [[], []] }); stapel(t);
    const m = {}; wahl(t, m);
    await t.play(0, 'The Yeeting');
    R.check('beide Stack-Spitzen werden angeboten', hatSpitze(m.liste, 0) && hatSpitze(m.liste, 1), m.liste);
    R.check('gegnerische Spitze liegt in der Ablage des Gegners', t.pile(1, 'discardPile').includes(OBEN1) && st(t, 1).length === 1, { abl: t.pile(1, 'discardPile'), stapel: st(t, 1) });
    sauber(R, t); }

  R.section('Destructive Puppet Shishi');
  { const PS = require('../../../../cards/effects/_puppets-shared.js');
    const FECTA = 'Tri Fecta, the Puppet Master';
    const t = await H.fresh({ hand: [[F, F], []] }); stapel(t);
    t.setHero(0, 0, FECTA, 400);
    for (let s = 0; s < 3; s++) await t.run(() => PS.placePuppetToken(t.engine, 0, 0, PS.FECTA_SET[s], s, { source: FECTA }));
    t.put(1, 0, 0, D);
    let liste = null;
    t.targetFn = (valid, cfg) => {
      const k = kurz(valid);
      if (cfg && cfg.maxTotal === 3) { liste = k; const ids = []; const namen = new Set();
        for (const v of valid) { if (!namen.has(v.cardName) && (v.type === 'coolnessStackTop' || ids.length < 2)) { namen.add(v.cardName); ids.push(v.id); } if (ids.length === 3) break; }
        // sicherstellen, dass die Spitze des Gegners dabei ist
        if (!ids.includes('coolness-1')) ids[2] = 'coolness-1'; return ids; }
      return [valid.find(v => v.id === 'coolness-1').id];   // Gegner wählt seine Stack-Spitze
    };
    t.script.push({ match: d => d && d.type === 'forceDiscard', answer: (d) => ({ handIndex: d.eligibleIndices[0], cardName: t.pile(0, 'hand')[d.eligibleIndices[0]] }) });
    const shishi = t.inst(c => c.name === 'Destructive Puppet Shishi')[0];
    shishi.turnPlayed = 1; t.gs.activePlayer = 0; t.phase(2);
    await t.activateCreature(0, 0, shishi.zoneSlot);
    R.check('beide Stack-Spitzen stehen in der Dreierwahl-Menge', hatSpitze(liste, 0) && hatSpitze(liste, 1), liste);
    R.check('gewählte Spitze liegt in der Ablage, Stapel schrumpft um 1 (nicht in beiden)', t.pile(1, 'discardPile').includes(OBEN1) && JSON.stringify(st(t, 1)) === JSON.stringify(['Cute Familiar']), { abl: t.pile(1, 'discardPile'), stapel: st(t, 1) });
    sauber(R, t); }

  R.section('Smug Mastermind Antonia');
  { const t = await H.fresh({ hand: [['Cool Rescuer Monia', F, F, F], []], deckSize: 10 }); stapel(t);
    const ant = t.put(0, 0, 0, 'Smug Mastermind Antonia'); ant.turnPlayed = 1;
    const mine = t.put(0, 1, 0, H.INERT.big);
    t.gs.activePlayer = 0; t.phase(2);
    await t.activateCreature(0, 0, 0);
    const m = {}; wahl(t, m);
    t.script.push({ match: d => d && d.type === 'forceDiscardCancellable', answer: (d) => ({ handIndex: d.eligibleIndices[0], cardName: t.pile(0, 'hand')[d.eligibleIndices[0]] }) });
    await t.engine.actionDealCreatureDamage({ name: 'T', owner: 1, heroIdx: 0 }, mine, 50, 'creature');
    R.check('beide Stack-Spitzen werden angeboten', hatSpitze(m.liste, 0) && hatSpitze(m.liste, 1), m.liste);
    R.check('gegnerische Spitze liegt in der Ablage, Stapel schrumpft', t.pile(1, 'discardPile').includes(OBEN1) && st(t, 1).length === 1, { abl: t.pile(1, 'discardPile'), stapel: st(t, 1) });
    sauber(R, t); }

  R.section('Debt-O-Tron Model Scrap Plow');
  { const t = await H.fresh({ hand: [['Future Tech Fists'], []], gold: [0, 100] }); stapel(t);
    t.setHero(0, 0, 'Kent, the Indebted Apprentice', 400);
    t.put(0, 2, 2, 'Debt-O-Tron Model Scrap Plow').turnPlayed = 1;
    const m = {}; wahl(t, m);
    await t.play(0, 'Future Tech Fists', { hero: 0, slot: 0 });
    R.check('beide Stack-Spitzen werden angeboten', hatSpitze(m.liste, 0) && hatSpitze(m.liste, 1), m.liste);
    R.check('Spitze liegt nur noch in der Ablage (vorher: zugleich im Stapel)', t.pile(1, 'discardPile').includes(OBEN1) && JSON.stringify(st(t, 1)) === JSON.stringify(['Cute Familiar']), { abl: t.pile(1, 'discardPile'), stapel: st(t, 1) });
    sauber(R, t); }

  R.section('Coolness Overcharge');
  { const t = await H.fresh({ hand: [['Coolness Overcharge'], []] }); stapel(t);
    t.gs.players[0].coolnessStack = ['Cute Cat', 'Cute Cat', 'Cute Cat', 'Cute Cat', 'Cute Cat', OBEN0]; t.gs.players[0].coolnessStack.forEach(n => t.engine._trackCard(n, 0, 'coolnessStack'));
    const m = {}; wahl(t, m);
    await t.play(0, 'Coolness Overcharge');
    R.check('beide Stack-Spitzen werden angeboten', hatSpitze(m.liste, 0) && hatSpitze(m.liste, 1), m.liste);
    R.check('gegnerische Spitze liegt in der Ablage', t.pile(1, 'discardPile').includes(OBEN1) && st(t, 1).length === 1, { abl: t.pile(1, 'discardPile'), stapel: st(t, 1) });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

  R.section('Wall Breaker General Ralzish');
  { const RZ = 'Wall Breaker General Ralzish';
    const t = await H.fresh({ hand: [[], []] }); stapel(t);
    t.setHero(0, 0, RZ, 800);
    t.put(0, 0, 0, D).turnPlayed = 1; t.put(0, 0, 1, D).turnPlayed = 1;
    const m = {}; wahl(t, m);
    await t.activateHero(0, 0, { effect: RZ, phase: 2 });
    R.check('beide Stack-Spitzen werden angeboten', hatSpitze(m.liste, 0) && hatSpitze(m.liste, 1), m.liste);
    R.check('gegnerische Spitze liegt in der Ablage', t.pile(1, 'discardPile').includes(OBEN1) && st(t, 1).length === 1, { abl: t.pile(1, 'discardPile'), stapel: st(t, 1) });
    sauber(R, t); }

  R.section('gleichnamige Karten im Stapel: nur EINE Spitze je Seite (kein doppeltes Ziel)');
  { const t = await H.fresh({ hand: [[], []] });
    t.gs.players[1].coolnessStack = [OBEN1, OBEN1]; t.gs.players[1].coolnessStack.forEach(n => t.engine._trackCard(n, 1, 'coolnessStack'));
    const m = {}; wahl(t, m);
    await t.play(0, 'The Yeeting');
    R.check('genau ein Ziel `coolness-1`', (m.liste || []).filter(x => x.id === 'coolness-1').length === 1, m.liste);
    R.check('Stapel um genau eine Karte kleiner', st(t, 1).length === 1 && t.pile(1, 'discardPile').filter(n => n === OBEN1).length === 1, { stapel: st(t, 1), abl: t.pile(1, 'discardPile') });
    sauber(R, t); }

  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
