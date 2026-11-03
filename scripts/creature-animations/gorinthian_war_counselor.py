# -*- coding: utf-8 -*-
"""Idle-Animation für „Gorinthian War Counselor“ (Creature) — die Gorgone: Kopf voller grüner Schlangen, gelb-weiße Augen, grüne Arme, die einen weißen Rundschild halten.

Quelle: src/gorinthian-war-counselor.png (18×28 px, 20 Farben, 342 Pixel).
PICK: [["MotiveSteamDwarfs", 333, 1]]      (Ebene „Ebene #69“, Figur 1, 18×28 px; nur in dieser Karte)
Abgleich mit der Kartenkunst Gorinthian_War_Counselor.png (76×51): Sprite sitzt dort 99,7 % pixelgleich. Die drei grauen Steinfiguren links im Bild (Ebenen 319, 322, 332 — versteinertes Opfer,
je eine eigene Ebene) sowie Baum und Felswand gehören NICHT zur Gorgone und bleiben unberührt (Beiwerk der Szene). Die anderen War Counselors sind eigene Karten.

Aufruf:   python3 gorinthian_war_counselor.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/gorinthian-war-counselor.png + .json

Was im Sprite ist (x, y im 18×28-Sprite):
* SCHLANGENHAAR (x 0–17, y 0–9): dunkelgrüne Masse (0,26,0)/(0,71,0)/(0,102,0) mit hellgrünen Schlangenleibern (0,122,0)/(0,164,0)/(32,156,0); sechs einzelne gelbe Pixel (255,255,0) sind die AUGEN der Schlangen
  bei (9,1), (4,2), (11,2), (14,2), (16,4), (1,6).
* GESICHT (x 4–13, y 10–14): grüne Haut (0,122,0)/(0,102,0)/(0,164,0), dunkelgraue Lider/Brauen (57,59,59) bei y 10–11, zwei Augen: weiß (246,255,255) + gelb (255,255,0) bei (6–7, 12) und (10–11, 12),
  darüber ein hellgrauer (180,187,187) bzw. olivfarbener (162,162,0) Lidpixel bei (6,11) und (11,11); Nase/Mund nicht gezeichnet.
* HALS/SCHULTERN (x 6–11, y 13–16): grün; ARME (x 1–4 und 13–16, y 16–21): grüne Arme, die den Schild umfassen.
* RUNDSCHILD (x 3–13, y 15–24): weiß/hellgrau (203,203,203)/(239,239,239)/(246,246,246)/(253,253,253) mit dunkelgrauem Rand (72,72,72), der linke Rand (x 3–4, y 21–25) ist ein heller Streifen (218,218,206)/(246,246,246)
  (Lichtkante des Schildes; als Schildrand gelesen, nicht als eigene Klinge).
* BEINE (y 25–27): zwei grüne Füße (0,122,0)/(0,164,0), schwarzgrüner Umriss.
Metall im Sprite: der Schild. Nur er glänzt (Regel 14, Lichtband, Rand-Funkeln); Haare/Haut/Schlangen nicht. Kein Feuer, kein Dampf, keine Partikel.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* Auf und ab (Periode 24 = zweimal pro Schleife): die Schildzeile 23 wird einmal doppelt eingefügt: Schlangenkopf, Gesicht, Arme und Schildoberteil steigen 1 px, die Füße bleiben am Boden; der Kopf bleibt dabei starr.
* Schlangen winden sich (Zeilen 0–8) DAUERND (Runde 3: vorher gab es eine lange Pause ohne Haarbewegung): zwei gegenläufige Wellen (3 bzw. 2 Läufe pro Schleife) überlagern sich, jede Zeile wandert
  höchstens ±2 px, benachbarte Zeilen unterscheiden sich um höchstens 1 px (Umriss wandert mit der Zeile); kein Fenster ohne Haarbewegung.
* Schlangenaugen blinzeln (je 2 Frames, versetzt: Frames 4, 12, 20, 28, 36, 44 für die sechs gelben Pixel): das gelbe Pixel wird dunkel (0,26,0) — nur ein Lid, kein Farbspiel.
* Gorgonenaugen blinzeln (Frames 15–17 und 39–41): erst senken sich die Lidpixel (Zeile 11 dunkelgrau), dann schließen sich die Augen (weiß/gelb → Hautgrün (0,122,0)), dann wieder erst Lid; keine Glanzpunkte.
* Schild glänzt (Regel 14): ein Lichtband läuft einmal diagonal über den Schild (Frames 6–17), später ein Funkeln am rechten Schildrand (Frames 32–35, Stern liegt auf dem Rand).
* Fußtippen: der linke Fuß hebt sich 1 px (Frames 10–17), später der rechte (Frames 34–41).
Frame 0 = Original (Ruhepose). Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Ergänzungen: keine (nichts Verdecktes wird freigelegt; die Füße liegen beim Heben hinter dem Bein).
"""
import math
import sys

import numpy as np

import anim_humanoide as Hm
import anim_krieger as K
import anim_lib as L

N, MS = 48, 62
sz = K.Szene('gorinthian-war-counselor', (4, 4, 4, 2))        # Haarwelle ±2 px, Wippen 1 px, Randabstand ≥ 2
spr, OFF, H, W = sz.spr, sz.OFF, sz.H, sz.W
PT = sz.pt
TEST_EBENEN = ('figur',)

UMRISS = (0, 26, 0)
HAUT = sz.f(8, 13)                                              # (0,122,0)
LID = sz.f(5, 10)                                               # (57,59,59) dunkelgraues Lid
SCHNAUZ = [(9, 1), (4, 2), (11, 2), (14, 2), (16, 4), (1, 6)]    # gelbe Schlangenaugen
SCHILD_R = [(72, 72, 72), (173, 173, 173), (203, 203, 203), (239, 239, 239), (246, 246, 246), (253, 253, 253)]
HELL = [(246, 246, 246), (253, 253, 253)]

fuss_l = sz.vor & (sz.yy >= 26) & (sz.xx <= 8)
fuss_r = sz.vor & (sz.yy >= 26) & (sz.xx >= 9)
koerper = sz.vor & ~fuss_l & ~fuss_r
m_schild = sz.farben_in(sz.rechteck(3, 15, 13, 24), set(SCHILD_R))


def _haar_roh(y, i):
    """Zwei gegenläufige Wellen durch das Schlangenhaar (3 bzw. 2 Läufe pro Schleife) — immer in Bewegung, nie eine Ruhephase."""
    a = 0.95 * math.sin(2 * math.pi * (y / 6.5 - 3 * i / N))
    b = 0.75 * math.sin(2 * math.pi * (y / 4.5 + 2 * i / N) + 1.3)
    return a + b


def haar_versatz(i):
    """{Zeile: dx} für die Schlangen (Zeilen 0–8): die Schlangen winden sich dauernd (zwei Wellen mit verschiedener Periode, kein Fenster ohne
    Bewegung); Frame 0 = Original (Wert bei i = 0 abgezogen), nie mehr als 1 px Gefälle zwischen benachbarten Zeilen, höchstens ±2 px."""
    roh = {y: int(round(_haar_roh(y, i) - _haar_roh(y, 0))) for y in range(0, 9)}
    out = {}
    for y in range(0, 9):
        v = max(-2, min(2, roh[y]))
        if y and abs(v - out[y - 1]) > 1:
            v = out[y - 1] + (1 if v > out[y - 1] else -1)
        out[y] = v
    return out


def frame(i, nur=None):
    ebenen = nur if nur is not None else ('figur', 'glitzer')
    k = sz.ebene(koerper)
    # --- Schlangenaugen blinzeln (nacheinander) ---
    for n, p in enumerate(SCHNAUZ):
        if K.fenster(i, N, 4 + 8 * n, 2) is not None:
            Hm.setze(k, {p: UMRISS}, OFF)
    # --- Gorgonenaugen blinzeln: Lid senkt sich, schließt, hebt sich ---
    lid = Hm.folge(i, 15, [1, 2, 1], N) or Hm.folge(i, 39, [1, 2, 1], N)
    if lid:
        Hm.setze(k, {(6, 11): LID, (11, 11): LID}, OFF)
        if lid == 2:
            Hm.setze(k, {(6, 12): HAUT, (7, 12): HAUT, (10, 12): HAUT, (11, 12): HAUT}, OFF)
    # --- Schild glänzt ---
    Hm.lichtband(k, m_schild, OFF, i, N, 6, 12, SCHILD_R, stufen=1, breite=3.0, achse=(1.0, 1.0), kern=2)
    # --- Schlangen winden sich ---
    Hm.zeilen_versatz(k, OFF, haar_versatz(i))
    # --- Auf und ab: Schildzeile 23 doppelt ---
    brust = Hm.stufe(i, N / 2, 1)
    k = K.bob(k, PT + 23, brust)
    # --- Fußtippen ---
    ul = 1 if K.fenster(i, N, 10, 8) is not None else 0
    ur = 1 if K.fenster(i, N, 34, 8) is not None else 0
    fl, fr = sz.ebene(fuss_l, 0, -ul), sz.ebene(fuss_r, 0, -ur)
    fig = L.zusammen(H, W, [(fl, 0, 0), (fr, 0, 0), (k, 0, 0)])
    K.kontur(fig, sz.ERLAUBT, lambda c, x, y: UMRISS)            # Regel 16
    out = fig if 'figur' in ebenen else sz.leer()
    if 'glitzer' in ebenen:
        gl = sz.leer()
        Hm.stern4(gl, 12, 20 - brust, Hm.folge(i, 32, [0, 1, 2, 1], N), (253, 253, 253), (246, 246, 246), (239, 239, 239), OFF)
        out = L.zusammen(H, W, [(out, 0, 0), (gl, 0, 0)])
    return out


if __name__ == '__main__':
    K.abschluss(sz, frame, N, MS, 'Gorinthian War Counselor', 'gorinthian-war-counselor', K.vorschau_pfad())
