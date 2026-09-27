# -*- coding: utf-8 -*-
"""Sleeve 05 – Mondduell der Idej-Lords (Runde 3b überarbeitet).

Auf einem kahlen Hügelkamm stehen sich vor dem riesigen Vollmond Nobunakin (rot, mit
erhobener geschwungener Klinge) und der geisterhaft schwebende Shoguwana (blau leuchtend) gegenüber.
Der helle Mond steht direkt hinter Nobunakin, damit der dunkelrote Lord als klare Form vor hellem
Grund steht (statt als „rote Masse“ vor rotem/rosa Grund); Shoguwana leuchtet vor dem Nachthimmel.
(Todugawin entfällt: seine Ebene „ARBEITE HIER“ ist unfertig, die Stangenwaffe läuft verwaschen aus.)

Skalierung: ALLES einheitlich 5× (Szene im 5×-Raster = 50×70 Zellen): Himmel, Sterne, Mond,
Hügel, beide Lords, Lichtschein. Verläufe ohne Dithering (jede Rasterzelle einfarbig).

Quellen (MotiveJapan.xcf): Ebene #34 [150] (Klinge) + Ebene #41 [152] + Ebene #39 [154] (Körper) +
Ebene #40 [155] (Augen) = Nobunakin mit Klinge (vgl. Karte „Idej Blade – Hakai“), Shoguwana [61]
(vollständig, geisterhafter Schweif statt Füßen). Himmel, Mond, Hügel und Lichtschein: selbst erstellt im 5×-Raster.
"""
from a_util import *  # noqa

B = 'MotiveJapan'
cv = Canvas(250, 350)
G = 5
lo = lowres(G)                                         # 50×70
W_, H_ = lo.w, lo.h

nob = sprite('a05_nobunakin', B, [150, 152, 154, 155])  # 23×37
shog = sprite('a05_shoguwana', B, [61])                 # 16×29
print(nob.shape, shog.shape)

# --- Nachthimmel + Sterne ---------------------------------------------------------------------------------
sgrad(lo, 0, H_, [(6, 6, 24), (14, 14, 46), (34, 26, 78), (60, 36, 92)])
rng = np.random.RandomState(5)
for _ in range(22):
    lo.px(rng.randint(0, W_), rng.randint(0, 40), (180, 180, 230) if rng.rand() < .4 else (100, 100, 160))

# --- Vollmond (hinter Nobunakin) ---------------------------------------------------------------------------
MX, MY, MR = 17, 40, 19
sglow(lo, MX, MY, MR * 1.7, (190, 180, 255), 0.3)
for y in range(MY - MR, MY + MR):
    for x in range(MX - MR, MX + MR):
        d = math.hypot(x + .5 - MX, y + .5 - MY)
        if d < MR and 0 <= x < W_:
            c = (246, 240, 214)
            if d > MR - 1.6: c = (226, 216, 196)
            lo.a[y, x] = c
# Mondflecken (Mare) als ruhige Flächen
for (cx, cy, r) in [(9, 30, 3.5), (22, 27, 2.5), (29, 38, 2), (4, 44, 2)]:
    for y in range(int(cy - r), int(cy + r) + 1):
        for x in range(int(cx - r), int(cx + r) + 1):
            if math.hypot(x + .5 - cx, y + .5 - cy) < r: lo.a[y, x] = (232, 224, 204)

GY = 60                                                  # Hügelkamm

# --- Hügel (selbst gezeichnet, flacher Bogen) -----------------------------------------------------------------
for x in range(W_):
    top = GY + int(round(((x - 25) / 25.0) ** 2 * 3))
    for y in range(top, H_):
        t = (y - top) / 20
        lo.a[y, x] = (38, 16, 44) if t < 0.15 else (24, 10, 30)
    lo.px(x, top, (88, 40, 88))                           # Kante im Mondlicht

# --- die beiden Lords --------------------------------------------------------------------------------------
NX = 13                                                   # Mitte Nobunakin (Körper)
ny = GY + int(round(((NX - 25) / 25.0) ** 2 * 3))
lo.paste(nob, NX - 7, ny - nob.shape[0] + 1)
SXc = 38
sy = GY + int(round(((SXc - 25) / 25.0) ** 2 * 3))
sglow(lo, SXc, sy - 15, 13, (80, 200, 255), 0.35)
lo.paste(shog, SXc - shog.shape[1] // 2, sy - shog.shape[0] - 2)   # schwebt über dem Kamm

blow(cv, lo, G)
print(save(cv, '05_idej_mondduell.png'))
