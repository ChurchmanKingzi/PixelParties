#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Erzeugt die Shop-Boards board3..board6 (Zonen-Skins + Vorschau).

Die FARBEN je Zonentyp sind gesetzt (aus board1/board2 ausgelesen:
Hero lila, Ability blau, Support gelb, Surprise rot, Potion braun,
Area rot, Delete schwarz/dunkellila, Deck/Discard grau).
Die Themes unterscheiden sich nur im DESIGN: Muster, Rahmen,
Eckornamente und Symbole.
"""
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from board_png import write_png

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'shop', 'boards') + os.sep
GW, GH = 15, 21          # logisches Raster (8-px-Zellen wie bei board1/board2)

def rgb(t): return (t[0], t[1], t[2], 255)

# Feste Paletten (exakt aus den Originalen):
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
# Symbolfarben (aus den Original-Symbolen)
GREEN, DGREEN, BLUE, LBLUE, NAVY = (0,255,1), (0,108,0), (51,133,186), (80,170,255), (14,28,50)
PURPLE, DPURPLE, VPURPLE = (40,0,115), (31,0,88), (55,0,160)
GRAVE1, GRAVE2, GRAVE3 = (193,180,194), (135,120,135), (104,92,104)

def mix(a, b, t): return tuple(int(a[i]*(1-t) + b[i]*t) for i in range(3))

# ── Symbole (Area = Globus, Delete = Strudel, Discard = Grabkreuz) ─────────
def icon_area(theme):
    cells = {}
    r = 5.3
    for y in range(-6, 7):
        for x in range(-6, 7):
            d = math.hypot(x, y)
            if d > r: continue
            if d > r - 1: c = DGREEN if ((x*3 + y*5 + theme) % 4 < 2) else NAVY
            else:
                land = math.sin(x*1.1 + theme) + math.cos(y*0.9 - x*0.4) > 0.5
                c = GREEN if land else (LBLUE if (x + y) % 3 == 0 else BLUE)
            cells[(x, y)] = c
    return cells

def icon_delete(theme):
    cells = {}
    r = 5.6
    for y in range(-6, 7):
        for x in range(-6, 7):
            d = math.hypot(x, y)
            if d > r: continue
            a = math.atan2(y, x)
            ph = (d * 0.55 + a / (2*math.pi) * (2 if theme % 2 else 1)) % 1.0
            if d > r - 1: c = VPURPLE
            elif d < 1: c = (0, 0, 0)
            elif ph < 0.45: c = PURPLE
            elif ph < 0.6: c = DPURPLE
            else: c = (0, 0, 0)
            cells[(x, y)] = c
    return cells

GRAVES = [
 ["....XX....","....XX....","..XXXXXX..","..XXXXXX..","....XX....","....XX....","....XX....","...XXXX...",".XXXXXXXX."],
 ["...XXXX...","..X....X..",".X..XX..X.",".X..XX..X.",".XXXXXXXX.",".X..XX..X.",".X..XX..X.",".X..XX..X.","XXXXXXXXXX"],
 ["....XX....","...XXXX...","....XX....",".XXXXXXXX.","XXXXXXXXXX","....XX....","....XX....","...XXXX...","..XXXXXX.."],
 ["...XXXX...","..XXXXXX..",".XXXXXXXX.",".XX.XX.XX.",".XXXXXXXX.","..XX..XX..","..XXXXXX..","..X.XX.X..","...X..X..."],
]
def icon_discard(theme):
    rows = GRAVES[0]; cells = {}
    h = len(rows); w = len(rows[0])
    for yy, row in enumerate(rows):
        for xx, c in enumerate(row):
            if c == 'X':
                col = GRAVE1 if yy < h//2 else (GRAVE2 if yy < h - 2 else GRAVE3)
                cells[(xx - w//2, yy - h//2)] = col
    return cells

ICONS = {'area': icon_area, 'delete': icon_delete, 'discard': icon_discard}

# ── Muster je Theme: liefert Farbe für Innenzelle (x,y) ────────────────────
def pat_runen(p, x, y):           # diagonale Streifen mit Glanzkante
    s = (x + y) % 6
    if s in (0,): return p['hi']
    if s in (1, 2, 3): return p['m']
    return p['lo']

def pat_schuppen(p, x, y):        # überlappende Fischschuppen (4x3, Reihen versetzt)
    row = (y - 1) // 3
    cx = (x - 1 + (2 if row % 2 else 0)) % 4
    ry = (y - 1) % 3
    tile = (
        (p['lo'], p['m'],  p['m'],  p['lo']),
        (p['lo'], p['hi'], p['hi'], p['lo']),
        (p['m'],  p['m'],  p['m'],  p['m']),
    )
    return tile[ry][cx]

STERNE = [(4, 5), (10, 9), (4, 13), (10, 17), (10, 3), (4, 19)]
def pat_sterne(p, x, y):          # kleine Vier-Strahlen-Sterne auf ruhiger Fläche
    for (sx, sy) in STERNE:
        if (x, y) == (sx, sy): return p['hi']
        if abs(x - sx) + abs(y - sy) == 1: return mix(p['m'], p['hi'], 0.6)
    return p['lo'] if (x * 7 + y * 13) % 11 == 0 else p['m']

def pat_kristall(p, x, y):        # Rautengitter im hellen Stil
    line = ((x + y) % 5 == 0) or ((x - y) % 5 == 0)
    return mix(p['pale'], p['bd'], 0.16) if line else p['pale']

THEMES = {
    'board3': dict(name='Runen',    pat=pat_runen,    light=False, corner='stud'),
    'board4': dict(name='Schuppen', pat=pat_schuppen, light=False, corner='notch'),
    'board5': dict(name='Sterne',   pat=pat_sterne,   light=False, corner='double'),
    'board6': dict(name='Kristall', pat=pat_kristall, light=True,  corner='chamfer'),
}

def zone_img(theme, ztype):
    T = THEMES[theme]; p = PAL[ztype]; n = int(theme[5:])
    light = T['light']
    border = rgb(p['bd']) if light else rgb(p['dk'])
    g = [[None] * GW for _ in range(GH)]
    for y in range(GH):
        for x in range(GW):
            if x in (0, GW-1) or y in (0, GH-1):
                g[y][x] = border
            else:
                g[y][x] = rgb(T['pat'](p, x, y))
    inner = rgb(p['bd']) if light else rgb(p['lo'] if ztype not in ('delete',) else p['m'])
    if not light and ztype == 'support': inner = rgb(p['hi'])
    # Rahmenschmuck
    if T['corner'] == 'stud':            # Eck-Nieten
        for (x, y) in [(1,1),(GW-2,1),(1,GH-2),(GW-2,GH-2)]:
            g[y][x] = rgb(p['hi'] if ztype != 'support' else p['dk'])
    elif T['corner'] == 'notch':         # abgeschrägte Ecken + Innenlinie
        for (x, y) in [(0,0),(GW-1,0),(0,GH-1),(GW-1,GH-1)]:
            g[y][x] = rgb((12, 12, 12)) if False else g[y][x]
        for x in range(2, GW-2): g[1][x] = inner; g[GH-2][x] = inner
    elif T['corner'] == 'double':        # doppelter Rahmen
        for x in range(1, GW-1): g[1][x] = inner; g[GH-2][x] = inner
        for y in range(1, GH-1): g[y][1] = inner; g[y][GW-2] = inner
    elif T['corner'] == 'chamfer':       # abgeschnittene Ecken, heller Innenrand
        for (x, y) in [(1,1),(GW-2,1),(1,GH-2),(GW-2,GH-2)]:
            g[y][x] = border
        for (x, y) in [(2,1),(1,2),(GW-3,1),(GW-2,2),(2,GH-2),(1,GH-3),(GW-3,GH-2),(GW-2,GH-3)]:
            g[y][x] = rgb(mix(p['pale'], p['bd'], 0.5))
    # Symbole (Zentrum)
    if ztype in ICONS:
        for (dx, dy), c in ICONS[ztype](n).items():
            x, y = GW//2 + dx, GH//2 + dy
            if 0 < x < GW-1 and 0 < y < GH-1: g[y][x] = rgb(c)
    return [[g[y*GH//170][x//8] for x in range(120)] for y in range(170)]

def preview(theme):
    """Shop-Vorschau im Layout von board1 (halbe Größe: 1830x650)."""
    W, H = 1830, 650; bg = (20, 20, 24, 255)
    P = [[bg] * W for _ in range(H)]
    def blit(img, x0, y0):
        for y in range(85):
            for x in range(60):
                P[y0+y][x0+x] = img[y*2][x*2]
    z = lambda t: zone_img(theme, t)
    blit(z('area'), 30, 2); blit(z('delete'), 30, 127); blit(z('discard'), 30, 245)
    for g in range(3):
        bx = 130 + g*248
        for c in range(3):
            if c < 2: blit(z(['surprise', 'hero'][c]), bx + c*78, 11)
            blit(z('support'), bx + c*78, 127)
            blit(z('ability'), bx + c*78, 245)
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
