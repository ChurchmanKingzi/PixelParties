# -*- coding: utf-8 -*-
"""49 Curtain Call – die Katzen-Helden aus MotiveIndia verbeugen sich gemeinsam auf der Bühne.

Quellen (MotiveIndia.xcf):
  Bühne/Vorhang: Ebene #88 (i215, roter Vorhang + Bretterboden), Spot-Ellipse Ebene #81 (i210, nur Lichtfarbe).
  Katzen (je alle Teil-Ebenen, geprüft gegen die „Sichtbar“-Bühnenszenen):
    ASHOKA i56–59 (Sichtbar #62), ARCHIMAUDES i60–63 (Sichtbar #86), MORIARTY i189 (Sichtbar #81),
    ACHILLES i121–122 (Sichtbar #75), SON WUKONG i181–185 (Sichtbar #72),
    HERAKLES i138–140 (Sichtbar #85).
Aufbau: hintere Reihe 2× auf einem Podest, vordere Reihe 3× im Spotlicht → Tiefe wie ein Gruppenfoto.
"""
from common import *
import numpy as np

B = 'MotiveIndia'
BOX = (350, 45, 470, 190)          # Bühnenausschnitt der Katzen-Szenen
cat = lambda k, ids: sprite('h49_' + k, B, ids, box=BOX)

cv = Canvas(250, 350)

# --- Vorhang: eine Faltenperiode (17 px) einfügen, damit er 125 px breit wird, dann 2× ------------
st = compose(B, [215])[..., :3]                     # 126×118: Vorhang 0..87, Boden 88..
cur = st[:88]
cur = np.concatenate([cur[:, :59], cur[:, 42:]], 1)  # 135 breit
cur = cur[:, 5:130]                                  # 125
# Vorhang höher machen: untere Faltenbahn (Zeile 44..84) wiederholen
cur = np.concatenate([cur[:44], cur[44:84], cur[44:84], cur[84:]], 0)
cur2 = up(cur, 2)
H0 = min(cur2.shape[0], 350)
cv.a[:H0] = cur2[:H0]
# Bühnenboden (Bretter) ab Vorhangkante, 2×, nach unten gekachelt
floor = st[88:122]
floor = np.concatenate([floor[:, :59], floor[:, 42:]], 1)[:, 5:130]
f2 = up(floor, 2)
FY = 214                                              # Oberkante des Bodens
for y in range(FY, 350):
    cv.a[y] = f2[(y - FY) % f2.shape[0]][:250]
# Vorhang über dem Boden enden lassen
cv.a[FY - 2:FY] = f2[-4:-2][:, :250] * 0 + np.array([51, 39, 27])

# Boden nach vorne leicht aufhellen/abdunkeln (Tiefe): hinten dunkler
for y in range(FY, 350):
    t = (y - FY) / (350 - FY)
    f = 0.62 + 0.38 * t
    cv.a[y] = (cv.a[y] * f).astype(np.uint8)

# --- Spot-Ellipsen (nur Lichtfarbe der Ebene #81) ---------------------------------------------------
spot = compose(B, [210])
light = spot.copy(); light[..., 3] = np.where((spot[..., 0] > 200), 255, 0)
from xcfkit import bbox as _bb
b = _bb(light); light = light[b[1]:b[3], b[0]:b[2]]

def place(s, cx, feet, k, dim=1.0, fl=False):
    s = flip(s) if fl else s
    s = up(s, k)
    if dim != 1.0: s = darken(s, dim)
    h, w = s.shape[:2]
    cv.paste(s, int(cx - w // 2), int(feet - h))

# Podest für die hintere Reihe: dunkler Bretterstreifen
PY = 204
for y in range(PY - 8, PY + 12):
    cv.a[y] = (f2[(y + 5) % f2.shape[0]][:250] * (0.5 if y >= PY else 0.85)).astype(np.uint8)
cv.a[PY - 9] = (51, 39, 27); cv.a[PY] = (51, 39, 27); cv.a[PY + 12] = (40, 30, 20)

# --- hintere Reihe (2×) ------------------------------------------------------------------------------
place(cat('moriarty', [189]), 48, PY - 2, 2, 0.9)
place(cat('achilles', [121, 122]), 206, PY - 2, 2, 0.9)
place(cat('wukong', [181, 182, 183, 184, 185]), 128, PY - 4, 2, 0.9)

# --- vordere Reihe (3×) im Spotlicht --------------------------------------------------------------------
L2 = up(light, 2)
cv.paste(L2, 70 - L2.shape[1] // 2 + 0, 318)
cv.paste(L2, 184 - L2.shape[1] // 2, 318)
place(cat('ashoka', [56, 57, 58, 59]), 70, 346, 3)
place(cat('archi', [60, 61, 62, 63]), 184, 346, 3)

vignette(cv, 0.4, 0.7)
save(cv, '49_curtain_call.png')
