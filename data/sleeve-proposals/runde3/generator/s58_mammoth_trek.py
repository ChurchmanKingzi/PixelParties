# -*- coding: utf-8 -*-
"""Sleeve 58 – „Mammoth Trek“ (Runde 3b, neu): Eiszeit. Ein Wollmammut stapft im Schneetreiben durch die
Schneeebene und zieht eine Spur tiefer Fußstapfen hinter sich her; im Dunst dahinter ziehen zwei weitere Mammuts
über den Kamm, am Horizont schneebedeckte Berge im Abendlicht.

Skalierung (Regel A): Mammut vorn, Schneefeld, Fußspuren, Schneeflocken 3×; die beiden fernen Mammuts 2× (klar
weiter hinten, im Dunst aufgehellt); Berge als Silhouette im 3×-Raster, Himmel Dither-Verlauf (selbst erstellt).

Vollständigkeit (Regel B): Ebene „Ebene #367“ [773] ist das ganze Mammut; in der Kartenszene „Sichtbar #51“ [771]
liegt darüber nur die Bewegungsunschärfe „Whoolmoth“ [774] (Angriffs-Effekt) – ohne sie ist die Figur vollständig.

Quellen (Motive.xcf): 773 „Ebene #367“ (Mammut).
"""
import math
from g_util import *

B = 'Motive'
W2, H2 = 250, 350
K = 3
cv = Canvas(W2, H2)
rng = np.random.RandomState(58)

# ---------------------------------------------------------------- Himmel: kaltes Blau -> rosiges Abendlicht
HOR = 170
cols = [np.array(c) for c in ((34, 46, 92), (84, 104, 160), (186, 170, 200), (240, 196, 190))]
for y in range(HOR):
    t = y / HOR * (len(cols) - 1)
    i = min(int(t), len(cols) - 2); u = t - i
    for x in range(W2):
        cv.a[y, x] = cols[i + 1] if u > BAYER4[y % 4, x % 4] else cols[i]

# Berge (3×-Raster): zwei Ketten, hintere heller (Luftperspektive), Schneekappen
def ridge(base, amp, seed, col, snow, peaks):
    r = np.random.RandomState(seed)
    xs = np.arange(W2 // K + 2)
    h = np.zeros(len(xs))
    for px, ph, pw in peaks:
        h = np.maximum(h, ph * np.clip(1 - np.abs(xs - px) / pw, 0, 1))
    h += r.randint(0, 2, len(xs))
    for i, hh in enumerate(h):
        top = base - int(hh) * K
        cv.rect(i * K, top, i * K + K, base, col)
        sn = max(1, int(hh * snow))
        if hh > 4: cv.rect(i * K, top, i * K + K, top + sn * K, (236, 238, 248))


ridge(HOR, 0, 1, (150, 150, 190), 0.45, [(12, 26, 16), (44, 20, 14), (70, 30, 18)])
ridge(HOR, 0, 2, (104, 110, 150), 0.3, [(0, 14, 12), (30, 16, 12), (58, 12, 10), (84, 18, 12)])

# ---------------------------------------------------------------- Schneefeld (3×): Kamm, Ebene
for by in range(HOR // K, H2 // K + 1):
    for bx in range(W2 // K + 1):
        d = (by * K - HOR) / (H2 - HOR)
        base = np.array((200, 212, 236)) * (1 - d) + np.array((236, 242, 252)) * d
        r = rng.rand()
        c = base * (0.93 if r < 0.12 else 1.0)
        cv.rect(bx * K, by * K, bx * K + K, by * K + K, tuple(int(v) for v in c))
# Schneekamm (hintere Welle) mit Schattenkante
for i in range(W2 // K + 1):
    y = HOR + 12 + int(6 * math.sin(i / 9.0)) // K * K
    cv.rect(i * K, y, i * K + K, y + K, (176, 188, 222))

# ferne Mammuts (2×, im Dunst) auf dem Kamm
mam = lay(B, 773)
Image.fromarray(mam).save(os.path.join(xcfkit.CACHE, 'g58_mammoth.png'))
far = tint(up(mam, 2), (190, 196, 226), 0.55)
for x, y in ((150, 188), (196, 194)):
    cv.paste(far, x, y - far.shape[0])

# ---------------------------------------------------------------- Mammut vorne (3×) + Fußspuren
M = up(mam, K)
mx, feet = 28, 300
# Spur: Fußstapfen (3×3 Blöcke) von rechts hinten zum Mammut
for j, (fx, fy) in enumerate(((246, 244), (234, 252), (222, 250), (210, 260), (198, 258), (186, 268),
                              (174, 266), (162, 278), (150, 276), (138, 288), (126, 286), (114, 296))):
    cv.rect(fx, fy, fx + 2 * K, fy + K, (150, 164, 206))
    cv.rect(fx, fy + K, fx + 2 * K, fy + 2 * K, (178, 190, 226))
# Schatten unter dem Mammut (flach, 3×-Raster)
for i in range(-26, 28):
    w = int(4 * math.sqrt(max(0.0, 1 - (i / 28) ** 2)))
    x = mx + M.shape[1] // 2 + i * K
    cv.rect(x, feet - K, x + K, feet - K + w * K // 2 + K, (160, 172, 214))
cv.paste(M, mx, feet - M.shape[0])
# Schnee an den Füßen (3×-Blöcke vor den Fußsohlen)
for fx in range(mx + 6, mx + M.shape[1] - 6, 6):
    if cv.a[feet - 2, fx].sum() < 400:
        cv.rect(fx - K, feet - K, fx + K, feet, (232, 238, 250))

# ---------------------------------------------------------------- Schneetreiben (3×3-Flocken, schräg)
for i in range(70):
    x, y = rng.randint(0, W2 // K) * K, rng.randint(0, H2 // K) * K
    c = (250, 250, 255) if rng.rand() < 0.7 else (214, 220, 240)
    cv.rect(x, y, x + K, y + K, c)
vignette(cv, 0.3, 0.65)
print(save(cv, '58_mammoth_trek.png'))
