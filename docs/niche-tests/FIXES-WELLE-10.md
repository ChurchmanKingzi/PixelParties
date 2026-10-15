# Fix-Welle 10 – Einzelfragen 26–55

Al hat die Rückfragen aus Welle 9 und die Einzelfragen 26–55 beantwortet; zwei Agenten haben sie umgesetzt: W10a (`wave10/W10a` b7d6e00: Ereignisse, Equip-Fenster, Rebelliokai/Skeleton) und W10b (`wave10/W10b` 2313b17: Bomblebee, Zählregeln, Distracting Crystal, Waflav). Beide Zweige sind zusammengeführt (einziger Konflikt: `CARD_API.md`).

## Entscheidungen von Al (verbindlich, in `CARD_API.md` verankert)

| Frage | Entscheidung / Umsetzung |
|---|---|
| R1/R2/R4/R5/R7 (Welle 9) | Cosmic Manipulation/Arrival so lassen; Spores als Reaction auch im eigenen Zug; Magic-Mirror-Reihenfolge passt; Q19 bestätigt; Cuteness Sensor bleibt |
| R3 Siphem, Teppes, Analyzer, Gatherer | Zählen **Ereignisse**, nicht Karten: gibt Dark Deepsea God 3 Kreaturen zurück, ist das ein Ereignis (Siphem +1, Teppes zieht 1, Analyzer/Gatherer je +1; Hook `onCardsReturnedToHand` einmal je Batch). Blood Moon zählt weiter je Kreatur |
| R6 Equip-Fenster | Nach Wortlaut: Afflicted Pests („equips or attaches a card to a Hero") wertet den **Anleger**, löst auch bei Cross-Side-Ausrüstung aus; Cybug LOCUST („a Hero they control") braucht Anleger = Gegner UND Held = vom Gegner kontrolliert. Methode `_anlegerEinerSupportKarte` |
| Q26 Lunatic Hawk | zählt sich bei der eigenen Beschwörung nicht selbst (Ist-Zustand) |
| Q28 Bomblebee Cluster | „different names" nur untereinander; der Name der auslösenden Karte ist erlaubt |
| Q29 Burning Fuse | auch im eigenen Zug spielbar; erfasst Time Bomblebee (Counter über simuliertes Gegner-Tod-Ereignis, wegen eigener Immunität nicht zerstört) |
| Q30 Sandy Blob | nur wenn der On-Summon-Effekt wirklich wirkt; Cloudy/Shadowy Slime ohne Kandidat fizzeln sichtbar |
| Q31/Q32/Q49 | Skullmael-Reihenfolge (Bonus nur für Skelette, die beschworen werden, solange Skullmael schon auf dem Feld ist), Vacarn/Bonegrinder (kein Ziehen), Clausss (zweites Opfer erlaubt, Text hat kein „only control 1") bleiben wie sie sind |
| Q33 Raise the Minions! | beendet den Zug nicht mehr |
| Q34 Skeleton Necromancer | abgeworfenes Skelett nicht sofort wieder wählbar (Ist-Zustand) |
| Q35 Deepsea Skeleton | zählt als Skeleton und als Deepsea |
| Q36 Spinnen-Kosten | jede offene Surprise zählt für „send N Surprises" |
| Q37/Q38 Loyal Bone Dog | gegen Zerstören ja, gegen Opfer nein; Wiederbelebung läuft vor den Todes-Triggern anderer Karten |
| Q40 Tanuki Escape | Ausschließung zurückgemischter Namen bleibt; Kartentext präzisiert („…with different names from each other and from the cards shuffled back this way…") |
| Q41 Chilly Wizard | gespiegelter Status an den Wizard gebunden (endet mit Heilung/Tod/Abgang); „cannot be negated" → ruht nicht |
| Q44 Mischief Invasion | „summon" erfordert einen agierfähigen Beschwörer: Frost/Betäubung (und Webbed) sperren alle Stufen; Gangster Angel prüft den Beschwörer |
| Q46 War Council Gathering Place | Effekt wird ohne legales Ziel nicht angeboten (kein Gold weg) |
| Q47 „Erste Kreatur, die du beschwörst" | Jede Platzierung und Beschwörung zählt (Xuanwu, Vullary, Stellin, Stellan, Klaus, Master's Key, Selbst-Platzierungen wie Blue-Ice Dragon, Foresta, Waitress, Dark Deepsea God); zentral über `zaehleBeschwoerung` |
| Q54 Distracting Crystal | unterdrückt auch Einsatz-Effekte (Black Marketeer, Deepsea Stein) und Auslöser (The Stormblade, Lunatic Cycle – Crescent Moon) |
| Q55 Waflav | „any target" nur Helden und Creatures (inkl. Artifact Creatures); Gift zählt jeden neuen Stack, Burn nur das initiale Burned |

## Zahlen (zusammengeführter Stand)

* Repros: **490 grün** von 795 (Welle 9: 452 von 778); 21 weitere Befunde behoben, **0 Rückschritte**, 0 Abstürze/Timeouts; die neuen W10-Repros (`W10/a-*`, `W10/b-*`) sind grün.
* Alle 44 `scripts/check-*.js` wie im Ausgangszustand (nur `check-scope.js` rot). Skilltest-E2E: rot nur battle, lobby, prep, seats, target; `bot-actions.test.js` lief im Gesamtlauf unter Last in den Timeout und ist einzeln zweimal grün (Lastflake). Dauerfeuer über alle Karten: keine neu auffälligen Läufe.

## Rückfragen an Al (ja/nein)

1. Sollen Spell-/Attack-Anhängsel (Curse, Stoneskin usw.) das Equip-Fenster von Afflicted Pests und LOCUST öffnen? (heute nein) 2. Soll Powder Keg (platziert) das Equip-Fenster von Pests öffnen? (heute nein) 3. Gathering Place: Gold zurück bei freiwilligem Abbruch einer vorhandenen Zielwahl? (heute weg) 4. Sollen eine „you may"-Ablehnung oder ein Suchen ohne Treffer (Harpyformer, Sparkfly Architect) Sandy Blob auslösen? (heute ja) 5. „Beschwörer muss agieren können" auch für Elven Rider, Orthos, Monster Nest, Hipdall-Stack-Ausnahme „Negated + Lv0"? (heute nein) 6. Anti Magic Enchantment: nur eigene Artefakte (heute) oder jedes angelegte? 7. Waflav-Zielliste auch für Deep-Drowned Waflav („deal 100 damage to a target") nur Helden/Creatures? 8. Selbst-Platzierungen zählen als Beschwörung des Zuges – gewollt? 9. Stormblade-Treffer-Zyklus bleibt trotz Distracting Crystal in der Hand des Getroffenen – richtig?
