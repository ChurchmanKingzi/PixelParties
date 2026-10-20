# N5-sonstige – Nischenfall-Bericht (Welle 23, Tiefentest)
Stand/Autor: Agent N5-sonstige, 20.10.2026 (Basis 3ebcbee, Zweig `wave23/W23e`). Karten: 48 in der Liste · 45 gezielt auf L2 getestet · 3 auf L1 (Sacred Blade, Kerthwack: reine Deckbau-Klauseln; Elixir of Quickness: Standard) · 12 Befunde (1 × A, 10 × B, 1 × C).

## Zusammenfassung
Die 48 gemischten Karten (Guardian Beasts, Pacman, Idej, Artefakte, Helden, Attacks/Abilities/Tränke, Reaktionszauber, Zauber) wurden über beide Sitze mit den echten Spielwegen geprüft (Dauerfeuer und Kaltstart-Batterie ohne Auffälligkeit, dazu rund 70 gezielte Szenarien). Die wichtigsten Befunde:
**(1)** N5-09 *(A)*: The Melting taut eine per Cold Coffin eingefrorene Kreatur wieder auf, wenn sie schon in der Hand liegt, während der Freeze entsteht – die „unheilbar"-Marke wird erst nach dem Reaktionsfenster gesetzt. **(2)** N5-02: Die Beschwörungssuche aller drei Harpyformer (Country/Metal/Rap) und Red Dragoneer fragt unter Such-/Hand-Sperre trotzdem, tut nichts und stempelt den Effekt nicht als gefizzelt – Sandy Blob feuert (Gegenstück zu Wunsch R4). **(3)** N5-12: Magic Amethyst sieht Abilities in Support Zonen (Xal/Xalibur, Cloak of Edge) nicht – Weird Doll & Co. schon. **(4)** N5-03: Die Gigantisaur-Regel „1 pro Held" zählt nach Kontrolleur statt nach Brettseite des Helden (der zentrale Übernahme-Prüfer rechnet richtig). **(5)** N5-01: Treacherous Crystal nimmt „all Creatures you control" nur nach `inst.owner`, übersieht damit vom Halter kontrollierte seitenfremde Kreaturen.
Gesamteindruck: sehr stabil (keine Engine-Fehler, keine Hänger, Zustand/Bilanz sauber); die Befunde liegen fast alle in Kontroll-/Sperren-Randfällen und in Fenstern, die nur für einen Teil der Reaktionswege verdrahtet sind. Bewusst nicht getestet: 3-/4-Sitz-Tische, CPU/MCTS-Wege, Client-Oberfläche (Deck-Editor-Regeln von Sacred Blade/Mirror/Kerthwack liegen in `app-shared.jsx`, nicht headless).

## Befunde

### N5-01 · Treacherous Crystal: vom Halter kontrollierte Kreatur auf der Gegenseite wird nicht übernommen · Stufe B
- **Karten:** Treacherous Crystal (`cards/effects/treacherous-crystal.js`, Handler `doTriggerTreacherousCrystal` in `server.js`)
- **Voraussetzungen / Aufbau:** Sitz H (Halter) hat den Kristall auf der Hand. Eine Kreatur X steht in der Support Zone eines Helden des Aktivierers A (Brettseite A, `inst.owner` = A), wird aber von H kontrolliert (`controller` = H, `counters.crossSideControlled` = H – der Zustand nach Beschwörung über einen geliehenen Helden bzw. Guard Change). Zusätzlich eine normale Kreatur von H auf seiner Seite (Gegenprobe). Beide Sitze, beide Rollen.
- **Schritte:** 1. A ist am Zug und klickt den Kristall in H's Hand (`trigger_treacherous_crystal`). 2. Kontrollen der Kreaturen lesen.
- **Erwartet** (Kartentext „your opponent may take control of all Creatures you control during their turns"; Ruling Styx 28.9.: „bestohlen wird der Kontrolleur", `actionStealCreature` rechnet mit `inst.controller ?? inst.owner`): alle Kreaturen, die H kontrolliert, auch X, gehen für den Zug an A.
- **Beobachtet:** Die Kreatur auf H's Seite wird übernommen (Gegenprobe ✓), X bleibt bei H (`controller` unverändert): die Schleife filtert mit `inst.owner !== oi` (Brettseite) statt nach Kontrolle.
- **Repro:** `docs/niche-tests/repro/N5-sonstige/01-treacherous-crystal-fremdseitig-kontrollierte-kreatur.js` (der Handler ist nicht exportiert; der Repro schneidet die echte Funktion aus `server.js` aus und führt sie mit Stub-Helfern aus)
- **Vermutete Ursache:** `server.js:9530` (`if (inst.owner !== oi) continue;`) und `:9532` (`inst.stolenBy != null`). Die Schleife soll nach `(inst.controller ?? inst.owner) === oi` filtern; `actionStealCreature` (`_engine.js:27538`) macht das Übrige.

### N5-02 · Harpyformer-/Red-Dragoneer-Suche unter Such-/Hand-Sperre: gefragt, nichts gefunden, Effekt nicht als gefizzelt gestempelt (Sandy Blob feuert) · Stufe B
- **Karten:** Country Harpyformer, Metal Harpyformer, Rap Harpyformer, Red Dragoneer (Sparkfly-/Deepsea-Familie nicht geprüft)
- **Voraussetzungen / Aufbau:** Sitz S mit Sandy Blob auf dem Brett, Hand = die Karte, Deck enthält das Suchziel (Adventurousness/Fighting/Decay Magic bzw. Blue-Ice Dragon). Zustände: keine Sperre (Gegenprobe), `ps.searchLocked`, `ps.handLocked`. Kontrolle: kein Treffer im Deck.
- **Schritte:** 1. Karte beschwören, Fragen mit Ja beantworten. 2. Gemessen: Karte auf der Hand? Blob-Schaden (50)?
- **Erwartet** (Ruling W11/R4, Al: „Nein, die sollen auch nicht auslösen. Nur ein wirklich feuernder Effekt löst Sandy Blob aus!" – leeres Suchen/abgelehntes „you may" ⇒ `summonEffektFizzelt(…, { stumm: true })`): wo die Suche gesperrt ist, wirkt der Effekt nicht; Blob bleibt stumm (Red Dragoneer macht das für `handLocked` bereits so).
- **Beobachtet:** Ohne Sperre feuert der Blob (✓), ohne Treffer bleibt er stumm (✓). Unter Such-Sperre (alle vier Karten) und Hand-Sperre (die drei Harpyformer) wird erst die Ja/Nein-Frage bzw. die Galerie gezeigt, `searchDeckForNamedCard` bricht still ab (keine Karte auf der Hand) – und der Blob schlägt trotzdem für 50 zu (`_summonFizzledTurn` nicht gesetzt).
- **Repro:** `docs/niche-tests/repro/N5-sonstige/02-sperre-suche-beschwoerungseffekt-ohne-fizzle-stempel.js` (14 × ✗)
- **Vermutete Ursache:** `country-harpyformer.js:39-43`, `metal-harpyformer.js:42-46`, `rap-harpyformer.js:45-49` prüfen nur `mainDeck.includes(…)`; `red-dragoneer.js:139` prüft nur `handLocked`, nicht `searchLocked`. `engine.searchDeckForNamedCard` (`_engine.js:11265`) gibt bei `_isSearchBlocked` still `null` zurück – der Aufrufer wertet das nicht als Fizzeln. Fix-Richtung: vor der Abfrage `engine._isSearchBlocked(pi, {}, 'deck')` prüfen und `summonEffektFizzelt(…, { stumm: true })` rufen (oder das `null` auswerten).

### N5-03 · Gigantisaur „1 pro Held" zählt nach Kontrolleur statt nach Brettseite des Helden · Stufe B
- **Karten:** Gigantisaur Triceras (stellvertretend; gemeinsamer Helfer `_gigantisaurs-shared.js` für Ankylos, Brachion, Chimera, Pteranos, Raptoren …)
- **Voraussetzungen / Aufbau:** (b) Eine Gigantisaur-Kreatur steht in der Support Zone von MEINEM Held 0, wird aber vom Gegner kontrolliert (`controller` = Gegner, `crossSideControlled`). (c) Meine Gigantisaur steht auf Held 0 der GEGENSEITE (von mir kontrolliert). Danach versuche ich, Triceras auf meinen Held 0 zu beschwören. (a) Gegenprobe: eigene Gigantisaur auf demselben Helden.
- **Erwartet** (Kartentext „A Hero can only have 1 "Gigantisaur" Creature in its Support Zones at a time"; derselbe Prüfer `engine.uebernahmeUnzulaessig` (A07-31/W16d) zählt für diese Regel nach `physicalSide(c) === zielSeite && c.heroIdx === zielHeroIdx`): (b) gesperrt, weil in der Zone meines Helden schon eine Gigantisaur liegt; (c) erlaubt, weil die Kreatur gar nicht in den Zonen meines Helden liegt.
- **Beobachtet:** (a) ✓ gesperrt. (b) Triceras wird beschworen (zwei Gigantisaurier auf einem Helden); `uebernahmeUnzulaessig` meldet für denselben Zustand `gigantisaur_per_hero`. (c) Beschwörung wird verweigert, obwohl keine Gigantisaur in meinen Zonen steht.
- **Repro:** `docs/niche-tests/repro/N5-sonstige/03-gigantisaur-pro-held-nach-kontrolle-statt-brettseite.js` (4 × ✗)
- **Vermutete Ursache:** `_gigantisaurs-shared.js:64` (`(c.controller ?? c.owner) !== pi`) und `:60-72` vergleicht nur `heroIdx`, nicht die Brettseite (`engine.physicalSide(c) === pi`); die Karten-Zone eines Helden ist seitengebunden, nicht kontrollgebunden. Dieselbe Zählung steht in der Karten-weiten Variante (`:144`, `:160`).

### N5-04 · Cute Camera: in Hand-Reaktionsfenstern (z. B. MOE Shield nach der Zielwahl) nie anbietbar · Stufe B
- **Karten:** Cute Camera (`cute-camera.js`), Gegenstück Front Soldier (`front-soldier.js`)
- **Voraussetzungen / Aufbau:** Sitz S: Hand [Fireball, Cute Camera], 100 Gold. Sitz O: Hand [MOE Shield] bzw. [Silence] (Gegenprobe), jeweils Wirker mit passender Schule; `policy.confirm = true`.
- **Schritte:** 1. S spielt Fireball auf einen Helden von O. 2. O reagiert (Silence im Kettenfenster; MOE Shield im Post-Target-Fenster). 3. Prüfen, ob S die Kamera angeboten bekommt.
- **Erwartet** (Kartentext „Play this card immediately when your opponent plays a Reaction Spell or Artifact in reaction to your card or effect. Negate that reaction."; Wunsch Front Soldier, CARD_API „FRONT SOLDIER" Weg ③: „when your opponent plays a Reaction" gilt auch für die Hand-Reaktionsfenster – dort hängt der Hook `onReactionPlayed`): MOE Shield ist eine Reaction Spell auf S' Fireball; die Kamera darf sie negieren, Fireball trifft.
- **Beobachtet:** Silence (Kette): Kamera wird angeboten und negiert ✓. MOE Shield (Post-Target-Fenster, kein Kettenglied): es erscheint nur O's Bestätigung, S' Kamera wird nie angeboten, MOE Shield negiert Fireball (0 Schaden), die Kamera bleibt auf der Hand.
- **Repro:** `docs/niche-tests/repro/N5-sonstige/04-cute-camera-nicht-im-hand-reaktionsfenster.js` (4 × ✗)
- **Vermutete Ursache:** `cute-camera.js:19` kennt nur `reactionCondition` (Kettenfenster); anders als `front-soldier.js` hat sie keinen Hook an `engine._reaktionGespielt` / `onReactionPlayed` (`_engine.js:35392`, gerufen aus `_rxHandkarteEinsetzen` `:35402`). Betroffen sind alle Reaktionen, die in den Hand-Fenstern (Post-Target, Schaden, Tod …) gespielt werden. Nebenbefund: `reactionCondition` prüft den Kartentyp der Reaktion nicht (Text: nur „Reaction Spell or Artifact"); nicht belegt.

### N5-05 · Cute Wings: Kreatur im Wings-Helden zählt bei Cute Conversion nicht als „Cute" · Stufe B
- **Karten:** Cute Wings (`cute-wings.js`), Cute Conversion (`cute-conversion.js`)
- **Voraussetzungen / Aufbau:** Held 0 mit Magic Arts 1 (Cute Conversion ist Stufe 2); Held 1 mit Cute Wings und einer Dummy-Kreatur in einer Zone; Gegner hat eine Kreatur. Vergleich: Kreatur mit „Cute" im Namen, Dummy ohne Wings, leeres Brett.
- **Erwartet** (Wings: „All Creatures that Hero summons count as "Cute" Creatures"; Wings-Kopf: Kreaturen in der Zone des Trägers zählen über `isCuteCreatureInst` als Cute – Pink Sky nutzt das; Conversion: „This Spell's level in your hand is reduced by the number of "Cute" Creatures you control"): die Dummy-Kreatur senkt die Stufe um 1, Cute Conversion ist mit Magic Arts 1 spielbar.
- **Beobachtet:** Kreatur mit „Cute" im Namen senkt (✓), Dummy ohne Wings nicht (✓), Dummy im Wings-Helden: Stufe unverändert, Karte nicht spielbar (`isCuteCreatureInst` meldet für dieselbe Kreatur `true`).
- **Repro:** `docs/niche-tests/repro/N5-sonstige/05-cute-wings-zaehlt-bei-cute-conversion-nicht.js` (2 × ✗)
- **Vermutete Ursache:** `cute-conversion.js:61-71` (`cuteKreaturen`) zählt nur `isCuteCreatureCard(cd)`; die Instanz-Variante `isCuteCreatureInst` (`_cute-shared.js:84`) kennt Wings. Q24-Umstellung (Namen zählen) hat die Board-Lesart bei diesem Zähler nicht mitgenommen.

### N5-06 · Chuck, the Crazy Veteran: Anti-Magic-Immunität der anderen Helden zählt nicht als „immun gegen diese Quelle" · Stufe C
- **Karten:** Chuck, the Crazy Veteran (`chuck-the-crazy-veteran.js`), Anti Magic
- **Voraussetzungen / Aufbau:** Sitz S: Chuck (Held 0), Held 1 mit Anti Magic (Spell-Immunität bis Stufe 2; Kontrolle: Fireball auf Held 1 → 0 Schaden), Held 2 tot. Gegner wirkt Fireball (Stufe 2) auf Chuck. Gegenprobe: Held 1 `shielded` statt Anti Magic.
- **Erwartet** (Kartentext „This Hero takes no damage from any sources, unless all other Heroes you control are immune to that source of damage."): der einzige andere lebende Held ist gegen genau diese Quelle (Fireball = Zauber) immun, also nimmt Chuck 150 Schaden.
- **Beobachtet:** `shielded` (✓): Chuck nimmt 150. Anti Magic: Chuck nimmt 0 (Schild hält) – `_isImmuneToSource` kennt nur Statusmarken (tot, shielded, gou_protected, submerged, immune, <Status>_immune), keine Immunität durch Anhängsel (Anti Magic; ebenso Status-Immunität durch Stoneskin/Light Ball bei Gift/Brand – nicht gemessen).
- **Repro:** `docs/niche-tests/repro/N5-sonstige/06-chuck-schild-ignoriert-anti-magic-immunitaet.js` (2 × ✗)
- **Vermutete Ursache:** `chuck-the-crazy-veteran.js:66-87` (`_isImmuneToSource`, Kommentar „deliberately conservative"). Eine Entscheidung von Al dazu gibt es nicht.
- **Frage an Al:** Soll ein Held, der durch Anti Magic gegen Zauber (bis Stufe N) immun ist, für Chucks Schild als „immun gegen diese Quelle" gelten (dann nimmt Chuck Zauberschaden, wenn alle anderen Helden so geschützt/tot sind) – ja oder nein? (Heute: nein, nur Statusmarken zählen.)

### N5-07 · Potion of Greed: spielbar, obwohl das Ziehen aus dem Potion Deck unmöglich ist (nur der Nachteil bleibt) · Stufe B
- **Karten:** Potion of Greed (`potion-of-greed.js`); Vergleich Potion Juggler
- **Voraussetzungen / Aufbau:** Sitz S in Main Phase 1, Hand [Potion of Greed]. Zustände: Potion Deck 5 Karten (Gegenprobe), `ps.potionDrawBanned` (Chaos-Diamond-/Pinta-Starthelden: „never draw from the Potion Deck"), Potion Deck leer.
- **Erwartet** (Regel D1 von Al, Kopf von `potion-of-greed.js` und `_draw-block-shared.js`: „Zug + Nachteil – der Zug ist der ganze Nutzen: unter Zieh-Sperre nicht spielbar"; Potion Juggler sperrt bei `potionDrawBanned` und zu kleinem Potion Deck): nicht spielbar, wenn nichts gezogen werden kann.
- **Beobachtet:** Gegenprobe ✓. Bei `potionDrawBanned` und bei leerem Potion Deck wird die Karte gespielt, zieht 0 Karten, `ps._skipActionPhaseTurn` ist gesetzt – die Aktionsphase entfällt für nichts. (Leeres Deck ist die schwächere Lesart: kein Ruling dazu; `potionDrawBanned` ist dieselbe Klasse wie Zieh-Sperre.)
- **Repro:** `docs/niche-tests/repro/N5-sonstige/07-potion-of-greed-spielbar-ohne-ziehmoeglichkeit.js` (4 × ✗)
- **Vermutete Ursache:** `potion-of-greed.js:38-44` (`canActivate`) prüft `drawWouldBeBlocked` (Tuscan Artist), `handLocked`, Phase – nicht `potionDrawBanned` und nicht `potionDeck.length`; `resolve` zieht still nichts (`actionDrawFromPotionDeck` `_engine.js:12012`: `if (ps.potionDrawBanned) return []`). Vorbild: `potion-juggler.js:104` (`ziehenMoeglich`).

### N5-08 · Controlled Attack: vom Gegner kontrollierter Held der eigenen Spalte nicht wählbar · Stufe B
- **Karten:** Controlled Attack (`controlled-attack.js`); Vergleich Magic Ruby
- **Voraussetzungen / Aufbau:** Sitz S mit Controlled Attack und Magic Ruby (je eigener Lauf). Mein Held 2 wird vom Gegner kontrolliert (temporär per Charme `actionStealHero` oder dauerhaft `actionTakeHeroPermanently`).
- **Erwartet** (Kartentext „Choose a Hero your opponent controls."; W22 „Hero you control" = aktueller Kontrolleur; Magic Ruby/Cobalt wurden dafür auf Kontrolle umgestellt, Eintrag F02-08): auch der vom Gegner kontrollierte eigene Held ist wählbar (ich nutze dann seine Abilities).
- **Beobachtet:** Magic Ruby bietet `S:2` an (✓). Controlled Attack bietet nur die Helden der Gegenspalte; der vom Gegner kontrollierte eigene Held fehlt (temporär und dauerhaft). Normale Gegnerhelden ✓, vom Wirker selbst kontrollierte Gegnerhelden fehlen korrekt.
- **Repro:** `docs/niche-tests/repro/N5-sonstige/08-controlled-attack-held-den-der-gegner-kontrolliert.js` (4 × ✗)
- **Vermutete Ursache:** `controlled-attack.js:24` nutzt `promptDamageTarget({ side: 'enemy' })`; der generische Picker (`_engine.js:4986` `addHeroes`, `:5035`) addiert für `'enemy'` nur die Helden der Gegenspalte (minus die vom Wirker geladenen) und die Gegenspalte-Helden unter Kontrolle des Wirkers nur für `'my'/'any'`; die Helden der eigenen Spalte unter Gegnerkontrolle fehlen für `'enemy'`. Die Klasse „enemy-only Heldenwahl" betrifft jede Karte, die so wählt; hier nur Controlled Attack gemessen.

### N5-09 · The Melting taut Cold-Coffin-Kreaturen im Fenster ihres eigenen Freeze auf · Stufe A
- **Karten:** The Melting (`the-melting.js`), Cold Coffin (`cold-coffin.js`)
- **Voraussetzungen / Aufbau:** Sitz O hat The Melting auf der Hand (Support Magic 1, ein nicht eingefrorener Held als Wirker) und besitzt eine Kreatur K. Sitz C wirkt Cold Coffin auf K (Pollution-Kosten bezahlt). Gegenprobe: The Melting kommt erst NACH dem Cold Coffin auf die Hand und reagiert auf einen anderen Freeze (Icebolt auf einen Helden).
- **Erwartet** (Cold Coffin: „Freeze it for the rest of the game. If the target is a Creature, this Freeze cannot be healed."; The Melting: „Heal all Frozen targets on the board from their Freeze"): die unheilbare Kreatur bleibt gefroren, egal wann The Melting spielt.
- **Beobachtet:** Gegenprobe ✓ (bleibt gefroren). Liegt The Melting schon bei Entstehung des Freeze auf einer Hand (der Repro prüft den Kreaturenbesitzer O; gemessen ist es auch, wenn der Wirker C selbst sie hält), öffnet sich das Reaktionsfenster `onStatusApplied` noch innerhalb von `applyCreatureStatus`; The Melting taut die Kreatur sofort. Log: `cold_coffin` → `freeze_applied` → `the_melting` → `status_remove`; am Ende `frozen` weg, `frozenUnhealable` steht noch (Zustand widerspricht sich).
- **Repro:** `docs/niche-tests/repro/N5-sonstige/09-the-melting-taut-cold-coffin-kreatur-im-eigenen-fenster.js` (2 × ✗)
- **Vermutete Ursache:** `cold-coffin.js:130-138`: `await engine.applyCreatureStatus(inst, 'frozen', …)` (Fenster öffnet sich darin), erst danach `inst.counters.frozenUnhealable = true`. Fix-Richtung: die Marke über eine Option von `applyCreatureStatus` VOR dem Fenster setzen (wie `frozenDuration`), nicht danach. Gleiche Klasse: jeder „unheilbar"-Stempel, der nach dem Status-Aufruf gesetzt wird.

### N5-10 · Glimpse of the Future: Angebot und dauerhafte Aufdeckung auch dann, wenn das Ziehen unmöglich ist · Stufe B
- **Karten:** Glimpse of the Future (`glimpse-of-the-future.js`); Vergleich Grasp the Future
- **Voraussetzungen / Aufbau:** Das Startblatt-Fenster läuft im laufenden Spiel über Traveler from the Future (Resource Phase, `processStartingHandDraw(…, { window: 'resource' })`). Zustände: frei (Gegenprobe), Tuscan Artist beim Gegner (negiert „draw 2 or 3"), `drawLocked`, `handLocked`.
- **Erwartet** (Regel D1 / Tuscan-Artist-Ruling 16.8.: „Ist der Zug der einzige Nutzen … ist der Effekt GESPERRT"; Grasp the Future: `skipIfSearchBlocked` – „unter der Such-Sperre kein Angebot"; Glimpse deckt die Karte dauerhaft auf, `revealHandCopy`, der Gegner sieht sie): kein Angebot, keine Aufdeckung.
- **Beobachtet:** Gegenprobe ✓ (Angebot, 2 Karten, aufgedeckt). In den drei Sperrzuständen fragt das Fenster, deckt die Karte dauerhaft auf, zieht 0 Karten. Grasp unter Such-Sperre: kein Angebot ✓.
- **Repro:** `docs/niche-tests/repro/N5-sonstige/10-glimpse-angebot-bei-unmoeglichem-ziehen.js` (6 × ✗)
- **Vermutete Ursache:** `glimpse-of-the-future.js:35-48` (`startingHand.resolve`) ruft `promptStartingHandYesNo` ohne vorherigen Zieh-Sperren-Test (`drawWouldBeBlocked` aus `_draw-block-shared.js`, `ps.drawLocked`, `ps.handLocked`); `grasp-the-future.js:44` zeigt das Muster.

### N5-11 · Piercer of Heavens: Zielwahl ohne Abbrechen-Knopf · Stufe B
- **Karten:** Piercer of Heavens (`piercer-of-heavens.js`); Gegenprobe Rockfall
- **Voraussetzungen / Aufbau:** Sitz S spielt Piercer (bzw. Rockfall) auf einen Helden des Gegners; gemessen wird `config.cancellable` der Zielwahl (`t.targets`).
- **Erwartet** (CARD_API „ZIELENDE KARTEN SIND IMMER ABBRECHBAR … MANDATORY": jede Zielwahl hat Cancel; Ausnahme nur nach dem Zusagepunkt oder als vom Text erzwungene Pflichtwahl – dann mit Kommentar `// pflichtwahl:`): abbrechbar.
- **Beobachtet:** Rockfall `cancellable: true` ✓; Piercer `cancellable: false` – ein Mensch kann den Zauber vor dem Commit nicht mehr zurücknehmen, ohne Begründung im Skript. Die Stelle steht im Ratschen-Altbestand von `scripts/check-target-cancel.js` (`target-cancel-baseline.json:51`), wurde aber nie durchgesehen. (Die Harness-Abbruchprobe verdeckt das, weil sie den Abbruch unabhängig vom Flag liefert.) Metal/Rap Harpyformer stehen ebenfalls dort, haben aber die Begründung „Ability schon abgeworfen" (Kosten bezahlt) – vertretbar, nicht gemeldet.
- **Repro:** `docs/niche-tests/repro/N5-sonstige/11-piercer-of-heavens-zielwahl-nicht-abbrechbar.js` (2 × ✗)
- **Vermutete Ursache:** `piercer-of-heavens.js:71` (`cancellable: false`, daneben `_skipPostTargetReactions: true`); Korrektur: `cancellable: true` und Abbruchweg wie bei Rockfall.

### N5-12 · Magic Amethyst ignoriert Abilities in Support Zonen (Xal/Xalibur, Cloak of Edge) · Stufe B
- **Karten:** Magic Amethyst (`magic-amethyst.js`); Vergleich Weird Doll
- **Voraussetzungen / Aufbau:** Gegnerheld 0 trägt über Xalibur eine Ability (Leadership) in einer Support Zone bzw. Cloak of Edge („treated as an Ability"); Varianten: nur Support-Ability, Support-Ability + Ability in der Ability Zone, Gegenprobe nur Ability Zone.
- **Erwartet** (Kartentext „Your opponent chooses an Ability attached to that Hero and discards it."; Engine-Konvention `collectSupportZoneAbilities` – „Karten, die Abilities wählen, finden sie" (Befund 5.9.), Weird Doll, Idej Sword – Onima, Jenny, Charme lesen sie): die Support-Zonen-Ability ist wählbar, die Karte ist bei einem Helden, der nur solche trägt, spielbar.
- **Beobachtet:** Ability Zone ✓. Nur Support-Ability: Amethyst nicht spielbar (Held gilt als „ohne Abilities"). Beides: die Galerie führt nur die Ability-Zonen-Ability auf. Weird Doll bietet Leadership/Cloak of Edge im selben Zustand an.
- **Repro:** `docs/niche-tests/repro/N5-sonstige/12-magic-amethyst-ignoriert-abilities-in-support-zonen.js` (10 × ✗)
- **Vermutete Ursache:** `magic-amethyst.js:22` (`_heroHasAbilities`), `:42` (`_buildAbilityGallery`) und `:84` (CPU-Gate) lesen nur `ps.abilityZones[hi]`; Ergänzung um `engine.collectSupportZoneAbilities(oi, hi)` (inkl. Entfernen über den passenden Weg, `discardAbilityTopCopy`). Bezug: F02-08 betrifft nur die Zielwahl nach Kontrolle, nicht diese Lücke.

## Abdeckung
| Karte | Tiefe | Geprüfte Nischenfälle / Anmerkung |
|---|---|---|
| Country Harpyformer | L2 gezielt | erste Kreatur = Zusatzaktion (frei/nicht frei), Off Duty gegen inhärente Beschwörung (Zähler bleibt 0) ✓, gestohlen (Dieb nutzt, Gold/Ablage des Diebes) ✓, Such-/Hand-Sperre ✗ (→ -02) |
| Gigantisaur Triceras | L2 gezielt | Abwurf+3 ziehen, Hand leer/1 Karte/Deck 2, Zieh-Sperre (nur Abwurf, nach Ruling), gefrorener Wirt, gestohlen ✓; „1 pro Held" nach Kontrolle ✗ (→ -03) |
| Metal Harpyformer | L2 gezielt | wie Country; 50 Schaden auf gestohlener Seite ✓, Zielwahl nach Kosten nicht abbrechbar (Begründung im Skript, nicht gemeldet); Sperren ✗ (→ -02) |
| Rap Harpyformer | L2 gezielt | wie Country; Gift-Pfad nicht vertieft; Sperren ✗ (→ -02) |
| Sorbereus, the Adapting Dragon | L2 gezielt | Schaden = aktuelle ATK (Fighting 3 → 80, Curse → 0, Chuck → 0), eigener Held, gefrorenes Ziel, Abbruch gibt HOPT frei, gestohlen ✓ |
| Red Dragoneer | L2 gezielt | Zählung „other Drago", Suche, gestohlen (nur eigene Drago zählen) ✓; Such-Sperre ✗ (→ -02) |
| Treacherous Crystal | L2 gezielt | Handler aus `server.js` ausgeschnitten; Aufdecken beim Ziehen und Index-Mitführung bei Abwurf/Spielen ✓, Rückgabe zu Zugbeginn ✓; seitenfremd kontrollierte Kreatur ✗ (→ -01) |
| Trial of Loyalty | L2 gezielt | bis 5 verschiedene Trials, zweite Kopie, Riegel nach dem Spielen (Fireball/Loyalty #2 gesperrt) ✓, Einmal-pro-Spiel; negiert (The Master's Plan) stempelt nichts und setzt keine Sperre (nach Z7b gewollt) |
| Elven Archer | L2 gezielt | Zusatzaktion nur mit kontrolliertem Elven (gestohlen/entzogen), Kette Archer-Archer ✓ |
| Elven Forager | L2 gezielt | Stufensenkung nur eigene Kreaturen, gefrorener/negierter Träger, selbst negiert (ruht), gestohlen ✓ |
| Idej Blade - Gensui | L2 gezielt | Stufe −1 nur für den Träger, nur Zauber der Schule, Reaktionsfenster (Off Duty, Surprising Opportunity), Equip nur auf Idej-Held des Kontrolleurs (normal/temporär/dauerhaft) ✓ |
| Idej Blade - Manabi | L2 gezielt | wie Gensui; Triumphant Return mit Manabi ✓ |
| Idej Blade - Naosu | L2 gezielt | wie Gensui; Brilliant Idea ✓ |
| Cute Camera | L2 gezielt | Kette ✓ (Silence), Hand-Reaktionsfenster ✗ (→ -04); Party-Crasher-Pfad nicht erreichbar gemacht |
| Cute Wings | L2 gezielt | Zählung bei Cute Conversion ✗ (→ -05); Pink-Sky-/Mary-Pfade nur gelesen |
| Magic Amber | L2 gezielt | Behalten (Abwurf, zwei Kopien, ablehnen, allein), HOPT ✓, Kartenbilanz ✓; Erst-Runden-Schutz: wirkungslos aber spielbar (Mischeffekt, bewusste Auslegung) |
| Magic Amethyst | L2 gezielt | Behalten ✓, Fighting-Stapel (ATK −10/−10/−20 beim Abwerfen) ✓; Support-Zonen-Abilities ✗ (→ -12) |
| Magic Emerald | L2 gezielt | 3 Karten Mill, Behalten, HOPT ✓ |
| Magnetic Glove | L2 gezielt | Such-/Hand-Sperre und leeres Deck sperren die Karte, Pile-Lock egal, HOPT ✓ |
| MOE Bomb | L2 gezielt | 999 auf alle Kreaturen beider Seiten (auch seitenfremd kontrollierte, Besitzer-Ablage ✓), 1000-HP-Kreatur lebt, Token/Cardinal/Ausrüstung unberührt, Kosten 20 ✓ |
| Secret Spell Book | L2 gezielt | Anhängsel auf Gegnerheld wird zurückgeholt (Wahl der Zone), temporär gestohlen/dauerhaft/umgesetzt (stolenBy bleibt kurz stehen, harmlos), Helden temp./dauerhaft/tot, nach Zugwechseln stabil ✓ |
| The Sacred Blade | L1 | nur Deckbau-Klausel (`neverPlayable`), Regel in `app-shared.jsx`, nicht headless; Batterien ✓ |
| The Sacred Mirror | L2 gezielt | 61/60/75 Karten, Zieh-/Hand-Sperre, zwei Kopien (Deck sinkt unter 61) ✓ |
| Bomb Berserker Bartas | L2 gezielt | Zweitziel bei Fireball/Rockfall/Pressure Projectile, Stufe nicht < DM (Piercer/Rockfall bei DM2) ✓, beide Sitze |
| Chuck, the Crazy Veteran | L2 gezielt | Schild mit/ohne Mitspieler, shielded-Mitspieler, allein/tot ✓; Anti-Magic-Immunität ✗ (→ -06, C); True Damage durchbricht (Ruling) |
| Kerthwack, the Reality Breaker | L1 | nur Deckbau (`public/potion-deck-clauses.js` über `require` gemessen: Zulassung, 3 Kopien, Größen); Editor-Logik in JSX nicht headless |
| Timeless King Zi | L2 gezielt | Fireball/Meditation/Trial of Loyalty/Guardian Angel (Brett)/Curse (ohne Ziel → Ablage)/Rockfall, gelöschte Karten, Kartenbilanz ✓, unter Controlled Attack mit dem Deck des Steuerers ✓ |
| Critical Strike | L2 gezielt | 2× aktuelle ATK (Fighting 3 → 160/140), Curse → 0, gefrorenes Ziel, Kreatur ✓ |
| Elixir of Quickness | L1 Standard | Zug 3, leeres Haupt-Deck (spielbar, zieht nichts – Ruling-Lücke nicht belegt), Batterien ✓ |
| Fighting | L2 gezielt | Stapel 10/10/20, Rücknahme beim Abwerfen (Amethyst), Critical Strike/Heavy Hit mit Fighting 3 ✓ |
| Healing Potion | L2 gezielt | Held/Kreatur, Mirjam (fizzelt nach Ruling v1467), beide Seiten ✓ |
| Heavy Hit | L2 gezielt | ATK-Schaden + Stun, Curse (0 Schaden, Stun bleibt), gefrorenes Ziel ✓; Beobachtung: stirbt die Kreatur am Schlag, wird sie noch „gestunnt" (Log + Bild auf leerer Zone) – harmlos, nicht gemeldet |
| Mana Mining | L2 gezielt | −1/−2/−3 nur für Pollution-Zauber des eigenen Trägers (Cold Coffin, Eraser Beam), Fireball unberührt, Surprise Magic Mirror ✓ |
| Petrifying Potion | L2 gezielt | Stun 3 Züge des Ziels (Dauer nach echten Zugwechseln ✓), Schaden 0 (außer True Damage – Ruling) ✓ |
| Potion of Greed | L2 gezielt | Aktionsphase wird übersprungen (Phase → Main 2) ✓; unmögliches Ziehen ✗ (→ -07) |
| Smoke Vial | L2 gezielt | Blinded bis Ende des nächsten eigenen Zuges (T+3-Ablauf ✓), Charme-Schutz hält gestohlene Helden frei (Ruling) |
| Off Duty | L2 gezielt | inhärent (Harpyformer) ohne Ersatzaktion und Zähler 0, normale Kreatur, Beschwörung über geliehenen Helden → Deck des Beschwörers ✓ |
| Surprising Opportunity | L2 gezielt | 2 Karten aus den Support Zones (Token bleiben), Karten in die Hand des Spielers, beide Besitzer ✓ |
| The Melting | L2 gezielt | taut alles Gefrorene, Zugende nur mit DM1 im Gegnerzug ✓; Cold-Coffin-Kreatur im eigenen Fenster ✗ (→ -09) |
| Trample Sounds in the Forest | L2 gezielt | Aufstieg Dajan: Aktion mit dem Aufgestiegenen, zweite Kopie gleiche Runde gesperrt, MA beim Aufsteiger/anderem Held ✓ |
| Triumphant Return | L2 gezielt | Zusatzaktion mit dem Wiederbelebten, auch im Gegnerzug, Wirker ≠ Wiederbelebter, gefrorener Wirker ✓ |
| Brilliant Idea | L2 gezielt | Such-/Hand-Sperre, leeres Deck sperren die Karte, Abbruch beim Bestätigen ✓ |
| Controlled Attack | L2 gezielt | Marke wird zum Zugwechsel gelöscht, Zi unter Kontrolle nutzt Deck/Ablage des Steuerers, Resistance-Gate gelesen; Wahl des kontrollierten Helden ✗ (→ -08) |
| Glimpse of the Future | L2 gezielt | Kette Glimpse → Glimpse → Grasp, Startblatt-Zählung ✓; Sperren ✗ (→ -10) |
| Grasp the Future | L2 gezielt | zwei Kopien, nur Grasp auf der Hand (kein Angebot), Such-Sperre ✓ |
| Piercer of Heavens | L2 gezielt | 250 True Damage, Bartas nicht (Stufe 3 ≥ DM3); Zielwahl nicht abbrechbar ✗ (→ -11) |
| Pressure Projectile | L2 gezielt | 150 True, Anhängsel/Ausrüstung/Area-Wahl (Held stirbt, Kreatur, Mehrfachauswahl), Bartas-Zweitguss ✓ |
| Rockfall | L2 gezielt | 200 True Damage, Bartas, Abbruch ✓ |

## Getestet & in Ordnung (Auswahl)
- Dauerfeuer (alle 48 Karten, beide Sitze) und Kaltstart-Batterie (10 Varianten je Karte): keine verschluckten Engine-Fehler, keine Hänger, keine Zustands-/Bilanzauffälligkeiten, kein verändertes Ergebnis nach Abbruch jeder Zielwahl.
- Zwei Sitze × Rollen bei jedem gezielten Szenario; Kartenbilanz (`census`) und `audit()` blieben überall sauber.
- Reaktionsfenster mit Zusatzaktionen (Triumphant Return, Trample Sounds, Surprising Opportunity, Off Duty) laufen sauber auch im Zug des Gegners.
- Off Duty mischt die Kreatur in das Deck ihres Besitzers (Beschwörung über einen geliehenen Helden), die Ersatzaktion entfällt bei inhärenter Beschwörung (Harpyformer, Elven Archer).
- Idej-Blades senken den Zauberlevel in allen Fenstern (Hand-Reaktionen eingeschlossen) und nur für den Träger; Equip an temporär/dauerhaft übernommene Idej-Helden nur für den Kontrolleur.
- Chuck-Schild und True-Damage-Karten (Rockfall, Piercer, Pressure Projectile): True Damage durchbricht Schild, Petrify-Null und Chuck (so entschieden), Healing Potion fizzelt bei Mirjam (Ruling v1467).
- Secret Spell Book: Helden (temporär/dauerhaft/tot) und Kreaturen (temporär/dauerhaft/umgesetzt) kommen zurück, nach zwei Zugwechseln stabil; ein Gegner-Anhängsel des Wirkers wird zurückgeholt (Text „Spells … affected").
- Zi unter Controlled Attack: Galerie, Löschung und Ablage laufen über den Steuerer (nicht den Besitzer).
