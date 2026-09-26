# -*- coding: utf-8 -*-
"""Hilfsfunktionen für Pixel-Parties-Sleeves (Canvas 250x350, Ausgabe x3 = 750x1050)."""
import os, re, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from scipy import ndimage

SP = os.path.dirname(os.path.abspath(__file__))
ROOT = os.environ.get('PP_ROOT') or os.path.abspath(os.path.join(SP, '..', '..'))
OUT = os.environ.get('PP_OUT') or os.path.join(ROOT, 'data', 'shop', 'sleeve-entwuerfe')
TMP = os.environ.get('PP_TMP') or SP
W, H, S = 250, 350, 3
FONT = os.path.join(ROOT, 'data', 'Pixel Intv.otf')


def norm(n):
    return re.sub(r'[^a-z0-9]', '', n.lower())


_LUT = {}
for _d in [os.path.join(ROOT, 'cards', 'skins'), os.path.join(ROOT, 'cards')]:
    for _f in os.listdir(_d):
        if _f.endswith('.png'):
            _LUT[norm(_f[:-4])] = os.path.join(_d, _f)


def card(name):
    return Image.open(_LUT[norm(name)]).convert('RGBA')


def art(name):
    """Bildbereich einer Karte (610x400)."""
    return card(name).crop((70, 170, 680, 570))


def area(path):
    return Image.open(os.path.join(ROOT, 'public', 'areas', path + '.png')).convert('RGBA')


def new(color=(0, 0, 0, 255)):
    return Image.new('RGBA', (W, H), color)


def save(img, name):
    out = img.convert('RGB').resize((W * S, H * S), Image.NEAREST)
    p = os.path.join(OUT, name + '.png')
    os.makedirs(OUT, exist_ok=True)
    out.save(p)
    return p


# ---------- Farben / Verläufe ----------
BAYER4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(len(a)))


def dither_gradient(size, stops, vertical=True, steps=None, func=None):
    """Mehrstufiger Verlauf mit Bayer-Dithering zwischen diskreten Farbstufen.
    stops: Liste von (pos, (r,g,b)). func(x,y)->t optional."""
    w, h = size
    yy, xx = np.mgrid[0:h, 0:w]
    if func is not None:
        t = func(xx, yy)
    else:
        t = yy / max(1, h - 1) if vertical else xx / max(1, w - 1)
    t = np.clip(t, 0, 1)
    # Farben als diskrete Bänder; zwischen Bändern ditheren
    cols = [c for _, c in stops]
    pos = [p for p, _ in stops]
    n = len(cols)
    # finde Segment
    out = np.zeros((h, w, 3), np.uint8)
    thr = BAYER4[yy % 4, xx % 4]
    for i in range(n - 1):
        m = (t >= pos[i]) & (t <= pos[i + 1])
        local = (t - pos[i]) / max(1e-6, pos[i + 1] - pos[i])
        pick = local > thr
        a = np.array(cols[i][:3]); b = np.array(cols[i + 1][:3])
        out[m & ~pick] = a
        out[m & pick] = b
    out[t < pos[0]] = cols[0][:3]
    out[t > pos[-1]] = cols[-1][:3]
    im = Image.fromarray(out, 'RGB').convert('RGBA')
    return im


def dither_mask(size, t_arr):
    """Boolsche Maske: Pixel an, wenn Deckkraft t > Bayer-Schwelle."""
    h, w = t_arr.shape
    yy, xx = np.mgrid[0:h, 0:w]
    return t_arr > BAYER4[yy % 4, xx % 4]


# ---------- Sprites ----------
def cut(img, seeds, tol=40, box=None, grow=0, extra_bg=None):
    """Hintergrund per Flood-Fill von Saatpunkten entfernen. Gibt RGBA zurück."""
    if box:
        img = img.crop(box)
    a = np.array(img.convert('RGB')).astype(int)
    h, w, _ = a.shape
    bg = np.zeros((h, w), bool)
    for (sx, sy) in seeds:
        c = a[sy, sx]
        d = np.abs(a - c).sum(2) <= tol
        lab, _ = ndimage.label(d)
        bg |= lab == lab[sy, sx]
    if extra_bg is not None:
        bg |= extra_bg
    if grow:
        bg = ndimage.binary_dilation(bg, iterations=grow)
    rgba = np.dstack([a.astype(np.uint8), np.where(bg, 0, 255).astype(np.uint8)])
    return Image.fromarray(rgba, 'RGBA')


def keep_largest(img, n=1):
    a = np.array(img)
    m = a[..., 3] > 0
    lab, k = ndimage.label(m)
    if k == 0:
        return img
    sizes = ndimage.sum(m, lab, range(1, k + 1))
    keep = np.argsort(sizes)[::-1][:n] + 1
    a[..., 3] = np.where(np.isin(lab, keep), a[..., 3], 0)
    return Image.fromarray(a, 'RGBA')


def fill_holes(img):
    a = np.array(img)
    m = a[..., 3] > 0
    m = ndimage.binary_fill_holes(m)
    a[..., 3] = np.where(m, 255, 0)
    return Image.fromarray(a, 'RGBA')


def shrink(img, f, method=Image.BOX):
    """Sprite auf Canvas-Pixelgröße verkleinern, Alpha hart schneiden."""
    w, h = max(1, round(img.width * f)), max(1, round(img.height * f))
    a = np.array(img.convert('RGBA')).astype(float)
    # Premultiplied verkleinern
    rgb = a[..., :3] * (a[..., 3:4] / 255)
    pm = Image.fromarray(np.dstack([rgb, a[..., 3:4]]).clip(0, 255).astype(np.uint8), 'RGBA')
    sm = np.array(pm.resize((w, h), method)).astype(float)
    al = sm[..., 3:4]
    col = np.where(al > 0, sm[..., :3] / np.maximum(al, 1) * 255, 0)
    alpha = np.where(al[..., 0] >= 110, 255, 0)
    return Image.fromarray(np.dstack([col.clip(0, 255), alpha]).astype(np.uint8), 'RGBA')


def outline(img, color=(20, 12, 30, 255), width=1):
    a = np.array(img)
    m = a[..., 3] > 0
    st = ndimage.generate_binary_structure(2, 1)
    d = ndimage.binary_dilation(m, st, iterations=width) & ~m
    a[d] = color
    return Image.fromarray(a, 'RGBA')


def pad(img, p):
    out = Image.new('RGBA', (img.width + 2 * p, img.height + 2 * p), (0, 0, 0, 0))
    out.paste(img, (p, p))
    return out


def tint(img, color, amount=1.0):
    a = np.array(img).astype(float)
    g = a[..., :3].mean(2, keepdims=True) / 255
    c = np.array(color[:3]) * g
    a[..., :3] = a[..., :3] * (1 - amount) + c * amount
    return Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA')


def silhouette(img, color):
    a = np.array(img)
    a[..., :3] = color[:3]
    return Image.fromarray(a, 'RGBA')


def glow(img, color, radius=3, strength=1.0):
    """Weicher Schein hinter einem Sprite, gedithert (pixelig)."""
    a = np.array(img)[..., 3].astype(float) / 255
    p = radius * 2
    big = np.pad(a, p)
    bl = np.array(Image.fromarray((big * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius))).astype(float) / 255
    bl = np.clip(bl * 2.2 * strength, 0, 1)
    m = dither_mask(None, bl)
    out = np.zeros(bl.shape + (4,), np.uint8)
    out[m] = color
    return Image.fromarray(out, 'RGBA'), p


def paste(dst, src, xy, center=False):
    x, y = xy
    if center:
        x -= src.width // 2
        y -= src.height // 2
    dst.alpha_composite(src, (int(x), int(y)))


def quantize(img, n=24):
    rgb = img.convert('RGB').quantize(n, method=Image.MEDIANCUT, dither=Image.NONE).convert('RGB')
    out = rgb.convert('RGBA')
    out.putalpha(img.getchannel('A'))
    return out


def adjust(img, bright=1.0, contrast=1.0, sat=1.0):
    from PIL import ImageEnhance
    a = img.getchannel('A')
    rgb = img.convert('RGB')
    rgb = ImageEnhance.Brightness(rgb).enhance(bright)
    rgb = ImageEnhance.Contrast(rgb).enhance(contrast)
    rgb = ImageEnhance.Color(rgb).enhance(sat)
    out = rgb.convert('RGBA'); out.putalpha(a)
    return out


# ---------- Text ----------
def text_img(txt, size, fill, outline_col=None, shadow=None, spacing=1):
    f = ImageFont.truetype(FONT, size)
    bbox = f.getbbox(txt)
    w = bbox[2] - bbox[0] + 8
    h = bbox[3] - bbox[1] + 8
    im = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(im)
    d.fontmode = '1'
    d.text((4 - bbox[0], 4 - bbox[1]), txt, font=f, fill=255)
    m = np.array(im) > 127
    out = np.zeros((h, w, 4), np.uint8)
    out[m] = fill
    img = Image.fromarray(out, 'RGBA')
    if outline_col:
        img = outline(img, outline_col)
    if shadow:
        sh = silhouette(img, shadow)
        base = Image.new('RGBA', (w + 1, h + 1), (0, 0, 0, 0))
        base.alpha_composite(sh, (1, 1))
        base.alpha_composite(img, (0, 0))
        img = base
    bb = img.getbbox()
    return img.crop(bb)


# ---------- Rahmen ----------
def frame(img, cols, inset=0):
    """Mehrlagiger 1px-Rahmen. cols: Liste Farben von außen nach innen."""
    d = ImageDraw.Draw(img)
    for i, c in enumerate(cols):
        k = inset + i
        d.rectangle((k, k, W - 1 - k, H - 1 - k), outline=c)
    return img


def bevel_frame(img, outer, light, mid, dark, inner, width=6):
    """Rahmen mit Licht oben/links und Schatten unten/rechts."""
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, W - 1, H - 1), outline=outer)
    for k in range(1, width - 1):
        d.rectangle((k, k, W - 1 - k, H - 1 - k), outline=mid)
    # Lichtkante
    d.line((1, 1, W - 2, 1), fill=light); d.line((1, 1, 1, H - 2), fill=light)
    d.line((1, H - 2, W - 2, H - 2), fill=dark); d.line((W - 2, 1, W - 2, H - 2), fill=dark)
    k = width - 1
    d.rectangle((k, k, W - 1 - k, H - 1 - k), outline=inner)
    return img


def rect_mask_outside(img, x0, y0, x1, y1):
    m = Image.new('L', (W, H), 255)
    ImageDraw.Draw(m).rectangle((x0, y0, x1, y1), fill=0)
    return m


def stars(img, n, cols, seed=1, box=None, big=0.1):
    r = random.Random(seed)
    d = ImageDraw.Draw(img)
    x0, y0, x1, y1 = box or (0, 0, W, H)
    for _ in range(n):
        x, y = r.randrange(x0, x1), r.randrange(y0, y1)
        c = r.choice(cols)
        if r.random() < big:
            d.point([(x, y), (x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)], fill=c)
        else:
            d.point((x, y), fill=c)
    return img


def heart_mask(w, h):
    """Pixelherz als Bool-Array (h, w)."""
    yy, xx = np.mgrid[0:h, 0:w]
    x = (xx + 0.5) / w * 2.6 - 1.3
    y = 1.25 - (yy + 0.5) / h * 2.5
    return (x * x + y * y - 1) ** 3 - x * x * y ** 3 <= 0


def heart(w, h, fill, edge=None, light=None):
    m = heart_mask(w, h)
    out = np.zeros((h, w, 4), np.uint8)
    out[m] = fill
    im = Image.fromarray(out, 'RGBA')
    if light:
        # Glanzpunkt oben links
        d = ImageDraw.Draw(im)
        d.rectangle((w * 0.2, h * 0.18, w * 0.2 + max(1, w // 8), h * 0.18 + max(1, h // 10)), fill=light)
    if edge:
        im = outline(im, edge)
    return im


def mirror_left(img, axis):
    """Linke Hälfte bis axis spiegeln -> symmetrisch."""
    left = img.crop((0, 0, axis, img.height))
    out = Image.new('RGBA', (axis * 2, img.height), (0, 0, 0, 0))
    out.paste(left, (0, 0))
    out.paste(left.transpose(Image.FLIP_LEFT_RIGHT), (axis, 0))
    return out


def cloud(img, cx, cy, r, col, shade, seed=0):
    rnd = random.Random(seed)
    d = ImageDraw.Draw(img)
    blobs = [(cx + rnd.randint(-r, r), cy + rnd.randint(-r // 3, r // 4), rnd.randint(r // 2, r)) for _ in range(6)]
    for (x, y, rr) in blobs:
        d.ellipse((x - rr, y - rr + 2, x + rr, y + rr + 2), fill=shade)
    for (x, y, rr) in blobs:
        d.ellipse((x - rr, y - rr, x + rr, y + rr), fill=col)


def _grid(arr, P):
    idx = np.arange(len(arr))
    c = (arr * np.exp(2j * np.pi * idx / P)).sum()
    xe = (np.angle(c) * P / (2 * np.pi)) % P + 0.5
    return xe


def native(name, full=None):
    """Kartenbild auf native Pixelauflösung (~76x51) zurückrechnen."""
    img = full if full is not None else art(name)
    a = np.array(img.convert('RGB')).astype(float)
    L = a.mean(2)
    dx = np.abs(np.diff(L, axis=1)).sum(0)
    dy = np.abs(np.diff(L, axis=0)).sum(1)
    best = {}
    for ax, arr, rng in (('x', dx, np.arange(7.6, 8.4, 0.01)), ('y', dy, np.arange(7.5, 8.2, 0.01))):
        idx = np.arange(len(arr))
        sc = [abs((arr * np.exp(2j * np.pi * idx / P)).sum()) for P in rng]
        P = rng[int(np.argmax(sc))]
        best[ax] = (P, _grid(arr, P))
    Px, ex = best['x']; Py, ey = best['y']
    xs = np.arange(ex + Px / 2 - Px, a.shape[1], Px); xs = xs[(xs >= 0) & (xs < a.shape[1] - 0.5)]
    ys = np.arange(ey + Py / 2 - Py, a.shape[0], Py); ys = ys[(ys >= 0) & (ys < a.shape[0] - 0.5)]
    xi = np.round(xs).astype(int); yi = np.round(ys).astype(int)
    # Median aus 3x3 um die Mitte
    out = np.zeros((len(yi), len(xi), 3))
    stack = []
    for oy in (-1, 0, 1):
        for ox in (-1, 0, 1):
            stack.append(a[np.clip(yi + oy, 0, a.shape[0] - 1)][:, np.clip(xi + ox, 0, a.shape[1] - 1)])
    out = np.median(np.stack(stack), 0)
    return Image.fromarray(out.astype(np.uint8), 'RGB').convert('RGBA')


def up(img, k):
    return img.resize((img.width * k, img.height * k), Image.NEAREST)


def cut_native(nv, box, barrier_lum=60, seeds=None, extra=None, sat_max=None):
    """Sprite aus nativem Bild: Hintergrund = von Rand erreichbare helle Pixel (Umrisse sind Barriere)."""
    c = nv.crop(box)
    a = np.array(c).astype(int)
    L = a[..., :3].mean(2)
    free = L > barrier_lum
    if sat_max is not None:
        sat = (a[..., :3].max(2) - a[..., :3].min(2)) / np.maximum(a[..., :3].max(2), 1)
        free &= sat <= sat_max
    if extra is not None:
        free = free | extra(a)
    lab, k = ndimage.label(free, structure=[[0, 1, 0], [1, 1, 1], [0, 1, 0]])
    if seeds is None:
        ids = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    else:
        ids = {lab[y, x] for x, y in seeds} - {0}
    bg = np.isin(lab, list(ids))
    a8 = np.array(c)
    a8[..., 3] = np.where(bg, 0, 255)
    return Image.fromarray(a8, 'RGBA')


def preview(img, k=8, bg=(0, 110, 110, 255), name='t_prev.png'):
    b = Image.new('RGBA', img.size, bg); b.alpha_composite(img)
    up(b, k).save(os.path.join(TMP, name))


def cut_by(nv, box, is_bg, seeds=None):
    """Hintergrund = von Rand (oder seeds) erreichbare Pixel mit is_bg(a)->bool."""
    c = nv.crop(box)
    a = np.array(c).astype(int)
    free = is_bg(a)
    lab, k = ndimage.label(free, structure=[[0, 1, 0], [1, 1, 1], [0, 1, 0]])
    if seeds is None:
        ids = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    else:
        ids = {lab[y, x] for x, y in seeds} - {0}
    bg = np.isin(lab, list(ids))
    a8 = np.array(c)
    a8[..., 3] = np.where(bg, 0, 255)
    return Image.fromarray(a8, 'RGBA')


def moon(r, p, lit=(242, 236, 196), lit2=(214, 206, 160), dark=(34, 38, 76), rim=(78, 84, 140), craters=True, seed=1):
    """Pixel-Mond mit Phase p (0=Neumond, 0.5=Vollmond)."""
    s = 2 * r + 1
    yy, xx = np.mgrid[0:s, 0:s]
    nx = (xx - r) / (r + 0.5); ny = (yy - r) / (r + 0.5)
    inside = nx * nx + ny * ny <= 1
    rt = np.sqrt(np.clip(1 - ny * ny, 0, 1))
    c = math.cos(2 * math.pi * p)
    if p <= 0.5:
        L = nx > c * rt
    else:
        L = nx < -c * rt
    out = np.zeros((s, s, 4), np.uint8)
    out[inside] = dark + (255,)
    out[inside & L] = lit + (255,)
    # Schattierung am Rand des beleuchteten Teils
    shade = inside & L & (nx * nx + ny * ny > 0.72) & (nx + ny > 0.2)
    out[shade] = lit2 + (255,)
    if craters:
        rnd = random.Random(seed)
        for _ in range(max(2, r // 3)):
            cx, cy, cr = rnd.uniform(-0.6, 0.6), rnd.uniform(-0.6, 0.6), rnd.uniform(0.08, 0.2)
            cm = inside & L & ((nx - cx) ** 2 + (ny - cy) ** 2 <= cr * cr)
            out[cm] = lit2 + (255,)
    im = Image.fromarray(out, 'RGBA')
    edge = inside & ~ndimage.binary_erosion(inside)
    a = np.array(im); a[edge & ~L] = rim + (255,)
    return Image.fromarray(a, 'RGBA')


def sparkle(d, x, y, size, col, core=(255, 255, 255)):
    for i in range(1, size + 1):
        d.point([(x + i, y), (x - i, y), (x, y + i), (x, y - i)], fill=col)
    if size >= 3:
        d.point([(x + 1, y + 1), (x - 1, y - 1), (x + 1, y - 1), (x - 1, y + 1)], fill=col)
    d.point((x, y), fill=core)


def egg_mask(w, h, cx, cy, rx, ry, top_narrow=0.18):
    yy, xx = np.mgrid[0:h, 0:w]
    ny = (yy - cy) / ry
    rxx = rx * (1 - top_narrow * np.clip(-ny, 0, 1))  # oben schmaler
    return ((xx - cx) / rxx) ** 2 + ny ** 2 <= 1


def value_noise(w, h, scale, seed=0, octaves=3):
    rnd = np.random.RandomState(seed)
    out = np.zeros((h, w))
    amp = 1.0; tot = 0
    for o in range(octaves):
        s = max(1, int(scale / (2 ** o)))
        gw, gh = w // s + 2, h // s + 2
        g = rnd.rand(gh, gw)
        im = Image.fromarray((g * 255).astype(np.uint8)).resize((gw * s, gh * s), Image.BICUBIC)
        out += np.array(im)[:h, :w] / 255 * amp
        tot += amp; amp *= 0.5
    return out / tot


def draw_egg(w, h, outline_c, tones, light=(1.0,), seed=0, sx=8, sy=6):
    """Drachenei mit Schuppenmuster. tones: 3 Farben (dunkel->hell) pro Schuppe."""
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rows = list(range(-1, h // sy + 2))
    for j in reversed(rows):
        off = (sx // 2) if j % 2 else 0
        for i in range(-1, w // sx + 2):
            cx = i * sx + off; cy = j * sy
            r = sx * 0.62
            box = (cx - r, cy - r * 1.25, cx + r, cy + r * 1.1)
            d.ellipse(box, fill=tones[0], outline=outline_c)
            d.ellipse((cx - r + 2, cy - r * 1.25 + 3, cx + r - 2, cy + r * 1.1 - 1), fill=tones[1])
            d.ellipse((cx - r + 3, cy + 0, cx + r - 3, cy + r * 1.1 - 2), fill=tones[2])
    a = np.array(img).astype(float)
    m = egg_mask(w, h, (w - 1) / 2, (h - 1) / 2 + 2, w / 2 - 0.5, h / 2 - 1.5, 0.2)
    # Kugelschattierung: hell oben links, dunkel unten rechts
    yy, xx = np.mgrid[0:h, 0:w]
    nx = (xx - w * 0.36) / (w / 2); ny = (yy - h * 0.32) / (h / 2)
    lam = np.clip(1.15 - 0.45 * np.hypot(nx, ny), 0.45, 1.15)
    q = np.round(lam * 4) / 4
    a[..., :3] = np.clip(a[..., :3] * q[..., None], 0, 255)
    a[..., 3] = np.where(m, 255, 0)
    img = Image.fromarray(a.astype(np.uint8), 'RGBA')
    img = outline(img, outline_c + (255,) if len(outline_c) == 3 else outline_c)
    return img


def draw_egg2(w, h, pal, sx=10, sy=8):
    """pal: 6 Farben: [Umriss, t0 (dunkel) ... t4 (hell)]. Spitze Drachenschuppen."""
    idx = Image.new('L', (w, h), 2)
    d = ImageDraw.Draw(idx)
    for j in reversed(range(-2, h // sy + 3)):
        off = (sx // 2) if j % 2 else 0
        for i in range(-1, w // sx + 2):
            cx = i * sx + off; cy = j * sy
            hw = sx / 2 + 0.5
            poly = [(cx - hw, cy - sy), (cx + hw, cy - sy), (cx + hw, cy), (cx, cy + sy * 0.9), (cx - hw, cy)]
            d.polygon(poly, fill=0)
            inner = [(cx - hw + 1.5, cy - sy + 1), (cx + hw - 1.5, cy - sy + 1), (cx + hw - 1.5, cy - 0.5), (cx, cy + sy * 0.9 - 2), (cx - hw + 1.5, cy - 0.5)]
            d.polygon(inner, fill=2)
            d.polygon([(cx - hw + 2.5, cy - 1), (cx + hw - 2.5, cy - 1), (cx, cy + sy * 0.9 - 3)], fill=3)
            d.line((cx - hw + 2, cy - sy + 1, cx + hw - 2, cy - sy + 1), fill=1)
    t = np.array(idx).astype(int)
    yy, xx = np.mgrid[0:h, 0:w]
    nx = (xx - w * 0.34) / (w / 2); ny = (yy - h * 0.3) / (h / 2)
    r = np.hypot(nx, ny)
    shift = np.where(r < 0.55, 1, np.where(r < 1.05, 0, np.where(r < 1.5, -1, -2)))
    tone = np.where(t == 0, 0, np.clip(t + shift, 1, 5))
    P = np.array(pal)
    rgb = P[tone]
    m = egg_mask(w, h, (w - 1) / 2, (h - 1) / 2 + 2, w / 2 - 0.5, h / 2 - 1.5, 0.2)
    out = np.dstack([rgb, np.where(m, 255, 0)]).astype(np.uint8)
    img = Image.fromarray(out, 'RGBA')
    return outline(img, tuple(pal[0]) + (255,))


def draw_egg3(w, h, pal, sx=10, sy=6, r=6.2):
    """Runde Fischschuppen (nach unten zeigend). pal: [Umriss, t1..t5]."""
    tone = np.full((h, w), 3, int)
    yy, xx = np.mgrid[0:h, 0:w]
    for j in reversed(range(-2, h // sy + 3)):
        off = (sx / 2) if j % 2 else 0
        for i in range(-1, int(w / sx) + 2):
            cx = i * sx + off; cy = j * sy
            dd = np.hypot(xx - cx, (yy - cy) * 1.0)
            m = dd <= r
            if not m.any():
                continue
            rel = (yy - cy) / r  # -1 oben .. 1 unten
            t = np.where(rel < -0.2, 1, np.where(rel < 0.35, 2, np.where(rel < 0.7, 3, 4)))
            t = np.where(dd > r - 1.2, 0, t)
            tone[m] = t[m]
    nx = (xx - w * 0.34) / (w / 2); ny = (yy - h * 0.3) / (h / 2)
    rr = np.hypot(nx, ny)
    shift = np.where(rr < 0.6, 1, np.where(rr < 1.15, 0, np.where(rr < 1.6, -1, -2)))
    tone = np.where(tone == 0, 0, np.clip(tone + shift, 1, 5))
    rgb = np.array(pal)[tone]
    m = egg_mask(w, h, (w - 1) / 2, (h - 1) / 2 + 2, w / 2 - 0.5, h / 2 - 1.5, 0.2)
    out = np.dstack([rgb, np.where(m, 255, 0)]).astype(np.uint8)
    return outline(Image.fromarray(out, 'RGBA'), tuple(pal[0]) + (255,))


def diff_cut(a_img, b_img, box, sat_thr=0.35, min_size=20):
    """Figur ausschneiden über Unterschied zweier Kartenvarianten (z. B. weiß/schwarz)."""
    a = np.array(a_img).astype(int); b = np.array(b_img).astype(int)
    diff = np.abs(a[..., :3] - b[..., :3]).sum(2) > 40
    sat = (a[..., :3].max(2) - a[..., :3].min(2)) / np.maximum(a[..., :3].max(2), 1) > sat_thr
    m = diff | sat
    bm = np.zeros_like(m); x0, y0, x1, y1 = box; bm[y0:y1, x0:x1] = True; m &= bm
    La = a[..., :3].mean(2); Lb = b[..., :3].mean(2)
    m |= ndimage.binary_dilation(m, iterations=1) & (La < 50) & (Lb < 50) & bm
    m = ndimage.binary_fill_holes(m)
    board = m & ~diff & ~sat & (La > 60)
    m &= ~board
    lab, k = ndimage.label(m); sz = ndimage.sum(m, lab, range(1, k + 1)); m = np.isin(lab, np.where(sz > min_size)[0] + 1)
    outs = []
    for arr in (a, b):
        o = arr.astype(np.uint8).copy(); o[..., 3] = np.where(m, 255, 0)
        im = Image.fromarray(o).crop(box)
        outs.append(im.crop(im.getbbox()))
    return outs


def logo(pal_fn=None):
    """Pixel-Parties-Logo in nativer Auflösung (339x61)."""
    im = Image.open(os.path.join(ROOT, 'data', 'logo.png')).convert('RGBA')
    a = np.array(im)[2::4, 2::4].copy()
    if pal_fn:
        a = pal_fn(a)
    return Image.fromarray(a, 'RGBA')


def save_overlay(img, name, overlays):
    """overlays: Liste (RGBA-Bild in Endauflösung, (x, y))."""
    out = img.convert('RGBA').resize((W * S, H * S), Image.NEAREST)
    for ov, xy in overlays:
        out.alpha_composite(ov, xy)
    p = os.path.join(OUT, name + '.png')
    os.makedirs(OUT, exist_ok=True)
    out.convert('RGB').save(p)
    return p


def scale3x(img):
    """AdvMAME3x/Scale3x: pixelgenaues 3-fach-Upscaling mit geglätteten Diagonalen."""
    a = np.array(img.convert('RGBA'))
    h, w = a.shape[:2]
    p = np.pad(a, ((1, 1), (1, 1), (0, 0)), mode='edge')
    key = p[..., 0].astype(np.int64) << 24 | p[..., 1].astype(np.int64) << 16 | p[..., 2].astype(np.int64) << 8 | p[..., 3].astype(np.int64)
    A, B, C = key[:-2, :-2], key[:-2, 1:-1], key[:-2, 2:]
    D, E, F = key[1:-1, :-2], key[1:-1, 1:-1], key[1:-1, 2:]
    G, Hh, I = key[2:, :-2], key[2:, 1:-1], key[2:, 2:]
    cond = (B != Hh) & (D != F)
    out = np.zeros((h * 3, w * 3), np.int64)
    E0 = np.where(cond & (D == B), D, E)
    E1 = np.where(cond & (((D == B) & (E != C)) | ((B == F) & (E != A))), B, E)
    E2 = np.where(cond & (B == F), F, E)
    E3 = np.where(cond & (((D == B) & (E != G)) | ((D == Hh) & (E != A))), D, E)
    E4 = E
    E5 = np.where(cond & (((B == F) & (E != I)) | ((Hh == F) & (E != C))), F, E)
    E6 = np.where(cond & (D == Hh), D, E)
    E7 = np.where(cond & (((D == Hh) & (E != I)) | ((Hh == F) & (E != G))), Hh, E)
    E8 = np.where(cond & (Hh == F), F, E)
    for i, Ei in enumerate([E0, E1, E2, E3, E4, E5, E6, E7, E8]):
        out[i // 3::3, i % 3::3] = Ei
    res = np.stack([(out >> 24) & 255, (out >> 16) & 255, (out >> 8) & 255, out & 255], -1).astype(np.uint8)
    return Image.fromarray(res, 'RGBA')
