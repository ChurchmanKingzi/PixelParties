# -*- coding: utf-8 -*-
"""Vorgerenderte Öffnungsanimation der Booster-Packs (Pixelart, 30 Bilder/s, nur ganze Pixel, Dithering statt Alpha).

Aufruf:  python3 scripts/booster/build_opening.py [pack-id ...] [--out DIR]
Ausgabe (Standard data/shop/Boosterpacks/opening/):
  <pack>.back.png / <pack>.front.png   Effekt-Bildfolgen als Raster (9 Spalten), Bühne 320x416:
                                       back = hinter dem Pack (Strahlenkranz, Aura), front = davor (Funken, Risse, Licht, Blitz, Partikel, neun Karten)
  cut-top.png / cut-body.png           gezackte Reißkante des Packs (Masken 192x320): oberer Siegelstreifen / Rest
  opening.json                         Takt, Raster, Zeitleiste (Pack-Versatz je Bild, Ereignisse für den Ton)
Das Pack selbst (Bild + Schimmer) stammt aus den Pack-Dateien; zur Laufzeit wird es nur in ganzen Pixeln verschoben.
Alles Gezeichnete nutzt Farben aus data/palette.json; der Kartenrücken ist das Standard-Sleeve (public/cardback.png) 1:1 auf 75x105.
"""
import json, math, os, sys
import numpy as np
from PIL import Image
import pal

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
SW, SH = 320, 416                 # Bühne
PX, PY = 64, 48                   # Pack-Ursprung (Pack 192x320)
PW, PHH = 192, 320
CX, CY = PX + PW // 2, PY + PHH // 2
FPS = 30
F = 126
COLS = 9
CUT = 44                          # Reißkante (Zeile im Pack)

T_SLIDE, T_IDLE, T_CHARGE, T_RIP, T_FLASH, T_CARDS, T_AMBIENT = 0, 10, 30, 60, 68, 76, 114

YY, XX = np.mgrid[0:SH, 0:SW]
_B = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0
BAY = np.tile(_B, (SH // 4, SW // 4))
DIST = np.hypot(XX - CX, YY - CY)
ANG = np.arctan2(YY - CY, XX - CX)


def C(h):
    return tuple(int(v) for v in pal.snap1(h))


WHITE, GOLD_L, GOLD, GOLD_O, GOLD_D = C('#ffffff'), C('#f7f7ad'), C('#fad54a'), C('#f29a3e'), C('#ee6428')

# Akzentfarben je Pack: (dunkel, mittel, hell)
ACCENT = {
    'ability':   ('#2f539d', '#4580f6', '#bcd9ff'),
    'hero':      ('#58238c', '#a040ff', '#e0c8ff'),
    'clash':     ('#b62600', '#ee6428', '#fad54a'),
    'monia':     ('#c4286a', '#ff6ab8', '#ffd0ea'),
    'future':    ('#780000', '#ff2828', '#ffb090'),
    'world1':    ('#9a5a1a', '#e8a838', '#fff0b0'),
    'world2':    ('#1a8a50', '#44d888', '#c8ffd8'),
    'community': ('#1a78c8', '#4cc8f0', '#e8ffff'),
    'trials':    ('#5a2aa8', '#c07a3c', '#f0e0c0'),
}
RAINBOW = ['#ff2828', '#ff8c28', '#fad54a', '#44ff88', '#4cc8f0', '#a070f0', '#ff6ab8']


class Layer:
    def __init__(self):
        self.a = np.zeros((F, SH, SW, 4), np.uint8)

    def m(self, f, mask, col):
        if 0 <= f < F:
            self.a[f][mask] = (*col, 255)

    def px(self, f, x, y, col, w=1, h=1):
        if 0 <= f < F:
            x0, y0 = max(int(x), 0), max(int(y), 0)
            x1, y1 = min(int(x) + w, SW), min(int(y) + h, SH)
            if x1 > x0 and y1 > y0:
                self.a[f, y0:y1, x0:x1] = (*col, 255)

    def star(self, f, cx, cy, r, col, core=WHITE):
        if r <= 0:
            return
        self.px(f, cx, cy, core)
        for k in range(1, r + 1):
            c = core if k <= (r + 1) // 3 else col
            for dx, dy in ((k, 0), (-k, 0), (0, k), (0, -k)):
                self.px(f, cx + dx, cy + dy, c)
        if r >= 3:
            for dx, dy in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
                self.px(f, cx + dx, cy + dy, col)

    def blit(self, f, img, x, y, dither=None):
        """RGBA-Bild (harte Alpha) an (x,y); dither = Maske-Funktion (h,w)->bool für Geister-/Blitzbilder."""
        if not (0 <= f < F):
            return
        h, w = img.shape[:2]
        x0, y0 = max(x, 0), max(y, 0); x1, y1 = min(x + w, SW), min(y + h, SH)
        if x1 <= x0 or y1 <= y0:
            return
        sub = img[y0 - y:y1 - y, x0 - x:x1 - x]
        ok = sub[..., 3] > 127
        if dither is not None:
            ok &= dither[y0:y1, x0:x1]
        t = self.a[f, y0:y1, x0:x1]
        t[ok] = sub[ok]


def ease_out(t):
    return 1 - (1 - t) ** 3


def load_cardback():
    im = Image.open(os.path.join(ROOT, 'public', 'cardback.png')).convert('RGBA')
    a = np.asarray(im)[5::10, 5::10]               # Mitte jedes 10x10-Blocks -> 75x105
    return np.ascontiguousarray(a)


CARD_W, CARD_H = 75, 105
GRID_GAP = 6
GX0 = (SW - (3 * CARD_W + 2 * GRID_GAP)) // 2
GY0 = (SH - (3 * CARD_H + 2 * GRID_GAP)) // 2 + 2


def slot(i):
    return GX0 + (i % 3) * (CARD_W + GRID_GAP), GY0 + (i // 3) * (CARD_H + GRID_GAP)


# ---------------------------------------------------------------- Zeitleiste des Packs
def pack_timeline():
    slide = [100, 68, 44, 27, 15, 8, 4, 2, 1, 0]
    bob = [0, 0, -1, -1, -2, -2, -2, -2, -1, -1, 0, 0, -1, -1, -2, -2, -2, -1, -1, 0]
    rng = np.random.RandomState(11)
    tl = []
    for f in range(F):
        e = {'f': f, 'mode': 'hidden', 'x': 0, 'y': 0, 'shimmer': None}
        if f < T_RIP:
            e['mode'] = 'whole'
            if f < T_IDLE:
                e['y'] = slide[f]
            elif f < T_CHARGE:
                e['y'] = bob[f - T_IDLE]
            else:
                k = (f - T_CHARGE) / float(T_RIP - T_CHARGE)
                amp = int(round(1 + 2 * k))
                e['x'] = amp * (1 if (f % 2 == 0) else -1)
                e['y'] = int(rng.randint(0, 2)) + (2 if f >= T_RIP - 4 else 0)
            e['shimmer'] = f % 16
        elif f < T_FLASH + 2:
            e['mode'] = 'split'
            t = f - T_RIP
            tx = [0, 1, 2, 4, 6, 9, 12, 16, 22, 28][t]
            ty = [-2, -5, -9, -14, -20, -27, -35, -44, -56, -70][t]
            e['top'] = {'x': tx, 'y': ty}
            e['body'] = {'x': (2 if f % 2 == 0 else -2), 'y': min(t, 3)}
        out = e
        tl.append(out)
    return tl


# ---------------------------------------------------------------- Effekte
def build_pack(pack, card):
    dark, mid, light = [C(h) for h in ACCENT[pack]]
    rng = np.random.RandomState(abs(hash(pack)) % 9999 if False else sum(ord(c) for c in pack) * 7)
    rain = pack == 'community'
    back, front = Layer(), Layer()
    tl = pack_timeline()

    def accent_pick(i):
        if rain:
            return C(RAINBOW[i % len(RAINBOW)])
        return (mid, light, GOLD, WHITE)[i % 4]

    # --- E1 Strahlenkranz (hinten): wächst in der Aufladung, explodiert im Burst, bleibt als sanftes Rad
    for f in range(T_IDLE, F):
        if f < T_CHARGE:
            dens, R = 0.12 + 0.10 * (f - T_IDLE) / 20.0, 130 + 40 * (f - T_IDLE) / 20.0
        elif f < T_FLASH:
            k = (f - T_CHARGE) / float(T_FLASH - T_CHARGE)
            dens, R = 0.22 + 0.45 * k, 170 + 60 * k
        elif f < T_FLASH + 14:
            dens, R = 1.0, 330
        else:
            k = min(1.0, (f - T_FLASH - 14) / 22.0)
            dens, R = 1.0 - 0.65 * k, 330
        nr = 18
        rot = f * 0.025
        wedge = np.floor((ANG + rot) / (2 * math.pi) * nr * 2).astype(int) % 2 == 1
        fall = np.clip(1 - DIST / R, 0, 1)
        on = wedge & (BAY < dens * (0.35 + 0.65 * fall)) & (DIST < R)
        near = on & (DIST < R * 0.45)
        back.m(f, on, dark if not rain else C('#323232'))
        back.m(f, on & (BAY < dens * 0.5 * fall), mid)
        back.m(f, near & (BAY < 0.35), light)

    # --- E2 Aura (hinten): pulsierender Kranz um das Pack
    dxs = np.maximum(np.maximum(PX - XX, XX - (PX + PW - 1)), 0)
    dys = np.maximum(np.maximum(PY - YY, YY - (PY + PHH - 1)), 0)
    dpk = np.hypot(dxs, dys)
    for f in range(T_SLIDE + 6, T_FLASH + 2):
        g = 0.25 if f < T_CHARGE else 0.25 + 0.75 * (f - T_CHARGE) / float(T_FLASH - T_CHARGE)
        pulse = 0.5 + 0.5 * math.sin(f * (0.5 if f < T_CHARGE else 0.9))
        reach = 8 + 20 * g + 8 * pulse
        v = np.clip(1 - dpk / reach, 0, 1) * (0.6 + 0.4 * pulse) * g * 1.4
        outside = dpk > 0
        back.m(f, outside & (v > BAY * 0.9) & (v > 0.12), mid)
        back.m(f, outside & (v > 0.35 + BAY * 0.4), light)
        back.m(f, outside & (v > 0.75 + BAY * 0.25), WHITE)

    # --- E3 kreisende Funken (vorn): vor der Aufladung beginnend
    n_orb = 12
    ph = rng.rand(n_orb) * 6.283
    for f in range(T_IDLE - 4, T_RIP):
        speed = 0.10 if f < T_CHARGE else 0.10 + 0.18 * (f - T_CHARGE) / 30.0
        base = f * speed
        for i in range(n_orb):
            a = ph[i] + base * (1 if i % 2 == 0 else -1)
            rx, ry = 122 + (i % 3) * 8, 186 + (i % 4) * 5
            x, y = CX + rx * math.cos(a), CY + ry * math.sin(a)
            tw = (f + i * 3) % 6
            r = 2 if tw in (0, 1, 2) else 1
            front.star(f, int(x), int(y), r, accent_pick(i), WHITE if tw < 3 else light)
            for k in (1, 2, 3):
                aa = a - k * speed * (1 if i % 2 == 0 else -1)
                front.px(f, int(CX + rx * math.cos(aa)), int(CY + ry * math.sin(aa)), mid if k == 1 else dark)

    # --- E4 einlaufende Energie (vorn): Teilchen ziehen aus der Bühne ins Pack
    n_in = 70
    start_f = rng.randint(T_CHARGE - 2, T_RIP - 6, n_in)
    a0 = rng.rand(n_in) * 6.283
    r0 = 170 + rng.rand(n_in) * 70
    tgt = np.stack([CX + rng.randn(n_in) * 34, CY + rng.randn(n_in) * 70], 1)
    for i in range(n_in):
        sx, sy = CX + r0[i] * math.cos(a0[i]) * 0.9, CY + r0[i] * math.sin(a0[i])
        life = 12
        for t in range(life + 1):
            f = start_f[i] + t
            u = (t / float(life)) ** 1.9
            x = sx + (tgt[i][0] - sx) * u; y = sy + (tgt[i][1] - sy) * u
            if PX < x < PX + PW and PY < y < PY + PHH and u > 0.85:
                continue
            for k, c in ((0, WHITE), (1, light), (2, mid)):
                uu = (max(t - k * 1.2, 0) / float(life)) ** 1.9
                xx = sx + (tgt[i][0] - sx) * uu; yy = sy + (tgt[i][1] - sy) * uu
                s = 2 if k == 0 else 1
                front.px(f, xx, yy, c, s, s)

    # --- E5 Lichtrisse über dem Pack (vorn), wachsen von der Reißkante nach unten
    cut_y = PY + CUT
    cracks = []
    for ci in range(9):
        x = PX + 14 + ci * 20 + int(rng.randint(-5, 6)); y = cut_y
        pts = []
        for s in range(46):
            pts.append((x, y))
            y += 2 + int(rng.randint(0, 3)); x += int(rng.randint(-2, 3))
        cracks.append(pts)
        # Seitenast
        bx, by = pts[len(pts) // 3]
        br = []
        for s in range(18):
            br.append((bx, by)); by += 2; bx += (3 if ci % 2 else -3) + int(rng.randint(-1, 2))
        cracks.append(br)
    for f in range(T_CHARGE + 2, T_RIP):
        k = (f - T_CHARGE) / float(T_RIP - T_CHARGE)
        n = int(len(cracks[0]) * min(1.0, k * 1.15))
        shakex = tl[f]['x']; shakey = tl[f]['y']
        for pts in cracks:
            for j, (x, y) in enumerate(pts[:max(1, int(len(pts) * min(1.0, k * 1.15)))]):
                if not (PX + 3 < x < PX + PW - 3 and PY + CUT - 2 < y < PY + PHH - 22):
                    continue
                core = WHITE if (f + j) % 3 else GOLD_L
                front.px(f, x + shakex, y + shakey, core, 2, 1)
                if j % 2 == 0:
                    front.px(f, x + 1 + shakex, y + shakey, GOLD)
                    front.px(f, x - 1 + shakex, y + shakey, GOLD_O if f % 2 else GOLD)
    # leuchtende Naht an der Reißkante
    for f in range(T_CHARGE + 8, T_RIP):
        k = (f - T_CHARGE - 8) / float(T_RIP - T_CHARGE - 8)
        for x in range(PX + 2, PX + PW - 2):
            zig = 42 + abs((x - PX) % 12 - 6)
            if BAY[0, x % SW] < k or (x + f) % 3 == 0 and k > 0.4:
                front.px(f, x + tl[f]['x'], PY + zig + tl[f]['y'], WHITE if (x + f) % 2 else GOLD_L)

    # --- E6 Reißen: Licht quillt durch den Spalt zwischen Siegelstreifen und Pack, Lichtsäule nach oben
    xs = np.arange(PX, PX + PW)
    zig = 42 + np.abs((xs - PX) % 12 - 6)
    for f in range(T_RIP, T_FLASH + 4):
        t = f - T_RIP
        e = tl[f] if f < len(tl) else None
        ty = e['top']['y'] if e and e['mode'] == 'split' else -70
        by = e['body']['y'] if e and e['mode'] == 'split' else 3
        tx = e['top']['x'] if e and e['mode'] == 'split' else 28
        for k, x in enumerate(xs):
            y_top = PY + zig[k] + ty
            y_bot = PY + zig[k] + by
            if y_bot > y_top:
                for yy in range(max(int(y_top), 0), int(y_bot)):
                    front.px(f, x, yy, WHITE if (x + yy + f) % 3 else GOLD_L)
        # glühende Kante an beiden Rissrändern
        for k, x in enumerate(xs):
            for yy in (PY + zig[k] + ty, PY + zig[k] + by - 1):
                front.px(f, x, yy, GOLD_L)
                front.px(f, x, yy + 1, GOLD if (x + f) % 2 else GOLD_O)
        # Lichtsäule über dem Pack (trapezförmig, gedithert), strahlt nach oben aus der Öffnung
        gap_y = PY + CUT + ty // 2
        w = 22 + t * 11
        up = (YY < gap_y) & (np.abs(XX - CX) < w * np.clip(1.0 - (gap_y - YY) / 600.0, 0.2, 1.0))
        back.m(f, up & (BAY < 0.5 + 0.045 * t), light)
        back.m(f, up & (np.abs(XX - CX) < w * 0.5) & (BAY < 0.65), WHITE)
        # schwächerer Lichtfächer nach unten
        dn = (YY > gap_y) & (YY < gap_y + 16 + t * 7) & (np.abs(XX - CX) < 70 + t * 4) & (BAY < 0.35 - (YY - gap_y) / 500.0)
        back.m(f, dn, GOLD_L)

    # --- E7 Blitz (Dithering von Weiß) + großer Funkelstern + Lichtstrahlen
    flash = {68: 0.45, 69: 1.05, 70: 1.05, 71: 0.7, 72: 0.4, 73: 0.22, 74: 0.1}
    for f, d in flash.items():
        front.m(f, BAY < d, WHITE if d > 0.3 else GOLD_L)
    for f, R in zip(range(66, 82), (20, 40, 70, 110, 150, 150, 130, 110, 90, 75, 60, 48, 36, 26, 16, 8)):
        ah = (np.abs(YY - CY) <= (1 - np.abs(XX - CX) / float(R)) * 5) & (np.abs(XX - CX) < R)
        av = (np.abs(XX - CX) <= (1 - np.abs(YY - CY) / float(R)) * 5) & (np.abs(YY - CY) < R)
        front.m(f, ah | av, WHITE)
        front.m(f, (ah | av) & (DIST > 6) & (BAY < 0.5), GOLD_L if not rain else C(RAINBOW[f % 7]))
        dg = (np.abs(np.abs(XX - CX) - np.abs(YY - CY)) <= (1 - DIST / (R * 0.7)) * 3) & (DIST < R * 0.7)
        front.m(f, dg & (BAY < 0.7), light)
    # Strahlenbündel aus der Mitte
    for f in range(T_FLASH, T_FLASH + 10):
        t = f - T_FLASH
        for r_i in range(28):
            a = r_i / 28.0 * 6.283 + 0.1
            L = 60 + (r_i * 37 % 140) * (1 - t / 12.0)
            steps = int(L)
            for s in range(0, steps, 1):
                if s % 4 == 3 and (s + t) % 2:
                    continue
                front.px(f, CX + math.cos(a) * (20 + s + t * 6), CY + math.sin(a) * (20 + s + t * 6), WHITE if s < steps * 0.4 else (light if s < steps * 0.75 else mid))

    # --- E8 Druckwellen (Ringe)
    for ring_i, delay in enumerate((0, 3, 7)):
        for f in range(T_FLASH + delay, T_FLASH + delay + 20):
            t = f - T_FLASH - delay
            r = 10 + t * 15
            thick = max(2, 5 - t // 5)
            rim = (DIST >= r - thick) & (DIST < r)
            trail = (DIST >= r - thick - 10) & (DIST < r - thick) & (BAY < 0.45 - t * 0.015)
            col = WHITE if t < 5 else (light if t < 11 else mid)
            front.m(f, trail, light if not rain else C(RAINBOW[(t + ring_i) % 7]))
            front.m(f, rim, col)

    # --- E9 Partikelschauer aus dem Zentrum
    n_p = 320
    life = rng.randint(26, 46, n_p)
    ang = rng.rand(n_p) * 6.283
    spd = 3 + rng.rand(n_p) * 13
    big = rng.rand(n_p)
    for i in range(n_p):
        x, y = float(CX), float(CY)
        vx, vy = math.cos(ang[i]) * spd[i], math.sin(ang[i]) * spd[i]
        col = accent_pick(i) if i % 3 else (GOLD, WHITE, GOLD_L)[i % 3]
        for t in range(life[i]):
            f = T_FLASH + 1 + t
            x += vx; y += vy
            vx *= 0.92; vy = vy * 0.92 + 0.35
            if not (-4 < x < SW + 4 and -4 < y < SH + 4):
                break
            s = 4 if big[i] > 0.93 else 3 if big[i] > 0.8 else 2 if big[i] > 0.4 else 1
            if t > life[i] - 8 and (t + i) % 2:
                continue
            if big[i] > 0.88 and t % 4 < 2:
                front.star(f, int(x), int(y), 3, col, WHITE)
            else:
                front.px(f, x, y, col, s, s)

    # --- E10 Konfetti-/Glitzerregen
    n_c = 120
    c_start = rng.randint(T_FLASH + 6, 106, n_c)
    c_x = rng.rand(n_c) * SW
    c_v = 2.0 + rng.rand(n_c) * 2.6
    c_sw = rng.rand(n_c) * 6.283
    for i in range(n_c):
        col = C(RAINBOW[i % 7]) if (rain or i % 3 == 0) else (GOLD, light, WHITE, mid)[i % 4]
        y = -6.0
        for t in range(200):
            f = c_start[i] + t
            if f >= T_AMBIENT - 2 or y > SH + 4:
                break
            y += c_v[i]
            x = c_x[i] + 8 * math.sin(c_sw[i] + t * 0.22)
            front.px(f, x, y, col, 2, 3 if i % 2 else 2)
            if i % 5 == 0:
                front.px(f, x, y - 3, WHITE)

    # --- E11 neun Karten
    shade_cache = {}
    order = [4, 3, 5, 1, 7, 0, 2, 6, 8]       # Mitte zuerst, dann kreuzweise nach außen
    land = {}
    for n, i in enumerate(order):
        f0 = T_CARDS + n * 2
        dur = 15
        sx, sy = slot(i)
        ox, oy = CX - CARD_W // 2, CY - CARD_H // 2
        # Kontrollpunkt: seitlich/oben ausholen, Bogen
        dirx = 1 if (i % 3) > 1 else (-1 if (i % 3) < 1 else 0)
        diry = 1 if (i // 3) > 1 else (-1 if (i // 3) < 1 else 0)
        cxp, cyp = (ox + sx) / 2 + dirx * 40, (oy + sy) / 2 - 60 + diry * 20
        prev = []
        for t in range(dur + 1):
            f = f0 + t
            u = ease_out(t / float(dur))
            x = (1 - u) ** 2 * ox + 2 * (1 - u) * u * cxp + u * u * sx
            y = (1 - u) ** 2 * oy + 2 * (1 - u) * u * cyp + u * u * sy
            x, y = int(round(x)), int(round(y))
            # Geisterbilder (Schachbrett-Dithering) hinter der Karte
            if t < dur - 2:
                for g, (gx, gy) in enumerate(prev[-2:][::-1]):
                    pat = ((XX + YY) % 2 == g % 2)
                    front.blit(f, card, gx, gy, dither=pat)
            front.blit(f, card, x, y)
            if t < 3:     # Start: weißer Rand und Funkelstern auf der Karte
                edge = np.zeros((SH, SW), bool)
                edge[max(y - 1, 0):y + CARD_H + 1, max(x - 1, 0):x + CARD_W + 1] = True
                edge[max(y, 0):y + CARD_H, max(x, 0):x + CARD_W] = False
                front.m(f, edge, WHITE)
                front.star(f, x + CARD_W // 2, y + CARD_H // 2, 8 - 2 * t, light, WHITE)
            prev.append((x, y))
            if t == dur:
                land[i] = f
        # nach der Landung: Hüpfer + Blitzrand + Funken
        bounce = [-5, -2, 0, -1, 0]
        for t, dy in enumerate(bounce):
            f = f0 + dur + 1 + t
            front.blit(f, card, sx, sy + dy)
            if t < 2:
                edge = np.zeros((SH, SW), bool)
                edge[sy + dy - 1:sy + dy + CARD_H + 1, sx - 1:sx + CARD_W + 1] = True
                edge[sy + dy:sy + dy + CARD_H, sx:sx + CARD_W] = False
                front.m(f, edge & (BAY < 0.8), WHITE)
                for (qx, qy) in ((sx, sy + dy), (sx + CARD_W, sy + dy), (sx, sy + dy + CARD_H), (sx + CARD_W, sy + dy + CARD_H)):
                    front.star(f, qx, qy, 3 - t, light, WHITE)
        for f in range(f0 + dur + 1 + len(bounce), F):
            front.blit(f, card, sx, sy)

    # --- E12 Ambient: Funkeln auf dem Raster, periodisch (Schleife T_AMBIENT .. F-1)
    n_amb = 14
    ax = rng.randint(GX0, GX0 + 3 * CARD_W + 2 * GRID_GAP, n_amb)
    ay = rng.randint(GY0, GY0 + 3 * CARD_H + 2 * GRID_GAP, n_amb)
    pp = rng.rand(n_amb)
    per = F - T_AMBIENT
    for f in range(T_AMBIENT, F):
        for i in range(n_amb):
            t = (((f - T_AMBIENT) / float(per)) + pp[i]) % 1.0
            if t < 0.5:
                r = int(round(math.sin(t / 0.5 * math.pi) * 3))
                front.star(f, int(ax[i]), int(ay[i]), r, accent_pick(i), WHITE)
    # sanfter Kranz hinter den Karten im Ambient
    return back, front, tl


def save_sheet(layer, path):
    a = layer.a
    rows = (F + COLS - 1) // COLS
    sheet = np.zeros((rows * SH, COLS * SW, 4), np.uint8)
    for f in range(F):
        r, c = divmod(f, COLS)
        sheet[r * SH:(r + 1) * SH, c * SW:(c + 1) * SW] = a[f]
    im = Image.fromarray(sheet, 'RGBA')
    # Palettenbild, wenn <= 255 Farben (kleiner); sonst RGBA
    flat = sheet.reshape(-1, 4)
    op = flat[flat[:, 3] > 0][:, :3]
    uniq = np.unique(op, axis=0)
    if len(uniq) <= 255:
        pim = Image.new('P', im.size, 0)
        pal_list = [0, 0, 0] + [int(v) for c in uniq for v in c]
        pim.putpalette(pal_list + [0] * (768 - len(pal_list)))
        lut = {tuple(int(v) for v in c): i + 1 for i, c in enumerate(uniq)}
        idx = np.zeros(sheet.shape[:2], np.uint8)
        key = (sheet[..., 0].astype(np.int64) << 16) | (sheet[..., 1].astype(np.int64) << 8) | sheet[..., 2]
        for c, i in lut.items():
            idx[(key == ((c[0] << 16) | (c[1] << 8) | c[2])) & (sheet[..., 3] > 0)] = i
        pim = Image.fromarray(idx, 'P'); pim.putpalette(pal_list + [0] * (768 - len(pal_list)))
        pim.save(path, optimize=True, transparency=0)
        return 'P%d' % len(uniq)
    im.save(path, optimize=True)
    return 'RGBA'


def cut_masks(out):
    top = np.zeros((PHH, PW, 4), np.uint8); body = np.zeros((PHH, PW, 4), np.uint8)
    for x in range(PW):
        cut = 42 + abs(x % 12 - 6)
        top[:cut, x] = (255, 255, 255, 255)
        body[cut:, x] = (255, 255, 255, 255)
    Image.fromarray(top, 'RGBA').save(os.path.join(out, 'cut-top.png'))
    Image.fromarray(body, 'RGBA').save(os.path.join(out, 'cut-body.png'))


def main(argv):
    out = os.path.join(ROOT, 'data', 'shop', 'Boosterpacks', 'opening')
    args = list(argv)
    if '--out' in args:
        i = args.index('--out'); out = args[i + 1]; del args[i:i + 2]
    os.makedirs(out, exist_ok=True)
    only = set(args)
    card = load_cardback()
    cut_masks(out)
    tl = None
    for pack in ACCENT:
        if only and pack not in only:
            continue
        back, front, tl = build_pack(pack, card)
        kb = save_sheet(back, os.path.join(out, pack + '.back.png'))
        kf = save_sheet(front, os.path.join(out, pack + '.front.png'))
        print('ok', pack, kb, kf, os.path.getsize(os.path.join(out, pack + '.back.png')) // 1024, 'KB /', os.path.getsize(os.path.join(out, pack + '.front.png')) // 1024, 'KB')
    tl = tl or pack_timeline()
    meta = {
        'version': 1, 'fps': FPS, 'frames': F, 'stage': [SW, SH], 'columns': COLS, 'packOrigin': [PX, PY], 'packSize': [PW, PHH],
        'cut': {'top': 'cut-top.png', 'body': 'cut-body.png', 'line': CUT},
        'events': {'slide': T_SLIDE, 'idle': T_IDLE, 'charge': T_CHARGE, 'rip': T_RIP, 'flash': T_FLASH, 'cards': T_CARDS, 'ambient': T_AMBIENT,
                   'cardLanding': [T_CARDS + n * 2 + 15 for n in range(9)]},
        'ambientLoop': [T_AMBIENT, F - 1],
        'cardSlots': [list(slot(i)) for i in range(9)], 'cardSize': [CARD_W, CARD_H],
        'layers': {'back': '<pack>.back.png', 'front': '<pack>.front.png'},
        'timeline': tl,
    }
    with open(os.path.join(out, 'opening.json'), 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False)


if __name__ == '__main__':
    main(sys.argv[1:])
