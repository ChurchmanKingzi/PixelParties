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
   Abilities steigen automatisch auf Stufe 3. Der Recycler wirft jede 2. eingeworfene Karte als zufällige neue Karte
   aus (Helden nur, solange das Brett voll ist). **Ready!** schließt die Vorbereitung ab; Timer sind einstellbar/abschaltbar.
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

## Bots und Lernsystem

CPU-Sitze bekommen eine zufällige Helden-Persona (nur Name/Avatar). Gespielt wird mit `policy.js`: Basisangriff,
Hero-/Creature-Effekte, Handzauber, Beschwörungen (verbrauchen den Zug) sowie Artifacts/Surprises (frei). Im Aufbau
(`policy.prepareBase`, `autoprep.buildWithRecycling`) wählt der Bot Heroes nach Wert, verteilt Abilities/Support nach
gelernter Passung und wirft alles Unbrauchbare in den Recycler (Gold, früherer Spielbeginn).

Gelernt wird per **Selbstspiel** (headless, 2–8 Sitze gemischt, `learn/train.js`) in **vier Kanälen**, alle in einer Datei
(`data/skilltest-profile.json`, per `PP_ST_PROFILE` umlenkbar, atomar gespeichert, `version` zählt hoch):

| Kanal | Inhalt | Wird genutzt für |
| --- | --- | --- |
| `playValue` | mittlerer Zuwachs der Stellungsbewertung nach dem Ausspielen einer Karte/Aktion | Reihenfolge der Aktionen, Zauber-Timing; mit UCB-Neugier für selten Gespieltes |
| `cardValue` / `pairValue` | mittlere Platzierungsgüte von Basen mit dieser Karte bzw. diesem Paar (Held+Ability/Creature, Ability+Creature, Held+Held) | Heldenwahl, Ability-/Support-Verteilung, was recycelt wird |
| `keepModel` | Behalten oder recyceln, **mit der restlichen Hand und dem Brett als Kontext** (siehe unten) | Welche übrigen Karten im Kampf auf der Hand bleiben, welche in den Recycler gehen |
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

- **Pool:** Feld `skilltestLegal` in `data/cards.json` (`true`/`false` je Karte). Neue Karten müssen es haben
  (`node scripts/set-skilltest-legal.js` ergänzt fehlende mit dem Standardwert; überschreibt nie).
  Vorerst gesperrte Karten und Gründe: `docs/skilltest-illegal-cards.md` (`scripts/curate-skilltest-legal.js`).
- **Kartenskripte** dürfen nie `pi === 0 ? 1 : 0` o. Ä. schreiben. Stattdessen:
  `engine.opponentOf(pi)` (EIN Gegner: Fokus bzw. nächster lebender Sitz), `engine.opponentsOf(pi)` (alle Gegner),
  `engine.playerCount()`. Im Normalspiel liefern sie bit-identisch das alte Verhalten. `node scripts/check-n-player.js`
  prüft das; offene Altlasten: `docs/n-player-todo.md`.
- **„Each opponent"-Karten** (Flächenschaden o. Ä.) sind eine Entscheidung je Karte: `opponentsOf` verwenden.
  Einzelziel-Karten dürfen alle gegnerischen Ziele treffen (die Zielwahl läuft über alle Gegner); Flächenkarten wählen
  EINEN Gegenspieler (`_stChooseAoePlayer`, wie bei Divine Gift of Fire).

## Per Round statt per Turn

Alles, was im Normalspiel „pro Turn" gilt, gilt hier **pro Round und Held** (`rounds.js`: `ecoEnter`/`ecoLeave`, `st.heroEco`):
Hauptaktion und Zusatzaktionen zählen je Held, nicht je Spieler; die Action Phase eines Sitzes beginnt (Phasenbeginn-Effekte,
Reaktionsfenster, Vergabe von Zusatzaktionen) nur bei seinem ersten Zug der Round und endet mit der Round (`endRound`,
Phasenende-Effekte → Zusatzaktions-Gewährungen verfallen). `advanceToPhase` ist im Modus ein No-op (außer zur End Phase).

## Karten mit Sonderregeln

| Karte | Regel im Skill Test |
| --- | --- |
| Quetzahuitl, Receiver of Sacrifices | Bleibt auf der Hand und ist **nie** einer der drei Brett-Helden (`HAND_ONLY_HEROES` in `public/skilltest-rules.js`): Er zählt nicht zu den Brett-Helden, `pool.dealHand` teilt ihn nur Händen mit ≥ 4 Heroes zu, Bots recyceln ihn nicht. Fällt dein letzter Held in einem fremden Zug, steigt er herab; **fällt Quetzahuitl, scheidet sein Kontrolleur aus** (das Spiel endet nicht). |
| The Golden Abomination | Zu Spielbeginn (Hook `onSkillTestStart`, vor dem Start-Gold-Tick) **wählt** der Besitzer einen lebenden Gegner (Spielerwahl; Bots: meistes Gold); nur dessen Gold in der Resource Phase wird umgelenkt. |
| Cardinal Beast Baihu / Qinglong / Xuanwu / Zhuque | Alle legal, aber je Partie **fehlt ein zufälliges** davon im Pool (`CONFIG.CARDINAL_BEASTS`, `CardPool.banned`; die Vorbereitung zeigt es als `bannedCards`). So sind nie alle vier gleichzeitig im Spiel. |

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
Bot-Sitze, Timer. Client → Server: `st_attack`, `st_pass_round`, (Held-/Creature-Effekte laufen über die normalen Handler).

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
- `scripts/skilltest-e2e/*.test.js`: Lobby, Vorbereitung, Kampf, Sitzwechsel (CPU-Übernahme/Aufgeben), Zielwahl über Sitze (per Socket,
  brauchen `socket.io-client`, siehe `lib.js`) und `learn.test.js` (Lernsystem, headless); `ui-*.shot.js` (Playwright, Screenshots).
- Headless: `node -e "require('./skilltest/sim').runGame({seats:4}).then(console.log)"` (mit `PP_ST_SIM=1`, siehe `sim-bridge.js`).

## Testschalter

`PP_ST_BOT_DELAY_MS` (Denkpause der Bots, ms), `PP_ST_SIM=1` (server.js exportiert nur die Handler, startet nicht).
