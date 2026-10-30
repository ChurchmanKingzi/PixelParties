# -*- coding: utf-8 -*-
"""Idle-Animation für „Ballad Harpyformer“ (Creature) — blonde Harpyie sitzt auf einem eisernen Stuhl und zupft mit dem Flügel eine goldene Harfe.

PICK: [["MotiveIndia", 254, "Harpyie (Ebene „Ballad Harpyformer #4“, 16×23 px)"], ["MotiveIndia", 255, "Stuhl + Harfe (Ebene „#5“, 39×33 px)"], ["MotiveIndia", 253, "Funkelsterne (Ebene „Ballad Harpyformer“, 31×42 px)"]]
Quelle: MotiveIndia.xcf — die drei Ebenen liegen auf der Karte 1:1 übereinander (oben die Sterne, dann die Harpyie, unten Stuhl + Harfe) und wurden mit ihren
Ebenen-Versätzen auf eine gemeinsame 45×42-Leinwand gelegt (Alpha ist in allen drei Ebenen schon 0/255). Sie liegen als
  src/ballad-harpyformer.png            Gesamtbild (Ruhepose, Referenz für den Randpixel-Test)
  src/ballad-harpyformer-harfe.png      Stuhl + Harfe (vollständig, auch der von der Harpyie verdeckte Teil — die Ebene enthält Stuhllehne, Sitz und die ganze Harfe)
  src/ballad-harpyformer-harpyie.png    Harpyie (Haare, Gesicht, Flügel, Füße)
  src/ballad-harpyformer-sterne.png     die zehn weißen Funkelsterne
vor. Die Bühne (Vorhang, Boden) der Karte ist Hintergrund und nicht Teil der Figur.

Aufruf:   python3 ballad_harpyformer.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/ballad-harpyformer.png + .json

Identifikation (Sprite-Koordinaten x, y):
* Harpyie (x 3–18, y 7–29), blickt nach rechts zur Harfe: goldblonde Haare (Umriss (49,24,0), Töne (255,246,172) (255,222,90) (255,180,24) (230,131,16)) umrahmen das
  Gesicht und fallen links lang herab (x 3–8, y 13–24, unten spitz bis y 24). Gesicht x 10–14, y 13–18: Hautfarbe (246,205,139), Wangen (238,156,123), Nasenglanz (255,230,213);
  Augen sind schwarze Striche (11,15) (12,15) und (14,15). Unter dem Kinn (y 19–23) liegt der Flügel, den sie wie einen Arm nach vorn hält: hell-blau-weiße Federn
  (246,255,255) (222,255,255) (180,246,255), Schattentöne (106,197,255) an der Wurzel (x 8–10, y 20–22); die Spitze zeigt schräg nach oben rechts bis (18,16) und liegt
  vor den ersten Saiten. Ein zweiter Flügel ist nicht zu sehen (er steckt hinter dem Haar). Füße (x 3–12, y 25–29): zwei braune Krallenfüße mit weißen Krallenspitzen
  (4,27) (8,29) (11,29), sie stehen auf dem Sitzkissen.
* Stuhl (x 0–15, y 5–37): eiserne Lehne mit Zierspitze (x 5–9, y 5–10), rotes Polster (x 3–13, y 17–31), Sitzbrett (y 32–34), Beine (y 35–37). Dunkelgrau (46,61,70) (127,146,160),
  Lichter (169,178,190) und Weiß; Polster (192,63,66) (149,47,49) (112,44,51) (76,24,24).
* Harfe (x 14–38, y 7–37): goldener Rahmen (Töne (238,100,40) (242,154,62) (250,213,74) (247,247,173)), oben der Wirbelkasten mit hellblauen Stimmwirbeln (22–30, 9–10) und der
  Schnecke rechts (x 33–38, y 7–13), unten der breite Fuß (y 33–37). Dazwischen elf Saiten (x 17–29, y 11–31), je ein Pixel breit und abwechselnd hell (203,219,252) /
  grau (155,173,183) in kurzen Abschnitten (die Saiten springen alle paar Zeilen eine Spalte — so gezeichnet).
* Zehn weiße Funkelsterne in drei Wuchsstufen (so stehen sie auf der Karte): kleine Raute (4 px, Mitte leer) bei (30,4) (15,6) (38,19) (18,37); X (Mitte + Diagonalen) bei (21,1)
  (29,26) (26,40); großes Plus (Arme 2 px, Mitte leer) bei (42,5) (24,17) (36,35). Sie schweben um die Harfe, drei liegen vor der Harfe.

Ablauf (48 Frames à 65 ms = 3,12 s); Frame 0 = Ruhepose = Original:
* Flügel zupft die Saiten, durchgehend: ein Zug = 12 Frames (780 ms), 4 Züge pro Schleife — Abwärtszug (über die Saiten) 4 Frames, Rückweg 8 Frames. Die Flügelwurzel (x 8–13) bleibt am
  Körper, die Federspalten der Spitze (x 14–18) wandern als Ganzes senkrecht, bis 3 px nach unten (Exponent 1,2, die Spitze hinkt 1 Frame nach). Nichts wird kopiert, die Federtextur bleibt.
* Körper wippt im Takt: Oberkörper samt Haaren, Gesicht und Flügel hebt sich bis 2 px (am höchsten in der Mitte des Zugs), die Füße bleiben auf dem Kissen; die Lücke
  schließt die verdoppelte letzte Haarzeile (y 24) — die Haarspitzen werden so kurz länger.
* Haare schwingen: die Strähne links (y 13–24) pendelt mit dem Abstand zum Kopf wachsend bis 1–2 px (Periode 16 Frames, damit sie nicht mit dem Zug im Gleichschritt läuft); das
  innere Ende bleibt am Kopf/Flügel (Pixel werden verdoppelt bzw. ausgelassen, keine Lücke).
* Blinzeln: Frames 19–21 und 41–42; Lid = Hautfarbe (246,205,139) auf die drei Augenpixel.
* Saiten (Metall, Harfe): nach jedem Zug läuft eine Zupfwelle über die Saiten — von links nach rechts versetzt, vom Zupfpunkt (je Zug eine andere Höhe) nach oben und unten
  laufend; die Saitenpixel gehen eine/zwei Stufen auf der Rampe grau → hell → weiß hoch (je Saite ein Lichtfleck).
* Goldrahmen der Harfe (Gold): zweimal pro Schleife wandert ein diagonales Lichtband (eine Stufe heller auf der Goldrampe) über den Rahmen (Frames 4–17, 28–41).
* Funkelsterne: jeder Stern wächst und vergeht in 24 Frames (Raute → X → Plus → X → Raute → aus, zwei Mal pro Schleife), je Stern in eigener Phase; in Frame 0 steht jeder in der
  Stufe der Karte. (Sterne = schwebende Musik-Funken der Kunst, kein Glanz an Gefieder/Haut; falls der Nutzer sie als „Glitzer an Nicht-Metall“ ansieht, lässt sich STERNE_AN = False setzen.)
* Der Stuhl bleibt fest (er trägt sie), ebenso Füße und das Harfengestell.

Ergänzungen: keine nötig — die Harfenebene enthält die verdeckten Teile (Stuhl hinter der Harpyie, Harfenpfosten hinter dem Flügel). Unter der Flügelwurzel (x 8–13) ist kein Körper
gezeichnet, deshalb bleibt die Wurzel fest und nur die Spitze (x 14–18) bewegt sich — dort liegt hinter dem Flügel der Goldpfosten der Harfe.
Randpixel-Test (Regel 16): `B.umriss_je_ebene` setzt Randpixel in Nicht-Umrissfarbe auf die Umrissfarbe der Ebene (Harpyie (49,24,0), Flügel (246,255,255), Harfe/Stuhl (46,61,70)).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError, wenn etwas herausragen würde). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger as F
import anim_flieger_b as B

N, MS = 48, 65
BEAT, DOWN = 12, 4                                         # Frames je Zug, davon Abwärtszug über die Saiten
PAD, PAD_T = 2, 3                                          # Rand links/rechts, oben/unten um das 45×42-Bild (die Randsterne wachsen bis zu 1 px über das Bild hinaus)
STERNE_AN = True

spr = L.lade('ballad-harpyformer')                         # Gesamtbild (Ruhepose / Referenz für den Randpixel-Test)
sh, sw = spr.shape[:2]
H, W = sh + 2 * PAD_T, sw + 2 * PAD
yy, xx = np.mgrid[0:sh, 0:sw]

harfe = L.lade('ballad-harpyformer-harfe')
harpyie = L.lade('ballad-harpyformer-harpyie')

# ── Farben (alle aus dem Sprite) ───────────────────────────────────────────────────────────────────────────────────
FLUEGEL_FARBEN = [(246, 255, 255), (180, 246, 255), (106, 197, 255), (222, 255, 255)]
HAUT = (246, 205, 139)
UMRISS_HAAR, UMRISS_FLUEGEL, UMRISS_EISEN = (49, 24, 0), (246, 255, 255), (46, 61, 70)
ERLAUBT = {(46, 61, 70), (255, 255, 255), (238, 100, 40), (155, 173, 183), (203, 219, 252), (247, 247, 173), (242, 154, 62), (49, 24, 0),
           (250, 213, 74), (246, 255, 255), (180, 246, 255)}            # Farben der Quell-Randpixel (Randpixel-Test)
EBENEN_FARBE = {1: UMRISS_EISEN, 2: UMRISS_HAAR, 3: UMRISS_HAAR, 4: UMRISS_FLUEGEL, 5: (255, 255, 255)}
SAITEN_RAMPE = [(155, 173, 183), (203, 219, 252), (255, 255, 255)]
GOLD_RAMPE = [(238, 100, 40), (242, 154, 62), (250, 213, 74), (247, 247, 173)]
STERN_WEISS = (255, 255, 255)
AUGEN = [(11, 15), (12, 15), (14, 15)]


def px(x, y):
    return PAD + x, PAD_T + y


# ── Teile auf die volle Leinwand legen (Regel 3) ───────────────────────────────────────────────────────────────────
M_FLUEGEL = L.farbmaske(harpyie, FLUEGEL_FARBEN) & (yy >= 16) & (yy <= 23) & (xx >= 8)
M_FUESSE = harpyie[..., 3] > 0
M_FUESSE = M_FUESSE & (yy >= 25)
M_OBEN = (harpyie[..., 3] > 0) & ~M_FLUEGEL & ~M_FUESSE
HARFE = L.platz(harfe, H, W, PAD, PAD_T)
FUESSE = F.ebene(harpyie, M_FUESSE, H, W, PAD, PAD_T)
OBEN = F.ebene(harpyie, M_OBEN, H, W, PAD, PAD_T)
FL_WURZEL = F.ebene(harpyie, M_FLUEGEL & (xx <= 13), H, W, PAD, PAD_T)
FL_SPITZE = F.ebene(harpyie, M_FLUEGEL & (xx >= 14), H, W, PAD, PAD_T)
Y_ENDE = PAD_T + 24                                          # letzte Haarzeile des Oberkörpers (darunter beginnen die Füße)

# Saiten / Goldrahmen als Masken (Sprite-Koordinaten)
M_SAITEN = L.farbmaske(harfe, [(203, 219, 252), (155, 173, 183)]) & (xx >= 17) & (xx <= 29) & (yy >= 11) & (yy <= 31)
M_GOLD = L.farbmaske(harfe, GOLD_RAMPE) & (xx >= 14)
SAITEN = list(zip(*np.nonzero(M_SAITEN)))                  # (y, x)
ZUPF_Y = [21, 17, 24, 19]                                  # Höhe des Zupfpunkts je Zug


# ── Flügel zupft ────────────────────────────────────────────────────────────────────────────────────────────────────
A_AMP, POT, LAG = 4.0, 1.2, 1.0
X_PIV, MAXD = 13, 5                                        # Spitzen-Spalten x 14…18: Abstand 1…5 von der Wurzelkante


def welle(t):
    """Zugphase 0 (Spitze oben = Original) … 1 (unten): Abwärtszug in DOWN Frames, Rückweg in BEAT − DOWN Frames; an den Wendepunkten weich."""
    u = t % BEAT
    if u < DOWN:
        return 0.5 - 0.5 * math.cos(math.pi * u / DOWN)
    return 0.5 + 0.5 * math.cos(math.pi * (u - DOWN) / (BEAT - DOWN))


def dy_fn(t):
    """Spaltenverschiebung als Funktion des Abstandsanteils f; Frame 0 = Original (die Verschiebung wird auf Frame 0 bezogen)."""
    def dy(f):
        return A_AMP * (welle(t - LAG * f) - welle(-LAG * f)) * f ** POT
    return dy


def spitze_dy(x, t):
    return int(round(dy_fn(t)(abs(x - X_PIV) / MAXD)))


# ── Körper wippt, Haare schwingen, Blinzeln ──────────────────────────────────────────────────────────────────────────
BOB_AMP = 1.0


def hub(t):
    """Anhebung des Oberkörpers in px (0 = Original, am höchsten in der Mitte des Zugs)."""
    return int(round(BOB_AMP * (1.0 - math.cos(2 * math.pi * t / BEAT))))


HAAR_INNEN = {**{PAD_T + y: PAD + 10 for y in range(13, 19)}, PAD_T + 19: PAD + 8, PAD_T + 20: PAD + 8, PAD_T + 21: PAD + 8, PAD_T + 22: PAD + 9, PAD_T + 23: PAD + 11, PAD_T + 24: PAD + 12}
HAAR_AMP, HAAR_PERIODE = 1.6, 16.0


def haar_dx(t):
    s = math.sin(2 * math.pi * t / HAAR_PERIODE)
    return lambda y: -HAAR_AMP * s * (((y - (PAD_T + 13)) / 11.0) ** 1.3)


def blinzeln(i):
    return (19 <= i <= 21) or (41 <= i <= 42)


# ── Saiten, Goldrahmen, Sterne ──────────────────────────────────────────────────────────────────────────────────────
def harfe_ebene(i, glanz=True):
    a = HARFE.copy()
    if not glanz:
        return a
    # Zupfwelle über die Saiten: nach jedem Zug, versetzt von links nach rechts, vom Zupfpunkt nach oben/unten laufend
    for (y, x) in SAITEN:
        lv = 0
        for k in range(N // BEAT):
            tau = (i - (k * BEAT + 1)) % N
            ank = (x - 17) * 0.35 + abs(y - ZUPF_Y[k]) * 0.4
            d = abs(tau - ank)
            if tau <= 10 and d <= 1.2:
                lv = max(lv, 2 if d <= 0.55 else 1)
        if lv:
            a[PAD_T + y, PAD + x, :3] = F.heller(a[PAD_T + y, PAD + x, :3], SAITEN_RAMPE, lv)
    # Goldrahmen: diagonales Lichtband, zweimal pro Schleife
    for start in (4, 28):
        F.lichtband(a, M_GOLD, PAD, PAD_T, i, N, start, 14, GOLD_RAMPE, stufen=1, breite=3.0, achse=(1.0, 1.0))
    return a


# Sterne: (Mitte, Form der Karte, Index in FOLGE bei Frame 0)
FOLGE = [1, 1, 2, 2, 3, 3, 3, 3, 3, 2, 2, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]       # eine Periode (24 Frames): aufblühen und vergehen
STERNE = [((30, 4), 1, 11), ((15, 6), 1, 0), ((38, 19), 1, 13), ((18, 37), 1, 1),
          ((21, 1), 2, 3), ((29, 26), 2, 10), ((26, 40), 2, 2),
          ((42, 5), 3, 5), ((24, 17), 3, 8), ((36, 35), 3, 6)]


def sterne_ebene(i):
    e = L.leer(H, W)
    for (mx, my), form, k0 in STERNE:
        st = B.funkel_stufe(i, len(FOLGE), k0, FOLGE)
        if st:
            B.funkel_stern(e, PAD + mx, PAD_T + my, st, STERN_WEISS)
    return e


TEST_EBENEN = ('harfe', 'harpyie')                          # für den Randpixel-Test: ohne Sterne


def frame(i, partikel=True, nur=None):
    ebenen = nur if nur is not None else TEST_EBENEN
    if nur is not None:
        partikel = False
    schichten = []
    if 'harfe' in ebenen:
        schichten.append((harfe_ebene(i), 0, 0, 1))
    if 'harpyie' in ebenen:
        n = hub(i)
        oben = B.zeilen_dehnen_aussen(OBEN, PAD_T + 13, PAD_T + 24, HAAR_INNEN, haar_dx(i))
        if blinzeln(i):
            oben = oben.copy()
            for (x, y) in AUGEN:
                oben[PAD_T + y, PAD + x, :3] = HAUT
        k = n // 2                                         # Füße heben sich nur halb so weit (Fußwippen), die Lücke füllt die doppelte letzte Haarzeile
        oben = L.streck_zeile(oben, Y_ENDE, n - k)
        wurzel = FL_WURZEL
        spitze = B.spalten_schub(FL_SPITZE, PAD + X_PIV, dy_fn(i), MAXD)
        schichten += [(FUESSE, 0, -k, 2), (oben, 0, -k, 3), (wurzel, 0, -n, 4), (spitze, 0, -n, 4)]
    f, karte = B.zusammen_mit_karte(H, W, schichten)
    B.umriss_je_ebene(f, karte, ERLAUBT, EBENEN_FARBE)
    if partikel and STERNE_AN:
        f = L.zusammen(H, W, [(f, 0, 0), (sterne_ebene(i), 0, 0)])
    return f


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('ballad-harpyformer', 'Ballad Harpyformer', frames, MS, prev)
    if prev:
        L.streifen(prev + '/ballad-harpyformer-strip.png', frames, spalten=8, scale=5)
