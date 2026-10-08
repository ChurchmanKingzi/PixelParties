"""Kartenrenderer: 160 x 224 px, nativ im Pixelraster.

Daten: daten/cards.json (aus den Katalogen exportiert), daten/card_text.json (englische Kartentexte),
daten/keywords.json (Glossar, strenge Nomenklatur: Glossarbegriffe werden automatisch fett gesetzt).

Aufruf (aus art/):  python3 -I cards.py      -> out/cards/*.png, out/cards_overview.png, out/card_back.png
"""
from __future__ import annotations

import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(ROOT, 'tools'))

from pixl import *
from pixfont import draw_text, text_width, draw_rich, rich_width, wrap_rich, _glyph
from cardicons import blit_icon
import glossary

OUT = os.path.join(HERE, 'out')

# Begriffsfelder je Karte (Pixel im 160 x 224-Raster), damit das Spiel Glossarbegriffe beim Überfahren erklären kann
HOTSPOTS: dict[str, list] = {}


def _hs(cid, surface, x, y, w, h=9, kinds=None):
    k = glossary.lookup(surface, kinds)
    if k is not None:
        HOTSPOTS.setdefault(cid, []).append({'t': k['en'], 'k': k['kind'], 'x': int(x), 'y': int(y), 'w': int(w), 'h': h})


def _flat_info(segs):
    """Flachtext und je Zeichen (Abschnittsnummer, Glossareintrag) für ganze fette Abschnitte, die Glossarbegriffe sind"""
    flat = ''.join(t for t, _ in segs)
    span = []
    for i, (t, b) in enumerate(segs):
        k = glossary.lookup(t.rstrip(': ')) if b else None
        span.extend([(i, k) if k else None] * len(t))
    return flat, span


def _line_hotspots(cid, ln, x0, y, flat, span, p):
    """Felder der Begriffe einer umbrochenen Zeile; p = Leseposition im Flachtext. Liefert die neue Position."""
    chars = [(ch, b) for t, b in ln for ch in t]
    while p < len(flat) and flat[p] == ' ' and chars and chars[0][0] != ' ':
        p += 1                                          # beim Umbruch entfallenes Leerzeichen
    cx = x0
    cur = None                                          # (Abschnitt, Eintrag, x_start)
    for j, (ch, b) in enumerate(chars):
        sp = span[p + j] if p + j < len(span) else None
        if cur and (sp is None or sp[0] != cur[0]):
            HOTSPOTS.setdefault(cid, []).append({'t': cur[1]['en'], 'k': cur[1]['kind'], 'x': int(cur[2]), 'y': int(y - 2), 'w': int(cx - 1 - cur[2]), 'h': 9})
            cur = None
        if sp and not cur:
            cur = (sp[0], sp[1], cx)
        cx += _glyph(ch).shape[1] + 1 + (1 if b else 0)
    if cur:
        HOTSPOTS.setdefault(cid, []).append({'t': cur[1]['en'], 'k': cur[1]['kind'], 'x': int(cur[2]), 'y': int(y - 2), 'w': int(cx - 1 - cur[2]), 'h': 9})
    return p + len(chars)

CARD_W, CARD_H = 160, 224
ROMAN = {1: 'I', 2: 'II', 3: 'III', 4: 'IV'}
CAT_RAMP = {'artillerie': 'fire', 'sturm': 'gold', 'verteidiger': 'ice', 'zivilist': 'leaf', 'bau': 'purple'}
TIER_RAMP = {1: 'stone', 2: 'leaf', 3: 'ice', 4: 'gold'}

# --- Layout (y-Koordinaten; Texte werden an der Oberkante der Versalien positioniert)
ART_Y0, ART_H = 19, 86                 # Bildfenster 144 x 86
FRAME_Y0, FRAME_Y1 = 17, 106
BANNER_Y0, BANNER_Y1 = 108, 121
TYPE_Y = 125
STRIP_Y0, STRIP_Y1 = 133, 146
STRIP_TEXT_Y = 136
EFFECT_Y = 149
EFFECT_MAX_LINES = 6                    # ab 6 Zeilen rückt die Trennlinie nach unten und der Flavor hat nur eine Zeile
DIVIDER_Y, DIVIDER_Y_LONG = 198, 206
FLAVOR_Y, FLAVOR_Y_LONG = (202, 211), 209
TEXT_X, TEXT_W = 8, 144


def C(ramp, i):
    return RAMPS[ramp][i]


def rect(img, x0, y0, x1, y1, col):
    img[y0:y1 + 1, x0:x1 + 1, :3] = col
    img[y0:y1 + 1, x0:x1 + 1, 3] = 255


def dot(img, x, y, col):
    if 0 <= x < img.shape[1] and 0 <= y < img.shape[0]:
        img[y, x, :3] = col
        img[y, x, 3] = 255


def shape_mask(w, h):
    m = np.ones((h, w), bool)
    for y, n in {0: 3, 1: 1, 2: 1}.items():
        m[y, :n] = False
        m[y, w - n:] = False
        m[h - 1 - y, :n] = False
        m[h - 1 - y, w - n:] = False
    return m


def card_frame(ramp):
    """Rahmen mit Bevel und Pergament-Innenfläche; liefert (Bild, Maske)"""
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
    pad = np.pad(m, 1, constant_values=False)
    for y, x in zip(ys, xs):
        if not (pad[y, x + 1] and pad[y + 2, x + 1] and pad[y + 1, x] and pad[y + 1, x + 2]):
            dot(img, x, y, INK)
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
    for x in range(4, CARD_W - 4):
        dot(img, x, 3, INK)
        dot(img, x, CARD_H - 4, INK)
    for y in range(4, CARD_H - 4):
        dot(img, 3, y, INK)
        dot(img, CARD_W - 4, y, INK)
    return img, m


def draw_pill(img, x, y, w, h, ramp):
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            if (xx in (x, x + w - 1)) and (yy in (y, y + h - 1)):
                continue
            lit = (yy - y) <= 1 or (xx - x) <= 0
            low = (yy - y) >= h - 2
            dot(img, xx, yy, C(ramp, 5 if lit else (1 if low else 3)))
    for xx in range(x + 1, x + w - 1):
        dot(img, xx, y - 1, INK)
        dot(img, xx, y + h, INK)
    for yy in range(y + 1, y + h - 1):
        dot(img, x - 1, yy, INK)
        dot(img, x + w, yy, INK)


def draw_banner(img, ramp, y0, y1):
    """Namensband mit zwei abgesetzten Schwänzen (über den Kartenrand hinaus)"""
    ty0 = y0 + 2
    for (xa, xb) in ((1, 8), (151, 158)):
        for y in range(ty0, y1 + 1):
            for x in range(xa, xb + 1):
                edge = y in (ty0, y1) or x in (xa, xb)
                dot(img, x, y, INK if edge else C(ramp, 1 if (x + y) % 2 else 2))
    for k in range(3):
        for (x, sgn) in ((1, 1), (158, -1)):
            dot(img, x + sgn * k, (ty0 + y1) // 2 - 1 + k, INK)
            dot(img, x + sgn * k, (ty0 + y1) // 2 + 1 - k, INK)
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


def draw_items_right(img, items, x_right, y, text_col):
    """Symbol-Wert-Paare rechtsbündig (Reinforce bekommt ein Plus)"""
    x = x_right
    for ic, t in reversed(items):
        label = ('+' + t) if ic == 'reinforce' else t
        x -= text_width(label)
        draw_text(img, x, y, label, text_col)
        x -= 1 + 7
        blit_icon(img, ic, x, y)
        x -= 4


# --------------------------------------------------------------------------- Karteninhalte aus den Daten ableiten


def type_parts(card):
    """Teile der Typzeile; type_line() und draw_type_line() bauen darauf auf"""
    cat = card['kategorie']
    if cat == 'bau':
        bt = card['build_type_en'].upper()
        size = card.get('masse')
        return [f'{bt} {size}' if size else bt, card['group_en']]
    parts = [card['category_en'].upper(), card['line_en']]
    extra = card.get('trajectory_en') or card.get('doctrine_en') or card.get('zone_en')
    if extra:
        parts.append(extra)
    return parts


def type_line(card):
    return ' · '.join(type_parts(card))


SEP_GAPS = (4, 2)     # Abstand links und rechts vom Trennpunkt; die engere Stufe nur, wenn die Zeile sonst nicht passt


def type_line_gap(card):
    """größte Trennerlücke, bei der die Typzeile in die Textbreite passt (None = passt auch eng nicht)"""
    parts = type_parts(card)
    base = sum(text_width(t) for t in parts)
    for gap in SEP_GAPS:
        if base + (len(parts) - 1) * (2 * gap + 1) <= TEXT_W:
            return gap
    return None


def draw_type_line(img, ramp, card):
    parts = type_parts(card)
    gap = type_line_gap(card)
    if gap is None:
        gap = SEP_GAPS[-1]
        print(f'WARNUNG: Typzeile zu breit: {card["id"]} ({type_line(card)})', file=sys.stderr)
    x = TEXT_X
    for i, t in enumerate(parts):
        if i:
            x += gap
            draw_text(img, x, TYPE_Y, '·', C(ramp, 1))
            x += 1 + gap
        draw_text(img, x, TYPE_Y, t, C(ramp, 1))
        word = t.split(' ')[0] if card['kategorie'] == 'bau' and i == 0 else t
        if card['kategorie'] == 'bau':
            kinds = ('build_type',) if i == 0 else ('group',)
        else:
            kinds = ('card_type',) if i == 0 else ('line',) if i == 1 else ('trajectory', 'doctrine', 'zone')
        _hs(card['id'], word, x, TYPE_Y - 2, text_width(word), 10, kinds)
        x += text_width(t)


def header_items(card):
    items = []
    if card['kategorie'] == 'bau':
        if card.get('geschuetzplaetze'):
            items.append(('cannon', str(card['geschuetzplaetze'])))
        if card.get('posten'):
            items.append(('person', str(card['posten'])))
        return items
    if card['kategorie'] == 'artillerie' and isinstance(card.get('gp'), int):
        items.append(('cannon', str(card['gp'])))
    items.append(('person', str(card['soll'])))
    items.append(('reinforce', str(card['nachschub'])))
    return items


def balanced_two_lines(text):
    """Flavor: Einzeiler bleibt einzeilig, sonst auf zwei möglichst gleich lange Zeilen verteilen"""
    one = wrap_rich([(text, False)], TEXT_W, TEXT_W)
    if len(one) <= 1:
        return one
    words = text.split(' ')
    best = None
    for k in range(1, len(words)):
        a, b = ' '.join(words[:k]), ' '.join(words[k:])
        w = max(text_width(a), text_width(b))
        if best is None or w < best[0]:
            best = (w, a, b)
    return [[(best[1], False)], [(best[2], False)]]


def effect_blocks(tx):
    """Regeltext und Talent als Zeilenblöcke: [(Abzeichen oder None, Abschnittsliste)]"""
    blocks = []
    if tx.get('rules'):
        blocks.append((None, glossary.segments(tx['rules'])))
    if tx.get('talent'):
        blocks.append(('RANK 3', glossary.segments(tx['talent'])))
    return blocks


def render_card(card: dict, tx: dict, art: Image.Image) -> Image.Image:
    cat = card['kategorie']
    ramp = CAT_RAMP[cat]
    img, mask = card_frame(ramp)
    # --- Kopfzeile: Tier, ID, Squad/Reinforce/Crew, Sterne
    tier = card['tier']
    roman = ROMAN[tier]
    pw = text_width(roman) + 8
    draw_pill(img, 6, 4, pw, 12, TIER_RAMP[tier])
    draw_text(img, 10, 7, roman, WHITE, shadow=INK)
    draw_text(img, 6 + pw + 5, 7, card['id'], C('stone', 2))
    draw_items_right(img, header_items(card), 122, 7, INK)
    for k in range(3):
        blit_icon(img, 'star' if k < tx.get('stars', 1) else 'star_empty', 127 + k * 8, 5)
    # --- Bildfenster
    rect(img, 6, FRAME_Y0, 153, FRAME_Y1, INK)
    for x in range(7, 153):
        dot(img, x, FRAME_Y0 + 1, C(ramp, 5))
        dot(img, x, FRAME_Y1 - 1, C(ramp, 1))
    for y in range(FRAME_Y0 + 1, FRAME_Y1):
        dot(img, 7, y, C(ramp, 4))
        dot(img, 152, y, C(ramp, 2))
    a = np.array(art.convert('RGBA'))
    top = (a.shape[0] - ART_H) // 2
    a = a[top:top + ART_H]
    img[ART_Y0:ART_Y0 + ART_H, 8:8 + a.shape[1]] = a
    # --- Namensband
    draw_banner(img, ramp, BANNER_Y0, BANNER_Y1)
    name = card['name_en']
    draw_text(img, (CARD_W - text_width(name)) // 2, BANNER_Y0 + 4, name, WHITE, outline=INK)
    # --- Typzeile und Werteleiste
    draw_type_line(img, ramp, card)
    for y in range(STRIP_Y0, STRIP_Y1 + 1):
        for x in range(8, 152):
            dot(img, x, y, C('stone', 1) if y in (STRIP_Y0, STRIP_Y1) else C('stone', 0))
    stats = tx.get('stats', [])
    ig = 2                                           # Abstand Symbol -> Wert; bei vollen Leisten 1 px
    total = sum(7 + ig + text_width(t) for _, t in stats)
    gap = min(16, (136 - total) / (len(stats) - 1)) if len(stats) > 1 else 0
    if gap < 3 and len(stats) > 1:
        ig = 1
        total = sum(7 + ig + text_width(t) for _, t in stats)
        gap = min(16, (136 - total) / (len(stats) - 1))
        if gap < 2:
            print(f'WARNUNG: Werteleiste sehr eng: {card["id"]} (Lücke {gap:.1f})', file=sys.stderr)
    x = 8 + (144 - (total + gap * max(0, len(stats) - 1))) / 2
    for ic, t in stats:
        blit_icon(img, ic, int(round(x)), STRIP_TEXT_Y)
        draw_text(img, int(round(x)) + 7 + ig, STRIP_TEXT_Y, t, WHITE)
        x += 7 + ig + text_width(t) + gap
    # --- Effektbox: nur mechanischer Text (Flavor steht unter der Trennlinie)
    y = EFFECT_Y
    nlines = 0
    for k, (badge, segs) in enumerate(effect_blocks(tx)):
        flat, span = _flat_info(segs)
        rp = 0
        if badge:
            bw = text_width(badge) + 7
            if k > 0:
                y += 2
            draw_pill(img, TEXT_X, y - 2, bw, 11, 'gold')
            draw_text(img, TEXT_X + 4, y, badge, INK)
            lines = wrap_rich(segs, TEXT_W - bw - 4, TEXT_W)
        else:
            bw = 0
            lines = wrap_rich(segs, TEXT_W, TEXT_W)
        for i, ln in enumerate(lines):
            x0 = TEXT_X + (bw + 4 if (badge and i == 0) else 0)
            draw_rich(img, x0, y, ln, INK)
            rp = _line_hotspots(card['id'], ln, x0, y, flat, span, rp)
            y += 9
            nlines += 1
    if nlines > EFFECT_MAX_LINES:
        print(f'WARNUNG: Effekttext zu lang: {card["id"]} ({nlines} Zeilen)', file=sys.stderr)
    # --- Flavor (bei 6 Effektzeilen nur eine Zeile)
    long_effect = nlines >= 6
    div_y = DIVIDER_Y_LONG if long_effect else DIVIDER_Y
    for x in range(8, 152):
        if x % 2 == 0:
            dot(img, x, div_y, C('bone', 2))
    fl = balanced_two_lines(tx['flavor'])
    if len(fl) > (1 if long_effect else 2):
        print(f'WARNUNG: Flavor zu lang: {card["id"]} ({len(fl)} Zeilen bei {nlines} Effektzeilen)', file=sys.stderr)
    if long_effect:
        first = FLAVOR_Y_LONG
    else:
        first = FLAVOR_Y[0] if len(fl) > 1 else (FLAVOR_Y[0] + FLAVOR_Y[1]) // 2
    for k, ln in enumerate(fl[:2]):
        w = rich_width(ln)
        draw_rich(img, (CARD_W - w) // 2, first + 9 * k, ln, C('stone', 1))
    out = np.array(Image.fromarray(img, 'RGBA'))
    out[~mask, 3] = 0
    return Image.fromarray(out, 'RGBA')


def main():
    cards = {c['id']: c for c in json.load(open(os.path.join(ROOT, 'daten', 'cards.json'), encoding='utf-8'))}
    texts = json.load(open(os.path.join(ROOT, 'daten', 'card_text.json'), encoding='utf-8'))
    import cards_art
    import cardback
    import glob
    import importlib
    for f in sorted(glob.glob(os.path.join(HERE, 'pack_*.py'))):
        importlib.import_module(os.path.basename(f)[:-3])      # Packs registrieren ihre Kartenbilder in cards_art.ART
    outdir = os.path.join(OUT, 'cards')
    os.makedirs(outdir, exist_ok=True)
    rendered = []
    for cid in texts:
        card = cards[cid]
        art = cards_art.art_for(cid)
        im = render_card(card, texts[cid], art)
        bad = palette_violations(im)
        if bad:
            print(f'WARNUNG: {cid} nutzt {bad} Farben außerhalb der Master-Palette', file=sys.stderr)
        im.save(os.path.join(outdir, f'{cid}.png'))
        rendered.append((cid, im))
    with open(os.path.join(OUT, 'cards_hotspots.json'), 'w', encoding='utf-8') as fh:
        json.dump(HOTSPOTS, fh, ensure_ascii=False, separators=(',', ':'))
    back = cardback.render_back()
    if palette_violations(back):
        print('WARNUNG: Kartenrücken nutzt Farben außerhalb der Master-Palette', file=sys.stderr)
    back.save(os.path.join(OUT, 'card_back.png'))
    cols = 6
    rows = (len(rendered) + cols - 1) // cols
    sc, pad = 2, 12
    sheet_img = Image.new('RGBA', (cols * (CARD_W * sc + pad) + pad, rows * (CARD_H * sc + pad) + pad), hexrgb('#2b2540') + (255,))
    for k, (cid, im) in enumerate(rendered):
        sheet_img.alpha_composite(upscale(im, sc), (pad + (k % cols) * (CARD_W * sc + pad), pad + (k // cols) * (CARD_H * sc + pad)))
    sheet_img.save(os.path.join(OUT, 'cards_overview.png'))
    for cid in ('UA-01', 'US-06', 'BH-01', 'BS-02'):
        upscale(dict(rendered)[cid], 3).save(os.path.join(outdir, f'{cid}_x3.png'))
    upscale(back, 3).save(os.path.join(outdir, 'back_x3.png'))
    print(len(rendered), 'cards rendered')


if __name__ == '__main__':
    main()
