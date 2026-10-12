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

