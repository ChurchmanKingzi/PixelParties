# -*- coding: utf-8 -*-
"""Idle-Animation für „Pawn of Kings [B]“ (Creature) — der schwarze Bauer: Mann mit rotbraunem Haarschopf im dunkelgrauen Gewand und Heugabel.

Quelle: src/pawn-of-kings-b.png (14×13 px, 15 Farben).
PICK: [["Motive", 639, 4]]      (Ebene „Chess“, Figur 4 = der WEISSE Bauer; für [B] gibt es keinen eigenen Ebenen-Treffer)
Wie beim Bishop of Kings [B] entsteht der Sprite aus der weißen Ebenenfigur mit der Farbtabelle der Karte (Pawn_of_Kings.png, Median je Quellfarbe über drei Bauern, Streuung ≤ 3,7):
Grauwerte 255→128, 230→102, 204→77, 179→51, 153→26; Haar-/Holzbraun, Schwarz und alle anderen Töne bleiben unverändert (die Karte zeigt sie unverändert, ±4).
Quelle vollständig. Weiße Schwester: pawn_of_kings_w.py (gleiche Figur, andere Zeitfenster).

Aufruf:   python3 pawn_of_kings_b.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/pawn-of-kings-b.png + .json

Was im Sprite ist (x, y im 14×13-Sprite) — wie bei [W]:
* HAARSCHOPF/KOPF (x 3–8, y 1–7), heller Streifen (Gesicht/Hals) bei (5–6, 4–7); GEWAND (x 0–10, y 8–11) in Dunkelgrau (26/51/77/102/128), Sockel mit schwarzer Sohle (y 12).
* ARM/HAND (x 8–12, y 7), HEUGABEL: Zinken (9/11/13, 0–2), Querbalken (10–12, 3), Schaft x 11 (y 4–11), Holzbraun.
Kein Metall/Gold/Edelstein → kein Glanz; keine Augen sichtbar → kein Blinzeln; keine Partikel.

Ablauf (48 Frames à 70 ms, nahtlos) — eigene Zeitfenster gegenüber [W]:
* Atmen (Periode 16, drei Atemzüge je Schleife): Zeile 8 einmal eingefügt; Kopf und Hand steigen 1 px, die Gabel rutscht mit, der Sockel bleibt.
* Gabelspitze kippt: 1 px nach links (Frames 2–9, kurz 36–38) und nach rechts (Frames 18–25, kurz 28–30) — Querbalken bleibt über dem Schaft.
Frame 0 = Original (Ruhepose). Ergänzungen: keine.
"""
import sys

import anim_humanoide as Hm
import anim_lib as L
import anim_textur as TX   # texturierte Streckzeilen statt Zeilenkopien (Regel 43/49)
TX.umleiten()               # auch Streckaufrufe innerhalb der Gruppenmodule liefern texturierte Zeilen
import anim_schach as Sc

SLUG, KARTE = 'pawn-of-kings-b', 'Pawn of Kings [B]'
spr = L.lade(SLUG)
A = Sc.Bauer(spr, atem_per=16, atem_vz=0.0, kipp=((2, -1, 8), (18, 1, 8), (28, 1, 3), (36, -1, 3)))
N, MS, OFF = A.N, A.MS, A.OFF
frame = A.frame

if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    Sc.lauf('pawn_of_kings_b', KARTE, frames, MS, prev, spr, OFF)
