# -*- coding: utf-8 -*-
"""Idle-Animation für „Scavenging Crane“ (Creature) — Kranich, der im flachen Wasser steht und nach dem Fisch späht.

PICK: [["MotiveJapan", 6, "Scavenging Crane #1 (Kranich)"]]
Quelle: src/scavenging-crane.png — Ebene „Scavenging Crane #1“ (30×23 px, 17 Farben) aus MotiveJapan.xcf. Die Beine laufen in der Ebene unten mit weichem Alpha aus (Wasserlinie,
Alpha 222…27); das Sprite hat sie auf Alpha 0/255 gebracht (≥ 170 voll, 100–170 Schachbrett, 50–100 jedes vierte Pixel, darunter weg). Nicht verwendet: der springende Fisch
(Ebene „Scavenging Crane #2“, 12×17, die Beute auf der Karte) und der Gischt-Streifen (Ebene „Scavenging Crane“, 52×40, Weißwasser/Wellen) — Beiwerk der Kunst.

Aufruf:   python3 scavenging_crane.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/scavenging-crane.png + .json

Identifikation (Sprite-Koordinaten x, y):
* Körper (x 4–18, y 2–12): weiß/grau gefiederter Rumpf (Weiß (255,255,255), Hellgrau (219,219,219), (190,190,190), Schatten (166,166,166), Umriss (91,91,91) und (49,50,51)); die Flügel liegen angelegt am Rumpf.
* Schwanz (x 0–5, y 10–15): schwarz (0,0,0), hängt nach unten links.
* Hals (x 14–26, y 0–4): langer schwarzer Bogen, der über den Rücken nach vorn greift, und Kopf (x 25–28, y 3–8): weißes Gesicht, roter Scheitel (255,85,85)/(255,0,0), schwarzer Streifen.
  Darunter der offene Schnabel (x 24–29, y 8–11) in (227,220,165)/(255,248,183): Ansatz (26,8)(27,8) und zwei dünne Linien in V-Form (links (25,9) (25,10) (24,11), rechts (28,9) (28,10) (29,11)).
  Ein eindeutiges Auge ist nicht zu erkennen → kein Blinzeln.
* Beine (x 4–14, y 13–20): zwei dünne graue Stelzen (147,150,153), links (8,13)…(4,20), rechts (11,13)…(14,20), die unten im Wasser verschwinden.

Ablauf (48 Frames à 65 ms = 3,12 s) — er steht, späht und pickt. Ein Flügelschlag ist nicht möglich: die Flügel sind im Sprite angelegt, ausgebreitete Flügel gibt die Figur nicht her.
* Spähen/Picken: der Hals samt Kopf und Schnabel senkt sich alle 24 Frames um 1 px (sanft) und pickt einmal pro Schleife (Frame 28–36): bis 4 px nach unten, der Schnabel
  schließt sich dabei ganz (siehe unten). Jede Halsspalte wandert als Ganzes senkrecht (der Bogen verformt sich, nichts wird kopiert).
* Schnabel (RUNDE 3, Nutzer: „soll seinen Schnabel auch richtig zumachen können“): vorher rückten nur die Spitzen 1 px nach innen. Jetzt hat der Schnabel drei Stufen — offen (Original), halb offen, GESCHLOSSEN
  (spitzer 2-px-Schnabel (26–27, 9–10) + Spitze (26,11), selbst gezeichnet aus den zwei Cremetönen des Sprites): schnappt bei Frame 4–8 zu, klappert bei 15–17 und 19–21 zweimal schnell, und packt beim Picken (Frame 30–38) zu;
  er hält den Bissen beim Hochkommen geschlossen. Der Schnabel folgt starr dem Kopf (gleiche Senkung wie der Kopf).
* Atmen: Rumpf hebt sich um 1 px (zweimal pro Schleife; Zeile 11 doppelt, die Beine bleiben).
* Schwanz wedelt (bis 1 px, Periode 16 Frames).
* Waten: die Beine heben sich abwechselnd (bis 2 px, Periode 24 Frames, versetzt) — der Fuß taucht in der Zwischenzeit wieder ein.
* Schaum (RUNDE 2, Nutzer: „soll nie eine Lücke zwischen den Beinen und den Schaum-Effekten geben!“): An jedem Fuß liegt ein flaches Schaumpolster aus Weiß (255,255,255) mit hellgrauem Rand (190,190,190); seine OBERE Reihe liegt
  immer direkt (4-verbunden) unter dem untersten Beinpixel — es hängt am Fuß und steigt mit, wenn das Bein sich hebt, es wandert nicht mehr davon. Es pulsiert zwischen drei Größen (3 × 1, 5 × 2, 7 × 3 px, Periode 16 Frames, die Füße
  um 8 Frames versetzt; Frame 0 = klein). Die losgelösten Wasserringe (Partikel, die vom Fuß wegwanderten) entfallen. Kein Glanz (Federn).

Ergänzungen: keine nötig.
Randpixel-Test (Regel 16): verschobene Halsspalten legen an Seitenkanten Innenfarbe frei; solche Randpixel werden in der Umrissfarbe ihrer Ebene gesetzt (Hals/Kopf (0,0,0), Rumpf (91,91,91),
Beine (147,150,153)) — in `frame()` per `B.umriss_je_ebene`.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError, wenn etwas herausragen würde). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_textur as TX   # texturierte Streckzeilen statt Zeilenkopien (Regel 43)
import anim_flieger as F
import anim_flieger_b as B

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 4, 5, 3, 5

spr = L.lade('scavenging-crane')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

# ── Masken ───────────────────────────────────────────────────────────────────────────────────────────────────────────
schwanz_m = vorhanden & (xx <= 5) & (yy >= 10) & (yy <= 15)
schnabel_m = np.zeros_like(vorhanden)                                   # die beiden Schnabelhälften (V-Linien, 6 Pixel) — bewegen sich eigenständig (öffnen/schließen)
for (x_, y_) in ((25, 9), (25, 10), (24, 11), (28, 9), (28, 10), (29, 11)):
    assert vorhanden[y_, x_]
    schnabel_m[y_, x_] = True
hals_m = vorhanden & (xx >= 19) & (yy <= 12) & ~schnabel_m
bein_l_m = vorhanden & (yy >= 13) & (xx <= 9) & ~schwanz_m
bein_r_m = vorhanden & (yy >= 13) & (xx >= 10)
koerper_m = vorhanden & ~schwanz_m & ~hals_m & ~schnabel_m & ~bein_l_m & ~bein_r_m
assert int((schwanz_m | hals_m | schnabel_m | bein_l_m | bein_r_m | koerper_m).sum()) == int(vorhanden.sum())
assert not (hals_m & koerper_m).any()


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)


KOERPER, SCHWANZ, HALS, BEIN_L, BEIN_R = teil(koerper_m), teil(schwanz_m), teil(hals_m), teil(bein_l_m), teil(bein_r_m)

# ── Schnabel (RUNDE 3, Nutzer: „soll seinen Schnabel auch richtig zumachen können“) ─────────────────────────────────────────
# Im Original ist der Schnabel weit offen: zwei Hälften in V-Form unter dem Schnabelansatz (26,8)(27,8). Drei Stufen, Farben (255,248,183) hell / (227,220,165) dunkel (beide aus dem Sprite):
#   Stufe 0 offen = Original · Stufe 1 halb offen (Hälften rücken zusammen) · Stufe 2 GESCHLOSSEN: ein spitzer, 2 px breiter Schnabel (26–27, 9–10) mit Spitze (26,11).
SCH_H, SCH_D = (255, 248, 183), (227, 220, 165)
assert tuple(spr[9, 25, :3]) == SCH_H and tuple(spr[10, 25, :3]) == SCH_D and tuple(spr[11, 24, :3]) == SCH_D and tuple(spr[11, 29, :3]) == SCH_H
SCHNABEL_PIXEL = {
    0: [(25, 9, SCH_H), (25, 10, SCH_D), (24, 11, SCH_D), (28, 9, SCH_H), (28, 10, SCH_D), (29, 11, SCH_H)],
    1: [(26, 9, SCH_H), (25, 10, SCH_D), (25, 11, SCH_D), (27, 9, SCH_H), (28, 10, SCH_D), (28, 11, SCH_H)],
    2: [(26, 9, SCH_H), (27, 9, SCH_H), (26, 10, SCH_D), (27, 10, SCH_D), (26, 11, SCH_D)],
}


def schnabel_ebene(stufe):
    e = L.leer(H, W)
    for (x_, y_, c_) in SCHNABEL_PIXEL[stufe]:
        e[PAD_T + y_, PAD_L + x_, :3] = c_
        e[PAD_T + y_, PAD_L + x_, 3] = 255
    return e


SCHNABEL = {k: schnabel_ebene(k) for k in SCHNABEL_PIXEL}
assert (SCHNABEL[0][..., 3] > 0).sum() == int(schnabel_m.sum()) and ((SCHNABEL[0] == teil(schnabel_m)).all())
SCHNABEL_ZEIT = {4: 1, 5: 2, 6: 2, 7: 2, 8: 1,                                # schnappt zu (kurz)
                 15: 1, 16: 2, 17: 1,                                          # Klappern: zweimal schnell hintereinander
                 19: 1, 20: 2, 21: 1,
                 30: 1, 31: 2, 32: 2, 33: 2, 34: 2, 35: 2, 36: 2, 37: 2, 38: 1}     # packt beim Picken zu und hält den Bissen beim Hochkommen

# ── Farben (alle aus dem Sprite) ───────────────────────────────────────────────────────────────────────────────────
SCHWARZ, GRAU_UMRISS, BEIN_GRAU = (0, 0, 0), (91, 91, 91), (147, 150, 153)
m_ = vorhanden
_p = np.pad(m_, 1)
_rand = m_ & (~_p[:-2, 1:-1] | ~_p[2:, 1:-1] | ~_p[1:-1, :-2] | ~_p[1:-1, 2:])
ERLAUBT = {tuple(int(v) for v in spr[y, x, :3]) for y, x in zip(*np.nonzero(_rand))}     # Umrissfarben der Quelle (Randpixel-Test)
EBENEN_FARBE = {1: GRAU_UMRISS, 2: SCHWARZ, 3: BEIN_GRAU}


def px(x, y):
    return PAD_L + x, PAD_T + y


# ── Bewegungen ───────────────────────────────────────────────────────────────────────────────────────────────────────
PECK = {28: 0, 29: 1, 30: 2, 31: 3, 32: 3, 33: 2, 34: 2, 35: 1, 36: 0}      # Pick-Profil (px nach unten)


def hals_dy(i):
    sanft = 0.5 * (1 - math.cos(2 * math.pi * i / 24.0))                    # alle 24 Frames um 1 px
    return int(round(sanft + PECK.get(i, 0)))


def schnabel_stufe(i):
    return SCHNABEL_ZEIT.get(i, 0)


def atem(i):
    return 1 if math.sin(L.sinus(i, 24.0, -0.5)) > 0.1 else 0


def anheben(i, phase):
    """Bein hebt sich: 0 / 1 / 2 px, etwa ein Drittel der Periode (24 Frames), Fuß taucht dazwischen wieder ein."""
    s = math.sin(L.sinus(i, 24.0, phase))
    return 2 if s > 0.85 else (1 if s > 0.55 else 0)


def bein(a, k):
    return L.heben_unten(a, PAD_T + 16, k) if k else a


# ── Schaum am Fuß: hängt immer direkt unter dem untersten Beinpixel ──────────────────────────────────────────────────────────
SCHAUM_W, SCHAUM_R = (255, 255, 255), (190, 190, 190)
# Zeilen unter dem Fuß: je Zeile (x-Versatz → Farbe); 'c' = weißer Kern, 'r' = grauer Rand. Stufe 0 klein … 2 groß.
SCHAUM_FORMEN = [
    [[(-1, 'r'), (0, 'c'), (1, 'r')]],
    [[(-2, 'r'), (-1, 'c'), (0, 'c'), (1, 'c'), (2, 'r')], [(-1, 'r'), (0, 'r'), (1, 'r')]],
    [[(-3, 'r'), (-2, 'c'), (-1, 'c'), (0, 'c'), (1, 'c'), (2, 'c'), (3, 'r')], [(-2, 'r'), (-1, 'c'), (0, 'c'), (1, 'c'), (2, 'r')], [(-1, 'r'), (0, 'r'), (1, 'r')]],
]
SCHAUM_FOLGE = [0, 0, 1, 1, 2, 2, 2, 2, 1, 1, 0, 0, 0, 0, 0, 0]          # Größenstufe je Frame (Periode 16)
FUESSE = {'l': (4, 20), 'r': (14, 20)}                                     # unterste Beinpixel (Sprite)


def schaum(i, ks):
    """Schaumpolster unter den beiden Füßen. ks = {'l': k, 'r': k} = Hebung des Beins in px (der Schaum steigt mit dem Fuß)."""
    e = L.leer(H, W)
    for nr, (name, (fx, fy)) in enumerate(FUESSE.items()):
        stufe = SCHAUM_FOLGE[(i + 8 * nr) % 16]
        x0, y0 = PAD_L + fx, PAD_T + fy - ks[name]
        for zeile, reihe in enumerate(SCHAUM_FORMEN[stufe]):
            for dx, k in reihe:
                x, y = x0 + dx, y0 + 1 + zeile
                if not (0 <= x < W and 0 <= y < H):
                    raise L.ClipError(f'Schaumpixel bei ({x},{y}) außerhalb der Leinwand {W}×{H}')
                e[y, x, :3] = SCHAUM_W if k == 'c' else SCHAUM_R
                e[y, x, 3] = 255
    return e


TEST_EBENEN = ('koerper', 'hals', 'beine')                  # für den Randpixel-Test: ohne Partikel


def frame(i, partikel=True, nur=None):
    ebenen = nur if nur is not None else TEST_EBENEN
    if nur is not None:
        partikel = False
    n = atem(i)
    dy = hals_dy(i)
    schichten = []
    ks = {'l': anheben(i, 0.0), 'r': anheben(i, math.pi)}
    if 'beine' in ebenen:
        schichten += [(bein(BEIN_L, ks['l']), 0, 0, 3), (bein(BEIN_R, ks['r']), 0, 0, 3)]
    if 'koerper' in ebenen:
        z = PAD_T + 11
        schichten += [(TX.streck_zeile(KOERPER, z, n), 0, 0, 1), (TX.streck_zeile(SCHWANZ_W(i), z, n), 0, 0, 1)]
    if 'hals' in ebenen:
        sch = lambda a: B.spalten_schub(a, PAD_L + 18, lambda f: dy * min(1.0, f * 11 / 7.0), 11)   # Hals/Kopf senken: Spalten x 19–25 verformen den Bogen, Kopf und Schnabel (x ≥ 25) wandern starr um dy
        schichten += [(sch(HALS), 0, -n, 2), (sch(SCHNABEL[schnabel_stufe(i)]), 0, -n, 2)]
    f, karte = B.zusammen_mit_karte(H, W, schichten)
    B.umriss_je_ebene(f, karte, ERLAUBT, EBENEN_FARBE)
    if partikel:
        f = L.zusammen(H, W, [(schaum(i, ks), 0, 0), (f, 0, 0)])
    return f


def SCHWANZ_W(i):
    return L.zeilen_welle(SCHWANZ, PAD_T + 11, 1.2, L.sinus(i, 16.0, 0.4))


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('scavenging-crane', 'Scavenging Crane', frames, MS, prev)
    if prev:
        L.streifen(prev + '/scavenging-crane-strip.png', frames, spalten=8, scale=8)
