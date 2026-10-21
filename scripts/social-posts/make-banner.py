#!/usr/bin/env python3
"""YouTube-Kanalbanner (2048×1152, höchstens 6 MB) im Stil des Titelbilds (public/title.png): warmer Grund, Sprengstern in der Mitte,
zwei Heldentrupps, die aufeinander losgehen.

    python3 scripts/social-posts/make-banner.py

Ergebnis in scripts/social-posts/out/branding/: banner-youtube.png und banner-youtube-sicherer-bereich.png (Kontrollbild, nicht hochladen).

YouTube zeigt je nach Gerät unterschiedliche Ausschnitte; auf dem Handy bleibt nur die Mitte (1235 × 338 px, x 406…1641, y 407…745)
sichtbar. Dort steht nur der Schriftzug (Logo-Pixel = 4 px); der Rest ist Zugabe für Tablet, Desktop und Fernseher.
"""
import importlib.util
import math
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
OUT = HERE / 'out' / 'branding'
spec = importlib.util.spec_from_file_location('ml', HERE / 'make-logo.py')
ml = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ml)
bp, fx = ml.bp, ml.fx
import ornaments as orn  # noqa: E402  (liegt neben diesem Skript)

W, H = 2048, 1152
SAFE = (406, 407, 1641, 745)                       # sicherer Bereich für alle Geräte
CELL = 4                                           # Raster des Banners (= ein Logo-Pixel)
CREAM, CREAM2, CREAM3 = (255, 224, 184), (255, 232, 198), (255, 241, 214)       # Farben aus title.png
RED, RED_DK, GOLD, GOLD_LT = (226, 84, 84), (176, 52, 70), (255, 222, 130), (255, 243, 176)

# Je Seite drei Heroes: ein Flieger oben, ein Großer am Boden in der Mitte, ein normaler vorn. Die Großen sind groß gezeichnet (12 px je
# Sprite-Pixel), die anderen kleiner; Quetzahuitl ist als Sprite so riesig, dass er nur mit 4 px je Sprite-Pixel auf das Banner passt.
# (Sprite, Maßstab, x, y, gespiegelt?, Bezug: 'c' = y ist die Mitte des Umrisses, 'f' = y ist die Fußlinie auf dem Boden)
# „gespiegelt“ gleicht die Blickrichtung des Sheets aus (links soll alles nach rechts blicken, rechts nach links).
HORIZON = 905                                       # Fußlinie der hinteren Reihe (Boden beginnt knapp darüber)
# 'f': y = Fußlinie (kann unter dem Bildrand liegen, dann ist der Fuß abgeschnitten); 'c': y = Mitte des Umrisses;
# 'h': Kopf (x, y) des Sprites steht auf dem Punkt (x, y); dabei dürfen Flügel und Körper aus dem Bild ragen (ohne Rahmen-Beschnitt)
ACTORS = [
    ('quetzahuitl-receiver-of-sacrifices', 10, 1240, 260, True, 'h'),
    ('monia', 10, 770, 195, False, 'c'),
    ('brackle-the-catapulting-turtle', 8, 700, 1075, True, 'f'),
    ('future-tech-gunslinger-riffel', 8, 1310, 1075, False, 'f'),
    ('bakhm-the-desert-digger', 14, 100, 1135, True, 'f'),
    ('chaos-diamond-the-cracked-keeper', 14, 1860, 1075, False, 'f'),
]
UNDER = {'quetzahuitl-receiver-of-sacrifices'}                                # hinter allem anderen
FRONT = {'chaos-diamond-the-cracked-keeper'}                                # vor dem Schriftband (Bakhms Kiefer verschwindet knapp dahinter)
QUETZ_TURN = 38                                     # Grad im Uhrzeigersinn: das Gesicht zeigt dadurch mehr nach links zu Monia
QUETZ_HEAD = (55, 85)                               # Kopf im gespiegelten Frame (Sprite-Pixel), Drehpunkt und Ankerpunkt
ACC = (240, 190, 72)                                # Gold des Rahmens


def sticker(slug, px, frame=0, flip=False):
    """Sprite mit Sticker-Umriss (innen hell, außen dunkel) als RGBA-Bild."""
    spr = bp.Sprite(slug)
    spr.px = px
    od, ol, sp, pad = spr.layers(frame, ml.WHITE, ml.INK)
    im = Image.new('RGBA', sp.size, (0, 0, 0, 0))
    for layer in (od, ol, sp):
        im.alpha_composite(layer)
    if flip:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    return im


def sticker_turned(slug, px, turn_cw, head, flip=True):
    """Wie sticker(), aber der Frame wird vorher im Sprite-Raster (NEAREST) gespiegelt und um `turn_cw` Grad im Uhrzeigersinn
    gedreht, damit die Pixel gleich groß bleiben. Gibt außerdem die Lage des Kopf-Punkts `head` (Sprite-Pixel des gespiegelten Frames)
    im fertigen Bild zurück."""
    spr = bp.Sprite(slug)
    fr = spr.sheet.crop((0, 0, spr.fw, spr.fh))
    if flip:
        fr = fr.transpose(Image.FLIP_LEFT_RIGHT)
    rot = fr.rotate(-turn_cw, resample=Image.NEAREST, expand=True)
    th = math.radians(turn_cw)
    dx, dy = head[0] - fr.width / 2, head[1] - fr.height / 2
    hx, hy = rot.width / 2 + dx * math.cos(th) - dy * math.sin(th), rot.height / 2 + dx * math.sin(th) + dy * math.cos(th)
    spr.sheet, spr.fw, spr.fh, spr.n, spr.px = rot, rot.width, rot.height, 1, px
    od, ol, sp, pad = spr.layers(0, ml.WHITE, ml.INK)
    im = Image.new('RGBA', sp.size, (0, 0, 0, 0))
    for layer in (od, ol, sp):
        im.alpha_composite(layer)
    return im, (pad + hx * px, pad + hy * px)


LEFT_RAMP = [(250, 238, 224), (232, 224, 246), (208, 200, 240), (178, 168, 230), (146, 134, 216)]        # kühl: die Helden
RIGHT_RAMP = [(255, 240, 214), (255, 222, 184), (255, 196, 160), (244, 156, 132), (222, 112, 112)]         # warm: die Gegner


def background():
    """Zweigeteilter Grund wie im Titelbild (links kühl, rechts warm): Strahlen vom Sprengstern, Halbtonpunkte, Tempolinien, Dithering."""
    cw, ch = W // CELL, H // CELL
    ys, xs = np.mgrid[0:ch, 0:cw]
    dx, dy = (xs - cw / 2 + 0.5) / (cw * 0.5), (ys - ch / 2 + 0.5) / (ch * 0.5)
    dist = np.hypot(dx, dy)
    ang = np.arctan2(dy, dx)
    # Trennlinie: gezackt durch die Mitte (Blitz), je Zeile leicht versetzt
    zig = (np.sin(ys * 0.21) * 7 + np.sin(ys * 0.07 + 1.3) * 12 + 22 * np.clip(1 - ys / 90, 0, 1)).astype(int)   # oben ein Stück nach rechts: Monia steht klar links
    left = xs < cw / 2 + zig
    rays = (np.sin(ang * 11 + 0.4) > 0.15).astype(float)
    t = np.clip(dist * 1.15 - 0.15, 0, 1) * 0.78 + rays * 0.22 * (dist > 0.3)
    th = np.tile(bp.BAYER4, (ch // 4 + 1, cw // 4 + 1))[:ch, :cw]
    n = len(LEFT_RAMP) - 1
    q = np.clip(np.floor(np.clip(t, 0, 1) * n + th - 0.15), 0, n).astype(int)
    lo = np.where(left[..., None], np.array(LEFT_RAMP, dtype=np.uint8)[q], np.array(RIGHT_RAMP, dtype=np.uint8)[q])
    # Halbtonpunkte (wie im Comic): Raster 10 Zellen, Radius wächst nach außen, eine Stufe dunkler als der Grund
    sp = 10
    gx, gy = xs % sp - sp / 2 + 0.5, ys % sp - sp / 2 + 0.5
    rad = np.clip((dist - 0.42) * 7.0, 0, 3.6)
    dots = (np.hypot(gx, gy) < rad) & (dist > 0.42)
    q2 = np.clip(q + 1, 0, n)
    lo = np.where(dots[..., None], np.where(left[..., None], np.array(LEFT_RAMP, dtype=np.uint8)[q2], np.array(RIGHT_RAMP, dtype=np.uint8)[q2]), lo)
    im = Image.fromarray(lo, 'RGB')
    d = ImageDraw.Draw(im)
    rnd = random.Random(11)
    for _ in range(46):                                           # Tempolinien: helle, lange Striche, strahlenförmig von der Mitte
        a = rnd.uniform(0, 2 * math.pi)
        r0, r1 = rnd.uniform(0.55, 0.8), rnd.uniform(0.9, 1.3)
        x0, y0 = cw / 2 + math.cos(a) * r0 * cw * 0.5, ch / 2 + math.sin(a) * r0 * ch * 0.5
        x1, y1 = cw / 2 + math.cos(a) * r1 * cw * 0.5, ch / 2 + math.sin(a) * r1 * ch * 0.5
        d.line([(x0, y0), (x1, y1)], fill=(255, 250, 238), width=rnd.choice((1, 1, 2)))
    for _ in range(40):                                           # Funken und Konfetti in den Farben der beiden Seiten
        x, y = rnd.randrange(cw), rnd.randrange(ch)
        col = (255, 255, 255) if rnd.random() < 0.5 else ((120, 110, 220) if x < cw / 2 else (230, 90, 90))
        d.rectangle([x, y, x + rnd.choice((0, 1, 1, 2)), y + rnd.choice((0, 1, 1, 2))], fill=col)
    return im.resize((W, H), Image.NEAREST).convert('RGBA')


def frame_layers():
    """Rahmen mit Schnörkeln im 8-px-Raster (Ornament-Bausteine der Karten): Rille mit Perlen, Eckblöcke mit Edelstein, Mittelstücke,
    Eck-Voluten und Kronen oben und unten. Die Heroes liegen davor und ragen aus dem Rahmen heraus."""
    S = 8
    cw, ch = W // S, H // S
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    light, deep = orn.mix(ACC, orn.WHITE, 0.5), orn.mix(ACC, orn.INK, 0.72)
    d.rectangle([0, 0, W - 1, H - 1], outline=orn.INK, width=S)
    d.rectangle([S, S, W - 1 - S, H - 1 - S], outline=ACC, width=S)
    d.rectangle([2 * S, 2 * S, W - 1 - 2 * S, H - 1 - 2 * S], outline=deep, width=S)
    d.rectangle([3 * S, 3 * S, W - 1 - 3 * S, H - 1 - 3 * S], outline=orn.INK, width=S)
    for i in range(6, cw - 6, 3):                                   # Perlenreihe in der Rille
        for y in (2, ch - 3):
            d.rectangle([i * S, y * S, i * S + S - 1, y * S + S - 1], fill=light)
    for j in range(6, ch - 6, 3):
        for x in (2, cw - 3):
            d.rectangle([x * S, j * S, x * S + S - 1, j * S + S - 1], fill=light)

    def stamp(cells, gem, ox, oy):
        im, (x0, y0) = orn.render(cells, ACC, gem, scale=S)
        layer.paste(im, ((ox + x0) * S, (oy + y0) * S), im)

    block = {(x, y) for x in range(10) for y in range(10) if not (x + y < 3)}
    gem = orn.gem_cells(5, 5, 3)
    for fx, fy in ((0, 0), (1, 0), (0, 1), (1, 1)):                  # Eckblöcke
        cells = {((9 - x) if fx else x, (9 - y) if fy else y) for (x, y) in block}
        g = {((9 - x) if fx else x, (9 - y) if fy else y) for (x, y) in gem}
        stamp(cells, g, cw - 10 if fx else 0, ch - 10 if fy else 0)
    lozenge = {(x, y) for x in range(21) for y in range(5) if abs(x - 10) <= 10 - (1 if y in (0, 4) else 0) * 3}
    for (ox, oy, trans) in ((cw // 2 - 10, 0, False), (cw // 2 - 10, ch - 5, False), (0, ch // 2 - 10, True), (cw - 5, ch // 2 - 10, True)):
        cells = {(y, x) for (x, y) in lozenge} if trans else set(lozenge)
        stamp(cells, orn.gem_cells(2, 10, 1) if trans else orn.gem_cells(10, 2, 1), ox, oy)
    corner = orn.corner_cells()                                      # Voluten innen an den Ecken (nach innen gespiegelt)
    for fx, fy, ox, oy in ((-1, -1, 12, 12), (1, -1, cw - 13, 12), (-1, 1, 12, ch - 13), (1, 1, cw - 13, ch - 13)):
        stamp({(fx * x, fy * y) for (x, y) in corner}, {(fx * x, fy * y) for (x, y) in orn.gem_cells(-1, -1, 2)}, ox, oy)
    return layer


def ribbon_ornaments(cv):
    """Zierleisten über und unter dem Schriftzug (liegen im sicheren Bereich, also auch auf dem Handy zu sehen)."""
    S = 8
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))

    def stamp(cells, gem, ox, oy):
        im, (x0, y0) = orn.render(cells, ACC, gem, scale=S)
        layer.paste(im, ((ox + x0) * S, (oy + y0) * S), im)

    cx = W // S // 2
    top_y, bot_y = 407 // S + 1, 745 // S - 3
    crest = orn.crest_cells()
    stamp({(x, -y) for (x, y) in crest}, {(x, -y) for (x, y) in orn.gem_cells(0, 4, 3) | orn.gem_cells(-1, 4, 3)}, cx, top_y + 4)
    stamp(crest, orn.gem_cells(0, 4, 3) | orn.gem_cells(-1, 4, 3), cx, bot_y - 4)
    for sgn in (1, -1):
        for y in (top_y, bot_y):
            cells, gem = orn.divider(30, ACC, sgn, 2, 2)
            stamp(cells, gem, cx + sgn * 14, y)
    cv.alpha_composite(layer)


GROUND_L = [(156, 144, 226), (134, 122, 210), (110, 100, 190)]            # Boden links: kühl
GROUND_R = [(240, 134, 124), (218, 108, 106), (190, 86, 96)]               # Boden rechts: warm


def ground():
    """Kampfboden ab dem Horizont: Dithering nach unten dunkler, Fluchtlinien auf die Mitte zu, helle Kante am Horizont."""
    cw, ch = W // CELL, H // CELL
    y0 = HORIZON // CELL - 12
    ys, xs = np.mgrid[0:ch, 0:cw]
    zig = (np.sin(ys * 0.21) * 7 + np.sin(ys * 0.07 + 1.3) * 12).astype(int)
    left = xs < cw / 2 + zig
    t = np.clip((ys - y0) / (ch - y0), 0, 1)
    th = np.tile(bp.BAYER4, (ch // 4 + 1, cw // 4 + 1))[:ch, :cw]
    q = np.clip(np.floor(t * 2 + th - 0.1), 0, 2).astype(int)
    lo = np.where(left[..., None], np.array(GROUND_L, dtype=np.uint8)[q], np.array(GROUND_R, dtype=np.uint8)[q])
    im = Image.fromarray(lo, 'RGB')
    d = ImageDraw.Draw(im)
    vx, vy = cw / 2, ch * 0.32
    for k in range(-14, 15):                                            # Fluchtlinien (Fugen der Bodenplatten)
        bx = cw / 2 + k * cw * 0.11
        x0 = vx + (bx - vx) * (y0 - vy) / (ch - vy)
        col = (255, 246, 232) if (k % 2 == 0) else (200, 190, 230)
        d.line([(x0, y0), (bx, ch)], fill=col if abs(k) > 1 else col, width=1)
    for r in range(1, 6):                                               # Querfugen, nach unten weiter auseinander
        y = y0 + int((ch - y0) * (r / 5.5) ** 1.7)
        d.line([(0, y), (cw, y)], fill=(255, 246, 232), width=1)
    d.line([(0, y0), (cw, y0)], fill=(255, 250, 240), width=2)
    d.line([(0, y0 + 2), (cw, y0 + 2)], fill=(60, 40, 90), width=1)
    mask = Image.new('L', (cw, ch), 0)
    ImageDraw.Draw(mask).rectangle([0, y0, cw, ch], fill=255)
    out = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
    out.paste(im.convert('RGBA'), (0, 0), mask)
    return out.resize((W, H), Image.NEAREST)


def shadow(cv, cx, foot, w):
    sh = Image.new('RGBA', (int(w), 44), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse([0, 0, sh.width - 1, sh.height - 1], fill=(30, 18, 50, 120))
    cv.alpha_composite(sh, (int(cx - sh.width / 2), int(foot - 26)))


def lowres(draw_fn):
    """Zeichnet auf einem Viertel-Raster und vergrößert auf das 4-px-Raster des Banners."""
    lo = Image.new('RGBA', (W // CELL, H // CELL), (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(lo))
    return lo.resize((W, H), Image.NEAREST)


def burst(cx, cy, rx, ry, seed=4, spikes=22):
    """Sprengstern wie im Titelbild: roter Rand, goldene Füllung, hellere Mitte."""
    rnd = random.Random(seed)
    base = []
    for i in range(spikes * 2):
        a = i / (spikes * 2) * 2 * math.pi + 0.1
        r = (rnd.uniform(0.85, 1.12) if i % 2 == 0 else 0.62 * rnd.uniform(0.9, 1.05))
        base.append(((cx + math.cos(a) * rx * r) / CELL, (cy + math.sin(a) * ry * r) / CELL))

    def draw(d):
        for k, col in ((1.0, RED), (0.9, GOLD), (0.55, GOLD_LT)):
            d.polygon([(cx / CELL + (x - cx / CELL) * k, cy / CELL + (y - cy / CELL) * k) for x, y in base], fill=col)
    return lowres(draw)


def beam(src, dst, w0, colors):
    """Strahl von src nach dst (Breite w0 an der Quelle, spitz zulaufend), je Farbe ein engerer Kern."""
    (x0, y0), (x1, y1) = [(a / CELL, b / CELL) for a, b in (src, dst)]
    ang = math.atan2(y1 - y0, x1 - x0)
    nx, ny = -math.sin(ang), math.cos(ang)

    def draw(d):
        for k, col in enumerate(colors):
            w = w0 / CELL * (1.0 - k * 0.3)
            d.polygon([(x0 + nx * w, y0 + ny * w), (x0 - nx * w, y0 - ny * w), (x1 + nx * w * 0.25, y1 + ny * w * 0.25),
                       (x1 - nx * w * 0.25, y1 - ny * w * 0.25)], fill=col)
    return lowres(draw)


def jagged(p0, p1, seg=60, amp=34, seed=1):
    rnd = random.Random(seed)
    (x0, y0), (x1, y1) = p0, p1
    n = max(2, int(math.hypot(x1 - x0, y1 - y0) / seg))
    nx, ny = -(y1 - y0), (x1 - x0)
    ln = math.hypot(nx, ny) or 1
    pts = [p0]
    for i in range(1, n):
        t = i / n
        o = rnd.uniform(-amp, amp)
        pts.append((x0 + (x1 - x0) * t + nx / ln * o, y0 + (y1 - y0) * t + ny / ln * o))
    return pts + [p1]


def bolt(p0, p1, seed=1, amp=34, branch=True):
    """Roter Lichtblitz (wie der Blitz von Chaos-Diamond im Spiel): dunkler Rand, rote Mitte, helle Seele, optional mit Ast."""
    pts = jagged(p0, p1, 44, amp * 1.1, seed)
    lines = [pts]
    if branch and len(pts) > 3:
        k = len(pts) // 2
        lines.append([pts[k]] + jagged(pts[k], (pts[k][0] + (p1[0] - p0[0]) * 0.25 + 40, pts[k][1] + (p1[1] - p0[1]) * 0.25 - 60), 50, 20, seed + 5)[1:])

    def draw(d):
        for col, w in (((90, 8, 30), 8), ((226, 36, 60), 5), ((255, 215, 222), 2)):
            for ln in lines:
                d.line([(x / CELL, y / CELL) for x, y in ln], fill=col, width=w)
    return lowres(draw)


def star(cx, cy, r, seed=3, spikes=9, cols=((60, 20, 40), (255, 120, 50), (255, 224, 120), (255, 252, 230))):
    """Einschlagstern (Treffer, Mündungsfeuer, Explosion): Rand, Orange, Gelb, weißer Kern."""
    rnd = random.Random(seed)
    base = []
    for i in range(spikes * 2):
        a = i / (spikes * 2) * 2 * math.pi + rnd.uniform(-0.1, 0.1)
        base.append((math.cos(a) * (1.0 if i % 2 == 0 else 0.46) * rnd.uniform(0.8, 1.15), math.sin(a) * (1.0 if i % 2 == 0 else 0.46) * rnd.uniform(0.85, 1.1)))

    def draw(d):
        for k, col in zip((1.12, 1.0, 0.66, 0.3), cols):
            d.polygon([((cx + x * r * k) / CELL, (cy + y * r * k) / CELL) for x, y in base], fill=col)
    return lowres(draw)


def brackle_fx(px=8, flip=True):
    """Brackles eigenes Geschoss (Totenschädel-Bombe mit brennender Lunte, Frame 21) und die Flammen seines Einschlags (Frame 27),
    direkt aus dem Sprite-Sheet geschnitten (data/hero-animations/brackle-the-catapulting-turtle.png)."""
    sheet = Image.open(ml.ROOT / 'data' / 'hero-animations' / 'brackle-the-catapulting-turtle.png').convert('RGBA')
    fw = 82

    def part(frame, box):
        im = sheet.crop((frame * fw + box[0], box[1], frame * fw + box[2], box[3]))
        bb = im.getbbox()
        im = im.crop(bb).resize(((bb[2] - bb[0]) * px, (bb[3] - bb[1]) * px), Image.NEAREST)
        return im.transpose(Image.FLIP_LEFT_RIGHT) if flip else im
    return part(21, (0, 15, 48, 32)), part(27, (0, 36, 30, 62))


def trail(src, dst, w0, colors):
    return beam(src, dst, w0, colors)


def glints(cv, spots):
    for (x, y, fr, z) in spots:
        st, an = ml.stamp_layer(fx.glyph_stamp('starglint', fr), fx.PAL['glint'], CELL * 2, z)
        ml.put(cv, st, x, y, an)


def banner():
    cv = background()
    cv.alpha_composite(burst(W // 2, H // 2 - 40, 560, 400))
    cv.alpha_composite(ground())
    for k, (a, b) in enumerate((((1185, 985), (1105, 835)), ((1150, 990), (1085, 850)))):        # Riffels Schüsse nach links
        cv.alpha_composite(beam(a, b, 10 + 3 * k, [(205, 150, 40), (255, 230, 120), (255, 255, 235)]))

    placed = {}
    for slug, px, x, y, flip, mode in ACTORS:
        pivot = None
        if slug == 'monia':
            im = ml.monia(px)[0]
        elif mode == 'h':
            im, pivot = sticker_turned(slug, px, QUETZ_TURN, QUETZ_HEAD, flip)
        else:
            im = sticker(slug, px, 0, flip)
        bb = im.getbbox()
        if mode == 'h':
            left, top = int(x - pivot[0]), int(y - pivot[1])
        else:
            left = int(x - (bb[0] + bb[2]) / 2)
            top = int(y - bb[3]) if mode == 'f' else int(y - (bb[1] + bb[3]) / 2)
        placed[slug] = (im, left, top, bb, mode)

    def paste(slugs):
        for slug in sorted(slugs, key=lambda k: placed[k][2] + placed[k][3][3]):
            im, left, top, bb, mode = placed[slug]
            if mode == 'f':
                shadow(cv, left + (bb[0] + bb[2]) / 2, top + bb[3], (bb[2] - bb[0]) * 0.8)
            cv.paste(im, (left, top), im)

    cv.alpha_composite(frame_layers())
    paste(UNDER)
    ribbon_ornaments(cv)
    paste([k for k in placed if k not in UNDER and k not in FRONT])

    # Brackles eigenes Geschoss (Schädel-Bombe): Bogen vom Katapult auf Riffel zu; die Flammen seines Einschlags brennen vor Riffels Füßen
    skull_im, fire_im = brackle_fx(8, True)
    p0, p1, p2 = (575, 725), (850, 560), (1300, 915)
    bez = lambda t: ((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1])

    def arc(d):
        for i in range(0, 38):
            t = i / 50
            x, y = bez(t)
            r = 1 + i * 0.07
            d.ellipse([x / CELL - r, y / CELL - r, x / CELL + r, y / CELL + r], fill=(255, 150 + i * 2, 50 + i * 3))
    cv.alpha_composite(lowres(arc))
    sx_, sy_ = bez(0.78)
    cv.alpha_composite(skull_im, (int(sx_ - skull_im.width / 2), int(sy_ - skull_im.height / 2)))
    cv.alpha_composite(fire_im, (int(1235 - fire_im.width / 2), 1045 - fire_im.height))
    glints(cv, [(520, 330, 0, 2), (1560, 250, 1, 2), (1130, 905, 0, 1), (1480, 760, 1, 1)])
    ml.put(cv, ml.wordmark(4), W // 2, H // 2)
    paste([k for k in placed if k in FRONT])
    # Rote Blitze von den Kristall-Händen von Chaos-Diamond: Sprite-Pixel × Maßstab + Lage des Bildes; vor dem Sprite, damit der Ansatz sichtbar ist
    _, left_c, top_c, _, _ = placed['chaos-diamond-the-cracked-keeper']
    padc = max(3, -(-2 * 7 * 2 // 14) + 1) * 14

    def at_chaos(sx, sy):
        return (left_c + padc + (sx + 0.5) * 14, top_c + padc + (sy + 0.5) * 14)
    for (sx, sy), dst, sd in (((4, 33), (1170, 800), 7), ((3, 4), (1250, 110), 2), ((45, 15), (1860, 40), 4)):
        o = at_chaos(sx, sy)
        cv.alpha_composite(bolt(o, dst, seed=sd, branch=False))
        cv.alpha_composite(star(o[0], o[1], 46, seed=sd, cols=((90, 8, 30), (226, 36, 60), (255, 140, 160), (255, 240, 245))))     # Funkenkranz an der Hand
    cv.alpha_composite(star(1185, 985, 38, seed=9, spikes=7))                      # Mündungsfeuer
    return cv


def safe_overlay(im):
    ov = im.copy().convert('RGBA')
    ImageDraw.Draw(ov).rectangle(SAFE, outline=(255, 60, 60, 255), width=4)
    return ov


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    cv = banner()
    cv.convert('RGB').save(OUT / 'banner-youtube.png', optimize=True)
    safe_overlay(cv).convert('RGB').save(OUT / 'banner-youtube-sicherer-bereich.png')
    print('fertig:', OUT / 'banner-youtube.png', (OUT / 'banner-youtube.png').stat().st_size // 1024, 'KB')


if __name__ == '__main__':
    main()
