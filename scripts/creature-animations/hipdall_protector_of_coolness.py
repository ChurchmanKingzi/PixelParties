# -*- coding: utf-8 -*-
"""Idle-Animation für „Hipdall, Protector of Coolness“ (Creature) — der Wächter mit Stahlhelm, der in ein goldenes Horn (Gjallarhorn) bläst.

Quelle: src/hipdall-protector-of-coolness.png (22×26 px, 35 Farben).
PICK: [["MotiveCoolhalla", 204, 2]]      (Ebene „Ebene #63“ (xcf-Ebene 204), Figur 2; die Figur 1 derselben Ebene sind die Zielflaggen (Beiwerk, nicht Teil der Creature);
                                          Ebene 19 „#194“ zeigt dieselbe Figur ohne Horn neben einer Jetpack-Figur und bleibt ungenutzt)
Abgleich mit der Kartenkunst Hipdall_Protector_of_Coolness.png (76×51): Helm, Gesicht, Horn und Jacke liegen dort an derselben Stelle; Fackeln, Flaggen und Regenbogen sind Kulisse. Die Quelle war vollständig.

Aufruf:   python3 hipdall_protector_of_coolness.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/hipdall-protector-of-coolness.png + .json

Was im Sprite ist (x, y im 22×26-Sprite):
* HELM (x 10–21, y 0–8): grauer Stahlhelm mit breiter Krempe — Rampe B (51,51,56) < V (106,107,119) < I (140,142,153) < N (192,195,204) < T (213,215,227), Krempenspitzen S (189,189,189);
  dunkler Schatten unter der Krempe (24,23,25)/(32,35,44)/(41,50,66) bei (13–17, 7).  → METALL: Lichtband + Glitzerstern.
* GESICHT (x 12–19, y 8–12): Haut (246,189,123)/(246,205,139), ein sichtbares AUGE bei (15–16, 9–10): dunkelrotes Lid (98,14,14), rote Iris (169,38,38), weißer Glanzpunkt (247,247,247)/(184,183,184);
  das andere Auge und der Mund liegen hinter dem Horn. Nur dieses eine Auge blinzelt (Lid = Hautfarbe, Regel 21).
* HORN (x 0–14, y 0–12): goldenes Horn, Trichter links oben mit schwarzer Öffnung (0,0,0) und Rand C (91,79,22), Körper F (169,146,40)/H (230,232,109)/U (245,252,211), Mundstück bei (12–14, 10–12).  → GOLD: Lichtband + Stern.
* HAND (x 10–11, y 11–12) in Haut (213,164,98)/(246,189,123) mit braunem Umriss (49,24,0) — hält das Horn von unten; die andere Hand liegt hinter dem Horn.
* JACKE (x 8–20, y 13–18): dunkelblau (21,57,107)/(14,38,72)/(8,24,47)/(6,17,32); HOSE (y 18–22) grau (100,100,100)/(164,163,163)/(176,175,175); STIEFEL (y 23–25) schwarz mit blauem Besatz.
Kein Feuer, keine Partikel (Fackeln der Kunst sind Kulisse).

Ablauf (48 Frames à 70 ms = 3,36 s, nahtlos):
* ATMEN (einmal je Schleife): die Jackenzeile 16 wird 0–2× eingefügt (Texturmischung, anim_lib.streck_zeile): Brust, Arme, Kopf und Horn heben sich starr bis 2 px, Hose und Stiefel bleiben am Boden.
  (Eine zweite Einfügung an der Kragenzeile 13 für ein Nachlaufen des Kopfes machte das braune Ärmelband zu dick und entfiel.)
* HORN-STOSS (zweimal je Schleife, Frames 4 und 28): ein Lichtband läuft vom Mundstück zum Trichter (Gold, Regel 12) und drei goldene Wölkchen (2×2, Kern (230,232,109), Rand (169,146,40))
  steigen aus der schwarzen Trichteröffnung nach links oben auf (Schallstoß; Überstand höchstens 3 px). Das Horn selbst wird nicht verschoben (Kippen des Trichters zerriss den Umriss).
* BLINZELN des einen sichtbaren Auges (Frames 11–13 und 35–37).
* GLANZ (Regel 12/14): Lichtband über den Stahlhelm (Frames 18–27) mit Stern auf der Helmwölbung bei (13,3) (Frames 21–24); Stern am goldenen Trichter bei (5,9) (Frames 14–17 und 38–41).
Frame 0 = Original (Ruhepose). Kontrolle: Hm.ruhepose / Eckkontakte / randtest. Alle Bewegungen laufen auf der vollen Leinwand; nur Farben der Quelle.
Ergänzungen: keine (unter dem Trichter liegt nichts Verdecktes).
"""
import sys

import numpy as np

import anim_cool as C
import anim_humanoide as Hm
import anim_lib as L
import anim_textur as TX   # texturierte Streckzeilen statt Zeilenkopien (Regel 43/49)
TX.umleiten()               # auch Streckaufrufe innerhalb der Gruppenmodule liefern texturierte Zeilen

N, MS = 48, 70
PAD_L, PAD_R, PAD_T, PAD_B = 6, 6, 9, 3

spr = L.lade('hipdall-protector-of-coolness')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
f = lambda x, y: C.farbe(spr, x, y)

ERLAUBT = Hm.umrissfarben(spr)
STAHL = [(51, 51, 56), (106, 107, 119), (140, 142, 153), (192, 195, 204), (213, 215, 227)]
GOLD = [(91, 79, 22), (169, 146, 40), (230, 232, 109), (245, 252, 211)]
HELM_M = C.maske_farben(spr, STAHL + [(189, 189, 189)], region=(10, 0, 21, 8))
HORN_M = C.maske_farben(spr, GOLD, region=(0, 0, 14, 12))
LID_O, LID_U = f(13, 9), f(17, 9)                                    # Hautfarben (246,205,139) / (246,189,123)
AUGE = {(15, 9): LID_O, (16, 9): LID_O, (15, 10): LID_U, (16, 10): LID_U}
WEISS, SS = f(16, 10), f(14, 1)                                      # (247,247,247), Helmglanz (213,215,227)
UH, UU = f(7, 7), f(8, 7)                                            # Gold hell (230,232,109) / (245,252,211)
WOLKE = {'c': UH, 'r': f(5, 9)}                                     # 2×2: Kern (230,232,109), Rand (169,146,40)
TUETEN = [4, 28]                                                     # Start der beiden Horn-Stöße
WOLKEN = []
for s0 in TUETEN:
    WOLKEN += [dict(s=s0 + 2, L=12, x0=4, y0=5, x1=-1, y1=1, gross=(2, 3)), dict(s=s0 + 4, L=12, x0=3, y0=3, x1=-1, y1=-1, wackeln=0.6, gross=(2, 3)),
               dict(s=s0 + 6, L=12, x0=5, y0=2, x1=1, y1=-2, wackeln=-0.6, gross=(2, 3))]
TEST_EBENEN = 'koerper'


def frame(i, nur=None):
    k = L.platz(spr, H, W, PAD_L, PAD_T)
    # --- Glanz auf Helm und Horn (Metall/Gold) ---
    for s0 in TUETEN:
        C.glanz(k, OFF, i, N, HORN_M, GOLD, start=s0, dauer=10, stufen=1, breite=2.6, achse=(-1.0, -1.0), kern=2)
    C.glanz(k, OFF, i, N, HELM_M, STAHL, start=18, dauer=10, stufen=1, breite=2.6, kern=2)
    C.funkel(k, OFF, i, 13, 3, 21, [0, 1, 1, 0], WEISS, SS, N)
    C.funkel(k, OFF, i, 5, 9, 12, [0, 1, 1, 0], UU, UH, N)
    C.funkel(k, OFF, i, 5, 9, 36, [0, 1, 1, 0], UU, UH, N)
    # --- Blinzeln (nur das eine sichtbare Auge) ---
    if Hm.folge(i, 11, [1, 1, 1], N) or Hm.folge(i, 35, [1, 1, 1], N):
        Hm.setze(k, AUGE, OFF)
    # --- Atmen: Jackenzeile 16 (Brust, Arme, Kopf und Horn steigen starr mit) ---
    n1 = Hm.stufe(i, N, 2)
    k = TX.atmen(k, PAD_T + 16, PAD_T + 13, n1, 0)
    if nur == 'koerper':
        return k
    return L.zusammen(H, W, [(k, 0, 0), (C.wolken(H, W, i, N, WOLKEN, WOLKE, OFF), 0, 0)])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    C.abschluss('hipdall-protector-of-coolness', 'Hipdall, Protector of Coolness', frames, MS, spr, OFF, C.vorschau_arg())
