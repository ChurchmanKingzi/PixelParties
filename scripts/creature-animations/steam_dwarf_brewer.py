# -*- coding: utf-8 -*-
"""Idle-Animation für „Steam Dwarf Brewer“ (Creature) — der Dampfzwerg mit den drei Dampfrohren, dem weißen Bart (mit LAVA-SUPPE-Spritzern) und dem Fass mit brodelnder LAVA-SUPPE.

Quelle: src/steam-dwarf-brewer.png (34×29 px, 34 Farben) = Komposit aus drei Ebenen derselben xcf + ergänzter Suppe (Positionen per Template-Matching mit der Kartenkunst Steam_Dwarf_Brewer.png abgeglichen):
PICK: [["MotiveSteamDwarfs", 441, 1], ["MotiveSteamDwarfs", 443, 5], ["MotiveSteamDwarfs", 440, 1]]
  * Ebene 441 (Figur 1, 24×28 px): der Zwerg bei (0, 0)                              → src/steam-dwarf-brewer-zwerg.png
  * Ebene 443 (Figur 5, 16×14 px): das auf der Seite liegende FASS (grauer Stahlzylinder, rechts die Stirnfläche) bei (18, 15) → src/steam-dwarf-brewer-fass.png
    Es liegt in der Kartenkunst HINTER dem Zwerg (der rechte Ärmel verdeckt die linke obere Fasspartie).
  * Ebene 440 („Ebene #87“, 10×9 px, 33 Pixel in gelb/orange) bei (6, 18): die LAVA-SUPPE-SPRITZER im Bart (in der Kunst sichtbar als gelbe/orange Flecken unten im Bart) — fehlten in der alten Fassung.
  Nutzerfeedback: „Beim Brewer sollte noch was von der Lava-Suppe in dem Fass zu sehen sein.“ Die Fassebene hat in der Kunst unten rechts an der Stirnfläche einen Ausschnitt (Ebene 442 „Ebene #86“, 5×5 px, 15 % deckend,
  liegt genau dort). Annahme: das Fass liegt auf der Seite, die Stirnseite ist offen und die Lava-Suppe steht darin. ERGÄNZT (von mir gezeichnet): die untere Hälfte der Stirnfläche (Komposit x 29–32, y 22–26: 17 Suppenpixel) ist mit
  Lava-Suppe gefüllt, dazu 5 Umrisspixel in Fassumriss C (43,43,43) bei (33,23), (33,24), (32,25), (32,26), (31,27) (schließen die Fassrundung). Suppenfarben = die vier Spritzerfarben der Ebene 440 (255,186,90), (255,211,107),
  (255,231,148), (255,255,189). Die anderen Fässer der Ebene 443 (aufrecht, zwei davon mit offener Lava-Suppe) stehen in der Kunst weit weg und sind kein Teil dieser Figur.
Aufruf:   python3 steam_dwarf_brewer.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/steam-dwarf-brewer.png + .json

Was im Sprite ist (x, y im 34×29-Komposit):
* DREI DAMPFROHRE (grau: G (62,62,62) < B (81,81,81) < L (108,108,108)): links schräg (x 1–5, y 0–10), Mitte senkrecht (x 9–12, y 0–8), rechts schräg (x 15–20, y 0–10); oben offen (Dampf).
* KOPF: kahl, Haut (246,189,123); dunkelbraune Haarkranzkante Q (49,24,0) in Zeile 8, seitlich Haarbüschel.
* GESICHT: ein grauer Metallstreifen (Helm-/Brillenband, y 13–15, x 4–8 und 13–17) quer über die Augen; die Augen sind zwei schwarze „^“-Bögen (zugekniffen/fröhlich) — KEINE offenen Augen, also kein Blinzeln.
* BART: großer weißer Bart (y 16–26, x 6–15), grauer Umriss seitlich; unten im Bart die LAVA-SUPPE-SPRITZER (gelb/orange, 33 Pixel, x 6–15, y 18–26).
* ÄRMEL/UMHANG: links (x 0–5, y 16–26) und rechts (x 16–23, y 16–23) dunkelrot mit schwarzem Umriss. Der rechte Ärmel reicht über das Fass (Hand am Fass).
* FASS (x 18–33, y 15–28): grauer Stahlzylinder auf der Seite (Umriss C (43,43,43), Stahlrampe D (89,89,89) < F (137,137,137) < J (160,160,160) < N (205,205,205), senkrechte Lichtstreifen), rechts die Stirnfläche
  (x 29–32, y 16–21 Stahl; darunter die Suppe, y 22–26).
Metall im Sprite: Rohre, Metallstreifen, Fass (Regel 14) — nur dort Glanz; die Suppe wallt/brodelt (Regel 15, Farbwandern + Blasen), glänzt aber nicht.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* Auf und ab (Periode 24 = zweimal pro Schleife): Brust zuerst 1 px (Bartzeile 21 wird einmal doppelt eingefügt: Kopf, Rohre, Bart (samt Spritzern), Ärmel steigen), das Fass bleibt stehen.
* Dampfrohre zittern (Dampfdruck): die obersten drei Rohrzeilen jedes Rohrs schlagen ±1 px seitlich aus (links/rechts Periode 12 gegenphasig, Mitte Periode 16), jedes Rohr bleibt 4-verbunden.
* Rechter Ärmel (Hand am Fass) tippt/rührt: er hebt sich 1 px (Frames 6–11, 30–35) und sinkt wieder; das Fass darunter ist vollständig, es wird nichts Fehlendes freigelegt.
* LAVA-SUPPE im Fass (Regel 15/29, „Lava wie Magma“): die 17 Suppenpixel wandern auf der Farbrampe (255,186,90) < (255,211,107) < (255,231,148) < (255,255,189) als Wellenmuster (je Pose 2 Frames, 12 Posen, Periode 24 Frames),
  die obere Randzeile (y 22) schwappt (Pixel wechseln zwischen Suppe und Stahl), zwei Blasen (hellste Farbe) steigen in der Suppe auf und platzen (Periode 24, gegeneinander versetzt). Kein Glanz.
* LAVA-SUPPE-Spritzer im Bart: die 33 Spritzerpixel driften langsam auf derselben Rampe (±1 Stufe, Periode 16 bzw. 24, je Pixel entgegengesetzt), Frame 0 = Original.
* Dampf: aus allen drei Rohren steigen kleine runde Wölkchen (anim_dwarf.puff: 2×2 → 5×3/4×4 → 2×2, Weiß/Hellgrau aus dem Bart) langsam bis 7 px auf, je Rohr zwei Wölkchen um eine halbe Periode versetzt (Periode 24), und zwei
  Wölkchen steigen aus der heißen Suppe (rechts am Fass) auf.
* Metall glänzt (Regel 12/14: nur Metall): ein Lichtband läuft zweimal pro Schleife (Frames 3–16 und 27–40) diagonal über Rohre und Metallstreifen, danach (Frames 9–22 und 33–46) über das Stahlfass; je ein vierzackiger
  Glitzer-Stern an der linken Rohrspitze (Frames 10–13), an der rechten (26–29) und am Metallstreifen rechts (40–43).
Frame 0 = Original (Ruhepose), Dampf/Glitzer ausgenommen. Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle (die Suppenfarben stehen in der Quelle: Ebene 440).
"""
import math
import sys

import numpy as np

import anim_dwarf as Dw
import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 62
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 11, 2

spr = L.lade('steam-dwarf-brewer')                    # Komposit (Zwerg + Fass + Spritzer + Suppe): Referenz für Ruhepose und Randpixel-Test
zw = L.lade('steam-dwarf-brewer-zwerg')               # nur der Zwerg (24×28) — alle Masken/Koordinaten unten beziehen sich auf ihn
FASS = L.lade('steam-dwarf-brewer-fass')              # das liegende Fass (16×14), ohne Suppe
FASS_POS = (18, 15)
ch, cw = spr.shape[:2]
sh, sw = zw.shape[:2]
H, W = ch + PAD_T + PAD_B, cw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(zw)


def f(x, y):
    return tuple(int(v) for v in zw[y, x, :3])


PIPE_RAMPE = [(62, 62, 62), (81, 81, 81), (108, 108, 108), (156, 156, 156), (189, 189, 189)]
BAND_RAMPE = [(106, 106, 106), (156, 156, 156), (189, 189, 189), (213, 213, 213)]
UMHANG_RAMPE = [(23, 0, 0), (47, 0, 0), (52, 0, 0), (61, 0, 0), (84, 0, 0), (110, 0, 0)]
WEISS, HELLGRAU, MITTELGRAU = (246, 255, 255), (213, 213, 213), (189, 189, 189)
UMHANG_FARBEN = {(0, 0, 0), (84, 0, 0), (61, 0, 0), (23, 0, 0), (110, 0, 0), (47, 0, 0), (52, 0, 0), (32, 24, 0), (27, 27, 27)}
SUPPE = [(255, 186, 90), (255, 211, 107), (255, 231, 148), (255, 255, 189)]       # Lava-Suppe-Rampe (dunkel → hell), Farben der Ebene 440
FASS_UMRISS = (43, 43, 43)

# Suppenpixel im Fass (Komposit-Koordinaten) + Umrisspixel; Fass-lokal = Komposit − FASS_POS
SUPPE_ZELLEN = [(x, 22) for x in range(29, 33)] + [(x, 23) for x in range(29, 33)] + [(x, 24) for x in range(29, 33)] + [(x, 25) for x in range(29, 32)] + [(x, 26) for x in (30, 31)]
SUPPE_UMRISS = [(33, 23), (33, 24), (32, 25), (32, 26), (31, 27)]
SUPPE_STAHL = {(29, 22): (89, 89, 89), (30, 22): (89, 89, 89), (31, 22): (89, 89, 89), (32, 22): (137, 137, 137)}   # Stahlfarbe der Stirnfläche, wenn die Oberfläche in der Zeile y 22 „zurückweicht“

# Spritzer im Bart (Zwerg-Koordinaten): alle Pixel des Komposits in Suppenfarben im Bartbereich
FLECKEN = {(x, y): SUPPE.index(tuple(int(v) for v in spr[y, x, :3])) for y in range(16, 28) for x in range(4, 18)
           if spr[y, x, 3] and tuple(int(v) for v in spr[y, x, :3]) in SUPPE}

# Teile
arm_l = vorhanden & (((xx <= 4) & (yy == 16)) | ((xx <= 5) & (yy >= 17)))
arm_r = vorhanden & (((xx >= 17) & (yy == 16)) | ((xx >= 16) & (yy >= 17)))
for m in (arm_l, arm_r):                                   # nur dunkle Umhangfarben (Bartumrisse bleiben beim Kopfteil)
    for (y, x) in zip(*np.nonzero(m)):
        if f(x, y) not in UMHANG_FARBEN:
            m[y, x] = False
kopfteil = vorhanden & ~arm_l & ~arm_r

KANTE0 = Hm.kantenmaske(zw)
ERLAUBT = Hm.umrissfarben(spr)                             # Farben der Außenkante im Original (Regel 16)


def maske(bed):
    return np.array([[bool(vorhanden[y, x] and bed(x, y)) for x in range(sw)] for y in range(sh)])


m_rohr = maske(lambda x, y: y <= 10 and f(x, y) in PIPE_RAMPE and not KANTE0[y, x])
m_band = maske(lambda x, y: 13 <= y <= 16 and f(x, y) in BAND_RAMPE and x not in range(9, 13) and not KANTE0[y, x])

ROHRE = {'l': (0, 6), 'm': (8, 13), 'r': (14, 22)}               # x-Bereich je Rohr (Rohre sind zeilenweise getrennt)


def rohr_stufe(i, name):
    if name == 'l':
        v = 2.0 * math.sin(L.sinus(i, N / 4))
    elif name == 'r':
        v = -2.0 * math.sin(L.sinus(i, N / 4))
    else:
        v = 1.5 * math.sin(L.sinus(i, N / 3))
    return max(-1, min(1, int(round(v))))                      # nur ±1 px


def teil(maske_):
    t, _ = L.trenne(zw, maske_)
    return L.platz(t, H, W, PAD_L, PAD_T)


# Fass: Innenpixel für den Glanz (Umrisspixel bleiben unverändert)
FASS_RAMPE = [(43, 43, 43), (89, 89, 89), (137, 137, 137), (160, 160, 160), (205, 205, 205)]
m_fass = L.deckend(FASS) & ~Hm.kantenmaske(FASS)
FASS_OFF = (PAD_L + FASS_POS[0], PAD_T + FASS_POS[1])


def suppe_idx(x, y, i):
    """Index (0…3) der Suppenrampe für Pixel (x, y) im Frame i: Wellenmuster, alle 2 Frames eine neue Pose, Periode 24 Frames."""
    j = i // 2
    v = math.sin(2 * math.pi * j / 12 - 1.1 * x - 0.9 * y) + 0.5 * math.sin(2 * math.pi * j / 6 + 1.7 * x + 0.4 * y + 1.0)
    return max(0, min(3, int((v + 1.5) / 3.0 * 4)))


def suppe_punkte(i):
    """{(x, y): Farbe} der Suppenpixel (Komposit-Koordinaten) im Frame i, mit Randzeilen-Schwappen und Blasen."""
    j = i // 2
    pts = {}
    for (x, y) in SUPPE_ZELLEN:
        pts[(x, y)] = SUPPE[suppe_idx(x, y, i)]
    for (x, y), c in SUPPE_STAHL.items():                    # Oberfläche (Zeile 22) schwappt: Suppe oder Stahl
        if math.sin(2 * math.pi * j / 12 + 1.3 * x + 0.5) < -0.25:
            pts[(x, y)] = c
    # Blasen: steigen in vier Posen (je 2 Frames) von unten nach oben und platzen (verschwinden); zwei Blasen, gegeneinander versetzt
    for (bx, bj0, reihen) in ((30, 1, (25, 24, 23, 22)), (31, 7, (25, 24, 23, 22))):
        k = (j - bj0) % 12
        if k < len(reihen):
            y = reihen[k]
            if (bx, y) in pts and pts[(bx, y)] in SUPPE:
                pts[(bx, y)] = SUPPE[3]
    return pts


def frame(i, dampf=True, nur=None):
    if nur:
        dampf = False
    kp = teil(kopfteil)
    al = teil(arm_l)
    ar = teil(arm_r)
    # --- Lava-Suppe-Spritzer im Bart: Farbwandern ±1 Stufe (Frame 0 = Original) ---
    for n_, ((x, y), idx) in enumerate(sorted(FLECKEN.items())):
        s = 1 if n_ % 2 == 0 else -1
        per = 16 if n_ % 3 else 24
        d = int(round(1.2 * math.sin(2 * math.pi * i / per))) * s
        Hm.setze(kp, {(x, y): SUPPE[max(0, min(3, idx + d))]}, OFF)
    # --- Metallglanz (Regel 14: nur Metall = Rohre und Metallstreifen; Bart, Umhang, Suppe und Dampf glänzen NICHT) ---
    for start in (3, 27):
        Hm.lichtband(kp, m_rohr, OFF, i, N, start, 14, PIPE_RAMPE, stufen=1, breite=3.0, achse=(1.0, 1.0), kern=2)
        Hm.lichtband(kp, m_band, OFF, i, N, start, 14, BAND_RAMPE, stufen=1, breite=3.0, achse=(1.0, 1.0), kern=2)
    # --- Dampfrohre zittern (je Rohr eigener Ausschlag) ---
    for name, (x0, x1) in ROHRE.items():
        a = rohr_stufe(i, name)
        if a:
            Hm.bereich_versatz(kp, OFF, {y: a for y in (0, 1, 2)}, x0, x1)
    # --- Auf und ab: Bartzeile 21 wird einmal doppelt eingefügt (Spritzer steigen mit) ---
    brust = Hm.stufe(i, N / 2, 1)
    if brust:
        kp = L.streck_zeile(kp, PAD_T + 21, brust)
        al = L.streck_zeile(al, PAD_T + 21, brust)
        ar = L.streck_zeile(ar, PAD_T + 21, brust)
    # --- rechter Ärmel (Hand am Fass) hebt sich 1 px; das Fass darunter ist vollständig ---
    if Hm.folge(i, 6, [1] * 6, N) or Hm.folge(i, 30, [1] * 6, N):
        ar = L.versetze(ar, 0, -1)
    # --- das Fass liegt hinter dem Zwerg; Stahl glänzt, Suppe wallt ---
    fa = L.platz(FASS, H, W, FASS_OFF[0], FASS_OFF[1])
    for start in (9, 33):
        Hm.lichtband(fa, m_fass, FASS_OFF, i, N, start, 14, FASS_RAMPE, stufen=1, breite=3.0, achse=(1.0, 1.0), kern=1)
    Hm.setze(fa, {(x, y): FASS_UMRISS for (x, y) in SUPPE_UMRISS}, OFF)
    Hm.setze(fa, suppe_punkte(i), OFF)
    fig = L.zusammen(H, W, [(fa, 0, 0), (al, 0, 0), (ar, 0, 0), (kp, 0, 0)])
    Hm.kontur_schliessen(fig, ERLAUBT, (0, 0, 0))                 # Regel 16: Außenkante in jeder Pose in Umrissfarbe (z. B. am Umhang)
    # --- Glitzer-Sterne an den Rohrspitzen und am Metallstreifen (Effekt über der Figur, mit dem Kopf mitgehoben) ---
    gl = L.leer(H, W)
    for (sx, sy, start) in (() if nur else ((2, 1, 10), (19, 1, 26), (16, 13, 40))):
        st = Hm.folge(i, start, [0, 1, 2, 1], N)
        Hm.stern4(gl, sx, sy - brust, st, WEISS, HELLGRAU, MITTELGRAU, OFF)
    ebenen = []
    if dampf:
        py = PAD_T - 2
        spec = []
        for cx, off0, form in ((PAD_L + 2, 0, 'm'), (PAD_L + 11, 8, 'o'), (PAD_L + 19, 16, 'm')):
            spec.append(dict(x=cx, y=py, vx=0, vy=-7, off=off0, form=form, wackeln=0.8))
            spec.append(dict(x=cx, y=py, vx=0, vy=-7, off=off0 + 12, form='o' if form == 'm' else 'm', wackeln=-0.8))
        for cx, off0 in ((PAD_L + 31, 3), (PAD_L + 32, 15)):                         # heiße Suppe dampft (rechts am Fass, über dessen Oberkante)
            spec.append(dict(x=cx, y=PAD_T + 14, vx=1, vy=-7, off=off0, form='m', wackeln=0.6))
        ebenen.append((Dw.puff(H, W, i % 24, 24, spec, {'c': WEISS, 'r': HELLGRAU}), 0, 0))
    ebenen += [(fig, 0, 0), (gl, 0, 0)]
    return L.zusammen(H, W, ebenen)


TEST_EBENEN = ('figur',)

if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    diff = Hm.ruhepose(frame(0, dampf=False, nur=True), spr, OFF)
    print('Ruhepose (ohne Dampf/Glitzer) weicht vom Original ab bei:', diff if diff else 'nichts')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    ohne = [frame(i, nur=True) for i in range(N)]
    print('Pixel je Frame (nur Figur):', [int((g[..., 3] > 0).sum()) for g in ohne])
    e0 = Hm.eckkontakt_typen(ohne[0])
    neu = {i: dict(Hm.eckkontakt_typen(g) - e0) for i, g in enumerate(ohne) if Hm.eckkontakt_typen(g) - e0}
    print('neue Eckkontakte (Figur ohne Dampf) gegenüber Frame 0:', neu if neu else 'keine')
    L.speichern('steam-dwarf-brewer', 'Steam Dwarf Brewer', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/steam-dwarf-brewer-strip.png', frames, spalten=12, scale=4)
