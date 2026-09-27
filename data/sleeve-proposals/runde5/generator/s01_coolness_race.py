# -*- coding: utf-8 -*-
"""Sleeve 01 – „Coolness Race“ (Cool Rescuer Monia, Base): Wettflug waagrecht durch den Abendhimmel nach der
Karte „Trial of Coolness“. Monia rast mit ihrem feuernden Jetpack vorneweg, weiter hinten und tiefer versucht ihre
geflügelte Rivalin aus „Trial of Coolness“ mitzuhalten, und ganz hinten zieht Wowkyrie auf ihrem fliegenden
Einhorn mit Regenbogenspur mit (Karte „Wowkyrie, Bringer of Coolness“).

Skalierung (drei Tiefenebenen):
  Hintergrund 2× (125×175): Abendhimmel (Palette der Kartenszene), Sterne, Fahrtstreifen, Wolkenmeer – selbst
                            gezeichnet; dazu ganz hinten Wowkyrie auf dem Einhorn
  Rivalin 3× (84×117): weiter hinten, kleiner, mit gestrichelter Federspur
  Monia 5× (50×70): Vordergrund
Quellen: MotiveMoe.xcf, Karte „Trial of Coolness“, Szene 60 „Sichtbar“: Ebene 320 „Trial of Coolness #1“ –
Monia (Base: blaue Haare, schwarzer Anzug, Jet-Flamme) und die Rivalin, Kopf an Kopf. Die Ebene liegt als
3×-Vergrößerung vor; die Originalpixel werden aus den Blockmitten gelesen und die Figuren an ihrer
Berührungsstelle getrennt; die Rivalin ist gespiegelt, damit beide in dieselbe Richtung fliegen.
MotiveCoolhalla.xcf, Karte „Wowkyrie, Bringer of Coolness“, Szene 262 „Sichtbar #7“: Ebene 215 „Ebene #22“
(Wowkyrie auf dem Einhorn mit Regenbogen) + 214 „Ebene #23“ (Flügelhelm), gespiegelt; der Regenbogen läuft wie
auf der Karte aus dem Bild hinaus.
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
# ganz hinten: Wowkyrie auf ihrem Einhorn, gespiegelt (fliegt nach rechts), Regenbogen läuft links hinaus
wow = flip(sprite('h01_wowkyrie', 'MotiveCoolhalla', [214, 215]))
WX, WY = -12, 7
bg.paste(wow, WX, WY)
# rechts unten, knapp über dem Wolkenmeer: die Phoenix-Tackle-Heldin mit ihrem Feuervogel vorneweg, gespiegelt
phx = flip(sprite('h01_phoenix_tackle', 'MotiveMoe', [416, 417, 418]))
PX, PY = 48, 85
bg.paste(phx, PX, PY)
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
RX, RY = 6, 80
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
MX, MY = W5 - monia.shape[1] - 7, 18
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
