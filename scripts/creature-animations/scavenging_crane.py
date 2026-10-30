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
  Darunter der offene Schnabel (x 24–29, y 8–11) in (227,220,165)/(255,248,183): zwei dünne Linien in V-Form (links (25,9) (25,10) (24,11), rechts (28,9) (28,10) (29,11)).
  Ein eindeutiges Auge ist nicht zu erkennen → kein Blinzeln.
* Beine (x 4–14, y 13–20): zwei dünne graue Stelzen (147,150,153), links (8,13)…(4,20), rechts (11,13)…(14,20), die unten im Wasser verschwinden.

Ablauf (48 Frames à 65 ms = 3,12 s) — er steht, späht und pickt. Ein Flügelschlag ist nicht möglich: die Flügel sind im Sprite angelegt, ausgebreitete Flügel gibt die Figur nicht her.
* Spähen/Picken: der Hals samt Kopf und Schnabel senkt sich alle 24 Frames um 1 px (sanft) und pickt einmal pro Schleife (Frame 28–36): bis 4 px nach unten, der Schnabel
  klappt dabei auf und wieder zu. Jede Halsspalte wandert als Ganzes senkrecht (der Bogen verformt sich, nichts wird kopiert).
* Atmen: Rumpf hebt sich um 1 px (zweimal pro Schleife; Zeile 11 doppelt, die Beine bleiben).
* Schwanz wedelt (bis 1 px, Periode 16 Frames).
* Waten: die Beine heben sich abwechselnd (bis 2 px, Periode 24 Frames, versetzt) — der Fuß taucht in der Zwischenzeit wieder ein.
* Wasserringe (Partikel): flache weiße Wölkchen breiten sich langsam um die Füße aus, nahtlos. Kein Glanz (Federn).

Ergänzungen: keine nötig.
Randpixel-Test (Regel 16): verschobene Halsspalten legen an Seitenkanten Innenfarbe frei; solche Randpixel werden in der Umrissfarbe ihrer Ebene gesetzt (Hals/Kopf (0,0,0), Rumpf (91,91,91),
Beine (147,150,153)) — in `frame()` per `B.umriss_je_ebene`.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError, wenn etwas herausragen würde). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger as F
import anim_flieger_b as B

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 4, 2, 3, 2

spr = L.lade('scavenging-crane')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

# ── Masken ───────────────────────────────────────────────────────────────────────────────────────────────────────────
schwanz_m = vorhanden & (xx <= 5) & (yy >= 10) & (yy <= 15)
spitze_l_m = np.zeros_like(vorhanden); spitze_l_m[11, 24] = True        # Schnabelspitzen (unterste Pixel der V-Linien)
spitze_r_m = np.zeros_like(vorhanden); spitze_r_m[11, 29] = True
assert vorhanden[11, 24] and vorhanden[11, 29]
hals_m = vorhanden & (xx >= 19) & (yy <= 12) & ~spitze_l_m & ~spitze_r_m
bein_l_m = vorhanden & (yy >= 13) & (xx <= 9) & ~schwanz_m
bein_r_m = vorhanden & (yy >= 13) & (xx >= 10)
koerper_m = vorhanden & ~schwanz_m & ~hals_m & ~spitze_l_m & ~spitze_r_m & ~bein_l_m & ~bein_r_m
assert int((schwanz_m | hals_m | spitze_l_m | spitze_r_m | bein_l_m | bein_r_m | koerper_m).sum()) == int(vorhanden.sum())
assert not (hals_m & koerper_m).any()


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)


KOERPER, SCHWANZ, HALS, BEIN_L, BEIN_R = teil(koerper_m), teil(schwanz_m), teil(hals_m), teil(bein_l_m), teil(bein_r_m)
SPITZE_L, SPITZE_R = teil(spitze_l_m), teil(spitze_r_m)

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


def schnabel_zu(i):
    """Schnabel schnappt zu: die beiden Spitzen rücken in den Frames 33–35 je 1 px nach innen (V-Linien werden senkrecht), sonst offen wie im Original."""
    return i in (33, 34, 35)


def atem(i):
    return 1 if math.sin(L.sinus(i, 24.0, -0.5)) > 0.1 else 0


def anheben(i, phase):
    """Bein hebt sich: 0 / 1 / 2 px, etwa ein Drittel der Periode (24 Frames), Fuß taucht dazwischen wieder ein."""
    s = math.sin(L.sinus(i, 24.0, phase))
    return 2 if s > 0.85 else (1 if s > 0.55 else 0)


def bein(a, k):
    return L.heben_unten(a, PAD_T + 16, k) if k else a


# ── Partikel: Wasserringe um die Füße ──────────────────────────────────────────────────────────────────────────────────
RING = {'c': (255, 255, 255), 'r': (190, 190, 190)}
PUFFS = [
    dict(x=px(5, 21)[0], y=px(5, 21)[1], vx=-5, vy=0, off=0, form='m', wackeln=0),
    dict(x=px(5, 21)[0], y=px(5, 21)[1], vx=-5, vy=0, off=24, form='m', wackeln=0),
    dict(x=px(14, 21)[0], y=px(14, 21)[1], vx=5, vy=0, off=12, form='m', wackeln=0),
    dict(x=px(14, 21)[0], y=px(14, 21)[1], vx=5, vy=0, off=36, form='m', wackeln=0),
]
TEST_EBENEN = ('koerper', 'hals', 'beine')                  # für den Randpixel-Test: ohne Partikel


def frame(i, partikel=True, nur=None):
    ebenen = nur if nur is not None else TEST_EBENEN
    if nur is not None:
        partikel = False
    n = atem(i)
    dy = hals_dy(i)
    schichten = []
    if 'beine' in ebenen:
        schichten += [(bein(BEIN_L, anheben(i, 0.0)), 0, 0, 3), (bein(BEIN_R, anheben(i, math.pi)), 0, 0, 3)]
    if 'koerper' in ebenen:
        z = PAD_T + 11
        schichten += [(L.streck_zeile(KOERPER, z, n), 0, 0, 1), (L.streck_zeile(SCHWANZ_W(i), z, n), 0, 0, 1)]
    if 'hals' in ebenen:
        sch = lambda a: B.spalten_schub(a, PAD_L + 18, lambda f: dy * min(1.0, f * 11 / 7.0), 11)   # Hals/Kopf senken: Spalten x 19–25 verformen den Bogen, Kopf und Schnabel (x ≥ 25) wandern starr um dy
        zu = 1 if schnabel_zu(i) else 0
        schichten += [(sch(HALS), 0, -n, 2), (sch(SPITZE_L), zu, -n, 2), (sch(SPITZE_R), -zu, -n, 2)]
    f, karte = B.zusammen_mit_karte(H, W, schichten)
    B.umriss_je_ebene(f, karte, ERLAUBT, EBENEN_FARBE)
    if partikel:
        f = L.zusammen(H, W, [(L.puff_ebene(H, W, i, N, PUFFS, RING), 0, 0), (f, 0, 0)])
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
