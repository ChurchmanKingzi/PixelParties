# C01-creatures – Nischenfall-Bericht
Stand/Autor: Agent C01-creatures (Teil 1 Vorgänger, Fortsetzung 13.10.2026). Karten: 21 in der Liste · 21 gezielt getestet (L2) · 15 mit Befund (17 Befunde: 0× A, 12× B, 5× C).

## Zusammenfassung
17 Befunde (A: 0, B: 12, C: 5), alle mit ausgeführtem Repro unter `docs/niche-tests/repro/C01-creatures/` (✗ = Fehler tritt auf). Keine Abstürze, keine Hänger, keine verschluckten Engine-Fehler, `audit()` und Kartenbilanz blieben in allen Läufen sauber.
Wichtigste Befunde:
* **Angler Angel (C01-10/-11)** erhöht bei Flächenschlägen von Kreaturen mit gemischten Zielen (Cavalry, Yuki-Onna, Assault Eagle) nur das erste Ziel bzw. die erste Zielart (Gangster Angel zeigt die richtige Lesart); die Antwort-Salve des Eagle bekommt den Bonus ein zweites Mal.
* **Gestohlene Kreaturen (C01-05/-06/-07)**: Cavalry und 500 Piranhas rechnen mit dem Kontrolleur statt mit der Brettseite (falsche Kreaturen getroffen, Piranhas verpufft oder landet auf der falschen Seite); Piranhas-Schaden folgt dem falschen Besitzer (C).
* **Einmal-/Mehrfachgrenzen (C01-02/-03/-12/-14)**: Ash Worms und Black Marketeer setzen „1 pro Zug/Spiel" nur auf einem Weg durch; ein Spearman-Negieren sperrt alle drei Nutzungen des 3-Headed Giant; das Forbidden-Grimoire leiht einen im Zug schon benutzten Cannon Tower.
* **Sperren und Konventionen**: Barkeeper ignoriert Hand-/Such-Sperre (C01-01), Squire/Albrecht ignorieren die Tuscan-Artist-Ziehsperre (C01-15), Cats of the Pharaoh ignoriert Kreatur-Tokens (C01-17), Creepy Villager behält „Control cannot change" auch negiert (C01-16), Coreling behält die Haste ohne Spirit (C01-09).
* Regelfragen an Al: C01-07 (Piranhas „its controller"), C01-08 (Squire ohne Heilung beschwörbar?), C01-11, C01-13, C01-14.
Gesamteindruck: Die Skripte sind in den Standardwegen (Aktivierung, HOPT, Abbruch, Tod gestohlener Kreaturen → Ablage des Besitzers, Heart-of-Ice-Staffeln, Bunny-Bombs-Ketten, Crum/Albrecht, Chosen-Sacrifice-Ersatz) solide; die Befunde liegen an den Übergängen (Kontrolle vs. Zone, gemeinsame Quellobjekte bei AoE, Engine-Sperren vs. Kartenzähler).
Bewusst nicht getestet: 3-/4-Spieler-Sitze, Charme/Treacherous-Crystal-Leihe, Erste-Runden-Immunität der Einsatz-Effekte (Yuki-Onna, Piranhas), Umleitungen (Test Dummy) und „Ziel verschwindet zwischen Wahl und Auflösung" für die Schadens-Kreaturen, Kopierer (Deepsea Monstrosity/Shapeshifter) – Gründe siehe Abdeckung.

## Befunde
### C01-01 · Barkeeper füllt die Hand auch unter Hand-/Such-Sperre auf · Stufe B
- **Karten:** Barkeeper (`cards/effects/barkeeper.js`), Zusammenspiel mit Cats of the Pharaoh (`searchLocked`) und allen `handLocked`-Karten (Ice Sculpture Garden, Kazena, Navigation, Rain of Spores).
- **Voraussetzungen / Aufbau:** Seed 1234. Teil A (echter Spielweg): Cats of the Pharaoh in der Ablage von Sitz 0, Sitz 0 ohne Kreatur und mit Summoning Magic Lv1; Hand [Barkeeper, Füllkarte]. Teil B: `ps.handLocked = true` (genau das setzt `ctx.lockHand()`).
- **Schritte:** A: 1. Sitz 1 beendet den Zug (`t.endTurn()`). 2. Cats-Angebot annehmen (Ja, Zonenwahl) → `searchLocked`. 3. Sitz 0 spielt Barkeeper, Ja auf „Pour". B: 1. `handLocked` setzen. 2. Barkeeper spielen.
- **Erwartet** (Cats: „you cannot search or add cards to your hand for the rest of the turn"; Ice Sculpture Garden/Kazena/Navigation: „You cannot draw or add cards to your hand for the rest of the turn afterwards"; Barkeeper: „add copies of „Beer" from outside the game to your hand"): Barkeeper ist spielbar, fügt aber keine Beer hinzu (Hinzufügen zur Hand ist gesperrt).
- **Beobachtet:** In beiden Fällen wird die Hand auf 7 aufgefüllt (A: 5 Beer, B: 6 Beer). Engine-Fehler: keine.
- **Repro:** `docs/niche-tests/repro/C01-creatures/01-barkeeper-ignoriert-hand-sperre.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `cards/effects/barkeeper.js:88` ruft `engine.handZugangSync(...)` direkt auf; weder `engine.handZugangGesperrt(pi)` noch `engine._isSearchBlocked(pi, …)` wird gefragt. Der Kommentar an `handZugang` (`_engine.js` ~11624) sagt ausdrücklich: „die Hand-Sperre prüft der Aufrufer". Andere Aufrufer tun das (`deepsea-treasure.js:83`, `krates-the-smartass.js:78`, `_opponent-deck-shared.js:54`).

### C01-02 · Ash Worms: „1 pro Zug" gilt nur im Rettungsweg, nicht für Handspiel und Mischformen · Stufe B
- **Karten:** Ash Worms (`cards/effects/ash-worms.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Sitz 0 mit Summoning Magic Lv1; Hand [Ash Worms], Ablage [Ash Worms]. Zonenwahl-Prompt wird mit der ersten Zone beantwortet.
- **Schritte:** A: 1. Ash Worms regulär aus der Hand spielen. 2. Im selben Zug die zweite Kopie aus der Ablage löschen (`engine.deleteFromPile(0,'discard','Ash Worms')`, Ja). B: zwei Ash Worms nacheinander aus der Hand spielen (Zusatzaktion simuliert, die Harness setzt die Aktion je `t.play` zurück).
- **Erwartet** (Kartentext: „You can only summon 1 „Ash Worms" per turn."): In einem Zug wird höchstens ein Ash Worms beschworen, gleich auf welchem Weg. Nach dem regulären Spielen wird die zweite Kopie also nur gelöscht (Rettung nicht möglich); das zweite Handspiel wird abgelehnt.
- **Beobachtet:** A: Die Rettung beschwört die zweite Kopie trotzdem (2 Ash Worms auf dem Brett, Gelöscht-Stapel leer, 1 Karte gezogen). B: beide Handspiele gelingen (2 auf dem Brett). Umgekehrt stempelt die Rettung nur `gs.hoptUsed['ash-worms:<pi>']`; ein danach gespieltes Ash Worms aus der Hand wird nicht gesperrt.
- **Repro:** `docs/niche-tests/repro/C01-creatures/02-ash-worms-limit-nur-im-rettungsweg.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `cards/effects/ash-worms.js:44-46` prüft den Stempel nur in `beforeDelete`; es gibt weder `canSummon` noch `beforeSummon` für die Beschwörung aus der Hand, und die Handbeschwörung setzt den Stempel nicht. Das Skript legt die Zeile „nur 1 Beschwörung je Zug und Spieler" ausdrücklich auf den Rettungsweg aus (Kopfkommentar) – der Kartentext sagt aber „summon" ohne Einschränkung.

### C01-03 · Black Marketeer: „1 pro Spiel" wird durch Platzieren per Effekt (Forceful Revival) umgangen · Stufe B
- **Karten:** Black Marketeer (`cards/effects/black-marketeer.js`), Forceful Revival (`cards/effects/forceful-revival.js`)
- **Voraussetzungen / Aufbau:** Seed 1234. Sitz 0 hat den Marketeer bereits beschworen (`ps._marketeerSummoned`, einer auf dem Brett), ein zweiter liegt in der Ablage; Held 0 mit Fighting Lv3, Hand [Forceful Revival].
- **Schritte:** 1. Forceful Revival spielen. 2. In der Galerie „Black Marketeer" wählen.
- **Erwartet** (Kartentext: „You can only summon 1 „Black Marketeer" per game."; Skript-Kopf: „Klausel 3 zählt JEDE Beschwörung von überall, auch durch Effekte"; Ruling 8.9. in CARD_API.md: Platzieren durch einen Effekt zählt als Effekt-Beschwörung): Der zweite Marketeer ist nicht platzierbar bzw. wird nicht angeboten.
- **Beobachtet:** Der zweite Marketeer wird platziert (2 auf dem Brett), seine On-Play-Klausel (Galerie „bis zu 5 Karten, 4 Gold je Karte") feuert ein zweites Mal. Gegenprobe im selben Aufbau mit Crum und Albrecht („You can only control 1" per `beforeSummon`): die zweite Kopie wird korrekt abgewiesen.
- **Repro:** `docs/niche-tests/repro/C01-creatures/03-black-marketeer-zweite-per-wiederbelebung.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `black-marketeer.js` benutzt `canSummon` (ein reiner Hand-/Galerie-Filter über `engine.isCreatureSummonable`, nur dort gefragt, wo ein Aufrufer ihn bewusst fragt); `actionPlaceCreature` und `forceful-revival.js _eligibleCreatureNames` fragen ihn nicht. `beforeSummon` (wie bei Crum/Albrecht) würde auch die Platzierung stoppen. Es gilt allgemein für jede „einmal pro Spiel/Zug summon"-Karte, die über `canSummon` gesperrt ist.

### C01-04 · Black Marketeer: identische Karten in der Ablage nur einmal wählbar · Stufe B
- **Karten:** Black Marketeer (`cards/effects/black-marketeer.js`)
- **Voraussetzungen / Aufbau:** Ablage von Sitz 0 = 5× „ZZ Filler" + Fireball + Heal; Hand [Black Marketeer].
- **Schritte:** 1. Marketeer spielen. 2. In der Mehrfach-Galerie alle angebotenen Karten wählen.
- **Erwartet** (Kartentext: „you may choose up to 5 cards from your discard pile, shuffle them back into your deck and gain 4 Gold per card"): bis zu 5 *Karten* – also fünf Kopien derselben Karte – sind wählbar (20 Gold). Andere Karten mit Ablage-Mehrfachwahl bieten dafür `count` an (`boomerang.js:72`, `lone-survivor.js:59`, `layn-master-of-deri-s-relic.js:149`, `_priest-shared.js:27`).
- **Beobachtet:** Die Galerie hat nur 3 Einträge (ein Eintrag je Name); es lassen sich höchstens 3 Karten recyceln (12 Gold), vier „ZZ Filler" bleiben in der Ablage. Dasselbe gilt für die HOPT-Klausel (1 Karte, dort unerheblich).
- **Repro:** `docs/niche-tests/repro/C01-creatures/04-black-marketeer-doppelte-karten-nicht-waehlbar.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `black-marketeer.js` `ablageGalerie()` (Z. ~56-66) entdoppelt mit einem Set und liefert `{ name, source }` ohne `count`.

### C01-05 · Cavalry trifft „Kreaturen in den Support Zones" nach Kontrolle statt nach Zone (gestohlene Kreaturen) · Stufe B
- **Karten:** Cavalry (`cards/effects/cavalry.js`), Zusammenspiel mit jedem Kreaturen-Diebstahl (`actionStealCreature`)
- **Voraussetzungen / Aufbau:** Seed 1234. Sitz 0: Cavalry (Held 0) und eine eigene Kreatur C in Held-0-Zone, die der Gegner gestohlen hat (physisch weiter auf Sitz 0, `controller` = 1). Sitz 1: Kreatur A in Held 0, Kreatur B in Held 0, die ich gestohlen habe (physisch weiter auf Sitz 1, `controller` = 0).
- **Schritte:** 1. Cavalry aktivieren (`t.activateCreature`). 2. Gegner-Held 0 wählen.
- **Erwartet** (Kartentext: „deal 50 damage to it and all Creatures in its Support Zones"): getroffen werden alle Kreaturen, die in den Support Zones von Gegner-Held 0 *liegen*: A und B. C liegt in meiner Zone und bleibt unversehrt (Vergleich: Whirlwind Strike wählt „Kreaturen in ihren Support Zones" nach `inst.owner`, also nach der Zone).
- **Beobachtet:** A und C nehmen 50, B bleibt heil – die eigene (vom Gegner gestohlene) Kreatur wird vom eigenen Cavalry getroffen, die gestohlene Kreatur in der Zone des Ziel-Helden nicht.
- **Repro:** `docs/niche-tests/repro/C01-creatures/05-cavalry-gestohlene-kreaturen-falsche-zone.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `cards/effects/cavalry.js:100` `creatureFilter: (inst) => (inst.controller ?? inst.owner) === tgtOwner && …` – bei gestohlenen Karten ist `controller` nicht die Brettseite (`engine.physicalSide(inst)`).

### C01-06 · 500 Piranhas: gestohlene eigene Kreatur als Opfer – Opfer fällt, Karte wird nicht gespielt bzw. landet auf der falschen Seite · Stufe B
- **Karten:** 500 Piranhas in a Monster Suit (`cards/effects/500-piranhas-in-a-monster-suit.js`)
- **Voraussetzungen / Aufbau:** Seed 1234. Sitz 1 hat eine Kreatur von Sitz 0 gestohlen (physisch in Sitz 0 / Held 1 / Slot 2, `controller` = 1). Hand [Piranhas]. Teil A: die gleichnamige Zone (Held 1 / Slot 2) auf der Gegnerseite ist belegt; Teil B: sie ist frei.
- **Schritte:** 1. Piranhas spielen. 2. Die gestohlene Kreatur als Opfer wählen.
- **Erwartet** (Kartentext: „Choose a Creature your opponent controls and defeat it to play this card. Place this Creature into the Support Zone the defeated Creature occupied."): Die gestohlene Kreatur ist eine legale Wahl („a Creature your opponent controls"); wird sie besiegt, kommt die Piranhas in genau die Zone, die sie belegte (meine Seite, Held 1 / Slot 2). Auf keinen Fall darf das Opfer fallen, ohne dass die Karte gespielt wird.
- **Beobachtet:** A: Opfer besiegt, Piranhas bleibt auf der Hand (Log `piranhas_fizzle: slot_reoccupied`; die Prüfung lief auf der belegten Gegnerzone) – Kosten bezahlt, kein Effekt. B: Opfer besiegt, die Piranhas landet in der gleichnamigen Zone der *Gegner*-Seite (Held 1 / Slot 2 des Gegners), nicht dort, wo das Opfer lag.
- **Repro:** `docs/niche-tests/repro/C01-creatures/06-piranhas-gestohlene-kreatur-als-opfer.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `500-piranhas-in-a-monster-suit.js:63-73` `_validVictims` filtert nach `controller`; `destHi/destSlot` (Z. 153) kommen von der Opfer-Instanz, die Prüfung `slotAfter` (Z. 182) und `engine.summonCreature(FULL_NAME, oi, destHi, destSlot)` (Z. 197) laufen aber auf `gs.players[oi]` (Kontrolleur) statt auf der Brettseite `engine.physicalSide(inst)`.

### C01-07 · 500 Piranhas: Schaden folgt dem Kontrolleur der Kreatur statt dem Kontrolleur des Wirtshelden · Stufe C
- **Karten:** 500 Piranhas in a Monster Suit (`cards/effects/500-piranhas-in-a-monster-suit.js`), Zusammenspiel mit `actionStealHero`
- **Voraussetzungen / Aufbau:** Seed 1234. Piranhas normal gespielt (Wirtsheld = Gegner-Held 0); danach übernehme ich den Wirtsheld (`actionStealHero(0, 1, 0)`). Vier echte Zugwechsel.
- **Erwartet** (Kartentext: „The corresponding Hero takes 80 damage at the end of each of its controller's turns."; Lesart A, „its" = der Held): Der Held steht unter meiner Kontrolle, also 80 Schaden am Ende *meiner* Züge.
- **Beobachtet:** Schaden fällt weiter am Ende der Züge des Gegners (je 80 nach Zug von Sitz 1, nie nach Zug von Sitz 0). Lesart B („its" = die Kreatur; Kontrolleur der Piranhas = Gegner) ist grammatisch ebenfalls möglich.
- **Repro:** `docs/niche-tests/repro/C01-creatures/07-piranhas-gestohlener-wirtsheld.js` (✗ = Lesart A nicht erfüllt)
- **Vermutete Ursache:** `500-piranhas-in-a-monster-suit.js:253` `if (!ctx.isMyTurn) return;` – `isMyTurn` gilt für den Kontrolleur der Piranhas; der Skriptkopf legt „its controller" auf die Kreatur aus.
- **Frage an Al:** Bezieht sich „its controller's turns" auf den Wirtsheld (dann wechselt der Schaden nach Heldendiebstahl auf meine Züge) oder auf die Piranhas (jetzt: bleibt beim Gegner)?

### C01-08 · Candlestick Squire: bei Brand auf dem Brett gibt es keine normale Beschwörung mehr (Heilung ist Pflicht) · Stufe C
- **Karten:** Candlestick Squire (`cards/effects/candlestick-squire.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Held 0 mit Summoning Magic Lv1, Hand [Squire]; Gegner-Held 0 ist verbrannt; Aktionsphase, Aktion unverbraucht.
- **Schritte:** 1. Squire spielen. 2. Hostzone wählen. 3. Die Zielwahl „Heal a Burned target" abbrechen.
- **Erwartet** (Kartentext: „You may choose a Burned target either player controls and heal it from its Burn to summon this Creature as an additional Action."): „may" beschreibt einen *alternativen* Weg; die gewöhnliche Beschwörung (Summoning Magic Lv1, 1 Aktion) sollte ohne Heilung weiter möglich sein.
- **Beobachtet:** Sobald irgendwo ein Brand liegt, ist die Karte „inhärent" und verlangt die Heilung; Abbruch = Squire bleibt auf der Hand, Aktion unverbraucht. Ein Weg „normal beschwören, Brand behalten" existiert nicht (Brand des Gegners kann nicht erhalten werden, wenn man Squire spielen will). Ohne Brand auf dem Brett klappt die normale Beschwörung. Alle gewollten Wege (Aktions-/Main-Phase, Held/Kreatur/eigener Held als Ziel) laufen sonst sauber (Brand weg, Squire platziert, Aktion unverbraucht, `audit` leer).
- **Repro:** `docs/niche-tests/repro/C01-creatures/08-candlestick-squire-kein-normaler-weg-bei-brand.js` (✗ = Lesart „normaler Weg bleibt" nicht erfüllt)
- **Vermutete Ursache:** `candlestick-squire.js:108` `inherentAction()` ist wahr bei jedem Brand; `beforeSummon` (Z. 149) erzwingt dann die Heilung. Der Skriptkopf legt das ausdrücklich so aus („falls back to the standard summon path" nur ohne Brand).
- **Frage an Al:** Soll Squire bei vorhandenem Brand weiterhin normal (1 Aktion, ohne Heilung) beschwörbar sein, oder ist „Brand heilen" bei vorhandenem Brand bewusst Pflicht?

### C01-09 · Coreling: „Haste" bleibt, wenn der Spirit im selben Zug das Brett verlässt · Stufe B
- **Karten:** Coreling (`cards/effects/coreling.js`), Spirit of the Ultimate Gun
- **Voraussetzungen / Aufbau:** Seed 1234. Spirit (alt) in einer Support Zone von Held 1; Coreling wird beschworen (bekommt `_hasHaste`), danach stirbt der Spirit (`actionDestroyCard`).
- **Schritte:** 1. Coreling beschwören (Haste gesetzt). 2. Spirit besiegen. 3. Coreling im selben Zug (Main Phase 2) aktivieren.
- **Erwartet** (Kartentext: „If you control „Spirit of the Ultimate Gun", this Creature may use this effect the turn it is summoned."): Ohne Spirit unter meiner Kontrolle gilt die Beschwörungsstarre wieder – die Aktivierung wird abgelehnt.
- **Beobachtet:** Der Spirit liegt in der Ablage, `_hasHaste` bleibt gesetzt, die Coreling feuert (50 Schaden). Die Marke wird erst beim nächsten `onPhaseStart` entzogen. (Dasselbe gilt, wenn der Spirit gestohlen wird.)
- **Repro:** `docs/niche-tests/repro/C01-creatures/09-coreling-haste-bleibt-nach-spirit-verlust.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `coreling.js` `onCardLeaveZone` (Z. ~227) und `onCreatureDeath` (Z. ~201) rufen nur `handLevelAbgleichen`, nicht `hasteAbgleichen`; die Rücknahme der Haste hängt an `onTurnStart`/`onPhaseStart`/`onCardEnterZone`.

### C01-10 · Angler Angel erhöht bei Flächenschlägen (`ctx.aoeHit`, gemischte Ziele) nur EIN Ziel/eine Zielart · Stufe B
- **Karten:** Angler Angel (`cards/effects/angler-angel.js`), betroffen als Täter: Cavalry, Cold-Hearted Yuki-Onna (beide `ctx.aoeHit`), Assault Eagle (`schlagen()` mit gemischten Zielen); Gegenprobe Gangster Angel.
- **Voraussetzungen / Aufbau:** Seed 1234. Sitz 0: Angler Angel + die Täter-Kreatur (alt, turnPlayed 1); Sitz 1: große Kreatur(en) in den Zonen der getroffenen Helden. Aktivierung in Main Phase 1; Yuki-Onna mit 2 Hearts of Ice.
- **Schritte:** 1. Täter-Kreatur wirken lassen (Cavalry auf Gegner-Held 0; Yuki-Onna beschwören; Eagle: erste Salve auf 2 Kreaturen + 1 Held). 2. Schaden je Ziel ablesen.
- **Erwartet** (Kartentext: „All damage your other Creatures inflict with their effects is increased by 50."; Ruling 20.8. im Kopf von `angler-angel.js`: „Angler erhoeht nur die erste Schadens-Instanz jeder Creature … Gangsters Schaden wird aber alles auf einmal zugefuegt, waere also komplett erhoeht."): Ein Flächenschlag ist EINE Schadensinstanz – alle Ziele bekommen +50. Cavalry: Held 100, Kreatur 100. Yuki-Onna: alle 150. Eagle: alle drei Ziele 150.
- **Beobachtet:** Gangster Angel (Gegenprobe): alle Ziele 60 (10 + 50) ✓. **Cavalry:** Held 100, Kreatur nur 50. **Yuki-Onna:** nur Held 0 bekommt 150, Held 1/Held 2 und die Kreatur 100. **Eagle** (2 Kreaturen + 1 Held): Kreaturen 150, Held 100 (bei umgekehrter Reihenfolge wäre es der Held). Es wird also jeweils nur das *erste* Ziel/die erste Zielart erhöht.
- **Repro:** `docs/niche-tests/repro/C01-creatures/10-angler-angel-flaechenschlag-nur-erstes-ziel.js` (✗ = Fehler tritt auf; enthält die Gangster-Gegenprobe)
- **Vermutete Ursache:** `ctx.aoeHit` → `engine.actionAoeHit(cardInst, …)` → `dealDamageToTargets(quelle = CardInstance, …)` (`_engine.js` ~45812): Helden werden mit der CardInstance als Quelle getroffen (`angler-angel.js istInstanzObjekt` ⇒ keine Gruppierung, jeder Treffer claimt die Rundensperre `angler-boost:<id>` einzeln – nur der erste gelingt), die Kreaturen mit einem frisch gebauten `quellObjekt`. Gangster Angel baut dagegen selbst EIN Literal-Quellobjekt für alle Ziele. Beim Eagle gehen Kreaturentreffer mit dem Literal `source`, Heldentreffer über `ctx.dealDamage` mit der Instanz – dieselbe Spaltung.

### C01-11 · Assault Eagle: die Antwort-Salve des Gegners erhält ebenfalls den Angler-Bonus · Stufe C
- **Karten:** Assault Eagle (`cards/effects/assault-eagle.js`), Angler Angel
- **Voraussetzungen / Aufbau:** Seed 1234. Sitz 0: Eagle + Angler Angel; Sitz 1 eine große Kreatur; Sitz 0 eine eigene große Kreatur (Ziel der Antwort).
- **Schritte:** 1. Eagle aktivieren, erste Salve auf die Gegner-Kreatur. 2. Der Gegner wählt in der Antwort die Kreatur von Sitz 0.
- **Erwartet** (Ruling 20.8. „Angler erhöht nur die erste Schadens-Instanz jeder Creature"; Kartentext: „Then, your opponent may choose … and deal 50 damage to them"): Salve 1 = 150, Antwort = 50 (zweite Schadensinstanz derselben Kreatur).
- **Beobachtet:** Salve 1 = 150, Antwort = 100 – die Antwort ist wieder +50.
- **Repro:** `docs/niche-tests/repro/C01-creatures/11-assault-eagle-antwortsalve-angler-bonus.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `assault-eagle.js` baut `const source = {…}` einmal (Z. ~122) und benutzt es in `schlagen()` für BEIDE Salven; `angler-angel.js darfErhoehen` wertet `quelle._anglerInstanz === turn` als „weiterer Treffer derselben gleichzeitigen Instanz".
- **Frage an Al:** Gilt die Antwort-Salve des Eagle (anderer Wähler, nach der ersten Salve) als zweite Schadensinstanz (kein Bonus) oder noch als Teil derselben (dann +50)?

### C01-12 · 3-Headed Giant: ein von Spearman negierter Aktivierungsversuch sperrt alle drei Nutzungen des Zuges · Stufe B
- **Karten:** 3-Headed Giant (`cards/effects/3-headed-giant.js`), Spearman (`cards/effects/spearman.js`); gilt allgemein für jede Kreatur mit mehreren Nutzungen je Zug, deren Aktivierung in der Kette negiert wird.
- **Voraussetzungen / Aufbau:** Seed 1234. Sitz 0: Giant (alt); Sitz 1: Spearman (alt). Main Phase 1; Zielwahl Gegner-Held 1; Spearman bestätigt.
- **Schritte:** 1. Giant aktivieren – Spearman negiert und sticht (50 Schaden auf den Giant). 2. Giant noch dreimal aktivieren.
- **Erwartet** (Kartentext Giant: „up to 3 times per turn"; Spearman: „negate that effect"): Die negierte Aktivierung ist EINE der drei Nutzungen; die Aktivierungen 2 und 3 laufen (je 80), erst die vierte wird abgelehnt (Spearman ist verbraucht).
- **Beobachtet:** Aktivierung 1 negiert, Aktivierungen 2–4 liefern `false` (Giant ist für den ganzen Zug gesperrt). Der Verbrauchszähler des Giant (`_ptuthreeHeadedGiantUsed`) steht weiter auf 0 – es ist die Engine-Sperre `gs.hoptUsed['creature-effect:<id>']`, die bei Negation gestempelt wird.
- **Repro:** `docs/niche-tests/repro/C01-creatures/12-3-headed-giant-spearman-sperrt-alle-nutzungen.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `server.js` `doActivateCreatureEffect`, Zweig „Negation path" (~Z. 9235-9255): `gs.hoptUsed[hoptKey] = gs.turn` ohne Rücksicht auf Karten mit eigenem Nutzungszähler (`canActivateCreatureEffect`/`chargesPerTurn`). Das Spearman-Skript sagt ausdrücklich „stempelt die Rundengrenze der negierten Creature" – für Einmal-pro-Zug-Kreaturen richtig, für „up to N times" ist die Sperre zu breit.

### C01-13 · 500 Piranhas: das Opfer ersetzt sich in derselben Zone (Cute Bird → Cute Phoenix) – Opfer verloren, Piranhas bleibt auf der Hand · Stufe C
- **Karten:** 500 Piranhas in a Monster Suit (`cards/effects/500-piranhas-in-a-monster-suit.js`), Cute Bird, Cute Phoenix (Auslöser; gilt für jeden Ersatz „in dieselbe Zone")
- **Voraussetzungen / Aufbau:** Seed 1234. Sitz 0: Hand [Piranhas]. Sitz 1: Cute Bird in Held 0 / Zone 0, 3 Handkarten, Cute Phoenix im Deck; Sitz 1 sagt Ja (wirft 2 Karten ab).
- **Schritte:** 1. Piranhas spielen, Cute Bird als Opfer wählen.
- **Erwartet** (Kartentext: „defeat it to play this card. Place this Creature into the Support Zone the defeated Creature occupied."): Unklar, was bei einer sofortigen Wiederbesetzung der Zone gelten soll – die Piranhas soll entweder nicht um den Preis des Opfers verpuffen, oder es ist ein bewusst hingenommenes Risiko.
- **Beobachtet:** Cute Bird ist besiegt (Ablage), Cute Phoenix hat den Platz, die Piranhas bleibt auf der Hand, die Einmal-pro-Zug-Sperre ist *nicht* gestempelt, die Aktion nicht verbraucht (Log `piranhas_fizzle: slot_reoccupied`). Der Spieler hat also eine Kreatur des Gegners getötet („Kosten") und die Karte nicht ausgespielt – kann sie aber im selben Zug erneut spielen (z. B. nun auf den Phoenix). Kein Engine-Fehler.
- **Repro:** `docs/niche-tests/repro/C01-creatures/13-piranhas-opfer-ersetzt-sich-selbst.js` (✗ = die Lesart „Opfer besiegt ⇒ Piranhas gespielt" ist nicht erfüllt)
- **Vermutete Ursache:** `500-piranhas-in-a-monster-suit.js` Z. ~178-189: bewusst „fizzle without claiming the HOPT" (Skriptkommentar), obwohl `actionDestroyCard` das Opfer schon beseitigt hat.
- **Frage an Al:** Wenn die Zone des Opfers sofort wieder belegt wird (Cute Bird → Phoenix): soll die Piranhas (a) auf der Hand bleiben (jetzt; Opfer ist gefallen, Karte nicht gespielt, nochmals spielbar), (b) in eine andere freie Zone des Gegners gelegt werden oder (c) abgelegt werden?

### C01-14 · Spirit of the Forbidden Grimoire leiht den Effekt eines im selben Zug schon benutzten Cannon Tower (Giant mit 3/3 wird dagegen ausgeschlossen) · Stufe C
- **Karten:** Cannon Tower (`cards/effects/cannon-tower.js`), Spirit of the Forbidden Grimoire (`spirit-of-the-forbidden-grimoire.js`, Gruppe C04); gilt für jede Kreatur, deren `canActivateCreatureEffect` konstant `true` liefert (Cannon Tower, Aggressive Town Guard, Coreling, Assault Eagle …).
- **Voraussetzungen / Aufbau:** Seed 1234. Sitz 0: Grimoire-Spirit (Held 2), Cannon Tower (Held 0), 3-Headed Giant (Held 1), alle alt. Main Phase 1; Ziel Gegner-Held 0.
- **Schritte:** A: 1. Tower normal aktivieren (150). 2. Grimoire aktivieren und den Tower wählen. B: Giant dreimal normal aktivieren (3/3), dann Grimoire.
- **Erwartet** (Tower: „You may once per turn …"; Grimoire: „use the active effects of up to 2 Creatures …"): Wenn „once per turn" jede Verwendung des Effekts bindet, ist der Tower nach dem ersten Einsatz nicht mehr wählbar – so wie der erschöpfte Giant.
- **Beobachtet:** A: Der Tower wird als wählbar angeboten und feuert über das Grimoire ein zweites Mal (150 + 150 in einem Zug). B: Der erschöpfte Giant wird nicht angeboten (hier ist das Grimoire mangels Ziel gar nicht aktivierbar). Je nachdem, ob eine Karte ihre Zuggrenze über ein eigenes `canActivateCreatureEffect` (Giant) oder über die Engine-Sperre `hoptUsed['creature-effect:<id>']` (Tower) ausdrückt, ist sie also leihbar oder nicht.
- **Repro:** `docs/niche-tests/repro/C01-creatures/14-grimoire-leiht-bereits-benutzte-kreatur.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `spirit-of-the-forbidden-grimoire.js sammleKandidaten` prüft `_effectLockedTurn` und `canActivateCreatureEffect`, nicht `engine.creatureEffectStillAvailable()` (`_engine.js` ~30956, prüft `hoptUsed`); `reactivateCreatureEffect` (`_engine.js` ~25180) verzichtet laut Kommentar bewusst auf den HOPT („geschenkte Wiederholung, kein zweiter regulärer Einsatz") – die Abgrenzung gegenüber den Karten mit eigenem Zähler ist inkonsistent.
- **Frage an Al:** Darf das Grimoire (und Kohta) den Effekt einer Kreatur wiederholen, die ihn in diesem Zug schon benutzt hat (jetzt: ja, nur bei Karten ohne eigenen Zähler), oder bindet „once per turn" auch die geliehene Verwendung?

### C01-15 · Tuscan Artist: Candlestick Squire (2/3 Brennende) und Albrecht (Stufe 2/3) bieten ihren negierten Zieh-Effekt an und verbrauchen die Einmal-pro-Zug-Sperre · Stufe B
- **Karten:** Candlestick Squire (`cards/effects/candlestick-squire.js`), Albrecht, the Nerd (`cards/effects/albrecht-the-nerd.js`), Tuscan Artist; Referenz: die 13 Karten, die `drawWouldBeBlocked` fragen (`_draw-block-shared.js`).
- **Voraussetzungen / Aufbau:** A: Seed 1234. Squire (alt) auf Sitz 0; Tuscan Artist auf Sitz 1; 2 bzw. 3 Brennende (Gegner-Helden); Main Phase 1. B: Albrecht (alt) auf dem Brett von Sitz 0; „Chaorc Interception" (Double Spell Lv2) wird der Hand hinzugefügt; Artist auf Sitz 1; Albrecht bestätigt.
- **Schritte:** A: 1. Squire aktivieren. B: 1. `onCardAddedToHand` für den Double Spell, Angebot „Reveal … to draw 2?" mit Ja beantworten.
- **Erwartet** (Kartentext Artist: „any effect that would allow your opponent to draw 2 or 3 cards is negated"; Ruling 16.8. im Kopf von `_draw-block-shared.js`: „Ist der Zug der einzige Nutzen … dann ist die Karte bzw. der aktive Effekt GESPERRT und wird ausgegraut. Ein Effekt, der so nicht feuern kann, verbraucht auch sein Once-per-turn NICHT."): A: Der Squire-Effekt (sein einziger Nutzen ist das Ziehen) ist bei N = 2 oder 3 nicht aktivierbar. B: Albrechts Angebot erscheint nicht (die Karte würde für ein negiertes Ziehen offengelegt), `albrecht-draw` bleibt frei.
- **Beobachtet:** A: Aktivierung gelingt, 0 Karten gezogen, Sperre gestempelt (N = 1 und 4 ziehen korrekt 1 bzw. 4). B: Angebot erscheint, die Karte wird offengelegt, 0 Karten gezogen, Sperre gestempelt.
- **Repro:** `docs/niche-tests/repro/C01-creatures/15-tuscan-artist-sperrt-squire-und-albrecht-nicht.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `candlestick-squire.js` `canActivateCreatureEffect` (Z. ~295) kennt nur die Zahl der Brennenden und ruft `drawWouldBeBlocked(engine, pi, min(4, n))` nicht; `albrecht-the-nerd.js aufDemBrett` (Z. ~47) prüft Level > 0 und Deckgröße, nicht `drawWouldBeBlocked(engine, pi, stufe)`.

### C01-16 · Creepy Villager: „Control … cannot change" gilt auch negiert / gefroren / betäubt · Stufe B
- **Karten:** Creepy Villager (`cards/effects/creepy-villager.js`, Vertrag `controlCannotChange`)
- **Voraussetzungen / Aufbau:** Seed 1234. Villager (alt) auf Sitz 0; Zustand normal / gefroren / betäubt / negiert; Sitz 1 ruft `actionStealCreature(1, villager)`.
- **Schritte:** 1. Villager in den Zustand versetzen. 2. Diebstahl versuchen.
- **Erwartet** (Kartentext: „Control of this Creature cannot change."; Engine-Konvention, vgl. B-01…B-03 und A05-04: eine stillgelegte Kreatur verliert ihre Texteffekte, `engine.isCreatureEffectSuppressed(inst)`): Normal scheitert der Diebstahl; bei negiertem (gefrorenem/betäubtem) Villager ruht der Schutz, der Diebstahl gelingt.
- **Beobachtet:** In allen vier Zuständen scheitert der Diebstahl (`isCreatureEffectSuppressed` = `true`).
- **Repro:** `docs/niche-tests/repro/C01-creatures/16-creepy-villager-kontrollschutz-trotz-negation.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_engine.js` `controlIsLocked(inst)` (~Z. 39052) liest nur `counters._controlLocked` bzw. `script.controlCannotChange`, ohne Stilllegungsprüfung; gelesen von `actionStealCreature`/`actionTransferCreature`. Der Skriptkopf sagt nichts zu Negation (B-querschnitt listet diesen Vertrag nicht unter den geprüften).

### C01-17 · Cats of the Pharaoh: „if you control no Creatures" ignoriert Kreatur-Tokens · Stufe B
- **Karten:** Cats of the Pharaoh (`cards/effects/cats-of-the-pharaoh.js`); Tokens „Mummy Token", „Invader Token", „Leprochaun Token" (`cardType: Token`, `subtype: Creature`, 50 HP).
- **Voraussetzungen / Aufbau:** Seed 1234. Sitz 0: Held 0 mit Summoning Magic Lv1, Cats in der Ablage, ein Mummy Token in Held 1 / Zone 0 (sonst leeres Brett). Zugwechsel: Sitz 1 beendet den Zug, Sitz 0 beginnt.
- **Schritte:** 1. Zugbeginn von Sitz 0 abwarten. 2. Auf das Cats-Angebot achten.
- **Erwartet** (Kartentext: „At the start of your turn, if you control no Creatures, you may summon this Creature from your discard pile …"; Konvention: Kreatur-Tokens zählen als Kreaturen, `hasCardType(cd, 'Creature')` in `_hooks.js` ~515 prüft auch den Subtyp): Sitz 0 kontrolliert mit dem Token eine Kreatur ⇒ kein Angebot.
- **Beobachtet:** Das Angebot erscheint (Ja/Nein, Zonenwahl), Cats wird beschworen und `searchLocked` gesetzt – obwohl der Token auf dem Brett liegt. Ohne Token verhält sich die Karte wie vorgesehen.
- **Repro:** `docs/niche-tests/repro/C01-creatures/17-cats-of-the-pharaoh-zaehlt-kreaturen-token-nicht.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `cats-of-the-pharaoh.js` `kontrolliertKreaturen` (Z. ~56): `(cd.cardType || '').toLowerCase() !== 'creature'` statt `hasCardType(cd, 'Creature')`.

## Abdeckung
| Karte | Tiefe | Geprüfte Nischenfälle / Anmerkung |
|---|---|---|
| 3-Headed Giant | L2 gezielt | 3 Nutzungen + 4. abgelehnt ✓, Abbruch stempelt nichts ✓, gefroren mitten im Zug ✓, Reset im nächsten Zug ✓, gestohlen (Dieb aktiviert) ✓, Tod gestohlen → Ablage des Besitzers ✓, mit Angler (nur 1. Schlag) ✓, Grimoire (erschöpft ausgeschlossen) ✓, Spearman-Negation ✗(→ -12) |
| 500 Piranhas in a Monster Suit | L2 gezielt | gestohlene Kreatur als Opfer ✗(→ -06), Wirtsheld gestohlen ?(→ -07), Opfer ersetzt sich (Cute Bird) ?(→ -13), Giant Exploding Skull als Opfer ✓, Tod gestohlen ✓ |
| Aggressive Town Guard | L2 gezielt | inhärente Aktion: erste Kreatur gratis (Action/Main 1) ✓, zweite nicht ✓, nach Forceful Revival nicht „erste" ✓, HOPT/Abbruch ✓, gestohlen aktiviert ✓, mit Angler (+50) ✓, Skull-Auslösung ✓; Prompt meldet Schadensart `normal` (tatsächlicher Schaden `creature`, folgenlos beobachtet) |
| Albrecht, the Nerd | L2 gezielt | Ressourcen-Ziehen → Beschwörung aus Hand (Ja/Nein/ohne SM/zweiter Albrecht) ✓, Crum-Tausch → Ziehen (Ja/Nein, kein Doppelangebot) ✓, Tuscan Artist ✗(→ -15) |
| Angler Angel | L2 gezielt | Giant (nur 1. Schlag) ✓, Tower/Guard ✓, Flächenschlag gemischt ✗(→ -10), Eagle-Antwort ?(→ -11), gefroren/betäubt/negiert ruht ✓ |
| Aquanian Orkallion | L2 gezielt | Area aus Deck holen (Acid Rain, Barrel Home) ✓, Abgang räumt alle Areas ✓, frozen/negiert → Hook ruht ✓, Mischen/Audit ✓; Gigalopolis und Bottomless Sand Hole haben kein Skript (nicht prüfbar) |
| Ash Worms | L2 gezielt | „1 pro Zug" nur im Rettungsweg ✗(→ -02); Rettung aus der Ablage ✓, Tod gestohlen → Ablage des Besitzers ✓ |
| Assault Eagle | L2 gezielt | 3 verschiedene Ziele/Antwort ✓, Eagle schießt auf sich selbst ✓, letzter Held fällt (Antwort läuft nach Spielende weiter, Ergebnis bleibt – nur beobachtet) ✓, gestohlen aktiviert ✓, Angler gemischt ✗(→ -10), Antwort-Bonus ?(→ -11) |
| Barkeeper | L2 gezielt | Hand-/Such-Sperre ✗(→ -01); Auffüllen bis 7 ✓ |
| Black Marketeer | L2 gezielt | zweite per Effekt ✗(→ -03), identische Karten nicht wählbar ✗(→ -04); On-Play nur für sich selbst ✓, HOPT-Klausel mit Gold-Sperre (Aristocrat) ✓ |
| Bomb Mite | L2 gezielt | Zündung erst am 2. eigenen Zugende ✓, gestohlen (Zündung für den Dieb, Ablage des Besitzers) ✓, Rückschlag nur bei Gegner-Täter (echter Fireball, destroy) ✓, eigener Fireball nicht anwählbar (Fireball nur Gegner-Ziele) – nicht prüfbar |
| Bunny Bombs | L2 gezielt | Zähler an jedem Zugende ✓, Kette zweier Bomben desselben/verschiedener Besitzer (Verlierer = Besitzer der äußeren Bombe) ✓, gelöscht statt besiegt: kein Knall ✓, gestohlen → Ablage des Besitzers ✓ |
| Candlestick Squire | L2 gezielt | inhärenter Weg (Held/Kreatur/eigener Held als Ziel, Main 1) ✓, Abbruch → Karte bleibt auf der Hand ✓, kein normaler Weg bei Brand ?(→ -08), Ziehen 1/4/Deck 2 ✓, Tuscan Artist ✗(→ -15) |
| Cannon Tower | L2 gezielt | HOPT, gestohlen aktiviert ✓, Angler ✓, zweistufiger Vertrag/Grimoire-Plan, gleiches Ziel doppelt (kein Fehler) ✓, Grimoire leiht bereits benutzten Tower ?(→ -14) |
| Cats of the Pharaoh | L2 gezielt | Angebot nur mit SM-Held/ohne Kreatur ✓, gefrorene/betäubte Helden → kein Angebot ✓, Sperre fällt nach 2 Zügen ✓, Kreatur-Tokens ✗(→ -17), Barkeeper darunter ✗(→ -01) |
| Cavalry | L2 gezielt | gestohlene Kreaturen in/außerhalb der Zone ✗(→ -05), gestohlener Gegner-Held (nicht anwählbar) ✓, Angler ✗(→ -10), Tod gestohlen ✓ |
| Chosen Sacrifice | L2 gezielt | Handersatz bei Archer of Teocuilatl ✓ (Karte → Ablage, Belohnung Gold/Karte, Board-Kreatur bleibt), mit Chaorc Corpse Cannibal in der Hand (kein Angebot, kein Fehler) ✓ |
| Cold-Hearted Yuki-Onna | L2 gezielt | 0/1/2/4 Hearts → Frost/Schaden/+2 Frost (Frostverlauf über 7 Zugwechsel) ✓, Hearts → Ablage des Beschwörers ✓, Angler gemischt ✗(→ -10) |
| Coreling | L2 gezielt | Handlevel 0 nach Kill ✓, inhärente Beschwörung in Main 1 (nur eine) ✓, Area 150 ✓, Haste ohne Spirit ✗(→ -09), gestohlen aktiviert ✓ |
| Creepy Villager | L2 gezielt | Austausch mit DDG (Zone/Aktionsfreiheit) ✓, Tod mit 0/1/3 Handkarten ✓, Diebstahl/Transfer verweigert ✓, Schutz trotz Negation ✗(→ -16); DDG „once per game" bereits in A02-15 gemeldet |
| Crum, the Class Pet | L2 gezielt | Tausch + Löschung am Zugende (Hand/Ablage/gespielt) ✓, Hand-Index verschiebt sich ✓, Albrecht-Kette ✓, gestohlen aktiviert ✓, `handLocked` sperrt den Tausch ✓, `searchLocked` (Cats) lässt ihn zu – gewollt, die Ablage bleibt offen (Kopf von `cats-of-the-pharaoh.js`, Al 14.9.), „only control 1" bei Platzierung ✓ (Gegenprobe in -03) |

## Getestet & in Ordnung (Auswahl)
* **Tod gestohlener Kreaturen** (alle 21 Karten, Besitzer vernichtet die gestohlene Kreatur): immer Ablage des Besitzers, nie des Diebes, Audit/Bilanz sauber. Creepy Villager lässt sich nicht stehlen (`actionStealCreature`/`actionTransferCreature` verweigert).
* **Dieb aktiviert gestohlene Kreaturen** (Giant, Tower, Guard, Cavalry, Coreling, Eagle, Squire, Crum): Kontrolleur handelt, Schaden/Zielwahl aus Sicht des Diebes, keine Engine-Fehler.
* **Giant**: 3 Nutzungen/Zug, 4. abgelehnt, Abbruch stempelt nicht, Frost mitten im Zug sperrt, Reset im nächsten eigenen Zug.
* **Heart of Ice / Yuki-Onna**: 1 Heart = Frost (1 Gegnerzug), 2 = +100 Schaden, 4 = 3 Gegnerzüge Frost (Helden und Kreaturen gleich), Hearts wandern in die Ablage des Beschwörers.
* **Bomb Mite**: Zündung erst am Ende des zweiten eigenen Zuges; gestohlen zündet sie am ersten Zugende des neuen Kontrolleurs (wörtlich nach „your next turn after summoning"); Rückschlag bei Gegner-Spell (echter Fireball), nicht bei eigener Quelle.
* **Bunny Bombs**: Kette zweier Bomben (Schaden = Summe der Zähler), Verlierer bei Gleichstand = Besitzer der äußeren Bombe, gelöschte Bombe knallt nicht.
* **Crum**: Tausch löscht die Karte am Zugende aus Hand oder Ablage (auch nach dem Spielen), Marke wandert mit der Hand; **Albrecht**: je Instanz einmal pro Zug, kein Doppelangebot bei „Nein".
* **Aquanian Orkallion**: holt eine Area (Deck gemischt), Abgang räumt alle Areas (auch fremde), gefrorene/negierte Orkallion nicht.
* **Chosen Sacrifice** als Hand-Ersatz bei Archer of Teocuilatl: Gold+Gold, Karte in der Ablage, Board-Kreatur bleibt.
* **Giant Exploding Skull** wird von allen Schadens-Kreaturen der Gruppe (Typ `creature`) und von der Piranhas-Zerstörung ausgelöst.
* **Beobachtungen ohne Befund**: Handsperre + Squire-Aktivierung zieht nichts, verbraucht aber die Sperre (Kreaturen sind von der Zieh-Sperren-Auto-Erkennung ausgenommen, nur Tuscan Artist hat ein dokumentiertes Ruling → -15); Assault Eagle: nach dem tödlichen ersten Schlag läuft die Antwortwahl weiter, das Ergebnis bleibt zugunsten des Wirkers.
