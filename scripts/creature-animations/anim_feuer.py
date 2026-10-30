# -*- coding: utf-8 -*-
"""Wiederverwendbare Feuer-Animation (Pixelart, nur ganze Pixel, nur Farben der Quelle) — baut auf anim_lib auf.

Das Feuer wird aus verschachtelten Flammenzungen neu gezeichnet. Jede Zunge hat fünf Farbschichten (außen → innen):

    rand  dunkelrote Außenhaut / Umriss        rot   rote Haut     orange  oranger Körper     gelb  gelb-orange     hell  gelber Kern

Jede Schicht hat pro Pose ihre EIGENE Höhe, Breite und seitliche Verschiebung (Kerne wandern auf und ab und hin und her, Farbgrenzen steigen
und fallen); die ganze Zunge biegt sich (Seitenneigung + S-Kurve), wächst und schrumpft, schmale Zungen spalten ihre Spitze kurz und
verschmelzen wieder (selten, nur breite Zungen). Jede Zunge hat eine eigene Folge aus `posen` Posen (Standard 12), jede Pose hält 2–3 Frames, die Zungen sind
gegeneinander versetzt (Zufallsfolge je Zunge, nahtlos über n Frames). Die Basis steht fest (x und Fußzeile je Zunge), darüber bewegt sich alles.
Fällt eine hohe Zunge zurück, reißt ihre Spitze ab und steigt als Funke auf (kühlt ab: hell → gelb → orange → rot).

Schnittstelle
-------------
    from anim_feuer import Feuer, Zunge

    zungen = [Zunge(x=6.2, basis=9, hoehe=6.5, breite=2.2), …]          # x/basis/hoehe/breite in Leinwandpixeln (breite = Halbbreite am Fuß)
    feuer = Feuer(h, w, zungen, rampe={'rand': (r,g,b), 'rot': …, 'orange': …, 'gelb': …, 'hell': …},
                  n=48, seed=7, posen=12, amplitude=1.0, sperre=maske)
    ebene = feuer.ebene(i, hoehen_bonus=0)      # RGBA-Feld h×w: die Flamme in Frame i (0 ≤ i < n); hoehen_bonus: ± Pixel auf alle Zungen
    funken = feuer.funken(i, dy=0)              # RGBA-Feld h×w: abgerissene, aufsteigende Funken (dy: Versatz der Figur, auch Funktion frame → dy)
    feuer.ereignisse                            # [(frame, x, y, drift)] abgerissene Spitzen (Debug/Anzeige)

    feuer = Feuer.aus_maske(maske, rampe, h, w, n_zungen=None, …)   # Zungen automatisch aus einer Flammenmaske (Bool h×w, Ruhepose) ableiten

Parameter: `amplitude` (1.0 = kräftiges Züngeln, 0.5 = ruhig), `posen` (Zahl verschiedener Posen je Zunge), `sperre` (Bool-Maske: dort steht
schon etwas Festes — Flammen werden nicht darübergezeichnet und der Rand dort nicht eingefasst), `n` (Schleifenlänge), `tempo` (Haltedauer (min, max)).
Die Randpixel der Flamme sind immer die Umrissfarbe `rand` (Regel 16); es werden nur Farben der übergebenen Rampe verwendet.
Kompakte Flammen: Nach dem Zeichnen werden alle Teile, die dünner als 2 px sind (Fäden, Äste, Mini-Zacken), abgeschnitten (Öffnung mit einem
2×2-Block); nur die Spitze darf bis zu `faden` (Standard 2) Pixel als 1-px-Spitze überstehen. Die Zungen sind unten mindestens 3 px breit
(`breite` ≥ 1,5), laufen oben spitz zu und neigen sich nur mäßig; Spaltung kommt selten vor und nur bei breiten Zungen (`breite` ≥ 1,8).
"""
import math
import random

import numpy as np

import anim_lib as L

SCHICHTEN = ['rand', 'rot', 'orange', 'gelb', 'hell']                          # außen → innen


class Zunge:
    def __init__(self, x, basis, hoehe, breite=2.0, hoehe_min=None):
        self.x, self.basis, self.hoehe, self.breite = float(x), int(basis), float(hoehe), float(breite)
        self.hoehe_min = hoehe_min


def _pose(rnd, z, amp):
    """Eine zufällige Flammenpose (Höhe, Neigung, S-Kurve, Breite, Höhen/Breiten/Seitenversatz je Schicht, Spaltung)."""
    h = rnd.choice([0.65, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3])
    h = 1.0 + (h - 1.0) * amp
    p = dict(
        h=h,
        lean=rnd.uniform(-1.9, 1.9) * amp * min(1.0, 0.45 + z.breite * 0.3),
        bend=rnd.uniform(-0.9, 0.9) * amp,
        w=1.0 + rnd.uniform(-0.28, 0.28) * amp,
        u=[1.0, rnd.uniform(0.94, 1.0), rnd.uniform(0.76, 0.96), rnd.uniform(0.4, 0.7), rnd.uniform(0.14, 0.42)],
        wk=[1.0, 0.8 * (1 + rnd.uniform(-0.08, 0.08)), 0.58 * (1 + rnd.uniform(-0.15, 0.15)),
            0.38 * (1 + rnd.uniform(-0.2, 0.2)), 0.22 * (1 + rnd.uniform(-0.3, 0.3))],
        dk=[0.0, rnd.uniform(-0.5, 0.5) * amp, rnd.uniform(-1.0, 1.0) * amp, rnd.uniform(-1.1, 1.1) * amp, rnd.uniform(-1.3, 1.3) * amp],
        split=(rnd.uniform(0.5, 0.9) * amp if (rnd.random() < 0.12 and z.breite >= 1.8) else 0.0),
        split_u=rnd.uniform(0.5, 0.72),
    )
    return p


class Feuer:
    def __init__(self, h, w, zungen, rampe, n=48, seed=1, posen=12, amplitude=1.0, sperre=None, tempo=(2, 3), faden=2):
        self.h, self.w, self.zungen, self.rampe, self.n, self.amp = h, w, list(zungen), rampe, n, amplitude
        self.faden = faden
        self.sperre = np.zeros((h, w), bool) if sperre is None else sperre.astype(bool)
        self.farben = [tuple(rampe[k]) for k in SCHICHTEN]
        self.folge = []                                                         # je Zunge: [(Posenindex je Frame)], Bank
        self.bank = []
        self.ereignisse = []
        for g, z in enumerate(self.zungen):
            rnd = random.Random(seed * 1009 + 37 * g)
            bank = [_pose(rnd, z, amplitude) for _ in range(posen)]
            ablauf, dauer_summe = [], 0
            ordnung = []
            while dauer_summe < n:
                if not ordnung:
                    ordnung = list(range(posen))
                    rnd.shuffle(ordnung)
                k = ordnung.pop()
                d = rnd.randint(tempo[0], tempo[1])
                ablauf += [k] * d
                dauer_summe += d
            self.bank.append(bank)
            self.folge.append(ablauf[:n])
        self._spitzen_ereignisse()

    # ── Geometrie einer Zunge ──
    def _hoehe(self, z, p, bonus):
        return max(3, int(round(z.hoehe * p['h'])) + bonus)

    def _mitte(self, z, p, u):
        return z.x + p['lean'] * (u ** 1.5) + p['bend'] * math.sin(math.pi * u)

    def _zeichne(self, idx, z, p, bonus):
        H = self._hoehe(z, p, bonus)
        b = z.basis
        w0 = z.breite * p['w']
        for dy in range(0, H + 1):
            y = b - dy
            if not 0 <= y < self.h:
                continue
            u = dy / float(H)
            c = self._mitte(z, p, u)
            ho = w0 * (1 - u ** 2.0) ** 0.7                                      # bleibt breit und läuft erst oben spitz zu
            lobes = [(c, ho, 1.0)]
            if p['split'] > 0 and u > p['split_u']:
                d = p['split'] * (u - p['split_u']) * H * 0.55
                lobes = [(c - d, ho * 0.7, 1.0), (c + d, ho * 0.7, 1.0)]
            for (cc, hw0, _) in lobes:
                for k in range(5):
                    uk = p['u'][k]
                    if u > uk:
                        continue
                    hw = hw0 * p['wk'][k] * (1 - 0.3 * (u / uk) ** 2)
                    ck = cc + p['dk'][k] * (1 - u / uk)
                    x0 = int(math.ceil(ck - hw - 0.01))
                    x1 = int(math.floor(ck + hw + 0.01))
                    if x1 < x0:
                        x0 = x1 = int(round(ck))
                    for x in range(x0, x1 + 1):
                        if 0 <= x < self.w and not self.sperre[y, x] and idx[y, x] < k:
                            idx[y, x] = k
        # Spitze (Außenhaut) immer vorhanden
        return H

    def _tip(self, z, p, bonus):
        H = self._hoehe(z, p, bonus)
        c = self._mitte(z, p, 1.0)
        return int(round(c)), z.basis - H

    def _spitzen_ereignisse(self):
        """Abgerissene Spitzen: fällt eine hohe Zunge um ≥ 4 px, bleibt ihre alte Spitze als Funke zurück."""
        for g, z in enumerate(self.zungen):
            bank, folge = self.bank[g], self.folge[g]
            for i in range(self.n):
                alt = bank[folge[(i - 1) % self.n]]
                neu = bank[folge[i]]
                if folge[i] == folge[(i - 1) % self.n]:
                    continue
                Ha, Hn = self._hoehe(z, alt, 0), self._hoehe(z, neu, 0)
                if Ha >= z.hoehe * 1.0 and Ha - Hn >= 4:
                    x, y = self._tip(z, alt, 0)
                    self.ereignisse.append((i, x, y, [-1, 0, 1][(g + i) % 3]))

    def _kompakt(self, idx):
        """Alles, was dünner als 2 px ist, abschneiden (2×2-Öffnung); Spitzen dürfen `faden` px als 1-px-Spitze überstehen. Teile, die nach dem
        Abschneiden nicht mehr 4-verbunden an Basis/fester Kuppel hängen, entfallen. Die feste Kuppel (sperre) zählt als Material."""
        import cv2
        m = (idx >= 0) | self.sperre
        pad = np.pad(m, ((0, 1), (0, 1)))
        e = pad[:-1, :-1] & pad[:-1, 1:] & pad[1:, :-1] & pad[1:, 1:]            # e[y,x]: 2×2-Block mit Ecke links oben (x,y) voll
        ep = np.pad(e, ((1, 0), (1, 0)))
        o = ep[1:, 1:] | ep[1:, :-1] | ep[:-1, 1:] | ep[:-1, :-1]                 # Öffnung: jedes Pixel eines vollen Blocks
        r = o.copy()
        for _ in range(self.faden):
            q = np.pad(r, 1)
            d = r | q[:-2, 1:-1] | q[2:, 1:-1] | q[1:-1, :-2] | q[1:-1, 2:]
            r = d & m
        basis_zeile = max(z.basis for z in self.zungen)
        n, lab = cv2.connectedComponents(r.astype(np.uint8), connectivity=4)
        keep = np.zeros_like(r)
        for k in range(1, n):
            comp = lab == k
            if (comp & self.sperre).any() or comp[basis_zeile - 1:].any():
                keep |= comp
        idx[~keep & ~self.sperre] = -1
        return idx

    def ebene(self, i, hoehen_bonus=0):
        idx = np.full((self.h, self.w), -1, np.int8)
        for g, z in enumerate(self.zungen):
            p = self.bank[g][self.folge[g][i % self.n]]
            self._zeichne(idx, z, p, hoehen_bonus)
        idx = self._kompakt(idx)
        # Randpixel (4-Nachbar leer) sind immer die Außenhaut (Umriss); feste Pixel (sperre) zählen als belegt
        belegt = (idx >= 0) | self.sperre
        pad = np.pad(belegt, 1)
        voll = pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:]
        rand = (idx >= 0) & ~voll
        idx[rand] = 0
        out = L.leer(self.h, self.w)
        for k in range(5):
            m = idx == k
            out[m, :3] = self.farben[k]
            out[m, 3] = 255
        return self._verbinden(out)

    def _verbinden(self, out):
        """Schräg gestellte dünne Spitzen hängen nur über eine Pixelecke: Brückenpixel (Außenhautfarbe) machen alles 4-verbunden — auch zu den
        festen Pixeln (sperre)."""
        import anim_amorph as A
        tmp = out.copy()
        tmp[self.sperre, :3] = self.farben[0]
        tmp[self.sperre, 3] = 255
        tmp, brueck = A.verbinde4(tmp)
        for (x, y) in brueck:
            if not self.sperre[y, x] and not out[y, x, 3]:
                out[y, x, :3] = self.farben[0]
                out[y, x, 3] = 255
        return out

    def funken(self, i, dy=0, leben=12, farben=None):
        """Aufsteigende Funken (1 px, runde Punkte): gelb → gelb-orange → orange → rot, wandern 7 px in `leben` Frames und pendeln leicht."""
        farben = farben or [self.farben[4], self.farben[3], self.farben[2], self.farben[0]]
        e = L.leer(self.h, self.w)
        for (f, x0, y0, drift) in self.ereignisse:
            a = (i - f) % self.n
            if a >= leben:
                continue
            x = x0 + int(round(drift * a / 4.0)) + int(round(0.8 * math.sin(2 * math.pi * a / 8.0)))
            y = y0 + (dy(f) if callable(dy) else dy) - int(round(0.55 * a))
            if not (0 <= y < self.h and 0 <= x < self.w):
                raise L.ClipError(f'Funke bei ({x},{y}) außerhalb der Leinwand {self.w}×{self.h}')
            e[y, x, :3] = farben[min(len(farben) - 1, a * len(farben) // leben)]
            e[y, x, 3] = 255
        return e

    @staticmethod
    def aus_maske(maske, rampe, h=None, w=None, n_zungen=None, n=48, seed=1, posen=12, amplitude=1.0, sperre=None):
        """Zungen aus einer Flammenmaske der Ruhepose ableiten: lokale Gipfel der Oberkante je Spalte = Zungen; Fußzeile = unterste Maskenzeile
        in der Umgebung, Höhe = Fuß − Oberkante, Halbbreite = halber Abstand zu den Nachbarzungen (1–3 px)."""
        mk = maske.astype(bool)
        h = h or mk.shape[0]
        w = w or mk.shape[1]
        oben = np.full(mk.shape[1], mk.shape[0], int)
        unten = np.full(mk.shape[1], -1, int)
        for x in range(mk.shape[1]):
            ys = np.nonzero(mk[:, x])[0]
            if len(ys):
                oben[x], unten[x] = int(ys.min()), int(ys.max())
        gipfel = [x for x in range(mk.shape[1]) if unten[x] >= 0 and (x == 0 or oben[x] <= oben[x - 1]) and (x == mk.shape[1] - 1 or oben[x] < oben[x + 1] or oben[x] <= oben[x + 1])
                  and (x == 0 or oben[x] < oben[x - 1] or oben[x] == oben[x - 1])]
        # zusammenfassen: Gipfel näher als 2 px → der höhere
        grob = []
        for x in gipfel:
            if grob and x - grob[-1] < 2:
                if oben[x] < oben[grob[-1]]:
                    grob[-1] = x
            else:
                grob.append(x)
        if n_zungen and len(grob) > n_zungen:
            grob = sorted(sorted(grob, key=lambda x: oben[x])[:n_zungen])
        zungen = []
        for k, x in enumerate(grob):
            nach = (grob[k + 1] - x) if k + 1 < len(grob) else 4
            vor = (x - grob[k - 1]) if k else 4
            fuss = int(max(unten[max(0, x - 1):x + 2]))
            zungen.append(Zunge(x + 0.0, fuss, max(3.0, fuss - oben[x] + 1), max(1.0, min(3.0, (nach + vor) / 4.0 + 0.8))))
        return Feuer(h, w, zungen, rampe, n=n, seed=seed, posen=posen, amplitude=amplitude, sperre=sperre)
