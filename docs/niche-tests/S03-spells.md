# S03-spells – Nischenfall-Bericht
Stand/Autor: Agent S03-spells, 13.10.2026. Karten: 41 in der Liste · (wird am Ende ergänzt) gezielt getestet · (wird am Ende ergänzt) mit Befund.

## Zusammenfassung
(Entwurf – wird am Ende ausgefüllt. Arbeitsstand: Befunde werden nach jedem bestätigten Fall ergänzt.)

## Befunde
### S03-01 · The Warlord's Bite zählt Performance doppelt (Staffel 1/2/4 zu hoch) · Stufe B
- **Karten:** The Warlord's Bite (`cards/effects/the-warlord-s-bite.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, Hand [The Warlord's Bite]; Held 0 hat in einer Ability-Zone `['Decay Magic', 'Performance']` (Performance liegt – wie auf der Karte beschrieben – obenauf), Gegner-Held 0 ist Ziel.
- **Schritte:** 1. Spell mit Held 0 spielen, Gegner-Held 0 wählen. 2. Anzahl der Poison-Stacks lesen. Vergleichsläufe: Decay Magic ×1, ×2, ×2 + Performance.
- **Erwartet** (Kartentext „inflict 1/2/4 Stacks of Poison"; Ruling `CARD_API.md` Z. 9097 „Performance zählt beim LEVEL als Joker mit"; Performance-Text „This card becomes a copy of that Ability, increasing it to the next level"): Decay Magic 1 + Performance = Stufe 2 ⇒ **2** Stacks (genau wie Slow bei derselben Aufstellung 3 Karten verlangt).
- **Beobachtet:** **4** Stacks. Decay ×1 ⇒ 1 ✓, Decay ×2 ⇒ 2 ✓, Decay ×2 + Performance ⇒ 4 ✓ (Stufe 3, nur wegen der Kappung nicht sichtbar). `engine.effectiveSchoolLevelForCaster('Decay Magic', 0, 0)` liefert für Decay+Performance bereits 2.
- **Repro:** `docs/niche-tests/repro/S03-spells/01-warlords-bite-performance-doppelt.js` (`node docs/niche-tests/repro/S03-spells/01-warlords-bite-performance-doppelt.js`; ✗ = Fehler tritt auf)
- **Vermutete Ursache:** `the-warlord-s-bite.js` Z. 71–75: `combinedLevel = effectiveSchoolLevelForCaster('Decay Magic', …) + countAbilitiesForSchool('Performance', abZones)`. Der erste Summand enthält die Performance-Joker schon (`_engine.js` ~43243, `isWildcardAbility`), der zweite zählt jede Performance-Karte (auch die in der Decay-Zone) ein zweites Mal. Der Kopfkommentar („combined Decay Magic + Performance") stammt offenbar aus der Zeit vor der zentralen Joker-Regel.

### S03-02 · Slow und Spreading Rumor sperren „die Gegnerhand" mit getrennten Flaggen · Stufe B
- **Karten:** Slow (`slow.js`: `ps.oppHandLocked`), Spreading Rumor (`spreading-rumor.js`: `ps._oppHandInteractionLockedTurn`); betroffen außerdem Rain of Spores, Accusation, Gather Intel, Live Show, Letter of Misinformations (lesen nur die Rumor-Flagge) und Arthor, the King of Blackport (liest nur die Slow-Flagge).
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Sitz 0: Slow + Spreading Rumor + Rain of Spores auf der Hand; Sitz 1: 8 Handkarten (6 × ZZ Dummy zuerst, dann 2 × Fireball).
- **Schritte:** A) Spreading Rumor in Main 1 (Fireball angesagt, 2 Karten fallen, Rumor ist Zusatzaktion) → danach Slow in der Action Phase. B) Slow → danach Rain of Spores. C) Slow → danach Spreading Rumor (Fireball angesagt).
- **Erwartet** (Kartentext Slow: „You cannot interact with your opponent's hand for the rest of the turn afterwards."; Spreading Rumor: „… you cannot interact with your opponent's hand for the rest of the turn afterwards."): Nach der ersten der beiden Karten ist jede weitere Interaktion mit der Gegnerhand in diesem Zug gesperrt (Karte nicht spielbar oder wirkungslos).
- **Beobachtet:** A) Slow zwingt den Gegner zu 2 weiteren Abwürfen (6 → 4). B) Rain of Spores wirft eine Gegnerkarte ab (6 → 5). C) Spreading Rumor wirft beide Fireball ab (2 → 0). Die Sperre wirkt nur gegen Karten, die dieselbe Flagge lesen (Rumor→Rumor, Rumor→Rain of Spores, Slow→Slow).
- **Repro:** `docs/niche-tests/repro/S03-spells/02-slow-spreading-rumor-sperre-getrennt.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `slow.js` Z. 32/70 (`oppHandLocked`, zurückgesetzt in `_engine.js` ~22552) und `spreading-rumor.js` Z. 107/175 (`_oppHandInteractionLockedTurn`) sind zwei Flaggen für dieselbe Regel; die Verbraucher lesen jeweils nur eine (`grep -n "oppHandLocked\|_oppHandInteractionLockedTurn" cards/effects/*.js`).

### S03-03 · Sacrifice to Divinity zieht per eigenem splice an Knight of Kings [B] und der Stab-Sperre vorbei · Stufe B
- **Karten:** Sacrifice to Divinity (`sacrifice-to-divinity.js`); Gegenstücke: Knight of Kings [B] (`blocksOpponentPileOut`), Staff of the Teleporter / of Uncontrollable Destruction (`ps._discardLockedTurn`).
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Sitz 0: Sacrifice to Divinity auf der Hand, eine alte Kreatur als Opfer, je eine Divinity in Ablage / Deck / Hand (jeweils ein eigener Lauf). (a) Sitz 1 kontrolliert Knight of Kings [B] + Rook of Kings [B], Board of Kings liegt. (b) `ps._discardLockedTurn = gs.turn`.
- **Schritte:** 1. Karte spielen, Opfer wählen, als Quelle „deck" bzw. „discard" wählen (Optionswahl). 2. Prüfen, ob die Divinity am Helden hängt.
- **Erwartet** (Kartentext Knight of Kings [B]: „your opponent cannot move cards from their deck or discard pile to anywhere else"; Stab: „You cannot move cards out of your discard pile for the rest of the turn"; Regel `CARD_API.md` „KEIN DIREKTES SPLICEN …" und `pileOutAllowed` „MANDATORY für neue Skripte"): Aus gesperrtem Deck/Ablage lässt sich keine Divinity holen – die Quelle wird nicht angeboten bzw. die Karte ist nicht spielbar.
- **Beobachtet:** In allen drei Läufen (Knight→Ablage, Knight→Deck, Stab→Ablage) wird die Karte gespielt, das Opfer bezahlt und die Divinity hängt am Helden, obwohl `engine.pileOutAllowed(0, …)` `false` liefert. (Der frühere Zusatz „Phantom-Instanz bei Quelle Hand" ist zurückgenommen: dieselbe liegengebliebene `zone:'hand'`-Instanz zeigt sich im Harness auch nach einem normal gespielten Fireball, ist also kein Merkmal dieser Karte.)
- **Repro:** `docs/niche-tests/repro/S03-spells/03-sacrifice-to-divinity-stapelsperren-und-splice.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `sacrifice-to-divinity.js` Z. 160–172 (`removeFromPile` = `pile.splice` auf `ps.hand` / `ps.mainDeck` / `ps.discardPile`) statt `engine.takeFromPile(…)` (Sperren `pileOutAllowed`, `_discardOutAllowed`, Untracking der Quell-Instanz); Rückgabe-Zweig Z. 186–191 pusht ebenfalls roh. Der Wächter `check-no-splice` sieht den Aufruf nicht, weil er über den Parameter `pile` läuft.
- **Nicht gemeldet:** Die Such-Sperre (`searchLocked`, Cats of the Pharaoh) hält die Karte nicht auf – das passt zum Ruling bei Ultimate Weapon Experiment („Deck → direkt aufs Feld ist keine Suche zur Hand").

### S03-04 · Mass Routing / Missing People: gestohlene Kreatur wird aus der falschen Zone gespleißt – Geisterkarte im Slot + Duplikat im Deck · Stufe A
- **Karten:** Mass Routing (`mass-routing.js` `insDeck`), Missing People (`missing-people.js`); Fehlerklasse wie A05-03 (Dive Bomblebee).
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. Sitz 1 besitzt Kreaturen in Held 0 Slot 0/1; Sitz 0 stiehlt die in Slot 0 (`actionStealCreature(0, inst)` – sie bleibt physisch in Spalte 1, `controller` = 0, `owner` = 1). (a) Mass Routing mit Decay Magic 1, Kreatur Level 1. (b) Missing People, Ziel = die gestohlene Kreatur (sie wird angeboten, weil sie physisch bei Sitz 1 steht).
- **Schritte:** 1. Szene bauen (nach dem Diebstahl 80 ms warten – der `onTakeControl`-Hook läuft asynchron). 2. Karte spielen. 3. `t.audit()` und `t.census()` lesen.
- **Erwartet** (Kartentext Mass Routing: „Shuffle all Creatures on the board … back into their original owners' decks."; Missing People: „place it at the bottom of their deck"; Regel „Zone ↔ Instanz konsistent"): Slot leer, Instanz weg, genau eine Kopie im Deck des Besitzers, Kartenbilanz ±0.
- **Beobachtet:** Der Kartenname bleibt in `players[1].supportZones[0][0]` stehen (Instanz getilgt, `audit`: „… 0 Instanzen"), zusätzlich liegt die Karte im Deck des Besitzers ⇒ Kartenbilanz **+1** (duplizierte Karte). In (a) und (b) identisch.
- **Repro:** `docs/niche-tests/repro/S03-spells/04-mass-routing-missing-people-gestohlene-kreatur-geist.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `mass-routing.js` Z. 86–100 (`kps = players[kontrolleur]`, `slotArr = kps.supportZones[heroIdx][slotIdx]`) und `missing-people.js` Z. 140–153 (`seite = inst.controller ?? inst.owner`, `sPs.supportZones…splice`): es muss die Zone der **Brettseite** (`engine.physicalSide(inst)`) geleert werden, nicht die des Kontrolleurs.

### S03-05 · Missing People legt einen Token als normale Karte unten ins Gegnerdeck · Stufe B
- **Karten:** Missing People (`missing-people.js`). (Mass Routing ist nicht betroffen: Tokens haben kein numerisches Level und werden übersprungen.)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Sitz 1 hat einen „Mummy Token" (auch „Biomancy Token", „Invader Token" geprüft) in Held 0 Slot 0, Deck aus 3 Dummys.
- **Schritte:** 1. Missing People spielen, den Token wählen (er wird angeboten). 2. Deck des Gegners ansehen, Gegner zieht 4 Karten.
- **Erwartet** (Regel: Tokens verlassen das Brett nie in Deck/Ablage/Hand – A05-02, `_enforceSupportZoneLock` „Token → Deleted"): Token wird gelöscht (oder ist kein Ziel); im Deck liegt kein Token.
- **Beobachtet:** Das Deck des Gegners endet auf „Mummy Token". Gezogen liegt er als nicht spielbare Handkarte (`doPlayCreature` ⇒ `false`) auf der Hand des Gegners, er belegt dort dauerhaft einen Platz.
- **Repro:** `docs/niche-tests/repro/S03-spells/05-missing-people-token-im-deck.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `missing-people.js` Z. 153 (`bPs.mainDeck.push(inst.name)`) ohne Token-Sonderfall (Token → Gelöscht, `deletedPile` bzw. nur untracken).

### S03-06 · Missing People: Zielliste nach Brettseite statt Kontrolle – Karte spielbar, aber wirkungslos verbraucht · Stufe B
- **Karten:** Missing People (`missing-people.js`); dieselbe Zielwahl-Wurzel betrifft Memory Wipe und Memory Blast (siehe S03-07).
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; meine einzige Kreatur (Sitz 0 Held 0 Slot 0) wird vom Gegner gestohlen (`actionStealCreature(1, inst)`, bleibt physisch bei mir).
- **Schritte:** 1. Missing People spielen.
- **Erwartet** (Kartentext „Choose a Creature your opponent controls"): Die Kreatur wird vom Gegner kontrolliert ⇒ sie ist wählbar (geht unten in MEIN Deck); sonst dürfte die Karte nicht spielbar sein.
- **Beobachtet:** `spellPlayCondition` (zählt nach Kontrolle) lässt das Spielen zu, danach erscheint **keine** Zielwahl (`promptDamageTarget` meldet „keine Ziele" ohne `_spellCancelled`), die Karte liegt in der Ablage, die Aktion ist verbraucht, nichts passiert. Umgekehrt (S03-04 b) wird eine von mir gestohlene Kreatur angeboten, obwohl sie MIR gehört.
- **Repro:** `docs/niche-tests/repro/S03-spells/06-missing-people-kontrolle-statt-brettseite.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_engine.js` `promptDamageTarget` (~4880–4940, `addCreatures(opponentsOf(pi))`): `side: 'enemy'` liest nur die physische Spalte des Gegners; gestohlene Kreaturen liegen aber in der Zone ihres Besitzers. `missing-people.js` filtert das Ergebnis nicht noch einmal nach Kontrolle (`ziel.cardInstance.controller`).

### S03-07 · Memory Blast: ein vom Gegner dauerhaft übernommener eigener Held lässt sich weder wählen noch zurückholen · Stufe B
- **Karten:** Memory Blast (`memory-blast.js` Z. 76–128); Zielwahl-Wurzel wie S03-06 (auch Memory Wipe: „Choose a Hero your opponent controls").
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Gegner übernimmt meinen Held 2 dauerhaft (`actionTakeHeroPermanently(1, 0, 2)`, wie Paraseed Control), Ablage des Gegners 5 Karten, Hand [Memory Blast].
- **Schritte:** 1. Memory Blast spielen, Zielliste lesen. 2. Versuchen, Held 2 zu wählen.
- **Erwartet** (Kartentext „Choose a target your opponent controls … If that target was originally controlled by you, permanently regain control of it instead."; Engine `actionReturnHeroControl`, 11.10., Secret Spell Book: „auch HELDEN, z. B. nach Paraseed Control"): Held 2 ist ein legales Ziel; gewählt ⇒ `permaControlBy` fällt, kein Schaden.
- **Beobachtet:** Zielliste = nur die drei physischen Gegnerhelden (1/0, 1/1, 1/2); mein Held 2 fehlt. Das Skript kennt die Abzweigung ohnehin nur für Kreaturen (Kopfkommentar: „Nur Kreaturen koennen den Besitzer wechseln – bei einem Helden greift die Abzweigung nie"). Gegenprobe ✓: eine per `actionTransferCreature(…, { permanent: true })` zum Gegner gewanderte eigene Kreatur wird korrekt zurückgeholt (kein Schaden). Eine nur per `actionStealCreature` gestohlene Kreatur ist nicht wählbar (siehe S03-06; sie kehrt am Zugbeginn ohnehin zurück).
- **Repro:** `docs/niche-tests/repro/S03-spells/07-memory-blast-held-rueckholung.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `memory-blast.js` Z. 79–84 (`warMeine` nur für Nicht-Helden) + `promptDamageTarget` (nur physische Gegenspalte); der Heldenzweig müsste `heroSideOf`/`permaControlFrom` lesen und `actionReturnHeroControl` rufen.

### S03-08 · Petrifier: wird die Betäubung einer Kreatur geheilt, bleibt sie dauerhaft unverwundbar · Stufe A
- **Karten:** Petrifier (`petrifier.js`), Engine `cleanseCreatureStatuses` (`_engine.js` ~17360) und Schadenspfad (~46187); auslösend jede Heilung der Betäubung: Beer, Juice, Tea, Cure, Divine Zeal, Light Ball …
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Sitz 1 hat eine ZZ-Dummy-Big-Kreatur (1000 HP). Sitz 0 spielt Petrifier auf sie (Betäubung 3 Züge + Marker `counters._petrified`). Sitz 1 ist am Zug und spielt Beer (Gold 100) und wählt „Stunned" zum Entfernen.
- **Schritte:** 1. Petrifier auf die Kreatur. 2. `t.endTurn()`. 3. Sitz 1: Beer, Status „Stunned" heilen. 4. 100 `destruction_spell`-Schaden auf die Kreatur (`actionDealCreatureDamage`); danach vier weitere Zugwechsel, erneut Schaden.
- **Erwartet** (Kartentext „Damage a target **Stunned by this effect** would take becomes 0"; Skriptkopf „Der Marker sitzt AM Stun und verschwindet mit ihm"; `_engine.js` ~45206 „sonst bliebe die Kreatur dauerhaft unverwundbar"): nach dem Heilen der Betäubung nimmt die Kreatur wieder Schaden (1000 → 900).
- **Beobachtet:** Die Betäubung ist weg (`counters.stunned` gelöscht), aber `counters._petrified = 1` bleibt. Schaden: 1000 → **1000**, auch nach vier weiteren Zugwechseln und weiteren Treffern – die Kreatur ist dauerhaft unverwundbar (und bleibt grau). Bei Helden tritt es nicht auf (der Marker liegt IM Status-Objekt und verschwindet mit ihm); bei natürlichem Ablauf der Dauer wird er korrekt gelöscht (geprüft, 6 Zugwechsel).
- **Repro:** `docs/niche-tests/repro/S03-spells/08-petrifier-kreatur-nach-heilung-unverwundbar.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_engine.js` `cleanseCreatureStatuses` (~17360–17380) löscht `stunned`, `stunnedStacks/AppliedBy/AppliedTurn/Duration/Cleansable`, aber nicht `_petrified`; der Marker wird nur beim Dauerablauf (~45208) entfernt. Der Schadenspfad (~46187) prüft den Marker, nicht `counters.stunned`.

### S03-09 · Poison Pollen: gilt „all Stunned targets" vor oder nach dem Betäuben der Vergifteten? · Stufe C
- **Karten:** Poison Pollen (`poison-pollen.js`).
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Gegner-Held 0 ist vergiftet (2 Stacks), nicht betäubt. Hand [Poison Pollen].
- **Schritte:** 1. Poison Pollen spielen. 2. Stacks von Gegner-Held 0 lesen.
- **Erwartet** (Kartentext „Stun all Poisoned targets on the board for 1 turn **and** inflict 1 Stack of Poison to all Stunned targets on the board."): zwei Lesarten. A (Skript, Kopfkommentar „The board is sampled BEFORE any mutation"): Momentaufnahme – Held 0 wird betäubt, bleibt bei 2 Stacks. B (wörtlich der Reihe nach): Held 0 wird erst betäubt und zählt dann zu den „Stunned targets" ⇒ 3 Stacks.
- **Beobachtet:** Lesart A: betäubt, 2 Stacks. (Ein bereits betäubtes Ziel bekommt +1, ein bereits Vergiftetes + Betäubtes beides – ✓ nach Lesart A.)
- **Repro:** `docs/niche-tests/repro/S03-spells/09-poison-pollen-reihenfolge.js` (✗ = Lesart B wird nicht erfüllt)
- **Vermutete Ursache:** `poison-pollen.js` Z. 33–70 (Momentaufnahme `toPoison`/`toStun` vor jeder Änderung) – bewusste Wahl des Skript-Autors, nicht von einem Ruling gedeckt.
- **Frage an Al:** Soll ein von Poison Pollen frisch betäubtes (vergiftetes) Ziel im selben Zauber noch 1 weiteren Gift-Stack bekommen (der Reihe nach) oder nicht (Momentaufnahme)? (der Reihe nach / Momentaufnahme)

### S03-10 · Outbreak ist trotz „in spite of any negative status effects" bei Negated und Blinded nicht spielbar · Stufe B
- **Karten:** Outbreak (`outbreak.js` `canPlayDespiteStatuses`), Engine-Tore in `_engine.js` `validateActionPlay` (~20743 Lähmung, ~20763 Nulled, ~20843 Blinded) und `isHeroIncapacitated` (~42943).
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Hand [Outbreak]; Held 0 trägt genau einen negativen Status (Schleife über alle 17 Einträge von `getNegativeStatuses()`), Ziel: Gegner-Held 0 (500 HP).
- **Schritte:** 1. Outbreak mit dem betroffenen Helden spielen. 2. Schaden am Ziel und Status des Nutzers lesen.
- **Erwartet** (Kartentext „This Spell can only be used by a Hero that is afflicted by at least 1 negative status effect. This Spell can be used in spite of any negative status effects."): in allen 17 Fällen spielbar.
- **Beobachtet:** 14 spielbar (Schaden 100, Status geheilt; nur `nulled` und `soul_transmitted` bleiben – sie stehen nicht in `getCleansableStatuses()`, ist Skript-/Engine-Ruling). **Nicht spielbar:** `negated`, `blinded`, `blinded_hit` (`play` ⇒ `false`, Karte bleibt auf der Hand). Negated: der Handlungsunfähigkeits-Riegel für hart negierte Helden wird vom Bypass nicht erreicht. Blinded: Outbreak trägt `requiresTarget: true`, das Blinded-Tor (`_isHeroBlinded && requiresTarget`) fragt `canPlayDespiteStatuses` nicht. (Gegenprobe: Fireball lässt sich mit `blinded` spielen – es trägt kein `requiresTarget`.)
- **Repro:** `docs/niche-tests/repro/S03-spells/10-outbreak-negated-blinded-nicht-spielbar.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `outbreak.js` `canPlayDespiteStatuses` wird nur an den Lähmungs-/Nulled-/Silence-/Berserk-Toren abgefragt; Blinded-Tor (~20052 und ~20843) und der `negated`-Pfad kennen den Hook nicht.
- **Frage an Al:** Soll Outbreak auch mit einem **negierten** bzw. **geblendeten** Nutzer spielbar sein (Text „any negative status effects" wörtlich)? (ja / nein)

### S03-11 · Pillar of Light: Gegner KANN nicht suchen (Siege), das Skript wertet es trotzdem als „gefunden" · Stufe B
- **Karten:** Pillar of Light (`pillar-of-light.js`); Sperren, die dieselbe Lücke öffnen: Siege (`blocksSearchFor`), Knight of Kings [B] (`blocksOpponentPileOut`), Cats of the Pharaoh-Sperren, die `takeFromPile` verweigern lässt.
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; mein Held 0 trägt Siege; Gegner-Deck enthält 2 × Fireball; ich spiele in Main 1 Pillar of Light (Fireball angesagt).
- **Schritte:** 1. Pillar of Light als Zusatzaktion spielen, Fireball nennen. 2. Gegnerhand, Zieh-Frage, Phase lesen.
- **Erwartet** (Kartentext „Your opponent must search their deck for a card with that name and add it to their hand, **if possible**. If they find a card with the declared name, this counts as an additional Action and you may draw a card."; Siege: „your opponent cannot add cards from their deck or discard pile to their hand outside their Resource Phase"): Der Gegner kann nicht suchen ⇒ nichts gefunden ⇒ keine Zieh-Frage, die Aktion wird wie bei „nicht gefunden" verbraucht.
- **Beobachtet:** `takeFromPile` verweigert (Fireball bleibt im Deck, Gegnerhand leer), das Skript hat den Treffer aber schon als `gefunden` verbucht ⇒ Zieh-Frage („Draw a card?") erscheint, ich ziehe 1 Karte, die Zusatzaktion bleibt erhalten (Phase bleibt Main 1). Der Gegner wird ausgebremst, ich bekomme aber den vollen Nutzen.
- **Repro:** `docs/niche-tests/repro/S03-spells/11-pillar-of-light-gegner-sperre-gilt-als-gefunden.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `pillar-of-light.js` Z. 161–166: `const gefunden = idx >= 0;` wird vor `takeFromPile(...)` gesetzt; der Rückgabewert der Zeile 166 wird nur für die Animation benutzt, `gefunden` müsste auf `false` fallen, wenn `takeFromPile` `false` liefert (Z. 179 `if (gefunden)` / Fehlschlag-Zweig Z. 199).

### S03-12 · „You can only play 1 X per turn": ein NEGIERTES Exemplar zählt nicht gegen die Sperre (Pillar of Light, Rain of Arrows, Refreshing Night) · Stufe C
- **Karten:** Pillar of Light (`pillar-of-light.js` Z. 155), Rain of Arrows (`rain-of-arrows.js` Z. 86–89), Refreshing Night (`refreshing-night.js`); dieselbe Klasse wie S01-02 (Big Oopsie / Butterfly Cloud).
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Sitz 0: zwei Kopien der Karte; Sitz 1: Silence auf der Hand (Held 0 mit Magic Arts). Erste Kopie wird von Silence negiert, danach die zweite Kopie im selben Zug.
- **Erwartet** (Kartentext „You can only play 1 "…" per turn."): Lesart A „gespielt = gezählt" – die zweite Kopie ist nicht spielbar. Lesart B (Skript): gestempelt wird erst im `onPlay`, ein negierter Zauber führt `onPlay` nie aus ⇒ die zweite Kopie wirkt.
- **Beobachtet:** In allen drei Fällen wird die erste Kopie negiert (Silence verbraucht, Karte in der Ablage), die zweite Kopie ist spielbar und wirkt (Rain of Arrows: 800 → 770 HP). Der Kopfkommentar von Rain of Arrows nennt Lesart B ausdrücklich als Konvention („A negated cast … prevents `onPlay` from firing entirely, so the slot stays free — matching the codebase's existing convention for spell HOPT (Acid Vial does the same)"). Fehler tritt also nur gegen Lesart A auf.
- **Repro:** `docs/niche-tests/repro/S03-spells/12-einmal-pro-zug-negiert-pillar-rain-refreshing.js` (✗ = Lesart A wird nicht erfüllt)
- **Vermutete Ursache:** Stempel im `onPlay` statt im Spielweg (`spellPlayCondition` liest `gs.hoptUsed`, gesetzt erst in `onPlay`).
- **Frage an Al:** Soll ein von Silence negiertes „1 pro Zug"-Exemplar die Sperre verbrauchen (wie bei S01-02 gefragt)? (ja / nein – bei „nein" ist die Konvention bestätigt und S03-12 erledigt)

### S03-13 · Telekinesis ist spielbar, obwohl keine Surprise aktivierbar ist – Karte und Aktion verpuffen · Stufe B
- **Karten:** Telekinesis (`telekinesis.js`); Engine `_canHeroActivateSurprise` (`_engine.js` ~36636).
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Held 0 trägt „Booby Trap" (Destruction Magic Lv1) verdeckt in der Surprise Zone; Hand [Telekinesis]; Wirker Held 1 (Magic Arts 1). Drei Fälle, in denen `_canHeroActivateSurprise(0, 0, 'Booby Trap', {reaktor: 0})` = `false` liefert: (a) Held 0 hat die Schul-Voraussetzung nicht (z. B. Ability durch Memory Wipe/Weapon Unleashing weg), (b) Held 0 ist negiert, (c) Held 0 ist `magic_silenced`.
- **Schritte:** 1. Telekinesis spielen. 2. Hand, Ablage, Prompts, Surprise-Zone lesen.
- **Erwartet** (Kartentext „Choose a face-down Surprise you control and activate it."; Regel 23.9 / Konvention „kein wählbares Ziel ⇒ Karte nicht spielbar", so auch bei Mission/Missing People): Telekinesis ist nicht spielbar (oder bleibt nach der Wahl auf der Hand), wenn keine Surprise aktivierbar ist.
- **Beobachtet:** `play` ⇒ `true`, keine Zielwahl, keine Meldung, Telekinesis liegt in der Ablage, die (Zusatz-)Aktion ist verbraucht, die Surprise bleibt verdeckt liegen. Mit Wirker ohne Magic Arts rückt zusätzlich die Phase von Action auf Main 2. Gegenprobe: Hat Held 0 Destruction Magic 1, wird die Surprise aktiviert (Booby Trap → Ablage).
- **Repro:** `docs/niche-tests/repro/S03-spells/13-telekinesis-keine-aktivierbare-surprise-verbraucht.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `telekinesis.js` Z. 43–77 `spellPlayCondition` benutzt `_regulaereZonen` (nur lebend/nicht gefroren/nicht betäubt) und nicht die Prüfung `_canHeroActivateSurprise`, die erst die Zielliste in `_getEligibleTelekinesisTargets` filtert; `onPlay` Z. 87 `if (targets.length === 0) return;` bricht ohne `gs._spellCancelled = true` ab.

### S03-14 · Ultimate Weapon Experiment: ein übernommener (geliehener) Held ist kein gültiger Wirt · Stufe B
- **Karten:** Ultimate Weapon Experiment (`ultimate-weapon-experiment.js` `kandidaten`/`bedingungErfuellt`); Gegenprobe: `performAscension` aus der Hand (`_engine.js` ~49013, Vorgabe 29.9.).
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Sitz 1 hat „Legendary Explorer Dajan" in Held 0, Sitz 0 übernimmt ihn (`actionStealHero(0, 1, 0)`), Gold 100 (Bedingung: 60+ Gold); Sitz 0 hat „Dajan, Conqueror of the Treasure Cave" im Deck (UWE-Lauf) bzw. auf der Hand (Kontrolle).
- **Schritte:** 1. Held übernehmen (80 ms warten). 2a. Ultimate Weapon Experiment spielen. 2b. Kontrolle: `performAscension(0, 0, 'Dajan, Conqueror …', 0, { heroOwner: 1 })`.
- **Erwartet** (Kartentext „Search your deck for an Ascended Hero whose Ascension Conditions are fulfilled by a Hero **you control** and play it on top of that Hero."; Vorgabe 29.9. im Engine-Kommentar: „auch aus der HAND auf einen geliehenen Helden – bei JEDER echten Übernahme (Charme, Golden Apple, Styx …)"): der übernommene Held ist ein gültiger Wirt.
- **Beobachtet:** 2b klappt (Held wird Dajan, Conqueror). 2a: `play` ⇒ `false` („spellPlayCondition"), die Karte bleibt auf der Hand – `kandidaten()` kennt nur die Helden der eigenen Spalte (`ps.heroes`) und ruft `ascensionCondition(gs, pi, hi, engine, pi)` mit der eigenen Brettseite. Dieselbe Aufstellung mit eigenem Helden: Aufstieg, volle Heilung (600/600), Poison + Frozen entfernt ✓.
- **Repro:** `docs/niche-tests/repro/S03-spells/14-ultimate-weapon-experiment-geliehener-held.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `ultimate-weapon-experiment.js` Z. 36–63 (Z. 60 `(ps.heroes || []).map`) und Zielwahl Z. 105: `kandidaten` iteriert `ps.heroes`; der geliehene Held liegt in der Spalte des Besitzers (`engine.heroesControlledBy(pi)` liefert `{ physOwner, heroIdx }`), und `performAscension` bekäme `opts.heroOwner` mit.

### S03-15 · Mission of the Light Brigade + Victory Phoenix Cannon: der VPC-Folgezauber umgeht die Grenze „up to 2 additional Actions" · Stufe B
- **Karten:** Victory Phoenix Cannon (`victory-phoenix-cannon.js` Z. 187–191, `_castSpellImmediately(… alsZusatzaktion: true)`), Mission of the Light Brigade (`mission-of-the-light-brigade.js`, Engine `missionLockActive` / `onConsume`); gleiche Wurzel möglich bei anderen Karten, die einen Zauber innerhalb ihres Effekts als Zusatzaktion wirken (nicht getestet).
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Held 0 mit Destruction Magic 3 + Support Magic 4; Hand [Mission, Victory Phoenix Cannon, Meteor Crash, Rockfall, Rockfall]; Gegner 800 HP.
- **Schritte:** 1. Mission als erste Aktion der Action Phase (2 Ladungen). 2. VPC als Zusatzaktion 1 (Ladung 2→1), Ziel Gegner-Held 0, Ja auf „Cast another Spell?", Folgezauber Meteor Crash. 3. Rockfall spielen.
- **Erwartet** (Kartentext Mission: „You may perform **up to 2** additional Actions this turn. You cannot perform any other additional Actions this turn."; VPC: „… use a level 1 or lower Destruction Magic Spell from your hand with the user **as an additional Action**."): VPC (1) + Folgezauber (2) füllen das Kontingent; danach ist Rockfall nicht spielbar. (Alternativ: der Folgezauber wird als „andere" Zusatzaktion gar nicht angeboten.)
- **Beobachtet:** Folgezauber läuft ohne Mission-Ladung (Ladungen danach: 1), Rockfall wird als dritte Zusatzaktion gespielt (Ladung 0, 200 Schaden). Insgesamt Mission + VPC + Folgezauber + Rockfall = 3 Zusatzaktionen statt höchstens 2. Ein Vierter scheitert („braucht eine Zusatz-Aktion, aber kein Geber passt zur Karte").
- **Repro:** `docs/niche-tests/repro/S03-spells/15-mission-victory-phoenix-cannon-dritte-zusatzaktion.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_castSpellImmediately` verbraucht keine Mission-Ladung (nur der Zuschlag-Sucher und der inhärente Weg `onAnyActionResolved` mit `isInherent`, `_engine.js` ~2938–2949, tun es), und VPC bietet den Folgezauber an, ohne `missionLockActive` zu befragen (die Prüfung steht nur in `kannSofortWirken`, `_engine.js` ~21694).

### S03-16 · Overcharge: unter einer Deck-Sperre (Knight of Kings [B]) geht die alte Ausrüstung verloren, die neue bleibt im Deck · Stufe B
- **Karten:** Overcharge (`overcharge.js`); Sperre: Knight of Kings [B] + Rook of Kings [B] + Board of Kings (`pileOutAllowed(pi, 'deck')` = false).
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Held 0 (Magic Arts 1) trägt „Glass Sword" (Kosten 2); Deck [ZZ Dummy, Club of Gobbo (Kosten 4), ZZ Dummy]; Sitz 1 kontrolliert Knight + Rook, Board of Kings liegt; Galerie-Antwort „Club of Gobbo".
- **Schritte:** 1. Overcharge spielen, Club of Gobbo wählen. 2. Support Zone, Ablage, Deck lesen.
- **Erwartet** (Skript-Kopf, Vorgabe 5.9.: „Ein Equip ohne Nachfolger steht gar nicht erst zur Wahl – sonst wirft man seine Ausrüstung weg und bekommt nichts zurück."; Kartentext „… equip it to the same Hero"; Stapel-Sperre nach CARD_API): Die Karte ist nicht spielbar bzw. nichts wird abgelegt, solange die neue Ausrüstung nicht aus dem Deck geholt werden darf.
- **Beobachtet:** `play` ⇒ `true`, Overcharge in der Ablage, **Glass Sword in der Ablage**, Club of Gobbo bleibt im Deck, Held ohne Ausrüstung. Gegenprobe: ohne Sperre Tausch ✓; mit Stab-Sperre (`_discardLockedTurn`, betrifft nur die Ablage) Tausch ✓.
- **Repro:** `docs/niche-tests/repro/S03-spells/16-overcharge-deck-sperre-ausruestung-verloren.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `overcharge.js` Z. 190–193 `spellPlayCondition`/`zulaessigeZiele`/`aufwertungenImDeck` (Z. 112–127) prüfen `pileOutAllowed(pi, 'deck')` nicht; Z. 273 legt die alte Ausrüstung ab, bevor Z. 277 `takeFromPile` die Sperre feststellt und `onPlay` ohne Abbruch/Rückgabe verlässt.

### S03-17 · Overcharge rüstet „Future Tech Control Device" (nur an Gegner-Helden) an den eigenen Helden aus · Stufe B
- **Karten:** Overcharge (`overcharge.js` `istAusruestbar` Z. 91–106), Future Tech Control Device (`placesOnOpponentBoard: true`); dieselbe Definition steht laut Skript-Kopf auch bei Gate to the Armory (nicht getestet, andere Gruppe).
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Held 0 (Magic Arts 1) trägt „Glass Sword" (Kosten 2); Deck [ZZ Dummy, Future Tech Control Device (Kosten 4), ZZ Dummy]; Galerie-Antwort „Future Tech Control Device".
- **Schritte:** 1. Overcharge spielen. 2. Galerie-Inhalt und Support Zones beider Seiten lesen.
- **Erwartet** (Kartentext FTCD: „Equip this card to a Hero **your opponent controls**."; Overcharge: „choose an **equippable** Artifact"; sonstige Pool-Filter beachten `placesOnOpponentBoard`, z. B. `_hooks.js` `isOwnSideSummonableCreature`, `_engine.js` ~12163): FTCD ist nicht „equippable" an den eigenen Helden und wird nicht angeboten (oder landet beim Gegner).
- **Beobachtet:** FTCD steht in der Galerie und liegt danach in der Support Zone des **eigenen** Helden (Gegnerseite leer); der Übernahme-Effekt kann dort nie greifen (`canActivateEquipEffect` liest `heroSideOf(inst.owner, held) !== pi` – der Gastgeber ist man selbst). Die Aufwertung ist verschwendet und die Karte widerspricht ihrem Text.
- **Repro:** `docs/niche-tests/repro/S03-spells/17-overcharge-future-tech-control-device-eigener-held.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `istAusruestbar` prüft `neverPlayable` und `canEquipToHero`, aber weder `placesOnOpponentBoard` noch `isTargetingArtifact` (vgl. `_engine.js` ~12163).

### S03-18 · Overcharge + Rain Viola: veralteter Deck-Index – die Aufwertung wird dupliziert, eine falsche Deckkarte verschwindet · Stufe A
- **Karten:** Overcharge (`overcharge.js` Z. 265–277), Rain Viola (Ablege-Auslöser „search your deck for any Attack or Spell"); jeder Ablege-Auslöser, der das Deck verändert/mischt, gehört in dieselbe Klasse.
- **Voraussetzungen / Aufbau:** Seeds 1234, 1, 7; Zug 5; Held 0 (Magic Arts 1) trägt „Rain Viola" (Kosten 4); Deck [Fireball, Blade of the Frostbringer (Kosten 5), ZZ Dummy, Meteor Crash]; Galerien: Overcharge → Blade of the Frostbringer, Rain Viola → Fireball.
- **Schritte:** 1. Overcharge spielen, Blade wählen. 2. Kartenbilanz, Deck, Support Zone lesen.
- **Erwartet** (Kartentext „… send it to the discard pile. Then, choose an equippable Artifact … from your deck and equip it to the same Hero."; Regel „Zone ↔ Instanz konsistent", Kartenbilanz ±0): Blade wandert aus dem Deck aufs Brett (genau eine Kopie), Fireball (Rain Viola) in die Hand, ZZ Dummy bleibt im Deck.
- **Beobachtet:** In allen drei Seeds liegt Blade of the Frostbringer **zugleich auf dem Brett und noch im Deck** (Bilanz „Blade +1"), dafür ist **ZZ Dummy aus dem Deck verschwunden** (Bilanz „ZZ Dummy −1"). Ursache ist die Reihenfolge: der Index wird vor dem Ablegen gelesen, Rain Viola sucht beim Ablegen im Deck und mischt, danach nimmt `takeFromPile(ps, 'deck', deckIdx)` per Index die falsche Karte.
- **Repro:** `docs/niche-tests/repro/S03-spells/18-overcharge-rain-viola-veralteter-deckindex.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `overcharge.js` Z. 265 `const deckIdx = (ps.mainDeck || []).indexOf(neuName);` vor `actionMoveCard(altInst, 'discard')` (Z. 273); `takeFromPile(ps, 'deck', deckIdx, …)` (Z. 277) müsste nach dem Ablegen den Namen statt des alten Index übergeben (`takeFromPile` nimmt auch Namen, s. `_engine.js` ~18947) oder den Index neu suchen.

### S03-19 · Teleportal mischt das Deck nach der Suche nicht · Stufe B
- **Karten:** Teleportal (`teleportal.js` Z. 170); Vergleich: Masterpiece, Pillar of Light, Ultimate Weapon Experiment, Overcharge mischen nach ihrer Suche.
- **Voraussetzungen / Aufbau:** Seeds 1234, 5, 77; Zug 5; Deck aus 8 verschiedenen Karten in bekannter Reihenfolge, Teleportal sucht „Fireball" (mittendrin). Kontrolle: Masterpiece mit gleichem Aufbau.
- **Schritte:** 1. Teleportal spielen, Fireball wählen. 2. Reihenfolge der restlichen 7 Karten lesen.
- **Erwartet** (Kartentext „Search your deck for a card …"; Projektkonvention `CARD_API.md` ~Z. 14161 „Die Suchkarten mischen … („search implies a shuffle")" und Z. 19611 „mit Such-Sperre und anschließendem Mischen wie jede Suche"): Das Deck wird nach der Suche gemischt.
- **Beobachtet:** In allen drei Seeds bleibt die Reihenfolge exakt die Ausgangsreihenfolge (ohne Fireball); die Kontrolle (Masterpiece) mischt. Folge: eine zuvor geordnete Deckoberseite (Umordnen/Mill-Reihenfolge) überlebt Teleportal. Lieferung am nächsten eigenen Zugbeginn ✓ (`teleportalUntil` = Zug+1, kommt in Zug 7 auf die Hand).
- **Repro:** `docs/niche-tests/repro/S03-spells/19-teleportal-mischt-das-deck-nicht.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `teleportal.js` Z. 170 `engine.takeFromPile(pi, 'deck', name, { source: CARD_NAME })` ohne `shuffle: true` (vgl. `pillar-of-light.js` Z. 166) und ohne `shuffleDeck`; auch der Abbruchzweig mischt nicht.
- **Frage an Al:** Soll Teleportal nach der Suche mischen wie alle anderen Suchkarten? (ja / nein)
- **Nebenbeobachtung (nicht als Befund geführt, kein Repro):** `zustellenAlleFaelligen` (Z. 93 `ps.permanents.splice`, Z. 102 `actionAddCardToHand`) nimmt den Eintrag aus `ps.permanents`, bevor `actionAddCardToHand` (gibt immer `undefined` zurück, `ok === false` ist also nie wahr) prüft, ob die Hand gesperrt ist; ist `ps.handLocked` bei der Lieferung gesetzt, wäre die Karte verloren. Im Normalspiel räumt der Zugbeginn die Sperre vorher ab, ein natürlicher Auslöser wurde nicht gefunden.

### S03-20 · Surprise Party unter Knight of Kings [B] (Deck-Sperre): Deckoberkarte wird 200-fach ins Deck zurückgelegt bzw. die Creature dupliziert · Stufe A
- **Karten:** Surprise Party (`surprise-party.js` Z. 97–124 Aufdeck-Schleife, Z. 106 `takeFromPileSync`); Sperre: Knight of Kings [B] + Rook of Kings [B] + Board of Kings (`pileOutAllowed(pi, 'deck')` = false). Dieselbe Bauart (Schleife über `ps.mainDeck[0]` + `takeFromPileSync` ohne Prüfung des Ergebnisses) kann auch bei anderen Aufdeck-/Mill-Karten vorkommen (nicht getestet).
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Held 0 Support Magic 2; Deck [Rockfall, Meteor Crash, ZZ Dummy (Creature), Slow] (Variante: [ZZ Dummy, Meteor Crash, Slow]); Sitz 1 kontrolliert Knight + Rook of Kings [B], Board of Kings liegt.
- **Schritte:** 1. Surprise Party spielen. 2. Deckgröße, Support Zone, Kartenbilanz lesen.
- **Erwartet** (Kartentext „Reveal the top card of your deck until …"; Knight of Kings [B] „your opponent cannot move cards from their deck … to anywhere else"; Regel Kartenbilanz ±0): Karte ist nicht spielbar bzw. wirkungslos, das Deck bleibt bei 4 Karten.
- **Beobachtet:** `play` ⇒ `true`. Hauptfall: Das Deck wächst von 4 auf **204** Karten (Kartenbilanz „Rockfall +200"): `takeFromPileSync` verweigert die Entnahme, die Schleife liest aber immer wieder `ps.mainDeck[0]` (Rockfall), schiebt den Namen in `zurueck`, bis `wache < 200` abbricht, und `zurueckMischen` legt alle 200 Kopien ins Deck. Variante (Creature obenauf): die Creature wird auf das Brett gesetzt **und** bleibt im Deck (Bilanz „ZZ Dummy +1"). Ohne Sperre sauber (Bilanz ±0; ohne Creature im Deck und mit Level-4-Creature ebenfalls ±0 ✓).
- **Repro:** `docs/niche-tests/repro/S03-spells/20-surprise-party-deck-sperre-dupliziert-karten.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `surprise-party.js` Z. 106 prüft den Rückgabewert von `takeFromPileSync(ps, 'deck', 0, …)` nicht; `spellPlayCondition` (Z. 64–68) kennt `pileOutAllowed` nicht. Abhilfe: Rückgabewert prüfen (bei `null` abbrechen) bzw. Karte bei gesperrtem Deck nicht spielbar machen.

### S03-21 · Phoenix Tackle: sind nach dem Zauber alle Helden beider Spieler besiegt, GEWINNT der Wirker (Text: „you lose the game") · Stufe A
- **Karten:** Phoenix Tackle (`phoenix-tackle.js`); Engine-Spielende `_engine.js` ~48340–48415 (`_drawLoserIdx`, Bunny-Bombs-Vertrag).
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Held 1/2 beider Seiten auf 0 HP; Gegner-Held 0 = 100 HP, Wirker-Held 0 = 50 HP, Destruction Magic 1 (100 Schaden / 50 Rückstoß); Wirker einmal Sitz 0, einmal Sitz 1.
- **Schritte:** 1. Phoenix Tackle auf den letzten Gegner-Held. 2. `engine.over` lesen.
- **Erwartet** (Kartentext „If all Heroes both players control are defeated after this Spell resolves, you lose the game."): beide Seiten sind nach dem Rückstoß ausgelöscht ⇒ der Wirker verliert.
- **Beobachtet:** Beide Helden stehen am Ende auf 0 HP, `engine.over` = `{ winnerIdx: Wirker, reason: 'all_heroes_dead' }` – der Wirker **gewinnt** (bei beiden Sitzen). Der Gegner stirbt zuerst, die Engine prüft das Spielende in diesem Moment (Wirker lebt noch) und ruft `onGameOver` zugunsten des Wirkers; der Rückstoß kommt zu spät. Die Gleichstand-Auflösung (`draw_resolved`) wird nie erreicht.
- **Repro:** `docs/niche-tests/repro/S03-spells/21-phoenix-tackle-beide-tot-wirker-gewinnt.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `phoenix-tackle.js` Z. 105–121: keinerlei Spielende-Logik (kein `gs._drawLoserIdx = pi`, kein Aufschub der Spielende-Prüfung bis nach dem Rückstoß). Die Prüfung läuft schon im Treffer-Pfad von `dealDamage`.

### S03-22 · Phoenix Bombardment wirkt gegen eine unversehrte Kreatur gar nicht (Rückfall `currentHp ?? 0`, Prüfauftrag C05-01) · Stufe A
- **Karten:** Phoenix Bombardment (`phoenix-bombardment.js` Z. 104); gleiche Klasse wie C05-01 (Wire Hatchling).
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Sitz 1 beschwört „ZZ Dummy" (200 HP, auch „ZZ Dummy Big" 1000 HP geprüft) über den echten Spielweg (`counters = {}`); Sitz 0 mit Destruction Magic 2.
- **Schritte:** 1. Phoenix Bombardment auf die Kreatur. 2. `counters.currentHp`, HP des Wirkers, Zugende lesen.
- **Erwartet** (Kartentext „Reduce a target's HP to 1. Then, the user takes damage equal to the amount of HP reduced by this effect. Immediately end your turn afterwards."): Kreatur auf 1 HP, Rückstoß 199 (999 bei 1000 HP), Zug endet.
- **Beobachtet:** Nichts: `counters` bleibt `{}`, Wirker nimmt keinen Schaden, `_terrorForceEndTurn` wird nicht gesetzt (kein Zugende), keine Meldung; die Aktion ist verbraucht. Gegenprobe ✓: eine Kreatur, die schon 1 Schaden genommen hat (`currentHp` = 199), wird auf 1 gesenkt, Wirker nimmt 198. Das Ziel „unversehrte Kreatur" ist also der Normalfall der ersten Anwendung.
- **Repro:** `docs/niche-tests/repro/S03-spells/22-phoenix-bombardment-unversehrte-kreatur.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `phoenix-bombardment.js` Z. 104 `vorher = inst.counters?.currentHp ?? 0; if (vorher <= 0) return;` – Rückfall auf 0 statt auf die gedruckten HP (`inst.counters.currentHp ?? (cd.hp || 0)` wie `_engine.js` ~45522). Z. 125 (`inst.counters.currentHp = 1`) setzt dann nur den Zähler.

### S03-23 · Rain of Spores: die gerade aufgelöste Karte ist als eigener Abwurf wählbar (R02-07) – kostenloser Zusatzabwurf beim Gegner · Stufe B
- **Karten:** Rain of Spores (`rain-of-spores.js` Z. 40–55: `eligible = (ps.hand).map((_, i) => i)`); Wurzel R02-07 (aufgelöste Karte bleibt in `ps.hand`).
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Sitz 0 Hand [Rain of Spores, Fireball, Fireball, Meteor Crash] (Decay Magic 3), Sitz 1 hat 6 Karten.
- **Schritte:** 1. Rain of Spores spielen. 2. In der Abwurf-Abfrage die laufende Rain of Spores selbst wählen, danach „Done".
- **Erwartet** (Kartentext „Discard any number of cards from your hand. Then … discard the same number of cards +1 from there."): die gerade gespielte Karte ist nicht mehr in der Hand und nicht wählbar; ohne Abwurf verliert der Gegner 1 Karte (6 → 5).
- **Beobachtet:** `eligibleIndices = [0,1,2,3]` – Index 0 ist die laufende Rain of Spores. Wirft man sie „ab", gilt das als 1 Karte: der Gegner wirft 2 ab (6 → 4), die Karte landet ohnehin in der Ablage (Kartenbilanz ±0, `audit` leer). Der Spieler bekommt den Zusatzabwurf also gratis.
- **Repro:** `docs/niche-tests/repro/S03-spells/23-rain-of-spores-laufende-karte-abwerfbar.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `rain-of-spores.js` Z. 40–41 liest `ps.hand` roh (enthält die laufende Karte); es müsste die laufende Instanz ausnehmen (vgl. `engine.handSizeWithoutResolving`, das Supply Chain benutzt).

### S03-24 · Supply Chain (und Voice in your Head): reine Zieh-Karte ist unter Hand-/Zieh-Sperre und gegen Tuscan Artist spielbar und verpufft · Stufe B
- **Karten:** Supply Chain (`supply-chain.js` – kein `blockedByHandLock`, keine `drawWouldBeBlocked`-Zeile im Gate); Voice in your Head (`voice-in-your-head.js`, Stufe C, siehe Frage); Referenz: Brilliant Idea (`blockedByHandLock: true`), die 13 Karten, die `drawWouldBeBlocked` fragen (`_draw-block-shared.js`). Gleiche Klasse wie C01-15 / A07-19 (Prüfauftrag).
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5. (a) `ps.handLocked = true` bzw. `drawLocked = true` (der Zustand nach Rain of Spores / Sacred Jewel), Hand [Supply Chain, Füllkarte]. (b) Tuscan Artist auf Sitz 1; Hand von Supply Chain so, dass 2 bzw. 3 Karten zu ziehen wären (5 bzw. 4 Füllkarten). Voice in your Head mit „Arthor, Inheritor of the Barbarian Sword" (Ascended).
- **Schritte:** 1. Karte spielen. 2. Rückgabe, Hand, Ablage lesen.
- **Erwartet** (CARD_API.md ~Z. 1944 „Draw-only unter Hand-Sperre ⇒ GAR NICHT spielbar"; `_draw-block-shared.js` Ruling 16.8. „Ist der Zug der einzige Nutzen … ist die Karte GESPERRT und wird ausgegraut … verbraucht auch sein Once-per-turn NICHT"): Supply Chain ist in allen vier Fällen nicht spielbar (`play` ⇒ false, Karte bleibt auf der Hand).
- **Beobachtet:** `play` ⇒ `true`, Karte in der Ablage, nichts gezogen, Aktion verbraucht – in allen vier Fällen (Kontrolle: Brilliant Idea ist unter `handLocked` nicht spielbar). Voice in your Head verhält sich unter Hand-/Zieh-Sperre und Artist genauso (Karte weg, nichts gezogen), behält aber die Zusatzaktion („This counts as an additional Action") – dort ist offen, ob der Zusatzaktions-Effekt als „Nutzen" zählt.
- **Repro:** `docs/niche-tests/repro/S03-spells/24-supply-chain-voice-ziehsperren.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `supply-chain.js` hat kein `blockedByHandLock: true` (der Loader taggt Spells bewusst nicht automatisch, `_loader.js` ~420–440, nur `resolve`-Module) und ruft `drawWouldBeBlocked(engine, pi, 7 - handSize)` in `spellPlayCondition` nicht auf; `voice-in-your-head.js` ebenso.
- **Hinweis:** Der Hand-Sperre-Teil gehört in dieselbe vom Loader bewusst offen gelassene Lücke (`_loader.js` ~Z. 456: „eine Verhaltensänderung, die Al entscheiden sollte"); der Tuscan-Artist-Teil (Ruling 16.8.) ist davon nicht gedeckt.
- **Frage an Al:** Soll Voice in your Head unter Hand-/Zieh-Sperre bzw. gegen Tuscan Artist (Ziehen von 2/3) gesperrt sein, obwohl es noch eine Zusatzaktion gibt? (gesperrt / spielbar)

### S03-25 · Weapon Unleashing als erste Karte der Action Phase: das Spielen verbraucht die reguläre Aktion – die „zweite Aktion" bringt nichts · Stufe A
- **Karten:** Weapon Unleashing (`weapon-unleashing.js` `if ((ps._actionsPlayedThisPhase || 0) === 1) gs._preventPhaseAdvance = true;`, Server-Spielweg `server.js` ~8906–8923).
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Held 0: Fighting ×3 + Destruction Magic ×2; Hand [Weapon Unleashing, Fireball ×3]; Gegner 800 HP.
- **Schritte:** A) Weapon Unleashing in Main 1, Action Phase betreten, Fireballs spielen (Kontrolle). B) Weapon Unleashing als erste Karte der Action Phase (`canActivate` erlaubt Phase 2 und 3), danach Fireballs.
- **Erwartet** (Kartentext „You may perform a second Action with the user during your Action Phase this turn. This counts as an additional Action."; Ruling `CARD_API.md` ~Z. 7400 „inherente Zusatzaktion – das Spielen kostet keine Aktion, der Grant gibt die zweite"): in beiden Fällen 2 Fireballs (reguläre Aktion + zweite Aktion).
- **Beobachtet:** A) 2 Fireballs ✓. B) nur **1** Fireball (Gegner 800 → 650), danach Phase 4; direkt nach dem Spielen steht `_actionsPlayedThisPhase = 1`, der erste Fireball verbraucht den Grant, die Phase springt auf Main 2. Drei Fighting-Kopien sind verloren, die Karte hat nichts gebracht. Hero-Bindung (Held 1 darf die zweite Aktion nicht nutzen) ✓.
- **Repro:** `docs/niche-tests/repro/S03-spells/25-weapon-unleashing-action-phase-verliert-zweite-aktion.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** Das Skript setzt `gs._preventPhaseAdvance = true`, wenn es die erste Aktion der Phase ist; dadurch läuft in `server.js` der `else if (… actionCounterIncrementedHere)`-Zweig (Z. ~8918–8923), der den Zähler der kostenlosen ersten Aktion zurücknimmt, nicht, und der Zähler bleibt auf 1.

### S03-26 · Shooting Star unter Stab-Sperre oder Hand-Sperre: spielbar, Karte verbraucht, nichts geholt · Stufe B
- **Karten:** Shooting Star (`shooting-star.js`, `blockedByPileLock: true`); Sperren: Staff of the Teleporter / of Uncontrollable Destruction (`ps._discardLockedTurn`), Rain of Spores (`handLocked`). Gleiche Klasse wie S03-24 (Supply Chain) und S03-03.
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Ablage [Fireball, Meteor Crash], Hand [Shooting Star]; (a) Knight of Kings [B] + Rook + Board of Kings (Kontrolle), (b) `_discardLockedTurn = gs.turn`, (c) `handLocked = true`.
- **Schritte:** 1. Shooting Star spielen (Galerie: erste Karte). 2. Rückgabe, Hand, Ablage lesen.
- **Erwartet** (CARD_API.md ~Z. 1944 „Nur Stapel-Bewegung ⇒ GAR NICHT spielbar … Prüfung `engine.isPileLockedFor(pi)`"; Stab: „You cannot move cards out of your discard pile for the rest of the turn"): (b) und (c) nicht spielbar, Karte bleibt auf der Hand – wie in (a).
- **Beobachtet:** (a) `play` ⇒ false ✓. (b) und (c): `play` ⇒ true, Shooting Star liegt in der Ablage, die Hand bleibt leer, die Aktion ist verbraucht, nichts geholt.
- **Repro:** `docs/niche-tests/repro/S03-spells/26-shooting-star-stab-sperre-handsperre-verpufft.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_engine.js` `isPileLockedFor` (~Z. 2575) fragt nur `pileOutAllowed` (Brett-Sperre Knight of Kings [B]), nicht `_discardLockedTurn`/`_discardOutAllowed`; für (c) fehlt `blockedByHandLock` (der Loader taggt `hooks.onPlay`-Spells bewusst nicht, `_loader.js` ~Z. 456, dort als Entscheidung für Al vermerkt).
- **Frage an Al:** Soll ein reiner Ablage→Hand-Zauber (Shooting Star) unter der Stab-Sperre bzw. Hand-Sperre ausgegraut sein wie unter Knight of Kings [B]? (ja / nein)

### S03-27 · Rewrite History stellt die Kreatur in die Zone eines inzwischen besiegten Helden zurück (normales Beschwören dorthin ist verboten) · Stufe C
- **Karten:** Rewrite History (`rewrite-history.js` `zoneFrei` Z. 15–20).
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Held 0 und 1 mit Magic Arts 3; „Lamenting Knight" in Held 0 Slot 0 wird von einer Gegnerquelle besiegt (protokolliert), danach fällt Held 0 (0 HP); Held 1 wirkt Rewrite History.
- **Schritte:** 1. Rewrite History spielen, Lamenting Knight wählen. 2. Support Zone von Held 0 lesen. Kontrolle: `doPlayCreature` in dieselbe Zone.
- **Erwartet** (Kartentext „place it into the same Support Zone it was in when it was defeated"; Engine-Konvention: eine Kreatur kann nicht in die Zone eines besiegten Helden gesetzt werden): offen. Lesart A: Zone des toten Helden ist kein gültiger Platz ⇒ Kandidat entfällt. Lesart B (Skript): „same Support Zone" gilt wörtlich.
- **Beobachtet:** Lesart B: Der Knight steht danach in der Zone des toten Helden (0 HP). Kontrolle: normales Beschwören dorthin ⇒ `false`. (Staffelung 1/2/3 mit Magic Arts 1/2/3, Performance als Joker, eigener Tod/Gift als Ursache ⇒ nicht gelistet, besetzte Zone ⇒ nicht gelistet, gefrorener Heldenplatz ⇒ gelistet: alle ✓.)
- **Repro:** `docs/niche-tests/repro/S03-spells/27-rewrite-history-tote-heldenzone.js` (✗ = Lesart A wird nicht erfüllt)
- **Vermutete Ursache:** `rewrite-history.js` Z. 15–20 `zoneFrei` prüft `hero?.name` und die leere Zone, nicht `hero.hp > 0` (Gegenstück: die Aquatic-Nachbestückung nimmt tote Zonen laut Ruling CARD_API.md ~Z. 3730 ausdrücklich mit).
- **Frage an Al:** Darf Rewrite History eine Kreatur in die Zone eines besiegten Helden zurückstellen? (ja / nein)

<!--BEFUNDE-ENDE-->

## Abdeckung
| Karte | Tiefe | Geprüfte Nischenfälle / Anmerkung |
|---|---|---|
<!--ABDECKUNG-ENDE-->

## Getestet & in Ordnung (Auswahl)
<!--OK-ENDE-->
