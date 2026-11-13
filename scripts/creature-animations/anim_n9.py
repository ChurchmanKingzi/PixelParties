# -*- coding: utf-8 -*-
"""Bausteine der Gruppe „n9“ (Neubau-Welle 3). Verändert kein gemeinsames Modul (Grundstock wie anim_n7, eigenständige Kopie).

    Szene(slug, pad)                 Sprite laden, Leinwand mit Rand; .teil(maske) legt eine Ebene auf die volle Leinwand
    zuschneiden(frames, rand=2)      alle Frames gemeinsam auf die Figur zuschneiden (gleicher Ausschnitt, Rand ≥ 2)
    starr(a, dx, dy)                 Ebene starr verschieben (ClipError statt Abschneiden)
    stufe / sinus_px / huelle        Zeitverläufe in ganzen Pixeln
    farbtausch(a, maske, abbild)     Farben nur innerhalb einer Maske ersetzen (Blinzeln)
    funkel(e, x, y, stufe, farbe)    kurzes Sparkle (Punkt → Kreuz → Punkt), nur für Metall/Gold/Edelstein
    brocken(...)                     geworfene 2×2-Brocken auf einer Wurfbahn (Erde, Staub)
    loecher(frame)                   Hintergrundpixel, die ganz von der Figur umschlossen sind (Lückensuche)
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


def huelle(i, n, start, werte):
    """werte[k] im Fenster ab `start` (je Periode n), sonst 0."""
    k = (i - start) % n
    return werte[k] if k < len(werte) else 0


def brocken(h, w, i, liste, farbe, farbe2=None):
    """Geworfene 2×2-Brocken: dict(x, y, vx, vy, g, start, dauer). Bahn x+vx·t, y+vy·t+g·t² (t in Frames ab `start`), ganzzahlig gerundet.
    Im letzten Frame nur noch 2×1 (zerfällt am Boden). farbe2: untere Zeile des Brockens (Schattierung)."""
    e = L.leer(h, w)
    for b in liste:
        t = i - b['start']
        if not 0 <= t < b['dauer']:
            continue
        x = int(round(b['x'] + b['vx'] * t))
        y = int(round(b['y'] + b['vy'] * t + b.get('g', 0) * t * t))
        pts = [(0, 0), (1, 0), (0, 1), (1, 1)] if t < b['dauer'] - 1 else [(0, 1), (1, 1)]
        for dx, dy in pts:
            if not (0 <= y + dy < h and 0 <= x + dx < w):
                raise L.ClipError('Brocken außerhalb')
            e[y + dy, x + dx, :3] = (farbe2 if (farbe2 and dy == 1) else farbe); e[y + dy, x + dx, 3] = 255
    return e


def loecher(frame):
    """Koordinaten transparenter Pixel, die nicht mit dem Bildrand verbunden sind (4er-Nachbarschaft)."""
    al = frame[..., 3] > 0
    h, w = al.shape
    aussen = np.zeros_like(al)
    stapel = [(y, x) for y in range(h) for x in (0, w - 1)] + [(y, x) for x in range(w) for y in (0, h - 1)]
    while stapel:
        y, x = stapel.pop()
        if not (0 <= y < h and 0 <= x < w) or al[y, x] or aussen[y, x]:
            continue
        aussen[y, x] = True
        stapel += [(y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)]
    ys, xs = np.nonzero(~al & ~aussen)
    return list(zip(xs.tolist(), ys.tolist()))


def lochbericht(frames, ruhe=0):
    """Meldet je Frame Löcher, die es im Ruheframe (an derselben Stelle ± 2 px) nicht gibt."""
    basis = set(loecher(frames[ruhe]))
    aus = {}
    for k, f in enumerate(frames):
        neu = [p for p in loecher(f) if not any((p[0] + dx, p[1] + dy) in basis for dx in (-2, -1, 0, 1, 2) for dy in (-2, -1, 0, 1, 2))]
        if neu:
            aus[k] = neu
    print('neue Löcher:', aus if aus else 'keine')
    return aus


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


def fertig(slug, karte, frame_fn, n, ms, quelle, erlaubt=(), extra=None, check=None, zoom=10, box=None):
    """Alle Frames rendern, zuschneiden (Rand 2), prüfen, speichern. --preview <ordner>: GIF + Kontaktbogen <slug>-check.png."""
    roh = [frame_fn(i) for i in range(n)]
    frames, _ = zuschneiden(roh, 2)
    pix = L.pruefe(frames, quelle=quelle, erlaubt=erlaubt)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern(slug, karte, frames, ms, prev, extra=extra)
    if prev:
        ks = check or list(range(0, n, max(1, n // 12)))
        kontakt(prev + '/%s-check.png' % slug, frames, ks, zoom=zoom, box=box)
    lochbericht(frames)
    return frames
