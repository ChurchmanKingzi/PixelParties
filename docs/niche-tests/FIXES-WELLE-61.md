# Fix-Welle 61 – Shared Blood Tanks (Helm-Auslöser) und Acid Rain (Helm-Zonen)

Umgesetzt vom Agenten **W61a** (Zweig `wave61/W61a`), Folgearbeit zu W59a/W60a mit den Entscheidungen von Al zu den offenen Rückfragen. Details: `cards/effects/CARD_API.md`, Abschnitt „Welle 61 / W61a"; Repros `docs/niche-tests/repro/W61/a-01` (44 Prüfungen, beide Sitze; auf dem alten Stand 30 ✗) und `docs/niche-tests/repro/W60/a-01` (angepasst, 50 Prüfungen; auf dem W60a-Stand 14 ✗).

| Punkt | Regel / Entscheidung | Umsetzung |
|---|---|---|
| Shared Blood Tanks – Auslöser | Al: „Ja, auslösen schon, aber NICHT durch einen anderen Auslöser den Bleed-Schaden nehmen." Der Helm schützt vor der Wirkung der Area, nicht davor, Auslöser zu sein. | Ein Held mit Diver Helmet (und Karten/Kreaturen in dessen Support Zones) löst die Kette bei eigenem Bleed-Tick wieder aus; als Opfer eines ANDEREN Auslösers nimmt er weiterhin keinen Kettenschaden. Der Auslöser-Teil von W60a (`istAusgenommen` am Anfang von `afterBleedDamage`) ist zurückgenommen. |
| Acid Rain | Al: „Doch!" – der Pollution Token darf nicht in die Support Zones eines Helden mit Diver Helmet. | Zonenliste und Zählung der Token-Option nur mit freien Zonen lebender Helden ohne Helm (`engine.heldIstVonAreasAusgenommen`, neue Option `excludeHero` in `_pollution-shared.js`). Keine solche Zone → nur „2 Karten löschen" (bei weniger als 2 Karten Fizzle, Ruling wie bisher). Zone wird beim Platzieren erneut geprüft (Helm kommt/geht); fällt die letzte Zone nach der Wahl „Token" weg, Rückfall auf Löschen. |
| Rioting Village – Spieler-Limit | Al: „Nein." | Keine Änderung: „no player can use more than 1 Attack per turn" gilt unverändert, auch für Helm-Helden. Nur dokumentiert. |

* **Nicht angefasst:** Kartentexte in `data/cards.json`, Rioting Village, andere Pollution-Karten (nutzen `excludeHero` nicht).
* `Bugfix-Note`: Shared Blood Tanks (Heroes with Diver Helmet and their Support Zone cards trigger the Bleed chain again when they take Bleed damage themselves); Acid Rain (Pollution Token can no longer be placed in a Diver Helmet Hero's free Support Zones).

## Offene Rückfragen an Al

1. **Acid Rain, Helm kommt nach der Wahl:** Nimmt ein Helm nach der Wahl „Pollution Token" die letzte wählbare Zone weg, fällt die Strafe auf „2 Karten löschen" zurück (falls möglich), sonst verpufft sie. Okay so – ja/nein?
