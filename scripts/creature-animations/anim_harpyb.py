# -*- coding: utf-8 -*-
"""Bausteine der Gruppe „harpyB“ (Metal/Rap/Shanty/Ska Harpyformer, Runde 2) — Bodenwesen, kein Hover-Bob.

    zeilen_schub(a, dx_fn)              ganze Zeilen waagerecht verschieben (starr; ClipError statt Abschneiden)
    WindFeuer(Feuer)                    anim_feuer.Feuer, dessen Zungen sich zusätzlich im „Fahrtwind“ biegen (Fackel schwingt)
    funken_welt(feuer, ...)             abreißende Funken: bleiben in der Luft stehen (Weltkoordinaten), während die Fackel weiterzieht
    stauche_zeile(a, zeile, k)          Körper sinkt k Zeilen (Knie beugen): die k Zeilen bis `zeile` entfallen, alles darüber rückt runter

Nichts davon verändert anim_lib / anim_feuer; es sind eigene Ableitungen.
"""
import math

import numpy as np

import anim_lib as L
import anim_feuer as FEU


def zeilen_schub(a, dx_fn):
    """Jede Zeile y der Ebene wandert als Ganzes um int(dx_fn(y)) nach rechts (negativ = links). ClipError, wenn etwas herausragen würde."""
    out = L.leer(*a.shape[:2])
    h, w = a.shape[:2]
    for y in range(h):
        xs = np.nonzero(a[y, :, 3])[0]
        if not len(xs):
            continue
        dx = int(dx_fn(y))
        if xs.min() + dx < 0 or xs.max() + dx >= w:
            raise L.ClipError(f'Zeile {y} würde um {dx} px aus der Leinwand (Breite {w}) geschoben')
        out[y, xs + dx] = a[y, xs]
    return out


def stauche_zeile(a, zeile, k=1):
    """Die k Zeilen bis einschließlich `zeile` entfernen; alles darüber rückt um k nach unten, alles darunter bleibt stehen (Füße am Boden)."""
    if k <= 0:
        return a.copy()
    return L.streck_zeile(a, zeile, -k)


class WindFeuer(FEU.Feuer):
    """Wie Feuer, aber `ebene(i, wind=…)` neigt alle Zungen zusätzlich um `wind` px an der Spitze (Fahrtwind einer geschwenkten Fackel;
    der Anteil wächst mit u^1,3 von der Basis zur Spitze, die Basis bleibt fest)."""
    wind = 0.0

    def _mitte(self, z, p, u):
        return FEU.Feuer._mitte(self, z, p, u) + self.wind * (u ** 1.3)

    def ebene(self, i, hoehen_bonus=0, wind=0.0):
        self.wind = float(wind)
        try:
            return FEU.Feuer.ebene(self, i, hoehen_bonus)
        finally:
            self.wind = 0.0


def abrisse(feuer, min_fall=2, min_frac=0.85):
    """Mehr abreißende Spitzen als `Feuer.ereignisse`: fällt eine Zunge (fast) auf Soll-Höhe oder höher um ≥ min_fall px, bleibt ihre alte Spitze als Funke.
    Liste (Frame, x, y, drift) in Leinwandkoordinaten der Ruhe-Flamme."""
    ev = []
    for g, z in enumerate(feuer.zungen):
        bank, folge = feuer.bank[g], feuer.folge[g]
        for i in range(feuer.n):
            a, b = folge[(i - 1) % feuer.n], folge[i]
            if a == b:
                continue
            Ha, Hn = feuer._hoehe(z, bank[a], 0), feuer._hoehe(z, bank[b], 0)
            if Ha >= z.hoehe * min_frac and Ha - Hn >= min_fall:
                x, y = feuer._tip(z, bank[a], 0)
                ev.append((i, x, y, [-1, 0, 1][(g + i) % 3]))
    return ev


def funken_welt(feuer, ereignisse, i, versatz, leben=14, steigen=0.55, farben=None):
    """Aufsteigende Funken (1 px, runde Punkte, kühlen ab: hell → gelb → orange → rot). Sie entstehen an der Zungenspitze der Fackel zum Zeitpunkt f
    (Versatz `versatz(f)` = (dx, dy) der Fackel in diesem Frame) und bleiben dann in der Luft stehen (steigen, pendeln leicht), die Fackel zieht weiter.
    ClipError, wenn ein Funke die Leinwand verlässt."""
    farben = farben or [feuer.farben[4], feuer.farben[3], feuer.farben[2], feuer.farben[0]]
    e = L.leer(feuer.h, feuer.w)
    for (f, x0, y0, drift) in ereignisse:
        a = (i - f) % feuer.n
        if a >= leben:
            continue
        dx, dy = versatz(f)
        x = x0 + dx + int(round(drift * a / 4.0)) + int(round(0.8 * math.sin(2 * math.pi * a / 8.0)))
        y = y0 + dy - int(round(steigen * a))
        if not (0 <= y < feuer.h and 0 <= x < feuer.w):
            raise L.ClipError(f'Funke bei ({x},{y}) außerhalb der Leinwand {feuer.w}×{feuer.h}')
        e[y, x, :3] = farben[min(len(farben) - 1, a * len(farben) // leben)]
        e[y, x, 3] = 255
    return e
