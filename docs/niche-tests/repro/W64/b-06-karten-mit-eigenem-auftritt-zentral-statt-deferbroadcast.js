'use strict';
// W64b-06 · Karten, die ihren Auftritt früher selbst steuerten (`deferBroadcast` + eigenes `card_reveal`): jetzt zentral, einmal, vor dem Effekt, auch für Zuschauer (Al, 23.10.2026)
//
// Vorher: 13 Artefakte/Tränke trugen `deferBroadcast: true` und zeigten sich selbst per `engine.io.to(oppSid).emit('card_reveal')` — nur dem Gegner (nicht den Zuschauern), teils gar nicht
//   (Alchemic Journal, Boomerang, Shard of Chaos: nur die Protokollzeile am Ende) und Staff of Illusions VOR seiner abbrechbaren Galerie (Abbruch verriet die Karte — und verbrauchte sie sogar, weil das Skript
//   `{ aborted: true }` statt `{ cancelled: true }` meldete). Chain Lightning und Pillage zeigten sich doppelt (eigenes + zentrales `card_reveal`).
// Jetzt: der Server merkt JEDE Karte vor (`deferBroadcast` ist ohne Wirkung), die Skripte markieren ihre Zusagestelle mit `engine.commitAppearance()`.
// Geprüft je Karte: genau EIN card_reveal der Karte an Gegner und Zuschauer, davor kein Effekt (Ereignis/Zeile/Zustand), Abbruch an jeder Stelle → nichts gesehen (Karte bleibt). Exit 0 = korrekt.
const W = require('../../lib/wire.js');
const antwort = (e) => {
  if (e.kind !== 'generic') return undefined;
  if (e.d.type === 'cardNamePicker') return { cardName: W.REICH.CRE[1] };
  if (e.d.type === 'cardGalleryMulti') return { selectedCards: (e.d.cards || []).slice(0, e.d.selectCount || 3).map(x => x.name) };
  return undefined;
};
// [Karte, Mindestzahl echter Abbruchstellen]
const KARTEN = [
  ['Staff of Illusions', 1], ['Monster in a Bottle', 1], ['Birthday Present', 0], ['Elixir of Immortality', 0], ['Horn in a Bottle', 1], ['Chain Lightning', 0],
  ['Alchemic Journal', 0], ['Shard of Chaos', 0], ['Boomerang', 1], ['The Yeeting', 1], ['Magic Lamp', 1],
];
(async () => {
  const R = W.runner();
  for (const [karte, nEcht] of KARTEN) {
    for (const seat of (karte === 'Staff of Illusions' || karte === 'Chain Lightning') ? [0, 1] : [0]) {
      const label = `${karte}${seat ? ' (Sitz 1)' : ''}`;
      R.section(label);
      const mk = () => W.reicheSzene({ seat, karten: [karte] });
      const d = await W.durchlauf(mk, seat, karte, { seat, hero: 0, maxCancel: 4, answer: antwort });
      R.check(`${label}: gespielt`, d.clean.r.handNachher < d.clean.r.handVorher, { v: d.clean.r.handVorher, n: d.clean.r.handNachher });
      W.pruefeDurchlauf(R, label, d, { seat, nEcht, oeffentlich: true });
      for (const sid of ['S' + (1 - seat), 'SPEC']) {
        const n = d.clean.r.tl.filter(e => e.k === 'wire' && e.sid === sid && e.ev === 'card_reveal' && e.data && e.data.cardName === karte).length;
        R.check(`${label}: ${sid} sieht den Auftritt genau einmal (card_reveal × ${n})`, n === 1, n);
      }
    }
  }
  // Staff of Illusions: Abbruch in der Galerie lässt den Stab auf der Hand (vorher: verbraucht + gezeigt)
  R.section('Staff of Illusions: Abbruch behält die Karte');
  {
    const t = await W.reicheSzene({ seat: 0, karten: ['Staff of Illusions'] });
    const r = await W.spiele(t, 0, 'Staff of Illusions', { hero: 0, cancelAt: 0, persist: true });
    R.check('abgebrochen, Stab liegt noch auf der Hand', r.cancelled && r.undone && t.gs.players[0].hand.includes('Staff of Illusions'), { hand: t.gs.players[0].hand.slice(0, 4) });
    R.check('Gegner und Zuschauer haben nichts gesehen', r.appearances.length === 0 && r.stateLeaks.length === 0, r.leakEvents);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
