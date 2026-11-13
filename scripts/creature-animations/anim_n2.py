# -*- coding: utf-8 -*-
"""Gemeinsame Hilfen der Gruppe n2 (Neubau-Welle 3: Dream-Lander-Paare und „Spirit of …“-Creatures).

    fig = N2.Figur('slug', pad=(l, r, o, u))      # Sprite laden, Leinwandmaße, Farbzugriff
    fig.platz(maske)                              # Teil des Sprites (Maske in Spritekoordinaten) auf die volle Leinwand legen
    N2.hub(i, n, hoch, versatz)                   # ganzzahliger Hub 0 … hoch, Frame 0 = 0, weich (Kosinus)
    N2.fenster(i, n, start, werte)                # Ereignisfenster (nahtlos über das Schleifenende)
    N2.setze(a, off, {(x, y): farbe})             # Pixel in Spritekoordinaten setzen (nur wo deckend, außer neu=True)
    N2.funke(a, off, x, y, stufe, kern, arm)      # kurzer Sparkle (Mitte → Kreuz), nur für Metall/Gold/Edelstein
    N2.haupt(modul)                               # rendern, prüfen (L.pruefe + Randpixel-Test), speichern, GIF, Kontaktbogen
Nur ganze Pixel, nur Quellfarben, Alpha 0/255.
"""
import math
import os
import sys

import numpy as np

import anim_lib as L


class Figur:
    def __init__(self, slug, pad):
        self.slug = slug
        self.spr = L.lade(slug)
        self.sh, self.sw = self.spr.shape[:2]
        self.pl, self.pr, self.pt, self.pb = pad
        self.H, self.W = self.sh + self.pt + self.pb, self.sw + self.pl + self.pr
        self.off = (self.pl, self.pt)
        self.yy, self.xx = np.mgrid[0:self.sh, 0:self.sw]
        self.op = L.deckend(self.spr)
        self.farben = {tuple(int(v) for v in p[:3]) for p in self.spr.reshape(-1, 4) if p[3]}

    def f(self, x, y):
        assert self.spr[y, x, 3], (x, y)
        return tuple(int(v) for v in self.spr[y, x, :3])

    def platz(self, maske=None, quelle=None):
        q = self.spr if quelle is None else quelle
        if maske is not None:
            q, _ = L.trenne(q, maske & (q[..., 3] > 0))
        return L.platz(q, self.H, self.W, self.pl, self.pt)

    def farbe(self, *cs):
        for c in cs:
            assert tuple(c) in self.farben, c
        return cs[0] if len(cs) == 1 else list(cs)

    def maske(self, farben):
        return L.farbmaske(self.spr, farben)


def hub(i, n, hoch, versatz=0.0):
    """Ganzzahlig 0 … hoch; i = 0 → 0. versatz in Frames (Nachlauf)."""
    return int(round(hoch * (0.5 - 0.5 * math.cos(2 * math.pi * (i - versatz) / n))))


def schwing(i, n, amp, versatz=0.0):
    """Ganzzahlig −amp … +amp (Sinus), i = 0 → 0."""
    return int(round(amp * math.sin(2 * math.pi * (i - versatz) / n)))


def fenster(i, n, start, werte):
    k = (i - start) % n
    return werte[k] if k < len(werte) else None


def setze(a, off, pixel, neu=False):
    for (x, y), c in pixel.items():
        Y, X = y + off[1], x + off[0]
        if neu or a[Y, X, 3]:
            a[Y, X, :3] = c
            a[Y, X, 3] = 255
    return a


def loesche(a, off, punkte):
    for (x, y) in punkte:
        a[y + off[1], x + off[0]] = 0
    return a


def funke(a, off, x, y, stufe, kern, arm):
    """Sparkle am Punkt (x, y) (Spritekoordinaten): stufe 0 = Mitte (2 Pixel breit wäre zu groß – ein Sparkle ist Glitzer am Objekt, kein Partikel),
    1 = Kreuz mit 1-px-Armen, 2 = Kreuz mit 2-px-Armen (Enden in `arm`). None = nichts."""
    if stufe is None:
        return a
    pts = {(x, y): kern}
    if stufe >= 1:
        for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            pts[(x + d[0], y + d[1])] = kern if stufe >= 2 else arm
    if stufe >= 2:
        for d in ((2, 0), (-2, 0), (0, 2), (0, -2)):
            pts[(x + d[0], y + d[1])] = arm
    return setze(a, off, pts, neu=True)


def versetze_maske(a, maske, dx, dy):
    """Die Pixel von `a` unter `maske` (Leinwandmaske) um (dx, dy) verschieben; der Rest bleibt. Gibt (rest, teil_verschoben) zurück."""
    teil, rest = L.trenne(a, maske & (a[..., 3] > 0))
    return rest, L.versetze(teil, dx, dy)


def kanten(a):
    m = a[..., 3] > 0
    p = np.pad(m, 1)
    return m & ((~p[:-2, 1:-1]) | (~p[2:, 1:-1]) | (~p[1:-1, :-2]) | (~p[1:-1, 2:]))


def loecher(a, max_groesse=3):
    """Kleine eingeschlossene Lücken: transparente 4-Zusammenhangsgebiete mit höchstens `max_groesse` Pixeln, die den Rand nicht erreichen."""
    import cv2
    m = (a[..., 3] > 0).astype(np.uint8)
    p = np.pad(1 - m, 1, constant_values=1)
    n, lab, st, _ = cv2.connectedComponentsWithStats(p, connectivity=4)
    out = []
    for k in range(1, n):
        if k != lab[0, 0] and st[k, cv2.CC_STAT_AREA] <= max_groesse:
            out += [(int(x) - 1, int(y) - 1) for y, x in zip(*np.nonzero(lab == k))]
    return out


def haupt(mod, karte, erlaubt=(), spalten=12, zoom=6):
    fig = mod.FIG
    frames = [mod.frame(i) for i in range(mod.N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ruhe = fig.platz()
    d = np.argwhere((frames[0] != ruhe).any(axis=2))
    print('Ruhepose weicht vom Original ab bei:', [(int(x) - fig.pl, int(y) - fig.pt) for y, x in d][:20] if len(d) else 'nichts')
    n = L.pruefe(frames, quelle=fig.spr, erlaubt=erlaubt)
    print('Pixel je Frame:', n)
    l0 = len(loecher(frames[0]))
    neu = {i: loecher(fr)[:8] for i, fr in enumerate(frames) if len(loecher(fr)) > l0}
    print('Frames mit mehr kleinen Löchern als Frame 0 (%d):' % l0, neu if neu else 'keine')
    gleich = max((sum(1 for j in range(1, 12) if (frames[(i + j) % mod.N] == frames[i]).all()) for i in range(mod.N)))
    print('längste Folge identischer Frames ab einem Frame (≤ 11 geprüft):', gleich)
    L.speichern(fig.slug, karte, frames, mod.MS, prev)
    if prev:
        L.streifen(os.path.join(prev, fig.slug + '-strip.png'), frames, spalten=spalten, scale=zoom)
    return frames
