# -*- coding: utf-8 -*-
"""Sleeve: Spinnennest – das Netz aus „Trapping“ (Viertel gespiegelt, gedreht), darin die Spinnen direkt
aus den Ebenen von MotiveGN.xcf (Repo PixelPartiesSprites): Crimson Skull Spider am roten Faden, Brain-,
Diamond- und Cute Spider, kleine Spinnen aus „Spider Hive“. Felsboden: Ebene „Klippen“."""
import numpy as np
from kit import *
from xcfkit import sprite, parts

G = 'MotiveGN'
cv = Canvas(W, H)
# --- Felsboden der Spinnenkarten (Ebene „Klippen“), 2×, abgedunkelt
kl = sprite('gn_klippen', G, [421])
band = kl[150:240, 100:225]                          # Felsband ohne Büsche
bg = up(np.concatenate([band[::-1], band], 0)[:175], 2)
cv.a[:] = hsv_shift(bg, 0, 0.95, 0.62)[..., :3]
vignette(cv, 0.8, 0.3)

# --- Netz: oberes linkes Viertel aus Trapping, zu vollem Rad gespiegelt, um 90° gedreht, 5×
tr = nat('Trapping').astype(int)
wm = ((tr.max(-1) > 200) & ((tr.max(-1) - tr.min(-1)) < 50))
q = wm[0:26, 0:39]
top = np.concatenate([q, q[:, :-1][:, ::-1]], 1)
full = np.concatenate([top, top[:-1][::-1]], 0)       # 51 × 77
full = np.rot90(full)                                  # 77 × 51
K = 5
fh, fw = full.shape
ox = (W - fw * K) // 2; oy = (H - fh * K) // 2
WEB = (214, 212, 222); WEBS = (40, 26, 16)
for y in range(fh):
    for x in range(fw):
        if full[y, x]:
            cv.rect(ox + x * K + 2, oy + y * K + 2, ox + x * K + K + 2, oy + y * K + K + 2, WEBS)
for y in range(fh):
    for x in range(fw):
        if full[y, x]:
            cv.rect(ox + x * K, oy + y * K, ox + x * K + K, oy + y * K + K, WEB)
HX, HY = ox + 25 * K + K // 2, oy + 38 * K + K // 2   # Nabe

# --- Spinnen (xcf-Ebenen)
boss = sprite('gn_crimson_skull_spider', G, [259])      # mit rotem Faden
brain = sprite('gn_brain_spider', G, [251])             # mit weißem Faden
dia = sprite('gn_diamond_spider', G, [260])
cute = sprite('gn_cute_spider', G, [264, 265, 266])     # Flügel + Körper + Herzaugen
hive = [p for p in parts(sprite('gn_spodders', G, [267]), dil=1) if p.shape[0] >= 8 and p.shape[1] >= 10]
baby, baby2 = hive[0], hive[5]

def put(s, x, y, k, fl=False, r=0, sh=(3, 3)):
    s2 = up(rot90(flip(s) if fl else s, r), k)
    cv.paste(silhouette(s2, (0, 0, 0)), x + sh[0], y + sh[1], alpha=0.45)
    cv.paste(s2, x, y)
    return s2

# Crimson Skull Spider an der Nabe; ihr Faden (Kartenpixel) wird nach oben bis zum Rand verlängert
B = up(boss, 5)
tcol = int(np.argmax(boss[0, :, 3] > 0))
bx = HX - B.shape[1] // 2; by = HY - B.shape[0] + 12 * 5
thread = up(boss[0:4, tcol:tcol + 1], 5)
y = by
while y > 0:
    y -= thread.shape[0]; cv.paste(thread, bx + tcol * 5, y)
cv.paste(silhouette(B, (0, 0, 0)), bx + 4, by + 4, alpha=0.5)
cv.paste(B, bx, by)

def hang(s, x, y, k):
    """Spinne mit eigenem Faden; Faden (oberste Pixelzeilen) bis zum oberen Rand verlängern."""
    S = up(s, k); col = int(np.argmax(s[0, :, 3] > 0))
    seg = up(s[0:2, col:col + 1], k); yy = y
    while yy > 0:
        yy -= seg.shape[0]; cv.paste(seg, x + col * k, yy)
    cv.paste(silhouette(S, (0, 0, 0)), x + 3, y + 3, alpha=0.45); cv.paste(S, x, y)

hang(brain, 186, 30, 3)
put(cute, 14, 18, 3)
put(dia, 24, 168, 3, r=1); put(dia, 196, 214, 3, r=3)
put(baby, 110, 30, 3); put(baby2, 30, 110, 3, True, 1); put(baby, 190, 300, 3, False, 2); put(baby2, 26, 296, 3, False, 3)
put(hive[2], 120, 300, 3); put(hive[8], 210, 176, 2, r=1); put(hive[3], 70, 250, 2); put(hive[9], 140, 110, 2, r=3)

for i, c in enumerate([(20, 12, 8), (120, 0, 0), (170, 10, 5), (20, 12, 8)]):
    cv.a[i, :] = c; cv.a[-1 - i, :] = c; cv.a[:, i] = c; cv.a[:, -1 - i] = c
print(save(cv, '04_spider_nest.png'))
