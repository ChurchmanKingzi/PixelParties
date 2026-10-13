'use strict';
// F02-06 · Heart-Shaped Bow: Love-Shot-Angebot ist auf einmal pro Zug und Bogen begrenzt – im Kartentext steht das nicht
// Kartentext: „… When the equipped Hero performs an Attack, you may immediately perform a "Love Shot" Spell from your hand with it as an additional Action regardless of its level."
//   (Zum Vergleich Legendary Sword of a Barbarian King: „Once per turn, when the equipped Hero performs an Attack, …" – dort steht die Grenze im Text.)
// Aufbau: Held 0 trägt den Bogen; Hand [Attack, Attack, Love Shot, Love Shot]; Sitz 1 mit Füllkarten. Das Angebot wird beide Male angenommen.
// Schritte: 1. Mit Held 0 „Attack" spielen → Love-Shot-Angebot, annehmen. 2. Im selben Zug mit demselben Helden (nächste Zusatz-/Hauptaktion) erneut „Attack" spielen.
// Erwartet (Lesart ohne Grenze): auch beim zweiten Angriff wird das Love-Shot-Angebot gemacht.
// Beobachtet: beim zweiten Angriff kommt kein Angebot (`heart-shaped-bow….js` `ctx.hardOncePerTurn('heart-bow-love-shot:<id>')`, Kopfkommentar „HOPT je Bogen-Instanz").
// Hinweis: In der Harness setzt `t.play` die Aktionszähler zurück; im echten Spiel braucht ein zweiter Angriff desselben Helden eine zusätzliche Aktion.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const BOW = 'Heart-Shaped Bow, the Final Proof of Cuteness';
  const t = await H.fresh({ hand: [[BOW, 'Attack', 'Attack', 'Love Shot', 'Love Shot'], ['ZZ Filler', 'ZZ Filler']] });
  await t.play(0, BOW, { hero: 0 });
  t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
  t.script.push({ match: d => d.type === 'heroAction', answer: (d) => { const n = 'Love Shot'; if (!d.eligibleCards.includes(n)) return null; return { cardName: n, handIndex: t.pile(0, 'hand').indexOf(n) }; } });
  t.reset();
  await t.play(0, 'Attack', { hero: 0 });
  const angebote1 = t.prompts.filter(p => p.d.type === 'heroAction').length;
  R.check('1. Angriff: Love-Shot-Angebot', angebote1 === 1, angebote1);
  t.reset();
  await t.play(0, 'Attack', { hero: 0 });
  const angebote2 = t.prompts.filter(p => p.d.type === 'heroAction').length;
  R.check('2. Angriff im selben Zug: wieder ein Love-Shot-Angebot (Text nennt keine Grenze)', angebote2 === 1, { angebote2, hand: t.pile(0, 'hand') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
