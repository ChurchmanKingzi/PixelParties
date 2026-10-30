# -*- coding: utf-8 -*-
"""Idle-Animation für „Royal Corgi“ (Creature).

Quelle: src/royal-corgi.png — Corgi mit Krone und Monokel (13×17 px, 23 Farben), zusammengesetzt aus MotiveBritain.xcf:
Ebene 213 „Ebene #27“ (Corgi, 12×17), Ebene 212 „Ebene #31“ (Krone, 6×3, bei (3,1)), Ebene 211 „Ebene #32“ (Monokel-Glas, 4×4, 80 % deckend,
bei (6,4)) und Ebene 210 „Ebene #33“ (weißes Glanzkreuz, 5×5, bei (8,3)).
PICK: [["MotiveBritain", 213, 1], ["MotiveBritain", 212, 1], ["MotiveBritain", 211, 1], ["MotiveBritain", 210, 1]]

Aufruf:   python3 royal_corgi.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/royal-corgi.png + .json

Identifikation (Sprite 13×17, Corgi von vorn, orange-weiß):
* Spitzohren (links x 0–2, rechts x 9–11, Zeilen 0–3): dunkler Umriss A, orangene Ohrfüllung, weißer Ohrbüschel (2,2) (9,2), rosa Ohrinneres (2,3) (9,3).
* Krone (Gold, Zeilen 1–3, x 3–8): drei Zacken — links (3,2) (3,3) (4,3), Mitte (5–6, 1–3) hellgelb, rechts (7,3) (8,3) (8,2); zwischen den Zacken
  bleibt der Hintergrund sichtbar ((4,2), (7,2)).
* Gesicht (Zeilen 4–8): orangene Stirn; Augenbrauen = zwei dunkelgraue Pixel (4,5) (7,5); Augen = je ein fast schwarzes Pixel (4,6) (7,6);
  schwarze Nase 2×2 (5–6, 7–8); weiße Schnauze; Mundlinie = schwarze Pixel (2,8) (9,8) und (3–4,9) (7–8,9) (lächelnder Mund, in der Mitte (5–6,9) die helle Kinnpartie).
* Monokel: türkiser Ring um (6–9, 4–7) mit hellem Glas innen (7–8, 5–6); es liegt über dem rechten Auge und der rechten Braue, die durch das Glas
  nur noch hell/matt durchscheinen ((7,5) (7,6)). Daran hängt das weiße Glanzkreuz (Arme (10,3–4) (10,6–7) (8–9,5) (11–12,5), Mitte = Kopfumriss (10,5)).
* Brust (Zeilen 10–13): weiß mit beigen Flecken (4,10) (7,10) (5–6,11); seitlich orange (Vorderbeine/Schultern) mit Umriss.
* Vorderbeine (links x 3–4, rechts x 7–8, Zeilen 14–15, Fußlinie Zeile 16); zwischen den Beinen der Innenumriss (5,13) (5–6,14) (5–6,15).
* Kein Schwanz im Bild, keine Zunge, kein Halsband — nichts davon erfunden, außer der ausdrücklich genannten Hecheln-Zugabe (siehe unten).
Bleibt fest: Gesicht (bis auf Auge/Braue links), Nase, Mundlinie (bis auf Hecheln), Monokelring, rechtes Auge unter dem Glas, Brust, Beine.

Ablauf (60 Frames à 65 ms = 3,9 s), alle Bewegungen unabhängig; der Kopf bleibt als Ganzes stehen, nur Augen blicken:
* Atmen zweistufig (Periode 30, 2× pro Schleife): erst hebt sich die Brust (Zeile 13 wird eingefügt, Frames 3–17), 3 Frames später der Kopf
  (Zeile 11 wird eingefügt, Frames 6–20): Kopf mit Krone, Monokel und Ohren steigt insgesamt 2 px, die Brust 1 px, die Füße bleiben am Boden.
* Spitzohren zucken: jedes Ohr 4× pro Schleife (links Frames 2/17/31/46, rechts 9/24/40/53, je 6 Frames): die Ohrspitze (Zeilen 0–1) schnippt 1 px nach
  außen und zurück, die Ohrbasis (Zeile 2) bleibt; der innere Umrisspixel der Zeile 1 bleibt zusätzlich stehen (Umriss geschlossen in jeder Pose).
* Blick: nur das linke Auge samt Braue wandert 1 px (Frames 12–19 nach rechts, 29–36 nach links, 47–53 nach rechts); das Auge hinter dem Monokel bleibt.
* Blinzeln: das linke Auge schließt sich 3 Frames lang in der umgebenden Fellfarbe (orange B) — bei 22, 41 und 57.
* Hecheln (Zugabe, 2× pro Schleife, Frames 20–33 und 46–59): die Kinnpartie (5–6,9) wird Mundschwarz, dazu erscheint die Zunge in Ohrrosa (5–6,10), im
  Wechsel zweimal drei Stufen (zu/offen/Zunge), je 2 Frames — beide Farben stehen schon im Sprite.
* Krone (Gold, Regel 12/14): ein Lichtband läuft diagonal über die Zacken (Frames 4–17 und 36–49, jedes Pixel 2 Frames eine Stufe heller), dazu blitzt je
  5 Frames lang ein kleiner Glitzerstern an der linken Zacke (Frame 24), der rechten Zacke (30) und der Kronenspitze (52).
* Monokel-Glanz: das weiße Glanzkreuz der Vorlage funkelt dreimal pro Schleife (Frames 58–3, 20–25, 42–47): Arme wachsen von 1 auf 2 px und schrumpfen
  wieder; dazwischen ist nur das Glas zu sehen.
* Pfoten tippen: linker Fuß in Frames 7–8, 26–27 und 49–50, rechter Fuß in 16–17, 36–37 und 56–57 (Zeile 14 des Fußes entfällt, die Fußlinie rückt 1 px hoch;
  die Innenumrisse zwischen den Beinen bleiben am Körper).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Ergänzungen: (1) Hecheln: (5,9) (6,9) in Mundschwarz F und (5,10) (6,10) in Ohrrosa M — vorhandene Farben, neue Pixelstellen; (2) die Pixel unter dem
Glanzkreuz, wenn dessen Arme eingezogen sind: (10,3) orange E, (10,4) Umriss A, (9,5) Ringfarbe S, (8,5) Glasglanz C — so sähe die Vorlage ohne Kreuz aus
(Ebenen 210/211 getrennt); (3) die Glitzersterne an der Krone (Pixel in Weißtönen der Quelle, L/G).
"""
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T

N, MS = 60, 65
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 5, 3

spr = L.lade('royal-corgi')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

ohr_l = vorhanden & (xx <= 2) & (yy <= 1)
ohr_r = vorhanden & (xx >= 9) & (yy <= 1) & (xx <= 11)
koerper = vorhanden & ~ohr_l & ~ohr_r

# Farben der Quelle
F_AUGE = (0, 2, 0)                      # Auge (links x 4)
F_BRAUE = (69, 69, 69)                  # Braue
FELL = (227, 128, 50)                   # B: Fell neben Auge/Braue (Lid und frei werdendes Pixel)
MUND = (32, 24, 0)                      # Nase/Mundlinie
ZUNGE = (255, 195, 198)                 # Ohrrosa
GOLD, GOLD_HELL, WEISS_G, WEISS_L = (255, 222, 90), (255, 246, 172), (255, 255, 255), (250, 246, 241)
ROT_ORANGE, UMRISS = (238, 142, 65), (109, 45, 3)
GLAS_GLANZ, RING = (254, 244, 220), (64, 194, 178)

AUGE_X = 4
KRONE = [(3, 2), (3, 3), (4, 3), (5, 1), (6, 1), (5, 2), (6, 2), (5, 3), (6, 3), (7, 3), (8, 3), (8, 2)]
# Glanzkreuz (Stufe 1 = innere Arme, Stufe 2 = äußere Arme); dazu, was ohne den Arm dort zu sehen ist (None = Hintergrund)
STERN_ARME = {1: [(10, 4), (10, 6), (9, 5), (11, 5)], 2: [(10, 3), (10, 7), (8, 5), (12, 5)]}
UNTER = {(10, 3): ROT_ORANGE, (10, 4): UMRISS, (10, 6): None, (10, 7): None, (9, 5): RING, (8, 5): GLAS_GLANZ, (11, 5): None, (12, 5): None}
# Kronen-Glitzersterne: Mitte, Arme (Hintergrund- oder Kronenpixel)
KRONENSTERN = {'links': ((3, 2), [(3, 1), (2, 2), (4, 2), (3, 3)]),
               'rechts': ((8, 2), [(8, 1), (7, 2), (9, 2), (8, 3)]),
               'spitze': ((5, 1), [(5, 0), (4, 1), (6, 1), (5, 2)])}

BEIN_Z = 13                             # hier wird beim Atmen (Brust) eine Zeile eingefügt
KOPF_Z = 11                             # und hier (Kopf)
FUSS_Z = 14


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                         # sofort auf die volle Leinwand


def muster(i, starts, pat):
    for s in starts:
        t = (i - s) % N
        if t < len(pat):
            return pat[t]
    return 0


PFOTE_L = (7, 8, 26, 27, 49, 50)
PFOTE_R = (16, 17, 36, 37, 56, 57)
PANT = (1, 1, 2, 2, 1, 1, 2, 2, 1, 1, 2, 2, 1, 1)
STERN_BLITZ = (1, 2, 2, 2, 2, 1)
KRONE_STERN = (1, 2, 2, 2, 1)


def zustand(i):
    a = 1 if (i % 30) in range(3, 18) else 0                       # Brust
    b = 1 if (i % 30) in range(6, 21) else 0                       # Kopf
    blick = 1 if 12 <= i < 20 else (-1 if 29 <= i < 37 else (1 if 47 <= i < 54 else 0))
    ohr_li = max(T.huellkurve(i, N, s, 6) for s in (2, 17, 31, 46))
    ohr_re = max(T.huellkurve(i, N, s, 6) for s in (9, 24, 40, 53))
    lid = muster(i, (22, 41, 57), (1, 1, 1))
    pant = muster(i, (20, 46), PANT)
    stern = muster(i, (58, 20, 42), STERN_BLITZ)
    band = -1
    for s in (4, 36):
        if 0 <= i - s < 14:
            band = (i - s) // 2
    ks = {n: muster(i, (s,), KRONE_STERN) for n, s in (('links', 24), ('rechts', 30), ('spitze', 52))}
    return a, b, blick, lid, pant, stern, band, ks, ohr_li, ohr_re, 1 if i in PFOTE_L else 0, 1 if i in PFOTE_R else 0


def setze(k, x, y, farbe):
    k[PAD_T + y, PAD_L + x, :3] = farbe
    k[PAD_T + y, PAD_L + x, 3] = 255


def loesche(k, x, y):
    k[PAD_T + y, PAD_L + x] = 0


def frame(i, nur=None):
    a, b, blick, lid, pant, stern, band, ks, ohr_li, ohr_re, tipp_l, tipp_r = zustand(i)
    k = teil(koerper)
    # Glanzkreuz am Monokel: Arme einziehen (Stufe 2 = äußere, Stufe 1 = innere Arme)
    for stufe in (2, 1):
        if stern < stufe:
            for (x, y) in STERN_ARME[stufe]:
                u = UNTER[(x, y)]
                if u is None:
                    loesche(k, x, y)
                else:
                    setze(k, x, y, u)
    # linkes Auge: Blick (Auge + Braue wandern 1 px) und Blinzeln (Lid = Fellfarbe)
    if blick:
        setze(k, AUGE_X, 5, FELL)
        setze(k, AUGE_X, 6, FELL)
        setze(k, AUGE_X + blick, 5, F_BRAUE)
        setze(k, AUGE_X + blick, 6, F_AUGE)
    if lid:
        setze(k, AUGE_X + blick, 6, FELL)
    # Hecheln
    if pant:
        setze(k, 5, 9, MUND)
        setze(k, 6, 9, MUND)
        if pant == 2:
            setze(k, 5, 10, ZUNGE)
            setze(k, 6, 10, ZUNGE)
    # Atmen in zwei Stufen: erst Kopf-Zeile (oben), dann Brust-Zeile; die Füße bleiben am Boden
    r = L.streck_zeile(k, PAD_T + KOPF_Z, b)
    r = L.streck_zeile(r, PAD_T + BEIN_Z, a)
    lift = a + b
    cols = np.arange(W)[None, :]
    fuss = (np.arange(H)[:, None] >= PAD_T + FUSS_Z) & (cols >= PAD_L + 2) & (cols <= PAD_L + 9)
    # die Innenumrisse zwischen den Beinen (x 5–6) bleiben am Körper
    fl, rest = L.trenne(r, fuss & (cols <= PAD_L + 4))
    fr_, rest = L.trenne(rest, fuss & (cols >= PAD_L + 7))
    fl = L.heben_unten(fl, PAD_T + FUSS_Z, tipp_l)
    fr_ = L.heben_unten(fr_, PAD_T + FUSS_Z, tipp_r)
    # Ohren: Spitze (Zeilen 0–1) schnippt 1 px nach außen, mit dem Atem-Hub
    ol = L.versetze(T.zucken_zeilen(teil(ohr_l), PAD_T + 2, -1.2 * ohr_li, {PAD_T + 0: 1.0, PAD_T + 1: 1.0}, innen='rechts'), 0, -lift)
    orr = L.versetze(T.zucken_zeilen(teil(ohr_r), PAD_T + 2, 1.2 * ohr_re, {PAD_T + 0: 1.0, PAD_T + 1: 1.0}, innen='links'), 0, -lift)
    ebenen = {'rumpf': rest, 'fuss_l': fl, 'fuss_r': fr_, 'ohr_l': ol, 'ohr_r': orr}
    wahl = nur or ('rumpf', 'fuss_l', 'fuss_r', 'ohr_l', 'ohr_r', 'glanz')
    f = L.zusammen(H, W, [(ebenen[n], 0, 0) for n in wahl if n in ebenen])
    if 'glanz' in wahl:
        f = glanz(f, band, ks, lift)
    return f


def glanz(f, band, ks, lift):
    """Krone: Lichtband + Glitzersterne (Gold, Regel 12/14). Liegt über dem Kopf und steigt mit ihm."""
    def px(x, y):
        return PAD_T + y - lift, PAD_L + x
    if band >= 0:
        for (x, y) in KRONE:
            if (x + (3 - y)) - 3 == band:
                yy_, xx_ = px(x, y)
                c = tuple(int(v) for v in f[yy_, xx_, :3])
                f[yy_, xx_, :3] = WEISS_L if c == GOLD_HELL else GOLD_HELL
    for name, st in ks.items():
        if not st:
            continue
        (cx, cy), arme = KRONENSTERN[name]
        yy_, xx_ = px(cx, cy)
        f[yy_, xx_, :3] = WEISS_G
        f[yy_, xx_, 3] = 255
        if st == 2:
            for (x, y) in arme:
                yy_, xx_ = px(x, y)
                f[yy_, xx_, :3] = WEISS_L
                f[yy_, xx_, 3] = 255
    return f


TEST_EBENEN = ['rumpf', 'fuss_l', 'fuss_r', 'ohr_l', 'ohr_r']


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('royal-corgi', 'Royal Corgi', frames, MS, prev)
    if prev:
        L.streifen(prev + '/royal-corgi-strip.png', frames, spalten=12, scale=8)
