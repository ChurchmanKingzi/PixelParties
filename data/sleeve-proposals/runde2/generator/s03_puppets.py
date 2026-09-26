# -*- coding: utf-8 -*-
"""Sleeve: Puppentheater – Bühne, Puppets, Tri Ad & Tri Fecta mit Brücke, Regenbogen und Fäden
direkt aus den Ebenen von MotiveIndia.xcf (Repo PixelPartiesSprites)."""
import numpy as np
from kit import Canvas, up, flip, silhouette, save, widen
from xcfkit import sprite, parts, part_at

B = 'MotiveIndia'
NW, NH = 125, 175
cv = Canvas(NW, NH)

# --- Bühne (Ebene „Ebene #100“, 118×126): auf 125 Breite gespiegelt ergänzt, Vorhang in der Höhe verlängert
st = sprite('in_stage', B, [212])[..., :3]
st = widen(st[:, 3:113], NW)                        # Seitenrahmen weg, Vorhang gespiegelt auf 125 Breite
top, body, fringe, floor = st[0:14], st[14:40], st[76:88], np.concatenate([st[88:104], st[118:126]], 0)
n_body = NH - len(top) - len(fringe) - len(floor)
body_col = np.concatenate([body, body[::-1]] * 5, 0)[:n_body]   # Falten gespiegelt → nahtlos
col = np.concatenate([top, body_col, fringe, floor], 0)
cv.a[:] = col[:NH]
FLOOR = NH - len(floor) - 4      # Oberkante der Bühnenbretter

# --- Figuren
saras = parts(sprite('in_saras', B, [330]))[0]
laki = parts(sprite('in_laki', B, [331]))[0]
pavi = parts(sprite('in_pavi', B, [332]))[0]
vinny = part_at(sprite('in_vinny_scene', B, [326]), 85, 57)
brammi = sprite('in_brammi', B, [334])
shishi = sprite('in_shishi', B, [336])
fecta = sprite('in_trifecta', B, [344, 346])        # Tri Fecta auf der Tribüne
ad = sprite('in_triad', B, [345, 346])              # Tri Ad auf der Tribüne
rain = sprite('in_rainbow', B, [327])

STR = [(176, 176, 176), (227, 227, 227)]            # Fadenpixel der Kartenebenen
def string(x, y0, y1):
    for y in range(y0, y1):
        cv.px(x, y, STR[(y // 2 + y) % 2])

def top_of(s, cx):
    c = s[:, cx, 3]; return int(np.argmax(c > 0))

def put(s, x, y, fl=False, sh=0.45):
    s2 = flip(s) if fl else s
    cv.paste(silhouette(s2, (20, 10, 40)), x + 1, y + 2, alpha=sh)
    cv.paste(s2, x, y)

cv.paste(rain, (NW - rain.shape[1]) // 2, FLOOR - rain.shape[0] + 1)
BY = 12 + ad.shape[0] - 2
pos = {'saras': (saras, 4, 50), 'shishi': (shishi, 46, 46), 'brammi': (brammi, 92, 48),
       'pavi': (pavi, 2, 90), 'laki': (laki, 55, FLOOR - laki.shape[0] - 8), 'vinny': (vinny, 92, 94)}
for k, (s, x, y) in pos.items():
    w = s.shape[1]
    for fx in (2, w // 2, w - 3):
        string(x + fx, BY, y + top_of(s, fx))
for k, (s, x, y) in pos.items():
    put(s, x, y)
put(ad, 2, 12, sh=0.3); put(fecta, NW - fecta.shape[1] - 2, 12, sh=0.3)

big = Canvas(250, 350)
big.a[:] = up(np.dstack([cv.a, np.full(cv.a.shape[:2], 255, np.uint8)]), 2)[..., :3]
print(save(big, '03_puppet_theater.png'))
