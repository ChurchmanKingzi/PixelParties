"""Handgezeichnete Teile für Sleeve 02: Mary (neu posiert), Feuerflügel, Cute Phoenix."""
from lib import *

OUT_C = (112, 32, 14, 255)
FIRE = [(186, 56, 20), (228, 104, 28), (246, 150, 40), (255, 196, 70), (255, 234, 140), (255, 250, 214)]


def bez(p0, p1, p2, t):
    return ((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
            (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1])


def feather_poly(base, ang, length, width, tipw=0.35):
    bx, by = base
    ca, sa = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    nx, ny = -sa, ca
    pts = []
    for (f, w_) in [(0, 0.5), (0.45, 0.62), (0.8, 0.5), (0.95, tipw * 0.6)]:
        pts.append((bx + ca * length * f + nx * width * w_, by + sa * length * f + ny * width * w_))
    tip = (bx + ca * length, by + sa * length)
    back = [(bx + ca * length * f - nx * width * w_, by + sa * length * f - ny * width * w_) for (f, w_) in [(0.95, tipw * 0.6), (0.8, 0.5), (0.45, 0.62), (0, 0.5)]]
    return pts + [tip] + back


def wings(Wd=250, Hd=190, cx=125, sy=120):
    """Beide Flügel als RGBA (Wd x Hd). Schulter bei (cx±9, sy)."""
    layers = []
    idx = Image.new('L', (Wd, Hd), 0)   # Farbindex 1..6, 7 = Umriss
    d = ImageDraw.Draw(idx)
    for sg in (-1, 1):
        S = (cx + sg * 8, sy)
        C = (cx + sg * 60, sy - 124)
        T = (cx + sg * 108, sy - 78)
        rows = [  # (Anzahl, Länge-Faktor, Breite, Grundton, Winkel-Offset)
            (14, 1.0, 13, 2, 0),
            (12, 0.64, 12, 3, -6),
            (10, 0.36, 11, 4, -12),
        ]
        for (N, lf, wdt, tone, aoff) in rows:
            for i in reversed(range(N)):
                u = i / (N - 1)
                t = 0.08 + 0.92 * u if tone == 1 else 0.05 + 0.8 * u
                P = bez(S, C, T, t)
                # Richtung: innen nach unten, außen nach außen-unten
                a_out = 100 - 70 * u + aoff
                ang = a_out if sg > 0 else 180 - a_out
                L = (34 + 44 * math.sin(math.pi * min(1.0, 0.25 + u * 0.8))) * lf
                if tone == 1:
                    L += 6 * u
                poly = feather_poly(P, ang, L, wdt)
                d.polygon(poly, fill=tone, outline=7)
                # Lichtkante entlang Federmitte
                ca, sa = math.cos(math.radians(ang)), math.sin(math.radians(ang))
                q0 = (P[0] + ca * L * 0.1, P[1] + sa * L * 0.1)
                q1 = (P[0] + ca * L * 0.78, P[1] + sa * L * 0.78)
                d.line([q0, q1], fill=tone + 2)
                q2 = (P[0] + ca * L * 0.15 - sa * 2, P[1] + sa * L * 0.15 + ca * 2 * (1 if sg > 0 else -1))
                d.line([q0, (q1[0] * 0.6 + q0[0] * 0.4, q1[1] * 0.6 + q0[1] * 0.4)], fill=min(6, tone + 3))
        # Oberkante/Flügelbug
        pts = [bez(S, C, T, t / 30) for t in range(31)]
        d.line(pts, fill=7, width=6)
        d.line(pts, fill=5, width=4)
        d.line([(x, y - 1) for x, y in pts], fill=6, width=1)
    a = np.array(idx)
    rgba = np.zeros(a.shape + (4,), np.uint8)
    for i, c in enumerate(FIRE):
        rgba[a == i + 1] = c + (255,)
    rgba[a == 7] = OUT_C
    # rote Federspitzen: Tonstufe 2 am Ende dunkler

    im = Image.fromarray(rgba)
    return outline(im, OUT_C)


SKIN = [(255, 232, 206, 255), (246, 200, 170, 255), (214, 150, 128, 255)]
HAIR = [(255, 244, 176, 255), (255, 222, 100, 255), (244, 186, 56, 255), (206, 132, 36, 255), (130, 70, 20, 255)]
DRESS = [(255, 255, 255, 255), (232, 238, 255, 255), (196, 212, 250, 255), (150, 170, 232, 255), (84, 88, 150, 255)]
GOLD = [(255, 240, 150, 255), (250, 200, 60, 255), (190, 120, 30, 255)]
BLUE = [(170, 230, 255, 255), (90, 170, 245, 255), (40, 100, 200, 255)]


def mary():
    MW, MH = 84, 150
    im = Image.new('RGBA', (MW, MH), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx = MW // 2
    # --- Haare hinten (lang, wehend)
    d.polygon([(cx - 15, 20), (cx - 22, 50), (cx - 26, 78), (cx - 18, 72), (cx - 20, 88), (cx - 10, 70), (cx, 40),
               (cx + 10, 70), (cx + 20, 88), (cx + 18, 72), (cx + 26, 78), (cx + 22, 50), (cx + 15, 20)], fill=HAIR[3], outline=HAIR[4])
    d.polygon([(cx - 13, 24), (cx - 18, 52), (cx - 20, 70), (cx - 12, 60), (cx - 8, 40)], fill=HAIR[2])
    d.polygon([(cx + 13, 24), (cx + 18, 52), (cx + 20, 70), (cx + 12, 60), (cx + 8, 40)], fill=HAIR[2])
    # --- Kleid (Glocke)
    hem_y = 144
    left = [(cx - 10, 60), (cx - 13, 74), (cx - 18, 90), (cx - 25, 108), (cx - 31, 124), (cx - 36, 136), (cx - 38, hem_y)]
    hem = [(cx - 38 + i * 4, hem_y + (1 if (i // 2) % 2 else -1)) for i in range(20)]
    right = [(cx + 38, hem_y), (cx + 36, 136), (cx + 31, 124), (cx + 25, 108), (cx + 18, 90), (cx + 13, 74), (cx + 10, 60)]
    dress = left + hem + right
    d.polygon(dress, fill=DRESS[1], outline=DRESS[4])
    # Licht links, Schatten rechts (gedithert)
    lay = Image.new('L', (MW, MH), 0); ld_ = ImageDraw.Draw(lay); ld_.polygon(dress, fill=255)
    dm = np.array(lay) > 0
    yy_, xx_ = np.mgrid[0:MH, 0:MW]
    rel = (xx_ - cx) / np.maximum(1, 10 + (yy_ - 60) * 0.34)
    a_ = np.array(im)
    a_[dm & (rel < -0.55) & (BAYER4[yy_ % 4, xx_ % 4] < 0.6)] = DRESS[0]
    a_[dm & (rel > 0.35) & (BAYER4[yy_ % 4, xx_ % 4] < 0.5)] = DRESS[2]
    a_[dm & (rel > 0.7)] = DRESS[2]
    a_[dm & (rel > 0.7) & (BAYER4[yy_ % 4, xx_ % 4] < 0.4)] = DRESS[3]
    im = Image.fromarray(a_); d = ImageDraw.Draw(im)
    # Falten
    for fx, top in [(-24, 100), (-12, 86), (2, 90), (14, 92), (27, 110)]:
        d.line((cx + fx * 0.6, top, cx + fx, hem_y - 2), fill=DRESS[2])
        d.line((cx + fx * 0.6 + 1, top + 4, cx + fx + 1, hem_y - 2), fill=DRESS[0])
    # Saum mit Goldborte
    d.line([(x, y - 3) for x, y in hem], fill=GOLD[1])
    d.line([(x, y - 2) for x, y in hem], fill=GOLD[2])
    for x, y in hem[1::2]:
        d.point((x, y - 5), fill=GOLD[0])
    # Blaues Kreuz-Ornament (wie auf der Karte)
    d.rectangle((cx - 2, 70, cx + 1, 128), fill=BLUE[1])
    d.line((cx - 2, 70, cx - 2, 128), fill=BLUE[0])
    d.rectangle((cx - 10, 112, cx + 9, 115), fill=BLUE[1])
    d.line((cx - 10, 112, cx + 9, 112), fill=BLUE[0])
    d.polygon([(cx - 12, 126), (cx, 118), (cx + 11, 126), (cx + 7, 128), (cx, 123), (cx - 8, 128)], fill=BLUE[2])
    # --- Oberkörper / Mieder
    d.polygon([(cx - 10, 44), (cx + 9, 44), (cx + 10, 62), (cx - 11, 62)], fill=DRESS[0], outline=DRESS[4])
    d.line((cx - 10, 60, cx + 9, 60), fill=GOLD[1]); d.line((cx - 10, 61, cx + 9, 61), fill=GOLD[2])
    d.ellipse((cx - 2, 50, cx + 1, 53), fill=BLUE[1], outline=BLUE[2])
    # --- Kopf
    d.ellipse((cx - 13, 12, cx + 12, 40), fill=SKIN[0], outline=SKIN[2])
    d.rectangle((cx - 3, 38, cx + 2, 44), fill=SKIN[1])
    # Wangenschatten
    d.arc((cx - 13, 12, cx + 12, 40), 20, 160, fill=SKIN[1])
    # Augen geschlossen, fröhlich (^ ^)
    for ex in (cx - 7, cx + 5):
        d.line((ex - 2, 29, ex, 27), fill=(96, 50, 40, 255)); d.line((ex, 27, ex + 2, 29), fill=(96, 50, 40, 255))
        d.point((ex - 3, 30), fill=(96, 50, 40, 255))
    # Wimpernschlag / Rouge
    d.rectangle((cx - 11, 31, cx - 8, 32), fill=(255, 160, 170, 255))
    d.rectangle((cx + 7, 31, cx + 10, 32), fill=(255, 160, 170, 255))
    # Mund
    d.line((cx - 2, 35, cx - 1, 36), fill=(200, 90, 90, 255)); d.line((cx - 1, 36, cx + 1, 36), fill=(200, 90, 90, 255)); d.point((cx + 2, 35), fill=(200, 90, 90, 255))
    # --- Pony + Seitensträhnen
    d.polygon([(cx - 15, 22), (cx - 14, 12), (cx - 6, 6), (cx + 6, 6), (cx + 14, 12), (cx + 14, 22), (cx + 10, 18), (cx + 8, 25), (cx + 4, 18),
               (cx + 1, 24), (cx - 2, 17), (cx - 6, 25), (cx - 8, 18), (cx - 12, 24)], fill=HAIR[1], outline=HAIR[4])
    d.line((cx - 9, 10, cx + 4, 8), fill=HAIR[0]); d.line((cx - 11, 13, cx - 6, 11), fill=HAIR[0])
    for sg in (-1, 1):
        d.polygon([(cx + sg * 13, 16), (cx + sg * 16, 30), (cx + sg * 15, 46), (cx + sg * 12, 54), (cx + sg * 11, 40), (cx + sg * 12, 24)], fill=HAIR[1], outline=HAIR[4])
        d.line((cx + sg * 14, 24, cx + sg * 14, 42), fill=HAIR[0])
    # --- Krone
    d.polygon([(cx - 8, 7), (cx - 8, 0), (cx - 4, 4), (cx, -2 + 2), (cx + 4, 4), (cx + 8, 0), (cx + 8, 7)], fill=GOLD[1], outline=GOLD[2])
    d.line((cx - 7, 6, cx + 7, 6), fill=GOLD[0])
    d.point([(cx - 8, 0), (cx + 8, 0), (cx, 0)], fill=GOLD[0])
    d.rectangle((cx - 1, 3, cx, 4), fill=(255, 90, 140, 255))
    # --- Arme (Puffärmel, Hände vor dem Bauch zusammen)
    for sg in (-1, 1):
        d.ellipse((cx + sg * 13 - 5, 42, cx + sg * 13 + 5, 52), fill=DRESS[0], outline=DRESS[4])
        d.polygon([(cx + sg * 11, 50), (cx + sg * 17, 52), (cx + sg * 19, 70), (cx + sg * 18, 84), (cx + sg * 13, 86), (cx + sg * 14, 68)], fill=SKIN[0], outline=SKIN[2])
    im = outline(im, (70, 30, 50, 255))
    return im


def hands(d, cx, y):
    for sg in (-1, 1):
        d.ellipse((cx + sg * 13 - 4, y - 3, cx + sg * 13 + 4, y + 3), fill=SKIN[0], outline=SKIN[2])
        d.line((cx + sg * 13 - 2, y - 1, cx + sg * 13 + 1, y - 1), fill=SKIN[1])


def phoenix():
    PW, PH = 46, 46
    im = Image.new('RGBA', (PW, PH), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    R_, O_, Y_, L_, W_ = (206, 30, 44, 255), (238, 84, 40, 255), (255, 196, 60, 255), (255, 240, 150, 255), (255, 255, 236, 255)
    OL = (120, 20, 20, 255)
    # Schwanzflammen (nach unten geschwungen)
    for i, (dx, col) in enumerate([(-10, R_), (0, O_), (10, R_)]):
        d.polygon([(23 + dx * 0.3, 30), (23 + dx - 3, 40), (23 + dx * 1.3, 46), (23 + dx + 3, 40)], fill=col, outline=OL)
    d.polygon([(19, 30), (23, 45), (27, 30)], fill=Y_)
    # Flügel (flammenförmig, erhoben)
    for sg in (-1, 1):
        base = 23 + sg * 8
        d.polygon([(base, 24), (base + sg * 12, 8), (base + sg * 10, 16), (base + sg * 17, 12), (base + sg * 12, 22), (base + sg * 16, 24), (base + sg * 6, 30)], fill=O_, outline=OL)
        d.polygon([(base + sg * 1, 24), (base + sg * 9, 14), (base + sg * 8, 22), (base + sg * 4, 27)], fill=Y_)
    # Körper
    d.ellipse((12, 14, 34, 36), fill=O_, outline=OL)
    d.ellipse((16, 22, 30, 36), fill=Y_)
    d.ellipse((18, 26, 28, 35), fill=L_)
    # Kopffedern (Flammenkrone)
    d.polygon([(17, 16), (15, 4), (20, 12), (23, 0), (26, 12), (31, 4), (29, 16)], fill=R_, outline=OL)
    d.polygon([(19, 15), (20, 9), (23, 5), (26, 9), (27, 15)], fill=Y_)
    # Augen groß & niedlich
    for ex in (18, 26):
        d.ellipse((ex - 2, 17, ex + 2, 22), fill=(40, 16, 20, 255))
        d.point((ex - 1, 18), fill=W_); d.point((ex + 1, 21), fill=(120, 80, 90, 255))
    # Schnabel
    d.polygon([(21, 23), (25, 23), (23, 26)], fill=(255, 220, 90, 255), outline=(170, 90, 20, 255))
    # Bäckchen
    d.point([(15, 24), (16, 24), (30, 24), (31, 24)], fill=(255, 120, 150, 255))
    return outline(im, (90, 14, 20, 255))
