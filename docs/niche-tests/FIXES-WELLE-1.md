# Fix-Welle 1 – „sichere Fehler"

Auftrag von Al: die sicheren Fehler beheben, den Rest später gemeinsam durchgehen. **Sicher** hieß: Stufe A, von einem unabhängigen Prüfer bestätigt, Kartentext/Regel eindeutig, Fix lokal oder klein. Dafür liefen 10 Fix-Agenten parallel in getrennten Arbeitskopien; ihre Zweige sind ohne Konflikte zusammengeführt.

## Ergebnis

- **110 von 121** geplanten Befunden behoben (jedes zugehörige Repro in `repro/` liefert jetzt Exit 0 statt Exit 1). Der Index [INDEX.md](INDEX.md) zeigt je Repro `✔ behoben` / `✗ offen`.
- **Regressionsschutz:** alle 44 `scripts/check-*.js` laufen wie vorher (nur `check-scope.js` war schon vorher rot); alle 691 Repros wurden auf dem zusammengeführten Stand erneut ausgeführt (578 weiter rot, 113 grün, keine Abstürze, keine Zeitüberschreitung); jeder Agent hat seine Änderungen zusätzlich per Dauerfeuer (`lib/barrage.js`) gegen den Vorher-Stand verglichen: keine neuen Fehler, Hänger oder Kartenbilanz-Abweichungen.
- Eine Baseline wurde angepasst: `scripts/aoe-window-baseline.json` (neuer Eintrag für Deep-Drowned Waflav, A08-15, wie bei Kirin Firebreath).
- Zwei Repros waren selbst falsch und wurden korrigiert: `A02-deepsea/01-siren-link-slot.js` (veraltete Variablen nach Zugwechsel), `S03-spells/22-phoenix-bombardment-…js` (`!!0` wertete Sitz 0 als „nicht gesetzt"), `H02-heroes/04-ida-…js` (Zielwahl warf nach dem Fix).
- **Zurückgenommen:** die Ghuanjun-Änderung (H02-16). Der Sollwert ist offen (Grund-ATK-Formel 160/130 oder pauschal 80); sie war versehentlich in die Liste geraten und wurde als eigener Revert-Commit entfernt.

## Was behoben wurde (nach Gruppe)

| Gruppe | Befunde |
|---|---|
| A01/C02/C04 | Spontaneous Reappearance beendet den Zug · Rain of Death Token-Überschuss · Pyroblast zweite Karte · Doom Clock Mehrfachtod · Doom Prophecy Gegnerzone · Reality Crack Area doppelt · Null Zone Dauer (+3) · Fifth Circle Mehrziel · Exploding Skull Sperre · Sleeping Beauty aktivierbar |
| A02/A03 | Siren-Verknüpfung · zweiter Invader · geliehener Life-Searcher · Slippery Skates · Shapeshift/Castle · Cosmic Malfunction · Aquatic Spear · Monstrosity · Copy Device ATK · Steam Dwarf Engineer · Laser Cannon + Fridge |
| A04/A05 | Wowhalla (2×) · Swagdri · Cute Hydra · Wildur (Guard Duty, Phoenix) · Hipdall · Modnir · Non-Fungible Monkee · Bunny/Dog/Familiar/Mini als Zusatzaktion · „You can only control 1" (teilweise) · Dive Bomblebee · Sparkfly Attendant (Teil a) |
| A06/A07 | Windstorm vs. Area-Schutz · Ablagekosten unter Knight of Kings [B] · Cykyran/Censpartan Abgang · SnowItAll Eignung · Post-Target-Fenster (5 Karten) · Vullary/Stellin Beschwörung · Dream Lander (7 Karten) · Shu · King Trex · Mao |
| A08/A09 | Weakening Crystal · Cool Presents/Beer (Rusting Crystal) · Distracting Crystal vs. Horn in a Bottle · Afflicted Pests · Waflav-Überladung · Ushabti · Trial of Coolness · Pfeile nach Abbruch · Bonded Companion · Tamed Primordium/Elven Rider · Hydra Blood Arrow |
| C03/C05/F | Gravedigger · Monster Nest · Golden Exploding Skull · Grave Worm · Wire Hatchling · Waitress/Stowaway · Birthday Present · Bamboo Shield · Flying Island · Weird Doll · Snow Cannon · Slippery Fridge · Warhorse/Master's Sword/Vampiric Sword |
| H01–H04 | Shapeshifter/Throne Robber (Abfallen, Fremdkontrolle) · Brackle · Chaos-Diamond (22 Karten) · Gon · Ida (Hole in the Sky, Flächenzauber) · Null (Kreatur) · Sol Rym · Toras/Taio |
| M01/M02/R01 | Elixir of Immortality (2×) · Cloud in a Bottle · Biomancy+Boulder · Tokens in der Ablage · Charme Lv2 · Muscle Training · Luck · Magic Lamp · Singing · Gold Trap |
| R02 | Overheal Shock · Unwanted Audience vs. Light Ball · Mountain Tear River (Abbruch) · No Retreat! (Brainstorming, Staff of the Teleporter) · Rioting Village (2×) · Very Special Prisoner · Zombified Assault · Spike Trap |
| S01–S03 | Dance of the Flame Pillars · Calm Diatribe · Call for Help/Aurora Borealis · Healing Melody · Forbidden Zone · Petrifier · Overcharge · Surprise Party · Phoenix Tackle (= B-08) · Phoenix Bombardment · Weapon Unleashing |

## Noch offen aus der Liste (11)

| Befund | Grund |
|---|---|
| A03-02 Escape Device (+ Weathercock, Castling, Rook of Kings [B], Glass Wall, Test Flight, Barrier of Faith) | **zentral:** `gs._effectImmunities` wird nur beim nächsten Zielfenster/`startTurn` geleert (`_engine.js` ~8023, ~35801, ~22615) |
| A06-05 Zielschutz bei `promptEffectTarget` | **zentral:** `_engine.js` ~27934 muss `untargetable_by_opponent` und `guardsCreatureChoice` auswerten (in `promptDamageTarget`/`promptMultiTarget` schon da) |
| C05-02 Stowaway-Negierung endet zum Zugende | **zentral:** `processStatusExpiry('END')` (~45106) braucht eine Ausnahme für Anhängsel-Status |
| H03-15 Null – Sparky Slime (Teil d) | **zentral:** `negatedDuration` hat keinen Leser; Null selbst ist behoben |
| R02-01 Mountain Tear River bei gewählter Kreatur | **zentral:** `_checkSurpriseWindow` (~34974) verlangt `type === 'creature'`, die Zielwahl liefert `'equip'` |
| R02-02 Umleiter sehen Mehrfachziel-Wahlen nicht | **zentral:** `promptMultiTarget` (~5799) reicht `_redirectSource` nicht durch |
| R02-07 Teil A (Loot the Leftovers) | **zentral:** `actionStealFromHand` (~24839) nimmt die aufgelöste Karte mit |
| S03-04 Missing People / gestohlene Kreatur | Geisterkarte behoben; Rest = Frage S03-06 (siehe unten) |
| A04-10 „You can only control 1" (Army of the Cute, Glorious Rebirth, Molinda) | Regelfrage |
| A05-11 Sparkfly Attendant Teil (b) „Negation" | B-Lesart, bewusst nicht angefasst |
| H02-16 Ghuanjun | Sollwert offen, Änderung zurückgenommen |

Weitere **zentrale** Lücken, die die Agenten nebenbei gefunden haben (nicht in der Liste, daher offen): `normalizeValidTargets` (`server.js`) filtert `untargetable_all` nicht für andere Ziel-Artefakte/-Tränke (F03-04); der Riegel „nur mit `config.sourceCard`" in `promptEffectTarget` (~28286) lässt ~190 Skripte ohne Post-Target-Fenster (A06-33, lokal nur für 5 Karten gelöst); `_cpu.js` prüft an mehreren Stellen noch den alten Held-HOPT-Schlüssel (C04-01-Umfeld); `slippery-pengu.js` (A02-28) und `slippery-ice.js` (A02-07) rechnen noch nach Kontrolle statt Brettseite.

## Fragen, die beim Beheben aufgekommen sind (ja/nein)

1. **M01-08:** Tokens, die per Zerstören sterben, gehen jetzt immer in den Gelöscht-Stapel (auch Mummy/Invader Token) – so gewollt?
2. **M02-24:** Sollen Pure Advantage Camel, Cactus Creature, Afflicted Pests/Vermin, Mummy Maker Machine, Noble Mummy Guards zusätzlich als Singing-Ziel ausgeschlossen werden?
3. **F01-02:** Bei per Ambush the Scout negierter Gabe: nur die Gabe-Karte aufs Deck, die eigenen 2 Karten auf die Hand (so umgesetzt) – oder alle 3 aufs Deck? Magic Lamp (M02-18) ist im selben Sinn behoben.
4. **A04-10:** Dürfen „platzierende" Karten (Army of the Cute, Glorious Rebirth, Molinda) „You can only control 1" umgehen? (Bird: bereits „nein" angenommen.)
5. **A05-03:** Soll eine gestohlene Kreatur auf meiner Seite für Dive Bomblebee Ziel sein, und gehört die Karte ins Deck des Besitzers statt des Kontrolleurs?
6. **A09-20:** Passt das neue Flag `summonOnlyViaOwnEffect` (sperrt alle Beschwörungen über `summonFromPile` für Elven Rider) zum Ruling „nur mit eigenem Effekt"?
7. **A07-05:** Landet der angelegte Held beim Zurückmischen der Dream-Lander-Kreatur (Mass Routing) in der Ablage (so umgesetzt)?
8. **A02-04 / A03-27:** Soll ein geliehener Life-Searcher stattdessen ins Besitzerdeck mischbar sein? Darf Slippery Fridge `leavingCard` an alle Ausrüstungen weitergeben?
9. **S03-06:** Soll Missing People eine vom Wirker selbst gestohlene Kreatur wirklich nicht anbieten?
10. **S01-11:** Zusätzlicher zentraler Einmal-pro-Spiel-Schutz in `_castSpellImmediately` (Difficulty Lever, Hell Circles, Friedhelm)?
11. **H02-05 (Ida):** Einzelziel vor der Verschonen-Runde festlegen (so umgesetzt), Armageddon darf den Wirker treffen (so umgesetzt) – und Sun Beam/Trial of Dominance ebenfalls deckeln?
12. **R02-10:** Soll No Retreat! auch Brett→Deck-Mischer (Mass Routing) erkennen (bräuchte neue Flagge)? **R02-05:** Soll Unwanted Audience auch durch Monia-Schutz/`cc_immune` blockiert werden?
13. **A08-31:** Sollen verschenkte Cool-Presents-Karten bei Such-Sperre der Gegnerhand nichts kosten?

## Vorschlag für Welle 2

1. Die 7 **zentralen** Ursachen oben als eigene, sorgfältig getestete Engine-Änderungen (jeweils einzeln, weil sie viele Karten berühren).
2. Danach die B-Befunde (409), geordnet nach Ursachenklasse (siehe [ZUSAMMENFASSUNG.md](ZUSAMMENFASSUNG.md)): zuerst Besitzer/Brettseite/Kontrolleur, dann Sperren, dann Negations-Dauer.
3. Deine Antworten auf [FRAGEN-AN-AL.md](FRAGEN-AN-AL.md) und die Fragen oben lösen die C-Befunde und die Teilfixes auf.
