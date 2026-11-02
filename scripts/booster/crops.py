# -*- coding: utf-8 -*-
"""Ausschnitt-Wahl für Kacheln: das Motiv soll mittig und groß im Ausschnitt liegen, nicht winzig in leerer Fläche
und nicht in einer Lücke zwischen mehreren Objekten."""
import numpy as np
from PIL import Image
import catalog as C

# Von Hand aussortiert: Ausschnitt trifft das Motiv nicht (dünne Gegenstände, Lücken zwischen Objekten …)
BLOCK = {'Bamboo Staff', 'Bamboo Shield'}

_prep_cache = {}
_best_cache = {}


def _prep(name, k):
    key = (name, k)
    if key in _prep_cache:
        return _prep_cache[key]
    a = C.art(name)
    if a is None:
        _prep_cache[key] = None
        return None
    im = a.convert('RGB')
    if k > 1:
        im = im.resize((im.width * k, im.height * k), Image.NEAREST)
    x = np.asarray(im).astype(np.int32)
    q = x >> 4
    code = (q[..., 0] << 8) | (q[..., 1] << 4) | q[..., 2]
    vals, cnt = np.unique(code, return_counts=True)
    bgcol = x[code == vals[cnt.argmax()]].mean(0)
    fg = (np.abs(x - bgcol).sum(-1) > 70).astype(np.float64)
    gx = np.abs(np.diff(x, axis=1)).sum(-1); gy = np.abs(np.diff(x, axis=0)).sum(-1)
    g = np.zeros(fg.shape)
    g[:, :-1] += gx; g[:-1, :] += gy
    g = np.minimum(g, 150) / 150.0

    def integ(a):
        s = np.zeros((a.shape[0] + 1, a.shape[1] + 1))
        s[1:, 1:] = a.cumsum(0).cumsum(1)
        return s
    ys, xs = np.mgrid[0:fg.shape[0], 0:fg.shape[1]]
    fy_, fx_ = np.where(fg > 0)
    if len(fx_) > 20:
        bb = (np.percentile(fx_, 3), np.percentile(fy_, 3), np.percentile(fx_, 97), np.percentile(fy_, 97))
    else:
        bb = (0, 0, 1, 1)
    wgt = g ** 2
    cent = ((wgt * xs).sum() / max(wgt.sum(), 1e-9), (wgt * ys).sum() / max(wgt.sum(), 1e-9))
    res = dict(cent=cent, im=im, fg=integ(fg), g=integ(g), fx=integ(fg * xs), fy=integ(fg * ys), bgfrac=1 - fg.mean(), bb=bb)
    _prep_cache[key] = res
    return res


def _box(s, x0, y0, x1, y1):
    return s[y1, x1] - s[y0, x1] - s[y1, x0] + s[y0, x0]


def best_crop(name, tw, th, k):
    """(Bild, Güte) des besten tw x th-Ausschnitts der (k-fach vergrößerten) Karte. Güte < 0: unbrauchbar."""
    key = (name, tw, th, k)
    if key in _best_cache:
        return _best_cache[key]
    p = _prep(name, k)
    if p is None:
        _best_cache[key] = (None, -1.0)
        return _best_cache[key]
    im = p['im']
    W_, H_ = im.size
    tw, th = min(tw, W_), min(th, H_)
    if p["bgfrac"] > 0.55:
        # Motiv auf ruhigem Grund: nur brauchbar, wenn das ganze Motiv in den Ausschnitt passt und ihn ordentlich füllt
        x0, y0, x1, y1 = p['bb']
        bw, bh = x1 - x0 + 1, y1 - y0 + 1
        x = int(round(min(max((x0 + x1) / 2 - tw / 2, 0), W_ - tw))); y = int(round(min(max((y0 + y1) / 2 - th / 2, 0), H_ - th)))
        ok = not (bw > tw or bh > th or (bw * bh) / float(tw * th) < 0.3) and name not in BLOCK
        _best_cache[key] = (im.crop((x, y, x + tw, y + th)).convert('RGBA'), 1.4 if ok else -1.0)
        return _best_cache[key]
    # Motiv = Schwerpunkt der kräftigen Kanten; der Ausschnitt wird darauf zentriert. Geht das wegen des Bildrands nicht, ist die Karte unbrauchbar.
    mx, my = p['cent']
    x = int(round(min(max(mx - tw / 2, 0), W_ - tw))); y = int(round(min(max(my - th / 2, 0), H_ - th)))
    off_x = abs((x + tw / 2) - mx) / tw; off_y = abs((y + th / 2) - my) / th
    area = float(tw * th)
    ax0, ay0, ax1, ay1 = x + tw // 4, y + th // 4, x + tw - tw // 4, y + th - th // 4
    ca = float((ax1 - ax0) * (ay1 - ay0))
    cfg = _box(p['fg'], ax0, ay0, ax1, ay1) / ca
    cg = _box(p['g'], ax0, ay0, ax1, ay1) / ca
    gr = _box(p['g'], x, y, x + tw, y + th) / area
    sc = cg + gr * 0.5 + min(cfg, 0.8) * 0.6 - (off_x + off_y)
    cx0, cy0 = x, y
    quality = sc if (cfg >= 0.45 and cg >= 0.12 and off_x <= 0.06 and off_y <= 0.09) else -1.0
    crop = im.crop((x, y, x + tw, y + th))
    a = np.asarray(crop).astype(float)
    h_, w_ = a.shape[:2]
    mid = a[h_ // 4:h_ - h_ // 4, w_ // 4:w_ - w_ // 4].reshape(-1, 3)
    ring = np.concatenate([a[:h_ // 4].reshape(-1, 3), a[h_ - h_ // 4:].reshape(-1, 3), a[:, :w_ // 4].reshape(-1, 3), a[:, w_ - w_ // 4:].reshape(-1, 3)])
    if np.abs(mid.mean(0) - ring.mean(0)).sum() < 55:        # Mitte hebt sich nicht von der Umgebung ab: Textur/Lücke statt Motiv
        quality = -1.0
    if name in BLOCK or name.startswith('Mischief Militia'):      # winzige Figuren im Schnee ergeben nur Textur
        quality = -1.0
    out = (crop.convert('RGBA'), quality)
    _best_cache[key] = out
    return out
