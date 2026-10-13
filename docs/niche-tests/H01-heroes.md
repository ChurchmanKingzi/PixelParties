# H01-heroes – Nischenfall-Bericht
Stand/Autor: Agent H01-heroes, 12.–13.10.2026 (Vorgänger bis -07, Fortsetzung ab -08). Karten: 37 in der Liste · 37 gezielt getestet (L2; Bartas und Chuck Crazy nur L1) · 20 mit Befund (24 Befunde: 6 A, 13 B, 5 C).

## Zusammenfassung

24 Befunde in 37 Heldenkarten (6 × A, 13 × B, 5 × C; jeder mit ausgeführtem Repro unter `docs/niche-tests/repro/H01-heroes/`, alle ✗ beim aktuellen Stand).

| Stufe | Befunde |
|---|---|
| **A** | -02 / -14 (Shapeshifter behält Zustände der Gestalten: Broghan, Beato, Karian, Taio, Nao, Alice), -12 (Shapeshifter unter fremder Kontrolle: Gestalt fällt nie ab), -13 (Throne Robber unter fremder Kontrolle: Abstieg bleibt aus), -17 (Brackle: Opfer als eigenes Ziel wählbar → Karte doppelt in der Ablage), -23 (Chaos-Diamond: 22 Attachment-/Area-Spells liegen nach dem Wirken doppelt vor) |
| **B** | -01 Archibald im Gegnerzug, -03 Blackstache, -04 Boris, -15 Alice Transfer Student und -16 Devlin (Spalte statt Kontrolleur), -05 Alice Puppeteer (selbst gestohlene Kreatur), -08 / -24 Monia (Schildmarke bleibt stehen; nur Schaden, keine Status-/Kontrolleffekte), -09 Baaliel und -21 Beato (Stufenumgehung/Gratisbeschwörung bei Negation), -10 Damus (Armageddon-Immunität bei Negation), -11 Alex (Deck-Suche trotz Such-/Handsperre), -20 Inya (negiert → Buddy) |
| **C** | -06 Alice Puppeteer vs. Anti Magic, -07 Shapeshifter→Chaos-Diamond (Potion-Zieh-Sperre bleibt), -18 Elana/Champion unter Zieh-/Handsperre, -19 Dajan (Gratiskauf bleibt nach Ausfall), -22 Shapeshifter/Robber vs. Such-Sperre |

Die fünf wichtigsten Befunde:
1. **-23** Chaos-Diamond: Attachment-/Area-Spells (22 von 213 Normal/Attachment-Spells, darunter Curse, Siege, Prayer, Royal Treasury) bleiben nach dem Wirken zusätzlich in der Ablage – Kartenduplikat (`_engine.js` ~21925, Zweig `_aufsBrett` + `fromZone: 'deck'`).
2. **-17** Brackle: das zu opfernde Wesen steht in der Schadenswahl als Ziel; gewählt wird die Karte doppelt abgelegt.
3. **-12 / -13** Shapeshifter und Throne Robber unter fremder Kontrolle (Paraseed/Charme): die geliehene Gestalt bzw. der Aufstieg endet nie, der angelegte Held bleibt für immer im Support.
4. **-02 / -14** Shapeshifter-Rückverwandlung räumt `onGameStart`-Reste fremder Helden nicht ab (nur Pseudonia, Sol Rym tun es): Broghans Frostimmunität, Karians 10 Status-Immunitäten, Taio +20 ATK, Nao-Überheilung, Beatos Stufenumgehung bleiben für immer.
5. **-09 / -10 / -21 / -20** Engine-gelesene Heldenverträge ignorieren Negation: Baaliel (Gratis-Beschwörung unbegrenzt oft pro Zug), Beato (Stufen-/Schulumgehung), Damus (Armageddon-Immunität), Inya (Buddy-Beschwörung).

Querschnittsklassen aus der Messung: (a) *Spalte statt Kontrolleur* bei übernommenen Helden (-03, -04, -15, -16; Gegenseite, gemessen korrekt: Don Quisto, Carris, Codumbus, Damus, Bubbles, Chuck Storyteller, Andras und Champion/Broghan/Enigma/Elana/Brackle/Arthor I; Chuck Crazy nur gelesen – das Skript nutzt `heroesControlledBy`); (b) *Engine-gelesener Heldenvertrag ohne Statusprüfung* (-09, -10, -21 sowie -19); (c) *Deck-/Ablage-Zugriff ohne `_isSearchBlocked`* (-11, -22).
Gesamteindruck: die Aktivierungs-Heldeneffekte (Alice P, Broghan, Brackle, Champion, Elana, Enigma, Arthor I) verhalten sich bei Frost/Betäubung/Negation, Erst-Runden-Immunität, HOPT, Abbruch und Übernahme sauber – ihre Befunde sind andere (-05/-06 Zählregel/Anti Magic, -17 Opfer als Ziel, -18 Zieh-/Handsperre). Die meisten Befunde liegen bei Passiv-/Vertragshelden (Engine-gelesene Verträge ohne Statusprüfung) und beim Zusammenspiel Shapeshifter/Throne Robber × fremde Skripte bzw. fremde Kontrolle.

Bewusst NICHT getestet: Alex unter fremder Kontrolle (Harness reicht `charmedOwner` für Abilities nicht durch), Aufstiegsweg Diamond Keeper → Bulwark (`_diamondSelfLoss`), Arthor-Aufstiegsbereitschaft über die Ausrüstungskette, echte Beato-Ascension über 5 Schulen, Barker im echten Spielstart (Harness startet in Zug 5; geprüft über Zugwechsel), Chaos-Diamond als übernommener/Nicht-Starthelden, 3-/4-Spieler-Kontrollfälle, die Nutzer derselben Verträge in anderen Gruppen (Cute Princess Mary, Gobbo, Luna, Sorin, Tsu-Ki, Maho, Idej ×4, Kent, Logan) – für -09/-21 nur als Prüfauftrag genannt –, Monia gegen Bounce/Zerstören/Kontrolle (Kidnapping ließ sich nicht aufbauen), Diamond Keepers Zählung bei doppeltem Batch-Eintrag derselben Kreatur (kein echter Auslöser gefunden), Chuck Crazys Schild gegen Carris/Inya-Mitspieler (Skript zählt nur „volle Schutzmarken“ als immun – laut Kopfkommentar bewusst konservativ). Nicht gemeldet, weil durch Skript-Kopfkommentare als Entscheidung dokumentiert: Enigma „zwei Picks“, Inyas/Karians/Broghans Statusimmunität bei Negation (bewusstes `bypassStatusFilter`/Statusmarke), Champion „draw that many“ bei kleiner Gegnerhand, Boris-Auto-Verzicht bei unbezahlbaren Kosten.

## Befunde

### H01-heroes-01 · Archibald löst auch im Zug des GEGNERS aus · Stufe B
- **Karten:** Archibald, the Archmage (`cards/effects/archibald-the-archmage.js`)
- **Voraussetzungen / Aufbau:** Sitz 0: Archibald (Held 0) mit Wisdom 2, drei „ZZ Filler“ (Normal Spell, Lv 0) auf der Hand. Sitz 1 hat die Standard-Helden und ist am Zug (`gs.activePlayer = 1`, Aktionsphase).
- **Schritte:** 1. `engine.actionPromptForceDiscard(0, 1, …)` (Zwangsabwurf einer Handkarte von Sitz 0, so wie ihn gegnerische Karten auslösen). 2. Prompts und Log prüfen. Gegenprobe: dasselbe im eigenen Zug.
- **Erwartet** (Kartentext: „Once per turn, **during your turn**, when you discard a Normal Spell from your hand, you may immediately use that Spell as an additional Action …“): im Zug des Gegners löst Archibald nicht aus.
- **Beobachtet:** Im Gegnerzug fragt Archibald genauso „… was just discarded — cast it as an additional Action with Archibald?“ und wirkt den Zauber (Log `archibald_cast`). Im eigenen Zug identisch (korrekt).
- **Repro:** `docs/niche-tests/repro/H01-heroes/01-archibald-gegnerzug.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `archibald-the-archmage.js` Kopfkommentar „Triggers on ANY discard, including during the opponent's turn“ – `hooks.onDiscard` / `resolveTrigger` prüfen nirgends `gs.activePlayer === ctx.cardOwner`. Der Kommentar ist kein „Als Ruling“, sondern liest den Satzteil „during your turn“ offenbar nicht mit; deshalb B statt A (Restunsicherheit: bewusste Entscheidung nicht auszuschließen).

### H01-heroes-02 · „???, the Shapeshifter“ behält Zustände des kopierten Helden dauerhaft (Broghan: nicht einfrierbar, Beato Witch: Lv-1-Zauber ohne Schule) · Stufe A
- **Karten:** ???, the Shapeshifter (`the-shapeshifter.js`); verursachend: Broghan, the Frozen Guardian of the North (`broghan-…js`), Beato, the Butterfly Witch (`beato-the-butterfly-witch.js`)
- **Voraussetzungen / Aufbau:** Sitz 0: Shapeshifter auf Held 0 (Standard-Gegner), der Zielheld liegt in der Hand; die Gestalt wird über den echten Heldeneffekt (`doActivateHeroEffect`, Galerie) gewählt. Dann `t.endTurn()` zweimal (eigenes Zugende, Gegnerzugende → Gestalt fällt ab).
- **Schritte:** 1. Shapeshifter → Broghan. 2. Zugende, Gegnerzugende. 3. Auf den (wieder so heißenden) Shapeshifter `addHeroStatus('frozen')`. Zweiter Lauf: Shapeshifter → Beato Witch, zurück, dann `Burning Finger` (Destruction Magic Lv 1) ohne Destruction Magic spielen.
- **Erwartet** (Kartentext Shapeshifter: „This Hero gains the effects and name of the Hero equipped … At the end of your opponent's turn, send all Heroes equipped this way to the discard pile.“; Skript-Ruling ② „nach dem Abfallen gilt wieder nur der eigene Effekt“): nach dem Abfallen ist der Shapeshifter wieder einfrierbar und kann ohne Schule keinen Lv-1-Zauber wirken – wie ein nie verwandelter Shapeshifter (Kontrolle im Repro grün).
- **Beobachtet:** `hero.statuses.freeze_immune` (Broghan) bleibt für immer – der Shapeshifter lässt sich nicht mehr einfrieren. `hero.bypassLevelReq` + `ascensionOrbs` (Beato Witch) bleiben – der zurückverwandelte Shapeshifter spielt `Burning Finger` ohne jede Destruction Magic (Zug wird akzeptiert, Karte wirkt).
- **Repro:** `docs/niche-tests/repro/H01-heroes/02-shapeshifter-behaelt-geliehene-zustaende.js`
- **Vermutete Ursache:** `initGainedHeroEffect` führt beim Verwandeln die Anfangsroutine (`onGameStart`) des fremden Skripts aus. Diese schreibt Marken ans Heldenobjekt (Broghan `applyFreezeImmunity`, Beato `hook onGameStart` → `bypassLevelReq`, `initOrbs`). Beim Abfallen ruft die Engine `loseHeroEffect` → `onIdentityLost` – das haben Broghan und beide Beato-Skripte nicht (nur Pseudonia und Sol Rym). Vertrag: CARD_API.md „KOPIERTE UND GEERBTE HELDENEFFEKTE“. Gleiche Lücke ist überall zu erwarten, wo ein Heldenskript in `onGameStart` Marken ans Heldenobjekt schreibt (siehe weitere Prüfung bei den Abdeckungs-Zeilen).

### H01-heroes-03 · Blackstache: Schutz gilt auch gefroren/betäubt/negiert und bleibt bei Übernahme beim alten Besitzer · Stufe B
- **Karten:** Blackstache, Scourge of the Pixel Seas (`blackstache-scourge-of-the-pixel-seas.js`, Engine `_blackstacheBlocksTurnEnd`)
- **Voraussetzungen / Aufbau:** Sitz 1 mit Blackstache auf Held 0 (sonst Standard). (a) Status per `t.heroStatus(1,0,'negated'|'frozen'|'stunned')`. (b) `engine.actionTakeHeroPermanently(0, 1, 0)` (Paraseed-Weg): Blackstache steht weiter in Spalte 1, Kontrolleur ist Sitz 0.
- **Schritte:** `engine._blackstacheBlocksTurnEnd(pi, {name:'Flashbang', owner:…})` bzw. mit Quelle Terror – das ist die einzige Stelle, an der Flashbang, Cooldin & Co. und Terror ihr Zugende-Verbot abfragen.
- **Erwartet** (Kartentext „You are unaffected by the effect of Terror and your opponent cannot end your turn with card effects."; Heldeneffekte sind bei Frozen/Stunned/Negated still – `engine._isHeroEffectSilenced`, Chucks Probe in `_engine.js` ~4990 prüft das; CARD_API.md „Übernommene Helden gelten als Helden des Kontrolleurs": „you/your = Kontrolleur … das gilt für seine Effekte"): (a) gefrorener/betäubter/negierter Blackstache schützt nicht; (b) der Kontrolleur (Sitz 0) ist geschützt, der alte Besitzer (Sitz 1) nicht mehr.
- **Beobachtet:** (a) Schutz bleibt in allen drei Zuständen. (b) Schutz hängt an Sitz 1 (Spalte), der Kontrolleur Sitz 0 ist ungeschützt.
- **Repro:** `docs/niche-tests/repro/H01-heroes/03-blackstache-status-und-kontrolle.js`
- **Vermutete Ursache:** `_engine.js:~28773` `_blackstacheBlocksTurnEnd` und `_turnEndImmuneCardOnSide` iterieren `gs.players[targetPi].heroes` (Spalte) und prüfen nur `hp > 0` – weder `heroesControlledBy` noch `_isHeroEffectSilenced`.

### H01-heroes-04 · Boris: Sperre/Abwurf-Verzicht hängen an der Spalte, nicht am Kontrolleur · Stufe B
- **Karten:** Boris, the Guardian of Blackport (`boris-the-guardian-of-blackport.js`)
- **Voraussetzungen / Aufbau:** Sitz 0: Boris auf Held 0; `actionTakeHeroPermanently(1, 0, 0)` (Sitz 1 kontrolliert ihn jetzt). Auf beiden Händen „Charme“ (trägt `stealsOpponentCards`).
- **Schritte:** `engine.isBorisBlocked('Charme', pi)` vor und nach der Übernahme; `borisScript.waivesDiscardCosts(engine, pi)`.
- **Erwartet** (Kartentext „Your opponent cannot add any cards originally owned by you to their hand … You may once per turn ignore any effect that would force you to discard …"; Regel „Übernommene Helden gelten als Helden des Kontrolleurs"): nach der Übernahme ist Charme für Sitz 0 gesperrt (der Kontrolleur Sitz 1 ist „du“), für Sitz 1 frei; der Abwurf-Verzicht gehört Sitz 1.
- **Beobachtet:** genau umgekehrt – Charme bleibt für Sitz 1 gesperrt, Sitz 0 frei; `waivesDiscardCosts` gilt für Sitz 0.
- **Repro:** `docs/niche-tests/repro/H01-heroes/04-boris-kontrolle.js`
- **Vermutete Ursache:** `boris-the-guardian-of-blackport.js` `borisActive` / `borisHeroIdx` suchen `gs.players[pi].heroes` (Spalte); Aufrufer in `_engine.js` (`borisBlockIdx` ~30641, `borisHidesOpponentSide` ~30674, `offerDiscardSkip`) vertrauen darauf. Boris' Status-Prüfung (frozen/stunned/webbed/negated) ist dagegen vorhanden.

### H01-heroes-05 · Alice, the Puppeteer Girl zählt eine selbst gestohlene Kreatur nicht mit · Stufe B
- **Karten:** Alice, the Puppeteer Girl (`alice-the-puppeteer-girl.js`)
- **Voraussetzungen / Aufbau:** Sitz 0: Alice (Held 0), eine alte eigene Kreatur (`turnPlayed = 1`). Sitz 1: eine alte Kreatur, die Sitz 0 per `actionStealCreature` zeitweise übernommen hat (Deepsea Succubus / Cute Conversion-Weg).
- **Schritte:** Heldeneffekt über `doActivateHeroEffect`, Ziel Held 0 von Sitz 1.
- **Erwartet** (Kartentext „… times the number of Creatures **you control** that were not summoned this turn"): 2 Kreaturen → 100 Schaden.
- **Beobachtet:** 50 Schaden – die gestohlene Kreatur (Kontrolle bei Sitz 0, nicht frisch) wird nicht gezählt.
- **Repro:** `docs/niche-tests/repro/H01-heroes/05-alice-puppeteer-gestohlene-kreatur.js`
- **Vermutete Ursache:** `alice-the-puppeteer-girl.js:29` `_qualifies`: `if (inst.stolenBy != null) return false;`. Die Zeile davor (`controller !== pi`) schließt schon Kreaturen aus, die DEM SPIELER gestohlen wurden; `stolenBy` trifft zusätzlich die vom Spieler selbst gestohlenen (permanente Übernahmen setzen `stolenBy` nicht – dort zählt die Kreatur). Der Kommentar nennt als Absicht nur die gestohlenen EIGENEN Kreaturen.

### H01-heroes-06 · Alice, the Puppeteer Girl: „treated as … a Destruction Magic Spell“ – Anti Magic greift nicht · Stufe C
- **Karten:** Alice, the Puppeteer Girl
- **Voraussetzungen / Aufbau:** Wie -05 (eine alte eigene Kreatur); Ziel-Held mit `magic_immune`-Buff Stufe 1 (so legt Anti Magic ihn an).
- **Schritte:** Heldeneffekt aktivieren, Ziel dieser Held.
- **Erwartet** (Kartentext „This is treated as this Hero hitting the target with a Destruction Magic Spell"; Anti Magic: „immune to all other Spells up to level 1/2/3"): unklar – Spell der Stufe 0 (so bildet das Skript sie für `afterSpellResolved` nach) wäre geblockt.
- **Beobachtet:** 50 Schaden kommen an. Alice gilt für `afterSpellResolved` (Bartas, Beato, Reiza …) als Spell, aber nicht für `_isHeroSpellProtected` (verlangt, dass die Quelle eine Spell-KARTE ist).
- **Repro:** `docs/niche-tests/repro/H01-heroes/06-alice-puppeteer-anti-magic.js` (✗ = Anti Magic blockt nicht)
- **Vermutete Ursache:** `alice-the-puppeteer-girl.js` ruft `ctx.dealDamage(hero, damage, 'destruction_spell')` mit Heldenquelle; die Spell-Immunität liest `cardType === 'Spell'` der Quellkarte (`_engine.js:7197`). Der Anti-Magic-Enchantment-Schild (Typ `destruction_spell`) greift dagegen, siehe `_engine.js:8179`.
- **Frage an Al:** Soll Alice' Effekt von Anti Magic (Spell-Immunität nach Stufe) geblockt werden – ja (Stufe 0 des Pseudo-Spells) oder nein (nur Destruction-Synergien wie Bartas/Beato)?

### H01-heroes-07 · Shapeshifter als Chaos-Diamond: Potion-Zieh-Sperre bleibt dauerhaft · Stufe C
- **Karten:** ???, the Shapeshifter; Chaos-Diamond, the Cracked Keeper (`_potion-deck-hero-shared.js`)
- **Voraussetzungen / Aufbau:** Sitz 0: Shapeshifter (Held 0), Potion Deck mit 3 Healing Potion, Chaos-Diamond in der Hand. Gestalt über den echten Heldeneffekt, dann zwei `endTurn()`.
- **Erwartet** (Chaos-Diamond: „If this is one of your starting Heroes, you can never draw cards from your Potion Deck." / Shapeshifter: Gestalt fällt am Ende des Gegnerzugs ab): unklar – „never“ spricht für Dauer, aber „this“ ist nach dem Abfallen wieder der Shapeshifter.
- **Beobachtet:** `initGainedHeroEffect` führt Chaos-Diamonds `onGameStart` aus: `ps.potionDrawBanned = true` und `hero._startingHeroOf` bleiben für immer; `actionDrawFromPotionDeck` liefert nichts mehr. Derselbe Mechanismus wie -02, hier mit Spielerzustand statt Heldenzustand.
- **Repro:** `docs/niche-tests/repro/H01-heroes/07-shapeshifter-chaos-diamond-potionsperre.js`
- **Frage an Al:** Soll die Potion-Zieh-Sperre nach dem Abfallen der Chaos-Diamond-Gestalt bestehen bleiben – ja oder nein?

### H01-heroes-08 · Cool Rescuer Monia: Schildmarke `gs._moniaShieldActive` bleibt nach dem Effekt stehen und blockt später jeden negativen Status auf Kreaturen · Stufe B
- **Karten:** Cool Rescuer Monia (`cool-rescuer-monia.js`)
- **Voraussetzungen / Aufbau:** Sitz 0: Monia (Held 0, `onGameStart` gefeuert), zwei alte Kreaturen (`turnPlayed = 1`) auf Held 1/2. Sitz 1 am Zug. Monia-Wahl („Cool Rescue") per Skript bestätigt, eine Handkarte wird abgeworfen.
- **Schritte:** 1. Sitz 1 verursacht 60 Kreaturen-Schaden auf Kreatur a (Monia negiert: bleibt 200 HP). 2. Danach, im selben Zug, ein unabhängiger Effekt: `applyCreatureStatus(b, 'poisoned')`. 3. Zweiter Lauf: Monia stirbt direkt nach Schritt 1, drei `endTurn()`, dann Gift auf Kreatur b.
- **Erwartet** (Kartentext „Once per turn, when 1 or more Creatures either player controls would be affected by a card or effect, you may discard 1 card to negate **any effects that card or effect has** on all Creatures."): Die Negation gilt nur für DIESE eine Karte/diesen einen Effekt; ein späterer unabhängiger Effekt (Gift) wirkt normal. Marke weg, sobald der geschützte Effekt aufgelöst ist.
- **Beobachtet:** `gs._moniaShieldActive` bleibt auf `0` (Sitz) stehen. Gift auf Kreatur b wirkt nicht (`counters` bleibt `{}`); auch drei Zugwechsel später (Monia tot) wird weiterhin jeder negative Status auf Kreaturen dieses Besitzers verweigert, weil Monias eigenes `onTurnStart` (die einzige Räumung neben `afterSpellResolved`) nie mehr läuft.
- **Repro:** `docs/niche-tests/repro/H01-heroes/08-monia-schildmarke-bleibt.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `cool-rescuer-monia.js` (~Z. 160) setzt die Marke in `beforeCreatureDamageBatch`; geräumt wird nur in `afterSpellResolved` (feuert nur bei Spells/Attacks) bzw. im eigenen `onTurnStart`. Gelesen wird sie in `_engine.js` `canApplyCreatureStatus` / `canTargetForStatus` (~18573 / ~19431), die JEDEN negativen Status auf Kreaturen des Marken-Besitzers verweigern.

### H01-heroes-09 · Baaliel NEGIERT: Level-Bypass bleibt, Gratis-Beschwörung unbegrenzt oft pro Zug · Stufe B
- **Karten:** Baaliel, the Demon General (`baaliel-the-demon-general.js`; Engine-Verträge `canBypassLevelReqForCard`, `grantsInherentActionForCard`)
- **Voraussetzungen / Aufbau:** Sitz 0: Baaliel auf Held 0 (ohne Summoning Magic), drei „Horned Demon" (Summoning Magic Lv2) auf der Hand, Aktionsphase, `t.heroStatus(0, 0, 'negated')`.
- **Schritte:** drei Horned Demons nacheinander über den echten Spielweg (`doPlayCreature`), ohne die Aktionszähler zurückzusetzen. Kontrolle: gesunder Baaliel.
- **Erwartet** (Kartentext „This Hero can summon "Horned Demon" Creatures regardless of their level. **Once per turn**, summoning a "Horned Demon" with this Hero counts as an additional Action."; Konvention: negierte Helden verlieren ihre Effekte): negiert kann Baaliel ohne Schule keinen Horned Demon beschwören; in keinem Zustand mehr als eine Gratis-Beschwörung pro Zug (gesund: 1. gratis, 2. kostet die Aktion, 3. abgelehnt – ✓).
- **Beobachtet:** Negiert: alle drei Beschwörungen gelingen (`[true,true,true]`), es wird keine Aktion verbraucht. Der Level-Bypass bleibt aktiv, und weil der ruhende Hook `onAnyActionResolved` den Once-per-turn-Stempel `gs.hoptUsed['baaliel-free-summon:0']` nie setzt, bleibt `grantsInherentActionForCard` dauerhaft wahr: unbegrenzt viele Gratis-Beschwörungen. Frozen/Stunned sind dagegen korrekt gesperrt (`canHeroSummon`).
- **Repro:** `docs/niche-tests/repro/H01-heroes/09-baaliel-negiert-bypass-und-gratisbeschwoerung.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_engine.js` `cardHasInherentAction` (~43547) prüft nur `hero.hp <= 0`, `heroMeetsLevelReq` (~43819) ruft `canBypassLevelReqForCard` ohne Statusprüfung; Baaliels Skript-Kopf nimmt an, `canHeroSummon` verweigere negierten Helden jede Beschwörung – das gilt nur für Frozen/Stunned (ein negierter Held darf handeln). Dieselbe Klasse ist für die übrigen Nutzer dieser Verträge zu erwarten (`canBypassLevelReqForCard`: Cute Princess Mary, Gobbo, Luna, Sorin, Tsu-Ki; `grantsInherentActionForCard`: Maho) – nicht geprüft (andere Heldengruppen).

### H01-heroes-10 · Damus negiert/gefroren/betäubt: „unaffected by Armageddon" gilt weiter · Stufe B
- **Karten:** Damus, the Prophet of Apocalypse (`damus-the-prophet-of-apocalypse.js`; Engine-Vertrag `immuneToSourceNames` am Helden)
- **Voraussetzungen / Aufbau:** Sitz 0: Damus auf Held 0, ein „Ifrit" (80 HP) auf Held 1; Damus gesund bzw. `negated` / `frozen` / `stunned`. Sitz 1 als Quelle.
- **Schritte:** 1. 50 Kreaturenschaden von Sitz 1 auf den Ifrit (Kontrolle: Ifrit-Schutz). 2. `actionDealDamage({name:'Armageddon', owner:1}, Damus, 100, 'spell')`.
- **Erwartet** (Kartentext „While you control at least 1 «Ifrit» Creature, this Hero is unaffected by «Armageddon»."; Konvention: Heldenpassive ruhen bei Frozen/Stunned/Negated): stillgelegter Damus nimmt den Armageddon-Schaden (100). Gesund 0 ✓.
- **Beobachtet:** In allen drei Zuständen 0 Schaden (800 → 800), obwohl Damus' anderes Passiv (Ifrit „take no damage") korrekt ruht (Ifrit 80 → 30) und auch seine Level-Senkung für Armageddon auf der Hand `_isHeroEffectSilenced` prüft (Skript Z. ~100). Die Armageddon-Immunität ist die einzige Klausel ohne diese Abfrage.
- **Repro:** `docs/niche-tests/repro/H01-heroes/10-damus-armageddon-immunitaet-negiert.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `damus-the-prophet-of-apocalypse.js` `immuneToSourceCondition` (~Z. 113) zählt nur `ifritsOf(...)`; der Engine-Leser `_engine.js` ~8746 ruft allein diese Bedingung. Derselbe Vertrag bei Ifrit (`ifrit.js:45`) ist eine statische Karteneigenschaft, dort kein Befund. Auch der Zielwächter (Armageddon als Flächenzauber, der Damus gar nicht erst anvisiert) liest vermutlich dieselbe Bedingung – nicht gesondert geprüft.

### H01-heroes-11 · Alex: Deck-Suche ignoriert Such-Sperre und Handsperre · Stufe B
- **Karten:** Alex, Trainer of Heroes (`alex-trainer-of-heroes.js`)
- **Voraussetzungen / Aufbau:** Sitz 0: Alex (Held 0, Fähigkeiten geleert), Deck mit 6 Abilities (Fighting ×2, Wealth, Toughness, Leadership, Resistance) + 14 Dummys, „Luck" auf der Hand; `ps.searchLocked = true` bzw. `ps.handLocked = true`.
- **Schritte:** 1. `Luck` über `doPlayAbility` an Alex. 2. Galerie („Alex …") und Anhängewahl skripten.
- **Erwartet** (Kartentext „… You may **search your deck** for an Ability and attach it to one of your other Heroes"; CARD_API.md „Cats of the Pharaoh (v1068)": `searchLocked` sperrt „Deck-Suche und Adds", Riegel `engine._isSearchBlocked`; `handLocked` sperrt ebenfalls Suchen): unter beiden Sperren keine Suche – keine Galerie, Deck bleibt bei 20, nichts am anderen Helden. Kontrolle ohne Sperre ✓.
- **Beobachtet:** Die Galerie erscheint, `Fighting` wird aus dem Deck genommen (19) und an Held 1 angehängt – unter `searchLocked` und unter `handLocked`.
- **Repro:** `docs/niche-tests/repro/H01-heroes/11-alex-suche-trotz-suchsperre.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `alex-trainer-of-heroes.js` ~Z. 252 (Galerie-Aufbau), ~281 (Prüfung), ~346 (`ps.mainDeck`-Zugriff) arbeiten direkt am Deck; `engine._isSearchBlocked` (`_engine.js:10683`) oder ein Helfer wie `searchDeckForNamedCard` (läuft über den Riegel, `_engine.js:10790`) wird nie gefragt. Der Lader-Wächter `blockedBySearchLock` gilt nur für spielbare Karten, nicht für Heldeneffekte/Hooks.

### H01-heroes-12 · Shapeshifter unter fremder Kontrolle: Gestalt fällt nie ab, angelegter Held bleibt für immer im Support · Stufe A
- **Karten:** ???, the Shapeshifter (`the-shapeshifter.js`; Sweep `_expireBorrowedIdentities` in `_engine.js`)
- **Voraussetzungen / Aufbau:** Sitz 0: Shapeshifter auf Held 0 (sonst Standard). Sitz 1 hat „Archibald, the Archmage" auf der Hand, übernimmt den Shapeshifter (a) dauerhaft (`actionTakeHeroPermanently(1, 0, 0)`, Paraseed-Weg) bzw. (b) zeitweise (`actionStealHero`), aktiviert den Heldeneffekt (`doActivateHeroEffect`, `charmedOwner: 0`, Galerie → Archibald) und `endTurn()` ×4 (zwei volle Runden, darunter das Ende des Zuges von Sitz 0).
- **Erwartet** (Kartentext „… At the end of your opponent's turn, send all Heroes equipped this way to the discard pile."; Regel „Übernommene Helden gelten als Helden des Kontrolleurs": der Kontrolleur darf den Effekt nutzen): Der Held heißt am Ende des gegnerischen Zuges wieder „???, the Shapeshifter", der Support ist leer, Archibald liegt in der Ablage. Kontrolle (eigener Shapeshifter) ✓; auch „erst verwandeln, danach übernommen werden" läuft sauber zurück.
- **Beobachtet:** Nach der Übernahme-Aktivierung heißt der Held für den Rest des Spiels „Archibald, the Archmage", Archibald liegt weiter im Support (`counters._identityExpiresTurn` wird nie gestempelt), beide Ablagen sind leer. Es gibt keinen Engine-Fehler, der Zustand ist „sauber" für `audit()`.
- **Repro:** `docs/niche-tests/repro/H01-heroes/12-shapeshifter-uebernommen-gestalt-faellt-nie-ab.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `the-shapeshifter.js` ~Z. 423 `heldeninstanz(engine, hs, heroIdx)` (sucht `c.owner === hs`, `hs = ctx.cardHeroOwner ?? pi`): Eine Probe während `onHeroEffect` zeigt die Heldeninstanz mit dem Kontrolleur (Sitz 1) als `owner`; die Suche liefert `null`, der `if (heldInst)`-Block (Namenswechsel der Instanz, Ablaufstempel, Anker) entfällt, nur `hero.name` wurde bereits umgeschrieben. Der Sweep findet daher keinen Stempel.

### H01-heroes-13 · Throne Robber unter fremder Kontrolle: Abstieg bleibt aus · Stufe A
- **Karten:** ???, the Throne Robber (`the-throne-robber.js`)
- **Voraussetzungen / Aufbau:** Sitz 0: Shapeshifter (drei Gestalten benutzt) steigt per `performAscension` zum Throne Robber auf. Sitz 1 übernimmt ihn dauerhaft (`actionTakeHeroPermanently`), aktiviert den Heldeneffekt (Aufstieg zu „Dajan, Conqueror of the Treasure Cave" aus seiner Hand), dann `endTurn()` ×3.
- **Erwartet** (Kartentext „At the end of your opponent's next turn, Descend this Hero (even if it is defeated or its effects are negated)."): Am Ende des Zuges von Sitz 0 steigt der Held wieder zum Throne Robber ab. Kontrolle mit eigenem Robber ✓.
- **Beobachtet:** Der Held bleibt „Dajan, Conqueror of the Treasure Cave" (samt dessen Effekt, 700 HP-Rahmen usw.); `_identityExpiresTurn` fehlt auf der Instanz. Kein Engine-Fehler.
- **Repro:** `docs/niche-tests/repro/H01-heroes/13-throne-robber-uebernommen-abstieg-bleibt-aus.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** dieselbe Klasse wie -12: `the-throne-robber.js` ~Z. 318 `heldeninstanz(engine, feld, heroIdx)` (`feld = ctx.cardHeroOwner ?? pi`, Z. 244) findet die Instanz des übernommenen Helden nicht, der Stempel (Z. 321/329) entfällt.

### H01-heroes-14 · Shapeshifter: weitere Reste nach dem Abfallen – Karian-Immunitäten, Taio-ATK +20, Nao-Überheilung, Alice-Zonenteilung (Erweiterung von -02) · Stufe A
- **Karten:** ???, the Shapeshifter; verursachend: Grand Inquisitor Karian, Taio the Sun Fencer, Nao the Barrier Priestess, Alice, the Transfer Student (`alice-the-transfer-student.js`, aus dieser Gruppe)
- **Voraussetzungen / Aufbau:** Sitz 0: Shapeshifter auf Held 0 (`onGameStart` gefeuert), die Gestalt kommt aus der Hand (echter Heldeneffekt, Galerie), dann `endTurn()` ×2 (Gestalt fällt am Ende des Gegnerzuges ab; Held heißt wieder Shapeshifter).
- **Schritte / Erwartet** (Kartentext Shapeshifter „… At the end of your opponent's turn, send all Heroes equipped this way to the discard pile"; Skript-Ruling ② „nach dem Abfallen gilt wieder nur der eigene Effekt"): (a) Karian: danach lässt sich der Held negieren; (b) Taio: ATK wieder 40; (c) Nao: Heilung auf vollen HP bleibt bei Max-HP; (d) Alice: zwei gleichnamige Kreaturen teilen KEINE Support Zone mehr.
- **Beobachtet:** (a) `statuses` trägt dauerhaft zehn Immunitäten (`negate_immune`, `bleed_immune`, `null_immune`, `bound_immune`, `blind_immune`, `magic_silence_immune`, `frighten_immune`, `berserk_immune`, `curse_immune`, `aged_immune`) – `addHeroStatus('negated')` bleibt wirkungslos. (b) ATK 60 statt 40 (kein Artefakt angelegt). (c) `heroFlags['0-0'].overhealPassive` bleibt – Heilung geht auf 850/800. (d) die zweite Kreatur darf auf den belegten Platz (`supportZones[0][0] = [Dummy, Dummy]`), `ps._aliceShareActive` bleibt für den Spieler stehen. Weitere Marken derselben Klasse, deren Spielfolge hier nicht gemessen wurde (Scan über alle `onGameStart`-Helden): Ida (`heroFlags.forcesSingleTarget`), Toras (`heroFlags.singleTargetAttack`), Friedhelm (`hero._maxActionsPerTurn = 1`), Willy (`_willyEffectUsed`, `_noHandLimitUntilTurn`), Fiedel (`levelOverrideCards`), Tri Fecta (Puppets in den Support-Zonen), Lizbeth, Heragas/Wall Breaker (`_lastTurnEndTick`), Ghuanjun.
- **Repro:** `docs/niche-tests/repro/H01-heroes/14-shapeshifter-weitere-reste-karian-taio-nao-alice.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** wie -02: `initGainedHeroEffect` startet die `onGameStart`-Anfangsroutine der Gestalt, das Abfallen (`loseHeroEffect` → `onIdentityLost`) räumt nur bei Pseudonia und Sol Rym auf. `heroFlags` sind außerdem nach Seite/Slot geschlüsselt (`_engine.js` ~10059, ~5786), nicht nach dem aktuellen Helden.

### H01-heroes-15 · Alice, the Transfer Student: Zonenteilung hängt an der Spalte, nicht am Kontrolleur · Stufe B
- **Karten:** Alice, the Transfer Student (`alice-the-transfer-student.js`, `_alice-shared.js`)
- **Voraussetzungen / Aufbau:** Sitz 0: Alice auf Held 0, drei „ZZ Dummy" je Hand; Sitz 1 übernimmt sie dauerhaft (`actionTakeHeroPermanently(1, 0, 0)`). Sitz 1 legt zwei gleichnamige Dummys nacheinander auf Alices Platz 0 (`charmedOwner: 0`); Sitz 0 zwei Dummys auf Platz 0 seines Helden 1.
- **Erwartet** (Kartentext „Creatures with identical names in the Support Zones of a Hero **you control** share 1 Support Zone."; Regel „Übernommene Helden gelten als Helden des Kontrolleurs"): Sitz 1 darf die zweite Kreatur auf den belegten Platz legen; Sitz 0, der Alice nicht mehr kontrolliert, nicht (zweiter Teil ist als Lesart weniger sicher: „persists" bezieht sich im Text nur auf Alices Tod).
- **Beobachtet:** Sitz 1 wird abgelehnt (`false`), Sitz 0 teilt weiter (`true`, Platz hält 2 Dummys).
- **Repro:** `docs/niche-tests/repro/H01-heroes/15-alice-transfer-student-kontrolle.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_alice-shared.js` `sharingActive` (~Z. 66) prüft `gs.players[pi].heroes` (Spalte) auf den Namen und setzt `ps._aliceShareActive` dauerhaft; `heroesControlledBy` wird nicht gefragt. Gleiche Klasse wie -03/-04. Hinweis: laut Kopfkommentar hat die Karte noch kein Kartenbild – Auswirkung im echten Spiel derzeit gering.

### H01-heroes-16 · Devlin: Abwurf bei übernommenem Helden-Ziel trifft den Spaltenbesitzer statt des Kontrolleurs · Stufe B
- **Karten:** Devlin, the Masked Butcher (`devlin-the-masked-butcher.js`)
- **Voraussetzungen / Aufbau:** Sitz 0: Devlin (Held 0, Fighting 1), Held 1 (Rick) wird von Sitz 1 dauerhaft übernommen (`actionTakeHeroPermanently(1, 0, 1)`); beide Hände 5 Karten, „Attack" ×2 auf Sitz 0.
- **Schritte:** Sitz 0 greift den übernommenen Helden zweimal mit „Attack" an (1. Treffer: Blutung, 2. Treffer auf ein blutendes Ziel).
- **Erwartet** (Kartentext „When this Hero hits 1 or more Bleeding targets with an Attack, **those targets' controller** must discard 2 cards from their hand per Bleeding target hit."; Regel „Übernommene Helden gelten als Helden des Kontrolleurs"): Sitz 1, der das blutende Ziel kontrolliert, wirft 2 Karten ab.
- **Beobachtet:** Sitz 0 – Devlins eigener Kontrolleur und nur Spaltenbesitzer – wirft die 2 Karten ab (5 → 4 durch die gespielte Attack, → 2), Sitz 1 behält seine 5. Die Blutung selbst greift korrekt. Für Kreaturen-Ziele wird dagegen `inst.controller ?? inst.owner` benutzt (korrekt).
- **Repro:** `docs/niche-tests/repro/H01-heroes/16-devlin-uebernommenes-heldenziel-abwurf.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `devlin-the-masked-butcher.js:65` `const owner = engine._findHeroOwner(t)` (Brettspalte) wird an `forceDiscard(engine, owner, …)` weitergereicht; nötig wäre der Kontrolleur des Helden (`heroSideOf`/`heroesControlledBy`-Gegenstück).

### H01-heroes-17 · Brackle: das Opfer ist als eigenes Schadensziel wählbar – die Karte liegt danach doppelt in der Ablage · Stufe A
- **Karten:** Brackle, the Catapulting Turtle (`brackle-the-catapulting-turtle.js`)
- **Voraussetzungen / Aufbau:** Sitz 0: Brackle (Held 0), eine alte „ZZ Dummy" (200 HP, `turnPlayed = 1`) auf Held 1.
- **Schritte:** 1. Heldeneffekt aktivieren, Opferwahl: der Dummy. 2. In der Schadenswahl (Zielliste enthält Helden und Kreaturen) denselben Dummy anklicken.
- **Erwartet** (Kartentext „sacrifice a Creature you control … to choose a target and deal damage to it equal to the sacrificed Creature's current HP"; Opfern geht der Zielwahl voraus): Das Opfer ist kein mögliches Ziel mehr; jede Karte erscheint genau einmal in der Ablage (Kartenbilanz ohne Differenz).
- **Beobachtet:** Die Zielliste enthält das zu opfernde Wesen (`equip` Sitz 0 / Held 1 / Slot 0, auch bei normalem Ablauf als letzter Eintrag sichtbar). Gewählt: es nimmt 200 Schaden, stirbt (`creature_destroyed` → Ablage), danach legt das Opfern (`destroy`) es ein zweites Mal ab – `discardPile = ["ZZ Dummy","ZZ Dummy"]`, `censusDiff` meldet „ZZ Dummy: +1" (duplizierte Karte), `audit()` bleibt leer.
- **Repro:** `docs/niche-tests/repro/H01-heroes/17-brackle-opfer-als-eigenes-ziel-dupliziert-karte.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `brackle-the-catapulting-turtle.js` (Kopfkommentar „destroyCard fires AFTER the damage lands"): Das Opfer bleibt während Zielwahl (`ctx.promptDamageTarget`, ~Z. 235) und Schaden (~Z. 313) auf dem Brett; die Zielliste filtert es nicht heraus, und das spätere Opfern (~Z. 340 ff.) prüft nicht, ob es schon gefallen/abgelegt ist.

### H01-heroes-18 · Elana / Champion unter Zieh- oder Handsperre: Hand verschwindet ohne Nachziehen · Stufe C
- **Karten:** Elana, the Rocky Rebel (`elana-the-rocky-rebel.js`), Champion, the Stormbringer (`champion-the-stormbringer.js`)
- **Voraussetzungen / Aufbau:** Sitz 0: Elana bzw. Champion, 4 Handkarten, Deck 12 (Elana) bzw. 10; `ps.drawLocked = true` (wie Sacred Jewel) oder `ps.handLocked = true`.
- **Schritte:** Heldeneffekt über `doActivateHeroEffect` (Champion in der Action Phase, 3 Karten gewählt).
- **Erwartet** (Kartentext Elana „shuffle your entire hand back into the deck and then draw the same number of cards +1"; Champion „discard up to 5 cards …, then draw that many"; Konvention: Heldeneffekte, deren Kern an der Handsperre scheitert, sind nicht aktivierbar – Enigma `if (ps.handLocked) return false;` mit Kommentar „mirrors Infiltration's gate"): entweder gesperrt oder wenigstens kein stiller Totalverlust der Hand.
- **Beobachtet:** Elana ist unter `drawLocked` und unter `handLocked` aktivierbar: 4 Handkarten → 0, Deck 12 → 16, nichts wird gezogen. Champion unter `drawLocked`: wirft 3 Karten ab (Hand 4 → 1), zieht keine. (Gegen die Gegenseite wirkt Champions Zug „cannot be prevented" korrekt auch unter Gegner-`drawLocked`.)
- **Repro:** `docs/niche-tests/repro/H01-heroes/18-elana-champion-ziehsperre-verliert-hand.js` (✗ = Hand geht verloren)
- **Vermutete Ursache:** Beide Skripte prüfen `drawLocked`/`handLocked` in `canActivateHeroEffect` nicht (Enigma/Infiltration tun es).
- **Frage an Al:** Soll die Aktivierung unter Zieh-/Handsperre gesperrt sein (wie Enigma) – ja oder nein (Selbstschaden bewusst erlaubt)?

### H01-heroes-19 · Dajan: scharfgestellter Gratis-Artefaktkauf bleibt gültig, wenn Dajan danach negiert/gefroren/besiegt wird · Stufe C
- **Karten:** Dajan, Conqueror of the Treasure Cave (`dajan-conqueror-of-the-treasure-cave.js`; Engine `armFreeArtifact` / `artifactPlayCost` / `consumeFreeArtifact`)
- **Voraussetzungen / Aufbau:** Sitz 0: Dajan auf Held 0, 100 Gold, „Ancient Tech Infinite Energy Core" (Equipment, Cost 10) auf der Hand. Klick auf Dajan stellt den Gratiskauf scharf; danach `negated` / `frozen` / HP 0; dann das Artefakt spielen.
- **Erwartet** (Kartentext „You may once per turn play an Artifact … without paying its Cost"; Konvention: ausgefallene Helden haben keine Heldeneffekte): unklar – ein ausgefallener Dajan kann den Gratiskauf nicht mehr gewähren (dann kostet das Artefakt 10), oder der einmal scharfgestellte Effekt gilt als „verpflichtet" und bleibt bis Zugende.
- **Beobachtet:** in allen drei Zuständen kostet das Artefakt 0 Gold, der Stempel `hero-effect:Dajan…` wird gesetzt. Kontrolle gesund ✓.
- **Repro:** `docs/niche-tests/repro/H01-heroes/19-dajan-scharf-bleibt-trotz-ausfall.js` (✗ = bleibt gratis)
- **Vermutete Ursache:** `_engine.js:24363` (`artifactPlayCost`) und `consumeFreeArtifact` (~24490) lesen nur `ps._freeArtifactArmed` (turn-gestempelt); der Held wird nach dem Scharfstellen nicht mehr gefragt. Reichweite gering: solange scharf, sind nur Artefakte spielbar; Ausfall zwischen Scharfstellen und Spielen geht nur über Reaktionen/Oberflächenfenster.
- **Frage an Al:** Soll das Scharfstellen verfallen, wenn Dajan vor dem Spielen negiert/gefroren/besiegt wird – ja oder nein (einmal verpflichtet = bleibt)?

### H01-heroes-20 · Card Game Player Inya NEGIERT: ihr Zauber wird trotzdem zum Fantasy Buddy · Stufe B
- **Karten:** Card Game Player Inya (`card-game-player-inya.js`)
- **Voraussetzungen / Aufbau:** Sitz 0: Inya (Held 0) `negated`, Lv-0-Zauber „ZZ Filler" auf der Hand (ein negierter Held darf nur Zauber ohne Schulanforderung wirken – Fireball ist abgelehnt). Kontrolle: gesunde Inya.
- **Schritte:** Zauber über `doPlaySpell` spielen.
- **Erwartet** (Kartentext „Whenever **this Hero uses a Spell** during your turn, you may summon that Spell into one of this Hero's free Support Zones as a Fantasy Buddy Token …"; Konvention: negierte Helden verlieren ihre Effekte; das Skript begründet `bypassStatusFilter` nur mit dem Schadensschild, „passive protection isn't an effect she activates"): Der Buddy-Teil ist ein ausgelöster Effekt – negiert keine Rückfrage, der Zauber geht in die Ablage.
- **Beobachtet:** Rückfrage „Summon … as a Fantasy Buddy Token?" erscheint, der Zauber liegt als Buddy (10 HP) im Support, die Ablage bleibt leer – wie bei gesunder Inya. Damit wird auch der Schadensschild des negierten Helden scharf.
- **Repro:** `docs/niche-tests/repro/H01-heroes/20-inya-negiert-beschwoert-buddy.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `bypassStatusFilter: true` (Z. 100) schaltet den zentralen Statusfilter für ALLE Hooks aus; `afterSpellResolved` (~Z. 111 ff.) hat keine eigene Status-Sperre. Beato (gleiches Muster, `beato-the-butterfly-witch.js` Z. 136 f.) hat sie. Frozen/Stunned können gar keine Zauber wirken, daher nur Negation betroffen.

### H01-heroes-21 · Beato (Witch und Eternal) NEGIERT: Stufen-/Schulumgehung bleibt aktiv · Stufe B
- **Karten:** Beato, the Butterfly Witch (`beato-the-butterfly-witch.js`), Beato, the Eternal Butterfly (`beato-the-eternal-butterfly.js`)
- **Voraussetzungen / Aufbau:** Sitz 0: Beato auf Held 0 ohne jede Ability (`onGameStart` bzw. `onAscendSetup` gefeuert), „Burning Finger" (Destruction Magic Lv1) und „Hell Fox" (Creature Lv1) auf der Hand; Held `negated`.
- **Schritte:** Karte über den echten Spielweg (`doPlaySpell` / `doPlayCreature`) spielen.
- **Erwartet** (Kartentext Witch „This Hero can use any level 1 Spells and Creatures", Eternal „… regardless of level or school"; Konvention: negierte Helden verlieren ihre Heldeneffekte, ihre Abilities zählen nicht – Kontrolle: negierte Inya mit Fireball ✗ abgelehnt): ohne Schule nicht spielbar. Gesund spielbar ✓.
- **Beobachtet:** negiert werden Burning Finger, Hell Fox und (Eternal) Burning Finger gespielt. Frozen/Stunned: abgelehnt (Held handlungsunfähig).
- **Repro:** `docs/niche-tests/repro/H01-heroes/21-beato-negiert-level-bypass.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `beato-the-butterfly-witch.js` `bypassLevelReq` (~Z. 99, ohne Statusprüfung) und das Heldenobjekt-Flag `hero.bypassLevelReq` (Z. 106; beim Eternal Z. 54/139/151). Beatos Skripte schalten den Statusfilter für die Orb-Zähler ausdrücklich wieder ein („Guard against incapacitation"), nicht für die Umgehung; der Eternal-Kommentar nennt das Flag „a plain field … persists through freeze/thaw" (gemeint: es bleibt gesetzt, nicht: es wirkt weiter). Gleiche Klasse wie -09 (Baaliel), andere Stelle (`bypassLevelReq`-Flag/-Funktion statt `canBypassLevelReqForCard`).

### H01-heroes-22 · Shapeshifter / Throne Robber: Held aus Deck oder Ablage trotz Such-/Handsperre · Stufe C
- **Karten:** ???, the Shapeshifter (`the-shapeshifter.js`), ???, the Throne Robber (`the-throne-robber.js`)
- **Voraussetzungen / Aufbau:** Sitz 0: Shapeshifter (bzw. nach `performAscension` Throne Robber mit drei benutzten Gestalten); die Wunschgestalt (Archibald bzw. Dajan) liegt nur im Deck (Shapeshifter zusätzlich: nur in der Ablage); `ps.searchLocked = true` / `ps.handLocked = true` / `searchLockedIncludesDiscard = true`.
- **Schritte:** Heldeneffekt über `doActivateHeroEffect`, Galerie beantworten.
- **Erwartet** (Kartentext Shapeshifter „… from your hand, deck or discard pile", Robber „… from your hand or deck"; CARD_API.md „Cats of the Pharaoh (v1068)": `searchLocked` sperrt „Deck-Suche und Adds", mit `searchLockedIncludesDiscard` auch die Ablage; `handLocked` sperrt Suchen/Adds): unklar, ob ein Anlegen/Aufsteigen aus dem Deck eine „Suche" ist – Lesart A: gesperrt (Karten aus dem gesperrten Stapel werden nicht angeboten), Lesart B: nicht gesperrt (kein Hand-Zugang, nur Stapel-Ausgangssperre).
- **Beobachtet:** Die Galerie bietet die Karte aus Deck bzw. Ablage an, Verwandlung/Aufstieg gelingt und die Karte verlässt den Stapel – unter `searchLocked`, `handLocked` und (Ablage) `searchLockedIncludesDiscard`. Die Stapel-Ausgangssperre (Knight of Kings [B]) greift dagegen: die Karte wird zwar noch in der Galerie angeboten, aber nach der Wahl verworfen (Aktivierung läuft ins Leere, HOPT zurück).
- **Repro:** `docs/niche-tests/repro/H01-heroes/22-shapeshifter-robber-suchsperre.js` (✗ = nicht gesperrt)
- **Vermutete Ursache:** `waehlbareGestalten` (~Z. 135 ff.) bzw. `the-throne-robber.js` ~Z. 120 (`sammle(ps.mainDeck, 'deck')`) sammeln ohne `engine._isSearchBlocked`; `takeFromPile` prüft nur `pileOutAllowed`.
- **Frage an Al:** Soll die Such-Sperre auch das Anlegen/Aufsteigen aus Deck/Ablage (Shapeshifter, Throne Robber) sperren – ja oder nein? (Bei „ja" gilt dasselbe wie bei -11 Alex.)

### H01-heroes-23 · Chaos-Diamond: ein gewirkter Attachment-Spell liegt danach doppelt vor (Ablage UND am Helden) · Stufe A
- **Karten:** Chaos-Diamond, the Cracked Keeper (`chaos-diamond-the-cracked-keeper.js`; Engine `_castSpellImmediately`)
- **Voraussetzungen / Aufbau:** Sitz 0: Chaos-Diamond als Starthelden (`onGameStart` gefeuert), Potion Deck `[<Attachment-Spell>, "Accusation"]` (Attachment-Spells sind im Potion Deck dieses Helden ausdrücklich zugelassen), Action Phase, Ziel: Gegner-Held 0.
- **Schritte:** Heldeneffekt aktivieren (`doActivateHeroEffect`) mit Curse / Decisive Defeat / Energy Aura als oberster Karte.
- **Erwartet** (Kartentext „reveal the top 2 cards of your Potion Deck and immediately have this Hero perform all Spells among them in order as additional Actions"; ein gewirktes Attachment liegt wie sonst auch genau einmal am Helden): Die Karte verlässt die Ablage und liegt einmal am Helden; Kartenbilanz ohne Differenz.
- **Beobachtet:** Curse: Ablage `["Curse","Accusation"]` UND eine Curse-Instanz im Support des Gegner-Helden (`censusDiff`: „Curse: +1"). Ebenso Decisive Defeat (am Gegner) und Energy Aura (am eigenen Helden). Die Karte existiert doppelt; fällt das Attachment später ab, landet eine zweite Kopie in der Ablage. **Reihenuntersuchung** über alle 213 Normal-/Attachment-Spells als oberste Karte (Zweite: Accusation): 22 Karten mit „+1“-Bilanz – Anti Magic, Berserk, Call of the Deepsea, Castling, Curse, Decisive Defeat, Dichotomy of Luna and Tempeste, Divine Gift of Balance, Divine Gift of The Light, Energy Aura, Forbidden Curse of Aging, Forbidden Zone, Gathering Storm, Guardian Angel, Intrude, Invisibility, Light Ball, Overheal Shock, Prayer, Prophecy of Tempeste, Royal Treasury, Siege (alle legen sich selbst aufs Brett: Attachment/Area/Dauerkarte); die vier „Pollution Token +1/+2“-Fälle (Cold Coffin, Medusa's Curse, Null Zone, Pyroblast) sind erzeugte Tokens, kein Fehler; keine Fehler/Hänger bei den übrigen 187. Normale Spells (Accusation, Aligning Goals) sauber, Potion Deck mit 1 Karte / leer ✓, negiert/gefroren nicht aktivierbar ✓.
- **Repro:** `docs/niche-tests/repro/H01-heroes/23-chaos-diamond-attachment-spell-dupliziert.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_engine.js` `_castSpellImmediately` ~Z. 21925–21931: im Zweig `_aufsBrett` wird nur bei `fromZone !== 'deck'` aus dem Pool genommen; Chaos-Diamond ruft mit `fromZone: 'deck'` + `bereitsInAblage: true` (Skript ~Z. 150) auf, die vorab abgelegte Kopie bleibt in der Ablage.

### H01-heroes-24 · Cool Rescuer Monia fängt nur Schaden ab – Status-, Kontroll-, Bounce-Effekte auf Kreaturen nicht · Stufe B
- **Karten:** Cool Rescuer Monia (`cool-rescuer-monia.js`)
- **Voraussetzungen / Aufbau:** Sitz 1: Monia (Held 0, `onGameStart` gefeuert), eine alte Kreatur (200 HP) auf Held 1, zwei Handkarten. Sitz 0 spielt „Instant Cryo Stasis" („Choose a Creature your opponent controls and Freeze it for the rest of the game") auf diese Kreatur; Kontrolle: „Fireball" auf dieselbe Kreatur.
- **Erwartet** (Kartentext „… when 1 or more Creatures either player controls would be affected by a card or effect, you may discard 1 card to negate **any effects** that card or effect has on all Creatures."): Monia bietet auch hier das Abfangen an; nach Zustimmung ist die Kreatur nicht gefroren und eine Karte abgeworfen.
- **Beobachtet:** Fireball (Schaden): Angebot „Cool Rescue!" ✓. Instant Cryo Stasis: kein Angebot, die Kreatur ist gefroren (`counters.frozen = 1`, Dauer 9999). Kidnapping (Bounce) ließ sich im Harness nicht sinnvoll aufbauen (auch ohne Monia ohne Wirkung) – nicht bewertet.
- **Repro:** `docs/niche-tests/repro/H01-heroes/24-monia-nur-schaden-nicht-status.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `cool-rescuer-monia.js` Kopfkommentar „Hooks into beforeCreatureDamageBatch … Future: also intercept status, healing, control changes." – die Karte ist nur für den Schadensweg verdrahtet (siehe auch -08, wo die dort gesetzte Marke fremde Status später blockt, obwohl der Status-Weg selbst keinen Auslöser hat).

## Abdeckung
| Karte | Tiefe | Geprüfte Nischenfälle / Anmerkung |
|---|---|---|
| ???, the Shapeshifter | L2 gezielt | Zustände nach Abfallen ✗ (→ -02, -14), Chaos-Diamond-Gestalt ✗ (→ -07), übernommen ✗ (→ -12), Such-/Handsperre (→ -22); Gestalt-Effekt im selben Zug ✓, HOPT ✓, Träger zerstört/Held stirbt+Revive ✓, Hel-Gestalt stirbt am Zugende (regelkonform) |
| ???, the Throne Robber | L2 gezielt | Abstieg unter Kontrolle ✗ (→ -13), Suchsperre (→ -22); Abstieg bei Tod/Negation/Frost/Revive ✓, Aufstieg „unskippable"-Ziele ✓, HP-Bilanz ✓ |
| Alex, Trainer of Heroes | L2 gezielt | Suchsperre/Handsperre ✗ (→ -11); max. 2× pro Zug ✓, Abbruch der Galerie ✓, negiert ✓, tote Zielhelden ✓, Folgezug ✓. Übernommener Alex nicht getestet (Harness) |
| Alice, the Puppeteer Girl | L2 gezielt | selbst gestohlene Kreatur ✗ (→ -05), Anti Magic (→ -06); Matrix Frost/Betäubung/Negation/Erstrunde/HOPT ✓, übernommen ✓ |
| Alice, the Transfer Student | L2 gezielt | Kontrolle statt Spalte ✗ (→ -15), Rest nach Shapeshifter (→ -14); tot/negiert teilen weiter ✓ |
| Andras, the Human Weapon | L2 gezielt | zweites Ziel bei Fighting-Stufe 1/2 ✓, negiert ✓, nur 1 Gegnerheld ✓, Kreatur als Ziel ✓, übernommen ✓ |
| Archibald, the Archmage | L2 gezielt | Gegnerzug ✗ (→ -01); Pro-Zug-Liste bei Negation/Zugwechsel ✓ |
| Arthor, Inheritor of the Barbarian Sword | L2 gezielt | Matrix Status/Sperren/Erstrunde/HOPT/Abbruch ✓, übernommen ✓ (Aufstiegsweg nicht getestet) |
| Arthor, the King of Blackport | L2 gezielt | Handgrößen 1/2/3 ✓, The White Eye ✓, negiert ✓, anderer Held ✓, Slow-Sperre ✓, Erstrunde ✓ |
| Baaliel, the Demon General | L2 gezielt | negiert: Stufenumgehung + Gratis-Beschwörung ✗ (→ -09); gesund 1× gratis ✓, Dämonenzähler (Kreatur/Held, beide Seiten, eigener Tod) ✓ |
| Barker, the Monster Tamer | L2 gezielt | Lv1 aus Hand/Deck ✓, Lv2 ausgeschlossen ✓, alle Zonen belegt ✓, negiert/gefroren/tot ✓ (Zugwechsel statt echtem Spielstart) |
| Beato, the Butterfly Witch | L2 gezielt | negiert: Stufenumgehung ✗ (→ -21), Reste nach Shapeshifter (→ -02); Orb-Zähler-Wächter gelesen ✓ |
| Beato, the Eternal Butterfly | L2 gezielt | negiert ✗ (→ -21); Bonus bei `handLocked` fizzelt ✓ (gelesen) |
| Bill, the Angry Auctioneer | L2 gezielt | 1/2 Ausrüstungen, Kostendeckel 20, Doppelname, tote Helden, kein Artefakt im Deck ✓ |
| Blackstache, Scourge of the Pixel Seas | L2 gezielt | Status und Kontrolle ✗ (→ -03) |
| Bomb Berserker Bartas | L1 Standard | zweites Ziel bei Destruction Magic 2 ✓ (nur Standardfall) |
| Boris, the Guardian of Blackport | L2 gezielt | Kontrolle ✗ (→ -04); Status-Prüfung vorhanden ✓, Skip-Abfrage bei Champion ✓ |
| Bow Sniper Darge | L2 gezielt | +50 je Pfeil ✓, ohne Pfeil ✓, negiert ✓, Kreaturenziel ✓ (Pfeil-Stau nach Abbruch = bekannter Befund A09-01) |
| Brackle, the Catapulting Turtle | L2 gezielt | Opfer als Ziel ✗ (→ -17); Abbruch Ziel→Opfer ✓, HOPT ✓, gestohlene Kreatur → Ablage des Besitzers ✓, 300-Deckel ✓, frische Kreatur nicht wählbar ✓, Erstrunde ✓ |
| Broghan, the Frozen Guardian of the North | L2 gezielt | Matrix ✓, Schadensformel (Deckgröße des Kontrolleurs) ✓, Revive hält Immunität ✓; Leck als Gestalt → -02 |
| Bubbles, the Bouncy Bunny | L2 gezielt | Umleitung, tödliche Umleitung (7 Karten), frozen/stunned/negated, Batch mit 2 Kreaturen, übernommen (Frage an Kontrolleur) ✓ |
| Card Game Player Inya | L2 gezielt | negiert ✗ (→ -20); Buddy-Tod → Karte in „deleted" ✓, Schadensschild ✓, Flooding negiert ✓, Lead „kein Spielende" erklärt (kein Buddy → Inya stirbt normal) |
| Carris, the Time Keeper | L2 gezielt | Uhr unter Kontrolle ✓ (Kontrolleur verliert nach 3 eigenen Zugenden), Lead „kein Spielende" ✓ (Schadensmauer) |
| Champion, the Stormbringer | L2 gezielt | Zieh-/Handsperre ✗ (→ -18); Gegner-`drawLocked` wird ignoriert wie vorgesehen ✓, Boris-Gegner ✓, Erstrunde ✓, leere Gegnerhand gesperrt ✓ |
| Chaos-Diamond, the Cracked Keeper | L2 gezielt | Attachment-Duplikat ✗ (→ -23), Potion-Sperre als Gestalt (→ -07); 213-Spell-Reihenuntersuchung, Deck mit 0/1 Karte ✓, negiert/gefroren gesperrt ✓ |
| Chuck, the Crazy Veteran | L1 Standard | Flächenschlag (alle 80 HP) und Lead ✓ (Skript liest `heroesControlledBy`), Ida-Zauber durchbricht Schild (Ida: „cannot be reduced") |
| Chuck, the Storyteller | L2 gezielt | Aufstieg (Schaden ja / `actionDefeatHero` nein / letzter Held nein) ✓, Ziehen 2 bei Zauber/Beschwörung ✓, negiert ✓, übernommen (Kontrolleur zieht) ✓ |
| Codumbus, the Clueless Voyager | L2 gezielt | Treffer/Fehlschlag/Deck=1/HOPT/Hand-/Zieh-Sperre/negiert/Erstrunde/übernommen ✓, normales Zugziehen löst nicht aus ✓ |
| Cool Rescuer Monia | L2 gezielt | Marke bleibt ✗ (→ -08), nur Schaden ✗ (→ -24) |
| Dajan, Conqueror of the Treasure Cave | L2 gezielt | Scharfstellen bleibt nach Ausfall (→ -19); Gratis ✓, HOPT erst beim Spielen ✓ |
| Damus, the Prophet of Apocalypse | L2 gezielt | Armageddon-Immunität bei Negation ✗ (→ -10); Ifrit-Schutz ruht korrekt ✓, übernommen: Platzierung/Level-Senkung ✓ |
| Devlin, the Masked Butcher | L2 gezielt | übernommenes Helden-Ziel ✗ (→ -16); Blutung ✓ |
| Diamond, the Bulwark of Peace | L2 gezielt | Ersetzen + HOPT ✓, gestohlene Kreatur (Löschen beim Besitzer) ✓, gefroren/Gegnerkreatur ✓ (Aufstieg nicht getestet) |
| Diamond, the Keeper of Peace | L2 gezielt | Schutz per Kreatur, HOPT, 2-Kreaturen-Batch, gefroren/betäubt/negiert, Lv2-Kreatur, Gift-Tick, True Damage, Diamond stirbt am Selbstschaden ✓; doppelter Batch-Eintrag derselben Kreatur zählt 2× (kein echter Auslöser gefunden, nicht gemeldet) |
| Don Quisto, the Gold Seeker | L2 gezielt | 19/20/100 Gold ✓, negiert ✓, Kopfgeld bei Held/Kreatur ✓, Bonus abgelehnt ✓, übernommen (Gold des Kontrolleurs) ✓ |
| Elana, the Rocky Rebel | L2 gezielt | Zieh-/Handsperre (→ -18); Matrix sonst ✓, übernommen ✓ |
| Enigma, the Seller of Secrets | L2 gezielt | Matrix Status/Sperren/Erstrunde/HOPT ✓, übernommen ✓ (Entscheidungen im Kopf dokumentiert, nicht gemeldet) |

## Getestet & in Ordnung (Auswahl)
* **Aktivierungs-Helden unter Zuständen** (Alice P, Arthor I, Brackle, Broghan, Champion, Elana, Enigma): frozen/stunned/negated gesperrt, Erstrunden-Schutz (Gegner geschützt) sperrt die rein schädlichen Effekte, HOPT hält (zweite Aktivierung abgelehnt), Zieh-/Hand-/Such-/Aktionssperre ändert nichts außer Elana/Champion (→ -18).
* **Übernommene Helden** (dauerhaft per `actionTakeHeroPermanently`): Alice P, Arthor I, Brackle, Broghan (Deck des Kontrolleurs), Champion, Elana, Enigma, Codumbus (Rückfrage an Gegner des Kontrolleurs), Don Quisto (Gold/Kopfgeld), Chuck Storyteller (Kontrolleur zieht), Andras, Damus (Ifrit aus der Hand des Kontrolleurs), Carris (Uhr tickt für den Kontrolleur), Bubbles, Diamond Bulwark ✓ – nur Boris, Blackstache, Alice TS, Devlin, Shapeshifter/Robber fallen aus (→ -03, -04, -15, -16, -12, -13).
* **Brackle**: Opferwahl zurück/abbrechen lässt Kreatur und HOPT unberührt; gestohlene Kreatur → Ablage des Besitzers; 1000 HP → 300 Schaden.
* **Chaos-Diamond**: negiert/gefroren nicht aktivierbar, Potion Deck 0 → nicht aktivierbar, 1 Karte ✓; alle 213 Normal-/Attachment-Spells als oberste Karte ohne Fehler/Hänger (nur das Duplikat -23).
* **Chuck Storyteller**: Aufstieg nur bei Schaden-Tod mit lebendem Mitspieler; `actionDefeatHero` (kein Schaden) und letzter Held lösen nicht aus; „draw 2" bei Zauber und Beschwörung, nicht bei Negation.
* **Diamond Bulwark**: Ersetzen im selben Platz, nur 1× pro Zug, gestohlene Kreatur wird beim Besitzer gelöscht (Ablage), kein Angebot bei gefrorenem Held oder gegnerischer Kreatur.
* **Don Quisto**: 19 Gold → kein Angebot, 20 → Bonus = aktueller ATK, abgelehnt → kein Gold weg, Kopfgeld je besiegtem Ziel (Held und Kreatur) auch ohne Bonus.
* **Codumbus**: Zugziehen löst nicht aus, „Gegner zieht 1" nicht, „2 Karten" nicht, HOPT, Erstrunden-Schutz (kein Deck-Verlust beim Geschützten).
* **Bubbles**: Umleitung auch aus Zauberschaden, tödliche Umleitung → Nachziehen bis 7, bei Frost/Betäubung/Negation keine Umleitung.
* **Barker**: Lv2 nicht wählbar, Deck-Lv0 wählbar, alle Zonen belegt → keine Frage, negiert/gefroren/tot → keine Wirkung.
* **Arthor, the King of Blackport**: 1/2 Handkarten, White Eye (2 Karten), Slow-Sperre, Erstrunde, Fremdheld, negiert.
* **Throne Robber**: Abstieg auch bei totem/negiertem/gefrorenem/wiederbelebtem Gestalt-Held; HP-Bilanz über Auf- und Abstieg stimmig.
* **Darge**: +50 je Pfeil, auch gegen Kreaturenziel; negiert → kein Bonus. (Hinweis außerhalb dieser Gruppe: ein Angriff eines NEGIERTEN Helden fizzelt in einer Reaktionskette — mit Pfeil —, wird aber ohne Kette ausgeführt; `_kettenWirkerFizzelt` ist dokumentiert „Als Befund 24.9.", aber die Asymmetrie ketten/nicht ketten fiel auf; nicht weiter verfolgt.)

