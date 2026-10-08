# -*- coding: utf-8 -*-
"""Skin „Contract-bound Orthos“ (Kyubey aus Madoka Magica) für Orthos, the Loyal Guard Dog — Sprite + Idle-Animation.

Der Sprite wird aus Formen zusammengesetzt (Rückwärts-Malerei, jede Form bekommt 1 px schwarze Kontur) und
dieselbe Zeichenfunktion erzeugt auch die Animation: Frame 0 (alle Parameter 0) IST der Sprite.

* Ein Kopf ist Kyubey (weiß, Katzenohren, große rote Augen), der andere steckt unter einer Papiertüte
  (mit Guckloch-Augen, rot glimmend). Kein Feuer an den Köpfen.
* Lange Ohren hängen seitlich herab (rosa Fransen mit roten Tupfen), die goldenen Reifen umschließen sie.
* Kyubeys roter Kreis sitzt am Rücken, hinten ein buschiger Schwanz, lange Beine.
Animation: Ohren und Schwanz schwingen als Wellen (die Reifen wandern am Ohr mit), die Tüte raschelt und die
Guckloch-Augen glimmen, Kyubey blinzelt, der Oberkörper federt leicht auf den Beinen.
Aufruf (aus scripts/hero-animations):  python3 contract_orthos.py final 90
"""
import math
import sys
import numpy as np
from PIL import Image
from anim_common import rgb, save_outputs

N = 48
SW, SH = 22, 28                                     # Sprite-Leinwand
PL, PR, PT, PB = 4, 4, 3, 2                         # Rand in der Animation
H, W = SH + PT + PB, SW + PL + PR

C = {k: rgb(v) for k, v in dict(
    O='0e0e0e', W='f6f8f8', w='d9e4e5', v='aebfc3', P='f0a0ac', R='b01030', E='d0103c', e='ff8098',
    Y='e8b830', y='a87818', M='b01030',
    B='c89860', b='e0b880', n='9a6a38', K='000000', r='ff2020').items()}


def ys_xs():
    return np.mgrid[0:SH, 0:SW]


Y_, X_ = ys_xs()


def ellipse(cx, cy, rx, ry):
    return ((X_ + 0.5 - cx) / rx) ** 2 + ((Y_ + 0.5 - cy) / ry) ** 2 <= 1.0


def rect(x0, y0, x1, y1):
    return (X_ >= x0) & (X_ < x1) & (Y_ >= y0) & (Y_ < y1)


def poly(pts):
    """Gefülltes Polygon (gerade Kanten) über Scanlinien."""
    m = np.zeros((SH, SW), bool)
    for y in range(SH):
        xs = []
        yc = y + 0.5
        for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]):
            if (y0 <= yc < y1) or (y1 <= yc < y0):
                xs.append(x0 + (yc - y0) * (x1 - x0) / (y1 - y0))
        xs.sort()
        for a, b in zip(xs[::2], xs[1::2]):
            m[y, (X_[y] + 0.5 >= a) & (X_[y] + 0.5 <= b)] = True
    return m


def strand(pts, radii):
    """Dicke Linie durch Punkte (Radius pro Punkt, dazwischen interpoliert)."""
    m = np.zeros((SH, SW), bool)
    n = 40
    for (p, rp), (q, rq) in zip(zip(pts, radii), zip(pts[1:], radii[1:])):
        for t in np.linspace(0, 1, n):
            x, y, r = p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, rp + (rq - rp) * t
            m |= (X_ + 0.5 - x) ** 2 + (Y_ + 0.5 - y) ** 2 <= r * r
    return m


def paint(img, mask, color_fn, outline=True):
    if outline:
        ring = np.zeros_like(mask)
        ring[1:, :] |= mask[:-1, :]; ring[:-1, :] |= mask[1:, :]
        ring[:, 1:] |= mask[:, :-1]; ring[:, :-1] |= mask[:, 1:]
        ring &= ~mask
        img[ring] = C['O']
    for y, x in zip(*np.nonzero(mask)):
        img[y, x] = color_fn(x, y, mask)


def white(x, y, m):
    """Fell: weiß, Schatten unten/rechts an der Kante."""
    def out(a, b):
        return not (0 <= b < SH and 0 <= a < SW and m[b, a])
    if out(x + 1, y) and out(x, y + 1):
        return C['v']
    if out(x + 1, y + 1) or out(x, y + 1) or out(x + 1, y):
        return C['w']
    return C['W']


def shift(m, dx=0, dy=0):
    out = np.zeros_like(m)
    ys, xs = np.nonzero(m)
    ys, xs = ys + dy, xs + dx
    ok = (ys >= 0) & (ys < SH) & (xs >= 0) & (xs < SW)
    out[ys[ok], xs[ok]] = True
    return out


def sway(i, k, amp, cycles, ph):
    """Seitliche Welle am Punkt k (0..1 entlang des Teils); 0 in Frame 0."""
    w = 2 * math.pi * cycles * i / N
    return amp * k ** 1.2 * (math.sin(w - 2.0 * k + ph) - math.sin(-2.0 * k + ph))


def curve(base_pts, i, amp, cycles, ph):
    n = len(base_pts) - 1
    return [(x + sway(i, j / n, amp, cycles, ph), y) for j, (x, y) in enumerate(base_pts)]


# --- Teile (Ruhepose) --------------------------------------------------------
EAR_L = [(2.4, 6.5), (1.6, 10.5), (1.3, 15.0), (1.5, 19.5)]
EAR_R = [(9.6, 8.0), (9.3, 12.0), (9.1, 15.5), (9.4, 19.5)]
TAIL = [(12.5, 23.0), (15.5, 23.5), (18.0, 21.0), (18.8, 17.0), (17.8, 13.5)]
TAIL_R = [2.2, 2.1, 1.7, 1.3, 0.7]


def render(i):
    """Zeichnet Frame i (Ruhepose bei i=0) auf die Sprite-Leinwand."""
    img = np.zeros((SH, SW, 4), int)
    bob = -int(round(0.5 + 0.5 * math.sin(2 * math.pi * i / 24))) if i else 0     # Oberkörper federt 0/1 px nach oben
    kb = bob
    blink = i in (14, 15, 16, 17, 38, 39, 40, 41)
    # Schwanz (hinten), wedelt
    tp = curve(TAIL, i, 2.4, 2, 0.4)
    paint(img, strand(tp, TAIL_R), white)
    # Beine (lang), unten fest
    for x0, x1 in ((6, 9), (11, 14)):
        paint(img, rect(x0, 18 + bob, x1, SH - 1), white)
        paint(img, rect(x0 - 1, SH - 3, x1 + 1, SH - 1), white)
    # Rumpf
    torso = ellipse(9.8, 16.0 + bob, 4.4, 4.9)
    paint(img, torso, white)
    # Kyubeys roter Kreis am RÜCKEN (rechte Rumpfseite, zum Schwanz hin)
    mx, my = 10, 13 + bob
    for dx, dy in ((1, 0), (2, 0), (0, 1), (3, 1), (0, 2), (3, 2), (1, 3), (2, 3)):
        if 0 <= my + dy < SH and 0 <= mx + dx < SW and torso[my + dy, mx + dx]:
            img[my + dy, mx + dx] = C['M']
    # lange Ohren (vor dem Rumpf), Spitzen rosa mit roten Tupfen
    ears = []
    for pts, amp, ph in ((EAR_L, 1.9, 0.0), (EAR_R, 1.5, 1.7)):
        cp = [(x, y + bob) for x, y in curve(pts, i, amp, 2, ph)]
        ears.append(cp)
        paint(img, strand(cp, [1.2, 1.2, 1.3, 1.5]), white)
        tx, ty = int(round(cp[-1][0])), int(round(cp[-1][1]))
        for dy in range(-3, 1):
            for dx in (-1, 0, 1):
                y, x = ty + dy, tx + dx
                if 0 <= y < SH and 0 <= x < SW and img[y, x][3] and tuple(img[y, x]) != C['O']:
                    img[y, x] = C['P']
        if 0 <= ty - 1 < SH and 0 <= tx < SW:
            img[ty - 1, tx] = C['R']
    # Papiertüten-Kopf (rechts)
    flap = int(round(math.sin(2 * math.pi * 3 * i / N))) if i else 0
    bag = rect(10, 3 + kb, 18, 12 + kb)
    for (x0, y0, x1, y1) in ((11, 1, 13, 3), (16, 0, 18, 3), (13, 2, 16, 3), (13 + flap, 0, 15 + flap, 2)):
        bag |= rect(x0, y0 + kb, x1, y1 + kb)
    def bagc(x, y, m):
        if (x in (12, 15, 17) and y > 8 + kb) or y == 11 + kb:
            return C['n']
        if x <= 11:
            return C['b']
        return C['B']
    paint(img, bag, bagc)
    glow = (i // 2) % 4
    for hx in (11, 15):
        img[6 + kb, hx] = C['K']; img[6 + kb, hx + 1] = C['K']; img[7 + kb, hx] = C['K']
        img[7 + kb, hx + 1] = C['r'] if glow in (0, 1) else C['K'] if glow == 2 else C['E']
    # Kyubey-Kopf (links)
    paint(img, poly([(1.4, 6.0 + kb), (2.0, 1.4 + kb), (5.0, 4.4 + kb)]), white)           # Katzenohr links
    paint(img, poly([(9.6, 6.0 + kb), (9.0, 1.4 + kb), (6.0, 4.4 + kb)]), white)         # Katzenohr rechts
    paint(img, ellipse(5.5, 8.0 + kb, 4.3, 4.0), white)
    for (x, y) in ((3, 3 + kb), (3, 4 + kb), (8, 3 + kb), (8, 4 + kb)):
        img[y, x] = C['P']
    for xx in (2, 6):
        for (dx, dy, c) in ((0, 0, 'e'), (1, 0, 'E'), (0, 1, 'E'), (1, 1, 'E')):
            if blink:
                img[7 + kb, xx + dx] = C['O']
                img[6 + kb, xx + dx] = C['W']
            else:
                img[6 + kb + dy, xx + dx] = C[c]
    img[9 + kb, 5] = C['O']; img[9 + kb, 6] = C['O']; img[10 + kb, 4] = C['O']; img[10 + kb, 7] = C['O']   # ω-Mund
    # Goldene Reifen UM die Ohren (Rückseite dunkel oben, Vorderseite hell unten)
    for cp in ears:
        cx, cy = int(round(cp[2][0])), int(round(cp[2][1]))
        for dx in (-2, -1, 0, 1, 2):
            if 0 <= cx + dx < SW:
                if abs(dx) == 2:
                    img[cy, cx + dx] = C['Y']; img[cy + 1, cx + dx] = C['Y']
                else:
                    img[cy + 1, cx + dx] = C['Y'] if dx == 0 else C['y']
                    img[cy - 1, cx + dx] = C['y']
    return img


def canvas_frame(i):
    s = render(i)
    out = np.zeros((H, W, 4), int)
    out[PT:PT + SH, PL:PL + SW] = s
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    s0 = render(0)
    Image.fromarray(s0.astype(np.uint8)).save('src/contract-bound-orthos.png')
    big = Image.fromarray(s0.astype(np.uint8))
    bg = Image.new('RGBA', big.size, (110, 110, 110, 255)); bg.alpha_composite(big)
    bg.resize((big.width * 12, big.height * 12), Image.NEAREST).save('/tmp/claude-0/-home-user-PixelParties/04e3aa12-4e29-5cc1-93c8-60d55541b155/scratchpad/orthos_new.png')
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    frames = [canvas_frame(i) for i in range(N)]
    save_outputs(f'contract_orthos_idle_{tag}', frames, ms, scale=8, check_edges=True)
