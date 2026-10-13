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

### A08-07 · Extra Life (Trial of Coolness) rettet eine Kreatur nur vor Schaden, nicht vor einem „defeat"-Effekt · Stufe A
- **Karten:** Trial of Coolness (`trial-of-coolness.js`), Afflicted Vermin (`afflicted-vermin.js`), Trial of Dominance (`trial-of-dominance.js`), Engine `_actionDestroyCardKern`
- **Voraussetzungen / Aufbau:** Sitz 1 hat eine „ZZ Dummy"-Kreatur mit der Extra-Life-Marke von Trial of Coolness (`engine.addExtraLife`); Sitz 0 spielt (a) Afflicted Vermin (Gegner beschwört → Vermin besiegt die markierte Kreatur) bzw. (b) Trial of Dominance.
- **Schritte:** 1. Marke setzen. 2. Vermin auslösen bzw. Dominance spielen. 3. Brett/Ablage/gelöscht und Marke prüfen. (Kontrolle: tödlicher Fireball-Schaden auf dieselbe Kreatur.)
- **Erwartet** (Trial of Coolness: „The next time that target is defeated, immediately revive it and fully heal its HP."; Vermin: „Choose a different Creature and defeat it"; Dominance: „Defeat all Creatures your opponent controls and delete them."): Jedes „defeat" löst das Extraleben aus – so macht es die Engine bei Helden auf allen Todeswegen, und bei Kreaturen durch Schaden (Kontrolle ✓).
- **Beobachtet:** Vermin: die Kreatur liegt in der Ablage, die Marke ist **unverbraucht** (`_extraLifeStack` noch 1). Dominance: die Kreatur wird gelöscht, die Marke bleibt an der gelöschten Instanz. Nur der Schadensweg verbraucht die Marke.
- **Repro:** `docs/niche-tests/repro/A08-pacman/07-extraleben-kreatur-nur-bei-schaden.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_engine.js:46964` (Schadens-Stapel: `counters._extraLife` → `_reviveAfterDeath`) ist die einzige Stelle, die die Kreatur-Marke liest; `_actionDestroyCardKern` (Vermin, Dominance, jedes „defeat"/„destroy") kennt sie nicht. Folge außerdem: Trial of Coolness auf eine Kreatur schützt nicht vor Dominance des Gegners.

### A08-08 · Distracting Crystal sperrt Horn in a Bottle nicht (Trank ohne Zielwahl) · Stufe A
- **Karten:** Distracting Crystal (`distracting-crystal.js`, `_crystals-shared.js: shuffleIntoDeckBlocked`), Horn in a Bottle (`horn-in-a-bottle.js`, trägt `shufflesFromHandOrDiscardIntoDeck: true`), `server.js: doUsePotion`
- **Voraussetzungen / Aufbau:** Sitz 0: Hand Distracting Crystal + 3 Füller; Horn in a Bottle wird über den echten Weg (`doUsePotion`) gespielt; Handauswahl wählt 1 Füller.
- **Erwartet** (Distracting Crystal: „…you cannot activate effects that include adding cards from your hand or discard pile to your deck."; Horn: „Shuffle any number of cards from your hand back into your deck…"; Skriptkopf Horn: „Von Distracting Crystal gesperrt"): Ausspielen wird abgelehnt (`false`), Horn bleibt in der Hand, das Deck bleibt unverändert.
- **Beobachtet:** `play = true`: eine Handkarte geht ins Deck, 2 Karten werden gezogen, Horn landet in der Ablage – mit Kristall auf der Hand exakt wie ohne.
- **Repro:** `docs/niche-tests/repro/A08-pacman/08-distracting-crystal-sperrt-horn-in-a-bottle-nicht.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** Das Tor `isShuffleIntoDeckBlockedByDistractingCrystal` steht in `doPlaySpell` (`server.js:8056`), `doUseArtifactEffect` (`:12140`), `doConfirmPotion` (`:11253`) und den Aktivierungs-Handlern – aber nicht in `doUsePotion` (`:11849`). Horn in a Bottle hat keine Zielwahl und läuft deshalb nie durch `doConfirmPotion`. (Es ist der einzige Trank mit der Marke.)

### A08-09 · Distracting Crystal erfasst drei Karten mit genau dem gesperrten Effekt nicht (Staff of the Teleporter, Brainstorming, Priest of Luna/Tempeste) · Stufe B
- **Karten:** Distracting Crystal, Staff of the Teleporter (`staff-of-the-teleporter.js`), Brainstorming (`brainstorming.js`), Priest of Luna (`priest-of-luna.js`) und Priest of Tempeste (nur gelesen, nicht getestet; gleiche Kosten über `_priest-shared.js`)
- **Voraussetzungen / Aufbau:** Sitz 0 hält Distracting Crystal; (a) Staff + 3 Füller, (b) Brainstorming mit 4 gleichen Karten in der Ablage, (c) Priest of Luna mit 5 verschiedenen Kreaturen in der Ablage (Zusatzbeschwörung in Main Phase 1).
- **Erwartet** (Distracting Crystal wie A08-08; Staff: „Shuffle any number of cards from your hand into your deck…"; Brainstorming: „…shuffle 4 cards with the same name from your discard pile back into your deck"; Priest: „You may shuffle 5 Creatures … from your discard pile back into your deck to summon this Creature"): alle drei sind mit dem Kristall auf der Hand nicht aktivierbar – wie Horn in a Bottle, Leadership, Renewable Energy, Guard Duty, die die Marke tragen.
- **Beobachtet:** Alle drei laufen unverändert durch (Staff mischt 1 Karte, Brainstorming mischt 4 zurück, Priest wird beschworen, die 5 Kreaturen gehen ins Deck).
- **Repro:** `docs/niche-tests/repro/A08-pacman/09-distracting-crystal-ungekennzeichnete-karten.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** Das Tor liest ausschließlich die Skript-Marke `shufflesFromHandOrDiscardIntoDeck` (`server.js:8018`, `_engine.js:40898/41505/42530`); die drei Skripte tragen sie nicht (Meditation und Motharch Squire haben noch kein Skript). Restunsicherheit (daher B): kein Ruling, dass der Kristall wirklich *jeden* solchen Effekt meint – aber der Kartentext sagt es.

### A08-10 · Distracting Crystal und Einsatz-/Auslöser-Effekte, die ins Deck mischen (Black Marketeer, Deepsea Stein, The Stormblade, Lunatic Cycle - Crescent Moon) · Stufe C
- **Karten:** Distracting Crystal; Black Marketeer (`black-marketeer.js`), Deepsea Stein (`deepsea-stein.js`), The Stormblade (`the-stormblade.js`), Lunatic Cycle - Crescent Moon (`lunatic-cycle-crescent-moon.js`) – alle tragen die Marke, deren Kommentar „Distracting Crystal sperrt genau das" lautet.
- **Aufbau:** Sitz 0 hält den Kristall; (a) Black Marketeer bzw. Deepsea Stein wird beschworen, Ablage hat Karten; (b) Stormblade/Crescent Moon am Helden, der Held spielt Fireball.
- **Erwartet / Beobachtet:** Die Marke wirkt nur an den Aktivierungs-Handlern. Der Einsatz-Effekt der Kreaturen (`hooks.onPlay`) und die Auslöser der Ausrüstungen (`onAnyActionResolved`) laufen am Tor vorbei: Galerie bzw. Handauswahl öffnen sich, es wird gemischt (Marketeer sogar mit Goldgewinn +4/Karte). Ob das Beschwören einer Kreatur / ein Pflicht-Auslöser „ein Effekt, den man aktiviert" ist, sagt der Kartentext nicht.
- **Repro:** `docs/niche-tests/repro/A08-pacman/10-distracting-crystal-einsatz-und-ausloeser-effekte.js` (✗ = Lesart „Sperre gilt auch hier" verletzt)
- **Vermutete Ursache:** Einsatz-/Auslöser-Effekte fragen `shuffleIntoDeckBlocked` nirgends ab (nur `future-tech-weathercock.js:103` tut es selbst); `actionRecycleCards` prüft nur Hatusbal (`_engine.js:26809`).
- **Frage an Al:** Soll Distracting Crystal auch den Einsatz-Effekt (Marketeer/Stein beim Beschwören) und die Auslöser von Stormblade/Crescent Moon unterdrücken – ja oder nein?

### A08-11 · Afflicted Pests legt ein gewähltes Token in die Ablage statt es zu löschen · Stufe A
- **Karten:** Afflicted Pests (`afflicted-pests.js`); betrifft jedes Token auf dem Brett (Mummy Token, Pollution Token, Puppets …)
- **Voraussetzungen / Aufbau:** Sitz 0: Pests als Surprise am Helden 0; ein Mummy Token bzw. Pollution Token liegt in einer Support Zone (eigene Seite, im Vergleich auch Gegnerseite); Sitz 1 rüstet „Club of Gobbo" aus → Pests löst aus, das Token wird gewählt.
- **Erwartet** (Pests: „Choose a card in any Hero's Support Zone and send it to the discard pile"; Engine-Konvention: Tokens kommen nie in die Ablage, `_engine.js:47686-47706` „Tokens go to deleted pile", `_enforceSupportZoneLock` „Token → Deleted"): das Token verschwindet, in der Ablage liegt kein Token (Gelöscht-Stapel bzw. gar nichts).
- **Beobachtet:** „Mummy Token"/„Pollution Token" liegt danach als Karte in der Ablage des Besitzers (Gelöscht-Stapel leer). Ein Token in der Ablage ist ein unzulässiger Zustand (Wiederbeleber/Mischeffekte können es von dort holen). `audit()` meldet nichts.
- **Repro:** `docs/niche-tests/repro/A08-pacman/11-afflicted-pests-token-in-ablage.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `afflicted-pests.js` (~Z. 112-125) entfernt die Karte selbst und schreibt `discardPs.discardPile.push(tCardName)`, ohne die Token-Weiche der Engine. Die Zielliste (`~Z. 44-72`) lässt Tokens ausdrücklich zu (nur Unbewegliche und Verdeckte fallen weg). Zusätzlich splict Pests direkt am Brett statt `actionMoveCard`/`actionDestroyCard` – Zähler, Unter-Karten und Sterbe-Hooks laufen deshalb nicht.

### A08-12 · Trial of Dominance löscht gegnerische Paraseeds nicht – sie nisten sich beim Wirker ein und vergiften ihn · Stufe B
- **Karten:** Trial of Dominance (`trial-of-dominance.js`), Paraseed (`paraseed.js` `onCreatureDeathClaim`)
- **Voraussetzungen / Aufbau:** Sitz 1 hat zwei Paraseeds (Held 0, Slot 0/1) und eine weitere Kreatur; Sitz 0 spielt Trial of Dominance.
- **Erwartet** (Dominance: „Defeat all Creatures your opponent controls and delete them."; Paraseed: „…place it into one of the attacking or corresponding Hero's free Support Zones **instead of sending it to the discard pile**"): Dominance löscht – es schickt nichts auf den Ablagestapel, die Ersetzung der Paraseed greift also nicht; beide Paraseeds liegen im Gelöscht-Stapel von Sitz 1, der Wirker bleibt ungiftig.
- **Beobachtet:** Beide Paraseeds ziehen in die freien Support Zones von Held 0 des Wirkers; er ist vergiftet. Gelöscht wurde nur die dritte Kreatur.
- **Repro:** `docs/niche-tests/repro/A08-pacman/12-dominance-loescht-paraseed-nicht.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `actionDestroyCard` löst den Todes-Anspruch (`_deathClaim`, `_engine.js` ~12422-12440, `CARD_API.md` „Kadaver beanspruchen") vor der Löschumleitung `_redirectToDeleted` ein; für „löschen statt ablegen" (Dominance, auch Ghazma) gibt es keinen Vorrang. Restunsicherheit (daher B): kein ausdrückliches Ruling zum Zusammentreffen von Löschen und Kadaver-Anspruch.

### A08-13 · Cactus Creature reagiert nur auf Heldenstatus, nicht auf Status an eigenen Kreaturen · Stufe B
- **Karten:** Cactus Creature (`cactus-creature.js`)
- **Voraussetzungen / Aufbau:** Sitz 0: Cactus Creature als Surprise, eine eigene Kreatur und ein zweiter Held; der Gegner friert (a) Held 0, (b) die Kreatur ein.
- **Erwartet** (Text: „Activate this Surprise when **a target you control** would be affected by a status effect. Afflict any other target you control with that status effect instead"; das Skript führt Kreaturen selbst als Umleitungsziel und in `canTelekinesisActivate` mit): Auch ein Status an einer eigenen Kreatur öffnet das Fenster.
- **Beobachtet:** (a) ✓ – Fenster, Frost landet bei Held 1. (b) Kein Fenster, die Kreatur ist eingefroren, die Surprise bleibt verdeckt liegen.
- **Repro:** `docs/niche-tests/repro/A08-pacman/13-cactus-creature-reagiert-nicht-auf-kreaturenstatus.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_checkSurpriseOnStatus` wird nur in `addHeroStatus` gerufen (`_engine.js:44755`); `applyCreatureStatus` (`_engine.js:17564`) kennt das Fenster nicht. Restunsicherheit (daher B): möglich, dass „target" hier bewusst auf Helden eingeschränkt wurde – das Skript sagt es aber nicht. (Die Umleitung auf Kreaturen funktioniert: Frost/Betäubung/Brand/Gift/Negierung geprüft ✓.)

### A08-14 · Die Waflav-Tutoren (Stormkissed: Deck, Deep-Drowned: Ablage) umgehen Ablage- und Stapelsperren · Stufe B
- **Karten:** Stormkissed Waflav (`stormkissed-waflav.js`), Deep-Drowned Waflav (`deep-drowned-waflav.js`), gemeinsam `_waflav-shared.js tutorAscendedHeroes`; Sperren: The Eye of Ren, Knight of Kings [B] (auch Staff of Uncontrollable Destruction)
- **Voraussetzungen / Aufbau:** (a) Sitz 0 spielt The Eye of Ren (Gold danach 0, Freikauf nicht zahlbar), steigt danach zu Deep-Drowned auf; Ablage enthält zwei Ascended Heroes. (b) Sitz 1 hat Knight of Kings [B] + Rook of Kings [B] + Board of Kings; Sitz 0 steigt zu Stormkissed auf, im Deck liegt ein Ascended Hero.
- **Erwartet** (The Eye of Ren: „You cannot move cards out of your discard pile for the rest of the turn unless you spend an additional 6 Gold."; Knight of Kings [B]: „your opponent cannot move cards from their deck or discard pile to anywhere else"; CARD_API.md „Die Stapel-Schicht (v820)": Sperren hängen in der Schicht, Kartenskripte splicen nie selbst): Beide Tutoren holen nichts.
- **Beobachtet:** (a) Beide Karten wandern aus der gesperrten Ablage auf die Hand. (b) Der Ascended Hero wandert aus dem gesperrten Deck auf die Hand. Nur die Handsperre (`ps.handLocked`) wird beachtet.
- **Repro:** `docs/niche-tests/repro/A08-pacman/14-waflav-tutor-umgeht-ablage-und-stapelsperre.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_waflav-shared.js` ~Z. 540-545: `pile.splice(idx, 1)` + `engine.handZugangSync(ps, picked, {})` statt `engine.takeFromPile`/`addFromPileToHand`. Der Wächter `scripts/check-no-splice.js` sucht nur nach `(mainDeck|discardPile|deletedPile|hand).splice(` und übersieht den Alias `pile`. Gemessen ist nur der Sperren-Effekt; weitere Folgen des Splice (Lethe-Stempel, Deckkopf-Sichtbarkeit) wurden nicht geprüft.

### A08-15 · Deep-Drowned Waflav: der Überladungs-Schlag trifft gewählte Kreaturen nicht, bezahlt aber die Zähler · Stufe A
- **Karten:** Deep-Drowned Waflav (`deep-drowned-waflav.js`)
- **Voraussetzungen / Aufbau:** Sitz 0: Deep-Drowned mit 3 Evolution Counters; Sitz 1: eine Kreatur („ZZ Dummy Frail", 10 HP; Vergleich „ZZ Dummy", 200 HP). Held-Effekt → „Surge" → 3 Counter → die Kreatur als Ziel.
- **Erwartet** (Text: „remove up to 3 Evolution Counters from this Hero to deal 100 damage to a target that many times"; `collectBoardTargets` bietet Kreaturen ausdrücklich an): 3 × 100 Schaden – beide Kreaturen sind besiegt.
- **Beobachtet:** Die 3 Counter sind weg und der Once-per-turn ist gestempelt, die Kreatur steht unversehrt auf dem Brett (`counters.currentHp` unverändert). Gegen einen Helden als Ziel funktioniert der Schlag (800 → 500 ✓).
- **Repro:** `docs/niche-tests/repro/A08-pacman/15-deepdrowned-surge-trifft-keine-kreatur.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `deep-drowned-waflav.js` ~Z. 103-106 ruft für Kreaturen `engine.actionDealDamage(source, inst, 100, 'hero')`. `actionDealDamage` ist der Heldenpfad – mit einer Kreatur-Instanz liefert er `{ dealt: 100 }` und ändert nichts (im Test gegengeprüft: `actionDealCreatureDamage` mit denselben Argumenten setzt `currentHp` korrekt).

## Abdeckung
| Karte | Tiefe | Geprüfte Nischenfälle / Anmerkung |
|---|---|---|
| (wird fortlaufend ergänzt) | | |

## Getestet & in Ordnung (Auswahl)
(wird fortlaufend ergänzt)
