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
        out.append(s.crop(s.getbbox()))
    return out


def bard():
    nb = native('Skeleton Bard')
    def bg2(a):
        L = a[..., :3].mean(2)
        purple = (a[..., 2] > a[..., 1] + 30) & (a[..., 0] > a[..., 1]) & (L < 150)
        brown = (a[..., 0] > a[..., 2] + 20) & (L < 150) & (a[..., 0] < 190)
        return _bg(a) | purple | brown
    s = keep_largest(cut_by(nb, (20, 10, 50, 40), bg2))
    return s.crop(s.getbbox())


def king():
    nk = native('Skeleton King Skullmael')
    s = keep_largest(cut_by(nk, (26, 0, 62, 34), lambda a: _bg(a, 0.4, 178)))
    return s.crop(s.getbbox())


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


# =====================================================================
#  Eigene Pixel-Skelette (Einzelpixel-Detail) mit posierbarem Rig
# =====================================================================
import math as _m

PAL = {
    '1': (240, 232, 206), '2': (208, 196, 170), '3': (150, 136, 140), 'k': (44, 26, 50), 'o': (20, 11, 28),
    'r': (226, 52, 62), 'R': (140, 22, 44), 'g': (98, 196, 84), 'G': (40, 110, 60), 'y': (255, 214, 72),
    'Y': (196, 128, 40), 'w': (255, 255, 240), 'p': (160, 90, 220), 'P': (86, 44, 140), 'b': (90, 170, 255),
    'B': (44, 80, 170), 'n': (150, 92, 52), 'N': (92, 52, 36), 'x': (58, 50, 74), 'X': (34, 28, 46),
    'c': (120, 240, 230), 'm': (255, 110, 200), 'M': (170, 40, 130), 'e': (120, 255, 140), 'E': (255, 60, 60),
    'f': (255, 240, 140), 'F': (255, 160, 40), 'h': (220, 60, 30), 'v': (180, 170, 200), 'V': (110, 100, 140),
    's': (200, 206, 220), 'S': (120, 124, 150), 'l': (255, 196, 90),
}

SKULL = {
    's': ["111", "k1k", ".2."],
    'm': [".11112.",
          "1111112",
          "1kk1kk2",
          "1kk1kk3",
          ".11k13.",
          ".1k1k3.",
          "..222.."],
    'l': ["...11112...",
          ".111111122.",
          "11111111122",
          "11111111123",
          "1kkk11kkk23",
          "1kkk11kkk23",
          "1kkk11kkk33",
          ".111k1k123.",
          "..1111123..",
          "..1k1k1k3..",
          "...12223..."],
}
RIBS = {
    's': ["121", ".1."],
    'm': ["1111113",
          "1kk1kk3",
          "1111113",
          ".kk1kk.",
          ".11113.",
          "...1..."],
    'l': ["21111111113",
          "1kkkk1kkkk3",
          "11111111113",
          "1kkkk1kkkk3",
          ".111111113.",
          ".kkkk1kkkk.",
          "..1111113..",
          "....k1k....",
          ".....1....."],
}
PELVIS = {
    's': ["1.1"],
    'm': ["1111113",
          ".1k1k3."],
    'l': [".111111113.",
          "11kk111kk33",
          "1kk.121.kk3",
          "......2...."],
}
# Rig-Maße je Größe: Schädel, Rippen, Schulter-/Hüftbreite, Arm/Bein-Längen, Linienstärke
RIG = {
    's': dict(neck=0, spine=1, sh=1, hip=1, a1=3, a2=3, l1=3, l2=3, w=1),
    'm': dict(neck=0, spine=1, sh=3, hip=2, a1=5, a2=5, l1=6, l2=6, w=1),
    'l': dict(neck=1, spine=2, sh=5, hip=3, a1=8, a2=8, l1=10, l2=10, w=2),
}


def _stamp(G, rows, x0, y0, outl=True):
    """ASCII-Teil in Zeichengitter G stempeln; eigener Umriss (o) darunter."""
    h, w = len(rows), max(len(r) for r in rows)
    m = np.zeros((h, w), bool)
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch != '.':
                m[j, i] = True
    if outl:
        d = ndimage.binary_dilation(np.pad(m, 1), structure=[[0, 1, 0], [1, 1, 1], [0, 1, 0]])
        ys, xs = np.where(d)
        for yy, xx in zip(ys, xs):
            Y, X = y0 + yy - 1, x0 + xx - 1
            if 0 <= Y < G.shape[0] and 0 <= X < G.shape[1]:
                G[Y, X] = 'o'
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch != '.':
                Y, X = y0 + j, x0 + i
                if 0 <= Y < G.shape[0] and 0 <= X < G.shape[1]:
                    G[Y, X] = ch


def _line_pts(x0, y0, x1, y1):
    pts = []
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    err = dx + dy
    while True:
        pts.append((x0, y0))
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy; x0 += sx
        if e2 <= dx:
            err += dx; y0 += sy
    return pts


def _bone(G, p0, p1, w, ch='1', shade='3', outl=True):
    pts = _line_pts(int(round(p0[0])), int(round(p0[1])), int(round(p1[0])), int(round(p1[1])))
    if outl:
        for (x, y) in pts:
            for oy in range(-1, w + 1):
                for ox in range(-1, w + 1):
                    if (oy in (-1, w)) and (ox in (-1, w)):
                        continue
                    if 0 <= y + oy < G.shape[0] and 0 <= x + ox < G.shape[1] and G[y + oy, x + ox] == '.':
                        G[y + oy, x + ox] = 'o'
    for (x, y) in pts:
        for oy in range(w):
            for ox in range(w):
                c = shade if (w > 1 and (ox == w - 1)) else ch
                if 0 <= y + oy < G.shape[0] and 0 <= x + ox < G.shape[1]:
                    G[y + oy, x + ox] = c


def _dir(a):
    r = _m.radians(a)
    return _m.sin(r), _m.cos(r)


def skeleton(size='m', pose=None, hat=None, item=None, item2=None, pal=None, flip=False, eyes=None, jaw=0, extra=None, under=None):
    """Tanzendes Skelett. pose: Winkel (0=unten, 90=rechts, 180=oben) für
    la/ra (Arm links/rechts: (Oberarm, Unterarm)) und ll/rl (Beine), lean (Kopf-Versatz)."""
    P = dict(la=(-30, -10), ra=(30, 10), ll=(-10, 0), rl=(10, 0), lean=0, hy=0)
    P.update(pose or {})
    R = RIG[size]
    sk, rb, pv = SKULL[size], RIBS[size], PELVIS[size]
    N = 90
    G = np.full((N, N), '.', dtype='<U1')
    cx, cy = N // 2, N // 2 + 8  # Becken-Mitte
    pw, ph = len(pv[0]), len(pv)
    rw, rh = len(rb[0]), len(rb)
    kw, kh = len(sk[0]), len(sk)
    lean = P['lean']
    # Beine
    hips = [(cx - R['hip'] - (1 if size != 's' else 0), cy + ph - 1), (cx + R['hip'], cy + ph - 1)]
    legs = []
    for side, key in ((0, 'll'), (1, 'rl')):
        a1, a2 = P[key]
        h0 = hips[side]
        d1 = _dir(a1); k = (h0[0] + d1[0] * R['l1'], h0[1] + d1[1] * R['l1'])
        d2 = _dir(a2); f = (k[0] + d2[0] * R['l2'], k[1] + d2[1] * R['l2'])
        legs.append((h0, k, f, side))
    for h0, k, f, side in legs:
        _bone(G, h0, k, R['w']); _bone(G, k, f, R['w'])
        fx, fy = int(round(f[0])), int(round(f[1]))
        foot = {'s': ["1"], 'm': ["11"] if side else ["11"], 'l': ["1112", "1123"] if side else ["2111", "3211"]}[size]
        fwid = len(foot[0])
        _stamp(G, foot, fx - (fwid - (1 if size != 'l' else 2)) if side == 0 else fx, fy + (1 if size != 's' else 0))
    # Becken
    _stamp(G, pv, cx - pw // 2, cy, outl=size != 's')
    # Wirbelsäule
    top = cy - R['spine'] - rh
    _bone(G, (cx + (0 if size != 'l' else -0), cy - 1), (cx + lean // 2, top + rh - 1), 1 if size != 'l' else 1, '2')
    # Rippen
    rx = cx + lean // 2 - rw // 2
    _stamp(G, rb, rx, top, outl=size != 's')
    # Schädel
    sx = cx + lean - kw // 2
    sy = top - R['neck'] - kh + (0 if size == 's' else 0) + P['hy']
    skr = [r for r in sk]
    if jaw and size == 'l':
        skr = skr[:-2] + ["..kkkkkk...", "..1k1k1k3..", "...12223..."]
    _stamp(G, skr, sx, sy, outl=size != 's')
    if eyes:
        for j, r in enumerate(skr):
            for i, ch in enumerate(r):
                if ch == 'k' and j < (len(skr) * 0.65) and not (size == 'm' and j == 4) and not (size == 'l' and j >= 7):
                    G[sy + j, sx + i] = eyes
        # Pupillenpunkte
    head = dict(x=sx, y=sy, w=kw, h=kh, cx=cx + lean)
    if under:
        under(dict(G=G, head=head, size=size, pel=(cx, cy), ribs=(rx, top, rw, rh), legs=R['l1'] + R['l2']))
    # Arme
    shoulders = [(rx - (0 if size == 's' else 0), top + (0 if size != 'l' else 1)), (rx + rw - (1 if size == 's' else 1) - (1 if size == 'l' else 0), top + (0 if size != 'l' else 1))]
    hands = []
    for side, key in ((0, 'la'), (1, 'ra')):
        a1, a2 = P[key]
        s0 = shoulders[side]
        d1 = _dir(a1); e = (s0[0] + d1[0] * R['a1'], s0[1] + d1[1] * R['a1'])
        d2 = _dir(a2); hnd = (e[0] + d2[0] * R['a2'], e[1] + d2[1] * R['a2'])
        _bone(G, s0, e, R['w']); _bone(G, e, hnd, R['w'])
        if size == 'l':
            _stamp(G, ["12", "23"], int(round(hnd[0])) - 0, int(round(hnd[1])) - 0)
        hands.append((int(round(hnd[0])), int(round(hnd[1]))))
    ctx = dict(G=G, head=head, hands=hands, size=size, pel=(cx, cy), ribs=(rx, top, rw, rh))
    if hat:
        hat(ctx)
    if item:
        item(ctx, 0)
    if item2:
        item2(ctx, 1)
    if extra:
        extra(ctx)
    # äußerer Umriss
    m = G != '.'
    d = ndimage.binary_dilation(m, structure=[[0, 1, 0], [1, 1, 1], [0, 1, 0]]) & ~m
    if size != 's':
        G[d] = 'o'
    pal = dict(PAL, **(pal or {}))
    out = np.zeros((N, N, 4), np.uint8)
    for ch, col in pal.items():
        mm = G == ch
        out[mm, :3] = col[:3]; out[mm, 3] = 255
    im = Image.fromarray(out, 'RGBA')
    bb = im.getbbox()
    # Fußpunkt merken (Unterkante)
    im = im.crop(bb)
    if flip:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    return im


# ---------- Hüte / Accessoires (ctx: head, hands) ----------
def _hat_rows(ctx, rows_by_size, dy=0, dx=0, anchor='top'):
    h = ctx['head']; size = ctx['size']
    rows = rows_by_size.get(size)
    if not rows:
        return
    w = len(rows[0])
    x = h['x'] + (h['w'] - w) // 2 + dx
    y = h['y'] - len(rows) + dy
    _stamp(ctx['G'], rows, x, y)


def party_hat(c1='m', c2='y'):
    def f(ctx):
        _hat_rows(ctx, {
            'm': ["..w..", ".www.", "..A..", "..B..", ".AAA.", ".BBA.", "AAABB"],
            'l': ["...w...", "..www..", "...w...", "...A...", "..BBA..", "..AAA..", ".AABBA.", ".BAAAA.", "AAAABBA", "AAAAAAA"],
        }, dy=2 if ctx['size'] == 'm' else 3, dx=0)
        G = ctx['G']
        G[G == 'A'] = c1; G[G == 'B'] = c2
    return f


def crown(ctx):
    _hat_rows(ctx, {
        'm': ["y.y.y", "yryry", "YYYYY"],
        'l': ["y..y..y", "yy.y.yy", "yyyryyy", "YyYyYyY", "YYYYYYY"],
    }, dy=1 if ctx['size'] == 'm' else 2)


def top_hat(ctx):
    _hat_rows(ctx, {
        'm': ["..xxxb", "..xxxb.", "..xXx..", ".bbbbb.", "XXXXXXX"],
        'l': ["...xxxxb.", "...xxxxbb", "...xxxX..", "...xxxX..", "...bbbb..", "XXXXXXXXX"],
    }, dy=1 if ctx['size'] == 'm' else 2)


def cross_cap(ctx):
    _hat_rows(ctx, {
        'm': ["..r..", ".rrr.", "GgrgG", "GgggG"],
        'l': ["...r...", "..rrr..", "...r...", ".GgggG.", "GgggggG"],
    }, dy=1 if ctx['size'] == 'm' else 2)


def hood(col='p', dark='P'):
    def f(ctx):
        h = ctx['head']; G = ctx['G']; size = ctx['size']
        if size == 'm':
            rows = ["..AAA..", ".AAAAA.", "AAB.BBA", "AB...BA", "AB...BA", "A.....A", "A.....A"]
            dy = 2
        else:
            rows = ["....AAA....", "..AAAAAAA..", ".AAAAAAAAA.", "AAABBBBBAAA", "AAB.....BAA", "AB.......BA", "AB.......BA", "AB.......BA", "A.........A", "A.........A"]
            dy = 3
        w = len(rows[0]); x = h['x'] + (h['w'] - w) // 2; y = h['y'] - dy
        for j, r in enumerate(rows):
            for i, ch in enumerate(r):
                if ch != '.':
                    G[y + j, x + i] = col if ch == 'A' else dark
        # Umriss oben
        for j, r in enumerate(rows):
            for i, ch in enumerate(r):
                if ch != '.' and (j == 0 or rows[j - 1][i] == '.') and G[y + j - 1, x + i] == '.':
                    G[y + j - 1, x + i] = 'o'
    return f


def halo(ctx):
    h = ctx['head']; G = ctx['G']
    w = h['w'] + 2
    y = h['y'] - (3 if ctx['size'] == 'l' else 2)
    for i in range(w):
        G[y, h['x'] - 1 + i] = 'y'
    G[y - 1, h['x']:h['x'] + h['w']] = 'f' if ctx['size'] == 'l' else 'y'


def flame_head(ctx):
    h = ctx['head']; G = ctx['G']
    rnd = random.Random(h['x'] * 7 + h['y'])
    x0 = h['x']; w = h['w']
    for i in range(-1, w + 1):
        hh = int(2 + rnd.random() * (6 if ctx['size'] == 'l' else 4) * (1 - abs(i - w / 2) / (w * 0.8)))
        for j in range(hh):
            ch = 'h' if j >= hh - 1 else ('F' if j >= hh * 0.5 else 'f')
            y = h['y'] + 1 - j
            if G[y, x0 + i] in '.o':
                G[y, x0 + i] = ch


# ---------- Gegenstände in der Hand ----------
def _item(rows, ax, ay):
    def f(ctx, which):
        hx, hy = ctx['hands'][which]
        _stamp(ctx['G'], rows, hx - ax, hy - ay)
    return f


def goblet(size='m'):
    if size == 'l':
        return _item(["rrrrr", "yRRRy", ".yyy.", "..y..", "..y..", ".yyy."], 2, 3)
    return _item(["rrr", "yyy", ".y.", "yyy"], 1, 2)


def bottle(size='m'):
    if size == 'l':
        return _item([".w.", ".G.", ".g.", "gGg", "gcG", "gcG", "gGG"], 1, 2)
    return _item(["G", "g", "gG", "gG"], 0, 1)


def maraca(col='r'):
    return _item([".A.", "AwA", "AAA", ".n.", ".n."], 1, 3)


def bone_club(size='m'):
    if size == 'l':
        return _item(["1.1", "121", ".2.", ".2.", ".2.", "121", "1.1"], 1, 3)
    return _item(["1.1", ".2.", ".2.", "1.1"], 1, 2)


def lantern_item(ctx, which):
    hx, hy = ctx['hands'][which]
    _stamp(ctx['G'], [".X.", "XfX", "XlX", ".X."], hx - 1, hy + 1)


def torch(ctx, which):
    hx, hy = ctx['hands'][which]
    _stamp(ctx['G'], [".f.", "fFf", "hFh", ".n.", ".n.", ".n."], hx - 1, hy - 4)


def robe(col='x', dark='X', trim=None):
    """Umhang/Robe über Rumpf und Beinen (unter den Armen)."""
    def f(ctx):
        G = ctx['G']; rx, top, rw, rh = ctx['ribs']; cx, cy = ctx['pel']
        y0, y1 = top, cy + 2 + ctx['legs']
        rows = []
        for j, y in enumerate(range(y0, y1)):
            t = j / max(1, y1 - y0 - 1)
            hw = rw / 2 + 0.5 + t * (4 if ctx['size'] == 'm' else 7)
            x0 = int(round(cx - hw)); x1 = int(round(cx + hw))
            for x in range(x0 - 1, x1 + 1):
                if 0 <= x < G.shape[1]:
                    G[y, x] = 'o'
            for x in range(x0, x1):
                ch = col
                if (x - x0) % 3 == 2 and j > 3: ch = dark
                if x == x1 - 1: ch = dark
                if trim and y == y1 - 2: ch = trim
                G[y, x] = ch
        for x in range(int(cx - rw), int(cx + rw) + 1):
            if G[y1, x] == '.': G[y1, x] = 'o'
    return f
