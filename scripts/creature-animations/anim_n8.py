# -*- coding: utf-8 -*-
"""Bausteine der Gruppe „n8“ (Neubau-Welle 3; Grundgerüst wie anim_n7, eigene Kopie, damit kein fremdes Modul verändert oder vorausgesetzt wird).

    Szene(slug, pad)                 Sprite laden, Leinwand mit Rand; .teil(maske) legt eine Ebene auf die volle Leinwand
    zuschneiden(frames, rand=2)      alle Frames gemeinsam auf die Figur zuschneiden (gleicher Ausschnitt, Rand ≥ 2)
    starr(a, dx, dy)                 Ebene starr verschieben (ClipError statt Abschneiden)
    stufe(i, periode, start, dauer)  1 in einem Fenster je Periode, sonst 0
    sinus_px(i, periode, amp, vers)  gerundeter Sinus (ganze Pixel)
    farbtausch(a, maske, abbild)     Farben nur innerhalb einer Maske ersetzen (Blinzeln, Glut in Augenpixeln)
    funkel(e, x, y, stufe, farbe)    kurzes Sparkle (1 Punkt → Kreuz → Punkt), nur für Metall/Gold/Edelstein
    blasen(...)                      aufsteigende 2×2-Bläschen/Tropfen (nahtlos)
    fertig(...)                      prüfen, zuschneiden, speichern, GIF + Kontaktbogen
"""
import math
import sys

import numpy as np
from PIL import Image

import anim_lib as L


class Szene:
    def __init__(self, slug, pad=(4, 4, 4, 4)):
        """pad = (links, rechts, oben, unten)."""
        self.slug = slug
        self.spr = L.lade(slug)
        self.sh, self.sw = self.spr.shape[:2]
        self.PL, self.PR, self.PT, self.PB = pad
        self.H, self.W = self.sh + self.PT + self.PB, self.sw + self.PL + self.PR
        self.yy, self.xx = np.mgrid[0:self.sh, 0:self.sw]
        self.da = self.spr[..., 3] > 0

    def teil(self, maske, quelle=None):
        q = self.spr if quelle is None else quelle
        a = np.where((maske & (q[..., 3] > 0))[..., None], q, 0).astype(np.uint8)
        return L.platz(a, self.H, self.W, self.PL, self.PT)

    def farbe(self, x, y):
        return tuple(int(v) for v in self.spr[y, x, :3])

    def ist(self, *farben):
        return L.farbmaske(self.spr, farben)

    def voll(self, m):
        """Sprite-Maske → Leinwandmaske."""
        o = np.zeros((self.H, self.W), bool)
        o[self.PT:self.PT + self.sh, self.PL:self.PL + self.sw] = m
        return o


def starr(a, dx, dy):
    return L.versetze(a, int(dx), int(dy)) if (dx or dy) else a


def stufe(i, periode, start, dauer):
    return 1 if (i - start) % periode < dauer else 0


def sinus_px(i, periode, amp, versatz=0.0):
    v = amp * math.sin(2 * math.pi * i / periode + versatz)
    return int(math.floor(v + 0.5))


def farbtausch(a, maske, abbild):
    out = a.copy()
    for alt, neu in abbild.items():
        m = L.farbmaske(a, [alt]) & maske
        out[m, :3] = neu
    return out


def funkel(e, x, y, st, farbe, arm=None):
    """Sparkle: st 1 = Punkt, 2 = Kreuz (5 px), 3 = großes Kreuz (9 px). Schreibt in e (ClipError außerhalb)."""
    arm = arm or farbe
    pkt = {1: [(0, 0)], 2: [(0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)],
           3: [(0, 0), (1, 0), (-1, 0), (0, 1), (0, -1), (2, 0), (-2, 0), (0, 2), (0, -2)]}[st]
    for dx, dy in pkt:
        px, py = x + dx, y + dy
        if not (0 <= py < e.shape[0] and 0 <= px < e.shape[1]):
            raise L.ClipError('Funkel außerhalb')
        e[py, px, :3] = farbe if (dx, dy) == (0, 0) else arm
        e[py, px, 3] = 255
    return e


def funkel_folge(i, n, start, folge=(1, 2, 3, 2, 1)):
    k = (i - start) % n
    return folge[k] if k < len(folge) else 0


def blasen(h, w, i, n, liste, farbe, rand=None):
    """Aufsteigende runde Bläschen (2×2; mit `rand` 4×4-Ring mit 2×2-Kern in `farbe`). liste: dict(x, y, weg, off, wackeln=1, leben=n).
    Jede Blase lebt `leben` Frames (Teiler von n → nahtlos), steigt `weg` px (negativ = nach oben)."""
    e = L.leer(h, w)
    for b in liste:
        leben = b.get('leben', n)
        k = (i + b.get('off', 0)) % leben
        t = k / leben
        x = int(round(b['x'] + b.get('wackeln', 1) * math.sin(2 * math.pi * t * b.get('schw', 2))))
        y = int(round(b['y'] + b['weg'] * t))
        gross = b.get('gross', False) and 0.15 < t < 0.85
        pts = [(0, 0), (1, 0), (0, 1), (1, 1)]
        if t > 0.92 and not b.get('bleibt', False):
            pts = [(0, 0), (1, 0)]
        for dx, dy in pts:
            if not (0 <= y + dy < h and 0 <= x + dx < w):
                raise L.ClipError('Blase außerhalb')
            e[y + dy, x + dx, :3] = farbe; e[y + dy, x + dx, 3] = 255
        if gross and rand is not None:
            for dx, dy in [(0, -1), (1, -1), (-1, 0), (-1, 1), (2, 0), (2, 1), (0, 2), (1, 2)]:
                if not (0 <= y + dy < h and 0 <= x + dx < w):
                    raise L.ClipError('Blase außerhalb')
                e[y + dy, x + dx, :3] = rand; e[y + dy, x + dx, 3] = 255
    return e


def zuschneiden(frames, rand=2):
    al = np.stack([f[..., 3] > 0 for f in frames]).any(axis=0)
    ys, xs = np.nonzero(al)
    H, W = al.shape
    y0, y1, x0, x1 = ys.min() - rand, ys.max() + rand + 1, xs.min() - rand, xs.max() + rand + 1
    out = []
    for f in frames:
        g = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
        sy0, sx0 = max(0, y0), max(0, x0)
        sy1, sx1 = min(H, y1), min(W, x1)
        g[sy0 - y0:sy1 - y0, sx0 - x0:sx1 - x0] = f[sy0:sy1, sx0:sx1]
        out.append(g)
    return out, (x0, y0)


def kontakt(pfad, frames, ks, zoom=12, box=None, spalten=6, hintergrund=(40, 30, 70)):
    """Ausgewählte Frames groß nebeneinander (optional Ausschnitt box=(x0,y0,x1,y1)) mit dünnem Pixelraster."""
    from PIL import ImageDraw
    bil = []
    for k in ks:
        f = frames[k]
        if box:
            f = f[box[1]:box[3], box[0]:box[2]]
        bil.append((k, f))
    h, w = bil[0][1].shape[:2]
    zeilen = (len(bil) + spalten - 1) // spalten
    sh = Image.new('RGB', (min(len(bil), spalten) * (w * zoom + 6), zeilen * (h * zoom + 16)), (12, 10, 20))
    d = ImageDraw.Draw(sh)
    for n, (k, f) in enumerate(bil):
        im = Image.fromarray(f).resize((w * zoom, h * zoom), Image.NEAREST)
        b = Image.new('RGBA', im.size, hintergrund + (255,)); b.alpha_composite(im)
        ox, oy = (n % spalten) * (w * zoom + 6), (n // spalten) * (h * zoom + 16) + 14
        sh.paste(b.convert('RGB'), (ox, oy))
        d.text((ox + 2, oy - 13), 'F%d' % k, fill=(255, 255, 0))
    sh.save(pfad)
    return pfad


def fertig(slug, karte, frame_fn, n, ms, quelle, erlaubt=(), extra=None, check=None, zoom=10, box=None, spalten=6):
    """Alle Frames rendern, zuschneiden (Rand 2), prüfen, speichern. --preview <ordner>: GIF + Kontaktbogen <slug>-check.png."""
    roh = [frame_fn(i) for i in range(n)]
    frames, _ = zuschneiden(roh, 2)
    pix = L.pruefe(frames, quelle=quelle, erlaubt=erlaubt)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern(slug, karte, frames, ms, prev, extra=extra)
    if prev:
        ks = check or list(range(0, n, max(1, n // 12)))
        kontakt(prev + '/%s-check.png' % slug, frames, ks, zoom=zoom, box=box, spalten=spalten)
    return frames


def koerner(h, w, i, liste, sperre=None):
    """Rieselnde Körner/Krümel (2×2, am Lebensende 2×1): liste aus dict(x, y, dx, dy, leben, off, farbe, start=0, periode=leben).
    Ein Korn läuft in `leben` Frames geradlinig von (x, y) um (dx, dy); es erscheint je `periode` Frames einmal (ab Frame `off`).
    sperre: Leinwandmaske, in der kein Korn gezeichnet wird."""
    e = L.leer(h, w)
    for b in liste:
        per = b.get('periode', b['leben'])
        k = (i - b.get('off', 0)) % per
        if k >= b['leben']:
            continue
        t = k / b['leben']
        fall = b.get('fall', 0.0)                       # zusätzliche Fallbeschleunigung (px über die Lebensdauer, quadratisch)
        x = int(round(b['x'] + b['dx'] * t)); y = int(round(b['y'] + b['dy'] * t + fall * t * t))
        pts = [(0, 0), (1, 0), (0, 1), (1, 1)] if t < 0.8 else [(0, 1), (1, 1)]
        for px, py in pts:
            if not (0 <= y + py < h and 0 <= x + px < w):
                raise L.ClipError('Korn außerhalb')
            if sperre is not None and sperre[y + py, x + px]:
                continue
            e[y + py, x + px, :3] = b['farbe']; e[y + py, x + px, 3] = 255
    return e


def zeilen_versatz(a, versatz):
    """Zeilen der Ebene starr waagerecht verschieben: versatz = {y: dx} (Leinwandzeilen). Für Posen mit Gefälle ≤ 1 px je Zeile."""
    out = a.copy()
    for y, dx in versatz.items():
        if dx:
            out[y] = 0
            xs = np.nonzero(a[y, :, 3])[0]
            if len(xs):
                if xs.min() + dx < 0 or xs.max() + dx >= a.shape[1]:
                    raise L.ClipError('Zeile außerhalb')
                out[y, xs + dx] = a[y, xs]
    return out


def luecken(frame, erlaubt=None):
    """Zahl der transparenten Pixel, die ringsum (4er) von Deckendem umgeben sind (Löcher in der Figur)."""
    m = frame[..., 3] > 0
    p = np.pad(m, 1)
    loch = (~m) & p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:]
    return [(int(x), int(y)) for y, x in zip(*np.nonzero(loch))]


def spalten_versatz(a, dy_von_x):
    """Jede Spalte starr senkrecht verschieben (dy_von_x(x) → ganze Pixel, positiv = nach unten). Für Flügelschläge um ein Gelenk: der Versatz wächst mit dem
    Abstand zum Gelenk um höchstens 1 px je Spalte. Dieselbe Funktion auf Flügel UND daran hängende Ebenen (Flammen) anwenden."""
    out = np.zeros_like(a)
    h = a.shape[0]
    for x in np.nonzero(a[..., 3].any(axis=0))[0]:
        d = int(dy_von_x(int(x)))
        ys = np.nonzero(a[:, x, 3])[0]
        if ys.min() + d < 0 or ys.max() + d >= h:
            raise L.ClipError('Spalte %d würde aus der Leinwand geschoben' % x)
        out[ys + d, x] = a[ys, x]
    return out


def kontur_schliessen(f, umrissfarben, farbe, maske=None):
    """Nach starrem Spalten-/Zeilenversatz: Innenpixel, die an einer Versatzstufe frei am Hintergrund liegen (4er-Nachbarschaft), bekommen die Umrissfarbe.
    Der Umriss wird dadurch nicht dicker, die Stufe wird nur geschlossen. maske: nur dort prüfen."""
    m = f[..., 3] > 0
    p = np.pad(m, 1)
    frei = m & ((~p[:-2, 1:-1]) | (~p[2:, 1:-1]) | (~p[1:-1, :-2]) | (~p[1:-1, 2:]))
    ok = np.zeros(m.shape, bool)
    for c in umrissfarben:
        ok |= (f[..., 0] == c[0]) & (f[..., 1] == c[1]) & (f[..., 2] == c[2])
    z = frei & ~ok
    if maske is not None:
        z &= maske
    out = f.copy()
    out[z, :3] = farbe
    return out
