# -*- coding: utf-8 -*-
"""Gemeinsame Bausteine der Gruppe „Schachfiguren of Kings“ (Knight/Pawn/Queen/Rook, schwarze und weiße Variante).

Baut auf anim_lib / anim_humanoide auf (nur ganze Pixel, kein Alpha, nur Farben des Sprites). Die Varianten [B]/[W] teilen sich nur diese
Funktionen; jede Variante wird auf ihren EIGENEN Sprite angewendet (Farbrampen, Lidfarben, Umrissfarben kommen aus dem jeweiligen Sprite)
und bekommt eigene Zeitfenster (Phasenversatz), damit schwarze und weiße Figur nicht im Gleichschritt laufen.

    FORMEN                      Glitzer-Formen (Offsets um den Mittelpunkt): 'plus' (hohles Kreuz, Original-Stern des Ritters), 'plus1' (Kreuz mit Mitte),
                                'punkt', 'ring' (hohle Raute), 'v' (Raute ohne Spitze, Original des oberen Ritter-Glitzers), 'stern4' (Mitte + 4 Arme)
    zeichne_form(a, x, y, form, farbe, off)     Form in die Leinwand setzen (Spritekoordinaten + off), außerhalb der Leinwand → ClipError
    glitzer_folge(i, n, start, folge)           Ereignisfenster: liefert die Form im Frame i oder 'ORIG' (außerhalb des Fensters bleibt das Original)
    lid(a, off, pixel, farbe)                   Augen/Pixel mit Lidfarbe überdecken (Blinzeln)
    rampe_aus(spr, kandidaten)                  Farbrampe (dunkel → hell) aus den Farben, die im Sprite wirklich vorkommen
    rund / kippen / spalten_dy                  symmetrisches Runden; starres Kippen eines Schwerts/Stabs um ein Gelenk (Spaltenversatz, Gefälle ≤ 1 px)
    zuschneiden(frames, rand) / lauf(...)       Zuschnitt aller Frames auf die Figur (Randabstand 2) und Standard-Abschluss eines Skripts (Ruhepose, Prüfung, Speichern, Streifen)
    Ritter / Bauer / Dame / Turm                Animationsbauer für Knight / Pawn / Queen / Rook of Kings (je [W] und [B], mit eigenen Zeitfenstern)
"""
import math

import numpy as np

import anim_humanoide as Hm
import anim_lib as L

FORMEN = {
    'plus': [(-2, 0), (-1, 0), (1, 0), (2, 0), (0, -2), (0, -1), (0, 1), (0, 2)],         # hohles Kreuz wie im Original (Mitte frei)
    'plus1': [(0, 0), (-1, 0), (1, 0), (0, -1), (0, 1)],
    'stern4': [(0, 0), (-1, 0), (1, 0), (0, -1), (0, 1)],
    'punkt': [(0, 0)],
    'ring': [(0, -1), (-1, 0), (1, 0), (0, 1)],
    'v': [(-1, 0), (1, 0), (0, 1)],
}


def zeichne_form(a, x, y, form, farbe, off=(0, 0)):
    if form is None or form == 'ORIG':
        return a
    return Hm.setze(a, {(x + dx, y + dy): farbe for dx, dy in FORMEN[form]}, off)


def glitzer_folge(i, n, start, folge):
    """folge = Liste von Formen (oder None = nichts) für die Frames start, start+1, … (modulo n). Außerhalb des Fensters 'ORIG'."""
    k = (i - start) % n
    if 0 <= k < len(folge):
        return folge[k]
    return 'ORIG'


def lid(a, off, pixel, farbe):
    """Pixel (Spritekoordinaten) mit Lidfarbe belegen (farbe: ein RGB-Tupel oder {pixel: farbe})."""
    for p in pixel:
        c = farbe[p] if isinstance(farbe, dict) else farbe
        Hm.setze(a, {p: c}, off)
    return a


def rampe_aus(spr, kandidaten):
    """Die Farben aus `kandidaten` (dunkel → hell), die im Sprite vorkommen; mindestens zwei, sonst leere Rampe."""
    da = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
    r = [tuple(c) for c in kandidaten if tuple(c) in da]
    return r if len(r) >= 2 else []


def umriss_schliessen(fig, erlaubt, farbe):
    """Regel 16: Randpixel in Nicht-Umrissfarbe werden Umrissfarbe."""
    return Hm.kontur_schliessen(fig, erlaubt, farbe)


def kontakt_bericht(frames):
    e0 = Hm.eckkontakt_typen(frames[0])
    neu = {i: dict(Hm.eckkontakt_typen(g) - e0) for i, g in enumerate(frames) if Hm.eckkontakt_typen(g) - e0}
    print('neue Eckkontakte gegenüber Frame 0:', neu if neu else 'keine')
    return neu


def rund(v):
    """Symmetrisches Runden (…, -1,5 → -2, 0,5 → 1), ganze Pixel."""
    return int(math.copysign(math.floor(abs(v) + 0.5), v))


def kippen(a, off, pivot_x, dy_spitze, x_spitze):
    """Schwert/Stab wippt um ein Gelenk: die Spalte x (Spritekoordinate) wandert um rund(dy_spitze · (pivot_x − x)/(pivot_x − x_spitze)) senkrecht
    (links vom Gelenk; wer rechts liegt, bleibt). Starres Kippen mit Gefälle ≤ 1 px je Spalte — nichts wird verbreitert."""
    out = L.leer(*a.shape[:2])
    h, w = a.shape[:2]
    for X in range(w):
        ys = np.nonzero(a[:, X, 3])[0]
        if not len(ys):
            continue
        x = X - off[0]
        f = max(0.0, (pivot_x - x) / float(pivot_x - x_spitze))
        dy = rund(dy_spitze * f)
        if ys.min() + dy < 0 or ys.max() + dy >= h:
            raise L.ClipError(f'Spalte {x} würde um {dy} px aus der Leinwand geschoben')
        out[ys + dy, X] = a[ys, X]
    return out


def spalten_dy(x, pivot_x, dy_spitze, x_spitze):
    f = max(0.0, (pivot_x - x) / float(pivot_x - x_spitze))
    return rund(dy_spitze * f)


# ══ Ritter (Knight of Kings): Geisterritter mit vorgestrecktem Schwert ═══════════════════════════════════════════════════════════
class Ritter:
    """Baut die Animation für den Ritter-Sprite (28×21 px, [W] oder [B]). Parameter je Variante:
    n, ms          Frames, Dauer;
    brust_per      Periode des Atmens (Brust hebt sich bis 2 px, Beine bleiben);
    kipp_zyklen    Schwertwippen: Zyklen je Schleife (Spitze ±2 px, Gelenk = Hand bei x 19);
    blink, band, g_plus, g_ring1, g_ring2, tap_l, tap_r   Startframes der Ereignisse;
    rampe          Farbrampe der Klinge (dunkel → hell)."""
    PAD = (3, 3, 4, 2)          # links, rechts, oben, unten

    def __init__(self, spr, n=48, ms=62, brust_per=24, kipp_zyklen=1, kipp_vz=1, blink=(14, 38), band=8, g_plus=(8,), g_ring1=(26,),
                 g_ring2=(40,), tap_l=18, tap_r=36, rampe=()):
        self.spr, self.N, self.MS = spr, n, ms
        sh, sw = spr.shape[:2]
        self.sh, self.sw = sh, sw
        self.H, self.W = sh + self.PAD[2] + self.PAD[3], sw + self.PAD[0] + self.PAD[1]
        self.OFF = (self.PAD[0], self.PAD[2])
        self.p = dict(brust_per=brust_per, kipp_zyklen=kipp_zyklen, kipp_vz=kipp_vz, blink=blink, band=band, g_plus=g_plus, g_ring1=g_ring1,
                      g_ring2=g_ring2, tap_l=tap_l, tap_r=tap_r)
        self.rampe = list(rampe)
        yy, xx = np.mgrid[0:sh, 0:sw]
        vor = L.deckend(spr)
        weiss = vor & (spr[..., 0] == 255) & (spr[..., 1] == 255) & (spr[..., 2] == 255)
        self.m_plus = weiss & (xx <= 4)                                                  # Glitzerkreuz an der Schwertspitze
        d1 = np.zeros((sh, sw), bool)
        d2 = np.zeros((sh, sw), bool)
        for (x, y) in [(10, 10), (12, 10), (11, 11)]:
            d1[y, x] = True
        for (x, y) in [(11, 16), (10, 17), (12, 17), (11, 18)]:
            d2[y, x] = True
        self.m_d1, self.m_d2 = d1 & vor, d2 & vor
        glitzer = self.m_plus | self.m_d1 | self.m_d2
        self.m_schwert = vor & ~glitzer & (yy >= 12) & (yy <= 14) & (xx <= 18)
        self.m_klinge = self.m_schwert & (yy == 13) & (xx >= 7)                          # innere Klingenzeile (Lichtband)
        self.m_fuss_l = vor & ~glitzer & (xx <= 21) & (yy >= 18)
        self.m_fuss_r = vor & ~glitzer & (xx >= 23) & (yy >= 18)
        self.glitzer_farbe = tuple(int(v) for v in spr[11, 0, :3])
        # Augen (zwei schwarze Schlitze, je 1×2 px) – Lid = Hautfarbe links daneben
        self.augen = [(20, 5), (20, 6), (22, 5), (22, 6)]
        self.lidfarbe = {p: tuple(int(v) for v in spr[p[1], 21, :3]) for p in self.augen}
        self.umriss = Hm.umrissfarben(spr)
        self.schwarz = (0, 0, 0)

    def _ebene(self, m, dy=0):
        t, _ = L.trenne(self.spr, m)
        return L.platz(t, self.H, self.W, self.OFF[0], self.OFF[1] + dy)

    def frame(self, i):
        N, p, OFF = self.N, self.p, self.OFF
        spr = self.spr
        rest = ~(self.m_plus | self.m_d1 | self.m_d2 | self.m_schwert | self.m_fuss_l | self.m_fuss_r) & L.deckend(spr)
        koerper = self._ebene(rest)
        # --- Blinzeln: Lid in Hautfarbe (2 Frames) ---
        for s in p['blink']:
            if Hm.folge(i, s, [1, 1], N):
                lid(koerper, OFF, self.augen, self.lidfarbe)
        # --- Atmen: Hüftzeile 16 wird eingefügt (Texturmischung): Oberkörper + Kopf steigen bis 2 px, Beine/Stiefel bleiben ---
        brust = Hm.stufe(i, p['brust_per'], 2)
        koerper = Hm.atmen(koerper, OFF[1] + 16, OFF[1] + 8, brust, 0)
        # --- Schwert: Lichtband über die Klinge, dann wippt es um die Hand (x 19) und steigt mit dem Oberkörper ---
        sw = self._ebene(self.m_schwert)
        if self.rampe:
            Hm.lichtband(sw, self.m_klinge, OFF, i, N, p['band'], 14, self.rampe, stufen=2, breite=3.2, achse=(1.0, 0.0), kern=3)
        dy_spitze = rund(2.0 * math.sin(L.sinus(i, N / p['kipp_zyklen']) + 0.0)) * p['kipp_vz']
        sw = kippen(sw, OFF, 19, dy_spitze, 3)
        dy_hand = -brust
        sw = L.versetze(sw, 0, dy_hand)
        # --- Füße: je ein Fußtippen (1 px hinter den Saum) ---
        pat = [1, 1, 0, 0, 1, 1]
        ul = 1 if Hm.folge(i, p['tap_l'], pat, N) else 0
        ur = 1 if Hm.folge(i, p['tap_r'], pat, N) else 0
        fl, fr = self._ebene(self.m_fuss_l, -ul), self._ebene(self.m_fuss_r, -ur)
        # --- Sparkle-Partikel (Runde 3): KEINE Dauer-Sterne mehr (die Quelle trägt drei fest eingezeichnete Glitzerformen, die fast die ganze Schleife sichtbar waren) ---
        # Kurze normale Sparkles am Schwert (Metall): Mitte → kleines Kreuz (→ großes Kreuz) → Mitte → weg; je Stelle höchstens einmal je Schleife, lange Pausen dazwischen.
        # Sie folgen dem Schwert (Kippen) und dem Oberkörper und werden erst NACH dem Konturschluss gezeichnet.
        dyx = spalten_dy(11, 19, dy_spitze, 3) + dy_hand
        fig = L.zusammen(self.H, self.W, [(fl, 0, 0), (fr, 0, 0), (koerper, 0, 0), (sw, 0, 0)])
        fig = Hm.kontur_schliessen(fig, self.umriss, self.schwarz)
        for (sx, sy, starts, folge) in ((2, 11 + dy_spitze + dy_hand, p['g_plus'], [0, 1, 2, 1, 0]), (11, 10 + dyx, p['g_ring1'], [0, 1, 0]), (11, 17 + dyx, p['g_ring2'], [0, 1, 1, 0])):
            for st in (starts if isinstance(starts, (tuple, list)) else (starts,)):
                stufe = Hm.folge(i, st, folge, N)
                if stufe is not None:
                    Hm.stern4(fig, sx, sy, stufe, self.glitzer_farbe, self.glitzer_farbe, self.glitzer_farbe, OFF)
        return fig


def zuschneiden(frames, rand=2):
    """Alle Frames gemeinsam auf die Vereinigung aller deckenden Pixel zuschneiden (plus `rand` px rundherum)."""
    a = np.stack([f[..., 3] > 0 for f in frames])
    ys = np.nonzero(a.any(axis=(0, 2)))[0]
    xs = np.nonzero(a.any(axis=(0, 1)))[0]
    y0, y1, x0, x1 = int(ys.min()) - rand, int(ys.max()) + rand + 1, int(xs.min()) - rand, int(xs.max()) + rand + 1
    out = []
    for f in frames:
        h, w = f.shape[:2]
        g = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
        sy0, sy1, sx0, sx1 = max(y0, 0), min(y1, h), max(x0, 0), min(x1, w)
        g[sy0 - y0:sy1 - y0, sx0 - x0:sx1 - x0] = f[sy0:sy1, sx0:sx1]
        out.append(g)
    return out


def lauf(modul_name, karte, frames, ms, prev, spr, off, extra=None, erlaubt=()):
    """Standard-Abschluss eines Skripts: Ruhepose, Prüfung, Speichern, Streifen."""
    diff = Hm.ruhepose(frames[0], spr, off)
    print('Ruhepose weicht vom Original ab bei:', diff if diff else 'nichts')
    n = L.pruefe(frames, quelle=spr, erlaubt=erlaubt)
    print('Pixel je Frame:', n)
    kontakt_bericht(frames)
    frames = zuschneiden(frames, 2)                                    # Regel 27: auf die Figur zugeschnitten (Randabstand 2 über alle Frames)
    print('zugeschnitten auf', frames[0].shape[1], '×', frames[0].shape[0])
    L.speichern(modul_name.replace('_', '-'), karte, frames, ms, prev, extra=extra)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/' + modul_name.replace('_', '-') + '-strip.png', frames, spalten=12, scale=6)


# ══ Bauer (Pawn of Kings): Bauer mit Heugabel ═════════════════════════════════════════════════════════════════════════════════════
class Bauer:
    """Pawn-Sprite 14×13 px ([W] oder [B]). Der Kopf (Haarschopf) hebt sich mit dem Atem (Zeile 8 wird eingefügt, die Heugabel rutscht in der Hand mit,
    der Stiel unten bleibt stehen); die Gabelspitze (Zeilen 0–3) kippt zwischendurch 1 px nach links/rechts (die Zinken sitzen auf dem Querbalken, der Schaft
    x 11 bleibt 4-verbunden). Parameter: atem_per (Periode), kipp = Liste (start, dx, länge) der Kippfenster, atem2 = Zeitpunkt eines zweiten tiefen Atemzugs."""
    PAD = (3, 3, 4, 2)

    def __init__(self, spr, n=48, ms=70, atem_per=24, kipp=((6, 1, 9), (30, -1, 9)), atem_vz=0.0):
        self.spr, self.N, self.MS = spr, n, ms
        sh, sw = spr.shape[:2]
        self.H, self.W = sh + self.PAD[2] + self.PAD[3], sw + self.PAD[0] + self.PAD[1]
        self.OFF = (self.PAD[0], self.PAD[2])
        self.atem_per, self.kipp, self.atem_vz = atem_per, kipp, atem_vz
        yy, xx = np.mgrid[0:sh, 0:sw]
        vor = L.deckend(spr)
        self.m_gabel = vor & (yy <= 3) & (xx >= 9)                                       # Zinken + Querbalken
        self.umriss = Hm.umrissfarben(spr)
        self.schwarz = tuple(int(v) for v in spr[12, 5, :3])

    def frame(self, i):
        N, OFF = self.N, self.OFF
        spr = self.spr
        vor = L.deckend(spr)
        koerper = L.platz(L.trenne(spr, vor & ~self.m_gabel)[0], self.H, self.W, OFF[0], OFF[1])
        gabel = L.platz(L.trenne(spr, self.m_gabel)[0], self.H, self.W, OFF[0], OFF[1])
        brust = Hm.stufe(i, self.atem_per, 1, self.atem_vz)
        koerper = Hm.atmen(koerper, OFF[1] + 8, OFF[1] + 5, brust, 0)
        dx = 0
        for (s, d, ln) in self.kipp:
            w = Hm.folge(i, s, [1] * ln, N)
            if w:
                dx = d
        # die Gabel steigt mit der Hand (−brust) und kippt um dx (Zeilen 0–3 gemeinsam, Querbalken bleibt über dem Schaft x 11)
        gabel = L.versetze(gabel, dx, -brust)
        fig = L.zusammen(self.H, self.W, [(koerper, 0, 0), (gabel, 0, 0)])
        return Hm.kontur_schliessen(fig, self.umriss, self.schwarz)


# ══ Dame (Queen of Kings): Schachdame mit goldener Krone ═══════════════════════════════════════════════════════════════════════════
class Dame:
    """Queen-Sprite 16×32 px ([W] weiß mit grünem Edelstein/Augen, [B] schwarz mit rotem Edelstein/Augen). Bewegungen: Kopf + Krone heben sich 1 px (die einheitliche Halszeile 14 wird
    eingefügt, Sockel bleibt), Lichtband über das Gold der Krone, Glitzersterne an den Kronenspitzen, Edelstein tauscht seine Facetten (J/K), Blinzeln. Parameter je Variante:
    hub_per (Periode des Hebens), band (Startframe Lichtband), sterne = [(start, (x, y)), …], gem = [Startframes], blink = [Startframes]."""
    PAD = (3, 3, 5, 2)
    GOLD = [(230, 131, 16), (255, 222, 90), (255, 246, 172)]

    def __init__(self, spr, n=48, ms=70, hub_per=32, hub_vz=0.0, band=4, sterne=((6, (1, 1)), (20, (14, 1)), (34, (8, 0))), gem=(10, 28, 44), blink=(16, 40)):
        self.spr, self.N, self.MS = spr, n, ms
        sh, sw = spr.shape[:2]
        self.H, self.W = sh + self.PAD[2] + self.PAD[3], sw + self.PAD[0] + self.PAD[1]
        self.OFF = (self.PAD[0], self.PAD[2])
        self.hub_per, self.hub_vz, self.band, self.sterne, self.gem, self.blink = hub_per, hub_vz, band, sterne, gem, blink
        yy, xx = np.mgrid[0:sh, 0:sw]
        vor = L.deckend(spr)
        self.m_gold = L.farbmaske(spr, self.GOLD) & vor
        self.rampe = [c for c in self.GOLD if self.m_gold.any()]
        self.gemA, self.gemB = tuple(int(v) for v in spr[3, 7, :3]), tuple(int(v) for v in spr[3, 8, :3])    # Edelstein-Facetten (Mitte der Krone)
        self.augen = [(5, 8), (6, 8), (9, 8), (10, 8), (5, 9), (6, 9), (9, 9), (10, 9)]
        self.lidfarbe = tuple(int(v) for v in spr[8, 7, :3])
        self.umriss = Hm.umrissfarben(spr)
        self.schwarz = tuple(int(v) for v in spr[5, 4, :3])
        self.hell = self.GOLD[2]

    def frame(self, i, nur=None):
        N, OFF, spr = self.N, self.OFF, self.spr
        k = L.platz(spr, self.H, self.W, OFF[0], OFF[1])
        # Edelstein: die beiden Facetten tauschen kurz (Frames je 3)
        for s in self.gem:
            if Hm.folge(i, s, [1, 1, 1], N):
                Hm.setze(k, {(7, 3): self.gemB, (8, 3): self.gemA}, OFF)
        # Lichtband über das Gold der Krone (diagonal, 1 Stufe heller auf der Goldrampe)
        mg = self.m_gold & ~Hm.kantenmaske(spr)                                  # Randpixel der Krone bleiben Umrissfarbe (Regel 16)
        mg[3, 7] = mg[3, 8] = False
        Hm.lichtband(k, mg, OFF, i, N, self.band, 12, self.GOLD, stufen=1, breite=3.0, achse=(1.0, 0.6), kern=2)
        # Blinzeln: Lid in Gesichtsfarbe
        for s in self.blink:
            if Hm.folge(i, s, [1, 1], N):
                lid(k, OFF, self.augen, self.lidfarbe)
        hub = Hm.stufe(i, self.hub_per, 1, self.hub_vz)
        k = Hm.atmen(k, OFF[1] + 14, OFF[1] + 10, hub, 0)
        k = Hm.kontur_schliessen(k, self.umriss, self.schwarz)
        # Glitzersterne an den Kronenspitzen (sitzen AM Gold, steigen mit der Krone; erst NACH dem Konturschluss gezeichnet, sonst würden sie schwarz)
        for s, (sx, sy) in ([] if nur else self.sterne):
            st = Hm.folge(i, s, [0, 1, 2, 1, 0], N)
            if st is not None:
                Hm.stern4(k, sx, sy - hub, st, self.GOLD[2], self.GOLD[1], self.GOLD[1], OFF)
        return k


# ══ Turm (Rook of Kings): Turmfigur mit ausgebreiteten Armen und blauen Augen ═════════════════════════════════════════════════════════
class Turm:
    """Rook-Sprite 22×22 px ([W]/[B]). Bewegungen: Oberkörper samt Kopfblock hebt sich 1 px (texturierte Rumpfzeile 13 wird eingefügt, Sockel bleibt), beide Arme (x ≤ 5 / x ≥ 16) wippen als starre
    Spalten mit Gefälle ≤ 1 px je Spalte um die Schulter (Spitze bis ±2 px), die Augen blinzeln (Lid = Körperfarbe daneben).
    Runde 3: das Schwarze unten (y 20–21) sind ROLLEN (vier kleine Räder; Innenpixel (26,26,26)/(76,76,76) in y 20) — der ganze Turm rollt ein bis zwei Pixel hin und her (roll_per = Periode in Frames,
    roll_amp = Weg in px, roll_ph = Phase), die Rollen drehen sich dabei: je Rolle läuft die zyklische Folge [dunkel, hell, hell] durch das zwei Pixel breite Fenster ((d,h) → (h,h) → (h,d) → …), einen Schritt je Pixel Rollweg.
    Das Fußtippen entfällt."""
    PAD = (5, 5, 4, 2)

    def __init__(self, spr, n=48, ms=70, hub_per=24, arm_l=(1, 1.0, 2), arm_r=(1, -1.0, 2), blink=(20, 44), roll_per=48, roll_amp=1.6, roll_ph=0.0):
        self.spr, self.N, self.MS = spr, n, ms
        self.roll_per, self.roll_amp, self.roll_ph = roll_per, roll_amp, roll_ph
        sh, sw = spr.shape[:2]
        self.H, self.W = sh + self.PAD[2] + self.PAD[3], sw + self.PAD[0] + self.PAD[1]
        self.OFF = (self.PAD[0], self.PAD[2])
        self.hub_per, self.arm_l, self.arm_r, self.blink = hub_per, arm_l, arm_r, blink
        yy, xx = np.mgrid[0:sh, 0:sw]
        vor = L.deckend(spr)
        self.m_arm_l = vor & (xx <= 5) & (yy >= 7) & (yy <= 12)
        self.m_arm_r = vor & (xx >= 16) & (yy >= 7) & (yy <= 12)
        # Rollen: Innenpixelpaare (dunkel, hell) in Zeile 20
        self.dunkel = (26, 26, 26)
        self.hell = (76, 76, 76)
        self.rollen = [x for x in range(sw - 1) if spr[20, x, 3] and spr[20, x + 1, 3] and tuple(int(v) for v in spr[20, x, :3]) == self.dunkel and tuple(int(v) for v in spr[20, x + 1, :3]) == self.hell]
        # Augen: blaue Pixel (und im [B]-Sprite der helle Augapfel (204) links daneben) in Zeile 7
        aug = []
        for x in range(sw):
            r, g, b = (int(v) for v in spr[7, x, :3])
            if spr[7, x, 3] and b > 100 and r < 60:
                aug.append((x, 7))
                if x > 0 and tuple(int(v) for v in spr[7, x - 1, :3]) == (204, 204, 204) and (x - 1, 7) not in aug:
                    aug.append((x - 1, 7))
        self.augen = sorted(aug)
        self.lid = {}
        for (x, y) in self.augen:
            for d in (1, -1, 2, -2):
                q = x + d
                if 0 <= q < sw and (q, y) not in self.augen and spr[y, q, 3]:
                    self.lid[(x, y)] = tuple(int(v) for v in spr[y, q, :3])
                    break
        self.umriss = Hm.umrissfarben(spr)
        self.schwarz = (0, 0, 0)

    def _ebene(self, m, dy=0):
        return L.platz(L.trenne(self.spr, m)[0], self.H, self.W, self.OFF[0], self.OFF[1] + dy)

    def _arm(self, a, links, dy_spitze):
        out = L.leer(*a.shape[:2])
        off = self.OFF
        for X in range(a.shape[1]):
            ys = np.nonzero(a[:, X, 3])[0]
            if not len(ys):
                continue
            x = X - off[0]
            f = (6 - x) / 6.0 if links else (x - 15) / 6.0
            dy = rund(dy_spitze * max(0.0, f))
            if ys.min() + dy < 0 or ys.max() + dy >= a.shape[0]:
                raise L.ClipError('Arm würde aus der Leinwand geschoben')
            out[ys + dy, X] = a[ys, X]
        return out

    def frame(self, i, nur=None):
        N, OFF, spr = self.N, self.OFF, self.spr
        vor = L.deckend(spr)
        rest = vor & ~(self.m_arm_l | self.m_arm_r)
        k = self._ebene(rest)
        for s in self.blink:
            if Hm.folge(i, s, [1, 1], N):
                lid(k, OFF, self.augen, self.lid)
        hub = Hm.stufe(i, self.hub_per, 1)
        k = Hm.atmen(k, OFF[1] + 13, OFF[1] + 4, hub, 0)
        al = self._ebene(self.m_arm_l)
        ar = self._ebene(self.m_arm_r)
        cl, vl, ampl = self.arm_l
        cr, vr, ampr = self.arm_r
        dl = rund(ampl * vl * math.sin(L.sinus(i, N / cl)))
        dr = rund(ampr * vr * math.sin(L.sinus(i, N / cr)))
        al = L.versetze(self._arm(al, True, dl), 0, -hub)
        ar = L.versetze(self._arm(ar, False, dr), 0, -hub)
        fig = L.zusammen(self.H, self.W, [(k, 0, 0), (al, 0, 0), (ar, 0, 0)])
        fig = Hm.kontur_schliessen(fig, self.umriss, self.schwarz)
        # Rollen: der ganze Turm rollt hin und her (x), die Rollen drehen sich mit dem Rollweg (ein Muster-Schritt je Pixel)
        pos = rund(self.roll_amp * math.sin(L.sinus(i, self.roll_per, self.roll_ph)))
        folge = [self.dunkel, self.hell, self.hell]                    # Ring der Rolle: das helle Stück (Speiche) wandert durch das 2-px-Fenster, bleibt aber immer sichtbar
        for x in self.rollen:
            Hm.setze(fig, {(x, 20): folge[pos % 3], (x + 1, 20): folge[(pos + 1) % 3]}, OFF)
        return L.versetze(fig, pos, 0)
