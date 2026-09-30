# -*- coding: utf-8 -*-
"""20 Stormward Drift – Gegner „Gather That Storm!“ (sample-Structure Deck Gather That Storm),
Held/Hauptmotiv: Tarleinn the Traveler (Base-Karte).

Idee (Ruhemoment vor dem Sturm, asymmetrisch): Wir stehen mit Tarleinn auf seiner schwebenden Insel –
genau die Stelle seines Kartenbildes: Grasrand mit der schrägen Felskante, die Säule mit der Statue, seine
Herzen (Heilung) und Noten um ihn. Links fällt die Insel in die Tiefe; tief unten ziehen helle Wolken. Über
ihm aber ballt sich der Gathering Storm (Cover-Karte): schwere, dunkle Wolkenbänke drehen sich zusammen,
drei Blitze zucken hinab in die Tiefe (die Karte trifft 3 Ziele). Der Himmel kippt von Kartenblau oben ins
Gewittergrau.

Quellen (MotiveMoe.xcf):
  Tarleinn: Ebene 166 „Tarleinn“ (Figur + 4 Herzen + 3 Noten, alles Teil des Kartenbildes), geprüft gegen
            Kartenszene Ebene 155 „Sichtbar #103“ (Lage 143,111; 100 % deckungsgleich).
  Insel:    Kartenszene Ebene 155, Ausschnitt x 151–214, y 70–158, Maske = Ebene 478 „Relic-Insel“ ∪ 166
            (so sind Grasfläche, Felskante, Blumen, Säule mit Statue pixelgleich wie auf der Karte).
  Wolken:   Ebene 123 „Ebene #20“ (Wolke aus dem Kartenhintergrund) – für die Sturmwolken grau umgefärbt,
            gespiegelt, mehrfach gestaffelt; für die Wolken tief unten hell belassen.
Selbst gezeichnet: Himmelsverlauf (geordnetes Dithering), drei Blitze (1 px im 2×-Raster, heller Kern,
            1 px Schein), Aufhellung der Wolkenränder am Blitz.
Skalierung: Himmel, Sturm- und Tiefenwolken, Blitze – 2×-Raster (125×175);
            Insel-Vordergrund mit Tarleinn, Herzen, Noten, Säule – 4×-Raster (63×88).
"""
import math, random
from common import *  # noqa
from dkit19_24 import *  # noqa

B = 'MotiveMoe'
rnd = random.Random(20)

# ---------------------------------------------------------------- Vordergrund 4× (63×88)
FX, FY = 151, 70                    # Kopfmitte (x≈182) auf x = 375 von 750
FW, FH = grid(4)
fg = scene_masked(B, 155, [478, 166], box=(FX, FY, FX + FW, FY + FH))
tar_m = layer(B, 166)[FY:FY + FH, FX:FX + FW, 3] > 0
# Gewitterlicht: Boden leicht abgedunkelt/kühler, Tarleinn und seine Herzen/Noten unverändert
isl = (fg[..., 3] > 0) & ~tar_m
fg[isl, :3] = (fg[isl, :3].astype(float) * 0.82 + np.array([4, 8, 22]) * 0.18 * 2).clip(0, 255).astype(np.uint8)
Image.fromarray(fg).save(os.path.join(xcfkit.CACHE, 'o20_island_fg.png'))

# ---------------------------------------------------------------- Wolke aus dem Kartenhimmel
c123 = crop_alpha(layer(B, 123))
cm = c123[..., 0].astype(int) >= 30                       # Wolke (Himmel hat R < 15)
cloud = c123.copy(); cloud[..., 3] = np.where(cm, 255, 0)
cloud = crop_alpha(cloud)
Image.fromarray(cloud).save(os.path.join(xcfkit.CACHE, 'o20_cloud.png'))
lum = cloud[..., :3].astype(float).mean(-1)


def storm_cloud(dark):
    """Wolke nach Helligkeit auf eine Gewitterpalette abbilden (dark 0..1)."""
    pal = [np.array(c) for c in ((34, 38, 58), (58, 64, 88), (86, 94, 120), (122, 130, 156))]
    out = cloud.copy()
    t = ((lum - lum[cloud[..., 3] > 0].min()) / (lum.max() - lum[cloud[..., 3] > 0].min() + 1e-6)).clip(0, 1)
    idx = np.clip((t * 3.99 - dark * 1.6), 0, 3).astype(int)
    for i in range(4):
        out[idx == i, :3] = pal[i]
    return out


# ---------------------------------------------------------------- Himmel 2× (125×175)
GW, GH = grid(2)
sky = rgba(GW, GH)
TOP, MID, LOW = np.array([22, 24, 40]), np.array([44, 58, 104]), np.array([20, 92, 196])
for y in range(GH):
    for x in range(GW):
        t = y / (GH - 1)
        if t < 0.45:
            q = dith(t / 0.45, x, y, 6); col = TOP * (1 - q) + MID * q
        else:
            q = dith((t - 0.45) / 0.55, x, y, 6); col = MID * (1 - q) + LOW * q
        sky[y, x, :3] = col; sky[y, x, 3] = 255

# Blitze (vor den hinteren, hinter den vorderen Wolkenbänken)
def bolt(dst, x, y, length, rnd, fork=True):
    """Klassischer Zickzack-Blitz: diagonale Segmente (3–6 px) im Wechsel links/rechts, 1 px Kern
    (weiß), seitlich 1 px bläulicher Schein; optional ein kurzer Seitenast."""
    pts = [(x, y)]; d = rnd.choice((-1, 1)); yy = y; xx = x
    while yy < y + length:
        n = rnd.choice((2, 3, 5, 7, 9))                    # unregelmäßige Segmente
        steep = rnd.random() < 0.5                          # steil (x nur jede 2. Zeile) oder flach
        for i in range(n):
            yy += 1
            if not steep or i % 2 == 0:
                xx += d
            pts.append((xx, yy))
        d = -d if rnd.random() < 0.75 else d
    br = []
    if fork:
        k = len(pts) // 2; fx, fy = pts[k]; dd = rnd.choice((-1, 1))
        for i in range(8):
            fx += dd if i % 3 else 0; fy += 1; br.append((fx, fy))
    for (px, py) in pts + br:
        for ox in (-1, 1):
            if 0 <= px + ox < GW and 0 <= py < GH and (px + ox, py) not in pts:
                q = dst[py, px + ox, :3].astype(float)
                setp(dst, px + ox, py, (q * 0.45 + np.array([130, 150, 235]) * 0.55).astype(int))
    for (px, py) in br:
        setp(dst, px, py, (190, 200, 250))
    for (px, py) in pts:
        setp(dst, px, py, (245, 248, 255))


# hintere Wolkenbank (dunkel)
back = [(-30, 6, 1, 1.0), (40, 0, 0, 1.0), (78, 10, 1, 0.9)]
for (x, y, fl, d) in back:
    put(sky, flip(storm_cloud(d)) if fl else storm_cloud(d), x, y)

# drei Blitze nach links unten in die Tiefe (links neben der Insel, außerhalb der Rahmenzone)
bolt(sky, 20, 36, 70, random.Random(5))
bolt(sky, 44, 38, 46, random.Random(8), fork=False)
bolt(sky, 100, 36, 50, random.Random(2))

# vordere Wolkenbänke (heller, drehen sich zur Mitte)
front = [(-44, 22, 0, 0.3), (54, 20, 1, 0.35), (6, 30, 1, 0.1)]
for (x, y, fl, d) in front:
    put(sky, flip(storm_cloud(d)) if fl else storm_cloud(d), x, y)

# tief unten: helle Wolken unter der Insel
low = cloud.copy()
put(sky, low, -50, 128)
put(sky, flip(low), 10, 150)

cv = Canvas(W, H)
blit(cv, sky, 2)
blit(cv, fg, 4)
print(save(cv, '20_stormward_drift.png'))
