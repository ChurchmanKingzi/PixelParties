# -*- coding: utf-8 -*-
"""Idle-Animation für „Red Dragoneer“ (Creature) — Regeln 14/15 (Haut, Schuppen, Glutbauch: kein Glanz; der Bauch flackert nur als Glut).

PICK: [["MotiveMoe", 6, 1]]   (Ebene „Red Dragoneer“, Figur 1 — einzige Ebene, in der Kartenkunst pixelgenau wiedergefunden; auf Nachbarebenen liegt nichts von der Figur)
Quelle: src/red-dragoneer.png — roter Drache von vorn (32×27 px, 18 Farben) aus MotiveMoe.xcf. Die Karte zeigt ihn schwebend vor rotem Himmel (kein Boden).

RUNDE 5 (Nutzer: „Schlägt jetzt nur mit der oberen Hälfte der Flügel statt mit den ganzen“): Der GANZE Flügel (Arm-Streifen x 7–10 bis zur Schulter, Flügelhand, Flughaut, heller Knauf) schlägt als starre Einheit um das
Schultergelenk (9,5 | 12,5), +20° … −22° (siehe WINKEL); die handgezeichneten Posen aus Runde 4 (unterer Streifen blieb stehen) sind ersetzt. Ergänzt: Kopfumriss (11,5)/(20,5) unter dem Knauf. Atmen über anim_textur.

RUNDE 4 (Nutzer: „Die helleren ‚Spitzen‘ gehören mit zu den Flügeln! Außerdem entstehen Lücken zwischen den Krallen und Händen?“): Die Flügel werden nicht mehr gedreht, sondern laufen über fünf handgezeichnete
Schlüsselposen (U, O = Original, M, D, MA; siehe POSEN_TXT/FOLGE). Der helle Gelenkknauf (11–13, 3–5) ist jetzt Teil des Flügels (Drehpunkt des Flügelknochens). Die weißen Krallen sind fest mit den Händen verbunden
(keine eigene Ebene mehr). Die Angaben zum Flügelschlag unter „Ablauf“ (Drehung, Krallen folgen) sind damit ersetzt; alles andere ist unverändert.

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
* Flügelschlag (RUNDE 3, Nutzer: „muss mehr mit den Flügeln schlagen“; vorher nur Spaltenversatz ±3 px): viermal pro Schleife (Periode 12 Frames = 840 ms; Abschlag 4 Frames, Aufschlag 8). Jeder Flügel schwingt jetzt als Ganzes um das Schultergelenk
  (links (9,5|12), rechts (21,5|12)) — von etwa 25° über der Ruhelage (Spitze fast senkrecht über der Schulter) bis 40° darunter (Spitze zeigt waagerecht nach außen, Spitzenweg ≈ 15 px statt 5 px). Technik wie beim Lunatic Hawk: Rückwärtsabbildung
  (F.drehen glatt=True, Nächster-Nachbar, keine Mischfarben). Der Flügelansatz (Flügelpixel im Umkreis von 3,3 px um das Gelenk) bleibt am Körper stehen (keine Lücke); Hintergrundlöcher in der Figur werden mit der Nachbarfarbe geschlossen,
  fehlende Umrisspixel durch T.umriss_schliessen ergänzt. Die weißen Flügelkrallen (Hände) folgen mit einem Viertel des Spitzenwegs. Frame 0 liegt auf dem Aufschlag bei 38 % des Hubs und ist die Originalpose.
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
import anim_flieger as F
import anim_flieger_r3 as R3
import anim_r5_fluegel as R5
import anim_textur as TX

N, MS = 48, 70
PAD_L, PAD_R, PAD_T, PAD_B = 10, 10, 9, 3
BEAT, DOWN, UP = 12, 4, 8                            # Flügelschlag (4 pro Schleife)
P0 = DOWN + 0.62 * UP                              # Frame 0 = Aufschlag bei 38 % des Hubs (Originalpose)

spr = L.lade('red-dragoneer')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

KRALLEN_FARBEN = [(213, 213, 213), (255, 255, 255), (230, 238, 238)]
weiss = L.farbmaske(spr, KRALLEN_FARBEN)
# RUNDE 4: Zum Flügel gehören auch die hellen „Spitzen“ am inneren Ende des Flügelknochens (links (11,3)(11,4)(11,5)(12,4)(13,4) samt Umriss (10–11,2)(12–13,3)) — sie blieben vorher wie Ohren am Kopf stehen.
# Die Spalte x = 10 ab y = 6 ist der Umriss des Ohrs (x 11–12, y 6–10) und bleibt am Kopf, ebenso die Schulterzeile y = 12.
flügel_l = vorhanden & (((xx <= 9) & (yy <= 11)) | ((xx == 10) & (yy <= 5)) | ((xx >= 11) & (xx <= 13) & (yy <= 3)) | ((xx >= 11) & (xx <= 13) & (yy == 4)) | ((xx == 11) & (yy == 5)))
flügel_r = flügel_l[:, ::-1].copy()
assert (spr[:, ::-1][flügel_l] == spr[flügel_l]).all(), 'Flügel nicht spiegelgleich'
fuss_l = vorhanden & (xx <= 12) & (yy >= 22)
fuss_r = vorhanden & (xx >= 19) & (yy >= 22)
koerper = vorhanden & ~flügel_l & ~flügel_r & ~fuss_l & ~fuss_r      # RUNDE 4: die weißen Krallen gehören zu den Händen und bleiben fest an ihnen (keine eigene Ebene mehr → keine Lücke Kralle/Hand)

RAND = T.rand_farben(spr)
REGEL = T.umriss_regeln(spr, RAND)[2]
ZEILE = 20                                         # Bauchmitte: hier wird beim Atmen eine Zeile eingefügt
FUSS_ZEILE = 22                                    # hier entfällt beim Fußheben eine Zeile

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


def welle(t):
    """0 = Flügel ganz oben … 1 = ganz unten (nur noch für den Schwebe-Bob; der Flügel selbst läuft über die Posenfolge)."""
    u = (t + P0) % BEAT
    if u < DOWN:
        return 0.5 - 0.5 * math.cos(math.pi * u / DOWN)
    return 0.5 + 0.5 * math.cos(math.pi * (u - DOWN) / UP)


# ── RUNDE 5 (Nutzer: „schlägt jetzt nur mit der oberen Hälfte der Flügel statt mit den ganzen“) ──────────────────────────────────────────────────────────────
# Anatomie (linker Flügel; der rechte ist das Spiegelbild): Der Flügelarm steigt von der Schulter (8–9, 12) als schmaler Streifen (x 7–10, y 5–11, orange Flughaut außen) nach oben; am Handgelenk (8, 5) knickt die
# Flügelhand nach außen oben zur Spitze (0, 0) ab, nach innen zeigt der helle Daumen/Knauf (11–13, 3–5). Das GANZE (Arm + Hand + Flughaut bis zum unteren Ende + heller Knauf) schlägt als starre Einheit um das
# Schultergelenk GELENK = (9,5 | 12,5); nichts bleibt stehen. Je Winkel wird der Flügel neu aufgebaut (anim_r5_fluegel.starr_gedreht: glatte Fläche, Innenfarben der Quelle) und sein Umriss neu gezogen (immer 1 px);
# er liegt hinter Kopf/Körper (beim Aufschlag verschwindet der Knauf hinter dem Kopf, beim Abschlag löst er sich vom Kopf). Frame 0 = Originalpixel.
GELENK = (9.5, 12.5)
UMRISS_FL = (49, 24, 0)
#          Winkel in Grad (+ = Spitze hebt sich); 12 Frames je Schlag: Abschlag Frames 3→7 (schnell), Aufschlag 7→3
WINKEL = [None, 10, 17, 20, 10, -6, -18, -22, -21, -16, -10, -5]
assert len(WINKEL) == BEAT
ERG = [(11, 5), (20, 5)]                                       # Ergänzung: Kopfumriss unter dem Flügelknauf (verbindet Ohrspitze (11,6) und Stirnkante (12,5) über eine Kante, sobald der Flügel wegschwingt)


def fluegel_posen():
    orig = D.abschnitt(spr, flügel_l, H, W, PAD_L, PAD_T)
    vorn = np.zeros((H, W), bool)
    vorn[PAD_T:PAD_T + sh, PAD_L:PAD_L + sw] = vorhanden & ~flügel_l & ~flügel_r
    for (x, y) in ERG:
        vorn[PAD_T + y, PAD_L + x] = True
    links = []
    for g in WINKEL:
        if g is None:
            links.append(orig)
            continue
        a = R5.starr_gedreht(orig, PAD_L + GELENK[0], PAD_T + GELENK[1], math.radians(g), UMRISS_FL)
        links.append(R5.umriss_ziehen(a, vorn, UMRISS_FL))
    rechts = [R5.spiegeln(a, 2 * PAD_L + sw - 1) for a in links]
    return links, rechts


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
    bob = -int(round(1.0 * (welle(i - 1.0) - welle(-1.0)) / (1.0 - welle(-1.0))))      # Bob folgt dem Abschlag (Frame 0 = 0)
    k = teil(koerper)
    if blink:
        pix = {p: LID[p] for p in (AUGEN_L + AUGEN_R) if (blink == 2 or p[1] >= 12)}
        for (x, y), c in pix.items():
            k[PAD_T + y, PAD_L + x, :3] = c
    # Bauchglut flackert
    k = D.glut_farben(k, bauch_m, BAUCH, i, N, periode=12)
    k = TX.streck_zeile(k, PAD_T + ZEILE, atem)                 # Runde 5: texturierte Streckzeile (anim_textur)
    fuss_a = L.heben_unten(teil(fuss_l), PAD_T + FUSS_ZEILE, fl_)
    fuss_b = L.heben_unten(teil(fuss_r), PAD_T + FUSS_ZEILE, fr_)
    # Flügel (beide Seiten): handgezeichnete Schlüsselpose des Frames, hinter dem Körper, hebt sich mit dem Atmen mit
    wl = L.versetze(FL_L[i % BEAT], 0, -atem)
    wr = L.versetze(FL_R[i % BEAT], 0, -atem)
    vorn = {'fuss_l': fuss_a, 'fuss_r': fuss_b, 'koerper': k}
    wahl = nur or ('fluegel_l', 'fluegel_r') + tuple(vorn)
    ganz = L.zusammen(H, W, [(vorn[n], 0, bob) for n in vorn if n in wahl])
    ganz = R3.luecken_fuellen(ganz, 5, ausser=np.roll(ORIG_LOECHER, bob, axis=0))
    ganz = T.umriss_schliessen(ganz, RAND, REGEL)                  # Randpixel-Test (Regel 16) für Körper und Füße; die Flügelposen sind fertig gezeichnet und bleiben unberührt
    erg = L.leer(H, W)
    for (x, y) in ERG:
        erg[PAD_T + y - atem, PAD_L + x] = UMRISS_FL + (255,)
    f = L.zusammen(H, W, [(erg, 0, bob)] + [(e, 0, bob) for n, e in (('fluegel_l', wl), ('fluegel_r', wr)) if n in wahl] + [(ganz, 0, 0)])
    return R5.loecher_schliessen(f, np.roll(ORIG_LOECHER, bob - atem, axis=0) | np.roll(ORIG_LOECHER, bob, axis=0), UMRISS_FL)      # schmale Schlitze (≤ 4 px) zwischen Flügelarm und Kopf schließen


TEST_EBENEN = None
_m0 = np.zeros((H, W), bool)
_m0[PAD_T:PAD_T + sh, PAD_L:PAD_L + sw] = vorhanden
ORIG_LOECHER = R3.eingeschlossen(_m0)
FL_L, FL_R = fluegel_posen()


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('red-dragoneer', 'Red Dragoneer', frames, MS, prev)
    if prev:
        L.streifen(prev + '/red-dragoneer-strip.png', frames, spalten=12, scale=4)
