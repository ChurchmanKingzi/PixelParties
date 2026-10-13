# A09-idej – Nischenfall-Bericht
Stand/Autor: Agent A09-idej, 12.10.2026. Karten: 51 in der Liste · (wird am Ende ergänzt) gezielt getestet · (wird am Ende ergänzt) mit Befund.

## Zusammenfassung
(wird am Ende ergänzt)

## Befunde
### A09-01 · Pfeile bleiben nach abgebrochenem Angriff „scharf“ und verstärken den nächsten Angriff · Stufe A
- **Karten:** Angelfeather Arrow (`cards/effects/angelfeather-arrow.js`) und alle anderen Arrows über `_arrows-shared.js` (Bomb, Flame, Golden, Hydra Blood, Poisoned, Racket, Rainbow's)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, Held 0 (Tushu, ATK 40) mit Fighting 1; Hand [Angelfeather Arrow, Attack]; Gegner-Held 0 als Ziel.
- **Schritte:** 1. „Attack“ spielen, den Pfeil ketten (5 Gold), im Zielfenster **abbrechen** (Abbruch-Knopf = `null`) – die Karte „Attack“ kehrt auf die Hand zurück. 2. Danach einen zweiten „Attack“ ohne Pfeil spielen.
- **Erwartet** (Kartentext „Increase *that* Attack's damage by 60“): Der Pfeil gehört zum abgebrochenen Angriff; der zweite Angriff macht 40.
- **Beobachtet:** `hero._armedArrows` enthält den Pfeil nach dem Abbruch weiter; der zweite, pfeillose Angriff macht **100** Schaden (40 + 60). Der Pfeil bleibt scharf, bis irgendein Angriff dieses Spielers sauber aufgelöst wird (auch über Zugwechsel hinweg).
- **Repro:** `docs/niche-tests/repro/A09-idej/01-arrow-bleibt-nach-abbruch-scharf.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `server.js` `doPlaySpell`: `clearArmedArrows` wird im Erfolgszweig (Z. ~8618) und im Negations-Zweig (Z. ~8362) aufgerufen, **nicht** im Abbruch-Zweig `if (gs._spellCancelled && !gs._spellNegatedByEffect)` (Z. ~8424). Die Pfeile werden im Reaktionsfenster **vor** der Zielwahl aufgelöst (LIFO), ein Abbruch der Zielwahl lässt sie also scharf zurück.

### A09-02 · Bonded Companion wird zurück auf die Hand genommen: Karte liegt danach in Hand **und** Ablage (+1 Kopie) · Stufe A
- **Karten:** Bonded Companion Humby / Mellvy / Orphy / Thuly (`_bonded-companions-shared.js`), Racket Arrow (`racket-arrow.js`) bzw. jede Rücknahme über `_deepsea-shared.returnSupportCreatureToHand`
- **Voraussetzungen / Aufbau:** Seed 1234. Seite 1: Held 0 mit „Bonded Companion Humby“ (Slot 0). Seite 0: Held 0 mit Fighting 1, Hand [Racket Arrow, Attack]. (Zusatzprobe: direkte Rücknahme aller vier Companions.)
- **Schritte:** 1. „Attack“ spielen, „Racket Arrow“ ketten, im Pfeil-Zielfenster den Companion wählen.
- **Erwartet** (Kartentext „When this Creature leaves the board, defeat the corresponding Hero“; Kopfkommentar `_bonded-companions-shared.js`: gilt für „JEDEN Abgang … Rückgabe auf die Hand“): Der Held wird besiegt, die Companion-Karte liegt **einmal** (Hand).
- **Beobachtet:** Der Held ist besiegt, aber „Bonded Companion Humby“ liegt **zweimal** vor – auf der Hand und in der Ablage (Kartenbilanz +1). Bei allen vier Companions gleich; keine Engine-Fehlermeldung, `audit()` bleibt still.
- **Repro:** `docs/niche-tests/repro/A09-idej/02-companion-rueckgabe-dupliziert-karte.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_deepsea-shared.js` `returnSupportCreatureToHand` legt die Karte zuerst in die Hand (`handZugangSync`) und feuert danach `onCardLeaveZone`, solange `inst.zone` noch `'support'` ist. `companionAbgang` besiegt den Helden → `onHeroKO` → `companionHeldGefallen` (`_bonded-companions-shared.js`) sieht `ich.zone === 'support'` und schiebt dieselbe Karte per `actionMoveCard` in die Ablage. Die Zerstörung/Ablage/Löschung des Companions ist bilanzneutral (geprüft: destroy, move→discard/hand/deleted, Heldentod, Schaden).

### A09-03 · Bomb Arrow und Racket Arrow wählen einen gegnerischen Bonded Companion, obwohl er „unaffected by effects that can't affect Heroes“ ist · Stufe B
- **Karten:** Bomb Arrow (`bomb-arrow.js`), Racket Arrow (`racket-arrow.js`), Bonded Companion Humby (alle vier)
- **Voraussetzungen / Aufbau:** Seed 1234. Seite 1: Held 0 mit Bonded Companion Humby (Slot 0), Held 1 mit „ZZ Dummy“. Seite 0: Held 0 mit Fighting 1, Hand [Pfeil, Attack].
- **Schritte:** 1. „Attack“ spielen, Bomb Arrow bzw. Racket Arrow ketten, im Pfeil-Zielfenster den Companion wählen (er wird angeboten).
- **Erwartet** (Kartentext Companion: „This Creature is unaffected by cards and effects that can't affect Heroes“; beide Pfeile wählen ausdrücklich „a Creature your opponent controls“ → können keinen Helden treffen): Der Companion wird gar nicht angeboten.
- **Beobachtet:** Die Zielliste enthält den Companion. Bomb Arrow: die 100 Schaden landen über den geteilten HP-Pool am Helden (Verlust 150 statt 50). Racket Arrow: Companion wird auf die Hand genommen und der gegnerische Held ist sofort besiegt (zusammen mit A09-02 sogar mit Kartenverdopplung).
- **Repro:** `docs/niche-tests/repro/A09-idej/03-bomb-racket-arrow-waehlen-companion.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** Der Flaschenhals in `_engine.js` `promptEffectTarget` (~Z. 28040) markiert Companions nur bei `config.types` **ohne** `'hero'` (`isUnaffectedByCreatureOnly`). `bomb-arrow.js` und `racket-arrow.js` bauen ihre Zielliste selbst und rufen `promptEffectTarget` ohne `types` auf.

### A09-04 · Golden Arrow sperrt „spend Gold“ nicht gegenüber Cecilia und Smuggler's Pier · Stufe B
- **Karten:** Golden Arrow (`golden-arrow.js`, `_arrows-shared.js`), Cecilia, the Harrowing Crusader (`cecilia-the-harrowing-crusader.js`), Smuggler's Pier (`smuggler-s-pier.js`)
- **Voraussetzungen / Aufbau:** Seed 1234. Seite 0: Held 0 Tushu (Fighting 1), Held 1 Cecilia; Hand [Golden Arrow, Smuggler's Pier, Attack]; Ablage [Idej Blade - Hakai], Deck mit einem Hakai.
- **Schritte:** 1. Attack + Golden Arrow → `goldLocked`. 2. Cecilia aktivieren, Hakai wählen. 3. Pier ausspielen und aktivieren (10 Gold → 2 Karten).
- **Erwartet** (Kartentext Golden Arrow: „You cannot gain or spend Gold for the rest of the turn afterwards“; CARD_API „Gold: gain, spend, set“: `actionSpendGold` ist durch `goldLocked` gesperrt; Schwesterkarten `anti-magnet.js`, `golden-ladybug.js`, `hel-the-bound-specter.js` prüfen `ps.goldLocked` selbst): Beide Effekte, die Gold als Kosten ausgeben, sind gesperrt.
- **Beobachtet:** Cecilia: Gold bleibt, aber das Artifact wird gelöscht und die Kopie kommt auf die Hand (Kosten „spend all your Gold“ nicht gezahlt – `actionSpendGold` liefert `false`, der Rückgabewert wird ignoriert). Pier: 10 Gold gezahlt (100 → 90), 2 Karten gezogen (Kosten laufen über `_payCardCost`, das `goldLocked` nicht kennt).
- **Repro:** `docs/niche-tests/repro/A09-idej/04-goldsperre-cecilia-und-pier.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `cecilia-the-harrowing-crusader.js` (`canActivateHeroEffect`/`onHeroEffect`) und `smuggler-s-pier.js` (`canActivateAreaEffect`/`onAreaEffect` → `engine._payCardCost`) prüfen `ps.goldLocked` nicht. Zur Frage, ob die Sperre auch normale **Kartenkosten** blocken soll, siehe A09-11 (C). *(Korrektur: der Vorgänger verwies hier auf „A09-13", die ID existierte nicht.)*

### A09-05 · Cecilia zahlt ihr ganzes Gold und löscht das Artifact, wenn die Kopie nicht auf die Hand darf (Hand-/Such-Sperre) · Stufe B
- **Karten:** Cecilia, the Harrowing Crusader (`cecilia-the-harrowing-crusader.js`); Auslöser der Sperre u. a. Smuggler's Pier (`handLocked`, siehe A09-07), Crystal Well, Cats of the Pharaoh (`searchLocked`)
- **Voraussetzungen / Aufbau:** Seed 1234. Seite 0: Held 0 Cecilia, 100 Gold; Ablage [Idej Blade - Hakai], Deck mit einem Hakai; `ps.handLocked = true` bzw. `ps.searchLocked = true`.
- **Schritte:** 1. Heldeneffekt aktivieren, Hakai wählen.
- **Erwartet** (Kartentext „spend all your Gold … to delete an Artifact … **and** add a copy of it from your deck to your hand“; Kopfkommentar des Skripts: Auswahl ohne vorhandene Deckkopie wäre „eine Falle: das gesamte Gold wäre weg, die Karte gelöscht, und die zweite Hälfte liefe ins Leere“): Bei gesperrtem Hinzufügen nicht aktivierbar bzw. Abbruch vor der Zahlung.
- **Beobachtet:** Gold 100 → 0, Hakai aus der Ablage gelöscht, **keine** Karte auf der Hand, Einmal-pro-Zug verbraucht – genau die im Skript beschriebene Falle.
- **Repro:** `docs/niche-tests/repro/A09-idej/05-cecilia-zahlt-unter-hand-und-suchsperre.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `canActivateHeroEffect`/`onHeroEffect` prüfen `handLocked`/`searchLocked` nicht (Vergleich: `tamed-hell-fox.js` bricht bei `ps.handLocked` ab, `elven-rider.js` ebenso); `actionAddCardFromDeckToHand` scheitert still nach der Zahlung.

### A09-06 · Hatusbal sperrt das Zurückmischen aus der Ablage nicht – Priest of Luna/Tempeste zahlen ihre Kosten trotzdem · Stufe B
- **Karten:** Hatusbal, the Leader of Tusca (`hatusbal-the-leader-of-tusca.js`), Priest of Luna (`priest-of-luna.js`), Priest of Tempeste (`priest-of-tempeste.js`, beide über `_priest-shared.js`); Gegenprobe außerhalb der Gruppe: Renewable Energy
- **Voraussetzungen / Aufbau:** Seed 1234. Seite 0: Held 0 mit Summoning Magic 1, Hand [Priest of Luna], Ablage mit 6 Kreaturen verschiedener Namen. Seite 1: Held 1 = Hatusbal (lebend).
- **Schritte:** 1. In Main Phase 1 Priest of Luna beschwören (Zusatzweg: 5 Kreaturen mit verschiedenen Namen zurückmischen).
- **Erwartet** (Kartentext Hatusbal: „Your opponent cannot shuffle cards back into their deck with card effects“; Kopfkommentar: sperrt „ALLE Quellen“): Die Kosten sind unter Hatusbal nicht zahlbar – keine Beschwörung, Ablage/Deck unverändert (ebenso die 2-Karten-Kosten der Passiv-Effekte).
- **Beobachtet:** Priest of Luna kommt aufs Brett, 5 Kreaturen wandern ins Deck. Dasselbe bei Renewable Energy (Ablage → Deck unter Hatusbal).
- **Repro:** `docs/niche-tests/repro/A09-idej/06-hatusbal-sperrt-priest-kosten-nicht.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** Die Hatusbal-Sperre (`_opponentBlocksShuffleBack`) ist nur an Hand-Rückmischern (`actionMulliganCards`, `shuffleBackEligibleHand*`) und Staff of Illusions verdrahtet. `_engine.js` `actionRecycleCards` (Ablage → Deck) fragt sie nicht; `_priest-shared.js` `mischeZurueck` ruft nur `_discardOutAllowed`.

### A09-07 · Smuggler's Pier sperrt mit der vollen Handsperre mehr als „draw cards“ · Stufe B
- **Karten:** Smuggler's Pier (`smuggler-s-pier.js`); betroffen u. a. Elven Rider (Suche), Tamed Hell Fox, Cecilia, Herbithorn Demon (Karte aus der Ablage), Bonded Companion Mellvy (Potion-Zug)
- **Voraussetzungen / Aufbau:** Seed 1234. Seite 0: Pier im Feld, 100 Gold, Elven Archer (Held 0, Slot 0), Hand [Elven Rider], Deck mit Elven Leader (nicht obenauf).
- **Schritte:** 1. Pier aktivieren (5 Gold → 1 Karte). 2. Elven Archer wird besiegt, Elven Rider (Reaktion) bestätigen → Rider-Suche nach einer Elven-Kreatur.
- **Erwartet** (Kartentext Pier: „… they cannot **draw** cards for the rest of the turn afterwards“; gleiche Formulierung bei The Sacred Jewel und Prayer, die `ps.drawLocked` („reiner Zieh-Lock“) setzen; wo auch Suchen/Hinzufügen gesperrt sein soll, sagt der Text es: Kazena, Jenny „cannot draw or add cards“): Suchen bleibt erlaubt.
- **Beobachtet:** Pier setzt `ps.handLocked = true` („sperrt ALLES: Draws UND Suchen/Tutoren/Adds“, `_engine.js` ~10627); die Rider-Suche wird still übersprungen, der Elven Leader bleibt im Deck.
- **Repro:** `docs/niche-tests/repro/A09-idej/07-pier-sperrt-mehr-als-ziehen.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `smuggler-s-pier.js` setzt `ps.handLocked = true` (Kommentar „engine-canonical flag“ stammt aus der Zeit vor `drawLocked`, v1095).

### A09-08 · Bomb Arrow und Infernous Demon verursachen ihren Kreaturenschaden als „Zauberschaden" – Dark Ocean lässt ihn durch · Stufe B
- **Karten:** Bomb Arrow (`bomb-arrow.js`, Artifact), Infernous Demon (`_cycling-demons-shared.js` `bonusDeal50x3`, Creature; Platzierungs-Bonus nach dem Tod von Bouldor Demon); Gegenkarte Dark Ocean
- **Voraussetzungen / Aufbau:** Seed 1234. Dark Ocean in der Area-Zone von Sitz 1; Seite 1: „ZZ Dummy Big" als Opfer. (a) Sitz 0: Held 0 Fighting 1, Hand [Bomb Arrow, Attack]. (b) Sitz 0: Bouldor Demon auf dem Brett, Infernous Demon im Deck.
- **Schritte:** (a) Attack spielen, Bomb Arrow ketten, die Opfer-Kreatur als Bomben-Ziel wählen. (b) Bouldor Demon zerstören, den Zyklus bestätigen, Opfer-Kreatur als Ziel des Infernous-Bonus wählen.
- **Erwartet** (Kartentext Dark Ocean: „Creatures take no damage, except from Attacks and Spells"; Ruling 5.8. `_engine.js` ~46286: nur Schadenstyp `attack` und `destruction_spell` kommen durch; CARD_API „Schadenstypen": Kreatureneffekt = `'creature'`, Artefakt = `'artifact'`, `'destruction_spell'` ist „NICHT für Kreatureneffekte"): Beide Schäden werden von Dark Ocean geblockt (Kontrolle: der Schaden von Elven Archer, Typ `creature`, wird geblockt).
- **Beobachtet:** Bomb Arrow macht 100, Infernous 3 × 50 Schaden an der Kreatur; es gibt kein `dark_ocean_damage_blocked`-Log.
- **Repro:** `docs/niche-tests/repro/A09-idej/08-dark-ocean-bomb-arrow-infernous.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `bomb-arrow.js:89` (`'destruction_spell'` statt `'artifact'`) und `_cycling-demons-shared.js:276/299/311` (`damageType`/Typ `'destruction_spell'` statt `'creature'`).

### A09-09 · Arrow Slit wiederholt einen bereits negierten Pfeil · Stufe B
- **Karten:** Arrow Slit (`arrow-slit.js`), Angelfeather Arrow (und jeder Pfeil über `_arrows-shared.js`); Auslöser der Negation hier Misfire (Gegenprobe außerhalb der Gruppe)
- **Voraussetzungen / Aufbau:** Seed 1234. Sitz 0: Held 0 (Tushu, ATK 40) mit Fighting 1, Hand [Angelfeather Arrow, Arrow Slit, Attack]. Sitz 1: Held 0 mit Decay Magic 1, Hand [Misfire].
- **Schritte:** 1. Sitz 0 spielt Attack auf Sitz-1-Held 0 und kettet Angelfeather Arrow. 2. Sitz 1 antwortet mit Misfire (negiert den Pfeil direkt darunter). 3. Sitz 0 kettet Arrow Slit.
- **Erwartet** (Kartentext Slit: „That Artifact activates a second time immediately after its first activation"): Der Pfeil ist negiert, seine erste Aktivierung findet nicht statt – also gibt es auch keine zweite; der Angriff macht 40.
- **Beobachtet:** 100 Schaden (40 + 60). Die Kette löst LIFO auf: der Slit liegt oben und ruft `resolve` des Pfeils direkt auf, **bevor** Misfire den Pfeil negiert; die Negation trifft nur die Original-Aktivierung. (Kontrolle ohne Gegner: Pfeil + Slit = 160, gewollt.)
- **Repro:** `docs/niche-tests/repro/A09-idej/09-arrow-slit-retriggert-negierten-pfeil.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `arrow-slit.js:112` bzw. `pickLastUntriggeredArrowLink` (`_arrows-shared.js:412`) prüft nicht, ob der Ziel-Pfeil durch ein Glied über ihm (aber unter dem Slit) negiert wird; `reactionCondition` zählt negierte Pfeile zwar nicht mit, zur Bauzeit ist aber noch nichts negiert.

### A09-10 · Golden Arrow wird auch für Mehrziel-Angriffe angeboten und zahlt aus · Stufe B
- **Karten:** Golden Arrow (`golden-arrow.js`, `_arrows-shared.js`), Gegenstück: Whirlwind Strike (Ricochet, Shattering Strike treffen ebenfalls mehrere Ziele)
- **Voraussetzungen / Aufbau:** Seed 1234. Sitz 0: Held 0 mit Fighting 3, Hand [Golden Arrow, Whirlwind Strike], 50 Gold. Sitz 1: drei Helden (800 HP), Held 0 mit einer Kreatur.
- **Schritte:** 1. Whirlwind Strike spielen (zwei Helden wählen), Golden Arrow bestätigen.
- **Erwartet** (Kartentext: „Play this card when a Hero you control hits **exactly 1 target** with an Attack"): Bei zwei getroffenen Helden (plus deren Kreaturen) gilt die Bedingung nicht – der Pfeil darf nicht angeboten werden bzw. nicht wirken (kein Gold, keine Goldsperre).
- **Beobachtet:** Der Pfeil wird angeboten, bestätigt und wirkt: 4 Gold (für das erste Ziel; beim zweiten greift schon die selbst gesetzte Goldsperre), Goldsperre liegt. Kontrolle: Einzelziel-Angriff → 4 Gold, korrekt.
- **Repro:** `docs/niche-tests/repro/A09-idej/10-golden-arrow-mehrzielangriff.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_arrows-shared.js:122` – die Prüfung `requireSingleTarget` ist auskommentiert („every PP Attack resolves via a single promptDamageTarget call"); das stimmt seit Whirlwind Strike & Co. nicht mehr. Das Reaktionsfenster öffnet vor der Zielwahl, die Zielzahl ist dort noch nicht bekannt (anders als bei Don Quistos `onAttackDeclare`) – eine Lösung müsste die Wirkung nachträglich (am Aufprall) an die Zielzahl binden.

### A09-11 · Golden Arrow: „cannot spend Gold" sperrt die Gold-Kosten von Karten nicht · Stufe C
- **Karten:** Golden Arrow (Sperre), jede Karte mit Gold-Kosten (hier Idej Blade - Hakai als Equipment, Angelfeather Arrow als Reaktions-Artefakt)
- **Voraussetzungen / Aufbau:** Seed 1234. Sitz 0: Held 0 Idej Lord Daiyo mit Fighting 1, Hand [Idej Blade - Hakai (Kosten 4), Angelfeather Arrow (Kosten 5), Attack], 100 Gold, `ps.goldLocked = true` (der Zustand nach Golden Arrow).
- **Schritte:** 1. Hakai ausrüsten. 2. Attack spielen und Angelfeather Arrow ketten.
- **Erwartet** (Lesart „Kosten sind Ausgaben"; Kartentext „You cannot gain or **spend** Gold for the rest of the turn afterwards"): Beides ist nicht zahlbar.
- **Beobachtet:** Hakai wird ausgerüstet (−4 Gold), der Pfeil gekettet (−5 Gold). Die Sperre wirkt nur in `actionGainGold`/`actionSpendGold` und in einzelnen Karten (Anti Magnet, Golden Ladybug, Hel); `_payCardCost` (19 Aufrufstellen, Kartenkosten) kennt sie nicht. Folge: Golden Arrow sperrt in der Praxis weder Artefakte noch Reaktionen.
- **Repro:** `docs/niche-tests/repro/A09-idej/11-goldsperre-kartenkosten.js` (✗ = Lesart „Kosten sind Ausgaben" nicht erfüllt)
- **Vermutete Ursache:** `_engine.js:24635` `_payCardCost` und die Kosten-Prüfungen (`canAffordGold`) ohne `goldLocked`; der Kommentar dort sagt, Kosten seien „nicht mehr verhandelbar".
- **Frage an Al:** Soll Golden Arrows Goldsperre auch die Gold-KOSTEN von Karten verbieten (Artefakte/Reaktionen nicht mehr spielbar), oder nur Karteneffekte, die Gold ausgeben?

### A09-12 · Dirty Smuggler: Bei gesperrtem Goldgewinn des Diebes verschwindet das Gold des Opfers · Stufe B
- **Karten:** Dirty Smuggler (`dirty-smuggler.js` → `engine.actionStealGold`), Tuscan Aristocrat (`tuscan-aristocrat.js`), Golden Arrow (Sperre `goldLocked`); gleicher Primitiv auch bei Deepsea Pirate, Mimic, Thieving, Debt-O-Tron-Modulen
- **Voraussetzungen / Aufbau:** Seed 1234. Sitz 0: Dirty Smuggler (Held 0, Slot 0), 30 Gold. Sitz 1: 40 Gold. (A) Sitz 1 kontrolliert Tuscan Aristocrat. (B) Sitz 0 hat `goldLocked` (Zustand nach Golden Arrow).
- **Schritte:** 1. Sitz 1 zieht per Effekt 2 Karten (`engine.actionDrawCards(1, 2)`). 2. Dirty Smuggler „steal 8 Gold": Ja.
- **Erwartet** (Kartentext Dirty Smuggler: „you may steal four times that much Gold"; Aristocrat: „your opponent cannot gain any Gold outside their Resource Phase"; Golden Arrow: „You cannot gain … Gold"): Wer nicht gewinnen darf, kann nicht stehlen – der Diebstahl scheitert, das Opfer behält sein Gold (Summe beider Seiten 70, wie in der Kontrolle ohne Sperre).
- **Beobachtet:** Das Opfer verliert 8 Gold, der Dieb bekommt 0 (A und B), das Log meldet trotzdem `gold_steal` – Gold geht aus dem Spiel verloren (Summe 62).
- **Repro:** `docs/niche-tests/repro/A09-idej/12-dirty-smuggler-diebstahl-bei-gesperrtem-gewinn.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_engine.js:24765` – `actionStealGold` zieht dem Opfer das Gold ab und ruft **danach** `actionGainGold` (Z. ~24767), dessen Abbruch (Sperre, `onResourceGain`-Abbruch von Aristocrat) nicht ausgewertet wird. Richtig wäre: erst prüfen, ob der Dieb gewinnen darf, oder das Gold bei abgebrochenem Gewinn zurückbuchen.

### A09-13 · Smuggler's Pier: zahlt Gold für Karten, die nicht gezogen werden dürfen (Zieh-Sperre, Tuscan Artist) · Stufe B
- **Karten:** Smuggler's Pier (`smuggler-s-pier.js`), Tuscan Artist (`tuscan-artist.js`), Gegenkarten mit Zieh-Sperre (The Sacred Jewel, Prayer: `ps.drawLocked`)
- **Voraussetzungen / Aufbau:** Seed 1234. Sitz 0: Pier im Feld, 100 Gold, Deck 20, Main Phase 1. (A) `ps.drawLocked = true`. (B) Sitz 1 kontrolliert Tuscan Artist.
- **Schritte:** 1. Pier aktivieren und 10 Gold (2 Karten) bzw. 15 Gold (3 Karten) wählen.
- **Erwartet** (Kartentext Pier: „spend a multiple of 5 Gold to draw a card for every 5 Gold spent"; Ruling `_draw-block-shared.js`-Kopf zu Tuscan Artist: ist der Zug der einziger Nutzen eines Effekts, ist der Effekt **gesperrt** und verbraucht nichts – Haste, Wheels, Creativity, Potion of Greed u. a. fragen dafür `drawWouldBeBlocked`): (A) Pier ist unter Zieh-Sperre nicht aktivierbar. (B) Die Stufen „2 Karten" und „3 Karten", die Artist negiert, werden nicht angeboten bzw. kosten nichts.
- **Beobachtet:** (A) 10 Gold gezahlt, 0 Karten, Einmal-pro-Zug verbraucht. (B) 10 bzw. 15 Gold gezahlt, 0 Karten gezogen. Stufe 1 und 4+ laufen durch (korrekt).
- **Repro:** `docs/niche-tests/repro/A09-idej/13-pier-zahlt-bei-ziehsperre-und-tuscan-artist.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `smuggler-s-pier.js` `canActivateAreaEffect`/`onAreaEffect` prüfen nur `ps.handLocked`, nicht `ps.drawLocked`, und kennen `drawWouldBeBlocked` (`_draw-block-shared.js`) nicht; `actionDrawCards` (`_engine.js:10876`) liefert bei `drawLocked` still `[]`, nachdem `_payCardCost` schon gezahlt hat.

### A09-14 · Tuscan Mystic ersetzt einen Mehrfach-Zug komplett durch EINE Aufdeck-Auflösung · Stufe B
- **Karten:** Tuscan Mystic (`tuscan-mystic.js`); Auslöser hier Potion of Greed („Draw 2 cards from your Potion Deck", Gegenprobe außerhalb der Gruppe); Vergleich Philosopher's Stone
- **Voraussetzungen / Aufbau:** Seed 1234. Sitz 0: Tuscan Mystic (Held 0, Slot 0), Hand [Potion of Greed], Potion Deck 6 Karten.
- **Schritte:** 1. Potion of Greed spielen. 2. Mystic: Ja, eine der zwei aufgedeckten Karten wählen.
- **Erwartet** (Kartentext: „Whenever you would draw **a card** from your Potion Deck, you may reveal the top 2 … and resolve one of them **instead**"; Vergleich Philosopher's Stone, gleiche Formulierung: ersetzt genau EINEN Zug, „zieht ein Effekt mehrere, … der Rest wird normal gezogen"): Zwei Züge → der erste wird ersetzt, der zweite entweder ebenfalls ersetzt (zweite Abfrage) oder normal gezogen.
- **Beobachtet:** Eine einzige Abfrage; beide Züge entfallen (Hand leer), 2 Potions aufgedeckt und gelöscht, 4 bleiben im Potion Deck. Die zweite gezogene Karte geht verloren.
- **Repro:** `docs/niche-tests/repro/A09-idej/14-tuscan-mystic-mehrfachzug.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `tuscan-mystic.js:153` `ctx.setAmount(0)` – setzt den gesamten Batch (`ctx.amount`) auf 0, statt nur einen Zug abzuziehen (`setAmount(ctx.amount - 1)`) bzw. je Karte erneut zu fragen. Gemessen nur mit Potion of Greed; Intrude und The Eighth Circle of Hell rufen `actionDrawFromPotionDeck` mit Mehrfachmengen auf demselben Weg auf (nicht getestet).

### A09-15 · Gestohlene Kreatur stirbt: Elven Rider und Cycling Demons setzen den Nachfolger in die falsche Zone – oder gar nicht · Stufe B
- **Karten:** Elven Rider (`elven-rider.js`), Bouldor / Herbithorn / Hydrogen / Infernous / Serpentous Demon (`_cycling-demons-shared.js`); Täter: jeder Diebstahl (`actionStealCreature`)
- **Voraussetzungen / Aufbau:** Seed 1234. Sitz 1: Elven Archer bzw. Bouldor Demon auf Held 0 / Slot 1. Sitz 0 stiehlt die Kreatur; Hand [Elven Rider] bzw. Deck [Infernous Demon]. Szene „frei": Sitz 0 Held 0 / Slot 1 leer. Szene „belegt": dort steht eine Kreatur.
- **Schritte:** 1. `actionStealCreature(0, inst)`. 2. Die gestohlene Kreatur zerstören; Rider bzw. Zyklus bestätigen.
- **Erwartet** (Kartentext Rider: „summon it into the **same Support Zone** that Creature occupied"; Demon: „place it into the Support Zone this Creature occupied"): Der Nachfolger kommt in die Zone, die die gestohlene Kreatur belegte (Seite 1, Held 0, Slot 1; die Engine kann das, vgl. Elven Druid mit `controller`), oder – wenn das nicht geht – gar nicht. Auf keinen Fall in eine andere Zone, und das Ergebnis darf nicht vom Zufall abhängen, ob die gleich indizierte Zone auf der eigenen Seite frei ist.
- **Beobachtet:** „frei": Der Nachfolger landet auf der **eigenen** Seite des Diebes (Sitz 0, Held 0, Slot 1) – eine andere Zone als die vom Gestorbenen belegte. „belegt": Es wird nichts angeboten, nichts passiert (Rider bleibt auf der Hand, Demon-Zyklus bleibt stumm). Die Ablage des Gestorbenen ist richtig (Sitz 1).
- **Repro:** `docs/niche-tests/repro/A09-idej/15-gestohlene-kreatur-nachfolger-falsche-zone.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `elven-rider.js:100` (`ps.supportZones?.[deathInfo.heroIdx]?.[deathInfo.zoneSlot]`, `ps` = Kontrolleur) und `:257` (`summonCreatureWithHooks(CARD_NAME, pi, death.heroIdx, death.zoneSlot, …)`); `_cycling-demons-shared.js` `onCreatureDeath` (`pi = death.controller ?? death.owner`, `ps.supportZones[death.heroIdx]`, `summonCreatureWithHooks(successor, pi, …)`). Beide ignorieren die physische Seite (`physicalSide(inst)` = Besitzerseite bei `stolenBy`).

### A09-16 · Pet Snake: Unter Stinky Stables gibt es die Zusatzbeschwörung gratis · Stufe B
- **Karten:** Pet Snake (`pet-snake.js`), Stinky Stables (Area, Gegenkarte außerhalb der Gruppe)
- **Voraussetzungen / Aufbau:** Seed 1234. Sitz 0: Held 0 (Summoning Magic 1) mit 2 Gift-Stacks, Hand [Pet Snake], Main Phase 1. Stinky Stables in der Area-Zone von Sitz 1 (Kontrolle: ohne Area).
- **Schritte:** 1. Pet Snake aus der Hand beschwören (in der Main Phase nur als Zusatzaktion möglich).
- **Erwartet** (Kartentext Pet Snake: „You may **heal a Poisoned Hero from its Poison** to summon this Creature as an additional Action"; Stinky Stables: „Poisoned targets cannot be healed (… not from being Poisoned)"; Skriptkopf: „the alt summon also fails gracefully"): Das Gift lässt sich nicht entfernen, die Kosten sind nicht zahlbar → keine Zusatzbeschwörung, kein Einmal-pro-Zug-Stempel.
- **Beobachtet:** Der Snake wird beschworen, das Gift bleibt, `pet-snake-alt:0` ist gestempelt und keine Aktion wird verbraucht – eine Gratis-Zusatzbeschwörung (Kontrolle ohne Area: Gift geheilt, korrekt).
- **Repro:** `docs/niche-tests/repro/A09-idej/16-pet-snake-stinky-stables-gratis-beschwoerung.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `pet-snake.js:42` `inherentAction` prüft nur „irgendein Held vergiftet", nicht ob das Gift heilbar ist; `onPlay` (Z. 165/166) ruft `removeHeroStatus(…, 'poisoned')` (die Engine überspringt das Gift bei `poisonLocked`, `_engine.js:17247`) und stempelt `claimHOPT`, ohne den Rückgabewert zu prüfen. Die Kosten werden **nach** der Platzierung erhoben (kein `beforeSummon`); scheitert die Heilung, kann den Snake nichts mehr zurückhalten.

## Abdeckung
(wird am Ende ergänzt)

## Getestet & in Ordnung (Auswahl)
(wird am Ende ergänzt)
