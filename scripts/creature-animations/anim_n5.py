# -*- coding: utf-8 -*-
"""Gemeinsame Hilfen der Gruppe „n5“ (Neubau-Welle 3): Leinwand/Ebenen-Verwaltung, Posen-Verschiebung starrer Teile, Abschlussprüfung.
Nur ganze Pixel, nur Quellfarben. Gestreckt wird ausschließlich über anim_textur (TX)."""
import os
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_textur as TX


class Figur:
    """Sprite + Leinwand. pad = (links, rechts, oben, unten)."""

    def __init__(self, slug, pad):
        self.slug = slug
        self.spr = L.lade(slug)
        self.sh, self.sw = self.spr.shape[:2]
        self.pl, self.pr, self.pt, self.pb = pad
        self.H, self.W = self.sh + self.pt + self.pb, self.sw + self.pl + self.pr
        self.OFF = (self.pl, self.pt)
        self.yy, self.xx = np.mgrid[0:self.sh, 0:self.sw]
        self.da = L.deckend(self.spr)
        self.umriss = Hm.umrissfarben(self.spr)

    def f(self, x, y):
        return tuple(int(v) for v in self.spr[y, x, :3])

    def ebene(self, m, dx=0, dy=0, quelle=None):
        """Maskierten Teil des Sprites (oder von `quelle`, gleiche Größe) auf die volle Leinwand legen."""
        t, _ = L.trenne(self.spr if quelle is None else quelle, m & (self.da if quelle is None else L.deckend(quelle)))
        return L.platz(t, self.H, self.W, self.pl + dx, self.pt + dy)

    def box(self, x0, y0, x1, y1):
        """Maske: x0 ≤ x ≤ x1, y0 ≤ y ≤ y1 (einschließlich), nur deckende Pixel."""
        return self.da & (self.xx >= x0) & (self.xx <= x1) & (self.yy >= y0) & (self.yy <= y1)

    def punkte(self, pts):
        m = np.zeros((self.sh, self.sw), bool)
        for x, y in pts:
            m[y, x] = True
        return m & self.da

    def setze(self, a, pixel):
        return Hm.setze(a, pixel, self.OFF)

    def streck(self, a, zeile, n):
        """Texturierte Streckung (TX) an Sprite-Zeile `zeile`: alles darüber steigt um n."""
        return TX.streck_zeile(a, self.pt + zeile, n) if n else a


def ueber(unten, oben):
    """`oben` über `unten` legen (beide volle Leinwand)."""
    out = unten.copy()
    m = oben[..., 3] > 0
    out[m] = oben[m]
    return out


def schieb(a, dx=0, dy=0):
    return L.versetze(a, dx, dy) if (dx or dy) else a


def goldrampe(spr, maske, spitze=None, abstand=24):
    """Farbstufen der Maske, dunkel → hell (Summe der Kanäle); fast gleiche Farben (Summenabstand < `abstand`) bilden EINE Stufe.
    `spitze` (z. B. Augenweiß der Quelle) als hellste Stufe für den Kern des Lichtbands. Ergebnis: Liste von Stufen, jede eine Liste von Farben."""
    fs = sorted({tuple(int(v) for v in spr[y, x, :3]) for y, x in zip(*np.nonzero(maske))}, key=sum)
    stufen = []
    for f in fs:
        if stufen and sum(f) - sum(stufen[-1][0]) < abstand:
            stufen[-1].append(f)
        else:
            stufen.append([f])
    return stufen + ([[tuple(spitze)]] if spitze else [])


def goldglanz(a, maske, off, i, n, starts, dauer, rampe, breite=3.0, achse=(1.0, 1.0)):
    """Regelmäßiges Gold-Lichtband (Runde 8): wandert in `dauer` Frames schräg über ALLE Pixel von `maske` (ganzer Arm), Start in jedem Frame aus `starts`.
    Im Band 1 Stufe heller, im Kern (mittlere Hälfte) 2 Stufen (bis zur Spitze der Rampe). Bearbeitet `a` an Ort und Stelle; `off` = Lage der Maske auf der Leinwand."""
    ys, xs = np.nonzero(maske)
    u = achse[0] * xs + achse[1] * ys
    umin, umax = float(u.min()), float(u.max())
    stufe = {f: k for k, st in enumerate(rampe) for f in st}
    for start in starts:
        k = (i - start) % n
        if k >= dauer:
            continue
        mitte = umin - breite / 2 + (k + 0.5) / dauer * (umax - umin + breite)
        for y, x, uu in zip(ys, xs, u):
            d = abs(uu - mitte)
            if d > breite / 2.0 + 0.001:
                continue
            Y, X = int(y) + off[1], int(x) + off[0]
            f = tuple(int(v) for v in a[Y, X, :3])
            if a[Y, X, 3] and f in stufe:
                a[Y, X, :3] = rampe[min(len(rampe) - 1, stufe[f] + (2 if d <= breite / 4.0 else 1))][-1]
    return a


def randfehler(frames, umriss):
    """Frames mit Außenkantenpixeln, deren Farbe keine Umrissfarbe der Quelle ist (Regel 16)."""
    bad = {}
    for i, fr in enumerate(frames):
        kk = Hm.kantenmaske(fr)
        l = [(int(x), int(y), tuple(int(v) for v in fr[y, x, :3])) for y, x in zip(*np.nonzero(kk)) if tuple(int(v) for v in fr[y, x, :3]) not in umriss]
        if l:
            bad[i] = l
    return bad


def loecher(frames):
    """Eingeschlossene Hintergrundpixel (nicht mit dem Bildrand verbunden) je Frame – als Menge von (x, y). Vergleich mit Frame 0 zeigt neue Lücken."""
    import cv2
    res = []
    for fr in frames:
        frei = (fr[..., 3] == 0).astype(np.uint8)
        n, lab = cv2.connectedComponents(frei, connectivity=4)
        rand = set(lab[0]) | set(lab[-1]) | set(lab[:, 0]) | set(lab[:, -1])
        innen = np.isin(lab, [k for k in range(1, n) if k not in rand]) & (frei > 0)
        res.append({(int(x), int(y)) for y, x in zip(*np.nonzero(innen))})
    return res


def abschluss(fig, karte, frames, ms, erlaubt=(), extra=None, ruhe=True, rand=True):
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    if ruhe:
        diff = Hm.ruhepose(frames[0], fig.spr, fig.OFF)
        print('Ruhepose weicht vom Original ab bei:', diff if diff else 'nichts')
    n = L.pruefe(frames, quelle=fig.spr, erlaubt=erlaubt)
    print('Pixel je Frame:', n)
    if rand:
        bad = randfehler(frames, fig.umriss)
        print('Frames mit Randpixeln in Nicht-Umrissfarbe:', len(bad), {k: v[:4] for k, v in list(bad.items())[:6]})
    lo = loecher(frames)
    neu = {i: sorted(l - lo[0])[:6] for i, l in enumerate(lo) if len(l - lo[0])}
    print('Frames mit neuen eingeschlossenen Lücken gegenüber Frame 0:', len(neu), dict(list(neu.items())[:6]))
    ident = sum(1 for i in range(len(frames)) if np.array_equal(frames[i], frames[(i + 1) % len(frames)]))
    print('identische Nachbarframes:', ident, 'von', len(frames))
    L.speichern(fig.slug, karte, frames, ms, prev, extra=extra)
    if prev:
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/' + fig.slug + '-strip.png', frames, spalten=12, scale=max(3, min(8, 150 // max(fig.W, fig.H))))
