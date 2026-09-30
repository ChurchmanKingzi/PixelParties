# -*- coding: utf-8 -*-
"""07 Bone Tide – Gegner „Bone Rush“ (Structure Deck Bone Rush), Held: Vacarn, the Dark Goblin Necromancer.

Bildidee: Vacarn steht groß vorn auf dem Geröllboden seines „Dark Land“; hinter ihm quillt sein Skelettheer
in Keilformation aus dem violetten Nebel der Schlucht auf den Betrachter zu – vorn die hellen Skelette seiner
Kartenwelt (Bogenschützen, Magier, Heiler), hinten im Nebel die dunklen Schatten von Reaper, Death Knight,
Burning und Cosmic Skeleton. Sein roter Nekromantie-Schein (wie auf der Base-Karte) leuchtet hinter ihm.
Frontal und mit Tiefenstaffel statt Friedhof von hinten (≠ „Raise the Minions“).

Quellen (Motive.xcf):
  Ebene 1231 „Vacarn“        – Base-Vacarn (Figur der Heldenkarte, Szene „Sichtbar #60“ = Ebene 47 bzw. #75 = 45,
                               Box 318,198–342,222; Pixel identisch, die Szene ist nur abgedunkelt/eingefärbt).
                               (NICHT 763 „VACARN“: andere Version mit geschlossenem Mund.)
  Ebene 1225 „Vacarn #4“     – roter Schein der Base-Karte (weichgezeichnet) → als geordnetes Dithering nachgezeichnet.
  Ebene 73 „Skele Archer #1“ – Skeleton Archer (Karte, Sichtbar #310), gespiegelt für die linke Flanke.
  Ebene 1226 „Vacarn #1“     – Bogenschütze (rechte Flanke). (Die Schädel/Skull Bats derselben Ebene und das seitlich
                               blickende Spitzhut-Skelett nach Nutzer-Feedback 1+2 entfernt.)
  Ebene 58 „Skele Mage #1“   – Skeleton Mage (Karte Skeleton Mage, Sichtbar #313).
  Ebene 54 „Healer Skele #2“ – Skeleton Healer (Karte, Sichtbar #314).
  Ebenen 790/794/796/792/787 – Skeleton Reaper, Death Knight, Burning Skele, Skeleton Wizard, Cosmic Skele
                               (dunkle Szenenfassungen, violett getönt als Schatten im Nebel; den Reaper wegen
                               der riesigen Sense am Ende weggelassen).
  Ebene 1286 „Dark Land“     – Kartenwelt der Vacarn-Karte: Geröll-, Fels-, Trümmer- und Violett-Textur.
Selbst gezeichnet: Nebel/Horizont, Felsgrate, Schatten, roter Schein.

Skalierung (Tiefenebenen):
  Hintergrund 2× (125×175): violetter Himmel/Nebel, Schluchtwände, Geröllboden, Schattenheer (Burning,
                            Death Knight, Wizard, Cosmic) auf dem Horizont, zweite Reihe:
                            Magier und Heiler auf dem schwarzen Geröllboden (kein Nebel auf dem Boden)
  Mittelgrund 3× (84×117):  zwei Bogenschützen als Flanke + Schatten, roter Schein hinter Vacarn (drei Stufen)
  Vordergrund 6× (42×59):   Vacarn + Schatten
"""
import math, random
import numpy as np
from common import *  # noqa

rnd = random.Random(7)
BAY = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0 + 1 / 32.0
B = 'Motive'

# ------------------------------------------------------------------ Sprites
vacarn = sprite('o07_vacarn', B, [1231], box=(318, 198, 342, 222))            # 22×22
archer_l = flip(parts(sprite('o07_archer', B, [73]), dil=1)[0])               # 26×19, gespiegelt → blickt nach rechts
vac1 = parts(sprite('o07_vac1', B, [1226]), dil=1)
archer_r = [p for p in vac1 if p.shape[:2] == (26, 18)][-1]                  # Bogenschütze, blickt nach links
bats = [p for p in vac1 if p.shape[:2] == (12, 13)]
wizard = [p for p in vac1 if p.shape[:2] == (29, 18)][0]                      # Skelett mit Spitzhut
mage = parts(sprite('o07_mage', B, [58]), dil=1)[0]                           # 23×22
healer = parts(sprite('o07_healer', B, [54]), dil=1)[0]                       # 24×20
shadows = {n: sprite('o07_' + n, B, [i]) for n, i in
           [('reaper', 790), ('dk', 794), ('burn', 796), ('wiz', 792), ('cosmic', 787)]}
land = layer(B, 1286)


def patch(x0, y0, x1, y1):
    return land[y0:y1, x0:x1, :3].astype(float)


GRAVEL = patch(330, 270, 400, 305)
PURPLE = patch(350, 100, 410, 160)
ROCK = patch(110, 190, 170, 240)
RUBBLE = patch(240, 260, 300, 300)


def tex(src, h, w, ox=0, oy=0):
    """Textur durch gespiegeltes Kacheln auf h×w bringen."""
    sh, sw = src.shape[:2]
    ys = np.arange(h) + oy; xs = np.arange(w) + ox
    yy = np.where((ys // sh) % 2 == 0, ys % sh, sh - 1 - ys % sh)
    xx = np.where((xs // sw) % 2 == 0, xs % sw, sw - 1 - xs % sw)
    return src[yy][:, xx]


def put(dst, s, x, y, alpha=1.0):
    h, w = s.shape[:2]
    for j in range(h):
        for i in range(w):
            if s[j, i, 3] == 0: continue
            yy, xx = y + j, x + i
            if 0 <= yy < dst.shape[0] and 0 <= xx < dst.shape[1]:
                if alpha >= 1 or dst[yy, xx, 3] == 0:
                    dst[yy, xx, :3] = s[j, i, :3]; dst[yy, xx, 3] = 255
                else:
                    dst[yy, xx, :3] = (dst[yy, xx, :3] * (1 - alpha) + s[j, i, :3] * alpha).astype(np.uint8)


def shadow(dst, cx, y, w, col=(8, 6, 14), a=0.55):
    for i in range(-w // 2, w // 2 + 1):
        for dy in (0, 1):
            ww = w // 2 - dy * 2
            if abs(i) > ww: continue
            xx, yy = cx + i, y + dy
            if 0 <= yy < dst.shape[0] and 0 <= xx < dst.shape[1]:
                if dst[yy, xx, 3] == 0:
                    dst[yy, xx, :3] = col; dst[yy, xx, 3] = int(255 * a)
                else:
                    dst[yy, xx, :3] = (dst[yy, xx, :3] * (1 - a) + np.array(col) * a).astype(np.uint8)


# ================================================================== Hintergrund 2× (125×175)
W2, H2 = 125, 175
HOR = 66                                   # Horizont (Canvas y 132)
bg = np.zeros((H2, W2, 4), np.uint8); bg[..., 3] = 255
sky = tex(PURPLE, H2, W2)
NIGHT = np.array((10, 8, 22))
MIST = np.array((120, 84, 190))
for y in range(HOR):
    for x in range(W2):
        t = y / HOR
        f = 0.25 + 0.55 * t                       # oben dunkel, zum Horizont heller violett
        c = NIGHT * (1 - f) + sky[y, x] * f
        # Nebelband über dem Horizont (Dithering)
        m = max(0.0, (y - (HOR - 22)) / 22) * 0.55
        dx = abs(x + 0.5 - W2 / 2) / (W2 / 2)
        m *= 1.0 - 0.35 * dx
        if m > BAY[y % 4, x % 4]: c = c * 0.45 + MIST * 0.55
        bg[y, x, :3] = np.clip(c, 0, 255)
# Sterne/Funken im Violett (sehr sparsam)
for _ in range(14):
    x, y = rnd.randrange(3, W2 - 3), rnd.randrange(3, HOR - 26)
    bg[y, x, :3] = (190, 170, 235)

# Felsgrate links und rechts (Schlucht, in der Mitte offen)
rock = tex(ROCK, H2, W2)


def ridge(x):
    """Oberkante der Schluchtwände (y): außen hoch, zur Mitte hin bis auf den Horizont abfallend."""
    d = abs(x + 0.5 - W2 / 2)
    if d < 30: return HOR + 2
    t = (d - 30) / (W2 / 2 - 30)
    return HOR - 2 - 44 * t ** 1.5 + 1.5 * math.sin(x * 0.8)


for x in range(W2):
    top = int(ridge(x))
    for y in range(max(top, 0), HOR + 6):
        dep = y - top
        f = 0.30 + 0.10 * min(dep, 6) / 6
        bg[y, x, :3] = np.clip(rock[y, x] * f + NIGHT * 0.3, 0, 255)
    if 0 <= top < H2 and top < HOR: bg[top, x, :3] = (58, 46, 84)          # schwache Gratkante im Nebellicht

# Geröllboden
grav = tex(GRAVEL, H2, W2, 5, 3)
rub = tex(RUBBLE, H2, W2)
for y in range(HOR + 4, H2):
    for x in range(W2):
        t = (y - HOR - 4) / (H2 - HOR - 4)
        f = 0.38 + 0.52 * t                         # nach hinten dunkler (Dunst)
        c = grav[y, x] * f
        bg[y, x, :3] = np.clip(c, 0, 255)
# Trümmerfelder links/rechts vorn (Steinziegel der Karte)
for (cx, cy, rx, ry) in [(10, 150, 16, 12), (116, 142, 14, 10), (22, 96, 10, 5), (104, 92, 9, 4)]:
    for y in range(cy - ry, cy + ry + 1):
        for x in range(cx - rx, cx + rx + 1):
            if not (0 <= x < W2 and HOR + 4 <= y < H2): continue
            d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
            if d < 1 - 0.25 * math.sin(x * 0.9 + y * 0.7):
                t = (y - HOR - 4) / (H2 - HOR - 4)
                bg[y, x, :3] = np.clip(rub[y, x] * (0.4 + 0.5 * t), 0, 255)
# Schattenheer im Nebel (2×, violett eingefärbt, auf dem Horizont)


def ghost(s, k=0.25):
    o = s.copy().astype(float)
    o[..., :3] = o[..., :3] * (1 - k) + np.array((70, 48, 120)) * k
    return o.astype(np.uint8)


foot = HOR + 7                                # Füße auf dem schwarzen Geröll, nicht im Nebel
line = [('burn', 25), ('dk', 38), ('wiz', 88), ('cosmic', 101)]
for n, cx in line:
    s = ghost(shadows[n])
    h, w = s.shape[:2]
    if n == 'reaper':
        h0 = h
    yb = foot - (h - 1) + (2 if n == 'reaper' else 0)
    shadow(bg, cx, foot + 1, w - 4, a=0.6)
    put(bg, s, cx - w // 2, yb)
# helle Skelette der zweiten Reihe (2×): Magier und Heiler auf dem dunklen Geröllboden
for s_, cx, fy in [(mage, 45, 80), (healer, 80, 80)]:
    h, w = s_.shape[:2]
    shadow(bg, cx, fy + 1, w - 4, a=0.5)
    put(bg, s_, cx - w // 2, fy - h + 1)

# ================================================================== Mittelgrund 3× (84×117)
W3, H3 = 84, 117
mid = np.zeros((H3, W3, 4), np.uint8)
glow = np.zeros((H3, W3, 4), np.uint8)
# roter Nekromantie-Schein hinter Vacarn (Base-Karte: rote Glut beiderseits, violette Schlieren)
gx, gy = 42, 84
RED1, RED2 = np.array((168, 22, 38)), np.array((104, 14, 42))
for y in range(H3):
    for x in range(W3):
        d = math.hypot((x + 0.5 - gx) / 1.3, (y + 0.5 - gy) / 1.0)
        d *= 30 / 25
        if d > 30: continue
        # drei weiche Stufen (transparente Rotschleier), nur an den Stufenkanten ein Pixel Schachbrett
        lv = 3 if d < 13 else 2 if d < 21 else 1
        edge = min(abs(d - 13), abs(d - 21), abs(d - 30))
        if edge < 0.7 and (x + y) % 2: lv -= 1
        if lv <= 0: continue
        glow[y, x, :3] = (RED1, RED2, RED2)[3 - lv] if lv > 1 else RED2
        glow[y, x, 3] = (0, 60, 105, 150)[lv]
# vier helle Skelette in Keilformation (Füße auf gestaffelter Linie)
row = [(archer_l, 18, 77), (archer_r, 66, 77)]
for s, cx, fy in row:
    h, w = s.shape[:2]
    shadow(mid, cx, fy, w - 4, a=0.6)
    put(mid, s, cx - w // 2, fy - h + 1)

# ================================================================== Vordergrund 6× (42×59)
W6, H6 = 42, 59
fg = np.zeros((H6, W6, 4), np.uint8)
vx, vfeet = 10, 52
shadow(fg, vx + 11, vfeet + 1, 20, a=0.65)
put(fg, vacarn, vx, vfeet - 21)

# ================================================================== zusammensetzen
cv = Canvas(250, 350)
cv.paste(up(bg, 2), 0, 0)
cv.paste(up(glow, 3), -1, 0)
cv.paste(up(mid, 3), -1, 0)
cv.paste(up(fg, 6), 2, 0)                         # Gesichtsmitte (Sprite-Spalte 10,5) auf x = 125 → 375 von 750
vignette(cv, 0.35, 0.62)
save(cv, '07_bone_tide.png')
print('ok')
