# -*- coding: utf-8 -*-
"""Idle-Animation für „Knight of Kings [B]“ (Creature) — der schwarze (dunkelgraue) Geisterritter mit Kapuzenhelm und vorgestrecktem Schwert.

Quelle: src/knight-of-kings-b.png (28×21 px, 7 Farben: Schwarz, Grautöne 26/51/77/102/128, Weiß nur für die Glitzer).
PICK: [["Motive", 639, 6]]      (Ebene „Chess“, Figur 6 = der WEISSE Ritter; für [B] gibt es keinen eigenen Ebenen-Treffer)
Wie beim Bishop of Kings [B] entsteht der Sprite aus der weißen Ebenenfigur mit der Farbtabelle der Karte (Knight_of_Kings.png): Die Grauwerte der Figur sind um 127,5 abgedunkelt
(255→128, 230→102, 204→77, 179→51, 153→26), Schwarz bleibt. Die Tabelle stammt aus dem Median der Kartenpixel je Quellfarbe (Streuung ≤ 4,4; bei 255 mit den Glitzern gemischt). Die Glitzer-Sterne
(weiße Pixel: Kreuz an der Schwertspitze x 0–4 und die beiden Rauten) bleiben auf der Karte WEISS (254/255) und bleiben es auch im Sprite.
Quelle war vollständig; die Karte zeigt rundherum nur Schachbrett, Mauer und Büsche. Weiße Schwester: knight_of_kings_w.py (gleiche Figur, andere Zeitfenster/Perioden).

Aufruf:   python3 knight_of_kings_b.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/knight-of-kings-b.png + .json

Was im Sprite ist (x, y im 28×21-Sprite) — wie bei [W]:
* KAPUZENHELM/KOPF (x 14–27, y 0–11) mit zwei schwarzen Augenschlitzen (20,5–6) und (22,5–6); RUMPF/ARM (y 7–16), die Hand bei x 19 hält das Schwert.
* SCHWERT (Metall, x 3–19, y 12–14): schwarzer Umriss oben/unten, Klinge y 13 (x 7–18, hell an der Spitze → dunkler zur Hand).
* GLITZER (weiß): hohles Kreuz an der Spitze (x 0–4, y 9–13), Raute ohne Spitze (10,10),(12,10),(11,11), hohle Raute (11,16),(10,17),(12,17),(11,18).
* STIEFEL (y 17–20): zwei Stiefel (x 17–21, 23–27).
Metall = nur das Schwert (Regel 14); Stoff/Helm glänzt nicht.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos) — eigene Zeitfenster, damit [B] nicht im Gleichschritt mit [W] läuft:
* Atmen (Periode 16, also 3 Atemzüge je Schleife; schwerer als [W]): Hüftzeile 16 bis 2× eingefügt, Oberkörper/Kopf/Arm steigen bis 2 px, Stiefel bleiben.
* Schwertwippen (Periode 48, gegenläufig zu [W]: erst nach oben): Spitze ±2 px um die Hand.
* Lichtband über die Klinge (Frames 26–39), Glitzer-Kreuz schrumpft bei Frame 16 und 40, Rauten bei 30 / 8 / 32.
* Blinzeln (Frames 6–7, 30–31), Fußtippen links (Frames 26–31), rechts (Frames 10–15).
Frame 0 = Original (Ruhepose). Ergänzungen: keine.
"""
import sys

import anim_humanoide as Hm
import anim_lib as L
import anim_schach as Sc

SLUG, KARTE = 'knight-of-kings-b', 'Knight of Kings [B]'
spr = L.lade(SLUG)
RAMPE = Sc.rampe_aus(spr, [(26, 26, 26), (51, 51, 51), (77, 77, 77), (102, 102, 102), (128, 128, 128)])
A = Sc.Ritter(spr, brust_per=16, kipp_zyklen=1, kipp_vz=-1, blink=(6, 30), band=26, g_plus=(16, 40), g_ring1=30, g_ring2=(8, 32),
              tap_l=26, tap_r=10, rampe=RAMPE)
N, MS, OFF = A.N, A.MS, A.OFF
frame = A.frame

if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    Sc.lauf('knight_of_kings_b', KARTE, frames, MS, prev, spr, OFF)
