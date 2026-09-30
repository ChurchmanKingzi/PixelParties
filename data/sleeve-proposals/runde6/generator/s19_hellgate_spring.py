# -*- coding: utf-8 -*-
"""19 Hellgate Spring – Gegner „Gates to Hell“ (sample-Structure Deck Gates to Hell),
Held/Hauptmotiv: Silent Water Mizune (Base-Karte).

Idee (Beschwörung, Tiefenstaffelung): Mizune steigt – wie auf ihrer Karte – aus ihrer weißblauen
Schaumsäule aus einem stillen, dunklen Gewässer auf. Hinter ihr hat sich der Demon's Gate (Cover-Karte)
geöffnet: der rote, geflügelte Dämon tritt aus dem rautenförmigen, glühenden Riss, darüber der rote
Höllenhimmel mit schwarzen Wolkenfetzen. Das stille Wasser spiegelt Tor und Dämon rot (Silent Water),
um Mizunes Schaumsäule laufen Wellenringe. (Deck: 9× Summoning Magic, 4× Demon's Gate.)

Quellen (Motive.xcf):
  Mizune: Kartenszene „Sichtbar“ Ebene 128 (Lage 322,296) – Maske = Ebenen 1306 „Mizune #15“ (Körper),
          1309 „Mizune #3“ (Schulterteile), 1311 „Mizune #4“ (Schaumsäule); Farben pixelgenau aus der
          Szene (dort verdeckt der Schaum die Beine mit dem weichen Schatten 1310); die unteren 7 Zeilen
          der Schaumsäule liegen außerhalb des Kartenausschnitts und kommen direkt aus Ebene 1311.
          Die rothaarige Figur der Karte (Ebene 1313) gehört nicht zu Mizune und fehlt hier.
  Demon's Gate: Ebenen 1496 „Demons Gate“ (Dämon), 1497 „Demons Gate #2“ (Flügel), 1498 „Demons Gate #4“
          (Riss/Tor, halbtransparent), 1499 „Ebene #28“ (roter Himmel mit schwarzen Wolken) – in der
          Anordnung der Kartenszene Ebene 116.
Selbst gezeichnet: Wasserfläche mit Spiegelung (gespiegeltes Tor, abgedunkelt, zeilenweise versetzt),
          Wellenringe, Horizontlinie, Abdunkelung zum oberen Rand.
Skalierung: Himmel, Demon's Gate, Wasser, Spiegelung, Wellenringe – 2×-Raster (125×175);
            Mizune 27×44 → 108×176 – 4× (einziges 4×-Element, klar im Vordergrund).
"""
import math
from common import *  # noqa
from dkit19_24 import *  # noqa

B = 'Motive'

# ---------------------------------------------------------------- Sprites
miz = scene_masked(B, 128, [1306, 1309, 1311])
miz[346:, :, :3] = layer(B, 1311)[346:, :, :3]          # Schaumsäule unterhalb des Kartenausschnitts
miz = miz[309:353, 350:377].copy()
assert miz.shape[:2] == (44, 27)
Image.fromarray(miz).save(os.path.join(xcfkit.CACHE, 'o19_mizune.png'))

gate = compose(B, [1496, 1497, 1498, 1499], crop=False)   # ganze Leinwand, Szene wie Karte 116

# ---------------------------------------------------------------- Hintergrund 2× (125×175)
GW, GH = grid(2)
HOR = 108                                   # Wasserlinie (Raster 2×)
AX = 333                                    # Mittelachse des Tores in Ebenenkoordinaten
X0, Y0 = AX - 62, 182 - HOR                 # Fenster: Torunterkante (y≈172) etwas über dem Wasser
bg = rgba(GW, GH)
sky = gate[Y0:Y0 + HOR, X0:X0 + GW].copy()
sky[..., 3] = 255
# oben abdunkeln (Rahmenzone ruhig), geordnet gedithert
for y in range(HOR):
    t = max(0.0, 1 - y / 46)
    for x in range(GW):
        q = dith(t * 0.75, x, y, 4)
        sky[y, x, :3] = (sky[y, x, :3].astype(float) * (1 - q) + np.array([18, 2, 4]) * q).astype(np.uint8)
bg[:HOR] = sky

# Wasser: Spiegelung des Tores, dunkel-blau überlagert, zeilenweise versetzt (Wellen)
WATER = np.array([10, 14, 34])
for y in range(HOR, GH):
    d = y - HOR
    sy = HOR - 1 - int(d * 0.9)            # leicht gestauchte Spiegelung
    off = int(round(math.sin(d * 0.9) * (1 + d / 30)))
    fade = max(0.0, 0.85 - d / 70)
    for x in range(GW):
        sx = min(GW - 1, max(0, x + off))
        c = sky[max(0, sy), sx, :3].astype(float) if sy >= 0 else WATER
        f = fade * (0.75 if (d % 3 == 1) else 1.0)
        col = c * f + WATER * (1 - f)
        bg[y, x, :3] = col.clip(0, 255).astype(np.uint8)
        bg[y, x, 3] = 255
# Horizont: dunkle Uferlinie, darunter 1 px roter Glanz
for x in range(GW):
    bg[HOR, x, :3] = (40, 6, 10)
    if 50 <= x <= 75 or bay(x, 0) > 0.5:
        bg[HOR + 1, x, :3] = (120, 22, 18) if 48 <= x <= 77 else bg[HOR + 1, x, :3]

# Wellenringe um Mizunes Schaumsäule (Fuß der Säule bei Raster y≈163)
MX, MY = 62.5, 160
for r, col in ((20, (70, 90, 150)), (29, (48, 62, 118)), (39, (34, 42, 88))):
    ellipse_ring(bg, MX, MY, r, r * 0.28, col, skip=lambda x, y: y < MY - 3 and abs(x + .5 - MX) < 25)
# Glanzlinien auf dem Wasser (kurze helle Striche, rot gespiegelt)
for (x, y, n) in ((20, 118, 5), (95, 121, 6), (34, 131, 4), (86, 136, 5), (14, 146, 3), (106, 150, 4)):
    for i in range(n):
        setp(bg, x + i, y, (150, 40, 30) if i % 2 == 0 else (95, 22, 22))

cv = Canvas(W, H)
blit(cv, bg, 2)

# ---------------------------------------------------------------- Mizune 4×
k = 4
mw, mh = miz.shape[1] * k, miz.shape[0] * k
mx = (W - mw) // 2 + 2
my = 340 - mh                              # Schaumsäulenfuß im Wasser, Gesicht bei ~y 190
cv.paste(up(miz, k), mx, my)

print(save(cv, '19_hellgate_spring.png'))
