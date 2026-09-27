# -*- coding: utf-8 -*-
"""07 Porthole – Bullauge in der Ziegelwand der Deepsea-Burg: dahinter schnappt der Greatmaw-Hai nach
Fischchen, im Dunkel treiben Greatmaw-Siren und Schiffshalter; davor stehen Kit der Hai-Forscher und ein Taucher.

Quellen (MotiveDeepsea.xcf):
  Ebene 197 „Ebene #100“  – Ziegelwand der Deepsea-Burg (Kachel 16×16, 2×)
  Ebene 93  „Greatmaw Shawk“ – Greatmaw Shark (Karte „Greatmaw Shark“), 4×
  Ebene 85  „Ebene #199“ – blaue Fischchen (Karte „Greatmaw Shark“), 3×
  Ebene 84  „Greatmaw Siren“ – Angler-Hai (Karte „Greatmaw Siren“), 2×, abgedunkelt
  Ebene 88  „Greatmaw Remora“ – Schiffshalter, 2×, abgedunkelt
  Ebene 200 „Ebene #93“ – Luftblasen
  Ebene 40 „Kit“ + 38 „Ebene #49“ (Hut) – Kit the Shark Researcher, 5×
  Ebene 207 „Dive Down“ – Taucher (Karte „Dive Down“), 4×
  Boden/Sockel: Ebene 197 (Bodenkacheln 8×8, Sockelleiste)
  Hintergrundfarben: Ebene 391 „Hintergrund“ (Deepsea-Meer); Messingring in den Farben des Diver Helmet (216).
"""
from common import *  # noqa
from bkit import *    # noqa

W, H = 250, 350
cv = Canvas(W, H)

# ---------- Wand ----------
wall = compose('MotiveDeepsea', [197])
tile = wall[56:72, 112:128]
cv.a[:] = up(np.dstack([tile_rgb(tile, W // 2 + 1, H // 2 + 1), np.full((H // 2 + 1, W // 2 + 1), 255, np.uint8)]), 2)[:H, :W, :3]
shade(cv, 0.62)

CX, CY, R = 125, 150, 96          # Glas
RR = R + 13                        # Außenkante Messingring

# Schatten des Rings auf der Wand (versetzt nach rechts unten)
sh = disk_mask(W, H, CX + 5, CY + 7, RR + 2)
shade(cv, 0.45, mask=sh)

# ---------- Wasser hinter dem Glas ----------
glass = disk_mask(W, H, CX, CY, R)
DEEP = [(0.0, (47, 101, 159)), (0.35, (22, 65, 125)), (0.75, (18, 44, 100)), (1.0, (10, 24, 60))]
vgrad(cv, DEEP, 0, CY - R, W, CY + R, mask=glass)
# Lichtkegel von oben (Pillar-of-Light-Farben der Deepsea-Karten, gedithert)
for y in range(CY - R, CY + R):
    for x in range(CX - R, CX + R):
        if not glass[y, x]: continue
        # schräger Strahl
        u = (x - CX) + 0.45 * (y - CY)
        t = max(0, 1 - abs(u + 25) / 28) * max(0, 1 - (y - (CY - R)) / (1.7 * R)) * 0.55
        if t > BAYER4[y % 4, x % 4]:
            cv.a[y, x] = (np.array(cv.a[y, x], int) * 0.55 + np.array((120, 170, 215)) * 0.45).astype(np.uint8)

inside = Canvas(W, H); inside.a[:] = cv.a

# Hintergrund-Fauna (klein, abgedunkelt, nur im Glas)
siren = parts(compose('MotiveDeepsea', [84]))[0]
siren = lum_tint(siren, (10, 22, 55), (55, 105, 160))
remora = parts(compose('MotiveDeepsea', [88]), dil=1)
bg = Canvas(W, H); bg.a[:] = cv.a
bg.paste(flip(siren), CX - 78, CY - 70)
for r in remora[1:3]:
    pass
rem = [p for p in remora if p.shape[1] < 30]
for i, r in enumerate(rem[:2]):
    bg.paste(up(lum_tint(r, (12, 30, 70), (45, 90, 140)), 1), CX + 30 + i * 22, CY + 62 + i * 5)
bubbles = compose('MotiveDeepsea', [200])
bg.paste(up(bubbles, 1), 150, 58)
cv.a[glass] = bg.a[glass]

# Hai – groß, über das Glas hinaus angeschnitten (nur innerhalb des Glases sichtbar)
shark = compose('MotiveDeepsea', [93])
S4 = up(flip(shark), 4)                # 200×116, Maul nach rechts
fg = Canvas(W, H); fg.a[:] = cv.a
fg.paste(S4, CX - 118, CY - 38)
# Fischchen flieht vor dem Maul
fish = parts(compose('MotiveDeepsea', [85]))
f0 = up(fish[0], 3)
fg.paste(f0, CX + 50, CY - 58)
f1 = up(flip(fish[-1]), 2)
fg.paste(f1, CX + 20, CY - 78)
cv.a[glass] = fg.a[glass]

# Glasreflex (gedithert)
for y in range(CY - R, CY + R):
    for x in range(CX - R, CX + R):
        if not glass[y, x]: continue
        d = math.hypot(x + .5 - CX, y + .5 - CY) / R
        ang = math.atan2(y - CY, x - CX)
        # heller Bogen oben links
        if 0.83 < d < 0.88 and -2.5 < ang < -1.8:
            if 0.5 > BAYER4[y % 4, x % 4]: cv.a[y, x] = (170, 205, 235)

# ---------- Messingring ----------
BR = [(58, 30, 18), (110, 58, 26), (168, 92, 38), (214, 140, 62), (245, 205, 120)]  # Diver-Helmet-Messing
for y in range(CY - RR - 1, CY + RR + 2):
    for x in range(CX - RR - 1, CX + RR + 2):
        d = math.hypot(x + .5 - CX, y + .5 - CY)
        if R <= d < RR:
            ang = math.atan2(y + .5 - CY, x + .5 - CX)
            light = -math.cos(ang + math.pi * 0.75)       # Licht von oben links
            prof = (d - R) / (RR - R)                     # 0 innen .. 1 außen
            bevel = 1 - abs(prof - 0.45) * 2.2            # Wulst in der Mitte
            v = 1.6 + 1.3 * light * (1 if prof < 0.45 else -0.4) + 1.1 * bevel
            if prof < 0.12 or prof > 0.9: v -= 1.4
            v += BAYER4[y % 4, x % 4] - 0.5
            cv.px(x, y, BR[int(max(0, min(4, round(v))))])
        elif RR <= d < RR + 1.2:
            cv.px(x, y, (12, 10, 20))
        elif R - 1.2 <= d < R:
            cv.px(x, y, (30, 16, 10))
# Nieten
for k in range(16):
    a = k * 2 * math.pi / 16 + 0.1
    rx, ry = CX + math.cos(a) * (R + 7.5), CY + math.sin(a) * (R + 7.5)
    x, y = int(rx), int(ry)
    for dx, dy, c in [(0, 0, BR[4]), (1, 0, BR[3]), (0, 1, BR[3]), (1, 1, BR[1]), (2, 1, BR[0]), (1, 2, BR[0]), (2, 2, BR[0])]:
        cv.px(x - 1 + dx, y - 1 + dy, c)

# ---------- Boden + Kit ----------
FY = 296
base = wall[86:100, 112:128]
bb = up(np.dstack([tile_rgb(base, W // 2 + 1, 14), np.full((14, W // 2 + 1), 255, np.uint8)]), 2)[:, :W, :3]
cv.a[FY - 28:FY] = (bb * 0.75).astype(np.uint8)
floor = wall[120:128, 120:128]
fl = up(np.dstack([tile_rgb(floor, W // 2 + 1, (H - FY) // 2 + 1), np.full(((H - FY) // 2 + 1, W // 2 + 1), 255, np.uint8)]), 2)
cv.a[FY:] = (fl[:H - FY, :W, :3] * 0.7).astype(np.uint8)
# Schattenkante am Übergang
cv.a[FY:FY + 2] = (cv.a[FY:FY + 2] * 0.5).astype(np.uint8)

kit_s = compose('MotiveDeepsea', [40, 38])
K = up(kit_s, 5)
kx, ky = 20, H - 14 - K.shape[0]
# Bodenschatten
for y in range(H - 20, H - 8):
    for x in range(kx + 4, kx + K.shape[1] + 10):
        d = ((x - (kx + K.shape[1] / 2 + 4)) / (K.shape[1] / 2 + 6)) ** 2 + ((y - (H - 14)) / 6) ** 2
        if d < 1 and 0.6 > BAYER4[y % 4, x % 4]:
            cv.a[y, x] = (cv.a[y, x] * 0.45).astype(np.uint8)
cv.paste(K, kx, ky)

# Taucher (Karte „Dive Down“) rechts, frisch aus dem Wasser zurück
diver = compose('MotiveDeepsea', [207])
D = up(diver, 4)
dx, dy = W - 18 - D.shape[1], H - 12 - D.shape[0]
for y in range(H - 18, H - 6):
    for x in range(dx - 6, dx + D.shape[1] + 2):
        d = ((x - (dx + D.shape[1] / 2 - 2)) / (D.shape[1] / 2 + 4)) ** 2 + ((y - (H - 12)) / 6) ** 2
        if d < 1 and 0.6 > BAYER4[y % 4, x % 4]:
            cv.a[y, x] = (cv.a[y, x] * 0.45).astype(np.uint8)
cv.paste(D, dx, dy)

vignette(cv, 0.55, 0.55)
print(save(cv, '07_porthole.png'))
