'use strict';
// W17c · F01-17 Bow of the Hunt Goddess — jeder Arrow aus dem Deck läuft sauber durch die Kette (Dauerfeuer über die Pfeil-Familie)
// Erwartung: Für jeden Arrow (Angelfeather, Bomb, Flame, Golden, Hydra Blood, Poisoned, Racket, Rainbow's) gilt: vom Bow gewählt → aus dem Deck, Kosten bezahlt, in der Ablage (nicht auf der Hand),
//   Kartenbilanz sauber, keine Engine-Fehler, keine Hänger. Gegenprobe: Rainbow's Arrow zieht 2 Karten (Wirkung wie aus der Hand), Angelfeather macht +60.
const H = require('../../lib/h.js');
const BOW = 'Bow of the Hunt Goddess';
const KOSTEN = { 'Angelfeather Arrow': 5, 'Bomb Arrow': 5, 'Flame Arrow': 5, 'Hydra Blood Arrow': 5, 'Poisoned Arrow': 5, 'Racket Arrow': 2, "Rainbow's Arrow": 10 };
const PFEILE = ['Angelfeather Arrow', 'Bomb Arrow', 'Flame Arrow', 'Golden Arrow', 'Hydra Blood Arrow', 'Poisoned Arrow', 'Racket Arrow', "Rainbow's Arrow"];
(async () => {
  const R = H.runner();
  const kontrolle = await (async () => {   // derselbe Angriff ohne Bow
    const t = await H.fresh({ hand: [['Attack'], []], gold: [100, 100] });
    t.put(1, 0, 0, H.INERT.big);
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    const hp0 = t.hp(1, 0); await t.play(0, 'Attack', { hero: 0 }); return hp0 - t.hp(1, 0);
  })();
  for (const pfeil of PFEILE) {
    const t = await H.fresh({ hand: [['Attack'], []], deck: [[pfeil, 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy'], undefined], gold: [100, 100] });
    t.put(0, 0, 0, BOW);
    t.put(1, 0, 0, H.INERT.big);   // Ziel für Bomb/Racket Arrow
    t.policy.confirm = true;
    t.targetFn = (valid) => [(valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0) || valid[0]).id];
    t.script.push({ match: d => d.type === 'cardGallery' && /Bow/.test(d.title || ''), answer: () => ({ cardName: pfeil, source: 'deck' }), once: true });
    const hand0 = t.pile(0, 'hand').length, hp0 = t.hp(1, 0);
    const r = await t.play(0, 'Attack', { hero: 0 });
    const kosten = 100 - t.gs.players[0].gold;
    R.check(pfeil + ': gespielt (Ablage, nicht Hand/Deck)', r === true && t.pile(0, 'discardPile').includes(pfeil) && !t.pile(0, 'hand').includes(pfeil) && !t.pile(0, 'mainDeck').includes(pfeil), { r, d: t.pile(0, 'discardPile'), h: t.pile(0, 'hand') });
    // Golden Arrow kostet 0 und zahlt Gold für den Schaden aus (Kontostand darf steigen).
    R.check(pfeil + ': Kosten bezahlt (' + kosten + ' Gold)', pfeil === 'Golden Arrow' ? kosten <= 0 : kosten === KOSTEN[pfeil], { kosten });
    if (pfeil === "Rainbow's Arrow") R.check("Rainbow's Arrow zog 2 Karten", t.pile(0, 'hand').length === hand0 - 1 + 2, t.pile(0, 'hand'));
    if (pfeil === 'Angelfeather Arrow') R.check('Angelfeather Arrow: +60 Schaden gegenüber dem Angriff ohne Bow', hp0 - t.hp(1, 0) === kontrolle + 60, { verlust: hp0 - t.hp(1, 0), kontrolle });
    R.check(pfeil + ': Zustand sauber, keine Engine-Fehler', t.audit().length === 0 && t.errors.length === 0, { a: t.audit(), e: t.errors });
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
