"""Pixel-Werkstatt für Bastion Blasters (16-Bit-Stil).

Ziele:
  * RGB555-Farbraum (wie SNES), Farbrampen mit Hue-Shift
  * schattierte Grundformen mit geordnetem Dithering (Schachbrett/Bayer)
  * automatische Selbst-Outline (Sel-Out)
  * deterministisch: gleicher Code = gleiche Pixel
"""
from __future__ import annotations

import math
import numpy as np
from PIL import Image, ImageDraw, ImageFont


def label_font(size=11):
    """TTF mit Umlauten für Beschriftungen (nur Annotationen, nie Spielgrafik); Fallback: PIL-Standardfont"""
    for path in ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            pass
    return ImageFont.load_default()

# --------------------------------------------------------------------------- Farben


def hexrgb(h: str):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def q555(rgb):
    """auf 5 Bit je Kanal quantisieren und auf 8 Bit zurückführen (SNES-Farbraum)"""
    def f(v):
        v5 = v >> 3
        return (v5 << 3) | (v5 >> 2)
    return tuple(f(v) for v in rgb)


# Ramps: dunkel -> hell, mit Hue-Shift (Schatten kühl/violett, Licht warm/gelb)
_RAW = {
    'stone':   ['#242238', '#3c3a58', '#5a587c', '#807e9c', '#aca8b6', '#d8d0c6'],
    'wood':    ['#2a1b26', '#4b2e30', '#744630', '#a06a3a', '#c99352', '#ecc477'],
    'grass':   ['#17302f', '#245238', '#35793a', '#58a23c', '#8bc94a', '#c4e870'],
    'dirt':    ['#2f2330', '#4d3a3a', '#6f5240', '#96734c', '#bf9a63', '#e3c88a'],
    'goblin':  ['#173a2e', '#25623a', '#3e8f43', '#66bd4f', '#9be06b', '#d2f59a'],
    'skin':    ['#43213a', '#7c3a48', '#b45a56', '#da8268', '#f0ac8a', '#fbd5b8'],
    'bone':    ['#34293f', '#5d4d63', '#8a7a85', '#b9ab9f', '#e1d7c3', '#faf4e4'],
    'metal':   ['#1d2133', '#363f5c', '#566a8c', '#8097b3', '#b3c7d8', '#e6f1f6'],
    'gold':    ['#3d2220', '#7a4527', '#b87a2a', '#e3a933', '#f8d65a', '#fff3a8'],
    'fire':    ['#3a1224', '#7d1e34', '#c3382f', '#ee6a2c', '#ffa535', '#ffdf70'],
    'ice':     ['#1d2150', '#2f4690', '#4a7ccc', '#78b6ea', '#b0e0f6', '#ecfaff'],
    'purple':  ['#25174b', '#46288a', '#7541c2', '#a46fe8', '#d0a2f8', '#f2dcff'],
    'fur':     ['#2e3452', '#4f5f87', '#7d90b3', '#aebfd6', '#d8e4ef', '#fbfdff'],
    'teamA':   ['#3d0f2a', '#751935', '#b32a42', '#e04b4c', '#f98a63', '#ffcf8e'],
    'teamB':   ['#0c2c3f', '#0f5a6e', '#1b8f96', '#3bc5b5', '#86e6c9', '#d0fbe8'],
    'leaf':    ['#10302e', '#1c5a34', '#2e8a3a', '#52b83e', '#84dc50', '#c0f27a'],
    'slime':   ['#143a44', '#1c6a5a', '#2fa07a', '#5ad49a', '#9af2c0', '#daffe8'],
    'coal':    ['#0f0d1c', '#1e1a30', '#322c48', '#4b4466', '#6a6284', '#928aa6'],
    'sky':     ['#1d3260', '#2f5a96', '#4f8ac8', '#82bce6', '#bde4f4', '#f0fbff'],
    'cloth':   ['#2c1b3c', '#4a2c5c', '#6e4478', '#9a6496', '#c48cb0', '#e8bcd0'],
}
RAMPS = {k: [q555(hexrgb(h)) for h in v] for k, v in _RAW.items()}
RAMP_NAMES = list(RAMPS.keys())
RAMP_ID = {k: i for i, k in enumerate(RAMP_NAMES)}
INK = q555(hexrgb('#1a1226'))
WHITE = q555(hexrgb('#fffaf0'))

# Bayer 4x4 (0..15)
BAYER4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], dtype=np.float32) / 16.0


# --------------------------------------------------------------------------- Canvas


class Canvas:
    def __init__(self, w: int, h: int):
        self.w, self.h = w, h
        self.px = np.zeros((h, w, 4), np.uint8)
        self.rid = np.full((h, w), -1, np.int16)  # Rampe je Pixel (für Outline)

    # -- grundlegend
    def inb(self, x, y):
        return 0 <= x < self.w and 0 <= y < self.h

    def put(self, x, y, color, rid=-1):
        x, y = int(x), int(y)
        if self.inb(x, y):
            self.px[y, x, :3] = color
            self.px[y, x, 3] = 255
            self.rid[y, x] = rid

    def put_ramp(self, x, y, ramp, idx):
        c = RAMPS[ramp][max(0, min(len(RAMPS[ramp]) - 1, idx))]
        self.put(x, y, c, RAMP_ID[ramp])

    def alpha(self, x, y):
        return self.inb(x, y) and self.px[int(y), int(x), 3] > 0

    def clear_pixel(self, x, y):
        if self.inb(x, y):
            self.px[y, x] = 0
            self.rid[y, x] = -1

    def blit(self, other: 'Canvas', ox=0, oy=0, flip=False):
        src = other.px[:, ::-1] if flip else other.px
        sr = other.rid[:, ::-1] if flip else other.rid
        h, w = src.shape[:2]
        x0, y0 = max(0, ox), max(0, oy)
        x1, y1 = min(self.w, ox + w), min(self.h, oy + h)
        if x1 <= x0 or y1 <= y0:
            return
        sx0, sy0 = x0 - ox, y0 - oy
        sub = src[sy0:sy0 + (y1 - y0), sx0:sx0 + (x1 - x0)]
        subr = sr[sy0:sy0 + (y1 - y0), sx0:sx0 + (x1 - x0)]
        m = sub[:, :, 3] > 0
        self.px[y0:y1, x0:x1][m] = sub[m]
        self.rid[y0:y1, x0:x1][m] = subr[m]

    def copy(self):
        c = Canvas(self.w, self.h)
        c.px = self.px.copy()
        c.rid = self.rid.copy()
        return c

    def flipped(self):
        c = Canvas(self.w, self.h)
        c.px = self.px[:, ::-1].copy()
        c.rid = self.rid[:, ::-1].copy()
        return c

    # -- Primitive
    def rect(self, x0, y0, x1, y1, ramp, idx):
        for y in range(int(y0), int(y1) + 1):
            for x in range(int(x0), int(x1) + 1):
                self.put_ramp(x, y, ramp, idx)

    def line(self, x0, y0, x1, y1, ramp, idx):
        x0, y0, x1, y1 = int(x0), int(y0), int(x1), int(y1)
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx = 1 if x0 < x1 else -1
        sy = 1 if y0 < y1 else -1
        err = dx + dy
        while True:
            self.put_ramp(x0, y0, ramp, idx)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x0 += sx
            if e2 <= dx:
                err += dx
                y0 += sy

    def pixels(self, pts, ramp, idx):
        for (x, y) in pts:
            self.put_ramp(x, y, ramp, idx)

    # -- Outline (Sel-Out): hell an Lichtseiten (oben/links), dunkel an Schattenseiten
    def outline(self, dark=0, lit=1):
        a = self.px[:, :, 3] > 0
        H, W = a.shape
        out = []
        for y in range(-1, H + 1):
            for x in range(-1, W + 1):
                if 0 <= x < W and 0 <= y < H and a[y, x]:
                    continue
                best = None
                for (dx, dy, is_lit) in ((0, 1, True), (1, 0, True), (0, -1, False), (-1, 0, False)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < W and 0 <= ny < H and a[ny, nx]:
                        # Nachbar liegt unten/rechts -> wir sind oben/links = Lichtseite
                        r = self.rid[ny, nx]
                        pr = (is_lit, r)
                        if best is None or (not pr[0]):
                            best = pr
                if best is not None and 0 <= x < W and 0 <= y < H:
                    out.append((x, y, best))
        for (x, y, (is_lit, r)) in out:
            if r < 0:
                self.put(x, y, INK, -1)
            else:
                name = RAMP_NAMES[r]
                self.put(x, y, RAMPS[name][lit if is_lit else dark], r)

    def colors(self):
        a = self.px[:, :, 3] > 0
        return {tuple(c) for c in self.px[a][:, :3].tolist()}

    # -- Export
    def to_image(self):
        return Image.fromarray(self.px, 'RGBA')


# --------------------------------------------------------------------------- Shading


def quant(L, n_lo, n_hi, x, y, dw=0.14):
    """L in 0..1 -> Rampenindex zwischen n_lo..n_hi mit Schachbrett-Dither im Übergang"""
    span = n_hi - n_lo
    v = max(0.0, min(1.0, L)) * span
    base = int(math.floor(v))
    f = v - base
    if base >= span:
        return n_hi
    if f < 0.5 - dw:
        return n_lo + base
    if f > 0.5 + dw:
        return n_lo + base + 1
    return n_lo + base + (1 if (x + y) % 2 == 0 else 0)


def quant_bayer(L, n_lo, n_hi, x, y):
    span = n_hi - n_lo
    v = max(0.0, min(1.0, L)) * span
    base = int(math.floor(v))
    f = v - base
    if base >= span:
        return n_hi
    return n_lo + base + (1 if f > BAYER4[y % 4, x % 4] else 0)


LIGHT = np.array([-0.55, -0.65, 0.52])
LIGHT = LIGHT / np.linalg.norm(LIGHT)


def sphere_L(nx, ny, ambient=0.18, gloss=0.0):
    d = nx * nx + ny * ny
    if d >= 1:
        return None
    nz = math.sqrt(1 - d)
    dot = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]
    L = ambient + (1 - ambient) * max(0.0, dot)
    return L


def ellipse(c: Canvas, cx, cy, rx, ry, ramp, lo=1, hi=4, ambient=0.2, bias=0.0, dither='check',
            spec=None, flatness=0.0, clip=None):
    """schattierte Kugel/Ellipse. flatness 0..1 macht sie flacher (mehr Fläche in Mitteltönen)."""
    rid = RAMP_ID[ramp]
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            nx = (x + 0.5 - cx) / rx
            ny = (y + 0.5 - cy) / ry
            L = sphere_L(nx, ny, ambient)
            if L is None:
                continue
            if clip is not None and not clip(x, y):
                continue
            L = L * (1 - flatness) + 0.62 * flatness + bias
            idx = quant(L, lo, hi, x, y) if dither == 'check' else quant_bayer(L, lo, hi, x, y)
            c.put(x, y, RAMPS[ramp][idx], rid)
    if spec:
        sx, sy, si = spec
        c.put_ramp(int(sx), int(sy), ramp, si)


def mask_fill(c: Canvas, mask_fn, ramp, shade_fn, lo=1, hi=4, bounds=None, dither='check'):
    """beliebige Form: mask_fn(x,y)->bool; shade_fn(x,y)->L"""
    x0, y0, x1, y1 = bounds
    rid = RAMP_ID[ramp]
    for y in range(int(y0), int(y1) + 1):
        for x in range(int(x0), int(x1) + 1):
            if mask_fn(x, y):
                L = shade_fn(x, y)
                idx = quant(L, lo, hi, x, y) if dither == 'check' else quant_bayer(L, lo, hi, x, y)
                c.put(x, y, RAMPS[ramp][idx], rid)


def round_rect(c: Canvas, x0, y0, x1, y1, ramp, lo=1, hi=4, radius=2, ambient=0.28, bias=0.0, vgrad=0.0,
               dither='check'):
    """abgerundetes Rechteck, Licht von links oben, leichte Wölbung"""
    w = x1 - x0 + 1
    h = y1 - y0 + 1
    rid = RAMP_ID[ramp]

    def inside(x, y):
        if x < x0 or x > x1 or y < y0 or y > y1:
            return False
        dx = max(x0 + radius - x, 0, x - (x1 - radius))
        dy = max(y0 + radius - y, 0, y - (y1 - radius))
        return dx * dx + dy * dy <= radius * radius + 0.25

    for y in range(int(y0), int(y1) + 1):
        for x in range(int(x0), int(x1) + 1):
            if not inside(x, y):
                continue
            u = (x - x0 + 0.5) / w
            v = (y - y0 + 0.5) / h
            # Wölbung: Licht von links oben
            L = 0.78 - 0.32 * u - 0.30 * v + (0.14 if (u < 0.2 or v < 0.2) else 0) - vgrad * v + bias
            L = ambient + (1 - ambient) * max(0.0, min(1.0, L))
            idx = quant(L, lo, hi, x, y) if dither == 'check' else quant_bayer(L, lo, hi, x, y)
            c.put(x, y, RAMPS[ramp][idx], rid)


def thick_line(c: Canvas, x0, y0, x1, y1, w, ramp, lo=1, hi=4, ambient=0.3):
    """schattierter Zylinder (Arm, Bein, Schwanz, Stiel)"""
    dx, dy = x1 - x0, y1 - y0
    ln = math.hypot(dx, dy) or 1.0
    ux, uy = dx / ln, dy / ln
    px_, py_ = -uy, ux  # Normale
    rid = RAMP_ID[ramp]
    r = w / 2.0
    minx, maxx = int(min(x0, x1) - r - 1), int(max(x0, x1) + r + 2)
    miny, maxy = int(min(y0, y1) - r - 1), int(max(y0, y1) + r + 2)
    lp = LIGHT[0] * px_ + LIGHT[1] * py_  # Lichtanteil quer zur Achse
    for y in range(miny, maxy):
        for x in range(minx, maxx):
            qx, qy = x + 0.5 - x0, y + 0.5 - y0
            t = qx * ux + qy * uy
            s = qx * px_ + qy * py_
            if t < -0.5 or t > ln + 0.5:
                # runde Kappen
                tt = max(0.0, min(ln, t))
                dist = math.hypot(qx - tt * ux, qy - tt * uy)
                if dist > r:
                    continue
                s = max(-r, min(r, s))
            elif abs(s) > r:
                continue
            nn = max(-1.0, min(1.0, s / r))
            nz = math.sqrt(max(0.0, 1 - nn * nn))
            dot = nn * lp + nz * LIGHT[2]
            L = ambient + (1 - ambient) * max(0.0, dot)
            c.put(x, y, RAMPS[ramp][quant(L, lo, hi, x, y)], rid)


def texture_noise(x, y, seed=0):
    h = (x * 374761393 + y * 668265263 + seed * 2147483647) & 0xFFFFFFFF
    h = (h ^ (h >> 13)) * 1274126177 & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFF) / 65535.0


def point_in_poly(x, y, pts):
    inside = False
    n = len(pts)
    j = n - 1
    for i in range(n):
        xi, yi = pts[i]
        xj, yj = pts[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi):
            inside = not inside
        j = i
    return inside


def poly(c: Canvas, pts, ramp, lo=1, hi=4, bias=0.0, ambient=0.0, flat=None, dither='check'):
    """schattiertes Polygon (Licht von links oben über die Bounding-Box)"""
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    rid = RAMP_ID[ramp]
    for y in range(int(math.floor(y0)), int(math.ceil(y1)) + 1):
        for x in range(int(math.floor(x0)), int(math.ceil(x1)) + 1):
            if point_in_poly(x + 0.5, y + 0.5, pts):
                if flat is not None:
                    idx = flat
                else:
                    u = (x - x0 + 0.5) / (x1 - x0 + 1)
                    v = (y - y0 + 0.5) / (y1 - y0 + 1)
                    L = 0.88 - 0.40 * u - 0.36 * v + bias
                    idx = quant(max(0.0, min(1.0, L)), lo, hi, x, y) if dither == 'check' else quant_bayer(L, lo, hi, x, y)
                c.put(x, y, RAMPS[ramp][idx], rid)


# --------------------------------------------------------------------------- Palette-treues Abdunkeln

_DARK_CACHE = {}


def _code(c):
    return (int(c[0]) << 16) | (int(c[1]) << 8) | int(c[2])


def darken_palette(rgb: np.ndarray, steps: int = 1) -> np.ndarray:
    """Dunkelt Pixel um `steps` Rampenstufen ab und bleibt dabei in der Master-Palette
    (statt Farben zu multiplizieren, die dann außerhalb der 122 Farben liegen). rgb: uint8 (..., 3)."""
    if 'lut' not in _DARK_CACHE:
        where = {}
        for name, ramp in RAMPS.items():
            for i, c in enumerate(ramp):
                where.setdefault(_code(c), (name, i))
        _DARK_CACHE['lut'] = where
    where = _DARK_CACHE['lut']
    flat = rgb.reshape(-1, 3)
    codes = (flat[:, 0].astype(np.uint32) << 16) | (flat[:, 1].astype(np.uint32) << 8) | flat[:, 2].astype(np.uint32)
    uniq, inv = np.unique(codes, return_inverse=True)
    mapped = np.zeros((len(uniq), 3), np.uint8)
    pal_codes = np.array(list(where.keys()), np.int64)
    for k, u in enumerate(uniq):
        u = int(u)
        if u not in where:                      # Farbe außerhalb der Palette: nächste Palettenfarbe suchen
            r, g, b = (u >> 16) & 255, (u >> 8) & 255, u & 255
            pr, pg, pb = (pal_codes >> 16) & 255, (pal_codes >> 8) & 255, pal_codes & 255
            d = (pr - r) ** 2 + (pg - g) ** 2 + (pb - b) ** 2
            u = int(pal_codes[int(np.argmin(d))])
        name, i = where[u]
        mapped[k] = RAMPS[name][max(0, i - steps)]
    return mapped[inv.reshape(-1)].reshape(rgb.shape)


def palette_violations(img: Image.Image) -> int:
    """Anzahl der Farben im Bild (nur deckende Pixel), die nicht in der Master-Palette liegen"""
    pal = {_code(c) for r in RAMPS.values() for c in r} | {_code(INK), _code(WHITE)}
    a = np.array(img.convert('RGBA'))
    px = a[a[:, :, 3] > 0][:, :3].astype(np.uint32)
    codes = np.unique((px[:, 0] << 16) | (px[:, 1] << 8) | px[:, 2])
    return int(sum(1 for c in codes if int(c) not in pal))


# --------------------------------------------------------------------------- Ausgabe


def upscale(img: Image.Image, k: int):
    return img.resize((img.width * k, img.height * k), Image.NEAREST)


def sheet(entries, cols, cell_w, cell_h, scale=4, bg='#2b2540', label=True, pad=8, label_h=14):
    """entries: [(name, Canvas)], Kontaktbogen"""
    rows = (len(entries) + cols - 1) // cols
    W = cols * (cell_w * scale + pad) + pad
    H = rows * (cell_h * scale + pad + (label_h if label else 0)) + pad
    img = Image.new('RGBA', (W, H), hexrgb(bg) + (255,))
    d = ImageDraw.Draw(img)
    font = label_font(11)
    for i, (name, cv) in enumerate(entries):
        r, cidx = divmod(i, cols)
        ox = pad + cidx * (cell_w * scale + pad)
        oy = pad + r * (cell_h * scale + pad + (label_h if label else 0))
        tile = upscale(cv.to_image(), scale)
        # leichtes Schachbrett als Hintergrund der Zelle
        d.rectangle([ox, oy, ox + cell_w * scale - 1, oy + cell_h * scale - 1], fill=hexrgb('#383250') + (255,))
        img.alpha_composite(tile, (ox + (cell_w * scale - tile.width) // 2, oy + (cell_h * scale - tile.height) // 2))
        if label:
            d.text((ox, oy + cell_h * scale + 2), name, fill=(235, 230, 245, 255), font=font)
    return img



# --------------------------------------------------------------------------- Szene mit Tiefenpuffer


class World:
    """Pixelgenaue Szene mit Tiefenpuffer: Objekte mit größerem Schlüssel (Fußpunkt-y) liegen davor."""

    def __init__(self, w, h):
        self.w, self.h = w, h
        self.px = np.zeros((h, w, 4), np.uint8)
        self.px[:, :, 3] = 255
        self.depth = np.full((h, w), -100, np.int32)

    def copy(self):
        c = World(self.w, self.h)
        c.px = self.px.copy()
        c.depth = self.depth.copy()
        return c

    def draw(self, sprite: 'Canvas', x, y, key, flip=False):
        src = sprite.px[:, ::-1] if flip else sprite.px
        h, w = src.shape[:2]
        x0, y0 = max(0, int(x)), max(0, int(y))
        x1, y1 = min(self.w, int(x) + w), min(self.h, int(y) + h)
        if x1 <= x0 or y1 <= y0:
            return
        sx0, sy0 = x0 - int(x), y0 - int(y)
        sub = src[sy0:sy0 + (y1 - y0), sx0:sx0 + (x1 - x0)]
        dep = self.depth[y0:y1, x0:x1]
        m = (sub[:, :, 3] > 0) & (dep <= key)
        self.px[y0:y1, x0:x1][m] = sub[m]
        dep[m] = key

    def image(self):
        return Image.fromarray(self.px, 'RGBA')
