'use strict';
// M02-10 · Ein NEGIERTER Trank verbraucht seine Einmal-Grenze nicht (Teleportation Powder, Resuscitation Potion, Magnetic Potion, Sword in a Bottle)
// Kartentexte: Teleportation Powder „You can only play 1 'Teleportation Powder' per game." · Resuscitation Potion „… only play 1 … per game." ·
//   Magnetic Potion „You can only play 1 'Magnetic Potion' per turn." · Sword in a Bottle „You can only play 1 'Sword in a Bottle' per turn."
// Ruling (CARD_API.md „Die geteilte Divine-Gift-Grenze", v1031): „Der Stempel sitzt dort, wo die Karte die Hand verlässt – ab da IST sie aktiviert …,
//   unabhängig davon, ob ein Gegenzug sie später negiert." (gleiche Klasse wie S01-01).
// Erwartung: wird der Trank von der Reaktion „The Master's Plan" negiert, gilt er als gespielt: eine zweite Kopie im selben Zug / späteren Zug der Partie ist nicht spielbar.
// Beobachtet: `server.js` doUsePotion/doConfirmPotion stempeln (`_markOncePerGamePotion`, HOPT im `resolve`) nur im Nicht-Negations-Zweig; der Trank geht in die Ablage,
//   `_oncePerGameUsed` bleibt leer, die zweite Kopie wird ohne Weiteres gespielt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const heroT = (seat, hi) => (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === seat && x.heroIdx === hi); return v ? [v.id] : null; };
  const faelle = [
    ['Teleportation Powder', heroT(1, 0), () => {}],
    ['Magnetic Potion', heroT(1, 0), () => {}],
    ['Sword in a Bottle', (valid) => [valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 1).id, valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id], () => {}],
    ['Resuscitation Potion', heroT(0, 2), t => { t.gs.players[0].heroes[2].hp = 0; }],
  ];
  for (const [name, tf, setup] of faelle) {
    const t = await H.fresh({ hand: [[name, name], ["The Master's Plan"]], hp: 800, deck: [Array(10).fill('Fighting'), Array(10).fill('ZZ Dummy')] });
    t.setAbilities(1, 0, [['Decay Magic', 'Decay Magic', 'Decay Magic'], [], []]);   // Sitz 1 kann The Master's Plan wirken
    setup(t);
    t.targetFn = tf; t.policy.confirm = true;
    t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => ({ cardName: d.cards[0].name }) });
    await t.play(0, name, { handIndex: 0 });
    const negiert = !t.pile(1, 'hand').includes("The Master's Plan");
    t.policy.confirm = false; t.reset();
    const idx = t.pile(0, 'hand').indexOf(name);
    await t.play(0, name, { handIndex: idx });
    const zweiteGespielt = !t.pile(0, 'hand').includes(name);
    R.check(`${name}: erste Kopie wurde negiert (Voraussetzung)`, negiert, { hand1: t.pile(1, 'hand') });
    R.check(`${name}: zweite Kopie ist NICHT mehr spielbar`, !zweiteGespielt, { hand0: t.pile(0, 'hand'), stempel: [...(t.gs.players[0]._oncePerGameUsed || [])], hopt: t.gs.hoptUsed });
  }
  R.finish();
})();
