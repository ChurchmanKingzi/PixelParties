#!/usr/bin/env python3
"""Logo-Entwürfe mit Monia: Logo (transparent) und Profilbilder für Instagram.

    python3 scripts/social-posts/make-logo.py

Ergebnis in scripts/social-posts/out/branding/:
    logo-monia.png            Logo mit Schriftband, transparenter Hintergrund
    logo-monia-dunkel.png     dasselbe auf dunklem Grund (zur Ansicht)
    profil-monia-logo.png     Profilbild 1080×1080 mit Schriftband (sicherer Bereich = mittlerer Kreis)
    profil-monia.png          Profilbild 1080×1080, nur Monia und Herz
"""
import importlib.util
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = HERE / 'out' / 'branding'

spec = importlib.util.spec_from_file_location('bp', HERE / 'build-post.py')
bp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bp)
import fx  # noqa: E402  (über build-post bereits im Pfad)

ACCENT = (90, 168, 255)          # Akzent von Monia: kühles Blau
INK = (7, 6, 13)
WHITE = (244, 244, 240)
SLUG = 'cool-rescuer-monia'


def mix(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def art_heart():
    """Das große Herz aus der Kartenkunst (data/card-art/native/Cool_Rescuer_Monia.png), Pixel für Pixel. Monia und ihr Jetpack
    verdecken es dort; diese Stellen werden aus den Nachbarpixeln des Herzens aufgefüllt (Diffusion), damit hinter ihr ein ganzes Herz steht."""
    art = np.asarray(Image.open(ROOT / 'data' / 'card-art' / 'native' / 'Cool_Rescuer_Monia.png').convert('RGB')).astype(np.int32)
    h, w, _ = art.shape
    r, g, b = art[..., 0], art[..., 1], art[..., 2]
    pink = (r > 130) & (b > g + 10) & (r > b + 30)                       # rosa (Flammen, Haut, Haare haben b ≈ g oder b < g)
    # größte zusammenhängende Fläche = das große Herz (die kleinen Herzen fallen heraus)
    seen = np.zeros_like(pink)
    best = []
    for y0 in range(h):
        for x0 in range(w):
            if pink[y0, x0] and not seen[y0, x0]:
                comp, st = [], [(y0, x0)]
                seen[y0, x0] = True
                while st:
                    y, x = st.pop()
                    comp.append((y, x))
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        yy, xx = y + dy, x + dx
                        if 0 <= yy < h and 0 <= xx < w and pink[yy, xx] and not seen[yy, xx]:
                            seen[yy, xx] = True
                            st.append((yy, xx))
                if len(comp) > len(best):
                    best = comp
    mask = np.zeros_like(pink)
    for y, x in best:
        mask[y, x] = True
    # Löcher = Nicht-Rosa, das vom Bildrand aus nicht erreichbar ist (Monia, Jetpack): die Kerbe oben zwischen den Herzlappen ist
    # dagegen mit dem Himmel verbunden und bleibt leer
    exterior = np.zeros_like(pink)
    st = [(y, x) for y in range(h) for x in range(w) if (y in (0, h - 1) or x in (0, w - 1)) and not pink[y, x]]
    for y, x in st:
        exterior[y, x] = True
    while st:
        y, x = st.pop()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            yy, xx = y + dy, x + dx
            if 0 <= yy < h and 0 <= xx < w and not pink[yy, xx] and not exterior[yy, xx]:
                exterior[yy, xx] = True
                st.append((yy, xx))
    ys0, xs0 = np.where(mask)
    box = np.zeros_like(mask)
    box[ys0.min():ys0.max() + 1, xs0.min():xs0.max() + 1] = True
    hole = ~pink & ~exterior & box
    # Ausreißer unter den Herzpixeln (Flammenreste): nicht in der Palette des Herzens → auch als Loch behandeln
    from collections import Counter
    cols = Counter(tuple(art[y, x]) for y, x in zip(*np.where(mask)))
    palette = np.array([c for c, _ in cols.most_common(9)])
    dist = np.sqrt(((art[..., None, :] - palette[None, None]) ** 2).sum(-1)).min(-1)
    outlier = mask & (dist > 45)
    hole = hole | outlier
    mask = mask & ~outlier
    sil = mask | hole
    img = art.astype(np.float32)
    for _ in range(400):                                                # Löcher aus den Rändern heraus weichzeichnen
        pad = np.pad(img, ((1, 1), (1, 1), (0, 0)), mode='edge')
        avg = (pad[:-2, 1:-1] + pad[2:, 1:-1] + pad[1:-1, :-2] + pad[1:-1, 2:]) / 4
        img = np.where(hole[..., None], avg, img)
    # aufgefüllte Stellen auf die Palette des Herzens einrasten lassen (Pixel-Look statt Weichzeichner)
    flat = img[hole]
    if len(flat):
        d2 = ((flat[:, None, :] - palette[None]) ** 2).sum(-1)
        img[hole] = palette[d2.argmin(axis=1)]
    ys, xs = np.where(sil)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    out = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
    out[..., :3] = np.clip(img[y0:y1, x0:x1], 0, 255).astype(np.uint8)
    out[..., 3] = sil[y0:y1, x0:x1] * 255
    return Image.fromarray(out, 'RGBA')


def heart_layer(cell, w=46, h=42):
    """Das Herz aus der Karte, jeder Kunstpixel = cell Bildpunkte."""
    ah = art_heart()
    return ah.resize((ah.width * cell, ah.height * cell), Image.NEAREST)


def heart_layer_old(cell, w=46, h=42):
    """Großes Pixel-Herz mit Kontur, Licht oben links und Schatten unten rechts."""
    cells = {}
    for j in range(h):
        for i in range(w):
            x = (i + 0.5 - w / 2) / (w / 2) * 1.22
            y = -(j + 0.5 - h / 2) / (h / 2) * 1.22 + 0.12
            if (x * x + y * y - 1) ** 3 - x * x * y ** 3 <= 0:
                cells[(i, j)] = (x, y)
    outline = (118, 20, 70)
    dark, main, light, hi = (206, 62, 118), (255, 108, 160), (255, 162, 198), (255, 228, 242)
    im = Image.new('RGBA', (w * cell, h * cell), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for (i, j), (x, y) in cells.items():
        edge = any((i + dx, j + dy) not in cells for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        lit = -x * 0.55 + y * 0.8                              # > 0: Licht (oben links)
        if edge:
            col = outline
        elif math.hypot(x + 0.5, y - 0.5) < 0.16:
            col = hi
        elif lit > 0.55:
            col = light
        elif lit > -0.35:
            col = main
        else:
            col = dark
        d.rectangle([i * cell, j * cell, i * cell + cell - 1, j * cell + cell - 1], fill=col + (255,))
    return im


def flat_cloud(cell, width, height, seed=1):
    """Wolke mit flachem Boden: Kuppen aus Kreisen, unten abgeschnitten, Kontur, Licht oben, Schatten unten."""
    import random
    rnd = random.Random(seed)
    w, h = width, height
    cells = set()
    n = max(3, w // 6)
    for k in range(n):
        cx = (k + 0.5) / n * w
        r = rnd.uniform(0.28, 0.5) * h * (1.0 if 0 < k < n - 1 else 0.7) + 1
        cy = h - r * rnd.uniform(0.55, 0.85)
        for j in range(h):
            for i in range(w):
                if (i + 0.5 - cx) ** 2 + (j + 0.5 - cy) ** 2 <= r * r and j < h - 1:
                    cells.add((i, j))
    for i in range(w):                                    # flacher Boden
        for j in range(h - 3, h - 1):
            if any((i + dx, j) in cells for dx in (-3, 0, 3)):
                cells.add((i, j))
    out, main, shade, hi = (86, 124, 206), (226, 238, 255), (176, 204, 246), (255, 255, 255)
    im = Image.new('RGBA', (w * cell, h * cell), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for (i, j) in cells:
        edge = any((i + dx, j + dy) not in cells for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        col = out if edge else (hi if j < h * 0.35 and (i + j) % 5 == 0 and False else (shade if j > h * 0.72 else main))
        if not edge and j < h * 0.45 and (i * 7 + j * 3) % 11 == 0:
            col = hi
        d.rectangle([i * cell, j * cell, i * cell + cell - 1, j * cell + cell - 1], fill=col + (255,))
    return im


def stamp_layer(stamp, pal, cell, zoom=1):
    st = fx.zoom(stamp, zoom)
    xs = [k[0] for k in st]
    ys = [k[1] for k in st]
    x0, y0 = min(xs), min(ys)
    w, h = max(xs) - x0 + 1, max(ys) - y0 + 1
    im = Image.new('RGBA', (w * cell, h * cell), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for (i, j), idx in st.items():
        d.rectangle([(i - x0) * cell, (j - y0) * cell, (i - x0) * cell + cell - 1, (j - y0) * cell + cell - 1], fill=pal[idx] + (255,))
    return im, (-x0 * cell, -y0 * cell)          # Bild und Lage des Mittelpunkts darin


def put(canvas, im, cx, cy, anchor=None):
    ox, oy = anchor if anchor else (im.width // 2, im.height // 2)
    canvas.alpha_composite(im, (int(cx - ox), int(cy - oy)))


def wordmark(scale):
    """Das Schriftband aus dem Spiel (data/logo.png), in Akzentfarbe, ganzzahlig skaliert (Logo-Pixel = 4 px in der Datei)."""
    big = bp.tinted_logo(ACCENT, scale_div=1)                      # 1356×244 = 339×61 Logo-Pixel
    small = big.resize((big.width // 4, big.height // 4), Image.NEAREST)
    return small.resize((small.width * scale, small.height * scale), Image.NEAREST)


def monia(px, frame=10):
    spr = bp.Sprite(SLUG)
    spr.px = px
    o_dark, o_light, sp, pad = spr.layers(frame, mix(WHITE, ACCENT, 0.25), INK)
    im = Image.new('RGBA', sp.size, (0, 0, 0, 0))
    for layer in (o_dark, o_light, sp):
        im.alpha_composite(layer)
    # Mitte zwischen den Augen (faceX) und Fußlinie
    return im, (pad + spr.meta['faceX'] * px, pad + spr.bottom * px)


def scene(size, px, wm_scale, heart_cell, with_wordmark=True, wm_y=None, monia_cy=None, glints=True, spread=1.0):
    """Monia vor ihrem großen Herz, Wolken, Glitzer; optional das Schriftband darunter (vor der Herzspitze)."""
    W, H = size
    cv = Image.new('RGBA', size, (0, 0, 0, 0))
    cx = W // 2
    m_im, (fx_, foot) = monia(px)
    heart = heart_layer(heart_cell)
    my = monia_cy if monia_cy is not None else int(H * 0.40)
    hcy = my + int(heart.height * 0.10)
    put(cv, heart, cx, hcy)                                           # Herz hinter ihr
    cu = max(6, heart_cell // 2)                                      # Zellgröße der Wolken
    for (dx, dy, wc, hc, sd) in ((-0.50, 0.33, 30, 13, 3), (0.50, 0.37, 32, 14, 5)):
        cl = flat_cloud(cu, wc, hc, sd)
        put(cv, cl, cx + dx * spread * heart.width, hcy + dy * heart.height)
    if glints:
        for (dx, dy, kind, fr) in ((-0.60, -0.34, 'starglint', 0), (0.58, -0.40, 'starglint', 1), (-0.66, 0.06, 'heart', 0),
                                   (0.68, 0.02, 'heart', 0)):
            if kind == 'starglint':
                st, an = stamp_layer(fx.glyph_stamp('starglint', fr), fx.PAL['glint'], 12, 2)
            else:
                st, an = stamp_layer(fx.heart_stamp(), fx.PAL['heal'], 12, 1)
            put(cv, st, cx + dx * spread * heart.width, hcy + dy * heart.height, an)
    cv.alpha_composite(m_im, (int(cx - fx_), int(my - m_im.height * 0.52)))
    if with_wordmark:
        wm = wordmark(wm_scale)
        put(cv, wm, cx, wm_y if wm_y is not None else int(H * 0.84))
    return cv


def dark_background(size):
    """Dunkelblauer Dithering-Verlauf mit Sternen (wie in den Reels), für Profilbilder."""
    W, H = size
    ramp = [mix((14, 10, 28), (60, 120, 200), t) for t in (0.04, 0.14, 0.27, 0.42, 0.58, 0.78)]
    cell = 12
    ch, cw = -(-H // cell), -(-W // cell)
    ys = (np.arange(ch) * cell + cell / 2)[:, None]
    xs = (np.arange(cw) * cell + cell / 2)[None, :]
    d = np.sqrt(((xs - W / 2) / (W * 0.62)) ** 2 + ((ys - H * 0.46) / (H * 0.62)) ** 2)
    v = 0.06 + 0.62 * np.clip(1 - d, 0, 1) ** 1.2
    th = np.tile(fx.__dict__['BAYER4'] if 'BAYER4' in fx.__dict__ else bp.BAYER4, (ch // 4 + 1, cw // 4 + 1))[:ch, :cw]
    n = len(ramp) - 1
    q = np.clip(np.floor(np.clip(v, 0, 1) * n + th), 0, n).astype(int)
    img = np.repeat(np.repeat(np.array(ramp, dtype=np.uint8)[q], cell, axis=0), cell, axis=1)[:H, :W]
    im = Image.fromarray(img, 'RGB').convert('RGBA')
    rnd = np.random.default_rng(3)
    dd = ImageDraw.Draw(im)
    for _ in range(60):
        x, y = int(rnd.integers(0, cw)) * cell, int(rnd.integers(0, ch)) * cell
        dd.rectangle([x, y, x + cell // 2 - 1, y + cell // 2 - 1], fill=(220, 235, 255, 255) if rnd.random() < 0.4 else (110, 170, 240, 255))
    return im


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    # 1) Logo, transparent: Monia (16 px je Sprite-Pixel) vor dem Herz, Schriftband 3 px je Logo-Pixel
    logo = scene((1400, 1200), px=16, wm_scale=3, heart_cell=16, wm_y=940, monia_cy=420)
    bbox = logo.getbbox()
    logo = logo.crop((max(0, bbox[0] - 40), max(0, bbox[1] - 40), min(logo.width, bbox[2] + 40), min(logo.height, bbox[3] + 40)))
    logo.save(OUT / 'logo-monia.png')
    dark = dark_background(logo.size)
    dark.alpha_composite(logo)
    dark.convert('RGB').save(OUT / 'logo-monia-dunkel.png')

    # 2) Profilbilder 1080×1080 (Instagram schneidet einen Kreis aus: alles Wichtige in den mittleren ~900 px)
    bg = dark_background((1080, 1080))
    a = bg.copy()
    a.alpha_composite(scene((1080, 1080), px=12, wm_scale=3, heart_cell=12, wm_y=780, monia_cy=345, glints=True, spread=0.9))
    a.convert('RGB').save(OUT / 'profil-monia-logo.png')
    b = bg.copy()
    b.alpha_composite(scene((1080, 1080), px=18, wm_scale=2, heart_cell=15, with_wordmark=False, monia_cy=470, glints=True, spread=0.66))
    b.convert('RGB').save(OUT / 'profil-monia.png')
    print('fertig:', OUT)


if __name__ == '__main__':
    main()
