# -*- coding: utf-8 -*-
"""Idle-Animation für „Knight of Kings [W]“ (Creature) — der weiße Geisterritter mit Kapuzenhelm, der ein langes Schwert vorstreckt.

Quelle: src/knight-of-kings-w.png (28×21 px, 6 Farben: Schwarz, Weiß, Grautöne 153/179/204/230).
PICK: [["Motive", 639, 6]]      (Ebene „Chess“, Figur 6 = Ritter samt Schwert und Glitzersternen; Figur an (211,236) der Ebene, 28×21 px)
Die Ebene „Ebene #102“ (655) enthält denselben Ritter ohne Glitzer, mit etwas anders gezeichnetem Schwert; die Karte (Knight_of_Kings_1.png) stimmt zu 91 % mit der Ebene „Chess“ (639) überein
(Figur sitzt dort bei (19,17)), also mit den Glitzersternen. Quelle war vollständig (nichts abgeschnitten): rundherum auf der Ebene liegt nur die Kunst (Schachfelder, Mauer, Büsche).
Zugehörige schwarze Schwester: knight_of_kings_b.py (gleiche Figur, Grauwerte abgedunkelt).

Aufruf:   python3 knight_of_kings_w.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/knight-of-kings-w.png + .json

Was im Sprite ist (x, y im 28×21-Sprite):
* KAPUZENHELM/KOPF (x 14–27, y 0–11): runder heller Helm mit Umriss, zwei schwarze Augenschlitze (je 1×2 px) bei (20,5–6) und (22,5–6).
* RUMPF/ARM (x 14–27, y 7–16): hellgrauer Körper, vorgestreckter rechter Arm (x 19–24, y 12–14), die Hand hält das Schwert bei x 19.
* SCHWERT (Metall!, x 3–19, y 12–14): schwarzer Umriss oben (y 12) und unten (y 14), Klinge y 13 (x 7–18; hell an der Spitze, nach der Hand hin dunkler), schwarze Spitzenkappe (5–6,13) und (3–4,12).
* GLITZER (weiß, zur Klinge gehörend): großes hohles Kreuz (x 0–4, y 9–13; Mitte (2,11) frei) an der Schwertspitze, oben eine Raute ohne Spitze (10,10),(12,10),(11,11) und unten eine hohle Raute (11,16),(10,17),(12,17),(11,18).
* BEINE/STIEFEL (y 17–20): zwei Stiefel (x 17–21 und 23–27) mit weißem Streifen und schwarzer Sohle.
Metall = nur das Schwert (Regel 14: Lichtband + Glitzer). Der Stoff/Helm glänzt nicht. Kein Feuer, keine Partikel.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* Atmen (Periode 24): die Hüftzeile 16 wird bis zu 2× eingefügt (Texturmischung, anim_lib.streck_zeile): Oberkörper, Kopf und Arm steigen bis 2 px, die Stiefel bleiben am Boden.
* Schwertwippen (Periode 48): die Schwertspitze hebt/senkt sich bis ±2 px um die Hand (starres Kippen, Spaltenversatz mit Gefälle ≤ 1 px je Spalte); das Schwert steigt mit dem Oberkörper; die Glitzer folgen.
* Lichtband (Frames 8–21): Metallglanz wandert von der Spitze zur Hand über die Klinge (2 Stufen heller auf der Farbrampe der Klinge).
* Glitzer: das Kreuz an der Spitze schrumpft zweimal je Schleife (Frames 4 und 28) zum kleinen Kreuz (Mitte + 4 Arme), verschwindet kurz und wächst zurück (nie ein einzelner Punkt); die beiden Rauten funkeln versetzt (Frames 12 / 20 / 40).
* Blinzeln (Frames 14–15, 38–39): beide Augenschlitze nehmen die Farbe der Gesichtspixel daneben an (Lid = Körperfarbe).
* Fußtippen: linker Stiefel (Frames 18–23) und rechter (Frames 36–41) heben sich je zweimal 1 px hinter den Saum.
* Kein Kopfwiegen seitlich (Regel 17), kein Schweben (Regel 18): die Stiefel stehen fest.
Frame 0 = Original (Ruhepose). Ergänzungen: keine (Stiefel liegen beim Heben hinter dem Saum, Glitzer sitzen vor leerem Grund).
"""
import sys

import anim_humanoide as Hm
import anim_lib as L
import anim_schach as Sc

SLUG, KARTE = 'knight-of-kings-w', 'Knight of Kings [W]'
spr = L.lade(SLUG)
RAMPE = Sc.rampe_aus(spr, [(153, 153, 153), (179, 179, 179), (204, 204, 204), (230, 230, 230), (255, 255, 255)])
A = Sc.Ritter(spr, rampe=RAMPE)
N, MS, OFF = A.N, A.MS, A.OFF
frame = A.frame

if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    Sc.lauf('knight_of_kings_w', KARTE, frames, MS, prev, spr, OFF)
