# -*- coding: utf-8 -*-
"""Sleeve: Puppentheater – Tri Ad (links) und Tri Fecta (rechts) führen von ihren Tribünen aus sechs
Marionetten vor Bühne und Vorhang. Alles aus MotiveIndia.xcf (Repo PixelPartiesSprites):
  Bühne/Vorhang  „Ebene #100“ (212), auf 125 px gespiegelt verbreitert, Vorhang verlängert
  Tri Ad         „Triad“ (345) + „Tribüne“ (346)     – Kontrollkreuze (rosa) an den Händen
  Tri Fecta      „TriFecta“ (344) + „Tribüne“ (346)  – Funken an den Händen
  Saras (330), Laki (331), Pavi (332 + Hammerkopf aus „Ebene #50“ 324), Brammi (334),
  Shishi (336), Vinny (Teilfigur aus „Vinny“ 326), Regenbogen „Ebene #61“ (327).
Alles liegt auf EINEM 125×175-Raster (Kartenpixel 1:1) und wird am Ende 2× auf 250×350 skaliert:
Figuren, Bühne und Fäden haben dieselbe Pixelgröße (Fäden = 1 Kartenpixel, zweifarbig wie auf den
Karten). Jeder Faden beginnt an einer Hand (Kontrollkreuz/Funke) von Tri Ad bzw. Tri Fecta, läuft
sichtbar über die Tribünenbrüstung und endet am oberen Rand einer Puppe (Kopf, Hände, Hammer).
Die Fäden sind halbtransparent (55 % Deckkraft, pro ganzem Pixel gemischt)."""
import numpy as np
from kit import Canvas, up, flip, silhouette, save, widen
from xcfkit import sprite, parts, part_at, compose

B = 'MotiveIndia'
NW, NH = 125, 175
cv = Canvas(NW, NH)

# --- Bühne (Ebene „Ebene #100“, 118×126): auf 125 Breite gespiegelt ergänzt, Vorhang in der Höhe verlängert
st = sprite('r2_03_stage', B, [212])[..., :3]
st = widen(st[:, 3:113], NW)
top, body, fringe, floor = st[0:14], st[14:40], st[76:88], np.concatenate([st[88:104], st[118:126]], 0)
n_body = NH - len(top) - len(fringe) - len(floor)
body_col = np.concatenate([body, body[::-1]] * 5, 0)[:n_body]
cv.a[:] = np.concatenate([top, body_col, fringe, floor], 0)[:NH]
FLOOR = NH - len(floor) - 4

# --- Figuren (Ebenen)
saras = parts(sprite('r2_03_saras', B, [330]))[0]
laki = parts(sprite('r2_03_laki', B, [331]))[0]
try:   # Pavi mit ihrem Hammer (Stiel in „Pavi“, Kopf in „Ebene #50“)
    pavi = part_at(compose(B, [324, 332], crop=False)[88:145, 378:440], 30, 35)
    from PIL import Image; import os
    from xcfkit import CACHE
    Image.fromarray(pavi).save(os.path.join(CACHE, 'r2_03_pavi_hammer.png'))
except Exception:
    pavi = sprite('r2_03_pavi_hammer')
vinny = part_at(sprite('r2_03_vinny_scene', B, [326]), 85, 57)
brammi = sprite('r2_03_brammi', B, [334])
shishi = sprite('r2_03_shishi', B, [336])
fecta = sprite('r2_03_trifecta', B, [344, 346])
ad = sprite('r2_03_triad', B, [345, 346])
rain = sprite('r2_03_rainbow', B, [327])

STR = [(176, 176, 176), (227, 227, 227)]            # Fadenpixel der Kartenebenen
AX, FX, TY = 2, NW - fecta.shape[1] - 2, 12         # Lage der Tribünen
# Hände: äußere Kontrollkreuze/Funken und innere Hände (Sprite-Koordinaten → Leinwand)
# Hände (Leinwandkoordinaten): äußere Kontrollkreuze (Tri Ad rosa, Tri Fecta Funken) und innere Hände.
# Alle Fäden einer Puppe laufen (wie bei einem Spielkreuz) von einem Handpunkt aus auseinander.
HA = {'L': (AX + 12, TY + 18), 'l': (AX + 19, TY + 21), 'r': (AX + 31, TY + 21), 'R': (AX + 37, TY + 18)}
HF = {'L': (FX + 14, TY + 17), 'l': (FX + 19, TY + 21), 'r': (FX + 31, TY + 21), 'R': (FX + 36, TY + 17)}
TRIB_BOTTOM = TY + ad.shape[0]

def top_of(s, cx):
    return int(np.argmax(s[:, cx, 3] > 0))

# Puppe: (Sprite, x, y, [(Ansatzspalte, Hand), ...])  – Ansatz an Kopf, Händen bzw. Hammer
pup = {
    'saras': (saras, 3, 46, [(6, HA['L']), (15, HA['L']), (25, HA['L'])]),
    'pavi': (pavi, 2, 85, [(5, HA['l']), (25, HA['l']), (36, HA['l'])]),
    'shishi': (shishi, 44, 46, [(4, HA['r']), (17, HA['R']), (29, HA['R'])]),
    'brammi': (brammi, 85, 52, [(4, HF['r']), (14, HF['r']), (23, HF['r'])]),
    'vinny': (vinny, 96, 98, [(3, HF['R']), (17, HF['R']), (25, HF['R'])]),
    'laki': (laki, 53, FLOOR - laki.shape[0] - 8, [(4, HF['L']), (10, HF['L']), (16, HF['l'])]),
}

# Fäden als Maske (1 Kartenpixel breit, Farben abwechselnd wie auf den Karten)
smask = np.zeros((NH, NW), np.int8) - 1
def line(x0, y0, x1, y1):
    n = max(abs(x1 - x0), abs(y1 - y0))
    for i in range(n + 1):
        x = round(x0 + (x1 - x0) * i / n); y = round(y0 + (y1 - y0) * i / n)
        if 0 <= x < NW and 0 <= y < NH: smask[y, x] = i % 2
for s, x, y, ss in pup.values():
    for c, (hx, hy) in ss:
        line(hx, hy, x + c, y + top_of(s, c))

STR_A = 0.55                                         # Fäden halbtransparent (ganze Pixel, gleiches Raster)
def draw_strings(rows=None, only=None):
    for yy, xx in zip(*np.where(smask >= 0)):
        if (rows is None or rows[0] <= yy < rows[1]) and (only is None or only[yy, xx]):
            cv.a[yy, xx] = np.round(cv.a[yy, xx] * (1 - STR_A) + np.array(STR[smask[yy, xx]]) * STR_A)

def put(s, x, y, sh=0.45):
    cv.paste(silhouette(s, (20, 10, 40)), x + 1, y + 2, alpha=sh)
    cv.paste(s, x, y)

cv.paste(rain, (NW - rain.shape[1]) // 2, FLOOR - rain.shape[0] + 1)
draw_strings()                                       # Fäden hinter den Puppen …
for k, (s, x, y, _) in pup.items():
    put(s, x, y)
snap = cv.a.copy()
put(ad, AX, TY, sh=0.3); put(fecta, FX, TY, sh=0.3)
trib = (cv.a != snap).any(-1)                        # nur dort neu, wo die Tribünen die Fäden überdeckt haben
draw_strings((TY + 17, TRIB_BOTTOM + 1), trib)       # … aber vor der Tribünenbrüstung (von den Händen aus)

big = Canvas(250, 350)
big.a[:] = up(np.dstack([cv.a, np.full(cv.a.shape[:2], 255, np.uint8)]), 2)[..., :3]
print(save(big, '03_puppet_theater.png'))
