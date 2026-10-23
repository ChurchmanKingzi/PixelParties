# Fix-Welle 63 (W63a) – Alice-Teilung: erst die geteilte Zone · „free Support Zone" für alle Wege · Surprise Party · Bewegen · Reincarnation

Umgesetzt vom Agenten **W63a** (Zweig `wave63/W63a`) als Antwort auf Als **fünf Ja-Antworten** zu den Rückfragen aus Welle 62 (`FIXES-WELLE-62.md`). Details und Verträge: `cards/effects/CARD_API.md`, Abschnitt „Welle 63 / W63a"; Repros `docs/niche-tests/repro/W63/a-01` … `a-06` (Exit 0 = korrekt), Szenenbau `docs/niche-tests/lib/alice-brett.js`.

| Frage (Al: Ja) | Umsetzung |
|---|---|
| **1 · „free Support Zone" im Kartentext + Alice, für ALLE Beschwörungs-/Platzierungswege** | Systematische Suche nach jeder Zonenschleife; umgestellt auf `beschwoerZonenFuer` / `_alice-shared.mitGeteilten` / `ersteBeschwoerZone`: Glorious Rebirth, Living Illusion, Teal Fishing Rod, The Root of all Evil, The Master's Key, Thep, Stellan, Stellin, Vullary, Klaus, Sentient Bomb Golems, Mausoleum Worm, Paraseed, Paraseed Zombie, Calamitusk, Bomblebee Cluster, Loyal Pinpom, Orthos, Psychic Scout, Soul Shard Khet/Ka, Rebelliokai Terror Tengu, Cute Annoyance Mini, Cute Bunny/Dog/Hydra, Skullmael's Greatsword, Lunatic Hawk, Tharxian Horse, Waitress, Candlestick Squire, Elven Druid, Mischief Invasion, Hipdall; Übernahmen: Capture, Dark Gear, Diplomacy, Hunting, Liberation, Secret Spell Book, Cute Angel Molinda, Spirit of the Heart Bow. Die in W62a nur „geladenen" Karten (Elixir of Immortality, Zombified Assault, Old Couple, Ladder to the Sky, Arrival from the Cosmic Depths, Green Dragoneer, Doomed Town Guard, Enhanced Guard Dog, Explosive Drone, Kings-Familie, Golden Ladybug; Ushabti läuft über die zentrale Frage) haben jetzt je ein Szenario. Szenarien (a-02) gibt es für 25 dieser Karten; die übrigen sind per Code-Review auf dieselben Primitive umgestellt und geladen (Ladetest). Begründete Ausnahmen („nicht betroffen"): CARD_API. |
| **2 · Reihenfolge: erst die geteilte Zone, DANN die erste leere** | Zentral (`getFreeSupportZones`, `beschwoerZonenFuer`, `eligibleSummonZones`, `safePlaceInSupport`, CPU) und in allen Kartenlisten. Wo der Spieler wählt (Hand-Beschwörung, Zonenwahl-Prompts, Slot-Picker) bleiben beide wählbar, Vorauswahl = geteilte Zone; Pinta, Slimes, Auto-Platz und CPU nehmen die geteilte Zone. Neu: `engine.ersteBeschwoerZone`, `geteiltZuerst`, `mitGeteilten`. Client: `findAutoSummonSlot` (geteilt vor frei) für Auto-Emits der Heldenaktions-Beschwörung. W62/a-01 und a-04 an die Reihenfolge angepasst. |
| **3 · Surprise Party** | Spielbar mit freier Zone ODER (Alices Effekt aktiv + legale Deck-Creature [Level ≤ 3, kein Plant Golem/Elusive Hind/Ifrit …] mit Kopie in den Zonen); die gefundene Creature kommt zuerst in die geteilte Zone, Unpassendes wird wie bisher zurückgemischt. |
| **4 · Bewegen in geteilte Zonen** | Guard Change, Slippery Ice/Skates/Pengu, Memory Blast, Jumper Spider, Paraseed Greenhouse; Quell-Zone verliert die Karte; kein On-Summon beim Bewegen; Puppets bleiben unbeweglich; Skates-Prompt trägt `nurSlots`/`shared`/`stackDepth` (Client filtert). |
| **5 · Reincarnation** | Kreatur-Modus: 3 freie Zonen ODER 2 freie + geteilte Zone der Kreatur; Spielbarkeit, Zonenwahl (Mensch/CPU), Platzierung und Token-Bezahlung stimmen überein. |

* **Nicht angefasst:** Kartentexte in `data/cards.json`; `repro-status.json`/Index; `server.js`. Bundles: `node scripts/build.js --force` und `node scripts/check-bundles.js` laufen sauber (`public/dist/` ist nicht versioniert). `scripts/check-*.js`: alle grün außer `check-scope.js` (51 Altstellen, wie im Ausgangsstand).
* **Gesamtlauf** (`runall`, alle 1280 Repros inkl. der 6 neuen): 1280 × „tritt NICHT auf" (= korrekt). Der erste Lauf zeigte zwei Rückschritte (W20/c-1 Paraseed Zombie, W21/a-4 Bomblebee Cluster: Helden der Gegenspalte); behoben in `beschwoerZonenFuer` (`seite` ≠ Beschwörer) und `_alice-shared.ersterPlatzAufHeld`.
* **Bugfix-Notes** stehen in den drei Commit-Nachrichten (je Karte/Baustein eine Zeile).

## Tests

| Datei | Inhalt | Prüfungen | alter Stand |
|---|---|---|---|
| `repro/W63/a-01-reihenfolge-erst-geteilte-zone-dann-erste-leere.js` | Hilfsfragen und Reihenfolge (Pinta, Slimes, Surprise-Party-Platzierung, CPU, Spielerwahl mit beiden Optionen), beide Sitze | 66 | rot (Absturz: `ersteBeschwoerZone` fehlt) |
| `repro/W63/a-02-free-support-zone-alle-platzierungswege-teilen.js` | 25 Karten × beide Sitze × voll / gemischt (freie Zone bleibt leer) / Gegenprobe ohne Alice; `FILTER=<Name>` | 498 | rot |
| `repro/W63/a-03-surprise-party-spielbar-mit-teilbarer-deck-creature.js` | voll + Alice + passende Creature → spielbar und geteilte Zone; ohne Alice / ohne Kopie / Plant Golem, Elusive Hind / Level 4 → nicht spielbar; gefallene/abgezogene Alice; Alice nur beim Gegner; gemischtes Brett; unpassende erste Creature | 76 | 32 ✗ |
| `repro/W63/a-04-bewegen-in-geteilte-zone-guard-change-slippery.js` | Guard Change, Slippery Ice, Slippery Skates mit/ohne Alice (Ziel `shared`, Stapel ×2, Quelle leer) | 46 | 22 ✗ |
| `repro/W63/a-05-bewegen-memory-blast-jumper-spider-puppet-kein-on-summon.js` | Memory Blast, Jumper Spider (kein `onPlay`), Puppet unbeweglich, Paraseed Greenhouse | 46 | 16 ✗ |
| `repro/W63/a-06-reincarnation-geteilte-zone-statt-dritter-freier.js` | Kreatur-Modus: 2 freie + geteilt spielbar; Gegenproben; Alice gefallen/abgezogen; 3 freie + geteilt (beide wählbar); Mensch- und CPU-Pfad | 118 | 38 ✗ |

## Rückfragen an Al (Ja/Nein)

1. **Army of the Cute:** eine zweite gleichnamige Kopie darf sich auf die erste stapeln (gleiche Kreatur zweimal in dieselbe Zone) – so umgesetzt – ja/nein?
2. **Elixir of Immortality:** die ursprüngliche Zone der Kreatur behält Vorrang (Kartenregel), erst danach geteilt vor frei – ja/nein?
3. **Tokens mit Untertyp „Creature"** (Leprochaun-, Mummy-, Invader-, Biomancy-, Inya-, Kyli-Token): sollen sie sich bei aktiver Alice ebenfalls eine Zone teilen? Derzeit **nein** (nur echte Kreaturenkarten; Pollution Token ist keine Kreatur) – soll das so bleiben?
4. **Klick-Beschwörung mit mehreren Helden:** der Spieler wählt weiter selbst (Slot-Picker, geteilte Zone vorn) statt automatisch die geteilte Zone zu bekommen – ja/nein?
5. **Beobachtung (nicht behoben):** `actionPlaceCreature` überschreibt eine belegte, nicht teilbare Zone; bei „gleiche Zone"-Ersetzungen aus einem Stapel (Kasperov [B], Rook [W], Loyal-Rottweiler-Typ) können Geisterinstanzen übrig bleiben. Folgeauftrag erwünscht – ja/nein?
