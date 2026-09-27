# -*- coding: utf-8 -*-
"""Idle-Animation für Serket, Dread of the Desert und den Skin Extraterrestrial
Serket (MotiveEgypt.xcf: „Serket“ bzw. „Serket-Kopie“).

Aufruf: python3 serket.py <tag> [ms] [hero|et]

* Stachel und Klauen blitzen auf: der Stachel (Schwanzende oben) und die
  beiden Scheren unten hellen nacheinander kurz auf, an ihrer Spitze blitzt
  ein Glitzerstern (nur ganz und nur neben der Figur).
* Der Schwanzbogen wippt leicht (oben 1 px, zur Wurzel hin weniger).
* Sie atmet: der Oberkörper hebt sich im Rhythmus um 1 px, die Beine bleiben.
* hero: die gelben Augen glimmen auf und ab.
* et:   wie auf der Karte funkeln ringsum kleine Glitzersterne.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs, draw_sparkles, sparkle_pixels
from flap_common import fill_pinholes

V = next((v for v in sys.argv[2:] if v in ('hero', 'et')), 'hero')
CFG = {
    'hero': dict(slug='serket-dread-of-the-desert', prefix='serket', outline=('311800', '000000'),
                 flash=(255, 255, 250), tint=('ffffd0', 'dcff43')),
    'et': dict(slug='extraterrestrial-serket', prefix='extraterrestrial_serket', outline=('070707', '000000'),
               flash=(225, 240, 255), tint=('d0e8ff', 'a0c0ff')),
}[V]
SRC = np.array(Image.open(f"src/{CFG['slug']}.png").convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
P, PT, PB = 5, 4, 3
H, W = SH + PT + PB, SW + 2 * P
N = 48
OUTLINE = {rgb(c) for c in CFG['outline']}
FLASH = np.array(CFG['flash'])
LEGS_Y = 24                                          # ab hier stehen die Beine
TAIL = lambda x, y: y <= 13 and x >= 12             # Schwanzbogen über dem Kopf
REGIONS = {'stinger': lambda x, y: y <= 4,
           'left': lambda x, y: x <= 4 and y >= 25,
           'right': lambda x, y: x >= SW - 5 and y >= 25}
# Aufblitzen: (Region, Startframe) – Stärke je Frame
FLASHES = [('stinger', 4), ('left', 16), ('right', 20), ('stinger', 30), ('left', 40), ('right', 40)]
RAMP = [0.35, 0.8, 0.8, 0.35]
TIPS = {'stinger': (9, 1), 'left': (-1, 21), 'right': (SW, 21)}   # Glitzerstern neben der Spitze
EYE = rgb('dcff43')
EYE_GLOW = [rgb('dcff43'), rgb('eaff85'), rgb('f7ffc4'), rgb('eaff85')]
ET_SPARKLES = [(3, 6, 2), (SW + 6, 12, 11), (3, 22, 22), (SW + 6, 26, 33), (8, 3, 42)]


def flash_amount(x, y, i):
    a = 0.0
    for reg, t0 in FLASHES:
        t = i - t0
        if 0 <= t < len(RAMP) and REGIONS[reg](x, y):
            a = max(a, RAMP[t])
    return a


def tail_dx(x, y, i):
    if not TAIL(x, y):
        return 0
    s = math.sin(2 * math.pi * i / 16)
    return int(round(s * (14 - y) / 13 * 1.2))


def breath(i):
    return -1 if (i % 16) in range(5, 12) else 0


def frame(i):
    out = np.zeros((H, W, 4), int)
    b = breath(i)
    glow = EYE_GLOW[(i // 4) % 4]
    for y in range(SH):
        for x in range(SW):
            if not SRC[y, x, 3]:
                continue
            c = SRC[y, x].copy()
            if V == 'hero' and tuple(c) == EYE:
                c = np.array(glow)
            a = flash_amount(x, y, i)
            if a and tuple(c) not in OUTLINE:
                c[:3] = (c[:3] * (1 - a) + FLASH * a).astype(int)
            yy = y + PT + (b if y < LEGS_Y else 0)
            out[yy, x + P + tail_dx(x, y, i)] = c
    if b:                                            # Zeile über den Beinen dehnen
        y = LEGS_Y - 1
        for x in range(SW):
            if SRC[y, x, 3] and not out[y + PT, x + P, 3]:
                out[y + PT, x + P] = SRC[y, x]
    fill_pinholes(out)
    stars = []
    for reg, t0 in FLASHES:                          # Glitzerstern an der aufblitzenden Spitze
        tx, ty = TIPS[reg]
        stars.append((tx + P, ty + PT, t0))
    if V == 'et':
        stars += ET_SPARKLES
    for st in stars:                                 # ganz oder gar nicht, nie über der Figur
        pix = sparkle_pixels(i, N, [st], rgb(CFG['tint'][0]), rgb(CFG['tint'][1]))
        if pix and not any(out[y - 1:y + 2, x - 1:x + 2, 3].any() for x, y in pix):   # 1 px Abstand
            draw_sparkles(out, i, N, [st], rgb(CFG['tint'][0]), rgb(CFG['tint'][1]))
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f"{CFG['prefix']}_idle_{tag}", frames, ms, scale=8, check_edges=True)
