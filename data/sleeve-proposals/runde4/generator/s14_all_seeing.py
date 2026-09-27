# -*- coding: utf-8 -*-
"""14 All-Seeing – Porträt: Kassaran, der Seher von Allem, schwebt mit weiß glühenden Augen im Zentrum
seiner Trance; von seinem Blick gehen konzentrische Ringe aus, und jeder Ring ist ein Fenster in eine
andere Welt, die er gleichzeitig sieht: Sternenhimmel, Wald, Dorfteich, Wüste, Labor.

Quellen (MotiveGN.xcf):
  Ebene 343 „Kassaran“ – Kassaran mit leuchtenden Augen (Karte „Kassaran, Seer of Everything“;
      geprüft gegen Szene 8 „Sichtbar #144“: 274/274 Pixel identisch)
  Texturen für die Ringe: Ebene 107 (Galaxie/Sterne), 330 (Waldhügel), 97 (Dorfteich), 106 (Sand),
      134 (Labor-Bodenplatten)
Tiefenebenen / Skalierung (250×350-Raster, Ausgabe ×3):
  innere Trance-Ringe, Welt-Ringe (Texturen) und Trennlinien 2× (Raster 125×175);
  Kassaran + sein Schlagschatten 6× (eigene Ebene, eindeutig im Vordergrund).
"""
import sys, os, math
from common import *  # noqa
sys.path.append(os.path.join(HERE, '..', '..', 'runde3', 'generator'))
from bkit import *    # noqa

D = 'MotiveGN'
W, H = 250, 350
kas = [p for p in parts(sprite('c14_kassaran', D, [343]), dil=0, minpx=1) if p.shape[0] > 10][0]   # 23×18
K = 6
EYE = (9, 8)                    # Augenhöhe im Sprite (x, y) – Mittelpunkt der Ringe
CX, CY = 125, 150               # Augenpunkt im Bild

# ---------------------------------------------------------------- Ringe (2×)
def tex(i, x0, y0, w=None, h=None):
    """Ausschnitt ab (x0, y0) in Leinwandkoordinaten; bei Bedarf gekachelt (Periode w×h)."""
    L = layer(D, i)
    w = w or 125; h = h or 175
    src = L[y0:y0 + h, x0:x0 + w, :3].astype(float)
    return src[np.arange(175)[:, None] % src.shape[0], np.arange(125)[None, :] % src.shape[1]]
worlds = [
    tex(107, 170, 160) * 0.8,                     # Sterne/Galaxie
    tex(330, 150, 240, 125, 148) * 0.75,          # Waldhügel (nur Wald, kein Himmel)
    tex(97, 190, 80) * 0.75,                      # Dorfteich (ohne Schild)
    tex(106, 200, 300, 120, 130) * 0.75,          # Wüstensand
    tex(134, 120, 200) * 0.65,                    # Laborplatten
    tex(107, 120, 120) * 0.8,
]
cx2, cy2 = CX / 2, CY / 2
R0, BW = 30, 11                 # innerer Radius (2×-Raster), Bandbreite
bg = Canvas(125, 175)
for y in range(175):
    for x in range(125):
        d = math.hypot(x + .5 - cx2, y + .5 - cy2)
        if d < R0:
            # innere Trance-Ringe (Kartenpalette: grau/oliv mit gelblicher Linie)
            k = int(d) % 5
            bg.a[y, x] = [(22, 26, 20), (40, 46, 36), (70, 78, 58), (128, 136, 92), (40, 46, 36)][k]
            continue
        b = int((d - R0) // BW)
        r = (d - R0) - b * BW
        if r < 1.0:
            bg.a[y, x] = (10, 10, 12)                 # schwarze Trennlinie
        elif r < 2.0:
            bg.a[y, x] = (150, 160, 110)              # helle Kante (wie die Trance-Ringe der Karte)
        else:
            c = worlds[b % len(worlds)][y, x]
            # alle Welten in einen gemeinsamen, gedämpften Trance-Ton ziehen (ruhiger Hintergrund)
            lum = c.mean()
            tone = np.array([0.55, 0.62, 0.5]) * lum + np.array([6, 8, 10])
            c = c * 0.55 + tone * 0.45
            f = 1 - 0.09 * b
            bg.a[y, x] = (c * max(0.4, f)).clip(0, 255).astype(np.uint8)
cv = Canvas(W, H)
cv.a[:] = up(np.dstack([bg.a, np.full((175, 125), 255, np.uint8)]), 2)[:H, :W, :3]
vignette_grid(cv, 0.55, 0.55, g=2)

# ---------------------------------------------------------------- Kassaran (6×)
KS = up(kas, K)
kx, ky = CX - EYE[0] * K - K // 2, CY - EYE[1] * K - K // 2
cv.paste(silhouette(KS, (0, 0, 0)), kx + K, ky + K, alpha=0.5)
cv.paste(KS, kx, ky)
print(save(cv, '14_all_seeing.png'))
