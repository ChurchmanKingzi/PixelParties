# -*- coding: utf-8 -*-
"""Booster-Pack-Entwürfe (9 Packs x bis zu 8 Varianten) als Pixelart rendern.

Aufruf:  python3 scripts/booster/build_boosters.py [pack-id ...]  [--out DIR]
Ausgabe (Standard public/boosters/):
  <pack>/<pack>-<n>.png          Pack 192x320, geprägt (Emboss), Foil-Muster, Funkelsterne
  <pack>/<pack>-<n>.shimmer.png  Schimmer-Overlay: 16 Bilder nebeneinander, nur die veränderten Pixel (harte Alpha); über das Pack legen
  boosters.json                  Manifest (Größe, Bildzahl, Takt, Packs, Varianten, Motive)
Alle Farben sind Farben aus data/palette.json (pal.snap), keine Weichzeichnung, keine Drehung, Dithering statt Alpha.
"""
import colorsys, json, math, os, sys
import numpy as np
from PIL import Image
import catalog as C
import designs as D
import gfx as G
import pal
from gfx import W, H, XX, YY, BAY

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
NF = 16          # Schimmer-Bilder
FRAME_MS = 60

# Layout (Pixel auf dem 192x320-Canvas)
PLATE = (3, 24, 189, 86)
FRAME = (8, 92, 184, 248)
RIBBON = (4, 254, 188, 298)
IX0, IY0, IX1, IY1 = 13, 97, 179, 243          # Innenfläche des Kunstrahmens (166 x 146)
IW, IH = IX1 - IX0, IY1 - IY0
CRIMP = 18


# ---------------------------------------------------------------- Bilder
_score_cache = {}


def art_score(name):
    if name in _score_cache:
        return _score_cache[name]
    a = C.art(name)
    s = -1.0
    if a is not None and 70 <= a.width <= 80 and 48 <= a.height <= 56:
        x = np.asarray(a.convert('RGB')).astype(float)
        sat = (x.max(2) - x.min(2)).mean()
        ed = np.abs(np.diff(x, axis=1)).mean() + np.abs(np.diff(x, axis=0)).mean()
        lum = x.mean(2)
        dark = (lum < 40).mean()
        s = sat * 0.7 + min(ed, 34) + min(lum.std(), 60) * 0.5
        if not 60 <= lum.mean() <= 200:
            s -= 25
        s -= dark * 60
        t = (C.BY_NAME.get(name) or {}).get('cardType', '')
        s += {'Hero': 30, 'Ascended Hero': 30, 'Creature': 18, 'Artifact': 8}.get(t, 0)
    _score_cache[name] = s
    return s


def pick_art(setcode, k, used):
    names = [c['name'] for c in C.CARDS if C.norm_set(c['setID']) == setcode and 'Token' not in c['cardType']]
    names = [n for n in names if art_score(n) > 0 and n not in used]
    names.sort(key=lambda n: -art_score(n))
    if not names:
        return None
    n = names[k % min(len(names), 12)] if len(names) > 1 else names[0]
    used.add(n)
    return n


def resolve_art(name, pack, used, min_score=22):
    """Fehlt die Kunst oder ist sie zu dunkel/flach, nimmt der Cover die beste noch freie Karte des Packs."""
    if name and art_score(name) >= min_score:
        used.add(name)
        return name
    pool = [c['name'] for c in C.cards_of(pack) if c['name'] not in used and art_score(c['name']) >= min_score]
    pool.sort(key=lambda n: -art_score(n))
    n = pool[0] if pool else name
    used.add(n)
    return n


def load_sprite(ref):
    if ref.startswith('file:'):
        im = Image.open(ref[5:]).convert('RGBA')
    else:
        im = C.hero_sprite(ref)
    return G.trim(im) if im is not None else None


def fit_scale(im, maxw, maxh, kmax=6):
    return max(1, min(kmax, maxw // im.width, maxh // im.height))


# ---------------------------------------------------------------- Pack-Bausteine
def make_background(P, th, seed):
    P.rgb = G.gradient(th['grad'], amp=30).copy()
    P.wt[:] = 0.5
    pm = G.pattern_mask(th['pat'], seed)
    # Muster in zwei Tönen: heller und (um 1 Pixel versetzt) dunkler -> geprägter Look
    P.tint(pm, (255, 255, 255), 0.28, wt=0.9)
    P.tint(G.shift(pm, 1, 1) & ~pm, (0, 0, 0), 0.30)
    # Glanzstreifen (diagonal, hart gedithert)
    u = XX * 0.8 + YY * 0.6
    for c0, wdt, k in ((62, 8, 0.20), (84, 3, 0.14), (210, 14, 0.12), (232, 4, 0.10)):
        band = np.abs(u - c0) < wdt
        edge = np.abs(u - c0) < wdt + 3
        P.tint(band | (edge & (BAY < 0.5)), (255, 255, 255), k, wt=0.9)
    # Kantenabdunklung (Vignette in 2 harten Stufen)
    v1 = (XX < 4) | (XX >= W - 4)
    P.tint(v1, (0, 0, 0), 0.25)


def make_crimps(P, th, mt):
    light, mid, dark, outl, glanz = mt
    for top in (True, False):
        y0, y1 = (0, CRIMP) if top else (H - CRIMP, H)
        reg = (YY >= y0) & (YY < y1)
        col = np.zeros((H, W, 3))
        ph = (XX % 4)
        col[ph == 0] = dark; col[ph == 1] = mid; col[ph == 2] = light; col[ph == 3] = mid
        # Querverlauf: zur Packmitte hin heller
        P.paint(reg, col, wt=0.9)
        # Kante zur Packfläche: Wulst
        edge_rows = [y1 - 1, y1 - 2, y1 - 3] if top else [y0, y0 + 1, y0 + 2]
        cols = [outl, dark, light] if top else [outl, dark, light]
        for r, c in zip(edge_rows, cols):
            P.paint((YY == r), c, wt=0.9)
        P.tint(reg & (YY == (y1 - 4 if top else y0 + 3)), (255, 255, 255), 0.35)
    # Außenkontur des Körpers
    edge = P.body & ~G.erode(P.body, 1)
    P.paint(edge, pal.darken(mt[3], 0.4), wt=0.3)
    P.bevel(P.body, hl=0.28, sh=0.35)


def title_lines(pack):
    l1, l2 = D.TITLES[pack]
    return l1, l2


def draw_title(P, th, mt, pack):
    plate_mask = G.chamfer_mask(*PLATE, 6)
    G.plate(P, plate_mask, pal.hexrgb(th['plate'][0]), pal.hexrgb(th['plate'][1]), mt, thick=4)
    # Strahlenglanz in der Platte (zwei Diagonalen, hart)
    inner = plate_mask & G.erode(plate_mask, 5)
    u = XX * 1.0 + YY * 0.5
    P.tint(inner & ((np.abs(u - 110) < 5) | (np.abs(u - 140) < 2)), (255, 255, 255), 0.10, wt=0.9)
    gold = G.metal('gold')
    l1, l2 = title_lines(pack)
    import pxfont
    def sc(s):
        return 3 if pxfont.text_mask(s, scale=3, spacing=0).shape[1] <= 152 else 2
    s1, s2 = sc(l1), sc(l2)
    h1, h2 = 7 * s1, 7 * s2
    gap = 6
    total = h1 + gap + h2
    cy = (PLATE[1] + PLATE[3]) // 2
    ytop = cy - total // 2 + 1
    cx = W // 2
    G.draw_text(P, l1, cx, ytop, s1, mt=gold, outline=2, shadow=2)
    G.draw_text(P, l2, cx, ytop + h1 + gap, s2, mt=gold, outline=2, shadow=3 if s2 == 3 else 2)
    return (ytop, ytop + total)


RARITY_PIPS = ['#929292', '#e8ecf2', '#44d888', '#4cc8f0', '#4a7ae8', '#a070f0', '#ff4aa8', '#fad54a', '#8ce1ff']


def draw_pip(P, cx, cy, col):
    # kleiner Edelstein 7x7: Raute mit heller Facette und dunkler Kante
    m = (np.abs(XX - cx) + np.abs(YY - cy)) <= 3
    P.shadow(m, 1, 1, 0.5)
    c = pal.snap1(col)
    P.paint(m, c, wt=1.0)
    P.paint(m & (XX <= cx) & (YY <= cy) & ((np.abs(XX - cx) + np.abs(YY - cy)) <= 2), pal.lighten(c, 0.55), wt=1.0)
    P.paint(m & (XX >= cx) & (YY >= cy) & ((np.abs(XX - cx) + np.abs(YY - cy)) >= 2), pal.darken(c, 0.35), wt=1.0)
    P.paint(m & ((np.abs(XX - cx) + np.abs(YY - cy)) == 3), pal.darken(c, 0.62), wt=0.6)
    P.paint((XX == cx - 1) & (YY == cy - 1), (255, 255, 255), wt=1.0)


def draw_ribbon(P, th, mt):
    mask = G.chamfer_mask(*RIBBON, 5)
    G.plate(P, mask, pal.hexrgb(th['plate'][0]), pal.hexrgb(th['plate'][1]), mt, thick=4)
    gold = G.metal('gold')
    x0, y0, x1, y1 = RIBBON
    # „9“ in einer Münzplakette links
    bx, by = x0 + 20, y0 + 17
    P.shadow(((XX - bx) ** 2 + (YY - by) ** 2) <= 14 ** 2, 2, 2, 0.55)
    medallion(P, bx, by, 14, mt)
    # Text rechts
    tx = (x0 + 40 + x1 - 10) // 2
    G.draw_text(P, 'Rarity Skins', tx, y0 + 8, 1, mt=gold, outline=1, shadow=1)
    G.draw_text_flat(P, 'for your Collection!', tx, y0 + 21, pal.snap1('#ffffff'), mt=mt, spacing=0)
    # Seltenheitsleiter: 9 Edelsteine
    n = 9
    span = 150
    for i in range(n):
        px = int(round(x0 + 12 + span * i / (n - 1) + 8 + 6))
        draw_pip(P, x0 + 20 + int(round((x1 - x0 - 40) * i / (n - 1))), y0 + 36, RARITY_PIPS[i])


def draw_frame_window(P, mt):
    m = G.chamfer_mask(*FRAME, 3)
    inner = G.frame(P, m, mt, thick=5, wt=1.0)
    return inner


def sparkle_plan(seed, n_logo=7, n_art=9):
    rng = np.random.RandomState(seed)
    sp = []
    for (x, y) in ((14, 34), (178, 35), (20, 77), (171, 78), (96, 29), (152, 29), (48, 82)):
        sp.append((x, y, int(rng.choice([2, 3, 4])), float(rng.rand())))
    for (x, y) in ((FRAME[0] + 2, FRAME[1] + 2), (FRAME[2] - 3, FRAME[1] + 2), (FRAME[0] + 2, FRAME[3] - 3), (FRAME[2] - 3, FRAME[3] - 3)):
        sp.append((x, y, 4, float(rng.rand())))
    for _ in range(n_art):
        sp.append((int(rng.randint(IX0 + 6, IX1 - 6)), int(rng.randint(IY0 + 6, IY1 - 6)), int(rng.choice([2, 3, 3, 4])), float(rng.rand())))
    for _ in range(3):
        sp.append((int(rng.randint(14, W - 14)), int(rng.randint(RIBBON[1] + 2, RIBBON[3] - 2)), 2, float(rng.rand())))
    return sp


# ---------------------------------------------------------------- Kunst-Vorlagen
def art_burst(P, th, rot=0.0):
    inner = np.zeros((H, W), bool)
    inner[IY0:IY1, IX0:IX1] = True
    c1, c2, gl = [pal.hexrgb(c) for c in th['burst']]
    col = G.burst((IX0, IY0, IX1, IY1), c1, c2, gl, rays=14, rot=rot)
    P.paint(inner, col, wt=0.35)
    # ein dunkler Ring am Rand (Tiefe)
    P.tint(inner & ~G.erode(inner, 2), (0, 0, 0), 0.35)
    return inner


def art_particles(P, th, seed, n=16):
    """Schwebende Pixel-Funken und Rauten in der Kunstfläche (unter den Motiven)."""
    rng = np.random.RandomState(seed + 7)
    tint = pal.hexrgb(th['tint'])
    for i in range(n):
        x = int(rng.randint(IX0 + 5, IX1 - 5)); y = int(rng.randint(IY0 + 5, IY1 - 5))
        if i % 3 == 0:
            m = (np.abs(XX - x) + np.abs(YY - y)) <= 2
            P.paint(m, tint, wt=1.0)
            P.paint((np.abs(XX - x) + np.abs(YY - y)) <= 0, (255, 255, 255), wt=1.0)
        else:
            G.star(P.rgb, x, y, 1 + (i % 2), tint)
            P.wt[y - 1:y + 2, x - 1:x + 2] = 1.0


def corner_gems(P, th, mt):
    x0, y0, x1, y1 = FRAME
    gem = pal.snap1(th['tint'])
    for (cx, cy) in ((x0 + 3, y0 + 3), (x1 - 4, y0 + 3), (x0 + 3, y1 - 4), (x1 - 4, y1 - 4)):
        m = (np.abs(XX - cx) + np.abs(YY - cy)) <= 5
        P.shadow(m, 1, 1, 0.5)
        P.paint(m, mt[3], wt=1.0)
        P.paint((np.abs(XX - cx) + np.abs(YY - cy)) <= 4, mt[0], wt=1.0)
        P.paint((np.abs(XX - cx) + np.abs(YY - cy)) <= 3, mt[1], wt=1.0)
        P.paint((np.abs(XX - cx) + np.abs(YY - cy)) <= 2, pal.mix(gem, mt[1], 0.35), wt=1.0)
        P.paint((np.abs(XX - cx) + np.abs(YY - cy)) <= 1, (255, 255, 255), wt=1.0)


def sprite_k(im, maxw, maxh, kmax=6):
    return fit_scale(im, maxw, maxh, kmax)


def place_sprite(P, ref, cx, base_y, maxw, maxh, kmax=6, outline='#140806', shadow=True):
    im = load_sprite(ref)
    if im is None:
        return None
    k = sprite_k(im, maxw, maxh, kmax)
    s = G.scaled(im, k)
    x = int(cx - s.width // 2)
    y = int(base_y - s.height)
    if shadow:
        G.ground_shadow(P, cx, base_y - 1, s.width // 2 + 4, 5)
    G.blit(P, s, x, y, wt=0.15, outline=pal.snap1(outline))
    return (x, y, s.width, s.height)


def tile_image(name, tw, th_):
    """Kachelausschnitt einer Kartenkunst: 1x oder 2x je nach Kachelgröße."""
    a = C.art(name)
    if a is None:
        return None
    k = 2 if (tw > a.width or th_ > a.height) else 1
    big = G.scaled(a, k)
    return G.crop_center(big, min(tw, big.width), min(th_, big.height), 0.5, 0.45)


def draw_tile(P, im, x, y, w, h, mt, stamp=None, wt=0.2):
    m = G.rect_mask(x, y, x + w, y + h)
    G.blit(P, im, x, y, wt=wt)
    ring = G.dilate(m, 1) & ~m
    P.paint(ring, mt[3], wt=0.6)
    P.bevel(m, hl=0.22, sh=0.3)
    # Innenkante: Prägung (oben/links dunkel, unten/rechts hell) -> wirkt eingelassen
    tl = m & ~(G.shift(m, 1, 0) & G.shift(m, 0, 1))
    br = m & ~(G.shift(m, -1, 0) & G.shift(m, 0, -1)) & ~tl
    P.rgb[tl & P.body] *= 0.6
    P.rgb[br & P.body] = pal.mix(P.rgb[br & P.body], (255, 255, 255), 0.25)
    if stamp:
        tw = 7 * len(stamp)
        sx, sy = x + 2, y + h - 10
        chip = G.rect_mask(sx - 1, sy - 1, sx + tw, sy + 9)
        P.paint(chip, pal.darken(mt[3], 0.3), wt=0.5)
        P.paint(G.dilate(chip, 1) & ~chip, mt[0], wt=1.0)
        G.draw_text_flat(P, stamp, sx + tw // 2 - 0, sy + 1, pal.snap1('#fad54a'), mt=mt)


def grid_layout(n):
    rows = {3: [3], 4: [2, 2], 5: [3, 2], 9: [3, 3, 3], 12: [3, 3, 3, 3]}[n]
    gut = 2
    rh = (IH - gut * (len(rows) - 1)) // len(rows)
    rects = []
    y = IY0
    for r, cnt in enumerate(rows):
        cw = (IW - gut * (cnt - 1)) // cnt
        extra = IW - gut * (cnt - 1) - cw * cnt
        x = IX0
        for c in range(cnt):
            w = cw + (1 if c < extra else 0)
            rects.append((x, y, w, rh if r < len(rows) - 1 else IY1 - y))
            x += w + gut
        y += rh + gut
    return rects


def medallion(P, cx, cy, r, mt):
    gold = G.metal('gold')
    for rr, col in ((r, gold[3]), (r - 1, gold[1]), (r - 3, gold[0]), (r - 5, gold[2]), (r - 7, gold[1])):
        m = ((XX - cx) ** 2 + (YY - cy) ** 2) <= rr * rr
        P.paint(m, col, wt=1.0)
    G.draw_text(P, '9', cx, cy - 10, 3, mt=gold, outline=1, shadow=1)


def tpl_grid(P, th, mt, tiles, stamps=None, with_medal=False, v=0, pack=None):
    used = set()
    tiles = [resolve_art(t, pack, used) if pack else t for t in tiles]
    n = len(tiles) + (1 if with_medal else 0)
    rects = grid_layout(n)
    inner = np.zeros((H, W), bool); inner[IY0:IY1, IX0:IX1] = True
    P.paint(inner, pal.darken(pal.hexrgb(th['grad'][2][1]), 0.6), wt=0.3)
    ti = 0
    for i, (x, y, w, h) in enumerate(rects):
        if with_medal and i == len(rects) - 2 - (0):
            medal_idx = i
        if with_medal and i == 10:
            # Münzplakette in der vorletzten Kachel
            m = G.rect_mask(x, y, x + w, y + h)
            c1, c2, gl = [pal.hexrgb(c) for c in th['burst']]
            P.paint(m, G.burst((x, y, x + w, y + h), c1, c2, gl, rays=10, rot=0.4, glow_r=0.8), wt=0.4)
            P.paint(G.dilate(m, 1) & ~m, mt[3], wt=0.6)
            medallion(P, x + w // 2, y + h // 2, 15, mt)
            continue
        name = tiles[ti]; ti += 1
        im = tile_image(name, w, h)
        if im is None:
            continue
        draw_tile(P, im, x, y, w, h, mt, stamp=(stamps[ti - 1] if stamps else None))
    return tiles


def tpl_mosaic(P, th, mt, pack, v):
    sets = D.MOSAIC_SETS[pack]
    used = set()
    names, stamps = [], []
    for s in sets:
        n = pick_art(s, v, used)
        if n is None:
            n = pick_art(s, 0, set())
        names.append(n); stamps.append(D.STAMP.get(s, s))
    if len(names) == 11:
        names = names[:10] + [names[10]]
        # 12. Kachel (Index 10) = Münzplakette, die letzte Kunstkachel steht an Index 11
        tiles = names[:10] + ['__medal__', names[10]]
        sts = stamps[:10] + [None, stamps[10]]
        rects = grid_layout(12)
        inner = np.zeros((H, W), bool); inner[IY0:IY1, IX0:IX1] = True
        P.paint(inner, pal.darken(pal.hexrgb(th['grad'][2][1]), 0.6), wt=0.3)
        for (x, y, w, h), nm, st in zip(rects, tiles, sts):
            if nm == '__medal__':
                m = G.rect_mask(x, y, x + w, y + h)
                c1, c2, gl = [pal.hexrgb(c) for c in th['burst']]
                P.paint(m, G.burst((x, y, x + w, y + h), c1, c2, gl, rays=10, rot=0.4, glow_r=0.8), wt=0.4)
                P.paint(G.dilate(m, 1) & ~m, mt[3], wt=0.6)
                medallion(P, x + w // 2, y + h // 2, 15, mt)
                continue
            im = tile_image(nm, w, h)
            if im is not None:
                draw_tile(P, im, x, y, w, h, mt, stamp=st)
    else:
        rects = grid_layout(len(names))
        inner = np.zeros((H, W), bool); inner[IY0:IY1, IX0:IX1] = True
        P.paint(inner, pal.darken(pal.hexrgb(th['grad'][2][1]), 0.6), wt=0.3)
        for (x, y, w, h), nm, st in zip(rects, names, stamps):
            im = tile_image(nm, w, h)
            if im is not None:
                draw_tile(P, im, x, y, w, h, mt, stamp=st)
    return names


def tpl_hero(P, th, mt, hero, window=None):
    art_burst(P, th, rot=0.2)
    art_particles(P, th, 11)
    r = place_sprite(P, hero, IX0 + IW // 2, IY1 - 22, 150, 128, kmax=6)
    # Namens-Chip am unteren Rand der Fläche
    nm = hero if len(hero) <= 22 else hero.split(',')[0]
    nm = nm.replace('Cool Rescuer Monia', 'Cool Rescuer Monia')
    wtxt = 7 * len(nm)
    cx = IX0 + IW // 2
    chip = G.chamfer_mask(cx - wtxt // 2 - 6, IY1 - 20, cx + wtxt // 2 + 6, IY1 - 4, 3)
    P.paint(chip, pal.darken(pal.hexrgb(th['plate'][1]), 0.0), wt=0.5)
    P.paint(G.dilate(chip, 1) & ~chip, mt[0], wt=1.0)
    P.paint(G.dilate(chip, 2) & ~G.dilate(chip, 1), mt[3], wt=0.6)
    G.draw_text_flat(P, nm, cx, IY1 - 16, pal.snap1('#fad54a'), mt=mt)
    return [hero]


def tpl_stage(P, th, mt, window, sprites, pack=None):
    window = resolve_art(window, pack, set()) if pack else window
    art_burst(P, th, rot=0.5)
    art_particles(P, th, 23)
    a = C.art(window)
    ax, ay = IX0 + (IW - 152) // 2, IY0 + 6
    if a is not None:
        im = G.scaled(a, 2)
        im = G.crop_center(im, 152, 102)
        m = G.rect_mask(ax, ay, ax + 152, ay + 102)
        P.shadow(m, 3, 3, 0.55)
        G.blit(P, im, ax, ay, wt=0.2)
        ring = G.dilate(m, 2) & ~m
        P.paint(ring, mt[3], wt=0.6)
        P.paint(G.dilate(m, 3) & ~G.dilate(m, 2), mt[0], wt=1.0)
        P.paint(G.dilate(m, 4) & ~G.dilate(m, 3), mt[3], wt=0.6)
        P.bevel(m, hl=0.0, sh=0.0)
    cx = IX0 + IW // 2
    base = IY1 - 4
    # Mitte größer (steht vorn), die Seiten kleiner und leicht nach hinten versetzt
    order = [(sprites[0], cx - 52, 4, 62, 84, base - 3), (sprites[2], cx + 52, 4, 62, 84, base - 3), (sprites[1], cx, 4, 80, 118, base)]
    for ref, x, kmax, mw, mh, by in order:
        place_sprite(P, ref, x, by, mw, mh, kmax=kmax)
    return [window] + sprites


def tpl_focus(P, th, mt, big, tiles, pack=None):
    used = set([big]); tiles = [resolve_art(t, pack, used, 10) if pack else t for t in tiles]
    art_burst(P, th, rot=0.9)
    art_particles(P, th, 31, 10)
    a = C.art(big)
    ax, ay = IX0 + (IW - 152) // 2, IY0 + 5
    im = G.crop_center(G.scaled(a, 2), 152, 102)
    m = G.rect_mask(ax, ay, ax + 152, ay + 102)
    P.shadow(m, 3, 3, 0.55)
    G.blit(P, im, ax, ay, wt=0.2)
    P.paint(G.dilate(m, 2) & ~m, mt[3], wt=0.6)
    P.paint(G.dilate(m, 3) & ~G.dilate(m, 2), mt[0], wt=1.0)
    P.paint(G.dilate(m, 4) & ~G.dilate(m, 3), mt[3], wt=0.6)
    # Name der Ability als Chip über der Kunst
    wtxt = 7 * len(big)
    cx = ax + 76
    chip = G.chamfer_mask(cx - wtxt // 2 - 6, ay + 102 - 8, cx + wtxt // 2 + 6, ay + 102 + 8, 3)
    P.paint(chip, pal.hexrgb(th['plate'][0]), wt=0.5)
    P.paint(G.dilate(chip, 1) & ~chip, mt[0], wt=1.0)
    P.paint(G.dilate(chip, 2) & ~G.dilate(chip, 1), mt[3], wt=0.6)
    G.draw_text_flat(P, big, cx, ay + 102 - 4, pal.snap1('#fad54a'), mt=mt)
    # drei kleine Kacheln darunter
    ty = ay + 102 + 12
    tw = 50; th_ = IY1 - 3 - ty
    gap = (IW - 3 * tw) // 4
    for i, n in enumerate(tiles):
        x = IX0 + gap + i * (tw + gap)
        im2 = tile_image(n, tw, th_)
        if im2 is not None:
            draw_tile(P, im2, x, ty, tw, th_, mt)
    return [big] + tiles


# ---------------------------------------------------------------- Pack-Rendern
def render_pack(pack, vi, template, theme, content):
    th = D.THEMES[theme]
    mt = G.metal(th['metal'])
    P = G.Pack()
    seed = hash((pack, vi)) % 100000
    seed = sum(ord(c) for c in pack) * 31 + vi * 17
    make_background(P, th, seed)
    draw_title(P, th, mt, pack)
    inner = draw_frame_window(P, mt)
    subjects = []
    if template == 'mosaic':
        subjects = tpl_mosaic(P, th, mt, pack, vi)
    elif template == 'grid':
        subjects = tpl_grid(P, th, mt, content['tiles'], v=vi, pack=pack)
    elif template == 'hero':
        subjects = tpl_hero(P, th, mt, content['hero'], content.get('window'))
    elif template == 'stage':
        subjects = tpl_stage(P, th, mt, content['window'], content['sprites'], pack=pack)
    elif template == 'focus':
        subjects = tpl_focus(P, th, mt, content['big'], content['tiles'], pack=pack)
    corner_gems(P, th, mt)
    draw_ribbon(P, th, mt)
    make_crimps(P, th, mt)
    sparks = sparkle_plan(seed)
    # feste Sterne im Standbild (jeder dritte, klein)
    for i, (x, y, r, ph) in enumerate(sparks):
        if i >= 7 and i % 3 == 0:
            G.star(P.rgb, x, y, 2, pal.hexrgb(th['tint']))
    base = P.finish()
    return base, P.wt.copy(), sparks, th, subjects


# ---------------------------------------------------------------- Schimmer
def hsv_to_rgb(h, s, v):
    i = np.floor(h * 6).astype(int) % 6
    f = h * 6 - np.floor(h * 6)
    p = v * (1 - s); q = v * (1 - f * s); t = v * (1 - (1 - f) * s)
    r = np.choose(i, [v, q, p, p, t, v]); g = np.choose(i, [t, v, v, q, p, p]); b = np.choose(i, [p, p, t, v, v, q])
    return np.stack([r, g, b], -1) * 255


def shimmer_frames(base, wt, sparks, th, nf=NF):
    rgb = base[..., :3].astype(float)
    body = base[..., 3] > 0
    u = XX * 0.8 + YY * 0.6
    lo, hi = -70, u.max() + 70
    frames = []
    tint = pal.hexrgb(th['tint'])
    for f in range(nf):
        c = lo + (hi - lo) * f / (nf - 1)
        d = u - c
        prof = np.where(np.abs(d) < 7, 1.0, np.where(np.abs(d) < 17, 0.66, np.where(np.abs(d) < 32, 0.3, 0.0)))
        d2 = u - (c - 84)
        prof = np.maximum(prof, np.where(np.abs(d2) < 6, 0.5, np.where(np.abs(d2) < 12, 0.2, 0.0)))
        lvl = prof * (0.45 + 0.55 * wt) + (BAY - 0.5) * 0.30
        a = np.clip(lvl, 0, 1) * (prof > 0.08)
        a = np.floor(a * 4) / 4                          # harte Stufen
        out = rgb.copy()
        if th['prism']:
            hue = ((d / 46.0) % 1.0)
            pr = hsv_to_rgb(hue, np.full_like(hue, 0.6), np.full_like(hue, 1.0))
            out = pal.mix(out, pr, (np.clip(a * 1.1, 0, 1) * 0.85)[..., None])
            out = pal.mix(out, (255, 255, 255), (np.clip(a - 0.5, 0, 1) * 0.9)[..., None])
        else:
            out = pal.mix(out, tint, (a * 0.55)[..., None])
            out = pal.mix(out, (255, 255, 255), (a * 0.75)[..., None])
        out[~(a > 0)] = rgb[~(a > 0)]
        snapped = pal.snap(out)
        changed = body & np.any(snapped != base[..., :3], -1)
        # Funkeln
        sp = snapped.astype(float)
        for (x, y, rmax, ph) in sparks:
            r = G.twinkle_r(ph, f, nf, rmax)
            G.star(sp, x, y, r, tint)
        sp = pal.snap(sp)
        changed = body & np.any(sp != base[..., :3], -1)
        fr = np.zeros((H, W, 4), np.uint8)
        fr[..., :3] = sp
        fr[..., 3] = np.where(changed, 255, 0)
        fr[~changed, :3] = 0
        frames.append(fr)
    return np.concatenate(frames, axis=1)


# ---------------------------------------------------------------- Hauptprogramm
def main(argv):
    out = os.path.join(ROOT, 'public', 'boosters')
    packs = []
    args = list(argv)
    if '--out' in args:
        i = args.index('--out'); out = args[i + 1]; del args[i:i + 2]
    only = set(args)
    manifest = {'version': 1, 'size': [W, H], 'frames': NF, 'frameMs': FRAME_MS, 'tagline': '9 Rarity Skins for your Collection!', 'packs': []}
    order = ['ability', 'hero', 'clash', 'monia', 'future', 'world1', 'world2', 'community', 'trials']
    for pack in order:
        if only and pack not in only:
            continue
        pdir = os.path.join(out, pack)
        os.makedirs(pdir, exist_ok=True)
        entry = {'id': pack, 'name': D.TITLE_FULL[pack], 'tagline': manifest['tagline'], 'variants': []}
        for vi, (tpl, theme, content) in enumerate(D.VARIANTS[pack]):
            base, wt, sparks, th, subjects = render_pack(pack, vi, tpl, theme, content)
            vid = '%s-%d' % (pack, vi + 1)
            Image.fromarray(base, 'RGBA').save(os.path.join(pdir, vid + '.png'), optimize=True)
            strip = shimmer_frames(base, wt, sparks, th)
            Image.fromarray(strip, 'RGBA').save(os.path.join(pdir, vid + '.shimmer.png'), optimize=True)
            entry['variants'].append({'id': vid, 'theme': th['name'], 'template': tpl, 'prism': th['prism'],
                                      'base': '%s/%s.png' % (pack, vid), 'shimmer': '%s/%s.shimmer.png' % (pack, vid),
                                      'motifs': [s for s in subjects if isinstance(s, str) and not s.startswith('file:')]})
            print('ok', vid, theme, tpl)
        manifest['packs'].append(entry)
    mp = os.path.join(out, 'boosters.json')
    if only and os.path.exists(mp):
        # Teillauf: übrige Packs aus dem bestehenden Manifest behalten
        old = {p['id']: p for p in json.load(open(mp, encoding='utf-8')).get('packs', [])}
        new = {p['id']: p for p in manifest['packs']}
        manifest['packs'] = [new.get(i) or old[i] for i in order if i in new or i in old]
    with open(mp, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main(sys.argv[1:])
