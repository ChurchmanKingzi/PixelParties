# -*- coding: utf-8 -*-
"""10 Breaking Free – Im abendlichen Statuengarten des Petrifiers zerspringt die versteinerte Statue eines
rothaarigen Mädchens: Eine schräge, gezackte Bruchkante läuft von der linken Schulter zur rechten Hüfte – darüber
ist sie wieder lebendig und farbig, darunter noch Stein in ihrer eigenen Körperform, Risse laufen zur Kante hinauf,
an der Kante platzen Splitter ab, dahinter ein warmer Lichtschein. Zwei noch starre,
versteinerte Opfer stehen weiter hinten auf Sockeln, dahinter eine dunkle Hecke mit Formschnitt-Büschen.

Quellen (Motive.xcf, alle aus den Karten „Petrifier“ / „Petrification Break“):
  1457 „Petrification Break #1“ – das Mädchen: oberhalb der Bruchkante in Farbe, darunter in ihrer eigenen Silhouette zu Stein
       umgefärbt (Palette der Steinstatue 1458 „Petrifier“, linker Teil), 5×
  1456 „Petrification Break“ – linker Teil: zerbrochene Statuenhülle; nur ihr Sockel (untere 5 Zeilen), 5× und 2×
  1455 „Petrification Break #3“ (blonder Held mit Spiegelschild) und 1453 „Petrifier #1“ (brauner Mantel) –
       beide zu Stein umgefärbt, als Seitenstatuen weit hinten, 2×
  1450 „Petrifier #4“ (Formschnitt-Busch), 2× und als Heckentextur 2×
Selbst gezeichnet: Abendhimmel, Lichtschein, Risse, Bruchkante, Splitter (Steinfarben der Statue), Kiesweg, Schatten.

Skalierung:
  Vordergrund (Statue/Mädchen, Sockel, Risse, Splitter, Schatten): 5× (Raster 50×70)
  Hintergrund (Himmel, Schein, Hecke, Kiesweg, Seitenstatuen mit Sockeln, Büsche): 2× (Raster 125×175)
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
    """Sprite zu Stein umfärben: Helligkeit behalten (Kontrast leicht gespreizt), Farbton der Statue."""
    out = s.copy()
    m = out[..., 3] > 0
    lum = out[..., :3].astype(float) @ np.array([0.3, 0.55, 0.15])
    lo, hi = np.percentile(lum[m], 2), np.percentile(lum[m], 98)
    v = np.clip((lum - lo) / max(hi - lo, 1), 0, 1)
    v = np.round(v * 4) / 4                                        # 5 Steinstufen
    dark, light = np.array([52, 44, 62]), np.array([214, 206, 222])
    col = dark + (light - dark) * v[..., None]
    out[m, :3] = col[m].astype(np.uint8)
    return out


# ---------------- Hintergrund 2× ----------------
bg = Canvas(BW, BH)
sky = [(26, 20, 52), (48, 32, 78), (92, 52, 96), (160, 84, 102), (220, 132, 104)]
t = np.clip((yy - 8) / 72, 0, 1) * (len(sky) - 1)
q = np.floor(t + th * 0.999).clip(0, len(sky) - 1).astype(int)
for k, c in enumerate(sky):
    bg.a[q == k] = c
# erste Abendsterne
rs = np.random.RandomState(12)
for _ in range(22):
    x, y = rs.randint(3, BW - 3), rs.randint(3, 34)
    bg.px(x, y, (200, 190, 220))
# Hecke: dunkelgrüne Wand aus gekachelter Busch-Textur (Mitte von 1450), oben gewellt
btex = bush[6:18, 3:13, :3].astype(float) * 0.55
HT = 60
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
d = np.hypot(xx + 0.5 - 62.5, (yy + 0.5 - 88) * 0.9)
for r, col, a in [(56, (140, 92, 70), 0.5), (40, (200, 140, 88), 0.55), (26, (250, 200, 130), 0.6)]:
    g = np.clip(1 - (d - r * 0.55) / (r * 0.45), 0, 1) * a * 2
    m = g > th
    bg.a[m] = np.clip(bg.a[m].astype(float) * 0.45 + np.array(col) * 0.55, 0, 255).astype(np.uint8)
# Seitenstatuen (versteinerte Opfer) auf Sockeln und Formschnitt-Büsche – weit hinten, Originalgröße im 2×-Raster
GROUND = 132
L = petrify(hero)
R = flip(petrify(petr))
for s_, cx in [(L, 22), (R, BW - 22)]:
    for i in range(-10, 11):
        bg.px(cx + i, GROUND, (34, 30, 40))
    bg.paste(plinth, cx - plinth.shape[1] // 2, GROUND - plinth.shape[0])
    bg.paste(s_, cx - s_.shape[1] // 2, GROUND - plinth.shape[0] - s_.shape[0] + 1)
bd = darken(bush, 0.75)
bg.paste(bd, 0 - 4, GROUND - bd.shape[0] + 1)
bg.paste(flip(bd), BW - bd.shape[1] + 4, GROUND - bd.shape[0] + 1)
vignette(bg, 0.5, 0.55)

cv = Canvas(250, 350)
cv.a[:] = up(bg.a, 2)

# ---------------- Vordergrund 5×: die zerspringende Statue auf ihrem Sockel ----------------
FW, FH = 50, 70
fg = np.zeros((FH, FW, 4), np.uint8)


def dot(x, y, c, a=255):
    if 0 <= x < FW and 0 <= y < FH:
        fg[y, x, :3] = c; fg[y, x, 3] = a


SH, SWd = girl.shape[:2]
gm = girl[..., 3] > 0                                       # Silhouette der Figur (Kleid, Arme, Beine, Haar)
stone = petrify(girl)                                       # derselbe Körper in Stein (Helligkeit bleibt -> Falten, Beine lesbar)
# Steinpalette auf die der Statuen-Ebene 1458 ziehen (dunkelster/hellster Ton)
lum = stone[..., :3].astype(float).mean(-1, keepdims=True) / 255
stone[..., :3] = np.where(gm[..., None], pal[0] + (pal[-1] - pal[0]) * np.clip(0.25 + lum * 0.85, 0, 1), 0).astype(np.uint8)
# Bruchkante: schräg und gezackt von der linken Schulter (Zeile 10) zur rechten Hüfte (Zeile 17)
brk = [int(round(10 + 7 * i / (SWd - 1) + (1 if i % 3 == 1 else (-1 if i % 4 == 2 else 0)))) for i in range(SWd)]
fig = np.zeros_like(girl)
for j in range(SH):
    for i in range(SWd):
        if not gm[j, i]: continue
        fig[j, i] = girl[j, i] if j < brk[i] else stone[j, i]
FRESH, CR, CRL = (236, 228, 240), (26, 20, 34), (200, 192, 210)
# frische Bruchfläche (hell) direkt an der Kante, eine Zeile darunter dunkler Saum
for i in range(SWd):
    j = brk[i]
    if j < SH and gm[j, i]: fig[j, i, :3] = FRESH
    if j + 1 < SH and gm[j + 1, i] and i % 2 == 0: fig[j + 1, i, :3] = pal[0]
# Risse: laufen von unten (Kleid/Beine) nach oben zur Bruchkante
cracks = [[(3, 22), (4, 19), (3, 16), (4, 13)], [(9, 21), (8, 18), (9, 16)], [(15, 22), (16, 19), (14, 17)],
          [(4, 19), (6, 18)], [(16, 19), (18, 20)]]
for c in cracks:
    for (x0, y0), (x1, y1) in zip(c, c[1:]):
        n = max(abs(x1 - x0), abs(y1 - y0))
        for st in range(n + 1):
            x = round(x0 + (x1 - x0) * st / n); y = round(y0 + (y1 - y0) * st / n)
            if 0 <= y < SH and 0 <= x < SWd and gm[y, x] and y > brk[x]:
                fig[y, x, :3] = CR
BASE = 64                                                   # Standlinie des Sockels
PX = FW // 2 - plinth.shape[1] // 2
SX, SY = FW // 2 - SWd // 2, BASE - plinth.shape[0] - SH + 1
# Schatten am Boden
for i in range(-3, plinth.shape[1] + 3):
    dot(PX + i, BASE, (34, 28, 40))
    if 0 < i < plinth.shape[1] - 1: dot(PX + i, BASE + 1, (46, 40, 52))
for j in range(plinth.shape[0]):
    for i in range(plinth.shape[1]):
        if plinth[j, i, 3] >= 128:
            dot(PX + i, BASE - plinth.shape[0] + j, tuple(plinth[j, i, :3]) if j else (150, 140, 160))
for j in range(SH):
    for i in range(SWd):
        if fig[j, i, 3] >= 128: dot(SX + i, SY + j, tuple(fig[j, i, :3]))
# abplatzende Splitter: starten an der Bruchkante und fliegen schräg nach außen/oben (kleiner werdend)
LITE, MIDC, DARK = (220, 212, 228), (150, 140, 160), (60, 52, 70)
chunks = [(-2, brk[0] - 1, 2, 2), (-5, brk[0] - 4, 2, 1), (-7, brk[0] - 8, 1, 1),
          (SWd, brk[-1] - 2, 2, 2), (SWd + 3, brk[-1] - 6, 2, 1), (SWd + 5, brk[-1] - 11, 1, 1),
          (8, brk[8] - 13, 1, 1), (13, brk[13] - 15, 1, 1)]
for (cx, cy, w, h) in chunks:
    for j in range(h):
        for i in range(w):
            c = LITE if (i, j) == (0, 0) else (DARK if (i == w - 1 and j == h - 1 and w * h > 1) else MIDC)
            dot(SX + cx + i, SY + cy + j, c)
# Staubkrümel an der Kante
for (cx, cy) in [(-1, brk[0] + 1), (SWd, brk[-1] + 1), (SWd + 1, brk[-1] - 4), (-3, brk[0] - 2)]:
    dot(SX + cx, SY + cy, (184, 174, 190))
cv.paste(up(fg, 5), 0, 0)
print(save(cv, '10_breaking_free.png'))
