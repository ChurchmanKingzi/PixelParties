# -*- coding: utf-8 -*-
"""Zugriff auf die Sprite-Ebenen aus dem Repo PixelPartiesSprites (xcf).

Die xcf-Ebenen werden einmalig mit ../../../../../sprites_export/export.py (bzw. export_xcf.py hier)
als PNG exportiert. Jede Ebene liegt in voller Leinwandgröße im Koordinatensystem ihrer Datei, daher
gehören Ebenen, die sich räumlich überdecken, meist zu derselben Figur.

`sprite(key, datei, [ebenen])` setzt die Ebenen in GIMP-Stapelreihenfolge (Index 0 = oben)
zusammen, schneidet zu und legt das Ergebnis unter sprites2/<key>.png ab. Ist der Export nicht
vorhanden, wird die abgelegte Datei verwendet – die Skripte laufen also auch ohne die xcf-Dateien.
"""
import os, json, functools
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
EXP = os.environ.get('SPRITES_EXPORT', '/home/user/sprites_export')
CACHE = os.path.join(HERE, 'sprites2')
os.makedirs(CACHE, exist_ok=True)


@functools.lru_cache(None)
def meta(base):
    return json.load(open(os.path.join(EXP, base, 'layers.json'), encoding='utf-8'))


def layer_info(base, i):
    return meta(base)['layers'][i]


@functools.lru_cache(None)
def layer(base, i):
    """Ebene i als RGBA-Array im Leinwandkoordinatensystem."""
    l = layer_info(base, i)
    im = Image.open(os.path.join(EXP, base, l['png'])).convert('RGBA')
    a = np.zeros((meta(base)['h'], meta(base)['w'], 4), np.uint8)
    x, y = l['x'], l['y']
    arr = np.array(im)
    h, w = arr.shape[:2]
    X0, Y0 = max(0, x), max(0, y); X1, Y1 = min(a.shape[1], x + w), min(a.shape[0], y + h)
    if X1 > X0 and Y1 > Y0:
        a[Y0:Y1, X0:X1] = arr[Y0 - y:Y1 - y, X0 - x:X1 - x]
    return a


def bbox(a):
    ys, xs = np.where(a[..., 3] > 0)
    if len(ys) == 0: return None
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def over(dst, src):
    sa = src[..., 3:4] / 255.0; da = dst[..., 3:4] / 255.0
    oa = sa + da * (1 - sa)
    rgb = (src[..., :3] * sa + dst[..., :3] * da * (1 - sa)) / np.maximum(oa, 1e-6)
    out = np.concatenate([rgb, oa * 255], -1)
    return out.round().astype(np.uint8)


def compose(base, idxs, crop=True, box=None):
    """Ebenen in Stapelreihenfolge (höherer Index = weiter unten) übereinanderlegen."""
    acc = np.zeros((meta(base)['h'], meta(base)['w'], 4), np.uint8)
    for i in sorted(idxs, reverse=True):
        acc = over(acc, layer(base, i))
    if box is not None:
        x0, y0, x1, y1 = box; acc = acc[y0:y1, x0:x1]
    if crop:
        b = bbox(acc)
        if b: acc = acc[b[1]:b[3], b[0]:b[2]]
    # halbtransparente Kanten zu hart (Pixel-Art)
    acc[..., 3] = np.where(acc[..., 3] >= 128, 255, 0)
    return acc


def sprite(key, base=None, idxs=None, box=None):
    p = os.path.join(CACHE, key + '.png')
    if base is not None and os.path.exists(os.path.join(EXP, base, 'layers.json')):
        s = compose(base, idxs, box=box)
        Image.fromarray(s).save(p)
        return s
    return np.array(Image.open(p).convert('RGBA'))


def overlaps(base, i, pad=2, maxarea=0.3):
    """Ebenen, die sich mit Ebene i räumlich überdecken (Kandidaten für Teile derselben Figur)."""
    m = meta(base); A = m['w'] * m['h']
    b = bbox(layer(base, i))
    res = []
    for l in m['layers']:
        if l['i'] == i or 'png' not in l or l['name'].startswith('Sichtbar'): continue
        bb = bbox(layer(base, l['i']))
        if not bb: continue
        if (bb[2] - bb[0]) * (bb[3] - bb[1]) > maxarea * A: continue
        if bb[0] < b[2] + pad and bb[2] > b[0] - pad and bb[1] < b[3] + pad and bb[3] > b[1] - pad:
            res.append((l['i'], l['name'], bb))
    return res


def find(base, name):
    return [(l['i'], l['name']) for l in meta(base)['layers'] if name.lower() in l['name'].lower()]


def match_frac(base, i, j, tol=8):
    """Anteil der deckenden Pixel von Ebene i, die in Ebene j (z. B. einem „Sichtbar“-Abzug) exakt so vorkommen."""
    a = layer(base, i); b = layer(base, j)
    m = a[..., 3] == 255
    n = m.sum()
    if n == 0: return 0.0
    d = np.abs(a[..., :3].astype(int) - b[..., :3].astype(int)).max(-1)
    return float(((d <= tol) & (b[..., 3] > 0) & m).sum() / n)


def scenes_with(base, i, thr=0.9):
    """„Sichtbar“-Abzüge (fertige Kartenszenen), in denen Ebene i sichtbar vorkommt."""
    return [(l['i'], l['name'], round(match_frac(base, i, l['i']), 2)) for l in meta(base)['layers']
            if l['name'].startswith('Sichtbar') and 'png' in l and match_frac(base, i, l['i']) >= thr]


def scene_layers(base, s, thr=0.6, maxarea=0.05):
    """Alle kleinen Ebenen, die in Szene s zu sehen sind."""
    m = meta(base); A = m['w'] * m['h']; res = []
    for l in m['layers']:
        if 'png' not in l or l['name'].startswith('Sichtbar'): continue
        bb = bbox(layer(base, l['i']))
        if not bb or (bb[2] - bb[0]) * (bb[3] - bb[1]) > maxarea * A: continue
        f = match_frac(base, l['i'], s)
        if f >= thr: res.append((l['i'], l['name'], bb, round(f, 2)))
    return res


def touching(base, i, cands, dil=1):
    """Welche Kandidaten-Ebenen berühren/überlappen die Pixel von Ebene i?"""
    import cv2
    m = (layer(base, i)[..., 3] > 0).astype(np.uint8)
    m = cv2.dilate(m, np.ones((2 * dil + 1, 2 * dil + 1), np.uint8)) > 0
    return [c for c in cands if c[0] != i and (m & (layer(base, c[0])[..., 3] > 0)).any()]


def parts(s, dil=2, minpx=4):
    """Mehrere Figuren auf einer Ebene trennen (zusammenhängende Bereiche, links→rechts, oben→unten)."""
    import cv2
    m = (s[..., 3] > 0).astype(np.uint8)
    g = cv2.dilate(m, np.ones((2 * dil + 1, 2 * dil + 1), np.uint8))
    n, lab = cv2.connectedComponents(g, connectivity=8)
    out = []
    for k in range(1, n):
        mk = (lab == k) & (m > 0)
        if mk.sum() < minpx: continue
        p = s.copy(); p[~mk] = 0
        b = bbox(p); out.append(((b[0], b[1]), p[b[1]:b[3], b[0]:b[2]]))
    out.sort(key=lambda t: (t[0][0], t[0][1]))
    return [p for _, p in out]


def period(a, axis, lo=4, hi=40):
    """Kachelperiode einer Textur (kleinster Versatz mit minimaler Differenz)."""
    a = a[..., :3].astype(int); best = None
    for p in range(lo, hi):
        d = np.abs(a[p:] - a[:-p]).mean() if axis == 0 else np.abs(a[:, p:] - a[:, :-p]).mean()
        if best is None or d < best[1] - 0.5: best = (p, d)
    return best


def split_x(s):
    """Zwei nebeneinanderstehende, sich berührende Figuren an der dünnsten Spalte der Mitte trennen."""
    col = (s[..., 3] > 0).sum(0); w = len(col)
    lo, hi = w // 3, 2 * w // 3
    c = lo + int(np.argmin(col[lo:hi]))
    L, R = s[:, :c].copy(), s[:, c:].copy()
    def tr(p):
        b = bbox(p); return p[b[1]:b[3], b[0]:b[2]]
    return [tr(L), tr(R)]


def part_at(s, x, y, dil=1):
    """Teilfigur, die den Punkt (x, y) (in Ebenen-Koordinaten des zugeschnittenen Sprites) enthält."""
    import cv2
    m = (s[..., 3] > 0).astype(np.uint8)
    g = cv2.dilate(m, np.ones((2 * dil + 1, 2 * dil + 1), np.uint8))
    n, lab = cv2.connectedComponents(g, connectivity=8)
    k = lab[y, x]
    p = s.copy(); p[(lab != k) | (m == 0)] = 0
    b = bbox(p)
    return p[b[1]:b[3], b[0]:b[2]]


def card_region_layers(base, scene, loc, size=(76, 50), thr=0.6, maxarea=0.05):
    """Ebenen der Szene `scene`, die innerhalb des Kartenausschnitts (loc = links oben, size) liegen.
    Rückgabe: (index, name, bbox relativ zum Kartenausschnitt)."""
    x0, y0 = loc; w, h = size
    out = []
    for i, n, bb, f in scene_layers(base, scene, thr=thr, maxarea=maxarea):
        if bb[0] < x0 + w and bb[2] > x0 and bb[1] < y0 + h and bb[3] > y0:
            out.append((i, n, (bb[0] - x0, bb[1] - y0, bb[2] - x0, bb[3] - y0)))
    return out


def scene_crop(base, scene, loc, box):
    """Exakter Bildausschnitt aus einer „Sichtbar“-Szene; box relativ zum Kartenausschnitt (loc)."""
    x0, y0 = loc
    a = layer(base, scene)
    return a[y0 + box[1]:y0 + box[3], x0 + box[0]:x0 + box[2]].copy()


def scene_sprite(key, base, scene, loc, box):
    p = os.path.join(CACHE, key + '.png')
    if os.path.exists(os.path.join(EXP, base, 'layers.json')):
        s = scene_crop(base, scene, loc, box); s[..., 3] = 255
        Image.fromarray(s).save(p); return s
    return np.array(Image.open(p).convert('RGBA'))
