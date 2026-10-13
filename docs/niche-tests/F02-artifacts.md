# F02-artifacts – Nischenfall-Bericht
Stand/Autor: Agent F02-artifacts, 13.10.2026. Karten: 50 in der Liste · (wird am Ende ergänzt) gezielt getestet · (wird am Ende ergänzt) mit Befund.

## Zusammenfassung
(wird am Ende ergänzt)

## Befunde
### F02-01 · Mana-Consuming Blade: kein +10 ATK (Karte ist ein leerer Stub) · Stufe A
- **Karten:** Mana-Consuming Blade (`cards/effects/mana-consuming-blade.js`)
- **Voraussetzungen / Aufbau:** Seed 1234, Zug 5, Hand Sitz 0 [Mana-Consuming Blade], Held 0 = Tushu (ATK 40), Phase Main 1.
- **Schritte:** 1. Karte über den echten Spielweg (`doPlayArtifact`) an Held 0 ausrüsten. 2. ATK des Helden lesen.
- **Erwartet** (Kartentext „The equipped Hero's Attack stat is increased by 10."): ATK 40 → 50.
- **Beobachtet:** Die Karte wird ausgerüstet (liegt in der Zone, 10 Gold bezahlt), die ATK bleibt 40. Der zweite Satz („unaffected by the effects of all Mana Spells") ist nicht prüfbar: im ganzen Kartenpool gibt es weder eine Schule „Mana" noch Zauber, die sich „Mana Spell" nennen (nur Karten mit „Mana" im Namen: Mana Beacon, Mana Mining, Mana Absorbing Crystal, Elixir of Mana, Idej Blade – Manabi; keine davon ist als „Mana Spell" definiert).
- **Repro:** `docs/niche-tests/repro/F02-artifacts/01-mana-consuming-blade-ohne-effekt.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `cards/effects/mana-consuming-blade.js` ist nur `{ isEquip: true, equipOwnSideOnly: true }`; der Kopfkommentar behauptet „die Karte wirkt über ihre Kartendaten", aber `data/cards.json` hat kein ATK-Feld für die Karte (`atk: null`) und die Engine wertet den Effekttext nicht aus (`grep` nach „Attack stat is increased" in `_engine.js`/`_hooks.js`/`server.js`: kein Treffer). Die Datei kam mit dem Commit 4db2f97 (Structure Deck End of the World) nur als Seitenbindungs-Stub. Es fehlt `grantAtk(10)`/`revokeAtk()` (Muster `phalanx-pike.js`).
- **Hinweis:** Falls die Karte bewusst noch „offen" ist, bitte streichen; sie ist aber regulär spielbar und kostet 10 Gold.

### F02-02 · Secret Lab Entrance: weder Ausrüst-Beschränkung (Inventing) noch Zusatz-Aktivierung · Stufe A
- **Karten:** Secret Lab Entrance (`cards/effects/secret-lab-entrance.js`), Inventing (`cards/effects/inventing.js`)
- **Voraussetzungen / Aufbau:** (a) Held 0 ohne Fähigkeiten, Lab auf der Hand. (b) Held 0 mit Inventing Lv1, Lab liegt in Support Zone 0, 5 Handkarten (ZZ Filler), Phase Main 1; Abwurfwahl des Inventing-Prompts skriptiert.
- **Schritte:** (a) Lab ausspielen. (b) Inventing frei aktivieren (`doActivateFreeAbility`), danach ein zweites Mal.
- **Erwartet** (Kartentext „You can only equip this card to a Hero you control with the Inventing Ability. Once per turn, when you use that Hero's Inventing Ability, you may immediately use it an additional time after that."): (a) Ausrüsten auf einen Helden ohne Inventing wird abgelehnt. (b) Nach der ersten Aktivierung ist eine zweite zusätzlich erlaubt.
- **Beobachtet:** (a) wird ausgerüstet (Held ohne Inventing). (b) erste Aktivierung klappt, die zweite wird abgelehnt (`false`) – mit und ohne Lab identisch.
- **Repro:** `docs/niche-tests/repro/F02-artifacts/02-secret-lab-entrance-ohne-effekt.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `cards/effects/secret-lab-entrance.js` ist nur `{ isEquip: true, equipOwnSideOnly: true }`; es gibt weder `canEquipToHero` (Inventing-Pflicht) noch einen Hook; kein anderes Skript liest die Karte (`grep "Secret Lab Entrance"`: nur die Datei selbst), und `inventing.js` kennt keine Zusatz-Aktivierung.

### F02-03 · Sacred Hammer of the Volcano addiert die Basis-ATK statt der aktuellen Attack stat · Stufe B
- **Karten:** Sacred Hammer of the Volcano (`cards/effects/sacred-hammer-of-the-volcano.js`)
- **Voraussetzungen / Aufbau:** Held 0 (Tushu, ATK 40) rüstet den Hammer aus (ATK 70); Gegner-Held 0 ist Burned; Karte „Attack" („deal damage equal to the attacker's Attack stat").
- **Schritte:** 1. Hammer über `doPlayArtifact` ausrüsten. 2. Mit „Attack" den verbrannten Gegner-Helden treffen.
- **Erwartet** (Kartentext „… when the equipped Hero hits a Burned target with an Attack, that Attack's damage is increased by the attacker's Attack stat."; andere Karten sagen ausdrücklich „base Attack stat", der Hammer nicht): Grundschaden 70 + Hammerbonus 70 (aktuelle Attack stat) = 140.
- **Beobachtet:** 110 (= 70 + `hero.baseAtk` 40). Mit einem zusätzlichen +50-Buff (ATK 120) sind es 160 statt 240. Gegenprobe ohne Burn: 70 (Grundschaden stimmt).
- **Repro:** `docs/niche-tests/repro/F02-artifacts/03-sacred-hammer-basis-statt-aktuelle-atk.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `sacred-hammer-of-the-volcano.js` `beforeDamage`: `const baseAtk = hero.baseAtk || 0; ctx.modifyAmount(baseAtk);` (Kopfkommentar: „increase … by the Hero's base ATK" – stammt aus einer früheren Textfassung; Text und Skript kamen zusammen in Commit 4db2f97, der Text sagt aber „Attack stat"). Vorbild für „aktuelle ATK": `shattered-trident-…js` (`hero.atk`).

### F02-04 · Hat of Madness feuert nicht, wenn der Träger von einem anderen Spieler kontrolliert wird · Stufe B
- **Karten:** Hat of Madness (`cards/effects/hat-of-madness.js`), Golden Apple (Kontrolle); gleiche Klasse: jede Karte, die „handelnder Spieler" mit `physicalSide` der Karte vergleicht.
- **Voraussetzungen / Aufbau:** Sitz 1 trägt an Held 0 den Hat of Madness (`t.put(1,0,0,…)`); Sitz 0 spielt Golden Apple auf Held 0 von Sitz 1 und greift danach mit diesem Helden an (`charmedOwner: 1`, echter Weg `doPlaySpell`); Sitz 0 hat Hand [ZZ Filler, ZZ Trinket].
- **Schritte:** 1. Golden Apple. 2. „Attack" mit dem geliehenen Helden (Treffer auf Held 1 von Sitz 1).
- **Erwartet** (Kartentext „Whenever the equipped Hero performs an Action, its controller must add a card from their hand to their opponent's hand."; Skriptkopf: „'its controller' ist der Spieler, der den Helden kontrolliert – also der Handelnde"): Sitz 0 (Kontrolleur) muss eine Handkarte an Sitz 1 geben.
- **Beobachtet:** kein Prompt, keine Übergabe. Gegenprobe im Repro: trägt der eigene Held den Hut, feuert er (✓).
- **Repro:** `docs/niche-tests/repro/F02-artifacts/04-hat-of-madness-geliehener-held.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `hat-of-madness.js`: `const seite = engine.physicalSide(ich); if (ctx.playerIdx !== seite) return;` – `ctx.playerIdx` ist der Kontrolleur (0), `seite` die Brettseite des Hutes (1). Zu vergleichen wäre die Brettseite des Helden (`ctx.heroOwner ?? ctx.playerIdx`) mit der Hut-Seite; zahlen muss `ctx.playerIdx`.

### F02-05 · Heart of Ice überschreibt und löscht beim Abgang die angeborene Frost-Immunität (Broghan) · Stufe B
- **Karten:** Heart of Ice (`cards/effects/heart-of-ice.js`), Broghan, the Frozen Guardian of the North (`…broghan-the-frozen-guardian-of-the-north.js`, gleicher Schlüssel `statuses.freeze_immune`)
- **Voraussetzungen / Aufbau:** Sitz 0: Broghan als Held 0 (Immunität wie im Spielstart `{source: Broghan…, innate: true}`), Heart of Ice auf der Hand.
- **Schritte:** 1. Heart an Broghan ausrüsten. 2. Heart zerstören (`actionDestroyCard`). 3. Direkt danach `addHeroStatus(0,0,'frozen')`.
- **Erwartet** (Kartentext Heart: „The equipped Hero cannot be Frozen."; Broghan: „Cannot be Frozen" angeboren): Broghan bleibt unfreezbar; das Heart darf ihm nichts wegnehmen.
- **Beobachtet:** Nach dem Ausrüsten steht `freeze_immune = {source: 'Heart of Ice'}` (die angeborene Marke ist überschrieben), nach dem Abgang ist der Eintrag gelöscht, Broghan wird eingefroren. Erst Broghans `onTurnStart`-Sicherheitsnetz (`if (!hero.statuses?.freeze_immune)`) stellt es beim nächsten Zugbeginn wieder her.
- **Repro:** `docs/niche-tests/repro/F02-artifacts/05-heart-of-ice-loescht-fremde-frostimmunitaet.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `heart-of-ice.js` `immunSetzen`/`immunEntfernen` (Z. ~35–50) schreiben/löschen den gemeinsamen Schlüssel ohne Rücksicht auf einen schon vorhandenen Eintrag (kein „nur setzen, wenn leer"/„nur löschen, was wir selbst gesetzt haben" über eine eigene Zählung).

### F02-06 · Heart-Shaped Bow: Love-Shot-Angebot nur einmal pro Zug und Bogen – im Text steht das nicht · Stufe C
- **Karten:** Heart-Shaped Bow, the Final Proof of Cuteness (`cards/effects/heart-shaped-bow-the-final-proof-of-cuteness.js`), zum Vergleich Legendary Sword of a Barbarian King (dort steht „Once per turn" im Text)
- **Voraussetzungen / Aufbau:** Held 0 trägt den Bogen; Hand [Attack, Attack, Love Shot, Love Shot]; das Angebot wird jeweils angenommen.
- **Schritte:** 1. „Attack" mit Held 0 → Love-Shot-Angebot (angenommen). 2. Im selben Zug nochmals „Attack" mit Held 0.
- **Erwartet** (Kartentext: „When the equipped Hero performs an Attack, you may immediately perform a "Love Shot" Spell from your hand with it as an additional Action regardless of its level." – keine Grenze genannt): auch beim zweiten Angriff erneut ein Angebot.
- **Beobachtet:** beim zweiten Angriff kein Angebot; `ctx.hardOncePerTurn('heart-bow-love-shot:<id>')` (Skriptkopf: „HOPT je Bogen-Instanz, Ablauf wie Legendary Swords Gratis-Beschwörung").
- **Repro:** `docs/niche-tests/repro/F02-artifacts/06-heart-shaped-bow-einmal-pro-zug-nicht-im-text.js` (✗ = die Lesart ohne Grenze wird nicht erfüllt)
- **Vermutete Ursache:** `heart-shaped-bow….js` `afterSpellResolved`, `hardOncePerTurn(hoptKey)` – offenbar vom Schwert übernommen.
- **Frage an Al:** Soll das Love-Shot-Angebot des Bogens einmal pro Zug und Bogen begrenzt sein (jetzt ja) oder bei jedem Angriff erscheinen?

### F02-07 · Rain Viola am Gegner-Helden: die Suche geht an den Gegner (CARD_API sagt „wirkungslos") · Stufe C
- **Karten:** Rain Viola (`cards/effects/rain-viola.js`, `_orchestra-shared.js instrumentDiscardTrigger`)
- **Voraussetzungen / Aufbau:** Sitz 0 rüstet Rain Viola frei-seitig an Held 0 von Sitz 1 aus (`targetOwner: 1`; `equipOwnSideOnly` fehlt dort bewusst); beide Decks enthalten Attacks/Spells.
- **Schritte:** 1. Viola an den Gegner-Helden. 2. Viola zerstören (`actionDestroyCard`).
- **Erwartet** (Kartentext „When this Artifact equipped to a Hero you control is sent to the discard pile, search your deck … once per turn"; CARD_API „Ausrüstung: welche Seite?": „Auf einem gegnerischen Helden sind sie damit erlaubt, aber wirkungslos"): keine Suche.
- **Beobachtet:** Sitz 1 (Besitzer der Zone) bekommt die Suche (Galerie, +1 Handkarte); Sitz 0 nichts. Die Karte selbst landet korrekt in der Ablage von Sitz 0.
- **Repro:** `docs/niche-tests/repro/F02-artifacts/07-rain-viola-am-gegnerhelden-nuetzt-dem-gegner.js` (✗ = die Lesart „wirkungslos" wird nicht erfüllt)
- **Vermutete Ursache:** `_orchestra-shared.js:118ff` bewertet „Hero you control" aus Sicht von `effektiveSeiten(inst).controller` (= Brettseite der Karte).
- **Frage an Al:** Meint „wirkungslos" im Ruling „für den Ausrüster" (dann ist es so gewollt: der Gegner profitiert) oder „für beide"?

### F02-08 · Magic Cobalt (und Ruby/Amethyst/Golden Apple) wählen „Hero you control / your opponent controls" nach Brettseite statt Kontrolle · Stufe B
- **Karten:** Magic Cobalt (`magic-cobalt.js`), Magic Ruby (`magic-ruby.js`), Magic Amethyst, Golden Apple (`golden-apple.js` über `_charm-shared.uebernehmbareHelden`)
- **Voraussetzungen / Aufbau:** Sitz 1 hat Held 0 von Sitz 0 dauerhaft übernommen und Sitz 0 Held 0 von Sitz 1 (`actionTakeHeroPermanently`, wie Paraseed Control); Sitz 0 spielt Magic Cobalt bzw. Magic Ruby über den echten Weg.
- **Schritte:** 1. Karte anspielen. 2. `gs.potionTargeting.validTargets` lesen.
- **Erwartet** (Kartentext Cobalt „Choose a Hero you control …", Ruby „Choose a Hero your opponent controls …"; Konvention „Kontrolle statt Seite", `heroSideOf`/`heroesControlledBy`): Cobalt bietet den übernommenen Helden 1:0 an und NICHT den vom Gegner kontrollierten 0:0; Ruby umgekehrt.
- **Beobachtet:** Cobalt: gültig `0:0, 0:1, 0:2` (der vom Gegner kontrollierte Held ist heilbar, der übernommene nicht). Ruby: gültig `1:1, 1:2` (der Filter `filterSelbstKontrollierteGegnerHelden` nimmt 1:0 korrekt heraus ✓), aber der vom Gegner kontrollierte Held 0:0 in meiner Spalte wird nie angeboten (gleich bei Amethyst und Golden Apple).
- **Repro:** `docs/niche-tests/repro/F02-artifacts/08-magic-cobalt-kontrolle-statt-seite.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `magic-cobalt.js getValidTargets` iteriert `gs.players[pi].heroes` (Seite) statt `engine.heroesControlledBy(pi)`; `magic-ruby.js`/`magic-amethyst.js`/`golden-apple.js` iterieren nur die Gegnerspalte `opponentOfGs(gs, pi)`. Wirkt nur bei dauerhafter Übernahme (Paraseed, Styx) – Golden Apple/Charme-Marken fallen mit dem Zug.

## Abdeckung
(wird am Ende ergänzt)

## Getestet & in Ordnung (Auswahl)
(wird am Ende ergänzt)
