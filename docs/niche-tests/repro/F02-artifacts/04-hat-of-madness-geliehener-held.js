'use strict';
// F02-04 · Hat of Madness feuert nicht, wenn der Träger von einem anderen Spieler kontrolliert wird
// Kartentext: „Whenever the equipped Hero performs an Action, its controller must add a card from their hand to their opponent's hand."
// Skriptkopf (`hat-of-madness.js`): „'its controller' ist der Spieler, der den Helden kontrolliert – also der Handelnde."
// Aufbau: Sitz 1 trägt an Held 0 den Hat of Madness (auf SEINER Seite, `t.put(1,0,0,…)`); Sitz 0 spielt Golden Apple und kontrolliert damit Held 0 von Sitz 1 für den Zug;
//   Sitz 0 hat Hand [Attack, ZZ Filler, ZZ Trinket]. Sitz 0 greift mit dem geliehenen Helden an (`charmedOwner: 1`) – echter Weg doPlaySpell.
// Erwartet: Der Kontrolleur (Sitz 0) muss eine Karte aus SEINER Hand dem Gegner (Sitz 1) geben (pickHandCard-Prompt für Sitz 0, Sitz 1 hat danach +1 Handkarte).
// Beobachtet: kein Prompt, keine Übergabe – der Hut schweigt. Gegenprobe (Block 1): Greift der Träger unter eigener Kontrolle an, feuert er.
// Ursache: `hat-of-madness.js` vergleicht `ctx.playerIdx` (Handelnder = Kontrolleur) mit `engine.physicalSide(hut)` (Brettseite) – beim geliehenen Helden sind beide verschieden.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  // Gegenprobe: eigener Held mit Hut
  let t = await H.fresh({ hand: [['Hat of Madness', 'Attack', 'ZZ Filler', 'ZZ Trinket'], ['ZZ Filler']] });
  await t.play(0, 'Hat of Madness', { hero: 0 });
  t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
  t.script.push({ match: d => d.type === 'pickHandCard', answer: (d) => ({ cardName: t.pile(0, 'hand')[d.eligibleIndices[0]], handIndex: d.eligibleIndices[0] }) });
  const h1Vor = t.pile(1, 'hand').length;
  await t.play(0, 'Attack', { hero: 0 });
  R.check('Gegenprobe: eigener Hut-Träger greift an → Karte wandert zum Gegner', t.pile(1, 'hand').length === h1Vor + 1, { h1: t.pile(1, 'hand') });

  // Befund: geliehener Held
  t = await H.fresh({ hand: [['Golden Apple', 'Attack', 'ZZ Filler', 'ZZ Trinket'], ['ZZ Filler']], gold: [100, 100] });
  t.put(1, 0, 0, 'Hat of Madness');
  t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
  await t.play(0, 'Golden Apple', { noAutoConfirm: false });
  R.check('Golden Apple: Held 0 von Sitz 1 ist übernommen', t.hero(1, 0).charmedBy === 0, t.hero(1, 0).charmedBy);
  t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 1).id];
  t.script.push({ match: d => d.type === 'pickHandCard', answer: (d) => ({ cardName: t.pile(0, 'hand')[d.eligibleIndices[0]], handIndex: d.eligibleIndices[0] }) });
  t.reset();
  const hand1Vor = t.pile(1, 'hand').length;
  const r = await t.play(0, 'Attack', { hero: 0, charmedOwner: 1 });
  R.check('Attack mit dem geliehenen Helden gespielt', r === true && 800 - t.hp(1, 1) > 0, { r, dmg: 800 - t.hp(1, 1) });
  R.check('Hut feuert: Kontrolleur (Sitz 0) gibt eine Karte an Sitz 1', t.pile(1, 'hand').length === hand1Vor + 1, { h0: t.pile(0, 'hand'), h1: t.pile(1, 'hand'), prompts: t.prompts.map(p => p.d.type) });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
