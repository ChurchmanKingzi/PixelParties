# -*- coding: utf-8 -*-
"""14 Misled Reflection – Friedhelm, die fehlgeleitete Rächerin, steht in Rüstung und rotem Umhang
knöcheltief in einem stillen See in der Abenddämmerung. Das Wasser spiegelt aber nicht sie, sondern
ihr dunkles, verführtes Ich im braunen Kittel.

Quellen (MotiveGN.xcf):
  Ebene 71 „Friedhelm“ – Friedhelm in Rüstung mit rotem Umhang (Karte „Friedhelm, the Misled Avenger“;
      geprüft gegen Szene 26 „Sichtbar #137“: 408/410 Pixel identisch, Rest vom Netz verdeckt)
  Ebene 70 „Friedhelm-Kopie“ – dieselbe Figur im braunen Kittel (Szene 50 „Sichtbar #117“, 420/422)
      -> als Spiegelbild (senkrecht gespiegelt)
Tiefenebenen / Skalierung (250×350-Raster, Ausgabe ×3):
  Himmel, ferne Hügel und deren Spiegelung, Wasserlinien in der Ferne 2× (Raster 125×175);
  Friedhelm, ihr Spiegelbild, Wellenring um die Knöchel, Wellenstriche im Spiegelbild 5× (Raster 50×70).
"""
import sys, os, math
from common import *  # noqa
sys.path.append(os.path.join(HERE, '..', '..', 'runde3', 'generator'))
from bkit import *    # noqa

D = 'MotiveGN'
W, H = 250, 350
WL = 200                       # Wasserlinie (250er-Raster), = Knöchel der Figur

# ---------------------------------------------------------------- Ferne (2×)
bg = Canvas(125, 175)
hz = WL // 2 - 4               # Uferlinie der fernen Hügel im 2×-Raster
vgrad(bg, [(0, (18, 12, 40)), (0.35, (44, 24, 70)), (0.7, (120, 52, 78)), (1, (226, 128, 84))], y1=hz)
# ferne bewaldete Hügel als Silhouette (selbst gezeichnet): Talsenke hinter der Figur, Hänge zu beiden
# Seiten, oben mit runden Baumkronen
HC = [(30, 18, 42), (46, 26, 58)]
def ridge(x):
    d = abs(x + .5 - 62.5) / 62.5
    return hz - 3 - 22 * d ** 1.6
for x in range(125):
    top = ridge(x)
    for k in range(-3, 4):                                # Baumkronen: Buckel alle 5 Spalten
        cx = (x // 5) * 5 + 2.5 + k * 5
        rr = 2.6
        dy = rr ** 2 - (x + .5 - cx) ** 2
        if dy > 0: top = min(top, ridge(cx) - math.sqrt(dy) + 0.5)
    top = int(round(top))
    for y in range(max(0, top), hz):
        bg.a[y, x] = HC[1] if y <= top + 1 and (x % 5) in (1, 2) else HC[0]
# erste Sterne am Dämmerungshimmel
for sx_, sy_ in [(14, 8), (40, 20), (70, 6), (98, 16), (116, 30), (26, 36), (58, 30), (88, 40)]:
    bg.px(sx_, sy_, (220, 200, 230))
# Wasser: gespiegelter Himmel + gespiegelte Hügel, dunkler und kühler
for y in range(hz, 175):
    src = hz - 1 - (y - hz)
    if src < 0: src = 0
    c = bg.a[src].astype(float) * 0.55 + np.array([10, 16, 40]) * 0.45
    bg.a[y] = c.astype(np.uint8)
# ferne Wasserlinien (helle Striche) im 2×-Raster
rng = np.random.RandomState(3)
for k in range(26):
    y = rng.randint(hz + 2, 175)
    x0 = rng.randint(-10, 120); L = rng.randint(4, 14)
    for x in range(max(0, x0), min(125, x0 + L)):
        bg.a[y, x] = np.minimum(bg.a[y, x].astype(int) + 34, 255)
cv = Canvas(W, H)
cv.a[:] = up(np.dstack([bg.a, np.full((175, 125), 255, np.uint8)]), 2)[:H, :W, :3]

# ---------------------------------------------------------------- Nähe (5×)
G = 5
gw, gh = 50, 70
wl = WL // G                                               # 40
fr = compose(D, [71])                                      # 26×24, Füße enden mit Zeile 21
dark = compose(D, [70])                                    # 27×24 (eine Leinwandzeile höher)
FEET = 22                                                  # Zeilen 0..21 über Wasser, Rest (Umhangzipfel) im Wasser
FX = (gw - 24) // 2                                        # 13 -> Mitte 25
fy0 = wl - FEET
out = np.zeros((gh, gw, 4), np.uint8)
WATER = cv.a[WL + 20, 125].astype(float)

# Spiegelbild: das dunkle Ich (Ebene 70) senkrecht gespiegelt ab der Wasserlinie, kühl getönt;
# Ebene 70 beginnt eine Leinwandzeile höher als Ebene 71, Fußlinie gleich -> Zeilen 0..22
ref = dark[:FEET + 1][::-1]
for j in range(ref.shape[0]):
    shift = 1 if j in (9, 16) else (-1 if j in (13, 20) else 0)   # leichtes Wellenzittern
    for i in range(24):
        p = ref[j, i]
        if p[3] == 0: continue
        X, Y = FX + i + shift, wl + j
        if 0 <= X < gw and 0 <= Y < gh:
            c = (p[:3].astype(float) * 0.62 + np.array([24, 26, 70]) * 0.38) * 0.85
            out[Y, X] = tuple(c.astype(np.uint8)) + (255,)
# helle Wellenstriche quer über das Spiegelbild (jede 4. Zeile, versetzt)
for j in range(3, ref.shape[0], 4):
    for i in range(-2, 26):
        X, Y = FX + i, wl + j
        if (i + j // 4 * 3) % 7 < 3 and 0 <= X < gw:
            base = out[Y, X, :3].astype(int) if out[Y, X, 3] else WATER.astype(int)
            out[Y, X] = tuple(np.minimum(base + 36, 255)) + (255,)
# Friedhelm (bis zu den Knöcheln)
for j in range(FEET):
    for i in range(24):
        if fr[j, i, 3]:
            out[fy0 + j, FX + i] = fr[j, i]
# Wasserlinie an den Knöcheln + flacher Wellenring (gepunktet)
RING = tuple(np.minimum(WATER + 60, 255).astype(np.uint8))
for x in range(-12, 13):
    X = 25 + x
    if abs(x) >= 5 and x % 2 == 0 and not out[wl, X, 3]:
        out[wl, X] = RING + (255,)
cv.paste(up(out, G)[:H, :W], 0, 0)
vignette_grid(cv, 0.5, 0.6, g=2)
print(save(cv, '14_misled_reflection.png'))
