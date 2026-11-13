# -*- coding: utf-8 -*-
"""Idle-Animation für „Black-Thorn Dragon“ (Creature) — Regeln 14/16/17–31 (Schuppen, Knochen, Haut: kein Glanz, kein Feuer).

PICK: [["MotiveGN", 5, 1], ["MotiveGN", 4, 1], ["MotiveGN", 4, 2], ["MotiveGN", 3, 1], ["MotiveGN", 3, 2]]
Quelle: src/black-thorn-dragon.png — der Drache von vorn (46×32 px, 20 Farben), aus DREI Ebenen von MotiveGN.xcf zusammengesetzt (Karten-Positionen: Körper „Black-Thorn Dragon“ (Ebene 5) bei (18,10),
Arme/Beine „Black-Thorn Dragon #2“ (Ebene 4, Figuren 1+2) bei (27,23), Kopf + Dornenknochen „Black-Thorn Dragon #1“ (Ebene 3) bei (31,9) — in der Kartenkunst pixelgenau wiedergefunden, Abweichung nur 81
Hintergrundpixel; die Ebene 2 „Black-Thorn Dragon #…“ ist nur der weiche Schattenfleck unter dem Drachen und gehört nicht zur Figur). Die drei Ebenen liegen einzeln als src/black-thorn-dragon_l5.png / _l4.png / _l3.png
(gleiche 46×32-Leinwand, Quellkoordinaten); Übereinanderlegen (3 über 4 über 5) ergibt exakt src/black-thorn-dragon.png.

Aufruf:   python3 black_thorn_dragon.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/black-thorn-dragon.png + .json

Identifikation (x, y im Sprite, Achse x = 19):
* Flügel (Ebene 5; links x 0–12, rechts x 26–38, y 1–13): schwarzer Spreizknochen oben (y 1), blau-graue Flügelhaut (E (90,90,132), F (49,49,82), Q), graue Flügelfinger (H/L/B).
* Rumpf (Ebene 5, x 11–25, y 3–28): schwarzer Hals mit hellgrauem Halsstreifen (x 17–20, y 5–12), gelber Bauch (G/K/M, x 14–21, y 15–25) mit orangem Unterende (N, y 24–26).
* Schwanz (Ebene 5, x ≥ 26, y ≥ 14): schwarzer Schwanz mit gelb-orangem Rückenkamm (G/K/N), steigt rechts hoch und rollt sich zu einem Haken (x 26–38, y 14–21), unten bei (18–27, 26–27) gelber Schwanzansatz.
* Dornenknochen (Ebene 3, x 32–45, y 14–26): lange, hell-/dunkelgraue Knochendornen (I/O/J) schräg am Schwanz entlang bis rechts unten — gehören zum Schwanz („Black-Thorn“).
* Kopf (Ebene 3, x 13–24, y 0–15): zwei schmale schwarze Hörner mit hellen Knochenstreifen (I/O/J) bei x 13–16 und 21–24, y 0–7; Gesicht schwarz mit zwei roten Augen (links (16,8)(16,9)(17,9)(17,10),
  rechts (21,8)(21,9)(20,9)(20,10); P (181,0,0) / T (231,0,0)); Halsschuppen (B/D grau) x 17–20, y 10–13; zwei weiße Fangzähne (17,14–15) und (20,14–15) (R) — Zähne, KEINE Partikel.
* Arme (Ebene 4, x 9–14 und 23–28, y 14–19): schwarze Arme mit grauen Schuppen und je zwei hellen Krallenpixeln ((9,18)(11,18)(9,19)(11,19) bzw. (26,18)(28,18)(26,19)(28,19)).
* Beine (Ebene 4, x 9–16 und 22–29, y 20–31): schwarze Oberschenkel mit dunkelgrauer Schuppenmitte, unten Füße mit hellen Zehenkrallen (S/J, y 30).
* Zwei hellgraue Pixel (15,5) und (22,5) der Körperebene liegen UNTER den Hörnern (verdeckt) — beim Kopfnicken würden sie aufblitzen; sie wurden in der Körperebene geschwärzt (Ergänzung, siehe unten).
Bleibt fest: Beine/Füße (Bodenwesen: der Schatten auf der Karte liegt direkt unter ihm), Zähne, Hornstreifen, Flügelknochen (bewegen sich nur mit dem Flügel).

Ablauf (60 Frames à 70 ms = 4,2 s), alle Bewegungen unabhängig:
* Flügelschlag (RUNDE 3, Nutzer: „sollte auch mehr mit den Flügeln schlagen“; vorher nur Spaltenversatz +4/−2 px, zweimal pro Schleife): dreimal pro Schleife (Periode 20 Frames = 1,4 s; Abschlag 7, Aufschlag 13 — ein schwerer Drache, kein Flattern).
  Jeder Flügel schwingt als Ganzes um die Schulter (links (11,5|2,5), rechts (26,5|2,5), also am Ende des oberen Flügelknochens) — von 30° über der Ruhelage (Knochen zeigt schräg nach oben, Spitze −3 px über der Oberkante) bis 50° darunter (Flügel hängt schräg nach unten,
  die Haut klappt hinter den Rumpf). Technik wie beim Lunatic Hawk: Rückwärtsabbildung (F.drehen glatt=True, Nächster-Nachbar, keine Mischfarben). Der Schulteransatz (Flügelpixel im Umkreis von 3,2 px um das Gelenk) bleibt am Rumpf stehen (keine Lücke);
  Hintergrundlöcher in der Figur werden mit der Nachbarfarbe geschlossen, fehlende Umrisspixel durch T.umriss_schliessen ergänzt. Die Flügel liegen hinter Rumpf/Arme/Kopf. Frame 0 liegt auf dem Aufschlag bei 38 % des Hubs und ist die Originalpose.
* Atmen (Periode 30, oben in Frames 8–21 und 38–51, versetzt zum Flügel): Zeile 20 (Bauchmitte, Textur) wird eingefügt (L.streck_zeile, Texturmischung): Rumpf, Schwanzansatz, Arme, Flügel und Kopf heben sich 1 px, die Beine bleiben am Boden.
* Kopf nickt (Frames 23–33 und 53–59, außerhalb der Atem-Hebung): der ganze Kopf samt Zähnen senkt sich zusätzlich 1 px (starr, als eigene Ebene — die Körperebene darunter ist vollständig gezeichnet, es entsteht keine Lücke).
* Schwanz schwingt: der Schwanz samt Dornenknochen biegt sich um die Spaltenachse x = 26 (Spitze bis ±3 px, Gefälle höchstens 1 px je Spalte, die Spitze hinkt nach), Periode 20 (3× pro Schleife).
* Füße treten abwechselnd (links Frames 10–15 und 40–45, rechts 25–30 und 55–60): eine Fußzeile entfällt kurz, die Zehenkrallen rücken 1 px hoch.
* Blinzeln (Frames 22–25 und 52–55): beide roten Augen schließen sich (Lid in Gesichtsfarbe Schwarz, halb → zu → zu → halb).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Ergänzungen: (15,5) und (22,5) der Körperebene → Schwarz (0,0,0) (verdeckt, siehe oben); Randpixel-Korrektur (Regel 16): fehlende Umrisspixel an verschobenen Teilen werden in der Umrissfarbe des Originals
(anim_tiere.umriss_schliessen) ergänzt; reißt ein Dorn der Dornenkette (nur über Pixelecken verbunden) beim Schwanzschwingen ab, hängt ihn A.verbinde_luecken8 mit höchstens 3 Pfadpixeln wieder an.
"""
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T
import anim_amorph as A
import anim_drache as D
import anim_flieger as F
import anim_flieger_r3 as R3
import anim_r4_fluegel as R4
import math

N, MS = 60, 70
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 8, 3
BEAT = 15                                          # Flügelschlag: 15 Frames = 1,05 s (4 pro Schleife)

spr = L.lade('black-thorn-dragon')
l5, l4, l3 = (L.lade(f'black-thorn-dragon_{k}') for k in ('l5', 'l4', 'l3'))
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
v5, v4, v3 = L.deckend(l5), L.deckend(l4), L.deckend(l3)

SCHWARZ = (0, 0, 0)
for (x, y) in ((15, 5), (22, 5)):
    assert v3[y, x], 'unter dem Horn'
    l5[y, x, :3] = SCHWARZ                                    # verdeckte hellgraue Pixel (Ergänzung)

# RUNDE 4: beweglicher Flügelteil (wird je Pose neu gezeichnet) = Flügelknochen + Flughaut bis zur Schulter (x ≤ 12, y ≤ 8). Der schmale Hautstreifen am Rumpf entlang (x 10–14, y 9–15) ist am Körper
# angewachsen und bleibt Teil des Rumpfs; dort schließt jede Pose pixelgenau an ((9,8) → (10,9)).
fl_l = v5 & (xx <= 12) & (yy <= 8)
fl_r = fl_l[:, 37::-1]
fl_r = np.concatenate([fl_r, np.zeros((sh, sw - fl_r.shape[1]), bool)], axis=1)
assert (l5[:, 37::-1][fl_l[:, :38]] == l5[:, :38][fl_l[:, :38]]).all() and (fl_r <= v5).all(), 'Flügel nicht spiegelgleich'
tail_m = v5 & (xx >= 26) & (yy >= 14)
torso_m = v5 & ~fl_l & ~fl_r & ~tail_m
kopf_m = v3 & (xx <= 26)
dorn_m = v3 & (xx >= 28)
arme_m = v4 & (yy <= 19)
beine_m = v4 & (yy >= 20)
bein_l = beine_m & (xx <= 19)
bein_r = beine_m & (xx > 19)

RAND = T.rand_farben(spr)
REGEL = T.umriss_regeln(spr, RAND)[2]
ZEILE = 20
BEIN_ZEILE = 27
AUGE_L = [(16, 8), (16, 9), (17, 9), (17, 10)]
AUGE_R = [(21, 8), (21, 9), (20, 9), (20, 10)]


def teil(quelle, maske):
    t, _ = L.trenne(quelle, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)


# ── RUNDE 4 (Nutzer: „Flügelbewegungen katastrophal, komplett neu machen“): handgezeichnete Schlüsselposen statt gedrehter Flügel ─────────────────────────────
# Anatomie: Der graue Flügelknochen läuft von der Schulter (12,4) unter der schwarzen Oberkante zur schwarzen Spitze; darunter hängt die blaue Flughaut, deren Hinterkante von der Spitze schräg zum Rumpf läuft.
# Der Knochen schlägt als Ganzes um die Schulter: U (35° hoch) → O (Original, fast waagerecht) → DM (15° tief) → D (35° tief); Aufschlag mit nachhängender Spitze: A1 (Ansatz schon angehoben, Spitze noch unten) → A2 → U.
# Zeichen = Farben der Körperebene; linkes oberes Zeichen = Sprite-Koordinate (−2, y0). Rechter Flügel = Spiegelbild (Achse x = 18,5).
FARBE = {'A': (0, 0, 0), 'C': (41, 41, 66), 'D': (45, 45, 45), 'E': (49, 49, 82), 'F': (83, 83, 83), 'G': (90, 90, 132), 'H': (112, 112, 112)}
POSEN_TXT = {
    'U': (-5, ["..AA...........",
               "..ADA..........",
               "...AFAA........",
               "...AGHFA.......",
               "....AEGHA......",
               "....AGEGFAA....",
               ".....AGHEFDA...",
               "......AEGGEDAA.",
               ".......AGEHGFDA",
               "........AEGHEDD",
               ".........AGEGFD",
               "..........AGGHG",
               "...........AHGE",
               "...........AGEG"]),
    'DM': (3, [".............AA",
               ".........AAAAFD",
               ".....AAAAFDDDGD",
               ".AAAAHHFFGEGEHG",
               "...AAGEGGEGEHGE",
               ".....AAEGHEGGEG",
               ".......AAAAA..."]),
    'D': (3, ["..............A",
              "............AAD",
              "...........ADDD",
              "..........AFGHG",
              "........AAFEHGE",
              ".......AFFGGGEG",
              ".....AAHEGEG...",
              "....AHHGGHEG...",
              "...AFEGEAAAA...",
              "..AAAAAA......."]),
    'A1': (3, [".............AA",
               "..........AAADD",
               "........AADDDFD",
               "......AAFFGEGHG",
               ".....AHFGEGGHGE",
               "....AHGEGEHEGEG",
               "...AAAAAAAAA...",
               "..AA..........."]),
    'A2': (1, ["......AAAAAA...",
               "...AAAHHFFDDAA.",
               ".AA...AAGGECFDA",
               "........AEGHEDD",
               ".........AGEGFD",
               "..........AGGHG",
               "...........AHGE",
               "...........AGEG"]),
}
FOLGE = ['O', 'O', 'DM', 'DM', 'D', 'D', 'D', 'A1', 'A1', 'A2', 'A2', 'U', 'U', 'U', 'U']      # Abschlag U→O→DM→D zügig, unten kurz halten, Aufschlag mit nachhängender Spitze
assert len(FOLGE) == BEAT


def fluegel_posen():
    links = {'O': teil(l5, fl_l)}
    for name, (y0, zeilen) in POSEN_TXT.items():
        links[name] = R4.pose(zeilen, FARBE, -2, y0, H, W, PAD_L, PAD_T)
    rechts = {n: R4.spiegeln(a, 2 * PAD_L + 37) for n, a in links.items()}
    return links, rechts


def zustand(i):
    ph = L.sinus(i, N / 2)
    atem = 1 if ((i - 8) % 30) < 14 else 0
    nick = 1 if (i in range(23, 34) or i in range(53, 60)) else 0
    bl = 0
    for s in (22, 52):
        bl = max(bl, D.blinzeln(i, s))
    fl = 1 if (i in range(10, 16) or i in range(40, 46)) else 0
    fr = 1 if (i in range(25, 31) or i in range(55, 61)) else 0
    return ph, atem, nick, bl, fl, fr


def frame(i, nur=None):
    ph, atem, nick, bl, fl_, fr_ = zustand(i)
    torso = teil(l5, torso_m)
    schwanz = L.zusammen(H, W, [(teil(l5, tail_m), 0, 0), (teil(l3, dorn_m), 0, 0)])
    arme = teil(l4, arme_m)
    kopf = teil(l3, kopf_m)
    if bl:
        for (x, y) in (AUGE_L + AUGE_R):
            if bl == 2 or y >= 9:
                kopf[PAD_T + y, PAD_L + x, :3] = SCHWARZ
    torso = L.streck_zeile(torso, PAD_T + ZEILE, atem)
    schwanz = L.streck_zeile(schwanz, PAD_T + ZEILE, atem)
    # Schwanz biegt sich (Pivot x = 26)
    schwanz = D.schwanz_biegen(schwanz, PAD_L + 26, 3.0, L.sinus(i, N / 3, 0.0), lauf=1.2, richtung=1)
    name = R4.takt(FOLGE, i)
    wl = L.versetze(FL_L[name], 0, -atem)
    wr = L.versetze(FL_R[name], 0, -atem)
    arme = L.versetze(arme, 0, -atem)
    kopf = L.versetze(kopf, 0, -atem + nick)
    bl_ = L.heben_unten(teil(l4, bein_l), PAD_T + BEIN_ZEILE, fl_)
    br_ = L.heben_unten(teil(l4, bein_r), PAD_T + BEIN_ZEILE, fr_)
    vorn = {'schwanz': schwanz, 'torso': torso, 'bein_l': bl_, 'bein_r': br_, 'arme': arme, 'kopf': kopf}
    wahl = nur or ('fluegel_l', 'fluegel_r') + tuple(vorn)
    ganz = L.zusammen(H, W, [(vorn[n], 0, 0) for n in vorn if n in wahl])
    ganz = R3.luecken_fuellen(ganz, 6, ausser=ORIG_LOECHER)
    ganz, _, _ = A.verbinde_luecken8(ganz, max_len=3)            # ein Dorn, der um eine Ecke weggerutscht wäre, wird kurz wieder angehängt (nur 8er-getrennte Teile)
    ganz = T.umriss_schliessen(ganz, RAND, REGEL)                  # Randpixel-Test (Regel 16) für Körper/Schwanz/Beine; die Flügelposen sind fertig gezeichnet und bleiben unberührt
    return L.zusammen(H, W, [(e, 0, 0) for n, e in (('fluegel_l', wl), ('fluegel_r', wr)) if n in wahl] + [(ganz, 0, 0)])


TEST_EBENEN = None
_m0 = np.zeros((H, W), bool)
_m0[PAD_T:PAD_T + sh, PAD_L:PAD_L + sw] = L.deckend(spr)
ORIG_LOECHER = R3.eingeschlossen(_m0)
FL_L, FL_R = fluegel_posen()


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('black-thorn-dragon', 'Black-Thorn Dragon', frames, MS, prev)
    if prev:
        L.streifen(prev + '/black-thorn-dragon-strip.png', frames, spalten=12, scale=3)
