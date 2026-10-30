# -*- coding: utf-8 -*-
"""Hilfscode der Gruppe „Flieger“ (zweiter Animator) — baut auf anim_lib auf, ändert nichts daran.

Skelettflügel aus Schlüsselpunkten, nur aus Knochen (Pixelart, nur ganze Pixel, nur Farben aus dem Quell-Sprite):

    pose_mix(a, b, t)                       zwei Schlüsselposen (dict) linear mischen
    pose_vektor(p) / vektor_pose(v, vorlage)   Pose ↔ flache Float-Liste (zum Splinen)
    spline(schluessel, t, periode)          periodischer kubischer Hermite-Spline durch Schlüsselposen (nahtlose Schleife, Halt-Posen)
    knochenflügel(h, w, pose, pal, quelle, spalten, x0, y0, ...)
                                            einen linken Flügel auf eine Leinwand h×w zeichnen: Armknochen vom Rückenansatz zum Gelenk, vier
                                            Fingerknochen fächerförmig (mit Knick), weiße Kerne mit grauer Kante, Gelenkknubbel; keine Haut, keine Hand
    spiegeln(a)                             Ebene an der senkrechten Mittelachse der Leinwand spiegeln (rechter Flügel = gespiegelter linker)
    verbunden4(a, start)                    Maske aller deckenden Pixel, die über KANTEN (4er-Nachbarschaft) mit `start` zusammenhängen
    linie(p0, p1) / linie4(p0, p1)          Bresenham (8er- bzw. 4er-verbunden)
    umriss_schliessen(frame, erlaubt, hell, dunkel)   Randpixel-Test/-Reparatur (Regel 16)
    spalten_schub(a, pivot_x, dy_fn)        Federflügel: Spalten als Ganzes verschieben (Textur bleibt); zusammen_mit_karte / umriss_je_ebene: Ebenenkarte und Umriss je Ebene
Koordinaten der Posen sind Leinwandkoordinaten (Float); gezeichnet wird auf die nächsten ganzen Pixel.
"""
import math

import numpy as np

import anim_lib as L


# ── Schlüsselposen mischen ───────────────────────────────────────────────────────────────────────────────────────────
def pose_mix(a, b, t):
    """Pose = dict aus Zahlen, Zahlen-Tupeln und -Listen. Linear zwischen a (t=0) und b (t=1)."""
    out = {}
    for k, va in a.items():
        vb = b[k]
        if isinstance(va, (tuple, list)):
            out[k] = type(va)(x + (y - x) * t for x, y in zip(va, vb))
        else:
            out[k] = va + (vb - va) * t
    return out


def weich(t):
    """Sanftes Ein-/Ausschwingen 0…1 (Smoothstep) — Gelenkbewegung beschleunigt und bremst."""
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def pose_vektor(pose):
    """Pose (dict) → flache Float-Liste, damit sie sich splinen lässt; vektor_pose() ist die Umkehrung (gleiche Struktur wie `vorlage`)."""
    v = []
    for k in sorted(pose):
        x = pose[k]
        v += list(x) if isinstance(x, (tuple, list)) else [x]
    return v


def vektor_pose(v, vorlage):
    out, i = {}, 0
    for k in sorted(vorlage):
        x = vorlage[k]
        if isinstance(x, (tuple, list)):
            out[k] = type(x)(v[i:i + len(x)]); i += len(x)
        else:
            out[k] = v[i]; i += 1
    return out


def spline(schluessel, t, periode):
    """Kubischer Hermite-Spline durch Schlüsselposen, periodisch (nahtlose Schleife). schluessel = [(zeit, vektor, halt)], zeit aufsteigend in
    [0, periode); halt=True → Tangente 0 (Pose verharrt, z. B. gefalteter Flügel). Gibt den Vektor zur Zeit t (mod periode) zurück.
    Durchläuft jede Schlüsselpose exakt und beschleunigt/bremst dazwischen weich (kein Stop-and-go an den Zwischenposen)."""
    t = t % periode
    n = len(schluessel)
    ks = [(z - periode, v, h) for (z, v, h) in schluessel] + list(schluessel) + [(z + periode, v, h) for (z, v, h) in schluessel]
    # Segment suchen
    i = next(j for j in range(len(ks) - 1) if ks[j][0] <= t < ks[j + 1][0])
    (z0, v0, h0), (z1, v1, h1) = ks[i], ks[i + 1]
    zm, vm, _ = ks[i - 1]
    zp, vp, _ = ks[i + 2]
    d = z1 - z0
    u = (t - z0) / d
    out = []
    for a in range(len(v0)):
        m0 = 0.0 if h0 else (v1[a] - vm[a]) / (z1 - zm)
        m1 = 0.0 if h1 else (vp[a] - v0[a]) / (zp - z0)
        h00, h10, h01, h11 = 2 * u ** 3 - 3 * u ** 2 + 1, u ** 3 - 2 * u ** 2 + u, -2 * u ** 3 + 3 * u ** 2, u ** 3 - u ** 2
        out.append(h00 * v0[a] + h10 * d * m0 + h01 * v1[a] + h11 * d * m1)
    return out


# ── Rasterhilfen ─────────────────────────────────────────────────────────────────────────────────────────────────────
def linie(p0, p1):
    """Bresenham, Punkte (x, y) von p0 bis p1 (ganze Pixel, 8-verbunden)."""
    x0, y0 = int(round(p0[0])), int(round(p0[1]))
    x1, y1 = int(round(p1[0])), int(round(p1[1]))
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    err = dx + dy
    pts = []
    while True:
        pts.append((x0, y0))
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy; x0 += sx
        if e2 <= dx:
            err += dx; y0 += sy
    return pts


def linie4(p0, p1):
    """Wie linie(), aber 4-verbunden (an jeder diagonalen Stufe ein Pixel dazu) — für Knochen, die an Kanten zusammenhängen müssen."""
    pts = linie(p0, p1)
    out = [pts[0]]
    for (x, y) in pts[1:]:
        px, py = out[-1]
        if x != px and y != py:
            out.append((x, py))
        out.append((x, y))
    return out


def spiegeln(a):
    return a[:, ::-1].copy()


def verbunden4(a, start):
    """Alle deckenden Pixel von `a`, die über Kanten (4er-Nachbarschaft) mit den Pixeln der Maske `start` zusammenhängen."""
    h, w = a.shape[:2]
    deck = a[..., 3] > 0
    seen = np.zeros((h, w), bool)
    stack = [(y, x) for y, x in zip(*np.nonzero(start & deck))]
    for (y, x) in stack:
        seen[y, x] = True
    while stack:
        y, x = stack.pop()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            yy, xx = y + dy, x + dx
            if 0 <= yy < h and 0 <= xx < w and deck[yy, xx] and not seen[yy, xx]:
                seen[yy, xx] = True
                stack.append((yy, xx))
    return seen


# ── Skelettflügel ────────────────────────────────────────────────────────────────────────────────────────────────────
def _pt(p, ang, laenge):
    r = math.radians(ang)
    return (p[0] + laenge * math.cos(r), p[1] + laenge * math.sin(r))


def knochenflügel(h, w, pose, pal, quelle, spalten, x0, y0, dick=(0.3, 0.18, 0.18, 0.18)):
    """Linker Skelettflügel NUR AUS KNOCHEN (keine Haut, keine Hand): ein Armknochen vom Rückenansatz S zum Gelenk W des Flügels und vier Fingerknochen,
    die vom Gelenk fächerförmig auseinanderlaufen (mit Knick bei 55 % der Länge). Dazwischen ist Freiraum (transparent). Auf eine leere Leinwand h×w.

    Geschlossene Aufklappung: Die Fingerknochen tragen beim gefalteten Flügel die Pixel der Quellspalten `spalten[k]` von `quelle` (ab Zeile y0 abwärts) und
    werden mit pose['rein'] (0…1, pixelweise Dithering) zu sauberen Knochen. Sauber heißt: das erste Stück (Anteil `dick[k]`) jedes Fingers und der ganze
    Armknochen sind weiße Kerne (1 px) mit grauer Kante ringsum (4er-Nachbarn, `pal['schatten']`) — so ist jede Außenkante grau wie im Original (graue
    Außenkante x = 1) —, der Rest des Fingers ist eine graue 1-px-Linie. Ein 3×3-Gelenkknubbel (grauer Ring, weißer Kern) sitzt am Gelenk W.

    pose: dict(S=(x,y) Rückenansatz (hinter dem Körper), W=(x,y) Gelenk, rho=1…0 (seitlicher Abstand der Fingerwurzeln, 1 = wie im Original, 0 = alle am
          Gelenk), ang=[θ1..θn] Fingerwinkel in Grad (Bildkoordinaten: 90° = unten, 180° = links, 270° = oben; erster Finger = Vorderkante),
          len=[ℓ1..ℓn] Längen in px, knick=Grad (Spitzen krümmen sich nach unten), rein=0…1, knubbel=0/1).
    pal: dict(knochen=[hell], schatten=graue Kante).  Wirft ClipError, wenn etwas über die Leinwand ragen würde."""
    a = L.leer(h, w)
    S, Wr = pose['S'], pose['W']
    angs, lens = pose['ang'], pose['len']
    knick = pose.get('knick', 0.0)
    rho = pose.get('rho', 0.0)
    rein = pose.get('rein', 0.0)
    n = len(angs)
    hell, kante = pal['knochen'][0], pal['schatten']
    offen = rein >= 0.5

    def setze(x, y, c):
        if not (0 <= y < h and 0 <= x < w):
            raise L.ClipError(f'Flügelpixel ({x},{y}) außerhalb der Leinwand {w}×{h}')
        a[y, x, :3] = c
        a[y, x, 3] = 255

    # Fingerbahnen: Wurzel = Gelenk + rho·(Spaltenabstand, 0); bei 55 % der Länge knickt der Finger
    starts, gel = [], []
    for k in range(n):
        st = (Wr[0] + rho * (spalten[k] - x0), Wr[1])
        starts.append(st)
        gel.append(_pt(st, angs[k], lens[k] * 0.55))

    kern, halo = {}, set()                       # Kernpixel (Position → Farbe), graue Kantenpixel
    fing = []
    for k in range(n):
        col = spalten[k]
        ys = np.nonzero(quelle[:, col, 3])[0]
        lo, hi = int(ys.min()), int(ys.max())
        lq = max(1, hi - y0)
        scale = lens[k] / lq
        sg = lens[k] * 0.55
        pts = []                                  # geordnete Pixel (Position, Quellfarbe)
        v = float(lo - y0) if rho > 0.5 else 0.0  # Teil hinter dem Gelenk nur beim gefalteten Flügel
        while v <= lq + 1e-9:
            s_ = v * scale
            p = _pt(starts[k], angs[k], s_) if s_ <= sg else _pt(gel[k], angs[k] - knick, s_ - sg)
            row = max(lo, min(hi, y0 + int(round(v))))
            pos = (int(round(p[0])), int(round(p[1])))
            if quelle[row, col, 3] and (not pts or pts[-1][0] != pos):
                if pts and pos[0] != pts[-1][0][0] and pos[1] != pts[-1][0][1]:             # Ecke dazu: Knochen hängt über Kanten zusammen (4-verbunden)
                    pts.append(((pts[-1][0][0], pos[1]), pts[-1][1]))
                pts.append((pos, tuple(int(c) for c in quelle[row, col, :3])))
            v += 0.5 / scale
        fing.append(pts)
        m = len(pts)
        for j, (pos, roh) in enumerate(pts):
            dicker = j < m * dick[min(k, len(dick) - 1)]
            sauber = hell if dicker else kante
            c = roh
            if rein > ((pos[1] * 7 + k * 3 + pos[0]) % 10) / 10.0 + 0.04:       # roh → sauber pixelweise (Dithering, kein Alpha)
                c = sauber
            kern[pos] = c
            if offen and dicker:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    halo.add((pos[0] + dx, pos[1] + dy))
    # Armknochen: ganzer Weg weißer Kern + graue Kante (4-verbunden)
    arm = linie4(S, Wr)
    if len(arm) > 2:
        for pos in arm:
            kern[pos] = hell
            if offen:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    halo.add((pos[0] + dx, pos[1] + dy))
    for pos in halo:
        if pos not in kern:
            setze(pos[0], pos[1], kante)
    for pos, c in kern.items():
        setze(pos[0], pos[1], c)
    # Gelenkknubbel 3×3: grauer Ring, weißer Kern
    if pose.get('knubbel', 0):
        wx, wy = int(round(Wr[0])), int(round(Wr[1]))
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                setze(wx + dx, wy + dy, hell if dx == 0 and dy == 0 else kante)
    return a


def umriss_schliessen(frame, erlaubt, hell, dunkel):
    """Randpixel-Test/-Reparatur: Jedes deckende Pixel mit einem transparenten Nachbarn (4er-Nachbarschaft, auch am Leinwandrand) muss eine der
    Umrissfarben `erlaubt` tragen. Andere Randpixel werden umgefärbt: helle (Knochen) → `hell`, dunkle/braune (Haut, Hand) → `dunkel`.
    Gibt die Zahl der umgefärbten Pixel zurück; ändert `frame` an Ort und Stelle."""
    h, w = frame.shape[:2]
    deck = frame[..., 3] > 0
    p = np.pad(deck, 1)
    rand = deck & (~p[:-2, 1:-1] | ~p[2:, 1:-1] | ~p[1:-1, :-2] | ~p[1:-1, 2:])
    n = 0
    for y, x in zip(*np.nonzero(rand)):
        c = tuple(int(v) for v in frame[y, x, :3])
        if c in erlaubt:
            continue
        frame[y, x, :3] = hell if sum(c) / 3.0 > 120 else dunkel
        n += 1
    return n


# ── Federflügel: Spalten schieben (Textur bleibt erhalten), Ebenenkarte, Umriss pro Ebene ───────────────────────────────────
def spalten_schub(a, pivot_x, dy_fn, maxd=None):
    """Jede Spalte von `a` wandert als Ganzes senkrecht um round(dy_fn(f)) (positiv = nach unten); f = |x − pivot_x| / größter Abstand (0…1).
    Es wird nichts kopiert oder gestreckt — die Federtextur bleibt Pixel für Pixel erhalten. maxd = fester größter Abstand (damit mehrere Ebenen desselben Flügels
    — Federn, Edelsteine, Marker — dieselbe Verschiebung bekommen). ClipError, wenn eine Spalte aus der Leinwand ragen würde."""
    out = L.leer(*a.shape[:2])
    h, w = a.shape[:2]
    spalten = [x for x in range(w) if a[:, x, 3].any()]
    if maxd is None:
        maxd = max(1, max(abs(x - pivot_x) for x in spalten)) if spalten else 1
    for x in spalten:
        dy = int(round(dy_fn(abs(x - pivot_x) / maxd)))
        ys = np.nonzero(a[:, x, 3])[0]
        if ys.min() + dy < 0 or ys.max() + dy >= h:
            raise L.ClipError(f'Spalte {x} würde um {dy} px aus der Leinwand (Höhe {h}) geschoben')
        for y in ys:
            out[y + dy, x] = a[y, x]
    return out


def zusammen_mit_karte(h, w, ebenen):
    """Wie L.zusammen, liefert zusätzlich eine Karte (h×w, int), welche Ebene das oberste Pixel liefert. ebenen = [(Ebene, dx, dy, Nummer ≥ 1)], zuerst = unten."""
    f = L.leer(h, w)
    karte = np.zeros((h, w), np.int16)
    for (a, dx, dy, nr) in ebenen:
        t = L.einsetzen(L.leer(h, w), a, dx, dy)
        m = t[..., 3] > 0
        f[m] = t[m]
        karte[m] = nr
    return f, karte


def umriss_je_ebene(frame, karte, erlaubt, farbe_je_ebene):
    """Randpixel-Test/-Reparatur mit Umrissfarbe je Ebene: Jedes deckende Pixel mit transparentem 4er-Nachbarn (auch am Leinwandrand), dessen Farbe nicht in
    `erlaubt` steht, bekommt die Umrissfarbe seiner Ebene (`farbe_je_ebene[karte[y, x]]`) — z. B. wenn eine verschobene Federspalte Innenfarbe an die Kante bringt.
    Gibt die Zahl der umgefärbten Pixel zurück; ändert `frame` an Ort und Stelle."""
    deck = frame[..., 3] > 0
    p = np.pad(deck, 1)
    rand = deck & (~p[:-2, 1:-1] | ~p[2:, 1:-1] | ~p[1:-1, :-2] | ~p[1:-1, 2:])
    n = 0
    for y, x in zip(*np.nonzero(rand)):
        c = tuple(int(v) for v in frame[y, x, :3])
        if c in erlaubt:
            continue
        frame[y, x, :3] = farbe_je_ebene[int(karte[y, x])]
        n += 1
    return n



# ── Harpyformer-Bausteine (gemeinsam für die Reihe) ──────────────────────────────────────────────────────────────────────
def zeilen_dehnen_aussen(a, y0, y1, innen, dx_fn):
    """Haarsträhnen schwingen, ohne vom Körper abzureißen: In den Zeilen y0…y1 (Leinwandzeilen) bleibt das INNERE Ende des Haarstücks stehen
    (Spalte innen[y] − 1, `innen` = dict Zeile → erste Spalte NICHT mehr zum Haar gehörig, z. B. Gesicht/Flügelansatz), das äußere Ende (erstes deckendes Pixel
    der Zeile) wandert um dx = round(dx_fn(y)) (negativ = nach außen/links). Dazwischen wird Pixel für Pixel nach dem Nächsten-Nachbar-Prinzip abgetastet —
    nach außen wird dabei ein Pixel verdoppelt, nach innen eines ausgelassen; es entstehen keine Lücken und keine fremden Farben. Der äußere Umrisspixel bleibt der äußere."""
    out = a.copy()
    h, w = a.shape[:2]
    for y in range(y0, y1 + 1):
        xs_ = np.nonzero(a[y, :innen[y], 3])[0]
        if not len(xs_):
            continue
        dx = int(round(dx_fn(y)))
        if dx == 0:
            continue
        xa, xm = int(xs_.min()), int(innen[y])              # Haarstück = [xa, xm)
        ws, wn = xm - xa, xm - xa - dx
        if wn < 2 or xa + dx < 0:
            raise L.ClipError(f'Zeile {y}: Haarstück ließe sich nicht um {dx} px schwingen (Breite {ws}, Leinwand-Rand {xa})')
        out[y, min(xa, xa + dx):xm] = 0
        for x in range(xa + dx, xm):
            s = xa + int(round((x - (xa + dx)) * (ws - 1) / (wn - 1)))
            out[y, x] = a[y, s]
    return out


# Funkelstern der Harpyformer-Kunst: drei Wuchsstufen derselben weißen Sterne (so stehen sie auf den Karten):
#   1 = kleine Raute (4 Pixel, Mitte leer), 2 = X (Mitte + 4 Diagonalen), 3 = großes Plus (je 2 Pixel Arme, Mitte leer)
FUNKEL_FORMEN = {1: [(0, -1), (-1, 0), (1, 0), (0, 1)],
                 2: [(0, 0), (-1, -1), (1, -1), (-1, 1), (1, 1)],
                 3: [(0, -2), (0, -1), (0, 1), (0, 2), (-2, 0), (-1, 0), (1, 0), (2, 0)]}


def funkel_stufe(i, periode, k0, folge):
    """Stufe (0 = aus, 1…3 = Form) des Funkelsterns im Frame i; `folge` = Stufen je Frame einer Periode, k0 = Index von `folge` bei Frame 0."""
    return folge[(k0 + i) % periode]


def funkel_stern(ebene, mx, my, stufe, farbe):
    """Funkelstern der Stufe 1…3 mit Mitte (mx, my) auf eine Leinwand-Ebene zeichnen (Leinwandkoordinaten; ClipError am Rand)."""
    h, w = ebene.shape[:2]
    for dx, dy in FUNKEL_FORMEN.get(stufe, []):
        x, y = mx + dx, my + dy
        if not (0 <= x < w and 0 <= y < h):
            raise L.ClipError(f'Funkelstern bei ({x},{y}) liegt außerhalb der Leinwand {w}×{h}')
        ebene[y, x, :3] = farbe
        ebene[y, x, 3] = 255
    return ebene


def wolken_ebene(h, w, i, n, puffs, farben):
    """Lesbare Wölkchen ohne Ein-Pixel-Punkte (Regel „Partikel ≥ 2×2“): wie L.puff_ebene (puffs: dict(x, y, vx, vy, off, form, wackeln); (x, y) = Startpunkt auf der Leinwand,
    (vx, vy) = Gesamtweg über die Lebensdauer n = Schleifenlänge, daher nahtlos), aber Anfang und Ende sind die 2×2-Form 's' statt eines Funkens: erstes und letztes Fünftel
    der Lebensdauer 's', dazwischen die volle Form (`form`: 's' 2×2, 'o' 4×4, 'm' 5×3). Farben: {'c': Kern, 'r': Rand}. ClipError, wenn ein Pixel aus der Leinwand ragt."""
    e = L.leer(h, w)
    for pf in puffs:
        t = ((i + pf.get('off', 0)) % n) / n
        cx = pf['x'] + pf.get('vx', 0) * t + pf.get('wackeln', 0) * math.sin(2 * math.pi * t)
        cy = pf['y'] + pf.get('vy', 0) * t
        cx, cy = int(round(cx)), int(round(cy))
        form = pf.get('form', 's')
        if t < 0.2 or t >= 0.8:
            form = 's'
        for (dx, dy, k) in L.PUFF_FORMEN[form]:
            x, y = cx + dx, cy + dy
            if not (0 <= y < h and 0 <= x < w):
                raise L.ClipError(f'Wölkchen bei ({x},{y}) liegt außerhalb der Leinwand {w}×{h}')
            e[y, x, :3] = farben[k]
            e[y, x, 3] = 255
    return e


def spalten_schub_gefuellt(a, pivot_x, dy_fn, maxd=None, ab_x=None):
    """Wie `spalten_schub`, aber ein Flügel, der sich nach UNTEN schiebt, bleibt am Körper angewachsen: die oben frei werdenden Zellen jeder Spalte (dy > 0) füllt das oberste
    Pixel der Spalte (Farbe der Quelle), es entstehen keine Löcher zwischen Flügel und Rumpf/Kinn. Spalten links von `ab_x` (falls angegeben) werden nicht angefasst."""
    out = L.leer(*a.shape[:2])
    h, w = a.shape[:2]
    spalten = [x for x in range(w) if a[:, x, 3].any()]
    if maxd is None:
        maxd = max(1, max(abs(x - pivot_x) for x in spalten)) if spalten else 1
    for x in spalten:
        dy = 0 if (ab_x is not None and x < ab_x) else int(round(dy_fn(abs(x - pivot_x) / maxd)))
        ys = np.nonzero(a[:, x, 3])[0]
        if ys.min() + dy < 0 or ys.max() + dy >= h:
            raise L.ClipError(f'Spalte {x} würde um {dy} px aus der Leinwand (Höhe {h}) geschoben')
        for y in ys:
            out[y + dy, x] = a[y, x]
        for y in range(int(ys.min()), int(ys.min()) + max(0, dy)):
            if not out[y, x, 3]:
                out[y, x] = a[int(ys.min()), x]
    return out
