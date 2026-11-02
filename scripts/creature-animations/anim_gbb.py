# -*- coding: utf-8 -*-
"""Gemeinsame Bausteine der Gruppe „Guardian Beasts B“ (Niu, She, Shu, Tu, Yang, Zhu) und der Cardinal Beasts (Baihu, Qinglong, Zhuque).

Baut auf anim_lib / anim_humanoide auf (nur ganze Pixel, kein Alpha, nur Quellfarben). Alle Funktionen arbeiten auf RGBA-Ebenen der VOLLEN
Leinwand (vorher L.platz), damit nichts abgeschnitten wird.

    gefaelle(zeilen, pivot, amp, phase, potenz, weich)   {Zeile: dx} für eine Scherung um `pivot` (Zeilenversatz wächst mit dem Abstand);
                                                         benachbarte Zeilen unterscheiden sich um höchstens 1 px (Zusammenhang bleibt)
    zeilen_dx(a, dxs)                                    ganze Zeilen waagerecht verschieben (ClipError statt stillem Abschneiden)
    spalten_dy(a, dys)                                   ganze Spalten senkrecht verschieben ({Spalte: dy}), ClipError bei Überstand
    kappe(dxs)                                           {Zeile: dx} so begrenzen, dass benachbarte Zeilen höchstens 1 px Unterschied haben
    glatt(werte, pivot)                                  dasselbe für beliebige Schlüssel (Spalten/Zeilen) — Lipschitz-1-Begrenzung ab einem festen Punkt
    ebene_von(spr, maske, h, w, off, dx, dy)             Teil des Sprites (Maske) auf die Leinwand legen
    rand_schliessen(fig, erlaubt, farbe_fn)              Randpixel in Nicht-Umrissfarbe bekommen die Umrissfarbe (Regel 16)
"""
import numpy as np

import anim_lib as L


def kappe(dxs):
    """Zeilenversätze (Dict, Schlüssel = aufeinanderfolgende ganze Zahlen, ab dem kleinsten Schlüssel gerechnet) so abflachen, dass
    benachbarte Zeilen höchstens 1 px Unterschied haben. Beginnt beim Schlüssel, dessen Versatz 0 ist (Pivot), und arbeitet nach außen."""
    ks = sorted(dxs)
    if not ks:
        return dxs
    out = dict(dxs)
    piv = min(ks, key=lambda k: abs(dxs[k]))
    for k in range(piv + 1, ks[-1] + 1):
        if k in out and k - 1 in out:
            out[k] = max(out[k - 1] - 1, min(out[k - 1] + 1, out[k]))
    for k in range(piv - 1, ks[0] - 1, -1):
        if k in out and k + 1 in out:
            out[k] = max(out[k + 1] - 1, min(out[k + 1] + 1, out[k]))
    return out


def gefaelle(zeilen, pivot, amp, phase, potenz=1.0):
    """Scherung um die Zeile `pivot`: dx = round(amp · (|y − pivot| / größter Abstand)^potenz · sin(phase)); Zeilen auf/unter dem Pivot (je nach Seite
    der übergebenen Zeilen) bekommen die Schlüssel `zeilen`. Gibt {Zeile: dx} zurück (Unterschied benachbarter Zeilen ≤ 1)."""
    zeilen = list(zeilen)
    maxd = max(1, max(abs(y - pivot) for y in zeilen))
    s = np.sin(phase)
    dxs = {y: int(round(amp * (abs(y - pivot) / maxd) ** potenz * s)) for y in zeilen}
    return kappe(dxs)


def zeilen_dx(a, dxs):
    """Ganze Zeilen der Ebene waagerecht verschieben ({Leinwandzeile: dx})."""
    out = a.copy()
    h, w = a.shape[:2]
    for y, dx in dxs.items():
        xs = np.nonzero(a[y, :, 3])[0]
        if not len(xs) or not dx:
            continue
        if xs.min() + dx < 0 or xs.max() + dx >= w:
            raise L.ClipError(f'Zeile {y} würde um {dx} px aus der Leinwand geschoben')
        out[y] = 0
        for x in xs:
            out[y, x + dx] = a[y, x]
    return out


def spalten_dy(a, dys):
    """Ganze Spalten der Ebene senkrecht verschieben ({Leinwandspalte: dy}); mehrere Spalten dürfen gleich viel wandern."""
    out = a.copy()
    h, w = a.shape[:2]
    for x, dy in dys.items():
        ys = np.nonzero(a[:, x, 3])[0]
        if not len(ys) or not dy:
            continue
        if ys.min() + dy < 0 or ys.max() + dy >= h:
            raise L.ClipError(f'Spalte {x} würde um {dy} px aus der Leinwand geschoben')
        out[:, x] = 0
        for y in ys:
            out[y + dy, x] = a[y, x]
    return out


def ebene_von(spr, maske, h, w, off, dx=0, dy=0):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, h, w, off[0] + dx, off[1] + dy)


def rand_schliessen(fig, erlaubt, standard, nah=True):
    """Jedes Randpixel (ein 4er-Nachbar leer), dessen Farbe nicht in `erlaubt` (Umrissfarben der Quelle) steht, bekommt eine Umrissfarbe: mit nah=True die häufigste
    erlaubte Farbe unter seinen 8 Nachbarn (der Saum bleibt gold, wo er gold ist), sonst/ohne Nachbar `standard`. Gibt die Zahl der umgefärbten Pixel zurück."""
    from collections import Counter
    m = fig[..., 3] > 0
    p = np.pad(m, 1)
    rand = m & (~p[:-2, 1:-1] | ~p[2:, 1:-1] | ~p[1:-1, :-2] | ~p[1:-1, 2:])
    h, w = m.shape
    todo = []
    for y, x in zip(*np.nonzero(rand)):
        if tuple(int(v) for v in fig[y, x, :3]) not in erlaubt:
            todo.append((y, x))
    for y, x in todo:
        c = standard
        if nah:
            z = Counter()
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    yy_, xx_ = y + dy, x + dx
                    if (dy or dx) and 0 <= yy_ < h and 0 <= xx_ < w and m[yy_, xx_] and rand[yy_, xx_]:
                        col = tuple(int(v) for v in fig[yy_, xx_, :3])
                        if col in erlaubt:
                            z[col] += 2 if (dy == 0 or dx == 0) else 1
            if z:
                c = z.most_common(1)[0][0]
        fig[y, x, :3] = c
    return len(todo)
