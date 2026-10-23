# Architektur-Frage: Karten, die den Zustand DIREKT schreiben, und Karten, die Primitive benutzen

Stand 23.10.2026 · Agent W66c · reine Bestandsaufnahme (kein Spiel-/Engine-Code geändert).
Messung: `node scripts/audit-direkte-zustandsschreiber.js` (nur berichtend, Exit 0; `--json`, `--list <KAT>`, `--top N`).

Al fragt: *„Ist es von der Architektur her überhaupt sauber, wenn manche Karten sich DIREKT ins Spiel bringen (direkte Zustandsschreibzugriffe im Karten-Skript) und andere auf Primitive (`engine.action…`) zurückgreifen? Wäre vielleicht eine Umstrukturierung wert?“*

---

## 1. Kurzfassung

* **Das Muster „Primitive + Skripte“ ist richtig und wird von der Mehrheit gelebt.** **960 von 1215 Karten-Skripten (79 %)** schreiben in den Kernkategorien (Stapel, Stats, Zonen, Limits, Gold) nie selbst. **255 Skripte (21 %)** plus 29 von 103 Bausteinen (`_*-shared.js`) tun es mindestens einmal; im weiteren Sinn (eigener Reveal/Flug, Eigenbau „freie Zone“, Brett-Buchführung von Hand) sind es **400 (33 %)**.
* **Es sind keine „zwei Welten“, sondern ein Rand mit Schwerpunkten:** Ablage/Löschstapel (88 Dateien), Once-per-Turn-Stempel `hoptUsed` (103), Zonen-Zuweisung (37), Deck (40), HP-Setzen (30), Eigenbau „freie Zone“ (77), eigenes `card_reveal`/Pile-Flug (79/88). Gold (3 Dateien), ATK (4) und `hand.push` (8) sind praktisch sauber — dort steht ein harter Wächter.
* **Die Grenze ist nirgends durchgesetzt.** Jedes Skript bekommt `ctx._engine` (943 von 1215 benutzen es, 2143 Stellen) und damit den ganzen Spielzustand. Die Engine hat 1084 Methoden (593 „öffentlich“, 491 mit Unterstrich); **17 „private“ Namen werden von ≥ 10 Dateien benutzt** (`_broadcastEvent` 782 Dateien, `_delay` 696, `_getCardDB` 535 …) — der Unterstrich ist keine Grenze, sondern Namensgebung. Die Engine pflegt zudem Sicherheitsnetze gegen direkte Schreiber (knapp 20 Stellen in `_engine.js` nennen sich so) (z. B. `_ensurePileListeners`, Brett-Netz `_trackCard` → `_stempelFremdHerkunft`, ATK-Netz in `sync`). Das ist der versteckte Preis.
* **Genau dort, wo Skripte halb drinnen und halb draußen sind, sind die Bugs:** 109 der 123 Stapel-Schreiber benutzen *auch* Primitive (Entnahme per Primitiv, Rücklage von Hand). Die Invariante („Karte geht in den Stapel des Besitzers“) lebt dann an zwei Stellen und driftet.
* **Wächter wirken, wenn sie hart sind — und Ratchets allein bauen nichts ab.** Mit hartem Wächter: ATK 4 Dateien, `hand.push` 5, Gold 3. Reine Baselines frieren nur ein: `triggered-reveal` 36 → 36, `target-cancel` 68 → 67, `aoe-window` 7 → 8 seit dem ersten sichtbaren Commit (9.10.). Ein Ratchet muss deshalb an **geplante Migrationswellen** gekoppelt sein, sonst ist es nur Stillstand (immerhin: Stillstand statt Neuzugang).
* **Empfehlung: Option B (Ratchet + schrittweise Migration), kein Umbau.** Option C („Karten schreiben nur über ein enges `ctx`-API“) wäre ≈ 25–40 Wellen (Schätzung), berührt 285 Skripte direkt und alle 943 `ctx._engine`-Nutzer und bringt Proxy-Kosten in den CPU-Rollouts; der Nutzen über B hinaus ist klein. Als billige Ergänzung taugt ein **Laufzeit-Schreibzähler im Test** (Erweiterung des vorhandenen `PP_OWNER_GUARD`).
* **Achtung, Nebenwirkung für jede Migrationswelle:** Jedes geänderte Effekt-Skript erscheint im Bugfix-Kanal (Bot erkennt „Skript geändert“). Ein reiner Umbau von 100 Skripten würde den Kanal mit erklärungslosen Karten fluten. Dafür braucht der Bot einen Marker für „Refactor-Only“ (Vorschlag in Abschnitt 7, Welle 1).

---

## 2. Messung (Stand dieses Commits)

Umfang: 1215 Karten-Skripte (212 298 Zeilen), 103 Bausteine `_*.js` (22 290 Z.), `server.js` (22 192 Z.). Nicht gemessen: `_engine.js` und die Engine-Infrastruktur (`_hooks`, `_loader`, `_cpu`, `_opp` … 17 Dateien, Liste im Audit-Kopf). Spalten *K/B* = Karten-Skripte / Bausteine; `server.js` zählt einmal je Kategorie extra, steht aber nicht in K/B.

| Kat. | Muster (direkt im Skript) | Dateien K/B | Stellen | zentrale Primitive (Nutzung in Skripten) | Wächter heute |
|---|---|---|---|---|---|
| **A1** | `discardPile`/`deletedPile` `.push/.splice/=` | 74 / 13 | 146 (davon 36 mit Besitzer-Helfer in der Zeile) | `handKartenBesitzerPs` 35, `kartenBesitzerVon` 19, `actionDiscardHandCard` 43, `takeFromPile(Sync)` 84/90, `actionDestroyCard` 66, `actionMoveCard` 26, `sendBoardCardToDiscard` 10 | `check-no-splice` (nur splice/shift/pop, Baseline 10), dynamisch `PP_OWNER_GUARD` (nicht Standard) |
| **A2** | `mainDeck`/`potionDeck`/`deck` `.push/.splice/=` | 37 / 2 | 71 | `shuffleDeck` 87, `actionDrawCards` 113, `actionAddCardFromDeckToHand` 55, `actionMillCards` 20 | wie A1 |
| **A3** | `hand.push/.splice/=` | 5 / 2 | 30 (17 in server.js) | `handZugangSync` 63, `handZugang` 22, `returnToPile` 27 | `check-hand-push` (hart, aber nur `.push`; 4 Ausnahmen) |
| **B1** | `.atk =/+=/-=` | 3 / 0 | 9 (5 server.js) | `actionPermAtk` 6, `ctx.grantAtk` 18, `ctx.revokeAtk` 20, `actionSetAtkGrant` 1 | `check-atk-funnel` (hart, begründete Ausnahmen) |
| **B2** | `.hp/.maxHp/.currentHp` setzen (Held, Kreatur, `counters`) | 28 / 1 | 60 | `actionDealDamage` 95, `actionDealCreatureDamage` 160, `increaseMaxHp` 24, `actionHealHero` 17, `actionHealCreature` 10 | keiner |
| **B3** | `.defeated/.negated/.alive/.protected …` setzen | 3 / 2 | 8 | `actionDefeatHero` 15, `actionDefeat` 1, `actionNegateCreature` | keiner |
| **C1** | `supportZones[h][z] =` / `abilityZones…` (ohne Init-Zeilen) | 29 / 7 | 64 | `beschwoerZonenFuer` 53, `summonCreatureWithHooks` 47, `actionPlaceCreature` 23, `safePlaceInSupport` 19, `zoneEintragen` 12, `actionTransferCreature` 10 | keiner statisch; dynamisch Alice-Repros W62/W63 |
| **C2** | `.push/.splice/.pop` auf Zonenarray | 10 / 4 | 18 | dito | keiner |
| **C3** | `heroes[i].name/… =`, `heroes[i] =` | 2 / 0 | 7 | `actionStealHero` 2, `actionTakeHeroPermanently` 1, `actionReviveHero` 13 | keiner |
| **C4** | Brett-Buchführung von Hand: `engine._trackCard/_untrackCard` | 128 / 14 | 241 | (bewusst nur Messung: Ursache der Geister-Instanzen, wenn eine Seite fehlt) | Brett-Netz in der Engine |
| **D1** | `hoptUsed[…] =` / `delete hoptUsed[…]` (42 davon „Rückgabe bei Abbruch“) | 97 / 5 | 149 | `claimHOPT` 64, `heldenSperreKey` 12, `heroHoptKey` 4 | `check-hero-hopt` (nur Held-Schlüssel) |
| **D2** | `_oncePerGameUsed`, `_spellLockTurn`, `spellsPlayedThisTurn`, `oncePerTurn…`, `_usedThisTurn` | 17 / 1 | 44 | `oncePerGameEffectUsed`/`markOncePerGameEffect` 1 | keiner |
| **E1** | `ps.gold -=/+=/=` | 1 / 1 | 6 (4 server.js) | `actionGainGold` 25, `actionSpendGold` 11, `canAffordGold` 13 | keiner (Befund: sauber) |
| **F1** | eigenes `'card_reveal'` | 76 / 2 | 92 | `commitAppearance` 10, `revealSearchedCards` 9 | `check-triggered-reveal` (Baseline 36), dynamisch Wire-Sweeps W63d/W64b |
| **F2** | eigener Pile-Flug `'play_pile_transfer'` | 74 / 13 | 116 | `_pileFlight` (privat) | keiner |
| **F3** | `engine.io.to(…).emit`, `emitToOpponents`, `socket.emit` (umgeht den Auftritts-Puffer) | 16 / 1 | 24 in Skripten (170 mit server.js) | `_broadcastEvent` 782, `emitToOpponentsGs`, `sendToSpectators` | keiner |
| **G1** | selbst definierte „freie Zone“-Funktion (`findFreeSlot`, `getFreeZones`, `hasFreeZone` …) | 66 / 10 | 118 | `beschwoerZonenFuer` 53, `canShareInto` 25, `geteiltZuerst` 18, `eligibleSummonZones` 16, `zoneEintragen` 12, `mitGeteilten` 11 | keiner statisch; dynamisch W62/a-03, W63/a-02 (25 Karten) |
| **G2** | `supportZones`-Schleife + `.length === 0` im 6-Zeilen-Fenster (Obergrenze) | 66 / 7 | 108 | dito | keiner |
| **H1** | `engine._x`, Name in ≥ 10 Dateien (de facto API) | 943 / 74 | 3904 | — | `check-scope`, `check-gamestate-fields` (nur Lesen/Namen) |
| **H2** | `engine._x`, Langschwanz (214 Namen in < 10 Dateien) | 204 / 33 | 699 | — | keiner |
| **I1** | öffentliche `gs.x =` direkt (ohne Init-Zeilen `if (!gs.x) gs.x = {}`) | 7 / 2 | 59 (37 server.js) | — | `check-gamestate-fields` (Namen, nicht Schreiben) |
| **I2** | Kramzustand `gs._x =`, `ps._x =`, `inst._x =` | 371 / 24 | 1122 | — | keiner (etablierte Kartenform) |

Zusammenfassung (A1–A3, B1–B2, C1–C3, D1–D2, E1 = „engerer Sinn“): **255 Karten-Skripte + 29 Bausteine**, Verteilung „Kategorien je Datei“ 1→240, 2→37, 3→5, 5→2, (11 = `server.js`). „Weiterer Sinn“ (+ B3, C4, F1–F3, G1–G2): **400 Karten-Skripte + 42 Bausteine**. Ratchet-Größe = Zahl der (Datei × Kategorie)-Paare: **350** (eng) bzw. **835** (weit).

Vereinigungen (Dateien, K = Karten-Skripte): A 123 (K 107), C inkl. C4 157 (K 141), C1–C3 allein 48 (K 37), D 120 (K 114), F 149 (K 134), G 111 (K 96).

Mischung Schreiber/Primitiv je Gruppe (nur Primitive · beides · nur direkter Schreiber): A 390 · **109** · 14; B 438 · 18 · 18; C 173 · 47 · 110; D 57 · 25 · **95**; E 50 · 2 · 1; F 21 · 6 · **143**; G 62 · 43 · 68. Lesart: bei A schreiben fast alle Schreiber *zusätzlich* über Primitive (halb drinnen), bei D und F gibt es für die Skripte praktisch keine Primitive, die sie benutzen.

**Grenzen der Messung.** Regex, zeilenweise, Kommentare ausgeblendet. *Obergrenze*: gleichnamige Felder an Hilfsobjekten (Stichprobe B2: über 90 % echt, z. B. `_meta.maxHp +=` ist ein Fehlalarm), G2 liest auch harmlose Schleifen. *Untergrenze*: Aliasse (`const pile = ps.discardPile; pile.push(x)`), Schreiben über Hilfsfunktionen im selben Skript, dynamische Schlüssel. Initialisierungszeilen (`if (!ps.discardPile) ps.discardPile = [];`, `supportZones[h] = [[],[],[]]`) sind ausgeklammert. Die Größenordnung ist belastbar; zum Planen einer Welle `--list <KAT>`.

---

## 3. Was hat gewirkt? (Wächter-Bilanz)

| Wächter | Art | Bestand heute | Verlauf |
|---|---|---|---|
| `check-atk-funnel` | hart + begründete Ausnahmeliste | 4 Dateien (alle auf der Ausnahmeliste) | v1087: drei Umgehungen in Engine und `curse.js` |
| `check-hand-push` | hart + 4 Ausnahmen (nur `.hand.push`) | 5 Karten-Skripte schreiben `.hand` anders (Zuweisung/splice), 2 davon CPU-Rollouts | Kopfkommentar: „bis v1394 ~80 Module“ |
| `check-no-splice` | Ratchet (Baseline) | 10 Stellen in 2 Dateien | Kopfkommentar: v819-Sweep 127 Altstellen; erste sichtbare Baseline 11 |
| `check-triggered-reveal` | Ratchet | 36 | seit 9.10. unverändert |
| `check-target-cancel` | Ratchet | 67 | 68 → 67 |
| `check-aoe-window` | Ratchet | 8 | 7 → 8 |
| Gold | kein Wächter, aber Primitive früh vollständig | 3 Dateien | Positivfall: `actionSpendGold/GainGold` haben alle Wege abgedeckt |

Lehre: **Wächter + vollständige Primitive + eine Migrationswelle** konvergieren gegen Null (ATK, Hand, Gold). **Ratchet ohne Migration** friert ein, baut aber nicht ab. **Keine Prüfung** (A1/A2, C1, D1, F3, G) heißt 30–100 Dateien je Kategorie, und dort liegen die Wiederholungsbugs.

Zusätzlich: Die `check-*.js` laufen weder in `npm test` (das startet nur `test/*.test.js`, derzeit 2 Tests) noch in einem Workflow im Repo (kein `.github/`). Sie laufen, weil Agenten sie laufen lassen. Im Ausgangszustand ist nur `check-scope.js` rot (63 Altstellen in 8 Dateien).

---

## 4. Befund und Bewertung je Kategorie

*Legitim* ist (a) jeder Lesezugriff (nicht gemessen; allein ~5200 Erwähnungen auf `gs.players`/`engine.gs`), (b) Initialisierungszeilen, (c) Schreiben am **eigenen, frisch erzeugten** Objekt der Karte (Token-Instanz `inst.counters.currentHp = 1` direkt nach Beschwörung), (d) Kramzustand im eigenen Namensraum (I2: `gs._meineKarte…` — etablierte Form, 395 Dateien; riskant erst, wenn die Engine ihn auch kennen muss, z. B. `_spellLockTurn`, `_oncePerGameUsed`), (e) ein Baustein, der **der einzige Schreiber seiner Familie** ist (`_hero-hopt-shared`, `_alice-shared`), (f) CPU-/MCTS-Rollouts und Testaufbauten (`soul-shard-ren`, `smuggler-s-pier`, Debug-Handler in `server.js`), (g) `server.js` und `_engine.js` selbst (sie *sind* die Zustandsschicht).

| Kat. | Bewertung | verletzbare Invariante | Bugs/Wellen, die es nachweislich gab |
|---|---|---|---|
| **A1/A2** Stapel | **riskant** | Karte → Stapel des *permanenten Besitzers* | W3/Welle 5 (14.10.), **W63c**: ~20 Skripte entnahmen per `takeFromPileSync` und schrieben `ps.discardPile/deletedPile.push` auf den Halter (Bottled Flame/Lightning, Jump in the River, Dive Down, Unwanted Audience, Love Shot, Nieht, Taio, Cooldin, `_castSpellImmediately` …), **W64c**: Forbidden Zone, Liberation, Magic Topaz, Rebelliokai Courtly Kirin, Front Soldier, Staff/Create Illusion (Deck des Diebs), Rain of Death, Quetzahuitl, Crimson Web (15 Dateien) → Vertrag „ohne Ausnahmen“ in CARD_API |
| **A3** Hand | sauber | Herkunftsmarke (`_handOriginals`) | W63c: Geister-Handinstanzen; `check-hand-push` hält |
| **B1** ATK | sauber (Wächter) | Fluch-Zwischenspeicher, ATK-Auren, `permAtkDelta` | v1087 (Trichter), **W54a**: Mirjam schrieb `target.atk += amount` am Trichter vorbei (unter Fluch wuchs die sichtbare ATK trotz „always 0“); Cloak of Edge, Nero Zira, Rakah, Chaorc Pyre Grill Master, Wavilion → `actionPermAtk`; W53a, W57a, W58a (ATK-Buchführung, Core/Gun) |
| **B2** HP setzen | **riskant, unbewertet** | Schutz-/Defeat-Pfade, `onHeroDefeated`, Auren | kein dokumentierter Einzelbug, aber 28 Karten setzen HP direkt (viele „auf 1 HP überleben“: Golden Ankh, Guardian Angel, Emergency Spell Armor, Phoenix Bombardment, Paraseed Zombie). Verwandt: **W14** (Insta-Kill-Defeat prallte nicht an Resistance ab → zentral `actionDefeatHero`), **W64a/D** („defeat“ = Kill via Effekt: Eraser Beam nutzte vorher 99999 Schaden) |
| **B3** Flaggen | niedrig | Defeat/Schutz zentral | dieselben W14/W64a-Fälle; nur 8 Stellen |
| **C1/C2/C3** Zonen | **riskant** | Alice-Teilung (Stapel statt Überschreiben), Brett-Netz, `onPlay`-Hooks | **W62a/W63a/W64a**; W63-Beobachtung: `actionPlaceCreature` überschreibt belegte, nicht teilbare Zone → Geisterinstanzen (offen); Zonen-Schreiber mit den meisten Stellen: Teleportation Powder 8, Compulsory Body Swap 6, Guard Change 6, `_deepsea-shared` 6 |
| **C4** `_trackCard` von Hand | mittel | beide Seiten der Buchführung | W63c (Geister-Handinstanz), W46a (Crimson Web, bekannte Geister-Instanz an der Angreifer-Zone) |
| **D1/D2** Limits | **riskant** | Stempel erst im Commit, Rückgabe bei Abbruch, pro Spieler statt pro Heldenplatz | **W13** (Taio, Archibald, Learning, Rubin, Zi: Karte/Stempel vor dem Commit), Z7/F02-20 („Abbruch heißt: nichts ist passiert“), v1275 (Heldensperre pro Spieler → `check-hero-hopt`), **W64a/W65a** (Kosten vor dem Auftritt: Forceful Revival × 500 Piranhas) |
| **E1** Gold | sauber | Kostenvorrang, Gold-Audit | kein Bug aus direktem Schreiben |
| **F1–F3** Sichtbarkeit | **riskant (F3), mittel (F1/F2)** | Auftritt erst nach dem Commit, vor dem ersten Effekt | **W63d**: Backpack; 27 Karten Ereignis-Leck, 148 Zustands-Leck, 10 Aktivierungen; die `deferBroadcast`-Karten (Magic Lamp, Monster/Planet/Horn in a Bottle, Alchemic Journal, Boomerang, Birthday Present, Staff of Illusions …) zeigten sich per `engine.io.to(…).emit` selbst; **W64b** (Staff of Uncontrollable Destruction); Accusation/Spreading Rumor mit Früh-Auftritt; 16 Skripte rufen `engine.io.to` noch direkt (F3), 18 `_firePendingCardReveal` statt `commitAppearance` |
| **G1/G2** Eigenbau „freie Zone“ | **riskant** | Alice-Teilung, „free Support Zone“ für ALLE Wege | **W62a**: ~35 Karten/Bausteine fragten „freie Zone“ ohne Teilung, 13 handgebaute Platzierer (Raise the Minions!, Xuanwu, Create Illusion, Staff of Illusions, Necromancy …); **W63a**: ~40 weitere Karten nach „systematischer Suche nach jeder Zonenschleife“ (Pinta-Familie, Slimes, Cute-Karten …) |
| **H1** de-facto-API | **kein Risiko, aber Grenze fehlt** | — | Dokumentiert, was öffentlich *sein sollte* |
| **H2** Langschwanz | mittel | Verträge aus CARD_API | z. B. 7 Skripte rufen `_applyHeroAtkDelta` (W54a-Vertrag: `actionPermAtk`; teils begründet, kartengebunden), 18 `_firePendingCardReveal` (W64b-Vertrag: `commitAppearance`), 8 `_castSpellImmediately`, 8 `_tagHandCardOrigin`: Primitive, die es gibt, aber *privat heißen* |
| **I1** öffentliche `gs.x =` | niedrig | gemeinsamer Zustand | nur 7 Karten + 2 Bausteine (nach Abzug der Initialisierungen, v. a. `gs.heroEffectPending`, `gs.effectPrompt`); die öffentlichen Felder sind also praktisch tabu — gut |
| **I2** Kramzustand | legitim | — | etablierte Kartenform |

Ehrliche Einschränkung: Die Zuordnung Kategorie → Welle ist aus den Welle-Dokus (CARD_API, `FIXES-WELLE-*.md`) abgeleitet, nicht aus einer Zeile-für-Zeile-Prüfung; der Git-Verlauf beginnt erst am 9.10.2026. Zahlen wie „~20 Skripte“ sind die der Dokus.

---

## 5. Ist die Architektur „sauber“?

**Das Grundmuster ja, die Durchsetzung nein.**

* **Dafür:** 79 % der Skripte brauchen keinen Direktzugriff; Primitive sind breit genutzt (`actionDealCreatureDamage` 160 Skripte, `actionDrawCards` 113, `beschwoerZonenFuer` 53); Hooks und Auftritts-Puffer funktionieren zentral; die zentralen Bausteine der letzten Wellen (Besitzer-Netz, Auftritt VOR dem ersten Effekt, `beschwoerZonenFuer`) haben mit *wenigen Änderungen an der Engine* große Klassen auf einmal gelöst. Viele Bugs sind nicht „Skript falsch“, sondern „Skript und Primitiv sind uneins“.
* **Dagegen:** Es gibt keine Grenze. Wer `ctx._engine.gs` hat, kann alles, und tut es: 255 Skripte schreiben Zustand selbst, 204 benutzen Langschwanz-Interna. Jede neue Invariante (Besitzer, Auftritt, Alice, ATK-Buchführung) muss deshalb **doppelt** gebaut werden: als Primitiv *und* als Sweep über alle Skripte, die daran vorbei schreiben. Der Aufwand pro Welle wächst mit der Zahl der Umgehungen, nicht mit der Größe der Regel. Die Engine wird dabei durch Netze komplizierter (`_ensurePileListeners` schützt vor Skripten, die in Piles schreiben, ohne Listener zu starten).
* **Warum das Muster trotzdem driftet:** (1) Das Primitiv fehlt oder ist unhandlich (kein „lege Karte in Stapel des Besitzers“ — nur Entnahme; `claimHOPT` hat kein Gegenstück zum Zurückgeben; keine Bewegen-/Tauschen-Primitive für Zonen), also baut die Autorin es nach; (2) Karten werden von Agenten **nach Vorbild bestehender Karten** geschrieben, und das Vorbild schreibt direkt; (3) nichts wird rot.

Aufwand/Nutzen in einem Satz: Das Muster beizubehalten kostet nichts; die Durchsetzung kostet ein Skript und ~9 kleine Wellen; sie spart pro künftiger Invariante die Sweep-Welle (zuletzt je 2–3 Wellen: Alice W62a/W63a/W64a, Besitzer W63c/W64c, Auftritt W63d/W64b/W65a).

---

## 6. Optionen

| | A: nichts ändern | **B: Ratchet + schrittweise Migration** | C: enges `ctx`-API / Proxy |
|---|---|---|---|
| Idee | Wächter und Sweeps weiter pro Welle | `check-zustandsschreiber.js`: Bestand gezählt und eingefroren (Datei × Kategorie), Neues wird rot; je Kategorie eine kleine Migrationswelle senkt die Baseline | Skripte bekommen nur ein schmales `ctx`; Zustand als Proxy/Frozen, Schreiben nur in Primitiven |
| Aufwand | 0 | Welle 1: Skript + Baseline + `npm test`-Anschluss (klein); danach ~6–8 Wellen (A 2, C/G 2, D 2, B2 1, F-Rest 1), jede einzeln lohnend und jederzeit stoppbar | 285 Skripte umschreiben + alle 943 `ctx._engine`-Nutzer (2143 Stellen), ~590 öffentliche Methoden auf ein API verdichten; ≈ 25–40 Wellen |
| Nutzen | Bugklassen werden einzeln nach dem Fund behoben (Praxis der letzten ~15 Wellen) | stoppt den Neuzugang sofort, macht Altlast sichtbar, jede Welle löscht eine Fehlerklasse *statt* sie zu suchen | maximal (Fehlerklasse unmöglich) |
| Risiko | Wiederkehr; jede neue Karte kann eine Invariante verletzen | Regressionen beim Migrieren (Repro-Sweeps vorhanden); Regex-Lücken (Aliasse); Bugfix-Kanal-Flut | hoch: 1215 Skripte, Proxy-Kosten in CPU/MCTS (`_cpu.js` 14 420 Zeilen, `_inMctsSim`), viele legitime Sonderzugriffe |
| Bemerkung | | Voraussetzung auch für C | nicht empfohlen; „C-light“ siehe unten |

**Empfehlung: B, beginnend mit einer kleinen Welle, dann in der Reihenfolge Risiko × Fehlergeschichte.** Zusätzlich billig (C-light, optional ab Welle 2): ein **Laufzeit-Schreibzähler** im Test, der — wie der vorhandene `PP_OWNER_GUARD` die vier Stapel — Zustandsarrays/Heldenobjekte per Proxy instrumentiert und Schreibzugriffe aus `cards/effects/<karte>.js` (nicht `_engine.js`) über die 1325 Repros zählt. Das schließt die Regex-Untergrenze (Aliasse) ohne Produktionskosten und liefert Als „wie viele Karten wirklich“ dynamisch.

Ausgestaltung von B (konkret):
* **Ein Muster-Modul** (`scripts/lib/zustandsschreiber-muster.js`) für Audit *und* Check, damit sie nicht auseinanderlaufen.
* **Baseline je Datei × Kategorie** (wie `no-splice-baseline.json`): rot bei Neuzugang *oder* Anstieg. `--update` darf nur senken; Anheben nur mit `--zulassen "<Begründung>"` (steht dann in der Baseline). Der Anstieg von `aoe-window` 7 → 8 zeigt, dass ein freies `--update` nicht reicht.
* **Zeilenmarke für legitime Einzelfälle** (`// zustand-ok: <Grund>`), im Audit mitgezählt.
* **Harte Kategorien ab Tag 1** (Baseline leer bzw. Ausnahmeliste wie `check-atk-funnel`): A3, B1, E1, F3, C3, B3. Baseline-Kategorien: A1, A2, B2, C1, C2, D1, D2, G1.
* **In `npm test` einhängen** (`test/checks.test.js` ruft alle `check-*.js`; `check-scope` entweder auf null bringen oder bis dahin ausnehmen), sonst „wird rot“ nur, wenn jemand daran denkt.

---

## 7. Migrationsplan der ersten drei Wellen

Annahme zur Durchsatzgröße: frühere Wellen haben ~35–40 Skripte je Welle umgestellt (W62a ≈ 35, W63a ≈ 40, W64c 15 Dateien) — jeweils mit Repro-Sweep.

| | **Welle 1 (W67a): Gerüst + Nullkategorien** | **Welle 2 (W68a/b): Stapel (A)** | **Welle 3 (W69a/b): Zonen (C/G)** |
|---|---|---|---|
| Kategorie | Wächter bauen; F3, A3, B1, E1, B3, C3 auf *null/Ausnahmeliste*; `_firePendingCardReveal` → `commitAppearance` | A1 + A2: 74 + 37 Karten, 15 Bausteine (123 inkl. server.js) | C1–C3 + G1: 29 + 66 Karten (G2 als Hinweis); C4 nur messen |
| fehlende Primitive | keine neuen nötig (`commitAppearance`, `_broadcastEvent`, `emitToOpponentsGs`, `actionGainGold` existieren); für E1 ggf. Rückerstattung: `actionGainGold` mit `source` | **`engine.legeInStapel(pi, pile, name, { von, inst, position, source })`**: Gegenstück zu `takeFromPile`, löst den Besitzer auf (`handKartenBesitzerPs`/`kartenBesitzerVon`/`tokenAbgang`), legt an, startet `_pileFlight`/Listener. Heute gibt es nur Entnahme (`takeFromPile`), `returnToPile` (nimmt `pi` unverändert, nicht besitzerbewusst) und `handKartenBesitzerPs(...).push` von Hand | **`actionMoveSupportCreature`/`actionSwapSupport`** (Guard Change, Slippery Ice/Skates, Memory Blast, Jumper Spider, Compulsory Body Swap, Teleportation Powder = 10 C2-Skripte + Teil der 29 C1); `zoneEintragen` auf Ability-/Equip-Zonen ausdehnen |
| Wächter vorhanden | `check-atk-funnel`, `check-hand-push`, `check-no-splice`, `check-triggered-reveal`; Wire-Harness `lib/wire.js` + Sweeps `W63/d-07`, `W64/b-05` für F3 | `check-no-splice`; dynamisch `PP_OWNER_GUARD` (`lib/besitzer.js`) und Sweeps `W64/c-02`, `c-05`; Repros `W63/c-01…07`, `W64/c-03…08` | Alice-Repros `W62/a-01…05`, `W63/a-01…06`, `W64/a-01…05`, `lib/alice-brett.js`; `check-areas` |
| Wächter neu | **`check-zustandsschreiber.js`** (Baseline 350 Paare), `test/checks.test.js`; MoniaBot-Marker „Refactor-Only“ | A1/A2-Baseline sinkt; `PP_OWNER_GUARD=strict` im Standard-Sweep | G1-Lint „keine selbst definierte `free*Zone`-Funktion“ (Baseline 66+10); C1/C2-Baseline sinkt; Sweep „jede Karte mit Zonen-Schreiber × Alice“ (heute nur 25 Karten in `W63/a-02`) |
| Umfang | 1 Welle; F3: 16 Karten + 1 Baustein, `_firePendingCardReveal`: 18 | 2 Wellen: (a) mechanisch die 36 Stellen im Idiom `handKartenBesitzerPs(ps, X).discardPile.push(X)` per Codemod, (b) die ~110 „nackten“ Stellen einzeln prüfen (Mill/eigener Stapel ist legitim: `legeInStapel(…, { eigen: true })`) | 2 Wellen: (a) Bewegen/Tauschen + C1/C2, (b) G1-Aufräumen (66 Karten mit eigener „freie Zone“-Funktion, viele delegieren schon an `beschwoerZonenFuer`) |
| Ausstiegskriterium | Audit meldet F3 = 0, B1/E1/A3 nur Ausnahmeliste; Check grün; `npm test` führt Checks aus | A1/A2 ≤ 15 Dateien (Rest = begründete Ausnahmen) | C1/C2 ≤ 8, G1 ≤ 15 (Rest = Bausteine, die selbst die Zonenfrage stellen) |
| Risiko | gering; F3 → Puffer ändert die Reihenfolge der Auftritte (Sweeps decken ab) | mittel: Besitzer-Regeln sind heikel, daher dynamischer Wächter strikt | mittel: Alice-Teilung × Opfer-/Ersetzen-Karten (W17/W19/W20-Rulings) |

Danach, grob in dieser Reihenfolge: **Welle 4–5 Limits (D)** — `releaseHOPT`/`stampHOPT`-Primitive (Gegenstück zu `claimHOPT`; `_hoptAbzug`/`_hoptWiederherstellen` sind privat und ungenutzt), 97 Karten, Regel „Stempel erst im Commit“ als Primitiv statt als Konvention; **Welle 6 HP-Setzen (B2)** — erst Ruling von Al (siehe Fragen), dann `actionSetHp`; **Welle 7 F1/F2-Rest** — `_pileFlight` öffentlich, eigenes `card_reveal` → `revealToOpponent`; **Querschnitt „öffentliche API prüfen“**: die 17 de-facto-öffentlichen Namen und die oft genutzten Langschwanz-Namen (`_castSpellImmediately`, `_tagHandCardOrigin`, `_isHeroEffectSilenced`, `_heroLabel`, `_runBeforeSummon`) umbenennen/aliasieren, damit „privat“ wieder etwas bedeutet.

**Zum Bugfix-Kanal.** `CLAUDE.md`/`docs/MONIABOT.md`: jedes geänderte Effekt-Skript erscheint im Kanal (mit `Bugfix-Note` erklärt, ohne unerklärt; geänderte Bausteine > 12 Karten ergeben eine Textzeile). Eine Migrationswelle mit 80 Skripten postet 80 Karten ohne Erklärung. Vorschlag (kleine Änderung in `bot/lib/bugfix.js`): eine Commit-Zeile `Refactor-Only: <Karte oder _baustein>` (oder `Refactor-Only: *`) unterdrückt die Karte; Kennzahl im Test. Bis das steht, Migrationswellen entweder klein halten oder die Bausteine umbauen (Textzeile statt Bilder).

---

## 8. Offene Fragen an Al

1. **Besitzer-Regel statisch?** Die Regel gilt „ohne Ausnahmen“; soll dann auch jede direkte Stapel-Zeile im Karten-Skript als Verstoß gelten (Kategorie A hart, Ausnahmen begründet), oder sind Mill-/Eigenstapel-Fälle (`ps.discardPile.push` aus dem eigenen Deck) ausdrücklich erlaubt?
2. **Refactor-Wellen ohne sichtbaren Spielerbug** (nur Umbau, Regressionsrisiko, Repro-Sweeps nötig): einverstanden? Und darf der Bot dafür einen „Refactor-Only“-Marker bekommen?
3. **`npm test` um die `check-*.js` erweitern?** Dafür muss `check-scope.js` (63 Altstellen) auf null oder ausgenommen werden.
4. **HP-Setzen** („survive at 1 HP“, „HP wird N“): zählt das regeltechnisch als Heilung, als Schaden-Verhinderung oder als eigener Vorgang (löst Auren/Hooks aus)? Davon hängt das Primitiv `actionSetHp` ab.
5. **Reihenfolge:** Stimmt „Stapel → Zonen → Limits“ mit dem überein, was dir in der Praxis am meisten weh tut (Besitzer vs. Alice vs. Commit-Stempel)?

---

## 9. Nebenbefunde (nicht angefasst)

* `cards/effects/CARD_API.md` enthält die Abschnitte W49–W65 **zweimal** (um Zeile ~23 247–24 420 und ~25 288–26 636, nach einem Merge); Änderungen an Verträgen müssten an beiden Stellen erfolgen, bis das bereinigt ist.
* Der Git-Verlauf im Repo beginnt am 9.10.2026 (ein großer Anfangscommit); Aussagen über frühere Zahlen stützen sich auf Kopfkommentare der Wächter.

## 10. Nachmessen

```
node scripts/audit-direkte-zustandsschreiber.js                # Bericht
node scripts/audit-direkte-zustandsschreiber.js --json         # maschinenlesbar
node scripts/audit-direkte-zustandsschreiber.js --list A1      # alle Fundstellen einer Kategorie (Datei:Zeile)
node scripts/audit-direkte-zustandsschreiber.js --top 30       # mehr Dateien je Kategorie
```

Zum Wiederholen nach jeder Migrationswelle: Zahl *Karten-Skripte mit ≥ 1 direktem Schreiber (eng)* im Kopf des Berichts (heute 255 von 1215) und die Ratchet-Größe (heute 350 / 835) notieren.
