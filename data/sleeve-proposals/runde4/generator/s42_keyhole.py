# -*- coding: utf-8 -*-
"""42 Through the Keyhole – Blick durch ein großes Schlüsselloch in einer dunklen Eichentür: im hell
erleuchteten Thronsaal dahinter hat sich der Corgi der Kaiserin (mit Krönchen) auf den goldenen Thron gesetzt.

Quellen (MotiveBritain.xcf):
  Ebene 176 „Ebene #75“ – Thronsaal (Karte „Unwanted Audience“ / Kaiserin-Szenen); die leere Stelle
                           hinter dem Thron mit Mauerwerk derselben Ebene (x 450–466) aufgefüllt   Hintergrund 3×
  Ebene 212 „Ebene #27“ – Corgi, Ebene 211 „Ebene #31“ – Krönchen, Ebene 209 „Ebene #33“ – Glanz
                           (zusammen geprüft gegen „Sichtbar #8“)                                  Hintergrund 3×
Tür, Beschlagplatte, Schlüsselloch, Lichtschein selbst gezeichnet im 4×-Raster (63×88).
Skalierung: Thronsaal + Corgi 3×, Tür/Schlüsselloch (Vordergrund) 4×.
"""
import math
import numpy as np
from kit41_45 import *  # noqa

B = 'MotiveBritain'
room = compose(B, [176], crop=False).copy()
# Lücke hinter dem Thron (y 352–368, x 500–548) mit der Mauer links neben dem Gitterfenster füllen
src = room[352:368, 450:466].copy()
for x in range(500, 548):
    room[352:368, x] = src[:, (x - 500) % 16]
corgi = sprite('i42_corgi', B, [209, 211, 212])

# ---------------------------------------------------------------- Thronsaal (3×)
bg = G(3)
X0, Y0 = 481, 383 - 40
bg.a[:] = room[Y0:Y0 + bg.h, X0:X0 + bg.w]
bg.a[..., 3] = 255
# Corgi sitzt auf dem roten Polster, Pfoten auf der Sitzkante (y≈396), mittig über x=523
bg.pb(corgi, 523 - X0 + 1, 397 - Y0)

# ---------------------------------------------------------------- Tür mit Schlüsselloch (4×)
fg = G(4)
W4, H4 = fg.w, fg.h
yy, xx = np.mgrid[0:H4, 0:W4]
rng = np.random.default_rng(42)
OAK = [(30, 18, 12), (52, 31, 20), (68, 42, 26), (84, 54, 33), (104, 68, 42)]
# Bretter (7 Zellen breit), Maserung als kurze senkrechte Striche
fg.rect(0, 0, W4, H4, OAK[2])
for bx in range(-3, W4, 7):
    fg.rect(bx, 0, bx + 1, H4, OAK[0])                      # Fuge
    fg.rect(bx + 1, 0, bx + 2, H4, OAK[3])                  # Kante hell
    for n in range(9):
        x = bx + 2 + rng.integers(0, 5); y = rng.integers(0, H4); L = rng.integers(4, 12)
        fg.rect(x, y, x + 1, y + L, OAK[1] if n % 3 else OAK[3])
# Eisenbänder oben und unten mit Nieten
IRON = [(24, 24, 30), (54, 54, 64), (86, 86, 98)]
for by in (9, 76):
    fg.rect(0, by, W4, by + 3, IRON[1]); fg.rect(0, by, W4, by + 1, IRON[2]); fg.rect(0, by + 3, W4, by + 4, IRON[0])
    for x in range(3, W4, 7):
        fg.px(x + 2, by + 1, IRON[2]); fg.px(x + 2, by + 2, IRON[0])

# Messing-Beschlagplatte (abgerundetes Schild) um das Schlüsselloch
CX, CY, R = 31.5, 30.0, 19.0
BR = [(58, 36, 14), (120, 82, 30), (170, 124, 48), (214, 170, 80), (246, 214, 130)]
def rrect(hw, y0, y1, rad):
    """Abgerundetes Rechteck (halbe Breite hw um CX, y0..y1, Eckradius rad)."""
    qx = np.clip(np.abs(xx + .5 - CX) - (hw - rad), 0, None)
    qy = np.clip(np.maximum(y0 + rad - (yy + .5), (yy + .5) - (y1 - rad)), 0, None)
    return np.hypot(qx, qy) <= rad
plate = rrect(23, 6, 80, 7)
ring_o = plate & ~np.pad(plate[1:-1, 1:-1] & plate[:-2, 1:-1] & plate[2:, 1:-1] & plate[1:-1, :-2] & plate[1:-1, 2:], 1)
fg.dfill(plate, BR[2])
# Licht von links oben: helle/dunkle Kante
inner = plate & ~ring_o
up_edge = inner & ~np.roll(inner, 1, 0)
lf_edge = inner & ~np.roll(inner, 1, 1)
dn_edge = inner & ~np.roll(inner, -1, 0)
rt_edge = inner & ~np.roll(inner, -1, 1)
fg.dfill(up_edge | lf_edge, BR[3]); fg.dfill(dn_edge | rt_edge, BR[1])
fg.dfill(ring_o, BR[0])
# eingravierte Randlinie
inset = rrect(20, 9, 77, 5)
inset_line = inset & ~np.pad(inset[1:-1, 1:-1] & inset[:-2, 1:-1] & inset[2:, 1:-1] & inset[1:-1, :-2] & inset[1:-1, 2:], 1)
fg.dfill(inset_line & plate, BR[1])
# vier Schrauben
for (sx, sy) in ((CX - 21, 8), (CX + 20, 8), (CX - 21, 77), (CX + 20, 77)):
    sx = int(sx)
    fg.px(sx, sy, BR[4]); fg.px(sx + 1, sy, BR[3]); fg.px(sx, sy + 1, BR[1]); fg.px(sx + 1, sy + 1, BR[0])

# Schlüsselloch: Kreis + sich nach unten weitender Schlitz
hole = np.hypot(xx + .5 - CX, yy + .5 - CY) <= R
slot_top, slot_bot = CY + R * 0.6, 74
t = np.clip((yy + .5 - slot_top) / (slot_bot - slot_top), 0, 1)
hw = 7.0 + 4.0 * t
hole |= (yy + .5 >= slot_top) & (yy + .5 <= slot_bot) & (np.abs(xx + .5 - CX) <= hw)
# warmer Lichtschein auf der Platte rund ums Loch
near = plate & ~hole
import cv2
dist = cv2.distanceTransform((~hole).astype(np.uint8), cv2.DIST_L2, 3)
fg.dfill(near & (dist <= 3.2), BR[3])
fg.dfill(near & (dist <= 1.6), BR[4])
# Lochwand: 1 Zelle dunkle Laibung innen (Dicke des Schlosses), unten/rechts etwas heller
wall_in = hole & (cv2.distanceTransform(hole.astype(np.uint8), cv2.DIST_L2, 3) <= 1.0)
top_side = wall_in & (yy + .5 < CY)
fg.a[wall_in, :3] = (22, 14, 8); fg.a[wall_in, 3] = 255
fg.a[wall_in & ~top_side & (xx + .5 > CX), :3] = (70, 48, 20)
fg.a[hole & ~wall_in, 3] = 0                                   # Durchblick
# dunkle Randvignette auf der Tür
e = np.minimum.reduce([xx, yy, W4 - 1 - xx, H4 - 1 - yy]).astype(float)
door = (fg.a[..., 3] > 0) & ~plate
fg.shade(0.72, door & (e < 6)); fg.shade(0.72, door & (e < 3))

# Schlüssel hängt an einem Nagel rechts neben dem Schlitz (Ebene 79 „Ebene #162“, Szenen „Sichtbar #45/#44“)
key = sprite('i42_key', B, [79])
KX, KY = 43, 47
fg.paste(outline(key, (40, 26, 10)), KX - 1, KY - 1)
fg.paste(key, KX, KY)
nx = KX + key.shape[1] // 2
fg.px(nx, KY - 1, (60, 60, 70)); fg.px(nx, KY - 2, (150, 150, 165)); fg.px(nx + 1, KY - 2, (90, 90, 100))

cv = flatten([bg, fg])
print(save(cv, '42_keyhole.png'))
