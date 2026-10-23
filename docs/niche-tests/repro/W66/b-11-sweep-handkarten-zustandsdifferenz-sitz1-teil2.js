'use strict';
// W66b-11 · Sweep über ALLE spielbaren Handkarten (Sitz 1, Hälfte 2 von 2): „Kosten und Limits erst NACH dem Commit" — Zustandsdifferenz nach Abbruch = 0 (Al, 23.10.2026)
//
// Je Karte (Spell, Attack, Creature, Artifact, Potion, Ability; Karten mit gerader/ungerader Nummer in der Kartendatei) in der reichen Standard-Szene über den echten Spielweg (MENSCH-Modus, Leitungs-Harness
// lib/wire.js): ein Durchlauf und ein Abbruch an JEDER abbrechbaren Stelle. Der KOMPLETTE serialisierbare Spielzustand (lib/zustand.js: Gold, Hand/Ablage/Deck/Löschstapel/Potion Deck mit Reihenfolge,
// Brett, Marken und Stempel, Zähler, Aktionen, Helden-/Kreaturzustände, Hook-Zustände) muss nach dem Abbruch EXAKT dem Zustand davor gleichen; ebenso nach einem Fehlversuch (Karte bleibt auf der Hand),
// und bis zur letzten echten Abbruchstelle ist noch nichts bezahlt/gestempelt (Buchführung der laufenden Aktion ausgenommen). Siehe lib/zustands-sweep.js.
// Fund dieses Sweeps im Ausgangszustand: Terror-Zähler (14 Karten), Monster Nest (Deck gemischt), Absichts-Marken nach Abbruch der Kostenwahl (alle Kosten-Kreaturen). Exit 0 = korrekt.
const W = require('../../lib/wire.js');
const S = require('../../lib/zustands-sweep.js');
(async () => {
  const R = W.runner();
  const r = await S.handkarten(R, { seat: 1, mod: 2, rest: 1 });
  R.check(`Sitz 1: ${r.st.karten} Karten durchgespielt (${r.st.gespielt} gespielt, ${r.st.ungespielt} in dieser Szene nicht spielbar, ${r.st.mitAbbruch} mit Abbruchfrage, ${r.st.abbrueche} Abbruch-Läufe, ${r.st.echteAbbrueche} echte Abbruchstellen)`, r.st.gespielt > 300 && r.st.echteAbbrueche > 40, r.st);
  R.check('NACH dem Abbruch ist der Spielzustand exakt wie vorher (Zustandsdifferenz = 0)', r.nachAbbruch.length === 0, r.nachAbbruch.slice(0, 12));
  R.check('Fehlversuche (Karte bleibt auf der Hand, nichts gezeigt) hinterlassen nichts', r.ungespieltRest.length === 0, r.ungespieltRest.slice(0, 12));
  R.check('bis zur letzten echten Abbruchstelle sind noch KEINE Kosten bezahlt (Gold, Ablage/Löschstapel, Helden-HP/-Status, Brett); Reservierungen [Einmal-Stempel, Entnahme der gespielten Karte] sind erlaubt und werden exakt zurückgegeben', r.promptRest.length === 0, r.promptRest.slice(0, 12));
  R.check('keine Engine-Fehler in den Läufen', r.fehler.length === 0, r.fehler.slice(0, 8));
  R.finish();
})().catch(e => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(2); });
