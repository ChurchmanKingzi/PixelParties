# A08-pacman – Nischenfall-Bericht
Stand/Autor: Agent A08-pacman, 12.10.2026. Karten: 38 in der Liste · (wird am Ende gezählt) gezielt getestet · (wird am Ende gezählt) mit Befund.

## Zusammenfassung
(wird am Ende ausgefüllt – der Bericht wächst fortlaufend)

## Befunde

### A08-01 · Weakening Crystal negiert die Helden erst ab dem NÄCHSTEN eigenen Zugbeginn · Stufe A
- **Karten:** Weakening Crystal (`cards/effects/weakening-crystal.js`), Hilfsmodul `cards/effects/_crystals-shared.js`, Engine `_engine.js`
- **Voraussetzungen / Aufbau:** Sitz 0 mit Waflav (Held 0, 1 Evolution Counter); Deck Sitz 0: Füller, Weakening Crystal, Füller …; echte Zugwechsel bis Sitz 0 den Kristall im Ressourcen-Schritt zieht (Zug 9, Main Phase 1).
- **Schritte:** 1. `t.endTurn()` ×4 (Sitz 0 zieht den Kristall zu Beginn von Zug 9). 2. Held 0 trägt keinen `negated`-Status. 3. Waflavs Heldeneffekt „Draw 3 cards“ aktivieren.
- **Erwartet** (Kartentext: „While this card is in your hand, the effects of all your Heroes are negated.“; Ruling CARD_API.md „★ Weakening Crystal: HEILBAR, ABER WIEDERKEHREND (v1103)“ und Kopf von `_crystals-shared.js`: „angelegt wird nur an DREI Zeitpunkten: **beim Eintritt in die Hand**, zu Beginn der Runde des Betroffenen, beim Laden eines Spielstands“): Heldeneffekte sind ab dem Moment gesperrt, in dem der Kristall auf der Hand liegt.
- **Beobachtet:** Alle Helden des Ziehenden bleiben ohne `negated`; Waflavs Effekt läuft und zieht 3 Karten. Derselbe Befund bei einem Zug mitten im Zug (`actionDrawCards`) und beim Geschenk über Chatty Town Guard (Empfänger bleibt bis zu seinem nächsten Zugbeginn unnegiert).
- **Repro:** `docs/niche-tests/repro/A08-pacman/01-weakening-crystal-erst-ab-naechstem-zug.js` (`node docs/niche-tests/repro/A08-pacman/01-weakening-crystal-erst-ab-naechstem-zug.js`; ✗ = Fehler tritt auf)
- **Vermutete Ursache:** Der einzige Aufruf mit `reapply: true` steht bei Zugbeginn (`_engine.js:22560`) und läuft **vor** dem Ziehen des Zugbeginns; `sync()` ruft `_refreshWeakeningCrystalNegation()` ohne `reapply` (`_engine.js:48969`) und räumt nur auf. Der im Ruling genannte Zeitpunkt „Eintritt in die Hand“ (`_autoRevealOnEnterHand`, `handZugangSync`, `actionDrawCards`, `actionTransferCardToOppHand`) ruft die Anlage nirgends auf. Folge: Der Kristall wirkt nie im Zug, in dem er gezogen wurde, und nicht in der Gegnerrunde davor (dort also auch keine negierten Passiv-Hooks, z. B. Mary Crestmas’ Schadensnegierung).

### A08-02 · Cool Presents zahlt trotz Rusting Crystal den Grundpreis (Anzeige 8 je Karte, Abbuchung 4 je Karte) · Stufe A
- **Karten:** Cool Presents (`cards/effects/cool-presents.js`), Rusting Crystal (`rusting-crystal.js`, `_crystals-shared.js: applyRustingCrystalCostMultiplier`)
- **Voraussetzungen / Aufbau:** Sitz 0: 24 Gold; Hand: Cool Presents, Rusting Crystal, drei verschiedenfarbige Füller (Filler, Trinket, Dummy). Vergleichslauf ohne Rusting Crystal.
- **Schritte:** 1. Cool Presents über den echten Weg spielen (`doUseArtifactEffect` → Zielwahl). 2. Alle drei Füller wählen, `doConfirmPotion`.
- **Erwartet** (Rusting Crystal: „the Costs of all your other Artifacts are doubled“; Cool Presents: „This Artifact’s Cost is multiplied by the number of cards you give“): 8 Gold je Karte, 3 Karten = 24 Gold. Ohne Kristall 12.
- **Beobachtet:** Die Zielwahl bekommt die verdoppelten Kosten (goldCost 8, `maxTotal` = 3 bei 24 Gold, Anzeige 8 je Karte), abgebucht werden aber nur 12. Die Verdopplung greift bei Cool Presents nie.
- **Repro:** `docs/niche-tests/repro/A08-pacman/02-cool-presents-ignoriert-rusting-crystal.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `cool-presents.js:122` liest den Grundpreis aus `cards.json` (`engine._getCardDB()[CARD_NAME]?.cost`) statt `engine.artifactPlayCost(...)` (Rusting, Handrabatte, Misfire …); `manualGoldCost: true` schaltet die zentrale Abbuchung ab (`server.js:12149`, `:11259`). Dasselbe Muster steht in Beer (`beer.js:98`) – dort nicht getestet.

### A08-03 · Letter of Misinformations mischt die Gegnerhand an Ort und Stelle – die Aufdeck-Marken bleiben am Index stehen · Stufe A
- **Karten:** Letter of Misinformations (`letter-of-misinformations.js`), betroffen: Weakening Crystal / Grinning Cat u. a. (jede `revealOnEnterHand`-Karte), Crystal Well (zählt aufgedeckte Karten)
- **Voraussetzungen / Aufbau:** Sitz 1 hält [Weakening Crystal, Dummy, Trinket, Grinning Cat, Filler] (Kristall und Katze aufgedeckt); Sitz 0 hat Chatty Town Guard und eine Letter; Seeds 1–5.
- **Schritte:** 1. Chatty Town Guard schenkt die Letter an Sitz 1 → Letter-Trigger. 2. Sitz 0 nimmt zwei Nicht-Kristall-Karten aus der Gegnerhand. 3. Die Restkarten werden gemischt.
- **Erwartet** (Weakening Crystal / Grinning Cat: „…you must immediately reveal it“): Aufgedeckt bleiben genau die selbstaufdeckenden Karten, egal wo sie in der Hand stehen. (Der Letter-Text nennt kein Mischen der Gegnerhand; selbst wenn das Skript es absichtlich tut, müssten die Marken mitwandern.)
- **Beobachtet:** Seeds 1, 3, 4 (von 5): `_permanentlyRevealedHandIndices` zeigt danach auf andere Karten – z. B. gelten „Letter of Misinformations" und „ZZ Dummy" als aufgedeckt, der echte Kristall und die Katze sind verdeckt. Der Gegner sieht damit die falschen Karten offen.
- **Repro:** `docs/niche-tests/repro/A08-pacman/03-letter-mischt-gegnerhand-aufdeckmarken-verrutschen.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `letter-of-misinformations.js:205-210` vertauscht `ops.hand` per Fisher-Yates direkt im Array („no splice/reassign so we don’t perturb the splice interceptor“) – die indexgebundenen Karten (`_permanentlyRevealedHandIndices`, `_revealedHandIndices`, `_handOriginals`, `_handCostReductions` …, siehe `registerHandIndexedField`) werden dabei nicht umgesetzt. Der Mischvorgang selbst steht nicht im Kartentext (cards.json); der Kommentar im Skript beruft sich auf „per card text“.

### A08-04 · Hand-Geschenk: bei gleichnamigen Handkarten wandert die falsche Instanz (originalOwner vertauscht) · Stufe B
- **Karten:** Chatty Town Guard (`chatty-town-guard.js`), Crystal Well, Cool Presents, Mary Crestmas (alle über `engine.actionTransferCardToOppHand`)
- **Voraussetzungen / Aufbau:** Beide Sitze haben Chatty Town Guard; Sitz 0 und Sitz 1 halten je einen „ZZ Filler".
- **Schritte:** 1. Sitz 1 schenkt Sitz 0 seinen Filler → Sitz 0 hält [eigener (orig 0), geschenkter (orig 1)]. 2. Sitz 0 schenkt den Filler an **Index 1** (den geschenkten) zurück.
- **Erwartet** (Crystal Well: „…originally owned by them“; Mary: „…originally owned by you“): Sitz 1 bekommt seine Karte (originalOwner 1) zurück, Sitz 0 behält die eigene (originalOwner 0).
- **Beobachtet:** Sitz 1 erhält einen Filler mit originalOwner 0, Sitz 0 behält einen mit originalOwner 1 – die Marken sind vertauscht. Folgen: Mary Crestmas’ Abwurfzwang und Crystal Wells Eignung („originally owned by them“) entscheiden danach falsch (Sitz 1 darf die zurückbekommene eigene Karte nicht per Crystal Well wegschenken, Sitz 0 kann sie ihm per Mary als „von mir stammend“ abnehmen).
- **Repro:** `docs/niche-tests/repro/A08-pacman/04-geschenk-vertauscht-originalbesitzer-bei-gleichem-namen.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_engine.js:25346` (`actionTransferCardToOppHand`): `inst = matches[0]` = erste Hand-Instanz dieses NAMENS statt der k-ten für Position `handIdx`. Crystal Wells `_isOriginallyOwnedHandSlot` und Marys Abwurfwahl zählen dagegen nach Rang – die drei Stellen sind uneins. Restunsicherheit (daher B): gleichnamige Karten sind für Spieler nicht unterscheidbar; sichtbar wird der Fehler nur über die „originally owned“-Prüfungen.

### A08-05 · Aufstieg hebt die Max-HP eines per Paraseed Control übernommenen Helden über den Deckel 100 · Stufe B
- **Karten:** Paraseed Control (`paraseed-control.js`), Flamebathed Waflav (`flamebathed-waflav.js`; gilt für jede Waflav-Form mit höherer Max-HP als die Basis), Engine `performAscension`
- **Voraussetzungen / Aufbau:** Sitz 1: Waflav (Held 0, 20 HP, 6 Evolution Counters) trägt eine Paraseed von Sitz 0; Sitz 0 hält Paraseed Control. Zug 6: Gift tötet den Waflav, Control übernimmt ihn (100/100, `maxHpCapped` 100, `permaControlBy` 0). Zug 7: Sitz 0 steigt mit Flamebathed Waflav (400 → 450 gedruckte Max-HP) auf.
- **Erwartet** (Paraseed Control: „Its current and max HP become 100 and **cannot be increased in any way**.“): Max-HP bleiben ≤ 100.
- **Beobachtet:** Der Held steht danach auf 150/150; der Deckel (`maxHpCapped`) bleibt gesetzt, wird aber nicht beachtet.
- **Repro:** `docs/niche-tests/repro/A08-pacman/05-paraseed-control-hp-deckel-vs-aufstieg.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `performAscension` schreibt `hero.maxHp = newMaxHp; hero.hp = newHp` direkt (`_engine.js:49285`); `maxHpCapped` wird nur in `increaseMaxHp` geprüft (`_engine.js:10508`). Bei „"Bloom", the Continent Corruptor“ ist das Löschen des Deckels ausdrücklich so gewollt (`…continent-corruptor.js:83`, Text: „current and max HP become 500“), bei den Waflav-Formen nicht. Restunsicherheit (daher B): es gibt kein Ruling, ob der Formwechsel-Zuschlag als „increase" zählt.

### A08-06 · Big Gwen Guard lässt sich mit Grinning Cat auf der Hand nicht beschwören – obwohl die Katze die Kosten sein soll · Stufe B
- **Karten:** Big Gwen Guard (`big-gwen-guard.js`), Grinning Cat (`grinning-cat.js`), Engine `getSummonBlocked`
- **Voraussetzungen / Aufbau:** Sitz 0 ohne Kreaturen; Hand: Big Gwen Guard + (a) Weakening Crystal bzw. (b) Grinning Cat; Main Phase 1, Held ohne Summoning Magic.
- **Schritte:** Big Gwen Guard über den echten Spielweg spielen, als Abwurfkosten die jeweils andere Handkarte wählen.
- **Erwartet** (Big Gwen Guard: „you may discard 1 card from your hand that is revealed because of its own effect to summon this Creature as an additional Action“; Grinning Cat: „While this card is in your hand, you cannot summon any Creatures except Grinning Cat“): Die Kosten werden vor der Beschwörung gezahlt; die abgeworfene Katze sperrt nichts mehr → Big Gwen Guard kommt. (a) funktioniert genau so.
- **Beobachtet:** (a) ✓. (b) `doPlayCreature` lehnt ab (Rückgabe `false`, kein Prompt): `getSummonBlocked` setzt Big Gwen Guard als Handkreatur auf die Sperrliste, solange eine Katze in der Hand liegt, und die Abwurfkosten werden gar nicht erst angeboten. Die einzige Sperre, die Big Gwen Guard „löst", sperrt ihn selbst.
- **Repro:** `docs/niche-tests/repro/A08-pacman/06-big-gwen-guard-vs-grinning-cat.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_engine.js:23751-23775` (Sperre der Hand-Kreaturen) kennt keine Ausnahme für Karten, deren Beschwörung die Katze selbst als Kosten abwirft; `big-gwen-guard.js` `canSummon`/`beforeSummon` laufen erst nach dem Sperrcheck. Restunsicherheit (daher B): „Kosten zuerst" ist die natürliche, aber nicht ausdrücklich entschiedene Lesart.

## Abdeckung
| Karte | Tiefe | Geprüfte Nischenfälle / Anmerkung |
|---|---|---|
| (wird fortlaufend ergänzt) | | |

## Getestet & in Ordnung (Auswahl)
(wird fortlaufend ergänzt)
