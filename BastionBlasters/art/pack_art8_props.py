"""pack_art8 Möbel und Requisiten (Badehaus, Pilzgarten, Zahnklempner, Brunnen, Phönixnest, Rüstkammer,
Pulverkammer, Feuerwerkerei, Kanonengießerei, Runenpresse). Licht von links oben, Sprites mit outline()."""
from __future__ import annotations

from pack_art8_kit import *


# =========================================================================== BADEHAUS (BH-03)


def bath_pool(w=60, h=30):
    """Marmorbecken in der Draufsicht (Bodendeko), Wasser mit Wellen und Schaum"""
    c = Canvas(w, h)
    round_rect(c, 0, 0, w - 1, h - 1, 'stone', lo=2, hi=5, radius=6, ambient=0.4)
    x0, y0, x1, y1, r = 4, 4, w - 5, h - 5, 4
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            dx = max(x0 + r - x, 0, x - (x1 - r))
            dy = max(y0 + r - y, 0, y - (y1 - r))
            if dx * dx + dy * dy > r * r + 0.5:
                continue
            wave = 0.5 + 0.28 * math.sin((x * 0.55 + y * 1.1)) + 0.12 * math.sin(x * 0.23)
            v = (y - y0) / float(y1 - y0)
            L = wave * 0.8 + 0.1 - 0.25 * (1 - v)
            idx = quant(L, 2, 4, x, y)
            if y - y0 < 3:
                idx = max(1, idx - 1)
            elif x - x0 < 2:
                idx = max(1, idx - 1)
            c.put_ramp(x, y, 'sky', idx)
    # Wellenstriche und Funkeln
    for (x, y) in ((12, 14), (13, 14), (14, 14), (30, 20), (31, 20), (32, 20), (46, 11), (47, 11), (22, 9), (23, 9)):
        c.put_ramp(x, y, 'sky', 5)
    for (x, y) in ((9, 20), (10, 20), (38, 15), (39, 15), (52, 19)):
        c.put_ramp(x, y, 'sky', 3)
    # Schaum
    for (cx, cy) in ((10, 18), (50, 10), (40, 22)):
        for (dx, dy) in ((0, 0), (1, 0), (-1, 1), (0, 1), (1, 1), (2, 1), (0, -1)):
            c.put_ramp(cx + dx, cy + dy, 'bone', 5 if dy <= 0 else 4)
    # Marmor-Maserung auf dem Rand
    for x in range(8, w - 8, 5):
        c.put_ramp(x, 1, 'stone', 5)
        c.put_ramp(x + 2, h - 3, 'stone', 2)
    c.outline()
    return c


def rubber_duck():
    return art([
        "......gggg..",
        ".....gGGGGg.",
        ".....gGgGGgff",
        ".....gGGGGgfF",
        "..gg..gGGg...",
        ".gGGggGGGGg..",
        "gGGGGGGGGGg..",
        ".gGGGGGGGg...",
        "..gggggggg...",
    ], {'g': ('gold', 2), 'G': ('gold', 4), 'f': ('fire', 3), 'F': ('fire', 4)}, outline=True)


def rubber_duck_big():
    """Gummiente 12x10 (schwimmt)"""
    c = Canvas(14, 11)
    ellipse(c, 6.5, 7, 5.6, 3.4, 'gold', lo=2, hi=5)
    ellipse(c, 9.5, 3.6, 2.8, 2.8, 'gold', lo=3, hi=5)
    c.put_ramp(12, 4, 'fire', 4)
    c.put_ramp(12, 5, 'fire', 3)
    c.put_ramp(11, 3, 'coal', 1)
    c.put_ramp(2, 6, 'gold', 5)
    c.put_ramp(3, 6, 'gold', 5)
    for x in range(2, 10):
        c.put_ramp(x, 9, 'sky', 4 if x % 2 else 5)
    c.outline()
    return c


def troll_bather():
    """Troll im Becken: Brust und Kopf, Handtuchturban, hält stolz die Gummiente (34 x 34)"""
    c = Canvas(34, 28)
    # Schultern
    ellipse(c, 19.5, 26, 14.5, 8.2, 'goblin', lo=1, hi=4, ambient=0.2)
    # Kopf
    ellipse(c, 19, 13, 9.6, 8.4, 'goblin', lo=1, hi=5, ambient=0.22)
    # Ohr
    ellipse(c, 10, 14, 2.4, 3.0, 'goblin', lo=1, hi=3)
    c.put_ramp(10, 14, 'skin', 2)
    # Nase: dicke Knolle
    ellipse(c, 27, 15, 3.6, 3.2, 'skin', lo=2, hi=5)
    c.put_ramp(26, 14, 'skin', 5)
    # Auge, Braue, Mund, Hauer, Bäckchen
    c.rect(22, 11, 23, 12, 'coal', 1)
    c.rect(20, 9, 25, 9, 'goblin', 0)
    for x in range(20, 26):
        c.put_ramp(x, 19, 'coal', 1)
    c.put_ramp(21, 18, 'bone', 5)
    c.put_ramp(21, 17, 'bone', 4)
    c.put_ramp(25, 18, 'bone', 5)
    c.put_ramp(25, 17, 'bone', 4)
    c.put_ramp(21, 15, 'skin', 3)
    c.put_ramp(22, 15, 'skin', 3)
    # Turban: Wickel mit Streifen in Teamfarbe
    ellipse(c, 19, 6, 10.4, 5.8, 'bone', lo=2, hi=5, ambient=0.22, clip=lambda x, y: y <= 8)
    for y in range(0, 9):
        for x in range(8, 30):
            if c.alpha(x, y) and (x + y * 2) % 7 in (0, 1):
                c.put_ramp(x, y, 'teamA', 3 if (x + y) % 2 else 4)
    ellipse(c, 23.5, 1.8, 3.2, 2.6, 'bone', lo=3, hi=5)
    c.put_ramp(25, 1, 'teamA', 3)
    c.put_ramp(24, 3, 'teamA', 2)
    # erhobene Faust (für die Ente)
    thick_line(c, 5, 25, 4, 16, 4.4, 'goblin', lo=1, hi=4)
    ellipse(c, 4.5, 15, 3.2, 3.0, 'goblin', lo=2, hi=5)
    # Wasserlinie: Schaum vorn
    for x in range(0, 34):
        c.put_ramp(x, 26, 'sky', 4 if x % 2 else 5)
        c.put_ramp(x, 27, 'sky', 3)
    for x in range(0, 34, 3):
        c.put_ramp(x, 25, 'bone', 5)
    c.outline()
    # Ente auf der Faust (nach dem Outline, damit sie hell bleibt)
    d = rubber_duck()
    out = Canvas(40, 38)
    out.blit(c, 6, 10)
    out.blit(d, 4, 13)
    return out


def steam_puff(size=1):
    """weiche Dampfwolke aus mehreren Dither-Blobs"""
    dims = {0: (16, 11), 1: (22, 14), 2: (30, 18)}[size]
    c = Canvas(dims[0], dims[1])
    w, h = dims
    blobs = {0: [(5, 6, 4, 3), (10, 5, 4, 3.4), (8, 7, 5, 3)],
             1: [(7, 8, 5.5, 4), (13, 6, 5.5, 4.4), (16, 9, 4.5, 3.4), (10, 9, 6, 3.6)],
             2: [(9, 11, 7, 5), (17, 8, 7.5, 5.6), (23, 11, 6, 4.4), (15, 12, 9, 4.6)]}[size]
    for (bx, by, rx, ry) in blobs:
        dither_blob(c, bx, by, rx, ry, 'bone', hi=5, lo=3)
    return c


def spout_decor():
    """Messinghahn mit rotem Ventilrad, Auslauf nach unten (14 x 14)"""
    c = Canvas(14, 14)
    # Rohr aus der Wand
    c.rect(1, 4, 10, 7, 'gold', 3)
    c.rect(1, 4, 10, 4, 'gold', 5)
    c.rect(1, 7, 10, 7, 'gold', 1)
    # Auslauf nach unten
    c.rect(7, 7, 10, 11, 'gold', 3)
    c.rect(7, 7, 7, 11, 'gold', 5)
    c.rect(10, 7, 10, 11, 'gold', 1)
    c.rect(6, 11, 11, 12, 'gold', 2)
    c.put_ramp(8, 12, 'coal', 0)
    # Ventil
    c.rect(4, 2, 5, 3, 'gold', 4)
    c.rect(1, 0, 8, 1, 'teamA', 3)
    c.rect(1, 0, 8, 0, 'teamA', 4)
    c.put_ramp(1, 0, 'teamA', 5)
    # Flansch an der Wand
    c.rect(0, 3, 1, 8, 'metal', 3)
    c.rect(0, 3, 0, 8, 'metal', 5)
    c.outline()
    return c


def spout_stream(n=18):
    """fallender Wasserstrahl, 5 breit"""
    c = Canvas(5, n)
    for y in range(n):
        wob = 1 if (y // 3) % 2 else 0
        for x in range(1, 4):
            idx = 5 if x == 1 + wob else (4 if x == 2 else 3)
            if (x + y) % 5 == 0:
                idx = 5
            c.put_ramp(x, y, 'sky', idx)
    for y in range(n - 3, n):
        c.put_ramp(0, y, 'bone', 5)
        c.put_ramp(4, y, 'bone', 4)
    return c


def towel_rail():
    """Handtuchstange mit zwei Tüchern (24 x 22)"""
    c = Canvas(26, 22)
    c.rect(1, 1, 24, 2, 'wood', 4)
    c.rect(1, 2, 24, 2, 'wood', 2)
    for (x0, col, stripe) in ((3, 'bone', 'teamA'), (14, 'ice', 'bone')):
        for y in range(3, 19):
            for x in range(x0, x0 + 8):
                idx = 5 if x < x0 + 3 else (4 if x < x0 + 6 else 3)
                if col == 'ice':
                    idx = 4 if x < x0 + 3 else (3 if x < x0 + 6 else 2)
                c.put_ramp(x, y, col, idx)
        for y in (8, 11):
            for x in range(x0, x0 + 8):
                c.put_ramp(x, y, stripe, 3 if x < x0 + 5 else 2)
        for x in range(x0, x0 + 8, 2):
            c.put_ramp(x, 19, col, 2)
    c.outline()
    return c


def bath_bench():
    """Holzbank mit Handtuchstapel, Seife, Schwamm (28 x 20)"""
    c = Canvas(28, 20)
    # Handtücher
    for (y0, col, idx, w) in ((4, 'bone', 5, 12), (8, 'ice', 4, 12), (12, 'teamA', 4, 12)):
        round_rect(c, 3, y0 - 1, 3 + w, y0 + 3, col, lo=max(1, idx - 3), hi=idx, radius=1)
    for x in range(4, 14, 2):
        c.put_ramp(x, 8 + 3, 'bone', 4)
    # Seife und Schwamm
    round_rect(c, 17, 9, 21, 12, 'skin', lo=3, hi=5, radius=1)
    c.put_ramp(18, 9, 'bone', 5)
    round_rect(c, 22, 8, 26, 12, 'gold', lo=2, hi=5, radius=1)
    for (x, y) in ((23, 9), (25, 10), (23, 11)):
        c.put_ramp(x, y, 'gold', 1)
    for (x, y) in ((24, 5), (25, 4), (24, 3)):
        c.put_ramp(x, y, 'bone', 5)
    # Bank
    round_rect(c, 1, 13, 26, 16, 'wood', lo=1, hi=4, radius=1)
    c.rect(3, 16, 4, 19, 'wood', 2)
    c.rect(23, 16, 24, 19, 'wood', 2)
    c.outline()
    return c


def bath_mat():
    """Badematte (Bodendeko, kein Outline)"""
    c = Canvas(30, 14)
    for y in range(14):
        for x in range(30):
            edge = min(x, y, 29 - x, 13 - y)
            if edge == 0:
                idx, r = 2, 'ice'
            else:
                r = 'bone' if (x // 3) % 2 == 0 else 'ice'
                idx = 4 if r == 'bone' else 3
            c.put_ramp(x, y, r, idx)
    return c


def bath_bucket():
    c = Canvas(12, 14)
    round_rect(c, 1, 4, 10, 12, 'wood', lo=1, hi=4, radius=1)
    ellipse(c, 5.5, 4.5, 4.8, 1.8, 'sky', lo=3, hi=5)
    for x in range(1, 11):
        c.put_ramp(x, 8, 'metal', 2)
    c.line(1, 4, 3, 0, 'metal', 3)
    c.line(10, 4, 8, 0, 'metal', 2)
    c.line(3, 0, 8, 0, 'metal', 4)
    c.outline()
    return c


# =========================================================================== PILZGARTEN (BH-04)


def mushroom(h=30, cap='fire', tilt=0, sorry=True, seed=1, patch=False):
    """sich entschuldigender Heilpilz: dicke rote Kappe mit weißen Punkten, schmaler Stiel mit Gesicht
    (besorgte Brauen, Bäckchen, Schweißtropfen). h = Gesamthöhe (S 14 / M 22 / L 30); tilt = Verbeugung (Kappe nach vorn)."""
    w = int(h * 1.0) + 4 + abs(tilt)
    c = Canvas(w, h + 2)
    cx = w // 2
    capw = int(h * 0.48)
    caph = int(h * 0.56)
    stem_top = int(h * 0.50)
    # Stiel (leicht bauchig)
    sw = max(2, int(h * 0.16))
    for y in range(stem_top, h + 1):
        t = (y - stem_top) / float(h + 1 - stem_top)
        half = sw + (1 if t > 0.65 else 0)
        for x in range(cx - half, cx + half + 1):
            u = (x - (cx - half)) / float(2 * half + 1)
            idx = 5 if u < 0.2 else (4 if u < 0.5 else (3 if u < 0.8 else 2))
            c.put_ramp(x, y, 'bone', idx)
    # Kappe (Kuppel, nach vorn geneigt = tilt)
    ccx = cx + tilt
    cy = stem_top + 1
    ellipse(c, ccx, cy, capw, caph, cap, lo=1, hi=3, ambient=0.15, clip=lambda x, y: y <= cy)
    # Lamellen-Unterseite
    for x in range(ccx - capw + 1, ccx + capw):
        if c.alpha(x, cy):
            c.put_ramp(x, cy, 'bone', 2 if x % 2 else 3)
        c.put_ramp(x, cy + 1, 'wood', 1) if (c.alpha(x, cy) and abs(x - ccx) < capw - 2) else None
    # Glanzkante
    for k in range(3):
        c.put_ramp(ccx - capw + 3 + k, cy - int(caph * 0.55) + (2 - k), cap, 4)
    # Punkte (deutlich, verschiedene Größen)
    spots = [(-0.52, 0.50, 0.30), (0.12, 0.80, 0.34), (0.58, 0.46, 0.26), (-0.10, 0.28, 0.22), (0.30, 0.20, 0.0)]
    for (fx, fy, fr) in spots:
        if fr <= 0:
            continue
        sx = ccx + fx * capw
        sy = cy - fy * caph * 0.9
        r = max(1.4, fr * capw * 0.62)
        ellipse(c, sx, sy, r, r * 0.85, 'bone', lo=4, hi=5, ambient=0.5)
    # Gesicht auf dem Stiel
    fy = stem_top + max(3, int(h * 0.14))
    ex = cx - max(1, sw // 2) + (1 if tilt else 0)
    ex2 = ex + max(2, sw - 0)
    c.rect(ex, fy, ex, fy + 1, 'coal', 1)
    c.rect(ex2, fy, ex2, fy + 1, 'coal', 1)
    if h >= 22:
        c.put_ramp(ex - 1, fy - 1, 'coal', 2)         # besorgte Brauen (steigen zur Mitte)
        c.put_ramp(ex2 + 1, fy - 1, 'coal', 2)
        c.put_ramp(ex, fy - 2, 'coal', 2)
        c.put_ramp(ex2, fy - 2, 'coal', 2)
    c.put_ramp(ex, fy + 3, 'coal', 2)
    c.put_ramp(ex + 1, fy + 3, 'coal', 2)
    c.put_ramp(ex - 1, fy + 2, 'skin', 3)             # Bäckchen
    c.put_ramp(ex2 + 1, fy + 2, 'skin', 3)
    if sorry:
        sx, sy = cx + sw + 2, fy - 1
        c.put_ramp(sx, sy, 'ice', 5)
        c.put_ramp(sx, sy + 1, 'ice', 4)
        c.put_ramp(sx, sy + 2, 'ice', 3)
    if patch:
        px, py = ccx - 3, cy - int(caph * 0.5)
        c.rect(px, py, px + 4, py + 2, 'skin', 4)
        c.rect(px + 2, py, px + 2, py + 2, 'skin', 5)
        c.put_ramp(px + 1, py + 1, 'skin', 3)
        c.put_ramp(px + 3, py + 1, 'skin', 3)
    c.outline()
    return c


def mush_bed(w=70, h=46, seed=2):
    """erhöhtes Pilzbeet: Holzrahmen mit Frontbrettern, Erde mit Moos (Draufsicht + Südfront), h = Gesamthöhe"""
    c = Canvas(w, h)
    rnd = random.Random(seed)
    top_h = h - 9
    # Frontbretter
    for y in range(top_h, h):
        for x in range(w):
            board = (x // 9)
            idx = (3 if board % 2 else 2)
            if y == top_h:
                idx = 4
            elif y >= h - 2:
                idx = 1
            if x % 9 == 8:
                idx = 1
            c.put_ramp(x, y, 'wood', idx)
        for nx in range(3, w, 9):
            c.put_ramp(nx, top_h + 3, 'metal', 4)
    # Rahmenoberseite
    for y in range(top_h):
        for x in range(w):
            edge = min(x, w - 1 - x, y, top_h - 1 - y)
            if edge <= 2:
                idx = 4 if (x < 3 or y < 3) else 3
                if x > w - 4 or y > top_h - 4:
                    idx = 2
                c.put_ramp(x, y, 'wood', idx)
            else:
                v = value_noise(x, y, 64, seed) * 0.7 + 0.3 * texture_noise(x // 2, y // 2, seed)
                L = 0.5 * v + 0.2 - (0.18 if (y < 7 or x < 6) else 0)
                c.put_ramp(x, y, 'dirt', quant(max(0.0, min(1.0, L)), 1, 3, x, y, dw=0.2))
    # Moos, Grasbüschel, Kiesel
    for _ in range(30):
        x, y = rnd.randint(6, w - 7), rnd.randint(5, top_h - 5)
        c.put_ramp(x, y, 'grass', 3)
        c.put_ramp(x + 1, y + 1, 'grass', 2)
        c.put_ramp(x - 1, y + 1, 'grass', 2)
    for _ in range(6):
        x, y = rnd.randint(6, w - 8), rnd.randint(5, top_h - 5)
        c.put_ramp(x, y, 'stone', 4)
        c.put_ramp(x + 1, y, 'stone', 3)
    c.outline()
    return c


def heal_plus(col='leaf'):
    """kleines Heilkreuz 5x5 (schwebt)"""
    c = Canvas(5, 5)
    for (x, y, i) in ((2, 0, 5), (2, 1, 5), (0, 2, 4), (1, 2, 5), (2, 2, 5), (3, 2, 5), (4, 2, 4), (2, 3, 4), (2, 4, 4)):
        c.put_ramp(x, y, col, i)
    return c


def spore(col='leaf'):
    c = Canvas(3, 3)
    c.put_ramp(1, 1, col, 5)
    c.put_ramp(0, 1, col, 3)
    c.put_ramp(2, 1, col, 3)
    c.put_ramp(1, 0, col, 4)
    c.put_ramp(1, 2, col, 3)
    return c


# =========================================================================== ZAHNKLEMPNER (BH-05)


def dental_chair():
    """Behandlungsstuhl (schräg zurückgelehnt, Vorderansicht), 28 x 30"""
    c = Canvas(30, 32)
    # Fuß und Säule
    round_rect(c, 8, 27, 22, 31, 'metal', lo=0, hi=3, radius=2)
    c.rect(13, 20, 17, 28, 'metal', 2)
    c.rect(13, 20, 13, 28, 'metal', 4)
    c.rect(17, 20, 17, 28, 'metal', 1)
    # Sitzfläche
    round_rect(c, 3, 14, 26, 22, 'teamA', lo=1, hi=4, radius=3)
    for x in range(5, 25, 2):
        c.put_ramp(x, 18, 'teamA', 2)
    for x in range(4, 26):
        c.put_ramp(x, 14, 'teamA', 5 if x < 10 else 4)
    # Rückenlehne (hoch, schmaler)
    round_rect(c, 7, 1, 22, 15, 'teamA', lo=1, hi=4, radius=3)
    for y in range(3, 14, 3):
        for x in range(9, 21):
            c.put_ramp(x, y, 'teamA', 2)
    for y in range(2, 14):
        c.put_ramp(8, y, 'teamA', 5)
    # Armlehnen
    c.rect(2, 12, 6, 14, 'metal', 4)
    c.rect(2, 12, 6, 12, 'metal', 5)
    c.rect(23, 12, 27, 14, 'metal', 3)
    c.rect(3, 15, 3, 21, 'metal', 2)
    c.rect(24, 15, 24, 21, 'metal', 1)
    c.outline()
    return c


def dental_lamp():
    """Gelenklampe mit leuchtender Birne (18 x 34), Lichtkegel kommt als Bodenglühen"""
    c = Canvas(24, 36)
    round_rect(c, 3, 32, 14, 35, 'metal', lo=0, hi=3, radius=1)
    c.rect(8, 14, 9, 32, 'metal', 3)
    c.rect(8, 14, 8, 32, 'metal', 5)
    thick_line(c, 9, 14, 15, 8, 2.0, 'metal', lo=1, hi=4)
    ellipse(c, 9, 14, 2.2, 2.2, 'gold', lo=2, hi=5)
    # Schirm
    poly(c, [(11, 3), (20, 3), (23, 11), (8, 11)], 'metal', lo=1, hi=5)
    for x in range(9, 23):
        c.put_ramp(x, 11, 'metal', 0 if x % 2 else 1)
    # Birne
    ellipse(c, 15.5, 12, 4.2, 2.4, 'gold', lo=4, hi=5, ambient=0.5)
    c.rect(13, 11, 17, 12, 'gold', 5)
    c.outline()
    return c


def dental_tray():
    """Instrumentenwagen mit Zange, Bohrer, Spiegel (22 x 24)"""
    c = Canvas(24, 26)
    round_rect(c, 1, 8, 22, 12, 'metal', lo=2, hi=5, radius=1)
    c.rect(3, 12, 4, 23, 'metal', 2)
    c.rect(19, 12, 20, 23, 'metal', 1)
    c.rect(2, 22, 5, 24, 'metal', 1)
    c.rect(18, 22, 21, 24, 'metal', 0)
    # Werkzeuge
    c.line(4, 7, 8, 3, 'metal', 5)
    c.line(5, 7, 9, 3, 'metal', 4)
    c.line(9, 3, 10, 1, 'metal', 5)
    c.put_ramp(7, 2, 'metal', 5)
    c.line(11, 7, 13, 2, 'wood', 4)
    c.put_ramp(13, 1, 'metal', 5)
    ellipse(c, 17.5, 4.5, 2.6, 2.6, 'sky', lo=3, hi=5)
    c.line(17, 7, 17, 8, 'metal', 3)
    c.put_ramp(20, 7, 'bone', 5)
    c.put_ramp(21, 7, 'bone', 4)
    c.outline()
    return c


def tooth_sign():
    """Riesenzahn als Wandschild mit Goldkrone (18 x 22)"""
    c = Canvas(20, 24)
    poly(c, [(2, 2), (8, 1), (10, 3), (12, 1), (17, 2), (18, 8), (16, 14), (15, 21), (12, 21), (10, 15), (8, 21), (5, 21), (4, 14), (1, 8)],
         'bone', lo=3, hi=5)
    # Goldzahn-Krone
    c.rect(11, 3, 15, 6, 'gold', 4)
    c.rect(11, 3, 15, 3, 'gold', 5)
    c.put_ramp(12, 4, 'gold', 5)
    c.put_ramp(15, 6, 'gold', 2)
    # Funkeln
    c.put_ramp(4, 4, 'bone', 5)
    c.put_ramp(3, 5, 'bone', 5)
    # Wurzeln dunkler
    for y in range(15, 21):
        c.put_ramp(6, y, 'bone', 2)
        c.put_ramp(13, y, 'bone', 2)
    c.outline()
    return c


def pliers_decor():
    """große Zange an der Wand (20 x 22)"""
    c = Canvas(20, 22)
    thick_line(c, 4, 20, 10, 9, 3.0, 'wood', lo=1, hi=4)
    thick_line(c, 15, 20, 10, 9, 3.0, 'wood', lo=2, hi=4)
    thick_line(c, 10, 9, 7, 2, 2.2, 'metal', lo=2, hi=5)
    thick_line(c, 10, 9, 13, 2, 2.2, 'metal', lo=1, hi=4)
    ellipse(c, 10, 9, 2.0, 2.0, 'gold', lo=3, hi=5)
    c.outline()
    return c


def tooth_jars():
    """Regalbrett mit Zahngläsern (30 x 18)"""
    c = Canvas(30, 18)
    c.rect(0, 14, 29, 16, 'wood', 3)
    c.rect(0, 14, 29, 14, 'wood', 5)
    c.rect(0, 16, 29, 16, 'wood', 1)
    for k, x in enumerate((2, 10, 18)):
        round_rect(c, x, 3, x + 6, 13, 'ice', lo=2, hi=5, radius=2)
        c.rect(x + 1, 1, x + 5, 3, 'wood', 3)
        for (tx, ty) in ((x + 2, 8), (x + 4, 10), (x + 3, 6)):
            c.put_ramp(tx, ty, 'bone', 5)
            c.put_ramp(tx, ty + 1, 'bone', 4)
        if k == 1:
            c.put_ramp(x + 3, 11, 'gold', 5)
    ellipse(c, 26, 11, 2.8, 2.8, 'bone', lo=3, hi=5)
    c.put_ramp(25, 10, 'coal', 1)
    c.put_ramp(27, 10, 'coal', 1)
    c.outline()
    return c


def spittoon():
    c = Canvas(12, 10)
    ellipse(c, 6, 5, 5.2, 3.8, 'metal', lo=1, hi=5)
    ellipse(c, 6, 4, 3.4, 1.8, 'ice', lo=2, hi=4)
    c.rect(3, 8, 8, 9, 'metal', 1)
    c.outline()
    return c


# =========================================================================== BRUNNEN DER EWIGEN JUGEND (BH-06)


def youth_fountain():
    """Prunkbrunnen (64 x 62): Becken, Doppelschale, Greisenkopf, der Wasser spuckt. Fußpunkt unten Mitte."""
    W, H = 70, 66
    c = Canvas(W, H)
    cx = 35
    # --- Becken (Vorderwand + Wasserfläche)
    by = 50           # Wasseroberfläche Mittelpunkt
    rx, ry = 31.0, 12.5
    # Außenwand unten
    for y in range(by, by + 13):
        for x in range(W):
            dx = (x + 0.5 - cx) / rx
            if abs(dx) > 1.0:
                continue
            ye = by + math.sqrt(max(0.0, 1 - dx * dx)) * ry
            if y <= ye + 6.5 and y >= by:
                u = (x - (cx - rx)) / (2 * rx)
                L = 0.85 - 0.5 * u - 0.1 * ((y - by) / 14.0)
                idx = quant(max(0.0, min(1.0, L)), 1, 4, x, y)
                if (y + int(x / 5)) % 6 == 5:
                    idx = max(1, idx - 1)
                c.put_ramp(x, y, 'stone', idx)
    # Rand oben (Ellipsenring)
    for y in range(by - 15, by + 16):
        for x in range(W):
            dx = (x + 0.5 - cx) / rx
            dy = (y + 0.5 - by) / ry
            d = dx * dx + dy * dy
            if d <= 1.0:
                if d > 0.66:
                    L = 0.9 - 0.45 * ((x - (cx - rx)) / (2 * rx)) - 0.2 * dy
                    c.put_ramp(x, y, 'stone', quant(max(0.0, min(1.0, L)), 3, 5, x, y))
                else:
                    wave = 0.5 + 0.25 * math.sin(x * 0.6 + y * 1.3) + 0.1 * math.sin(x * 0.2)
                    L = wave * 0.85 + 0.05 - (0.2 if dy < -0.25 else 0)
                    c.put_ramp(x, y, 'sky', quant(L, 2, 4, x, y))
    # Wasserfunkeln und Ringe
    for (x, y) in ((14, 50), (15, 50), (16, 50), (52, 52), (53, 52), (24, 56), (25, 56), (44, 46), (45, 46), (20, 45)):
        c.put_ramp(x, y, 'sky', 5)
    for (x, y) in ((cx - 7, 53), (cx - 6, 53), (cx + 6, 53), (cx + 7, 53), (cx - 8, 52), (cx + 8, 52)):
        c.put_ramp(x, y, 'bone', 5)
    # --- Sockel und Säule
    for y in range(26, 52):
        t = (y - 26) / 25.0
        half = 5 + (4 if y > 44 else 0)
        for x in range(cx - half, cx + half + 1):
            u = (x - (cx - half)) / float(2 * half + 1)
            idx = 4 if u < 0.25 else (3 if u < 0.55 else (2 if u < 0.85 else 1))
            if y in (38, 39):
                idx = max(1, idx - 1)
            c.put_ramp(x, y, 'stone', idx)
    # Greisenkopf (Gesicht in der Säule): Stirn, Brauen, Augen, Bart, Mund als Spund
    ellipse(c, cx, 36, 6.8, 6.4, 'stone', lo=2, hi=5, ambient=0.25)
    for x in range(cx - 5, cx + 6):
        c.put_ramp(x, 33, 'stone', 1)           # Stirnfalte
    c.rect(cx - 4, 34, cx - 2, 35, 'bone', 5)
    c.rect(cx + 2, 34, cx + 4, 35, 'bone', 4)    # buschige Brauen
    c.put_ramp(cx - 3, 36, 'coal', 1)
    c.put_ramp(cx + 3, 36, 'coal', 1)
    c.rect(cx - 1, 37, cx, 38, 'stone', 4)       # Nase
    # Bart
    poly(c, [(cx - 6, 39), (cx + 6, 39), (cx + 4, 48), (cx, 51), (cx - 4, 48)], 'bone', lo=3, hi=5)
    for y in (42, 45, 48):
        for x in range(cx - 4, cx + 5):
            if (x + y) % 3 == 0:
                c.put_ramp(x, y, 'bone', 2)
    # Mund (Spuckloch)
    c.rect(cx - 2, 40, cx + 2, 41, 'coal', 0)
    # --- obere Schale
    ellipse(c, cx, 27, 14, 4.6, 'stone', lo=2, hi=5, ambient=0.3, flatness=0.2)
    ellipse(c, cx, 26, 11, 2.6, 'sky', lo=3, hi=5)
    for x in range(cx - 14, cx + 15):
        yy = 27 + int(2.6 * math.sqrt(max(0.0, 1 - ((x - cx) / 14.0) ** 2)))
        c.put_ramp(x, yy + 1, 'stone', 1)
    # Spitze mit Goldkugel
    c.rect(cx - 1, 14, cx + 1, 25, 'stone', 3)
    c.rect(cx - 1, 14, cx - 1, 25, 'stone', 5)
    ellipse(c, cx, 11, 4.0, 4.0, 'gold', lo=2, hi=5)
    c.put_ramp(cx - 1, 9, 'gold', 5)
    # Wasserschleier von der oberen Schale in das Becken
    for side in (-1, 1):
        for k in range(0, 15):
            x = cx + side * (12 + k * 0.5)
            y = 29 + k * 1.2
            c.put_ramp(int(x), int(y), 'sky', 5 if k % 2 == 0 else 4)
            if k % 3 == 0:
                c.put_ramp(int(x) + side, int(y), 'sky', 3)
    # Strahl aus dem Mund: Bogen nach vorne rechts ins Becken
    for k in range(0, 18):
        x = cx + k * 0.9
        y = 41 + (k * 0.55) + 0.025 * k * k
        c.put_ramp(int(x), int(y), 'sky', 5)
        c.put_ramp(int(x), int(y) + 1, 'sky', 4)
        if k % 2:
            c.put_ramp(int(x) - 1, int(y) + 1, 'sky', 3)
    c.outline()
    return c


def putto(frame=0, flying=False):
    """geflügelter Amor-Knirps (12 x 14): Pausbacken, kleine Flügel, Windel"""
    c = Canvas(18, 16)
    # Flügel
    bob = 0
    wing_up = 1 if frame % 2 else 0
    for (x, y) in ((4, 5 - wing_up), (3, 4 - wing_up), (2, 3 - wing_up), (4, 6 - wing_up), (3, 6 - wing_up), (5, 7)):
        c.put_ramp(x, y, 'bone', 5 if y < 5 else 4)
    for (x, y) in ((13, 5 - wing_up), (14, 4 - wing_up), (15, 3 - wing_up), (13, 6 - wing_up), (14, 6 - wing_up), (12, 7)):
        c.put_ramp(x, y, 'bone', 4)
    # Körper
    ellipse(c, 9, 10, 3.4, 3.4, 'skin', lo=3, hi=5)
    c.rect(7, 12, 11, 13, 'bone', 4)
    c.put_ramp(8, 13, 'bone', 2)
    # Arme (hoch, tanzend) und Beine
    thick_line(c, 6, 9, 4, 5 + frame % 2, 1.6, 'skin', lo=3, hi=5)
    thick_line(c, 12, 9, 14, 6 - frame % 2, 1.6, 'skin', lo=2, hi=4)
    if not flying:
        c.rect(7, 14, 8, 15, 'skin', 3)
        c.rect(10, 14, 11, 15, 'skin', 2)
    # Kopf mit Löckchen
    ellipse(c, 9, 5.5, 3.6, 3.4, 'skin', lo=3, hi=5)
    c.put_ramp(10, 5, 'coal', 1)
    c.put_ramp(11, 7, 'skin', 2)
    for (x, y) in ((6, 3), (7, 2), (8, 2), (9, 2), (10, 2), (11, 3), (6, 4)):
        c.put_ramp(x, y, 'gold', 4 if x < 9 else 3)
    c.put_ramp(8, 1, 'gold', 5)
    # Heiligenschein
    for x in (7, 8, 9, 10, 11):
        c.put_ramp(x, 0, 'gold', 5)
    c.outline()
    return c


# =========================================================================== PHÖNIX-NEST (BH-07)


def phoenix_nest():
    """Riesiges Nest aus Zweigen und Federn mit Glut in der Mitte (60 x 36), Küken separat"""
    W, H = 62, 38
    c = Canvas(W, H)
    cx = 31
    rnd = random.Random(7)
    # Rückwand des Nestes (innen sichtbar)
    ellipse(c, cx, 16, 28, 10, 'wood', lo=0, hi=3, ambient=0.2)
    # Glutbett
    ellipse(c, cx, 17, 22, 7, 'fire', lo=2, hi=5, ambient=0.5, flatness=0.3)
    for (x, y) in ((cx - 10, 15), (cx + 8, 18), (cx - 3, 20), (cx + 14, 14), (cx - 16, 18)):
        c.put_ramp(x, y, 'gold', 5)
        c.put_ramp(x + 1, y, 'gold', 4)
    # Wulst aus Zweigen: vorne dick, geflochten
    for layer, (ry_, yy) in enumerate(((10, 26), (9, 29), (8, 31))):
        for x in range(0, W):
            dx = (x + 0.5 - cx) / 30.0
            if abs(dx) > 1.0:
                continue
            ye = yy + 0 * layer
            top = int(ye - math.sqrt(max(0.0, 1 - dx * dx)) * (ry_ - 3))
            bot = int(ye + 5)
            for y in range(max(top, 17), bot):
                if y < 18 and abs(dx) < 0.85:
                    continue
                u = (x - 1) / float(W)
                idx = 4 if (y - top) < 2 else (3 if (y + x // 4) % 4 else 2)
                if layer == 2:
                    idx = max(1, idx - 1)
                if (x * 3 + y * 5) % 11 == 0:
                    idx = max(1, idx - 1)
                c.put_ramp(x, y, 'wood', idx)
    # diagonale Zweige
    for k in range(10):
        x0 = rnd.randint(2, W - 14)
        y0 = rnd.randint(22, 33)
        ln = rnd.randint(8, 14)
        c.line(x0, y0, x0 + ln, y0 + rnd.randint(-2, 2) , 'wood', rnd.choice((2, 4, 5)))
    # Federn am Rand: Glut-Orange und Gold
    for (fx, fy, col, ang) in ((3, 24, 'fire', -1), (9, 21, 'gold', -1), (52, 22, 'fire', 1), (58, 25, 'gold', 1), (45, 20, 'gold', 1), (17, 20, 'fire', -1)):
        for k in range(8):
            x = fx + ang * (k // 2)
            y = fy - k
            c.put_ramp(x, y, col, 4 if k < 6 else 5)
            c.put_ramp(x + ang, y, col, 3)
        c.put_ramp(fx, fy + 1, 'wood', 3)
    c.outline()
    return c


def phoenix_chick():
    """Phönix-Küken: Feuerball mit Flammenschopf, dickem Schnabel, quiekt Funken (28 x 30)"""
    c = Canvas(30, 32)
    # Flammenschopf
    for (pts, col) in (([(10, 8), (12, 0), (14, 6)], 'fire'), ([(14, 7), (17, -1), (19, 6)], 'gold'), ([(18, 8), (22, 2), (22, 8)], 'fire')):
        poly(c, [(x, y + 3) for x, y in pts], col, lo=2, hi=5)
    # Körper
    ellipse(c, 14.5, 20, 10.4, 9.2, 'gold', lo=2, hi=5, ambient=0.2)
    ellipse(c, 14.5, 23, 7.0, 5.4, 'fire', lo=3, hi=5, ambient=0.3)
    # Flügelchen
    ellipse(c, 6.5, 21, 3.4, 4.6, 'fire', lo=1, hi=4)
    ellipse(c, 22.5, 21, 3.0, 4.2, 'fire', lo=2, hi=4)
    for (x, y) in ((4, 25), (6, 26), (8, 26)):
        c.put_ramp(x, y, 'gold', 4)
    # Kopf
    ellipse(c, 15, 12, 8.0, 7.0, 'gold', lo=3, hi=5, ambient=0.2)
    # Augen (2x2, eng) mit Glanz
    c.rect(17, 10, 18, 11, 'coal', 1)
    c.put_ramp(17, 10, 'bone', 5)
    # Schnabel: weit offen, quiekt
    poly(c, [(20, 12), (28, 13), (20, 15)], 'fire', lo=2, hi=5)
    poly(c, [(20, 16), (26, 18), (20, 18)], 'fire', lo=1, hi=3)
    c.rect(21, 15, 25, 15, 'coal', 1)
    # Beinchen
    c.rect(11, 29, 12, 31, 'fire', 2)
    c.rect(17, 29, 18, 31, 'fire', 3)
    c.rect(9, 31, 13, 31, 'fire', 2)
    c.rect(16, 31, 20, 31, 'fire', 3)
    c.outline()
    return c


def ember_spark(col='gold'):
    c = Canvas(3, 3)
    c.put_ramp(1, 1, col, 5)
    c.put_ramp(0, 1, 'fire', 4)
    c.put_ramp(1, 0, 'fire', 3)
    return c


def brazier():
    """Standfeuerschale (14 x 22)"""
    c = Canvas(16, 24)
    c.rect(7, 13, 8, 22, 'metal', 2)
    c.rect(7, 13, 7, 22, 'metal', 4)
    c.rect(4, 22, 11, 23, 'metal', 1)
    poly(c, [(2, 10), (13, 10), (11, 15), (4, 15)], 'metal', lo=0, hi=4)
    c.rect(2, 10, 13, 10, 'metal', 5)
    for (pts, col) in (([(4, 9), (6, 3), (8, 9)], 'fire'), ([(7, 9), (9, 1), (11, 9)], 'gold'), ([(9, 9), (12, 5), (13, 9)], 'fire')):
        poly(c, pts, col, lo=2, hi=5)
    c.put_ramp(9, 4, 'gold', 5)
    c.outline()
    return c


def feather_banner():
    """hängende Riesenfeder (12 x 24)"""
    c = Canvas(14, 26)
    c.rect(2, 1, 11, 1, 'wood', 4)
    for y in range(3, 22):
        t = (y - 3) / 18.0
        half = int(4.8 * math.sin(math.pi * min(1.0, t * 0.9 + 0.1)))
        for x in range(7 - half, 7 + half + 1):
            u = (x - (7 - half)) / float(2 * half + 1)
            col = 'fire' if y > 12 else 'gold'
            idx = 5 if u < 0.2 else (4 if u < 0.5 else (3 if u < 0.8 else 2))
            if (y + x) % 5 == 0:
                idx = max(1, idx - 1)
            c.put_ramp(x, y, col, idx)
    c.rect(7, 2, 7, 23, 'wood', 3)
    c.outline()
    return c


# =========================================================================== RÜSTKAMMER (BW-02)


def armor_stand(head='helm', plume=True, lean=0, pose=0):
    """Rüstungsständer (26 x 40): Harnisch auf Holzständer; head: 'helm' | 'bucket' | 'pot'. Gesicht: Sehschlitz-Augen und Grinsen."""
    c = Canvas(28, 42)
    cx = 14
    # Ständer
    c.rect(cx - 1, 30, cx, 38, 'wood', 3)
    c.rect(cx - 1, 30, cx - 1, 38, 'wood', 4)
    c.rect(cx - 8, 38, cx + 7, 40, 'wood', 2)
    c.rect(cx - 8, 38, cx + 7, 38, 'wood', 4)
    # Beinschienen
    for dx, ramp_i in ((-4, 2), (3, 3)):
        round_rect(c, cx + dx - 2, 28, cx + dx + 2, 36, 'metal', lo=1, hi=4, radius=1)
    # Rock
    poly(c, [(cx - 9, 22), (cx + 9, 22), (cx + 10, 30), (cx - 10, 30)], 'teamA', lo=1, hi=4)
    for x in range(cx - 10, cx + 10, 3):
        c.put_ramp(x, 29, 'teamA', 1)
    # Brustpanzer
    round_rect(c, cx - 8, 12, cx + 8, 23, 'metal', lo=1, hi=5, radius=3)
    for y in range(14, 22):
        c.put_ramp(cx, y, 'metal', 2)
    for x in range(cx - 7, cx + 8):
        c.put_ramp(x, 20, 'metal', 2 if x % 2 else 3)
    c.put_ramp(cx - 5, 14, 'metal', 5)
    c.put_ramp(cx - 4, 14, 'metal', 5)
    c.put_ramp(cx - 5, 15, 'metal', 5)
    # Schulterstücke
    ellipse(c, cx - 9, 13, 4.2, 3.4, 'metal', lo=1, hi=5)
    ellipse(c, cx + 9, 13, 4.2, 3.4, 'metal', lo=1, hi=4)
    # Arme (hängen, Handschuhe)
    thick_line(c, cx - 10, 15, cx - 11, 25, 3.4, 'metal', lo=1, hi=4)
    thick_line(c, cx + 10, 15, cx + 11, 25, 3.4, 'metal', lo=0, hi=3)
    ellipse(c, cx - 11, 26, 2.2, 2.0, 'metal', lo=2, hi=5)
    ellipse(c, cx + 11, 26, 2.2, 2.0, 'metal', lo=1, hi=4)
    # Hals
    c.rect(cx - 3, 10, cx + 3, 12, 'metal', 1)
    # Kopfbedeckung
    if head == 'helm':
        ellipse(c, cx + 0.5, 6, 6.4, 6.8, 'metal', lo=1, hi=5)
        c.rect(cx - 5, 5, cx + 6, 7, 'coal', 0)           # Visier-Schlitz
        c.rect(cx - 3, 5, cx - 3, 6, 'bone', 4)
        c.rect(cx + 3, 5, cx + 3, 6, 'bone', 4)
        for x in range(cx - 4, cx + 6):
            c.put_ramp(x, 9, 'coal', 1 if x % 2 else 0)
        # Grinsen (Streifen im Visier unten)
        for x in range(cx - 4, cx + 6):
            if x % 2 == 0:
                c.put_ramp(x, 9, 'bone', 4)
        if plume:
            for k in range(7):
                c.put_ramp(cx + 1 - k // 3, 0 - k // 4 + 1, 'teamA', 4)
            poly(c, [(cx, 1), (cx - 4, 0), (cx - 8, 5), (cx - 3, 3), (cx + 2, 2)], 'teamA', lo=2, hi=5)
    elif head == 'bucket':
        # Eimer als Helm: Trapez, Henkel, dunkle Sehschlitze
        poly(c, [(cx - 6, 1), (cx + 7, 1), (cx + 6, 11), (cx - 5, 11)], 'wood', lo=1, hi=4)
        c.rect(cx - 6, 1, cx + 7, 2, 'wood', 5)
        for x in range(cx - 6, cx + 7):
            c.put_ramp(x, 4, 'metal', 2)
            c.put_ramp(x, 9, 'metal', 2)
        c.rect(cx - 3, 6, cx - 2, 7, 'coal', 0)
        c.rect(cx + 3, 6, cx + 4, 7, 'coal', 0)
        c.line(cx - 6, 1, cx - 3, -1, 'metal', 4)
        c.line(cx + 7, 1, cx + 4, -1, 'metal', 3)
    else:
        # Kochtopf-Helm
        ellipse(c, cx + 0.5, 6, 6.8, 6.4, 'metal', lo=0, hi=4, clip=lambda x, y: y <= 9)
        c.rect(cx - 7, 9, cx + 8, 10, 'metal', 2)
        c.rect(cx - 3, 6, cx - 2, 7, 'coal', 0)
        c.rect(cx + 3, 6, cx + 4, 7, 'coal', 0)
        c.rect(cx - 9, 5, cx - 8, 7, 'metal', 4)
        c.rect(cx + 9, 5, cx + 10, 7, 'metal', 2)
        c.rect(cx - 1, 0, cx + 1, 1, 'metal', 4)
    c.outline()
    return c


def giggle_marks():
    """kleine Kicher-Striche (Bewegungslinien + Tränchen) für die Rüstungen (28 x 10)"""
    c = Canvas(30, 12)
    for (x, y, i) in ((2, 6, 4), (1, 4, 5), (3, 8, 4), (2, 2, 5), (26, 6, 4), (27, 4, 5), (25, 8, 4), (26, 2, 5)):
        c.put_ramp(x, y, 'bone', i)
        c.put_ramp(x + (1 if x < 10 else -1), y, 'bone', i - 1)
    return c


def weapon_wall():
    """Wanddeko: Schild mit gekreuzten Schwertern (26 x 22)"""
    c = Canvas(26, 24)
    thick_line(c, 3, 3, 22, 19, 2.4, 'metal', lo=2, hi=5)
    thick_line(c, 22, 3, 3, 19, 2.4, 'metal', lo=1, hi=4)
    c.rect(2, 19, 5, 20, 'gold', 4)
    c.rect(20, 19, 23, 20, 'gold', 4)
    poly(c, [(7, 4), (19, 4), (19, 13), (13, 20), (7, 13)], 'teamA', lo=1, hi=4)
    c.rect(12, 5, 13, 17, 'gold', 4)
    c.rect(8, 10, 18, 11, 'gold', 4)
    c.put_ramp(12, 5, 'gold', 5)
    c.outline()
    return c


def helmet_shelf():
    """Regal mit Helmen (34 x 16)"""
    c = Canvas(34, 18)
    c.rect(0, 14, 33, 16, 'wood', 3)
    c.rect(0, 14, 33, 14, 'wood', 5)
    c.rect(0, 16, 33, 16, 'wood', 1)
    for (x, kind) in ((2, 'helm'), (12, 'pot'), (22, 'bucket')):
        if kind == 'helm':
            ellipse(c, x + 4.5, 9, 4.8, 4.6, 'metal', lo=1, hi=5, clip=lambda xx, yy: yy <= 13)
            c.rect(x, 12, x + 9, 13, 'metal', 2)
            c.rect(x + 4, 1, x + 5, 5, 'teamA', 3)
        elif kind == 'pot':
            ellipse(c, x + 4.5, 9, 4.8, 4.6, 'metal', lo=0, hi=4, clip=lambda xx, yy: yy <= 13)
            c.rect(x, 12, x + 9, 13, 'metal', 2)
            c.rect(x - 1, 8, x, 10, 'metal', 4)
            c.rect(x + 9, 8, x + 10, 10, 'metal', 2)
        else:
            poly(c, [(x, 7), (x + 9, 7), (x + 8, 13), (x + 1, 13)], 'wood', lo=1, hi=4)
            c.rect(x, 7, x + 9, 8, 'wood', 5)
            c.rect(x + 1, 10, x + 8, 10, 'metal', 2)
    c.outline()
    return c


def squire_bucket():
    """Knappe mit zu großem Eimerhelm und Schild (20 x 24)"""
    c = Canvas(24, 26)
    # Beine
    thick_line(c, 9, 18, 9, 23, 2.6, 'cloth', lo=1, hi=3)
    thick_line(c, 14, 18, 14, 23, 2.6, 'cloth', lo=2, hi=4)
    c.rect(7, 24, 11, 25, 'wood', 2)
    c.rect(13, 24, 17, 25, 'wood', 3)
    # Körper
    round_rect(c, 6, 11, 17, 20, 'bone', lo=2, hi=5, radius=2)
    c.rect(6, 17, 17, 17, 'gold', 2)
    # Arme + kleiner Schild
    thick_line(c, 6, 13, 3, 19, 2.0, 'skin', lo=2, hi=4)
    round_rect(c, 1, 14, 7, 22, 'teamA', lo=1, hi=4, radius=2)
    c.rect(4, 15, 4, 21, 'gold', 4)
    thick_line(c, 17, 13, 20, 18, 2.0, 'skin', lo=3, hi=5)
    # Eimer über dem Kopf (viel zu groß)
    poly(c, [(5, 2), (19, 2), (18, 12), (6, 12)], 'metal', lo=1, hi=4)
    c.rect(5, 2, 19, 3, 'metal', 5)
    for x in range(5, 20):
        c.put_ramp(x, 5, 'metal', 2)
        c.put_ramp(x, 10, 'metal', 2)
    c.rect(9, 7, 10, 8, 'coal', 0)
    c.rect(14, 7, 15, 8, 'coal', 0)
    c.line(5, 2, 9, -0, 'metal', 4)
    c.line(19, 2, 15, 0, 'metal', 3)
    c.outline()
    return c


# =========================================================================== PULVERKAMMER (BW-03)


def powder_keg(size=1, skull=True):
    """Pulverfass mit Totenkopf, schwarz-braun, Goldreifen (16 x 20); size 2 = groß (20 x 24)"""
    w, h = (16, 20) if size == 1 else (20, 24)
    c = Canvas(w, h)
    round_rect(c, 1, 3, w - 3, h - 2, 'coal', lo=1, hi=4, radius=4, ambient=0.3)
    # Holzbänder (Fassdauben)
    for x in range(3, w - 3, 3):
        for y in range(5, h - 4):
            c.put_ramp(x, y, 'coal', 1)
    ellipse(c, (w - 2) / 2.0, 3.6, (w - 4) / 2.0, 2.6, 'wood', lo=1, hi=4)
    for y in (5, h - 5):
        for x in range(1, w - 2):
            c.put_ramp(x, y, 'gold', 3 if x % 2 else 2)
    if skull:
        sx, sy = (w - 2) // 2 - 3, h // 2 - 2
        for (dx, dy, i) in ((1, 0, 5), (2, 0, 5), (3, 0, 5), (4, 0, 5), (0, 1, 5), (1, 1, 5), (2, 1, 5), (3, 1, 5), (4, 1, 5), (5, 1, 4),
                            (0, 2, 5), (1, 2, 5), (2, 2, 5), (3, 2, 5), (4, 2, 5), (5, 2, 4), (1, 3, 5), (2, 3, 4), (3, 3, 5), (4, 3, 4), (2, 4, 4), (4, 4, 4)):
            c.put_ramp(sx + dx, sy + dy, 'bone', i)
        for (dx, dy) in ((1, 1), (2, 1), (4, 1), (5, 1)):
            pass
        c.put_ramp(sx + 1, sy + 1, 'coal', 0)
        c.put_ramp(sx + 2, sy + 1, 'coal', 0)
        c.put_ramp(sx + 4, sy + 1, 'coal', 0)
        c.put_ramp(sx + 5, sy + 1, 'coal', 0)
    c.outline()
    return c


def pipe_sign():
    """Verbotsschild: durchgestrichene Pfeife (Bild, keine Schrift) (16 x 22)"""
    c = Canvas(18, 24)
    c.rect(8, 14, 9, 22, 'wood', 3)
    c.rect(8, 14, 8, 22, 'wood', 4)
    ellipse(c, 9, 8, 8.0, 8.0, 'bone', lo=3, hi=5)
    # roter Ring
    for y in range(0, 17):
        for x in range(0, 18):
            d = math.hypot(x + 0.5 - 9, y + 0.5 - 8)
            if 5.8 < d <= 8.0:
                c.put_ramp(x, y, 'fire', 3 if (x + y) % 3 else 4)
    # Pfeife
    for (x, y, r, i) in ((5, 11, 'wood', 3), (6, 11, 'wood', 3), (7, 11, 'wood', 3), (8, 10, 'wood', 2), (9, 9, 'wood', 2), (10, 9, 'wood', 3),
                         (10, 8, 'wood', 2), (11, 7, 'wood', 3), (12, 6, 'wood', 4)):
        c.put_ramp(x, y, r, i)
    for (x, y) in ((11, 5), (12, 5), (12, 4)):
        c.put_ramp(x, y, 'coal', 2)
    # Rauchfähnchen
    c.put_ramp(11, 3, 'stone', 4)
    c.put_ramp(12, 2, 'stone', 3)
    # roter Balken
    for k in range(-6, 7):
        c.put_ramp(9 + k, 8 + k, 'fire', 3)
        c.put_ramp(10 + k, 8 + k, 'fire', 2)
    c.outline()
    return c


def fly():
    """Fliege (5 x 4)"""
    c = Canvas(7, 5)
    c.put_ramp(3, 3, 'coal', 2)
    c.put_ramp(4, 3, 'coal', 1)
    c.put_ramp(2, 1, 'bone', 5)
    c.put_ramp(3, 1, 'bone', 4)
    c.put_ramp(4, 0, 'bone', 5)
    c.put_ramp(5, 1, 'bone', 4)
    return c


def powder_trail(n=22):
    """verstreute Pulverspur (Bodendeko)"""
    c = Canvas(n, 6)
    rnd = random.Random(5)
    for x in range(n):
        y = 3 + int(1.5 * math.sin(x * 0.5))
        c.put_ramp(x, y, 'coal', 1)
        if rnd.random() < 0.6:
            c.put_ramp(x, y + rnd.choice((-1, 1)), 'coal', 0 if rnd.random() < 0.5 else 2)
    return c


def hanging_lantern():
    """sichere Laterne an Kette (10 x 18)"""
    c = Canvas(10, 20)
    c.rect(4, 0, 4, 5, 'metal', 3)
    round_rect(c, 1, 5, 8, 15, 'metal', lo=1, hi=4, radius=1)
    c.rect(2, 7, 7, 13, 'gold', 3)
    c.rect(3, 8, 6, 12, 'gold', 5)
    c.rect(2, 16, 7, 17, 'metal', 2)
    c.outline()
    return c


def sack_pile():
    c = Canvas(18, 16)
    ellipse(c, 9, 10, 8, 5.5, 'bone', lo=2, hi=4)
    ellipse(c, 6, 6, 4.5, 4.5, 'bone', lo=2, hi=5)
    c.put_ramp(6, 2, 'bone', 5)
    c.rect(5, 0, 7, 1, 'bone', 3)
    c.put_ramp(6, 7, 'coal', 2)
    c.put_ramp(7, 8, 'coal', 2)
    c.outline()
    return c


# =========================================================================== FEUERWERKEREI (BW-04)

FW_COLORS = ('fire', 'gold', 'leaf', 'ice', 'purple')


def rocket(col='fire', h=22, lit=False, tilt=0):
    """Feuerwerksrakete (8 x h): Papphülse in Farbe, Spitzkopf, Stab, Lunte"""
    c = Canvas(10, h + 2)
    cx = 4
    # Stab
    c.rect(cx, 10, cx, h, 'wood', 3)
    # Hülse
    round_rect(c, cx - 2, 7, cx + 2, 15, 'bone', lo=3, hi=5, radius=1)
    for y in (9, 13):
        c.rect(cx - 2, y, cx + 2, y, col, 3)
    c.rect(cx - 1, 10, cx - 1, 12, col, 4)
    # Spitzkopf
    poly(c, [(cx - 2, 7), (cx + 3, 7), (cx + 0.5, 0)], col, lo=2, hi=5)
    c.put_ramp(cx - 1, 4, col, 5)
    # Lunte
    if lit:
        c.put_ramp(cx, h + 0, 'gold', 5)
        c.put_ramp(cx, h + 1, 'fire', 4)
    c.outline()
    return c


def firework_fountain(col='gold'):
    """Feuerwerks-Fontäne: kurze Pappröhre auf dem Boden (10 x 12)"""
    c = Canvas(12, 14)
    round_rect(c, 2, 4, 9, 12, 'bone', lo=2, hi=5, radius=1)
    for y in (6, 10):
        c.rect(2, y, 9, y, col, 3)
    c.rect(2, 4, 9, 4, 'coal', 2)
    c.outline()
    return c


def spark_fountain(col_cycle=FW_COLORS, seed=3, h=34, w=36):
    """Funkenfontäne (Schweif) in fünf Farben, steigt aus (w//2, h-1)"""
    c = Canvas(w, h)
    rnd = random.Random(seed)
    cx = w // 2
    for k in range(70):
        t = rnd.random()
        ang = rnd.uniform(-1.0, 1.0)
        spread = 0.9 + 0.3 * t
        x = cx + ang * 13 * (t ** 0.7)
        y = (h - 2) - (h - 6) * (1 - (ang * ang) * 0.5) * math.sqrt(t) + 5 * t * t
        col = col_cycle[k % len(col_cycle)]
        i = 5 if t < 0.6 else 4
        c.put_ramp(int(x), int(y), col, i)
        if t < 0.5:
            c.put_ramp(int(x), int(y) + 1, col, 3)
    # heller Kern
    for y in range(h - 8, h - 1):
        c.put_ramp(cx, y, 'gold', 5)
        if y > h - 5:
            c.put_ramp(cx - 1, y, 'fire', 4)
            c.put_ramp(cx + 1, y, 'fire', 4)
    return c


def star_burst(col='gold', r=5):
    """kleiner Funkenstern (Sternchen) (2r+1)"""
    c = Canvas(2 * r + 1, 2 * r + 1)
    for k in range(8):
        a = k * math.pi / 4
        for s in range(1, r + 1):
            x = r + int(round(math.cos(a) * s))
            y = r + int(round(math.sin(a) * s))
            idx = 5 if s <= r // 2 + 1 else (4 if s < r else 3)
            if k % 2 and s > r - 2:
                continue
            c.put_ramp(x, y, col, idx)
    c.put_ramp(r, r, 'bone', 5)
    return c


def rocket_rack():
    """Raketenregal / Fass mit Raketen (24 x 34)"""
    c = Canvas(26, 36)
    cols = ('fire', 'leaf', 'gold', 'purple', 'ice')
    # Raketen von hinten nach vorn
    for k, (x, col, hh) in enumerate(((5, 'fire', 14), (10, 'leaf', 18), (15, 'gold', 15), (20, 'ice', 17), (12, 'purple', 12))):
        r = rocket(col, hh + 6)
        c.blit(r, x - 4, 12 - (hh - 12) - 6 + 8 - (6 if k == 4 else 0))
    # Fass vorn
    round_rect(c, 3, 20, 22, 34, 'wood', lo=1, hi=4, radius=3)
    for y in (24, 30):
        for x in range(3, 23):
            c.put_ramp(x, y, 'metal', 2)
    c.put_ramp(8, 27, 'gold', 5)
    c.put_ramp(14, 27, 'gold', 4)
    c.put_ramp(18, 27, 'fire', 4)
    c.outline()
    return c


def scorch_mark(w=18, h=8):
    """Rußfleck (Bodendeko)"""
    c = Canvas(w, h)
    for y in range(h):
        for x in range(w):
            d = ((x + 0.5 - w / 2) / (w / 2)) ** 2 + ((y + 0.5 - h / 2) / (h / 2)) ** 2
            if d < 1.0 and (d < 0.5 or (x + y) % 2 == 0):
                c.put_ramp(x, y, 'coal', 1 if d < 0.4 else 2)
    return c


def sparkler(n=1):
    """Wunderkerze (6 x 18): Stab mit Funkenkranz"""
    c = Canvas(14, 20)
    c.line(7, 19, 7, 8, 'metal', 4)
    for k in range(12):
        a = k * math.pi / 6
        r = 3 + (k % 2) * 2
        c.put_ramp(7 + int(round(math.cos(a) * r)), 6 + int(round(math.sin(a) * r)), 'gold' if k % 3 else 'bone', 5)
    c.put_ramp(7, 6, 'bone', 5)
    return c


def banner_rocket():
    """Wanddeko: Raketenzeichnung als Schild (16 x 22)"""
    c = Canvas(18, 24)
    round_rect(c, 0, 0, 17, 23, 'wood', lo=1, hi=4, radius=1)
    c.rect(2, 2, 15, 21, 'coal', 1)
    # Rakete diagonal
    thick_line(c, 4, 18, 12, 8, 3.4, 'bone', lo=3, hi=5)
    poly(c, [(11, 10), (15, 10), (14, 4)], 'fire', lo=2, hi=5)
    c.put_ramp(3, 19, 'gold', 5)
    c.put_ramp(2, 20, 'fire', 4)
    for (x, y, col) in ((4, 5, 'ice'), (13, 16, 'leaf'), (6, 12, 'purple'), (9, 4, 'gold')):
        c.put_ramp(x, y, col, 5)
        c.put_ramp(x + 1, y, col, 4)
    c.outline()
    return c


def firecracker_string():
    """Böller-Girlande an der Wand (30 x 12)"""
    c = Canvas(30, 12)
    for x in range(0, 30):
        y = 2 + int(2.5 * math.sin(x / 29.0 * math.pi))
        c.put_ramp(x, y, 'bone', 3)
    for k, x in enumerate(range(3, 28, 5)):
        y = 2 + int(2.5 * math.sin(x / 29.0 * math.pi)) + 1
        col = FW_COLORS[k % 5]
        c.rect(x, y, x + 1, y + 5, col, 3)
        c.put_ramp(x, y, col, 5)
        c.put_ramp(x, y + 5, col, 2)
        c.put_ramp(x + 1, y + 5, col, 1)
    c.outline()
    return c


# =========================================================================== KANONENGIESSEREI (BW-05)


def crucible():
    """Riesiger Schmelztiegel auf Steinofen, glühendes Metall, Kette und Schöpfkelle (44 x 46)"""
    W, H = 46, 48
    c = Canvas(W, H)
    cx = 22
    # Ofen-Sockel (Stein)
    round_rect(c, 6, 26, 38, 47, 'stone', lo=0, hi=4, radius=3)
    for y in (31, 37, 43):
        for x in range(6, 39):
            c.put_ramp(x, y, 'stone', 1)
    for (x, ys) in ((14, (26, 31)), (24, (31, 37)), (11, (37, 43)), (29, (37, 43)), (19, (43, 47))):
        for y in range(ys[0], ys[1]):
            c.put_ramp(x, y, 'stone', 1)
    # Feuerloch
    ellipse(c, cx, 42, 8.0, 5.0, 'coal', lo=0, hi=1, clip=lambda x, y: y <= 46)
    for (x, y) in ((cx - 4, 43), (cx - 1, 44), (cx + 3, 43), (cx, 41), (cx + 5, 44), (cx - 6, 44)):
        c.put_ramp(x, y, 'fire', 3)
        c.put_ramp(x + 1, y, 'gold', 4)
    for x in range(cx - 7, cx + 8):
        c.put_ramp(x, 46, 'fire', 2 if x % 2 else 3)
    # Tiegel: dicke Schale
    ellipse(c, cx, 18, 19, 15, 'metal', lo=0, hi=4, ambient=0.2, clip=lambda x, y: y >= 12)
    ellipse(c, cx, 14, 19.5, 5.5, 'metal', lo=2, hi=5, ambient=0.3)
    # Schmelze
    ellipse(c, cx, 14.5, 16.5, 3.8, 'fire', lo=3, hi=5, ambient=0.6, flatness=0.3)
    for (x, y) in ((cx - 8, 14), (cx - 7, 14), (cx + 4, 15), (cx + 5, 15), (cx, 13), (cx - 2, 15)):
        c.put_ramp(x, y, 'gold', 5)
    for (x, y) in ((cx + 9, 14), (cx - 12, 13)):
        c.put_ramp(x, y, 'bone', 5)
    # Nieten
    for x in range(cx - 12, cx + 13, 6):
        c.put_ramp(x, 24, 'metal', 5)
        c.put_ramp(x + 1, 25, 'metal', 1)
    for x in range(cx - 16, cx + 17):
        c.put_ramp(x, 29, 'metal', 1 if x % 2 else 0)
    # Gießschnauze rechts
    poly(c, [(cx + 17, 11), (cx + 24, 14), (cx + 18, 17)], 'metal', lo=1, hi=5)
    c.put_ramp(cx + 22, 15, 'fire', 4)
    c.put_ramp(cx + 23, 16, 'gold', 5)
    c.outline()
    return c


def ladle():
    """Gießkelle mit langem Stiel (24 x 24), glühende Füllung"""
    c = Canvas(26, 26)
    thick_line(c, 2, 22, 18, 6, 2.4, 'wood', lo=1, hi=4)
    ellipse(c, 20, 5, 4.4, 3.6, 'metal', lo=1, hi=5)
    ellipse(c, 20, 4.5, 3.2, 1.8, 'fire', lo=3, hi=5, ambient=0.7)
    c.put_ramp(20, 4, 'gold', 5)
    c.outline()
    return c


def drying_cannon(kind=0, drip=True):
    """kleine Kanonenrohr-Attrappe zum Trocknen: hängt mit Wäscheklammer an der Leine (10 x 26)"""
    lengths = (24, 18, 21)
    L = lengths[kind % 3]
    w = 10 if kind != 1 else 8
    c = Canvas(14, L + 6)
    # Klammer
    c.rect(5, 0, 8, 3, 'wood', 4)
    c.rect(5, 0, 5, 3, 'wood', 5)
    c.put_ramp(8, 3, 'wood', 2)
    c.put_ramp(6, 2, 'metal', 3)
    # Rohr (hängt, Mündung unten; Kugelknauf = Traube oben)
    x0 = 7 - w // 2
    for y in range(3, 3 + L):
        for x in range(x0, x0 + w):
            u = (x - x0 + 0.5) / w
            nn = u * 2 - 1
            nz = math.sqrt(max(0.0, 1 - nn * nn))
            dot = nn * LIGHT[0] + nz * LIGHT[2]
            Lm = 0.2 + 0.8 * max(0.0, dot)
            idx = quant(Lm, 0, 4, x, y)
            c.put_ramp(x, y, 'metal', idx)
    # Reifen
    for y in (3 + L // 3, 3 + 2 * L // 3):
        for x in range(x0 - 1, x0 + w + 1):
            c.put_ramp(x, y, 'metal', 1 if x % 2 else 2)
    # Mündungswulst
    for x in range(x0 - 2, x0 + w + 2):
        c.put_ramp(x, 3 + L - 1, 'metal', 3 if x < 7 else 1)
        c.put_ramp(x, 3 + L - 2, 'metal', 4 if x < 7 else 2)
    c.rect(x0 + 1, 3 + L, x0 + w - 2, 3 + L, 'coal', 0)
    if drip:
        c.put_ramp(x0 + 2, 3 + L + 1, 'ice', 4)
        c.put_ramp(x0 + 2, 3 + L + 2, 'ice', 3)
    c.outline()
    return c


def clothesline_post():
    c = Canvas(6, 40)
    c.rect(1, 2, 3, 39, 'wood', 3)
    c.rect(1, 2, 1, 39, 'wood', 4)
    c.rect(3, 2, 3, 39, 'wood', 1)
    c.rect(0, 36, 5, 39, 'wood', 2)
    c.rect(0, 1, 4, 2, 'wood', 5)
    c.outline()
    return c


def mold_box():
    """Gussform: Sandkasten mit Rohr-Abdruck (26 x 16)"""
    c = Canvas(28, 16)
    round_rect(c, 0, 4, 27, 14, 'wood', lo=1, hi=4, radius=1)
    for x in range(2, 26):
        for y in range(6, 12):
            c.put_ramp(x, y, 'dirt', 2 if (x + y) % 5 else 1)
    for x in range(5, 23):
        c.put_ramp(x, 8, 'dirt', 0)
        c.put_ramp(x, 9, 'dirt', 0)
        c.put_ramp(x, 7, 'dirt', 4)
    c.put_ramp(24, 8, 'fire', 4)
    c.put_ramp(23, 8, 'gold', 5)
    c.outline()
    return c


def slag_bucket():
    c = Canvas(14, 14)
    poly(c, [(1, 3), (12, 3), (10, 12), (3, 12)], 'metal', lo=0, hi=3)
    c.rect(1, 3, 12, 3, 'metal', 4)
    c.rect(3, 4, 10, 5, 'fire', 3)
    c.put_ramp(6, 4, 'gold', 5)
    c.line(1, 3, 4, 0, 'metal', 3)
    c.line(12, 3, 9, 0, 'metal', 2)
    c.outline()
    return c


def cannonball_pile():
    c = Canvas(20, 14)
    for (cx_, cy_) in ((5, 9), (11, 9), (17, 9), (8, 4), (14, 4)):
        ellipse(c, cx_, cy_, 3.4, 3.4, 'coal', lo=0, hi=4)
        c.put_ramp(cx_ - 1, cy_ - 1, 'coal', 5)
    c.outline()
    return c


# =========================================================================== RUNENPRESSE (BW-06)


def rune_glyph(kind=0, ramp='purple', idx=5):
    """abstrakte Rune (keine Buchstaben): 7x7"""
    shapes = [
        [(3, 0), (3, 1), (3, 2), (3, 3), (3, 4), (3, 5), (3, 6), (1, 2), (2, 1), (5, 2), (4, 1)],            # Baum-Zacken
        [(0, 0), (1, 1), (2, 2), (3, 3), (4, 4), (5, 5), (6, 6), (6, 0), (5, 1), (4, 2), (2, 4), (1, 5), (0, 6)],  # Kreuz
        [(3, 0), (2, 1), (4, 1), (1, 2), (5, 2), (0, 3), (6, 3), (1, 4), (5, 4), (2, 5), (4, 5), (3, 6), (3, 3)],  # Raute mit Punkt
        [(1, 0), (2, 0), (3, 0), (4, 0), (5, 0), (1, 1), (1, 2), (1, 3), (5, 1), (5, 2), (5, 3), (3, 4), (3, 5), (3, 6), (2, 4), (4, 4)],  # Becher
        [(0, 3), (1, 2), (2, 1), (3, 0), (4, 1), (5, 2), (6, 3), (1, 4), (2, 5), (3, 6), (4, 5), (5, 4), (3, 3)],  # Auge
    ]
    c = Canvas(7, 7)
    for (x, y) in shapes[kind % len(shapes)]:
        c.put_ramp(x, y, ramp, idx)
    return c


def rune_press():
    """Schraubenpresse: Holzrahmen, dicke Spindel mit Kreuzgriff, leuchtende Stempelplatte (44 x 50)"""
    W, H = 46, 52
    c = Canvas(W, H)
    # Tisch / Sockel
    round_rect(c, 3, 34, 42, 51, 'wood', lo=1, hi=4, radius=2)
    for y in (39, 45):
        for x in range(3, 43):
            c.put_ramp(x, y, 'wood', 1)
    # Druckbett mit Papier
    round_rect(c, 8, 28, 37, 35, 'stone', lo=1, hi=5, radius=1)
    c.rect(11, 29, 34, 31, 'bone', 4)
    c.rect(11, 29, 34, 29, 'bone', 5)
    # Rahmenpfosten
    for (x0, x1) in ((6, 10), (35, 39)):
        c.rect(x0, 6, x1, 36, 'wood', 3)
        c.rect(x0, 6, x0, 36, 'wood', 4)
        c.rect(x1, 6, x1, 36, 'wood', 1)
        c.rect(x0 + 1, 8, x0 + 1, 8, 'metal', 5)
    # Querbalken oben
    round_rect(c, 3, 3, 42, 11, 'wood', lo=1, hi=4, radius=2)
    c.rect(3, 3, 42, 3, 'wood', 5)
    # Spindel
    c.rect(21, 11, 24, 24, 'metal', 3)
    c.rect(21, 11, 21, 24, 'metal', 5)
    c.rect(24, 11, 24, 24, 'metal', 1)
    for y in range(12, 24, 3):
        for x in range(21, 25):
            c.put_ramp(x, y, 'metal', 1)
    # Griffkreuz (Hebel) oben
    thick_line(c, 4, 4, 41, 4, 2.4, 'metal', lo=1, hi=4)
    ellipse(c, 4, 4, 2.6, 2.6, 'gold', lo=2, hi=5)
    ellipse(c, 41, 4, 2.6, 2.6, 'gold', lo=1, hi=4)
    # Stempelplatte mit Runen-Glut
    round_rect(c, 12, 22, 33, 28, 'metal', lo=1, hi=4, radius=1)
    c.rect(14, 26, 31, 27, 'purple', 3)
    for k, x in enumerate((16, 21, 26, 29)):
        c.put_ramp(x, 26, 'purple', 5)
        c.put_ramp(x + 1, 27, 'purple', 5)
    # Glühen am Papier
    for x in range(12, 34):
        c.put_ramp(x, 30, 'purple', 4 if x % 2 else 5)
    # Kristall am Rahmen
    poly(c, [(40, 14), (43, 14), (44, 20), (42, 24), (40, 20)], 'purple', lo=2, hi=5)
    c.put_ramp(41, 16, 'purple', 5)
    c.outline()
    return c


def rune_scroll(glyph=0, sheen=True):
    """Zettel mit leuchtender Rune (12 x 14), auch als Stapel nutzbar"""
    c = Canvas(14, 16)
    round_rect(c, 1, 1, 12, 14, 'bone', lo=3, hi=5, radius=1)
    c.put_ramp(11, 14, 'bone', 2)
    g = rune_glyph(glyph, 'purple', 5)
    g2 = rune_glyph(glyph, 'purple', 3)
    c.blit(g2, 4, 4)
    c.blit(g, 3, 3)
    for (x, y) in ((2, 13), (3, 13), (9, 3)):
        pass
    c.outline()
    return c


def paper_stack(n=5):
    c = Canvas(18, 12)
    for k in range(n):
        y = 10 - k * 2
        c.rect(1, y, 16, y + 1, 'bone', 5 if k % 2 == 0 else 4)
        c.put_ramp(1, y + 1, 'bone', 3)
        c.rect(2, y + 1, 16, y + 1, 'bone', 3)
    # leuchtende Rune oben
    g = rune_glyph(2, 'purple', 5)
    c.blit(g, 5, 0)
    c.outline()
    return c


def runes_on_line():
    """Wäscheleine-artige Trockenschnur mit Zetteln, Runen glimmen (36 x 20)"""
    c = Canvas(40, 22)
    for x in range(0, 40):
        y = 2 + int(2.0 * math.sin(x / 39.0 * math.pi))
        c.put_ramp(x, y, 'bone', 3)
    for k, x in enumerate((3, 14, 25)):
        y = 3 + int(2.0 * math.sin((x + 4) / 39.0 * math.pi))
        round_rect(c, x, y, x + 9, y + 12, 'bone', lo=3, hi=5, radius=1)
        c.rect(x + 4, y - 1, x + 5, y + 1, 'wood', 3)
        g = rune_glyph(k + 1, 'purple', 5)
        c.blit(g, x + 1, y + 3)
        if k == 1:
            for (dx, dy) in ((0, 0), (1, 0), (0, 1)):
                c.put_ramp(x + 12 + dx, y + 5 + dy, 'purple', 4)
    c.outline()
    return c


def crystal_cluster(col='purple', big=True):
    """Kristallgruppe (16 x 24), leuchtend"""
    c = Canvas(18, 26)
    def prism(cx, base, hgt, wid, hi):
        pts = [(cx - wid, base), (cx - wid, base - hgt + 4), (cx, base - hgt), (cx + wid, base - hgt + 4), (cx + wid, base)]
        poly(c, pts, col, lo=1, hi=hi)
        c.rect(cx - 1, base - hgt + 5, cx - 1, base - 3, col, 5)
    prism(11, 25, 14, 3, 4)
    prism(5, 25, 22, 4, 5)
    prism(14, 25, 10, 3, 4)
    c.outline()
    return c


def ink_pot():
    c = Canvas(10, 12)
    round_rect(c, 1, 4, 8, 10, 'purple', lo=0, hi=3, radius=2)
    c.rect(2, 3, 7, 4, 'bone', 4)
    c.line(6, 3, 9, 0, 'bone', 5)
    c.put_ramp(9, 0, 'bone', 4)
    c.outline()
    return c


def stone_tablet_decor():
    """Wandtafel mit eingemeißelten leuchtenden Runen (24 x 20)"""
    c = Canvas(26, 22)
    round_rect(c, 1, 1, 24, 20, 'stone', lo=1, hi=4, radius=2)
    c.rect(3, 3, 22, 18, 'coal', 2)
    for k, x in enumerate((5, 11, 17)):
        c.blit(rune_glyph(k + 3, 'purple', 5), x, 5)
        c.blit(rune_glyph(k, 'purple', 4), x, 12)
    c.outline()
    return c
