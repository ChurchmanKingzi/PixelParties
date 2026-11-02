# -*- coding: utf-8 -*-
"""Gemeinsame Bausteine für die Tiefsee-Creatures (Dark Deepsea God, Deepsea Horror Clown, Jack O' Lantern, Monstrosity, Pirate,
Poltergeister, Primordium, Siren, Tamed Primordium, Doomed Pirate). Baut auf anim_lib / anim_untote auf, ändert sie nicht.

Alles Pixelart: nur ganze Pixel, kein Alpha, nur Quellfarben.

    sinz(i, per, ph)                 # sin über eine Periode, per Frames
    rel(f, i)                        # f(i) − f(0): Bewegung, die bei Frame 0 genau 0 ist (Ruhepose = Original)
    Szene(slug, karte, spr, N, MS)   # Leinwand mit Rand, Teile auf die volle Leinwand legen, Zuschnitt auf die Figur, Vorschau/Speichern
    wehen(a, pivot_y, amp, i, per, lag, potenz, nach_unten)   # hängende Zeilen wehen (Zeilenversatz wächst mit dem Abstand; Laufzeit lag)
    gruppen_scher(a, gruppen, dxs)   # Zeilengruppen starr um dx verschieben (Hutspitze, Horn)
    fleck(a, punkte, farbe, ox, oy)  # Pixel färben (Lider, Mund)
    zusammenhang(a, vorher)          # Testhilfe: Anzahl 8er-Komponenten
    luecken_fuellen(a, maske, farbe) # kleine Lücken (transparente Pixel mit ≥ 3 deckenden 4er-Nachbarn) schließen
"""
import math
import os
import sys

import numpy as np

import anim_lib as L
import anim_untote as U


def sinz(i, per, ph=0.0):
    return math.sin(2 * math.pi * i / per + ph)


def rel(f, i):
    """Wert von f bei Frame i, gemessen gegen Frame 0 (Ruhepose = Original)."""
    return f(i) - f(0)


def fleck(a, punkte, farbe, ox=0, oy=0):
    """Pixel `punkte` (Sprite-Koordinaten) auf `farbe` setzen (nur, wo schon etwas steht)."""
    for (x, y) in punkte:
        if a[y + oy, x + ox, 3]:
            a[y + oy, x + ox, :3] = farbe
    return a


def wehen(a, pivot_y, amp, i, per, lag=0.0, potenz=1.0, nach_unten=True, grenze=None):
    """Hängende Zeilen wehen: Zeile y verschiebt sich um round(amp · g · (sin(Phase − lag·g) − sin(−lag·g))), g = (Abstand zum Pivot / größter Abstand)^potenz.
    Bei i = 0 ist der Versatz überall 0 (Ruhepose). Nachbarzeilen unterscheiden sich um höchstens 1 px, solange amp ≤ Zeilenzahl.
    Das Feld muss die Figur samt Rand enthalten (ClipError sonst). `grenze` = (y_min, y_max): nur diese Zeilen bewegen."""
    h, w = a.shape[:2]
    out = L.leer(h, w)
    ys = [y for y in range(h) if a[y, :, 3].any()]
    if nach_unten:
        zeilen = [y for y in ys if y > pivot_y]
    else:
        zeilen = [y for y in ys if y < pivot_y]
    if grenze:
        zeilen = [y for y in zeilen if grenze[0] <= y <= grenze[1]]
    maxd = max([abs(y - pivot_y) for y in zeilen], default=1)
    ph = L.sinus(i, per)
    for y in ys:
        if y not in zeilen:
            out[y] = a[y]
            continue
        g = (abs(y - pivot_y) / maxd) ** potenz
        dx = int(round(amp * g * (math.sin(ph - lag * g) - math.sin(-lag * g))))
        xs = np.nonzero(a[y, :, 3])[0]
        if xs.min() + dx < 0 or xs.max() + dx >= w:
            raise L.ClipError(f'Zeile {y} würde um {dx} px aus der Leinwand (Breite {w}) geschoben')
        for x in xs:
            out[y, x + dx] = a[y, x]
    return out


def gruppen_scher(a, gruppen, dxs):
    """Zeilengruppen starr verschieben: gruppen = [(y0, y1), …] (Leinwandzeilen, einschließlich), dxs = Versatz je Gruppe. Andere Zeilen bleiben."""
    out = a.copy()
    h, w = a.shape[:2]
    for (y0, y1), dx in zip(gruppen, dxs):
        if dx == 0:
            continue
        for y in range(y0, y1 + 1):
            out[y] = 0
        for y in range(y0, y1 + 1):
            xs = np.nonzero(a[y, :, 3])[0]
            if not len(xs):
                continue
            if xs.min() + dx < 0 or xs.max() + dx >= w:
                raise L.ClipError(f'Zeile {y} würde um {dx} px aus der Leinwand (Breite {w}) geschoben')
            for x in xs:
                out[y, x + dx] = a[y, x]
    return out


def zusammenhang(a):
    """Anzahl der 8er-Komponenten der deckenden Pixel."""
    import cv2
    n, _ = cv2.connectedComponents((a[..., 3] > 0).astype(np.uint8), connectivity=8)
    return n - 1


def luecken_fuellen(a, farbe_fn, minnachbarn=3):
    """Transparente Pixel, die von ≥ minnachbarn deckenden 4er-Nachbarn umgeben sind (Lücken durch Verschieben), mit farbe_fn(x, y, a) füllen."""
    h, w = a.shape[:2]
    out = a.copy()
    m = a[..., 3] > 0
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            if m[y, x]:
                continue
            n = int(m[y - 1, x]) + int(m[y + 1, x]) + int(m[y, x - 1]) + int(m[y, x + 1])
            if n >= minnachbarn:
                out[y, x, :3] = farbe_fn(x, y, a)
                out[y, x, 3] = 255
    return out


class Szene:
    """Leinwand mit Rand um den Sprite; Zuschnitt (symmetrisch um die Ruhefigur) und Speichern.

    S = Szene('slug', 'Kartenname', spr, N, MS, rand=(l, r, t, b))
    S.teil(maske)            -> Ebene (Sprite-Teil) auf der vollen Leinwand
    S.ebene(a)               -> beliebige Sprite-große Ebene auf die volle Leinwand
    S.bauen(fn)              -> fn(i, nur) liefert das Vollbild (nur == 'koerper': ohne Partikel); berechnet den Zuschnitt
    S.frame(i, nur=None)     -> zugeschnittener Frame
    S.main(extra_frames)     -> Prüfen, Speichern, Kontaktbogen (Aufruf im Skript unter __main__)
    """

    def __init__(self, slug, karte, spr, N, MS, rand=(7, 7, 7, 7), min_rand=1, extra=None, erlaubt=()):
        self.slug, self.karte, self.spr, self.N, self.MS = slug, karte, spr, N, MS
        self.GPL, self.GPR, self.GPT, self.GPB = rand
        self.sh, self.sw = spr.shape[:2]
        self.H, self.W = self.sh + self.GPT + self.GPB, self.sw + self.GPL + self.GPR
        self.yy, self.xx = np.mgrid[0:self.sh, 0:self.sw]
        self.vorhanden = L.deckend(spr)
        self.UMRISS = U.umrissfarben(spr)
        self.min_rand, self.extra, self.erlaubt = min_rand, extra, erlaubt
        self.fn = None
        self.BOX = None

    def col(self, x, y):
        return tuple(int(v) for v in self.spr[y, x, :3])

    def teil(self, maske):
        t, _ = L.trenne(self.spr, maske)
        return L.platz(t, self.H, self.W, self.GPL, self.GPT)

    def ebene(self, a):
        return L.platz(a, self.H, self.W, self.GPL, self.GPT)

    def P(self, x, y):
        return self.GPL + x, self.GPT + y

    def bauen(self, fn):
        self.fn = fn
        self.BOX = U.zuschnitt([fn(i, None) for i in range(self.N)], [fn(i, 'koerper') for i in range(self.N)],
                               (self.GPL, self.GPT, self.GPL + self.sw, self.GPT + self.sh))
        self.PAD_L, self.PAD_T = self.GPL - self.BOX[0], self.GPT - self.BOX[1]
        return self

    def frame(self, i, nur=None):
        return U.beschneiden(self.fn(i, nur), self.BOX)

    def main(self, strip_frames=None, scale=8):
        frames = [self.frame(i) for i in range(self.N)]
        prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
        L.pruefe(frames, quelle=self.spr, min_rand=self.min_rand, erlaubt=self.erlaubt)
        L.speichern(self.slug, self.karte, frames, self.MS, prev, extra=self.extra)
        if prev:
            os.makedirs(prev, exist_ok=True)
            sf = strip_frames or [k for k in range(0, self.N, max(1, self.N // 8))][:8]
            L.streifen(prev + f'/{self.slug}-strip.png', [frames[k] for k in sf], spalten=4, scale=scale)
        return frames
