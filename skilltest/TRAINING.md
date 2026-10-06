# Skill Test — Training der Bots auf einem Server

Die Bots lernen im **Selbstspiel** (headless, 2–8 Sitze gemischt). Das Training läuft in einem eigenen Prozess (`scripts/skilltest-train.js`),
nicht im Spielserver. Was gelernt wird, steht in README.md („Bots und Lernsystem"); hier geht es um den Betrieb.

## Große Trainingssession starten

```bash
cd /pfad/zu/PixelParties
npm install                                   # einmalig
nohup nice -n 10 node scripts/skilltest-train.js \
  --forever --hours 12 --workers 7 --seats 2-8 \
  --bench-every 2000 --bench-games 80 --mcts-bench-every 6000 \
  > data/skilltest-train.log 2>&1 &
```

| Option | Bedeutung | Standard |
| --- | --- | --- |
| `--forever` / `--games 0` | keine Partiezahl; es läuft, bis `--hours`/`--minutes` ablaufen oder der Prozess ein SIGINT/SIGTERM bekommt (speichert sauber) | `--games 100` |
| `--hours H`, `--minutes M` | Laufzeitgrenze | keine |
| `--workers N` | Worker-Threads, je einer spielt eine Partie. Faustregel: Kerne − 1 | Kerne − 1 |
| `--worker-mem MB` | Heap-Limit je Worker | 1536 |
| `--seats 2-8` / `--seats 4` | Tischgrößen (mittlere Größen kommen öfter vor) | 2–8 |
| `--game-timeout S` | Obergrenze je Partie in s. Wirksam ist ein Vielfaches der üblichen Dauer (90. Perzentil × 12, mindestens 60 s) | 240 |
| `--save-every N` | Profil und Kartenliste alle N Partien speichern | 100 |
| `--checkpoint-minutes M` | Sicherungskopie des Profils alle M Minuten, die letzten 4 bleiben | 60 |
| `--bench-every N`, `--bench-games G` | Vergleich trainiert gegen untrainiert alle N Partien (G Einzelspiele) | 300, 40 |
| `--mcts-bench-every N`, `--mcts-bench-games G` | Lookahead-Vergleich (ein Sitz sucht, die anderen gleich stark ohne Suche) | aus |
| `--progress S` | Fortschrittszeile alle S Sekunden | 60 |

Beim Start wird ein vorhandenes Profil **weitergeführt** (`data/skilltest-profile.json`, umlenkbar mit `PP_ST_PROFILE=/pfad/profil.json`);
vor dem ersten Speichern entsteht einmalig `<profil>.bak`. Strg+C / `kill <pid>` beendet nach der laufenden Partie und speichert.

**Rechenbedarf (gemessen auf 4 Kernen, 3 Worker):** 60–110 Partien pro Minute, also grob 4.000–6.500 pro Stunde; mit mehr Kernen skaliert es
ungefähr linear. Für das Behalten/Recyceln-Modell (Kontext aus Hand und Brett) sind 20.000–50.000 Partien sinnvoll; einzelne Kartenpaare brauchen deutlich mehr.
Der Lookahead (MCTS) läuft im Training **nicht** mit (zu langsam); er wird nur über `--mcts-bench-every` gemessen.

## Was geschrieben wird (neben dem Profil)

| Datei | Inhalt |
| --- | --- |
| `<profil>.ranking.json` | Karten nach gelerntem Wert (inkl. Behalten/Recyceln-Vorteil, Paar- und Kontext-Effekte) |
| `<profil>.ranking-history.jsonl` | Verlauf der Kartenwerte je Prüfpunkt |
| `<profil>.bench.jsonl` | Vergleichsspiele: trainiert gegen untrainiert, dazu `kind: "mcts"` (Lookahead) |
| `<profil>.status.json` | Lebenszeichen des Trainers (Partien, Rate, verworfene, Hänger) |
| `<profil>.hangs.jsonl` | **Hänger-Diagnose**: je Partie, die das Zeitlimit überschritt, die letzten ~80 Engine-Ereignisse und Prompts |
| `<profil>.bak`, `<profil>.ckpt-<Zeit>.json` | Sicherungen |

## Beobachten

- `node scripts/skilltest-report.js` — Vergleichsspiele, Kartenliste, Behalten/Recyceln, Lookahead (läuft jederzeit, liest nur Dateien).
- `/skilltest-learning.html` auf dem Spielserver — dasselbe live (der Server liest die Dateien des Trainers; Trainer und Server brauchen dasselbe `data/`-Verzeichnis).
- Die Fortschrittszeile im Log: Sitzung/Gesamtzahl, Rate, verworfene Partien, Hänger.

Was man sehen sollte: Die Siegquote im Vergleich „trainiert gegen untrainiert" steigt über den Partien über die Erwartung (1/Sitze); Kartenwerte
und Kontext-Effekte werden mit der Zeit stabiler (Spalte „Trend"/Δ). Eine einzelne Messung mit 40 Spielen schwankt um etwa ±7 Prozentpunkte — auf z achten.

## Hänger und Fehler

- Ein Hänger kostet höchstens das wirksame Zeitlimit eines Workers (Standard: ein Vielfaches der üblichen Partiedauer, mindestens 60 s); der Worker wird ersetzt,
  die Partie nicht gewertet. Steigt die Zahl in der Fortschrittszeile auffällig, bitte die letzten Zeilen von `<profil>.hangs.jsonl` ansehen — sie nennen die Karte/den Prompt,
  bei dem es hängt.
- Fehler beim Speichern oder Auswerten beenden den Lauf nicht (sie werden gemeldet, der Lauf geht weiter).
- Speicher: jeder Worker ist auf `--worker-mem` begrenzt; bei knappem RAM `--workers` senken.

## Nach dem Training

- Das Profil gilt für den Spielserver sofort (er prüft die Datei alle ~30 s); liegt der Trainer auf einem anderen Rechner, `data/skilltest-profile.json` kopieren.
- Kompaktes Profil zum Einchecken: `node scripts/skilltest-train.js --export data/skilltest-profile.json --min-n 4`.
- Stärke prüfen: `node scripts/skilltest-train.js --evaluate 200 --seats 4` (gelernt gegen Standard-Bots, `--mode full|profile|persona`).

## Passives Lernen im Spielserver

`PP_ST_TRAIN_BG=1 node server.js` (oder `=0.1` für 10 % Rechenanteil) startet einen Kindprozess mit niedriger Priorität, der unablässig lernt (ein Worker, Dauerbetrieb).
Für eine große Session ist der eigene Trainingsprozess oben besser.
