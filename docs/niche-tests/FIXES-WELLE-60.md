# Fix-Welle 60 – Shared Blood Tanks nimmt Helden und Karten mit Diver Helmet aus

Umgesetzt vom Agenten **W60a** (Zweig `wave60/W60a`), Folgearbeit zu W59a (Rückfrage 2). Details: `cards/effects/CARD_API.md`, Abschnitt „Welle 60 / W60a"; Repro `docs/niche-tests/repro/W60/a-01` (beide Sitze, 42 Prüfungen; auf dem alten Stand 32 ✗, jetzt alle grün).

| Punkt | Regel | Umsetzung |
|---|---|---|
| Shared Blood Tanks / Diver Helmet | Diver Helmet: „The equipped Hero and all cards in its Support Zones are unaffected by Areas." (CARD_API-Pflichtregel) | Der Ketten-Bleed-Schaden trifft einen Helden mit Helm und alle Karten/Kreaturen in dessen Support Zones nicht; sie lösen die Kette auch nicht aus. Ihr eigener Bleed-Tick nach der Handlung bleibt. Die Prüfung läuft bei jedem Schlag neu (Helm kommt/geht mitten in der Kette). |
| Zentrale Prüfung | – | neu `engine.karteIstVonAreasAusgenommen(inst)` (Karte in den Support Zones eines Helm-Helden, physische Seite); `heldIstVonAreasAusgenommen` (W59a) wiederverwendet |

* **Audit:** 13 Area-Skripte ohne Helm-Bezug erneut durchgesehen; außer Shared Blood Tanks (behoben) und Acid Rain (bleibt, Frage 2) keine Fundstelle.
* **Nicht angefasst:** Acid Rain (Pollution Token in freie Support Zones), Spielerlimit von Rioting Village, Kartentexte in `data/cards.json`.
* `Bugfix-Note`: Shared Blood Tanks (Heroes with Diver Helmet and their Support Zone cards were still hit by the chained Bleed damage).

## Offene Rückfragen an Al

1. **Auslöser:** soll ein Held mit Diver Helmet (bzw. eine Karte in dessen Support Zones) die Shared-Blood-Tanks-Kette *auslösen* können, wenn er selbst Bleed-Schaden nimmt — ja/nein? (Umgesetzt: nein, die Area behandelt ihn überhaupt nicht; Gegenlesart: Helm schützt nur vor dem Kettenschaden.)
2. **Acid Rain** (aus W59a, unverändert): der Pollution Token soll nicht in die freien Support Zones eines Helden mit Diver Helmet gelegt werden dürfen — ja/nein?
3. **Spieler-Limit Rioting Village** (aus W59a, unverändert): soll der Helm den Helden auch von „no player can use more than 1 Attack per turn" befreien — ja/nein?
