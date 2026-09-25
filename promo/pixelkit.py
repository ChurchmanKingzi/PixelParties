"""
pixelkit — kleines Werkzeug zum prozeduralen Bauen von Pixelart-Sprites.

Ein Sprite wird aus Teilen (Masken) zusammengesetzt. Jedes Teil hat eine
Farbrampe (dunkel → hell) und wird automatisch schattiert (Licht von oben
links). Beim Rendern kommen Kontaktschatten zwischen Teilen und eine
selektive Außenkontur (dunkelste Farbe der jeweiligen Rampe) dazu.

Nur numpy + Pillow, keine weiteren Abhängigkeiten.
"""
import math

import numpy as np
from PIL import Image, ImageDraw


# ─────────────────────────── Formen (bool-Masken) ───────────────────────────

class Shapes:
    def __init__(self, w, h):
        self.w, self.h = w, h
        yy, xx = np.mgrid[0:h, 0:w]
        # Pixelmittelpunkte
        self.xx = xx + 0.5
        self.yy = yy + 0.5

    def empty(self):
        return np.zeros((self.h, self.w), bool)

    def poly(self, pts):
        img = Image.new('L', (self.w, self.h), 0)
        ImageDraw.Draw(img).polygon([(float(x), float(y)) for x, y in pts], fill=1)
        return np.array(img, bool)

    def ellipse(self, cx, cy, rx, ry, angle=0.0):
        c, s = math.cos(-angle), math.sin(-angle)
        dx, dy = self.xx - cx, self.yy - cy
        u = dx * c - dy * s
        v = dx * s + dy * c
        return (u / rx) ** 2 + (v / ry) ** 2 <= 1.0

    def seg_dist(self, p0, p1):
        """Abstand jedes Pixels zur Strecke p0-p1 und Parameter t entlang der Strecke."""
        x0, y0 = p0
        x1, y1 = p1
        vx, vy = x1 - x0, y1 - y0
        L2 = vx * vx + vy * vy or 1e-9
        t = ((self.xx - x0) * vx + (self.yy - y0) * vy) / L2
        tc = np.clip(t, 0, 1)
        px = x0 + tc * vx
        py = y0 + tc * vy
        return np.hypot(self.xx - px, self.yy - py), tc

    def capsule(self, p0, p1, r0, r1=None):
        r1 = r0 if r1 is None else r1
        d, t = self.seg_dist(p0, p1)
        return d <= r0 + (r1 - r0) * t

    def chain(self, pts, radii):
        """Mehrgliedrige Kapsel (z. B. Arm: Schulter → Ellbogen → Hand)."""
        m = self.empty()
        for i in range(len(pts) - 1):
            m |= self.capsule(pts[i], pts[i + 1], radii[i], radii[i + 1])
        return m

    def rect(self, x0, y0, x1, y1):
        return (self.xx >= x0) & (self.xx < x1) & (self.yy >= y0) & (self.yy < y1)

    def spike(self, base, tip, width, bend=0.0):
        """Dreieckige Strähne/Stachel von base (Breite width) zur Spitze tip.
        bend krümmt die Spitze seitlich (in Pixeln)."""
        bx, by = base
        tx, ty = tip
        dx, dy = tx - bx, ty - by
        L = math.hypot(dx, dy) or 1e-9
        nx, ny = -dy / L, dx / L
        n = 7
        left, right = [], []
        for i in range(n + 1):
            t = i / n
            off = bend * t * t
            cx = bx + dx * t + nx * off
            cy = by + dy * t + ny * off
            hw = width / 2 * (1 - t) ** 0.9
            left.append((cx + nx * hw, cy + ny * hw))
            right.append((cx - nx * hw, cy - ny * hw))
        return self.poly(left + right[::-1])

    def star(self, cx, cy, r_out, r_in, rot=-math.pi / 2, n=5):
        pts = []
        for i in range(n * 2):
            r = r_out if i % 2 == 0 else r_in
            a = rot + i * math.pi / n
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
        return self.poly(pts)


def shift(m, dx, dy, fill=False):
    """Verschiebt eine Maske um (dx, dy); freiwerdende Pixel = fill."""
    h, w = m.shape
    out = np.full_like(m, fill)
    xs0, xs1 = max(0, -dx), min(w, w - dx)
    ys0, ys1 = max(0, -dy), min(h, h - dy)
    out[ys0 + dy:ys1 + dy, xs0 + dx:xs1 + dx] = m[ys0:ys1, xs0:xs1]
    return out


def dilate(m, r=1):
    out = m.copy()
    for _ in range(r):
        out = out | shift(out, 1, 0) | shift(out, -1, 0) | shift(out, 0, 1) | shift(out, 0, -1)
    return out


def blur(a, sigma):
    if sigma <= 0:
        return a.astype(float)
    r = max(1, int(math.ceil(sigma * 2.5)))
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2)
    k /= k.sum()
    a = a.astype(float)
    p = np.pad(a, r, mode='constant')
    tmp = np.apply_along_axis(lambda v: np.convolve(v, k, mode='valid'), 1, p)
    return np.apply_along_axis(lambda v: np.convolve(v, k, mode='valid'), 0, tmp)


LIGHT = np.array([-0.55, -0.7, 0.45])
LIGHT = LIGHT / np.linalg.norm(LIGHT)


def pillow_shade(mask, sigma=1.6, gain=2.2, bias=0.0, light=LIGHT):
    """Weiche Wölbung aus der Maske ableiten und gegen das Licht rechnen.
    Rückgabe: Stufen-Offset pro Pixel (…, -2, -1, 0, +1, +2, …)."""
    h = blur(mask, sigma)
    gy, gx = np.gradient(h)
    nx, ny, nz = -gx * 3.0, -gy * 3.0, np.ones_like(h)
    L = np.sqrt(nx * nx + ny * ny + nz * nz)
    d = (nx * light[0] + ny * light[1] + nz * light[2]) / L
    return np.round((d - light[2]) * gain + bias).astype(int)


def sphere_shade(shapes, cx, cy, r, gain=2.5, bias=0.0, light=LIGHT):
    """Kugel-Schattierung um (cx, cy) mit Radius r."""
    dx = (shapes.xx - cx) / r
    dy = (shapes.yy - cy) / r
    q = np.clip(dx * dx + dy * dy, 0, 1)
    dz = np.sqrt(1 - q)
    d = dx * light[0] + dy * light[1] + dz * light[2]
    return np.round((d - 0.55) * gain + bias).astype(int)


def linear_shade(shapes, p0, p1, steps):
    """Verlauf von p0 (Offset steps[0]) nach p1 (Offset steps[-1])."""
    x0, y0 = p0
    x1, y1 = p1
    vx, vy = x1 - x0, y1 - y0
    L2 = vx * vx + vy * vy
    t = np.clip(((shapes.xx - x0) * vx + (shapes.yy - y0) * vy) / L2, 0, 0.9999)
    idx = (t * len(steps)).astype(int)
    return np.array(steps)[idx]


BAYER4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0


# ───────────────────────────────── Sprite ─────────────────────────────────

class Ramp:
    def __init__(self, colors, outline, mid=None):
        self.colors = [tuple(c) for c in colors]
        self.outline = tuple(outline)
        self.mid = len(colors) // 2 if mid is None else mid


class Sprite:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.S = Shapes(w, h)
        self.layer = np.full((h, w), -1, int)
        self.group = np.full((h, w), -1, int)
        self.ramp = np.full((h, w), -1, int)
        self.idx = np.zeros((h, w), int)
        self.raw = np.zeros((h, w, 4), np.uint8)   # direkt gesetzte Farben
        self.is_raw = np.zeros((h, w), bool)
        self.no_ol = np.zeros((h, w), bool)         # Pixel ohne Außenkontur (Glow/FX)
        self.ramps = []
        self.groups = {}
        self._layer = 0
        self._ao_skip = set()

    def add_ramp(self, colors, outline, mid=None):
        self.ramps.append(Ramp(colors, outline, mid))
        return len(self.ramps) - 1

    def gid(self, name):
        if name not in self.groups:
            self.groups[name] = len(self.groups)
        return self.groups[name]

    def fill(self, mask, ramp, group, shade=None, idx=None, ao=True, outline=True):
        """Füllt Maske mit Rampe. shade = Offset-Array oder None; idx = feste Stufe."""
        self._layer += 1
        r = self.ramps[ramp]
        base = r.mid if idx is None else idx
        off = 0 if shade is None else shade
        val = np.clip(base + off, 0, len(r.colors) - 1)
        if np.isscalar(val) or np.ndim(val) == 0:
            val = np.full((self.h, self.w), int(val))
        g = self.gid(group)
        self.layer[mask] = self._layer
        self.group[mask] = g
        self.ramp[mask] = ramp
        self.idx[mask] = val[mask]
        self.is_raw[mask] = False
        self.no_ol[mask] = not outline
        if not ao:
            self._ao_skip.add(g)

    def detail(self, mask, ramp, idx, group=None):
        """Detail auf bestehende Pixel malen (gleiche Gruppe, kein Kontaktschatten)."""
        m = mask & (self.ramp >= 0) if group is None else mask
        self.ramp[m] = ramp
        self.idx[m] = np.clip(idx if np.ndim(idx) == 0 else idx[m], 0, len(self.ramps[ramp].colors) - 1)
        self.is_raw[m] = False
        if group is not None:
            self._layer += 1
            self.layer[m] = self._layer
            self.group[m] = self.gid(group)

    def px(self, pts, ramp, idx):
        for x, y in pts:
            if 0 <= x < self.w and 0 <= y < self.h and self.ramp[y, x] >= 0:
                self.ramp[y, x] = ramp
                self.idx[y, x] = idx

    def shade_offset(self, mask, delta):
        m = mask & (self.ramp >= 0)
        self.idx[m] += delta
        # Clamp pro Rampe
        for ri, r in enumerate(self.ramps):
            mm = m & (self.ramp == ri)
            self.idx[mm] = np.clip(self.idx[mm], 0, len(r.colors) - 1)

    def raw_fill(self, mask, rgba, outline=False):
        self._layer += 1
        self.layer[mask] = self._layer
        self.group[mask] = self.gid('_raw')
        self.ramp[mask] = -2
        self.raw[mask] = rgba
        self.is_raw[mask] = True
        self.no_ol[mask] = not outline

    def occupied(self):
        return (self.ramp >= 0) | self.is_raw

    def render(self, ao=True, outline=True, ao_strength=1):
        h, w = self.h, self.w
        idx = self.idx.copy()
        filled = self.ramp >= 0
        skip = self._ao_skip
        if ao:
            occl = np.zeros((h, w), bool)
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nl = shift(self.layer, dx, dy, fill=-1)
                ng = shift(self.group, dx, dy, fill=-1)
                occl |= (ng >= 0) & (ng != self.group) & (nl > self.layer)
            for g in skip:
                occl &= self.group != g
            occl &= filled
            idx[occl] -= ao_strength
        out = np.zeros((h, w, 4), np.uint8)
        for ri, r in enumerate(self.ramps):
            m = self.ramp == ri
            if not m.any():
                continue
            cols = np.array([c + (255,) for c in r.colors], np.uint8)
            out[m] = cols[np.clip(idx[m], 0, len(r.colors) - 1)]
        out[self.is_raw] = self.raw[self.is_raw]
        if outline:
            occ = self.occupied() & ~self.no_ol
            ring = dilate(occ) & ~self.occupied()
            # Konturfarbe: von einem benachbarten Teil (oben/links bevorzugt)
            olc = np.zeros((h, w, 4), np.uint8)
            done = np.zeros((h, w), bool)
            for dx, dy in ((0, 1), (1, 0), (0, -1), (-1, 0)):
                nr = shift(self.ramp, dx, dy, fill=-1)
                nok = shift(occ, dx, dy)
                for ri, r in enumerate(self.ramps):
                    m = ring & ~done & nok & (nr == ri)
                    olc[m] = r.outline + (255,)
                    done |= m
            m = ring & ~done
            olc[m] = (12, 8, 16, 255)
            out[ring] = olc[ring]
            self.outline_mask = ring
        else:
            self.outline_mask = np.zeros((h, w), bool)
        return out


# ─────────────────────────────── Export ───────────────────────────────

def upscale(arr, s):
    return np.repeat(np.repeat(arr, s, axis=0), s, axis=1)


def over(dst, src):
    """Alpha-Compositing src über dst (beides RGBA uint8)."""
    sa = src[..., 3:4].astype(float) / 255
    da = dst[..., 3:4].astype(float) / 255
    oa = sa + da * (1 - sa)
    rgb = (src[..., :3] * sa + dst[..., :3] * da * (1 - sa)) / np.maximum(oa, 1e-6)
    return np.concatenate([rgb, oa * 255], axis=-1).round().astype(np.uint8)


def save_gif(frames, path, durations, loop=0):
    """frames: Liste RGB-/RGBA-Arrays (bereits skaliert). Deckender Hintergrund empfohlen."""
    imgs = [Image.fromarray(f[..., :3]) for f in frames]
    # gemeinsame Palette aus allen Frames bauen, damit nichts flackert
    strip = Image.new('RGB', (imgs[0].width, imgs[0].height * len(imgs)))
    for i, im in enumerate(imgs):
        strip.paste(im, (0, i * imgs[0].height))
    pal = strip.quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    q = [im.quantize(palette=pal, dither=Image.Dither.NONE) for im in imgs]
    q[0].save(path, save_all=True, append_images=q[1:], duration=durations, loop=loop,
              optimize=False, disposal=1)


# ─────────────────────────────── Stempel ───────────────────────────────

def ascii_mask(rows, chars='#'):
    """ASCII-Zeilen → bool-Maske (Zeichen aus chars = gesetzt)."""
    w = max(len(r) for r in rows)
    m = np.zeros((len(rows), w), bool)
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            m[y, x] = ch in chars
    return m


def place(sprite, small, ox, oy):
    """Kleine Maske an Position (ox, oy) in Sprite-Größe einbetten."""
    big = np.zeros((sprite.h, sprite.w), bool)
    h, w = small.shape
    for y in range(h):
        for x in range(w):
            X, Y = ox + x, oy + y
            if small[y, x] and 0 <= X < sprite.w and 0 <= Y < sprite.h:
                big[Y, X] = True
    return big


def stamp(sprite, rows, ox, oy, legend, clip=None):
    """Handgezeichnetes Detail aufmalen. legend: Zeichen → (ramp, idx)."""
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch not in legend:
                continue
            X, Y = ox + x, oy + y
            if not (0 <= X < sprite.w and 0 <= Y < sprite.h):
                continue
            if clip is not None and not clip[Y, X]:
                continue
            ramp, idx = legend[ch]
            sprite.ramp[Y, X] = ramp
            sprite.idx[Y, X] = idx
            sprite.is_raw[Y, X] = False


def erode(m, r=1):
    out = m.copy()
    for _ in range(r):
        out = out & shift(out, 1, 0) & shift(out, -1, 0) & shift(out, 0, 1) & shift(out, 0, -1)
    return out


def rim_light(rgba, color, strength=0.55, dx=1, dy=0, depth=1, outline=None):
    """Randlicht: Pixel, deren Nachbar in Richtung (dx, dy) leer (oder Kontur) ist,
    zur Lichtfarbe mischen. Die Kontur selbst bleibt dunkel."""
    a = rgba[..., 3] > 0
    if outline is not None:
        a = a & ~outline
    out = rgba.copy()
    edge = np.zeros_like(a)
    for k in range(1, depth + 1):
        edge |= a & ~shift(a, -dx * k, -dy * k)
    c = np.array(color, float)
    rgb = out[..., :3].astype(float)
    rgb[edge] = rgb[edge] * (1 - strength) + c * strength
    out[..., :3] = np.clip(rgb, 0, 255).round().astype(np.uint8)
    return out
