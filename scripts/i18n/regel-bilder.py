#!/usr/bin/env python3
"""Regelbilder neu beschriften (Quellen: scripts/i18n/rules-originals/*.png -> public/rules/<name>.png (EN) und public/rules/de/<name>.png (DE)).

Die Bilder bestehen aus einer eingebetteten Karte (750x1050, 1:1) vor einem unscharfen Pixel-Hintergrund und Beschriftungen mit
Hilfslinien. Fuer die deutsche Fassung:
  1. die englischen Beschriftungen entfernen (Text = reines Weiss/Schwarz; die Luecke wird zellenweise mit der Hintergrundfarbe gefuellt),
  2. die Karte durch ihre deutsche Darstellung ersetzen (Render aus dem Spiel: card-de-<Name>.png, siehe regel-bilder.js),
  3. deutsche Beschriftungen in der Kartenschrift (public/cardgen/glyphs.json) mit weisser Kontur zeichnen (schwarze Schrift, wie im Original).
Beide Sprachen nutzen dieselbe Schrift (Kartenschrift, schwarz mit weisser Kontur).
Aufruf: python3 scripts/i18n/regel-bilder.py <spell|ability|...|alle> <Ordner mit card-en-*.png und card-de-*.png> [Ausgabeordner]
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
        layer[edge] = (255, 255, 255, 255); layer[big] = (0, 0, 0, 255)   # wie im Original: schwarze Schrift mit weisser Kontur
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

def _kanten(sig, off, thr=10, luecke=3):
    pos = [i for i, v in enumerate(sig) if v > thr]
    out = []
    for i in pos:
        if out and i - out[-1][-1] <= luecke: out[-1].append(i)
        else: out.append([i])
    return [off + int(round(np.mean(g))) + 1 for g in out]     # Grenze liegt vor dem Pixel

def erase(img_rgb, box):
    """Reines Weiss/Schwarz (Beschriftung samt Kontur) in box entfernen, Verbindungslinien bleiben; die Luecke wird zellenweise mit der
    Hintergrundfarbe gefuellt (der Hintergrund ist ein vergroessertes Pixelbild: Zellgrenzen werden lokal aus den Streifen neben dem Feld bestimmt).
    Rueckgabe: Rahmen der entfernten Schrift (x0, y0, x1, y1) oder None."""
    import bisect
    H, W = img_rgb.shape[:2]
    x0, y0, x1, y1 = box
    sub = img_rgb[y0:y1, x0:x1]
    m = ((sub == 255).all(2)) | ((sub == 0).all(2))
    keep = np.zeros_like(m)
    for pts in components(m):
        ys = [p[0] for p in pts]; xs = [p[1] for p in pts]
        w, h = max(xs) - min(xs) + 1, max(ys) - min(ys) + 1
        beruehrt = min(ys) == 0 or max(ys) == m.shape[0] - 1 or min(xs) == 0 or max(xs) == m.shape[1] - 1
        schwarz = int((sub[tuple(zip(*pts))] == 0).all(1).sum())
        if schwarz < 10:                           # nur Weiss (ohne schwarze Buchstaben): Hintergrundzelle, keine Schrift
            m[tuple(zip(*pts))] = False; continue
        diagonal = max(w, h) > 55 and len(pts) < 0.25 * w * h      # schraege Verbindungslinie
        if (w > 60 and h < 14) or (h > 60 and w < 14) or (beruehrt and (w < 14 or h < 14)) or diagonal: keep[tuple(zip(*pts))] = True
    m &= ~keep
    ys_, xs_ = np.nonzero(m)
    if not len(ys_): return None
    bbox = (x0 + int(xs_.min()), y0 + int(ys_.min()), x0 + int(xs_.max()), y0 + int(ys_.max()))
    m = dilate(m, 1) & ~keep
    pure = ((img_rgb == 255).all(2)) | ((img_rgb == 0).all(2))
    def med(sig_rows): return np.median(np.array(sig_rows), axis=0)
    # x-Grenzen aus Streifen ueber/unter dem Feld (reine Hintergrundzeilen), y-Grenzen aus Streifen links/rechts
    rows = [r for r in list(range(max(0, y0 - 40), y0)) + list(range(y1, min(H, y1 + 40))) if not pure[r, x0:x1].any()]
    cols = [c for c in list(range(max(0, x0 - 40), x0)) + list(range(x1, min(W, x1 + 40))) if c < 484 and not pure[y0:y1, c].any()]
    xe = _kanten(med([np.abs(np.diff(img_rgb[r, x0 - 1:x1 + 1].astype(int), axis=0)).sum(1) for r in rows]), x0 - 1) if rows else []
    ye = _kanten(med([np.abs(np.diff(img_rgb[y0 - 1:y1 + 1, c].astype(int), axis=0)).sum(1) for c in cols]), y0 - 1) if cols else []
    xb = [-10**6] + xe + [10**6]; yb = [-10**6] + ye + [10**6]
    cell = lambda v, b: bisect.bisect_right(b, v) - 1
    cells = {}
    for y in range(m.shape[0]):
        for x in range(m.shape[1]):
            if m[y, x]: cells.setdefault((cell(x0 + x, xb), cell(y0 + y, yb)), []).append((y, x))
    for (cx, cy), pts in cells.items():
        xa, xe_ = max(xb[cx], 0), min(xb[cx + 1], W); ya, ye_ = max(yb[cy], 0), min(yb[cy + 1], H)
        # Zelle begrenzen (Fenster um das Feld), unmaskierte Hintergrundpixel sammeln
        xa, xe_ = max(xa, x0 - 60), min(xe_, x1 + 60); ya, ye_ = max(ya, y0 - 60), min(ye_, y1 + 60)
        blk = img_rgb[ya:ye_, xa:xe_]
        ok = ~pure[ya:ye_, xa:xe_]
        # Pixel, die selbst in der Maske liegen, ausschliessen
        mm = np.zeros((ye_ - ya, xe_ - xa), bool)
        for yy in range(max(ya, y0), min(ye_, y1)):
            for xx in range(max(xa, x0), min(xe_, x1)):
                if m[yy - y0, xx - x0]: mm[yy - ya, xx - xa] = True
        ok &= ~mm
        if ok.sum() >= 12: col = tuple(int(v) for v in np.median(blk[ok], axis=0))
        else:   # ganze Zelle verdeckt: naechste unverdeckte Zelle ueber/unter/links/rechts
            col = None
            for dx_, dy_ in ((0, -1), (0, 1), (-1, 0), (1, 0)):
                xx = int(np.clip((xa + xe_) // 2 + dx_ * (xe_ - xa), 0, W - 1)); yy = int(np.clip((ya + ye_) // 2 + dy_ * (ye_ - ya), 0, H - 1))
                if not pure[yy, xx] and not (x0 <= xx < x1 and y0 <= yy < y1): col = tuple(int(v) for v in img_rgb[yy, xx]); break
            if col is None: continue
        for y, x in pts:
            img_rgb[y0 + y, x0 + x] = col; m[y, x] = False
    # Rest: noch nicht gefuellte Pixel (ganze Zellen verdeckt, keine Nachbarzelle gefunden) -> naechstes unverdecktes Hintergrundpixel
    for y, x in zip(*np.nonzero(m)):
        for r in range(2, 120, 2):
            found = None
            for dy in range(-r, r + 1, 2):
                for dx in (-r, r) if abs(dy) != r else range(-r, r + 1, 2):
                    yy, xx = y0 + y + dy, x0 + x + dx
                    if 0 <= yy < H and 0 <= xx < W and not pure[yy, xx] and not (x0 <= xx < x1 and y0 <= yy < y1 and m[yy - y0, xx - x0]): found = img_rgb[yy, xx]; break
                if found is not None: break
            if found is not None: img_rgb[y0 + y, x0 + x] = found; break
    return bbox

CONFIG = {}
def cfg(name, card, labels): CONFIG[name] = {'card': card, 'labels': labels}
NAME = dict(box=(655, 10, 1115, 75), align='center', en=['Card Name'], de=['Kartenname'])
EFFECT = dict(box=(10, 835, 310, 900), align='left', en=['Effect'], de=['Effekt'])
SUB = dict(box=(5, 1035, 412, 1125), align='left', en=['Sub-Type'], de=['Untertyp'])
cfg('spell', 'Invisibility', [NAME, dict(box=(5, 630, 310, 750), align='left', en=['Spell', 'School'], de=['Zauber-', 'schule']), EFFECT, SUB,
    dict(box=(1005, 1138, 1258, 1215), align='right', en=['Level'], de=['Level'])])
cfg('ability', 'Magic_Arts', [NAME, dict(box=(10, 795, 415, 925), align='left', en=['Effects', 'by level'], de=['Level-', 'Effekte'])])
cfg('artifact', 'The_Sun_Sword', [NAME, EFFECT, SUB, dict(box=(700, 1138, 1010, 1240), align='center', en=['Cost'], de=['Kosten'])])
cfg('ascended', 'Monia_Bot_the_Foretold_Rescuer_of_Coolness', [NAME, dict(box=(10, 670, 458, 795), align='left', en=['Ascension', 'Bonus'], de=['Aufstiegs-', 'bonus'], c=6), EFFECT,
    dict(box=(600, 1138, 800, 1245), align='center', en=['HP'], de=['LP']), dict(box=(860, 1138, 1235, 1245), align='center', en=['Attack'], de=['Angriff'])])
cfg('creature', 'Doomed_Town_Guard', [NAME, dict(box=(5, 630, 310, 750), align='left', en=['Spell', 'School'], de=['Zauber-', 'schule']), EFFECT, SUB,
    dict(box=(660, 1138, 830, 1215), align='center', en=['HP'], de=['LP']), dict(box=(1005, 1138, 1258, 1215), align='right', en=['Level'], de=['Level'])])
cfg('hero', 'Treasure_Huntress_Semi', [NAME, dict(box=(10, 575, 455, 715), align='left', en=['Starting', 'Abilities'], de=['Start-', 'Fähigkeiten'], c=6, c_de=5),
    dict(box=(36, 915, 330, 990), align='left', en=['Effect'], de=['Effekt']), dict(box=(590, 1138, 760, 1235), align='center', en=['HP'], de=['LP']), dict(box=(850, 1138, 1200, 1240), align='center', en=['Attack'], de=['Angriff'])])
cfg('potion', 'Cloud_in_a_Bottle', [NAME, EFFECT, SUB])

SRC_DIR = os.path.join(ROOT, 'scripts/i18n/rules-originals')

def run(name, lang, folder, outdir):
    cf = CONFIG[name]
    src = Image.open(os.path.join(SRC_DIR, name + '.png')).convert('RGBA')
    rgb = np.array(src.convert('RGB'))
    # Hilfslinien (lang, duenn, reines Schwarz) merken: sie liegen teils ueber der Karte und muessen nach dem Einsetzen zurueck
    blk = (np.array(src.convert('RGB')) == 0).all(2)
    linien = np.zeros_like(blk)
    for pts in components(blk):
        ys = [p[0] for p in pts]; xs = [p[1] for p in pts]
        w, h = max(xs) - min(xs) + 1, max(ys) - min(ys) + 1
        if (w > 40 and h < 14) or (h > 40 and w < 14): linien[tuple(zip(*pts))] = True
    linien = dilate(linien, 1)
    boxes = [erase(rgb, lb['box']) for lb in cf['labels']]
    img = Image.fromarray(rgb).convert('RGBA')
    if True:    # in beiden Sprachen die aktuelle Kartendarstellung einsetzen (Render aus dem Spiel: card-<sprache>-<Karte>.png)
        img.alpha_composite(Image.open(os.path.join(folder, 'card-%s-%s.png' % (lang, cf['card']))).convert('RGBA'), (488, 85))
        res = np.array(img); res[linien] = np.array(src)[linien]; img = Image.fromarray(res, 'RGBA')
    for lb, bb in zip(cf['labels'], boxes):
        if bb is None: continue
        c = lb.get('c_' + lang, lb.get('c', 7)); outline = 3
        lines = lb[lang]
        top = bb[1] - 1                                   # Oberkante der alten Schrift (samt Konturrand)
        baseline = top + outline + 1 + 7 * c
        x = {'left': bb[0] + 1, 'right': bb[2], 'center': (bb[0] + bb[2]) // 2}[lb['align']]
        draw_label(img, lines, x, baseline, align=lb['align'], c=c, outline=outline)
    os.makedirs(outdir, exist_ok=True)
    out = os.path.join(outdir, name + '.png'); img.save(out); return out

if __name__ == '__main__':
    which = sys.argv[1]; folder = sys.argv[2]; outbase = sys.argv[3] if len(sys.argv) > 3 else os.path.join(ROOT, 'public/rules')
    for name in (list(CONFIG) if which == 'alle' else [which]):
        for lang in ('en', 'de'):
            print(run(name, lang, folder, outbase if lang == 'en' else os.path.join(outbase, 'de')))
