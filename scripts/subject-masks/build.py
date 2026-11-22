#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Motiv-Masken der Kartenkunst (Hauptmotiv vor dem Hintergrund) aus den freigestellten Ebenen in PixelPartiesSprites.

Wozu: Rarity-Effekte, die nur den Hintergrund des Bildes veraendern (Umbra Rare, Stained Rare), brauchen eine pixelgenaue Silhouette
des Motivs. Die Kartenkunst entsteht aus Ebenen der Motive-XCF-Dateien; die Ebenen liegen im Repo PixelPartiesSprites als PNG mit
hartem Alpha. Hier werden sie in der Kunst wiedergefunden (Position per Pixelvergleich) und ihr Alpha wird zur Maske.

Verfahren je Karte:
  1. Namens-Treffer: Sprites, deren Dateiname (oder Heldenordner) ein Wort des Kartennamens enthaelt (Woerter ab 4 Buchstaben),
     werden in der Kunst gesucht (Massstab 1 und 2; Trefferquote = Anteil der deckenden Sprite-Pixel, deren Farbe in der Kunst
     innerhalb von 14 Summenstufen liegt; ab 0,70 gilt ein Treffer).
  2. Globale Suche: ALLE Sprites werden per Farbsignatur (Farben auf 4 Bit gerundet) vorgefiltert und ueber Ankerpixel der seltensten
     Farben in der Kunst gesucht (ab 0,80, kleine Sprites strenger, mehrere Kopien desselben Sprites werden gefunden). So kommen auch
     Ebenen mit anderem Namen dazu (Karten in der Hand, Preisschilder, Muenzen).
  3. Sprites, die ueber alle Karten hinweg auf 6 oder mehr Karten treffen (meist namenlose Kleinteile wie Lava-, Boden- und Wandstuecke),
     gelten als Hintergrund und zaehlen nur, wenn sie ausserdem ein Namens-Treffer sind.
  4. Maske = Vereinigung aller uebrigen Treffer-Ebenen. Dann Bereinigung: Randpixel in Farben, die nur im Hintergrund direkt ausserhalb der
     Silhouette vorkommen (nicht im Motiv daneben), werden entfernt; winzige Splitter fliegen raus, kleine Luecken werden gefuellt.
  5. Guete: "hoch" (alle Ebenen >= 0,90), "mittel" (>= 0,80), "knapp" (>= 0,70). Karten ohne jeden Sprite-Treffer bekommen, wenn opencv
     installiert ist, eine grobe GrabCut-Maske ("grabcut"); sonst keine.

WICHTIG: Automatische Masken sind nur Vorschlaege ("checked": false). Sie enthalten nur die Ebenen, deren Dateiname zum Kartennamen
passt. Viele Kartenbilder sind aber ganze Szenen (Zimmer, Marktstand, Palast) mit mehreren Figuren und Requisiten auf eigenen Ebenen
(Karten in der Hand, Preisschilder, Haarflammen, Muenzen), und was "Motiv" ist, ist eine kuenstlerische Entscheidung je Karte. Eine Karte
darf erst mit Umbra/Stained gedruckt werden, wenn ihre Maske von Hand geprueft ist ("manual": true, "checked": true).

Von Hand korrigierte oder gepruefte Masken ("manual": true bzw. "checked": true) werden nie ueberschrieben.

Aufruf (aus dem Wurzelverzeichnis des Spiels):
  python3 scripts/subject-masks/build.py [--sprites ../pixelpartiessprites] [--jobs 4] [--only "Pyraga" "Fireball"] [--resume] [--cache zwischenstand.json]

Ausgabe: data/subject-masks.json
  { "version": 1, "cards": { "<Kartenname>": { "w": 152, "h": 102, "rle": [...], "q": "hoch", "score": 0.83, "src": ["<Sprite>", ...], "checked": false } } }
  w/h = Rastergroesse der Kunst im Atlas (public/cardgen/art.json, Schluessel "a"). rle = Lauflaengen abwechselnd Hintergrund /
  Motiv, zeilenweise, mit Hintergrund beginnend (ein Motiv in der ersten Zelle beginnt also mit 0).
Abhaengigkeiten: numpy, Pillow; optional opencv-python-headless (GrabCut-Rueckfall fuer Kunst ohne Sprite-Treffer).
"""
import argparse
import json
import os
import re
import sys
import time
from multiprocessing import Pool

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'data', 'subject-masks.json')
THRESHOLD = 0.70          # Mindest-Trefferquote einer Ebene
TOLERANCE = 14            # Farbabstand (Summe der Kanaele) fuer einen Pixeltreffer
HOLE_FRACTION = 0.02      # geschlossene Luecken bis zu diesem Anteil der Kunstflaeche werden gefuellt
STOP = {'the', 'of', 'and', 'a', 'an', 'to', 'in', 'on', 'for', 'with', 'from', 'by', 'lv', 'level'}

_atlas = None
_art_index = None
_sprites = None
_by_token = None
_sprite_dir = None
_cache = {}


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def tokens(s):
    return {t for t in slug(s).split('-') if len(t) >= 3 and t not in STOP}


def init(sprite_dir):
    """Atlas und Sprite-Index laden (je Prozess einmal)."""
    global _atlas, _art_index, _sprites, _by_token, _sprite_dir
    _sprite_dir = sprite_dir
    _atlas = Image.open(os.path.join(ROOT, 'public', 'cardgen', 'art.png')).convert('RGBA')
    with open(os.path.join(ROOT, 'public', 'cardgen', 'art.json'), encoding='utf-8') as f:
        _art_index = json.load(f)
    _sprites = []
    for root, dirs, files in os.walk(sprite_dir):
        rel_root = os.path.relpath(root, sprite_dir)
        if rel_root.startswith('.git') or any(p in rel_root.split(os.sep) for p in ('idle_frames', 'views', 'rigs', 'animations', '_overview', 'death-animations', 'revive-animations', 'tools')):
            continue
        for fn in files:
            if not fn.endswith('.png'):
                continue
            stem = re.sub(r'^Motive[A-Za-z]*_L\d+_', '', fn[:-4])
            stem = re.sub(r'_\d+x\d+(_[0-9a-f]{6})?$', '', stem)
            rel = os.path.relpath(os.path.join(root, fn), sprite_dir).replace(os.sep, '/')
            parts = rel.split('/')
            tk = tokens(stem)
            if parts[0] in ('heroes', '_effects') and len(parts) > 2:
                tk |= tokens(parts[1])
            _sprites.append((rel, tk))
    _by_token = {}
    for i, (rel, tk) in enumerate(_sprites):
        for t in tk:
            _by_token.setdefault(t, []).append(i)
    load_global()


def load_sprite(rel):
    if rel not in _cache:
        _cache[rel] = np.array(Image.open(os.path.join(_sprite_dir, rel)).convert('RGBA'))
    return _cache[rel]


def art_of(name):
    x, y, w, h = _art_index['a'][name]
    return np.array(_atlas.crop((x, y, x + w, y + h)).convert('RGB'))


def best_match(art, spr):
    """Beste Lage (dx, dy) und Trefferquote eines Sprites in der Kunst."""
    opaque = spr[..., 3] > 128
    ys, xs = np.nonzero(opaque)
    if len(ys) < 25:
        return None
    h, w = opaque.shape
    H, W, _ = art.shape
    if h > H or w > W:
        return None
    col = spr[ys, xs, :3].astype(np.int16)
    best = (0.0, 0, 0)
    for dy in range(H - h + 1):
        for dx in range(W - w + 1):
            d = np.abs(art[ys + dy, xs + dx].astype(np.int16) - col).sum(1)
            f = float((d <= TOLERANCE).mean())
            if f > best[0]:
                best = (f, dx, dy)
    return best if best[0] > 0 else None


def fill_holes(mask, max_area):
    """Geschlossene Hintergrund-Luecken bis max_area Pixel fuellen (4er-Nachbarschaft, nicht am Rand)."""
    H, W = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    out = mask.copy()
    for y0 in range(H):
        for x0 in range(W):
            if mask[y0, x0] or seen[y0, x0]:
                continue
            stack = [(y0, x0)]
            seen[y0, x0] = True
            comp = []
            border = False
            while stack:
                y, x = stack.pop()
                comp.append((y, x))
                if y in (0, H - 1) or x in (0, W - 1):
                    border = True
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < H and 0 <= nx < W and not mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
            if not border and len(comp) <= max_area:
                for y, x in comp:
                    out[y, x] = True
    return out


_global = None


def _qkey(rgb):
    rgb = rgb.astype(np.int32)
    return ((rgb[..., 0] >> 4) << 8) | ((rgb[..., 1] >> 4) << 4) | (rgb[..., 2] >> 4)


def load_global():
    """Alle Sprites mit Pixellisten und Farbsignatur (fuer die globale Suche)."""
    global _global
    out = []
    for rel, _ in _sprites:
        a = load_sprite(rel)
        ys, xs = np.nonzero(a[..., 3] > 128)
        if len(ys) < 40:
            continue
        rgb = a[ys, xs, :3].astype(np.int16)
        key = _qkey(rgb)
        uk, ui, uc = np.unique(key, return_index=True, return_counts=True)
        if len(uk) < 3:
            continue
        out.append({'rel': rel, 'ys': ys.astype(np.int32), 'xs': xs.astype(np.int32), 'rgb': rgb, 'uk': uk, 'ui': ui, 'uc': uc, 'n': len(ys)})
    _global = out


def _art_info(art):
    H, W, _ = art.shape
    key = _qkey(art).ravel()
    order = np.argsort(key, kind='stable')
    uk, start, cnt = np.unique(key[order], return_index=True, return_counts=True)
    return {'H': H, 'W': W, 'art': art.astype(np.int16), 'order': order, 'uk': uk, 'start': start, 'cnt': cnt}


def _needed_fraction(area):
    return 0.80 if area >= 150 else 0.90 if area >= 60 else 0.95


def _scaled(sp, scale):
    ys, xs, rgb = sp['ys'], sp['xs'], sp['rgb']
    if scale == 1:
        return ys, xs, rgb
    dy = np.array([0, 0, 1, 1])
    dx = np.array([0, 1, 0, 1])
    return (ys[:, None] * 2 + dy[None, :]).ravel(), (xs[:, None] * 2 + dx[None, :]).ravel(), np.repeat(rgb, 4, axis=0)


def global_layers(art, scales=(1,), maxarea=0.40):
    """Alle Sprites, die in der Kunst sichtbar sind -> [(quote, rel, dx, dy, scale)]."""
    ai = _art_info(art)
    H, W = ai['H'], ai['W']
    found = []
    for sp in _global:
        for scale in scales:
            area = sp['n'] * scale * scale
            if area > maxarea * H * W or area < 40:
                continue
            inart = np.isin(sp['uk'], ai['uk'], assume_unique=True)
            if sp['uc'][inart].sum() / sp['n'] < 0.85:
                break
            idx = np.searchsorted(ai['uk'], sp['uk'][inart])
            sel = np.argsort(ai['cnt'][idx])[:3]
            ys, xs, rgb = _scaled(sp, scale)
            cands = set()
            for k, ui in zip(sp['uk'][inart][sel], sp['ui'][inart][sel]):
                j = np.searchsorted(ai['uk'], k)
                pos = ai['order'][ai['start'][j]:ai['start'][j] + min(int(ai['cnt'][j]), 120)]
                ay, ax = pos // W, pos % W
                if scale == 1:
                    offs = [(int(ys_i), int(xs_i)) for ys_i, xs_i in [(sp['ys'][ui], sp['xs'][ui])]]
                else:
                    offs = [(int(sp['ys'][ui]) * 2 + a, int(sp['xs'][ui]) * 2 + b) for a in (0, 1) for b in (0, 1)]
                for sy, sx in offs:
                    for y, x in zip(ay, ax):
                        cands.add((int(x - sx), int(y - sy)))
            need = _needed_fraction(area)
            res = []
            for dx, dy in list(cands)[:400]:
                yy, xx = ys + dy, xs + dx
                inb = (yy >= 0) & (yy < H) & (xx >= 0) & (xx < W)
                if inb.sum() < 25 or inb.sum() < 0.5 * len(yy):
                    continue
                d = np.abs(ai['art'][yy[inb], xx[inb]] - rgb[inb]).sum(1)
                frac = float((d <= TOLERANCE).mean())
                if frac >= need:
                    res.append((frac, dx, dy, scale))
            res.sort(reverse=True)
            kept = []
            for f, dx, dy, sc in res:
                if (f >= 0.9 or not kept) and all(abs(dx - k[1]) + abs(dy - k[2]) > 2 for k in kept):
                    kept.append((f, dx, dy, sc))
            for f, dx, dy, sc in kept[:12]:
                found.append((f, sp['rel'], dx, dy, sc))
    return found


def clean_mask(art, mask):
    """Randfransen aus Hintergrundfarbe entfernen, Splitter entfernen, kleine Luecken fuellen."""
    H, W = mask.shape
    m = mask.copy()
    key = _qkey(art)

    def dilate(a, n):
        o = a.copy()
        for _ in range(n):
            p = np.pad(o, 1)
            o = o | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
        return o

    def erode(a, n):
        return ~dilate(~a, n)
    for _ in range(2):                                   # zwei Durchgaenge: Fransen koennen zwei Pixel breit sein
        outside = dilate(m, 3) & ~m                      # Hintergrund direkt ausserhalb
        inside = erode(m, 2) if m.sum() > 50 else m      # Motiv ohne Randband
        band = m & ~inside
        if not band.any() or not outside.any() or not inside.any():
            break
        bg_keys = set(np.unique(key[outside]).tolist())
        ys, xs = np.nonzero(band)
        for y, x in zip(ys, xs):
            k = int(key[y, x])
            if k not in bg_keys:
                continue
            y0, y1, x0, x1 = max(0, y - 6), min(H, y + 7), max(0, x - 6), min(W, x + 7)
            loc_in = inside[y0:y1, x0:x1]
            if loc_in.any() and k in set(np.unique(key[y0:y1, x0:x1][loc_in]).tolist()):
                continue                                 # die Farbe kommt auch im Motiv daneben vor (z. B. Flammen)
            m[y, x] = False
    # Splitter: Komponenten unter 6 Pixeln entfernen (8er-Nachbarschaft), Luecken bis 3 Pixel fuellen
    for target, limit, to in ((True, 5, False), (False, 3, True)):
        seen = np.zeros_like(m, dtype=bool)
        for y0 in range(H):
            for x0 in range(W):
                if m[y0, x0] != target or seen[y0, x0]:
                    continue
                stack = [(y0, x0)]
                seen[y0, x0] = True
                comp = []
                border = False
                while stack:
                    y, x = stack.pop()
                    comp.append((y, x))
                    if y in (0, H - 1) or x in (0, W - 1):
                        border = True
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            ny, nx = y + dy, x + dx
                            if (dy or dx) and (target or (dy == 0 or dx == 0)) and 0 <= ny < H and 0 <= nx < W and m[ny, nx] == target and not seen[ny, nx]:
                                seen[ny, nx] = True
                                stack.append((ny, nx))
                if len(comp) <= limit and (target or not border):
                    for y, x in comp:
                        m[y, x] = to
    return m


def grabcut_mask(art):
    """Rueckfall fuer Kunst ohne passende Sprite-Ebene: grobe Freistellung per GrabCut (optional, braucht opencv-python-headless)."""
    try:
        import cv2
    except ImportError:
        return None
    H, W, _ = art.shape
    sc = 4 if W <= 100 else 2
    big = cv2.resize(art, (W * sc, H * sc), interpolation=cv2.INTER_NEAREST)
    h, w = big.shape[:2]
    gc = np.full((h, w), cv2.GC_PR_BGD, np.uint8)
    m = int(min(h, w) * 0.06)
    gc[:m, :] = gc[-m:, :] = gc[:, :m] = gc[:, -m:] = cv2.GC_BGD
    el = np.zeros((h, w), np.uint8)
    cv2.ellipse(el, (w // 2, h // 2), (int(w * 0.32), int(h * 0.38)), 0, 0, 360, 1, -1)
    gc[el == 1] = cv2.GC_PR_FGD
    core = np.zeros((h, w), np.uint8)
    cv2.ellipse(core, (w // 2, h // 2), (int(w * 0.16), int(h * 0.2)), 0, 0, 360, 1, -1)
    gc[core == 1] = cv2.GC_FGD
    try:
        cv2.grabCut(big, gc, None, np.zeros((1, 65)), np.zeros((1, 65)), 6, cv2.GC_INIT_WITH_MASK)
    except cv2.error:
        return None
    fg = ((gc == cv2.GC_FGD) | (gc == cv2.GC_PR_FGD)).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(fg)
    if n < 2:
        return None
    fg = (lab == 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))).astype(np.uint8)
    small = cv2.resize(fg, (W, H), interpolation=cv2.INTER_AREA) > 0.5
    return small


GENERIC_MIN = 6           # Sprites, die in so vielen Karten auftauchen, gelten als Hintergrund/Textur und werden nur bei Namens-Treffer genutzt
_pix = {}


def sprite_pixels(rel):
    """(ys, xs, rgb) eines Sprites (aus dem globalen Satz oder frisch geladen)."""
    if rel not in _pix:
        a = load_sprite(rel)
        ys, xs = np.nonzero(a[..., 3] > 128)
        _pix[rel] = (ys.astype(np.int32), xs.astype(np.int32), a[ys, xs, :3].astype(np.int16))
    return _pix[rel]


def name_layers(art, name):
    """Namens-Treffer: [(quote, rel, dx, dy, scale, 'name')]"""
    H, W, _ = art.shape
    name_tokens = tokens(name)
    cand = set()
    for t in name_tokens:
        if len(t) >= 4 or len(name_tokens) == 1:
            cand.update(_by_token.get(t, []))
    out = []
    for ci in sorted(cand):
        rel = _sprites[ci][0]
        spr = load_sprite(rel)
        best = None
        for scale in (1, 2):
            s = spr if scale == 1 else np.array(Image.fromarray(spr).resize((spr.shape[1] * 2, spr.shape[0] * 2), Image.NEAREST))
            r = best_match(art, s)
            if r and (best is None or r[0] > best[0]):
                best = (r[0], r[1], r[2], scale, int((s[..., 3] > 128).sum()))
        if best and best[0] >= THRESHOLD and 0.02 * H * W <= best[4] <= 0.75 * H * W:
            out.append((best[0], rel, best[1], best[2], best[3], 'name'))
    return out


def find_layers(name):
    """Alle Treffer-Ebenen einer Karte (Namens- und globale Suche); Rueckgabe fuer den zweiten Durchgang."""
    art = art_of(name)
    H, W, _ = art.shape
    layers = name_layers(art, name)
    for f, rel, dx, dy, scale in global_layers(art, (1, 2) if W >= 140 else (1,)):
        layers.append((f, rel, dx, dy, scale, 'global'))
    return name, [(round(float(f), 3), rel, int(dx), int(dy), int(sc), tier) for f, rel, dx, dy, sc, tier in layers]


def compose(name, layers, generic):
    """Maske aus den Treffer-Ebenen (ohne Hintergrund-Sprites) -> (maske | None, [(quote, ebene), ...])"""
    art = art_of(name)
    H, W, _ = art.shape
    use = [l for l in layers if not (l[5] == 'global' and l[1] in generic)]
    mask = np.zeros((H, W), bool)
    info = []
    seen = set()
    for f, rel, dx, dy, scale, tier in use:
        if (rel, dx, dy) in seen:
            continue
        seen.add((rel, dx, dy))
        ys, xs, _rgb = sprite_pixels(rel)
        if scale == 2:
            ys = (ys[:, None] * 2 + np.array([0, 0, 1, 1])[None, :]).ravel()
            xs = (xs[:, None] * 2 + np.array([0, 1, 0, 1])[None, :]).ravel()
        yy, xx = ys + dy, xs + dx
        inb = (yy >= 0) & (yy < H) & (xx >= 0) & (xx < W)
        mask[yy[inb], xx[inb]] = True
        info.append((f, '%s@%d,%d' % (rel, dx, dy)))
    if not info:
        gcm = grabcut_mask(art)
        if gcm is None or not (0.05 * H * W <= gcm.sum() <= 0.60 * H * W):
            return None, []
        return fill_holes(gcm, max(4, int(HOLE_FRACTION * H * W))), [(0.0, 'GrabCut (Rueckfall, ungenau)')]
    mask = clean_mask(art, mask)
    mask = fill_holes(mask, max(4, int(HOLE_FRACTION * H * W)))
    if not (0.02 * H * W <= mask.sum() <= 0.70 * H * W):
        return None, []
    return mask, sorted(info, reverse=True)


def mask_for(name, generic=None):
    """Einzelne Karte (fuer Tests und --only): -> (maske | None, [(quote, ebene), ...])"""
    _, layers = find_layers(name)
    return compose(name, layers, generic or set())


def rle_encode(mask):
    flat = mask.reshape(-1).astype(np.uint8)
    runs = []
    cur = 0
    n = 0
    for v in flat:
        if v == cur:
            n += 1
        else:
            runs.append(n)
            cur = int(v)
            n = 1
    runs.append(n)
    return runs


def quality(matches):
    if matches and matches[0][1].startswith('GrabCut'):
        return 'grabcut'
    m = min(f for f, _ in matches)
    return 'hoch' if m >= 0.90 else 'mittel' if m >= 0.80 else 'knapp'


def write(cards):
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write('{"version":1,"cards":{\n')
        names = sorted(cards)
        for i, n in enumerate(names):
            f.write(json.dumps(n, ensure_ascii=False) + ':' + json.dumps(cards[n], ensure_ascii=False, separators=(',', ':')) + (',\n' if i < len(names) - 1 else '\n'))
        f.write('}}\n')


def entry_of(mask, matches):
    return {'w': int(mask.shape[1]), 'h': int(mask.shape[0]), 'rle': rle_encode(mask), 'q': quality(matches),
            'score': min(f for f, _ in matches), 'src': [rel for _, rel in matches], 'checked': False}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--sprites', default=os.environ.get('PP_SPRITES', os.path.join(ROOT, '..', 'pixelpartiessprites')))
    ap.add_argument('--jobs', type=int, default=os.cpu_count() or 2)
    ap.add_argument('--only', nargs='*', help='nur diese Karten')
    ap.add_argument('--resume', action='store_true', help='schon vorhandene Karten ueberspringen')
    ap.add_argument('--cache', help='Zwischenergebnis des ersten Durchgangs (JSON) lesen/schreiben')
    args = ap.parse_args()
    sprite_dir = os.path.abspath(args.sprites)
    if not os.path.isdir(sprite_dir):
        sys.exit('Sprite-Ordner nicht gefunden: %s (--sprites oder PP_SPRITES setzen)' % sprite_dir)
    with open(os.path.join(ROOT, 'data', 'cards.json'), encoding='utf-8') as f:
        card_names = [c['name'] for c in json.load(f)]
    with open(os.path.join(ROOT, 'public', 'cardgen', 'art.json'), encoding='utf-8') as f:
        have_art = set(json.load(f)['a'])
    names = [n for n in dict.fromkeys(card_names) if n in have_art]
    if args.only:
        names = [n for n in names if n in set(args.only)]
    cards = {}
    if os.path.exists(OUT):
        with open(OUT, encoding='utf-8') as f:
            cards = json.load(f)['cards']
    keep = {n for n, e in cards.items() if e.get('manual') or e.get('checked')}
    todo = [n for n in names if n not in keep and not (args.resume and n in cards)]
    print('%d Karten, davon %d geprueft (bleiben), %d zu berechnen, %d Prozesse' % (len(names), len(keep & set(names)), len(todo), args.jobs), flush=True)
    t0 = time.time()
    layers = {}
    if args.cache and os.path.exists(args.cache):
        with open(args.cache, encoding='utf-8') as f:
            layers = json.load(f)
    todo1 = [n for n in todo if n not in layers]
    with Pool(args.jobs, initializer=init, initargs=(sprite_dir,)) as pool:
        for i, (name, lay) in enumerate(pool.imap_unordered(find_layers, todo1, chunksize=4), 1):
            layers[name] = lay
            if i % 100 == 0 or i == len(todo1):
                print('Durchgang 1: %d/%d  %.0f s' % (i, len(todo1), time.time() - t0), flush=True)
    if args.cache:
        with open(args.cache, 'w', encoding='utf-8') as f:
            json.dump(layers, f)
    # Haeufigkeit je Sprite ueber ALLE Karten: Hintergrund-Texturen kommen auf vielen Karten vor
    freq = {}
    for lay in layers.values():
        for rel in {l[1] for l in lay if l[5] == 'global'}:
            freq[rel] = freq.get(rel, 0) + 1
    generic = {rel for rel, c in freq.items() if c >= GENERIC_MIN}
    print('%d Sprites kommen auf >= %d Karten vor und werden nur bei Namens-Treffer genutzt' % (len(generic), GENERIC_MIN), flush=True)
    init(sprite_dir)
    done = 0
    for name in todo:
        mask, matches = compose(name, layers.get(name, []), generic)
        done += 1
        if mask is not None:
            cards[name] = entry_of(mask, matches)
        elif name in cards and name not in keep:
            del cards[name]
        if done % 100 == 0:
            write(cards)
            print('Durchgang 2: %d/%d  %d Masken  %.0f s' % (done, len(todo), len(cards), time.time() - t0), flush=True)
    write(cards)
    q = {}
    for e in cards.values():
        q[e.get('q', 'manuell')] = q.get(e.get('q', 'manuell'), 0) + 1
    print('fertig: %d Masken (%s) von %d Karten' % (len(cards), ', '.join('%s %d' % kv for kv in sorted(q.items())), len(names)))


if __name__ == '__main__':
    main()
