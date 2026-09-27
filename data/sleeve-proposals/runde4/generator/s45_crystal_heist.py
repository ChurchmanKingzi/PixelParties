# -*- coding: utf-8 -*-
"""45 Crystal Heist – nachts im Kronjuwelen-Saal: ein Lichtkegel fällt auf die Glasvitrine, in der der große
violette Kristall schwebt; von links schleicht Jack aus dem Dunkel heran, durch ein Gitterfenster fällt ein Mondstrahl.

Quellen (MotiveBritain.xcf):
  Ebene 168 „Jack“       – Jack (Karte „Jack, the Crooked Killer“; geprüft gegen „Sichtbar #22“)            4×
  Ebene 190 „Ebene #62“  – großer violett-blauer Kristall (Kristall-Karten der Crystals-Reihe)              4×
  Ebene 146 „Ebene #144“ – Steinsäule, gekürzt und unten mit gespiegeltem Kapitell als Sockel               4×
  Ebene 176 „Ebene #75“  – Thronsaal: Mauerkachel (x 430–446, y 320–336), Gitterfenster,
                            roter Teppich (16×16-Kachel) als Saal im Hintergrund, stark abgedunkelt        2×
Vitrinenglas/-rahmen, Lichtkegel, Mondstrahl, Kristallschein und Schatten selbst gezeichnet.
Skalierung: Saal 2×, Jack + Vitrine + Sockel + Kristall 4×.
"""
import math
import numpy as np
from kit41_45 import *  # noqa

B = 'MotiveBritain'
room = compose(B, [176], crop=False)
jack = sprite('i45_jack', B, [168])
crystal = sprite('i45_crystal', B, [190])
col = sprite('i45_pillar', B, [146])

# ---------------------------------------------------------------- Saal (2×)
bg = G(2)
W2, H2 = bg.w, bg.h
yy, xx = np.mgrid[0:H2, 0:W2]
FLOOR = 112                                            # Wandfuß im 2×-Raster (y=224)
wall = room[320:336, 430:446]
for y in range(0, FLOOR):
    for x in range(W2):
        bg.a[y, x, :3] = wall[y % 16, x % 16, :3]
bg.a[:FLOOR, :, 3] = 255
# Gitterfenster (Mondlicht) und ein Porträt aus derselben Wand
win = room[352:366, 466:482].copy(); win[..., 3] = 255
bg.paste(win, 14, 50)
carpet = room[400:416, 516:532]
for y in range(FLOOR, H2):
    for x in range(W2):
        bg.a[y, x, :3] = carpet[y % 16, x % 16, :3]
bg.a[FLOOR:, :, 3] = 255
bg.rect(0, FLOOR - 1, W2, FLOOR, (20, 14, 26))
# Nacht: alles stark abdunkeln und ins Blauviolette ziehen
bg.a[..., :3] = (bg.a[..., :3] * np.array([0.30, 0.28, 0.42])).astype(np.uint8)
# Mondlicht im Fenster wieder heller
wm = np.zeros((H2, W2), bool); wm[51:63, 16:28] = True
bg.a[wm, :3] = np.clip(bg.a[wm, :3] * 2.6, 0, 255).astype(np.uint8)
# Mondstrahl aus dem Gitterfenster schräg nach rechts unten auf den Boden (einfarbig aufgehellt)
beam = (yy >= 57) & (xx + .5 >= 16 + (yy - 57) * 0.45) & (xx + .5 <= 28 + (yy - 57) * 0.62) & (yy < 150)
bg.a[beam, :3] = np.clip(bg.a[beam, :3] * 1.25 + np.array([10, 14, 26]), 0, 255).astype(np.uint8)
# Lichtkegel von oben auf die Vitrine (Mitte x≈85 im 2×-Raster)
LX = 85
cone = (np.abs(xx + .5 - LX) < 9 + yy * 0.14)
bg.a[cone, :3] = np.clip(bg.a[cone, :3] * np.array([1.9, 1.8, 1.6]) + 6, 0, 255).astype(np.uint8)
pool = bg.ellipse_mask(LX, 152, 30, 7)
bg.a[pool, :3] = np.clip(bg.a[pool, :3] * 1.5 + 8, 0, 255).astype(np.uint8)
# violetter Kristallschein hinter der Vitrine (zwei weiche Stufen, ohne Dither)
for (rx, ry, t) in ((30, 46, 0.22), (21, 36, 0.3)):
    m = bg.ellipse_mask(LX, 74, rx, ry)
    bg.a[m, :3] = np.clip(bg.a[m, :3] * (1 - t) + np.array([150, 110, 230]) * t, 0, 255).astype(np.uint8)

# ---------------------------------------------------------------- Vitrine, Kristall, Jack (4×)
fg = G(4)
W4, H4 = fg.w, fg.h
FL = 76                                               # Fußlinie (y=304)
VX = 42.5                                             # Vitrinenmitte (x=170)
# Sockel: Kapitell + gekürzter Schaft + gespiegeltes Kapitell
ped = np.concatenate([col[0:6], col[14:20], col[0:6][::-1]], 0)
fg.pb(outline(ped, (16, 12, 22)), int(VX) + 1, FL + 1)
PT = FL - ped.shape[0]                                # Sockeloberkante
# Glaskasten
cw, ch = 20, 42
x0, x1 = int(VX - cw / 2), int(VX - cw / 2) + cw
y1 = PT; y0 = y1 - ch
GOLD = [(90, 62, 24), (170, 124, 48), (230, 190, 96)]
inside = np.zeros((H4, W4), bool); inside[y0 + 2:y1 - 1, x0 + 1:x1 - 1] = True
cr = hsv_shift(crystal, 0, 0.9, 1.3)                 # der Kristall leuchtet von innen
fg.pb(outline(cr, (30, 16, 60)), int(VX) + 1, y1 - 3)  # Kristall schwebt über dem Kastenboden
# Glanzstreifen auf dem Glas
for k in range(0, 7):
    fg.px(x0 + 2 + k, y0 + 4 + k, (226, 238, 255))
for k in range(0, 4):
    fg.px(x0 + 2 + k, y0 + 7 + k, (190, 214, 245))
# Rahmen: Deckel, Boden, Kanten
fg.rect(x0 - 1, y0, x1 + 1, y0 + 2, GOLD[1]); fg.rect(x0 - 1, y0, x1 + 1, y0 + 1, GOLD[2])
fg.rect(x0 - 1, y1 - 1, x1 + 1, y1 + 1, GOLD[1]); fg.rect(x0 - 1, y1, x1 + 1, y1 + 1, GOLD[0])
fg.rect(x0, y0 + 2, x0 + 1, y1 - 1, (200, 220, 240)); fg.rect(x1 - 1, y0 + 2, x1, y1 - 1, (120, 150, 190))
# Jack schleicht von links heran (etwas abgedunkelt, im Halbdunkel)
J = darken(jack, 0.85)
JX = 4
fg.paste(J, JX, FL - jack.shape[0])
# Schlagschatten (vom Licht rechts oben nach links)
shadow = grid_mask(4)
for dy in range(0, 3):                                # Jacks Schatten fällt schräg nach links vorn
    shadow |= fg.ellipse_mask(JX + 12 - 3 * dy, FL + dy, 11, 1.0)
shadow |= fg.ellipse_mask(VX, FL + 0.5, 8, 1.2)
shadow &= ~fg.mask()

cv = flatten([bg, fg])
shade_final(cv, shadow, 4, 0.55)
glass = inside & ~fg.mask()                           # Glas: Hintergrund hinter der Scheibe bläulich aufhellen
tint_final(cv, glass, 4, (170, 200, 240), 0.18, lift=1.15)
print(save(cv, '45_crystal_heist.png'))
