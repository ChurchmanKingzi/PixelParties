"""Schnörkel für den Kartenrahmen: Eck-Voluten, Mittelzierden und Edelsteine, als Pixel-Striche mit Auto-Schattierung."""
import math

from PIL import Image, ImageDraw

from pxcommon import INK, U, WHITE, mix


def _line(a, b):
    (x0, y0), (x1, y1) = a, b
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    err = dx + dy
    pts = []
    while True:
        pts.append((x0, y0))
        if (x0, y0) == (x1, y1):
            return pts
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy


def stroke(path, thick=2):
    """Polylinie (Zellkoordinaten) → Zellmenge; thick = Strichstärke in Zellen."""
    cells = set()
    pts = [(int(round(x)), int(round(y))) for x, y in path]
    for a, b in zip(pts, pts[1:]):
        for (x, y) in _line(a, b):
            for j in range(thick):
                for i in range(thick):
                    cells.add((x + i, y + j))
    return cells


def volute(cx, y_bar, r0, turns=1.6, shrink=0.72, n=90):
    """Spirale, die auf der Waagrechten y = y_bar (unterster Punkt) beginnt und gegen den Uhrzeigersinn einrollt."""
    cy = y_bar - r0
    pts = []
    tot = turns * 2 * math.pi
    for k in range(n + 1):
        phi = tot * k / n
        r = r0 * (1 - shrink * phi / tot)
        pts.append((cx + r * math.sin(phi), cy + r * math.cos(phi)))
    return pts


def _bead(x, y):
    return {(int(round(x)), int(round(y))), (int(round(x)) + 1, int(round(y))),
            (int(round(x)), int(round(y)) + 1), (int(round(x)) + 1, int(round(y)) + 1)}


def _curl(cx, y_bar, r0, turns=1.3, shrink=0.55):
    """Einrollende Ranke mit Perle am Ende (1-Zellen-Linie, Windungen ≥ 3 Zellen auseinander)."""
    pts = volute(cx, y_bar, r0, turns=turns, shrink=shrink)
    cells = stroke(pts, 1)
    ex, ey = pts[-1]
    return cells | _bead(ex - 1, ey - 1), pts


def corner_cells():
    """Eck-Zierde, lokal: (0,0) = obere linke Ecke der Platte, nach außen = negative Koordinaten."""
    cells = stroke([(1, -4), (10, -4)], 2)
    curl, _ = _curl(10, -4, 6.0)
    cells |= curl
    # Perlen auf dem Balken
    cells |= _bead(4, -7)
    cells |= stroke([(4, -5), (4, -6)], 1)
    # Arm links: Spiegelung an der Diagonale
    cells |= {(y, x) for (x, y) in cells}
    return cells


def crest_cells():
    """Mittelzierde unten (Außenseite = +y), lokal: (0,0) = Mitte der Plattenkante."""
    bar = stroke([(3, 3), (9, 3)], 2)
    curl, _ = _curl(9, -3, 5.5)
    half = bar | {(x, -y) for (x, y) in curl}                 # rollt nach unten ein
    return half | {(-x - 1, y) for (x, y) in half}


def gem_cells(cx, cy, r=2):
    return {(cx + i, cy + j) for j in range(-r, r + 1) for i in range(-r, r + 1) if abs(i) + abs(j) <= r}


def render(cells, accent, gem=None, scale=U):
    """Zellmenge → (RGBA-Bild, (x_min, y_min)) mit Kontur, Licht oben/links und Schatten unten/rechts."""
    light = mix(accent, WHITE, 0.5)
    main = accent
    dark = mix(accent, INK, 0.5)
    allc = set(cells)
    if gem:
        allc |= gem
    ring = set()
    for (x, y) in allc:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            n = (x + dx, y + dy)
            if n not in allc:
                ring.add(n)
    xs = [c[0] for c in allc | ring]
    ys = [c[1] for c in allc | ring]
    x0, y0 = min(xs), min(ys)
    w, h = max(xs) - x0 + 1, max(ys) - y0 + 1
    im = Image.new('RGBA', (w * scale, h * scale), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    def put(c, col):
        px, py = (c[0] - x0) * scale, (c[1] - y0) * scale
        d.rectangle([px, py, px + scale - 1, py + scale - 1], fill=col + (255,))

    for c in ring:
        put(c, INK)
    gold = (255, 214, 96)
    for (x, y) in cells:
        if gem and (x, y) in gem:
            continue
        if (x - 1, y) not in allc or (x, y - 1) not in allc:
            put((x, y), light)
        elif (x + 1, y) not in allc or (x, y + 1) not in allc:
            put((x, y), dark)
        else:
            put((x, y), main)
    if gem:
        gc = sorted(gem)
        cx = sum(c[0] for c in gc) // len(gc)
        cy = sum(c[1] for c in gc) // len(gc)
        for (x, y) in gem:
            dist = abs(x - cx) + abs(y - cy)
            put((x, y), WHITE if dist == 0 else (gold if (x - cx) + (y - cy) <= 0 else mix(gold, INK, 0.35)))
    return im, (x0, y0)


def frame_ornaments(plate_x, plate_y, plate_w, plate_h, accent, canvas_size):
    """Alle Schnörkel einer Platte als RGBA-Ebene in Canvas-Größe. Gibt zusätzlich die Edelstein-Mitten zurück."""
    layer = Image.new('RGBA', canvas_size, (0, 0, 0, 0))
    cw, ch = plate_w // U, plate_h // U
    px, py = plate_x // U, plate_y // U    # Plattenrand liegt auf dem 7-px-Raster

    def stamp(cells, gem, ox, oy):
        im, (x0, y0) = render(cells, accent, gem)
        layer.alpha_composite(im, ((ox + x0) * U + (plate_x - px * U), (oy + y0) * U + (plate_y - py * U)))

    gems = []
    corner = corner_cells()
    for fx, fy, ox, oy in ((1, 1, px, py), (-1, 1, px + cw - 1, py), (1, -1, px, py + ch - 1), (-1, -1, px + cw - 1, py + ch - 1)):
        cells = {(fx * x, fy * y) for (x, y) in corner}
        gem = {(fx * x, fy * y) for (x, y) in gem_cells(-1, -1, 2)}
        stamp(cells, gem, ox, oy)
        gems.append((ox * U + (plate_x - px * U) + fx * (-1) * U + U // 2, oy * U + (plate_y - py * U) + fy * (-1) * U + U // 2))
    # Mittelzierden: unten, links, rechts (oben sitzt der Sprite)
    crest = crest_cells()
    gem_c = gem_cells(0, 4, 3) | gem_cells(-1, 4, 3)
    gem_c = {(x, y) for (x, y) in gem_c}
    mid_x, mid_y = px + cw // 2, py + ch // 2
    rots = {
        'bottom': (lambda x, y: (x, y), mid_x, py + ch - 1),
        'left': (lambda x, y: (-y, x), px, mid_y),
        'right': (lambda x, y: (y, -x), px + cw - 1, mid_y),
    }
    for name, (fn, ox, oy) in rots.items():
        cells = {fn(x, y) for (x, y) in crest}
        gem = {fn(x, y) for (x, y) in gem_c}
        stamp(cells, gem, ox, oy)
    return layer, gems
