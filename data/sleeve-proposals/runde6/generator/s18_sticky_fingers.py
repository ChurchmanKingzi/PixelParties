# -*- coding: utf-8 -*-
"""18 „Sticky Fingers“ – Gegner „Flying Sparks“, Held: Lilly, the Charming Infiltrator (Base).

Bildidee (Nachtszene/Erzählung, Überarbeitung nach Nutzer-Feedback – ohne Königin): Nachts vor dem Rathaus steht oben
das Giebelfenster offen und leuchtet warm; Sparkflies schleppen die Beute heraus: zwei Sparkfly Attendants (roter
Fleck) tragen die funkelnde Schatztruhe (ihre Beine greifen über den Deckel), zwei Sparkfly Worker tragen statt ihres
Honigtopfs je einen Goldsack. Vorn steht Lilly und streckt frech die Zunge heraus – die Sparkflies sind ihre Komplizen.

Quellen:
  Lilly (Base)    = Motive.xcf Ebene 973 „Lilly“ (18×25; = Sichtbar #256, Ebene 140, Kartenlage 281,137, 0 px Abweichung)
  Sparkfly Attendant = MotiveRussia.xcf Ebene 160 (Körper) + 158 (Flügel, 70 % auf ganzen Pixeln), linke Biene
                    + roter Fleck Ebene 159 „Ebene #60“ (Karte Sichtbar #11, Ebene 147)
  Sparkfly Worker = MotiveRussia.xcf Ebene 166 (Körper) + 165/168 (Flügel, 70 %), Karte Sichtbar #13 (Ebene 145);
                    ihr Honigtopf 167 ist durch den Goldsack ersetzt
  Goldsack        = Motive.xcf Ebene 1379 „Wealth“: vorderer Sack, oval freigestellt, Truhenglanz entfernt, Sackhals
                    (3 Zeilen) in den Sackfarben ergänzt
  Treasure Chest  = Motive.xcf Ebene 1386 + Funkeln aus Ebene 1384 „Treasure Chest #4“
  Rathaus         = MotiveGrailWar.xcf Ebene 663 „Rathaus aussen“, Ausschnitt x230–480/y113–299 (ohne FPS-Anzeige,
                    Teich und Passant), Platz nach unten mit Pflaster-Kachel x424–456/y268–300 verlängert
Selbst gezeichnet: Nachtfärbung, Fensterlicht und Lichtschein, Schatten der Tiere und Lillys.

Skalierung (Ausgabe = 250×350-Raster × 3):
  Rathaus, Pflaster, Fensterlicht                   – 1×
  Sparkflies, Truhe, Goldsäcke, Funkeln, Flugschatten – 2× (125×175)
  Lilly + Fußschatten                               – 5× (50×70)
"""
import math, random
from c_util import *  # noqa
import numpy as np
import xcfkit as X

M, G, R = 'Motive', 'MotiveGrailWar', 'MotiveRussia'
rnd = random.Random(18)

lilly = sprite('o18_lilly', M, [973])                        # 18×25, = Sichtbar #256 (Ebene 140), 0 px Abweichung
# Sparkfly-Arbeiterin: Körper 160 + Flügel 158 (linke Biene), Königin: 177 Körper + 176 Beine + 175 Krone
body = layer(R, 160)[244:276, 82:108].copy(); wing = layer(R, 158)[244:276, 82:108].copy()
bb = bbox(X.over(body, wing)); body = body[bb[1]:bb[3], bb[0]:bb[2]]; wing = wing[bb[1]:bb[3], bb[0]:bb[2]]
red = layer(R, 159)[244:276, 82:108].copy()[bb[1]:bb[3], bb[0]:bb[2]]      # roter Fleck der Sparkfly Attendant
att = body.copy(); att[red[..., 3] > 0] = red[red[..., 3] > 0]
# Goldsack: vorderer Sack der Ebene 1379 „Wealth“ (oval freigestellt, Truhenglanz oben entfernt, Sackhals ergänzt)
W_ = layer(M, 1379)[184:208, 126:154].copy()
yy, xx = np.mgrid[184:208, 126:154]
W_[((xx + 0.5 - 140) / 10) ** 2 + ((yy + 0.5 - 199) / 6.6) ** 2 > 1] = 0
W_[(yy < 196) & (W_[..., 0] > 200)] = 0
b_ = bbox(W_); sack0 = W_[b_[1]:b_[3], b_[0]:b_[2]]
sack = np.zeros((sack0.shape[0] + 3, sack0.shape[1], 4), np.uint8); sack[3:] = sack0
cx_ = sack.shape[1] // 2
for (dx, dy, c) in [(-1, 0, (90, 57, 32)), (0, 0, (123, 83, 43)), (1, 0, (90, 57, 32)),
                    (-1, 1, (109, 55, 21)), (0, 1, (157, 106, 55)), (1, 1, (109, 55, 21)),
                    (-2, 2, (90, 57, 32)), (-1, 2, (162, 89, 44)), (0, 2, (157, 106, 55)), (1, 2, (162, 89, 44)), (2, 2, (90, 57, 32))]:
    sack[dy, cx_ + dx] = list(c) + [255]
chest = sprite('o18_chest', M, [1386])                      # Treasure Chest 24×16
hall = layer(G, 663)                                        # „Rathaus aussen“ (320×240-Karte)

# ---------- 1×: Rathaus bei Nacht ----------
cv = Canvas(250, 350)
X0, Y0 = 230, 113
HB = 186                                                   # bis y 299 (darunter Teich und Passant der Karte)
bg = hall[Y0:Y0 + HB, X0:X0 + 250, :3].astype(int)
# Platz nach unten mit Pflaster der Karte verlängern (32er-Kachel, Periode des Pflasters)
tile = hall[268:300, 424:456, :3].astype(int)
full = np.zeros((350, 250, 3), int)
full[:HB] = bg
for y in range(HB, 350):
    for x in range(250):
        full[y, x] = tile[(y - HB + 12) % 32, (x + 6) % 32]      # Pflaster hat eine 16-px-Periode: glatt kacheln
# Nachtfärbung: abdunkeln, nach Blau ziehen
night = (full * np.array([0.30, 0.36, 0.52]) + np.array([4, 8, 20])).clip(0, 255)
# warmes Licht aus dem offenen Giebelfenster (Innenraum x120–132, y51–60) + Lichtkegel auf der Fassade
WX, WY = 126, 56
for y in range(350):
    for x in range(250):
        d = math.hypot((x + 0.5 - WX) / 1.0, (y + 0.5 - WY) / 0.8)
        if d < 34:
            lv = int((1 - d / 34) * 3 + bayer(x, y))
            if lv: night[y, x] = [mix(tuple(int(v) for v in night[y, x]), (255, 196, 110), (0, .10, .2, .3)[min(3, lv)])][0]
win = full[51:61, 120:133]
dark = win.sum(-1) < 200
for j in range(10):
    for i in range(13):
        if dark[j, i]: night[51 + j, 120 + i] = (255, 206, 120) if j > 2 else (232, 160, 80)
cv.a[:] = night.astype(np.uint8)

# ---------- 2×: Sparkflies mit Beute ----------
p2 = rgba(125, 175)
wings2 = rgba(125, 175)
def bee(x, y, fl=False):
    b_, w_ = (flip(body), flip(wing)) if fl else (body, wing)
    put(wings2, w_, x, y); put(p2, b_, x, y)
# Sparkfly Worker (Karte Sichtbar #13, Ebene 145): Körper 166 + Flügel 165/168, ohne ihren Honigtopf 167
wk_body = compose(R, [166], crop=False)[284:306, 99:128]
wk_wing = compose(R, [165, 168], crop=False)[284:306, 99:128]
wb = bbox(X.over(wk_body.copy(), wk_wing)); wk_body = wk_body[wb[1]:wb[3], wb[0]:wb[2]]; wk_wing = wk_wing[wb[1]:wb[3], wb[0]:wb[2]]
def carry(load, lx, ly, bees):
    """Last zuerst, dann die Tiere darüber: ihre Beine greifen über die Oberkante der Last."""
    put(p2, load, lx, ly)
    for (b_, w_, x, y, fl) in bees:
        put(wings2, flip(w_) if fl else w_, x, y); put(p2, flip(b_) if fl else b_, x, y)
# zwei Sparkfly Attendants (roter Fleck) tragen die Schatztruhe (Beine auf dem Deckel)
carry(chest, 23, 66, [(att, wing, 14, 53, False), (att, wing, 31, 53, True)])
# zwei Sparkfly Worker tragen statt ihres Honigtopfs je einen Goldsack
carry(sack, 85, 50, [(wk_body, wk_wing, 86, 36, False)])
carry(sack, 71, 86, [(wk_body, wk_wing, 72, 72, True)])
# Funkeln der Treasure-Chest-Karte (Ebene 1384) um die Truhe
spark = [p for p in parts(compose(M, [1384]), dil=0) if p.shape[0] >= 3]
for sp, (x, y) in zip(spark, [(17, 80), (50, 74), (46, 88), (20, 90), (34, 92)]):
    put(p2, sp, x, y)
# Schatten der fliegenden Tiere auf dem Pflaster (1 Rasterpunkt dunkler, 2×)
def shade(cx, cy, rx, ry):
    for y in range(cy - ry, cy + ry + 1):
        for x in range(cx - rx, cx + rx + 1):
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 and 0 <= x < 125 and 0 <= y < 175:
                cv.a[y * 2:y * 2 + 2, x * 2:x * 2 + 2] = (cv.a[y * 2:y * 2 + 2, x * 2:x * 2 + 2] * 0.6).astype(np.uint8)
shade(35, 108, 13, 3); shade(101, 100, 7, 2); shade(87, 112, 7, 2)
blit(cv, p2, 2)
cv.paste(up(wings2, 2), 0, 0, alpha=0.7)                    # Flügel wie in den Kartenszenen durchscheinend (70 %)
cv.paste(up(p2, 2), 0, 0)                                   # Körper über die Flügel

# ---------- 5×: Lilly ----------
p5 = rgba(50, 70)
for x in range(18, 32):                                     # Schatten unter Lillys Füßen (eine 5×-Zeile)
    if abs(x - 24.5) < 6.5: cv.a[62 * 5:63 * 5, x * 5:x * 5 + 5] = (cv.a[62 * 5:63 * 5, x * 5:x * 5 + 5] * 0.55).astype(np.uint8)
put(p5, lilly, (50 - 18) // 2, 37)
blit(cv, p5, 5)
print(save(cv, '18_sticky_fingers.png'))
