"""Mary aus dem Karten-Sprite: freistellen, Flügel und Saum im Sprite-Stil vervollständigen."""
from lib import *

PADX, PADT, PADB = 2, 9, 6


def mary_native():
    nv = native('Cute Princess Mary').crop((1, 1, 76, 50))
    a = np.array(nv).astype(int)
    h, w = a.shape[:2]
    hsv = np.array(nv.convert('RGB').convert('HSV')).astype(float)
    hh = hsv[..., 0] * 360 / 255; ss = hsv[..., 1] / 255; vv = hsv[..., 2] / 255
    lum = a[..., :3].mean(2)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    fg = (b < 95) | ((g > 190) & (b > 140)) | ((b > r) & (g > 120))
    fg = ndimage.binary_closing(np.pad(fg, 2, mode='edge'), iterations=1)[2:-2, 2:-2]
    fg = ndimage.binary_fill_holes(fg)
    lab, k = ndimage.label(fg); sz = ndimage.sum(fg, lab, range(1, k + 1)); fg = lab == (np.argmax(sz) + 1)
    # Spiegelachse: Gesicht mittig zwischen x=37 und 38
    ax = 37
    left = a[:, :ax].copy(); lm = fg[:, :ax].copy()
    full = np.concatenate([left, left[:, ::-1]], 1)
    fm = np.concatenate([lm, lm[:, ::-1]], 1)
    full[..., 3] = np.where(fm, 255, 0)
    return full.astype(np.uint8), fm


def extend(full, fm):
    h, w = fm.shape
    H2, W2 = h + PADT + PADB, w + 2 * PADX
    out = np.zeros((H2, W2, 4), np.uint8)
    m = np.zeros((H2, W2), bool)
    out[PADT:PADT + h, PADX:PADX + w] = full
    m[PADT:PADT + h, PADX:PADX + w] = fm
    src = out.copy(); srcm = m.copy()
    P = 4  # vertikale Periode der Federbänder
    # nach oben fortsetzen (nur im Flügelbereich, oben abgeschnitten)
    for y in range(PADT - 1, -1, -1):
        for x in range(W2):
            ys = y + P
            if srcm[ys, x]:
                out[y, x] = out[ys, x]; m[y, x] = True
                srcm[y, x] = True
    # seitlich fortsetzen
    Q = 5
    for x in list(range(PADX - 1, -1, -1)):
        for y in range(H2):
            if m[y, x + Q] and not m[y, x]:
                out[y, x] = out[y, x + Q]; m[y, x] = True
    for x in range(PADX + w, W2):
        for y in range(H2):
            if m[y, x - Q] and not m[y, x]:
                out[y, x] = out[y, x - Q]; m[y, x] = True
    return out, m


def silhouette_clip(out, m, poly_left):
    """Flügelsilhouette: Polygon (für linke Hälfte, gespiegelt rechts) begrenzt die ergänzten Bereiche."""
    H2, W2 = m.shape
    mk = Image.new('L', (W2, H2), 0)
    d = ImageDraw.Draw(mk)
    d.polygon(poly_left, fill=255)
    d.polygon([(W2 - 1 - x, y) for x, y in poly_left], fill=255)
    keep = np.array(mk) > 0
    m2 = m & keep
    out = out.copy(); out[..., 3] = np.where(m2, 255, 0)
    return out, m2


WING_POLY = [(33, 24), (29, 12), (23, 5), (15, 1), (8, 1), (3, 4), (0, 9), (0, 30), (3, 38), (7, 44), (13, 48),
             (20, 52), (26, 56), (31, 60), (36, 63), (39, 63), (39, 24)]
DARK = (112, 32, 14, 255)


def mary_full():
    full, fm = mary_native()
    out, m = extend(full, fm)
    orig = np.zeros(m.shape, bool); orig[PADT:PADT + fm.shape[0], PADX:PADX + fm.shape[1]] = True
    out, m = silhouette_clip(out, m, WING_POLY)
    synth = m & ~orig
    edge = m & ~ndimage.binary_erosion(m)
    out[edge & synth] = DARK
    return Image.fromarray(out)


def mary_posed():
    """Details wie bei einem Animationsframe: Saum schließen, Augen fröhlich geschlossen, Magenta-Reste weg."""
    a = np.array(mary_full()).astype(int)
    al = a[..., 3] > 0
    mag = al & (a[..., 0] > 200) & (a[..., 2] > 140) & (a[..., 1] < 140)
    a[mag, 3] = 0
    # Saum: Zeilen 58-61
    cx = a.shape[1] // 2
    for i, y in enumerate(range(58, 61)):
        src = a[53 + (i % 2)].copy()
        hw = 8 - i
        a[y, :, 3] = 0
        a[y, cx - hw:cx + hw] = src[cx - hw:cx + hw]
        a[y, cx - hw - 1] = DARK; a[y, cx + hw] = DARK
    a[61, :, 3] = 0
    a[61, cx - 6:cx + 6] = DARK
    # Augen: geschlossen (obere Augenzeile -> Haut, untere -> dunkelbrauner Lidstrich)
    L = a[..., :3].mean(2)
    box = np.zeros(L.shape, bool); box[27:35, 32:46] = True
    eye = box & (L < 22) & (a[..., 3] > 0)
    skin = a[33, a.shape[1] // 2].copy()
    lab, n = ndimage.label(eye)
    for sl in ndimage.find_objects(lab):
        ys, xs = sl
        for y in range(ys.start, ys.stop):
            for x in range(xs.start, xs.stop):
                if eye[y, x]:
                    a[y, x] = skin if y < ys.stop - 1 else (110, 50, 36, 255)
        # Lidstrich leicht nach unten gebogen (fröhlich)
        a[ys.stop - 1, xs.start - 1] = (110, 50, 36, 255) if a[ys.stop - 1, xs.start - 1, 3] else a[ys.stop - 1, xs.start - 1]
    # Rouge

    return Image.fromarray(a.clip(0, 255).astype(np.uint8))


def phoenix_native():
    nv = native('Cute Phoenix'); a = np.array(nv).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    L = a[..., :3].mean(2)
    fg = ((g < 88) & (r > 150)) | ((b < 48) & (r > 200)) | ((L > 200) & (b < 170) & (r > 230))
    box = np.zeros_like(fg); box[4:44, 21:56] = True; fg &= box
    fg = ndimage.binary_closing(np.pad(fg, 2, mode='edge'), iterations=1)[2:-2, 2:-2] & box
    lab, k = ndimage.label(fg); sz = ndimage.sum(fg, lab, range(1, k + 1)); fg = lab == (np.argmax(sz) + 1)
    fg = ndimage.binary_fill_holes(fg)
    # obere Flammen züngelnd ausblenden: nur helle/rote Flammenpixel in den oberen Zeilen
    yy, xx = np.mgrid[0:fg.shape[0], 0:fg.shape[1]]
    top = yy < 16
    flame = (r > 200) & ((g > 140) | (g < 70))
    fg &= ~top | (flame & (yy > 4 + 6 * (((xx * 7) % 5) / 5.0)))
    brown = (r < 215) & (g > 60) & (g < 125) & (b < 100)
    fg &= ~(brown & (yy > 30))
    o = np.array(nv); o[..., 3] = np.where(fg, 255, 0)
    im = Image.fromarray(o).crop((21, 4, 56, 44))
    im = im.crop(im.getbbox())
    # Flammenspur nach oben spitz zulaufen lassen (Tropfenform), Pixel bleiben original
    pa = np.array(im)
    h_, w_ = pa.shape[:2]
    c_ = (w_ - 1) / 2
    rnd = random.Random(5)
    for y in range(h_):
        t = y / (h_ - 1)
        hw = 2 + (w_ / 2 - 1) * min(1.0, (t / 0.78)) ** 1.6 + rnd.choice([-1, 0, 0, 1])
        for x in range(w_):
            if abs(x - c_) > hw:
                pa[y, x, 3] = 0
    return Image.fromarray(pa)
