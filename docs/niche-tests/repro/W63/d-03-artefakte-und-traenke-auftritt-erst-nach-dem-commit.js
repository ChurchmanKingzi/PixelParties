'use strict';
// W63d-03 · Artefakte und Tränke mit abbrechbaren Fragen: der Auftritt kommt erst nach dem Commit (Al, 22.10.2026)
//
// Regel (CARD_API „Auftritt streamen — erst nach dem Commit"): erst wenn nichts mehr abgebrochen werden kann, sieht der Gegner die Karte.
// Der Befund an Treasure Hunter's Backpack (d-01) war ein ZIEL-ARTEFAKT ohne `deferReveal`: `doConfirmPotion` zeigte die Karte sofort. Dasselbe galt für jedes zielende Artefakt/jeden zielenden
//   Trank ohne dieses Flag; zusätzlich schickte der Server `potion_resolved` (Auflösungs-Animation) beim START der Auflösung — vor den abbrechbaren Fragen der Karte (Blood-Soaked Coin: Schadenshöhe).
// Vorher verletzten u. a.: Blood-Soaked Coin, Cool Repair, Difficulty Lever, The Eye of Ren, Mysterious Core, Magic Cobalt/Ruby/Sapphire (mehrstufig), Sword in a Bottle, Ladder to the Sky (Opferwahl),
//   Overflowing Chalice, Bottled Flame/Lightning. Szene: reiche Standard-Szene; MENSCH-Modus; Leitung zu Gegner und Zuschauer aufgezeichnet.
// Je Karte: ein Durchlauf + ein Abbruch an JEDER abbrechbaren Stelle. Exit 0 = korrekt.
const W = require('../../lib/wire.js');
// [Karte, erwartete Mindestzahl abbrechbarer Stellen, auch Sitz 1?]
const KARTEN = [
  ['Blood-Soaked Coin', 2, true], ['Cool Repair', 2, false], ['Difficulty Lever', 2, false], ['The Eye of Ren', 2, false],
  ['Mysterious Core', 3, false], ['Magic Cobalt', 2, false], ['Magic Ruby', 2, false],
  ['Ladder to the Sky', 1, false],
  ['Sword in a Bottle', 1, false],
];
// Bewusst NICHT hier: Karten, deren erste Frage an den GEGNER geht (Overflowing Chalice, Bottled Flame/Lightning: „der Gegner wählt zuerst") — dort muss der Gegner die Karte
// vor seiner Frage sehen (Auftritt = Commit, s. d-06), und die späteren „abbrechbaren" Fragen des Spielers (Abwurf annehmen?) geben die Karte nicht mehr zurück.
// Sword in a Bottle: zwei Ziele (eigener Held als Angreifer + Ziel des Gegners), eines je Seite.
const antwort = (e) => {
  if (e.kind === 'session' && /Sword in a Bottle/.test(e.d.title || '')) {
    const eigen = e.valid.find(v => v.owner === e.pi || v.seite === e.pi), fremd = e.valid.find(v => (v.seite ?? v.owner) !== e.pi);
    return eigen && fremd ? [eigen.id, fremd.id] : undefined;
  }
  return undefined;
};
(async () => {
  const R = W.runner();
  for (const [karte, nCanc, auchSitz1] of KARTEN) {
    for (const seat of auchSitz1 ? [0, 1] : [0]) {
      const label = `${karte}${seat ? ' (Sitz 1)' : ''}`;
      R.section(label);
      const mk = () => W.reicheSzene({ seat, karten: [karte] });
      const d = await W.durchlauf(mk, seat, karte, { seat, hero: 0, maxCancel: 6, answer: antwort });
      W.pruefeDurchlauf(R, label, d, { seat, nCanc, keinAuftritt: false });
    }
  }
  R.finish();
})();
