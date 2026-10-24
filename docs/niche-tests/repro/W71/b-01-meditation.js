'use strict';
// W71b-01 · Meditation (neue Karte, Spell Normal, Support Magic Lv2)
//
// Text: „Choose any number of Spells from your discard pile, shuffle them back into your deck and draw 1 card OR choose up to 2 Spells from your discard pile
//   and add them to your hand. If the user has Support Magic 3, this counts as an additional Action. Delete this card. You can only play 1 "Meditation" per turn."
// Geprüft: beide Wege, 0/1/n Karten, Duplikate, Nicht-Spells bleiben liegen, EIN Reveal-Fenster für beide Hand-Karten, Löschstapel, Rundensperre (auch nach Abbruch),
//   Zusatzaktion nur mit Support Magic 3, Sperren (Such-/Hand-/Ablage-Sperre, Hatusbal), leeres Deck, Abbruch, Zustandsprüfung.
const H = require('../../lib/h.js');
const CARD = 'Meditation';
const SPELLS = ['Fireball', 'Explosion', 'Icebolt', 'Brainstorming', 'Forbidden Zone'];

const answer = (opt, namen, o = {}) => (t) => {
  t.script.length = 0;
  t.script.push({ match: d => d.type === 'optionPicker' && d.title === CARD, answer: () => ({ optionId: opt }), once: true });
  t.script.push({ match: d => d.type === 'cardGalleryMulti' && d.title === CARD, once: true, answer: (d) => {
    const used = new Set(); const idx = [];
    for (const n of namen) { const i = d.cards.findIndex((c, k) => c.name === n && !used.has(k)); if (i >= 0) { used.add(i); idx.push(i); } }
    t.lastGallery = d;
    return o.cancel ? { cancelled: true } : { selectedCards: idx.map(i => d.cards[i].name), selectedIndices: idx };
  } });
};

(async () => {
  const R = H.runner();

  R.section('A · Weg „auf die Hand": zwei Spells, ein gemeinsames Reveal-Fenster, Karte gelöscht');
  {
    const t = await H.fresh({ hand: [[CARD], []], discard: [[...SPELLS, 'Archer', 'Draw'], []], deckSize: 5 });
    answer('hand', ['Fireball', 'Icebolt'])(t);
    const r = await t.play(0, CARD, { hero: 0 });
    R.check('gespielt', r === true, r);
    const hand = t.pile(0, 'hand');
    R.check('Fireball und Icebolt auf der Hand', hand.includes('Fireball') && hand.includes('Icebolt') && hand.length === 2, hand);
    R.check('beide aus der Ablage entfernt, Rest bleibt', !t.pile(0, 'discardPile').includes('Fireball') && !t.pile(0, 'discardPile').includes('Icebolt') && t.pile(0, 'discardPile').includes('Explosion') && t.pile(0, 'discardPile').includes('Archer'), t.pile(0, 'discardPile'));
    R.check('Meditation im Löschstapel, nicht in der Ablage', t.pile(0, 'deletedPile').includes(CARD) && !t.pile(0, 'discardPile').includes(CARD), [t.pile(0, 'deletedPile'), t.pile(0, 'discardPile')]);
    const rev = t.prompts.filter(p => p.d.type === 'deckSearchReveal');
    R.check('GENAU EIN Reveal-Fenster', rev.length === 1, rev.length);
    R.check('… an den Gegner (Sitz 1) mit BEIDEN Karten', rev[0] && rev[0].pi === 1 && JSON.stringify(rev[0].d.cardNames) === JSON.stringify(['Fireball', 'Icebolt']), rev[0] && [rev[0].pi, rev[0].d.cardNames]);
    R.check('… Quelle „discard pile", Titel Meditation', rev[0] && rev[0].d.sourceLabel === 'discard pile' && rev[0].d.title === CARD, rev[0] && rev[0].d);
    R.check('Nicht-Spells (Archer, Draw) als Auswahl nicht angeboten', t.lastGallery && !t.lastGallery.cards.some(c => c.name === 'Archer'), t.lastGallery && t.lastGallery.cards.map(c => c.name));
    R.check('Galerie: max 2, min 1', t.lastGallery && t.lastGallery.selectCount === 2 && t.lastGallery.minSelect === 1, t.lastGallery && [t.lastGallery.selectCount, t.lastGallery.minSelect]);
    R.check('Deck unverändert (kein Ziehen)', t.pile(0, 'mainDeck').length === 5, t.pile(0, 'mainDeck').length);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
    R.check('Zustand sauber', t.audit().length === 0, t.audit());
  }

  R.section('B · Weg „mischen": n Spells zurück, EINMAL mischen, 1 Karte ziehen');
  {
    const t = await H.fresh({ hand: [[CARD], []], discard: [[...SPELLS, 'Archer'], []], deck: [['Draw', 'Draw', 'Draw'], []] });
    let mischen = 0; const o = t.engine.shuffleDeck.bind(t.engine);
    t.engine.shuffleDeck = (...a) => { mischen++; return o(...a); };
    answer('mischen', ['Fireball', 'Explosion', 'Icebolt'])(t);
    const r = await t.play(0, CARD, { hero: 0 });
    R.check('gespielt', r === true, r);
    R.check('drei Spells aus der Ablage', ['Fireball', 'Explosion', 'Icebolt'].every(n => !t.pile(0, 'discardPile').includes(n)) && t.pile(0, 'discardPile').includes('Brainstorming'), t.pile(0, 'discardPile'));
    R.check('Deck: 3 + 3 − 1 gezogen = 5', t.pile(0, 'mainDeck').length === 5, t.pile(0, 'mainDeck').length);
    R.check('Hand: genau 1 Karte (gezogen)', t.pile(0, 'hand').length === 1, t.pile(0, 'hand'));
    R.check('genau EIN Mischen', mischen === 1, mischen);
    R.check('kein Reveal-Fenster für den Gegner', t.prompts.filter(p => p.d.type === 'deckSearchReveal').length === 0);
    R.check('Meditation gelöscht', t.pile(0, 'deletedPile').includes(CARD));
    R.check('Galerie: „any number" → min 0, max = Anzahl Spells', t.lastGallery && t.lastGallery.minSelect === 0 && t.lastGallery.selectCount === 5, t.lastGallery && [t.lastGallery.minSelect, t.lastGallery.selectCount]);
    R.check('shuffled_back-Meldung mit 3', t.lg('shuffled_back').length === 1 && t.lg('shuffled_back')[0].count === 3, t.lg('shuffled_back'));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('C · „any number" = auch 0: nur ziehen; Duplikate; alle Spells');
  {
    const t = await H.fresh({ hand: [[CARD], []], discard: [[ 'Fireball', 'Fireball', 'Fireball'], []], deck: [['Draw', 'Archer'], []] });
    answer('mischen', [])(t);
    await t.play(0, CARD, { hero: 0 });
    R.check('0 gewählt → Ablage unberührt, 1 Karte gezogen', t.pile(0, 'discardPile').length === 3 && t.pile(0, 'hand').length === 1 && t.pile(0, 'mainDeck').length === 1, [t.pile(0, 'discardPile'), t.pile(0, 'hand'), t.pile(0, 'mainDeck')]);
    R.check('Meditation gelöscht', t.pile(0, 'deletedPile').includes(CARD));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {
    const t = await H.fresh({ hand: [[CARD], []], discard: [['Fireball', 'Fireball', 'Fireball'], []], deck: [['Draw', 'Archer'], []] });
    answer('mischen', ['Fireball', 'Fireball', 'Fireball'])(t);
    await t.play(0, CARD, { hero: 0 });
    R.check('alle DREI gleichnamigen Kopien zurück (Auswahl nach Platz)', t.pile(0, 'discardPile').length === 0 && t.pile(0, 'mainDeck').filter(n => n === 'Fireball').length + t.pile(0, 'hand').filter(n => n === 'Fireball').length === 3, [t.pile(0, 'discardPile'), t.pile(0, 'mainDeck'), t.pile(0, 'hand')]);
  }
  {
    const t = await H.fresh({ hand: [[CARD], []], discard: [['Fireball', 'Fireball'], []] });
    answer('hand', ['Fireball', 'Fireball'])(t);
    await t.play(0, CARD, { hero: 0 });
    R.check('Hand-Weg: zwei Kopien derselben Karte', t.pile(0, 'hand').filter(n => n === 'Fireball').length === 2, t.pile(0, 'hand'));
    const rev = t.prompts.filter(p => p.d.type === 'deckSearchReveal');
    R.check('ein Fenster, beide Kopien', rev.length === 1 && rev[0].d.cardNames.length === 2, rev.map(r => r.d.cardNames));
  }

  R.section('D · nur ein Weg offen → kein Menü');
  {
    const t = await H.fresh({ hand: [[CARD], []], discard: [[], []], deck: [['Draw', 'Archer'], []] });
    const r = await t.play(0, CARD, { hero: 0 });
    R.check('leere Ablage: spielbar (zieh 1), kein Menü, keine Galerie', r === true && t.prompts.filter(p => p.d.title === CARD).length === 0 && t.pile(0, 'hand').length === 1, [r, t.prompts.length, t.pile(0, 'hand')]);
    R.check('Meditation gelöscht', t.pile(0, 'deletedPile').includes(CARD));
  }
  {
    const t = await H.fresh({ hand: [[CARD], []], discard: [['Archer', H.INERT.creature], []], deck: [['Draw', 'Archer'], []] });
    const r = await t.play(0, CARD, { hero: 0 });
    R.check('Ablage nur mit Nicht-Spells: zieh 1, keine Spell-Auswahl', r === true && t.pile(0, 'hand').length === 1 && t.pile(0, 'discardPile').length === 2, [t.pile(0, 'hand'), t.pile(0, 'discardPile')]);
  }
  {
    const t = await H.fresh({ hand: [[CARD], []], discard: [['Fireball', 'Icebolt'], []] });
    t.script.push({ match: d => d.type === 'optionPicker' && d.title === CARD, answer: () => ({ cancelled: true }), once: true });
    await t.play(0, CARD, { hero: 0 });
    R.check('Menü abgebrochen: Karte auf der Hand, nichts passiert', t.pile(0, 'hand').includes(CARD) && t.pile(0, 'discardPile').length === 2 && !t.pile(0, 'deletedPile').includes(CARD), [t.pile(0, 'hand'), t.pile(0, 'discardPile')]);
    R.check('… Rundensperre NICHT verbraucht', !t.gs.hoptUsed || !Object.keys(t.gs.hoptUsed).some(k => k.includes(CARD)), t.gs.hoptUsed);
  }
  {
    const t = await H.fresh({ hand: [[CARD], []], discard: [['Fireball', 'Icebolt'], []] });
    answer('hand', ['Fireball'], { cancel: true })(t);
    await t.play(0, CARD, { hero: 0 });
    R.check('Galerie abgebrochen: nichts passiert, Karte zurück, Sperre frei', t.pile(0, 'hand').includes(CARD) && t.pile(0, 'discardPile').length === 2 && !Object.keys(t.gs.hoptUsed || {}).some(k => k.includes(CARD)), [t.pile(0, 'hand'), t.pile(0, 'discardPile'), t.gs.hoptUsed]);
    R.check('… Aktion zurück', t.gs.players[0]._actionsPlayedThisTurn === 0, t.gs.players[0]._actionsPlayedThisTurn);
  }

  R.section('E · „You can only play 1 per turn"');
  {
    const t = await H.fresh({ hand: [[CARD, CARD], []], discard: [['Fireball', 'Icebolt', 'Explosion', 'Forbidden Zone'], []], deck: [['Draw', 'Archer', 'Draw'], []] });
    answer('hand', ['Fireball'])(t);
    const r1 = await t.play(0, CARD, { hero: 0 });
    answer('hand', ['Icebolt'])(t);
    const r2 = await t.play(0, CARD, { hero: 0 });
    R.check('erste gespielt', r1 === true && t.pile(0, 'hand').includes('Fireball'), r1);
    R.check('zweite im selben Zug abgelehnt', r2 === false && t.pile(0, 'hand').filter(n => n === CARD).length === 1, [r2, t.pile(0, 'hand')]);
    R.check('Icebolt noch in der Ablage', t.pile(0, 'discardPile').includes('Icebolt'));
    // nächster eigener Zug
    t.gs.turn += 2; t.gs.activePlayer = 0;
    answer('hand', ['Icebolt'])(t);
    const r3 = await t.play(0, CARD, { hero: 0 });
    R.check('nächster Zug: wieder spielbar', r3 === true && t.pile(0, 'hand').includes('Icebolt'), r3);
  }
  {
    // jeder Spieler hat sein eigenes Limit
    const t = await H.fresh({ hand: [[CARD], [CARD]], discard: [['Fireball'], ['Icebolt']] });
    answer('hand', ['Fireball'])(t);
    const a = await t.play(0, CARD, { hero: 0 });
    answer('hand', ['Icebolt'])(t);
    const b = await t.play(1, CARD, { hero: 0 });
    R.check('Gegner darf in seinem Zug ebenfalls 1 spielen', a === true && b === true, [a, b]);
  }

  R.section('F · Zusatzaktion nur mit Support Magic 3');
  for (const stufe of [2, 3]) {
    const t = await H.fresh({ hand: [[CARD, 'Archer'], []], discard: [['Fireball'], []], deck: [['Draw'], []], abilities: { 0: { 0: [Array(stufe).fill('Support Magic'), [], []] } } });
    const inh = require('../../../../cards/effects/meditation.js').inherentAction(t.gs, 0, 0, t.engine);
    R.check(`Support Magic ${stufe}: inherentAction = ${stufe >= 3}`, inh === (stufe >= 3), inh);
    answer('hand', ['Fireball'])(t);
    t.phase('MAIN1'); t.resetActions(0);
    t.gs.players[0]._actionsPlayedThisPhase = 1;   // Aktion der Phase schon verbraucht
    const r = await t.play(0, CARD, { hero: 0, noGrant: true, keepActions: true, phase: 'MAIN1' });
    R.check(`Support Magic ${stufe}: bei verbrauchter Aktion ${stufe >= 3 ? 'spielbar (Zusatzaktion)' : 'NICHT spielbar'}`, (r === true) === (stufe >= 3), r);
  }

  R.section('G · Sperren');
  {
    const t = await H.fresh({ hand: [[CARD], []], discard: [['Fireball', 'Icebolt'], []], deck: [['Draw', 'Archer'], []] });
    t.gs.players[0].searchLocked = true; t.gs.players[0].searchLockedIncludesDiscard = true;
    answer('hand', ['Fireball'])(t);
    const r = await t.play(0, CARD, { hero: 0 });
    R.check('starke Such-Sperre: Hand-Weg weg, Karte läuft als Misch-Weg ohne Menü', r === true && !t.prompts.some(p => p.d.type === 'optionPicker') && t.pile(0, 'hand').length === 1, [r, t.prompts.map(p => p.d.type)]);
  }
  {
    const t = await H.fresh({ hand: [[CARD], []], discard: [['Fireball', 'Icebolt'], []], deck: [['Draw', 'Archer'], []] });
    t.gs.players[0].handLocked = true;
    const r = await t.play(0, CARD, { hero: 0 });
    R.check('Hand-Sperre: kein Hand-Weg, kein Ziehen — Karte wirkt als Misch-Weg ohne Draw', r === true && t.pile(0, 'hand').length === 0, [r, t.pile(0, 'hand')]);
  }
  {
    const t = await H.fresh({ hand: [[CARD, 'Distracting Crystal'], []], discard: [['Fireball'], []] });
    answer('hand', ['Fireball'])(t);
    const r = await t.play(0, CARD, { hero: 0 });
    R.check('Distracting Crystal auf der Hand sperrt die Karte', r === false && t.pile(0, 'hand').includes(CARD), r);
  }

  R.section('H · Deck leer / ziehen verboten');
  {
    const t = await H.fresh({ hand: [[CARD], []], discard: [['Fireball'], []], deck: [[], []] });
    answer('mischen', ['Fireball'])(t);
    const r = await t.play(0, CARD, { hero: 0 });
    R.check('leeres Deck: Fireball zurück, gemischt, gezogen = Fireball auf der Hand', r === true && t.pile(0, 'hand').includes('Fireball') && t.pile(0, 'mainDeck').length === 0, [t.pile(0, 'hand'), t.pile(0, 'mainDeck')]);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('I · Besitz: gestohlene Meditation geht in den Löschstapel des BESITZERS');
  {
    const t = await H.fresh({ hand: [[], [CARD]], discard: [['Fireball'], ['Icebolt']] });
    await t.run(() => t.engine.actionStealFromHand(0, { preselectedIndices: [0], sourceName: 'test' }));
    R.check('Meditation jetzt auf Sitz 0', t.pile(0, 'hand').includes(CARD), t.pile(0, 'hand'));
    answer('hand', ['Fireball'])(t);
    const r = await t.play(0, CARD, { hero: 0 });
    R.check('gespielt', r === true, r);
    R.check('im Löschstapel des Besitzers (Sitz 1), nicht beim Dieb', t.pile(1, 'deletedPile').includes(CARD) && !t.pile(0, 'deletedPile').includes(CARD), [t.pile(0, 'deletedPile'), t.pile(1, 'deletedPile')]);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('J · von „No Retreat!" negiert: nichts passiert, Rundensperre unverbraucht, zweite Meditation wirkt');
  {
    const t = await H.fresh({ hand: [[CARD, CARD], ['No Retreat!']], discard: [['Fireball', 'Icebolt'], []], deck: [['Draw', 'Archer'], []] });
    t.grantFor(1, 0, 'No Retreat!');
    t.script.push({ match: d => d && d.type === 'confirm', answer: () => ({ confirmed: true }), once: true });
    answer('hand', ['Fireball'])(t);
    await t.play(0, CARD, { hero: 0 });
    R.check('negiert: Ablage unverändert, keine Karte auf der Hand außer der zweiten Meditation', t.pile(0, 'discardPile').filter(n => n === 'Fireball' || n === 'Icebolt').length === 2 && !t.pile(0, 'hand').includes('Fireball'), [t.pile(0, 'discardPile'), t.pile(0, 'hand')]);
    R.check('negiert: Rundensperre NICHT gestempelt', !Object.keys(t.gs.hoptUsed || {}).some(k => k.includes(CARD)), t.gs.hoptUsed);
    R.check('negierte Meditation liegt in der Ablage (nicht im Löschstapel)', t.pile(0, 'discardPile').includes(CARD) && !t.pile(0, 'deletedPile').includes(CARD), [t.pile(0, 'discardPile'), t.pile(0, 'deletedPile')]);
    answer('hand', ['Fireball'])(t);
    const r2 = await t.play(0, CARD, { hero: 0 });
    R.check('zweite Meditation im selben Zug ist spielbar und wirkt', r2 === true && t.pile(0, 'hand').includes('Fireball'), [r2, t.pile(0, 'hand')]);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.finish();
})();
