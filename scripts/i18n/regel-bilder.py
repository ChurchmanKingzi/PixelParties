#!/usr/bin/env python3
"""Deutsche Fassungen der Regelbilder (public/rules/*.png -> public/rules/de/*.png).

Die Bilder bestehen aus einer eingebetteten Karte (750x1050, 1:1) vor einem unscharfen Pixel-Hintergrund und Beschriftungen mit
Hilfslinien. Fuer die deutsche Fassung:
  1. die englischen Beschriftungen entfernen (Text = reines Weiss/Schwarz; die Luecke wird zellenweise mit der Hintergrundfarbe gefuellt),
  2. die Karte durch ihre deutsche Darstellung ersetzen (Render aus dem Spiel: card-de-<Name>.png, siehe regel-bilder.js),
  3. deutsche Beschriftungen in der Kartenschrift (public/cardgen/glyphs.json) mit schwarzer Kontur zeichnen.
Aufruf: python3 scripts/i18n/regel-bilder.py <spell|ability|...> <Ordner mit card-de-*.png/card-en-*.png> [Ausgabeordner]
"""
import json, sys, os
import numpy as np
from PIL import Image, ImageDraw
from collections import deque

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
GL = json.load(open(os.path.join(ROOT, 'public/cardgen/glyphs.json'), encoding='utf-8'))['glyphs']

def subpaths(d):
    out, cur = [], []
    import re
    for cmd, x, y in re.findall(r'([MLZ])\s*(-?\d+)?\s*(-?\d+)?', d):
        if cmd == 'Z':
            if cur: out.append(cur); cur = []
        elif cmd == 'M':
            if cur: out.append(cur)
            cur = [(int(x), int(y))]
        elif cmd == 'L': cur.append((int(x), int(y)))
    if cur: out.append(cur)
    return out

def text_mask(text, c):
    """Maske des Textes in Pixeln: 1 Schriftpixel (200 Einheiten) = c Pixel. Rueckgabe: (Maske, Basislinie-y-in-Maske, Breite)."""
    adv = [GL[ch]['a'] if ch in GL else 1400 for ch in text]
    W = int(sum(adv) / 200 * c) + 2
    top, bot = 7, 3            # Zeilen ueber / unter der Basislinie (Grossbuchstaben 7, Unterlaengen bis ~2)
    H = (top + bot) * c
    base = top * c
    mask = np.zeros((H, W), bool); cx = 0.0
    for ch, a in zip(text, adv):
        g = GL.get(ch)
        if g and g['d']:
            acc = np.zeros((H, W), bool)
            for poly in subpaths(g['d']):
                im = Image.new('1', (W, H), 0)
                ImageDraw.Draw(im).polygon([(round(cx + x / 200 * c), round(base - y / 200 * c)) for x, y in poly], fill=1)
                acc ^= np.array(im, bool)
            mask |= acc
        cx += a / 200 * c
    return mask, base, W

def dilate(m, r):
    out = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy <= r * r + 1: out |= np.roll(np.roll(m, dy, 0), dx, 1)
    return out

def draw_label(img, lines, x, baseline, align='left', c=7, outline=3, line_h=None):
    """lines: Liste von Zeilen; x: linke/rechte/mittlere Kante je nach align; baseline: y der Grundlinie der ERSTEN Zeile."""
    line_h = line_h or int(10 * c * 0.82)
    for i, t in enumerate(lines):
        m, base, W = text_mask(t, c)
        pad = outline + 1
        big = np.pad(m, pad)
        edge = dilate(big, outline) & ~big
        px = x if align == 'left' else (x - W if align == 'right' else x - W // 2)
        py = baseline + i * line_h - base
        layer = np.zeros(big.shape + (4,), np.uint8)
        layer[edge] = (0, 0, 0, 255); layer[big] = (255, 255, 255, 255)
        img.alpha_composite(Image.fromarray(layer, 'RGBA'), (px - pad, py - pad))

def components(mask):
    H, W = mask.shape; seen = np.zeros_like(mask); out = []
    for y in range(H):
        for x in range(W):
            if mask[y, x] and not seen[y, x]:
                q = deque([(y, x)]); seen[y, x] = 1; pts = []
                while q:
                    a, b = q.popleft(); pts.append((a, b))
                    for da, db in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        cc, dd = a + da, b + db
                        if 0 <= cc < H and 0 <= dd < W and mask[cc, dd] and not seen[cc, dd]: seen[cc, dd] = 1; q.append((cc, dd))
                out.append(pts)
    return out

def erase(img_rgb, box, gx, gy):
    """Reines Weiss/Schwarz in box entfernen (ausser langen, duennen Linien) und mit der Zellenfarbe des Hintergrunds fuellen.
    gx(k)/gy(k): Zellgrenzen des Hintergrundrasters (Spalten/Zeilen)."""
    x0, y0, x1, y1 = box
    sub = img_rgb[y0:y1, x0:x1]
    m = ((sub == 255).all(2)) | ((sub == 0).all(2))
    keep = np.zeros_like(m)
    for pts in components(m):
        ys = [p[0] for p in pts]; xs = [p[1] for p in pts]
        w, h = max(xs) - min(xs) + 1, max(ys) - min(ys) + 1
        if (w > 60 and h < 14) or (h > 60 and w < 14): keep[tuple(zip(*pts))] = True   # Verbindungslinien bleiben
    m &= ~keep
    m = dilate(m, 1) & ~keep
    # Zellgrenzen
    import bisect
    xs_b = [gx(k) for k in range(-1, 100)]; ys_b = [gy(k) for k in range(-1, 100)]
    def cell(v, b): return bisect.bisect_right(b, v) - 1
    cells = {}
    H, W = m.shape
    for y in range(H):
        for x in range(W):
            if m[y, x]: cells.setdefault((cell(x0 + x, xs_b), cell(y0 + y, ys_b)), []).append((y, x))
    for (cx, cy), pts in cells.items():
        xa, xb = xs_b[cx], xs_b[cx + 1]; ya, yb = ys_b[cy], ys_b[cy + 1]
        vals = []
        for yy in range(max(ya, y0 - 0), min(yb, y1)):
            for xx in range(max(xa, x0), min(xb, x1)):
                if not m[yy - y0, xx - x0] and not keep[yy - y0, xx - x0]: vals.append(tuple(img_rgb[yy, xx]))
        if not vals:    # ganze Zelle verdeckt: Nachbarzelle links/rechts/oben/unten ausserhalb der Maske
            for ddx, ddy in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, 1)):
                xa2, xb2 = xs_b[cx + ddx], xs_b[cx + ddx + 1]; ya2, yb2 = ys_b[cy + ddy], ys_b[cy + ddy + 1]
                vv = [tuple(img_rgb[yy, xx]) for yy in range(ya2, yb2) for xx in range(xa2, xb2)
                      if not (x0 <= xx < x1 and y0 <= yy < y1 and (m[yy - y0, xx - x0]))]
                vv = [v for v in vv if v not in ((0, 0, 0), (255, 255, 255))]
                if vv: vals = vv; break
        if not vals: continue
        col = max(set(vals), key=vals.count)
        for y, x in pts: img_rgb[y0 + y, x0 + x] = col

def run(name, folder, outdir):
    cfg = CONFIG[name]
    src = Image.open(os.path.join(ROOT, 'public/rules', name + '.png')).convert('RGBA')
    rgb = np.array(src.convert('RGB'))
    for box in cfg['erase']: erase(rgb, box, lambda k: int(round(24.8 * k)), lambda k: int(round(364.5 + 24.25 * (k - 15))))
    # Hilfslinien (lang, duenn, reines Schwarz) aus dem Original merken: sie liegen teils ueber der Karte und muessen nach dem Einsetzen zurueck
    blk = (np.array(src.convert('RGB')) == 0).all(2)
    linien = np.zeros_like(blk)
    for pts in components(blk):
        ys = [p[0] for p in pts]; xs = [p[1] for p in pts]
        w, h = max(xs) - min(xs) + 1, max(ys) - min(ys) + 1
        if (w > 40 and h < 14) or (h > 40 and w < 14): linien[tuple(zip(*pts))] = True
    linien = dilate(linien, 1)
    img = Image.fromarray(rgb).convert('RGBA')
    card = Image.open(os.path.join(folder, 'card-de-%s.png' % cfg['card'])).convert('RGBA')
    img.alpha_composite(card, cfg['card_pos'])
    orig = np.array(src); res = np.array(img); res[linien] = orig[linien]; img = Image.fromarray(res, 'RGBA')
    for lb in cfg['labels']: draw_label(img, **lb)
    os.makedirs(outdir, exist_ok=True)
    img.save(os.path.join(outdir, name + '.png'))
    return os.path.join(outdir, name + '.png')

CONFIG = {
  'spell': {
    'card': 'Invisibility', 'card_pos': (488, 85),
    'erase': [(655, 10, 1115, 75), (5, 630, 310, 750), (10, 835, 310, 900), (5, 1035, 412, 1105), (1005, 1140, 1258, 1215)],
    'labels': [
      dict(lines=['Kartenname'], x=883, baseline=67, align='center'),
      dict(lines=['Zauber-', 'schule'], x=10, baseline=690, align='left'),
      dict(lines=['Effekt'], x=15, baseline=894, align='left'),
      dict(lines=['Untertyp'], x=10, baseline=1098, align='left'),
      dict(lines=['Stufe'], x=1250, baseline=1198, align='right'),
    ],
  },
}

if __name__ == '__main__':
    name, folder = sys.argv[1], sys.argv[2]
    out = sys.argv[3] if len(sys.argv) > 3 else os.path.join(ROOT, 'public/rules/de')
    print(run(name, folder, out))
