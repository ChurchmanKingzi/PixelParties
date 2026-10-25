# Equip-Audit Darion — Partition P4b (Kreaturen, zweite Hälfte)

44 Skripte vollständig gelesen. Klassen: A Auswahl/Entfernen/Zerstören, B Zählen/Bedingungen, C Anlegen per Effekt, D ganze Zonen verschieben, E Equip-Skript/Hooks selbst.
Tests: `docs/niche-tests/repro/W75/h-P4b-NN-*.js` (neu), dazu die bestehenden `g-04` (Afflicted Pests) und `a-03`.
Annahme (laut Auftrag): jede Karte des Stapels ist eine eigene Karte, nur die Zone ist geteilt.

| Datei | Klassen | Befund | Test |
|---|---|---|---|
| afflicted-pests.js | A, C | ok — Ziele je Platz, Engine-Rückfrage setzt `cardInstance`/`cardName` auf die gewählte Karte (Entfernen per Instanz); legt der Gegner in einen Darion-Stapel an, löst sie aus | g-04 |
| analyzer-from-the-cosmic-depths.js | A | behoben: „Move Change Counters to another card" — die Counter landeten immer auf der ersten Karte des Stapels (Ziel per ID in der eigenen Liste wiedergefunden); jetzt die gewählte Karte vom Eintrag der Prompt-Liste | h-P4b-01 |
| baby-spider.js | irrelevant | wählt nur verdeckte Surprises in Surprise Zones, nie Support-Karten | — |
| burning-skeleton.js | A (Gegenprobe) | irrelevant — Zielwahl nur Held/Kreatur, Stapel wird nie angeboten | h-P4b-09 |
| candlestick-squire.js | irrelevant | Burned-Ziele (Held/Kreatur), freie Zonen für die eigene Beschwörung; Stapelplatz zählt korrekt als belegt | — |
| cardinal-beast-qinglong.js | irrelevant | Ziele per `hasCardType(Creature)` gefiltert | — |
| cheeky-monkee.js | irrelevant | Ziele nur Helden und `isChoosableAsCreature` (ein Equip ist keine Kreatur) | h-P4b-09 (`getCreatureTargets`) |
| cold-hearted-yuki-onna.js | A | behoben: (1) die Rückfrage „welches Equip?" bot ALLE Karten des Stapels an (ein Club of Gobbo konnte als „Heart of Ice" abgeworfen werden), (2) von mehreren gewählten Hearts im selben Stapel zählte/ging nur die erste (Stufe 2+/4+ blieben aus). Jetzt `_erlaubteInstanzen` = nur Hearts, `maxTotal` = Zahl der Hearts, Auswertung über `engine.gewaehlteInstanzen` | h-P4b-02 |
| criminal-monkee.js | C | behoben: der Equip-Effekt („Non-Fungible Monkee aus dem Deck ausrüsten") verlangte eine FREIE Zone (`freeSlotOn`) — bei Darion mit Stapel und ohne freie Zone nicht aktivierbar. Jetzt Platz = Stapelplatz (`equipPflichtPlatz`), sonst erste freie Zone | h-P4b-04 |
| cybug-rhinoceros.js | A, C | ok — reagiert auf die Instanz, die gerade angelegt wurde (`sourceInfo.cardInstance`), nicht auf „das Equip im Platz"; Stapelnachbarn bleiben | h-P4b-07 |
| dark-deepsea-god.js | irrelevant | Tribute sind Kreaturen; ein Stapelplatz ist nie Tribut/Landeplatz | — |
| dive-bomblebee.js | A | ok — Zielliste je Instanz, die Engine-Rückfrage schreibt die Wahl auf den gefundenen Eintrag; die gewählte (auch gleichnamige) Karte kommt unter das Gegner-Deck | h-P4b-07 |
| empty-armor.js | irrelevant | Umleitung nur für Kreaturen am eigenen Platz | — |
| fiery-slime.js | A (Gegenprobe) | irrelevant — `promptMultiTarget` Held/Kreatur, Stapel nie angeboten | h-P4b-09 |
| gatherer-from-the-cosmic-depths.js | A | behoben: „Move Change Counters from a card you control" — Quelle wurde per ID wiedergefunden, es zählte immer die erste Karte des Stapels (falsche Counter-Zahl/falsche Karte); die Rückfrage bot außerdem Karten ohne Counter an. Jetzt `_erlaubteInstanzen` = Karten mit Counter, gewählte Karte vom Prompt-Eintrag | h-P4b-01 |
| gorinthian-war-counselor.js | irrelevant | `promptDamageTarget` (Held/Kreatur) | h-P4b-09 (gleicher Picker) |
| guardian-beast-shu.js | irrelevant | Ziele nur `isChoosableAsCreature` | — |
| hardy-slime.js | irrelevant | Taunt auf Kreatur-Ziele; Stapel nie betroffen | h-P4b-09 |
| hipdall-protector-of-coolness.js | irrelevant (C für Kreaturen) | Beschwörung vom Coolness Stack in freie Zone via `beschwoerZonenFuer`; der Stapelplatz ist belegt — korrekt. Hook betrifft nur Karten, die den Coolness Stack verlassen | — |
| infected-squirrel.js | irrelevant | reine Flags | — |
| invader-token.js | B | ok — „kontrolliert Karten mit Change Counters" zählt Instanzen (`changeCounterCardsOnSide`), nicht Zonen; Schadensziele nur Held/Kreatur | h-P4b-01 (Counter auf Stapel-Equip) |
| lovely-teddy.js | irrelevant | `getCreatureTargets` kennt nur Kreaturen | h-P4b-09 |
| loyal-pinpom.js | irrelevant | Zielzonen für Kreaturen (`beschwoerZonenFuer`) | — |
| lunatic-hawk.js | B, E | ok — „verschiedene Lunatic Cycle auf dem Brett" zählt Instanzen (`countDistinctLunaticCycle`), „equip → Kontrolleur zieht" feuert je angelegter Karte (`onEquipGained`) | h-P4b-08 |
| mischief-militia-heli-troopers.js | A | offen (nicht Darion-spezifisch): die Kandidatenliste des Todes-Triggers enthält ALLE Support-Karten (auch Ausrüstungen), `canTargetForStatus` lässt sie zu → ein Equip bekommt `frozen`. Mit Darion steht die Stapel-ID dreifach in der Liste. Vorschlag: Kandidaten auf Kreaturen beschränken (`isChoosableAsCreature`). Nicht geändert (Bugfix-Regel: wäre kein reines Darion-Anpassen) | h-P4b-09 (Notiz) |
| mr-jiggles.js | irrelevant | `promptMultiTarget` Held/Kreatur | h-P4b-09 |
| phatnir-prototype-of-coolness.js | irrelevant | `promptDamageTarget` Held/Kreatur | h-P4b-09 |
| rocky-slime.js | irrelevant | Ziele nur Kreaturen (Hand/Brett) | h-P4b-09 |
| sarcophagus-of-sealed-magic.js | irrelevant | zählt Zauberschul-Abilities in Ability-Zonen; Ziele Held/Kreatur | h-P4b-09 |
| skeleton-bard.js | irrelevant | nur eigene Skeleton-Kreaturen | — |
| skeleton-healer.js | irrelevant | Ziele Held/Kreatur (`promptDamageTarget`); Heilen über Koordinaten nur bei Kreaturenziel | h-P4b-09 |
| slimy-slime.js | irrelevant | `promptMultiTarget` Held/Kreatur | h-P4b-09 |
| slippery-pengu.js | irrelevant (D nur für Kreaturen) | verschiebt nur Kreaturen in freie/geteilte Kreaturen-Zonen; Stapelplatz wird nie angeboten | — |
| smug-mastermind-antonia.js | A | ok — „any non-Hero card" je Instanz mit `_cardInstance`; die Engine-Rückfrage schreibt auf den gefundenen Eintrag, die gewählte (gleichnamige) Karte wird zerstört | h-P4b-07 |
| sparkfly-worker.js | A | ok — gleiche Bauart wie Antonia (`_sparkfly-shared.collectNonHeroBoardTargets`), `stealBoardCardToHand` nimmt nur den Namen der gewählten Karte | h-P4b-07 |
| spirit-of-the-barbarian-sword.js | B | ok — Träger-Prüfung über Instanzen am Helden (Schwert mitten im Stapel) | h-P4b-06 |
| spirit-of-the-heart-bow.js | B | ok — Träger über Instanzen; freie Zone des Wirts korrekt ohne Stapelplatz | h-P4b-06 |
| spirit-of-the-shattered-trident.js | A, B, E | behoben: Löschkosten wählten per Namensgalerie — bei gleichnamigen Karten im Stapel immer die erste Kopie. Jetzt `instancePick` (je Karte), wenn Kandidaten einen Platz teilen. Rückholung (`onCardLeaveZone`, Gold = halbe Kosten) wirkt je abgehender Karte, auch beim Heldentod mit drei Rückfragen | h-P4b-06 |
| spirit-of-the-ultimate-gun.js | B | ok — Träger-Prüfung über `hasEquipped` (Instanzen) | h-P4b-06 |
| swagdri-forger-of-coolness.js | C | behoben (klein): Darion-Pflichtplatz war schon eingebaut (Aktivierbarkeit und Zielliste); die Platzwahl löste aber die sinnlose Rückfrage „welches Equip meinst du?" aus (`_disambiguateStackedTargets` behandelt den Stapelplatz als Kartenziel). Jetzt `_eigeneStapelWahl`. Auch der Nicht-Equip-Zweig (Swagdri + The Yeeting auf mittleres Equip) geprüft | h-P4b-03 |
| the-spawn-mother.js | irrelevant | AoE nur Helden/Kreaturen (`hasCardType(Creature)`) | — |
| thrysh-robber-of-coolness.js | C | behoben: Thrysh bot nur FREIE Zonen an — Darion mit Stapel und ohne freie Zone: nicht aktivierbar; mit freier Zone wurde eine „freie" Zone angeklickt, obwohl das Equip in den Stapel gehört. Jetzt Zielliste je Kandidat (`equipPflichtPlatz`), Stapelplatz ohne Kartenrückfrage | h-P4b-03 |
| waitress.js | irrelevant | bereinigt nur Status von Helden/Kreaturen | — |
| weapon-collecting-wight.js | C | ok bis auf die Rückfrage: Pflichtplatz funktionierte (über `_equip-shared`), die Platzwahl stellte aber die sinnlose Kartenrückfrage → in `_equip-shared.waehleAusruestPlatz` behoben (`_eigeneStapelWahl` am Stapelplatz; wirkt auch für Cool Repair/Looting/Riffel/Backpack, soweit sie diesen Baustein nutzen) | h-P4b-05 |
