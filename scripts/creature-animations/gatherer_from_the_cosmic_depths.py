# -*- coding: utf-8 -*-
"""Idle-Animation für „Gatherer from the Cosmic Depths“ (Creature).

Quelle: src/gatherer-from-the-cosmic-depths.png (+ -k.png = nur der Körper, gleiche Leinwand) — Ebene „Ebene #34“ (MotiveBoons, Ebene 28; 30×33 px, 476 Pixel, 21 Farben) PLUS der eine Weltraumbrocken mit
den schwarzen Löchern aus der Ebene „Ebene #30“ (Ebene 29, Figur 4: 48 Pixel), der in der Kartenkunst genau an den Hinterbeinen hängt (Leinwand 31×33 px, 524 Pixel). Gegen die Kartenkunst abgeglichen
(data/card-art/native/Gatherer_from_the_Cosmic_Depths.png, 76×51; Körperebene liegt bei (11, 9), Korrelation 0,9999; die Brockenebene enthält fünf Brocken, die übrigen vier schweben frei im Bild und sind nicht
Teil der Figur).
PICK: [["MotiveBoons", 28, 1], ["MotiveBoons", 29, 4]]

Aufruf:   python3 gatherer_from_the_cosmic_depths.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/gatherer-from-the-cosmic-depths.png + .json

Was ist was (x/y im Sprite):
* Ein langes, schwebendes Insekt (Libellen-/Heuschreckenart) in Grün (89,165,127)/(93,129,117)/(45,98,70) mit hellgrünem Flügelrand (155,191,101)/(113,164,37)/(79,115,25): zwei große, senkrecht stehende Fächerflügel
  (x 6–23, y 0–16), ein langer waagerechter Leib (x 4–29, y 16–24) mit dunklem Kopf links (x 0–8, y 16–26, schwarz (11,8,1)) und gelben Facettenaugen (148,147,20)/(186,177,58) bei (2–4, 20–23), spitzem Hinterleib
  rechts (x 27–29, y 15–19) und dünnen dunklen Beinen (44,46,41), die nach unten hängen (x 2–26, y 25–32).
* Rechts unten hält es mit den Hinterbeinen einen bläulich-grauen Weltraumbrocken mit schwarzen Löchern (x 22–30, y 24–31) — „gesammeltes“ Gut.
Fest bleiben: Körperform, Kopf, Augenform im Ruhebild, Beine (soweit nicht unten angegeben).

Ablauf (48 Frames à 70 ms = 3,36 s; Frame 0 = Original):
* Flügelflattern: beide Flügel zusammen neigen sich aus dem Gelenk (y 17): Zeilengruppen (y 0–2, 3–5, 6–8, 9–11, 12–14, 15–16) wandern bis ±2 px waagerecht (wächst zur Spitze, benachbarte Gruppen ≤ 1 px verschieden),
  Periode 12, viermal pro Schleife; Leib und Beine stehen dabei.
* Schweben: die ganze Figur hebt und senkt sich ±1 px (Periode 24, zweimal pro Schleife).
* Hinterleib wippt: die Hinterleibspitze (x ≥ 27, y ≤ 19) hebt/senkt sich ±1 px (Periode 16).
* Brocken schwingt wie ein Pendel: ±1 px waagerecht (Periode 24) und ±1 px senkrecht (Periode 16), solange er die Beine (4er-Kontakt) berührt, sonst bleibt er in der berührenden Lage; wo er die Beine verdeckte, kommt das Bein darunter wieder zum Vorschein (Beine aus der Körperebene).
* Beine zucken: das rechte Beinbündel (x 17–26, y ≥ 26) und das mittlere (x 12–16) ziehen sich abwechselnd 1 px hoch (je 3 Frames, Periode 16: rechts Frame 2–4, Mitte Frame 10–12).
* Blinzeln (Lid = Schwarz (11,8,1), die Kopffarbe): die gelben Augenpixel werden 3 Frames lang schwarz, zweimal pro Schleife (Frame 13–15 und 37–39).
Keine Partikel (die schwebenden Brocken der Karte sind Dekor, nicht Teil der Figur). Kein Glanz (Regel 14: Chitin/Flügelhaut, kein Metall), kein Feuer (Regel 15). Randpixel-Test (Regel 16): `U.kontur_schliessen`
(Randfarben der Quelle) in jeder Pose; im Ruhebild nichts. Keine gemalten Pixel außer Farben der Quelle.
Zuschnitt: Frame auf die Figur zugeschnitten (symmetrisch um die Ruhefigur, dazu 1 px leerer Rand). Alle Bewegungen laufen auf der vollen Leinwand
(anim_lib wirft ClipError). Nur ganze Pixel.
"""
import math
import sys

import cv2
import numpy as np

import anim_lib as L
import anim_untote as U

N, MS = 48, 70
GPL, GPR, GPT, GPB = 6, 6, 6, 5

spr = L.lade('gatherer-from-the-cosmic-depths')
spr_k = L.lade('gatherer-from-the-cosmic-depths-k')
sh, sw = spr.shape[:2]
H, W = sh + GPT + GPB, sw + GPL + GPR
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
vk = L.deckend(spr_k)
col = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
colk = lambda x, y: tuple(int(v) for v in spr_k[y, x, :3])
UMRISS = U.umrissfarben(spr)
KOPF_SCHWARZ = (11, 8, 1)
AUGE_Y, AUGE_H = (148, 147, 20), (186, 177, 58)
assert KOPF_SCHWARZ in UMRISS | {col(x, y) for y in range(sh) for x in range(sw) if vorhanden[y, x]}

stein = vorhanden & np.any(spr != spr_k, axis=-1)
assert int(stein.sum()) == 48 and stein[24:, 22:].sum() == 48
augen = np.array([[bool(vk[y, x]) and colk(x, y) in (AUGE_Y, AUGE_H) for x in range(sw)] for y in range(sh)])
assert int(augen.sum()) == 4

# Teile des Körpers (Masken im Körper-Sprite)
fluegel = vk & (((yy <= 15) & (xx >= 6) & (xx <= 23)) | ((yy == 16) & (xx >= 8) & (xx <= 21)))
schwanz = vk & (xx >= 27) & (yy <= 19)
beine_r = vk & (xx >= 17) & (xx <= 26) & (yy >= 26)
beine_m = vk & (xx >= 12) & (xx <= 16) & (yy >= 26)
rest = vk & ~fluegel & ~schwanz & ~beine_r & ~beine_m & ~augen
assert not (fluegel & schwanz).any()
GRUPPEN = [(0, 2), (3, 5), (6, 8), (9, 11), (12, 14), (15, 16)]

BLINZ = {13, 14, 15, 37, 38, 39}


def teil(a, maske):
    t, _ = L.trenne(a, maske)
    return L.platz(t, H, W, GPL, GPT)                           # sofort auf die volle Leinwand


FL_A, SCH_A, BR_A, BM_A, RE_A, AU_A = teil(spr_k, fluegel), teil(spr_k, schwanz), teil(spr_k, beine_r), teil(spr_k, beine_m), teil(spr_k, rest), teil(spr_k, augen)
ST_A = teil(spr, stein)


def sinz(i, per, ph=0.0):
    return math.sin(2 * math.pi * i / per + ph)


def fluegel_flattern(a, aus):
    """Flügel neigen sich aus dem Gelenk (Zeile y 17): der Versatz wächst mit dem Abstand der Zeilengruppe; die Zeilen einer Gruppe verschieben sich gleich."""
    out = L.leer(*a.shape[:2])
    for (y0, y1) in GRUPPEN:
        dx = int(round(aus * (17 - (y0 + y1) / 2.0) / 17.0))
        for y in range(y0, y1 + 1):
            gy = GPT + y
            for x in np.nonzero(a[gy, :, 3])[0]:
                out[gy, x + dx] = a[gy, x]
    return out


def _k4(a):
    return cv2.connectedComponents((a[..., 3] > 0).astype(np.uint8), connectivity=4)[0] - 1


def frame_gross(i, nur=None):
    aus = 2.2 * sinz(i, 12)                                       # 0 bei Frame 0
    fl = fluegel_flattern(FL_A, aus)
    bob = int(round(1.0 * sinz(i, 24)))
    sw_ = int(round(1.0 * sinz(i, 16)))
    br = -1 if (i % 16) in (2, 3, 4) else 0
    bm = -1 if (i % 16) in (10, 11, 12) else 0
    au = AU_A.copy()
    if i in BLINZ:
        au[au[..., 3] > 0, :3] = KOPF_SCHWARZ
    sx = int(round(sinz(i, 24)))
    sy = int(round(sinz(i, 16)))
    koerper = L.zusammen(H, W, [(BR_A, 0, br), (BM_A, 0, bm), (RE_A, 0, 0), (au, 0, 0), (fl, 0, 0), (SCH_A, 0, sw_)])
    koerper = U.kontur_schliessen(koerper, UMRISS, KOPF_SCHWARZ)
    # Brocken: gewünschter Pendelversatz; reißt dabei der 4er-Kontakt zu den Beinen ab (Brocken würde schweben), nimmt er den nächstbesten Versatz, der die Beine berührt
    ohne = _k4(koerper)
    figur = None
    for (ax, ay) in ((sx, sy), (sx, 0), (0, sy), (0, 0)):
        figur = L.zusammen(H, W, [(koerper, 0, 0), (ST_A, ax, ay)])
        if _k4(figur) <= ohne:
            break
    figur = L.versetze(figur, 0, bob) if bob else figur
    return figur


# Zuschnitt auf die Figur: symmetrisch um die Ruhefigur (keine Partikel)
BOX = U.zuschnitt([frame_gross(i) for i in range(N)], [frame_gross(i) for i in range(N)], (GPL, GPT, GPL + sw, GPT + sh))
PAD_L, PAD_T = GPL - BOX[0], GPT - BOX[1]


def frame(i, nur=None):
    return U.beschneiden(frame_gross(i, nur), BOX)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr, min_rand=1)
    L.speichern('gatherer-from-the-cosmic-depths', 'Gatherer from the Cosmic Depths', frames, MS, prev)
    if prev:
        L.streifen(prev + '/gatherer-from-the-cosmic-depths-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 42)], spalten=4, scale=8)
