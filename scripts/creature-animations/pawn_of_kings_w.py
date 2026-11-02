# -*- coding: utf-8 -*-
"""Idle-Animation für „Pawn of Kings [W]“ (Creature) — der weiße Bauer: ein Mann mit braunem Haarschopf im weißen Gewand, der eine Heugabel hält.

Quelle: src/pawn-of-kings-w.png (14×13 px, 15 Farben).
PICK: [["Motive", 639, 4]]      (Ebene „Chess“, Figur 4; dieselbe Figur liegt pixelgleich in den Ebenen 645, 648, 649, 655 (Figuren 9/9/11/1/4))
Karte (Pawn_of_Kings_1.png): Der Sprite sitzt dort zu 100 % pixelgleich an (48,4), (32,20), (16,36) (und weiteren) — die Karte zeigt mehrere Bauern auf dem Schachbrett; animiert wird genau ein Exemplar.
Quelle vollständig: Rundum liegen nur weitere Bauern, Läufer (Bishop) und Springer der Ebene. Schwarze Schwester: pawn_of_kings_b.py.

Aufruf:   python3 pawn_of_kings_w.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/pawn-of-kings-w.png + .json

Was im Sprite ist (x, y im 14×13-Sprite):
* HAARSCHOPF/KOPF (x 3–8, y 1–7): rotbrauner Haarschopf (Rampe (49,24,0) < (90,32,0) < (123,41,16) < (164,74,41)), darunter ein heller Streifen (Gesicht/Hals) bei (5–6, 4–7), schwarzer Umriss.
* GEWAND (x 0–10, y 8–11): weißer Rock in Grautönen (153/179/204/230/255), breiter Sockel mit schwarzer Sohle (y 12).
* ARM/HAND (x 8–12, y 7): Arm mit schwarzem Umriss zur Heugabel, die Hand (weiß) bei (11,7).
* HEUGABEL (x 9–13, y 0–11): drei Zinken (9,0–2), (11,0–2), (13,0–2), Querbalken (10–12, 3), Schaft x 11 von y 4 bis 11 (braunes Holz (94,63,34)/(77,50,33)/(45,30,25)/(26,14,0)).
Kein Metall, kein Gold, keine Edelsteine, keine Augen sichtbar → kein Glanz (Regel 14), kein Blinzeln (Regel 21), keine Partikel.

Ablauf (48 Frames à 70 ms = 3,36 s, nahtlos):
* Atmen (Periode 24): Zeile 8 wird einmal eingefügt (Texturmischung): Kopf und Hand steigen 1 px, die Gabel rutscht in der Hand mit nach oben (der Schaft unten bleibt, er verlängert sich nur um die eingefügte Schaftzeile), der Sockel bleibt am Boden.
* Gabelspitze kippt: die Zinken samt Querbalken (Zeilen 0–3) neigen sich 1 px nach rechts (Frames 6–14, kurz 44–46) und 1 px nach links (Frames 30–38, kurz 22–24) — der Querbalken bleibt über dem Schaft (4er-Kontakt).
Frame 0 = Original (Ruhepose). Ergänzungen: keine.
"""
import sys

import anim_humanoide as Hm
import anim_lib as L
import anim_schach as Sc

SLUG, KARTE = 'pawn-of-kings-w', 'Pawn of Kings [W]'
spr = L.lade(SLUG)
A = Sc.Bauer(spr, atem_per=24, kipp=((6, 1, 9), (22, -1, 3), (30, -1, 9), (44, 1, 3)))
N, MS, OFF = A.N, A.MS, A.OFF
frame = A.frame

if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    Sc.lauf('pawn_of_kings_w', KARTE, frames, MS, prev, spr, OFF)
