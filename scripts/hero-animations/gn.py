# -*- coding: utf-8 -*-
"""Idle-Animationen für die MotiveGN-Heroes und -Skins.

Aufruf: python3 gn.py <tag> [ms] <variante>

Menschliche Figuren blinzeln zweimal pro Loop (geschlossen: 2 px breiter
schwarzer Strich), stehende federn in den Knien (die Füße bleiben stehen).
Dazu je Variante:
* andras:    steht still (die Flammen sind Flammenwerfer, keine Düsen) und
             blinzelt; aus beiden Kanonen lodert je eine Flamme: sie wird aus
             dem Umriss der Original-Flamme erzeugt, setzt schon in der
             schwarzen Rohrmündung an (verdeckt sie teilweise), wird länger
             und kürzer, windet sich zur Spitze hin stärker, und ihre
             Farbstufen (weiß, gelb, orange) züngeln nach außen.
* friedhelm / titan: hängt an den Drähten seiner Manöver-Ausrüstung: zwei
             Drahtseile laufen von den Geräten schräg nach oben aus dem Bild
             (oben ausgeblendet); er pendelt daran hin und her und federt
             dabei leicht auf und ab.
* ftriffel:  Future Tech Gunslinger Riffel feuert durchgehend: alle 6 Frames
             startet an der Pistolenmündung ein Mündungsfeuer, die beiden
             Kugeln samt Leuchtspur rasen nach links davon und blenden aus.
             Dazu Federn und Blinzeln.
* ascriffel: Riffel, Master of the Ultimate Gun: Federn, Blinzeln, die zwei
             schwebenden Pistolen wippen gegenläufig, um sie herum zucken
             kleine türkise Blitze (einzelne Partikel, jeder mit eigener Form,
             berühren sie nie).
* mgriffel:  Magical Girl Riffel: Federn, Blinzeln, Glitzern am Hut.
* kassaran:  Federn, seine weißen Seher-Augen pulsieren.
* kent / heinz: Federn; die Brillengläser blitzen auf (werden weiß, am Glas
             funkelt ein Stern).
* madheinz:  Mad Scientist Heinz: Federn, Blinzeln, sein Grinsen (die weiße
             Linie in der Mitte) wird mal breiter, mal schmaler.
* koperniko: Federn, Blinzeln, die Teleskop-Linse funkelt (das Teleskop steht).
* waflav:    Thunderstruck Waflav schwebt und schlägt mit den Flügeln. Die
             Blitze sind unabhängig von ihm: die Blitzsäule über ihm schlägt
             viermal pro Loop neu ein (jedes Mal mit neuer Zickzack-Form aus
             drei Strängen, weißer Kern, blaue Ränder), flackert und erlischt
             kurz; die kleinen Funkenblitze um ihn zucken einzeln zu eigenen
             Zeiten auf, auch jedes Mal in neuer Form.
* ralzish / blueralzish: hebt und senkt sein Schwert, über die Klinge läuft
             ein Lichtreflex; bei Ralzish weht das gelbgrüne Cape.
* pixmarck / dad: Von Pixmarck (beide Versionen) feuert durchgehend: alle
             6 Frames Mündungsfeuer, die Kugeln samt Streifen rasen nach
             rechts davon; dazu Federn (und bei der normalen Version Blinzeln).
* nero / normalnero: Nero Zira hängt an seinen Schläuchen und wippt daran bis
             zu 2 px (die Schläuche oben bleiben fest und werden gedehnt); die
             Arme bewegen sich (Roboterarme heben und senken sich, beim Skin
             pendeln Unterarme und Hände). Die Kabel unten enden abgerissen.
             Roboter: die Augen glimmen; Skin: blinzelt.
* orthos:    die Flammen auf den Köpfen lodern, beide Köpfe blinzeln, dazu
             leichtes Squash-and-Stretch in der Senkrechten (unten fest).
* luna:      schwebt auf und ab, schlägt mit den gelben Flügelchen, ihr Körper
             wiegt sich, die Haare wehen sacht, sie blinzelt; die rote Kontur
             wird jedes Frame neu um die ganze Figur gelegt (immer genau 1 px).
* tsuki:     leuchtet hellgelb bis weiß, leicht durchscheinend mit weichem
             Lichtsaum, und schwebt; die Haare wehen, beide Armpaare heben und
             senken sich gegenläufig, die Beine schwingen seitwärts.
"""
import math
import sys
from PIL import Image
import numpy as np
import cv2
from anim_common import rgb, save_outputs, sparkle_pixels, BOUNCE12, ring8
from flap_common import fill_pinholes, shear_flap

BLACK = (0, 0, 0, 255)
BLINK = {14: 'halb', 15: 'zu', 16: 'zu', 17: 'halb', 38: 'halb', 39: 'zu', 40: 'zu', 41: 'halb'}
GOLD = ('ffe600', 'fff6ac')
WHITE2 = ('e8f4ff', 'ffffff')
N = 48

V_ = {
    'andras': dict(slug='andras-the-human-weapon', part='body', pads=(7, 7, 3, 7),
                   lid=[((39, 11), 'f5ce88'), ((40, 11), 'f5ce88'), ((43, 11), 'f5ce88'), ((44, 11), 'f5ce88')],
                   line=[(39, 12), (40, 12), (43, 12), (44, 12)]),
    'friedhelm': dict(slug='friedhelm-the-misled-avenger', wires=((1, 8), (22, 8)), pads=(3, 3, 12, 3),
                      lid=[((9, 6), 'f5ce88'), ((10, 6), 'f5ce88')], line=[(9, 7), (10, 7)]),
    'titan': dict(slug='titan-slayer-friedhelm', wires=((1, 8), (22, 8)), pads=(3, 3, 12, 3),
                  lid=[((9, 7), 'f5ce88'), ((10, 7), 'f5ce88')], line=[(9, 8), (10, 8)]),
    'ftriffel': dict(slug='future-tech-gunslinger-riffel', part='body', knee=20, pads=(14, 3, 4, 2),
                     lid=[((28, 8), 'f6bd98'), ((29, 8), 'f6bd98')], line=[(28, 9), (29, 9)]),
    'ascriffel': dict(slug='riffel-master-of-the-ultimate-gun', knee=22, pads=(4, 4, 5, 3),
                      lid=[((23, 10), 'f6bd98'), ((24, 10), 'f6bd98')], line=[(23, 11), (24, 11)]),
    'mgriffel': dict(slug='magical-girl-riffel', knee=21, glint=(7, 1, 30, GOLD),
                     lid=[((5, 8), 'f6bd98'), ((6, 8), 'f6bd98')], line=[(5, 9), (6, 9)]),
    'kassaran': dict(slug='kassaran-seer-of-everything', knee=19),
    'kent': dict(slug='kent-the-indebted-apprentice', knee=20),
    'koperniko': dict(slug='koperniko-the-stargazer', knee=24, glint=(34, 1, 30, WHITE2),
                      lid=[((7, 12), 'f8bc77'), ((8, 12), 'f8bc77'), ((10, 12), 'ffd6a3'), ((11, 12), 'ffd6a3')],
                      line=[(7, 13), (8, 13), (10, 13), (11, 13)]),
    'waflav': dict(slug='thunderstruck-waflav', part='body', hover=True, pads=(3, 3, 3, 4)),
    'heinz': dict(slug='visionary-genius-heinz', knee=21),
    'madheinz': dict(slug='mad-scientist-heinz', knee=20,
                     lid=[((11, 7), '555756'), ((12, 7), '555756'), ((15, 7), '555756'), ((16, 7), '555756')],
                     line=[(11, 8), (12, 8), (15, 8), (16, 8)]),
    'ralzish': dict(slug='wall-breaker-general-ralzish', part='body', pads=(3, 3, 5, 2)),
    'blueralzish': dict(slug='blue-ralzish', part='body', pads=(3, 3, 5, 2)),
    'pixmarck': dict(slug='von-pixmarck-the-iron-chancellor', knee=23, glint=(9, 1, 30, GOLD), muzzle=(30, 14),
                     pads=(3, 16, 4, 2),
                     lid=[((7, 10), 'd5a462'), ((11, 10), 'd5a462')], line=[(6, 10), (7, 10), (10, 10), (11, 10)]),
    'dad': dict(slug='dad-of-the-year-von-pixmarck', knee=21, muzzle=(30, 12), pads=(3, 16, 4, 2)),
    'nero': dict(slug='nero-zira-the-mastermind', part='body', hang=6, pads=(3, 3, 3, 4)),
    'normalnero': dict(slug='normal-nero-zira', hang=1, pads=(3, 3, 3, 4)),
    'orthos': dict(slug='orthos-the-loyal-guard-dog', pads=(3, 3, 5, 2)),
    'luna': dict(slug='luna-the-flame-fairy', pads=(4, 4, 4, 4)),
    'tsuki': dict(slug='tsu-ki-the-lunatic-princess', part='body', pads=(7, 7, 7, 7)),
}
V = next((v for v in sys.argv[2:] if v in V_), 'kent')
C = V_[V]
SLUG = C['slug']


def load(part=None):
    n = f'src/{SLUG}-{part}.png' if part else f'src/{SLUG}.png'
    return np.array(Image.open(n).convert('RGBA')).astype(int)


SRC = load(C.get('part'))
SH, SW = SRC.shape[:2]
KNEE = C.get('knee', SH)
PL, PR, PT, PB = C.get('pads', (3, 3, 4, 2))
P = PL
H, W = SH + PT + PB, SW + PL + PR
_ys, _xs = np.mgrid[0:SH, 0:SW]


def lum(a):
    return 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]


def lighten(c, f):
    return [int(c[0] + (255 - c[0]) * f), int(c[1] + (255 - c[1]) * f), int(c[2] + (255 - c[2]) * f), int(c[3])]


def blend(out, y, x, c, a=None):
    """c (RGBA) mit Deckkraft a (Standard: seine eigene) über out[y, x] legen."""
    a = c[3] if a is None else a
    if a <= 0:
        return
    if not out[y, x, 3] or a >= 255:
        out[y, x] = [c[0], c[1], c[2], a]
        return
    f = a / 255
    out[y, x] = [int(round(c[k] * f + out[y, x, k] * (1 - f))) for k in range(3)] + [max(int(out[y, x, 3]), a)]


# --- Blitze (Zickzack) --------------------------------------------------------
def line_px(x0, y0, x1, y1):
    """8er-verbundene Pixel einer Strecke."""
    n = max(int(round(max(abs(x1 - x0), abs(y1 - y0)))), 1)
    pts = []
    for k in range(n + 1):
        p = (int(round(x0 + (x1 - x0) * k / n)), int(round(y0 + (y1 - y0) * k / n)))
        if not pts or pts[-1] != p:
            pts.append(p)
    return pts


def zigzag(rng, p0, p1, jag, depth=3):
    """Blitzpfad von p0 nach p1 (Mittelpunkt-Verschiebung), als Pixelliste."""
    pts = [p0, p1]
    for d in range(depth):
        new = [pts[0]]
        for a, b in zip(pts, pts[1:]):
            mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
            dx, dy = b[0] - a[0], b[1] - a[1]
            ln = math.hypot(dx, dy) or 1
            off = rng.uniform(-jag, jag) / (1.6 ** d)
            new += [(mx - dy / ln * off, my + dx / ln * off), b]
        pts = new
    px = []
    for a, b in zip(pts, pts[1:]):
        for p in line_px(a[0], a[1], b[0], b[1]):
            if not px or px[-1] != p:
                px.append(p)
    return px


def draw_bolt(out, pix, core, edge, outer=None, fade=1.0):
    """Blitz: Kern 1 px, daneben (4er) die Randfarbe, optional außen dunkler."""
    core_s = set(pix)
    edge_s = {(x + dx, y + dy) for x, y in pix for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))} - core_s
    if outer is not None:
        out_s = {(x + dx, y + dy) for x, y in edge_s for dx, dy in ((1, 0), (-1, 0))} - core_s - edge_s
        for x, y in out_s:
            if 0 < y < out.shape[0] - 1 and 0 < x < out.shape[1] - 1:
                blend(out, y, x, rgb(outer), int(255 * fade))
    for x, y in edge_s:
        if 0 < y < out.shape[0] - 1 and 0 < x < out.shape[1] - 1:
            blend(out, y, x, rgb(edge), int(255 * fade))
    for x, y in core_s:
        if 0 < y < out.shape[0] - 1 and 0 < x < out.shape[1] - 1:
            blend(out, y, x, rgb(core), int(255 * fade))


# --- Mündungsfeuer ------------------------------------------------------------
def muzzle_flash(out, x, y, size, d):
    """Mündungsfeuer an (x, y), in Schussrichtung d (±1); size 2 = voll, 1 = klein."""
    W_, Y_, O_ = rgb('ffffff'), rgb('ffe14d'), rgb('ff9a2e')
    if size >= 2:
        pix = {(x, y): W_, (x + d, y): W_, (x + 2 * d, y): Y_, (x + 3 * d, y): O_,
               (x, y - 1): Y_, (x, y + 1): Y_, (x + d, y - 1): Y_, (x + d, y + 1): Y_,
               (x + 2 * d, y - 1): O_, (x + 2 * d, y + 1): O_, (x + d, y - 2): O_, (x + d, y + 2): O_}
    else:
        pix = {(x, y): Y_, (x + d, y): O_, (x, y - 1): O_, (x, y + 1): O_}
    for (px, py), c in pix.items():
        if 0 < py < out.shape[0] - 1 and 0 < px < out.shape[1] - 1:
            out[py, px] = c


# --- Feuer (Orthos) -------------------------------------------------------------
def fire(part, i, dist, amp=0.25, cycles=4, k=0.6):
    """Flackerndes Feuer: die Hitze jedes Pixels (Rang seiner Helligkeit)
    schwankt mit einer weichen Welle, die entlang dist nach außen läuft; nur
    äußerste, kühle Spitzenpixel verlöschen kurz. Frame 0 = Originalbild."""
    m = part[:, :, 3] > 0
    cols = sorted({tuple(int(v) for v in part[y, x]) for y, x in zip(*np.nonzero(m))}, key=lambda c: lum(np.array(c)))
    rank = {c: j for j, c in enumerate(cols)}
    n = len(cols) - 1
    out = np.zeros_like(part)
    w = 2 * math.pi * cycles * i / N
    gy, gx = np.gradient(dist)
    for y, x in zip(*np.nonzero(m)):
        c = tuple(int(v) for v in part[y, x])
        h = rank[c] / n
        ph = 0.9 * math.sin(0.23 * x + 0.31 * y) + 0.7 * math.sin(0.17 * x - 0.26 * y)
        s = dist[y, x]
        h2 = h + amp * (math.sin(w - k * s + ph) - math.sin(-k * s + ph))
        if h2 < -0.05 and h < 0.3:
            nx, ny = int(round(x + np.sign(gx[y, x]))), int(round(y + np.sign(gy[y, x])))
            if not (0 <= ny < m.shape[0] and 0 <= nx < m.shape[1] and m[ny, nx]):
                continue
        out[y, x] = cols[int(round(min(1.0, max(0.0, h2)) * n))]
    return out


# --- Flammenwerfer (Andras) -----------------------------------------------------
class Jet:
    """Eine Flamme aus einer Rohrmündung, erzeugt aus dem Umriss der
    Original-Flamme: s = Abstand entlang der Flugrichtung ab der Mündung,
    r = quer dazu. Je s wird die Breite (r_min..r_max) der Original-Flamme
    gemessen; pro Frame wird die Flamme gedehnt/gestaucht, gewunden und an
    den Rändern gezüngelt, die Hitze ergibt die Farbe."""

    def __init__(self, mask, nozzle, seed):
        ys, xs = np.nonzero(mask)
        P_ = np.stack([xs, ys], 1).astype(float)
        c = P_.mean(0)
        d = np.linalg.svd(P_ - c)[2][0]
        if np.dot(d, c - np.array(nozzle)) < 0:
            d = -d
        self.d, self.n, self.N = d, np.array([-d[1], d[0]]), np.array(nozzle, float)
        s = (P_ - self.N) @ self.d
        r = (P_ - self.N) @ self.n
        self.L = s.max()
        self.lo = np.full(int(self.L) + 3, np.nan)
        self.hi = np.full(int(self.L) + 3, np.nan)
        for si, ri in zip(s, r):
            k = int(round(max(0, si)))
            self.lo[k] = ri if np.isnan(self.lo[k]) else min(self.lo[k], ri)
            self.hi[k] = ri if np.isnan(self.hi[k]) else max(self.hi[k], ri)
        idx = np.arange(len(self.lo))
        ok = ~np.isnan(self.lo)
        self.lo = np.interp(idx, idx[ok], self.lo[ok])
        self.hi = np.interp(idx, idx[ok], self.hi[ok])
        self.seed = seed

    def width(self, s):
        k = min(len(self.lo) - 1, max(0.0, s))
        k0 = int(k)
        k1 = min(len(self.lo) - 1, k0 + 1)
        f = k - k0
        return self.lo[k0] * (1 - f) + self.lo[k1] * f, self.hi[k0] * (1 - f) + self.hi[k1] * f

    def render(self, out, i, ox, oy, palette):
        w = 2 * math.pi / N
        ph = self.seed
        lam = 1 + 0.08 * math.sin(5 * w * i + ph) + 0.05 * math.sin(7 * w * i + 2 * ph)
        H_, W_ = out.shape[:2]
        dx_, dy_ = float(self.d[0]), float(self.d[1])
        nx_, ny_ = float(self.n[0]), float(self.n[1])
        Nx, Ny = float(self.N[0]), float(self.N[1])
        for y in range(H_):
            for x in range(W_):
                qx, qy = x - ox - Nx, y - oy - Ny
                s = qx * dx_ + qy * dy_
                if s < -2.5 or s > self.L * lam + 2:
                    continue
                r = qx * nx_ + qy * ny_
                sp = max(0.0, s / lam)
                wob = 1.3 * (sp / self.L) ** 1.3 * math.sin(0.42 * s - 6 * w * i + ph)
                rr = r - wob
                if s < 0:                                   # in der Rohrmündung: schmaler, heißer Kern
                    if abs(rr - (self.lo[0] + self.hi[0]) / 2) > 1.3:
                        continue
                    heat = 0.95
                else:
                    lo, hi = self.width(sp)
                    lick = 0.9 * (sp / self.L) * math.sin(0.9 * s + 1.7 * r - 8 * w * i + ph)
                    if not (lo - 0.5 - lick <= rr <= hi + 0.5 + lick) or sp > self.L:
                        continue
                    mid, half = (lo + hi) / 2, max(0.8, (hi - lo) / 2 + 0.5)
                    hr = 1 - abs(rr - mid) / half
                    hs = 1 - sp / self.L
                    heat = 0.55 * hr + 0.45 * hs + 0.14 * math.sin(0.8 * s - 6 * w * i + r + ph)
                    if sp > 0.82 * self.L and math.sin(1.3 * s + 2.1 * r - 8 * w * i + ph) > 0.55:
                        continue                            # Zungen an der Spitze reißen kurz ab
                col = palette[0] if heat > 0.62 else (palette[1] if heat > 0.36 else palette[2])
                out[y, x] = col


# --- Varianten-Vorbereitung ---------------------------------------------------
if V == 'andras':
    _fl = load('flames')
    _fm = _fl[:, :, 3] > 0
    JETS = [Jet(_fm & (_xs < 42), (28.5, 22.5), 0.0), Jet(_fm & (_xs >= 42), (SW - 1 - 28.5, 22.5), 1.9)]
    FLAME_PAL = [rgb('ffffff'), rgb('ffff00'), rgb('ffa718')]
if V == 'orthos':
    FLAME_M = (SRC[:, :, 3] > 0) & (_ys <= 10) & (SRC[:, :, 0] > SRC[:, :, 2] + 40)
    FL_DIST = (10.0 - _ys).astype(float)
    EYES = [(3, 14), (6, 14), (11, 13), (14, 13)]
if V == 'waflav':
    WINGS = load('wings')
    _b = load('bolt')
    n_, _lab, ST, _ = cv2.connectedComponentsWithStats((_b[:, :, 3] > 0).astype(np.uint8), connectivity=8)
    _order = sorted(range(1, n_), key=lambda k: -ST[k][4])
    MAIN = tuple(int(v) for v in ST[_order[0]][:4])             # x, y, w, h der Blitzsäule
    SPARKS = [tuple(int(v) for v in ST[k][:4]) for k in _order[1:]]
if V == 'luna':
    _red = (SRC[:, :, 3] > 0) & (SRC[:, :, 0] == 255) & (SRC[:, :, 1] == 0) & (SRC[:, :, 2] == 0)
    INNER = SRC.copy()
    INNER[_red] = 0
    WING_M = (INNER[:, :, 3] > 0) & ((_xs <= 5) | (_xs >= 12)) & (_ys >= 5) & (_ys <= 16) \
        & (INNER[:, :, 1] >= 0x80) & (INNER[:, :, 0] > 0xf0) & (INNER[:, :, 2] < 0x40)
    OUTLINE = rgb('ff0000')
if V == 'ascriffel':
    GUNS = load('guns')
    _g = GUNS[:, :, 3] > 0
    SRC[_g] = 0
    FIG = SRC[:, :, 3] > 0
if V in ('pixmarck', 'dad'):
    _sm = load('smoke')
    SRC[_sm[:, :, 3] > 0] = 0
    ys_, xs_ = np.nonzero(_sm[:, :, 3])
    _x0 = xs_.min()
    STREAK = _sm[ys_.min():ys_.max() + 1, _x0:_x0 + 12]            # eine Kugel mit Streifen
if V == 'ftriffel':
    BULLETS = load('bullets')
if V in ('ralzish', 'blueralzish'):
    SWORD = load('sword')
    BLADE = (SWORD[:, :, 3] > 0) & (lum(SWORD) > 150)
    CAPE = (SRC[:, :, 3] > 0) & (SRC[:, :, 1] > 120) & (SRC[:, :, 0] > 120) & (SRC[:, :, 2] < 160) \
        & (_xs >= 10) if V == 'ralzish' else None
if V == 'tsuki':
    BODY = SRC.astype(float)
    MASK = load('mask')
    _op = BODY[:, :, 3] > 0
    _l = lum(BODY) / 255
    _f = np.clip((_l - _l[_op].min()) / (_l[_op].max() - _l[_op].min()), 0, 1)[:, :, None]
    _lo, _mid, _hi = (np.array(rgb(c)[:3], float) for c in ('f0d050', 'fff6b8', 'ffffff'))
    GLOW = np.zeros_like(SRC)
    GLOW[:, :, :3] = np.where(_f < 0.5, _lo + (_mid - _lo) * (_f / 0.5), _mid + (_hi - _mid) * ((_f - 0.5) / 0.5)).astype(int)
    GLOW[:, :, 3] = np.where(_op, 214, 0)
    _mk = MASK[:, :, 3] > 0
    GLOW[_mk] = MASK[_mk]
    ARMS_UP = _op & (_ys >= 19) & (_ys <= 25) & ((_xs <= 9) | (_xs >= 22)) & ~_mk
    ARMS_LO = _op & (_ys >= 28) & (_ys <= 34) & ((_xs <= 9) | (_xs >= 23))
    LEGS = _op & (_ys >= 35)
if V in ('kent', 'heinz'):
    LENS = (SRC[:, :, 3] > 0) & (lum(SRC) > 200) & (((_ys >= 7) & (_ys <= 10)) if V == 'kent' else ((_ys >= 9) & (_ys <= 10)))
    _ly, _lx = np.nonzero(LENS)
    LENS_STAR = (int(_lx.max()), int(_ly.min()))
if V == 'kassaran':
    EYES = (SRC[:, :, 3] > 0) & (lum(SRC) > 240) & (_ys >= 5) & (_ys <= 8)
if V == 'nero':
    EYES = (SRC[:, :, 3] > 0) & (SRC[:, :, 0] > SRC[:, :, 1] + 25) & (_ys >= 10) & (_ys <= 20)
    ARMS = load('arms')
if V == 'normalnero':
    _eye_cols = {rgb(c) for c in ('94837d', 'ede4e0', 'ffffff', 'cdc2bf', '01349e', '12316d')}
    EYE_M = np.array([[tuple(SRC[y, x]) in _eye_cols and 12 <= y <= 18 and (21 <= x <= 26 or 33 <= x <= 38)
                       for x in range(SW)] for y in range(SH)])
    LOWER_ARMS = (SRC[:, :, 3] > 0) & (_ys >= 36) & ((_xs <= 11) | (_xs >= 48))


def hover(i):
    return int(round(math.sin(2 * math.pi * i / 24)))


def sweep(mask, i, start, speed=1.5, width=1.5):
    """Lichtreflex, der schräg über die Pixel von mask läuft (einmal pro Loop)."""
    t = (i - start) % N
    pos = t * speed - 4
    hit = {}
    for y, x in zip(*np.nonzero(mask)):
        d = abs((x + y * 0.6) - pos)
        if d < width:
            hit[(x, y)] = 1.0 if d < width / 2 else 0.5
    return hit


def put_sprite(out, s, ox, oy, dy_fn=None, dx_fn=None, skip=None):
    """s in out malen; dy_fn/dx_fn(x, y) = zusätzliche Verschiebung je Pixel."""
    for y in range(s.shape[0]):
        for x in range(s.shape[1]):
            if not s[y, x, 3] or (skip is not None and skip[y, x]):
                continue
            yy = y + oy + (dy_fn(x, y) if dy_fn else 0)
            xx = x + ox + (dx_fn(x, y) if dx_fn else 0)
            if 0 <= yy < out.shape[0] and 0 <= xx < out.shape[1]:
                if s[y, x, 3] < 255:
                    blend(out, yy, xx, s[y, x])
                else:
                    out[yy, xx] = s[y, x]


def frame(i):
    s = SRC.copy()
    st = BLINK.get(i)
    if st and 'lid' in C:
        for (x, y), c in C['lid']:
            s[y, x] = rgb(c)
        if st == 'zu':
            for x, y in C['line']:
                s[y, x] = BLACK
    out = np.zeros((H, W, 4), int)
    b = BOUNCE12[i % 12] if 'knee' in C else 0
    ox, oy = PL, PT
    dy_fn = (lambda x, y: b if y < KNEE else 0) if 'knee' in C else None
    if V == 'koperniko':                                 # das Teleskop steht fest
        dy_fn = lambda x, y: 0 if x >= 16 else (b if y < KNEE else 0)

    # ---------------- Effekte am Sprite ----------------
    if V == 'kassaran':
        f = 0.5 - 0.5 * math.cos(2 * math.pi * i / 24)
        for y, x in zip(*np.nonzero(EYES)):
            s[y, x] = [int(255 - 40 * f), int(255 - 10 * f), 255, 255]
    if V == 'nero':
        f = 0.5 - 0.5 * math.cos(2 * math.pi * i / 24)
        for y, x in zip(*np.nonzero(EYES)):
            s[y, x] = lighten(s[y, x], 0.35 * f)
    if V in ('kent', 'heinz'):                           # Brille blitzt auf
        t = (i - 22) % N
        f = {0: 0.5, 1: 1.0, 2: 1.0, 3: 0.6, 4: 0.3}.get(t, 0)
        for y, x in zip(*np.nonzero(LENS)):
            s[y, x] = lighten(s[y, x], f)
    if V == 'madheinz':                                  # Grinsen breiter/schmaler
        wgrin = 2 if i < 8 or 20 <= i < 26 or i >= 42 else (4 if i < 20 else 0)
        for x in (12, 15):
            s[10, x] = rgb('f0f2ef') if wgrin == 4 else SRC[10, x]
        for x in (13, 14):
            s[10, x] = rgb('555756') if wgrin == 0 else SRC[10, x]
    if V == 'normalnero' and st:
        for y, x in zip(*np.nonzero(EYE_M)):
            if st == 'zu' or y <= 14:
                s[y, x] = rgb('e6c6b8')
        if st == 'zu':
            for x in list(range(22, 26)) + list(range(34, 38)):
                s[16, x] = BLACK
    if V == 'orthos':
        fl = fire(np.where(FLAME_M[:, :, None], s, 0), i, FL_DIST)
        s[FLAME_M] = 0
        m = fl[:, :, 3] > 0
        s[m] = fl[m]
        if st:
            for x, y in EYES:
                s[y, x] = rgb('424242') if st == 'zu' else rgb('5a1010')

    # ---------------- Variantenweise zeichnen ----------------
    if V == 'andras':
        put_sprite(out, s, ox, oy)
        for j in JETS:
            j.render(out, i, ox, oy, FLAME_PAL)

    elif V in ('friedhelm', 'titan'):
        sway = int(round(math.sin(2 * math.pi * i / 24)))
        ox += sway
        oy += BOUNCE12[i % 12]
        for (gx, gy), side in zip(C['wires'], (-1, 1)):
            ax, ay = gx + side * 16 + PL, -40
            x0, y0 = gx + ox, gy + oy
            for x, y in line_px(x0, y0, ax, ay):
                if 1 <= y < H - 1 and 1 <= x < W - 1 and not out[y, x, 3]:
                    a = 255 if y >= 5 else int(255 * (y - 1) / 4)
                    if a > 0:
                        out[y, x] = [0x9a, 0x9a, 0x9a, a]
        put_sprite(out, s, ox, oy)

    elif V == 'ftriffel':
        t = i % 6                                        # alle 6 Frames ein Schuss
        if t < 3:
            dx = 14 - 12 * t
            a = [1.0, 1.0, 0.45][t]
            for y, x in zip(*np.nonzero(BULLETS[:, :, 3])):
                xx = x + dx + ox
                if 1 <= xx < W - 1:
                    blend(out, y + oy + b, xx, BULLETS[y, x], int(BULLETS[y, x, 3] * a))
        put_sprite(out, s, ox, oy, dy_fn)
        if t < 2:
            muzzle_flash(out, 16 + ox, 11 + oy + b, 2 - t, -1)

    elif V == 'ascriffel':
        put_sprite(out, s, ox, oy, dy_fn)
        for side in (-1, 1):
            gy = int(round(math.sin(2 * math.pi * i / 24 + (0 if side < 0 else math.pi))))
            gm = (GUNS[:, :, 3] > 0) & ((_xs < SW // 2) if side < 0 else (_xs >= SW // 2))
            for y, x in zip(*np.nonzero(gm)):
                out[y + oy + gy, x + ox] = GUNS[y, x]
        # türkise Blitz-Partikel: je Platz eigener Rhythmus, jedes Mal neue Form
        fig = np.zeros((H, W), bool)
        fig[oy:oy + SH, ox:ox + SW] = FIG
        keep = cv2.dilate((out[:, :, 3] > 0).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
        for k in range(6):
            per, ph = 16, (k * 7) % 16
            t = (i - ph) % per
            if t > 1:
                continue
            strike = (i - ph) // per
            rng = np.random.default_rng(1000 + 37 * k + 101 * strike)
            ang = 2 * math.pi * (k / 6) + rng.uniform(-0.4, 0.4)
            cx = ox + SW / 2 + math.cos(ang) * (SW / 2 - 6)
            cy = oy + SH / 2 + math.sin(ang) * (SH / 2 + 1)
            ln = rng.uniform(3, 5)
            a2 = rng.uniform(0, math.pi)
            p0 = (cx - math.cos(a2) * ln, cy - math.sin(a2) * ln)
            p1 = (cx + math.cos(a2) * ln, cy + math.sin(a2) * ln)
            pix = zigzag(rng, p0, p1, 2.0, 2)
            if any(not (1 <= y < H - 1 and 1 <= x < W - 1) or keep[y, x] for x, y in pix):
                continue                                 # nie an der Figur oder am Rand
            draw_bolt(out, pix, 'ffffff' if t == 0 else 'bff8ff', '6fe8ff', fade=1.0 if t == 0 else 0.7)

    elif V == 'waflav':
        hv = hover(i)
        lift = 0.12 * math.sin(2 * math.pi * i / 24)
        wl = np.zeros((SH, SW, 4), int)
        wm = WINGS[:, :, 3] > 0
        shear_flap(WINGS, wm & (_xs < 40), 34, -1, lift, 1.0 - 0.08 * max(0, lift) / 0.12, wl, curve=1.3)
        shear_flap(WINGS, wm & (_xs >= 40), 46, 1, lift, 1.0 - 0.08 * max(0, lift) / 0.12, wl, curve=1.3)
        m = wl[:, :, 3] > 0
        out[oy + hv:oy + hv + SH, ox:ox + SW][m] = wl[m]
        put_sprite(out, s, ox, oy + hv)
        # Blitzsäule: schlägt alle 12 Frames neu ein (unabhängig von Waflav)
        mx, my, mw, mh = MAIN
        t = i % 12
        strike = i // 12
        rng = np.random.default_rng(500 + strike)
        if t <= 8 and t != 3:
            reach = 0.55 if t == 0 else 1.0
            fade = {0: 1.0, 1: 1.0, 2: 1.0, 4: 0.9, 5: 1.0, 6: 0.8, 7: 1.0, 8: 0.55}[t]
            core = 'ffffff'
            for k, fx in enumerate((0.3, 0.5, 0.7)):
                top = (mx + mw * fx + rng.uniform(-3, 3), my)
                bot = (mx + mw * 0.5 + rng.uniform(-2, 2), my + mh - 1)
                pix = zigzag(rng, top, bot, 5.0, 4)
                pix = [(x + ox, y + oy) for x, y in pix if y <= my + mh * reach]
                draw_bolt(out, pix, core, '428ad2', '3061ae', fade)
        # Funkenblitze um ihn: jeder zu eigenen Zeiten, jedes Mal neue Form
        for k, (sx, sy, sw_, sh_) in enumerate(SPARKS):
            per, ph = 12 + (k % 3) * 4, (k * 5) % 12
            t = (i - ph) % per
            if t > 2:
                continue
            rng = np.random.default_rng(900 + 13 * k + 57 * ((i - ph) // per))
            p0 = (sx + rng.uniform(0, sw_ / 2), sy + rng.uniform(0, sh_ / 2))
            p1 = (sx + sw_ - 1 - rng.uniform(0, sw_ / 3), sy + sh_ - 1 - rng.uniform(0, sh_ / 3))
            if rng.random() < 0.5:
                p0, p1 = (p0[0], p1[1]), (p1[0], p0[1])
            pix = [(x + ox, y + oy) for x, y in zigzag(rng, p0, p1, 1.8, 2)]
            draw_bolt(out, pix, 'ffffff', 'a8d8ff', fade=[1.0, 0.8, 0.45][t])

    elif V in ('ralzish', 'blueralzish'):
        lift = -int(round(2 * (0.5 - 0.5 * math.cos(2 * math.pi * i / 24))))
        if CAPE is not None:
            def cdy(x, y):
                if not CAPE[y, x]:
                    return 0
                f = min(1.0, max(0.0, (x - 11) / 6))
                return int(round(1.3 * f * (math.sin(2 * math.pi * 2 * i / N - 0.8 * x) - math.sin(-0.8 * x))))
            put_sprite(out, s, ox, oy, dy_fn=cdy)
        else:
            put_sprite(out, s, ox, oy)
        sw = SWORD.copy()
        for (x, y), f in sweep(BLADE, i, 10, speed=1.6 if V == 'ralzish' else 2.0, width=2.0).items():
            sw[y, x] = lighten(sw[y, x], 0.85 * f)
        put_sprite(out, sw, ox, oy + lift)

    elif V in ('pixmarck', 'dad'):
        put_sprite(out, s, ox, oy, dy_fn)
        mx, my = C['muzzle']
        t = i % 6
        if t < 3:
            a = [1.0, 1.0, 0.5][t]
            x0 = mx + 1 + 12 * t
            for y, x in zip(*np.nonzero(STREAK[:, :, 3])):
                xx = x0 + x + ox
                if 1 <= xx < W - 1:
                    blend(out, my + y + oy + b, xx, STREAK[y, x], int(STREAK[y, x, 3] * a))
            head = x0 + STREAK.shape[1] + ox
            if head < W - 2 and t < 2:
                for yy in range(STREAK.shape[0]):
                    out[my + yy + oy + b, head] = rgb('2a2a2a')
        if t < 2:
            muzzle_flash(out, mx + ox, my + oy + b, 2 - t, 1)

    elif V in ('nero', 'normalnero'):
        hang = int(round(2 * (0.5 - 0.5 * math.cos(2 * math.pi * i / 24))))
        A = C['hang']
        if V == 'normalnero':
            sw = math.sin(2 * math.pi * i / 24 + 1.0)
            dx_fn = lambda x, y: (int(round(sw * min(1.0, (y - 36) / 24) * (1 if x < 30 else -1)))
                                  if LOWER_ARMS[y, x] else 0)
        else:
            dx_fn = None
        put_sprite(out, s, ox, oy, dy_fn=lambda x, y: hang if y >= A else 0, dx_fn=dx_fn)
        for dd in range(hang):                           # Schläuche oben dehnen
            y = A - 1
            for x in range(SW):
                if s[y, x, 3] and s[y + 1, x, 3] and not out[y + 1 + dd + oy, x + ox, 3]:
                    out[y + 1 + dd + oy, x + ox] = s[y, x]
        if V == 'nero':                                  # Roboterarme heben und senken sich
            lift = 0.09 * math.sin(2 * math.pi * i / 24 + 0.8)
            am = ARMS[:, :, 3] > 0
            wl = np.zeros((H, W, 4), int)
            shear_flap(ARMS, am & (_xs < 30), 27, -1, lift, 1.0, wl, offset=(ox, oy + hang), curve=1.2)
            shear_flap(ARMS, am & (_xs >= 62), 64, 1, lift, 1.0, wl, offset=(ox, oy + hang), curve=1.2)
            rest = am & (_xs >= 30) & (_xs < 62)
            for y, x in zip(*np.nonzero(rest)):
                wl[y + oy + hang, x + ox] = ARMS[y, x]
            m = wl[:, :, 3] > 0
            out[m] = wl[m]

    elif V == 'orthos':
        sy = 1 + 0.05 * math.sin(2 * math.pi * i / 24)
        base = SH - 1
        for yy in range(H):
            y = int(round(base - (base - (yy - oy)) / sy))
            if 0 <= y < SH:
                for x in range(SW):
                    if s[y, x, 3]:
                        out[yy, x + ox] = s[y, x]

    elif V == 'luna':
        hv = hover(i)
        body_dx = int(round(0.8 * math.sin(2 * math.pi * i / N)))
        inner = INNER.copy()
        if st:                                           # Augen (dunkelrot) schließen
            for x in (7, 10):
                inner[10, x] = rgb('ee9c7b')
                if st == 'zu':
                    inner[11, x] = BLACK
        wingless = inner.copy()
        wingless[WING_M] = 0

        def ldx(x, y):
            if y <= 6:                                   # Haare wehen
                return int(round(0.9 * (6 - y) / 6 * (math.sin(2 * math.pi * 2 * i / N - 0.5 * y) - math.sin(-0.5 * y))))
            if y >= 14:                                  # Körper wiegt sich
                return body_dx if y >= 16 else int(round(body_dx * 0.5))
            return 0
        fig = np.zeros((H, W, 4), int)
        put_sprite(fig, wingless, ox, oy + hv, dx_fn=ldx)
        lift = 0.5 * math.sin(2 * math.pi * 3 * i / N)
        shear_flap(inner, WING_M & (_xs <= 5), 7, -1, lift, 1.0, fig, offset=(ox, oy + hv))
        shear_flap(inner, WING_M & (_xs >= 12), 10, 1, lift, 1.0, fig, offset=(ox, oy + hv))
        fill_pinholes(fig)
        ring = ring8(fig[:, :, 3] > 0)
        out[:] = fig
        out[ring] = OUTLINE

    elif V == 'tsuki':
        hv = hover(i)
        w = 2 * math.pi / N
        g = GLOW.copy()
        f = 0.5 - 0.5 * math.cos(2 * w * i)
        g[_op & ~(MASK[:, :, 3] > 0), :3] = np.clip(g[_op & ~(MASK[:, :, 3] > 0), :3] + 10 * f, 0, 255)

        def tdx(x, y):
            if y <= 17 and not (MASK[y, x, 3] > 0):      # Haare wehen (oben stärker)
                return int(round(1.3 * (17 - y) / 17 * (math.sin(2 * w * i - 0.35 * y) - math.sin(-0.35 * y))))
            if LEGS[y, x]:                               # Beine schwingen seitwärts
                side = 1 if x < 16 else -1
                return int(round(1.4 * (y - 34) / 12 * math.sin(2 * w * i + (0 if side > 0 else math.pi))))
            return 0

        def tdy(x, y):
            if ARMS_UP[y, x]:
                d = abs(x - 15.5) / 16
                return -int(round(2.2 * d * math.sin(2 * w * i)))
            if ARMS_LO[y, x]:
                d = abs(x - 15.5) / 16
                return int(round(2.2 * d * math.sin(2 * w * i)))
            return 0
        fig = np.zeros((H, W, 4), int)
        put_sprite(fig, g, ox, oy + hv, dy_fn=tdy, dx_fn=tdx)
        fill_pinholes(fig)
        op = fig[:, :, 3] > 0
        d2 = cv2.distanceTransform((~op).astype(np.uint8), cv2.DIST_L2, 3)
        for r, a in ((1.0, 110), (2.0, 55), (3.0, 22)):
            ringm = (~op) & (d2 <= r + 0.01) & (out[:, :, 3] == 0)
            out[ringm] = [255, 248, 200, int(a * (0.8 + 0.4 * f))]
        out[op] = fig[op]

    else:
        put_sprite(out, s, ox, oy, dy_fn)

    # Knie: Zeile über dem Knie dehnen (nur über den Beinen)
    if b < 0 and KNEE < SH:
        y = KNEE - 1
        for x in range(SW):
            if s[y, x, 3] and s[KNEE, x, 3] and not out[y + oy, x + ox, 3] and not (V == 'koperniko' and x >= 16):
                out[y + oy, x + ox] = s[y, x]
    if V not in ('luna', 'tsuki'):
        fill_pinholes(out)
    if V in ('kent', 'heinz'):
        for (px, py), c in sparkle_pixels(i, N, [(LENS_STAR[0] + ox, LENS_STAR[1] + oy + b, 22)],
                                          rgb('e8f4ff'), rgb('ffffff')).items():
            if 0 < px < W - 1 and 0 < py < H - 1:
                out[py, px] = c
    if 'glint' in C:
        gx, gy, start, (t0, t1) = C['glint']
        gb = 0 if V == 'koperniko' else b
        for (px, py), c in sparkle_pixels(i, N, [(gx + ox, gy + oy + gb, start)], rgb(t0), rgb(t1)).items():
            assert 0 < px < W - 1 and 0 < py < H - 1, 'Glanz am Rand'
            out[py, px] = c
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'{V}_idle_{tag}', frames, ms, scale=6, check_edges=True)
