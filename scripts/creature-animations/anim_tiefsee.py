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


def fluegel(a, pivot_x, amp, i, per, lag=0.0, potenz=1.0, bias=0.0, dy0=0):
    """Flügelschlag spaltenweise: Spalte x wandert um round((amp · (sin(Phase − lag·f) − sin(−lag·f)) + bias·f) · f^potenz) senkrecht (f = Abstand zum Gelenk / größter Abstand).
    Bei i = 0 ist der Versatz überall 0 (Ruhepose = Original), `lag` lässt die Spitze der Wurzel hinterherschlagen. dy0 = zusätzlicher Versatz des ganzen Flügels.
    Positiv = nach unten. Jede Spalte bleibt ein starres Stück (Textur ändert sich nicht)."""
    h, w = a.shape[:2]
    out = L.leer(h, w)
    cols = [x for x in range(w) if a[:, x, 3].any()]
    maxd = max([abs(x - pivot_x) for x in cols], default=1) or 1
    ph = L.sinus(i, per)
    for x in cols:
        f = abs(x - pivot_x) / maxd
        dy = int(round((amp * (math.sin(ph - lag * f) - math.sin(-lag * f)) + bias * f) * f ** potenz)) + dy0
        ys = np.nonzero(a[:, x, 3])[0]
        if ys.min() + dy < 0 or ys.max() + dy >= h:
            raise L.ClipError(f'Spalte {x} würde um {dy} px aus der Leinwand (Höhe {h}) geschoben')
        for y in ys:
            out[y + dy, x] = a[y, x]
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


class Ranken:
    """Dünne Linien/Ranken, die nur DIAGONAL am Körper hängen (Nutzerlob: Deepsea Werewolf): der Kern (größte 4-verbundene Fläche) bleibt stehen oder folgt `kern_dx`,
    die übrigen Pixel („Ranken“) werden von innen nach außen (Breitensuche über 8er-Nachbarn) so versetzt, dass jedes Pixel 8er-Nachbar seines bereits versetzten Elternpixels bleibt.
    So reißt keine Linie und es entstehen keine Brückenpixel. Der Versatz wächst mit dem Abstand zum Kern (Gewicht 0 am Kern, 1 ab `voll` px) und darf sich entlang der Linie summieren.

        R = Ranken(spr)
        ebene = R.ebene(i, H, W, GPL, GPT, wunsch=lambda x, y, g: (dx, dy), kern_dx=lambda y: 0)
    """

    def __init__(self, spr, kern=None, voll=4.0, entfernen=()):
        import cv2
        self.spr = spr
        self.sh, self.sw = spr.shape[:2]
        vor = spr[..., 3] > 0
        for (x, y) in entfernen:
            vor[y, x] = False
        self.vor = vor
        if kern is None:
            n, lab = cv2.connectedComponents(vor.astype(np.uint8), connectivity=4)
            gr = [int((lab == k).sum()) for k in range(1, n)]
            kern = lab == (1 + int(np.argmax(gr)))
        self.kern = kern
        self.ranken = vor & ~kern
        self.abst = cv2.distanceTransform((~kern).astype(np.uint8), cv2.DIST_C, 3)
        self.RP = [(x, y) for y in range(self.sh) for x in range(self.sw) if self.ranken[y, x]]
        self.gew = {p: min(1.0, max(0.0, (self.abst[p[1], p[0]] - 1) / voll)) for p in self.RP}
        self.ordnung = self._reihenfolge()

    def col(self, p):
        return tuple(int(v) for v in self.spr[p[1], p[0], :3])

    def _reihenfolge(self):
        sw, sh, kern = self.sw, self.sh, self.kern
        rest_ = set(self.RP)
        fertig, ordnung, front = set(), [], []
        for (x, y) in sorted(self.RP):
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    q = (x + dx, y + dy)
                    if (dx, dy) != (0, 0) and 0 <= q[0] < sw and 0 <= q[1] < sh and kern[q[1], q[0]]:
                        front.append(((x, y), q))
                        break
                else:
                    continue
                break
        while front:
            nxt = []
            for (p, par) in front:
                if p in fertig:
                    continue
                fertig.add(p)
                ordnung.append((p, par))
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        q = (p[0] + dx, p[1] + dy)
                        if (dx, dy) != (0, 0) and q in rest_ and q not in fertig:
                            nxt.append((q, p))
            nxt.sort(key=lambda t: (self.col(t[0]) != self.col(t[1]) if t[1] in rest_ else False, t[0][1], t[0][0]))
            front = nxt
        # Ranken ohne Anschluss an den Kern (Inseln) bleiben stehen
        self.inseln = [p for p in self.RP if p not in fertig]
        return ordnung

    def lage(self, i, wunsch, kern_dx=None, kern_dy=None):
        """Neue Lage {Pixel: (x, y)} aller Ranken-Pixel in Frame i."""
        pos = {}
        for (p, par) in self.ordnung:
            x, y = p
            wx, wy = wunsch(x, y, self.gew[p])
            if par in pos:
                pp = pos[par]
            else:
                pp = (par[0] + (kern_dx(par[1]) if kern_dx else 0), par[1] + (kern_dy(par[1]) if kern_dy else 0))
            best, bd = None, None
            for oy in range(-4, 5):
                for ox in range(-4, 5):
                    q = (x + ox, y + oy)
                    if max(abs(q[0] - pp[0]), abs(q[1] - pp[1])) > 1 or q == pp:
                        continue
                    d = (ox - wx) ** 2 + (oy - wy) ** 2 + 0.01 * (abs(ox) + abs(oy))
                    if bd is None or d < bd:
                        best, bd = q, d
            pos[p] = best
        for p in self.inseln:
            pos[p] = p
        return pos

    def ebene(self, i, H, W, GPL, GPT, wunsch, kern_dx=None, kern_dy=None):
        a = L.leer(H, W)
        pos = self.lage(i, wunsch, kern_dx, kern_dy)
        for p in self.RP:
            x, y = pos[p]
            if not (0 <= GPT + y < H and 0 <= GPL + x < W):
                raise L.ClipError(f'Ranke bei ({x},{y}) liegt außerhalb der Leinwand')
            a[GPT + y, GPL + x, :3] = self.col(p)
            a[GPT + y, GPL + x, 3] = 255
        return a


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
