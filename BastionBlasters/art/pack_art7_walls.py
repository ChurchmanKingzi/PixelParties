"""pack_art7: Wand-, Tor- und Hof-Sprites (Panzermauer, Bannmauer, Fallgatter-Tor, Stachelflur, Drehtür-Irrgarten, Löschteich).
Wände: Südansicht, Oberseite 8 px + Front 22 px; Hof-Bauteile: 32-px-Zellen, Boden Draufsicht."""
from __future__ import annotations

from cards_art import *
from pack_art7_fx import *
from castle import front_wall_tile, top_tile, K_WALL


def _bevel_plate(c, x0, y0, x1, y1, tone, ramp='metal', seedv=0):
    """Metallplatte mit Fase: Licht oben links, Schatten unten rechts, Schachbrett-Verlauf"""
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            u = (x - x0) / max(1, x1 - x0)
            v = (y - y0) / max(1, y1 - y0)
            L = 0.80 - 0.34 * u - 0.30 * v
            idx = quant(max(0.0, min(1.0, L)), tone - 1, tone + 1, x, y)
            if texture_noise(x, y, seedv) > 0.93:
                idx = max(1, idx - 1)
            c.put_ramp(x, y, ramp, idx)
    for x in range(x0, x1 + 1):
        c.put_ramp(x, y0, ramp, 5 if x % 5 else 4)
        c.put_ramp(x, y1, ramp, 0)
        c.put_ramp(x, y1 - 1, ramp, 1)
    for y in range(y0, y1 + 1):
        c.put_ramp(x0, y, ramp, 4)
        c.put_ramp(x1, y, ramp, 1)
    c.put_ramp(x0, y1, ramp, 1)


def _rivet(c, x, y):
    """Nietenkopf (4 x 4 Kuppel mit Schlagschatten), linke obere Ecke (x, y)"""
    ellipse(c, x + 1.5, y + 1.5, 2.0, 2.0, 'metal', lo=2, hi=5, ambient=0.3, spec=(x + 1, y + 1, 5))
    c.put_ramp(x + 3, y + 3, 'metal', 0)
    c.put_ramp(x + 2, y + 3, 'metal', 1)
    c.put_ramp(x + 3, y + 2, 'metal', 1)


def _rust_streak(c, x, y, ln, rnd):
    for k in range(ln):
        idx = 3 if k < 2 else 2
        if (k + x) % 3 == 2 and rnd.random() < 0.7:
            continue
        if c.alpha(x, y + k):
            c.put_ramp(x, y + k, 'dirt', idx)


def _rust_blob(c, cx, cy, rx, ry, rnd):
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
            if d <= 1.0 and c.alpha(x, y):
                if d < 0.45:
                    c.put_ramp(x, y, 'dirt', 3 if (x + y) % 2 == 0 else 2)
                elif (x + y) % 2 == 0:
                    c.put_ramp(x, y, 'dirt', 2)


def armor_wall(segments=3, face_seg=1):
    """Panzermauer: genietete Metallplatten, Rost-Dither, ein Gesicht in einem Niet (32*n+8 breit, 30 hoch)"""
    W = 32 * segments + 8
    H = 30
    c = Canvas(W, H)
    rnd = random.Random(11)
    # --- Oberseite (y 0..7): Plattendeck mit Nietenreihe
    for x in range(W):
        for y in range(0, 8):
            v = y / 7.0
            L = 0.86 - 0.22 * v - 0.10 * ((x % 32) / 32.0)
            c.put_ramp(x, y, 'metal', quant(max(0.0, min(1.0, L)), 2, 4, x, y))
    for x in range(W):
        c.put_ramp(x, 0, 'metal', 5)
        c.put_ramp(x, 7, 'metal', 1)
    for s in range(segments + 1):
        sx = 4 + 32 * s
        for y in range(1, 7):
            c.put_ramp(min(W - 1, sx), y, 'metal', 1)
            if sx + 1 < W:
                c.put_ramp(sx + 1, y, 'metal', 4)
    for s in range(segments):
        for k in range(3):
            _rivet(c, 4 + 32 * s + 6 + k * 9, 2)
    # --- Front (y 8..29): je Segment zwei Platten-Reihen, versetzte Stöße
    for s in range(segments):
        x0 = 4 + 32 * s
        _bevel_plate(c, x0 + 1, 8, x0 + 31, 18, 3, seedv=s + 3)           # obere Platte
        off = 12 if s % 2 else 20
        _bevel_plate(c, x0 + 1, 19, x0 + off - 1, 29, 2, seedv=s + 5)     # untere Platten
        _bevel_plate(c, x0 + off, 19, x0 + 31, 29, 3, seedv=s + 7)
        for x in (x0 + 4, x0 + 14, x0 + 24):                                # Nieten oben
            _rivet(c, x, 9)
        for (a, b) in ((x0 + 3, x0 + off - 4), (x0 + off + 2, x0 + 29)):
            for x in range(a, b, 8):
                _rivet(c, x, 22)
    for x in range(W):
        c.put_ramp(x, 29, 'metal', 0)
    # Endpfosten links/rechts
    for x in list(range(0, 4)) + list(range(W - 4, W)):
        for y in range(8, 30):
            idx = 4 if x in (0, W - 4) else (2 if x in (1, W - 3) else 1)
            c.put_ramp(x, y, 'metal', idx)
    # --- Beulen (invertiertes Licht)
    for (dx, dy, rx, ry) in ((13, 14, 4.0, 3.0), (47, 25, 3.2, 2.4), (86, 13, 3.6, 2.8)):
        if dx >= W - 6:
            continue
        for y in range(dy - 5, dy + 6):
            for x in range(dx - 6, dx + 7):
                d = ((x - dx) / rx) ** 2 + ((y - dy) / ry) ** 2
                if d <= 1.0 and c.alpha(x, y):
                    c.put_ramp(x, y, 'metal', 1 if (x - dx) + (y - dy) < 0 else 4)
                elif d <= 1.8 and c.alpha(x, y) and (x + y) % 2 == 0:
                    c.put_ramp(x, y, 'metal', 2)
    # --- Rost: lokale Flecken (Ränder, unter den Nieten, Unterkante), Schachbrett-Dither
    for s in range(segments):
        x0 = 4 + 32 * s
        _rust_blob(c, x0 + 6 + 11 * (s % 2), 27, 7, 2.6, rnd)
        _rust_blob(c, x0 + 27, 11 + (s % 2) * 4, 3.4, 2.6, rnd)
        for x in (x0 + 5, x0 + 15, x0 + 25):
            _rust_streak(c, x + 2, 13, 4 + (x % 3), rnd)
        for x in (x0 + 5, x0 + 21):
            _rust_streak(c, x + 2, 26, 3, rnd)
    # --- Gesichts-Niet: großer Niet, zwei Augen, kleiner Mund
    fx = 4 + 32 * face_seg + 16
    fy = 13
    ellipse(c, fx, fy, 6.1, 5.4, 'metal', lo=0, hi=1, ambient=0.2)
    ellipse(c, fx, fy, 4.9, 4.4, 'metal', lo=1, hi=5, ambient=0.2, spec=(fx - 2, fy - 3, 5))
    c.rect(fx - 2, fy - 1, fx - 2, fy, 'coal', 0)
    c.rect(fx + 1, fy - 1, fx + 1, fy, 'coal', 0)
    c.put_ramp(fx - 1, fy + 2, 'coal', 1)
    c.put_ramp(fx, fy + 2, 'coal', 1)
    c.put_ramp(fx + 1, fy + 2, 'coal', 1)
    _rust_streak(c, fx + 4, fy + 4, 5, rnd)
    c.outline()
    return c


def ward_wall(segments=3, phase=0):
    """Bannmauer: Kristallblöcke mit Splitterkrone, pulsierende violette Rune (32*n+8 breit, 44 hoch)"""
    W = 32 * segments + 8
    H = 44
    c = Canvas(W, H)
    top0, top1, f0, f1 = 14, 21, 22, 43
    # Oberseite: Kristallplatte mit Facettenlinien
    for x in range(W):
        for y in range(top0, top1 + 1):
            bx = (x - 4) % 32
            v = (y - top0) / 7.0
            L = 0.92 - 0.32 * v - 0.12 * (bx / 32.0)
            idx = quant(max(0.0, min(1.0, L)), 2, 5, x, y)
            if (bx + (y - top0) * 3) % 16 == 0:
                idx = 5
            c.put_ramp(x, y, 'purple', idx)
    for x in range(W):
        c.put_ramp(x, top0, 'purple', 5)
        c.put_ramp(x, top1, 'purple', 1)
    # Front: tiefviolette Kristallblöcke mit hellen Facettenkanten (je Segment ein Block)
    for x in range(W):
        bx = (x - 4) % 32
        if x < 4:
            bx = 0
        for y in range(f0, f1 + 1):
            t = (y - f0) / float(f1 - f0)
            sh = int(t * 2)
            if bx <= 1:
                idx = 5 if bx == 0 else 4
            elif bx < 7 + sh:
                idx = 3 if t < 0.5 else 2
                if (x + y) % 2 == 0 and abs(t - 0.5) < 0.1:
                    idx = 2 if idx == 3 else 3
            elif bx < 25 + sh:
                idx = 2 if t < 0.35 else 1
                if (x + y) % 2 == 0 and abs(t - 0.35) < 0.12:
                    idx = 2 if idx == 1 else 1
            elif bx < 31:
                idx = 1 if t < 0.6 else 0
            else:
                idx = 0
            if bx in (7 + sh, 25 + sh):                     # Facettenkante
                idx = 4 if bx == 7 + sh else 3
            if y == f0:
                idx = 5
            elif y == f0 + 1 and bx > 1:
                idx = max(idx, 3)
            if texture_noise(x, y, 40) > 0.968 and bx > 2:   # Glitzer
                idx = 5
            c.put_ramp(x, y, 'purple', idx)
    # Steinsockel
    for x in range(W):
        for y in range(f1 - 2, f1 + 1):
            c.put_ramp(x, y, 'stone', 0 if y == f1 else (1 if (x + y) % 2 else 2))

    # Splitterkronen auf den Oberseiten
    def shard(cx, base_y, h, wd, lean=0):
        pts = [(cx - wd, base_y), (cx - wd + lean * 0.4, base_y - h * 0.7), (cx + lean, base_y - h),
               (cx + wd - lean * 0.2, base_y - h * 0.7), (cx + wd, base_y)]
        mid = cx + lean * 0.5
        for y in range(int(base_y - h) - 1, base_y + 1):
            for x in range(int(cx - wd) - 1, int(cx + wd) + 2):
                if point_in_poly(x + 0.5, y + 0.5, pts):
                    t = (base_y - y) / float(h)
                    if x < mid - 0.5:
                        idx = 4 if t < 0.8 else 5
                    elif x < mid + 1.0:
                        idx = 5 if t > 0.2 else 4
                    else:
                        idx = 2 if t < 0.8 else 3
                    c.put_ramp(x, y, 'purple', idx)
    for s in range(segments):
        x0 = 4 + 32 * s
        shard(x0 + 8, top0 + 5, 11 + (s % 2) * 3, 3, -1)
        shard(x0 + 16, top0 + 4, 14 - (s % 2) * 3, 4, 0)
        shard(x0 + 24, top0 + 5, 9 + ((s + 1) % 2) * 3, 3, 1)
    for s in range(segments):
        rune(c, 4 + 32 * s + 16, 31, phase)
    c.outline()
    return c


def rune(c, cx, cy, phase=0):
    """leuchtende Bannrune, 3 Pulsphasen (0 schwach, 1 mittel, 2 stark)"""
    halo = 7 + phase
    for y in range(cy - halo - 1, cy + halo + 2):
        for x in range(cx - halo - 1, cx + halo + 2):
            d = math.hypot(x - cx, (y - cy) * 1.05)
            if d <= halo and c.alpha(x, y) and (x + y) % 2 == 0:
                if d > halo - 2.0:
                    c.put_ramp(x, y, 'purple', 2)
                elif d > halo - 3.2:
                    c.put_ramp(x, y, 'purple', 3)
    ring = [(0, -5), (2, -5), (4, -3), (5, -1), (5, 1), (4, 3), (2, 5), (0, 5), (-2, 5), (-4, 3), (-5, 1), (-5, -1), (-4, -3), (-2, -5)]
    for (dx, dy) in ring:
        c.put_ramp(cx + dx, cy + dy, 'purple', 5)
    for k in range(-3, 4):                                  # Senkrechte
        c.put_ramp(cx, cy + k, 'purple', 5)
    for k in range(1, 4):                                   # Zacken
        c.put_ramp(cx - k, cy - 3 + k, 'purple', 4)
        c.put_ramp(cx + k, cy - 3 + k, 'purple', 4)
    c.put_ramp(cx, cy + 5, 'bone', 5)
    c.put_ramp(cx, cy - 5, 'bone', 5)
    c.put_ramp(cx, cy, 'bone', 5)


# --------------------------------------------------------------------------- Fallgatter-Tor


GATE_W, GATE_H, GATE_OY = 56, 58, 8


def _arch_top(x, cx=27.5, half=15.0, top=27, spring=33):
    dx = (x + 0.5 - cx) / half
    dx = max(-1.0, min(1.0, dx))
    return top + (spring - top) * (1 - math.sqrt(1 - dx * dx))


def portcullis_gate(drop=0.75, layer='frame', team='teamA'):
    """Fallgatter-Tor (56 x 58, Fußpunkt unten): zwei Pfeiler, Sturz mit Winde, Ketten, Wimpel.
    layer 'frame' (Stein) oder 'grid' (eisernes Gatter mit Zähnen, `drop` 0..1 = wie weit es gefallen ist)"""
    inner = Canvas(56, 50)
    if layer == 'grid':
        _gate_grid(inner, drop)
    else:
        _gate_frame(inner, team)
    c = Canvas(GATE_W, GATE_H)
    c.blit(inner, 0, GATE_OY)
    if layer == 'frame':
        c.rect(5, 0, 5, 9, 'wood', 3)                                 # Fahnenmast auf dem linken Pfeiler
        poly(c, [(6, 1), (14, 2), (11, 4), (14, 6), (6, 6)], team, lo=1, hi=4)
        c.put_ramp(5, 0, 'gold', 5)
    c.outline()
    return c


def _gate_frame(c, team):
    pil = front_wall_tile(38, seed=5, moss=False)
    lin = front_wall_tile(32, seed=3, moss=True)
    top = tile_cobble(25, 32, base='stone', tone=(3, 4), mortar=2, hi=5)

    def stone(x, y, tex, ty):
        c.put(x, y, tuple(int(v) for v in tex.px[ty, x % 32, :3]), RAMP_ID['stone'])

    # Pfeiler (12 breit): Oberseite y 2..11, Front y 12..49
    for (xa, xb) in ((0, 11), (44, 55)):
        for x in range(xa, xb + 1):
            for y in range(2, 12):
                stone(x, y, top, y + 6)
            for y in range(12, 50):
                stone(x, y, pil, y - 12)
            c.put_ramp(x, 2, 'stone', 5)
            c.put_ramp(x, 11, 'stone', 2)
            c.put_ramp(x, 12, 'stone', 5 if x < xb else 3)
            c.put_ramp(x, 13, 'stone', 1)
        for y in range(13, 50):
            c.put_ramp(xa, y, 'stone', 4)
            c.put_ramp(xb, y, 'stone', 1)
    # Sturz: Oberseite y 10..17, Front y 18..49 mit Bogenöffnung
    for x in range(12, 44):
        for y in range(10, 18):
            stone(x, y, top, y + 10)
        for y in range(18, 50):
            if y >= _arch_top(x):
                continue
            stone(x, y, lin, y - 18)
    for x in range(12, 44):                                   # Bogenkante: innen dunkel, außen hell
        yt = int(math.ceil(_arch_top(x)))
        c.put_ramp(x, yt - 1, 'stone', 0)
        c.put_ramp(x, yt - 2, 'stone', 4 if x < 28 else 2)
    for y in range(23, 29):                                   # Schlussstein mit Wappen
        for x in range(25, 31):
            c.put_ramp(x, y, 'stone', 5 if (x == 25 or y == 23) else (3 if x < 29 else 2))
        c.put_ramp(30, y, 'stone', 1)
    for (dx, dy, i) in ((27, 25, 4), (28, 25, 3), (27, 26, 3), (28, 26, 2)):
        c.put_ramp(dx, dy, team, i)
    # Winde (liegende Walze) auf dem Sturz, Kurbelscheibe am rechten Ende
    for y in range(5, 13):
        nn = (y - 5) / 7.0 * 2 - 1
        nz = math.sqrt(max(0.0, 1 - nn * nn))
        L = 0.2 + 0.8 * max(0.0, -nn * 0.65 + nz * 0.55)
        for x in range(14, 40):
            idx = quant(L, 1, 4, x, y)
            if (x - 14) % 7 == 0:
                idx = 1
            c.put_ramp(x, y, 'wood', idx)
    for y in range(5, 13):
        c.put_ramp(14, y, 'metal', 4)
        c.put_ramp(15, y, 'metal', 2)
    ellipse(c, 40.5, 9.0, 3.4, 4.0, 'metal', lo=1, hi=5)
    c.put_ramp(40, 8, 'bone', 5)
    c.line(41, 9, 43, 3, 'wood', 3)
    c.put_ramp(43, 2, 'gold', 4)
    c.put_ramp(44, 2, 'gold', 3)
    # Ketten von der Walze vor dem Sturz bis zum Gatter (Glieder wechseln breit/schmal)
    for cx in (17, 36):
        for y in range(12, 35):
            k = (y - 12) % 4
            if k in (0, 1):
                c.put_ramp(cx - 1, y, 'metal', 5 if k == 0 else 3)
                c.put_ramp(cx, y, 'metal', 4)
                c.put_ramp(cx + 1, y, 'metal', 2)
            else:
                c.put_ramp(cx, y, 'metal', 3)


def _gate_grid(c, drop):
    bot = int(29 + drop * 20)                                  # Unterkante der Zähne
    bars = list(range(14, 43, 5))
    for x in range(13, 43):
        bx = (x - 14) % 5
        if bx not in (0, 1):
            continue
        for y in range(int(math.ceil(_arch_top(x))), bot + 1):
            if y > bot - 3 and bx == 1:
                continue                                       # Zahnspitze: nur linker Stab-Pixel
            c.put_ramp(x, y, 'metal', 4 if bx == 0 else 2)
    rows = [bot - 7 - 9 * k for k in range(4)]
    for yy in rows:                                            # Querstäbe
        for x in range(13, 43):
            if yy >= _arch_top(x) + 1:
                c.put_ramp(x, yy, 'metal', 4)
                c.put_ramp(x, yy + 1, 'metal', 1)
    for x0 in bars:
        for yy in rows:
            if yy >= _arch_top(x0) + 1:
                c.put_ramp(x0, yy, 'bone', 5)
        c.put_ramp(x0, bot, 'bone', 5)


# --------------------------------------------------------------------------- Stachelflur


def _cog(c, cx, cy, r, ramp='gold', teeth=8, rot=0.0):
    """Zahnrad (Draufsicht/Vorderansicht)"""
    for k in range(teeth):
        a = rot + k * 2 * math.pi / teeth
        tx, ty = cx + math.cos(a) * (r + 1.2), cy + math.sin(a) * (r + 1.2)
        for (ox, oy) in ((0, 0), (1, 0), (0, 1), (1, 1)):
            c.put_ramp(int(tx - 0.5) + ox, int(ty - 0.5) + oy, ramp, 3 if (ox + oy) % 2 else 4)
    ellipse(c, cx, cy, r + 0.6, r + 0.6, ramp, lo=1, hi=5, ambient=0.25)
    ellipse(c, cx, cy, 1.4, 1.4, 'coal', lo=0, hi=2)


def spike_strip():
    """Stachelflur: Nagelbett (Holzbrett voller Eisennägel, Kopfbrett mit Kissen), Zahnrad, Warnschild mit Bett-Zeichen (32 x 32)"""
    c = Canvas(32, 32)
    # Brett (Draufsicht) mit Frontkante
    for y in range(12, 28):
        for x in range(3, 31):
            idx = 3 if (y - 12) % 5 else 2
            if (x + (y // 5) * 7) % 13 == 0:
                idx = 1
            if y == 12:
                idx = 4
            c.put_ramp(x, y, 'wood', idx)
    for y in range(12, 28):
        c.put_ramp(3, y, 'wood', 4)
        c.put_ramp(30, y, 'wood', 1)
    for x in range(3, 31):
        c.put_ramp(x, 28, 'wood', 1)
        c.put_ramp(x, 29, 'wood', 0)
    # Kopfbrett (links, höher) und Kissen
    round_rect(c, 3, 8, 8, 28, 'wood', lo=1, hi=5, radius=1)
    ellipse(c, 12.0, 19.0, 3.0, 4.8, 'bone', lo=3, hi=5, ambient=0.3)
    c.put_ramp(11, 17, 'teamA', 3)
    c.put_ramp(12, 17, 'teamA', 3)
    c.put_ramp(11, 18, 'teamA', 2)
    # Nägel (Südansicht): Dreiecke 4 breit, 9 hoch, drei versetzte Reihen
    for (by, xs_) in ((17, (16, 22, 28)), (22, (19, 25)), (27, (16, 22, 28))):
        for x0 in xs_:
            for k in range(9):
                y = by - k
                half = 2 if k < 4 else (1 if k < 7 else 0)
                for dx in range(-half - (0 if half == 2 else 0), half + 1):
                    xx = x0 + dx
                    if half == 0:
                        idx = 5
                    else:
                        idx = 5 if dx < 0 else (4 if dx == 0 and half == 1 else (3 if dx == 0 else 2))
                        if dx == half:
                            idx = 1
                    c.put_ramp(xx, y, 'metal', idx)
            c.put_ramp(x0 + 2, by, 'coal', 0)
            c.put_ramp(x0 + 3, by, 'coal', 0)
    # Zahnrad links vorn
    _cog(c, 4.5, 24.5, 2.6, 'gold', 8, 0.2)
    # Warnschild rechts oben
    c.rect(26, 8, 27, 12, 'wood', 3)
    c.rect(26, 8, 26, 12, 'wood', 4)
    round_rect(c, 21, 0, 31, 7, 'gold', lo=2, hi=5, radius=1)
    c.rect(23, 4, 29, 4, 'coal', 1)                # Bett-Zeichen: Matratze, Kopfteil, Beine
    c.rect(23, 2, 23, 5, 'coal', 1)
    c.rect(29, 5, 29, 6, 'coal', 1)
    c.rect(24, 3, 25, 3, 'coal', 1)
    c.outline()
    return c


# --------------------------------------------------------------------------- Löschteich


def quench_pond():
    """Löschteich: Steinrand, Wasser mit Wellen, Seerose, Schilf, Ente mit Schwimmreifen (32 x 32, Draufsicht + Ente)"""
    c = Canvas(32, 32)
    cx, cy = 15.5, 18.5
    for y in range(32):
        for x in range(32):
            d = math.hypot((x + 0.5 - cx) / 1.12, y + 0.5 - cy)
            if 11.2 < d <= 13.8:
                ang = math.atan2(y + 0.5 - cy, x + 0.5 - cx)
                L = 0.82 - 0.35 * ((x + y) / 60.0) + (0.14 if int((ang + 3.2) * 4.0) % 2 else -0.06)
                c.put_ramp(x, y, 'stone', quant(max(0.0, min(1.0, L)), 2, 5, x, y))
    for y in range(32):
        for x in range(32):
            d = math.hypot((x + 0.5 - cx) / 1.12, y + 0.5 - cy)
            if d <= 11.2:
                # Wasser: Schatten des Randes oben links, Licht unten rechts
                L = 0.45 + 0.20 * ((x - cx) + (y - cy)) / 12.0 - 0.28 * max(0.0, 1.0 - (d / 10.2) ** 0.5 * 1.0) * 0
                L += 0.24 * max(0.0, d / 10.2 - 0.6) * (1 if (x - cx) + (y - cy) < 0 else -1) * -1
                c.put_ramp(x, y, 'sky', quant(max(0.0, min(1.0, L)), 1, 4, x, y))
    # Wellenringe um die Ente (gestrichelt) und Glanzlichter
    for k, (rx, ry) in enumerate(((7.5, 3.6), (5.0, 2.4))):
        for a in range(0, 360, 6):
            if (a // 30) % 2 == 0:
                x = 18.5 + math.cos(math.radians(a)) * rx
                y = 21.5 + math.sin(math.radians(a)) * ry
                if c.alpha(int(x), int(y)):
                    c.put_ramp(int(x), int(y), 'sky', 5 if k == 0 else 4)
    for (x, y) in ((8, 14), (9, 14), (22, 15), (12, 26), (13, 26)):
        c.put_ramp(x, y, 'sky', 5)
    # Seerose
    ellipse(c, 10.5, 20.5, 3.4, 2.2, 'leaf', lo=2, hi=5)
    c.put_ramp(12, 19, 'leaf', 0)
    c.put_ramp(11, 20, 'skin', 5)
    c.put_ramp(10, 19, 'skin', 4)
    # Schilf (Südansicht) links oben am Rand
    for (x, top) in ((3, 4), (6, 1), (8, 6)):
        c.rect(x, top + 3, x, top + 11, 'leaf', 3)
        c.rect(x, top, x, top + 4, 'wood', 3)
        c.put_ramp(x, top, 'wood', 4)
    # Ente mit Schwimmreifen
    c.blit(swim_duck_small(), 12, 17)
    c.outline()
    return c


# --------------------------------------------------------------------------- Drehtür-Irrgarten


def _drum(c, cx, cy, r, ang, gap_dirs=(0, 2)):
    """Drehtür von oben/vorn: runde Holztrommel mit zwei Durchgängen, Kreuz aus vier roten Flügeln (Winkel `ang`)"""
    ellipse(c, cx, cy, r, r * 0.92, 'wood', lo=0, hi=1, ambient=0.3)
    # Flügel: erst Frontflächen (dunkel, 3 px tiefer), dann Deckflächen (hell), hintere zuerst
    order = sorted(range(4), key=lambda k: math.sin(ang + k * math.pi / 2))
    for k in order:
        a = ang + k * math.pi / 2
        ex, ey = cx + math.cos(a) * (r - 1.5), cy + math.sin(a) * (r - 1.5) * 0.92
        thick_line(c, cx, cy + 3, ex, ey + 3, 3.0, 'teamA', lo=1, hi=2)
        thick_line(c, cx, cy, ex, ey, 3.0, 'teamA', lo=3, hi=5)
    # Ring (Gehäuse) mit Durchgängen, Südhälfte als Frontwand
    for y in range(int(cy - r - 2), int(cy + r + 6)):
        for x in range(int(cx - r - 2), int(cx + r + 3)):
            dx, dy = (x + 0.5 - cx) / (r + 0.3), (y + 0.5 - cy) / ((r + 0.3) * 0.92)
            d = dx * dx + dy * dy
            a = math.atan2(dy, dx)
            in_gap = any(abs(((a - g * math.pi / 2 + math.pi) % (2 * math.pi)) - math.pi) < 0.5 for g in gap_dirs)
            if 0.80 <= d <= 1.0 and not in_gap:
                c.put_ramp(x, y, 'wood', 5 if dx + dy < 0 else 3)
            elif 1.0 < d <= 1.0 + 4.5 / r and dy > 0.15 and not in_gap:           # Front (Südwand)
                c.put_ramp(x, y, 'wood', 2 if (x + y) % 5 else 1)
    ellipse(c, cx, cy, 2.0, 1.8, 'gold', lo=2, hi=5)
    c.put_ramp(int(cx) - 1, int(cy) - 1, 'gold', 5)


def revolving_maze():
    """Drehtür-Irrgarten (64 x 36): Holzplattform mit zwei Drehtüren, Trennwand, Pfeilen im Kreis"""
    c = Canvas(64, 36)
    # Plattform (helle Dielen)
    pl = tile_planks(41, 32, tone=(3, 4, 4))
    for y in range(8, 32):
        for x in range(0, 64):
            c.put(x, y, tuple(int(v) for v in pl.px[y % 32, x % 32, :3]), RAMP_ID['wood'])
    for x in range(64):                                           # Kante vorn
        c.put_ramp(x, 32, 'wood', 2)
        c.put_ramp(x, 33, 'wood', 1)
        c.put_ramp(x, 34, 'wood', 0)
    # Pfeile im Kreis auf dem Boden um jede Drehtür (Bögen mit Pfeilspitze)
    for (cx, cy) in ((15, 21), (49, 21)):
        for k in range(3):
            a0 = k * 2 * math.pi / 3 + 0.5
            for t in range(11):
                a = a0 + t * 0.105
                c.put_ramp(int(cx + math.cos(a) * 14.2), int(cy + math.sin(a) * 12.6), 'bone', 5)
            a = a0 + 1.1
            hx, hy = cx + math.cos(a) * 14.2, cy + math.sin(a) * 12.6
            tx, ty = -math.sin(a), math.cos(a) * 0.9                   # Laufrichtung
            nx, ny = math.cos(a), math.sin(a)
            for (u, v) in ((1.5, 0), (0, 1.5), (0, -1.5), (0.7, 0.8), (0.7, -0.8)):
                c.put_ramp(int(hx + tx * u * 1.6 + nx * v), int(hy + ty * u * 1.6 + ny * v), 'bone', 5)
    # Rückwand (Nordwand der Plattform): Bohlen
    for y in range(0, 8):
        for x in range(64):
            c.put_ramp(x, y, 'wood', 3 if y < 2 else (2 if y < 6 else 1))
            if x % 8 == 0:
                c.put_ramp(x, y, 'wood', 0)
    for x in range(64):
        c.put_ramp(x, 0, 'wood', 5)
        c.put_ramp(x, 1, 'wood', 4)
        c.put_ramp(x, 7, 'wood', 0)
    # Trennwand in der Mitte: Bohlenwand (Oberseite + Südfläche am Ende)
    for y in range(8, 20):
        for x in range(30, 34):
            c.put_ramp(x, y, 'wood', 5 if x == 30 else (4 if x < 33 else 3))
    for y in range(20, 27):
        for x in range(29, 35):
            c.put_ramp(x, y, 'wood', 3 if y < 25 else 1)
            if x in (29, 34):
                c.put_ramp(x, y, 'wood', 1)
    for x in range(29, 35):
        c.put_ramp(x, 20, 'wood', 5)
    # Drehtüren
    _drum(c, 15, 21, 11, 0.5)
    _drum(c, 49, 21, 11, 1.25)
    c.outline()
    return c
