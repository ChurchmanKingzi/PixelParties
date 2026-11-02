# -*- coding: utf-8 -*-
"""Gemeinsame Bausteine für die Ei-Animationen (Monster Nest, Dragoneier, The Egg of God): kleine Risse, die auf den statischen Eiern
erscheinen und wieder verschwinden (Nutzer-Feedback: „Eier statisch, kleine Risse auf den einzelnen Eiern, die erscheinen und verschwinden“).

Ein Riss ist eine kurze Pixelfolge (1–2 Pixel, in Spritekoordinaten) in der dunklen Umrissfarbe des Eis. Er wächst in ganzen Schritten
(erst 1 Pixel, dann 2 Pixel), bleibt kurz stehen, schrumpft wieder auf 1 Pixel und ist weg. Jedes Ei bekommt seine Risse zeitversetzt,
nie mehr als ein paar gleichzeitig; Frame 0 ist immer rissfrei (= Original).

    risse = [Riss([(x, y), (x2, y2)], start=3), …]
    ebene = risse_ebene(h, w, i, n, risse, farbe, dx, dy)     # Ebene mit den Rissen von Frame i (dx, dy = Versatz des Sprites im Frame)
"""
import numpy as np

import anim_lib as L

# Verlauf eines Risses (Anzahl sichtbarer Pixel je Frame, danach weg): wächst, steht, schrumpft.
PROFIL = (1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1)
PROFIL_KURZ = (1, 2, 2, 2, 2, 2, 1)
PROFIL3 = (1, 1, 2, 2, 3, 3, 3, 3, 2, 2, 1, 1)                                             # für 3-Pixel-Risse (nur Flaming Dragonegg)


class Riss:
    def __init__(self, pix, start, profil=PROFIL, farbe=None, spitze=None):
        self.pix = [tuple(p) for p in pix]
        self.start = start
        self.profil = profil
        self.farbe = farbe                                                           # None = Standardfarbe des Eis
        self.spitze = spitze                                                         # Farbe des LETZTEN Pixels (z. B. ein Grau als auslaufende Spitze)

    def stufe(self, i, n):
        t = (i - self.start) % n
        return self.profil[t] if t < len(self.profil) else 0


def gleichzeitig(risse, n):
    """Höchstzahl gleichzeitig sichtbarer Risse (zur Kontrolle) und die Frames ohne Riss."""
    z = [sum(1 for r in risse if r.stufe(i, n)) for i in range(n)]
    return max(z), [i for i, v in enumerate(z) if v == 0]


def risse_ebene(h, w, i, n, risse, farbe, dx=0, dy=0, gueltig=None):
    """Ebene (h×w, RGBA) mit allen Rissen von Frame i; (dx, dy) = Lage des Sprites im Frame. gueltig: optionale Bool-Maske des Sprites, auf der
    die Risse liegen müssen (wirft AssertionError, falls ein Rissprite daneben läge)."""
    e = L.leer(h, w)
    for r in risse:
        k = r.stufe(i, n)
        for j, (x, y) in enumerate(r.pix[:k]):
            if gueltig is not None:
                assert gueltig[y, x], f'Riss-Pixel ({x},{y}) liegt nicht auf dem Ei'
            c = (r.spitze if (j >= 1 and j == len(r.pix) - 1 and r.spitze) else (r.farbe or farbe))
            e[y + dy, x + dx, :3] = c
            e[y + dy, x + dx, 3] = 255
    return e


def auf_figur(fig, ebene):
    """Rissebene über die Figur legen (Risse ersetzen die darunterliegenden Pixel, nie neue Fläche)."""
    out = fig.copy()
    m = ebene[..., 3] > 0
    assert not (m & (fig[..., 3] == 0)).any(), 'Riss ragt über den Rand des Eis hinaus'
    out[m] = ebene[m]
    return out


def vorschlag(spr, hell, n, rand_abstand=3, meide=(), seed=1, formen=((0, 1), (1, 1), (-1, 1)), umfeld=0, laenge=2):
    """Hilfe zum EINMALIGEN Aussuchen von Rissstellen (die gewählten Koordinaten stehen danach fest im Skript): n Pixelpaare (Pixel 1, Pixel 2) auf Schalenpixeln der Farben `hell`
    (Liste von RGB), mindestens `rand_abstand` Pixel vom Silhouettenrand, möglichst weit voneinander entfernt; `meide` = Liste von (x, y), die frei bleiben (±2 px);
    umfeld = Mindestzahl heller Schalenpixel unter den 8 Nachbarn jedes Rissstellenpixels (damit der dunkle Riss nicht in dunklem Raster untergeht)."""
    import random
    h, w = spr.shape[:2]
    op = spr[..., 3] > 0
    hm = np.zeros((h, w), bool)
    for c in hell:
        hm |= (spr[..., :3] == np.array(c)).all(axis=2) & op
    # Abstand zum Rand (Chebyshev) über wiederholtes Schrumpfen
    cur = op.copy(); d = 0; dist = np.zeros((h, w), int)
    while cur.any():
        d += 1
        p = np.pad(cur, 1)
        nxt = cur & p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:] & p[:-2, :-2] & p[:-2, 2:] & p[2:, :-2] & p[2:, 2:]
        dist[cur & ~nxt] = d
        cur = nxt
    kand = []
    for y in range(h):
        for x in range(w):
            if not (hm[y, x] and dist[y, x] >= rand_abstand):
                continue
            if any(abs(x - mx) <= 2 and abs(y - my) <= 2 for (mx, my) in meide):
                continue
            pfade = [[(x, y)]]
            for _ in range(laenge - 1):
                pfade = [pf + [(pf[-1][0] + dx, pf[-1][1] + dy)] for pf in pfade for (dx, dy) in formen
                         if (pf[-1][0] + dx, pf[-1][1] + dy) not in pf]
            for pf in pfade:
                if any(not (0 <= q[0] < w and 0 <= q[1] < h and hm[q[1], q[0]] and dist[q[1], q[0]] >= rand_abstand) for q in pf):
                    continue
                if umfeld:
                    pp = np.pad(hm, 1)
                    if min(int(pp[q[1]:q[1] + 3, q[0]:q[0] + 3].sum()) - 1 for q in pf) < umfeld:
                        continue
                kand.append(tuple(pf))
    rnd = random.Random(seed)
    rnd.shuffle(kand)
    gew = []
    for _ in range(n):
        if not kand:
            break
        if not gew:
            gew.append(kand.pop())
            continue
        def d(k):
            return min(abs(k[0][0] - g[0][0]) + abs(k[0][1] - g[0][1]) for g in gew)
        kand.sort(key=d)
        gew.append(kand.pop())
    return gew
