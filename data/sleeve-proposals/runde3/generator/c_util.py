# -*- coding: utf-8 -*-
"""Hilfen für Block C (Sleeves 14–19): Sprites und Texturen aus MotiveSteamDwarfs.xcf / MotiveRussia.xcf."""
from common import *  # noqa
import xcfkit as XK

SD = 'MotiveSteamDwarfs'
RU = 'MotiveRussia'


def tex(key, base, i, box):
    """Rechteckiger Texturausschnitt (RGB) einer Ebene; wird unter sprites3/<key>.png abgelegt."""
    p = os.path.join(XK.CACHE, key + '.png')
    if os.path.exists(os.path.join(XK.EXP, base, 'layers.json')):
        x0, y0, x1, y1 = box
        a = layer(base, i)[y0:y1, x0:x1].copy()
        Image.fromarray(a).save(p)
    else:
        a = np.array(Image.open(p).convert('RGBA'))
    return a[..., :3]


def tile_fill(cv, t, x0, y0, x1, y1, k=1, ox=0, oy=0, mask=None):
    """Fläche mit Textur t (RGB) kacheln, t vorher ganzzahlig k-fach vergrößert."""
    T = up(np.dstack([t, np.full(t.shape[:2], 255, np.uint8)]), k)[..., :3]
    th, tw = T.shape[:2]
    for y in range(max(0, y0), min(cv.h, y1)):
        for x in range(max(0, x0), min(cv.w, x1)):
            if mask is None or mask(x, y):
                cv.a[y, x] = T[(y - y0 + oy) % th, (x - x0 + ox) % tw]


def shade_rows(cv, y0, y1, f0, f1, col=(0, 0, 0), x0=0, x1=None, k=1):
    """Senkrechter Verlauf zu einer Farbe hin (geordnetes Dithering in 4 Stufen, Raster k×k)."""
    x1 = cv.w if x1 is None else x1
    for y in range(max(0, y0), min(cv.h, y1)):
        yy = y0 + (y - y0) // k * k
        t = f0 + (f1 - f0) * (yy - y0) / max(1, (y1 - y0 - 1))
        for x in range(x0, x1):
            q = math.floor(t * 4 + BAYER4[(y // k) % 4, (x // k) % 4]) / 4
            q = min(max(q, 0), 1)
            cv.a[y, x] = (cv.a[y, x] * (1 - q) + np.array(col) * q).astype(np.uint8)


def ripple(s, amp, period, phase=0):
    """Zeilen eines Sprites ganzzahlig seitlich versetzen (Wellen-/Hitzeflimmern)."""
    h, w = s.shape[:2]
    out = np.zeros((h, w + 2 * amp, 4), np.uint8)
    for y in range(h):
        d = int(round(amp * math.sin(2 * math.pi * (y + phase) / period)))
        out[y, amp + d:amp + d + w] = s[y]
    return out


def dropshadow(cv, s, x, y, dx=0, dy=0, col=(0, 0, 0), alpha=0.5):
    cv.paste(silhouette(s, col), x + dx, y + dy, alpha=alpha)


# ---------------------------------------------------------------- Regel B: Vollständigkeitsprüfung
def fig_check(base, idxs, scene, pad=4, tol=8, minpx=3, verbose=True, box=None, maxarea=0.05):
    """Welche weiteren Ebenen der Datei sind in der Szene `scene` innerhalb der (erweiterten)
    Bounding-Box der Figur (Ebenen idxs) sichtbar? Liefert [(ebene, name, px_in_box, px_ausserhalb_figur)].
    Zusätzlich: Anteil der Szenenpixel in der Figur-Box, die von der Figur erklärt werden."""
    import xcfkit as X
    fig = X.compose(base, idxs, crop=False)
    m = fig[..., 3] > 0
    if box is not None:
        bm = np.zeros(m.shape, bool); bm[box[1]:box[3], box[0]:box[2]] = True
        fig[~bm] = 0; m = fig[..., 3] > 0
    b = X.bbox(fig)
    A = m.shape[0] * m.shape[1]
    x0, y0, x1, y1 = b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad
    S = X.layer(base, scene)
    box = np.zeros(m.shape, bool); box[y0:y1, x0:x1] = True
    # Figurenpixel, die in der Szene exakt so zu sehen sind
    d = np.abs(fig[..., :3].astype(int) - S[..., :3].astype(int)).max(-1)
    shown = m & (d <= tol)
    res = []
    for l in X.meta(base)['layers']:
        if l['i'] in idxs or 'png' not in l or l['name'].startswith('Sichtbar'): continue
        a = X.layer(base, l['i'])
        bb = X.bbox(a)
        if bb is None or (bb[2] - bb[0]) * (bb[3] - bb[1]) > maxarea * A: continue
        la = (a[..., 3] > 200) & box
        if la.sum() < minpx: continue
        dd = np.abs(a[..., :3].astype(int) - S[..., :3].astype(int)).max(-1)
        vis = la & (dd <= tol)
        n = int(vis.sum())
        if n < minpx: continue
        out = int((vis & ~m).sum())
        res.append((l['i'], l['name'], n, out))
    res.sort(key=lambda t: -t[2])
    if verbose:
        print(f'fig {idxs} scene {scene} bbox {b}: {shown.sum()}/{m.sum()} Figurpixel in Szene sichtbar')
        for r in res[:12]: print('   ', r)
    return res


# ---------------------------------------------------------------- Figuren / Platzierung
def figure(key, base, items):
    """Figur aus mehreren Ebenen zusammensetzen. items: Ebenenindex oder (index, box) – box begrenzt
    die Ebene auf einen Ausschnitt (x0, y0, x1, y1) im Leinwandsystem. Stapelreihenfolge wie in GIMP
    (höherer Index = weiter unten). Zugeschnitten, halbtransparente Kanten gehärtet, Cache sprites3/<key>.png."""
    import xcfkit as X
    p = os.path.join(X.CACHE, key + '.png')
    if not os.path.exists(os.path.join(X.EXP, base, 'layers.json')):
        return np.array(Image.open(p).convert('RGBA'))
    norm = [(it, None) if isinstance(it, (int, np.integer)) else it for it in items]
    acc = None
    for i, box in sorted(norm, key=lambda t: -t[0]):
        a = X.layer(base, i).copy()
        if box is not None:
            m = np.zeros(a.shape[:2], bool); m[box[1]:box[3], box[0]:box[2]] = True
            a[~m] = 0
        acc = a if acc is None else X.over(acc, a)
    b = X.bbox(acc)
    acc = acc[b[1]:b[3], b[0]:b[2]].copy()
    acc[..., 3] = np.where(acc[..., 3] >= 128, 255, 0)
    Image.fromarray(acc).save(p)
    return acc


def put(cv, s, x, y, k=1, fl=False, ol=None, shadow=None, sdx=1, sdy=1, salpha=0.5):
    """Sprite s (nativ) k-fach an (x, y) setzen; optional 1-Pixel-Kontur (nativ) und Schlagschatten
    (Versatz in nativen Pixeln), beide in derselben Pixelgröße wie das Sprite."""
    if fl: s = flip(s)
    if ol is not None:
        o = outline(s, ol)
        if shadow is not None:
            cv.paste(silhouette(up(o, k), shadow), x - k + sdx * k, y - k + sdy * k, alpha=salpha)
        cv.paste(up(o, k), x - k, y - k)
    elif shadow is not None:
        cv.paste(silhouette(up(s, k), shadow), x + sdx * k, y + sdy * k, alpha=salpha)
    cv.paste(up(s, k), x, y)
    return up(s, k).shape[:2]


def blit(cv, rgb, x, y, k=1, mask=None):
    """RGB-Ausschnitt k-fach deckend einsetzen (für Hintergründe), optional Maske (bool, nativ)."""
    R = up(np.dstack([rgb[..., :3], (np.full(rgb.shape[:2], 255, np.uint8) if mask is None
                                     else mask.astype(np.uint8) * 255)]), k)
    cv.paste(R, x, y)


def dither_fill(cv, x0, y0, x1, y1, fn, cols, k=1):
    """Fläche aus einer Farbstufenliste mit geordnetem Dithering; fn(x, y) -> t in [0, 1]
    wählt die Stufe. k = Pixelgröße des Ditherrasters."""
    n = len(cols) - 1
    for y in range(max(0, y0), min(cv.h, y1)):
        for x in range(max(0, x0), min(cv.w, x1)):
            t = min(max(fn(x, y), 0), 1) * n
            i = int(t); f = t - i
            if i < n and f > BAYER4[(y // k) % 4, (x // k) % 4]: i += 1
            cv.a[y, x] = cols[min(i, n)]
