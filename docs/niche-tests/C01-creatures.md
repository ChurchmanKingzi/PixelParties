# C01-creatures – Nischenfall-Bericht
Stand/Autor: Agent C01-creatures, 12.10.2026. Karten: 21 in der Liste · (wird am Ende ergänzt) gezielt getestet · (wird am Ende ergänzt) mit Befund.

## Zusammenfassung
(wird am Ende ergänzt)

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

## Abdeckung
(wird am Ende ergänzt)

## Getestet & in Ordnung (Auswahl)
(wird am Ende ergänzt)
