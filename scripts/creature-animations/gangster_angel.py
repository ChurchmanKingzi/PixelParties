# -*- coding: utf-8 -*-
"""Idle-Animation für „Gangster Angel“ (Creature) — Überarbeitung (Regeln 12/13).

PICK: [["MotiveMoe", 306, 3]]
Quelle: src/gangster-angel.png — Ebene „Gangsta“ (33×23 px, 28 Farben) aus MotiveMoe.xcf, Figur 3.

Aufruf:   python3 gangster_angel.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/gangster-angel.png + .json

Identifikation (Sprite-Koordinaten x, y):
* Körper: rundes rosa Wesen (Kopf = Körper), Umriss (233,134,184)/(223,121,161), Füllung hell/heller rosa; dunkle Schattenpixel (81,81,93).
* Gesicht: Augenbrauen je zwei graue Pixel (15–16, 8) und (19–20, 8); grüne Augen (je 2 Pixel) (15–16, 10) und (19–20, 10) schauen ÜBER der
  Sonnenbrille hervor; schwarze Sonnenbrille (12–23, 11–12) mit grauen Glanzpixeln; breites weißes Grinsen (16–20, 14–15). Das graue Pixel (17, 9) bleibt fest.
* Goldener Streifen am Bauch (18–19, 17–19); Füße: zwei dunkle Stiefel (10–14 / 18–23, 19–22).
* Flügel: weiß/hellgrau mit grauem Umriss links (0–12) und rechts (22–32), liegen NEBEN dem Körperumriss (keine Überlappung).
* ANGEL (Angelrute, laut Nutzer): der goldene Bogen (17,4–6), (18,3), (19–20,2), (22–23,2), (24,3), (25,4), (26,5) ist die Rute, am Kopf
  eingesteckt; von der Spitze (26,5) hängt die ANGELSCHNUR (hellgelb (26,6), (27,7), (27,8)) hinab zum KÖDER = blauer DIAMANT (25–29, 9–13).
  Die hellblauen Pixel (21–23, 0–4) mitten im Bogen sind Funkelpixel.

Ablauf (40 Frames à 70 ms = 2,8 s):
* Flügelschlag viermal pro Schleife (Periode 10 Frames), Spitze etwa −3 … +6 px, Spitze hinkt nach (F.fluegel_welle); Schulterspalten am
  Körperumriss (links x ≥ 9, rechts x ≤ 25) bleiben stehen (sonst Tasche).
* Schwebe-Bob zweistufig (±1…2 px): Unterkörper/Füße zuerst, Oberkörper (Kopf, Flügel, Rute) etwas später; der Unterschied wird an Zeile 13 (reine
  Rosafläche) durch Verdoppeln/Entfernen einer Zeile ausgeglichen — an Körper UND Flügeln (das ist zugleich das Atmen) .
* Rute schwebt zusätzlich ±1 px (Periode 20). Der Köder (Diamant) hängt an der Schnur: er federt auf und ab (Schnur dehnt sich mit, 0…2 px)
  und pendelt 1 px nach außen.
* Gold glänzt: ein Lichtband läuft zweimal pro Schleife über Rute und Schnur (eine, im Kern zwei Stufen heller auf der Goldrampe
  (230,205,87) → (250,225,98) → (244,239,157) → Weiß), am Rutenende und am Bauchstreifen blitzen vierzackige Glitzer-Sterne auf.
* Diamant glänzt und glitzert: Lichtband diagonal über die Facetten (Rampe (72,89,105) … (255,255,255)), Facetten pulsieren, an seinen Ecken
  blitzen vierzackige Sterne (Mitte + 4 Arme, wachsen/schrumpfen, bleiben AM Diamanten).
* Hellblaue Funkelpixel blinken reihum WEISS (je 5 Frames), an der Mitte blitzt ein weißer Stern. Alle Glitzersterne (Diamant, Gold, Bauch, Funkelpixel) sind weiß.
* Füße baumeln (Ansatz Zeile 20 steht, damit der Bauchrand darüber nicht frei liegt), Blinzeln (zweimal pro Schleife), Augenbrauen zucken hoch, Lichtreflex wandert über beide Brillengläser (zweimal pro Schleife).
* Glitzer-Partikel (acht kleine weiße/goldene Funken und Punkte) steigen langsam hinter den Flügeln auf.

Ergänzungen (fertiggezeichnet, nur Farben der Quelle):
* Unter der Rute (sie bewegt sich getrennt vom Kopf/Flügel): Kopf (17,5)=(233,134,184), (17,6)=(235,205,220); rechter Flügel (26,5), (26,6), (27,7), (27,8)=(245,245,245).
* Unter dem Diamanten (rechter Flügel, alle 19 Diamantpixel): x ≤ 26 → (208,208,208) [(26,9), (25–26,10), (25–26,11), (26,12)],
  x ≥ 27 → (245,245,245) [Rest inkl. (27,13)].
* Die Schnur wird beim Absenken des Köders um 1–2 Pixel in (244,239,157) nach unten verlängert (x = 27, y 9 …), damit sie den Diamanten erreicht.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError, wenn etwas herausragen würde). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger as F

N, MS = 40, 70
PAD_L, PAD_R, PAD_T, PAD_B = 9, 9, 12, 9

spr = L.lade('gangster-angel')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

# ── Farben (alle aus dem Sprite) ──────────────────────────────────────────────────────────────────────────────────
FL_A, FL_B, FL_C, FL_D = (208, 208, 208), (255, 255, 255), (245, 245, 245), (143, 143, 143)
KOPF_E, KOPF_G = (233, 134, 184), (235, 205, 220)
HELLROSA = (238, 181, 209)
GOLD, GOLD_HELL, GOLD_DUNKEL = (250, 225, 98), (244, 239, 157), (230, 205, 87)
BLAU, BLAU_HELL, BLAU_WEISS = (140, 192, 239), (181, 208, 238), (238, 247, 254)
AUGE_DUNKEL = (91, 169, 88)
BRAUE = (97, 99, 98)
GOLDR = [GOLD_DUNKEL, GOLD, GOLD_HELL, FL_B]                                  # Goldrampe dunkel → hell
BLAUR = [BLAU, BLAU_HELL, BLAU_WEISS, FL_B]                                   # Funkelblau (Rampe, nicht mehr für die Funkelpixel benutzt)
GEMR = [(72, 89, 105), (129, 161, 186), (149, 184, 206), BLAU_HELL, BLAU_WEISS, FL_B]   # Diamantrampe dunkel → hell

UMRISS = F.umriss_farben(spr)                                  # Umrissfarben der Quelle (Randpixel-Test, Regel 16)

# ── Masken ────────────────────────────────────────────────────────────────────────────────────────────────────────
fl_farben = L.farbmaske(spr, [FL_A, FL_B, FL_C, FL_D])
fl_links = fl_farben & (xx <= 12)
fl_rechts = fl_farben & (xx >= 22)
edelstein = L.farbmaske(spr, GEMR[:5])
gold_rute = L.farbmaske(spr, [GOLD, GOLD_HELL]) & (yy <= 8)                   # Rute + Schnur
halo = gold_rute | L.farbmaske(spr, [BLAU])                                   # Rute, Schnur, Funkelpixel
fuss_maske = L.farbmaske(spr, [(40, 40, 40), (59, 59, 59), (81, 81, 81)]) & (yy >= 20)
koerper = vorhanden & ~fl_links & ~fl_rechts & ~edelstein & ~halo & ~fuss_maske
assert int((fl_links | fl_rechts | edelstein | halo | fuss_maske | koerper).sum()) == int(vorhanden.sum())
fuss_l = fuss_maske & (xx <= 15)
fuss_r = fuss_maske & (xx >= 16)
bauch = L.farbmaske(spr, [GOLD, GOLD_HELL, GOLD_DUNKEL]) & (yy >= 17)

# ── Ergänzungen unter der beweglichen Rute / Schnur / Köder ─────────────────────────────────────────────────────────
KOPF_ERG = {(17, 5): KOPF_E, (17, 6): KOPF_G}
spr_k, _ = F.ergaenzen(spr, KOPF_ERG)
koerper_k = koerper.copy()
for (ex, ey) in KOPF_ERG:
    koerper_k[ey, ex] = True

FLUEGEL_ERG = {(26, 5): FL_C, (26, 6): FL_C, (27, 7): FL_C, (27, 8): FL_C}
for (ex, ey) in zip(*np.nonzero(edelstein)[::-1]):
    FLUEGEL_ERG[(int(ex), int(ey))] = FL_A if ex <= 26 else FL_C
spr_f, erg_f = F.ergaenzen(spr, FLUEGEL_ERG)
fl_rechts_k = fl_rechts | erg_f

# ── Pfade, Gesichts-Details ────────────────────────────────────────────────────────────────────────────────────────
HALO_BLAU = [(22, 0), (21, 1), (23, 1), (21, 2), (21, 3), (23, 3), (22, 4)]
GLAS_L = [(12, 11), (13, 11), (14, 11), (15, 11)]
GLAS_R = [(18, 11), (19, 11), (20, 11), (23, 11)]
AUGEN = [(15, 10), (16, 10), (19, 10), (20, 10)]
BRAUEN = {(15, 8): HELLROSA, (16, 8): HELLROSA, (19, 8): KOPF_G, (20, 8): KOPF_G}
# Glitzer-Sterne: (x, y) in Sprite-Koordinaten, Start-Frame; Farben (Mitte, Arm 1, Arm 2)
STERNE_GEM = [((25, 10), 3), ((27, 9), 13), ((29, 11), 23), ((27, 13), 33)]   # Ecken des Diamanten (weiß, auf dem Körper/Gold sichtbar)
STERNE_GOLD = [((26, 5), 8), ((18, 3), 28)]
STERN_BLAU = ((22, 0), 18)
STERN_BAUCH = ((19, 17), 15)


def px(x, y):
    return PAD_L + x, PAD_T + y


def puffs(liste):
    return [dict(x=px(x, y)[0], y=px(x, y)[1], vx=vx, vy=vy, off=off, form=f, wackeln=wk) for (x, y, vx, vy, off, f, wk) in liste]


GLITZER = {'c': FL_B, 'r': GOLD}
PUFFS = puffs([
    (-3, 10, -1, -11, 0, 's', 1), (35, 9, 1, -11, 20, 's', 1), (-2, 6, 0, -10, 8, 'k', 1), (34, 5, 0, -10, 28, 'k', 1),
    (22, -1, 2, -9, 5, 'k', 1), (8, 2, -1, -10, 16, 'k', 1), (30, 2, 1, -10, 33, 's', 1), (12, 3, -1, -9, 36, 's', 1),
])


def frame(i, partikel=True, effekte=True):
    ph = L.sinus(i, N / 4)                                   # Flügelschlag: viermal pro Schleife (Periode 10)
    low = int(round(-1.3 * math.sin(ph)))                    # Unterkörper/Füße zuerst …
    up_roh = int(round(-1.3 * (math.sin(ph - 0.9) + math.sin(0.9))))   # … Oberkörper (Kopf, Flügel, Rute) hinterher; Frame 0 = Ruhe
    n_str = max(-1, min(2, low - up_roh))                    # Ausgleich an Zeile 13: höchstens 2 Zeilen dazu, 1 weg
    up = low - n_str
    halo_f = int(round(math.sin(L.sinus(i, N / 2))))         # Rute schwebt zusätzlich ±1
    zeile = PAD_T + 13

    # ── Körper: Gesicht, Gold am Bauch ────────────────────────────────────────────────────────────────────────────
    kp = F.ebene(spr_k, koerper_k, H, W, PAD_L, PAD_T)
    if i in (14, 16, 34, 36):                                # Blinzeln: halb zu
        F.setze(kp, PAD_L, PAD_T, {p: AUGE_DUNKEL for p in AUGEN})
    if i in (15, 35):                                        # ganz zu: Lider in Hautfarbe
        F.setze(kp, PAD_L, PAD_T, {p: HELLROSA for p in AUGEN})
    if 4 <= i <= 7 or 24 <= i <= 27:                         # Augenbrauen hoch
        F.setze(kp, PAD_L, PAD_T, BRAUEN)
        F.setze(kp, PAD_L, PAD_T, {(x, 7): BRAUE for (x, y) in BRAUEN})
    for start in (8, 28):                                    # Lichtreflex über die Brillengläser (zweimal pro Schleife)
        for j in F.glanz_pfad(i, N, start, GLAS_L, 1):
            F.setze(kp, PAD_L, PAD_T, {GLAS_L[j]: FL_D})
        for j in F.glanz_pfad(i, N, start + 2, GLAS_R, 1):
            F.setze(kp, PAD_L, PAD_T, {GLAS_R[j]: FL_D})
    if effekte:
        F.lichtband(kp, bauch, PAD_L, PAD_T, i, N // 2, 6, 6, GOLDR, stufen=1, breite=2.0, achse=(0.0, 1.0), kern_stufen=2)
    kp = L.versetze(L.streck_zeile(kp, zeile, n_str), 0, low)

    # ── Flügel: strecken wie der Körper, dann schlagen; Schulterspalten stehen ─────────────────────────────────────────
    fl_amp, fl_pot, lauf = 4.4, 1.2, 0.3
    wl = L.streck_zeile(F.ebene(spr_f, fl_links, H, W, PAD_L, PAD_T), zeile, n_str)
    wr = L.streck_zeile(F.ebene(spr_f, fl_rechts_k, H, W, PAD_L, PAD_T), zeile, n_str)
    wl = F.fluegel_welle(wl, PAD_L + 9, fl_amp, ph, potenz=fl_pot, nur_rechts=False, lauf=lauf)
    wr = F.fluegel_welle(wr, PAD_L + 25, fl_amp, ph, potenz=fl_pot, nur_rechts=True, lauf=lauf)
    wl, wr = L.versetze(wl, 0, low), L.versetze(wr, 0, low)

    # ── Füße baumeln ───────────────────────────────────────────────────────────────────────────────────────────────
    fl_ = L.zeilen_welle(F.ebene(spr, fuss_l, H, W, PAD_L, PAD_T), PAD_T + 20, 2.6, L.sinus(i, N / 2))
    fr_ = L.zeilen_welle(F.ebene(spr, fuss_r, H, W, PAD_L, PAD_T), PAD_T + 20, 2.6, L.sinus(i, N / 2))

    # ── Rute + Schnur (Gold glänzt), Funkelpixel ───────────────────────────────────────────────────────────────────────
    hl = F.ebene(spr, halo, H, W, PAD_L, PAD_T)
    if effekte:
        F.lichtband(hl, gold_rute, PAD_L, PAD_T, i, N // 2, 4, 9, GOLDR, stufen=1, breite=2.4, achse=(1.0, 0.4), kern_stufen=2)
    for k, p in enumerate(HALO_BLAU if effekte else []):                        # Funkelpixel funkeln reihum über die Blau-Rampe
        t = (i - 2 - 3 * k) % N
        if t < 5:
            F.setze(hl, PAD_L, PAD_T, {p: (BLAU_WEISS, FL_B, FL_B, FL_B, BLAU_WEISS)[t]})
    off_rute = up + halo_f

    # ── Köder (Diamant) an der Schnur: federt, pendelt, glänzt ───────────────────────────────────────────────────────
    dy_g = int(round(1.0 * (1 - math.cos(ph))))              # 0 … 2 px nach unten (Frame 0: 0)
    dx_g = 1 if math.sin(L.sinus(i, N / 2)) > 0.35 else 0    # pendelt 1 px nach außen
    ed = F.ebene(spr, edelstein, H, W, PAD_L, PAD_T)
    if effekte and i % 10 >= 3:                              # Facetten pulsieren leicht (Hellphase wandert diagonal)
        for (x, y) in zip(*np.nonzero(edelstein)[::-1]):
            if F.puls(i, N, int(x), int(y), periode=4, versatz=0.9):
                ed[PAD_T + y, PAD_L + x, :3] = F.heller(ed[PAD_T + y, PAD_L + x, :3], GEMR, 1)
    if effekte:
        F.lichtband(ed, edelstein, PAD_L, PAD_T, i, N // 2, 5, 9, GEMR, stufen=1, breite=2.6, achse=(1.0, 1.0), kern_stufen=2)
    schnur_ext = L.leer(H, W)
    for k in range(dy_g):                                    # Schnur reicht bis zum abgesenkten Köder
        schnur_ext[PAD_T + 9 + k, PAD_L + 27, :3] = GOLD_HELL
        schnur_ext[PAD_T + 9 + k, PAD_L + 27, 3] = 255

    glitzer = L.puff_ebene(H, W, i, N, PUFFS, GLITZER) if partikel else L.leer(H, W)
    f = L.zusammen(H, W, [(glitzer, 0, 0), (wl, 0, 0), (wr, 0, 0), (fl_, 0, low), (fr_, 0, low), (kp, 0, 0),
                          (hl, 0, off_rute), (schnur_ext, 0, off_rute), (ed, dx_g, off_rute + dy_g)])

    # Randpixel-Test (Regel 16): der Spaltenversatz legt an den Flügelkanten Innenfarbe frei → Kante in Umrissgrau (208,208,208) schließen
    F.umranden(f, [wl, wr], UMRISS, FL_A, FL_A, FL_A)
    F.umranden(f, [L.versetze(fl_, 0, low), L.versetze(fr_, 0, low)], UMRISS, (40, 40, 40), (40, 40, 40), (40, 40, 40))   # Stiefel: Innengrau → Umrissschwarz
    if not effekte:
        return f
    # ── Glitzer-Sterne (bleiben AM Objekt, folgen dessen Bewegung) ─────────────────────────────────────────────────────
    for (cx, cy), start in STERNE_GEM:
        st = F.stern_stufe(i, N, start)
        if st is not None:
            F.stern(f, PAD_L + cx + dx_g, PAD_T + cy + off_rute + dy_g, st, FL_B, FL_B, FL_B)
    for (cx, cy), start in STERNE_GOLD:
        st = F.stern_stufe(i, N, start)
        if st is not None:
            F.stern(f, PAD_L + cx, PAD_T + cy + off_rute, st, FL_B, FL_B, FL_B)
    st = F.stern_stufe(i, N, STERN_BLAU[1])
    if st is not None:
        F.stern(f, PAD_L + STERN_BLAU[0][0], PAD_T + STERN_BLAU[0][1] + off_rute, st, FL_B, FL_B, FL_B)
    st = F.stern_stufe(i, N, STERN_BAUCH[1], (0, 1, 1, 0))
    if st is not None:
        F.stern(f, PAD_L + STERN_BAUCH[0][0], PAD_T + STERN_BAUCH[0][1] + low, st, FL_B, FL_B)
    return f


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('gangster-angel', 'Gangster Angel', frames, MS, prev)
    if prev:
        L.streifen(prev + '/gangster-angel-strip.png', frames, spalten=8, scale=4)
