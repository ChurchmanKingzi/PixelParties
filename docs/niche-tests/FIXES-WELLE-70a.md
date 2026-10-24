# Fix-Welle 70a – Secret Entrance: Auftritt und Terror-Zähler erst nach dem Commit

Agent **W70a** (Zweig `wave70/W70a`). Nach dem Merge der Wellen 66–69 mit den parallel entstandenen neuen Karten waren drei Sweep-Repros rot (`W63/d-07`, `W66/b-08`, `W66/b-10`) — alle wegen der neuen Karte **Secret Entrance** (Regeln „Auftritt erst nach dem Commit", „Kosten und Limits erst nach dem Commit"; Al, 22./23.10.2026).

| Befund | Ursache | Umsetzung |
|---|---|---|
| Gegner/Zuschauer sahen Secret Entrance (`card_reveal`, `spell_played`) vor der abbrechbaren blinden Wahl. | Skript-Aufrufform: `actionStealFromHand(… cancellable: true)` ist ein `action…`-Primitiv mit Auftritts-Hülle, die schon beim Aufruf committet — die Wahl steckt aber im Primitiv. | Neu `engine.blindHandWahl` (dieselbe Wahl ohne Hülle); Secret Entrance fragt zuerst dort (abbrechbar, `minSelect: 1`), danach `actionStealFromHand` mit `preselectedIndices`. |
| Terror-Zähler `gs._terrorTracking.<Sitz> = ["Secret Entrance"]` nach Abbruch. | Folge desselben frühen Commits (`beiCommit` läuft beim Commit; der war zu früh). | Behoben mit dem Obigen; `beiCommit` und die Spell-Spielwege waren korrekt. |

* **Engine:** `_engine.js` — `blindHandWahl` neu, `actionStealFromHand` nutzt es intern (Verhalten für alle anderen Aufrufer unverändert, Reihenfolge Ambush-Fenster → Wahl bleibt dort). Kartentexte unverändert.
* **Repro:** `docs/niche-tests/repro/W70/a-01-secret-entrance-abbruch-unsichtbar-auftritt-nach-der-wahl.js` (84 Prüfungen, beide Sitze; auf dem Ausgangsstand rot).
* **Vertrag:** `cards/effects/CARD_API.md`, Abschnitt „Welle 70 / W70a" (Regel: Primitiv mit eigener abbrechbarer Frage → Frage vorab außerhalb der Hülle).
* **Andere neue Karten:** siehe Bericht unten.
* **Commit-Nachrichten:** `Bugfix-Skip` (neue, nicht freigegebene Karte; Engine-Änderung betrifft nur sie), keine `Bugfix-Note`.
