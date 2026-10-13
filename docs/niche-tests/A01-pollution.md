# A01-pollution – Nischenfall-Bericht
Stand/Autor: Agent A01-pollution, 12.10.2026. Karten: 49 in der Liste · (wird fortlaufend ergänzt) gezielt getestet · (wird ergänzt) mit Befund.

## Zusammenfassung
(Entwurf – wird am Ende ausgefüllt. Arbeitsstand: Befunde werden nach jedem bestätigten Fall ergänzt.)

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

## Abdeckung
(wird ergänzt)

## Getestet & in Ordnung (Auswahl)
(wird ergänzt)
