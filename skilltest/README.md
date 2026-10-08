# Skill Test — Modus „bis zu 8 Spieler, Bau-Phase, Rounds"

Dritter Spielmodus neben Constructed und Draft. Alles, was im normalen Spiel funktioniert,
soll hier ebenfalls funktionieren — der Modus hängt deshalb **außen** an der Engine
(Lobby, Vorbereitung, Rundenlauf, Bots), und die Engine selbst kennt nur wenige, klar
markierte Skill-Test-Zweige (`gs.skillTest`).

## Ablauf

1. **Lobby** (`index.js`): Host legt den Raum mit der Option „Skill Test" an, Menschen treten bei,
   CPU-Sitze lassen sich online hinzufügen/entfernen (`st_add_cpu`, `st_remove_cpu`), Host startet (`st_start`).
   CPU-Sitze bekommen eine zufällige Helden-Persona (Name/Avatar).
2. **Vorbereitung** (`prep.js`, `pool.js`, Regeln in `public/skilltest-rules.js`): Jeder Spieler bekommt 18 Karten
   (3–5 Helden, 1–5 Abilities, 4–12 Creatures, Rest Artifacts/Potions/Attacks/Spells; nie Ascended) aus einem
   gemeinsamen Pool — jede Karte existiert im ganzen Spiel nur einmal. Platziert wird frei (kein Level, keine Kosten),
   Abilities steigen automatisch auf Stufe 3. **Start-Abilities der Heroes beginnen ebenfalls auf Stufe 3** (`START_ABILITY_LEVEL` in
   `public/skilltest-rules.js`; im Normalspiel Stufe 1): ein Hero mit Destruction Magic wirkt so gleich alle Destruction-Zauber bis Stufe 3.
   Jede Ability liegt je Hero nur einmal (die Stufen stapeln sich in einer Zone); dieselbe Ability von der Hand auf eine Stufe-3-Zone ist gesperrt. Der Recycler wirft jede 2. eingeworfene Karte als zufällige neue Karte
   aus (Helden nur, solange das Brett voll ist). **Ready!** schließt die Vorbereitung ab. Timer: Zahlenfeld je Timer, **0 = aus**
   (`buildRoomConfig`; die alten Flaggen `prepTimerDisabled`/`turnTimerDisabled` gelten weiter).
   Die Regeln (`applyMove`, `canDrop`, …) sind rein und laufen auf Server **und** Client.
3. **Kampf** (`battle.js`): Aus den Basen wird ein normaler `gameState` samt `GameEngine` gebaut. Startspieler ist, wer
   die meisten Karten recycelt hat (Gleichstand: Zufall); die Reihenfolge rotiert je Round rückwärts.
4. **Rounds/Turns** (`rounds.js`): Ein Zug = eine Aktion eines *Akteurs* (bereiter Held oder Creature mit aktivem Effekt).
   Held anklicken = Basisangriff (die Karte „Attack"), Held-Effekt → Menü (Effekt oder Attack). Erschöpfte Akteure sind
   ausgegraut. Zusatzaktionen/Boni kosten den *Spieler* den Zug, nicht den Helden. Spieler ohne Akteure werden
   übersprungen; die Round endet, wenn niemand mehr einen Akteur hat.
5. **Ende** (`battle.js` `finishGame`): Wer alle Helden verliert, scheidet aus (Creatures handeln weiter). Letzter
   Überlebender gewinnt. SC: 1 je Round + 5 je ausgestochenem Spieler + 5 für den Sieg (`config.js`).

## Dateien

| Datei | Aufgabe |
| --- | --- |
| `config.js` | **Alle** Regel-/Balance-Konstanten und die Hard-Excludes. Hier drehen, nicht in der Engine. |
| `index.js` | Lobby-Handler, Phasen, `publicState`, Wiederverbinden, Bot-Zug-Planung, Raumabbau. |
| `pool.js` / `autoprep.js` | Kartenpool (einmalig, `skilltestLegal`), Hände, automatische Basis (Bots, Timeout). |
| `prep.js` | Server-autoritative Vorbereitung (Züge validieren, Recycler, Timer, Ready). |
| `battle.js` | Kampfstart, Zug-/Prompt-Wächter, Spielende, Sitzwechsel (CPU-Übernahme, Aufgeben). |
| `rounds.js` | Round-/Turn-Treiber, Akteure, Zugerkennung (`act`), Basisangriff. |
| `engine-ext.js` | Einbauten in die Engine-Instanz (Ausscheiden, Zugende, Bot-Sitze, AoE-Spielerwahl …). |
| `bot.js` / `policy.js` | Bot (Heuristik, gewichtbare Policy, nutzt das gelernte Profil). |
| `learn/` | Lernsystem: `profile.js` (Profil-Datei), `personas.js` (Spielstile), `keepmodel.js` (Behalten/Recyceln mit Kontext), `train.js` (Selbstspiel/Liga), `ranking.js` (Kartenliste, Verlauf, Vergleichsspiele), `background.js` (Dauerbetrieb). |
| `sim.js` / `sim-bridge.js` | Headless-Spiele ohne Server (Tests, Training). |
| `../public/skilltest-art.js` | Pixelart der Vorbereitung, programmatisch gemalt (Recycler mit Mund-Deckel, Fackeln, Dielenbrett, Kerkerwand, Münze; Verläufe nur über Bayer-Dithering). |
| `../card-images.js` | Karte → Bilddatei in `./cards` (Deckbuilder-Endpoint `/api/cards/available`, Kartenpool, Personas). |

## Bots und Lernsystem

CPU-Sitze bekommen eine zufällige Helden-Persona (nur Name/Avatar). Gespielt wird mit `policy.js`: Basisangriff,
Hero-/Creature-Effekte, Handzauber, Beschwörungen (verbrauchen den Zug) sowie Artifacts/Surprises (frei). Im Aufbau
(`policy.prepareBase`, `autoprep.buildWithRecycling`) wählt der Bot Heroes nach Wert, verteilt Abilities/Support nach
gelernter Passung und wirft alles Unbrauchbare in den Recycler (Gold, früherer Spielbeginn).

Gelernt wird per **Selbstspiel** (headless, 2–8 Sitze gemischt, `learn/train.js`) in **fünf Kanälen**, alle in einer Datei
(`data/skilltest-profile.json`, per `PP_ST_PROFILE` umlenkbar, atomar gespeichert, `version` zählt hoch):

| Kanal | Inhalt | Wird genutzt für |
| --- | --- | --- |
| `playValue` | mittlerer Zuwachs der Stellungsbewertung nach dem Ausspielen einer Karte/Aktion | Reihenfolge der Aktionen, Zauber-Timing; mit UCB-Neugier für selten Gespieltes |
| `cardValue` / `pairValue` | mittlere Platzierungsgüte von Basen mit dieser Karte bzw. diesem Paar (Held+Ability/Creature, Ability+Creature, Held+Held) | Heldenwahl, Ability-/Support-Verteilung, was recycelt wird |
| `keepModel` | Behalten oder recyceln, **mit der restlichen Hand und dem Brett als Kontext** (siehe unten) | Welche übrigen Karten im Kampf auf der Hand bleiben, welche in den Recycler gehen |
| `mull` / `mullX` | **„Wann Mulligans durchführen?“** (`mulligan.js`): Platzierungsgüte nach der Entscheidung je Kontext-Eimer und Arm (`skip` / `weak` / `more`); `mullX` zählt nur erkundete (zufällig gewählte) Entscheidungen | Ob und wie viel der Bot mit Leadership, Horn in a Bottle, Staff of the Teleporter, Crescent Moon zurückmischt (siehe unten) |
| `personas` | Population von Gewichtsvektoren (Aggression, Zielwahl, Fokus auf den Führenden, Effekt-/Zauber-Neigung …); Liga mit Selektion, Kreuzung, Mutation | Spielstil je CPU-Sitz (beim Kampfstart nach Fitness gezogen) |

```bash
node scripts/skilltest-train.js --games 500 --seats 2-8      # Lernlauf, speichert das Profil
node scripts/skilltest-train.js --evaluate 80 --seats 4      # Vergleich: gelernt gegen Standard-Bots ohne Profil
PP_ST_TRAIN_BG=1 node server.js                              # passives Lernen im Hintergrund (Kindprozess, niedrige Priorität)
PP_ST_TRAIN_BG=0.1 node server.js                            # … mit 10 % Rechenanteil
```

Der Hintergrundprozess (`learn/background.js`) spielt unablässig CPU-Partien mit 2–8 Sitzen, ruht zwischen den Partien
(Rechenanteil einstellbar) und schreibt das Profil fort; der Server liest es alle ~30 s nach. Ohne Profil spielen die Bots
mit den Standard-Gewichten und der reinen Heuristik.

### Lernlauf vom 8.10.

Frischer Lauf mit dem Stand nach dem Merge von PR #436 (11 705 Partien): Ergebnisse, Messungen und die neue Top-Liste in `docs/skilltest-night-2/` und `docs/skilltest-top-cards.md`.

### Ziehen ist immer etwas wert

Eine gezogene Karte verändert Helden, Creatures und Gold nicht — für das Lernen (`playValue` = Stellungsgewinn nach dem Ausspielen) und den Lookahead
sähen Draw-Karten sonst wertlos aus. Darum zählt jede **gezogene Karte** als Stellungsgewinn (`policy.sideValue`, Grundwert `drawValue` = 20 Punkte, per
`PP_ST_DRAW_VALUE` für Messreihen verstellbar; eine durchschnittliche Kartenwirkung bringt 30–40, eine gezogene Karte braucht noch eine Aktion).
`engine-ext.installDraws` führt den Zähler `ps._stDrawn`; ein Mulligan ersetzt nur (das Nachziehen derselben Anzahl wird gegengerechnet), ein Bonus-Zug
bleibt Gewinn. Vor den ersten Beobachtungen gilt für Draw-Karten (Haste, Supply Chain, Wheels, Elixir of Quickness, Heart of the Mountain, Alchemy …)
eine Vorgabe in der Aktionsreihenfolge (`policy.drawPrior`), die nach 5 Beobachtungen zur Hälfte verblasst.

### Mulligan der Bots — der Kanal „Wann Mulligans durchführen?“ (`mulligan.js`)

Leadership, Horn in a Bottle, Staff of the Teleporter und Crescent Moon fragen mit einem `handPick`-Prompt, welche Handkarten zurück ins Deck gemischt
werden (im Modus kommen ebenso viele **zufällige neue** Karten nach). Die Standard-CPU lehnt jede abbrechbare Frage ab — diese Karten lagen bei Bots tot.

- **Welche Karten?** Dieselbe Bewertung wie beim Behalten/Recyceln im Aufbau (`keepmodel`: Modell + Vorgabe + gelernte Nutzung, Kontext = restliche Hand
  und Brett). Was dort „recyceln“ hieße, ist **schwach**; Heroes in der Hand bleiben.
- **Ob und wie viel?** Drei Arme: `skip` (nichts tun, die Karte bleibt liegen), `weak` (alle schwachen Karten zurück; ohne schwache Karte zieht ein Bonus-Zug —
  Horn +1, Leadership Lv3 +1 — trotzdem), `more` (zusätzlich Grenzfälle `d < 0,08`). Kontext („Eimer“): Zahl der schwachen Karten (0 … 3+), Bonus-Zug,
  Phase der Partie (Round ≤ 2 / ≤ 5 / später). Gelernt wird aus dem Ergebnis des Sitzes, **nur aus erkundeten Entscheidungen** (im Training spielt der Bot
  mit Wahrscheinlichkeit 0,5 einen zufälligen Arm): nur dort ist die Armwahl unabhängig von der Stärke der Hand. Ohne genug Daten (30 je Arm im feinen,
  15 im groben Eimer) oder ohne klaren Vorsprung vor der Vorgabe (0,04 Platzierungsgüte) gilt die Vorgabe `weak`, sonst `skip` — die Beobachtungen einer
  Partie hängen zusammen und der Unterschied der Arme ist meist winzig, so wird kein Rauschen gelernt.
- **Trainings-Gerüst:** Damit der Kanal Daten bekommt, erhält im Training jeder dritte Sitz (`MULL_BOOST` 0,3) Horn in a Bottle oder Staff of the Teleporter
  zusätzlich auf die Kampfhand (nach dem Aufbau; nie im Live-Spiel).
- **Messung:** `node scripts/skilltest-tune.js --a '{"persona":true,"forceHand":["Horn in a Bottle"],"mullMode":"skip"}' --b '[{…"mullMode":"weak"},{…"mullMode":"more"}]'`
  (gepaart, siehe `learn/tune.js`: `forceHand`, `forceAbility`, `mullMode` gelten für den Fokus-Sitz).

### Freie Ability-Effekte der Bots

Abilities mit `freeActivation` (Leadership, Alchemy, Charme, Diplomacy, Infiltration, Inventing, Necromancy, Occultism, Pillage, Premonition, Singing,
Terror, Thieving, Trade, Training, Trapping) kosten keine Aktion und gelten einmal je Name und Round. Bots haben sie bis zum 8.10. **nie** benutzt
(`doActivateFreeAbility` fehlte in `skillTestHandlers`/Host) — Helden mit solchen Start-Abilities spielten ohne ihren Effekt. `policy.freeAbilityActions` führt sie
jetzt aus (stärkste Kopie je Name, Zieh-Sperre, `cpuMeta.shouldActivateNow`); gelernt wird unter `freeAbility:<Name>`.

### Auswahl-Abfragen bestimmter Zauber (`prompts.js`)

Zauber, deren Wirkung eine Auswahl verlangt, scheiterten bei Bots nach dem Ausspielen, weil die Abfrage (abbrechbar) abgelehnt wurde: Spontaneous Reappearance
(0 von 161 Versuchen), Spreading Rumor (0/126), Gate to the Armory (0/118), Accusation (1/67), Raise the Minions! (0/72). `prompts.js` beantwortet genau diese
Abfragen (Kartenname ansagen: der bei den Gegnern häufigste; Karte/Karten aus Ablage oder Deck wählen: nach gelerntem Wert). Danach: 13/17, 10/11, 9/69, 8/8, 4/61.
Der Rest der Fehlversuche sind echte unerfüllte Bedingungen („Delete 1 … aus deiner Ablage“, „nur von einem betäubten Helden“ …).

### Nutzbarkeit behaltener Karten

Beim Behalten/Recyceln zählt, ob die Karte im Kampf überhaupt zum Zug kommt:
- **Nutzbarkeit mit dem Brett** (`keepmodel.usability`, Spielregel): Zauber/Angriffe/Creatures sind `now` (ein Held erreicht die Stufe), `hand` (erst mit
  Abilities, die noch auf der Hand liegen) oder `no` (kein Held erreicht sie, die Karte bliebe tot); Abilities `now`, wenn ein Held sie aufnehmen kann.
  Die Klasse geht als Merkmal (`use:…`) ins Modell und als Vorgabe in den Wert (`no` stark negativ, `hand` schwach positiv). Gegen die Engine
  (`heroMeetsLevelReq`) geprüft: jede als `now` eingestufte Karte war dort wirkbar.
- **Tatsächliche Nutzung** (`train.learnUsage`): je behaltener Karte wird gezählt, ob sie im Kampf mindestens einmal gespielt wurde — je Karte
  (`profile.usage`) und je Typ/Klasse (`profile.usageClass`: `Spell:now`, `Spell:no`, `*:Spell` …). `keepmodel.usagePrior` macht daraus eine Vorgabe
  (Nutzungsrate der Karte gegen den Durchschnitt ihres Typs): was behalten wird und nie gespielt wird, ist nichts wert. Die Kartenlisten zeigen die
  Spalte „Genutzt" und eine Zusammenfassung nach Klasse.

### Behalten oder recyceln (`learn/keepmodel.js`)

Nach dem Aufbau entscheidet der Bot je übriger Karte: auf der Hand behalten (Zauber, Reaktion, Trank, Ability …) oder recyceln (+4 Gold,
früherer Spielbeginn, jede 2. Karte wirft eine neue aus)? Eine Karte lässt sich dabei **nicht im Vakuum** bewerten, deshalb ist der Kontext
die gesamte restliche Hand UND das Brett, und nach jedem Wegwurf wird neu bewertet (fehlt der Partner, sinkt der Wert der anderen).

Lineares Modell über dünn besetzte Merkmale; Ergebnis = Platzierungsgüte des Sitzes (+1 … −1):
`b + Σ u[f] + a · Σ w[f]` mit a = +1 (behalten) / −1 (recycelt). `u` ist die Basis („wie gut ist ein Aufbau mit diesem Kontext ohnehin"),
`w` der Kontrast; die Entscheidung liest `2 · Σ w` (Vorteil des Behaltens). Die Basis fängt die Stärke der Hand ab — starke Hände behalten
mehr und gewinnen öfter, das darf nicht dem Behalten zugeschrieben werden.

| Merkmal | Was es erfasst |
| --- | --- |
| `c:<Karte>`, `ty:<Typ>`, `a:<Archetyp>` | Karte, Kartentyp/Untertyp, Archetyp |
| `fit:…:<Lücke>` | Anforderung: Wie weit liegt die verlangte Schulstufe über den Abilities der Helden auf dem Brett (0 = sofort spielbar)? Je Typ und je Karte |
| `fitH:…:<Lücke>` | dasselbe, nachdem Abilities der gesuchten Schule **auf der Hand** die Lücke geschlossen hätten |
| `ab:<Stufe>:<Nachfrage>` | Ability: Stufe schon auf dem Brett, Zahl der Karten in Hand/Brett, die diese Schule brauchen |
| `syn:<Archetyp>:<Anzahl>` | Synergie: wie viele andere Karten desselben Archetyps liegen auf Hand/Brett |
| `p:<Karte>\|<Mitspieler>`, `pa:<Karte>\|<Archetyp>` | Paare: Karte zusammen mit einer bestimmten Karte bzw. einem Archetyp auf Hand oder Brett |
| `rc:<Stand>`, `free:<Typ>:<Zonen>` | Tempo/Gold: schon recycelte Karten, freie Support-Zonen |

Ohne Beobachtungen gilt eine feste Vorgabe (im Kampf brauchbar → behalten), die mit den Beobachtungen der Karte verschwindet. Im Training wird
mit Wahrscheinlichkeit `0,25 · explore` gegen die Entscheidung gespielt, damit beide Arme in vergleichbaren Lagen Daten bekommen.
Persona-Gewichte: `keepCards` (Obergrenze der Handkarten), `keepBias` (Schwelle). Paare brauchen viele Partien (Tausende, mit 1300 Karten sind
Paarkombinationen dünn besetzt); die Merkmale Typ × Stufen-Lücke, Synergie und Recycler-Stand lernen schnell und tragen über Karten hinweg.
Sichtbar: Kartenliste (Spalte „Keep − recycle"), Paar- und Kontext-Tabellen auf `/skilltest-learning.html`, `node scripts/skilltest-report.js`.

## Neue Karten aufnehmen / sperren

- **Pool:** Es kommen nur Karten vor, die ein **Bild in `./cards`** haben (dieselbe Zuordnung wie im Deckbuilder, `card-images.js`;
  gilt für Pool, Recycler-Auswurf und CPU-Personas; ohne Kartenordner/Bilder filtert es nichts). Dazu das
  Feld `skilltestLegal` in `data/cards.json` (`true`/`false` je Karte). Neue Karten müssen es haben
  (`node scripts/set-skilltest-legal.js` ergänzt fehlende mit dem Standardwert; überschreibt nie).
  Vorerst gesperrte Karten und Gründe: `docs/skilltest-illegal-cards.md` (`scripts/curate-skilltest-legal.js`).
  Zuletzt dazugekommen: **Tri Ad / Tri Fecta**, **Idej Projection** (kommt nur noch über die Lords) und alle **reinen Zieh-/Such-Karten**
  (Wheels, Haste, Magnetic Potion, Elixir of Quickness, …). Erkennung: Zieh-/Such-Sperren der Engine (`blockedByHandLock`, `blockedByDrawLock`,
  `blockedBySearchLock`, Zieh-Block-Helfer) plus Handprüfung des Kartentextes — Karten mit zusätzlichem Effekt und reine **Ablage-Rückholer**
  (Shooting Star, Boomerang, …) bleiben im Pool, weil es im Modus eine Ablage gibt. `scripts/skilltest-e2e/idej.test.js` prüft die Liste.
  Nach dem Nachttraining (Nutzung 0 % bei Dutzenden bis Hunderten behaltener Exemplare, dann Ursache geprüft) kamen **26 Karten** dazu, deren
  Wirkung im Modus nicht eintreten kann: Coolness-Stack-Karten (der Stack bleibt immer leer: String of Fine, Glorious Rebirth, Coolness Overcharge,
  Modnir, Swellpnir, Ragnarock), Deckbau-Regelkarten (Secret Spices, Secret Spice Jar, The Sacred Blade), Deck-Karten (Surprise Party, Overcharge,
  Ladder to the Sky, …) und Karten für Ascended Heroes (Audience with a hostile King, Open Invitation). Karten, die bei passender Lage funktionieren
  (Spontaneous Reappearance, Kirin Firebreath, Tengu Windstorm, Liberation, Shapeshift …), bleiben — ihre geringe Nutzung kommt aus den Bot-Prioritäten.
  Ebenfalls gesperrt: **Bill, Hel, Sid und Kassaran** (Spielbeginn-Effekte vor dem Ziehen der Starthand brauchen ein Deck).
- **Kartenskripte** dürfen nie `pi === 0 ? 1 : 0` o. Ä. schreiben. Stattdessen:
  `engine.opponentOf(pi)` (EIN Gegner: Fokus bzw. nächster lebender Sitz), `engine.opponentsOf(pi)` (alle Gegner),
  `engine.playerCount()`. Im Normalspiel liefern sie bit-identisch das alte Verhalten. `node scripts/check-n-player.js`
  prüft das; offene Altlasten: `docs/n-player-todo.md`.
- **„Each opponent"-Karten** (Flächenschaden o. Ä.) sind eine Entscheidung je Karte: `opponentsOf` verwenden.
  Einzelziel-Karten dürfen alle gegnerischen Ziele treffen (die Zielwahl läuft über alle Gegner); Flächenkarten wählen
  EINEN Gegenspieler (`_stChooseAoePlayer`, wie bei Divine Gift of Fire).
- **Karten, die „den Gegner" als Ganzes meinen** (Chain Lightning, Cardinal Beast Qinglong, die Bottled-Kette) fragen den Spieler bei
  mehreren lebenden Gegnern per Spielerwahl, wen er treffen will: `engine._stChooseOpponent(pi, titel)` (Bots: Policy). Der Gewählte
  wird zum Fokus des Wirkers, `opponentOf` meint danach ihn. Weitere Karten dieser Art: denselben Aufruf vor `opponentOf` setzen
  (`if (gs.skillTest && engine._stChooseOpponent) await …`).

## Per Round statt per Turn

Alles, was im Normalspiel „pro Turn" gilt, gilt hier **pro Round und Held** (`rounds.js`: `ecoEnter`/`ecoLeave`, `st.heroEco`):
Hauptaktion und Zusatzaktionen zählen je Held, nicht je Spieler; die Action Phase eines Sitzes beginnt (Phasenbeginn-Effekte,
Reaktionsfenster, Vergabe von Zusatzaktionen) nur bei seinem ersten Zug der Round und endet mit der Round (`endRound`,
Phasenende-Effekte → Zusatzaktions-Gewährungen verfallen). `advanceToPhase` ist im Modus ein No-op (außer zur End Phase).

### Fristen: `gs.turn` zählt 2 je Round

Kartentexte rechnen in Spielerzügen („bis zum Ende des nächsten gegnerischen Zuges" = `gs.turn + 2`, „bis zum Ende dieses Zuges" = `+1`).
Damit solche Fristen im Modus **genau den Rest der laufenden Round** treffen (nicht eine Round länger), steht `gs.turn` in Round R auf
`2R − 1` (`rounds.js` `roundTurn`; Round 1 → 1, 2 → 3, …) — eine Round ist so ein Spielerzug-Paar des Normalspiels. Folge:
`+1` und `+2` laufen zu Beginn der nächsten Round ab, `+3`/`+4` eine Round später. Ungerade Fristen liegen zwischen zwei Round-Werten; die
Ablauf-Sweeps (`engine._ablaufFaellig`) prüfen im Modus deshalb `<=` statt `===` (Normalspiel unverändert). Anzeigen nennen die Round
(`gameState.skillTest.round`), nicht `gs.turn`. Test: `scripts/skilltest-e2e/duration.test.js` (Pink Sky über die Rundengrenze, +1/+2/+3).

### CPU-Sitze: anonym bis zum Kampfbeginn

In Lobby und Vorbereitung heißen CPU-Sitze „CPU n" und erscheinen als schwarze Pixelart-Kachel mit Fragezeichen (`StUnknownTile`).
Erst `battle.js nameBots` gibt ihnen beim Kampfstart Namen und Aussehen ihres mittleren Heroes (nur der reine Name, `hero-name.js`;
das Portrait zeigt die Oberfläche als Bildausschnitt des mittleren Heroes). Test: `hero-name.test.js` (Server-/Client-Kurznamen gleich).

### Hand-Garantien und Recycler (`hand-rules.js`)

- **Heldenpartner:** Nennt ein Hero einen Spell im Text (Luna → Firewall, Sol Rym → Chain Lightning, Damus → Armageddon, Natas → The Master's Plan) oder steht er in
  `CONFIG.HERO_PARTNERS` (Mary → Cute Phoenix, Baaliel → Horned Demon, Damus → Ifrit, Arthor → The White Eye), liegt der Partner garantiert mit ihm auf der Hand.
  `CONFIG.HERO_RANDOM_PARTNERS`: Tsu'Ki bringt 1–3 verschiedene Lunatic-Ausrüstungen mit. Partner sind im Pool **reserviert** (`CardPool.reserved`): andere Spieler
  und der Recycler bekommen sie nie.
- **Nie mehr als 18 Karten:** Reicht der Platz nicht, fliegen zufällige andere Karten (keine Heroes, keine garantierten) zurück in den Pool.
- **Spell Schools** (Magic Arts, Decay, Support, Destruction; nicht Summoning): Spells dieser Schulen mit Gesamtlevel 1–5 (zufällig) in der Starthand; hat ein Hero zwei
  verschiedene Schulen, zusätzlich je Schule ein Lv-3-Spell (wirkungsvollster von dreien nach gelerntem Kartenwert). Garantien greifen je Hero/Schule einmal.
- **Recycler:** Spells nur aus Schulen der Board-Heroes (falls möglich); der Inhalt wandert zu Spielbeginn in die eigene Ablage (`recycledCards`, auch für Bots).

### Ziehen und Mulligan (`engine-ext.js installDraws`)

Keine Decks, aber Ziehen funktioniert: vor dem Ziehen erscheinen X **zufällige neue Karten** (aus dem Rest des Pools, `room.skillTest.pool`) im Deck bzw. Potion Deck und
fliegen mit den normalen Animationen zur Hand. Heroes sind ausgeschlossen, das Potion Deck gibt nur Potions, das Deck nie; Spell-School-Abilities nur, wenn der Spieler sie
nicht schon hat. Mulligan: die zurückgemischten Karten fliegen sichtbar zum Deck und mischen; X neue Karten ersetzen sie (die alten gehen in den Pool zurück und können
wiederkommen). Im Lookahead wird der Pool nur gelesen. Reine Draw- und Mulligan-Karten (Alchemy, Wheels, Haste, Leadership, Horn in a Bottle, Staff of the Teleporter …) sind
im Pool; Karten, die suchen (Tutoren), bleiben gesperrt. Tests: `draws.test.js`, `draw-cards.test.js`.

### Dream Lander

Creatures mit `attachableHeroes` (Goff, Clausss, Smugbeth, Vullary, Wolflesia, Stellin, Antonia) starten mit dem Hero angelegt — beim Ausspielen im Kampf und wenn sie schon im
Aufbau stehen (`engine._stAutoAttachHero`). Test: `dream-lander.test.js`. Logan (`logan.test.js`): Auszahlung am Rundenende je Sitz; CPU-Sitze investieren und zahlen aus.

## Karten mit Sonderregeln

| Karte | Regel im Skill Test |
| --- | --- |
| Quetzahuitl, Receiver of Sacrifices | Bleibt auf der Hand und ist **nie** einer der drei Brett-Helden (`HAND_ONLY_HEROES` in `public/skilltest-rules.js`): Er zählt nicht zu den Brett-Helden, `pool.dealHand` teilt ihn nur Händen mit ≥ 4 Heroes zu, Bots recyceln ihn nicht. Fällt dein letzter Held in einem fremden Zug, steigt er herab; **fällt Quetzahuitl, scheidet sein Kontrolleur aus** (das Spiel endet nicht). |
| The Golden Abomination | Zu Spielbeginn (Hook `onSkillTestStart`, vor dem Start-Gold-Tick) **wählt** der Besitzer einen lebenden Gegner (Spielerwahl; Bots: meistes Gold); nur dessen Gold in der Resource Phase wird umgelenkt. |
| Idej Lord Daiyo / Nobunakin / Shoguwana / Todugawin | Beim **Aufstellen** (Hand → Hero-Zone, auch per Tausch) erscheinen **aus dem Nichts** ihre Karten in den drei Support Zones: Daiyo 3× Idej Projection, Nobunakin 2× Projection + 1 Idej Blade, Shoguwana 1× Projection + 2 Blades, Todugawin 3 Blades (Blades zufällig, je Lord verschieden; `IDEJ_PACKAGES` in `public/skilltest-rules.js`). Eine belegte Zone weicht dafür zurück auf die Hand (freie zuerst). Verlässt der Lord das Brett (zurück auf die Hand, ersetzt), **verschwinden** die Karten; beim Hero-Tausch wandern sie mit. Sie lassen sich per **Rechtsklick löschen** (`deleteSpawned`) oder von einer Handkarte **überbauen**, aber weder auf die Hand nehmen, verschieben noch recyceln. Im Zustand der Basis markiert `spawned[hi][slot]` sie (grüner Rahmen + ✦ in der UI); im Kampf sind es gewöhnliche Support-Karten. Die Start-Suche der Lords (`onBeforeHandDraw`) bleibt wirkungslos (kein Deck, keine freie Zone). |
| Cardinal Beast Baihu / Qinglong / Xuanwu / Zhuque | Alle legal, aber je Partie **fehlt ein zufälliges** davon im Pool (`CONFIG.CARDINAL_BEASTS`, `CardPool.banned`; die Vorbereitung zeigt es als `bannedCards`). So sind nie alle vier gleichzeitig im Spiel. |

## Endlosschleifen und Hänger

- **Schrittbudget** (`engine-ext.js` `installRunawayBreaker`): Jede Animationspause einer Aktion zählt; über 6 000 wird die Aktion mit
  `ST_RUNAWAY` beendet. Beim Abbruch erscheint `[ST_RUNAWAY] …` im Log mit Prompt-Zählern und Aufrufkette — daran ist die Karte erkennbar.
- **Opferwahl** (Fund aus dem Nachttraining: Steam Dwarf Dragon Pilot, ≈ 0,02 % der Partien): Die allgemeine Zielwahl wählte für
  „opfere Kreaturen mit zusammen ≥ 300 Max-HP" irgendwelche Kreaturen, und `resolveSacrificeCost` fragte endlos neu. Jetzt wählt die
  Policy (`chooseTribute`) die billigste gültige Teilmenge (Anzahl, Mindest-Max-HP, Mindest-Level, Pflicht-Hero), und die Engine wertet
  drei ungültige CPU-Antworten im Skill Test als Abbruch (Menschen werden unbegrenzt neu gefragt). Test: `sacrifice.test.js`.
- Freiwillige „erneut"-Prompts (Skeleton Reaper …) brechen Bots nach `MAX_PROMPT_REPEATS` ab (`policy.chooseTargets`).
- **Skeleton Reaper über Spirit of the Forbidden Grimoire** (Fund aus dem Nachttraining, ≈ 0,5 % der Partien nach Einführung der Kreatur-Effekte
  im Bot): Der Spirit führt den geliehenen Effekt *nicht abbrechbar* aus (`_forceNonCancellable`), der Wiederholungsschutz der Policy greift dort
  also nicht. Unter **Dark Ocean** wird jeder Reaper-Schlag storniert; weil `counters.currentHp` erst beim ersten Schaden gesetzt wird
  (frische Kreaturen haben nur `maxHp`), hielt der Reaper die unversehrte Kreatur für „besiegt" und feuerte endlos weiter. Behoben im Skript
  (`hpOf` statt `currentHp || 0`, Abbruch bei stornierter Wirkung). Außerdem prüfte `isDarkOceanActive` nur die Area-Zonen von Sitz 0 und 1 —
  jetzt alle Sitze. Test: `reaper.test.js`.
- **Garius, the Great Reformer** (Fund aus dem Nachttraining, ≈ 0,5 % der Partien): Die Galerie der Deck-Kreaturen ließ Artifact-Creatures
  (Debt-O-Tron-Modelle, Pollution Spewer) zu, die anschließende Prüfung (`isPileCreature`) lehnte sie ab, und die Engine kann sie auf diesem Weg
  nicht setzen — der Effekt sprang zurück zur Opferwahl, der Bot wählte dasselbe wieder. Behoben im Skript (Galerie nutzt dieselbe Eignung); zusätzlich
  zählt der Prompt-Wiederholungsschutz der Policy jetzt *vor* der Antwort einer Karten-`cpuResponse` (vorher umging sie ihn). Test: `garius.test.js`.

## Reaktionen der Bots

Die Standard-CPU der Engine (`_cpu.js`) ist für zwei Spieler gebaut und im Modus nicht installiert; die Engine-Vorgabe lehnt jede
freiwillige Frage ab. `bot.shapeReaction` (eingehängt von `engine-ext.installReactions`) beantwortet deshalb Reaktions-, Surprise-
und „you may"-Fragen selbst. Kanäle in `policy.js`:

1. **Karten-Heuristik** (Veto): `cpuResponse`/`cpuMeta.reactionHeuristic` der Karte, keine Negation eigener Karten, keine Kosten-Confirms
   (`cpuMeta.confirmCostsResource`). Ob eine Reaktion überhaupt möglich ist, prüft die Engine (Bedingung, Kosten, Wirker, Sperren).
2. **Persona** `reactEager` (0 … 2, per Liga entwickelt), dazu `potion`, `abilityPlay`, `abilityUse`.
3. **Gelernt**: je Entscheidung wird die Stellungsänderung des Sitzes bis zum Ende der laufenden Aktion festgehalten
   (`react-fire:<Karte>` / `react-hold:<Karte>` im Lernprotokoll → `playValue`); haben beide Arme genug Beobachtungen, entscheidet der Vergleich.
4. **Neugier**: ohne Daten wird gelegentlich bewusst gehalten, damit der Vergleich überhaupt entsteht.

## Lern-Monitoring

- **Benchmark** (`learn/train.js` `benchmark`, alle `benchEvery` Partien): Einzelspiele trainierte gegen untrainierte CPUs am selben Tisch,
  Ergebnisse in `<profil>.bench.jsonl`; `GET /api/skilltest/benchmark`.
- **Karten-Rangliste** (`learn/ranking.js`): nach „Wert ausgeteilt" sortierte Liste ALLER im Training gesehenen Karten, wird bei jedem
  Speichern neu geschrieben; `GET /api/skilltest/ranking`, Seite `/skilltest-learning.html`, `node scripts/skilltest-report.js`.

## Zusätzliche Ereignisse

Server → Client: `st_prep_*` (Vorbereitung), `st_game_over { winnerIdx, reason, placements, sc, rounds }`;
`gameState.skillTest` (`publicState`): Round, Reihenfolge, Startspieler, Zugsitz, erschöpfte Helden/Creatures, Ausgeschiedene,
Bot-Sitze, Timer, **`watch`** ({ n, actor, target }: „hierhin schauen" — Zugbeginn und Zielwahl; der Client schaltet das Hauptfeld auf das Brett
des Ziels bzw. des Handelnden, BEVOR die Karte wirkt; Bots warten dafür kurz, `PP_ST_WATCH_MS`), **`acting`** (wer gerade handelt: leuchtet auf den
Brettern, danach ergraut er) und `exhaustedSlots` (erschöpfte Creatures). Client → Server: `st_attack`, `st_pass_round`, (Held-/Creature-Effekte laufen
über die normalen Handler). Der Basisangriff spielt serverseitig eine virtuelle „Attack"-Karte aus der Hand; die Clients bekommen sie nie zu sehen
(`server.js` `stSichtHand`).

## Bekannte Grenzen (Stand jetzt)

- **Brett:** ein Gegner steht groß im Hauptfeld (angeklickt/angepinnt oder der Spieler am Zug), alle übrigen als Mini-Kacheln
  (`.st-mini`, anklickbar über den Kopf bzw. die Zeilen des Turn-Panels). Ziele in Mini-Kacheln sind direkt anklickbar;
  Drag & Drop (Artifacts auf gegnerische Helden, Kreuz-Seiten-Karten) funktioniert nur auf den Gegner im Hauptfeld.
- **Gesperrte Karten** (`docs/skilltest-illegal-cards.md`): Sofortsiege, Doom-Clock-Familie, Karten mit „beide Ablagen" und
  alle Future-Tech-Karten (sie brauchen eine gefüllte Ablage). Freigegeben mit Sonderregel: siehe „Karten mit Sonderregeln".
- **Bots** trinken Tränke, legen Hand-Abilities an Helden (je Held einmal pro Round), aktivieren Ability-Effekte und lösen
  Reaktionen/Surprises sowie freiwillige „you may"-Karteneffekte aus (siehe „Reaktionen der Bots"). Offen: Welche Karten der
  Aufbau behält oder recycelt, wird gelernt (mit Kontext der restlichen Hand, siehe „Behalten oder recyceln"); gelernt wird erst im
  Training — ein älteres Profil kennt Tränke, Reaktionen und Abilities auf der Hand noch nicht.
- **Reaktionsfenster**: Die Kette (`_runReactionWindow`) fragt im Modus alle noch nicht ausgeschiedenen Sitze der Reihe nach
  (`_reactionCheckOrder`, zuletzt der aktive Sitz); Surprise-Fenster ebenso. Einzelne Hand-Fenster hängen am Besitzer des Ziels;
  einzelne Karten fragen noch „den Gegner" (Fokus bzw. nächster lebender Sitz).
- **Reaktionen und Zug des Helden**: Eine Reaktion ist unabhängig davon möglich, ob der Held in dieser Round noch einen Zug hat
  (die Engine prüft nur Status, Level, Kosten und Kartenbedingungen) — sonst gelten die normalen Regeln und Einschränkungen.
- **Rollouts/MCTS** der Normalspiel-CPU sind im Modus abgeschaltet (`mctsPickFromOptions` gibt die erste Option zurück).

## Regressionsschutz & Tests

- `scripts/regress/compare.sh` vergleicht geseedete 2-Spieler-Normalspiele mit der eingecheckten Baseline —
  **muss nach jeder Engine-Änderung „unverändert" melden**.
- `scripts/skilltest-e2e/usability.test.js` (headless): Start-Abilities Stufe 3, Ability-Regeln, Nutzbarkeit/Nutzung beim Behalten.
- `scripts/skilltest-e2e/sacrifice.test.js` (headless): Opferwahl der CPU, keine ST_RUNAWAY-Schleife; `start-hooks.test.js`: Spielbeginn-Abfragen (Kassaran).
- `scripts/skilltest-e2e/idej.test.js` (headless): Idej-Spawn-Regeln, Pool-Sperren, Kampfstart mit erschienenen Karten.
- `scripts/skilltest-e2e/*.test.js`: Lobby, Vorbereitung, Kampf, Sitzwechsel (CPU-Übernahme/Aufgeben), Zielwahl über Sitze (per Socket,
  brauchen `socket.io-client`, siehe `lib.js`) und `learn.test.js` (Lernsystem, headless); `ui-*.shot.js` (Playwright, Screenshots).
- Headless: `node -e "require('./skilltest/sim').runGame({seats:4}).then(console.log)"` (mit `PP_ST_SIM=1`, siehe `sim-bridge.js`).

## Testschalter

`PP_ST_BOT_DELAY_MS` (Denkpause der Bots, ms), `PP_ST_WATCH_MS` (Pause des Bots, nachdem die Anzeige auf sein Ziel gewechselt hat, Standard 900 ms), `PP_ST_SIM=1` (server.js exportiert nur die Handler, startet nicht), `PP_ST_TEST_HAND="Name1|Name2"` (legt dem ersten Menschen diese Karten zusätzlich auf die Hand — nur für UI-/E2E-Tests).
