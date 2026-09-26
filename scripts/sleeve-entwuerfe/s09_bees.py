# -*- coding: utf-8 -*-
"""09 Bomblebee-Wabe: Flug durch einen Wabengang im Bienenstock, dem Licht des Fluglochs entgegen.
Alles direkt in 1x-Leinwandpixeln gezeichnet (perspektivische Waben, Honig, Bienen nach den Kartenbildern
"Bomblebee", "Dive Bomblebee", "Burning Fuse" usw.) – keine hochskalierten Sprites."""
from lib import *

SQ3 = math.sqrt(3)
K = (14, 9, 12)
yy, xx = np.mgrid[0:H, 0:W].astype(float)


def bayer(shape, ox=0, oy=0):
    h, w = shape
    y, x = np.mgrid[0:h, 0:w]
    return BAYER4[(y + oy) % 4, (x + ox) % 4]


def ramp(t, cols, thr):
    """t (0..1) auf Farbrampe cols abbilden, zwischen Stufen gedithert."""
    t = np.clip(t, 0, 0.9999) * (len(cols) - 1)
    i = np.floor(t).astype(int)
    f = t - i
    i = np.where(f > thr, i + 1, i)
    return np.array(cols)[np.clip(i, 0, len(cols) - 1)]


# ------------------------------------------------------------------ Waben-Tunnel (Perspektive)
HONEY = [(92, 36, 6), (140, 62, 8), (190, 98, 14), (228, 140, 24), (250, 184, 48), (255, 222, 110)]
WAXR = [(52, 24, 8), (92, 48, 14), (140, 84, 28), (192, 128, 46), (230, 176, 82), (252, 222, 140)]
CAP = [(140, 90, 36), (190, 140, 64), (224, 182, 100), (244, 214, 138), (255, 238, 182)]
BROOD = [(16, 12, 18), (30, 26, 36), (50, 46, 60), (82, 78, 96)]
WOOD = [(30, 16, 10), (54, 30, 16), (82, 48, 24), (112, 70, 36), (146, 98, 52)]
GLOWC = (255, 234, 170)


def hexcells(u, v, R):
    """Pointy-top-Hexgitter auf beliebigen Koordinaten-Arrays."""
    q = (SQ3 / 3 * u - 1 / 3 * v) / R
    r = (2 / 3 * v) / R
    cx_, cz_ = q, r; cy_ = -cx_ - cz_
    rx, ry, rz = np.round(cx_), np.round(cy_), np.round(cz_)
    dx, dy, dz = np.abs(rx - cx_), np.abs(ry - cy_), np.abs(rz - cz_)
    c1 = (dx > dy) & (dx > dz)
    rx = np.where(c1, -ry - rz, rx)
    c2 = ~c1 & (dy > dz)
    ry = np.where(c2, -rx - rz, ry)
    rz = np.where(~c1 & ~c2, -rx - ry, rz)
    ccu = R * SQ3 * (rx + rz / 2)
    ccv = R * 1.5 * rz
    pu, pv = u - ccu, v - ccv
    apo = R * SQ3 / 2
    hexd = np.maximum(np.abs(pu) / apo, (np.abs(pu) * 0.5 + np.abs(pv) * SQ3 / 2) / apo)
    return hexd, pu, pv, rx, rz, apo


def h2(a, b, s=0):
    return (np.sin(a * 12.9898 + b * 78.233 + s * 37.719) * 43758.5453) % 1.0


def comb_surface(u, v, R, light, seed, thr, lu=(0.6, 0.8)):
    """Wabenfläche auf (u, v) rendern. light: Array 0..1+. Gibt RGB-Array und Zellinfos zurück."""
    hexd, pu, pv, rx, rz, apo = hexcells(u, v, R)
    de = (1 - hexd) * apo
    gy, gx = np.gradient(de)
    g = np.hypot(gx, gy)
    g = ndimage.median_filter(g, 3)
    de_px = de / np.maximum(g, 1e-4)
    rn = h2(rx, rz, seed)
    rn2 = h2(rx + 7.1, rz - 3.3, seed)
    clus = 0.5 + 0.25 * np.sin(rx * 0.9 + rz * 0.4 + seed) + 0.25 * np.sin(rz * 0.7 - rx * 0.3 + seed * 2)
    kind = np.zeros(u.shape, int)  # 0 leer 1 Honig 2 Deckel 3 Bombe
    kind[(clus + rn * 0.4) > 0.72] = 1
    kind[(clus < 0.42) & (rn < 0.55)] = 2
    kind[rn2 < 0.05] = 3
    r = np.hypot(pu, pv) + 1e-6
    nx, ny = pu / r, pv / r
    L_ = nx * lu[0] + ny * lu[1]
    apo_px = apo / np.maximum(g, 1e-4)
    fine = apo_px >= 4.5
    wall = (de_px < 1.05) | (de < 0.08 * apo)
    seam = de_px < 0.5
    inner = ~wall & (de < 0.3 * apo)
    out = np.zeros(u.shape + (3,), np.uint8)
    lw = np.clip((0.78 - 0.18 * L_) * light, 0, 1)
    out[:] = ramp(np.clip(0.22 * light, 0, 1), WAXR, thr)  # Zellboden (leer)
    ic = ramp(np.clip((0.42 + 0.3 * L_) * light, 0, 1), WAXR, thr)
    m = inner & (kind == 0); out[m] = ic[m]
    # Honig
    hl = np.clip((0.66 + 0.26 * L_ - 0.22 * r / apo + (rn - 0.5) * 0.25) * light, 0, 1)
    hc = ramp(hl, HONEY, thr)
    m = ~wall & (kind == 1); out[m] = hc[m]
    men = m & (de < 0.2 * apo) & (L_ < -0.25)
    out[men] = ramp(np.clip(0.2 * light[men], 0, 1), HONEY, thr[men])
    gl = fine & (kind == 1) & (np.hypot(pu + apo * 0.3, pv + apo * 0.34) < apo * 0.13) & (light > 0.45)
    out[gl] = (255, 248, 214)
    arc = fine & (kind == 1) & ~wall & (np.abs(r - apo * 0.56) < apo * 0.07) & (nx > 0.35) & (ny > 0.05) & (light > 0.5)
    out[arc] = HONEY[5]
    # Wachsdeckel
    dome = np.clip((0.66 - 0.28 * (pu + pv * 1.1) / apo + 0.08 * (1 - r / apo)) * light, 0, 1)
    cc = ramp(dome, CAP, thr)
    m = ~wall & (kind == 2); out[m] = cc[m]
    pore = fine & m & (h2(np.floor(u * 9), np.floor(v * 9), 3) < 0.1) & (de > 0.25 * apo)
    out[pore] = ramp(np.clip(dome[pore] - 0.25, 0, 1), CAP, thr[pore])
    # Bomben-Brut: schwarze Kuppel mit Glanz
    bb = np.clip((0.5 - 0.35 * (pu + pv) / apo) * light, 0, 1)
    bc = ramp(bb, BROOD, thr)
    m = ~wall & (kind == 3); out[m] = bc[m]
    bgl = fine & m & (np.hypot(pu + apo * 0.3, pv + apo * 0.3) < apo * 0.12)
    out[bgl] = (150, 150, 170)
    ring = fine & m & (de < 0.24 * apo)
    out[ring] = ramp(np.clip((0.6 - 0.3 * L_[ring]) * light[ring], 0, 1), [GOLD[0], GOLD[1], GOLD[2], GOLD[3]], thr[ring])
    # Wände
    wc = ramp(lw, WAXR, thr)
    out[wall] = wc[wall]
    sc = ramp(np.clip(lw - 0.3, 0, 1), WAXR, thr)
    out[seam & fine] = sc[seam & fine]
    return out


# ------------------------------------------------------------------ Bomblebee (1x gezeichnet)
BLACK = [(8, 6, 12), (18, 15, 24), (30, 27, 40), (46, 43, 60), (68, 66, 88), (104, 104, 128), (150, 152, 176)]
GOLD = [(96, 50, 8), (160, 96, 14), (222, 156, 30), (252, 204, 60), (255, 240, 150)]
WINGC = (242, 238, 222)
VEIN = (112, 82, 52)
WEDGE = (84, 62, 44)


def bee(R, tilt=0.0, flip=False, wing=0.0, fuse=1.0, rim=(214, 128, 36), eyes=True, seed=0, brow=True):
    """Bomblebee mit Körperradius R (Pixel). tilt in Grad (+ = im Uhrzeigersinn).
    Rückgabe: RGBA-Sprite (Flügel halbtransparent) und Ankerpunkt (Körpermitte) sowie Funkenposition."""
    S_ = int(R * 7) + 16
    cx0 = cy0 = S_ / 2
    ca, sa = math.cos(math.radians(tilt)), math.sin(math.radians(tilt))

    def T(x, y):
        return (cx0 + x * ca - y * sa, cy0 + x * sa + y * ca)

    img = Image.new('RGBA', (S_, S_), (0, 0, 0, 0))
    # ---- Flügel (hinter allem) ----
    wl = Image.new('RGBA', (S_, S_), (0, 0, 0, 0))
    dw = ImageDraw.Draw(wl)
    wlines = []
    for side in (-1, 1):
        for (L, Wd, ang, base, alpha) in [(1.25, 0.36, -8 + wing * 12, (0.62, -0.18), 180), (1.72, 0.5, 24 + wing * 22, (0.55, -0.48), 196)]:
            a0 = math.radians(ang)
            ux, uy = side * math.cos(a0), -math.sin(a0)
            vx, vy = -uy, ux
            bx, by = base[0] * R * side, base[1] * R
            pts = []
            for k in range(48):
                t = k / 48 * 2 * math.pi
                u = (1 - math.cos(t)) / 2  # 0..1 entlang Achse
                prof = math.sin(t) * (0.55 + 0.45 * u) * Wd * R  # Tropfenform, außen breiter
                x = bx + ux * u * L * R + vx * prof
                y = by + uy * u * L * R + vy * prof
                pts.append(T(x, y))
            dw.polygon(pts, fill=WINGC + (alpha,), outline=WEDGE + (255,))
            # Adern
            def P(u, v):
                return T(bx + ux * u * L * R + vx * v * Wd * R, by + uy * u * L * R + vy * v * Wd * R)
            wlines.append([P(0.05, 0), P(0.5, 0.12), P(0.92, 0.05)])
            wlines.append([P(0.1, 0.05), P(0.45, 0.55), P(0.8, 0.62)])
            wlines.append([P(0.1, -0.05), P(0.5, -0.5), P(0.82, -0.62)])
            wlines.append([P(0.45, 0.55), P(0.5, 0.12), P(0.5, -0.5)])
            if R >= 14:
                wlines.append([P(0.72, 0.6), P(0.75, 0.08), P(0.74, -0.6)])
                wlines.append([P(0.25, 0.35), P(0.3, 0.02), P(0.28, -0.3)])
    if R >= 7:
        for ln in wlines:
            dw.line(ln, fill=VEIN + (255,), width=1)
    # Iriszierender Schimmer / Glanz
    wa = np.array(wl)
    wm = (wa[..., 3] > 0) & (wa[..., 3] < 255)
    if R >= 9:
        yyw, xxw = np.mgrid[0:S_, 0:S_]
        band = wm & (((xxw * 0.5 + yyw) % 11) < 1.2) & (np.random.RandomState(seed).rand(S_, S_) < 0.9)
        wa[band] = (255, 255, 250, 200)
        sheen = wm & ~band & (((xxw - yyw) % 17) < 2)
        wa[sheen] = (206, 226, 236, 160)
    img.alpha_composite(Image.fromarray(wa))

    # ---- Beine ----
    body = Image.new('RGBA', (S_, S_), (0, 0, 0, 0))
    db = ImageDraw.Draw(body)
    lw = 2 if R >= 9 else 1
    nleg = 3 if R < 16 else 4
    for i in reversed(range(nleg)):
        for side in (-1, 1):
            f = i / max(1, nleg - 1)
            att = (side * (0.6 - 0.25 * f) * R, (0.42 + 0.35 * f) * R)
            knee = (side * (1.32 - 0.6 * f) * R, (0.08 + 0.85 * f) * R)
            ank = (side * (1.72 - 0.9 * f) * R, (0.58 + 0.85 * f) * R)
            tip = (side * (1.64 - 0.98 * f) * R, (0.86 + 0.76 * f) * R)
            P = [T(*att), T(*knee), T(*ank), T(*tip)]
            if R >= 16:
                fillc = BLACK[2] if i % 2 == 0 else BLACK[1]
                db.line(P[:2], fill=K + (255,), width=lw + 2)
                db.line(P[1:3], fill=K + (255,), width=lw + 1)
                db.line(P[2:4], fill=K + (255,), width=3)
                db.line(P[:2], fill=fillc + (255,), width=lw)
                db.line(P[1:3], fill=fillc + (255,), width=max(1, lw - 1))
                db.line(P[2:4], fill=fillc + (255,), width=1)
                # Glanzlinien oben/links
                db.line([(P[0][0] + side, P[0][1] - 1), (P[1][0] - side, P[1][1] - 1)], fill=BLACK[4] + (255,), width=1)
                db.line([(P[1][0] - 1, P[1][1] + 1), (P[2][0] - 1, P[2][1] - 1)], fill=BLACK[3] + (255,), width=1)
                db.point((round(P[1][0]), round(P[1][1]) - 1), fill=BLACK[5] + (255,))
                db.point((round(P[2][0]), round(P[2][1])), fill=BLACK[4] + (255,))
                # kleine Borsten
                mx, my = (P[1][0] + P[2][0]) / 2, (P[1][1] + P[2][1]) / 2
                db.point((round(mx + side * 2), round(my)), fill=K + (255,))
            elif R >= 9:
                db.line(P[:3], fill=BLACK[3] + (255,), width=1)
                db.line(P[2:4], fill=BLACK[2] + (255,), width=1)
                db.point((round(P[1][0]), round(P[1][1])), fill=BLACK[5] + (255,))
            else:
                db.line(P[:3], fill=K + (255,), width=1)
                db.line(P[2:4], fill=K + (255,), width=1)
    # ---- Körper ----
    ba = np.array(body)
    Y, X = np.mgrid[0:S_, 0:S_].astype(float)
    dx, dy = X - cx0 + 0.5, Y - cy0 + 0.5
    lx = dx * ca + dy * sa; ly = -dx * sa + dy * ca  # lokale Koords
    rx, ry = R * 1.04, R * 0.96
    q = (lx / rx) ** 2 + (ly / ry) ** 2
    fur = np.random.RandomState(seed + 3).rand(S_, S_)
    ins = q <= 1.0
    fringe = (q > 1.0) & (q < 1.0 + 3.2 / R) & (fur < 0.35) & (R >= 9)
    nz = np.sqrt(np.clip(1 - q, 0, 1))
    nxx, nyy = lx / rx, ly / ry
    Lx, Ly, Lz = -0.5, -0.62, 0.6
    ln = math.sqrt(Lx * Lx + Ly * Ly + Lz * Lz)
    dif = (nxx * Lx + nyy * Ly + nz * Lz) / ln
    tex = (value_noise(S_, S_, max(2, R // 5), seed=seed + 1, octaves=2) - 0.5) * 0.18
    shade = np.clip(0.18 + 0.62 * np.clip(dif, 0, 1) + tex, 0, 1)
    thr = bayer((S_, S_))
    col = ramp(shade * 0.82, BLACK[:6], 0.5 + (thr - 0.5) * 0.7)
    # warmer Randlicht (Honigschein) unten rechts
    rimv = np.clip((nxx * 0.55 + nyy * 0.8), 0, 1) * (1 - nz) ** 1.4
    rm = ins & (rimv > 0.16 + thr * 0.25)
    col[rm] = np.array(lerp(BLACK[3], rim, 0.55))
    rm2 = ins & (rimv > 0.36 + thr * 0.25)
    col[rm2] = np.array(rim)
    # Glanzpunkt
    sp = ins & (np.hypot(nxx + 0.38, nyy + 0.42) < 0.13)
    sp2 = ins & (np.hypot(nxx + 0.38, nyy + 0.42) < 0.24) & ~sp & (thr > 0.35)
    col[sp2] = BLACK[5]
    col[sp] = BLACK[6] if R >= 9 else BLACK[5]
    if R >= 16:
        spc = ins & (np.hypot(nxx + 0.42, nyy + 0.46) < 0.05)
        col[spc] = (236, 236, 250)
    bm = ins | fringe
    col[fringe] = BLACK[1]
    ba[bm, :3] = col[bm]; ba[bm, 3] = 255
    body = Image.fromarray(ba)
    db = ImageDraw.Draw(body)
    # ---- Gesicht: goldener Achteck-Ring ----
    fcx, fcy = 0.08 * R, 0.08 * R
    rr = 0.56 * R
    oct_o = [T(fcx + rr * math.cos(math.radians(22.5 + 45 * k)), fcy + rr * 0.92 * math.sin(math.radians(22.5 + 45 * k))) for k in range(8)]
    ri = rr - max(1.2, 0.16 * R)
    oct_i = [T(fcx + ri * math.cos(math.radians(22.5 + 45 * k)), fcy + ri * 0.92 * math.sin(math.radians(22.5 + 45 * k))) for k in range(8)]
    ring = Image.new('L', (S_, S_), 0)
    dr = ImageDraw.Draw(ring)
    dr.polygon(oct_o, fill=255)
    dr.polygon(oct_i, fill=0)
    rmk = np.array(ring) > 0
    ang = np.arctan2(ly - fcy, lx - fcx)
    gl = 0.55 - 0.4 * np.sin(ang + math.radians(45)) * 1.0
    gcol = ramp(np.clip(gl, 0, 1), GOLD, thr)
    face = Image.new('L', (S_, S_), 0)
    ImageDraw.Draw(face).polygon(oct_i, fill=255)
    fm = (np.array(face) > 0) & ~rmk
    ba = np.array(body)
    # Innenfläche: leicht gewölbt, dunkler
    fsh = np.clip(0.3 - 0.25 * ((lx - fcx) + (ly - fcy)) / R, 0, 1)
    fc = ramp(fsh, BLACK[:4], thr)
    ba[fm, :3] = fc[fm]
    ba[rmk, :3] = gcol[rmk]; ba[rmk, 3] = 255
    # Innenkante des Rings: dunkler Schatten oben links
    fe = fm & ndimage.binary_dilation(rmk) & ((ly - fcy) + (lx - fcx) < 0)
    ba[fe, :3] = BLACK[0]
    body = Image.fromarray(ba)
    db = ImageDraw.Draw(body)
    if eyes:
        for s_ in (-1, 1):
            ex, ey = fcx + s_ * 0.2 * R, fcy + 0.04 * R
            e0 = T(ex, ey)
            if R >= 20:
                ew, eh = 0.12 * R, 0.13 * R
                db.ellipse((e0[0] - ew, e0[1] - eh, e0[0] + ew, e0[1] + eh), fill=(236, 234, 222, 255))
                db.ellipse((e0[0] - ew + 1, e0[1] - eh + 2, e0[0] + ew - 1, e0[1] + eh), fill=(250, 250, 244, 255))
                pxp = e0[0] - s_ * ew * 0.25
                db.rectangle((pxp - 1, e0[1] - 1, pxp + 1, e0[1] + eh - 1), fill=(12, 10, 16, 255))
                db.point((pxp - 1, e0[1] - 1), fill=(255, 255, 255, 255))
                if brow:
                    b0 = T(ex - s_ * 0.17 * R, ey - 0.25 * R); b1 = T(ex + s_ * 0.13 * R, ey - 0.13 * R)
                    db.line([b0, b1], fill=BLACK[0] + (255,), width=2)
                    # Lid schneidet Augenoberkante
                    db.line([T(ex - s_ * 0.15 * R, ey - 0.17 * R), T(ex + s_ * 0.14 * R, ey - 0.05 * R)], fill=BLACK[1] + (255,), width=1)
            elif R >= 9:
                x0, y0 = int(round(e0[0])) - (1 if s_ < 0 else 0), int(round(e0[1])) - 1
                db.rectangle((x0, y0, x0 + 1, y0 + 2), fill=(240, 240, 232, 255))
                db.point((x0 + (1 if s_ < 0 else 0), y0 + 2), fill=(12, 10, 16, 255))
                db.point((x0 + (1 if s_ < 0 else 0), y0 + 1), fill=(12, 10, 16, 255))
            else:
                db.point((round(e0[0]), round(e0[1])), fill=(240, 240, 232, 255))
    # ---- Zündschnur ----
    neck_h = max(2, 0.2 * R); neck_w = max(2, 0.3 * R)
    ntop = -ry - neck_h + 1
    npoly = [T(-neck_w / 2, -ry + 1.5), T(neck_w / 2, -ry + 1.5), T(neck_w / 2, ntop), T(-neck_w / 2, ntop)]
    db.polygon(npoly, fill=BLACK[4] + (255,), outline=K + (255,))
    if R >= 12:
        db.line([T(-neck_w / 2 + 1, -ry + 1), T(-neck_w / 2 + 1, ntop + 1)], fill=BLACK[6] + (255,))
        db.line([T(-neck_w / 2 + 1, ntop + 0.5), T(neck_w / 2 - 1, ntop + 0.5)], fill=BLACK[5] + (255,))
    # Bezier
    p0 = (0, ntop); p1 = (0.05 * R, ntop - 0.45 * R * fuse); p2 = (0.55 * R * fuse, ntop - 0.35 * R * fuse); p3 = (0.62 * R * fuse, ntop - 0.75 * R * fuse)
    fpts = []
    for k in range(40):
        t = k / 39
        x = (1 - t) ** 3 * p0[0] + 3 * (1 - t) ** 2 * t * p1[0] + 3 * (1 - t) * t * t * p2[0] + t ** 3 * p3[0]
        y = (1 - t) ** 3 * p0[1] + 3 * (1 - t) ** 2 * t * p1[1] + 3 * (1 - t) * t * t * p2[1] + t ** 3 * p3[1]
        fpts.append(T(x, y))
    fw = 2 if R >= 14 else 1
    db.line(fpts, fill=(58, 38, 24, 255), width=fw)
    if R >= 14:
        for k in range(0, 39, 3):
            db.point((round(fpts[k][0] - 0.5), round(fpts[k][1] - 0.5)), fill=(170, 124, 70, 255))
    tipx, tipy = fpts[-1]
    body = outline(body, K + (255,))
    img.alpha_composite(body)
    d = ImageDraw.Draw(img)
    d.point((round(tipx), round(tipy)), fill=(255, 90, 30, 255))
    spark_at = (tipx, tipy)
    img = Image.fromarray(np.array(img))
    if flip:
        img = img.transpose(Image.FLIP_LEFT_RIGHT)
        spark_at = (S_ - 1 - tipx, tipy)
    return img, (cx0, cy0), spark_at


def draw_spark(d, x, y, size, rnd):
    x, y = int(round(x)), int(round(y))
    cols = [(255, 255, 230), (255, 236, 110), (255, 176, 40), (240, 96, 24)]
    if size >= 3:
        for i in range(1, size + 2):
            c = cols[min(3, i // 2 + (1 if i > size else 0))]
            for dx, dy in ((i, 0), (-i, 0), (0, i), (0, -i)):
                d.point((x + dx, y + dy), fill=c)
        for dx, dy in ((1, 1), (-1, -1), (1, -1), (-1, 1)):
            d.point((x + dx, y + dy), fill=cols[1])
        for _ in range(size * 3):
            a_ = rnd.uniform(0, 2 * math.pi); r_ = rnd.uniform(size * 0.8, size * 2.6)
            d.point((x + round(math.cos(a_) * r_), y + round(math.sin(a_) * r_)), fill=rnd.choice(cols[1:]))
    else:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            d.point((x + dx, y + dy), fill=cols[2 if size < 2 else 1])
        if size >= 2:
            for dx, dy in ((2, 0), (-2, 0), (0, 2), (0, -2)):
                d.point((x + dx, y + dy), fill=cols[3])
    d.point((x, y), fill=cols[0])


def honey_drip(d, x, y0, L, w=3, bulb=3):
    """Honigfaden mit Tropfen, x/y0 = Ansatz an der Wabenkante."""
    for yy_ in range(y0, y0 + L):
        t = (yy_ - y0) / max(1, L)
        ww = max(1, round(w * (1 - 0.55 * math.sin(t * math.pi * 0.9))))
        x0 = x - ww // 2
        d.line((x0, yy_, x0 + ww - 1, yy_), fill=HONEY[3])
        if ww >= 2:
            d.point((x0, yy_), fill=HONEY[5])
            d.point((x0 + ww - 1, yy_), fill=HONEY[1])
        else:
            d.point((x0, yy_), fill=HONEY[4])
    by = y0 + L + bulb - 1
    d.ellipse((x - bulb, by - bulb, x + bulb, by + bulb), fill=HONEY[3])
    d.arc((x - bulb, by - bulb, x + bulb, by + bulb), 0, 150, fill=HONEY[1])
    d.arc((x - bulb, by - bulb, x + bulb, by + bulb), 30, 120, fill=HONEY[0])
    d.point((x - bulb + 1, by - 1), fill=(255, 250, 220))
    if bulb >= 3:
        d.point((x - bulb + 1, by), fill=HONEY[5])
        d.point((x + 1, by + bulb - 1), fill=HONEY[4])
    return by + bulb


def falling_drop(d, x, y, r=2):
    d.ellipse((x - r, y - r, x + r, y + r), fill=HONEY[3])
    d.line((x, y - r - 2, x, y - r), fill=HONEY[3])
    d.point((x, y - r - 3), fill=HONEY[4])
    d.point((x - r + 1, y - 1), fill=(255, 250, 220))
    d.point((x + r - 1, y + 1), fill=HONEY[1])



# ============================================================ Szene: Wabengang im Bienenstock
VPX, VPY, F = 125.0, 118.0, 118.0
HC, HF, ZE = 1.35, 2.5, 7.0
dx = xx + 0.5 - VPX
dy = yy + 0.5 - VPY
INF = 1e9
zL = np.where(dx < 0, F / np.maximum(-dx, 1e-6), INF)
zR = np.where(dx > 0, F / np.maximum(dx, 1e-6), INF)
zC = np.where(dy < 0, F * HC / np.maximum(-dy, 1e-6), INF)
zF = np.where(dy > 0, F * HF / np.maximum(dy, 1e-6), INF)
Z = np.stack([zL, zR, zC, zF, np.full_like(zL, ZE)])
surf = np.argmin(Z, 0)
z = np.min(Z, 0)
X = dx * z / F
Y = dy * z / F
thr = bayer((H, W))
thrs = 0.5 + (thr - 0.5) * 0.4
# Licht: vom Eingang (tief) + Vignette vorne
vig = np.hypot((xx - VPX) / 150, (yy - 150) / 200)
light = np.clip(0.5 + 0.13 * z - 0.42 * np.clip(vig - 0.35, 0, 1), 0, 1.2)
# ---- Wände ----
a = np.zeros((H, W, 4), np.uint8); a[..., 3] = 255
u = np.where(surf == 0, 1, -1) * 1.6 * np.log(np.maximum(z, 0.3))
v = Y
wallrgb = comb_surface(u, v, 0.088, light, 5, thrs)
m = surf <= 1
a[m, :3] = wallrgb[m]
# ---- Decke: Holzleisten (Rähmchen-Oberträger) ----
plank = np.floor((X + 2) * 4)
fx = ((X + 2) * 4) % 1
pn = h2(plank, 0)
grain = value_noise(W, H, 3, seed=2, octaves=2)
gline = (np.sin(fx * 18 + pn * 9 + np.sin(z * 3 + pn * 5) * 1.4) > 0.86)
wl = np.clip((0.38 + 0.18 * pn + 0.15 * (0.5 - np.abs(fx - 0.5))) * light * 0.85 + (grain - 0.5) * 0.12, 0, 1)
wl = np.where(gline, wl - 0.14, wl)
woodc = ramp(wl, WOOD, thrs)
woodc[fx < 0.06] = WOOD[0]
woodc[(fx > 0.06) & (fx < 0.1)] = WOOD[3]
# Nägel
nail = (np.abs(fx - 0.5) < 0.06) & ((z * 1.2 + pn) % 1 < 0.05) & (z < 2.6) & (z > 1.5)
woodc[nail] = WOOD[4]
m = surf == 2
a[m, :3] = woodc[m]
# ---- Boden: Honigsee mit Lichtspiegelung ----
band = np.clip(1 - np.abs(X) / (0.16 + 0.06 * z), 0, 1)
und = 0.5 + 0.5 * np.sin(z * 5 + np.sin(X * 4) * 0.8)
fl = np.clip(0.14 + 0.075 * z + band * 0.3 + 0.05 * und, 0, 1)
hon = ramp(fl, HONEY, thrs)
m = surf == 3
a[m, :3] = hon[m]
# Glanzstreifen (perspektivisch dichter werdend)
rs_ = random.Random(5)
zk = 1.15
while zk < 6.5:
    sy_ = int(VPY + HF * F / zk)
    half = (0.22 + 0.08 * zk) * F / zk
    x0 = VPX - half * rs_.uniform(0.6, 1.1)
    while x0 < VPX + half:
        ln_ = rs_.uniform(2, 9) * (F / zk) / 60
        x1 = min(x0 + ln_, VPX + half)
        if 0 <= sy_ < H:
            col_ = HONEY[5] if abs((x0 + x1) / 2 - VPX) < half * 0.5 else HONEY[4]
            for xq in range(int(x0), int(x1) + 1):
                if 0 <= xq < W and surf[sy_, xq] == 3:
                    a[sy_, xq, :3] = col_
        x0 = x1 + rs_.uniform(2, 8) * (F / zk) / 60
    zk *= 1.14
# ---- Stirnwand mit Flugloch ----
m = surf == 4
ewn = value_noise(W, H, 3, seed=8, octaves=2)
ew = ramp(np.clip(0.28 + 0.3 * ewn, 0, 1), WAXR, thr)
a[m, :3] = ew[m]
HOX, HOY, HOR = VPX, VPY + 8, 12.5
hd = np.hypot(xx + 0.5 - HOX, (yy + 0.5 - HOY) * 1.05)
ringm = m & (hd <= HOR + 2.5)
a[ringm, :3] = ramp(np.clip(0.2 + 0.5 * ((yy[ringm] - HOY) > 0), 0, 1), WAXR, thr[ringm])
hole = hd <= HOR
# Licht im Flugloch + Blumen-Silhouetten der Wiese draußen
sky = ramp(np.clip(1 - (hd / HOR) ** 2, 0, 1), [(255, 206, 120), (255, 232, 176), (255, 248, 222), (255, 255, 246)], thr)
a[hole, :3] = sky[hole]
lh = Image.fromarray(a); dl = ImageDraw.Draw(lh)
SIL = (206, 138, 60)
for (fx_, h_, kind_) in [(-9, 5, 1), (-6, 8, 0), (-3, 4, 2), (1, 7, 1), (4, 9, 0), (7, 5, 2), (10, 4, 1)]:
    bx_ = int(HOX + fx_); by_ = int(HOY + HOR)
    dl.line((bx_, by_ - h_, bx_, by_), fill=SIL)
    if kind_ == 0:
        dl.point([(bx_ - 1, by_ - h_), (bx_ + 1, by_ - h_), (bx_, by_ - h_ - 1), (bx_, by_ - h_ + 1)], fill=SIL)
    elif kind_ == 1:
        dl.point([(bx_ - 1, by_ - h_ + 2), (bx_ + 1, by_ - h_ + 3)], fill=SIL)
    else:
        dl.point([(bx_ - 1, by_ - h_), (bx_ + 1, by_ - h_)], fill=SIL)
dl.line((HOX - HOR, int(HOY + HOR) - 1, HOX + HOR, int(HOY + HOR) - 1), fill=SIL)
a = np.array(lh)
a[~hole & (surf == 4) & (hd <= HOR + 0.8), :3] = (255, 250, 220)


# Nebel/Licht in die Tiefe (weich, wenige Stufen)
def blend_to(a, t, col, steps=6):
    t = np.clip(t, 0, 1)
    tq = np.floor(t * steps + thr * 0.999) / steps  # leicht gedithert, grob gestuft
    f = tq[..., None]
    a[..., :3] = np.clip(a[..., :3] * (1 - f) + np.array(col) * f, 0, 255).astype(np.uint8)


fog = np.clip((z - 3.0) / 5.0, 0, 1) ** 1.1 * (~hole)
blend_to(a, fog * 0.85, GLOWC, 5)
ang = np.arctan2(yy + 0.5 - HOY, xx + 0.5 - HOX)
rays = np.clip((np.sin(ang * 5 + 0.9) * 0.6 + np.sin(ang * 11 + 2.3) * 0.4) - 0.35, 0, 1)
rt = np.clip(1 - (hd - HOR) / 150, 0, 1) ** 1.6 * rays * 0.35 + np.clip(1 - (hd - HOR) / 34, 0, 1) ** 1.8 * 0.55
blend_to(a, rt * ~hole, (255, 244, 200), 4)
im = Image.fromarray(a)


def tiny_bee(d, x, y, r, dark=(66, 38, 20), wingc=(255, 252, 236)):
    """Winzige Gegenlicht-Biene (Silhouette) für die Ferne."""
    x, y = int(round(x)), int(round(y))
    if r <= 1:
        d.point([(x, y), (x + 1, y)], fill=dark)
        d.point([(x - 1, y - 1), (x + 2, y - 1)], fill=wingc)
        return
    d.rectangle((x - 1, y - 1, x + 1, y + 1), fill=dark)
    d.point([(x - 2, y), (x + 2, y), (x, y - 2), (x, y + 2)], fill=dark)
    d.point([(x - 3, y - 2), (x - 2, y - 3), (x - 3, y - 3), (x + 3, y - 2), (x + 2, y - 3), (x + 3, y - 3)], fill=wingc)
    d.point((x, y), fill=GOLD[2])
    d.point((x + 1, y - 3), fill=(255, 190, 70))


def proj(Xw, Yw, zw):
    return VPX + Xw * F / zw, VPY + Yw * F / zw


# ---- Wachsleiste an der Decke + Honigfäden ----
d = ImageDraw.Draw(im)
for side in (-1, 1):
    for x_ in range(W):
        dxx = x_ + 0.5 - VPX
        if dxx * side <= 0:
            continue
        yj = VPY - HC * abs(dxx)
        if yj < -3 or abs(dxx) < 16:
            continue
        th = max(1, int(abs(dxx) / 40))
        yj = int(round(yj))
        for k in range(-1, th + 1):
            yq = yj + k
            if 0 <= yq < H:
                im.putpixel((x_, yq), (WAXR[5] if k <= 0 else WAXR[3] if k < th else WAXR[1]) + (255,))
# (Wandseite, Tiefe z, Länge, Breite, Tropfengröße)
drip_spots = [(-1, 1.02, 30, 3, 3), (-1, 1.2, 12, 2, 2), (-1, 1.45, 40, 2, 3), (-1, 1.8, 14, 2, 2), (-1, 2.3, 20, 1, 2), (-1, 3.0, 8, 1, 1),
              (1, 1.05, 44, 3, 4), (1, 1.3, 16, 2, 2), (1, 1.62, 26, 2, 3), (1, 2.1, 10, 1, 2), (1, 2.7, 14, 1, 1)]
for (sgn, zs, L0, w0, b0) in drip_spots:
    sx = int(round(VPX + sgn * F / zs))
    sy = int(round(VPY - HC * F / zs)) + 1
    if sy < 0:
        continue
    d.ellipse((sx - w0 - 1, sy - 1, sx + w0 + 1, sy + 2), fill=HONEY[3])
    d.point((sx - w0, sy), fill=HONEY[5])
    end = honey_drip(d, sx, sy + 1, L0, w=w0 + 2, bulb=b0 + 1)
    if L0 > 24:
        falling_drop(d, sx, end + 12, 2)

# ---- Schwarm aus dem Flugloch ----
d = ImageDraw.Draw(im)
BR = 0.1
# (X, Y, z, tilt, flip, wing)
swarm3d = [
    (0.1, -0.12, 6.4, 0, False, 0),
    (-0.22, 0.02, 5.7, 0, False, 0), (0.26, 0.06, 5.4, 0, True, 0), (-0.05, 0.3, 5.0, 0, False, 0),
    (0.3, 0.3, 4.4, 0, True, 0), (-0.32, -0.14, 4.0, 0, False, 0), (0.05, -0.3, 3.7, 0, False, 0), (0.36, -0.06, 3.5, 0, True, 0),
    (-0.45, 0.35, 3.2, 8, False, 0.2), (0.5, 0.42, 2.8, -8, True, 0.1), (-0.12, -0.46, 2.6, 4, False, 0.3), (0.42, -0.4, 2.3, -10, True, 0.2),
    (-0.58, -0.3, 2.0, 10, False, 0.1), (0.62, 0.2, 1.7, -12, True, 0.3), (-0.6, 0.5, 1.5, 12, False, 0.0), (-0.34, -0.72, 1.3, 6, False, 0.2),
    (-0.78, -0.2, 0.95, 14, False, 0.3), (0.8, 0.62, 0.9, -8, True, 0.1), (-0.72, 1.12, 0.72, 16, False, 0.2),
]
swarm3d.sort(key=lambda s_: -s_[2])
sparks = []
for i, (Xw, Yw, zw, tl, fl, wg) in enumerate(swarm3d):
    sx, sy = proj(Xw, Yw, zw)
    R_ = BR * F / zw
    if R_ < 3.6:
        tiny_bee(d, sx, sy, int(R_ + 0.2))
    else:
        b, c, sp = bee(int(round(R_)), tilt=tl, flip=fl, wing=wg, seed=20 + i)
        # Dunst: entfernte Bienen aufhellen
        haze = float(np.clip((zw - 1.6) / 3.0, 0, 0.6))
        if haze > 0:
            ba_ = np.array(b).astype(float)
            ba_[..., :3] = ba_[..., :3] * (1 - haze) + np.array((196, 128, 56)) * haze
            b = Image.fromarray(ba_.clip(0, 255).astype(np.uint8))
        bx, by = int(sx - c[0]), int(sy - c[1])
        # Rauchspur der Zündschnur Richtung Flugloch
        spx_, spy_ = bx + sp[0], by + sp[1]
        vx_, vy_ = HOX - spx_, HOY - spy_
        n_ = math.hypot(vx_, vy_) + 1e-6
        for k in range(1, 5 if R_ >= 8 else 1):
            t_ = k * R_ * 0.45 + 2
            px_ = spx_ + vx_ / n_ * t_ + math.sin(k * 1.7 + i) * 1.5
            py_ = spy_ + vy_ / n_ * t_ - k * 0.8
            c1 = (228, 206, 170) if k < 2 else (200, 170, 130)
            if k < 3:
                d.point([(px_, py_), (px_ + 1, py_), (px_, py_ - 1)], fill=c1)
            else:
                d.point((px_, py_), fill=c1)
        paste(im, b, (bx, by))
        d = ImageDraw.Draw(im)
        sparks.append((bx + sp[0], by + sp[1], 3 if R_ >= 9 else (2 if R_ >= 6 else 1)))
for (x_, y_, s_) in sparks:
    draw_spark(d, x_, y_, s_, random.Random(int(x_ * 7 + y_)))

# ---- Held ----
hero, hc, hsp = bee(33, tilt=-5, seed=3, wing=0.15)
HX, HY = 125, 236
hx, hy = int(HX - hc[0]), int(HY - hc[1])
# Spiegelung im Honig
FLOOR_Y = 284
ha = np.array(hero)
refl = np.zeros((H, W, 4), np.uint8)
hh_, ww_ = ha.shape[:2]
for ry_ in range(hh_):
    ty = int(2 * FLOOR_Y - (hy + ry_))
    if not (0 <= ty < H) or ty < FLOOR_Y - 4:
        continue
    shift = int(round(1.6 * math.sin(ty * 0.9)))
    row = ha[ry_]
    for rx_ in range(ww_):
        tx = hx + rx_ + shift
        if 0 <= tx < W and row[rx_, 3] > 0:
            refl[ty, tx] = row[rx_]
rm_ = refl[..., 3] > 0
dist_f = np.clip((yy - FLOOR_Y) / 70, 0, 1)
fq = (np.floor((0.62 - dist_f * 0.45) * 4) / 4)[..., None]
base = np.array(im)
rc = refl[..., :3].astype(float)
lum = rc.mean(2, keepdims=True) / 255
tgt = np.array(HONEY[0], float) * (1 - lum) + np.array(HONEY[5], float) * lum
mix = base[..., :3] * (1 - fq) + tgt * fq
keep = rm_ & (yy >= FLOOR_Y)
base[keep, :3] = np.clip(mix[keep], 0, 255).astype(np.uint8)
im = Image.fromarray(base)
paste(im, hero, (hx, hy))
d = ImageDraw.Draw(im)
sx_, sy_ = hx + hsp[0], hy + hsp[1]
sg = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ImageDraw.Draw(sg).ellipse((sx_ - 2, sy_ - 2, sx_ + 2, sy_ + 2), fill=(255, 255, 255, 255))
gls, p = glow(sg, (255, 200, 90, 255), radius=4, strength=0.6)
paste(im, gls, (-p, -p))
d = ImageDraw.Draw(im)
draw_spark(d, sx_, sy_, 6, random.Random(4))


# ---- Dive Bomblebees (gestreifte Sturzflug-Bienen) ----
def dive_bee(img, cx, cy, L, ang, seed=0):
    ca_, sa_ = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    r_ = L * 0.2
    S2 = int(L * 2.2)
    x0_, y0_ = int(cx - S2 / 2), int(cy - S2 / 2)
    Yq, Xq = np.mgrid[0:S2, 0:S2].astype(float)
    ddx, ddy = Xq + x0_ + 0.5 - cx, Yq + y0_ + 0.5 - cy
    u_ = ddx * ca_ + ddy * sa_          # entlang Körper (Nase bei +)
    sv = -1 if ca_ < 0 else 1
    v_ = sv * (-ddx * sa_ + ddy * ca_)  # quer (neg = oben/Licht)
    half = L / 2
    prof = np.where(u_ > half * 0.35, r_ * np.sqrt(np.clip(1 - ((u_ - half * 0.35) / (half * 0.65)) ** 2, 0, 1)),
                    np.where(u_ < -half * 0.7, r_ * np.sqrt(np.clip(1 - ((u_ + half * 0.7) / (half * 0.3)) ** 2, 0, 1)), r_))
    ins = (np.abs(v_) <= prof) & (np.abs(u_) <= half)
    th = bayer((S2, S2))
    shade = np.clip(0.75 - 0.5 * v_ / r_, 0, 1)
    stripe = (np.floor((u_ + half) / (L / 7)) % 2 == 0) & (u_ < half * 0.4)
    yel = ramp(np.clip(shade, 0, 1), [GOLD[0], GOLD[1], GOLD[2], GOLD[3], GOLD[4]], 0.5 + (th - 0.5) * 0.6)
    blk = ramp(np.clip(shade * 0.7, 0, 1), BLACK[:5], 0.5 + (th - 0.5) * 0.6)
    col = np.where(stripe[..., None], yel, blk)
    # Gesichtsring an der Nase
    ring_ = ins & (np.abs(u_ - half * 0.62) < 0.9) & (np.abs(v_) < prof - 0.5)
    col[ring_] = GOLD[3]
    eye = ins & (np.abs(u_ - half * 0.8) < 1.0) & (np.abs(v_ + r_ * 0.2) < 1.0)
    col[eye] = (240, 240, 232)
    spec = ins & (np.abs(v_ + r_ * 0.62) < 0.6) & (u_ > -half * 0.6) & (u_ < half * 0.5)
    col[spec] = (255, 250, 214)
    sp = np.zeros((S2, S2, 4), np.uint8)
    sp[ins, :3] = col[ins]; sp[ins, 3] = 255
    body_ = outline(Image.fromarray(sp), K + (255,))
    layer = Image.new('RGBA', (S2, S2), (0, 0, 0, 0))
    dl_ = ImageDraw.Draw(layer)

    def T2(uu, vv):
        return (cx - x0_ + uu * ca_ - sv * vv * sa_, cy - y0_ + uu * sa_ + sv * vv * ca_)
    # Flügel nach hinten gefegt
    for (wu, wl_, ww, wa_) in [(0.05, 0.62, 0.2, 200), (-0.1, 0.5, 0.16, 180)]:
        pts = []
        for k in range(24):
            t_ = k / 24 * 2 * math.pi
            uu = wu * L - (1 - math.cos(t_)) / 2 * wl_ * L
            vv = -r_ - (1 - math.cos(t_)) / 2 * wl_ * L * 0.55 + math.sin(t_) * ww * L
            pts.append(T2(uu, vv))
        dl_.polygon(pts, fill=WINGC + (wa_,), outline=WEDGE + (255,))
        dl_.line([T2(wu * L - 1, -r_ - 1), T2(wu * L - wl_ * L * 0.9, -r_ - wl_ * L * 0.5)], fill=VEIN + (255,))
    # Heckflossen + Zündschnur
    dl_.polygon([T2(-half + 1, 0), T2(-half - L * 0.12, -r_ * 1.4), T2(-half - L * 0.05, 0)], fill=K + (255,))
    dl_.polygon([T2(-half + 1, 0), T2(-half - L * 0.12, r_ * 1.4), T2(-half - L * 0.05, 0)], fill=K + (255,))
    fz = [T2(-half - 1, 0), T2(-half - L * 0.12, -r_ * 0.3), T2(-half - L * 0.2, 0.2 * r_)]
    dl_.line(fz, fill=(70, 46, 28, 255))
    layer.alpha_composite(body_)
    # Tempolinien
    dimg = ImageDraw.Draw(img)
    for k, vv in enumerate((-r_ * 0.6, r_ * 0.1, r_ * 0.8)):
        p0 = (cx + (-half - 3) * ca_ - vv * sa_, cy + (-half - 3) * sa_ + vv * ca_)
        ln_ = L * (1.1 + 0.4 * (k % 2))
        p1 = (p0[0] - ln_ * ca_, p0[1] - ln_ * sa_)
        for t_ in np.linspace(0, 1, int(ln_)):
            if t_ < 0.55 or (int(t_ * ln_) % 2 == 0):
                dimg.point((round(p0[0] + (p1[0] - p0[0]) * t_), round(p0[1] + (p1[1] - p0[1]) * t_)), fill=(255, 240, 196) if t_ < 0.4 else (230, 190, 120))
    img.alpha_composite(layer, (x0_, y0_))
    tipx, tipy = x0_ + fz[-1][0], y0_ + fz[-1][1]
    draw_spark(ImageDraw.Draw(img), tipx, tipy, 2, random.Random(seed))


dive_bee(im, 198, 52, 30, 132, seed=1)
dive_bee(im, 42, 150, 18, 66, seed=2)


# ---- Explosion (eine Bombe ist schon hochgegangen) ----
def explosion(img, cx, cy, r, seed=1):
    rs = random.Random(seed)
    a_ = np.array(img)
    # Blitzlicht auf der Umgebung
    dd_ = np.hypot(xx - cx, (yy - cy) * 1.1)
    fl_ = np.clip(1 - dd_ / (r * 2.6), 0, 1) ** 1.3 * 0.6
    f_ = (np.floor(fl_ * 4 + thr * 0.999) / 4)[..., None]
    a_[..., :3] = np.clip(a_[..., :3] * (1 - f_) + np.array((255, 170, 60)) * f_, 0, 255).astype(np.uint8)
    img = Image.fromarray(a_)
    SM = [(52, 32, 24), (84, 58, 42), (120, 88, 62), (160, 124, 88), (204, 170, 124)]
    puffs = []
    for k in range(14):
        ang_ = rs.uniform(0, 2 * math.pi)
        dd = r * rs.uniform(0.45, 0.95)
        up_ = max(0.0, -math.sin(ang_)) * r * 0.35
        puffs.append((cx + math.cos(ang_) * dd, cy + math.sin(ang_) * dd * 0.75 - up_, r * rs.uniform(0.26, 0.44)))
    for k in range(5):
        puffs.append((cx + rs.uniform(-0.5, 0.3) * r, cy - r * rs.uniform(0.9, 1.45), r * rs.uniform(0.2, 0.34)))
    sm = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ds = ImageDraw.Draw(sm)
    for (px_, py_, pr) in puffs:
        ds.ellipse((px_ - pr, py_ - pr, px_ + pr, py_ + pr), fill=SM[1] + (255,))
    for (px_, py_, pr) in puffs:
        vx_, vy_ = cx - px_, cy - py_
        n_ = math.hypot(vx_, vy_) + 1e-6
        ox_, oy_ = vx_ / n_ * pr * 0.25, vy_ / n_ * pr * 0.25 - pr * 0.1
        ds.ellipse((px_ + ox_ - pr * 0.72, py_ + oy_ - pr * 0.72, px_ + ox_ + pr * 0.72, py_ + oy_ + pr * 0.72), fill=SM[2] + (255,))
        ds.ellipse((px_ + ox_ * 1.8 - pr * 0.42, py_ + oy_ * 1.8 - pr * 0.42, px_ + ox_ * 1.8 + pr * 0.42, py_ + oy_ * 1.8 + pr * 0.42), fill=SM[3] + (255,))
        ds.point((px_ + ox_ * 2.2 - pr * 0.2, py_ + oy_ * 2.2 - pr * 0.2), fill=SM[4] + (255,))
    # Unterseite dunkler
    sa = np.array(sm)
    smm = sa[..., 3] > 0
    lower = smm & ~np.roll(smm, -2, 0)
    sa[lower, :3] = SM[0]
    sm = outline(Image.fromarray(sa), (30, 16, 12, 255))
    img.alpha_composite(sm)
    d = ImageDraw.Draw(img)
    # Feuerball aus Lappen
    FIRE = [(150, 30, 20), (214, 64, 22), (248, 130, 30), (255, 200, 60), (255, 244, 170), (255, 255, 240)]
    for li, (rf, col) in enumerate([(1.0, FIRE[0]), (0.86, FIRE[1]), (0.7, FIRE[2]), (0.52, FIRE[3]), (0.34, FIRE[4]), (0.17, FIRE[5])]):
        rs2 = random.Random(seed * 10 + li)
        for k in range(8):
            ang_ = k / 8 * 2 * math.pi + li * 0.4
            rr_ = r * rf * 0.34
            ox_ = cx + math.cos(ang_) * r * rf * 0.42 * rs2.uniform(0.7, 1.15)
            oy_ = cy + math.sin(ang_) * r * rf * 0.38 * rs2.uniform(0.7, 1.15)
            d.ellipse((ox_ - rr_, oy_ - rr_, ox_ + rr_, oy_ + rr_), fill=col)
        d.ellipse((cx - r * rf * 0.5, cy - r * rf * 0.46, cx + r * rf * 0.5, cy + r * rf * 0.46), fill=col)
    # Strahlen
    for k in range(8):
        ang_ = k / 8 * 2 * math.pi + 0.3
        r0, r1 = r * 0.8, r * rs.uniform(1.25, 1.6)
        d.line((cx + math.cos(ang_) * r0, cy + math.sin(ang_) * r0, cx + math.cos(ang_) * r1, cy + math.sin(ang_) * r1), fill=FIRE[4] if k % 2 else FIRE[3])
    # Wabensplitter und Honigtropfen
    for k in range(18):
        ang_ = rs.uniform(0, 2 * math.pi)
        dd = r * rs.uniform(1.1, 1.8)
        x_ = cx + math.cos(ang_) * dd; y_ = cy + math.sin(ang_) * dd
        x2 = cx + math.cos(ang_) * (dd - r * 0.3); y2 = cy + math.sin(ang_) * (dd - r * 0.3)
        d.line((x2, y2, x_, y_), fill=(150, 90, 40))
        if rs.random() < 0.55:
            s_ = rs.choice([1, 2, 2, 3])
            d.rectangle((x_, y_, x_ + s_, y_ + s_ - 1), fill=WAXR[4])
            d.point((x_ + s_, y_ + s_ - 1), fill=WAXR[2])
            d.point((x_, y_), fill=WAXR[5])
        else:
            d.point([(x_, y_), (x_ + 1, y_), (x_, y_ + 1), (x_ + 1, y_ + 1)], fill=HONEY[3])
            d.point((x_, y_), fill=HONEY[5])
    for k in range(24):
        ang_ = rs.uniform(0, 2 * math.pi); dd = r * rs.uniform(0.9, 1.7)
        d.point((cx + math.cos(ang_) * dd, cy + math.sin(ang_) * dd), fill=rs.choice([(255, 250, 200), (255, 200, 60), (255, 140, 40)]))
    return img


im = explosion(im, 216, 266, 20, seed=3)


# ---- Titel ----
def title(txt, size):
    f = ImageFont.truetype(FONT, size)
    bb = f.getbbox(txt)
    w_, h_ = bb[2] - bb[0] + 8, bb[3] - bb[1] + 8
    mk = Image.new('L', (w_, h_), 0)
    dm = ImageDraw.Draw(mk); dm.fontmode = '1'
    dm.text((4 - bb[0], 4 - bb[1]), txt, font=f, fill=255)
    m_ = np.array(mk) > 127
    ys_ = np.nonzero(m_.any(1))[0]; y0_, y1_ = ys_[0], ys_[-1]
    out = np.zeros((h_, w_, 4), np.uint8)
    t_ = (np.mgrid[0:h_, 0:w_][0] - y0_) / max(1, y1_ - y0_)
    cols = ramp(np.clip(1 - t_, 0, 1), [GOLD[1], GOLD[2], GOLD[3], GOLD[4]], 0.5 + (bayer((h_, w_)) - 0.5) * 0.5)
    out[m_, :3] = cols[m_]; out[m_, 3] = 255
    # obere Kante hell
    top_ = m_ & ~np.roll(m_, 1, 0)
    out[top_, :3] = (255, 250, 214)
    img_ = Image.fromarray(out)
    img_ = outline(img_, K + (255,))
    sh_ = silhouette(img_, (60, 24, 8, 255))
    base_ = Image.new('RGBA', (w_ + 1, h_ + 2), (0, 0, 0, 0))
    base_.alpha_composite(sh_, (1, 2))
    base_.alpha_composite(img_, (0, 0))
    return base_.crop(base_.getbbox())


t_img = title('BOMBLEBEES', 18)
tx, ty = W // 2 - t_img.width // 2, 318
# dunkler Grund hinter dem Titel (weich)
dd_ = np.hypot((xx - W / 2) / 90, (yy - (ty + 8)) / 18)
a_ = np.array(im)
f_ = (np.floor(np.clip(1.1 - dd_, 0, 1) * 3 + thr * 0.999) / 3 * 0.55)[..., None]
a_[..., :3] = np.clip(a_[..., :3] * (1 - f_) + np.array((40, 16, 6)) * f_, 0, 255).astype(np.uint8)
im = Image.fromarray(a_)
paste(im, t_img, (tx, ty))
d = ImageDraw.Draw(im)
# Honig tropft von den Buchstaben
for (ox_, L_) in [(9, 5), (38, 8), (70, 4), (101, 7)]:
    x_ = tx + ox_
    col_ = np.nonzero(np.array(t_img)[:, ox_, 3] > 0)[0]
    if len(col_) == 0:
        continue
    y_ = ty + col_[-1]
    d.line((x_, y_, x_, y_ + L_), fill=HONEY[3])
    d.point((x_, y_ + L_ + 1), fill=HONEY[3]); d.point((x_ - 1, y_ + L_ + 1), fill=HONEY[3]); d.point((x_ + 1, y_ + L_ + 1), fill=HONEY[1])
    d.point((x_ - 1, y_ + L_), fill=HONEY[5])

# ---- Rahmen ----
bevel_frame(im, K, WAXR[5], GOLD[2], GOLD[0], K, width=5)
d = ImageDraw.Draw(im)
for (x_, y_) in [(8, 8), (W - 9, 8), (8, H - 9), (W - 9, H - 9)]:
    hexp = [(x_ + 5 * math.cos(math.radians(30 + 60 * k)), y_ + 5 * math.sin(math.radians(30 + 60 * k))) for k in range(6)]
    d.polygon(hexp, fill=GOLD[2], outline=K)
    d.point([(x_ - 1, y_ - 2), (x_ - 2, y_ - 1)], fill=GOLD[4])
    d.point((x_, y_), fill=K)
print(save(im, '09_bomblebee_wabe'))
