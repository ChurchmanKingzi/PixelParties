# -*- coding: utf-8 -*-
"""22 Vengeful Vigil – Gegner „Guardians of the Treasure Cave“ (sample-Structure Deck Guardians of the
Treasure Cave), Held/Hauptmotiv: Mao, the Vengeful Guardian (Base-Karte).

Idee (Nachtwache vor dem Schatztor, Spielansicht: Mauer frontal, Hof von schräg oben): Oben liegt in der
orangefarbenen Mauer des Wächterhofs das vergitterte Tor der Schatzhöhle; hinter den Gitterstäben glänzt
der Goldhaufen im Dunkeln. Links vor der Mauer steht Guardian Beast Zhu (Cover-Deck: der Schweine-Wächter)
mit ausgebreiteten Armen Wache. Vorn rechts sitzt Mao, die schwarze Katze mit dem roten, blutigen Tuch, und
blickt uns an – die rachsüchtige Wächterin lässt niemanden an den Schatz. Nacht: nur der Schatz und ein
warmer Schein vor dem Tor beleuchten Hof und Wächter.

Quellen:
  MotiveGuardianBeasts.xcf  Ebene 35 „Mao“ = Base-Karte (schwarze Katze; 100 % in Kartenszene Ebene 2
                            „Sichtbar #37“, Lage 114,115). NICHT Ebene 34 „Mao-Kopie“ (graue Variante).
                            Ebene 57 „Zhu“ (stehender Zhu, 100 % in Szene 55 „Sichtbar #12“).
                            Ebene 37 „Ebene #41“ (Wächterhof: Mauer mit Gittertor, Pflaster; Ausschnitt
                            x 121–184, y 3–91, ohne den „FPS“-Schriftzug).
  MotiveDeepsea.xcf         Ebene 196 „Deepsea Treasure“ (nur die Goldpixel, ohne Truhe) – hinter den Gitterstäben.
Selbst gezeichnet: Nachtabdunkelung mit warmem Torschein (geordnetes Dithering), Schatten der Figuren.
Skalierung: alles 4× (Raster 63×88) – Hof, Tor, Schatz, Zhu und Mao im selben Spielmaßstab.
"""
import math
from common import *  # noqa
from dkit19_24 import *  # noqa

BG, BD = 'MotiveGuardianBeasts', 'MotiveDeepsea'

mao = crop_alpha(layer(BG, 35))
mao = part_at(mao, mao.shape[1] // 2 + 3, mao.shape[0] // 2, dil=1)   # ohne den losen Blutstrich
zhu = crop_alpha(layer(BG, 57))
Image.fromarray(mao).save(os.path.join(xcfkit.CACHE, 'o22_mao.png'))
Image.fromarray(zhu).save(os.path.join(xcfkit.CACHE, 'o22_zhu.png'))

GW, GH = grid(4)            # 63×88
X0, Y0 = 121, 3
court = layer(BG, 37)[Y0:Y0 + GH, X0:X0 + GW].copy()
court[..., 3] = 255
GX0, GX1, GY0, GY1 = 144 - X0, 160 - X0, 15 - Y0, 48 - Y0      # Gittertor (Raster)
WALL_B = 47 - Y0                                                # Mauerfuß

# Schatz hinter dem Gitter: nur die schwarzen Innenflächen des Tores, unterer Teil
tre = crop_alpha(layer(BD, 196))
th, tw = tre.shape[:2]
tx = (GX0 + GX1) // 2 - tw // 2
ty = GY1 - th + 12                       # nur die Goldhaufen-Oberkante ragt ins Tor
inner = np.zeros((GH, GW), bool)
for y in range(GY0, GY1):
    for x in range(GX0, GX1):
        if court[y, x, :3].astype(int).max() < 40:
            inner[y, x] = True
for y in range(GH):
    for x in range(GW):
        if inner[y, x]:
            sy, sx = y - ty, x - tx
            c = tre[sy, sx] if (0 <= sy < th and 0 <= sx < tw) else None
            if c is not None and c[3] > 0 and int(c[0]) > 140 and int(c[2]) < 120:   # nur Gold, ohne Truhe
                court[y, x, :3] = c[:3]
            else:
                court[y, x, :3] = (4, 3, 8)

# Nacht: Hof abdunkeln; warmer Schein vor dem Tor
LX, LY = (GX0 + GX1) / 2, GY1 + 4
for y in range(GH):
    for x in range(GW):
        if inner[y, x]:
            continue
        d = math.hypot((x + .5 - LX) / 30, (y + .5 - LY) / 30)
        t = max(0.0, 1 - d)
        f = 0.2 + 0.55 * dith(t, x, y, 4)
        c = court[y, x, :3].astype(float)
        court[y, x, :3] = (c * f + np.array([16, 8, 30]) * (1 - f)).clip(0, 255).astype(np.uint8)


def shadow(dst, cx, cy, rx, ry):
    for y in range(GH):
        for x in range(GW):
            d = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2
            if d < 1 and bay(x, y) < 0.7:
                dst[y, x, :3] = (dst[y, x, :3] * 0.45).astype(np.uint8)


# Zhu links neben dem Tor, Füße am Mauerfuß
ZF = WALL_B + 14
zx, zy = 5, ZF - zhu.shape[0]
shadow(court, zx + zhu.shape[1] / 2, ZF - 0.5, 9, 1.6)
put(court, zhu, zx, zy)
# Mao vorn rechts der Mitte
mx, my = 29, 81 - mao.shape[0]
shadow(court, mx + mao.shape[1] / 2 + 1, 80.5, 11, 1.8)
put(court, mao, mx, my)

cv = Canvas(W, H)
blit(cv, court, 4)
print(save(cv, '22_vengeful_vigil.png'))
