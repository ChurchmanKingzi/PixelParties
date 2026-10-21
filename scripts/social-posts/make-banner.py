#!/usr/bin/env python3
"""YouTube-Kanalbanner (2048×1152, höchstens 6 MB) im Stil der Reels.

    python3 scripts/social-posts/make-banner.py

Ergebnis: scripts/social-posts/out/branding/banner-youtube.png (plus banner-youtube-sicherer-bereich.png zur Kontrolle).

YouTube zeigt je nach Gerät unterschiedliche Ausschnitte; auf dem Handy bleibt nur die Mitte (1235 × 338 px, x 406…1641, y 407…745)
sichtbar. Dort stehen deshalb Schriftzug und Schlagzeile; Monia und die Heroes rechts und links sind Zugabe für Desktop und Fernseher.
"""
import importlib.util
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
FLIP = {'right': 1, 'left': -1}


def stars(cv, seed=7, n=90):
    rnd = np.random.default_rng(seed)
    d = ImageDraw.Draw(cv)
    for _ in range(n):
        x, y = int(rnd.integers(0, W // 12)) * 12, int(rnd.integers(0, H // 12)) * 12
        c = (220, 235, 255, 255) if rnd.random() < 0.4 else (110, 170, 240, 255)
        d.rectangle([x, y, x + 5, y + 5], fill=c)


def hero(slug, px, frame=0, flip=False, accent=(244, 244, 240)):
    """Sprite mit Sticker-Umriss, Rückgabe: Bild und (Mitte x, Fußlinie y) darin."""
    spr = bp.Sprite(slug)
    spr.px = px
    od, ol, sp, pad = spr.layers(frame, accent, ml.INK)
    im = Image.new('RGBA', sp.size, (0, 0, 0, 0))
    for layer in (od, ol, sp):
        im.alpha_composite(layer)
    cx, foot = pad + spr.center_x * px, pad + spr.foot * px
    if flip:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
        cx = im.width - cx
    return im, (cx, foot)


def stand(cv, slug, px, x, y, frame=0, flip=False, shadow=True):
    im, (cx, foot) = hero(slug, px, frame, flip)
    if shadow:
        sh = Image.new('RGBA', (int(im.width * 0.7), 28), (0, 0, 0, 0))
        ImageDraw.Draw(sh).ellipse([0, 0, sh.width - 1, sh.height - 1], fill=(7, 6, 13, 150))
        cv.alpha_composite(sh, (int(x - sh.width / 2), int(y - 12)))
    cv.alpha_composite(im, (int(x - cx), int(y - foot)))


def banner(heart_cell=7, wm_scale=3):
    cv = ml.dark_background((W, H))
    stars(cv)

    # Wolkenboden: überlappende Wolken auf einem hellen Streifen
    cu = 12
    ImageDraw.Draw(cv).rectangle([0, H - 64, W, H], fill=(226, 238, 255, 255))
    for i, (x, w, h, sd) in enumerate([(-120, 60, 22, 3), (420, 62, 20, 5), (960, 58, 22, 8), (1500, 62, 20, 2)]):
        cl = ml.flat_cloud(cu, w, h, sd)
        cv.alpha_composite(cl, (x, H - cl.height + 56 + (i % 2) * 20))

    # Monia vor ihrem Herz links oben
    heart = ml.heart_layer(heart_cell)
    cx, cy = 215, 330
    cv.alpha_composite(heart, (cx - heart.width // 2, cy - heart.height // 2))
    m_im, (mfx, mfoot) = ml.monia(10)
    cv.alpha_composite(m_im, (int(cx - mfx), int(cy - m_im.height * 0.52)))
    for (dx, dy, fr) in ((-0.72, -0.34, 0), (0.78, -0.42, 1)):
        st, an = ml.stamp_layer(fx.glyph_stamp('starglint', fr), fx.PAL['glint'], 12, 2)
        ml.put(cv, st, cx + dx * heart.width, cy + dy * heart.height, an)

    # Argos schwebt rechts oben
    im, (acx, afoot) = hero('argos-the-eye-of-the-cosmos', 3)
    cv.alpha_composite(im, (1830 - im.width // 2, 330 - im.height // 2))

    # Heroes auf den Wolken, blicken zur Mitte
    ground = H - 150
    stand(cv, 'beato-the-butterfly-witch', 10, 130, ground + 40)
    stand(cv, 'bomb-berserker-bartas', 10, 400, ground + 10)
    stand(cv, 'nao-the-barrier-priestess', 10, 1640, ground + 10, flip=True)
    stand(cv, 'zsos-ssar-the-serpent-warlord', 10, 1880, ground + 40, flip=True)

    # Schriftzug und Schlagzeile im sicheren Bereich
    wm = ml.wordmark(wm_scale)
    ml.put(cv, wm, W // 2, 525)
    bp.draw_text(cv, 'THE FREE ONLINE TCG', 5, (W // 2, 650), color=ml.WHITE)
    bp.draw_text(cv, 'PIXELPARTIESTCG.COM', 3, (W // 2, 700), color=ml.ACCENT)
    return cv


def safe_overlay(im):
    ov = im.copy().convert('RGBA')
    d = ImageDraw.Draw(ov)
    d.rectangle(SAFE, outline=(255, 60, 60, 255), width=4)
    return ov


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    cv = banner()
    cv.convert('RGB').save(OUT / 'banner-youtube.png', optimize=True)
    safe_overlay(cv).convert('RGB').save(OUT / 'banner-youtube-sicherer-bereich.png')
    print('fertig:', OUT / 'banner-youtube.png', (OUT / 'banner-youtube.png').stat().st_size // 1024, 'KB')


if __name__ == '__main__':
    main()
