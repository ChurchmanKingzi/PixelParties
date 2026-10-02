# Promo-Clips

Echtes Footage aus dem laufenden Simulator (lokaler Server, Chromium in einem virtuellen Bildschirm, 1280×720).
Jeder Clip liegt als GIF (720 px breit, 256 Farben, **30 fps**) und als MP4 (1280×720, **30 fps**) vor.

**Wie die Flüssigkeit zustande kommt:** Der Browser rendert das Spiel ohne GPU und schafft in Echtzeit nur 20–40 fps.
Deshalb lief die Aufnahme in halber Spielgeschwindigkeit (Uhren, Timer und CSS-Animationen in Browser und Server um den Faktor 2 gedehnt,
Mitschnitt mit festen 30 fps) und wurde danach auf Echtzeit beschleunigt. Ergebnis: 30 fps ohne Ruckeln
(0,8 % doppelte Bilder über alle Clips). Die Spielgeschwindigkeit der Clips ist normal.

Die Clips sind an Zuggrenzen geschnitten (jeweils bis kurz in das Banner des Folgezugs). Das Siegbildschirm-Overlay ist herausgeschnitten.

Identität in allen Clips: Der Spieler heißt **Kingzi**, hat einen zufällig gewählten Shop-Avatar (`LovingPuppetPavi`)
und die Sleeve `life-serum`. Der Gegner trägt die Sleeve seiner CPU (Suicide Bombers: `blast-radius`, Venom Swamp: `tainted-fountain`).

## Battle: Suicide Bombers vs. Venom Swamp (`battle/`)

Beide Partien wurden vollständig bis zum Ende gespielt (CPU gegen CPU), je ein Clip pro Spielerzug, benannt nach
Zugnummer, Seite (`kingzi_…` = unten, `cpu_…` = oben) und Deck. Die Hand des unteren Spielers ist offen, der Mauszeiger ist
eingeblendet. In den ersten Zügen beider Spieler wird die Partie angehalten und alle Board-Karten (beim unteren Spieler
zusätzlich alle Handkarten) per Hover vorgestellt, bevor der Zug gespielt wird.

| Partie | Unten (Kingzi) | Oben (CPU) | Ergebnis | Clips |
|---|---|---|---|---|
| 1 | Suicide Bombers | Venom Swamp | Suicide Bombers gewinnt (Zug 14) | `partie1_zug01` bis `partie1_zug13` |
| 2 | Venom Swamp | Suicide Bombers | Venom Swamp gewinnt (Zug 13) | `partie2_zug01` bis `partie2_zug13` |

Präsentation: `partie1_zug01` (Kingzi: Hand + Board), `partie1_zug02` (CPU-Board), `partie2_zug01` (CPU-Board), `partie2_zug02` (Kingzi: Hand + Board).
In Partie 1 endet der letzte Zug (14) nach 0,1 s mit dem Sieg und ist deshalb im Clip `partie1_zug13` enthalten.

## Weitere Modi

| Datei | Modus | Inhalt |
|---|---|---|
| `vscpu_1_start` | VS CPU (gegen Zsos'Ssar) | Gegnerwahl, Mulligan, erster Gegnerzug |
| `vscpu_2_my_turn` | VS CPU | Eigener Zug: Hand mit Tooltips, Board, Zug beenden |
| `vscpu_3_opponent_turn` | VS CPU | Kompletter Gegnerzug inkl. „Magic Lamp“-Auswahl bis „Your turn!“ |
| `deckbuilder` | Deck-Editor | Starter-Deck laden, Karten ansehen, Datenbank durchblättern und suchen |
| `shop` | Shop | Skins, Avatare, Sleeves, Gegner-Sleeves, Boards |
