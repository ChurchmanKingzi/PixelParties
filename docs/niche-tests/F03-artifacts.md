# F03-artifacts – Nischenfall-Bericht
Stand/Autor: Agent F03-artifacts (Vorgänger + Fortsetzung), 13.10.2026. Karten: 48 in der Liste · 43 gezielt getestet (L2) · 26 mit Befund. Befunde: 20 (Stufe A: 4 · B: 10 · C: 6).

## Zusammenfassung
20 Befunde (A 4 · B 10 · C 6), alle mit ausgeführtem Repro unter `docs/niche-tests/repro/F03-artifacts/` (Exit 1 = Fehler tritt auf). Die fünf wichtigsten:
1. **F03-03 (A)** Weird Doll: eine Ability in einer Support Zone (Xalibur) kollidiert in der Wahl-ID mit der Ability-Zone gleicher Nummer – gelöscht wird die *falsche* Ability bzw. nichts.
2. **F03-14 (A)** Warhorse, The Master's Sword, Vampiric Sword: ihre Angriffs-Boni (+50 / doppelter Schaden / Heilung) greifen nur gegen Helden, nie gegen Kreaturen als Ziel.
3. **F03-07 (A)** Slippery Fridge: das bloße Umhängen von Thunder Trumpet / Storm Piano löst deren „sent to the discard pile"-Trigger aus (80 Schaden, `damage_proof`); dazu F03-08/-09: die Fridge umgeht Je-Held-Limits und gefrorene Zielhelden und verschiebt nur *eine* statt „any number" Ausrüstung.
4. **F03-04 (A)** Snow Cannon ignoriert Thickets „cannot be chosen" (`normalizeValidTargets` filtert `untargetable_all` nicht – betrifft jedes Ziel-Artefakt mit eigener Liste).
5. **F03-16 / F03-19 (B)** Zieh-Sperre (Sacred Jewel): Wheels und beide Stäbe verlieren dabei Karten/Gold ohne zu ziehen (Teleporter/Uncontrollable leeren die ganze Hand); Item Lock („delete a card") darf die gerade gespielte Artefakt-Karte selbst als Kosten löschen.
Weiter: Heldentod gibt The White Eye nicht zurück (F03-01), Sun Sword stempelt Frost-Immunität nur einmal (F03-02), Backpack ignoriert „1 Smug Coin per game" (F03-06), Eye of Ren kauft die harte Stab-Sperre frei (F03-10), Stormblade mischt die auflösende Gegnerkarte mit (F03-11), Treasure Chest unter eigener Gold-Sperre wirkungslos spielbar (F03-20); sechs Regelfragen (C) an Al.
Gesamteindruck: Die Kartenskripte selbst sind sorgfältig (Reaktions-Artefakte, Great Wall, Smug Coin, Schilde, Tea, Instruments-HOPT, Brewer's Blade ohne Befund); die Befunde liegen fast alle an **Nahtstellen** – Engine-Verträge, die ein Skript nicht kennt (`toZone`, `ineligible`/`untargetable_all`, `drawLocked` vs. `handLocked`, auflösende Handkarte, `canEquipCardToHero`/`heroCanBeEquipped` bei Verschiebungen).
Bewusst NICHT getestet: Rain Viola (dritter Nutzer von `instrumentDiscardTrigger`), Elana/Weitere „shuffle your entire hand"-Karten, andere Ziel-Artefakte mit eigener Zielliste (F03-04 nur an Snow Cannon belegt), Geschwister der Cheese-Familie, Golden Bananas/War Chest (F03-20), Surprise-Fenster-Ketten mit mehreren Reaktionen gleichzeitig, UI/Client (greyed-out-Anzeige), Mehrspieler-Sitze 3/4. Karte „The Master's Sword" ist **gebannt** und trägt (anders als der Text „Equip this card to a Hero you control") keine `equipOwnSideOnly`-Fahne (landet auf Gegnerhelden); gemäß CARD_API.md Z. ~7140 wurden gebannte Karten beim Nachziehen nicht angefasst – nur als Hinweis, kein Befund.

## Befunde
### F03-01 · The White Eye kehrt beim Heldentod nicht auf die Hand zurück · Stufe B
- **Karten:** The White Eye (`cards/effects/the-white-eye.js`), Engine `handleHeroDeathCleanup`
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, Sitz 0 spielt The White Eye auf Held 0 (Slot 0); Hand sonst leer.
- **Schritte:** 1. Kontrollprobe: Ausrüstung per Effekt zerstören (`actionDestroyCard`). 2. Neu aufbauen, den Träger-Held durch 5000 Schaden töten.
- **Erwartet** (Kartentext „When this card is sent to your discard pile, except because you discarded it from your hand, add it to your hand immediately."): Beim Heldentod wandert die Ausrüstung in die Ablage – das ist „sent to your discard pile" – also landet die Karte auf der Hand.
- **Beobachtet:** Kontrollprobe ✓ (Hand). Heldentod ✗: The White Eye liegt in der Ablage, die Hand bleibt leer.
- **Repro:** `docs/niche-tests/repro/F03-artifacts/01-white-eye-heldentod.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `the-white-eye.js` `onCardLeaveZone` verlangt `ctx.toZone === 'discard'`; `handleHeroDeathCleanup` (`_engine.js` ~47650) feuert den Hook ohne `toZone` und legt die Karte selbst in `discardPile` (der `_returnToHand`-Pfad von `actionMoveCard` ~13482 wird dort nicht durchlaufen). Die Instrument-Karten (`_orchestra-shared.instrumentDiscardTrigger`) behandeln „kein toZone = Discard" ausdrücklich.

### F03-02 · The Sun Sword: Frost-Immunität ist ein Momentstempel statt eines Dauerprädikats · Stufe B
- **Karten:** The Sun Sword (`cards/effects/the-sun-sword.js`)
- **Voraussetzungen / Aufbau:** Sitz 0 spielt The Sun Sword auf Held 0; je Fall ein Zusatzaufbau (siehe Schritte).
- **Schritte:** E) Gegner-Kreatur nach dem Schwert per `actionStealCreature(0, …)` stehlen, dann einfrieren. F) eigene (immune) Kreatur von Sitz 1 stehlen lassen, dann einfrieren. G) Held 1 sterben und wiederbeleben, dann einfrieren. H) Gegner-Held per `actionTakeHeroPermanently(0, 1, 1)` übernehmen, dann einfrieren.
- **Erwartet** (Kartentext „… targets you control cannot be Frozen …"): Solange das Schwert liegt, ist jedes Ziel, das Sitz 0 *gerade* kontrolliert, nicht einfrierbar; was Sitz 0 nicht mehr kontrolliert, ist es nicht mehr.
- **Beobachtet (alle ✗):** E) gestohlene Kreatur ist einfrierbar. F) die von Sitz 1 gestohlene Kreatur trägt weiter `freeze_immune` (Gegner bekommt Gratis-Immunität). G) wiederbelebter Held ist einfrierbar. H) übernommener Held ist einfrierbar. Normalfälle (Anlegen taut alles auf, neue Kreaturen sind immun, zweites Schwert hält die Immunität, Verlust des letzten Schwerts nimmt sie weg, Brand „rest of the game" überlebt den Schwertverlust) ✓.
- **Repro:** `docs/niche-tests/repro/F03-artifacts/02-sun-sword-frost-immunitaet-momentstempel.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `the-sun-sword.js` `applyFreezeImmunity()` läuft nur in `onPlay`/`onGameStart` und `onCardEnterZone` (neue Kreaturen); kein Haken für Wiederbelebung (`onRevive`), Kontrollwechsel (`onTakeControl`) oder Rückgabe. Die Immunität steht als Stempel (`statuses.freeze_immune` / `counters.freeze_immune`) und wird beim Tod geleert bzw. beim Diebstahl mitgegeben.

### F03-03 · Weird Doll: Ability in einer Support Zone (Xalibur) – die gewählte Karte wird nicht abgelegt, stattdessen die Ability-Zone gleicher Nummer · Stufe A
- **Karten:** Weird Doll (`cards/effects/weird-doll.js`), Xalibur (Quelle der Support-Zonen-Ability; gleiches gilt für Cloak of Edge/Xal laut `collectSupportZoneAbilities`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, Sitz 0, Held 0 mit Xalibur in Support Zone 0, „Toughness" (per Xalibur) in Support Zone 1. Variante A: Ability-Zone 1 leer; Variante B: Ability-Zone 1 = Charme ×2 (Zonen 0/2: Leadership/Wisdom).
- **Schritte:** Weird Doll spielen und in der Zielwahl die angebotene Ability „Toughness" wählen.
- **Erwartet** (Kartentext „Choose an Ability attached to a Hero you control and send it to the discard pile. Delete this card."; das Skript bietet Support-Zonen-Abilities ausdrücklich an, `_pushHeroAbilities` Z. ~203): Toughness wird abgelegt, Ability-Zonen unberührt, Doll gelöscht.
- **Beobachtet:** A) nichts passiert (`resolve` → „cancelled"; Doll bleibt auf der Hand, Toughness für den Doll unerreichbar). B) die **falsche** Karte: Charme (oberste Kopie der Ability-Zone 1) wird abgelegt, Toughness bleibt in der Support Zone, Doll wird gelöscht.
- **Repro:** `docs/niche-tests/repro/F03-artifacts/03-weird-doll-support-ability.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `weird-doll.js` `getValidTargets` baut die ID als `ability-<zoneOwner>-<heroIdx>-<slotIdx>`; der Support-Eintrag (`fromSupport: true`, `slotIdx` = Support-Slot) hat damit dieselbe ID-Form wie die Ability-Zone gleicher Nummer, und `resolve` (Z. ~85–100) liest nur `abilityZones[heroIdx][slotIdx]` – `fromSupport` wird nirgends ausgewertet.

### F03-04 · Snow Cannon ignoriert den Zielschutz von Thicket (und jeden Schutz über `untargetable_all`) · Stufe A
- **Karten:** Snow Cannon (`cards/effects/snow-cannon.js`), Thicket (`cards/effects/thicket.js`); Engine-Weg `normalizeValidTargets` (server.js)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Sitz 1 hat eine Kreatur (`ZZ Dummy Big`) auf dem Brett und spielt echtes Thicket auf sie; danach `t.endTurn()`, Sitz 0 am Zug spielt Snow Cannon.
- **Schritte:** Snow Cannon spielen, Zielwahl ansehen, die Thicket-Kreatur wählen.
- **Erwartet** (Thicket: „That Creature cannot be chosen by cards and effects until the beginning of your next turn."; Snow Cannon: „Choose a target your opponent controls and Freeze it"): die Kreatur ist nicht wählbar (Kontrollprobe ✓: The Yeeting bietet sie in seiner Zielwahl nicht an, die Nachbarkreatur schon).
- **Beobachtet:** Snow Cannon bietet die Kreatur ohne `ineligible`-Marke an (`hero-1-0..2` plus `equip-1-0-0`), die Wahl wird ausgeführt: Kreatur trägt `frozen` (Quelle Snow Cannon), obwohl `untargetable_all` noch steht.
- **Repro:** `docs/niche-tests/repro/F03-artifacts/04-snow-cannon-thicket.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** Snow Cannon baut seine Zielliste selbst (`getValidTargets`, kein Blick auf `counters.untargetable_all`) und läuft über die `potionTargeting`-Session. `normalizeValidTargets` (server.js ~11765) filtert dort nur Erst-Runden-Schutz, Seiten-Schild (`_isSideNondamageShielded`) und Taunt, **nicht** `untargetable_all`; die Marke wird nur in `promptEffectTarget` (_engine.js ~28015) und im Engine-Sammler (~40272) beachtet. Jedes Ziel-Artefakt/-Trank mit eigener Liste hat dieselbe Lücke (nicht einzeln durchgezählt; in meiner Gruppe sonst nur Snow Cannon betroffen).

### F03-05 · Super-Killing Knife: ein Knife-Kill zählt weder für Wanted Poster noch für Skullmael's Greatsword als „Held besiegt ein Ziel" · Stufe C
- **Karten:** Super-Killing Knife, the Tool of Liquidation (`super-killing-knife-the-tool-of-liquidation.js`), Wanted Poster (`wanted-poster.js`), Skullmael's Greatsword (`skullmael-s-greatsword.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Held 0 trägt Knife + Poster (bzw. Knife + Skullmael, Summoning Magic 3, `ZZ Dummy` in der Ablage); Gegner-Kreatur 1000 HP, Angriff 50 – nur das Knife kann sie töten. Kontrolle: dieselbe Konstellation ohne Knife gegen eine 10-HP-Kreatur.
- **Schritte:** Basis-Angriff des Helden auf die 1000-HP-Kreatur.
- **Erwartet** (Knife „Creatures that are hit by the Hero with an Attack are defeated."; Poster „Whenever the Hero defeats a target, draw 2 cards."; Skullmael „when the equipped Hero defeats a target with an Attack, you may immediately summon …"): naheliegende Lesart – der Held besiegt die Kreatur mit seinem Angriff, also Ziehen 2 bzw. Beschwörungs-Angebot. Gegenlesart: das Knife besiegt sie als eigener Effekt.
- **Beobachtet:** Kontrollen ✓ (Poster zieht 2, Skullmael bietet an). Mit Knife: Kreatur fällt, aber 0 Karten gezogen und kein Angebot.
- **Repro:** `docs/niche-tests/repro/F03-artifacts/05-knife-wanted-poster-skullmael.js` (✗ = Lesart „Held besiegt" wird nicht erfüllt)
- **Vermutete Ursache:** Das Knife tötet in `afterCreatureDamageBatch` per `actionDestroyCard(<Knife-Instanz>, opfer)`; die Quelle ist die Knife-Karte (Zone `support`). `wanted-poster.js` `_isHeroSource` verwirft jede Quelle mit `zone === 'support'` (gedacht für Kreaturen am Helden); Skullmael reagiert nur auf den Schadens-Batch des Angriffs. Kein Ruling dazu in CARD_API.md (nur Kohta, Z. 7874, kennt das Knife).
- **Frage an Al:** Soll ein Knife-Kill als „der Held besiegt das Ziel (mit einem Angriff)" gelten (Poster zieht 2, Skullmael löst aus) – ja oder nein?

### F03-06 · Treasure Hunter's Backpack umgeht „You can only play 1 'Smug Coin' per game" (liest den Stempel nicht, setzt ihn nicht) · Stufe B
- **Karten:** Treasure Hunter's Backpack (`cards/effects/treasure-hunter-s-backpack.js`), Smug Coin (`smug-coin.js`, `oncePerGame: true`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, 100 Gold; Deck beginnt mit einer zweiten Smug Coin. Fall A: Smug Coin zuerst aus der Hand spielen (Stempel gesetzt ✓), dann Backpack. Fall B: Backpack zuerst (holt Smug Coin), dann Smug Coin aus der Hand.
- **Erwartet** (Backpack „… play it immediately without paying its Cost"; Smug Coin „You can only play 1 'Smug Coin' per game."): das Backpack *spielt* die Karte, die Grenze gilt also – A) keine zweite Smug Coin wählbar; B) die Backpack-Smug-Coin stempelt, die Handkarte ist danach gesperrt.
- **Beobachtet:** A) Galerie bietet Smug Coin an und rüstet sie aus: **2 Smug Coins** auf dem Brett. B) Backpack-Smug-Coin setzt keinen Stempel (`_oncePerGameUsed` leer), die Handkarte wird danach ebenfalls gespielt (2 auf dem Brett). Gegenprobe ✓: die Je-Held-Grenzen (Wanted Poster, Vampiric Sword, Summoning Circle, Storm Piano, The Stormblade) werden über die Trägerprüfung eingehalten (Backpack unspielbar, wenn nur ein Held übrig ist, der die Karte schon trägt).
- **Repro:** `docs/niche-tests/repro/F03-artifacts/06-backpack-einmal-pro-spiel.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `treasure-hunter-s-backpack.js` `buildEligibleGallery` (Z. ~35–60) prüft Kosten, Subtyp und Träger (`ausruestTraegerMitSeite`), aber nicht `oncePerGame`/`ps._oncePerGameUsed`; der Ausrüst-Pfad (`ruesteAusStapelAus`/eigene Animation) stempelt nicht. Die Hand-/Server-Wege prüfen und stempeln (server.js ~7624/7697, ~11211).

### F03-07 · Slippery Fridge: bloßes Verschieben löst „sent to the discard pile" von Thunder Trumpet und Storm Piano aus · Stufe A
- **Karten:** Slippery Fridge (`slippery-fridge.js`), Thunder Trumpet (`thunder-trumpet.js`), Storm Piano (`storm-piano.js`); Helfer `_orchestra-shared.instrumentDiscardTrigger` (dritter Nutzer: `rain-viola.js`, nicht getestet)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, 100 Gold; Sitz 0 rüstet Thunder Trumpet bzw. Storm Piano an Held 0 aus und spielt Slippery Fridge → verschiebt die Ausrüstung an Held 1.
- **Erwartet** (Trumpet/Piano: „When this Artifact … is sent to the discard pile …"; die Ausrüstung bleibt auf dem Brett): kein Trigger beim Umhängen.
- **Beobachtet:** Trompete öffnet die Zielwahl „Thunder Trumpet" und macht 80 Schaden (Gegnerheld 800 → 720), obwohl sie nicht in der Ablage liegt; Piano setzt `damage_proof` auf Held 0 (Quellheld).
- **Repro:** `docs/niche-tests/repro/F03-artifacts/07-fridge-instrumente-feuern-beim-verschieben.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** Fridge Schritt 5a (`slippery-fridge.js` ~Z. 330) feuert `onCardLeaveZone` ohne `toZone`; `instrumentDiscardTrigger` (`_orchestra-shared.js:123`) deutet „kein toZone" als Ablage (Absicht für den Heldentod-Abbau, vgl. F03-01). Das Fridge muss `toZone: 'support'` mitgeben oder der Helfer den Zonenwechsel (`toHeroIdx`) erkennen.

### F03-08 · Slippery Fridge umgeht die Ausrüst-Regeln: Je-Held-Limits und gefrorene Zielhelden · Stufe B
- **Karten:** Slippery Fridge, Wanted Poster („A Hero can only have 1 'Wanted Poster' equipped to it."), Vampiric Sword („You can only equip 1 'Vampiric Sword' to any Hero.")
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, Gold reichlich. Held 0 und Held 1 tragen je ein Poster (bzw. Schwert); Fridge verschiebt das von Held 0 an Held 1. Variante F: Warhorse an Held 0, Helden 1 und 2 gefroren, Fridge verschiebt an Held 1.
- **Erwartet** (Fridge „equip them to a different Hero"; Regeln: `canEquipCardToHero` für Je-Held-Limits, `_hooks.heroCanBeEquipped` – tot/gefroren sperrt Ausrüsten): das Ziel wird nicht angeboten bzw. der Zug abgelehnt.
- **Beobachtet:** Held 1 trägt danach 2 Poster / 2 Schwerter (Anzahl je Held `[0,2,0]`); bei F liegt die Ausrüstung auf dem gefrorenen Helden.
- **Repro:** `docs/niche-tests/repro/F03-artifacts/08-fridge-ausruest-regeln.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `slippery-fridge.js` Schritt 3 (`destTargets`, Z. ~255–280) prüft nur `hero.hp > 0` und freie Zonen; weder `engine.canEquipCardToHero` (vgl. `_engine.js` ~15663/15709) noch `heroCanBeEquipped`. Gleiche Lücke bei den anderen Je-Held-Karten (Summoning Circle, Storm Piano `_stormPianoEquipped`, Race Boats …) – nicht einzeln durchprobiert.

### F03-09 · Slippery Fridge verschiebt genau eine Ausrüstung, der Kartentext sagt „any number" · Stufe B
- **Karten:** Slippery Fridge (`slippery-fridge.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Held 0 trägt Warhorse + The Master's Sword, Held 1 frei; Fridge gespielt.
- **Erwartet** (Kartentext in `data/cards.json`: „Choose **any number of** Artifacts equipped to a Hero and equip them to a different Hero the same player controls"): beide Ausrüstungen lassen sich in einem Zug an Held 1 hängen.
- **Beobachtet:** Wahlfenster mit `maxTotal: 1`, nur die erste Ausrüstung wandert (Held 0 behält die zweite).
- **Repro:** `docs/niche-tests/repro/F03-artifacts/09-fridge-any-number.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** Der Skriptkopf (`slippery-fridge.js` Z. 3–5, 188 „Moves exactly ONE Equip Artifact") beschreibt die ältere Textfassung („Choose an Equip Artifact … move it"); `resolve` (Schritt 2 mit `maxTotal: 1`, `pickedIds[0]`) wurde nicht auf „any number" angehoben. Kein Ruling in CARD_API.md, das die Einzelwahl festlegt (nur der Kommentar „Einfachauswahl: ein Klick TAUSCHT das Ziel").
- **Frage an Al:** Soll die Fridge wirklich mehrere Ausrüstungen (alle von einem Helden) gleichzeitig verschieben, wie der Kartentext sagt – ja oder bleibt es bei einer?

### F03-10 · The Eye of Ren: der 6-Gold-Freikauf hebt die harte Ablage-Sperre der Stäbe auf · Stufe B
- **Karten:** The Eye of Ren (`the-eye-of-ren.js`), Staff of Uncontrollable Destruction, Staff of the Teleporter
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, 100 Gold, `Fireball` in der Ablage. Beide Artefakte im selben Zug, in beiden Reihenfolgen (Auge→Stab, Stab→Auge; mit beiden Stäben, `keepActions`). Danach `engine.actionRecycleCards(0, ['Fireball'])` (Karte aus der Ablage ins Deck; läuft durch `_discardOutAllowed`).
- **Erwartet** (Stab: „You cannot draw or move any cards out of your discard pile for the rest of the turn."; Auge: „… unless you spend an additional 6 Gold."): die Stab-Sperre hat keine Ausnahme, die strengere Sperre gewinnt – nichts verlässt die Ablage.
- **Beobachtet:** In allen vier Fällen wird der Freikauf bezahlt (−6 Gold, Log `discard_lock_buyout`) und die Karte verlässt die Ablage. (Auf dem Weg `addCardFromDiscardToHand` wird zusätzlich erst bezahlt und dann durch die Hand-Sperre abgelehnt – 6 Gold ohne Wirkung.)
- **Repro:** `docs/niche-tests/repro/F03-artifacts/10-eye-of-ren-hebt-stab-sperre-auf.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** Die Stäbe stempeln nur `ps._discardLockedTurn` (`staff-of-uncontrollable-destruction.js:102`, `staff-of-the-teleporter.js:158`); `_discardOutAllowed` (`_engine.js` ~2566–2568) erkennt die „harte Sperre" nur am Fehlen von `ps._discardLockBuyout`. Das Auge setzt diesen Eintrag (`the-eye-of-ren.js:73`), kein Stab löscht oder neutralisiert ihn. CARD_API.md Z. 3760 nennt die Kombination nicht.

### F03-11 · The Stormblade: Treffer-Sturm mischt die gerade aufgelöste Gegner-Karte mit ins Deck (+1 Karte, Zauber nie in der Ablage) · Stufe B
- **Karten:** The Stormblade (`the-stormblade.js`); Engine `_handOhneAufloesendeKarte` (v1405) als nicht benutzter Helfer
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Sitz 0 rüstet The Stormblade an Held 0 aus; Sitz 1 hält [Fireball, Bird, Bird, Bird], Deck 20, trifft Held 0 mit dem Fireball (echter Spielweg `t.play(1, 'Fireball')`).
- **Erwartet** (Kartentext „… they must shuffle their entire hand back into their deck and draw the same number of cards afterwards"; die gespielte Karte zählt nicht zur Hand, vgl. CARD_API.md Z. ~19870 und `_handOhneAufloesendeKarte`): 3 Birds gemischt, 3 gezogen ⇒ Hand 3, Fireball regulär in der Ablage, nicht im Deck.
- **Beobachtet:** Der Sturm mischt 4 Karten (den noch in `ps.hand` liegenden Fireball inklusive) und zieht 4 ⇒ Hand 4, Ablage leer, **der Fireball liegt im Deck**. Der Gegner hat netto +1 Karte, der Zauber kann erneut gezogen werden. Kartenbilanz stimmt (nur anders verteilt), Audit sauber.
- **Repro:** `docs/niche-tests/repro/F03-artifacts/11-stormblade-mischt-aufloesende-karte.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `the-stormblade.js` `sturmzyklus` (Z. ~120) nimmt `engine.shuffleBackEligibleHandSlots(pi)` = alle Handplätze, ohne die auflösende Karte (`ps._resolvingCard`) auszunehmen; der Server findet nach der Auflösung keinen Handplatz mehr und überspringt Flug/Ablage. Dieselbe Lücke ist für jede „shuffle your entire hand"-Karte zu erwarten, die mitten in einer gegnerischen Auflösung feuert (Elana, nicht getestet).

### F03-12 · Sickly Cheese: bei giftimmunem Helden wird die Kost „inflict Poison" nicht gezahlt, die Suche läuft trotzdem · Stufe C
- **Karten:** Sickly Cheese (`sickly-cheese.js`); gleiche Bauart bei den Geschwistern Angry/Nerdy Cheese (nicht getestet)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, 100 Gold; Held 1 trägt den Buff `negative_status_immune` (Engine blockt negative Status, `_engine.js` ~44864); Deck: Accusation (Decay-Spell); Cheese gespielt, Held 1 gewählt.
- **Erwartet** (Kartentext „Choose a Hero you control and inflict 1 Stack of Poison to it **to play this card**. Choose a Decay Magic Spell …"; CARD_API.md Z. ~15726 nennt das Gift ausdrücklich eine KOSTE): Lesart A – wer die Kosten nicht zahlen kann, kann nicht spielen (Held nicht wählbar bzw. Karte bleibt auf der Hand). Lesart B – Kosten „versucht", Wirkung folgt trotzdem.
- **Beobachtet:** Lesart B: Log `status_blocked` und danach `poison_applied` (obwohl nichts angekommen ist), Held 1 nicht vergiftet, Accusation auf der Hand, Cheese in der Ablage, 4 Gold weg.
- **Repro:** `docs/niche-tests/repro/F03-artifacts/12-sickly-cheese-immuner-held.js` (✗ = Lesart A nicht erfüllt)
- **Vermutete Ursache:** `sickly-cheese.js` `resolve` (Z. ~70–90) ruft `addHeroStatus` ohne den Rückgabewert/den Blockierungs-Status zu prüfen; `getValidTargets` filtert immune Helden nicht.
- **Frage an Al:** Soll ein giftimmuner Held als Ziel für die Cheese gesperrt sein (Kosten nicht zahlbar), oder darf man die Suche „kostenlos" bekommen – gesperrt oder erlaubt?

### F03-13 · Staff of Illusions: unter 10 Gold unspielbar, auch wenn nur Level-0-Kreaturen (Kosten 0) wählbar wären · Stufe C
- **Karten:** Staff of Illusions (`staff-of-illusions.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; auf der Hand nur Staff + `Bird` (Level 0); Gold 0, 9, 10.
- **Erwartet** (Kartentext „This Artifact's Cost is multiplied by the Creature's level"; das Skript rechnet Level 0 selbst mit 0 Gold ab, Z. ~105 „a rebated Whoolmoth presented as Lv0 should also cost 0 gold"): bei jedem Goldstand spielbar, wenn eine Level-0-Kreatur zur Wahl steht.
- **Beobachtet:** Gold 0 und 9: nicht spielbar (Karte bleibt auf der Hand); Gold 10: spielbar, Kosten 0 (Gold bleibt 10).
- **Repro:** `docs/niche-tests/repro/F03-artifacts/13-staff-of-illusions-level-0-gold.js` (✗ = Lesart „wörtlich" nicht erfüllt)
- **Vermutete Ursache:** `canActivate` (Z. ~63): `if ((ps.gold || 0) < COST_PER_LEVEL) return false;` („at least 10 gold (level 1 minimum cost)") – ein Pauschalgate, das die Level-0-Kreatur nicht kennt.
- **Frage an Al:** Soll die Staff mit einer Level-0-Kreatur auch bei < 10 Gold spielbar sein (Kosten 0) – ja oder Mindestgold 10 beibehalten?

### F03-14 · Warhorse, The Master's Sword, Vampiric Sword: die Angriffs-Boni fehlen, wenn das Ziel eine Kreatur ist · Stufe A
- **Karten:** Warhorse (`warhorse.js`), The Master's Sword (`the-master-s-sword.js`), Vampiric Sword (`vampiric-sword.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, Held 0 (ATK 40) rüstet die Waffe aus und greift mit der Karte „Attack" (Schaden = ATK) ein einzelnes Ziel an: Gegner-Held 0 bzw. Gegner-Kreatur (1000 HP). Vampiric: Träger auf 400 HP vorverwundet.
- **Erwartet** (Warhorse „When the equipped Hero hits exactly 1 target with an Attack, that Attack's damage is increased by 50."; Master's Sword „… deals additional damage equal to its Attack stat when it hits a single target with an Attack."; Vampiric „whenever the equipped Hero deals damage to a target with an Attack, it heals for half the amount (rounded up)"): eine Kreatur ist ein Ziel – gleicher Bonus wie beim Helden (Schaden 90 / 100 / 50, Heilung 25). CARD_API.md Z. ~5755: „Boosters live on two hooks … Wiring only the hero side leaves the rule half-implemented."
- **Beobachtet:** gegen den Helden alles ✓ (90 / 100 / 50 + Heilung 25). Gegen die Kreatur: Schaden nur 40 / 50 / 50, keine Heilung – der Bonus fehlt in allen drei Fällen.
- **Repro:** `docs/niche-tests/repro/F03-artifacts/14-angriffsausruestung-ignoriert-kreaturenziele.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** Warhorse und Master's Sword hängen nur am `beforeDamage`-Hook (Heldenziele, `warhorse.js` ~Z. 62), Vampiric Sword nur an `afterDamage`; die Kreaturenseite (`beforeCreatureDamageBatch`/`afterCreatureDamageBatch`) fehlt. Hands of Big Gwen und das Knife lesen den Kreaturen-Batch und funktionieren (t07 D1 ✓). Auch die Schadensvorschau (`estimateDamageBonus`) dürfte für Kreaturenziele den Bonus zeigen oder nicht – nicht geprüft.

### F03-15 · Teal Fishing Rod: „not sent there this turn" nur am Namen geprüft – ein in diesem Zug erneut abgelegtes Exemplar ist angelbar · Stufe C
- **Karten:** Teal Fishing Rod (`teal-fishing-rod.js`); gleiche Logik bei Thep, the Court Scribe (nicht getestet)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, Sitz 0; Bird (Level 0) liegt seit Zugbeginn in der Ablage (nach echtem `t.endTurn()` ×2, Schnappschuss `{Bird}`). Der Bird wird per `actionPlaceCreature(…, { source: 'discard' })` aufs Feld gestellt (Muster Skullmael's Greatsword/Lone Survivor) und im selben Zug zerstört ⇒ liegt wieder in der Ablage.
- **Erwartet** (Kartentext: „… from your discard pile that **was not sent there this turn** …"): dieser Bird wurde in diesem Zug (erneut) in die Ablage gesendet und ist nicht wählbar. Kontrolle ✓: der Bird, der seit Zugbeginn unberührt liegt, ist wählbar.
- **Beobachtet:** Der Bird wird angeboten und aufs Feld geholt.
- **Repro:** `docs/niche-tests/repro/F03-artifacts/15-teal-fishing-rod-namens-schnappschuss.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `teal-fishing-rod.js` `kandidaten()` (Z. ~30–35) prüft `start.has(n)` am Namen (`ps._discardNamesAtTurnStart`, `_engine.js` ~22598, Set ohne Anzahl/Herkunft). Der Engine-Kommentar definiert „nicht in diesem Zug" ausdrücklich als „Name im Schnappschuss UND jetzt in der Ablage" – die Lücke ist dieselbe Karte, die im selben Zug herauskam und wieder hineinfiel.
- **Frage an Al:** Ist die Namens-Näherung gewollt (seltener Fall) oder soll die Rod zählen, wie oft der Name seit Zugbeginn dazukam (zweites Exemplar nicht wählbar) – Näherung behalten oder zählen?

### F03-16 · Wheels und die beiden Stäbe sind unter einer Zieh-Sperre spielbar: Kosten/Handverlust, kein Nachziehen · Stufe B
- **Karten:** Wheels (`wheels.js`), Staff of the Teleporter (`staff-of-the-teleporter.js`), Staff of Uncontrollable Destruction (`staff-of-uncontrollable-destruction.js`); Sperrquelle The Sacred Jewel (`drawLocked`) bzw. die Stäbe selbst (`handLocked`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, 100 Gold. Sitz 0 spielt im selben Zug erst The Sacred Jewel (Ja ⇒ beide ziehen 1, danach `drawLocked`) oder Staff of the Teleporter (⇒ `handLocked`), dann Wheels bzw. einen Stab mit [Bird ×3] auf der Hand.
- **Erwartet** (Regel `_draw-block-shared.js`-Kopf/CARD_API.md Z. ~15760: Karten, deren Nutzen das Ziehen ist, sind unter der Sperre unspielbar – „auch wenn dafür Kosten anfallen"; `staff-of-uncontrollable-destruction.js`-Kommentar: „Hand-lock greys-out: … the player has paid their entire hand for nothing"): die Karte ist ausgegraut bzw. kostet nichts.
- **Beobachtet:** (a) Wheels: −10 Gold, Draw 3 ⇒ 1 Karte abgelegt, Draw 4 ⇒ **2 Karten gelöscht**, 0 gezogen. (b) Nach dem Jewel: Staff of the Teleporter mischt die **ganze Hand** ins Deck (Hand 5 → 0), zieht nichts nach; Staff of Uncontrollable Destruction wirft die ganze Hand ab (Hand 5 → 0, Ablage +5), zieht nichts nach. Loader-Marken: Wheels `{}`; die Stäbe nur `blockedByHandLock` (liest nur `ps.handLocked`, nicht `ps.drawLocked`, server.js ~7526).
- **Repro:** `docs/niche-tests/repro/F03-artifacts/16-wheels-unter-zieh-sperre.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** Wheels trägt weder `blockedByDrawLock` noch `blockedByHandLock` (Auto-Erkennung `detectDrawOnly` sieht „Zieh-Karte mit Abwurfkosten" nicht als reine Zieh-Karte); `wheelsOptionen` filtert nur Tuscan Artist. Die Stäbe haben `blockedByHandLock`, aber kein `blockedByDrawLock` (nur dieses wird bei `drawLocked` gelesen, `server.js` ~7526/12124).

### F03-17 · Spice Mortar unter der Such-Sperre (Cats of the Pharaoh): Karte aus dem Gegnerdeck landet trotzdem auf der Hand · Stufe C
- **Karten:** Spice Mortar (`spice-mortar.js`, `blockedByPileLock: false`), Sperrquelle Cats of the Pharaoh (`ps.searchLocked`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Sitz 0 mit `searchLocked = true`; Gegner-Deck: Acid Vial unter den obersten 10 Karten.
- **Erwartet** (Cats of the Pharaoh: „you cannot search **or add cards to your hand** for the rest of the turn (but you can still draw)"; Spice Mortar: „Add a Potion from among those cards to your hand"): Lesart A – wörtlich gesperrt (der Mortar *fügt* der Hand eine Karte hinzu). Lesart B – die Sperre gilt nur für eigenes Deck/Ablage; CARD_API.md Z. ~15717 (Gruppe D: Add aus Brett/Gegnerhand „nicht betroffen") kennt den Griff ins Gegnerdeck nicht.
- **Beobachtet:** Lesart B: Mortar spielbar, Acid Vial auf der Hand; unter `handLocked` dagegen unspielbar, unter `drawLocked` spielbar (erwartet).
- **Repro:** `docs/niche-tests/repro/F03-artifacts/17-spice-mortar-such-sperre.js` (✗ = Lesart A nicht erfüllt)
- **Frage an Al:** Soll Spice Mortar (Karte aus dem Gegnerdeck auf die eigene Hand) unter Cats' „cannot search or add cards to your hand" gesperrt sein – ja oder nein?

### F03-18 · Staff of the Teleporter / Staff of Uncontrollable Destruction sperren mit `handLocked` auch Suchen und Hinzufügen, der Text sagt nur „draw" · Stufe C
- **Karten:** Staff of the Teleporter (`staff-of-the-teleporter.js` ~Z. 156), Staff of Uncontrollable Destruction (`staff-of-uncontrollable-destruction.js` ~Z. 100)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Sitz 0 spielt den Stab (Teleporter: nichts gewählt), danach im selben Zug einen Deck-Sucher: Sickly Cheese (Accusation im Deck) bzw. Spice Mortar.
- **Erwartet** (Teleporter: „You cannot draw cards or move any cards out of your discard pile for the rest of the turn."; CARD_API.md Z. ~15805: `handLocked` sperrt Draws **und** Suchen/Adds, `drawLocked` nur Draws; Jewel-Ruling „sperrt NUR Draws, NICHT Searches"): der Text nennt nur Ziehen und das Verschieben aus der Ablage – Suchen bleibt erlaubt.
- **Beobachtet:** `handLocked = true` ⇒ Cheese und Mortar nach dem Stab nicht spielbar (`r === false`). (Beim Uncontrollable-Lauf legt das Harness die vom Stab abgeworfene Suchkarte neu auf die Hand; die Sperre ist trotzdem gesetzt.)
- **Repro:** `docs/niche-tests/repro/F03-artifacts/18-staeabe-sperren-auch-suchen.js` (✗ = Lesart „nur Ziehen gesperrt" nicht erfüllt)
- **Vermutete Ursache:** Beide Stäbe benutzen den älteren Voll-Lock `ps.handLocked`; die schmalere Sperre `ps.drawLocked` kam später mit dem Sacred Jewel.
- **Frage an Al:** Sollen die Stäbe nur das Ziehen sperren (wie das Jewel; Suchen bleibt erlaubt) oder weiterhin auch Suchen/Hinzufügen – nur Ziehen oder auch Suchen?

### F03-19 · Item Lock (Hammer Throw): die Kosten „delete a card from your hand" können die gerade gespielte Artefakt-Karte selbst treffen · Stufe B
- **Karten:** alle Artefakte unter `ps.itemLocked` (getestet mit Treasure Chest, Snow Cannon, Wheels, Warhorse, Smug Coin, Summoning Circle, The Eye of Ren, Skull Necklace, Staff of Uncontrollable Destruction, Treasure Hunter's Backpack, Weird Doll, Spice Mortar); Quelle Hammer Throw (`itemLocked = true`); Code in `server.js` ~11323 / ~7654 / ~12226
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Sitz 0 mit `itemLocked`, Hand [Treasure Chest, Fireball]; Treasure Chest wird gespielt. Variante „Mensch": das Skript wählt im Kosten-Picker `forceDiscard` / „Item Lock Cost" die Treasure Chest. Variante „CPU" (Harness-Standard): die Engine wählt selbst.
- **Erwartet** (Hammer Throw: „The target's controller must delete a card from their hand whenever they play an Artifact"; Gate in server.js ~7464/12053 verlangt ≥ 2 Handkarten, also eine ANDERE Karte): die gespielte Karte ist keine Kostenkarte; der Picker bietet sie nicht an, gelöscht wird eine andere Handkarte, das Artefakt landet in der Ablage.
- **Beobachtet:** Der Picker (`eligibleIndices` undefiniert) listet die gespielte Karte mit (Roh-Hand [Treasure Chest, Fireball], `_resolvingCard` = Treasure Chest). Wird sie gewählt – bzw. wählt die CPU den ersten Platz –, wird das Artefakt selbst gelöscht: Fireball bleibt, die Chest fehlt in der Ablage, +10 Gold wirken trotzdem. In der Reihe oben löschen alle zwölf Artefakte so sich selbst (Handgröße 3 → 2, Deleted +1). Die Kosten sind damit praktisch gratis.
- **Repro:** `docs/niche-tests/repro/F03-artifacts/19-item-lock-kosten-loescht-gespielte-karte.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `actionPromptForceDiscard(pi, 1, { title: 'Item Lock Cost', deleteMode: true, … })` wird in den drei Server-Pfaden ohne `eligibleIndices`-Ausschluss der auflösenden Karte aufgerufen (`engine._istAufloesendeHandkarte`, `_engine.js` ~19630; Wheels und Live Show schließen sie selbst aus, s. `wheels.js` `buildEligibleIndices`).

### F03-20 · Treasure Chest unter der eigenen Gold-Sperre (Golden Arrow): spielbar, Karte wird wirkungslos verbrannt · Stufe B
- **Karten:** Treasure Chest (`treasure-chest.js`), Sperrquelle Golden Arrow (`_arrows-shared.js` ~302, `ps.goldLocked`); gleiche Lücke bei Karten, die denselben Helfer nutzen (Golden Bananas, War Chest …, nicht getestet)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, 100 Gold, `ps.goldLocked = true` (so setzt es Golden Arrow „You cannot gain or spend Gold for the rest of the turn afterwards"); Treasure Chest auf der Hand.
- **Erwartet** (Ruling Al 17.8., `_gold-block-shared.js` Kopf: „eine Karte, deren einziger Nutzen ein Gold-Gewinn ist, wird gesperrt statt wirkungslos zu feuern – Treasure Chest, Golden Bananas, War Chest …"; Chest-Skript: „Der Gewinn (10 Gold) IST die ganze Karte"): nicht spielbar, bleibt auf der Hand.
- **Beobachtet:** Chest wird gespielt (`r === true`), landet in der Ablage, Gold bleibt 100 (`gold_gain_blocked`).
- **Repro:** `docs/niche-tests/repro/F03-artifacts/20-treasure-chest-gold-sperre.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `goldGainWouldBeBlocked` (`_gold-block-shared.js` ~Z. 84) prüft nur den gegnerischen Tuscan Aristocrat (`blockerAufDemBrett`), nicht die eigene Spielersperre `ps.goldLocked`, die `actionGainGold` (`_engine.js` ~24065) durchsetzt.

## Abdeckung
| Karte | Tiefe | Geprüfte Nischenfälle / Anmerkung |
|---|---|---|
| Shield of Death | L2 gezielt | einmal je Zug (Reset über 4 Zugwechsel, beide Seiten am Zug) ✓, tödlicher Treffer / 0 Schaden / Eigenschaden / Gift-Tick kein Auslöser ✓, Träger gefroren/betäubt/negiert feuert ✓, Kreatur als Quelle ✓; durch Fridge verschoben unauffällig |
| Shield of Life | L2 gezielt | wie Shield of Death ✓ (Heilung auf eigenes Ziel, Abbruch erstattet) |
| Shield of Wisdom | L2 gezielt | Umleitung eines Kreatur-Effekts (Cannon Tower): Wirt/Kreatur im Support gewählt ✓, Angreifer-Kreatur nicht als Umleitziel ✓, Wirtsheld gefroren ⇒ kein Auslöser (Konvention) ✓, kein Umleitziel ⇒ Effekt läuft ✓ |
| Sickly Cheese | L2 gezielt | Stapel +1 ✓, Such-Sperre ⇒ unspielbar ✓, giftimmuner Held ✗(→ -12) |
| Skull Necklace | L2 gezielt | eigener/gegnerischer Zwangsabwurf und Delete: 50 bzw. 200 ✓, gestohlene Kreatur als Ziel ✓, Item-Lock-Kosten ✗(→ -19, Kostenwahl) |
| Skullmael's Greatsword | L2 gezielt | Galerie/Beschwörung ✓, Ablage-Sperre ✓, HOPT je Instanz ✓, Knife-Kill ✗(→ -05, C) |
| Slippery Fridge | L2 gezielt | Instrumente feuern ✗(→ -07), Je-Held-Limits/gefrorenes Ziel ✗(→ -08), „any number" ✗(→ -09); ATK-Waffen wandern korrekt ✓, Xalibur-Abilities fallen ✓ |
| Smug Coin | L2 gezielt | 799 / 800 / 5000 Fremdschaden ✓, Eigenschaden nicht gerettet ✓, Brand-Tick ✓, zweiter Treffer tödlich ✓, Löschung ✓, von Tool Freezer negiert ⇒ kein Stempel ✓; Backpack-Weg ✗(→ -06) |
| Snow Cannon | L2 gezielt | Thicket ✗(→ -04); Frost-Dauer Held/Kreatur (bis Ende der nächsten Runde des Opfers) ✓, immuner/gefrorener Held nicht angeboten ✓, von Tool Freezer negiert ✓ |
| Spice Mortar | L2 gezielt | Hand-/Zieh-/Such-Sperre, <10 Karten, Erstzug-Schutz ✓; Such-Sperre ✗(→ -17, C) |
| Spiky Armor | L2 gezielt | Held / Kreatur als Ziel ✓, tödlicher Treffer: Rückstoß = tatsächlich verlorene HP (30) ✓, Spell kein Auslöser ✓, zu wenig Gold ✓, Angreifer stirbt am Rückstoß ohne Spielende ✓, proaktiv nicht spielbar ✓ |
| Staff of Illusions | L2 gezielt | Rückkehr nach Gegnerzug ✓, gestohlene Illusion kehrt ins richtige Deck ✓, Summon-Sperre danach ✓; Level 0 / < 10 Gold ✗(→ -13, C) |
| Staff of the Teleporter | L2 gezielt | 0/n/alle gewählt (+1 bei ganzer Hand) ✓; ✗(→ -10, -16, -18) |
| Staff of Uncontrollable Destruction | L2 gezielt | Hand 0 / n ✓; ✗(→ -10, -16, -18) |
| Sticky Wand | L2 gezielt | Zusatzaktion ✓, zweite Wand im Zug abgelehnt ✓, Abbruch der Heldenwahl verbrennt HOPT nicht ✓, weitere Aktion danach möglich ✓ |
| Storm Piano | L2 gezielt | zweites Piano am Held / Held mit Merker abgelehnt ✓, HOPT ✓, `damage_proof` bis Ende der nächsten Runde ✓, Heldentod-Abbau ✓; Fridge ✗(→ -07) |
| Storm Ring | L2 gezielt | 3 Helden ⇒ negiert (Karte Ablage, 4 Gold) ✓, 1 Ziel / Held+Kreatur ✓, HOPT von Rain of Arrows nach Negierung bleibt ✓, zu wenig Gold ✓ |
| Strong Shield | L2 gezielt | 299 / 300 / 301 ✓, Kreatur ✓, Eigenschaden ✓ (quellenunabhängig), 7 Gold (Kosten 8) ✓, zwei Treffer / eine Karte ✓ |
| Summoning Circle | L2 gezielt | HP-Verdopplung bei Beschwörung ✓, anderer Held nicht ✓, 1 Kreis je Held ✓, Tod/Wiederbelebung ✓ |
| Summoning Instructions | L2 gezielt | X = 1/2/3 × Summoning Magic 0/1 gegen Lv 1–3 ✓ (Text ↔ Skript), Backpack-Weg fragt X ✓ |
| Super-Killing Knife, the Tool of Liquidation | L2 gezielt | +10 ATK / Abgang ✓, Kreaturentreffer fällt ✓, Held-Treffer nicht ✓; Poster/Skullmael ✗(→ -05, C) |
| Tea | L2 gezielt | Stati + Gift-Stapel wandern ✓, Zielliste ohne immunen Helden (Frost) ✓ |
| Teal Fishing Rod | L2 gezielt | Basis ✓ (Level 0, Zonenwahl), Snapshot-Namensprüfung ✗(→ -15, C) |
| The Brewer's Blade | L2 gezielt | 1× je Zug ✓, nur Attack (Spell nicht) ✓, anderer Held nicht ✓, leeres Potion Deck ✓ |
| The Eye of Ren | L2 gezielt | Freikauf ✓ (Gold, Ablehnung = Abbruch); ✗(→ -10) |
| The Great Wall of Deri | L2 gezielt | Eingang 5/10/11/15/25/100 ⇒ 5/10/10/10/15/90 ✓, zwei Mauern ✓, gestohlene Kreatur geschützt ✓ |
| The Hands of Big Gwen | L2 gezielt | Galerie ohne Attack ✓, 1× je Zug ✓, Ablehnung ⇒ erneut angeboten ✓, Ablage-Sperre ✓, Treffer auf Kreatur ✓ |
| The Master's Key | L2 gezielt | Aktionssperre/Negation bis Zugende ✓, zweiter Key abgelehnt ✓, nach gespielter Attack abgelehnt ✓, Rabatt 3 Decay-Level / Mindestkosten 0 ✓ |
| The Master's Sword | L2 gezielt | ✗(→ -14); gebannt, Seitenbindung fehlt (Hinweis, s. Zusammenfassung) |
| The Sacred Blade | L0 gelesen | `neverPlayable`, reine Deckbau-Klausel |
| The Sacred Jewel | L2 gezielt | Ja ⇒ beide ziehen, nur Wirker `drawLocked` ✓; Nein ⇒ Karte bleibt ✓; leeres Gegnerdeck ⇒ Sieg ✓; Erstrunden-Lücke = B-05 |
| The Sacred Mirror | L1 Standard | Deck 59/60 ⇒ unspielbar (Skriptentscheid), 61 ⇒ zieht 2 ✓, `drawLocked` ⇒ unspielbar ✓ |
| The Stormblade | L2 gezielt | Gegner-Treffer / eigene Aktion (1× je Zug), Ziehsperre umgangen ✓, leere Hand ✓; ✗(→ -11) |
| The Sun Sword | L2 gezielt | ✗(→ -02); Anlegen taut auf ✓, neue Kreaturen immun ✓, Brand überlebt Schwertverlust ✓ |
| The White Eye | L2 gezielt | ✗(→ -01); gestohlene Kreatur / übernommener Held: Controller verwirft ✓ |
| The Yeeting | L2 gezielt | Held 100 HP stirbt am Schaden, Wahl läuft weiter ✓, gestohlene Kreatur / Ausrüstung in die Ablage des Besitzers ✓, Thicket-Kreatur nicht wählbar ✓, Abbruch im zweiten Schritt = nichts passiert ✓ |
| Thicket | L2 gezielt | Zielschutz gegen Yeeting/Skull Necklace/Tea ✓, 2-Züge-Sperre ✓; Snow Cannon ✗(→ -04) |
| Thunder Trumpet | L2 gezielt | 80 Schaden, HOPT ✓, Heldentod-Abbau ✓; Fridge ✗(→ -07) |
| Tool Freezer | L2 gezielt | Kosten = 2× (Snow Cannon 10, Warhorse 16), unbezahlbar ⇒ keine Reaktion ✓, Kosten-0-Artefakt ✓, Equipment ⇒ Ablage ohne Stempel ✓ |
| Treasure Chest | L2 gezielt | +10 ✓, Item-Lock ✓; ✗(→ -20) |
| Treasure Hunter's Backpack | L2 gezielt | Je-Held-Limits (Poster, Sword, Circle, Piano, Stormblade) ✓, Träger-Aktionssperre ✓, Kostenschranke 50 ✓; ✗(→ -06) |
| Truth-Seeing Eye | L2 gezielt | wählt Thicket-Kreatur trotz Schutz ✓; Eye an anderem Held ohne Wirkung ✓ |
| Vampiric Sword | L2 gezielt | ⌈x/2⌉-Heilung (45 ⇒ 23) ✓, Deckel bei Max-HP ✓, 2. Schwert am Held abgelehnt ✓; gegen Kreatur ✗(→ -14) |
| Wanted Poster | L2 gezielt | 2 bei Kill, mehrere Kills, Kill eigener Kreatur ✓, 2. Poster abgelehnt ✓; Knife ✗(→ -05, C), Fridge ✗(→ -08) |
| Warhorse | L2 gezielt | +50 gegen Helden ✓; gegen Kreatur ✗(→ -14) |
| Weird Doll | L2 gezielt | ✗(→ -03) |
| Wheels | L2 gezielt | beide Modi, HOPT, Deck 2 ✓; Zieh-Sperre ✗(→ -16) |
| Xalibur | L2 gezielt | Abilities in Support Zonen, Abgang/Heldentod legt sie ab ✓, 2. Xalibur am Held ✓, Fridge ✓; Weird-Doll-Wahl ✗(→ -03) |

Querschnitt über alle 21 Ausrüstungen (Batterie `u25`): Ausrüsten auf toten Helden abgelehnt ✓, Heldentod legt in die Ablage des Besitzers (nicht des Kontrolleurs, auch bei dauerhaft übernommenem Helden) ✓, ATK-Boni werden zurückgenommen ✓, Wiederbelebung bringt keine Ausrüstung zurück ✓ (Ausnahme The White Eye ⇒ -01), voller Held lehnt Ausrüstung ab ✓; Item Lock/`_artifactLockTurn` ✗(→ -19), `_artifactLockTurn` verweigert alle zwölf getesteten Artefakte ✓.

## Getestet & in Ordnung (Auswahl)
- **Reaktions-Artefakte** (Strong Shield, Spiky Armor, Storm Ring, Tool Freezer, Shield of Wisdom): Schwellen (299/300), Mehrfachtreffer, Kreatur als Ziel, zu wenig Gold, proaktiv nicht spielbar, Rückstoß = tatsächlich verlorene HP, Ring zählt tatsächliche Ziele (1 Ziel / 2+), Tool-Freezer-Kosten 2× und Negierung ohne Stempel.
- **The Great Wall of Deri**: Reduktion −10 mit Boden 10 (kein Anheben kleiner Schläge), Stapelung zweier Mauern, gestohlene Kreaturen bleiben geschützt.
- **Smug Coin**: 799 vs. 800 vs. 5000, Eigenschaden nicht gerettet, Brandtick gerettet, Münze gelöscht (Deleted Pile), zweiter tödlicher Treffer tötet.
- **Schilde** (Death/Life): „first time every turn" über vier Zugwechsel auf beiden Seiten, kein Auslöser bei tödlichem Treffer, 0 Schaden, Eigenschaden, Gift-Tick.
- **Instrumente**: Piano/Trompete HOPT, Heldentod-Abbau, `damage_proof`-Laufzeit; Vampiric Sword Rundung/Deckel; Brewer's Blade nur bei Attack, einmal je Zug, anderer Held ohne Wirkung.
- **Gold/Zieh-Sperren**: Staffs' Locks laufen mit dem Zugwechsel aus; Sacred Jewel sperrt nur den Wirker; Sacred Mirror Schwelle 60/61.
- **Ausrüstungs-Lebenszyklus** aller 21 Ausrüstungen (Tod, Wiederbelebung, dauerhafte Übernahme des Trägers, volle Zonen, toter Zielheld) ohne Engine-Fehler, ohne Audit-Meldung, Kartenbilanz bleibt.
- **Truth-Seeing Eye / Thicket**: Eye ignoriert den harten Zielschutz, aber nur für den eigenen Träger.
- **Zwei Blindgänger der Vorrunde** (Test-Artefakte, kein Befund): „Instructions X=2/3 kein Platz" (Brettgeometrie im Aufbau) und „Sickly Cheese: Karte in `deletedPile` bei Item Lock" (Harness-CPU wählt Platz 0; Ursache = -19).
