# -*- coding: utf-8 -*-
"""Sleeve 32 – „Garden of Gold“: Nacht im Garten der Hesperiden. Heragas, der Monsterjäger, steht – von hinten
gesehen – groß im Vordergrund und blickt zum Baum der goldenen Äpfel auf, der auf einer Anhöhe wie eine Laterne
glüht und den Garten in Goldlicht taucht. Das Licht zeichnet Heragas' Umriss nach.

Skalierung / Tiefenstaffelung (zwei Ebenen):
  Hintergrund 3× (84×117-Raster, einmal hochskaliert): Nachthimmel, Sterne, Goldschein, Hügel, Baum mit Funkeln
             und Äpfeln.
  Vordergrund 4× (63×88-Raster, einmal hochskaliert): Heragas und sein Schlagschatten.

Quellen (MotiveSteamDwarfs.xcf, Karte „Tree of Golden Apples“ – Ebenen liegen im selben Koordinatensystem):
  Baum      = Ebene 7 „Tree of Golden Apples“ (54×62), Funkeln = Ebene 4 „Tree of Golden Apples #2“,
  Äpfel     = Ebene 6 „Tree of Golden Apples #1“ (drei Äpfel, Lage wie auf der Karte)
  Heragas   = Ebene 5 „Tree of Golden Apples #3“ (Heragas von hinten, vollständig; Varianten 22/32 identisch
              bis auf den Schweißtropfen)
  Himmel, Sterne, Hügel, Schein, Randlicht, Schatten = selbst gezeichnet (Bayer-Dithering, Baumfarben)
"""
from common import *
import numpy as np

B = 'MotiveSteamDwarfs'

# ======================= Hintergrund 3× =======================
W3, H3 = 84, 117
bg = Canvas(W3, H3)
yy, xx = np.mgrid[0:H3, 0:W3]
TH = BAYER4[yy % 4, xx % 4]

cols = [(8, 10, 30), (14, 18, 46), (26, 26, 64), (44, 34, 74)]
t = np.clip((yy - 6) / 70, 0, 1) * (len(cols) - 1)
q = np.floor(t + TH * 0.999).clip(0, len(cols) - 1).astype(int)
for k, c in enumerate(cols):
    bg.a[q == k] = c
rng = np.random.RandomState(32)
for _ in range(38):
    x, y = rng.randint(2, W3 - 2), rng.randint(2, 60)
    bg.px(x, y, (190, 190, 230) if rng.rand() < 0.7 else (250, 230, 170))

tree = compose(B, [4, 6, 7], crop=False)
tb = bbox(compose(B, [7], crop=False))                    # Lage des Baumes (ohne Funkeln)
x0 = tb[0] - 12; tree = tree[tb[1] - 2:tb[3], x0:tb[2] + 12]   # Funkeln nahe am Baum, fernes Funkeln weg
tree[..., 3] = np.where(tree[..., 3] >= 128, 255, 0)
TX = W3 // 2 - (tree.shape[1] // 2)
TY = 8
tcx, tcy = TX + tree.shape[1] // 2, TY + 28

# Goldschein um die Krone
d = np.sqrt((xx + .5 - tcx) ** 2 + ((yy + .5 - tcy) * 0.9) ** 2)
for r, col, a in [(40, (56, 42, 72), 0.7), (34, (104, 68, 64), 0.7), (30, (170, 106, 58), 0.7)]:
    m = (np.clip((r - d) / 5, 0, 1) * a > TH)
    bg.a[m] = col

# Hügel mit Wiese: vorne dunkel, oben am Baum golden beleuchtet
HT = TY + tree.shape[0] - 3                               # Standlinie des Baumes
tops = [HT + int(round(((x + .5 - tcx) / 30) ** 2 * 7)) for x in range(W3)]
for x in range(W3):
    top = tops[x]
    for y in range(top, H3):
        dd = np.hypot(x + .5 - tcx, (y - HT) * 0.8)
        lt = np.clip(1 - dd / 46, 0, 1)
        v = lt + (TH[y, x] - 0.5) * 0.2
        col = (150, 104, 40) if v > 0.62 else (94, 72, 34) if v > 0.38 else (46, 44, 30) if v > 0.16 else (22, 26, 24)
        bg.a[y, x] = col
    bg.a[top, x] = (200, 150, 60) if abs(x + .5 - tcx) < 22 else (60, 58, 40)
# Grasbüschel (je 1×2 Rasterpunkte) in der beleuchteten Wiese
for _ in range(70):
    x, y = rng.randint(2, W3 - 2), rng.randint(HT + 4, H3 - 4)
    if y - 1 > tops[x] + 1 and bg.a[y, x].sum() > 120:
        c = bg.a[y, x].astype(int)
        bg.a[y - 1:y + 1, x] = np.clip(c * 1.35 + 12, 0, 255).astype(np.uint8)
bg.paste(tree, TX, TY)

# ======================= Vordergrund 4× =======================
W5, H5 = 63, 88
fg = np.zeros((H5, W5, 4), np.uint8)
her = sprite('g32_heragas', B, [5])
hh, hw = her.shape[:2]
HX, HY = W5 // 2 - hw // 2, 82 - hh                      # Füße auf y=82 (4×-Raster) -> 328 px
# Rückseite im Gegenlicht abdunkeln, Kanten zum Baum hin golden
h2 = her.copy()
h2[..., :3] = (h2[..., :3].astype(float) * np.array([0.36, 0.34, 0.46])).astype(np.uint8)
m = her[..., 3] > 0
up_edge = m & ~np.vstack([np.zeros((1, hw), bool), m[:-1]])
side = m & (~np.hstack([np.zeros((hh, 1), bool), m[:, :-1]]) | ~np.hstack([m[:, 1:], np.zeros((hh, 1), bool)]))
rim = up_edge | (side & (np.arange(hh)[:, None] < 16))
h2[rim, :3] = (236, 178, 80)
# Schlagschatten zum Betrachter hin (Licht kommt vom Baum hinter ihm)
for y in range(82, H5):
    for x in range(W5):
        dx = (x + .5 - W5 / 2) / (7 + (y - 82) * 0.6)
        if abs(dx) < 1:
            fg[y, x] = (6, 8, 10, 150)
fg[HY:HY + hh, HX:HX + hw][m] = h2[m]

# ======================= zusammensetzen =======================
out = Canvas(250, 350)
big = up(np.dstack([bg.a, np.full((H3, W3), 255, np.uint8)]), 3)
out.a[:] = big[:350, 1:251, :3]
out.paste(up(fg, 4)[:350, 1:251], 0, 0)
print(save(out, '32_garden_of_gold.png'))
