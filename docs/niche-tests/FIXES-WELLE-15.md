# Fix-Welle 15 – Antworten auf die Rückfragen der Welle 14

Al hat die zehn Ja/Nein-Rückfragen aus [FIXES-WELLE-14.md](FIXES-WELLE-14.md) beantwortet (19.10.2026). Zwei Agenten haben sie umgesetzt (W15a: Resistance und Reaktionsfenster; W15b: Chaos Magic, Divine Gift of Magic, Schadenssperre); Zweige `wave15/W15a|b` sind in `claude/beautiful-mendel-eb61lv` zusammengeführt (einziger Konflikt am Ende von `CARD_API.md`, beide Abschnitte behalten).

## Entscheidungen von Al und Umsetzung

| # | Frage | Antwort von Al | Ergebnis |
|---|---|---|---|
| 1 | ATK-Gewinne an Resistance? | „Nein, sollen sie nicht." | Nero/Toras/Taio waren schon ungeblockt; Chaorc +40 ATK nicht mehr geblockt (der +80-Max-HP-Zweig bleibt geblockt). Repro `a-r1` |
| 2 | Toughness beim normalen Anlegen? | „Ja, bleibt ungeblockt." | Ist-Zustand; per Effekt (Pressed Skill) wird Toughness geblockt. Repro `a-r2` |
| 3 | Divinity-Anleger, Alex, Chuck, Muscle Training? | „Ja" | Sacrifice to Divinity, Very Special Prisoner, Quetzahuitl, Alex, Chuck, Muscle Training prallen ab; zusätzlich Training (Option B), Aufstiegsbonus aller Ascended Heroes sowie Ausrüsten per Effekt (Cool Repair, Backpack, Gate to the Armory, Initiation Ritual, Shapeshifter, Weapon Collecting Wight, Riffel, Looting). Opfer/Kosten bleiben bezahlt, normales Ausspielen und „Ability per turn" bleiben ungeblockt. Repros `a-r3a`, `a-r3b` |
| 4 | Companion-Bruch? | „Nicht geblockt ist korrekt" | Ist-Zustand; Repro `a-r4` |
| 5 | Gift of Time bei der eigenen gewirkten Karte? | „Ja" | Ist-Zustand; Repro `a-r5` |
| 6 | Unwanted Audience sperrt Spirit/Kohta-Wiederholungen? | „Ja" | Ist-Zustand; Repro `a-r6` |
| 7 | Weitere Hand-Reaktionen bei Poisoned Well, Iceage, Medusa's Curse? | „Ja, sollen sie" | Divine Gift of Rain, Anti Magic Shield, Storm Ring, MOE Shield negieren den Zauber; Barrier of Faith schützt einen Helden, Golden Wings eine Kreatur; auch Anti Magic Zone, Null Zone, Snowstorm Mischief, Toxic Fumes angeschlossen (inkl. „hit by"-Surprises). R01-10 grün. Repro `a-r7` |
| 8 | Fizzelnde Chaos-Magic-Karte zählt als „bereits gewirkt"? | „Nein, … zählt als der von Chaos Magic gewirkte Zauber und beendet Chaos Magic. Einzig ein Spell, der *wirklich* dieses Spiel schon mal gewählt wurde, zählt als schon gewählt." (Auslegung von Al ausdrücklich bestätigt) | Fizzelnder Spell beendet Chaos Magic, wird aber erst nach bestandener Wirk-Prüfung in die Liste der aufgelösten Spells eingetragen und kann später erneut gewählt werden. Repro `b-c1` |
| 9 | Divine-Gift-of-Magic-Rabatt | „Der Rabatt soll exakt die geklickte/ausgewählte Karte treffen." | Rabatt hängt an der konkreten Handkarte (Handindex); `kopienRabattAufGespielteKopie` entfernt; andere Kopie ohne Rabatt nicht spielbar; gilt auch für Fiona (`H02-heroes/13` jetzt grün). Repro `b-c2` |
| 10 | Schadenssperre nach Kontrolle? | „Ja, prüfe nach aktuellem Kontrolleur!" | Prüfung über `kontrolleurVonHeld` / `kontrolleurVon` (gestohlene Kreaturen und gecharmte Helden zählen als Gegnerziele, eigene seitenfremde nicht). `S02-spells/05` grün. Repro `b-c3` |

Auf die neue Regel umgestellt: `W14/c-q165` (andere Kopie nicht spielbar); Messfehler in `S02-spells/05` korrigiert.

## Ergebnis in Zahlen

* Repros: **699 grün von 919** (Welle 14: 685 von 908). 3 bestehende Befunde behoben (`H02-heroes/13`, `R01/10`, `S02-spells/05`), 11 neue Repros alle grün, **0 Rückschritte**, keine Abstürze oder Timeouts.
* Alle 44 `scripts/check-*.js` wie im Ausgangszustand (nur `check-scope.js` rot).
* Skilltest-E2E: rot nur battle, lobby, prep, seats, target; `mcts.test.js` war unter Last einmal rot und ist einzeln 2 von 2 grün (bekannter Flake).
* Dauerfeuer: je Zweig vorher/nachher byte-identisch (W15a 54 Läufe, W15b 32 Läufe).

## Neue Rückfragen an Al (Ja/Nein)

**Aus W15a**
1. Sollen Smoke Vial (Trank), Cute Conversion, Mass Routing und Pink Sky ebenfalls die Hand-Reaktionsfenster öffnen? (nicht angeschlossen, keine Status-Flächenzauber im engeren Sinn)
2. Soll Resistance auch das Entfernen von Ausrüstung per Effekt (Disarm, Fire Bomb) und angehängte Spell-Anhänge wie Curse blocken? (nicht angefasst)
3. Soll ein von Resistance abgefangenes Alex-/Training-/Backpack-Anlegen den Einmal-Einsatz verbrauchen? (jetzt: ja, wie bei Pressed Skill; Riffel und Weapon Collecting Wight verbrauchen ihn nicht)
4. Soll Resistance den Aufstiegsbonus aller Ascended Heroes abfangen? (jetzt: ja, für alle gleich verdrahtet)

**Aus W15b**
5. Soll der Client bei Kopien gleichen Namens nur die rabattierte Kopie hervorheben, statt den Klick auf die andere erst am Server abzulehnen? (jetzt leuchten alle Kopien, der Server verweigert die falsche)
6. Soll für einen geliehenen/gecharmten Helden der Hand-Rabatt (Gift, Fiona) ebenfalls der konkreten Kopie folgen? (dort wird bisher die Hand des Helden-Besitzers statt der des Kontrolleurs gelesen – war schon vorher so)
