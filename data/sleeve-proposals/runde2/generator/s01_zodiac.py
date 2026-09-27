# -*- coding: utf-8 -*-
"""Sleeve 01 „Guardian Zodiac“: die zwölf Guardian Beasts stehen im Tierkreis (Shu oben, im Uhrzeigersinn)
auf kleinen Graskuppen im Oval um eine Tierkreis-Scheibe (Ziegelring mit zwölf Feldern) mit Yin-Yang.

Alles auf EINEM Raster 125×175 gebaut und am Ende 2× auf 250×350 skaliert (Ausgabe 6 px je Grafikpixel):
Figuren, Ring-/Kantenlinien, Yin-Yang und Texturen haben dieselbe Pixelgröße. Kein Rahmen.

Quellen (MotiveGuardianBeasts.xcf, jeweils gegen die „Sichtbar“-Szene der Karte geprüft):
  Shu = Ebene 71 „Shu“ · Niu = 82 „Niu #1“ (mit Klingen; „Niu #3“ ist eine größer
  gezeichnete Fassung) · Hu = 75 „Hu“ · Tu = 109 „Tu-Kopie“ ·
  Long = 105 „Long-Kopie“ · She = 95 „She #1“ + 92 „She #5“ + 96 „She #4“ + 94 „She #3“ (Kobra + Dreizack) ·
  Ma = 66 „Ma #3“ · Yang = 62 „Yang #1“ · Hou = 124 „Hou“ + 122 „Hou #2“ + roter Stab aus 123 „Hou #1“ ·
  Ji = 88 „Ji #1“ · Gou = 118 „Gou #1“ · Zhu = 56 „Zhu #1“.
  Texturen: dunkler Fels, Ziegel und Gras (je 8×8) aus der Labyrinth-Ebene 64 „Ebene #28“.
  Yin-Yang: nach „Charm of Balance“ (Motive.xcf, Ebene 698) in dessen Graustufen-Palette sauber nachgezeichnet.
"""
import math, numpy as np
from kit import *
from xcfkit import sprite, layer

B = 'MotiveGuardianBeasts'
w, h = 125, 175                                   # Arbeitsraster (Endskalierung 2×)
cv = Canvas(w, h)


def tex(key, x, y):
    """8×8-Kachel aus der Labyrinth-Ebene (Cache über sprite-Mechanismus)."""
    return sprite(key, B, [64], box=(x, y, x + 8, y + 8))


rock = tex('r2_01_rock', 113, 137)
brick = tex('r2_01_brick', 203, 175)
grass = tex('r2_01_grass', 137, 136)

# Hintergrund: dunkler Fels, zusätzlich abgedunkelt + Vignette
fill_tiles(cv, darken(rock, 0.75))
vignette(cv, 0.8, 0.12)

EDGE_D, EDGE_L = (48, 20, 6), (214, 104, 40)       # Kantenfarben (Ziegel-Palette)
yy, xx = np.mgrid[0:h, 0:w] + 0.5
bt = np.tile(brick[..., :3], (h // 8 + 1, w // 8 + 1, 1))[:h, :w]
gt = np.tile(grass[..., :3], (h // 8 + 1, w // 8 + 1, 1))[:h, :w]
GRASS_L = (66, 134, 0)

# Mitte: Tierkreis-Scheibe – Ziegelring mit zwölf Feldern um das Yin-Yang
R = 19
YX, YY = 62, 82
rr = np.hypot(xx - YX, yy - YY)
ang = (np.degrees(np.arctan2(xx - YX, -(yy - YY))) + 360 + 15) % 360
disc_m = rr < R + 11
cv.a[disc_m] = bt[disc_m]
alt = disc_m & (rr >= R + 2) & ((ang // 30) % 2 == 1)          # jedes zweite Feld dunkler
cv.a[alt] = (bt[alt] * 0.72).astype(np.uint8)
cv.a[disc_m & (rr >= R + 2) & ((ang % 30) < 360 / (2 * math.pi * rr + 1e-6) * 1.0)] = EDGE_D   # Feldgrenzen
cv.a[(rr >= R + 1) & (rr < R + 2)] = EDGE_D
cv.a[(rr >= R + 10) & (rr < R + 11)] = EDGE_L
cv.a[(rr >= R + 11) & (rr < R + 12)] = EDGE_D
BLK, D1, D2, D3, WHT = (0, 0, 0), (38, 38, 38), (77, 77, 77), (116, 116, 116), (255, 255, 255)
dx, dy = xx - YX, yy - YY
dark = dx > 0
top = np.hypot(dx, dy + R / 2) < R / 2
bot = np.hypot(dx, dy - R / 2) < R / 2
dark = np.where(top, True, np.where(bot, False, dark))
dark = np.where(np.hypot(dx, dy + R / 2) < R / 6, False, dark)
dark = np.where(np.hypot(dx, dy - R / 2) < R / 6, True, dark)
inside = rr < R
col = np.where(dark[..., None], np.array(BLK), np.array(WHT))
# leichte Schattierung wie beim Anhänger: helle Hälfte unten rechts grau, dunkle oben links angehellt
shade_w = (~dark) & inside & (dx + dy > R * 0.55) & (rr > R - 4)
shade_b = dark & inside & (dx + dy < -R * 0.55) & (rr > R - 4)
cv.a[inside] = col[inside]
cv.a[shade_w] = D3
cv.a[shade_b] = D1
cv.a[(rr >= R) & (rr < R + 1)] = D2

# Figuren
S = {
    'Shu': sprite('r2_01_shu', B, [71]),
    'Niu': sprite('r2_01_niu', B, [82]),
    'Hu': sprite('r2_01_hu', B, [75]),
    'Tu': sprite('r2_01_tu', B, [109]),
    'Long': sprite('r2_01_long', B, [105]),
    'She': sprite('r2_01_she', B, [95, 92, 96, 94]),
    'Ma': sprite('r2_01_ma', B, [66]),
    'Yang': sprite('r2_01_yang', B, [62]),
    'Ji': sprite('r2_01_ji', B, [88]),
    'Gou': sprite('r2_01_gou', B, [118]),
    'Zhu': sprite('r2_01_zhu', B, [56]),
}


def hou_sprite():
    """Hou (124) + Hand (122) + nur der rote Stab aus „Hou #1“ (123, Komponente x 161–164, y 122–154);
    die Bomben derselben Ebene bleiben weg. Stapelreihenfolge wie in der Szene: 122 über 123 über 124."""
    import os
    from PIL import Image
    from xcfkit import over, bbox, CACHE, EXP
    p = os.path.join(CACHE, 'r2_01_hou.png')
    if not os.path.exists(os.path.join(EXP, B, 'layers.json')):
        return np.array(Image.open(p).convert('RGBA'))
    st = layer(B, 123).copy()
    keep = np.zeros(st.shape[:2], bool); keep[122:155, 161:165] = True
    st[~keep] = 0
    acc = over(over(layer(B, 124), st), layer(B, 122))
    acc[..., 3] = np.where(acc[..., 3] >= 128, 255, 0)
    x0, y0, x1, y1 = bbox(acc)
    acc = acc[y0:y1, x0:x1]
    Image.fromarray(acc).save(p)
    return acc


S['Hou'] = hou_sprite()

# Zwölf gleich große Graskuppen symmetrisch im Oval um die Scheibe, im Uhrzeigersinn ab Shu (oben mittig) bis
# Zhu; Ma unten mittig. Die Kuppen liegen auf einer abgerundet-eckigen Ellipse (Superellipse EX, EY, ERX, ERY, EP)
# und sind an der Senkrechten gespiegelt (Niu ↔ Zhu, Hu ↔ Gou, Tu ↔ Ji, Long ↔ Hou, She ↔ Yang). Die Bogenabstände
# sind gleich (je 1/12 des Umfangs); nur die beiden großen unteren Paare (Long/Hou, She/Yang) rücken ein wenig
# nach unten, damit sich keine Figuren verdecken. Die Ellipse sitzt tiefer als die Scheibe, weil die Figuren von
# ihren Kuppen aus nach oben stehen. (Name, Fußmitte x, Fußlinie y)
FOOT = 2
ORDER = ['Shu', 'Niu', 'Hu', 'Tu', 'Long', 'She', 'Ma', 'Yang', 'Hou', 'Ji', 'Gou', 'Zhu']
EX, EY, ERX, ERY, EP = 62.5, 95, 42, 64, 3.5
HALF = [0, 0.081, 0.164, 0.248, 0.350, 0.430, 0.5]      # Anteile am Umfang: Shu … Ma (rechte Hälfte)
FRAC = HALF + [1 - f for f in HALF[5:0:-1]]              # linke Hälfte gespiegelt: Yang … Zhu


def ellipse_spots(fracs):
    """Punkte an den Umfangsanteilen fracs auf |x/ERX|^EP + |y/ERY|^EP = 1, ab oben im Uhrzeigersinn."""
    ts = np.linspace(0, 2 * math.pi, 3601)
    sx, cy_ = np.sin(ts), np.cos(ts)
    pts = np.stack([EX + ERX * np.sign(sx) * abs(sx) ** (2 / EP), EY - ERY * np.sign(cy_) * abs(cy_) ** (2 / EP)], 1)
    arc = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(pts, axis=0).T))])
    return [pts[np.argmin(abs(arc - arc[-1] * f))] for f in fracs]


SPOTS = [(n, c[0], int(round(c[1]))) for n, c in zip(ORDER, ellipse_spots(FRAC))]
PAD_RX = 12                                       # alle Kuppen gleich groß

# von hinten (oben) nach vorn: je Figur erst ihre flache Graskuppe (Aufsicht), dann die Figur
for n, px, py in sorted(SPOTS, key=lambda t: t[2]):
    sp = S[n]
    rx_, ry_ = PAD_RX, 3.3
    e = ((xx - px) / rx_) ** 2 + ((yy - (py + FOOT - 0.5)) / ry_) ** 2
    rim = ((xx - px) / (rx_ + 1)) ** 2 + ((yy - (py + FOOT + 0.5)) / (ry_ + 1)) ** 2
    cv.a[rim < 1] = EDGE_D
    cv.a[e < 1] = gt[e < 1]
    cv.a[(e < 1) & (e >= 0.72) & (yy > py + FOOT)] = GRASS_L
    cv.paste(sp, int(round(px - sp.shape[1] / 2)), py + FOOT - sp.shape[0])

big = Canvas(W, H)
big.a[:] = up(np.dstack([cv.a, np.full((h, w), 255, np.uint8)]), 2)[..., :3]
print(save(big, '01_guardian_zodiac.png'))
