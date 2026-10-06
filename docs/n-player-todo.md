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

- Zeilen 10861, 47382 (`winnerIdx = playerIdx === 0 ? 1 : 0`, `winnerIdx = pi === 0 ? 1 : 0`) — Sieger/Verlierer-Ableitung (Spielende)
- Zeile 47365 (`loserIdx === 0 ? 1 : 0`) — Sieger/Verlierer-Ableitung (Spielende): im Mehrspielermodus ist „der andere“ kein Verlierer

### `cards/effects/carris-the-time-keeper.js`

- Zeile 75 (`winnerIdx = controller === 0 ? 1 : 0`) — Sieger/Verlierer-Ableitung (Spielende)

### `cards/effects/quetzahuitl-receiver-of-sacrifices.js`

- Zeile 370 (`winnerIdx = pi === 0 ? 1 : 0`) — Sieger/Verlierer-Ableitung (Spielende)

### `cards/effects/the-golden-abomination.js`

- Zeile 47 (`gewinner === 0 ? 1 : 0`) — Sieger/Verlierer-Ableitung (Spielende): im Mehrspielermodus ist „der andere“ kein Verlierer

### `server.js`

- Zeile 4164 (`for (let i = 0; i < 2; i++)`) — startChallengeGame: Herausforderungs-Start (Lobby)
- Zeilen 5954, 6270, 6363, 6406, 15458, 15484, 16727 (`winnerIdx === 0 ? 1 : 0`, `room.gameState.result.winnerIdx === 0 ? 1 : 0`, `loserIdx === 0 ? 1 : 0`) — Sieger/Verlierer-Ableitung (Spielende): im Mehrspielermodus ist „der andere“ kein Verlierer
- Zeilen 6019, 6024, 6028, 6043, 6078, 6084 (`for (let i = 0; i < 2; i++)`, `for (let pi = 0; pi < 2; pi++)`, `i === 0 ? 1 : 0`) — endGame: Spielende: Sieger/Verlierer, Elo, Side-Deck-Phase — Mehrspieler-Wertung ist eine Entscheidung
- Zeilen 6248, 6252 (`for (let i = 0; i < 2; i++)`) — advanceToNextGame: Folgepartie im Match (Side-Deck/Lobby)
- Zeile 6354 (`for (let i = 0; i < 2; i++)`) — puzzleEndGame: Puzzle-Ende (2 Spieler, Spieler 0 = Löser)
- Zeilen 6520, 6524 (`for (let i = 0; i < 2; i++)`) — endCpuBattle: CPU-Kampf-Ende (2 Spieler, 0 = Mensch)
- Zeilen 13556, 13565 (`for (let pi = 0; pi < 2; pi++)`, `for(let i=0;i<2;i++)`) — startGameEngine: Spielstart (Starthand ziehen, Mulligan)
- Zeile 13752 (`pi === 0 ? 1 : 0`) — on(auth): Wiederverbinden/Sitz-Logik (Lobby)
- Zeilen 14280, 14306, 14320, 14327 (`for (let i = 0; i < 2; i++)`, `for (let p = 0; p < 2; p++)`) — on(mulligan_decision): Mulligan-Phase (mulliganDecisions = [null, null])
- Zeilen 14366, 15424, 15436 (`winnerIdx = pi === 0 ? 1 : 0`) — Sieger/Verlierer-Ableitung (Spielende)
- Zeile 15269 (`pi === 0 ? 1 : 0`) — on(side_deck_swap): Side-Deck-Phase (Match-Ablauf, zwei Sitze)
- Zeile 15326 (`pi === 0 ? 1 : 0`) — on(side_deck_move): Side-Deck-Phase (Match-Ablauf, zwei Sitze)
- Zeile 15345 (`pi === 0 ? 1 : 0`) — on(side_deck_reset): Side-Deck-Phase (Match-Ablauf, zwei Sitze)
- Zeile 15360 (`pi === 0 ? 1 : 0`) — on(side_deck_done): Side-Deck-Phase (Match-Ablauf, zwei Sitze)
- Zeilen 15456, 15461, 15471 (`for (let i=0;i<2;i++)`, `for(let i=0;i<2;i++)`) — on(request_rematch): Rematch (Lobby/Sitze)
- Zeilen 15823, 15835, 15846, 15903, 16186, 16214, 16237, 16246, 16265 (`for (let pi = 0; pi < 2; pi++)`, `pi === 0 ? 1 : 0`) — createPuzzleGame: Puzzle-Aufbau (Puzzle-Daten sind 2-Spieler-Arrays)
- Zeilen 16641, 16655, 16684, 16694, 16700, 16716 (`for (let i = 0; i < 2; i++)`, `for (let p = 0; p < 2; p++)`) — createCpuBattle: CPU-Kampf-Aufbau (bleibt 2 Spieler)
- Zeile 16779 (`for (let i = 0; i < 2; i++)`) — endCampaignBattle: Kampagnen-Kampf-Ende (2 Spieler)
- Zeile 17092 (`[0, 1]`) — runOneSelfPlayGame: server.js außerhalb des Spielgeschehens (Lobby/Sitze/Verwaltung)
- Zeilen 18184, 18199 (`for (let i = 0; i < 2; i++)`, `[0, 1]`) — on(connection): server.js außerhalb des Spielgeschehens (Lobby/Sitze/Verwaltung)
- Zeilen 18488, 18501, 18517 (`for (let i = 0; i < 2; i++)`) — on(tutorial_modify): Tutorial (Einzelspieler)
- Zeile 18608 (`pi===0?1:0`) — on(disconnect): Verbindungsabbruch/Sitz-Logik (Lobby)
- Zeile 19027 (`[0, 1]`) — runHeadlessTrainingGame: server.js außerhalb des Spielgeschehens (Lobby/Sitze/Verwaltung)

## 2. Zwei-Spieler-Strukturen, die `opponentOf`/`playerCount` nicht ausdrücken

Unveränderte Zwei-Spieler-Annahmen im Zustandsaufbau und in Spezialfällen. Pro Datei: Zeile, Fundstelle, Hinweis.
Nicht angefasst: `_cpu.js`, `_deck-profile.js`, `_train-*.js`, `_demo-recorder.js`, `_decision-log.js`, `_sc-tracking.js` (Zwei-Spieler-Inseln, siehe `scripts/n-player-allow.json`).

Übersicht: Zwei-Spieler-Literale: 33 · Feste Indizes `players[0]` / `players[1]`: 49 · Spielerindex gegen 0/1 verglichen: 57 · `pi === 0 ? a : b` mit Nicht-Zahlen: 12

### Zwei-Spieler-Literale

Pro Spieler ein Eintrag (Zähler, Flags, Entscheidungen, Gebiete). Muss mit der Spielerzahl wachsen — z. B. `gs.areaZones`, `mulliganDecisions`, `setScore`.

- `cards/effects/_ability-worth-shared.js`
  - Zeile 255: `[{}, {}]`
- `cards/effects/_area-removal-shared.js`
  - Zeile 93: `[0, 0]`
- `cards/effects/_engine.js`
  - Zeile 9954: `[0, 0]`
  - Zeile 14538: `[[], []]`
  - Zeile 26776: `[[], []]`
  - Zeile 33684: `[0, 0]`
  - Zeile 47313: `[false, false]`
- `cards/effects/_guardian-beasts-shared.js`
  - Zeile 201: `[[], []]`
  - Zeile 208: `[[], []]`
- `cards/effects/mass-routing.js`
  - Zeile 150: `[0, 0]`
- `server.js`
  - Zeile 4139: `[0, 0]`
  - Zeile 4956: `[0, 0]`
  - Zeile 5371: `[false, false]`
  - Zeile 5791: `[0, 0]`
  - Zeile 6067: `[false, false]`
  - Zeile 6245: `[0, 0]`
  - Zeile 6283: `[0, 0]`
  - Zeile 6371: `[0, 0]`
  - Zeile 12932: `[0, 0]`
  - Zeile 13404: `[{}, {}]`
  - Zeile 13410: `[null, null]`
  - Zeile 13416: `[null, null]`
  - Zeile 13472: `[[],[]]`
  - Zeile 13564: `[null, null]`
  - Zeile 13844: `[0, 0]`
  - Zeile 15697: `[[], []]`
  - Zeile 15712: `[0, 0]`
  - Zeile 16545: `[0, 0]`
  - Zeile 16733: `[0, 0]`
  - Zeile 16973: `[0, 0]`
  - Zeile 18155: `[0, 0]`
  - Zeile 18851: `[0, 0]`
  - Zeile 19644: `[0, 0]`

### Feste Indizes `players[0]` / `players[1]`

Setzt Spieler 0 und 1 fest voraus. Die Guardian-Beast-Karten zählen beide Ablagen von Hand durch — dort gehört `opponentsOf`/`playerCount` hin.

- `cards/effects/_guardian-beasts-shared.js`
  - Zeile 286: `engine.gs.players[0]`
  - Zeile 287: `engine.gs.players[1]`
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
- `server.js`
  - Zeile 6495: `gs.players[0]`
  - Zeile 13950: `room.players[0]`
  - Zeile 13987: `room.players[0]`
  - Zeile 15683: `puzzleData.players[0]`
  - Zeile 15684: `puzzleData.players[1]`
  - Zeile 16567: `room.gameState.players[1]`
  - Zeile 16590: `room.gameState.players[1]`
  - Zeile 16594: `room.gameState.players[1]`
  - Zeile 16664: `room.gameState.players[1]`
  - Zeile 18700: `room.players[0]`

### `pi === 0 ? a : b` mit Nicht-Zahlen

Wählt zwischen zwei festen Seiten (Beschriftung, Selektor, Zustand) — keine Zahl, daher nicht über `opponentOf` lösbar.

- `cards/effects/beer.js`
  - Zeile 167: `target.owner === 0 ? 'me' : 'opp'`
- `cards/effects/the-core-s-awakening.js`
  - Zeile 107: `pi === 0 ? '[data-my-deck]' : '[data-opp-deck]'`
- `server.js`
  - Zeile 6116: `winnerIdx === 0 ? match.p1Seat : match.p2Seat`
  - Zeile 14975: `pi === 0 ? { ...ping } : { ...flipped }`
  - Zeile 17655: `r.winnerIdx === 0 ? nameP0 : r.winnerIdx === 1 ? nameP1 : 'DRAW'`
  - Zeile 17655: `r.winnerIdx === 1 ? nameP1 : 'DRAW'`
  - Zeile 17656: `r.winnerIdx === 0 ? nameP1 : r.winnerIdx === 1 ? nameP0 : 'DRAW'`
  - Zeile 17656: `r.winnerIdx === 1 ? nameP0 : 'DRAW'`
  - Zeile 17921: `t.winnerIdx === 0 ? t.deckP0 : t.winnerIdx === 1 ? t.deckP1 : 'DRAW'`
  - Zeile 17921: `t.winnerIdx === 1 ? t.deckP1 : 'DRAW'`
  - Zeile 18847: `pinnedIdx === 0 ? [pinnedDeck, oppDeck] : [oppDeck, pinnedDeck]`
  - Zeile 18999: `pinnedIdx === 0 ? [a, b] : [b, a]`

### Spielerindex gegen 0/1 verglichen

Vergleiche wie `activePlayer === 0` / `pi !== 1`. Meist harmlos („ist der Wirker Spieler 0?“ als Identität), kippen aber, sobald
„Spieler 0/1“ als „erster/zweiter Spieler“ gelesen wird. Pro Datei die Zeilen:

- `cards/effects/_doom-clock-shared.js`: 106
- `cards/effects/_engine.js`: 7755, 10861, 21660, 23394, 23395, 24317, 32331, 46582, 47365, 47382
- `cards/effects/beer.js`: 167
- `cards/effects/carris-the-time-keeper.js`: 75
- `cards/effects/quetzahuitl-receiver-of-sacrifices.js`: 370
- `cards/effects/stormkissed-waflav.js`: 242
- `cards/effects/the-core-s-awakening.js`: 107
- `cards/effects/the-first-circle-of-hell.js`: 161
- `server.js`: 5954, 6116, 6270, 6273, 6363, 6406, 6407, 13752, 14366, 14975, 15269, 15326, 15345, 15360, 15424, 15436, 15458, 15484, 15835, 15903, 16727, 16747, 16759, 16762, 17470, 17622, 17625, 17655, 17656, 17921, 18040, 18608, 18847, 18999
