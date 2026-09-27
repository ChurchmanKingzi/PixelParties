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


def shade_rows(cv, y0, y1, f0, f1, col=(0, 0, 0), x0=0, x1=None):
    """Senkrechter Verlauf zu einer Farbe hin (geordnetes Dithering in 4 Stufen)."""
    x1 = cv.w if x1 is None else x1
    for y in range(max(0, y0), min(cv.h, y1)):
        t = f0 + (f1 - f0) * (y - y0) / max(1, (y1 - y0 - 1))
        for x in range(x0, x1):
            q = math.floor(t * 4 + BAYER4[y % 4, x % 4]) / 4
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
