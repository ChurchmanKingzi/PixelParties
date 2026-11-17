# -*- coding: utf-8 -*-
"""Gemeinsame Bausteine für die Gruppe „Dämonen, Geister, Reittier“ (Cycling Demons, Ifrit, Pyraga, Hockey Genie, Night Mare, Great Vanguard Demon, Herbithorn Demon).

Baut auf anim_lib / anim_untote / anim_flieger / anim_amorph auf und ändert sie nicht. Alles Pixelart: nur ganze Pixel, kein Alpha, nur Quellfarben.
Alle Funktionen erwarten Ebenen, die schon auf der VOLLEN Leinwand liegen (L.platz) und werfen ClipError, wenn etwas herausragen würde.

    flip_v(a)                                    # senkrecht spiegeln (für Flammen, die nach unten brennen, und Teile über einem Pivot)
    oben_pendel(a, pivot_y, amp, phase, …)       # Ohr/Fühler/Schlange über dem Pivot schwingt seitlich (Wellenlauf `lauf`, 4-verbunden)
    seiten_welle(a, pivot_x, amp, phase, …)      # waagerechtes Teil (Ranke, Schwanz, Stock) wellt senkrecht; verbunden; Ruhe bei phase = 0
    punkte_farbe(a, punkte, farbe, ox, oy)       # einzelne Pixel einfärben (Blinzeln)
    teil_maske(spr, regeln)                      # Hilfen zum Maskenbau
    schluss(...)                                 # Zuschnitt + Schreiben + Prüfen wie in den Vorlagen
"""
import math

import numpy as np

import anim_lib as L
import anim_flieger as F
import anim_untote as U


def flip_v(a):
    return a[::-1].copy()


def oben_pendel(a, pivot_y, amp, phase, potenz=1.0, lauf=0.0):
    """Zeilen OBERHALB von pivot_y wandern waagerecht um round(amp · f^potenz · (sin(phase − lauf·f) − sin(−lauf·f))), f = (pivot_y − y)/maxAbstand.
    Bei phase = 0 steht alles auf der Originalposition. Hängt die Zeile im Original an der Zeile darunter (8er-Nachbarschaft), bleibt sie nach dem Versatz mit ihr
    verbunden (sonst übernimmt sie deren Versatz) — dünne Ohren/Fühler/Schlangenhälse reißen nicht ab."""
    h = a.shape[0]
    return flip_v(F.zeilen_pendel(flip_v(a), h - 1 - pivot_y, amp, phase, potenz, lauf))


def unten_pendel(a, pivot_y, amp, phase, potenz=1.0, lauf=0.0):
    """Wie oben_pendel, nur für Zeilen UNTERHALB von pivot_y (hängende Teile)."""
    return F.zeilen_pendel(a, pivot_y, amp, phase, potenz, lauf)


def seiten_welle(a, pivot_x, amp, phase, potenz=1.0, lauf=0.0, nur_rechts=None, zusammenhang=True):
    """Senkrechter Spaltenversatz wächst mit dem Abstand zu pivot_x (positiv = nach unten), mit Wellenlauf; bei phase = 0 Ruhepose = Original.
    zusammenhang=True: dünne Linien bleiben 4-verbunden (anim_flieger.fluegel_welle)."""
    return F.fluegel_welle(a, pivot_x, amp, phase, potenz=potenz, nur_rechts=nur_rechts, lauf=lauf, zusammenhang=zusammenhang)


def punkte_farbe(a, punkte, farbe, ox=0, oy=0):
    """Pixel (Sprite-Koordinaten) einfärben, nur wo etwas steht."""
    for (x, y) in punkte:
        if a[y + oy, x + ox, 3]:
            a[y + oy, x + ox, :3] = farbe
    return a


def spalten_stufen(a, x0, x1, dy_je_spalte):
    """Spalten x0..x1 (Leinwandkoordinaten) um dy_je_spalte[x] senkrecht verschieben (ganze Spalten, Textur bleibt)."""
    out = a.copy()
    h = a.shape[0]
    for x in range(x0, x1 + 1):
        dy = dy_je_spalte.get(x, 0)
        if not dy:
            continue
        col = a[:, x].copy()
        out[:, x] = 0
        ys = np.nonzero(col[:, 3])[0]
        if not len(ys):
            continue
        if ys.min() + dy < 0 or ys.max() + dy >= h:
            raise L.ClipError(f'Spalte {x} würde um {dy} px aus der Leinwand (Höhe {h}) geschoben')
        for y in ys:
            out[y + dy, x] = col[y]
    return out


def zuschnitt_aus(frame_fn, n, ruhe, zugabe=2, nur_figur=None):
    """Box (x0,y0,x1,y1) wie in den Vorlagen: symmetrisch um die Ruhefigur `ruhe`; `frame_fn(i)` = Frame mit Effekten, `nur_figur(i)` = ohne Partikel."""
    voll = [frame_fn(i) for i in range(n)]
    koerper = [(nur_figur or frame_fn)(i) for i in range(n)]
    return U.zuschnitt(voll, koerper, ruhe, zugabe=zugabe)


def klekse_ebene(h, w, i, n, puffs, farben, formen=('s', 'o', 's'), rand=0.08):
    """Runde Klekse (nie kleiner als 2×2, keine Kreuz-/Rautenform, keine einzelnen 1-px-Punkte): jedes Teilchen wächst `formen[0]` → `formen[1]` → `formen[2]`
    (Formen aus anim_lib.PUFF_FORMEN: 's' 2×2, 'o' 4×4 rund, 'm' 5×3, 'l' 7×5) und fehlt in den ersten/letzten `rand` seiner Lebensdauer (kein Springen).
    puffs: dict(x, y, vx, vy, off, wackeln, formen=…) wie bei L.puff_ebene; farben = {'c': Kern, 'r': Rand}. ClipError, wenn etwas aus der Leinwand ragt."""
    out = L.leer(h, w)
    for pf in puffs:
        t = ((i + pf.get('off', 0)) % n) / n
        if t < rand or t > 1 - rand:
            continue
        fo = pf.get('formen', formen)
        form = fo[0] if t < 0.3 else (fo[1] if t < 0.7 else fo[2])
        cx = pf['x'] + pf.get('vx', 0) * t + pf.get('wackeln', 0) * math.sin(2 * math.pi * t)
        cy = pf['y'] + pf.get('vy', 0) * t
        cx, cy = int(round(cx)), int(round(cy))
        for (dx, dy, k) in L.PUFF_FORMEN[form]:
            x, y = cx + dx, cy + dy
            if not (0 <= y < h and 0 <= x < w):
                raise L.ClipError(f'Klecks bei ({x},{y}) liegt außerhalb der Leinwand {w}×{h}')
            out[y, x, :3] = farben[k]
            out[y, x, 3] = 255
    return out


def fuelle_oben(neu, alt, stuetze):
    """Spaltenwelle senkt eine Spalte von `alt` nach `neu` (Schwanz unter dem Rumpf): die frei werdenden obersten Zellen werden mit dem obersten Pixel der Spalte gefüllt,
    wenn die Spalte im Original oben an `stuetze` (Bool-Maske des Rumpfes) anschloss — der Schwanz bleibt am Rumpf angewachsen. Gibt eine neue Ebene zurück."""
    out = neu.copy()
    h, w = alt.shape[:2]
    for x in range(w):
        ys_a = np.nonzero(alt[:, x, 3])[0]
        ys_n = np.nonzero(neu[:, x, 3])[0]
        if not len(ys_a) or not len(ys_n):
            continue
        y0, y1 = int(ys_a.min()), int(ys_n.min())
        if y1 > y0 and y0 > 0 and stuetze[y0 - 1, x]:
            for y in range(y0, y1):
                if not out[y, x, 3]:
                    out[y, x] = alt[y0, x]
    return out


def schlange_aussen(a, pivot_y, amp, i, n, lauf=1.2, potenz=1.0, ruhe_frame=0):
    """Hängender Schlangenarm schwingt NUR nach rechts (+x) aus und zurück — gleichmäßig und ohne Zucken (Nutzerkorrektur Runde 3, Serpentous).
    Zeilen unterhalb von pivot_y: dx(y) = round(amp · f^potenz · max(0, S(i) − S(0)) / (1 − S(0))), f = (y − pivot_y)/maxAbstand, S(t) = sin(2π t/n − lauf · f).
    Die Welle läuft von der Wurzel zur Spitze (die Spitze hinkt hinterher); Frame 0 ist exakt die Ruhepose. Damit der Arm 4-verbunden bleibt, ändert sich dx von Zeile zu Zeile höchstens um 1
    (kein Versatz-Sprung zwischen Nachbarzeilen, kein Einfrieren wie bei zeilen_pendel); die Zeilen oberhalb und die Pivotzeile stehen fest."""
    h, w = a.shape[:2]
    ys = [y for y in range(h) if a[y, :, 3].any() and y > pivot_y]
    maxd = max(1, max(ys) - pivot_y) if ys else 1
    out = L.leer(h, w)
    dxs = {}
    prev = 0
    for y in range(h):
        if not a[y, :, 3].any():
            continue
        if y <= pivot_y:
            dx = 0
        else:
            f = (y - pivot_y) / maxd
            s0 = math.sin(-lauf * f)
            s = math.sin(2 * math.pi * (i - ruhe_frame) / n - lauf * f)
            u = max(0.0, (s - s0) / (1 - s0))
            dx = int(round(amp * f ** potenz * u))
            dx = max(prev - 1, min(prev + 1, dx))
        dxs[y] = dx
        prev = dx
        xs_ = np.nonzero(a[y, :, 3])[0]
        if xs_.max() + dx >= w or xs_.min() + dx < 0:
            raise L.ClipError(f'Zeile {y} würde um {dx} px aus der Leinwand (Breite {w}) geschoben')
        for x in xs_:
            out[y, x + dx] = a[y, x]
    return out
