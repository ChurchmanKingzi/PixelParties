# -*- coding: utf-8 -*-
"""Eigene Bausteine der Gruppe „misc“ (Runde 2: Lunatic Golem, Deepsea Stein, Cold-Hearted Yuki Onna, Elven Archer) — baut auf anim_lib auf (ändert sie nicht).

    bitmap_blitz(ebene, x0, y0, zeilen, stufe, farben)              Blitz aus einem kleinen Zeichen-Bitmap (2 px dicke Zickzack-Zacken), wächst in Leserichtung; spiegel_x / spiegel_y
    blitz_zeichnen(ebene, ax, ay, pfad, stufe, kern, akzent, ...)   kleiner Pixel-Blitz (4-verbundener Zickzack) mit Auf-/Abbau in 4 Stufen
    ereignis_stufe(i, start, n)                                     Stufe 0…3 eines Blitz-Ereignisses ab Frame `start`
    zeilen_welle_fliessend(a, pivot_y, ...)                         Haare/Fahne wehen als fließende Welle in Windrichtung (Gefälle ≤ 1 px je Zeile)
    verbunden4(maske)                                               Anzahl der 4-verbundenen Komponenten (Zusammenhangskontrolle)
"""
import math

import numpy as np

import anim_lib as L

# Blitz-Pfade sind 4-verbundene Zickzack-Listen (x, y) — absolut oder relativ zum Anker; der Blitz „schlägt“ vom ersten zum letzten Pixel ein.
# Sie stehen im jeweiligen Creature-Skript (dort mit den Koordinaten der Figur); BLITZ = Sammlung für Wiederverwendung.
BLITZ = {}


def blitz_sichtbar(n, stufe):
    """Welche Pfadpunkte (Indizes) in Stufe 0…3 der Blitz-Lebensdauer leuchten: 0 = er schlägt an (erste Hälfte), 1/2 = ganz, 3 = er erlischt (zweite Hälfte)."""
    halb = max(3, (n + 1) // 2)
    if stufe == 0:
        return list(range(0, halb))
    if stufe in (1, 2):
        return list(range(n))
    if stufe == 3:
        return list(range(n - halb, n))
    return []


def blitz_zeichnen(ebene, ax, ay, pfad, stufe, kern, akzent, spiegel=False):
    """Blitz auf die Leinwand-Ebene zeichnen (Anker (ax, ay) in Leinwandkoordinaten). Stufe None = nichts. Kern = Hauptfarbe, Akzent = Pixel an der Spitze und
    jedes dritte Pixel. ClipError, wenn ein Pixel aus der Leinwand ragen würde (nichts wird still abgeschnitten)."""
    if stufe is None:
        return ebene
    h, w = ebene.shape[:2]
    pf = BLITZ[pfad] if isinstance(pfad, str) else pfad
    for j in blitz_sichtbar(len(pf), stufe):
        dx, dy = pf[j]
        x, y = ax + (-dx if spiegel else dx), ay + dy
        if not (0 <= x < w and 0 <= y < h):
            raise L.ClipError(f'Blitz bei ({x},{y}) liegt außerhalb der Leinwand {w}×{h}')
        ebene[y, x, :3] = akzent if (j == len(pf) - 1 or j % 3 == 2) else kern
        ebene[y, x, 3] = 255
    return ebene


def bitmap_blitz(ebene, x0, y0, zeilen, stufe, farben, ordnung=1):
    """Blitz als kleines Zeichen-Bitmap (Zeilen aus Zeichen; '.' = leer, andere Zeichen = Farben aus `farben`, z. B. {'W': weiß, 'a': hellblau, 'b': blau}) mit linker oberer Ecke (x0, y0) auf
    die Leinwand-Ebene zeichnen. Der Blitz wächst in Leserichtung (ordnung = 1: von oben nach unten, −1: von unten nach oben) und baut sich in vier Stufen auf/ab
    (blitz_sichtbar). ClipError, wenn er aus der Leinwand ragt. Stufe None = nichts."""
    if stufe is None:
        return ebene
    h, w = ebene.shape[:2]
    px = [(x, y, ch) for y, z in enumerate(zeilen) for x, ch in enumerate(z) if ch != '.']
    if ordnung < 0:
        px = px[::-1]
    for j in blitz_sichtbar(len(px), stufe):
        x, y, ch = px[j]
        X, Y = x0 + x, y0 + y
        if not (0 <= X < w and 0 <= Y < h):
            raise L.ClipError(f'Blitz bei ({X},{Y}) liegt außerhalb der Leinwand {w}×{h}')
        ebene[Y, X, :3] = farben[ch]
        ebene[Y, X, 3] = 255
    return ebene


def spiegel_x(zeilen):
    """Bitmap waagerecht spiegeln."""
    return [z[::-1] for z in zeilen]


def spiegel_y(zeilen):
    """Bitmap senkrecht spiegeln."""
    return list(zeilen[::-1])


def ereignis_stufe(i, start, n, laenge=4):
    """Stufe 0…laenge−1 eines Ereignisses, das bei Frame `start` beginnt (zyklisch bei n), sonst None."""
    k = (i - start) % n
    return k if k < laenge else None


def verbunden4(maske):
    """Anzahl der 4-verbundenen Komponenten einer Maske (1 = alles hängt über Kanten zusammen)."""
    m = np.asarray(maske, bool)
    seen = np.zeros_like(m)
    h, w = m.shape
    n = 0
    for y0, x0 in zip(*np.nonzero(m)):
        if seen[y0, x0]:
            continue
        n += 1
        st = [(y0, x0)]
        seen[y0, x0] = True
        while st:
            y, x = st.pop()
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                yy, xx = y + dy, x + dx
                if 0 <= yy < h and 0 <= xx < w and m[yy, xx] and not seen[yy, xx]:
                    seen[yy, xx] = True
                    st.append((yy, xx))
    return n


def komponenten4(maske):
    """Liste der 4-verbundenen Komponenten (je eine Liste von (y, x))."""
    m = np.asarray(maske, bool)
    seen = np.zeros_like(m)
    h, w = m.shape
    out = []
    for y0, x0 in zip(*np.nonzero(m)):
        if seen[y0, x0]:
            continue
        komp, st = [], [(int(y0), int(x0))]
        seen[y0, x0] = True
        while st:
            y, x = st.pop()
            komp.append((y, x))
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                yy, xx = y + dy, x + dx
                if 0 <= yy < h and 0 <= xx < w and m[yy, xx] and not seen[yy, xx]:
                    seen[yy, xx] = True
                    st.append((yy, xx))
        out.append(komp)
    return out
