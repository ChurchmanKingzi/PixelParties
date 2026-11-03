# -*- coding: utf-8 -*-
"""Gemeinsame Bausteine für die Ei-Animationen (Monster Nest, Dragoneier, The Egg of God): kleine Risse, die auf den statischen Eiern
erscheinen und wieder verschwinden (Nutzer-Feedback: „Eier statisch, kleine Risse auf den einzelnen Eiern, die erscheinen und verschwinden“).

Ein Riss ist eine kurze Pixelfolge (1–2 Pixel, in Spritekoordinaten) in der dunklen Umrissfarbe des Eis. Er wächst in ganzen Schritten
(erst 1 Pixel, dann 2 Pixel), bleibt kurz stehen, schrumpft wieder auf 1 Pixel und ist weg. Jedes Ei bekommt seine Risse zeitversetzt,
nie mehr als ein paar gleichzeitig; Frame 0 ist immer rissfrei (= Original).

    risse = [Riss([(x, y), (x2, y2)], start=3), …]
    ebene = risse_ebene(h, w, i, n, risse, farbe, dx, dy)     # Ebene mit den Rissen von Frame i (dx, dy = Versatz des Sprites im Frame)
"""
import numpy as np

import anim_lib as L

# Verlauf eines Risses (Anzahl sichtbarer Pixel je Frame, danach weg): wächst, steht, schrumpft.
PROFIL = (1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1)
PROFIL_KURZ = (1, 2, 2, 2, 2, 2, 1)
PROFIL3 = (1, 1, 2, 2, 3, 3, 3, 3, 2, 2, 1, 1)                                             # für 3-Pixel-Risse
PROFIL3L = (1, 1, 2, 2, 3, 3, 3, 3, 3, 3, 2, 2, 1, 1)                                      # 3-Pixel-Riss, etwas länger sichtbar
PROFIL4 = (1, 1, 2, 2, 3, 3, 4, 4, 4, 4, 3, 3, 2, 2, 1, 1)                                 # für 4-Pixel-Risse (große Eier)


class Riss:
    def __init__(self, pix, start, profil=PROFIL, farbe=None, spitze=None):
        self.pix = [tuple(p) for p in pix]
        self.start = start
        self.profil = profil
        self.farbe = farbe                                                           # None = Standardfarbe des Eis
        self.spitze = spitze                                                         # Farbe des LETZTEN Pixels (z. B. ein Grau als auslaufende Spitze)

    def stufe(self, i, n):
        t = (i - self.start) % n
        return self.profil[t] if t < len(self.profil) else 0


def gleichzeitig(risse, n):
    """Höchstzahl gleichzeitig sichtbarer Risse (zur Kontrolle) und die Frames ohne Riss."""
    z = [sum(1 for r in risse if r.stufe(i, n)) for i in range(n)]
    return max(z), [i for i, v in enumerate(z) if v == 0]


def risse_ebene(h, w, i, n, risse, farbe, dx=0, dy=0, gueltig=None):
    """Ebene (h×w, RGBA) mit allen Rissen von Frame i; (dx, dy) = Lage des Sprites im Frame. gueltig: optionale Bool-Maske des Sprites, auf der
    die Risse liegen müssen (wirft AssertionError, falls ein Rissprite daneben läge)."""
    e = L.leer(h, w)
    for r in risse:
        k = r.stufe(i, n)
        for j, (x, y) in enumerate(r.pix[:k]):
            if gueltig is not None:
                assert gueltig[y, x], f'Riss-Pixel ({x},{y}) liegt nicht auf dem Ei'
            c = (r.spitze if (j >= 1 and j == len(r.pix) - 1 and r.spitze) else (r.farbe or farbe))
            e[y + dy, x + dx, :3] = c
            e[y + dy, x + dx, 3] = 255
    return e


def auf_figur(fig, ebene):
    """Rissebene über die Figur legen (Risse ersetzen die darunterliegenden Pixel, nie neue Fläche)."""
    out = fig.copy()
    m = ebene[..., 3] > 0
    assert not (m & (fig[..., 3] == 0)).any(), 'Riss ragt über den Rand des Eis hinaus'
    out[m] = ebene[m]
    return out


def vorschlag(spr, hell, n, rand_abstand=3, meide=(), seed=1, formen=((0, 1), (1, 1), (-1, 1)), umfeld=0, laenge=2):
    """Hilfe zum EINMALIGEN Aussuchen von Rissstellen (die gewählten Koordinaten stehen danach fest im Skript): n Pixelpaare (Pixel 1, Pixel 2) auf Schalenpixeln der Farben `hell`
    (Liste von RGB), mindestens `rand_abstand` Pixel vom Silhouettenrand, möglichst weit voneinander entfernt; `meide` = Liste von (x, y), die frei bleiben (±2 px);
    umfeld = Mindestzahl heller Schalenpixel unter den 8 Nachbarn jedes Rissstellenpixels (damit der dunkle Riss nicht in dunklem Raster untergeht)."""
    import random
    h, w = spr.shape[:2]
    op = spr[..., 3] > 0
    hm = np.zeros((h, w), bool)
    for c in hell:
        hm |= (spr[..., :3] == np.array(c)).all(axis=2) & op
    # Abstand zum Rand (Chebyshev) über wiederholtes Schrumpfen
    cur = op.copy(); d = 0; dist = np.zeros((h, w), int)
    while cur.any():
        d += 1
        p = np.pad(cur, 1)
        nxt = cur & p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:] & p[:-2, :-2] & p[:-2, 2:] & p[2:, :-2] & p[2:, 2:]
        dist[cur & ~nxt] = d
        cur = nxt
    kand = []
    for y in range(h):
        for x in range(w):
            if not (hm[y, x] and dist[y, x] >= rand_abstand):
                continue
            if any(abs(x - mx) <= 2 and abs(y - my) <= 2 for (mx, my) in meide):
                continue
            pfade = [[(x, y)]]
            for _ in range(laenge - 1):
                pfade = [pf + [(pf[-1][0] + dx, pf[-1][1] + dy)] for pf in pfade for (dx, dy) in formen
                         if (pf[-1][0] + dx, pf[-1][1] + dy) not in pf]
            for pf in pfade:
                if any(not (0 <= q[0] < w and 0 <= q[1] < h and hm[q[1], q[0]] and dist[q[1], q[0]] >= rand_abstand) for q in pf):
                    continue
                if umfeld:
                    pp = np.pad(hm, 1)
                    if min(int(pp[q[1]:q[1] + 3, q[0]:q[0] + 3].sum()) - 1 for q in pf) < umfeld:
                        continue
                kand.append(tuple(pf))
    rnd = random.Random(seed)
    rnd.shuffle(kand)
    gew = []
    for _ in range(n):
        if not kand:
            break
        if not gew:
            gew.append(kand.pop())
            continue
        def d(k):
            return min(abs(k[0][0] - g[0][0]) + abs(k[0][1] - g[0][1]) for g in gew)
        kand.sort(key=d)
        gew.append(kand.pop())
    return gew


# ── Runde 3: mehr Risse, mehrere je Ei gleichzeitig, nie neben einem Umriss ─────────────────────────────────────────────
SPARKLE_LAUF = [0, 1, 2, 1]                                  # kurzer Glitzer (Gold): Mitte → kleines Kreuz → großes Kreuz → kleines Kreuz, dann weg (4 Frames)


def sicher(spr, riss_farben, nachbar_farben=(), rand_abstand=2, nachbar8=False):
    """Maske der Pixel, auf denen ein Riss liegen darf: Pixel mit Farbe in `riss_farben`, dessen 4 (nachbar8: 8) Nachbarn alle deckend sind und Farbe in
    `riss_farben`/`nachbar_farben` haben (also NIE neben einem Umriss/einer Raute/dem Rand -> der Riss kann keine Linie verdicken), und der mindestens
    `rand_abstand` Pixel (Chebyshev) vom Silhouettenrand entfernt liegt."""
    h, w = spr.shape[:2]
    op = spr[..., 3] > 0

    def m(cs):
        r = np.zeros((h, w), bool)
        for c in cs:
            r |= (spr[..., :3] == np.array(c)).all(axis=2)
        return r & op
    hm = m(riss_farben)
    nm = m(nachbar_farben) | hm
    rand = np.zeros((h, w), bool)
    for y in range(h):
        for x in range(w):
            if op[y, x] and not op[max(y - rand_abstand, 0):y + rand_abstand + 1, max(x - rand_abstand, 0):x + rand_abstand + 1].all():
                rand[y, x] = True
            if op[y, x] and (y < rand_abstand or x < rand_abstand or y >= h - rand_abstand or x >= w - rand_abstand):
                rand[y, x] = True
    nb = [(0, 1), (0, -1), (1, 0), (-1, 0)] + ([(1, 1), (1, -1), (-1, 1), (-1, -1)] if nachbar8 else [])
    out = np.zeros((h, w), bool)
    for y in range(h):
        for x in range(w):
            if not hm[y, x] or rand[y, x]:
                continue
            out[y, x] = all(0 <= y + dy < h and 0 <= x + dx < w and nm[y + dy, x + dx] for dx, dy in nb)
    return out


_RICHT = [(1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1), (0, -1), (1, -1)]


def pfade(maske, laenge):
    """Alle zackigen Pfade aus `laenge` Pixeln auf der Maske: jeder Schritt in einer der 8 Richtungen, die Richtung ändert sich höchstens um 45 Grad je Schritt,
    und nicht aufeinanderfolgende Pfadpixel berühren sich nie (auch nicht über die Ecke) — eine schlanke Linie, kein Klecks."""
    h, w = maske.shape
    res = set()
    for y in range(h):
        for x in range(w):
            if not maske[y, x]:
                continue
            stack = [([(x, y)], None)]
            while stack:
                pf, d = stack.pop()
                if len(pf) == laenge:
                    res.add(tuple(pf) if pf[0] <= pf[-1] else tuple(reversed(pf)))
                    continue
                for k, (dx, dy) in enumerate(_RICHT):
                    if d is not None and min((k - d) % 8, (d - k) % 8) > 1:
                        continue
                    q = (pf[-1][0] + dx, pf[-1][1] + dy)
                    if not (0 <= q[0] < w and 0 <= q[1] < h and maske[q[1], q[0]]) or q in pf:
                        continue
                    if any(max(abs(q[0] - o[0]), abs(q[1] - o[1])) <= 1 for o in pf[:-1]):
                        continue
                    stack.append((pf + [q], k))
    return sorted(res)


def waehle_pfade(kand, n, gebiet=None, abstand=5, seed=1, zackig=True):
    """n Pfade aus `kand`, die sich gegenseitig (Mindestabstand `abstand`, Chebyshev, zwischen allen Pixeln) nicht nahekommen; gebiet = optionale Bool-Maske (Pfad liegt
    ganz darin). zackig: bevorzugt Pfade, die ihre Richtung ändern (kein reiner Strich)."""
    import random
    rnd = random.Random(seed)
    k = [pf for pf in kand if gebiet is None or all(gebiet[y, x] for (x, y) in pf)]

    def knick(pf):
        return len({(pf[i + 1][0] - pf[i][0], pf[i + 1][1] - pf[i][1]) for i in range(len(pf) - 1)})
    rnd.shuffle(k)
    if zackig:
        k.sort(key=lambda pf: -knick(pf))
    gew = []
    for pf in k:
        if len(gew) >= n:
            break
        if all(min(max(abs(a[0] - b[0]), abs(a[1] - b[1])) for a in pf for b in g) > abstand for g in gew):
            gew.append(pf)
    return gew


def profil(laenge, halten=2, tempo=2):
    """Verlauf eines Risses aus `laenge` Pixeln: wächst um ein Pixel je `tempo` Frames, steht `halten` Frames voll, schrumpft wieder (z. B. laenge 3, halten 2 → 1-1-2-2-3-3-3-3-2-2-1-1)."""
    wachs = [k for k in range(1, laenge + 1) for _ in range(tempo)]
    schrumpf = [k for k in range(laenge - 1, 0, -1) for _ in range(tempo)]
    return tuple(wachs + [laenge] * halten + schrumpf)


def starts(m, n, leben, basis=1, versatz=0.0):
    """m Startframes, gleichmäßig-unregelmäßig (Goldener Schnitt) über [basis, n - leben] verteilt, damit jeder Riss VOR dem Schleifenende fertig ist (Frame 0 bleibt rissfrei).
    leben: Zahl oder Liste der Lebensdauern (Frames) je Riss; versatz verschiebt die Folge (je Ei verschieden)."""
    lb = leben if isinstance(leben, (list, tuple)) else [leben] * m
    return [basis + int(((k + versatz) * 0.6180339887) % 1.0 * (n - lb[k] - basis)) for k in range(m)]


def zaehle(risse, n, gruppen=None):
    """Kontrollzahlen: Höchstzahl gleichzeitiger Risse, Durchschnitt, Frames ganz ohne Riss; gruppen = Liste von Indexlisten (je Ei) → dazu je Gruppe (Höchstzahl, Durchschnitt, Frames mit ≥ 2)."""
    z = [sum(1 for r in risse if r.stufe(i, n)) for i in range(n)]
    out = dict(max=max(z), mittel=round(sum(z) / n, 2), leer=[i for i, v in enumerate(z) if v == 0])
    if gruppen:
        out['gruppen'] = []
        for g in gruppen:
            zg = [sum(1 for j in g if risse[j].stufe(i, n)) for i in range(n)]
            out['gruppen'].append((max(zg), round(sum(zg) / n, 2), sum(1 for v in zg if v >= 2)))
    return out


def pruefe_risse(risse, n, erlaubt=None, abstand=1):
    """Pflichtprüfung der Risse: jedes Rissspixel liegt in der Bool-Maske `erlaubt` (z. B. E.sicher), Frame 0 ist rissfrei, jeder Riss ist vor Schleifenende fertig, und zwei
    Risse berühren sich nie (Chebyshev-Abstand > `abstand`), außer sie sitzen an derselben Stelle — dann dürfen sie nie gleichzeitig laufen."""
    pix = [(i, p) for i, r in enumerate(risse) for p in r.pix]
    if erlaubt is not None:
        for i, (x, y) in pix:
            assert erlaubt[y, x], ('Rissspixel nicht erlaubt', i, x, y)
    assert all(r.stufe(0, n) == 0 for r in risse), 'Frame 0 muss rissfrei sein'
    assert all(r.start + len(r.profil) <= n for r in risse), 'ein Riss reicht über das Schleifenende'
    for a in range(len(pix)):
        for b in range(a + 1, len(pix)):
            (i, p), (j, q) = pix[a], pix[b]
            if i == j:
                continue
            if max(abs(p[0] - q[0]), abs(p[1] - q[1])) <= abstand:
                assert not any(risse[i].stufe(f, n) and risse[j].stufe(f, n) for f in range(n)), ('Risse berühren sich gleichzeitig', p, q)
