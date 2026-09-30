# -*- coding: utf-8 -*-
"""38 New Flock – Gegner „Slimy Infestation“, Held: Stellan, the Calm Cat.

Stellan steht wie auf seiner Base-Karte mit ausgebreiteten Armen und geschlossenen Augen an der goldenen Kette des
roten Teppichs in seinem Katzentempel (violette Ziegelmauer, Kopfsteinpflaster). Über ihm leuchtet ein großes
Buntglasfenster, eine Lichtbahn fällt auf ihn herab, heilige Funken schweben im Licht. Wo ihn auf der
Karte seine weißen Katzen umringen, hat er jetzt eine neue Herde: die Schleime des Decks sitzen paarweise gespiegelt
in einem nach vorn offenen Bogen hinter ihm auf dem Pflaster (Fiery/Icy, Sparky/Shiny, Splashy/Shadowy), Cloudy
Slime flattert über allem. Seine Fähigkeit: Wird er getroffen, holt er Level-0-Kreaturen in seine Support-Zonen –
die Schleime rücken ruhig nach.

Quellen:
  MotiveGrailWar.xcf  Ebene 428 „Stellan“ – nur die mittlere Figur (Zusammenhangskomponente x238–255/y153–177, mit
                      Schnurrhaaren); das ist die Base-Karte „Stellan, the Calm Cat“ (Sichtbar #73 = Ebene 426, Lage
                      209,138, Übereinstimmung 0,97). Nicht Ebene 427 „OSTER STELLAN“ (Hasen-Variante).
                      Ebene 426 (Szene der Karte) als Texturquelle: Ziegelkachel 16×8 (x230–262/y93–113),
                      Pflasterkachel 16×16 (x168–184/y176–192),
                      Teppichmuster (x212–220/y140–148), Goldkette (x256–266/y164–168).
  MotiveHawaii.xcf    Ebene 250 „Ebene #5“ (Kirche) – linkes großes Rundbogen-Buntglasfenster, nur der obere,
                      nicht von Lichtkegeln überdeckte Teil (x382–450/y276–326, Wand per Farbmaske entfernt);
                      Ebene 204 „Ebene #12“ – Funkelsterne als heilige Partikel (blassgold/weiß).
  Motive.xcf          Schleime: 466 „Fiery Slime“, 469 „Icy Slime“, 532 „Sparky Slime“, 447 „Shiny Slime“,
                      451 „Splashy Slime“ + 452 „Ebene #588“ (Spritzer), 535 „Darky Slime“ (= Shadowy Slime der
                      Karte), 459 „Cloudy Slime“ + 460 (Schatten).
Selbst gezeichnet: Wandsockel, Fensterbank, Schein um das Fenster, Lichtbahn, Schatten, Abdunklung zum Rand.

Skalierung (Tiefenebenen):
  Hintergrund (Mauer, Fenster, Licht, Partikel, Pflaster, Teppich, Kette, sieben Schleime) – 2× (125×175)
  Vordergrund (Stellan 18×25 → 90×125 px, Schatten, Funkelsterne)                  – 5× (50×70)
"""
import math
import numpy as np
from gkit36_40 import *  # noqa

T = layer('MotiveGrailWar', 426)
BRICK = T[93:109, 230:262].copy()           # 2 Ziegelreihen-Perioden × 2 Kacheln
COBBLE = T[176:192, 168:184].copy()
CARPET = T[140:148, 212:220].copy()
CHAIN = T[164:169, 256:266].copy()

# ================================================================== Hintergrund 2× (125×175)
W2, H2 = 125, 175
bg = Plane(W2, H2, 2)
WALL_B = 56                                  # Wandunterkante (Zeile)
CH_Y = 118                                   # Kette (Oberkante) – Teppich beginnt darunter
for y in range(H2):
    for x in range(W2):
        if y < WALL_B:
            c = BRICK[(y + 3) % 16, (x + 5) % 32]
        elif y < CH_Y:
            c = COBBLE[(y - WALL_B) % 16, (x + 3) % 16]
        elif y < CH_Y + 5:
            c = CHAIN[y - CH_Y, x % 10]
        else:
            c = CARPET[(y - CH_Y) % 8, x % 8]
        bg.a[y, x, :3] = c[:3]; bg.a[y, x, 3] = 255
# Wandsockel: eine dunkle Fuge + helle Kante (Farben der Ziegel)
DARK, LIGHT = (57, 41, 74), (148, 130, 173)
for x in range(W2):
    bg.a[WALL_B - 2, x, :3] = LIGHT
    bg.a[WALL_B - 1, x, :3] = (107, 93, 140)
    bg.a[WALL_B, x, :3] = DARK

# Abdunklung: Wand oben, Pflaster zum Rand
for y in range(H2):
    for x in range(W2):
        dx = abs(x + 0.5 - W2 / 2) / (W2 / 2)
        f = 0.0
        if y < WALL_B - 2: f = 0.22 + 0.35 * max(0.0, 1 - y / 20)        # Wand ruhiger, oben dunkel
        f = max(f, 0.35 * max(0.0, dx - 0.55) / 0.45)
        if y > CH_Y + 5: f = max(f, 0.45 * ((y - CH_Y - 5) / (H2 - CH_Y - 5)) ** 1.3 + 0.3 * max(0.0, dx - 0.5))
        q = dith(f, x, y, 4)
        if q > 0: bg.blend(x, y, (20, 12, 30), q)

# Großes Kirchenfenster (MotiveHawaii, Kirche der Karte „Barrier of Faith“ u. a.: linkes Rundbogenfenster, oberer,
# unverdeckter Teil) mittig über Stellan; Maske: alles, was nicht zur Ziegelpalette der Kirchenwand gehört
import cv2
H250 = layer('MotiveHawaii', 250)
win = H250[276:326, 382:450].copy()
wpal = {tuple(c) for c in H250[280:330, 360:380, :3].reshape(-1, 3)}
wm = np.array([[tuple(c) not in wpal for c in row] for row in win[..., :3]]).astype(np.uint8)
n_, lab_ = cv2.connectedComponents(wm, connectivity=4)
k_ = int(np.argmax([(lab_ == k).sum() for k in range(1, n_)])) + 1
wm = cv2.morphologyEx((lab_ == k_).astype(np.uint8), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
ff = (1 - wm).astype(np.uint8); fm = np.zeros((ff.shape[0] + 2, ff.shape[1] + 2), np.uint8)
cv2.floodFill(ff, fm, (0, 0), 2); wm = (wm > 0) | (ff == 1)
win[~wm] = 0
wb = bbox(win); win = win[wb[1]:wb[3], wb[0]:wb[2]]
sprite('o38_window', 'MotiveHawaii', [250], box=(382, 276, 450, 326))
WH, WW = win.shape[:2]
WX, WY = 63 - WW // 2, 2
# heller Schein um das Fenster auf der Wand (gerastert)
GLOW = (226, 204, 160)
for y in range(0, WALL_B - 2):
    for x in range(W2):
        d = math.hypot((x + 0.5 - 63) / 1.25, y + 0.5 - (WY + WH * 0.55))
        v = 0.55 * max(0.0, 1 - d / 40)
        q = dith(v, x, y, 4)
        if q > 0: bg.blend(x, y, GLOW, q)
bg.paste(win, WX, WY)
# Fensterbank (selbst gezeichnet, Ziegelfarben): helle Kante + Schattenfuge unter dem geraden Fensterende
for x in range(WX - 2, WX + WW + 2):
    bg.a[WY + WH, x, :3] = LIGHT
    bg.a[WY + WH + 1, x, :3] = (107, 93, 140)
    bg.a[WY + WH + 2, x, :3] = DARK
# Lichtbahn vom Fenster schräg auf den Boden hinter Stellan (heiliges Licht, gerastert)
BEAM = (240, 222, 170)
for y in range(WY + WH + 3, CH_Y + 30):
    t = (y - (WY + WH)) / (CH_Y + 30 - WY - WH)
    half = WW / 2 - 6 + 16 * t
    for x in range(W2):
        dx = abs(x + 0.5 - 63) / half
        if dx >= 1: continue
        v = 0.34 * (1 - dx ** 2) * (1 - 0.6 * t)
        q = dith(v, x, y, 4)
        if q > 0: bg.blend(x, y, BEAM, q)

# ------------------------------------------------------------------ Schleime (hinten auf dem Pflaster, ebenfalls 2×)
SPR = {'fiery': [466], 'icy': [469], 'sparky': [532], 'shiny': [447], 'splashy': [451, 452], 'darky': [535],
       'cloudy': [459]}
S = {k: sprite('o38_' + k, 'Motive', v) for k, v in SPR.items()}
# nach vorn offener Bogen: Fußpunkte (Mitte unten), Paare gespiegelt zur Mitte x = 62.5
PLACE = [('splashy', 36, 73), ('darky', 90, 73),
         ('sparky', 23, 93), ('shiny', 103, 93),
         ('fiery', 15, 113), ('icy', 111, 113)]
SH = (38, 28, 50)
for k, fx, fy in PLACE:
    s_ = S[k]; h, w = s_.shape[:2]
    for yy in range(-1, 2):                          # flacher Schatten
        for xx in range(-(w // 2), w // 2 + 1):
            if (xx / (w / 2 + 0.5)) ** 2 + (yy / 1.6) ** 2 <= 1:
                bg.blend(fx + xx, fy + yy, SH, 0.55)
    bg.paste(s_, fx - w // 2, fy - h + 1)
cl = S['cloudy']; h, w = cl.shape[:2]
bg.paste(cl, 63 - w // 2, WALL_B + 2)                      # Scheitel des Bogens, flattert vor der Wand

# ================================================================== Vordergrund 5× (50×70)
W5, H5 = 50, 70
fg = Plane(W5, H5, 5)
L = compose('MotiveGrailWar', [428], crop=False)
import cv2
m = (L[..., 3] > 0).astype(np.uint8)
n, lab = cv2.connectedComponents(m, connectivity=8)
k = lab[165, 246]
st = L.copy(); st[lab != k] = 0
b = bbox(st); st = st[b[1]:b[3], b[0]:b[2]]
sprite('o38_stellan_all', 'MotiveGrailWar', [428])
h, w = st.shape[:2]
SX, SY = 25 - w // 2, 60 - h + 1               # Füße auf Zeile 60 (Teppich knapp vor der Kette)
for xx in range(-7, 8):
    for yy in (-1, 0, 1):
        if (xx / 7.5) ** 2 + (yy / 1.6) ** 2 <= 1: fg.px(25 + xx, 60 + yy, (60, 8, 20), 140)
fg.paste(st, SX, SY)

# heilige Partikel um Stellan: die Funkelsterne aus MotiveHawaii Ebene 204 (Kirche/Barrier of Faith), blassgold und
# weiß, im Raster der Figur (5×) – sie schweben im Lichtschein vor ihm
SPK = parts(compose('MotiveHawaii', [204]), dil=0, minpx=1)
sprite('o38_sparkles', 'MotiveHawaii', [204])
GOLD = (255, 236, 170)
for k, (x, y, idx) in enumerate([(25, 33, 3), (13, 44, 0), (37, 44, 2), (16, 31, 2), (34, 31, 0)]):
    sp = SPK[idx].copy()
    sp[sp[..., 3] > 0, :3] = (255, 255, 255) if k == 0 else GOLD
    fg.paste(sp, x - sp.shape[1] // 2, y - sp.shape[0] // 2)

cv = compose_planes([bg, fg])
save(cv, '38_new_flock.png')
print('ok', st.shape)
