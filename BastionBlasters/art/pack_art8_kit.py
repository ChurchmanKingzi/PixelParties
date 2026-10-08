"""pack_art8 Werkzeugkasten: ASCII-Sprites, Licht-Glühen, Raum-Aufbau (Room 2x2 / 3x2 / 3x3), Bodenkacheln.
Registriert selbst keine Kartenbilder."""
from __future__ import annotations

from cards_art import *          # pixl, scenekit, landscape, assets_*, castle-Helfer, ground_world, mini_castle ...
from assets_env import value_noise

# --------------------------------------------------------------------------- Palette-treues Aufhellen

_LIGHT_CACHE = {}


def lighten_palette(rgb, steps=1):
    """Hellt Master-Palettenfarben um `steps` Rampenstufen auf (Gegenstück zu darken_palette). rgb: uint8 (..., 3)"""
    if 'lut' not in _LIGHT_CACHE:
        where = {}
        for name, ramp in RAMPS.items():
            for i, c in enumerate(ramp):
                where.setdefault(tuple(int(v) for v in c), (name, i))
        _LIGHT_CACHE['lut'] = where
    where = _LIGHT_CACHE['lut']
    flat = rgb.reshape(-1, 3)
    out = np.zeros_like(flat)
    cache = {}
    for k in range(flat.shape[0]):
        key = (int(flat[k, 0]), int(flat[k, 1]), int(flat[k, 2]))
        if key not in cache:
            if key in where:
                name, i = where[key]
                cache[key] = RAMPS[name][min(5, i + steps)]
            else:
                cache[key] = key
        out[k] = cache[key]
    return out.reshape(rgb.shape)


def light_glow(world, cx, cy, rx, ry, steps=1, core=0.45, depth_max=-40):
    """Lichtfleck auf dem Boden (nur Pixel mit Tiefe < depth_max): Kern ganz, Rand im Schachbrett aufgehellt"""
    x0, x1 = max(0, int(cx - rx - 1)), min(world.w, int(cx + rx + 2))
    y0, y1 = max(0, int(cy - ry - 1)), min(world.h, int(cy + ry + 2))
    if x1 <= x0 or y1 <= y0:
        return
    Y, X = np.mgrid[y0:y1, x0:x1]
    d = ((X + 0.5 - cx) / rx) ** 2 + ((Y + 0.5 - cy) / ry) ** 2
    m = (d <= 1.0) & ((d < core) | ((X + Y) % 2 == 0)) & (world.depth[y0:y1, x0:x1] < depth_max)
    sub = world.px[y0:y1, x0:x1, :3]
    sub[m] = lighten_palette(sub[m], steps)


def light_cone(world, x0, y0, w0, x1, y1, w1, steps=1, edge_checker=True):
    """Lichtkegel (Trapez von (x0,y0,Breite w0) nach (x1,y1,Breite w1)): Kern aufgehellt, Rand im Schachbrett.
    Wirkt auf alle Pixel (auch Möbel, Figuren), bleibt in der Master-Palette."""
    ya, yb = int(min(y0, y1)), int(max(y0, y1))
    ya, yb = max(0, ya), min(world.h, yb + 1)
    for y in range(ya, yb):
        t = (y - y0) / float(y1 - y0) if y1 != y0 else 0.0
        t = max(0.0, min(1.0, t))
        cx = x0 + (x1 - x0) * t
        hw = (w0 + (w1 - w0) * t) / 2.0
        xa, xb = max(0, int(cx - hw)), min(world.w, int(cx + hw) + 1)
        if xb <= xa:
            continue
        xs = np.arange(xa, xb)
        rel = np.abs(xs + 0.5 - cx) / max(hw, 0.5)
        m = (rel < 0.55) | (((xs + y) % 2 == 0) & (rel <= 1.0))
        if not edge_checker:
            m = rel <= 1.0
        sel = xs[m]
        if len(sel):
            world.px[y, sel, :3] = lighten_palette(world.px[y, sel, :3], steps)


def tint_glow(world, cx, cy, rx, ry, ramp, idx, depth_max=-40, sparse=False):
    """Farbiger Glut-/Magieschein auf dem Boden: Schachbrett (innen) bzw. 2x2-Raster (Rand) in Rampenfarbe"""
    x0, x1 = max(0, int(cx - rx - 1)), min(world.w, int(cx + rx + 2))
    y0, y1 = max(0, int(cy - ry - 1)), min(world.h, int(cy + ry + 2))
    if x1 <= x0 or y1 <= y0:
        return
    Y, X = np.mgrid[y0:y1, x0:x1]
    d = ((X + 0.5 - cx) / rx) ** 2 + ((Y + 0.5 - cy) / ry) ** 2
    ground = world.depth[y0:y1, x0:x1] < depth_max
    inner = (d < 0.4) & ((X + Y) % 2 == 0) & ground
    outer = (d >= 0.4) & (d <= 1.0) & (X % 2 == 0) & (Y % 2 == 0) & ground
    if sparse:
        inner &= (X % 2 == 0)
    sub = world.px[y0:y1, x0:x1, :3]
    col = np.array(RAMPS[ramp][idx], np.uint8)
    sub[inner | outer] = col


def wpix(world, x, y, ramp, idx, depth=9000):
    """ein Pixel direkt in die Welt (liegt vor allem anderen)"""
    x, y = int(x), int(y)
    if 0 <= x < world.w and 0 <= y < world.h:
        world.px[y, x, :3] = RAMPS[ramp][idx]
        world.px[y, x, 3] = 255
        world.depth[y, x] = depth


def wdraw(world, spr, x, y, key=9000, flip=False):
    world.draw(spr, int(x), int(y), key, flip)


# --------------------------------------------------------------------------- Canvas mit Versatz


class ShiftCanvas(Canvas):
    """Canvas, dessen Zeichenaufrufe um (dx, dy) versetzt landen (damit Werkzeuge über die Oberkante hinausragen dürfen)"""

    def __init__(self, w, h, dx=0, dy=0):
        super().__init__(w, h)
        self.dx, self.dy = dx, dy

    def put(self, x, y, color, rid=-1):
        super().put(int(x) + self.dx, int(y) + self.dy, color, rid)

    def alpha(self, x, y):
        return super().alpha(int(x) + self.dx, int(y) + self.dy)

    def outline(self, dark=0, lit=1):
        dx, dy = self.dx, self.dy
        self.dx = self.dy = 0
        super().outline(dark, lit)
        self.dx, self.dy = dx, dy


# --------------------------------------------------------------------------- ASCII-Sprites


def art(rows, legend, outline=True):
    """Sprite aus ASCII-Zeilen. legend: Zeichen -> (Rampe, Index). '.' und ' ' sind durchsichtig."""
    h = len(rows)
    w = max(len(r) for r in rows)
    c = Canvas(w, h)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in '. ':
                continue
            ramp, idx = legend[ch]
            c.put_ramp(x, y, ramp, idx)
    if outline:
        c.outline()
    return c


def dither_blob(c, cx, cy, rx, ry, ramp, hi=5, lo=3, seed=0):
    """weiche Wolke: innen hell, am Rand Schachbrett (für Dampf, Rauch, Funkenwolken)"""
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2
            if d > 1.0:
                continue
            if d < 0.35:
                idx = hi
            elif d < 0.7:
                idx = hi if (x + y) % 2 == 0 else hi - 1
            else:
                if (x + y) % 2:
                    continue
                idx = lo
            c.put_ramp(x, y, ramp, idx)


# --------------------------------------------------------------------------- Raum-Aufbau


def build_room(letter, theme, cols, rows_n, seed=1, ground='grass'):
    """Baut ein Raum-Modul `cols x rows_n` (Zellen), Tür nach Süden, in eine Welt.
    Gibt (world, castle, out, (MX, MY, MW, MH)) zurück; MX, MY = obere linke Ecke des Moduls in Weltpixeln."""
    L = letter
    wc = cols + 2
    rows = ['.' * wc]
    for _ in range(rows_n):
        rows.append('.' + L * cols + '.')
    rows.append('.' + 'h' * cols + '.')
    rows.append('.' * wc)
    ww, hh = 32 * (cols + 4), 32 * len(rows)
    world = ground_world(ground, seed, ww, hh)
    c, out = mini_castle(rows, 1, 0, world, themes={L: theme})
    return world, c, out, (64, 32, cols * 32, rows_n * 32)


def crop_room(world, geom, y0=6):
    """144x96-Fenster, waagerecht auf das Modul zentriert"""
    MX, MY, MW, MH = geom
    x0 = MX + MW // 2 - 72
    return crop_world(world, x0, y0)


# --------------------------------------------------------------------------- Bodenkacheln (32 x 32, kachelbar)


def tile_rgb(cv):
    return cv.px[:, :, :3].copy()


def floor_bath(seed=3):
    """weiß-blaue Badefliesen 8x8 mit Fugen"""
    c = Canvas(32, 32)
    for ty in range(4):
        for tx in range(4):
            blue = (tx + ty) % 2 == 0
            for y in range(8):
                for x in range(8):
                    X, Y = tx * 8 + x, ty * 8 + y
                    if x == 7 or y == 7:
                        idx = 2 if blue else 3
                        ramp = 'ice' if blue else 'bone'
                        idx = 1 if blue else 2
                    else:
                        ramp = 'ice' if blue else 'bone'
                        idx = 3 if blue else 4
                        if x == 0 or y == 0:
                            idx += 1
                        elif (x + y) % 5 == 0 and texture_noise(X, Y, seed) > 0.55:
                            idx -= 1
                    c.put_ramp(X, Y, ramp, idx)
    return tile_rgb(c)


def floor_metal(seed=4):
    """genietete Stahlplatten 16x16"""
    c = Canvas(32, 32)
    for ty in range(2):
        for tx in range(2):
            for y in range(16):
                for x in range(16):
                    X, Y = tx * 16 + x, ty * 16 + y
                    if x == 15 or y == 15:
                        idx = 0 if (x == 15 and y == 15) else 1
                    elif x == 0 or y == 0:
                        idx = 4
                    else:
                        idx = 2 if (x + y) % 6 else 3
                        if texture_noise(X, Y, seed + tx * 3 + ty) > 0.9:
                            idx = 3
                    c.put_ramp(X, Y, 'metal', idx)
            for (rx, ry) in ((2, 2), (12, 2), (2, 12), (12, 12)):
                c.put_ramp(tx * 16 + rx, ty * 16 + ry, 'metal', 5)
                c.put_ramp(tx * 16 + rx + 1, ty * 16 + ry + 1, 'metal', 1)
    return tile_rgb(c)


def floor_ember(seed=6):
    """verkohlter Stein mit glühenden Rissen"""
    base = tile_cobble(seed, 32, base='coal', tone=(1, 2), mortar=0, hi=3)
    cv = base
    cracks = [(2, 5, 9, 9), (9, 9, 14, 8), (14, 8, 20, 13), (20, 13, 24, 12), (5, 22, 11, 19), (11, 19, 17, 24),
              (17, 24, 22, 22), (26, 3, 29, 8), (27, 26, 30, 29)]
    for (x0, y0, x1, y1) in cracks:
        cv.line(x0, y0, x1, y1, 'fire', 2)
    for (x0, y0, x1, y1) in cracks[::2]:
        cv.put_ramp(x0, y0, 'fire', 4)
        cv.put_ramp((x0 + x1) // 2, (y0 + y1) // 2, 'fire', 3)
    for (x, y) in ((8, 12), (22, 18), (4, 27), (28, 14)):
        cv.put_ramp(x, y, 'bone', 2)
    return tile_rgb(cv)


def floor_slab(seed=23, tone=(2, 3), mortar=1, hi=4):
    return tile_rgb(tile_cobble(seed, 32, base='stone', tone=tone, mortar=mortar, hi=hi))


def floor_dark_planks(seed=13):
    cv = tile_planks(seed, 32, tone=(1, 2, 2))
    rnd = random.Random(seed)
    for _ in range(14):
        x, y = rnd.randint(1, 30), rnd.randint(1, 30)
        cv.put_ramp(x, y, 'coal', 1)
        if rnd.random() < 0.5:
            cv.put_ramp(x + 1, y, 'coal', 0)
    return tile_rgb(cv)


def floor_planks_light(seed=17, scorch=True):
    cv = tile_planks(seed, 32, tone=(3, 3, 4))
    if scorch:
        for (cx, cy, r) in ((6, 10, 4), (24, 24, 5)):
            for y in range(cy - r, cy + r + 1):
                for x in range(cx - r, cx + r + 1):
                    d = math.hypot(x - cx, y - cy)
                    if d < r and (d < r * 0.55 or (x + y) % 2 == 0) and 0 <= x < 32 and 0 <= y < 32:
                        cv.put_ramp(x, y, 'coal', 1 if d < r * 0.5 else 2)
    return tile_rgb(cv)


def floor_sand(seed=29):
    """Gießerei-Formsand mit Schlacke"""
    c = Canvas(32, 32)
    for y in range(32):
        for x in range(32):
            v = value_noise(x, y, 32, seed) * 0.75 + value_noise(x * 2, y * 2, 64, seed + 2) * 0.25
            c.put_ramp(x, y, 'dirt', quant(v * 0.75 + 0.05, 1, 3, x, y, dw=0.2))
    rnd = random.Random(seed)
    for _ in range(9):
        x, y = rnd.randint(1, 29), rnd.randint(1, 30)
        c.put_ramp(x, y, 'coal', 2)
        c.put_ramp(x + 1, y, 'coal', 1)
    for (x, y) in ((5, 6), (20, 14), (13, 26)):
        c.put_ramp(x, y, 'fire', 2)
        c.put_ramp(x + 1, y, 'gold', 2)
    return tile_rgb(c)


def floor_rune(seed=31):
    """dunkle Steinfliesen mit eingeritzten, violett leuchtenden Zeichen"""
    c = Canvas(32, 32)
    for ty in range(2):
        for tx in range(2):
            for y in range(16):
                for x in range(16):
                    X, Y = tx * 16 + x, ty * 16 + y
                    if x == 15 or y == 15:
                        idx = 0
                    elif x == 0 or y == 0:
                        idx = 3
                    else:
                        idx = 1 if (x + y) % 7 else 2
                        if texture_noise(X, Y, seed) > 0.88:
                            idx = 2
                    c.put_ramp(X, Y, 'stone', idx)
    glyphs = [(8, 8, 'sun'), (24, 8, 'dia'), (8, 24, 'zig'), (24, 24, 'bar')]
    for (gx, gy, g) in glyphs:
        if g == 'sun':
            pts = [(-1, -2), (0, -2), (1, -2), (-2, -1), (2, -1), (-2, 0), (2, 0), (-2, 1), (2, 1), (-1, 2), (0, 2), (1, 2), (0, 0)]
        elif g == 'dia':
            pts = [(0, -3), (-1, -2), (1, -2), (-2, -1), (2, -1), (-3, 0), (3, 0), (-2, 1), (2, 1), (-1, 2), (1, 2), (0, 3)]
        elif g == 'zig':
            pts = [(-3, -1), (-2, 0), (-1, -1), (0, 0), (1, -1), (2, 0), (3, -1), (-3, 2), (-2, 3), (-1, 2), (0, 3), (1, 2), (2, 3)]
        else:
            pts = [(-2, -2), (-2, -1), (-2, 0), (-2, 1), (-2, 2), (2, -2), (2, -1), (2, 0), (2, 1), (2, 2), (0, 0), (0, 3), (0, -3)]
        for (dx, dy) in pts:
            c.put_ramp(gx + dx, gy + dy, 'purple', 4)
    return tile_rgb(c)
