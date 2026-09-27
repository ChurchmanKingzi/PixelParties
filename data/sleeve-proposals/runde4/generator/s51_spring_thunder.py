# -*- coding: utf-8 -*-
"""Sleeve 51 – „Spring Thunder“: Qinglong, der Azurdrache des Ostens, windet sich im Morgengrauen aus der
Gewitterwolke; sein goldenes Blitzhorn leuchtet, die blauen Blitze seiner Aura schlagen in die grünen
Frühlingshügel ein. Gegenstück zu „Autumn Tiger“ (Baihu, Westen/Herbst) und „Black Tortoise“ (Xuanwu,
Norden/Winter): Osten = Sonnenaufgang, Frühling, Frühlingsgewitter.

Skalierung (zwei Tiefenebenen):
  Hintergrund 2× (125×175): Morgenhimmel, Hügelketten, Regen – selbst gezeichnet (geordnetes Dithering)
  Vordergrund 3× (84×117): Gewitterwolke, Blitze, Drache – alles aus Motive.xcf
Quellen (Motive.xcf, Karte „Cardinal Beast Qinglong“, Szene 149 „Sichtbar #251“):
  Drache vollständig = 1526 „QINLONG #1“ (Kopf + Leib) + 1522 „QINLONG #3“ (goldenes Blitzhorn mit Funken)
  + 1521 „QINLONG #2“ (lange Barteln); Blitze 1525 „QINLONG #5“; Gewitterwolke 1527 „QINLONG“.
  Lage von Drache, Horn, Barteln und Blitzen zueinander wie in der Kartenszene.
"""
from common import *
import numpy as np

B = 'Motive'
# ---------------------------------------------------------------- Hintergrund 2×
W2, H2 = 125, 175
bg = Canvas(W2, H2)
yy, xx = np.mgrid[0:H2, 0:W2]
TH = BAYER4[yy % 4, xx % 4]
sky = [(18, 24, 52), (30, 42, 78), (52, 66, 104), (92, 98, 128), (156, 132, 140), (222, 170, 142), (246, 212, 160)]
t = np.clip((yy - 10) / 118, 0, 1) * (len(sky) - 1)
q = np.floor(t + TH * 0.999).clip(0, len(sky) - 1).astype(int)
for k, c in enumerate(sky):
    bg.a[q == k] = c
# Sonnenaufgang: heller Saum über der fernsten Kette, leicht rechts der Mitte
d = np.hypot((xx - 78) * 0.8, (yy - 128) * 1.6)
bg.a[(d < 16) & (TH < np.clip(1 - d / 16, 0, 1))] = (252, 232, 184)

def ridge(base, amp, per, phase, col, hi=None):
    """Hügelkette: Höhenlinie aus zwei Sinuswellen, oben 1 px Lichtkante (Morgenlicht von rechts)."""
    h = base - amp * (0.6 * np.sin(xx[0] / per + phase) + 0.4 * np.sin(xx[0] / (per * 0.43) + phase * 2.1))
    top = np.round(h).astype(int)
    for x in range(W2):
        bg.a[top[x]:, x] = col
        if hi is not None and x > 0 and top[x] <= top[x - 1]:
            bg.a[top[x], x] = hi
    return top

ridge(132, 6, 9, 0.4, (86, 104, 120), (150, 150, 150))                 # fernste Kette im Dunst
ridge(142, 7, 7, 2.1, (58, 94, 82), (120, 150, 110))
t3 = ridge(152, 6, 6, 4.0, (38, 84, 52), (96, 150, 70))
t4 = ridge(163, 5, 5, 1.3, (26, 64, 36), (70, 128, 54))
# Frühlingsblüten auf der vorderen Kette (rosa Tupfen, 2×2-Grundraster)
rng = np.random.RandomState(51)
for _ in range(70):
    x = rng.randint(0, W2); ys = t4[x] + rng.randint(1, 10)
    if ys < H2: bg.px(x, ys, (236, 150, 176) if rng.rand() < 0.7 else (250, 206, 216))
for _ in range(40):
    x = rng.randint(0, W2); ys = t3[x] + rng.randint(1, 7)
    if ys < H2: bg.px(x, ys, (196, 128, 150))
# Frühlingsregen: schräge Striche, oben dichter (unter der Wolke)
for _ in range(150):
    x = rng.randint(-20, W2); y = rng.randint(20, 150); n = rng.randint(3, 6)
    for i in range(n):
        X, Y = x + i // 2, y + i
        if 0 <= X < W2 and 0 <= Y < H2 and Y < 150:
            c = bg.a[Y, X].astype(int)
            bg.a[Y, X] = np.clip(c * 0.6 + np.array((150, 180, 210)) * 0.4, 0, 255)

# ---------------------------------------------------------------- Vordergrund 3×
W3, H3 = 84, 117
fg = np.zeros((H3, W3, 4), np.uint8)
def put(s, x, y):
    h, w = s.shape[:2]
    x0, y0 = max(0, -x), max(0, -y); x1, y1 = min(w, W3 - x), min(h, H3 - y)
    if x1 <= x0 or y1 <= y0: return
    src = s[y0:y1, x0:x1]; dst = fg[y + y0:y + y1, x + x0:x + x1]
    m = src[..., 3] > 0; dst[m] = src[m]

drag = sprite('r4q_qinglong', B, [1521, 1522, 1526])   # Ursprung (230, 247) in Motive
bolts = sprite('r4q_bolts', B, [1525])                  # Ursprung (234, 253)
cloud = sprite('r4q_cloud', B, [1527])                  # Ursprung (218, 234)
DX, DY = 8, 36                                          # Lage des Drachen (Ursprung 230,247) im 3×-Raster
# Wolke hinten, quer über den oberen Rand (zweimal gesetzt, damit die Wolkendecke die Breite füllt)
put(cloud, -40, DY - 13 - 6)
put(cloud, DX - 12, DY - 13)
# Blitze in Szenenlage hinter dem Drachen; ihre Füße reichen bis in die Hügel
put(bolts, DX + 4, DY + 6)
put(drag, DX, DY)

# ---------------------------------------------------------------- zusammensetzen
out = Canvas(250, 350)
out.a[:] = up(np.dstack([bg.a, np.full((H2, W2), 255, np.uint8)]), 2)[..., :3]
F = up(fg, 3)[1:351, 1:251]
m = F[..., 3] > 0
out.a[m] = F[m][:, :3]
print(save(out, '51_spring_thunder.png'))
