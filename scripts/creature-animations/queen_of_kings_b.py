# -*- coding: utf-8 -*-
"""Idle-Animation für „Queen of Kings [B]“ (Creature) — die schwarze Schachdame mit goldener Krone, rotem Edelstein und roten Augen.

Quelle: src/queen-of-kings-b.png (16×32 px, 13 Farben).
PICK: [["Motive", 639, 2]]      (Ebene „Chess“, Figur 2 = schwarze Dame; dieselbe Figur liegt in MotiveRussia Ebene 17 „Dragsparov“ Figur 2; Karte Queen_of_Kings.png: 98 % Treffer, Figur bei (30,10)).
Auf der Karte [B] sind Edelstein und Augenpupillen ROT, in der Ebene grün: Median der Kartenpixel — (7,3)/(6,9)/(9,9): (131,1,2) statt (41,123,0), (8,3)/(6,8)/(9,8): (71,2,2) statt (24,65,0).
Der Sprite trägt diese Kartenfarben (Farbtabelle wie bei Bishop of Kings [B]); alles andere (Grautöne, Gold, Hellblau) ist unverändert (Abweichung ≤ 24).
Quelle vollständig; rundherum Schachbrett und Mauer. Weiße Schwester: queen_of_kings_w.py.

Aufruf:   python3 queen_of_kings_b.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/queen-of-kings-b.png + .json

Was im Sprite ist (x, y im 16×32-Sprite) — wie bei [W], nur dunkel:
* KRONE (Gold, y 0–4) mit rotem EDELSTEIN (131,1,2)/(71,2,2) bei (7,3)/(8,3); KOPF (x 4–12, y 5–10) in Dunkelgrau (26/51/77/102/128) mit roten Pupillen und hellblauen Glanzpunkten (5,8)/(10,8) (172,213,255) bzw. (5,9)/(10,9) (230,230,230);
  HALS (y 12–16); ROCK/SOCKEL (y 17–31) mit schwarzen Zierbändern.
Metall/Edelstein: nur Krone + Rubin glänzen (Regel 14); der Stein nicht. Keine Partikel.

Ablauf (48 Frames à 70 ms, nahtlos) — eigene Zeitfenster/Perioden gegenüber [W]:
* Heben (Periode 16, drei Hübe je Schleife; die schwarze Dame „atmet“ schneller): Kopf + Krone steigen 1 px (Halszeile 14 eingefügt), Sockel bleibt.
* Lichtband über das Krongold (Frames 28–39); Glitzersterne rechts (Frame 12), oben (26), links (40) — Mitte → 1 px → 2 px → zurück, am Gold, steigen mit der Krone.
* Rubin tauscht die Facetten (Frames 6–8, 22–24, 38–40); Blinzeln (Frames 8–9, 32–33): Augenpixel in Gesichtsfarbe (77,77,77).
Frame 0 = Original. Ergänzungen: keine.
"""
import sys

import anim_humanoide as Hm
import anim_lib as L
import anim_schach as Sc

SLUG, KARTE = 'queen-of-kings-b', 'Queen of Kings [B]'
spr = L.lade(SLUG)
A = Sc.Dame(spr, hub_per=16, band=28, sterne=((12, (14, 1)), (26, (8, 0)), (40, (1, 1))), gem=(6, 22, 38), blink=(8, 32))
N, MS, OFF = A.N, A.MS, A.OFF
frame = A.frame
TEST_EBENEN = ('koerper',)          # Randpixel-Test (randtest.py) ohne die Glitzersterne (Zusatzpixel in Hellgold)

if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    Sc.lauf('queen_of_kings_b', KARTE, frames, MS, prev, spr, OFF)
