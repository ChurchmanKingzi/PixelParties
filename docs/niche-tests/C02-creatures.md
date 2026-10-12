# C02-creatures – Nischenfall-Bericht
Stand/Autor: Agent C02-creatures, 12.10.2026. Karten: 21 in der Liste · 0 gezielt getestet (L2) · 1 mit Befund.

## Zusammenfassung
(wird am Ende ergänzt)

## Befunde
### C02-01 · Exploding Skull: Geschwister-Sperre verfällt nie – ein zweiter Skull explodiert in späteren Zügen nicht mehr · Stufe A
- **Karten:** Exploding Skull (`cards/effects/exploding-skull.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, Sitz 0 am Zug. Seite 0: zwei Exploding Skulls (A in Zone 0, B in Zone 1, beide `turnPlayed 1`); Seite 1: „ZZ Dummy Big" als Ziel.
- **Schritte:** 1. Skull A besiegen (`actionDestroyCard`). 2. Zwei echte Zugwechsel (`t.endTurn()` ×2) bis Zug 7 (wieder Sitz 0). 3. Skull B besiegen.
- **Erwartet** (Kartentext „When this Creature is defeated, deal 80 damage to all targets your opponent controls. You can only activate this effect once per turn."): Skull A feuert in Zug 5; Skull B feuert in Zug 7 erneut, weil „einmal pro Zug" je Zug gilt.
- **Beobachtet:** A feuert (80 Schaden ✓). Danach trägt B `counters._explodingSkullSuppressed = true`; in Zug 7 bleibt B stumm (Held 1/0 behält 720 HP). Die Marke wird nirgends zurückgesetzt (`grep _explodingSkullSuppressed` – nur im Skript selbst, Setzen Z. 138 / Lesen Z. 112). Dasselbe gilt, wenn B im Gegnerzug (6) stirbt.
- **Repro:** `docs/niche-tests/repro/C02-creatures/01-exploding-skull-geschwister-marke-bleibt.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `exploding-skull.js:130-139` stempelt die „gleicher Batch"-Marke dauerhaft auf alle Geschwister; die Zugbindung steht schon in `claimHOPT` (Z. 123) und macht die Marke für den Folgefall überflüssig. Die Marke muss an Zug/Ereignis gebunden werden (z. B. `= gs.turn` statt `true`) oder weg.

### C02-02 · Doomed Town Guard: Schutzschirm überlebt Frost, Betäubung und Negation · Stufe B
- **Karten:** Doomed Town Guard (`cards/effects/doomed-town-guard.js`), Engine `_applyForcesTargetingFilter` (gleiche Stelle bedient Deepsea Horror Clown)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Sitz 0: zwei Dummies X/Y, Doomed Town Guard (DTG) auf der Hand; Sitz 1: Field Cannon als „Zielwähler". X wird durch Sitz 1 besiegt → DTG kommt.
- **Schritte:** 1. DTG einmal normal, dann gefroren / betäubt / negiert (`applyCreatureStatus`, `actionNegateCreature`). 2. Sitz 1 aktiviert Field Cannon und sieht die Zielliste.
- **Erwartet** (Kartentext „Your opponent can't choose other Creatures you control."; Konvention CARD_API.md Z. 1902: `isCreatureEffectSuppressed` ist DAS Prädikat für „die Effekte dieser Kreatur sind stumm", „neue Stellen, die Kreaturstatus prüfen, nehmen das Prädikat"): normal ist Y nicht wählbar ✓; stillgelegt (gefroren/betäubt/negiert) entfällt der Schirm.
- **Beobachtet:** Y ist in allen drei stillgelegten Zuständen weiterhin **nicht** wählbar (die Zielliste enthält nur Helden, DTG und die eigene Field Cannon). Der Filter liest allein `counters.forcesTargeting`.
- **Repro:** `docs/niche-tests/repro/C02-creatures/02-doomed-town-guard-schirm-trotz-stilllegung.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_engine.js` ~Z. 312-322 (`creatureForcers`-Filter) prüft weder `isCreatureEffectSuppressed(inst)` noch `faceDown`. Gleiche Klasse wie B-01…B-03 (Dauereffekt außerhalb des Hook-Verteilers); betrifft auch Deepsea Horror Clown.
- **Hinweis zur Einordnung:** Der Wachposten lebt nur bis zum Zugende seines Kontrolleurs; die praktische Reichweite ist klein (Gegner friert ihn im eigenen Zug ein, um an die geschützten Kreaturen zu kommen).

### C02-03 · Doomed Town Guard: zweite Kopie reagiert im selben Zug nicht auf einen späteren, getrennten Tod · Stufe B
- **Karten:** Doomed Town Guard (`cards/effects/doomed-town-guard.js`)
- **Voraussetzungen / Aufbau:** Sitz 0: zwei Dummies, **zwei** DTG auf der Hand. Sitz 1 besiegt (zwei getrennte `actionDestroyCard`-Aufrufe) erst den einen, dann den anderen Dummy – im selben Zug.
- **Erwartet** (Kartentext „Immediately summon this Creature when one or more targets you control are defeated by an opponent's card or effect."): „one or more" klammert **ein** Sterbe-Ereignis (Mehrfachtod = ein Angebot je Kopie); ein zweites, getrenntes Ereignis ist ein neuer Auslöser, auf den die zweite Kopie antworten darf. Der Kopfkommentar des Skripts sagt genau das („Der Riegel klammert das ganze Sterbe-Ereignis").
- **Beobachtet:** Nur die erste Kopie kommt; die zweite bleibt ohne Angebot auf der Hand. Der Riegel `ps._dtgSummonedForDeath === gs.turn` gilt für den ganzen Zug, nicht für das Ereignis. (Mehrfachtod in einem Schlag – Held + 2 Kreaturen mit zwei Kopien auf der Hand – ergibt korrekt **einen** Wachposten.)
- **Repro:** `docs/niche-tests/repro/C02-creatures/03-doomed-town-guard-zweite-kopie-getrennter-tod.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `doomed-town-guard.js` ~Z. 111 und 143-148: die Klammer müsste an das Ereignis (z. B. an `engine._todesAufschub…`-Scope bzw. eine Ereignis-ID) statt an `gs.turn` gebunden sein.
- **Randnotiz (kein eigener Befund):** Stirbt etwas im **Gegnerzug**, lebt der Wachposten bis zum Ende des *eigenen* Zuges seines Kontrolleurs („At the end of YOUR turn") – im Repro nach `t.endTurn()` ×2 bestätigt ✓.

### C02-04 · Drill Sergeant legt einen zweiten Ethan / eine zweite Ellie („You can only control 1" umgangen) · Stufe B
- **Karten:** Drill Sergeant (`drill-sergeant.js`), Ethan, the Prodigy (`ethan-the-prodigy.js`), Ellie, the Class President (`ellie-the-class-president.js`); Engine `actionPlaceCreature`
- **Voraussetzungen / Aufbau:** Sitz 0: Drill Sergeant (Zone 0/0), Ethan (bzw. Ellie) auf dem Brett (Zone 0/1) und eine zweite Kopie auf der Hand. Alle Level 1, also vom Sergeant wählbar.
- **Schritte:** 1. Drill Sergeant aktivieren (Main Phase). 2. Die Handkopie wählen.
- **Erwartet** (Kartentext Ethan/Ellie: „You can only control 1 …"; Ruling CARD_API.md Z. 1965: Platzieren zählt als Effekt-Beschwörung; Ethan-Kopfkommentar: die Sperre gilt gegen die normale UND die Sofort-Beschwörung): die zweite Kopie wird nicht gelegt, sie bleibt auf der Hand.
- **Beobachtet:** Die zweite Kopie wird gelegt – zwei Ethans (−2 Stufe in beiden Händen) bzw. zwei Ellies auf dem Brett. Zustand sonst sauber.
- **Repro:** `docs/niche-tests/repro/C02-creatures/04-drill-sergeant-platziert-zweiten-ethan-ellie.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_engine.js actionPlaceCreature` (~Z. 25949-26290) ruft das Karten-Gate `beforeSummon` (hier die „only control 1"-Prüfung) nie auf – anders als `summonCreatureWithHooks`. `drill-sergeant.js eligibleHandCards` filtert nur Stufe und Kartenart. Klassenbefund: jeder Platzier-Effekt kann „can only control 1"-Karten duplizieren (Ellie, Ethan).

### C02-05 · Drill Sergeant, gestohlen: „corresponding Hero" wird auf den gleich nummerierten Helden des Diebes abgebildet · Stufe C
- **Karten:** Drill Sergeant (`drill-sergeant.js`, `targetZones` ~Z. 64-67)
- **Voraussetzungen / Aufbau:** Drill Sergeant liegt auf Seite 0 unter Held 1; Sitz 1 hat ihn per `actionStealCreature` gestohlen und hat einen Dummy auf der Hand.
- **Schritte:** 1. Sitz 1 aktiviert den gestohlenen Sergeant (`doActivateCreatureEffect` mit `charmedOwner` = 0, wie vom Client). 2. Dummy wählen, Zonenwahl bestätigen.
- **Erwartet:** unklar – drei Lesarten: (a) Wirtsheld der Brettseite (Konvention „Kontrolle statt Seite", Demon's Gate `physicalSide`): Seite 0, Held 1; (b) irgendein Held des Kontrolleurs; (c) gar nicht aktivierbar. Text: „a free Support Zone of the corresponding Hero".
- **Beobachtet:** Der Dummy landet bei **Seite 1, Held 1** – dem Helden des Diebes, der denselben Index trägt wie der Held unter dem Sergeant. Der Index-Zufall hat keinen Bezug zum Sergeant; das Zonenangebot (3 freie Zonen) gehört einem Helden, der „corresponding" nur zufällig ist.
- **Repro:** `docs/niche-tests/repro/C02-creatures/05-drill-sergeant-gestohlen-falscher-held.js` (✗ = strenge Lesart (a) wird nicht erfüllt)
- **Vermutete Ursache:** `drill-sergeant.js` `targetZones(engine, pi, heroIdx)` = `getFreeSupportZones(pi)` (Seite des Kontrolleurs) gefiltert auf `ctx.cardHeroIdx` (Spalte der Brettseite).
- **Frage an Al:** Soll ein gestohlener Drill Sergeant bei (a) dem Helden unter dem er liegt (Gegnerseite, Karte gehört dem Dieb), (b) einem beliebigen eigenen Helden des Diebes legen, oder (c) nur beim Besitzer funktionieren?

## Abdeckung
| Karte | Tiefe | Geprüfte Nischenfälle / Anmerkung |
|---|---|---|
| Demon's Gate | L0 gelesen | noch nicht bearbeitet |
| Disgruntled Forest Warden | L0 gelesen | noch nicht bearbeitet |
| Doomed Town Guard | L0 gelesen | noch nicht bearbeitet |
| Drill Sergeant | L0 gelesen | noch nicht bearbeitet |
| Duigno, the Flaming Phoenix | L0 gelesen | noch nicht bearbeitet |
| Ellie, the Class President | L0 gelesen | noch nicht bearbeitet |
| Elusive Hind | L0 gelesen | noch nicht bearbeitet |
| Embodiment of Biseria | L0 gelesen | noch nicht bearbeitet |
| Empty Armor | L0 gelesen | noch nicht bearbeitet |
| Enhanced Guard Dog | L0 gelesen | noch nicht bearbeitet |
| Ethan, the Prodigy | L0 gelesen | noch nicht bearbeitet |
| Exploding Skull | L2 gezielt | Geschwister-Sperre ✗ (→ C02-01) |
| Explosive Drone | L0 gelesen | noch nicht bearbeitet |
| Festive Werz | L0 gelesen | noch nicht bearbeitet |
| Field Cannon | L0 gelesen | noch nicht bearbeitet |
| Foresta, the Guard | L0 gelesen | noch nicht bearbeitet |
| Frolake | L0 gelesen | noch nicht bearbeitet |
| Front Soldier | L0 gelesen | noch nicht bearbeitet |
| Gangster Angel | L0 gelesen | noch nicht bearbeitet |
| Gerrymander | L0 gelesen | noch nicht bearbeitet |
| Ghoul Guard | L0 gelesen | noch nicht bearbeitet |

## Getestet & in Ordnung (Auswahl)
(wird ergänzt)
