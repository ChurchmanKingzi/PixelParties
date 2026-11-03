# -*- coding: utf-8 -*-
"""Idle-Animation für „Cute Spider“ (Creature) — Runde 3 überarbeitet.

Nutzerfeedback Runde 3: „Cute Spider: fehlt auch der Körper, ich sehe nur die Flügel (die noch nicht wirklich nach Fliegen aussehen) und die Herz-Augen.“

Quelle (neu): drei Ebenen aus MotiveGN.xcf, zusammengesetzt wie auf der Karte (Abgleich mit data/card-art/native/Cute_Spider.png: 0 von 297 Pixeln weichen ab):
PICK: [["MotiveGN", 279, "ganze Ebene"], ["MotiveGN", 278, "ganze Ebene"], ["MotiveGN", 277, "ganze Ebene"]]
  src/cute-spider-fluegel.png   Ebene 279 „Ebene #310“ (21×20): das Engelsflügelpaar (liegt ganz hinten)
  src/cute-spider-koerper.png   Ebene 278 „Ebene #308“ (17×13): DIE SPINNE — schwarz/grauer Körper mit acht Beinen und roten Augen (255,2,0), liegt ÜBER den Flügeln, UNTER den Herzen
                                (in Runde 2 fehlte diese Ebene, deshalb sah man nur Flügel und Herz-Augen). Sprite-Versatz (2,7).
  src/cute-spider-herzen.png    Ebene 277 „Ebene #309“ (7×6): die rosa Herz-Augen, ganz oben; Sprite-Versatz (7,8). Sie verdecken die echten roten Augen der Spinne (7,5)/(9,5) der Körperebene.
  src/cute-spider.png           alle drei übereinander (21×20 px, 12 Farben)
Aufruf:   python3 cute_spider.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/cute-spider.png + .json  (Frame auf die Figur zugeschnitten)

Identifikation (Sprite 21×20, symmetrisch um x = 10, Flügel-Koordinaten = Ebenen-Koordinaten):
* Zwei Engelsflügel (links x 0–9, rechts x 11–20): Federfläche weiß (246,255,255)/hellblau (172,213,255), lila Ränder (153,102,255)/(153,153,255), dunkler Umriss (41,41,41); Spitzen oben bei (3–4,0) /
  (16–17,0), unten laufen sie in Federspitzen aus. Das Pixel (10,7) zwischen den inneren Flügelrändern ist ein dunkler Verbindungspixel (bleibt fest am Körper).
* Spinne (über den Flügeln): Körperkern (x 5–11, Zeilen 8–13 des Sprites: dunkelgrau (31,32,30)/(40,41,39) mit den roten Augen), dazu acht dünne Beine aus schwarzen (0,0,0) und grauen (31,32,30)/(40,41,39)/
  (65,66,64) Pixeln, die als Diagonalen nach links unten bzw. rechts unten laufen und über die weißen Flügel ragen (schwarz auf Weiß).
* Herz-Augen: je Seite zwei rosa Herzen aus (255,133,255)/(255,94,255)/(255,198,255) mit dunklen Pupillenpixeln.
* Kein Metall/Edelstein → kein Glanz (Regel 14). Das Wesen fliegt (Schatten unter ihm auf der Karte) — Schweben ist erlaubt.

Ablauf (48 Frames à 70 ms = 3,36 s), Frame 0 = Original:
* Flügelschlag (Periode 8 Frames, 6× pro Schleife, Abschlag schneller als Aufschlag): jeder Flügel dreht sich als Ganzes um einen Drehpunkt an seiner Innenseite (links (7,14), rechts (13,14), Nächster-Nachbar,
  Kanten geglättet): Aufschlag ≈ +15° (die Spitzen neigen sich zueinander, die Flügel stehen steil), Abschlag ≈ −40° (die Flügel breiten sich weit zu einem flachen „V“ aus, die Federspitzen unten schwingen mit) —
  vorher nur ±3 px Zeilenverschiebung. Beide Flügel schlagen gleichzeitig (gespiegelt); die Flügel liegen hinter der Spinne, ihr Innenrand bleibt unter Herzen und Körper (kein Spalt zur Spinne).
* Körper hebt/senkt sich im Takt (hinkt dem Flügel 2 Frames hinterher): beim Abschlag steigt die Spinne bis 2 px, beim Aufschlag sinkt sie.
* Beine: pendeln locker unter dem Körper (hängen herab, schwingen mit dem Schlag nach, Phase 1,4 rad hinter dem Flügel; Fußspitzen ±2 px waagerecht, 1 px senkrecht, Pfade Wurzel → Fuß, Gelenke
  dazwischen mit 8er-Linie verbunden, die Wurzeln bleiben am Körperkern).
* Herz-Augen und Körperkern bleiben fest (keine Farbspiele in den Augen, Regel 21).
Ergänzungen: keine gemalten Pixel. Dort, wo die Drehung Füllfarbe an eine freie Außenkante legt, wird der Randpixel in den Flügelumriss (41,41,41) bzw. (153,102,255) gesetzt (F.umranden).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle. Keine Partikel.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger as F
import anim_spinne as SP

N, MS = 48, 70
PAD_L, PAD_R, PAD_T, PAD_B = 10, 10, 8, 8

spr = L.lade('cute-spider')
fl_src = L.lade('cute-spider-fluegel')
sp_src = L.lade('cute-spider-koerper')
he_src = L.lade('cute-spider-herzen')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
SP_OFF, HE_OFF = (2, 7), (7, 8)
yy, xx = np.mgrid[0:sh, 0:sw]
_komp = L.zusammen(sh, sw, [(L.platz(fl_src, sh, sw), 0, 0), (L.platz(sp_src, sh, sw, *SP_OFF), 0, 0), (L.platz(he_src, sh, sw, *HE_OFF), 0, 0)])
assert (_komp == spr).all(), 'Zusammensetzung weicht von src/cute-spider.png ab'

SPINE = [(10, 7)]
fl_l_m = L.deckend(fl_src) & (xx <= 9) & ~np.isin(xx * 100 + yy, [x * 100 + y for x, y in SPINE])
fl_r_m = L.deckend(fl_src) & (xx >= 11)
FL_L = L.platz(L.trenne(fl_src, fl_l_m)[0], H, W, PAD_L, PAD_T)
FL_R = L.platz(L.trenne(fl_src, fl_r_m)[0], H, W, PAD_L, PAD_T)
SPINE_L = L.leer(sh, sw)
for _x, _y in SPINE:
    SPINE_L[_y, _x] = fl_src[_y, _x]
SPINE_L = L.platz(SPINE_L, H, W, PAD_L, PAD_T)
HERZEN = L.platz(he_src, H, W, PAD_L + HE_OFF[0], PAD_T + HE_OFF[1])
PIV_L, PIV_R = (7, 14), (13, 14)
UMRISS = (41, 41, 41)
UMRISS_FARBEN = F.umriss_farben(fl_src)
RAND_LILA = (153, 102, 255)

# ── Spinne: Körperkern fest, Beine als Pfade ──────────────────────────────────────────────────────────────────────────────────────────────────
sp_vor = L.deckend(sp_src)
sy, sx = np.mgrid[0:sp_src.shape[0], 0:sp_src.shape[1]]
kern_m = sp_vor & (sy <= 6) & (sx >= 4) & (sx <= 12)                                 # Körperkern (Beinansätze liegen außen bzw. ab Zeile 7)
# Beine = Pixel außerhalb des Kerns; der Kern behält alles, was von Herzen/Körperfläche verdeckt oder mittig ist
bein_m = sp_vor & ~kern_m
BEINE = SP.zerlege_beine(sp_src, bein_m, kern_m, mitte_x=8)


def spinne_ebene(i, wirkung):
    k, _ = L.trenne(sp_src, kern_m)
    ebene = L.platz(k, H, W, PAD_L + SP_OFF[0], PAD_T + SP_OFF[1])
    for b in BEINE:
        SP.zeichne_bein(ebene, b, wirkung, PAD_L + SP_OFF[0], PAD_T + SP_OFF[1])
    return ebene


def _f(i):
    """Flügelwinkel (Grad, positiv = Spitzen neigen sich nach innen, negativ = Flügel breiten sich aus). Abschlag schneller als Aufschlag."""
    ph = L.sinus(i, 8) + PH0
    ph2 = ph + 0.3 * math.sin(ph)
    return -10.0 + 28.0 * math.sin(ph2)


PH0 = math.asin(10.0 / 28.0)
THETA0 = _f(0)


def theta(i):
    return _f(i) - THETA0                                       # Frame 0: genau 0° (Ruhepose = Original)


def flap_wirkung(i):
    """Beinversatz (Knoten → (dx, dy)): Fußspitzen schwingen hinter dem Flügelschlag her; bei i = 0 ist der Versatz 0."""
    ph = L.sinus(i, 8) - 1.4
    ph0 = L.sinus(0, 8) - 1.4

    def f(n):
        an = n['anteil']
        v = math.sin(ph - 0.8 * an) - math.sin(ph0 - 0.8 * an)
        sgn = -1 if n['x'] < 8 else 1                             # linke Beine nach links, rechte nach rechts (spreizen beim Abschlag)
        return round(sgn * 1.0 * an * v), round(0.5 * an * v)
    return f


def frame(i, nur=None):
    th = math.radians(theta(i))
    wl = F.drehen(FL_L, PAD_L + PIV_L[0], PAD_T + PIV_L[1], th, glatt=True)
    wr = F.drehen(FL_R, PAD_L + PIV_R[0], PAD_T + PIV_R[1], -th, glatt=True)
    # Körper hebt/senkt sich (hinkt dem Flügel 2 Frames hinterher): beim Abschlag (th < 0) steigt er
    dy = int(round(1.3 * (theta(i - 2) - theta(-2)) / 40.0))
    sp_e = spinne_ebene(i, flap_wirkung(i))
    ebenen = {'fl_l': (wl, 0, 0), 'fl_r': (wr, 0, 0), 'spine': (SPINE_L, 0, dy), 'spinne': (sp_e, 0, dy), 'herzen': (HERZEN, 0, dy)}
    wahl = nur or ('fl_l', 'fl_r', 'spine', 'spinne', 'herzen')
    f = L.zusammen(H, W, [ebenen[n] for n in wahl])
    # Randpixel-Test (Regel 16): Füllfarbe an einer freien Flügelkante → Umrissfarbe
    F.umranden(f, [wl, wr], UMRISS_FARBEN, UMRISS, UMRISS, UMRISS)
    return f


def zuschneiden(frames):
    a = np.stack([f[..., 3] > 0 for f in frames]).any(axis=0)
    ys, xs = np.nonzero(a)
    x0, x1, y0, y1 = int(xs.min()) - 2, int(xs.max()) + 2, int(ys.min()) - 2, int(ys.max()) + 2
    return [f[y0:y1 + 1, x0:x1 + 1].copy() for f in frames]


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    assert (frames[0][PAD_T:PAD_T + sh, PAD_L:PAD_L + sw] == spr).all(), 'Frame 0 ist nicht das Original'
    print('Flügelwinkel min/max:', round(min(theta(i) for i in range(N)), 1), round(max(theta(i) for i in range(N)), 1))
    frames = zuschneiden(frames)
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('cute-spider', 'Cute Spider', frames, MS, prev)
    if prev:
        L.streifen(prev + '/cute-spider-strip.png', frames, spalten=12, scale=8)
