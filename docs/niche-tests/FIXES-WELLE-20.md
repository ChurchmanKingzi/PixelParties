# Fix-Welle 20 – Klarstellung „nur der aktuelle Kontrolleur" und Opfer-Zonen

Al hat die Rückfragen aus [FIXES-WELLE-19.md](FIXES-WELLE-19.md) beantwortet und dabei eine Missdeutung aus Welle 19 richtiggestellt (20.10.2026). Drei Agenten haben gearbeitet: **W20a** (Kontrolleur-Regel für Zauber, Attacken, Surprises), **W20b** (Dark Deepsea God, Pinta, Opfer-Zonen-Regel für alle Opfer-Beschwörungen), **W20c** (Reaktionen über jeden kontrollierten Helden, Beschwören nur durch den Kontrolleur). Zweige `wave20/W20a|b|c` sind zusammengeführt (Konflikte nur am Ende von `CARD_API.md`, alle Abschnitte behalten).

## Entscheidungen von Al und Umsetzung

| Thema | Antwort von Al | Ergebnis |
|---|---|---|
| Zauber/Attacken/Surprises an abgegebenem Helden | „nur der aktuelle Kontrolleur eines Heroes darf mit ihm casten"; „Reactions dürfen mit allen Heroes genutzt werden, die man aktuell gerade kontrolliert, außer dem Hero ist das Casten durch einen Effekt oder Status verboten." | **Korrektur von W19b:** Besitzer-Aktivierung zurückgenommen. Nur der Kontrolleur wirkt Zauber/Attacken, reagiert aus der Hand und aktiviert die Surprises der Zone; der Besitzer erst wieder nach Rückgabe der Kontrolle (`validateActionPlay`: `heroSideOf(heroOwner, hero) === pi`, gilt auch für `own`-Listen, Reaktionsfenster, CPU) |
| Surprises beim Kontrollwechsel | „face-down Surprises gehen bei Kontrollwechsel immer mit dem Hero mit"; Surprise des Kontrolleurs: „ja, sobald er den Hero wieder kontrolliert" | Surprises folgen dem Helden; eine vom Kontrolleur gelegte Surprise bleibt seine Karte, der Besitzer löst sie aus, sobald er wieder Kontrolleur ist; Sichtbarkeit für den Kontrolleur (W19b) bleibt |
| Kreatur-Surprise | „… die Creature bleibt, solange sie faceup ist, Besitz des sie aktivierenden Spielers" | Aufgedeckte Kreatur gehört dem Aktivierenden (`originalOwner`); am übernommenen Helden braucht es das Recht `beschwoeren` |
| Rechte `zauber`/`attacken` | „'vorerst' brauche ich das nicht, aber keine Garantien für die Zukunft" | Bleibt Engine-Vertrag, keine Karte |
| Hand-Reaktionen über kontrollierte Helden | „Ja, das gilt generell für alle Reactions. Aber natürlich müssen ihre Bedingungen wie Level erfüllt sein." | `fremdeReaktionsWirker` für alle Reaktionskarten (Schalter `fremdeWirker` entfällt); Schule/Stufe vom übernommenen Helden, Hand und Gold vom Kontrolleur; Besitzer des abgegebenen Helden reagiert nicht |
| Controlled Attack | „Ja, der Hero selbst bleibt ja bei seinem Besitzer" | Besitzer wirkt weiter; per Repro abgesichert |
| Beschwören mit einem Helden | „ja, nur der aktuelle Kontrolleur darf mit einem Hero Creatures beschwören" | Hand, Zusatzaktion und „summon with this Hero" nur für den Kontrolleur (`validateActionPlay`, `getHeroPlayableCards`, `heroAgiert`/`heroAbgegeben`); A09-15 (seitenfremde Beschwörung) unverändert |
| Bow – negierter Angriff | „nein" | Stempel bleibt verbraucht, wenn der Pfeil gewirkt hat und der Angriff danach negiert wird (Repro) |
| Dark Deepsea God | „ja, auch einzelne aus einer Zone sollten möglich sein" | Zonen-Picker mit Folgewahl „alle zurückgeben?" / einzeln wählen; Zone nur Landeplatz, wenn alle Insassen zurückgegeben werden |
| Pinta und jede Opfer-Beschwörung | „Ja, die Regel gilt allgemein für jede Opfer-Beschwörung" | Zonen, die durch die geforderten Opfer leer werden; alle Insassen Pflicht-Opfer; sonst nicht viable. Zusätzlich angeschlossen: Hive's Crown, Garius, Kasperov, Rook of Kings [W], Loyal Rottweiler, Steam Dwarf Engineer, Creepy Villager, Shapeshift, Deepsea Castle, Divine Gift of the Deepsea, Deepsea Encounter (dabei echte Fehler behoben: Geister-Instanz bei Creepy Villager/Shapeshift, falsche Ersatzzone beim Engineer, „1 pro Spiel" verbrannt bei Divine Gift of the Deepsea) |
| 500 Piranhas | „Ja, sie darf ausweichen, sofern es eine freie Zone auf demselben Hero gibt" | Ist-Zustand |
| Rook of Kings [W] | „Ja, das ist okay, kann so bleiben" | Rook darf sich als „another" Opfer selbst opfern (Ist-Zustand) |

Umgestellte alte Repros: `W19/b-1…b-3`, `W19/c-love-shot-wisdom…` (Variante c), `W17/d-…-sperren-abbruch-zusatzaktion` (C2), `W20/a-2` (Jump in the River temporär).

## Ergebnis in Zahlen

* Repros: **alle 1005 Repros grün** (Welle 19: 996); 9 neue Repros, **0 Rückschritte**, keine Abstürze oder Timeouts.
* Alle 44 `scripts/check-*.js` wie im Ausgangszustand (nur `check-scope.js` rot).
* Skilltest-E2E: rot nur battle, lobby, prep, seats, target; `artifacts.test.js` und `cards.test.js` waren im Sammellauf einmal rot und sind einzeln 3 von 3 bzw. 2 von 2 grün (bekannte Lastflakes).
* Dauerfeuer über alle Karten (~2 450 Läufe, beide Seiten): keine neu auffälligen Läufe; die Agenten fuhren zusätzlich Matrizen über 72 Reaktionskarten × Kontrollzustände (eigen/dauerhaft/temporär) ohne Fehler.

## Offene Rückfragen an Al (Ja/Nein)

1. **Divine Gift of Time, Unwanted Audience, Divine Gift of the Guardian (W20c):** Sollen sie einen Wirker mit der passenden Schule verlangen, auch über übernommene Helden? (heute prüfen sie für keinen Helden Schule/Stufe)
2. **Platzier-Karten (W20c):** Soll der Besitzer eines abgegebenen Helden auch nicht mit Platzier-Karten („place", z. B. Deepsea-Tausch) in dessen Zonen platzieren dürfen? (heute unverändert)
3. **Helden-Effekt-Reaktionen (Key, the Cursed Thief) (W20c):** Sollen nur der aktuelle Kontrolleur des Helden sie auslösen dürfen? (heute der Spaltenbesitzer)
4. **Seitenfremde Beschwörung (A09-15, W20c):** Soll die seitenfremde Beschwörung in die Zone einer gestohlenen Kreatur (Elven Rider, Bomblebee Cluster u. a.) dem aktuellen Kontrolleur vorbehalten sein? (heute erlaubt)

**Hinweise:** Die Übernahme per Charme endet am Zugende. Listen „targets your opponent controls" lassen Helden der eigenen Spalte aus, die der Gegner kontrolliert (Z1). Nicht angefasst: Loyal Bone Dog (belebt an Ort und Stelle wieder), Unholy Combination und Metamorphosis of Serket (kein Skript).
