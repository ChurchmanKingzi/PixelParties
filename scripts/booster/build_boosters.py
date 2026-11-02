# -*- coding: utf-8 -*-
"""Booster-Pack-Entwürfe (9 Packs x bis zu 8 Varianten) als Pixelart rendern.

Aufruf:  python3 scripts/booster/build_boosters.py [pack-id ...]  [--out DIR]
Ausgabe (Standard public/boosters/):
  <pack>/<pack>-<n>.png          Pack 192x320, geprägt (Emboss), Foil-Muster, Funkelsterne
  <pack>/<pack>-<n>.shimmer.png  Schimmer-Overlay: 16 Bilder nebeneinander, nur die veränderten Pixel (harte Alpha); über das Pack legen
  boosters.json                  Manifest (Größe, Bildzahl, Takt, Packs, Varianten, Motive)
Alle selbst gezeichneten Farben sind Farben aus data/palette.json (pal.snap); 1:1 übernommene Kartenkunst und Sprites behalten ihre Originalfarben.
Keine Weichzeichnung, keine Drehung, Dithering statt Alpha.
"""
import colorsys, json, math, os, sys
import numpy as np
from PIL import Image
import catalog as C
import crops
import designs as D
import gfx as G
import pal
from gfx import W, H, XX, YY, BAY

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
NF = 16          # Schimmer-Bilder
FRAME_MS = 60

# Layout (Pixel auf dem 192x320-Canvas)
PLATE = (3, 22, 189, 88)
FRAME = (8, 92, 184, 248)
RIBBON = (4, 254, 188, 298)       # Innenfläche y 258..293, Mitte 275.5
IX0, IY0, IX1, IY1 = 13, 97, 179, 243          # Innenfläche des Kunstrahmens (166 x 146)
IW, IH = IX1 - IX0, IY1 - IY0
CRIMP = 18


# ---------------------------------------------------------------- Bilder
_score_cache = {}


def art_score(name, wide=False):
    if (name, wide) in _score_cache:
        return _score_cache[(name, wide)]
    a = C.art(name)
    s = -1.0
    if a is not None and ((70 <= a.width <= 80 and 48 <= a.height <= 56) or (wide and 148 <= a.width <= 156 and 98 <= a.height <= 106)):
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
    _score_cache[(name, wide)] = s
    return s


BONUS = {'Hero': 0.5, 'Ascended Hero': 0.5, 'Creature': 0.5, 'Artifact': 0.1}     # Figuren tragen als Kachel am besten


def tile_k(w, h):
    return 2 if (w > 76 or h > 51) else 1


def tile_rank(names, w, h):
    """Karten, deren Kachel-Ausschnitt (w x h) funktioniert, beste zuerst."""
    k = tile_k(w, h)
    out = []
    for n in names:
        a = C.art(n)
        if a is None or a.width > 80:
            continue
        q = crops.best_crop(n, w, h, k)[1]
        if q > 0:
            out.append((q + BONUS.get((C.BY_NAME.get(n) or {}).get('cardType', ''), 0), n))
    out.sort(key=lambda t: (-t[0], t[1]))
    return [n for _, n in out]


def pick_art(setcode, k, used, w, h):
    allnames = [c['name'] for c in C.CARDS if C.norm_set(c['setID']) == setcode and 'Token' not in c['cardType']]
    names = [n for n in tile_rank(allnames, w, h) if n not in used]
    if len(names) < 8:
        # kleine Sets: auch weniger ideale Ausschnitte zulassen (Mitte-Ausschnitt), damit die Varianten verschieden bleiben
        rest = [n for n in allnames if n not in names and n not in used and C.art(n) is not None and C.art(n).width <= 80
                and n not in crops.BLOCK and not n.startswith('Mischief Militia')]
        rest.sort(key=lambda n: (-art_score(n), n))
        names += rest
    if not names:
        return None
    n = names[k % len(names)] if len(names) < 8 else names[k]
    used.add(n)
    return n


def auto_tiles(pack, n, w, h, used, pool=None):
    """n Kacheln aus dem Kartenpool eines Packs, die noch nicht vergeben sind."""
    pool = [c['name'] for c in C.cards_of(pack) if c['name'] not in used] if pool is None else [n_ for n_ in pool if n_ not in used]
    out = [x for x in tile_rank(pool, w, h) if x not in used][:n]
    if len(out) < n:      # kleiner Pool (z. B. ein Archetyp): mit den bestmöglichen übrigen Karten auffüllen, Ausschnitt trotzdem zentriert
        rest = [x for x in pool if x not in used and x not in out and C.art(x) is not None and C.art(x).width <= 80]
        rest.sort(key=lambda x: (-art_score(x), x))
        out += rest[:n - len(out)]
    used.update(out)
    return out


USED = set()      # je Pack: bereits vergebene Kartenkunst (wird in main() mit allen ausdrücklich gewählten Motiven vorbelegt)


def resolve_art(name, pack, used=None, min_score=22, wide=False):
    """Fehlt die Kunst oder ist sie zu dunkel/flach, nimmt der Cover die beste noch freie Karte des Packs."""
    used = USED if used is None else used
    if name and art_score(name, wide) >= min_score:
        used.add(name)
        return name
    pool = [c['name'] for c in C.cards_of(pack) if c['name'] not in used and art_score(c['name'], wide) >= min_score]
    pool.sort(key=lambda n: -art_score(n, wide))
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
    h1 = pxfont.text_mask(l1, scale=s1, spacing=0).shape[0]
    h2 = pxfont.text_mask(l2, scale=s2, spacing=0).shape[0]
    gap = 6
    total = h1 + gap + h2
    mid = (PLATE[1] + PLATE[3] - 1) / 2.0                 # Mitte der Platteninnenfläche (Rand 4 px je Seite)
    ytop = int(round(mid - (total - 1) / 2.0))
    cx = W // 2
    G.draw_text(P, l1, cx, ytop, s1, mt=gold, outline=2, shadow=2)
    G.draw_text(P, l2, cx, ytop + h1 + gap, s2, mt=gold, outline=2, shadow=3 if s2 == 3 else 2)
    return (ytop, ytop + total)


RARITY_PIPS = ['#929292', '#e8ecf2', '#44d888', '#4cc8f0', '#4a7ae8', '#a070f0', '#ff4aa8', '#fad54a', '#8ce1ff']


def draw_pip(P, cx, cy, col, r=2):
    """Kleiner Edelstein (Raute, Radius r) mit Glanzpunkt."""
    d = np.abs(XX - cx) + np.abs(YY - cy)
    m = d <= r
    c = pal.snap1(col)
    P.paint(m, c, wt=1.0)
    P.paint(m & ((XX - cx) + (YY - cy) > 0), pal.darken(c, 0.35), wt=1.0)
    P.paint(m & ((XX - cx) + (YY - cy) < 0), pal.lighten(c, 0.5), wt=1.0)
    P.paint((XX == cx) & (YY == cy - 1), (255, 255, 255), wt=1.0)


def draw_pips(P, mt):
    """Seltenheitsleiter: neun Edelsteine, in die untere Rahmenkante des Kunstrahmens eingelassen."""
    y = FRAME[3] - 4
    for i in range(9):
        draw_pip(P, 44 + 13 * i, y, RARITY_PIPS[i])


def badge9(P, cx, cy, r, mt):
    """Münzplakette mit der 9. Gerader Durchmesser: Mittelpunkt zwischen den Pixeln (cx-.5, cy-.5), die 9 (12x14) liegt exakt darin."""
    gold = G.metal('gold')
    d2 = (XX - (cx - 0.5)) ** 2 + (YY - (cy - 0.5)) ** 2
    P.shadow(d2 <= r * r, 1, 1, 0.55)
    for rr, col in ((r, gold[3]), (r - 1, gold[0]), (r - 2, gold[1]), (r - 4, gold[3])):
        P.paint(d2 <= rr * rr, col, wt=1.0)
    P.paint(d2 <= (r - 4) ** 2, pal.darken(gold[3], 0.55), wt=0.6)
    import pxfont
    h9 = pxfont.text_mask('9', scale=2, spacing=0).shape[0]
    G.draw_text(P, '9', cx, int(round((cy - 0.5) - (h9 - 1) / 2.0)), 2, mt=gold, outline=1, shadow=0)


def draw_ribbon(P, th, mt):
    mask = G.chamfer_mask(*RIBBON, 5)
    G.plate(P, mask, pal.hexrgb(th['plate'][0]), pal.hexrgb(th['plate'][1]), mt, thick=4)
    gold = G.metal('gold')
    x0, y0, x1, y1 = RIBBON
    mid = (y0 + y1) // 2                       # senkrechte Mitte der Banderole (Innenfläche y0+4 .. y1-5)
    badge9(P, x0 + 20, mid, 12, mt)
    tx = 110
    G.draw_text(P, 'Rarity Skins', tx, mid - 10, 1, mt=gold, outline=1, shadow=1)
    G.draw_text_flat(P, 'for your Collection!', tx, mid + 1, pal.snap1('#ffffff'), mt=mt, spacing=0)


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


FOOT = {'Alice, the Puppeteer Girl': 27}      # letzte Körperzeile im Original-Sprite (Puppen schweben darunter)
FLY = {'Cool Rescuer Monia': 197, 'Monia Bot, the Foretold Rescuer of Coolness': 221, 'Cute Angel Molinda': 201}      # Flieger (Jetpack, Flügel): Unterkante des Sprites; Schatten bleibt am Boden
PILE = {'Treasure Huntress Semi': (33, 51)}   # Semi steht auf dem Münz- und Edelsteinberg ihrer Kartenkunst (Zeilen der Kunst)
SOLO_K = 3                                    # einheitliche Pixelgröße für alle Solo-Motive (Hero Packs, Monia)
INNER = np.zeros((H, W), bool)
INNER[IY0:IY1, IX0:IX1] = True


def components(a):
    """8er-zusammenhängende Flächen einer Bool-Maske als Liste von Masken."""
    h, w = a.shape
    lab = np.zeros((h, w), int)
    n = 0
    sizes = []
    for sy in range(h):
        for sx in range(w):
            if a[sy, sx] and not lab[sy, sx]:
                n += 1
                st = [(sy, sx)]; lab[sy, sx] = n; cnt = 0
                while st:
                    y0, x0 = st.pop(); cnt += 1
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            yy, xx = y0 + dy, x0 + dx
                            if 0 <= yy < h and 0 <= xx < w and a[yy, xx] and not lab[yy, xx]:
                                lab[yy, xx] = n; st.append((yy, xx))
                sizes.append(cnt)
    return [lab == i + 1 for i in range(n)], sizes


def largest_component(a):
    comps, sizes = components(a)
    return comps[int(np.argmax(sizes))] if comps else a


def load_solo(ref):
    """Held-Sprite ohne abgesetzte Splitter (Funken, lose Pixel), auf den Inhalt zugeschnitten. -> (Bild, bbox im Original)"""
    orig = C.hero_sprite(ref) if not ref.startswith('file:') else Image.open(ref[5:]).convert('RGBA')
    if orig is None:
        return None, None
    a = np.asarray(orig)[..., 3] > 127
    comps, sizes = components(a)
    arr = np.array(orig)
    for m, s in zip(comps, sizes):
        if s < 10:
            arr[m] = (0, 0, 0, 0)
    orig = Image.fromarray(arr, 'RGBA')
    bb = orig.getbbox()
    return orig.crop(bb), bb


def draw_pile(P, name, cx, base_y):
    """Berg aus der Kartenkunst (Münzen, Edelsteine), 3x, als gedithertes Oval unter den Füßen der Figur."""
    r0, r1 = PILE[name]
    a = C.art(name)
    x0 = a.width // 2 - 27
    big = G.scaled(a.crop((x0, r0, x0 + 54, r1)), SOLO_K)
    top = base_y - 34
    cyc = top + big.height // 2
    e = ((XX - cx) / 80.0) ** 2 + ((YY - cyc) / (big.height / 2.0)) ** 2
    mask = (e <= 0.86 + 0.28 * BAY) & INNER
    G.blit(P, big, cx - big.width // 2, top, wt=0.3, mask_clip=mask)


def place_sprite(P, ref, cx, base_y, k=SOLO_K, shadow=True):
    """Sprite mit ganzzahligem Faktor k (Füße auf base_y; Flieger schweben darüber), komplett im Kunstrahmen; Schatten direkt unter den Füßen."""
    im, bb = load_solo(ref)
    if im is None:
        return None
    ground = base_y
    if ref in FLY:
        base_y = FLY[ref]
        ground = IY1 - 9
    # Pixelgröße bleibt immer k (einheitlich bei allen Solo-Motiven)
    s = G.scaled(im, k)
    ma = np.asarray(s)[..., 3] > 127
    mxc = np.where(ma)[1].mean()                  # Schwerpunkt statt Mitte des Umrisses: die Figur sitzt optisch mittig
    x = int(round(cx - mxc))
    y = int(base_y - s.height)
    if shadow:
        a0 = np.asarray(im)[..., 3] > 127
        if ref in FLY:
            G.ground_shadow(P, cx, ground, 20, 3)
        else:
            foot = FOOT.get(ref)
            if foot:
                frow = foot - bb[1]
                comp = a0
            else:
                comp = largest_component(a0)
                widths = comp.sum(1)
                frow = int(np.where(widths >= 0.35 * widths.max())[0].max())     # unterste Zeile mit nennenswerter Breite (keine Zehenspitzen/Beinenden)
            rows = comp[max(0, frow - 2):frow + 1]
            xs = np.where(rows.any(0))[0]
            wfoot = (xs.max() - xs.min() + 1) * k if len(xs) else s.width // 2
            fx = x + ((xs.min() + xs.max() + 1) * k) // 2 if len(xs) else cx
            G.ground_shadow(P, fx, y + (frow + 1) * k - 1, max(8, int(wfoot * 0.55) + 3), 4)
    G.blit(P, s, x, y, wt=0.15, mask_clip=INNER)
    return (x, y, s.width, s.height, k)


def tile_image(name, tw, th_):
    """Kachelausschnitt einer Kartenkunst (1x oder 2x je nach Kachelgröße), das Motiv liegt mittig."""
    a = C.art(name)
    if a is None:
        return None
    k = tile_k(tw, th_)
    im, q = crops.best_crop(name, tw, th_, k)
    if im is not None:
        return im
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
    rows = {3: [3], 4: [2, 2], 5: [3, 2], 8: [3, 3, 2], 9: [3, 3, 3], 12: [3, 3, 3, 3]}[n]
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


def tpl_grid(P, th, mt, tiles, v=0, pack=None):
    rects = grid_layout(9)
    if isinstance(tiles, dict):                 # Pool eines Archetyps (z. B. nur Guardian Beasts)
        pool = [c['name'] for c in C.CARDS if c.get('archetype') == tiles['archetype']]
        tiles = auto_tiles(pack, 9, rects[0][2], rects[0][3], USED, pool)
    elif tiles == 'auto':
        tiles = auto_tiles(pack, 9, rects[0][2], rects[0][3], USED)
    else:
        USED.update(tiles)
    P.paint(INNER, pal.darken(pal.hexrgb(th['grad'][2][1]), 0.6), wt=0.3)
    for (x, y, w, h), name in zip(rects, tiles):
        im = tile_image(name, w, h)
        if im is not None:
            draw_tile(P, im, x, y, w, h, mt)
    return tiles


def tpl_mosaic(P, th, mt, pack, v):
    """Ein Vertreter je Set (Reihenfolge der Sets, je Variante ein anderer Rang der besten Motive)."""
    sets = D.MOSAIC_SETS[pack]
    rects = grid_layout(len(sets))
    used = set()
    names = []
    for s, (x, y, w, h) in zip(sets, rects):
        n = pick_art(s, v, used, w, h)
        names.append(n if n is not None else pick_art(s, 0, set(), w, h))
    P.paint(INNER, pal.darken(pal.hexrgb(th['grad'][2][1]), 0.6), wt=0.3)
    for (x, y, w, h), nm in zip(rects, names):
        im = tile_image(nm, w, h) if nm else None
        if im is not None:
            draw_tile(P, im, x, y, w, h, mt)
    return names


def draw_explosion(P, cx, cy, R=66, seed=5):
    """Pixel-Explosion (Zellen 3x3 wie die Sprites): Zackenstern in vier Gluttönen, dunkle Kante, Funken."""
    gold = G.metal('gold')
    rng = np.random.RandomState(seed)
    n = 13
    rad = R * (0.62 + 0.38 * rng.rand(n))
    rad[::2] *= 0.68
    cxx = (XX // 3) * 3 + 1; cyy = (YY // 3) * 3 + 1
    ang = np.arctan2(cyy - cy, cxx - cx); dist = np.hypot(cxx - cx, cyy - cy)
    t = (ang + np.pi) / (2 * np.pi) * n
    i0 = np.floor(t).astype(int) % n; i1 = (i0 + 1) % n; f = t - np.floor(t)
    r = rad[i0] * (1 - f) + rad[i1] * f
    q = dist / np.maximum(r, 1)
    out = (q <= 1.0) & INNER
    edge = out & (q > 0.86)
    dark = pal.hexrgb('#4a0a00')
    P.paint(G.dilate(out, 2) & ~out & INNER, dark, wt=0.6)
    for lo, hi, col in ((0.0, 0.3, gold[4]), (0.3, 0.55, gold[0]), (0.55, 0.78, gold[1]), (0.78, 0.9, gold[2]), (0.9, 1.01, gold[3])):
        P.paint(out & (q >= lo) & (q < hi), col, wt=1.0)
    # Funken / Trümmer
    for _ in range(14):
        a = rng.rand() * 6.283; d = R * (0.95 + 0.5 * rng.rand())
        x = int(cx + d * np.cos(a)) // 3 * 3; y = int(cy + d * np.sin(a)) // 3 * 3
        m = G.rect_mask(x, y, x + 3, y + 3) & INNER
        P.paint(m, [gold[0], gold[1], gold[4]][rng.randint(0, 3)], wt=1.0)


def tpl_hero(P, th, mt, hero, fx=None, **kw):
    """Ein Held in einheitlicher Pixelgröße auf Strahlenkranz."""
    art_burst(P, th, rot=0.2)
    art_particles(P, th, 11)
    if fx == 'explosion':
        draw_explosion(P, IX0 + IW // 2, IY0 + 84)
    if hero in PILE:
        draw_pile(P, hero, IX0 + IW // 2, IY0 + 126)
    place_sprite(P, hero, IX0 + IW // 2, IY0 + 126, shadow=hero not in PILE)
    return [hero]


def window_frame(P, mt, ax, ay, w=152, h=102):
    m = G.rect_mask(ax, ay, ax + w, ay + h)
    P.shadow(m, 3, 3, 0.55)
    return m


def tpl_scene(P, th, mt, window, pack=None, rot=0.5, sprite=None):
    """Eine große Kartenkunst (2x) im Goldrahmen; optional eine einzelne Figur davor."""
    window = resolve_art(window, pack, USED, 10, wide=True) if pack else window
    art_burst(P, th, rot=rot)
    art_particles(P, th, 23)
    ax = IX0 + (IW - 152) // 2
    ay = IY0 + (IH - 102) // 2
    a0 = C.art(window)
    im = G.crop_center(a0 if a0.width >= 150 else G.scaled(a0, 2), 152, 102)
    m = window_frame(P, mt, ax, ay)
    G.blit(P, im, ax, ay, wt=0.2)
    P.paint(G.dilate(m, 2) & ~m, mt[3], wt=0.6)
    P.paint(G.dilate(m, 3) & ~G.dilate(m, 2), mt[0], wt=1.0)
    P.paint(G.dilate(m, 4) & ~G.dilate(m, 3), mt[3], wt=0.6)
    out = [window]
    return out


def tpl_focus(P, th, mt, big, tiles, pack=None):
    big = resolve_art(big, pack, USED, 10) if pack else big
    ty = IY0 + 5 + 102 + 12
    th_ = IY1 - 3 - ty
    if tiles == 'auto':
        tiles = auto_tiles(pack, 3, 50, th_, USED)
    else:
        USED.update(tiles)
    art_burst(P, th, rot=0.9)
    art_particles(P, th, 31, 10)
    ax, ay = IX0 + (IW - 152) // 2, IY0 + 5
    im = G.crop_center(G.scaled(C.art(big), 2), 152, 102)
    m = window_frame(P, mt, ax, ay)
    G.blit(P, im, ax, ay, wt=0.2)
    P.paint(G.dilate(m, 2) & ~m, mt[3], wt=0.6)
    P.paint(G.dilate(m, 3) & ~G.dilate(m, 2), mt[0], wt=1.0)
    P.paint(G.dilate(m, 4) & ~G.dilate(m, 3), mt[3], wt=0.6)
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
    if template == 'mosaic':
        subjects = tpl_mosaic(P, th, mt, pack, vi)
    elif template == 'grid':
        subjects = tpl_grid(P, th, mt, content['tiles'], v=vi, pack=pack)
    elif template == 'hero':
        subjects = tpl_hero(P, D.THEMES[content.get('bg', theme)], mt, content['hero'], fx=content.get('fx'))
    elif template == 'scene':
        subjects = tpl_scene(P, th, mt, content['window'], pack=pack, rot=0.3 + vi * 0.37)
    elif template == 'focus':
        subjects = tpl_focus(P, th, mt, content['big'], content['tiles'], pack=pack)
    corner_gems(P, th, mt)
    draw_pips(P, mt)
    draw_ribbon(P, th, mt)
    make_crimps(P, th, mt)
    sparks = sparkle_plan(seed)
    # feste Sterne im Standbild (jeder dritte, klein)
    for i, (x, y, r, ph) in enumerate(sparks):
        if 7 <= i < 20 and i % 3 == 0:
            G.star(P.rgb, x, y, 2, pal.snap1(th['tint']))
    base = P.finish()
    return base, P.wt.copy(), P.raw.copy(), sparks, th, subjects


# ---------------------------------------------------------------- Schimmer
def hsv_to_rgb(h, s, v):
    i = np.floor(h * 6).astype(int) % 6
    f = h * 6 - np.floor(h * 6)
    p = v * (1 - s); q = v * (1 - f * s); t = v * (1 - (1 - f) * s)
    r = np.choose(i, [v, q, p, p, t, v]); g = np.choose(i, [t, v, v, q, p, p]); b = np.choose(i, [p, p, t, v, v, q])
    return np.stack([r, g, b], -1) * 255


def shimmer_frames(base, wt, raw, sparks, th, nf=NF):
    rgb = base[..., :3].astype(float)
    body = base[..., 3] > 0
    u = XX * 0.8 + YY * 0.6
    lo, hi = -70, u.max() + 70
    frames = []
    tint = pal.snap1(th['tint'])
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
        snapped[raw] = np.clip(np.rint(out[raw]), 0, 255).astype(np.uint8)
        changed = body & np.any(snapped != base[..., :3], -1)
        # Funkeln
        sp = snapped.astype(float)
        for (x, y, rmax, ph) in sparks:
            r = G.twinkle_r(ph, f, nf, rmax)
            G.star(sp, x, y, r, tint)
        sp2 = pal.snap(sp)
        sp2[raw] = np.clip(np.rint(sp[raw]), 0, 255).astype(np.uint8)
        sp = sp2
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
        USED.clear()
        for _t, _th, _c in D.VARIANTS[pack]:
            USED.update([_c.get('window'), _c.get('big')] + (list(_c['tiles']) if isinstance(_c.get('tiles'), list) else []))
        USED.discard(None)
        os.makedirs(pdir, exist_ok=True)
        entry = {'id': pack, 'name': D.TITLE_FULL[pack], 'tagline': manifest['tagline'], 'variants': []}
        for vi, (tpl, theme, content) in enumerate(D.VARIANTS[pack]):
            base, wt, raw, sparks, th, subjects = render_pack(pack, vi, tpl, theme, content)
            vid = '%s-%d' % (pack, vi + 1)
            Image.fromarray(base, 'RGBA').save(os.path.join(pdir, vid + '.png'), optimize=True)
            strip = shimmer_frames(base, wt, raw, sparks, th)
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
