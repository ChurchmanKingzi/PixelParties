'use strict';
// W63c-01 · Charme Lv 2 — die gestohlene Handkarte gehört weiter ihrem BESITZER.
// Kartentext Charme 2): „You may once per turn make your opponent add a card from their hand to yours."
// Regel (CARD_API „Besitzer-Regel (W3)", Al 14.10.2026): Karten landen immer in Deck/Ablage/Löschstapel ihres permanenten Besitzers, egal wer sie hält.
// Aufbau: Sitz `dieb` hat Charme Lv 2 und klaut `karte` aus der Hand des Sitzes `besitzer`. Danach verlässt die Karte die Hand des Diebs auf JEDEM Weg:
// Abwerfen (Zwang / gezielt / Mehrfach / Handlimit), Löschen (Zwang im deleteMode / Handlimit-deleteMode), Spell, Potion, Artefakt spielen,
// Zurückmischen, Mulligan. Beide Sitze als Dieb; Gegenprobe: eine EIGENE Karte desselben Namens landet beim Halter.
const B = require('../../lib/besitzer.js');
const { H } = B;
(async () => {
  const R = H.runner();
  const wege = [
    ['Zwangsabwurf', 'Fireball', 'discardPile', async (t, c) => {
      t.script.push({ match: d => d.type === 'forceDiscard', answer: () => ({ cardName: c, handIndex: t.pile(t.dieb, 'hand').indexOf(c) }) });
      await t.run(() => t.engine.actionPromptForceDiscard(t.dieb, 1, { title: 'Test', selfInflicted: true }));
    }],
    ['gezielter Abwurf', 'Fireball', 'discardPile', (t, c) => t.run(() => t.engine.actionDiscardHandCard(t.dieb, c, t.pile(t.dieb, 'hand').indexOf(c), {}))],
    ['actionDiscardCards', 'Fireball', 'discardPile', async (t, c) => { t.pile(t.dieb, 'hand').splice(0, 1); await t.run(() => t.engine.actionDiscardCards(t.dieb, 1, {})); }],
    ['actionDiscardCardsAnimated', 'Fireball', 'discardPile', async (t, c) => { t.pile(t.dieb, 'hand').splice(0, 1); await t.run(() => t.engine.actionDiscardCardsAnimated(t.dieb, 1, {})); }],
    ['Handlimit (Ablage)', 'Fireball', 'discardPile', async (t, c) => {
      t.script.push({ match: d => d.type === 'forceDiscard', answer: () => ({ cardName: c, handIndex: t.pile(t.dieb, 'hand').indexOf(c) }) });
      await t.run(() => t.engine.enforceHandLimit(t.dieb, { maxSize: 1 }));
    }],
    ['Handlimit (deleteMode)', 'Fireball', 'deletedPile', async (t, c) => {
      t.script.push({ match: d => d.type === 'forceDiscard', answer: () => ({ cardName: c, handIndex: t.pile(t.dieb, 'hand').indexOf(c) }) });
      await t.run(() => t.engine.enforceHandLimit(t.dieb, { maxSize: 1, deleteMode: true }));
    }],
    ['Zwangs-Löschen (deleteMode)', 'Fireball', 'deletedPile', async (t, c) => {
      t.script.push({ match: d => d.type === 'forceDiscard', answer: () => ({ cardName: c, handIndex: t.pile(t.dieb, 'hand').indexOf(c) }) });
      await t.run(() => t.engine.actionPromptForceDiscard(t.dieb, 1, { title: 'Test', selfInflicted: true, deleteMode: true }));
    }],
    ['Spell spielen', 'Fireball', 'discardPile', async (t, c) => {
      t.targetFn = v => [v.find(x => x.type === 'hero' && x.owner === t.besitzer && x.heroIdx === 0).id];
      await t.play(t.dieb, c, { hero: 0 });
    }],
    ['Potion spielen', 'Elixir of Strength', 'deletedPile', (t, c) => t.play(t.dieb, c, { hero: 0 })],
    ['Artefakt spielen', 'Beer', 'discardPile', (t, c) => t.play(t.dieb, c, { hero: 0 })],
    ['zurück ins Deck mischen', 'Fireball', 'mainDeck', (t, c) => t.run(() => t.engine.actionShuffleBackToDeck(t.dieb, [c], 'Test'))],
    ['Mulligan', 'Fireball', 'mainDeck', (t, c) => t.run(() => t.engine.actionMulliganCards(t.dieb, [c], [t.pile(t.dieb, 'hand').indexOf(c)]))],
  ];
  for (const dieb of [0, 1]) {
    R.section(`── Dieb = Sitz ${dieb} ──`);
    for (const [name, karte, stapel, fn] of wege) {
      const t = await B.charmeKlau(karte, dieb);
      if (!t.pile(dieb, 'hand').includes(karte)) { R.check(`${name}: ${karte} wurde geklaut`, false, t.pile(dieb, 'hand')); continue; }
      R.check(`${name}: nur die EINE Karte wanderte (Hand Dieb ${t.pile(dieb, 'hand').length}, Hand Besitzer ${t.pile(t.besitzer, 'hand').length})`, t.pile(t.besitzer, 'hand').length === 0);
      await fn(t, karte);
      B.erwarteStapel(R, t, `Dieb ${dieb} / ${name}`, karte, t.besitzer, stapel);
    }
    // Gegenprobe: EIGENE Karte gleichen Namens + eigene Karte, kein Charme → Stapel des Halters
    {
      const t = await H.fresh({ hand: [[], []] });
      t.setHand(dieb, ['Fireball']);
      await t.run(() => t.engine.actionDiscardHandCard(dieb, 'Fireball', 0, {}));
      B.erwarteStapel(R, t, `Gegenprobe eigene Karte (Sitz ${dieb})`, 'Fireball', dieb, 'discardPile');
    }
    // Gegenprobe 2: Dieb hält eine EIGENE Fireball und die gestohlene; die eigene abgeworfen → Dieb-Ablage, gestohlene bleibt in der Hand
    {
      const t = await B.charmeKlau('Fireball', dieb, { diebHand: ['Fireball'] });
      const hand = t.pile(dieb, 'hand');
      R.check(`Gegenprobe zwei Kopien (Sitz ${dieb}): Hand = [Fireball, Fireball]`, hand.length === 2 && hand.every(x => x === 'Fireball'), hand);
      await t.run(() => t.engine.actionDiscardHandCard(dieb, 'Fireball', 0, {}));   // Platz 0 = die EIGENE Kopie
      R.check(`Gegenprobe zwei Kopien (Sitz ${dieb}): eigene Kopie → Ablage des Diebs`, B.anzahl(t, dieb, 'discardPile', 'Fireball') === 1 && B.anzahl(t, t.besitzer, 'discardPile', 'Fireball') === 0, B.ort(t, 'Fireball'));
      await t.run(() => t.engine.actionDiscardHandCard(dieb, 'Fireball', 0, {}));   // jetzt die gestohlene
      R.check(`Gegenprobe zwei Kopien (Sitz ${dieb}): gestohlene Kopie → Ablage des Besitzers`, B.anzahl(t, dieb, 'discardPile', 'Fireball') === 1 && B.anzahl(t, t.besitzer, 'discardPile', 'Fireball') === 1, B.ort(t, 'Fireball'));
    }
  }
  R.finish();
})();
