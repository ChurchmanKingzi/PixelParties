# -*- coding: utf-8 -*-
"""Gemeinsamer Hilfscode der Gruppe „Flieger“ (geflügelte/fliegende Creatures) — baut auf anim_lib auf.

Bausteine, die bei mehreren Fliegern gebraucht werden:

    ebene(spr, maske, h, w, pad_l, pad_t)      Teil des Sprites ausschneiden und sofort auf die volle Leinwand legen
    ergaenzen(spr, {(x, y): farbe})            fertiggezeichnete Pixel einsetzen → (Sprite-Kopie, Maske der Pixel)
    farbe_von(spr, x, y)                       RGB eines Sprite-Pixels (damit Farben nie „erfunden“ werden)
    spalte_dy(ebene, pivot_x, amp, ph, x, …)   Versatz einer Flügelspalte (gleiche Rechnung wie L.spalten_welle) — für
                                               starre Anbauteile (Edelstein, Spange), die auf dem Flügel mitwandern
    setze(ebene, pad_l, pad_t, {(x, y): farbe}, dy=0)   einzelne Pixel überschreiben (Blinzeln, Glanz, Funkeln)
    glanz_pfad(i, n, start, pfad, laenge)      welche Pfadpunkte zum Frame i „aufglänzen“ (Lichtreflex wandert an einer Linie entlang)
    fluegel_welle(a, pivot_x, amp, phase, …)   wie L.spalten_welle, aber mit Wellenlauf UND Ruhepose bei phase = 0 (Spitze hinkt nach)
    zeilen_schub(a, pivot_y, amp, s, potenz)   Zeilen wandern waagerecht um round(amp·f^potenz·s), f = Abstand zur Pivotzeile (0…1), s ∈ [0,1]:
                                               ein Teil klappt NUR in eine Richtung auf (Flügel/Arm spreizt sich nach außen), Ruhe bei s = 0
    flammen_spitzen(a, phase, farbe, …)        Flammenzungen züngeln: die oberste Pixelreihe jeder Spalte (Farbe `farbe`) wird 0…2 px länger/kürzer,
                                               je Spalte andere Phase (nur Spaltenenden, bleibt 4-verbunden)
    heller(farbe, rampe, stufen)               Farbe um `stufen` Stufen auf einer Rampe (dunkel → hell, Farben des Sprites) verschieben
    lichtband(ebene, maske, pad_l, pad_t, i, n, start, dauer, rampe, …)   diagonales Lichtband wandert über die Pixel von `maske`
    stern_stufe(i, n, start, folge)            Phase eines Glitzer-Sterns (0 = nur Mitte, 1 = Arme 1 px, 2 = Arme 2 px) oder None
    stern(ebene, x, y, stufe, kern, arm1, arm2)  vierzackiger Glitzer-Stern (Mitte + 4 Arme) auf eine fertige Leinwand-Ebene
    puls(i, n, x, y, versatz, periode)         0/1-Puls pro Pixel (Facetten pulsieren, wandern über das Objekt)
    zeilen_pendel(a, pivot_y, amp, phase, …)   nur Zeilen UNTER dem Pivot pendeln waagerecht (Beine/Schwanz/Hinterleib), je tiefer, desto mehr
    kipp_dy(x, pivot_x, amp, phase, maxd)      Versatz der Spalte x beim Kippen (Wippe um pivot_x, vorzeichenbehaftet)
    spalten_kippen(a, pivot_x, amp, phase)     ganze Figur wippt um pivot_x (links hoch, rechts runter und umgekehrt), Spalten bleiben ganz
    feuer_zungen(a, i, n, kern_farben, …)      Feuer (Regel 15): breite ruhige Basis, Zungen steigen auf und flackern unregelmäßig in Posen à 2–3 Frames,
                                               je Zunge versetzt; die Farbfolge (Spitze rot, Mitte orange, Kern hell) wandert mit der Zunge
    zungen_spitzen(a, kern_farben, max_y)      Spitzen (Spalte, Zeile) der Zungen — Startpunkte für abreißende Funken
    kacheln(frames, x0, x1, y0, y1, sc)        Ausschnitt mehrerer Frames nebeneinander, ganzzahlig vergrößert (Nahaufnahme für Nähte)
    stapeln(bilder)                            PIL-Bilder untereinander zu einem Kontrollbild
"""
import math

import numpy as np
from PIL import Image

import anim_lib as L


def farbe_von(spr, x, y):
    return tuple(int(v) for v in spr[y, x, :3])


def ebene(spr, maske, h, w, pad_l, pad_t):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, h, w, pad_l, pad_t)


def ergaenzen(spr, pixel):
    """Pixel {(x, y): (r, g, b)} deckend einsetzen. Gibt (Kopie, Maske der eingesetzten Pixel) zurück."""
    out = spr.copy()
    m = np.zeros(spr.shape[:2], bool)
    for (x, y), c in pixel.items():
        out[y, x, :3] = c
        out[y, x, 3] = 255
        m[y, x] = True
    return out, m


def spalte_dy(a, pivot_x, amp, phase, x, potenz=1.0, bias=0.0, lauf=0.0, nur_rechts=None):
    """Senkrechter Versatz der Spalte x — exakt die Rechnung von L.spalten_welle (gleiches maxd aus der Ebene `a`)."""
    h, w = a.shape[:2]
    maxd = max(1, max(abs(c - pivot_x) for c in range(w) if a[:, c, 3].any()))
    d = x - pivot_x
    if nur_rechts is True and d < 0 or nur_rechts is False and d > 0:
        return 0
    frac = abs(x - pivot_x) / maxd
    return int(round((amp * math.sin(phase - lauf * frac) + bias) * frac ** potenz))


def setze(a, pad_l, pad_t, pixel, dy=0):
    """Pixel {(x, y): (r, g, b)} (Sprite-Koordinaten) auf der Leinwand überschreiben; die Ebene muss dort schon Pixel haben
    oder das Ziel liegt auf der Leinwand (kein Abschneiden)."""
    for (x, y), c in pixel.items():
        a[pad_t + y + dy, pad_l + x, :3] = c
        a[pad_t + y + dy, pad_l + x, 3] = 255
    return a


def glanz_pfad(i, n, start, pfad, laenge=2):
    """Index-Liste der Pfadpunkte, die im Frame i leuchten: ein Lichtreflex der Länge `laenge` wandert ab Frame `start`
    einen Punkt pro Frame den Pfad entlang und ist dann weg, bis die Schleife wieder bei `start` ankommt."""
    k = (i - start) % n
    return [j for j in range(len(pfad)) if 0 <= k - j < laenge]


def kacheln(frames, x0, x1, y0, y1, sc, hintergrund=(40, 30, 70)):
    """Ausschnitt [x0,x1)×[y0,y1) (Leinwandkoordinaten) jedes Frames nebeneinander, Nächster-Nachbar um `sc` vergrößert."""
    tiles = []
    for f in frames:
        c = f[y0:y1, x0:x1]
        bg = Image.new('RGBA', (c.shape[1], c.shape[0]), hintergrund + (255,))
        bg.alpha_composite(Image.fromarray(c.astype(np.uint8)))
        tiles.append(bg.resize((c.shape[1] * sc, c.shape[0] * sc), Image.NEAREST).convert('RGB'))
    w = sum(t.width + 6 for t in tiles) - 6
    out = Image.new('RGB', (w, tiles[0].height), (12, 10, 20))
    x = 0
    for t in tiles:
        out.paste(t, (x, 0))
        x += t.width + 6
    return out


def stapeln(bilder):
    w = max(b.width for b in bilder)
    h = sum(b.height + 8 for b in bilder) - 8
    out = Image.new('RGB', (w, h), (12, 10, 20))
    y = 0
    for b in bilder:
        out.paste(b, (0, y))
        y += b.height + 8
    return out


def fluegel_welle(a, pivot_x, amp, phase, potenz=1.0, nur_rechts=None, lauf=0.0, zusammenhang=False):
    """Wie L.spalten_welle (senkrechter Spaltenversatz wächst mit dem Abstand zum Gelenk, Positiv = nach unten), aber der
    Wellenlauf (`lauf`: die Spitze hinkt der Wurzel hinterher) ist so verschoben, dass bei phase = 0 JEDE Spalte genau auf
    ihrer Originalposition steht (Ruhepose = Original). Spalten auf der nicht bewegten Seite des Gelenks (nur_rechts) bleiben stehen.
    zusammenhang=True: Ist eine Spalte nach dem Versatz von ihrer Nachbarspalte zur Wurzel hin nicht mehr 4-verbunden (kein gemeinsames
    Zeilenpixel mehr, z. B. dünne Flügelspitzen aus 1–2 Pixeln), übernimmt sie deren Versatz — die Spitze reißt nicht ab."""
    out = L.leer(*a.shape[:2])
    h, w = a.shape[:2]
    maxd = max(1, max(abs(x - pivot_x) for x in range(w) if a[:, x, 3].any()))
    dys = {}
    for x in range(w):
        if not a[:, x, 3].any():
            continue
        d = x - pivot_x
        if nur_rechts is True and d < 0 or nur_rechts is False and d > 0:
            dys[x] = 0
        else:
            frac = abs(d) / maxd
            dys[x] = int(round(amp * (math.sin(phase - lauf * frac) - math.sin(-lauf * frac)) * frac ** potenz))
    if zusammenhang:
        links = sorted((x for x in dys if x < pivot_x), reverse=True)        # von der Wurzel nach außen
        rechts = sorted(x for x in dys if x > pivot_x)
        for reihe, innen in ((links, 1), (rechts, -1)):
            for x in reihe:
                xi = x + innen
                if xi not in dys:
                    continue
                r0 = set(np.nonzero(a[:, x, 3])[0].tolist()), set(np.nonzero(a[:, xi, 3])[0].tolist())
                war = bool(r0[0] & r0[1])                                   # im Original verbunden?
                neu = {y + dys[x] for y in r0[0]} & {y + dys[xi] for y in r0[1]}
                if war and not neu:
                    dys[x] = dys[xi]
    for x, dy in dys.items():
        ys = np.nonzero(a[:, x, 3])[0]
        if ys.min() + dy < 0 or ys.max() + dy >= h:
            raise L.ClipError(f'Spalte {x} würde um {dy} px aus der Leinwand (Höhe {h}) geschoben')
        for y in ys:
            out[y + dy, x] = a[y, x]
    return out


def zeilen_schub(a, pivot_y, amp, s, potenz=1.0):
    """Zeilen wandern waagerecht um round(amp · f**potenz · s); f = |y − pivot_y| / maxAbstand (0…1), s ∈ [0, 1].
    Anders als L.zeilen_welle (sin: hin und her) geht es nur in eine Richtung (Vorzeichen von amp) und ruht bei s = 0 —
    z. B. ein angelegter Flügel, der sich nach außen spreizt. Zeilen oberhalb und unterhalb des Pivots wandern gleich weit je Abstand."""
    out = L.leer(*a.shape[:2])
    h, w = a.shape[:2]
    maxd = max(1, max((abs(y - pivot_y) for y in range(h) if a[y, :, 3].any()), default=1))
    for y in range(h):
        xs_ = np.nonzero(a[y, :, 3])[0]
        if not len(xs_):
            continue
        dx = int(round(amp * (abs(y - pivot_y) / maxd) ** potenz * s))
        if xs_.min() + dx < 0 or xs_.max() + dx >= w:
            raise L.ClipError(f'Zeile {y} würde um {dx} px aus der Leinwand (Breite {w}) geschoben')
        for x in xs_:
            out[y, x + dx] = a[y, x]
    return out


def flammen_spitzen(a, phase, farbe, lauf=1.3, amp=1.6, min_hoehe=3):
    """Flammenzungen züngeln: Jede Spalte, deren oberstes Pixel die Farbe `farbe` hat (äußerer Flammenrand), wird um
    round(amp·sin(phase + lauf·x)) Pixel länger (oben wird ein Pixel derselben Farbe angefügt) oder kürzer (oberste Pixel
    entfallen, die Spalte behält mindestens `min_hoehe` Pixel). Nur an den Spaltenenden — der Rest bleibt, daher bleibt jede
    Spalte (und damit die Figur) 4-verbunden. Phasen je Spalte versetzt (`lauf`), so tanzen die Zungen unabhängig."""
    out = a.copy()
    h, w = a.shape[:2]
    for x in range(w):
        ys = np.nonzero(a[:, x, 3])[0]
        if not len(ys):
            continue
        yt = int(ys.min())
        if tuple(int(v) for v in a[yt, x, :3]) != tuple(farbe):
            continue
        d = int(round(amp * math.sin(phase + lauf * x)))
        if d > 0:
            if yt - d < 0:
                raise L.ClipError(f'Flammenspitze in Spalte {x} würde oben aus der Leinwand ragen')
            for k in range(1, d + 1):
                out[yt - k, x] = a[yt, x]
        elif d < 0:
            kuerzen = min(-d, max(0, len(ys) - min_hoehe))
            # nur zusammenhängende oberste Pixel entfernen
            for k in range(kuerzen):
                if yt + k in ys:
                    out[yt + k, x] = 0
                else:
                    break
    return out


def heller(farbe, rampe, stufen):
    """Farbe `stufen` Stufen weiter auf der Rampe (Liste dunkel → hell, nur Farben des Sprites). Steht die Farbe nicht in der
    Rampe oder läuft sie über das Ende, bleibt sie (bzw. die Endfarbe)."""
    f = tuple(int(v) for v in farbe)
    if f not in rampe:
        return f
    return rampe[max(0, min(len(rampe) - 1, rampe.index(f) + stufen))]


def lichtband(ebene, maske, pad_l, pad_t, i, n, start, dauer, rampe, stufen=1, breite=2.2, achse=(1.0, 1.0), kern_stufen=None):
    """Ein Lichtband wandert diagonal über das Objekt: Im Zeitfenster [start, start+dauer) (Frames, zyklisch mod n) läuft ein Band
    der Breite `breite` entlang u = achse[0]·x + achse[1]·y über alle Pixel von `maske` (Sprite-Koordinaten); Pixel im Band werden
    `stufen` Stufen heller auf `rampe` (in der Bandmitte `kern_stufen`, falls angegeben). Bearbeitet `ebene` (Leinwand) an Ort
    und Stelle; die Ebene muss noch unverschoben liegen (Sprite-Koordinaten + Rand). Außerhalb des Fensters passiert nichts."""
    k = (i - start) % n
    if k >= dauer:
        return ebene
    ys, xs = np.nonzero(maske)
    if not len(ys):
        return ebene
    u = achse[0] * xs + achse[1] * ys
    umin, umax = float(u.min()), float(u.max())
    mitte = umin - breite + (k + 0.5) / dauer * (umax - umin + 2 * breite)
    for y, x, uu in zip(ys, xs, u):
        d = abs(uu - mitte)
        if d > breite / 2.0 + 0.001:
            continue
        py, px_ = pad_t + int(y), pad_l + int(x)
        if not ebene[py, px_, 3]:
            continue
        st = kern_stufen if (kern_stufen is not None and d <= breite / 4.0) else stufen
        ebene[py, px_, :3] = heller(ebene[py, px_, :3], rampe, st)
    return ebene


def stern_stufe(i, n, start, folge=(0, 1, 2, 1)):
    """Glitzer-Stern: ab Frame `start` (zyklisch) durchläuft er `folge` (0 Mitte, 1 Arme 1 px, 2 Arme 2 px) — sonst None."""
    k = (i - start) % n
    return folge[k] if k < len(folge) else None


def stern(ebene, x, y, stufe, kern, arm1, arm2=None):
    """Vierzackiger Glitzer-Stern: Mitte (x, y) + je ein Arm nach oben/unten/links/rechts (Stufe 1: 1 px in `arm1`,
    Stufe 2: 2 px, der zweite in `arm2` bzw. `arm1`). Direkt auf Leinwand-Koordinaten; muss ganz auf die Leinwand passen."""
    h, w = ebene.shape[:2]
    pts = [(0, 0, kern)]
    if stufe >= 1:
        pts += [(1, 0, arm1), (-1, 0, arm1), (0, 1, arm1), (0, -1, arm1)]
    if stufe >= 2:
        a2 = arm2 or arm1
        pts += [(2, 0, a2), (-2, 0, a2), (0, 2, a2), (0, -2, a2)]
    for dx, dy, c in pts:
        xx, yy = x + dx, y + dy
        if not (0 <= xx < w and 0 <= yy < h):
            raise L.ClipError(f'Stern bei ({xx},{yy}) liegt außerhalb der Leinwand {w}×{h}')
        ebene[yy, xx, :3] = c
        ebene[yy, xx, 3] = 255
    return ebene


def puls(i, n, x, y, periode=1, versatz=0.9):
    """0 oder 1: Facetten pulsieren, die Hellphase wandert diagonal über das Objekt (je Pixel anderer Phasenversatz)."""
    return 1 if math.sin(2 * math.pi * periode * i / n + versatz * (x + y)) > 0.55 else 0


def zeilen_pendel(a, pivot_y, amp, phase, potenz=1.0):
    """Wie L.zeilen_welle, aber nur Zeilen UNTERHALB von pivot_y wandern (Beine, Hinterleib, Schwanz): dx = round(amp · f^potenz · sin(phase)),
    f = (y − pivot_y) / maxAbstand. Die Zeilen oberhalb und die Pivotzeile bleiben stehen.
    Zusammenhang: Ändert sich dx von einer Zeile zur nächsten so, dass ein Pixel seinen senkrechten Nachbarn darüber verlöre (dünne Beine,
    Spitzen), behält die Zeile das dx der Zeile darüber — die Figur bleibt 4-verbunden."""
    out = L.leer(*a.shape[:2])
    h, w = a.shape[:2]
    maxd = max(1, max((y - pivot_y for y in range(h) if a[y, :, 3].any() and y > pivot_y), default=1))
    prev = 0
    for y in range(h):
        xs_ = np.nonzero(a[y, :, 3])[0]
        if not len(xs_):
            continue
        dx = 0 if y <= pivot_y else int(round(amp * ((y - pivot_y) / maxd) ** potenz * math.sin(phase)))
        if y > pivot_y and dx != prev:
            for x in xs_:
                if a[y - 1, x, 3]:                            # war oben angeschlossen: das muss nach dem Versatz so bleiben
                    xa = x + dx - prev
                    if not (0 <= xa < w and a[y - 1, xa, 3]):
                        dx = prev
                        break
        prev = dx
        if xs_.min() + dx < 0 or xs_.max() + dx >= w:
            raise L.ClipError(f'Zeile {y} würde um {dx} px aus der Leinwand (Breite {w}) geschoben')
        for x in xs_:
            out[y, x + dx] = a[y, x]
    return out


def kipp_dy(x, pivot_x, amp, phase, maxd):
    """Senkrechter Versatz der Spalte x beim Kippen (Wippe): amp · sin(phase) · (x − pivot_x)/maxd, gerundet; positiv = nach unten."""
    return int(round(amp * math.sin(phase) * (x - pivot_x) / maxd))


def spalten_kippen(a, pivot_x, amp, phase, maxd=None):
    """Die ganze Figur wippt um die senkrechte Achse pivot_x: Spalten rechts davon wandern bei sin(phase) > 0 nach unten, Spalten links
    nach oben (linear mit dem Abstand, an den Enden ±amp). Jede Spalte wird als Ganzes verschoben (Texturen bleiben), benachbarte Spalten
    unterscheiden sich um höchstens 1 Pixel. maxd = größter Abstand (Standard: aus der Ebene)."""
    out = L.leer(*a.shape[:2])
    h, w = a.shape[:2]
    if maxd is None:
        maxd = max(1, max(abs(x - pivot_x) for x in range(w) if a[:, x, 3].any()))
    for x in range(w):
        ys = np.nonzero(a[:, x, 3])[0]
        if not len(ys):
            continue
        dy = kipp_dy(x, pivot_x, amp, phase, maxd)
        if ys.min() + dy < 0 or ys.max() + dy >= h:
            raise L.ClipError(f'Spalte {x} würde um {dy} px aus der Leinwand (Höhe {h}) geschoben')
        for y in ys:
            out[y + dy, x] = a[y, x]
    return out


def _zungen_spalten(a, kern_farben, min_zunge):
    """Je Spalte: (y_oben, y_anker) — oberstes Pixel und erste Kernzeile (Farbe in kern_farben) darunter; nur Spalten mit Zunge ≥ min_zunge."""
    h, w = a.shape[:2]
    kern = {tuple(c) for c in kern_farben}
    info = {}
    for x in range(w):
        ys = np.nonzero(a[:, x, 3])[0]
        if not len(ys):
            continue
        yt = int(ys.min())
        ya = None
        for y in ys:
            if tuple(int(v) for v in a[y, x, :3]) in kern:
                ya = int(y)
                break
        if ya is not None and ya - yt >= min_zunge:
            info[x] = (yt, ya)
    return info


def _zungen_gipfel(info):
    """Zungen = lokale Gipfel der Silhouette (Spaltenoberkante); jede Spalte gehört zum nächsten Gipfel. Gibt (gipfel_liste, zuordnung) zurück."""
    xs = sorted(info)
    gipfel = []
    for k, x in enumerate(xs):
        yt = info[x][0]
        links = info[xs[k - 1]][0] if k > 0 and xs[k - 1] == x - 1 else 10 ** 6
        rechts = info[xs[k + 1]][0] if k + 1 < len(xs) and xs[k + 1] == x + 1 else 10 ** 6
        if yt < links and yt <= rechts:
            gipfel.append(x)
    if not gipfel:
        gipfel = [xs[len(xs) // 2]] if xs else []
    zu = {x: min(range(len(gipfel)), key=lambda g: (abs(x - gipfel[g]), g)) for x in xs}
    return gipfel, zu


def zungen_spitzen(a, kern_farben, min_zunge=3):
    """Spitzen der Zungen (Spalte, oberste Zeile) im Ausgangsbild: Startpunkte für abreißende Funken."""
    info = _zungen_spalten(a, kern_farben, min_zunge)
    gipfel, _ = _zungen_gipfel(info)
    return [(x, info[x][0]) for x in gipfel]


def feuer_zungen(a, i, n, kern_farben, pose_frames=3, seed=11, hub=0.3, min_zunge=3):
    """Feuer wie Feuer: Der Teil jeder Spalte über dem hellen Kern (Spitze rot, Mitte orange) wird gestreckt/gestaucht (Nächster-Nachbar,
    keine Mischfarben) — die Zunge wird länger oder kürzer, die Farbfolge wandert mit. Die Zungen (Gipfel der Silhouette) flackern
    unabhängig: jede hat eine eigene Pose-Tabelle (Stufen −2…+2, in Posen à `pose_frames` Frames, n/pose_frames Posen pro Schleife,
    nahtlos) und einen eigenen Versatz. Der helle Kern darunter und die Basis bleiben unverändert. Jede Spalte reicht weiter bis zum Kern,
    daher bleibt die Figur 4-verbunden."""
    out = a.copy()
    h, w = a.shape[:2]
    info = _zungen_spalten(a, kern_farben, min_zunge)
    if not info:
        return out
    gipfel, zu = _zungen_gipfel(info)
    k_posen = max(1, n // pose_frames)
    rng = np.random.RandomState(seed)
    tabellen = []
    for g in range(len(gipfel)):
        t, v = [], int(rng.randint(-2, 3))
        for _ in range(k_posen):
            v = int(np.clip(v + int(rng.randint(-2, 3)), -2, 2))
            t.append(v)
        tabellen.append((t, int(rng.randint(0, k_posen))))
    for x, (yt, ya) in info.items():
        t, off = tabellen[zu[x]]
        stufe = t[((i // pose_frames) + off) % k_posen]
        s = 1.0 + hub * stufe / 2.0
        h0 = ya - yt
        h1 = max(1, int(round(h0 * s)))
        top = ya - h1
        if top < 0:
            raise L.ClipError(f'Feuerzunge in Spalte {x} würde oben aus der Leinwand ragen')
        out[:ya, x] = 0                                   # Zunge neu aufbauen (alles über dem Kern)
        for k in range(h1):
            src = yt + int(k * h0 / h1)
            out[top + k, x] = a[src, x]
    return out
