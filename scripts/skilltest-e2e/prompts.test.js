'use strict';
// Antworten der Bots auf Auswahl-Abfragen bestimmter Zauber (skilltest/prompts.js).
//   node scripts/skilltest-e2e/prompts.test.js
process.env.PP_ST_SIM = '1';
const P = require('../../skilltest/prompts');
const { runGame } = require('../../skilltest/sim');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

(async () => {
  const oL = console.log, oE = console.error;
  console.log = () => {}; console.error = () => {};
  const out = await runGame({ seats: 3, setupOnly: true, noProfileSeats: [0, 1, 2], seed: 61 });
  console.log = oL; console.error = oE;
  const { engine, gs } = out;

  console.log('Zuständigkeit');
  check('Nur ausdrücklich gelistete, abbrechbare Abfragen', P.handles({ type: 'cardNamePicker', title: 'Accusation', cancellable: true })
    && !P.handles({ type: 'cardNamePicker', title: 'Accusation', cancellable: false })
    && !P.handles({ type: 'cardNamePicker', title: 'Irgendein Zauber', cancellable: true })
    && !P.handles({ type: 'confirm', title: 'Accusation', cancellable: true }));
  check('Unbekannte Abfrage → undefined (Standardverhalten)', P.answer(engine, 0, { type: 'cardGallery', title: 'Fremde Karte', cancellable: true, cards: [{ name: 'Fireball' }] }) === undefined);

  console.log('Kartenname ansagen (Accusation, Spreading Rumor)');
  gs.players[1].hand = ['Fireball', 'Fireball', 'Haste'];
  gs.players[2].hand = ['Fireball', 'Wheels'];
  gs.players[0].hand = ['Haste', 'Haste', 'Haste'];
  const names = ['Fireball', 'Haste', 'Wheels', 'Alchemy', 'Leadership'];
  let r = P.answer(engine, 0, { type: 'cardNamePicker', title: 'Accusation', cancellable: true, cardNames: names });
  check('der Bot nennt die Karte, die die Gegner am häufigsten auf der Hand haben (nicht die eigene)', r && r.cardName === 'Fireball', r);
  gs.players[1].hand = []; gs.players[2].hand = [];
  r = P.answer(engine, 0, { type: 'cardNamePicker', title: 'Spreading Rumor', cancellable: true, cardNames: names });
  check('ohne Anhaltspunkt: irgendein erlaubter Name', r && names.includes(r.cardName), r);
  check('leere Namensliste → null', P.answer(engine, 0, { type: 'cardNamePicker', title: 'Accusation', cancellable: true, cardNames: [] }) === null);

  console.log('Karte suchen (Gate to the Armory)');
  r = P.answer(engine, 0, { type: 'cardGallery', title: 'Gate to the Armory', cancellable: true, cards: [{ name: 'Idej Blade - Hakai', source: 'deck' }, { name: 'The Sun Sword', source: 'discard' }] });
  check('eine der angebotenen Karten, mit Herkunft', r && ['Idej Blade - Hakai', 'The Sun Sword'].includes(r.cardName) && ['deck', 'discard'].includes(r.source), r);

  console.log('Skeletons erwecken (Raise the Minions!)');
  r = P.answer(engine, 0, { type: 'cardGalleryMulti', title: 'Raise the Minions!', cancellable: true, selectCount: 3, minSelect: 1, allowDuplicates: true,
    cards: [{ name: 'Skeleton Archer', count: 2 }, { name: 'Skeleton Reaper', count: 1 }, { name: 'Skeleton Bard', count: 1 }] });
  check('so viele wie erlaubt (3), Kopien einzeln, nie mehr als vorhanden', r && r.selectedCards.length === 3 && r.selectedCards.filter(n => n === 'Skeleton Archer').length <= 2, r);
  r = P.answer(engine, 0, { type: 'cardGalleryMulti', title: 'Raise the Minions!', cancellable: true, selectCount: 1, minSelect: 1, cards: [{ name: 'Skeleton Archer', count: 2 }] });
  check('Obergrenze 1 wird eingehalten', r && r.selectedCards.length === 1, r);

  console.log('Karten zurückholen (Spontaneous Reappearance)');
  const pile = ['Fireball', 'Haste', 'Wheels', 'Alchemy', 'Leadership', 'Fireball'].map((name, i) => ({ name, source: 'discard', _discardIdx: i }));
  r = P.answer(engine, 0, { type: 'cardGalleryMulti', title: 'Spontaneous Reappearance', cancellable: true, cards: pile, selectCount: pile.length, minSelect: 0 });
  check('höchstens 3 Karten (jede zwei kosten einen Pollution Token)', r && r.selectedCards.length === 3 && r.selectedCards.every(n => pile.some(c => c.name === n)), r);
  check('leere Ablage → null', P.answer(engine, 0, { type: 'cardGalleryMulti', title: 'Spontaneous Reappearance', cancellable: true, cards: [], selectCount: 0, minSelect: 0 }) === null);

  console.log(fails ? `\n✗ ${fails} Fehler` : '\n✓ Auswahl-Antworten-Tests grün');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
