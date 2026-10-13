'use strict';
// S01-25 · Mehrstufige Zielwahlen ohne Abbruch-Knopf vor dem Zusagepunkt (Regel 23.9, CARD_API.md Z. 367-395)
// Regel: „Jede Zielwahl hat einen Cancel-Button — Ziel-Prompt, Galerie, Zonenwahl, jede Stufe einer mehrstufigen Auswahl: `cancellable: true`. Ausnahme ist nur, was nach dem Zusagepunkt kommt …
//   oder eine Pflichtwahl, die der Kartentext erzwingt — dann steht der Grund als Kommentar daneben."
// Geprüft wird, ob die Wahl-Abfragen dieser Karten `cancellable: false` tragen, obwohl noch nichts verbraucht ist:
//   Divine Gift of Sacrifice (Opferwahl UND Buff-Wahl; geopfert wird erst NACH beiden), Divine Gift of Equality (Zweitziel; revive/halve erst danach), Create Illusion (Zonenwahl; das Deck wird erst danach angefasst).
// Beobachtet: alle diese Abfragen sind `cancellable: false` (kein Knopf, der Spieler kann nicht mehr zurück); ein Abbruch mit `null` (wie bei den Harness-Skripten) wird vom Skript sauber verarbeitet – es fehlt nur der Knopf.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  // Divine Gift of Sacrifice
  let t = await H.fresh({ hand: [['Divine Gift of Sacrifice'], []], abilities: { 0: { 0: [['Decay Magic'], [], []] } } });
  t.targetFn = (v, cfg) => { return call(1) ? [v.find(x => x.id === 'hero-0-1').id] : [v.find(x => x.id === 'hero-0-0').id]; };
  let n = 0; const call = (k) => { n++; return n === 1; };
  await t.play(0, 'Divine Gift of Sacrifice', { hero: 0 });
  const stufen = t.targets.map(x => x.config && x.config.cancellable);
  R.check('Divine Gift of Sacrifice: jede Wahlstufe ist abbrechbar', stufen.length >= 1 && stufen.every(c => c === true), stufen);
  // Divine Gift of Equality
  t = await H.fresh({ hand: [['Divine Gift of Equality'], []], abilities: { 0: { 0: [['Support Magic'], [], []] } } });
  t.gs.players[0].heroes[1].hp = 0;
  let k = 0;
  t.targetFn = (v) => { k++; return k === 1 ? ['hero-0-1'] : [v.find(x => x.id === 'hero-1-0').id]; };
  await t.play(0, 'Divine Gift of Equality', { hero: 0, noGrant: true });
  const st2 = t.targets.map(x => x.config && x.config.cancellable);
  R.check('Divine Gift of Equality: jede Wahlstufe ist abbrechbar', st2.length >= 2 && st2.every(c => c === true), st2);
  // Create Illusion (Zonenwahl)
  t = await H.fresh({ hand: [['Create Illusion'], []], deck: [['Elven Archer', 'Fireball'], []], abilities: { 0: { 0: [['Magic Arts'], [], []] } } });
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Create Illusion', answer: () => ({ cardName: 'Elven Archer' }) });
  await t.play(0, 'Create Illusion', { hero: 0, noGrant: true });
  const zp = t.prompts.filter(p => p.d.type === 'zonePick').map(p => p.d.cancellable);
  R.check('Create Illusion: die Zonenwahl ist abbrechbar', zp.length >= 1 && zp.every(c => c === true), zp);
  R.finish();
})();
