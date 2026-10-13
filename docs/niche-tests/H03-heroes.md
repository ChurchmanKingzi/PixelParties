# H03-heroes – Nischenfall-Bericht
Stand/Autor: Agent H03-heroes (Fortsetzung nach dem Rate-Limit-Abbruch des Vorgängers; dessen Befunde 01–11 unverändert übernommen und neu ausgeführt), 13.10.2026. Karten: 37 in der Liste · 37 gezielt getestet (L2) · 22 mit Befund (23 Befunde: 1× A, 18× B, 4× C).

## Zusammenfassung
**23 Befunde mit ausgeführtem Repro** (alle unter `docs/niche-tests/repro/H03-heroes/`, `node <datei>`; ✗ = Fehler tritt auf): 1× **A**, 18× **B**, 4× **C**.

| ID | Titel (Kurzform) | Stufe |
|---|---|---|
| 01 | Nao: Überheilung hängt am Heldenplatz-Flag (Kreaturen der Spalte, toter/negierter Nao) | B |
| 02 | Pseudonia: gewonnene Effekte von Pete, Rha'Bi, Monia Bot, Rafflesia, Lilly (namensgebundene Skripte); Damsel-Teil C | B |
| 03 | Madaga unter Such-Sperre: Nachteil ohne Ertrag, HOPT verbrannt | B |
| 04 | Nomu + Mummy Token: Extra-Zug aus, Handlimit-Freiheit bleibt | B |
| 05 | Omikrons Illusion löst keine „Creature placed"-Trigger aus (Nero, Maya, Pes'zet, Madame Guillotine) | C |
| 06 | Quetzahuitl: „gelöschte" Heldenkarten landen nirgends (Kartenbilanz −3) | B |
| 07 | Mithuru (übernommen) senkt die Stufe für den fremden Helden mit gleichem Index | B |
| 08 | Luna Pele: vergiftete Kreatur brennt nicht | B |
| 09 | Sabrina: unopferbare Kreaturen (Cardinal Beast, „cannot be sacrificed") stehen zur Wahl – Surprise gratis | B |
| 10 | Monia Bot: True-Damage-Stempel bleibt nach schadenloser Umleitung liegen | B |
| 11 | Rafflesia: Kettenzauber-Anspruch/HOPT auch für eine Reaktion im Gegnerzug | B |
| 12 | **Santa Klaus: der soeben gewirkte Zauber wird als Geschenkkarte angeboten (und dem Gegner gegeben)** | B |
| 13 | Santa Klaus: negierter Santa bleibt durch die Hand-Sperre blockiert (Saint Nicolas macht es richtig) | B |
| 14 | Saint Nicolas / Santa Klaus: bei Gegner-Handsperre wird die Pflicht-Abgabe nie fällig (Aktion gratis) | C |
| 15 | **Null: von Null getroffene Kreatur bleibt für immer negiert („for 2 turns" läuft nie ab)** (Sparky Slime: gleiche Engine-Ursache) | **A** |
| 16 | Nicolas: Trank-Sperre gilt auch bei gefrorenem/betäubtem Nicolas; Randfall „tot" = C | B |
| 17 | Lolek (Shard Knight/Mender): Future Tech Control Device wählbar, landet auf eigenem Helden, Gegner übernimmt Lolek | B |
| 18 | Lolek: „half its Cost" vom Grundpreis statt vom wirksamen Preis (Laser Cannon 30 statt 0–10) | C |
| 19 | Damsel: Extra-Leben wirkt auch bei negierter/gefrorener/betäubter Damsel | C |
| 20 | Nomu (übernommen): Extra-Zug/Handlimit-Freiheit bleiben beim ALTEN Besitzer | B |
| 21 | Nicolas (übernommen): Trank-Sperre trifft auch den ALTEN Besitzer | B |
| 22 | Santa Klaus (übernommen): Spielbarkeits-Sperre zählt die Hand des ALTEN Besitzers | B |
| 23 | Gewonnener Luna-Effekt (Pseudonia, Tempeluna): Firewall-Bonus fehlt (`firewall.js:45` nutzt `loadCardEffect(hero.name)`) | B |

**Gesamteindruck.** Die Heldenpassive der Gruppe sind im Normalfall solide (Stilllegung durch Frost/Betäubung/Negation/Tod, HOPT nach Abbruch, Erstrunden-Schutz, Kappen „up to N times", Dauer in echten Zugwechseln – siehe „Getestet & in Ordnung"). Die Fehler sitzen an den **Rändern**, in vier wiederkehrenden Klassen:
1. **Engine-gelesene Heldenverträge ohne vollständigen Stilllegungsfilter** (Klasse B-09 aus dem Querschnittsbericht): Nicolas/`potionLockAfterN` (nur negated, 16), Santa/`canPlayCard` (kein Status, 13), Nomu/`bypassHandLimit` (Mummy, 04), Damsel/`_extraLife` (19).
2. **Gestohlene Helden (`permaControlBy`/`charmedBy`): Direktleser über die Brettseite statt über den Kontrolleur** – Nomu (20), Nicolas (21), Santa (22), Mithuru (07). Der alte Besitzer behält die Wirkung, der Dieb bekommt sie nicht (bzw. wird mit der falschen Hand gerechnet).
3. **Pseudonia/Tempeluna – „gains the effects"**: Skripte, die ihren Kartennamen vergleichen (02: fünf Helden + Damsel), und eine Abfragestelle, die bei der Umstellung auf `heroScriptOf` ausgelassen wurde (23, Luna/Firewall). Der 24-Szenarien-Sweep der Gruppe (Pseudonia mit jedem gewonnenen Effekt gegen den echten Helden, gleiches Szenario) ergab sonst Gleichstand.
4. **Zonen- und Karten-Buchhaltung**: der noch in der Hand liegende, gerade gewirkte Zauber (12), `deletedPile` bei „delete all Heroes" (06), Cross-Side-Artefakt über den Lolek-Weg (17), Statuszähler ohne Leser (15, Engine-Ursache: `negatedDuration`).

**Wichtigster Einzelfund:** 15 (Stufe A) – Null und Sparky Slime machen eine Kreatur dauerhaft statt zeitweilig negiert.

**Bewusst NICHT getestet:** 3–4-Spieler-Partien (nur 2 Sitze); CPU-Pfade (`cpuResponse`/`cpuShouldUseHeroEffect`) und Client-/UI-Darstellung; Deckbau-Klauseln (Nicolas, Pinta, Peter Röll – `public/potion-deck-clauses.js`, Editor); Aufstiegswege selbst (Lolek, Quetzahuitl-Abstieg nur über Heldentod, Damsel-Aufstieg); Initiation Ritual / Styx / Tempeluna-Fee-Anlegen als Quelle gewonnener Effekte; Fälle ab 5 gleichzeitigen Spezialeffekten. Wo Karten für einen Befund mehrere Lesarten zulassen, steht die Frage an Al direkt im Eintrag (05, 14, 16-tot, 18, 19, 02-Damsel).

Messhinweis: Zustände (`frozen`/`stunned`/`negated`) wurden mit `{ appliedTurn, duration: 3 }` gesetzt und **innerhalb desselben Zuges** geprüft oder erst im Gegnerzug aufgelegt – ein in den eigenen Zug gelegter Status ohne Dauer verfällt beim Zugwechsel und täuscht „Effekt trotz Status" vor (so ein Fehlalarm bei Locke wurde verworfen).

Harness-Hinweis für alle Heldenkarten: `H.fresh()` ruft `startGame()` nicht auf, also feuert **`onGameStart` nicht**. Heldenskripte, die dort etwas einrichten
(Nao, Rescued Damsel Cecilia, Pinta, Lolek-Bereitschaft), brauchen in den Tests ein `t.run(() => t.engine.runHooks('onGameStart', {}))`.

## Befunde

### H03-heroes-01 · Naos Überheilung ist ein Dauer-Flag am Heldenplatz, nicht an Nao · Stufe B
- **Karten:** Nao, the Barrier Priestess (`cards/effects/nao-the-barrier-priestess.js`); Verbraucher in `_engine.js` `actionHealHero` / `actionHealCreature`
- **Voraussetzungen / Aufbau:** Sitz 0: Nao auf Platz 0 (Spielstart-Hooks gefeuert), Skeleton Healer in Naos Support Zone 0 (bzw. Nao tot / Nao leicht negiert), Held 2 mit vollen HP 400.
- **Schritte:** 1. Skeleton Healer aktivieren (heilt Held 2 um 100). 2. Variante: Nao auf 0 HP. 3. Variante: Nao trägt `negated` in der Weakening-Crystal-Form, wirkt selbst „Heal" (150) auf Held 1 (300/400).
- **Erwartet** (Kartentext: „When **this Hero** heals a target's HP while they are lower than or equal to their maximum, it can heal that target's HP beyond their maximum."; Engine-Regel: ein toter/negierter Held wirkt nicht): Überheilung nur bei Heilungen, die Nao selbst ausführt, solange sie lebt und nicht negiert ist.
- **Beobachtet:** (a) Healer in Naos Spalte heilt Held 2 auf **500** (max 400); (b) dasselbe bei **totem** Nao; (c) Nao mit leichter Negation heilt Held 1 auf **450**.
- **Repro:** `docs/niche-tests/repro/H03-heroes/01-nao-ueberheilung-slotflag.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `nao-the-barrier-priestess.js` setzt in `onGameStart`/`onPlay` einmalig `gs.heroFlags['<seite>-<heroIdx>'].overhealPassive` und nimmt es nie zurück; `_engine.js:10059` und `:10148` erlauben Überheilung, sobald `source.heroIdx` der Platz mit Flag ist – gleich ob die Quelle Nao, eine Kreatur dieser Spalte oder ein später auf den Platz gekommener Held ist, und gleich ob Nao lebt/negiert ist.

### H03-heroes-02 · Von Pseudonia gewonnene Effekte laufen nicht, wenn das Skript den eigenen Kartennamen prüft · Stufe B (Damsel-Teil: C)
- **Karten:** Pseudonia, the Skill Devourer (Mechanik `_gained-effects-shared.js`); betroffen: Monsieur Pete (`monsieur-pete-the-booty-raider.js:40`), Rha'Bi (`rha-bi-the-living-skeleton.js:397`), Monia Bot (`monia-bot-the-foretold-rescuer-of-coolness.js:84`), Rafflesia (`rafflesia-the-poison-princess.js:162`), Lilly (`lilly-the-charming-infiltrator.js:39`), Rescued Damsel Cecilia (`rescued-damsel-cecilia.js:53`)
- **Voraussetzungen / Aufbau:** Sitz 0: Pseudonia auf Platz 0, `engine.grantHeroEffect(0, 0, X)` + `finishGainedHeroEffects` (das ruft Pseudonia selbst nach der Zusage auf); Kontrolllauf mit dem echten X auf Platz 0.
- **Schritte:** je Karte der typische Auslöser: Pete – Gegner trifft den Träger mit Burning Finger; Rha'Bi – Effekt aktivieren (legt 1 Karte), Träger stirbt; Monia Bot – Gegner zielt auf Held 1; Rafflesia – Decay-Spell (Venom Infusion), Support-Spell (Heal) in der Hand; Lilly – Infiltration Lv1 (nimmt die oberste Gegnerkarte); Damsel – tödlicher Schlag.
- **Erwartet** (Pseudonia-Ruling 22.9.: „that Hero's effects" = gedruckter Effekt, auch Ascended Heroes; Kopf von `pseudonia-the-skill-devourer.js`): Pseudonia verhält sich wie X; die Kontrollläufe mit dem echten X bestehen alle.
- **Beobachtet:** Pete: keine Deck-Suche; Rha'Bi: beim Tod des Trägers bleibt die verdeckt gelegte Karte (Marke `_rhabiPlaced`) für immer in der gegnerischen Support Zone liegen, nichts löscht oder holt sie zurück; Monia Bot: kein Redirect-Angebot; Rafflesia: `rafflesia_chain` im HOPT gestempelt, aber **kein** Zusatzaktions-Anspruch (HOPT ohne Gegenwert verbrannt); Lilly: Pseudonia zieht nach dem Diebstahl nicht nach (der Hook prüft `ctx.cardZone !== 'hero'`, die Trägerinstanz liegt in `support`); Damsel: kein Extra-Leben, Träger bleibt tot (Wortlaut „The first time **this Ascended Hero** would be defeated" – für Pseudonia, die kein Ascended Hero ist, deshalb nur Stufe C).
- **Repro:** `docs/niche-tests/repro/H03-heroes/02-pseudonia-namensbindung.js` (6 ✗ für Pseudonia, die 6 Kontrollläufe mit dem echten Helden ✓)
- **Vermutete Ursache:** Die Hooks laufen über die Trägerinstanz (`attachedHero` = Pseudonia), aber die Skripte vergleichen `hero.name`/`ziel.name`/`gefallen.name` mit der eigenen Karte oder suchen die Heldeninstanz per Name (`c.name === CARD_NAME`); Lilly prüft die Zone der Trägerinstanz. Die gewonnenen Skripte müssten `hatEffekt(hero, CARD_NAME)` aus `_gained-effects-shared.js` benutzen (so wie Mithuru es mit `istHeldenTraeger` tut).
- **Frage an Al** (nur Damsel-Teil): Soll Pseudonia mit Damsels Effekt das Extra-Leben bekommen („this Ascended Hero" → Pseudonia ist keiner) – ja oder nein?

### H03-heroes-03 · Madaga unter Such-Sperre: der Nachteil („Forsaken") greift, obwohl die Suche nichts bringt · Stufe B
- **Karten:** Madaga, the Forsaken Seafarer (`cards/effects/madaga-the-forsaken-seafarer.js`)
- **Voraussetzungen / Aufbau:** Sitz 0: Madaga auf Held 0, `Heal`×2 + `Fireball` auf der Hand, Deck mit weiteren `Heal`; einmal `ps.handLocked = true` (Kontrolle), einmal `ps.searchLocked = true` (Cats of the Pharaoh).
- **Schritte:** 1. Madagas Heldeneffekt aktivieren, eine `Heal` aus der Hand zeigen.
- **Erwartet** (Kartentext: „You may once per turn reveal a card from your hand to search your deck for a copy of that card … For the rest of the turn, all cards that would go to your discard pile are deleted instead."; Ruling CARD_API.md „Such-Sperre: die vier Gruppen" 14.9.: Karten, die im Deck suchen und daneben einen Nachteil haben, sind unter der Such-Sperre UNSPIELBAR – „man zahlt und bekommt nichts" soll nicht möglich sein): unter der Such-Sperre ist der Effekt nicht aktivierbar (so wie unter `handLocked`), jedenfalls entsteht kein Nachteil ohne Ertrag.
- **Beobachtet:** `handLocked`: nicht aktivierbar ✓. `searchLocked`: aktivierbar, die Suche liefert nichts (Hand bleibt 3), die Ablage-Umleitung (`_discardToDeleteActive`) ist trotzdem an und das HOPT ist verbraucht – der Nachteil ohne Ertrag.
- **Repro:** `docs/niche-tests/repro/H03-heroes/03-madaga-suchsperre.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `canActivateHeroEffect` prüft nur `ps.handLocked`; Heldenskripte tragen weder `blockedBySearchLock` noch eine eigene Prüfung, und `onHeroEffect` (`madaga-the-forsaken-seafarer.js:97`) wertet das Ergebnis von `actionAddCardFromDeckToHand` nicht aus, bevor `enableDiscardToDelete` (`:108`) läuft.

### H03-heroes-04 · Nomu unter Mummy Token: Extra-Zug ist aus, „no hand size limit" bleibt · Stufe B
- **Karten:** Nomu, Wanderer of Worlds (`cards/effects/nomu-wanderer-of-worlds.js`); Mummy Token
- **Voraussetzungen / Aufbau:** Sitz 0: Nomu auf Held 0, Mummy Token in Nomus Support Zone 0, 10 Handkarten, Deck 30; Kontrollen ohne Nomu und mit unvermummtem Nomu.
- **Schritte:** 1. `actionDrawCards(0, 1)` (Extra-Zug prüfen). 2. echter Zugwechsel (`t.endTurn()`): Handlimit 7 wird am Zugende durchgesetzt.
- **Erwartet** (Kartentext Nomu: „Up to 3 times per turn, when you draw exactly 1 card …: Draw 1 additional card … You have no hand size limit."; Mummy Token: „The effect of the corresponding Hero is replaced by this effect"): ist Nomus Effekt ersetzt, entfallen BEIDE Teile – Extra-Zug UND Handlimit-Freiheit.
- **Beobachtet:** Kontrollen ✓ (ohne Nomu: Hand 7; Nomu aktiv: 2 Karten gezogen, Hand bleibt 12). Mit Mummy Token: Extra-Zug entfällt ✓, aber die Hand bleibt am Zugende bei **11** (kein Handlimit-Abwurf).
- **Repro:** `docs/niche-tests/repro/H03-heroes/04-nomu-mummy-handlimit.js`
- **Vermutete Ursache:** `_hasActiveNomu` (`_engine.js:28840`, Z. 28848 beachtet `_isHeroMummified`) gegen `_shouldBypassHandLimit` (`_engine.js:28895`), das nur frozen/stunned/negated prüft, nicht den Mummy Token (Aufrufer `_engine.js:16855`, `:16989`). Gehört zur Klasse „engine-gelesener Heldenvertrag ohne vollständigen Stilllegungs-Filter" (vgl. B-09).

### H03-heroes-05 · Omikrons Illusion löst keine „Creature placed"-Trigger aus (Nero Zira, Maya, Pes'zet, Madame Guillotine …) · Stufe C
- **Karten:** Omikron, the Faceless Illusionist (`cards/effects/omikron-the-faceless-illusionist.js`); betroffen Nero Zira, Maya, Pes'zet (Trigger); Vergleich Create Illusion / Staff of Illusions (feuern `onCardEnterZone`)
- **Voraussetzungen / Aufbau:** Sitz 0: Nero Zira (H0, ATK 70), Omikron (H1), Maya (H2); `t.activateHero(0, 1, {effect: Omikron})` mit Gallerie-Wahl „Skeleton Healer".
- **Erwartet** (Kartentext Omikron: „place a copy of any Creature into one of this Hero's free Support Zones, but **its** effects are negated …"; Nero: „Up to 5 times per turn, when a Creature is placed into one of your Heroes' Support Zones, permanently increase this Hero's Attack by 30."; Maya: „Whenever a Creature is placed … you may choose a target you control and increase its current and max HP by 50."): negiert sind nur die EIGENEN Effekte der Illusion; das Platzieren ist ein Ereignis für fremde Beobachter – Nero +30 ATK, Maya bietet +50 HP an.
- **Beobachtet:** Illusion liegt (✓), aber Nero bleibt bei 70 ATK und Maya bietet keine Zielwahl an. Das Skript lässt `onCardEnterZone` ausdrücklich aus (Kommentar Z. 155–158: „none of its on-summon effects (nor external triggers like Ingo/Maya/Layn) should fire. This matches the 'effects negated' wording") – eine bewusste Entscheidung des Skripts, aber kein Eintrag in CARD_API.md und im Widerspruch zu Create Illusion/Staff of Illusions (deren Kommentar: „Fire enter-zone hooks (Ingo, Maya, …)"). Daher C, nicht B.
- **Repro:** `docs/niche-tests/repro/H03-heroes/05-omikron-platzierung-ohne-ausloeser.js`
- **Vermutete Ursache:** `omikron-the-faceless-illusionist.js:155-158` (kein `runHooks('onCardEnterZone')` nach `fs.supportZones[..][destSlot] = [chosenName]`, Z. 113).
- **Frage an Al:** Sollen fremde „Creature placed"-Trigger (Nero, Maya, Pes'zet) bei Omikrons Illusion feuern wie bei Create Illusion/Staff of Illusions – ja oder nein?

### H03-heroes-06 · Quetzahuitl: die „gelöschten" Heldenkarten landen nirgends (Kartenbilanz −3) · Stufe B
- **Karten:** Quetzahuitl, Receiver of Sacrifices (`cards/effects/quetzahuitl-receiver-of-sacrifices.js`, `performDescent`)
- **Voraussetzungen / Aufbau:** Sitz 0: Helden 0 und 1 bereits besiegt (HP 0), Held 2 mit Fighting; Quetzahuitl auf der Hand, `Divinity`×3 im Deck; Gegner (Sitz 1) am Zug schlägt Held 2 mit `actionDealDamage(…, 9999, 'spell')` tot.
- **Erwartet** (Kartentext: „… delete all your Heroes and all cards in their Support and Ability Zones to place this card into one of your Hero Zones instead of losing the game."; Engine-Konvention `engine.deleteHero` (`_engine.js:25531`, Soul Transmigration Ritual) schiebt den Heldennamen in `ps.deletedPile` (~Z. 25633); die Support-/Ability-Karten gehen bei Quetzahuitl selbst in den Gelöscht-Stapel): auch die drei Heldenkarten liegen danach im Gelöscht-Stapel, die Kartenbilanz bleibt erhalten.
- **Beobachtet:** Abstieg läuft (Quetzahuitl auf Platz 2, kein Spielende ✓). `t.censusDiff`: Tushu −1, Rick −1, Zwei −1; der Gelöscht-Stapel enthält nur `["Fighting"]` – die Heldenkarten sind aus dem Spiel verschwunden.
- **Repro:** `docs/niche-tests/repro/H03-heroes/06-quetzahuitl-helden-verschwinden.js`
- **Vermutete Ursache:** `quetzahuitl-receiver-of-sacrifices.js:240` setzt `hero.name = null` für jeden Platz, ohne den Namen nach `ps.deletedPile` (wie `:205/:215` für die Support-/Ability-Karten) zu legen.

### H03-heroes-07 · Lord Mithuru (dauerhaft übernommen) senkt die Stufe für einen ANDEREN Helden mit gleichem Index · Stufe B
- **Karten:** Lord Mithuru, the Rotten Mastermind (`cards/effects/lord-mithuru-the-rotten-mastermind.js`, `reduceCardLevel`); Auslöser `actionTakeHeroPermanently` (Paraseed-Weg)
- **Voraussetzungen / Aufbau:** Sitz 1 hat Mithuru als Held 0; Sitz 0 übernimmt ihn dauerhaft. Sitz 0 hat auf Held 0 (eigener Tushu) KEINE Schulen, „Icebolt" (Lv2 Decay+Destruction, Doppelspell) auf der Hand.
- **Erwartet** (Kartentext: „**This Hero** may perform Double Spells as if their levels were reduced by 2."; Kontrolle ohne Übernahme: Tushu darf Icebolt nicht wirken): nur Mithuru selbst ist begünstigt.
- **Beobachtet:** Kontrolle ✓ (Icebolt unspielbar). Nach der Übernahme wirkt **Tushu** (eigener Held, gleicher Index 0) Icebolt.
- **Repro:** `docs/niche-tests/repro/H03-heroes/07-mithuru-uebernommen-senkt-fuer-fremden-helden.js`
- **Vermutete Ursache:** `lord-mithuru-the-rotten-mastermind.js:22` vergleicht nur `heroIdx !== inst.heroIdx`; der Vertrag `reduceCardLevel(cardData, engine, ownerIdx, inst, heroIdx, evalOpts)` übergibt die Brettseite des Wirkers nicht, und der Kontrolleur-Filter der Engine lässt Mithurus Instanz wegen der Übernahme für Sitz 0 gelten.

### H03-heroes-08 · Luna Pele: eine vergiftete KREATUR wird nicht verbrannt (Held ✓, Kreatur ✗) · Stufe B
- **Karten:** Luna Pele, the Flame Dancer (`cards/effects/luna-pele-the-flame-dancer.js`, `hooks.onStatusApplied`)
- **Voraussetzungen / Aufbau:** Sitz 0: Luna Pele auf Held 0 (Spielstart-Hooks gefeuert); Sitz 1: `ZZ Dummy Big` auf dem Brett.
- **Schritte:** 1. Kontrolle: Held vergiftet. 2. Kontrolle: Kreatur verbrannt (Luna zieht?). 3. `actionApplyCreaturePoison` auf die Kreatur.
- **Erwartet** (Kartentext: „Whenever a **target** is Poisoned, it is also Burned for the rest of the game. Up to 4 times per turn, when a target is Burned, draw 1 card."; „target" = Held oder Kreatur, vgl. Locke, Maya, Pes'zet): vergiftete Kreatur brennt dauerhaft, Luna zieht dafür 1 Karte.
- **Beobachtet:** Held ✓ (permanent verbrannt). Kreatur verbrannt → Luna zieht 1 ✓ (das Burn-Ziehen trifft Kreaturen schon). Kreatur **vergiftet** → kein `burned`-Zähler, Luna zieht nichts.
- **Repro:** `docs/niche-tests/repro/H03-heroes/08-luna-pele-kreatur-gift-brennt-nicht.js`
- **Vermutete Ursache:** Effekt 1 ist nur für Helden umgesetzt (`luna-pele-the-flame-dancer.js:77`: `target.hp !== undefined && heroOwner != null`); der Kopfkommentar (Z. 33: „onStatusApplied hook ONLY fires for Hero …") ist überholt – `applyCreatureStatus` / `actionApplyCreaturePoison` feuern den Hook inzwischen mit `_onCreature: true`.

### H03-heroes-09 · Sabrina: unopferbare Kreaturen stehen zur Opferwahl, das Opfer scheitert – die Surprise wird trotzdem gratis aktiviert · Stufe B
- **Karten:** Sabrina, the Psychic Witch (`cards/effects/sabrina-the-psychic-witch.js`, `ownControlledCreatures`); Cardinal Beast Baihu; Boulder in a Bottle (`cannotBeSacrificed`)
- **Voraussetzungen / Aufbau:** Sitz 0: Sabrina auf Held 0, Skull Carpet Bombing (Surprise) im Deck; als einzige eigene Kreatur (a) `Cardinal Beast Baihu`, (b) `Boulder in a Bottle` mit `cannotBeSacrificed` und Lv3.
- **Erwartet** (Kartentext: „You may once per turn **sacrifice** a Creature you control to search your deck for a Surprise …"; Engine-Regel: `engine.getSacrificableCreatures(pi)` nimmt Cardinal Beasts (immun gegen jeden Effekt) und `cannotBeSacrificed`-Kreaturen aus – Boulder in a Bottle: „This Creature cannot be sacrificed"; Pharaoh benutzt sie): eine nicht opferbare Kreatur ist keine zulässige Wahl; ist sie die einzige, ist der Effekt nicht aktivierbar. Kontrolle (normale Lv3-Kreatur) ✓.
- **Beobachtet:** (a) Effekt aktivierbar; Beast bleibt auf dem Brett, trotzdem wird die Surprise aus dem Deck geholt und aktiviert (Skull Carpet Bombing in der Ablage), und `onCreatureSacrificed` feuert für ein Opfer, das nicht stattfand (Rakah & Co.). (b) Boulder wird tatsächlich abgelegt/zerstört (ignoriert `cannotBeSacrificed`) und die Surprise läuft gratis. Surprise bis Stufe 5 ohne Gegenleistung.
- **Repro:** `docs/niche-tests/repro/H03-heroes/09-sabrina-unopferbare-kreatur.js`
- **Vermutete Ursache:** `sabrina-the-psychic-witch.js:76` baut die Liste selbst (`ownControlledCreatures`, benutzt in Z. 106 und 126) und prüft weder `_cardinalImmune` noch `cannotBeSacrificed`; statt `engine.getSacrificableCreatures(pi)` zu nutzen. Das Skript wertet auch nicht aus, ob das Opfer gelang.

### H03-heroes-10 · Monia Bot: der „True Damage"-Stempel bleibt nach einer schadenlosen Umleitung liegen und trifft den nächsten, unbeteiligten Treffer · Stufe B
- **Karten:** Monia Bot, the Foretold Rescuer of Coolness (`cards/effects/monia-bot-the-foretold-rescuer-of-coolness.js:98`, `onHeroRedirect` → `gs._redirectedTrueDamage`; Verbraucher `_engine.js:8431`)
- **Voraussetzungen / Aufbau:** Sitz 0: Monia (H0), Tushu (H1); Sitz 1 am Zug mit „The Warlord's Bite" (Gift, kein Schaden) und „Fireball".
- **Schritte:** 1. Gegner wirkt Warlord's Bite auf Held 1, Monia leitet um (Ja). 2. Im selben Zug: Fireball direkt auf Monia (nicht umgeleitet).
- **Erwartet** (Kartentext: „… you may redirect that card or effect onto this Hero. Damage this Hero receives from effects redirected **this way** cannot be reduced or negated."): nur Schaden aus dem UMGELEITETEN Effekt ist unverringerbar; ohne Schaden verfällt der Stempel mit dem Effekt, der spätere Fireball ist normaler Schaden.
- **Beobachtet:** Umleitung ✓ (Monia vergiftet), aber `gs._redirectedTrueDamage` bleibt bestehen; der spätere Fireball wird zu `true_damage` (Log), obwohl er nicht umgeleitet war. Nach Engine-Kommentar ignoriert True Damage auch immortal / capAtHPMinus1 / lethalProtection.
- **Repro:** `docs/niche-tests/repro/H03-heroes/10-monia-bot-true-damage-stempel-bleibt.js`
- **Vermutete Ursache:** Der Stempel `{ owner, heroIdx, turn, source }` wird in `monia-bot-…js:98` beim Umleiten gesetzt und erst vom nächsten Schaden auf Monia (`_engine.js:8431-8437`) oder am Zugbeginn (`:22611`) gelöscht – nicht, wenn der umgeleitete Effekt keinen Schaden macht. Der Engine-Kommentar (`_engine.js:8424-8430`) sagt ausdrücklich „der NÄCHSTE Treffer auf genau diesen Helden … Der Stempel fällt mit dem Treffer oder am Zugbeginn" – das Liegenbleiben nach einem schadenlosen Effekt ist darin nicht bedacht (daher B, nicht A).

### H03-heroes-11 · Rafflesia: Kettenzauber-Anspruch auch für eine Reaktion im Action Phase des GEGNERS · Stufe B
- **Karten:** Rafflesia, the Poison Princess (`cards/effects/rafflesia-the-poison-princess.js`, `hooks.afterSpellResolved`)
- **Voraussetzungen / Aufbau:** Rafflesia (Decay 2 / Support 2 / Magic Arts 2) auf Sitz 0 mit „Spectral Armor" (Support+Magic Arts, Reaction) und „Venom Infusion" (Decay) auf der Hand; Sitz 1 ist am Zug und wirkt „Fireball" auf Rafflesia, sie reagiert mit Spectral Armor.
- **Erwartet** (Kartentext: „Once per turn, **during your Action Phase**, when this Hero uses a Decay or Support Spell, it may immediately use a Spell of the other Spell School …"): im Gegnerzug kein Zusatzaktions-Anspruch, kein HOPT-Verbrauch, keine „may chain"-Ansage.
- **Beobachtet:** Rafflesia bekommt den Anspruch (`findAdditionalActionForCategory(0,'spell',0,0)` liefert ihn), das HOPT `rafflesia_chain:0` ist gestempelt, die Ansage „Rafflesia … may chain into a Decay Spell!" geht an die Spieler. Folge klein: Anspruch und Ansage verfallen mit dem nächsten Zugbeginn; gespielt werden kann im Gegnerzug ohnehin nur per Reaktion.
- **Repro:** `docs/niche-tests/repro/H03-heroes/11-rafflesia-reaktion-im-gegnerzug.js`
- **Vermutete Ursache:** `rafflesia-the-poison-princess.js:118` prüft nur `gs.currentPhase !== 3`, nicht `gs.activePlayer`.

### H03-heroes-12 · Santa Klaus: der soeben gewirkte Zauber steht noch in der Hand und wird als Geschenkkarte angeboten · Stufe B
- **Karten:** Santa Klaus (`cards/effects/santa-klaus.js`, `hooks.afterSpellResolved`)
- **Voraussetzungen / Aufbau:** Sitz 0: Santa Klaus auf Held 0, Hand `Fireball`, `Heal`, `Heal`; Gegner-Held 0 als Ziel; die Geschenkwahl (`pickHandCard`) wählt die Karte `Fireball`, solange sie angeboten wird.
- **Schritte:** 1. Santa wirkt Fireball von der Hand (Kosten-Prüfung `canPlayCard` verlangt bei Hand-Herkunft 3 Karten und besteht).
- **Erwartet** (Kartentext: „Whenever this Hero uses an Attack or Spell, you must add 2 cards **from your hand** to your opponent's hand."; Skriptkopf `santa-klaus.js` Z. 12–27: die Karte „liegt zum Prüfzeitpunkt noch mit drin und zählt nicht als Reserve" – die 2 Geschenke sind Reservekarten, nicht der gespielte Zauber; vgl. server.js ~8571, wo die Wisdom-Kosten den laufenden Zauber ausdrücklich aus `eligibleIndices` nehmen): der laufende Fireball wird nicht zur Wahl gestellt und landet in der Ablage; der Gegner bekommt zwei andere Karten.
- **Beobachtet:** `afterSpellResolved` feuert, solange der Zauber noch in `ps.hand` liegt (`_resolvingCard`, Splice erst nach dem Hook). Das Skript bietet `eligibleIndices` = ALLE Handkarten an: Angebot 1 = `[Fireball, Heal, Heal]`. Wird der Fireball gewählt, geht er auf die Gegnerhand (`["Fireball","Heal"]`), die Ablage bleibt leer, Santa behält eine `Heal` – der Preis sinkt faktisch auf eine Karte, und der Gegner erhält den gespielten Zauber statt Füllkarten. (Mit der Standard-Antwort „erste Option" passiert dasselbe automatisch, auch die CPU gibt den Zauber weg.)
- **Repro:** `docs/niche-tests/repro/H03-heroes/12-santa-klaus-gespielter-zauber-als-geschenk.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `santa-klaus.js:94` (`for (let i = 0; i < (ps.hand || []).length; i++) eligibleIndices.push(i)`) schließt die laufende Karte nicht aus (`getResolvingHandIndex(ps)` / `ps._resolvingCard`, vgl. Wisdom-Weg server.js ~8571).

### H03-heroes-13 · Santa Klaus: ein NEGIERTER Santa bleibt durch die Hand-Sperre blockiert, obwohl sein Preis entfällt · Stufe B
- **Karten:** Santa Klaus (`cards/effects/santa-klaus.js`, `canPlayCard`); Kontrolle Saint Nicolas (`saint-nicolas.js:155`, `if (s.frozen || s.stunned || s.negated) return true;`)
- **Voraussetzungen / Aufbau:** Sitz 0: Santa Klaus (bzw. Saint Nicolas) auf Held 0 mit Status `negated` (Dauer 3), auf der Hand nur ein `Attack` (Lv0 – negierte Helden verlieren ihre Abilities, daher kein Schul-Zauber als Sonde). Gegner-Held 0 als Ziel.
- **Schritte:** 1. `t.play(0, 'Attack', { hero: 0 })`.
- **Erwartet** (Kartentext „Whenever this Hero uses an Attack or Spell, you must add 2 cards …"; Skriptkopf: die Spielbarkeits-Sperre „cannot act while the player has fewer than 2 cards in hand" existiert nur, damit der „must"-Preis zahlbar ist; Engine-Regel: ein negierter Held wirkt nicht – sein Preis entfällt, der Hook ist stillgelegt; Negation nimmt keine Handlungsfähigkeit): der negierte Santa kann den Attack wirken und zahlt nichts, so wie der negierte Saint Nicolas (explizit „Silenced … exempts the rule, matching `canPlayCard`").
- **Beobachtet:** Negierter Santa mit 3 Karten (Attack + 2 Heal) spielt und zahlt nichts ✓; mit nur dem Attack (oder 2 Karten) ist der Attack **nicht spielbar** (`r=false`, Karte bleibt auf der Hand, Gegner-HP 600). Negierter Saint Nicolas und negierter Tushu: spielbar ✓.
- **Repro:** `docs/niche-tests/repro/H03-heroes/13-santa-klaus-negiert-bleibt-gesperrt.js` (✗ nur für Santa, Saint Nicolas ✓)
- **Vermutete Ursache:** `santa-klaus.js:57` (`canPlayCard`) liest `hero.statuses` nicht; die Engine (`_engine.js:21008`, `validateActionPlay`) ruft `heroScript.canPlayCard` ohne Status-Filter auf. Dieselbe Klasse wie B-09 (engine-gelesener Heldenvertrag ohne Stilllegungsfilter).

### H03-heroes-14 · Saint Nicolas / Santa Klaus: ist der Gegner hand-gesperrt, wird die Pflicht-Abgabe nie fällig – die Aktion ist gratis · Stufe C
- **Karten:** Saint Nicolas (`cards/effects/saint-nicolas.js`, `commitHeroActionCost`), Santa Klaus (`cards/effects/santa-klaus.js`, `afterSpellResolved`)
- **Voraussetzungen / Aufbau:** Sitz 0: Saint Nicolas (Hand `Attack` + `Elixir of Quickness`) bzw. Santa Klaus (Hand `Attack` + 2 `Heal`), Gegner-Held 0 als Ziel; Kontrolle ohne Sperre, dann `gs.players[1].handLocked = true`. Die Abgabe-Wahl wird auf „letzte angebotene Karte" gescriptet (um 12 auszuklammern).
- **Schritte:** 1. `t.play(0, 'Attack', { hero: 0 })`.
- **Erwartet** (Kartentext Saint Nicolas: „You **must** add a Potion from your hand to your opponent's hand to perform an Action with this Hero."; Santa: „… you **must** add 2 cards from your hand to your opponent's hand."; beide Skripte machen die Abgabe sonst zur Spielbarkeits-Voraussetzung: `canPerformAction` ohne Trank / `canPlayCard` „cannot act with fewer than 2 cards" (Al 14.9.)): ohne Sperre wird abgegeben ✓ (Kontrollen bestehen). Mit Hand-Sperre des Gegners (`handLocked` sperrt laut `_engine.js` ~10627 auch „Adds") ist die Abgabe unmöglich – dann wäre „unbezahlbar ⇒ nicht spielbar" die Linie der übrigen Preis-Prüfungen.
- **Beobachtet:** Die Aktion läuft (`r = true`), die Gegnerhand bleibt leer, der Wirker behält den Trank bzw. beide Karten – die „Steuer" entfällt vollständig. `actionTransferCardToOppHand` liefert `false`; `commitHeroActionCost` und Santas Schleife ignorieren das (Santa sogar kommentiert: „if (!ok) break; // Gegenseite kann nicht annehmen (handLocked)"). Dasselbe gilt für alle anderen Gründe, aus denen die Übergabe `false` liefert (Such-Sperre des Gegners `_isSearchBlocked`, Ablehnung per Hand-Interaktions-Reaktion „Ambush the Scout" – nur die Hand-Sperre wurde ausgeführt).
- **Repro:** `docs/niche-tests/repro/H03-heroes/14-saint-nicolas-santa-steuer-bei-gegner-handsperre.js` (✗ = Aktion gratis)
- **Vermutete Ursache:** `saint-nicolas.js` `commitHeroActionCost` (letzter Aufruf `actionTransferCardToOppHand`, Rückgabewert verworfen) und `santa-klaus.js:112` (`if (!ok) break;`); `canPerformAction`/`canPlayCard` fragen nur die EIGENEN Karten ab, nicht, ob der Gegner annehmen kann.
- **Frage an Al:** Soll die Aktion gesperrt sein, solange der Gegner die Pflicht-Karten nicht annehmen kann (Hand-/Such-Sperre) – oder bleibt sie, wie jetzt, gratis erlaubt?

### H03-heroes-15 · Null, the Mage Slayer: eine getroffene KREATUR bleibt für immer negiert („for 2 turns" läuft nie ab) · Stufe A
- **Karten:** Null, the Mage Slayer (`cards/effects/null-the-mage-slayer.js`, `afterCreatureDamageBatch`); Engine `applyCreatureStatus` / Zugende-Abbau
- **Voraussetzungen / Aufbau:** Sitz 0: Null auf Held 0, `Attack` auf der Hand (Spielstart-Hooks gefeuert); Sitz 1: `ZZ Dummy Big` auf dem Brett. Kontrollen: (a) Gegner-HELD wird von Null getroffen, (c) `applyCreatureStatus(c2, 'frozen', {duration: 2})`.
- **Schritte:** 1. Null greift die Kreatur an (Ziel = Kreatur). 2. Mehrfach `t.endTurn()` (bis zu 8 Zugwechsel).
- **Erwartet** (Kartentext: „Negate the effects of any targets hit by this Hero's Attacks **for 2 turns**. This counts as a status effect."; Skriptkopf: `applyCreatureStatus` mit `duration` sei der Weg, den Iceage für den Zwei-Runden-Frost geht – „die Dauer landet in `counters.negatedDuration` und wird angezeigt UND heruntergezählt"): die Negation endet nach 2 Zügen.
- **Beobachtet:** Held (a) ✓ nach 4 Zugwechseln frei; Frost-Dauer 2 auf einer Kreatur (c) ✓ läuft ab. Die von Null getroffene Kreatur bleibt auch nach 8 (im Probelauf 10) Zugwechseln `negated = 1`, `negatedDuration = 2` (unverändert), `isCreatureEffectSuppressed` = true – die Kreatur ist **dauerhaft** negiert (nur ein Reinigen als Status würde sie befreien).
- **Repro:** `docs/niche-tests/repro/H03-heroes/15-null-kreatur-negation-laeuft-nie-ab.js` (✗ = Fehler tritt auf)
- **Vermutete Ursache:** `null-the-mage-slayer.js:118` ruft `applyCreatureStatus(inst, 'negated', { duration: 2 })` (setzt `counters.negatedDuration`, `_engine.js:17631`), aber der Zugende-Abbau (`_engine.js` ~45158–45210, Kommentar „frozenDuration is the controller-turn countdown") zählt nur `frozenDuration` und `stunnedDuration` herunter – für `negatedDuration` gibt es keinen Leser. Die Zeitbegrenzung für negierte Kreaturen läuft sonst über Buffs (`actionNegateCreature` + `expiresAtTurn`, z. B. Locke, Omikron). **Verwandt, im Repro Teil d) mit ausgeführt:** Sparky Slime („negate its effects and Abilities until your next turn", `sparky-slime.js:66`) ruft `applyCreatureStatus(…,'negated')` ohne Buff und ohne `duration` – auch diese Negation einer Kreatur bleibt nach 4–6 Zugwechseln bestehen (gehört in die Kreaturen-Gruppe, hier nur als Beleg der Engine-Ursache).

### H03-heroes-16 · Nicolas, the Hidden Alchemist: die Trank-Sperre nach dem 2. Trank gilt auch bei gefrorenem/betäubtem Nicolas · Stufe B (Randfall „tot" = C)
- **Karten:** Nicolas, the Hidden Alchemist (`cards/effects/nicolas-the-hidden-alchemist.js`, `potionLockAfterN: 2`); Verbraucher `checkPotionLock` in `server.js` (~Z. 4536–4560)
- **Voraussetzungen / Aufbau:** Sitz 0: Nicolas auf Held 0, 4× `Elixir of Quickness` (frei spielbarer Trank) auf der Hand, Deck 30 Karten. Läufe: normal / Nicolas `negated` / `frozen` / `stunned` ab dem 2. Trank (Status Dauer 3) / Nicolas tot nach dem 1. Trank. Je 4 Tränke nacheinander (`t.play`, Main 1).
- **Erwartet** (Kartentext: „After you have played your second Potion during a turn, you cannot play Potions for the rest of that turn."; Skriptkopf: „while Nicolas is alive and not negated"; Engine-Konvention B-09: gefrorene, betäubte, negierte und tote Helden verlieren ihre Heldeneffekte, auch passive Sperren): normal ⇒ 3. und 4. Trank gesperrt, nächster Zug frei; ist Nicolas beim 2. Trank gefroren/betäubt/negiert, entsteht keine Sperre.
- **Beobachtet:** normal `[true,true,false,false]` ✓, Sperre im nächsten eigenen Zug weg ✓. `negated` `[true,true,true,true]` ✓. **`frozen` und `stunned`: `[true,true,false,false]`** – die Sperre entsteht trotzdem. Fall tot nach dem 1. Trank: `[true,true,true,true]` (keine Sperre) – ob das gewollt ist, regelt die Klammer „(even if this Hero gets defeated before then)", siehe Frage.
- **Repro:** `docs/niche-tests/repro/H03-heroes/16-nicolas-traenke-sperre-bei-frost-betaeubung-tod.js` (✗ für frozen/stunned)
- **Vermutete Ursache:** `server.js:~4541` (`if (!hero?.name || hero.hp <= 0 || hero.statuses?.negated) continue;`) – kein frozen/stunned; dieselbe Klasse wie B-09 (engine-gelesener Heldenvertrag mit teilweisem Stilllegungsfilter). Gleiche Zeile im Zweig für übernommene Gegnerhelden (~Z. 4554).
- **Frage an Al** (nur Fall „tot"): „(even if this Hero gets defeated before then)" – soll die Sperre auch entstehen, wenn Nicolas zwischen dem 1. und 2. Trank fällt (jetzt: nein, weil `hp <= 0` übersprungen wird) – ja oder nein?

### H03-heroes-17 · Lolek (Shard Knight / Mender): „Future Tech Control Device" ist wählbar und landet auf dem EIGENEN Helden – der Gegner darf ihn dann übernehmen · Stufe B
- **Karten:** Lolek, the Shard Knight (`cards/effects/lolek-the-shard-knight.js`), Lolek, Mender of the Shattered Trident (gleicher Weg), Hilfsmodule `_lolek-shared.js` / `_orchestra-shared.js` (`isEquipArtifact`, `equipDestinations`); Future Tech Control Device (`future-tech-control-device.js`, `placesOnOpponentBoard: true`)
- **Voraussetzungen / Aufbau:** Sitz 0: Lolek, the Shard Knight auf Held 0, `Future Tech Control Device` in der Ablage, 100 Gold; Option „Equip from discard", Galerie-Wahl Control Device.
- **Schritte:** 1. Lolek-Effekt aktivieren. 2. Der Gegner (Sitz 1) aktiviert danach in seinem Zug die Equip-Wirkung der Karte.
- **Erwartet** (Kartentext Lolek: „… choose an equippable Artifact from your discard pile and equip it to a Hero **you control** by paying half its Cost."; Control Device: „Equip this card to a Hero **your opponent** controls. …"; beide Vorgaben zugleich sind unerfüllbar, der normale Spielweg legt die Karte über `placesOnOpponentBoard`/`_isCrossSideArtifact` (server.js ~7540) ausschließlich auf die Gegenseite): die Control Device ist für Lolek keine zulässige Wahl; jedenfalls liegt sie nicht auf einem eigenen Helden.
- **Beobachtet:** Die Galerie bietet sie an; sie landet auf `seat0/hero0/slot0` (Lolek selbst), Kosten 2 Gold (halber Preis ✓). Weil `besitzer()` in `future-tech-control-device.js` den Besitzer als `opponentOf(inst.owner)` liest, darf nun der GEGNER die Equip-Wirkung nutzen: Sitz 1 aktiviert → Lolek hat `charmedBy = 1` (übernommen). Die Karte wird so zur Falle für ihren eigenen Spieler (ein Fehlklick/CPU-Wahl genügt).
- **Repro:** `docs/niche-tests/repro/H03-heroes/17-lolek-control-device-auf-eigenen-helden.js` (3 ✗)
- **Vermutete Ursache:** `_orchestra-shared.js:38` `equipDestinations(engine, pi, cardName, { sides:[pi] })` und `_lolek-shared.js` `equippableEntries`/`hasDestination` kennen das Skript-Flag `placesOnOpponentBoard` (Cross-Side-Karten) nicht; `canEquipCardToHero` (`_engine.js:15663`) fragt nur `canEquipToHero`. Vermutlich betrifft das alle Karten, die über `equipDestinations` ausrüsten (nicht gezählt: Orchestra-Familie).

### H03-heroes-18 · Lolek, the Shard Knight: „half its Cost" rechnet vom gedruckten Grundpreis, nicht vom wirksamen Preis (Future Tech Laser Cannon) · Stufe C
- **Karten:** Lolek, the Shard Knight (`cards/effects/lolek-the-shard-knight.js`, `_lolek-shared.js: halfCost`); Future Tech Laser Cannon (`selfCostReduction`)
- **Voraussetzungen / Aufbau:** Sitz 0: Lolek, 3× Laser Cannon in der Ablage, 100 Gold; Option „Equip from discard", Laser Cannon wählen.
- **Erwartet** (Kartentext Lolek: „… equip it … by paying half its Cost."; Laser Cannon: „This card's Cost is decreased by 20 for every copy of „Future Tech Laser Cannon" in your discard pile."; Engine: `engine.artifactPlayCost` liefert den wirksamen Preis, hier 0): bei Lesart A („Cost" = wirksamer Preis) zahlt Lolek höchstens 10 Gold (Hälfte von 0 bzw. – ohne die gewählte Kopie – von 20).
- **Beobachtet:** `artifactPlayCost` = 0, aber Lolek zahlt 30 Gold (`ceil(60 / 2)`). Die übrigen Preise stimmen (Glass Sword 2 → 1, Bow of the Hunt Goddess 15 → 8, Charm of Balance 0 → 0, Cloak of Edge 4 → 2; Gold 7 < 8 ⇒ nicht angeboten, Gold genau 8 ⇒ ausgerüstet) – nur Karten mit Preisänderung (Laser Cannon; Rusting Crystal verdoppelt den Grundpreis; Rabatte) weichen ab.
- **Repro:** `docs/niche-tests/repro/H03-heroes/18-lolek-halber-grundpreis-statt-wirksamer-preis.js`
- **Vermutete Ursache:** `_lolek-shared.js:28-31` (`halfCost(cd) = Math.ceil((cd?.cost || 0) / 2)`) liest `cardData.cost` statt `engine.artifactPlayCost(...)`.
- **Frage an Al:** Meint „half its Cost" den aktuell wirksamen Preis der Karte (Laser Cannon: 0–20 ⇒ 0–10 Gold) oder den gedruckten (60 ⇒ 30 Gold)?

### H03-heroes-19 · Rescued Damsel Cecilia: das Extra-Leben wirkt auch bei negierter/gefrorener/betäubter Damsel · Stufe C
- **Karten:** Rescued Damsel Cecilia (`cards/effects/rescued-damsel-cecilia.js`, generischer Marker `hero._extraLife`, Verbrauch `_engine.js` ~9390–9720)
- **Voraussetzungen / Aufbau:** Damsel auf Held 0 (Spielstart-Hooks gefeuert, 600/600), Status `negated` / `frozen` / `stunned` (Dauer 3) bzw. keiner (Kontrolle), dann ein tödlicher Zauberschlag (`actionDealDamage … 9999 'spell'`).
- **Erwartet** (Kartentext: „The first time this Ascended Hero would be defeated, immediately revive it and heal its HP completely."; Engine-Konvention B-09: gefrorene/betäubte/negierte Helden verlieren ihre Heldenwirkungen): offen. Der Skriptkopf sagt nur „der generische `hero._extraLife` … wortgleich"; der Marker wird auch von „Divine Gift of Sacrifice"/„Trial of Coolness" als Zustand vergeben, wo er nicht an die Heldenwirkung gebunden ist.
- **Beobachtet:** Kontrolle ✓ (Revive 600/600, Marker verbraucht). Negiert, gefroren und betäubt: dieselbe Wiederbelebung, Marker verbraucht – die Heldenwirkung „wirkt" also trotz Stilllegung. (Die Damsel-Wirkung selbst ist auch nach dem Verbrauch nicht neu zu holen: korrekt.)
- **Repro:** `docs/niche-tests/repro/H03-heroes/19-damsel-extraleben-bei-stilllegung.js` (✗ = Revive trotz Stilllegung)
- **Vermutete Ursache:** Der Verbrauch in `_engine.js` (~Z. 9719 `if (!target || target.hp > 0 || !target._extraLife) return false;`) kennt weder die Quelle des Markers noch den Status des Trägers.
- **Frage an Al:** Soll eine negierte/gefrorene/betäubte Damsel ihr Extra-Leben NICHT bekommen (Heldenwirkung ruht), oder gilt der Marker wie bei Divine Gift of Sacrifice unabhängig vom Status – „ruht" oder „wirkt"?

### H03-heroes-20 · Nomu (dauerhaft übernommen): Extra-Zug und Handlimit-Freiheit gehören weiter dem ALTEN Besitzer · Stufe B
- **Karten:** Nomu, Wanderer of Worlds (`cards/effects/nomu-wanderer-of-worlds.js`, `isNomuHero` / `bypassHandLimit`); Engine-Leser `_hasActiveNomu` (`_engine.js:28839`), `_shouldBypassHandLimit` (`_engine.js:28895`)
- **Voraussetzungen / Aufbau:** Sitz 1 besitzt Nomu (Held 0), Sitz 0 übernimmt ihn dauerhaft (`actionTakeHeroPermanently(0, 1, 0)`, Paraseed-Weg; `heroSideOf` = 0). Beide Sitze 10 Handkarten, Deck 30.
- **Schritte:** 1. Sitz 0 zieht per `actionDrawCards(0, 1)`, Sitz 1 ebenso. 2. `_shouldBypassHandLimit` für beide.
- **Erwartet** (Kartentext: „… when **you** draw exactly 1 card … Draw 1 additional card from your deck. **You** have no hand size limit."; „you" = Kontrolleur des Helden, vgl. Pete, der `heroesControlledBy` liest): Sitz 0 (Kontrolleur) zieht 2 und hat kein Handlimit; Sitz 1 zieht 1 und unterliegt dem Handlimit.
- **Beobachtet:** Sitz 0 zieht 1, Sitz 1 zieht **2**; Handlimit-Freiheit: Sitz 0 `false`, Sitz 1 `true` – genau umgekehrt.
- **Repro:** `docs/niche-tests/repro/H03-heroes/20-nomu-uebernommen-wirkt-fuer-den-alten-besitzer.js` (4 ✗)
- **Vermutete Ursache:** Beide Direktleser iterieren `gs.players[playerIdx].heroes` (Brettseite) statt `engine.heroesControlledBy(playerIdx)`; der gestohlene Held steht weiter in der Heldenreihe des alten Besitzers (`permaControlBy`/`charmedBy` gesetzt). Betrifft vermutlich jeden Direktleser dieser Bauart (nicht gezählt: `bypassHandLimit`-Helden anderer Gruppen, Willy).

### H03-heroes-21 · Nicolas (dauerhaft übernommen): die Trank-Sperre gilt auch für den ALTEN Besitzer · Stufe B
- **Karten:** Nicolas, the Hidden Alchemist (`potionLockAfterN: 2`); Verbraucher `checkPotionLock` in `server.js` (~Z. 4536–4560)
- **Voraussetzungen / Aufbau:** Sitz 1 besitzt Nicolas (Held 0), Sitz 0 übernimmt ihn dauerhaft; beide Sitze je 4× `Elixir of Quickness` auf der Hand.
- **Schritte:** 1. Sitz 0 spielt 4 Tränke. 2. `t.endTurn()`; Sitz 1 spielt 4 Tränke.
- **Erwartet** (Kartentext: „After **you** have played your second Potion …"): nur der Kontrolleur (Sitz 0) wird nach dem 2. Trank gesperrt; Sitz 1 ist frei.
- **Beobachtet:** Sitz 0 `[true,true,false,false]` ✓, Sitz 1 **ebenfalls** `[true,true,false,false]` – der alte Besitzer wird für die Sperre eines Helden bestraft, den er nicht mehr kontrolliert.
- **Repro:** `docs/niche-tests/repro/H03-heroes/21-nicolas-uebernommen-sperrt-den-alten-besitzer.js`
- **Vermutete Ursache:** `checkPotionLock(ps, gs, pi)` (`server.js:~4536`): der erste Zweig prüft `ps.heroes` des Spielers, ohne `charmedBy`/`permaControlBy` zu beachten (der zweite Zweig für übernommene Gegnerhelden ist richtig). Gleiche Klasse wie 20.

### H03-heroes-22 · Santa Klaus (dauerhaft übernommen): die Spielbarkeits-Sperre zählt die Hand des ALTEN Besitzers · Stufe B
- **Karten:** Santa Klaus (`cards/effects/santa-klaus.js:57`, `canPlayCard(gs, pi, heroIdx, …)`); Vergleich Saint Nicolas (`saint-nicolas.js` `heldUndHand`)
- **Voraussetzungen / Aufbau:** Sitz 1 besitzt Santa (Held 0), Sitz 0 übernimmt ihn dauerhaft (`actionTakeHeroPermanently`) und spielt mit ihm (`charmedOwner: 1`) einen `Attack`. Fall a) Hand Sitz 0 `[Attack, Heal, Heal]`, Hand Sitz 1 leer; Fall b) Hand Sitz 0 `[Attack]`, Hand Sitz 1 5× Heal.
- **Erwartet** (Ruling Al 14.9. im Skriptkopf: „He cannot act while the player has fewer than 2 cards in hand (not counting the card used for the Action)"; „the player" = wer ihn führt; Saint Nicolas löst dieselbe Lage in `heldUndHand` mit „Die Hand gehört immer dem Kontrolleur"): a) spielbar, b) nicht spielbar.
- **Beobachtet:** a) **abgelehnt** (`validateActionPlay: nein`, Attack bleibt auf der Hand) – b) **gespielt** (Sitz 0 hat nur den Attack; kein Preis möglich, der Attack landet wegen 12 sogar in der Hand des Gegners). Die Engine reicht `canPlayCard` die Brettseite (`heroOwner`, `_engine.js:21008`), Santa liest deren Hand.
- **Repro:** `docs/niche-tests/repro/H03-heroes/22-santa-klaus-uebernommen-zaehlt-falsche-hand.js` (2 ✗)
- **Vermutete Ursache:** `santa-klaus.js:57-67` nutzt `gs.players[pi].hand` ohne den Kontrolleur aufzulösen (`hero.permaControlBy ?? hero.charmedBy ?? pi`, wie `heldUndHand` in `saint-nicolas.js`). Der Preis selbst (`afterSpellResolved`) gibt aus der Hand von `ctx.cardOwner` – im Test Sitz 0, also der Kontrolleur ✓ (nur 1 Karte, kein Prompt).

### H03-heroes-23 · Gewonnener Luna-Effekt (Pseudonia / Tempeluna): der „Firewall"-Bonus (+100 Schaden, alle Gegnerziele brennen) fehlt · Stufe B
- **Karten:** Luna, the Flame Fairy (`cards/effects/luna-the-flame-fairy.js`: `firewallModifiers`), Pseudonia, the Skill Devourer, Tempeluna, the Convergence Fairy; Verbraucher `cards/effects/firewall.js:42-50` (`firewallMods`)
- **Voraussetzungen / Aufbau:** Sitz 0: Held 0 = echte Luna (Kontrolle) bzw. Pseudonia bzw. Tempeluna mit `grantHeroEffect(0, 0, 'Luna, the Flame Fairy')` + `finishGainedHeroEffects`; keine Destruction Magic (der Bypass muss den Level ersetzen); „Firewall" in Held 0s Surprise Zone; Gegner (Sitz 1) greift Held 0 mit Fireball an.
- **Erwartet** (Kartentext Luna: „This Hero's „Firewall" Spells deal 100 additional damage and Burn all targets your opponent controls, not just the attacker."; Tempeluna: „This Hero gains the effects of both „Luna …" and „Tempeste …""; `_gained-effects-shared.js`-Kopf: „Lunas ganze Wirkung steckt in `canBypassLevelReqForCard` und `firewallModifiers` … die 42 Abfragestellen laufen seit v1186 über `heroScriptOf`"): wie bei Luna 200 Schaden auf den Angreifer und alle drei Gegnerhelden brennen.
- **Beobachtet:** Kontrolle (echte Luna) ✓ (`[400,600,600]`, alle brennen). Pseudonia und Tempeluna: Firewall löst aus (der Level-Bypass kommt an), aber nur **100** Schaden (`[500,600,600]`) und nur der Angreifer brennt (`[true,false,false]`).
- **Repro:** `docs/niche-tests/repro/H03-heroes/23-pseudonia-luna-firewall-bonus-fehlt.js` (4 ✗)
- **Vermutete Ursache:** `firewall.js:45` `const script = loadCardEffect(hero.name);` statt `engine.heroScript(hero)` (= `heroScriptOf`, `_engine.js:29824`) – eine der Abfragestellen, die bei der Umstellung auf `heroScriptOf` ausgelassen wurde. Die Gegenprobe über die anderen Heldenverträge (24-Szenarien-Sweep in der Gruppe) ergab sonst nur Gleichstand mit dem echten Helden.

## Abdeckung
Alle 37 Karten sind **L2** (gezielt); „✓" = geprüft und in Ordnung, „✗(→NN)" = Befund NN. Explorative Läufe (nicht committet) liegen im Scratchpad unter `tests/H03-heroes/`; die Befund-Repros unter `docs/niche-tests/repro/H03-heroes/`.

| Karte | Tiefe | Geprüfte Nischenfälle / Anmerkung |
|---|---|---|
| Lilly, the Charming Infiltrator | L2 | Infiltration Lv1 und Lv3 (+2 Karten) ✓, gefroren/betäubt/negiert/tot: nur die gestohlene Karte ✓, Thieving Strike/Loot the Leftovers ✓, gestohlene Lilly: Kontrolleur zieht ✓; als gewonnener Effekt (Pseudonia) ✗(→02) |
| Locke, the Unseen Saboteur | L2 | Ablauf „bis zu deinem nächsten Zug" über echte Zugwechsel ✓, Held/Kreatur als Ziel ✓ (Kreatur danach CC-immun ✓), Ziel zweimal hintereinander ✓, gefroren/betäubt/negiert/tot ✓, Erst-Runden-Schutz ✓, Abbruch (HOPT frei, nichts geändert) ✓, übernommen ✓, Pseudonia ✓ |
| Lolek, Mender of the Shattered Trident | L2 | Deck+Ablage gratis auf jeden eigenen Helden ✓, HOPT ✓, gefroren/betäubt/negiert ✓, Abbruch ✓; Control Device ✗(→17) |
| Lolek, the Shard Knight | L2 | halber Preis aufgerundet (2→1, 15→8, 0→0, 4→2) ✓, Gold 7/8 (Schwelle) ✓, Discard&Draw aus Deck/Hand ✓, Zustände ✓, Abbruch ✓, Race-Boat-Limit/voller/gefrorener Held als Ziel ✓, Pseudonia ✓; Control Device ✗(→17), Laser Cannon ✗(→18) |
| Lord Mithuru, the Rotten Mastermind | L2 | nur Mithuru selbst (Iceage Lv3 bei Decay1/MA1 ✓), negiert/gefroren/tot ✓, anderer Held neben Mithuru ✓, Reaction-Doppelzauber ohne Schule ✓, Pseudonia ✓; übernommen ✗(→07) |
| Luna Pele, the Flame Dancer | L2 | Kappe 4/Zug + Reset im Folgezug ✓, zwei Lunas je Seite ✓, gefroren/betäubt/negiert/tot ✓, eigener Held vergiftet ✓, gestohlen: Kontrolleur zieht ✓; Kreatur vergiftet ✗(→08) |
| Luna, the Flame Fairy | L2 | Firewall-Bypass (kein Destruction Magic nötig) ✓, +100 Schaden / alle Gegnerziele brennen ✓, Surprise-Träger gefroren/betäubt/negiert/tot ruht ✓; als gewonnener Effekt ✗(→23) |
| Madaga, the Forsaken Seafarer | L2 | Suche + „rest of the turn": Mill, Handabwurf, Kreaturentod, Artefakt → Gelöscht ✓, Gegnerzug-Tod → Ablage ✓, gestohlen ✓, Abbruch ✓, Pseudonia ✓; Such-Sperre ✗(→03) |
| Madame Guillotine, the Great Equalizer | L2 | Löschen und Rückkehr zum Zugende real ✓, Madame fällt/negiert nach dem Löschen: Rückkehr bleibt ✓, Wirtsheld tot/übernommen ✓ (Kartenbilanz sauber), vorher gefroren/betäubt/negiert/tot: kein Trigger ✓, Pseudonia ✓; Omikron-Platzierung ✗(→05) |
| Maya, the Nature Fairy | L2 | +50 max/aktuell auf Held/Kreatur ✓, nur eigene Ziele ✓, fremde Kreatur in meiner Zone ✓, gefroren/betäubt/negiert/tot ✓, übernommen ✓; Omikron-Platzierung ✗(→05) |
| Medea, the Swamp Witch | L2 | Gift ×2 auf Held und Kreatur ✓, gefroren/betäubt/negiert/tot ✓, zwei Medeas ×4 (Skriptkopf: multiplikativ), übernommen ✓ |
| Monia Bot, the Foretold Rescuer of Coolness | L2 | Umleitung inkl. True Damage ✓, gefroren/betäubt/negiert/tot ✓; Stempel nach schadenlosem Effekt ✗(→10); Pseudonia ✗(→02) |
| Monsieur Pete, the Booty Raider | L2 | Trigger bei Fireball/Kreatur ✓, anderer Held / Eigengift / Eigenschaden: kein Trigger ✓, Gegnergift (Tick) ✓, gefroren/betäubt/negiert/tot ✓, Such-Sperre (Galerie, nichts geholt); Pseudonia ✗(→02) |
| Nao, the Barrier Priestess | L2 | Heal über Max (Held, Kreatur), Max bleibt ✓, Pseudonia ✓; Slot-Flag ✗(→01) |
| Natas, the Master of Hell | L2 | Resource-Phase-Plan statt Ziehen ✓, gesperrt bei gefroren/betäubt/negiert ✓, Negation + 2 Gift ✓, gefrorener Natas: kein Gift ✓, übernommen ✓, Pseudonia ✓ |
| Nero Zira, the Mastermind | L2 | Kappe 5/Zug + Folgezug ✓, gefroren/betäubt/negiert/tot ✓, fremde Kreatur in meiner Zone ✓, übernommen ✓, Pseudonia ✓; Omikron-Platzierung ✗(→05) |
| Nicolas, the Hidden Alchemist | L2 | Sperre nach dem 2. Trank, Reset im nächsten eigenen Zug ✓, negiert ✓, Pseudonia ✓; gefroren/betäubt ✗(→16), tot (C, →16), übernommen ✗(→21) |
| Nieht, the Blitz Blade | L2 | Ziehen bei genau 1 Ziel, Bonus-Attack (Hand, Lv ≤ 1) auf dasselbe Ziel, HOPT ✓, Ziel fällt: kein Bonus ✓, negiert ✓ |
| Nomu, Wanderer of Worlds | L2 | Resource-Draw + Extra, 3×/Zug, 2 Karten: kein Extra, Gegnerzug Zähler frisch, Deck 1, gefroren/betäubt ✓, Pseudonia ✓; Mummy Token ✗(→04), übernommen ✗(→20) |
| Null, the Mage Slayer | L2 | Held 2 Züge negiert ✓, 0-Schaden-Treffer (Schild) negiert ✓, negierter Null ohne Wirkung ✓, übernommen ✓, Pseudonia ✓; getroffene Kreatur ✗(→15) |
| Omikron, the Faceless Illusionist | L2 | Platzierung, HP 1, negiert bis zum nächsten eigenen Zug, Name 1×/Spiel ✓, Abbruch ✓, Illusion → Ablage (Konvention „von außerhalb des Spiels", wie Beer), Pseudonia ✓; Platzier-Trigger ✗(→05, C) |
| Pes'zet, the Plague Bringer | L2 | Gift auf Held/Kreatur, immun, Erstrunden-Schutz ✓, gefroren/betäubt/negiert/tot ✓, übernommen ✓, Pseudonia ✓; Omikron-Platzierung ✗(→05) |
| Peter Röll, the Protagonist | L2 | ein/zwei Peters, Held fällt, Peter selbst fällt/anderer Peter lebt, alle Zonen voll ✓, gefroren/betäubt/negiert ✓, Pseudonia ✓ |
| Pharaoh, the Lone Living Being | L2 | Burning Finger Lv1 (kein Divinity) ohne Counter, Fireball Lv2 mit Counter ✓, Zugende bei gefrorenem Pharaoh (Opfer + 2 Karten, nicht negierbar) ✓, Pharaoh tot: kein Payoff ✓, letzter Held opfert sich → Niederlage |
| Pinta, the Singing Ship | L2 | Aufdecken + Beschwören (Lv0) als Zusatzaktion, Mischen, HOPT, Aktion bleibt ✓, alle Zonen belegt: nur aufdecken/mischen ✓, gefroren/betäubt/negiert ✓, Potion-Deck-Zug gesperrt ✓; Pseudonia mit Pinta: Zieh-Sperre überträgt sich (Folge der „starting hero"-Regel, kein Befund) |
| Pseudonia, the Skill Devourer | L2 | 24-Szenarien-Sweep gegen die echten Helden (nur Luna ✗→23; Nieht/Peter unterscheiden sich nur durch ATK bzw. Pseudonias eigenen Prompt), Nao/Mithuru/Pinta ✓; namensgebundene Skripte ✗(→02) |
| Quetzahuitl, Receiver of Sacrifices | L2 | Abstieg im Gegnerzug (Hand/Deck), im eigenen Zug Niederlage, Flächenschaden tötet alle drei, zwei fallen/dritter lebt: kein Abstieg, Quetzahuitl fällt → Niederlage (auch gefroren) ✓; Heldenkarten ✗(→06) |
| Rafflesia, the Poison Princess | L2 | Anspruch auf Zusatzaktion nach Decay/Support, negiert ✓, HOPT ✓; Gegnerzug-Reaktion ✗(→11), Pseudonia ✗(→02) |
| Rakah, the Loan Shark | L2 | ≤ 150 HP-Grenze, aktuelle HP zählen, Opfer durch Gegner: nichts, gestohlene Kreatur, Ladder to the Sky, gefroren/betäubt/negiert/tot ✓ |
| Reiza, the Chief Tormentor | L2 | Stun + Gift bei genau 1 Ziel, zweite Aktion nur mit Reiza und nur wenn alle lebenden Ziele (Helden + offene Kreaturen) vergiftet, nicht bei Teilvergiftung ✓, übernommen ✓, Pseudonia ✓ (Hinweis: „Quick Attack" gibt selbst eine Zusatzaktion – als Sonde ungeeignet) |
| Rescued Damsel Cecilia | L2 | Revive 600/600, zweiter Tod endgültig, Gift-Tick, letzter Held hält das Spiel am Leben, Wiederbelebung danach verbraucht ✓; negiert/gefroren/betäubt ✗(→19, C); Pseudonia ✗(→02, C) |
| Rha'Bi, the Living Skeleton | L2 | 3 Ziele, kein 4. auf denselben Helden, Einsammeln auch gefroren/betäubt/negiert (Ruling), Zielheld fällt, Rha'Bi fällt (Karten gelöscht), Erst-Runden-Schutz, Deck leer, HP 100 ✓; Pseudonia ✗(→02) |
| Riffel, Master of the Ultimate Gun | L2 | Suche + Rest in Ablage, Forsaken-Umleitung, handLocked/drawLocked, gefroren/betäubt/negiert/tot, HOPT, Deck 1/leer, übernommen ✓, Pseudonia ✓; unter `searchLocked` öffnet sich die Galerie, es passiert nichts, HOPT bleibt frei (Beobachtung, kein Befund) |
| Rool, the Troll Guard | L2 | disrupted → doppelter Schaden bis Ende des nächsten Rool-Zuges (echte Zugwechsel) ✓, gefroren/betäubt/negiert/tot ✓, Flächenschaden einmal, Kreatur trifft ✓, Eigenschaden nein ✓, übernommen ✓, Pseudonia ✓ |
| Sabrina, the Psychic Witch | L2 | Standard (Lv ≥ Surprise), Lv0-Kreatur reicht nicht, Abbruch nach dem Opfer, Abbruch aller Prompts ✓, Pseudonia ✓; unopferbare Kreaturen ✗(→09) |
| Saint Nicolas | L2 | Steuer wird bezahlt, Abbruch der Zielwahl behält den Trank, Aura (eigener Trank → Gegnerhand, Gegnertrank → meine Hand), negiert: Trank gelöscht und keine Steuer, negiert spielbar ✓; Gegner-Handsperre ✗(→14, C) |
| Santa Klaus | L2 | Preis von 2 Karten, Sperre unter 3 Handkarten (Zauber von der Hand) ✓, Pseudonia ✓; gespielter Zauber als Geschenk ✗(→12), negiert ✗(→13), Handsperre ✗(→14, C), übernommen ✗(→22). Dauerfeuer-Lead (Test Dummy +1) erklärt: die Batterie legt Karten nach, die Santa vorher weggegeben hat (Harness, kein Befund) |


## Getestet & in Ordnung (Auswahl)
* **Stilllegung der Heldenpassive** (Frost/Betäubung/Negation/Tod, Status mit Dauer 3 gesetzt): Luna Pele, Nero Zira, Maya, Medea, Rool, Natas, Locke, Lilly, Pes'zet, Peter Röll, Null (nur negiert geprüft), Pete, Monia Bot, Riffel, Rakah, Reiza, Nomu (frozen/stunned), Madame Guillotine, Pinta, Lolek ×2, Mithuru: bleiben stumm. Hero-Effekt-Aktivierungen sind unter Betäubung/Negation (Frost: außer Chilly Dog) nicht auslösbar – generisch in `doActivateHeroEffect`, stichprobenhaft ausgeführt für Riffel, Lolek ×2 und Pinta.
* **Engine-Verträge der Gruppe**: `chargesPerTurn` (Luna Pele 4, Nero 5, Nomu 3: Kappen, Reset im Folgezug, Status), `reduceCardLevel` (Mithuru: nur er selbst, auch als Reaction-Doppelzauber), `canBypassLevelReqForCard` + `firewallModifiers` (echte Luna), `bypassStatusFilter` (Pharaoh, Rha'Bi: wirken weiter, wenn gefroren), `potionLockAfterN` (Nicolas: negiert hebt auf, Reset im eigenen Zug).
* **Abbruch = nichts ist passiert**: Madaga, Sabrina, Omikron, Riffel, Lolek, Mender, Locke: alle Prompts abgebrochen ⇒ Hand/Deck/Ablage/Gold/Brett unverändert, kein HOPT, keine Engine-Fehler.
* **Dauern über echte Zugwechsel**: Locke (bis zum nächsten eigenen Zug), Rool (bis Ende des nächsten eigenen Zuges), Omikron-Illusion (negiert bis zum eigenen nächsten Zug), Null auf Helden (2 Züge), Rha'Bi (Einsammeln im eigenen nächsten Zug), Nicolas-Sperre.
* **Erst-Runden-Immunität**: Locke negiert den geschützten Gegner-Helden nicht, Pes'zet bietet ihn nicht als Gift-Ziel an, Rha'Bi ist in Runde 1 nicht aktivierbar. (Null/Reiza/Nieht/Natas in Runde 1 nicht gesondert geprüft.)
* **Stehlen** (`actionTakeHeroPermanently`): Luna Pele, Lilly, Nero, Maya, Pes'zet, Medea, Rool, Locke, Natas, Null, Reiza, Riffel (Deck des Kontrolleurs), Madaga (Deck des Kontrolleurs): wirken für den Kontrolleur. (Fehlerhaft: Nomu 20, Nicolas 21, Santa 22, Mithuru 07.)
* **Wiederbelebung/Spielende**: Damsel (zweiter Tod endgültig, Revive verbraucht), Quetzahuitl (Abstieg statt Niederlage; fällt danach: sofortige Niederlage, auch gefroren), Pharaoh (letzter Held opfert sich ⇒ Niederlage, Spielende sauber).
* **Kartenbilanz/Audit** nach den Läufen sauber (außer 06); keine verschluckten Engine-Fehler außer den im Bericht genannten Szenarien.
* **Bewusst nicht gemeldet** (Konvention/Ruling oder Messartefakt): Omikron-Illusion landet beim Tod in der Ablage (+1 Karte – wie „Beer from outside the game"); Medea ×4 bei zwei Medeas (Skriptkopf: multiplikativ); Santa/Saint-Nicolas-Preise sind bei fehlenden Karten korrekt gesperrt; Nieht-Kartenzahlen (jeder Treffer auf genau ein Ziel zieht); Reiza-„Quick Attack"-Fehlalarm (Karte gibt eine Zusatzaktion); Locke-Fehlalarm (ein ohne Dauer aufgelegter Status verfiel beim Zugwechsel); Sparky Slime siehe 15.
