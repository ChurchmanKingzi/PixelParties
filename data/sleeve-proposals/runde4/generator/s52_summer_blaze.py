# -*- coding: utf-8 -*-
"""Sleeve 52 – „Summer Blaze“: Zhuque, der Zinnobervogel des Südens, steigt mit weit ausgebreiteten Schwingen
vor der weißglühenden Mittagssonne auf; Flammenzungen lodern an seinen Schwingen, Funken stieben, unter ihm
flimmern die Dünen in der Sommerhitze. Gegenstück zu „Autumn Tiger“ (Baihu, Westen/Herbst), „Black Tortoise“
(Xuanwu, Norden/Winter) und „Spring Thunder“ (Qinglong, Osten/Frühling): Süden = Mittag, Sommer, Feuer.

Skalierung (zwei Tiefenebenen):
  Hintergrund 2× (125×175): Sommerhimmel, Sonne mit Strahlenkranz, Dünen mit Hitzeflimmern – selbst gezeichnet
  Vordergrund 3× (84×117): Zhuque, Flammen und Funken (Flammen/Funken selbst gezeichnet in Zhuques Palette)
Quellen (MotiveEgypt.xcf, Karte „Cardinal Beast Zhuque“, Szene 2): Zhuque = Ebene 4 „Zhuque #1“
(vollständig, pixelgleich mit der Kartenszene); das weiche Glühen der Karte (Ebene 3) wird durch die Sonne ersetzt.
"""
from common import *
import numpy as np

# ---------------------------------------------------------------- Hintergrund 2×
W2, H2 = 125, 175
bg = Canvas(W2, H2)
yy, xx = np.mgrid[0:H2, 0:W2]
TH = BAYER4[yy % 4, xx % 4]
sky = [(14, 40, 118), (22, 64, 156), (36, 96, 190), (68, 136, 214), (120, 176, 228), (186, 214, 236)]
t = np.clip((yy - 6) / 124, 0, 1) * (len(sky) - 1)
q = np.floor(t + TH * 0.999).clip(0, len(sky) - 1).astype(int)
for k, c in enumerate(sky):
    bg.a[q == k] = c
SX, SY = 62.5, 66                                        # Sonne hinter Zhuques Leib
d = np.hypot(xx + .5 - SX, yy + .5 - SY)
ang = np.degrees(np.arctan2(yy + .5 - SY, xx + .5 - SX))
# Strahlenkranz: 20 Sektoren, abwechselnd heller, nach außen gedithert auslaufend
ray = (np.floor((ang + 360 + 4.5) / 9).astype(int) % 2 == 0)
f = np.clip(1 - (d - 24) / 44, 0, 1) * ray * (d > 22)
m = f * 0.55 > TH
bg.a[m] = (bg.a[m] * 0.45 + np.array((255, 236, 170)) * 0.55).astype(np.uint8)
glow = (d < 30) & (np.clip(1 - (d - 22) / 8, 0, 1) > TH)
bg.a[glow] = (255, 214, 120)
bg.a[d < 22] = (255, 236, 176)
bg.a[d < 18] = (255, 250, 222)
bg.a[(d < 22) & (d >= 19) & (TH > 0.45)] = (255, 226, 150)

# Dünen: drei Ketten, vorne wärmer und dunkler; Lichtkante oben, Sonnen- und Schattenflanke flächig
def dune(base, amp, per, phase, lit, shade, rim):
    h = base - amp * (0.65 * np.sin(xx[0] / per + phase) + 0.35 * np.sin(xx[0] / (per * 0.5) + phase * 1.7))
    top = np.round(h).astype(int)
    slope = np.gradient(h)
    for x in range(W2):
        bg.a[top[x]:, x] = lit if slope[x] <= 0.05 else shade
        bg.a[top[x], x] = rim
    return top

dune(140, 4, 11, 0.8, (226, 178, 118), (206, 152, 100), (246, 214, 160))
dune(152, 6, 9, 2.6, (214, 150, 86), (184, 120, 70), (240, 196, 130))
dune(165, 6, 8, 4.4, (192, 118, 60), (158, 90, 48), (230, 170, 100))
# Hitzeflimmern: einzelne helle, waagrecht gestrichelte Zeilen über der fernen Dünenkette
for y in (131, 135):
    for x in range(W2):
        if (x // 3 + y) % 4 == 0:
            bg.a[y, x] = np.clip(bg.a[y, x].astype(int) + 26, 0, 255)

# ---------------------------------------------------------------- Vordergrund 3×
W3, H3 = 84, 117
fg = np.zeros((H3, W3, 4), np.uint8)
z = sprite('r4z_zhuque', 'MotiveEgypt', [4])            # 59×44
ZX, ZY = (W3 - z.shape[1]) // 2, 28

# Flammenzungen an den oberen Schwingenkanten: je Spalte die oberste Pixelzeile der Schwinge; darüber lodert eine
# Flamme, deren Höhe von Spalte zu Spalte springt (gezackte Zungen, zu den Schwingenspitzen hin höher).
# Farben aus Zhuques Palette: innen hell (weißgelb/gelb), außen orange/rot, Spitze dunkelrot.
FL = [(255, 230, 170), (255, 190, 91), (247, 145, 83), (201, 103, 64), (111, 19, 8)]
rng = np.random.RandomState(52)
top = np.full(z.shape[1], -1)
for c in range(z.shape[1]):
    ys = np.where(z[:, c, 3] > 0)[0]
    if len(ys): top[c] = ys[0]
body = z.shape[1] / 2
raw = np.array([rng.randint(0, 5) for _ in range(z.shape[1])], float)
for c in range(z.shape[1]):
    if top[c] < 0 or abs(c + .5 - body) < 7: continue
    w = abs(c + .5 - body) / body                          # 0 an der Brust, 1 an der Schwingenspitze
    hgt = int(round(2 + 7 * w * (0.45 + 0.55 * abs(np.sin(c * 0.9))) + raw[c]))
    x = ZX + c
    for i in range(hgt):
        y = ZY + top[c] - 1 - i
        if y < 0: break
        fr = i / max(1, hgt - 1)
        k = 0 if fr < 0.25 else 1 if fr < 0.5 else 2 if fr < 0.75 else 3
        if i == hgt - 1 and hgt > 3: k = 4
        fg[y, x, :3] = FL[k]; fg[y, x, 3] = 255
# Funken: einzelne helle Pixel über den Schwingen
for _ in range(26):
    x = rng.randint(4, W3 - 4); y = rng.randint(8, ZY + 12)
    if fg[y, x, 3] == 0:
        fg[y, x, :3] = FL[1] if rng.rand() < 0.6 else FL[0]; fg[y, x, 3] = 255
m = z[..., 3] > 0
fg[ZY:ZY + z.shape[0], ZX:ZX + z.shape[1]][m] = z[m]

# ---------------------------------------------------------------- zusammensetzen
out = Canvas(250, 350)
out.a[:] = up(np.dstack([bg.a, np.full((H2, W2), 255, np.uint8)]), 2)[..., :3]
F = up(fg, 3)[1:351, 1:251]
m = F[..., 3] > 0
out.a[m] = F[m][:, :3]
print(save(out, '52_summer_blaze.png'))
