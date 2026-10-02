# Promo-Clips

Echtes Footage aus dem laufenden Simulator (lokaler Server, Headless-Chromium, 1600×900 aufgenommen).
Jeder Clip liegt als GIF (720 px, 256 Farben) und als MP4 (1600×900, nahezu verlustfrei) vor. Aufgenommen per Screencast mit hoher JPEG-Qualität statt der Standard-Videoaufnahme, deshalb sind die Karten in den Tooltips scharf.
Die Clips sind in Echtzeit und ungekürzt an Zuggrenzen geschnitten (jeweils bis kurz in das Banner des Folgezugs).

## Battle: Suicide Bombers vs. Venom Swamp (`battle/`)

Beide Partien wurden vollständig bis zum Ende gespielt (CPU gegen CPU), je ein Clip pro Spielerzug.
Die Hand des unteren Spielers ist offen, der Mauszeiger ist eingeblendet. In Zug 1 beider Spieler werden
die Board-Karten des jeweils aktiven Spielers (und, wenn er unten sitzt, seine Handkarten) per Hover vorgestellt,
bevor der Zug gespielt wird.

| Partie | Unten | Oben | Ergebnis | Clips |
|---|---|---|---|---|
| 1 | Suicide Bombers | Venom Swamp | Suicide Bombers gewinnt (Zug 12, alle Helden besiegt) | `partie1_zug01` bis `partie1_zug12` |
| 2 | Venom Swamp | Suicide Bombers | Venom Swamp gewinnt (Zug 11, alle Helden besiegt) | `partie2_zug01` bis `partie2_zug11` |

Partie 1 und 2 wurden neu aufgenommen. Die Hand des unteren Spielers ist offen; Handpräsentation in `partie1_zug02` bzw. `partie2_zug02` (jeweils Zug des unteren Spielers).
Zug 1 jeweils: Präsentation des Boards des Spielers, der beginnt (dieser sitzt oben, seine Hand ist daher verdeckt).

## Weitere Modi

| Datei | Modus | Inhalt |
|---|---|---|
| `vscpu_1_start` | VS CPU | Gegnerwahl, „You go second“, Mulligan, erster Gegnerzug |
| `vscpu_2_my_turn` | VS CPU | Eigener Zug: Hand mit Tooltips, Board, Zug beenden |
| `vscpu_3_opponent_turn` | VS CPU | Kompletter Gegnerzug mit Karteneffekten bis „Your turn!“ |
| `deckbuilder` | Deck-Editor | Starter-Deck laden, Karten ansehen, Datenbank durchblättern und suchen |
| `shop` | Shop | Skins, Avatare, Sleeves, Gegner-Sleeves, Boards |
