# -*- coding: utf-8 -*-
"""Idle-Animationen für die MotiveJapan-Heroes.

Aufruf: python3 japan.py <tag> [ms] <variante>

Frame 0 ist immer die Ruhepose. Die Idej-Heroes (Nobunakin, Shoguwana, Todugawin) sind
Projektionen (hologram.py): halb durchsichtig, mit wandernder Abtastzeile, ab und zu flackernd.

* champion:  Champion, the Stormbringer stützt sich auf sein in den Boden gerammtes Schwert; um
             ihn peitscht Sturmregen diagonal von links oben nach rechts unten, sein Haar
             flattert wild im Sturm (böig, Strähne für Strähne nach rechts).
* nobunakin: Idej Lord Nobunakin federt und blinzelt; das Laserschwert summt (der Kern flackert,
             ein roter Schein liegt um die Klinge), fährt zischend in den Griff ein und wieder aus.
* shoguwana: Idej Lord Shoguwana meditiert auf der Fußspitze und wippt sacht hin und her (Scherung
             um die Zehe); Haarknoten und Haarnadeln wiegen sich in sanftem Wind.
* todugawin: Idej Lord Todugawin sitzt im Schneidersitz und atmet ruhig; die Stirnbandenden
             flattern.
* yukana:    Yukana, the Scholar on the Run weint: aus den Augen rinnen immer wieder Tränen (die
             türkisen Streifen) und tropfen ab, sie schluchzt leise; über die Brille huscht ein
             Glanzlicht, dann blitzt ein Stern.
"""
import math
import os
import sys
import numpy as np
from PIL import Image
from anim_common import rgb, save_outputs, BOUNCE12, sparkle_pixels, draw_bounce, ring8
import particles
from hologram import projection

N = 48
OUT = os.environ.get('JP_OUT', '.')
BLINK = {14: 'halb', 15: 'zu', 16: 'zu', 17: 'halb', 38: 'halb', 39: 'zu', 40: 'zu', 41: 'halb'}
B24 = [BOUNCE12[(k // 2) % 12] for k in range(24)]  # gemächlich: ein Federn je 24 Frames

V_ = {
    'champion': dict(slug='champion-the-stormbringer', knee=17, pads=(3, 6, 4, 2)),
    'nobunakin': dict(slug='idej-lord-nobunakin', knee=29, pads=(2, 2, 2, 1), idej=True,
                      blink={'halb': [((6, 20), '8a0000'), ((10, 20), '8a0000')],
                             'zu': [((6, 20), '000000'), ((10, 20), '000000'),
                                    ((5, 20), '000000'), ((9, 20), '000000')]}),
    'shoguwana': dict(slug='idej-lord-shoguwana', pads=(3, 3, 2, 1), idej=True),
    'todugawin': dict(slug='idej-lord-todugawin', knee=13, pads=(1, 1, 3, 1), idej=True,
                      blink={'halb': [((7, 7), '5d2694'), ((10, 7), '5d2694')],
                             'zu': [((7, 7), '7d33c7'), ((10, 7), '7d33c7')]}),
    'yukana': dict(slug='yukana-the-scholar-on-the-run', knee=20, pads=(7, 1, 8, 3)),
}
V = next((v for v in sys.argv[2:] if v in V_), 'champion')
C = V_[V]
SLUG = C['slug']


def load(part=None):
    n = f'src/{SLUG}-{part}.png' if part else f'src/{SLUG}.png'
    try:
        return np.array(Image.open(n).convert('RGBA')).astype(int)
    except FileNotFoundError:
        return None


SRC = load('body') if load('body') is not None else load()
SH, SW = SRC.shape[:2]
KNEE = C.get('knee', SH)
PL, PR, PT, PB = C['pads']
H, W = SH + PT + PB, SW + PL + PR


def hexc(c):
    return '%02x%02x%02x' % tuple(int(v) for v in c[:3])


def blink(s, i):
    st = BLINK.get(i)
    if st and 'blink' in C:
        for (x, y), c in C['blink'][st]:
            s[y, x] = rgb(c)


def dot(out, x, y, c):
    if 0 <= y < out.shape[0] and 0 <= x < out.shape[1]:
        out[y, x] = c


def clamp_chain(vals, lo=None):
    """Aufeinanderfolgende Versätze höchstens um 1 springen lassen (die Kontur reißt nicht)."""
    out = [vals[0]]
    for v in vals[1:]:
        v = max(out[-1] - 1, min(out[-1] + 1, v))
        out.append(v if lo is None else max(lo, v))
    return out


# ---------------------------------------------------------------- Champion
RAIN = None


ARM = ([0] * 5 + [-1] * 7 + [0] * 12) * 2             # der ausgestreckte Arm stemmt sich leicht gegen den Wind
VISOR = {'262626', '808080', '4d4d4d', '666666'}


def champion_fig(i):
    body, sword, hand = SRC.copy(), load('sword'), load('hand')
    t = 2 * math.pi * i / N
    for k, st in enumerate((8, 32)):                    # Glanzlicht über das Visier
        g = i - st
        if 0 <= g < 6:
            for y in range(7, 10):
                for x in range(8, 19):
                    if body[y, x, 3] and hexc(body[y, x]) in VISOR:
                        d = (x - y) - (-1 + 2.4 * g)
                        if abs(d) < 0.8:
                            body[y, x] = rgb('f4f4f4')
                        elif -2 < d < 0:
                            body[y, x] = rgb('b0b0b0')
    gust = 0.5 - 0.5 * math.cos(2 * t) + 0.25 * (0.5 - 0.5 * math.cos(6 * t))   # zwei Böen, dazwischen Flattern
    # Haar (über dem Visier, Zeilen 0–6): je Zeile nach rechts, oben am weitesten, unruhig
    raw = [0] * 7
    for y in range(6, -1, -1):
        wild = 0.9 * math.sin(2.3 * y + 10 * t) + 0.6 * math.sin(1.1 * y - 14 * t)
        raw[y] = round(gust * ((6 - y) / 6 * 3.2 + wild * (6 - y) / 6))
    dxs = clamp_chain([raw[y] for y in range(6, -1, -1)], lo=0)[::-1]
    fig = body.copy()                                   # Körper und Schwertarm federn gemeinsam über dem Knie,
    m = hand[:, :, 3] > 0                               # die Hand am Knauf bleibt, das Schwert steckt fest
    fig[m] = hand[m]
    b = B24[i % 24]
    arm = ARM[i % 48]
    out = np.zeros((H, W, 4), int)
    for y, x in zip(*np.nonzero(sword[:, :, 3])):
        out[y + PT, x + PL] = sword[y, x]
    for y, x in zip(*np.nonzero(fig[:, :, 3])):
        dy = b if y < KNEE else 0
        if x <= 7 and 10 <= y <= 14:
            dy += arm
        dx = dxs[y] if y <= 6 and not m[y, x] else 0
        out[y + PT + dy, x + PL + dx] = fig[y, x]
    if b < 0:                                           # Naht über dem Knie schließen
        y = KNEE - 1
        for x in range(SW):
            if fig[y, x, 3] and fig[KNEE, x, 3] and not out[y + PT, x + PL, 3]:
                out[y + PT, x + PL] = fig[y, x]
    for st in (13, 37):                                 # Stern auf dem Visier
        for (x, y), c in sparkle_pixels(i, N, [(15 + PL, 8 + PT + b, st)], rgb('d8d8d8'), rgb('a8a8a8')).items():
            dot(out, x, y, c)
    return out


def f_champion(i):
    global RAIN
    if RAIN is None:
        RAIN = particles.rain([champion_fig(k) for k in range(N)], 110, seed=7, vx=1.6, tail=0.6,
                              vy=(2.4, 3.0), storm=True, length=3)
    out = champion_fig(i)
    particles.draw(out, RAIN, i, N)
    return out


# ---------------------------------------------------------------- Nobunakin
BLADE_TOP = 20                                          # Klinge = Schwertpixel bis Zeile 20, darunter Stichblatt
# Einfahren 18–22, aus 23–29, Ausfahren 30–34 (Versatz der Klinge nach unten, am Stichblatt abgeschnitten)
SLIDE = {18: 3, 19: 8, 20: 13, 21: 18, 22: 21}
SLIDE.update({k: 21 for k in range(23, 30)})
SLIDE.update({30: 17, 31: 12, 32: 7, 33: 2, 34: 0})


def f_nobunakin(i):
    s = SRC.copy()
    blink(s, i)
    sword, hand = load('sword'), load('hand')
    b = B24[i % 24]
    out = np.zeros((H, W, 4), int)
    draw_bounce(out, s, b, KNEE, PT, PL)
    off = SLIDE.get(i, 0)
    blade = np.zeros_like(sword)
    hilt = sword.copy()
    hilt[:BLADE_TOP + 1] = 0
    for y, x in zip(*np.nonzero(sword[:BLADE_TOP + 1, :, 3])):
        if y + off <= BLADE_TOP:
            blade[y + off, x] = sword[y, x]
    hum = 0.5 + 0.5 * math.sin(2 * math.pi * 6 * i / N)
    if off < 21:                                        # roter Schein um die Klinge
        m = blade[:, :, 3] > 0
        for y, x in zip(*np.nonzero(m)):
            for dx in (-1, 1):
                xx = x + dx
                if 0 <= xx < SW and not m[y, xx] and not hilt[y, xx, 3]:
                    oy, ox = y + PT + b, xx + PL
                    if not out[oy, ox, 3]:
                        out[oy, ox] = rgb('ff3030', int(70 + 60 * hum))
        for y, x in zip(*np.nonzero(m)):                # der Kern flackert
            if hexc(blade[y, x]) in ('ebe9ec', 'ededeb'):
                blade[y, x] = rgb('ffffff' if hum > 0.6 else 'ebe9ec')
    for part in (hand, hilt, blade):
        for y, x in zip(*np.nonzero(part[:, :, 3])):
            out[y + PT + b, x + PL] = part[y, x]
    if i in (22, 30):                                   # Funke am Griff beim Ein-/Ausschalten
        for (x, y), c in sparkle_pixels(2, N, [(17 + PL, BLADE_TOP + PT + b, 0)], rgb('ffd0d0'), rgb('ff6060')).items():
            dot(out, x, y, c)
    return out


# ---------------------------------------------------------------- Shoguwana
def f_shoguwana(i):
    s = SRC
    t = 2 * math.pi * i / N
    toe = SH - 1
    lean = 1.6 * math.sin(2 * t)                        # sachtes Wippen um die Zehe
    wind = 0.5 - 0.5 * math.cos(3 * t)                  # sanfter Wind von links
    out = np.zeros((H, W, 4), int)
    for y, x in zip(*np.nonzero(s[:, :, 3])):
        dx = round(lean * (toe - y) / toe)
        dy = 0
        if y <= 2 and (x <= 3 or x >= SW - 4):          # obere Haarnadeln: Spitzen wehen
            dx += round(wind * 1.2 * (3 - y) / 3)
        if 4 <= y <= 6 and (x <= 1 or x >= SW - 2):     # seitliche Haarnadeln: Spitzen wippen
            dy = round(0.9 * wind * math.sin(4 * t + (0 if x <= 1 else 1.5)))
        if y == 3 and 7 <= x <= 10:                     # Haarknoten
            dx += round(0.8 * wind)
        out[y + PT + dy, x + PL + dx] = s[y, x]
    return out


# ---------------------------------------------------------------- Todugawin
def f_todugawin(i):
    s = SRC.copy()
    blink(s, i)
    t = 2 * math.pi * i / N
    b = [0, 0, 0, 0, 0, -1, -1, -1, -1, -1, -1, -1, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0][i % 24]  # ruhiger Atem
    body = s.copy()
    tail = np.zeros_like(s)
    sel = (np.arange(SW)[None, :] <= 3) & (np.arange(SH)[:, None] <= 8) & (s[:, :, 3] > 0)
    tail[sel] = s[sel]
    body[sel] = 0
    out = np.zeros((H, W, 4), int)
    draw_bounce(out, body, b, KNEE, PT, PL)
    dys = clamp_chain([round(1.4 * (3 - x) / 3 * (math.sin(4 * t - 0.9 * (3 - x)) - math.sin(-0.9 * (3 - x))))
                       for x in range(3, -1, -1)])[::-1]
    for y, x in zip(*np.nonzero(tail[:, :, 3])):
        out[y + PT + b + dys[x], x + PL] = tail[y, x]
    return out


# ---------------------------------------------------------------- Yukana
TEAR = ('e6ffff', 'b8ffff')
UNDER = {(10, 10): 'f6bd98', (10, 11): '311700', (16, 10): 'f6bd98', (16, 11): '311700'}
LENS = [(10, 8), (11, 8), (10, 9), (11, 9), (14, 8), (15, 8), (14, 9), (15, 9)]


def tear(s, x, age):
    """Träne an Spalte x: quillt unter dem Auge hervor, rinnt herab und tropft ab (Alter 0–11)."""
    st = {0: [], 1: [(10, 0)], 2: [(10, 0)], 3: [(10, 0), (11, 1)], 4: [(10, 0), (11, 1)],
          5: [(10, 0), (11, 1)], 6: [(10, 0), (11, 1)], 7: [(10, 1), (11, 1)], 8: [(11, 1)],
          9: [(12, 1)], 10: [(12, 1)], 11: []}.get(age, [])
    for y, c in st:
        s[y, x] = rgb(TEAR[c])


STAFF = None
GREEN = ('eaffea', '9dff8a', '4fd04a')
STAFF_STARS = [(-4, 3, 4), (-4, 13, 17), (-3, -2, 28), (-4, 20, 40)]
MOTES = [(1, 0, 0.0), (3, 6, 2.1), (2, 12, 4.0), (1, 18, 1.2), (3, 24, 5.1), (2, 30, 3.3), (1, 36, 0.7), (3, 42, 2.6)]


def staff_mask():
    global STAFF
    if STAFF is None:
        s = SRC
        g = (s[:, :, 1] > s[:, :, 0] + 30) & (s[:, :, 1] > s[:, :, 2]) & (s[:, :, 3] > 0)
        g[:, 6:] = False
        STAFF = g
    return STAFF


GLOW_SRC = [((2.5, 4.0), 0.0, 6.0), ((1.5, 12.0), 2.1, 4.8), ((2.5, 18.5), 4.2, 4.2)]   # (Lichtpunkt, Phase, Radius)


def staff_glow(out, i, b):
    """Grünes Licht strahlt von drei Punkten der Ranke aus: runde, nach außen abfallende Lichthöfe
    (drei Helligkeitsstufen), die versetzt pulsieren und hinter der Figur liegen; die Ranke selbst
    hellt im Takt auf."""
    light = np.zeros((SH + 8, SW + 8))
    t = 2 * math.pi * 2 * i / N
    for (cx, cy), ph, r0 in GLOW_SRC:
        p = 0.5 - 0.5 * math.cos(t + ph) if i else 0.0
        r = r0 * (0.8 + 0.3 * p)
        for y in range(int(cy - r) - 1, int(cy + r) + 2):
            for x in range(int(cx - r) - 1, int(cx + r) + 2):
                d = math.hypot(x - cx, y - cy)
                if d < r:
                    light[y + 4, x + 4] = max(light[y + 4, x + 4], (1 - d / r) * (0.7 + 0.3 * p))
    for y, x in zip(*np.nonzero(light > 0.12)):
        sy, sx = y - 4, x - 4
        if 0 <= sy < SH and 0 <= sx < SW and SRC[sy, sx, 3]:
            continue
        v = light[y, x]
        a, c = (150, 'b8ffa0') if v > 0.55 else ((90, '8dff6a') if v > 0.3 else (40, '6ae04e'))
        dot(out, sx + PL, sy + PT + b, rgb(c, a))


def staff_magic(out, i, b):
    """Funkelnde Sterne neben dem Stab und aufsteigende Lichtfunken über der Spitze."""
    for x0, y0, st in STAFF_STARS:
        for (x, y), c in sparkle_pixels(i, N, [(x0 + PL, y0 + PT + b, st)], rgb(GREEN[1]), rgb(GREEN[2])).items():
            dot(out, x, y, c)
    for x0, st, ph in MOTES:
        a = (i - st) % N
        if a >= 12:
            continue
        x = x0 + PL + round(0.8 * math.sin(0.7 * a + ph))
        y = PT + b - 1 - a // 2
        dot(out, x, y, rgb(GREEN[min(2, a // 4)], int(255 * (1 - a / 14))))


def f_yukana(i):
    s = SRC.copy()
    for (x, y), c in UNDER.items():
        s[y, x] = rgb(c)
    for x, ph in ((10, 4), (16, 6)):                   # Frame 0 zeigt beide Tränen wie im Original
        a = (i + ph) % 24
        tear(s, x, a if a < 12 else 0)
    sweep = i - 26                                      # Glanzlicht über die Brille
    if 0 <= sweep < 5:
        for x, y in LENS:
            d = (x + y) - (16 + 2.5 * sweep) + (4 if x >= 14 else 0)
            if abs(d) < 0.8:
                s[y, x] = rgb('dff4ff')
    pulse = 0.5 - 0.5 * math.cos(2 * math.pi * 2 * i / N)
    for y, x in zip(*np.nonzero(staff_mask())):         # die Ranke leuchtet im Takt auf
        c = s[y, x]
        s[y, x] = [int(c[k] + (255 - c[k]) * 0.35 * pulse * (0.4 if k != 1 else 1)) for k in range(3)] + [int(c[3])]
    b = B24[i % 24]                                     # ruhiger Atem
    out = np.zeros((H, W, 4), int)
    staff_glow(out, i, b)
    draw_bounce(out, s, b, KNEE, PT, PL)
    staff_magic(out, i, b)
    for (x, y), c in sparkle_pixels(i, N, [(15 + PL, 8 + PT, 30)], rgb('dff4ff'), rgb('9fd8ff')).items():
        dot(out, x, y, c)
    return out


FRAME = dict(champion=f_champion, nobunakin=f_nobunakin, shoguwana=f_shoguwana, todugawin=f_todugawin,
             yukana=f_yukana)


FLICKER = {'nobunakin': {11: 0.55, 12: 0.8, 35: 0.5}, 'shoguwana': {7: 0.5, 26: 0.55, 27: 0.8},
           'todugawin': {19: 0.5, 20: 0.8, 43: 0.55}}
GLITCH = {'nobunakin': {11: 14, 35: 24}, 'shoguwana': {7: 9, 26: 18}, 'todugawin': {19: 8, 43: 14}}


def frame(i):
    out = FRAME[V](i)
    if C.get('idej'):
        out = projection(out, i, FLICKER[V], GLITCH[V], PT)
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'{OUT}/{V}_idle_{tag}', frames, ms, scale=6, check_edges=True)
