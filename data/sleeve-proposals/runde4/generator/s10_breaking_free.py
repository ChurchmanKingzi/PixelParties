# -*- coding: utf-8 -*-
"""10 Breaking Free – Im abendlichen Statuengarten des Petrifiers zerspringt die versteinerte Statue eines
rothaarigen Mädchens: Die obere Hälfte ist schon aufgebrochen, ihr farbiges Gesicht und Haar kommen hervor,
Risse laufen durch den restlichen Stein, Splitter fliegen, dahinter ein warmer Lichtschein. Zwei noch starre,
versteinerte Opfer flankieren sie auf Sockeln, dahinter eine dunkle Hecke mit Formschnitt-Büschen.

Quellen (Motive.xcf, alle aus den Karten „Petrifier“ / „Petrification Break“):
  1458 „Petrifier“ – linker Teil: Steinstatue des Mädchens (deckungsgleich mit 1457), 6×
  1457 „Petrification Break #1“ – das Mädchen in Farbe (durch die Bruchstelle sichtbar), 6×
  1456 „Petrification Break“ – linker Teil: zerbrochene Statuenhülle; ihr Sockel (untere Zeilen) für die Seitenstatuen, 3×
  1455 „Petrification Break #3“ (blonder Held mit Spiegelschild) und 1453 „Petrifier #1“ (brauner Mantel) –
       beide auf die Steinpalette der Statue umgefärbt, 3×
  1450 „Petrifier #4“ (Formschnitt-Busch), 3× und als Heckentextur 2×
Selbst gezeichnet: Abendhimmel, Lichtschein, Risse, Bruchkante, Splitter (aus Statuenpixeln), Kiesweg, Schatten.

Skalierung:
  Vordergrund (Statue/Mädchen, Risse, Splitter, Kiesweg vorn): 6× (Raster 42×59, beschnitten)
  Mittelgrund (zwei Seitenstatuen mit Sockeln, zwei Büsche, Schatten): 3× (Raster 84×117, beschnitten)
  Hintergrund (Himmel, Schein, Hecke, Weg): 2× (Raster 125×175)
"""
from common import *  # noqa
import numpy as np, math, cv2

M = 'Motive'
BW, BH = 125, 175
yy, xx = np.mgrid[0:BH, 0:BW]
th = BAYER4[yy % 4, xx % 4]

# ---------------- Quellsprites ----------------
statue = compose(M, [1458], crop=False)[177:202, 210:230].copy()      # 25×20, deckungsgleich mit girl
girl = compose(M, [1457], crop=False)[177:202, 210:230].copy()
shell = parts(compose(M, [1456]), dil=1)[0]                          # zerbrochene Hülle (25×19)
plinth = shell[-5:]                                                  # Sockelzeilen
hero = trim(compose(M, [1455]))
petr = trim(compose(M, [1453]))
bush = trim(compose(M, [1450]))

# Steinpalette der Statue (nach Helligkeit sortiert)
sp = statue[statue[..., 3] > 0][:, :3]
pal = np.array(sorted({tuple(c) for c in sp}, key=lambda c: sum(int(v) for v in c)))


def petrify(s):
    """Sprite auf die Steinpalette der Statue umfärben (Helligkeit -> Palettenstufe)."""
    out = s.copy()
    m = out[..., 3] > 0
    lum = out[..., :3].astype(float) @ np.array([0.3, 0.55, 0.15])
    lo, hi = np.percentile(lum[m], 3), np.percentile(lum[m], 97)
    k = np.clip((lum - lo) / max(hi - lo, 1) * (len(pal) - 1) + 0.5, 0, len(pal) - 1).astype(int)
    out[m, :3] = pal[k[m]]
    return out


# ---------------- Hintergrund 2× ----------------
bg = Canvas(BW, BH)
sky = [(26, 20, 52), (48, 32, 78), (92, 52, 96), (160, 84, 102), (220, 132, 104)]
t = np.clip((yy - 8) / 72, 0, 1) * (len(sky) - 1)
q = np.floor(t + th * 0.999).clip(0, len(sky) - 1).astype(int)
for k, c in enumerate(sky):
    bg.a[q == k] = c
# Hecke: dunkelgrüne Wand aus gekachelter Busch-Textur (Mitte von 1450), oben gewellt
btex = bush[6:18, 3:13, :3].astype(float) * 0.55
HT = 70
for x in range(BW):
    top = HT - 2 * abs(math.sin(x * 0.22)) - (1 if x % 7 == 0 else 0)
    for y in range(int(top), 128):
        c = btex[(y - HT) % btex.shape[0], x % btex.shape[1]] * (0.95 - 0.25 * (y - HT) / 58)
        bg.a[y, x] = np.clip(c * np.array([0.8, 0.95, 1.1]), 0, 255)
    bg.a[int(top), x] = (70, 100, 60)
# Kiesweg / Rasen
for y in range(128, BH):
    for x in range(BW):
        v = ((x * 7 + y * 13) % 11) < 3
        bg.a[y, x] = (96, 84, 96) if v else (78, 68, 82)
bg.a[128] = (40, 36, 48)
# Lichtschein hinter der Hauptstatue
d = np.hypot(xx + 0.5 - 62.5, (yy + 0.5 - 96) * 0.9)
for r, col, a in [(46, (140, 92, 70), 0.5), (32, (200, 140, 88), 0.55), (20, (250, 200, 130), 0.6)]:
    g = np.clip(1 - (d - r * 0.55) / (r * 0.45), 0, 1) * a * 2
    m = g > th
    bg.a[m] = np.clip(bg.a[m].astype(float) * 0.45 + np.array(col) * 0.55, 0, 255).astype(np.uint8)
vignette(bg, 0.5, 0.55)

cv = Canvas(250, 350)
cv.a[:] = up(bg.a, 2)

# ---------------- Mittelgrund 3×: Seitenstatuen auf Sockeln + Büsche ----------------
MW, MH = 84, 117
mid = np.zeros((MH, MW, 4), np.uint8)


def mput(s, x, y):
    h, w = s.shape[:2]
    for j in range(h):
        for i in range(w):
            if s[j, i, 3] >= 128 and 0 <= y + j < MH and 0 <= x + i < MW:
                mid[y + j, x + i] = s[j, i]


GROUND = 86                                  # Standlinie der Seitenstatuen (3×-Raster)
L = petrify(hero)
R = flip(petrify(petr))
pl = plinth
for s, cx in [(L, 15), (R, MW - 15)]:
    # Schatten
    for i in range(-11, 12):
        X = cx + i
        if 0 <= X < MW and abs(i) < 11 - 0: mid[GROUND, X] = (30, 26, 36, 200)
    mput(pl, cx - pl.shape[1] // 2, GROUND - pl.shape[0])
    mput(s, cx - s.shape[1] // 2, GROUND - pl.shape[0] - s.shape[0] + 1)
# Formschnitt-Büsche außen neben den Statuen (etwas dunkler, im Abendlicht)
bd = darken(bush, 0.7)
mput(bd, 1 - 8, GROUND - bd.shape[0])
mput(flip(bd), MW - 9, GROUND - bd.shape[0])
cv.paste(up(mid, 3)[:350, 1:251], 0, 0)

# ---------------- Vordergrund 6×: die zerspringende Statue ----------------
FW, FH = 42, 59
fg = np.zeros((FH, FW, 4), np.uint8)


def dot(x, y, c, a=255):
    if 0 <= x < FW and 0 <= y < FH:
        fg[y, x, :3] = c; fg[y, x, 3] = a


# Bruchkante: gezackte Linie quer über die Brust; darüber Farbe (Mädchen), darunter Stein
brk = [9, 10, 11, 10, 12, 13, 12, 11, 12, 13, 14, 13, 12, 11, 12, 13, 12, 11, 10, 11]
SH, SWd = statue.shape[:2]
fig = statue.copy()
for j in range(SH):
    for i in range(SWd):
        if j < brk[i] and girl[j, i, 3] > 0:
            fig[j, i] = girl[j, i]
        elif j < brk[i] and girl[j, i, 3] == 0:
            fig[j, i] = 0
# Kante: Steinpixel direkt unter der Bruchlinie hell (frische Bruchfläche), darunter ein dunkler Saum
for i in range(SWd):
    j = brk[i]
    if j < SH and fig[j, i, 3]:
        fig[j, i, :3] = (230, 222, 236)
    if j + 1 < SH and fig[j + 1, i, 3]:
        fig[j + 1, i, :3] = pal[1] if len(pal) > 1 else pal[0]
# Risse im restlichen Stein (von der Bruchkante nach unten verzweigt)
cracks = [[(4, 11), (5, 14), (4, 16), (5, 19)], [(15, 13), (14, 16), (15, 18), (14, 21)],
          [(9, 12), (10, 15)], [(5, 14), (7, 15)], [(14, 16), (12, 17)]]
CR = (34, 28, 44)
for c in cracks:
    for (x0, y0), (x1, y1) in zip(c, c[1:]):
        n = max(abs(x1 - x0), abs(y1 - y0))
        for s in range(n + 1):
            x = round(x0 + (x1 - x0) * s / n); y = round(y0 + (y1 - y0) * s / n)
            if 0 <= y < SH and 0 <= x < SWd and fig[y, x, 3] and y > brk[x]:
                fig[y, x, :3] = CR
SX, SY = FW // 2 - SWd // 2, 52 - SH
# Schatten am Boden
for i in range(-2, SWd + 2):
    dot(SX + i, 52, (40, 34, 48))
    if 0 < i < SWd - 1: dot(SX + i, 53, (52, 44, 58))
for j in range(SH):
    for i in range(SWd):
        if fig[j, i, 3] >= 128: dot(SX + i, SY + j, tuple(fig[j, i, :3]))
# Splitter: kleine Steinbrocken (aus Statuenpixeln) fliegen von der Bruchkante weg, dazu Staubkrümel
chunks = [(-5, 6, 2, 2), (-8, 2, 2, 1), (SWd + 2, 5, 2, 2), (SWd + 6, 1, 1, 1), (-3, -2, 1, 1),
          (SWd + 1, -3, 2, 1), (-7, 10, 1, 1), (SWd + 5, 9, 1, 1)]
for k, (cx, cy, w, h) in enumerate(chunks):
    for j in range(h):
        for i in range(w):
            c = pal[min(len(pal) - 1, 2 + (i + j + k) % max(1, len(pal) - 3))]
            dot(SX + cx + i, SY + cy + j, tuple(c) if (i, j) != (0, 0) else (230, 222, 236))
# Kiesweg vorn (unter der Statue bis zum Rand)
for y in range(53, FH):
    for x in range(FW):
        if fg[y, x, 3] == 0:
            v = ((x * 5 + y * 3) % 7) < 2
            fg[y, x] = ((112, 100, 110) if v else (86, 76, 88)) + (255,)
cv.paste(up(fg, 6)[2:352, 1:251], 0, 0)
print(save(cv, '10_breaking_free.png'))
