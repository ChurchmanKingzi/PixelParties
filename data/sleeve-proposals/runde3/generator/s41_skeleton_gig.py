# -*- coding: utf-8 -*-
"""Sleeve 41 – „Graveyard Gig“: Konzert auf dem Friedhof bei Vollmond. Vorne groß der Skeleton Bard,
dahinter seine Band in blauen Jacketts (die Skelette aus der „Sett“-Ebene): links der Ritterhelm-Skelett mit der
roten E-Gitarre, rechts das gehörnte Skelett mit der Laute, dazwischen hinter Grabsteinen das Hexenhut- und das
Hut-Skelett als Chor. Bunte Noten steigen auf, zwei Scheinwerferkegel fallen auf den Sänger; im Vordergrund Grabsteine
als Bühnenrampe.

Quellen (Motive.xcf): 370 „Skeleton Bard“, 1223 „Ebene #618“ (Band in blauen Jacketts, z. T. hinter Grabsteinen),
670 „Ebene #557“ (rote E-Gitarre, aus „Elana“), 20 „Harpyformer Band #2“ (Laute), 369 „Ebene #657“ (Noten aus der
Skeleton-Bard-Karte), 75 „Skele Archer #2“ (Grabstein), 1286 „Dark Land“ (Friedhofsboden, violetter Nebel),
494 „Ebene #522“ (Nachthimmel, Farbe des Mondes). Mond, Lichtkegel: eigene Dither-Verläufe in diesen Farben.
"""
import math
from g_util import *

B = 'Motive'
W2, H2 = 250, 350
cv = Canvas(W2, H2)

# ---------- Himmel, Mond
night = layer(B, 494)
SKY = night[20, 150, :3].astype(int)                    # Nachtblau
MOON = night[315, 222, :3].astype(int)                  # Mondfarbe (Mitte des Mondes)
cv.a[:] = SKY
dither_blend(cv, (40, 20, 70), lambda x, y: min(1.0, y / 220) * 0.8, y1=230)
MCX, MCY, MR = 125, 118, 58
dither_blend(cv, MOON, lambda x, y: 1.0 if math.hypot(x - MCX, y - MCY) <= MR else
             max(0.0, 1 - (math.hypot(x - MCX, y - MCY) - MR) / 26) * 0.45, y1=230)
# ein paar Sterne (einzelne Pixel)
rng = np.random.default_rng(3)
for _ in range(40):
    x, y = rng.integers(6, W2 - 6), rng.integers(6, 150)
    if math.hypot(x - MCX, y - MCY) > MR + 12: cv.a[y, x] = (200, 210, 230)

# ---------- Boden: Friedhof aus „Dark Land“ (grauer Grund) 2×, nach hinten violett verblasst
dl = layer(B, 1286)[80:320, 101:420, :3]
ground = up(rgba(dl[120:200, 110:240]), 2)[..., :3]
GY = 212
cv.a[GY:] = mirror_tile(ground, W2, H2 - GY, ox=10)
dither_blend(cv, (60, 30, 90), lambda x, y: max(0.0, 1 - (y - GY) / 70) * 0.8, y0=GY)
cv.a[GY] = (30, 20, 45)

# ---------- Lichtkegel von oben links/rechts auf den Sänger
LIGHT = (255, 240, 180)
for sx in (20, 230):
    def cone(x, y, sx=sx):
        tx, ty = 125, 300
        # Abstand vom Strahl (sx,0)->(tx,ty), Breite wächst nach unten
        L = math.hypot(tx - sx, ty); t = ((x - sx) * (tx - sx) + y * ty) / (L * L)
        if t < 0: return 0.0
        px, py = sx + t * (tx - sx), t * ty
        d = math.hypot(x - px, y - py); wdt = 6 + 34 * t
        return 0.32 * max(0.0, 1 - d / wdt) if d < wdt else 0.0
    dither_blend(cv, LIGHT, cone)

# ---------- Band
band = parts(lay(B, 1223), dil=0)        # Ritter, Hexenhut(+Grab), Hut(+Grab), Gehörnter
band = sorted(band, key=lambda p: p.shape[1] * 100 + p.shape[0])
knight = [p for p in band if p.shape[:2] == (29, 19)][0]
horned = [p for p in band if p.shape[:2] == (24, 20)][0]
witch = [p for p in band if p.shape[:2] == (36, 23)][0]
hat = [p for p in band if p.shape[:2] == (27, 28)][0]
guitar = lay(B, 670)
lute = parts(lay(B, 20), dil=0); lute = max(lute, key=lambda p: p.shape[0])
bard = lay(B, 370)
notes = parts(lay(B, 369), dil=0)
grave = lay(B, 75)
for n, s in dict(knight=knight, horned=horned, witch=witch, hat=hat, guitar=guitar, lute=lute, bard=bard).items():
    Image.fromarray(s).save(os.path.join(xcfkit.CACHE, 'g41_%s.png' % n))


def stand(s, cx, feet, k, shadow=True):
    u = up(s, k); x, y = int(cx - u.shape[1] / 2), feet - u.shape[0]
    if shadow:
        sh = silhouette(u, (10, 5, 20))[::4]
        cv.paste(sh, x + 3, feet - sh.shape[0] + 2, alpha=0.45)
    cv.paste(u, x, y)
    return x, y, u


# hinterste Reihe: Chor hinter Grabsteinen (3×)
stand(witch, 92, 250, 3)
stand(flip(hat), 162, 252, 3)
# Gitarrist links, Lautenspieler rechts (4×)
x, y, u = stand(knight, 44, 292, 4)
g = up(guitar, 3)
cv.paste(g, x + 10, y + 50)
x, y, u = stand(flip(horned), 206, 292, 4)
lu = up(flip(lute), 2)
cv.paste(lu, x + 2, y + 18)
# Noten
for nt, (nx, ny), k in zip(notes, [(34, 70), (198, 52), (224, 150), (20, 150)], [4, 4, 3, 3]):
    u = up(nt, k); paste_shadow(cv, u, nx, ny, dx=2, dy=2, col=(10, 5, 30), alpha=0.5)
# Sänger vorn (6×)
stand(bard, 125, 334, 6)
# Grabsteine als Bühnenrampe (3×) links/rechts vorn
gr = up(grave, 3)
paste_shadow(cv, gr, 2, H2 - gr.shape[0] + 8, dx=3, dy=0, alpha=0.4)
paste_shadow(cv, flip(gr), W2 - gr.shape[1] - 2, H2 - gr.shape[0] + 8, dx=-3, dy=0, alpha=0.4)

vignette(cv, 0.4, 0.6)
frame(cv, ((8, 4, 16), (90, 60, 140), (200, 180, 240), (8, 4, 16)))
print(save(cv, '41_skeleton_gig.png'))
