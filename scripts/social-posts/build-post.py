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
import colorsys
import json
import math
import random
import subprocess
import sys
from fractions import Fraction
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

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
    px = px[px[:, 3] > 0.9][:, :3]
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
        self.border = post_border(accent)

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


def post_border(accent):
    """Äußerer Rand des Posts (CI): dunkel – Akzent – dunkel, mit Eckrauten."""
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    dark = mix(accent, INK, 0.7)
    d.rectangle([0, 0, W - 1, H - 1], outline=INK, width=U)
    d.rectangle([U, U, W - 1 - U, H - 1 - U], outline=dark, width=U)
    d.rectangle([2 * U, 2 * U, W - 1 - 2 * U, H - 1 - 2 * U], outline=accent, width=U // 2 * 1)
    return im


# ── Ebenen ────────────────────────────────────────────────────────────────────

def tinted_logo(accent, scale_div=2):
    logo = Image.open(ROOT / 'data' / 'logo.png').convert('RGBA')
    mask = Image.open(ROOT / 'data' / 'logo-tint-mask.png').convert('RGBA').split()[3]
    rgb = np.asarray(logo.convert('RGB'), dtype=np.float32)
    m = (np.asarray(mask, dtype=np.float32) / 255.0)[..., None]
    col = np.array(accent, dtype=np.float32) / 255.0
    out = rgb * (1 - m) + rgb * col * m
    res = Image.fromarray(out.clip(0, 255).astype(np.uint8), 'RGB').convert('RGBA')
    res.putalpha(logo.split()[3])
    # 4 px je Logo-Pixel → 2 px je Logo-Pixel
    return res.resize((logo.width // scale_div, logo.height // scale_div), Image.NEAREST)


class Sprite:
    def __init__(self, hero_dir_slug):
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
        self.foot = self.meta.get('footY', self.bottom)
        # Mitte der Figur (nicht des Gesichts): Mittel der Umriss-Mitten je Frame. Sonst sitzt ein Held mit Stab
        # oder Flügeln optisch schief. `anchorX` im Sheet-JSON hat Vorrang.
        mids = []
        for i in range(self.n):
            fx_ = np.nonzero(a[:, i * self.fw:(i + 1) * self.fw])[1]
            if fx_.size:
                mids.append((fx_.min() + fx_.max() + 1) / 2)
        self.center_x = float(self.meta.get('anchorX', float(np.mean(mids))))

        self._cache = {}

    def layers(self, i, light, dark):
        """(Umriss außen, Umriss innen, Sprite) für Frame i, alle auf dem Raster U.
        Der Umriss wird in halben Sprite-Pixeln (= U) auf einem 2×-Bild gewachsen und dann ×U skaliert."""
        i %= self.n
        if i in self._cache:
            return self._cache[i]
        f = self.sheet.crop((i * self.fw, 0, (i + 1) * self.fw, self.fh))
        pad = 3
        f = pad_image(f, pad)
        half = f.resize((f.width * 2, f.height * 2), Image.NEAREST)
        a = half.split()[3].point(lambda v: 255 if v > 40 else 0)

        def ring(k, color):
            g = a.filter(ImageFilter.MaxFilter(2 * k + 1))
            im = Image.new('RGBA', half.size, color + (255,))
            im.putalpha(g)
            return im.resize((im.width * U, im.height * U), Image.NEAREST)

        res = (ring(2, dark), ring(1, light), f.resize((f.width * SPRITE_PX, f.height * SPRITE_PX), Image.NEAREST), pad * SPRITE_PX)
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

def music_path(card_name, override):
    if override:
        return ROOT / 'public' / 'music' / override
    first = card_name.split(',')[0]
    key = ''.join(ch for ch in first.lower() if ch.isalnum())
    p = ROOT / 'public' / 'music' / f'bgm_{key}.ogg'
    return p if p.exists() else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('slug')
    ap.add_argument('--accent')
    ap.add_argument('--duration', type=float, default=30.0, help='Mindestlänge des MP4 in Sekunden (der Loop wird wiederholt)')
    ap.add_argument('--themes', help='Partikel-Themen, kommagetrennt (poison, fire, heal, arcane, fight, ice, stars); sonst automatisch')
    ap.add_argument('--music')
    ap.add_argument('--music-start', type=float, default=0.0)
    ap.add_argument('--no-video', action='store_true')
    ap.add_argument('--feet', type=int, default=None, help='Standlinie des Sprites, px ab Kartenoberkante')
    args = ap.parse_args()

    spr = Sprite(args.slug)
    card_name = spr.meta['hero']
    out = OUT / args.slug
    (out / 'frames').mkdir(parents=True, exist_ok=True)

    # Karte vom Spiel-Renderer
    card_png = out / 'card.png'
    if not card_png.exists():
        subprocess.run(['node', str(HERE / 'render-card.js'), card_name, str(card_png)], check=True)
    card = Image.open(card_png).convert('RGBA').resize((CARD_W, CARD_H), Image.BOX)

    accent = hexcol(args.accent) if args.accent else accent_from_sprite(spr.sheet, spr.meta)
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
    card_y = 48 * U                      # 336 px
    plate = bevel_frame((CARD_W + 2 * plate_pad, CARD_H + 2 * plate_pad), accent, plate_pad)
    plate_x, plate_y = card_x - plate_pad, card_y - plate_pad
    plate_b = plate_y + plate.height
    bg = Background(accent, (W // 2, card_y + CARD_H // 2))

    mid = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    mid.alpha_composite(plate, (plate_x, plate_y))
    mid.alpha_composite(card, (card_x, card_y))
    orn, gems = ornaments.frame_ornaments(plate_x, plate_y, plate.width, plate.height, accent, (W, H))
    mid.alpha_composite(orn)
    # Kopf: Logo in Akzentfarbe
    logo = tinted_logo(accent)
    mid.alpha_composite(logo, ((W - logo.width) // 2, 40))
    # Fuß: Name (groß) und Beiname
    parts = card_name.split(',', 1)
    short = parts[0].upper()
    sub = parts[1].strip().upper() if len(parts) > 1 else ''
    draw_text(mid, short, 8, (W // 2, 1243 if sub else 1256), color=WHITE, outline=None, shadow=mix(accent, INK, 0.45))
    if sub:
        draw_text(mid, sub, 3, (W // 2, 1301), color=accent, outline=None, shadow=INK)

    # Sprite-Lage: Gesicht über der Kartenmitte, Füße auf der Standlinie (im Kartenbild)
    feet_y = card_y + (args.feet if args.feet is not None else int(CARD_H * 0.52))
    sx = card_x + CARD_W // 2 - round(spr.center_x * SPRITE_PX / U) * U      # auf dem Raster, Figurenmitte über der Kartenmitte
    sy = feet_y - spr.foot * SPRITE_PX
    shadow = pixel_ellipse(24, 4, INK, 170)

    parts_bg = Particles(args.slug, accent, 40, (U * 3, 0, W - U * 3, H), loop)
    cards = json.loads((ROOT / 'data' / 'cards.json').read_text(encoding='utf-8'))
    card_data = next(c for c in cards if c['name'] == card_name)
    pinned = json.loads((HERE / 'hero-themes.json').read_text(encoding='utf-8')).get(card_name)
    names = fx.themes_for(card_data, args.themes.split(',') if args.themes else pinned)
    print('Partikel-Themen:', ', '.join(names))
    box = (sx + spr.left * SPRITE_PX, sy + spr.top * SPRITE_PX, sx + spr.right * SPRITE_PX, feet_y)
    theme_fx = fx.ThemeFX(names, args.slug, box, feet_y, loop)
    stick_col = mix(WHITE, accent, 0.25)

    for f in range(loop):
        canvas = bg.frame(f / loop)
        layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        parts_bg.draw(layer, f)
        canvas.alpha_composite(layer)
        canvas.alpha_composite(mid)
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
        o_dark, o_light, sp, pad_px = spr.layers(f // per, stick_col, INK)
        canvas.alpha_composite(shadow, (card_x + CARD_W // 2 - shadow.width // 2, feet_y - U))
        for im in (o_dark, o_light, sp):
            canvas.alpha_composite(im, (sx - pad_px, sy - pad_px))
        canvas.convert('RGB').save(out / 'frames' / f'f{f:03d}.png')
    still = Image.open(out / 'frames' / 'f000.png')
    still.save(out / 'post.png')
    print('Standbild', out / 'post.png')

    if args.no_video:
        return
    music = music_path(card_name, args.music)
    loops = max(1, math.ceil(args.duration / (loop / float(fps))))
    vf = ['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(fps), '-stream_loop', str(loops - 1),
          '-i', str(out / 'frames' / 'f%03d.png')]
    dur = loop / float(fps) * loops
    if music:
        vf += ['-ss', str(args.music_start), '-i', str(music),
               '-af', f'afade=t=in:st=0:d=0.4,afade=t=out:st={dur - 1.2:.2f}:d=1.2', '-c:a', 'aac', '-b:a', '192k']
    vf += ['-t', f'{dur:.3f}', '-c:v', 'libx264', '-preset', 'slow', '-crf', '12', '-pix_fmt', 'yuv420p',
           '-tune', 'animation', '-movflags', '+faststart', str(out / 'post.mp4')]
    subprocess.run(vf, check=True)
    print('Video', out / 'post.mp4', f'{dur:.1f}s', 'mit Musik' if music else 'ohne Musik')


if __name__ == '__main__':
    main()
