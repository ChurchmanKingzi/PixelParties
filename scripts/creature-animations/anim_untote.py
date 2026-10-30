# -*- coding: utf-8 -*-
"""Gemeinsame Bausteine für die Gruppe „Untote, Dämonen, Konstrukte, Yokai, Sonstiges“ (baut auf anim_lib auf, ändert sie nicht).

Alles Pixelart: nur ganze Pixel, kein Alpha, nur Farben, die schon im Sprite stehen. Alle Funktionen erwarten Ebenen, die
bereits auf der VOLLEN Leinwand liegen (L.platz) und werfen ClipError, wenn etwas herausragen würde.

    stufe(i, n, stufen, versatz)              # 0 … stufen, sanft wiederkehrend, Ruhepose (Stufe 0) bei i = 0
    puls(i, start, folge)                     # kurze Impulsfolge (Ohrenzucken, Blinzeln, Glanz): 1 in den Frames der Folge
    haengen(a, pivot_y, ausschlag, potenz)    # hängendes Teil (Arm, Fetzen, Quaste) schwingt: Zeilenversatz wächst mit dem Abstand
    pixel_setzen(a, punkte, farbe, dx, dy)    # einzelne Pixel einfärben (Augen, Glanzpunkte)
    augen(a, gruppen, stufe, ...)             # Glühen der Augen in Stufen (nur Farben der Rampe aus dem Sprite)
    kiefer(a, zaehne, farbe, innen, tiefe)    # Kiefer klappt auf/zu (Zähne rutschen nach unten, Mundinneres füllt nach)
    band_diagonal(a, punkte, rampe, d)        # Lichtband wandert diagonal über ein glänzendes Objekt (eine Stufe heller)
    stern_ebene(h, w, cx, cy, stufe, mitte, arm)   # vierzackiger Glitzerstern am Objekt (Stufe 1 → 2 → 1)
    blitz_ebene(h, w, ax, ay, muster, spiegel, kern, akzent)   # kleiner Zickzack-Blitz (2–5 px) an einer Hand
    kontur_schliessen(f, erlaubt, standard)   # Regel 16: fehlende Umrisspixel an bewegten Teilen ergänzen (Randpixel-Test)
    glanz_pfad(a, pfad, hell, basis, pos)     # ein Lichtpunkt wandert an einem Horn/Knochen/Klinge entlang
    glut_ebene(h, w, i, n, puffs, farben)     # Funken/Glut aufsteigend (puff_ebene, aber mit Verglimmen an Anfang und Ende)
"""
import math

import numpy as np

import anim_lib as L


def stufe(i, n, stufen=2, versatz=0.0, form='cos'):
    """Ganze Stufe 0 … stufen, die sich einmal pro n Frames auf- und abbaut (0 bei i = 0 bei versatz = 0).
    form='cos': 0 → stufen → 0 weich (1 − cos); 'sin': Ausgangslage in der Mitte (schwingt ±stufen/2 um die Mitte)."""
    ph = L.sinus(i, n, versatz)
    if form == 'sin':
        return int(round(stufen / 2.0 * (1 + math.sin(ph))))
    return int(round(stufen / 2.0 * (1 - math.cos(ph))))


def buckel(i, start, dauer, n=None):
    """Weiche Welle 0 → 1 → 0 über `dauer` Frames ab `start` (sonst 0): für einzelne Bewegungen, die in der Ruhepose (Frame 0) beginnen."""
    k = i - start
    if n:
        k %= n
    if not 0 <= k < dauer:
        return 0.0
    return 0.5 * (1 - math.cos(2 * math.pi * k / dauer))


def puls(i, start, folge, n=None):
    """1, wenn Frame i in der Impulsfolge liegt: `folge` ist eine Liste von 0/1 ab Frame `start` (zyklisch bei n)."""
    k = i - start
    if n:
        k %= n
    return folge[k] if 0 <= k < len(folge) else 0


def haengen(a, pivot_y, ausschlag, potenz=1.0, nach_unten=True):
    """Hängendes Teil schwingt waagerecht: Zeile y wandert um round(ausschlag · (Abstand zum Pivot / größter Abstand)^potenz).
    `ausschlag` in Pixeln (mit Vorzeichen) an der am weitesten entfernten Zeile. An der Aufhängung (pivot_y) bleibt alles stehen."""
    out = L.leer(*a.shape[:2])
    h, w = a.shape[:2]
    zeilen = [y for y in range(h) if a[y, :, 3].any() and ((y > pivot_y) if nach_unten else (y < pivot_y))]
    fest = [y for y in range(h) if a[y, :, 3].any() and y not in zeilen]
    maxd = max([abs(y - pivot_y) for y in zeilen], default=1)
    for y in fest:
        out[y] = a[y]
    for y in zeilen:
        dx = int(round(ausschlag * (abs(y - pivot_y) / maxd) ** potenz))
        xs_ = np.nonzero(a[y, :, 3])[0]
        if xs_.min() + dx < 0 or xs_.max() + dx >= w:
            raise L.ClipError(f'Zeile {y} würde um {dx} px aus der Leinwand (Breite {w}) geschoben')
        for x in xs_:
            out[y, x + dx] = a[y, x]
    return out


def pixel_setzen(a, punkte, farbe, dx=0, dy=0, nur_deckend=True):
    """Pixel `punkte` (Liste (x, y) in Leinwandkoordinaten) auf `farbe` setzen; mit nur_deckend nur dort, wo schon etwas steht."""
    for (x, y) in punkte:
        x, y = x + dx, y + dy
        if nur_deckend and not a[y, x, 3]:
            continue
        a[y, x, :3] = farbe
        a[y, x, 3] = 255
    return a


def augen(a, gruppen, stufe_glut=0, blinzeln=0, farben=None):
    """Augen in Stufen (nur Farben, die der Sprite schon hat).
    gruppen: Liste von dict(hell=[(x,y)…], rand=[(x,y)…]) in Leinwandkoordinaten (hell = leuchtende Pixel, rand = Brauen-/Randpixel).
    farben: dict(hell=Ruhefarbe, glut=[Stufe1, Stufe2], rand=Ruhefarbe, lid=Farbe, lid_dunkel=Farbe).
    stufe_glut 0 = Original, 1/2 = schwächer glimmend. blinzeln 1 = halb zu, 2 = zu."""
    for g in gruppen:
        if blinzeln == 0:
            if stufe_glut:
                pixel_setzen(a, g['hell'], farben['glut'][stufe_glut - 1])
        elif blinzeln == 1:
            pixel_setzen(a, g['hell'], farben['glut'][-1])
            pixel_setzen(a, g['rand'], farben['lid'])
        else:
            pixel_setzen(a, g['hell'], farben['lid_dunkel'])
            pixel_setzen(a, g['rand'], farben['lid'])
    return a


def kiefer(a, zaehne, zahn_farbe, innen_farbe, tiefe, ox=0, oy=0):
    """Kiefer klappt auf: die Zahnpixel `zaehne` (Liste (x, y) im Sprite) rutschen um `tiefe` Zeilen nach unten, die frei werdenden
    Plätze werden zum Mundinneren (`innen_farbe`, eine Farbe, die der Mund im Sprite schon hat). ox/oy = Versatz Sprite → Leinwand.
    Muss auf der Rumpf-/Kopfebene VOR dem Strecken/Verschieben laufen. tiefe = 0 ändert nichts."""
    if tiefe <= 0:
        return a
    alt = [(x + ox, y + oy) for x, y in zaehne]
    neu = [(x, y + tiefe) for x, y in alt]
    for (x, y) in alt:
        a[y, x, :3] = innen_farbe
        a[y, x, 3] = 255
    for (x, y) in neu:
        a[y, x, :3] = zahn_farbe
        a[y, x, 3] = 255
    return a


def glut_ebene(h, w, i, n, puffs, farben, rand=0.06):
    """Wie L.puff_ebene, aber jedes Teilchen fehlt in den ersten/letzten `rand` seiner Lebensdauer: der Funke verglimmt am Ende und
    entsteht am Start neu, statt als einzelnes Pixel quer über das Bild zu springen (puff_ebene zeigt Funken immer)."""
    out = L.leer(h, w)
    for pf in puffs:
        t = ((i + pf.get('off', 0)) % n) / n
        if t < rand or t > 1 - rand:
            continue
        L.einsetzen(out, L.puff_ebene(h, w, i, n, [pf], farben))
    return out


def band_diagonal(a, punkte, rampe, d, breite=2, ox=0, oy=0):
    """Lichtband: alle Pixel aus `punkte` (Sprite-Koordinaten (x, y)), deren Diagonale x + y in [d, d + breite) liegt, werden um eine
    Stufe der Farbrampe `rampe` ({Farbe: hellere Farbe}, alles Farben des Sprites) heller. d wandert von Frame zu Frame
    (diagonal über das Objekt, z. B. d = start + Schritt). ox/oy = Versatz Sprite → Leinwand. Pixel, die nicht in der Rampe stehen, bleiben."""
    for (x, y) in punkte:
        if d <= x + y < d + breite:
            col = tuple(int(v) for v in a[y + oy, x + ox, :3])
            if a[y + oy, x + ox, 3] and col in rampe:
                a[y + oy, x + ox, :3] = rampe[col]
    return a


def stern_ebene(h, w, cx, cy, stufe, mitte, arm):
    """Vierzackiger Glitzerstern (Pixelart) um die Leinwandposition (cx, cy): stufe 1 = nur Mitte, 2 = Mitte + 4 Arme à 1 px,
    3 = Mitte + 4 Arme à 2 px, 0 = nichts. Der Stern wächst/schrumpft über die Stufen und bleibt am Objekt (wird NACH der Figur gelegt).
    ClipError, wenn er aus der Leinwand ragen würde."""
    e = L.leer(h, w)
    if stufe <= 0:
        return e
    pts = [(0, 0, mitte)]
    n = {1: 0, 2: 1, 3: 2}[min(stufe, 3)]
    for k in range(1, n + 1):
        pts += [(k, 0, arm), (-k, 0, arm), (0, k, arm), (0, -k, arm)]
    for dx, dy, col in pts:
        x, y = cx + dx, cy + dy
        if not (0 <= x < w and 0 <= y < h):
            raise L.ClipError(f'Stern bei ({x},{y}) liegt außerhalb der Leinwand {w}×{h}')
        e[y, x, :3] = col
        e[y, x, 3] = 255
    return e


# Kleine Pixel-Blitze: 4-verbundene Zickzack-Pfade aus 3–6 Pixeln (Länge 2–5 px), keine Kreuzform.
BLITZ_MUSTER = [
    [(0, 0), (1, 0), (1, 1), (2, 1), (2, 2), (3, 2)],            # Treppe nach rechts unten
    [(0, 0), (0, 1), (1, 1), (1, 2), (0, 2), (0, 3)],            # Zickzack nach unten
    [(0, 0), (1, 0), (1, -1), (2, -1), (2, 0), (3, 0)],          # Zickzack waagerecht
    [(0, 0), (0, -1), (1, -1), (1, -2), (2, -2), (2, -3)],       # Treppe nach rechts oben
    [(0, 0), (-1, 0), (-1, -1), (-2, -1)],                       # kurz, nach links oben
    [(0, 0), (0, 1), (-1, 1), (-1, 2), (0, 2)],                  # Zickzack nach unten links
    [(0, 0), (1, 0), (1, 1), (1, 2), (2, 2)],                    # Haken
    [(0, 0), (0, -1), (-1, -1), (-1, -2), (0, -2), (0, -3)],     # Zickzack nach oben
]


def blitz_ebene(h, w, ax, ay, muster, spiegel, kern, akzent, laenge=None):
    """Kleiner Zickzack-Blitz ab (ax, ay): `muster` (Index in BLITZ_MUSTER), spiegel=True spiegelt waagerecht (rechte Hand).
    kern = Hauptfarbe, akzent = Farbe für Spitze und ein Zwischenpixel (beides Farben des Sprites). laenge kürzt auf die ersten n Pixel.
    ClipError, wenn der Blitz aus der Leinwand ragen würde."""
    e = L.leer(h, w)
    pf = BLITZ_MUSTER[muster % len(BLITZ_MUSTER)]
    if laenge:
        pf = pf[:laenge]
    for k, (dx, dy) in enumerate(pf):
        x, y = ax + (-dx if spiegel else dx), ay + dy
        if not (0 <= x < w and 0 <= y < h):
            raise L.ClipError(f'Blitz bei ({x},{y}) liegt außerhalb der Leinwand {w}×{h}')
        e[y, x, :3] = akzent if (k == len(pf) - 1 or k == 2) else kern
        e[y, x, 3] = 255
    return e


def kanten(a):
    """Maske der deckenden Pixel, die an Transparentes grenzen (4er-Nachbarschaft)."""
    m = a[..., 3] > 0
    q = np.pad(m, 1)
    frei = (~q[:-2, 1:-1]) | (~q[2:, 1:-1]) | (~q[1:-1, :-2]) | (~q[1:-1, 2:])
    return m & frei


def umrissfarben(spr):
    """Farben der Randpixel des Quell-Sprites (= Umriss- und Randfarben, an denen der Randpixel-Test nichts beanstandet)."""
    e = kanten(spr)
    return {tuple(int(v) for v in spr[y, x, :3]) for y, x in zip(*np.nonzero(e))}


def kontur_schliessen(f, erlaubt, standard):
    """Randpixel-Test (Regel 16): Ein deckendes Randpixel in einer Farbe, die im Quell-Sprite nie am Rand liegt (Fell, Füllung …), bekommt an seinen freien
    4er-Nachbarplätzen ein Umrisspixel. Farbe = häufigste Umrissfarbe (aus `erlaubt`) in der 3×3-Umgebung des neuen Pixels, sonst `standard`.
    Im Ruhebild (Randfarben = Quellrand) tut die Funktion nichts. Gibt eine neue Ebene zurück; ClipError, wenn ein Umrisspixel aus der Leinwand ragen würde."""
    h, w = f.shape[:2]
    out = f.copy()
    neu = {}
    for y, x in zip(*np.nonzero(kanten(f))):
        if tuple(int(v) for v in f[y, x, :3]) in erlaubt:
            continue
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            ty, tx = y + dy, x + dx
            if not (0 <= ty < h and 0 <= tx < w):
                raise L.ClipError(f'Umrisspixel bei ({tx},{ty}) liegt außerhalb der Leinwand {w}×{h}')
            if f[ty, tx, 3]:
                continue
            zaehl = {}
            for ny in range(max(0, ty - 1), min(h, ty + 2)):
                for nx in range(max(0, tx - 1), min(w, tx + 2)):
                    if f[ny, nx, 3]:
                        col = tuple(int(v) for v in f[ny, nx, :3])
                        if col in erlaubt:
                            zaehl[col] = zaehl.get(col, 0) + 1
            neu[(ty, tx)] = max(zaehl, key=zaehl.get) if zaehl else tuple(standard)
    for (ty, tx), col in neu.items():
        out[ty, tx, :3] = col
        out[ty, tx, 3] = 255
    return out


def glanz_pfad(a, pfad, hell, basis, pos):
    """Lichtpunkt an einem Pfad (Liste (x, y)): nur das Pixel `pos` (Index) wird `hell`, aber nur, wenn dort gerade `basis` steht."""
    if pos is None or not 0 <= pos < len(pfad):
        return a
    x, y = pfad[pos]
    if a[y, x, 3] and tuple(int(v) for v in a[y, x, :3]) == tuple(basis):
        a[y, x, :3] = hell
    return a
