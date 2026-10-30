# -*- coding: utf-8 -*-
"""Idle-Animation für „Classical Harpyformer“ (Creature) — graue Harpyie schwebt und spielt mit einem Bogen Geige; goldene Klangschnur und Funkelsterne.

PICK: [["Motive", 32, "Harpyie (Ebene „Harpyformer Band“, 20×27 px)"], ["Motive", 31, "rechte Flügelsichel („#5“)"], ["Motive", 30, "Geige (Ebene „#2“, nur x 203–228 der 229 px breiten Ebene)"], ["Motive", 29, "goldene Schnur + Ohrring + Fußschmuck (Ebene „#7“, ohne den Kachelblock rechts)"], ["Motive", 27, "Bogen („#4“)"], ["Motive", 26, "linke Flügelsichel („#1“)"], ["Motive", 25, "Funkelsterne („#6“)"]]
Quelle: Motive.xcf. Die sieben Ebenen heißen „Harpyformer Band …“ (die Karte hieß einmal so) und passen Pixel für Pixel zur Kartenkunst data/card-art/native/Classical_Harpyformer.png
(Abgleich Pixel für Pixel: 98 % der Spritepixel stehen in der Karte genauso — Kartenursprung = Motive (283, 220); die restlichen 2 % sind verdeckt oder Kartenhintergrund). Sie wurden mit ihren
Ebenen-Versätzen auf eine gemeinsame 42×46-Leinwand gelegt (Ursprung Motive (307, 219); die Geigenspitze liegt in der Karte um 1 Zeile angeschnitten, die Ebene ist vollständig). Es liegen vor:
  src/classical-harpyformer.png           Gesamtbild (Ruhepose, Referenz für den Randpixel-Test)
  src/classical-harpyformer-harpyie.png   Harpyie (Haare, Gesicht, Körper, verdeckte Teile, Beine)
  src/classical-harpyformer-fluegel-l.png linke Flügelsichel (vor Gesicht und Brust)
  src/classical-harpyformer-fluegel-r.png rechte Flügelsichel (hinter der Geige, ragt rechts daneben heraus)
  src/classical-harpyformer-geige.png     Geige mit Hals und Saiten
  src/classical-harpyformer-bogen.png     Bogen
  src/classical-harpyformer-gold.png      goldene Schnur, Ohrring, Fußring und Krallenspitzen
  src/classical-harpyformer-sterne.png    13 Funkelsterne
Nicht verwendet: der rote Kachelblock am rechten Rand der Ebene „#7“ (Teil des Kartenhintergrunds), die Kachelmuster der Karte und die Ebene „Harpyformer Band #3“ (Motive 28, Feder/Pfeil
am Schopf, 19 px): sie steht NICHT in der Kartenkunst (dort endet der Schopf als dunkelgraue Spitze) und gehört zu einer anderen Harpyformer-Karte oder ist ungenutzt.

Aufruf:   python3 classical_harpyformer.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/classical-harpyformer.png + .json

Identifikation (Sprite-Koordinaten x, y):
* Harpyie (x 3–22, y 18–44), blickt nach rechts zur Geige: graue Haare (Umrisse (75,70,51) (49,24,0), Töne (91,86,67) (157,150,132) (172,169,152) (207,200,184)) mit spitzem Haarschopf oben
  (x 13–17, y 18–21), links lange Strähnen bis y 40. Gesicht x 9–14, y 28–36: Hautfarbe (246,205,139) (246,189,123), Wange (238,156,123), Nasenglanz (255,230,213); y 28 sind Brauen/Pony
  (schwarz), die Augen sind schwarze Striche (10,30) (11,30) (14,30). Roter Schal (141,40,30) (188,54,43) auf der Brust (y 36–39); Röckchen/Beine braun-orange, Füße x 4–17, y 41–44 mit
  Krallen. Hinter der Geige liegen (verdeckt, vollständig gezeichnet): ein grüner Umhang/Flügelteil (x 15–22, y 26–40), ein hell-blauer Flügelrand (x 19–23, y 24–37) und ein oranger Körperblock.
* Linke Flügelsichel (x 8–16, y 25–36): helle Feder (246,255,255) (222,255,255) mit blauen Schatten (139,213,255) (106,197,255), sie liegt wie ein Arm schräg vor Gesicht und Brust.
  Rechte Flügelsichel (x 21–28, y 26–37): dasselbe Stück, größtenteils hinter der Geige; zu sehen ist nur der Rand rechts davon (x 27–28, y 30–35).
* Geige (x 14–38, y 0–45): braune Decke (123,69,0) (160,90,0) (193,108,0), langer Hals schräg nach oben rechts (schwarz mit beigen Saiten (202,183,140) (147,133,104)), Schnecke oben
  rechts (x 33–37, y 0–5). Der Bogen (x 12–26, y 20–34): schwarzer Stab mit weißem Rand und beigem Haar, liegt schräg über der Geige.
* Goldene Schnur (x 31–39, y 3–41): geflochtene Schnur (154,94,10) (253,237,88) (254,253,151), hängt von der Geigenschnecke herab (oben 3 px breit, unten 8 px) — „Klangschnur“.
  Ohrring (x 4–6, y 30–33), Fußring um das linke Bein (x 7–10, y 40–42) und drei Krallenspitzen (5,44) (8,44) (14,44) sind ebenfalls Gold (gleiche Ebene).
* 13 weiße Funkelsterne in drei Wuchsstufen (wie bei Ballad Harpyformer): Raute (4 px) bei (31,11) (37,16) (40,24) (7,29) (32,36) (39,40) (11,42); X (5 px) bei (38,6) (30,20) (40,29) (1,35)
  (32,42); großes Plus (8 px) bei (35,26). Sie schweben um die Geige.

Ablauf (48 Frames à 65 ms = 3,12 s); Frame 0 = Ruhepose = Original. Sie SCHWEBT (Flieger):
* Flügelschlag, durchgehend: ein Schlag = 12 Frames (780 ms), 4 pro Schleife; Abschlag 5 Frames. Beide Flügelsicheln schwingen — jede Spalte wandert als Ganzes senkrecht (Federtextur bleibt, nichts
  wird kopiert), Betrag wächst mit dem Abstand zum Ansatz (links x 8, rechts x 21), links bis 3 px, rechts bis 3 px nach unten, die Spitzen hinken 1 Frame nach, rechts 0,35 Frame später.
* Schwebe-Bob: Harpyie samt Geige, Bogen, Schnur und Flügeln hebt sich im Takt bis 2 px (am höchsten in der Schlagmitte); die Füße baumeln nach (60 %, 1,5 Frames verzögert, die Lücke
  füllen doppelte Beinzeilen; der Fußring wandert mit den Füßen).
* Bogenstrich: der Bogen gleitet in seiner eigenen Richtung (x+, y−) hin und her, ±2 px, Periode 16 Frames (drei Striche pro Schleife — gegen den Flügelschlag versetzt).
* Saiten (Metall): bei jedem Strich läuft ein Lichtband über die Saitenpixel des Halses (beige → heller → weiß), abwechselnd abwärts/aufwärts (Frames 2–11, 18–27, 34–43).
* Goldene Schnur (Gold): hängt von der Schnecke und pendelt als Welle (Periode 24 Frames, Ausschlag unten bis 2 px, die Spitze hinkt nach); zusätzlich läuft zweimal pro Schleife ein Lichtband
  aufwärts über die Schnur (Frames 3–20 und 27–44, eine Stufe heller auf der Goldrampe).
* Haare schwingen: die Strähnen links (y 32–40) pendeln mit wachsendem Abstand bis 2 px (Periode 16 Frames); das innere Ende bleibt am Körper (Pixel werden verdoppelt/ausgelassen).
* Blinzeln: Frames 19–21 und 41–42, Lid = Haut-/Wangenfarbe der Nachbarpixel.
* Ohrring (Gold): zweimal pro Schleife blitzt ein kleiner Glitzerstern auf (Frames 6–8 und 30–32).
* Funkelsterne: jeder wächst und vergeht in 24 Frames (Raute → X → Plus → X → Raute → aus), zwei Mal pro Schleife, je Stern in eigener Phase; Frame 0 = Stufe der Karte.
  (Wie bei Ballad: schwebende Musik-Funken der Kunst; falls unerwünscht STERNE_AN = False.)
* Fest bleiben: Gesicht (außer Blinzeln) und Schopf (wippen nur mit dem Körper), die Geigendecke (Holz, kein Glanz).

Ergänzungen: keine nötig — die Ebenen sind vollständig (Geige unter dem Bogen, Gesicht unter der Flügelsichel, Körper unter der Geige).
Randpixel-Test (Regel 16): `B.umriss_je_ebene` setzt Randpixel in Nicht-Umrissfarbe auf die Umrissfarbe der Ebene.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError, wenn etwas herausragen würde). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger as F
import anim_flieger_b as B

N, MS = 48, 65
BEAT, DOWN = 12, 5                                         # Frames je Flügelschlag, davon Abschlag
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 4, 2                    # links/rechts: Randsterne wachsen 1 px über das Bild; oben: Hub 2 px + Rand 2
STERNE_AN = True

spr = L.lade('classical-harpyformer')                      # Gesamtbild (Ruhepose / Referenz für den Randpixel-Test)
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]


def teil(name, maske=None):
    a = L.lade('classical-harpyformer-' + name)
    if maske is not None:
        a = np.where(maske[..., None], a, 0).astype(np.uint8)
    return L.platz(a, H, W, PAD_L, PAD_T)


def px(x, y):
    return PAD_L + x, PAD_T + y


# ── Teile auf die volle Leinwand legen (Regel 3) ───────────────────────────────────────────────────────────────────
CUT = 41                                                   # ab dieser Zeile beginnen die Füße (Beine mit Krallen)
GOLD = L.lade('classical-harpyformer-gold')
_harpyie = L.lade('classical-harpyformer-harpyie')
# Ergänzung (verdeckte Pixel): ein grüner Streifen des Umhangs (x 15–16, y 26–33) liegt unter der linken Flügelsichel; er würde beim Schlagen als grüne Punkte aufblitzen.
# Er bekommt die Umrissfarbe der Nachbarpixel (49,24,0) — in Frame 0 bleibt er verdeckt (Ruhepose = Original).
_gruen = (_harpyie[..., 3] > 0) & (_harpyie[..., 1].astype(int) > _harpyie[..., 0].astype(int) + 40) & (xx <= 16) & (yy <= 35)
ERGAENZT = [(int(x), int(y)) for y, x in zip(*np.nonzero(_gruen))]
_harpyie[_gruen, :3] = (49, 24, 0)
KOERPER = L.platz(np.where((yy < CUT)[..., None], _harpyie, 0).astype(np.uint8), H, W, PAD_L, PAD_T)
FUESSE = L.platz(np.where((yy >= CUT)[..., None], _harpyie, 0).astype(np.uint8), H, W, PAD_L, PAD_T)
FL_L = teil('fluegel-l')
FL_R = teil('fluegel-r')
GEIGE = teil('geige')
BOGEN = teil('bogen')
STRANG = teil('gold', xx >= 28)
OHRRING = teil('gold', (xx <= 8) & (yy <= 35))
FUSSGOLD = teil('gold', (xx <= 20) & (yy >= 40))           # Fußring (y 40–42) + Krallenspitzen: wandern mit den Füßen

# ── Farben (alle aus dem Sprite) ───────────────────────────────────────────────────────────────────────────────────
HAUT_L, HAUT_O, WANGE = (246, 189, 123), (246, 205, 139), (238, 156, 123)
AUGEN = {(10, 30): HAUT_L, (11, 30): HAUT_O, (14, 30): WANGE}            # Augenpixel → Lid (Farbe der Nachbarpixel)
SAITEN_RAMPE = [(147, 133, 104), (202, 183, 140), (255, 255, 255)]
GOLD_RAMPE = [(154, 94, 10), (253, 237, 88), (254, 253, 151)]
STERN_WEISS = (255, 255, 255)
M_SAITEN = L.farbmaske(L.lade('classical-harpyformer-geige'), SAITEN_RAMPE[:2])
M_STRANG = L.farbmaske(L.lade('classical-harpyformer-gold'), GOLD_RAMPE) & (xx >= 28)
# Umrissfarbe je Ebene für die Randpixel-Reparatur (Regel 16) und erlaubte Randfarben (= Randfarben der Quelle, siehe randtest)
UMRISS = {1: (75, 70, 51), 2: (49, 24, 0), 3: (246, 255, 255), 4: (38, 19, 9), 5: (246, 255, 255), 6: (0, 0, 0), 7: (154, 94, 10), 8: (154, 94, 10)}   # 1 Körper, 2 Füße, 3/5 Flügel, 4 Geige, 6 Bogen, 7 Schnur, 8 Gold
_m = spr[..., 3] > 0
_p = np.pad(_m, 1)
_kante = _m & (~_p[:-2, 1:-1] | ~_p[2:, 1:-1] | ~_p[1:-1, :-2] | ~_p[1:-1, 2:])
ERLAUBT = {tuple(int(v) for v in spr[y, x, :3]) for y, x in zip(*np.nonzero(_kante))}


# ── Flügel schlagen ─────────────────────────────────────────────────────────────────────────────────────────────────
POT, LAG = 1.15, 1.0
A_L, A_R = 3.0, 3.0
X_L, MAXD_L = 8, 8                                         # linke Sichel x 8–16: Ansatz links
X_R, MAXD_R = 21, 7                                        # rechte Sichel x 21–28


def welle(t):
    """Schlagphase 0 (Spitze oben = Original) … 1 (unten): Abschlag in DOWN Frames, Aufschlag in BEAT − DOWN Frames; an den Wendepunkten weich."""
    u = t % BEAT
    if u < DOWN:
        return 0.5 - 0.5 * math.cos(math.pi * u / DOWN)
    return 0.5 + 0.5 * math.cos(math.pi * (u - DOWN) / (BEAT - DOWN))


def dy_fn(t, amp, versatz=0.0):
    """Spaltenverschiebung als Funktion des Abstandsanteils f; Frame 0 = Original."""
    def dy(f):
        return amp * (welle(t - versatz - LAG * f) - welle(-versatz - LAG * f)) * f ** POT
    return dy


# ── Schwebe-Bob, Füße, Bogen, Haare, Blinzeln ──────────────────────────────────────────────────────────────────────
BOB_AMP = 1.0


def hub(t):
    """Anhebung in px (0 = Original), am höchsten in der Schlagmitte."""
    return int(round(BOB_AMP * (1.0 - math.cos(2 * math.pi * t / BEAT))))


def fuss_hub(t):
    """Füße baumeln nach: 1,5 Frames verzögert, zu 60 % (nie höher als der Körper)."""
    return min(hub(t), int(round(0.6 * hub(t - 1.5))))


BOGEN_PERIODE, BOGEN_AMP = 16.0, 2.2


def bogen_s(t):
    return int(round(BOGEN_AMP * math.sin(2 * math.pi * t / BOGEN_PERIODE)))


HAAR_Y0, HAAR_Y1 = PAD_T + 32, PAD_T + 40
HAAR_INNEN = {PAD_T + 32: PAD_L + 10, PAD_T + 33: PAD_L + 10, PAD_T + 34: PAD_L + 9, PAD_T + 35: PAD_L + 8, PAD_T + 36: PAD_L + 8,
              PAD_T + 37: PAD_L + 8, PAD_T + 38: PAD_L + 7, PAD_T + 39: PAD_L + 7, PAD_T + 40: PAD_L + 6}
HAAR_AMP, HAAR_PERIODE = 2.0, 16.0


def haar_dx(t):
    s = math.sin(2 * math.pi * t / HAAR_PERIODE)

    def dx(y):
        d = -HAAR_AMP * s * (((y - HAAR_Y0) / (HAAR_Y1 - HAAR_Y0)) ** 1.2)
        breite = HAAR_INNEN[y] - (PAD_L + 3)               # Haarstück beginnt bei x 3 (Sprite); mindestens 2 px müssen übrig bleiben
        return min(d, breite - 2)
    return dx


def blinzeln(i):
    return (19 <= i <= 21) or (41 <= i <= 42)


# ── Funkelsterne ─────────────────────────────────────────────────────────────────────────────────────────────────────
FOLGE = [1, 1, 2, 2, 3, 3, 3, 3, 3, 2, 2, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]       # eine Periode (24 Frames): aufblühen und vergehen
STERNE = [((31, 11), 1, 11), ((37, 16), 1, 13), ((40, 24), 1, 0), ((7, 29), 1, 12), ((32, 36), 1, 1), ((39, 40), 1, 11), ((11, 42), 1, 0),
          ((38, 6), 2, 3), ((30, 20), 2, 10), ((40, 29), 2, 2), ((1, 35), 2, 9), ((32, 42), 2, 10),
          ((35, 26), 3, 6)]


def sterne_ebene(i):
    e = L.leer(H, W)
    for (mx, my), form, k0 in STERNE:
        st = B.funkel_stufe(i, len(FOLGE), k0, FOLGE)
        if st:
            B.funkel_stern(e, PAD_L + mx, PAD_T + my, st, STERN_WEISS)
    return e


TEST_EBENEN = ('figur',)                                    # für den Randpixel-Test: ohne Sterne


def frame(i, partikel=True, nur=None):
    ebenen = nur if nur is not None else TEST_EBENEN
    if nur is not None:
        partikel = False
    n, k = hub(i), fuss_hub(i)
    schichten = []
    if 'figur' in ebenen:
        # Körper: Haare schwingen, Blinzeln (Lid = Hautfarbe), dann um n heben
        koerper = B.zeilen_dehnen_aussen(KOERPER, HAAR_Y0, HAAR_Y1, HAAR_INNEN, haar_dx(i))
        if blinzeln(i):
            koerper = koerper.copy()
            for (x, y), c in AUGEN.items():
                koerper[PAD_T + y, PAD_L + x, :3] = c
        # Füße: Lücke zum Körper füllen doppelte oberste Beinzeile
        fuesse, fussgold = FUESSE, FUSSGOLD
        luecke = n - k
        if luecke > 0:
            fuesse = L.streck_zeile(fuesse, PAD_T + CUT, luecke)          # nur die Beine strecken; der Fußring behält seine Höhe
        # Flügelsicheln schlagen (Spalten als Ganzes)
        fl_l = B.spalten_schub(FL_L, PAD_L + X_L, dy_fn(i, A_L), MAXD_L)
        fl_r = B.spalten_schub(FL_R, PAD_L + X_R, dy_fn(i, A_R, 0.35), MAXD_R)
        # Bogen gleitet in seiner Richtung
        s = bogen_s(i)
        # Geige: Saiten bekommen ein Lichtband bei jedem Strich (abwechselnd abwärts/aufwärts)
        geige = GEIGE.copy()
        for start, achse in ((2, (1.0, 2.0)), (18, (-1.0, -2.0)), (34, (1.0, 2.0))):
            F.lichtband(geige, M_SAITEN, PAD_L, PAD_T, i, N, start, 10, SAITEN_RAMPE, stufen=1, breite=3.0, achse=achse, kern_stufen=2)
        # Goldene Schnur: Lichtband aufwärts, dann als hängende Welle pendeln
        strang = STRANG.copy()
        for start in (3, 27):
            F.lichtband(strang, M_STRANG, PAD_L, PAD_T, i, N, start, 18, GOLD_RAMPE, stufen=1, breite=2.4, achse=(0.7, -1.0))
        strang = F.zeilen_pendel(strang, PAD_T + 3, 2.0, L.sinus(i, 24.0), potenz=1.2, lauf=1.2)
        # Ohrring: Glitzerstern (Gold)
        ohr = OHRRING.copy()
        st = F.stern_stufe(i, N, 6, (0, 1, 0))
        if st is None:
            st = F.stern_stufe(i, N, 30, (0, 1, 0))
        schichten += [(koerper, 0, -n, 1), (fuesse, 0, -k, 2), (fussgold, 0, -k, 8),
                      (fl_r, 0, -n, 3), (geige, 0, -n, 4), (strang, 0, -n, 7), (ohr, 0, -n, 8),
                      (BOGEN, s, -n - s, 6), (fl_l, 0, -n, 5)]
    f, karte = B.zusammen_mit_karte(H, W, schichten)
    if 'figur' in ebenen:
        if st is not None and st >= 1:
            F.stern(f, PAD_L + 5, PAD_T + 31 - n, st, (255, 255, 255), (254, 253, 151))
    B.umriss_je_ebene(f, karte, ERLAUBT, UMRISS)
    if partikel and STERNE_AN:
        f = L.zusammen(H, W, [(f, 0, 0), (sterne_ebene(i), 0, 0)])
    return f


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    teile = ('harpyie', 'fluegel-l', 'fluegel-r', 'geige', 'bogen', 'gold', 'sterne')
    quelle = np.concatenate([spr.reshape(-1, 4)] + [L.lade('classical-harpyformer-' + t).reshape(-1, 4) for t in teile])        # alle Ebenen (auch Verdecktes)
    n = L.pruefe(frames, quelle=quelle)
    print('Pixel je Frame:', n)
    L.speichern('classical-harpyformer', 'Classical Harpyformer', frames, MS, prev)
    if prev:
        L.streifen(prev + '/classical-harpyformer-strip.png', frames, spalten=8, scale=4)
