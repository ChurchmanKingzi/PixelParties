# Fix-Welle 19 – Antworten auf die Rückfragen der Welle 17/18

Al hat die neun Ja/Nein-Rückfragen aus [FIXES-WELLE-17.md](FIXES-WELLE-17.md) beantwortet und den Auftrag zu Rusty Touch gegeben (19.10.2026). Drei Agenten haben sie umgesetzt: **W19a** (Nicht-Helden-Ziele mit Coolness-Stack-Spitze, Opfer-Zonen, Tooltip), **W19b** (Held unter fremder Kontrolle, Surprise-Sichtbarkeit), **W19c** (Bow, Love Shot, Rusty Touch). Zweige `wave19/W19a|b|c` sind zusammengeführt (Konflikte nur am Ende von `CARD_API.md`, alle Abschnitte behalten).

## Entscheidungen von Al und Umsetzung

| Thema | Antwort von Al | Ergebnis |
|---|---|---|
| Coolness-Stack-Spitze bei „any card on the board that is not a Hero" | „ja. Yeeting und andere vergleichbare Effekte auch." | Zentraler Helfer `coolnessSpitzeZiel`; angeschlossen: Tengu Windstorm, Sparkfly Worker/Queen, The Yeeting, Destructive Puppet Shishi, Smug Mastermind Antonia, Coolness Overcharge, Ralzish, Scrap Plow. Dabei Fehler behoben: Stack-Karten, die zerstört wurden, blieben im Stack-Array und standen doppelt im Spiel (`_actionDestroyCardKern` leitet sie jetzt über `actionPopCoolnessStackTo`) |
| Opfer-Zonen (Mehr-Opfer-Karten) | „Es ist jede Zone ein Ziel, die durch Opfern für die Beschwörung leer wird. Wählt man also eine Zone mit 2 Creatures darin, müssen beide geopfert werden, bei mehr Creatures als benötigten Opfern ist eine Zone nicht viable." | `zoneLeerbarDurchOpfer`: Blue-Ice Dragon, Foresta (2 Opfer), Steam Dwarf Dragon Pilot, Dark Deepsea God; alle Insassen der Zielzone sind Pflicht-Opfer, die Karte landet in der gewählten Zone. Ein-Opfer-Karten (Teocuilatl-Trio, Suspicious Monster, Egg of God, Piranha, Trex, Deepsea-Linie) bleiben bei „nur Einzelzonen" |
| Bow – negierter Pfeil | „Nicht verbrauchen" | Negation/Fizzeln gibt das Once-per-turn zurück (`equipReactionRefund`); Kosten bleiben bezahlt |
| Bow – kein Pfeil im Deck | „Nein" | Wird nicht angeboten (Ist-Zustand, Repro) |
| Held unter fremder Kontrolle | „ja, und auch Surprises aktivieren; diese muss der Gegner, wenn er die Kontrolle übernimmt, sehen können, sie werden bekannt! Aber: Manche Kontrolleffekte können explizit ausschließen, mit dem Hero Attacks/Spells auszuführen!" | Besitzer wirkt mit dem Helden weiter Zauber/Attacken, aktiviert neu auch die Surprise aus der Zone des Helden und Hand-Reaktionszauber; Kontrolleur sieht die Surprises des übernommenen Helden (Name, Stufe) bis zur Rückgabe; neue optionale Kontrollrechte `zauber`/`attacken` (`false` sperrt für Kontrolleur und Besitzer; heute stempelt keine Karte so) |
| Love Shot vs. Resistance/Anti Magic Enchantment | „ja" | Schutz greift wie bei jedem Zielhelden (Ist-Zustand, Repro) |
| Love Shot – Wisdom-Kosten | „ja, Hand des aktuellen Kontrolleurs" | `getWisdomDiscardCost` mit `levelSourcePi`/Handindex; Kosten werden vor dem Entnehmen der Karte gerechnet; Kartenwahl bietet bei Kopien-Rabatt nur die rabattierte Kopie |
| Divine Gift of Rain bei Cataclysm | „Nein" | Area des Reagierenden wird nicht geschützt (Ist-Zustand, Repro) |
| Tooltip Divine Gift of Skill | „ja" | „… unless the Hero that cast Divine Gift of Skill ("the user") has at least Magic Arts 1." |
| Rusty Touch | „Rusty Touch soll die Kosten nur einmal abziehen, check das." | Fehler bestätigt: bei Reaktions-Artefakten (Hand-Pfeil, Bow-Pfeil) zog Rusty Touch die Kosten ein zweites Mal ab (Flame Arrow 10 statt 5 Gold). Jetzt nur bei `isInitialCard`; Gold-Bilanz 100 → 95 |

Auf die neue Regel umgestellte alte Repros: `W17/a-ersetzen-alice-stapel-gegenproben`, `W4-kosten/F2-tribut-abbruch-und-belegter-platz`, `W17/c-f01-17-bow-stumm-sperren` (Negation gibt Stempel zurück).

## Ergebnis in Zahlen

* Repros: **alle 996 Repros grün** (Welle 17/18: 986); 10 neue Repros, **0 Rückschritte**, keine Abstürze oder Timeouts.
* Alle 44 `scripts/check-*.js` wie im Ausgangszustand (nur `check-scope.js` rot).
* Skilltest-E2E: rot nur battle, lobby, prep, seats, target; `mcts.test.js` war unter Last einmal rot (Timeout) und ist einzeln grün.
* Dauerfeuer über alle Karten (~2 450 Läufe, beide Seiten): keine neu auffälligen Läufe.

## Offene Rückfragen an Al (Ja/Nein)

1. **Bow (W19c):** Soll das Once-per-turn des Bow auch dann frei bleiben, wenn der Pfeil aufgelöst hat, der Angriff selbst aber danach negiert wird oder verpufft? (jetzt: nein, der Pfeil hat gewirkt)
2. **Abgegebener Held (W19b):** Soll der Besitzer mit ihm auch Hand-Reaktionszauber wirken dürfen (Cure, Anti Magic Shield)? (jetzt: ja; vorher nein nach Ruling Styx 28.9.)
3. **Abgegebener Held (W19b):** Soll der Besitzer eine Kreatur-Surprise in der Zone seines abgegebenen Helden auslösen dürfen, wenn die Übernahme das Beschwören erlaubt? (jetzt: ja; bei dauerhafter Übernahme dient die Kreatur dem Kontrolleur)
4. **Abgegebener Held (W19b):** Soll der Besitzer eine Surprise auslösen dürfen, die der Kontrolleur selbst in diese Zone gelegt hat? (jetzt: nein)
5. **Kontrollrechte (W19b):** Brauchst du künftig eine Karte, die Zauber oder Attacken eines Helden wirklich sperrt, oder reicht der Engine-Vertrag (`zauber`/`attacken` = `false`) vorerst?
6. **Dark Deepsea God (W19a):** Darf der Spieler auch nur eine von zwei Kreaturen eines Alice-Stapels als Tribut zurückgeben (die Zone wäre dann kein Landeplatz)? (jetzt: Anklicken des Stapels gibt alle seine Kreaturen zurück, weil der Client Zonen klickt)
7. **Pinta, the Singing Ship (W19a):** Soll dort bei einem Alice-Stapel in der Zone dieselbe Regel gelten (alle Insassen als Pflicht-Opfer)? (nicht angefasst)

**Hinweise:** Bleibt eine vom Besitzer aktivierte Surprise offen liegen (Glass Wall, Spider Silk Bridge), gehört sie danach wie jede Zone dieses Helden wieder dem Kontrolleur. Nicht angefasst: Dive Bomblebee (Ruling „vom Gegner kontrolliert"), Bad Birthday Girl Cecilia (kein Skript), Analyzer from the Cosmic Depths.
