# -*- coding: utf-8 -*-
"""Idle-Animation für „Thebinxan War Counselor“ (Creature) — die geflügelte Sphinx-Kriegerin: Stahlhelm mit rotem Busch, graue Federflügel, langes braunes Haar/Mähne, türkis-goldene Augen.

Quelle: src/thebinxan-war-counselor.png (26×27 px, 30 Farben, 432 Pixel).
PICK: [["MotiveSteamDwarfs", 384, 1]]      (Ebene „Thebinxan“, ganze Ebene = eine Figur, 26×27 px; nur in dieser Karte)
Abgleich mit der Kartenkunst Thebinxan_War_Counselor.png (76×51): Sprite sitzt dort 100 % pixelgleich. Auf der Karte stehen außerdem Steinmauer und Wasser (Hintergrund) — nichts davon gehört zur Figur.

Aufruf:   python3 thebinxan_war_counselor.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/thebinxan-war-counselor.png + .json

Was im Sprite ist (x, y im 26×27-Sprite):
* HELMBUSCH (x 10–15, y 0–5): rote Federn (156,0,0)/(214,0,0)/(255,0,0), Basis y 6.
* STAHLHELM (x 8–18, y 6–12): Metall (66,66,66)/(76,74,93)/(112,112,112)/(194,194,194), schwarzer Rand (0,0,0).
* GESICHT (x 9–16, y 12–16): helle Haut (246,205,139)/(255,230,213)/(246,189,152); AUGEN: je ein türkiser Pixel (0,251,255) bei (10,13) und (15,13), je ein schwarzer Wimpernpixel bei (11,13) und (14,13),
  je ein weißer (246,255,255) bei (10,14) und (15,14) und je ein goldener (207,179,0) bei (11,14) und (14,14); rosa Wangen (255,152,153) bei (10,15) und (15,15).
* FLÜGEL (links x 0–8, rechts x 17–25, y 1–20): grau-weiße Federn (154,155,152)/(184,186,183)/(213,215,212)/(243,245,242) mit grauem Umriss (99,99,97); sie wachsen hinter den Schultern heraus.
* HAAR/MÄHNE (x 7–18, y 12–25): lange braune Strähnen (49,24,0)/(106,32,0)/(164,98,41)/(180,123,49)/(189,131,57)/(139,82,16), die das Gesicht rahmen und bis zu den Beinen fallen.
* WEISSE BALKEN (x 3–10 und 15–22, y 21–22): weiße Streifen (218,218,206)/(246,246,246) unter den Flügelspitzen — nicht eindeutig gedeutet (Flügelsaum oder Ärmel); bleiben fest am Körper.
* BEINE (y 23–26): zwei kurze Beine mit Haut (246,189,123)/(213,164,98)/(180,123,49), Umriss (49,24,0).
Metall im Sprite: nur der Stahlhelm. Nur er glänzt (Regel 14); Federn, Haar, Haut nicht. Kein Feuer, kein Dampf, keine Partikel.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* Auf und ab (Periode 24 = zweimal pro Schleife): die Haarzeile 19 wird einmal doppelt eingefügt (Texturmischung): Kopf, Helm, Gesicht, Haare und beide Flügel steigen 1 px, Balken, Beine und Füße bleiben unten.
  Die Flügel sind eigene Ebenen und steigen starr mit; der Kopf bleibt starr (kein seitliches Neigen).
* Flügel öffnen und schließen sich (Periode 24, zweimal pro Schleife): jede Federzeile wandert um die Schulter (Gelenk y 20) waagerecht nach außen, die Spitze bis 3 px, nach unten auslaufend (Gefälle < 0,2 px je Zeile,
  K.scheren: wie L.zeilen_welle, aber die dünne Federspitze übernimmt den Versatz der Zeile darunter, falls sie sonst nur diagonal anläge); die Federn selbst bleiben unverändert (keine Spaltenkopie), die Flügel hängen unten an der Schulter.
* Helmbusch wiegt (Zeilen 0–5): zwei Wellen (3 s und 1 s) bis ±2 px an der Spitze, nach unten auslaufend (Gefälle ≤ 1 px je Zeile).
* Blinzeln (Frames 19–21 und 41–43): zuerst nehmen die türkisen Pixel, dann auch die weißen und goldenen Augenpixel die Hautfarbe (246,205,139) an (Lid = Haut, schwarze Wimpernpixel bleiben als Lidlinie); kein Glanzpunkt.
* Metall glänzt (Regel 14): ein Lichtband läuft zweimal über den Helm (Frames 4–11 und 28–35), dazu ein Glitzerstern auf dem Helm (Frames 12–15 und 36–39).
* Fußtippen: der linke Fuß hebt sich 1 px hinter das Bein (Frames 10–17), später der rechte (Frames 34–41).
Frame 0 = Original (Ruhepose). Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Ergänzungen: keine (nichts Verdecktes wird freigelegt; Beine liegen beim Heben hinter dem Haar; geöffnete Flügel bekommen an der Naht zum Helm ihren Umriss (99,99,97) aus der Kontur-Schließung, Regel 16).
"""
import math
import sys

import numpy as np

import anim_humanoide as Hm
import anim_krieger as K
import anim_lib as L

N, MS = 48, 62
sz = K.Szene('thebinxan-war-counselor', (6, 4, 6, 2))        # Flügel öffnen bis 3 px, Busch ±2 px, Wippen 1 px
spr, OFF, H, W = sz.spr, sz.OFF, sz.H, sz.W
PT, PL = sz.pt, sz.pl
TEST_EBENEN = ('figur',)

FED = {(154, 155, 152), (184, 186, 183), (213, 215, 212), (243, 245, 242), (99, 99, 97)}
HELM_R = [(66, 66, 66), (76, 74, 93), (112, 112, 112), (194, 194, 194), (213, 215, 212), (243, 245, 242)]
HAUT = sz.f(12, 13)                                              # (246,205,139)
AUGE_OBEN = {(10, 13): HAUT, (15, 13): HAUT}
AUGE_ALLES = {(10, 13): HAUT, (15, 13): HAUT, (10, 14): HAUT, (15, 14): HAUT, (11, 14): HAUT, (14, 14): HAUT}
WEISS = (243, 245, 242)

m_fl = sz.farben_in(sz.rechteck(0, 1, 7, 20), FED)
m_fr = sz.farben_in(sz.rechteck(18, 1, 25, 20), FED)
rest = sz.vor & ~m_fl & ~m_fr
fuss_l = rest & (sz.yy >= 25) & (sz.xx <= 12)
fuss_r = rest & (sz.yy >= 25) & (sz.xx >= 13)
koerper = rest & ~fuss_l & ~fuss_r
m_helm = sz.farben_in(sz.rechteck(8, 7, 18, 12), set(HELM_R))


def frame(i, nur=None):
    ebenen = nur if nur is not None else ('figur', 'glitzer')
    k = sz.ebene(koerper)
    # --- Blinzeln ---
    lid = Hm.folge(i, 19, [1, 2, 1], N) or Hm.folge(i, 41, [1, 2, 1], N)
    if lid:
        K.blinzeln(k, OFF, AUGE_OBEN if lid == 1 else AUGE_ALLES)
    # --- Helm glänzt ---
    for start in (4, 28):
        Hm.lichtband(k, m_helm, OFF, i, N, start, 8, HELM_R, stufen=1, breite=2.4, achse=(1.0, 0.6), kern=2)
    # --- Helmbusch wiegt ---
    d = int(round(1.4 * np.sin(2 * np.pi * i / N) + 0.8 * np.sin(2 * np.pi * 3 * i / N)))
    Hm.zeilen_versatz(k, OFF, K.gefaelle(list(range(0, 6)), d))
    # --- Flügel öffnen/schließen ---
    off = 1.5 * (1 - math.cos(2 * math.pi * i / 24))            # 0 … 3 px an der Spitze
    wl = K.scheren(sz.ebene(m_fl), PT + 20, -off)
    wr = K.scheren(sz.ebene(m_fr), PT + 20, off)
    # --- Auf und ab: Haarzeile 19 doppelt, Flügel starr mit ---
    brust = Hm.stufe(i, N / 2, 1)
    k = K.bob(k, PT + 19, brust)
    wl, wr = L.versetze(wl, 0, -brust), L.versetze(wr, 0, -brust)
    # --- Fußtippen ---
    ul = 1 if K.fenster(i, N, 10, 8) is not None else 0
    ur = 1 if K.fenster(i, N, 34, 8) is not None else 0
    fl, fr = sz.ebene(fuss_l, 0, -ul), sz.ebene(fuss_r, 0, -ur)
    fig = L.zusammen(H, W, [(fl, 0, 0), (fr, 0, 0), (wl, 0, 0), (wr, 0, 0), (k, 0, 0)])
    K.kontur(fig, sz.ERLAUBT, lambda c, x, y: (156, 0, 0) if (c[1] == 0 and c[2] == 0 and c[0] > 0)
             else (99, 99, 97) if (x < 9 + PL or x > 16 + PL) and y < 21 + PT else (49, 24, 0) if y > 11 + PT else (0, 0, 0))   # Regel 16
    out = fig if 'figur' in ebenen else sz.leer()
    if 'glitzer' in ebenen:
        gl = sz.leer()
        st = Hm.folge(i, 12, [0, 1, 1, 0], N)
        if st is None:
            st = Hm.folge(i, 36, [0, 1, 1, 0], N)
        Hm.stern4(gl, 14, 9 - brust, st, WEISS, (213, 215, 212), (184, 186, 183), OFF)
        out = L.zusammen(H, W, [(out, 0, 0), (gl, 0, 0)])
    return out


if __name__ == '__main__':
    K.abschluss(sz, frame, N, MS, 'Thebinxan War Counselor', 'thebinxan-war-counselor', K.vorschau_pfad())
