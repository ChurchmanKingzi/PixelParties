# -*- coding: utf-8 -*-
"""Sleeve 07: Gigantisaurs-Comicseite (ohne Text) – vier Panels, alle Figuren aus xcf-Ebenen.

Quellen (MotiveGrailWar.xcf):
  - Spinor: Teil der Ebene „Dinos“ (#511, rechts; halbtransparenter Unterwasser-Teil bleibt als Wasser-Durchsicht)
  - Raptoren: Ebene „Raptoren“ (#505), beide Tiere
  - Triceras: Ebene „Tricera“ (#509)
  - King Trex: Ebenen „Trex“ (#513) + Krone „Ebene #335“ (#512)
  - Panel-Hintergründe: Inselkarte „Ebene #153“ (#515) – Wald, Lichtung, Fluss, Meer (wie in Szene #185 „Sichtbar #124“)
Pteranos gibt es nicht als Ebene (nur als Kartenbild) und entfällt deshalb; stattdessen ist der gekrönte
King Trex (Ebenen vorhanden) der Schlusspunkt der Seite.

Skalierung: alles 2× auf dem 250×350-Raster (Grundraster 125×175): Figuren, Kartenhintergründe, Panelrahmen
(1 px Tinte), Rinnsteine, Bodenschatten, Strahlenkranz. Leserichtung: Wasser (Spinor) → Land (Raptoren, Triceras)
→ Brüll-Panel (King Trex gespiegelt, Strahlenkranz)."""
import math
import numpy as np
from kit import *
import xcfkit as XK

E = 'MotiveGrailWar'
K = 2
NW, NH = W // K, H // K                         # 125 × 175
PAPER = (238, 230, 206)
INK = (22, 18, 14)

# --- Figuren ------------------------------------------------------------------------------------
if os.path.exists(os.path.join(XK.EXP, E, 'layers.json')):
    L = XK.layer(E, 511)[120:182, 418:505].copy()          # Spinor-Bereich der Ebene „Dinos“
    al = L[..., 3]
    L[al < 100] = 0                                        # weichen Krater-Schatten der Nachbarfigur entfernen
    L[(al >= 100) & (al < 250), 3] = 127                   # Unterwasser-Teil: 50 % Durchsicht
    L = trim(L)
    Image.fromarray(L).save(os.path.join(XK.CACHE, 'r2_07_spinor.png'))
spinor = np.array(Image.open(os.path.join(XK.CACHE, 'r2_07_spinor.png')).convert('RGBA'))
raptors = XK.sprite('r2_07_raptoren', E, [505])
tricera = XK.sprite('r2_07_tricera', E, [509])
trex = XK.sprite('r2_07_kingtrex', E, [512, 513])


def mapcrop(key, x0, y0, w, h):
    p = os.path.join(XK.CACHE, key + '.png')
    if os.path.exists(os.path.join(XK.EXP, E, 'layers.json')):
        a = XK.layer(E, 515)[y0:y0 + h, x0:x0 + w].copy()
        Image.fromarray(a).save(p)
    return np.array(Image.open(p).convert('RGBA'))[..., :3]


def ground_shadow(sub, cx, cy, rx, ry, f=0.62):
    """Harter, dunkler Bodenschatten (Ellipse) unter den Füßen."""
    for y in range(int(cy - ry), int(cy + ry) + 1):
        for x in range(int(cx - rx), int(cx + rx) + 1):
            if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1 and 0 <= x < sub.w and 0 <= y < sub.h:
                sub.a[y, x] = (sub.a[y, x] * f).astype(np.uint8)


cv = Canvas(NW, NH, PAPER)


def frame(x, y, w, h):
    """Tintenrahmen (1 px im 2×-Raster) um das Innere (x, y, w, h)."""
    cv.rect(x - 1, y - 1, x + w + 1, y + h + 1, INK)


# Layout (Innenmaße): Rand 3, Rinnstein 2, Rahmen 1
X0, XW = 4, 117
P1 = (X0, 4, XW, 33)
P2 = (X0, 4 + 33 + 1 + 2 + 1, 50, 58)
P3 = (X0 + 50 + 1 + 2 + 1, P2[1], XW - 50 - 4, 58)
P4 = (X0, P2[1] + 58 + 1 + 2 + 1, XW, 68)
assert P4[1] + P4[3] + 1 + 3 == NH, P4

# --- Panel 1: Spinor taucht aus dem Fluss auf (Wald am linken Ufer)
x, y, w, h = P1
sub = Canvas(w, h)
sub.a[:] = mapcrop('r2_07_bg_river', 372, 196, w, h)
sub.paste(spinor, 26, 2)
frame(x, y, w, h); cv.a[y:y + h, x:x + w] = sub.a

# --- Panel 2: Raptoren auf der Lichtung
x, y, w, h = P2
sub = Canvas(w, h)
sub.a[:] = mapcrop('r2_07_bg_clearing', 76, 312, w, h)
rh, rw = raptors.shape[:2]
rx, ry = (w - rw) // 2, h - rh - 1
ground_shadow(sub, rx + 11, ry + 55, 10, 2)
ground_shadow(sub, rx + 33, ry + 31, 9, 2)
sub.paste(raptors, rx, ry)
frame(x, y, w, h); cv.a[y:y + h, x:x + w] = sub.a

# --- Panel 3: Triceras am Flussufer
x, y, w, h = P3
sub = Canvas(w, h)
sub.a[:] = mapcrop('r2_07_bg_riverbank', 76, 146, w, h)
th, tw = tricera.shape[:2]
tx, ty = (w - tw) // 2, h - th - 3
ground_shadow(sub, tx + 30, ty + th - 1, 26, 3)
sub.paste(tricera, tx, ty)
frame(x, y, w, h); cv.a[y:y + h, x:x + w] = sub.a

# --- Panel 4: King Trex brüllt nach links – Comic-Strahlenkranz aus dem Maul (Zentrum vom Kopf verdeckt) (selbst gezeichnet, 2×)
x, y, w, h = P4
sub = Canvas(w, h)
T = flip(trex)
trh, trw = T.shape[:2]
ox, oy = w - trw - 3, h - trh
mx, my = ox + 8, oy + 36                                   # Maul (gespiegelt: links)
C2, C3 = (240, 176, 92), (226, 128, 60)
for yy in range(h):
    for xx in range(w):
        ang = math.degrees(math.atan2(yy + .5 - my, xx + .5 - mx))
        r = math.hypot(xx + .5 - mx, yy + .5 - my)
        band = int((ang + 3600) // 10) % 2
        sub.a[yy, xx] = C2 if band == 0 else C3
ground_shadow(sub, ox + trw - 30, h - 2, 22, 2, f=0.72)
sub.paste(T, ox, oy)
frame(x, y, w, h); cv.a[y:y + h, x:x + w] = sub.a

big = Canvas(W, H)
big.a[:] = up(np.dstack([cv.a, np.full(cv.a.shape[:2], 255, np.uint8)]), K)[..., :3][:H, :W]
print(save(big, '07_gigantisaur_comic.png'))
