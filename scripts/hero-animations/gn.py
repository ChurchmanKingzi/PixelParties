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
    'andras': dict(slug='andras-the-human-weapon', part='body', pads=(9, 9, 3, 8),
                   lid=[((39, 11), 'f5ce88'), ((40, 11), 'f5ce88'), ((43, 11), 'f5ce88'), ((44, 11), 'f5ce88')],
                   line=[(39, 12), (40, 12), (43, 12), (44, 12)]),
    'friedhelm': dict(slug='friedhelm-the-misled-avenger', wires=((1, 8), (22, 8)), pads=(3, 3, 12, 3),
                      lid=[((9, 6), 'f5ce88'), ((10, 6), 'f5ce88')], line=[(9, 7), (10, 7)]),
    'titan': dict(slug='titan-slayer-friedhelm', wires=((1, 8), (22, 8)), pads=(3, 3, 12, 3),
                  lid=[((9, 7), 'f5ce88'), ((10, 7), 'f5ce88')], line=[(9, 8), (10, 8)]),
    'ftriffel': dict(slug='future-tech-gunslinger-riffel', part='body', knee=20, pads=(14, 3, 4, 2),
                     lid=[((28, 8), 'f6bd98'), ((29, 8), 'f6bd98')], line=[(28, 9), (29, 9)]),
    'ascriffel': dict(slug='riffel-master-of-the-ultimate-gun', knee=22, pads=(8, 8, 6, 6),
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
class FireJet:
    """Flammenwerfer als Partikel-Feuer: jedes Frame strömen aus der
    Rohrmündung zwei Flammenballen in Richtung der Original-Flamme (Achse per
    Hauptkomponente ihres Umrisses). Jeder Ballen wird im Flug größer und
    kühler und steigt etwas auf (Feuer steigt nach oben); ihre Hitzefelder
    ergeben die Farbe: weiß, gelb, orange und ganz außen rot-orange Zungen.
    Die Ballen starten schon in der Rohrmündung (verdecken sie teilweise).
    Alles läuft im 48er-Takt, der Loop ist nahtlos."""

    COLS = [(0.64, rgb('ffffff')), (0.4, rgb('ffff00')), (0.22, rgb('ffa718')), (0.11, rgb('f05a14'))]

    def __init__(self, mask, nozzle, seed):
        ys, xs = np.nonzero(mask)
        P_ = np.stack([xs, ys], 1).astype(float)
        c = P_.mean(0)
        d = np.linalg.svd(P_ - c)[2][0]
        if np.dot(d, c - np.array(nozzle)) < 0:
            d = -d
        self.d, self.n0 = d, np.array(nozzle, float) - d * 1.5
        self.puffs = []
        for e in range(N):
            for k in range(2):
                rng = np.random.default_rng(seed * 10007 + e * 31 + k)
                ang = rng.uniform(-0.13, 0.13)
                ca, sa = math.cos(ang), math.sin(ang)
                dv = np.array([d[0] * ca - d[1] * sa, d[0] * sa + d[1] * ca])
                self.puffs.append(dict(e=e, v=dv * rng.uniform(2.6, 3.2), life=rng.uniform(10.5, 13.0),
                                       r0=rng.uniform(1.0, 1.5), r1=rng.uniform(6.0, 8.5),
                                       buoy=rng.uniform(0.06, 0.13), h0=rng.uniform(0.95, 1.1),
                                       fl=rng.uniform(0, 6.28)))

    def render(self, out, i, ox, oy):
        H_, W_ = out.shape[:2]
        heat = np.zeros((H_, W_))
        for p in self.puffs:
            a = (i - p['e']) % N
            if a >= p['life']:
                continue
            u = a / p['life']
            cx = self.n0[0] + p['v'][0] * a + ox
            cy = self.n0[1] + p['v'][1] * a - 0.5 * p['buoy'] * a * a + oy
            r = p['r0'] + (p['r1'] - p['r0']) * u ** 0.8
            h = p['h0'] * (1 - u) ** 0.7 * (1 + 0.12 * math.sin(2 * math.pi * 6 * i / N + p['fl']))
            for y in range(max(0, int(cy - r) - 1), min(H_, int(cy + r) + 2)):
                for x in range(max(0, int(cx - r) - 1), min(W_, int(cx + r) + 2)):
                    q = ((x - cx) ** 2 + (y - cy) ** 2) / (r * r)
                    if q < 1:
                        heat[y, x] = max(heat[y, x], h * (1 - q) ** 0.6)
        for y, x in zip(*np.nonzero(heat > self.COLS[-1][0])):
            for th, c in self.COLS:
                if heat[y, x] > th:
                    out[y, x] = c
                    break


# --- Varianten-Vorbereitung ---------------------------------------------------
if V == 'andras':
    _fl = load('flames')
    _fm = _fl[:, :, 3] > 0
    JETS = [FireJet(_fm & (_xs < 42), (28.5, 22.5), 1), FireJet(_fm & (_xs >= 42), (SW - 1 - 28.5, 22.5), 2)]
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
    _bd = load('body')
    HORNS = []                                                  # Einschlagpunkte: Hörner (oben), nie das Gesicht
    for _y in range(31, 36):
        for _x in range(SW):
            if _bd[_y, _x, 3] and not _bd[_y - 1, _x, 3]:
                HORNS.append((_x, _y))
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


def fill_gaps(fig):
    """Leere Pixel mit deckenden Nachbarn oben und unten (oder links und
    rechts) schließen – die Farbe kommt vom oberen bzw. linken Nachbarn."""
    for _ in range(2):
        op = fig[:, :, 3] > 0
        fix = []
        for y in range(1, fig.shape[0] - 1):
            for x in range(1, fig.shape[1] - 1):
                if op[y, x]:
                    continue
                if op[y - 1, x] and op[y + 1, x]:
                    fix.append((y, x, fig[y - 1, x].copy()))
                elif op[y, x - 1] and op[y, x + 1]:
                    fix.append((y, x, fig[y, x - 1].copy()))
        for y, x, c in fix:
            fig[y, x] = c
    return fig


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
            j.render(out, i, ox, oy)

    elif V in ('friedhelm', 'titan'):
        sway = int(round(math.sin(2 * math.pi * i / 24)))
        ox += sway
        oy += BOUNCE12[i % 12]
        for (gx, gy), side in zip(C['wires'], (-1, 1)):
            # Aufhängung weit oben schwingt mit, das Seil biegt sich leicht durch
            ax = gx + side * 16 + PL + 3 * math.sin(2 * math.pi * i / 24 + side * 0.7)
            ay = -40
            x0, y0 = gx + ox, gy + oy
            bow = 1.6 * math.sin(2 * math.pi * i / 16 + side * 1.3)
            ln = math.hypot(ax - x0, ay - y0)
            nx_, ny_ = -(ay - y0) / ln, (ax - x0) / ln
            pts = []
            for k in range(41):
                u = k / 40
                bx = x0 + (ax - x0) * u + nx_ * bow * 4 * u * (1 - u)
                by = y0 + (ay - y0) * u + ny_ * bow * 4 * u * (1 - u)
                pts.append((bx, by))
            wire = []
            for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
                for p_ in line_px(x1, y1, x2, y2):
                    if not wire or wire[-1] != p_:
                        wire.append(p_)
            for x, y in wire:
                if 1 <= y < H - 1 and 1 <= x < W - 1 and not out[y, x, 3]:
                    a = 255 if y >= 5 else int(255 * (y - 1) / 4)
                    if a > 0:
                        out[y, x] = [0x9a, 0x9a, 0x9a, a]
        put_sprite(out, s, ox, oy)

    elif V == 'ftriffel':
        t = i % 6                                        # alle 6 Frames ein Schuss,
        front = (i // 6) % 2 == 1                        # abwechselnd hintere / vordere Pistole
        mzx = 23 if front else 15
        put_sprite(out, s, ox, oy, dy_fn)
        if t < 3:                                        # Kugeln über allem, nur vor der Mündung
            dx = 14 - 12 * t + (8 if front else 0)
            a = [1.0, 1.0, 0.45][t]
            for y, x in zip(*np.nonzero(BULLETS[:, :, 3])):
                xx = x + dx + ox
                if 1 <= xx < W - 1 and x + dx <= mzx:
                    blend(out, y + oy + b, xx, BULLETS[y, x], int(BULLETS[y, x, 3] * a))
        if t < 2:
            muzzle_flash(out, mzx + ox, 11 + oy + b, 2 - t, -1)

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
        for k in range(24):
            per, ph = 6 + (k % 3) * 3, (k * 5) % 6
            t = (i - ph) % per
            if t > 1:
                continue
            strike = (i - ph) // per
            rng = np.random.default_rng(1000 + 37 * k + 101 * strike)
            ang = 2 * math.pi * (k / 24) + rng.uniform(-0.25, 0.25)
            rad = rng.uniform(0.8, 1.15)
            cx = ox + SW / 2 + math.cos(ang) * (SW / 2 + 1) * rad
            cy = oy + SH / 2 + math.sin(ang) * (SH / 2 + 4) * rad
            ln = rng.uniform(3.5, 6.5)
            a2 = rng.uniform(0, math.pi)
            p0 = (cx - math.cos(a2) * ln, cy - math.sin(a2) * ln)
            p1 = (cx + math.cos(a2) * ln, cy + math.sin(a2) * ln)
            pix = zigzag(rng, p0, p1, 3.0, 3)
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
        # Blitzregen: viele einzelne Blitze schlagen von oben in die Hörner ein
        # (nie ins Gesicht), jeder zu eigener Zeit und in eigener Form
        mx, my, mw, mh = MAIN
        for k in range(14):
            per, ph = 6 + (k % 4) * 2, (k * 7) % 6
            t = (i - ph) % per
            if t > 2:
                continue
            strike = (i - ph) // per
            rng = np.random.default_rng(500 + 17 * k + 131 * strike)
            tx, ty = HORNS[int(rng.integers(len(HORNS)))]
            top = (rng.uniform(mx - 6, mx + mw + 6), rng.uniform(my, my + 4))
            end = (tx + ox, ty + oy + hv - 1)
            pix = zigzag(rng, (top[0] + ox, top[1] + oy), end, rng.uniform(3.0, 5.0), 4)
            reach = [0.6, 1.0, 1.0][t]
            y_end = (top[1] + oy) + (end[1] - top[1] - oy) * reach
            pix = [(x, y) for x, y in pix if y <= y_end]
            thick = rng.random() < 0.4
            draw_bolt(out, pix, 'ffffff', '428ad2', '3061ae' if thick else None, fade=[1.0, 1.0, 0.55][t])
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
        # Squash-and-Stretch nur am Körper (unter den Köpfen), die Köpfe samt
        # Flammen sitzen oben drauf und fahren mit
        NECK, base = 17, SH - 1
        sy = 1 + 0.12 * math.sin(2 * math.pi * i / 24)
        top_new = base - (base - NECK) * sy                # neue Lage der Halslinie
        shift = int(round(top_new - NECK))
        for yy in range(H):
            y_rel = yy - oy
            if y_rel >= NECK + shift:
                if y_rel > base:
                    continue
                y = max(NECK, int(round(base - (base - y_rel) / sy)))
            else:
                y = y_rel - shift
            if 0 <= y < SH:
                for x in range(SW):
                    if s[y, x, 3]:
                        out[yy, x + ox] = s[y, x]

    elif V == 'luna':
        hv = hover(i)
        body_dy = int(round(math.sin(2 * math.pi * i / 16)))
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
            return 0

        def ldy(x, y):                                   # Körper wippt auf und ab
            return body_dy if y >= 15 else 0
        fig = np.zeros((H, W, 4), int)
        put_sprite(fig, wingless, ox, oy + hv, dx_fn=ldx, dy_fn=ldy)
        if body_dy > 0:                                  # Lücke unter dem Hals schließen
            for x in range(SW):
                if wingless[14, x, 3] and wingless[15, x, 3] and not fig[15 + oy + hv, x + ox, 3]:
                    fig[15 + oy + hv, x + ox] = wingless[14, x]
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

        def tdy(x, y):                                   # an der Wurzel fest, zur Spitze stärker
            d = max(0.0, abs(x - 15.5) - 7) / 9
            if ARMS_UP[y, x]:
                return -int(round(2.0 * d * math.sin(2 * w * i)))
            if ARMS_LO[y, x]:
                return int(round(2.0 * d * math.sin(2 * w * i)))
            return 0
        fig = np.zeros((H, W, 4), int)
        put_sprite(fig, g, ox, oy + hv, dy_fn=tdy, dx_fn=tdx)
        fill_gaps(fig)
        op = fig[:, :, 3] > 0
        d2 = cv2.distanceTransform((~op).astype(np.uint8), cv2.DIST_L2, 3)
        for r, a in ((1.0, 110), (2.0, 55), (3.5, 22)):
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
