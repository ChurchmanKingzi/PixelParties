# -*- coding: utf-8 -*-
"""Gemeinsame Bausteine der Gruppe „Cool“ (Hipdall, Phatnir, Swagdri, Nornstellar, Thrysh, Wildur, Wowkyrie, Yolomungandr — die Coolhalla-Wesen).

Baut auf anim_lib und anim_humanoide (nur lesen, nicht ändern) auf. Alles arbeitet auf RGBA-Feldern der VOLLEN Leinwand (Spritekoordinaten + off);
nur ganze Pixel, kein Alpha, nur Farben der Quelle.

    farbe(spr, x, y)                         RGB-Tupel eines Sprite-Pixels
    maske_farben(spr, farben, region, ohne_rand)   Bool-Maske aller Pixel dieser Farben (optional Rechteck und ohne Außenkante)
    glanz(a, off, i, n, maske, rampe, start, dauer, …)  Lichtband über Metall/Gold (Regel 12/14) — Randpixel bleiben unberührt, wenn die Maske sie ausschließt
    funkel(a, off, i, x, y, start, folge, kern, arm1, arm2)  Glitzerstern AM Objekt: folge = Stufen je Frame (0 = Mitte, 1 = Arme 1 px, 2 = Arme 2 px, None = aus)
    schub_spalten(a, off, maske, pivot, tiefe, dy_max, seite)  Teil kippt „wie ein Hebel“: Spalten wandern um round(dy_max·Abstand/tiefe) Zeilen (ganze Pixel)
    schub_zeilen(a, off, maske, pivot, tiefe, dx_max, seite)   dasselbe für Zeilen (waagerecht), z. B. ein pendelnder Anhänger
    ecken_schliessen(fr, ref_typen, region)   Eckkontakte (zwei Pixel berühren sich nur über die Ecke), die Frame 0 nicht hat, über eine Kante verbinden (Regel 11)
    zuschneiden(frames, rand)                Alle Frames auf dieselbe Box (Vereinigung aller Figurenpixel + rand) zuschneiden (Regel 27)
    abschluss(…)                             Pflichtprüfungen + Speichern + Vorschau
"""
import math
import os
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L


def farbe(spr, x, y):
    return tuple(int(v) for v in spr[y, x, :3])


def maske_farben(spr, farben, region=None, ohne_rand=True):
    """Bool-Maske (Sprite-Format) der Pixel mit einer Farbe aus `farben`; region = (x0, y0, x1, y1) inklusive; ohne_rand schließt die Außenkante (Umriss) aus."""
    m = L.farbmaske(spr, farben)
    if region is not None:
        x0, y0, x1, y1 = region
        r = np.zeros_like(m)
        r[y0:y1 + 1, x0:x1 + 1] = True
        m &= r
    if ohne_rand:
        m &= ~Hm.kantenmaske(spr)
    return m


def glanz(a, off, i, n, maske, rampe, start, dauer, stufen=1, breite=2.4, achse=(1.0, 1.0), kern=None):
    """Lichtband (Hm.lichtband) über die Pixel der `maske` (Sprite-Koordinaten); nur Pixel, deren Farbe auf `rampe` (dunkel → hell) steht, werden heller."""
    return Hm.lichtband(a, maske, off, i, n, start, dauer, rampe, stufen=stufen, breite=breite, achse=achse, kern=kern)


def funkel(a, off, i, x, y, start, folge, kern, arm1, arm2=None, n=None):
    """Glitzerstern: im Frame start+k die Stufe folge[k] (0 nur Mitte, 1 Arme 1 px, 2 Arme 2 px), sonst nichts. Der Stern sitzt am Objekt."""
    s = Hm.folge(i, start, folge, n)
    if s is None:
        return a
    return Hm.stern4(a, x, y, s, kern, arm1, arm2, off)


def _verschieben(a, off, maske, wert_fn, achse):
    """Gemeinsamer Kern von schub_spalten/schub_zeilen: die Pixel der Maske werden aus `a` gelöst, je Pixel um wert_fn(x, y) ganze Pixel entlang `achse`
    ('y' = senkrecht, 'x' = waagerecht) versetzt und über den Rest gelegt."""
    h, w = a.shape[:2]
    out = a.copy()
    teil = L.leer(h, w)
    ys, xs = np.nonzero(maske)
    for y, x in zip(ys, xs):
        Y, X = int(y) + off[1], int(x) + off[0]
        teil[Y, X] = a[Y, X]
        out[Y, X] = 0
    neu = L.leer(h, w)
    for y, x in zip(ys, xs):
        d = int(wert_fn(int(x), int(y)))
        Y, X = int(y) + off[1], int(x) + off[0]
        if achse == 'y':
            Y += d
        else:
            X += d
        if not (0 <= Y < h and 0 <= X < w):
            raise L.ClipError(f'Pixel ({x},{y}) würde um {d} px aus der Leinwand geschoben')
        neu[Y, X] = teil[int(y) + off[1], int(x) + off[0]]
    m = neu[..., 3] > 0
    out[m] = neu[m]
    return out


def schub_spalten(a, off, maske, pivot, tiefe, dy_max, seite=-1):
    """Spalten der Maske auf der Seite `seite` (-1 = links vom Pivot, +1 = rechts) wandern um round(dy_max · min(1, Abstand/tiefe)) Zeilen
    (dy_max < 0 = nach oben). Am Pivot bleibt alles stehen: ein Hebel."""
    def wert(x, y):
        d = (pivot - x) if seite < 0 else (x - pivot)
        return round(dy_max * min(1.0, max(0.0, d / tiefe)))
    return _verschieben(a, off, maske, wert, 'y')


def schub_zeilen(a, off, maske, pivot, tiefe, dx_max, seite=1):
    """Zeilen der Maske unterhalb (seite=+1) bzw. oberhalb (-1) des Pivots wandern um round(dx_max · min(1, Abstand/tiefe)) Spalten (Pendel)."""
    def wert(x, y):
        d = (y - pivot) if seite > 0 else (pivot - y)
        return round(dx_max * min(1.0, max(0.0, d / tiefe)))
    return _verschieben(a, off, maske, wert, 'x')


def ecken_schliessen(fr, ref_typen, region=None, farbe_fn=None):
    """Eckkontakte (Pixelpaare, die sich nur diagonal berühren) von Typen, die im Referenzframe (`ref_typen` = Hm.eckkontakt_typen(frame0)) seltener sind,
    werden über eine Kante verbunden: das Pixel (x2, y1) bekommt die dunklere der beiden Farben. region = (x0, y0, x1, y1) Leinwand, inklusive."""
    from collections import Counter
    paare = list(Hm.eckkontakte(fr))
    typ = {}
    for (p, q) in paare:
        a = tuple(int(v) for v in fr[p[1], p[0], :3])
        b = tuple(int(v) for v in fr[q[1], q[0], :3])
        typ.setdefault(tuple(sorted((a, b))), []).append((p, q))
    aktuell = Counter({k: len(v) for k, v in typ.items()})
    ueber = aktuell - Counter(ref_typen)
    for k, extra in ueber.items():
        cand = typ[k]
        if region is not None:
            x0, y0, x1, y1 = region
            cand = [(p, q) for (p, q) in cand if x0 <= p[0] <= x1 and y0 <= p[1] <= y1 and x0 <= q[0] <= x1 and y0 <= q[1] <= y1]
        for (p, q) in cand[:max(extra, 0) if region is None else len(cand)]:
            cp = fr[p[1], p[0], :3]
            cq = fr[q[1], q[0], :3]
            c = cp if int(cp.astype(int).sum()) <= int(cq.astype(int).sum()) else cq
            if farbe_fn:
                c = farbe_fn(p, q, c)
            x, y = q[0], p[1]                                   # die Ecke neben p auf q's Spalte
            if not fr[y, x, 3]:
                fr[y, x, :3] = c
                fr[y, x, 3] = 255
    return fr


# ── Wölkchen (nie kleiner als 2×2, Regel 25): 2×2 → 3×3 → 2×2 entlang eines Weges, nur im Fenster [s, s+L) (mod n) sichtbar ──────────
WOLKEN_FORMEN = {
    's': [(0, 0, 'c'), (1, 0, 'r'), (0, 1, 'r'), (1, 1, 'r')],
    'd': [(dx, dy, 'c' if (dx, dy) == (0, 0) else 'r') for dy in (-1, 0, 1) for dx in (-1, 0, 1)],
}


def wolken(h, w, i, n, liste, farben, off=(0, 0)):
    """liste: dict(s=Startframe, L=Lebensdauer in Frames, x0, y0, x1, y1 = Weg in Spritekoordinaten (+ off), wackeln=0, gross=(0.3, 0.7) = Fenster der 3×3-Form).
    farben = {'c': Kern, 'r': Rand}. Wirft ClipError, wenn ein Wölkchen aus der Leinwand ragt."""
    out = L.leer(h, w)
    for p in liste:
        k = (i - p['s']) % n
        if k >= p['L']:
            continue
        t = k / max(1, p['L'] - 1)
        cx = p['x0'] + (p['x1'] - p['x0']) * t + p.get('wackeln', 0) * math.sin(2 * math.pi * t) + off[0]
        cy = p['y0'] + (p['y1'] - p['y0']) * t + off[1]
        cx, cy = int(math.floor(cx + 0.5)), int(math.floor(cy + 0.5))
        lo, hi = p.get('gross', (0.3, 0.7))
        form = 'd' if lo <= t <= hi else 's'
        for (dx, dy, kk) in WOLKEN_FORMEN[form]:
            x, y = cx + dx, cy + dy
            if not (0 <= y < h and 0 <= x < w):
                raise L.ClipError(f'Wölkchen bei ({x},{y}) liegt außerhalb der Leinwand {w}×{h}')
            out[y, x, :3] = farben[kk]
            out[y, x, 3] = 255
    return out


def zuschneiden(frames, rand=2):
    """Alle Frames auf dieselbe Box schneiden (Regel 3/27, nie abschneiden): waagerecht SYMMETRISCH um die Ruhefigur (Frame 0), Rand = größter Überstand + `rand`
    leere Pixel; senkrecht die Vereinigung aller deckenden Pixel + `rand`."""
    r = frames[0][..., 3].any(axis=0)
    rx0, rx1 = int(np.nonzero(r)[0].min()), int(np.nonzero(r)[0].max()) + 1
    xs = np.concatenate([np.nonzero(f[..., 3].any(axis=0))[0] for f in frames])
    ys = np.concatenate([np.nonzero(f[..., 3].any(axis=1))[0] for f in frames])
    mx = max(rx0 - int(xs.min()), int(xs.max()) + 1 - rx1) + rand
    x0, x1 = rx0 - mx, rx1 + mx
    y0, y1 = int(ys.min()) - rand, int(ys.max()) + rand + 1
    h, w = frames[0].shape[:2]
    assert y0 >= 0 and x0 >= 0 and y1 <= h and x1 <= w, f'Leinwand zu klein für Zuschnitt (Box {x0},{y0},{x1},{y1} in {w}×{h})'
    return [f[y0:y1, x0:x1].copy() for f in frames], (x0, y0)


def abschluss(slug, karte, frames, ms, spr, off, vorschau=None, erlaubt=(), extra=None, ecken=True, rand=2, check_scale=10):
    """Pflichtprüfungen (Regel 3, 9, 11, 16, 27) + Speichern. frames: Frames auf der vollen Leinwand."""
    diff = Hm.ruhepose(frames[0], spr, off)
    print('Ruhepose weicht vom Original ab bei:', diff if diff else 'nichts')
    if ecken:
        e0 = Hm.eckkontakt_typen(frames[0])
        neu = {i: dict(Hm.eckkontakt_typen(g) - e0) for i, g in enumerate(frames) if Hm.eckkontakt_typen(g) - e0}
        print('neue Eckkontakte gegenüber Frame 0:', neu if neu else 'keine')
    crop, org = zuschneiden(frames, rand)
    n = L.pruefe(crop, quelle=spr, erlaubt=erlaubt)
    print('Pixel je Frame:', n)
    L.speichern(slug, karte, crop, ms, vorschau, extra=extra)
    if vorschau:
        os.makedirs(vorschau, exist_ok=True)
        L.streifen(os.path.join(vorschau, slug + '-strip.png'), crop, spalten=12, scale=check_scale if len(crop) < 1 else 6)
    return crop


def vorschau_arg():
    return sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
