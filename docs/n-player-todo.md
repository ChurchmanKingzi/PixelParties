# N-Spieler-Umbau — Stellen mit verbleibender Zwei-Spieler-Annahme

> **Erzeugt** von `node scripts/n-player-todo.js` — nicht von Hand pflegen. Stand: Schritt 1 des Skill-Test-Umbaus
> (zentrale Gegner-Helfer `opponentOf` / `opponentsOf` / `playerCount`, Codemod `scripts/codemod-opponent.js`).
> Das Normalspiel ist dabei bit-identisch geblieben (`scripts/regress/compare.sh`).
> Zeilennummern gelten für den Stand beim Erzeugen — nach einem Merge einfach neu laufen lassen.

## 0. Fachliche Hinweise zu den schon umgestellten Stellen

- **Ein Gegner statt „der Gegner“.** `opponentOf(pi)` liefert genau EINEN Spieler (Skill Test: Fokus `gs.stFocus[pi]`, sonst der nächste lebende). Karten mit Kartentext „each opponent“ / „all opponents“ meinten bisher dasselbe wie „the opponent“ und müssen im Skill Test auf `opponentsOf(pi)` (Liste) umgestellt werden — das ist eine Entscheidung je Karte, keine mechanische.
- **`cards/effects/_engine.js` `aoeTargetPlayers`**: `side: 'enemy'` (Default) liefert `[this.opponentOf(pi)]`, `side: 'both'` alle Spieler. Für Flächenschaden im Skill Test vermutlich `this.opponentsOf(pi)` — Entscheidung.
- **`cards/effects/future-tech-control-device.js`**: `besitzer(engine, inst)` leitet den Besitzer als „Gegenseite des Wirts“ ab (`engine.opponentOf(inst.owner)`). Mit mehreren Gegnern ist das nicht eindeutig — dort `originalOwner`/den Kontrolleur der Karte speichern.
- **server.js Relais an „den Gegner“** (`targeting_update`, `ping_card`, `pending_placement`, `pending_placement_clear`, `blind_pick_update`, `broadcastHandToBoard`) senden jetzt an `opponentOfGs(gs, pi)`; im Skill Test sollen sie vermutlich an ALLE Gegner (`opponentsOfGs`) gehen.
- **`1 - oppX`** (kit-the-shark-researcher, pusher, spreading-rumor, tryse-the-shadow-slayer) leitete „den Wirker“ aus dem Gegner ab; steht jetzt direkt als `pi`.
- **Schleifen `i < engine.playerCount()`** laufen über ALLE Spieler am Tisch, auch über ausgeschiedene (alle Helden tot) — wie bisher über beide.
- **Listen `[0, 1]`** sind jetzt `<gs>.players.map((_, i) => i)` (alle Spieler inkl. des Wirkers, aufsteigend) — Reihenfolge und Inhalt im Normalspiel unverändert.
- **`opponentOfGs(gs, pi)` ist null-sicher** (fehlender `gs` → Normalspiel-Verhalten); der Skill-Test-Zweig greift nur bei gesetztem `gs.skillTest`.

## 1. Bewusst belassene Idiome (brauchen eine Entscheidung)

Der Codemod erkennt diese Stellen, stellt sie aber nicht um — der Mehrspielermodus braucht dort eine fachliche Regel,
keine mechanische Ersetzung (Sieger/Verlierer, Aufgeben, Rematch, Side-Deck, Puzzle, CPU-Kampf, Lobby/Sitze).

### `cards/effects/_doom-clock-shared.js`

- Zeile 106 (`winnerIdx = byPi === 0 ? 1 : 0`) — Sieger/Verlierer-Ableitung (Spielende)

### `cards/effects/_engine.js`

- Zeilen 10843, 47356 (`winnerIdx = playerIdx === 0 ? 1 : 0`, `winnerIdx = pi === 0 ? 1 : 0`) — Sieger/Verlierer-Ableitung (Spielende)
- Zeile 47339 (`loserIdx === 0 ? 1 : 0`) — Sieger/Verlierer-Ableitung (Spielende): im Mehrspielermodus ist „der andere“ kein Verlierer

### `cards/effects/carris-the-time-keeper.js`

- Zeile 75 (`winnerIdx = controller === 0 ? 1 : 0`) — Sieger/Verlierer-Ableitung (Spielende)

### `cards/effects/quetzahuitl-receiver-of-sacrifices.js`

- Zeile 370 (`winnerIdx = pi === 0 ? 1 : 0`) — Sieger/Verlierer-Ableitung (Spielende)

### `cards/effects/the-golden-abomination.js`

- Zeile 47 (`gewinner === 0 ? 1 : 0`) — Sieger/Verlierer-Ableitung (Spielende): im Mehrspielermodus ist „der andere“ kein Verlierer

### `server.js`

- Zeile 4162 (`for (let i = 0; i < 2; i++)`) — startChallengeGame: Herausforderungs-Start (Lobby)
- Zeilen 5948, 6264, 6357, 6400, 15389, 15415, 16658 (`winnerIdx === 0 ? 1 : 0`, `room.gameState.result.winnerIdx === 0 ? 1 : 0`, `loserIdx === 0 ? 1 : 0`) — Sieger/Verlierer-Ableitung (Spielende): im Mehrspielermodus ist „der andere“ kein Verlierer
- Zeilen 6013, 6018, 6022, 6037, 6072, 6078 (`for (let i = 0; i < 2; i++)`, `for (let pi = 0; pi < 2; pi++)`, `i === 0 ? 1 : 0`) — endGame: Spielende: Sieger/Verlierer, Elo, Side-Deck-Phase — Mehrspieler-Wertung ist eine Entscheidung
- Zeilen 6242, 6246 (`for (let i = 0; i < 2; i++)`) — advanceToNextGame: Folgepartie im Match (Side-Deck/Lobby)
- Zeile 6348 (`for (let i = 0; i < 2; i++)`) — puzzleEndGame: Puzzle-Ende (2 Spieler, Spieler 0 = Löser)
- Zeilen 6514, 6518 (`for (let i = 0; i < 2; i++)`) — endCpuBattle: CPU-Kampf-Ende (2 Spieler, 0 = Mensch)
- Zeilen 13555, 13564 (`for (let pi = 0; pi < 2; pi++)`, `for(let i=0;i<2;i++)`) — startGameEngine: Spielstart (Starthand ziehen, Mulligan)
- Zeile 13727 (`pi === 0 ? 1 : 0`) — on(auth): Wiederverbinden/Sitz-Logik (Lobby)
- Zeilen 14228, 14254, 14268, 14275 (`for (let i = 0; i < 2; i++)`, `for (let p = 0; p < 2; p++)`) — on(mulligan_decision): Mulligan-Phase (mulliganDecisions = [null, null])
- Zeilen 14296, 15356, 15367 (`winnerIdx = pi === 0 ? 1 : 0`) — Sieger/Verlierer-Ableitung (Spielende)
- Zeile 15202 (`pi === 0 ? 1 : 0`) — on(side_deck_swap): Side-Deck-Phase (Match-Ablauf, zwei Sitze)
- Zeile 15259 (`pi === 0 ? 1 : 0`) — on(side_deck_move): Side-Deck-Phase (Match-Ablauf, zwei Sitze)
- Zeile 15278 (`pi === 0 ? 1 : 0`) — on(side_deck_reset): Side-Deck-Phase (Match-Ablauf, zwei Sitze)
- Zeile 15293 (`pi === 0 ? 1 : 0`) — on(side_deck_done): Side-Deck-Phase (Match-Ablauf, zwei Sitze)
- Zeilen 15387, 15392, 15402 (`for (let i=0;i<2;i++)`, `for(let i=0;i<2;i++)`) — on(request_rematch): Rematch (Lobby/Sitze)
- Zeilen 15754, 15766, 15777, 15834, 16117, 16145, 16168, 16177, 16196 (`for (let pi = 0; pi < 2; pi++)`, `pi === 0 ? 1 : 0`) — createPuzzleGame: Puzzle-Aufbau (Puzzle-Daten sind 2-Spieler-Arrays)
- Zeilen 16572, 16586, 16615, 16625, 16631, 16647 (`for (let i = 0; i < 2; i++)`, `for (let p = 0; p < 2; p++)`) — createCpuBattle: CPU-Kampf-Aufbau (bleibt 2 Spieler)
- Zeile 16710 (`for (let i = 0; i < 2; i++)`) — endCampaignBattle: Kampagnen-Kampf-Ende (2 Spieler)
- Zeile 17023 (`[0, 1]`) — runOneSelfPlayGame: server.js außerhalb des Spielgeschehens (Lobby/Sitze/Verwaltung)
- Zeilen 18115, 18130 (`for (let i = 0; i < 2; i++)`, `[0, 1]`) — on(connection): server.js außerhalb des Spielgeschehens (Lobby/Sitze/Verwaltung)
- Zeilen 18419, 18432, 18448 (`for (let i = 0; i < 2; i++)`) — on(tutorial_modify): Tutorial (Einzelspieler)
- Zeile 18534 (`pi===0?1:0`) — on(disconnect): Verbindungsabbruch/Sitz-Logik (Lobby)
- Zeile 18915 (`[0, 1]`) — runHeadlessTrainingGame: server.js außerhalb des Spielgeschehens (Lobby/Sitze/Verwaltung)

## 2. Zwei-Spieler-Strukturen, die `opponentOf`/`playerCount` nicht ausdrücken

Unveränderte Zwei-Spieler-Annahmen im Zustandsaufbau und in Spezialfällen. Pro Datei: Zeile, Fundstelle, Hinweis.
Nicht angefasst: `_cpu.js`, `_deck-profile.js`, `_train-*.js`, `_demo-recorder.js`, `_decision-log.js`, `_sc-tracking.js` (Zwei-Spieler-Inseln, siehe `scripts/n-player-allow.json`).

Übersicht: Zwei-Spieler-Literale: 31 · Feste Indizes `players[0]` / `players[1]`: 63 · Spielerindex gegen 0/1 verglichen: 186 · `pi === 0 ? a : b` mit Nicht-Zahlen: 13

### Zwei-Spieler-Literale

Pro Spieler ein Eintrag (Zähler, Flags, Entscheidungen, Gebiete). Muss mit der Spielerzahl wachsen — z. B. `gs.areaZones`, `mulliganDecisions`, `setScore`.

- `cards/effects/_engine.js`
  - Zeile 9938: `[0, 0]`
  - Zeile 14520: `[[], []]`
  - Zeile 26753: `[[], []]`
  - Zeile 33663: `[0, 0]`
  - Zeile 47287: `[false, false]`
- `cards/effects/_guardian-beasts-shared.js`
  - Zeile 201: `[[], []]`
  - Zeile 208: `[[], []]`
- `cards/effects/mass-routing.js`
  - Zeile 150: `[0, 0]`
- `server.js`
  - Zeile 4137: `[0, 0]`
  - Zeile 4953: `[0, 0]`
  - Zeile 5367: `[false, false]`
  - Zeile 5786: `[0, 0]`
  - Zeile 6061: `[false, false]`
  - Zeile 6239: `[0, 0]`
  - Zeile 6277: `[0, 0]`
  - Zeile 6365: `[0, 0]`
  - Zeile 12931: `[0, 0]`
  - Zeile 13403: `[{}, {}]`
  - Zeile 13409: `[null, null]`
  - Zeile 13415: `[null, null]`
  - Zeile 13471: `[[],[]]`
  - Zeile 13563: `[null, null]`
  - Zeile 13809: `[0, 0]`
  - Zeile 15628: `[[], []]`
  - Zeile 15643: `[0, 0]`
  - Zeile 16476: `[0, 0]`
  - Zeile 16664: `[0, 0]`
  - Zeile 16904: `[0, 0]`
  - Zeile 18086: `[0, 0]`
  - Zeile 18739: `[0, 0]`
  - Zeile 19532: `[0, 0]`

### Feste Indizes `players[0]` / `players[1]`

Setzt Spieler 0 und 1 fest voraus. Die Guardian-Beast-Karten zählen beide Ablagen von Hand durch — dort gehört `opponentsOf`/`playerCount` hin.

- `cards/effects/_engine.js`
  - Zeile 33322: `players[0]`
  - Zeile 33322: `players[1]`
  - Zeile 35793: `players[0]`
  - Zeile 35793: `players[1]`
- `cards/effects/_guardian-beasts-shared.js`
  - Zeile 286: `engine.gs.players[0]`
  - Zeile 287: `engine.gs.players[1]`
- `cards/effects/debt-o-tron-model-loan-shredder.js`
  - Zeile 78: `gs.players[0]`
  - Zeile 78: `gs.players[1]`
  - Zeile 80: `gs.players[1]`
  - Zeile 81: `gs.players[0]`
- `cards/effects/festive-werz.js`
  - Zeile 151: `gs.players[0]`
  - Zeile 151: `gs.players[1]`
- `cards/effects/graveyard-of-limited-power.js`
  - Zeile 33: `gs.players[0]`
  - Zeile 34: `gs.players[1]`
- `cards/effects/guardian-beast-gou.js`
  - Zeile 171: `engine.gs.players[0]`
  - Zeile 172: `engine.gs.players[1]`
  - Zeile 184: `gs.players[0]`
  - Zeile 185: `gs.players[1]`
- `cards/effects/guardian-beast-hou.js`
  - Zeile 48: `engine.gs.players[0]`
  - Zeile 49: `engine.gs.players[1]`
  - Zeile 58: `engine.gs.players[0]`
  - Zeile 59: `engine.gs.players[1]`
- `cards/effects/guardian-beast-hu.js`
  - Zeile 68: `engine.gs.players[0]`
  - Zeile 69: `engine.gs.players[1]`
- `cards/effects/guardian-beast-ji.js`
  - Zeile 42: `engine.gs.players[0]`
  - Zeile 43: `engine.gs.players[1]`
- `cards/effects/guardian-beast-long.js`
  - Zeile 66: `engine.gs.players[0]`
  - Zeile 67: `engine.gs.players[1]`
  - Zeile 76: `engine.gs.players[0]`
  - Zeile 77: `engine.gs.players[1]`
- `cards/effects/guardian-beast-niu.js`
  - Zeile 58: `engine.gs.players[0]`
  - Zeile 59: `engine.gs.players[1]`
  - Zeile 72: `gs.players[0]`
  - Zeile 73: `gs.players[1]`
- `cards/effects/guardian-beast-she.js`
  - Zeile 56: `engine.gs.players[0]`
  - Zeile 57: `engine.gs.players[1]`
  - Zeile 65: `engine.gs.players[0]`
  - Zeile 66: `engine.gs.players[1]`
- `cards/effects/guardian-beast-shu.js`
  - Zeile 56: `engine.gs.players[0]`
  - Zeile 57: `engine.gs.players[1]`
  - Zeile 76: `engine.gs.players[0]`
  - Zeile 77: `engine.gs.players[1]`
- `cards/effects/guardian-beast-tu.js`
  - Zeile 34: `engine.gs.players[0]`
  - Zeile 35: `engine.gs.players[1]`
  - Zeile 43: `engine.gs.players[0]`
  - Zeile 44: `engine.gs.players[1]`
- `cards/effects/mao-the-vengeful-guardian.js`
  - Zeile 89: `engine.gs.players[0]`
  - Zeile 90: `engine.gs.players[1]`
  - Zeile 105: `gs.players[0]`
  - Zeile 106: `gs.players[1]`
- `cards/effects/market-crash.js`
  - Zeile 180: `gs.players[0]`
  - Zeile 180: `gs.players[1]`
- `server.js`
  - Zeile 6489: `gs.players[0]`
  - Zeile 13901: `room.players[0]`
  - Zeile 13936: `room.players[0]`
  - Zeile 15614: `puzzleData.players[0]`
  - Zeile 15615: `puzzleData.players[1]`
  - Zeile 16498: `room.gameState.players[1]`
  - Zeile 16521: `room.gameState.players[1]`
  - Zeile 16525: `room.gameState.players[1]`
  - Zeile 16595: `room.gameState.players[1]`
  - Zeile 18615: `room.players[0]`

### `pi === 0 ? a : b` mit Nicht-Zahlen

Wählt zwischen zwei festen Seiten (Beschriftung, Selektor, Zustand) — keine Zahl, daher nicht über `opponentOf` lösbar.

- `cards/effects/beer.js`
  - Zeile 167: `target.owner === 0 ? 'me' : 'opp'`
- `cards/effects/debt-o-tron-model-loan-shredder.js`
  - Zeile 79: `pi === 0 ? [0, gs.players[1].gold || 0] : [gs.players[0].gold || 0, 0]`
- `cards/effects/the-core-s-awakening.js`
  - Zeile 107: `pi === 0 ? '[data-my-deck]' : '[data-opp-deck]'`
- `server.js`
  - Zeile 6110: `winnerIdx === 0 ? match.p1Seat : match.p2Seat`
  - Zeile 14906: `pi === 0 ? { ...ping } : { ...flipped }`
  - Zeile 17586: `r.winnerIdx === 0 ? nameP0 : r.winnerIdx === 1 ? nameP1 : 'DRAW'`
  - Zeile 17586: `r.winnerIdx === 1 ? nameP1 : 'DRAW'`
  - Zeile 17587: `r.winnerIdx === 0 ? nameP1 : r.winnerIdx === 1 ? nameP0 : 'DRAW'`
  - Zeile 17587: `r.winnerIdx === 1 ? nameP0 : 'DRAW'`
  - Zeile 17852: `t.winnerIdx === 0 ? t.deckP0 : t.winnerIdx === 1 ? t.deckP1 : 'DRAW'`
  - Zeile 17852: `t.winnerIdx === 1 ? t.deckP1 : 'DRAW'`
  - Zeile 18735: `pinnedIdx === 0 ? [pinnedDeck, oppDeck] : [oppDeck, pinnedDeck]`
  - Zeile 18887: `pinnedIdx === 0 ? [a, b] : [b, a]`

### Spielerindex gegen 0/1 verglichen

Vergleiche wie `activePlayer === 0` / `pi !== 1`. Meist harmlos („ist der Wirker Spieler 0?“ als Identität), kippen aber, sobald
„Spieler 0/1“ als „erster/zweiter Spieler“ gelesen wird. Pro Datei die Zeilen:

- `cards/effects/_attachment-shared.js`: 195
- `cards/effects/_doom-clock-shared.js`: 106
- `cards/effects/_engine.js`: 1747, 6980, 6997, 6999, 7739, 10843, 11167, 11285, 11789, 12640, 12857, 15106, 19121, 20712, 20852, 21191, 21642, 23371, 23372, 24294, 26165, 27131, 30154, 30167, 30168, 32310, 32386, 36512, 36592, 36611, 37812, 41781, 42524, 42542, 43588, 46556, 47339, 47356, 47958, 48795
- `cards/effects/_equip-shared.js`: 153
- `cards/effects/_hooks.js`: 913
- `cards/effects/_teocuilatl-shared.js`: 107
- `cards/effects/beer.js`: 167
- `cards/effects/blue-ice-dragon.js`: 245
- `cards/effects/bomblebee-cluster.js`: 91
- `cards/effects/candlestick-squire.js`: 185, 186, 270
- `cards/effects/carris-the-time-keeper.js`: 75
- `cards/effects/chaorc-corpse-cannibal.js`: 100
- `cards/effects/debt-o-tron-model-loan-shredder.js`: 79
- `cards/effects/foresta-the-guard.js`: 252
- `cards/effects/gigantisaur-chimera.js`: 157, 160
- `cards/effects/petrification-break.js`: 103
- `cards/effects/quetzahuitl-receiver-of-sacrifices.js`: 370
- `cards/effects/rool-the-troll-guard.js`: 43
- `cards/effects/skull-necklace.js`: 128
- `cards/effects/steam-dwarf-dragon-pilot.js`: 267
- `cards/effects/stormkissed-waflav.js`: 242
- `cards/effects/suspicious-monster.js`: 145, 164
- `cards/effects/the-core-s-awakening.js`: 107
- `cards/effects/the-egg-of-god.js`: 153
- `cards/effects/the-first-circle-of-hell.js`: 161
- `cards/effects/trample-sounds-in-the-forest.js`: 74
- `cards/effects/waitress.js`: 227, 228, 307
- `server.js`: 4934, 5767, 5948, 6110, 6264, 6267, 6357, 6400, 6401, 7112, 7214, 7242, 7251, 7260, 8053, 13727, 14296, 14623, 14906, 15202, 15259, 15278, 15293, 15327, 15356, 15367, 15389, 15415, 15766, 15834, 16658, 16678, 16690, 16693, 17401, 17553, 17556, 17586, 17587, 17852, 17971, 18534, 18735, 18887
