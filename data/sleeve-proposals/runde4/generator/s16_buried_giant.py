# -*- coding: utf-8 -*-
"""16 Buried Giant – Erd-Querschnitt: oben auf der Wiese scharrt ein Hund eifrig ein Loch, die Erde fliegt
hinter ihm hoch – tief unter ihm, in den Gesteinsschichten, ruht der riesige Gigantisaur-Schädel.

Quellen (MotiveGrailWar.xcf):
  Ebene 496 „Gigantisaur Skull“ – Fossilschädel (Karte „Gigantisaur Skull“, geprüft gegen Sichtbar #53)
  Ebene 703 „Ebene #75“ – Hund (geprüft gegen Sichtbar #158, vollständig)
  Rasenfarben aus Sichtbar #164 (Wiese der Karte „Country Harpyformer“)
Selbst gezeichnet: Himmel, ferne Hügel, Wolken, Rasenkante, Erd- und Gesteinsschichten, Kiesel,
Wurzeln, Grabloch, fliegende Erdbrocken, Hohlraum um den Schädel.

Skalierung: EIN gemeinsames 3×-Raster (84×117) für alles – Himmel, Hügel, Boden, Schichten, Hund,
Schädel und Effekte haben dieselbe Pixelgröße.
"""
import random
from dkit16_20 import *  # noqa

B = 'MotiveGrailWar'
K = 3
gw, gh = grid(K)                       # 84×117
lo = Canvas(gw, gh)
rnd = random.Random(16)

skull = sprite('d16_skull', B, [496])  # 50×36
dog = sprite('d16_dog', B, [703])      # 22×14

GY = 33                                # Oberkante Rasen (Zelle)

# --- Himmel + ferne Hügel ---------------------------------------------------------------
vgrad(lo, 0, GY, [(84, 142, 208), (98, 156, 216), (116, 172, 224), (136, 188, 230), (160, 204, 234), (190, 220, 238)])
for cx, cy, r in [(14, 9, 5), (19, 8, 4), (24, 10, 3.5), (60, 6, 4), (65, 5, 5), (70, 7, 3.5)]:
    for y in range(int(cy - r), int(cy + r) + 1):
        for x in range(int(cx - r * 1.6), int(cx + r * 1.6) + 1):
            d = ((x + .5 - cx) / (r * 1.6)) ** 2 + ((y + .5 - cy) / r) ** 2
            if d < 1 and y <= cy + 1:
                lo.px(x, y, (236, 242, 246) if y < cy - r * 0.3 else (206, 222, 236))
for x in range(gw):                    # zwei Hügelketten
    h1 = GY - 6 - int(3 * math.sin(x * 0.11 + 1.0) + 2 * math.sin(x * 0.27))
    h2 = GY - 3 - int(2 * math.sin(x * 0.17 + 2.5) + 1.5 * math.sin(x * 0.4))
    for y in range(h1, GY): lo.px(x, y, (108, 150, 120))
    for y in range(h2, GY): lo.px(x, y, (74, 122, 72))

# --- Erdschichten -------------------------------------------------------------------------
layers = [  # (Dicke, Grundfarbe, dunkle Punktfarbe)
    (5, (84, 56, 34), (58, 38, 24)),         # Mutterboden
    (7, (128, 86, 50), (100, 66, 38)),       # Lehm
    (6, (170, 134, 86), (140, 108, 66)),     # Sand
    (8, (112, 96, 88), (86, 72, 68)),        # Mergel
    (40, (74, 70, 88), (56, 52, 70)),        # Fels (Schädellage)
    (40, (50, 44, 60), (38, 32, 46)),        # Tiefengestein
]
bounds = []
y0 = GY + 2
for i, (th, c, d) in enumerate(layers):
    bounds.append((y0, th, c, d, i))
    y0 += th
for x in range(gw):
    yb = GY + 2
    for (ys, th, c, d, i) in bounds:
        wob = int(round(1.2 * math.sin(x * 0.19 + i * 1.7) + 0.8 * math.sin(x * 0.07 + i)))
        top = ys + (wob if i else 0)
        for y in range(top, gh):
            lo.a[y, x] = c
            if (x * 7 + y * 13 + i * 5) % 11 == 0: lo.a[y, x] = d
        # Grenzlinie etwas dunkler
        if i: lo.px(x, top, tuple(int(v * 0.78) for v in c))

# Kiesel
for _ in range(70):
    x, y = rnd.randrange(2, gw - 3), rnd.randrange(GY + 8, gh - 2)
    c = tuple(int(v) for v in lo.a[y, x])
    hi = tuple(min(255, int(v * 1.35) + 12) for v in c)
    lo.px(x, y, hi); lo.px(x + 1, y, c if rnd.random() < .5 else hi)
    lo.px(x, y + 1, tuple(int(v * 0.7) for v in c))

# --- Rasen (Farben der Wiese aus Sichtbar #164) -------------------------------------------
GR = [(58, 110, 38), (76, 132, 44), (98, 154, 52), (44, 88, 32)]
for x in range(gw):
    for y in range(GY, GY + 3):
        lo.a[y, x] = GR[(x * 3 + y * 5) % 3] if y < GY + 2 else GR[3]
    if (x * 5) % 7 < 3: lo.px(x, GY - 1, GR[2])            # Grashalme
# Wurzeln (1 Zelle breit, hängen an der Rasenkante)
for rx in [6, 15, 70, 78]:
    x, y = rx, GY + 3
    for j in range(rnd.randrange(5, 9)):
        lo.px(x, y, (46, 32, 22))
        y += 1
        if rnd.random() < .45: x += rnd.choice((-1, 1))

# --- Grabloch + Hund ------------------------------------------------------------------------
dx, dy = 30, GY + 1 - dog.shape[0]     # Pfoten auf der Rasenkante
hole_cx = dx + 17                      # unter den Vorderpfoten
for y in range(GY, GY + 7):
    hw = 5 - (y - GY) * 0.65
    for x in range(int(hole_cx - hw), int(hole_cx + hw) + 1):
        lo.px(x, y, (34, 22, 16) if y > GY else (48, 32, 20))
# aufgeworfener Erdhaufen hinter dem Hund
for x in range(dx - 9, dx + 2):
    h = int(3.2 - abs(x - (dx - 4)) * 0.55)
    for y in range(GY - h, GY):
        lo.px(x, y, (96, 64, 38) if (x + y) % 3 else (120, 82, 48))
# fliegende Erdbrocken (Bogen nach hinten)
for t, (px, py) in enumerate([(dx - 3, GY - 7), (dx - 7, GY - 10), (dx - 11, GY - 11), (dx - 14, GY - 9),
                              (dx - 5, GY - 12), (dx - 10, GY - 6), (dx - 16, GY - 5)]):
    lo.px(px, py, (110, 74, 44))
    if t % 2 == 0: lo.px(px + 1, py, (84, 56, 34))

sh = rgba(gw, gh)
ellipse_shadow(sh, dx + 11, GY + .5, 12, 1.5, (20, 30, 12), 120)
lo.paste(sh, 0, 0)
lo.paste(dog, dx, dy)

# --- Hohlraum + Schädel ---------------------------------------------------------------------
sx, sy = (gw - skull.shape[1]) // 2, 65
m = skull[..., 3] > 0
import cv2
pad = 3
M = np.zeros((skull.shape[0] + 2 * pad, skull.shape[1] + 2 * pad), np.uint8)
M[pad:-pad, pad:-pad] = m
cav = cv2.dilate(M, np.ones((5, 5), np.uint8)) > 0
rim = (cv2.dilate(cav.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0) & ~cav
for yy, xx in zip(*np.where(cav)):
    lo.px(sx - pad + xx, sy - pad + yy, (40, 36, 54))
for yy, xx in zip(*np.where(rim)):
    lo.px(sx - pad + xx, sy - pad + yy, (96, 92, 112))
# zarter Staubschein oberhalb (Knochen „leuchtet“ im Dunkel)
glow(lo, sx + skull.shape[1] / 2, sy + skull.shape[0] / 2, 34, (150, 140, 190), 0.25, ry=26)
lo.paste(skull, sx, sy)

# leichte Vignette unten
shade(lo, lambda x, y: max(0, (y - 100) / 17) * 0.5)

cv = Canvas(W, H)
blit(cv, lo, K, ox=1, oy=0)
print(save(cv, '16_buried_giant.png'))
