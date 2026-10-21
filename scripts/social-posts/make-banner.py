#!/usr/bin/env python3
"""YouTube-Kanalbanner (2048×1152, höchstens 6 MB) im Stil des Titelbilds (public/title.png): warmer Grund, Sprengstern in der Mitte,
zwei Heldentrupps, die aufeinander losgehen.

    python3 scripts/social-posts/make-banner.py

Ergebnis in scripts/social-posts/out/branding/: banner-youtube.png und banner-youtube-sicherer-bereich.png (Kontrollbild, nicht hochladen).

YouTube zeigt je nach Gerät unterschiedliche Ausschnitte; auf dem Handy bleibt nur die Mitte (1235 × 338 px, x 406…1641, y 407…745)
sichtbar. Dort steht nur der Schriftzug (Logo-Pixel = 4 px); der Rest ist Zugabe für Tablet, Desktop und Fernseher.
"""
import importlib.util
import math
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
OUT = HERE / 'out' / 'branding'
spec = importlib.util.spec_from_file_location('ml', HERE / 'make-logo.py')
ml = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ml)
bp, fx = ml.bp, ml.fx

W, H = 2048, 1152
SAFE = (406, 407, 1641, 745)                       # sicherer Bereich für alle Geräte
CELL = 4                                           # Raster des Banners (= ein Logo-Pixel)
CREAM, CREAM2, CREAM3 = (255, 224, 184), (255, 232, 198), (255, 241, 214)       # Farben aus title.png
RED, RED_DK, GOLD, GOLD_LT = (226, 84, 84), (176, 52, 70), (255, 222, 130), (255, 243, 176)

# (Sprite, Maßstab, Mitte x, Mitte y des sichtbaren Umrisses, gespiegelt?, Frame)
# Links blickt alles nach rechts, rechts nach links; „gespiegelt“ gleicht die Blickrichtung des Sheets aus.
LEFT = [
    ('alleria-the-queen-of-spiders', 10, 215, 700, False, 0),
    ('nao-the-barrier-priestess', 10, 190, 975, False, 0),
    ('bomb-berserker-bartas', 10, 410, 960, False, 0),
    ('archibald-the-archmage', 10, 640, 930, False, 0),
    ('cute-angel-molinda', 8, 700, 190, False, 0),
    ('mary-crestmas', 8, 150, 420, False, 0),
]
RIGHT = [
    ('argos-the-eye-of-the-cosmos', 4, 1810, 330, True, 0),
    ('baaliel-the-demon-general', 10, 1880, 740, True, 0),
    ('gon-the-frostbringer', 10, 1560, 880, True, 0),
    ('zsos-ssar-the-serpent-warlord', 10, 1720, 940, True, 0),
    ('arthor-the-king-of-blackport', 12, 1935, 990, True, 0),
    ('ida-the-adept-of-destruction', 10, 1380, 960, True, 0),
    ('grisgar-emissary-of-the-demon-lord', 4, 1300, 150, True, 0),
]
CENTER = [
    ('bubbles-the-bouncy-bunny', 4, 1024, 985, False, 0),
]


def sticker(slug, px, frame=0, flip=False):
    """Sprite mit Sticker-Umriss (innen hell, außen dunkel) als RGBA-Bild."""
    spr = bp.Sprite(slug)
    spr.px = px
    od, ol, sp, pad = spr.layers(frame, ml.WHITE, ml.INK)
    im = Image.new('RGBA', sp.size, (0, 0, 0, 0))
    for layer in (od, ol, sp):
        im.alpha_composite(layer)
    if flip:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    return im


def background():
    """Warmer Grund mit Dithering-Verlauf zur Mitte (wie title.png), Strahlen vom Sprengstern."""
    cw, ch = W // CELL, H // CELL
    ys, xs = np.mgrid[0:ch, 0:cw]
    dx, dy = (xs - cw / 2) / (cw * 0.5), (ys - ch / 2) / (ch * 0.5)
    ang = np.arctan2(dy, dx)
    rays = 0.5 + 0.5 * np.sin(ang * 14 + 0.6)                     # 14 Strahlen
    v = np.clip(1.0 - np.hypot(dx, dy) * 0.55, 0, 1) * 0.75 + rays * 0.25 * (np.hypot(dx, dy) > 0.35)
    th = np.tile(bp.BAYER4, (ch // 4 + 1, cw // 4 + 1))[:ch, :cw]
    ramp = np.array([CREAM, CREAM2, CREAM3], dtype=np.uint8)
    q = np.clip(np.floor(np.clip(v, 0, 1) * 2 + th - 0.2), 0, 2).astype(int)
    img = np.repeat(np.repeat(ramp[q], CELL, axis=0), CELL, axis=1)
    return Image.fromarray(img, 'RGB').convert('RGBA')


def lowres(draw_fn):
    """Zeichnet auf einem Viertel-Raster und vergrößert auf das 4-px-Raster des Banners."""
    lo = Image.new('RGBA', (W // CELL, H // CELL), (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(lo))
    return lo.resize((W, H), Image.NEAREST)


def burst(cx, cy, rx, ry, seed=4, spikes=22):
    """Sprengstern wie im Titelbild: roter Rand, goldene Füllung, hellere Mitte."""
    rnd = random.Random(seed)
    base = []
    for i in range(spikes * 2):
        a = i / (spikes * 2) * 2 * math.pi + 0.1
        r = (rnd.uniform(0.85, 1.12) if i % 2 == 0 else 0.62 * rnd.uniform(0.9, 1.05))
        base.append(((cx + math.cos(a) * rx * r) / CELL, (cy + math.sin(a) * ry * r) / CELL))

    def draw(d):
        for k, col in ((1.0, RED), (0.9, GOLD), (0.55, GOLD_LT)):
            d.polygon([(cx / CELL + (x - cx / CELL) * k, cy / CELL + (y - cy / CELL) * k) for x, y in base], fill=col)
    return lowres(draw)


def beam(src, dst, w0, colors):
    """Strahl von src nach dst (Breite w0 an der Quelle, spitz zulaufend), je Farbe ein engerer Kern."""
    (x0, y0), (x1, y1) = [(a / CELL, b / CELL) for a, b in (src, dst)]
    ang = math.atan2(y1 - y0, x1 - x0)
    nx, ny = -math.sin(ang), math.cos(ang)

    def draw(d):
        for k, col in enumerate(colors):
            w = w0 / CELL * (1.0 - k * 0.3)
            d.polygon([(x0 + nx * w, y0 + ny * w), (x0 - nx * w, y0 - ny * w), (x1 + nx * w * 0.25, y1 + ny * w * 0.25),
                       (x1 - nx * w * 0.25, y1 - ny * w * 0.25)], fill=col)
    return lowres(draw)


def glints(cv, spots):
    for (x, y, fr, z) in spots:
        st, an = ml.stamp_layer(fx.glyph_stamp('starglint', fr), fx.PAL['glint'], CELL * 2, z)
        ml.put(cv, st, x, y, an)


def banner():
    cv = background()
    cv.alpha_composite(burst(W // 2, H // 2, 560, 420))
    # Zauber und Strahlen der Heroes treffen sich hinter dem Schriftzug
    for src, dst, w, cols in (
            ((1810, 330), (1100, 540), 44, [RED_DK, (255, 130, 70), GOLD_LT]),                  # Argos: Augenstrahl
            ((1380, 960), (1090, 640), 36, [(214, 70, 30), (255, 150, 50), GOLD_LT]),            # Ida: Feuer
            ((1560, 880), (1150, 650), 32, [(60, 130, 200), (150, 210, 245), (255, 255, 255)]),   # Gon: Eis
            ((1880, 740), (1220, 590), 34, [(80, 30, 110), (160, 70, 190), (240, 190, 255)]),     # Baaliel: Dämonenmagie
            ((700, 190), (960, 520), 40, [(70, 80, 200), (140, 165, 255), (255, 255, 255)]),     # Molinda: Lichtstrahl
            ((640, 930), (930, 640), 34, [(90, 40, 160), (170, 110, 230), (245, 225, 255)]),     # Archibald: Zauber
            ((190, 975), (860, 620), 32, [(205, 150, 40), (255, 214, 90), (255, 250, 210)])):   # Nao: heiliges Licht
        cv.alpha_composite(beam(src, dst, w, cols))

    items = []
    for slug, px, x, y, flip, fr in LEFT + RIGHT + CENTER:
        im = sticker(slug, px, fr, flip)
        bb = im.getbbox()
        items.append((y + (bb[3] - bb[1]) / 2, im, bb, x, y))
    # Monia (Wink-Pose mit weißem Plus) fliegt links oben
    m_im, _ = ml.monia(10)
    bb = m_im.getbbox()
    items.append((250 + (bb[3] - bb[1]) / 2, m_im, bb, 330, 250))
    for _, im, bb, x, y in sorted(items, key=lambda t: t[0]):
        cv.alpha_composite(im, (int(x - (bb[0] + bb[2]) / 2), int(y - (bb[1] + bb[3]) / 2)))

    glints(cv, [(520, 330, 0, 2), (1560, 250, 1, 2), (960, 880, 0, 1), (1480, 760, 1, 1)])
    ml.put(cv, ml.wordmark(4), W // 2, H // 2)
    return cv


def safe_overlay(im):
    ov = im.copy().convert('RGBA')
    ImageDraw.Draw(ov).rectangle(SAFE, outline=(255, 60, 60, 255), width=4)
    return ov


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    cv = banner()
    cv.convert('RGB').save(OUT / 'banner-youtube.png', optimize=True)
    safe_overlay(cv).convert('RGB').save(OUT / 'banner-youtube-sicherer-bereich.png')
    print('fertig:', OUT / 'banner-youtube.png', (OUT / 'banner-youtube.png').stat().st_size // 1024, 'KB')


if __name__ == '__main__':
    main()
