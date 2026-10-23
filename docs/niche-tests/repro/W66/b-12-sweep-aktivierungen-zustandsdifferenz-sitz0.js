'use strict';
// W66b-12 · Sweep über ALLE Aktivierungen (Sitz 0: Heldeneffekte, Areas, Kreatur-Effekte, Ausrüstungs-Effekte, freie und Aktions-Abilities): Zustandsdifferenz nach Abbruch = 0 (Al, 23.10.2026)
//
// Wie W66/b-08…11, aber für die 254 Aktivierungen der Standard-Szene (Skript-Erkennung wie W64b/b-04): ein Durchlauf und ein Abbruch an jeder abbrechbaren Stelle. „Echte Abbruchstelle" = der Gegner hat bis dahin
// nichts gesehen (der Auftritt kommt erst beim Commit). Geprüft: Zustand nach dem Abbruch = Zustand davor (Einmal-Sperren, Zähler, Kosten, Karten, Brett …); bis zur letzten echten Abbruchstelle nichts bezahlt/
// gestempelt — bis auf die dokumentierten Reservierungen Guardian Beast Hu (die 5 Löschkarten verlassen die Ablage schon bei der Aktionswahl: unsichtbar im Kosten-Vorlauf, exakte Rückgabe; W66/b-05) und Monster Nest (sinkt logisch).
// Fund im Ausgangszustand: Terror-Zähler (Guardian Beast Hu & Co.), Absichts-Marken. Exit 0 = korrekt.
const W = require('../../lib/wire.js');
const S = require('../../lib/zustands-sweep.js');
const AUSNAHMEN = new Set(['Guardian Beast Hu', 'Monster Nest']);   // beide RESERVIEREN (Hu: Löschkarten im Kosten-Vorlauf; Nest: sinkt logisch, damit es nicht sein eigenes Opfer wird) und geben exakt zurück
(async () => {
  const R = W.runner();
  const r = await S.aktivierungen(R, { seat: 0, ausnahmenPrompt: AUSNAHMEN });
  R.check(`Sitz 0: ${r.st.aktivierungen} Aktivierungen durchgespielt (${r.st.aktiviert} mit Auftritt, ${r.st.mitAbbruch} mit Abbruchfrage, ${r.st.abbrueche} Abbruch-Läufe, ${r.st.echteAbbrueche} echte Abbruchstellen)`, r.st.aktivierungen > 200 && r.st.echteAbbrueche > 30, r.st);
  R.check('NACH dem Abbruch ist der Spielzustand exakt wie vorher (Zustandsdifferenz = 0)', r.nachAbbruch.length === 0, r.nachAbbruch.slice(0, 12));
  R.check('bis zur letzten echten Abbruchstelle sind noch KEINE Kosten bezahlt (Gold, Ablage/Löschstapel, Helden-HP/-Status, Brett) — Ausnahmen: Guardian Beast Hu und Monster Nest (Reservierung im Kosten-Vorlauf); Reservierungen [Einmal-Stempel, Karten-Entnahme] sind erlaubt', r.promptRest.length === 0, r.promptRest.slice(0, 12));
  R.check('keine Engine-Fehler in den Läufen', r.fehler.length === 0, r.fehler.slice(0, 8));
  R.finish();
})().catch(e => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(2); });
