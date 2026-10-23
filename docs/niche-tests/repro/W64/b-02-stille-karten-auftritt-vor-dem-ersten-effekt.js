'use strict';
// W64b-02 · Karten, die nur STILL den Zustand ändern (Buff, Sperre, Gold, Ziehen, Anlegen …): der Auftritt kommt VOR dem ersten Effektschritt (Al, 23.10.2026)
//
// Regel (Al): „Auftritte sollten allgemein VOR BEGINN der Effekte gestreamed werden (aber nach dem Confirm), nicht erst an deren Ende." Vorher (W63d) kam der Auftritt mit der ersten SICHTBAREN Wirkung —
//   eine Karte, die danach nur still den Zustand ändert, zeigte sich erst am Ende der Auflösung; der Gegner sah vorher schon den neuen Zustand (Anhang am Helden, Gold, Handgröße, Sperre …) und
//   die Effekt-Protokollzeile VOR der Zeile der Karte.
// Jetzt: Engine-Effektschritte (`engine.action…`, Status, Beschwören …), Pflichtfragen und das erste sichtbare Ereignis committen den Auftritt; der Zustandspuffer hält `game_state`
//   an Gegner/Zuschauer bis dahin zurück (mit offener Frage: der Zustand von VOR der Karte + Hülle der Frage). Siehe CARD_API „Welle 64 / W64b".
// Je Karte: ein Durchlauf + ein Abbruch an jeder abbrechbaren Stelle (nichts gesehen); dazu je Empfänger (Gegner, Zuschauer) „Auftritt VOR dem ersten Effekt-Ereignis, der ersten Effekt-Zeile und dem
//   ersten Zustandswechsel" (`W.pruefeDurchlauf`). Alle Karten waren im Ausgangszustand rot. Exit 0 = korrekt.
const W = require('../../lib/wire.js');
// [Karte, auch Sitz 1?]
const KARTEN = [
  ['Staff of the Teleporter', true], ['The Sacred Jewel', false], ['Wheels', false], ['Haste', true], ['Supply Chain', false], ['Potion of Greed', true],
  ['Distracting Crystal', false], ['Mana Absorbing Crystal', false], ['Experimental Potion', false], ['Poison Vial', false],
  ['Curse', true], ['Berserk', false], ['Anti Magic', false], ['Divine Gift of Coolness', false], ['Spontaneous Reappearance', false],
];
(async () => {
  const R = W.runner();
  for (const [karte, auchSitz1] of KARTEN) {
    for (const seat of auchSitz1 ? [0, 1] : [0]) {
      const label = `${karte}${seat ? ' (Sitz 1)' : ''}`;
      R.section(label);
      const mk = () => W.reicheSzene({ seat, karten: [karte] });
      const d = await W.durchlauf(mk, seat, karte, { seat, hero: 0, maxCancel: 4, answer: (e) => (e.kind === 'generic' && e.d.type === 'cardNamePicker') ? { cardName: W.REICH.CRE[1] } : undefined });
      R.check(`${label}: gespielt (Karte nicht mehr auf der Hand oder im Spiel)`, d.clean.r.handNachher < d.clean.r.handVorher || d.clean.r.result !== false, d.clean.r.result);
      W.pruefeDurchlauf(R, label, d, { seat, nEcht: 0, oeffentlich: true });
    }
  }
  R.finish();
})();
