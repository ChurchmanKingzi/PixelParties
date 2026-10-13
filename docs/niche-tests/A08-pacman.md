# A08-pacman – Nischenfall-Bericht
Stand/Autor: Agent A08-pacman, 13.10.2026 (Fortsetzung des am Rate-Limit gestorbenen Vorgängers; IDs -01…-15 unverändert übernommen). Karten: 38 in der Liste · 37 gezielt getestet (36 × L2, 1 × L1), 1 nur gelesen (Treacherous Crystal) · 28 mit Befund. 32 Befunde: 10 × A, 17 × B, 5 × C.

## Zusammenfassung
32 Befunde in 38 Karten (A: -01, -02, -03, -07, -08, -11, -15, -16, -18, -26 · B: -04, -05, -06, -09, -12, -13, -14, -17, -20, -21, -22, -24, -25, -28, -29, -30, -31 · C: -10, -19, -23, -27, -32). Alle mit ausgeführtem Repro unter `docs/niche-tests/repro/A08-pacman/` (Ausnahmen mit statischem Anteil: -17, -29).
Die wichtigsten Muster:
- **Zielsammler / Instanzsuche nach „Besitzer ODER Kontrolleur" oder Besitzer-Spalte** (Prüfauftrag F02-14/S01-09): Ushabti greift bei gleichnamigen Kreaturen die falsche Instanz und hinterlässt eine Geister-Instanz (-16), Trial of Coolness legt das Extraleben auf die Kreatur des Gegners (-18), die Waflav-Formen listen seitenfremde Kreaturen unter dem falschen Brett mit kollidierenden IDs (-30); Ushabti-Einlagerung seitenfremder Kreaturen ist nicht beschwörbar (-17) und der Beschwörungsweg umgeht Sperren (-29). Bakhm macht es richtig.
- **Kristalle (Crystals):** Weakening Crystal wirkt erst ab dem nächsten eigenen Zugbeginn (-01), hat eine Lücke nach fremder Negation (-20) und ignoriert Status-Immunität (-28); Distracting Crystal fehlt an Tränken und drei Karten (-08, -09, C -10); Rusting Crystal wird von Cool Presents und Beer ignoriert (-02, -26).
- **Sperren-Lücken:** Waflav-Tutoren (-14), Paraseed Greenhouse und Crystal Well auf dem Area-Weg (-24), Cool Presents (-31).
- **Paraseed/Waflav-Familie:** Max-HP-Deckel und Aufstieg (-05), Deep-Drowned-Schlag trifft Kreaturen nicht (-15), Dominance gegen Paraseed (-12), Bloom-Reihenfolge (-22), Paraseed bei Stilllegung (C -23), Zombie wertet den Besitzer der Quelle aus (-21).
- Weitere Einzelfälle: Letter mischt die Hand an Ort und Stelle (-03), Afflicted Pests legt Tokens in die Ablage (-11), Extraleben nur gegen Schaden (-07), Cactus reagiert nicht auf Kreaturenstatus (-13), Noble Mummy Guards (-25).
Gesamteindruck: Die Einzelkarten laufen im Standardfall sauber (Absturz-/Hänger-Klassen: keine Befunde, `audit()` bei den Repros sauber, außer den Zustandsfehlern -16/-17); Fehler liegen in den Randzonen Kontrolle ≠ Besitz ≠ Brettseite, Sperren und Mehrkarten-Effekten.
**Bewusst nicht getestet:** Treacherous Crystal (Server-Handler nicht exportiert, headless nicht aufrufbar), Oberflächen-/Client-Darstellung (Zielmarkierungen, Animationen), 3/4-Spieler-Partien, CPU-/MCTS-Wege, Skill-Test-Modus, Trial of Loyalty über die Standardfälle hinaus, Stun-Variante von -19 (nur Burn/Poison gemessen). Das Vorgänger-Skript `t14-mary.js` war lautlos abgebrochen; Mary Crestmas wurde in dieser Fortsetzung neu gemessen. Nicht gemeldete Konstruktionen: Camel-Ziehen in der gegnerischen Resource Phase, Mary mit 0-Schaden-Ereignis.

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

### A08-16 · Ushabti: Zielsammler sucht „Besitzer ODER Kontrolleur" + Koordinaten + Name – bei gleichnamigen Kreaturen wandert die falsche Instanz (Geister-Instanz) · Stufe A
- **Karten:** Ushabti of the Great Pharaoh (`ushabti-of-the-great-pharaoh.js`); Prüfauftrag „Zielsammler Brettspalte / Besitzer ODER Kontrolleur"
- **Voraussetzungen / Aufbau:** Sitz 1 hat „ZZ Dummy" auf Held 0 / Slot 0 (zuerst angelegt), Sitz 0 ebenfalls „ZZ Dummy" auf Held 0 / Slot 0. Sitz 0 stiehlt die Kreatur von Sitz 1 (`actionStealCreature`: Kontrolleur 0, sie steht weiter auf Seite 1).
- **Schritte:** 1. Sitz 0 spielt Ushabti. 2. Wählt in der Zielwahl die EIGENE Kreatur (Brettspalte Sitz 0).
- **Erwartet** („Choose any Creature on the board and place it face-down into the Surprise Zone of the corresponding Hero."): die gewählte eigene Kreatur liegt danach verdeckt in der Surprise Zone von Sitz 0 / Held 0; die gestohlene bleibt auf Seite 1.
- **Beobachtet:** Die Instanz der GESTOHLENEN Kreatur wandert in die Surprise Zone von Sitz 0 (`zone: surprise`, `heroIdx` 0 – ein Held, bei dem sie nie stand), während ihr Name in der Support Zone von Seite 1 stehen bleibt; die eigene Instanz bleibt „support", ihr Name wird aus ihrer Zone gespleißt. `audit()`: „seat1.support[0][0] 0 Instanzen" und „Geister-Instanz". Die Gegenprobe ohne Diebstahl ist sauber (eigene/gegnerische Kreatur einzeln ✓).
- **Repro:** `docs/niche-tests/repro/A08-pacman/16-ushabti-zielsammler-verwechselt-instanzen.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_getEligibleCreatures` (~Z. 129-134) ermittelt die Instanz mit `(c.owner === pi || c.controller === pi) && c.zone === 'support' && c.heroIdx === hi && c.zoneSlot === si && c.name === cardName` – eine fremde Kreatur mit Kontrolleur `pi`, die physisch auf der anderen Seite steht, passt auf dieselben Koordinaten und denselben Namen (`.find` liefert die ältere Instanz). Dieselbe Sucharie steht als Rückfall in `resolve` (~Z. 40). Richtig wäre die physische Spalte (Zone gehört zu `ps.supportZones` von `pi`) oder die Instanz-ID. Gleiches Muster (seitenfremde Kreatur, Besitzer ≠ Brettseite) trifft auch Plant Golem & Co.; Voraussetzung im Spiel: zwei gleichnamige Kreaturen auf gleicher Held-/Slot-Nummer beider Seiten, eine davon gestohlen/seitenfremd.

### A08-17 · Ushabti: eine seitenfremd beschworene Kreatur (Plant Golem) liegt danach in der Surprise Zone des Gegners und ist von niemandem beschwörbar · Stufe B
- **Karten:** Ushabti of the Great Pharaoh, Plant Golem (stellvertretend für jede Kreatur mit Besitzer ≠ Brettseite)
- **Voraussetzungen / Aufbau:** Sitz 0 spielt Plant Golem (Besitzer 0, steht als Kontrolleur 1 auf Seite 1), dann Ushabti auf den Golem (von Sitz 0 oder 1).
- **Erwartet** („…place it face-down into the Surprise Zone of the corresponding Hero. A player may summon a Creature placed by this effect as an additional Action during their turn with the corresponding Hero."): der Golem liegt in der Surprise Zone von Seite 1 / Held 0 und der Spieler dieses Helden kann ihn später beschwören.
- **Beobachtet:** Zustand ✓ (`surpriseZones[1][0] = ['Plant Golem']`, `owner` 0, `controller` 1, `ushabtiPlaced`). Der Beschwörungsweg verlangt aber `inst.owner === Spieler` und liest die Surprise Zone desselben Spielers: Sitz 1 ist nicht Besitzer, Sitz 0 hat dort nichts liegen ⇒ niemand kann ihn beschwören; die Surprise Zone von Held 0 bleibt dauerhaft belegt.
- **Repro:** `docs/niche-tests/repro/A08-pacman/17-ushabti-seitenfremde-kreatur-nicht-beschwoerbar.js` (✗ = Fehler tritt auf; der Socket-Handler ist headless nicht aufrufbar, daher sind seine Prädikate nachgebildet – Restunsicherheit, daher B)
- **Vermutete Ursache:** `server.js` ~15067-15075 (`summon_ushabti`) und ~5826-5830 (`ushabtiSummonable`) filtern nach `inst.owner === pi` statt nach der Spielerzone, in der die Karte liegt. (Gestohlene Kreaturen sind unauffällig: Besitzer = Brettseite, Rückgabe zu Zugende ✓.)

### A08-18 · Trial of Coolness: wird eine seitenfremd beschworene Kreatur gewählt, bekommt die gleichkoordinierte Kreatur des Gegners das Extraleben · Stufe A
- **Karten:** Trial of Coolness (`trial-of-coolness.js`); Prüfauftrag „Zielsammler Besitzer ODER Kontrolleur"
- **Voraussetzungen / Aufbau:** Sitz 0 hat „ZZ Dummy" (Held 0 / Slot 0) und spielt Plant Golem (Besitzer 0, Kontrolleur 1, steht auf Seite 1 / Held 0 / Slot 0). Echter Zugwechsel zu Sitz 1; Sitz 1 spielt Trial of Coolness mit Held 1 (Held 0 trägt den Golem und ist gesperrt).
- **Schritte:** 1. Zielwahl zeigt u. a. „Plant Golem" (Id `equip-0-0-0`, weil `inst.owner` als Brettspalte benutzt wird). 2. Sitz 1 wählt den Golem.
- **Erwartet** („Choose a target you control, except the user."; Skriptkopf „Kontrolle statt Seite"): Der Golem (von Sitz 1 kontrolliert) trägt danach das Extraleben.
- **Beobachtet:** Der Golem bleibt ohne Marke; das Extraleben (`_extraLifeStack`) liegt auf der „ZZ Dummy" von Sitz 0 – einer Kreatur des Gegners, die nie wählbar war. Für gestohlene Kreaturen (Besitzer = Brettseite) gilt das nicht (Id und Spalte passen) – betroffen sind nur seitenfremd beschworene Kreaturen, deren Besitzer ≠ Brettseite ist.
- **Repro:** `docs/niche-tests/repro/A08-pacman/18-coolness-extraleben-auf-falsche-kreatur.js` (✗ = Fehler tritt auf; `audit()` meldet in dieser Lage Fehlalarme für seitenfremde Kreaturen – nicht auswerten)
- **Vermutete Ursache:** `trial-of-coolness.js:185-188` löst die Instanz über `c.zone === 'support' && c.owner === target.owner && c.heroIdx … && c.zoneSlot …` auf statt über `target.cardInstance` (das die Zielliste ~Z. 135-143 selbst mitliefert). Das Muster `c.owner === target.owner` steht in 65 Skripten (`grep`), nicht alle sind seitenfremd-relevant – Hinweis für die Querschnittsprüfung.

### A08-19 · Waflav-Formen: „any target on the board" schließt Ausrüstung/Tokens ein (Status wirkungslos, Counter trotzdem); Wiederholung zählt bei Helden, bei Kreaturen nicht · Stufe C
- **Karten:** Flamebathed Waflav (`flamebathed-waflav.js`), Swampborne Waflav (`swampborne-waflav.js`), Thunderstruck Waflav (`thunderstruck-waflav.js`), gemeinsam `_waflav-shared.js collectBoardTargets`
- **Aufbau (a):** Waflav (3 Counter) steigt zu Swampborne auf und wählt „Club of Gobbo" (Ausrüstung in einer Support Zone des Gegners) bzw. „Pollution Token" (Token, kein Creature-Typ). **(b):** Waflav-Form aufgestellt; Gegner-Held 0 und eine Gegner-Kreatur werden zweimal hintereinander verbrannt bzw. vergiftet.
- **Erwartet** (Texte: „Choose any target on the board and Burn/Poison it. Whenever a target is Burned/Poisoned, place 1 Evolution Counter …"; Ruling im Skriptkopf: „EVERY target on the board counts"; zum Vergleich Trial of Coolness: „'Target' in card-text terms covers Heroes and Creatures — never Equipment"): offen. Plausibel ist, dass nur Helden und Kreaturen Ziele sind und dass eine Wiederholung gleich behandelt wird.
- **Beobachtet:** (a) Die Ausrüstung/der Token stehen in der Zielliste; „poisoned" bleibt dran hängen, tickt nie (kein Schaden, keine Entfernung, auch nach 3 Zugwechseln, `audit()` sauber), Waflav erhält aber +1 Evolution Counter (3 − 2 + 1 = 2). Dieselbe Beobachtung für Burn (Flamebathed) – Stun (Thunderstruck) nicht geprüft. (b) Held: jede Anwendung gibt +1 (Gift stapelt auf 2); Kreatur: nur die erste (+1, +0), Gift bleibt bei 1 Stapel. Keine Absturz-/Zustandsfehler (kein NaN: Kreaturen ohne HP-Feld laufen sauber).
- **Repro:** `docs/niche-tests/repro/A08-pacman/19-waflav-status-ziele-equipment-und-wiederholung.js` (✗ = die jeweilige Lesart „kein Equipment-Ziel" / „gleiche Zählung" verletzt)
- **Vermutete Ursache:** `_waflav-shared.js` ~Z. 436-445 listet jede offene Support-Zone-Karte (`inst.zone === 'support' && !inst.faceDown`) ohne Typfilter; die Heldenpfad-Statusanwendung (`addHeroStatus`) feuert `ON_STATUS_APPLIED` auch bei Erneuerung, `applyCreatureStatus` nur bei neuem Status.
- **Frage an Al:** (1) Sollen Ausrüstung und Tokens (kein Creature) bei „any target on the board" wählbar sein – ja oder nein? (2) Zählt „Whenever a target is Burned/Poisoned" auch, wenn das Ziel schon brennt/vergiftet ist – ja oder nein (Helden jetzt ja, Kreaturen nein)?

### A08-20 · Weakening Crystal: nach Ablauf einer fremden Negation bleibt der Held trotz Kristall bis zum nächsten eigenen Zugbeginn ungebunden · Stufe B
- **Karten:** Weakening Crystal (`weakening-crystal.js`, `_crystals-shared.js refreshWeakeningCrystalNegation`); Prüfaufträge „Zugende-Räumung entfernt `negated` ohne `sourceBound`" und `negatedDuration`
- **Voraussetzungen / Aufbau:** Sitz 0 hält den Kristall; Held 0 trägt eine fremde 1-Zug-Negation (`addHeroStatus(0, 0, 'negated', { duration: 1, appliedBy: 1 })`), der Kristall wird angelegt (`reapply: true`, wie beim Eintritt in die Hand).
- **Schritte:** 1. Held 1/2 erhalten die Kristall-Negation, Held 0 nicht (fremde Negation wird nicht überschrieben). 2. `t.endTurn()` (Zugende von Sitz 0 räumt jede `negated` ohne `sourceBound` weg). 3. Zustand in der Runde des Gegners lesen.
- **Erwartet** („While this card is in your hand, the effects of all your Heroes are negated."): Der Kristall liegt noch in der Hand ⇒ auch Held 0 ist negiert.
- **Beobachtet:** Held 0 trägt in der Runde des Gegners keine Negation mehr (Held 1/2 schon); erst der nächste Zugbeginn von Sitz 0 legt sie an. In dieser Lücke laufen Passive von Held 0 (und seiner Abilities) ungehindert. Die Kristall-eigene Negation selbst übersteht die Zugende-Räumung wie vorgesehen (`sourceBound`; über 4 Zugwechsel gemessen ✓). `negatedDuration` taucht in den Skripten dieser Gruppe nicht auf (grep), Cactus Creature setzt `negated` über `addHeroStatus` ✓.
- **Repro:** `docs/niche-tests/repro/A08-pacman/20-weakening-crystal-luecke-nach-fremder-negation.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** Gleiche Wurzel wie A08-01 (Anlage nur zu drei Zeitpunkten): `_crystals-shared.js` ~Z. 125 (`if (cur && cur._byWeakeningCrystal !== true) continue;`) überspringt den Helden endgültig, statt die Kristall-Negation nachzuziehen, wenn die fremde endet; `_engine.js:45106` räumt die fremde ab, und der Sync räumt nur auf (`reapply` false).

### A08-21 · Paraseed Zombie wertet „opponent's card or effect" nach dem Besitzer der Kreatur aus, nicht nach dem Kontrolleur (gestohlene Kreaturen) · Stufe B
- **Karten:** Paraseed Zombie (`paraseed-zombie.js`); Prüfauftrag „`source.controller` bei geliehenem Angreifer"
- **Voraussetzungen / Aufbau:** Sitz 0 hält Paraseed Zombie + Paraseed, Held 0 hat 100 HP, Decay Magic Lv1. Eine Kreatur trifft Held 0 tödlich (`actionDealDamage(kreatur, held, 900, 'creature')` – genau der Aufruf von `ctx.dealDamage` einer Kreaturenfähigkeit, Quelle = Instanz). (a) Gegnerkreatur von Sitz 0 gestohlen; (b) Kreatur von Sitz 0 vom Gegner (z. B. Treacherous Crystal) gestohlen; (c) normale Gegnerkreatur.
- **Erwartet** („…defeated by an opponent's card or effect"; Engine-Konvention seit Styx 28.9. „Kontrolle statt Besitz"): (a) löst NICHT aus (Quelle steht unter meiner Kontrolle), (b) löst aus (Held auf 1 HP, Zombie gelöscht), (c) löst aus.
- **Beobachtet:** (a) löst aus (HP 1) ✗; (b) löst NICHT aus, Held 0 stirbt, Zombie bleibt auf der Hand ✗; (c) ✓. Der Teil „Hand-Inhalt während der Auflösung" ist sauber: Der Zombie ist beim Platzieren der Paraseed bereits aus der Hand und nicht mehr als Instanz vorhanden (R02-07-Prüfung ✓).
- **Repro:** `docs/niche-tests/repro/A08-pacman/21-zombie-quellseite-besitzer-statt-kontrolleur.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `paraseed-zombie.js` ~Z. 70: `const quellSeite = source?.owner ?? source?.controller;` – bei einer Kreatur-Instanz als Quelle ist `owner` der Besitzer. Dasselbe Muster steht in `punch-in-the-box.js`, `smug-coin.js`, `spider-silk-bridge.js`, `_sc-tracking.js` (dort nicht geprüft).

### A08-22 · "Bloom", the Continent Corruptor + Bloom, the Maniacal Botanist: Gift-Heilung hängt von der Heldenreihenfolge ab · Stufe B
- **Karten:** "Bloom", the Continent Corruptor (`bloom-the-continent-corruptor.js`), Bloom, the Maniacal Botanist (`bloom-the-maniacal-botanist.js`)
- **Voraussetzungen / Aufbau:** Sitz 1 hat Continent (100/500 HP) mit 1 bzw. 2 Paraseeds (Gift liegt auf) und daneben Maniacal Botanist; einmal Reihenfolge [Continent, Maniacal, x], einmal [Maniacal, Continent, x]. Echter Zugwechsel zum Gifttick von Sitz 1.
- **Erwartet** (Continent: „Damage this Hero would take from Poison is applied as healing instead."; Maniacal: „Before a Hero with a Paraseed … takes Poison damage, increase that Poison's damage by 50 times …"): derselbe Heilbetrag, egal in welcher Reihenfolge die Helden stehen (die Engine schreibt für Listener vor: „Reihenfolge der Listener darf das Ergebnis nicht bestimmen", `_engine.js` ~3970).
- **Beobachtet:** 1 Paraseed: [Continent, Maniacal] heilt **30**, [Maniacal, Continent] heilt **80** (30 + 50). 2 Paraseeds: 30 gegen 130. Continent storniert den Schaden in seinem `beforeDamage`; ob Maniacals Aura vorher läuft, entscheidet nur die Hook-Reihenfolge. Außerdem greift Continents eigene „+100"-Aura nie auf ihn selbst (der Heil-Zweig kehrt vor der Aura zurück) – das ist im Text offen (siehe Frage).
- **Repro:** `docs/niche-tests/repro/A08-pacman/22-bloom-continent-heilung-haengt-von-heldenreihenfolge-ab.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `bloom-the-continent-corruptor.js` ~Z. 150-160 (`ctx.setAmount(0); ctx.cancel(); actionHealHero(…, betrag)` mit dem Betrag zum Zeitpunkt des eigenen Hooks, ohne spätere Auren abzuwarten); die Auren der anderen Blooms liegen ebenfalls in `beforeDamage`.
- **Frage an Al:** Soll die Heilung den Grundschaden **plus alle Paraseed-Auren** enthalten (Maniacal +50 je Paraseed, Continent +100) – ja (Aura zählt als Teil des Poison-Schadens) oder nein (nur der Grundschaden)? Entscheidend ist, dass beide Reihenfolgen gleich rechnen.

### A08-23 · Paraseed: bei gefrorener/betäubter/negierter Kreatur bleibt das Gift, aber Max-HP-Fraß und Einnisten fallen weg · Stufe C
- **Karten:** Paraseed (`paraseed.js`, `_paraseed-shared.js syncParaseedPoison`); zur Klasse B-01…B-03 des Querschnittsberichts
- **Voraussetzungen / Aufbau:** Sitz 1: Paraseed in der Support Zone von Held 0 (800 HP), Kreatur (a) normal, (b) gefroren, (c) betäubt, (d) negiert; echter Zugwechsel zum Gifttick. Zusatzprobe: Fireball tötet die Paraseed (normal/gefroren/negiert).
- **Erwartet** (Text: „While this Creature is in a Hero's Support Zone, that Hero is Poisoned. Damage that Hero takes from Poison reduces its current and max HP … place it into one of the attacking … Hero's free Support Zones instead of sending it to the discard pile"; Konvention: stillgelegte Kreaturen verlieren ihre Effekte): entweder wirkt der ganze Text oder nichts davon.
- **Beobachtet:** normal 800 → 770/770 ✓. Gefroren, betäubt und negiert: Held bleibt vergiftet und verliert 30 HP, die Max-HP bleiben 800 (Fraß fällt weg). Beim Tod nistet sich die stillgelegte Paraseed nicht ein (Ablage), und das Gift fällt dann mit ihr ab. Halb-gültige Lage: das Gift tickt weiter, nur der Zusatz wirkt nicht.
- **Repro:** `docs/niche-tests/repro/A08-pacman/23-paraseed-gift-bei-stillgelegter-kreatur.js` (✗ = Lesart „beides oder keins" verletzt)
- **Vermutete Ursache:** Das Gift hängt am Zonen-Abgleich `syncParaseedPoison` (zählt `paraseedsOnHero` ohne Statusprüfung), Fraß (`afterDamage`) und Einnisten (`_deathClaim`) laufen über Hooks, die der Verteiler für stillgelegte Kreaturen sperrt.
- **Frage an Al:** Soll eine gefrorene/betäubte/negierte Paraseed das Gift lösen (wie jeder andere Dauereffekt) – oder soll das Gift als Zonen-Zustand immer bleiben und nur Fraß/Einnisten ruhen?

### A08-24 · Paraseed Greenhouse: Such-Sperre wird umgangen, unter Stapelsperre wird der Abwurf zum reinen Kostenverlust · Stufe B
- **Karten:** Paraseed Greenhouse (`paraseed-greenhouse.js`), Cats of the Pharaoh (Such-Sperre), Knight of Kings [B] (Stapelsperre)
- **Voraussetzungen / Aufbau:** Sitz 0: Area Greenhouse, zwei Handkarten, zwei Paraseeds im Deck. (a) ohne Sperre, (b) `ps.searchLocked = true` (so setzt Cats of the Pharaoh sie), (c) Sitz 1 hat Knight of Kings [B] + Rook of Kings [B] + Board of Kings (`pileOutAllowed(0,'deck') === false`).
- **Schritte:** Area-Effekt über `engine.activateAreaEffect` (der Server-Weg `doActivateAreaEffect`), Abwurfwahl beantworten.
- **Erwartet** (Greenhouse: „…discard a card from your hand to search your deck for a "Paraseed" and place it …"; Cats: „you cannot search or add cards to your hand"; Knight of Kings [B]: „your opponent cannot move cards from their deck or discard pile"): (b) Suche gesperrt – die Area ist nicht aktivierbar; (c) ebenso: kein Abwurf, kein verbrauchtes HOPT ohne Wirkung. (a) ✓.
- **Beobachtet:** (b) Paraseed wird trotzdem aus dem Deck geholt und eingesetzt. (c) Die Handkarte wird abgeworfen und das HOPT verbraucht, die Paraseed bleibt im Deck (stilles `deckEntnahme` = null).
- **Repro:** `docs/niche-tests/repro/A08-pacman/24-greenhouse-umgeht-such-und-stapelsperre.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `canActivateAreaEffect` (~Z. 195) prüft nur `ps.handLocked`; der Aktivierungsweg `_engine.js activateAreaEffect` (~Z. 42208) und `getActivatableAreas` lesen keine Sperr-Marken (`blockedBySearchLock`, `blockedByPileLock` gelten nur an Hand-/Fähigkeits-/Held-Wegen, z. B. `_engine.js:40890`); `pflanzen()` wertet das `null` von `deckEntnahme` als „Kosten sind bezahlt". Restunsicherheit (daher B): ob „search" bei Cats auch die Suche meint, deren Fund auf das Brett statt auf die Hand geht.
- **Zusatzbeobachtung (d), gleiche Wurzel:** Crystal Well (Area, „…add a card … to your opponent's hand to draw a card") bleibt unter der Zieh-Sperre (`ps.drawLocked`, Sacred Jewel) aktivierbar: die Karte wandert zum Gegner, gezogen wird nicht (Hand 2 → 1, Gegner 0 → 1). Das Zieh-Sperren-Muster der Engine (`blockedByDrawLock`, CARD_API „Zieh-Sperre") gilt nur an Hand-/Fähigkeitswegen. Im Repro als Teil (d).

### A08-25 · Noble Mummy Guards löst beim Stapeln derselben Fähigkeit aus, obwohl keine „different Ability" existiert · Stufe B
- **Karten:** Noble Mummy Guards (`noble-mummy-guards.js`)
- **Voraussetzungen / Aufbau:** Sitz 0: Noble Mummy Guards als Surprise an Held 0. Sitz 1 Held 0 trägt „Fighting" (Stufe 1) und legt ein zweites „Fighting" darauf. Vergleich: „Training" neben „Fighting".
- **Erwartet** („Activate this Surprise when your opponent attaches an Ability to a Hero. Choose a different Ability attached to the same Hero…"; Skriptkopf: „…a Hero that already has 1+ OTHER Abilities"): Beim Stapeln gibt es keine andere Fähigkeit ⇒ keine Auslösung (die Surprise bleibt verdeckt). Der Vergleich löst aus und schickt Fighting zurück.
- **Beobachtet:** Fighting auf Fighting ⇒ Bestätigungsfrage, die Surprise wird aufgedeckt und in eine Support Zone gesetzt; die Optionenliste ist leer (`return null`), nichts geht zurück. Der Vergleich (Training neben Fighting) ✓.
- **Repro:** `docs/niche-tests/repro/A08-pacman/25-noble-mummy-guards-loest-ohne-andere-faehigkeit-aus.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `surpriseTrigger` (~Z. 60-75) zählt den bereits bestehenden Stapel der neu angehängten Fähigkeit (`if (slot.length > 1) otherAbilityCount++`) als „andere Fähigkeit"; die Optionenliste in `onSurpriseActivate` (~Z. 150-160) überspringt denselben Slot richtig. Restunsicherheit (daher B): der gedruckte Auslöser nennt keine Mindestzahl anderer Fähigkeiten; nach wörtlicher Lesart löst die Surprise bei jedem Anhängen aus (das Skript schränkt bewusst ein, scheitert aber beim Stapeln).

### A08-26 · Beer (nicht in der Gruppenliste; Nachtrag zu A08-02): zahlt trotz Rusting Crystal den Grundpreis · Stufe A
- **Karten:** Beer (`beer.js`), Rusting Crystal
- **Voraussetzungen / Aufbau:** Sitz 0 mit 24 Gold, Held 0 und 1 brennen, Beer mit zwei Zielen; einmal ohne, einmal mit Rusting Crystal auf der Hand.
- **Erwartet** (Beer: „This Artifact's Cost is multiplied by the number of targets chosen"; Rusting: „the Costs of all your other Artifacts are doubled"): ohne Kristall 8 Gold, mit Kristall 16.
- **Beobachtet:** Die Zielwahl zeigt mit Kristall 8 je Ziel, abgebucht werden in beiden Fällen 8. Bestätigt die in A08-02 vermutete Schwesterkarte.
- **Repro:** `docs/niche-tests/repro/A08-pacman/26-beer-ignoriert-rusting-crystal.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `beer.js:98` `baseCost = engine._getCardDB()['Beer']?.cost` statt `engine.artifactPlayCost(...)`, `manualGoldCost: true` (wie A08-02).

### A08-27 · Rusting Crystal: die zweite Kopie auf der Hand verdoppelt die Kosten der ersten nicht · Stufe C
- **Karten:** Rusting Crystal (`rusting-crystal.js`, `_crystals-shared.js applyRustingCrystalCostMultiplier`)
- **Aufbau / Schritte:** Sitz 0 hält zwei Rusting Crystal (Kosten 15) und 15 Gold, spielt eine Kopie.
- **Erwartet** („…the Costs of all your other Artifacts are doubled. This effect does not stack with itself."): Wörtlich ist die zweite Kopie ein „anderes Artefakt" ⇒ Kosten 30, nicht 60 (nicht gestapelt) – die erste Kopie wäre mit 15 Gold nicht spielbar.
- **Beobachtet:** Die Kopie wird mit 15 Gold gespielt (Gold 0); mit 30 Gold bleiben 15. Der Kristall rechnet sich selbst nie doppelt. Ein einzelner Kristall verdoppelt Equipment, Mana Absorbing Crystal und andere Kristalle korrekt (Club of Gobbo 4 → 8, Mana Absorbing Crystal 15 → 30 ✓; Beer/Cool Presents siehe A08-26/-02).
- **Repro:** `docs/niche-tests/repro/A08-pacman/27-rusting-crystal-zweite-kopie.js` (✗ = Lesart „Kopie ist ein anderes Artefakt" verletzt)
- **Frage an Al:** Soll bei zwei Rusting Crystal auf der Hand jede Kopie als „anderes Artefakt" der anderen gelten (Kosten 30) – ja oder nein (Kosten bleiben 15)?

### A08-28 · Weakening Crystal: „counts as a negative status effect", wird aber an Petrification Break vorbei angelegt · Stufe B
- **Karten:** Weakening Crystal (`_crystals-shared.js refreshWeakeningCrystalNegation`), Petrification Break (Anhängsel, Flag `immuneToNegativeStatuses`)
- **Voraussetzungen / Aufbau:** Sitz 0 hält den Kristall; Held 0 trägt Petrification Break (`heroHasStatusImmunityAttachment` = true, Frost wird abgewehrt ✓). Kristall-Anlage wie beim Eintritt in die Hand (`reapply: true`).
- **Erwartet** (Kristall: „…the effects of all your Heroes are negated. This counts as a negative status effect."; Petrification Break: „…it cannot be affected by negative status effects"): Held 0 bleibt unnegiert, Held 1/2 sind negiert.
- **Beobachtet:** Alle drei Helden tragen die Negation, auch der Träger von Petrification Break.
- **Repro:** `docs/niche-tests/repro/A08-pacman/28-weakening-crystal-ignoriert-statusimmunitaet.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_crystals-shared.js` ~Z. 130 schreibt `hero.statuses.negated = { … }` direkt statt über `addHeroStatus`, wo die Immunitäten stehen (`status_immunity_attachment` `_engine.js` ~44835, Johanna, Submerged, Karian …). Restunsicherheit (daher B): Ob die Immunität einen *dauerhaften Zustand* der Handkarte verhindern soll, ist nicht ausdrücklich entschieden – der Zusatz „counts as a negative status effect" spricht dafür.

### A08-29 · Ushabti: das spätere Beschwören der eingelagerten Kreatur umgeht Grinning Cat und die Beschwörungssperre · Stufe B
- **Karten:** Ushabti of the Great Pharaoh, Grinning Cat (jede Karte mit `handSummonLockExceptSelf`), `ps.summonLocked`, Greatmaw-Sperre
- **Voraussetzungen / Aufbau:** Sitz 0 lagert die eigene „ZZ Dummy" per Ushabti in die Surprise Zone (echter Spielweg), hält danach eine Grinning Cat auf der Hand.
- **Erwartet** (Grinning Cat: „…you cannot summon any Creatures except Grinning Cat"; Ushabti: „A player may summon a Creature placed by this effect as an additional Action"): Das Beschwören aus der Surprise Zone unterliegt derselben Sperre wie das Ausspielen aus der Hand.
- **Beobachtet:** `getSummonBlocked(0)` sperrt den Namen (mit gleichnamiger Handkopie gemessen – die Liste kennt nur Handkarten). Der Quelltext des Socket-Handlers `summon_ushabti` (server.js ~15055-15150) enthält weder `getSummonBlocked` noch `summonLocked` noch die Greatmaw-Sperre (statisch im Repro belegt, der Handler selbst ist headless nicht aufrufbar); `doPlayCreature` prüft alle drei (server.js ~9804-9806). Dasselbe gilt für die Anzeigeliste `ushabtiSummonable`.
- **Repro:** `docs/niche-tests/repro/A08-pacman/29-ushabti-beschwoerung-umgeht-beschwoerungssperren.js` (✗ = Handler ohne Sperrprüfung)
- **Vermutete Ursache:** `server.js` ~15055-15150: nur Level-, Zonen- und `canSummon`-Prüfung, keine Sperren. Restunsicherheit (daher B): nur gelesen/statisch belegt, nicht über den Socket ausgeführt.

### A08-30 · Waflav-Formen: die Zielliste „any target on the board" führt eine seitenfremde Kreatur unter dem Besitzer-Brett, IDs kollidieren · Stufe B
- **Karten:** Flamebathed, Swampborne, Thunderstruck, Deep-Drowned Waflav (gemeinsam `_waflav-shared.js collectBoardTargets`); Prüfauftrag „Zielsammler Brettspalte / Besitzer ODER Kontrolleur"
- **Voraussetzungen / Aufbau:** Sitz 0 hat „ZZ Dummy" (Held 0 / Slot 0) und spielt Plant Golem (Besitzer 0, Kontrolleur 1, steht auf Seite 1 / Held 0 / Slot 0). Waflav steigt zu Swampborne auf, die Zielwahl öffnet sich.
- **Erwartet** (Text: „Choose any target on the board"; Bakhm liefert denselben Golem korrekt als `equip-1-0-0` mit Brettseite 1, gemessen): Der Golem erscheint mit der Brettseite 1, alle IDs sind eindeutig.
- **Beobachtet:** Der Golem trägt `owner: 0` und die ID `equip-0-0-0` – identisch mit der Dummy von Seite 0. Die Oberfläche kann das Ziel nur an der falschen Stelle zeichnen (Seite 0 / Held 0 / Slot 0), und `targets.find(t => t.id === pick[0])` liefert stets den ersten Eintrag; der Golem lässt sich nicht gezielt wählen. Ohne gleichkoordinierte Kreatur liegt die Markierung auf einem leeren Platz der Besitzerseite.
- **Repro:** `docs/niche-tests/repro/A08-pacman/30-waflav-zielliste-seitenfremde-kreatur.js` (✗ = Fehler tritt auf; Oberfläche nicht geprüft – daher B)
- **Vermutete Ursache:** `_waflav-shared.js` ~Z. 436-445: `id: equip-${inst.owner}-…`, `owner: inst.owner` statt der Brettseite (`engine.physicalSide(inst)`). Gleiche Klasse wie A08-16/-18.

### A08-31 · Cool Presents: das Hand-Fenster (Ambush the Scout) öffnet sich für jede verschenkte Karte einzeln · Stufe B
- **Karten:** Cool Presents (`cool-presents.js`), Ambush the Scout (Gegner); Engine `actionTransferCardToOppHand`
- **Voraussetzungen / Aufbau:** Sitz 0: 24 Gold, Cool Presents + drei verschiedene Handkarten, verschenkt alle drei. Sitz 1 hält Ambush the Scout (Heldenstufe vorhanden) und antwortet mit echtem „Nein" (`null`) bzw. „Ja".
- **Erwartet** (Engine-Vorbild Live Show, `_engine.js` ~Z. 25325: „der Aufrufer verschenkt MEHRERE Karten in einem Zug und hat das Fenster einmal für das ganze Geben geöffnet — ein Fenster je Karte würde den Gegner mit derselben Frage mehrfach unterbrechen"; Ambush: „Negate that effect"): ein Effekt, ein Fenster.
- **Beobachtet:** Bei „Nein" wird der Gegner dreimal gefragt (je Karte). Bei „Ja" wird nur die erste Übergabe negiert, die Schleife bricht ab (`if (!ok) break`), die Kosten (3 × 4 Gold = 12) sind vorab für alle drei Karten bezahlt; nichts wurde verschenkt.
- **Repro:** `docs/niche-tests/repro/A08-pacman/31-cool-presents-handfenster-je-karte.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `cool-presents.js` (~Z. 158, Schleife) ruft `actionTransferCardToOppHand(pi, t.handIndex, { source })` ohne `windowChecked: true`; das Fenster wird nicht einmal vor der Zahlung geöffnet (Live Show, `live-show.js:202`, macht es richtig). Gleiche Klasse bei jeder Mehrkarten-Übergabe.
- **Zusatz (im Repro als zweiter Teil):** Hat der Gegner eine Such-Sperre (`ps.searchLocked`, über Siege auch über Zugwechsel hinweg erreichbar), lehnt `actionTransferCardToOppHand` jede Übergabe ab. Cool Presents prüft nur `ops.handLocked` (dann sauberer Abbruch ohne Kosten): gemessen wurden 12 Gold bezahlt, 0 Karten geliefert, die Karte liegt in der Ablage.

### A08-32 · Afflicted Pests reagiert nicht, wenn der Gegner eine Ability anlegt (Text „equips or attaches a card to a Hero") · Stufe C
- **Karten:** Afflicted Pests (`afflicted-pests.js`, Auslöser `surpriseEquipTrigger`), Vergleich Noble Mummy Guards („attaches an Ability to a Hero")
- **Aufbau / Schritte:** Sitz 0: Pests als Surprise an Held 0; Sitz 1 legt „Fighting" bzw. „Resistance" an Held 0 an. Vergleich: Club of Gobbo wird ausgerüstet.
- **Erwartet:** offen. Wörtlich ist eine Ability „a card", die an den Helden „attached" wird (so formuliert es das Spiel bei Waflav und Noble Mummy Guards). Das Skript meint nur Karten, die in eine Support Zone treten (Ausrüstung/Attachments).
- **Beobachtet:** Club of Gobbo löst aus ✓; Fighting und Resistance lösen nicht aus, Pests bleibt verdeckt. Der Skriptkopf nennt „Choose a non-Creature card in any Hero's Support Zone" (älterer Textstand).
- **Repro:** `docs/niche-tests/repro/A08-pacman/32-afflicted-pests-loest-bei-ability-nicht-aus.js` (✗ = Lesart „Abilities zählen" verletzt)
- **Vermutete Ursache:** `_engine.js` ~3567: `_checkSurpriseOnEquip` wird nur beim Eintritt in eine Support Zone gerufen; das Ability-Anlegen nutzt `surpriseAbilityTrigger`.
- **Frage an Al:** Soll Afflicted Pests auch auslösen, wenn der Gegner eine Ability an einen Helden anlegt – ja oder nein?

## Abdeckung
| Karte | Tiefe | Geprüfte Nischenfälle / Anmerkung |
|---|---|---|
| "Bloom", the Continent Corruptor | L2 gezielt | erzwungener Aufstieg aus dem Tod (mit/ohne Paraseed Control/Extraleben) ✓, Gift → Heilung ✓, Deckel-Löschen bewusst ✓; Heilbetrag hängt von der Heldenreihenfolge ab ✗(→ -22) |
| Afflicted Pests | L2 gezielt | Auslöser Ausrüsten ✓, Ability-Anlegen löst nicht aus (C → -32), Token als Ziel ✗(→ -11), Zielwahl Eigen-/Gegnerseite ✓ |
| Afflicted Vermin | L2 gezielt | Platzkonkurrenz mit eingenisteter Paraseed (Text „user's free Support Zones" = Zonen des Helden, Regel CARD_API Z. 2514) ✓, keine freie Zone ⇒ keine Aktivierung (Ruling) ✓, Extraleben-Ziel ✗(→ -07) |
| Bakhm, the Desert Digger | L2 gezielt | Surprise-Kreaturen in Support Zones ✓, Nicht-Surprise abgelehnt ✓, 100 Schaden auf Held und Kreatur inkl. seitenfremden Golem (Id `equip-1-0-0`) ✓, gestohlener Bakhm ✓, Quelle mit `heroOwner` ✓, gefroren/negiert/tot ruht (gelesen) |
| Big Gwen Guard | L2 gezielt | Kosten Weakening Crystal ✓, Kosten Grinning Cat ✗(→ -06) |
| Bloom, the Maniacal Botanist | L2 gezielt | Aura je Paraseed 0/1/2 ✓, auf Gegner- und eigene Helden ✓, Reihenfolge mit Continent ✗(→ -22) |
| Cactus Creature | L2 gezielt | Umleitung Frost/Betäubung/Brand/Gift/Negierung auf Held und Kreatur ✓, Fenster bei Kreaturenstatus ✗(→ -13) |
| Chatty Town Guard | L2 gezielt | HOPT ✓, Hand-Sperre eigen/Gegner ⇒ keine Aktivierung ✓, Gegner-Such-Sperre ⇒ Abbruch ohne HOPT ✓, gleichnamige Instanz ✗(→ -04), Crystal-Geschenk ⇒ Empfänger ungebunden ✗(→ -01) |
| Cool Presents | L2 gezielt | 0 Karten ✓, gleichnamige Karten (ein Eintrag) ✓, Gegner-Hand-Sperre ⇒ Rückerstattung ✓, Rusting ✗(→ -02), Fenster je Karte/Such-Sperre ✗(→ -31) |
| Crystal Well | L2 gezielt | HOPT je Spieler ✓, Gegner-Hand-Sperre ⇒ nicht aktivierbar ✓, leeres Deck (Karte weg, nichts gezogen) ✓ erwartbar, gleichnamige Instanz ✗(→ -04), Zieh-Sperre ⇒ Karte verschenkt ✗(→ -24 Zusatz) |
| Deep-Drowned Waflav | L2 gezielt | Überladung auf Held ✓, auf Kreatur ✗(→ -15), Tutor aus gesperrter Ablage ✗(→ -14), Descend-Kette ✓ |
| Distracting Crystal | L2 gezielt | Horn in a Bottle ✗(→ -08), nicht markierte Karten ✗(→ -09), Einsatz-/Auslöser-Effekte (C → -10), Sperre bei Zauber/Artefakt/Ability ✓ |
| Flamebathed Waflav | L2 gezielt | Aufstieg + Verbrennen (Held, Kreatur, eigener Held) ✓, Counter bei Burn ✓, gefroren/betäubt/negiert ⇒ keine Counter ✓, Ziele/Wiederholung (C → -19), Aufstieg über Paraseed-Control-Deckel ✗(→ -05) |
| Grinning Cat | L2 gezielt | sperrt Handkreaturen ✓, Surprise-Kreatur legen erlaubt ✓, zwei Katzen ✓, Wechselwirkung Big Gwen ✗(→ -06), Ushabti-Beschwörung ✗(→ -29) |
| Letter of Misinformations | L2 gezielt | Mischen der Gegnerhand und Aufdeck-Marken (5 Seeds) ✗(→ -03), kein Effekt beim Ausspielen ✓, Letter selbst ausgenommen ✓ |
| Mana Absorbing Crystal | L2 gezielt | +1 Level für Spells (nicht Attacks) ✓, mehrere Kopien nicht gestapelt (Skriptkopf-Ruling) ✓, mit Trial of Knowledge ✓ (Level bleibt 0), Hand-Aktivierung 200 Schaden/Löschen (Held tot, letzter Held, Extraleben, zwei Kopien) ✓ |
| Mary Crestmas | L2 gezielt | Ziehen je übergebener Karte (3 Karten, drei Kristalle gezogen, Bilanz/Audit sauber) ✓, Schadensnegierung mit Abwurf ✓, HOPT-Reset zu Beginn des eigenen Zuges ✓, zweiter Treffer im selben Zug ✓, Brenn-Tick ✓; Konstruktion: Schaden 0 löst Abfrage/Kosten aus (nicht gemeldet); gleichnamige Instanz ✗(→ -04) |
| Mummy Maker Machine | L2 gezielt | Token auf aktivierenden Held (Effekt ersetzt) und anderen Helden ✓, alle Helden vermummt ⇒ bleibt verdeckt ✓, eigene Zonen voll ⇒ bleibt verdeckt ✓, Host gefroren/betäubt/negiert ⇒ keine Auslösung ✓, Token zählt ohne `currentHp`-Feld sauber (50 − 30 = 20) ✓ |
| Noble Mummy Guards | L2 gezielt | Rückgabe der obersten Fähigkeit eines Stapels ✓, Wahl bei mehreren ✓, Rückgabe an Karten-Besitzer ✓, Audit sauber ✓, Auslösen ohne andere Fähigkeit ✗(→ -25) |
| Paraseed | L2 gezielt | Einnisten beim Töter ✓, Gift unheilbar/Abgang ✓, Max-HP-Fraß ✓, Dominance-Löschen ✗(→ -12), gefroren/negiert (C → -23) |
| Paraseed Control | L2 gezielt | Übernahme + 100/100 ✓, Gift neu aufgelegt ✓, Karte vor Auflösung aus `ps.hand` ✓, Heilung/`increaseMaxHp` über 100 abgewiesen ✓, Aufstieg ✗(→ -05) |
| Paraseed Greenhouse | L2 gezielt | Pflanzen (1 Ziel/mehrere) ✓, Umziehen mehrerer Paraseeds, HOPT-je-Paraseed ✓, Such-/Stapelsperre ✗(→ -24) |
| Paraseed Zombie | L2 gezielt | Paraseed aus Hand/Deck ✓, ohne Paraseed/ohne freie Zone ⇒ nicht spielbar ✓, nicht tödlicher Treffer ✓, Löschen der Karte ✓, Folgetick ✓, Quelle = gestohlene Kreatur ✗(→ -21) |
| Pure Advantage Camel | L2 gezielt | Zugbeginn-Ziehen löst nicht aus ✓, 3 Karten gezogen ⇒ ein Auslösen ✓, zwei Camels ✓, Camel gegen Camel ✓; Konstruktion (nicht gemeldet): Ziehen des Gegners in der Resource Phase des Camel-Besitzers löst nicht aus (`drawInfo.phase === 1`), keine reale Karte bekannt |
| Rusting Crystal | L2 gezielt | Equipment ✓, Mana Absorbing Crystal ✓, Nicht-Stapeln ✓, Cool Presents/Beer ✗(→ -02/-26), zweite Kopie (C → -27) |
| Stormkissed Waflav | L2 gezielt | Aufstieg, Abwurf-Counter, Tutor aus Deck ✓, Tutor unter Stapelsperre ✗(→ -14) |
| Swampborne Waflav | L2 gezielt | Gift auf Held/Kreatur, Stapel ✓, Counter je Giftanwendung ✓, Ziele/Wiederholung (C → -19), Zielliste seitenfremd ✗(→ -30) |
| The Final Trial | L2 gezielt | zu früh ⇒ nicht spielbar ✓, im Zug einer Trial ⇒ nicht spielbar ✓, als erste Aktion nach fünf Trials ⇒ Sieg ✓ (Audit/Fehler sauber) |
| Thunderstruck Waflav | L2 gezielt | Aufstieg-Stun ✓, Defeat-Trigger (Held, Kreatur) ✓, Stun auf Gegnerheld ✓, übernommener Held (Quelle/Brettseite) ✓, Zielliste seitenfremd ✗(→ -30) |
| Treacherous Crystal | L0 gelesen | Handler `doTriggerTreacherousCrystal` (server.js:9435) ist nicht exportiert, headless nicht aufrufbar; gelesen: filtert `inst.owner !== oi` (Besitzer), „all Creatures you control" gilt dem Kontrolleur – nicht ausgeführt, daher nicht gemeldet |
| Trial of Annoyance | L2 gezielt | Gegnerhand ≤ 2 ⇒ nichts abzuwerfen ✓, Abwurf bis 2 Karten (Kristalle in der Hand) ✓, Riegel/Once-Stempel ✓ |
| Trial of Coolness | L2 gezielt | Abbruch ⇒ Karte zurück ✓, kein Ziel ⇒ unspielbar ✓, Nutzer ausgenommen ✓, Extraleben-Stapel ✓, Schaden-Todesweg ✓; „defeat" ✗(→ -07), Zielsammler seitenfremd ✗(→ -18) |
| Trial of Dominance | L2 gezielt | leeres Gegnerbrett ✓, Löschen statt Ablage ✓, Quelle mit `controller`/`heroOwner` ✓, Paraseed-Nisten ✗(→ -12), Extraleben ✗(→ -07), Erst-Runden-Gate (B-06) |
| Trial of Knowledge | L2 gezielt | Level 0 für alle „Trial of"-Spells, bleibt mit Mana Absorbing Crystal 0 ✓, nach Zugwechseln ✓, Gegner unberührt ✓ |
| Trial of Loyalty | L1 Standard | Abbruch der Galerie ⇒ Karte zurück ✓, leeres Ergebnis ⇒ Riegel ✓, 7 Treffer/max. 5 ✓ (Skripte gelesen; Suchsperre-Marke per Ruling); nicht tiefer |
| Ushabti of the Great Pharaoh | L2 gezielt | eigene/gegnerische/gestohlene Kreatur ✓ (Rückgabe zum Zugende ✓), beschädigt/gefroren bleibt erhalten, Zielsammler ✗(→ -16), seitenfremde Kreatur ✗(→ -17), Beschwörungssperre ✗(→ -29) |
| Waflav, the Metamorphing Monstrosity | L2 gezielt | Draw 3 + HOPT je Effekt ✓, Fähigkeit aus Deck/Hand anhängen ✓, Zähler beim Kill ✓ (gefroren/betäubt/negiert ⇒ keine), Aufstiegs-/Descend-Kette über alle Formen ✓ |
| Weakening Crystal | L2 gezielt | Anlage beim Eintritt/Zug ✗(→ -01), fremde Negation ✗(→ -20), Status-Immunität ✗(→ -28), `sourceBound` übersteht die Zugende-Räumung ✓, heilbar (Ruling) |

## Getestet & in Ordnung (Auswahl)
- Prüfaufträge: **`counters.currentHp ?? 0` (C05-01):** `_engine.js:12385` reicht bei jeder unversehrten Kreatur (`counters` leer; HP-Feld entsteht erst beim ersten Schaden) den Betrag 0 an das Rettungsfenster (`_checkCreaturePreDefeatHandReactions`); die drei Leser (`barrier-of-undying`, `loyal-bone-dog`, `troop-annihilation`) werten den Betrag nicht aus ⇒ folgenlos (gemessen mit Dummy/Mummy Token). Ein von Mummy Maker Machine gesetzter Token mit leerem `counters` rechnet beim ersten Schaden korrekt (50 − 30 = 20).
- **`negatedDuration` ohne Leser (H03-15):** in den Skripten der Gruppe kein Verbraucher; die einzige Fundstelle ist ein Kommentar in `null-the-mage-slayer.js`. Cactus Creature reicht `duration` bei der Umleitung an `addHeroStatus`/`applyCreatureStatus` weiter ✓.
- **Zugende-Räumung `negated` ohne `sourceBound` (C05-02):** Weakening-Crystal-Negation (`sourceBound`) überlebt vier echte Zugwechsel ✓; die Lücke entsteht nur bei vorheriger fremder Negation (→ A08-20).
- **Aufgelöste Karte bleibt in `ps.hand` (R02-07):** gemessen — Trial of Coolness, Loyalty und Annoyance liegen während ihrer Zielwahl/Galerie/Abwurfwahl noch in `ps.hand`; Paraseed Zombie und Paraseed Control sind beim Platzieren/Wiederbeleben schon aus der Hand (die Instanz trägt noch `zone: hand`). In dieser Gruppe ohne beobachtbare Folge; Cool Presents schließt den eigenen Slot ausdrücklich aus.
- **`source.controller` mit `heroIdx` bei geliehenem Angreifer (R02-13/-20):** Bakhm (`heroOwner`), Trial of Dominance (`controller`, `heroOwner`), Thunderstruck/Flamebathed (`quelleIstHeld`) ✓, auch mit dauerhaft übernommenem Waflav (Zähler auf der richtigen Brettseite, Stun landet). Abweichler nur Paraseed Zombie (→ -21).
- **Zielsammler Brettspalte / Besitzer ODER Kontrolleur (F02-14, S01-09):** sauber: Bakhm (liefert seitenfremden Golem mit Brettseite + Instanz), Ushabti mit gestohlener Kreatur einzeln (Rückgabe zum Zugende ✓); fehlerhaft: Ushabti (-16/-17), Trial of Coolness (-18), Waflav-Formen (-30). Das Muster `c.owner === target.owner` steht in 65 Skripten (`grep`) – Hinweis für die Querschnittsprüfung.
- Dauereffekte und Statusfilter (Klasse B-01…B-03): Waflav-Passive (Flamebathed/Swampborne/Thunderstruck/Basis) ruhen bei gefroren/betäubt/negiert ✓; Pests/Vermin/Camel/MMM/NMG/Cactus lösen bei Host gefroren/betäubt/negiert nicht aus (Surprise-Regel) ✓; Paraseed teilweise (→ -23).
- Rusting Crystal: Kosten von Equipment (4 → 8) und Mana Absorbing Crystal (15 → 30) verdoppelt, Nicht-Stapeln bei zwei Kopien (nach Skriptkopf-Auslegung) ✓.
- Trial-Familie: Riegel „keine anderen Attacks/Spells" vorwärts und rückwärts, Once-Stempel nach Abbruch frei (Loyalty, Coolness), Final Trial gewinnt nur als erste Aktion nach allen fünf Trials ✓.
- Paraseed Control: Heilung über 100 und `increaseMaxHp` werden vom Deckel abgewiesen ✓ (nur der Aufstieg umgeht ihn, → -05).
- Mary Crestmas: Ziehen je Übergabe, Schadensnegierung nur mit „originally owned"-Karte, HOPT pro Seite, Reset zu Beginn des eigenen Zuges, Brenn-Tick ✓. Hinweis: das Vorgänger-Skript `t14-mary.js` (Scratchpad) endete wegen eines Fehlers beim Auflösen eines Sets lautlos – Mary wurde erst jetzt tatsächlich gemessen.
