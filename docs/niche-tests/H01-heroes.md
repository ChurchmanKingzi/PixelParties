# H01-heroes – Nischenfall-Bericht
Stand/Autor: Agent H01-heroes, 12.10.2026. Karten: 37 in der Liste · (wird fortlaufend ergänzt) gezielt getestet · (wird fortlaufend ergänzt) mit Befund.

## Zusammenfassung
(wird am Ende ausgefüllt – Arbeitsstand: Bericht wächst mit jedem bestätigten Befund)

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

## Abdeckung
(wird am Ende ausgefüllt)

## Getestet & in Ordnung (Auswahl)
(wird am Ende ausgefüllt)
