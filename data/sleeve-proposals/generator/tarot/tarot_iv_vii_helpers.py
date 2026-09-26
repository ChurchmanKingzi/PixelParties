# -*- coding: utf-8 -*-
"""Hilfsfunktionen für die Tarot-Karten IV–VII (Emperor, Hierophant, Lovers, Chariot).
Baut nur auf tlib auf, ändert tlib nicht."""
from tlib import *


def aniso_noise(sx, sy, seed=0, octaves=2):
    """anisotropes Rauschen (sx, sy = Skalen in x/y), z.B. für senkrechte Felsriefen"""
    base = noise(H, W, 3, seed=seed, octaves=octaves)
    small = cv2.resize(base, (max(2, int(W * 3 / sx)), max(2, int(H * 3 / sy))), interpolation=cv2.INTER_AREA)
    return cv2.resize(small, (W, H), interpolation=cv2.INTER_CUBIC)


def peak_range(cv, specs, base_y, ramp, seed=0, k=1.6, bias=0.0, striate=0.9, clip_mask=None, rim=None):
    """Karst-/Felsgipfel als Relief. specs: [(x, top_y, halbe Breite, Form-Exponent)]
    Gibt die Maske zurück."""
    yy, xx = np.indices((H, W))
    M = np.zeros((H, W), bool); Hm = np.zeros((H, W), np.float32)
    wob = aniso_noise(4, 30, seed=seed)
    for (px_, ty, hw, p) in specs:
        # halbe Breite in Höhe y: w(y) = hw * ((y-ty)/(base-ty))^(1/p)
        t = np.clip((yy - ty) / max(1, (base_y - ty)), 0, 1)
        wy = hw * t ** (1.0 / p) + (wob - 0.5) * 5 * t
        dx = xx - px_
        m = (yy >= ty) & (np.abs(dx) <= wy) & (yy <= base_y + 40)
        h = np.where(m, np.sqrt(np.clip(1 - (dx / np.maximum(wy, 0.5)) ** 2, 0, 1)) * (2 + hw * 0.08), 0)
        Hm = np.where(m, np.maximum(Hm, h), Hm)
        M |= m
    Hm += (aniso_noise(3, 22, seed=seed + 5) - 0.5) * striate * 2.2
    Hm += (noise(H, W, 3, seed=seed + 7) - 0.5) * 0.5
    M &= (yy >= AY0) & (yy < AY1) & (xx >= AX0) & (xx < AX1)
    if clip_mask is not None:
        M &= clip_mask
    relief(cv, Hm, np.zeros((H, W), np.int32), [ramp], M, k=k, bias=bias)
    return M


def mist(cv, y0, y1, color, mix=0.5, k=1.0, x0=AX0, x1=AX1, up=True, seed=3):
    """Nebelband: gedithert, zur Unterkante (up=True) dichter"""
    fn = noise(H, W, 8, seed=seed, octaves=2)
    for y in range(max(AY0, y0), min(AY1, y1)):
        t = (y - y0) / max(1, (y1 - y0))
        if not up:
            t = 1 - t
        for x in range(max(AX0, x0), min(AX1, x1)):
            if BAYER4[y % 4, x % 4] < (t * 0.9 + (fn[y, x] - 0.5) * 0.6) * k:
                blend_px(cv, x, y, color, mix)


def spiral(cv, cx, cy, r, turns=1.4, col=(255, 255, 255), a0=0.0, sgn=1, n=80):
    """eingerollte Wolkenlocke (xiangyun) als Pixellinie"""
    for i in range(n):
        t = i / (n - 1)
        a = a0 + sgn * t * turns * 2 * math.pi
        rr = r * (1 - t * 0.85)
        px(cv, cx + math.cos(a) * rr, cy + math.sin(a) * rr, col)


def engrave(cv, pts, dark, light=None, mask=None):
    """eingravierte Linie: dunkle Linie + helle Kante darunter/rechts"""
    P = np.array(pts, float)
    for i in range(len(P) - 1):
        x0, y0 = P[i]; x1, y1 = P[i + 1]
        n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for s in range(n + 1):
            t = s / max(1, n)
            x = int(round(x0 + (x1 - x0) * t)); y = int(round(y0 + (y1 - y0) * t))
            if mask is not None and not mask[y, x]:
                continue
            px(cv, x, y, dark)
            if light is not None and (mask is None or mask[y + 1, x + 1]):
                if tuple(cv.a[y + 1, x + 1]) != tuple(dark):
                    px(cv, x + 1, y + 1, light)


def fig_draw(cv, fn, mats, x=0, y=0, outline=True, **kw):
    """Fig(W,H) anlegen, fn(f) zeichnen lassen, Umriss + Rendern + Einfügen. Gibt (fig, rgba) zurück."""
    f = Fig(W, H)
    fn(f)
    if outline:
        f.outline()
    f.inner_mask = f.inner_lines()
    rgba = f.render(mats, **kw)
    cv.paste(rgba, x, y)
    return f, rgba


def lantern(cv, x, y, s=1.0, body=None, cord_top=AY0):
    """chinesische Papierlaterne (Mittelpunkt x,y) mit Goldkappen und Quaste"""
    body = body or [(90, 8, 14), (150, 20, 24), (210, 44, 36), (246, 96, 56), (255, 170, 110)]
    # Schnur
    for yy in range(cord_top, int(y - 10 * s)):
        px(cv, x, yy, (60, 30, 20))

    def d(f):
        f.part('cap1'); f.rect(x - 5 * s, y - 12 * s, x + 5 * s, y - 9 * s, 'g')
        f.part('body'); f.ellipse(x, y, 10 * s, 9.5 * s, 'r')
        f.part('cap2'); f.rect(x - 5 * s, y + 8 * s, x + 5 * s, y + 11 * s, 'g')
        f.part('tassel', line=False); f.poly([(x - 2, y + 11 * s), (x + 2, y + 11 * s), (x + 3, y + 22 * s), (x - 3, y + 22 * s)], 't')
    f, rgba = fig_draw(cv, d, {'r': mat(body, pillow=6, k=1.4, bias=0.12), 'g': mat(GOLD, pillow=1.5, k=1.6, spec=True),
                               't': mat(RED_CLOTH, pillow=1, k=1.0, bias=0.1)})
    # Rippen der Laterne
    for dx in (-6, -2.5, 2.5, 6):
        for yy in range(int(y - 8 * s), int(y + 8 * s)):
            xx = x + dx * s * math.sqrt(max(0, 1 - ((yy - y) / (9.5 * s)) ** 2)) * 1.25
            if rgba[yy, int(round(xx)), 3] and tuple(cv.a[yy, int(round(xx))]) != OUT:
                px(cv, xx, yy, lerp(body[1], body[0], 0.4))
    # Leuchten innen
    glow(cv, x, y, 16 * s, (255, 190, 90), k=0.3, mix=0.25)
    # Schriftzeichen-artiges Symbol (福-Andeutung) in Gold
    for (dx, dy) in [(0, -3), (-1, -2), (1, -2), (0, -1), (-2, 0), (-1, 0), (0, 0), (1, 0), (2, 0), (0, 1), (-1, 2), (1, 2), (0, 3)]:
        px(cv, x + dx, y + dy, GOLD[4] if dy < 0 else GOLD[3])
    return rgba


def stroke(cv, pts, col, w=1):
    """dünne Pixellinie durch Punkte"""
    P = np.array(pts, float)
    for i in range(len(P) - 1):
        x0, y0 = P[i]; x1, y1 = P[i + 1]
        n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for s in range(n + 1):
            t = s / max(1, n)
            x = x0 + (x1 - x0) * t; y = y0 + (y1 - y0) * t
            for k in range(w):
                px(cv, x + k, y, col)


def fig_mask(rgba):
    return rgba[..., 3] > 0


def recolor_in(cv, rgba, x, y, c):
    """nur zeichnen, wenn (x,y) innerhalb der Figur liegt und kein Umriss ist"""
    x, y = int(round(x)), int(round(y))
    if 0 <= x < W and 0 <= y < H and rgba[y, x, 3] and tuple(cv.a[y, x]) != OUT:
        px(cv, x, y, c)


def big_eye(cv, x, y, iris, w=6, h=9, flip=False, lash=OUT, white=(250, 250, 255), glint=(255, 255, 255), lash2=None):
    """großes Anime-Auge mit dickem Oberlid, Pupille, zwei Glanzpunkten; x,y = linke obere Ecke"""
    I = hair_ramp(iris)
    lash2 = lash2 or lash
    for j in range(h):
        for i in range(w):
            ii = w - 1 - i if flip else i
            X, Y = x + ii, y + j
            if j == 0:
                if 0 < i < w - 1 or True:
                    px(cv, X, Y, lash)
                continue
            if j == 1:
                px(cv, X, Y, lash2 if i < w - 1 else I[0])
                continue
            t = (j - 2) / max(1, h - 3)
            c = I[0] if t < 0.2 else I[1] if t < 0.45 else I[2] if t < 0.75 else I[3]
            # Pupille
            if 1 <= i <= w - 3 and 0.2 <= t <= 0.6 and w >= 5:
                c = I[0]
            # Rand unten/seitlich leicht dunkel
            if j == h - 1:
                c = I[1]
            # Augenweiß an der Außenseite unten
            if i == w - 1 and j >= 3:
                c = white
            px(cv, X, Y, c)
    # Wimper außen
    ox = x - 1 if not flip else x + w
    px(cv, ox, y, lash); px(cv, ox + (-1 if not flip else 1), y - 1, lash)
    # Glanzpunkte
    gx = x + 1 if not flip else x + w - 2
    px(cv, gx, y + 2, glint); px(cv, gx + (1 if not flip else -1), y + 2, glint); px(cv, gx, y + 3, glint)
    gx2 = x + w - 3 if not flip else x + 2
    px(cv, gx2, y + h - 3, lerp(glint, I[3], 0.4))


def stamp(cv, x, y, rows, cols, flip=False):
    """kleines Muster (Zeilen-Strings) setzen; flip spiegelt horizontal"""
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch in cols:
                ii = len(r) - 1 - i if flip else i
                px(cv, x + ii, y + j, cols[ch])


def stamp_in(cv, rgba, x, y, rows, cols, flip=False):
    """wie stamp, aber nur innerhalb einer Figur und nicht auf Umrisspixeln"""
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch in cols:
                ii = len(r) - 1 - i if flip else i
                recolor_in(cv, rgba, x + ii, y + j, cols[ch])


CLOUD_MOTIF = [".##...", "#..#..", "#.##..", "#....#", ".####."]


def recolor_on(cv, f, x, y, c, keys):
    """nur auf Pixeln der Materialien 'keys' der Fig f zeichnen (nicht auf Umriss/inneren Konturen)"""
    x, y = int(round(x)), int(round(y))
    if 0 <= x < W and 0 <= y < H and f.L[y, x] in keys and tuple(cv.a[y, x]) != OUT:
        if f.inner_mask is None or not f.inner_mask[y, x]:
            px(cv, x, y, c)


def prep_inner(f):
    """innere Konturpixel merken (für recolor_on)"""
    f.inner_mask = f.inner_lines()
    return f
