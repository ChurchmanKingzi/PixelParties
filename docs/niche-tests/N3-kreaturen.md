# N3-kreaturen – Nischenfall-Bericht (Welle 23, Tiefentest)
Stand/Autor: Agent N3-kreaturen (Welle 23, Arbeitskopie W23c, Basis 3ebcbee), 20.10.2026. Karten: 40 in der Liste (Kreaturen ohne Archetyp aus C02/C04, bisher L0) · 40 auf L2 gebracht · 20 Karten mit mindestens einem Befund (21 Befunde; N3-06 liegt zusätzlich an der nicht gelisteten Karte Suspicious Monster).

Kartenliste: Demon's Gate, Disgruntled Forest Warden, Doomed Town Guard, Drill Sergeant, Duigno the Flaming Phoenix, Ellie the Class President, Elusive Hind, Embodiment of Biseria, Empty Armor, Enhanced Guard Dog, Ethan the Prodigy, Explosive Drone, Festive Werz, Field Cannon, Foresta the Guard, Frolake, Front Soldier, Gangster Angel, Gerrymander, Ghoul Guard, Plant Golem, Populated Island Turtle, Potion Juggler, Powder Keg, Psychic Scout, Pyraga, Realmniversal Emperor, Sarcophagus of Sealed Magic, Scavenging Crane, Sentient Bomb Golems, Sky Archeologist, Sky Shaman, Slave Trader, Spearman, Spirit of the Barbarian Sword / Forbidden Grimoire / Heart Bow / Relic Hammer / Shattered Trident / Super-Killing Knife.

## Zusammenfassung

**21 Befunde: 6 × Stufe A, 9 × Stufe B, 6 × Stufe C.** Alle mit ausgeführtem Repro unter `docs/niche-tests/repro/N3-kreaturen/` (Exit 1 + „✗" = Fehler tritt auf; jedes Repro hat Gegenproben, die grün laufen). Keine Quelle verändert.

Die fünf wichtigsten:
1. **N3-03 (A)** – fünf der sechs „Spirit of the …" prüfen „Hero equipped with X" an der Spalte des Kontrolleurs statt am beschwörenden (übernommenen) Helden: ein übernommener Held ohne Ausrüstung beschwört den Spirit, ein übernommener Held mit Ausrüstung darf es nicht (nur Relic Hammer ist richtig).
2. **N3-06 (A)** – Slave Trader deckt „Suspicious Monster" auf: die Karte steht danach **zweimal** auf dem Brett, der Slave Trader wird als „Opfer" abgelegt (Beschwörungs-Fallback `sacrificeSwapAtomar` läuft bei Effekt-Beschwörungen mit freier Zone zusätzlich zur Engine-Platzierung).
3. **N3-01 / N3-02 (A)** – Sarcophagus of Sealed Magic zählt nach Diebstahl die Schul-Abilities des Besitzers statt des Kontrolleurs; Disgruntled Forest Warden liest „controls an Ascended Hero" aus der eigenen Heldenreihe (übernommene Aufgestiegene zählen nicht, abgegebene schon) – beide verstoßen gegen die Regel „Kontrolle statt Seite" / „Hero you control: nur der aktuelle Kontrolleur" (Welle 22).
4. **N3-05 (A)** – Duignos Zweitaktion bleibt einlösbar, nachdem Duigno zerstört wurde („While you control this Creature"): die Engine findet den Zuschlag an der toten Instanz in der Ablage (`_second-action-shared.js` räumt beim Abgang nur das Abzeichen).
5. **N3-04 (B)** – Spirit of the Forbidden Grimoire: leiht man den Effekt einer GEGNERISCHEN Kreatur, wirkt er für deren Kontrolleur (Gangster Angel schießt auf den Nutzer, die Island Turtle zieht für den Gegner, Zielwahlen gehen an den Gegner).

Gesamteindruck: Die einzelnen Kartenskripte sind in der Standardlage sehr belastbar (160 Dauerfeuer-Läufe, 93 Zauber über Demon's Gate mit/ohne Abbruch, 419 Kreaturen als Slave-Trader-/Scout-/Sergeant-Ziel, 238 Artefakte als Sky-Archeologist-Fund: keine verschluckten Engine-Fehler, keine Hänger, keine Bilanzfehler außer N3-06). Die Befunde liegen fast alle an den **Rändern zwischen zwei Systemen**: Kontrolle ↔ Brettseite (N3-01/02/03/04), Effekt-Beschwörung ↔ Hand-Beschwörung (N3-06, N3-13, N3-08), Leaver-Hooks ↔ gemeinsame Aufräumpfade (N3-05, N3-12), Tribut/Kosten ↔ Schutzhaken (N3-07, N3-18).

Bewusst nicht getestet: Zugende per `sendGameState` (Gangster Angel „end your turn" und `_terrorForceEndTurn` werden erst im Server-Versand eingelöst, headless nicht prüfbar); Reaktionen anderer Spieler auf den Guss durch Demon's Gate (`_skipReactionCheck`, wie bei Skeleton Priest/Chaorc Friendly Fireballer); Manipulation von Client-Antworten außer bei Festive Werz (Drill Sergeant, Psychic Scout, Heart Bow u. a. vertrauen ebenfalls der Antwort, ohne dass es dort zu einem Regelverstoß mit gültigen Antworten führt); die Animationen (reines Client-Thema).

## Befunde

### N3-01 · Sarcophagus of Sealed Magic: gestohlen zählt er die Schul-Abilities des Besitzers · Stufe A
- **Karten:** Sarcophagus of Sealed Magic (`cards/effects/sarcophagus-of-sealed-magic.js`)
- **Voraussetzungen / Aufbau:** Sarkophag auf Seite 0 / Held 0. (a) Besitzer (Sitz 0) hat 1 Spell-School-Ability, der Dieb (Sitz 1) drei verschiedene; (b) umgekehrt. Sitz 1 stiehlt (`actionStealCreature`) und aktiviert ihn (Aufruf wie ein Mensch, `charmedOwner` = Brettseite 0).
- **Schritte:** 1. Sarkophag stehlen. 2. Aktivieren, Held 2 von Sitz 0 als Ziel.
- **Erwartet** (Kartentext: „…60 times the number of Spell School Abilities with different names attached to **your** undefeated Heroes"; Kopfkommentar des Skripts und CARD_API „Sarcophagus": „damit eine übernommene Kreatur die Party ihres Kontrolleurs liest"; Regel „Kontrolle statt Seite", Welle 22 „Hero you control: nur der aktuelle Kontrolleur"): (a) 180, (b) 60.
- **Beobachtet:** (a) 60, (b) 180 – es zählen die Helden des Besitzers (Brettseite). Ungestohlen stimmt es (Gegenproben 60 / 180).
- **Repro:** `docs/niche-tests/repro/N3-kreaturen/01-sarcophagus-gestohlen-zaehlt-schulen-des-besitzers.js` (`node …`; ✗ = Fehler tritt auf)
- **Vermutete Ursache:** `sarcophagus-of-sealed-magic.js:98` und `:106`: `pi = engine.physicalSide(card)`. Für eine gestohlene Kreatur ist `physicalSide` = `inst.owner` = Seite des Besitzers (`_engine.js:20715`), nicht die Kontrolle; `schulenZaehlen(engine, pi)` liest `gs.players[pi].heroes`. Richtig wäre `ctx.cardOwner` + `engine.heroesControlledBy` (auch übernommene Helden zählen, abgegebene nicht).

### N3-02 · Disgruntled Forest Warden: „control an Ascended Hero" liest die eigene Heldenreihe · Stufe A
- **Karten:** Disgruntled Forest Warden (`cards/effects/disgruntled-forest-warden.js`)
- **Voraussetzungen / Aufbau:** (a) Ein Aufgestiegener des Gegners (1/1, „Sparrow, the Buffoon…") ist von Sitz 0 übernommen. (b) Ein Aufgestiegener von Sitz 0 (0/1) ist vom Gegner übernommen. Warden auf der Hand von Sitz 0.
- **Schritte:** `canSummon` und echter Spielweg (`t.play`).
- **Erwartet** (Kartentext „You can only summon this Creature while you control at least 1 Ascended Hero"; Ruling Welle 22 „Karten mit ‚Hero you control': nur der aktuelle Kontrolleur"): (a) beschwörbar, (b) nicht.
- **Beobachtet:** (a) nicht beschwörbar, (b) beschwörbar. Gegenproben (eigener Aufgestiegener lebt / tot / keiner) stimmen.
- **Repro:** `docs/niche-tests/repro/N3-kreaturen/02-forest-warden-kontrolle-statt-seite.js`
- **Vermutete Ursache:** `disgruntled-forest-warden.js:34-39` (`controlsAscendedHero`): `ps.heroes.some(…)` der eigenen Seite, ohne `heroesControlledBy`/`heroSideOf`.

### N3-03 · Fünf Spirits: Beschwörer-Prüfung liest die Spalte des Kontrolleurs statt des übernommenen Helden · Stufe A
- **Karten:** Spirit of the Barbarian Sword, Forbidden Grimoire, Heart Bow, Shattered Trident, Super-Killing Knife (Relic Hammer korrekt)
- **Voraussetzungen / Aufbau:** Spirit auf der Hand von Sitz 0. (a) Sitz 0s eigener Held 0 trägt die Ausrüstung; der von Sitz 0 übernommene Gegnerheld 1/0 trägt sie nicht; Sitz 0 beschwört mit dem übernommenen 1/0 (`charmedOwner: 1`). (b) umgekehrt: nur der übernommene Held trägt sie.
- **Schritte:** `t.play(0, spirit, { hero: 0, charmedOwner: 1, slot })`.
- **Erwartet** (Kartentext „This Creature can only be summoned by a Hero equipped with «X»"; Regel Welle 20/22: nur der aktuelle Kontrolleur beschwört mit einem Helden, auch mit einem übernommenen): (a) abgelehnt, (b) angenommen.
- **Beobachtet:** (a) angenommen, (b) abgelehnt – für alle fünf. Der Spirit of the Relic Hammer verhält sich in beiden Fällen richtig (Gegenprobe im selben Repro). Eigener Held mit/ohne Ausrüstung stimmt bei allen sechs.
- **Repro:** `docs/niche-tests/repro/N3-kreaturen/03-spirits-beschwoerer-pruefung-ignoriert-kontrolle.js`
- **Vermutete Ursache:** `canPlayWithHero(gs, pi, heroIdx, …)` bekommt den Kontrolleur `pi` und den (physischen) Heldenindex; `hatSchwert`/`hatBogen`/`hatDreizack`/`hatMesser`/`hasGrimoire` (`spirit-of-the-barbarian-sword.js:43,119`, `…-heart-bow.js:38,94`, `…-shattered-trident.js:53,90`, `…-super-killing-knife.js:41,62`, `…-forbidden-grimoire.js:181` → `_fiona-shared.hasGrimoire`) vergleichen `c.owner === pi && c.heroIdx === heroIdx`, also die Spalte des Kontrolleurs mit gleichem Index. `spirit-of-the-relic-hammer.js:62` löst es mit `heldSeite(gs, pi, heroIdx)`.

### N3-04 · Spirit of the Forbidden Grimoire: geliehener Effekt einer Gegnerkreatur wirkt für den Gegner · Stufe B
- **Karten:** Spirit of the Forbidden Grimoire; betrifft über `reactivateCreatureEffect` auch Kohta und Great Offensive
- **Voraussetzungen / Aufbau:** Sitz 0: Grimoire-Spirit (Held 2). Sitz 1: Gangster Angel („10 damage to all targets your opponent controls") bzw. Populated Island Turtle („draw until you have 10"). Gegenprobe: dieselben Karten auf der eigenen Seite.
- **Schritte:** Grimoire aktivieren, die Gegnerkreatur wählen.
- **Erwartet** (Kartentext „use the active effects of up to 2 Creatures **on the board**", also beide Seiten; Vorbild Aligning Goals „use that Creature's active effect as if you controlled it"): „you/your opponent/your deck" im geliehenen Effekt meinen den Nutzer: Gangster Angel trifft die Helden von Sitz 1, die Turtle füllt die Hand von Sitz 0.
- **Beobachtet:** Der Effekt wirkt für den Kontrolleur der geliehenen Kreatur: Gangster Angel verletzt die Helden von Sitz 0 (-10 je Held), die Turtle zieht für Sitz 1 (+8 Karten). Weitere Messungen (explorativ): Sky Shaman fragt Sitz 1 und mahlt dessen Deck, Sky Archeologist fragt Sitz 1, bei Field Cannon geht die Zielwahl an Sitz 1.
- **Repro:** `docs/niche-tests/repro/N3-kreaturen/04-grimoire-geliehener-gegnereffekt-wirkt-fuer-den-gegner.js`
- **Vermutete Ursache:** `_engine.js:26882` (`reactivateCreatureEffect`): `ctx = this._createContext(inst, …)` – `ctx.cardOwner` ist der Kontrolleur der Instanz; der Nutzer `playerIdx` fließt nur in `_currentEffectSource`/`_activeCreatureEffect`. Es bräuchte dieselbe Kontext-Umbiegung wie bei Aligning Goals (`actionStealCreature` für die Dauer des Effekts) oder einen `ctx.cardOwner`-Override.

### N3-05 · Duigno: die Zweitaktion überlebt Duignos Abgang · Stufe A
- **Karten:** Duigno, the Flaming Phoenix (`duigno-the-flaming-phoenix.js`, gemeinsamer Baustein `_second-action-shared.js`)
- **Voraussetzungen / Aufbau:** Sitz 0 mit Duigno (Held 1) und zwei Fireballs; echter Zugwechsel (`t.endTurn()` ×2), Action Phase von Sitz 0: Duigno stempelt den Zuschlag. Varianten: Duigno wird vor / nach der ersten Aktion zerstört.
- **Schritte:** Fireball (Aktion 1), ggf. Duigno zerstören, Fireball (Aktion 2).
- **Erwartet** (Kartentext „**While you control this Creature**, you may perform a second Action during each of your Action Phases"): ohne Duigno keine zweite Aktion.
- **Beobachtet:** Beide Fireballs wirken in beiden Varianten (Log `additional_action_used`, Anbieter „Duigno" liegt längst in der Ablage). Gegenproben: ohne Duigno nur eine Aktion; mit lebendem Duigno zwei.
- **Repro:** `docs/niche-tests/repro/N3-kreaturen/05-duigno-zweitaktion-ueberlebt-den-abgang.js`
- **Vermutete Ursache:** `_second-action-shared.js:318` (`onCardLeaveZone`) räumt nur das Held-Abzeichen; `aaGrants` an der toten Instanz bleiben, und `engine._zusatzAnbieterVon` (`_engine.js:42730`) prüft die Zone nur für hero/ability/support – eine Instanz in `discard` zählt weiter als Anbieter. Betrifft denselben Baustein bei Soul Shard Ba/Giga Steroids/Lunatic Hawk.

### N3-06 · Slave Trader deckt „Suspicious Monster" auf: zwei Kopien, Slave Trader als Opfer · Stufe A
- **Karten:** Slave Trader (`slave-trader.js`), Suspicious Monster (`suspicious-monster.js`)
- **Voraussetzungen / Aufbau:** Oberste Deckkarte: Suspicious Monster. Slave Trader (nicht in diesem Zug beschworen) auf Held 2; Held 1 hat freie Zonen; alle Helden Summoning Magic.
- **Schritte:** Slave Trader aktivieren; Zonenwahlen mit dem ersten Eintrag beantworten.
- **Erwartet** (Slave Trader „immediately summon it as an additional Action with any of your Heroes"; Suspicious Monster: das Opfer ist ein Wahlweg der Hand-Beschwörung auf einen BELEGTEN Platz, auf freiem Platz normale Beschwörung – Kopfkommentar des Skripts): genau eine Kopie in der gewählten freien Zone, Slave Trader bleibt.
- **Beobachtet:** Zwei Zonenwahlen („Slave Trader", dann „Suspicious Monster"); danach steht die Karte **zweimal** auf dem Brett (freie Zone von Held 1 und Platz des Slave Traders), der Slave Trader liegt in der Ablage, Kartenbilanz `Suspicious Monster: +1`. Kein Audit-/Engine-Fehler. Gegenprobe (Frolake obenauf) stimmt. Der Sweep über 419 Kreaturen als oberste Karte zeigt nur diesen Fall.
- **Repro:** `docs/niche-tests/repro/N3-kreaturen/06-slave-trader-suspicious-monster-dupliziert-die-karte.js`
- **Vermutete Ursache:** `suspicious-monster.js:459-466`: `beforeSummon` ohne `paySummonCost`-Lauf ruft `sacrificeSwapAtomar` (Z. 186), das in den Platz des Opfers legt und `ps._placementConsumedByCard` setzt; diese Marke beachtet nur der Server-Handspielweg. Bei einer Effekt-Beschwörung (`summonFromDeck`) legt die Engine die Karte danach zusätzlich in die freie Zone. Fehlt: Prüfung `ctx._isNormalSummon`/„Engine legt den Platz selbst".

### N3-07 · Elusive Hind: ihr Kontrolleur „negiert" sein eigenes Tributopfer – Foresta kommt trotzdem · Stufe B
- **Karten:** Elusive Hind (`elusive-hind.js`), Foresta, the Guard
- **Voraussetzungen / Aufbau:** Sitz 0 spielt die Hind (liegt bei Sitz 1, Kontrolle Sitz 1, Besitzer Sitz 0). Sitz 1 hat Foresta und Dummies auf der Hand und opfert Hind + 1 Dummy. Auf die Hind-Frage „Discard 2 cards to negate that effect?" antwortet Sitz 1 mit Ja.
- **Schritte:** `t.play(1, 'Foresta, the Guard')`, Opferwahl Hind + Dummy.
- **Erwartet** (Konvention: Tribut-/Opferzerstörungen kommen mit `ctx.isSacrifice` an die Schutz-Hooks, Schutzkarten steigen dort aus – Cool Rescuer Monia: `if (ctx.isSacrifice) return;`; Foresta „by sacrificing 2 Creatures"): entweder kein Angebot für das eigene Opfer, oder das Opfer gilt als nicht erbracht.
- **Beobachtet:** Foresta liegt auf dem Brett, die Hind lebt, nur ein Dummy wurde wirklich geopfert, zwei Handkarten abgeworfen – die Negation zählte als bezahltes Opfer. (Ohne Ja: Hind + Dummy geopfert, Hind in der Ablage von Sitz 0 ✓.)
- **Repro:** `docs/niche-tests/repro/N3-kreaturen/07-elusive-hind-negiert-eigenes-tributopfer.js`
- **Vermutete Ursache:** `elusive-hind.js:139` (`beforeCreatureAffected`) prüft `ctx.isSacrifice` nicht; das Tributopfer läuft laut `_engine.js` (Kommentar „AUSNAHME Beschwörungsopfer") ohne Rettungsfenster, `resolveSacrificeCost` merkt nicht, dass die Zerstörung abgebogen wurde.

### N3-08 · Drill Sergeant legt Hind / Plant Golem in die eigene Zone, wenn der Gegner keinen Platz hat · Stufe C
- **Karten:** Drill Sergeant (`drill-sergeant.js`), Elusive Hind, Plant Golem
- **Voraussetzungen / Aufbau:** Gegnerbrett komplett voll; Sitz 0 hat Drill Sergeant (Held 0) und Hind bzw. Golem auf der Hand. Gegenproben: bei freiem Gegnerbrett verlegt sich die Karte zum Gegner (Kontrolle Sitz 1); Psychic Scout (für die Hind) und Slave Trader lassen die Karte bei vollem Gegnerbrett auf Hand/Deck.
- **Schritte:** Drill Sergeant aktivieren, Karte und Zone wählen.
- **Erwartet:** unklar (siehe Frage).
- **Beobachtet:** Die Karte liegt als gewöhnliche Kreatur in der EIGENEN Zone (Besitzer = Kontrolleur = Sitz 0); die Hind hätte ihren eigenen Besitzer als „controller" der Negation, der Golem würde den eigenen Wirtsheld blockieren.
- **Repro:** `docs/niche-tests/repro/N3-kreaturen/08-drill-sergeant-legt-hind-und-golem-in-die-eigene-zone.js`
- **Vermutete Ursache:** `drill-sergeant.js:47-58` filtert nur Stufe/Kartenart (kein `isCreatureSummonable`/`canSummon`); `elusive-hind.js`/`plant-golem.js` `onPlay`: `if (free.length === 0) return` lässt die Karte liegen.
- **Frage an Al:** Heute verlegt sich eine per Drill Sergeant (Platzieren) gelegte Hind/Golem selbstständig zum Gegner, solange dort ein Platz frei ist, bleibt aber bei vollem Gegnerbrett in der eigenen Zone liegen. Nach Q9 (Welle 9) gelten „summon"-Voraussetzungen beim Platzieren nicht. Soll der Sergeant Hind/Golem bei vollem Gegnerbrett gar nicht erst anbieten (wie Psychic Scout/Slave Trader)? (Alternative: immer wörtlich in der eigenen Zone lassen, dann entfiele die Selbst-Verlegung.)

### N3-09 · Gangster Angel: „all targets your opponent controls" überspringt unwählbare Kreaturen · Stufe B
- **Karten:** Gangster Angel (`gangster-angel.js`)
- **Voraussetzungen / Aufbau:** Sitz 1 spielt Thicket (echter Spielweg) auf eine seiner zwei Kreaturen B; Zugwechsel; Sitz 0 aktiviert den Gangster Angel.
- **Schritte:** Aktivierung, Lebenspunkte prüfen.
- **Erwartet** (Kartentext „deal 10 damage to **all** targets your opponent controls"; Kopfkommentar `thicket.js` / CARD_API „Thicket": „Flächen-Effekte, die gar nicht WÄHLEN, bleiben unberührt"; Spirit of the Barbarian Sword und Biseria-Frost treffen so eine Kreatur, Gegenprobe im Repro): beide Kreaturen und alle Helden verlieren 10.
- **Beobachtet:** Kreatur A und alle drei Helden verlieren 10, Kreatur B (Thicket) bleibt bei 1000.
- **Repro:** `docs/niche-tests/repro/N3-kreaturen/09-gangster-angel-uebergeht-unwaehlbare-kreaturen.js`
- **Vermutete Ursache:** `gangster-angel.js:96,105` sammelt über `engine.getCreatureTargets(oi)`; der Sammler lässt `counters.untargetable_all` aus (`_engine.js` ~Z. 43027, gedacht für Targeting-Artefakte).

### N3-10 · Embodiment of Biseria: „cannot be Frozen" gilt auch, wenn sie negiert oder betäubt ist · Stufe B
- **Karten:** Embodiment of Biseria (`embodiment-of-biseria.js`; gleiche Bauart bei Mischief Militia – SnowItAll, `_mischief-militia-shared.js`)
- **Voraussetzungen / Aufbau:** Biseria auf dem Brett (Stempel `counters.freeze_immune`); (b) negiert (`actionNegateCreature`), (c) betäubt; dann `applyCreatureStatus(…, 'frozen')`.
- **Erwartet** (Welle 7 „Gefroren/betäubt/negiert unterbrechen alle laufenden Passive der Karte (Kreatur: ganzer Kartentext-Passiv)"; Welle 8 Broghan: „cannot be Frozen" entfällt solange der Heldeneffekt ruht): in (b)/(c) ist sie einfrierbar.
- **Beobachtet:** `isCardPassiveDormant` meldet „ruht", der Frost wird trotzdem verweigert; gesunde Biseria bleibt immun (Gegenprobe), gewöhnliche Kreatur ist einfrierbar.
- **Repro:** `docs/niche-tests/repro/N3-kreaturen/10-biseria-negiert-bleibt-unfreezable.js`
- **Vermutete Ursache:** `_engine.js:19610` (`canApplyCreatureStatus`): `if (inst.counters[immuneKey]) return false;` ohne Ruhend-Prüfung; Stempel-Karten (Paraseed, Water Golem …) gleichen sich in Welle 7 selbst ab (`bypassStatusFilter`), Biseria nicht.

### N3-11 · Ellie: derselbe Double Spell wird im selben Zug nach „Nein" nie wieder angeboten · Stufe B
- **Karten:** Ellie, the Class President (`ellie-the-class-president.js`)
- **Voraussetzungen / Aufbau:** Ellie auf der Hand, zwei Icebolt, Frost Breaker; Held mit Destruction 3/Decay 3 und einem Summoning-Helden.
- **Schritte:** 1. Icebolt (Ellie-Angebot: Nein). 2. Zweites Icebolt (weitere Aktion). 3. Frost Breaker.
- **Erwartet** (Kartentext „…when a Hero you control performs a Double Spell"): jedes Wirken ist ein neuer Auslöser, auch das zweite Icebolt.
- **Beobachtet:** Angebot nur beim ersten Icebolt und bei Frost Breaker, nicht beim zweiten Icebolt.
- **Repro:** `docs/niche-tests/repro/N3-kreaturen/11-ellie-zweiter-double-spell-gleichen-namens-bietet-nichts-an.js`
- **Vermutete Ursache:** `ellie-the-class-president.js:60-61`: Entprellung über `engine._ellieLetzterSpell === ctx.spellCardData && gs._ellieLetzterZug === gs.turn` – `spellCardData` ist das Datenbankobjekt der Karte (für alle Kopien identisch), die Sperre gilt den ganzen Zug statt je Wirkvorgang.

### N3-12 · Spirit of the Shattered Trident: Heldentod räumt die Ausrüstung ohne Rückhol-Angebot ab · Stufe B
- **Karten:** Spirit of the Shattered Trident (`spirit-of-the-shattered-trident.js`)
- **Voraussetzungen / Aufbau:** Spirit + Trident auf Held 0; Held 1 trägt „Blade of the Frostbringer" (Kosten 5); eine Handkarte zum Abwerfen.
- **Schritte:** (Gegenprobe) Ausrüstung zerstören → Angebot, Ja. (Befund) Held 1 durch 5000 Schaden töten.
- **Erwartet** (Kartentext „Whenever Artifacts equipped to Heroes you control would be moved from the board to anywhere except your hand, you may discard 1 card to add them back…"): auch der Abgang mit dem Heldentod (Ausrüstung → Ablage) bietet die Rückholung an.
- **Beobachtet:** Zerstörung: Angebot, Ausrüstung auf der Hand, +3 Gold ✓. Heldentod: kein Angebot, die Ausrüstung liegt in der Ablage.
- **Repro:** `docs/niche-tests/repro/N3-kreaturen/12-trident-spirit-heldentod-raeumt-ohne-angebot-ab.js`
- **Vermutete Ursache:** `_engine.js:50715` (`handleHeroDeathCleanup`) feuert `onCardLeaveZone` mit `_onlyCard: inst` – nur der Abgänger hört zu, der Spirit (ein anderes Kartenskript) nie. (Das Aufräumen kennt `_returnToHand`, W16e, aber nur für Haken der Ausrüstung selbst.)

### N3-13 · Scavenging Crane: Einsatz-Effekt läuft beim Platzieren nicht – Frolake, Festive Werz, Gangster Angel (gleicher Wortlaut) schon · Stufe C
- **Karten:** Scavenging Crane (`scavenging-crane.js`), Frolake, Festive Werz, Gangster Angel; Drill Sergeant als Platzierer
- **Voraussetzungen / Aufbau:** Drill Sergeant platziert Frolake bzw. Crane aus der Hand.
- **Erwartet:** unklar (siehe Frage). Q9 (Welle 9) und Q47 (Welle 10) zählen „place" als Unterform von „summon" für Trigger; `scavenging-crane.js:37` sagt dagegen „platziert ≠ beschworen" (Vorgabe 2.10., Muster Knight of Kings/Wire Hatchling).
- **Beobachtet:** Frolake zieht beim Platzieren ihre 2 Karten, Festive Werz fragt, Gangster Angel bietet den Angler Angel an; Crane tut nichts (kein Ordnen, kein Ziehen).
- **Repro:** `docs/niche-tests/repro/N3-kreaturen/13-crane-loest-beim-platzieren-nicht-aus.js`
- **Vermutete Ursache:** `scavenging-crane.js:37` `if (ctx.card.counters?.isPlacement) return;`
- **Frage an Al:** Soll „When you summon this Creature, …" (Scavenging Crane; ebenso Wire Hatchling, Knight of Kings) beim **Platzieren** (Drill Sergeant & Co.) auslösen, wie es Frolake, Festive Werz und Gangster Angel heute tun?

### N3-14 · Spirit of the Super-Killing Knife: geopferte Kreaturen (Tribut) werden ebenfalls gelöscht · Stufe C
- **Karten:** Spirit of the Super-Killing Knife (`spirit-of-the-super-killing-knife.js`), Foresta, the Guard
- **Voraussetzungen / Aufbau:** Spirit + Messer auf dem Brett; Foresta wird mit zwei Dummies als Tribut beschworen.
- **Erwartet:** unklar. Kartentext „any Hero or Creature that is **defeated** is deleted"; die Engine unterscheidet Opfer und Besiegen sonst (Thuly/Temple of Sacrifice vs. Defeat-Trigger; Loyal Bone Dog: „gegen Zerstören ja, gegen Opfer nein"; Foresta-HP-Kosten „kein Opfer").
- **Beobachtet:** Beide Tribut-Dummies landen im Gelöscht-Stapel (ohne Spirit: Ablage).
- **Repro:** `docs/niche-tests/repro/N3-kreaturen/14-knife-spirit-loescht-geopferte-kreaturen.js`
- **Vermutete Ursache:** `spirit-of-the-super-killing-knife.js:107-115` (`onCardLeaveZone`, `toZone === 'discard'` → `_redirectToDeleted`) erfasst jeden Weg Brett → Ablage.
- **Frage an Al:** Soll ein geopferter Creature (Tribut/Kosten, nicht besiegt) vom Messer-Spirit in die Ablage statt in den Gelöscht-Stapel gehen?

### N3-15 · Drill Sergeant liest die gedruckte Stufe der Handkarte, Slave Trader und Psychic Scout die Hand-Stufe · Stufe C
- **Karten:** Drill Sergeant (`drill-sergeant.js:54`), Slave Trader, Psychic Scout, Embodiment of Biseria
- **Voraussetzungen / Aufbau:** Brettstufen 3+3+2 → Biseria hat in der Hand die Stufe 1 („level in your hand is reduced…"); Gegenprobe Brettstufen 6 → Stufe 3: der Slave Trader nimmt sie als Level-3-Abwurfkosten.
- **Beobachtet:** Der Drill Sergeant ist mit Biseria (Hand-Stufe 1) nicht aktivierbar („level 1 or lower Creature from your hand").
- **Repro:** `docs/niche-tests/repro/N3-kreaturen/15-drill-sergeant-liest-gedruckte-handstufe.js`
- **Frage an Al:** Soll „level 1 or lower … from your hand" (Drill Sergeant) die Stufe in der Hand nach Senkung lesen (wie Slave Trader/Psychic Scout), sodass eine auf Stufe 1 gesenkte Biseria platzierbar wäre? (Der Kopfkommentar nennt die gedruckte Stufe als bewusste Lesart.)

### N3-16 · Tod durch Gift/Brand eines Gegners löst „defeated by an opponent's card or effect" nicht aus · Stufe C
- **Karten:** Doomed Town Guard, Explosive Drone (gleiches Muster Ghoul Guard, Enhanced Guard Dog nicht betroffen)
- **Voraussetzungen / Aufbau:** Held 0/0 (5 HP) von Sitz 0 wird durch eine Gegnerkarte vergiftet (Verursacher Sitz 1, `statusVerursacher` kennt ihn); DTG und Drone auf der Hand; echte Zugwechsel bis zum Gifttod.
- **Erwartet:** unklar. Kopfkommentar/CARD_API: „Eigene Opferungen, Rückstoß und Statusschaden **ohne Verursacher** lösen nicht aus".
- **Beobachtet:** Held stirbt am Gift, kein Angebot (Gegenprobe: Tod durch Gegner-Zauber bietet beide an). Der Tick-Tod meldet `source: { name: 'Poison' }` ohne Besitzer (`_engine.js:50539`), obwohl der Status seinen Verursacher speichert.
- **Repro:** `docs/niche-tests/repro/N3-kreaturen/16-gifttod-loest-reaktionskreaturen-nicht-aus.js`
- **Frage an Al:** Soll der Tod durch Gift/Brand, das eine Gegnerkarte gesetzt hat, für „defeated by an opponent's card or effect" (Doomed Town Guard, Explosive Drone) zählen?

### N3-17 · Festive Werz: unzulässige Betrags-Antwort wird ungeprüft übernommen (Härtung) · Stufe B
- **Karten:** Festive Werz (`festive-werz.js:126`)
- **Voraussetzungen / Aufbau:** 200 Gold; die Betrags-Abfrage (`optionPicker`) bekommt die Antwort `optionId: '100'`.
- **Erwartet** (Kartentext „…draw a card for every 5 Gold paid that way, to a maximum of 4"; Wellen 7/20: Antworten des Clients werden nachgeprüft): höchstens 4 Karten, nur angebotene Beträge.
- **Beobachtet:** 100 Gold bezahlt, 20 Karten gezogen. Angebotene Antworten (0/5/10/15/20) stimmen. Nur mit manipuliertem Client erreichbar; `Number(wahl.optionId)` hat keine Obergrenze `MAX_KARTEN`.
- **Repro:** `docs/niche-tests/repro/N3-kreaturen/17-festive-werz-nimmt-unzulaessige-antwort-ungeprueft.js`
- **Vermutete Ursache:** `festive-werz.js:126-135` prüft den Betrag nur gegen Gold und Deckgröße; `server.js:15842` reicht `effect_prompt_response` unverändert weiter.

### N3-18 · Elusive Hind: Teilzahlung – eine Karte abgeworfen, dann abgebrochen: Karte weg, Wirkung nicht eingetreten · Stufe B
- **Karten:** Elusive Hind (`elusive-hind.js:53-62`)
- **Voraussetzungen / Aufbau:** Hind bei Sitz 1 (3 Handkarten); Sitz 0 aktiviert Field Cannon auf die Hind. Sitz 1 wirft die erste Karte ab und bricht beim zweiten Abwurf ab.
- **Erwartet** (Kosten ganz oder gar nicht, W4b; Abbruch gilt für die Wahl VOR der Zahlung): entweder ist der Abbruch nach der ersten Karte nicht mehr möglich oder die Karte bleibt auf der Hand.
- **Beobachtet:** 1 Handkarte weg, Hind nicht negiert (stirbt). Gegenprobe (beide Karten) stimmt.
- **Repro:** `docs/niche-tests/repro/N3-kreaturen/18-elusive-hind-teilzahlung-verliert-karte-ohne-wirkung.js`
- **Vermutete Ursache:** `bezahlen()` ruft `actionPromptForceDiscard(ctrl, 2, { cancellable: true })`: das Cancel gilt für jeden der zwei Abwürfe.

### N3-19 · Spirit of the Relic Hammer: Haste für die erste Kreatur NACH dem Spirit statt für die erste Kreatur des Zuges · Stufe B
- **Karten:** Spirit of the Relic Hammer (`spirit-of-the-relic-hammer.js:100`)
- **Voraussetzungen / Aufbau:** Hammer am Helden 0; im selben Zug (je eine Aktion): Field Cannon A, Spirit, Field Cannon B.
- **Erwartet** (Kartentext „The **first** Creature each player summons during each of their turns…"; Q47, Welle 10: der Zugzähler `ps._creaturesSummonedThisTurn` ist DIE Stelle für „erste Kreatur des Zuges"): B (dritte Kreatur) bekommt keine Haste.
- **Beobachtet:** B bekommt `_hasHaste`. A (vor dem Spirit) bekommt keine ✓.
- **Repro:** `docs/niche-tests/repro/N3-kreaturen/19-relic-hammer-spirit-haste-fuer-dritte-kreatur.js`
- **Vermutete Ursache:** `onCardEnterZone` prüft nur `rein.turnPlayed === gs.turn` und den eigenen Stempel `_relicHammerTurn`, nicht `_creaturesSummonedThisTurn`.

### N3-20 · Spirit of the Relic Hammer: zählt der Spirit selbst als „erste Kreatur des Zuges"? · Stufe C
- **Karten:** Spirit of the Relic Hammer
- **Aufbau:** Spirit als erste Kreatur des Zuges beschworen, danach Field Cannon.
- **Erwartet:** unklar (Lesart A wörtlich: der Spirit ist die erste Kreatur, die zweite bekommt keine Haste; Lesart B heute: der Spirit zählt nicht mit, die erste andere Kreatur danach bekommt sie).
- **Beobachtet:** Lesart B (Cannon bekommt Haste, `_creaturesSummonedThisTurn` = 2).
- **Repro:** `docs/niche-tests/repro/N3-kreaturen/20-relic-hammer-spirit-zaehlt-sich-selbst-nicht.js` (prüft Lesart A, ✗ = heute Lesart B)
- **Frage an Al:** Soll der Spirit of the Relic Hammer selbst als die „erste Kreatur" des Zuges gelten (dann keine Haste in dem Zug, in dem er beschworen wird), oder bekommt die erste ANDERE Kreatur danach die Haste (heute)?

### N3-21 · Powder Keg: die Explosion verfehlt eine Hind / einen Golem in derselben Reihe · Stufe A
- **Karten:** Powder Keg (`powder-keg.js`), Elusive Hind, Plant Golem
- **Voraussetzungen / Aufbau:** Sitz 0 legt Hind bzw. Golem (liegen automatisch bei Sitz 1, Held 0; `inst.owner` = Beschwörer Sitz 0, `controller` = Sitz 1 – der dokumentierte „Plant-Golem-Weg"), danach das Keg in dieselbe Reihe; Sitz 1 hat zusätzlich eine eigene Kreatur in der Reihe. Das Keg wird zerstört.
- **Erwartet** (Kartentext „deal 150 damage to **all Creatures** in the corresponding Hero's other Support Zones"; `_engine.js:20715` ff.: `physicalSide`/`kreaturAnBrett` für Brettseite statt `owner`): Hind (1 HP) und Golem (50 HP) nehmen 150 und fallen, die eigene Kreatur geht auf 850.
- **Beobachtet:** Nur die eigene Kreatur nimmt Schaden; Hind und Golem bleiben unversehrt in der Reihe.
- **Repro:** `docs/niche-tests/repro/N3-kreaturen/21-powder-keg-explosion-verfehlt-hind-und-golem-der-reihe.js`
- **Vermutete Ursache:** `powder-keg.js:368`: `if (inst.owner !== hostOwner) continue;` – für Hind/Golem ist `inst.owner` die Beschwörerseite, nicht die Brettseite (nur `controller` zeigt auf die Brettseite). Gestohlene und seitenfremd beschworene Kreaturen (owner = Brettseite) werden korrekt getroffen.

## Abdeckung

| Karte | Tiefe | Geprüfte Nischenfälle / Anmerkung |
|---|---|---|
| Demon's Gate | L2 gezielt | Alle 93 Normal-Zauber Destruction/Decay über das Tor: mit Zielabbruch (Zauber bleibt auf der Hand, HOPT frei) und normal (0 Fehler/Audit/Hänger); gefroren/betäubt/negiert gesperrt ✓; Dauerfeuer ✓. Nicht getestet: Reaktionen auf den Guss. |
| Disgruntled Forest Warden | L2 gezielt | Aufgestiegener lebt/tot/übernommen/abgegeben ✗(→ N3-02); Zusatzaktion in Main 1/Action/Main 2 ohne Heldenaktion ✓; Aktivierung bei Frost/Betäubung/Negation gesperrt ✓. |
| Doomed Town Guard | L2 gezielt | Auslöser Kreaturen-/Heldentod durch Zauber/Zerstörung/Heldenschaden, zusammen mit Drone ✓; Eigenopfer ✓; Gifttod ✗(→ N3-16, C). |
| Drill Sergeant | L2 gezielt | Sweep: alle 419 Kreaturen als Handkarte platziert (Zählung/Audit sauber); Hind/Golem ✗(→ N3-08, C); Handstufe ✗(→ N3-15, C); Einsatz-Effekte beim Platzieren (→ N3-13, C). |
| Duigno, the Flaming Phoenix | L2 gezielt | Zuschlag nach echtem Zugwechsel ✓; ohne Duigno keine zweite Aktion ✓; Sperre weiterer Zusatzaktionen nach der Zweitaktion ✓; Abgang ✗(→ N3-05). |
| Ellie, the Class President | L2 gezielt | Angebot nach Double Spell ✓, Entprellung ✗(→ N3-11); Creature-Effekt: +1-Stufe-Grenze (Summe der Schulstufen) ✓. |
| Elusive Hind | L2 gezielt | Platzierung beim Gegner (Besitzer/Kontrolle) ✓; Tutor-Tod geht an den Beschwörer, auch nach Rückdiebstahl ✓; Ablage beim Besitzer ✓; <2 Handkarten: keine Abfrage ✓; Tributopfer ✗(→ N3-07); Teilzahlung ✗(→ N3-18); Drill Sergeant (→ N3-08, C). |
| Embodiment of Biseria | L2 gezielt | Handstufe (leeres Brett, Minimum 1, zwei Kopien, verdecktes Camel, Biseria auf dem Brett) ✓, Beschwörung an der Stufengrenze ✓; ODER-Wahl: Abbruch jeder Stufe gibt die Nutzung frei, Frost+Schaden teilen die Sperre ✓; Frost endet zu meinem Zugbeginn ✓, trifft unwählbare Kreatur ✓; Negation ✗(→ N3-10). |
| Empty Armor | L2 gezielt | Zusatzbeschwörung (volle HP / 799 / 801 / Main / Action, Special/Normal/Nein) ✓; Umleitung einmal pro Zug, nur bei wirksamer Rüstung (gefroren/negiert: keine Umleitung), Wirtsheld gefroren egal ✓. |
| Enhanced Guard Dog | L2 gezielt | Einzelzerstörung Kreatur/Ausrüstung bietet an ✓; zwei Karten im Zerstörungs-Scope, Schadenstod, eigene Quelle, kein freier Platz bieten nicht an ✓. |
| Ethan, the Prodigy | L2 gezielt | Stufensenkung beider Hände (Stufe 0 bleibt 0), negierter Ethan senkt nicht, Ethan der Gegenseite senkt beide Hände ✓; „only 1" beim Platzieren (C02-04 behoben). |
| Explosive Drone | L2 gezielt | Auslöser Kreatur/Held ✓; Detonation: Gegner tötet (eigene Seite), Besitzer tötet gestohlene Drohne, Dieb tötet selbst (nichts) ✓; Gifttod ✗(→ N3-16, C). |
| Festive Werz | L2 gezielt | Betrag 0/5–20, Gold-/Deck-Grenze, HOPT ✓; unzulässige Antwort ✗(→ N3-17). |
| Field Cannon | L2 gezielt | 300 Schaden, Zielabbruch lässt HOPT frei, Pyraga-Auslösung (eigene und Gegner-Kanone), Spearman-Negation, Hind-Schutz, Grimoire-Leihe ✓. |
| Foresta, the Guard | L2 gezielt | HP-Halbierung 800/801/2/3/1 (1 HP → Held fällt), gestohlene Tribute → Ablage des Besitzers ✓; Hind-Tribut ✗(→ N3-07), Knife-Spirit (→ N3-14, C), Slave-Trader-Beschwörung mit Tribut ✓. |
| Frolake | L2 gezielt | Zugende-Schleife (Hand 6 mit 2/0 Abwürfen, Hand 2, Hand 0, gestohlen beim Dieb) ✓; Einsatz-Ziehen auch beim Platzieren ✓. |
| Front Soldier | L2 gezielt | Surprise-Weg (Flooding) und Hand-Reaktions-Weg (Silence) mit Ja/Nein, beide ziehen 2 ✓; ohne freie Zone nicht anbietbar ✓. |
| Gangster Angel | L2 gezielt | Barrage trifft Gegner-Kontrolle (Helden und Kreaturen, gestohlene richtig) ✓, unwählbare ✗(→ N3-09); Partner-Beschwörung + Zugende (Zugende headless nicht prüfbar). |
| Gerrymander | L2 gezielt | `_tryGerrymanderRedirect` direkt: Optionswahl unbegrenzt, „may" einmal pro Zug, Bestätigungs-Gate ohne showCard, eigener Prompt, gefroren ✓ (die Harness umgeht den Redirect in `promptGeneric`). |
| Ghoul Guard | L2 gezielt | Tod durch Gegnerquelle: alle Ziele bluten; Eigenopfer: Gegner wählt ein Ziel; gestohlen (Effekt für Kontrolleur-Gegner, Ablage beim Besitzer) ✓. |
| Plant Golem | L2 gezielt | Platzierung (Kontrolle Gegner/Besitzer Beschwörer), Wirtsheld blockiert, Ausreißen (Abwurf, Ablage beim Beschwörer) ✓; voller Gegner nicht spielbar (Slave Trader/Scout) ✓; Sergeant (→ N3-08, C). |
| Populated Island Turtle | L2 gezielt | Hand 3/10/11, Deck 4/0 (Deck-Out wie Kazena-Ruling), Zieh-/Handsperre ✓. |
| Potion Juggler | L2 gezielt | Special/Normal in der Action Phase (Aktion kommt zurück) ✓; Potion-Deck mit 1/2/3/4 Karten ✓. |
| Powder Keg | L2 gezielt | Platzierung beim Gegner (Besitzer/Gold), Todes-Explosion auf die übrigen Zonen des Wirts, Ablage beim Besitzer ✓; Hind/Golem in der Reihe ✗(→ N3-21). |
| Psychic Scout | L2 gezielt | Schadensminderung (80→30, 30→0, Lv3 unberührt, Gegner unberührt, gestohlene Lv0, Brand-Tick); Sweep über 419 Kreaturen ✓; Hind/Golem bei vollem Gegnerbrett abgelehnt ✓. |
| Pyraga | L2 gezielt | Eigene und Gegner-Aktivierung, Abbruch löst nicht aus, Obergrenze 4 pro Zug ✓. |
| Realmniversal Emperor | L2 gezielt | Todes-Schaden an Gegnerhelden, einmal pro Zug und Spieler (zweiter Emperor stumm, Gegner-Emperor eigener Zähler), gestohlen ✓. |
| Sarcophagus of Sealed Magic | L2 gezielt | Zählung Schulen eigen ✓; gestohlen ✗(→ N3-01). |
| Scavenging Crane | L2 gezielt | Platzieren ✗(→ N3-13, C); Beschwörung aus der Hand per Dauerfeuer/Schritt ✓. |
| Sentient Bomb Golems | L2 gezielt | Nachlegen aus Hand/Deck am Zugende, 3 Golems an einem Helden → 999 Schaden, 1/1/1 verteilt → nichts, Held dauerhaft vom Gegner kontrolliert ✓. |
| Sky Archeologist | L2 gezielt | Oberste Karte: Artefakt spielen / „Not now" oben/unten / Kreatur; Sweep über 238 Artefakte als oberste Karte (Bilanz/Audit sauber) ✓. |
| Sky Shaman | L2 gezielt | Auswahl, Abbruch lässt HOPT frei, leeres Deck nicht aktivierbar ✓. |
| Slave Trader | L2 gezielt | Sweep über 419 Kreaturen als oberste Karte; Suspicious Monster ✗(→ N3-06); Foresta/Blue-Ice/Dragon-Pilot/Teocuilatl-Trio/Priester mit Kosten ✓; Hind/Golem bei vollem Gegner abgelehnt ✓. |
| Spearman | L2 gezielt | Negation der Gegner-Aktivierung, 50 Schaden, kein HOPT-Verbrauch der negierten Kreatur, einmal pro Zug ✓. |
| Spirit of the Barbarian Sword | L2 gezielt | Einsatz (Areas beider Seiten → Ablage der Besitzer, 100 Schaden an alle Gegnerziele inkl. unwählbarer), Aktivierung (Area aus dem Deck), Beschwörer ✗(→ N3-03). |
| Spirit of the Forbidden Grimoire | L2 gezielt | Namens- und Stufenbudget (gleicher Name / Summe 6 gekappt / 3+1 ok), Sperre der benutzten Effekte ✓; Beschwörer ✗(→ N3-03); Gegnereffekte ✗(→ N3-04). |
| Spirit of the Heart Bow | L2 gezielt | Übernahme in die freie Zone des Wirts (HP bleibt, Besitzer-Ablage beim Tod), einmal pro Zug ✓; Beschwörer ✗(→ N3-03). |
| Spirit of the Relic Hammer | L2 gezielt | Haste-Vergabe ✗(→ N3-19, N3-20 C); Beschwörer (richtig, Gegenprobe zu N3-03). |
| Spirit of the Shattered Trident | L2 gezielt | Kosten (nur Trident / zusätzlich Blade / Action-Phase-Special) ✓; Rückholung bei Zerstörung (Karte, +Gold, Ablage ohne Karte) ✓, ohne Handkarte kein Angebot ✓; Heldentod ✗(→ N3-12); Beschwörer ✗(→ N3-03). |
| Spirit of the Super-Killing Knife | L2 gezielt | Löschen bei Tod (eingefroren/negierter Spirit löscht nicht ✓), Held: Fähigkeiten und Held gelöscht ✓, Spirit selbst ✓; Opfer ✗(→ N3-14, C); Beschwörer ✗(→ N3-03). |

## Getestet & in Ordnung (Auswahl)
- **160 Dauerfeuer-Läufe** (40 Karten × beide Seiten × „voll" und „nur Brett"): keine Engine-Fehler, Hänger oder Audit-Auffälligkeiten.
- **Gate-Matrix:** alle 93 Normal-Destruction/Decay-Zauber über Demon's Gate, einmal mit Abbruch jeder Abfrage (Zauber bleibt auf der Hand, HOPT frei: 93/93), einmal normal (0 Fehler).
- **Statusmatrix:** 19 aktivierbare Kreaturen × {normal, gefroren, betäubt, negiert}: ruhende Karten lassen sich nie aktivieren und verbrauchen nichts (Biseria ist zusätzlich frostimmun).
- **Sweeps:** Slave Trader / Psychic Scout / Drill Sergeant mit jeder der 419 Kreaturen als Ziel (Census + Audit): nur N3-06 auffällig (und bekannte Mehrzonen-/Platzhalter- bzw. Fremdseiten-Eigenheiten der Audit-Funktion bei Land Sharks, Turtle, Hind, Golem). Sky Archeologist mit jedem der 238 Artefakte obenauf: sauber.
- **Kontrolle/Besitzer:** gestohlene Drone, Emperor, Ghoul Guard, Frolake, Foresta-Tribute, Hind-Tutor und Golem-Ablage landen immer beim Besitzer, Wirkungen beim richtigen Gegner.
- **Reaktionskreaturen:** Doomed Town Guard + Explosive Drone gleichzeitig, Enhanced Guard Dog nur bei Einzelzerstörung, Front Soldier über Surprise- und Kettenweg.
- **Sperrregeln:** Island Turtle unter Zieh-/Handsperre nicht aktivierbar, Festive Werz Gold-/Decksgrenzen, Potion Juggler braucht ≥ 3 Potions im Potion Deck.
