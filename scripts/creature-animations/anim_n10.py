# -*- coding: utf-8 -*-
"""Gemeinsame Hilfen der Gruppe n10 (Gigantisaurier Brachion, King Trex, Raptoren, Triceras, Chimera, Spinor; Great Immortal Hydra).

Nur ganze Pixel, nur Quellfarben, nichts wird gestreckt: Teile werden als Einheit verschoben (Posen) oder spaltenweise/zeilenweise mit einem Gefälle
von höchstens 1 px je Spalte/Zeile gebogen (Hals, Schwanz); offene Kanten schließt anim_tiere.umriss_schliessen mit der Umrissfarbe des Originals."""
import math

import numpy as np

import anim_lib as L


def maske_farben(spr, farben, x0=0, y0=0, x1=None, y1=None):
    """Pixel in einer der `farben` im Kasten [x0, x1] × [y0, y1] (einschließlich)."""
    h, w = spr.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    x1 = w - 1 if x1 is None else x1
    y1 = h - 1 if y1 is None else y1
    return L.farbmaske(spr, farben) & (xx >= x0) & (xx <= x1) & (yy >= y0) & (yy <= y1)


def mit_umriss(spr, fuell, umriss_farben, verboten=None, kasten=None, diagonal=False):
    """Füllmaske + alle 4-benachbarten (diagonal=True: 8-benachbarten) Pixel in einer Umrissfarbe (nicht in `verboten`, nur im `kasten` = (x0, y0, x1, y1))."""
    p = np.pad(fuell, 1)
    nb = p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
    if diagonal:
        nb |= p[:-2, :-2] | p[:-2, 2:] | p[2:, :-2] | p[2:, 2:]
    m = nb & L.farbmaske(spr, umriss_farben)
    if verboten is not None:
        m &= ~verboten
    if kasten is not None:
        h, w = spr.shape[:2]
        yy, xx = np.mgrid[0:h, 0:w]
        m &= (xx >= kasten[0]) & (xx <= kasten[2]) & (yy >= kasten[1]) & (yy <= kasten[3])
    return fuell | m


def gefaelle(werte, start, max_stufe=1):
    """werte = {k: v} über aufeinanderfolgende ganze k; ab `start` nach beiden Seiten so abflachen, dass Nachbarn höchstens `max_stufe` auseinanderliegen."""
    ks = sorted(werte)
    out = dict(werte)
    if start not in out:
        start = min(ks, key=lambda k: abs(k - start))
    for k in range(start + 1, ks[-1] + 1):
        if k in out and k - 1 in out:
            out[k] = max(out[k - 1] - max_stufe, min(out[k - 1] + max_stufe, out[k]))
    for k in range(start - 1, ks[0] - 1, -1):
        if k in out and k + 1 in out:
            out[k] = max(out[k + 1] - max_stufe, min(out[k + 1] + max_stufe, out[k]))
    return out


def spalten_dy(a, dys):
    """Ganze Spalten senkrecht verschieben ({Leinwandspalte: dy}, + = nach unten); ClipError statt Abschneiden."""
    out = L.leer(*a.shape[:2])
    h, w = a.shape[:2]
    for x in range(w):
        ys = np.nonzero(a[:, x, 3])[0]
        if not len(ys):
            continue
        d = int(dys.get(x, 0))
        if ys.min() + d < 0 or ys.max() + d >= h:
            raise L.ClipError(f'Spalte {x} würde um {d} px aus der Leinwand geschoben')
        out[ys + d, x] = a[ys, x]
    return out


def zeilen_dx(a, dxs):
    """Ganze Zeilen waagerecht verschieben ({Leinwandzeile: dx}); ClipError statt Abschneiden."""
    out = L.leer(*a.shape[:2])
    h, w = a.shape[:2]
    for y in range(h):
        xs = np.nonzero(a[y, :, 3])[0]
        if not len(xs):
            continue
        d = int(dxs.get(y, 0))
        if xs.min() + d < 0 or xs.max() + d >= w:
            raise L.ClipError(f'Zeile {y} würde um {d} px aus der Leinwand geschoben')
        out[y, xs + d] = a[y, xs]
    return out


def biegung(x_von, x_bis, x_starr, amp, potenz=1.0):
    """Spaltenversätze eines Halses/Schwanzes: 0 bei x_von, wächst bis x_starr auf round(amp), ab x_starr starr (Kopf, Keule) bis x_bis; Gefälle ≤ 1 px je Spalte.
    x_von kann größer als x_bis sein (Teil zeigt nach links)."""
    s = 1 if x_bis >= x_von else -1
    laenge = max(1, abs(x_starr - x_von))
    roh = {}
    for x in range(x_von, x_bis + s, s):
        f = min(1.0, abs(x - x_von) / float(laenge))
        roh[x] = int(round(amp * f ** potenz))
    return gefaelle(roh, x_von)


def hub(i, starts, verlauf):
    """Hub (px) in Frame i: ab jedem Start in `starts` läuft `verlauf` ab, sonst 0."""
    for s in starts:
        if 0 <= i - s < len(verlauf):
            return verlauf[i - s]
    return 0


def setze(ebene, pixel, dx=0, dy=0):
    """pixel = {(x, y): (r, g, b) oder None (= löschen)} in die Ebene schreiben (Posen von Kiefern, Lidern …)."""
    for (x, y), c in pixel.items():
        if c is None:
            ebene[y + dy, x + dx] = 0
        else:
            ebene[y + dy, x + dx, :3] = c
            ebene[y + dy, x + dx, 3] = 255
    return ebene


def pose_text(zeilen, x0, y0, farben):
    """Handgezeichnete Pose aus Textzeilen → {(x, y): Farbe/None}. Zeichen: Schlüssel in `farben`, '.' = löschen, ' ' = unverändert lassen."""
    out = {}
    for dy, z in enumerate(zeilen):
        for dx, ch in enumerate(z):
            if ch == ' ':
                continue
            out[(x0 + dx, y0 + dy)] = None if ch == '.' else farben[ch]
    return out


def zuschneiden(frames, rand=2):
    """Frames auf die Vereinigung aller Figurenpixel + `rand` px zuschneiden."""
    a = np.stack([f[..., 3] > 0 for f in frames]).any(axis=0)
    ys, xs = np.nonzero(a)
    return [f[ys.min() - rand:ys.max() + rand + 1, xs.min() - rand:xs.max() + rand + 1].copy() for f in frames]


def loecher(f):
    """Anzahl der vom Hintergrund eingeschlossenen freien Pixel (Lücken in der Figur) – zum Vergleich mit dem Original."""
    import cv2
    frei = (f[..., 3] == 0).astype(np.uint8)
    frei = np.pad(frei, 1, constant_values=1)
    n, lab = cv2.connectedComponents(frei, connectivity=4)
    return int((frei > 0).sum() - (lab == lab[0, 0]).sum())


def sinus(i, n, versatz=0.0):
    return math.sin(2 * math.pi * i / float(n) + versatz)


def _nb(m, diagonal):
    p = np.pad(m, 1)
    nb = p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
    if diagonal:
        nb |= p[:-2, :-2] | p[:-2, 2:] | p[2:, :-2] | p[2:, 2:]
    return nb


def bein_paar(spr, fuell_nah, fuell_fern, umriss_farben, y0):
    """Masken eines nahen und eines dahinterliegenden fernen Beins (ab Zeile y0): Füllung + Umriss. Umrisspixel zwischen beiden gehören dem nahen Bein (es liegt vorn),
    außer sie berühren nur die ferne Füllung; Eckpixel (nur diagonal an der Füllung) werden mitgenommen, damit beim Anheben kein Umrissrest stehen bleibt."""
    h, w = spr.shape[:2]
    yy = np.mgrid[0:h, 0:w][0]
    u = L.farbmaske(spr, umriss_farben) & (yy >= y0)
    nah = fuell_nah | (u & _nb(fuell_nah, False)) | (u & _nb(fuell_nah, True) & ~_nb(fuell_fern, False))
    fern = fuell_fern | (u & _nb(fuell_fern, True) & ~nah)
    return nah, fern


def raster_tausch(a, dys, paare):
    """Nach spalten_dy auf einer Schachbrett-Rasterfläche: in Spalten mit ungeradem Versatz die beiden Farben jedes Rasterpaars tauschen – das Raster läuft dann über die
    Biegestufen hinweg lückenlos weiter (keine doppelten Farbspalten an den Stufen). paare = [(farbe1, farbe2), …]."""
    out = a.copy()
    for x, d in dys.items():
        if d % 2 == 0 or not (0 <= x < a.shape[1]):
            continue
        sp = a[:, x]
        for c1, c2 in paare:
            m1 = (sp[:, 0] == c1[0]) & (sp[:, 1] == c1[1]) & (sp[:, 2] == c1[2]) & (sp[:, 3] > 0)
            m2 = (sp[:, 0] == c2[0]) & (sp[:, 1] == c2[1]) & (sp[:, 2] == c2[2]) & (sp[:, 3] > 0)
            out[m1, x, :3] = c2
            out[m2, x, :3] = c1
    return out


def umriss_faerben(a, fuell_farben, regel, standard):
    """Schließt offene Kanten OHNE die Figur zu vergrößern: jedes Pixel in einer Füllfarbe, das mit einer 4er-Kante an freien Hintergrund grenzt, wird selbst zum Umrisspixel
    (Farbe regel[Füllfarbe] bzw. `standard`). Für Scherungen starrer Teile (Kiefer, Schwanz), bei denen ein ergänzter Außenpixel als „Tropfen“ unter der Kante hinge."""
    out = a.copy()
    m = L.deckend(a)
    p = np.pad(m, 1)
    frei = (~p[:-2, 1:-1]) | (~p[2:, 1:-1]) | (~p[1:-1, :-2]) | (~p[1:-1, 2:])
    ok = {tuple(c) for c in fuell_farben}
    for y, x in zip(*np.nonzero(m & frei)):
        c = tuple(int(v) for v in a[y, x, :3])
        if c in ok:
            out[y, x, :3] = regel.get(c, standard)
    return out


def glaetten(a, dys, oben=True, unten=True):
    """Nach spalten_dy: Ein-Spalten-Nasen und -Kerben an Ober-/Unterkante beseitigen, die entstehen, wenn eine Biegestufe eine Spalte neben einer Stufe des Originalumrisses liegt.
    Nur Spalten direkt an einer Biegestufe werden angefasst. Nase: das überstehende Randpixel entfällt, sein (Umriss-)Farbwert rückt auf das Pixel darunter/darüber.
    Kerbe: das Randpixel rückt um 1 nach außen, an seine alte Stelle kommt die Farbe des nächsten Innenpixels. Es entstehen keine neuen Farben; die Kontur bleibt 1 px."""
    out = a.copy()
    h, w = a.shape[:2]
    op = a[..., 3] > 0

    def profil(x, top):
        ys = np.nonzero(op[:, x])[0]
        if not len(ys):
            return None
        return int(ys.min()) if top else int(ys.max())

    for x in range(1, w - 1):
        if dys.get(x, 0) == dys.get(x - 1, 0) and dys.get(x, 0) == dys.get(x + 1, 0):
            continue
        for top in ([True] if oben else []) + ([False] if unten else []):
            y, yl, yr = profil(x, top), profil(x - 1, top), profil(x + 1, top)
            if y is None or yl is None or yr is None or yl != yr:
                continue
            s = 1 if top else -1                                  # Richtung nach innen
            if (yl - y) * s == 1:                                 # Nase: steht 1 px über beide Nachbarn hinaus
                if not out[y + 2 * s, x, 3]:
                    continue
                out[y + s, x] = out[y, x]
                out[y, x] = 0
            elif (y - yl) * s == 1:                               # Kerbe: liegt 1 px tiefer als beide Nachbarn
                if not out[y + s, x, 3]:
                    continue
                out[y - s, x] = out[y, x]
                out[y, x] = out[y + s, x]
    return out


def stufen_legen(a, dys, weite=2):
    """Biegestufen (Spalten, an denen dys wechselt) um bis zu `weite` Spalten so verlegen, dass Ober- und Unterkante der Ebene nach dem Verschieben möglichst wenige
    Doppelstufen (Sprung > 1 px, wo das Original höchstens 1 px springt) und Ein-Spalten-Nasen/-Kerben bekommen. Gibt die neuen Spaltenversätze zurück."""
    op = a[..., 3] > 0
    xs = [x for x in range(a.shape[1]) if op[:, x].any()]
    if not xs:
        return dys
    top = {x: int(np.nonzero(op[:, x])[0].min()) for x in xs}
    bot = {x: int(np.nonzero(op[:, x])[0].max()) for x in xs}
    d = {x: int(dys.get(x, 0)) for x in xs}

    def kosten(dd):
        k = 0
        for prof in (top, bot):
            for x in xs:
                if x + 1 not in prof:
                    continue
                do = prof[x + 1] - prof[x]
                dn = do + dd[x + 1] - dd[x]
                k += 3 * max(0, abs(dn) - max(1, abs(do)))
                if x - 1 in prof:
                    l_, m_, r_ = prof[x - 1] + dd[x - 1], prof[x] + dd[x], prof[x + 1] + dd[x + 1]
                    if l_ == r_ != m_ and not (prof[x - 1] == prof[x + 1] != prof[x]):
                        k += 2
        return k

    grenzen = [x for x in xs if x + 1 in d and d[x] != d[x + 1]]
    for g in grenzen:
        if d[g] == d[g + 1]:
            continue
        links, rechts = d[g], d[g + 1]
        beste, bk = None, None
        for s in sorted(range(-weite, weite + 1), key=abs):
            dd = dict(d)
            ok = True
            if s < 0:
                for x in range(g + s + 1, g + 1):
                    if x not in dd or dd[x] != links:
                        ok = False
                        break
                    dd[x] = rechts
            elif s > 0:
                for x in range(g + 1, g + s + 1):
                    if x not in dd or dd[x] != rechts:
                        ok = False
                        break
                    dd[x] = links
            if not ok:
                continue
            k = kosten(dd)
            if bk is None or k < bk:
                beste, bk = dd, k
        d = beste
    out = dict(dys)
    out.update(d)
    return out


def biegen(a, dys, raster=None, oben=True, unten=True):
    """Ebene spaltenweise biegen: Stufen günstig legen (stufen_legen), verschieben, Raster fortführen (raster_tausch), Nasen glätten."""
    dys = stufen_legen(a, dys)
    out = spalten_dy(a, dys)
    if raster:
        out = raster_tausch(out, dys, raster)
    return glaetten(out, dys, oben, unten)


def linie(x0, y0, x1, y1):
    """Bresenham-Linie (1 px, 8-verbunden) von (x0, y0) nach (x1, y1)."""
    pts = []
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    err = dx + dy
    while True:
        pts.append((x0, y0))
        if x0 == x1 and y0 == y1:
            return pts
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy


def dorn(ebene, fuss, spitze, winkel, farbe, farbe_spitze=None):
    """Starrer 1-px-Dorn: Linie vom Fuß zur um `winkel` (Bogenmaß, um den Fuß) geschwenkten Spitze neu zeichnen (keine Bilddrehung – die Linie wird im Raster neu gesetzt)."""
    c, s = math.cos(winkel), math.sin(winkel)
    vx, vy = spitze[0] - fuss[0], spitze[1] - fuss[1]
    tx, ty = int(round(fuss[0] + c * vx - s * vy)), int(round(fuss[1] + s * vx + c * vy))
    pts = linie(fuss[0], fuss[1], tx, ty)
    for k, (x, y) in enumerate(pts):
        if not (0 <= y < ebene.shape[0] and 0 <= x < ebene.shape[1]):
            raise L.ClipError(f'Dorn bei ({x},{y}) außerhalb der Leinwand')
        ebene[y, x, :3] = farbe_spitze if (farbe_spitze and k == len(pts) - 1) else farbe
        ebene[y, x, 3] = 255
    return ebene
