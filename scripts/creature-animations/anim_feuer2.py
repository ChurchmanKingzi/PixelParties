# -*- coding: utf-8 -*-
"""Feuer „von Hand“ (Pixelart, nur ganze Pixel, nur Farben der Vorlage) — Nachfolger von anim_feuer.py (der bleibt unverändert).

Idee
----
anim_feuer.py zeichnete Flammen aus Zufallszahlen neu; das wirkte unruhig (dünne Spitzen, Farbrauschen) und ersetzte das gemalte Feuer der Kunst. Dieses Modul geht den
Weg eines Pixelart-Zeichners: Die **fertig gemalte Flamme der Quelle** (xcf-Ebene bzw. Sprite) ist die Vorlage. Sie wird in **Zungen** zerlegt (je Zunge eine
Achse Fuß → Spitze), und jede Zunge läuft ihre **eigene Folge handgesetzter Posen** durch (Länge, Neigung, S-Kurve, Kernhöhe; 10–12 Posen je Feuertyp = `BAENKE`,
jede Pose hält 2–3 Frames, die Folgen der Zungen sind gegeneinander versetzt, optional als wandernde Welle). Weil jedes Pixel immer aus der gemalten Vorlage stammt,
bleiben Umriss, Farbstufen (heller Kern → gelb → orange → roter Rand) und die klobige Pixelart-Form erhalten — nichts wird weichgezeichnet, überblendet oder gedreht.

Wie eine Pose entsteht (alles ganzzahlig, rückwärts abgetastet, also ohne Löcher):
  * Länge `s`: oberhalb des ruhigen Fußes (`fuss_anteil` der Zungenhöhe) wird der Zungenkörper gestreckt/gestaucht (Zeilen kommen dazu bzw. entfallen, die Spitze wandert).
  * Neigung `l` und S-Kurve `b`: die Zeilen der Zunge (bei waagerechten Flammen die Spalten) rutschen ganzzahlig seitlich; der Versatz wächst zur Spitze (`u**1.5`),
    am Fuß ist er 0 — die Basis steht breit und ruhig.
  * Kernhub `c`: die Farbstufen steigen/fallen gegenüber dem Umriss (Farbe wird mit Versatz abgetastet, der Rand bleibt): der helle Kern pulsiert.
  * Nachbarzungen gehen über weiche Gewichte ineinander über (keine Risse an den Nähten); danach werden Streupixel und abgetrennte Fetzen entfernt, Randpixel erhalten
    die Umrissfarbe der Vorlage (`rand_farbe`).
  * Spitzen **reißen ab**: fällt eine hohe Zunge in eine kürzere Pose zurück, bleibt ihre alte Spitze als kleiner Funke (erst 1×2 px, dann 1 px) zurück und steigt auf,
    kühlt ab (Zungenfarbe → orange → rot) und verglimmt (letzte Frames im Schachbrett-Takt).
  * Optional `kochen`: im Innern wandert die Farbzeichnung der Vorlage leicht (Hitzeflimmern der Kern-Sprenkel), `welle`: Posen laufen als Welle durch die Zungen (Mähne).

Schnittstelle
-------------
    import anim_feuer2 as F2

    vl = F2.Vorlage(rgba_flamme, zungen, richtung='hoch', rand_farbe=(r,g,b), sperre=maske)
    #  rgba_flamme: Feld h×w×4 NUR mit den Flammenpixeln (Alpha 0/255) auf der Leinwand der Figur; Zungen in denselben Pixeln.
    #  richtung: wohin die Flamme zeigt ('hoch', 'runter', 'links', 'rechts') — jede Richtung wird intern aufrecht gerechnet.
    zungen = F2.zungen_finden(rgba_flamme, richtung)               # Gipfel der Silhouette → Zungen (Fuß → Spitze)
    zungen = F2.zungen_baender(rgba_flamme, richtung, breite=3)    # gleichmäßige Streifen (Mähne, Strahl, Schweif)
    feuer = F2.Feuer([vl, …], n=48, seed=3, bank='zunge', amp=1.0, welle=None, funken=True)
    ebene = feuer.ebene(i)            # RGBA-Feld h×w: die Flamme in Frame i (0 ≤ i < n)
    funken = feuer.funken(i, dy=0)    # RGBA-Feld h×w: abgerissene, aufsteigende Funken (dy: Versatz der Figur beim Abreißen, auch Funktion frame → dy)
    F2.zungen_bild(pfad, vl, zoom)    # Kontrollbild der Zungenachsen (Fuß blau → Spitze grün) auf der Vorlage
    F2.ascii_sprite(['..r..', '.ror.', …], {'r': (r,g,b), …})     # handgezeichnete Flammenteile (ASCII-Pixel) → RGBA, zum Ergänzen der Vorlage
Frame 0 ist eine Pose wie jede andere (die Folge ist nahtlos); die Ruhepose der Vorlage ist bei s = 1, l = b = c = 0 erreicht.
"""
import math
import random

import numpy as np

import anim_lib as L

# ── handgesetzte Posenbänke ─────────────────────────────────────────────────────────────────────────────────────────────────────
# Pose = (s, l, b, c): s Länge der oberen Zunge (Faktor), l Neigung der Spitze in px (+ = nach rechts in Flammenrichtung „hoch“),
# b S-Kurve in px (Bauch in der Mitte), c Kernhub in Zeilen (+ = Farbstufen steigen gegenüber dem Umriss).
# Jede Bank ist ein geschlossener Zyklus (letzte → erste Pose ist ein kleiner Schritt), Nachbarposen unterscheiden sich um höchstens ~1 px.
BAENKE = {
    # große, kräftig züngelnde Zungen (Lagerfeuer, Mähne)
    'zunge': [(1.00, 0.0, 0.0, 0), (1.08, 0.8, 0.3, 1), (1.18, 1.6, 0.6, 1), (1.08, 1.4, -0.3, 0), (0.92, 0.8, -0.7, -1),
              (0.76, 0.0, -0.4, -1), (0.70, -0.8, 0.0, 0), (0.84, -1.6, 0.5, 1), (1.00, -1.9, 0.8, 1),
              (1.14, -1.2, 0.5, 2), (1.20, -0.5, 0.2, 1), (1.08, -0.1, 0.0, 0)],
    # ruhigere Flammen (Kerze, Glut, Schweif-Spitzen): kleinere Ausschläge
    'ruhig': [(1.00, 0.0, 0.0, 0), (1.06, 0.5, 0.2, 0), (1.12, 1.0, 0.3, 1), (1.04, 0.8, 0.0, 1), (0.92, 0.3, -0.3, 0),
              (0.84, -0.4, -0.4, -1), (0.88, -1.0, -0.1, 0), (0.98, -1.2, 0.3, 0), (1.08, -0.8, 0.4, 1), (1.04, -0.3, 0.1, 0)],
    # wilde, flackernde Flammen (Feuerball-Rand, Strahl-Fransen)
    'wild': [(1.00, 0.0, 0.0, 0), (1.12, 1.0, 0.5, 1), (1.24, 2.0, 0.9, 2), (1.10, 1.6, 0.2, 1), (0.88, 0.8, -0.6, 0),
             (0.66, 0.0, -0.9, -1), (0.62, -1.0, -0.5, -1), (0.80, -2.0, 0.2, 0), (1.04, -2.2, 0.9, 1),
             (1.22, -1.4, 0.8, 2), (1.26, -0.6, 0.3, 1), (1.12, -0.2, 0.0, 0)],
}


class Zunge:
    """Eine Flammenzunge der Vorlage: `fuss` = Punkt der Achse, wo sie im ruhigen Körper aufgeht, `spitze` = oberstes Pixel (Pixel der Vorlage).
    amp: Ausschlagfaktor (Standard 1), bank: eigene Posenbank, fuss_anteil: Anteil der Höhe, der ruhig bleibt, funke: Spitze darf abreißen."""
    def __init__(self, fuss, spitze, amp=1.0, bank=None, fuss_anteil=0.3, funke=True):
        self.fuss = (float(fuss[0]), float(fuss[1]))
        self.spitze = (float(spitze[0]), float(spitze[1]))
        self.amp, self.bank, self.fuss_anteil, self.funke = amp, bank, fuss_anteil, funke


class Vorlage:
    def __init__(self, rgba, zungen, richtung='hoch', rand_farbe=None, sperre=None, kochen=0.0, welle=None, bank=None, faden=None, loecher=True):
        self.rgba = rgba.copy()
        self.zungen, self.richtung, self.rand_farbe, self.kochen = list(zungen), richtung, rand_farbe, kochen
        self.welle, self.bank, self.faden, self.loecher = welle, bank, faden, loecher
        h, w = rgba.shape[:2]
        self.sperre = np.zeros((h, w), bool) if sperre is None else sperre.astype(bool)


# ── kanonische Lage (Flamme zeigt nach oben) ─────────────────────────────────────────────────────────────────────────────────
def _nach_kanon(a, richtung):
    if richtung == 'hoch':
        return a
    if richtung == 'runter':
        return a[::-1]
    if richtung == 'links':
        return np.swapaxes(a, 0, 1)
    if richtung == 'rechts':
        return np.swapaxes(a[:, ::-1], 0, 1)
    raise ValueError(richtung)


def _von_kanon(a, richtung):
    if richtung == 'hoch':
        return a
    if richtung == 'runter':
        return a[::-1]
    if richtung == 'links':
        return np.swapaxes(a, 0, 1)
    if richtung == 'rechts':
        return np.swapaxes(a, 0, 1)[:, ::-1]
    raise ValueError(richtung)


def _punkt_kanon(p, richtung, h, w):
    x, y = p
    if richtung == 'hoch':
        return (x, y)
    if richtung == 'runter':
        return (x, h - 1 - y)
    if richtung == 'links':
        return (y, x)
    if richtung == 'rechts':
        return (y, w - 1 - x)
    raise ValueError(richtung)


def _punkt_zurueck(p, richtung, h, w):
    cx, cy = p
    if richtung == 'hoch':
        return (cx, cy)
    if richtung == 'runter':
        return (cx, h - 1 - cy)
    if richtung == 'links':
        return (cy, cx)
    if richtung == 'rechts':
        return (w - 1 - cy, cx)
    raise ValueError(richtung)


# ── Zungen aus der Vorlage ableiten ─────────────────────────────────────────────────────────────────────────────────────────
def _gipfel(top, min_prom, h):
    """Gipfel der Silhouette (top[x] = oberste belegte Zeile der Spalte, h = leer): Liste (x, Prominenz)."""
    w = len(top)
    ht = [-t for t in top]
    peaks = []
    x = 0
    while x < w:
        y = x
        while y + 1 < w and top[y + 1] == top[x]:
            y += 1
        if top[x] < h and (x == 0 or top[x - 1] > top[x]) and (y == w - 1 or top[y + 1] > top[y]):
            peaks.append(((x + y) // 2, x, y))
        x = y + 1
    res = []
    for (p, a, b) in peaks:
        lmin = ht[p]
        i = a - 1
        while i >= 0 and ht[i] < ht[p]:
            lmin = min(lmin, ht[i]); i -= 1
        rmin = ht[p]
        i = b + 1
        while i < w and ht[i] < ht[p]:
            rmin = min(rmin, ht[i]); i += 1
        prom = ht[p] - max(lmin, rmin)
        if prom >= min_prom:
            res.append((p, prom))
    return res


def _achse_abwaerts(m, p, ty, by):
    """Mittellinie der Zunge von der Spitze (p, ty) bis zur Zeile by (Lauf, der die vorige Position enthält; Schritt ≤ 1 px je Zeile)."""
    xprev = float(p)
    for r in range(ty, by + 1):
        xs = np.nonzero(m[r])[0]
        if not len(xs):
            break
        runs = np.split(xs, np.nonzero(np.diff(xs) > 1)[0] + 1)
        lauf = min(runs, key=lambda q: 0 if q[0] <= xprev <= q[-1] else min(abs(q[0] - xprev), abs(q[-1] - xprev)))
        c = 0.5 * (lauf[0] + lauf[-1])
        xprev = min(max(c, xprev - 1), xprev + 1)
    return xprev


def zungen_finden(rgba, richtung='hoch', min_prom=2, hmax=14, min_h=3, **kw):
    """Zungen der Vorlage aus der Silhouette ableiten: Gipfel der Oberkante (in Flammenrichtung) mit Prominenz ≥ min_prom; Fuß = Achse in Talhöhe (Mitte der Zeile
    unterhalb der Spitze, Schritt ≤ 1 px je Zeile), Höhe = Prominenz (höchstens hmax). Liefert Zungen in Pixeln der Vorlage."""
    h0, w0 = rgba.shape[:2]
    a = _nach_kanon(rgba, richtung)
    h, w = a.shape[:2]
    m = a[..., 3] > 0
    top = np.array([int(np.nonzero(m[:, x])[0].min()) if m[:, x].any() else h for x in range(w)])
    zs = []
    for (p, prom) in _gipfel(top, min_prom, h):
        H = min(prom, hmax)
        if H < min_h:
            continue
        ty = int(top[p]); by = ty + H
        fx = _achse_abwaerts(m, p, ty, by)
        zs.append(Zunge(_punkt_zurueck((fx, by), richtung, h0, w0), _punkt_zurueck((p, ty), richtung, h0, w0), **kw))
    return zs


def zungen_baender(rgba, richtung='hoch', breite=3, min_h=3, x0=None, x1=None, versatz=0, **kw):
    """Gleichmäßige Streifen (Breite `breite` Spalten in kanonischer Lage): Spitze = höchstes Pixel des Streifens, Fuß = tiefstes Pixel (Körperkante).
    Für Bänder wie Mähne, Strahl, Schweif, deren Oberkante keine tiefen Täler hat."""
    h0, w0 = rgba.shape[:2]
    a = _nach_kanon(rgba, richtung)
    h, w = a.shape[:2]
    m = a[..., 3] > 0
    cols = np.nonzero(m.any(axis=0))[0]
    lo = cols.min() if x0 is None else x0
    hi = cols.max() + 1 if x1 is None else x1
    zs = []
    xa = lo + versatz
    while xa < hi:
        xb = min(hi, xa + breite)
        band = m[:, xa:xb]
        if band.any():
            ys = np.nonzero(band.any(axis=1))[0]
            ty, by = int(ys.min()), int(ys.max())
            if by - ty >= min_h:
                xs_top = xa + int(round(float(np.nonzero(band[ty])[0].mean())))
                cx = 0.5 * (xa + xb - 1)
                zs.append(Zunge(_punkt_zurueck((cx, by), richtung, h0, w0), _punkt_zurueck((xs_top, ty), richtung, h0, w0), **kw))
        xa = xb
    return zs


def ascii_sprite(zeilen, farben):
    """Handgezeichnetes Sprite aus ASCII-Zeilen ('.' = leer, sonst Schlüssel von `farben`) → RGBA-Feld."""
    h, w = len(zeilen), max(len(z) for z in zeilen)
    a = L.leer(h, w)
    for y, z in enumerate(zeilen):
        for x, ch in enumerate(z):
            if ch != '.':
                a[y, x, :3] = farben[ch]
                a[y, x, 3] = 255
    return a


def zungen_bild(pfad, vl, zoom=16, box=None, zungen=None):
    """Kontrollbild: Vorlage vergrößert, Zungenachsen Fuß (blau) → Spitze (grün) eingezeichnet."""
    from PIL import Image, ImageDraw
    a = vl.rgba
    h, w = a.shape[:2]
    x0, y0, x1, y1 = box or (0, 0, w, h)
    bg = Image.new('RGBA', (w, h), (45, 35, 75, 255)); bg.alpha_composite(Image.fromarray(a))
    big = bg.crop((x0, y0, x1, y1)).resize(((x1 - x0) * zoom, (y1 - y0) * zoom), Image.NEAREST).convert('RGB')
    d = ImageDraw.Draw(big)
    for x in range(x0, x1):
        d.text(((x - x0) * zoom + 2, 1), str(x), fill=(255, 255, 0))
    for y in range(y0, y1):
        d.text((1, (y - y0) * zoom + zoom // 2 - 4), str(y), fill=(255, 255, 0))
    for z in (zungen or vl.zungen):
        fx, fy = z.fuss; sx, sy = z.spitze
        P = lambda x, y: ((x - x0 + 0.5) * zoom, (y - y0 + 0.5) * zoom)
        d.line([P(fx, fy), P(sx, sy)], fill=(0, 255, 255), width=2)
        d.ellipse([P(sx, sy)[0] - 4, P(sx, sy)[1] - 4, P(sx, sy)[0] + 4, P(sx, sy)[1] + 4], fill=(0, 255, 0))
        d.ellipse([P(fx, fy)[0] - 4, P(fx, fy)[1] - 4, P(fx, fy)[0] + 4, P(fx, fy)[1] + 4], fill=(80, 120, 255))
    big.save(pfad)
    return pfad


# ── Posenfolgen ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
def _folge(rnd, n, p):
    """Posenindex-Folge je Zunge: m Posen mit Haltedauer 2–3 Frames (Summe genau n → nahtlos). Die Bank (p Posen, geschlossener Zyklus) wird in
    m Schritten r-mal durchlaufen (bei Bedarf werden einzelne Posen übersprungen bzw. doppelt gehalten)."""
    m = max(int(math.ceil(n / 3.0)), min(n // 2, int(round(n / 2.5))))
    r = max(1, int(round(m / float(p))))
    idx = [int(round(q * p * r / float(m))) for q in range(m)]
    extra = n - 2 * m
    holds = [3] * extra + [2] * (m - extra)
    rnd.shuffle(holds)
    return idx, holds


class _Gruppe:
    """Alle Zungen einer Vorlage in kanonischer Lage + Posenfolgen."""
    def __init__(self, vl, n, seed, bank, amp, idx0, welle):
        welle = vl.welle if vl.welle is not None else welle
        bank = vl.bank or bank
        self.vl, self.n = vl, n
        h, w = vl.rgba.shape[:2]
        self.h0, self.w0 = h, w
        self.a = np.ascontiguousarray(_nach_kanon(vl.rgba, vl.richtung))
        self.sperre = np.ascontiguousarray(_nach_kanon(vl.sperre, vl.richtung))
        self.h, self.w = self.a.shape[:2]
        zs = []
        for z in vl.zungen:
            bx, by = _punkt_kanon(z.fuss, vl.richtung, h, w)
            tx, ty = _punkt_kanon(z.spitze, vl.richtung, h, w)
            zs.append(dict(bx=float(bx), by=float(by), tx=float(tx), ty=float(ty), H=max(2.0, by - ty), z=z))
        zs.sort(key=lambda d: 0.5 * (d['bx'] + d['tx']))
        self.z = zs
        k = len(zs)
        for j, d in enumerate(zs):                       # Nachbarn (für das Revier jeder Zunge)
            d['nl'] = zs[j - 1] if j > 0 else None
            d['nr'] = zs[j + 1] if j + 1 < k else None
        self.folgen = []
        pw = len(BAENKE[bank])
        idx_w, holds_w = _folge(random.Random(seed * 31 + 5), n, pw)
        start_w = random.Random(seed * 104729 + 7).randrange(pw)
        for j, d in enumerate(zs):
            rnd = random.Random(seed * 7919 + 131 * (idx0 + j) + 17)
            bk = BAENKE[d['z'].bank or bank]
            p = len(bk)
            if welle is None:
                idx, holds = _folge(rnd, n, p)
                start = rnd.randrange(p)
                schritt = rnd.choice([1, 1, 1, -1])
                folge = []
                for q, hd in enumerate(holds):
                    folge += [bk[(start + schritt * idx[q]) % p]] * hd
                folge = folge[:n]
            else:
                lag, jit = welle                        # Welle: gleiche Folge, Zunge j um lag·j Frames verzögert (+ kleiner Zufall)
                base = []
                for q, hd in enumerate(holds_w):
                    base += [bk[(start_w + idx_w[q]) % p]] * hd
                base = base[:n]
                sh = int(round(lag * j + rnd.uniform(-jit, jit))) % n
                folge = [base[(i - sh) % n] for i in range(n)]
            hh = d['H']
            amp_h = min(1.25, max(0.45, hh / 10.0))
            amp_z = amp * d['z'].amp * amp_h * (0.85 + 0.3 * rnd.random())
            self.folgen.append((folge, amp_z))

    def pose(self, j, i):
        folge, amp_z = self.folgen[j]
        s, l, b, c = folge[i % self.n]
        k = min(1.2, max(0.5, amp_z))
        return 1.0 + (s - 1.0) * k, l * amp_z, b * amp_z, c

    def spitze_aus(self, j, s, l):
        """Spitze der Zunge j in Pose (s, l) in kanonischen Koordinaten (x, y) und effektiver Höhe."""
        d = self.z[j]
        b0 = d['z'].fuss_anteil * d['H']
        te = b0 + (d['H'] - b0) * s
        return d['tx'] + round(l), d['by'] - round(te), te


def _tent(q, lo, hi, soft=1.5):
    """Gewicht 1 innerhalb [lo, hi], fällt außerhalb über `soft` px linear auf 0."""
    d = np.maximum(lo - q, q - hi)
    return np.clip(1.0 - d / soft, 0.0, 1.0)


def _komponenten(m):
    import cv2
    n, lab = cv2.connectedComponents(m.astype(np.uint8), connectivity=4)
    return n, lab


class Feuer:
    def __init__(self, vorlagen, n=48, seed=1, bank='zunge', amp=1.0, funken=True, funken_farben=None, funken_leben=9, welle=None, schwelle=1.5, max_funken=None, funken_abstand=3):
        if isinstance(vorlagen, Vorlage):
            vorlagen = [vorlagen]
        self.n, self.amp = n, amp
        self.h, self.w = vorlagen[0].rgba.shape[:2]
        self.gruppen, idx = [], 0
        for vl in vorlagen:
            g = _Gruppe(vl, n, seed, bank, amp, idx, welle)
            idx += len(g.z)
            self.gruppen.append(g)
        self.funken_an, self.funken_farben, self.funken_leben, self.schwelle = funken, funken_farben, funken_leben, schwelle
        self.max_funken, self.funken_abstand = max_funken, funken_abstand
        self._cache = {}
        self.ereignisse = []                     # (frame, gruppe, x_kanon, y_kanon, drift)
        if funken:
            self._ereignisse(seed)

    # ── Rendering einer Gruppe in kanonischer Lage ──
    def _gruppe_ebene(self, g, i):
        h, w = g.h, g.w
        yy, xx = np.mgrid[0:h, 0:w].astype(float)
        Dx = np.zeros((h, w)); Dy = np.zeros((h, w)); Dc = np.zeros((h, w)); W = np.zeros((h, w))
        anker = np.zeros((h, w), bool)
        for j, d in enumerate(g.z):
            s, l, b, c = g.pose(j, i)
            H, bx, by, tx, ty = d['H'], d['bx'], d['by'], d['tx'], d['ty']
            b0 = d['z'].fuss_anteil * H
            t_out = by - yy                                           # Höhe über dem Fuß in der Ausgabe
            t_src = np.where(t_out <= b0, t_out, b0 + (t_out - b0) / s)
            uu = np.clip(t_src / H, 0.0, 1.0)
            lean = l * uu ** 1.5 + b * np.sin(math.pi * uu)
            lean = np.where(t_out <= 0, 0.0, lean)
            x_src = xx - np.rint(lean)
            y_src = np.where(t_out <= 0, yy, by - np.rint(t_src))

            def achse(t):
                return bx + (tx - bx) * np.clip(t / H, 0.0, 1.0)
            tt = np.clip(t_src, 0, H)
            ax = achse(tt)
            q = x_src - ax
            lo = np.full_like(ax, -12.0); hi = np.full_like(ax, 12.0)
            for nb, seite in ((d['nl'], 'l'), (d['nr'], 'r')):
                if nb is None:
                    continue
                tn = np.clip(tt + (nb['by'] - by), 0, nb['H'])
                axn = nb['bx'] + (nb['tx'] - nb['bx']) * np.clip(tn / nb['H'], 0, 1)
                mid = 0.5 * (axn - ax)
                if seite == 'l':
                    lo = mid
                else:
                    hi = mid
            wgt = _tent(q, lo, hi, self.schwelle)
            wgt = np.where(t_out > 0, wgt, 0.0)
            Dx += wgt * (x_src - xx)
            Dy += wgt * (y_src - yy)
            Dc += wgt * (c * np.sin(math.pi * uu))
            W += wgt
            anker |= (t_out <= b0) & (wgt > 0.5)
        norm = np.maximum(W, 1.0)
        sx = np.rint(xx + Dx / norm).astype(int)
        sy = np.rint(yy + Dy / norm).astype(int)
        scy = np.rint(yy + Dy / norm - Dc / norm).astype(int)          # Kern steigt: Farbe stammt aus tieferer Zeile (kanonisch: größeres y)
        ok = (sx >= 0) & (sx < w) & (sy >= 0) & (sy < h)
        sxc, syc = np.clip(sx, 0, w - 1), np.clip(sy, 0, h - 1)
        sil = ok & (g.a[syc, sxc, 3] > 0)
        out = np.zeros((h, w, 4), np.uint8)
        out[sil] = g.a[syc, sxc][sil]
        scyc = np.clip(scy, 0, h - 1)
        okc = sil & (g.a[scyc, sxc, 3] > 0)
        out[okc, :3] = g.a[scyc, sxc, :3][okc]
        if g.vl.kochen:                                                    # Hitzeflimmern im Innern: die Farbzeichnung wandert leicht
            ky = g.vl.kochen
            ph = 2 * math.pi * i / self.n
            ox = np.rint(ky * np.sin(2 * ph + 0.9 * yy + 0.5 * xx)).astype(int)
            oy = np.rint(ky * np.cos(3 * ph + 0.7 * xx - 0.6 * yy)).astype(int)
            kx = np.clip(sx + ox, 0, w - 1); ky_ = np.clip(sy + oy, 0, h - 1)
            m = sil
            p = np.pad(m, 2)
            tief = m & p[1:-3, 2:-2] & p[3:-1, 2:-2] & p[2:-2, 1:-3] & p[2:-2, 3:-1] & p[:-4, 2:-2] & p[4:, 2:-2] & p[2:-2, :-4] & p[2:-2, 4:]
            use = tief & (g.a[ky_, kx, 3] > 0)
            out[use, :3] = g.a[ky_, kx, :3][use]
        return out, anker

    def _aufraeumen(self, out, anker, g):
        m = out[..., 3] > 0
        # abgetrennte Fetzen: nur Komponenten, die am ruhigen Fuß hängen (oder an der Sperre grenzen)
        n, lab = _komponenten(m)
        keep = np.zeros_like(m)
        sp = g.sperre
        spd = np.pad(sp, 1)
        an_sperre = spd[:-2, 1:-1] | spd[2:, 1:-1] | spd[1:-1, :-2] | spd[1:-1, 2:] | sp
        for k in range(1, n):
            comp = lab == k
            if (comp & anker).any() or (comp & an_sperre).any():
                keep |= comp
        out[~keep] = 0
        m = out[..., 3] > 0
        p = np.pad(m, 1)
        nb = p[:-2, 1:-1].astype(int) + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]
        out[m & (nb == 0)] = 0                                            # Streupixel
        m = out[..., 3] > 0
        if g.vl.loecher:                                                  # eingeschlossene 1-px-Löcher schließen (Farbe des häufigsten Nachbarn)
            p = np.pad(m, 1)
            loch = ~m & p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:]
            for y, x in zip(*np.nonzero(loch)):
                nbc = [out[y + dy, x + dx, :3] for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)) if 0 <= y + dy < out.shape[0] and 0 <= x + dx < out.shape[1] and out[y + dy, x + dx, 3]]
                if nbc:
                    out[y, x, :3] = nbc[0] if len(nbc) < 3 else sorted(nbc, key=lambda c: -sum(1 for d in nbc if (d == c).all()))[0]
                    out[y, x, 3] = 255
            m = out[..., 3] > 0
        if g.vl.faden is not None:
            self._faeden_kuerzen(out, g.vl.faden)
            m = out[..., 3] > 0
        if g.vl.rand_farbe is not None:
            p = np.pad(m | sp, 1)
            voll = p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:]
            rand = m & ~voll
            out[rand, :3] = g.vl.rand_farbe
        return out

    @staticmethod
    def _faeden_kuerzen(out, laenge):
        """1-px-Fäden (Ketten von Pixeln mit höchstens zwei 4-Nachbarn, die an einem Endpixel beginnen) auf `laenge` Pixel kürzen."""
        h, w = out.shape[:2]

        def nachbarn(y, x):
            r = []
            for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                yy, xx = y + dy, x + dx
                if 0 <= yy < h and 0 <= xx < w and out[yy, xx, 3]:
                    r.append((yy, xx))
            return r
        for y, x in list(zip(*np.nonzero(out[..., 3] > 0))):
            if not out[y, x, 3]:
                continue
            nb = nachbarn(y, x)
            if len(nb) != 1:
                continue
            kette = [(y, x)]
            vor = (y, x)
            cur = nb[0]
            while True:
                n2 = nachbarn(*cur)
                if len(n2) == 2:
                    kette.append(cur)
                    nxt = [q for q in n2 if q != vor][0]
                    vor, cur = cur, nxt
                else:
                    break
                if len(kette) > 40:
                    break
            if len(kette) > laenge:
                for (yy, xx) in kette[:len(kette) - laenge]:
                    out[yy, xx] = 0

    def _ebene_gruppe(self, gi, i):
        key = (gi, i % self.n)
        if key not in self._cache:
            g = self.gruppen[gi]
            out, anker = self._gruppe_ebene(g, i % self.n)
            self._cache[key] = self._aufraeumen(out, anker, g)
        return self._cache[key]

    def ebene(self, i):
        res = L.leer(self.h, self.w)
        for gi, g in enumerate(self.gruppen):
            out = np.ascontiguousarray(_von_kanon(self._ebene_gruppe(gi, i), g.vl.richtung))
            m = out[..., 3] > 0
            res[m] = out[m]
        return res

    # ── Funken ──
    def _farben_liste(self, g):
        a = g.a[g.a[..., 3] > 0][:, :3]
        return sorted({tuple(int(v) for v in c) for c in a}, key=lambda c: -(0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]))

    def _ereignisse(self, seed):
        rnd = random.Random(seed * 17 + 3)
        for gi, g in enumerate(self.gruppen):
            for j, d in enumerate(g.z):
                if not d['z'].funke or d['H'] < 4:
                    continue
                for i in range(self.n):
                    s0, l0, _, _ = g.pose(j, i - 1)
                    s1, l1, _, _ = g.pose(j, i)
                    x0, y0, te0 = g.spitze_aus(j, s0, l0)
                    x1, y1, te1 = g.spitze_aus(j, s1, l1)
                    if te0 >= d['H'] * 0.98 and te0 - te1 >= self.schwelle:
                        o = self._ebene_gruppe(gi, i - 1)[..., 3] > 0           # tatsächliche Spitze der Vorgängerpose im gerenderten Bild
                        best = None
                        for xx in range(int(x0) - 1, int(x0) + 2):
                            if 0 <= xx < g.w and o[:, xx].any():
                                yt = int(np.nonzero(o[:, xx])[0].min())
                                if abs(yt - y0) <= 3 and (best is None or yt < best[1]):
                                    best = (xx, yt)
                        if best is None:
                            continue
                        drift = 1 if l0 > l1 else -1 if l0 < l1 else rnd.choice([-1, 1])
                        self.ereignisse.append((i, gi, best[0], best[1], drift, te0 - te1))
        if self.max_funken is not None:                                       # nur die größten Abrisse, zeitlich gestreut
            ev = sorted(self.ereignisse, key=lambda e: -e[5])
            gewaehlt = []
            for e in ev:
                if len(gewaehlt) >= self.max_funken:
                    break
                if all(min((e[0] - q[0]) % self.n, (q[0] - e[0]) % self.n) >= self.funken_abstand for q in gewaehlt):
                    gewaehlt.append(e)
            self.ereignisse = sorted(gewaehlt)

    def funken(self, i, dy=0):
        e = L.leer(self.h, self.w)
        if not self.funken_an:
            return e
        leb = self.funken_leben
        for (f, gi, cx, cy, drift, _) in self.ereignisse:
            g = self.gruppen[gi]
            a = (i - f) % self.n
            if a >= leb:
                continue
            if self.funken_farben:
                cols = list(self.funken_farben)
            else:
                fa = self._farben_liste(g)
                cols = [fa[1], fa[2], fa[3]] if len(fa) >= 4 else [fa[0], fa[min(1, len(fa) - 1)], fa[-1]]
            rise = a + 1 if a < 4 else 4 + (a - 3) // 2 + 1          # zuerst 1 px je Frame, dann langsamer
            x = cx + int(round(drift * a / 5.0))
            if a >= leb - 2 and (a + f) % 2 == 1:
                continue                                              # Verglimmen im Schachbrett-Takt
            col = cols[min(len(cols) - 1, a * len(cols) // leb)]
            # Weg in Bildschirmkoordinaten: erst ein Stück mit dem Flammenstrom, dann steigt der Funke auf
            fx0, fy0 = _punkt_zurueck((x, cy), g.vl.richtung, g.h0, g.w0)
            if g.vl.richtung == 'hoch':
                px, py = int(fx0), int(fy0) - rise
                sx_, sy_ = 0, 1                                        # 1×2-Spitze steht senkrecht
            else:
                fl_x, fl_y = {'runter': (0, 1), 'links': (-1, 0), 'rechts': (1, 0)}[g.vl.richtung]
                k = min(a, 3)
                px = int(fx0) + fl_x * k + (drift if g.vl.richtung == 'runter' else 0) * (a // 3)
                py = int(fy0) + fl_y * k - max(0, (a - 1) // 2 + (1 if a > 0 else 0))
                sx_, sy_ = -fl_x, -fl_y
            pts = [(px, py, col)]
            if a < 2:
                pts = [(px, py, cols[0]), (px + sx_, py + sy_, cols[min(1, len(cols) - 1)])]          # frisch abgerissene Spitze: 1×2 px
            dyy = dy(f) if callable(dy) else dy
            dyy = dy(f) if callable(dy) else dy
            for (px, py, c) in pts:
                fx, fy = int(px), int(py) + dyy
                if not (0 <= fy < self.h and 0 <= fx < self.w):
                    raise L.ClipError(f'Funke bei ({fx},{fy}) außerhalb der Leinwand {self.w}×{self.h}')
                e[fy, fx, :3] = c
                e[fy, fx, 3] = 255
        return e
