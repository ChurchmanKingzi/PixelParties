# A07-guardianbeasts – Nischenfall-Bericht
Stand/Autor: Agent A07-guardianbeasts, 12.10.2026. Karten: 59 in der Liste · (wird am Ende gezählt) gezielt getestet · (wird am Ende gezählt) mit Befund.

## Zusammenfassung
(wird am Ende ausgefüllt – Bericht wächst fortlaufend)

## Befunde

### A07-01 · Mao feuert Guardian Beast Zhu im Beschwörungszug und trotz verbrauchtem „once per game" · Stufe B
- **Karten:** Mao, the Vengeful Guardian (`cards/effects/mao-the-vengeful-guardian.js`), Guardian Beast Zhu (`cards/effects/guardian-beast-zhu.js`)
- **Voraussetzungen / Aufbau:** Sitz 0 mit Mao als Held 0; Zhu frisch auf dem Brett (Beschwörungszug = aktueller Zug); eigene Ablage 13 Karten (3 verschiedene Guardian Beasts + 10 Füller), gegnerische Ablage 8 Füller; Main Phase 1.
- **Schritte:** 1. Zhu direkt aktivieren → abgelehnt (korrekt). 2. Mao aktivieren, Zhu wählen, 5 Füllkarten als Kosten löschen. 3. Zhus Kosten (je 8 Karten) bezahlen. Variante: vorher `gs._guardianBeastZhuUsed[0] = true` (Zhu in dieser Partie schon benutzt).
- **Erwartet** (Zhu: „You can never activate this effect the turn you summon this Creature. You can only activate this effect once per game."; Mao: „… to immediately activate that Creature's active effect"): Zhus Sperren gelten auch bei Maos Aktivierung – Zhu feuert im Beschwörungszug nicht (und, falls das Spiel-Limit verbraucht ist, auch keine zweite Zhu).
- **Beobachtet:** Zhu feuert beide Male: Gegner überspringt den nächsten Zug (`_skipNextTurn`), 16 Karten gelöscht, Zhu danach negiert. Mao ruft `script.onCreatureEffect(fireCtx)` direkt auf (mao…js:162) und fragt weder `canActivateCreatureEffect` noch die Marken der Kreatur ab; die beiden Sperren stehen bei Zhu nur in `canActivateCreatureEffect` (guardian-beast-zhu.js:64 `once per game`, :68 `turnPlayed`), nicht in `onCreatureEffect`.
- **Repro:** `docs/niche-tests/repro/A07-guardianbeasts/01-mao-refeuert-zhu.js` (`node docs/niche-tests/repro/A07-guardianbeasts/01-mao-refeuert-zhu.js`; ✗ = Fehler tritt auf)
- **Vermutete Ursache:** `mao-the-vengeful-guardian.js:42-52` (`isRefirable` prüft nur Kontrolle/Zug/Negation, nicht die Aktivierbarkeit); Zhus Sperren fehlen in `onCreatureEffect`.
- **Restunsicherheit (daher B):** Maos Text erlaubt ausdrücklich das „sofortige Aktivieren" einer im Zug beschworenen Kreatur; dass Zhus „never" dagegen gewinnt, ist die naheliegende, aber nicht ausdrücklich entschiedene Lesart. Ohne diese Lesart wäre Mao + Zhu nie kombinierbar (Mao verlangt „summoned this turn").

### A07-02 · Niu-Bonus („this turn") überlebt Zhus Zug-Überspringen und verstärkt den Angriff im nächsten eigenen Zug · Stufe A
- **Karten:** Guardian Beast Niu (`guardian-beast-niu.js`), Guardian Beast Zhu (`guardian-beast-zhu.js`), Engine-Zugwechsel (`_engine.js` ~23660, `_skipNextTurn`)
- **Voraussetzungen / Aufbau:** Sitz 0: Niu + Zhu (ohne Beschwörungsschlaf), Ablagen eigen 8 (3 verschiedene Guardian Beasts + 5 Füller) / gegnerisch 9; Zug 5, Main Phase 1.
- **Schritte:** 1. Niu aktivieren (Held 0, 1 gegnerische Karte löschen → `niu_enhanced` +50). 2. Zhu aktivieren (je 8 Karten). 3. `t.endTurn()` (Gegner-Zug 6 wird übersprungen, Zug 7 gehört wieder Sitz 0). 4. Mit Held 0 „Attack" (Basisschaden = ATK) spielen.
- **Erwartet** (Niu: „increase the damage the next Attack one of your Heroes performs **this turn** by 50 for each card deleted"): im Folgezug kein Niu-Bonus mehr.
- **Beobachtet:** Buff steht in Zug 7 noch (`expiresAtTurn: 6, expiresForPlayer: 1`); Attack richtet 90 statt 40 Schaden an (+50 aus Niu).
- **Repro:** `docs/niche-tests/repro/A07-guardianbeasts/02-niu-bonus-ueberlebt-zhu-skip.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** Niu lässt den Buff erst zu Beginn des GEGNER-Zuges ablaufen (`guardian-beast-niu.js`: `expiresAtTurn: gs.turn + 1, expiresForPlayer: oi`). Zhus übersprungener Gegner-Zug ruft `startTurn()` nie (`_engine.js` switchTurn „_skipNextTurn"-Zweig), also läuft der Ablauf nie. Dasselbe gilt vermutlich für jeden anderen Effekt, der „bis Beginn des Gegnerzuges" als „diesen Zug" modelliert (nicht geprüft).

### A07-03 · Baihu: „versteinerte" Kreatur ist nicht betäubt und darf weiter aktivieren (und Stun-Immunität wird ignoriert) · Stufe A
- **Karten:** Cardinal Beast Baihu (`cardinal-beast-baihu.js`), Ziel: beliebige gegnerische Kreatur (im Test Dragolfin)
- **Voraussetzungen / Aufbau:** Sitz 0: Baihu; Sitz 1: Dragolfin (aktiver Effekt), Deck 30; Zug 5 Main Phase 1, danach Zug 6 (Sitz 1).
- **Schritte:** 1. Baihu aktivieren, Dragolfin wählen. 2. `t.endTurn()`. 3. Im Zug des Gegners Dragolfin aktivieren (Held 0 von Sitz 0 als Ziel). Nebenbefund: dasselbe mit einem Ziel, das `counters.stun_immune` trägt.
- **Erwartet** (Baihu: „Stun it for 3 turns. A target Stunned by this effect takes no damage from any sources."): die Kreatur ist wirklich betäubt (kein aktiver Effekt, Passiv-Hooks stumm – wie jede betäubte Kreatur) und schadensimmun; ein gegen Stun immunes Ziel wird nicht „Stunned by this effect" und damit nicht schadensimmun.
- **Beobachtet:** Baihu setzt bei Kreaturen nur `_baihuStunned` + `_baihuPetrify` (cardinal-beast-baihu.js:105-108), nie `counters.stunned`, und geht an `applyCreatureStatus` vorbei. `isCreatureEffectSuppressed` (_engine.js:18819) und `doActivateCreatureEffect` kennen `_baihuStunned` nicht → Dragolfin schlägt im Gegnerzug mit 150 Schaden zu; das `stun_immune`-Ziel bekommt trotzdem die Marker (Schadensimmunität).
- **Repro:** `docs/niche-tests/repro/A07-guardianbeasts/03-baihu-versteinerte-kreatur-nicht-betaeubt.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** Baihu schreibt Marker statt den Status zu setzen (Lücke zwischen der Anzeige „Petrified: Stunned and immune to all damage", app-shared.js:10441, und der Engine, die nur `counters.stunned` als Stilllegung kennt). Gleiche Umgehung betrifft alle Status-Tore von `canApplyCreatureStatus` (Defending the Gate, Light Ball, Monia-Schild – nicht einzeln getestet).

### A07-04 · Vullary und Stellin „beschwören" per Platzierung und umgehen `canSummon`/`beforeSummon` anderer Karten · Stufe A
- **Karten:** Unsettling Opportunist Vullary (`unsettling-opportunist-vullary.js:143`), Stellin, the Calm Dictator (`stellin-the-calm-dictator.js:273`); betroffene Ziele: Gigantisaur-Kreaturen, Guardian Beasts, Blue-Ice Dragon (und jede Kreatur mit `canSummon`/`beforeSummon`)
- **Voraussetzungen / Aufbau:** Vullary mit angelegter Cute Princess Mary (echter Weg: Modus A, dann Modus B) bzw. Stellin mit Stellan (Schaden an Stellin + `_flushSurpriseDrawChecks`), Zug 5.
- **Schritte (Vullary):** 1. Held 0 trägt Gigantisaur Triceras; Pteranos auf der Hand → Vullary Modus B, Pteranos wählen. 2. Ablage nicht leer, Guardian Beast Tu auf der Hand → Modus B. 3. Blue-Ice Dragon auf der Hand, keine Opfer → Modus B. **(Stellin):** Ablage nicht leer, Guardian Beast Tu und Gou auf der Hand → Stellin wird getroffen, „hand"-Weg, beide wählen.
- **Erwartet** (Vullary: „regardless of its **level**" – nur das Level entfällt; Stellin: „summon … Creatures"; Gigantisaur: „A Hero can only have 1 Gigantisaur Creature …"; Guardian Beast: „You can only summon this Creature while you have no cards in your discard pile"; Blue-Ice: „only summon this Creature by sacrificing 2 Creatures"; Präzedenz: CARD_API.md ~Z. 9408 Skullmael's Greatsword „SUMMON, NICHT PLACE"): die Tore `canSummon` und die Kosten aus `beforeSummon` gelten.
- **Beobachtet:** Alle vier Fälle gehen durch: Held 0 hat danach Triceras UND Pteranos; Tu liegt trotz 2 Ablagekarten auf dem Brett (ebenso Tu+Gou über Stellin); Blue-Ice Dragon liegt ohne Opfer auf dem Brett. Die Galerien bieten die Karten sogar an (`isSummonablePileCreature` prüft nur die Kartenart).
- **Repro:** `docs/niche-tests/repro/A07-guardianbeasts/04-vullary-stellin-umgehen-beschwoerungsbedingungen.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `actionPlaceCreature` (_engine.js ~25949) ruft weder `isCreatureSummonable` noch `_runBeforeSummon`; die beiden Skripte filtern vorher nur nach Stufe/Kartenart. Xuanwu prüft `isCreatureSummonable` dagegen selbst.
- **Ergänzung (Fortsetzungsagent, gleiche Ursache, Repro erweitert):** Auch Stellins **Deck-Weg** („1 level 0 Creature from your deck") umgeht `canSummon`: er läuft zwar über `summonCreatureWithHooks` (anders als der Hand-Weg über `actionPlaceCreature`), das Skript fragt aber vor der Galerie nie `isCreatureSummonable` – Guardian Beast Tu landet bei 2 Ablagekarten auf dem Brett. `summonCreatureWithHooks` selbst prüft `canSummon` nicht (Vertrag laut Kommentar an `isCreatureSummonable`: „usable from any summoning effect … that wants to filter its gallery").
- **Folgefrage (nicht eigens als Befund):** beide Karten stempeln `countAsSummon: false`, d. h. diese „Beschwörungen" zählen nicht für „erste Kreatur, die du in deinem Zug beschwörst" (Harpyformer-Gratisaktion). Vullary: erst Vullary-Kreatur, dann Harpyformer → Harpyformer bleibt gratis. Siehe C-Befund unten.

### A07-05 · Dream Lander verlässt das Brett ohne Schadens-Tod → der angelegte Held verschwindet aus dem Spiel · Stufe A
- **Karten:** Goff, the Burnbringer (stellvertretend für alle sieben Dream Lander: Clausss, Smug Mastermind Antonia, Smugbeth, Stellin, Unsettling Opportunist Vullary, Wolflesia); auslösend: Green Dragoneer (Opfer), Mass Routing, jede Zerstörung per `actionDestroyCard` (u. a. Antonias „send to the discard pile", Blue-Ice-/Clausss-/King-Trex-Opfer)
- **Voraussetzungen / Aufbau:** Goff mit angelegtem „Gon, the Frostbringer" (echter Weg: Goff aktivieren, Gon aus der Hand), 10 Deckkarten, Zug 5.
- **Schritte:** a) `actionDestroyCard(Goff)`; b) Green Dragoneer opfert Goff; c) Mass Routing (Held 0, Stufe via `grantFor`); jeweils danach Gon in Hand/Deck/Ablage/Gelöscht zählen. Kontrolle: Goff stirbt durch Schaden.
- **Erwartet** (Engine-Vertrag `actionAttachHeroToCreature`, _engine.js ~10320: „Effects that destroy / steal the host Creature take the attachment with them; on creature death, the attached Hero is sent to the original owner's discard pile"): der Held bleibt eine Karte im Spiel – nach dem Abgang der Kreatur liegt er in einer Zone (Ablage bzw. Deck).
- **Beobachtet:** Nur der Schadens-Tod räumt auf (Gon → Ablage ✓). Bei Zerstörung per Effekt, bei Opfer und beim Zurückmischen ist Gon in **keiner** Zone mehr (Kartenbilanz −1; Spiel läuft ohne Fehlermeldung weiter).
- **Repro:** `docs/niche-tests/repro/A07-guardianbeasts/05-dream-lander-angelegter-held-verschwindet.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** Die Aufräumzeile steht nur im Schadens-Todespfad (`_engine.js:47273`, `creatureDiscardPs.discardPile.push(attachedHero)`); `actionDestroyCard` (_engine.js:12248) und der Pile-Abgang (Mass Routing/Homecoming) kennen `counters.attachedHero` nicht.

### A07-06 · Xuanwu + Pangaia: wiederbelebte Kreatur hat 201/201 statt 1/1 HP · Stufe B
- **Karten:** Cardinal Beast Xuanwu (`cardinal-beast-xuanwu.js:140`), Pangaia, the Dino Domain (`pangaia-the-dino-domain.js`, `onCardEnterZone`)
- **Voraussetzungen / Aufbau:** Sitz 0: Xuanwu auf dem Brett (ohne Schlaf), Pangaia in der Area Zone (echt gespielt), Ablage: Gigantisaur Raptoren (Lv3); Main Phase 1.
- **Schritte:** Xuanwu aktivieren, Raptoren wählen, erste freie Zone.
- **Erwartet** (Xuanwu: „… but its current and max HP **become 1**"; Pangaia: „… Creatures either player **summons** are increased by 200"): Raptoren hat 1/1 HP – ob Pangaia auf eine Platzierung überhaupt wirkt oder durch „become 1" überschrieben wird, beide Lesarten enden bei 1.
- **Beobachtet:** 201/201. Xuanwu setzt HP 1/1 und feuert erst danach `onCardEnterZone`; Pangaia addiert +200.
- **Repro:** `docs/niche-tests/repro/A07-guardianbeasts/06-xuanwu-pangaia-hp-1.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** Reihenfolge in Xuanwu (HP setzen → Eintritts-Hook) bzw. Pangaia unterscheidet nicht zwischen Beschwörung und Platzierung (`_isMove` ist der einzige Ausschluss).
- **Restunsicherheit (daher B):** ob die Autoren die 201 als „Pangaia wirkt auch auf Xuanwus Platzierung" gewollt haben; der Text „become 1" spricht klar dagegen.

### A07-08 · Guardian Beast Shu: Ausrüstung ist als „Creature" wählbar · Stufe A
- **Karten:** Guardian Beast Shu (`guardian-beast-shu.js:62-68, 87-97`)
- **Voraussetzungen / Aufbau:** Shu + eine Ausrüstung (Charm of Balance) auf dem Brett; zwei Kopien der Ausrüstung im Deck; Ablage 4 Karten; Main Phase 1.
- **Schritte:** Shu aktivieren, angebotene Ziele mitschneiden (dann abbrechen). Ohne Abbruch: Löschmenge 4 → die Ausrüstung kommt als Kopie auf die Hand (im Explorationslauf bestätigt).
- **Erwartet** (Shu: „choose a **Creature** on your side of the board"): nur Kreaturen werden angeboten.
- **Beobachtet:** `ownCreatures` filtert auf „offene Support-Karte des Kontrolleurs" (`c.controller === pi && c.zone === 'support' && !c.faceDown`), nicht auf den Kartentyp; die Ausrüstung steht in der Zielwahl und wird nachgeholt.
- **Repro:** `docs/niche-tests/repro/A07-guardianbeasts/08-shu-ausruestung-als-ziel.js` (✗ = Fehler tritt auf)

### A07-09 · Guardian Beast Shu: Kopien nur aus dem Deck, nicht „deck and/or discard pile" · Stufe B
- **Karten:** Guardian Beast Shu (`guardian-beast-shu.js:60-68, 86-111`)
- **Voraussetzungen / Aufbau:** (1) Kreatur X auf dem Brett, 2 Kopien nur in der Ablage, Deck ohne X; (2) 1 Kopie im Deck + 2 in der Ablage, Ablage 14 Karten.
- **Erwartet** (Shu: „Choose as many copies of that Creature from your deck **and/or discard pile** as you have deleted multiples of 4 cards"): (1) Shu ist aktivierbar, die Ablage-Kopien kommen auf die Hand; (2) 4/8/12 Karten sind wählbar (3 Kopien).
- **Beobachtet:** Shu zählt/holt nur `ps.mainDeck`: (1) nicht aktivierbar bzw. Ziel ausgegraut; (2) nur `[4]` wählbar (Deckel `Kopien im Deck × 4`).
- **Repro:** `docs/niche-tests/repro/A07-guardianbeasts/09-shu-kopien-auch-aus-ablage.js` (✗ = Fehler tritt auf)
- **Restunsicherheit (daher B):** Der Kopfkommentar des Skripts (`guardian-beast-shu.js`) beschreibt bewusst nur das Deck („that you still have copies of in your deck"); eine ausdrückliche Entscheidung dazu fand ich in CARD_API.md nicht.

### A07-10 · Hou/She/Long/Ji/Gou: „targets on the board" schließt Ausrüstung u. Ä. ein (Schaden auf Ausrüstung, Brandobergrenze) · Stufe B
- **Karten:** Guardian Beast Hou, She, Long, Ji, Gou (alle über `buildAllBoardTargets`, `_guardian-beasts-shared.js:465`; Gou zusätzlich `countEligibleOwnTargets`, Long `countBurnedTargets`)
- **Voraussetzungen / Aufbau:** Beast auf dem Brett, gegnerische Ausrüstung „Charm of Balance" auf Sitz 1; Ablage 5 Füller.
- **Schritte:** Hou aktivieren (Löschmenge 1), die Ausrüstung als Ziel wählen. Long-Variante: drei Ausrüstungen mit Brandmarke → `canActivateCreatureEffect`.
- **Erwartet** (Konvention CARD_API.md ~Z. 7929 (Kohta): „Zielmenge: Helden UND Kreaturen … Artefakte, Abilities und Surprises sind NICHT dabei"; alle anderen „choose a target"-Kreaturen der Gruppe fragen nur `['hero','creature']`): Ausrüstung ist kein „target on the board".
- **Beobachtet:** Die Ausrüstung steht in der Zielwahl; Hou schreibt 50 Schaden auf sie (`counters.currentHp = -50`, bleibt liegen); She/Ji/Long setzen Gift/Stun/Brand-Marken auf Ausrüstung; Gou zählt Ausrüstung in „targets you control other than this one" (bläht die Löschmenge); Long zählt Brandmarken auf Ausrüstung zur Obergrenze „not more than 3 targets can be Burned" – drei „verbrannte" Ausrüstungen sperren Long ganz.
- **Repro:** `docs/niche-tests/repro/A07-guardianbeasts/10-gb-ziele-enthalten-ausruestung.js` (✗ = Fehler tritt auf)
- **Restunsicherheit (daher B):** Der Kartentext sagt nur „targets"; die Heldens-/Kreaturen-Konvention stammt aus einem Ruling zu Kohta, nicht aus einem Guardian-Beast-Ruling.

### A07-11 · King Trex: nach Kontrollwechsel behält der frühere Kontrolleur die „Stufe 0" für alle Gigantisaurier dauerhaft · Stufe A
- **Karten:** Gigantisaur King Trex (`gigantisaur-king-trex.js` `_applyOverrides`/`_clearOverrides`, `onCardLeaveZone`)
- **Voraussetzungen / Aufbau:** Sitz 0: King Trex (onPlay gefeuert), Gigantisaur Spinor (Lv3) auf der Hand, Helden ohne Schulen; danach `actionTransferCreature(trex, 1, 0, 0)` (dauerhafte Übernahme, wie Dark Gear/Diplomacy/Capture), zwei `endTurn()`.
- **Erwartet** (King Trex: „**While you control this Creature**, the levels of all "Gigantisaur" Creatures in your hand are reduced to 0"): nach dem Kontrollwechsel ist die Absenkung für Sitz 0 weg (Spinor Lv3 ohne Summoning Magic nicht spielbar) und gilt für Sitz 1.
- **Beobachtet:** Sitz 0 behält `levelOverrideCards[…] = 0` für alle 9 Gigantisaur-Namen auf allen Helden (Spinor weiter spielbar); Sitz 1 bekommt die Absenkung zusätzlich → beide Seiten spielen Stufe 3 ohne Stufe. (Kurzfristige Leihe `actionStealCreature` ist harmlos, weil die Karte am Ende des Zuges zurückgeht.)
- **Repro:** `docs/niche-tests/repro/A07-guardianbeasts/11-king-trex-uebernahme-behaelt-stufe0.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** Aufräumen nur in `onCardLeaveZone` (Kontrollwechsel feuert den Hook nicht); `onTurnStart` stempelt immer für `ctx.cardOwner` (den aktuellen Kontrolleur), entfernt aber nie beim früheren.

### A07-12 · Guard Duty: negierte Guard Duty verbraucht das „once per game"-Limit nicht · Stufe B
- **Karten:** Guard Duty (`guard-duty.js:45`; Gegenkarten im Test: No Retreat!, The Master's Plan)
- **Voraussetzungen / Aufbau:** Sitz 0: zwei Guard Duty auf der Hand, Ablage 3 Karten; Sitz 1: No Retreat! (bzw. The Master's Plan) auf der Hand, Held mit passender Schule; Zug 5.
- **Schritte:** 1. Guard Duty spielen, Sitz 1 negiert. 2. Zweite Guard Duty spielen.
- **Erwartet** („You can only play 1 Guard Duty per game"; Ruling CARD_API.md ~Z. 11410-11416: der Stempel sitzt dort, wo die Karte die Hand verlässt – „unabhängig davon, ob ein Gegenzug sie später negiert"; Vertrag `oncePerGame: true`, Z. 2118): zweite Guard Duty nicht spielbar.
- **Beobachtet:** Die erste landet negiert in der Ablage; die zweite wird gespielt (Server: `true`), mischt die Ablage ins Deck (Deck 10 → 14).
- **Repro:** `docs/niche-tests/repro/A07-guardianbeasts/12-guard-duty-negiert-verbraucht-limit-nicht.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** Guard Duty führt ein eigenes Flag `gs._guardDutyUsed` und stempelt es erst in `onPlay`; `oncePerGame: true` fehlt. (Zhus „once per game" nutzt ebenfalls ein eigenes Flag erst nach Erfolg – dort nicht getestet, da keine Negation einer Kreaturaktivierung zur Hand war.)
- **Restunsicherheit (daher B):** Das zitierte Ruling stammt aus der Divine-Gift-Reihe („activate"), Guard Duty sagt „play".

### A07-07 · „Erste Kreatur, die du beschwörst": Platzierungseffekte zählen uneinheitlich (Xuanwu zählt, Vullary/Stellin nicht) · Stufe C
- **Karten:** alle zehn Harpyformer (`_harpyformer-shared.js`: gratis nur bei `_creaturesSummonedThisTurn === 0`), Cardinal Beast Xuanwu (`cardinal-beast-xuanwu.js:146`, zählt), Unsettling Opportunist Vullary (`…vullary.js:146`, `countAsSummon:false`), Stellin (`countAsSummon:false`), Guardian's Appearance (zählt, über `summonCreatureWithHooks`)
- **Voraussetzungen / Aufbau:** Zähler `ps._creaturesSummonedThisTurn` direkt gemessen (frische Szene, Zug 5); dazu `harpyformerInherentAction(gs, 0)` vor/nach dem Effekt.
- **Beobachtet:** normale Beschwörung → Harpyformer danach nicht mehr gratis ✓; **Xuanwu** (Text: „place … from your discard pile") → zählt, Harpyformer danach nicht mehr gratis; **Vullary** (Text: „summon a level 3 or lower Creature … as an additional Action") → zählt nicht, Harpyformer bleibt gratis; Guardian's Appearance (Text: „place") → zählt (und stempelt `_guardianBeastSummonedThisTurn`).
- **Warum unsicher:** Das Verb im Text und das Skriptverhalten laufen gegeneinander (Vullary „summon" zählt nicht, Xuanwu „place" zählt). Der Kartentext der Harpyformer sagt „the first Creature you **summon**".
- **Repro:** `docs/niche-tests/repro/A07-guardianbeasts/07-erste-kreatur-zaehlung-uneinheitlich.js` (✗ = Beobachtung tritt auf; prüft die Lesart „Text-Verb entscheidet")
- **Frage an Al:** „Zählt eine Platzierung durch Xuanwu NICHT, eine Beschwörung durch Vullary/Stellin dagegen SCHON als ‚erste Kreatur, die du beschwörst' (Harpyformer-Gratisaktion) – ja oder nein?"

### A07-13 · Hu: 5 Karten und Zugsperre gehen verloren, wenn keine Zusatzaktion möglich ist oder abgebrochen wird · Stufe C
- **Karten:** Guardian Beast Hu (`guardian-beast-hu.js:61` `canActivateCreatureEffect`, `onCreatureEffect`)
- **Voraussetzungen / Aufbau:** Hu ohne Schlaf auf dem Brett, eigene Ablage 5 Füller; (a) Hand leer bzw. nur unspielbare Karten, (b) Fireball auf der Hand und Held mit Destruction Magic, Aktionswahl (`heroAction`) abbrechen.
- **Beobachtet:** In beiden Fällen sind 5 Karten gelöscht und die Einmal-pro-Zug-Sperre gestempelt; die Zusatzaktion findet nicht statt. `canActivateCreatureEffect` prüft nur ≥ 5 Karten in den Ablagen und einen lebenden Helden.
- **Warum unsicher:** Konvention „Zielende/abbrechbare Karten: Abbruch = nichts ist passiert" (CARD_API.md) und das Ruling „Tuscan Artist" 16.8. (Triceras/Techno: ist die Wirkung unmöglich, ist der Effekt nicht aktivierbar) sprechen für Rückgabe/Sperre; der Text sagt aber nur „delete 5 cards … to immediately perform an additional Action" (Kosten vor Wirkung).
- **Repro:** `docs/niche-tests/repro/A07-guardianbeasts/13-hu-kosten-ohne-aktion.js` (✗ = Beobachtung tritt auf)
- **Frage an Al:** „Soll Hu nur aktivierbar sein, wenn eine Handkarte spielbar ist, und der Abbruch der Aktionswahl die 5 Karten zurückgeben – ja oder nein?"

### A07-14 · Gou: der verliehene Schutz endet, sobald Gou negiert oder eingefroren wird · Stufe B
- **Karten:** Guardian Beast Gou (`guardian-beast-gou.js`, Hooks `beforeDamage`/`beforeCreatureDamageBatch`)
- **Voraussetzungen / Aufbau:** Gou + eigene Zielkreatur (1000 HP), Ablage 3 Füller; Gou schützt 1 Ziel (Löschmenge 1); danach Gou negiert (`actionNegateCreature`) bzw. eingefroren, dann 100 Kreaturenschaden.
- **Erwartet** (Gou: „Those targets take no damage until the beginning of your next turn. **If this Creature leaves the board**, this effect ends prematurely."): der Schutz endet nur beim Verlassen des Bretts; Negation/Frost ändert nichts.
- **Beobachtet:** Kontrolle ✓ (0 Schaden). Nach Negation und nach Frost nimmt das Ziel die vollen 100 – `runHooks` überspringt gestoppte Kreaturen, und der Schutz sitzt ausschließlich in Gous Hooks.
- **Repro:** `docs/niche-tests/repro/A07-guardianbeasts/14-gou-schutz-endet-bei-negation.js` (✗ = Fehler tritt auf)
- **Restunsicherheit (daher B):** „Negate that Creature's effects" könnte nach den Spielregeln auch laufende Effekte beenden; der Text von Gou nennt aber als einzigen Beender das Verlassen des Bretts. **Folge für die Kombination Mao → Gou (im Repro, Teil 2):** Mao negiert die Bestie nach dem Re-Fire „bis zum nächsten eigenen Zug“; der von Mao gerade ausgelöste Gou-Schutz ist damit sofort wirkungslos (100 statt 0 Schaden am „geschützten“ Ziel) – Mao+Gou ist eine wertlose Kombination.

### A07-15 · Cardinal Beasts werden von der Aura des Creepy Clown negiert · Stufe B
- **Karten:** Cardinal Beast Zhuque (stellvertretend für alle vier), The Creepy Clown of Heaven (Querschnitt), Engine `creatureAuraNegiert` (`_engine.js:18781-18805`)
- **Voraussetzungen / Aufbau:** Sitz 0: Zhuque (per `summonCreatureWithHooks`), Sitz 1: The Creepy Clown of Heaven; Main Phase 1.
- **Erwartet** (Cardinal Beast: „This Creature is **unaffected by all cards and effects**"; Clown: „negate the effects of all other Creatures on the board"): die Aura trifft die Cardinal Beast nicht, Zhuque bleibt aktivierbar. Alle statusbasierten Wege (Freeze/Stun/Negate/Steal/Schaden) sind für Cardinal Beasts korrekt gesperrt.
- **Beobachtet:** `isCreatureEffectSuppressed(zhuque) === true` (Aura-Quelle „The Creepy Clown of Heaven"); `doActivateCreatureEffect` lehnt ab, ihre Passiv-Hooks (inkl. Siegprüfung) sind stumm. Dasselbe gilt für die Nachwirkung `gs._creatureEffectsNegated`.
- **Repro:** `docs/niche-tests/repro/A07-guardianbeasts/15-cardinal-beast-vs-creepy-clown.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** Die abgeleitete Aura-Negation (`creatureAuraInfo`) prüft `isOmniImmune` nicht (CARD_API.md ~Z. 19693 nennt als Ausnahme nur den Negations-Wächter Queen of Kings [B]).
- **Restunsicherheit (daher B):** Das Clown-Ruling (10.10.) kennt keine Cardinal-Beast-Ausnahme, es wurde aber ersichtlich nicht gegen die Omni-Immunität geprüft.

### A07-16 · Pangaia erhöht die HP einer Cardinal Beast (700 statt 500) · Stufe B
- **Karten:** Pangaia, the Dino Domain (`pangaia-the-dino-domain.js`, `onCardEnterZone` → `increaseMaxHp`), Cardinal Beast Baihu
- **Voraussetzungen / Aufbau:** Pangaia gespielt (Area), danach `summonCreatureWithHooks('Cardinal Beast Baihu')`.
- **Erwartet** („unaffected by all cards and effects"): 500/500.
- **Beobachtet:** 700/700. Praktische Wirkung klein (die Bestie nimmt ohnehin keinen Schaden), aber messbar (z. B. Stomp-Bedingung „max HP ≥ 400" oder Heilungsdeckel).
- **Repro:** `docs/niche-tests/repro/A07-guardianbeasts/16-cardinal-beast-pangaia-hp.js` (✗ = Fehler tritt auf)
- **Restunsicherheit (daher B):** Man kann „unaffected" eng auf Schaden/Statuswirkungen auslegen; die Kartenformel lautet aber „all cards and effects".

### A07-17 · Zwei Clausss im selben Zug: das zweite Opfer bringt nichts und ist trotzdem erlaubt · Stufe C
- **Karten:** Clausss, the No-Nonsense Cultist (`clausss-the-no-nonsense-cultist.js`, `ps._bonusMainActions = 1` wird nur gesetzt)
- **Voraussetzungen / Aufbau:** Zwei Clausss mit Klaus, 3 weitere Kreaturen (nicht frisch), Main Phase 1.
- **Beobachtet:** Beide Clausss aktivieren nacheinander; jede opfert eine Kreatur, `_bonusMainActions` bleibt 1 – das zweite Opfer ist verschwendet (4 → 3 Kreaturen, kein zusätzlicher Gewinn). `canActivateCreatureEffect` prüft den Stand nicht. (Mit einer Clausss gehen genau zwei Aktionen, bestätigt.)
- **Warum unsicher:** Text: „… you can perform **a second Action** during this turn's Action Phase" – spricht für höchstens die eine zweite Aktion; die Engine-Konvention (Triceras/Techno: Effekt nicht aktivierbar, wenn er nichts mehr bringt) spräche für eine Sperre, alternativ wäre eine dritte Aktion denkbar.
- **Repro:** `docs/niche-tests/repro/A07-guardianbeasts/17-clausss-doppelt-zweites-opfer-ohne-wirkung.js` (✗ = Beobachtung tritt auf)
- **Frage an Al:** „Soll die zweite Clausss gesperrt sein, solange die zweite Aktion schon vergeben ist – ja oder nein (alternativ: dritte Aktion)?"

### A07-18 · Mao zahlt 5 Karten und negiert die Bestie, auch wenn deren Effekt gar nicht feuern kann · Stufe C
- **Karten:** Mao, the Vengeful Guardian (`mao-the-vengeful-guardian.js:42-52, 162`), Beispiel Guardian Beast Zhu (Ablagen zu klein)
- **Voraussetzungen / Aufbau:** Mao, Zhu frisch auf dem Brett, eigene Ablage 6, gegnerische 6.
- **Beobachtet:** Mao ist aktivierbar (nur „≥ 5 Karten + eine frische Bestie"); er löscht 5 Karten, Zhus `onCreatureEffect` bricht intern ab (< 8 Karten), Zhu wird trotzdem bis zum nächsten Zug negiert. Log `mao_refire`, Zhu: kein Effekt. Gleiches gilt für jede Bestie, deren `canActivateCreatureEffect` falsch wäre (Gou ohne eigenes Ziel, Long bei 3 Bränden …).
- **Warum unsicher:** Der Text sagt „to immediately activate that Creature's active effect"; ob eine Aktivierung, die gar nicht möglich ist, die Kosten verbrauchen darf, entscheidet die Konvention „unmöglich → nicht aktivierbar" (Ruling „Tuscan Artist" 16.8.) – für Mao ausdrücklich nicht entschieden.
- **Repro:** `docs/niche-tests/repro/A07-guardianbeasts/18-mao-zahlt-trotz-unmoeglicher-aktivierung.js` (✗ = Beobachtung tritt auf)
- **Frage an Al:** „Soll Mao nur Bestien wählbar machen, deren Effekt gerade aktivierbar ist (wie ‚ineligible' bei den Bestien selbst) – ja oder nein?"

### A07-19 · Pteranos und Raptoren prüfen die Ziehsperre (Tuscan Artist) nicht – Kosten und Once-per-turn verbrannt, nichts gezogen · Stufe B
- **Karten:** Gigantisaur Pteranos (`gigantisaur-pteranos.js`), Gigantisaur Raptoren (`gigantisaur-raptoren.js`); Gegenprobe Gigantisaur Triceras (`gigantisaur-triceras.js:19`)
- **Voraussetzungen / Aufbau:** Sitz 0: Pteranos (bzw. Raptoren + ein zweiter Gigantisaurier) ohne Beschwörungsschlaf, Pteranos mit genau einem Gigantisaurier-Namen (Spinor) auf der Hand; Sitz 1: Tuscan Artist; Main Phase 1.
- **Schritte:** 1. Triceras aktivieren (Gegenprobe). 2. Pteranos aktivieren, Spinor abwerfen. 3. Raptoren mit genau 2 Gigantisauriern auf dem Brett aktivieren.
- **Erwartet** (Tuscan Artist: „any effect that would allow your opponent to draw 2 or 3 cards is negated"; Ruling `_draw-block-shared.js`/CARD_API.md 16.8.: „Ist der Zug der einzige Nutzen — auch wenn dafür Kosten anfallen — dann ist der aktive Effekt GESPERRT … Ein Effekt, der so nicht feuern kann, verbraucht auch sein Once-per-turn NICHT"): Pteranos (ein Name ⇒ Zug von genau 2) und Raptoren (2 Gigantisaurier ⇒ Zug von genau 2) sind gesperrt wie Triceras.
- **Beobachtet:** Triceras ist gesperrt ✓. Pteranos wirft Spinor ab, Artist negiert den Zug (Hand 0, Deck unverändert), Once-per-turn gestempelt; Raptoren verbraucht den Zug, nichts wird gezogen.
- **Repro:** `docs/niche-tests/repro/A07-guardianbeasts/19-pteranos-raptoren-ziehsperre.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `canActivateCreatureEffect` von Pteranos/Raptoren ruft `drawWouldBeBlocked` (`_draw-block-shared.js`) nicht auf; die Liste der Nutzer dort (13 Dateien) enthält beide nicht. Bei Pteranos ist der Effekt nur im Ein-Namen-Fall (Zug = 2) ganz nutzlos – mit 2+ Namen (Zug 4/6) läuft er normal; bei Raptoren nur bei genau 2 oder 3 Gigantisauriern.
- **Restunsicherheit (daher B):** Das Ruling spricht von Karten, deren Zug „der einzige Nutzen" ist; bei Pteranos kann der Spieler durch weitere Namen ausweichen, die Sperre träfe nur den Ein-Namen-Fall.

### A07-20 · King Trex: die Stufensenkung gilt weiter, wenn Trex negiert/eingefroren/betäubt/von der Clown-Aura stillgelegt ist · Stufe B
- **Karten:** Gigantisaur King Trex (`gigantisaur-king-trex.js` `_applyOverrides`/`onPlay`/`onTurnStart`/`onCardLeaveZone`); Probe-Karte Gigantisaur Spinor (Lv 3)
- **Voraussetzungen / Aufbau:** Sitz 0: Trex auf dem Brett (onPlay gefeuert), Helden ohne Schulen, Spinor auf der Hand; Trex dann negiert (`actionNegateCreature`) / gefroren / betäubt (`applyCreatureStatus`) bzw. The Creepy Clown of Heaven auf Sitz 1.
- **Schritte:** `isCreatureEffectSuppressed(trex)` prüfen, dann `heroMeetsLevelReq(0, 1, Spinor)` bzw. Spinor über den echten Spielweg (`doPlayCreature`) mit Held 1 spielen.
- **Erwartet** (Trex: „**While you control this Creature**, the levels of all "Gigantisaur" Creatures in your hand are reduced to 0"; Konvention aus B-querschnitt B-01…B-03: eine stillgelegte Kreatur verliert ihre Dauereffekte): mit stillgelegtem Trex ist Spinor ohne Summoning Magic nicht spielbar.
- **Beobachtet:** In allen vier Zuständen meldet die Engine die Kreatur als stillgelegt (`isCreatureEffectSuppressed === true`), Spinor wird trotzdem ohne Stufe auf Held 1 gespielt (Brett: Trex + Spinor). Die Senkung ist ein einmaliger Stempel in `hero.levelOverrideCards`; nur das Verlassen des Bretts räumt ihn weg.
- **Repro:** `docs/niche-tests/repro/A07-guardianbeasts/20-king-trex-stillgelegt-senkt-weiter.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** Stempel statt Abfrage (`_applyOverrides` bei onPlay/onTurnStart; `onTurnStart` überspringt negierte Trex nur beim Neu-Stempeln, räumt aber nichts ab). Gleiche Klasse wie B-03 (Elven Forager); anders als dort ist das Muster hier ein Stempel, nicht der `reduceCardLevel`-Weg.
- **Restunsicherheit (daher B):** Ob die Autoren Dauerstempel nach Negation bewusst stehen lassen, ist nicht entschieden; die Frage an Al steht bei B-03 (dieselbe Antwort gilt hier).

### A07-21 · Zieh-Kreaturen ignorieren die Zieh-Sperren uneinheitlich: Kosten verbrannt, nichts gezogen · Stufe C
- **Karten:** Gigantisaur Triceras, Pteranos, Raptoren, Guardian Beast Tu, Techno Harpyformer (Sperren: `handLocked` z. B. Ice Sculpture Garden/Smuggler's Pier, `drawLocked` The Sacred Jewel/Prayer)
- **Voraussetzungen / Aufbau:** Sitz 0: die Kreatur ohne Beschwörungsschlaf, passende Kostenkarten (Hand/Ablagen), `ps.handLocked = true` bzw. `ps.drawLocked = true`; Main Phase 1.
- **Schritte:** Kreatur über `t.activateCreature` aktivieren, Kosten bezahlen.
- **Erwartet** (Lesart „ein Effekt, der so nicht feuern kann, ist nicht aktivierbar", Ruling Tuscan Artist 16.8. in `_draw-block-shared.js`; Triceras kommentiert `handLocked` im Gate als „locked hand can't draw — wasteful"; Prayer fragt `!ps.drawLocked && !ps.handLocked`): unter der Sperre ist die Aktivierung nicht möglich, es entstehen keine Kosten.
- **Beobachtet:** Triceras, Pteranos und Raptoren prüfen nur `handLocked`, nicht `drawLocked`: unter `drawLocked` wirft Triceras eine Karte ab (Pteranos 1–2, Raptoren verbraucht den Zug), gezogen wird nichts. Guardian Beast Tu prüft keine von beiden: 3 Karten werden gelöscht, nichts gezogen. Techno Harpyformer wirft unter `handLocked` und `drawLocked` die Inventing-Ability ab, ohne zu ziehen.
- **Repro:** `docs/niche-tests/repro/A07-guardianbeasts/21-zieh-kreaturen-zieh-sperre.js` (✗ = Beobachtung tritt auf)
- **Warum unsicher:** A06-Bericht (Pawn Sacrifice) und `_loader.js` ≈ Z. 410 halten fest, dass Karten, die „nur ziehen", nicht automatisch gesperrt werden – „eine Verhaltensänderung, die Al entscheiden sollte"; die Triceras-Gruppe ist aber innerhalb sich uneinheitlich (Triceras sperrt bei `handLocked`, Tu und Techno nicht).
- **Frage an Al:** „Soll eine Karte, deren Wirkung nur aus Kosten und Ziehen besteht (Triceras, Pteranos, Raptoren, Tu, Techno), bei gesetzter Zieh-Sperre (`drawLocked`/`handLocked`) nicht aktivierbar sein – ja oder nein?"

### A07-22 · Classical Harpyformer prüft die Gold-Sperre (Tuscan Aristocrat) nicht – Wealth abgeworfen, kein Gold, Once-per-turn verbraucht · Stufe B
- **Karten:** Classical Harpyformer (`classical-harpyformer.js`); Gegenprobe Country Harpyformer (`country-harpyformer.js`, `goldGainWouldBeBlocked`)
- **Voraussetzungen / Aufbau:** Sitz 0: Harpyformer ohne Beschwörungsschlaf, „Wealth" (bzw. „Adventurousness") auf der Hand, 50 Gold; Sitz 1: Tuscan Aristocrat; Main Phase 1.
- **Schritte:** Harpyformer aktivieren, die Ability als Kosten abwerfen.
- **Erwartet** (Classical: „discard a Wealth Ability from your hand to gain 5 Gold"; Aristocrat: „your opponent cannot gain any Gold outside their Resource Phase"; Ruling `_gold-block-shared.js` (Al 17.8.): „eine Karte, deren einziger Nutzen ein Gold-Gewinn ist, wird gesperrt statt wirkungslos zu feuern … verbraucht dann auch sein Once-per-turn NICHT"): Classical ist gesperrt wie Country.
- **Beobachtet:** Country ist gesperrt ✓. Classical lässt sich aktivieren, Wealth landet in der Ablage, Gold bleibt 50, Once-per-turn gestempelt.
- **Repro:** `docs/niche-tests/repro/A07-guardianbeasts/22-classical-harpyformer-goldsperre.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `classical-harpyformer.js canActivateCreatureEffect` fragt nur „Wealth auf der Hand", nicht `goldGainWouldBeBlocked(engine, pi)` (Country tut es in der ersten Zeile).

### A07-23 · Such-Kreaturen (Shu, Shanty, Ska) zahlen ihre Kosten unter Such-/Hand-Sperre und bekommen nichts · Stufe B
- **Karten:** Guardian Beast Shu (`guardian-beast-shu.js`), Shanty Harpyformer (`shanty-harpyformer.js`), Ska Harpyformer (`ska-harpyformer.js`); Auslöser: Cats of the Pharaoh (`ps.searchLocked`), Ice Sculpture Garden/Smuggler's Pier u. Ä. (`ps.handLocked`)
- **Voraussetzungen / Aufbau:** Sitz 0: die Kreatur ohne Beschwörungsschlaf; Shu: 4 Füller in der Ablage, Kopie der Brettkreatur im Deck; Shanty: Navigation + Fireball auf der Hand, Fireball im Deck; Ska: Performance auf der Hand, Fighting im Deck; Sperre gesetzt; Main Phase 1.
- **Schritte:** Kreatur aktivieren, Kosten bezahlen (Kontrolle ohne Sperre: jeweils Wirkung wie erwartet).
- **Erwartet** (Shu: „… and add them to your hand"; Shanty: „… search your deck for a copy …, and add it to your hand"; Ska: „attach an Ability from your deck"; Cats: „you cannot search or add cards to your hand"; Vergleich A09-05 (Cecilia, „genau die im Skript beschriebene Falle") und die Ruling-Reihe „ein Effekt, der so nicht feuern kann, ist nicht aktivierbar" aus `_draw-block-shared.js`/`_gold-block-shared.js`): unter der Sperre nicht aktivierbar bzw. Abbruch vor der Zahlung.
- **Beobachtet:** Shu löscht 4 Karten, nichts kommt auf die Hand; Shanty wirft Navigation ab, die Suche scheitert still; Ska wirft Performance ab, es wird nichts angelegt. In allen Fällen Once-per-turn gestempelt.
- **Repro:** `docs/niche-tests/repro/A07-guardianbeasts/23-suchkosten-unter-such-sperre.js` (✗ = Fehler tritt auf; Kontrolle ohne Sperre ✓)
- **Restunsicherheit:** Ska „attach … from your deck" ist kein Hinzufügen zur Hand im Wortsinn (das Skript führt es aber über `actionAddCardFromDeckToHand` + `attachAbilityFromHand`), daher für Ska unsicherer; für Shu/Shanty („add … to your hand") klar. Nebenfall (C, im Repro): Shanty ist mit **nur** der Navigation auf der Hand aktivierbar, obwohl nach dem Abwurf keine Karte mehr zum „reveal 1 card" bleibt – die Navigation ist dann verloren (`shanty_no_hand`). Frage an Al: „Soll Shanty nur aktivierbar sein, wenn außer der Navigation noch eine Handkarte da ist – ja oder nein?"

### A07-24 · Smug Mastermind Antonia: gegnerische Surprises werden mit einer ID angeboten, die der Client nicht anklicken kann · Stufe B
- **Karten:** Smug Mastermind Antonia (`smug-mastermind-antonia.js`, lokale `collectNonHeroBoardTargets`, Zweig `inst.zone === 'surprise'`); gleiches Muster (nicht geprüft) in `coolness-overcharge.js:192`, `tengu-windstorm.js:163`, `wall-breaker-general-ralzish.js:126`, `_sparkfly-shared.js:268`
- **Voraussetzungen / Aufbau:** Sitz 0: Antonia mit angelegter Cool Rescuer Monia (echter Weg: aktivieren), eigene Zweitkreatur, Handkarten; Sitz 1: eine verdeckte Surprise (Booby Trap); Antonia-Auslöser durch 50 Kreaturenschaden auf die eigene Kreatur.
- **Schritte:** Antonias Zielwahl mitschneiden (`t.targetFn`), die Surprise wählen.
- **Erwartet** (Antonia: „choose any card on the board that is not a Hero"; Client-Vertrag `app-board.jsx:49785/49817`: eine Surprise-Zone ist nur unter `surprise-<Seite>-<Held>` anklickbar; `_targeting-shared.js:132-141` (v706): „Die alte `equip-…-surprise`-ID war für den Client unsichtbar" – dort mit ID `surprise-<owner>-<heroIdx>`/Typ `surprise` behoben): Surprise-Ziel mit der Client-ID.
- **Beobachtet:** Antonia bietet `equip-1-0-surprise` mit Typ `equip` (ohne `slotIdx`) an. Die Engine nimmt die Wahl entgegen (Surprise landet in der Ablage ✓), aber im echten Client passt weder die Surprise-Zone (`surprise-1-0`) noch eine Support-Zelle (`type 'equip'` + `slotIdx`) – die Surprise ist für Antonia faktisch nie wählbar. Headless ist die Wahl nur per ID möglich.
- **Repro:** `docs/niche-tests/repro/A07-guardianbeasts/24-antonia-surprise-ziel-id.js` (✗ = Fehler tritt auf; belegt die ID-Abweichung, nicht den Klick selbst)
- **Vermutete Ursache:** lokale Kopie der Zielsammlung mit der alten ID statt `require('./_targeting-shared')`; Antonias Area-Zweig ist schon auf `areaTargetId` umgestellt, der Surprise-Zweig nicht.
- **Restunsicherheit (daher B):** Der Klickpfad wurde nur statisch gegen den Client-Code geprüft (kein Browser).

### A07-25 · Smugbeth: der Träger leiht gegnerische Ability-Effekte weiter, wenn Smugbeth von der Clown-Aura / `magic_silenced` stillgelegt ist · Stufe B
- **Karten:** Smugbeth, the Rebel of no Rules (`smugbeth-the-rebel-of-no-rules.js` `grantsActiveAbilityBorrowToHost`), Engine `_heroHasSmugbethBoost` (`_engine.js` ~42964); Stilllegung durch The Creepy Clown of Heaven (Querschnitt)
- **Voraussetzungen / Aufbau:** Sitz 0: Smugbeth mit angelegter Lizbeth (echter Weg), Sitz 1: Held 0 mit Wealth-Ability, dazu Clown (Aura) bzw. `counters.magic_silenced`; Zug von Sitz 0.
- **Schritte:** `engine._getAbilityBorrowerForOppSlot(0, 1, 0, 0)` (der Prüfweg von `doActivateFreeAbility`) in sechs Zuständen.
- **Erwartet** (Smugbeth: „While this Creature has Lizbeth attached … you may use the active effects of your opponent's Heroes' Abilities"; Konvention aus B-01…B-03: eine stillgelegte Kreatur verliert ihre Dauereffekte, `isCreatureEffectSuppressed`): keine Leihe, solange Smugbeth stillgelegt ist.
- **Beobachtet:** negiert/gefroren/betäubt ⇒ keine Leihe ✓ (die Engine prüft `negated/nulled/frozen/stunned` einzeln); Clown-Aura und `magic_silenced` ⇒ Leihe bleibt möglich, obwohl `isCreatureEffectSuppressed` true meldet.
- **Repro:** `docs/niche-tests/repro/A07-guardianbeasts/25-smugbeth-leiht-trotz-stilllegung.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_heroHasSmugbethBoost` fragt vier Zähler einzeln ab statt `isCreatureEffectSuppressed(inst)` (das auch abgeleitete Aura-Negation und `magic_silenced` kennt).
- **Restunsicherheit (daher B):** Nischenfall (Clown/`magic_silenced`); gleiche Klasse wie B-03, deshalb hier mit eigener Ursache statt als weiterer Fall dort.

### A07-26 · Wolflesia: die Zusatz-Zauberaktion bleibt verfügbar, wenn die Kreatur negiert/gefroren/betäubt/aura-negiert ist · Stufe B
- **Karten:** Wolflesia, the Canine Flower (`wolflesia-the-canine-flower.js` `setupWolflesiaSpellAction`); Engine `findAdditionalActionForCard`/`getAdditionalActions` (`_engine.js` ~39831/39880)
- **Voraussetzungen / Aufbau:** Sitz 0: Wolflesia mit angelegter Rafflesia (echter Weg), 3× Brilliant Idea (Support Magic Lv 1, keine Inherent-Action) auf der Hand; Wolflesia dann negiert / gefroren / betäubt / Clown-Aura auf Sitz 1; Action Phase.
- **Schritte:** 1. Brilliant Idea über den Helden spielen (verbraucht die Hauptaktion). 2. Zweite Brilliant Idea mit `viaCreatureInstId` (Wolflesia) spielen. Kontrollen: ohne Wolflesia ⇒ abgelehnt; mit arbeitender Wolflesia ⇒ erlaubt.
- **Erwartet** (Wolflesia: „… this effect: You may once per turn use a level 3 or lower Decay or Support Spell with this Creature as an additional Action"; Konvention B-01…B-03: stillgelegte Kreatur verliert ihre Effekte): mit stillgelegter Wolflesia gibt es keinen zweiten Zauber.
- **Beobachtet:** In allen vier Zuständen (`isCreatureEffectSuppressed === true`) wird der zweite Zauber als Zusatzaktion gespielt. Wolflesia legt den Grant (`counters.aaGrants`) per `onAttachHero`/`onTurnStart` ab; der Grant hat kein `expiresAtTurnEnd` und bleibt stehen, und die Engine liest die Grants aller Instanzen des Spielers, ohne die Stilllegung des Anbieters zu prüfen (nur die Hook-Wege der Karte sind stumm).
- **Repro:** `docs/niche-tests/repro/A07-guardianbeasts/26-wolflesia-zusatzaktion-trotz-stilllegung.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_engine.js getAdditionalActions`/`findAdditionalActionForCard` (und der Verbrauchsweg ~39877-39906) fragen `_zusatzAnbieterVon` (Kontrolle), aber nicht `isCreatureEffectSuppressed(inst)`. Gilt vermutlich für jeden Kreaturen-Anbieter mit persistentem Grant (Lunatic Hawk, Psychic Scout, Slippery Polar, Reiza … – nicht gemessen).
- **Restunsicherheit (daher B):** gleiche Klasse wie B-01…B-03 (Entscheidung steht aus); Wolflesia ist hier das gemessene Beispiel.

### A07-27 · Vullary: der Einsatz-Effekt der beschworenen Kreatur feuert, bevor die Negation greift · Stufe B
- **Karten:** Unsettling Opportunist Vullary (`unsettling-opportunist-vullary.js` ~140-165); Beispiel Ballad Harpyformer (Einsatz-Suche); Vorbilder: The Master's Key (`negateEffects: true`), Necromancy
- **Voraussetzungen / Aufbau:** Sitz 0: Vullary mit angelegter Cute Princess Mary (echter Weg), Ballad Harpyformer auf der Hand, „Support Magic" im Deck; Main Phase 1.
- **Schritte:** 1. Vullary Modus B: Ballad wählen. 2. Prompts/Hand/Deck prüfen.
- **Erwartet** (Vullary: „… summon a level 3 or lower Creature … but **negate its effects** until the beginning of your next turn"; gleiche Klasse wie A01-pollution-22 (Soul Shard Ka) und die Vorbilder Necromancy/The Master's Key, bei denen die Negation vor dem Einsatz-Effekt steht): Ballad kommt negiert aufs Brett, ihr Einsatz-Effekt („search your deck for a Support Magic Ability") bleibt aus.
- **Beobachtet:** Ballad liegt danach negiert (✓), aber das Such-Fenster („Search your deck for a "Support Magic" Ability …?") wurde angeboten und „Support Magic" liegt auf der Hand. Vullary ruft `actionPlaceCreature` ohne `negateEffects` und negiert erst danach (`applyCreatureStatus … 'negated'`); der Kommentar im Skript verweist selbst auf `negateEffects: true`.
- **Repro:** `docs/niche-tests/repro/A07-guardianbeasts/27-vullary-einsatzeffekt-vor-negation.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `unsettling-opportunist-vullary.js` übergibt `negateEffects: true` nicht an `actionPlaceCreature` (Master's Key tut es: `the-master-s-key.js:154`); `negated_placement` wird nachträglich von Hand gesetzt.
- **Restunsicherheit (daher B):** wie bei A01-pollution-22 – die Autoren könnten „negate its effects" bewusst nur auf laufende/aktive Effekte beziehen.

