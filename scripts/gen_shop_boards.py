#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Erzeugt die Shop-Boards board3..board6 (Zonen-Skins + Vorschau).

Die FARBEN je Zonentyp sind gesetzt (aus board1/board2 ausgelesen:
Hero lila, Ability blau, Support gelb, Surprise rot, Potion braun,
Area rot, Delete schwarz/dunkellila, Deck/Discard grau).
Die Themes unterscheiden sich nur im DESIGN: Rahmenform, Muster,
Mittel-Kartusche und Symbole. Raster: 30x42 Zellen à 4 px (120x168 -> 120x170).
"""
import math, os, random, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from board_png import write_png

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'shop', 'boards') + os.sep
GW, GH, CELL = 30, 42, 4
CX, CY = 14.5, 20.5      # Mitte des Rasters

def rgb(t): return (t[0], t[1], t[2], 255)
def mix(a, b, t): return tuple(int(a[i]*(1-t) + b[i]*t) for i in range(3))

# Feste Paletten (exakt aus den Originalen ausgelesen):
#  dk = Rahmen/Schatten, lo = dunkle Fläche, m = Grundfläche, hi = Glanz,
#  pale = Füllung des hellen Stils, bd = Rahmen des hellen Stils
PAL = {
 'ability':  dict(dk=(5,19,50),   lo=(18,63,165),  m=(22,76,199),   hi=(25,86,226),    pale=(191,202,226), bd=(18,63,165)),
 'area':     dict(dk=(40,13,13),  lo=(135,45,45),  m=(165,55,55),   hi=(187,62,62),    pale=(255,181,181), bd=(135,45,45)),
 'deck':     dict(dk=(28,28,28),  lo=(92,92,92),   m=(111,111,111), hi=(126,126,126),  pale=(230,230,230), bd=(92,92,92)),
 'delete':   dict(dk=(0,0,0),     lo=(31,31,31),   m=(58,58,58),    hi=(58,58,58),     pale=(179,179,179), bd=(0,0,0)),
 'discard':  dict(dk=(28,28,28),  lo=(92,92,92),   m=(111,111,111), hi=(126,126,126),  pale=(201,201,201), bd=(92,92,92)),
 'hero':     dict(dk=(25,0,62),   lo=(78,0,196),   m=(94,0,235),    hi=(111,14,255),   pale=(223,201,255), bd=(60,0,150)),
 'potion':   dict(dk=(36,21,13),  lo=(122,72,45),  m=(150,88,55),   hi=(170,100,63),   pale=(255,203,176), bd=(122,72,45)),
 'support':  dict(dk=(170,83,0),  lo=(255,240,0),  m=(255,255,111), hi=(255,255,204),  pale=(255,255,245), bd=(255,204,0)),
 'surprise': dict(dk=(40,13,13),  lo=(135,45,45),  m=(165,55,55),   hi=(187,62,62),    pale=(255,181,181), bd=(135,45,45)),
}
ZONES = list(PAL)
# Symbolfarben (aus den Original-Symbolen)
GREEN, DGREEN, BLUE, LBLUE, NAVY = (0,255,1), (0,108,0), (51,133,186), (80,170,255), (14,28,50)
PURPLE, DPURPLE, VPURPLE = (40,0,115), (31,0,88), (55,0,160)
GRAVE1, GRAVE2, GRAVE3 = (193,180,194), (135,120,135), (104,92,104)

# ── Zeichenhilfen ──────────────────────────────────────────────────────────
class Canvas:
    def __init__(s, fill):
        s.g = [[rgb(fill)] * GW for _ in range(GH)]
    def put(s, x, y, c):
        if 0 <= x < GW and 0 <= y < GH: s.g[y][x] = rgb(c)
    def get(s, x, y): return s.g[y][x]
    def rect(s, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): s.put(x, y, c)
    def frame(s, x0, y0, x1, y1, c):
        for x in range(x0, x1 + 1): s.put(x, y0, c); s.put(x, y1, c)
        for y in range(y0, y1 + 1): s.put(x0, y, c); s.put(x1, y, c)
    def line(s, x0, y0, x1, y1, c):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(n + 1):
            s.put(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n), c)
    def disc(s, cx, cy, r, c):
        for y in range(GH):
            for x in range(GW):
                if math.hypot(x - cx, y - cy) <= r: s.put(x, y, c)
    def ring(s, cx, cy, r, c, w=1):
        for y in range(GH):
            for x in range(GW):
                d = math.hypot(x - cx, y - cy)
                if r - w < d <= r: s.put(x, y, c)
    def bitmap(s, rows, ox, oy, c, shadow=None):
        for yy, row in enumerate(rows):
            for xx, ch in enumerate(row):
                if ch == 'X':
                    if shadow: s.put(ox + xx + 1, oy + yy + 1, shadow)
        for yy, row in enumerate(rows):
            for xx, ch in enumerate(row):
                if ch == 'X': s.put(ox + xx, oy + yy, c)

# ── Symbole (Area = Globus, Delete = Strudel, Discard = Grabkreuz) ─────────
def icon_area(cv, n):
    r = 9.3
    for y in range(GH):
        for x in range(GW):
            dx, dy = x - CX, y - CY
            d = math.hypot(dx, dy)
            if d > r: continue
            if d > r - 1.3: c = NAVY
            else:
                land = (math.sin(dx*0.55 + n) + math.cos(dy*0.5 - dx*0.25 + n*0.7) + 0.4*math.sin(dx*dy*0.05)) > 0.6
                if land: c = DGREEN if (dy > 3 or dx < -4) and (x + y) % 3 == 0 else GREEN
                else: c = LBLUE if (dy < -3 and dx < 0 and (x + y) % 2 == 0) else BLUE
                if d > r - 2.6 and not land: c = BLUE
            cv.put(x, y, c)
    # Glanzpunkt
    cv.put(round(CX - 4), round(CY - 5), (255, 255, 255)); cv.put(round(CX - 3), round(CY - 5), (255, 255, 255))

def icon_delete(cv, n):
    r = 9.5
    for y in range(GH):
        for x in range(GW):
            dx, dy = x - CX, y - CY
            d = math.hypot(dx, dy)
            if d > r: continue
            a = math.atan2(dy, dx)
            ph = (d * 0.32 + a / (2 * math.pi) * (2 if n % 2 else 1)) % 1.0
            if d > r - 1.3: c = VPURPLE
            elif d < 1.8: c = (0, 0, 0)
            elif ph < 0.38: c = PURPLE
            elif ph < 0.52: c = DPURPLE
            else: c = (0, 0, 0)
            cv.put(x, y, c)

GRAVE = [
 "......XXXX......", "......XXXX......", "......XXXX......", "..XXXXXXXXXXXX..", "..XXXXXXXXXXXX..",
 "......XXXX......", "......XXXX......", "......XXXX......", "......XXXX......", "......XXXX......",
 "......XXXX......", "......XXXX......", "....XXXXXXXX....", "..XXXXXXXXXXXX..", ".XXXXXXXXXXXXXX.",
]
def icon_discard(cv, n):
    w, h = len(GRAVE[0]), len(GRAVE)
    ox, oy = round(CX - w / 2 + 0.5), round(CY - h / 2 + 0.5)
    for yy, row in enumerate(GRAVE):
        for xx, ch in enumerate(row):
            if ch == 'X':
                cv.put(ox + xx, oy + yy, GRAVE1 if yy < 9 else (GRAVE2 if yy < 13 else GRAVE3))

ICONS = {'area': icon_area, 'delete': icon_delete, 'discard': icon_discard}

# ── Theme „Zahnrad“ (dunkel): Nietenplatte, Eck-Zahnräder, großes Zahnrad ───
def gear(cv, cx, cy, rb, rt, teeth, col, phase=0.0):
    for y in range(GH):
        for x in range(GW):
            dx, dy = x - cx, y - cy
            d = math.hypot(dx, dy)
            if d <= rb or (d <= rt and math.cos(teeth * (math.atan2(dy, dx) + phase)) > 0.1):
                cv.put(x, y, col)

def rivet(cv, x, y, p):
    cv.put(x, y, p['hi']); cv.put(x + 1, y + 1, p['dk'])

def theme_zahnrad(p, zt, n):
    cv = Canvas(p['dk'])
    cv.rect(2, 2, GW - 3, GH - 3, p['m'])
    cv.frame(2, 2, GW - 3, GH - 3, p['lo'])
    # Plattenfugen mit Fasenlinie, versetzte senkrechte Fugen
    for y in (13, 28):
        for x in range(3, GW - 3): cv.put(x, y, p['dk']); cv.put(x, y + 1, p['hi'])
    for x in (9, 20):
        for y in range(3, 13): cv.put(x, y, p['dk']); cv.put(x + 1, y, p['hi'])
        for y in range(30, GH - 3): cv.put(x, y, p['dk']); cv.put(x + 1, y, p['hi'])
    for x in range(5, GW - 4, 5):
        rivet(cv, x, 11, p); rivet(cv, x, 31, p)
    for y in (6, GH - 8): rivet(cv, 5, y, p); rivet(cv, GW - 7, y, p)
    # Eck-Zahnräder (mit dunkler Kontur, vom Rand angeschnitten)
    for i, (x, y) in enumerate([(2, 2), (GW - 3, 2), (2, GH - 3), (GW - 3, GH - 3)]):
        ph = i * 0.4
        gear(cv, x, y, 5.2, 7.4, 6, p['dk'], ph)
        gear(cv, x, y, 4.2, 6.2, 6, p['hi'], ph)
        cv.disc(x, y, 2.2, p['dk']); cv.disc(x, y, 1.0, p['m'])
    # Großes Zahnrad als Kartusche
    gear(cv, CX, CY, 12.0, 14.2, 12, p['dk'])
    gear(cv, CX, CY, 11.0, 13.2, 12, p['hi'], 0.0)
    cv.ring(CX, CY, 11.4, p['lo'])
    cv.disc(CX, CY, 10.6, p['dk']); cv.disc(CX, CY, 10.0, p['m'])
    if zt in ICONS: ICONS[zt](cv, n)
    else:   # kleines Zahnrad mit Loch
        c = p['hi'] if zt != 'support' else p['dk']
        gear(cv, CX, CY, 4.8, 7.2, 8, c, 0.2)
        cv.disc(CX, CY, 2.4, p['dk'] if zt != 'support' else p['lo']); cv.disc(CX, CY, 1.0, c)
    return cv

# ── Theme „Wellen“ (dunkel): Wasserwellen, Seilrahmen, Bullauge, Anker ───────
ANKER = [
 "....XXX....", "....X.X....", "....XXX....", ".....X.....", "..XXXXXXX..", ".....X.....", ".....X.....",
 ".....X.....", "X....X....X", "XX...X...XX", ".X...X...X.", "..X..X..X..", "...XXXXX...", "....XXX....",
]
def theme_wellen(p, zt, n):
    cv = Canvas(p['dk'])
    for y in range(GH):
        for x in range(GW):
            t = (y + 2.4 * math.sin(x * 0.45 + y * 0.12) + 1.0 * math.sin(x * 0.9 + 2)) % 9
            cv.put(x, y, p['hi'] if t < 1.5 else (p['m'] if t < 5.0 else (p['dk'] if 7.4 <= t < 8.3 else p['lo'])))
            if 1 <= t < 1.6 and (x * 5 + y) % 4 == 0: cv.put(x, y, p['hi'])
    # Seilrahmen
    for y in range(GH):
        for x in range(GW):
            e = min(x, GW - 1 - x, y, GH - 1 - y)
            if e == 0 or e == 3: cv.put(x, y, p['dk'])
            elif e <= 2: cv.put(x, y, p['hi'] if (x + y) % 4 < 2 else p['lo'])
    # Bullauge
    cv.disc(CX, CY, 13.0, p['dk']); cv.disc(CX, CY, 12.0, p['hi']); cv.disc(CX, CY, 10.9, p['lo'])
    cv.disc(CX, CY, 10.4, p['dk']); cv.disc(CX, CY, 10.0, p['m'])
    for k in range(8):
        a = k * math.pi / 4 + math.pi / 8
        cv.put(round(CX + 11.5 * math.cos(a)), round(CY + 11.5 * math.sin(a)), p['dk'])
    if zt in ICONS: ICONS[zt](cv, n)
    else:
        c = p['hi'] if zt != 'support' else p['dk']; sh = p['dk'] if zt != 'support' else p['lo']
        cv.bitmap(ANKER, round(CX) - 5, round(CY) - 7, c, shadow=sh)
    return cv

# ── Theme „Sterne“ (dunkel): Sternenhimmel, Sternbild, Lichterkette, Rosette ──
def star(cv, x, y, r, c):
    for i in range(-r, r + 1):
        cv.put(x + i, y, c); cv.put(x, y + i, c)
    if r >= 2:
        for i in (-1, 1):
            for j in (-1, 1): cv.put(x + i, y + j, c)

def theme_sterne(p, zt, n):
    cv = Canvas(p['m'])
    # Vignette: Dither von m zu lo zu den Rändern
    for y in range(GH):
        for x in range(GW):
            e = min(x, GW - 1 - x, y, GH - 1 - y)
            if e < 6 and (x + y) % 2 == 0 and e > 2: cv.put(x, y, p['lo'])
            elif e <= 2: cv.put(x, y, p['dk'])
            elif e == 3: cv.put(x, y, p['lo'])
            elif e == 4 and (x + y) % 2: cv.put(x, y, p['lo'])
    # Lichterkette im Rand
    for t in range(GW):
        if t % 3 == 0: cv.put(t, 1, p['hi']); cv.put(t, GH - 2, p['hi'])
    for t in range(GH):
        if t % 3 == 0: cv.put(1, t, p['hi']); cv.put(GW - 2, t, p['hi'])
    # Sternbild (gestrichelte Linie zwischen festen Punkten) + Sterne
    pts = [(6, 8), (12, 5), (22, 9), (24, 17), (7, 29), (20, 33), (13, 37)]
    for (a, b) in zip(pts, pts[1:]):
        steps = max(abs(b[0] - a[0]), abs(b[1] - a[1]))
        for i in range(0, steps + 1, 2):
            cv.put(round(a[0] + (b[0] - a[0]) * i / steps), round(a[1] + (b[1] - a[1]) * i / steps), p['lo'])
    for i, (x, y) in enumerate(pts): star(cv, x, y, 2 if i % 2 == 0 else 1, p['hi'])
    rnd = random.Random(n * 1000 + ZONES.index(zt))
    for _ in range(26):
        x, y = rnd.randrange(4, GW - 4), rnd.randrange(4, GH - 4)
        if math.hypot(x - CX, y - CY) > 12: cv.put(x, y, p['hi'] if rnd.random() < .5 else p['lo'])
    # Rosette in der Mitte
    cv.disc(CX, CY, 11.5, p['dk'])
    cv.disc(CX, CY, 10.5, p['lo'])
    cv.disc(CX, CY, 9.6, p['m'] if zt in ICONS else p['lo'])
    for k in range(8):
        a = k * math.pi / 4
        cv.put(round(CX + 11 * math.cos(a)), round(CY + 11 * math.sin(a)), p['hi'])
        cv.put(round(CX + 11 * math.cos(a)) + 0, round(CY + 11 * math.sin(a)) + 1, p['hi'])
    if zt in ICONS: ICONS[zt](cv, n)
    else:
        c = p['hi'] if zt != 'support' else p['dk']
        for k in range(8):   # Acht-Strahlen-Stern
            a = k * math.pi / 4; L = 9 if k % 2 == 0 else 6
            cv.line(round(CX), round(CY), round(CX + L * math.cos(a)), round(CY + L * math.sin(a)), c)
        cv.disc(CX, CY, 2.2, p['dk'] if zt != 'support' else p['lo'])
    return cv

# ── Theme „Kristall“ (hell): Rauten-Facetten, Strahlenlinien, Zierecken ─────
def theme_kristall(p, zt, n):
    pale, bd = p['pale'], p['bd']
    t1, t2, hl = mix(pale, bd, .14), mix(pale, bd, .30), mix(pale, (255, 255, 255), .6)
    cv = Canvas(pale)
    for y in range(GH):
        for x in range(GW):
            dx, dy = abs(x - CX), abs(y - CY)
            ring = int((dx / 1.0 + dy / 1.45) // 4)
            cv.put(x, y, t1 if ring % 2 else pale)
    # radiale Facettenlinien
    for (tx, ty) in [(0, 0), (GW - 1, 0), (0, GH - 1), (GW - 1, GH - 1), (CX, 0), (CX, GH - 1), (0, CY), (GW - 1, CY)]:
        cv.line(round(CX), round(CY), round(tx), round(ty), t2)
    # Rahmen: 2 Zellen, Ecken abgeschnitten, Innenglanz
    for y in range(GH):
        for x in range(GW):
            e = min(x, GW - 1 - x, y, GH - 1 - y)
            if e <= 1: cv.put(x, y, bd)
            elif e == 2: cv.put(x, y, hl)
    for (x0, y0, sx, sy) in [(0, 0, 1, 1), (GW - 1, 0, -1, 1), (0, GH - 1, 1, -1), (GW - 1, GH - 1, -1, -1)]:
        for k in range(4):
            for j in range(4 - k):
                cv.put(x0 + sx * k, y0 + sy * j, (0, 0, 0) if False else bd)
        for k in range(3):
            cv.put(x0 + sx * (4 + k), y0 + sy * 3 if False else y0 + sy * 1, bd)
        # Eckraute
        cv.put(x0 + sx * 5, y0 + sy * 5, bd); cv.put(x0 + sx * 6, y0 + sy * 5, bd); cv.put(x0 + sx * 5, y0 + sy * 6, bd)
        cv.put(x0 + sx * 4, y0 + sy * 4, hl)
    # Mittelkartusche: freie Raute mit Doppelrand
    for y in range(GH):
        for x in range(GW):
            d = abs(x - CX) / 12.5 + abs(y - CY) / 17.5
            if d <= 1.0:
                cv.put(x, y, pale if d < 0.86 else (bd if d > 0.93 else t2))
    if zt in ICONS:
        # Raute etwas aufhellen, damit das Symbol ruhig steht
        ICONS[zt](cv, n)
    else:
        c = bd
        for dy in range(-8, 9):
            w = 8 - abs(dy)
            for dx in range(-w, w + 1):
                edge = (abs(dx) == w)
                cv.put(round(CX) + dx, round(CY) + dy, c if edge else (t2 if (dx + dy) % 3 == 0 else (hl if dy < 0 else t1)))
        cv.line(round(CX) - 8, round(CY), round(CX) + 8, round(CY), c)
        cv.line(round(CX) - 3, round(CY) - 5, round(CX) + 3, round(CY) - 5, c)
    return cv

THEMES = {
    'board3': dict(name='Zahnrad',  fn=theme_zahnrad),
    'board4': dict(name='Wellen',   fn=theme_wellen),
    'board5': dict(name='Sterne',   fn=theme_sterne),
    'board6': dict(name='Kristall', fn=theme_kristall),
}

def zone_img(theme, zt):
    cv = THEMES[theme]['fn'](PAL[zt], zt, int(theme[5:]))
    return [[cv.g[min(GH - 1, y * GH // 170)][x // CELL] for x in range(120)] for y in range(170)]

def preview(theme):
    """Shop-Vorschau im Layout von board1 (halbe Größe: 1830x650)."""
    W, H = 1830, 650; bg = (20, 20, 24, 255)
    P = [[bg] * W for _ in range(H)]
    def blit(img, x0, y0):
        for y in range(85):
            for x in range(60):
                P[y0 + y][x0 + x] = img[y * 2][x * 2]
    z = lambda t: zone_img(theme, t)
    blit(z('area'), 30, 2); blit(z('delete'), 30, 127); blit(z('discard'), 30, 245)
    for g in range(3):
        bx = 130 + g * 248
        for c in range(3):
            if c < 2: blit(z(['surprise', 'hero'][c]), bx + c * 78, 11)
            blit(z('support'), bx + c * 78, 127)
            blit(z('ability'), bx + c * 78, 245)
    blit(z('area'), 930, 2); blit(z('potion'), 930, 127); blit(z('deck'), 930, 245)
    return W, H, P

if __name__ == '__main__':
    for th in THEMES:
        n = th[5:]
        for zt in PAL:
            write_png(f'{OUT}{zt}{n}.png', 120, 170, zone_img(th, zt))
        W, H, P = preview(th)
        write_png(f'{OUT}{th}.png', W, H, P)
        print('ok', th, THEMES[th]['name'])
