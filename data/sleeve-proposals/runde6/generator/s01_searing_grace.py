# -*- coding: utf-8 -*-
"""01 Searing Grace – Gegner „Heal Burn“, Held: Nao, the Barrier Priestess (Base-Version).
Nao wehrt ab: Sie steht groß im goldenen Tempel ihrer Karte, umhüllt von ihrer schimmernden Barriere. Ein
Feuerball schlägt von rechts gegen die Barriere und zerstiebt an ihr in Funken und Flammenzungen, ein zweiter
fliegt von links oben heran – Nao bleibt im Innern unversehrt.

Quellen (Motive.xcf):
  Ebene 477 „NAO-Kopie“, Ausschnitt x285–335/y190–262: Base-Nao mit goldenem Stab (31×24). Gegen Sichtbar #42
      (Ebene 99, Kartenbild „Nao, the Barrier Priestess“, Lage 278,193) geprüft: Kopf/Oberkörper pixelgleich,
      Unterkörper und Dreizackspitze sind im Kartenbild vom Barrierenglühen überdeckt.
  Ebene 1539 „Fireball“: der Feuerball (19×11), einmal gespiegelt.
  Ebene 1080 „Schatzgrotte-Kopie“: Ziegelwand-, Flechtboden- und Stachelreihen-Kacheln, Steinmasken mit Ranken.
Selbst gezeichnet (nach dem weißen Barrierenschein der Kartenszene, Ebene 471): Barrierenkugel (Rand + halb-
transparente Füllung auf ganzen 5×-Pixeln), Einschlag mit Funken und Flammenzungen, Abdunklung, Schatten.

Skalierung (Ausgabe = 250×350-Raster × 3):
  Tempelwand, Boden, Masken, Schatten             – 2× (125×175)
  Nao, Barriere, Feuerbälle, Einschlag            – 5× (50×70)
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
fireball = [p for p in parts(compose(B, [1539]), dil=1) if p.shape[0] < 15][0]   # Feuerball (11×19), fliegt nach rechts

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

# Bodenschatten unter Nao (Füße bei 250er-y 290 → 2×-Reihe 145)
shadow_ellipse(p2, 62.5, 144.8, 15, 2.8, a=0.5)
cv = Canvas(250, 350)
blit(cv, p2, 2)

# ---- Ebene 2: Nao, Barriere, Feuerbälle (5×, 50×70) -------------------------------------------
W5, H5 = 50, 70
NX = 6                                                   # Gesichtsmitte (Sprite-x 19) → 250er-x 125
NY = 58 - nao.shape[0]
BCX, BCY, BR = 23.5, NY + 11.0, 18.0                     # Barrierenkugel um Nao (samt Stab)
# halbtransparente Füllung + Rand der Barriere (ganze 5×-Pixel, Alpha)
bar = rgba(W5, H5)
for y in range(H5):
    for x in range(W5):
        d = math.hypot(x + 0.5 - BCX, y + 0.5 - BCY)
        if d < BR:
            e = d / BR
            if e > 0.93:   bar[y, x] = [236, 250, 255, 235]          # heller Rand
            elif e > 0.82: bar[y, x] = [200, 236, 255, 120]          # innerer Randschein
            else:          bar[y, x] = [220, 244, 255, 46 + int(40 * e)]   # zarte Füllung, zum Rand dichter
for (x, y) in [(13, int(BCY) - 12), (12, int(BCY) - 11), (14, int(BCY) - 13), (11, int(BCY) - 10)]:
    bar[y, x] = [255, 255, 255, 255]                           # Glanzlicht oben links
cv.paste(up(bar, 5), 0, 0)
p5 = rgba(W5, H5)
put(p5, nao, NX, NY)
F1, F2, F3, F4 = (255, 250, 214), (255, 214, 80), (246, 120, 30), (200, 40, 20)
def impact(ang0, spread):
    """Einschlag am Kugelrand: Glutkern, Funken, zu beiden Seiten am Rand zerfließende Flammenzungen."""
    IX = int(round(BCX + BR * math.cos(ang0) - 0.5)); IY = int(round(BCY + BR * math.sin(ang0) - 0.5))
    ox, oy = math.cos(ang0), math.sin(ang0)                           # Außennormale
    # aufleuchtender Barrierenrand rund um den Treffer
    for k in range(-6, 7):
        a_ = ang0 + k * 0.06
        x = int(round(BCX + (BR - 0.6) * math.cos(a_) - 0.5)); y = int(round(BCY + (BR - 0.6) * math.sin(a_) - 0.5))
        if 0 <= x < W5 and 0 <= y < H5: p5[y, x] = [255, 252, 220, 255] if abs(k) < 4 else [255, 236, 150, 255]
    for (t, n, c) in [(0, 0, F1), (0, 1, F1), (1, 1, F1), (-1, 1, F1), (1, 0, F1), (-1, 0, F1), (0, 2, F2),
                      (2, 1, F2), (-2, 1, F2), (2, 2, F2), (-2, 2, F2), (1, 3, F2), (-1, 3, F2), (3, 2, F3), (-3, 2, F3),
                      (0, 3, F3), (2, 4, F3), (-2, 4, F3), (4, 3, F4), (-4, 3, F4), (0, 5, F4), (3, 5, F4), (-3, 5, F4),
                      (5, 1, F4), (-5, 1, F4), (1, 6, F4), (-1, 6, F4)]:
        # t: entlang der Tangente, n: nach außen
        x = int(round(IX - oy * t + ox * n)); y = int(round(IY + ox * t + oy * n))
        if 0 <= x < W5 and 0 <= y < H5: p5[y, x] = list(c) + [255]
    for sgn in (-1, 1):
        for k in range(1, spread):
            a_ = ang0 + sgn * k * 0.075
            c = F1 if k < 3 else F2 if k < 6 else F3 if k < 9 else F4
            for rr in (BR + 0.4, BR + 1.3):
                if k > 7 and rr > BR + 1: continue
                x = int(round(BCX + rr * math.cos(a_) - 0.5)); y = int(round(BCY + rr * math.sin(a_) - 0.5))
                if 0 <= x < W5 and 0 <= y < H5: p5[y, x] = list(c) + [255]
    return IX, IY
# Feuerball von rechts schlägt rechts oben auf die Barriere (gespiegelt, Kopf nach links)
angR = -0.85
IX, IY = impact(angR, 12)
fbR = fireball[:, ::-1]
put(p5, fbR, IX + 1, IY - fbR.shape[0] // 2 - 1)
# zweiter Feuerball fliegt von links oben heran, gleich trifft er die Kugel am Scheitel
put(p5, fireball, 1, int(BCY - BR) - 7)
blit(cv, p5, 5, 0, 0)
print(save(cv, '01_searing_grace.png'))
print(preview('01_searing_grace.png', 'ornate', 'gold', 'ruby', 'topaz'))
