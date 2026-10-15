# Fix-Welle 9 – die ersten 20 Einzelfragen

Al hat die ersten 20 Einzelfragen aus [FRAGEN-OFFEN.md](FRAGEN-OFFEN.md) beantwortet (Q2–Q25); zwei Agenten haben sie umgesetzt: W9a (Pollution/Deepsea, `wave9/W9a` 7e5e6db) und W9b (Future Tech/Cute, `wave9/W9b` 91742a2). Beide Zweige sind zusammengeführt.

## Entscheidungen von Al (verbindlich, in `CARD_API.md` verankert)

| Frage | Entscheidung / Umsetzung |
|---|---|
| Q2 Guardian of Teocuilatl | Text sagt „an Area" → schützt **jede** Area, auch gegnerische |
| Q3 Magic Mirror | Kopie zahlt die „… to use this Spell"-Kosten; „once per game"-Zauber verbraucht das **eigene** Limit des Spiegel-Besitzers; bei verbrauchtem Limit nicht nutzbar |
| Q4 Goldify | Gold und Zusatzaktion nur, wenn die Kreatur wirklich weg ist |
| Q7 Doom Clock | „Alle Gegner getötet" gewinnt zuerst, vor der Uhr-Niederlage |
| Q8 Arrival | funktioniert wie gewollt |
| Q9 Cosmic Manipulation | „place" ist eine **Unterform von „summon"** (für Trigger/Reaktionen); heutiges Fensterverhalten bleibt; Level-Voraussetzung nur bei Karten, die „summon" sagen (Q25) |
| Q10 Change Counters | Zählung nach Kontrolle |
| Q11 Dark Deepsea God | Satz „once per game" aus `data/cards.json` gestrichen; einmal pro Zug |
| Q12 Deepsea Spores | Subtyp Reaction (war schon so); auch im eigenen Zug ohne Aktionskosten spielbar (`proactivePlay`) |
| Q13 Analyzer / Gatherer | Rückgabe vom Brett auf die Gegnerhand zählt (1 Counter pro Ereignis; Hook `onCardsReturnedToHand`) |
| Q14 Monstrosity → Jack O' Lantern | Level der beim Platzieren gebouncten Kreatur zählt (ohne Bounce: 0 Karten) |
| Q15 Zusatzaktionen | Zusatzaktionen in der Action Phase sind **gratis** (Hauptaktion bleibt), verallgemeinert: Primordium, Mission, Lunatic Hawk (4+), Legendary Sword, Slippery Polar (Kreaturenweg); Idej Muras, Wolflesia (Zauberweg); Second-Action-Grants (Zhigao, Duigno, Giga Steroids, Calm Diatribe, Weapon Unleashing, Reiza) ausgenommen |
| Q16 Escape Device / Puppet-Token | Nein – kein Auslösen bei Token-Wahl |
| Q17 „up to N" | Spieler wählt die Anzahl (nur eine Kopie → 1 ohne Rückfrage); Iterative Testing und The Core's Awakening; CPU nimmt die Höchstzahl |
| Q18 Jetpack | wehrt bei 0 Kopien Stufe-0-Attacken ab |
| Q19 Copy Device als Control Device | erst Unterhalt zahlen, dann abfallen (war schon so) |
| Q20 The Core's Awakening | Staffel skaliert mit dem gewählten Wirker |
| Q23 Cybug RHINOCEROS | zählt, wer die Karte ausspielt/anlegt, nicht die Zone |
| Q24 „Cute" | Name zählt (Wort „Cute"); eine zentrale Prüfung `isCuteCreatureCard` |
| Q25 Wildur | „summon" braucht das Level (Hipdall/Swagdri Lv0 unverändert; Glorious Rebirth „Place" ohne Stufe) |

## Zahlen (zusammengeführter Stand)

* Repros: **452 grün** von 778 (Welle 8: 414 von 760); 20 weitere Befunde behoben, **0 Rückschritte**, 0 Abstürze/Timeouts; die neuen W9-Repros (`W9/a-*`, `W9/b-*`) sind grün.
* Alle 44 `scripts/check-*.js` wie im Ausgangszustand (nur `check-scope.js` rot). Skilltest-E2E: rot nur battle, lobby, prep, seats, target; `artifacts.test.js` ist ein bekannter Zufalls-Flake (in drei Wiederholungen einmal rot). Dauerfeuer über alle Karten: keine neu auffälligen Läufe.

## Rückfragen an Al (ja/nein)

R1 Cosmic Manipulation/Arrival: Fizzelt Arrival (`no_upgrade`), wenn das 1. Fenster angenommen wird und CM die Aufwertungs-Kreatur zieht – so lassen, oder soll Arrival die 2. Kreatur vorab festlegen? · R2 Spores: im eigenen Zug als Reaction ohne Aktionskosten spielbar – gewollt? · R3 DDG gibt 3 Kreaturen zurück: für Siphem, Teppes, Analyzer, Gatherer ein Ereignis oder drei (heute drei, Repro A02-deepsea/16 rot)? · R4 Magic Mirror: Tokens vor den Kosten der Kopie (heute) oder Kartentext-Reihenfolge? · R5 Q19 bestätigt (kein Code)? · R6 Equip-Fenster (Cybug LOCUST, Afflicted Pests) bei Cross-Side-Ausrüstung ebenfalls den Anleger werten? · R7 Cuteness Sensor: Namenspräfix („Cuteness …") oder ganzes Wort „Cute"?
