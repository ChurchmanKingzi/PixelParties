'use strict';
// W63c-07 · Skripte, die eine fremde Karte NUR über `inst.originalOwner` der Hand-Instanz kennzeichnen (Letter of Misinformations, Magic Lamp,
// Birthday Present, ältere Wege …) — ohne die Platzmarke `_handOriginals`. Die Herkunft muss trotzdem greifen, auf jedem Austritt der Hand:
// Abwerfen, Löschen, Spell spielen, Zurückmischen, Mulligan, Handlimit, Ausrüsten/Beschwören (Brett) — und eine eigene Karte desselben Namens
// bleibt davon unberührt.
// Alter Stand: ohne Platzmarke las `_handCardPileOwner` nach dem Splice „eigene Karte" (Einzelsatz der Entnahme) — Ablage/Deck des Halters.
const B = require('../../lib/besitzer.js');
const { H } = B;
(async () => {
  const R = H.runner();
  const geben = async (halter, besitzer, karte, extraHand = []) => {
    const hand = [[], []]; hand[halter] = [...extraHand];
    const t = await H.fresh({ hand, deck: [Array(10).fill('ZZ Trinket'), Array(10).fill('ZZ Trinket')] });
    t.dieb = halter; t.besitzer = besitzer;
    const inst = t.engine.handZugangSync(halter, karte, { source: 'Test' });   // Hand + Instanz, KEINE Platzmarke
    inst.originalOwner = besitzer;
    return t;
  };
  const wege = [
    ['Abwerfen', 'Fireball', 'discardPile', (t) => t.run(() => t.engine.actionDiscardHandCard(t.dieb, 'Fireball', t.pile(t.dieb, 'hand').indexOf('Fireball'), {}))],
    ['Zwangsabwurf', 'Fireball', 'discardPile', async (t) => { t.script.push({ match: d => d.type === 'forceDiscard', answer: () => ({ cardName: 'Fireball', handIndex: t.pile(t.dieb, 'hand').indexOf('Fireball') }) }); await t.run(() => t.engine.actionPromptForceDiscard(t.dieb, 1, { selfInflicted: true })); }],
    ['Zwangs-Löschen', 'Fireball', 'deletedPile', async (t) => { t.script.push({ match: d => d.type === 'forceDiscard', answer: () => ({ cardName: 'Fireball', handIndex: t.pile(t.dieb, 'hand').indexOf('Fireball') }) }); await t.run(() => t.engine.actionPromptForceDiscard(t.dieb, 1, { selfInflicted: true, deleteMode: true })); }],
    ['Spell spielen', 'Fireball', 'discardPile', async (t) => { t.targetFn = v => [v.find(x => x.type === 'hero' && x.owner === t.besitzer && x.heroIdx === 0).id]; await t.play(t.dieb, 'Fireball', { hero: 0 }); }],
    ['Handlimit', 'Fireball', 'discardPile', async (t) => { t.script.push({ match: d => d.type === 'forceDiscard', answer: () => ({ cardName: 'Fireball', handIndex: t.pile(t.dieb, 'hand').indexOf('Fireball') }) }); await t.run(() => t.engine.enforceHandLimit(t.dieb, { maxSize: 1 })); }],
    ['Zurückmischen', 'Fireball', 'mainDeck', (t) => t.run(() => t.engine.actionShuffleBackToDeck(t.dieb, ['Fireball'], 'Test'))],
    ['Mulligan', 'Fireball', 'mainDeck', (t) => t.run(() => t.engine.actionMulliganCards(t.dieb, ['Fireball'], [t.pile(t.dieb, 'hand').indexOf('Fireball')]))],
  ];
  for (const halter of [0, 1]) {
    R.section(`── Halter = Sitz ${halter} ──`);
    for (const [name, karte, stapel, fn] of wege) {
      const t = await geben(halter, 1 - halter, karte, ['ZZ Filler']);
      await fn(t);
      B.erwarteStapel(R, t, `${name} (Halter ${halter})`, karte, 1 - halter, stapel);
    }
    // Brett: Ausrüstung
    {
      const t = await geben(halter, 1 - halter, 'Blade of the Frostbringer', ['ZZ Filler']);
      await t.play(halter, 'Blade of the Frostbringer', { hero: 0 });
      await B.zerstoere(t, 'Blade of the Frostbringer');
      B.erwarteStapel(R, t, `Ausrüstung zerstört (Halter ${halter})`, 'Blade of the Frostbringer', 1 - halter, 'discardPile');
    }
    // Gegenprobe: zwei Kopien, die EIGENE zuerst – eigene Kopie bleibt eigen
    {
      const t = await geben(halter, 1 - halter, 'Fireball', ['Fireball']);   // Hand: [Fireball (eigen), Fireball (fremd)]
      await t.run(() => t.engine.actionDiscardHandCard(halter, 'Fireball', 0, {}));
      R.check(`Gegenprobe eigene Kopie (Halter ${halter}) → eigene Ablage`, B.anzahl(t, halter, 'discardPile', 'Fireball') === 1 && B.anzahl(t, 1 - halter, 'discardPile', 'Fireball') === 0, B.ort(t, 'Fireball'));
      await t.run(() => t.engine.actionDiscardHandCard(halter, 'Fireball', 0, {}));
      R.check(`Gegenprobe fremde Kopie (Halter ${halter}) → Ablage des Besitzers`, B.anzahl(t, 1 - halter, 'discardPile', 'Fireball') === 1, B.ort(t, 'Fireball'));
    }
  }
  R.finish();
})();
