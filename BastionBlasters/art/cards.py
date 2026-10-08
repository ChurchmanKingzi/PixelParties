"""Kartenrenderer: 160 x 224 px, nativ im Pixelraster, Daten aus daten/cards.json + daten/kartentexte.json.

Aufruf (aus art/):  python3 -I cards.py      -> out/karten/*.png, out/karten_uebersicht.png, out/kartenruecken.png
"""
from __future__ import annotations

import json
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pixl import *
from pixfont import draw_text, text_width, wrap
from cardicons import blit_icon, icon_canvas

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
OUT = os.path.join(HERE, 'out')

CARD_W, CARD_H = 160, 224
ROMAN = {1: 'I', 2: 'II', 3: 'III', 4: 'IV'}
CAT_RAMP = {'artillerie': 'fire', 'sturm': 'gold', 'verteidiger': 'ice', 'zivilist': 'leaf', 'bau': 'purple'}
TIER_RAMP = {1: 'stone', 2: 'leaf', 3: 'ice', 4: 'gold'}


def C(ramp, i):
    return RAMPS[ramp][i]


def rect(img, x0, y0, x1, y1, col):
    img[y0:y1 + 1, x0:x1 + 1, :3] = col
    img[y0:y1 + 1, x0:x1 + 1, 3] = 255


def dot(img, x, y, col):
    if 0 <= x < img.shape[1] and 0 <= y < img.shape[0]:
        img[y, x, :3] = col
        img[y, x, 3] = 255


def shape_mask(w, h, r=3):
    m = np.ones((h, w), bool)
    cut = {0: 3, 1: 1, 2: 1} if r == 3 else {0: 1}
    for y, n in cut.items():
        m[y, :n] = False
        m[y, w - n:] = False
        m[h - 1 - y, :n] = False
        m[h - 1 - y, w - n:] = False
    return m


def card_frame(ramp):
    """Rahmen mit Bevel, Pergament-Innenfläche; liefert (img, mask)"""
    img = np.zeros((CARD_H, CARD_W, 4), np.uint8)
    m = shape_mask(CARD_W, CARD_H)
    ys, xs = np.nonzero(m)
    for y, x in zip(ys, xs):
        d_top, d_left, d_bot, d_right = y, x, CARD_H - 1 - y, CARD_W - 1 - x
        d = min(d_top, d_left, d_bot, d_right)
        if d >= 3:
            continue
        lit = min(d_top, d_left) <= min(d_bot, d_right)
        idx = (5 if d == 1 else 4) if lit else (1 if d == 1 else 2)
        if d == 2:
            idx = 3
        dot(img, x, y, C(ramp, idx))
    # Außenkontur: Maskenpixel mit Nachbarn außerhalb
    pad = np.pad(m, 1, constant_values=False)
    for y, x in zip(ys, xs):
        if not (pad[y, x + 1] and pad[y + 2, x + 1] and pad[y + 1, x] and pad[y + 1, x + 2]):
            dot(img, x, y, INK)
    # Pergament
    bone = RAMPS['bone']
    for y in range(3, CARD_H - 3):
        for x in range(3, CARD_W - 3):
            if (x in (3, CARD_W - 4)) and (y in (3, CARD_H - 4)):
                continue
            col = bone[4]
            if (x * 7 + y * 13) % 29 == 0 or (x * 3 + y * 11) % 41 == 0:
                col = bone[3]
            if (x + y) % 2 == 0 and (x * 5 + y * 3) % 17 < 2:
                col = bone[5]
            dot(img, x, y, col)
    # innere Tintenlinie
    for x in range(4, CARD_W - 4):
        dot(img, x, 3, INK)
        dot(img, x, CARD_H - 4, INK)
    for y in range(4, CARD_H - 4):
        dot(img, 3, y, INK)
        dot(img, CARD_W - 4, y, INK)
    # Pergament-Innenfläche nach innen versetzen (Linie liegt auf Rand)
    return img, m


def draw_pill(img, x, y, w, h, ramp):
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            corner = (xx in (x, x + w - 1)) and (yy in (y, y + h - 1))
            if corner:
                continue
            lit = (yy - y) <= 1 or (xx - x) <= 0
            low = (yy - y) >= h - 2
            idx = 5 if lit else (1 if low else 3)
            dot(img, xx, yy, C(ramp, idx))
    for xx in range(x + 1, x + w - 1):
        dot(img, xx, y - 1, INK)
        dot(img, xx, y + h, INK)
    for yy in range(y + 1, y + h - 1):
        dot(img, x - 1, yy, INK)
        dot(img, x + w, yy, INK)


def draw_banner(img, ramp, y0=118, y1=131):
    """Namensband mit zwei abgesetzten Schwänzen (über den Kartenrand hinaus)"""
    ty0 = y0 + 2
    for (xa, xb) in ((1, 8), (151, 158)):
        for y in range(ty0, y1 + 1):
            for x in range(xa, xb + 1):
                edge = y in (ty0, y1) or x in (xa, xb)
                dot(img, x, y, INK if edge else C(ramp, 1 if (x + y) % 2 else 2))
    # Kerben (Schwalbenschwanz) an den äußeren Enden
    for k in range(3):
        for (x, sgn) in ((1, 1), (158, -1)):
            dot(img, x + sgn * k, (ty0 + y1) // 2 - 1 + k, INK)
            dot(img, x + sgn * k, (ty0 + y1) // 2 + 1 - k, INK)
    # Band
    for y in range(y0, y1 + 1):
        for x in range(6, 154):
            if y in (y0, y1) or x in (6, 153):
                dot(img, x, y, INK)
            elif y == y0 + 1:
                dot(img, x, y, C(ramp, 5))
            elif y == y1 - 1:
                dot(img, x, y, C(ramp, 1))
            else:
                dot(img, x, y, C(ramp, 4 if (x * 3 + y * 7) % 11 == 0 else 3))


def items_width(items):
    w = 0
    for ic, t in items:
        w += 7 + 1 + text_width(t) + 4
    return max(0, w - 4)


def draw_items_right(img, items, x_right, y_icon, text_col, plus=True):
    x = x_right
    for ic, t in reversed(items):
        label = ('+' + t) if (ic == 'nachschub' and plus) else t
        tw = text_width(label)
        x -= tw
        draw_text(img, x, y_icon, label, text_col)
        x -= 1 + 7
        blit_icon(img, ic, x, y_icon)
        x -= 4


def render_card(card: dict, tx: dict, art: Image.Image) -> Image.Image:
    cat = card['kategorie']
    ramp = CAT_RAMP[cat]
    img, mask = card_frame(ramp)
    # --- Kopfzeile
    tier = card['tier']
    roman = ROMAN[tier]
    pw = text_width(roman) + 8
    draw_pill(img, 6, 4, pw, 12, TIER_RAMP[tier])
    draw_text(img, 10, 7, roman, WHITE, shadow=INK)
    draw_text(img, 6 + pw + 5, 7, card['id'], C('stone', 2))
    stars = tx.get('sterne', 1)
    for k in range(3):
        blit_icon(img, 'stern' if k < stars else 'stern_leer', 127 + k * 8, 5)
    # --- Bildfenster
    rect(img, 6, 17, 153, 116, INK)
    for x in range(7, 153):
        dot(img, x, 18, C(ramp, 5))
        dot(img, x, 115, C(ramp, 1))
    for y in range(18, 116):
        dot(img, 7, y, C(ramp, 4))
        dot(img, 152, y, C(ramp, 2))
    a = np.array(art.convert('RGBA'))
    img[19:19 + a.shape[0], 8:8 + a.shape[1]] = a
    # --- Banner mit Namen
    draw_banner(img, ramp)
    name = card['name']
    nw = text_width(name)
    draw_text(img, (CARD_W - nw) // 2, 122, name, WHITE, outline=INK)
    # --- Typzeile
    draw_text(img, 8, 135, tx['typ'], C(ramp, 1), bold=False)
    draw_items_right(img, tx.get('rechts', []), 122, 7, INK)
    # --- Werteleiste
    for y in range(143, 157):
        for x in range(8, 152):
            dot(img, x, y, C('stone', 0) if y not in (143, 156) else C('stone', 1))
    stats = tx.get('stats', [])
    total = sum(7 + 2 + text_width(t) for _, t in stats)
    gap = (136 - total) / max(1, len(stats) - 1) if len(stats) > 1 else 0
    gap = min(gap, 16)
    x = 12.0 if len(stats) > 1 else 14
    if len(stats) > 1:
        x = 8 + (144 - (total + gap * (len(stats) - 1))) / 2
    for ic, t in stats:
        blit_icon(img, ic, int(round(x)), 146)
        draw_text(img, int(round(x)) + 9, 146, t, WHITE)
        x += 7 + 2 + text_width(t) + gap
    # --- Regeltext (3 Zeilen; 4, wenn es keine Zusatzzeile gibt)
    z = tx.get('zeile2')
    lines = wrap(tx['regel'], 144)
    limit = 3 if z else 4
    if len(lines) > limit:
        print('WARNUNG: Regeltext zu lang:', card['id'], len(lines), file=sys.stderr)
    for k, line in enumerate(lines[:limit]):
        draw_text(img, 8, 158 + 9 * k, line, INK)
    # --- Zusatzzeile (Talent / Hinweis)
    if z:
        warn = z['badge'] == '!'
        bw = text_width(z['badge']) + 6
        draw_pill(img, 8, 185, bw, 11, 'fire' if warn else 'gold')
        draw_text(img, 11 + (1 if warn else 0), 187, z['badge'], WHITE if warn else INK)
        draw_text(img, 8 + bw + 4, 187, z['text'], C(ramp, 1))
        if text_width(z['text']) + bw + 12 > 144:
            print('WARNUNG: Zusatzzeile zu lang:', card['id'], file=sys.stderr)
    # --- Trennlinie und Flavor
    for x in range(8, 152):
        if x % 2 == 0:
            dot(img, x, 198, C('bone', 2))
    fl = wrap(tx['flavor'], 144)
    if len(fl) > 2:
        print('WARNUNG: Flavor zu lang:', card['id'], file=sys.stderr)
    for k, line in enumerate(fl[:2]):
        draw_text(img, (CARD_W - text_width(line)) // 2, 202 + 9 * k, line, C('stone', 1))
    out = Image.fromarray(img, 'RGBA')
    # Ecken freistellen
    a = np.array(out)
    a[~mask, 3] = 0
    return Image.fromarray(a, 'RGBA')


def render_back() -> Image.Image:
    """Kartenrücken: Gitter aus Rauten (Dither), Kernkristall im Medaillon, Titel"""
    ramp = 'purple'
    img, mask = card_frame(ramp)
    # Innenfläche neu: dunkles Violett mit Rautengitter
    for y in range(4, CARD_H - 4):
        for x in range(4, CARD_W - 4):
            u = (x + y) % 16
            v = (x - y) % 16
            line = u in (0, 1) or v in (0, 1)
            col = C(ramp, 2 if line else 1)
            if line and (x + y) % 2:
                col = C(ramp, 3)
            dot(img, x, y, col)
    for x in range(4, CARD_W - 4):
        dot(img, x, 3, INK)
        dot(img, x, CARD_H - 4, INK)
    for y in range(4, CARD_H - 4):
        dot(img, 3, y, INK)
        dot(img, CARD_W - 4, y, INK)
    # Medaillon
    cx, cy, r = 80, 112, 38
    for y in range(cy - r - 2, cy + r + 3):
        for x in range(cx - r - 2, cx + r + 3):
            d = np.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if d <= r + 1.5:
                col = INK if d > r - 0.5 else (C('gold', 5) if d > r - 2 and x + y < cx + cy else (C('gold', 2) if d > r - 2 else C('purple', 0)))
                if d <= r - 3:
                    col = C('purple', 0) if ((x + y) % 2 or d < 20) else C('purple', 1)
                dot(img, x, y, col)
    from assets_env import core
    cr = core(glow='purple')
    arr = np.array(cr.to_image())
    sub = arr[2:78, :]
    h, w = sub.shape[:2]
    x0, y0 = cx - w // 2, cy - h // 2 + 2
    m = sub[:, :, 3] > 0
    reg = img[y0:y0 + h, x0:x0 + w]
    reg[m] = sub[m]
    t1, t2 = 'BASTION', 'BLASTERS'
    draw_text(img, (CARD_W - text_width(t1, True)) // 2, 20, t1, C('gold', 5), bold=True, outline=INK)
    draw_text(img, (CARD_W - text_width(t2, True)) // 2, 32, t2, C('gold', 5), bold=True, outline=INK)
    for k in range(3):
        blit_icon(img, 'stern', 68 + k * 8, 200)
    out = np.array(Image.fromarray(img, 'RGBA'))
    out[~mask, 3] = 0
    return Image.fromarray(out, 'RGBA')


def main():
    cards = {c['id']: c for c in json.load(open(os.path.join(ROOT, 'daten', 'cards.json'), encoding='utf-8'))}
    texts = json.load(open(os.path.join(ROOT, 'daten', 'kartentexte.json'), encoding='utf-8'))
    import cards_art
    outdir = os.path.join(OUT, 'karten')
    os.makedirs(outdir, exist_ok=True)
    rendered = []
    for cid in texts:
        card = cards[cid]
        art = cards_art.art_unit(cid) if card['kategorie'] != 'bau' else cards_art.art_building(cid)
        im = render_card(card, texts[cid], art)
        bad = palette_violations(im)
        if bad:
            print(f'WARNUNG: {cid} nutzt {bad} Farben außerhalb der Master-Palette', file=sys.stderr)
        im.save(os.path.join(outdir, f'{cid}.png'))
        rendered.append((cid, im))
    back = render_back()
    back.save(os.path.join(OUT, 'kartenruecken.png'))
    cols = 6
    rows = (len(rendered) + cols - 1) // cols
    sc, pad = 2, 12
    sheet_img = Image.new('RGBA', (cols * (CARD_W * sc + pad) + pad, rows * (CARD_H * sc + pad) + pad), hexrgb('#2b2540') + (255,))
    for k, (cid, im) in enumerate(rendered):
        x = pad + (k % cols) * (CARD_W * sc + pad)
        y = pad + (k // cols) * (CARD_H * sc + pad)
        sheet_img.alpha_composite(upscale(im, sc), (x, y))
    sheet_img.save(os.path.join(OUT, 'karten_uebersicht.png'))
    for cid in ('UA-01', 'US-06', 'BH-01', 'BS-06'):
        upscale(dict(rendered)[cid], 3).save(os.path.join(outdir, f'{cid}_x3.png'))
    print(len(rendered), 'Karten gerendert')


if __name__ == '__main__':
    main()
