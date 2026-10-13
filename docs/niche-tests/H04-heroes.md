# H04-heroes – Nischenfall-Bericht
Stand/Autor: Agent H04-heroes, 12.10.2026. Karten: 35 in der Liste · 0 gezielt getestet (L2) · 1 mit Befund (Zwischenstand, wird fortlaufend ergänzt).

## Zusammenfassung
(wird am Ende ergänzt)

## Befunde
### H04-01 · Sol Rym: Zusatzaktionen zählen nicht gegen „never more than 1 Action per turn" · Stufe A
- **Karten:** Sol Rym, the Thunder Djinn (`cards/effects/sol-rym-the-thunder-djinn.js`); Vorbild der Gegenlösung: Friedhelm, the Misled Avenger (`friedhelm-the-misled-avenger.js`, Hook `onAnyActionResolved`); Auslöser im Test: Coffee (`coffee.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Sitz 0: Held 0 = Sol Rym (`onGameStart` gefeuert → `_maxActionsPerTurn = 1`), alter Negativstatus (Poison, `appliedTurn` 0) auf Sol Rym; Hand: Coffee, 2× Chain Lightning.
- **Schritte:** 1. Coffee auf Sol Rym spielen, Poison entfernen → Zusatzaktion: Chain Lightning mit Sol Rym. 2. Danach in der Action Phase regulär ein zweites Chain Lightning mit Sol Rym spielen.
- **Erwartet** (Kartentext „This Hero can never perform more than 1 Action per turn"; Ruling CARD_API.md, Abschnitt Friedhelm: „Zusatzaktionen zählen mit … `_actionsThisTurn` wird in `server.js` aber nur bei regulären Zügen erhöht; zusätzliche und inhärente Aktionen … liefen daran vorbei"): Nach der Coffee-Zusatzaktion ist Sol Rym für den Rest des Zuges gesperrt; das zweite Chain Lightning wird abgelehnt.
- **Beobachtet:** `_actionsThisTurn` bleibt nach der Zusatzaktion 0, das zweite Chain Lightning wird angenommen und gewirkt (2 Aktionen von Sol Rym in einem Zug). Die umgekehrte Reihenfolge (erst regulär, dann Quick Attack/Zusatzaktion) ist gesperrt ✓ – nur „Zusatzaktion zuerst" rutscht durch.
- **Repro:** `docs/niche-tests/repro/H04-heroes/01-sol-rym-zusatzaktion-zaehlt-nicht.js` (`node docs/niche-tests/repro/H04-heroes/01-sol-rym-zusatzaktion-zaehlt-nicht.js`; ✗ = Fehler tritt auf)
- **Vermutete Ursache:** `sol-rym-the-thunder-djinn.js` setzt nur `hero._maxActionsPerTurn = 1`; `server.js:8369/8537/10208` zählen `_actionsThisTurn` nur in `doPlaySpell`/`doPlayCreature`. Der Friedhelm-Fix (`onAnyActionResolved` setzt `_actionsThisTurn` ≥ 1) fehlt bei Sol Rym.

### H04-02 · Negierte Helden behalten ihren Level-/Schul-Bypass (Sol Rym, Sorin, Tsu'Ki) · Stufe B
- **Karten:** Sol Rym, the Thunder Djinn (`sol-rym-the-thunder-djinn.js`), Sorin, the Warden of Blood Rock (`sorin-the-warden-of-blood-rock.js`), Tsu'Ki, the Lunatic Princess (`tsu-ki-the-lunatic-princess.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Held 0 = einer der drei, alle Ability-Zonen geleert (nackt), `onGameStart` gefeuert, `statuses.negated` gesetzt; Hand: Chain Lightning / Quick Attack / Lunatic Golem.
- **Schritte:** 1. Karte über den echten Spielweg (`doPlaySpell` bzw. `doPlayCreature`) mit dem negierten Helden spielen. 2. Kontrolle: derselbe Aufbau ohne Negation.
- **Erwartet** (Kartentext „This Hero can use … regardless of their level"; Engine-Regel: Negated/Frozen/Stunned schalten Heldeneffekte stumm – `runHooks`/`_isHeroEffectSilenced`; Tempeste-Ruling in `tempeste-the-weather-fairy.js`: „NUR solange sie nicht Frozen, Stunned oder Negated … ist"; `heroMeetsLevelReq` blankt bei harter Negation die Ability-Zonen): Der negierte Held verliert den Bypass; die Karte ist ohne Schule nicht spielbar.
- **Beobachtet:** In allen drei Fällen wird die Karte gespielt (Chain Lightning gewirkt, Quick Attack gespielt, Lunatic Golem beschworen). Nur Hook-basierte Heldenpassive (z. B. Sorins Verpuffen gegen nicht blutende Ziele, Tazune, Tempeste) werden bei Negation stumm; die Vertrags-Passive (`canBypassLevelReqForCard`, `levelOverrideCards`) nicht. Sol Rym behält bei Negation außerdem sein Aktionslimit (`_maxActionsPerTurn`), Sorin verliert dagegen die Verpuff-Klausel – der Nachteil fällt weg, der Vorteil bleibt.
- **Repro:** `docs/niche-tests/repro/H04-heroes/02-negierte-helden-behalten-stufenbypass.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_engine.js` `_testLevelReqForZones` (ca. Z. 43819): `heroScript.canBypassLevelReqForCard(...)` wird ohne `_isHeroEffectSilenced(pi, heroIdx)`-Prüfung gefragt; `hero.levelOverrideCards` (Sol Rym, per `onGameStart` gesetzt) ebenso.

### H04-03 · Toras / Taio the Sun Fencer: ATK-Bonus der Ausrüstung überlebt Heldentod und Wiederbelebung · Stufe A
- **Karten:** Toras, Master of all Weapons (`toras-master-of-all-weapons.js`), Taio, the Sun Fencer (`taio-the-sun-fencer.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Held 0 = Toras (ATK 120) bzw. Taio (ATK 80), `onGameStart` gefeuert; zwei Ausrüstungen (Glass Sword, Truth-Seeing Eye) über `doPlayArtifact` angelegt.
- **Schritte:** 1. Held tödlich treffen (`actionDealDamage` 5000). 2. `actionReviveHero(0, 0, 300)`. 3. ATK lesen; danach ein neues Artefakt ausrüsten.
- **Erwartet** (Kartentext Toras „increased by 40 for each Artifact with a different name equipped to it"; Taio „increased by 20 for every Artifact equipped to it"): Die Ausrüstung ist mit dem Tod abgeworfen; der wiederbelebte Held hat seine gedruckte ATK (120 / 80), neue Ausrüstung zählt ab null (160 / 100).
- **Beobachtet:** Toras bleibt auf 200 (statt 120) bis wieder Ausrüstung kommt/geht (dann springt er auf 160). Taio bleibt auf 120 (statt 80), ein neues Artefakt addiert obendrauf → 140 (statt 100); jeder Tod-Wiederbelebung-Zyklus mit Ausrüstung hinterlässt dauerhaft +20 je Artefakt.
- **Repro:** `docs/niche-tests/repro/H04-heroes/03-toras-taio-atk-bonus-ueberlebt-tod.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `handleHeroDeathCleanup` (`_engine.js` ca. Z. 9640–9700) feuert `onCardLeaveZone` mit `_onlyCard` = ausscheidende Karte, nicht an Toras/Taio; `actionReviveHero` setzt `hero.atk` nie zurück. Toras' eigener Aufräum-Hook `onHeroKO` liest `ctx.deadHero` (Feld existiert nicht, der Hook liefert `ctx.hero`) → läuft nie; der Kommentar „hero.atk resets on KO anyway" stimmt nicht. Taios `_taioAtkGranted` liegt auf der abgeworfenen (gelöschten) Instanz und wird nie mehr revoziert.

### H04-04 · Xiong: Galerie blendet alle gleichnamigen Karten der Ablagen aus, auch schon abgelegte Kopien · Stufe B
- **Karten:** Xiong, the Bamboo Guardian (`xiong-the-bamboo-guardian.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Held 0 = Xiong; Hand: Attack; eigene Ablage: Attack, Fireball; Gegner-Ablage: Icebolt; Gegner hat eine 10-HP-Kreatur (Support 0).
- **Schritte:** 1. Xiong spielt „Attack" auf die Kreatur → sie wird besiegt. 2. Xiongs Galerie „choose a card from either player's discard pile" lesen.
- **Erwartet** (Kartentext „choose a card from either player's discard pile and add it to your hand"): Die gerade aufgelöste Attack liegt noch nicht in der Ablage; die zweite, schon abgelegte Kopie „Attack" ist eine Ablagekarte und wird angeboten (wie Fireball und Icebolt).
- **Beobachtet:** Angeboten werden Fireball, Icebolt und die besiegte Kreatur – „Attack" fehlt. Das Skript schließt per NAME (`_resolvingCard.name`) jede Karte dieses Namens aus beiden Ablagen aus. Liegt keine andere Karte in den Ablagen, bleibt die Galerie ganz leer (X2: nur „Icebolt").
- **Repro:** `docs/niche-tests/repro/H04-heroes/04-xiong-schliesst-gleichnamige-kopie-aus.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `xiong-the-bamboo-guardian.js` `tryTutor`: `exclude.add(resolving)` + `if (exclude.has(name)) continue;` über beide Ablagen; die Attack ist zu dem Zeitpunkt noch nicht in der Ablage, der Ausschluss trifft also nur echte andere Kopien.

### H04-05 · Saya: Zweitguss ignoriert „once per game"-Klauseln (Divine Gift, Guard Duty) · Stufe C
- **Karten:** Saya, the Plant Princess (`saya-the-plant-princess.js`), Divine Gift of Creation (`divine-gift-of-creation.js`, `oncePerGame`), Guard Duty
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Held 0 = Saya mit Support Magic 2; Hand: Divine Gift of Creation (Lv 1, Support Magic, Normal); Deck mit sieben verschiedenen Karten.
- **Schritte:** 1. Divine Gift of Creation spielen, 2 Karten suchen. 2. Sayas Rückfrage „Cast … a second time?" mit Ja beantworten.
- **Erwartet** (Kartentext Saya „cast it a second time"; Divine Gift „You can only activate 1 "Divine Gift" card per game", Guard Duty „You can only play 1 "Guard Duty" per game"; Ruling CARD_API v1277 „Ein Zweitguss ist kein neues Ausspielen."): Mehrere Lesarten – (a) der Zweitguss ist kein neues Ausspielen, die Einmal-Klausel greift nicht (Ist-Zustand), oder (b) „activate" bzw. „play" gilt auch für den Zweitguss, er entfällt.
- **Beobachtet:** Der Zweitguss läuft voll: zweite Suche (zwei weitere Karten möglich), bei Guard Duty zweite Mischfrage. Der Stempel `_oncePerGameUsed` wird nur beim ersten Ausspielen gesetzt.
- **Repro:** `docs/niche-tests/repro/H04-heroes/05-saya-zweitguss-ignoriert-einmalklauseln.js` (✗ = Ist-Zustand „Zweitguss läuft")
- **Vermutete Ursache:** `saya-the-plant-princess.js` prüft nur `supportSpellLocked`/Aktionssperre, nicht `oncePerGame`/Zugklauseln des Zaubers.
- **Frage an Al:** Soll Sayas Zweitguss bei Zaubern mit „once per game"-Klausel (Divine Gift of Creation/Death/…, Guard Duty) erlaubt sein (Ist-Zustand) oder entfallen? Ein Wort: „erlaubt" oder „entfällt".

### H04-06 · Silent Water Mizune: „Hero that could activate it" zählt auch bei gefrorenem/betäubtem Träger · Stufe C
- **Karten:** Silent Water Mizune (`silent-water-mizune.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Held 0 = Mizune; Held 1 mit Decay Magic 1 trägt verdeckt „Toxic Trap" (Lv 1 Decay-Surprise) in der Surprise Zone; Deck 20 Karten.
- **Schritte:** 1. Mizunes Heldeneffekt aktivieren, Toxic Trap wählen. 2. Gezogene Karten zählen; Wiederholung mit Träger frozen / stunned / negated.
- **Erwartet** (Kartentext „If the Surprise was in the Surprise or Support Zone of a Hero that could activate it, draw another card"; Engine-Definition von „kann aktivieren": `_canHeroActivateSurprise` – lebt, nicht Frozen/Stunned/Webbed/Negated, Schule/Stufe): Zwei Lesarten – (a) nur Schule/Stufe zählen (Ist-Zustand), (b) der Träger muss die Surprise jetzt tatsächlich auslösen können; dann 1 Karte bei gefrorenem/betäubtem Träger.
- **Beobachtet:** Gesunder Träger 2 Karten ✓; negierter Träger 1 Karte (zufällig, weil `heroMeetsLevelReq` bei harter Negation die Schulen blankt); gefrorener und betäubter Träger je 2 Karten, obwohl `_canHeroActivateSurprise` = false. Toter Träger 1 Karte.
- **Repro:** `docs/niche-tests/repro/H04-heroes/06-mizune-bonuskarte-fuer-gefrorenen-traeger.js` (✗ = Ist-Zustand)
- **Vermutete Ursache:** `silent-water-mizune.js` Bonus-Block prüft `engine.heroMeetsLevelReq(heroOwner, heroIdx, cardData)` statt `_canHeroActivateSurprise`; Stufe-0-Surprises ohne Schule geben den Bonus ohne jede Prüfung.
- **Frage an Al:** Soll der Bonus „Hero that could activate it" nur Schule/Stufe prüfen (Ist) oder auch Frozen/Stunned/Negated des Trägers berücksichtigen? Ein Wort: „nur Schule" oder „auch Zustand".

### H04-07 · Sas'Za: eine eigene Token-Kreatur wird „back to your hand" geholt · Stufe A
- **Karten:** Sas'Za, the Snaka Adventurer (`sas-za-the-snaka-adventurer.js`); Token: Mummy Token
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Held 0 = Sas'Za; Mummy Token (Creature/Token, 50 HP) in Support 0 von Held 1; Gegner (Sitz 1) am Zug.
- **Schritte:** 1. Gegner besiegt den Token (`actionDealCreatureDamage` Typ spell, 999). 2. Sas'Zas Rückfrage „Add Mummy Token back to your hand?" mit Ja beantworten.
- **Erwartet** (Kartentext „add your Creatures that are defeated by an opponent's card or effect back to your hand"; Engine/CARD_API: Tokens sind keine Karten und gehen nie in Hand/Ablage/Deck, sondern in den Gelöscht-Stapel – `_kreaturTodAbwickeln`): Keine Rückfrage für den Token; er wird gelöscht.
- **Beobachtet:** Die Rückfrage erscheint, nach „Ja" liegt „Mummy Token" als Handkarte in der Hand von Sitz 0 (Zähler: Token verschwindet vom Brett, +1 in der Hand, nichts im Gelöscht-Stapel). Sas'Za-Spieler hätte damit eine Token-Karte auf der Hand.
- **Repro:** `docs/niche-tests/repro/H04-heroes/07-sas-za-token-landet-auf-der-hand.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `sas-za-the-snaka-adventurer.js` `onCreatureDeathClaim` filtert Tokens nicht (kein `hasCardType(cd,'Token')`-Ausschluss); `_redeemDeathClaim` (`_engine.js` ca. Z. 12719) schiebt `claim.name` ungeprüft in `hand`.

### H04-08 · Willy: Handlimit-Bypass endet schon mit Zug 1 statt „until the start of your second turn" · Stufe B
- **Karten:** Willy, the Valiant Leprechaun (`willy-the-valiant-leprechaun.js`), Engine `_shouldBypassHandLimit` (`_engine.js` ca. Z. 28897)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 1, Sitz 0 beginnt, Held 0 = Willy; eigener Pollution Token (`handLimitReduction` 2, reaktives Limit 5) auf dem Brett; Hand 5 Karten.
- **Schritte:** 1. Zug 1 echt beenden (`t.endTurn()`), Willy: „Draw 5 Cards" → Hand 10, kein Abwurf. 2. In Zug 2 (Gegnerrunde) lässt ein Gegnereffekt Sitz 0 eine Karte ziehen (`actionDrawCards`).
- **Erwartet** (Kartentext „You do not have a hand size limit until the start of your second turn"): Der Bypass hält über die Gegnerrunde (Zug 2) bis zum Beginn von Zug 3; kein Zwangsabwurf.
- **Beobachtet:** `_noHandLimitUntilTurn = 1`, `_shouldBypassHandLimit` prüft `gs.turn <= 1` → in Zug 2 gibt es keinen Bypass mehr; das reaktive Pollution-Limit erzwingt sechsmal „forceDiscard" (Hand 10 → 5, 6 Karten gelöscht). Ohne reaktive Limits (Pollution Token, Royal-Corgi-Gegenstück) ist der Fehler unsichtbar, weil das normale Handlimit nur am Ende des EIGENEN Zuges geprüft wird.
- **Repro:** `docs/niche-tests/repro/H04-heroes/08-willy-handlimit-endet-zu-frueh.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `willy-the-valiant-leprechaun.js` `onGameStart`: `ps._noHandLimitUntilTurn = firstTurn`; die Grenze müsste `firstTurn + 1` sein (der Zug vor dem zweiten eigenen Zug). Außerdem wirkt der Bypass auch dann weiter, wenn Willy tot/negiert/gefroren ist (Spielerzustand statt Heldeneffekt).

### H04-09 · Taio, the Sun Fencer: Stufensenkung gilt auch bei NEGIERTEM Taio (Dauer-Vertrag `reduceCardLevel` ohne Statusfilter) · Stufe B
- **Karten:** Taio, the Sun Fencer (`taio-the-sun-fencer.js`); Engine `_applyCardLevelReductions`. Gegenstück zu H04-02 (anderer Vertrag, gleiche Klasse wie B-01…B-03/B-09 des Querschnittsberichts).
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Held 0 = Taio mit Fighting Lv 2 (Ability-Zone 0), **keine** Destruction Magic; „Bamboo Staff" (Equipment, Kosten 10) in Taios Support Zone; Hand: Fireball (Destruction Lv 2).
- **Schritte:** 1. `heroMeetsLevelReq` + Fireball über `doPlaySpell` – normal. 2. Dasselbe mit `statuses.negated` auf Taio.
- **Erwartet** (Kartentext „While this Hero has an Artifact with a cost of 10 or more equipped to it, all Destruction Spells it uses have their levels reduced by this Hero's Fighting level"; Engine-Regel: Negated schaltet Heldeneffekte stumm und blankt die Ability-Zonen, `heroMeetsLevelReq` ~Z. 43682; Thalia prüft den Status deshalb selbst): Bei negiertem Taio entfällt die Senkung, Fireball (Lv 2, keine Schule) ist nicht spielbar.
- **Beobachtet:** Normal ✓ (Fireball spielbar, Lv 2 − 2 = 0). Negiert: `heroMeetsLevelReq` = true, Fireball wird gewirkt (Gegner 800 → 650) – ein Held ohne jede Schule und ohne Heldeneffekt wirkt einen Lv-2-Destruction-Zauber. Anderer Held derselben Seite profitiert korrekt nicht ✓. Gefrorener Taio: Aktion ohnehin gesperrt ✓.
- **Repro:** `docs/niche-tests/repro/H04-heroes/09-taio-negiert-stufensenkung.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_engine.js` `_applyCardLevelReductions` (~Z. 43925): die Schleife über `cardInstances` fragt `inst.isActiveIn()`, aber nie `_isHeroEffectSilenced` für Helden-Instanzen; `taio-the-sun-fencer.js` `reduceCardLevel` liest `ps.abilityZones` direkt (nicht die bei Negation geblankten Zonen) und prüft den Status nicht. Thalia ist bewusst anders gebaut (eigene Prüfung in `getThaliaFriendshipLevel`).

### H04-10 · Wall Breaker General Ralzish: seitenfremde Kreaturen in seinen Support Zones werden nach Besitzer statt nach Ort gezählt; Ziel-ID kollidiert · Stufe B
- **Karten:** Wall Breaker General Ralzish (`wall-breaker-general-ralzish.js`); Auslöser im Test: Elusive Hind (`elusive-hind.js`, gleiches Muster Plant Golem)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Sitz 0: Ralzish (Held 0) mit 1 bzw. 2 alten eigenen Kreaturen (`turnPlayed` 1); Sitz 1 spielt Elusive Hind (landet mit `controller` = Sitz 0, `owner` = Sitz 1 in Ralzishs freier Zone); Sitz 1 hat eine alte Kreatur an derselben Koordinate (Held 0, Slot 2) auf seiner eigenen Seite.
- **Schritte:** 1. Ralzish über `doActivateHeroEffect` aktivieren (a) mit 1 eigener + Hind, (b) mit 2 eigenen + Hind. 2. Die Zielliste der Zielwahl lesen (c).
- **Erwartet** (Kartentext „if there are **exactly 2 Creatures in this Hero's Support Zones**, you may choose any card on the board that is not a Hero …"): (a) physisch genau 2 → aktivierbar; (b) physisch 3 → nicht aktivierbar; (c) jede wählbare Karte hat eine eigene, eindeutige Ziel-ID.
- **Beobachtet:** (a) nicht aktivierbar (die fremde Kreatur zählt nicht). (b) aktivierbar, obwohl 3 Kreaturen in seinen Zonen liegen. (c) Der Hind (liegt bei Sitz 0) bekommt die ID `equip-1-0-2` – dieselbe wie die echte Gegner-Kreatur bei Sitz 1; `targets.find` liefert nur die erste, der Hind ist faktisch nicht wählbar und der Klick auf sein Brettfeld (`equip-0-0-2`) findet keine ID.
- **Repro:** `docs/niche-tests/repro/H04-heroes/10-ralzish-seitenfremde-kreatur.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `wall-breaker-general-ralzish.js` `creaturesInSupport` (`inst.owner !== ownerIdx`) und `collectTargets` (`equip-${inst.owner}-…`, `owner: inst.owner`): Besitzer statt Brettseite. Richtig wäre `engine.physicalSide(inst)` (= `controller ?? owner`, `_engine.js:19466`), wie es Sett, Tarleinn und Stellan machen. Die Kopfkommentare von Hind/Golem nennen den Vertrag („setzt NUR `controller`, der Besitzer bleibt der Beschwörer"). Hinweis: Für über einen *geliehenen Helden* beschworene Kreaturen (zweite Konvention, CARD_API ~Z. 18846: `owner` = Brettseite, `controller` = Beschwörer, `crossSideControlled`) stimmt `inst.owner` zufällig – deshalb fällt es nur bei Hind/Golem-artigen Kreaturen auf (aus dem Quelltext abgeleitet, nicht eigens gemessen).

### H04-11 · Taio, Absorber of the Mountain's Heart: Abbruch der Zielwahl im Nachguss verbraucht die Karte (Hand oder Deck) und die Einmal-Sperre · Stufe C
- **Karten:** Taio, Absorber of the Mountain's Heart (`taio-absorber-of-the-mountain-s-heart.js`, `_castAsAdditionalAction`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Held 0 = Taio Absorber (Fighting 3, Destruction Magic 3), Hand: Burning Finger (+ je nach Lauf Quick Attack), Deck: Quick Attack bzw. Dummies.
- **Schritte:** 1. Burning Finger auf einen Gegnerhelden wirken. 2. In Taios Galerie „Quick Attack" (aus Hand bzw. Deck) wählen. 3. Die Zielwahl des Nachgusses mit dem Abbruch-Knopf (`null`) beenden.
- **Erwartet** (CARD_API.md „Zielwahl", ~Z. 380: „Abbruch heißt: nichts ist passiert. Die Karte bleibt auf der Hand, die Aktion wird erstattet"; Yukana, gleiche Zusatzaktions-Familie: „Abbruch in Galerie ODER in der Zielwahl des Spells → nichts verbraucht"): Quick Attack bleibt in Hand/Deck, die Einmal-pro-Zug-Sperre bleibt frei.
- **Beobachtet:** Kein Schaden durch den Nachguss ✓, aber Quick Attack liegt in der Ablage (aus dem Deck gezogen, gemischt und dem Gegner per `deckSearchReveal` gezeigt, dann weg), und `hoptUsed['taio-mountains-heart-followup:0']` ist gesetzt – der Spieler kann in diesem Zug keinen zweiten Versuch machen. Der Skriptkommentar nennt es bewusst („The card is NOT pushed back to hand on cancel — Mountain's Heart's prompt is the commitment point"), trägt aber keinen „Als Ruling"-Vermerk und widerspricht der Allgemeinregel.
- **Repro:** `docs/niche-tests/repro/H04-heroes/11-taio-absorber-nachguss-abbruch.js` (✗ = Ist-Zustand „Karte verbraucht")
- **Vermutete Ursache:** `taio-absorber-of-the-mountain-s-heart.js` `afterSpellResolved`: `engine.claimHOPT` direkt nach der Galerie; `_castAsAdditionalAction` schiebt die Karte nach dem `finally` unbedingt in die Ablage (`ps.discardPile.push(cardName)`), auch bei `gs._spellCancelled`.
- **Frage an Al:** Soll ein Abbruch der Zielwahl im Taio-Nachguss die Karte zurückgeben (Hand/Deck) und den Einmal-pro-Zug-Anspruch frei lassen (wie bei Yukana), oder ist die Galerie-Wahl bewusst der Zusagepunkt? Ein Wort: „zurück" oder „verbraucht".

### H04-12 · Sid: die geraubten Karten landen nach Spielen/Abwerfen in SIDS Ablage statt in der des Gegners · Stufe B
- **Karten:** Sid, the King of Thieves (`sid-the-king-of-thieves.js`, `onBeforeHandDraw`); Engine `_consumeHandCardOrigin` / `actionDiscardHandCard`
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Sitz 0: Sid auf Held 0, leere Hand; Gegner-Deck: Fireball, Chain Lightning, Icebolt, Dummy. Sids Raub über den echten Hook (`runHooks('onBeforeHandDraw')`), Auswahl Chain Lightning + Fireball.
- **Schritte:** 1. Sid spielt den geraubten Fireball (a). 2. In einem zweiten Lauf wirft Sid die geraubte Chain Lightning per `actionDiscardHandCard` ab (b).
- **Erwartet** (CARD_API.md ~Z. 4255–4265, „ALLGEMEINE REGEL (Al 1.9.)": „jeder Effekt, der eine Karte in eine fremde Hand legt, markiert sie mit `_tagHandCardOrigin` … Abwerfen, Spielen … lesen das – die Karte kehrt in Ablage bzw. Deck des URSPRÜNGLICHEN Besitzers zurück. Getaggt sind: Key, Infiltration, Enigma, … **Sid** …"; v1224 „Gestohlene Karten gehen in die Ablage ihres Besitzers"): Die Karten liegen danach in der Ablage des Gegners.
- **Beobachtet:** In beiden Fällen liegt die Karte in SIDS Ablage, die des Gegners bleibt leer. Die Hand-Instanz trägt `originalOwner` = Gegner, aber `ps._handOriginals` (die platzbasierte Herkunft) ist leer – und genau die lesen `_consumeHandCardOrigin(pi, name, handIdx)` und der Abwurf zuerst.
- **Repro:** `docs/niche-tests/repro/H04-heroes/12-sid-gestohlene-karten-ablage.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `sid-the-king-of-thieves.js:190` setzt nur `newInst.originalOwner = oi`; der Aufruf von `engine._tagHandCardOrigin(pi, name, oi, handIdx)` (wie bei Enigma, Infiltration, Spice Mortar) fehlt. Die Doku zählt Sid trotzdem als „getaggt".

### H04-13 · Sid: Stufe-0-Freigabe der geraubten Karten gilt auch bei NEGIERTEM Sid · Stufe B
- **Karten:** Sid, the King of Thieves
- **Voraussetzungen / Aufbau:** wie -12; zusätzlich `statuses.negated` auf Sid (keine Schulen, Abilities bei Negation geblankt).
- **Schritte:** `heroMeetsLevelReq` + Fireball (Lv 2) über `doPlaySpell`, einmal ohne, einmal mit Negation.
- **Erwartet** (Kartentext „This Hero may use any level 3 or lower Attacks, Spells and Creatures added this way as if they were level 0"; Engine-Regel: Negated schaltet Heldeneffekte stumm): Bei negiertem Sid entfällt die Freigabe, der Fireball ist nicht spielbar.
- **Beobachtet:** Ohne Negation ✓ (Fireball gespielt, Gegner 650). Mit Negation: `heroMeetsLevelReq` = true, Fireball wird gewirkt. Sid stempelt die Freigabe als Hand-Offset (`_handLevelOffsetsTransient`, gefiltert auf seinen Heldenplatz); `heroMeetsLevelReq` liest den Offset ohne Statusprüfung des Helden. Gleiche Klasse wie H04-02, anderer Mechanismus.
- **Repro:** `docs/niche-tests/repro/H04-heroes/13-sid-negiert-behaelt-stufenfreigabe.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_engine.js` `heroMeetsLevelReq` (~Z. 43640–43670, Hand-Offset-Abschnitt `_handLevelOffsetsTransient` + `_handLevelOffsetHeroFilter`): kein Abgleich mit `_isHeroEffectSilenced(pi, heroIdx)` für den Filter-Helden.

### H04-14 · „Am Ende deines Zuges"-Heldeneffekte laufen erst, NACHDEM Frost/Betäubung/Negation des eigenen Zuges abgelaufen sind (Sett, Willy) · Stufe C (Querschnitt)
- **Karten:** Sett, the Adept of Necromancy (`sett-the-adept-of-necromancy.js`, `onTurnEnd`); ebenso betroffen im Prinzip Willy, the Valiant Leprechaun (`onPhaseEnd`, Phase 5) und jeder andere „At the end of your turn"-Heldeneffekt; Engine `advanceToPhase(END)`, `processStatusExpiry`
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Sitz 0: Sett auf Held 0 mit einer alten Kreatur (`turnPlayed` 1) in Support 0; Sett trägt `frozen` / `stunned` / `negated` (über `addHeroStatus`, Standarddauer 1 Zug), `_isHeroEffectSilenced` = true; Phase MAIN2.
- **Schritte:** `t.endTurn()` (echter Zugwechsel).
- **Erwartet** (Kartentext Sett „At the end of your turn, send all Creatures in this Hero's Support Zones that were not summoned this turn to the discard pile"; Engine-Regel: Frozen/Stunned/Negated schalten Heldeneffekte stumm, Sett setzt kein `bypassStatusFilter`; die Kampagnen-Anleitung nimmt als Ablauf „End-Phase → Zugende-Hooks → Statusablauf" an): Der den ganzen Zug über stumme Sett räumt am Zugende nicht ab – seine Kreatur bleibt.
- **Beobachtet:** In allen drei Zuständen wird die Kreatur besiegt (`sett_cleanup`). Ursache ist die Reihenfolge: `processStatusExpiry('END')` entfernt `frozen`/`stunned`/`negated` der Helden des aktiven Spielers bereits **vor** `ON_PHASE_END` und vor `ON_TURN_END` (das in `switchTurn` läuft); zum Zeitpunkt des Hooks ist Sett nicht mehr stumm. Gegenprobe: ein quellgebundener Status (`sourceBound`, läuft nicht ab) hält Sett wie erwartet still. Bei einem toten Sett bleibt die Kreatur ✓.
- **Repro:** `docs/niche-tests/repro/H04-heroes/14-sett-zugende-nach-statusablauf.js` (✗ = Ist-Zustand: Zugende-Effekt läuft trotz Zustand über den ganzen Zug)
- **Vermutete Ursache:** `_engine.js` Z. ~22923: `await this.processStatusExpiry('END')` steht vor `runHooks(ON_PHASE_END)` und `switchTurn()`; Skript-Kommentar „Automatic phase — process status expiry, hooks, then switch turn" (bewusste Reihenfolge, aber ohne Ruling-Vermerk).
- **Frage an Al:** Soll ein Held, der den ganzen Zug über gefroren/betäubt/negiert war, seinen „Am Ende deines Zuges"-Effekt noch auslösen (Ist-Zustand, weil der Status vorher abläuft) oder nicht? Ein Wort: „löst aus" oder „stumm". (Betrifft Sett, Willy und alle weiteren Zugende-Heldeneffekte der anderen Gruppen.)

### H04-15 · Kreatur-Tokens (Mummy / Invader / Leprochaun Token) landen bei „zerstören / auf die Ablage schicken" in der ABLAGE statt im Gelöscht-Stapel (Sett, Vena, Ralzish) · Stufe B
- **Karten:** Sett, the Adept of Necromancy (`besiege` → `actionDestroyCard`), Vena, the Bounty Huntress (Konfiszieren → `actionMoveCard(…, 'discard')`), Wall Breaker General Ralzish (`actionDestroyCard`); Ursache in der Engine (`actionMoveCard`/`actionDestroyCard`), also potenziell jede Karte, die ein Kreatur-Token so wegschickt.
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; ein alter Token (Mummy / Invader / Leprochaun Token, `turnPlayed` 1) in einer Support Zone: bei Sett in dessen Zone (Zugende), bei Vena im markierten Gegnerhelden, bei Ralzish auf der Gegnerseite (Ralzish mit 2 alten Kreaturen).
- **Schritte:** Setts Zugende (`t.endTurn()`), Venas „Confiscate" (`doActivateHeroEffect`), Ralzishs Zerstörung – dann Ablage/Gelöscht beider Sitze prüfen. Engine-Gegenprobe: `actionMoveCard`/`actionDestroyCard` direkt auf alle zehn Token der Datenbank.
- **Erwartet** (README §4 Familie 4: „Tokens (kommen nie in die Ablage)"; der Schadens-Todespfad, `handleHeroDeathCleanup` und `_enforceSupportZoneLock` schicken Tokens in den Gelöscht-Stapel; Sas'Za-Befund -07 geht von derselben Regel aus): Der Token wird gelöscht (Gelöscht-Stapel seines Besitzers), keine Ablage enthält ihn.
- **Beobachtet:** Alle drei Karten legen Mummy Token, Invader Token und Leprochaun Token in die **Ablage** (Besitzer-Ablage). Bei den Puppet-Tokens und dem Pollution Token klappt es (Gelöscht-Stapel), nur die Tokens mit `subtype: Creature` fallen durch. Tritt der Token dagegen durch Schaden ab, geht er korrekt in den Gelöscht-Stapel. Folge: ein Token liegt in der Ablage und kann von Ablage-Effekten (Necromancy, Wiederbelebung …) als Karte geholt werden (der Audit bleibt still, der Name steht in der DB).
- **Repro:** `docs/niche-tests/repro/H04-heroes/15-token-landet-in-ablage.js` (✗ = Fehler tritt auf; Mummy Token bei Sett ausgenommen, der mumifiziert seinen Wirt Sett selbst)
- **Vermutete Ursache:** `_engine.js` `actionMoveCard` (~Z. 13715–13730): für `toZone === DISCARD` schiebt der „Kadaver landet VOR den Hooks"-Block `cardInstance.name` unbesehen in `discardPile`; die Token-Weiche (`hasCardType(cd, 'Token')` → `deletedPile`) gibt es nur in `_kreaturTodAbwickeln`/Schadens-Batch (~Z. 47235) und in `handleHeroDeathCleanup`. Eine Weiche im Zielstapel-Block von `actionMoveCard` würde alle Aufrufer (u. a. `actionDestroyCard`) abdecken.

### H04-16 · Visionary Genius Heinz (und Tharx): unter Zieh-Sperre wird bezahlt, aber nichts gezogen · Stufe B (Heinz) / C (Tharx)
- **Karten:** Visionary Genius Heinz (`visionary-genius-heinz.js`), Tharx, the Never-Losing General (`tharx-the-never-losing-general.js`); Sperre: `ps.drawLocked` (The Sacred Jewel, Prayer) bzw. `ps.handLocked`
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Heinz auf Held 0, Hand: 3× Fireball + Icebolt, Deck 20; `drawLocked = true`. Tharx: eine alte Kreatur in Support 0, `handLocked = true`.
- **Schritte:** 1. Heinz aktivieren, drei Fireball markieren. 2. Tharx aktivieren, Bestätigung „Draw 1 card?" mit Ja.
- **Erwartet** (Kartentext Heinz „discard up to 4 copies of the same card to draw that many cards"; das Skript sperrt `handLocked` in `canActivateHeroEffect` – erkennbare Absicht „kein Abwurf ohne Nachziehen"; Engine `actionDrawCards`: `handLocked || drawLocked` ⇒ `[]`): Heinz ist unter `drawLocked` nicht aktivierbar (wie unter `handLocked`). Tharx verbrennt unter Sperre nicht die Einmal-Sperre.
- **Beobachtet:** Heinz wirft die drei Fireball ab, `actionDrawCards` liefert `[]`, Hand = 1 (Icebolt), die Einmal-pro-Zug-Sperre ist verbraucht. Tharx unter `handLocked`: Bestätigung wird angeboten, 0 Karten gezogen, Einmal-Sperre verbraucht (nur HOPT, keine Karten verloren – daher nur C). Gegenprobe: Heinz unter `handLocked` korrekt gesperrt ✓; gefroren/betäubt/negiert ✓; leeres Deck: wirft ab und zieht nichts (Text-konform: „to draw that many").
- **Repro:** `docs/niche-tests/repro/H04-heroes/16-heinz-tharx-zieh-sperre.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `visionary-genius-heinz.js` `canActivateHeroEffect`: nur `ps.handLocked`; `drawLocked` (reiner Zieh-Lock, `_engine.js` ~10876) fehlt. `tharx-the-never-losing-general.js` `canActivateHeroEffect` zählt nur Kreaturen. Vergleich: `prayer.js:97`, `golden-ladybug.js:129`, `chuck-the-storyteller.js:357` prüfen beide Sperren. Leadership (`leadership.js` ~Z. 15–25) nennt dieselbe Lücke ausdrücklich als „nur CPU-Regel, der Menschenpfad bleibt unangetastet".
- **Frage an Al:** Soll Heinz (und Tharx) unter `drawLocked` nicht aktivierbar sein wie unter `handLocked`? Ein Wort: „gesperrt" oder „erlaubt".

### H04-17 · Timeless King Zi: der Sofort-Guss ignoriert „once per game" (Divine Gift) und die Spielbedingung (Call for Help) · Stufe B (Einmal-Limit) / C (Spielbedingung)
- **Karten:** Timeless King Zi (`timeless-king-zi.js`, Schritt 6); betroffene Zauber: Divine Gift of Creation/Death/Equality/… (`oncePerGameKey: 'divineGift'`), Call for Help (`spellPlayCondition`), vermutlich alle Zauber mit Einmal-Klausel/Spielbedingung
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5; Zi (Held 0), Deck: Zielzauber + Haste + Heal + 12 Füller; Zi-Galerie: diese drei, Gegnerwahl: der Zielzauber.
- **Schritte:** 1. Zi aktivieren, Divine Gift of Creation wird per Gegnerwahl gewirkt. 2. Wie 1., aber `_oncePerGameUsed` enthält schon `divineGift`. 3. Call for Help ohne besiegte eigene Kreatur.
- **Erwartet** (Kartentext Zi „immediately performs that Spell, regardless of its level, if possible"; Divine Gift „You can only activate 1 "Divine Gift" card per game"; Call for Help „You can only play this card if a Creature you control was defeated since the start of your turn"; Engine-Konvention `_engine.js` ~Z. 21894: „auch der Sofort-Guss verbraucht das Einmal-Limit", und die Zusatzaktions-Listen filtern `oncePerGame`/`spellPlayCondition` aus, ~Z. 19733–19740): (1) Zis Guss stempelt das Einmal-Limit; (2) ein zweites Divine Gift ist „nicht möglich" und entfällt; (3) Call for Help ohne Bedingung ist „nicht möglich".
- **Beobachtet:** (1) Divine Gift wirkt (Suchgalerie), `_oncePerGameUsed` bleibt leer – danach kann man ein Divine Gift der Hand zusätzlich spielen (zwei Divine Gifts pro Spiel). (2) Mit gesetztem Stempel wird das zweite Divine Gift trotzdem gewirkt. (3) Call for Help wird ohne besiegte Kreatur gewirkt und spielt dabei einen weiteren Zauber aus dem Deck („ZZ Filler" in der Ablage) – Zi umgeht so zwei Spielbedingungen auf einmal. Zi bietet diese Zauber schon in der Galerie an.
- **Repro:** `docs/niche-tests/repro/H04-heroes/17-zi-einmal-pro-spiel-und-spielbedingung.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `timeless-king-zi.js` ~Z. 340–392: Sofort-Guss per direktem `runHooks('onPlay')` (Muster Chaos Magic); `canPerform` prüft nur Held lebt/nicht gefroren/betäubt/negiert, weder `script.oncePerGame` (Stempel + Filter) noch `script.spellPlayCondition`. `uniqueDeckSpells` filtert nur Surprise/Reaction.
- **Frage an Al (Teil Spielbedingung):** Soll Zi einen Zauber, dessen Spielbedingung nicht erfüllt ist (Call for Help, Reunion, Guard Duty …), nicht ausführen („if possible") oder ist „regardless of its level" die einzige Ausnahme? Ein Wort: „entfällt" oder „wirkt trotzdem". (Das Einmal-Limit halte ich wegen der Engine-Konvention für B.)

## Abdeckung
| Karte | Tiefe | Geprüfte Nischenfälle / Anmerkung |
|---|---|---|
| Sol Rym, the Thunder Djinn | L2 gezielt | Chain Lightning ohne Schule ✓, Quick-Attack-Reihenfolgen ✓, Coffee-Zusatzaktion ✗(→ -01), negiert ✗(→ -02) |
| Sorin, the Warden of Blood Rock | L2 gezielt | Verpuffen gegen nicht blutende Helden/Kreaturen ✓, blutende Kreatur 150 ✓, negiert behält Stufenbypass ✗(→ -02) |
| Tsu'Ki, the Lunatic Princess | L1 Standard | Stufenbypass negiert ✗(→ -02, geteilt); Lunatic-Cycle-Kostensenkung nicht gesondert getestet |
| Toras, Master of all Weapons | L2 gezielt | +40 je verschiedenem Artefakt ✓, gleichnamige zählen einmal ✓, Equipment zerstört ✓; Tod/Wiederbelebung ✗(→ -03) |
| Taio, the Sun Fencer | L2 gezielt | Stufensenkung ✓ (normal), negiert ✗(→ -09), ATK +20 je Artefakt über Tod/Revive ✗(→ -03) |
| Taio, Absorber of the Mountain's Heart | L2 gezielt | Nachguss Spell↔Attack ✓, Abbruch der Zielwahl ✗/C(→ -11) |
| Xiong, the Bamboo Guardian | L2 gezielt | Galerie beider Ablagen ✓, gleichnamige Kopie ausgeschlossen ✗(→ -04) |
| Saya, the Plant Princess | L2 gezielt | Zweitguss bei Stufe < Support-Stufe ✓, Einmal-Klauseln ✗/C(→ -05) |
| Silent Water Mizune | L2 gezielt | Basis ✓, Träger-Zustände C(→ -06) |
| Sas'Za, the Snaka Adventurer | L2 gezielt | Ziehen = Stufe ✓, Dreimal-Grenze ✓, Rückholung ✓; Token ✗(→ -07) |
| Sett, the Adept of Necromancy | L2 gezielt | Zugende-Abräumen alte/neue/fremde Kreatur ✓ (fremde in der Ablage des Besitzers), toter Sett ✓; Zustände C(→ -14), Token ✗(→ -15) |
| Sid, the King of Thieves | L2 gezielt | Raub 2 Karten ✓, Stufe-0-Freigabe ✓ (nach Spielen verschobener Index ✓); Ablage ✗(→ -12), negiert ✗(→ -13) |
| Wall Breaker General Ralzish | L2 gezielt | genau 2 Kreaturen ✓, Verbot „seit Zugende beschworen" ✓; Fremdkreatur ✗(→ -10), Token ✗(→ -15) |
| Willy, the Valiant Leprechaun | L2 gezielt | 5 Karten / 30 Gold am Ende des ersten Zuges ✓; Handlimit-Ende ✗(→ -08), Zugende-Zustand C(→ -14) |
| Stellan, the Calm Cat | L2 gezielt | bis 3 verschiedene Lv-0-Kreaturen ✓, nur einmal je Zug ✓ (zweiter Treffer im Zug ohne Auslösung), Gift-Tick/Vena-Treffer/Frost+Schaden löst genau einmal aus ✓, tödlicher Treffer, volle Zonen, Deck-Weg, negiert ✓ |
| Tryse, the Shadow Slayer | L2 gezielt | 2 Zufallskarten ✓, höchstens 2× pro Zug ✓, gestohlene Kreatur ✓, 1-Karten-Hand ✓, negiert stumm ✓, Heldentod ✓ |
| Teocuilatl, the Embodiment of Gods | L2 gezielt | Kreatur opfern (+10) ✓, Held opfern (+30, Zugende, 1×/Spiel) ✓, HOPT ✓, ohne Opfer nicht aktivierbar ✓ |
| Tempeste Moana, the Rain Singer | L2 gezielt | genau 2 Ausrüstungen = Creature 50 HP ✓, 50×Anzahl-Schaden ✓, 0 HP ⇒ Ablage des Besitzers ✓, negiert/tot ✓ |
| Vena, the Bounty Huntress | L2 gezielt | Markierung ✓, Kopfgeld ⇒ neuer Held ✓, Ziel tot/wiederbelebt ✓, Besitzer-Ablage (Hind) ✓; Token ✗(→ -15), Vena übernommen nicht aktivierbar (Marke bleibt beim Besitzer) |
| Zsos'Ssar, the Serpent Warlord | L2 gezielt | 2 Gift auf eigenen Held, +40×Vergiftete (Held und Kreatur), Abbruch ohne Gift ✓ |
| Timeless King Zi | L1 Standard | 227-Zauber-Batterie (Wirkung/Bilanz; 6 Auffälligkeiten durch Zauber-Eigenheiten, nicht Zi); Vollständigkeit der Gegnerwahl siehe unten |
| Styx, the Gate to the Spirit World | L2 gezielt | +100/+100 bei fremdem/eigenem Heldentod ✓, mehrfach ✓, gefroren/betäubt/negiert stumm ✓, toter Styx ✓, `maxHpCapped` ✓, unter Fremdkontrolle fragt der Kontrolleur ✓ |
| Styx, the Opened Gate | L2 gezielt | Wiederbelebung eigener/gegnerischer Helden mit 100 HP ✓, Kontrolle bis Zugende, Zwangstod ✓, Zähler ✓, HOPT ✓, gefroren/betäubt/negiert ✓ |
| Tarleinn the Traveler | L2 gezielt | 40/80/150 nach Zauberstufe (0/1/2/3) ✓, eine Schule/Fighting ⇒ nein ✓, HOPT ✓, Abbruch erstattet ✓, Zustände/tot ✓, Attack ⇒ nein ✓, geliehener Wirker ✓ |
| Tazune, the Angry Hot-Blood | L2 gezielt | zwei Ladungen je Zug, Gegner-/Statusschaden unberührt, Reset beim Zugwechsel ✓, Phoenix Tackle Rückstoß ✓, Zustände ✓, eigene/gegnerische Kreatur ✓ |
| Tempeste, the Weather Fairy | L2 gezielt | −100 andere Helden, min. 0 ✓, selbst unreduzierbar ✓, Zustände/tot ✓, zwei Tempeste stapeln, Gift auf anderem Helden ⇒ 0, Erstrunden-Immunität schlägt „unstoppable" ✓ |
| Thalia, the Fun Fairy | L2 gezielt | Stufensenkung Support-Zauber (nackter Held ab Lv 0) ✓, Friendship 1/2 ✓, Zustände/tot ✓, Gegner-Thalia ✓, Nicht-Support ✓ |
| Tharx, the Never-Losing General | L2 gezielt | zählt nur ältere Kreaturen ✓, HOPT ✓, Zustände ✓, geklaute Kreatur zählt, Token zählt; Zieh-Sperre ✗/C(→ -16) |
| Treasure Huntress Semi | L2 gezielt | +6 Gold nur Rundeneinkommen ✓, gefroren/betäubt/tot ⇒ kein Bonus ✓ (negiert endet vor dem eigenen Zugbeginn) |
| Visionary Genius Heinz | L2 gezielt | bis 4 gleiche Karten ✓, Zustände ✓, `handLocked` ✓; `drawLocked` ✗(→ -16) |

## Getestet & in Ordnung (Auswahl)
- Sol Rym: erste Aktion Chain Lightning, danach Quick Attack (Zusatzaktion) gesperrt; Quick Attack zuerst (zählt als Aktion), danach Chain Lightning gesperrt.
