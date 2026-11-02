# -*- coding: utf-8 -*-
"""Zeichenbausteine für die Booster-Packs (Canvas 192x320, alles Pixelart, Farben nur aus der Spiel-Palette).

Ein Pack besteht aus
  rgb   – Farbe je Pixel (float, wird erst ganz am Ende auf die Palette gerastet; Dithering steckt schon drin)
  body  – Umriss des Packs (mit gezackten Siegelkanten oben/unten)
  wt    – Foil-Gewicht 0..1: wie stark der Schimmer-Streifen dieses Pixel erfasst (Text/Rahmen 1.0, Hintergrund ~0.5, Kunst ~0.2)
"""
import math
import numpy as np
from PIL import Image
import pal, pxfont

W, H = 192, 320
YY, XX = np.mgrid[0:H, 0:W]
_B4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0
BAY = np.tile(_B4, (H // 4, W // 4))                       # Bayer 4x4 über das ganze Pack
BAY2 = np.tile(np.array([[0, 2], [3, 1]]) / 4.0, (H // 2, W // 2))


def dith(amp):
    return ((BAY - 0.5) * amp)[..., None]


# ---------- Maskenwerkzeuge ----------
def shift(m, dx, dy):
    o = np.zeros_like(m)
    h, w = m.shape[:2]
    x0, x1 = max(dx, 0), w + min(dx, 0)
    y0, y1 = max(dy, 0), h + min(dy, 0)
    if x1 > x0 and y1 > y0:
        o[y0:y1, x0:x1] = m[y0 - dy:y1 - dy, x0 - dx:x1 - dx]
    return o


def dilate(m, r):
    o = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx or dy:
                o |= shift(m, dx, dy)
    return o


def erode(m, r):
    return ~dilate(~m, r)


def rect_mask(x0, y0, x1, y1):
    return (XX >= x0) & (XX < x1) & (YY >= y0) & (YY < y1)


def chamfer_mask(x0, y0, x1, y1, c):
    m = rect_mask(x0, y0, x1, y1)
    for (cx, cy, sx, sy) in ((x0, y0, 1, 1), (x1 - 1, y0, -1, 1), (x0, y1 - 1, 1, -1), (x1 - 1, y1 - 1, -1, -1)):
        d = (np.abs(XX - cx) + np.abs(YY - cy))
        m &= ~(((XX - cx) * sx <= c) & ((YY - cy) * sy <= c) & (d < c))
    return m


# ---------- Metalle ----------
METAL = {
    # hell, mittel, dunkel, Kontur, Glanz
    'gold':     ['#fad54a', '#f29a3e', '#ee6428', '#b62600', '#f7f7ad'],
    'silver':   ['#e8ecf2', '#b8bcc8', '#808898', '#323232', '#ffffff'],
    'rose':     ['#ffc8d8', '#ff7aa8', '#c4286a', '#5a0a2a', '#ffffff'],
    'bronze':   ['#e8b878', '#b8742c', '#7a4418', '#2a1408', '#f7e0b0'],
    'cyan':     ['#bff4ff', '#4cc8f0', '#1a78c8', '#0c2a5a', '#ffffff'],
    'violet':   ['#e0c8ff', '#a070f0', '#5a2aa8', '#1e0a3c', '#ffffff'],
    'emerald':  ['#c8ffd8', '#44d888', '#1a8a50', '#0a3a22', '#f0fff0'],
}


def metal(name):
    return [pal.snap1(h) for h in METAL[name]]


class Pack:
    def __init__(self):
        self.rgb = np.zeros((H, W, 3))
        self.wt = np.zeros((H, W))
        self.sparks = []        # (x, y, r_max, phase, tint)
        # Körper mit Siegelzacken (Zahnbreite 8, Tiefe 4)
        tri = np.abs((np.arange(W) % 8) - 4)               # 4,3,2,1,0,1,2,3
        top = YY < tri[None, :]
        bot = YY >= (H - tri[None, :])
        self.body = ~(top | bot)
        self.body &= (XX >= 0) & (XX < W)

    # --- Malen ---
    def paint(self, mask, color, wt=None, d=0):
        m = mask & self.body
        col = np.asarray(color, float)
        if col.ndim == 3:
            self.rgb[m] = col[m]
        else:
            self.rgb[m] = col
        if d:
            self.rgb[m] += ((BAY - 0.5) * d)[m][:, None]
        if wt is not None:
            self.wt[m] = wt
        return m

    def tint(self, mask, to, t, wt=None):
        m = mask & self.body
        self.rgb[m] = pal.mix(self.rgb[m], to, t)
        if wt is not None:
            self.wt[m] = np.maximum(self.wt[m], wt)

    def bevel(self, mask, hl=0.5, sh=0.4, hl_col=(255, 255, 255), sh_col=(0, 0, 0), wt=None):
        mask = mask & self.body
        tl = mask & ~(shift(mask, 1, 0) & shift(mask, 0, 1))
        br = mask & ~(shift(mask, -1, 0) & shift(mask, 0, -1)) & ~tl
        self.rgb[br] = pal.mix(self.rgb[br], sh_col, sh)
        self.rgb[tl] = pal.mix(self.rgb[tl], hl_col, hl)
        if wt is not None:
            self.wt[tl | br] = np.maximum(self.wt[tl | br], wt)

    def shadow(self, mask, dx=2, dy=2, k=0.5):
        s = shift(mask, dx, dy) & ~mask & self.body
        self.rgb[s] *= (1 - k)

    def finish(self):
        """Palette + harte Alphakante. Gibt (H,W,4) uint8 zurück."""
        rgb = pal.snap(self.rgb)
        out = np.zeros((H, W, 4), np.uint8)
        out[..., :3] = rgb
        out[..., 3] = np.where(self.body, 255, 0)
        out[~self.body, :3] = 0
        return out


# ---------- Hintergründe ----------
def gradient(stops, amp=26):
    """Senkrechter Mehrstufenverlauf [(pos, '#hex')...] mit Bayer-Dithering -> (H,W,3)."""
    ys = np.linspace(0, 1, H)
    ps = [p for p, _ in stops]
    cs = np.array([pal.hexrgb(c) for _, c in stops])
    col = np.stack([np.interp(ys, ps, cs[:, k]) for k in range(3)], -1)
    return col[:, None, :] + np.zeros((1, W, 1)) + dith(amp)


def pattern_mask(name, seed=1):
    x, y = XX, YY
    if name == 'diamonds':
        return (((x + y) % 16) < 2) | (((x - y) % 16) < 2)
    if name == 'stars':
        cx, cy = x % 24, y % 24
        row = (y // 24) % 2
        cx = (x + 12 * row) % 24
        return ((np.abs(cx - 12) + np.abs(cy - 12)) <= 3) & ~((np.abs(cx - 12) + np.abs(cy - 12)) == 2) | ((cx == 12) & (np.abs(cy - 12) <= 4)) | ((cy == 12) & (np.abs(cx - 12) <= 4))
    if name == 'scales':
        r = 7
        row = (y // 8) % 2
        cx = (x + 8 * row) % 16 - 8
        cy = y % 8
        d = np.hypot(cx, cy - 0)
        return (np.abs(d - r) < 1.0) & (cy < 8)
    if name == 'waves':
        return ((y + (3 * np.round(2 * np.sin(x / 9.0))).astype(int)) % 12) < 2
    if name == 'dots':
        return ((x % 12) < 2) & ((y % 12) < 2) | (((x + 6) % 12) < 2) & (((y + 6) % 12) < 2)
    if name == 'hex':
        row = (y // 10) % 2
        cx = (x + 9 * row) % 18
        return (cx < 1) | ((y % 10) < 1) & ((cx % 18) < 9)
    if name == 'circuit':
        rng = np.random.RandomState(seed)
        m = np.zeros((H, W), bool)
        for gy in range(0, H, 16):
            for gx in range(0, W, 16):
                k = rng.randint(0, 5)
                if k == 0:
                    m[gy + 8, gx:gx + 16] = True
                elif k == 1:
                    m[gy:gy + 16, gx + 8] = True
                elif k == 2:
                    m[gy + 8, gx + 8:gx + 16] = True; m[gy + 8:gy + 16, gx + 8] = True
                elif k == 3:
                    m[gy + 8, gx:gx + 9] = True; m[gy:gy + 9, gx + 8] = True
                if k < 4:
                    m[gy + 7:gy + 10, gx + 7:gx + 10] |= (rng.rand() < 0.4)
        return m
    if name == 'chevrons':
        return (((y + np.abs(x - W // 2) // 2) % 14) < 2)
    if name == 'checker':
        return (((x // 8) + (y // 8)) % 2) == 0
    return np.zeros((H, W), bool)


def burst(rect, c1, c2, glow, rays=16, rot=0.0, glow_r=0.75, amp=26, glow_pow=0.8, center=None):
    """Strahlenkranz mit Leuchtmitte als (H,W,3)-Farbfeld (nur innerhalb von rect später übernehmen)."""
    x0, y0, x1, y1 = rect
    cx, cy = center or ((x0 + x1) / 2, (y0 + y1) / 2)
    ang = np.arctan2(YY - cy, XX - cx) + rot
    wedge = np.floor(ang / (2 * math.pi) * rays * 2).astype(int) % 2
    base = np.where(wedge[..., None] == 0, np.asarray(c1, float), np.asarray(c2, float))
    r = np.hypot(XX - cx, (YY - cy) * 1.15) / (max(x1 - x0, y1 - y0) * glow_r)
    g = np.clip(1 - r, 0, 1) ** glow_pow
    col = base * (1 - g[..., None]) + np.asarray(glow, float) * g[..., None]
    return col + dith(amp)


# ---------- Rahmen / Platten ----------
def ring_depth(mask, maxd=7):
    """Abstand (Schachbrett) jedes Maskenpixels zum Rand: 1 = Randpixel."""
    d = np.zeros(mask.shape, int)
    cur = mask.copy()
    for k in range(1, maxd + 1):
        er = erode(cur, 1)
        d[cur & ~er] = k
        cur = er
    d[cur] = maxd + 1
    return d


def frame(P, mask, mt, thick=5, wt=1.0, inner_shadow=True):
    """Metallrahmen mit Kontur, Glanzkante (oben/links hell, unten/rechts dunkel) und Innenschatten."""
    light, mid, dark, outl, glanz = mt
    d = ring_depth(mask, thick + 3)
    ys, xs = np.where(mask)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    u = (XX - x0) / max(1, x1 - x0) + (YY - y0) / max(1, y1 - y0)
    tl = u < 1.0
    stripe = (((XX + YY) % 40) < 5)
    ring = mask & (d <= thick)
    col = np.zeros((H, W, 3))
    # d: 1 Kontur, 2 Glanz/Schatten, 3.. Mitte, letzte Linie Kontur
    for k in range(1, thick + 1):
        sel = ring & (d == k)
        if k == 1:
            c = np.broadcast_to(outl, (H, W, 3))
        elif k == 2:
            c = np.where(tl[..., None], glanz, dark)
        elif k == thick:
            c = np.broadcast_to(outl, (H, W, 3))
        elif k == thick - 1:
            c = np.where(tl[..., None], dark, light)
        else:
            c = np.where(stripe[..., None], light, mid)
        col = np.where(sel[..., None], c, col)
    P.paint(ring, col, wt=wt)
    if inner_shadow:
        inner = mask & (d > thick)
        s1 = inner & (shift(~inner, 1, 0) | shift(~inner, 0, 1))        # linke/obere Innenkante
        s2 = inner & shift(s1, 1, 1) & ~s1
        P.rgb[s1 & P.body] *= 0.45
        P.rgb[s2 & P.body] *= 0.7
    return mask & (d > thick)


def plate(P, mask, top, bottom, mt, thick=4, wt=0.8, amp=18):
    """Dunkle Schriftplatte mit Metallrand."""
    ys, xs = np.where(mask)
    y0, y1 = ys.min(), ys.max()
    t = np.clip((YY - y0) / max(1, y1 - y0), 0, 1)[..., None]
    col = np.asarray(top, float) * (1 - t) + np.asarray(bottom, float) * t + dith(amp)
    P.paint(mask, col, wt=0.5)
    return frame(P, mask, mt, thick=thick, wt=wt)


# ---------- Text ----------
GOLD_BANDS = [(0.14, 4), (0.50, 0), (0.56, 4), (0.80, 1), (1.01, 2)]   # (bis Anteil, Index in Metal-Liste)


def text_canvas(s, cx, y, scale, spacing=None):
    sp = (0 if scale >= 2 else 1) if spacing is None else spacing
    m = pxfont.text_mask(s, scale=scale, spacing=sp)
    h, w = m.shape
    full = np.zeros((H, W), bool)
    x0 = int(round(cx - w / 2))
    ys, xe = slice(max(y, 0), min(y + h, H)), slice(max(x0, 0), min(x0 + w, W))
    full[ys, xe] = m[ys.start - y:ys.stop - y, xe.start - x0:xe.stop - x0]
    return full, (x0, y, w, h)


def draw_text(P, s, cx, y, scale=2, mt=None, outline=2, shadow=2, wt=1.0, bands=None, fill=None, out_cols=None):
    """Glanzschrift: harte Farbbänder wie die Goldzahlen, Kontur in zwei Ringen, Prägekante und Schlagschatten."""
    mt = mt or metal('gold')
    full, (x0, y0, w, h) = text_canvas(s, cx, y, scale)
    big = dilate(full, outline)
    P.shadow(big, shadow, shadow, 0.55)
    ring1 = dilate(full, 1) & ~full
    ring2 = big & ~dilate(full, 1)
    oc = out_cols or (mt[3], pal.darken(mt[3], 0.65))
    P.paint(ring1, oc[0], wt=0.9)
    if outline > 1:
        P.paint(ring2, oc[1], wt=0.6)
    # Farbbänder entlang der Zeilenhöhe der Glyphen
    ys, _ = np.where(full)
    t0, t1 = ys.min(), ys.max() + 1
    frac = np.clip((YY - t0) / float(t1 - t0), 0, 0.999)
    col = np.zeros((H, W, 3))
    bands = bands or GOLD_BANDS
    prev = 0.0
    for end, idx in bands:
        sel = (frac >= prev) & (frac < end)
        col[sel] = fill[idx] if fill is not None else mt[idx]
        prev = end
    P.paint(full, col, wt=wt)
    P.bevel(full, hl=0.65, sh=0.45, hl_col=mt[4], sh_col=mt[3], wt=wt)
    return full


def draw_text_flat(P, s, cx, y, color, mt=None, wt=0.9, spacing=None):
    """Kleine Schrift (1x): einfarbig mit dunkler Kontur."""
    mt = mt or metal('gold')
    full, _ = text_canvas(s, cx, y, 1, spacing)
    ring = dilate(full, 1) & ~full
    P.shadow(dilate(full, 1), 1, 1, 0.5)
    P.paint(ring, pal.darken(mt[3], 0.5), wt=0.5)
    P.paint(full, color, wt=wt)
    return full


# ---------- Sprites / Kunst ----------
def to_np(im):
    return np.asarray(im.convert('RGBA'))


def scaled(im, k):
    if k == 1:
        return im
    return im.resize((im.width * k, im.height * k), Image.NEAREST)


def blit(P, im, x, y, wt=0.2, outline=None, mask_clip=None):
    """RGBA-Bild (harte Alpha) an (x,y) legen; optional 1px Kontur."""
    a = to_np(im)
    h, w = a.shape[:2]
    full_rgb = np.zeros((H, W, 3))
    full_m = np.zeros((H, W), bool)
    ys0, xs0 = max(y, 0), max(x, 0)
    ys1, xs1 = min(y + h, H), min(x + w, W)
    if ys1 <= ys0 or xs1 <= xs0:
        return full_m
    sub = a[ys0 - y:ys1 - y, xs0 - x:xs1 - x]
    full_rgb[ys0:ys1, xs0:xs1] = sub[..., :3]
    full_m[ys0:ys1, xs0:xs1] = sub[..., 3] > 127
    if mask_clip is not None:
        full_m &= mask_clip
    if outline is not None:
        ring = dilate(full_m, 1) & ~full_m
        if mask_clip is not None:
            ring &= mask_clip
        P.paint(ring, outline, wt=0.4)
    P.paint(full_m, full_rgb, wt=wt)
    return full_m


def trim(im):
    bb = im.getbbox()
    return im.crop(bb) if bb else im


def crop_center(im, w, h, fx=0.5, fy=0.5):
    """Mitte-Ausschnitt (w x h) eines Bildes; ist es kleiner, bleibt der Rest leer (hier nicht vorgesehen)."""
    x0 = int(round((im.width - w) * fx)); y0 = int(round((im.height - h) * fy))
    x0 = max(0, min(im.width - w, x0)); y0 = max(0, min(im.height - h, y0))
    return im.crop((x0, y0, x0 + w, y0 + h))


def ground_shadow(P, cx, cy, rx, ry):
    m = (((XX - cx) / rx) ** 2 + ((YY - cy) / ry) ** 2) <= 1
    chk = ((XX + YY) % 2) == 0
    P.rgb[m & chk & P.body] *= 0.45
    inner = (((XX - cx) / (rx * 0.6)) ** 2 + ((YY - cy) / (ry * 0.6)) ** 2) <= 1
    P.rgb[inner & P.body] *= 0.7


# ---------- Sparkles ----------
def star(rgb, cx, cy, r, col, core=(255, 255, 255)):
    """Vierzackiger Pixelstern mit Radius r (0 = nichts) direkt in ein (H,W,3)-Feld zeichnen."""
    if r <= 0:
        return
    pts = [(0, 0, core)]
    for k in range(1, r + 1):
        c = core if k <= (r + 1) // 3 else col
        pts += [(k, 0, c), (-k, 0, c), (0, k, c), (0, -k, c)]
    if r >= 3:
        for k in (1, 2):
            pts += [(k, k, col), (-k, k, col), (k, -k, col), (-k, -k, col)] if k <= r // 2 else []
    for dx, dy, c in pts:
        x, y = int(cx + dx), int(cy + dy)
        if 0 <= x < W and 0 <= y < H:
            rgb[y, x] = c


def twinkle_r(phase, f, nf, rmax):
    """Radius des Funkelns in Bild f von nf (Schleife)."""
    t = ((f / nf) + phase) % 1.0
    if t > 0.5:
        return 0
    k = math.sin(t / 0.5 * math.pi)
    return int(round(k * rmax))
