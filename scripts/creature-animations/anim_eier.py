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


# ── Runde 4: größere, verzweigte, stellenweise 2 px dicke Risse, die AUSBLEICHEN statt zu schrumpfen ───────────────────
# Nutzer: „Bei den ganzen Eiern sollten die Risse verschwinden, indem sie ausbleichen, statt indem sie sich einfach zurückbilden. Und die Risse sollten größer,
# auch dicker, werden können.“ → Ein BleichRiss wächst Pixel für Pixel (Hauptast, davon abzweigende Seitenäste, danach an einzelnen Stellen ein zweites Pixel
# daneben = 2 px dick), steht in voller Form und bleicht dann in Stufen aus: ALLE Pixel bleiben stehen, ihre Farbe wandert über Zwischentöne (Farben des Sprites
# bzw. der Spielpalette zwischen Rissfarbe und der Farbe des Untergrunds an genau dieser Stelle) zum Untergrund; letzte Stufe = Schachbrett-Dither. Kein Alpha.
class BleichRiss:
    """haupt: Pixel des Hauptasts in Wachstumsrichtung; zweige: Liste von Seitenästen (jeder beginnt neben einem Hauptast-Pixel); dick: Pixel direkt (über die Kante) neben
    Hauptast-Pixeln, die den Riss dort 2 px dick machen. tempo = Frames je neuem Pixel, halten = Frames in voller Form, stufen × stufe_frames = Ausbleichen,
    dither = zusätzliche letzte Stufe als Schachbrett. spitze = Farbe der Astenden (z. B. Gelb als auslaufende Glut)."""

    def __init__(self, haupt, start, zweige=(), dick=(), halten=4, tempo=1, stufen=4, stufe_frames=2, dither=True, farbe=None, spitze=None):
        self.haupt = [tuple(p) for p in haupt]
        self.zweige = [[tuple(p) for p in z] for z in zweige]
        self.dick = [tuple(p) for p in dick]
        self.start, self.halten, self.tempo, self.stufen, self.stufe_frames, self.dither = start, halten, tempo, stufen, stufe_frames, dither
        self.farbe, self.spitze = farbe, spitze
        zeit = {p: j * tempo for j, p in enumerate(self.haupt)}
        for z in self.zweige:
            nah = [j for j, p in enumerate(self.haupt) if max(abs(p[0] - z[0][0]), abs(p[1] - z[0][1])) <= 1]
            assert nah, ('Seitenast hängt nicht am Hauptast', z)
            for m, p in enumerate(z):
                assert p not in zeit, ('Pixel doppelt', p)
                zeit[p] = (min(nah) + 1 + m) * tempo
        for p in self.dick:
            nah = [j for j, q in enumerate(self.haupt) if abs(q[0] - p[0]) + abs(q[1] - p[1]) == 1]
            assert nah and p not in zeit, ('Dick-Pixel liegt nicht neben dem Hauptast', p)
            zeit[p] = (max(nah) + 2) * tempo                                         # der Riss klafft erst auf, wenn die Spitze schon weiter ist
        self.zeit = zeit
        self.pix = sorted(zeit, key=lambda p: zeit[p])
        self.enden = {self.haupt[-1]} | {z[-1] for z in self.zweige}
        self.wachsen = max(zeit.values()) + tempo
        self.bleichen = stufen * stufe_frames + (stufe_frames if dither else 0)
        self.leben = self.wachsen + halten + self.bleichen
        self.profil = (1,) * self.leben                                              # für zaehle()/pruefe_risse()

    def stufe(self, i, n):
        return 1 if (i - self.start) % n < self.leben else 0

    def phase(self, i, n):
        """None = nicht sichtbar; ('w', t) = wächst (Pixel mit zeit <= t sichtbar); ('v', 0) = volle Form; ('b', k) = Bleichstufe k (0 … stufen-1); ('d', 0) = Dither-Stufe."""
        t = (i - self.start) % n
        if t >= self.leben:
            return None
        if t < self.wachsen:
            return ('w', t)
        t -= self.wachsen
        if t < self.halten:
            return ('v', 0)
        k = (t - self.halten) // self.stufe_frames
        return ('b', k) if k < self.stufen else ('d', 0)


def toene_rampe(rampe):
    """Zwischentöne aus einer geordneten Farbrampe (dunkel → hell): alle Rampenfarben echt zwischen Rissfarbe und Untergrund (Untergrund außerhalb der Rampe → nächste Rampenfarbe)."""
    rampe = [tuple(c) for c in rampe]
    cache = {}

    def idx(c):
        return rampe.index(c) if c in rampe else min(range(len(rampe)), key=lambda k: sum((rampe[k][j] - c[j]) ** 2 for j in range(3)))

    def f(c, u):
        if (c, u) not in cache:
            a, b = idx(c), idx(u)
            cache[(c, u)] = rampe[a + 1:b] if b > a else rampe[b + 1:a][::-1]
            cache[(c, u)] = [t for t in cache[(c, u)] if t != u and t != c]
        return cache[(c, u)]
    return f


def toene_auto(kandidaten, quer=45.0):
    """Zwischentöne ohne feste Rampe: alle Kandidatenfarben, die (im RGB-Raum) nahe der Strecke Rissfarbe → Untergrund liegen (Abstand zur Strecke <= quer) und echt dazwischen
    (Anteil 0.12 … 0.88), nach ihrem Anteil geordnet. Für Sprites mit vielen Farbtönen (Icy Dragonegg) und für Palettengrau (Monster Nest)."""
    kandidaten = [tuple(c) for c in kandidaten]
    cache = {}

    def f(c, u):
        if (c, u) not in cache:
            v = np.array(u, float) - np.array(c, float)
            ll = float(v @ v)
            res = []
            for k in kandidaten:
                if ll == 0 or k == c or k == u:
                    continue
                w = np.array(k, float) - np.array(c, float)
                t = float(w @ v) / ll
                d = float(np.linalg.norm(w - t * v))
                if 0.12 <= t <= 0.88 and d <= quer:
                    res.append((t, k))
            cache[(c, u)] = [k for t, k in sorted(res)]
        return cache[(c, u)]
    return f


def bleich_farbe(r, p, ph, c, u, toene):
    """Farbe des Risspixels p in Phase ph (c = Rissfarbe, u = Untergrund); None = Untergrund zeigt sich (Dither-Lücke)."""
    if ph[0] in 'wv':
        return c
    tl = toene(c, u)
    if ph[0] == 'd':
        if (p[0] + p[1]) % 2:
            return None
        return tl[-1] if tl else c
    return tl[ph[1] * len(tl) // r.stufen] if tl else c


def bleich_risse(fig, i, n, risse, farbe, toene, dx=0, dy=0, gueltig=None):
    """Figur (Frame, RGBA) mit allen BleichRissen von Frame i; (dx, dy) = Lage des Sprites im Frame. Die Untergrundfarbe wird je Pixel aus `fig` gelesen (also einschließlich
    eines gerade durchlaufenden Lichtbands), Risse ersetzen nur vorhandene Pixel (nie neue Fläche, kein Alpha)."""
    out = fig.copy()
    for r in risse:
        ph = r.phase(i, n)
        if ph is None:
            continue
        for p in r.pix:
            if ph[0] == 'w' and r.zeit[p] > ph[1]:
                continue
            x, y = p
            if gueltig is not None:
                assert gueltig[y, x], f'Riss-Pixel ({x},{y}) liegt nicht auf dem Ei'
            assert fig[y + dy, x + dx, 3] == 255, 'Riss ragt über den Rand des Eis hinaus'
            c = r.spitze if (r.spitze and p in r.enden) else (r.farbe or farbe)
            col = bleich_farbe(r, p, ph, tuple(c), tuple(int(v) for v in fig[y + dy, x + dx, :3]), toene)
            if col is not None:
                out[y + dy, x + dx, :3] = col
    return out


def wachse_riss(maske, rnd, laenge, zweige=(), dick=0, versuche=400):
    """Hilfe zum EINMALIGEN Entwerfen einer Rissform (die Koordinaten werden danach im Skript festgeschrieben): zufälliger zackiger Hauptast aus `laenge` Pixeln auf der Maske
    (Richtungswechsel höchstens 45° je Schritt, berührt sich nie selbst), Seitenäste mit den Längen `zweige` (zweigen quer ab, berühren den Hauptast nur an ihrer Wurzel) und
    `dick` Pixel, die ein zusammenhängendes Stück des Hauptasts auf 2 px verdicken. Gibt dict(h=…, z=…, d=…) oder None zurück."""
    h, w = maske.shape

    def ok(q):
        return 0 <= q[0] < w and 0 <= q[1] < h and maske[q[1], q[0]]

    def cheb(a, b):
        return max(abs(a[0] - b[0]), abs(a[1] - b[1]))
    ys, xs = np.nonzero(maske)
    for _ in range(versuche):
        k0 = rnd.randrange(len(xs))
        pf = [(int(xs[k0]), int(ys[k0]))]
        g = rnd.randrange(8)                                                         # Grundrichtung; die Schritte zacken um sie herum (g-1, g, g+1), sie selbst dreht nur selten
        dirs = []
        while len(pf) < laenge:
            if dirs and rnd.random() < 0.18:
                g = (g + rnd.choice([1, -1])) % 8
            opt = [(g + 1) % 8, (g - 1) % 8, g]
            rnd.shuffle(opt)
            if len(dirs) >= 2 and dirs[-1] == dirs[-2]:                              # nie drei gleiche Schritte hintereinander (kein gerader Strich)
                opt = [k for k in opt if k != dirs[-1]] + [dirs[-1]]
            for k in opt:
                q = (pf[-1][0] + _RICHT[k][0], pf[-1][1] + _RICHT[k][1])
                if ok(q) and q not in pf and all(cheb(q, o) > 1 for o in pf[:-1]):
                    pf.append(q); dirs.append(k)
                    break
            else:
                break
        if len(pf) < laenge:
            continue
        zw, gut = [], True
        for zl in zweige:
            for _v in range(40):
                a = rnd.randrange(1, max(2, laenge - 2))
                kd = (dirs[min(a, len(dirs) - 1)] + rnd.choice([2, -2, 3, -3])) % 8
                z, cur, dd = [], pf[a], kd
                for m in range(zl):
                    opt = [(kd + 1) % 8, (kd - 1) % 8, kd] if m else [dd]
                    rnd.shuffle(opt)
                    if m >= 2:
                        opt = [k for k in opt if k != dd] + [dd]
                    for k in opt:
                        q = (cur[0] + _RICHT[k][0], cur[1] + _RICHT[k][1])
                        if not ok(q) or q in pf or q in z or any(q in o for o in zw):
                            continue
                        if m == 0:
                            if any(cheb(q, o) <= 1 for j, o in enumerate(pf) if abs(j - a) > 1) or any(abs(q[0] - pf[j][0]) + abs(q[1] - pf[j][1]) == 1 for j in (a - 1, a + 1) if 0 <= j < laenge):
                                continue
                        elif any(cheb(q, o) <= 1 for o in pf) or any(cheb(q, o) <= 1 for o in z[:-1]):
                            continue
                        if any(cheb(q, o) <= 1 for oz in zw for o in oz):
                            continue
                        z.append(q); cur = q; dd = k
                        break
                    else:
                        break
                if len(z) == zl:
                    zw.append(z)
                    break
            else:
                gut = False
                break
        if not gut:
            continue
        dk = []
        if dick:
            for _v in range(40):
                s = rnd.randrange(0, max(1, laenge - dick - 1))
                seite = rnd.choice([0, 1])
                dk = []
                for j in range(s, s + dick):
                    p, q = pf[j], pf[j + 1]
                    sx, sy = q[0] - p[0], q[1] - p[1]
                    if sx and sy:
                        c = (p[0] + sx, p[1]) if seite else (p[0], p[1] + sy)
                    elif sx:
                        c = (p[0], p[1] + (1 if seite else -1))
                    else:
                        c = (p[0] + (1 if seite else -1), p[1])
                    if not ok(c) or c in pf or any(c in o for o in zw) or any(cheb(c, o) <= 1 for oz in zw for o in oz):
                        dk = None
                        break
                    if any(cheb(c, o) <= 1 for i2, o in enumerate(pf) if i2 < j - 1 or i2 > j + 2):
                        dk = None
                        break
                    if c not in dk:
                        dk.append(c)
                if dk:
                    break
            if not dk:
                continue
        return dict(h=pf, z=zw, d=dk)
    return None


def riss_pixel(form):
    return list(form['h']) + [p for z in form['z'] for p in z] + list(form['d'])


def waehle_formen(kand, n, wert, abstand=2):
    """n Rissformen aus `kand` (Liste von dict), absteigend nach wert(form), die sich gegenseitig nicht näher als `abstand` + 1 Pixel (Chebyshev) kommen."""
    gew = []
    for f in sorted(kand, key=lambda f: -wert(f)):
        if len(gew) >= n:
            break
        pf = riss_pixel(f)
        if all(min(max(abs(a[0] - b[0]), abs(a[1] - b[1])) for a in pf for b in riss_pixel(g)) > abstand for g in gew):
            gew.append(f)
    return gew


def beruehren(a, b, abstand=1):
    """Liegen zwei Risse (Pixel-Listen) irgendwo näher als `abstand` + 1 Pixel (Chebyshev) beieinander?"""
    return any(max(abs(p[0] - q[0]), abs(p[1] - q[1])) <= abstand for p in a for q in b)


def plane_starts(leben, n, konflikt=None, basis=1, seed=1, sperre=None, streu=1.0):
    """Startframes für Risse mit den Lebensdauern `leben` (Frames): jeder Riss ist vor dem Schleifenende fertig (Frame 0 bleibt rissfrei), Risse mit konflikt(i, j) == True
    (gleiche Stelle/berühren sich) laufen nie gleichzeitig, und die Starts werden so gelegt, dass möglichst gleichmäßig viele Risse zugleich sichtbar sind
    und weder Starts noch Enden sich häufen (streu = Gewicht dafür).
    sperre(i, s) → True verbietet Start s für Riss i (z. B. weil dort gerade ein Sparkle säße)."""
    import random
    rnd = random.Random(seed)
    last = [0] * n
    st = [None] * len(leben)
    for i in sorted(range(len(leben)), key=lambda i: -leben[i]):
        best = None
        for s in range(basis, n - leben[i] + 1):
            if sperre and sperre(i, s):
                continue
            if konflikt and any(st[j] is not None and konflikt(i, j) and s < st[j] + leben[j] and st[j] < s + leben[i] for j in range(len(leben))):
                continue
            if konflikt and any(st[j] is None and j != i and konflikt(i, j) and s - basis < leben[j] and n - s - leben[i] < leben[j] for j in range(len(leben))):
                continue                                                             # Platz für den noch nicht gesetzten Riss an derselben Stelle lassen
            wert = (sum(last[s:s + leben[i]]) / leben[i] + rnd.random() * 0.3
                    + sum(streu * max(0.0, 1 - abs(st[j] - s) / 5.0) + streu * max(0.0, 1 - abs(st[j] + leben[j] - s - leben[i]) / 5.0) for j in range(len(leben)) if st[j] is not None))
            if best is None or wert < best[0]:
                best = (wert, s)
        assert best is not None, ('kein freier Startframe für Riss', i)
        st[i] = best[1]
        for f in range(best[1], best[1] + leben[i]):
            last[f] += 1
    return st
