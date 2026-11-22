# -*- coding: utf-8 -*-
"""Idle-Animation für Fairy Queen Crestina, the Creation Fairy (MotiveMoe.xcf).

* Sie fliegt: die weiß-blauen Flügel schlagen kräftig und ununterbrochen
  (6 Schläge je Loop, spaltentreu geschert – flap_common.shear_flap, wie bei
  Jenny und Tempeste); bei jedem Abschlag hebt sie sich ein wenig.
* Die lila Aura umgibt sie immer exakt: sie ist im Original der Rand um Figur
  und Flügel (auch zwischen den Federn) und wird deshalb in jedem Frame neu um
  die aktuelle Silhouette gelegt; dazu pulsiert sie wellenförmig.
* Sie lächelt mit ^-förmigen Augen (geschlossene, fröhliche Augen); kurz
  zu Beginn des Loops sind die Augen offen.
* Fliegen: sie steigt und sinkt (bis 1,5 px); über die Flügel läuft ein heller
  Schimmer nach oben, kleine Glitzersterne blitzen um sie herum auf.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs, draw_sparkles, wave, ring8
from flap_common import shear_flap, fill_pinholes

SRC = np.array(Image.open('src/fairy-queen-crestina-the-creation-fairy.png').convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
P = 5
H, W = SH + 2 * P, SW + 2 * P
N = 48

D, S, S2 = rgb('311800'), rgb('ffd5a4'), rgb('ee9c7b')
SMILE = [((7, 10), D), ((10, 10), D), ((6, 11), D), ((11, 11), D),      # ^ ^
         ((8, 11), S2), ((9, 11), S2), ((7, 11), S), ((10, 11), S)]
AURA, AURA_HI = rgb('bb99ff'), rgb('d9c8ff')
WING_COLS = {rgb('f6ffff'), rgb('b4f6ff')}
IS_AURA = np.array([[tuple(SRC[y, x]) == AURA and SRC[y, x, 3] > 0 for x in range(SW)] for y in range(SH)])
IS_WING = np.array([[SRC[y, x, 3] > 0 and tuple(SRC[y, x]) in WING_COLS and (x <= 4 or x >= 13)
                     for x in range(SW)] for y in range(SH)])
BODY = SRC.copy()
BODY[IS_AURA | IS_WING] = 0
PIVOT = {-1: 5, 1: 12}                            # Flügelansatz links/rechts
FLUTTER = 8                                       # Frames pro Flügelschlag (6 Schläge je Loop)
SPARKLES = [(3, 4, 0), (SW + 6, 5, 9), (3, SH + 2, 17), (SW + 6, SH + 3, 25), (SW + 6, SH // 2 - 2, 13)]


def smiling(i):
    return not (i % N < 5)


def bob(i):
    """Sie steigt und sinkt (zweimal je Loop, bis 1,5 px); bei jedem Abschlag hebt sie sich ein wenig."""
    up = 1.5 * math.sin(2 * math.pi * 2 * i / N)
    kick = 0.6 * math.sin(2 * math.pi * i / FLUTTER - 1.2)
    return -int(round(up + kick))


def frame(i):
    out = np.zeros((H, W, 4), int)
    dy = bob(i)
    p = 2 * math.pi * i / FLUTTER                         # Flügel schlagen
    lift, sq = 0.6 * math.sin(p), 1.0 - 0.1 * max(0.0, -math.cos(p))   # kräftig, kaum gestaucht
    cols = np.arange(SW)[None, :]
    band = SH - 1 - (i * 2) % (SH + 8)
    wings = SRC.copy()
    for y in range(SH):
        for x in range(SW):
            if IS_WING[y, x] and abs(y - band) <= 1:
                wings[y, x] = rgb('ffffff')               # Schimmer läuft nach oben
    for side in (-1, 1):
        m = IS_WING & ((cols <= 8) if side < 0 else (cols >= 9))
        shear_flap(wings, m, PIVOT[side], side, lift, sq, out, (P, P + dy), curve=1.0)
    s = BODY.copy()
    if smiling(i):
        for (x, y), c in SMILE:
            s[y, x] = c
    m = s[:, :, 3] > 0
    out[P + dy:P + dy + SH, P:P + SW][m] = s[m]
    fill_pinholes(out)
    for y, x in zip(*np.nonzero(ring8(out[:, :, 3] > 0))):   # Aura: exakt 1 px um die Silhouette
        out[y, x] = AURA_HI if wave(i, 16, 0.5 * (x + y)) > 0.75 else AURA
    draw_sparkles(out, i, N, SPARKLES, rgb('d9c8ff'), rgb('bb99ff'))
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'crestina_fq_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 90, scale=8, check_edges=True)
