# -*- coding: utf-8 -*-
"""Idle-Animation für „Queen of Kings [W]“ (Creature) — die weiße Schachdame mit goldener Krone, grünem Edelstein und grünen Augen.

Quelle: src/queen-of-kings-w.png (16×32 px, 13 Farben).
PICK: [["Motive", 652, 1]]      (Ebene „Ebene #645“, Figur 1; Karte Queen_of_Kings_1.png: 98,7 % Treffer, Figur sitzt dort bei (30,10)). Die Ebene „Ebene #645“ enthält nur diese Figur.
Quelle vollständig; die Karte zeigt rundherum Schachbrett und Mauer. Schwarze Schwester: queen_of_kings_b.py.

Aufruf:   python3 queen_of_kings_w.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/queen-of-kings-w.png + .json

Was im Sprite ist (x, y im 16×32-Sprite):
* KRONE (Gold! y 0–4): zackige Krone aus Orange (230,131,16), Gold (255,222,90) und Hellgold (255,246,172); Zacken links (1–2,1), rechts (13–14,1), Mitte oben (7–8,0).
  In der Kronenmitte ein grüner EDELSTEIN aus zwei Facetten (41,123,0) bei (7,3) und (24,65,0) bei (8,3).
* KOPF (x 4–12, y 5–10): hellgrauer Kopf (Rampe 128 < 179 < 204 < 230 < 255) mit schwarzem Umriss; zwei Augen je 2×2 px bei (5–6, 8–9) und (9–10, 8–9): hellblauer Glanzpunkt (172,213,255)/(246,246,246) und grüne Pupille (24,65,0)/(41,123,0).
* HALS (x 6–9, y 12–16): schlanker Schaft, einheitliche Zeilen.
* KÖRPER/SOCKEL (y 17–31): kegelförmiger Rock mit schwarzen Zierbändern (y 21, 27–28), Fuß mit Umriss y 31.
Metall/Gold/Edelstein: nur Krone + Edelstein glänzen (Regel 14). Stein (Kopf/Körper) nicht. Keine Partikel, kein Feuer.

Ablauf (48 Frames à 70 ms = 3,36 s, nahtlos):
* Heben (Periode 24, zwei Hübe je Schleife): Kopf und Krone steigen 1 px (die einheitliche Halszeile 14 wird eingefügt), der Sockel bleibt am Boden.
* Lichtband (Frames 4–15): Gold der Krone eine Stufe heller, wandert diagonal von links nach rechts.
* Glitzersterne an den Kronenspitzen (Frames 6–10 links, 20–24 rechts, 34–38 Mitte): wachsen Mitte → 1 px → 2 px und schrumpfen zurück; sie sitzen am Gold und steigen mit der Krone.
* Edelstein: die beiden Facetten tauschen drei Frames lang die Plätze (Frames 10–12, 28–30, 44–46).
* Blinzeln (Frames 16–17, 40–41): alle Augenpixel nehmen die Gesichtsfarbe (204,204,204) an.
Frame 0 = Original (Ruhepose). Ergänzungen: keine.
"""
import sys

import anim_humanoide as Hm
import anim_lib as L
import anim_schach as Sc

SLUG, KARTE = 'queen-of-kings-w', 'Queen of Kings [W]'
spr = L.lade(SLUG)
A = Sc.Dame(spr, hub_per=24, band=4, sterne=((6, (1, 1)), (20, (14, 1)), (34, (8, 0))), gem=(10, 28, 44), blink=(16, 40))
N, MS, OFF = A.N, A.MS, A.OFF
frame = A.frame
TEST_EBENEN = ('koerper',)          # Randpixel-Test (randtest.py) ohne die Glitzersterne (Zusatzpixel in Hellgold)

if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    Sc.lauf('queen_of_kings_w', KARTE, frames, MS, prev, spr, OFF)
