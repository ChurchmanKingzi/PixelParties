# -*- coding: utf-8 -*-
"""Sleeve 40 – „Angel's Mirror“: Spielkarten-Doppelbild. Oben der Guardian Angel über der betenden
Rothaarigen zwischen zwei Engelsstatuen vor blauem Wolkenhimmel, unten – um 180° gedreht wie auf einer
Hofkarte – dieselbe Szene als Undead Guardian Angel vor dem roten Höllenhimmel mit schwarzen Wolken.

Quellen (Motive.xcf):
  Ebene 1058 „Guardian Angel“ (Engel+Statue+Betende, Statuen)
  Ebene 729 „Undead Guardian Angel“ (Engel+Statue+Betende, Statuen); das Gesicht fehlt in der Ebene und wird
     pixelgenau aus der Szene „Sichtbar #61“ (Ebene 728) ergänzt
  Ebene 1530 „Ebene #11“ (blauer Himmel mit Wolken), Ebene 1500 „Ebene #12“ (roter Himmel, schwarze Wolken –
     dasselbe Wolkenbild)
"""
import math
from g_util import *

B = 'Motive'
W2, H2 = 250, 350
MID = 175

# ---------- Sprites
ga = lay(B, 1058)
gp = parts(ga, dil=0)                  # Statue L, Säule (Engel/Statue/Betende), Statue R, freier Engel, ...
ga_col = max(gp, key=lambda p: p.shape[0])
ga_stat = [p for p in gp if p.shape[:2] == (30, 20)]

ua_full = layer(B, 729).copy()
sc = layer(B, 728)
filled = fill_holes(ua_full)
hole = (filled[..., 3] > 0) & (ua_full[..., 3] == 0)
ua_full[hole] = sc[hole]; ua_full[hole, 3] = 255
bb = bbox(ua_full); ua = ua_full[bb[1]:bb[3], bb[0]:bb[2]]
ua[..., 3] = np.where(ua[..., 3] >= 128, 255, 0)
up_ = parts(ua, dil=0)
ua_col = max(up_, key=lambda p: p.shape[0])
ua_stat = [p for p in up_ if p.shape[:2] == (30, 20)]
from PIL import Image
Image.fromarray(ga_col).save(os.path.join(xcfkit.CACHE, 'g40_angel.png'))
Image.fromarray(ua_col).save(os.path.join(xcfkit.CACHE, 'g40_undead.png'))

K = 3


def half(col, stat, skyidx, light, rays_col, glow_col, stint=None):
    """Eine Hälfte (250×175), Füße der Betenden an der Unterkante."""
    cv = Canvas(W2, MID)
    sky = layer(B, skyidx)[:, 100:420, :3]
    cv.a[:] = sky[40:40 + MID, 30:30 + W2]
    # Strahlenkranz um den Heiligenschein
    C = col; cw, ch = C.shape[1] * K, C.shape[0] * K
    cx = W2 // 2; top = 6
    hx, hy = cx, top + 8
    for y in range(MID):
        for x in range(W2):
            a = math.degrees(math.atan2(y - hy, x - hx)) % 360
            r = math.hypot(x - hx, y - hy)
            on = int(a // 12) % 2 == 0
            if on and r > 10:
                t = max(0.0, 1 - r / 190) * 0.85
                q = math.floor(t * 4 + BAYER4[y % 4, x % 4]) / 4
                if q > 0: cv.a[y, x] = (cv.a[y, x] * (1 - q) + np.array(rays_col) * q).astype(np.uint8)
    # weicher Schein
    dither_blend(cv, glow_col, lambda x, y: max(0.0, 1 - math.hypot(x - hx, (y - hy) * 1.1) / 70) * 0.9)
    # Statuen (3×) seitlich, Sockel an der Unterkante
    sL, sR = up(stat[0], K), up(stat[-1], K)
    if stint: sL, sR = tint(sL, stint[0], stint[1]), tint(sR, stint[0], stint[1])
    for s, x in ((sL, 14), (flip(sR), W2 - 14 - sR.shape[1])):
        paste_shadow(cv, s, x, MID - s.shape[0], dx=3, dy=0, col=(0, 0, 0), alpha=0.35)
    Cu = up(C, K)
    paste_shadow(cv, Cu, cx - cw // 2, top, dx=3, dy=0, alpha=0.35)
    return cv


top = half(ga_col, ga_stat, 1530, True, (255, 246, 190), (255, 250, 215), ((255, 240, 200), 0.12))
bot = half(ua_col, ua_stat, 1500, False, (25, 0, 20), (150, 70, 170), ((70, 20, 90), 0.3))

cv = Canvas(W2, H2)
cv.a[:MID] = top.a
cv.a[MID:] = bot.a[::-1, ::-1]          # 180° gedreht
# Trennlinie wie auf einer Spielkarte
for y, c in ((MID - 2, (20, 14, 6)), (MID - 1, (250, 220, 120)), (MID, (200, 150, 40)), (MID + 1, (20, 14, 6))):
    cv.a[y, :] = c
# Eck-Symbole wie Spielkarten-Indizes: die beiden Heiligenscheine (obere 4 Pixelreihen der Engel)
for col, (x, y), rot in ((ga_col, (9, 9), False), (ua_col, (W2 - 9, H2 - 9), True)):
    hl = trim(col[:4].copy()); hl = up(hl, 3)
    if rot: hl = hl[::-1, ::-1]; x -= hl.shape[1]; y -= hl.shape[0]
    paste_shadow(cv, hl, x, y, dx=0, dy=2 if not rot else -2, alpha=0.4)
frame(cv)
print(save(cv, '40_angel_mirror.png'))
