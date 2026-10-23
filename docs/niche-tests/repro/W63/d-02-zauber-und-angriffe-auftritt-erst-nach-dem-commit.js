'use strict';
// W63d-02 · Zauber/Angriffe mit abbrechbaren Fragen: der Auftritt kommt erst nach dem Commit (Al, 22.10.2026)
//
// Regel (CARD_API „Auftritt streamen — erst nach dem Commit"): Eine Karte streamed ihren Auftritt (Bild, Protokollzeile, Flug, Animation) an Gegner und Zuschauer IMMER erst, nachdem es keine
//   Cancel-Option mehr gibt. Solange der Spieler noch abbrechen kann (Zielwahl, Heldenwahl, Namenswahl, Galerie), darf der Gegner die Karte nicht sehen — sonst verrät ein Abbruch verdeckte Information.
// Vorher (Stand Welle 62) verletzten das u. a.: Anti Magic, Berserk, Curse, Overheal Shock … (Attachments: `hand_to_board_fly` mit dem Kartennamen beim Ablegen, VOR der abbrechbaren Zielwahl),
//   Spreading Rumor und Accusation (Früh-Auftritt vor dem abbrechbaren Namens-Dialog), Alluring Light, Capture, Golem Smash, Gate to the Armory, Create Illusion, Shapeshift (mehrstufige Wahl:
//   die erste bestätigte Antwort löste den Auftritt aus, die zweite Stufe war noch abbrechbar), Sacrifice to Divinity (Abbruch der Opferwahl schrieb eine Protokollzeile mit dem Kartennamen).
// Szene: reiche Standard-Szene (lib/wire.js `reicheSzene`) — Karte auf der Hand, Ziele auf beiden Seiten, Deck/Ablage mit allem Nötigen. MENSCH-Modus, Leitung zu Gegner und Zuschauer aufgezeichnet.
// Je Karte: ein Durchlauf + ein Abbruch an JEDER abbrechbaren Stelle; Sitz 0 und (stichprobenartig) Sitz 1. Exit 0 = korrekt.
const W = require('../../lib/wire.js');
const antwort = (e) => {
  if (e.kind === 'generic' && e.d.type === 'cardNamePicker') return { cardName: W.REICH.CRE[0] };
  return undefined;
};
// [Karte, erwartete Mindestzahl abbrechbarer Stellen, auch Sitz 1 prüfen?]
const KARTEN = [
  ['Anti Magic', 1, true], ['Berserk', 1, false], ['Curse', 1, false], ['Overheal Shock', 1, false], ['Guardian Angel', 1, false],
  ['Spreading Rumor', 1, true], ['Accusation', 1, false],
  ['Alluring Light', 2, true], ['Capture', 2, false], ['Golem Smash', 2, false], ['Gate to the Armory', 2, false], ['Create Illusion', 2, false],
  ['Shapeshift', 3, false], ['Sacrifice to Divinity', 1, false],
];
(async () => {
  const R = W.runner();
  for (const [karte, nCanc, auchSitz1] of KARTEN) {
    for (const seat of auchSitz1 ? [0, 1] : [0]) {
      const label = `${karte}${seat ? ' (Sitz 1)' : ''}`;
      R.section(label);
      const mk = () => W.reicheSzene({ seat, karten: [karte] });
      const d = await W.durchlauf(mk, seat, karte, { seat, hero: 0, answer: antwort });
      W.pruefeDurchlauf(R, label, d, { seat, nCanc, keinAuftritt: false });
    }
  }
  R.finish();
})();
