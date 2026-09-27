# -*- coding: utf-8 -*-
"""49 Curtain Call – Gruppenbild der Katzen-Helden beim Schlussapplaus auf der Bühne: hinten auf dem Podest
Moriarty, Son Wukong und Achilles, vorne im Spotlicht Ashoka und Archimaudes, dahinter der rote Vorhang.

Quellen (MotiveIndia.xcf):
  Bühne/Vorhang: Ebene #88 (i215, roter Vorhang + Bretterboden), Spot-Ellipse Ebene #81 (i210, nur Lichtfarbe).
  Katzen (je ALLE Teil-Ebenen, pixelweise gegen die „Sichtbar“-Bühnenszenen geprüft):
    ASHOKA i56–59 (Sichtbar #62), ARCHIMAUDES i60–63 (Sichtbar #86),
    MORIARTY i189 + Körper Ebene #82 (i190) + Schwanz Ebene #83 (i191) (Sichtbar #81 – vorher fehlte der Körper!),
    ACHILLES i121–122 (Sichtbar #75), SON WUKONG i181–185 (Sichtbar #72).

Skalierung: ALLES 2× – Vorhang, Bretterboden, Podest und alle fünf Katzen (zwei Reihen wie beim Klassenfoto,
hintere Reihe auf dem Podest erhöht). Stäbe/Stock/Speer liegen vollständig im Bild.
"""
from common import *
import numpy as np

B = 'MotiveIndia'
BOX = (350, 45, 470, 190)          # Bühnenausschnitt der Katzen-Szenen
cat = lambda k, ids: sprite('h49_' + k, B, ids, box=BOX)

cv = Canvas(250, 350)

# --- Vorhang: eine Faltenperiode einfügen (125 breit), untere Bahn wiederholen, 2× ------------------------
st = compose(B, [215])[..., :3]                     # 126×118: Vorhang 0..87, Boden 88..
cur = st[:88]
cur = np.concatenate([cur[:, :59], cur[:, 42:]], 1)[:, 5:130]
cur = np.concatenate([cur[:44], cur[44:84], cur[44:84], cur[84:]], 0)
cur2 = up(cur, 2)
FY = 190                                              # Vorhangunterkante = Bühnenhinterkante
cv.a[:FY] = cur2[cur2.shape[0] - FY:, :250]          # untere Vorhangpartie mit Goldsaum
# Bühnenboden (Bretter), 2×, gekachelt, nach hinten dunkler
floor = st[88:122]
floor = np.concatenate([floor[:, :59], floor[:, 42:]], 1)[:, 5:130]
f2 = up(floor, 2)
for y in range(FY, 350):
    t = (y - FY) / (350 - FY)
    cv.a[y] = (f2[(y - FY) % f2.shape[0]][:250] * (0.55 + 0.4 * t)).astype(np.uint8)
cv.a[FY:FY + 2] = (40, 24, 16)

# --- Podest für die hintere Reihe (Bretter 2×, Oberseite + dunkle Stirnseite) -------------------------------
PT, PF, PB = 204, 216, 240                           # Oberkante / Stirnkante / Unterkante
for y in range(PT, PB):
    row = f2[(y - PT + 4) % f2.shape[0]][:250].astype(float)
    cv.a[y] = (row * (0.85 if y < PF else 0.42)).astype(np.uint8)
cv.a[PT:PT + 2] = (150, 110, 70)
cv.a[PF:PF + 2] = (40, 26, 18)
cv.a[PB:PB + 2] = (24, 16, 10)

# --- Spot-Ellipsen (nur Lichtfarbe der Ebene #81), 2× ---------------------------------------------------------
spot = compose(B, [210])
light = spot.copy(); light[..., 3] = np.where((spot[..., 0] > 200), 255, 0)
light = trim(light)
L2 = up(light, 2)

def place(s, cx, feet, dim=1.0, fl=False):
    s = flip(s) if fl else s
    if dim != 1.0: s = darken(s, dim)
    s = up(s, 2)
    h, w = s.shape[:2]
    x = int(cx - w // 2)
    assert 0 <= x and x + w <= 250 and feet - h >= 0, ('angeschnitten', cx, w)
    cv.paste(s, x, int(feet - h))

# --- hintere Reihe auf dem Podest (2×) -------------------------------------------------------------------------
place(cat('moriarty', [189, 190, 191]), 58, PF - 2, 0.9)
place(cat('achilles', [121, 122]), 212, PF - 2, 0.9)
place(cat('wukong', [181, 182, 183, 184, 185]), 138, PF, 0.9)

# --- vordere Reihe (2×) im Spotlicht -------------------------------------------------------------------------
for cx in (68, 180):
    cv.paste(L2, cx - L2.shape[1] // 2, 346 - L2.shape[0] // 2 - 8, alpha=1.0)
place(cat('ashoka', [56, 57, 58, 59]), 68, 344)
place(cat('archi', [60, 61, 62, 63]), 180, 344)

vignette(cv, 0.4, 0.7)
save(cv, '49_curtain_call.png')
