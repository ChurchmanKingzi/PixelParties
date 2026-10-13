# A02-deepsea – Nischenfall-Bericht
Stand/Autor: Agent A02-deepsea, 12.10.2026. Karten: 54 in der Liste · (wird am Ende gefüllt) gezielt getestet · (wird am Ende gefüllt) mit Befund.

## Zusammenfassung
(Entwurf – wird am Ende ausgefüllt. Bis dahin wächst der Bericht mit jedem bestätigten Befund.)

## Befunde

### A02-deepsea-01 · Deepsea Siren: Verknüpfung hängt am Platz, nicht an der gewählten Karte · Stufe A
- **Karten:** Deepsea Siren (`cards/effects/deepsea-siren.js`); als Auslöser des Platzwechsels Slippery Narw / Pengu (`_slippery-shared.js`).
- **Voraussetzungen / Aufbau:** Standard-Harness (Sitz 0 am Zug, Aktionsphase). Siren aus der Hand auf Held 0 / Slot 0; Zielwahl: (a) gegnerische Kreatur X auf Held 0 / Slot 0 der Gegenseite, (b) eigener Slippery Narw.
- **Schritte:** (a) X wird zerstört, danach landet eine andere Kreatur Y im selben Platz; der Gegner fügt der Siren 30 Schaden zu, später tödlichen Schaden. (b) Narw rutscht am Zugbeginn in eine andere Spalte; danach erhält die Siren 30 Schaden.
- **Erwartet** (Quelle: Kartentext „Any damage this Creature takes is also applied to that target. When this Creature is defeated by an opponent's card or effect, also defeat the chosen target."): Der Schaden/Tod wird an die **gewählte Karte** weitergegeben – nie an eine andere Kreatur; ein verschobenes Ziel bleibt verbunden.
- **Beobachtet:** (a) Y (nie gewählt) nimmt die 30 gespiegelten Schaden (970/1000) und stirbt, wenn die Siren stirbt. (b) Das gerutschte Ziel (Narw) nimmt nichts mehr; die Verbindung ist faktisch gerissen.
- **Repro:** `docs/niche-tests/repro/A02-deepsea/01-siren-link-slot.js` (`node docs/niche-tests/repro/A02-deepsea/01-siren-link-slot.js`; ✗ = Fehler tritt auf)
- **Vermutete Ursache:** `deepsea-siren.js` `_resolveLinkedTarget` (ca. Z. 55–66) speichert `_sirenLinkOwner/_sirenLinkHeroIdx/_sirenLinkSlotIdx` und sucht das Ziel über die Koordinaten statt über die Instanz-ID.

### A02-deepsea-02 · Zweiter Invader über Argos / Life-Searcher: Karte verschwindet, Kosten verloren · Stufe A
- **Karten:** Argos, the Eye of the Cosmos (`argos-the-eye-of-the-cosmos.js`), Life-Searcher from the Cosmic Depths (`life-searcher-from-the-cosmic-depths.js`), Invader from the Cosmic Depths (`invader-from-the-cosmic-depths.js`).
- **Voraussetzungen / Aufbau:** Seat 0 kontrolliert schon einen Invader. (a) Held Argos mit 4 Change Counters, ein zweiter Invader in Hand bzw. Deck. (b) Life-Searcher auf dem Brett, ≥3 Counter auf einem Analyzer, zweiter Invader im Deck, Phase Main 1.
- **Schritte:** (a) Argos' Heldeneffekt aktivieren, Level 4 und Invader wählen. (b) Life-Searcher-Effekt aktivieren, Invader wählen.
- **Erwartet** (Quelle: Invader-Text „You can only control 1 "Invader from the Cosmic Depths" at a time"; Vorbild Arrival / The Cosmic Depths, die `isCreatureSummonable` vorab fragen): Der zweite Invader wird gar nicht erst angeboten, oder die Platzierung scheitert ohne Verlust (Karte bleibt, keine Kosten).
- **Beobachtet:** (a) Argos bietet Lv4/Invader an, zahlt 4 Counter und nimmt den Invader aus Hand/Deck; `Invader.beforeSummon` lehnt ab (`invader_summon_blocked`) – die Karte ist weder auf dem Brett noch in der Ablage (Kartenbilanz −1). (b) Life-Searcher mischt sich ins Deck, nimmt den Invader aus dem Deck, die Platzierung scheitert → Invader weg, Zone leer; das Log meldet trotzdem `life_searcher_upgrade`.
- **Repro:** `docs/niche-tests/repro/A02-deepsea/02-invader-limit-card-lost.js`
- **Vermutete Ursache:** `argos-the-eye-of-the-cosmos.js` `cdCreaturesAtLevelInHandOrDeck` und der `upgrades`-Filter in `life-searcher-from-the-cosmic-depths.js` (canActivate + onCreatureEffect) prüfen nur `canSummonInvaderViaSource`, nicht das 1-Invader-Limit (`countOwnInvaders`/`canSummon`).

### A02-deepsea-03 · Arrival: die auf die Gegenseite gelegte Kreatur gehört dem Gegner (Ablage, Hand, Zähleffekte) · Stufe B
- **Karten:** Arrival from the Cosmic Depths (`arrival-from-the-cosmic-depths.js`); betroffen: Analyzer, Gatherer, Life-Searcher (jede Kreatur, die Arrival im ersten Schritt platziert); Vergleich: Powder Keg (`powder-keg.js` Z. 30–45).
- **Voraussetzungen / Aufbau:** Seat 0: Arrival auf der Hand, Deck mit Analyzer (Lv1) + Gatherer (Lv2), Held 0 mit Summoning Magic Lv2; Seat 1 leer. Arrival spielen (Zonen-/Galerie-Antworten: erste Option).
- **Schritte:** 1. Arrival: der Analyzer landet in Zone 1 des Gegners, Gatherer wird eigene Kreatur. 2. Ich ziehe per Effekt eine Karte. 3. Der Analyzer wird zerstört. 4. (zweiter Lauf) Der Gegner spielt Shapeshift auf den Analyzer.
- **Erwartet** (Quelle: Kartentext „Choose a "Cosmic Depths" Creature **from your deck** and place it into the free Support Zone of a Hero your opponent controls"; Konvention Powder Keg: Kreatur steht beim Gegner, `originalOwner` = Wirker, „Leichnam in die Ablage des Wirkers"; CARD_API „Gestohlene Karten gehen in die Ablage ihres Besitzers"): Die Karte aus meinem Deck endet in MEINER Ablage und kann der Gegner nicht als eigene Handkarte erbeuten.
- **Beobachtet:** `inst.owner = inst.controller = inst.originalOwner = Gegner`. Zerstörung → die Karte liegt in der ABLAGE DES GEGNERS (Kartenbilanz: er bekommt eine Karte, mein Deck verliert eine). Mit Shapeshift holt der Gegner meinen Analyzer auf SEINE Hand. Der Analyzer zählt „your opponent draws" aus Gegnersicht, also bei MEINEM Ziehen (Counter +1 nach meinem Zug), nicht bei seinem.
- **Repro:** `docs/niche-tests/repro/A02-deepsea/03-arrival-placed-owner.js`
- **Vermutete Ursache:** `arrival-from-the-cosmic-depths.js` ~Z. 245: `summonCreatureWithHooks(firstName, oi, …)` ohne `originalOwner`-Korrektur / ohne Kontrolle beim Wirker (Powder Keg setzt `placed.inst.originalOwner = pi`; Styx-Weg `markiereSeitenfremd` wäre die Alternative).
- **Zusatzfrage an Al (steckt dahinter):** Soll die von Arrival platzierte Kreatur dem Wirker (Kontrolle bei mir, nur der Platz beim Gegner, Ablage bei mir) oder dem Gegner (Platz + Kontrolle beim Gegner, nur die Ablage bei mir) gehören? Die jetzige Mischung (alles beim Gegner) lässt den Analyzer/Gatherer für den Gegner arbeiten und schenkt ihm die Karte.

### A02-deepsea-04 · Geliehener Life-Searcher: Aktivierung hinterlässt Geister-Karte und dupliziert die Karte · Stufe A
- **Karten:** Life-Searcher from the Cosmic Depths (`life-searcher-from-the-cosmic-depths.js`), Deepsea Succubus (Auslöser des Leihens), Analyzer (nur als Zähler-Träger).
- **Voraussetzungen / Aufbau:** Seat 0: Succubus auf der Hand, Analyzer mit 3 Change Counters auf Held 2, Deck mit Invader. Seat 1: Life-Searcher in Held 0 / Slot 0. Gold/Phase Standard, danach Phase Main 2.
- **Schritte:** 1. Succubus spielen, Life-Searcher des Gegners als Ziel (Kontrolle bis Zugende, `stolenBy = 0`). 2. Seinen Effekt aktivieren (Invader als Ziel der Suche).
- **Erwartet** (Quelle: Kartentext „Once per turn, if there are 3 or more Change Counters on cards you control, you may shuffle this Creature you control back into your deck …"; Succubus: „take control of it"; Server lässt die Aktivierung geliehener Kreaturen ausdrücklich zu): Entweder sauberer Ablauf oder gar nicht ausführbar; keine Geister-Einträge, keine Karte aus dem Nichts.
- **Beobachtet:** Der Name „Life-Searcher" bleibt als Geister-Eintrag in der Zone des Gegners (0 Instanzen, `audit`-Meldung), derselbe Name wird zusätzlich in MEIN Deck gemischt (Kartenbilanz +1), der Invader landet auf MEINEM Brett an den Koordinaten des gegnerischen Platzes.
- **Repro:** `docs/niche-tests/repro/A02-deepsea/04-life-searcher-stolen-ghost.js`
- **Vermutete Ursache:** `onCreatureEffect` nimmt `ps = gs.players[inst.controller]` und arbeitet damit auf der falschen Seite (`slotArr = ps.supportZones[heroIdx][slot]`, `returnToPile(ps, 'deck', …)`, `summonCreatureWithHooks(chosen, pi, …)`); es gibt keinen Bezug auf `engine.physicalSide(inst)` / `inst.owner` / `originalOwner`.

### A02-deepsea-05 · Slippery Snobbit: Bonus für „Slippery"-Karten zählt nur Kreaturen · Stufe B
- **Karten:** Slippery Snobbit (`slippery-snobbit.js`, Helfer `isSlipperyCard` in `_slippery-shared.js`); betroffen: Slippery Ice, Slippery Skates (Archetyp „Slippery"), Slippery Fridge (nur im Namen).
- **Voraussetzungen / Aufbau:** Snobbit auf Held 0 / Slot 0, Hand genau 1 Karte (die Testkarte), 4 neutrale Karten im Deck. Verschiebung über den gemeinsamen Weg `moveSlipperyCreature` (derselbe wie Zugbeginn, Ice, Skates, Pengu).
- **Schritte:** Snobbit rutscht auf Held 1; im Abwurf-Dialog genau eine Karte abwerfen (nacheinander Slippery Narw, Slippery Ice, Slippery Skates), dann „Done".
- **Erwartet** (Quelle: Kartentext „If you discard at least 1 "Slippery" card, draw 1 additional card"; `cards.json`: Slippery Ice und Slippery Skates tragen den Archetyp „Slippery"): Abwurf einer beliebigen „Slippery"-Karte → 2 Karten gezogen (1 + Bonus).
- **Beobachtet:** Slippery Narw → 2 gezogen; Slippery Ice / Slippery Skates / Slippery Fridge → nur 1 (kein Bonus).
- **Repro:** `docs/niche-tests/repro/A02-deepsea/05-snobbit-slippery-card.js`
- **Vermutete Ursache:** `slippery-snobbit.js` ~Z. 93 `isSlipperyCard(cardName, engine)` – der Helfer ist absichtlich auf `cardType === 'Creature'` beschränkt (für den Zugbeginn-Mover), Snobbit braucht aber „Slippery card" (Archetyp bzw. Namensbezug).

### A02-deepsea-06 · Slippery Skates: gleichnamige gegnerische Kreatur am selben Platz sperrt die Aktivierung · Stufe A
- **Karten:** Slippery Skates (`slippery-skates.js`), Slippery Narw (Beispiel; jede gleichnamige Kreatur, im Spiegelduell z. B. Narw/Pengu/Snobbit).
- **Voraussetzungen / Aufbau:** Seat 0: Held 0 mit Slippery Narw (Slot 0) und angelegten Skates (Slot 1); Seat 1: ebenfalls Slippery Narw in Held 0 / Slot 0, **früher angelegt** als meine.
- **Schritte:** Skates (`doActivateEquipEffect`) aktivieren.
- **Erwartet** (Quelle: Kartentext „You may once per turn move a Creature in one of the equipped Hero's Support Zones into the free Support Zone of an adjacent Hero"): Meine Narw wird angeboten und lässt sich verschieben.
- **Beobachtet:** `activateEquip` = false, keine Kreatur wird angeboten. Liegt dagegen meine Narw früher in der Instanzliste, funktioniert es – das Ergebnis hängt von der Reihenfolge der Instanzen beider Spieler ab.
- **Repro:** `docs/niche-tests/repro/A02-deepsea/06-skates-same-name-mirror.js`
- **Vermutete Ursache:** `slippery-skates.js` `_getCreaturesOnHero` (~Z. 367): `engine.cardInstances.find(c => c.zone === 'support' && c.heroIdx === heroIdx && c.zoneSlot === zi && c.name === name)` ohne Besitzer-/Seitenvergleich; findet die Instanz des Gegners, die dann am Kontrolleur-Filter scheitert.

### A02-deepsea-07 · Slippery Ice: geliehene Kreatur der Gegenseite wird angeboten, Zug scheitert still, Fenster kehrt wieder · Stufe B
- **Karten:** Slippery Ice (`slippery-ice.js`), Auslöser des Leihens: Deepsea Succubus (hier `actionStealCreature` wie im Skript).
- **Voraussetzungen / Aufbau:** Area Slippery Ice liegt bei Seat 0. Seat 0: eigene Kreatur in Held 1 / Slot 0. Seat 1: Kreatur in Held 1 / Slot 0, von Seat 0 geliehen (Kontrolle bei mir, Brett beim Gegner). Phase Main 1. Der Spielerweg (nicht der CPU-/MCTS-Weg) wird erzwungen, weil die Harness beide Sitze als CPU führt (`isCpuPlayer` → false für diese Aktivierung).
- **Schritte:** Ice aktivieren; als Quelle immer die geliehene Kreatur wählen, jeweils das erste Ziel.
- **Erwartet** (Quelle: Kartentext „move as many Creatures they control as possible into free Support Zones of adjacent Heroes **they also control**"): Die geliehene Kreatur steht bei einem gegnerischen Helden, dessen Nachbarn ich nicht kontrolliere → sie wird nicht angeboten.
- **Beobachtet:** Sie wird angeboten (beschriftet mit dem Namen MEINES Helden an der gleichen Position), als Ziele erscheinen eigene Zonen; die Verschiebung scheitert still (`moveCreature` findet den Namen in der eigenen Zone nicht), ohne `movedInstIds`-Eintrag – das Quellen-Fenster erscheint immer wieder (5 Fenster im Lauf bis zu meinem Notausgang).
- **Repro:** `docs/niche-tests/repro/A02-deepsea/07-ice-stolen-creature-offered.js`
- **Vermutete Ursache:** `slippery-ice.js` `ownSupportCreatures` (Kontrolle) + lokales `destinationsFor`/`moveCreature` (Z. ~78–130, 238–265) arbeiten nur auf `gs.players[activator]`; die physische Seite (`engine.physicalSide(inst)`), die `_slippery-shared.js` benutzt, fehlt. Mit gleichnamiger eigener Kreatur an derselben Koordinate würde sogar deren Name verschoben und die Instanz des Gegners zeigte auf die falsche Seite (nicht reproduziert).

### A02-deepsea-08 · Deepsea Skeleton: zwei gleichnamige Karten sind nicht gemeinsam wählbar · Stufe B
- **Karten:** Deepsea Skeleton (`deepsea-skeleton.js`).
- **Voraussetzungen / Aufbau:** Deck: 2× Deepsea Primordium, Deepsea Bats, ZZ Dummy. Skeleton aus der Hand auf Held 0 / Slot 0.
- **Schritte:** Skeleton spielen, „Ja", Galerie „Choose up to 2 cards in your deck" inspizieren.
- **Erwartet** (Quelle: Kartentext „you may choose up to 2 cards from your deck and send them to your discard pile"): Jede Karte des Decks ist wählbar, also auch beide Exemplare derselben Karte (der Client wählt nach Galerie-Index, siehe `CardGalleryMultiPrompt`).
- **Beobachtet:** Die Galerie hat nur EINE Kachel je Name (`["Deepsea Bats","Deepsea Primordium","ZZ Dummy"]`); zwei Primordium lassen sich nicht zusammen in die Ablage schicken. Der Skript-Kommentar („two picks of the same name mill two copies") trifft damit nicht zu.
- **Repro:** `docs/niche-tests/repro/A02-deepsea/08-skeleton-duplicate-copies.js`
- **Vermutete Ursache:** `deepsea-skeleton.js` onPlay: Galerieaufbau mit `seen.has(cn)`-Dedupe.

### A02-deepsea-09 · Shapeshift / Deepsea Castle: per Succubus geliehene Gegnerkreatur landet dauerhaft auf MEINER Hand · Stufe A
- **Karten:** Shapeshift (`shapeshift.js`), Deepsea Castle (`deepsea-castle.js`), gemeinsamer Baustein `_deepsea-shared.js` (`ownSupportCreatures`, `atomicSwap`), Deepsea Succubus (liefert die geliehene Kreatur).
- **Voraussetzungen / Aufbau:** Seat 1: Deepsea Poltergeister (Lv2) in Held 1 / Slot 0. Seat 0: Hand Succubus, ZZ Dummy und Shapeshift (bzw. Deepsea Castle als Area, Main 1).
- **Schritte:** 1. Succubus spielen, Poltergeister als Ziel (Kontrolle bis Zugende, bleibt auf der Gegenseite). 2. Shapeshift spielen bzw. Castle aktivieren, die geliehene Kreatur als „zu tauschende" wählen, ZZ Dummy als Ersatz.
- **Erwartet** (Quelle: Kartentexte „add a Creature in one of **their Heroes'** Support Zones to **their** hand" (Castle) / „a Creature in one of **your** Heroes' Support Zones" (Shapeshift); CARD_API „Gestohlene Karten gehen in die Ablage ihres Besitzers"): Die Kreatur steht in der Zone eines gegnerischen Helden – sie ist kein Ziel; jedenfalls wandert die Karte nie auf meine Hand.
- **Beobachtet:** Die geliehene Kreatur wird angeboten; nach dem Tausch liegt **Deepsea Poltergeister auf meiner Hand** (Hand des Gegners leer), mein ZZ Dummy steht in der Zone des Gegners. Kartenbilanz je Spieler verschoben: dauerhafter Kartendiebstahl. (Zum Vergleich: Monstrosity bounct eine geliehene Kreatur über `returnSupportCreatureToHand` und schickt sie an den Besitzer.)
- **Repro:** `docs/niche-tests/repro/A02-deepsea/09-stolen-creature-swapped-to-hand.js`
- **Vermutete Ursache:** `ownSupportCreatures` filtert nach Kontrolle der Kreatur (gedacht für Kreaturen auf einem geliehenen HELDEN, Styx 28.9.), nicht danach, ob der **Held** der Zone mir gehört; `atomicSwap` schiebt `bouncedName` an `gs.players[pi].hand` statt an den Besitzer (`inst.owner`/`crossSideControlled`).

### A02-deepsea-10 · Cosmic Manipulation reagiert schon auf das Platzieren (1. Hälfte von Arrival) und kann Arrivals 2. Hälfte zerstören · Stufe C
- **Karten:** Cosmic Manipulation (`cosmic-manipulation.js`), Arrival from the Cosmic Depths (`arrival-from-the-cosmic-depths.js`).
- **Voraussetzungen / Aufbau:** Seat 0: Hand Arrival, Cosmic Manipulation, ZZ Filler; Deck (oberste Karten in dieser Reihenfolge) Analyzer, Gatherer, Life-Searcher, Invader, danach Füllkreaturen; Held 0 mit Summoning Magic Lv3. Reaktions-Frage von Cosmic Manipulation: Standardantwort „Ja".
- **Schritte:** 1. Arrival spielen (erste Wahl Analyzer Lv1 → Zone des Gegners). 2. Reaktionsfenster von Cosmic Manipulation mit „Ja".
- **Erwartet** (Quelle: CM-Text „Play this card immediately when you **summon** a Creature directly from your deck"; Arrival-Text „… **place** it into the free Support Zone …", danach „Then, choose a … Creature 1 level higher … from your deck and summon it"): Offen. Eine Lesart: nur die echte Beschwörung (2. Hälfte, Gatherer Lv2: zieht 2, mischt 1 zurück, +1 Zähler) löst CM aus.
- **Beobachtet:** CM öffnet sich schon nach dem **Platzieren** des Analyzers (Lv1: zieht 1, mischt 0 zurück, kein Zähler). Die gezogene Karte ist hier der Gatherer (oberste Karte) – Arrival findet danach keine Aufwertung mehr (`arrival_fizzle`, Grund `no_upgrade`): 2. Hälfte entfällt, Arrival ist verbraucht (HOPT). Lehnt man CM beim ersten Fenster ab, läuft alles (CM feuert dann an der 2. Hälfte).
- **Repro:** `docs/niche-tests/repro/A02-deepsea/10-cosmic-manipulation-on-place.js`
- **Vermutete Ursache:** `arrival-from-the-cosmic-depths.js` ~Z. 250 setzt für das Platzieren dieselben `deckHookExtras()` wie für die Beschwörung; der Kommentar im Skript setzt „place" bewusst mit „summon regardless of level" gleich.
- **Frage an Al:** Soll Cosmic Manipulation auf das PLATZIEREN (1. Hälfte von Arrival) reagieren, oder nur auf die echte Beschwörung der 2. Hälfte? (Ja = Fensterverhalten bleibt, Nein = 1. Hälfte zählt nicht.)

### A02-deepsea-11 · Invader-Token-Platzierung öffnet das Eintritts-Fenster nicht (Aquatic Arrows bleibt stumm) · Stufe B
- **Karten:** Analyzer from the Cosmic Depths (`runSpawn`), Invader from the Cosmic Depths (`placeInvaderTokens`), Invader Token; Gegenstück: Aquatic Arrows.
- **Voraussetzungen / Aufbau:** Seat 0: Aquatic Arrows verdeckt in Held 0 (Held hat Destruction + Magic Arts), Analyzer mit 2 Change Counters in Held 1, Main 1. Seat 1: Kreatur in Held 0 / Slot 2.
- **Schritte:** Analyzer-Effekt „Spawn" → ein Invader Token in Held 0 / freie Zone des Gegners.
- **Erwartet** (Quelle: Arrows-Text „when a Creature enters a Support Zone of your opponent's Hero in the same position as the user"; CARD_API „Eintritts-Fenster …" Z. ~3573: Beschwörung, place-Effekt UND Bewegung zählen; Pollution-/Mummy-Token laufen über `onCardEnterZone`): Der Token betritt die Zone → Arrows öffnet sich.
- **Beobachtet:** Kontrolle (normale Beschwörung des Gegners an gleicher Position) löst die Arrows aus; der Analyzer-Token wird still mit `engine.summonCreature` gelegt (kein `onCardEnterZone`), die Arrows bleiben liegen. Dasselbe gilt für die 2 Tokens beim Beschwören des Invaders.
- **Repro:** `docs/niche-tests/repro/A02-deepsea/11-token-placement-no-enter-window.js`
- **Vermutete Ursache:** `analyzer-from-the-cosmic-depths.js` ~Z. 215 und `invader-from-the-cosmic-depths.js` ~Z. 162: nach `summonCreature` fehlt der Hook-Lauf (`runHooks('onCardEnterZone', …)`), den `_pollution-shared.js` Z. 189 und `mummy-token.js` Z. 124 haben.

### A02-deepsea-12 · „Cards you control with Change Counters": Zählung nach Brettseite statt nach Kontrolle (geliehene Karten) · Stufe C
- **Karten:** Invader Token (`invader-token.js`), Life-Searcher, Gatherer (alle über `changeCounterCardsOnSide` in `_cosmic-shared.js`), Deepsea Succubus (Auslöser).
- **Voraussetzungen / Aufbau:** (a) Seat 1: Analyzer mit 2 Change Counters in Held 0, Invader Token in Held 1; Seat 0: Succubus (leiht den Analyzer), 1 Handkarte. (b) Seat 0: Life-Searcher, Seat 1: Analyzer mit 3 Counters (von Seat 0 geliehen), Invader im Deck, Main 1.
- **Schritte:** (a) Zug von Seat 0 beenden (Zugende-Auslösung des Tokens). (b) Life-Searcher-Aktivierbarkeit prüfen.
- **Erwartet** (Quelle: Kartentexte „the turn player **controls** no cards with 1 or more Change Counters" / „Change Counters on cards **you control**"; Succubus „take control"): Der geliehene Analyzer zählt als kontrolliert → keine Token-Strafe, Life-Searcher aktivierbar.
- **Beobachtet:** `changeCounterCardsOnSide` vergleicht `t.owner === pi` (Brettseite): der geliehene Analyzer (Besitzer/Brett = Gegner) zählt nicht – der Token verlangt Abwurf/Schaden von mir, Life-Searcher ist nicht aktivierbar, Gatherer bietet die Karte nicht als Quelle an. Die Rückgabe der geliehenen Karte erfolgt erst zum nächsten Zugbeginn, also nach der Zugende-Auslösung.
- **Repro:** `docs/niche-tests/repro/A02-deepsea/12-change-counters-side-not-control.js`
- **Vermutete Ursache:** `_cosmic-shared.js` `changeCounterCardsOnSide` / `allChangeCounterTargets` filtern nach `owner`; `ownCosmicCreatures` im selben Modul nimmt dagegen `controller ?? owner`.
- **Frage an Al:** Zählt eine per Succubus geliehene Karte zum Zugende noch als „von mir kontrolliert" (Ja = Strafe entfällt, Counter zählen mit; Nein = wie jetzt)?

### A02-deepsea-13 · Cosmic Malfunction schützt nur die erste getroffene „Cosmic Depths"-Kreatur · Stufe A
- **Karten:** Cosmic Malfunction (`cosmic-malfunction.js`, Fenster `_checkCdMovementHandReactions` in `_engine.js` ~Z. 34636), Querschnitt: Trial of Dominance (Gegner), Analyzer, Gatherer.
- **Voraussetzungen / Aufbau:** Seat 0: Cosmic Malfunction auf der Hand, Held 0 mit Summoning Magic Lv2; Brett: Analyzer (Held 0), Gatherer (Held 1), ZZ Dummy (Held 2), alle schon eine Runde im Spiel. Seat 1: Trial of Dominance („Defeat all Creatures your opponent controls and delete them").
- **Schritte:** Seat 1 spielt Trial of Dominance; Reaktionsfrage von Cosmic Malfunction mit „Ja".
- **Erwartet** (Quelle: Kartentext „**Negate all effects that card or effect would have on "Cosmic Depths" Creatures you control** this turn"): Beide Cosmic-Depths-Kreaturen bleiben stehen; nur die Fremdkreatur wird besiegt.
- **Beobachtet:** Nur der Analyzer wird gerettet (eine Frage, Karte danach gelöscht). Der Gatherer wird im selben Durchlauf besiegt und gelöscht; der Namenssperre-Teil (`_creationLockedNames`) hilft nicht mehr, weil Trial schon läuft.
- **Repro:** `docs/niche-tests/repro/A02-deepsea/13-malfunction-only-first-victim.js`
- **Vermutete Ursache:** `cdMovementReactionResolve` bricht nur die laufende Entfernung dieses einen Opfers ab (`return true`); für die übrigen Opfer desselben Effekts gibt es kein Merkmal (der Skriptkommentar nennt das als bewusste Einschränkung: „we rely on the source-name lock …").

### A02-deepsea-14 · Token auf die Hand: Shapeshift / Deepsea Castle / Deepsea Encounter erzeugen eine Handkarte „Invader Token" · Stufe B
- **Karten:** Shapeshift (`shapeshift.js`), Deepsea Castle (`deepsea-castle.js`), Deepsea Encounter (`deepsea-encounter.js`) über `_deepsea-shared.js` (`ownSupportCreatures`, `atomicSwap`, `returnSupportCreatureToHand`); Beispiel-Token: Invader Token.
- **Voraussetzungen / Aufbau:** Seat 0: Invader Token in Held 0 / Slot 0 (schon eine Runde im Spiel), Hand: Zauber + ZZ Dummy (bei Encounter: Seat 1 spielt Fireball auf den Token, Encounter ist die Reaktion).
- **Schritte:** Token als zu tauschende/bounce-nde Kreatur wählen, ZZ Dummy als Ersatz.
- **Erwartet** (Quelle: Engine-Konvention – `_enforceSupportZoneLock` (`_engine.js` ~Z. 45373): „echte Karten kehren in die Hand zurück, **Tokens gehen ins Deleted**"; `_addCardToState` ~Z. 48530: Tokens nie in die Ablage): Ein Token ist keine Karte; beim Bounce/Tausch verschwindet er (Gelöscht).
- **Beobachtet:** Alle drei Karten nehmen den Token als wählbare „Creature" an; danach liegt eine Karte **„Invader Token"** auf der Hand (Typ Token, nicht spielbar). Fehler in den Logs: keine.
- **Repro:** `docs/niche-tests/repro/A02-deepsea/14-token-bounced-to-hand.js`
- **Vermutete Ursache:** `returnSupportCreatureToHand` und `atomicSwap` (beide `_deepsea-shared.js`) schreiben `cardName` per `handZugangSync(…, { ohneInstanz: true })` in die Hand, ohne Token-Prüfung (`hasCardType(getEffectiveCardData(inst), 'Token')` → Gelöscht-Stapel); `ownSupportCreatures` nimmt Tokens als Creatures auf.

### A02-deepsea-15 · Dark Deepsea God: „once per game" fehlt, der Flächenschaden löst jeden Zug erneut aus · Stufe B
- **Karten:** Dark Deepsea God (`dark-deepsea-god.js`); mitbetroffen: Deepsea Monstrosity (Kopie), Creepy Villager (ruft `fireDdgAoE`).
- **Voraussetzungen / Aufbau:** Seat 0: Werewolf + Siren (schon eine Runde im Spiel) als Opfer, DDG auf der Hand; Gegner 3× 800 HP. Später (zwei echte Zugwechsel danach): DDG wieder auf der Hand, zwei Opfer wieder auf dem Brett.
- **Schritte:** 1. DDG spielen (Tribut + Platz wählen). 2. Zwei `t.endTurn()`, DDG wieder auf die Hand, zwei Opfer neu legen, DDG ein zweites Mal spielen.
- **Erwartet** (Quelle: Kartentext in `data/cards.json`: „When this Creature is played, deal 150 damage to all targets your opponent controls. **You can only resolve this effect of "Dark Deepsea God" once per game.** This effect can only occur once per turn."; die Engine kennt `oncePerGame`/`oncePerGameEffect`): Der Schaden wird in der ganzen Partie nur einmal aufgelöst.
- **Beobachtet:** Erstes Mal 800 → 650 je Held, zweites Mal (späterer Zug) 650 → 500. Das Skript sperrt nur „einmal pro Zug" (`claimHOPT('ddg_aoe', pi)`), `oncePerGame`/`oncePerGameEffect` fehlen; in CARD_API steht kein Ruling dazu.
- **Repro:** `docs/niche-tests/repro/A02-deepsea/15-ddg-once-per-game.js`
- **Vermutete Ursache:** `dark-deepsea-god.js` `_fireAoEAsSource` ~Z. 127: nur `ddg_aoe`-HOPT. Die Skript-Kommentare (Balancing = Breite des eigenen Bretts, „Trigger je Runde") deuten darauf, dass die Zeile „once per game" nie umgesetzt wurde.
- **Frage an Al:** Soll der 150-Schaden pro Spieler in der ganzen Partie nur ein einziges Mal auflösen („once per game" aus dem Kartentext) oder jedes Mal, wenn DDG gespielt wird (nur 1× je Zug)?

### A02-deepsea-16 · Dark Deepsea God: Rückgabe von 3 Kreaturen zählt für Siphem und Teppes dreimal · Stufe B
- **Karten:** Dark Deepsea God (`dark-deepsea-god.js` Schritt 3), Siphem, the Deepsea Demon, Teppes, the Deepsea Vampire; Vergleich: Shu'Chaku (`fireReturnBatchHook`).
- **Voraussetzungen / Aufbau:** Seat 0: Helden Siphem / Teppes / Tushu; Brett: Werewolf, Siren (Held 0), Witch (Held 1), alle eine Runde alt; Hand: DDG; Deck: 10 Füllkarten. Alle 3 Kreaturen als Tribut gewählt.
- **Schritte:** DDG spielen (Tribut, Landezone).
- **Erwartet** (Quelle: Siphem „Whenever you return **1 or more cards** from your side of the board to your hand, place **1** Deepsea Counter"; Teppes „when **1 or more cards** are added … draw **1** card"; Konvention Shu'Chaku: ein Effekt, der mehrere Karten zugleich zurückgibt, ist ein Ereignis): DDG gibt in einem Zug 3 Kreaturen zurück → Siphem +1, Teppes zieht 1.
- **Beobachtet:** Siphem +3 Counter, Teppes zieht 3 Karten (jede Rückgabe feuert `onCardsReturnedToHand` einzeln). Bei DDG (≥ 2 Opfer, immer) ist der Mehrertrag die Regel.
- **Repro:** `docs/niche-tests/repro/A02-deepsea/16-ddg-return-batch-tally.js`
- **Vermutete Ursache:** DDG ruft `returnSupportCreatureToHand` je Tribut in einer Schleife; ein gebündeltes `fireReturnBatchHook` (wie bei Shu'Chaku) fehlt, und `returnSupportCreatureToHand` feuert selbst pro Kreatur.

### A02-deepsea-17 · Deepsea Spores: im eigenen Zug spielbar, Text nennt nur den Beginn des Gegnerzugs · Stufe C
- **Karten:** Deepsea Spores (`deepsea-spores.js`: `proactivePlay: true`, `inherentAction: true`, `spellPlayCondition: gs.activePlayer === pi`), Baustein `isDeepseaCreature` in `_deepsea-shared.js`.
- **Voraussetzungen / Aufbau:** Seat 0: Spores und Deepsea Zombie auf der Hand, eigene Kreatur (ZZ Dummy) auf dem Brett; Held ohne Summoning Magic.
- **Schritte:** 1. Spores im eigenen Zug spielen. 2. Zombie auf den Platz der eigenen Dummy-Kreatur ziehen.
- **Erwartet** (Quelle: Kartentext „You may activate this card **at the start of your opponent's turn**. For the rest of the turn, all Creatures on the board are treated as "Deepsea" Creatures"): Aktivierung nur zu Beginn des Gegnerzugs (Reaktionsweg; der funktioniert und endet mit dem Zugwechsel).
- **Beobachtet:** Im eigenen Zug spielbar (ohne Aktionskosten), danach gelten alle Kreaturen beider Seiten als Deepsea: der Zombie ersetzt per Bounce-Place die eigene ZZ-Dummy-Kreatur, ohne dass der Held Summoning Magic hat. Der Skript-Kopfkommentar nennt den Weg („Proactively on your OWN turn … for in-hand usage") als Absicht, in CARD_API steht dazu nichts.
- **Repro:** `docs/niche-tests/repro/A02-deepsea/17-spores-proactive-own-turn.js`
- **Frage an Al:** Soll Deepsea Spores auch im eigenen Zug aktivierbar sein (Ja = so lassen, Nein = nur Reaktion zu Beginn des Gegnerzugs)?

### A02-deepsea-18 · Slippery Narw: gewählte Quelle (Ablage) wird ignoriert, wenn dieselbe Kreatur auch im Deck liegt · Stufe B
- **Karten:** Slippery Narw (`slippery-narw.js`).
- **Voraussetzungen / Aufbau:** Seat 0: Narw in Held 0, eigene Kreatur in Held 1; Deck: Deepsea Bats + 2 Füllkreaturen; Ablage: Deepsea Bats, Fireball. Narw verschiebt sich nach Held 2 (gemeinsamer Weg `moveSlipperyCreature`).
- **Schritte:** Narw besiegt die eigene Kreatur in Held 1; in der Galerie die Kachel „Deepsea Bats / discard" wählen (Antwort `{ cardName, source: 'discard' }` wie vom Client).
- **Erwartet** (Quelle: Kartentext „you may choose any Creature from your **deck or discard pile**"; Galerie bietet getrennte Kacheln je Quelle): Die Karte kommt aus der Ablage; das Deck bleibt unberührt.
- **Beobachtet:** Das Skript liest nur `picked.cardName` und nimmt zuerst aus dem Deck: die Deck-Kopie von Bats geht auf die Hand, die Ablage-Kopie bleibt liegen, das Deck wird gemischt.
- **Repro:** `docs/niche-tests/repro/A02-deepsea/18-narw-ignores-source.js`
- **Vermutete Ursache:** `slippery-narw.js` ~Z. 126–146: `takeFromPile(ps, 'deck', chosenName, …)` zuerst, `picked.source` wird nicht gelesen.

## Abdeckung
(wird am Ende gefüllt)

## Getestet & in Ordnung (Auswahl)
(wird am Ende gefüllt)
