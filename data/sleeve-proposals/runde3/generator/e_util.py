# -*- coding: utf-8 -*-
"""Hilfen für Block E (Runde 3b): Vollständigkeitsprüfung (Regel B) und kleine Zeichenwerkzeuge."""
from common import *
import numpy as np
import xcfkit
from PIL import Image

SCR = '/tmp/claude-0/-home-user-PixelParties/957fee25-d4dc-57bc-9138-a88ef389536d/scratchpad'


def scenes_for(base, idxs, thr=0.4):
    """Sichtbar-Szenen, in denen die zusammengesetzte Figur (idxs) pixelgenau vorkommt."""
    fig = compose(base, idxs, crop=False)
    m = fig[..., 3] > 0; n = m.sum(); out = []
    for l in meta(base)['layers']:
        if not l['name'].startswith('Sichtbar') or 'png' not in l: continue
        sc = layer(base, l['i'])
        d = np.abs(fig[..., :3].astype(int) - sc[..., :3].astype(int)).max(-1)
        f = ((d <= 8) & m & (sc[..., 3] > 0)).sum() / max(1, n)
        if f >= thr: out.append((l['i'], l['name'], round(float(f), 2)))
    return sorted(out, key=lambda t: -t[2])


def extra_layers(base, idxs, scene, pad=8, minpx=3, thr=0.6, maxarea=0.08):
    """Alle Ebenen (nicht in idxs), deren Pixel innerhalb der (erweiterten) Figuren-Box im Szenenabzug sichtbar sind."""
    fig = compose(base, idxs, crop=False)
    b = bbox(fig); x0, y0, x1, y1 = b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad
    sc = layer(base, scene)
    M = meta(base); A = M['w'] * M['h']; res = []
    for l in M['layers']:
        i = l['i']
        if i in idxs or 'png' not in l or l['name'].startswith('Sichtbar'): continue
        a = layer(base, i)
        bb = bbox(a)
        if not bb or (bb[2] - bb[0]) * (bb[3] - bb[1]) > maxarea * A: continue
        if bb[0] >= x1 or bb[2] <= x0 or bb[1] >= y1 or bb[3] <= y0: continue
        sub = a[y0:y1, x0:x1]; ss = sc[y0:y1, x0:x1]
        m = sub[..., 3] == 255
        if m.sum() < minpx: continue
        d = np.abs(sub[..., :3].astype(int) - ss[..., :3].astype(int)).max(-1)
        f = ((d <= 8) & m).sum() / m.sum()
        if f >= thr: res.append((i, l['name'], int(m.sum()), round(float(f), 2)))
    return res


def compare(base, idxs, scene, name, pad=6, k=8, extra=()):
    """Szene-Ausschnitt | eigene Figur | Differenz (rot = in Szene sichtbar & von Figur verdeckt? nein: Figur fehlt)."""
    fig = compose(base, idxs, crop=False)
    b = bbox(fig); x0, y0, x1, y1 = b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad
    sc = layer(base, scene)[y0:y1, x0:x1].copy(); sc[..., 3] = 255
    f = fig[y0:y1, x0:x1]
    g = np.zeros_like(sc); g[..., :3] = 110; g[..., 3] = 255
    fg = g.copy(); m = f[..., 3] > 0; fg[m] = f[m]
    row = [sc, fg]
    for e in extra:
        eg = g.copy(); ee = e[y0:y1, x0:x1]; mm = ee[..., 3] > 0; eg[mm] = ee[mm]; row.append(eg)
    sep = np.zeros((sc.shape[0], 1, 4), np.uint8); sep[..., 3] = 255
    im = np.concatenate(sum([[r, sep] for r in row], [])[:-1], 1)
    Image.fromarray(im).resize((im.shape[1] * k, im.shape[0] * k), 0).save(f'{SCR}/{name}.png')
    return (x0, y0, x1, y1)


def show(arrs, name, k=6, bg=(110, 110, 110)):
    """Mehrere RGBA-Arrays nebeneinander auf grauem Grund zur Kontrolle."""
    h = max(a.shape[0] for a in arrs); out = []
    for a in arrs:
        g = np.zeros((h, a.shape[1] + 2, 4), np.uint8); g[..., :3] = bg; g[..., 3] = 255
        m = a[..., 3] > 0; sub = g[:a.shape[0], 1:1 + a.shape[1]]; sub[m] = a[m]; out.append(g)
    im = np.concatenate(out, 1)
    Image.fromarray(im).resize((im.shape[1] * k, im.shape[0] * k), 0).save(f'{SCR}/{name}.png')


def trim_(s):
    ys, xs = np.where(s[..., 3] > 0)
    return s[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def blit(cv, s, x, y, k):
    """Sprite mit Faktor k (nearest) einfügen – Kurzform."""
    cv.paste(up(s, k), x, y)


def dither_mix(cv, mask, col, t, a=0.5):
    """Innerhalb mask mit Stärke t (0..1) geordnet gedithert zur Farbe col mischen (Mischanteil a)."""
    H, W = cv.a.shape[:2]
    Y, X = np.mgrid[0:H, 0:W]
    tt = t if np.ndim(t) else np.full((H, W), t)
    lit = mask & (tt > BAYER4[Y % 4, X % 4])
    c = cv.a.astype(float)
    c[lit] = c[lit] * (1 - a) + np.array(col) * a
    cv.a[:] = c.clip(0, 255).astype(np.uint8)


def blocky(fn, k, H=350, W=250):
    """Maske auf grobem Raster (Pixelgröße k) berechnen und hochskalieren – für selbstgezeichnete Effekte
    in derselben Pixelgröße wie die Umgebung."""
    h, w = (H + k - 1) // k, (W + k - 1) // k
    Y, X = np.mgrid[0:h, 0:w]
    m = fn(X, Y)
    return np.repeat(np.repeat(m, k, 0), k, 1)[:H, :W]


def upcanvas(small, k, W=250, H=350, ox=0, oy=0):
    """Kleine Leinwand (natives Raster) ganzzahlig auf 250×350 hochskalieren – garantiert einheitliche
    Pixelgröße k für alles, was auf der kleinen Leinwand liegt. ox/oy: Versatz in Zielpixeln (zentrieren)."""
    big = Canvas(W, H)
    a = up(small.a, k)
    big.a[:] = a[oy:oy + H, ox:ox + W]
    return big


def small_canvas(k, W=250, H=350):
    """Leinwand im groben Raster: deckt 250×350 bei Pixelgröße k ab (aufgerundet)."""
    return Canvas((W + k - 1) // k, (H + k - 1) // k)


def compose_boxes(base, items, crop=True):
    """Wie compose, aber je Ebene optional nur ein Rechteck (x0, y0, x1, y1) in Leinwandkoordinaten:
    items = [(index, box|None), ...]. Stapelreihenfolge wie GIMP (kleiner Index = oben)."""
    M = meta(base)
    acc = np.zeros((M['h'], M['w'], 4), np.uint8)
    for i, box in sorted(items, key=lambda t: -t[0]):
        l = layer(base, i)
        if box is not None:
            m = np.zeros(l.shape[:2], bool); x0, y0, x1, y1 = box; m[y0:y1, x0:x1] = True
            l = l.copy(); l[~m] = 0
        acc = xcfkit.over(acc, l)
    acc[..., 3] = np.where(acc[..., 3] >= 128, 255, 0)
    if crop:
        b = bbox(acc); acc = acc[b[1]:b[3], b[0]:b[2]]
    return acc
