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

<!--BEFUNDE-ENDE-->

## Abdeckung
| Karte | Tiefe | Geprüfte Nischenfälle / Anmerkung |
|---|---|---|
<!--ABDECKUNG-ENDE-->

## Getestet & in Ordnung (Auswahl)
<!--OK-ENDE-->
