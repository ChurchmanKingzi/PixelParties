'use strict';
// A03-futuretech-29 · Cybug RHINOCEROS reagiert nicht auf das Platzieren einer Control Device in die eigene Support Zone (Anleger wird als Gastgeberseite gelesen)
//
// Kartentext Rhinoceros: „Activate this Surprise when your opponent places a card into an Area or Support Zone by deleting 1 "Excavator Bucket" … Send that card to the discard pile …“
// Kartentext Control Device: „Equip this card to a Hero your opponent controls.“ (Cross-Side-Ausrüstung, `placesOnOpponentBoard`)
// Aufbau: Sitz 1 hat Cybug RHINOCEROS als Surprise (Held 0, Excavator Bucket in der Hand); Sitz 0 spielt (a) eine Gun an den eigenen Helden (Kontrolle), (b) eine Control Device an Sitz 1 / Held 0.
// Erwartung: (a) löst aus (✓ gemessen); (b) die Gegnerin legt eine Karte in eine Support Zone der Rhinoceros-Besitzerin – gleiches Fenster, die Surprise löst aus und die Control Device geht in die Ablage von Sitz 0.
// Beobachtet: (b) kein Prompt, die Control Device bleibt liegen.
// Ursache: `_engine.js` ~3621: `_checkSurpriseOnPlacement(effektiveSeiten(enteringCard).controller ?? enteringCard.owner, …)` – bei Cross-Side-Karten ist `inst.owner` die GASTGEBERSEITE (hier Sitz 1,
//   Kommentar in future-tech-control-device.js `besitzer()`), also gilt Sitz 1 als Anleger; `_scanSurprisesAgainst` sucht dann nur Surprises von Sitz 0.
// Frage an Al: Soll „your opponent places a card into a Support Zone" auch das Anlegen einer Cross-Side-Ausrüstung (Control Device, Powder Keg) in die EIGENE Zone treffen – ja oder nein?
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const RH = 'Cybug RHINOCEROS', EB = 'Excavator Bucket', CTL = 'Future Tech Control Device';
  for (const [karte, erwartetAusloesen] of [['Future Tech Gun', true], [CTL, true]]) {
    const t = await H.fresh({ hand: [[karte], [EB]], gold: 100 });
    t.putSurprise(1, 0, RH); t.grantFor(1, 0, RH);
    const r = await t.play(0, karte, { hero: 0 });
    const ausgeloest = t.prompts.some(p => /Cybug RHINOCEROS/.test(JSON.stringify(p.d)));
    R.check(karte + ': Rhinoceros löst aus', ausgeloest === erwartetAusloesen, { r, prompts: t.prompts.map(p => p.d.type), disc0: t.pile(0, 'discardPile'), sup1: [0, 1, 2].map(s => t.zone(1, 0, s)) });
    R.check(karte + ': keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
