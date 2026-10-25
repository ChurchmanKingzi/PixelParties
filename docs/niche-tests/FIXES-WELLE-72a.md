# Fix-Welle 72 (W72a) – Control Monitors reagiert auf JEDES Hinzufügen aus Deck oder Ablage

Umgesetzt vom Agenten **W72a** (Zweig `wave72/W72a`) auf Wunsch von Al (Fehlerbericht 25.10.2026): „Die Puzzle-CPU aktiviert, trotz eines Heroes, der das könnte, nie ‚Control Monitors' in Reaktion auf meine Magnetic Potion. Die Erwartung ist: Ich füge eine Karte meiner Hand hinzu, also sollte Monitors eingesetzt werden und die nehmen!"
Kartentext (unverändert): „Play this card immediately when your opponent adds 1 or more cards from their deck or discard pile to their hand by discarding the same number of cards from your hand. Delete the cards your opponent added. Your opponent may delete all other cards in their hand instead." – Magnetic Potion: „Choose a card from your deck, reveal it and add it to your hand. You can only play 1 "Magnetic Potion" per turn." (kein Abwurf).

## Ursache
`control-monitors.js` reagierte nur auf den Hook `onHandAddByDiscard`, den nur sechs Abwurf-Tutoren selbst meldeten (Cute Dog, Cute Annoyance Mini, Life-Searcher, Inventing Lv3, Lunatic Cycle - New Moon, Navigation). „by discarding the same number of cards from your hand" war als Preis des HINZUFÜGENDEN gelesen. Magnetic Potion und jede andere Hinzufügung ohne Abwurf öffnete nie ein Fenster – für Mensch UND CPU, im Puzzle genauso. An der CPU lag es nicht: sie spielt die Reaktion, sobald ein Fenster aufgeht (Gehirn und Puzzle-Gegner, Repro a-17).

## Auslegung (Al, per Fehlerbericht)
* **Auslöser:** JEDES Hinzufügen von 1 oder mehr Karten aus dem **eigenen** Deck oder der **eigenen** Ablage auf die eigene Hand des Gegners.
* **Preis:** „your hand" = die Hand dessen, der Control Monitors spielt. Er wirft so viele Handkarten ab, wie der Gegner hinzugefügt hat (N), zusätzlich zu Control Monitors selbst. Die Karten werden bei der Aktivierung GEWÄHLT (`handPick`, abbrechbar → nichts passiert) und erst danach bezahlt (CARD_API „Kosten und Limits erst nach dem Commit"); Boris darf den Preis ignorieren.
* **Bedingungen fürs Angebot:** Hand des Reaktionsspielers hat ≥ N **weitere** Karten (plus ein nötiger Weisheits-Abwurf des Wirkers) und mindestens eine hinzugefügte Karte liegt noch auf der Hand des Gegners.
* **Rest wie bisher:** genau die hinzugefügten Karten löschen; der Hinzufügende darf stattdessen alle anderen Handkarten löschen (seine Wahl); Löschen ist kein Abwurf; Ambush the Scout darf das Löschen negieren; Animation `control_monitors`.

## Änderungen
* **`_hooks.js`:** `ON_HAND_ADD_FROM_PILE: 'onHandAddFromPile'` (ersetzt `onHandAddByDiscard`). Kontext `{ playerIdx, cardNames, piles, sourceName, hinzugefuegt }`.
* **`_engine.js`:**
  * `noteHandZugangAusStapel(pi, name, { pile, source, fromOwner })` sammelt zentral – gerufen aus `handZugang` (`von: 'deck'|'ablage'`), `actionAddCardFromDeckToHand` (dadurch auch `searchDeckForNamedCard` und `addFromPileToHand('deck')`), `addCardFromDiscardToHand` (nur der eigene Stapel). `takeFromPile(…, { toHand: true })` merkt Entnahmen aus eigenem Deck/eigener Ablage vor (`_merkeHandZugangUnterwegs`), `returnToPile` nimmt sie zurück; so sind auch die Eigenbau-Tutoren (`takeFromPile` + `handZugangSync` + eigener Hook) ohne Skript-Änderung erfasst.
  * Ein Hook je Wirkung (Schlüssel Spieler + Quelle): `_wertHandZugangAus` als Nach-Ketten-Aktion; `meldeHandZugangAusStapel(pi, { source })` für Tutoren, die dahinter weiterrechnen (Lunatic Cycle: Kostensenkung, Cute Annoyance Mini: Beschwörungs-Zusatz). `meldeHandZugangDurchAbwurf` entfällt – die sechs Abwurf-Tutoren rufen die neue Funktion, kein Doppel-Fenster.
  * Option `ohneZugangsFenster: true` für Zwischenschritte, die kein „add to hand" sind (Cooldin, Hipdall).
  * Neuer Skript-Vertrag für Hand-Reaktionen: `reactionKostenWahl` / `reactionKostenZahlen` (Wahl nach Aktivierung und Wirkerwahl, abbrechbar; Zahlung nach Handentnahme und Kartenanzeige).
  * `runHooks`: das Fenster von `onHandAddFromPile` darf mitten in einer Kette öffnen (wie `onCreatureSummoned`).
* **`control-monitors.js`:** `reactionCondition` (Hook, Gegner, Karten noch auf der Hand, ≥ N weitere Karten), `reactionKostenWahl`/`reactionKostenZahlen`, `cpuResponse` (Preiswahl im Puzzle ohne Gehirn: billigste Karten; Hinzufügender: „added"), Kopfkommentar neu (die „Rückfrage an Al" ist erledigt).
* **Eigenbau-Tutoren ergänzt (`noteHandZugangAusStapel`):** Mass Multiplication, Birthday Present (nur die 2 eigenen Karten), Magic Lamp (nur die 2 eigenen Karten), Kit (Modus A), Krates (der Suchende), Crum (Tausch aus der Ablage).
* **CPU/Puzzle:** keine Änderung an `_cpu.js` nötig (Test a-17: Gehirn auf beiden Sitzen, Puzzle-Gegner, kein Held/zu wenige Karten → nichts, CPU als Hinzufügende).

## Inventur: Karten, die Karten aus Deck oder Ablage auf die Hand legen
Methode: (1) Textsuche in `data/cards.json` (add … hand / deck / discard pile; 216 Treffer), (2) Quelltext-Scan aller Skripte nach Hand-Zugangswegen (Primitive, `handZugangSync`, selbst gefeuerte Hooks, `hand.push`), (3) Zustands-Sweep `a-18` über alle 1188 spielbaren Handkarten, 269 Aktivierungen und die Passiven, gemessen als „Karte kam aus Deck/Ablage auf die Hand, aber kein Fenster". „Vorher" = Wächter-Sweep auf dem Ausgangsstand `2e266b07` (45 Lücken allein bei den Handkarten, 5 bei den Aktivierungen). „Nachher" = ein Fenster je Wirkung (N = Zahl der Karten).

### A) Fenster nachher: ja
| Karte | Typ | Quelle | Weg im Skript (zentrales Primitiv) | Fenster vorher | Fenster nachher | Belegt durch |
|---|---|---|---|---|---|---|
| Amazing Finding | Attack | Deck (oberste Karten) | `actionAddCardFromDeckToHand` | nein | ja | Primitiv-Test a-13 |
| Angry Cheese | Artifact | Deck | `actionAddCardFromDeckToHand` | nein | ja | Sweep a-18 |
| Aurora Borealis | Spell | Deck | `handZugang`, `takeFromPile(toHand)` | nein | ja | Sweep a-18 |
| Ballad Harpyformer | Creature | Deck | `searchDeckForNamedCard` | nein | ja | Sweep a-18 |
| Beato, the Eternal Butterfly | Ascended Hero | Deck | `actionAddCardFromDeckToHand` | nein | ja | Primitiv-Test a-13 |
| Bifab, Bridge to Coolness | Spell | Deck | `handZugang`, `takeFromPile(toHand)` | nein | ja | Primitiv-Test a-13 |
| Birthday Present | Artifact | Deck | `noteHandZugangAusStapel` | nein | ja — die 2 eigenen Karten ja, die Gabe (Gegner-Karte) nein | Sweep a-18 |
| Bishop of Kings [W] | Creature | Deck | `actionAddCardFromDeckToHand` | nein | ja | Sweep a-18 |
| Blueprints | Artifact | Deck | `actionAddCardFromDeckToHand` | nein | ja | Sweep a-18 |
| Boomerang | Artifact | Ablage | `addCardFromDiscardToHand` | nein | ja | Primitiv-Test a-13 |
| Brainstorming | Spell | Deck/Ablage | `actionAddCardFromDeckToHand` | nein | ja | Primitiv-Test a-13 |
| Brilliant Idea | Spell | Deck | `actionAddCardFromDeckToHand` | nein | ja | Sweep a-18 |
| Buttap | Creature | Deck | `actionAddCardFromDeckToHand` | nein | ja | Sweep a-18 |
| Cecilia, the Harrowing Crusader | Hero | Deck | `actionAddCardFromDeckToHand` | nein | ja | Sweep a-18 |
| Chaorc Friendly Fireballer | Creature | Deck/Ablage | `takeFromPile(toHand)` | nein | ja | Primitiv-Test a-13 |
| Classical Harpyformer | Creature | Deck | `searchDeckForNamedCard` | nein | ja | Sweep a-18 |
| Cleansing of the Land | Spell | Deck/Ablage | `actionAddCardFromDeckToHand` | nein | ja | Sweep a-18 |
| Codumbus, the Clueless Voyager | Hero | Deck/Ablage | `handZugang` | nein | ja | Primitiv-Test a-13 |
| Cool Cheese | Artifact | Deck | `actionAddCardFromDeckToHand` | nein | ja | Sweep a-18 |
| Country Harpyformer | Creature | Deck | `searchDeckForNamedCard` | nein | ja | Sweep a-18 |
| Creative Puppet Brammi | Token | Deck | `actionAddCardFromDeckToHand` | nein | ja | Primitiv-Test a-13 |
| Crum, the Class Pet | Creature | Ablage | `noteHandZugangAusStapel` | nein | ja | gezielt a-20 |
| Crushing Defeat | Spell/Reaction | Deck | `searchDeckForNamedCard` | nein | ja | Primitiv-Test a-13 |
| Cute Annoyance Mini | Hero | Deck | `handZugang`, `takeFromPile(toHand)`, `meldeHandZugangAusStapel` | ja (Abwurf-Tutor) | ja | Sweep a-18 |
| Cute Cheese | Artifact | Deck | `actionAddCardFromDeckToHand` | nein | ja | Sweep a-18 |
| Cute Dog | Creature | Deck | `actionAddCardFromDeckToHand`, `meldeHandZugangAusStapel` | ja (Abwurf-Tutor) | ja | Sweep a-18 |
| Cuteness Sensor | Artifact | Deck | `actionAddCardFromDeckToHand` | nein | ja | Sweep a-18 |
| Cybug ANTS | Creature/Surprise | Ablage | `_cybug-shared: handZugang`, `_cybug-shared: takeFromPile(toHand)` | nein | ja | Primitiv-Test a-13 |
| Cybug BEE | Creature/Surprise | Ablage | `handZugang`, `_cybug-shared: handZugang`, `_cybug-shared: takeFromPile(toHand)` | nein | ja | Primitiv-Test a-13 |
| Cybug CENTIPEDE | Creature/Surprise | Ablage | `_cybug-shared: handZugang`, `_cybug-shared: takeFromPile(toHand)` | nein | ja | Primitiv-Test a-13 |
| Cybug LADYBUG | Creature/Surprise | Ablage | `_cybug-shared: handZugang`, `_cybug-shared: takeFromPile(toHand)` | nein | ja | Primitiv-Test a-13 |
| Cybug LOCUST | Creature/Surprise | Ablage | `_cybug-shared: handZugang`, `_cybug-shared: takeFromPile(toHand)` | nein | ja | Primitiv-Test a-13 |
| Cybug RHINOCEROS | Creature/Surprise | Ablage | `_cybug-shared: handZugang`, `_cybug-shared: takeFromPile(toHand)` | nein | ja | Primitiv-Test a-13 |
| Cybug SCARAB | Creature/Surprise | Ablage | `_cybug-shared: handZugang`, `_cybug-shared: takeFromPile(toHand)` | nein | ja | Primitiv-Test a-13 |
| Dajan, Conqueror of the Treasure Cave | Ascended Hero | Deck | `actionAddCardFromDeckToHand` | nein | ja | Primitiv-Test a-13 |
| Debt-O-Tron Model Backup Duplicator | Artifact/Creature | Deck | `handZugang`, `takeFromPile(toHand)` | nein | ja | Primitiv-Test a-13 |
| Deep-Drowned Waflav | Ascended Hero | Ablage | `_waflav-shared: takeFromPile(toHand)` | nein | ja | Primitiv-Test a-13 |
| Deepsea Treasure | Spell | Deck | `handZugang` | nein | ja | Sweep a-18 |
| Deepsea Witch | Creature | Deck | `actionAddCardFromDeckToHand` | nein | ja | Sweep a-18 |
| Divine Gift of Creation | Spell | Deck | `actionAddCardFromDeckToHand` | nein | ja | Sweep a-18 |
| Divine Gift of Time | Spell/Reaction | Ablage | `handZugang`, `takeFromPile(toHand)` | nein | ja — technisch aus der Ablage (Ersatz „instead“) — zählt, Frage 4 | Primitiv-Test a-13 |
| Elixir of Mana | Potion | Ablage | `addCardFromDiscardToHand` | nein | ja | Sweep a-18 |
| Elusive Hind | Creature | Deck | `actionAddCardFromDeckToHand` | nein | ja | Primitiv-Test a-13 |
| Elven Rider | Creature/Reaction | Deck | `actionAddCardFromDeckToHand` | nein | ja | Primitiv-Test a-13 |
| Fiona, the Empty Vessel of a Forgotten Sorceress | Ascended Hero | Deck | `actionAddCardFromDeckToHand` | nein | ja | Primitiv-Test a-13 |
| Future Tech Database | Artifact | Deck | `actionAddCardFromDeckToHand` | nein | ja | Primitiv-Test a-13 |
| Future Tech Lamp | Artifact | Deck/Ablage | `actionAddCardFromDeckToHand` | nein | ja | Primitiv-Test a-13 |
| Gate to the Armory | Spell | Deck/Ablage | `takeFromPile(toHand)` | nein | ja | Sweep a-18 |
| Grasp the Future | Spell | Deck | `actionAddCardFromDeckToHand` | nein | ja | Primitiv-Test a-13 |
| Graveyard Gathering | Spell | Deck | `actionAddCardFromDeckToHand` | nein | ja | Sweep a-18 |
| Grunge Harpyformer | Creature | Deck | `searchDeckForNamedCard` | nein | ja | Sweep a-18 |
| Guardian Beast Shu | Creature | Deck/Ablage | `actionAddCardFromDeckToHand`, `addFromPileToHand`, `handZugang`, `takeFromPile(toHand)` | nein | ja — Deck und/oder Ablage | Sweep a-18 |
| Harpyformer Choir | Creature | Deck | `searchDeckForNamedCard` | nein | ja | Sweep a-18 |
| Heart of Cards | Artifact | Deck (oberste Karte) | `actionAddCardFromDeckToHand` | nein | ja | Primitiv-Test a-13 |
| Hell Fox | Creature | Deck | `actionAddCardFromDeckToHand` | nein | ja | Primitiv-Test a-13 |
| Herbithorn Demon | Creature | Ablage | `_cycling-demons-shared: addCardFromDiscardToHand` | nein | ja — eigene Ablage ja, fremde Ablage nein | Primitiv-Test a-13 |
| Holy Cheese | Artifact | Deck | `actionAddCardFromDeckToHand` | nein | ja | Sweep a-18 |
| Idol of Crestina | Artifact/Reaction | Deck | `actionAddCardFromDeckToHand` | nein | ja | Sweep a-18 |
| Inventing | Ability | Deck | `searchDeckForNamedCard`, `meldeHandZugangAusStapel` | ja (Abwurf-Tutor) | ja | Primitiv-Test a-13 |
| Kassaran, Seer of Everything | Hero | Deck | `actionAddCardFromDeckToHand` | nein | ja | Primitiv-Test a-13 |
| Kit, the Shark Researcher | Hero | Deck/Ablage | `noteHandZugangAusStapel` | nein | ja | gezielt a-20 |
| Kitsune Transformation | Spell | Deck/Ablage | `actionAddCardFromDeckToHand` | nein | ja | Primitiv-Test a-13 |
| Koperniko, the Stargazer | Hero | Deck | `actionAddCardFromDeckToHand` | nein | ja | Primitiv-Test a-13 |
| Krates, the Smartass | Hero | Deck | `noteHandZugangAusStapel` | nein | ja — Karte des Suchenden (eigenes Deck) ja; Kratesʼ Karte aus dem Gegner-Deck nein | gezielt a-20 |
| Liberation | Spell | Ablage | `addCardFromDiscardToHand` | nein | ja — Ablage ja, Gelöscht-Stapel nein | Sweep a-18 |
| Life-Searcher from the Cosmic Depths | Creature | Deck | `handZugang`, `takeFromPile(toHand)`, `meldeHandZugangAusStapel` | ja (Abwurf-Tutor) | ja | Primitiv-Test a-13 |
| Liquid Luck | Potion | Deck | `searchDeckForNamedCard` | nein | ja | Primitiv-Test a-13 |
| Lunatic Cycle - New Moon | Artifact/Equipment | Deck | `searchDeckForNamedCard`, `meldeHandZugangAusStapel` | ja (Abwurf-Tutor) | ja | Sweep a-18 |
| Madaga, the Forsaken Seafarer | Hero | Deck/Ablage | `actionAddCardFromDeckToHand` | nein | ja | Primitiv-Test a-13 |
| Magic Lamp | Potion | Deck | `noteHandZugangAusStapel` | nein | ja — die 2 eigenen Karten ja, die Gabe nein | gezielt a-20 |
| Magic Sapphire | Artifact | Ablage | `handZugang`, `takeFromPile(toHand)` | nein | ja | Sweep a-18 |
| Magnetic Glove | Artifact | Deck | `actionAddCardFromDeckToHand` | nein | ja | Sweep a-18 |
| Magnetic Potion | Potion | Deck | `actionAddCardFromDeckToHand` | nein | ja | Sweep a-18 |
| Maho, the Cute Magical Girl | Hero | Deck | `actionAddCardFromDeckToHand` | nein | ja | gezielt a-20 |
| Mass Multiplication | Spell | Deck | `noteHandZugangAusStapel` | nein | ja | Sweep a-18 |
| Meditation | Spell | Ablage | `addCardFromDiscardToHand` | nein | ja | Sweep a-18 |
| Metal Harpyformer | Creature | Deck | `searchDeckForNamedCard` | nein | ja | Sweep a-18 |
| Misfire | Spell/Reaction | Deck | `actionAddCardFromDeckToHand` | nein | ja | Primitiv-Test a-13 |
| Monsieur Pete, the Booty Raider | Hero | Deck | `actionAddCardFromDeckToHand` | nein | ja | Sweep a-18 |
| Motharch Squire | Creature | Deck | `actionAddCardFromDeckToHand` | nein | ja | Primitiv-Test a-13 |
| Navigation | Ability | Deck | `actionAddCardFromDeckToHand`, `meldeHandZugangAusStapel` | ja (Abwurf-Tutor) | ja | Sweep a-18 |
| Nerdy Cheese | Artifact | Deck | `handZugang`, `takeFromPile(toHand)` | nein | ja | Primitiv-Test a-13 |
| Perilous Journey | Spell | Deck | `searchDeckForNamedCard` | nein | ja | Sweep a-18 |
| Pillar of Light | Spell | Deck (des Suchenden) | `handZugang`, `takeFromPile(toHand)` | nein | ja | Primitiv-Test a-13 |
| Pinaxolotl | Creature | Deck | `actionAddCardFromDeckToHand` | nein | ja | Primitiv-Test a-13 |
| Rain Viola | Artifact/Equipment | Deck | `actionAddCardFromDeckToHand` | nein | ja | Primitiv-Test a-13 |
| Rap Harpyformer | Creature | Deck | `searchDeckForNamedCard` | nein | ja | Sweep a-18 |
| Rebelliokai Backup Bakus | Creature | Ablage | `addCardFromDiscardToHand` | nein | ja | Primitiv-Test a-13 |
| Rebelliokai Camouflaged Kappa | Creature | Deck/Ablage | `actionAddCardFromDeckToHand` | nein | ja | Primitiv-Test a-13 |
| Rebelliokai Kind Kitsune | Creature | Ablage | `addCardFromDiscardToHand` | nein | ja | Primitiv-Test a-13 |
| Red Dragoneer | Creature | Deck | `searchDeckForNamedCard` | nein | ja | Sweep a-18 |
| Relic in the Sky | Artifact | Ablage | `takeFromPile(toHand)` | nein | ja | Sweep a-18 |
| Riffel, Master of the Ultimate Gun | Ascended Hero | Deck/Ablage | `actionAddCardFromDeckToHand` | nein | ja | Primitiv-Test a-13 |
| Shanty Harpyformer | Creature | Deck | `searchDeckForNamedCard` | nein | ja | Sweep a-18 |
| Shard of Chaos | Artifact | Ablage | `addCardFromDiscardToHand` | nein | ja | Sweep a-18 |
| Shooting Star | Spell | Ablage | `handZugang`, `takeFromPile(toHand)` | nein | ja | Sweep a-18 |
| Sickly Cheese | Artifact | Deck | `actionAddCardFromDeckToHand` | nein | ja | Sweep a-18 |
| Ska Harpyformer | Creature | Deck | `actionAddCardFromDeckToHand`, `searchDeckForNamedCard` | nein | ja | Sweep a-18 |
| Slippery Narw | Creature | Deck/Ablage | `handZugang`, `takeFromPile(toHand)` | nein | ja | Sweep a-18 |
| Snake Race Boat | Artifact/Equipment | Deck | `actionAddCardFromDeckToHand` | nein | ja | Primitiv-Test a-13 |
| Soul Shard Ren | Creature | Deck | `actionAddCardFromDeckToHand` | nein | ja | Primitiv-Test a-13 |
| Sparkfly Architect | Creature | Deck | `searchDeckForNamedCard` | nein | ja | Sweep a-18 |
| Spatial Crevice | Spell/Area | Deck | `actionAddCardFromDeckToHand` | nein | ja | Sweep a-18 |
| Spider Dance | Spell | Deck | `actionAddCardFromDeckToHand` | nein | ja | Primitiv-Test a-13 |
| Spontaneous Reappearance | Spell | Ablage | `addCardFromDiscardToHand` | nein | ja | Sweep a-18 |
| Steam Dwarf Diver | Creature | Deck | `actionAddCardFromDeckToHand` | nein | ja | Primitiv-Test a-13 |
| Stormkissed Waflav | Ascended Hero | Deck | `_waflav-shared: takeFromPile(toHand)` | nein | ja | Primitiv-Test a-13 |
| Styx, the Opened Gate | Ascended Hero | Ablage | `addCardFromDiscardToHand` | nein | ja | Primitiv-Test a-13 |
| Tamed Hell Fox | Creature | Deck | `actionAddCardFromDeckToHand` | nein | ja | Primitiv-Test a-13 |
| Tanuki Escape | Spell | Deck/Ablage | `actionAddCardFromDeckToHand` | nein | ja | Primitiv-Test a-13 |
| Techno Harpyformer | Creature | Deck | `searchDeckForNamedCard` | nein | ja | Sweep a-18 |
| Tempeluna, the Convergence Fairy | Ascended Hero | Deck | `addFromPileToHand` | nein | ja | Primitiv-Test a-13 |
| The Hands of Big Gwen | Artifact/Equipment | Ablage | `handZugang`, `takeFromPile(toHand)` | nein | ja | Primitiv-Test a-13 |
| The Oracle of Heaven | Creature | Deck (oberste Karte) | `actionAddCardFromDeckToHand` | nein | ja | Primitiv-Test a-13 |
| Thebinxan War Counselor | Creature | Deck (oberste Karte) | `actionAddCardFromDeckToHand` | nein | ja | Sweep a-18 |
| Trial of Loyalty | Spell | Deck | `actionAddCardFromDeckToHand` | nein | ja | Sweep a-18 |
| Xiong, the Bamboo Guardian | Hero | Ablage | `addCardFromDiscardToHand` | nein | ja — eigene Ablage ja, Ablage des Gegners nein | Primitiv-Test a-13 |

Die sechs Abwurf-Tutoren (Cute Dog, Cute Annoyance Mini, Life-Searcher, Inventing, Lunatic Cycle - New Moon, Navigation) hatten das Fenster schon (explizit gemeldet), alle übrigen Zeilen nicht.

### B) Kein Fenster (dokumentierte Ausnahmen)
| Karte | Grund |
|---|---|
| Alchemic Journal | Potion Deck (Frage 1) |
| Boris, the Guardian of Blackport | Text: Abwurf, kein Zugang |
| Create Secret Room | Deck → Surprise Zone → Hand (Zwischenzone, Frage 3) |
| Divine Gift of Edge | Side Deck (Frage 1) |
| Enigma, the Seller of Secrets | Deck des Gegners (Frage 2) |
| Fairy Queen Crestina, the Creation Fairy | außerhalb des Spiels / Geschenk |
| Hipdall, Protector of Coolness | Quelle ist der Coolness Stack (`ohneZugangsFenster`) |
| Infiltration | Deck des Gegners (Frage 2) |
| Philosopher's Stone | Potion Deck (Frage 1) |
| Rha'Bi, the Living Skeleton | Karten liegen verdeckt auf dem Brett des Gegners, spätere Aufnahme vom Brett (Frage 3) |
| Sid, the King of Thieves | Deck des Gegners (Frage 2) |
| Sparkfly Queen | Deck des Gegners (Frage 2) |
| Spice Mortar | Deck des Gegners (Frage 2) |
| Teleportal | Zwischenzone („offen vor dir“), spätere Aufnahme zählt nicht (Frage 3) |
| The Second Circle of Hell | Gelöscht-Stapel (Frage 1) |
| Transmission | Karte geht in die Hand des GEGNERS aus der eigenen Ablage; der Gegner fügt nicht aus seinem Stapel hinzu |
| Natas, the Master of Hell | außerhalb des Spiels |
| Cooldin, King of Coolness | Deck → Hand → Brett in einem Zug, kein „add to hand“ (`ohneZugangsFenster`) |
| Hipdall, Protector of Coolness | Quelle ist der Coolness Stack (`ohneZugangsFenster`) |
| Smuggler's Pier | Ziehen |
| The Third Circle of Hell | Deckkarte wird sofort gespielt (Zwischenschritt) |
| Guardian's Appearance | Rückgabe bei Fehlschlag |

### C) Karten ohne Skript (nicht umgesetzt, nichts zu ändern)
At the Source of the Light, Bad Birthday Girl Cecilia, I Found You!, Klaus' Mom, Ritual Chamber, Skulltop Castle, The Light Brigade Marches, The Root of all Presents, Unlikely Encounter, Vampire on Fire.

### D) Textfunde ohne Zugang aus Deck oder Ablage auf die Hand (kein Auslöser)
Karte vom **Brett** zurück auf die Hand (Bounce, Wiederholer, „add … instead of discard"): Capture Net, Kidnapping, Mine! Mine! Mine!, Sparkfly Worker, Sculpture Theft, Gold Trap, Hunting, Sas'Za, Rocket Fist, The White Eye, Spirit of the Shattered Trident, Fun-Fun Circus Elephant/Director, Jenny, Infected Squirrel, Wendy, Moonlight Butterfly, Shapeshift, Divine Gift of the Deepsea, alle Deepsea-Kreaturen mit Bounce, Idej Sword - Onima (Ability vom Brett). Aus der **Hand des Gegners / Gabe an den Gegner**: Secret Entrance, Thieving Strike, Live Show, Loot the Leftovers, Gather Intel, Cool Presents, Letter of Misinformations, Saint Nicolas, Santa Klaus, Rain of Spores, Kazena. Nur **Hook-Zuhörer** (reagieren auf ein Hinzufügen, legen selbst nichts auf die Hand): Albrecht, Analyzer, Gatherer, Lilly, Mary Crestmas, Future Tech Gear, Bamboo Staff/Shield, Distracting Crystal, Siege, Cats of the Pharaoh, Boris; Reaktionen/Sonstiges: Cool Rescue, Reverse Trap, Local Idol, Surprising Opportunity, Chatty Town Guard, Creepy Villager, Treacherous/Weakening/Rusting/Mana-Absorbing Crystal, Ice Sculpture Garden, Key, Skeleton Demon, The Spawn Mother, Barkeeper (erzeugt Nachschub), Control Monitors selbst.

## Tests
`docs/niche-tests/repro/W72/` (Ausgangsstand rot, danach grün; `lib/monitors.js` und `lib/handzugang-sweep.js` sind die gemeinsamen Hilfen):
* `a-11` Magnetic Potion löst aus, beide Sitze, ohne Held kein Angebot.
* `a-12` Ablehnen == Abbruch der Preiswahl (identischer Endzustand), zu wenige Handkarten → kein Angebot, Preis = genau N Karten, zweite Kopie als Preis.
* `a-13` Kein „add": Ziehen, Potion-Deck-Ziehen, Bounce, Deck/Ablage des GEGNERS, Gelöscht-Stapel, Potion Deck; Kontrollen: eigenes Deck/eigene Ablage (alle Primitive, Eigenbau mit `toHand`), `returnToPile` → kein Zugang.
* `a-14` Ablage-Quelle (Shooting Star, Gate to the Armory), mehrere Karten eines Effekts = EIN Fenster (Elixir of Mana N=3, Divine Gift of Creation N=2).
* `a-15` Der Hinzufügende wählt „alle anderen löschen" (und „die hinzugefügten"), keine anderen Karten → keine Wahl, Löschen ist kein Abwurf.
* `a-16` Die sechs Abwurf-Tutoren: genau ein Hook, ein Angebot, kein Doppel-Fenster, beide Sitze.
* `a-17` CPU-Gehirn (beide Sitze), Puzzle-Gegner (Szenario Al), nie ohne Preis/ohne Held, CPU als Hinzufügende.
* `a-18` Zustands-Sweep über die Inventur (mit Selbsttest des Wächters, Ausnahmen Teleportal und Rha'Bi). `PP_W72_VOLL=1` fährt alle 859 Passiven mit (~5 Minuten).
* `a-19` Statischer Wächter für neue Tutor-Karten (Eigenbau ohne Meldung fällt auf; Ausnahmen mit Begründung).
* `a-20` Eigenbau-Tutoren gezielt (Mass Multiplication, Birthday Present, Magic Lamp, Kit, Krates, Maho, Crum, Cooldin, `ohneZugangsFenster`).
* **Angepasste Altprüfungen (W75 `b-01 … b-04`, `f-01`):** Sie hatten die alte Auslegung („der Hinzufügende zahlt", die Hand des Monitors-Besitzers enthielt nur Control Monitors) fest eingebaut. Jetzt hält der Monitors-Besitzer N Preis-Karten mehr auf der Hand (Fireball/Filler) und die Prüfungen zählen den Preis (Ablage + 1 bzw. + N; Ambush-Fall: 1 Preis + 2 durch Ambush = 3). Sonst unverändert.

## Offene Ja/Nein-Fragen an Al (aktuell jeweils die Annahme in Klammern)
1. **Potion Deck / Side Deck** zählen als „their deck"? (Nein – nur das Hauptdeck: Philosopher's Stone, Alchemic Journal, Divine Gift of Edge lösen nicht aus.)
2. **Karten aus dem Deck/der Ablage des GEGNERS** (Infiltration, Enigma, Spice Mortar, Sid, Sparkfly Queen, Xiong/Herbithorn aus der Gegner-Ablage) zählen als „their deck or discard pile"? (Nein – „their" = das eigene.)
3. **Zwischenzonen** – Teleportal („vor dir"), Create Secret Room (Surprise Zone), Rha'Bi (Brett des Gegners): zählt die spätere Aufnahme auf die Hand als „aus dem Deck"? (Nein.)
4. **Divine Gift of Time** („add those cards to your hand instead" statt Ablage) löst Control Monitors aus? (Ja – technisch aus der Ablage; Hipdall (Coolness Stack), Cooldin und The Third Circle of Hell (Deckkarte sofort gespielt) lösen NICHT aus.)
5. **Zeitpunkt:** Das Fenster öffnet am Ende der Wirkung (Karten, die im selben Effekt wieder von der Hand verschwinden – Rebelliokai Camouflaged Kappa, Deepsea Treasure-Artefakte –, werden nicht mehr angeboten). Soll es MITTEN in der Wirkung öffnen (direkt nach dem Hinzufügen)? (Nein, wie bei jeder Reaktion nach Auflösung; die Abwurf-Tutoren melden wie bisher sofort, weil Beschwörungs-Zusatz / Kostensenkung vom Ergebnis abhängen.)
(Eine „Pressure Potion" gibt es in `data/cards.json` nicht; gemeint war vermutlich „Pressure Projectile" – das legt nichts auf die Hand.)

## Bugfix-Notes
Siehe Commit-Nachricht: `Bugfix-Note: Control Monitors | …` und `_engine` (Fenster für alle Tutoren); Mass Multiplication, Birthday Present, Magic Lamp, Kit, Krates, Crum (Control Monitors kann jetzt reagieren). Die reinen Umstellungen auf die neue Schnittstelle (Cute Dog, Cute Annoyance Mini, Life-Searcher, Inventing, Lunatic Cycle - New Moon, Navigation) und die Flags `ohneZugangsFenster` (Cooldin, Hipdall) ändern kein Spielverhalten: `Bugfix-Skip`.
