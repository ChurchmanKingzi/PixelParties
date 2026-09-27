# -*- coding: utf-8 -*-
"""Idle-Animation für Jack, the Crooked Killer (MotiveBritain.xcf: „Jack“ + das
lange Sägemesser „Ebene #80“ in der linken Hand, gespiegelt in der rechten).

Teile: src/jack-the-crooked-killer-{body,knife_l,knife_r}.png (deckungsgleich).
* Jack federt in den Knien (die Füße bleiben stehen).
* Er hebt abwechselnd die Messer (Hand und Messer als Einheit, 2 px hoch,
  kurz halten, wieder senken) – links und rechts um einen halben Takt versetzt.
* Über jede Klinge läuft einmal pro Loop ein heller Lichtreflex nach unten.
* Blut tropft von den Zähnen der Sägen: unter jedem Zahn bildet sich ein
  Tropfen, fällt drei Zeilen und vergeht, bevor er den nächsten Zahn erreicht
  (jeder Zahn mit eigenem Takt).
"""
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs, BOUNCE12
from flap_common import fill_pinholes

BODY = np.array(Image.open('src/jack-the-crooked-killer-body.png').convert('RGBA')).astype(int)
KNIVES = [np.array(Image.open(f'src/jack-the-crooked-killer-{k}.png').convert('RGBA')).astype(int)
          for k in ('knife_l', 'knife_r')]
SH, SW = BODY.shape[:2]
P, PT, PB = 3, 4, 2
H, W = SH + PT + PB, SW + 2 * P
N = 48
KNEE = 37
MID = (SW - 1) / 2                                   # Spiegelachse (x = 22)
BLOOD = [rgb('aa0000'), rgb('8e0000'), rgb('630000')]
BLADE = rgb('b5b5b5')
SHINE = [rgb('ffffff'), rgb('e6e6e6')]
TEETH = [6, 10, 14, 18]                              # Zahnreihen (Tropfen darunter)
DROP_X = [1, 0, 1, 1]                                # Spalte des Tropfens je Zahn (links)
DROP_PHASE = [0, 7, 3, 10]


def hand_mask(left):
    m = np.zeros((SH, SW), bool)
    for y in range(24, 28):
        for x in range(SW):
            if BODY[y, x, 3] and ((left and x <= 11) or (not left and x >= SW - 1 - 11)):
                m[y, x] = True
    return m


HANDS = [hand_mask(True), hand_mask(False)]


def strip_drops(k):
    """Einzelne Bluttropfen (ohne 4er-Nachbarn) entfernen – sie werden neu gezeichnet."""
    k = k.copy()
    a = k[:, :, 3] > 0
    nb = np.zeros_like(a)
    nb[1:] |= a[:-1]; nb[:-1] |= a[1:]; nb[:, 1:] |= a[:, :-1]; nb[:, :-1] |= a[:, 1:]
    k[a & ~nb] = 0
    return k


KNIVES = [strip_drops(k) for k in KNIVES]


def lift(t):
    """Messer heben: 0, -1, -2 (halten), -1, 0 im 24er-Takt."""
    return [0, 0, 0, 0, -1, -2, -2, -2, -2, -1, 0, 0][t // 2] if t < 24 else 0


def drop_row(i, k):
    """Zeilenversatz des Tropfens unter Zahn k (1..3) oder None (gerade keiner)."""
    t = (i + DROP_PHASE[k]) % 12
    return {0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 2, 7: 3}.get(t)


def frame(i):
    out = np.zeros((H, W, 4), int)
    b = BOUNCE12[i % 12]
    for y in range(SH):                              # Körper (ohne Hände)
        for x in range(SW):
            if BODY[y, x, 3] and not HANDS[0][y, x] and not HANDS[1][y, x]:
                out[y + PT + (b if y < KNEE else 0), x + P] = BODY[y, x]
    if b < 0:
        y = KNEE - 1
        for x in range(SW):
            if BODY[y, x, 3] and not out[y + PT, x + P, 3]:
                out[y + PT, x + P] = BODY[y, x]
    for side, knife in enumerate(KNIVES):
        dy = b + lift((i + 12 * side) % 24)
        kn = knife.copy()
        pos = (i * 22 / N + 11 * side) % 22 - 1      # Lichtreflex wandert die Klinge hinab
        for y, x in zip(*np.nonzero((kn[:, :, :3] == BLADE[:3]).all(2) & (kn[:, :, 3] > 0))):
            d = abs(y - pos)
            if d < 0.8:
                kn[y, x] = SHINE[0]
            elif d < 1.8:
                kn[y, x] = SHINE[1]
        for y, x in zip(*np.nonzero(kn[:, :, 3])):
            out[y + PT + dy, x + P] = kn[y, x]
        for y, x in zip(*np.nonzero(HANDS[side])):   # Hand hält den Griff
            out[y + PT + dy, x + P] = BODY[y, x]
        for k, row in enumerate(TEETH):              # Blut tropft
            r = drop_row(i, k)
            if r is None:
                continue
            x = DROP_X[k] if side == 0 else SW - 1 - DROP_X[k]
            out[row + r + PT + dy, x + P] = BLOOD[0] if r < 3 else BLOOD[1]
    fill_pinholes(out)
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'jack_idle_{tag}', frames, ms, scale=8, check_edges=True)
