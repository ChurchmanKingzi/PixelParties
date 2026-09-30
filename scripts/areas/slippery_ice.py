# -*- coding: utf-8 -*-
"""Slippery Ice — Area-Grafiken aus der echten Karten-Vorlage (Motive.xcf).

Grundlage sind die Ebenen aus der GIMP-Arbeitsdatei (Repo PixelPartiesSprites,
Git LFS): der herausgezoomte Hintergrund („Ebene #109“, 309×240) und die
Rutsch-Sprites (Pinguin „Pengu“ / „Ebene #337“, Eisblock „Spikeblock“ /
„Ebene #335“ — je mit wenig und mit viel Schmierlinien). Nichts davon wird neu
gezeichnet; das Skript
  • macht den Hintergrund zu einer nach links/rechts wiederholbaren Kachel
    (Spiegelkachel 618 breit, die Original-Grafik liegt in der Mitte),
  • hebt ihn dezent an (Schatten der Felsgrate und der Eiskante nach unten
    links — Licht kommt IMMER von oben rechts —, Reif auf den Felsen, Eisdicke
    am Wasserloch, Risse, Kratzspuren der Rutschbahn),
  • zerlegt ihn für die Animation (Loch ausgestanzt; Wasser mit Schaum in
    3 Bildern darunter, Glitzer in 3 Bildern, Schneetreiben),
  • baut die Sprite-Sheets (Pinguin/Eisblock in Schmier-Stufen bis zum
    Stillstand).

Aufruf (aus dem Repo-Wurzelordner):
    python3 scripts/areas/slippery_ice.py [pfad/zu/Motive.xcf]
Standard-Pfad: ../pixelpartiessprites/Motive.xcf. Abhängigkeiten: pillow, numpy,
gimpformats. Ausgabe: public/areas/slippery-ice/*.png
"""
import os
import sys
import numpy as np
from PIL import Image

HIER = os.path.dirname(os.path.abspath(__file__))
WURZEL = os.path.abspath(os.path.join(HIER, '..', '..'))
sys.path.insert(0, os.path.join(WURZEL, 'scripts', 'hero-animations'))
from xcf_extract import load, layer_rgba  # noqa: E402

OUT = os.path.join(WURZEL, 'public', 'areas', 'slippery-ice')
H = 240
ART_W = 309
W = ART_W * 2          # Spiegelkachel
ROLL = 155             # Kachelmitte = Mitte der Original-Grafik


def hexc(s):
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


# Palette der Vorlage
WEISS, SCHNEE, SCHNEE2 = hexc('f7ffff'), hexc('dedfff'), hexc('d6d3ff')
S_HELL, S_MID, S_MID2, S_DUNKEL = hexc('adaef7'), hexc('a5a6f7'), hexc('9c9eef'), hexc('8c8eef')
W1, W2, W3, W4 = hexc('0075ef'), hexc('0051f7'), hexc('0028ce'), hexc('0018b5')
R_DUNKEL, R_MID, R_HELL = hexc('422818'), hexc('8c6d5a'), hexc('c6aa8c')
# Zusatzfarben (nur Abstufungen der Vorlage-Töne)
SCHNEE3 = hexc('c4c4fa')
RISS = hexc('6466d9')
GLANZ_W = hexc('9fd4ff')
GLANZ_W2 = hexc('58a6ff')


def eq(a, c):
    return (a[:, :, 0] == c[0]) & (a[:, :, 1] == c[1]) & (a[:, :, 2] == c[2])


def off(m, dx, dy):
    """o[y,x] = m[y+dy, x+dx]; in x periodisch (Spiegelkachel), in y falsch."""
    o = np.roll(m, -dx, axis=1)
    if dy > 0:
        o = np.concatenate([o[dy:], np.zeros((dy,) + o.shape[1:], o.dtype)])
    elif dy < 0:
        o = np.concatenate([np.zeros((-dy,) + o.shape[1:], o.dtype), o[:dy]])
    return o


def ebene(doc, layers, name):
    hits = [i for i, l in enumerate(layers) if l.name == name]
    if len(hits) != 1:
        raise SystemExit('Ebene %r: %d Treffer' % (name, len(hits)))
    im = layer_rgba(doc, layers[hits[0]])
    return np.array(im.crop(im.getbbox()))


def darker(a, mask, pairs):
    for src, dst in pairs:
        m = mask & eq(a, src)
        a[m, 0:3] = dst


def build_hintergrund(art):
    tile = np.concatenate([art, art[:, ::-1]], axis=1)
    t = np.roll(tile, ROLL, axis=1).copy()
    rgb = t[:, :, :3].astype(int)
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    loch = (b > r + 80) & (r < 80)
    fels = (r > g + 10) & (g > b) & (r < 230) & (r - b > 40)
    eis = ~loch & ~fels
    rng = np.random.RandomState(1441)

    # 1) Schatten der Felsgrate auf Schnee/Eis (Licht oben rechts → Schatten unten links)
    schatten = np.zeros_like(loch)
    for d in (1, 2, 3):
        schatten |= off(fels, d, -d)
    schatten &= eis
    darker(t, schatten, [(WEISS, SCHNEE), (SCHNEE, SCHNEE2), (SCHNEE2, SCHNEE3),
                         (S_HELL, S_MID), (S_MID, S_MID2), (S_MID2, S_DUNKEL)])

    # 2) Reif auf den Felsen: an der beleuchteten Kante (oben rechts) liegt Schnee
    kante = fels & ~off(fels, 1, -1)
    staub = kante & (rng.rand(H, W) < .5)
    t[staub, 0:3] = WEISS
    kante2 = fels & ~off(fels, 2, -2) & ~staub & (rng.rand(H, W) < .12)
    t[kante2, 0:3] = SCHNEE

    # 3) Wasserloch: Eisdicke (dunkle Seitenfläche + helle Lippe) an der Kante
    nb4 = lambda m: off(m, 1, 0) | off(m, -1, 0) | off(m, 0, 1) | off(m, 0, -1)
    ring1 = eis & nb4(loch) & ~fels
    ring2 = eis & nb4(ring1) & ~ring1 & ~fels & ~off(loch, 1, 1) & ~off(loch, -1, 1)
    lippe = ring2 & (off(loch, -1, 2) | off(loch, 0, 2) | off(loch, -2, 1) | off(loch, -2, 2))
    t[ring1, 0:3] = S_DUNKEL
    t[lippe, 0:3] = WEISS

    # 4) Risse im gestreiften Eis (zickzack, mit heller Kante oben rechts)
    streifen = eq(t, S_HELL) | eq(t, S_MID) | eq(t, S_MID2) | eq(t, S_DUNKEL)
    frei = eis & ~ring1 & ~lippe
    zone = frei & streifen
    for (x0, y0, ln, dirx) in [(60, 200, 34, 1), (215 + 309 - 309, 165, 26, -1), (400, 192, 30, 1),
                               (500, 176, 22, -1), (150, 226, 22, 1), (560, 224, 28, -1)]:
        x, y = x0, y0
        for i in range(ln):
            if not (0 <= y < H) or not zone[y, x % W]:
                break
            t[y, x % W, 0:3] = RISS
            hx, hy = (x + 1) % W, y - 1
            if hy >= 0 and zone[hy, hx] and not (t[hy, hx, :3] == np.array(RISS)).all():
                t[hy, hx, 0:3] = WEISS
            step = rng.rand()
            x += dirx if step < .7 else 0
            y += 1 if step > .35 else 0
            if step > .9:
                x += dirx
    # 5) Kratzspuren der Rutschbahn (Bahn A, y 160–178): dunkle Striche + helle Kante darüber
    for _ in range(26):
        y = rng.randint(162, 177)
        x = rng.randint(0, W)
        ln = rng.randint(8, 34)
        for i in range(ln):
            xx = (x + i) % W
            if eq(t[y:y + 1, xx:xx + 1], SCHNEE)[0, 0] or eq(t[y:y + 1, xx:xx + 1], WEISS)[0, 0] or eq(t[y:y + 1, xx:xx + 1], SCHNEE2)[0, 0]:
                if i % 7 != 6:
                    t[y, xx, 0:3] = SCHNEE3
                    if y > 0 and eq(t[y - 1:y, xx:xx + 1], SCHNEE)[0, 0]:
                        t[y - 1, xx, 0:3] = WEISS

    # 6) Loch ausstanzen (dünn erweitert um die Ränder): Wasser liegt darunter
    t[loch, 3] = 0
    return t, loch, fels, ring1


def water_textur(art):
    """Ein 24×24-Stück reinen Wassers aus der Vorlage, das nahtlos kachelt."""
    p = art[214:238, 205:229, :3].copy()
    return p


def build_wasser(loch, ring1, patch, hintergrund):
    """3 Bilder untereinander: Wasser (Textur wandert), Schatten der Eiskante,
    Schaum an der Wasserlinie, Glanzlichter."""
    rgb = hintergrund[:, :, :3]
    ist_eis = ~loch
    nb8 = lambda m: (off(m, 1, 0) | off(m, -1, 0) | off(m, 0, 1) | off(m, 0, -1)
                     | off(m, 1, 1) | off(m, -1, 1) | off(m, 1, -1) | off(m, -1, -1))
    rand1 = loch & nb8(~loch)
    rand2 = loch & nb8(rand1) & ~rand1
    # Schatten: Eis oben rechts wirft Schatten aufs Wasser (nach unten links)
    sch = np.zeros_like(loch)
    for d in (1, 2, 3):
        sch |= off(~loch, d, -d)
    sch &= loch
    frames = []
    rng = np.random.RandomState(2510)
    reihe = np.tile(patch, (H // patch.shape[0] + 1, W // patch.shape[1] + 1, 1))[:H, :W]
    ys, xs = np.where(loch & ~rand1 & ~sch)
    for k in range(3):
        f = np.roll(np.roll(reihe, k * 3, axis=1), k * 2, axis=0).copy()
        # Schatten
        for src, dst in [(W1, W2), (W2, W3), (W3, W4)]:
            m = sch & eq(f, src)
            f[m] = dst
        # Glanzlichter (wandern von Bild zu Bild)
        n = len(xs) // 90
        idx = rng.choice(len(xs), n, replace=False)
        for i in idx:
            y, x = ys[i], xs[i]
            f[y, x] = GLANZ_W
            if rng.rand() < .5:
                f[y, (x + 1) % W] = GLANZ_W2 if loch[y, (x + 1) % W] else f[y, (x + 1) % W]
        # Schaum an der Wasserlinie
        sch_rand = rand1 & (rng.rand(H, W) < (.75 if k != 1 else .5))
        f[sch_rand] = WEISS
        schaum2 = rand2 & (rng.rand(H, W) < .30)
        f[schaum2] = GLANZ_W
        # dunkle Kante in Schattenrichtung bleibt Wasser
        frames.append(f)
    out = np.concatenate(frames, axis=0)
    a = np.full(out.shape[:2] + (1,), 255, np.uint8)
    return np.concatenate([out.astype(np.uint8), a], axis=2)


def build_glitzer(t, loch, fels):
    """3 Bilder: weisse Funkelkreuze auf dem gestreiften Eis."""
    rgb = t[:, :, :3].astype(int)
    streifen = eq(t, S_HELL) | eq(t, S_MID) | eq(t, S_MID2) | eq(t, S_DUNKEL)
    streifen &= (t[:, :, 3] > 0)
    ys, xs = np.where(streifen)
    rng = np.random.RandomState(7)
    pos = []
    while len(pos) < 34:
        i = rng.randint(len(xs))
        y, x = ys[i], xs[i]
        if 3 < y < H - 3 and all(abs(x - px) + abs(y - py) > 26 for px, py in pos):
            pos.append((x, y))
    fr = [np.zeros((H, W, 4), np.uint8) for _ in range(3)]
    for j, (x, y) in enumerate(pos):
        ph = j % 3
        for k in range(3):
            s = (k - ph) % 3
            f = fr[k]
            if s == 0:                     # Kreuz
                for dx, dy in [(0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)]:
                    f[y + dy, (x + dx) % W] = (*WEISS, 255)
            elif s == 1:                   # ausklingend
                f[y, x % W] = (*WEISS, 255)
                f[y, (x + 1) % W] = (*SCHNEE3, 255)
    return np.concatenate(fr, axis=0)


def build_wind():
    """Schneetreiben (Wind von rechts): Flocken + kurze Fahnen, weiss mit
    lavendelfarbenem Schlagschatten, damit sie auch auf Schnee lesbar sind."""
    rng = np.random.RandomState(99)
    w = np.zeros((H, W, 4), np.uint8)
    for _ in range(70):
        x, y = rng.randint(W), rng.randint(6, H - 4)
        w[y, x] = (*WEISS, 255)
        w[y + 1, (x - 1) % W] = (*SCHNEE3, 255)
    for _ in range(20):
        x, y = rng.randint(W), rng.randint(6, H - 4)
        ln = rng.randint(3, 8)
        for i in range(ln):
            w[y, (x + i) % W] = (*WEISS, 255)
            w[y + 1, (x + i - 1) % W] = (*SCHNEE3, 255)
    return w


def mit_schatten(f, dx, dy, alpha):
    """Weicher Bodenschatten unter dem scharfen Körper (Licht oben rechts →
    Schatten nach unten links); die Spur bleibt ohne Schatten."""
    kern = f[:, :, 3] == 255
    sch = np.zeros(kern.shape, bool)
    h, w = kern.shape
    ys, xs = np.where(kern)
    for y, x in zip(ys, xs):
        for k in range(1, dy + 1):
            yy, xx = y + k, x - int(round(dx * k / dy))
            if 0 <= yy < h and 0 <= xx < w:
                sch[yy, xx] = True
    sch &= ~kern
    sch &= f[:, :, 3] == 0
    out = f.copy()
    out[sch] = (52, 54, 160, alpha)
    return out


def paste_cell(im, cw, ch, anchor):
    out = np.zeros((ch, cw, 4), np.uint8)
    h, w = im.shape[:2]
    x = 0 if anchor == 'left' else cw - w
    out[:h, x:x + w] = im
    return out


def build_pinguin(leicht, schwer):
    cw, ch = 104, 22
    f_schwer = paste_cell(schwer, cw, ch, 'left')
    f_leicht = paste_cell(leicht, cw, ch, 'left')
    # mittel: schwere Schmierlinie, nach hinten auf ~60 % ausgeblendet
    mittel = f_schwer.copy()
    kern = 34
    for x in range(kern, cw):
        fak = max(0.0, 1.0 - (x - kern) / 34.0)
        mittel[:, x, 3] = (mittel[:, x, 3] * fak).astype(np.uint8)
    # Stillstand: nur der scharfe Körper (volle Deckkraft, Spur weg)
    ruhe = np.zeros_like(f_leicht)
    vol = f_leicht[:, :, 3] == 255
    vol[:, 34:] = False
    ruhe[vol] = f_leicht[vol]
    ruhe = mit_schatten(ruhe, 1, 2, 110)
    return np.concatenate([f_schwer, mittel, f_leicht, ruhe], axis=1)


def build_block(leicht, schwer):
    cw, ch = 114, 27
    f_schwer = paste_cell(schwer, cw, ch, 'right')
    f_leicht = paste_cell(leicht, cw, ch, 'right')
    ruhe = np.zeros_like(f_leicht)
    vol = f_leicht[:, :, 3] == 255
    vol[:, :cw - 27] = False
    ruhe[vol] = f_leicht[vol]
    ruhe = mit_schatten(ruhe, 3, 3, 120)
    return np.concatenate([f_schwer, f_leicht, ruhe], axis=1)


def save(a, name):
    Image.fromarray(a).save(os.path.join(OUT, name))
    print('geschrieben:', name, a.shape[1], 'x', a.shape[0])


def main():
    xcf = sys.argv[1] if len(sys.argv) > 1 else os.path.join(WURZEL, '..', 'pixelpartiessprites', 'Motive.xcf')
    doc, layers = load(xcf)
    art = ebene(doc, layers, 'Ebene #109')
    assert art.shape[:2] == (H, ART_W), art.shape
    pengu_leicht = ebene(doc, layers, 'Pengu')
    pengu_schwer = ebene(doc, layers, 'Ebene #337')
    block_leicht = ebene(doc, layers, 'Spikeblock')
    block_schwer = ebene(doc, layers, 'Ebene #335')
    os.makedirs(OUT, exist_ok=True)
    t, loch, fels, ring1 = build_hintergrund(art)
    save(t, 'bg.png')
    save(build_wasser(loch, ring1, water_textur(art), t), 'water.png')
    save(build_glitzer(t, loch, fels), 'sparkle.png')
    save(build_wind(), 'drift.png')
    save(build_pinguin(pengu_leicht, pengu_schwer), 'penguin.png')
    save(build_block(block_leicht, block_schwer), 'spikeblock.png')


if __name__ == '__main__':
    main()
