# -*- coding: utf-8 -*-
"""01 Searing Grace – Gegner „Heal Burn“, Held: Nao, the Barrier Priestess (Base-Version).
(Docstring wird nach Fertigstellung ergänzt.)
"""
import math, random
from a_util import *  # noqa
import numpy as np

B = 'Motive'
rnd = random.Random(1)

# ---- Quellen -------------------------------------------------------------------------------
full477 = compose(B, [477], crop=False)
nao = trimmed(full477[190:262, 285:335].copy())                  # Nao mit goldenem Stab (31×24)
T = compose(B, [1080], crop=False)                               # „Schatzgrotte-Kopie“: goldener Tempel
fire = compose(B, [475, 476], crop=False)                        # Feuerflügel der Kartenszene

brick = T[200:208, 360:392].copy()                               # Ziegelwand-Kachel (32×8)
parq = T[200:216, 262:278].copy()                                # Flechtboden-Kachel (16×16)
spikes = T[238:250, 280:344].copy()                              # Stachelreihe auf Flechtboden (64×12)


def cutout_mask(reg):
    """Steinmaske + Ranken aus der Tempelwand lösen (graue, grüne und sehr dunkle Pixel)."""
    c = reg[..., :3].astype(int)
    sat = c.max(-1) - c.min(-1); v = c.max(-1)
    m = (sat < 40) | ((c[..., 1] > c[..., 0]) & (c[..., 1] > c[..., 2])) | (v < 50)
    out = reg.copy(); out[..., 3] = np.where(m, 255, 0)
    return out


maskL = trimmed(cutout_mask(T[164:201, 258:290]))
maskR = trimmed(cutout_mask(T[164:201, 322:352]))

# ---- Ebene 1: Tempel + Feuer + Schein (2×, 125×175) -------------------------------------------
W2, H2 = 125, 175
p2 = rgba(W2, H2)
WALL = 112                                    # Wandfuß (2×-Raster)
for y in range(WALL):
    for x in range(W2):
        p2[y, x] = brick[y % 8, (x + 3) % 32]
for y in range(WALL, H2):
    for x in range(W2):
        p2[y, x] = parq[(y - WALL) % 16, (x + 6) % 16]
# Stachelreihe am Wandfuß (wie in der Kartenszene)
for x0 in range(-10, W2, 64):
    put(p2, spikes, x0, WALL - 2)
# zwei Steinmasken mit Ranken, symmetrisch
put(p2, maskL, 12, 22)
put(p2, maskR, W2 - 12 - maskR.shape[1], 22)
# Raum nach oben und zu den Rändern hin abdunkeln (Tempel im Halbdunkel)
for y in range(H2):
    for x in range(W2):
        dx = (x + 0.5 - W2 / 2) / (W2 / 2)
        f = 0.55 + 0.45 * min(1, max(0, (y - 5) / 95.0))
        f *= 1 - 0.35 * dx * dx
        if y >= WALL: f = (0.72 - 0.3 * (y - WALL) / (H2 - WALL)) * (1 - 0.3 * dx * dx)
        p2[y, x, :3] = (p2[y, x, :3] * f).astype(np.uint8)

# Feuerflügel (Ausschnitt der Kartenszene rund um Nao), Ringmitte im Original ca. (318, 205)
FX0, FY0, FX1, FY1 = 250, 150, 382, 290
fr = fire[FY0:FY1, FX0:FX1].copy()
# nur die große Flamme behalten (der abgelöste rote Funke links oben der Szene entfällt)
from xcfkit import bbox as _bb
import cv2
_m = (fr[..., 3] > 0).astype(np.uint8)
_n, _lab, _st, _ = cv2.connectedComponentsWithStats(cv2.dilate(_m, np.ones((3, 3), np.uint8)), connectivity=8)
_big = 1 + int(np.argmax(_st[1:, cv2.CC_STAT_AREA]))
fr[(_lab != _big)] = 0
RCX, RCY = 318 - FX0, 205 - FY0
CX2, CY2 = 62, 92
# Barrierenschein: heller, weicher Kern hinter Nao (selbst gezeichnet nach Ebene 471 der Szene)
GLOW = [(236, 196, 110), (250, 228, 160), (255, 244, 208), (255, 252, 238)]
for y in range(H2):
    for x in range(W2):
        d = math.hypot((x + 0.5 - CX2) / 30.0, (y + 0.5 - CY2) / 30.0)
        if d < 1.0:
            t = (1 - d) * 3.2
            k = min(3, int(t) + (1 if t - int(t) > bayer(x, y) else 0))
            if k > 0: p2[y, x, :3] = GLOW[k - 1] if k < 4 else GLOW[3]
put(p2, fr, CX2 - RCX, CY2 - RCY)
# Ringinneres der Flamme mit dem Kernlicht füllen (die Flamme hat innen ein Loch)
for y in range(H2):
    for x in range(W2):
        d = math.hypot((x + 0.5 - CX2) / 19.0, (y + 0.5 - CY2) / 21.0)
        if d < 1.0:
            t = (1 - d) * 4
            p2[y, x, :3] = GLOW[3] if t > 1 + bayer(x, y) else GLOW[2]
# Heilfunken: grüne Heilkreuze steigen vom Boden auf und färben sich zur Flamme hin zu Glut
# (Heilung wird Schaden). Kreuz 5×5 mit dunklem Rand, im 2×-Raster.
SPK = {0: ((150, 240, 140), (40, 130, 60)), 1: ((255, 222, 110), (190, 110, 30)), 2: ((255, 150, 60), (150, 40, 20))}
for (x, y, heat) in [(22, 160, 0), (104, 157, 0), (15, 136, 0), (111, 133, 0), (40, 60, 1), (85, 58, 1), (50, 38, 2), (75, 36, 2)]:
    c, dk = SPK[heat]
    for (dx, dy) in ((0, -2), (0, -1), (0, 0), (0, 1), (0, 2), (-2, 0), (-1, 0), (1, 0), (2, 0)):
        for (ex, ey) in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            xx, yy = x + dx + ex, y + dy + ey
            if abs(xx - x) + abs(yy - y) >= 1 and not ((xx == x and abs(yy - y) <= 2) or (yy == y and abs(xx - x) <= 2)):
                p2[yy, xx, :3] = dk
    for (dx, dy) in ((0, -2), (0, -1), (0, 0), (0, 1), (0, 2), (-2, 0), (-1, 0), (1, 0), (2, 0)):
        p2[y + dy, x + dx, :3] = c
# Bodenschatten unter Nao (im 2×-Raster, liegt auf dem Boden)
shadow_ellipse(p2, 58.5, 144.5, 16, 3.0, a=0.5)
cv = Canvas(250, 350)
blit(cv, p2, 2)

# ---- Ebene 2: Nao + Heilfunken (5×, 50×70) ------------------------------------------------------
W5, H5 = 50, 70
p5 = rgba(W5, H5)
NX = (W5 - nao.shape[1]) // 2 - 3           # Kopf (nicht Stabspitze) auf der Mittelachse
NY = 58 - nao.shape[0]

put(p5, nao, NX, NY)
blit(cv, p5, 5, 0, 0)
print(save(cv, '01_searing_grace.png'))
print(preview('01_searing_grace.png', 'ornate', 'gold', 'ruby'))
