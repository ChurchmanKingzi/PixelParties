# -*- coding: utf-8 -*-
"""Cute Princess Mary und Cute Phoenix – direkt in 1x-Leinwandpixeln gezeichnet (Stil wie die Bomblebees in s09):
Formen nach dem Kartenbild, aber mit Volumen-Schattierung (gedithert), Randlicht, Glanzpunkten und dunklen Umrissen."""
from lib import *

yy, xx = np.mgrid[0:H, 0:W].astype(float)
THR = BAYER4[yy.astype(int) % 4, xx.astype(int) % 4]

# ---------------------------------------------------------------- Paletten (nach dem Kartenbild)
OUTL = (104, 24, 16)
WING = [(146, 36, 22), (206, 66, 40), (240, 104, 42), (248, 134, 46), (250, 164, 54), (252, 192, 72),
        (250, 220, 118), (255, 240, 172), (255, 252, 226)]
HAIR = [(150, 70, 14), (206, 118, 22), (240, 166, 30), (252, 204, 52), (255, 230, 104), (255, 248, 190)]
HAIRL = (112, 44, 16)
SKIN = [(196, 116, 104), (232, 158, 136), (246, 190, 164), (252, 214, 192), (255, 234, 218)]
DRESS = [(92, 128, 186), (136, 176, 222), (178, 212, 238), (214, 234, 248), (238, 248, 255), (255, 255, 255)]
DRESSL = (54, 70, 128)
BLUE = [(26, 70, 150), (44, 112, 206), (82, 160, 236), (150, 206, 250)]
GOLDC = [(120, 58, 10), (184, 104, 16), (232, 160, 30), (252, 210, 70), (255, 244, 160)]
PINKB = [(186, 60, 120), (228, 110, 164), (248, 164, 200), (255, 208, 228), (255, 240, 248)]
FIRE = [(120, 20, 18), (190, 34, 26), (230, 70, 30), (248, 122, 36), (252, 176, 48), (255, 222, 90),
        (255, 246, 170), (255, 255, 236)]


def ramp(t, cols, thr):
    """t (0..1) auf Farbrampe cols abbilden, zwischen Stufen gedithert."""
    t = np.clip(t, 0, 0.9999) * (len(cols) - 1)
    i = np.floor(t).astype(int)
    f = t - i
    i = np.where(f > thr, i + 1, i)
    return np.array(cols)[np.clip(i, 0, len(cols) - 1)]


def layer():
    return np.zeros((H, W, 4), np.uint8)


def put(lay, m, col):
    col = np.asarray(col)
    if col.ndim == 1:
        lay[m, :3] = col[:3]
    else:
        lay[m, :3] = col[m] if col.shape[:2] == (H, W) else col
    lay[m, 3] = 255


def comp(img, lay):
    img.alpha_composite(Image.fromarray(lay, 'RGBA'))


def poly_mask(pts):
    mk = Image.new('L', (W, H), 0)
    ImageDraw.Draw(mk).polygon([(float(x), float(y)) for x, y in pts], fill=255)
    return np.array(mk) > 0


def ell_mask(cx, cy, rx, ry):
    return ((xx + 0.5 - cx) / rx) ** 2 + ((yy + 0.5 - cy) / ry) ** 2 <= 1


def edge(m):
    return m & ~ndimage.binary_erosion(m)


def ring_out(m):
    st = ndimage.generate_binary_structure(2, 1)
    return ndimage.binary_dilation(m, st) & ~m


# ---------------------------------------------------------------- Feder
_WA = np.array(WING)


def darken(sub, m, k=2, pal=None, outl=OUTL):
    """Pixel (aus der Rampe pal) um k Stufen abdunkeln."""
    P_ = _WA if pal is None else np.array(pal)
    c = sub[m, :3].astype(int)
    d = ((c[:, None, :] - P_[None]) ** 2).sum(2)
    idx = np.argmin(d, 1)
    isout = (np.abs(c - np.array(outl)).sum(1) < 20)
    nc = P_[np.clip(idx - k, 0, len(P_) - 1)]
    nc[isout] = outl
    sub[m, :3] = nc


def feather(lay, B, D, L, w, bend=0.0, lift=0.0, tier=0, glob=None, side=1, rnd=None, tipfire=None, shadow=2, pal=WING, outl=OUTL, base=0.40, ugrad=0.2, tipb=0.2):
    """Eine Feder von B in Richtung D (Einheitsvektor), Länge L, halbe Breite w.
    bend: Krümmung der Spitze (Pixel, + = zur 'oberen' Seite). lift: Helligkeitsversatz."""
    dx, dy = D
    n1, n2 = (-dy, dx), (dy, -dx)
    N = n1 if n1[1] < n2[1] or (n1[1] == n2[1] and n1[0] * side < 0) else n2  # 'oben'
    Nx, Ny = N

    def hw(u):
        return w * (0.42 + 0.58 * min(1.0, u / 0.35) ** 0.6) * max(0.0, 1 - u ** 3.2) ** 0.5

    left, right = [], []
    K = 24
    for k in range(K + 1):
        u = k / K
        c = bend * u * u
        px = B[0] + dx * u * L + Nx * c
        py = B[1] + dy * u * L + Ny * c
        h_ = hw(u)
        left.append((px + Nx * h_, py + Ny * h_))
        right.append((px - Nx * h_, py - Ny * h_))
    pts = left + right[::-1]
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    x0, x1 = max(0, int(min(xs)) - 1), min(W, int(max(xs)) + 2)
    y0, y1 = max(0, int(min(ys)) - 1), min(H, int(max(ys)) + 2)
    if x1 <= x0 or y1 <= y0:
        return
    mk = Image.new('L', (x1 - x0, y1 - y0), 0)
    ImageDraw.Draw(mk).polygon([(p[0] - x0 - 0.5, p[1] - y0 - 0.5) for p in pts], fill=255)
    m = np.array(mk) > 0
    if not m.any():
        return
    X = xx[y0:y1, x0:x1] + 0.5; Y = yy[y0:y1, x0:x1] + 0.5
    u = ((X - B[0]) * dx + (Y - B[1]) * dy) / L
    uc = np.clip(u, 0, 1)
    n = (X - B[0]) * Nx + (Y - B[1]) * Ny - bend * uc * uc
    hwu = np.array([hw(float(t)) for t in np.linspace(0, 1, 64)])
    hh = np.maximum(hwu[(uc * 63).astype(int)], 0.6)
    v = np.clip(n / hh, -1, 1)  # +1 = oben
    t = base + lift + 0.26 * v + ugrad * (uc - 0.45) + (tipb * np.clip((uc - 0.72) / 0.28, 0, 1))
    if glob is not None:
        t = t + glob[y0:y1, x0:x1]
    # Fahnen-Struktur: feine schräge Rillen
    ph = (uc * L * 0.9 - np.abs(n) * 0.9)
    t = t - 0.05 * ((ph % 3.2) < 0.9) * (np.abs(v) < 0.85)
    # Schaft
    shaft = (np.abs(n + hh * 0.18) < 0.55) & (uc > 0.06) & (uc < 0.78) & (hh > 2.2)
    t = np.where(shaft, t - 0.12, t)
    thr = THR[y0:y1, x0:x1]
    col = ramp(np.clip(t, 0, 1), pal, thr)
    # Glanzkante an der Oberseite
    e = edge(m)
    inner1 = m & ~e & ndimage.binary_dilation(e) & (v > 0.35) & (uc > 0.12)
    col[inner1] = ramp(np.clip(t[inner1] + 0.2, 0, 1), pal, thr[inner1])
    col[e] = outl
    sub = lay[y0:y1, x0:x1]
    # Schlagschatten auf die darunterliegenden Federn (Seite gegenüber 'oben')
    if shadow:
        sh = np.zeros_like(m)
        ox, oy = -Nx, -Ny
        for k_ in (1, 2):
            sx_, sy_ = int(round(ox * k_)), int(round(oy * k_))
            sh |= np.roll(np.roll(m, sy_, 0), sx_, 1)
        sh &= ~m & (sub[..., 3] > 0)
        if sh.any():
            darken(sub, sh, shadow, pal, outl)
    sub[m, :3] = col[m]
    sub[m, 3] = 255
    if tipfire is not None:
        tipfire.append((left[-1][0], left[-1][1], D))


def wing(lay, S, side=-1, scale=1.0, seed=1, glob=None, tips=None):
    """Erhobener Engelsflügel (Kartenform): Vorderkante von der Schulter senkrecht hoch und nach außen gebogen,
    Federreihen zeigen nach außen, unten kürzer und schräg nach unten (gezackte Unterkante)."""
    rnd = random.Random(seed)
    # Armknochen (Vorderkante), lokale Koordinaten (x nach außen positiv), y nach unten
    arm = [(0, 0), (0, -40), (8, -82), (24, -114), (46, -133), (70, -141), (88, -139)]
    arm = [(x * scale, y * scale) for x, y in arm]
    # dichtes Resampling
    seg = []
    for i in range(len(arm) - 1):
        a, b = arm[i], arm[i + 1]
        seg.append(math.hypot(b[0] - a[0], b[1] - a[1]))
    tot = sum(seg)

    def A(s):
        d_ = s * tot
        for i, l in enumerate(seg):
            if d_ <= l or i == len(seg) - 1:
                f = d_ / l if l else 0
                a, b = arm[i], arm[i + 1]
                return (a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f)
            d_ -= l

    def dirv(s):
        # Richtungswinkel (Bildschirm, 0 = nach außen, +90 = nach unten)
        keys = [(0.0, 62), (0.18, 40), (0.4, 20), (0.62, 6), (0.8, -8), (1.0, -24)]
        for i in range(len(keys) - 1):
            if keys[i][0] <= s <= keys[i + 1][0]:
                f = (s - keys[i][0]) / (keys[i + 1][0] - keys[i][0])
                a = keys[i][1] + (keys[i + 1][1] - keys[i][1]) * f
                break
        r = math.radians(a)
        return (math.cos(r), math.sin(r))

    def length(s):
        keys = [(0.0, 64), (0.2, 88), (0.45, 98), (0.68, 88), (0.86, 64), (1.0, 34)]
        for i in range(len(keys) - 1):
            if keys[i][0] <= s <= keys[i + 1][0]:
                f = (s - keys[i][0]) / (keys[i + 1][0] - keys[i][0])
                return (keys[i][1] + (keys[i + 1][1] - keys[i][1]) * f) * scale

    def P(loc):
        return (S[0] + side * loc[0], S[1] + loc[1])

    # Ebenen: (Längenfaktor, Breite, Abstand, Helligkeit, Startversatz)
    tiers = [(1.0, 8.0, 7.4, -0.06, 0.0), (0.68, 6.4, 7.0, 0.0, 0.5), (0.42, 5.6, 6.4, 0.06, 0.25), (0.22, 4.4, 5.2, 0.12, 0.6)]
    for ti, (lf, wd, sp, li, off) in enumerate(tiers):
        n = int(tot / sp)
        ss = [min(1.0, (k + off) / n) for k in range(n + 1)]
        for s in sorted(ss, reverse=True):
            ax, ay = A(s)
            # Federansatz etwas hinter die Vorderkante
            dv = dirv(s)
            L = length(s) * lf + rnd.uniform(-2, 2)
            if ti > 0:
                L = max(L, 8 * scale)
            B = P((ax - dv[0] * 3, ay - dv[1] * 3))
            D = (side * dv[0], dv[1])
            feather(lay, B, D, L + 3, wd * scale * (0.9 + 0.2 * rnd.random()), bend=(-2.5 if ti == 0 else -1.2) * scale,
                    lift=li, tier=ti, glob=glob, side=side, tipfire=tips if ti == 0 else None)
    # Vorderkante (Knochen): runde Deckfedern-Schuppen
    n = int(tot / 4.2)
    for k in range(n, -1, -1):
        s = k / n
        ax, ay = A(s)
        dv = dirv(s)
        B = P((ax - dv[0] * 1, ay - dv[1] * 1))
        feather(lay, B, (side * dv[0], dv[1]), 9 * scale, 3.4 * scale, bend=0, lift=0.24, tier=4, glob=glob, side=side)


# ---------------------------------------------------------------- Mary
LX, LY, LZ = -0.45, -0.62, 0.64


def lambert(nx, ny):
    nz = np.sqrt(np.clip(1 - nx * nx - ny * ny, 0, 1))
    ln = math.sqrt(LX * LX + LY * LY + LZ * LZ)
    return np.clip((nx * LX + ny * LY + nz * LZ) / ln, 0, 1), nz


def outline_mask(m):
    return ring_out(m)


def shade_ramp(m, t, cols, lay, outl=None, thr=None):
    thr = THR if thr is None else thr
    c = ramp(np.clip(t, 0, 1), cols, thr)
    put(lay, m, c)
    if outl is not None:
        put(lay, edge(m), outl)


def draw_mary(cx=125.0, hy=92.0, seed=3):
    """Mary, Kopfmitte (cx, hy). Liefert Ebene (RGBA-Array) und Gesamtmaske."""
    X = xx + 0.5 - cx
    Y = yy + 0.5
    AX = np.abs(X)
    lay = layer()

    # ================= Kleid (Glocke) =================
    ntop, hem = hy + 16, hy + 102
    def half(y):
        f = np.clip((y - ntop) / (hem - ntop), 0, 1)
        return 8 + 9 * f ** 0.8 + 11 * f ** 2.0
    hwy = half(Y)
    # gewellter Saum
    scal = hem - 2 + 2.2 * np.abs(np.sin(X * math.pi / 9.0))
    dress = (AX <= hwy) & (Y >= ntop) & (Y <= scal)
    nx = np.clip(X / np.maximum(hwy, 1), -1, 1)
    f = np.clip((Y - ntop) / (hem - ntop), 0, 1)
    dif, nz = lambert(nx * 0.95, -0.15 + 0 * nx)
    fold = np.sin(nx * math.pi * 3.2 + 0.4) * f ** 1.2
    t = 0.2 + 0.72 * dif + 0.16 * fold - 0.08 * f
    col = ramp(np.clip(t, 0, 1), DRESS, THR)
    put(lay, dress, col)
    # Saumrüsche (hellblaue Spitze)
    frill = dress & (Y > scal - 5)
    fr = np.clip(0.3 + 0.5 * dif[frill] - 0.3 * ((Y[frill] - scal[frill] + 5) / 5) + 0.15 * (np.sin(X[frill] * 1.4) > 0.3), 0, 1)
    lay[frill, :3] = ramp(fr, DRESS[:5], THR[frill]); lay[frill, 3] = 255
    # Faltenlinien unten
    fl = dress & (f > 0.35) & (np.abs(np.sin(nx * math.pi * 3.2 + 0.4) + 1) < 0.08 + 0.1 * f) & (Y < scal - 4)
    lay[fl, :3] = DRESS[1]
    # ---- Anker-/Kreuz-Ornament (blau)
    orn = np.zeros((H, W), bool)
    orn |= (AX < 1.5) & (Y > ntop + 10) & (Y < hem - 12)
    ycb = ntop + 44
    orn |= (AX < 7) & (np.abs(Y - ycb) < 1.5)
    yab = hem - 16
    arc = (np.abs(np.hypot(X, (Y - (yab - 13)) * 1.0) - 14) < 1.4) & (Y > yab - 6) & (AX < 12.5)
    orn |= arc
    fluke = np.zeros((H, W), bool)
    for s_ in (-1, 1):
        fluke |= poly_mask([(cx + s_ * 9, yab - 4), (cx + s_ * 15, yab - 9), (cx + s_ * 13, yab - 2)])
    orn |= fluke
    ringm = (np.abs(np.hypot(X, Y - (ntop + 12)) - 3.2) < 1.1)
    orn |= ringm
    orn |= (AX < 3.5) & (np.abs(Y - (hem - 10)) < 1.5)
    orn &= dress
    ot = 0.35 + 0.45 * np.clip(-(X) / 10 - (Y - ycb) / 60, -0.4, 0.8)
    oc = ramp(np.clip(ot, 0, 1), BLUE, THR)
    put(lay, orn, oc)
    put(lay, ring_out(orn) & dress & ~ringm, DRESS[2])
    # kleine Knöpfe/Perlen am Schaft
    for k in range(3):
        by = ntop + 20 + k * 8
        m_ = (np.abs(X) < 2.2) & (np.abs(Y - by) < 1.6)
        put(lay, m_, BLUE[2]); put(lay, (np.abs(X + 0.5) < 0.6) & (np.abs(Y - by + 0.5) < 0.6), (240, 250, 255))
    put(lay, edge(dress), DRESSL)
    allm = dress.copy()

    # ================= Arme (offen, Handflächen nach vorn) =================
    armlay = layer()
    armm = np.zeros((H, W), bool)
    for s_ in (-1, 1):
        sh = (cx + s_ * 12.5, ntop + 6)
        el = (cx + s_ * 21, ntop + 22)
        wr = (cx + s_ * 30, ntop + 33)

        def tube(p0, p1, r0, r1):
            X_ = xx + 0.5; Y_ = yy + 0.5
            vx, vy = p1[0] - p0[0], p1[1] - p0[1]
            L2 = vx * vx + vy * vy
            u = np.clip(((X_ - p0[0]) * vx + (Y_ - p0[1]) * vy) / L2, 0, 1)
            dx_ = X_ - (p0[0] + u * vx); dy_ = Y_ - (p0[1] + u * vy)
            r = r0 + (r1 - r0) * u
            d_ = np.hypot(dx_, dy_)
            return d_ <= r, d_ / np.maximum(r, 0.1), dx_, dy_
        # Hand (hinter der Manschette)
        hx, hy_ = wr[0] + s_ * 4.4, wr[1] + 3.2
        hm = ell_mask(hx, hy_, 3.7, 3.4)
        fing = np.zeros((H, W), bool)
        for k in range(4):
            fx = hx + s_ * (3.0 + 0.5 * k - 0.4 * (k == 3)); fy = hy_ - 1.8 + k * 1.6
            fing |= ell_mask(fx, fy, 2.0, 0.9)
        thumb = ell_mask(hx - s_ * 0.2, hy_ - 3.8, 1.0, 2.0)
        hand = hm | fing | thumb
        ht = 0.6 - 0.3 * np.clip((yy + 0.5 - hy_) / 4, -1, 1) - 0.14 * (s_ > 0)
        put(armlay, hand, ramp(np.clip(ht, 0, 1), SKIN, THR))
        put(armlay, edge(hand), (150, 64, 60))
        # Fingerlinien
        for k in range(1, 4):
            fy = hy_ - 1.8 + k * 1.6 - 0.8
            put(armlay, hand & (np.abs(yy + 0.5 - fy) < 0.5) & ((xx + 0.5 - hx) * s_ > 1.4) & ~edge(hand), SKIN[1])
        # Arm (langer weißer Ärmel)
        m1, r1, dx1, dy1 = tube(sh, el, 4.2, 3.4)
        m2, r2, dx2, dy2 = tube(el, wr, 3.4, 3.2)
        sleeve = m1 | m2
        nxs = np.where(m1, dx1 / 4, dx2 / 3.3); nys = np.where(m1, dy1 / 4, dy2 / 3.3)
        dif_, _ = lambert(np.clip(nxs, -1, 1) * 0.9, np.clip(nys, -1, 1) * 0.9)
        put(armlay, sleeve, ramp(np.clip(0.2 + 0.75 * dif_, 0, 1), DRESS, THR))
        # Puffärmel an der Schulter
        puff = ell_mask(sh[0] + s_ * 1.5, sh[1] + 1, 6.2, 6.0)
        pdx = (xx + 0.5 - sh[0] - s_ * 1.5) / 6.2; pdy = (yy + 0.5 - sh[1] - 1) / 6
        pd, _ = lambert(np.clip(pdx, -1, 1), np.clip(pdy, -1, 1))
        pt = 0.2 + 0.8 * pd + 0.08 * np.sin((xx + 0.5 - sh[0]) * 1.6 * s_ + (yy + 0.5) * 0.4)
        put(armlay, puff, ramp(np.clip(pt, 0, 1), DRESS, THR))
        # Goldmanschette
        cuff, rc, _, _ = tube((wr[0] - s_ * 0.8, wr[1] - 0.9), (wr[0] + s_ * 0.6, wr[1] + 0.6), 3.6, 3.6)
        put(armlay, cuff, GOLDC[2]); put(armlay, cuff & (yy + 0.5 < wr[1] - 0.5), GOLDC[3])
        am = sleeve | puff | cuff
        put(armlay, edge(am) & ~ndimage.binary_dilation(hand) | (edge(am) & ~hand), DRESSL)
        put(armlay, edge(cuff) & ~edge(am), GOLDC[0])
        put(armlay, edge(puff) & ~edge(am) & ((yy + 0.5) > sh[1] + 1), DRESS[1])
        armm |= am | hand
    allm |= armm

    # ================= Hals / Kragen =================
    neck = (AX < 5) & (Y > hy + 11) & (Y < ntop + 2)
    put(lay, neck, SKIN[1])
    put(lay, neck & (Y < hy + 14), SKIN[0])
    col_ = (np.abs(np.hypot(X * 0.9, Y - (ntop - 3)) - 7.5) < 1.6) & (Y > ntop - 1) & (Y < ntop + 5)
    put(lay, col_, GOLDC[2]); put(lay, col_ & (X < 0), GOLDC[3])
    put(lay, ring_out(col_) & (dress | neck), GOLDC[0])
    gem = ell_mask(cx, ntop + 4.5, 2.3, 2.3)
    put(lay, gem, PINKB[1]); put(lay, gem & (X < 0) & (Y < ntop + 4.5), PINKB[3]); put(lay, ring_out(gem), (110, 30, 70))
    allm |= neck

    # ================= Kopf =================
    hl = layer()
    HC = (cx, hy - 2)  # Kopfkugel-Mitte für Licht

    def hair_t(m, extra=0.0):
        nx_ = np.clip((xx + 0.5 - HC[0]) / 27, -1, 1); ny_ = np.clip((yy + 0.5 - HC[1]) / 27, -1, 1)
        d_, _ = lambert(nx_ * 0.9, ny_ * 0.8)
        dist = ndimage.distance_transform_edt(m)
        return 0.08 + 0.6 * d_ + 0.1 * np.clip(dist / 3, 0, 1) + extra

    def lock(p0, p1, p2, w0, w1=0.3, K=20):
        L_, R_ = [], []
        for k in range(K + 1):
            u = k / K
            x = (1 - u) ** 2 * p0[0] + 2 * (1 - u) * u * p1[0] + u * u * p2[0]
            y = (1 - u) ** 2 * p0[1] + 2 * (1 - u) * u * p1[1] + u * u * p2[1]
            dx_ = 2 * (1 - u) * (p1[0] - p0[0]) + 2 * u * (p2[0] - p1[0])
            dy_ = 2 * (1 - u) * (p1[1] - p0[1]) + 2 * u * (p2[1] - p1[1])
            n_ = math.hypot(dx_, dy_) or 1
            nx_, ny_ = -dy_ / n_, dx_ / n_
            w_ = w0 + (w1 - w0) * u ** 1.3
            L_.append((x + nx_ * w_, y + ny_ * w_)); R_.append((x - nx_ * w_, y - ny_ * w_))
        return poly_mask(L_ + R_[::-1])

    def paint_locks(masks, extra=0.0, line=HAIR[0]):
        for m in masks:
            t = hair_t(m, extra)
            put(hl, m, ramp(np.clip(t, 0, 1), HAIR, THR))
            put(hl, edge(m), line)

    # Hinterkopf + lange Haare (hinter dem Gesicht)
    back = ell_mask(cx, hy - 3, 25, 23.5)
    backlocks = []
    for s_ in (-1, 1):
        backlocks.append(lock((cx + s_ * 16, hy - 6), (cx + s_ * 28, hy + 12), (cx + s_ * 26, hy + 34), 8, 1.5))
        backlocks.append(lock((cx + s_ * 12, hy + 2), (cx + s_ * 21, hy + 18), (cx + s_ * 18, hy + 33), 6, 1))
    bm_ = back.copy()
    for m in backlocks:
        bm_ |= m
    put(hl, bm_, HAIRL)  # Grundfläche
    t = hair_t(back)
    put(hl, back, ramp(np.clip(t - 0.08, 0, 1), HAIR, THR))
    paint_locks(backlocks, -0.1)
    put(hl, edge(bm_), HAIRL)

    # Gesicht
    face = ell_mask(cx, hy + 3, 17, 14.5) | ell_mask(cx, hy + 8, 13.5, 10.5)
    fnx = np.clip(X / 17, -1, 1); fny = np.clip((Y - hy - 3) / 15, -1, 1)
    fd, _ = lambert(fnx * 0.8, fny * 0.6)
    put(hl, face, ramp(np.clip(0.28 + 0.7 * fd, 0, 1), SKIN, THR))
    put(hl, edge(face) & (Y > hy + 3), (176, 96, 86))
    # Rouge
    for s_ in (-1, 1):
        bl = ell_mask(cx + s_ * 10.5, hy + 10.5, 3.4, 1.8)
        put(hl, bl & face, (250, 156, 164))
        put(hl, bl & face & (THR > 0.6), (255, 186, 190))
        put(hl, ell_mask(cx + s_ * 10.5 - 1, hy + 9.8, 0.6, 0.6), (255, 240, 240))
    # Augen: groß, rund, glänzend
    for s_ in (-1, 1):
        ex, ey = cx + s_ * 7.5, hy + 5
        e = ell_mask(ex, ey, 3.0, 4.2)
        put(hl, e, (36, 20, 40))
        put(hl, e & (Y > ey + 0.8), (92, 44, 62))
        put(hl, e & (Y > ey + 2.3) & (np.abs(xx + 0.5 - ex) < 1.6), (178, 92, 82))
        put(hl, (np.abs(xx + 0.5 - (ex - 1.0)) < 1.0) & (np.abs(yy + 0.5 - (ey - 1.5)) < 1.0), (255, 255, 255))
        put(hl, (np.abs(xx + 0.5 - (ex + 1.5)) < 0.5) & (np.abs(yy + 0.5 - (ey + 1.5)) < 0.5), (255, 226, 236))
        lash = ring_out(e) & (yy + 0.5 < ey - 1.8)
        put(hl, lash, (40, 18, 30))
        put(hl, (np.abs(xx + 0.5 - (ex + s_ * 3.6)) < 0.5) & (np.abs(yy + 0.5 - (ey - 3.0)) < 0.5), (40, 18, 30))
    # Mund: offenes Lächeln
    mo = ell_mask(cx, hy + 12.6, 2.6, 2.0) & (Y > hy + 12.0)
    put(hl, mo, (140, 36, 54))
    put(hl, ell_mask(cx, hy + 14.2, 1.5, 0.8), (240, 112, 128))

    # Pony (einzelne spitze Strähnen)
    cap = ell_mask(cx, hy - 4, 22.5, 17.5) & (Y < hy - 2)
    fl = []
    tips = [(-19, 9), (-14, 3), (-9, 1.5), (-4, -1), (1, 0.5), (5.5, -1.5), (10, 1.5), (15, 3.5), (19.5, 9)]
    for (tx, ty) in tips:
        rx0 = cx + tx * 0.35
        fl.append(lock((rx0, hy - 16), (cx + tx * 0.8, hy - 8), (cx + tx, hy + ty), 5.2 if abs(tx) < 16 else 4.2, 0.3))
    capm = cap.copy()
    for m in fl:
        capm |= m
    put(hl, capm, HAIRL)
    t = hair_t(cap, 0.05)
    # Glanzring (Engelsring) auf der Kappe
    rr = np.hypot(X / 20, (Y - hy + 6) / 16)
    ringh = (np.abs(rr - 0.86) < 0.08) & (Y < hy - 9)
    zig = (np.sin(X * 1.3) * 0.04)
    ringh = (np.abs(rr - 0.86 + zig) < 0.075) & (Y < hy - 9)
    put(hl, cap, ramp(np.clip(t, 0, 1), HAIR, THR))
    order = sorted(range(len(fl)), key=lambda i: -abs(tips[i][0]))
    for i in order:
        m = fl[i]
        t = hair_t(m, 0.1)
        put(hl, m, ramp(np.clip(t, 0, 1), HAIR, THR))
        put(hl, edge(m) & (Y > hy - 9), HAIR[0])
    put(hl, ringh & capm, HAIR[5]); put(hl, ringh & capm & (THR < 0.3) & (X > 4), HAIR[4])
    put(hl, edge(capm) & ~face, HAIRL)
    put(hl, edge(capm) & face & (Y > hy - 6), HAIRL)
    # Schatten des Ponys auf der Stirn
    shd = face & ~capm & ring_out(capm) & (Y > hy - 6)
    put(hl, shd, SKIN[1])
    # Seitenlocken vor dem Gesicht (rahmend)
    side = []
    for s_ in (-1, 1):
        side.append(lock((cx + s_ * 16, hy - 10), (cx + s_ * 23, hy + 6), (cx + s_ * 19, hy + 27), 5.5, 1.2))
        side.append(lock((cx + s_ * 14, hy - 4), (cx + s_ * 18, hy + 8), (cx + s_ * 14.5, hy + 20), 3.5, 0.6))
    paint_locks(side, 0.05)
    for m in side:
        put(hl, edge(m), HAIRL)
    fr = capm.copy()
    for m in side:
        fr |= m
    face_ = face
    headm = bm_ | face | fr
    allm |= headm

    # ================= Krone + Schleife =================
    cr = layer()
    RIBL = (150, 42, 100)
    bow = np.zeros((H, W), bool)
    for s_ in (-1, 1):
        # Schlaufe: schräg nach oben außen, Ende rund
        p0 = (cx + s_ * 3, hy - 23); p1 = (cx + s_ * 9, hy - 40); p2 = (cx + s_ * 19, hy - 44)
        lp = lock(p0, p1, p2, 2.5, 6.5)
        lp |= ell_mask(cx + s_ * 17.5, hy - 41, 6.2, 5.6)
        hole = lock((cx + s_ * 6, hy - 28), (cx + s_ * 10, hy - 38), (cx + s_ * 17, hy - 40), 0.6, 2.4) & ndimage.binary_erosion(lp, iterations=2)
        lx_ = (xx + 0.5 - cx) * s_
        dist = ndimage.distance_transform_edt(lp)
        t = 0.3 + 0.2 * np.clip(dist / 3, 0, 1) + 0.35 * np.clip(-(yy + 0.5 - (hy - 44)) / 14 + 1, 0, 1) * 0.6 - 0.12 * (s_ > 0)
        t = t + 0.15 * np.clip(1 - np.hypot(lx_ - 13, yy + 0.5 - (hy - 44)) / 5, 0, 1)
        put(cr, lp, ramp(np.clip(t, 0, 1), PINKB, THR))
        put(cr, hole, PINKB[1]); put(cr, hole & ring_out(~hole) & ((yy + 0.5) > hy - 36), PINKB[0])
        put(cr, edge(lp), RIBL)
        # Band-Ende (hängend)
        tl = lock((cx + s_ * 4, hy - 21), (cx + s_ * 14, hy - 22), (cx + s_ * 22, hy - 14), 2.4, 3.6)
        tl &= ~poly_mask([(cx + s_ * 22.5, hy - 17), (cx + s_ * 20, hy - 13.5), (cx + s_ * 25, hy - 11)])
        tt = 0.45 + 0.2 * np.clip(ndimage.distance_transform_edt(tl) / 2, 0, 1) - 0.15 * (s_ > 0)
        put(cr, tl, ramp(np.clip(tt, 0, 1), PINKB, THR))
        put(cr, edge(tl), RIBL)
        bow |= lp | tl
    knot = ell_mask(cx, hy - 23, 4.6, 4.0)
    put(cr, knot, PINKB[2]); put(cr, knot & (X < 0) & (Y < hy - 23), PINKB[3])
    put(cr, ell_mask(cx - 1.5, hy - 24.5, 0.8, 0.8), (255, 255, 255))
    put(cr, edge(knot), RIBL)
    bow |= knot
    # Goldkrone (Tiara) vor der Schleife, auf dem Scheitel
    cw = layer()
    crown = np.zeros((H, W), bool)
    by = hy - 20
    arcY = by + (X / 12) ** 2 * 2.5  # folgt der Kopfrundung
    crown |= (AX < 12) & (Y > arcY - 3.2) & (Y < arcY + 1.2)
    spikes = [(-9, 6), (-4.5, 8.5), (0, 12), (4.5, 8.5), (9, 6)]
    for (px, ph) in spikes:
        b0 = by + (px / 12) ** 2 * 2.5 - 2.5
        crown |= poly_mask([(cx + px - 2.6, b0), (cx + px, b0 - ph), (cx + px + 2.6, b0)])
    ct = 0.62 - 0.035 * X - 0.3 * np.clip((Y - (by - 3)) / 5, 0, 1) + 0.1 * (Y < by - 4)
    put(cw, crown, ramp(np.clip(ct, 0, 1), GOLDC, THR))
    bandm = crown & (Y > arcY - 3.2) & (Y < arcY + 1.2)
    put(cw, bandm & (Y < arcY - 1.8), GOLDC[4])
    put(cw, bandm & (Y > arcY + 0.2), GOLDC[1])
    put(cw, edge(crown), (100, 40, 10))
    for (px, ph) in spikes:
        b0 = by + (px / 12) ** 2 * 2.5 - 2.5
        pr = ell_mask(cx + px, b0 - ph - 0.3, 1.25, 1.25)
        put(cw, pr, (255, 244, 220)); put(cw, ring_out(pr) & ~crown, (100, 40, 10))
    for (px, colg) in [(0, (236, 60, 110)), (-7, (80, 170, 240)), (7, (80, 170, 240))]:
        gy = by + (px / 12) ** 2 * 2.5 - 1.0
        g = ell_mask(cx + px, gy, 1.7, 1.5)
        put(cw, g, colg); put(cw, g & (xx + 0.5 < cx + px) & (yy + 0.5 < gy), tuple(min(255, c + 90) for c in colg))
        put(cw, ring_out(g) & crown, GOLDC[0])
    allm |= crown | bow
    return dict(dress=lay, arms=armlay, head=hl, bow=cr, crown=cw), allm, dict(ntop=ntop, hem=hem, dress=dress, arms=armm, head=headm)


# ---------------------------------------------------------------- Feuer
def vnoise_stretch(w, h, sx, sy, seed, octaves=3):
    """Wertrauschen, vertikal um sy/sx gestreckt (für Flammenzungen)."""
    hh_ = max(8, int(h * sx / sy))
    n = value_noise(w, hh_, sx, seed=seed, octaves=octaves)
    return np.array(Image.fromarray((n * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)).astype(float) / 255


def flames(I, lay, pal=FIRE, lo=0.1, outl=(120, 20, 18), soft=0.55):
    """Intensitätsfeld I (0..1) als Pixel-Flammen mit Farbbändern malen."""
    m = I > lo
    thr = 0.5 + (THR - 0.5) * soft
    t = np.clip((I - lo) / (1 - lo), 0, 1)
    col = ramp(t * 0.98 + 0.02, pal[1:], thr)
    put(lay, m, col)
    if outl is not None:
        put(lay, edge(m) & (I < lo + 0.12), outl)
    return m


# ---------------------------------------------------------------- Aura um das Kleid
def aura(dress, ntop, hem, cx, seed=7):
    d = ndimage.distance_transform_edt(~dress)
    f = np.clip((yy + 0.5 - ntop - 18) / (hem - ntop - 18), 0, 1)
    below = np.clip((yy + 0.5 - hem) / 10, 0, 1)
    R = 1.5 + 10 * f ** 1.2 * (1 - 0.3 * below)
    n = vnoise_stretch(W, H, 3, 11, seed)
    # Zungen züngeln nach oben: Rauschen nach oben verschoben
    I = 1 - d / np.maximum(R, 0.5) + (n - 0.5) * 1.1 * f
    I = np.where(yy + 0.5 < ntop + 16, -1, I)
    lay = layer()
    flames(np.clip(I, -1, 1), lay, lo=0.0)
    return lay, I > 0


# ---------------------------------------------------------------- Cute Phoenix (steigt aus der Feuersäule auf)
PHX = [(150, 30, 22), (214, 64, 30), (244, 118, 36), (252, 176, 50), (255, 220, 90), (255, 242, 160), (255, 252, 222)]
PHXL = (128, 24, 22)


def phoenix(cx, cy, seed=11):
    """Körpermitte (cx, cy). Gibt (hintere Ebene, vordere Ebene, Maske) zurück."""
    rnd = random.Random(seed)
    X = xx + 0.5 - cx; Y = yy + 0.5 - cy
    back = layer(); front = layer()
    # ---- Schwanzfedern (lang, geschwungen, nach unten in die Flammen)
    tails = [(-1, 0.0), (1, 0.0), (-1, 1.0), (1, 1.0), (0, 0.0)]
    for (s_, k) in [(-1, 1), (1, 1), (-1, 0), (1, 0), (0, 0)]:
        p0 = (cx + s_ * 2, cy + 6)
        p1 = (cx + s_ * (10 + 8 * k), cy + 22 + 4 * k)
        p2 = (cx + s_ * (4 + 16 * k), cy + 44 + 8 * k - (6 if s_ == 0 else 0))
        L_, R_ = [], []
        K_ = 24
        for j in range(K_ + 1):
            u = j / K_
            x = (1 - u) ** 2 * p0[0] + 2 * (1 - u) * u * p1[0] + u * u * p2[0]
            y = (1 - u) ** 2 * p0[1] + 2 * (1 - u) * u * p1[1] + u * u * p2[1]
            dx_ = 2 * (1 - u) * (p1[0] - p0[0]) + 2 * u * (p2[0] - p1[0]); dy_ = 2 * (1 - u) * (p1[1] - p0[1]) + 2 * u * (p2[1] - p1[1])
            n_ = math.hypot(dx_, dy_) or 1
            w_ = 1.2 + 3.2 * math.sin(math.pi * min(1, u * 1.15)) ** 0.8
            L_.append((x - dy_ / n_ * w_, y + dx_ / n_ * w_)); R_.append((x + dy_ / n_ * w_, y - dx_ / n_ * w_))
        m = poly_mask(L_ + R_[::-1])
        dist = ndimage.distance_transform_edt(m)
        t = 0.35 + 0.35 * np.clip(dist / 2.5, 0, 1) - 0.25 * np.clip((Y - 20) / 30, 0, 1)
        put(back, m, ramp(np.clip(t, 0, 1), PHX, THR))
        put(back, edge(m), PHXL)
        # Augenfleck am Federende
        ex_, ey_ = L_[18][0] * 0.5 + R_[18][0] * 0.5, L_[18][1] * 0.5 + R_[18][1] * 0.5
        put(back, ell_mask(ex_, ey_, 1.8, 1.8) & m, PHX[5]); put(back, ell_mask(ex_, ey_, 0.8, 0.8), PHX[1])
    # ---- Flügel: erhoben, V-förmig (Federfächer)
    wl = layer()
    for s_ in (-1, 1):
        S_ = (cx + s_ * 5, cy - 5)
        # Ebenen: Handschwingen lang, dann Deckfedern
        for ti, (lf, wd, n_, lift) in enumerate([(1.0, 4.6, 11, -0.08), (0.6, 4.2, 9, 0.05), (0.32, 3.4, 7, 0.14)]):
            for j in reversed(range(n_)):
                a = -78 + j * (100 / (n_ - 1))  # -78 = steil nach oben, +22 = leicht nach unten
                r_ = math.radians(a)
                D = (s_ * math.cos(r_), math.sin(r_))
                L = (22 + 26 * math.sin(math.radians((j / (n_ - 1)) * 150 + 15))) * lf + 6
                if ti == 0:
                    L += 6 * (1 - j / (n_ - 1))
                B = (S_[0] + D[0] * 2, S_[1] + D[1] * 2)
                feather(wl, B, D, L, wd, bend=-2.0 * lf, lift=lift, side=s_, pal=PHX, outl=PHXL, base=0.62,
                        ugrad=-0.35, tipb=-0.25, shadow=1)
    # ---- Körper
    body = ell_mask(cx, cy + 1, 7.5, 10)
    nx_ = np.clip(X / 7.5, -1, 1); ny_ = np.clip((Y - 1) / 10, -1, 1)
    dif, nz = lambert(nx_, ny_)
    bt = 0.35 + 0.6 * dif
    bl = layer()
    put(bl, body, ramp(np.clip(bt, 0, 1), PHX, THR))
    # Brustfedern (kleine Schuppen)
    sc = body & (np.sin(X * 1.3 + (np.floor(Y / 2.5) % 2) * 1.6) > 0.7) & ((Y % 2.5) < 0.8) & (Y > -3)
    put(bl, sc & ~edge(body), PHX[3])
    put(bl, edge(body), PHXL)
    # ---- Kopf
    hx, hy = cx, cy - 12
    head = ell_mask(hx, hy, 7, 6.5)
    hnx = np.clip((xx + 0.5 - hx) / 7, -1, 1); hny = np.clip((yy + 0.5 - hy) / 6.5, -1, 1)
    hd, _ = lambert(hnx, hny)
    ht = 0.2 + 0.55 * hd
    hlay = layer()
    # Haube (orange-rot) oben, helles Gesicht unten
    put(hlay, head, ramp(np.clip(ht, 0, 1), PHX, THR))
    facem = ell_mask(hx, hy + 1.5, 5.2, 4.2) & head
    put(hlay, facem, ramp(np.clip(0.6 + 0.35 * hd, 0, 1), PHX, THR))
    # Haubenfedern (3 Flammen)
    crest = np.zeros((H, W), bool)
    for (ox, h_, lean) in [(-3, 7, -3), (0, 10, 0.5), (3, 7, 3)]:
        crest |= poly_mask([(hx + ox - 2.2, hy - 4), (hx + ox + lean * 0.5 - 1.2, hy - 4 - h_ * 0.6), (hx + ox + lean, hy - 4 - h_),
                            (hx + ox + lean * 0.3 + 1.4, hy - 4 - h_ * 0.5), (hx + ox + 2.2, hy - 4)])
    crest &= ~head
    ctt = 0.2 + 0.5 * np.clip(-(yy + 0.5 - hy + 4) / 10, 0, 1) + 0.15 * (xx + 0.5 < hx)
    put(hlay, crest, ramp(np.clip(1 - ctt, 0, 1) * 0.6 + 0.1, PHX, THR))
    put(hlay, crest & (np.abs(xx + 0.5 - hx) < 0.6) & (yy + 0.5 > hy - 11), PHX[4])
    hm = head | crest
    put(hlay, edge(hm), PHXL)
    # Augen
    for s_ in (-1, 1):
        ex, ey = hx + s_ * 2.6, hy + 0.3
        e = ell_mask(ex, ey, 1.2, 1.7)
        put(hlay, e, (40, 16, 24))
        put(hlay, (np.abs(xx + 0.5 - (ex - 0.5)) < 0.5) & (np.abs(yy + 0.5 - (ey - 0.6)) < 0.5), (255, 255, 255))
        put(hlay, ell_mask(hx + s_ * 4.6, hy + 2.6, 1.2, 0.8) & head, (255, 150, 180))
    # Schnabel
    bk = poly_mask([(hx - 1.6, hy + 2.2), (hx + 1.6, hy + 2.2), (hx, hy + 5)])
    put(hlay, bk, (250, 150, 40)); put(hlay, bk & (xx + 0.5 < hx), (255, 206, 90)); put(hlay, ring_out(bk) & ~head, PHXL)
    put(hlay, (np.abs(xx + 0.5 - hx) < 0.5) & (np.abs(yy + 0.5 - hy - 5.3) < 0.5), PHXL)
    return dict(tail=back, wings=wl, body=bl, head=hlay)
