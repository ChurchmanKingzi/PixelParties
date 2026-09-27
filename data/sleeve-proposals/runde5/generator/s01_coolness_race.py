# -*- coding: utf-8 -*-
"""Sleeve 01 – „Coolness Race“ (Cool Rescuer Monia, Base): ein Wettflug senkrecht hinauf durch den Abendhimmel,
nach der Karte „Trial of Coolness“. Vorn und in Führung Monia mit ihren beiden feuernden Rückendüsen (so wie auf
ihrer Base-Karte und „Cool Tech Jetpack“), dahinter und darunter die Konkurrenz: das Rocket-Fist-Mädchen mit
seinen Düsen, die Victory-Phoenix-Heldin auf Flammenflügeln und ein Red Dragoneer, der aus den Wolken aufsteigt.

Skalierung (Tiefenebenen, weiter hinten = kleiner):
  Hintergrund 2× (125×175): Abendhimmel (Palette von „Trial of Coolness“), Sterne, Fahrtstreifen, Wolkenmeer –
                            selbst gezeichnet; dazu weit hinten Victory-Phoenix-Heldin und Red Dragoneer
  Mittelgrund 3× (84×117):  Rocket-Fist-Mädchen
  Vordergrund 5× (50×70):   Monia
Quellen (MotiveMoe.xcf): Monia = 511 „Monia“ + 510 „Monia #2“ (Base, Düsenflammen; vgl. Szene „Sichtbar #157“),
  Rocket-Fist-Mädchen = untere Figur aus 240 „Rocket Fist“, Victory-Phoenix-Heldin = 215 „Victory Phoenix Cannon #1“
  + Flamme 219 „Victory Phoenix Cannon #2“, Red Dragoneer = 5 „Red Dragoneer“ (Szene „Sichtbar #178“, vollständig).
"""
from common import *
import numpy as np

B = 'MotiveMoe'
monia = sprite('h01_monia_base', B, [510, 511])            # 26×30
phoenix = sprite('h01_phoenix', B, [215, 219])             # 72×78
dragon = sprite('h01_red_dragoneer', B, [5])               # 27×32
rf = layer(B, 240); b = bbox(rf)
rocket = max(parts(rf[b[1]:b[3], b[0]:b[2]], dil=1), key=lambda p: p.shape[0] * p.shape[1])   # untere Figur, 24×26

# ---------------------------------------------------------------- Hintergrund 2×
W2, H2 = 125, 175
bg = Canvas(W2, H2)
yy, xx = np.mgrid[0:H2, 0:W2]
TH = BAYER4[yy % 4, xx % 4]
sky = [(10, 16, 70), (18, 34, 120), (40, 52, 168), (96, 64, 176), (170, 80, 186), (228, 104, 180),
       (246, 150, 150), (252, 196, 140)]
t = np.clip((yy - 2) / 150, 0, 1) * (len(sky) - 1)
q = np.floor(t + TH * 0.999).clip(0, len(sky) - 1).astype(int)
for k, c in enumerate(sky):
    bg.a[q == k] = c
rng = np.random.RandomState(1)
for _ in range(40):
    x, y = rng.randint(0, W2), rng.randint(0, 60)
    bg.px(x, y, (220, 226, 255) if rng.rand() < 0.4 else (130, 140, 210))
# Fahrtstreifen: senkrecht (alle steigen, der Himmel zieht nach unten vorbei)
for _ in range(36):
    x = rng.randint(2, W2 - 2); y0 = rng.randint(4, 140); n = rng.randint(6, 16)
    for i in range(n):
        Y = y0 + i
        if Y < H2:
            bg.a[Y, x] = np.clip(bg.a[Y, x].astype(int) * 0.55 + np.array((255, 240, 250)) * 0.45, 0, 255)
# weit hinten: Victory-Phoenix-Heldin (links unten) und Red Dragoneer (rechts unten, aus den Wolken)
bg.paste(phoenix, 4, 82)
bg.paste(dragon, 88, 121)
def cloud_row(base, r, step, col, rim, phase):
    for cx in range(-r + phase, W2 + r, step):
        cy = base + ((cx * 7) % 5) - 2
        m = (np.hypot(xx - cx, (yy - cy) * 1.25) < r) | (yy > cy + 2)
        m &= yy >= cy - r
        bg.a[m] = col
        top = m & ~np.roll(m, 1, 0)
        bg.a[top] = rim
cloud_row(152, 9, 13, (238, 170, 196), (252, 214, 226), 0)
cloud_row(160, 10, 15, (246, 206, 222), (255, 236, 242), 6)
cloud_row(168, 11, 17, (252, 236, 244), (255, 255, 255), 2)

# ---------------------------------------------------------------- Rocket-Fist-Mädchen 3×
W3, H3 = 84, 117
mid = np.zeros((H3, W3, 4), np.uint8)
RX, RY = 54, 58
m = rocket[..., 3] > 0
mid[RY:RY + rocket.shape[0], RX:RX + rocket.shape[1]][m] = rocket[m]

# ---------------------------------------------------------------- Monia 5× (vorn, in Führung)
W5, H5 = 50, 70
fg = np.zeros((H5, W5, 4), np.uint8)
MX, MY = (W5 - monia.shape[1]) // 2 - 3, 9
m = monia[..., 3] > 0
fg[MY:MY + monia.shape[0], MX:MX + monia.shape[1]][m] = monia[m]

# ---------------------------------------------------------------- zusammensetzen
out = Canvas(250, 350)
out.a[:] = up(np.dstack([bg.a, np.full((H2, W2), 255, np.uint8)]), 2)[..., :3]
for L, k, off in ((mid, 3, 1), (fg, 5, 0)):
    F = up(L, k)[off:off + 350, off:off + 250]
    mm = F[..., 3] > 0
    out.a[:F.shape[0], :F.shape[1]][mm] = F[mm][:, :3]
print(save(out, '01_coolness_race.png'))
