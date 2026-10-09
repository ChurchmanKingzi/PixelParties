# -*- coding: utf-8 -*-
"""Werkzeuge für Sleeve-Runde 2: alles wird aus Kartenbildern ausgeschnitten.

Kartenbilder werden auf ihr natives Pixelraster zurückgerechnet (native2 aus ../../generator/pp.py),
Figuren per Farbschlüssel/Flood-Fill freigestellt und dann ganzzahlig skaliert auf ein
250×350-Raster gesetzt (Ausgabe 3× = 750×1050).
"""
import os, sys, math, functools
import numpy as np
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'generator'))
import pp  # noqa: E402
from pp import Canvas, draw_text, text_mask, outline, lerp, BAYER4  # noqa: F401,E402
import cv2  # noqa: E402

ROOT = pp.ROOT
OUT = os.path.abspath(os.path.join(HERE, '..'))
SCR = os.environ.get('SP', '/tmp/sleeve-scratch')
os.makedirs(SCR, exist_ok=True)
W, H = 250, 350


def raw(name):
    return pp.card(name)


@functools.lru_cache(None)
def _nat(name):
    # Seit die Kartenbilder nicht mehr als ganze Karten in cards/ liegen, gibt es die Kartenkunst direkt in
    # Originalpixeln unter data/card-art/native/<id>.png (Zuordnung Name → id in data/card-art/index.json).
    art = os.path.join(ROOT, 'data', 'card-art')
    try:
        import json
        e = json.load(open(os.path.join(art, 'index.json'), encoding='utf-8')).get(name)
        p = os.path.join(art, 'native', e['id'] + '.png') if e else None
        if p and os.path.exists(p):
            return np.array(Image.open(p).convert('RGB'))
    except (OSError, ValueError, KeyError):
        pass
    a, info = pp.native2(name)
    return a


def nat(name):
    return _nat(name).copy()


def zoom(name, path=None, k=8, box=None):
    """Vorschau des nativen Bildes mit Koordinatengitter (alle 5 px)."""
    a = nat(name) if isinstance(name, str) else name
    if box:
        x0, y0, x1, y1 = box; a = a[y0:y1, x0:x1]
    else:
        x0 = y0 = 0
    h, w = a.shape[:2]
    if a.shape[2] == 4:
        bg = np.array([0, 150, 110])
        al = a[..., 3:4] / 255
        a = (a[..., :3] * al + bg * (1 - al)).astype(np.uint8)
    im = Image.fromarray(a[..., :3]).resize((w * k, h * k), Image.NEAREST)
    d = ImageDraw.Draw(im)
    for x in range(0, w):
        if (x + x0) % 5 == 0:
            d.line([(x * k, 0), (x * k, h * k)], fill=(255, 255, 0) if (x + x0) % 10 == 0 else (90, 90, 90))
            if (x + x0) % 10 == 0: d.text((x * k + 2, 2), str(x + x0), fill=(255, 255, 0))
    for y in range(0, h):
        if (y + y0) % 5 == 0:
            d.line([(0, y * k), (w * k, y * k)], fill=(255, 255, 0) if (y + y0) % 10 == 0 else (90, 90, 90))
            if (y + y0) % 10 == 0: d.text((2, y * k + 2), str(y + y0), fill=(255, 255, 0))
    path = path or os.path.join(SCR, 'zoom.png')
    im.save(path)
    return path


def cut(name, box, bg=(), tol=38, fg=(), clear=(), connect=True, largest=0, src=None):
    """Figur ausschneiden.
    box: (x0,y0,x1,y1) im nativen Raster. bg: Punkte (x,y) mit Hintergrundfarben (absolut).
    Hintergrund = Farben nahe bg, die mit dem Rand der Box (oder einem bg-Punkt) verbunden sind.
    fg/clear: Listen von Punkten oder Rechtecken (x0,y0,x1,y1) zum Erzwingen/Entfernen."""
    a = nat(name) if src is None else src
    x0, y0, x1, y1 = box
    m = pp.keymask(a, (x0, y0, x1 - x0, y1 - y0), bg, tol=tol, connect=connect)
    for r in fg:
        if len(r) == 2: m[r[1] - y0, r[0] - x0] = True
        else: m[r[1] - y0:r[3] - y0, r[0] - x0:r[2] - x0] = True
    for r in clear:
        if len(r) == 2: m[r[1] - y0, r[0] - x0] = False
        else: m[r[1] - y0:r[3] - y0, r[0] - x0:r[2] - x0] = False
    if largest: m = pp.keep_largest(m, largest)
    out = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
    out[..., :3] = a[y0:y1, x0:x1]
    out[..., 3] = m * 255
    return trim(out)


def rect(name, box, src=None):
    a = nat(name) if src is None else src
    x0, y0, x1, y1 = box
    out = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
    out[..., :3] = a[y0:y1, x0:x1][..., :3]; out[..., 3] = 255
    return out


def trim(s):
    ys, xs = np.where(s[..., 3] > 0)
    if len(ys) == 0: return s
    return s[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def up(s, k):
    return np.repeat(np.repeat(s, k, 0), k, 1)


def flip(s):
    return s[:, ::-1].copy()


def rot90(s, n=1):
    return np.rot90(s, n).copy()


def hsv_shift(s, dh=0, ds=1.0, dv=1.0, mask=None):
    """Umfärben: Farbton verschieben (Grad), Sättigung/Helligkeit skalieren."""
    rgb = s[..., :3]
    hsv = cv2.cvtColor(rgb.reshape(-1, 1, 3), cv2.COLOR_RGB2HSV_FULL).reshape(rgb.shape).astype(float)
    nh = (hsv[..., 0] + dh * 256 / 360) % 256
    ns = np.clip(hsv[..., 1] * ds, 0, 255)
    nv = np.clip(hsv[..., 2] * dv, 0, 255)
    new = np.stack([nh, ns, nv], -1).astype(np.uint8)
    rgb2 = cv2.cvtColor(new.reshape(-1, 1, 3), cv2.COLOR_HSV2RGB_FULL).reshape(rgb.shape)
    out = s.copy()
    if mask is None: out[..., :3] = rgb2
    else: out[..., :3] = np.where(mask[..., None], rgb2, rgb)
    return out


def darken(s, f):
    out = s.copy(); out[..., :3] = (out[..., :3].astype(float) * f).clip(0, 255).astype(np.uint8); return out


def tint(s, col, t):
    out = s.copy()
    out[..., :3] = (out[..., :3] * (1 - t) + np.array(col) * t).astype(np.uint8)
    return out


def silhouette(s, col):
    out = s.copy(); out[..., :3] = col; return out


def rotate(s, deg):
    """Pixelgenaue Rotation (nearest) – für schräg gestellte Figuren."""
    h, w = s.shape[:2]
    d = int(math.ceil(math.hypot(h, w))) + 2
    pad = np.zeros((d, d, 4), np.uint8)
    oy, ox = (d - h) // 2, (d - w) // 2
    pad[oy:oy + h, ox:ox + w] = s
    M = cv2.getRotationMatrix2D((d / 2, d / 2), deg, 1.0)
    r = cv2.warpAffine(pad, M, (d, d), flags=cv2.INTER_NEAREST, borderValue=(0, 0, 0, 0))
    return trim(r)


def rotate_up(s, deg, k):
    """Erst hochskalieren, dann drehen (feinere Kanten, Pixel bleiben scharf)."""
    return rotate(up(s, k), deg)


def paste(cv, s, x, y, anchor='tl', alpha=1.0):
    h, w = s.shape[:2]
    if anchor == 'c': x, y = x - w // 2, y - h // 2
    elif anchor == 'b': x, y = x - w // 2, y - h
    cv.paste(s, int(x), int(y), alpha=alpha)
    return (int(x), int(y), w, h)


def fill_tiles(cv, tile, x0=0, y0=0, x1=None, y1=None, ox=0, oy=0):
    x1 = cv.w if x1 is None else x1; y1 = cv.h if y1 is None else y1
    th, tw = tile.shape[:2]
    for y in range(y0, y1):
        for x in range(x0, x1):
            cv.a[y, x] = tile[(y - y0 + oy) % th, (x - x0 + ox) % tw][:3]


def shadow_of(s, col=(0, 0, 0)):
    return silhouette(s, col)


def drop_shadow(cv, s, x, y, dx=2, dy=2, col=(0, 0, 0), alpha=0.5):
    cv.paste(silhouette(s, col), x + dx, y + dy, alpha=alpha)
    cv.paste(s, x, y)


def circle_mask(r):
    yy, xx = np.mgrid[-r:r, -r:r] + 0.5
    return (xx ** 2 + yy ** 2) <= r * r


def disc(src_rgb, cx, cy, r):
    """Runder Ausschnitt (RGBA) aus einem RGB-Bild."""
    m = circle_mask(r)
    out = np.zeros((2 * r, 2 * r, 4), np.uint8)
    H0, W0 = src_rgb.shape[:2]
    for j in range(2 * r):
        for i in range(2 * r):
            y, x = cy - r + j, cx - r + i
            if m[j, i]:
                out[j, i, :3] = src_rgb[min(max(y, 0), H0 - 1), min(max(x, 0), W0 - 1)][:3]
                out[j, i, 3] = 255
    return out


def ring(cv, cx, cy, r0, r1, col):
    for y in range(int(cy - r1 - 1), int(cy + r1 + 2)):
        for x in range(int(cx - r1 - 1), int(cx + r1 + 2)):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if r0 <= d < r1: cv.px(x, y, col)


def save(cv, fname):
    out = cv.img().resize((cv.w * 3, cv.h * 3), Image.NEAREST)
    assert out.size == (750, 1050)
    p = os.path.join(OUT, fname)
    out.save(p)
    return p


def text(cv, txt, size, x, y, col, **kw):
    return draw_text(cv, txt, size, x, y, col, **kw)


def ordered(cv, x0, y0, x1, y1, c_a, c_b, fn):
    """Dither-Fläche: fn(x,y)->t in [0,1] gibt Anteil von c_b."""
    for y in range(max(0, y0), min(cv.h, y1)):
        for x in range(max(0, x0), min(cv.w, x1)):
            t = fn(x, y)
            cv.a[y, x] = c_b if t > BAYER4[y % 4, x % 4] else c_a


def vignette(cv, strength=0.5, r0=0.55):
    h, w = cv.h, cv.w
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2) / math.sqrt(2)
    t = np.clip((d - r0) / (1 - r0), 0, 1) * strength
    th = BAYER4[yy % 4, xx % 4]
    q = (np.floor(t * 4 + th) / 4).clip(0, 1)
    cv.a[:] = (cv.a * (1 - q[..., None])).astype(np.uint8)


def cut2(name, box, bgrects, tol=30, fg=(), clear=(), largest=1, src=None, connect=True, close=0):
    """Wie cut, aber Hintergrundfarben aus Rechtecken (x0,y0,x1,y1) gesammelt."""
    a = nat(name) if src is None else src
    cols = []
    for r in bgrects:
        cols.append(a[r[1]:r[3], r[0]:r[2]].reshape(-1, 3))
    cols = np.unique(np.concatenate(cols), axis=0).astype(int)
    x0, y0, x1, y1 = box
    sub = a[y0:y1, x0:x1].astype(int)
    d = np.full(sub.shape[:2], 1e9)
    for i in range(0, len(cols), 256):
        c = cols[i:i + 256]
        dd = np.sqrt(((sub[:, :, None, :] - c[None, None]) ** 2).sum(-1)).min(-1)
        d = np.minimum(d, dd)
    near = d < tol
    if connect:
        num, lab = cv2.connectedComponents(near.astype(np.uint8), connectivity=4)
        border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
        for r in bgrects:
            for yy in range(max(r[1], y0), min(r[3], y1)):
                for xx in range(max(r[0], x0), min(r[2], x1)):
                    if lab[yy - y0, xx - x0]: border.add(lab[yy - y0, xx - x0])
        bgm = np.isin(lab, list(border))
    else:
        bgm = near
    m = ~bgm
    if close:
        k = np.ones((3, 3), np.uint8)
        m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, k).astype(bool) if close < 0 else m
    for r in fg:
        if len(r) == 2: m[r[1] - y0, r[0] - x0] = True
        else: m[r[1] - y0:r[3] - y0, r[0] - x0:r[2] - x0] = True
    for r in clear:
        if len(r) == 2: m[r[1] - y0, r[0] - x0] = False
        else: m[r[1] - y0:r[3] - y0, r[0] - x0:r[2] - x0] = False
    if largest: m = pp.keep_largest(m, largest)
    out = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
    out[..., :3] = a[y0:y1, x0:x1]
    out[..., 3] = m * 255
    return trim(out)


def sheet(sprites, path, k=6):
    """Vorschau mehrerer Sprites auf Schachbrett."""
    tiles = []
    for s in sprites:
        p = zoom(s, os.path.join(SCR, '_t.png'), k=k)
        tiles.append(Image.open(p).copy())
    Wd = sum(t.size[0] for t in tiles) + 10 * len(tiles); Hd = max(t.size[1] for t in tiles)
    S = Image.new('RGB', (Wd, Hd), (30, 30, 30)); x = 0
    for t in tiles: S.paste(t, (x, 0)); x += t.size[0] + 10
    S.save(path); return path


def cutf(name, box, tol=40, seeds=(), border=True, fg=(), clear=(), largest=0, src=None, maxstep=None):
    """Flood-Fill vom Boxrand: Nachbarpixel mit Farbabstand <= tol gehören zum Hintergrund.
    Dunkle Umrisse der Figuren stoppen die Flut."""
    a = nat(name) if src is None else src
    x0, y0, x1, y1 = box
    x1 = min(x1, a.shape[1]); y1 = min(y1, a.shape[0])
    sub = a[y0:y1, x0:x1]
    m = pp.floodmask(sub, seeds=[(y - y0, x - x0) for (x, y) in seeds], tol=tol, border=border)
    for r in fg:
        if len(r) == 2: m[r[1] - y0, r[0] - x0] = True
        else: m[r[1] - y0:r[3] - y0, r[0] - x0:r[2] - x0] = True
    for r in clear:
        if len(r) == 2: m[r[1] - y0, r[0] - x0] = False
        else: m[r[1] - y0:r[3] - y0, r[0] - x0:r[2] - x0] = False
    if largest: m = pp.keep_largest(m, largest)
    out = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
    out[..., :3] = sub
    out[..., 3] = m * 255
    return trim(out)


def mirror_complete(s, axis_x, side='left'):
    """Symmetrische Figur vervollständigen: linke Hälfte an axis_x spiegeln."""
    h, w = s.shape[:2]
    out = np.zeros((h, 2 * axis_x, 4), np.uint8)
    L = s[:, :axis_x]
    out[:, :axis_x] = L
    out[:, axis_x:] = L[:, ::-1]
    return out


def cutb(name, box, bgcols, tol=35, seedtol=60, fg=(), clear=(), largest=0, src=None):
    """Flood-Fill wie cutf, aber nur von Randpixeln aus, die einer Hintergrundfarbe ähneln
    (damit z. B. Marionettenfäden am Rand erhalten bleiben)."""
    a = nat(name) if src is None else src
    x0, y0, x1, y1 = box
    x1 = min(x1, a.shape[1]); y1 = min(y1, a.shape[0])
    sub = a[y0:y1, x0:x1].astype(int)
    h, w = sub.shape[:2]
    cols = np.array(bgcols, int)
    def bgl(y, x): return np.sqrt(((sub[y, x] - cols) ** 2).sum(-1)).min() < seedtol
    seeds = [(y, x) for x in range(w) for y in (0, h - 1) if bgl(y, x)] + \
            [(y, x) for y in range(h) for x in (0, w - 1) if bgl(y, x)]
    m = pp.floodmask(sub, seeds=seeds, tol=tol, border=False)
    for r in fg:
        if len(r) == 2: m[r[1] - y0, r[0] - x0] = True
        else: m[r[1] - y0:r[3] - y0, r[0] - x0:r[2] - x0] = True
    for r in clear:
        if len(r) == 2: m[r[1] - y0, r[0] - x0] = False
        else: m[r[1] - y0:r[3] - y0, r[0] - x0:r[2] - x0] = False
    if largest: m = pp.keep_largest(m, largest)
    out = np.zeros((h, w, 4), np.uint8)
    out[..., :3] = sub
    out[..., 3] = m * 255
    return out


def string_mask(a, minrun=4, satmax=40, vmin=100, vmax=235):
    """Marionettenfäden: graue, unbunte Pixel in senkrechten Läufen."""
    a = a.astype(int)
    sat = a.max(-1) - a.min(-1); v = a.max(-1)
    g = (sat < satmax) & (v >= vmin) & (v <= vmax)
    m = np.zeros_like(g)
    h, w = g.shape
    for x in range(w):
        y = 0
        while y < h:
            if g[y, x]:
                y2 = y
                while y2 < h and g[y2, x]: y2 += 1
                if y2 - y >= minrun: m[y:y2, x] = True
                y = y2
            else: y += 1
    return m


def inpaint_h(a, m):
    """Maskierte Pixel durch nächsten unmaskierten Nachbarn in der Zeile ersetzen."""
    out = a.copy(); h, w = m.shape
    for y in range(h):
        for x in range(w):
            if m[y, x]:
                for d in range(1, w):
                    for xx in (x - d, x + d):
                        if 0 <= xx < w and not m[y, xx]:
                            out[y, x] = a[y, xx]; break
                    else: continue
                    break
    return out


def cutrule(name, box, rule, src=None, largest=1, conn=8, fg=(), clear=()):
    """Maske per Farbregel rule(rgb_int_array)->bool, optional größte Komponente."""
    a = nat(name) if src is None else src
    x0, y0, x1, y1 = box
    x1 = min(x1, a.shape[1]); y1 = min(y1, a.shape[0])
    sub = a[y0:y1, x0:x1]
    m = rule(sub.astype(int))
    for r in fg:
        if len(r) == 2: m[r[1] - y0, r[0] - x0] = True
        else: m[r[1] - y0:r[3] - y0, r[0] - x0:r[2] - x0] = True
    for r in clear:
        if len(r) == 2: m[r[1] - y0, r[0] - x0] = False
        else: m[r[1] - y0:r[3] - y0, r[0] - x0:r[2] - x0] = False
    if largest:
        num, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), connectivity=conn)
        if num > 1:
            order = np.argsort(-st[1:, cv2.CC_STAT_AREA])[:largest] + 1
            m = np.isin(lab, order)
    out = np.zeros(sub.shape[:2] + (4,), np.uint8)
    out[..., :3] = sub; out[..., 3] = m * 255
    return trim(out)


def hsv_of(c):
    c8 = np.clip(c, 0, 255).astype(np.uint8)
    return cv2.cvtColor(c8.reshape(-1, 1, 3), cv2.COLOR_RGB2HSV_FULL).reshape(c.shape).astype(int)


def not_dirt(c, hlo=8, hhi=110, dark=120, darksat=45):
    """Alles, was nicht brauner/grüner Erdboden ist (für Spinnen etc.)."""
    h = hsv_of(c)
    sat = c.max(-1) - c.min(-1); v = c.max(-1)
    earth = (h[..., 0] >= hlo) & (h[..., 0] <= hhi) & (sat >= darksat)
    return ((v < dark) & (sat < darksat)) | ~earth & (sat >= darksat) | ((v > 200) & (sat < 70))


def fill_holes(s):
    """Eingeschlossene transparente Löcher einer Figur füllen (Alpha)."""
    m = s[..., 3] > 0
    h, w = m.shape
    pad = np.zeros((h + 2, w + 2), np.uint8); pad[1:-1, 1:-1] = m
    ff = pad.copy(); mask = np.zeros((h + 4, w + 4), np.uint8)
    cv2.floodFill(ff, mask, (0, 0), 2)
    holes = (ff[1:-1, 1:-1] == 0)
    out = s.copy(); out[holes, 3] = 255
    return out


def widen(a, w, mode='mirror'):
    """RGB-Streifen auf Breite w bringen: links/rechts gespiegelt auffüllen (zentriert)."""
    h, w0 = a.shape[:2]
    if w0 >= w:
        o = (w0 - w) // 2; return a[:, o:o + w]
    l = (w - w0) // 2; r = w - w0 - l
    L = a[:, 1:l + 1][:, ::-1] if l else a[:, :0]
    R = a[:, w0 - r - 1:w0 - 1][:, ::-1] if r else a[:, :0]
    return np.concatenate([L, a, R], 1)


def save3(cv, fname, frame=None):
    """Natives Raster (83×117) 3× → 249×351 → auf 250×350 zuschneiden, dann 3× speichern."""
    big = Canvas(W, H)
    u = up(np.dstack([cv.a, np.full(cv.a.shape[:2], 255, np.uint8)]), 3)[..., :3]
    hh, ww = u.shape[:2]
    big.a[:] = 0
    big.a[:min(H, hh), :min(W, ww)] = u[:H, :W]
    if ww < W: big.a[:, ww:] = u[:H, -1:]
    if frame:
        for i, c in enumerate(frame):
            big.a[i, :] = c; big.a[-1 - i, :] = c; big.a[:, i] = c; big.a[:, -1 - i] = c
    return save(big, fname)


def ren_mask_sprite():
    """Totenmaske aus „Soul Shard Ren“: Kopfschmuck per Farbregel (Leuchten ist grünlicher als die
    Goldstreifen, Himmel heller/ungesättigter als die blauen Streifen), Schädel per Flood-Fill."""
    box = (14, 2, 54, 46)
    def renrule(c):
        R, G, B = c[..., 0], c[..., 1], c[..., 2]; v = c.max(-1); sat = v - c.min(-1)
        halo = (v > 140) & (G >= R - 4) & (B < G)
        sky = (B > R) & (v > 140) & ((B - R) < 75)
        white = (sat < 25) & (v > 170)
        return ~(halo | sky | white)
    a = nat('Soul Shard Ren')
    x0, y0, x1, y1 = box
    m1 = renrule(a[y0:y1, x0:x1].astype(int))
    m1 = pp.keep_largest(m1, 1)
    sub = a[27:46, 27:49]
    raw_m = pp.floodmask(sub, tol=22)
    full = pp.keep_largest(raw_m, 1)
    c = sub.astype(int)
    halo = (c.max(-1) > 140) & (c[..., 1] >= c[..., 0] - 4) & (c[..., 2] < c[..., 1])
    m1[27 - y0:46 - y0, 27 - x0:49 - x0] |= full & ~halo
    out = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
    out[..., :3] = a[y0:y1, x0:x1]; out[..., 3] = m1 * 255
    return trim(fill_holes(out))
