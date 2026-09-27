# -*- coding: utf-8 -*-
"""Sleeve 03 – Niu hält Wache (Close-up vor der Palastmauer).

Guardian Beast Niu hat ihre beiden Lichtklingen in den Boden des Palasthofes gerammt, der
Boden reißt schwarz auf. Hinter ihr die orangefarbene Hofmauer mit dem vergitterten Tor und
der Nachthimmel. Großes Close-up (6×), wie sleeve2.
Quellen (MotiveGuardianBeasts.xcf): Niu #3 [80] (Niu mit Klingen), Niu #2 [81] (Bodenrisse),
Guard Duty #1 [54] (Himmel, Hofmauer, vergittertes Tor, Hofboden – ohne die FPS-Einblendung).
"""
from a_util import *  # noqa

B = 'MotiveGuardianBeasts'
cv = Canvas(250, 350)

court = compose(B, [54], crop=False)
niu = sprite('a03_niu', B, [80])               # Niu mit beiden Lichtklingen (26×45)
cracks = parts(sprite('a03_cracks', B, [81]), dil=1)   # zwei Bodenrisse (links, rechts)

# --- Himmel (2×), Nachtstimmung ----------------------------------------------------------
sky = court[22:84, 0:125].copy()              # 125×62, mit Wolken
blit_rgb(cv, sky, 0, -20, 2)

# --- Hofmauer (3×): Zinnenband + Ziegel, Tor rechts ----------------------------------------
band = court[98:144, 52:136].copy()           # 84×46, sauber (rechts vom FPS-Text)
blit_rgb(cv, band, -1, 96, 3)
gate = court[110:144, 146:164].copy()         # vergittertes Tor mit Schädelwappen
blit_rgb(cv, gate, 196, 138, 3)

# --- Hofboden (3×) --------------------------------------------------------------------------
floor = court[146:186, 118:202].copy()      # Hofboden ohne Rasen
blit_rgb(cv, floor, -1, 234, 3)

# Nachtstimmung: Mauer und Boden abdunkeln und bläulich tönen, zur Mitte hin etwas heller
yy, xx = np.mgrid[0:350, 0:250]
d = np.hypot((xx - 125) / 125, (yy - 200) / 175)
f = np.clip(0.78 - 0.35 * d, 0.38, 0.8)
night = cv.a * f[..., None] * 0.8 + np.array([18, 24, 70]) * 0.2
cv.a[96:] = night[96:].astype(np.uint8)
cv.a[:96] = (cv.a[:96] * 0.8).astype(np.uint8)

# --- Niu ---------------------------------------------------------------------------------------
K = 6
x0, y0, _, _ = put(cv, niu, 125, 300, K, anchor='b')
# Klingenspitzen finden, Bodenrisse (3×) dort ansetzen
white = (niu[..., :3].min(-1) > 170) & (niu[..., 3] > 0)
cols = np.where(white.sum(0) >= 10)[0]           # nur lange, helle Klingen-Spalten
tipL, tipR = cols[cols < niu.shape[1] // 2], cols[cols >= niu.shape[1] // 2]
tips = []
for tc in (tipL, tipR):
    tx = x0 + int((tc.min() + tc.max() + 1) / 2 * K)
    rows = np.where(white[:, tc].any(1))[0]
    tips.append((tx, y0 + rows.min() * K, y0 + (rows.max() + 1) * K))
for tx, top, ty in tips:
    glow_seg(cv, tx, top, tx, ty, 30, (235, 220, 255), 0.42)
for (tx, top, ty), cr in zip(tips, cracks):
    put(cv, cr, tx - cr.shape[1] * 3 // 2, ty - 10, 3)
# Niu nochmals darüber, damit die Klingen vor den Rissen liegen
put(cv, niu, 125, 300, K, anchor='b')

frame(cv, [(20, 10, 4), (120, 60, 20), (240, 190, 90), (20, 10, 4)])
print(save(cv, '03_niu_wache.png'))
