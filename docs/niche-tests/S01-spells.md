# S01-spells – Nischenfall-Bericht
Stand/Autor: Agent S01-spells, 12.10.2026. Karten: 41 in der Liste · (wird am Ende ergänzt) gezielt getestet · (wird am Ende ergänzt) mit Befund.

## Zusammenfassung
(wird am Ende ergänzt)

## Befunde
### S01-01 · Negiertes Divine Gift verbraucht die gemeinsame Einmal-pro-Spiel-Grenze nicht · Stufe B
- **Karten:** alle Normal-Zauber „Divine Gift of …" der Liste (Balance, Biseria, Creation, Death, Equality, Fire, Forgetting, Magic, Sacrifice, Skill, the Deepsea); getestet mit Divine Gift of Fire (`cards/effects/divine-gift-of-fire.js`) und Divine Gift of Skill, Server `doPlaySpell`.
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Sitz 0: Divine Gift of Fire + Divine Gift of Skill auf der Hand; Sitz 1: Silence auf der Hand (Held 0 mit Magic Arts, Silence = Reaktion, negiert einen Zauber).
- **Schritte:** 1. Sitz 0 spielt Divine Gift of Fire (Spielerwahl Sitz 1), Sitz 1 antwortet mit Silence. 2. Sitz 0 spielt im selben Zug Divine Gift of Skill.
- **Erwartet** (Quelle: Kartentext „You can only activate 1 "Divine Gift" card per game."; Ruling `CARD_API.md` ~Z. 11418-11440, v1031: „Der Stempel sitzt dort, wo die Karte die Hand verlässt – ab da IST sie aktiviert …, **unabhängig davon, ob ein Gegenzug sie später negiert**."): Das negierte Gift stempelt `divineGift`; das zweite Gift ist nicht mehr spielbar.
- **Beobachtet:** Das erste Gift landet negiert in der Ablage, `_oncePerGameUsed` bleibt **leer**, das zweite Gift wird gespielt und wirkt voll (4 Bonus-Anhänge für Held 0); erst danach steht `divineGift` im Set. Damit lässt sich die „1 Divine Gift pro Spiel"-Regel aushebeln, indem der Gegner das erste Gift negiert – oder umgekehrt: ein Spieler, dessen Gift negiert wurde, hat es „umsonst" aktiviert und darf trotzdem ein weiteres spielen.
- **Repro:** `docs/niche-tests/repro/S01-spells/01-divine-gift-negiert-stempelt-nicht.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `server.js` `doPlaySpell`: der Stempel `ps._oncePerGameUsed.add(opgKey)` steht erst am Ende des Normalzweigs (ca. Z. 8948-8952); der Negierungs-Zweig `if (chainResult.negated) { … return true; }` (ca. Z. 8324-8374) kehrt davor zurück. Die Reaktions-Fenster (`executeCardWithChain`) stempeln dagegen beim Verlassen der Hand (Ruling v1031).
- **Verwandt (nicht gesondert getestet):** dieselbe Lücke gilt für jeden Normal-Spell mit `oncePerGame` (z. B. Eraser Beam, Silence selbst – `A07-12` hatte sie bei Guard Duty gesehen).

### S01-02 · Negiertes Big Oopsie / Butterfly Cloud zählt nicht gegen „1 pro Zug" bzw. „nicht 2 Züge hintereinander" · Stufe C
- **Karten:** Big Oopsie (`cards/effects/big-oopsie.js`), Butterfly Cloud (`cards/effects/butterfly-cloud.js`).
- **Voraussetzungen / Aufbau:** Sitz 0: 2× Big Oopsie bzw. 2× Butterfly Cloud auf der Hand; Sitz 1: Silence (negiert den ersten Zauber).
- **Schritte:** 1. Erster Zauber wird von Silence negiert. 2a. Big Oopsie: zweites Big Oopsie im selben Zug. 2b. Butterfly Cloud: zwei Zugwechsel, dann Butterfly Cloud im nächsten eigenen Zug.
- **Erwartet** (Kartentext Big Oopsie: „You can only play 1 "Big Oopsie" per turn." / Butterfly Cloud: „You cannot play "Butterfly Cloud" on 2 consecutive turns."): Lesart A „gespielt = gezählt" (analog Ruling v1031 bei den Divine Gifts): das negierte Big Oopsie verbraucht den Zug-Slot, die negierte Butterfly Cloud sperrt den Folgezug. Lesart B (Skript): erst der wirkende Zauber zählt.
- **Beobachtet:** Lesart B. Big Oopsie stempelt `claimHOPT` erst im Effekt (Ruling in `CARD_API.md` „BIG OOPSIE": „gestempelt, sobald der Effekt wirklich läuft"; dort ist nur der Abbruch bedacht, nicht die Negierung) – nach der Negierung trifft ein zweites Big Oopsie (Held −150). Butterfly Cloud setzt `_butterflyCloudUsedThisTurn` erst am Ende von `onPlay` – nach einer negierten Butterfly Cloud ist sie im nächsten eigenen Zug wieder spielbar und trifft (−50).
- **Repro:** `docs/niche-tests/repro/S01-spells/02-big-oopsie-butterfly-cloud-negiert-zaehlt-nicht.js` (✗ = Lesart A wird nicht erfüllt)
- **Vermutete Ursache:** `big-oopsie.js:121` (`claimHOPT` im `onPlay`) bzw. `butterfly-cloud.js:90` (Flag im `onPlay`); ein negierter Zauber führt `onPlay` nie aus.
- **Frage an Al:** Soll ein von einer Reaktion **negierter** Zauber das „pro Zug"/„nicht in 2 aufeinanderfolgenden Zügen"-Limit von Big Oopsie und Butterfly Cloud trotzdem verbrauchen (ja = wie bei den Divine Gifts / nein = wie jetzt)?

### S01-03 · Butterfly Cloud (ein Zauber) schadet Kreaturen unter Dark Ocean nicht · Stufe B
- **Karten:** Butterfly Cloud (`cards/effects/butterfly-cloud.js`), Dark Ocean (Engine `_engine.js` ca. Z. 46286).
- **Voraussetzungen / Aufbau:** Dark Ocean liegt als Area; Sitz 1 hat eine 200-HP-Kreatur; Sitz 0 hat Butterfly Cloud (Kontrolle: Boiling Oil).
- **Schritte:** 1. Boiling Oil spielen → Kreatur verliert 80. 2. (frisches Spiel) Butterfly Cloud spielen.
- **Erwartet** (Kartentext Dark Ocean: „Creatures take no damage, except from Attacks and **Spells**."; Butterfly Cloud: „Deal 50 damage to all targets your opponent controls."): Die Kreatur verliert 50.
- **Beobachtet:** Boiling Oil trifft (120 HP), Butterfly Cloud nicht (200 HP, Log `dark_ocean_damage_blocked`, `damageType: 'other'`). Gegenprobe ohne Dark Ocean: −50. (Helden-Surprises wie Firewall öffnen trotz Typ `'other'` normal – nur die Dark-Ocean-Weiche ist betroffen.)
- **Repro:** `docs/niche-tests/repro/S01-spells/03-butterfly-cloud-dark-ocean.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `butterfly-cloud.js:82` schlägt mit `damageType: 'other'` zu; die Dark-Ocean-Weiche (`_engine.js` ca. Z. 46286-46300) lässt laut Ruling 5.8. nur `attack` und `destruction_spell` durch. Der Zauber gehört in die Zauber-Schublade (CARD_API „Schadenstypen": `'destruction_spell'` = „Schaden eines Zaubers").
- **Hinweis:** Dieselbe Weiche blockiert vermutlich auch den Schaden von `'decay_spell'` (Forbidden Zone) – nicht getestet, gehört in die Gruppe der Karte.

### S01-04 · Divine Gift of Skill: „unless the user has at least Magic Arts 1" wird auf den GEWÄHLTEN Helden gelesen · Stufe B
- **Karten:** Divine Gift of Skill (`cards/effects/divine-gift-of-skill.js`), `engine.isHeroSkillLocked` (`_engine.js:43381`).
- **Voraussetzungen / Aufbau:** (A) Held 0 Magic Arts 1 (Nutzer), Held 1 Destruction Magic 1 ohne Magic Arts (gewählt). (B) Held 0 ohne Schule (Lv-0-Zauber, Nutzer), Held 1 Magic Arts 2 + Destruction Magic (gewählt).
- **Schritte:** Divine Gift of Skill mit Held 0 spielen und Held 1 wählen; `isHeroSkillLocked(0, 1)` bzw. Burning Finger mit Held 1.
- **Erwartet** (Kartentext: „That Hero cannot perform an Action for the rest of the turn unless **the user** has at least Magic Arts 1." – „the user" = der wirkende Held, vgl. Big Oopsie „If the user is an Ascended Hero"): (A) Held 1 nicht gesperrt, (B) Held 1 gesperrt.
- **Beobachtet:** Das Skript prüft die Magic-Arts-Stufe des **gesperrten** Helden (Kopfkommentar noch mit der alten Fassung „unless they have at least Magic Arts 1"): (A) Held 1 gesperrt (Burning Finger wird abgelehnt), (B) Held 1 frei.
- **Repro:** `docs/niche-tests/repro/S01-spells/04-divine-gift-of-skill-der-nutzer.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_engine.js:43381-43388` (`isHeroSkillLocked`) kennt den Nutzer nicht; `divine-gift-of-skill.js:123` stempelt nur `hero._skillLockTurn = gs.turn`. Die Magic-Arts-Stufe des Nutzers müsste beim Wirken festgehalten werden.
- **Restunsicherheit (daher B):** Falls die alte Fassung („they") gewollt war, ist der Kartentext zu ändern.

### S01-05 · Dance of the Flame Pillars: Vollflächen-Zweig trifft nur die Gegnerseite · Stufe A
- **Karten:** Dance of the Flame Pillars (`cards/effects/dance-of-the-flame-pillars.js`), Engine `aoeTargetPlayers` (`_engine.js:45462`).
- **Voraussetzungen / Aufbau:** je Seite 1 Held + 1 Kreatur (4 Ziele); Ablage Sitz 0: 5 Destruction-Magic-Zauber mit verschiedenen Namen (5 > 4).
- **Schritte:** 1. Dance of the Flame Pillars spielen.
- **Erwartet** (Kartentext: „If there are more different Destruction Magic Spells in your discard pile than targets on the board, deal 150 damage to **all targets** instead."; Skript-Kopf: „(both sides included)"): Alle 4 Ziele verlieren 150, auch der eigene Held und die eigene Kreatur.
- **Beobachtet:** Nur Gegner-Held (650) und Gegner-Kreatur (50) werden getroffen; der eigene Held bleibt bei 800, die eigene Kreatur unverletzt.
- **Repro:** `docs/niche-tests/repro/S01-spells/05-dance-of-the-flame-pillars-flaeche-nur-gegnerseite.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `dance-of-the-flame-pillars.js:118` übergibt `side: 'any'` an `ctx.aoeHit`; `aoeTargetPlayers` (`_engine.js:45462-45467`) kennt nur `'own'` / `'both'` / `'enemy'`, alles andere (auch `'any'`) fällt auf den Gegner zurück. Es ist die einzige Karte mit `side: 'any'` an `aoeHit` (alle 48 Aufrufer geprüft). Richtig wäre `'both'`.

### S01-06 · Dance of the Flame Pillars zählt Ausrüstung als „Ziel auf dem Brett" · Stufe B
- **Karten:** Dance of the Flame Pillars (`cards/effects/dance-of-the-flame-pillars.js:57`).
- **Voraussetzungen / Aufbau:** je Seite 1 Held und 1 Artefakt in der Support Zone (`ZZ Trinket`); Ablage Sitz 0: 3 Destruction-Magic-Zauber mit verschiedenen Namen (N = 3).
- **Schritte:** 1. Dance of the Flame Pillars spielen, in der Wahl alles anklicken, was angeboten wird.
- **Erwartet** (Kartentext: „…more different Destruction Magic Spells … than targets on the board → 150 to all targets"; Ziele der Karte sind Helden und Kreaturen – so auch die eigene Zielwahl `types: ['hero','creature']`): 2 Helden = 2 Ziele < 3 Zauber → Vollfläche, Gegner-Held 650.
- **Beobachtet:** Das Skript zählt 4 „Ziele" (2 Helden + 2 Artefakte), 3 ≤ 4 → Wahlmodus mit `minRequired: 3`, aber nur 2 wählbaren Helden; beide Helden verlieren nur 100 (700). Das Kommentar-Versprechen „hier unten stehen also immer mindestens N Ziele zur Verfügung" stimmt bei Ausrüstung/Anhängen nicht.
- **Repro:** `docs/niche-tests/repro/S01-spells/06-dance-of-the-flame-pillars-ausruestung-zaehlt-als-ziel.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `countAllValidTargets` zählt jede belegte Support Zone (`slot.length > 0`), nicht nur Kreaturen (Kartentyp prüfen wie in der Wahl).

### S01-07 · Anti Magic Zone: nach dem Wirken beschworene Kreaturen (und wiederbelebte Helden) sind nicht stillgelegt · Stufe B
- **Karten:** Anti Magic Zone (`cards/effects/anti-magic-zone.js`), Status `magic_silenced` (`_hooks.js` ~Z. 338-350).
- **Voraussetzungen / Aufbau:** Sitz 1 hat Kreatur (ZZ Dummy) und einen toten Held 2; Sitz 0 spielt Anti Magic Zone (Zug 5).
- **Schritte:** 1. Anti Magic Zone wirken. 2. `endTurn()`, Sitz 1 beschwört im Fenster eine weitere Kreatur. 3. Zusatz: Held 2 von Sitz 1 wird im Fenster wiederbelebt.
- **Erwartet** (Kartentext: „No target can use any Spells and the effects of **all** Creatures are negated until the end of your opponent's next turn."; Absicht im Code, `_hooks.js:349`: „New Creatures summoned during the AMZ window auto-receive the status (handled engine-side in `actionPlaceCreature`)"): Die im Fenster beschworene Kreatur ist ebenfalls negiert; ein wiederbelebter Held (neues „Ziel") darf keine Zauber wirken.
- **Beobachtet:** Die beim Wirken vorhandene Kreatur ist negiert (`isCreatureEffectSuppressed` = true), die neu beschworene **nicht**; der wiederbelebte Held hat keinen `magic_silenced`. Die Engine-Seite `actionPlaceCreature` kennt den Status nicht (kein Treffer für `magic_silenced` dort), und der Ablage-Haken `onCardEnterZone` des Skripts (`ctx.cardZone === 'discard'`, liest `ctx.card.counters._amzExpiresAtTurn`) ist tot: die Instanz des gespielten Zaubers wird nach der Auflösung entsorgt (`server.js` doPlaySpell ~Z. 8697 `_untrackCard`, ausgenommen `gs._spellKeepInstance`), die Zähler gehen damit verloren, und für Ablage-Karten ohne `discardEffect` legt `_ensureDiscardInstances` keine Instanz an.
- **Repro:** `docs/niche-tests/repro/S01-spells/07-anti-magic-zone-spaetere-kreatur.js` (✗ = Fehler tritt auf; der Held-Teil (C) ist die zweite Prüfung)
- **Vermutete Ursache:** `anti-magic-zone.js` (`onCardEnterZone`, Z. 228-250) – es fehlt `gs._spellKeepInstance = true` im `onPlay` (Vorbild: Weapon Unleashing) bzw. ein Fenster-Zustand auf dem Spieler/`gs` (`gs._amzWindow = {expiresAtTurn, expiresForPlayer}`), den `actionPlaceCreature`/`actionReviveHero` lesen.
- **Restunsicherheit (daher B, Held-Teil C):** Ob „all Creatures" auch später beschworene meint, ist vom Code selbst bejaht (Kommentar), nur nicht umgesetzt; beim wiederbelebten Helden nennt der Text kein Verhalten.

### S01-08 · Aurora Borealis: Abbruch der Zielwahl des ausgeführten Zaubers – die zwei anderen Zauber sind schon gelöscht · Stufe C
- **Karten:** Aurora Borealis (`cards/effects/aurora-borealis.js`).
- **Voraussetzungen / Aufbau:** Held 0 mit Magic Arts 3 + Destruction Magic 3; Deck: Fireball, Burning Finger, Boiling Oil u. a.
- **Schritte:** 1. Aurora Borealis, drei Zauber wählen (Fireball, Burning Finger, Boiling Oil). 2. „Delete 2 … to perform the third?" = ja, auszuführen: Fireball. 3. Die Zielwahl von Fireball mit „Abbrechen" beenden.
- **Erwartet** (Kartentext: „you may delete 2 of your chosen Spells to immediately perform the third one"; Regel 23.9 „Abbruch heißt: nichts ist passiert"): Wer die Ausführung abbricht, soll die beiden Zauber behalten (Lesart A) – oder die Kosten sind mit der Zusage bezahlt (Lesart B).
- **Beobachtet:** Lesart B. Das Skript löscht die zwei anderen Zauber **vor** `_castSpellImmediately`; nach dem Abbruch liegt nur noch Fireball auf der Hand, Burning Finger und Boiling Oil sind gelöscht, kein Schaden. (Wird die Ausführung nicht abgebrochen, ist alles in Ordnung: 2 gelöscht, der dritte wirkt als Zusatzaktion; Staffel 1/2/3 und die Ja/Nein-Frage ab Magic Arts 3 mit 3 gewählten Zaubern ✓.)
- **Repro:** `docs/niche-tests/repro/S01-spells/08-aurora-borealis-abbruch-nach-loeschen.js` (✗ = Lesart A wird nicht erfüllt)
- **Vermutete Ursache:** `aurora-borealis.js` (Schleife `loescheAusHand`, danach `_castSpellImmediately`).
- **Frage an Al:** Soll das Löschen der zwei Zauber ausbleiben, wenn der Spieler die Ausführung des dritten Zaubers (Zielwahl) abbricht (ja = Löschen erst nach erfolgreicher Zielwahl / nein = wie jetzt, Kosten bezahlt)?

### S01-09 · Flächenschlag „all targets your opponent controls" trifft eine vom Wirker kontrollierte (geliehene) Kreatur · Stufe B
- **Karten:** Boiling Oil (`cards/effects/boiling-oil.js`, `aoeHit({ side: 'enemy' })`); gleicher Weg für jede Karte mit `side: 'enemy'` (u. a. Butterfly Cloud, Flame Avalanche), Engine `collectAoeCreatureTargets` (`_engine.js` ~Z. 45511); Quelle der Leihkreatur z. B. Aligning Goals (`actionStealCreature`).
- **Voraussetzungen / Aufbau:** Sitz 1 besitzt eine Kreatur, die Sitz 0 sich geliehen hat (`actionStealCreature(0, inst)`, Besitzer 1 / Kontrolleur 0); Sitz 0 besitzt eine Kreatur, die Sitz 1 sich geliehen hat.
- **Schritte:** 1. Sitz 0 spielt Boiling Oil.
- **Erwartet** (Kartentext: „Deal 80 damage to all targets your **opponent controls**."; Ruling `CARD_API.md` ~Z. 6046-6090 (v718): Wer nach Seiten rechnet, fragt nie die Spalte; `collectAoeHeroTargets` lässt einen vom Wirker kontrollierten Helden aus dem Gegnerflächenschlag heraus): Die vom Wirker kontrollierte Kreatur bleibt unverletzt; die vom Gegner kontrollierte (dem Wirker gehörende) wird getroffen.
- **Beobachtet:** Beide verlieren 80. Die Kreatur, die Sitz 0 selbst kontrolliert, wird vom eigenen „Gegner"-Flächenschlag getroffen (und danach in die Ablage ihres Besitzers gelegt). Die Heldenvariante ist umgestellt, die Kreaturenvariante nicht.
- **Repro:** `docs/niche-tests/repro/S01-spells/09-boiling-oil-trifft-geliehene-kreatur.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_engine.js` `collectAoeCreatureTargets` (~Z. 45511-45528): `if ((inst.owner !== tpi && inst.controller !== tpi) …) continue;` – Besitzer **oder** Kontrolleur reichen. Folgefehler bei `side: 'both'` (Hole in the Sky, MOE Bomb, Divine Gift of Fire): eine Kreatur mit Besitzer ≠ Kontrolleur steht dort **doppelt** in der Zielliste (gemessen: `collectAoeCreatureTargets([0,1])` liefert sie zweimal; Hole in the Sky tötet sie trotzdem nur einmal, daher dort ohne sichtbare Folge). Richtig wäre das Kriterium `(inst.controller ?? inst.owner) === Seite`.
- **Verwandt (gemessen mit Divine Gift of Fire, „Choose a player. All targets that player controls are Burned"):** Gewählt Sitz 1 (`side: 'enemy'`): verbrannt wird auch die vom Wirker kontrollierte Leihkreatur (Besitzer 1) – falsch –; gewählt Sitz 0 (`side: 'own'`): verbrannt wird auch die dem Wirker gehörende, aber vom Gegner kontrollierte Kreatur – falsch. Eine Kreatur mit Besitzer ≠ Kontrolleur wird also in **beiden** Richtungen getroffen (Besitzer **oder** Kontrolleur reicht). Betrifft jede Karte mit `aoeHit` auf `enemy`/`own`/`both`.

### S01-10 · Calm Diatribe: die zweite Aktion des gewählten Helden wird im nächsten Zug nie eingerichtet · Stufe A
- **Karten:** Calm Diatribe (`cards/effects/calm-diatribe.js`).
- **Voraussetzungen / Aufbau:** Sitz 0, Held 0 wirkt Calm Diatribe auf Held 1 (Zug 5); danach zwei echte Zugwechsel (`t.endTurn()` ×2: Gegnerzug, dann wieder Sitz 0, Zug 7).
- **Schritte:** 1. Calm Diatribe wirken (Zusatzaktion ✓). 2. Zwei Zugwechsel. 3. In der Action Phase spielt Held 1 zwei Fireballs.
- **Erwartet** (Kartentext: „You may perform a second Action with that Hero during your Action Phase next turn."): Beide Fireballs sind spielbar; Held 1 trägt in diesem Zug `calm_ready`, danach verfällt es.
- **Beobachtet:** Nur der erste Fireball; der zweite wird abgelehnt. Held 1 behält dauerhaft den angekündigten Status `calm` (nie `calm_ready`), die Zusage (`registerAdditionalActionType`/`grantAdditionalAction`) wird nie angelegt. Mit einer im Test simulierten Korrektur (`ctx.playerIdx = ctx.activePlayer`) klappt es wie beschrieben: zweite Aktion ✓, dritte abgelehnt ✓, Status danach weg – die Diagnose ist damit gesichert.
- **Repro:** `docs/niche-tests/repro/S01-spells/10-calm-diatribe-zweite-aktion-nie-gewaehrt.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `calm-diatribe.js` `hooks.onTurnStart`: `if (ctx.playerIdx !== ctx.cardOwner || …) return;` – der Hook-Kontext von `onTurnStart` hat laut `CARD_API.md` Z. 2636 und `_engine.js:22753` (`runHooks(ON_TURN_START, { turn, activePlayer })`) kein `playerIdx` (= `undefined`); richtig wäre `ctx.activePlayer` bzw. `ctx.isMyTurn`. Weitere Skripte mit `ctx.playerIdx` stehen in anderen Hooks (nicht in `onTurnStart`) und sind nicht betroffen (Stichprobe: Forbidden Grimoire, Gældefaber, Karian, Idej Sword, Resistance).

### S01-11 · Call for Help und Aurora Borealis führen ein zweites „Divine Gift" aus (Einmal-pro-Spiel-Grenze umgangen) · Stufe A
- **Karten:** Call for Help (`cards/effects/call-for-help.js`), Aurora Borealis (`aurora-borealis.js`, Magic-Arts-3-Zweig), alle „Divine Gift of …" (hier: Fire), Engine `_castSpellImmediately` (`_engine.js` ~Z. 21713).
- **Voraussetzungen / Aufbau:** Sitz 0 hat `divineGift` schon gestempelt (Divine Gift of Skill normal gespielt, `_oncePerGameUsed = {divineGift}`); (a) Call for Help (eigene Kreatur diesen Zug besiegt), Deck enthält Divine Gift of Fire; (b) Aurora Borealis mit Magic Arts 3, drei gewählte Zauber inkl. Divine Gift of Fire.
- **Schritte:** (a) Call for Help spielen, im Angebot „Divine Gift of Fire" wählen. (b) Aurora Borealis spielen, Divine Gift of Fire + zwei weitere wählen, „delete 2 …" = ja, Divine Gift of Fire als auszuführenden Zauber wählen.
- **Erwartet** (Kartentext: „You can only activate 1 "Divine Gift" card per game."; derselbe Zauber wird im normalen Immediate-Pick `_resolveImmediateActionPick`, `_engine.js` ~Z. 19735 / 13184, wegen `oncePerGame` gar nicht angeboten): Das zweite Divine Gift wird nicht angeboten bzw. nicht gewirkt.
- **Beobachtet:** In beiden Fällen wird es angeboten und gewirkt: alle Gegner-Helden brennen („für den Rest des Spiels"). Der Stempel selbst wird vom Guss korrekt gesetzt (Gegenprobe: Call for Help → Divine Gift of Skill, danach lässt sich ein normales Divine Gift nicht mehr spielen) – es fehlt nur die **Prüfung** vor dem Guss.
- **Repro:** `docs/niche-tests/repro/S01-spells/11-zweites-divine-gift-ueber-call-for-help-und-aurora.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** Ruling `CARD_API.md` ~Z. 4553-4575: „Der Kern [`_castSpellImmediately`] prüft KEINE Level-/Schulanforderung … Sperren … prüft der Aufrufer selbst". `call-for-help.js` (`eligible`, Z. ~48; Prüfungen nach der Wahl) und `aurora-borealis.js` (`wirkbar`) prüfen `oncePerGame` nicht. Betrifft auch die anderen Einmal-pro-Spiel-Zauber der Stufe ≤ 2 (z. B. Eraser Beam, sofern Stufe ≤ 2 – nicht einzeln getestet) und `spellPlayCondition`/`canPlayWithHero` (siehe S01-12). Besser zentral: `oncePerGame`-Prüfung in `_castSpellImmediately` (Abbruch wie ein ablehnender `spellPlayCondition`).

### S01-12 · Call for Help bietet Zauber an, die nicht spielbar sind; die Wahl ist nicht abbrechbar, Call for Help verpufft · Stufe B
- **Karten:** Call for Help (`cards/effects/call-for-help.js`).
- **Voraussetzungen / Aufbau:** Eine eigene Kreatur wurde in diesem Zug besiegt; Deck: Detection („You can only play this card while your opponent controls 1+ Surprises."); der Gegner hat keine Surprise.
- **Schritte:** 1. Call for Help spielen. 2. Im Angebot Detection wählen.
- **Erwartet** (Kartentext: „Choose a level 2 or lower Spell … and play it immediately as an additional Action"; Vorbild: der Standard-Immediate-Pick filtert `spellPlayCondition`/`canPlayWithHero`/`oncePerGame`, `_engine.js` ~Z. 19700-19740): Unspielbare Zauber werden gar nicht erst angeboten (oder Call for Help bleibt erhalten).
- **Beobachtet:** Detection steht im Angebot; die Galerie ist `cancellable: false`; nach der Wahl bricht das Skript still ab (`spellPlayCondition` wird erst nach der Wahl geprüft), Call for Help liegt in der Ablage, Detection im Deck, kein Hinweis. Gleiche Folge, wenn der Spieler die Zielwahl des gewählten Zaubers abbricht (Burning Finger: Call for Help verbraucht, Zauber zurück ins Deck) – dieselbe Frage wie S01-08.
- **Repro:** `docs/niche-tests/repro/S01-spells/12-call-for-help-bietet-unspielbare-zauber.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `call-for-help.js` `eligible` (nur Level/Subtyp/HOPT) vs. Prüfungen nach der Wahl (`spellPlayCondition`, `canHeroPerformAction`, `supportSpellLocked`); `canPlayWithHero` und `oncePerGame` fehlen ganz.

### S01-13 · Chain Lightning: die Kettenwahl des Opfers wird serverseitig nicht geprüft (Heldenpflicht, Anzahl, Duplikate) · Stufe C
- **Karten:** Chain Lightning (`cards/effects/chain-lightning.js`, Wahl über `engine.promptChainTargets`, `_engine.js` ~Z. 10562).
- **Voraussetzungen / Aufbau:** Der Gegner (= Opfer, wählt selbst) hat 3 lebende Helden und 3 Kreaturen. Antworten per Skript wie ein veränderter Client: (b) nur die drei Kreaturen, (c) dasselbe Ziel dreimal, (e) nur ein Ziel.
- **Schritte:** 1. Chain Lightning spielen. 2. Opfer antwortet auf `chainTargetPick` mit der jeweiligen Auswahl.
- **Erwartet** (Kartentext: „Your opponent has to choose 3 targets they control consecutively (or as many targets as possible). … Your opponent always has to choose their undefeated Heroes first."): Die drei Helden werden getroffen (200/150/100), egal was der Client schickt.
- **Beobachtet:** Kontrolle (a) mit drei Helden korrekt (600/650/700), und auch die CPU-Standardantwort wählt regelkonform (3 Helden; bei einem lebenden Helden: Held + 2 Kreaturen). Aber: (b) nur Kreaturen gewählt → die Helden bleiben bei 800, die Kreaturen nehmen den Schaden; (c) dasselbe Ziel dreimal → ein Held verliert 450; (e) nur 1 Ziel → nur 200 Schaden. `promptChainTargets` gibt `result.selectedTargets` ungeprüft zurück, `heroesFirst` ist nur ein Hinweis an die Oberfläche (der Standard-Client erzwingt es in `public/dist/app-board.js`). Das Opfer hat damit mit einem veränderten Client einen Vorteil.
- **Repro:** `docs/niche-tests/repro/S01-spells/13-chain-lightning-wahl-ungeprueft.js` (✗ = Regel wird nicht erzwungen)
- **Vermutete Ursache:** `promptChainTargets` (kein Abgleich: Anzahl = min(3, Ziele), Heldenpflicht, Ids paarweise verschieden).
- **Frage an Al:** Soll der Server die Kettenwahl nachprüfen bzw. korrigieren (ja = Regel auch gegen veränderte Clients erzwingen / nein = Client wird vertraut)?

### S01-14 · Chaos Magic, die zu einem „Divine Gift" wird: kein Einmal-pro-Spiel-Stempel; die Zusatzaktion des Gifts entfällt · Stufe B (Zusatzaktion-Teil: C)
- **Karten:** Chaos Magic (`cards/effects/chaos-magic.js`), Divine Gift of Biseria (gefundener Zauber).
- **Voraussetzungen / Aufbau:** Sitz 0: Chaos Magic, Divine Gift of Skill, Fireball auf der Hand; Deck besteht nur aus Divine Gift of Biseria.
- **Schritte:** 1. Chaos Magic spielen (enthüllt Divine Gift of Biseria, friert den gewählten Helden ein). 2. Im selben Zug Divine Gift of Skill spielen. 3. (zweiter Lauf) statt 2.: Fireball als weitere Aktion.
- **Erwartet** (Kartentext Chaos Magic: „This Spell's name, level and effect become the revealed Spell's name, level and effect"; Divine Gift: „You can only activate 1 "Divine Gift" card per game. … This counts as an additional Action."): (a) Chaos Magic ist jetzt ein Divine Gift ⇒ `divineGift` gestempelt, ein weiteres Divine Gift ist nicht spielbar. (b) (Lesart, Stufe C) Auch „This counts as an additional Action" gehört zum übernommenen Effekt ⇒ der Fireball ist danach spielbar.
- **Beobachtet:** (a) `_oncePerGameUsed` bleibt leer, Divine Gift of Skill wirkt danach voll (4 Bonus-Anhänge) – zwei Gifts in einem Spiel. (b) Der Fireball wird abgelehnt (Chaos Magic verbraucht die Aktion; zur Kontrolle: Biseria normal gespielt ⇒ Fireball danach spielbar). Gegenprobe: Ist `divineGift` schon gestempelt, fizzelt Chaos Magic (Zauber wird gelöscht, kein Effekt) ✓. Ebenfalls ✓: 5 Nicht-Zauber ⇒ Hand abgeworfen, bereits gewirkte Zauber werden übersprungen (und mitgezählt), Wirken ohne Schule.
- **Repro:** `docs/niche-tests/repro/S01-spells/14-chaos-magic-wird-divine-gift.js` (✗ = Fehler tritt auf; zweite ✗-Zeile = Zusatzaktion-Teil)
- **Vermutete Ursache:** `chaos-magic.js` ruft `onPlay` des gefundenen Zaubers selbst auf (Z. ~120-135) statt `_castSpellImmediately` (der setzt den `oncePerGame`-Stempel, `_engine.js` ~Z. 21895) und wertet `inherentAction` des gefundenen Zaubers nicht aus.
- **Frage an Al (Teil b):** Soll bei Chaos Magic, die zu einem Zauber mit „This counts as an additional Action" wird, auch die Zusatzaktion gelten (ja / nein, nur die Wirkung)?

### S01-15 · Create Illusion: die Kreatur kommt in eine freie Zone eines beliebigen eigenen Helden, nicht des Nutzers · Stufe B
- **Karten:** Create Illusion (`cards/effects/create-illusion.js`).
- **Voraussetzungen / Aufbau:** Sitz 0: Held 0 (Nutzer, Magic Arts 1) hat alle 3 Support Zones belegt, Held 1 hat freie Zonen; Deck: Elven Archer (Lv 1).
- **Schritte:** 1. Create Illusion mit Held 0 wirken, Elven Archer wählen; in der Zonenwahl wird (auch) Held 1 angeboten.
- **Erwartet** (Kartentext: „…place it into a free Support Zone of **the user**."; „the user" = der wirkende Held, so auch Create Secret Room: „the user's Surprise Zone"): Nur freie Zonen des Nutzers; hat er keine, ist der Zauber nicht spielbar bzw. wird abgebrochen.
- **Beobachtet:** Der Zauber ist spielbar und die Illusion liegt bei Held 1. `spellPlayCondition` prüft „irgendein lebender Held hat eine freie Zone", `onPlay` sammelt `freeZones` über alle Helden der Seite (`for (let hi …)`) und bietet sie an.
- **Repro:** `docs/niche-tests/repro/S01-spells/15-create-illusion-zone-des-nutzers.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `create-illusion.js` `spellPlayCondition` und die Schleife über `ps.heroes` in `onPlay` (Z. ~85-95) müssten sich auf `ctx.cardHeroIdx` bzw. `heroIdx` des Nutzers beschränken.
- **Restunsicherheit (daher B):** Falls „the user" bewusst weit gelesen wird (jede eigene Zone), wäre der Kartentext zu ändern.

### S01-16 · Create Illusion: „your opponent may draw …" wird als Pflicht ausgeführt (Deck-Out-Niederlage) · Stufe C
- **Karten:** Create Illusion (`create-illusion.js`), Engine `_illusionenZurueck` (`_engine.js` ~Z. 26800-26845; gleicher Weg für Staff of Illusions).
- **Voraussetzungen / Aufbau:** Sitz 0 legt eine Level-1-Illusion (Elven Archer); Sitz 1 zieht zu Zugbeginn eine Karte, sein Deck wird dann geleert.
- **Schritte:** 1. Create Illusion. 2. Zwei Zugwechsel (Ende des Gegnerzugs: die Illusion geht ins Deck zurück).
- **Erwartet** (Kartentext: „…and if you do, your opponent **may** draw as many cards as the Creature's level."): Der Gegner darf ziehen, muss aber nicht – bei leerem Deck kann er verzichten.
- **Beobachtet:** `actionDrawCards(entry.opponent, entry.oppDrawCount)` läuft ohne Frage; der Gegner verliert sofort durch Deck-Out (Sieger Sitz 0, `deck_out`). Im Normalfall (Deck gefüllt) zieht er brav `level` Karten (gemessen: 1 bei Lv 1).
- **Repro:** `docs/niche-tests/repro/S01-spells/16-create-illusion-draw-pflicht.js` (✗ = Spiel endet durch Deck-Out)
- **Vermutete Ursache:** `_engine.js` `_illusionenZurueck` (`if (entry.oppDrawCount > 0 …) actionDrawCards`) kennt keine „may"-Frage (Ja/Nein an `entry.opponent`).
- **Frage an Al:** Soll der Gegner das Ziehen ablehnen dürfen (ja = Ja/Nein-Frage, wie „may" im Text / nein = Ziehen ist immer Vorteil und läuft automatisch)?

### S01-17 · Dangerous Knowledge: genau ein Kandidat wird ohne Zielschutz-Prüfung automatisch gewählt (Erstrunden-Immunität umgangen) · Stufe B
- **Karten:** Dangerous Knowledge (`cards/effects/dangerous-knowledge.js`, `onPlay`: `let ziel = ziele[0]; if (ziele.length > 1) { promptEffectTarget … }`).
- **Voraussetzungen / Aufbau:** Zug 1-Lage (`gs.firstTurnProtectedPlayer = 1`); Sitz 1 hat Barker, seine anderen Helden tragen Namen, die Sitz 0 schon führt (keine Kandidaten).
- **Schritte:** 1. Sitz 0 spielt Dangerous Knowledge mit Held 0.
- **Erwartet** (Regel `CARD_API.md` „Turn-1 Immunity": „every card belonging to the non-turn player is completely immune to anything the turn player can do"; Kartentext: „Choose a Hero your opponent controls …"): Der geschützte Held ist nicht wählbar, nichts wird gelernt, die Karte bleibt auf der Hand.
- **Beobachtet:** Kontrolle mit **zwei** Kandidaten: es öffnet sich keine Zielwahl (nichts wählbar), die Karte geht auf die Hand zurück ✓. Mit **genau einem** Kandidaten wird er ohne die zentrale Schutzprüfung gewählt: Sitz 0 lernt Barkers Heldeneffekte, die Karte ist verbraucht. (Gemessen auch: mit dem Butterfly-Cloud-Status auf dem einzigen Kandidaten ist das Ergebnis dasselbe wie über die Zielwahl, weil dessen Schutz nur „solange andere wählbare Helden da sind" gilt. Anderer Wahlschutz (Stealth …) und „is chosen"-Surprises sind auf diesem Weg **nicht getestet**, vermutlich ebenfalls umgangen, sofern sie erst in `promptEffectTarget` greifen.)
- **Repro:** `docs/niche-tests/repro/S01-spells/17-dangerous-knowledge-ein-kandidat-ohne-schutz.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `dangerous-knowledge.js` – die Einzelkandidaten-Abkürzung überspringt `promptEffectTarget` (und damit das Erstrunden-Gate). Zusätzlich fehlt in `kandidaten()` die Erstrunden-Prüfung für die Spielbarkeit (Vorbild: `compulsory-body-swap.js` `heldWaehlbar`: `gs.firstTurnProtectedPlayer === h.owner → false`).

### S01-18 · Detection zählt eine per Create Secret Room gelegte Nicht-Surprise-Karte als „Surprise" · Stufe C
- **Karten:** Detection (`cards/effects/detection.js`, `_getOppSurprises`), Create Secret Room (`_secret-room-shared.js`).
- **Voraussetzungen / Aufbau:** Sitz 1 legt per Create Secret Room einen **Fireball** (kein Surprise) verdeckt in die Surprise Zone seines Helden 0; keine echte Surprise. Sitz 0 spielt Detection.
- **Schritte:** 1. Create Secret Room (Sitz 1). 2. Detection (Sitz 0).
- **Erwartet** (Kartentext Detection: „Remove all **Surprises** your opponent controls … draw 2 cards for every Surprise removed … You can only play this card while your opponent controls 1+ Surprises."; Create Secret Room erlaubt jede Karte): Lesart A – ein Fireball ist keine Surprise; Detection ist nicht spielbar bzw. entfernt/zieht nichts. Lesart B – alles in der Surprise Zone zählt.
- **Beobachtet:** Lesart B. Detection ist spielbar, legt den Fireball in die Ablage von Sitz 1 und Sitz 0 zieht 2 Karten. Die erste Schleife von `_getOppSurprises` nimmt jeden Eintrag von `_getAllSurpriseEntries` ohne Subtyp-Prüfung (die zweite Schleife über die Support Zones prüft `subtype === 'surprise'`).
- **Repro:** `docs/niche-tests/repro/S01-spells/18-detection-secret-room-karte.js` (✗ = Lesart A wird nicht erfüllt)
- **Vermutete Ursache:** `detection.js:_getOppSurprises` (Zeilen der ersten `for … _getAllSurpriseEntries`-Schleife, ohne `cardDB[cardName].subtype`-Prüfung).
- **Frage an Al:** Soll eine per Create Secret Room verdeckt in die Surprise Zone gelegte Nicht-Surprise-Karte für Detection als „Surprise" gelten (ja = entfernen + 2 Karten ziehen / nein = nur echte Surprises)?

### S01-19 · Divine Gift of Creation: die Sperre „cannot use those cards" gilt nicht für Equipment, Surprises und Abilities · Stufe B
- **Karten:** Divine Gift of Creation (`cards/effects/divine-gift-of-creation.js`, Sperre `ps._creationLockedNames`); Verbraucher in `_engine.js` ~Z. 20698 (`validateActionPlay`: Zauber/Attacks/Kreaturen), `server.js` ~Z. 11863 (`doUsePotion`) und ~Z. 12058 (`doUseArtifactEffect`).
- **Voraussetzungen / Aufbau:** Sitz 0 hat das Gift und je eine Kopie der Testkarte auf der Hand; das Gift holt (Testkarte, Zweitkarte) aus dem Deck – beide Namen stehen in `_creationLockedNames`. Getestet: Burning Finger (Zauber), Elven Archer (Kreatur), Club of Gobbo (Equipment), Magic Mirror (Surprise), Toughness (Ability).
- **Schritte:** 1. Divine Gift of Creation, zwei Karten wählen. 2. Im selben Zug eine Kopie einer der gewählten Karten spielen.
- **Erwartet** (Kartentext: „If you choose 2 cards, you cannot use those cards or cards with the same names for the rest of the turn."): Keine Kopie ist in diesem Zug spielbar, gleich welcher Kartentyp.
- **Beobachtet:** Zauber und Kreatur werden abgelehnt ✓ (Kontrolle), Trank und Artefakt-Effekt prüfen die Sperre laut Quelltext (nicht getestet); aber **Club of Gobbo (Equipment), Magic Mirror (Surprise) und Toughness (Ability) lassen sich trotz Sperre spielen** (`doPlay…` liefert `true`, Karte liegt auf dem Brett). Damit entfällt der Preis des Gifts („zwei Karten holen, aber nicht benutzen") für Ausrüstung, Surprises und Abilities.
- **Repro:** `docs/niche-tests/repro/S01-spells/19-divine-gift-of-creation-sperre-luecken.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `doPlayArtifact` (server.js ~Z. 7448, Equipment), `doPlaySurprise` und `doPlayAbility` prüfen `_creationLockedNames` nicht (keine Prüfung über Basisnamen in diesen Pfaden; `grep _creationLockedNames` findet nur die drei oben genannten Stellen).

### S01-20 · Stufen-Zauber zählen Xals Ability-Stapel in den Support Zones nicht (Divine Gift of Death, Create Illusion) · Stufe B
- **Karten:** Divine Gift of Death (`cards/effects/divine-gift-of-death.js`, `supportMagicLevelOfHero`), Create Illusion (`create-illusion.js`, `countAbilitiesForSchool(… abilityZones[heroIdx])`), Hero Xal, the Animated Armor (Support-Zonen-Abilities, `engine.heroSupportAbilityStacks`).
- **Voraussetzungen / Aufbau:** Xal als Held 0 von Sitz 0; Support Magic ×3 (bzw. Magic Arts ×3) liegen als Stapel in Xals erster Support Zone, die Ability-Zonen sind leer. Vergleich: dieselben Karten in der Ability-Zone. Death: zwei gefallene eigene Helden; Create Illusion: Deck mit Elven Archer (Lv 1) und Field Cannon (Lv 3).
- **Schritte:** 1. Divine Gift of Death bzw. Create Illusion mit Xal wirken (`noGrant`).
- **Erwartet** (Kartentext: „Choose up to 1/2/3 defeated Heroes …" / „Choose a level 1/2/3 or lower Creature …"; Xal: „You may place Abilities into the Support Zones of this Hero." – diese Stapel zählen für den Level-Vertrag `heroMeetsLevelReq` und `effectiveSchoolLevelForCaster` (3), `_engine.js` ~Z. 43140/43290): Death erweckt beide Helden, Create Illusion bietet Level-3-Kreaturen an.
- **Beobachtet:** In der Ability-Zone ✓ (2 Helden erweckt; Level-3-Angebot). In Xals Support Zone: `heroMeetsLevelReq` und `effectiveSchoolLevelForCaster` sehen Stufe 3 und lassen den Zauber zu, aber Death rechnet `maxPicks = 0` und bricht ab (Karte zurück auf die Hand, kein Held erweckt); Create Illusion bietet nur Level-1-Kreaturen an.
- **Repro:** `docs/niche-tests/repro/S01-spells/20-xal-support-zonen-abilities-staffel.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** Beide Skripte zählen direkt `engine.countAbilitiesForSchool(school, ps.abilityZones[heroIdx])`; richtig wäre `engine.effectiveSchoolLevelForCaster(school, pi, heroIdx, heroOwner)` (Vorbild: `aurora-borealis.js`), das Xals Stapel (`heroSupportAbilityStacks`) und `_castSchoolOverride` einrechnet. Dasselbe Muster steht laut `grep` in ca. 40 weiteren Skripten (nicht geprüft); aus meiner Gruppe zusätzlich `divine-gift-of-sacrifice.js` (s. dort).

### S01-21 · Divine Gift of Death: die Zusatzaktion wird auch gewährt, wenn nur EIN Held erweckt wird · Stufe B
- **Karten:** Divine Gift of Death (`cards/effects/divine-gift-of-death.js`, `inherentAction`-Funktion).
- **Voraussetzungen / Aufbau:** Held 0 mit Support Magic 2 (+ Destruction Magic 1), zwei gefallene eigene Helden, Action Phase. Der Spieler wählt nur **einen** Helden.
- **Schritte:** 1. Divine Gift of Death wirken, einen Helden wählen. 2. Im selben Zug Burning Finger spielen (`keepActions`).
- **Erwartet** (Kartentext: „If at least 2 Heroes are revived by this effect, this counts as an additional Action."): Nur 1 erweckt ⇒ der Zauber verbraucht die Aktion, der zweite Zauber ist nicht spielbar.
- **Beobachtet:** Der Burning Finger ist spielbar. `inherentAction(gs, pi, heroIdx, engine)` wertet **vor** der Wahl aus („≥ 2 gefallene Helden gibt es und Support Magic ≥ 2") – nicht die tatsächliche Zahl der Erweckten. Kontrolle: 2 erweckt ⇒ zweite Aktion ✓; Support Magic 1 ⇒ keine Zusatzaktion ✓. Ruling `CARD_API.md` Z. 8267 bestätigt nur, dass die Zusatzaktion eine Bedingung ist („dort hängt die Zusatzaktion an einer Bedingung"), nicht dass sie an die Absicht statt an das Ergebnis geknüpft sein soll.
- **Repro:** `docs/niche-tests/repro/S01-spells/21-divine-gift-of-death-zusatzaktion-bei-einem-held.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `inherentAction` kann die Wahl nicht kennen; nötig wäre eine nachträgliche Aktionsgutschrift/-belastung nach dem Erwecken (Vorbild für nachträgliche Zusatzaktionen: `gs._spellFreeAction`/`afterSpellResolved`-Gutschrift anderer Karten – nicht geprüft) oder die Mindestwahl 2 in der Action Phase wie im Main-Phase-Zweig des Skripts (`minRequired`).

### S01-22 · Die Antwort einer Zielwahl wird serverseitig nicht auf `maxTotal` geprüft (Beispiel Divine Gift of Death) · Stufe C
- **Karten:** Divine Gift of Death (`divine-gift-of-death.js`: `for (const id of picked)` ohne Kappung); die Lücke liegt im Weg `doConfirmPotion` → `engine.resolveEffectPrompt` (`server.js` ~Z. 11210-11240, `_engine.js` ~Z. 28931) und betrifft jede Karte, die der Zielwahl-Antwort traut (gleiche Wurzel wie S01-13).
- **Voraussetzungen / Aufbau:** Held 0 mit Support Magic 1 (⇒ `maxTotal: 1`), zwei gefallene eigene Helden; die Antwort (wie von einem veränderten Client) enthält beide Ids.
- **Schritte:** 1. Divine Gift of Death wirken, beide Ids übermitteln.
- **Erwartet** (Kartentext: „Choose up to 1/2/3 defeated Heroes"): höchstens 1 Held (Stufe 1).
- **Beobachtet:** Beide Helden werden erweckt. Serverseitig wird nur `ineligible` geprüft (Kommentar „autoritativer Flaschenhals", v915), nicht `maxTotal`/`minRequired`.
- **Repro:** `docs/niche-tests/repro/S01-spells/22-zielwahl-maxtotal-ungeprueft.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** siehe oben; Abhilfe zentral (Anzahl gegen `config.maxTotal`/`minRequired` prüfen) oder je Karte `picked.slice(0, maxPicks)`.
- **Frage an Al:** Soll der Server die Anzahl der Zielwahl-Antworten nachprüfen (ja = `maxTotal`/`minRequired` zentral erzwingen / nein = der Client wird vertraut, wie bisher)?

### S01-23 · Divine Gift of Forgetting wertet „Heroes they control" nach Spalte statt nach Kontrolle aus · Stufe B
- **Karten:** Divine Gift of Forgetting (`cards/effects/divine-gift-of-forgetting.js`, `collectRemovableAbilities`).
- **Voraussetzungen / Aufbau:** Sitz 1 hat Abilities an Held 0 und Held 1; Sitz 0 kontrolliert Held 1 von Sitz 1 (Charme, `actionStealHero(0, 1, 1)`); Sitz 1 kontrolliert Held 2 von Sitz 0 (`actionStealHero(1, 0, 2)`), der ebenfalls Abilities trägt.
- **Schritte:** 1. Sitz 0 spielt Divine Gift of Forgetting.
- **Erwartet** (Kartentext: „Your opponent shuffles all Abilities attached to Heroes **they control** back into their deck, except Starting Abilities."; Ruling `CARD_API.md` ~Z. 6046-6090, v718: „Wer nach Seiten rechnet, fragt nie die Spalte"): Betroffen sind Held (1,0) und der vom Gegner kontrollierte Held (0,2); Held (1,1), den der Wirker kontrolliert, behält seine Abilities.
- **Beobachtet:** Held (1,0) ✓, aber Held (1,1) verliert seine Abilities (Spalte des Gegners), Held (0,2) behält sie (Spalte des Wirkers). Offen (daher nicht in der Prüfung): in welches Deck die Abilities eines kontrollierten fremden Helden gehören (Besitzer oder Kontrolleur) – „back into their deck" sagt dazu nichts.
- **Repro:** `docs/niche-tests/repro/S01-spells/23-divine-gift-of-forgetting-kontrolle-statt-spalte.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `collectRemovableAbilities` iteriert `ps.heroes` der Gegnerspalte (`inst.owner === playerIdx`); richtig wäre `engine.heroesControlledBy(oi)` (Held-Seite `heroSideOf`).
- **Gemessen und in Ordnung:** Starting Abilities bleiben, der Rest (auch Stapel) geht ins Deck und wird gemischt; Toughness-Abgang reduziert die Max-HP über `onCardLeaveZone`.

### S01-24 · Divine Gift of Magic: die Stufensenkung gilt für alle Kopien des Namens, nicht nur für den offenbarten Zauber · Stufe C
- **Karten:** Divine Gift of Magic (`cards/effects/divine-gift-of-magic.js`, Speicher `ps._magicLevelReductions` nach Name; Verbraucher `_applyCardLevelReductions`, `_engine.js` ~Z. 43962-43972).
- **Voraussetzungen / Aufbau:** Held 0 mit Magic Arts 1, ohne Destruction Magic; Hand: Divine Gift of Magic, Fireball (Lv 2) ×2.
- **Schritte:** 1. Das Gift offenbart die erste Fireball-Kopie. 2. Beide Fireballs werden nacheinander gespielt (zweiter mit frischer Aktion, damit nur die Stufe entscheidet).
- **Erwartet** (Kartentext: „Reveal **a Spell** from your hand. Until the end of this turn, **that Spell's** level in your hand is reduced by 3."): Lesart A – nur die offenbarte Kopie ist gesenkt, die zweite bleibt Stufe 2 (mangels Destruction Magic nicht spielbar). Lesart B – die Senkung hängt am Namen.
- **Beobachtet:** Lesart B. Beide Kopien sind auf Stufe 0 und spielbar; die Senkung gilt nach Namen auch für später gezogene Kopien und für Ablage-/Deck-Auswertungen (`effectiveCardLevel(…, { pileSide: true })` = 0). Die Engine kennt einen Kopie-genauen Weg (`ps._handLevelOffsets[handIdx]`, registriert `_engine.js` ~Z. 790).
- **Repro:** `docs/niche-tests/repro/S01-spells/24-divine-gift-of-magic-alle-kopien.js` (✗ = Lesart A wird nicht erfüllt)
- **Vermutete Ursache:** `divine-gift-of-magic.js` schreibt `{ cardName, amount }` statt eines Handpositions-Eintrags.
- **Frage an Al:** Soll die Senkung nur die eine offenbarte Kopie betreffen (ja = Kopie-genau / nein = alle Kopien des Namens in der Hand wie bisher)?

## Abdeckung
(wird am Ende ergänzt)

## Getestet & in Ordnung (Auswahl)
(wird am Ende ergänzt)
