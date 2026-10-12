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
- **Vermutete Ursache:** `cecilia-the-harrowing-crusader.js` (`canActivateHeroEffect`/`onHeroEffect`) und `smuggler-s-pier.js` (`canActivateAreaEffect`/`onAreaEffect` → `engine._payCardCost`) prüfen `ps.goldLocked` nicht. Zur Frage, ob die Sperre auch normale **Kartenkosten** blocken soll, siehe A09-13 (C).

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

## Abdeckung
(wird am Ende ergänzt)

## Getestet & in Ordnung (Auswahl)
(wird am Ende ergänzt)
