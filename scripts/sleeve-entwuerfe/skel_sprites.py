from lib import *


def _bg(a, satm=0.28, Lm=150):
    L = a[..., :3].mean(2); mx = a[..., :3].max(2); mn = a[..., :3].min(2); sat = (mx - mn) / np.maximum(mx, 1)
    return (sat < satm) & (L < Lm)


def minions():
    nv = native('Raise the Minions!')
    out = []
    for i, box in enumerate([(8, 2, 27, 30), (27, 2, 46, 30), (46, 2, 66, 30)]):
        def bgf(a, i=i):
            redglow = (a[..., 0] > a[..., 1] + 25) & (a[..., 0] < 200) & (a[..., 1] < 110)
            return _bg(a) | (redglow if i == 2 else False)
        s = keep_largest(cut_by(nv, box, bgf))
        s = s.crop(s.getbbox())
        if i == 1:  # Hintergrundreste rechts oben entfernen
            a = np.array(s); a[:10, 16:, 3] = 0; s = Image.fromarray(a); s = s.crop(s.getbbox())
        out.append(s)
    return out


def bard():
    nb = native('Skeleton Bard')
    # Körper per Umriss-Barriere, Hut + Feder + Lautenhals ergänzt
    return _fcut(nb, (26, 16, 52, 48), _notblack(12), add=[(35, 22, 41, 26), (32, 25, 45, 30), (31, 26, 32, 29), (41, 21, 43, 25), (45, 25, 51, 30)],
                 rem=[(49, 26, 51, 27)])


def king():
    nk = native('Skeleton King Skullmael')
    return _fcut(nk, (18, 2, 64, 25), _grey(64, 135, 70))


def notes():
    nb = native('Skeleton Bard')
    a = np.array(nb).astype(int)
    mx = a[..., :3].max(2); mn = a[..., :3].min(2); sat = (mx - mn) / np.maximum(mx, 1)
    L = a[..., :3].mean(2)
    m = (sat > 0.45) & (L > 60)
    m &= ~((a[..., 2] > a[..., 1] + 30) & (a[..., 0] > a[..., 1]) & (L < 150) & (sat < 0.6))
    lab, k = ndimage.label(m)
    res = []
    for sl in ndimage.find_objects(lab):
        h = sl[0].stop - sl[0].start; w = sl[1].stop - sl[1].start
        if h >= 5 and w >= 3 and sl[0].start < 26:
            sub = np.array(nb)[sl].copy(); sub[..., 3] = np.where(m[sl], 255, 0)
            res.append(Image.fromarray(sub))
    return res


# ---------------------------------------------------------------------
#  Ausschneide-Werkzeuge für Kartenfiguren (native Auflösung)
# ---------------------------------------------------------------------
def _feats(a):
    a = a.astype(int)
    return a[..., :3].mean(2), a[..., :3].max(2) - a[..., :3].min(2)


def _grey(lo, hi, smax=60):
    def f(a):
        L, s = _feats(a)
        return (L >= lo) & (L <= hi) & (s <= smax)
    return f


def _notblack(th=12, white=150):
    def f(a):
        L, s = _feats(a)
        return (L >= th) & (L <= white)
    return f


def _fcut(nv, box, isbg, keep=1, add=(), rem=(), extra=None):
    """Hintergrund = vom Rand (4er-Nachbarschaft) erreichbare isbg-Pixel."""
    c = nv.crop(box)
    a = np.array(c).astype(int)
    lab, k = ndimage.label(isbg(a), structure=[[0, 1, 0], [1, 1, 1], [0, 1, 0]])
    ids = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    fig = ~np.isin(lab, list(ids))
    for (x0, y0, x1, y1) in add:
        fig[y0 - box[1]:y1 - box[1], x0 - box[0]:x1 - box[0]] = True
    for (x0, y0, x1, y1) in rem:
        fig[y0 - box[1]:y1 - box[1], x0 - box[0]:x1 - box[0]] = False
    if extra is not None:
        fig |= extra(a)
    out = np.array(c); out[..., 3] = np.where(fig, 255, 0)
    img = Image.fromarray(out)
    if keep:
        img = keep_largest(img, keep)
    bb = img.getbbox()
    return img.crop(bb) if bb else img


def _auto(nv, box, tol=40):
    """Hintergrundfarben = Randpixel der Box; Flood-Fill über ähnliche Farben."""
    c = nv.crop(box)
    a = np.array(c).astype(int)[..., :3]
    bm = np.zeros(a.shape[:2], bool); bm[0] = bm[-1] = True; bm[:, 0] = bm[:, -1] = True
    samples = np.unique(a[bm].reshape(-1, 3), axis=0)
    dist = np.min(np.abs(a[:, :, None, :] - samples[None, None]).sum(-1), axis=2)
    isbg = dist <= tol
    lab, k = ndimage.label(isbg, structure=[[0, 1, 0], [1, 1, 1], [0, 1, 0]])
    ids = set(np.unique(lab[bm])) - {0}
    fig = ~np.isin(lab, list(ids))
    lab2, k2 = ndimage.label(isbg & fig)
    for i in range(1, k2 + 1):
        mm = lab2 == i
        if mm.sum() >= 2:
            fig &= ~mm
    out = np.array(c); out[..., 3] = np.where(fig, 255, 0)
    img = keep_largest(Image.fromarray(out))
    return img.crop(img.getbbox())


def winged():
    return _auto(native('Winged Skeleton'), (24, 6, 52, 36), 40)


def burning():
    return _auto(native('Burning Skeleton'), (18, 8, 52, 44), 60)


def priest():
    return _auto(native('Skeleton Priest'), (28, 10, 48, 50), 50)


def treasure():
    return _auto(native('Treasure Skeleton'), (22, 6, 54, 44), 50)


def necromancer():
    return _fcut(native('Skeleton Necromancer'), (24, 0, 52, 50), _grey(55, 170, 45))


def death_knight():
    return _fcut(native('Skeleton Death Knight'), (26, 8, 52, 46), _notblack(4, 90))


def archer_card():
    return _fcut(native('Skeleton Archer'), (14, 6, 44, 36), _notblack(20), rem=[(33, 21, 44, 26)])


def reaper():
    nr = native('Skeleton Reaper')
    box = (28, 8, 62, 50)
    def extra(a):
        L, s = _feats(a)
        yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]] 
        blade = (L > 150)
        handle = (a[..., 0] > a[..., 2] + 12) & (yy + box[1] >= 23) & (yy + box[1] <= 27) & (xx + box[0] >= 42)
        return blade | handle
    return _fcut(nr, box, _grey(33, 150, 45), extra=extra, keep=4)


# ---------------------------------------------------------------------
#  „Animations“-Änderungen an Kartenfiguren (native Auflösung)
# ---------------------------------------------------------------------
OUTL = (26, 14, 12, 255)


def canvas(spr, top=8, side=4, bottom=0):
    out = Image.new('RGBA', (spr.width + 2 * side, spr.height + top + bottom), (0, 0, 0, 0))
    out.alpha_composite(spr, (side, top))
    return out, side, top


def raise_arm(spr, box, lift=None, pivot_dy=0):
    """Arm (box im Sprite) vertikal spiegeln und nach oben klappen -> Arm hoch."""
    x0, y0, x1, y1 = box
    a = np.array(spr)
    part = a[y0:y1, x0:x1].copy()
    a[y0:y1, x0:x1][part[..., 3] > 0] = 0
    part = part[::-1]
    h = y1 - y0
    ny0 = y0 - h + 2 + pivot_dy if lift is None else y0 - lift
    out = Image.fromarray(a)
    pi = Image.fromarray(part)
    out.alpha_composite(pi, (x0, max(0, ny0)))
    return out


def shift(spr, box, dx, dy):
    x0, y0, x1, y1 = box
    a = np.array(spr)
    part = a[y0:y1, x0:x1].copy()
    a[y0:y1, x0:x1][part[..., 3] > 0] = 0
    out = Image.fromarray(a)
    out.alpha_composite(Image.fromarray(part), (x0 + dx, y0 + dy))
    return out


def stamp_rows(spr, rows, x, y, cmap):
    a = np.array(spr)
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch != '.' and 0 <= y + j < a.shape[0] and 0 <= x + i < a.shape[1]:
                a[y + j, x + i] = cmap[ch]
    return Image.fromarray(a)


def head_top(spr):
    a = np.array(spr)[..., 3] > 0
    ys = np.where(a.any(1))[0]
    y0 = ys[0]
    xs = np.where(a[y0:y0 + 3].any(0))[0]
    return int((xs[0] + xs[-1]) / 2), int(y0)


HAT = ["...w...",
       "..oWo..",
       "..oAo..",
       ".oABo..",
       ".oBAAo.",
       "oAAABBo"]


def party_hat(spr, c1=(236, 70, 110), c2=(255, 214, 72), dx=0, dy=2, pos=None):
    """Kleiner Partyhut im Karten-Stil (dicker dunkler Umriss)."""
    spr, sx, sy = canvas(spr, top=7, side=2)
    hx, hy = head_top(spr) if pos is None else (pos[0] + sx, pos[1] + sy)
    cm = {'o': OUTL, 'A': tuple(c1) + (255,), 'B': tuple(c2) + (255,), 'w': (255, 255, 255, 255), 'W': (255, 240, 200, 255)}
    return stamp_rows(spr, HAT, hx - 3 + dx, hy - 6 + dy, cm)


CUP = ["orrro",
       "oyYyo",
       ".oyo.",
       ".oyo.",
       "oyyyo"]


def cup(spr, x, y, drink=(220, 50, 60)):
    cm = {'o': OUTL, 'r': tuple(drink) + (255,), 'y': (255, 214, 72, 255), 'Y': (255, 250, 190, 255)}
    return stamp_rows(spr, CUP, x - 2, y - 4, cm)


def tint_depth(spr, amt, col=(60, 40, 100)):
    a = np.array(spr).astype(float)
    a[..., :3] = a[..., :3] * (1 - amt) + np.array(col) * amt
    return Image.fromarray(a.clip(0, 255).astype(np.uint8))


def trim(spr):
    bb = spr.getbbox()
    return spr.crop(bb) if bb else spr
