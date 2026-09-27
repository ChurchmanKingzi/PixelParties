# -*- coding: utf-8 -*-
"""Sleeve 09 „Cycling Demons“: umgedrehtes Pentagramm auf Kopfsteinpflaster, an den fünf Spitzen stehen die
fünf Cycling Demons in ihrer Beschwörungsreihenfolge (im Uhrzeigersinn: Hydrogen → Herbithorn → Bouldor →
Infernous → Serpentous → Hydrogen). Zwischen den Dämonen stehen die fünf Kerzen auf dem Ring.

Alles auf EINEM Raster 125×175 gebaut und am Ende 2× auf 250×350 skaliert (Ausgabe 6 px je Grafikpixel):
Figuren, Kerzen, Pentagramm-Linien, Leuchten und Pflaster haben dieselbe Pixelgröße. Kein Rahmen.

Quellen:
  Bouldor    = MotiveDeri.xcf Ebene 151 „Bouldor Demon“ (ohne die schwarzen Mauerrisse links derselben Ebene)
  Herbithorn = MotiveGrailWar.xcf Ebene 550 „Herbithorne“ (Körper ohne die Dornenranke, die durch die Hände läuft)
  Infernous  = Motive.xcf Ebene 816 „Infernal Demon“
  Hydrogen, Serpentous: als Ebene nicht vorhanden → aus den Kartenbildern („Hydrogen Demon“, „Serpentous Demon“,
    natives Raster). Die Karten tragen einen türkisen Schleier (Karte = 0,71·Sprite + (25,64,67), aus Bouldor und
    Herbithorn gegen ihre xcf-Ebenen bestimmt); er wird herausgerechnet, die Figur per Farbregel freigestellt und
    auf eine kleine Palette (k-Means) gebracht, damit die Kanten sauber und die Farben so kräftig wie bei den
    xcf-Sprites sind.
  Kerze      = Motive.xcf Ebene 913 „Summoning Circle“ (eine der fünf Kerzen)
  Pflaster   = 16×16-Kachel aus Motive.xcf Ebene 511 „Sichtbar #115“ (Boden um den Beschwörungskreis)
  Pentagramm, Ringe, Leuchten: nach „Summoning Circle“ selbst gezeichnet (1 Rasterpixel breite Linien).
"""
import math, numpy as np
from kit import *
from xcfkit import sprite

w, h = 125, 175                                   # Arbeitsraster (Endskalierung 2×)
cv = Canvas(w, h)
yy, xx = np.mgrid[0:h, 0:w] + 0.5

# --- Boden -------------------------------------------------------------------------------------------------
cob = sprite('r2_09_cobble', 'Motive', [511], box=(200, 195, 216, 211))
fill_tiles(cv, darken(cob, 0.55))

CX, CY, R = 62, 99, 44                            # Mittelpunkt, Radius der Sternspitzen
rr = np.hypot(xx - CX, yy - CY)
# rötlicher Schein im Kreis (geordnet gedithert, ganze Rasterpixel)
glow_t = np.clip(1.15 - rr / (R + 12), 0, 1) * 0.55
q = glow_t > BAYER4[(yy - .5).astype(int) % 4, (xx - .5).astype(int) % 4]
red = cv.a.astype(float)
red[..., 0] = red[..., 0] * 1.25 + 28; red[..., 1] *= 0.7; red[..., 2] *= 0.7
cv.a[q] = red.clip(0, 255).astype(np.uint8)[q]
vignette(cv, 0.9, 0.05)

# --- Pentagramm und Ringe ------------------------------------------------------------------------------------
CORE, HALO = (232, 44, 26), (110, 10, 10)
line = np.zeros((h, w), bool)


def seg(x0, y0, x1, y1):
    n = int(max(abs(x1 - x0), abs(y1 - y0)) * 3) + 1
    for t in np.linspace(0, 1, n):
        x, y = int(x0 + (x1 - x0) * t), int(y0 + (y1 - y0) * t)
        if 0 <= x < w and 0 <= y < h: line[y, x] = True


ANG = [36, 108, 180, 252, 324]                    # umgedrehter Stern: Spitze nach unten
P = [(CX + R * math.sin(math.radians(a)), CY - R * math.cos(math.radians(a))) for a in ANG]
for i in range(5):
    (x0, y0), (x1, y1) = P[i], P[(i + 2) % 5]
    seg(x0, y0, x1, y1)
for rad in (R + 1, R + 6):                        # doppelter Ring
    line |= (rr >= rad - 0.5) & (rr < rad + 0.5)
# Runen-Striche zwischen den Ringen (kurze radiale Kerben)
ang = np.degrees(np.arctan2(xx - CX, -(yy - CY))) % 360
dots = (np.abs(rr - (R + 3.5)) < 0.8) & ((ang % 15) < 2.2)          # Punkte zwischen den Ringen
line |= dots
# Glühen: 1 Pixel dunkelroter Saum, im Schachbrett gedithert (wirkt weicher als ein voller Rand)
halo = cv2.dilate(line.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool) & ~line
chk = ((yy - .5).astype(int) + (xx - .5).astype(int)) % 2 == 0
cv.a[halo & chk] = HALO
cv.a[halo & ~chk] = (cv.a[halo & ~chk] * 0.6 + np.array(HALO) * 0.4).astype(np.uint8)
cv.a[line] = CORE

# --- Dämonen ---------------------------------------------------------------------------------------------------
def clean_card(name, box, k=6):
    """Figur aus dem Kartenbild: Schleier herausrechnen, freistellen, Palette reduzieren."""
    a = nat(name).astype(float)
    r = np.clip((a - np.array([24.8, 64.0, 67.0])) / 0.71, 0, 255)
    x0, y0, x1, y1 = box
    sub = r[y0:y1, x0:x1]
    Rr, G, B = sub[..., 0], sub[..., 1], sub[..., 2]
    m = ((Rr < 0x20) & (G >= Rr)) | ((B > Rr + 25) & (G > Rr))   # dunkle Petrol-Kontur oder Blau/Türkis
    num, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), connectivity=8)
    m = lab == 1 + np.argmax(st[1:, 4])
    px = sub[m].astype(np.float32)
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 50, 0.5)
    cv2.setRNGSeed(7)
    _, lbl, cen = cv2.kmeans(px, k, None, crit, 8, cv2.KMEANS_PP_CENTERS)
    out = np.zeros(sub.shape[:2] + (4,), np.uint8)
    out[m, :3] = cen[lbl.ravel()].clip(0, 255).astype(np.uint8)
    out[m, 3] = 255
    return trim(out)


infern = sprite('r2_09_infernous', 'Motive', [816])
bould = sprite('r2_09_bouldor', 'MotiveDeri', [151])
bould = bould.copy()
blk = (bould[..., :3].max(-1) < 30) & (np.arange(bould.shape[1])[None, :] < 10)   # Mauerrisse links
bould[blk] = 0
bould = trim(bould)
herb = sprite('r2_09_herbithorn', 'MotiveGrailWar', [550])[:, 30:51].copy()
num, lab, st, _ = cv2.connectedComponentsWithStats((herb[..., 3] > 0).astype(np.uint8), connectivity=8)
herb[lab != 1 + np.argmax(st[1:, 4])] = 0
herb = trim(herb)
hydro = clean_card('Hydrogen Demon', (28, 8, 50, 43))
serp = clean_card('Serpentous Demon', (28, 7, 50, 42))

# (Sprite, Elementfarbe des Beschwörungslichts) im Uhrzeigersinn ab der rechten oberen Spitze
DEM = [(hydro, (60, 190, 235)), (herb, (120, 210, 70)), (bould, (205, 130, 70)),
       (infern, (255, 140, 30)), (serp, (150, 95, 225))]

# Kerzen auf dem Ring zwischen den Dämonen (0°, 72°, 144°, 216°, 288°)
circ = sprite('r2_09_candle', 'Motive', [913], box=(247, 211, 249, 219))
cand = circ.copy()
cand[cand[..., :3].max(-1) < 120] = 0                             # rote Kreisfüllung derselben Ebene weg
cand[0, 1] = cand[1, 1]                                          # Flammenspitze: fehlendes Pixel ergänzen
cand = trim(cand)
FL = (255, 200, 60)
for a in (0, 72, 144, 216, 288):
    x = CX + (R + 3.5) * math.sin(math.radians(a)); y = CY - (R + 3.5) * math.cos(math.radians(a))
    fx, fy = int(round(x - cand.shape[1] / 2)), int(round(y - cand.shape[0] + 2))
    # kleiner Lichthof der Flamme (gedithert)
    d = np.hypot(xx - (fx + 1), yy - (fy + 1))
    lt = np.clip(1 - d / 4.5, 0, 1) * 0.6
    qq = (lt > BAYER4[(yy - .5).astype(int) % 4, (xx - .5).astype(int) % 4]) & ~line
    cv.a[qq] = (cv.a[qq] * 0.65 + np.array(FL) * 0.35).astype(np.uint8)
    cv.paste(cand, fx, fy)

order = sorted(range(5), key=lambda i: P[i][1])                   # von hinten nach vorn
for i in order:
    s, col = DEM[i]
    px_, py_ = P[i]
    # Beschwörungslicht: flache Ellipse in Elementfarbe unter den Füßen (Rand hell, innen gedithert)
    e = ((xx - px_) / (s.shape[1] / 2 + 3)) ** 2 + ((yy - py_) / 4.2) ** 2
    ring_ = (e < 1) & (e >= 0.62)
    inner = (e < 0.62) & (BAYER4[(yy - .5).astype(int) % 4, (xx - .5).astype(int) % 4] < 0.5)
    cv.a[inner] = (cv.a[inner] * 0.45 + np.array(col) * 0.55).astype(np.uint8)
    cv.a[ring_] = col
    cv.paste(s, int(round(px_ - s.shape[1] / 2)), int(round(py_ + 1 - s.shape[0])))

big = Canvas(W, H)
big.a[:] = up(np.dstack([cv.a, np.full((h, w), 255, np.uint8)]), 2)[..., :3]
print(save(big, '09_cycling_demons.png'))
