# Promo-Clips

Echtes Footage aus dem laufenden Simulator (lokaler Server, Headless-Chromium, 1600×900).
Jeder Clip liegt als GIF (720 px, 256 Farben) und als MP4 (1600×900, nahezu verlustfrei) vor.
Aufnahme per Screencast mit hoher JPEG-Qualität, Schriften (Pixel Intv, Press Start 2P, Rajdhani, Orbitron) lokal eingebunden.
Die Clips sind in Echtzeit an Zuggrenzen geschnitten (jeweils bis kurz in das Banner des Folgezugs).

Identität in allen Clips: Der Spieler heißt **Kingzi**, hat einen zufällig gewählten Shop-Avatar (`LovingPuppetPavi`)
und die Sleeve `life-serum`. Der Gegner trägt die Sleeve seiner CPU (Suicide Bombers: `blast-radius`, Venom Swamp: `tainted-fountain`).

## Battle: Suicide Bombers vs. Venom Swamp (`battle/`)

Beide Partien wurden vollständig bis zum Ende gespielt (CPU gegen CPU), je ein Clip pro Spielerzug, benannt nach
Zugnummer, Seite (`kingzi_…` = unten, `cpu_…` = oben) und Deck. Die Hand des unteren Spielers ist offen, der Mauszeiger ist
eingeblendet. In den ersten Zügen beider Spieler wird die Partie angehalten und alle Board-Karten (beim unteren Spieler
zusätzlich alle Handkarten) per Hover vorgestellt, bevor der Zug gespielt wird.

| Partie | Unten (Kingzi) | Oben (CPU) | Ergebnis | Clips |
|---|---|---|---|---|
| 1 | Suicide Bombers | Venom Swamp | Suicide Bombers gewinnt (Zug 11) | `partie1_zug01` bis `partie1_zug11` |
| 2 | Venom Swamp | Suicide Bombers | Suicide Bombers (CPU) gewinnt (Zug 12) | `partie2_zug01` bis `partie2_zug11` |

Präsentation: `partie1_zug01` (Kingzi: Hand + Board), `partie1_zug02` (CPU-Board), `partie2_zug01` (CPU-Board), `partie2_zug02` (Kingzi: Hand + Board).

## Weitere Modi

| Datei | Modus | Inhalt |
|---|---|---|
| `vscpu_1_start` | VS CPU (gegen Zsos'Ssar) | Gegnerwahl, Mulligan, erster Zug |
| `vscpu_2_my_turn` | VS CPU | Eigener Zug: Hand mit Tooltips, Board, Zug beenden |
| `vscpu_3_opponent_turn` | VS CPU | Kompletter Gegnerzug bis „Your turn!“ |
| `deckbuilder` | Deck-Editor | Starter-Deck laden, Karten ansehen, Datenbank durchblättern und suchen |
| `shop` | Shop | Skins, Avatare, Sleeves, Gegner-Sleeves, Boards |
