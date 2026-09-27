# -*- coding: utf-8 -*-
"""Kleine Hilfen für Block G (Sleeves 39–45)."""
import math
import numpy as np
from common import *  # noqa
import xcfkit as X


def rgba(a):
    """RGB -> RGBA (deckend)."""
    if a.shape[2] == 4: return a
    return np.dstack([a, np.full(a.shape[:2], 255, np.uint8)])


def lay(base, i, box=None):
    """Einzelne Ebene zugeschnitten (harte Alphakanten)."""
    return compose(base, [i], box=box)


def frame(cv, cols=((20, 14, 6), (200, 150, 40), (250, 220, 120), (20, 14, 6))):
    for i, c in enumerate(cols):
        cv.a[i, :] = c; cv.a[-1 - i, :] = c; cv.a[:, i] = c; cv.a[:, -1 - i] = c


def mirror_tile(src, w, h, ox=0, oy=0):
    """Textur durch gespiegeltes Kacheln auf w×h bringen (keine Nahtkanten)."""
    t = np.concatenate([src, src[:, ::-1]], 1)
    t = np.concatenate([t, t[::-1]], 0)
    th, tw = t.shape[:2]
    yy = (np.arange(h) + oy) % th; xx = (np.arange(w) + ox) % tw
    return t[yy][:, xx]


def dither_blend(cv, col, alpha_fn, x0=0, y0=0, x1=None, y1=None, levels=4):
    """Farbe col mit geordnetem Dithering über das Bild legen; alpha_fn(x, y) -> [0, 1].
    Stufen: Mischung in `levels` Schritten + Bayer-Rest."""
    x1 = cv.w if x1 is None else x1; y1 = cv.h if y1 is None else y1
    col = np.array(col, float)
    for y in range(max(0, y0), min(cv.h, y1)):
        for x in range(max(0, x0), min(cv.w, x1)):
            a = alpha_fn(x, y)
            if a <= 0: continue
            q = math.floor(a * levels + BAYER4[y % 4, x % 4]) / levels
            q = min(1.0, max(0.0, q))
            if q > 0:
                cv.a[y, x] = (cv.a[y, x] * (1 - q) + col * q).astype(np.uint8)


def paste_shadow(cv, s, x, y, dx=2, dy=2, col=(0, 0, 0), alpha=0.5):
    cv.paste(silhouette(s, col), x + dx, y + dy, alpha=alpha)
    cv.paste(s, x, y)


def recolor_map(s, pairs, tol=10):
    """Exakte Farbtausche (für Tag/Nacht-Varianten)."""
    out = s.copy(); c = s[..., :3].astype(int)
    for a, b in pairs:
        m = (np.abs(c - np.array(a)).max(-1) <= tol) & (s[..., 3] > 0)
        out[m, :3] = b
    return out



# ---------------------------------------------------------------- Runde 3b: Vollständigkeitsprüfung (Regel B)
def fig_layers(base, scene, box, thr=0.6, minpx=3, tol=8):
    """Alle (nicht-„Sichtbar“) Ebenen der Datei, deren deckende Pixel innerhalb box=(x0,y0,x1,y1) im Szenen-Abzug
    `scene` zu sehen sind (Anteil >= thr). Sucht über den GANZEN Ebenenstapel, nicht nur Nachbarebenen."""
    import xcfkit as X
    x0, y0, x1, y1 = box
    sc = X.layer(base, scene)[y0:y1, x0:x1]
    out = []
    for l in X.meta(base)['layers']:
        if 'png' not in l or l['name'].startswith('Sichtbar'): continue
        # schneller Vorfilter über Offset/Größe der Ebene
        if l['x'] >= x1 or l['y'] >= y1 or l['x'] + l['w'] <= x0 or l['y'] + l['h'] <= y0: continue
        a = X.layer(base, l['i'])[y0:y1, x0:x1]
        m = a[..., 3] == 255
        n = int(m.sum())
        if n < minpx: continue
        d = np.abs(a[..., :3].astype(int) - sc[..., :3].astype(int)).max(-1)
        f = float(((d <= tol) & m).sum() / n)
        if f >= thr: out.append((l['i'], l['name'], n, round(f, 2)))
    return out


def diff_vs_scene(base, idxs, scene, box, tol=8):
    """Zusammengesetzte Ebenen mit dem Szenen-Ausschnitt vergleichen: Anzahl Szenenpixel (nicht Hintergrund
    der Ebenenmenge), die im Komposit fehlen bzw. abweichen. Liefert (fehlend-Maske, Komposit, Szene)."""
    import xcfkit as X
    x0, y0, x1, y1 = box
    c = X.compose(base, idxs, crop=False)[y0:y1, x0:x1]
    sc = X.layer(base, scene)[y0:y1, x0:x1]
    d = np.abs(c[..., :3].astype(int) - sc[..., :3].astype(int)).max(-1)
    return (c[..., 3] > 0) & (d > tol), c, sc


def zoomsave(arrs, path, k=8, bg=(0, 150, 110)):
    """Mehrere RGBA-Arrays nebeneinander vergrößert speichern (Prüfansicht)."""
    from PIL import Image
    hs = max(a.shape[0] for a in arrs); ws = sum(a.shape[1] + 2 for a in arrs)
    out = np.zeros((hs, ws, 3), np.uint8); out[:] = (40, 40, 40); x = 0
    for a in arrs:
        if a.shape[2] == 3: a = rgba(a)
        al = a[..., 3:4] / 255.0
        out[:a.shape[0], x:x + a.shape[1]] = (a[..., :3] * al + np.array(bg) * (1 - al)).astype(np.uint8)
        x += a.shape[1] + 2
    Image.fromarray(out).resize((ws * k, hs * k), Image.NEAREST).save(path)
    return path


def find_in_scenes(base, s, top=5, pad=4):
    """Sprite s (RGBA, zugeschnitten) per maskiertem Template-Matching in allen „Sichtbar“-Abzügen suchen
    (die Szenen-Abzüge stimmen oft nicht positionsgleich mit den Ebenen überein). Liefert
    [(fehlerquote, szene, (x, y))] – x, y = linke obere Ecke des Sprites in der Szene."""
    import cv2, xcfkit as X
    t = s[..., :3].astype(np.float32); m = (s[..., 3] > 0).astype(np.float32)
    m3 = np.dstack([m] * 3)
    res = []
    for l in X.meta(base)['layers']:
        if 'png' not in l or not l['name'].startswith('Sichtbar'): continue
        img = X.layer(base, l['i'])[..., :3].astype(np.float32)
        r = cv2.matchTemplate(img, t, cv2.TM_SQDIFF, mask=m3)
        mn, _, loc, _ = cv2.minMaxLoc(r)
        res.append((mn / (m.sum() * 3 * 255 * 255 + 1e-6), l['i'], loc))
    res.sort()
    return res[:top]
