# F02-artifacts – Nischenfall-Bericht
Stand/Autor: Agent F02-artifacts (Vorgänger-Lauf bis F02-08 + Fortsetzung F02-09…F02-24), 13.10.2026. Karten: 50 in der Liste · 44 gezielt getestet (L2), 6 mit Standardlauf/Anschauung (L1), 0 nur gelesen · 30 Karten mit Befund (24 Befunde: 2 × A, 16 × B, 6 × C).

## Zusammenfassung
24 Befunde (A 2 · B 16 · C 6); alle mit ausgeführtem Repro unter `docs/niche-tests/repro/F02-artifacts/`. Gesamteindruck: Die Skripte der Kartenliste laufen ohne verschluckte Engine-Fehler und ohne Hänger; die Befunde sind semantisch (Text ↔ Verhalten) und liegen in vier Klassen:
* **Skript ist älter als der Kartentext oder ein leerer Stub** (alle Skripte kamen mit Commit 4db2f97): Mana-Consuming Blade und Secret Lab Entrance tun nichts (A, F02-01/-02); Sacred Hammer addiert Basis- statt aktueller ATK (F02-03); Initiation Ritual legt Fähigkeiten in die Ablage statt zu löschen (F02-17); Shard of Chaos führt Kreaturen als Attack/Spell (C, F02-21).
* **„Kontrolle statt Seite" / Brettseite** (Klasse B-01…B-03 für Zielsammler): Hat of Madness am geliehenen Helden (F02-04), Magic Cobalt/Ruby/Amethyst/Golden Apple (F02-08), aktive Ausrüstung am übernommenen Helden: der Kontrolleur kann sie nicht aktivieren, der Brettseiten-Besitzer schon (F02-22), und `getCreatureTargets` löst bei gleicher (Held, Slot)-Stelle die falsche Kreatur auf, wenn eine fremd beschworene Kreatur (Plant Golem, gestohlene Kreatur) daneben liegt – Poisoned Meat trifft dann den Golem statt der gewählten Kreatur (F02-14, betrifft 39 Skripte).
* **Stempel / Sperren bei Abbruch und Negierung** (Regel 23.9, Ruling v1031): negierte „1 pro Zug/Partie"-Artefakte stempeln nicht (F02-10, F02-11); Eye-of-Ren-Ablehnung lässt bei Shard of Chaos Handkarten verloren gehen (F02-13) und bei Relic in the Sky / Magic Sapphire den Stempel stehen (F02-20); Rocket Sneeze lässt sein Dedup-Flag ohne Kette stehen (F02-16); Item Lock und Artefakt-Sperre werden von einzelnen Hand-Reaktionsfenstern nicht gelesen (Idol of Crestina, Magic Topaz, Philosopher's Stone; F02-23, F02-24).
* **Einzelfälle**: Heart of Ice überschreibt Broghans angeborene Frost-Immunität (F02-05); Renewable Energy bietet [B]/[W]-Varianten als „different names" (F02-12); Heart of Cards löscht eine Mystery Box ohne deren Trigger (F02-09); Juice proaktiv nur für Heldenstatus (F02-15).
Offene Regelfragen (C): Heart-Shaped Bow einmal je Zug (F02-06), Rain Viola am Gegnerhelden (F02-07), „1 pro Zug" bei Negierung (F02-11), Dagger bei Heldenopfer (F02-18), Heart-of-Ice-Rache bei tödlichem Treffer (F02-19), Shard und Kreaturen (F02-21).
**Bewusst nicht getestet:** 3-/4-Sitz-Spiel und Skill-Test-Modus (Poisoned Meat u. a. nehmen `[pi, opponentOf(pi)]`), CPU-/MCTS-Verhalten (`cpuMeta`, `cpuResponse`), Client/Anzeige, Secret Spell Book jenseits zweier Stichproben (alte Tests + umfangreiche Vorgaben im Kopf), Open Invitation Waflav-Sonderweg (von Al als „Plan" bestätigt), die Pfeil-/Bluff-Kopplung von Javelin Throw („treated as an Attack" gegen Surprises, die „Attack or Spell *card*" verlangen), Tränke-/Hero-Zusammenspiel von Local Idol über zwei negierte Tränke (Skriptkopf: „negierte Tränke zählen nicht mit" – dokumentiert).
**Hinweis zur Arbeitsumgebung:** Das Scratchpad wird von mehreren Agenten geteilt; ein fremdes Skript gleichen Namens hat kurzzeitig zwei meiner Befundblöcke in `S01-spells.md` eingefügt. Ich habe nur diese beiden Blöcke wieder entfernt (S01 enthält danach wieder ausschließlich die eigenen Einträge S01-07…S01-09 des anderen Agenten).

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

### F02-09 · Heart of Cards löscht eine Mystery Box aus dem Deck, ohne dass Mystery Box zieht · Stufe B
- **Karten:** Heart of Cards (`cards/effects/heart-of-cards.js`), Mystery Box (`cards/effects/mystery-box.js`)
- **Voraussetzungen / Aufbau:** Sitz 0: Hand [Heart of Cards], Deck [Mystery Box, Attack, ZZ Dummy ×4]; Ansage „Fireball" (Fehlschlag).
- **Schritte:** 1. Heart of Cards über den echten Weg spielen, Ansage „Fireball". 2. Die oberste Karte (Mystery Box) wird gelöscht.
- **Erwartet** (Kartentext Mystery Box: „The first time every turn a "Mystery Box" is sent to the discard pile or deleted from your deck, draw 2 cards."; Heart of Cards: „Otherwise, delete the revealed card."): Mystery Box wird aus dem Deck gelöscht → Sitz 0 zieht 2 Karten. Gegenprobe im Repro: wird dieselbe Mystery Box durch Magic Emerald (Mill) gelöscht, zieht der Besitzer 2 ✓.
- **Beobachtet:** Mystery Box liegt gelöscht in `deletedPile`, aber es wird keine Karte gezogen (Hand leer).
- **Repro:** `docs/niche-tests/repro/F02-artifacts/09-heart-of-cards-loescht-mystery-box-ohne-ziehen.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `heart-of-cards.js` ~Z. 117–121 löscht von Hand: `takeFromPile(pi,'deck',0)` + `ps.deletedPile.push(oben)` + `_trackCard(…,'deleted')` und ruft `onMill`/`actionMillCards` nicht; `mystery-box.js hooks.onMill` (Z. 66ff.) wird daher nie erreicht.

### F02-10 · Negierter Perfect Disguise verbraucht die Einmal-pro-Spiel-Grenze nicht · Stufe B
- **Karten:** Perfect Disguise (`cards/effects/perfect-disguise.js`, `oncePerGame` + `oncePerGameKey`), Rusty Touch als Negierer
- **Voraussetzungen / Aufbau:** Sitz 0: 2× Perfect Disguise auf der Hand, 100 Gold; Sitz 1: Rusty Touch (negiert einen Artifact-Spielzug).
- **Schritte:** 1. Perfect Disguise spielen (Ziel Held 0), Sitz 1 negiert mit Rusty Touch. 2. Das zweite Perfect Disguise spielen.
- **Erwartet** (Kartentext „You can only play 1 "Perfect Disguise" per game."; Ruling CARD_API.md ~Z. 11418–11440 (v1031): „Der Stempel sitzt dort, wo die Karte die Hand verlässt – ab da IST sie aktiviert …, unabhängig davon, ob ein Gegenzug sie später negiert."): nach dem ersten (negierten) Spielzug ist `perfectDisguise` gestempelt, das zweite ist nicht spielbar.
- **Beobachtet:** Der erste Spielzug wird negiert (Karte in der Ablage, 12 Gold bezahlt), `_oncePerGameUsed` bleibt leer; das zweite Perfect Disguise öffnet die Zielwahl, wird gespielt und wirkt (Held `untargetable`).
- **Repro:** `docs/niche-tests/repro/F02-artifacts/10-perfect-disguise-negiert-stempelt-nicht.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `server.js doConfirmPotion` (~Z. 11969–11990): bei `chainResult.negated` geht der Weg über `routeNegatedInitialCard`; `_markOncePerGamePotion(ps, script, cardName)` steht nur im Nicht-Negiert-Zweig. Parallelfall: S01-01 (Divine Gift, Spells).

### F02-11 · „You can only play 1 X per turn"-Artefakte: ein negierter Spielzug verbraucht die Grenze nicht · Stufe C
- **Karten:** Magic Emerald, Magic Cobalt, Magnetic Glove, Relic in the Sky, Heart of the Mountain, Heart of Cards (alle Kartentext „You can only play 1 "<Name>" per turn.")
- **Voraussetzungen / Aufbau:** Sitz 0: 2 Kopien der Karte auf der Hand, 100 Gold; Sitz 1: Rusty Touch (negiert einen Artifact-Spielzug).
- **Schritte:** 1. Karte spielen, Sitz 1 negiert. 2. Zweite Kopie im selben Zug spielen (ohne weitere Reaktion).
- **Erwartet** (Lesart „gespielt = gezählt", analog Ruling v1031 für „per game" und S01-02 für Spells): die zweite Kopie ist nicht spielbar.
- **Beobachtet:** Nach der Negierung ist `gs.hoptUsed` leer; die zweite Kopie wird in allen sechs Fällen gespielt (Emerald, Relic, Mountain, Cards: beide Kopien liegen danach in der Ablage und `hoptUsed` trägt erst jetzt den Stempel; Cobalt/Glove öffnen die Zielwahl/Galerie der zweiten Kopie bzw. lassen sie spielbar auf der Hand).
- **Repro:** `docs/niche-tests/repro/F02-artifacts/11-einmal-pro-zug-artefakte-negiert-zaehlen-nicht.js` (✗ = die Lesart „gespielt = gezählt" wird nicht erfüllt)
- **Vermutete Ursache:** der Stempel sitzt im `resolve` (`claimHOPT`) bzw. bei den Gems am Ende von `resolve` (`maybeKeepGemInHand`), nicht beim Verlassen der Hand; eine Negierung kommt davor.
- **Frage an Al:** Soll ein negiertes „1 pro Zug"-Artefakt die Zuggrenze verbrauchen (wie das „per game"-Ruling v1031), oder zählt nur, was aufgelöst wurde?

### F02-12 · Renewable Energy: „Pawn of Kings [B]" und „[W]" gelten als „different names" · Stufe B
- **Karten:** Renewable Energy (`cards/effects/renewable-energy.js`); betroffen sind die Farbvarianten-Karten (`… of Kings [B]/[W]`)
- **Voraussetzungen / Aufbau:** Sitz 0: Hand [Renewable Energy], Ablage [Pawn of Kings [B], Pawn of Kings [W], Fireball, Fireball].
- **Schritte:** 1. Renewable Energy spielen, die Galerie ansehen. 2. Beide Bauern und Fireball wählen.
- **Erwartet** (Kartentext „Choose up to 3 cards with different names from your discard pile …"; Regel CARD_API.md ~Z. 4590 „`[B]`/`[W]` sind KOSMETIK, kein Namensbestandteil (Al 11.9.)", beide heißen im Spiel „Pawn of Kings"): die Galerie führt „Pawn of Kings" nur einmal; höchstens 2 Karten (Bauer + Fireball) wandern ins Deck.
- **Beobachtet:** Die Galerie bietet `Pawn of Kings [B]` und `Pawn of Kings [W]` getrennt an; die Wahl von beiden + Fireball wird angenommen, 3 Karten gehen ins Deck (zwei Karten gleichen Namens).
- **Repro:** `docs/niche-tests/repro/F02-artifacts/12-renewable-energy-b-w-variante-doppelt.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `renewable-energy.js` Galerie-Aufbau: `if (seen.has(baseCardName(name))) continue; seen.add(name);` – geprüft wird der Basisname, gemerkt aber der Vollname (müsste `seen.add(baseCardName(name))` sein); die Auswahl selbst wird nicht auf Verschiedenheit nachgeprüft.

### F02-13 · Shard of Chaos löscht Handkarten, bevor die Ablage-Ausgangssperre greift – Eye-of-Ren-Ablehnung lässt die Karten verloren und den Shard in der Hand · Stufe B
- **Karten:** Shard of Chaos (`cards/effects/shard-of-chaos.js`), The Eye of Ren (`the-eye-of-ren.js`, setzt `_discardLockedTurn` + `_discardLockBuyout`); zweiter Teil: Staff of the Teleporter / Staff of Uncontrollable Destruction (harte Sperre)
- **Voraussetzungen / Aufbau:** Sitz 0: Hand [Shard of Chaos, Fireball, Attack], Ablage [Fireball, Attack, Fireball], 100 Gold; Ablage-Sperre mit Freikauf (6 Gold) wie nach Eye of Ren (Teil a) bzw. ohne Freikauf wie nach einem Stab (Teil b).
- **Schritte:** 1. Shard spielen, Fireball + Attack zum Löschen wählen, in der Galerie Fireball + Attack wählen. 2. (a) Auf die Freikauf-Frage „Pay 6 Gold?" ablehnen (Mensch-Abbruch = `null`).
- **Erwartet** (Kartentext „Delete up to 3 cards from your hand. Then, choose the same number of cards … from your discard pile and add them to your hand. Delete this card."; Ruling `_engine.js` ~Z. 2610–2626 (Als Regel 29.8.): Ablehnen des Freikaufs = Ausspielen ABGEBROCHEN, Karte bleibt in der Hand, Kosten zurück; Karten, die vorher schon etwas Bleibendes getan haben, sollen `discardOutDeclineConsumes` setzen – „dann ist die Karte verbraucht"): entweder sauberer Abbruch (nichts gelöscht) oder Shard verbraucht. Nicht: Handkarten weg und Shard wieder auf der Hand.
- **Beobachtet:** (a) Fireball und Attack liegen im Gelöscht-Stapel, der Shard ist zurück in der Hand, die 4 Gold sind erstattet, nichts wurde geholt (die Ablage ist unverändert); der Spieler kann den Shard erneut spielen. (b) Bei harter Sperre (Stab): Fireball, Attack und der Shard werden gelöscht, die Ablage bleibt unberührt (Handkarten ohne Gegenwert gelöscht; Stufe C – Absicht „Sperre ist Pech des Spielers" oder Lücke?).
- **Repro:** `docs/niche-tests/repro/F02-artifacts/13-shard-of-chaos-loescht-bei-ablage-sperre.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `shard-of-chaos.js` löscht in `resolve` die Handkarten (Schritt 1) VOR der Ablagebewegung (`engine.addCardFromDiscardToHand` → `_discardOutAllowed`, `_engine.js` ~2558); `discardOutDeclineConsumes` (`_engine.js:2624`) wird von keinem Skript gesetzt (`grep -rn discardOutDeclineConsumes` → nur die Engine), also macht `_applyDiscardOutDecline` aus dem Ergebnis `{cancelled: true}`. Ein Vorab-Tor (`_discardOutAllowed` vor dem Löschen) oder das Flag am Shard fehlt.
- **Frage an Al (nur Teil b):** Soll Shard of Chaos unter der harten Ablage-Sperre (Stäbe) spielbar bleiben und trotzdem die Handkarten löschen, oder bei gesperrter Ablage gar nicht spielbar sein?

### F02-14 · Poisoned Meat (und alle `getCreatureTargets`-Karten): eine fremd beschworene Kreatur verdrängt die eigene an derselben (Held, Slot)-Stelle – der Schlag trifft die falsche Kreatur · Stufe B
- **Karten:** Poisoned Meat (`cards/effects/poisoned-meat.js`); Ursache in `_engine.js getCreatureTargets` – 38 weitere Skripte nutzen den Sammler (u. a. Acid Vial, Book of Doom, Capture Net, Dark Gear, Remote Detonator, Juice, Tea, Cure, Holy Cheese); Auslöser-Kreaturen: Plant Golem, Elusive Hind (landen in der Zone des Gegners), gestohlene Kreaturen
- **Voraussetzungen / Aufbau:** Sitz 0 beschwört Plant Golem (landet bei Sitz 1, Held 0, Slot 0: `owner` 0, `controller` 1); eigene „ZZ Dummy" bei Sitz 0, Held 0, Slot 0.
- **Schritte:** 1. Poisoned Meat spielen, die Zielliste ansehen. 2. Den Eintrag „ZZ Dummy" (meine Kreatur) wählen.
- **Erwartet** (Kartentext „Choose a Creature any player controls. Deal 20 damage to it and inflict 1 Stack of Poison to it."): zwei verschiedene Ziele (ZZ Dummy, Plant Golem); die Wahl „ZZ Dummy" trifft die ZZ Dummy.
- **Beobachtet:** Beide Einträge tragen dieselbe `cardInstance` (den Golem) und dieselbe ID `equip-1-0-0`; die Wahl „ZZ Dummy" schädigt den Golem (−20 HP, 1 Gift), die ZZ Dummy bleibt unberührt. Die eigene Kreatur ist damit nicht gezielt wählbar. (Anderer Befund als F01-07: dort fehlt die Kontrolle-statt-Seite-Auswahl, hier wird die falsche Instanz aufgelöst.)
- **Repro:** `docs/niche-tests/repro/F02-artifacts/14-poisoned-meat-getcreaturetargets-falsche-instanz.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_engine.js` ~Z. 40263 `getCreatureTargets`: `this.cardInstances.find(c => (c.owner === playerIdx || c.controller === playerIdx) && c.zone === 'support' && c.heroIdx === hi && c.zoneSlot === si)` prüft die Brettseite der Instanz (`physicalSide(c) === playerIdx`) nicht; der Golem (owner 0) passt auf die Spalte von Sitz 0, mit `controller` 1 zugleich auf die von Sitz 1, und `cardInstances.find` liefert die erste Fundstelle für beide Spalten. Gleiches gilt für gestohlene Kreaturen (Besitzer = Spaltenseite, Kontrolle beim Dieb).

### F02-15 · Juice ist im eigenen Zug nicht spielbar, wenn nur eine Kreatur einen negativen Status trägt · Stufe B
- **Karten:** Juice (`cards/effects/juice.js`); zum Vergleich Cure/Tea (`cure.js` ~Z. 138–164: dort ist genau diese Lücke laut Kommentar „BUGFIX … canActivate prüfte nur Helden" geschlossen)
- **Voraussetzungen / Aufbau:** Sitz 0: Hand [Juice], 100 Gold; eine gefrorene „ZZ Dummy" (a: eigene, b: gegnerische), kein Held mit Status; Main 1.
- **Schritte:** Juice über den echten Spielweg (`doUseArtifactEffect`) im eigenen Zug spielen.
- **Erwartet** (Kartentext „Choose any target on the board and heal it from any number of negative status effects."; Skriptkopf „Can also be activated proactively on own turn"; `getValidTargets` führt Helden und Kreaturen): spielbar, die Kreatur ist wählbar.
- **Beobachtet:** Das Spielen wird abgelehnt (`false`), Juice bleibt in der Hand, die Kreatur bleibt gefroren – für eigene wie gegnerische Kreatur. Gegenprobe: mit gefrorenem Helden ist Juice spielbar ✓. (Im Reaktionsfenster des Gegnerzugs prüft `reactionCondition` die Kreaturen mit; nur der proaktive Weg fällt durch.)
- **Repro:** `docs/niche-tests/repro/F02-artifacts/15-juice-proaktiv-nur-helden.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `juice.js` `canActivate(gs, pi)` (Z. ~100–110, ohne `engine`-Parameter) prüft nur `hero.statuses`; die Kreaturenprüfung (`getCleansableCreatureStatusKeys`) steht nur in `getValidTargets`/`reactionCondition`. Weiteres Muster in `resolve`: die Kreatur wird per `c.owner === target.owner && heroIdx && zoneSlot` gesucht (Seitenbedingung fehlt, vgl. F02-14).

### F02-16 · Rocket Sneeze: das Dedup-Flag `_rsPromptedFor` bleibt nach Schaden ohne Kette stehen – spätere Schadensereignisse bekommen keine Frage mehr · Stufe B
- **Karten:** Rocket Sneeze (`cards/effects/rocket-sneeze.js`); auslösend: jeder Schaden außerhalb einer Kette (Pocket Catapult, Kreaturen-/Ausrüstungs-Aktivierungen, Brand-/Gift-Ticks)
- **Voraussetzungen / Aufbau:** Sitz 0: Hand [Pocket Catapult ×2, Rocket Sneeze ×2], 100 Gold; Katapulte an Held 0 und Held 1 (je 40 Schaden, einmal pro Zug und Katapult).
- **Schritte:** 1. Schuss mit Katapult 1 auf Gegner-Held 0, die Rocket-Sneeze-Frage mit „Nein" beantworten. 2. Schuss mit Katapult 2 auf denselben Helden.
- **Erwartet** (Kartentext „Play this card immediately when a target your opponent controls takes 50 or less damage."; Skriptkopf: Dedup „per-source … so a multi-target source doesn't re-prompt per-target", „Cleared at chain-resolve"): der zweite Schuss ist ein neues Schadensereignis und öffnet das Fenster erneut.
- **Beobachtet:** Beim zweiten Schuss erscheint keine Frage; `gs._rsPromptedFor` steht seit dem ersten Schuss auf `{0: true}`. Ein Spieler, der beim ersten Mal ablehnt, verliert die Reaktion für alle folgenden Nicht-Ketten-Schäden bis zur nächsten aufgelösten Kette (auch eine angenommene Reaktion sperrt eine zweite Kopie).
- **Repro:** `docs/niche-tests/repro/F02-artifacts/16-rocket-sneeze-dedup-flag-bleibt.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `rocket-sneeze.js` `oppPreDamageCondition`/`oppCreaturePreDamageCondition` setzen `_markPrompted(gs, pi)` schon in der Bedingung (vor der Frage), `…Resolve` nochmals; das Flag wird nur im Hook `onChainResolve` gelöscht, der ohne Kette nicht läuft. Besser: Flag an die Quelle/das Ereignis binden (z. B. `source`+`amount`+Zeitstempel) oder nach der Auflösung des Schadensereignisses löschen.

### F02-17 · Initiation Ritual: die Fähigkeiten des geopferten Helden gehen in die Ablage statt gelöscht zu werden · Stufe B
- **Karten:** Initiation Ritual (`cards/effects/initiation-ritual.js`); Folgewirkung z. B. mit Pressed Skill („Ability from your deck, hand or discard pile")
- **Voraussetzungen / Aufbau:** Sitz 0: Hand [Initiation Ritual]; Held 1 (Rick) ist tot (seit Zug 5, jetzt Zug 7); Ability Zone 0 von Held 1: Fighting ×2, Zone 1: Luck; Held 0 lebt mit freier Support Zone.
- **Schritte:** Initiation Ritual über den echten Weg auf den toten Helden 1 spielen.
- **Erwartet** (Kartentext „… equip it to another Hero you control, **deleting** all cards in its Ability Zones. …"): Fighting, Fighting, Luck liegen im Gelöscht-Stapel von Sitz 0; die Ablage enthält nur das Ritual.
- **Beobachtet:** Fighting ×2 und Luck liegen in der **Ablage** (`discardPile`: `[Fighting, Fighting, Luck, Initiation Ritual]`), der Gelöscht-Stapel ist leer. Die Fähigkeiten sind damit wieder zugänglich (Pressed Skill, Karten-Recycler). Zusatzbeobachtung: dieselbe Schleife legt auch Ability-TYP-Karten aus den Support Zones des toten Helden ab; der Text verlangt nur „its Ability Zones".
- **Repro:** `docs/niche-tests/repro/F02-artifacts/17-initiation-ritual-ablage-statt-loeschen.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `initiation-ritual.js` (Blöcke „Discard all Ability-type cards from the dead Hero's zones" und „Support Zones — only Ability-type cards"): `discardPile.push(cardName)`. Der Skriptkopf beschreibt die ältere Textfassung („… → discard"); Karte und Skript kamen zusammen im Commit 4db2f97, der Text sagt aber „deleting" (gleiche Art Abweichung wie F02-03).

### F02-18 · Sacrificial Dagger löst nur bei geopferten Kreaturen aus, nicht bei geopferten Helden · Stufe C
- **Karten:** Sacrificial Dagger (`cards/effects/sacrificial-dagger.js`), auslösend: Divine Gift of Sacrifice, Teocuilatl, the Embodiment of Gods (Heldenopfer)
- **Voraussetzungen / Aufbau:** Sitz 0 mit 3 Helden: Dagger an Held 0, Hand [Divine Gift of Sacrifice]; Held 1 wird geopfert, Held 2 erhält die HP.
- **Schritte:** Divine Gift of Sacrifice spielen (Opfer Held 1, Empfänger Held 2).
- **Erwartet** (Kartentext „… when you sacrifice **a target** you control, you may choose a target and deal damage equal to the equipped Hero's Attack stat …"; „target" heißt im Spiel Held oder Kreatur, Divine Gift of Sacrifice sagt „Sacrifice a Hero you originally control"): der Dagger bietet seinen Schlag an.
- **Beobachtet:** Held 1 ist geopfert (HP 0), Held 2 +800 HP; der Dagger meldet sich nicht (keine Zielwahl, 0 Schaden). Kreaturenopfer lösen ihn aus ✓.
- **Repro:** `docs/niche-tests/repro/F02-artifacts/18-sacrificial-dagger-heldenopfer.js` (✗ = die Lesart „Held zählt als Opfer" wird nicht erfüllt)
- **Vermutete Ursache:** `sacrificial-dagger.js` hört nur auf `hooks.onCreatureSacrificed` (Kopfkommentar: „sacrifices a Creature you control"); Heldenopfer laufen über `actionDefeatHero(…, { isSacrifice: true })` → `onHeroKO` (`isSacrifice`), das der Dagger nicht liest.
- **Frage an Al:** Soll ein geopferter Held (Divine Gift of Sacrifice, Teocuilatl) den Dagger auslösen („target" wörtlich) oder gilt er nur für Kreaturenopfer (heute)?

### F02-19 · Heart of Ice: ein tödlicher Treffer auf den Träger friert den Angreifer nicht ein · Stufe C
- **Karten:** Heart of Ice (`cards/effects/heart-of-ice.js`)
- **Voraussetzungen / Aufbau:** Sitz 1: Heart of Ice an Held 0; Sitz 0 greift mit „Attack" (Tushu) den Träger an. Fall a) Träger 800 HP, Fall b) Träger 30 HP (der Treffer tötet ihn).
- **Schritte:** „Attack" mit Held 0 von Sitz 0 auf den Träger.
- **Erwartet** (Kartentext „… any Hero hitting the equipped Hero with an Attack … is Frozen for 1 turn."; Lesart „hitting" = getroffen, auch tödlich): in beiden Fällen ist der Angreifer 1 Zug eingefroren.
- **Beobachtet:** a) Angreifer gefroren ✓. b) Träger tot, das Heart liegt in der Ablage, der Angreifer ist NICHT gefroren.
- **Repro:** `docs/niche-tests/repro/F02-artifacts/19-heart-of-ice-toedlicher-treffer.js` (✗ = die Lesart „auch tödlich" wird nicht erfüllt)
- **Vermutete Ursache:** `heart-of-ice.js` `afterSpellResolved` → `traeger(engine, ctx.card)` verlangt `inst.zone === 'support'`; der Tod des Trägers legt das Heart schon vor dem Hook in die Ablage. Gleiches gilt für den Kreaturen-Zweig (`afterDamage`).
- **Frage an Al:** Soll der Angreifer auch einfrieren, wenn sein Treffer den Träger tötet (Heart-of-Ice-Vergeltung „im Sterben") – ja oder nein?

### F02-20 · Eye-of-Ren-Freikauf abgelehnt: Relic in the Sky / Magic Sapphire gelten als abgebrochen, behalten aber den „1 pro Zug"-Stempel · Stufe B
- **Karten:** Relic in the Sky (`cards/effects/relic-in-the-sky.js`), Magic Sapphire (`magic-sapphire.js` über `_magic-gem-shared.js`); gleiche Klasse: jede Karte, die den Stempel vor/während der Ablagebewegung setzt
- **Voraussetzungen / Aufbau:** Sitz 0: Hand [Karte ×2, ZZ Filler], Ablage [Fireball, Attack], 100 Gold; Ablage-Sperre mit Freikauf (6 Gold) wie nach The Eye of Ren.
- **Schritte:** 1. Karte spielen, die Freikauf-Frage mit „No" (`null`) beantworten. 2. Dieselbe Karte erneut spielen, Freikauf diesmal bezahlen.
- **Erwartet** (Ruling `_engine.js` ~Z. 2610–2626, Als Regel 29.8.: Ablehnen = Ausspielen ABGEBROCHEN, Karte bleibt in der Hand, Kosten zurück; Regel 23.9 „Abbruch heißt: nichts ist passiert"; Kartentext „You can only play 1 "<Name>" per turn."): nach dem Abbruch ist kein Stempel gesetzt, der zweite Versuch gelingt.
- **Beobachtet:** Karte zurück in der Hand und Gold erstattet ✓, aber `gs.hoptUsed['relic-in-the-sky:0']` bzw. `['Magic Sapphire:0']` steht auf dem Zug; der zweite Versuch wird abgelehnt (`false`), obwohl der Freikauf nun bezahlt würde. Die Karte ist für den Rest des Zuges tot. (Gegenprobe: Renewable Energy bricht bei abgelehntem Freikauf sauber ab – Karte in der Hand, Gold zurück, nichts gelöscht, kein Stempel.)
- **Repro:** `docs/niche-tests/repro/F02-artifacts/20-ablage-sperre-abbruch-verbraucht-hopt.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `relic-in-the-sky.js` `resolve` ruft `engine.claimHOPT(HOPT_KEY, pi)` VOR `takeFromPile`; bei den Gems claimt `maybeKeepGemInHand` am Ende von `resolve`. `_applyDiscardOutDecline` (`_engine.js` ~2619) macht daraus `{cancelled: true}`, gibt aber keinen Stempel frei (Vorbild: `releaseHopt` in `server.js` für Karten, die ihren Stempel selbst zurücknehmen).

### F02-21 · Shard of Chaos: Kreaturen zählen als „Attack/Spell" – der Text nennt nur Ability, Attack/Spell, Artifact, Potion, Hero · Stufe C
- **Karten:** Shard of Chaos (`cards/effects/shard-of-chaos.js`, `ACTION_TYPES = {Attack, Spell, Creature}`)
- **Voraussetzungen / Aufbau:** Sitz 0: Hand [Shard of Chaos, Bird (Kreatur)], Ablage [Fireball].
- **Schritte:** Shard spielen, „Bird" zum Löschen wählen, in der Galerie „Fireball" nehmen.
- **Erwartet** (Kartentext „… choose the same number of cards of the same type (Ability, Attack/Spell, Artifact, Potion, Hero) from your discard pile …"; „Creature" steht nicht in der Liste): wörtlich kein Tausch Kreatur → Zauber (und auch Kreatur → Kreatur nicht geregelt).
- **Beobachtet:** Bird wird gelöscht, Fireball kommt auf die Hand. Kopfkommentar: „Attack/Spell/Creature count as one type („Action")" – eine Skriptentscheidung ohne Ruling in CARD_API.md (`grep "Shard of Chaos"`: kein Eintrag dazu).
- **Repro:** `docs/niche-tests/repro/F02-artifacts/21-shard-of-chaos-kreatur-als-attack-spell.js` (✗ = die wörtliche Lesart wird nicht erfüllt)
- **Vermutete Ursache:** `shard-of-chaos.js` `normalizeType`: `ACTION_TYPES.has(cardType) ? 'Action' : cardType`.
- **Frage an Al:** Soll Shard of Chaos Kreaturen als eigenen Typ führen (Kreatur nur gegen Kreatur) oder wie bisher mit Attack/Spell in einen Topf werfen?

### F02-22 · Aktive Ausrüstung am übernommenen Helden: der Kontrolleur kann sie nicht aktivieren, der Brettseiten-Besitzer schon · Stufe B
- **Karten:** Pocket Catapult (`cards/effects/pocket-catapult.js`); gleiche Klasse: jede Ausrüstung mit `equipEffect` (Charm of Balance, Cloak of Edge, Crimson Web, Excavator Bucket, Future Tech Fists/Potion Launcher, Prayer, Slippery Skates, Snake Race Boat, Lunatic Cycle …)
- **Voraussetzungen / Aufbau:** Sitz 0 übernimmt Held 0 von Sitz 1 dauerhaft (`actionTakeHeroPermanently(0, 1, 0)`, wie Paraseed Control/Styx) und rüstet ihm Pocket Catapult an (echter Weg, `targetOwner: 1`, erlaubt laut Vorgabe 29.9.).
- **Schritte:** 1. Sitz 0 (Kontrolleur) aktiviert die Ausrüstung (`doActivateEquipEffect`, Held 0 / Slot 0). 2. Sitz 1 (Brettseite, kontrolliert den Helden nicht) aktiviert sie in seinem Zug.
- **Erwartet** (Kartentext „Equip this card to a Hero you control. You may once per turn deal 40 damage …"; Ruling CARD_API.md ~Z. 18906: „… Bei `charmedBy` dient sie über `effektiveSeiten` dem Kontrolleur."): Sitz 0 kann das Katapult abfeuern, Sitz 1 nicht.
- **Beobachtet:** Sitz 0: abgelehnt (`false`, auch mit `heroOwner: 1` im Parameter, den der Handler nicht kennt). Sitz 1: gelingt – das von Sitz 0 bezahlte Katapult schießt auf Sitz 0 (−40 HP).
- **Repro:** `docs/niche-tests/repro/F02-artifacts/22-aktive-ausruestung-am-uebernommenen-helden.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `server.js doActivateEquipEffect` (~Z. 11074–11117): `ps = _crossInst ? gs.players[oi] : gs.players[pi]` – gegenüber adressiert wird nur bei Karten mit `placesOnOpponentBoard` (FTCD); der Socket-Handler `activate_equip_effect` reicht nur `heroIdx`/`zoneSlot` durch, keine Brettseite; die Instanzsuche `c.owner === pi || c.controller === pi` trifft für die Instanz an Seite 1 (owner/controller 1) nur den Brettseiten-Besitzer.

### F02-23 · Item Lock (Hammer Throw): Reaktions-Artefakte im eigenen Zug kosten keine Handkarte · Stufe B
- **Karten:** Idol of Crestina (`cards/effects/idol-of-crestina.js`, Fenster `_checkResourcePhaseReactions`), Magic Topaz (`magic-topaz.js`, Pfeil-Fenster); gleiche Klasse: alle Hand-Reaktionsartefakte, die der Gesperrte in seinem eigenen Zug spielt (Rocket Sneeze, Philosopher's Stone, Juice-Reaktionsweg); Auslöser: Hammer Throw (`hammer-throw.js`, setzt `itemLocked`)
- **Voraussetzungen / Aufbau:** (a) Sitz 1 mit `itemLocked = true`, Hand [Idol of Crestina, ZZ Filler ×2]; Zugwechsel auf Sitz 1, Idol wird im eigenen Resource Phase angeboten und angenommen. (b) Sitz 0 mit `itemLocked = true`, Hand [Attack, Magic Topaz, ZZ Filler ×2]; Sitz 0 greift an, Topaz wird als Reaktion gespielt.
- **Schritte:** (a) `t.endTurn()`, Idol bestätigen. (b) „Attack" spielen, Topaz bestätigen.
- **Erwartet** (Kartentext Hammer Throw: „The target's controller must delete a card from their hand whenever they play an Artifact during their next turn."; Server-Prompt „Item Lock Cost: You must delete 1 card from your hand to use an Artifact."; Reaction ist ein Artifact-Untertyp): beide Spielzüge lösen den Löschkosten-Prompt aus.
- **Beobachtet:** Idol (+1 Karte per Suche) und Topaz (+60 Schaden) wirken ohne Item-Lock-Prompt, es wird nichts gelöscht. Kontrolle: ein normal gespieltes Artefakt (Heart of the Mountain) löst den Prompt aus ✓.
- **Repro:** `docs/niche-tests/repro/F02-artifacts/23-item-lock-reaktionsartefakte-im-eigenen-zug.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** die Hand-Reaktionsfenster der Engine prüfen `_artifactLockTurn` (z. B. `_engine.js` Z. 32150/32419/32585/32737/37807), aber nirgends `ps.itemLocked`; der Kostenprompt steht nur in `server.js` (`doPlayArtifact` ~Z. 12226, `doUseArtifactEffect`/Tränke ~Z. 11323). Zu klären wäre zusätzlich, ob Reaktionen im Zug des Hammer-Werfers (nicht „their next turn") frei bleiben sollen – so ist es heute.

### F02-24 · Philosopher's Stone wird trotz Artefakt-Sperre (Boomerang) angeboten und gespielt · Stufe B
- **Karten:** Philosopher's Stone (`cards/effects/philosopher-s-stone.js`, Fenster `_checkPotionDrawHandReactions`), Boomerang / Blood-Soaked Coin (setzen `_artifactLockTurn`)
- **Voraussetzungen / Aufbau:** Sitz 0: Hand [Boomerang, Potion of Greed, Philosopher's Stone], Ablage [Juice], Potion Deck [Healing Potion, Poison Vial, Acid Vial, Healing Potion].
- **Schritte:** 1. Boomerang spielen (Juice holen). 2. Potion of Greed spielen („Draw 2 cards from your Potion Deck").
- **Erwartet** (Kartentext Boomerang „You cannot play any Artifacts for the rest of this turn."; Philosopher's Stone ist ein Reaction-**Artifact**; die Geschwisterfenster für Topaz, Rocket Sneeze, Homerun! lassen unter der Sperre nichts zu ✓): kein Stone-Fenster, die Tränke werden normal gezogen.
- **Beobachtet:** Die Stone wird angeboten, bezahlt (4 Gold) und ersetzt einen Zug (Hand danach: Juice, Acid Vial, Healing Potion; Stone in der Ablage).
- **Repro:** `docs/niche-tests/repro/F02-artifacts/24-philosophers-stone-artefakt-sperre.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `_engine.js _checkPotionDrawHandReactions` (~Z. 34202–34240) prüft `_handPlayLockedFor`, Such-Sperre, Heldenplan, Gold – aber nicht `ps._artifactLockTurn === this.gs.turn` (und nicht `itemLocked`, vgl. F02-23); die Geschwisterfenster haben `if (cardData?.cardType === 'Artifact' && ps._artifactLockTurn === this.gs.turn) continue;` (Z. 32150/32419/32585/32737/37807).

## Abdeckung
| Karte | Tiefe | Geprüfte Nischenfälle / Anmerkung |
|---|---|---|
| Golden Ankh | L2 gezielt | Revive-HP min(100,maxHP) ✓, Re-Defeat am Zugende ✓, mit Homerun!/Negation (unnegierbar) ✓, Held anderweitig neu besiegt und wiederbelebt ✓, letzter Held/Spielende ✓ (Vorgänger-Messung t19, erneut ausgeführt) |
| Golden Apple | L2 gezielt | Übernahme/Rückgabe am Zugende ✓, „unaffected by your other cards" (Besitzer-Effekte kommen durch) ✓, gefrorener Held ✓, Ausrüsten am geliehenen Helden ✓; Zielwahl nach Brettseite ✗ (→ F02-08) |
| Gravedigger's Shovel | L2 gezielt | Kreatur/Held besiegt ✓, HOPT je Shovel ✓, eigene Kreatur ✗ (korrekt kein Auslöser), Deck 3 ✓, seitenfremde Kreatur ✓, zwei Shovel am Helden ✓ (Vorgänger t10) |
| Hat of Madness | L2 gezielt | eigener Held ✓, geliehener Held ✗ (→ F02-04), Held stirbt/Ablage des Besitzers ✓, Hut an Gegnerheld ✓ |
| Heart of Cards | L2 gezielt | Treffer ✓, Fehlschlag (löschen) ✓, zweite Kopie im Zug ✓, Abbruch der Ansage ✓, Deck nur diese Karte (→ Deck-Out) ✓; Mystery-Box-Trigger ✗ (→ F02-09); negierter Spielzug zählt nicht ✗ (→ F02-11) |
| Heart of Ice | L2 gezielt | Immunität/Gegenschlag auf Angreifer ✓, Kreatur-Treffer ✓, zweites Heart ✓; Broghan-Immunität überschrieben ✗ (→ F02-05), tödlicher Treffer ✗ (→ F02-19) |
| Heart of the Mountain | L2 gezielt | 0/2/5 Burned-Ziele (Helden + Kreaturen, Deckel 4) ✓, HOPT ✓; negierter Spielzug zählt nicht ✗ (→ F02-11) |
| Heart-Shaped Bow, the Final Proof of Cuteness | L2 gezielt | +10 ATK ✓, kein Surprise-Auslöser ✓, Love-Shot-Angebot nur 1×/Zug ✗/C (→ F02-06), Tod/Wiederbelebung ✓ |
| Holy Cheese | L2 gezielt | Suche + Gegnerheilung auf Held ✓, Gegner-Zielliste (Helden + Kreaturen) ✓, Reveal an Gegner ✓, keine Support-Magic-Karte im Deck → nicht spielbar (v1119, gewollt) ✓ |
| Homerun! | L2 gezielt | Schwelle ≥ max HP (Spell/Attack/Status/Kreatur) ✓, Insta-Kill über `actionDefeatHero` ✓, Ablehnen ✓, Gold 3 (Kosten 4) ✓, `cannotBeNegated` ✓, Ankh-Re-Defeat unnegierbar ✓ (Vorgänger t26/t27, Ruling v1278) |
| Idol of Crestina | L2 gezielt | Resource Phase: Suche statt Ziehen, Gold netto 0 ✓, Gold 2 → nicht angeboten ✓, leeres Deck → nicht angeboten ✓; Item Lock ✗ (→ F02-23) |
| Initiation Ritual | L2 gezielt | toter Held am Vortag ✓, Ausrüsten an lebenden Helden ✓, Fähigkeiten → Ablage statt Löschen ✗ (→ F02-17) |
| Invisibility Cloak | L2 gezielt | 1 Ziel von 3 Helden ✓, letzter Held (nicht angeboten) ✓, Held + Kreatur ✓, Spell auf Kreatur ✓, Zusatz-Aktion des Gegners ohne das Ziel ✓ |
| Javelin Throw | L2 gezielt | Base Attack ✓, Wurf von Rain Viola/Hat/Pike ✓, gefrorener/betäubter/negierter Träger → nicht spielbar ✓ (Vorgänger t15/t16, eigene Stichprobe Pike werfen) |
| Juice | L2 gezielt | Reaktionsweg ✓, Held-Status proaktiv ✓; nur Kreaturenstatus proaktiv ✗ (→ F02-15) |
| Ladder to the Sky | L2 gezielt | Opfer (nicht diesen Zug beschworen) ✓, Suche zu Beginn des nächsten eigenen Zuges, nicht im Gegnerzug ✓, Haste ✓, Gold ✓ |
| Legendary Sword of a Barbarian King | L2 gezielt | +10 ATK ✓, kostenlose Beschwörung 1×/Zug ✓, Abbruch → HOPT frei ✓, Zonen voll ✓, Tod/Wiederbelebung ✓ (Vorgänger t12) |
| Lifeforce Howitzer | L2 gezielt | Heilung 120/500 (Deckel 200) ✓, nur tatsächlich geheilte HP ✓, HOPT ✓, zweite Kopie am selben Helden ✓ abgelehnt, am anderen ✓, Abbruch ✓, geliehener Held ✓ (Vorgänger t14) |
| Local Idol | L2 gezielt | 2. Trank → negiert und auf die Hand des Idol-Spielers ✓; Skriptkopf-Auslegung „negierte Tränke zählen nicht mit" (3. Trank wäre wieder „zweiter") – dokumentiert, nicht beanstandet |
| Lone Survivor | L2 gezielt | nur ohne eigene Kreaturen ✓ (gegnerische Kreatur in meiner Zone zählt nicht ✓, gestohlene zählt ✓), Platzwahl ✓, Beschwörungssperre bis Zugende, fällt im Gegnerzug ✓ |
| Magic Amber | L1 Standard | Gegnerhand 0/1/2 ✓, Behalten-Abwurf ✓, keine Fehler |
| Magic Amethyst | L1 Standard | Zielwahl nach Brettseite ✗ (→ F02-08); Skript gelesen (oberste Ability je Stapel, Performance-Anzeige) |
| Magic Cobalt | L2 gezielt | Heilung 50 ✓; Ziel nach Brettseite statt Kontrolle ✗ (→ F02-08); negierter Spielzug zählt nicht ✗ (→ F02-11) |
| Magic Emerald | L1 Standard | 3 Karten mill ✓ (Mystery-Box-Gegenprobe ✓); negierter Spielzug zählt nicht ✗ (→ F02-11) |
| Magic Ruby | L2 gezielt | Betäubung 1 Zug, Ablauf ✓; Zielwahl: eigene Kontrolle korrekt gefiltert, kontrollierter Held in meiner Spalte fehlt ✗ (→ F02-08) |
| Magic Sapphire | L2 gezielt | Such-Sperre schwach ✓ / stark → unspielbar ✓; Eye-of-Ren-Ablehnung: Stempel bleibt ✗ (→ F02-20) |
| Magic Topaz | L2 gezielt | +60 Schaden ✓, HOPT ✓, Pfeil nach negiertem Angriff aufgeräumt ✓, Behalten-Abwurf ✓; Item Lock ✗ (→ F02-23) |
| Magnetic Glove | L1 Standard | leeres Deck → nicht spielbar ✓; negierter Spielzug zählt nicht ✗ (→ F02-11) |
| Mana-Consuming Blade | L2 gezielt | ATK-Bonus fehlt ✗ (→ F02-01) |
| MOE Bomb | L1 Standard | 999 Schaden an allen Kreaturen beider Seiten ✓ (1000-HP-Kreatur überlebt ✓), ohne Kreaturen spielbar ✓, Gold 19 → abgelehnt ✓ |
| Mystery Box | L2 gezielt | Mill-Trigger ✓ (Emerald-Gegenprobe); „deleted from deck" durch Heart of Cards ✗ (→ F02-09) |
| Nerdy Cheese | L2 gezielt | 2 Kopien → eine gelöscht, eine auf die Hand + Reveal ✓; 1 Kopie → nur gelöscht ✓ |
| Open Invitation | L2 gezielt | Diamond-Ascension: Platzieren, Zugende, Rückmischen nach dem nächsten eigenen Zug ✓, Träger tot → Rückweg läuft trotzdem ✓ (laut Ruling); unskippable Helden nicht wählbar (Liste geprüft) |
| Perfect Disguise | L2 gezielt | Held getarnt nur im Gegnerzug ✓, danach frei ✓, einziges legales Ziel ✓; negierter Spielzug stempelt nicht ✗ (→ F02-10) |
| Phalanx Pike | L2 gezielt | +30 ATK ✓, Attacks lösen keine Surprises aus, Spells schon ✓, Equip auf geliehenen Helden ✓ (Vorgänger t15/t08) |
| Philosopher's Stone | L2 gezielt | Ersetzt 1 Zug (zweite Kopie ersetzt den zweiten) ✓, Gold ✓; unter Artefakt-Sperre ✗ (→ F02-24) |
| Play Money | L2 gezielt | Rabatt −20 (Boden 0) auf Equipment/Normal-Artefakt ✓, folgt der Handkarte nach Verschiebung ✓, zwei Play Money stapeln ✓, Wipe zum Zugwechsel ✓, Gold 4 → nächstes Artefakt gratis ✓ |
| Pocket Catapult | L2 gezielt | 40 Schaden 1×/Zug ✓, gefrorener/betäubter Träger gesperrt ✓, negierter Träger wirkt ✓ (Skriptvorgabe), Abbruch → HOPT frei ✓, zwei Katapulte ✓; am übernommenen Helden nicht aktivierbar durch den Kontrolleur ✗ (→ F02-22) |
| Poisoned Meat | L2 gezielt | 20 Schaden + 1 Gift ✓, tötet Frail ohne Gift ✓; falsche Instanz bei Fremd-Kreatur ✗ (→ F02-14) |
| Rain Viola | L2 gezielt | Suche bei Tod/Zerstörung/Wurf ✓, HOPT je Name, leeres Deck ✓; am Gegnerhelden nützt sie dem Gegner (→ F02-07, C) |
| Relic in the Sky | L2 gezielt | unterste Karte ✓; negierter Spielzug (→ F02-11), Eye-of-Ren-Ablehnung (→ F02-20) |
| Remote Detonator | L2 gezielt | ohne Golem unspielbar ✓, 2 eigene Golems → alle gelöscht, 400 Schaden ✓, gegnerischer Golem als Ziel ✓ |
| Renewable Energy | L2 gezielt | bis 3 Karten ✓, Löschen ✓, Eye-of-Ren-Ablehnung sauber ✓; [B]/[W] als verschiedene Namen ✗ (→ F02-12) |
| Rocket Sneeze | L2 gezielt | Hero-/Kreaturenweg, Schwelle 50, Weiterleitung an alle Ziele ✓; Dedup-Flag bleibt ✗ (→ F02-16) |
| Sacred Hammer of the Volcano | L2 gezielt | Basis- statt aktuelle ATK ✗ (→ F02-03) |
| Sacrificial Dagger | L2 gezielt | Kreaturenopfer → Schlag (HOPT je Dagger, Abbruch gibt HOPT frei, Gegner-Opfer löst nicht aus) ✓; Heldenopfer löst nicht aus ✗/C (→ F02-18) |
| Secret Lab Entrance | L2 gezielt | Equip nur an Inventing-Held / Zusatz-Aktivierung fehlen ✗ (→ F02-02) |
| Secret Spell Book | L1 Standard | nichts zu holen → 1 Karte ziehen ✓, gestohlene Kreatur dauerhaft zurück ✓ (alte Tests + Kopf-Vorgaben); keine tiefe Messung |
| Shard of Chaos | L2 gezielt | Löschen/Holen gleicher Typen ✓; Ablage-Sperre ✗ (→ F02-13), Kreatur als Attack/Spell ✗/C (→ F02-21) |
| Shattered Trident, Treasure of the Deepsea | L2 gezielt | +10 ATK, Angebot nur bei einem Ziel, Verbrauch nach dem Angriff ✓, Abbruch ✓, Attack negiert → Trident bleibt ✓ (Vorgänger t17) |

## Getestet & in Ordnung (Auswahl)
* **Equip-Regeln einheitlich:** alle 13 Ausrüstungen der Liste werden auf gefrorene und tote eigene Helden abgelehnt, auf betäubte/negierte angenommen; Ausrüstung geht beim Tod des Trägers in die Ablage des Ausrüsters (auch bei Gegner-Helden), nach Wiederbelebung bleibt nichts hängen; Flags von Pike/Bow werden mit der Ausrüstung entfernt.
* **Perfect Disguise:** Tarnung nur im Gegnerzug, danach weg; „only legal target"-Ausnahme gilt.
* **Open Invitation / Ladder to the Sky:** verzögerte Effekte feuern am richtigen Zugende bzw. Zugbeginn (nicht im Gegnerzug), auch wenn der Träger tot ist.
* **Idol of Crestina / Philosopher's Stone / Local Idol / Rocket Sneeze (Einzelfenster):** Fensterlogik, Gold, Ersetzen des Ziehens, Weiterleitung auf alle Ziele korrekt; Magic Topaz räumt den Pfeil nach negiertem Angriff auf.
* **Homerun!:** Schwellen- und Insta-Kill-Logik laut Ruling v1278; Golden Ankh-Re-Defeat ist unnegierbar.
* **Play Money:** Rabatt bleibt an der Handkarte, auch bei Handverschiebung; Boden 0.
* **MOE Bomb / Remote Detonator / Poisoned Meat (ohne Fremd-Kreatur):** Schaden, Löschen, Gift korrekt.
* **Kartenbilanz:** in allen eigenen Läufen `t.audit()` leer und keine verschluckten Engine-Fehler.
