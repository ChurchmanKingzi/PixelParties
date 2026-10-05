# -*- coding: utf-8 -*-
"""Kartenbild für den Skin „Berserker Null“ (cards/skins/Berserker Null.png).

Nimmt die Karte von Null, the Mage Slayer, ersetzt den Titel (Pixel Intv, weiß) und
malt ins Bildfenster eine Mondnacht über einer zerstörten Stadt mit dem Berserker-Sprite
(Frame aus berserker.py) samt rotem Schein um das Schwert.
Aufruf (aus scripts/hero-animations):  python3 berserker_card.py
"""
import math
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from anim_common import rgb
import berserker as B

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
SKIN = 'Berserker Null'
WIN = (70, 160, 680, 570)                      # Bildfenster der Karte (x0, y0, x1, y1)
NX, NY = 78, 52                                # Zellen im Fenster (Pixel-Raster der Kartenbilder)
TITLE = (70, 50, 680, 120)                     # Innenfläche des Titelfelds
FRAME = 12                                     # Animationsframe fürs Kartenbild
GROUND = 43                                    # Zeile, ab der der Boden beginnt

SKY = [rgb(h) for h in ('070812', '0b0d22', '10132f', '171a40', '20244f', '2b3060', '363b72')]   # oben -> Horizont
CLOUD = [rgb(h) for h in ('222850', '323a68', '47507f', '65709a')]
MOON = [rgb(h) for h in ('d9def2', 'aab3d6', '7d89b8')]
CITY = [rgb(h) for h in ('0a0b1a', '12142a')]
STONE = [rgb(h) for h in ('0b0a14', '161426', '221f38', '33304f')]


def bayer(x, y):
    return ((x & 1) * 2 + (y & 1) * 1 + ((x >> 1) & 1) * 0) / 4.0


def scene():
    a = np.zeros((NY, NX, 4), int)
    rng = np.random.RandomState(7)
    for y in range(NY):                                       # Himmel mit Dithering
        t = min(1.0, y / (GROUND - 2)) * (len(SKY) - 1)
        for x in range(NX):
            k = int(t + (bayer(x, y) - 0.375))
            a[y, x] = SKY[max(0, min(len(SKY) - 1, k))]
    for _ in range(40):                                       # ein paar Sterne
        x, y = rng.randint(0, NX), rng.randint(0, 22)
        a[y, x] = rgb('aab3d6') if rng.rand() < 0.6 else rgb('5b6496')
    # Finsternis-Mond: heller Ring mit dunkler Scheibe
    cx, cy, r = 17, 11, 8
    for y in range(NY):
        for x in range(NX):
            d = math.hypot(x - cx, y - cy)
            if r - 1.2 <= d <= r + 0.6:
                a[y, x] = MOON[0] if d < r - 0.2 else MOON[1]
            elif r + 0.6 < d <= r + 2.2:
                a[y, x] = tuple(int(0.55 * c + 0.45 * m) for c, m in zip(a[y, x][:3], MOON[2][:3])) + (255,)
            elif d < r - 1.2:
                a[y, x] = rgb('050612')
    # Wolkenbänder
    for by, ph in ((24, 0.0), (30, 1.7), (36, 3.1)):
        for x in range(NX):
            h = 2 + int(1.6 * math.sin(x * 0.19 + ph) + 1.2 * math.sin(x * 0.07 + ph * 2))
            for dy in range(h):
                y = by + dy
                if 0 <= y < GROUND:
                    lv = 0 if dy > h - 2 else (1 if dy > 0 else 2)
                    if (x + y) % 5 and a[y, x, 3]:
                        a[y, x] = CLOUD[lv + (1 if by == 30 else 0)]
    # Stadtsilhouette mit Türmen
    xs = 0
    while xs < NX:
        w = rng.randint(3, 7)
        h = rng.randint(3, 8)
        for x in range(xs, min(NX, xs + w)):
            for y in range(GROUND - h, GROUND):
                a[y, x] = CITY[0] if (x + y) % 7 else CITY[1]
        if rng.rand() < 0.45 and xs + w // 2 < NX:             # Turmspitze
            tx = xs + w // 2
            for k in range(1, 5):
                if GROUND - h - k >= 0:
                    a[GROUND - h - k, tx] = CITY[0]
        xs += w
    for _ in range(26):                                        # beleuchtete Fenster
        x, y = rng.randint(0, NX), rng.randint(GROUND - 7, GROUND - 1)
        if tuple(a[y, x][:3]) in (CITY[0][:3], CITY[1][:3]):
            a[y, x] = rgb('7a4a30') if rng.rand() < 0.5 else rgb('a86a3a')
    # Boden aus Trümmern
    for y in range(GROUND, NY):
        for x in range(NX):
            lv = 3 if y == GROUND else (2 if y == GROUND + 1 else (1 if (x * 7 + y * 3) % 9 > 3 else 0))
            if y > GROUND + 1 and (x + y * 2) % 11 == 0:
                lv = 2
            a[y, x] = STONE[lv]
    return a


def glow(a, spr_off):
    """Roter Schein um das Schwert: Boden und Himmel bekommen einen Rotstich nach Abstand."""
    ys, xs = np.nonzero(B.BLADE[:, :, 3] > 0)
    pts = [(x + B.PL + spr_off[0], y + B.PT + spr_off[1]) for y, x in zip(ys, xs)]
    for y in range(NY):
        for x in range(NX):
            d = min(math.hypot(x - px, y - py) for px, py in pts[::3])
            if d < 7:
                f = (1 - d / 7) ** 1.6 * 0.55
                f = round(f * 4) / 4                          # in Stufen (Pixel-Look)
                c = a[y, x]
                a[y, x] = (min(255, int(c[0] + (150 - c[0] * 0.2) * f)), int(c[1] * (1 - f * 0.4)),
                           int(c[2] * (1 - f * 0.5)), 255)


def compose():
    card = Image.open(os.path.join(ROOT, 'cards', 'Null the Mage Slayer.png')).convert('RGBA')
    off = (3, 4)                                               # Sprite-Frame im Fenster (Zellen)
    a = scene()
    glow(a, off)
    fr = B.frame(FRAME)
    for y, x in zip(*np.nonzero(fr[:, :, 3])):
        yy, xx = y + off[1], x + off[0]
        if 0 <= yy < NY and 0 <= xx < NX:
            a[yy, xx] = fr[y, x]
    art = Image.fromarray(a.astype(np.uint8)).resize((WIN[2] - WIN[0], WIN[3] - WIN[1]), Image.NEAREST)
    card.paste(art, WIN[:2])

    # Titel: Text im Titelfeld zeilenweise mit der Bandfarbe überdecken, neuen Titel setzen
    px = card.load()
    x0, y0, x1, y1 = TITLE
    for y in range(y0, y1):
        ref = px[100, y]
        for x in range(100, 650):
            px[x, y] = ref
    font = None
    for size in range(80, 30, -1):
        f = ImageFont.truetype(os.path.join(ROOT, 'data', 'Pixel Intv.otf'), size)
        if f.getlength(SKIN) <= 520:
            font = f
            break
    d = ImageDraw.Draw(card)
    bb = d.textbbox((0, 0), SKIN, font=font)
    tx = (x0 + x1) // 2 - (bb[0] + bb[2]) // 2
    ty = (y0 + y1) // 2 - (bb[1] + bb[3]) // 2
    d.text((tx, ty), SKIN, font=font, fill=(255, 255, 255, 255))
    return card


if __name__ == '__main__':
    c = compose().convert('RGB')
    out = os.path.join(ROOT, 'cards', 'skins', SKIN + '.png')
    c.save(out)
    print('geschrieben:', out, c.size)
