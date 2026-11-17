# -*- coding: utf-8 -*-
"""Idle-Animation für „Skeleton Reaper“ (Creature) — Runde 2: Sense schwingt, der große Bogen ist nur der SCHWUNG.

Quelle: src/skeleton-reaper.png — Ebene „Skeleton Reaper“ (38×40 px, 29 Farben, 499 Pixel) aus Motive.xcf (Ebene 808, Figur 1, eine einzige Figur; Treffer 1.0).
PICK: [["Motive", 808, 1]]
Nutzer-Referenz: ref3.png (Sensenblatt als Schwung in 4 Frames, Klinge schwingt von unten links nach oben rechts, Größe wechselt).

Aufruf:   python3 skeleton_reaper.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/skeleton-reaper.png + .json (mit `kern` = Körper ohne Sense, `faceX` = Kapuzenmitte)

Was ist was (x/y im Sprite):
* Kapuze (x 4–14, y 0–8): schwarz mit grauen Lichtkanten, oben eine nach rechts eingerollte Spitze; die Aussparung (11,3) (11,4) (12,5) ist die Kapuzenöffnung (transparent, bleibt so).
  Mantel (x 0–17, y 9–18): schwarz, zwei Ärmel (links x 0–5 mit grauer Knochenhand bei (2,16) (2,17); rechts x 13–17 greift die Sense), Saum y 16–18. Ein einzelnes dunkelrotes
  Pixel (105,0,0) bei (7,11) = das rote AUGE der Gestalt. Beine (x 4–15, y 19–26): graue Knochen, Füße y 24–26.
* GRIFF: die vier dunkelbraunen Pixel (13–16,15) und (15,16) sind die Hand an der Sense (bleiben als Teil des Körpers fest).
* SENSE = Stiel + Blatt + Zwinge. Der Stiel (braun (17,12,8)/(33,23,16)) läuft von der Hand (17,15) bis zum Blatt (30,19); die Zwinge (Holz (35,25,18) (102,73,51) (65,46,32) (3,2,2)) steckt
  außen am Blatt bei (35–37,20–21).
* BLATT und SCHWUNG (Auswertung mit Kreisanpassung + Referenzbild ref3): der ganze große graue/weiße Bogen ist EIN Kreisbogen um (7,1; 12,1) mit Radius 25,3 (Innenkante weiß, Außenkante grau).
  Das echte Sensenblatt ist nur das kurze Stück an der Zwinge (≈ 32°, ≈ 16 px, von der Zwinge bei etwa 18° bis zur Spitze (31,5)); der ganze lange Rest (Winkel 18° … 100°, unten links
  bis (2,39), nach hinten auslaufend dünner) ist die SCHWUNGSPUR (Bewegungsunschärfe des Schlags), kein Blatt. Beleg: Ref ref3 zeigt in den vier Frames dasselbe Blatt (16×6 px), das von unten
  links (Spitze nach rechts) über rechts (Spitze nach oben, Spur lang: = die Pose des Originalbildes) nach oben rechts (Spitze nach links) wandert und die Spur wieder verliert.
  Alle Sensenpixel werden darum NEU gezeichnet (Polarkoordinaten um den Mittelpunkt (7,1; 12,1), Farbrampe wie im Original: (246,246,246) Schneide, (213), (189), (106)/(82), (65) Rücken;
  Spur und Blatt gehen kontinuierlich ineinander über). Keine Drehung eines Bildes, jedes Pixel wird aus Radius/Winkel/Dicke bestimmt.

Ablauf (56 Frames à 65 ms = 3,64 s; Frame 0 = Ruhepose = Original ohne Schwungspur):
* SENSE (Hauptbewegung, 1 Schleife): 0–13 Ruhe (Blatt zeigt nach oben, wiegt sich ±2° mit dem Atem), 14–25 Ausholen (langsam im Uhrzeigersinn nach unten links), 26–27 kurz halten (Auftakt),
  28–36 SCHWUNG (schnell gegen den Uhrzeigersinn von unten links über rechts nach oben rechts; die Spur wächst bis ≈ 80° hinter dem Blatt und wird kürzer, bis sie sich am Ende ganz
  zurückgezogen hat), 37–40 Blatt oben rechts (Spur zieht ein, kleiner Rückprall), 41–55 langsam zurück in die Ruhe. Der Stiel läuft immer von der Hand zur Zwinge (Bresenham, hinter dem Körper,
  die vier Handpixel liegen darüber).
* Atmen zweistufig 0-1-2-1-0 px (Periode 24): Mantelzeile y 14 wird 1–2× eingefügt (L.streck_zeile = Texturmischung); Kapuzenkuppe atmet 3 Frames später zusätzlich 1 px.
* Mantelsaum (y 16–18) wiegt sich: Zeilenversatz bis 1 px, unten stärker, mit Nachlauf (Periode 12).
* Blinzeln: das rote Augenpixel wird 3 Frames lang schwarz (Mantelfarbe), zweimal pro Schleife (Frame 14–16 und 37–39). Sonst kein Glühen.
* Glanz (Metall — nur auf dem Blatt, nur in der Ruhe): ein Lichtband (Breite 6°, eine Stufe heller auf der Rampe (41→65→82→106→189→213→246)) läuft in Frame 2–11 von der Zwinge zur
  Spitze; dort blitzt ein vierzackiger Glitzerstern (3 Frames, Arme 1 → 2 → 1 px) auf und geht mit der Sense mit.
* Nebelwölkchen (Partikel, hinter der Figur, 7 Stück, Lebensdauer 56 Frames, langsam aufsteigend, leichtes Wabern, 2×2 → 3×3 → 2×2): dunkle Schwaden (Kern (28,28,28), Rand (65,65,65)).
Fest bleiben: Kapuzenform, Beinform.
Randpixel-Test (Regel 16): `U.kontur_schliessen` setzt in jeder Pose fehlende Umrisspixel (Schwarz) am wiegenden Saum und an den Ärmeln; im Ruhebild ändert es nichts.
ERGÄNZUNG: keine Körperpixel gemalt; der Stiel und das Blatt sind (statt Sprite-Pixeln) in jeder Pose neu gezeichnet. Rampenfarben/Holz nur aus dem Sprite.
Zuschnitt: enger Rahmen um die Vereinigung aller Frames (+1 px); `kern` (Körper ohne Sense) und `faceX` in der JSON, damit die Platzierung am Körper (nicht am Schwungbereich) hängt.
Alle Bewegungen laufen auf der vollen Leinwand (ClipError, falls etwas herausragt). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_textur as TX   # texturierte Streckzeilen statt Zeilenkopien (Regel 43/49)
TX.umleiten()               # auch Streckaufrufe innerhalb der Gruppenmodule liefern texturierte Zeilen
import anim_untote as U

N, MS = 56, 65
GPL, GPR, GPT, GPB = 14, 8, 17, 10

spr = L.lade('skeleton-reaper')
sh, sw = spr.shape[:2]
H, W = sh + GPT + GPB, sw + GPL + GPR
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
col = lambda x, y: tuple(int(v) for v in spr[y, x, :3])

SCHWARZ = (4, 4, 4)
AUGE = (7, 11)
AUGE_ROT = (105, 0, 0)
assert col(*AUGE) == AUGE_ROT
BRAUN = {(33, 23, 16), (17, 12, 8), (35, 25, 18), (65, 46, 32), (102, 73, 51), (3, 2, 2)}
ist_braun = np.array([[bool(vorhanden[y, x]) and col(x, y) in BRAUN for x in range(sw)] for y in range(sh)])
GRIFF = [(13, 15), (14, 15), (15, 15), (16, 15), (15, 16)]              # Hand an der Sense: bleibt am Körper
GRIFF_SET = set(GRIFF)
assert all(ist_braun[y, x] for x, y in GRIFF)
sense = vorhanden & ((yy >= 27) | (xx >= 17) | (ist_braun & (xx >= 13)))
for (x, y) in GRIFF:
    sense[y, x] = False
koerper = vorhanden & ~sense
UMRISS = U.umrissfarben(spr)

# ── Sense neu gezeichnet: Kreisbogen um C (Polarkoordinaten) ───────────────────────────────────────────────────────────
CX, CY = 7.1, 12.1                    # Mittelpunkt des Schwungbogens (Anpassung an die weißen Innenkanten, Restfehler < 1 px)
R0 = 24.9                             # Band 0 (Schneide) = Radius 24,9 … 25,9
REST = 18.0                           # Winkel (Grad, y nach unten) der Zwinge in der Ruhepose
SPITZE_S = -34.0                      # Blattspitze liegt 34° VOR der Zwinge (gegen den Uhrzeigersinn = kleinerer Winkel)
TRAIL_MAX = 82.0
HAND = (16, 15)                       # letztes Handpixel; der Stiel beginnt daneben
W_BLATT = [(-34.0, 1.6), (-30.0, 2.2), (-24.0, 3.1), (-12.0, 3.9), (0.0, 4.5)]
BLATT_FARBEN = {                      # Blatt (s < 0): wie das Original (oben mattere Töne, Rücken dunkel)
    1: [(189, 189, 189)],
    2: [(189, 189, 189), (65, 65, 65)],
    3: [(213, 213, 213), (189, 189, 189), (65, 65, 65)],
    4: [(246, 246, 246), (189, 189, 189), (106, 106, 106), (65, 65, 65)],
    5: [(246, 246, 246), (189, 189, 189), (189, 189, 189), (106, 106, 106), (65, 65, 65)],
}
RAMPE_FARBEN = {                      # Spur (s ≥ 0), Dicke K → Farben von der Schneide (innen) nach außen
    1: [(189, 189, 189)],
    2: [(189, 189, 189), (65, 65, 65)],
    3: [(246, 246, 246), (106, 106, 106), (65, 65, 65)],
    4: [(246, 246, 246), (189, 189, 189), (106, 106, 106), (65, 65, 65)],
    5: [(246, 246, 246), (213, 213, 213), (189, 189, 189), (106, 106, 106), (65, 65, 65)],
}
SCHNEIDE = {(41, 41, 41): (65, 65, 65), (65, 65, 65): (82, 82, 82), (82, 82, 82): (106, 106, 106), (106, 106, 106): (189, 189, 189),
            (189, 189, 189): (213, 213, 213), (213, 213, 213): (246, 246, 246)}       # Lichtband: eine Stufe heller (alles Farben des Sprites)
ZWINGE = {(0, 0): (35, 25, 18), (1, 0): (102, 73, 51), (0, 1): (3, 2, 2), (1, 1): (65, 46, 32), (2, 1): (65, 46, 32)}   # (radial, Seite) wie im Original bei (35–37, 20–21)
_alle = {col(x, y) for y in range(sh) for x in range(sw) if vorhanden[y, x]}
assert all(c in _alle for c in SCHNEIDE) and all(c in _alle for c in SCHNEIDE.values()) and all(c in _alle for v in RAMPE_FARBEN.values() for c in v) and all(c in _alle for v in BLATT_FARBEN.values() for c in v)
assert all(c in _alle for c in ZWINGE.values())
STIEL_C, STIEL_D = (17, 12, 8), (33, 23, 16)
UM = (CX + GPL, CY + GPT)             # Mittelpunkt auf der Leinwand


def _interp(tab, s):
    if s <= tab[0][0]:
        return tab[0][1]
    for (s0, w0), (s1, w1) in zip(tab, tab[1:]):
        if s <= s1:
            return w0 + (w1 - w0) * (s - s0) / (s1 - s0)
    return tab[-1][1]


def dicke(s, spur):
    """Bandzahl K bei Winkelabstand s zur Zwinge (s<0: Blatt, s>0: Schwungspur der Länge `spur`)."""
    if s < 0:
        return _interp(W_BLATT, s)
    # die Spur bleibt bis ~30° vor ihrem Ende voll breit und läuft dann spitz zu
    ende = 34.0
    if spur - s >= ende:
        return 4.5
    return 1.0 + 3.5 * max(0.0, (spur - s) / ende)


def kreis_pixel(phi, spur, mit_zwinge=True):
    """Pixel (x, y, farbe) von Blatt + Spur bei Zwingenwinkel phi (Grad) und Spurlänge `spur` (Grad) auf der Leinwand."""
    px = {}
    umax = 7.0
    for y in range(H):
        for x in range(W):
            dx, dy = x - UM[0], y - UM[1]
            r = math.hypot(dx, dy)
            if r < R0 - 0.5 or r > R0 + 7.5:
                continue
            a = math.degrees(math.atan2(dy, dx))
            s = (a - phi + 180.0) % 360.0 - 180.0
            k = int(math.floor(r - R0))
            if s < SPITZE_S - 1.0 or s > spur + 1.0:
                continue
            if mit_zwinge and 0 <= k <= 6:
                pass
            if -34.0 <= s <= spur and k >= 0:
                kk = max(1, int(round(dicke(s, spur))))
                if k < kk:
                    tab = BLATT_FARBEN if s < 0 else RAMPE_FARBEN
                    px[(x, y)] = tab[min(5, kk)][k]
    return px


def zwinge_pixel(phi):
    """Holzzwinge außen am Blatt bei Winkel phi."""
    px = {}
    for y in range(H):
        for x in range(W):
            dx, dy = x - UM[0], y - UM[1]
            r = math.hypot(dx, dy)
            d = r - R0 - 4.0
            if not 0.0 <= d < 3.0:
                continue
            a = math.degrees(math.atan2(dy, dx))
            s = (a - phi + 180.0) % 360.0 - 180.0
            if abs(s) > 20.0:
                continue
            t = r * math.sin(math.radians(s))                      # Querabstand in px (negativ = vor der Zwinge, gegen den Uhrzeigersinn)
            if -1.0 <= t < 0.0:
                j = (int(d), 0)
            elif 0.0 <= t < 1.0:
                j = (int(d), 1)
            else:
                continue
            if j in ZWINGE:
                px[(x, y)] = ZWINGE[j]
    return px


def linie(p0, p1):
    """Bresenham, 8-verbunden (wie der Stiel im Original)."""
    (x0, y0), (x1, y1) = p0, p1
    dx, dy = abs(x1 - x0), abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    err = dx - dy
    pts = []
    while True:
        pts.append((x0, y0))
        if (x0, y0) == (x1, y1):
            break
        e2 = 2 * err
        if e2 > -dy:
            err -= dy; x0 += sx
        if e2 < dx:
            err += dx; y0 += sy
    return pts


def sense_ebene(phi, spur, band=None):
    """Sense (Stiel, Blatt, Spur, Zwinge) als Ebene auf der vollen Leinwand. band = Winkelabstand der Lichtbandmitte zur Zwinge (oder None)."""
    e = L.leer(H, W)
    # Stiel von der Hand zur Zwinge (Bresenham), vom Blatt später überdeckt
    ziel = (int(round(UM[0] + (R0 + 4.5) * math.cos(math.radians(phi)))), int(round(UM[1] + (R0 + 4.5) * math.sin(math.radians(phi)))))
    for k, (x, y) in enumerate(linie((GPL + HAND[0], GPT + HAND[1]), ziel)):
        if k == 0:
            continue
        e[y, x, :3] = STIEL_C if k <= 4 else STIEL_D
        e[y, x, 3] = 255
    for (x, y), c in kreis_pixel(phi, spur).items():
        if band is not None:
            a = math.degrees(math.atan2(y - UM[1], x - UM[0]))
            s = (a - phi + 180.0) % 360.0 - 180.0
            if abs(s - band) <= 3.0 and c in SCHNEIDE and s <= 0:
                c = SCHNEIDE[c]
        e[y, x, :3] = c
        e[y, x, 3] = 255
    for (x, y), c in zwinge_pixel(phi).items():
        e[y, x, :3] = c
        e[y, x, 3] = 255
    return e


def spitze_pixel(phi):
    """Leinwandpixel der Blattspitze (äußerste Schneidenpixel am Winkel phi + SPITZE_S + 3)."""
    a = math.radians(phi + SPITZE_S + 3.0)
    return int(round(UM[0] + (R0 + 0.5) * math.cos(a))), int(round(UM[1] + (R0 + 0.5) * math.sin(a)))


# ── Zeitplan der Sense ─────────────────────────────────────────────────────────────────────────────────────────────────
HOLD_END, WIND_END, ANT_END, SWING_END, SETTLE_END = 14, 26, 28, 37, 41
PHI_WIND, PHI_END = 114.0, -42.0


def glatt(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def sense_pose(i):
    """(Zwingenwinkel in Grad, Spurlänge in Grad) für Frame i."""
    n = N
    if i < HOLD_END:                                               # Ruhe, wiegt sich mit dem Atem
        return REST + 2.2 * math.sin(2 * math.pi * i / HOLD_END), 0.0
    if i < WIND_END:                                               # Ausholen: langsam im Uhrzeigersinn nach unten links
        return REST + (PHI_WIND - REST) * glatt((i - HOLD_END + 1) / (WIND_END - HOLD_END)), 0.0
    if i < ANT_END:                                                # Auftakt: kurz noch ein Stück weiter zurück
        return PHI_WIND + (3.0 if i == WIND_END else 4.0), 0.0
    if i < SWING_END:                                              # Schwung
        u = (i - ANT_END + 1) / (SWING_END - ANT_END)               # 1/9 … 1
        e = u * u * (3 - 2 * u)                                     # langsam – schnell – bremsen
        e = 0.35 * u + 0.65 * e
        phi = (PHI_WIND + 4.0) + (PHI_END - (PHI_WIND + 4.0)) * e
        spur = min(TRAIL_MAX, ((PHI_WIND + 4.0) - phi) * 0.95)
        return phi, spur
    if i < SETTLE_END:                                             # oben rechts: Spur zieht ein, kleiner Rückprall
        k = i - SWING_END
        return PHI_END + (-3.0, -4.0, -2.0, -0.5)[k], TRAIL_MAX * (1 - (k + 1) / 4.0)
    # langsam zurück in die Ruhe
    u = (i - SETTLE_END + 1) / (n - SETTLE_END + 1)
    return PHI_END + (REST - PHI_END) * glatt(u), 0.0


def band_pos(i):
    """Lichtband in der Ruhe: Frame 2–11 von der Zwinge (s = 0) zur Spitze (s = −34)."""
    j = i - 2
    return -34.0 * j / 9.0 if 0 <= j <= 9 else None


STERN_FRAMES = {12: 2, 13: 3, 14: 2}                 # Frame → Stufe (Arme 1 → 2 → 1 px)

NEBEL = {'c': (28, 28, 28), 'r': (65, 65, 65)}
assert all(v in _alle for v in NEBEL.values())
P = lambda x, y: (GPL + x, GPT + y)
PUFFS = [
    dict(x=P(2, 17)[0], y=P(2, 17)[1], vx=-1, vy=-9, off=0, wackeln=1),          # links am Saum
    dict(x=P(15, 19)[0], y=P(15, 19)[1], vx=1, vy=-8, off=24, wackeln=1),         # rechts am Saum
    dict(x=P(12, 0)[0], y=P(12, 0)[1], vx=1, vy=-4, off=40, wackeln=1),           # neben der Kapuzenspitze
    dict(x=P(3, 25)[0], y=P(3, 25)[1], vx=-1, vy=-10, off=14, wackeln=1),         # an den Füßen links
    dict(x=P(14, 25)[0], y=P(14, 25)[1], vx=1, vy=-10, off=6, wackeln=1),         # … rechts
    dict(x=P(8, 24)[0], y=P(8, 24)[1], vx=0, vy=-12, off=30, wackeln=1),          # zwischen den Beinen
    dict(x=P(3, 9)[0], y=P(3, 9)[1], vx=-1, vy=-6, off=46, wackeln=1),            # links neben der Schulter
]


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, GPL, GPT)                           # sofort auf die volle Leinwand


KOERPER0 = teil(koerper)


def koerper_ebene(i):
    n = U.stufe(i, 24, 2)                                        # Atmen 0-1-2-1-0
    r_c = U.stufe(i - 3, 24, 1)                                  # Kapuzenkuppe atmet 3 Frames später zusätzlich
    hump = U.buckel(i, 0, 24, n=24)                              # Hüllkurve des Saumwiegens (0 bei Frame 0)
    kb = KOERPER0.copy()
    if i in (14, 15, 16, 37, 38, 39):
        kb[GPT + AUGE[1], GPL + AUGE[0], :3] = SCHWARZ
    # Saum y 16–18 wiegt sich (Zeilenversatz, unten stärker, mit Nachlauf); der Griff bleibt am Platz
    for k, y in enumerate((16, 17, 18)):
        dx = int(round(1.4 * hump * ((k + 1) / 3.0) * math.sin(2 * math.pi * (i - k) / 12)))
        if dx:
            row = kb[GPT + y].copy()
            kb[GPT + y] = 0
            for x in range(W):
                if row[x, 3]:
                    kb[GPT + y, x if (x - GPL, y) in GRIFF_SET else x + dx] = row[x]
    zk = GPT + 14
    if n:
        kb = TX.streck_zeile(kb, zk, n)
    if r_c:
        kb = TX.streck_zeile(kb, GPT + 6 - n, r_c)
    kb = U.kontur_schliessen(kb, UMRISS, SCHWARZ)                # Regel 16
    return kb


def frame_gross(i, nur=None):
    kb = koerper_ebene(i)
    phi, spur = sense_pose(i)
    sl = sense_ebene(phi, spur, band_pos(i))
    # der Stiel liegt hinter dem Körper (Körper darüber), Blatt/Spur/Zwinge liegen vor allem; die Hand (Griff) liegt über dem Stiel
    ges = L.zusammen(H, W, [(sl, 0, 0), (kb, 0, 0)])
    if nur == 'koerper':
        return ges
    sterne = L.leer(H, W)
    st = STERN_FRAMES.get(i, 0)
    if st:
        sx, sy = spitze_pixel(phi)
        L.einsetzen(sterne, U.stern_ebene(H, W, sx, sy, st, (246, 246, 246), (213, 213, 213)))
    nebel = _nebel(H, W, i, N, PUFFS, NEBEL)
    return L.zusammen(H, W, [(nebel, 0, 0), (ges, 0, 0), (sterne, 0, 0)])


_OHNE_PARTIKEL = [False]
TEST_EBENEN = 'koerper'                              # Randpixel-Test: nur Figur + Sense (ohne Nebel/Stern)


def _nebel(*a, **k):
    if _OHNE_PARTIKEL[0]:
        return L.leer(a[0], a[1])
    return U.wolke_ebene(*a, **k)


def _alle_frames():
    return [frame_gross(i) for i in range(N)]


# Zuschnitt: Vereinigung aller Frames (+1 px Rand); kern = Körper ohne Sense
_GRO = _alle_frames()
_ys, _xs = np.nonzero(np.any([g[..., 3] > 0 for g in _GRO], axis=0))
BOX = (max(0, int(_xs.min()) - 1), max(0, int(_ys.min()) - 1), min(W, int(_xs.max()) + 2), min(H, int(_ys.max()) + 2))


def frame(i, nur=None):
    return U.beschneiden(_GRO[i] if nur is None else frame_gross(i, nur), BOX)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr, min_rand=1)
    kx0, ky0 = GPL - BOX[0], GPT - BOX[1]
    kern = {'x': kx0, 'y': ky0, 'w': 18, 'h': 27}
    L.speichern('skeleton-reaper', 'Skeleton Reaper', frames, MS, prev, face_x=kx0 + 9.0, extra={'kern': kern})
    if prev:
        L.streifen(prev + '/skeleton-reaper-strip.png', [frames[k] for k in (0, 10, 20, 27, 29, 31, 33, 35, 37, 40, 46, 52)], spalten=6, scale=6)
