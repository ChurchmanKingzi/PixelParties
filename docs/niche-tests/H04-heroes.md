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

## Abdeckung
| Karte | Tiefe | Geprüfte Nischenfälle / Anmerkung |
|---|---|---|
| Sol Rym, the Thunder Djinn | L2 gezielt | Chain Lightning ohne Schule ✓, Quick-Attack-Reihenfolgen ✓, Coffee-Zusatzaktion ✗(→ -01), negiert/gefroren siehe unten |

## Getestet & in Ordnung (Auswahl)
- Sol Rym: erste Aktion Chain Lightning, danach Quick Attack (Zusatzaktion) gesperrt; Quick Attack zuerst (zählt als Aktion), danach Chain Lightning gesperrt.
