# -*- coding: utf-8 -*-
"""Feuer als klassischer Pixelart-Zyklus mit AUFWÄRTSFLUSS (Runde 4) — Nachfolger von anim_feuer.py (Zufallszungen) und anim_feuer2.py (Verzerren des gemalten Feuers);
beide wurden vom Nutzer abgelehnt und bleiben unverändert.

Idee (so zeichnet man Feuer in 16-Bit-Spielen)
----------------------------------------------
Ein Feuer besteht aus wenigen **Flammen** (Tropfenform: breiter, runder Fuß, nach oben spitz zulaufend). Jede Flamme ist ein Stapel ineinanderliegender Tropfen — einer je
Farbband (außen dunkel/rot → orange → gelb → heller Kern); die inneren sind kürzer und schmaler und sitzen am Fuß, dadurch entstehen saubere, geschlossene Farbbänder
und der helle Kern liegt unten. Bewegung entsteht NUR durch eine Welle, die den Tropfen von der Basis zur Spitze hinaufläuft (Phase = Weg entlang der Flamme − Zeit):

* **Bäuche** (Breitenwelle): die Flamme wird abwechselnd dicker und dünner; die Bäuche entstehen am Fuß und wandern nach oben, werden mit dem Tropfen schmaler,
  die Einschnürung unter dem obersten Bauch geht bis auf 0 → die Spitze **schnürt sich ab**, steigt als Fetzen weiter, schrumpft und verschwindet.
* **Züngeln** (Seitenwelle): dieselbe Welle biegt die Flamme abwechselnd nach links und rechts; am Fuß 0 (Basis ruhig), zur Spitze hin stärker.
* Die Farbbänder machen dieselbe Welle mit (leicht nacheilend), der Kern bleibt fast ruhig.

Ein Zyklus hat `posen` (Standard 8) verschiedene Bilder und schließt nahtlos (Welle = ganze Zahl von Durchläufen je Zyklus). Benachbarte Flammen bekommen verschiedene
`phase` (phasenversetzt). Gerichtetes Feuer (Strahl nach unten, Schweif nach links, Feuerball-Schweif): `richtung=(dx, dy)` — die Welle läuft immer in Flussrichtung.
Es wird nichts gedreht oder skaliert: jedes Bild wird als Feld direkt im Pixelraster ausgewertet (nur ganze Pixel, Alpha 0/255, nur die übergebenen Farben), danach
aufgeräumt (keine Einzelpixel, keine 1-px-Löcher, Bänder verschachtelt).

Schnittstelle
-------------
    import anim_feuer3 as F3
    fl = [F3.Flamme(x=12, y=30, laenge=14, breite=4, phase=0.0), F3.Flamme(x=17, y=31, laenge=9, breite=3, phase=0.45), …]
    feuer = F3.Feuer(h, w, fl, farben=[ROT, ORANGE, GELB, CREME], posen=8, halten=2, sperre=maske)
    ebene = feuer.ebene(i)                       # RGBA h×w für Frame i (Pose = (i // halten) % posen)
    ebene = feuer.ebene(i, dx=2, dy=-1)          # ganzzahlig verschoben (Feuer hängt an bewegtem Teil)
    ebene = feuer.ebene(i, neigung=1.5)          # Fahrtwind: Spitzen um ±px seitlich versetzt (quer zur Flussrichtung, wächst mit der Höhe)
    F3.bogen(pfad, feuer, zoom=12)               # Kontaktbogen: alle Posen nebeneinander

Flamme(x, y, laenge, breite, richtung=(0,-1), phase=0, welle=None, bauch=0.55, schlag=1.0, kern=1.0, fuss=None, baender=None, pot=1.25)
    x, y      Fußmitte (Leinwandpixel, darf gebrochen sein); die Flamme wächst von dort `laenge` px in `richtung`; `breite` = Halbbreite am dicksten Punkt
    welle     Wellenlänge in px (Standard ≈ 0,75·laenge, mind. 6): so weit wandert ein Bauch je Zyklus
    bauch     Stärke der Breitenwelle (0 = keine, > 0,5 → Spitze schnürt sich ab), schlag = Stärke der Seitenwelle (px an der Spitze ≈ schlag·breite·0,45)
    fuss      Tiefe des runden Fußes unter (x, y) in px (Standard 0,6·breite); fuss=0 → flacher Fuß (Flamme sitzt auf einer Kante)
    baender   je Farbband (Länge-, Breiten-Anteil) relativ zur Außenform; Standard passend zur Zahl der Farben
"""
import math

import numpy as np

import anim_lib as L

BAENDER = {
    1: [(1.0, 1.0)],
    2: [(1.0, 1.0), (0.6, 0.55)],
    3: [(1.0, 1.0), (0.72, 0.66), (0.42, 0.36)],
    4: [(1.0, 1.0), (0.8, 0.74), (0.56, 0.5), (0.32, 0.27)],
    5: [(1.0, 1.0), (0.9, 0.84), (0.7, 0.64), (0.5, 0.44), (0.28, 0.24)],
}


SOCKEL = [(1.0, 1.0), (0.86, 0.76), (0.72, 0.52), (0.56, 0.3)]          # Bänder für einen kurzen, breiten Glutsockel (4 Farben): Kern bleibt sichtbar


class Flamme:
    def __init__(self, x, y, laenge, breite, richtung=(0, -1), phase=0.0, welle=None, bauch=0.55, schlag=1.0, kern=1.0, fuss=None, baender=None, pot=1.25, umlauf=1, hals=0.6, fetzen=True):
        self.x, self.y, self.laenge, self.breite = float(x), float(y), float(laenge), float(breite)
        n = math.hypot(*richtung)
        self.r = (richtung[0] / n, richtung[1] / n)
        self.phase = float(phase)
        self.welle = float(welle) if welle else max(6.0, 0.75 * self.laenge)
        self.bauch, self.schlag, self.kern, self.pot, self.umlauf, self.hals = bauch, schlag, kern, pot, int(umlauf), hals
        self.fuss = 0.6 * self.breite if fuss is None else float(fuss)
        self.fetzen = fetzen                                     # False: Spitze schnürt sich nicht ab (hängende Schweife u. Ä.)
        self.baender = baender

    def stufen(self, tau, yy, xx, nb, neigung=0.0):
        return _stufen(self, tau, yy, xx, nb, neigung)


class Strahl:
    """Feuerstrahl/Kegel (Feueratem, Düsenflamme): beginnt schmal bei (x, y) (Halbbreite breite0) und wird in `richtung` über `laenge` px breiter (breite1). Bäuche und ein leichtes
    Schlängeln wandern mit dem Fluss vom Ursprung weg; die Farbbänder liegen als Mantel um den Kern (`einzug` = Abstand der Bandgrenzen vom Rand in px, von außen nach innen).
    Das offene Ende schließt man mit Flammen (`Flamme(..., richtung=<Flussrichtung>)`), deren Füße kurz vor dem Kegelende sitzen: sie laufen als Zungen aus und schnüren Fetzen ab."""

    def __init__(self, x, y, laenge, breite0, breite1, richtung=(0, 1), phase=0.0, welle=None, bauch=0.12, schlag=0.6, einzug=None, umlauf=1):
        self.x, self.y, self.laenge, self.b0, self.b1 = float(x), float(y), float(laenge), float(breite0), float(breite1)
        n = math.hypot(*richtung)
        self.r = (richtung[0] / n, richtung[1] / n)
        self.phase, self.bauch, self.schlag, self.umlauf, self.einzug = float(phase), bauch, schlag, int(umlauf), einzug
        self.welle = float(welle) if welle else max(6.0, 0.5 * self.laenge)

    def stufen(self, tau, yy, xx, nb, neigung=0.0):
        rx, ry = self.r
        dx, dy = xx - self.x, yy - self.y
        a = dx * rx + dy * ry
        c = -dx * ry + dy * rx
        v = a / self.laenge
        vc = np.clip(v, 0, 1)
        th = 2 * math.pi * (a / self.welle - self.umlauf * tau + self.phase)
        hw = (self.b0 + (self.b1 - self.b0) * vc) * (1.0 + self.bauch * np.minimum(1.0, 2.5 * vc) * np.cos(th))
        mitte = self.schlag * vc * np.sin(th + 1.0) + neigung * vc ** 1.5
        einzug = self.einzug or [0.0, 1.1, 2.4, 3.9, 5.2][:nb]
        d = hw - np.abs(c - mitte)
        ok = (v >= 0) & (v <= 1)
        out = np.zeros(a.shape, np.uint8)
        skal = np.clip(hw / (einzug[-1] + 1.6), 0, 1)                 # schmale Stellen: Bänder rücken zusammen
        for k in range(nb):
            out[ok & (d >= einzug[k] * skal + 0.25) & (out == k)] = k + 1
        out[ok & (d >= 0.25) & (hw < 1.6)] = nb                       # Ursprung (Maul/Düse): reiner Kern
        return out


def saum(punkte, abstand, laenge, breite, richtung=(0, -1), phase=0.0, dphase=0.37, versatz=(0, 0), **kw):
    """Flammensaum: Flammen im Abstand `abstand` px entlang eines Linienzugs `punkte` [(x, y), …] (z. B. Rückenkante eines brennenden Tiers). `laenge`, `breite` und `richtung` sind
    Zahlen/Tupel oder Funktionen von t (0 … 1 entlang der Linie); benachbarte Flammen sind um `dphase` phasenversetzt. `versatz` wird auf alle Punkte addiert (Leinwandrand)."""
    seg = [(math.hypot(b[0] - a[0], b[1] - a[1]), a, b) for a, b in zip(punkte[:-1], punkte[1:])]
    ges = sum(l for l, _, _ in seg)
    n = max(2, int(round(ges / float(abstand))) + 1)
    f = lambda w, t: w(t) if callable(w) else w
    out = []
    for k in range(n):
        t = k / float(n - 1)
        d = t * ges
        for l, a, b in seg:
            if d <= l or (a, b) == seg[-1][1:]:
                q = min(1.0, d / l) if l else 0.0
                x, y = a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q
                break
            d -= l
        out.append(Flamme(x + versatz[0], y + versatz[1], f(laenge, t), f(breite, t), richtung=f(richtung, t), phase=(phase + k * dphase) % 1.0, **kw))
    return out


def stuetz(*paare):
    """Stückweise lineare Funktion t → Wert aus Stützstellen (t, wert), für `saum(laenge=…)`."""
    ts, ws = [p[0] for p in paare], [p[1] for p in paare]
    return lambda t: float(np.interp(t, ts, ws))


def _profil(v, pot):
    """Halbbreite (0…1) des ruhenden Tropfens über v = Weg/Länge (0 Fuß … 1 Spitze): bauchig über dem Fuß, dann konkav spitz zulaufend."""
    v = np.clip(v, 0.0, 1.0)
    return (1.0 - v) ** pot * (1.0 + 0.8 * v)


def _stufen(fl, tau, yy, xx, nb, neigung=0.0):
    """Stufenkarte (0 = leer, 1 … nb = Band von außen nach innen) EINER Flamme zur Zykluszeit tau (0 … 1)."""
    rx, ry = fl.r
    dx, dy = xx - fl.x, yy - fl.y
    a = dx * rx + dy * ry                                    # Weg in Flussrichtung
    c = -dx * ry + dy * rx                                   # quer
    baender = fl.baender or BAENDER[nb]
    out = np.zeros(a.shape, np.uint8)
    for k, (lf, wf) in enumerate(baender):
        lk, wk = fl.laenge * lf, fl.breite * wf
        fk = fl.fuss * wf
        v = a / lk
        nach = 0.06 * k                                       # innere Bänder eilen leicht nach
        th = 2 * math.pi * (a / fl.welle - fl.umlauf * tau + fl.phase + nach)
        g = np.clip(v, 0, 1.3)
        ruhe = 1.0 if k < nb - 1 or nb < 3 else fl.kern * 0.5    # Kern fast ruhig
        seit = fl.schlag * ruhe * wk * 0.45 * g ** 1.4 * np.sin(th) + neigung * g ** 1.5
        # Bäuche: unten kaum, zur Spitze kräftig (dort schnürt die Einschnürung bis 0 ab)
        vc = np.clip(v, 0, 1)
        bw = fl.bauch * ruhe * (0.2 + 0.45 * vc + 1.9 * np.clip((vc - 0.5) / 0.5, 0, 1) ** 2)
        fak = 1.0 + bw * np.cos(th + 0.9)
        if not fl.fetzen:
            fak = np.maximum(fak, 0.35)
        fak = np.where((fak < fl.hals) & (bw > 0.45) & fl.fetzen, 0.0, fak)            # Hals unter dem obersten Bauch: nicht zum Faden ausdünnen, sondern abschnüren
        breite = wk * _profil(v, fl.pot) * fak
        # jenseits der Spitze (v > 1) lebt nur der abgelöste Fetzen weiter: steigt, schrumpft, verschwindet
        aus = np.clip((1.3 - v) / 0.3, 0, 1)
        breite = np.where(v > 1.0, np.minimum(wk * 0.34, 1.7) * aus * np.clip(0.1 + 1.5 * np.cos(th + 0.9), 0, None) * (1.0 if fl.fetzen else 0.0), breite)
        innen = (np.abs(c - seit) <= breite - 0.25) & (v >= 0) & (breite > 0.3)
        if fk > 0:                                            # runder Fuß unter der Basis
            innen |= (a < 0) & ((a / fk) ** 2 + (c / wk) ** 2 <= 1.0)
        if k:
            innen &= out == k
        out[innen] = k + 1
    return out


def _komponenten(m):
    import cv2
    n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), connectivity=4)
    return n, lab, st


def _oeffnen(m, spitze):
    """Alles, was dünner als 2 px ist (Fäden, Stege, Einzelpixel), abschneiden; an 2 px dicken Teilen dürfen bis zu `spitze` Pixel als 1-px-Spitze überstehen."""
    p = np.pad(m, 1)
    q = p[:-1, :-1] & p[1:, :-1] & p[:-1, 1:] & p[1:, 1:]            # 2×2-Blöcke (Ecke oben links, im gepolsterten Raster)
    dick = q[:-1, :-1] | q[1:, :-1] | q[:-1, 1:] | q[1:, 1:]
    out = dick.copy()
    for _ in range(spitze):
        p = np.pad(out, 1)
        out = m & (out | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:])
    return out


def _aufraeumen(st, nb, spitze=2):
    """Saubere Bänder: keine Fäden/Einzelpixel (außen 1-px-Spitzen bis `spitze` px erlaubt, innen 1 px), 1-px-Löcher zu, Bänder bleiben verschachtelt."""
    st = st.copy()
    for k in range(1, nb + 1):
        m = st >= k
        weg = m & ~_oeffnen(m, spitze if k == 1 else 1)
        st[weg] = k - 1
        m = st >= k
        p = np.pad(m, 1)
        loch = ~m & p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:]
        if k > 1:
            loch &= st == k - 1
        st[loch] = k
    n, lab, s = _komponenten(st == 0)                             # kleine eingeschlossene Hintergrundlöcher zwischen Zungen schließen
    hh, ww = st.shape
    for j in range(1, n):
        x, y, bw_, bh_, fl_ = s[j]
        if fl_ <= 5 and x > 0 and y > 0 and x + bw_ < ww and y + bh_ < hh:
            st[lab == j] = 1
    return st


class Feuer:
    def __init__(self, h, w, flammen, farben, posen=8, halten=2, sperre=None, rand=None):
        """farben: Liste von außen nach innen (2–5 Farben der Quelle). rand: optionale Umrissfarbe — dann wird das äußerste Pixel der Silhouette so gefärbt."""
        self.h, self.w, self.flammen, self.farben = h, w, list(flammen), [tuple(int(v) for v in c) for c in farben]
        self.posen, self.halten, self.sperre, self.rand = int(posen), int(halten), sperre, rand
        self._cache = {}

    def stufen(self, pose, neigung=0.0):
        key = (pose % self.posen, round(float(neigung), 2))
        if key not in self._cache:
            yy, xx = np.mgrid[0:self.h, 0:self.w].astype(float)
            nb = len(self.farben)
            st = np.zeros((self.h, self.w), np.uint8)
            for fl in self.flammen:
                st = np.maximum(st, fl.stufen(key[0] / float(self.posen), yy, xx, nb, key[1]))
            self._cache[key] = _aufraeumen(st, nb)
        return self._cache[key]

    def pose(self, i):
        return (i // self.halten) % self.posen

    def ebene(self, i, dx=0, dy=0, neigung=0.0, pose=None):
        st = self.stufen(self.pose(i) if pose is None else pose, neigung)
        out = np.zeros((self.h, self.w, 4), np.uint8)
        for k, c in enumerate(self.farben):
            out[st == k + 1, :3] = c
        out[st > 0, 3] = 255
        if self.rand is not None:
            m = st > 0
            p = np.pad(m, 1)
            kante = m & ~(p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:])
            out[kante, :3] = self.rand
        if dx or dy:
            out = L.versetze(out, dx, dy)
        if self.sperre is not None:
            out[self.sperre] = 0
        return out


def bogen(pfad, feuer, zoom=12, hintergrund=(40, 30, 70), box=None, unter=None, frames=None):
    """Kontaktbogen: alle Posen des Zyklus nebeneinander (optional Ausschnitt box=(x0, y0, x1, y1), `unter` = RGBA-Bild hinter dem Feuer)."""
    from PIL import Image
    bilder = frames if frames is not None else [feuer.ebene(0, pose=p) for p in range(feuer.posen)]
    if unter is not None:
        bilder = [L.zusammen(b.shape[0], b.shape[1], [(unter, 0, 0), (b, 0, 0)]) for b in bilder]
    if box is None:
        a = np.stack([b[..., 3] > 0 for b in bilder]).any(axis=0)
        ys, xs = np.nonzero(a)
        box = (max(0, xs.min() - 2), max(0, ys.min() - 2), min(a.shape[1] - 1, xs.max() + 2), min(a.shape[0] - 1, ys.max() + 2))
    x0, y0, x1, y1 = box
    bw, bh = x1 - x0 + 1, y1 - y0 + 1
    o = Image.new('RGB', (len(bilder) * (bw * zoom + zoom) + zoom, bh * zoom + 2 * zoom), hintergrund)
    for j, b in enumerate(bilder):
        im = Image.fromarray(b[y0:y1 + 1, x0:x1 + 1]).resize((bw * zoom, bh * zoom), Image.NEAREST)
        o.paste(im, (zoom + j * (bw * zoom + zoom), zoom), im)
    o.save(pfad)
    return pfad
