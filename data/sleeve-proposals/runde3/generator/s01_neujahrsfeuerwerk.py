# -*- coding: utf-8 -*-
"""Sleeve 01 – Neujahrsfeuerwerk vor der Palastmauer.

Junshi zündet mit seinem Räucherstab die Feuerwerkskanonen, drei Raketen steigen über die
zinnenbewehrte Palastmauer und zerplatzen am Nachthimmel. Xiong und der Kinderkaiser Zhigao
schauen hinter den Zinnen zu.
Quellen (MotiveChina.xcf): Ebene #1 [36] (Palastmauer), Firework Cannon #2 [30] (Raketen +
Feuerwerksblüte, rote Blüte als Vorlage für die umgefärbten Blüten), Firework Cannon #1 [31]
(Kanonenkiste), Hintergrund [37] (Rasen), Junshi [33] + Junshi #2 [34] (Stab), Xiong [5], Zhigao #2 [14].
Himmel: selbst erstellter, geditherter Verlauf; Lichthöfe gedithert.
"""
from a_util import *  # noqa

B = 'MotiveChina'
cv = Canvas(250, 350)

# --- Bauteile ---------------------------------------------------------------------------
fw = sprite('a01_fireworks', B, [30])
fw_parts = parts(fw, dil=0)
blob = [p for p in fw_parts if p.shape[0] >= 9][0]
rockets = [p for p in fw_parts if p.shape[0] in (13, 15) and p.shape[1] == 4]
# rote Blüte ist vollständig sichtbar (11×11, symmetrisch) → Vorlage für alle Farben
red = (blob[..., 0] > 200) & (blob[..., 2] < 100) & (blob[..., 3] > 0)
ys, xs = np.where(red)
bmask = red[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def burst(col):
    s = np.zeros(bmask.shape + (4,), np.uint8)
    s[bmask] = list(col) + [255]
    return s


C_RED, C_CYAN, C_PURP = (255, 29, 14), (14, 255, 207), (117, 77, 198)
C_GOLD = (255, 230, 40)                     # Gelb der Raketen-Funken

wall = compose(B, [36])                     # 469×89
box = sprite('a01_cannons', B, [31])
box = parts(box, dil=0)[0]                  # nur Kiste mit drei Rohren (ohne Ärmel)
junshi = sprite('a01_junshi', B, [33, 34])
xiong = sprite('a01_xiong', B, [5])
zhigao = sprite('a01_zhigao', B, [14])

# --- Himmel -----------------------------------------------------------------------------
vgrad(cv, 0, 236, [(6, 4, 22), (14, 9, 44), (32, 16, 66), (62, 26, 74)])

# ferne, kleine Blüten (Tiefe)
for (cx, cy, k, col) in [(190, 110, 2, C_CYAN), (22, 96, 2, C_GOLD), (112, 72, 2, C_RED),
                         (182, 150, 1, C_PURP), (70, 160, 1, C_RED), (150, 128, 1, C_GOLD),
                         (228, 18, 1, C_GOLD), (20, 20, 1, C_PURP), (90, 16, 1, C_CYAN),
                         (240, 70, 1, C_PURP), (44, 34, 1, C_RED)]:
    glow(cv, cx, cy, 8 * k, col, 0.3)
    put(cv, burst(col), cx, cy, k, anchor='c')

# große Blüten mit Lichthof
BIG = [(186, 56, 4, C_RED), (58, 60, 3, C_CYAN), (136, 20, 3, C_PURP), (126, 116, 3, C_GOLD)]
for cx, cy, k, col in BIG:
    glow(cv, cx, cy, 8.5 * k, col, 0.45)
for cx, cy, k, col in BIG:
    put(cv, burst(col), cx, cy, k, anchor='c')

# aufsteigende Raketen (Schweif mit gelben Funken zeigt nach unten)
for (x, y, r) in [(98, 80, rockets[0]), (160, 140, rockets[1]), (228, 74, rockets[2])]:
    put(cv, r, x, y, 3)

# --- Palastmauer --------------------------------------------------------------------------
WY = 176
wcrop = wall[:, 90:90 + 126]
wdark = tint(darken(wcrop, 0.6), (70, 24, 96), 0.2)
put(cv, wdark, -1, WY, 2)

# Zuschauer hinter der Brüstung: erst Figuren, dann die Mauer ab Brüstungsoberkante erneut darüber
put(cv, xiong, 62, WY + 20, 3, anchor='b')
put(cv, zhigao, 214, WY + 16, 3, anchor='b', fl=True)
front = wdark.copy(); front[:6] = 0
put(cv, front, -1, WY, 2)
# warmes Licht der Blüten auf der Mauerkrone
glow(cv, 125, WY + 10, 120, (255, 120, 80), 0.18)

# --- Vordergrund ---------------------------------------------------------------------------
# Rasenstreifen (Hintergrund-Ebene der Palastkarten, gezackte Oberkante), nachtdunkel
grass = layer(B, 37)[372:392, 214:340].copy()
grass[..., 3] = np.where(grass[..., 1] > grass[..., 0] + 10, 255, 0)     # nur Grün (gezackte Kante)
put(cv, tint(darken(grass, 0.72), (40, 20, 80), 0.15), -1, 314, 2)
put(cv, box, 10, 347, 4, anchor='bl', shadow=0.5, sdx=1, sdy=0)
put(cv, junshi, 180, 351, 5, anchor='b', fl=True)

frame(cv, [(20, 8, 4), (150, 40, 20), (230, 170, 60), (20, 8, 4)])
print(save(cv, '01_neujahrsfeuerwerk.png'))
