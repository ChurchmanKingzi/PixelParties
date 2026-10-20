'use strict';
// W24d · Frost-Grundsatz bei festen Dauern (Al, Welle 24, zu N4-17): „Frost endet am Ende des Zuges des Besitzers des gefrorenen Ziels."
//   Wirkung im Zug des Zielbesitzers = bis zu dessen Zugende; Wirkung im Zug des Gegners = bis Ende des nächsten Zuges des Zielbesitzers, wo der Text „1 turn" nennt
//   („N turns" = N solcher Zugenden).
// Gemessen werden die Frostzustände zu Beginn der folgenden Züge für Karten mit fester Dauer (Held UND Kreatur, eigenes UND gegnerisches Ziel):
//   Icebolt („1 turn"), Snow Cannon („1 turn", nur Ziel des Gegners), Icy Grave („2 turns").
// Zug 5 gehört Sitz 0 (er wirkt). Zustand je Zugbeginn: Z5 (nach der Wirkung), Z6 (Gegner), Z7 (Sitz 0), Z8 (Gegner), Z9.
const H = require('../../lib/h.js');
const NEUTRAL = H.BLANK_HEROES;
async function lauf(karte, ziel) {
  const t = await H.fresh({ hand: [[karte], ['ZZ Filler']], deckSize: 30 });
  const ec = t.put(0, 1, 0, H.INERT.big); ec.turnPlayed = 1;     // eigene Kreatur
  const fc = t.put(1, 1, 0, H.INERT.big); fc.turnPlayed = 1;     // gegnerische Kreatur
  t.targetFn = (valid) => {
    const w = {
      'eigener-held': v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 2,
      'gegner-held': v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 2,
      'eigene-kreatur': v => v.type === 'equip' && v.owner === 0,
      'gegner-kreatur': v => v.type === 'equip' && v.owner === 1,
    }[ziel];
    return [valid.find(w).id];
  };
  const r = await t.play(0, karte, { hero: 0 });
  const fr = () => ziel === 'eigener-held' ? !!t.hero(0, 2).statuses.frozen
    : ziel === 'gegner-held' ? !!t.hero(1, 2).statuses.frozen
    : ziel === 'eigene-kreatur' ? !!ec.counters.frozen : !!fc.counters.frozen;
  const v = [fr() ? 'F' : '-'];
  for (let i = 0; i < 4; i++) { await t.endTurn(); v.push(fr() ? 'F' : '-'); }
  return { t, r, v: v.join('') };
}
(async () => {
  const R = H.runner();
  // Erwartete Folgen Z5 Z6 Z7 Z8 Z9
  const faelle = [
    ['Icebolt', 'eigener-held', 'F----'],      // eigenes Ziel, eigener Zug: nur bis Zugende
    ['Icebolt', 'eigene-kreatur', 'F----'],
    ['Icebolt', 'gegner-held', 'FF---'],       // fremdes Ziel: bis Ende SEINES nächsten Zuges (Z6)
    ['Icebolt', 'gegner-kreatur', 'FF---'],
    ['Snow Cannon', 'gegner-held', 'FF---'],
    ['Snow Cannon', 'gegner-kreatur', 'FF---'],
    ['Icy Grave', 'gegner-held', 'FFFF-'],     // „2 turns": Zugenden von Z6 und Z8
    ['Icy Grave', 'gegner-kreatur', 'FFFF-'],
    ['Icy Grave', 'eigener-held', 'FFF--'],    // eigenes Ziel im eigenen Zug: Zugenden von Z5 und Z7 (gefroren bis Ende Z7)
    ['Icy Grave', 'eigene-kreatur', 'FFF--'],
  ];
  for (const [karte, ziel, soll] of faelle) {
    const x = await lauf(karte, ziel);
    // „F" an der Stelle Z6/Z7/… = das Ziel ist zu Beginn dieses Zuges noch gefroren (Z5 = direkt nach der Wirkung).
    R.check(`${karte} auf ${ziel}: ${x.v} (erwartet ${soll})`, x.r === true && x.v === soll, { v: x.v, r: x.r, errors: x.t.errors });
  }
  R.finish();
})();
