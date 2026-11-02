# -*- coding: utf-8 -*-
"""Idle-Animation für „Red Dragoneer“ (Creature) — Regeln 14/15 (Haut, Schuppen, Glutbauch: kein Glanz; der Bauch flackert nur als Glut).

PICK: [["MotiveMoe", 6, 1]]   (Ebene „Red Dragoneer“, Figur 1 — einzige Ebene, in der Kartenkunst pixelgenau wiedergefunden; auf Nachbarebenen liegt nichts von der Figur)
Quelle: src/red-dragoneer.png — roter Drache von vorn (32×27 px, 18 Farben) aus MotiveMoe.xcf. Die Karte zeigt ihn schwebend vor rotem Himmel (kein Boden).

Aufruf:   python3 red_dragoneer.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/red-dragoneer.png + .json

Identifikation (x, y im Sprite, symmetrisch um die Mittellinie x = 15,5):
* Flügel (links x 0–10, rechts x 21–31, y 0–12): schräg nach außen oben gespannte Fledermausflügel — dunkle Spreizen (Umriss A), Haut rot (B/C/D/E),
  orange Flügelfelder (G/H/I) bei (3–6, 2–5) und (7–9, 4–10), helle Spitzen/Gelenke (P/N rosa) bei (12–13, 4) bzw. (18–19, 4) an der Kopffalte.
* Kopf (x 11–20, y 3–17): zwei Hörner/Falten (rosa-rot, x 11–12 bzw. 19–20, y 3–13), Gesicht (x 13–18, y 5–17) mit zwei Augen (links (13–14, 11–13): oben schwarz,
  links weiß (Q/O), Pupille blau (R) bei (14,13), rechts gespiegelt (17–18, 11–13)), Schnauze rosa (F/N, x 14–17, y 13–17) mit zwei schwarzen Nasenlöchern (14,16) und (17,16).
* Arme/Schultern (x 5–12 und 19–26, y 13–24): rote Schuppenplatten; Hände unten bei (5–7, 18–21) bzw. (24–26, 18–21).
* WEISSE Pixel: Krallen der Flügelhände — links (3,15)(4,14)(5,14)(5,16)(6,15)(8,15)(8,16), rechts (23,15)(23,16)(25,15)(26,14)(26,16)(27,14)(28,15) — einzelne Pixel am unteren Flügelende, KEINE Partikel;
  unten (9,25)(11,25)(20,25)(22,25) mit grauen Pixeln (10,24)(12,24)(19,24)(21,24) darüber: Zehenkrallen der Füße.
* Feuerbauch (x 14–17, y 18–25): orange Glutplatten (J dunkelorange (189,57,8), I (213,98,16), G (230,131,16), H (246,164,24)).
Bleibt fest: Gesichtszeichnung (außer Blinzeln), Hörner, Schuppenplatten, Krallenpixel (außer Mitbewegung), Zehenkrallen (außer Fußheben).

Ablauf (48 Frames à 70 ms = 3,36 s), alle Bewegungen unabhängig:
* Flügelschlag (D.fluegel_asym: Spitze hebt sich bis 3 px, senkt sich bis 2 px (Rundung)): viermal pro Schleife (Periode 12); beide Flügel schlagen gleichzeitig, der Versatz wächst mit dem Abstand zur Schulter (Spitze −3 … +2 px), die Spitze hinkt nach (F.fluegel_welle,
  Spalten bleiben ganz, Zusammenhang erzwungen); die Flügelkrallen schlagen mit (halber Weg). Ruhepose bei Frame 0.
* Schwebe-Bob: beim Abschlag steigt der ganze Drache bis 1 px (Bob hinkt dem Flügel um 0,6 rad hinterher).
* Atmen (Periode 24, 2× pro Schleife): Zeile 20 (Bauchmitte, Textur) wird eingefügt (L.streck_zeile mit Texturmischung): Kopf, Schultern und Flügelansatz heben sich 1 px, die Füße bleiben.
* Bauchglut: die orangen Bauchplatten flackern in einer von unten nach oben laufenden Welle um eine Farbstufe (Periode 12).
* Füße heben sich abwechselnd (links in Frames 6–11, 30–35; rechts in 18–23, 42–47): eine Fußzeile entfällt kurz (L.heben_unten), die Zehenkrallen rücken 1 px hoch.
* Blinzeln (Frames 14–17 und 38–41): Lid in Gesichtsfarbe über beide Augen (halb, zu, zu, halb).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Ergänzungen: keine Pixel erfunden; Randpixel-Korrektur (Regel 16): wo ein verschobener Flügelrand/Fuß eine Füllfarbe an die Außenkante bringt, wird ein Umrisspixel
in der Umrissfarbe des Originals (anim_tiere.umriss_schliessen) ergänzt.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T
import anim_drache as D

N, MS = 48, 70
PAD_L, PAD_R, PAD_T, PAD_B = 6, 6, 9, 6

spr = L.lade('red-dragoneer')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

KRALLEN_FARBEN = [(213, 213, 213), (255, 255, 255), (230, 238, 238)]
weiss = L.farbmaske(spr, KRALLEN_FARBEN)
flügel_l = vorhanden & (xx <= 10) & (yy <= 12)
flügel_r = vorhanden & (xx >= 21) & (yy <= 12)
klauen_l = weiss & (xx <= 9) & (yy >= 14) & (yy <= 16)
klauen_r = weiss & (xx >= 22) & (yy >= 14) & (yy <= 16)
fuss_l = vorhanden & (xx <= 12) & (yy >= 22) & ~klauen_l
fuss_r = vorhanden & (xx >= 19) & (yy >= 22) & ~klauen_r
koerper = vorhanden & ~flügel_l & ~flügel_r & ~klauen_l & ~klauen_r & ~fuss_l & ~fuss_r

RAND = T.rand_farben(spr)
REGEL = T.umriss_regeln(spr, RAND)[2]
ZEILE = 20                                         # Bauchmitte: hier wird beim Atmen eine Zeile eingefügt
FUSS_ZEILE = 22                                    # hier entfällt beim Fußheben eine Zeile
WAND_L, WAND_R = PAD_L + 11, PAD_L + 20            # Flügelgelenke (Leinwandspalten)

# Gesicht
AUGEN_L = [(13, 11), (14, 11), (13, 12), (14, 12), (13, 13), (14, 13)]
AUGEN_R = [(18, 11), (17, 11), (18, 12), (17, 12), (18, 13), (17, 13)]
LID = {(13, 11): (130, 43, 43), (14, 11): (130, 43, 43), (13, 12): (210, 121, 121), (14, 12): (210, 121, 121), (13, 13): (202, 97, 97), (14, 13): (202, 97, 97)}
LID.update({(31 - x, y): c for (x, y), c in list(LID.items())})
for k in list(LID):
    assert tuple(LID[k]) in {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}, 'Lidfarbe nicht in der Quelle'

BAUCH = [(189, 57, 8), (213, 98, 16), (230, 131, 16), (246, 164, 24)]       # Rampe dunkel → hell (J, I, G, H)
bauch_m = np.zeros((H, W), bool)
bauch_m[PAD_T + 18:PAD_T + 26, PAD_L + 14:PAD_L + 18] = True


def teil(maske):
    return D.abschnitt(spr, maske, H, W, PAD_L, PAD_T)


def ph_fluegel(i):
    return L.sinus(i, N / 4)


def zustand(i):
    ph = ph_fluegel(i)
    bob = -int(round(0.7 * (math.sin(ph - 0.6) + math.sin(0.6))))
    atem = 1 if (i % 24) in range(4, 17) else 0
    fl = 1 if (i % 24) in range(6, 12) else 0                   # linker Fuß gehoben
    fr = 1 if (i % 24) in range(18, 24) else 0
    blink = 0
    for s in (14, 38):
        blink = max(blink, D.blinzeln(i, s))
    return ph, bob, atem, fl, fr, blink


def frame(i, nur=None):
    ph, bob, atem, fl_, fr_, blink = zustand(i)
    k = teil(koerper)
    if blink:
        pix = {p: LID[p] for p in (AUGEN_L + AUGEN_R) if (blink == 2 or p[1] >= 12)}
        for (x, y), c in pix.items():
            k[PAD_T + y, PAD_L + x, :3] = c
    # Bauchglut flackert
    k = D.glut_farben(k, bauch_m, BAUCH, i, N, periode=12)
    k = L.streck_zeile(k, PAD_T + ZEILE, atem)
    fuss_a = L.heben_unten(teil(fuss_l), PAD_T + FUSS_ZEILE, fl_)
    fuss_b = L.heben_unten(teil(fuss_r), PAD_T + FUSS_ZEILE, fr_)
    # Flügel (beide Seiten), heben sich mit dem Atmen mit
    wl = teil(flügel_l)
    wr = teil(flügel_r)
    rest = L.platz((koerper | fuss_l | fuss_r).astype(np.uint8)[..., None].repeat(4, 2) * 255, H, W, PAD_L, PAD_T)[..., 3] > 0
    wl, dys_l = D.fluegel_asym(wl, WAND_L, ph, 3.4, 1.7, lauf=0.5, nur_rechts=False)
    wr, dys_r = D.fluegel_asym(wr, WAND_R, ph, 3.4, 1.7, lauf=0.5, nur_rechts=True)
    kl = L.versetze(teil(klauen_l), 0, int(round(0.5 * dys_l.get(PAD_L + 9, 0))) - atem)       # Flügelkrallen schlagen mit (halber Weg, Spalte 9)
    kr = L.versetze(teil(klauen_r), 0, int(round(0.5 * dys_r.get(PAD_L + 22, 0))) - atem)
    wl = L.versetze(wl, 0, -atem)
    wr = L.versetze(wr, 0, -atem)
    ebenen = {'fuss_l': fuss_a, 'fuss_r': fuss_b, 'koerper': k, 'fluegel_l': wl, 'fluegel_r': wr, 'klauen_l': kl, 'klauen_r': kr}
    wahl = nur or tuple(ebenen)
    ganz = L.zusammen(H, W, [(ebenen[n], 0, bob) for n in wahl])
    return T.umriss_schliessen(ganz, RAND, REGEL)                  # Randpixel-Test (Regel 16)


TEST_EBENEN = None


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('red-dragoneer', 'Red Dragoneer', frames, MS, prev)
    if prev:
        L.streifen(prev + '/red-dragoneer-strip.png', frames, spalten=12, scale=4)
