#!/usr/bin/env python3
"""Instagram-Post für einen Hero: Karte im Pixel-Rahmen, Sprite ragt heraus, loopend animiert.

Aufruf (aus dem Repo-Root):
    python3 scripts/social-posts/build-post.py zsos-ssar-the-serpent-warlord 

Erzeugt in scripts/social-posts/out/<slug>/:
    post.png        Standbild 1080×1350 (4:5)
    post.mp4        Loop 1080×1350 mit Musik (Feed-Video)
    frames/         Einzelbilder eines Loops (nur Arbeitsdateien)

Alle Maße sind Vielfache eines Rasters von 7 px: die Karte (750 px, 10 px je Kartenpixel) wird
mit BOX auf 525 px verkleinert (10 → 7 px je Kartenpixel, Blockkanten bleiben scharf), der Sprite
ganzzahlig auf 14 px je Sprite-Pixel (= 2 Raster) hochskaliert.
"""
import argparse
import os
import colorsys
import json
import math
import random
import subprocess
import sys
from fractions import Fraction
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

if '--format' in sys.argv and sys.argv[sys.argv.index('--format') + 1] == 'reel':
    os.environ['PP_CANVAS_H'] = '1920'          # muss vor `import pxcommon` gesetzt sein

import fx
import ornaments
from pxcommon import BAYER4, H, INK, NAVY, U, W, WHITE, mix

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
OUT = HERE / 'out'

SPRITE_PX = 14             # px je Sprite-Pixel (2 Raster)
CARD_W, CARD_H = 525, 735  # Karte (750×1050 · 0,7)

# ── Hilfen ────────────────────────────────────────────────────────────────────

def slugify(n):
    import re
    return re.sub(r'^-+|-+$', '', re.sub(r'[^a-z0-9]+', '-', str(n).lower()))


def hexcol(s):
    s = s.lstrip('#')
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


def accent_from_sprite(sheet, meta):
    """Dominanter, kräftiger Farbton des Sprites (Hue-Histogramm, gewichtet nach Sättigung·Helligkeit)."""
    fw, n = meta['frameWidth'], meta['frames']
    a = np.asarray(sheet.convert('RGBA'), dtype=np.float32) / 255.0
    px = a.reshape(-1, 4)
    for thr in (0.9, 0.5, 0.05):                 # durchscheinende Sprites (Geister) haben kaum volle Deckkraft
        sel = px[px[:, 3] > thr][:, :3]
        if len(sel) >= 20:
            break
    px = sel
    if len(px) == 0:
        return (120, 200, 255)
    hsv = np.array([colorsys.rgb_to_hsv(*p) for p in px[::3]])
    ok = (hsv[:, 1] > 0.35) & (hsv[:, 2] > 0.3)
    if not ok.any():
        return (120, 200, 255)
    h = hsv[ok]
    w = h[:, 1] * h[:, 2]
    hist = np.zeros(24)
    for hh, ww in zip(h[:, 0], w):
        hist[int(hh * 24) % 24] += ww
    b = int(hist.argmax())
    sel = (np.floor(h[:, 0] * 24).astype(int) % 24) == b
    hue = float(np.average(h[sel, 0], weights=w[sel]))
    r, g, bl = colorsys.hsv_to_rgb(hue, 0.62, 0.95)
    return (int(r * 255), int(g * 255), int(bl * 255))


# ── Pixel-Schrift ("Pixel Intv", wie auf den Karten) ──────────────────────────
FONT_PATH = ROOT / 'data' / 'Pixel Intv.otf'
_FONT_CACHE = {}


def pixel_text_mask(text):
    """Text als 1-Bit-Maske in Schrift-Pixeln (ein Schrift-Pixel = 1 Maskenpixel)."""
    if text in _FONT_CACHE:
        return _FONT_CACHE[text]
    ss = 8
    font = ImageFont.truetype(str(FONT_PATH), 10.24 * ss)
    l, t, r, b = font.getbbox(text)
    canvas = Image.new('L', (r + ss * 4, (b - t) + ss * 4), 0)
    ImageDraw.Draw(canvas).text((ss * 2, ss * 2 - t), text, font=font, fill=255)
    arr = np.asarray(canvas)
    h, w = arr.shape
    ys = np.arange(ss // 2, h, ss)
    xs = np.arange(ss // 2, w, ss)
    small = (arr[np.ix_(ys, xs)] > 127).astype(np.uint8) * 255
    im = Image.fromarray(small, 'L')
    bb = im.getbbox()
    im = im.crop(bb) if bb else im
    _FONT_CACHE[text] = im
    return im


def draw_text(img, text, scale, xy, color=WHITE, outline=INK, shadow=None, anchor='mm'):
    """Pixel-Text (scale px je Schrift-Pixel) mit Kontur (1 Schrift-Pixel) und optionalem Schatten."""
    m = pixel_text_mask(text)
    big = m.resize((m.width * scale, m.height * scale), Image.NEAREST)
    pad = scale
    base = Image.new('L', (big.width + pad * 2, big.height + pad * 2), 0)
    base.paste(big, (pad, pad))
    edge = base.filter(ImageFilter.MaxFilter(scale * 2 + 1))
    w, h = base.size
    x, y = xy
    if anchor[0] == 'm':
        x -= w // 2
    elif anchor[0] == 'r':
        x -= w
    if anchor[1] == 'm':
        y -= h // 2
    elif anchor[1] == 'b':
        y -= h
    x, y = int(x), int(y)
    if shadow:
        sh = Image.new('RGBA', (w, h), shadow + (255,))
        sm = base.point(lambda v: 255 if v else 0)
        img.paste(sh, (x + scale, y + scale), sm)
    if outline:
        img.paste(Image.new('RGBA', (w, h), outline + (255,)), (x, y), edge.point(lambda v: 255 if v else 0))
    img.paste(Image.new('RGBA', (w, h), color + (255,)), (x, y), base.point(lambda v: 255 if v else 0))
    return (x, y, w, h)


# ── Hintergrund ───────────────────────────────────────────────────────────────


def dither_ramp(v, ramp, cell):
    """v ∈ [0,1] (Form H×W in Pixeln) → Farbbild; Ordered Dithering mit Zellen von `cell` px."""
    h, w = v.shape
    ch, cw = h // cell, w // cell
    vs = v[cell // 2::cell, cell // 2::cell][:ch, :cw]
    th = np.tile(BAYER4, (ch // 4 + 1, cw // 4 + 1))[:ch, :cw]
    n = len(ramp) - 1
    q = np.clip(np.floor(vs * n + th), 0, n).astype(int)
    pal = np.array(ramp, dtype=np.uint8)
    small = pal[q]
    return np.repeat(np.repeat(small, cell, axis=0), cell, axis=1)


class Background:
    """Dithering-Verlauf mit Spotlight und langsam rotierendem Strahlenkranz (Loop = ein Strahlenpaar)."""
    RAYS = 8                      # Strahlenpaare (hell+dunkel) rund um den Mittelpunkt

    def __init__(self, accent, center):
        h, sat, val = colorsys.rgb_to_hsv(*[c / 255 for c in accent])
        deep = tuple(int(c * 255) for c in colorsys.hsv_to_rgb(h, 0.78, 0.66))
        self.ramp = [mix(NAVY, deep, t) for t in (0.03, 0.14, 0.27, 0.42, 0.58, 0.78)]
        ch, cw = -(-H // U), -(-W // U)          # aufgerundet, danach auf W×H beschnitten
        ys = (np.arange(ch) * U + U / 2).astype(np.float32)
        xs = (np.arange(cw) * U + U / 2).astype(np.float32)
        yy, xx = np.meshgrid(ys, xs, indexing='ij')
        dx, dy = xx - center[0], yy - center[1]
        d = np.sqrt((dx / 760) ** 2 + (dy / 820) ** 2)
        self.glow = np.clip(1 - d, 0, 1) ** 1.1
        self.ang = np.arctan2(dy, dx)
        self.base = 0.04 + 0.10 * (yy / H) + 0.50 * self.glow
        self.th = np.tile(BAYER4, (ch // 4 + 1, cw // 4 + 1))[:ch, :cw]
        # festes Punktraster
        dots = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        dd = ImageDraw.Draw(dots)
        dotc = mix(self.ramp[3], accent, 0.35) + (255,)
        step = 9 * U
        for row, y in enumerate(range(2 * U, H, step)):
            for x in range(2 * U + (step // 2 // U * U if row % 2 else 0), W, step):
                dd.rectangle([x, y, x + U - 1, y + U - 1], fill=dotc)
        self.dots = dots
        self.border = ornaments.post_border(accent, (W, H))

    def frame(self, t):
        ray = np.sin((self.ang * self.RAYS + t * 2 * math.pi) )          # t: 0…1 = ein Strahlenpaar weiter
        ray = np.where(ray > 0, 1.0, 0.0)
        v = self.base + 0.26 * ray * np.clip(self.glow * 2.2, 0, 1)
        n = len(self.ramp) - 1
        q = np.clip(np.floor(np.clip(v, 0, 1) * n + self.th), 0, n).astype(int)
        small = np.array(self.ramp, dtype=np.uint8)[q]
        img = np.repeat(np.repeat(small, U, axis=0), U, axis=1)
        im = Image.fromarray(img[:H, :W], 'RGB').convert('RGBA')
        im.alpha_composite(self.dots)
        im.alpha_composite(self.border)
        return im


# ── Rahmen ────────────────────────────────────────────────────────────────────

def bevel_frame(size, accent, thick=32):
    """Pixel-Rahmen mit Fase (hell oben/links, dunkel unten/rechts), Innenkontur und Eck-Nieten."""
    w, h = size
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    light = mix(accent, WHITE, 0.45)
    main = accent
    dark = mix(accent, INK, 0.55)
    deep = mix(accent, INK, 0.8)
    # Stufenecken: Rechteck mit abgeschnittener 1-Raster-Ecke
    def rr(x0, y0, x1, y1, fill):
        d.rectangle([x0 + U, y0, x1 - U, y1], fill=fill)
        d.rectangle([x0, y0 + U, x1, y1 - U], fill=fill)
    rr(0, 0, w - 1, h - 1, INK)                                    # Außenkontur
    rr(U, U, w - 1 - U, h - 1 - U, main)
    # Fase: oben/links hell, unten/rechts dunkel (je 1 Raster)
    d.rectangle([2 * U, U, w - 1 - 2 * U, 2 * U - 1], fill=light)
    d.rectangle([U, 2 * U, 2 * U - 1, h - 1 - 2 * U], fill=light)
    d.rectangle([2 * U, h - 2 * U, w - 1 - 2 * U, h - 1 - U], fill=dark)
    d.rectangle([w - 2 * U, 2 * U, w - 1 - U, h - 1 - 2 * U], fill=dark)
    # zweite Rille (dunkel) innen
    inner = thick - 2 * U
    d.rectangle([inner, inner, w - 1 - inner, h - 1 - inner], fill=deep)
    # Innenkontur / Platz für Karte
    d.rectangle([thick - U, thick - U, w - thick + U - 1, h - thick + U - 1], fill=INK)
    d.rectangle([thick, thick, w - thick - 1, h - thick - 1], fill=(0, 0, 0, 0))
    # Eck-Nieten (3×3 Raster)
    for cx, cy in ((0, 0), (w - 3 * U, 0), (0, h - 3 * U), (w - 3 * U, h - 3 * U)):
        d.rectangle([cx, cy, cx + 3 * U - 1, cy + 3 * U - 1], fill=INK)
        d.rectangle([cx + U, cy + U, cx + 2 * U - 1, cy + 2 * U - 1], fill=light)
    return im


# ── Ebenen ────────────────────────────────────────────────────────────────────

def tinted_logo(accent, px_per=2):
    logo = Image.open(ROOT / 'data' / 'logo.png').convert('RGBA')
    mask = Image.open(ROOT / 'data' / 'logo-tint-mask.png').convert('RGBA').split()[3]
    rgb = np.asarray(logo.convert('RGB'), dtype=np.float32)
    m = (np.asarray(mask, dtype=np.float32) / 255.0)[..., None]
    col = np.array(accent, dtype=np.float32) / 255.0
    out = rgb * (1 - m) + rgb * col * m
    res = Image.fromarray(out.clip(0, 255).astype(np.uint8), 'RGB').convert('RGBA')
    res.putalpha(logo.split()[3])
    # Original: 4 px je Logo-Pixel → standardmäßig 2 px je Logo-Pixel (px_per = 3 → 3 px usw.)
    return res.resize((logo.width * px_per // 4, logo.height * px_per // 4), Image.NEAREST)


def body_mask(frame):
    """Alpha-Maske (0/255) von Körper und anhängenden Teilen. Sprite-eigene Funken und Splitter, die mehr als
    2 Sprite-Pixel vom Körper entfernt schweben, bekommen keine Outline (sonst steckt jeder in einem Kasten)."""
    a = np.asarray(frame.split()[3]) > 40
    h, w = a.shape
    seen = np.zeros((h, w), bool)
    comps = []
    for y0 in range(h):
        for x0 in range(w):
            if a[y0, x0] and not seen[y0, x0]:
                stack, comp = [(y0, x0)], []
                seen[y0, x0] = True
                while stack:
                    y, x = stack.pop()
                    comp.append((y, x))
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            yy, xx = y + dy, x + dx
                            if 0 <= yy < h and 0 <= xx < w and a[yy, xx] and not seen[yy, xx]:
                                seen[yy, xx] = True
                                stack.append((yy, xx))
                comps.append(comp)
    out = np.zeros((h, w), np.uint8)
    if not comps:
        return Image.fromarray(out, 'L')
    main = max(comps, key=len)
    near = np.zeros((h, w), np.uint8)
    for (y, x) in main:
        near[y, x] = 255
    near = np.asarray(Image.fromarray(near, 'L').filter(ImageFilter.MaxFilter(5))) > 0     # 2 Pixel Umkreis
    for comp in comps:
        if comp is main or any(near[y, x] for (y, x) in comp):
            for (y, x) in comp:
                out[y, x] = 255
    return Image.fromarray(out, 'L')


class Sprite:
    def __init__(self, hero_dir_slug, px=SPRITE_PX):
        self.px = px                       # px je Sprite-Pixel (gerade, damit die halben Pixel der Outline aufgehen)
        base = ROOT / 'data' / 'hero-animations'
        self.meta = json.loads((base / (hero_dir_slug + '.json')).read_text(encoding='utf-8'))
        self.sheet = Image.open(base / self.meta['sheet']).convert('RGBA')
        self.fw, self.fh, self.n = self.meta['frameWidth'], self.meta['frameHeight'], self.meta['frames']
        # deckende Unterkante / Oberkante über alle Frames
        a = np.asarray(self.sheet)[..., 3] > 160
        rows = np.where(a.any(axis=1))[0]
        self.top, self.bottom = int(rows.min()), int(rows.max()) + 1
        cols = np.where(a.any(axis=0))[0]
        xs = cols % self.fw
        self.left, self.right = int(xs.min()), int(xs.max()) + 1
        # sichtbare Ausdehnung (auch durchscheinende Teile, Alpha > 20): maßgeblich für die Größenwahl
        av = np.asarray(self.sheet)[..., 3] > 20
        vrows = np.where(av.any(axis=1))[0]
        vcols = np.where(av.any(axis=0))[0] % self.fw
        self.vtop, self.vbottom = int(vrows.min()), int(vrows.max()) + 1
        self.vleft, self.vright = int(vcols.min()), int(vcols.max()) + 1
        self.foot = self.meta.get('footY', self.bottom)
        # Ausrichtung: Gesichtsmitte (genau zwischen den Augen, `faceX` im Sheet-JSON, vom Spiel je Sheet vermessen) liegt
        # auf der Kartenmitte; `anchorX` hat Vorrang. Ohne beides: Mittel der Umriss-Mitten je Frame.
        mids = []
        for i in range(self.n):
            fx_ = np.nonzero(a[:, i * self.fw:(i + 1) * self.fw])[1]
            if fx_.size:
                mids.append((fx_.min() + fx_.max() + 1) / 2)
        self.center_x = float(self.meta.get('anchorX', self.meta.get('faceX', float(np.mean(mids)))))

        self._cache = {}

    def layers(self, i, light, dark):
        """(Umriss außen, Umriss innen, Sprite) für Frame i, alle auf dem Raster U.
        Der Umriss wird in halben Sprite-Pixeln (= U) auf einem 2×-Bild gewachsen und dann ×U skaliert.
        Ungerade Maßstäbe (z. B. 7): doppelt so groß rechnen (14) und mit NEAREST halbieren; jedes Sprite-Pixel bleibt exakt 7 px."""
        i %= self.n
        if i in self._cache:
            return self._cache[i]
        if self.px % 2:
            real = self.px
            self.px = real * 2
            self._ou = 2 * U
            try:
                self._cache.pop(i, None)
                od, ol, sp, pad = self._layers_even(i, light, dark)
            finally:
                self.px = real
                self._ou = U
            half = lambda im: im.resize((im.width // 2, im.height // 2), Image.NEAREST)
            res = (half(od), half(ol), half(sp), pad // 2)
            self._cache[i] = res
            return res
        return self._layers_even(i, light, dark)

    def _layers_even(self, i, light, dark):
        ou = getattr(self, '_ou', U)
        f = self.sheet.crop((i * self.fw, 0, (i + 1) * self.fw, self.fh))
        pad = max(3, -(-2 * U * 2 // self.px) + 1)
        f = pad_image(f, pad)
        body = body_mask(f)
        half = body.resize((body.width * 2, body.height * 2), Image.NEAREST)
        a = half
        half = f.resize((f.width * 2, f.height * 2), Image.NEAREST)

        hp = self.px // 2                                   # px je halbem Sprite-Pixel
        k_light = max(1, round(ou / hp))                     # Outline innen ≈ 7 px, außen ≈ 14 px (bei px=14: 1 und 2 halbe Pixel)
        k_dark = max(k_light + 1, round(2 * ou / hp))

        solid = a.point(lambda v: 0 if v else 255)           # überall außer auf dem Sprite selbst: durchscheinende Körper nicht weiß füllen

        def ring(k, color):
            g = ImageChops.darker(a.filter(ImageFilter.MaxFilter(2 * k + 1)), solid)
            im = Image.new('RGBA', half.size, color + (255,))
            im.putalpha(g)
            return im.resize((im.width * hp, im.height * hp), Image.NEAREST)

        res = (ring(k_dark, dark), ring(k_light, light), f.resize((f.width * self.px, f.height * self.px), Image.NEAREST), pad * self.px)
        self._cache[i] = res
        return res


def pad_image(img, pad):
    out = Image.new('RGBA', (img.width + 2 * pad, img.height + 2 * pad), (0, 0, 0, 0))
    out.paste(img, (pad, pad))
    return out


def pixel_ellipse(w_units, h_units, color, alpha):
    """Flacher Bodenschatten aus Rasterquadraten."""
    im = Image.new('RGBA', (w_units * U, h_units * U), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for j in range(h_units):
        for i in range(w_units):
            nx = (i + 0.5 - w_units / 2) / (w_units / 2)
            ny = (j + 0.5 - h_units / 2) / (h_units / 2)
            if nx * nx + ny * ny <= 1:
                d.rectangle([i * U, j * U, i * U + U - 1, j * U + U - 1], fill=color + (alpha,))
    return im


# ── Partikel (nahtlos loopend) ────────────────────────────────────────────────

class Particles:
    def __init__(self, seed, accent, count, area, loop):
        r = random.Random(seed)
        self.loop = loop
        self.items = []
        light = mix(accent, WHITE, 0.55)
        for _ in range(count):
            kind = r.choices(['sq', 'sq2', 'plus'], [6, 2, 2])[0]
            self.items.append(dict(
                kind=kind,
                x=(r.randrange(area[0] // U, area[2] // U)) * U,
                y0=r.randrange(0, H // U) * U,
                cycles=r.choice([1, 1, 2]),
                sway=r.choice([0, 0, 1, 2]) * U,
                phase=r.random(),
                color=r.choice([accent, accent, light, WHITE]),
            ))

    def draw(self, layer, f):
        d = ImageDraw.Draw(layer)
        t = f / self.loop
        for p in self.items:
            y = (p['y0'] - p['cycles'] * H * t) % H
            y = int(y // U) * U
            x = p['x'] + (int(math.sin((t + p['phase']) * 2 * math.pi) * p['sway'] / U) * U if p['sway'] else 0)
            twinkle = int((t * 4 * p['cycles'] + p['phase'] * 4)) % 4
            c = p['color'] + (255 if twinkle != 3 else 130,)
            if p['kind'] == 'sq':
                d.rectangle([x, y, x + U - 1, y + U - 1], fill=c)
            elif p['kind'] == 'sq2':
                d.rectangle([x, y, x + 2 * U - 1, y + 2 * U - 1], fill=c)
            else:  # Plus-Funkeln, atmet in 4 Stufen
                s = [0, 1, 2, 1][twinkle]
                d.rectangle([x - s * U, y, x + (s + 1) * U - 1, y + U - 1], fill=c)
                d.rectangle([x, y - s * U, x + U - 1, y + (s + 1) * U - 1], fill=c)


# ── Hauptprogramm ─────────────────────────────────────────────────────────────

def choose_px(spr, cfg):
    """Maßstab so wählen, dass die deckende Figur gut ins Layout passt: 14 px (= 2 Kartenpixel), wenn Höhe
    300…540 px und Breite ≤ 760 px bleiben; sonst der größte gerade Maßstab, der in 540 × 760 passt."""
    if 'px' in cfg:
        return int(cfg['px'])
    ow = spr.vright - spr.vleft
    oh = max(1, max(spr.foot, spr.vbottom) - spr.vtop)
    if 300 <= oh * SPRITE_PX <= 540 and ow * SPRITE_PX <= 760:
        return SPRITE_PX
    best = 4
    for px in range(4, 29, 2):
        if oh * px <= 540 and ow * px <= 760:
            best = px
    return best


def pick_music_start(path, window, lo=2.0, hi=75.0):
    """Beginn des energiereichsten Fensters (mittlere Lautstärke) im Stück, damit kein leiser Anfang gewählt wird."""
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-ac', '1', '-ar', '8000', '-f', 's16le', '-'],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.int16).astype(np.float32)
    step = 4000                                          # 0,5-s-Blöcke
    n = len(x) // step
    rms = np.sqrt((x[:n * step].reshape(n, step) ** 2).mean(axis=1))
    w = int(round(window / 0.5))
    best, best_v = lo, -1.0
    for i in range(int(lo / 0.5), min(n - w, int(hi / 0.5))):
        v = rms[i:i + w].mean()
        if v > best_v:
            best, best_v = i * 0.5, v
    return best


def snap_to_onset(path, start, back=1.5, fwd=3.5):
    """Verschiebt den Musikstart auf den kräftigsten Einsatz (Schlag) in [start − back, start + fwd], damit gleich in der ersten
    Bildsekunde ein Schlag sitzt statt eines Auftakts."""
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-ac', '1', '-ar', '8000', '-f', 's16le', '-'],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.int16).astype(np.float32)
    step = 160                                                   # 20-ms-Blöcke
    n = len(x) // step
    rms = np.sqrt((x[:n * step].reshape(n, step) ** 2).mean(axis=1))
    best, best_v = start, -1.0
    for i in range(max(6, int((start - back) / 0.02)), min(n - 1, int((start + fwd) / 0.02))):
        v = rms[i] - rms[i - 6:i].mean()                         # Anstieg gegenüber den letzten 120 ms
        if v > best_v:
            best, best_v = i * 0.02, v
    return max(0.0, best - 0.02)


def music_path(card_name, override):
    """Musik: ausdrückliche Datei, sonst wie im Spiel (server.js `bgmSlugForHero`): längste zusammenhängende Wortfolge des
    Namens, für die `public/music/bgm_<slug>.ogg` existiert (so findet „Luna Pele“ `bgm_lunapele.ogg`)."""
    base = ROOT / 'public' / 'music'
    if override:                                   # Dateiname in public/music oder Pfad ab Repo-Wurzel (enthält „/")
        return ROOT / override if '/' in override else base / override
    toks = [''.join(ch for ch in w.lower() if ch.isalnum()) for w in card_name.replace(',', ' ').replace("'", ' ').split()]
    toks = [t for t in toks if t]
    best = None
    for i in range(len(toks)):
        for j in range(i + 1, len(toks) + 1):
            cand = ''.join(toks[i:j])
            if (base / f'bgm_{cand}.ogg').exists() and (best is None or len(cand) > len(best)):
                best = cand
    return base / f'bgm_{best}.ogg' if best else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('slug')
    ap.add_argument('--format', choices=['post', 'reel'], default='post', help='post = Feed 1080×1350, reel = 1080×1920')
    ap.add_argument('--accent')
    ap.add_argument('--duration', type=float, default=None, help='Mindestlänge des MP4 in Sekunden (Standard: Post 30, Reel 15)')
    ap.add_argument('--themes', help='Partikel-Themen, kommagetrennt (poison, fire, heal, arcane, fight, ice, stars); sonst automatisch')
    ap.add_argument('--music')
    ap.add_argument('--music-start', type=float, default=None, help='Startzeit im Stück; ohne Angabe: Wert aus hero-themes.json (musicStart), sonst das energiereichste Fenster')
    ap.add_argument('--no-video', action='store_true')
    ap.add_argument('--cover-only', type=int, default=None, metavar='FRAME', help='nur dieses eine Bild rendern (schnelle Vorschau) und als preview-<slug>.png ablegen')
    ap.add_argument('--clean', action='store_true', help='Einzelbilder nach dem Kodieren löschen (spart Platz)')
    ap.add_argument('--intro', choices=['on', 'off'], default=None, help='Einblenden am Anfang (Standard: Reel an, Post aus)')
    ap.add_argument('--feet', type=int, default=None, help='Standlinie des Sprites, px ab Kartenoberkante')
    ap.add_argument('--shadow-dy', type=int, default=None, help='Schatten um so viele px tiefer setzen (überschreibt shadowDy aus hero-themes.json)')
    ap.add_argument('--logo-px', type=int, default=None, help='Pixelgröße des Logos (px je Logo-Pixel, Standard 2), überschreibt logoPx aus hero-themes.json')
    ap.add_argument('--head-top', type=int, default=None, help='Sprite so setzen, dass seine Oberkante bei y (px ab Bildoberkante) liegt, überschreibt feet/eyeAt')
    ap.add_argument('--px', type=int, default=None, help='Maßstab des Sprites (px je Sprite-Pixel), überschreibt hero-themes.json')
    ap.add_argument('--punch', action='store_true', help='Kraftvoller Start: die erste halbe Sekunde mit Bildschirmwackeln, Druckwelle und Blitz, Musik ohne Einblenden und auf einen Schlag der Musik geschnitten')
    ap.add_argument('--opener', choices=['none', 'heart', 'storm'], default=None, help='Eigener Start-Effekt statt der Standard-Druckwelle: heart = großes Flammenherz, das detoniert; storm = Gewitterwolke, in die ein Blitz einschlägt; beide geben den Helden frei (überschreibt opener aus hero-themes.json)')
    args = ap.parse_args()
    reel = args.format == 'reel'
    tag = args.format
    intro_on = (args.intro == 'on') if args.intro else reel
    punch_on = args.punch
    first_on = None                        # wird unten gesetzt, sobald hero_cfg (und damit opener) bekannt ist
    duration = args.duration if args.duration else (15.0 if reel else 30.0)
    oy = 180 if reel else 0                  # Reel: Inhalt höher, unten bleibt Platz für die Oberfläche (Beschreibung, Knöpfe)

    spr = Sprite(args.slug)
    card_name = spr.meta['hero']
    hero_cfg = json.loads((HERE / 'hero-themes.json').read_text(encoding='utf-8')).get(card_name, {})
    opener = args.opener or hero_cfg.get('opener') or 'none'
    args_opener = opener
    opener_on = opener in ('heart', 'storm')
    if opener_on:
        punch_on = False                   # der Opener ersetzt die Standard-Druckwelle
    first_on = intro_on or punch_on or opener_on        # die erste Schleife wird gesondert gerendert (Einblenden und/oder Start-Effekt)
    if args.px:
        hero_cfg['px'] = args.px
    if args.shadow_dy is not None:
        hero_cfg['shadowDy'] = args.shadow_dy
    out = OUT / args.slug
    fdir = out / f'frames-{tag}'
    fdir.mkdir(parents=True, exist_ok=True)

    # Karte vom Spiel-Renderer
    card_png = out / 'card.png'
    if not card_png.exists():
        subprocess.run(['node', str(HERE / 'render-card.js'), card_name, str(card_png)] + ([json.dumps(hero_cfg['card'])] if hero_cfg.get('card') else []), check=True)
    card = Image.open(card_png).convert('RGBA').resize((CARD_W, CARD_H), Image.BOX)

    accent = hexcol(args.accent or hero_cfg['accent']) if (args.accent or hero_cfg.get('accent')) else accent_from_sprite(spr.sheet, spr.meta)
    print('Akzent', '#%02x%02x%02x' % accent)

    # Zeitraster: Videoframes je Sprite-Frame so, dass fps in 24…60 liegt
    frame_ms = spr.meta['frameMs']
    per = math.ceil(24 * frame_ms / 1000)
    fps = Fraction(per * 1000, frame_ms)
    loop = spr.n * per
    print(f'{spr.n} Sprite-Frames à {frame_ms} ms → {per} Videoframes je Frame, {float(fps):.2f} fps, Loop {loop} Frames')

    # Layout (alles Vielfache von U; Plattenkante = Kartenkante ± plate_pad)
    plate_pad = 6 * U
    card_x = 40 * U                      # 280 px (Karte 525 px breit → ±2,5 px aus der Mitte)
    card_y = 48 * U + oy                 # 336 px (Post)
    plate = bevel_frame((CARD_W + 2 * plate_pad, CARD_H + 2 * plate_pad), accent, plate_pad)
    plate_x, plate_y = card_x - plate_pad, card_y - plate_pad
    bg = Background(accent, (W // 2, card_y + CARD_H // 2))

    # Zwei Ebenen, damit sie beim Einblenden nacheinander erscheinen können:
    # A = Platte, Karte, Schnörkel, Logo; B = Name, Beiname, Trennlinien, Link-Schild
    mid_a = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    mid_a.alpha_composite(plate, (plate_x, plate_y))
    mid_a.alpha_composite(card, (card_x, card_y))
    orn, gems = ornaments.frame_ornaments(plate_x, plate_y, plate.width, plate.height, accent, (W, H))
    mid_a.alpha_composite(orn)
    logo = tinted_logo(accent, args.logo_px or hero_cfg.get('logoPx', 2))
    name_front = bool(hero_cfg.get('nameFront'))            # Name/Beiname/Link-Schild vor dem Sprite (bei sehr großen, tiefen Sprites)
    logo_front = bool(hero_cfg.get('logoFront'))            # Logo vor dem Sprite (bei Helden, die es überragen)
    logo_layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    logo_layer.alpha_composite(logo, ((W - logo.width) // 2, 40 + oy))
    if not logo_front:
        mid_a.alpha_composite(logo_layer)
    mid_b = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    parts = card_name.split(',', 1)
    short = hero_cfg.get('name', parts[0]).upper()
    sub = hero_cfg.get('title', parts[1].strip() if len(parts) > 1 else '').upper()
    name_y, sub_y = (1238 + oy, 1295 + oy) if sub else (1252 + oy, 0)
    scale = next((sc for sc in (8, 7, 6, 5, 4) if pixel_text_mask(short).width * sc <= 640), 4)   # lange Namen kleiner setzen
    nx, ny, nw, nh = draw_text(mid_b, short, scale, (W // 2, name_y), color=WHITE, outline=None, shadow=mix(accent, INK, 0.45))
    dl = max(4, min(16, (nx - 2 * U - 4 * U - 5 * U) // U))
    ornaments.place_divider(mid_b, accent, nx - 2 * U, name_y - U, dl, -1)
    ornaments.place_divider(mid_b, accent, nx + nw + 2 * U, name_y - U, dl, 1)
    if sub:
        sub_scale = 3 if pixel_text_mask(sub).width * 3 <= 640 else 2
        sx_, sy_, sw_, sh_ = draw_text(mid_b, sub, sub_scale, (W // 2, sub_y), color=accent, outline=None, shadow=INK)
        ornaments.place_divider(mid_b, accent, sx_ - 2 * U, sub_y - U // 2, 9, -1, thick=1, gem_r=1)
        ornaments.place_divider(mid_b, accent, sx_ + sw_ + 2 * U, sub_y - U // 2, 9, 1, thick=1, gem_r=1)
    if reel:                                  # Link-Schild unter dem Beinamen (im sicheren Bereich)
        url = 'PIXELPARTIESTCG.COM'
        um = pixel_text_mask(url)
        us = 3
        pw, ph = um.width * us + 8 * U, um.height * us + 5 * U
        px0, py0 = (W - pw) // 2, (sub_y if sub else name_y + 40) + 30
        dr = ImageDraw.Draw(mid_b)
        dr.rectangle([px0 + U, py0, px0 + pw - U - 1, py0 + ph - 1], fill=INK)
        dr.rectangle([px0, py0 + U, px0 + pw - 1, py0 + ph - U - 1], fill=INK)
        dr.rectangle([px0 + U, py0 + U, px0 + pw - U - 1, py0 + ph - U - 1], fill=accent)
        draw_text(mid_b, url, us, (W // 2, py0 + ph // 2), color=INK, outline=None, anchor='mm')

    # Sprite-Lage: Gesichtsmitte über der Kartenmitte, Füße auf der Standlinie (im Kartenbild)
    feet_y = card_y + (args.feet if args.feet is not None else hero_cfg.get('feet', int(CARD_H * 0.52)))
    if 'anchorX' in hero_cfg:
        spr.center_x = float(hero_cfg['anchorX'])
    spr.px = choose_px(spr, hero_cfg)
    print('Sprite-Maßstab:', spr.px, 'px je Sprite-Pixel')
    sx = round(card_x + CARD_W / 2 - spr.center_x * spr.px)      # Gesichtsmitte (zwischen den Augen) genau über der Kartenmitte
    sy = feet_y - spr.foot * spr.px
    if 'eyeAt' in hero_cfg and 'faceY' in spr.meta:            # Sprite so setzen, dass sein Auge/Gesicht (faceY) bei y = eyeAt (px ab Kartenoberkante) liegt
        sy = card_y + hero_cfg['eyeAt'] - spr.meta['faceY'] * spr.px
        feet_y = sy + spr.foot * spr.px
    if args.head_top is not None:
        sy = args.head_top - spr.vtop * spr.px
        feet_y = sy + spr.foot * spr.px
    shadow = pixel_ellipse(max(10, min(44, round((spr.right - spr.left) * spr.px * 0.75 / U))), 4, INK, 170)

    parts_bg = Particles(args.slug, accent, 40 if not reel else 56, (U * 3, 0, W - U * 3, H), loop)
    cards = json.loads((ROOT / 'data' / 'cards.json').read_text(encoding='utf-8'))
    card_data = next(c for c in cards if c['name'] == card_name)
    pinned = hero_cfg.get('themes')
    names = fx.themes_for(card_data, args.themes.split(',') if args.themes else pinned)
    print('Partikel:', 'eigene (hero-themes.json)' if hero_cfg.get('particles') and not args.themes else ', '.join(names))
    box = (sx + spr.vleft * spr.px, sy + spr.vtop * spr.px, sx + spr.vright * spr.px, feet_y)
    theme_fx = fx.ThemeFX(fx.specs_for(names, None if args.themes else hero_cfg.get('particles')), args.slug, box, feet_y, loop)
    stick_col = mix(WHITE, accent, 0.25)

    # Einblenden (nur erste Schleife): Pixel-Auflösung der Ebenen, dann Blitz beim Auftauchen des Sprites
    noise = np.random.default_rng(7).random((-(-H // U), -(-W // U)))
    def dissolve(layer, p):
        if p >= 1:
            return layer
        if p <= 0:
            return None
        m = np.repeat(np.repeat((noise < p).astype(np.uint8) * 255, U, axis=0), U, axis=1)[:H, :W]
        out_l = layer.copy()
        out_l.putalpha(ImageChops.multiply(layer.split()[3], Image.fromarray(m, 'L')))
        return out_l
    T_A, T_B, T_SPR, T_FLASH = (0.15, 0.75), (0.5, 1.0), 0.75, 0.14       # Sekunden

    T_PUNCH = 0.55                                                           # Sekunden

    def punch_fx(img, f):
        """Kraftvoller Start: Druckwelle (Pixelring, gedithert), kurzer Blitz und Bildschirmwackeln im Raster U, alles in der ersten halben Sekunde."""
        ts = f / float(fps)
        if ts >= T_PUNCH:
            return img
        k = 1.0 - ts / T_PUNCH                                               # 1 → 0
        cw, ch = -(-W // U), -(-H // U)
        ys, xs = np.mgrid[0:ch, 0:cw]
        cx, cy = (card_x + CARD_W / 2) / U, (card_y + CARD_H * 0.45) / U
        r = (14 + 150 * (ts / T_PUNCH) ** 0.55)                              # Radius in Zellen
        ring = np.abs(np.hypot(xs + 0.5 - cx, ys + 0.5 - cy) - r) < 2.2
        vis = ring & (k > np.tile(BAYER4, (ch // 4 + 1, cw // 4 + 1))[:ch, :cw])
        m = np.repeat(np.repeat(vis.astype(np.uint8) * 255, U, axis=0), U, axis=1)[:H, :W]
        img = img.copy()
        img.paste(Image.new('RGB', (W, H), (255, 244, 204)), (0, 0), Image.fromarray(m, 'L'))
        a = 0.42 * max(0.0, 1.0 - ts / 0.2) ** 1.5                           # Blitz: das Bild bleibt erkennbar
        if a > 0:
            img = Image.blend(img, Image.new('RGB', (W, H), WHITE), a)
        amp = int(round(3 * k ** 1.5))                                       # Wackeln in Rasterzellen, klingt ab
        if amp:
            rng = np.random.default_rng(100 + f)
            dx, dy = int(rng.integers(-amp, amp + 1)) * U, int(rng.integers(-amp, amp + 1)) * U
            out = img.copy()
            out.paste(img, (dx, dy))
            img = out
        return img

    # ── Opener „Flammenherz“: ein großes Herz mit Flammen füllt den dunklen Bildschirm, schlägt zweimal, detoniert (Druckwelle gibt das Bild frei) ──
    T_HEART, T_BOOM = 0.62, 0.55                                             # Sekunden: Herz-Phase, Detonation
    cwid, chei = -(-W // U), -(-H // U)
    YY, XX = np.mgrid[0:chei, 0:cwid]
    BAY = np.tile(BAYER4, (chei // 4 + 1, cwid // 4 + 1))[:chei, :cwid]
    hcx, hcy = (card_x + CARD_W / 2) / U, (card_y + CARD_H * 0.47) / U
    HEART_PAL = [(84, 4, 34), (176, 20, 64), (232, 66, 106), (255, 140, 172), (255, 226, 236)]
    FIRE_PAL = [(88, 31, 0), (202, 44, 41), (244, 123, 34), (246, 231, 14), (247, 245, 184)]       # Feuerpalette des Flammen-Sprites
    ember_rng = np.random.default_rng(31)
    EMBERS = [(ember_rng.uniform(-62, 62), ember_rng.uniform(25, 70), ember_rng.uniform(0, 1)) for _ in range(34)]

    def dist_to_border(mask):
        """Abstand (Zellen) jeder Zelle zum Rand von mask (ungefähr, zum nächsten Randpunkt)."""
        e = mask.copy()
        e[1:, :] &= mask[:-1, :]; e[:-1, :] &= mask[1:, :]; e[:, 1:] &= mask[:, :-1]; e[:, :-1] &= mask[:, 1:]
        d_ = mask.copy()
        d_[1:, :] |= mask[:-1, :]; d_[:-1, :] |= mask[1:, :]; d_[:, 1:] |= mask[:, :-1]; d_[:, :-1] |= mask[:, 1:]
        pts = np.argwhere(d_ & ~e)
        best = np.full(mask.shape, 1e9, dtype=np.float32)
        for py, px_ in pts[::2]:
            np.minimum(best, (YY - py) ** 2 + (XX - px_) ** 2, out=best)
        return np.sqrt(best)

    def pal_dither(pal, v):
        """Kontinuierlicher Wert v (0 … len−1) je Zelle → Palettenfarbe, zwischen zwei Stufen gedithert."""
        v = np.clip(v, 0, len(pal) - 1e-4)
        lo = np.floor(v).astype(int)
        idx = lo + ((v - lo) > BAY)
        return np.asarray(pal, dtype=np.uint8)[np.minimum(idx, len(pal) - 1)]

    def heart_cells(s, glow):
        """Herz-Maske, Farben und Hilfsfelder (x, y) bei Skalierung s."""
        S = 46.0 * s
        x = (XX + 0.5 - hcx) / S
        y = -(YY + 0.5 - hcy) / S + 0.10
        mask = (x * x + y * y - 1) ** 3 - x * x * y ** 3 <= 0
        dd = dist_to_border(mask)
        light = 1.0 + 0.9 * x + 1.0 * y                                      # Licht immer von oben rechts
        v = light * 0.95 + glow * 1.6
        v = np.where(dd < 2.6, 0.0, np.where(dd < 6.0, v - 0.7, v))           # dunkle Kontur, leichte Kante nach innen
        xm = -x                                                                # gespiegelt: Glanzlicht auf dem rechten Lappen
        u_, w_ = (xm + 0.55) * 0.82 + (y - 0.72) * 0.57, -(xm + 0.55) * 0.57 + (y - 0.72) * 0.82
        shine = ((u_ / 0.30) ** 2 + (w_ / 0.075) ** 2 < 1) & mask
        v = np.where(shine, 4.0, v)
        return mask, pal_dither(HEART_PAL, v), dd

    def flame_cells(mask, t, glow, burst=0.0):
        d = dist_to_border(mask)
        ang = np.arctan2(-(YY + 0.5 - hcy), XX + 0.5 - hcx)
        g = 0.52 + 0.26 * np.sin(ang * 9 + t * 17) + 0.20 * np.sin(ang * 17 - t * 23 + 1.3) + 0.12 * np.sin(XX * 0.45 - t * 29)
        up = np.clip(0.55 + 0.65 * np.sin(ang), 0.35, 1.2)                     # nach oben länger
        L = 24.0 * up * np.clip(g, 0.12, 1.0) * (1 + 0.7 * glow + 5.0 * burst)
        vis = ~mask & (d < L)
        v = 4.6 * np.clip(1 - d / np.maximum(L, 1e-3), 0, 1) ** 0.9
        return vis, pal_dither(FIRE_PAL, v)

    def paint(img, vis, rgb, extra_mask=None):
        m = vis if extra_mask is None else vis & extra_mask
        lay = Image.fromarray(rgb).resize((cwid * U, chei * U), Image.NEAREST).crop((0, 0, W, H))
        mk = Image.fromarray(np.repeat(np.repeat(m.astype(np.uint8) * 255, U, axis=0), U, axis=1)[:H, :W], 'L')
        img.paste(lay, (0, 0), mk)

    pre_mask, pre_rgb, _ = heart_cells(1.12, 1.0)                              # Zustand beim Zerplatzen: die Stücke fliegen von hier aus
    CHUNK = 4
    chunk_rng = np.random.default_rng(77)
    CHUNKS = []
    for cy_ in range(0, chei - CHUNK, CHUNK):
        for cx_ in range(0, cwid - CHUNK, CHUNK):
            if pre_mask[cy_ + CHUNK // 2, cx_ + CHUNK // 2]:
                px_, py_ = cx_ + CHUNK / 2 - hcx, cy_ + CHUNK / 2 - hcy
                n = max(1e-3, math.hypot(px_, py_))
                sp = chunk_rng.uniform(70, 170)
                CHUNKS.append((cx_, cy_, px_ / n * sp, py_ / n * sp - 18, chunk_rng.uniform(0.3, 0.85),
                               tuple(int(c) for c in pre_rgb[cy_ + CHUNK // 2, cx_ + CHUNK // 2])))

    def opener_fx(img, f):
        ts = f / float(fps)
        if ts >= T_HEART + T_BOOM:
            return img
        dark = Image.blend(img, Image.new('RGB', (W, H), (16, 6, 20)), 0.95)
        shake_amp = 0
        if ts < T_HEART:
            out_img = dark
            pop = 0.78 + 0.22 * min(1.0, ts / 0.10) ** 0.6
            beat = 0.07 * math.exp(-((ts - 0.34) / 0.05) ** 2)
            glow = max(0.0, (ts - (T_HEART - 0.20)) / 0.20)
            s = (pop + beat + 0.10 * glow) * 0.96 + 0.0
            mask, hrgb, _ = heart_cells(s, glow)
            fvis, frgb = flame_cells(mask, ts, glow)
            paint(out_img, fvis, frgb)
            for ex, ey, ph in EMBERS:                                         # aufsteigende Funken
                yy = hcy + 12 - ((ts * (42 + 30 * ph) + ph * 90) % 90)
                xx = hcx + ex + 4 * math.sin(ts * 9 + ph * 20)
                a, b = int(xx), int(yy)
                if 0 <= a < cwid - 2 and 0 <= b < chei - 2:
                    ImageDraw.Draw(out_img).rectangle([a * U, b * U, (a + 2) * U - 1, (b + 2) * U - 1], fill=FIRE_PAL[3 if ph > 0.5 else 2])
            paint(out_img, mask, hrgb)
            shake_amp = 1 if glow > 0.45 else 0
        else:
            q = (ts - T_HEART) / T_BOOM
            r = 10 + 185 * min(q / 0.9, 1.0) ** 0.55                              # Radius der Druckwelle in Zellen
            dist = np.hypot(XX + 0.5 - hcx, YY + 0.5 - hcy)
            out_img = img.copy()
            keep_dark = np.repeat(np.repeat((dist >= r).astype(np.uint8) * 255, U, axis=0), U, axis=1)[:H, :W]
            out_img.paste(dark, (0, 0), Image.fromarray(keep_dark, 'L'))
            # Feuerball: die Flammen schwellen an und verlöschen gedithert
            if q < 0.5:
                mask = pre_mask
                fvis, frgb = flame_cells(mask, ts, 1.0, burst=min(1.0, q * 3.0) * 0.3)
                paint(out_img, fvis & (1.0 - q / 0.5 > BAY), frgb)
            # Herzstücke fliegen nach außen und verlöschen gedithert
            dr = ImageDraw.Draw(out_img)
            for cx_, cy_, vx, vy, life, col in CHUNKS:
                if q > life:
                    continue
                if (1.0 - q / life) < 0.5 * BAY[cy_ % chei, cx_ % cwid] + 0.15 and q > 0.25:
                    continue
                tt = ts - T_HEART
                a, b = int(round(cx_ + vx * tt)), int(round(cy_ + vy * tt + 45 * tt * tt))
                dr.rectangle([a * U, b * U, (a + CHUNK) * U - 1, (b + CHUNK) * U - 1], fill=(60, 4, 24))
                dr.rectangle([a * U + U, b * U + U, (a + CHUNK - 1) * U - 1, (b + CHUNK - 1) * U - 1], fill=col)
            # Ring der Druckwelle
            k = 1.0 - q
            ring = (np.abs(dist - r) < 2.2) & (k > BAY)
            paint(out_img, ring, np.full((chei, cwid, 3), (255, 244, 204), dtype=np.uint8))
            a_fl = 0.55 * max(0.0, 1.0 - (ts - T_HEART) / 0.12) ** 1.5           # Blitz
            if a_fl > 0:
                out_img = Image.blend(out_img, Image.new('RGB', (W, H), WHITE), a_fl)
            shake_amp = int(round(4 * k ** 1.5))
        if shake_amp:
            rng = np.random.default_rng(300 + f)
            dx, dy = int(rng.integers(-shake_amp, shake_amp + 1)) * U, int(rng.integers(-shake_amp, shake_amp + 1)) * U
            sh = out_img.copy()
            sh.paste(out_img, (dx, dy))
            out_img = sh
        return out_img

    # ── Opener „Gewitterwolke“: das erste Bild ist die vergrößerte Wolke aus dem Sprite des Helden (ohne ihn), in der es zuckt; ein Blitz schlägt ein,
    #    die Wolke zerreißt und gibt den Helden frei ──
    T_STORM = 0.70                                                           # Sekunden bis zum Einschlag
    CP = 12                                                                  # Pixelgröße der vergrößerten Wolke
    BOLT_C = [(110, 170, 255), (255, 244, 170), (255, 255, 255)]             # Glimmen, Mitte, Kern
    bolt_rng = np.random.default_rng(5)

    def sprite_cloud(i):
        """Nur die Wolke des Sprite-Frames i: Kopf über der Wolke entfernt, der Held und Blitze in der Wolke durch das Wolkengrau ersetzt."""
        fr = np.asarray(spr.sheet.crop((i * spr.fw, 0, (i + 1) * spr.fw, spr.fh))).astype(np.int32)
        op = fr[..., 3] > 20
        sat = fr[..., :3].max(axis=2) - fr[..., :3].min(axis=2) > 20
        top = int(np.argmax(op.sum(axis=1) >= 25))                          # erste breite Zeile = Oberkante der Wolke
        out_ = np.zeros_like(fr)
        for y in range(top, spr.fh):
            gray = np.where(op[y] & ~sat[y])[0]
            for x in np.where(op[y])[0]:
                if not sat[y, x]:
                    out_[y, x] = fr[y, x]
                    continue
                l_ = gray[gray < x]
                r_ = gray[gray > x]
                if len(l_) and len(r_) and x - l_[-1] <= 14 and r_[0] - x <= 14:
                    out_[y, x, :3] = (fr[y, l_[-1], :3] + fr[y, r_[0], :3]) // 2
                    out_[y, x, 3] = fr[y, x, 3]
        hs = np.where(sat[max(0, top - 12):top + 10])                         # Grundfläche des Helden (Kopf, Hals, Spiegelung): durch ein Wolkenstück von links ersetzen
        if len(hs[0]):
            x0, x1, y1 = int(hs[1].min()) - 2, int(hs[1].max()) + 3, int(hs[0].max()) + max(0, top - 12) + 3
            sh_ = x1 - x0 + 1
            out_[top:y1, x0:x1] = fr[top:y1, x0 - sh_:x1 - sh_]
        return out_.astype(np.uint8)

    CLOUDS = [sprite_cloud(i) for i in range(spr.n)]
    c_op = np.any([c[..., 3] > 20 for c in CLOUDS], axis=0)
    cy_ix, cx_ix = np.where(c_op)
    CB = (int(cx_ix.min()), int(cy_ix.min()), int(cx_ix.max()) + 1, int(cy_ix.max()) + 1)       # gemeinsamer Rahmen aller Frames
    CL, CT = round(W / 2 - (CB[2] - CB[0]) * CP / 2), round(hcy * U - (CB[3] - CB[1]) * CP / 2)   # Wolke mittig auf Herz-/Kartenmitte
    _cloud_cache = {}

    def storm_cloud(i, flash=0.0):
        if i not in _cloud_cache:
            _cloud_cache[i] = Image.fromarray(CLOUDS[i][CB[1]:CB[3], CB[0]:CB[2]], 'RGBA').resize(((CB[2] - CB[0]) * CP, (CB[3] - CB[1]) * CP), Image.NEAREST)
        im = _cloud_cache[i]
        if flash:                                                             # Wetterleuchten: Wolke leuchtet bläulich-weiß auf
            lit = Image.blend(im.convert('RGB'), Image.new('RGB', im.size, (205, 222, 255)), 0.5 * flash)
            lit.putalpha(im.split()[3])
            return lit
        return im

    def cloud_mask_cells(i):
        a_ = Image.new('L', (W, H), 0)
        a_.paste(storm_cloud(i).split()[3], (CL, CT))
        m_ = np.asarray(a_)[U // 2::U, U // 2::U][:chei, :cwid] > 128
        return np.pad(m_, ((0, chei - m_.shape[0]), (0, cwid - m_.shape[1])))

    def storm_bolt(seed, x0, y0, y1, fork=True):
        """Gezackter Blitz als Zellenmaske (Kern, Mitte, Glimmen)."""
        rng = np.random.default_rng(seed)
        core = np.zeros((chei, cwid), dtype=bool)
        def line(a, b, c, d_):
            n_ = int(max(abs(c - a), abs(d_ - b))) + 1
            for k in range(n_ + 1):
                xx, yy = int(round(a + (c - a) * k / n_)), int(round(b + (d_ - b) * k / n_))
                if 1 <= xx < cwid - 2 and 1 <= yy < chei - 2:
                    core[yy, xx:xx + 2] = True
        x, y = x0, y0
        pts = [(x, y)]
        while y < y1:
            y += rng.uniform(5, 9)
            x += rng.uniform(-7, 7) + (x0 - x) * 0.15
            pts.append((x, min(y, y1)))
        for (a, b), (c, d_) in zip(pts[:-1], pts[1:]):
            line(a, b, c, d_)
        if fork and len(pts) > 3:
            for k in rng.choice(np.arange(1, len(pts) - 1), size=min(3, len(pts) - 2), replace=False):
                fx_, fy_ = pts[k]
                dirx = rng.choice([-1, 1])
                for _ in range(3):
                    nx_, ny_ = fx_ + dirx * rng.uniform(4, 8), fy_ + rng.uniform(4, 8)
                    line(fx_, fy_, nx_, ny_)
                    fx_, fy_ = nx_, ny_
        mid = core.copy()
        for dy_, dx_ in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            mid |= np.roll(np.roll(core, dy_, 0), dx_, 1)
        glow = mid.copy()
        for _ in range(2):
            g2 = glow.copy()
            for dy_, dx_ in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                g2 |= np.roll(np.roll(glow, dy_, 0), dx_, 1)
            glow = g2
        return core, mid, glow

    BOLT_X, BOLT_Y0 = hcx + 3, (CT + (CB[3] - CB[1]) * CP * 0.6) / U                # Einschlag aus dem unteren Teil der Wolke …
    BOLT_Y1 = max((feet_y + 4 * U) / U, BOLT_Y0 + 45)                              # … bis zu den Füßen des Helden
    BOLT = storm_bolt(11, BOLT_X, BOLT_Y0, BOLT_Y1)
    LEAD = storm_bolt(12, BOLT_X + 1, BOLT_Y0, BOLT_Y1, fork=False)

    def paint_bolt(img, bolt, glow_on=True, dither=None):
        core, mid, glow = bolt
        rgb = np.zeros((chei, cwid, 3), dtype=np.uint8)
        vis = np.zeros((chei, cwid), dtype=bool)
        if glow_on:
            g = glow & ~mid & (BAY < 0.55)
            rgb[g] = BOLT_C[0]; vis |= g
        rgb[mid] = BOLT_C[1]; vis |= mid
        rgb[core] = BOLT_C[2]; vis |= core
        if dither is not None:
            vis &= dither
        paint(img, vis, rgb)

    def put_cloud(img, i, flash=0.0):
        rgba = img.convert('RGBA')
        rgba.alpha_composite(storm_cloud(i, flash), (CL, CT))
        return rgba.convert('RGB')

    STORM_CHUNKS = []
    schunk_rng = np.random.default_rng(78)
    cl_full = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    cl_full.alpha_composite(storm_cloud(0), (CL, CT))
    cl_arr = np.asarray(cl_full)
    for cy_ in range(0, chei - CHUNK, CHUNK):
        for cx_ in range(0, cwid - CHUNK, CHUNK):
            yc, xc = (cy_ + CHUNK // 2) * U + U // 2, (cx_ + CHUNK // 2) * U + U // 2
            if cl_arr[yc, xc, 3] > 128:
                px_, py_ = cx_ + CHUNK / 2 - hcx, cy_ + CHUNK / 2 - hcy
                n = max(1e-3, math.hypot(px_, py_))
                sp = schunk_rng.uniform(45, 120)
                STORM_CHUNKS.append((cx_, cy_, px_ / n * sp, py_ / n * sp - 10, schunk_rng.uniform(0.3, 0.85), tuple(int(c) for c in cl_arr[yc, xc, :3])))

    def storm_fx(img, f):
        ts = f / float(fps)
        if ts >= T_STORM + T_BOOM:
            return img
        dark = Image.blend(img, Image.new('RGB', (W, H), (6, 8, 22)), 0.985)
        shake_amp = 0
        idx = (f // per) % spr.n
        if ts < T_STORM:
            fl = 0.0
            for t0_ in (0.20, 0.43):                                           # Wetterleuchten in der Wolke
                if 0 <= ts - t0_ < 0.07:
                    fl = 1.0
            if T_STORM - 0.09 <= ts < T_STORM:
                fl = 0.8
            out_img = put_cloud(dark, idx, fl)
            if fl:                                                            # Äderchen im Inneren der Wolke
                vein = storm_bolt(40 + int(ts * 30), hcx + bolt_rng.uniform(-25, 25), hcy - 6, hcy + 8, fork=False)
                paint_bolt(out_img, vein, glow_on=False, dither=cloud_mask_cells(idx))
            if T_STORM - 0.07 <= ts < T_STORM:                               # Vorentladung: dünner Leitblitz
                paint_bolt(out_img, LEAD, glow_on=False)
            shake_amp = 1 if ts >= T_STORM - 0.07 else 0
        else:
            q = (ts - T_STORM) / T_BOOM
            r = 10 + 185 * min(q / 0.9, 1.0) ** 0.55
            dist = np.hypot(XX + 0.5 - hcx, YY + 0.5 - hcy)
            out_img = img.copy()
            keep_dark = np.repeat(np.repeat((dist >= r).astype(np.uint8) * 255, U, axis=0), U, axis=1)[:H, :W]
            out_img.paste(dark, (0, 0), Image.fromarray(keep_dark, 'L'))
            dr = ImageDraw.Draw(out_img)
            tt = ts - T_STORM
            for cx_, cy_, vx, vy, life, col in STORM_CHUNKS:                  # Wolkenstücke fliegen auseinander
                if q > life or ((1.0 - q / life) < 0.5 * BAY[cy_ % chei, cx_ % cwid] + 0.15 and q > 0.25):
                    continue
                a, b = int(round(cx_ + vx * tt)), int(round(cy_ + vy * tt + 20 * tt * tt))
                dr.rectangle([a * U, b * U, (a + CHUNK) * U - 1, (b + CHUNK) * U - 1], fill=col)
            if q < 0.4:                                                       # der Blitz bleibt kurz stehen und verlöscht gedithert
                paint_bolt(out_img, BOLT, dither=(1.0 - q / 0.4) > BAY)
            k = 1.0 - q
            ring = (np.abs(dist - r) < 2.2) & (k > BAY)
            paint(out_img, ring, np.full((chei, cwid, 3), (235, 244, 255), dtype=np.uint8))
            a_fl = 0.85 * max(0.0, 1.0 - tt / 0.13) ** 1.5                    # grelles Blitzlicht …
            if 0.20 <= tt < 0.27:
                a_fl = max(a_fl, 0.35)                                        # … und ein zweites Nachzucken
            if a_fl > 0:
                out_img = Image.blend(out_img, Image.new('RGB', (W, H), (240, 246, 255)), a_fl)
            shake_amp = int(round(4 * k ** 1.5))
        if shake_amp:
            rng = np.random.default_rng(500 + f)
            dx, dy = int(rng.integers(-shake_amp, shake_amp + 1)) * U, int(rng.integers(-shake_amp, shake_amp + 1)) * U
            sh = out_img.copy()
            sh.paste(out_img, (dx, dy))
            out_img = sh
        return out_img

    def render(f, intro, punch=False, opener=False):
        ts = f / float(fps)
        canvas = bg.frame(f / loop)
        layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        parts_bg.draw(layer, f)
        canvas.alpha_composite(layer)
        for lay, (t0, t1) in ((mid_a, T_A),) if name_front else ((mid_a, T_A), (mid_b, T_B)):
            l2 = dissolve(lay, (ts - t0) / (t1 - t0) if intro else 1.0)
            if l2 is not None:
                canvas.alpha_composite(l2)
        # Themen-Partikel und Funkeln der Edelsteine: nur HINTER dem Sprite, damit nie etwas über dem Kopf liegt
        layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        theme_fx.draw(layer, f)
        dd = ImageDraw.Draw(layer)
        for k, (gx, gy) in enumerate(gems):
            ph = (f / loop + k / len(gems)) % 1.0
            if ph < 0.25:
                n = [1, 2, 3, 2][int(ph / 0.0625)]
                dd.rectangle([gx - n * U, gy - U // 2, gx + n * U, gy + U // 2], fill=WHITE + (255,))
                dd.rectangle([gx - U // 2, gy - n * U, gx + U // 2, gy + n * U], fill=WHITE + (255,))
        canvas.alpha_composite(layer)
        if intro and ts < T_SPR:
            if name_front:
                l2 = dissolve(mid_b, (ts - T_B[0]) / (T_B[1] - T_B[0]))
                if l2 is not None:
                    canvas.alpha_composite(l2)
            if logo_front:
                l2 = dissolve(logo_layer, (ts - T_A[0]) / (T_A[1] - T_A[0]))
                if l2 is not None:
                    canvas.alpha_composite(l2)
            return canvas.convert('RGB')
        o_dark, o_light, sp, pad_px = spr.layers(f // per, stick_col, INK)
        if not hero_cfg.get('noShadow'):
            canvas.alpha_composite(shadow, (card_x + CARD_W // 2 - shadow.width // 2, feet_y - U + hero_cfg.get('shadowDy', 0)))      # shadowDy: Schatten tiefer setzen (schwebende Sprites)
        flash = intro and ts < T_SPR + T_FLASH
        for im in (o_dark, o_light, sp):
            if flash:                          # beim Auftauchen als weiße Silhouette
                white = Image.new('RGBA', im.size, WHITE + (255,))
                white.putalpha(im.split()[3])
                im = white
            canvas.alpha_composite(im, (sx - pad_px, sy - pad_px))
        if name_front:
            l2 = dissolve(mid_b, (ts - T_B[0]) / (T_B[1] - T_B[0]) if intro else 1.0)
            if l2 is not None:
                canvas.alpha_composite(l2)
        if logo_front:
            l2 = dissolve(logo_layer, (ts - T_A[0]) / (T_A[1] - T_A[0]) if intro else 1.0)
            if l2 is not None:
                canvas.alpha_composite(l2)
        out_img = canvas.convert('RGB')
        if opener:
            return (storm_fx if args_opener == 'storm' else opener_fx)(out_img, f)
        return punch_fx(out_img, f) if punch else out_img

    if args.cover_only is not None:
        prev = OUT / f'preview-{args.slug}-{tag}.png'
        render(args.cover_only % loop, False).save(prev)
        print('Vorschau', prev)
        return
    for f in range(loop):
        render(f, False).save(fdir / f'f{f:03d}.png')
    if first_on:
        for f in range(loop):
            render(f, intro_on, punch_on, opener_on).save(fdir / f'i{f:03d}.png')
    cover = Image.open(fdir / ('f%03d.png' % (min(loop - 1, per * 3))) if reel else fdir / 'f000.png')
    cover_path = out / ('reel-cover.png' if reel else 'post.png')
    cover.save(cover_path)
    print('Standbild', cover_path)

    if args.no_video:
        return
    music = music_path(card_name, args.music or hero_cfg.get('music'))
    loop_s = loop / float(fps)
    loops = max(1, math.ceil(duration / loop_s))
    dur = loop_s * loops
    cmd = ['ffmpeg', '-y', '-loglevel', 'error']
    if first_on and loops >= 2:
        cmd += ['-framerate', str(fps), '-i', str(fdir / 'i%03d.png'),
                '-framerate', str(fps), '-stream_loop', str(loops - 2), '-i', str(fdir / 'f%03d.png')]
        vfilter = ['-filter_complex', '[0:v][1:v]concat=n=2:v=1:a=0[v]', '-map', '[v]']
        n_in = 2
    else:
        first = 'i%03d.png' if first_on else 'f%03d.png'
        cmd += ['-framerate', str(fps), '-stream_loop', str(loops - 1), '-i', str(fdir / first)] if not first_on else \
               ['-framerate', str(fps), '-i', str(fdir / first)]
        vfilter, n_in = [], 1
    if music:
        m_start = args.music_start if args.music_start is not None else hero_cfg.get('musicStart')
        if m_start is None:
            m_start = pick_music_start(music, dur)
            print(f'Musik: energiereichstes Fenster ab {m_start:.1f} s')
        if (punch_on or opener_on) and args.music_start is None:
            m_start = snap_to_onset(music, m_start)
            if opener_on:                                               # der Schlag soll auf die Detonation fallen, nicht auf Sekunde 0
                t_hit = T_STORM if args_opener == 'storm' else T_HEART
                m_start = max(0.0, m_start - t_hit)
            print(f'Musik: Start auf den Schlag bei {m_start:.2f} s' + (f' (Schlag bei Einschlag/Detonation, t = {t_hit} s)' if opener_on else ''))
        cmd += ['-ss', str(m_start), '-i', str(music)]
        fade_in = '' if (punch_on or opener_on) else 'afade=t=in:st=0:d=0.4,'
        amap = ['-map', f'{n_in}:a', '-af', f'{fade_in}afade=t=out:st={dur - 1.2:.2f}:d=1.2,loudnorm=I=-14:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '192k']
        if not vfilter:
            vfilter = ['-map', '0:v']
    else:
        amap = []
        if not vfilter:
            vfilter = ['-map', '0:v']
    mp4 = out / ('reel.mp4' if reel else 'post.mp4')
    cmd += vfilter + amap + ['-t', f'{dur:.3f}', '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p',
                             '-tune', 'animation', '-maxrate', '10M', '-bufsize', '20M', '-movflags', '+faststart', str(mp4)]
    subprocess.run(cmd, check=True)
    print('Video', mp4, f'{dur:.1f}s', 'mit Musik' if music else 'ohne Musik')
    if args.clean:
        import shutil
        shutil.rmtree(fdir, ignore_errors=True)


if __name__ == '__main__':
    main()
