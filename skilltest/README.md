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
| `learn/` | Lernsystem: `profile.js` (Profil-Datei), `personas.js` (Spielstile), `train.js` (Selbstspiel/Liga), `background.js` (Dauerbetrieb). |
| `sim.js` / `sim-bridge.js` | Headless-Spiele ohne Server (Tests, Training). |

## Bots und Lernsystem

CPU-Sitze bekommen eine zufällige Helden-Persona (nur Name/Avatar). Gespielt wird mit `policy.js`: Basisangriff,
Hero-/Creature-Effekte, Handzauber, Beschwörungen (verbrauchen den Zug) sowie Artifacts/Surprises (frei). Im Aufbau
(`policy.prepareBase`, `autoprep.buildWithRecycling`) wählt der Bot Heroes nach Wert, verteilt Abilities/Support nach
gelernter Passung und wirft alles Unbrauchbare in den Recycler (Gold, früherer Spielbeginn).

Gelernt wird per **Selbstspiel** (headless, 2–8 Sitze gemischt, `learn/train.js`) in **drei Kanälen**, alle in einer Datei
(`data/skilltest-profile.json`, per `PP_ST_PROFILE` umlenkbar, atomar gespeichert, `version` zählt hoch):

| Kanal | Inhalt | Wird genutzt für |
| --- | --- | --- |
| `playValue` | mittlerer Zuwachs der Stellungsbewertung nach dem Ausspielen einer Karte/Aktion | Reihenfolge der Aktionen, Zauber-Timing; mit UCB-Neugier für selten Gespieltes |
| `cardValue` / `pairValue` | mittlere Platzierungsgüte von Basen mit dieser Karte bzw. diesem Paar (Held+Ability/Creature, Ability+Creature, Held+Held) | Heldenwahl, Ability-/Support-Verteilung, was recycelt wird |
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

## Zusätzliche Ereignisse

Server → Client: `st_prep_*` (Vorbereitung), `st_game_over { winnerIdx, reason, placements, sc, rounds }`;
`gameState.skillTest` (`publicState`): Round, Reihenfolge, Startspieler, Zugsitz, erschöpfte Helden/Creatures, Ausgeschiedene,
Bot-Sitze, Timer. Client → Server: `st_attack`, `st_pass_round`, (Held-/Creature-Effekte laufen über die normalen Handler).

## Regressionsschutz & Tests

- `scripts/regress/compare.sh` vergleicht geseedete 2-Spieler-Normalspiele mit der eingecheckten Baseline —
  **muss nach jeder Engine-Änderung „unverändert" melden**.
- `scripts/skilltest-e2e/*.test.js` (Lobby, Vorbereitung, Kampf per Socket), `ui-*.shot.js` (Playwright, Screenshots).
- Headless: `node -e "require('./skilltest/sim').runGame({seats:4}).then(console.log)"` (mit `PP_ST_SIM=1`, siehe `sim-bridge.js`).

## Testschalter

`PP_ST_BOT_DELAY_MS` (Denkpause der Bots, ms), `PP_ST_SIM=1` (server.js exportiert nur die Handler, startet nicht).
