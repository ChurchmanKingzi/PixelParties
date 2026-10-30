# -*- coding: utf-8 -*-
"""Idle-Animation für „Gangster Angel“ (Creature).

PICK: [["MotiveMoe", 306, 3]]
Quelle: src/gangster-angel.png — Ebene „Gangsta“ (33×23 px, 28 Farben) aus MotiveMoe.xcf, Figur 3.

Aufruf:   python3 gangster_angel.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/gangster-angel.png + .json

Identifikation (Sprite-Koordinaten x, y):
* Körper: rundes rosa Wesen (Köpfchen = Körper), Umriss (233,134,184)/(223,121,161), Füllung hell/heller rosa; dunkle
  Schattenpixel (81,81,93) am Unterkörper gehören zum Umriss.
* Gesicht: Augenbrauen = je zwei graue Pixel (15–16, 8) und (19–20, 8); grüne Augen (je 2 Pixel) (15–16, 10) und (19–20, 10)
  schauen ÜBER der Sonnenbrille hervor; schwarze Sonnenbrille (12–23, 11–12) mit grauen Glanzpixeln, breites weißes Grinsen (16–20, 14–15).
  Das einzelne graue Pixel (17, 9) bleibt fest (unklar: Nasenschatten/Brauen-Innenende).
* Goldener Streifen am Bauch (18–19, 17–19): fest (Kette/Schmuck, unklar).
* Füße: zwei dunkle Stiefel unter dem Körper (10–14 / 18–23, 19–22).
* Flügel: weiß/hellgrau mit grauem Umriss links (0–12) und rechts (22–32), sie schließen am Körperumriss an (keine Überlappung).
* Heiligenschein: goldener Bogen (17,4–6), (18,3), (19–20,2), (22–23,2), (24,3), (25,4), (26,5) und weiter über den rechten Flügel
  (26,6), (27,7), (27,8) mit hellblauen Funkenpixeln (21–23, 0–4) in der Mitte.
* Blauer Edelstein (Diamant, 25–29 × 9–13) vor dem rechten Flügel.

Ablauf (24 Frames à 70 ms = 1,68 s):
* Flügelschlag: zweimal pro Schleife; jede Flügelspalte wandert senkrecht, je weiter vom Körper, desto mehr
  (Spitze etwa −3 … +4 px), beide Flügel gleichzeitig. Die Schulterspalten, die am Körperumriss anliegen (links x ≥ 9,
  rechts x ≤ 25), bleiben stehen — sonst reißt zwischen Flügel und Körper ein Hintergrundpixel (Tasche) auf.
  Der Edelstein wandert starr mit der Flügelspalte unter seiner Mitte (x = 27).
* Schwebe-Bob: die ganze Figur (Körper, Flügel, Heiligenschein, Edelstein) hebt sich beim Abschlag um 1 px.
* Atmen: der Oberkörper samt Flügeln dehnt sich einmal pro Schleife um 1 Zeile (Zeile 13 wird verdoppelt; Körper UND Flügel
  gemeinsam, damit der Anschluss nicht aufreißt); Heiligenschein und Edelstein heben sich starr mit.
* Heiligenschein schwebt zusätzlich ±1 px (eigene Periode = Schleife); ein Lichtreflex wandert an seinem Bogen entlang,
  die hellblauen Funkenpixel funkeln.
* Füße baumeln (Stiefel pendeln um 1–2 px, Ansatz am Körper steht).
* Blinzeln (Frames 16–18), Augenbraue zuckt hoch (Frames 6–9), Lichtreflex wandert über die Brillengläser (Frames 8–14),
  Edelstein funkelt (Frames 12–13).
* Goldene und weiße Glitzer-Klekse (Partikel: kleine Klekse/Funken, wachsen und schrumpfen, steigen langsam auf) hinter den Flügeln, nahtlos.

Ergänzungen (fertiggezeichnet, nur Farben der Quelle):
* Unter dem Heiligenschein (er bewegt sich getrennt vom Kopf/Flügel): Kopf (17,5)=(233,134,184), (17,6)=(235,205,220);
  rechter Flügel (26,5), (26,6), (27,7), (27,8)=(245,245,245).
* Unter dem Edelstein (rechter Flügel, alle 19 Edelsteinpixel): x ≤ 26 → (208,208,208) [(26,9), (25–26,10), (25–26,11), (26,12)],
  x ≥ 27 → (245,245,245) [Rest inkl. (27,13)].
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError, wenn etwas herausragen würde).
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger as F

N, MS = 24, 70
PAD_L, PAD_R, PAD_T, PAD_B = 7, 7, 9, 6

spr = L.lade('gangster-angel')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

# ── Farben (alle aus dem Sprite) ──────────────────────────────────────────────────────────────────────────────────
FL_A, FL_B, FL_C, FL_D = (208, 208, 208), (255, 255, 255), (245, 245, 245), (143, 143, 143)
KOPF_E, KOPF_G = (233, 134, 184), (235, 205, 220)
HELLROSA = (238, 181, 209)
GOLD, GOLD_HELL = (250, 225, 98), (244, 239, 157)
BLAU, BLAU_HELL, BLAU_WEISS = (140, 192, 239), (181, 208, 238), (238, 247, 254)
AUGE_DUNKEL, AUGE_HELL = (91, 169, 88), (180, 237, 166)
BRAUE = (97, 99, 98)

# ── Masken ────────────────────────────────────────────────────────────────────────────────────────────────────────
fl_farben = L.farbmaske(spr, [FL_A, FL_B, FL_C, FL_D])
fl_links = fl_farben & (xx <= 12)
fl_rechts = fl_farben & (xx >= 22)
edelstein = L.farbmaske(spr, [(72, 89, 105), (149, 184, 206), BLAU_HELL, (129, 161, 186), BLAU_WEISS])
halo = (L.farbmaske(spr, [GOLD, GOLD_HELL]) & (yy <= 8)) | L.farbmaske(spr, [BLAU])
fuss_maske = L.farbmaske(spr, [(40, 40, 40), (59, 59, 59), (81, 81, 81)]) & (yy >= 20)
koerper = vorhanden & ~fl_links & ~fl_rechts & ~edelstein & ~halo & ~fuss_maske
assert int((fl_links | fl_rechts | edelstein | halo | fuss_maske | koerper).sum()) == int(vorhanden.sum())
fuss_l = fuss_maske & (xx <= 15)
fuss_r = fuss_maske & (xx >= 16)

# ── Ergänzungen unter dem beweglichen Heiligenschein / Edelstein ────────────────────────────────────────────────────
KOPF_ERG = {(17, 5): KOPF_E, (17, 6): KOPF_G}                       # Kopf unter dem Heiligenschein-Strich
spr_k, _ = F.ergaenzen(spr, KOPF_ERG)
koerper_k = koerper.copy()
for (ex, ey) in KOPF_ERG:
    koerper_k[ey, ex] = True

FLUEGEL_ERG = {(26, 5): FL_C, (26, 6): FL_C, (27, 7): FL_C, (27, 8): FL_C}   # rechter Flügel unter dem Goldbogen
for (ex, ey) in zip(*np.nonzero(edelstein)[::-1]):                           # unter dem Edelstein: innen grau, außen weiß
    FLUEGEL_ERG[(int(ex), int(ey))] = FL_A if ex <= 26 else FL_C
spr_f, erg_f = F.ergaenzen(spr, FLUEGEL_ERG)
fl_rechts_k = fl_rechts | erg_f

# ── Pfade für Glanz/Funkeln ─────────────────────────────────────────────────────────────────────────────────────────
HALO_PFAD = [(17, 6), (17, 5), (17, 4), (18, 3), (19, 2), (20, 2), (22, 2), (23, 2), (24, 3), (25, 4), (26, 5), (26, 6), (27, 7), (27, 8)]
HALO_BLAU = [(22, 0), (21, 1), (23, 1), (21, 2), (21, 3), (23, 3), (22, 4)]
GLAS_L = [(12, 11), (13, 11), (14, 11), (15, 11)]
GLAS_R = [(18, 11), (19, 11), (20, 11), (23, 11)]
AUGEN = [(15, 10), (16, 10), (19, 10), (20, 10)]
BRAUEN = {(15, 8): HELLROSA, (16, 8): HELLROSA, (19, 8): KOPF_G, (20, 8): KOPF_G}   # Pixel → Hautfarbe, wenn die Braue hochgeht

# ── Partikel: Glitzer (Funkenkreuz/Funke) in Gold und Weiß ─────────────────────────────────────────────────────────
def px(x, y):
    return PAD_L + x, PAD_T + y


GLITZER = {'c': FL_B, 'r': GOLD}
PUFFS = [                                                    # rund (k = Funke, s = kleiner Klecks), steigen langsam auf
    dict(x=px(-2, 10)[0], y=px(-2, 10)[1], vx=0, vy=-7, off=0, form='s', wackeln=1),   # links neben dem Flügel
    dict(x=px(34, 9)[0], y=px(34, 9)[1], vx=0, vy=-7, off=12, form='s', wackeln=1),    # rechts neben dem Flügel
    dict(x=px(28, 1)[0], y=px(28, 1)[1], vx=0, vy=-6, off=6, form='k', wackeln=1),     # über dem Heiligenschein
    dict(x=px(8, 3)[0], y=px(8, 3)[1], vx=0, vy=-6, off=18, form='k', wackeln=1),      # über dem linken Flügel
]


def frame(i, partikel=True):
    ph = L.sinus(i, N / 2)                                   # Flügelschlag: zweimal pro Schleife
    bob = int(round(-0.7 * math.sin(ph)))                    # Abschlag → Figur hebt sich
    atem = 1 if math.sin(L.sinus(i, N, -0.6)) > 0.3 else 0   # Oberkörper dehnt sich (1 Zeile)
    halo_f = int(round(math.sin(L.sinus(i, N))))        # Heiligenschein schwebt eigenständig ±1
    zeile = PAD_T + 13

    # Körper (mit allen Gesichts-Details), danach strecken
    kp = F.ebene(spr_k, koerper_k, H, W, PAD_L, PAD_T)
    if i in (16, 18):                                        # Blinzeln: halb zu
        F.setze(kp, PAD_L, PAD_T, {p: AUGE_DUNKEL for p in AUGEN})
    if i == 17:                                              # ganz zu: Lider in Hautfarbe
        F.setze(kp, PAD_L, PAD_T, {p: HELLROSA for p in AUGEN})
    if 6 <= i <= 9:                                          # Augenbrauen hoch
        F.setze(kp, PAD_L, PAD_T, BRAUEN)
        F.setze(kp, PAD_L, PAD_T, {(x, 7): BRAUE for (x, y) in BRAUEN})
    for j in F.glanz_pfad(i, N, 8, GLAS_L, 1):                # Lichtreflex über die Brillengläser
        F.setze(kp, PAD_L, PAD_T, {GLAS_L[j]: FL_D})
    for j in F.glanz_pfad(i, N, 10, GLAS_R, 1):
        F.setze(kp, PAD_L, PAD_T, {GLAS_R[j]: FL_D})
    kp = L.streck_zeile(kp, zeile, atem)

    # Flügel: erst dehnen (wie der Körper), dann schlagen
    fl_amp, fl_bias, fl_pot = 3.6, 0.5, 1.2
    wl = L.streck_zeile(F.ebene(spr_f, fl_links, H, W, PAD_L, PAD_T), zeile, atem)
    wr = L.streck_zeile(F.ebene(spr_f, fl_rechts_k, H, W, PAD_L, PAD_T), zeile, atem)
    # Schultern: die Spalten, die am Körperumriss anliegen (links x ≥ 9, rechts x ≤ 25), bleiben stehen; erst weiter außen
    # biegt sich der Flügel (sonst reißt zwischen Flügel und Körper eine Tasche auf).
    piv_l, piv_r = PAD_L + 9, PAD_L + 25
    dy_gem = F.spalte_dy(wr, piv_r, fl_amp, ph, PAD_L + 27, fl_pot, fl_bias, nur_rechts=True)
    wl_s = L.spalten_welle(wl, piv_l, fl_amp, ph, potenz=fl_pot, bias=fl_bias, nur_rechts=False)
    wr_s = L.spalten_welle(wr, piv_r, fl_amp, ph, potenz=fl_pot, bias=fl_bias, nur_rechts=True)

    # Füße baumeln (Ansatz Zeile 19 steht)
    fl_ = L.zeilen_welle(F.ebene(spr, fuss_l, H, W, PAD_L, PAD_T), PAD_T + 19, 2.2, L.sinus(i, N))
    fr_ = L.zeilen_welle(F.ebene(spr, fuss_r, H, W, PAD_L, PAD_T), PAD_T + 19, 2.2, L.sinus(i, N))

    # Heiligenschein (mit Lichtreflex und Funkeln)
    hl = F.ebene(spr, halo, H, W, PAD_L, PAD_T)
    for j in F.glanz_pfad(i, N, 3, HALO_PFAD, 2):
        x, y = HALO_PFAD[j]
        F.setze(hl, PAD_L, PAD_T, {(x, y): FL_B if (x, y) in ((26, 6), (27, 7), (27, 8)) else GOLD_HELL})
    for k, p in enumerate(HALO_BLAU):                         # Funkenpixel funkeln reihum (je 2 Frames, versetzt)
        t = (i - 2 - 2 * k) % N
        if t in (0, 1):
            F.setze(hl, PAD_L, PAD_T, {p: BLAU_HELL if t == 0 else BLAU_WEISS})

    # Edelstein (starr) mit Funkeln
    ed = F.ebene(spr, edelstein, H, W, PAD_L, PAD_T)
    if i in (12, 13):
        F.setze(ed, PAD_L, PAD_T, {(28, 10): FL_B, (27, 10): BLAU_WEISS})

    glitzer = L.puff_ebene(H, W, i, N, PUFFS, GLITZER) if partikel else L.leer(H, W)
    dy_hal = bob - atem + halo_f
    return L.zusammen(H, W, [(glitzer, 0, 0), (wl_s, 0, bob), (wr_s, 0, bob), (fl_, 0, bob), (fr_, 0, bob), (kp, 0, bob),
                             (hl, 0, dy_hal), (ed, 0, bob - atem + dy_gem)])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('gangster-angel', 'Gangster Angel', frames, MS, prev)
    if prev:
        L.streifen(prev + '/gangster-angel-strip.png', frames, spalten=6, scale=6)
