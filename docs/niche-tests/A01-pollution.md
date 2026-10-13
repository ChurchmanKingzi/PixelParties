# A01-pollution – Nischenfall-Bericht
Stand/Autor: Agent A01-pollution (Fortsetzung nach Abbruch des Vorgängers), 13.10.2026. Karten: 49 in der Liste · 49 gezielt getestet (alle L2, davon einige nur mit einem Standardfall + Skriptlektüre) · 35 mit Befund · 38 Befunde (9 × A, 22 × B, 7 × C).

## Zusammenfassung
* **38 Befunde:** 9 × A (Fehler), 22 × B (wahrscheinlicher Fehler), 7 × C (Regelfrage, je mit Frage an Al). Alle mit ausgeführtem Repro unter `docs/niche-tests/repro/A01-pollution/`.
* **Wichtigste Fehler:** Spontaneous Reappearance beendet den Zug nicht (-01) · Doom Prophecy lässt die Zauberkarte beim Legen der Uhr in die Gegner-Area verschwinden (-07) · Reality Crack verdoppelt eine Area in der Ablage, wenn das Area-Limit währenddessen sinkt (-12) · The Fifth Circle verdoppelt bei Mehrziel-Treffern den ersten Helden (-21) · Rain of Death, Mass Multiplication (Abbruch), Pyroblast (zweite Kopie), Doom Clock (Mehrfachtod) und Null Zone (Dauer) weichen vom Kartentext ab (-02…-05, -18).
* **Neu in der Fortsetzung (-29…-38):** Royal Corgi gibt dem Besitzer statt dem Kontrolleur das Handlimit (-29) · Pollution Spewer stempelt „1 pro Zug“ nach Position (-30) · Anti Magic Enchantment greift nur bei Schaden, nicht bei Cold Coffin/Medusa/Null Zone (-31) · Circle-Replays (Dante/Third Circle) umgehen Eraser-Beam- und Reality-Crack-Sperre (-32) · Pollution Piranha: Abgangseffekt bei Diebstahl stumm, beim Versetzen fälschlich (-33) · Sun Beam mit Ziel-ID nach Besitzer → falsche Kreatur (-34) · Mass Multiplication und Spontaneous Reappearance ignorieren Such-/Hand-Sperre (-35, -37), Deck-Suchen aufs Brett ebenfalls (-36, Regelfrage) · 20. Doom Counter vs. Archer-Schuss (-38, Regelfrage).
* **Klassen, die sich durch die Gruppe ziehen:** (1) Negierung/Abbruch und „Kosten vor oder nach der Kette“ (-03, -14, -17, -23); (2) „Besitzer ODER Kontrolleur / Brettseite“ (-29, -30, -33, -34, dazu die bekannte Wurzel F02-14 mit The Seventh Circle bestätigt); (3) Sperren, die ein Kartenskript nicht liest (-25, -27, -32, -35, -36, -37); (4) Engine-Lücken im Schutz (-09 Warrior/Statusfenster, -31 AME). Details unten bei „Prüfaufträge“.
* **Gesamteindruck:** Die Archetyp-Mechanik trägt (Doom-Counter-Kosten, Soul-Shard-Reihenfolgen, Hell-Circles-Kette, Dante, Thep, Victorica, Big Gwen, Ib/Ren/Shut/Khet ✓). Die Befunde konzentrieren sich auf Ränder: Abbruch/Negation, fremde Kontrolle und Sperren.
* **Bewusst nicht getestet:** 3-/4-Spieler-Varianten, Skill-Test-Modus, Animationen/Protokoll-Verträge (Familie 11), `cpuResponse`-Zweige, Token-Platzierung auf geliehenen Helden-Zonen während der Gegner-Zug (Magic Mirror/Acid Rain mit entführtem Helden), Hero-AME bei übernommenem Helden (Angebot geht an den Verzauberer, nicht an den Kontrolleur – nur im Code gelesen), Siege/Cats als echte Sperrquellen (Flag `searchLocked` direkt gesetzt, wie Cats es tut).

## Befunde

### A01-pollution-01 · Spontaneous Reappearance beendet den Zug nicht · Stufe A
- **Karten:** Spontaneous Reappearance (`cards/effects/spontaneous-reappearance.js`); Vergleich Tuscan Prisoner (Ruling 16.8.)
- **Voraussetzungen / Aufbau:** `H.fresh`, Spontaneous Reappearance auf der Hand von Sitz 0, Ablage [Fireball, Heal, Fireball], Aktionsphase; alle drei Karten werden gewählt.
- **Schritte:** 1. `t.play(0, 'Spontaneous Reappearance')`, im Mehrfach-Dialog alle 3 Karten wählen. 2. Zustand nach der Auflösung lesen.
- **Erwartet** (Quelle: Kartentext „…This counts as an additional Action. Immediately end your turn afterwards.“; Ruling `tuscan-prisoner.js` Kopf, 16.8.: „Doom Prophecy, Tanuki Escape, Spontaneous Reappearance, Rebelliokai Terror Tengu und Phoenix Bombardment enden den Zug nicht mehr“ – d. h. die Karte beendet sonst den Zug): Nach der Auflösung endet der Zug (Sitz 1 am Zug, Zugnummer +1), wie bei Great Offensive / Tanuki Escape über `gs._spellEndsTurn = true`.
- **Beobachtet:** 3 Karten auf der Hand, 2 Tokens (korrekt), aber Sitz 0 bleibt am Zug (Zugnummer 5, Phase 3). Weder `_spellEndsTurn` noch `_terrorForceEndTurn` wird gesetzt. Eine Gegenprobe mit Great Offensive (setzt `_spellEndsTurn`) beendet den Zug in derselben Harness.
- **Repro:** `docs/niche-tests/repro/A01-pollution/01-spontaneous-reappearance-endet-zug-nicht.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `cards/effects/spontaneous-reappearance.js` (Kopfkommentar „No auto-end-turn: the player continues their turn normally“, kein `gs._spellEndsTurn = true` in `onPlay`). Der Kommentar ist kein Ruling („Als Ruling …“ steht dort nur zur Suchsperre); er widerspricht dem Kartentext.

### A01-pollution-02 · Rain of Death: Tokens für ALLE gegnerisch entfernten Abilities statt nur für den Überschuss · Stufe A
- **Karten:** Rain of Death (`cards/effects/rain-of-death.js`)
- **Voraussetzungen / Aufbau:** beide Seiten Held 0 = Dante (Startfähigkeiten Destruction Magic + Luck); eigene Abilities: Destruction Magic ×3 + Luck ×1 (2 überzählig), Gegner: Destruction Magic ×3 + Luck ×3 (4 überzählig); Rain of Death auf der Hand, `noGrant`.
- **Schritte:** 1. `t.play(0, 'Rain of Death')`. 2. Pollution Tokens auf Sitz 0 zählen. Variante 2: ich 4 überzählig, Gegner 1. Variante 3: beide 4, nur 1 freie Zone.
- **Erwartet** (Quelle: Kartentext „Place 1 Pollution Token into your free Support Zones for every one of your opponent's removed Abilities in excess of the number of your removed Abilities“): Tokens = max(0, gegnerisch entfernt − eigene entfernt) → Fall 1: 2, Fall 2: 0, Fall 3: 0 Tokens, also auch bei 1 freier Zone spielbar.
- **Beobachtet:** Fall 1: 4 Tokens (alle gegnerischen), Fall 2: 1 Token, Fall 3: Karte unspielbar (bleibt auf der Hand, weil `spellPlayCondition` die rohe Zahl der gegnerischen Abilities mit den freien Zonen vergleicht). Das Abziehen der eigenen entfernten Abilities fehlt komplett; der Kopfkommentar im Skript beschreibt dieselbe verkürzte Lesart („1 Token for every OPPONENT Ability that was removed“).
- **Repro:** `docs/niche-tests/repro/A01-pollution/02-rain-of-death-tokens-ohne-ueberschuss.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `cards/effects/rain-of-death.js` – `spellPlayCondition` (`oppRemovable.length <= countFreeZones`) und `onPlay` (`placePollutionTokens(engine, pi, oppRemovable.length, …)`); statt `oppRemovable.length` müsste `Math.max(0, oppRemovable.length - myRemovable.length)` gelten.

### A01-pollution-03 · Mass Multiplication: Abbruch der Kartenwahl lässt den Pollution Token liegen · Stufe A
- **Karten:** Mass Multiplication (`cards/effects/mass-multiplication.js`)
- **Voraussetzungen / Aufbau:** Sitz 0: Mass Multiplication + Fireball auf der Hand, 4 Fireball im Deck; Aktionsphase. Im Galerie-Dialog „Mass Multiplication“ wird abgebrochen (Antwort `{cancelled:true}` = der Abbrechen-Knopf).
- **Schritte:** 1. `t.play(0, 'Mass Multiplication')`. 2. Galerie abbrechen. 3. Hand und Brett prüfen.
- **Erwartet** (Quelle: Regel 23.9. in `CARD_API.md`: „Jede Zielwahl hat einen Cancel-Button … Abbruch heißt: nichts ist passiert. Die Karte bleibt auf der Hand, die Aktion wird erstattet“; Kartentext: der Token ist Kosten „to play this card“): nach dem Abbruch liegt kein Token auf dem Brett.
- **Beobachtet:** Die Karte bleibt auf der Hand (richtig), aber 1 Pollution Token liegt auf dem Brett (Handlimit −1). Jeder Abbruch + Wiederspielen legt einen weiteren Token. Cold Coffin/Eraser Beam lösen das Problem anders (Kosten über `payActivationCost` vor der Kette, danach ist die Zielwahl bewusst nicht abbrechbar); Mass Multiplication hat beides: Kosten vor der Wahl und einen Abbrechen-Knopf.
- **Repro:** `docs/niche-tests/repro/A01-pollution/03-mass-multiplication-abbruch-laesst-token.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `cards/effects/mass-multiplication.js` – `placePollutionTokens(...)` am Anfang von `onPlay`, vor `promptGeneric({type:'cardGallery', cancellable: true})`; Abbruchzweig setzt nur `gs._spellCancelled = true`.

### A01-pollution-04 · Pyroblast: zweite Karte im selben Zug ist spielbar und verpufft · Stufe A
- **Karten:** Pyroblast (`cards/effects/pyroblast.js`)
- **Voraussetzungen / Aufbau:** Sitz 0: 2× Pyroblast auf der Hand, Aktionsphase; Zielwahl skriptet Gegner-Held 0.
- **Schritte:** 1. `t.play(0, 'Pyroblast')` (100 Schaden, 1 Token). 2. Noch einmal `t.play(0, 'Pyroblast')` im selben Zug (Aktionszähler zurückgesetzt, wie es eine Zusatzaktion oder die nächste Phase täte).
- **Erwartet** (Quelle: Kartentext „You can only play 1 „Pyroblast“ per turn“; Vergleich Rain of Arrows / Core Explosion / Laser Volley, die den Zugstempel `gs.hoptUsed` in `spellPlayCondition` prüfen): die zweite Pyroblast ist nicht spielbar und bleibt auf der Hand.
- **Beobachtet:** `doPlaySpell` gibt `true` zurück, die zweite Karte verlässt die Hand und liegt in der Ablage, ohne Wirkung (Gegner-HP unverändert, kein Token). Die Sperre steht erst in `onPlay` (`if (hoptUsed …) return;`) – nach dem Ausspielen. Folge: zwei Pyroblast auf der Hand sind ein Fehlklick-Verlust. Nebenbeobachtung (ebenfalls getestet, Lesart offen): wird die erste Pyroblast durch Silence negiert, ist der Stempel nicht gesetzt, und eine zweite Pyroblast im selben Zug wirkt voll (100 Schaden, 1 Token) – ein negiertes Ausspielen zählt also nicht als „played“.
- **Repro:** `docs/niche-tests/repro/A01-pollution/04-pyroblast-zweite-karte-verpufft.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `cards/effects/pyroblast.js` – kein `spellPlayCondition` mit `gs.hoptUsed?.[`pyroblast:${pi}`] !== gs.turn`; Stempel wird erst nach der Zielwahl gesetzt (`ctx.hardOncePerTurn('pyroblast')`).

### A01-pollution-05 · Doom Clock: gleichzeitig besiegte Ziele zählen mehrfach (statt „je Ereignis EINE Auslösung“) · Stufe A
- **Karten:** Doom Clock (`cards/effects/doom-clock.js`, `_doom-clock-shared.js`); ausgelöst mit Pyroblast
- **Voraussetzungen / Aufbau:** Doom Clock in der Area-Zone von Sitz 0 (0 Counter); 3× „ZZ Dummy Frail“ (10 HP) auf Sitz 1; Pyroblast wählt alle drei.
- **Schritte:** 1. `t.play(0, 'Pyroblast')` mit 3 Zielen. 2. Counter auf der Uhr lesen.
- **Erwartet** (Quelle: Kartentext „The first 4 times every turn 1 or more targets are defeated …“; Ruling im Kopf von `doom-clock.js` / `_doom-clock-shared.js` (Als Ruling 5.8.): „Die Besiegungs-Ausloesung … ist je Ereignis EINE Ausloesung – auch wenn mehrere Ziele gleichzeitig fallen“): genau 1 Counter, 1 von 4 Auslösungen verbraucht.
- **Beobachtet:** 3 Counter, 3 von 4 Auslösungen verbraucht (ein vierter Einzeltod im selben Zug wäre die letzte, jeder weitere zählt nicht mehr). Der Riegel `gs._doomDefeatTick` wird per `Promise.resolve().then(…)` im nächsten Mikrotask gelöscht; zwischen den `onCreatureDeath`-Hooks des Stapels liegen aber `await`s, sodass der Riegel schon nach dem ersten Tod fällt. Nebenbefund: die im Ruling beschriebene Regel „Ziele beider Spieler in einem Ereignis → der Spieler mit den meisten Verlusten legt den Counter“ ist nicht umgesetzt (es entscheidet der Kontrolleur des jeweils ersten Todes).
- **Repro:** `docs/niche-tests/repro/A01-pollution/05-doom-clock-mehrfachtod-zaehlt-mehrfach.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `cards/effects/doom-clock.js:~88` (`gs._doomDefeatTick` + Mikrotask-Löschung statt des Sammel-Fensters aus CARD_API „One or more of your Creatures are defeated“ / `_mitNiederlagenSammler`).

### A01-pollution-06 · Doom Clock: Besiegung eines Helden löst keinen Counter aus · Stufe B
- **Karten:** Doom Clock (`cards/effects/doom-clock.js`)
- **Voraussetzungen / Aufbau:** Doom Clock in Sitz 0s Area; Gegner-Held 0 mit 100 HP; Fireball (150) besiegt ihn.
- **Schritte:** 1. `t.play(0, 'Fireball')` auf Gegner-Held 0. 2. Counter lesen.
- **Erwartet** (Quelle: Kartentext „1 or more **targets** are defeated, their controller must place 1 Doom Counter“; „target“ umfasst Helden – so liest es auch Fun-Fun Circus Strongman („Whenever a target is defeated“ → Hooks `onCreatureDeath` **und** `onHeroKO`) und Jack („If the target this Hero defeated was a Hero“)): 1 Counter, den der Kontrolleur des Helden legt.
- **Beobachtet:** 0 Counter. Doom Clock hört nur auf `onCreatureDeath`.
- **Repro:** `docs/niche-tests/repro/A01-pollution/06-doom-clock-heldenniederlage-zaehlt-nicht.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `cards/effects/doom-clock.js` – kein `onHeroKO`-Hook. Restunsicherheit: die Skriptkommentare sprechen nur von „Creatures/Zielen“ und nennen Helden nirgends ausdrücklich.

### A01-pollution-07 · Doom Prophecy: bei Ablage der Uhr in der GEGNER-Area verschwindet die Zauberkarte · Stufe A
- **Karten:** Doom Prophecy (`cards/effects/doom-prophecy.js`), Engine `placeArea`
- **Voraussetzungen / Aufbau:** Sitz 0 hat Decay Magic 2 (Held 0), Doom Prophecy auf der Hand, Doom Clock + 10 Füllkarten im Deck; im Optionsdialog wird „Opponent's Area Zone“ gewählt (Gegenprobe: „My Area Zone“).
- **Schritte:** 1. `t.play(0, 'Doom Prophecy')`. 2. Kartenbilanz (`t.census`) vorher/nachher; Ablage, Gelöscht-Stapel und Instanzen prüfen.
- **Erwartet** (Quelle: Spielkonvention – ein gespielter Zauber landet nach der Auflösung in der Ablage seines Spielers; Kartenbilanz ausgeglichen): Doom Prophecy in der Ablage von Sitz 0, Doom Clock aus dem Deck in der gegnerischen Area-Zone.
- **Beobachtet:** Wahl „My Area Zone“: korrekt. Wahl „Opponent's Area Zone“: Uhr liegt beim Gegner mit 3 Countern, aber Doom Prophecy ist in KEINEM Stapel mehr (Hand/Ablage/Gelöscht beider Seiten leer, Kartenbilanz −1) – die Karte ist aus dem Spiel verschwunden. Zusätzlich bleibt eine weitere Instanz der Karte in Zone `hand` zurück.
- **Repro:** `docs/niche-tests/repro/A01-pollution/07-doom-prophecy-gegnerzone-karte-verschwindet.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** Engine `placeArea(playerIdx, …)` (`cards/effects/_engine.js:~27386`) liest `_resolvingCard` vom Besitzer der Area-Zone (`gs.players[playerIdx]`), nicht vom Spieler, dessen Zauber gerade auflöst. Beim Platzieren in die Gegner-Zone ist dort `_resolvingCard` leer → `gs._spellPlacedOnBoard = true` („der Zauber hat sich selbst aufs Brett gelegt“) → `doPlaySpell` überspringt die Ablage für Doom Prophecy. Betroffen ist jede künftige Karte, die eine Area (nicht sich selbst) in die Gegner-Zone legt.

### A01-pollution-08 · Doom Prophecy: Uhr aus MEINEM Deck landet in der Gegner-Zone beim Entfernen in der GEGNER-Ablage · Stufe C
- **Karten:** Doom Prophecy (`doom-prophecy.js`), Engine `removeArea`/`deleteArea`
- **Voraussetzungen / Aufbau:** wie -07 (Wahl „Opponent's Area Zone“); danach Reality Crack (schickt alle Areas in die Ablage).
- **Schritte:** 1. Doom Prophecy in die Gegner-Zone. 2. Reality Crack. 3. Ablagen prüfen.
- **Erwartet** (Quelle: Konvention `CARD_API.md` „GESTOHLENE KARTEN GEHEN IN DIE ABLAGE IHRES BESITZERS“ und „Eine Karte in der Zone des GEGNERS: `owner` = Gegner, `originalOwner` = Leger; die Stapel lesen `originalOwner`“): Die Uhr aus meinem Deck gehört mir → meine Ablage. Für Areas ist das aber nirgends entschieden.
- **Beobachtet:** `originalOwner` bleibt = Gegner (die Instanz wird mit `_trackCard(…, ziel, 'deck')` angelegt), `removeArea` liest ohnehin `cardInstance.owner` → die Doom Clock liegt danach in der Ablage des Gegners (mein Deck verliert eine Karte, seine Ablage gewinnt eine; sie wäre dort z. B. Necromancy-/Rückholfutter).
- **Repro:** `docs/niche-tests/repro/A01-pollution/08-doom-prophecy-uhr-landet-in-falscher-ablage.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `doom-prophecy.js` setzt `originalOwner` nicht; `_engine.js` `removeArea` (`ownerIdx = cardInstance.owner`) und `deleteArea` ignorieren `originalOwner` für Areas.
- **Frage an Al:** Soll die in die Gegner-Area gelegte Doom Clock beim Entfernen in die Ablage des **Legers** (Kartenbesitzer) oder des **Zonen-Besitzers** gehen?

### A01-pollution-09 · Warrior of Teocuilatl schützt nicht vor Statuseffekten (Freeze, Stun, Negation) · Stufe B
- **Karten:** Warrior of Teocuilatl (`warrior-of-teocuilatl.js`); betroffen: Cold Coffin, Medusa's Curse, Null Zone; Engine `applyCreatureStatus` / `actionNegateCreature`
- **Voraussetzungen / Aufbau:** Sitz 0: Doom Clock (5 Counter) in der Area, Zauber auf der Hand. Sitz 1: Soul Shard Ba (Slot 0) + Warrior of Teocuilatl (Slot 1). Der Warrior-Besitzer antwortet überall „Ja“.
- **Schritte:** 1. `t.play(0, <Zauber>)` mit Ba als Ziel (Cold Coffin) bzw. als eine der Betroffenen (Medusa's Curse, Null Zone). 2. Prompts, Uhr und Zustand von Ba prüfen. Gegenprobe Goldify (Zerstörung).
- **Erwartet** (Quelle: Kartentext „Whenever a Creature either player controls would be affected by a card or effect, you may remove 1 Doom Counter … to negate **all** effects that card or effect would have on that Creature“): das Angebot erscheint, bei „Ja“ wird der Freeze/Stun/die Negation negiert, Uhr 5 → 4.
- **Beobachtet:** Bei allen drei Zaubern kein Warrior-Angebot; Ba ist gefroren (dauerhaft, unheilbar) bzw. betäubt bzw. „nulled“, Uhr bleibt 5. Bei Goldify, Sun Beam, Eraser Beam und Basketskull dagegen funktioniert der Schutz (Angebot, Uhr 4, Ba lebt). Ursache liegt in der Engine: `beforeCreatureAffected` wird nur bei Heilung, Gift, Zerstörung und Bewegung ausgelöst (`_engine.js:10139, 10845, 12368, 13419`), nicht beim Setzen von Frozen/Stunned/Negated. (Dieselbe Lücke betrifft vermutlich Cool Rescuer Monia – nicht Teil dieser Gruppe, nicht geprüft.)
- **Repro:** `docs/niche-tests/repro/A01-pollution/09-warrior-teocuilatl-schuetzt-nicht-vor-status.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_engine.js` `applyCreatureStatus` / `actionNegateCreature` ohne `beforeCreatureAffected`-Fenster. Restunsicherheit: ob die Lücke bewusst auf Schaden/Zerstörung begrenzt ist; der Kartentext sagt „a card or effect“ und „all effects“.

### A01-pollution-10 · Guardian of Teocuilatl schützt nur die EIGENEN Areas · Stufe C
- **Karten:** Guardian of Teocuilatl (`guardian-of-teocuilatl.js`), Reality Crack zum Auslösen
- **Voraussetzungen / Aufbau:** Area Acid Rain (Sitz 0) und Cosmic Depths (Sitz 1); Guardian auf der Hand (Sitz 0 bzw. Sitz 1); Sitz 0 spielt Reality Crack (schickt alle Areas in die Ablage).
- **Schritte:** 1. `t.play(0, 'Reality Crack')`. 2. Guardian-Angebote mitlesen.
- **Erwartet** (Quelle: Kartentext „When **an** Area would be affected by a card or effect …“, ohne „you control“; der Warrior desselben Archetyps sagt ausdrücklich „either player controls“): unklar – wörtlich wären alle Areas schützbar.
- **Beobachtet:** Der Guardian wird nur für Areas seines eigenen Besitzers angeboten (`ctx.affectedOwner !== pi → return`, Kommentar „Only protect YOUR OWN Areas“, kein Ruling dazu in `CARD_API.md`). Die gegnerische Area wird ohne Angebot entfernt.
- **Repro:** `docs/niche-tests/repro/A01-pollution/10-guardian-schuetzt-nur-eigene-areas.js` (✗ = gegnerische Area wird nicht angeboten)
- **Vermutete Ursache:** `guardian-of-teocuilatl.js`, Hook `onAreaWouldBeAffected`: `if (ctx.affectedOwner !== pi) return;`.
- **Frage an Al:** Soll Guardian of Teocuilatl auch **gegnerische** Areas schützen können – ja oder nur eigene?

### A01-pollution-11 · Soul Shard Sah stempelt beim Nachspielen fremder On-Summon-Effekte deren „1 pro Zug“-Sperre · Stufe B
- **Karten:** Soul Shard Sah (`soul-shard-sah.js`), Soul Shard Sekhem / Ba (`soul-shard-sekhem.js`, `soul-shard-ba.js`, gemeinsamer Stempel in `_soul-shards-shared.js`), Necromancy
- **Voraussetzungen / Aufbau:** Sitz 0 Held 0 mit Necromancy ×3 + Summoning Magic ×3; Ablage: Sah, Sekhem, Ba; auf der Hand eine echte Soul Shard Sekhem. Necromancy beschwört Sah; Sah wählt Sekhem + Ba als nachzuspielende Effekte.
- **Schritte:** 1. Necromancy (freie Ability) → Sah, Mehrfachwahl Sekhem + Ba. 2. Danach die Sekhem von der Hand spielen.
- **Erwartet** (Quelle: Kartentext Sah „resolves those Creatures' on-summon effects as if they were its own“ – Sah *beschwört* sie nicht; Sekhem „You can only summon 1 „Soul Shard Sekhem“ per turn“): Sah löst den Effekt aus, die Sperre für Sekhem/Ba bleibt unberührt; die echte Sekhem aus der Hand ist im selben Zug spielbar.
- **Beobachtet:** Der nachgespielte `onPlay` stempelt `markSoulShardSummoned(gs, pi, 'Soul Shard Sekhem')` bzw. `'Soul Shard Ba'` (Skriptname des nachgespielten Effekts) → `_soulShardSummonedThisTurn = {Sah, Sekhem, Ba}`; die Sekhem aus der Hand wird abgelehnt (`doPlayCreature` → `false`). Der Sekhem-Effekt selbst lief (50 Schaden), der Ba-Effekt auch (Sah trägt die Zweite-Aktion-Zusage).
- **Repro:** `docs/niche-tests/repro/A01-pollution/11-soul-shard-sah-stempelt-fremde-shards.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** Der Stempel steht am Anfang jedes Shard-`onPlay` (`markSoulShardSummoned(gs, pi, CARD_NAME)`) und Sah ruft diese `onPlay` per `_effectOverride` auf; Abhilfe: Stempel nur, wenn `ctx.card.name === CARD_NAME`. Restunsicherheit: ob die Autoren die Sperre für nachgespielte Effekte als gewollt ansehen.

### A01-pollution-12 · Reality Crack: eine Area wird doppelt in die Ablage gelegt, wenn das Area-Limit während des Löschens sinkt · Stufe A
- **Karten:** Reality Crack (`reality-crack.js`), Engine `removeAllAreas` / `removeArea`; Zusammenspiel mit Spatial Crevice (Querschnitt) und The Fourth Circle of Hell
- **Voraussetzungen / Aufbau:** Sitz 0 kontrolliert legal 3 Areas dank Spatial Crevice (zuerst gelegt) + The Fourth Circle of Hell + Acid Rain; 2 gelöschte Karten; Reality Crack auf der Hand.
- **Schritte:** 1. `t.play(0, 'Reality Crack')` (Area-Wahl abbrechen). 2. Kartenbilanz (`t.census`) vorher/nachher.
- **Erwartet** (Quelle: Kartentext „Send all Areas on the board to the discard pile“; Spielkonvention: keine Kartenvermehrung): jede Area genau einmal in der Ablage.
- **Beobachtet:** The Fourth Circle of Hell liegt **zweimal** in der Ablage (Kartenbilanz +1). `removeAllAreas` arbeitet eine Momentaufnahme ab; das Entfernen von Spatial Crevice senkt das Limit auf 1, `enforceAreaLimit` (Ende von `removeArea`) entfernt eine weitere Area („Too many Areas“), die Schleife ruft `removeArea` für diese Instanz erneut auf – `removeArea` hat (anders als `deleteArea`) keinen Zonenwächter und schiebt den Namen noch einmal in die Ablage.
- **Repro:** `docs/niche-tests/repro/A01-pollution/12-reality-crack-dupliziert-area-bei-limit.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `cards/effects/_engine.js` `removeAllAreas` (Schleife ohne `inst.zone === 'area'`-Prüfung) und `removeArea` (kein Zonenwächter, `discardPile.push` unbedingt); Abhilfe: Wächter in `removeArea` oder `_skipLimitEnforce` + gesammelte Durchsetzung am Ende von `removeAllAreas`.

### A01-pollution-13 · Doom Prophecy ignoriert das Area-Limit · Stufe B
- **Karten:** Doom Prophecy (`doom-prophecy.js`), Doom Clock; Engine `areaLimitFor` / `enforceAreaLimit`
- **Voraussetzungen / Aufbau:** a) Gegner hat Cosmic Depths in der Area-Zone, Sitz 0 legt die Uhr per Doom Prophecy (Decay Magic 2) in die Gegner-Zone; b) Sitz 0 hat schon eine Doom Clock und legt per Doom Prophecy eine zweite in die eigene Zone.
- **Schritte:** 1. `t.play(0, 'Doom Prophecy')`, Zielzone wählen. 2. `gs.areaZones` lesen.
- **Erwartet** (Quelle: Area-Limit-Ruling 14.9. in `_engine.js` `areaLimitFor`: Grundwert 1 pro Spieler, zwei Kopien derselben Area nie zugleich; Überhang löst der Besitzer durch Ablegen auf; die Doom-Clock-Rulings 5.8. meinen „zwei Uhren“ = eine je Seite): Der Zonen-Besitzer kontrolliert danach höchstens 1 Area.
- **Beobachtet:** a) `["Cosmic Depths","Doom Clock"]` in der Gegner-Zone, beide wirksam; b) `["Doom Clock","Doom Clock"]` in der eigenen Zone (zwei Uhren, Zugende legt dann je 1 Counter auf jede). `placeArea` setzt das Limit nicht selbst durch und Doom Prophecy ruft weder `canPlaceAnotherArea` noch `enforceAreaLimit`.
- **Repro:** `docs/niche-tests/repro/A01-pollution/13-doom-prophecy-ignoriert-area-limit.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `doom-prophecy.js` – `engine.placeArea(ziel, inst)` ohne anschließendes `await engine.enforceAreaLimit(ziel)` (bzw. Playcondition); alternativ ersetzt die neue Uhr die alte Area. Restunsicherheit: wie die Auflösung gewollt ist (ersetzen, Besitzer wählt, unspielbar).

### A01-pollution-14 · Eraser Beam: in der Kette negiert → Kosten bezahlt, „1 pro Spiel“-Limit nicht verbraucht · Stufe B
- **Karten:** Eraser Beam (`eraser-beam.js`); Querschnitt: Silence (Kettennegation)
- **Voraussetzungen / Aufbau:** Sitz 0: 2× Eraser Beam auf der Hand; Sitz 1: Silence (Reaktion) auf der Hand, sagt „Ja“. Später (zwei `t.endTurn()`) spielt Sitz 0 die zweite Eraser Beam.
- **Schritte:** 1. `t.play(0, 'Eraser Beam')` → Silence negiert in der Kette. 2. Tokens/Limit prüfen. 3. Zwei Zugwechsel, dann die zweite Eraser Beam spielen (3 freie Zonen sicherstellen).
- **Erwartet** (Quelle: Kartentext „You can only play 1 „Eraser Beam“ per game“; Absicht im Skript `onPlay`: „Mark the once-per-game key now so even a same-turn negation still consumes the game-long charge“; Cold-Coffin-Muster: Kosten bleiben bei Negation bezahlt): ein negiertes Ausspielen verbraucht die Spielladung wie ein nach der Zielwahl negiertes.
- **Beobachtet:** Kosten (3 Tokens) bleiben liegen, Karte in der Ablage, aber `_oncePerGameUsed` ist leer; die zweite Eraser Beam wird später gespielt und besiegt den Helden. Der Stempel steht nur in `onPlay` und läuft bei einer Negation in der Kette (Silence, vermutlich auch Ghostly Warning, MOE Shield) nie.
- **Repro:** `docs/niche-tests/repro/A01-pollution/14-eraser-beam-negiert-verbraucht-limit-nicht.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `eraser-beam.js` – Stempel `ps._oncePerGameUsed.add('eraserBeam')` und `_spellLockTurn` nur in `onPlay`; gehört zusammen mit den Kosten in `payActivationCost`. Restunsicherheit: ob ein in der Kette negierter Zauber als „gespielt“ gilt (Pyroblast verhält sich bei -04 ebenso).

### A01-pollution-15 · Magic Mirror: die „Kopie“ des Zaubers landet als echte Karte in der Ablage des Spiegel-Besitzers · Stufe B
- **Karten:** Magic Mirror (`magic-mirror.js`); getestet mit Pyroblast, Cold Coffin, Eraser Beam, Basketskull
- **Voraussetzungen / Aufbau:** Sitz 1: Magic Mirror verdeckt bei Held 0 (Magic Arts 3 vergeben); Sitz 0 wirkt den Zauber auf Held 0; die Kopie wählt den Angreifer.
- **Schritte:** 1. `t.play(0, <Zauber>)`, Mirror löst aus, Kopie läuft. 2. Kartenbilanz und Ablagen prüfen.
- **Erwartet** (Quelle: Kartentext „the user immediately performs a **copy** of it“; Spielkonvention Kartenbilanz): Das Original (negiert) liegt in der Ablage von Sitz 0, die Magic Mirror in der von Sitz 1; die Kopie ist keine Karte.
- **Beobachtet:** In der Ablage von Sitz 1 liegen Zauber **und** Magic Mirror; die Kartenbilanz ist für den gespielten Zauber +1 (bei allen vier getesteten Zaubern). Der Spiegel-Besitzer bekommt eine zusätzliche Kopie des gegnerischen Zaubers in seine Ablage (Futter für Rückholer wie Spontaneous Reappearance, Mass Multiplication).
- **Repro:** `docs/niche-tests/repro/A01-pollution/15-magic-mirror-kopie-landet-als-karte-in-ablage.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `magic-mirror.js`, `finally`-Block von `onSurpriseActivate`: `ps.discardPile.push(sourceCard)` für die synthetische Instanz. Restunsicherheit gering; ob die Karte als Rückholfutter gewollt ist, steht nirgends.

### A01-pollution-16 · Magic Mirror: Kopie zahlt manche Kosten nicht, verbraucht fremdes „1 pro Spiel“-Limit · Stufe C
- **Karten:** Magic Mirror, Cold Coffin, Eraser Beam, Basketskull
- **Voraussetzungen / Aufbau:** wie -15; Spiegel-Besitzer Sitz 1.
- **Schritte:** 1. Angreifer (Sitz 0) wirkt Cold Coffin bzw. Eraser Beam auf den Mirror-Träger. 2. Tokens beider Seiten, `_oncePerGameUsed`, `_spellLockTurn` von Sitz 1 prüfen.
- **Erwartet** (Quelle: Mirror-Text „performs a copy of it as an additional Action, **ignoring its level**“ – nur das Level wird ignoriert; Cold Coffin „Place 2 Pollution Tokens … to use this Spell“, Eraser Beam „Place 3 … to use this Spell … only 1 per game“): unklar, wörtlich müsste die Kopie ihre Kosten zahlen.
- **Beobachtet:** Cold Coffin-Kopie: Sitz 1 hat nur den Mirror-Preis (1 Token), nicht zusätzlich die 2 Kosten-Tokens; Eraser Beam-Kopie: nur 2 Tokens (Mirror-Preis), nicht + 3. Grund: die Kosten liegen im Hook `payActivationCost`, den die Kopie nie aufruft. Basketskull dagegen (Kosten in `onPlay`) zahlt sie: die Uhr verliert Original- und Kopie-Counter. Außerdem schreibt die Eraser-Beam-Kopie `_oncePerGameUsed = {eraserBeam}` und `_spellLockTurn` für Sitz 1: seine eigene Eraser Beam ist damit für den Rest des Spiels gesperrt, obwohl er keine gespielt hat.
- **Repro:** `docs/niche-tests/repro/A01-pollution/16-magic-mirror-kopie-kosten-und-limit.js` (✗ = weicht von der wörtlichen Lesart ab)
- **Vermutete Ursache:** `magic-mirror.js` ruft nur `onPlay` der Kopie auf (keine `payActivationCost`, keine `spellPlayCondition`); `eraser-beam.js` stempelt in `onPlay` für `ctx.cardOwner` = Spiegel-Besitzer.
- **Frage an Al:** (1) Muss die Magic-Mirror-Kopie die „… to use this Spell“-Kosten des Zaubers bezahlen – ja oder nein? (2) Soll die Kopie eines „1 pro Spiel“-Zaubers das Limit des Spiegel-Besitzers verbrauchen – ja oder nein?

### A01-pollution-17 · Token-Kosten „to use this Spell“ bleiben bei Negation nur bei Cold Coffin und Eraser Beam bezahlt · Stufe B
- **Karten:** Medusa's Curse, Null Zone, Goldify, Reincarnation (getestet), Mass Multiplication, Golden Wings (laut Skript gleich, nicht ausgeführt) im Vergleich zu Cold Coffin, Eraser Beam; Querschnitt Silence
- **Voraussetzungen / Aufbau:** Sitz 0: der Zauber auf der Hand (Held 2 gefallen, damit Reincarnation spielbar ist), Sitz 1: Silence + Soul Shard Ba auf dem Brett; Silence wird gespielt.
- **Schritte:** 1. `t.play(0, <Zauber>)`, Silence negiert in der Kette. 2. Pollution Tokens auf Sitz 0 zählen.
- **Erwartet** (Quelle: `CARD_API.md`, Hook-Tabelle `payActivationCost`: „costs that must be paid at activation and are NOT refunded by negation (e.g. Cold Coffin's Pollution placement) … the cost stays paid“; die Kartentexte sind wortgleich „Place N Pollution Tokens … to use this Spell“): Kosten bleiben liegen.
- **Beobachtet:** Cold Coffin 2 und Eraser Beam 3 Tokens (bezahlt); Medusa's Curse, Null Zone, Goldify, Reincarnation: **0** Tokens – ein negierter Zauber kostet nichts, obwohl der Spieler die „Place … to use“-Kosten laut Text und Rulings bezahlt haben müsste.
- **Repro:** `docs/niche-tests/repro/A01-pollution/17-token-kosten-bei-negation-uneinheitlich.js` (✗ = Kosten nicht bezahlt)
- **Vermutete Ursache:** nur `cold-coffin.js` und `eraser-beam.js` haben `payActivationCost`; die anderen setzen die Tokens in `onPlay` (nach der Kette; bei Goldify/Reincarnation/Golden Wings sogar erst nach der Zielwahl). Restunsicherheit: ob die Autoren die Token-Kosten dieser Karten bewusst als Teil der Wirkung ansehen.
- **Nachtrag (Fortsetzung):** Dieselbe Klasse bei **Basketskull** („Remove any number of Doom Counters … to play this card“): in der Kette von Silence negiert, behält die Uhr alle 5 Counter, die Karte liegt in der Ablage (Repro `docs/niche-tests/repro/A01-pollution/17b-basketskull-negiert-zahlt-keine-counter.js`, ✗ = Kosten nicht bezahlt). Einordnung eher C als B, weil die Menge der Counter („any number“) erst in `onPlay` gewählt wird – es gibt vor der Kette keine bezahlbare Menge; eine Lösung bräuchte die Mengenwahl in `payActivationCost`.

### A01-pollution-18 · Null Zone endet am Anfang statt am Ende des nächsten eigenen Zuges · Stufe A
- **Karten:** Null Zone (`null-zone.js`)
- **Voraussetzungen / Aufbau:** Sitz 0 (Zug 5): Royal Corgi auf dem Brett, Null Zone + Fireball auf der Hand. Zwei echte Zugwechsel (`t.endTurn()`).
- **Schritte:** 1. Null Zone spielen. 2. Zug 6 (Gegner) und dann Zug 7 (mein nächster Zug) beginnen lassen; Negation der Kreatur und `nulled`-Status des Helden prüfen.
- **Erwartet** (Quelle: Kartentext „**Until the end of your next turn**, negate the effects of all Creatures and Heroes cannot use any Spells“; Konvention im Kopf von `disruption-ray.js`: „the literal ‚end of your next turn' reading (+3 / opponent) is required … this intentionally diverges from the older Smoke Vial / cloud-pillow ‚+2 / caster' pattern (which expires at the START of the caster's next turn) … Smoke Vial was corrected to this same convention“): Kreaturen bleiben auch im eigenen Zug 7 negiert, der Held bleibt „nulled“; erst ab Zug 8 vorbei.
- **Beobachtet:** Zug 6: alles negiert/genullt (richtig). Zug 7: Kreatur wieder wirksam, Held ohne `nulled` – Null Zone läuft mit `expiresAtTurn = gs.turn + 2, expiresForPlayer = pi` beim *Beginn* von Zug 7 ab (das alte „+2 / Wirker“-Muster), deckt also nur den Gegnerzug ab.
- **Repro:** `docs/niche-tests/repro/A01-pollution/18-null-zone-endet-einen-zug-zu-frueh.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `cards/effects/null-zone.js` – `expiresAtTurn = gs.turn + 2; expiresForPlayer = pi;` müsste `gs.turn + 3` / Gegner sein (Ablauf wird zu Zugbeginn geprüft, `_ablaufFaellig`).

### A01-pollution-19 · Null Zone überspringt bereits negierte Kreaturen und verlängert deren Negation nicht · Stufe B
- **Karten:** Null Zone; Querschnitt: Soul Shard Ka / Necromancy (kurze Negationen)
- **Voraussetzungen / Aufbau:** Eine Kreatur ist nur bis zum Ende des Zuges negiert (`actionNegateCreature` mit `expiresAtTurn: turn+1` wie bei Soul Shard Ka), eine zweite nicht; danach Null Zone.
- **Schritte:** 1. Null Zone spielen. 2. Gegnerzug beginnen lassen und beide Kreaturen prüfen.
- **Erwartet** (Quelle: Kartentext „negate the effects of **all** Creatures“ bis zum Ende des nächsten eigenen Zuges): auch die vorab kurz negierte Kreatur bleibt im Gegnerzug negiert.
- **Beobachtet:** Die frisch genullte Kreatur ist negiert, die vorab kurz negierte nicht mehr (ihre Negation lief zum Zugende ab, Null Zone hat sie wegen `if (isCreatureNegated(inst)) continue;` übersprungen und nichts verlängert).
- **Repro:** `docs/niche-tests/repro/A01-pollution/19-null-zone-verlaengert-vorab-negierte-nicht.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `null-zone.js`: Überspringen per `isCreatureNegated` statt nur bei bereits vorhandenem `nulled`-Status; die Schleife sollte die Dauer verlängern (oder `nulled` zusätzlich stapeln).

### A01-pollution-20 · Pollution Piranha ist bei komplett belegtem Brett nicht spielbar, obwohl der Token den Platz freimachen würde · Stufe B
- **Karten:** Pollution Piranha (`pollution-piranha.js`)
- **Voraussetzungen / Aufbau:** Sitz 0: alle 9 Support Zonen belegt (nur Pollution Tokens), Piranha auf der Hand; Kontrolle: 1 freie Zone.
- **Schritte:** 1. `t.play(0, 'Pollution Piranha', {hero: 0, slot: 0})`. 2. Hand/Brett prüfen.
- **Erwartet** (Quelle: Kartentext „You must remove a Pollution Token from your side of the board to summon this Creature"; Skript-Dialog `beforeSummon`: „Choose a Pollution Token to consume and summon Pollution Piranha **in its place**"): bei vollem Brett kann die Piranha beschworen werden; der Token wird als Kosten entfernt, die Piranha landet in der frei gewordenen Zone (Muster `canBypassFreeZoneRequirement` / Drop auf belegten Slot wie bei den Teocuilatl-Kreaturen).
- **Beobachtet:** Kontrolle (1 freie Zone) funktioniert (Piranha beschworen, 1 Token entfernt). Bei 0 freien Zonen lehnt `doPlayCreature` ab (`false`), die Karte bleibt auf der Hand, 9 Tokens bleiben – noch bevor `beforeSummon` den Token entfernen könnte. Ein mit Tokens zugelegtes Brett ist aber gerade der Normalfall, in dem die Piranha helfen soll.
- **Repro:** `docs/niche-tests/repro/A01-pollution/20-piranha-nicht-spielbar-bei-vollem-brett.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `cards/effects/pollution-piranha.js` – weder `canBypassFreeZoneRequirement` noch `canPlaceOnOccupiedSlot` (beide Hooks gibt es z. B. in `archer-of-teocuilatl.js`). Restunsicherheit: der Text sagt nichts ausdrücklich zu „kein freier Platz"; die Skript-Formulierung „in its place" spricht aber für den Ersetzen-Weg.

### A01-pollution-21 · The Fifth Circle of Hell verdoppelt den ersten Helden eines Mehrziel-Treffers (Text: „exactly 1 target“) · Stufe A
- **Karten:** The Fifth Circle of Hell (`the-fifth-circle-of-hell.js`), Engine `_naechsterEinzelschadenVerdoppeln`; getestet mit Pyroblast, Flame Avalanche, Forbidden Zone, Chain Lightning
- **Voraussetzungen / Aufbau:** Fifth Circle in der Area-Zone von Sitz 0, Reality Crack schickt sie in die Ablage (Stempel `gs._naechsterEinzelschadenX2` gesetzt); danach Mehrziel-Zauber auf die Gegner-Helden.
- **Schritte:** 1. Reality Crack (Area-Wahl abbrechen). 2. Pyroblast auf Gegner-Held 0 + 1 (bzw. Flame Avalanche). 3. HP und Stempel lesen.
- **Erwartet** (Quelle: Kartentext „the next damage that **exactly 1 target** takes this turn is doubled“; Skriptkopf: „nicht mitten in einem Flächenschlag … bleibt der Stempel stehen“): ein Treffer auf 2+ Ziele zählt nicht – jeder Held verliert den normalen Schaden, der Stempel bleibt für einen späteren Einzelschaden.
- **Beobachtet:** Pyroblast auf 2 Helden: Held 0 verliert 200 (doppelt), Held 1 100, Stempel verbraucht. Flame Avalanche: [500, 650, 650] (150 Grundschaden → erster Held 300); Forbidden Zone [700, 750, 750]; Chain Lightning ebenso (der erste Held doppelt). Held + Kreatur im selben Pyroblast: der Held wird verdoppelt. Richtig dagegen: zwei Kreaturen-Ziele (ein Stapel mit 2 Einträgen) – der Stempel bleibt stehen.
- **Repro:** `docs/niche-tests/repro/A01-pollution/21-fifth-circle-verdoppelt-mehrziel-treffer.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `cards/effects/_engine.js` `_naechsterEinzelschadenVerdoppeln` (~12565) schützt nur gegen `gs._deferGameOverCheck > 0`; Mehrfachtreffer über `dealDamageToTargets` laufen aber in der Klammer `_multiHitScope` (`beginMultiHit`, `total >= 2`), und der Heldenpfad (`actionDealDamage` ~8458) fragt die nicht ab. Abhilfe: `this._multiHitScope?.total >= 2` mit auswerten.

### A01-pollution-22 · Soul Shard Ka: die per Suche beschworene Kreatur ist negiert, ihr Einsatz-Effekt läuft trotzdem · Stufe B
- **Karten:** Soul Shard Ka (`soul-shard-ka.js`), Thep (löst Ka aus), Archer of Teocuilatl, Sleeping Beauty (Beispiele); Vergleich Necromancy
- **Voraussetzungen / Aufbau:** Thep als Held 0 mit Summoning Magic 3, Ka in der Ablage (nicht diesen Zug dorthin gekommen), im Deck Archer bzw. Sleeping Beauty. Thep setzt Ka (Held-Effekt), Ka sucht die Kreatur.
- **Schritte:** 1. `t.activateHero(0, 0)` → Ka → im Ka-Dialog Archer (bzw. Sleeping Beauty). 2. Gold / Verknüpfung / Negations-Flag prüfen. Gegenprobe: dieselbe Kreatur per Necromancy aus der Ablage.
- **Erwartet** (Quelle: Kartentext „… immediately summon it as an additional Action, but **negate its effects** until the end of the turn“; Skriptkopf: „Necromancy-style negated“): wie bei Necromancy kommt die Kreatur negiert ins Spiel, ihr Einsatz-Effekt unterbleibt (Archer: keine 4 Gold; Sleeping Beauty: keine Verknüpfung).
- **Beobachtet:** Ka → Archer: Gold 100 → 104, Archer danach „negiert“; Ka → Sleeping Beauty: `_linkedHeroOwner` gesetzt (Verknüpfung steht), Kreatur danach „negiert“. Gegenprobe Necromancy: beide Einsatz-Effekte unterbleiben. Die Negation von Ka wirkt also nur auf die späteren (laufenden/aktiven) Effekte, nicht auf den Einsatz-Effekt der gesuchten Kreatur – Ka ist faktisch „suche eine Kreatur Lv ≤ 2 und löse ihren Einsatz-Effekt aus“.
- **Repro:** `docs/niche-tests/repro/A01-pollution/22-soul-shard-ka-negiert-erst-nach-dem-einsatz-effekt.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `cards/effects/soul-shard-ka.js` – `engine.summonCreatureWithHooks(…)` (Hooks `onPlay`/`onCardEnterZone` laufen sofort) und erst danach `engine.actionNegateCreature(placeRes.inst, …)`; Necromancy negiert vor dem Einsatz-Effekt. Restunsicherheit: ob die Autoren „negate its effects" bewusst nur auf laufende Effekte beziehen.

### A01-pollution-23 · Basketskull: Abbruch der Counter-Mengenwahl verbraucht die Karte statt sie zurückzugeben · Stufe B
- **Karten:** Basketskull (`basketskull.js`)
- **Voraussetzungen / Aufbau:** Doom Clock mit 5 Countern in der Area von Sitz 0, Basketskull auf der Hand; im Dialog „Remove how many?“ (Dropdown, `cancellable: true`) wird der Abbrechen-Knopf gedrückt (`{cancelled: true}`).
- **Schritte:** 1. `t.play(0, 'Basketskull')`. 2. Mengenwahl abbrechen. 3. Hand, Ablage, Uhr prüfen.
- **Erwartet** (Quelle: Regel 23.9 / CARD_API.md Z. 3104 „`gs._spellCancelled = true` – Spell returns to hand (player cancelled …)“: „Abbruch heißt: nichts ist passiert. Die Karte bleibt auf der Hand, die Aktion wird erstattet“): Basketskull bleibt auf der Hand, Uhr 5 Counter, Aktion erstattet.
- **Beobachtet:** Die Uhr behält 5 Counter (nichts bezahlt), aber `doPlaySpell` gibt `true` zurück und Basketskull liegt in der **Ablage**: Karte und Aktion sind verbraucht, ohne dass etwas passiert ist. (Dieselbe Folge, wenn auf eine Uhr-Wahl bei zwei Uhren abgebrochen würde: `pickClock` ist dort aber nicht abbrechbar.)
- **Repro:** `docs/niche-tests/repro/A01-pollution/23-basketskull-abbruch-verbraucht-karte.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `cards/effects/basketskull.js` `onPlay`: `if (!wahl || wahl.cancelled || !wahl.optionId) return false;` (und `if (!uhr) return false;`) – der Rückgabewert `false` wird nicht als Abbruch gelesen; es fehlt `gs._spellCancelled = true` (so wie in `goldify.js`, `reincarnation.js`, `sun-beam.js`, `mana-beacon.js`). Hinweis: die Zielwahl danach ist bewusst nicht abbrechbar (`cancellable: false`), aber die bereits entfernten Counter sind dann bezahlt (Kosten-vor-Wahl-Muster wie Cold Coffin).

### A01-pollution-24 · Acid Rain: ein aus dem Gelöscht-Stapel gewirkter Spell (Circle-Replay) verbraucht das „first time … from their hand“ · Stufe B
- **Karten:** Acid Rain (`acid-rain.js`), The Fourth Circle of Hell (und die übrigen Circles: Replay aus dem Gelöscht-Stapel), Dante (Auslöser im Test)
- **Voraussetzungen / Aufbau:** Sitz 1 kontrolliert Acid Rain; Sitz 0 (Zugspieler; Dante als Held 0, Destruction Magic 3 + Magic Arts 3) hat Fourth Circle, Fireball, 2× Heal auf der Hand und eine gelöschte Area im Gelöscht-Stapel (Dantes Vorbedingung). Dante löscht (Weg 1) die Fourth Circle aus der Hand, Antwort „Ja“ zum Circle-Replay; danach spielt Sitz 0 Fireball aus der Hand.
- **Schritte:** 1. `t.activateHero(0, 0)` (Dante Weg 1, Fourth Circle löschen). 2. Nach-Ketten-Aktion abarbeiten (Replay). 3. `t.play(0, 'Fireball')`. 4. Tokens/Hand zählen.
- **Erwartet** (Quelle: Kartentext „The first time every turn the turn player plays a Spell **from their hand** …“; Fourth Circle: „play this **deleted** Spell as an additional Action“ – also nicht aus der Hand): der Replay löst Acid Rain nicht aus; der erste Zauber aus der Hand (Fireball) löst die Strafe aus.
- **Beobachtet:** Acid Rain wird schon beim Replay ausgelöst (Optionswahl, Pollution Token für Sitz 0, Wächter `triggeredOnTurn` gesetzt); der Fireball aus der Hand löst danach nichts mehr aus (Tokens 1 → 1, Hand 4 → 3). Betroffen ist jeder gewirkte Spell, der nicht aus der Hand kommt, sofern er über `_castSpellImmediately` läuft (Circle-Replays 2.–8. Kreis, vermutlich auch der Area-Zauber der Third Circle).
- **Repro:** `docs/niche-tests/repro/A01-pollution/24-acid-rain-zaehlt-spell-aus-geloescht-stapel.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `cards/effects/acid-rain.js` `afterSpellResolved` prüft nur „Zugspieler“ und „Kartentyp Spell“; der Hook trägt keine Herkunft (`_engine.js` ~21848, `_castSpellImmediately`). Restunsicherheit: die Circle-Autoren behandeln den Replay als „Spell spielen“ (Wegwerf-Pool statt Hand); der Acid-Rain-Text sagt aber ausdrücklich „from their hand“.

### A01-pollution-25 · Golden Wings: die Immunität ist quellenblind – sie sperrt auch die eigenen Karten und Opfer-Kosten · Stufe B
- **Karten:** Golden Wings (`golden-wings.js`); betroffen im Test: Archer of Teocuilatl (Opfer-Kosten), Goldify, Sun Beam, Pyroblast, Cold Coffin (eigene Zauber)
- **Voraussetzungen / Aufbau:** Sitz 0: eine ältere Kreatur (nicht in diesem Zug beschworen) + Golden Wings und ein zweiter Eigenzauber bzw. Archer auf der Hand. Golden Wings (proaktiv, ohne Aktionskosten) auf die eigene Kreatur.
- **Schritte:** 1. Golden Wings auf die Kreatur. 2. (a) Archer (Zusatzaktion durch Opfer; die geschützte Kreatur ist die einzige Opfergabe). (b) eigener Goldify / Sun Beam / Cold Coffin / Pyroblast auf dieselbe Kreatur.
- **Erwartet** (Quelle: Kartentext „That Creature is unaffected by your **opponent's** cards and effects until the end of this turn“; Buff-Tooltip in `_hooks.js`: „Fully immune to all opponent effects“): eigene Zauber und eigene Kosten wirken weiter – nur der Gegner ist ausgesperrt.
- **Beobachtet:** (a) Archer wird abgelehnt (`doPlayCreature` → `false`, die geschützte Kreatur gilt nicht als Opfer-Kandidat). (b) Eigener Goldify/Sun Beam/Cold Coffin/Pyroblast zahlt seine Kosten, die Kreatur bleibt unberührt; ein eigener Buff (`actionAddCreatureBuff`) wird ebenfalls abgewiesen. Golden Wings setzt `_cardinalImmune`, und die Engine liest diese Marke quellenblind („source-blind by design“, `_engine.js` 12281, 13343, 17877, 17931, 18622, 40387).
- **Repro:** `docs/niche-tests/repro/A01-pollution/25-golden-wings-blockt-eigene-effekte.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `golden-wings.js` `applyBuff` (`inst.counters._cardinalImmune = true`); für „nur gegnerische Karten“ braucht es eine quellenabhängige Marke (so wie das bereits gesetzte `untargetable_by_opponent` + `_pi`). Restunsicherheit: ob die Autoren die Folgen für eigene Opfer-/Buff-Effekte einkalkuliert haben.

### A01-pollution-26 · Goldify: Gold und Zusatzaktion fließen auch, wenn die Kreatur durch Schutz überlebt · Stufe C
- **Karten:** Goldify (`goldify.js`); Schutzquellen: Golden Wings (Gegner-Reaktion), Warrior of Teocuilatl, `_cardinalImmune`
- **Voraussetzungen / Aufbau:** Sitz 0: Goldify + Fireball auf der Hand; Sitz 1: Soul Shard Ba (Lv1) auf dem Brett, (a) Golden Wings auf der Hand (sagt „Ja"), (b) Warrior of Teocuilatl daneben und Doom Clock mit 5 Countern.
- **Schritte:** 1. `t.play(0, 'Goldify')` auf Ba. 2. Gold, Kreatur, Phase prüfen.
- **Erwartet** (Quelle: Kartentext „Choose a Creature and defeat it. Gain Gold equal to 5 times its level. If you chose a level 1 or lower Creature, this counts as an additional Action“): unklar – wörtlich sind „defeat“ und „gain Gold“ getrennte Sätze (kein „if you do“), und der Warrior negiert „alle Effekte auf die Kreatur“, nicht den Goldgewinn des Spielers; spielerisch zahlt der Gegner für den Schutz und der Goldify-Spieler bekommt trotzdem das Gold und seine Aktion zurück.
- **Beobachtet:** In (a) und (b) überlebt Ba; Sitz 0 erhält trotzdem +5 Gold, die Zusatzaktion (Lv ≤ 1) bleibt (Phase 3), die Token-Kosten sind bezahlt.
- **Repro:** `docs/niche-tests/repro/A01-pollution/26-goldify-gold-trotz-ueberlebender-kreatur.js` (✗ = Gold fließt trotz überlebender Kreatur)
- **Vermutete Ursache:** `goldify.js` (~Z. 163–185): `await engine.actionDestroyCard(ctx.card, inst)` – das Ergebnis wird nicht ausgewertet, Gold und `_spellFreeAction` folgen unbedingt.
- **Frage an Al:** Soll Goldify Gold (und die Zusatzaktion) auch dann liefern, wenn die gewählte Kreatur **nicht besiegt** wurde (Schutz) – ja oder nein?

### A01-pollution-27 · Living Illusion: „You cannot summon Creatures for the rest of the turn“ sperrt Effekt-Beschwörungen nicht · Stufe B
- **Karten:** Living Illusion (`living-illusion.js`), Reincarnation (Kreaturen-Weg), Thep (Held-Effekt), Soul Shard Ka/Khet (über `summonFromDiscard`/`summonCreatureWithHooks`); die Sperre selbst: `ps.summonLocked`
- **Voraussetzungen / Aufbau:** Sitz 0: 2× Living Illusion, Reincarnation, Dummy-Kreatur auf der Hand; 2× Royal Corgi im Deck, Royal Corgi in der Ablage. Zweiter Aufbau: Thep als Held 0 mit Summoning Magic 3, Soul Shard Ba in der Ablage (schon zu Zugbeginn dort).
- **Schritte:** 1. Erste Living Illusion (setzt `summonLocked`). 2. Kontrolle: Kreatur aus der Hand. 3. Zweite Living Illusion. 4. Reincarnation (Kreatur aus der Ablage). 5. Thep platziert Soul Shard Ba.
- **Erwartet** (Quelle: Kartentext „You cannot summon Creatures for the rest of the turn afterwards“; CARD_API.md Z. 1972: die Beschwörungssperre „sperrt in der Engine Hand-, Effekt-Beschwörungen UND Platzierungen“; Z. 18167: „`ps.summonLocked` — immer (jede echte Beschwörung)“; Z. 1968: „PLATZIEREN durch einen Effekt zählt als Effekt-Beschwörung“): unter der Sperre wird keine weitere Kreatur beschworen oder platziert.
- **Beobachtet:** Hand-Beschwörung wird abgelehnt (Kontrolle ✓) und Necromancy ist gesperrt (`doActivateFreeAbility` → `false`). Aber: die zweite Living Illusion setzt eine zweite Kreatur (2 Corgis), Reincarnation (Ablage → Brett) eine dritte (3 Corgis), und Thep platziert Soul Shard Ba (die Shard-Effekte würden danach ebenfalls feuern). Die Sperre wird nur an der Hand-Prüfung, in `actionPlaceCreature` (`_engine.js` ~25989) und bei per Lader markierten Summon-only-Karten (`blockedBySummonLock`) gelesen.
- **Repro:** `docs/niche-tests/repro/A01-pollution/27-living-illusion-summonsperre-greift-nicht.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `summonCreatureWithHooks` (`_engine.js` ~14899) und `summonFromDiscard` prüfen `ps.summonLocked` nicht; Living Illusion, Reincarnation, Thep, Ka und Khet gehen darüber. Abhilfe: Wächter in `summonCreatureWithHooks` bei `isPlacement`/Effekt-Beschwörung (der Hand-Weg ist schon geprüft). Querschnittsnahe Lücke: dieselbe Sperre setzt auch Create Illusion (`create-illusion.js:186`) – nicht geprüft, ob dort dasselbe zu beobachten ist.

### A01-pollution-28 · Reincarnation: „once per game“ gilt je Held, nicht je Spieler – Regelfrage · Stufe C
- **Karten:** Reincarnation (`reincarnation.js`)
- **Voraussetzungen / Aufbau:** Sitz 0: Held 1 und Held 2 gefallen, 2× Reincarnation auf der Hand, genug freie Zonen (2 je Karte); Modus „Revive Hero".
- **Schritte:** 1. Reincarnation → Held 1. 2. Zweite Reincarnation (dasselbe Spiel) → Held 2.
- **Erwartet** (Quelle: Kartentext „You can only revive a Hero with „Reincarnation“ **once per game**“): unklar – wörtlich ist „a Hero … once per game“ ein Spielerlimit (vgl. „You can only play 1 „Eraser Beam“ per game“); das Skript liest es als „jeder Held höchstens einmal“ (`hero.reincarnationRevived`, Kopfkommentar „Each Hero can be revived by Reincarnation AT MOST ONCE per game“).
- **Beobachtet:** Beide Wiederbelebungen laufen durch (Helden [800, 800, 800] nach der zweiten Karte, 4 Tokens). Im Skript steht keine Rulings-Quelle für die je-Held-Lesart; `CARD_API.md` erwähnt die Karte nicht.
- **Repro:** `docs/niche-tests/repro/A01-pollution/28-reincarnation-einmal-pro-spiel-je-held-oder-je-spieler.js` (✗ = zweite Wiederbelebung geht durch; unter der Lesart „je Spieler“ ein Fehler)
- **Vermutete Ursache:** `reincarnation.js` `getReviveTargets`: Sperre nur über das Heldenflag `reincarnationRevived`, kein Spieler-Zähler.
- **Frage an Al:** Darf Reincarnation im Spiel **einmal je Held** (zwei Helden = zwei Wiederbelebungen) oder insgesamt **nur einmal** einen Helden wiederbeleben?

### A01-pollution-29 · Royal Corgi: gestohlen wirkt das „+3 max. Handgröße“ für den Besitzer statt für den Kontrolleur · Stufe B
- **Karten:** Royal Corgi (`royal-corgi.js`), Engine `enforceHandLimit` / `_checkReactiveHandLimits`; Klasse „Besitzer ODER Kontrolleur“ (Prüfauftrag)
- **Voraussetzungen / Aufbau:** Sitz 1 beschwört Royal Corgi, Sitz 0 stiehlt sie (`actionStealCreature(0, inst)`: owner 1, controller 0, liegt auf Sitz 0s Brett); beide Seiten halten 9 Handkarten.
- **Schritte:** 1. `engine.enforceHandLimit(0)`, dann `enforceHandLimit(1)`. 2. Handgrößen lesen.
- **Erwartet** (Quelle: Kartentext „**Your** max hand size is increased by 3“; Konvention owner/controller, README §4 Familie 5): der Kontrolleur (Sitz 0) hat Limit 10 und wirft nicht ab; der Besitzer (Sitz 1) hat die Corgi nicht mehr unter Kontrolle und bleibt bei 7.
- **Beobachtet:** Umgekehrt: Sitz 0 wirft auf 7 ab, Sitz 1 behält seine 9 Karten. Die Zählschleifen filtern mit `inst.owner === playerIdx`; der Bonus bleibt beim Besitzer, obwohl die Karte nicht mehr auf seinem Brett liegt. Der Dieb hat nichts davon, das Opfer behält den Vorteil.
- **Repro:** `docs/niche-tests/repro/A01-pollution/29-royal-corgi-gestohlen-bonus-geht-an-besitzer.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `cards/effects/_engine.js` ~16863 (`enforceHandLimit`) und ~16993 (`_checkReactiveHandLimits`): `inst.owner === playerIdx`; dieselbe Eigentümer-Lesart steht laut Quelltext auch in der Rückprüfung beim Tod/Wegzug (`handLimitAffectedOwners.add(e.inst.owner)`, ~13927 `cardInstance.owner`) – nur gelesen, nicht gemessen. Gilt für jede Karte mit `handLimitReduction`.

### A01-pollution-30 · Pollution Spewer: das „einmal pro Zug“ hängt an (Besitzer, Held, Slot) statt an der Karte · Stufe B
- **Karten:** Pollution Spewer (`pollution-spewer.js`); Klasse „Besitzer ODER Kontrolleur“ / positionsbezogene Stempel
- **Voraussetzungen / Aufbau:** (a) Spewer auf Sitz 0 feuert (Token weg), wird zerstört, ein zweites Exemplar kommt in denselben Slot. (b) Zwei Spewer desselben Besitzers (Sitz 1): einer auf Sitz 1s Brett, der andere von Sitz 0 gestohlen und auf Sitz 0s Brett – beide an Held 0 / Slot 0.
- **Schritte:** 1. `removePollutionTokens` für den Seitenbesitzer (a: zweimal nacheinander; b: erst Sitz 0, dann Sitz 1) im selben Zug. 2. Zielabfragen zählen.
- **Erwartet** (Quelle: Kartentext „Once per turn, when a Pollution Token is removed from **your** side of the board …“; Skriptkopf „HOPT is tracked per-instance“): jede Karte feuert einmal pro Zug – (a) das neue Exemplar noch einmal, (b) beide Spewer je einmal (der eine für Sitz 0, der andere für Sitz 1).
- **Beobachtet:** (a) und (b) je nur 1 Schuss: der Schlüssel ist `pollution_spewer:${cardOriginalOwner}:${cardHeroIdx}:${zoneSlot}` – bei (b) haben beide Karten Besitzer 1 und dieselbe Position (Brettseite fehlt im Schlüssel), bei (a) ist der Schlüssel nach dem Tod der ersten Karte noch gesetzt. Gegenprobe: der eigene Spewer allein feuert normal.
- **Repro:** `docs/niche-tests/repro/A01-pollution/30-pollution-spewer-hopt-schluessel-nach-position.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `cards/effects/pollution-spewer.js` `hoptKey` – müsste `ctx.card.id` (Instanz) nutzen. Nische (Diebstahl + gleiche Position / Ersatz im selben Slot desselben Zuges); (a) ist ohne Diebstahl erreichbar.

### A01-pollution-31 · Anti Magic Enchantment greift nur bei Schaden – Status-Zauber (Cold Coffin, Medusa's Curse, Null Zone) treffen den Helden ungehindert · Stufe B
- **Karten:** Anti Magic Enchantment (`anti-magic-enchantment.js`, Engine-Teil `_maybePromptAntiMagicEnchantment`); betroffen: Cold Coffin, Medusa's Curse, Null Zone (alle drei selbst Pollution-Karten – das natürliche Gegenstück zur AME)
- **Voraussetzungen / Aufbau:** Sitz 1: Blade of the Frostbringer an Held 0 mit verzaubertem Zähler (`antiMagicEnchanted {ownerPi:1, charges:1}`, genau so wie ihn das Skript setzt); Sitz 1 antwortet überall „Ja“. Sitz 0 wirkt den Zauber auf Held 0.
- **Schritte:** 1. `t.play(0, <Zauber>, {hero: 0})`. 2. AME-Angebote, Ladung und Heldenstatus lesen. Gegenprobe Pyroblast.
- **Erwartet** (Quelle: Kartentext „… that Hero's controller may once per turn make the Hero **unaffected by a Spell that hits it**“; Skriptkopf: „negate the effects of a Spell that hits this Artifact's equipped Hero“): bei jedem Zauber, der den Helden trifft, erscheint das Angebot; bei „Ja“ bleibt der Held frei von Frost, Betäubung bzw. Null-Status.
- **Beobachtet:** Pyroblast/Eraser Beam: Angebot, Ladung 1 → 0, kein Schaden ✓. Cold Coffin, Medusa's Curse, Null Zone: **kein** Angebot, Ladung bleibt 1, Held 0 ist gefroren (Cold Coffin: für den Rest des Spiels), betäubt bzw. „nulled“. Das Angebot hängt allein an `actionDealDamage` (`_engine.js` ~8180); der gezielte Weg `_checkAntiMagicEnchantmentNegation` (~35303) hat keinen einzigen Aufrufer.
- **Repro:** `docs/niche-tests/repro/A01-pollution/31-anti-magic-enchantment-ignoriert-status-zauber.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_engine.js` ~8180 / ~35303: das Schild wird nur vor Schaden erfragt. Die Status-/Buff-/Heilungspfade lesen `_isAmeShieldedHero` (~17817, ~44747) zwar, aber ohne vorherigen Schaden wird nie gefragt. Abhilfe: das (tote) Ziel-Fenster `_checkAntiMagicEnchantmentNegation` an der Zielwahl bzw. beim Statussetzen durch einen Zauber aufrufen. Restunsicherheit: ob die Autoren die AME bewusst auf Schaden beschränkt haben (der Kartentext sagt „a Spell that hits it“).

### A01-pollution-32 · Circle-of-Hell-Replay umgeht „nur ein Zauber pro Zug“ (Eraser Beam) und „keine weitere Area“ (Reality Crack) · Stufe B
- **Karten:** The Fifth Circle of Hell (stellvertretend für alle Circles 2–8), Dante (Auslöser), Eraser Beam, Reality Crack; Engine `_castSpellImmediately` / `getHeroEligibleActionCards`
- **Voraussetzungen / Aufbau:** Sitz 0: Dante (Destruction Magic 3 + Magic Arts 3), Fifth Circle of Hell und Heal auf der Hand, eine gelöschte Area im Stapel (Dantes Vorbedingung); „Ja“ auf alles. (a) Echtes `t.play(0, 'Eraser Beam')`, (b) echtes `t.play(0, 'Reality Crack')` (Area-Wahl abgebrochen).
- **Schritte:** 1. Eraser Beam bzw. Reality Crack spielen. 2. `t.activateHero(0, 0)`: Dante Weg 1, die Fifth Circle aus der Hand löschen. 3. Nach-Ketten-Aktion (Replay-Angebot „Ja“).
- **Erwartet** (Quelle: Eraser Beam „This must be the only Spell you play this turn“; Reality Crack „You cannot play another Area for the rest of the turn afterwards“; Circle „… **play** this deleted Spell as an additional Action“ – ein Area-Zauber, der gespielt wird): kein Replay; die Karte bleibt im Gelöscht-Stapel. (Kontrolle: Heal aus der Hand ist nach Eraser Beam gesperrt.)
- **Beobachtet:** In beiden Fällen erscheint das Replay-Angebot und die Fifth Circle liegt danach als Area auf dem Brett – im selben Zug ein zweiter Zauber nach Eraser Beam bzw. eine zweite Area nach Reality Crack. Die Wirker-Probe (`moeglicheWirker` → `getHeroEligibleActionCards`) liest weder `ps._spellLockTurn` noch `ps._cantPlayAreaThisTurn`. (Umgekehrt ist es richtig: Circle-Replay zuerst, danach Eraser Beam wird abgelehnt.) Fall (c): The Third Circle of Hell (Deck zeigen, einen Area-Zauber „if possible“ als Zusatzaktion spielen) nach einem echten Reality Crack spielt ebenfalls eine zweite Area (Fourth Circle) – dort läuft die Probe über `performImmediateActionAnyHero` und liest die Area-Sperre gleichfalls nicht.
- **Repro:** `docs/niche-tests/repro/A01-pollution/32-circle-replay-umgeht-zauber-und-area-sperre.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** Die beiden Sperren stehen nur in `getHeroPlayableCards` (`_engine.js` ~20061) und `validateActionPlay` (~20866/~20870), nicht in `getHeroEligibleActionCards`/`_castSpellImmediately`; betroffen ist jeder Zusatzaktions-Pfad darüber (Circles, vermutlich auch andere „play as an additional Action“-Karten). Restunsicherheit: ob die Autoren das Replay bewusst als Ausnahme von den Sperren verstehen (`_hell-circles-shared.js` nennt Schulprüfung, Kette und Zusatzaktion, aber keine Sperren).

### A01-pollution-33 · Pollution Piranha: „leaves the board“ – gestohlen stirbt sie folgenlos, beim Versetzen innerhalb der Seite löst sie fälschlich aus · Stufe B
- **Karten:** Pollution Piranha (`pollution-piranha.js`); Auslöser: `actionStealCreature`, `actionTransferCreature` (Weg von Liberation, Diplomacy, Capture, Dark Gear)
- **Voraussetzungen / Aufbau:** (a) Piranha von Sitz 0, von Sitz 1 gestohlen (owner 0, controller 1); sie stirbt. (b) Piranha wird von Held 0 in die Zone von Held 1 derselben Seite versetzt und bleibt auf dem Brett. Beide Seiten halten Handkarten.
- **Schritte:** (a) `actionStealCreature(1, pir)`, `actionDestroyCard(…, pir)`. (b) `actionTransferCreature(pir, 0, 1, 0)`. Gelöscht-Stapel und Hände vergleichen.
- **Erwartet** (Quelle: Kartentext „**When this Creature leaves the board**, delete 1 card from **your** hand“): (a) das Sterben ist ein Verlassen des Bretts → eine Handkarte wird gelöscht (beim Kontrolleur; die Lesart „Besitzer“ wäre die zweite, das Skript meint den Besitzer: `ownerIdx = self.owner`). (b) Ein Versetzen auf dem Brett ist kein Verlassen → keine Löschung.
- **Beobachtet:** (a) Es wird nirgends etwas gelöscht (beide Hände unverändert, kein Prompt). (b) Es wird 1 Handkarte von Sitz 0 gelöscht (Prompt `forceDiscard`), obwohl die Piranha auf dem Brett bleibt. (Der Diebstahl selbst löst – richtig – nichts aus.)
- **Repro:** `docs/niche-tests/repro/A01-pollution/33-piranha-abgangseffekt-gestohlen-und-versetzt.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `pollution-piranha.js` `onCardLeaveZone`: der Guard `ctx.fromOwner !== ctx.cardOwner → return` vergleicht den Besitzer (`fromOwner`) mit dem Kontrolleur (`cardOwner`), sodass jede gestohlene Piranha stumm bleibt; außerdem wird `fromZone === 'support'` ohne Prüfung des Ziels als Abgang gelesen (kein Test auf `toZone`/Verbleib auf dem Brett), also feuert auch ein Versetzen.

### A01-pollution-34 · Sun Beam: Ziel-IDs nach Besitzer statt Brettseite – eine gestohlene Kreatur kollidiert mit der eigenen an derselben Stelle · Stufe B
- **Karten:** Sun Beam (`sun-beam.js`, eigener Sammler); Vergleich The Yeeting / Destructive Puppet Shishi (`_targeting-shared.js` `collectNonHeroBoardTargets`, `_brettSeite`); Klasse „Brettspalte / Besitzer ODER Kontrolleur“ (F02-14, S01-09)
- **Voraussetzungen / Aufbau:** Sitz 1 besitzt eine Royal Corgi (Held 0 / Slot 0), Sitz 0 stiehlt sie: sie liegt auf Sitz 0s Brett an Held 0 / Slot 0 (owner 1, controller 0). Sitz 1 hat zusätzlich eine eigene ZZ Dummy an Held 0 / Slot 0 seines eigenen Bretts. Sitz 0 spielt Sun Beam und wählt die **Dummy**.
- **Schritte:** 1. `t.play(0, 'Sun Beam')`, Zielwahl: ID der Dummy. 2. Prüfen, welche Karte zerstört wurde.
- **Erwartet** (Quelle: Kartentext „Choose up to 3 cards on the board that aren't Heroes and send them to the discard pile“; Konvention aus `_targeting-shared.js` Z. ~60: „ID und `owner` nennen die Seite, auf der die Zone LIEGT“): die gewählte Dummy wird zerstört, die gestohlene Corgi bleibt.
- **Beobachtet:** Beide Einträge tragen die ID `equip-1-0-0`; die Auflösung (`targets.find(t => t.id === id)`) nimmt den ersten Treffer – die **Corgi** wird zerstört (Ablage Sitz 1), die gewählte Dummy bleibt. Menschen können die gestohlene Corgi außerdem gar nicht anklicken (ihre Kachel trägt `owner: 1`, liegt aber auf Sitz 0s Brett). Bei jedem Treffer zahlt Sitz 0 den Token für die falsche Karte.
- **Repro:** `docs/niche-tests/repro/A01-pollution/34-sun-beam-id-kollision-gestohlene-kreatur.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `cards/effects/sun-beam.js` (Sammler: `id: equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`, `owner: inst.owner`) – statt `collectNonHeroBoardTargets` oder `engine.physicalSide(inst)` zu nutzen. Nebenbeobachtung (nicht gewertet): Sun Beam setzt „die gleiche Zahl“ Tokens wie gewählte Karten, auch wenn ein Ziel durch Golden Wings/Warrior überlebt (07, 1 Token bei überlebender Kreatur) – Lesart „gewählt“ vs. „abgelegt“ offen, gleiche Frage wie A01-pollution-26.

### A01-pollution-35 · Mass Multiplication ignoriert die Such-Sperre – holt unter „cannot search or add cards to your hand“ trotzdem 3 Kopien in die Hand · Stufe B
- **Karten:** Mass Multiplication (`mass-multiplication.js`); Sperre aus Cats of the Pharaoh (`ps.searchLocked`, `cats-of-the-pharaoh.js` Z. 168); Lader-Auto-Erkennung `_loader.js` (`DECK_SEARCH_PATTERNS`)
- **Voraussetzungen / Aufbau:** Sitz 0: Mass Multiplication + Fireball auf der Hand, 3 Fireball im Deck, `ps.searchLocked = true` (genau wie Cats es setzt).
- **Schritte:** 1. `t.play(0, 'Mass Multiplication')`, Fireball aus der Hand wählen. 2. Hand, Deck, Gelöscht-Stapel lesen.
- **Erwartet** (Quelle: Cats „you cannot search or add cards to your hand for the rest of the turn“; Such-Template `_search-shared.js` Bauform ① „nur Suchen/Suche ist Schritt 1 und notwendig → `blockedBySearchLock`, gar nicht erst spielbar“; Mass Multiplication „… add up to 3 copies of it **from your deck to your hand**“): die Karte ist gesperrt, mindestens werden keine Karten aus dem Deck in die Hand gelegt und nichts gelöscht.
- **Beobachtet:** `doPlaySpell` → `true`; die Hand-Fireball wird gelöscht, 3 Kopien kommen aus dem Deck in die Hand (Hand 3, Deck 0), Token bezahlt. Die Karte prüft nur `ps.handLocked` (Z. ~214), nicht `engine._isSearchBlocked`; ihr eigener Add-Weg (`deck.splice` + `handZugangSync`) läuft an den Primitiven vorbei, die die Sperre lesen (`actionAddCardFromDeckToHand` u. a.), und der Lader erkennt keines seiner Muster → kein `blockedBySearchLock`.
- **Repro:** `docs/niche-tests/repro/A01-pollution/35-mass-multiplication-ignoriert-such-sperre.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `mass-multiplication.js` ~Z. 209–225; Abhilfe `blockedBySearchLock: true` (Bauform ①) plus `searchBlocked`-Prüfung in der Add-Schleife (die Sperre kann mitten in der Auflösung fallen).

### A01-pollution-36 · Deck-Suchen mit Ergebnis aufs Brett (Doom Prophecy, Living Illusion, Soul Shard Ka) laufen unter der Such-Sperre – Regelfrage · Stufe C
- **Karten:** Doom Prophecy, Living Illusion, Soul Shard Ka (über Thep); Vergleich Masterpiece, Deepsea Witch, Snake Race Boat (prüfen die Sperre)
- **Voraussetzungen / Aufbau:** je Karte `ps.searchLocked = true` (wie Cats); Doom Prophecy (Decay Magic 3, Uhr im Deck), Living Illusion (Summoning Magic 3, Royal Corgi im Deck), Thep → Ka (Royal Corgi im Deck).
- **Schritte:** 1. Karte spielen bzw. `t.activateHero(0, 0)`. 2. Brett/Area lesen.
- **Erwartet** (Quelle: Cats „you cannot **search** or add cards to your hand“; Engine-Kommentar `_engine.js` ~10637: `searchLocked` sperrt „Deck-Suche und Adds“; Such-Template: „alle Such-Effekte“): wörtlich darf auch eine Suche, deren Ergebnis aufs Brett geht, nicht stattfinden – Doom Prophecy und Living Illusion unspielbar (Bauform ①), Ka bietet seine Suche nicht an (Bauform ④: Suchschritt überspringen).
- **Beobachtet:** Alle drei durchsuchen das Deck: Doom Clock liegt in der Area, die Corgi auf dem Brett (Living Illusion: samt Tokens), Ka beschwört die gewählte Kreatur. Der Lader markiert nur To-Hand-Wege als Suche, und die Skripte rufen `searchBlocked` nicht.
- **Repro:** `docs/niche-tests/repro/A01-pollution/36-deck-suche-aufs-brett-ignoriert-such-sperre.js` (✗ = Suche läuft unter der Sperre)
- **Vermutete Ursache:** fehlende `blockedBySearchLock`/`searchBlocked`-Behandlung in `doom-prophecy.js`, `living-illusion.js`, `soul-shard-ka.js`; im Lader fehlt ein Muster für „Suche → Brett/Area“.
- **Frage an Al:** Soll die Such-Sperre (Cats of the Pharaoh, Siege) auch Deck-Suchen sperren, deren Ergebnis **aufs Brett** statt in die Hand geht – ja / nur Suchen-in-die-Hand?

### A01-pollution-37 · Spontaneous Reappearance ist unter der Hand-Sperre spielbar und verpufft · Stufe B
- **Karten:** Spontaneous Reappearance (`spontaneous-reappearance.js`); Vergleich Mass Multiplication (`blockedByHandLock: true`); Klasse „Sperren-Auto-Erkennung“ (B-querschnitt)
- **Voraussetzungen / Aufbau:** Sitz 0: Spontaneous Reappearance auf der Hand, Ablage [Fireball, Heal], `ps.handLocked = true`; „alle Karten wählen“.
- **Schritte:** 1. `t.play(0, 'Spontaneous Reappearance')`. 2. Hand, Ablage, Tokens lesen.
- **Erwartet** (Quelle: Hand-Sperre sperrt „ALLES: Draws UND Suchen/Tutoren/Adds“, `_engine.js` ~10626; Regel `_engine.js` ~20961: Karten mit `blockedByHandLock` sind unter der Sperre nicht spielbar; Kartentext „add them to your hand“ ist der ganze Inhalt der Karte): nicht spielbar, die Karte bleibt auf der Hand.
- **Beobachtet:** `doPlaySpell` → `true`, die Galerie wird gezeigt, die gewählten Karten bleiben in der Ablage (Add gesperrt, 0 Tokens), die Karte liegt in der Ablage – Karte und Aktion verloren. Die Karte trägt nur `blockedBySearchLockDiscard`, und `searchLockLevel` leitet die Stufe nicht aus `handLocked` ab; ein `blockedByHandLock` (wie bei Mass Multiplication) fehlt, und der Lader tagt Spells nicht selbst (`_loader.js` ~420).
- **Repro:** `docs/niche-tests/repro/A01-pollution/37-spontaneous-reappearance-unter-hand-sperre-spielbar.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `spontaneous-reappearance.js` ohne `blockedByHandLock: true`. Unter `drawLocked` (Sacred Jewel) und `searchLocked` funktioniert die Karte richtig (Add läuft, Tokens kommen).

### A01-pollution-38 · 20. Doom Counter und tödlicher Archer-Schuss im selben Ereignis: der Schuss entscheidet, der Counter-Leger gewinnt · Stufe C
- **Karten:** Doom Clock (`_doom-clock-shared.js` `placeCounter`), Archer of Teocuilatl (auch Swift Eagle Warrior als Counter-Leger)
- **Voraussetzungen / Aufbau:** Sitz 0: Doom Clock mit 19 Countern, Archer auf dem Brett; Sitz 1: nur noch Held 0 (40 HP) am Leben. Zugende von Sitz 0 legt den 20. Counter (Zugspieler).
- **Schritte:** 1. `t.endTurn()`. 2. Reihenfolge der `onGameOver`-Aufrufe mitschneiden.
- **Erwartet** (Quelle: Doom Clock „The player that places the 20th Doom Counter onto this card **loses the game**“; Archer „**Whenever** a Doom Counter is placed …, you may choose a target and deal 50 damage“): unklar – plausibel ist, dass der Verlust mit dem Platzieren des 20. Counters sofort eintritt und kein Auslöser mehr dazu kommt (Sitz 0 verliert); die Gegenlesart: beides geschieht im selben Ereignis (Gleichstand – die README nennt für gleichzeitiges Spielende die Regel „draw → you win“).
- **Beobachtet:** Reihenfolge der Aufrufe: `all_heroes_dead` (Sieger Sitz 0), danach `doom_clock` (Sieger Sitz 1). Der echte Server (`endGame`, `server.js` ~6295: `if (gs.result) return`) wertet nur den ersten – der Spieler, der den 20. Counter legt, **gewinnt** durch den Archer-Schuss. Ursache: `placeCounter` ruft zuerst `onDoomCounterPlaced` und prüft erst danach `DOOM_LIMIT`. (Die Harness hält in `engine.over` den letzten Aufruf – dort sähe es nach Niederlage aus.)
- **Repro:** `docs/niche-tests/repro/A01-pollution/38-20-counter-und-archer-schuss-gleichzeitig.js` (✗ = Schuss kommt vor dem Doom-Clock-Verlust)
- **Vermutete Ursache:** `cards/effects/_doom-clock-shared.js` `placeCounter` (Hook-Aufruf vor dem Test auf `DOOM_LIMIT`).
- **Frage an Al:** Löst der Archer-Schuss auf den 20. Counter noch aus (dann gewinnt der Counter-Leger, wenn der Schuss den letzten Helden tötet) oder verliert er sofort – „Uhr verliert zuerst“ / „Schuss darf noch“?

## Abdeckung
| Karte | Tiefe | Geprüfte Nischenfälle / Anmerkung |
|---|---|---|
| Acid Rain | L2 gezielt | Auslöser nur für Zugspieler ✓, Wahl Löschen/Token ✓ (Code: nur eine Option legal → automatisch), Replay aus Gelöscht-Stapel zählt ✗(→ -24), Selbst-Wirken/Reality-Crack-Auslassung ✓ |
| Anti Magic Enchantment | L2 gezielt | Angebot beim Ausrüsten + Token ✓, 1×/Zug-Ladung ✓, schützt vor Fireball/Pyroblast/Eraser Beam ✓; Status-Zauber ✗(→ -31) |
| Archer of Teocuilatl | L2 gezielt | Opfer-Kosten (auch gestohlene Kreatur → Ablage des Besitzers ✓), +4 Gold ✓, Schuss je Counter nur im eigenen Zug ✓, 2 Archer × 3 Counter ✓, 20. Counter ✗(→ -38), Golden-Wings-Kreatur als Opfer ✗(→ -25) |
| Basketskull | L2 gezielt | Mengenwahl 3/5 ✓, Zielwahl-Abbruch (Kosten bezahlt) ✓, Abbruch der Mengenwahl ✗(→ -23), Negation ✗(→ -17), Spiegel-Kopie (→ -15/-16) |
| Cold Coffin | L2 gezielt | Kosten bei Negation ✓, Warrior-Schutz ✗(→ -09), Spiegel (→ -15/-16), AME ✗(→ -31) |
| Dante, the Wanderer of Hell | L2 gezielt | Weg 1 (Level 3, Deck 1 Karte, Löschzahl Level−1) ✓, Weg 2 + Vorbedingung (Ruling) ✓, 1×/Zug ✓, gefroren gesperrt ✓, Circle-Replay (→ -24, -32) |
| Doom Clock | L2 gezielt | Zugende-Counter beider Seiten ✓, 4-mal-Grenze ✗(→ -05), Held besiegt ✗(→ -06), 20. Counter ✗(→ -38), Basketskull/Archer/Eagle/Jaguar-Zusammenspiel ✓ |
| Doom Prophecy | L2 gezielt | Uhr eigene Area ✓, Gegner-Area ✗(→ -07, -08), Area-Limit ✗(→ -13), Suchsperre (→ -36) |
| Eraser Beam | L2 gezielt | Kosten vor der Kette ✓, Limit nach Negation ✗(→ -14), Spiegel (→ -16), AME schützt ✓, „einziger Zauber“ gegen früheren Zauber ✓ / gegen Circle-Replay ✗(→ -32) |
| Ferocious Jaguar Warrior | L2 gezielt | Zusatzaktion nur mit Counter ✓ (Counter wird auch bei freier Aktion bezahlt – Design: Entfernen ist ein Vorteil), Schuss bei Opfer (eigene und gestohlene Opfer, gestohlener Jaguar) ✓ |
| Golden Wings | L2 gezielt | Immunität quellenblind ✗(→ -25), Kosten bei Negation (→ -17), Sun Beam/Warrior-Zusammenspiel (→ -26) |
| Goldify | L2 gezielt | Gold/Zusatzaktion Lv ≤ 1 ✓, Schutz ✗(→ -26), Negation ✗(→ -17) |
| Guardian of Teocuilatl | L2 gezielt | Angebot für eigene Area ✓ (Hand und Brett), fremde Area ✗(→ -10, Regelfrage) |
| Living Illusion | L2 gezielt | Zusatzaktion/Token ✓, Summon-Sperre ✗(→ -27), Suchsperre (→ -36) |
| Magic Mirror | L2 gezielt | Negation + Kopie ✓, Kopie landet in Ablage ✗(→ -15), Kosten/Limit ✗(→ -16) |
| Mana Beacon | L2 gezielt | Handwahl/Token-Wahl ✓, Abbruch ✓, Zusatzaktion für alle 16 Token-Zauber (`placesPollutionTokens` vollständig) ✓, Eraser Beam als Folgezauber nicht anbietbar ✓ |
| Mass Multiplication | L2 gezielt | Abbruch ✗(→ -03), Circle-Löschung/Replay ✓, Hand-Sperre ✓ (Flag), Such-Sperre ✗(→ -35) |
| Medusa's Curse | L2 gezielt | Betäubung nur unversehrter Ziele ✓, Kontrolle statt Seite (gestohlene Kreatur beider Seiten) ✓, Warrior ✗(→ -09), AME ✗(→ -31) |
| Null Zone | L2 gezielt | Dauer ✗(→ -18), vorab negierte Kreatur ✗(→ -19), Kosten bei Negation (→ -17), Tokens bleiben unberührt ✓ |
| Pollution Piranha | L2 gezielt | Voll belegtes Brett ✗(→ -20), Abgangseffekt gestohlen/versetzt ✗(→ -33), Biss/Spewer-Auslösung ✓ |
| Pollution Spewer | L2 gezielt | Auslösung durch Piranha/Victorica/Beacon ✓, Ablehnen erhält Stempel ✓, gestohlener Spewer für den Kontrolleur ✓, Stempel nach Position ✗(→ -30) |
| Pyroblast | L2 gezielt | Zugstempel nach dem Ausspielen ✗(→ -04), Mehrziel-Tokens ✓, Fifth-Circle-Verdopplung ✗(→ -21) |
| Rain of Death | L2 gezielt | Token-Rechnung ✗(→ -02), Starthelden-Abilities bleiben ✓ |
| Reality Crack | L2 gezielt | Alle Areas ablegen ✓, Limit-Fall ✗(→ -12), Circle-Zusammenspiel ✓, Area-Sperre durch Circle-Replay ✗(→ -32) |
| Reincarnation | L2 gezielt | Held beleben/Kreatur platzieren ✓, Einmal-pro-Spiel ✗(→ -28, Regelfrage), Kosten bei Negation ✗(→ -17), Summon-Sperre ✗(→ -27) |
| Royal Corgi | L2 gezielt | Handlimit +3 ✓ (eigene), gestohlen ✗(→ -29), Zähler `handLimitReduction` auch bei Onplay-Aufbau ✓ |
| Soul Shard Ba | L2 gezielt | Zweite Aktion nach Thep/Necromancy ✓ (genau eine zusätzliche), Sperre 1/Zug ✓, Sah-Stempel ✗(→ -11), gestohlen/Schutz (→ -09/-26) |
| Soul Shard Ib | L2 gezielt | Heilung 40 × verschiedene Kreaturen (3 → +120) ✓ |
| Soul Shard Ka | L2 gezielt | Suche + Beschwörung ✓, Negation erst nach Einsatz-Effekt ✗(→ -22), Suchsperre (→ -36) |
| Soul Shard Khet | L2 gezielt | Kette Khet → Sekhem/Ba ✓, Piranha mit/ohne Token ✓ |
| Soul Shard Ren | L2 gezielt | Hand-/Ablage-Zweig ✓, Hand-Option fällt bei Sperre weg (Code) ✓, Deck-Rest ✓ |
| Soul Shard Sah | L2 gezielt | Nachgespielte Effekte (2 verschiedene) ✓, Stempel fremder Shards ✗(→ -11) |
| Soul Shard Sekhem | L2 gezielt | 50 × verschiedene Shards (beide Seiten gezählt, ≥ 1) ✓, Sperre 1/Zug (→ -11) |
| Soul Shard Shut | L2 gezielt | 5 Karten Mill, Deck 2 / Deck 7 ✓ |
| Spontaneous Reappearance | L2 gezielt | Zug-Ende ✗(→ -01), Hand-Sperre ✗(→ -37), Token-Hälfte aufgerundet ✓ |
| Sun Beam | L2 gezielt | Ziel-Schutz/Warrior ✓ (Token trotzdem – Lesart), Erst-Runden-Schutz-Auswahl ✓, ID-Kollision ✗(→ -34) |
| Swift Eagle Warrior | L2 gezielt | Zusatzbeschwörung 1/Zug (zweite abgelehnt) ✓, Zugende-Counter beider Seiten → Ziehen ✓, negiert → kein Ziehen ✓, Hand-/Zieh-Sperre ✓ |
| The Eighth Circle of Hell | L2 gezielt | Löschen und Ziehen beider Richtungen ✓ (Besitzer/Gegner), Zieher mit zu kleinem Deck, einmalige Area ✓, Handlimit des Gegners ✓ |
| The Fifth Circle of Hell | L2 gezielt | Verdopplung ✗(→ -21), Replay ✓, Replay nach Eraser Beam/Reality Crack ✗(→ -32) |
| The First Circle of Hell | L2 gezielt | Ablage ungerade → löschen, Gelöscht gerade → zurück, 0 = Nichts, über 3 Zugwechsel ✓ |
| The Fourth Circle of Hell | L2 gezielt | Gold = Gelöschte ✓, doppelt in Ablage ✗(→ -12), Replay-Kette (→ -24) |
| The Great Clock Tower "Big Gwen" | L2 gezielt | Sofort-Löschung ausgesetzt, Zugende-Abwurf bleibt ✓ (Ruling), Wegfall prüft nach ✓ |
| The Second Circle of Hell | L2 gezielt | Wahl aus Gelöscht-Stapel ✓, Reality-Crack-Kette ✓ |
| The Seventh Circle of Hell | L2 gezielt | Zugende-Treffer für den Zugspieler ✓; Sammler `getCreatureTargets` (Brettspalte, Wurzel F02-14) bestätigt, kein neuer Befund; Abgangs-Treffer ✓ |
| The Sixth Circle of Hell | L2 gezielt | Heldenübernahme bei Abgang ✓, „unaffected by your other cards“ (Fireball kann ihn nicht wählen) ✓, Rückgabe am Zugende ✓ |
| The Third Circle of Hell | L2 gezielt | Deck zeigen, Area-Zauber spielen, Rest löschen, Zahlen ✓; Area-Sperre nach Reality Crack ✗(→ -32), Kartenbilanz ✓ |
| Thep, the Court Scribe | L2 gezielt | Platzieren aus Ablage (Ba/Khet/Ka/Ib/Ren/Shut/Sekhem) ✓, „nicht diesen Zug abgelegt“ (Namensmenge, Doku-Näherung) ✓, Summon-Sperre ✗(→ -27) |
| Victorica, the Eternal Empress | L2 gezielt | nur alte Tokens ✓, frischer Token nicht ✓, 1×/Zug ✓, gefroren gesperrt ✓, Spewer-Auslösung ✓ |
| Warrior of Teocuilatl | L2 gezielt | Schutz vor Goldify/Eraser Beam/Sun Beam ✓ (Uhr −1), vor Status ✗(→ -09) |

## Prüfaufträge
* **Zielsammler Brettspalte / „Besitzer ODER Kontrolleur“ (F02-14, S01-09):** The Seventh Circle (Zugende-Zweig, `getHeroTargets(tp) + getCreatureTargets(tp)`) zeigt die Wurzel: die vom Zugspieler kontrollierte, gestohlene Kreatur fehlt in seiner Liste, dafür steht sie in der Liste des Besitzers (Messung A01_76: Zugende Sitz 0 bietet nur 000, Sitz 1 bietet 100 und die Beute 110) – gleiche Ursache wie F02-14, kein neuer Befund. Eigene, davon unabhängige Stellen: Sun Beam (-34, ID nach Besitzer), Royal Corgi (-29), Pollution Spewer (-30), Pollution Piranha (-33). Medusa's Curse, Golden Wings (Kontrolle) und die Shard-Sammler (`distinctSoulShardsOnBoard`) lesen den Kontrolleur richtig.
* **`physicalSide()` für geliehene Kreaturen:** `removePollutionTokens`/Piranha-Zonenwahl verwenden `physicalSide(inst)` nur für Zonenanzeige von Tokens (Tokens werden nie gestohlen); Medusa nur für die Animation. Wirkung nicht berührt; kein Befund.
* **`counters.currentHp ?? 0` (C05-01):** kein Skript der Gruppe liest `currentHp`; die 50er-Treffer von Piranha/Jaguar/Archer/Spewer auf unversehrte Kreaturen (ZZ Dummy) funktionieren (Messung 150/100 HP).
* **`negatedDuration` (H03-15):** Null Zone und Ka setzen `expiresAtTurn` statt `negatedDuration`; Wirkung dort gemessen (-18, -19, -22).
* **Zugende-Räumung `negated` (C05-02):** keine Karte der Gruppe legt `negated` auf einen Helden; die Kreaturen-Negation von Null Zone überlebt den ersten Zugwechsel (Zug 6 negiert), fällt aber wie in -18 zu früh.
* **Zweite Kopie nach Negierung (F01-19, A01-04/-14):** Pyroblast (-04) und Eraser Beam (-14) zeigen die Klasse; Reality Crack (Area-Sperre) und Reincarnation (Heldenflag) stempeln erst bei Auflösung, ein negierter Zauber lässt sie frei – gleiche Lesart, nicht eigens gemeldet.
* **Handlimit/Pollution-Token mit gestohlenen Kreaturen:** Royal Corgi (-29) trifft den Besitzer; Tokens werden nicht gestohlen; Medusa/Null Zone betreffen Tokens nicht (Messung: Token bleibt aktiv).

## Getestet & in Ordnung (Auswahl)
* Doom-Counter-Kosten der Archetyp-Kreaturen: Jaguar (Picker bei zwei Uhren, Abbruch lässt die Karte in der Hand), Eagle (1 Zusatzbeschwörung je Zug und Spieler, Counter-Platzieren je Instanz, Ziehen je Instanz und Zug, negiert = kein Ziehen).
* Archer: Opfer-Kosten mit gestohlener Kreatur geht in die Ablage des Besitzers; Gold +4; Schuss je Counter nur im eigenen Zug; Doom Prophecy mit 2 Archer löst 6 Schüsse aus.
* Soul Shards: Necromancy-Bypass, 1/Zug je Name, Thep-Platzierung mit „nicht heute abgelegt“, Ba-Zweitaktion (genau eine), Khet → Sekhem-Kette, Ib-Heilung 40 × verschiedene Kreaturen (+120), Ren Hand/Ablage, Shut Mill 5 (auch mit 2 Karten Deck).
* Hell Circles: First Circle über 3 Zugwechsel (ungerade → löschen, gerade → zurück), Eighth Circle beide Richtungen und Zieher mit zu kleinem Deck, Sixth Circle (Übernahme, „unaffected by your other cards“, Rückgabe), Third Circle (Aufdecken, Area spielen, Rest löschen), Dante beide Wege, Big Gwen (Rundenende-Abwurf bleibt).
* Medusa's Curse betäubt nach Kontrolle (beide gestohlenen Richtungen richtig); Pollution Tokens werden von Null Zone/Medusa nicht beeinflusst.
* Warrior of Teocuilatl schützt vor Goldify, Eraser Beam, Sun Beam (Uhr −1); AME schützt vor Fireball/Pyroblast/Eraser Beam (1×/Zug).
* Reality Crack danach Circle-Replay vor Eraser Beam: die Sperre „nur ein Zauber“ greift in dieser Reihenfolge richtig.
