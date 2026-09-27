# -*- coding: utf-8 -*-
"""Sleeve 01 – „Coolness Race“ (Cool Rescuer Monia, Base): Monia jagt mit feuerndem Jetpack waagrecht durch den
Abendhimmel, hinter ihr eine Kette aus Rauchbällchen; weiter hinten und tiefer versucht ihre geflügelte Rivalin aus
„Trial of Coolness“ mitzuhalten. Nach der Karte „Trial of Coolness“ (Wettflug durch den rosa-blauen Abendhimmel).

Skalierung (drei Tiefenebenen):
  Hintergrund 2× (125×175): Abendhimmel (Palette der Kartenszene), Sterne, Fahrtstreifen, Wolkenmeer – selbst gezeichnet
  Rivalin 3× (84×117): weiter hinten, kleiner, mit gestrichelter Federspur
  Monia 5× (50×70): Vordergrund, mit ihrer eigenen Jet-Flamme und der daran anschließenden Rauchspur
Quellen (MotiveMoe.xcf, Karte „Trial of Coolness“, Szene 60 „Sichtbar“): Ebene 320 „Trial of Coolness #1“ –
Monia (Base: blaue Haare, schwarzer Anzug, Jet-Flamme) und die Rivalin, Kopf an Kopf. Die Ebene liegt als
3×-Vergrößerung vor; die Originalpixel werden aus den Blockmitten gelesen und die Figuren an ihrer
Berührungsstelle getrennt; die Rivalin ist gespiegelt, damit beide in dieselbe Richtung fliegen.
"""
from common import *
import numpy as np

B = 'MotiveMoe'
raw = layer(B, 320)
b = bbox(raw)
nat = raw[b[1]:b[3], b[0]:b[2]][1::3, 1::3].copy()        # 18×57 Originalpixel
SPLIT = 27                                                 # Spalte zwischen Monias Gesicht und dem Kopf der Rivalin
def largest(s):
    return max(parts(s, dil=0), key=lambda p: (p[..., 3] > 0).sum())
monia = largest(nat[:, :SPLIT])                          # fliegt nach rechts, Flamme hinten links
rival = flip(largest(nat[:, SPLIT:]))                    # gespiegelt: fliegt ebenfalls nach rechts, hinterher

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
for _ in range(40):                                        # Sterne im oberen, dunklen Himmel
    x, y = rng.randint(0, W2), rng.randint(0, 60)
    bg.px(x, y, (220, 226, 255) if rng.rand() < 0.4 else (130, 140, 210))
# Fahrtstreifen: waagrechte, helle Striche (die beiden rasen nach rechts, der Himmel zieht nach links vorbei)
for _ in range(40):
    y = rng.randint(8, 140); x0 = rng.randint(-10, W2); n = rng.randint(6, 18)
    for i in range(n):
        X = x0 + i
        if 0 <= X < W2:
            bg.a[y, X] = np.clip(bg.a[y, X].astype(int) * 0.55 + np.array((255, 240, 250)) * 0.45, 0, 255)
# Wolkenmeer unten: drei Reihen Wolkenbuckel, hinten rosa, vorne weiß
def cloud_row(base, r, step, col, rim, phase):
    for cx in range(-r + phase, W2 + r, step):
        cy = base + ((cx * 7) % 5) - 2
        m = (np.hypot(xx - cx, (yy - cy) * 1.25) < r) | (yy > cy + 2)
        m &= yy >= cy - r
        bg.a[m] = col
        top = m & ~np.roll(m, 1, 0)
        bg.a[top] = rim
cloud_row(146, 9, 13, (238, 170, 196), (252, 214, 226), 0)
cloud_row(156, 10, 15, (246, 206, 222), (255, 236, 242), 6)
cloud_row(166, 11, 17, (252, 236, 244), (255, 255, 255), 2)

# ---------------------------------------------------------------- Rivalin 3× (weiter hinten, unten links)
W3, H3 = 84, 117
mid = np.zeros((H3, W3, 4), np.uint8)
RX, RY = 20, 72
# ihre Flugspur: hellblaue, gestrichelte Streifen, die an den Federspitzen ihrer Schwinge ansetzen
FEATHER = [(214, 232, 255), (160, 196, 246), (120, 150, 230)]
wing_rows = [y for y in range(rival.shape[0]) if (rival[y, :, 3] > 0).any() and y < rival.shape[0] // 2]
for j, yy_ in enumerate(wing_rows[1::2]):
    xs_ = np.where(rival[yy_, :, 3] > 0)[0]
    x_end = RX + xs_.min() - 1
    length = 16 - 3 * j
    for i in range(length):
        x = x_end - i
        if x < 0: break
        if i > length * 0.55 and i % 2: continue            # nach hinten gestrichelt auslaufend
        mid[RY + yy_, x, :3] = FEATHER[min(2, i * 3 // max(1, length))]; mid[RY + yy_, x, 3] = 255
m = rival[..., 3] > 0
mid[RY:RY + rival.shape[0], RX:RX + rival.shape[1]][m] = rival[m]

# ---------------------------------------------------------------- Monia 5× (vorn, führt)
W5, H5 = 50, 70
fg = np.zeros((H5, W5, 4), np.uint8)
MX, MY = W5 - monia.shape[1] - 7, 16
# Abgasspur hinter der Flamme: kurzes Flammenstück, dann eine Kette lockerer Rauchbällchen, die nach hinten
# (links) größer, blasser und lückenhafter werden (Farben: Flamme der Figur, Rauch weiß-lila)
FL = [(255, 250, 200), (250, 226, 60), (244, 128, 40), (206, 44, 40)]
SMOKE = [(252, 248, 252), (230, 220, 238), (200, 186, 218)]
ys = np.where(monia[:, :3, 3] > 0)[0]                     # Flammenspitze am linken Rand der Figur
fy = MY + int(round(ys.mean())) if len(ys) else MY + 12
for i in (1, 2):
    for dy in (-1, 0, 1)[:3 - i + 1]:
        fg[fy + dy, MX - i, :3] = FL[i + abs(dy)]; fg[fy + dy, MX - i, 3] = 255
x, r = MX - 3, 1.7
rng2 = np.random.RandomState(7)
while x > -6:
    cy = fy + rng2.randint(-1, 2)
    for yy_ in range(int(cy - r - 1), int(cy + r + 2)):
        for xx_ in range(int(x - r - 1), int(x + r + 2)):
            if not (0 <= xx_ < W5 and 0 <= yy_ < H5): continue
            d = np.hypot(xx_ + .5 - x, yy_ + .5 - cy) / r
            if d > 1: continue
            if d > 0.7 and (xx_ + yy_) % 2 and r > 2: continue
            k = 0 if (yy_ < cy - r * 0.2 and d < 0.7) else 1 if d < 0.8 else 2
            if fg[yy_, xx_, 3] == 0: fg[yy_, xx_, :3] = SMOKE[k]; fg[yy_, xx_, 3] = 255
    x -= r * 1.05 + 0.6
    r = min(r + 0.4, 4.5)
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
