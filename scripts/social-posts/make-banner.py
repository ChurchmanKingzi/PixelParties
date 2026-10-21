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

PX = 8                                             # ein Maßstab für alle Sprites (= 2 Logo-Pixel), damit die Pixel überall gleich groß sind
# (Sprite, Mitte x, Mitte y des sichtbaren Umrisses, gespiegelt?, Frame); Reihenfolge der Anordnung: von hinten nach vorn
LEFT = [
    ('mary-crestmas', 170, 380, False, 0),
    ('kasperov-the-king-of-kings-b', 900, 320, False, 0),
    ('cute-angel-molinda', 700, 170, False, 0),
    ('alleria-the-queen-of-spiders', 175, 690, False, 0),
    ('mega-priestess-johanna', 440, 790, False, 0),
    ('nao-the-barrier-priestess', 150, 1010, False, 0),
    ('bomb-berserker-bartas', 340, 1000, False, 0),
    ('archibald-the-archmage', 520, 985, False, 0),
    ('luna-pele-the-flame-dancer', 690, 1000, False, 0),
    ('beato-the-butterfly-witch', 840, 1030, False, 0),
]
RIGHT = [
    ('sol-rym-the-thunder-djinn', 1290, 170, True, 0),
    ('overlord-baaliel', 1700, 230, True, 0),
    ('champion-the-stormbringer', 1900, 340, True, 0),
    ('mad-scientist-heinz', 1540, 340, True, 0),
    ('baaliel-the-demon-general', 1900, 700, True, 0),
    ('nieht-the-blitz-blade', 1600, 800, True, 0),
    ('gon-the-frostbringer', 1480, 960, True, 0),
    ('ida-the-adept-of-destruction', 1290, 1000, True, 0),
    ('zsos-ssar-the-serpent-warlord', 1690, 990, True, 0),
    ('arthor-the-king-of-blackport', 1880, 1020, True, 0),
    ('dajan-conqueror-of-the-treasure-cave', 1990, 840, True, 0),
]
CENTER = [
    ('bakhm-the-desert-digger', 1024, 900, False, 0),
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


LEFT_RAMP = [(250, 238, 224), (232, 224, 246), (208, 200, 240), (178, 168, 230), (146, 134, 216)]        # kühl: die Helden
RIGHT_RAMP = [(255, 240, 214), (255, 222, 184), (255, 196, 160), (244, 156, 132), (222, 112, 112)]         # warm: die Gegner


def background():
    """Zweigeteilter Grund wie im Titelbild (links kühl, rechts warm): Strahlen vom Sprengstern, Halbtonpunkte, Tempolinien, Dithering."""
    cw, ch = W // CELL, H // CELL
    ys, xs = np.mgrid[0:ch, 0:cw]
    dx, dy = (xs - cw / 2 + 0.5) / (cw * 0.5), (ys - ch / 2 + 0.5) / (ch * 0.5)
    dist = np.hypot(dx, dy)
    ang = np.arctan2(dy, dx)
    # Trennlinie: gezackt durch die Mitte (Blitz), je Zeile leicht versetzt
    zig = (np.sin(ys * 0.21) * 7 + np.sin(ys * 0.07 + 1.3) * 12).astype(int)
    left = xs < cw / 2 + zig
    rays = (np.sin(ang * 11 + 0.4) > 0.15).astype(float)
    t = np.clip(dist * 1.15 - 0.15, 0, 1) * 0.78 + rays * 0.22 * (dist > 0.3)
    th = np.tile(bp.BAYER4, (ch // 4 + 1, cw // 4 + 1))[:ch, :cw]
    n = len(LEFT_RAMP) - 1
    q = np.clip(np.floor(np.clip(t, 0, 1) * n + th - 0.15), 0, n).astype(int)
    lo = np.where(left[..., None], np.array(LEFT_RAMP, dtype=np.uint8)[q], np.array(RIGHT_RAMP, dtype=np.uint8)[q])
    # Halbtonpunkte (wie im Comic): Raster 10 Zellen, Radius wächst nach außen, eine Stufe dunkler als der Grund
    sp = 10
    gx, gy = xs % sp - sp / 2 + 0.5, ys % sp - sp / 2 + 0.5
    rad = np.clip((dist - 0.42) * 7.0, 0, 3.6)
    dots = (np.hypot(gx, gy) < rad) & (dist > 0.42)
    q2 = np.clip(q + 1, 0, n)
    lo = np.where(dots[..., None], np.where(left[..., None], np.array(LEFT_RAMP, dtype=np.uint8)[q2], np.array(RIGHT_RAMP, dtype=np.uint8)[q2]), lo)
    im = Image.fromarray(lo, 'RGB')
    d = ImageDraw.Draw(im)
    rnd = random.Random(11)
    for _ in range(46):                                           # Tempolinien: helle, lange Striche, strahlenförmig von der Mitte
        a = rnd.uniform(0, 2 * math.pi)
        r0, r1 = rnd.uniform(0.55, 0.8), rnd.uniform(0.9, 1.3)
        x0, y0 = cw / 2 + math.cos(a) * r0 * cw * 0.5, ch / 2 + math.sin(a) * r0 * ch * 0.5
        x1, y1 = cw / 2 + math.cos(a) * r1 * cw * 0.5, ch / 2 + math.sin(a) * r1 * ch * 0.5
        d.line([(x0, y0), (x1, y1)], fill=(255, 250, 238), width=rnd.choice((1, 1, 2)))
    for _ in range(40):                                           # Funken und Konfetti in den Farben der beiden Seiten
        x, y = rnd.randrange(cw), rnd.randrange(ch)
        col = (255, 255, 255) if rnd.random() < 0.5 else ((120, 110, 220) if x < cw / 2 else (230, 90, 90))
        d.rectangle([x, y, x + rnd.choice((0, 1, 1, 2)), y + rnd.choice((0, 1, 1, 2))], fill=col)
    return im.resize((W, H), Image.NEAREST).convert('RGBA')


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
            ((1290, 170), (1120, 520), 44, [(200, 150, 20), (255, 210, 60), (255, 250, 200)]),   # Sol Rym: Blitz
            ((1290, 1000), (1090, 640), 36, [(214, 70, 30), (255, 150, 50), GOLD_LT]),            # Ida: Feuer
            ((1480, 960), (1150, 650), 32, [(60, 130, 200), (150, 210, 245), (255, 255, 255)]),   # Gon: Eis
            ((1900, 700), (1220, 590), 34, [(80, 30, 110), (160, 70, 190), (240, 190, 255)]),     # Baaliel: Dämonenmagie
            ((700, 170), (960, 520), 40, [(70, 80, 200), (140, 165, 255), (255, 255, 255)]),     # Molinda: Lichtstrahl
            ((520, 985), (930, 640), 34, [(90, 40, 160), (170, 110, 230), (245, 225, 255)]),     # Archibald: Zauber
            ((150, 1010), (860, 620), 32, [(205, 150, 40), (255, 214, 90), (255, 250, 210)])):   # Nao: heiliges Licht
        cv.alpha_composite(beam(src, dst, w, cols))

    items = []
    for slug, x, y, flip, fr in LEFT + RIGHT + CENTER:
        im = sticker(slug, PX, fr, flip)
        bb = im.getbbox()
        items.append((y + (bb[3] - bb[1]) / 2, im, bb, x, y))
    # Monia (Wink-Pose mit weißem Plus) fliegt links oben
    m_im, _ = ml.monia(PX)
    bb = m_im.getbbox()
    items.append((230 + (bb[3] - bb[1]) / 2, m_im, bb, 330, 230))
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
