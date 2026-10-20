# Fix-Wellen 25–33 – Stufe-C-Entscheidungen aus Welle 23, Kontroll-Grundsätze, „zählt als Attack/Spell"

Nach dem Bericht [FIXES-WELLE-24.md](FIXES-WELLE-24.md) (61 A/B-Befunde der Tiefentests N1–N5) hat Al die 17 Stufe-C-Fragen und alle weiteren Rückfragen beantwortet. Die Umsetzung lief in neun Wellen (21.–22.10.2026), je Welle mit Agenten in eigenen Worktrees (Zweige `wave25/W25a|b|c` … `wave33/W33a`, alle zusammengeführt). Details und Verträge stehen am Ende von `cards/effects/CARD_API.md` im jeweiligen Abschnitt „Welle N / WNx"; die Repros liegen unter `docs/niche-tests/repro/W25 … W33`.

## Übersicht

| Welle | Inhalt | Kern der Entscheidung von Al |
|---|---|---|
| **25a** | N1-11 … N1-16, Corpse-Explosion-Nachträge | Attach „to a Hero you control" nur nach aktueller Kontrolle; Dark Ocean verhindert Surprises („cannot react to"); Burn-/Gift-Tick gilt nicht als „defeated by an opponent's card or effect"; Dichotomy verhindert auch Surprise-Vor-Schaden-Reduktionen; Spell-Sperre: Surprise setzen ja, aktivieren (falls Spell) nein; Corpse Explosion auch bei gegnerischer Kreatur ohne Schaden besiegt |
| **25b** | N2-04/05/06/12/14 | Aging sperrt nur das Entfernen durch Effekte, befristete Status laufen normal aus; Divine Gift of the Guardian schützt alle zum Zeitpunkt eines möglichen Effekts kontrollierten Kreaturen (Zeitraum-Marke); Spell-Anhängsel liegen **nie** still (Gathering Storm und Intrude waren ein Bug); Mehrfachziel-Surprises: erst Negation, dann Reaktion auf Treffer; Guardian Angel vs. Aging: Ist-Zustand |
| **25c** | N3-08/13/14/15/16/20, N5-06 | Drill Sergeant bietet Hind/Plant Golem bei vollem Gegnerbrett nicht an und liest die Hand-Stufe; **allgemeine Regel: „place" triggert On-Summon** (Bewegung nie); geopferte Kreaturen werden gelöscht, Status-Schaden-Tode zählen als besiegt; Relic Hammer: Spirit ist nicht „erste Kreatur"; Chuck: Anti-Magic-Immunität zählt als immun gegen die Quelle |
| **26a** | Rückfragen W24 | Potion of Greed bei leerem Potion Deck gesperrt, Cute Camera in Hand-Fenstern bei unbekannter Quelle, Flooding/Glass Wall für „treated as", Alleria/Sabrina, Shadowy Slime (wirksame Stufe) |
| **27a** | Anhänge, „treated as" | **Attachments liegen bei Frozen/Stunned/Negated/Webbed nicht still** (allgemeines Ruling, löst die frühere Auslegung ab); „treated as an Attack" zunächst Level 0 (durch W32a abgelöst) |
| **28a** | Kreatur-Surprises, Very Special Prisoner, „you control" | Kreatur-Surprises brauchen das Beschwörungsrecht (Berserk, Beschwörungssperren); Very Special Prisoner: übernommener Gegnerheld ist Wirt; **„you control" = aktuelle Kontrolle** (Kontrolleur, nicht Besitzer) für Elixirs, Doping, Torchure, Cheese, Yeeting, Crystals, Ankh, Equality, Soul Transmigration, Cool Repair, Sticky Wand, Experimental Potion, Divine Gift of Sacrifice, Ausrüst-Ziele |
| **29a** | Greatmaw, Alliance/Dive Down, Webbed | Infected Greatmaw zählt als Attack des gewählten Helden; Alliance und Dive Down schützen auch vor Effekten, die als Attack/Spell **zählen**; Webbed negiert Hero-Abilities/Handeln, **nicht** Attachments |
| **30a** | Bamboo Staff, Sacrificial Dagger, Alluring Light, Clash of Champions, Bluff, Crimson Web, Tharxian Horse, Weathercock | „Hero hitting with an Attack" = Fighting-Level; die genannten Reaktionen reagieren auf „zählt als Attack/Spell" |
| **31a** | Ziel-Regeln bei Kontrollwechsel | Temporär übernommener Held ist gültiges (Kosten-)Ziel, auch wenn die Wirkung verpufft; „one of your Heroes" nach Kontrolle (außer ausdrücklich immun gegen eigene Karten, `heroImmunGegenEigene`); **Kreaturen sind unabhängig von Heroes** (eigener Kontrolleur/Besitzer, auch bei dauerhaft übernommenem Helden); Creature-Surprises kosten und zählen als **keine** Actions |
| **32a** | Allgemeine „Zählt-als"-Regel | **Zählt ein Effekt als Attack/Spell eines Helden, nutzt er das Ability-Level dieses Helden** (Fighting bzw. Schulstufe); löst „Broghan & Co immer Level 0" ab. Geblockt, wenn der Held nicht angreifen kann; der gewählte Held ist der Angreifer; alle Attack/Spell-Leser reagieren mit |
| **33a** | Weakening Crystal, Sickly Cheese, Kreatureneffekte, „Hero you control" | Weakening Crystal folgt der Kontrolle; Sickly Cheese nur aktivierbar, wenn das Ziel vergiftbar ist (Charme-Held zählt nicht); Hand-Reaktions-Kreaturen sind Actions (unter `bound` unspielbar, Ist-Zustand); **nur der aktuelle Kontrolleur aktiviert den Effekt einer Kreatur**; Escape Device und Audit: alle „Hero you control" nach aktueller Kontrolle |

## Allgemeine Regeln, die aus diesen Wellen entstanden sind

* **Place triggert On-Summon** (Bewegung `_isMove` nie; nur „Kreatur betritt Zone"-Beobachter).
* **„you control" = aktuelle Kontrolle (Kontrolleur, nicht Besitzer)** – gilt für alle Karten mit „Hero you control". Ein temporär übernommener Held ist trotzdem gültiges Ziel/Kostenziel, auch wenn die Wirkung verpufft (Ausnahme: Sickly Cheese verlangt ein vergiftbares Ziel).
* **Kreaturen sind unabhängig von Heroes:** eigener Kontrolleur/Besitzer, nur der aktuelle Kontrolleur aktiviert ihren Effekt (Ausnahme laut Kartentext: The Creepy Clown of Heaven).
* **Attachments liegen bei Frozen/Stunned/Negated/Webbed nicht still**; Webbed negiert nur Hero-Abilities und Handeln.
* **Zählt-als-Regel:** Effekte erklären ihre Art deklarativ mit `treatedAsAttack: { ability: 'Fighting' }` bzw. `treatedAsSpell: { school }`; die Stufe ist das Ability-Level des Helden. Zentrale Klassifikation `_zaehltAlsArt`; Sperrprüfung `heroKannAngreifen`; virtuelle Attack-Kette `alsAttackKette`, damit Reaktionsfenster greifen.
* **Creature-Surprises** kosten und zählen als keine Actions (`bound` sperrt sie nicht), Beschwörungssperren (Berserk, Grinning Cat) aber schon; **Hand-Reaktions-Kreaturen** zählen als Actions.
* **Opfer-Beschwörung** (Welle 20): Zonen, die durch die geforderten Opfer leer werden.

## Ergebnis in Zahlen

* Repros nach Zusammenführung aller Wellen: **alle 1157 Repros grün**, 0 Rückschritte, keine Abstürze oder Timeouts. Verlauf der grünen Repros: 1096 (nach W24) → 1131 (nach W25–27) → 1139 (W28/29) → 1142 (W30a) → 1143 (W31a) → 1148 (W32a, 6 neue) → 1151 (W33a, 5 neue).
* Umgestellte alte Repros: `W26/a-03`, `W27/a-02`, `W27/a-03`, `W30/a-01…a-03` (Level-0-Regel → Fighting-/Ability-Level), `W31/a-01` und `W28/a-03` (Sickly Cheese).
* `scripts/check-*.js`: nur `check-scope.js` rot (wie im Ausgangszustand); `check-cpu-deck-rules.js` war im Sammellauf einmal rot und ist einzeln grün (Lastflake).
* Skilltest-E2E: rot nur battle, lobby, prep, seats, target (Ausgangszustand); cards/artifacts/learn/draw-cards/mcts sind unter Last flaky und einzeln grün.
* Dauerfeuer über alle Karten (~2 450 Läufe, beide Seiten) nach der Zusammenführung: 0 Abweichungen zur Basis; je Welle keine neu auffälligen Läufe (W32a: 56 + 140 Kaltstartfälle, W33a: 140 Läufe, 0 Differenzen).

## Nicht geändert / Hinweise

* **Guardian Beast Hu** („additional Action with any Hero you control") sammelt nur die eigene Spalte; ein übernommener Gegnerheld wird nicht als Aktionsträger angeboten (Aufwand mittel, nicht angefasst).
* **Dark Gear**: Zonenliste ist die eigene Spalte inkl. leerer Heldenplätze. **Golden Wings / Deepsea Encounter**: Kreaturen-Ziele laufen über die Brettseite (Kreaturen-Form, nicht „Hero you control"). **Bamboo Shield**: „a Hero would take damage" ohne „you control" – Auslegung auf die eigene Spalte bewusst.
* Ohne Skript (unverändert): Meditation, Expedition, Motharch Squire, Anti Intruder System, Last Second Escape, Homecoming, Wendy, Unholy Combination, Metamorphosis of Serket, Bad Birthday Girl Cecilia, Trident Spirit – Hammer Absorbed, Patty, Clash of Champions (Helfer vorbereitet).

## Offene Rückfragen an Al (Ja/Nein)

1. **Alluring Light (W32a):** Soll der von Alluring Light gezwungene Held ebenfalls geblockt sein, wenn er nicht angreifen kann (gefroren, betäubt usw.)? (heute geblockt wie die anderen Fighting-Level-Effekte)
2. **Alice (W32a):** Sollen „spielt/aktiviert einen Spell"-Reaktionen (Silence, Shamanic Curse, MOE Shield, Storm Ring) und Magic Mirror (nur negieren, Kopie nicht möglich) auch auf Alices als Spell zählenden Kreaturenschaden reagieren?
3. **Zähler und Sperren (W32a):** Sollen Effekte, die als Attack zählen, auch für Attack-Zähler und -Sperren zählen (Berserk-Limit 2, Knife Throw „nur Attack", Rioting Village „1 Attack pro Zug")? (heute nein)
4. **Dark Ocean (W32a):** Ist es richtig, dass unter Dark Ocean die eigenen Arrows des Besitzers auf den Greatmaw-Treffer reagieren dürfen, während die Reaktionen des Gegners geblockt bleiben?
