# -*- coding: utf-8 -*-
"""Elana, the Rocky Rebel: Sprite in animierbare Einzelteile zerlegen.

Quelle ist Idle-Frame 0 des Hero-Sheets (25x25). Jedes Teil ist ein
25x25-RGBA-Bild in Sprite-Koordinaten plus Gelenk(e). Fehlende Stellen, die
hinter einem Teil verborgen waren (Rumpf hinter der Schlaghand, Beine über
der Stiefelkante, Ärmel der Schlagarm), sind ergänzt.

Teile (Zeichenreihenfolge hinten → vorn siehe elana_death.py):
  LEG_L, LEG_R   Beine (Stiefel, nach oben verlängert; sitzen unter dem Rumpf)
  TORSO          schwarzes Hemd, roter Schal, rotes Röckchen (Hüfte)
  ARM_S          Schlagarm: Ärmel + Faust (neu gezeichnet bis zur Schulter)
  HEAD           Haare + Gesicht (auch als X-Augen-Variante)
  ARM_F          Greifarm: roter Ärmel + Greifhand
  GUITAR         Hals, Kopfplatte, Korpus
"""
from PIL import Image
import numpy as np

IDLE = '../../data/hero-animations/elana-the-rocky-rebel.png'
W0 = H0 = 25
BASE = np.array(Image.open(IDLE).convert('RGBA'))[:, 0:W0].copy()


def rgb(h, a=255):
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


HAND = {(99, 48, 7), (193, 146, 92), (248, 188, 119)}
NECK = {25: rgb('3e3832'), 26: rgb('acb1b3'), 27: rgb('66514a'),
        28: rgb('acb1b3'), 29: rgb('3e3832')}
SHIRT = rgb('12181b')
SHIRT2 = rgb('0a1012')
BLACK = rgb('000000')
RED_D, RED_M, RED_L, RED_H = rgb('990200'), rgb('cc0001'), rgb('e90001'), rgb('e93a3b')
X_EYE = rgb('3b0040')

# Gelenke in Sprite-Koordinaten (Pixelmitte = +0.5 wird beim Drehen addiert)
JOINTS = {
    'hip': (8.0, 20.5),        # Drehpunkt des ganzen Körpers / Becken
    'neck': (7.5, 14.5),       # Kopf sitzt hier auf dem Rumpf
    'shoulder_f': (12.5, 14.5),   # Greifarm: Schulter (unten am Ärmel)
    'shoulder_s': (6.5, 16.5),    # Schlagarm: Schulter (links am Rumpf)
    'hip_l': (5.5, 20.5),
    'hip_r': (11.5, 20.5),
    'guitar': (17.0, 12.0),    # Mitte der Gitarre
}


def cols(c):
    return tuple(int(v) for v in c[:3])


def is_green(c):
    return int(c[1]) - max(int(c[0]), int(c[2])) > 40


def is_red(c):
    return c[0] > 140 and c[1] < 70 and c[2] < 70


def empty():
    return np.zeros((H0, W0, 4), np.uint8)


def build():
    B = BASE
    m = {k: np.zeros((H0, W0), bool) for k in
         ('head', 'torso', 'arm_f', 'arm_s', 'leg_l', 'leg_r', 'guitar')}
    for y in range(H0):
        for x in range(W0):
            c = B[y, x]
            if c[3] == 0:
                continue
            cc = cols(c)
            dark = sum(cc) <= 120 or cc == (85, 83, 87)
            if cc in HAND and 14 <= x <= 19 and 9 <= y <= 13:
                m['arm_f'][y, x] = True
            elif cc in HAND and 8 <= x <= 11 and 16 <= y <= 19:
                m['arm_s'][y, x] = True
            elif y >= 21 and dark and x <= 8:
                m['leg_l'][y, x] = True
            elif y >= 21 and dark and x >= 9:
                m['leg_r'][y, x] = True
            elif is_green(c) and x < 17 and y <= 14:
                m['head'][y, x] = True
            elif is_green(c):
                m['head'][y, x] = True          # einzelne Haarpixel
            elif cc == (65, 55, 4):
                m['head'][y, x] = True          # Brauenpixel
            elif y <= 14 and x <= 10 and y >= 7 and not is_red(c):
                m['head'][y, x] = True          # Gesicht
            elif y <= 14 and 9 <= x <= 15 and is_red(c):
                m['arm_f'][y, x] = True         # roter Ärmel
            elif x >= 11 and 14 <= y <= 21 and x + y >= 24 and x <= 19 and (
                    is_red(c) or dark or 24 <= x + y <= 31) and y >= 15:
                m['guitar'][y, x] = True
            elif x >= 14 and y >= 13:
                m['guitar'][y, x] = True
            elif x + y in NECK and x >= 12 and y <= 15 and x + y >= 24:
                m['guitar'][y, x] = True
            elif x >= 15 and y <= 8:
                m['guitar'][y, x] = True
            elif 14 <= x and 24 <= x + y <= 31:
                m['guitar'][y, x] = True
            else:
                m['torso'][y, x] = True
    # Reste, die am Rand der Teile hängen geblieben sind, prüfen wir im Bild.
    parts = {}
    for k, mask in m.items():
        img = empty()
        img[mask] = B[mask]
        parts[k] = img
    return parts, m


PARTS, MASKS = build()


def finish(parts):
    """Ergänzungen: verdeckte Stellen malen, Beine verlängern, Augenvarianten."""
    P = {k: v.copy() for k, v in parts.items()}
    T = P['torso']
    # Rumpf hinter der Schlaghand und hinter dem Gitarrenkorpus auffüllen
    for y in range(16, 20):
        for x in range(5, 12):
            if T[y, x, 3] == 0:
                T[y, x] = SHIRT if (x + y) % 3 else SHIRT2
    # Hals/Nacken unter dem Kopf: dunkle Zeile (vom Kopf verdeckt)
    for x in range(5, 11):
        if T[14, x, 3] == 0:
            T[14, x] = SHIRT
    # Gitarrenhals unter der Greifhand auffüllen (Streifen nach x+y)
    G = P['guitar']
    for y in range(6, 14):
        for x in range(13, 21):
            if G[y, x, 3] == 0 and (x + y) in NECK and P['arm_f'][y, x, 3]:
                G[y, x] = NECK[x + y]
    # Beine nach oben verlängern (Hüfte überdeckt den Ansatz)
    for k in ('leg_l', 'leg_r'):
        L = P[k]
        ys, xs = np.nonzero(L[..., 3])
        top = ys.min()
        for y in range(top - 3, top):
            for x in xs[ys == top]:
                L[y, x] = SHIRT if (x + y) % 2 else BLACK
    # Schlagarm: Ärmel von der Schulter (6,16) zur Faust (8..11, 17..19)
    A = P['arm_s']
    sleeve = {(6, 16): RED_D, (7, 16): RED_M, (8, 16): RED_L, (9, 16): RED_M,
              (6, 17): RED_D, (7, 17): RED_M, (8, 17): A[17, 8] if A[17, 8, 3] else RED_L,
              (6, 15): RED_D, (7, 15): RED_M}
    for (x, y), col in sleeve.items():
        if A[y, x, 3] == 0:
            A[y, x] = col
    return P


PARTS = finish(PARTS)
