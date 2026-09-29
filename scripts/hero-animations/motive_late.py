# -*- coding: utf-8 -*-
"""Idle-Animationen für die Nachzügler aus Motive.xcf (zweite Runde).

Aufruf: python3 motive_late.py <tag> [ms] <variante>

Frame 0 ist immer die Ruhepose.

* peszet:   Pes'zet, the Plague Bringer federt; seine beiden Schlangenarme bewegen sich unabhängig von
            ihm (spaltentreu geschert, an der Schulter fest – sie bleiben immer mit ihm verbunden), reißen
            die Mäuler auf und stoßen grünes Giftgas aus.
* notandras: Definitely not Andras, the Human Weapon feuert im Dauerfeuer aus allen vier Rohren (oft mehrere
            zugleich): Mündungsblitz, die Kugel fliegt schräg in Rohrrichtung davon; die Sonnenbrille blitzt.
* megaandras: Mega-Weapon Andras federt und blinzelt, aus den Löchern in seinen Fäusten steigt Rauch.
* champmizune: Regional Champ Mizune (Augen geschlossen) atmet, ihr Mantel wogt, um sie kreisen und
            spritzen Wassertropfen.
* storyteller: Chuck, the Storyteller erzählt: der Mund geht im Redefluss auf und zu, die Hand gestikuliert,
            über ihm schwebt und funkelt das goldene Ideenblatt; das Mädchen im Bett hört zu und blinzelt.
* gueldefaber: Güldefaber of the Fellowship federt und blinzelt, die Flügel an seinem Helm schlagen sacht.
"""
import math
import os
import sys
import numpy as np
from PIL import Image
from anim_common import rgb, save_outputs, BOUNCE12, draw_bounce, sparkle_pixels, ring8
from flap_common import shear_flap

N = 48
OUT = os.environ.get('ML_OUT', '.')
B24 = [BOUNCE12[(k // 2) % 12] for k in range(24)]  # gemächlich: ein Federn je 24 Frames
BLINK = {14: 'halb', 15: 'zu', 16: 'zu', 17: 'halb', 38: 'halb', 39: 'zu', 40: 'zu', 41: 'halb'}

V_ = {
    'peszet': dict(slug='peszet-the-plague-bringer', knee=21, pads=(14, 13, 3, 1)),
    'notandras': dict(slug='definitely-not-andras-the-human-weapon', knee=19, pads=(16, 18, 13, 15)),
    'megaandras': dict(slug='mega-weapon-andras', knee=19, pads=(8, 7, 3, 1), skin='Andras, the Human Weapon'),
    'champmizune': dict(slug='regional-champ-mizune', knee=17, pads=(6, 7, 3, 2), skin='Silent Water Mizune'),
    'storyteller': dict(slug='chuck-the-storyteller', pads=(3, 5, 4, 4)),
    'gueldefaber': dict(slug='g-ldefaber-of-the-fellowship', knee=16, pads=(3, 3, 3, 1),
                        skin='Güldefaber, the King of Dwarfs'),
}
V = next((v for v in sys.argv[2:] if v in V_), 'peszet')
C = V_[V]
SLUG = C['slug']


def load(part=None):
    n = f'src/{SLUG}-{part}.png' if part else f'src/{SLUG}.png'
    return np.array(Image.open(n).convert('RGBA')).astype(int)


SRC = load()
SH, SW = SRC.shape[:2]
KNEE = C.get('knee', SH)
PL, PR, PT, PB = C['pads']
H, W = SH + PT + PB, SW + PL + PR
_ys, _xs = np.mgrid[0:SH, 0:SW]


def hexc(c):
    return '%02x%02x%02x' % tuple(int(v) for v in c[:3])


def dot(out, x, y, c):
    if 0 <= y < out.shape[0] and 0 <= x < out.shape[1]:
        out[y, x] = c


def blend(out, x, y, c):
    if not (0 <= y < out.shape[0] and 0 <= x < out.shape[1]) or c[3] <= 0:
        return
    a = c[3] / 255
    if not out[y, x, 3]:
        out[y, x] = c
        return
    out[y, x, :3] = [int(c[k] * a + out[y, x, k] * (1 - a)) for k in range(3)]
    out[y, x, 3] = 255


def paste(out, a, ox, oy):
    for y, x in zip(*np.nonzero(a[:, :, 3])):
        dot(out, x + ox, y + oy, a[y, x])


def blink(s, i, table):
    st = BLINK.get(i)
    if st:
        for (x, y), c in table[st]:
            s[y, x] = rgb(c)


def flutter(out, s, i, ox, oy, rows, left, right, amp=2.0, speed=6, ok=None):
    t = 2 * math.pi * i / N
    env = 0.5 - 0.5 * math.cos(2 * t)
    for side, xs in ((-1, left), (1, right)):
        dxs = [round(amp * env * (0.5 + 0.5 * math.sin(speed * t - 0.9 * k + (0 if side < 0 else 1.7))))
               for k in range(len(rows))]
        for k in range(1, len(dxs)):
            dxs[k] = max(dxs[k - 1] - 1, min(dxs[k - 1] + 1, dxs[k]))
        for k, y in enumerate(rows):
            if dxs[k]:
                for x in xs:
                    if s[y, x, 3] and (ok is None or ok(s[y, x])):
                        dot(out, x + side * dxs[k] + ox, y + oy, s[y, x])


def figure_mask(base_fn):
    fig = np.zeros((H, W), bool)
    for k in range(N):
        fig |= base_fn(k)[:, :, 3] > 0
    return fig | ring8(fig)


# ---------------------------------------------------------------- Pes'zet
PZ_PIVOT = {-1: 14, 1: 25}                              # Schultern: innen davon bleibt der Arm stehen
PZ_ARM = {-1: (0.13, 0.0, 3), 1: (0.13, 2.4, 2)}         # Ausschlag, Phase, Frequenz je Arm
PZ_BITE = {-1: range(6, 18), 1: range(28, 40)}          # Maul offen (Frames im Loop)
PZ_GAS = ['8fd14f', '6fb03a', '4f8a2a', '3d6b22']


def peszet_arms(i, b):
    """Die Schlangenarme: spaltentreu an der Schulter geschert, das Maul (Unterkiefer) klappt auf."""
    t = 2 * math.pi * i / N
    out = np.zeros((H, W, 4), int)
    heads = {}
    for side, part in ((-1, 'arml'), (1, 'armr')):
        a = load(part).copy()
        amp, ph, fr = PZ_ARM[side]
        lift = amp * (math.sin(fr * t + ph) - math.sin(ph))
        st = BLINK.get((i + (8 if side < 0 else 22)) % N)   # die Schlangen blinzeln, jede für sich
        if st:
            ex, ux = (4, 3) if side < 0 else (35, 36)
            a[10, ex] = rgb('817b00')
            if st == 'zu':
                a[11, ex] = a[11, ux] = rgb('292508')
        if i % N in PZ_BITE[side]:                        # Maul auf: nur die Schnauzenspitze, der Unterkiefer
            xs = range(0, 4) if side < 0 else range(SW - 4, SW)   # (ab Zeile 13) sinkt 1 px
            jaw = np.zeros((SH, SW), bool)
            for x in xs:
                jaw[13:, x] = a[13:, x, 3] > 0
            moved = a.copy()
            moved[jaw] = 0
            for y, x in zip(*np.nonzero(jaw)):
                moved[y + 1, x] = a[y, x]
            a = moved
        m = a[:, :, 3] > 0
        shear_flap(a, m & ((_xs < PZ_PIVOT[side]) if side < 0 else (_xs > PZ_PIVOT[side])), PZ_PIVOT[side], side,
                   lift, 1.0, out, (PL, PT + b), curve=1.3)
        for y, x in zip(*np.nonzero(m & ((_xs >= PZ_PIVOT[side]) if side < 0 else (_xs <= PZ_PIVOT[side])))):
            dot(out, x + PL, y + PT + b, a[y, x])
        far = PZ_PIVOT[side] if side < 0 else SW - 1 - PZ_PIVOT[side]
        hx = 0 if side < 0 else SW - 1
        heads[side] = (hx + PL, 14 + PT + b - round(lift * far))
    return out, heads


def peszet_base(i):
    b = B24[i % 24]
    out = np.zeros((H, W, 4), int)
    draw_bounce(out, load('body'), b, KNEE, PT, PL)
    arms, _ = peszet_arms(i, b)
    m = arms[:, :, 3] > 0
    out[m] = arms[m]
    return out


def f_peszet(i):
    out = peszet_base(i)
    b = B24[i % 24]
    _, heads = peszet_arms(i, b)
    for side in (-1, 1):                                  # Giftgas quillt aus dem offenen Maul
        start = PZ_BITE[side][0] + 1
        for k in range(5):
            a = (i - start - 2 * k) % N
            if a < 14:
                hx, hy = heads[side] if a == 0 else heads[side]
                x = hx + side * (2 + 0.6 * a) + 0.6 * math.sin(a + k)
                y = hy + 1 - 0.55 * a + k
                r = 1.0 + 0.16 * a
                al = max(40, 220 - 13 * a)
                for yy in range(int(y - 2), int(y + 3)):
                    for xx in range(int(x - 2), int(x + 3)):
                        if math.hypot(xx - x, yy - y) <= r and 0 <= xx < W and 0 <= yy < H and not out[yy, xx, 3]:
                            dot(out, xx, yy, rgb(PZ_GAS[min(3, (a + xx + yy) % 4 if a > 8 else (xx + yy) % 2)], al))
    return out


# ---------------------------------------------------------------- Definitely not Andras
NA_BARRELS = [(2, 7, -1, -1, 0), (31, 7, 1, -1, 2), (9, 22, -1, 1, 4), (24, 22, 1, 1, 1)]  # Mündung, Richtung, Phase
NA_EVERY = 6                                            # jedes Rohr feuert alle 6 Frames – oft mehrere zugleich
NA_FLASH = {0: [(0, 0, 'ffffff'), (1, 1, 'fff6a0'), (1, 0, 'ffd23c'), (0, 1, 'ffd23c'), (2, 2, 'ffd23c')],
            1: [(0, 0, 'fff6a0'), (1, 1, 'ff8a1e'), (1, 0, 'ff8a1e'), (0, 1, 'ff8a1e')],
            2: [(0, 0, 'ff8a1e')]}
NA_LENS = {'c41616', 'ca1b16', '901010'}


def f_notandras(i):
    """Er feuert im Dauerfeuer aus allen vier Kanonenrohren (jedes Rohr alle 6 Frames, oft mehrere zugleich): Mündungsblitz, die
    Kugel fliegt schräg in Rohrrichtung davon (oben nach oben außen, unten nach unten außen), die Mündung
    glüht nach, der Rumpf zuckt beim Rückstoß; über die Sonnenbrille blitzt ein Glanz."""
    s = SRC.copy()
    g = (i % 16) - 3                                      # Glanz über die roten Gläser
    for y, x in zip(*np.nonzero(s[:, :, 3])):
        if hexc(s[y, x]) in NA_LENS and 6 <= y <= 10:
            d = (x - 11) + (y - 7) - g * 1.5
            if abs(d) < 0.8:
                s[y, x] = rgb('ffffff')
            elif -2 < d < 0:
                s[y, x] = rgb('ff9a9a')
    b = B24[i % 24]
    kick = 0
    for bx, by, sx, sy, st in NA_BARRELS:
        if (i - st) % NA_EVERY == 0:
            kick = -sx
    out = np.zeros((H, W, 4), int)
    draw_bounce(out, s, b, KNEE, PT, PL, dx_fn=(lambda x, y: kick) if kick else None)
    for bx, by, sx, sy, st in NA_BARRELS:
        for a in ((i - st) % NA_EVERY, (i - st) % NA_EVERY + NA_EVERY):   # auch die vorige Kugel fliegt noch
            ex = bx + PL + kick + sx
            ey = by + PT + (b if by < KNEE else 0) + sy
            if a in NA_FLASH and a < NA_EVERY:
                for dx, dy, c in NA_FLASH[a]:
                    dot(out, ex + sx * dx, ey + sy * dy, rgb(c))
            if 1 <= a < 5:                                # die Kugel mit kurzer Leuchtspur, schräg und schnell
                x, y = ex + sx * (1 + 4 * a), ey + sy * (1 + 4 * a)
                dot(out, x, y, rgb('fff6a0'))
                dot(out, x - sx, y - sy, rgb('ffd23c'))
                dot(out, x - 2 * sx, y - 2 * sy, rgb('ff8a1e', 160))
            if a < 4:                                     # die Mündung glüht nach
                dot(out, bx + PL + kick, by + PT + (b if by < KNEE else 0), rgb('ffb440' if a < 4 else 'ff5020'))
    return out


# ---------------------------------------------------------------- Mega-Weapon Andras
MA_BLINK = {'halb': [((x, 10), '311800') for x in (9, 10, 13, 14)],
            'zu': [((x, 10), 'f5ce88') for x in (9, 10, 13, 14)] + [((x, 11), '311800') for x in (9, 10, 13, 14)]}


MA_HOLES = [(2, 15, -1), (5, 15, -1), (1, 16, -1), (18, 15, 1), (21, 15, 1), (22, 16, 1)]   # Löcher in den Fäusten
MA_SMOKE = ['bdb8b0', 'a39f98', '8b8781', '76736e']


def f_megaandras(i):
    """Er federt und blinzelt; aus den Löchern in seinen Fäusten steigt Rauch auf und zieht nach außen weg."""
    s = SRC.copy()
    blink(s, i, MA_BLINK)
    b = B24[i % 24]
    out = np.zeros((H, W, 4), int)
    draw_bounce(out, s, b, KNEE, PT, PL)
    for k, (hx, hy, side) in enumerate(MA_HOLES):
        for rep in range(2):
            a = (i - 5 * k - 24 * rep) % N
            if a < 18:
                x = hx + PL + side * (0.35 * a + 0.5 * math.sin(0.7 * a + k))
                y = hy + PT + (b if hy < KNEE else 0) - 0.8 * a
                r = 0.5 + 0.08 * a
                al = max(40, 200 - 9 * a)
                for yy in range(int(y - 2), int(y + 3)):
                    for xx in range(int(x - 2), int(x + 3)):
                        if math.hypot(xx - x, yy - y) <= r and 0 <= xx < W and 0 <= yy < H and \
                                (a < 3 or not out[yy, xx, 3] or out[yy, xx, 3] < 255):
                            blend(out, xx, yy, rgb(MA_SMOKE[min(3, a // 5)], al))
    return out


# ---------------------------------------------------------------- Regional Champ Mizune
CM_COAT = {'0f494d', '1a6568', '297978', '3a9294'}
CM_DROPS = None


def f_champmizune(i):
    """Sie atmet (Augen geschlossen), ihr Mantel wogt; um sie kreisen Wassertropfen, die auf ihrer
    Bahn glitzern, und ab und zu spritzt es neben ihr auf."""
    t = 2 * math.pi * i / N
    s = SRC.copy()
    b = B24[i % 24]
    out = np.zeros((H, W, 4), int)
    draw_bounce(out, s, b, KNEE, PT, PL)
    flutter(out, s, i, PL, PT + b, list(range(13, 22)), range(0, 4), range(SW - 4, SW), amp=1.2, speed=3,
            ok=lambda c: hexc(c) in CM_COAT)
    cx, cy = PL + SW / 2, PT + 13
    for k in range(7):                                    # Tropfen auf einer schrägen Ellipse um sie
        ang = 2 * t * (1 if k % 2 == 0 else 1) + 2 * math.pi * k / 7
        x = cx + (SW / 2 + 4.5) * math.cos(ang)
        y = cy + 9 * math.sin(ang) + 2.5 * math.cos(ang)
        front = math.sin(ang) > 0
        xi, yi = round(x), round(y)
        if not front and out[yi, xi, 3]:
            continue                                      # hinter ihr verschwindet der Tropfen
        dot(out, xi, yi, rgb('4fa8ff' if front else '2f78d8'))
        dot(out, xi, yi - 1, rgb('bfe4ff' if (i + k) % 6 == 0 else '7fc4ff', 230))
        tx, ty = round(x - 1.6 * math.cos(ang + 1.57)), round(y - 1.6 * math.sin(ang + 1.57))
        if not out[ty, tx, 3]:
            dot(out, tx, ty, rgb('4fa8ff', 110))          # kurze Spur hinter dem Tropfen
    for st, sx in ((6, PL - 2), (22, PL + SW + 1), (38, PL + 2)):   # Spritzer am Boden neben ihr
        a = (i - st) % N
        if a < 6:
            x0 = sx
            gy = PT + SH + b - 1
            for dx, dy in ((-a, -a // 2), (a, -a // 2), (0, -a)):
                dot(out, x0 + dx // 2, gy + dy, rgb('9fd8ff', 220 - 30 * a))
    return out


# ---------------------------------------------------------------- Chuck, the Storyteller
ST_MOUTH = [((13, 16), 'f6bd7b'), ((14, 16), 'f6bd7b'), ((13, 17), 'd5a462'), ((14, 17), 'd5a462')]
ST_TALK = [1, 1, 0, 1, 1, 1, 0, 0, 1, 0, 1, 1, 1, 0, 0, 0, 1, 1, 0, 1, 1, 0, 1, 1,
           1, 0, 0, 1, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0]
ST_GIRL = {'halb': [((x, 7), '413704') for x in (24, 25, 28, 29)],
           'zu': [((x, 7), 'fce7d6') for x in (24, 25, 28, 29)] + [((x, 8), '413704') for x in (24, 25, 28, 29)]}


BED_X0, BED_X1 = 17, 36                                 # das Bettgestell (neu gezeichnet, Holz wie der Stuhl)
BED_WOOD = ('2d1a0c', '6b4424', '8a5a2c', 'a8723a')     # Kontur, dunkel, mittel, hell
BED_TOP = 12                                            # hier wird das Bettzeug breit: darüber kein Gestell


def bed(out, layer):
    """Bettgestell: zwei Pfosten mit Knäufen, die erst dort beginnen, wo das Bettzeug breit wird (hinter
    ihr), vorn das Fußteil vor der Decke, darunter die Beine."""
    k, d, m, hl = (rgb(c) for c in BED_WOOD)
    if layer == 'back':
        for y in range(BED_TOP + 1, 25):                  # Pfosten
            for x in (BED_X0, BED_X1):
                dot(out, x + PL, y + PT, k)
            for x in (BED_X0 + 1, BED_X1 - 1):
                dot(out, x + PL, y + PT, d if y > BED_TOP + 2 else m)
        for x in range(BED_X0 - 1, BED_X0 + 3):           # Knäufe
            dot(out, x + PL, BED_TOP + PT, k if x in (BED_X0 - 1, BED_X0 + 2) else hl)
        for x in range(BED_X1 - 2, BED_X1 + 2):
            dot(out, x + PL, BED_TOP + PT, k if x in (BED_X1 - 2, BED_X1 + 1) else hl)
    else:
        for y in range(21, 25):                           # Fußteil vor der Decke
            for x in range(BED_X0, BED_X1 + 1):
                edge = x in (BED_X0, BED_X1) or y in (21, 24)
                dot(out, x + PL, y + PT, k if edge else (hl if y == 22 else m))
        for x in (BED_X0, BED_X0 + 1, BED_X1 - 1, BED_X1):   # Beine
            for y in (25, 26):
                dot(out, x + PL, y + PT, k if x in (BED_X0, BED_X1) else d)


def f_storyteller(i):
    """Chuck erzählt: der Mund geht im Redefluss auf und zu, die Hand gestikuliert, sein Kopf wippt beim
    Erzählen; über ihm schwebt das goldene Ideenblatt und funkelt. Das Mädchen im Bett hört zu, atmet und
    blinzelt (versetzt zu ihm)."""
    t = 2 * math.pi * i / N
    girl, chair, hands, body, hand, idea = (load(p) for p in ('girl', 'chair', 'hands', 'body', 'hand', 'idea'))
    girl = girl.copy()
    st = BLINK.get((i + 20) % N)
    if st:
        for (x, y), c in ST_GIRL[st]:
            girl[y, x] = rgb(c)
    body = body.copy()
    if not ST_TALK[i] or i == 0:                          # Mund zu (Ruhepose: zu)
        for (x, y), c in ST_MOUTH:
            body[y, x] = rgb(c)
    out = np.zeros((H, W, 4), int)
    bed(out, 'back')
    gb = 1 if (i % 24) in range(8, 14) else 0             # sie atmet unter der Decke
    for y, x in zip(*np.nonzero(girl[:, :, 3])):
        dot(out, x + PL, y + PT + (gb if y <= 9 else 0), girl[y, x])
    bed(out, 'front')
    paste(out, chair, PL, PT)
    nod = 1 if ST_TALK[i] and (i % 8) in (2, 3) else 0     # beim Erzählen wippt sein Oberkörper
    gest = -round(1.5 * (0.5 - 0.5 * math.cos(3 * t)))     # die Hand hebt sich zur Geste
    paste(out, hands, PL, PT + nod)
    for y, x in zip(*np.nonzero(body[:, :, 3])):
        dot(out, x + PL, y + PT + (nod if y <= 22 else 0), body[y, x])
    paste(out, hand, PL, PT + gest + nod)
    bob = -round(1.5 * math.sin(2 * t))                    # das Ideenblatt schwebt und funkelt
    glow = (i % 12) in (0, 1, 2)
    for y, x in zip(*np.nonzero(idea[:, :, 3])):
        c = idea[y, x]
        if glow:
            c = [min(255, int(c[k] + (255 - c[k]) * 0.45)) for k in range(3)] + [255]
        dot(out, x + PL, y + PT + bob, c)
    for (x, y), c in sparkle_pixels(i, N, [(7 + PL, 5 + PT + bob, 4), (1 + PL, 11 + PT + bob, 28)],
                                    rgb('fffbd0'), rgb('f5e000')).items():
        dot(out, x, y, c)
    return out


# ---------------------------------------------------------------- Güldefaber of the Fellowship
GF_BLINK = {'halb': [((6, 7), '430103'), ((11, 7), '430103')],
            'zu': [((6, 7), '430103'), ((11, 7), '430103'), ((6, 8), '261510'), ((11, 8), '261510')]}


def f_gueldefaber(i):
    """Er federt und blinzelt; sein langer Bart wiegt sich (zur Spitze hin stärker), die Arme bleiben ruhig."""
    t = 2 * math.pi * i / N
    s = SRC.copy()
    blink(s, i, GF_BLINK)
    beard = s.copy()
    for y in range(12, SH):                               # der Bart zwischen den Armen: Zeile für Zeile
        u = (y - 11) / (SH - 11)
        dx = round(1.3 * u * math.sin(2 * t - 0.5 * y) - 1.3 * u * math.sin(-0.5 * y))
        if not dx:
            continue
        seg = [x for x in range(4, 14) if s[y, x, 3]]
        if not seg:
            continue
        x0, x1 = seg[0], seg[-1]
        for x in range(x0, x1 + 1):
            beard[y, x] = 0
        for x in range(x0, x1 + 1):
            if s[y, x, 3]:
                beard[y, x + dx] = s[y, x]
        fill = x0 if dx > 0 else x1                       # die frei gewordene Kante bekommt die Randfarbe
        for k in range(abs(dx)):
            xx = fill + (k if dx > 0 else -k)
            if not beard[y, xx, 3]:
                beard[y, xx] = s[y, fill]
    b = B24[i % 24]
    out = np.zeros((H, W, 4), int)
    draw_bounce(out, beard, b, KNEE, PT, PL)
    return out


FRAME = dict(peszet=f_peszet, notandras=f_notandras, megaandras=f_megaandras, champmizune=f_champmizune,
             storyteller=f_storyteller, gueldefaber=f_gueldefaber)

if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [FRAME[V](i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'{OUT}/{V}_idle_{tag}', frames, ms, scale=6 if W < 90 else 3, check_edges=True)
