# -*- coding: utf-8 -*-
"""Sleeve 26 – „Weapon Storm“: Xal, die belebte Rüstung, steht im roten Glühen seiner Rüstkammer und
entfesselt den Waffensturm: Schwerter, Hellebarde, Pfeile und Speer schießen mit Tempo-Linien senkrecht
nach oben – jede Waffe ein anderes Stück, gestaffelt wie eine Salve statt eines Kachelmusters.

Runde 3b: ALLES einheitlich 3× (natives Raster 84×117, am Ende verdreifacht). Vorher: 5×-Xal vor 2×/1×-
Waffenkopien auf 2×-Mauer. Jetzt haben Mauer, Glühen, Tempo-Linien, Waffen und Xal dieselbe Pixelgröße, und
keine Waffe kommt doppelt in gleicher Lage vor.

Quellen (MotiveGrailWar.xcf): Ebene 401 „XAL“, 402 „Weapon Storm“ (daraus einzeln freigestellt: Schwert oben
rechts, Hellebarde oben Mitte), 397 „Ebene #283“ (Schwert, Pfeil, Hellebarde), 390 „Ebene #287“ (Pfeil),
694 „Doctor Fester #5“ (dunkle Quadermauer, rot getönt). Waffen um 90° gedreht (Spitzen nach oben).
Glühen, Boden, Tempo-Linien: selbst gezeichnet. Karten: Xal the Animated Armor, Weapon Storm.
"""
import numpy as np
from d_util import *  # noqa

K = 3
nc = native(K)
W, H = nc.w, nc.h
yy, xx = np.mgrid[0:H, 0:W]

# --- Mauer (694), rot getönt, gekachelt ---------------------------------------------------------------
wall = compose(B, [694])
wall = wall[:, 20:120]
tile = tint(hsv_shift(wall, -10, 1.0, 0.5), (90, 10, 20), 0.3)
th, tw = tile.shape[:2]
nc.a[:] = tile[yy % th, xx % tw, :3]

# rotes Glühen hinter Xal (geditherte Stufen, natives Raster)
d = np.hypot((xx - W / 2) / 1.0, (yy - 92) / 1.3) / 70.0
t = np.clip(1 - d, 0, 1)
for lvl, col in [(0.1, (110, 16, 18)), (0.4, (180, 36, 28)), (0.7, (236, 104, 48))]:
    m = t > lvl + BAYER8[yy % 8, xx % 8] * 0.3
    nc.a[m] = (nc.a[m].astype(int) * 0.4 + np.array(col) * 0.6).astype(np.uint8)
# Boden: dunkle Steinkante unter Xal
FLOOR = 108
nc.a[FLOOR:] = (nc.a[FLOOR:].astype(int) * 0.45).astype(np.uint8)
nc.a[FLOOR] = (120, 40, 36)

# --- Waffen einzeln freistellen --------------------------------------------------------------------------
def cut(idx, box, largest=True):
    s = compose(B, [idx], crop=False)[box[1]:box[3], box[0]:box[2]].copy()
    if largest:
        s = max(parts(s, dil=0, minpx=3), key=lambda p: (p[..., 3] > 0).sum())
    else:
        b = bbox(s); s = s[b[1]:b[3], b[0]:b[2]]
    return s

weapons = {
    'swordA': cut(402, (303, 188, 332, 198)),
    'halbA': cut(402, (268, 188, 302, 199)),
    'sword2': cut(397, (212, 152, 234, 168)),
    'arrow2': cut(397, (232, 136, 242, 164)),
    'halb2': cut(397, (236, 167, 262, 183)),
    'arrow3': cut(390, (0, 0, 565, 440)),
}
for k, s in weapons.items():
    keep('d26_' + k, s)
up_ = {k: (rot90(s, 1) if s.shape[1] > s.shape[0] else s) for k, s in weapons.items()}   # Spitze nach oben
for k in ('arrow2',):
    # der Pfeil aus 397 steht schon senkrecht – prüfen, ob die Spitze oben ist (Spitze = hellste Zeile)
    s = up_[k]
    if s[:4, ..., :3].sum() < s[-4:, ..., :3].sum(): up_[k] = s[::-1]

def speed(x, y0, y1, col=(226, 92, 52)):
    """Tempo-Linie unter einer Waffe: 1-px-Linie, nach unten geditherte Ausdünnung."""
    for y in range(y0, min(y1, H)):
        f = (y - y0) / max(1, y1 - y0)
        if BAYER8[y % 8, x % 8] > f * 1.05:
            nc.a[y, x] = col

# Salve: (Waffe, x-Mitte, obere Kante) – gestaffelt, nicht spiegelgleich
volley = [('halbA', 11, 22), ('sword2', 25, 38), ('arrow2', 38, 8), ('swordA', 50, 26),
          ('arrow3', 61, 44), ('halb2', 73, 20)]
for k, cx, top in volley:
    s = up_[k]
    x = cx - s.shape[1] // 2
    y = top
    speed(x + s.shape[1] // 2, y + s.shape[0] + 1, y + s.shape[0] + 30)
    nc.paste(silhouette(s, (40, 4, 8)), x + 1, y + 1, alpha=0.6)
    nc.paste(s, x, y)

# --- Xal ------------------------------------------------------------------------------------------------
xal = sprite('d26_xal', B, [401])
blob(nc, W // 2, FLOOR, 16, 2, (20, 4, 6), 1.0)
put(nc, xal, W // 2, FLOOR + 1, anchor='b')

vignette(nc, 0.45, 0.6)
cv = finish(nc, K)
print(save(cv, '26_weapon_storm.png'))
