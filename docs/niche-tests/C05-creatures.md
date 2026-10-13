# C05-creatures – Nischenfall-Bericht
Stand/Autor: Agent C05-creatures, 13.10.2026. Karten: 21 in der Liste · 20 gezielt getestet (L2), 1 nur gelesen (The Thing in the Ship, = B-01) · 4 Karten als Verursacher von Befunden (Wire Hatchling, Stowaway, Water Golem, The Spawn Mother), 2 weitere als Auslöser beteiligt (Waitress, The Creepy Clown of Heaven).

## Zusammenfassung
11 Befunde mit ausgeführtem Repro (`docs/niche-tests/repro/C05-creatures/01…11`): **3 × A, 5 × B, 3 × C**.

| ID | Titel | Stufe |
|---|---|---|
| C05-01 | Wire Hatchling: gegen eine **unversehrte** Kreatur kein Schaden (Rückfall `currentHp ?? 0`; Hinweis: gleiches Muster in 5+ weiteren Skripten) | **A** |
| C05-02 | Stowaway: Negierung des Wirts **und** die Karte selbst enden mit dem ersten Zugende (Zugende-Räumung nimmt jede nicht-`sourceBound` `negated`); gleiche Ursache lässt **Decisive Defeat** am Zugende in die Ablage gehen | **A** |
| C05-03 | The Creepy Clown negiert den „unaffected by all other cards and effects"-Stowaway (Leiche bleibt nach Wirt-Tod liegen) | B |
| C05-04 | Waitress (Alt-Weg „alle Status heilen") auf Stowaway-Wirt: Stowaway **doppelt** im Gelöscht-Stapel (zwei Aufräumer, Kartenduplikat) | **A** |
| C05-05 | Water Golem nimmt beim Abgang eine **fremde** Negierung des Ziels mit (Stowaway wird gelöscht) | B |
| C05-06 | The Spawn Mother: Einsatz-Schaden feuert auch beim Platzieren aus der Ablage („summoned **from your hand**") | B |
| C05-07 | The Spawn Mother (gestohlen): „add … to **your** hand" schenkt die Karte der Hand des Besitzers | B |
| C05-08 | The Spawn Mother „alles": bei Gleichstand gewinnt immer Sitz 1 (Wirker-Sitz entscheidet über Sieg/Niederlage) | C |
| C05-09 | Wire Hatchling: Abbruch der Einsatz-Zielwahl lässt die Kreatur auf dem Brett (Aktion verbraucht) – Regel 23.9 wörtlich anders | C |
| C05-10 | Stowaway negiert nur den Heldeneffekt (leichte `_fromAttachment`-Form), nicht die Abilities – Text sagt „effect and Abilities" | B |
| C05-11 | Water Golem hält die Negierung auch gefroren/betäubt/negiert (Klasse B-01) | C |

Gesamteindruck: Der Großteil der Karten (Spirit of the Ultimate Gun, Root, Undurdle, Egg, Wavilion, Vinepire, Orchestra, Wight, Oracle, Tobi, Traveler, Golden Abomination, Super Fan, Suspicious Monster, Clown) hält die gezielten Nischenfälle sauber. Die Befunde konzentrieren sich auf zwei Stellen: den **Anhängsel-Negierungs-Helfer** (`_attachment-shared.js` / Zugende-Räumung `_engine.js:45106`: C05-02/-04/-05/-10, trifft auch Decisive Defeat) und **Herkunfts-/Besitzerfragen** bei der Spawn Mother. Bewusst NICHT getestet: Skill-Test-Modus (Golden Abomination „wähle einen Gegner"), 3-/4-Spieler-Varianten, Karten-Reveal/Animationen (Protokoll-Verträge, Familie 11), Stowaway-Frostverhalten (immun), Weather Orchestra mit 0-Kosten-Artefakten (Secret Lab Entrance), Pile-Locks (Oracle/Root unter Such-/Deck-Sperren), alle `cpuResponse`-Zweige, Cure/Beer/Tea-Wege für C05-04 (nur Waitress gemessen).

## Befunde
### C05-01 · Wire Hatchling richtet gegen eine UNVERSEHRTE Kreatur keinen Schaden an · Stufe A
- **Karten:** Wire Hatchling (`cards/effects/wire-hatchling.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Sitz 1 beschwört per echtem Spielweg „ZZ Dummy" (200 HP, `counters = {}`, also noch kein `currentHp`-Zähler). Sitz 0 spielt „Wire Hatchling" (Zielwahl per `targetFn` auf den Dummy).
- **Schritte:** 1. Gegner-Kreatur beschwören (unversehrt). 2. Hatchling beschwören, die unversehrte Kreatur wählen.
- **Erwartet** (Kartentext „When you summon this Creature, choose any target on the board and deal damage to it equal to half its current HP (rounded up)."): Eine Kreatur mit 200 HP hat aktuell 200 HP ⇒ 100 Schaden ⇒ 100 HP übrig.
- **Beobachtet:** Es passiert nichts (200 HP bleiben, kein Engine-Fehler, die Aktion ist verbraucht). Gegenprobe: gegen einen Helden und gegen eine bereits beschädigte Kreatur (`currentHp` gesetzt) rechnet die Karte richtig (801 → 400, 33 → 16). Auch das Selbstziel (der frisch beschworene Hatchling selbst, 50 HP) bleibt unversehrt. Mit echten Kreaturen identisch (Mr. Jiggles 90 HP, Populated Island Turtle 400 HP, Ifrit 80 HP: Schaden 0). Ein Ziel, das noch nie Schaden genommen hat, ist also **immun gegen die Karte** – das ist der Normalfall für die erste Anwendung der Karte.
- **Repro:** `docs/niche-tests/repro/C05-creatures/01-wire-hatchling-unversehrte-kreatur.js` (`node docs/niche-tests/repro/C05-creatures/01-wire-hatchling-unversehrte-kreatur.js`; ✗ = Fehler tritt auf)
- **Vermutete Ursache:** `cards/effects/wire-hatchling.js:74-75` `const hp = inst?.counters?.currentHp ?? 0; if (!inst || hp <= 0) return;` – Rückfall auf 0 statt auf die gedruckten HP. Die Engine legt `counters.currentHp` erst beim ersten Schaden an (`_engine.js:46382`); an anderer Stelle liest sie richtig `inst.counters.currentHp ?? (cd.hp || 0)` (`_engine.js:45522`, `:10142`).
- **Hinweis (nicht geprüft, anderes Gruppenfeld):** dasselbe Rückfallmuster `counters.currentHp ?? 0` steht auch in `aquatic-arrows.js:115`, `deepsea-siren.js:199`, `forbidden-zone.js:127`, `phoenix-bombardment.js:104`, `tharxian-horse.js:224` u. a. – dort evtl. ebenfalls mit „unversehrte Kreatur = 0 HP" falsch gerechnet; von den jeweiligen Gruppen zu prüfen.

### C05-02 · Stowaway: Negierung des Wirts und die Karte selbst enden mit dem ersten Zugende · Stufe A
- **Karten:** Stowaway (`cards/effects/stowaway.js`); mitbetroffen (nicht meine Gruppe, mitgemessen): Decisive Defeat (gleicher Helfer `anhaengselStatusHooks`).
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, Standardbrett. Variante A: Sitz 0 beschwört Stowaway in Held 0 (eigener Wirt). Variante B: Stowaway per Ziel-Hint in die freie Zone von Held 1 des Gegners. Variante C: Decisive Defeat auf eigenen Helden.
- **Schritte:** 1. Karte spielen, Wirt ist negiert. 2. `t.endTurn()` (echter Zugwechsel; bei B zweimal, bis der Gegner seinen Zug beendet hat).
- **Erwartet** (Kartentext „The corresponding Hero's effect and Abilities are negated. This counts as a negative status effect. … if the status effect it inflicted is removed from the corresponding Hero, it is deleted."; Ruling CARD_API.md Z. 14245 für den gleichen Helfer: „Lasts as long as Decisive Defeat remains attached to this Hero."; Z. 12587: Anhängsel-Status sind „zugefügt … eigene Dauer; Anhängsel folgen ihrem Status", laufen also nicht wie Frost/Betäubung zum Zugende ab): Wirt bleibt negiert, der Stowaway bleibt auf dem Brett, bis der Status geheilt wird oder der Wirt stirbt.
- **Beobachtet:** Am Ende des Zuges, dessen Spieler den Wirt kontrolliert, wird `negated` entfernt, der Wirt bekommt zusätzlich `immune`, und der Stowaway wird gelöscht (Gelöscht-Stapel). Auf einem Gegnerheld (B) passiert dasselbe am Ende des GEGNER-Zuges, d. h. die Karte „hält" genau einen Zugwechsel. Variante C: Decisive Defeat geht am Zugende in die Ablage, der Held ist wieder frei und bekommt `immune`. Keine Engine-Fehler.
- **Repro:** `docs/niche-tests/repro/C05-creatures/02-stowaway-zugende-negierung.js` (`node docs/niche-tests/repro/C05-creatures/02-stowaway-zugende-negierung.js`; ✗ = Fehler tritt auf)
- **Vermutete Ursache:** `cards/effects/_engine.js:45106` (`processStatusExpiry('END')`): `if (hero.statuses.negated && !hero.statuses.negated.sourceBound) await this.removeHeroStatus(ap, hi, 'negated')` – die Zugende-Räumung nimmt jede `negated`, die nicht `sourceBound` ist. `setzeAnhaengselStatus` (`cards/effects/_attachment-shared.js:349`) setzt nur `permanent: true` und `_fromAttachment`, nicht `sourceBound`; `permanent` liest diese Schleife nicht. Die Entfernung löst dann `onStatusRemoved` mit `heilenWirftAb` aus (`_attachment-shared.js:~410`) und wirft die Karte ab / löscht den Stowaway.

### C05-03 · The Creepy Clown of Heaven negiert den „unaffected by all other cards and effects"-Stowaway · Stufe B
- **Karten:** Stowaway, The Creepy Clown of Heaven (`cards/effects/the-creepy-clown-of-heaven.js`, Aura in `_engine.js:18781-18826`)
- **Voraussetzungen / Aufbau:** Sitz 0: Stowaway in Held 0; Sitz 1: Clown im Support von Held 2. Zug 5.
- **Schritte:** 1. Stowaway beschwören (Wirt negiert). 2. Clown auf das Brett legen. 3. Wirt töten (`actionDealDamage` 99999).
- **Erwartet** (Stowaway: „This Creature is unaffected by all other cards and effects, but if the status effect it inflicted is removed from the corresponding Hero, it is deleted."; Clown: „negate the effects of all other Creatures on the board"): der spezielle Text gewinnt, der Stowaway wird nicht negiert; stirbt der Wirt (Status weg), wird er gelöscht.
- **Beobachtet:** `isCreatureEffectSuppressed(stowaway)` = `true` (obwohl `counters._cardinalImmune` gesetzt ist); `onHeroKO` des Stowaway läuft nicht – er bleibt als Leiche in der Zone des toten Wirts liegen (Wirt ohne Status). Gleiche Folge für jede andere „unaffected"-Kreatur (z. B. Cardinal Beasts, nicht gemessen), sofern sie auf Hook-Reaktionen angewiesen ist.
- **Repro:** `docs/niche-tests/repro/C05-creatures/03-stowaway-clown-aura.js` (`node docs/niche-tests/repro/C05-creatures/03-stowaway-clown-aura.js`; ✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_engine.js:~18797` `creatureAuraInfo` bzw. `:~18826` `isCreatureEffectSuppressed` kennen `_cardinalImmune` nicht (nur den Negations-Wächter `_creatureNegationProof`).

### C05-04 · Waitress heilt den Stowaway-Wirt: der Stowaway wird doppelt in den Gelöscht-Stapel gelegt (Kartenduplikat) · Stufe A
- **Karten:** Waitress (`cards/effects/waitress.js:296`, Zusatzaktions-Weg), Stowaway (`stowaway.js`, `deleteOnCleanse`); der Pfad liegt in `cleanseHeroStatuses`, trifft also vermutlich jeden „heile ALLE heilbaren Status"-Effekt (Cure u. ä. nicht gemessen).
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Sitz 0: Stowaway in Held 1 (Held 1 negiert), „Waitress" auf der Hand.
- **Schritte:** 1. Waitress beschwören (Held 0, Zone 0), die Reinigung (Alt-Weg „Zusatzaktion") auf Held 1 wählen. 2. 50 ms warten (die Aufräumer laufen als Mikrotask).
- **Erwartet** (Waitress: „heal a Hero you control from all status effects"; Stowaway: „if the status effect it inflicted is removed … it is deleted"; Stowaway zählt als negativer Status): Stowaway wird genau einmal gelöscht.
- **Beobachtet:** Der Gelöscht-Stapel von Sitz 0 enthält `["Stowaway","Stowaway"]` (zwei Einträge für eine Karte), `t.censusDiff` meldet „Stowaway: +1". Gegenprobe: `removeHeroStatus(0,1,'negated')` allein löscht genau einmal. Mit Decisive Defeat (gleicher Helfer, Ablage statt Löschen) tritt es nicht auf (`sendBoardCardToDiscard` fängt die zweite Ausführung ab). `t.audit()` bleibt leer; keine Engine-Fehler.
- **Repro:** `docs/niche-tests/repro/C05-creatures/04-stowaway-heilen-doppelt-geloescht.js` (`node docs/niche-tests/repro/C05-creatures/04-stowaway-heilen-doppelt-geloescht.js`; ✗ = Fehler tritt auf)
- **Vermutete Ursache:** Bei „alle heilbaren Status gewählt" startet `cleanseHeroStatuses` zwei Aufräumer für dieselbe Karte: `queueMicrotask → cleanseNegativeAttachments` (`_engine.js:17310-17316`, ruft `anhaengselAbraeumen` `:6899`) UND den Hook `onStatusRemoved` (`_attachment-shared.js:~430`, `heilenWirftAb`, ruft `anhaengselAbraeumen`). Beide sehen den Stowaway noch im Support; die Löschvariante `anhaengselAbraeumen` → `actionMoveCard(inst,'deleted',…)` (`_engine.js:6872`) prüft nicht, ob die Karte noch in ihrer Quellzone liegt, und hängt den Namen ein zweites Mal an.

### C05-05 · Water Golem nimmt beim Abgang auch eine FREMDE Negierung des Ziels mit (Stowaway wird gelöscht) · Stufe B
- **Karten:** Water Golem (`cards/effects/water-golem.js`), Stowaway; ebenso jede andere Quelle von `negated` am Ziel (Decisive Defeat, Null …).
- **Voraussetzungen / Aufbau:** Seed 1234. Sitz 1 hat Held 1/0 durch einen Stowaway negiert (Variante A) bzw. mit `addHeroStatus('negated', {duration:1})` (Variante B). Sitz 0: Water Golem als Surprise in Held 0, Glass Wall in Held 1; Auslöser: Glass Wall wird per Effekt abgelegt (`actionMoveCard … 'discard'`), Ziel des Golems = Held 1/0.
- **Schritte:** 1. Golem auslösen und Held 1/0 wählen. 2. Golem zerstören (`actionDestroyCard`).
- **Erwartet** (Kartentext „While this Creature remains on the board, that target's effects are negated."): Die Negierung des Golems endet mit dem Golem; eine andere Negierung (Stowaway-Wirt: „…if the status effect it inflicted is removed … it is deleted") bleibt bestehen.
- **Beobachtet:** Der Golem legt bei bereits negiertem Ziel gar keine eigene Negierung an (`negationAuffrischen` Z. 58: `if (ziel.hero.statuses?.negated) return`), nimmt aber beim Abgang die vorhandene `negated`-Marke weg: Variante A: der Wirt ist frei, der Stowaway ist gelöscht (liegt im Gelöscht-Stapel); Variante B: die zeitlich begrenzte Fremd-Negierung ist vorzeitig weg. Für Kreaturen-Ziele entsprechend (`delete counters.negated`, Z. 88-91).
- **Repro:** `docs/niche-tests/repro/C05-creatures/05-water-golem-fremde-negierung.js` (`node docs/niche-tests/repro/C05-creatures/05-water-golem-fremde-negierung.js`; ✗ = Fehler tritt auf)
- **Vermutete Ursache:** `water-golem.js:85-87` (`negationLoesen`): `removeHeroStatus(…, 'negated', { bypassUnhealable: true })` ohne Prüfung, dass die Marke vom Golem stammt (`source === 'Water Golem'` bzw. `sourceBound`).

### C05-06 · The Spawn Mother: der Einsatz-Schaden feuert auch, wenn sie NICHT aus der Hand kommt · Stufe B
- **Karten:** The Spawn Mother (`cards/effects/the-spawn-mother.js`), The Root of all Evil (Auslöser des Falls); gleiche Wirkung bei Undurdle/Necromancy/Wiederbelebung.
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Sitz 0: Root auf dem Brett, Spawn Mother in der Ablage; 800 HP je Held.
- **Schritte:** 1. Root aktivieren (Main 1), Spawn Mother aus der Ablage wählen. 2. Moduswahl-Prompt beantworten (falls er kommt).
- **Erwartet** (Kartentext „When this Creature is summoned **from your hand**, deal 100 damage to all Heroes your opponent controls OR to all targets on the board, except this Creature."): Aus der Ablage platziert ⇒ kein Schaden, kein Prompt, der Stempel „Each effect … once per turn" bleibt frei.
- **Beobachtet:** Der Moduswahl-Prompt erscheint, alle drei Gegner-Helden verlieren 100 HP (700/700/700), `spawn-mother-aoe:0` ist gestempelt (damit ist der Schaden in diesem Zug auch für eine echte Hand-Beschwörung gesperrt). Die Gegenprobe Hand-Beschwörung (Modus „opp": Gegner-Helden −100; Modus „all": alle Helden und anderen Kreaturen −100, Spawn Mother selbst unversehrt) und das Wieder-Beschwören im selben Zug (kein zweiter Schaden) verhalten sich korrekt.
- **Repro:** `docs/niche-tests/repro/C05-creatures/06-spawn-mother-aus-ablage.js` (`node docs/niche-tests/repro/C05-creatures/06-spawn-mother-aus-ablage.js`; ✗ = Fehler tritt auf)
- **Vermutete Ursache:** `the-spawn-mother.js:137-147`: `onPlay` prüft nur `ctx.playedCard.id === ctx.card.id`. Der Kommentar lehnt eine Herkunftsprüfung ausdrücklich ab („summon-source distinctions are not part of this card's text"), der Text (seit Commit 4db2f97) nennt sie aber. Einen fertigen „kam aus der Hand"-Marker im `onPlay`-Kontext gibt es nicht (nur `fromHand`/`_fromHand` an einzelnen Engine-Wegen) – wäre mit dem Karten-Team zu klären.

### C05-07 · The Spawn Mother (gestohlen): „add this Creature you control to YOUR hand" landet in der Hand des Besitzers · Stufe B
- **Karten:** The Spawn Mother
- **Voraussetzungen / Aufbau:** Sitz 1 hat die Spawn Mother in Held 0/Zone 0; Sitz 0 stiehlt sie (`actionStealCreature`: Besitzer 1, Kontrolleur 0, bleibt in der Zone des Gegners). Aktivierung durch Sitz 0 über `doActivateCreatureEffect(… charmedOwner: 1)` (so bietet `getActivatableCreatures` sie an).
- **Schritte:** 1. Stehlen. 2. Aktionsphase, Bounce-Effekt aktivieren.
- **Erwartet** (Kartentext „You may spend an Action to add this Creature you control to your hand."): Die Karte kommt in die Hand des Kontrolleurs (Sitz 0); der Besitzer wird vermerkt (sie gehört beim Ablegen weiter Sitz 1). Der Engine-Weg dafür existiert: `actionMoveCard(inst,'hand',-1,-1,{ toPlayer })` (CARD_API.md Z. 3955, `_engine.js:13594`, Vorbild Surprising Opportunity).
- **Beobachtet:** Die Karte geht in die Hand des BESITZERS (Sitz 1). Der Dieb zahlt die Aktion und gibt dem Gegner die Karte zurück in die Hand.
- **Repro:** `docs/niche-tests/repro/C05-creatures/07-spawn-mother-gestohlen-rueckkehr.js` (`node docs/niche-tests/repro/C05-creatures/07-spawn-mother-gestohlen-rueckkehr.js`; ✗ = Fehler tritt auf)
- **Vermutete Ursache:** `the-spawn-mother.js:307` `actionMoveCard(inst, 'hand', -1, -1, { source, sourceOwner: ctrl })` ohne `toPlayer: ctrl`; die Skriptkommentare (Z. 295-306) nehmen „destination hand is `inst.owner`'s" ausdrücklich an.

### C05-08 · The Spawn Mother („alles"-Modus) und Gleichstand: bei gleichzeitigem Aus beider Seiten gewinnt immer Sitz 1 · Stufe C
- **Karten:** The Spawn Mother (Auslöser); die Regel liegt in der Engine (`_engine.js:48379`).
- **Voraussetzungen / Aufbau:** Beide Seiten haben nur Helden mit 100 HP (je 3 Helden); der Wirker (Sitz 0 bzw. Sitz 1) beschwört die Spawn Mother im Modus „Everything".
- **Beobachtet:** Alle Helden beider Seiten fallen gleichzeitig; `draw_resolved`: Sitz 1 gewinnt, **egal wer gespielt hat** (Wirker Sitz 0 ⇒ der Wirker verliert; Wirker Sitz 1 ⇒ der Wirker gewinnt). Das ist der dokumentierte Altzustand („Ohne Angabe bleibt es beim alten Verhalten", Sitz 0 verliert), die Spawn Mother hat keine Gleichstand-Klausel und setzt `_drawLoserIdx` nicht.
- **Repro:** `docs/niche-tests/repro/C05-creatures/08-spawn-mother-gleichstand-sitz.js` (`node docs/niche-tests/repro/C05-creatures/08-spawn-mother-gleichstand-sitz.js`; ✗ = Ausgang hängt vom Sitz ab)
- **Frage an Al:** Wenn ein Effekt ohne Klausel beide Seiten gleichzeitig auslöscht: soll der **Wirker/aktive Spieler verlieren**, der **Wirker gewinnen** – oder bleibt es beim Sitz-Standard (Sitz 0 verliert)? (Gleiches gilt für jede Flächenkarte ohne eigene Klausel.)

### C05-09 · Wire Hatchling: Abbruch der Einsatz-Zielwahl lässt die Kreatur auf dem Brett (Aktion verbraucht) · Stufe C
- **Karten:** Wire Hatchling (`cards/effects/wire-hatchling.js:51-61`); gleiche Klasse laut Vorrunde: Deepsea Werewolf/Mummy/Reaper/Siren/Succubus, Fiery/Icy/Slimy/Sparky Slime, Sleeping Beauty (nicht von mir gemessen).
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Sitz 0: Wire Hatchling + eine Füllkarte auf der Hand. Zielwahl wird wie vom Abbruch-Knopf eines Menschen mit `null` beantwortet.
- **Schritte:** 1. Hatchling beschwören. 2. Zielwahl abbrechen.
- **Erwartet** (Regel 23.9, CARD_API.md Z. 367-392: „Zielende Attacks/Spells/Creature Effects sollten immer abbrechbar sein … Abbruch heißt: nichts ist passiert. Die Karte bleibt auf der Hand, die Aktion wird erstattet."): Lesart 1 wörtlich: Hatchling zurück auf die Hand, Aktion erstattet. Lesart 2: nur der Effekt entfällt, die Kreatur bleibt (sie ist ja schon „summoned").
- **Beobachtet:** Lesart 2 – die Kreatur steht auf dem Brett, ist nicht mehr auf der Hand, die Aktion ist verbraucht (`heroesActedThisTurn = [0]`), kein Schaden, keine Fehler.
- **Einordnung:** Das Gegenbeispiel der Vorrunde („500 Piranhas in a Monster Suit" nimmt die Beschwörung zurück) ist nicht vergleichbar: dort ist die Wahl ein **Spielkosten**-Schritt in `beforeSummon` („defeat it to play this card"). Beim Hatchling kommt die Wahl **nach** dem Landen („When you summon this Creature, choose …"). Die Regel 23.9 benennt für Einsatz-Effekte keinen Rücknahme-Weg (`onCreatureEffect → false` gilt für aktivierte Effekte).
- **Repro:** `docs/niche-tests/repro/C05-creatures/09-wire-hatchling-abbruch.js` (`node docs/niche-tests/repro/C05-creatures/09-wire-hatchling-abbruch.js`; ✗ = Lesart 1 nicht erfüllt)
- **Frage an Al:** Soll der Abbruch der Zielwahl im Einsatz-Effekt einer Kreatur die Beschwörung zurücknehmen (Karte zurück auf die Hand, Aktion erstattet) – oder bleibt die Kreatur ohne Effekt auf dem Brett?

### C05-10 · Stowaway negiert nur den Heldeneffekt, nicht die Abilities des Wirts · Stufe B
- **Karten:** Stowaway (`cards/effects/stowaway.js:175`); Gegenstück Decisive Defeat (dort ist die leichte Form gewollt).
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Sitz 0: Held 0 mit Destruction Magic ×2 (Lv2); Held 1 beschwört per Ziel-Hint den Stowaway in Zone 1 von Held 0 (Held 0 trägt `negated` mit `_fromAttachment: 'Stowaway'`). „Fireball" (Destruction Magic Lv2) auf der Hand.
- **Schritte:** 1. Stowaway auf Held 0. 2. Fireball mit Held 0 spielen (`noGrant`, Ziel Gegner-Held 0).
- **Erwartet** (Kartentext „The corresponding Hero's effect **and Abilities** are negated."; harte Negation = nur Lv0-Karten ohne Schulanforderung, `_engine.js:43696` „Hard Negation blanks ability zones"): Fireball (Lv2) ist nicht spielbar.
- **Beobachtet:** Fireball wird gespielt und wirkt (150 Schaden, Gegner 800 → 650). Dasselbe Verhalten mit Decisive Defeat (dort laut Ruling richtig: „that Hero's EFFECT is negated"). Der Stowaway läuft über denselben Helfer `setzeAnhaengselStatus` und bekommt damit unbemerkt die leichte Form (`_fromAttachment` = „Abilities still work", `_engine.js:42954`, `:43702`, `:44557`); das Ruling CARD_API.md Z. 14268 (v1114) wurde nach dem Stowaway (Z. 19599, 2.10.) formuliert, ohne den Stowaway zu berücksichtigen. Nicht gemessen: weitere Wege, die harte Negation lesen (Ability-Aktivierung, passive Ability-Hooks).
- **Repro:** `docs/niche-tests/repro/C05-creatures/10-stowaway-abilities-nicht-negiert.js` (`node docs/niche-tests/repro/C05-creatures/10-stowaway-abilities-nicht-negiert.js`; ✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_attachment-shared.js:349` (`setzeAnhaengselStatus`) kennt nur die leichte `_fromAttachment`-Marke; der Stowaway (`stowaway.js:175`) bräuchte die harte Form (Marke weglassen oder eigene Marke wie `_hardNegation`), die ihn trotzdem heilbar lässt.

### C05-11 · Water Golem hält die Negierung seines Ziels auch gefroren/betäubt/negiert (Klasse B-01) · Stufe C
- **Karten:** Water Golem (`cards/effects/water-golem.js`); dieselbe Klasse wie B-01 (The Thing in the Ship), hier mit eigenem Repro, weil die Karte in meiner Liste steht.
- **Voraussetzungen / Aufbau:** Wie C05-05 (Golem durch Ablegen einer eigenen Surprise ausgelöst, Ziel Gegner-Held 0); danach der Golem gefroren, betäubt bzw. negiert (`applyCreatureStatus` / `actionNegateCreature`).
- **Erwartet** (Kartentext „While this Creature remains on the board, that target's effects are negated."): wörtlich bleibt die Negierung („solange sie auf dem Brett liegt"); nach der Engine-Konvention (`isCreatureEffectSuppressed`) verlöre ein stillgelegter Golem seine Wirkung.
- **Beobachtet:** In allen drei Zuständen bleibt der Held des Ziels negiert (`isCreatureEffectSuppressed(golem)` = true, Marke `sourceBound` bleibt).
- **Repro:** `docs/niche-tests/repro/C05-creatures/11-water-golem-stillgelegt.js` (`node docs/niche-tests/repro/C05-creatures/11-water-golem-stillgelegt.js`; ✗ = Konvention nicht erfüllt)
- **Vermutete Ursache:** `water-golem.js:223-240` – die Negierung wird nur beim Abgang des Golems zurückgenommen, auf einen Statuswechsel des Golems reagiert nichts.
- **Frage an Al:** Soll ein gefrorener/betäubter/negierter Water Golem seine Negierung freigeben (Konvention) oder gilt „liegt auf dem Brett" wörtlich? (Gleiche Frage wie bei B-01; Antwort dort gilt hier mit.)

## Abdeckung
| Karte | Tiefe | Geprüfte Nischenfälle / Anmerkung |
|---|---|---|
| Spirit of the Ultimate Gun | L2 gezielt | Beschwörung nur mit Core-Träger (Core bei anderem Helden ✗ wie erwartet) ✓; Verdopplung 100→200 für eigene und gegnerische Kreatureneffekte ✓; zwei Spirits (nicht 400) ✓; Angler Angel +50 nicht addiert ✓; Held-Attack/Spell nicht verdoppelt ✓; Spirit negiert/gefroren/betäubt/weg → 100 ✓; Egg of God bleibt unversehrt ✓ |
| Stowaway | L2 gezielt | Zugende-Ablauf ✗ (→ C05-02), Clown-Aura ✗ (→ C05-03), Heilen-Doppellöschung ✗ (→ C05-04), Wirt-Abilities nicht negiert ✗ (→ C05-10), Wirt auf Gegnerseite/Tod/Wiederbelebung ✓ (Löschstapel des Besitzers, Wirt nach Revive frei), „unaffected" gegen Zerstören/Schaden/Frost/Negation/Diebstahl/Rückführung ✓, zwei Stowaways am selben Wirt ✓ |
| Super Fan | L2 gezielt | Zusatzaktions-Beschwörung (2 Abilities abwerfen) ✓ und Abbruch der Kostenwahl ✓; Aufdecken: Ability → Heldenwahl, Anlage trotz verbrauchtem Zug-Kontingent ✓; keine Zone frei → Oben/Unten ✓; gefrorener Held als Ziel (wird angelegt, Text lässt es zu) ✓ |
| Suspicious Monster | L2 gezielt | Opfer-Beschwörung als Zusatzaktion in denselben Platz ✓; Platz mit heute beschworener Kreatur / gefrorener Held → abgelehnt ✓; gestohlene Kreatur in fremder Zone nicht opferbar ✓; 100 Schaden: Abbruch kostet nichts, einmal pro Zug ✓ |
| The Creepy Clown of Heaven | L2 gezielt | Gegner besiegt den Clown im eigenen Zug: Ablage des Besitzers ✓, Nachwirkung bis Zugende ✓; Aura vs. Stowaway ✗ (→ C05-03); Root unter Clown ruht ✓ |
| The Egg of God | L2 gezielt | Opfer-Beschwörung (Zusatzaktion, Opfer in der Ablage) ✓; Zugbeginn: Galerie Lv≤3 ohne Egg ✓, selber Platz ✓, Haste (Aktiveffekt sofort) ✓; Schaden negiert/Zerstörung wirkt ✓; kein Kandidat → bleibt liegen ✓; permanent übernommene Egg sucht im Deck des Kontrolleurs ✓ |
| The Golden Abomination | L2 gezielt | Einkommen umgeleitet ✓; Gold 0 → nicht ✓; Gold −20 → ja ✓; zwei Abominationen nicht doppelt ✓; beide Seiten ✓; negiert → nicht ✓ (Frost nicht messbar: läuft zum Zugende des Besitzers ab) |
| The Oracle of Heaven | L2 gezielt | Treffer (Hand + 2 ziehen) ✓, Fehlschlag (3 Karten milled) ✓, Deck mit 2 Karten ✓, Abbruch verbraucht nichts ✓, HOPT ✓, Root: Kreaturen gelöscht ✓; Deck mit genau 1 Treffer-Karte: „draw 2" aus leerem Deck = Niederlage (Engine-Regel, kein Befund) |
| The Root of all Evil | L2 gezielt | Passiv: Tod beider Seiten, Handabwurf, Mill → gelöscht ✓; Frozen/Stunned/Negated/Clown-Aura → Ablage ✓; Root selbst gelöscht ✓; zwei Roots ✓; gestohlene Kreatur → Löschstapel des Besitzers ✓; Aktivierung: HOPT, Abbruch verbraucht nichts ✓ |
| The Spawn Mother | L2 gezielt | Modus „opp"/„all" ✓, Wieder-Beschwören im selben Zug kein 2. AOE ✓, Bounce ✓; Platzieren aus Ablage löst Schaden aus ✗ (→ C05-06); gestohlen: Bounce in Besitzer-Hand ✗ (→ C05-07); Gleichstand ⇒ Sitz 1 gewinnt (→ C05-08, C); Zug-1-Schutz ✓ (kein Schaden an Geschützten) |
| The Thing in the Ship | L0 gelesen | Dauer-Sperre ignoriert Frost/Betäubung/Negation = Klasse B-01 (dort gemeldet, nicht erneut gemessen) |
| The Weather Orchestra | L2 gezielt | Level-Rabatt durch Singing (Lv3−2 spielbar, Lv2 nicht) ✓; Galerie Hand/Deck/Ablage, Summe genau 12, Obergrenze ✓; Ausrüsten auf Gegnerheld (Besitzer bleibt) ✓; aktiver Effekt: gegnerisches Artefakt in die Ablage seines Besitzers, HOPT ✓. Hinweis: 0-Kosten-Equipment wird nie angeboten (`cost > 0`-Filter, Secret Lab Entrance ist das einzige) – nicht gemeldet |
| Tobi, the Average Student | L2 gezielt | Beschwörung per Reveal als Zusatzaktion ✓; zweiter Tobi abgelehnt, Karte bleibt auf der Hand ✓; Reveal: Level −1 nur für die gewählte Kopie ✓, Offset folgt der Kopie nach Hand-Verschiebung ✓ |
| Traveler from the Future | L2 gezielt | Resource-Phase-Zug zählt als Starthand (Angebot erscheint) ✓; ohne Traveler / Traveler beim Gegner → kein Angebot ✓ |
| Undurdle | L2 gezielt | Stufen 1/2/3 nach Summoning-Magic-Level ✓; Held tot ✓; gestohlen (Galerie aus Kontrolleur-Ablage, Undurdle in Besitzer-Ablage) ✓; Root aktiv ✓; Massentod durch Spawn-Mother-Welle ✓ (ersetzte Kreatur überlebt) |
| Vinepire | L2 gezielt | Heilung = halber tatsächlicher Schaden, Overkill gedeckelt ✓, Einzelziel-Pflicht (Flame Avalanche heilt nicht) ✓, eigener Held als Ziel ✓, Max-HP-Deckel ✓, gefroren/negiert ✓, zwei Vinepires addieren ✓ |
| Waitress | L2 gezielt | Alt-Weg (alle Status heilen, Zusatzaktion) ✓, nur positiver Status → nicht spielbar ✓, Abbruch der Reinigung ✓, HOPT-Heilung (0 Status verbraucht nichts) ✓, Stowaway-Wirt ✗ (→ C05-04) |
| Water Golem | L2 gezielt | Auslöser nur bei Effekt-Ablage einer eigenen Surprise; Zonen voll / Wirt tot / Wirt gefroren → löst nicht aus ✓; Negierung hält über Zugwechsel, endet mit dem Golem ✓; Kreatur als Ziel ✓; Revive des Ziel-Helden ✓; fremde Negierung wird mitgenommen ✗ (→ C05-05); stillgelegter Golem hält Negierung (→ C05-11, C) |
| Wavilion | L2 gezielt | +100 pro Angriff (Kreatur/Held besiegt) ✓, kein Zuwachs bei Spell/ohne Besiegen/anderer Held ✓, zwei Wavilions +200 ✓, dauerhaft nach Wavilion-Tod und Zugwechseln ✓, gefroren/betäubt/negiert ✓ |
| Weapon Collecting Wight | L2 gezielt | Kosten ≤ 15 (Bow 15 ja, Fists 20 nein; Nicht-Equipment nein) ✓, HOPT ✓, Abbruch verbraucht nichts ✓, alle Helden gefroren → nicht aktivierbar ✓, gestohlener Wight nutzt Ablage/Held des Kontrolleurs ✓ |
| Wire Hatchling | L2 gezielt | unversehrte Kreatur als Ziel ✗ (→ C05-01); Abbruch (→ C05-09, C); Held ungerade HP/1 HP ✓, vorbeschädigte Kreatur ✓, Zug-1-Schutz (geschützte Kreatur bleibt unversehrt) ✓ |

## Getestet & in Ordnung (Auswahl)
- **Spirit of the Ultimate Gun:** Verdopplung gilt für fremde und eigene Kreatureneffekte, nicht für Held-Attacks/Spells; mehrere Spirits stapeln nicht; „cannot be increased by other effects" hält gegen Angler Angel (+50 danach); erlischt sofort mit Negation/Frost/Betäubung/Tod des Spirits.
- **The Root of all Evil:** alle Todes-/Abwurf-/Mill-Wege löschen gleichmäßig für beide Seiten; sie ruht bei jeder Stilllegung (auch unter dem Creepy Clown); gestohlene Kreaturen landen im Löschstapel des BESITZERS.
- **Undurdle:** Staffel 1/2/3 folgt dem Summoning-Magic-Level des Zonen-Helden; funktioniert bei totem Helden und in der Massenwelle; der ersetzte Platz bleibt nach der Welle belegt.
- **The Egg of God:** Zugbeginn-Brut mit Haste (das gebrütete Monster darf sofort aktivieren); Zerstörung wirkt, Schaden nicht; „kein Kandidat" lässt die Egg liegen.
- **Vinepire / Wavilion:** Lebensraub und ATK-Zuwachs rechnen mit dem tatsächlichen Schaden bzw. pro Angriff (nicht pro Ziel), reagieren auf Statuslagen korrekt.
- **Weather Orchestra / Weapon Collecting Wight:** Ausrüsten aus Ablage/Deck/Hand inkl. Gegner-Helden, Besitzer bleibt erhalten (Ablage des Besitzers); Kostengrenzen exakt.
- **The Spawn Mother:** Einmal-pro-Zug-Stempel gilt gemeinsam für AOE und Bounce; Wieder-Beschwören im selben Zug erzeugt keinen zweiten Schlag; Zug-1-Schutz verhindert Schaden an den Geschützten.
- **Tobi:** Hand-Index-Buchhaltung (Offset und Reveal) folgt der Kopie bei Hand-Verschiebungen und unterscheidet mehrere Kopien derselben Karte.
- **Oracle of Heaven:** Mill-Weg (Treffer = Hand + 2 ziehen, Fehlschlag = 3 Karten milled, bei kleinem Deck was da ist); Abbruch verbraucht nichts.
- **Querschnitt:** Alle gemessenen Läufe ohne verschluckte Engine-Fehler (`t.errors`) und ohne `t.audit()`-Meldungen (außer den bekannten Fehlalarmen für seitenfremd gelegte Instanzen beim Weather Orchestra).
