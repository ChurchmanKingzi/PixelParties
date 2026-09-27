# -*- coding: utf-8 -*-
"""Sleeve: Grabkammer des Pharaos – alle Figuren und Texturen direkt aus den Ebenen von MotiveEgypt.xcf
(Repo PixelPartiesSprites).

Runde 2b: EINE Pixelgröße für alles – die ganze Szene wird im Originalraster (84×117) gebaut und am Ende
3× hochskaliert (auf dem 250er-Raster, Rand um 1 Rasterpixel beschnitten). Kein eigener Rahmen.
- Tafel mit dem Auge von Ren: Ebene „Ebene #130“ (#99) auf der Mauertextur der Eye-of-Ren-Karte
  (Pyramiden-Mauerwerk, Ebene „Pyramid“ #121, Kachel 3×6) – wie auf der Karte in derselben Pixelgröße.
- Wand: waagrechtes Ziegelmauerwerk, Boden: Flechtverband – beides aus Ebene „Ebene #48“ (#185, Grabkammer
  der Ushabti-/Mummy-Guards-Karten), Kacheln 48×16 bzw. 16×16.
- Figuren (vollständig, gegen die Sichtbar-Szenen geprüft): Soul Shard Ren (#188), zwei Ushabti mit Flamme
  (#168, mittlere Figur, einmal gespiegelt), Royal Mummy Guards (#183, beide Wächter), Soul Shard Khet (#214).
- Schlagschatten als Abdunklung ganzer Rasterpixel im selben Raster.
- Weggelassen (passen in 3× nicht mehr): schlichte Ushabti und Urnen."""
import numpy as np
from kit import Canvas, up, flip, silhouette, save
from xcfkit import sprite, parts

B = 'MotiveEgypt'
NW, NH = 84, 117
cv = Canvas(NW, NH)

room = sprite('r2_05_room', B, [185])                       # Grabkammer-Textur (Ebene #48), zugeschnitten ab (293,317)
WALL = room[38:54, 178:226, :3]                          # waagrechte Ziegel, Periode 48×16
FLOOR = room[80:96, 190:206, :3]                         # Flechtverband, Periode 16×16
PYR = sprite('r2_05_pyr_tile', B, [121], box=(440, 336, 443, 342))[..., :3]   # Pyramiden-Mauerwerk (3×6)

ren = sprite('r2_05_ren', B, [188])
eye = sprite('r2_05_eye', B, [99])
ush = parts(sprite('r2_05_ushabti', B, [168]))             # links, Mitte (mit Flamme), rechts
grd = parts(sprite('r2_05_guards', B, [183]), dil=0)        # zwei Wächter (mit Sensen)
assert len(grd) == 2
khet = sprite('r2_05_khet', B, [214])

FLOOR_Y = 80                                             # Übergang Wand → Boden
for y in range(NH):
    for x in range(NW):
        cv.a[y, x] = WALL[y % 16, (x + 6) % 48] if y < FLOOR_Y else FLOOR[(y - FLOOR_Y) % 16, (x + 2) % 16]
# Sockelkante: Boden direkt an der Wand etwas dunkler (Schatten der Wand)
cv.a[FLOOR_Y:FLOOR_Y + 1] = (cv.a[FLOOR_Y:FLOOR_Y + 1] * 0.55).astype(np.uint8)
cv.a[FLOOR_Y + 1:FLOOR_Y + 2] = (cv.a[FLOOR_Y + 1:FLOOR_Y + 2] * 0.8).astype(np.uint8)

def shade(x0, y0, x1, y1, f):
    cv.a[y0:y1, x0:x1] = (cv.a[y0:y1, x0:x1] * f).astype(np.uint8)

def put(s, x, y, fl=False, sh=0.45, anchor='tl'):
    s2 = flip(s) if fl else s
    h, w = s2.shape[:2]
    if anchor == 'c': x -= w // 2
    if anchor == 'b': x -= w // 2; y -= h
    if sh: cv.paste(silhouette(s2, (40, 12, 0)), x + 1, y + 1, alpha=sh)
    cv.paste(s2, x, y)
    return x, y, w, h

fl = ush[1]
UX = (3, NW - 3 - fl.shape[1])
UY = FLOOR_Y + 1 - fl.shape[0]                           # Ushabti stehen hinten auf dem Boden
yy, xx = np.mgrid[:NH, :NW]

# Tafel mit dem Auge (Pyramiden-Mauerwerk), 1 px dunkle Kante, Schlagschatten auf der Wand
TX0, TX1, TY0, TY1 = 4, NW - 4, 3, 38
shade(TX0 + 1, TY0 + 1, TX1 + 1, TY1 + 1, 0.55)
for y in range(TY0, TY1):
    for x in range(TX0, TX1):
        cv.a[y, x] = PYR[(y - TY0) % 6, (x - TX0) % 3]
EDGE = (60, 30, 10)
cv.a[TY0, TX0:TX1] = EDGE; cv.a[TY1 - 1, TX0:TX1] = EDGE; cv.a[TY0:TY1, TX0] = EDGE; cv.a[TY0:TY1, TX1 - 1] = EDGE
put(eye, NW // 2, TY0 + (TY1 - TY0 - eye.shape[0]) // 2, anchor='c', sh=0)

# hintere Reihe: Ushabti mit Flammen links/rechts, dazwischen Ren schwebend vor der Wand
put(fl, UX[0], UY, sh=0.5); put(fl, UX[1], UY, fl=True, sh=0.5)
put(ren, NW // 2, TY1 + 3, anchor='c', sh=0.5)
# vordere Reihe auf dem Boden: zwei Mumienwächter, Khet in der Mitte
GY = NH - 5
put(grd[0], 6, GY - grd[0].shape[0], sh=0.5)
put(grd[1], NW - 6 - grd[1].shape[1], GY - grd[1].shape[0], sh=0.5)
put(khet, NW // 2, GY + 1, anchor='b', sh=0.5)

big = Canvas(250, 350)
big.a[:] = up(cv.a, 3)[0:350, 1:251]
print(save(big, '05_pharaoh_tomb.png'))
