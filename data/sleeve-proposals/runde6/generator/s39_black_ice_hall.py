# -*- coding: utf-8 -*-
"""39 Black Ice Hall – Gegner „Slip 'n Slide“, Held: Hel, the Bound Specter.

Der geheime Kerzensaal aus Hels Base-Karte, aber der Boden ist zu schwarzem Spiegeleis gefroren (Slippery Ice:
diagonale Glanzstreifen, Kerzenlicht spiegelt sich). Hel schwebt halbtransparent mit ihrem fahlen Schein zwischen den
Kerzenleuchtern, ihr Artefakt in den Händen (an das sie gebunden ist), unter ihr ihr dunkler Schatten und ihr blasses
Spiegelbild im Eis. Hinter ihr schlittern von links ein Slippery Pengu (bäuchlings) und von rechts ein Slippery Polar (auf
Rollen) über das Eis aufeinander zu – die Slippery-Kreaturen rutschen in jedem Zug eine Zone weiter.

Quellen (MotiveArcanum.xcf):
  Ebene 32 „Ebene #55“ (Hel) + 31 „Ebene #112“ (Artefakt in ihren Händen) + 34 „Ebene #102“ (Schein) + 29
  „Ebene #110“ (Schein und Schatten) – so auf der Base-Karte „Hel, the Bound Specter“ (Sichtbar #34 = Ebene 28,
  Lage 599,150; dort halbtransparent). Ebene 30 „Ebene #89“ (Ketten) ist auf der Karte NICHT zu sehen → weggelassen.
  Ebene 154 „GEHEIMRAUM“ – der Saal der Karte (Mauer, Kerzenleuchter, Boden), Ausschnitt x630–755/y120–295;
  Thron und Tischchen dieses Saals entfernt (Mauer/Boden aus derselben Ebene fortgesetzt).
Motive.xcf: Ebene 804 „Pengu“ (Karte „Slippery Pengu“, gespiegelt), 785 „Polar“ (Karte „Slippery Polar“).
Selbst gezeichnet: Eisfärbung des Bodens mit Glanzstreifen, Spiegelungen, Hels Transparenz (Alpha auf ganze Pixel)
und gerasterter Schein.

Skalierung (Tiefenebenen):
  Hintergrund (Saal, Leuchter, Eis, Spiegelungen, Pengu, Polar, Schein, Schatten) – 2× (125×175)
  Vordergrund (Hel 16×27 → 80×135 px, Spiegelbild) – 5× (50×70)
"""
import math
import numpy as np
from gkit36_40 import *  # noqa

# ================================================================== Hintergrund 2× (125×175)
W2, H2 = 125, 175
RX, RY = 630, 120
room = layer('MotiveArcanum', 154)[RY:RY + H2, RX:RX + W2].copy()
bg = Plane(W2, H2, 2)
bg.a[:] = room
FLOOR_TOP = 38
# Thron + Tischchen des Saals entfernen (gehören nicht zu Hels Karte, würden ihre Kapuze verschlucken):
# Mauer mit der 16-px-Ziegelperiode fortsetzen, Boden aus reinen Bodenpixeln derselben Szene (Zeilen 90–98) auffüllen
import random
rnd = random.Random(39)
pool = room[90:99, 45:80].reshape(-1, 4)
orig = room.copy()
for y in range(26, 90):
    row = [orig[y, xx] for xx in list(range(39, 43)) + list(range(83, 87))
           if orig[y, xx, 2] >= orig[y, xx, 0] and int(orig[y, xx, :3].astype(int).sum()) < 200]
    for x in range(42, 84):
        if y < FLOOR_TOP: room[y, x] = orig[y, x - 32]
        else: room[y, x] = row[rnd.randrange(len(row))] if row else pool[rnd.randrange(len(pool))]
# Leuchter-Anschnitte am unteren Rand entfernen (ruhiger Vordergrund)
LOW = 119                            # Unterkante der Stufe – darunter der vordere Boden, ganz neu aus Bodenpixeln
for y in range(LOW, H2):
    for x in range(W2):
        room[y, x] = pool[rnd.randrange(len(pool))]
bg.a[:] = room
rgb = room[..., :3].astype(int)
floor = (rgb[..., 2] > rgb[..., 0]) & (rgb.sum(-1) < 330)
floor[:FLOOR_TOP] = False

# Eis: Bodenfarbe leicht zu Eisblau, diagonale Glanzstreifen (wie die Slippery-Ice-Fläche), zur Mitte heller
ICE_HI = (150, 170, 226)
for y in range(H2):
    for x in range(W2):
        if not floor[y, x]: continue
        c = bg.a[y, x, :3].astype(float)
        c = c * 0.85 + np.array((14, 30, 52)) * 0.6
        bg.a[y, x, :3] = np.clip(c, 0, 255)
        s = (x + y) % 14
        if s in (0, 1): bg.blend(x, y, ICE_HI, 0.16 if s == 0 else 0.10)
        elif s == 3 and (x // 7 + y // 7) % 2 == 0: bg.blend(x, y, ICE_HI, 0.07)

# Spiegelungen der Leuchter/Thron im Eis (senkrecht gespiegelt unter ihren Füßen, abgeschwächt)
def mirror_region(x0, x1, y_top, y_foot, depth, a0=0.40):
    for k in range(1, depth):
        sy, ty = y_foot - k, y_foot + k
        if sy < y_top or ty >= H2: break
        a = a0 * (1 - k / depth)
        for x in range(x0, x1):
            if not floor[ty, x] or floor[sy, x]: continue
            bg.blend(x, ty, room[sy, x, :3], a)


mirror_region(22, 38, 40, 69, 22)      # Leuchter links (Fuß bei Zeile ~69)
mirror_region(86, 102, 40, 69, 22)     # Leuchter rechts
# Kerzenflammen zusätzlich als warme, kurze Lichtstreifen im Eis
WARM = (240, 196, 110)
for fx in (24, 29, 34, 88, 93, 98):
    for k in range(3, 14):
        if floor[69 + k, fx] and (k + fx) % 3 != 0:
            bg.blend(fx, 69 + k, WARM, 0.22 * (1 - k / 14))

# Slippery Pengu (bäuchlings, von links) und Slippery Polar (auf Rollen, von rechts) rutschen hinter Hel vorbei
peng = flip(sprite('o39_pengu', 'Motive', [804]))       # Original blickt nach links → gespiegelt, rutscht nach rechts
polar = sprite('o39_polar', 'Motive', [785])            # blickt nach links, rollt zur Mitte
for s_, x0, foot in ((peng, 2, 96), (polar, 123 - polar.shape[1], 96)):
    h, w = s_.shape[:2]
    y0 = foot - h + 1
    # Spiegelung im Eis
    for k in range(1, 9):
        ty = foot + k; sy = h - k
        if sy < 0: break
        for i in range(w):
            if s_[sy, i, 3] and 0 <= x0 + i < W2 and floor[ty, x0 + i]:
                bg.blend(x0 + i, ty, s_[sy, i, :3], 0.30 * (1 - k / 9))
    bg.paste(s_, x0, y0)
# kurze Rutschspuren (helle Kratzer im Eis) hinter beiden
for x in range(0, 6):
    if floor[97, x]: bg.blend(x, 97, ICE_HI, 0.35)
for x in range(120, 125):
    if floor[97, x]: bg.blend(x, 97, ICE_HI, 0.35)

# Hels Schein (Ebene 34 als Vorbild) auf dem 2×-Raster: weicher, gerasterter Hof um ihre Gestalt
GL = (190, 222, 214)
gcx, gcy = 62.5, 90
for y in range(H2):
    for x in range(W2):
        d = math.hypot((x + 0.5 - gcx) / 1.0, (y + 0.5 - gcy) / 1.3)
        v = 0.42 * max(0.0, 1 - d / 34) ** 1.5
        q = dith(v, x, y, 5)
        if q > 0: bg.blend(x, y, GL, q)
# Hels Schatten (dunkelroter Fleck wie auf der Karte) auf dem Eis
for xx in range(-9, 10):
    for yy in range(-2, 3):
        if (xx / 9.5) ** 2 + (yy / 2.4) ** 2 <= 1: bg.blend(62 + xx, 132 + yy, (34, 4, 10), 0.75)

# Gesamtabdunklung zum Rand (Saal im Dunkeln, Mitte vom Geisterlicht erhellt)
for y in range(H2):
    for x in range(W2):
        d = math.hypot((x + 0.5 - 62.5) / 62.5, (y + 0.5 - 95) / 95)
        q = dith(0.55 * max(0.0, d - 0.55) / 0.6, x, y, 4)
        if q > 0: bg.blend(x, y, (2, 4, 10), q)

# ================================================================== Vordergrund 5× (50×70)
W5, H5 = 50, 70
fg = Plane(W5, H5, 5)
hel = sprite('o39_hel', 'MotiveArcanum', [31, 32])
hh, hw = hel.shape[:2]
HX, HY = 25 - hw // 2, 22
FOOT = HY + hh                       # Unterkante des Gewands
SHY = FOOT + 4                       # Schattenlinie (Schatten selbst auf dem 2×-Boden, Zeile 132 ≙ 5×-Zeile 52.8)
# Spiegelbild im Eis (unterhalb des Schattens, gespiegelt, blass)
ref = hel[::-1]
for j in range(ref.shape[0]):
    y = SHY + 1 + j
    if y >= H5: break
    a = 0.30 * (1 - j / 16)
    if a <= 0.04: break
    for i in range(hw):
        if ref[j, i, 3] == 0: continue
        c = np.array(ref[j, i, :3], float) * 0.6 + np.array((40, 60, 100)) * 0.4
        fg.px(HX + i, y, tuple(int(v) for v in c), int(255 * a))
# Hel selbst, halbtransparent wie auf der Karte
fg.paste(hel, HX, HY, alpha=0.82)

cv = compose_planes([bg, fg])
save(cv, '39_black_ice_hall.png')
print('ok', hel.shape, peng.shape)
