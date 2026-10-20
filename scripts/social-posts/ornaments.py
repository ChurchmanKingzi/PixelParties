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


# ── Äußerer Rahmen und Trennlinien ────────────────────────────────────────────

def _paste(layer, cells, accent, gem, ox, oy):
    """Zellmenge mit Ursprung (ox, oy) in Zellen auf die Ebene setzen (auch teilweise außerhalb)."""
    im, (x0, y0) = render(cells, accent, gem)
    layer.paste(im, ((ox + x0) * U, (oy + y0) * U), im)


def post_border(accent, size):
    """Rand des Posts: Kontur, Akzentlinie, gemusterte Rille (helle Perlen) und Kontur; Eckblöcke und Mittelstücke mit Edelstein."""
    w, h = size
    layer = Image.new('RGBA', size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    light = mix(accent, WHITE, 0.5)
    deep = mix(accent, INK, 0.78)
    d.rectangle([0, 0, w - 1, h - 1], outline=INK, width=U)
    d.rectangle([U, U, w - 1 - U, h - 1 - U], outline=accent, width=U)
    d.rectangle([2 * U, 2 * U, w - 1 - 2 * U, h - 1 - 2 * U], outline=deep, width=U)
    d.rectangle([3 * U, 3 * U, w - 1 - 3 * U, h - 1 - 3 * U], outline=INK, width=U)
    # Perlenreihe in der Rille: jede dritte Zelle hell
    cw, ch = w // U, h // U
    for i in range(6, cw - 6, 3):
        for y in (2, ch - 3):
            d.rectangle([i * U, y * U, i * U + U - 1, y * U + U - 1], fill=light)
    for j in range(6, ch - 6, 3):
        for x in (2, cw - 3):
            d.rectangle([x * U, j * U, x * U + U - 1, j * U + U - 1], fill=light)
    # Eckblöcke 8×8 mit Edelstein und abgeschnittener Außenecke
    block = {(x, y) for x in range(8) for y in range(8) if not (x + y < 2)}
    gem = gem_cells(4, 4, 2)
    for fx, fy in ((0, 0), (1, 0), (0, 1), (1, 1)):
        cells = {((7 - x) if fx else x, (7 - y) if fy else y) for (x, y) in block}
        g = {((7 - x) if fx else x, (7 - y) if fy else y) for (x, y) in gem}
        _paste(layer, cells, accent, g, 0 if not fx else cw - 8, 0 if not fy else ch - 8)
    # Mittelstücke: Sechseck-Raute mit Edelstein, je Seite
    lozenge = {(x, y) for x in range(15) for y in range(4) if abs(x - 7) <= 7 - (1 if y in (0, 3) else 0) * 2}
    for (px_, py_, trans) in ((cw // 2 - 7, 0, False), (cw // 2 - 7, ch - 4, False), (0, ch // 2 - 7, True), (cw - 4, ch // 2 - 7, True)):
        cells = {(y, x) for (x, y) in lozenge} if trans else set(lozenge)
        g = gem_cells(1, 7, 1) if trans else gem_cells(7, 1, 1)
        _paste(layer, cells, accent, g, px_, py_)
    return layer


def divider(length, accent, direction=1, thick=2, gem_r=2):
    """Trennlinie mit Edelstein am Ende und kleinem Stein in der Mitte, Ursprung = Innenseite, direction = ±1."""
    cells = stroke([(0, 0), (length, 0)], thick)
    gem = gem_cells(length + gem_r + 1, thick // 2, gem_r) | gem_cells(length // 2, thick // 2, 1 if thick > 1 else 0)
    if direction < 0:
        cells = {(-x, y) for (x, y) in cells}
        gem = {(-x, y) for (x, y) in gem}
    return cells, gem


def place_divider(layer, accent, x_px, y_px, length, direction, thick=2, gem_r=2):
    cells, gem = divider(length, accent, direction, thick, gem_r)
    _paste(layer, cells, accent, gem, x_px // U, y_px // U)
