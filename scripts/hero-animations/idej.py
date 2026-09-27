# -*- coding: utf-8 -*-
"""Idle-Animation für Idej Lord Daiyo (MotiveSteamDwarfs.xcf: Geist „Ebene #28“
+ Schwert „Ebene #22“).

Teile: src/idej-lord-daiyo-{ghost,sword}.png (deckungsgleich).
* Der Geist schwebt (sanftes Auf und Ab) und leuchtet: ein halbtransparenter
  grüner Schein liegt 1 px um seine Silhouette und pulsiert.
* Er bewegt sein Schwert: es schwingt um den Griff nach vorn und zurück und
  hebt sich dabei leicht.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs, ring8
from flap_common import rotate_part, over

GHOST = np.array(Image.open('src/idej-lord-daiyo-ghost.png').convert('RGBA')).astype(int)
SWORD = np.array(Image.open('src/idej-lord-daiyo-sword.png').convert('RGBA')).astype(int)
SH, SW = GHOST.shape[:2]
P, PT, PB = 7, 4, 3
H, W = SH + PT + PB, SW + 2 * P
N = 48
HILT = (3.5, 12.5)                                   # Drehpunkt am Griff
GLOW = (96, 255, 120)


def bob(i):
    return int(round(math.sin(2 * math.pi * i / 16)))


def sword_pose(i):
    """(Winkel, Hub): zweimal pro Loop nach vorn schwingen und zurück."""
    s = math.sin(2 * math.pi * i / 24)
    return 0.28 * s, -int(round(max(0.0, s)))


def frame(i):
    out = np.zeros((H, W, 4), int)
    oy = PT + bob(i)
    ang, lift = sword_pose(i)
    ghost = np.zeros((H, W, 4), int)
    for y in range(SH):
        for x in range(SW):
            if GHOST[y, x, 3]:
                ghost[y + oy, x + P] = GHOST[y, x]
    a = int(70 + 60 * (0.5 + 0.5 * math.sin(2 * math.pi * i / 16)))
    for y, x in zip(*np.nonzero(ring8(ghost[:, :, 3] > 0))):   # Schein um den Geist
        out[y, x] = (*GLOW, a)
    m = SWORD[:, :, 3] > 0
    sword = rotate_part(SWORD, m, HILT, ang, (H, W), (P, oy + lift))
    over(out, sword)
    g = ghost[:, :, 3] > 0
    out[g] = ghost[g]
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'idej_idle_{tag}', frames, ms, scale=8, check_edges=True)
