'use strict';
// M02-10 · Ein GANZ negierter Trank verbraucht seine Einmal-Grenze NICHT (Teleportation Powder, Resuscitation Potion: pro Spiel; Magnetic Potion, Sword in a Bottle: pro Zug) (Als Entscheidung, Welle 3)
// Kartentexte: Teleportation Powder „You can only play 1 'Teleportation Powder' per game." · Resuscitation Potion „… only play 1 … per game." ·
//   Magnetic Potion „You can only play 1 'Magnetic Potion' per turn." · Sword in a Bottle „You can only play 1 'Sword in a Bottle' per turn."
// REGEL (CARD_API.md „★ Z7b", ersetzt Ruling v1031 / Z7): wird der Trank von The Master's Plan komplett negiert, hat er nie aufgelöst → Einmal-Slot unverbraucht (auch „per game");
//   eine zweite Kopie im selben Zug ist spielbar.
// Exit 1 (Fehler tritt auf) = die negierte erste Kopie hat den Slot verbraucht (zweite Kopie nicht spielbar).
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
    R.check(`${name}: zweite Kopie ist spielbar (der Slot ist unverbraucht)`, zweiteGespielt, { hand0: t.pile(0, 'hand'), stempel: [...(t.gs.players[0]._oncePerGameUsed || [])], hopt: t.gs.hoptUsed });
  }
  R.finish();
})();
