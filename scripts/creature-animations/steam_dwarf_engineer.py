# -*- coding: utf-8 -*-
"""Idle-Animation für „Steam Dwarf Engineer“ (Creature) — der goldene Dampfzwerg-INGENIEUR selbst: goldene Kapuze, grauer Bart, drei Dampfrohre auf dem Rücken, Schraubenschlüssel in der Hand.

Quelle: src/steam-dwarf-engineer.png (28×28 px, 24 Farben) — beide Ebenen derselben xcf, Lage per xcf-Koordinaten (gegen die Kartenkunst Steam_Dwarf_Engineer.png geprüft: 356 von 368 Pixeln stimmen):
PICK: [["MotiveSteamDwarfs", 418, 1], ["MotiveSteamDwarfs", 417, 1]]
  * Ebene 418 („Ebene #33“, 21×28 px bei (228,291)): der Ingenieur (Zwerg mit goldener Kapuze, Bart, drei Rohren).
  * Ebene 417 („Ebene #34“, 8×8 px bei (248,304)): sein Schraubenschlüssel (liegt am rechten Rand des Zwergs, Griff berührt den Körper bei (20,19)).
  Nicht verwendet: Ebene 419 („Ebene #30“, 28×38 px) = das goldene Drachen-BAUPROJEKT, an dem der Ingenieur arbeitet (in der alten Fassung war NUR das dargestellt; der Nutzer: „es fehlt der Engineer, du hast nur
  sein Bauprojekt dargestellt“). Das Bauprojekt steht in der Kunst neben dem Zwerg, ist größer als er und mit ihm nicht verbunden → Beiwerk, nicht Teil der Figur, daher weggelassen.
Aufruf:   python3 steam_dwarf_engineer.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/steam-dwarf-engineer.png + .json

Was im Sprite ist (x, y im 28×28-Sprite):
* DREI DAMPFROHRE (grau, B (81,81,81)/D (62,62,62)/K (108,108,108)/L (106,106,106)) auf dem Rücken, links im Bild: Rohr A (x 6–10, y 0–7), Rohr B (x 2–7, y 4–13), Rohr C (x 0–5, y 9–17); jedes Rohr
  hat oben einen schwarzen Schlitz R (0,0,0) (Austritt): A (7–8, 1), B (3–4, 5), C (1–2, 10). Sie laufen schräg nach unten zur Schulter.
* KAPUZE/HELM (x 7–20, y 7–14): goldbraun (C (204,163,83), H (234,194,107), J (235,188,96), F (156,120,29), I (184,142,34), E (109,84,20)) mit dunkelbraunem Umriss A (74,57,14).
* GESICHT (x 14–19, y 14–16): Haut Q (246,189,123); EIN Auge in Dreiviertelansicht: graue/weiße Lidöffnung (16,14) V (130,130,130) und (17,14) W (210,210,210), umrahmt von braunem Lid/Wimpern A (15,14), (16,15), (17,15).
* BART (x 9–19, y 14–18): grau/weiß (M (189,189,189), N (162,162,162), O (156,156,156), P (213,213,213), S (246,255,255)).
* WESTE/KÖRPER (x 5–20, y 17–27): goldbraune Streifen (E, F, I, C), unten eine graue Metallplatte (15–19, 23–26: L (106,106,106), P, S, M) mit hellem Glanzpixel (18,23).
* SCHRAUBENSCHLÜSSEL (x 20–27, y 13–20): grauer Maulschlüssel G (85,85,85)/N (162,162,162), Maul oben rechts (24–27, 13–16), Griff läuft schräg nach unten links zum Körper.
Metall im Sprite: Rohre, Schlüssel, Metallplatte (Regel 14). Kapuze/Weste sind goldbraun (Stoff oder Messing — im Zweifel KEIN Glanz).

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* Auf und ab (Periode 24 = zweimal pro Schleife): die Westenzeile 21 wird einmal doppelt eingefügt (L.streck_zeile mit Texturmischung): Kapuze, Rohre, Arm/Schlüssel steigen als Ganzes 1 px, der unterste Weste/Platte bleibt am Boden.
* Rohre zittern (Dampfdruck, je Rohr eigener Takt): die obersten drei Rohrzeilen jedes Rohrs schlagen ±1 px seitlich aus (A Periode 12, B Periode 16, C Periode 24, gegenphasig), jedes Rohr bleibt 4-verbunden; Ausschlag nur, wenn der Sinus > 0,55 bzw. < −0,55 ist (sonst Ruhe, Frame 0 = Ruhe).
* Dampf: aus allen drei Rohrschlitzen steigen kleine runde Wölkchen (5×3, wachsen aus 2×2, schrumpfen wieder; Farben P (213,213,213)/N (162,162,162) aus dem Sprite) langsam bis 4 px auf, je Rohr zwei Wölkchen um eine
  halbe Periode versetzt (Periode 24, Rohr B und C um 8 bzw. 16 Frames gegeneinander versetzt).
* [Runde 4: ersetzt durch die Schraubbewegung, siehe unten] Schraubenschlüssel tippt (der Zwerg dreht an einer Schraube): der Schlüssel hebt sich starr 1 px (je 3 Frames, alle 12 Frames); die untersten Griffzeilen (y ≥ 19, in der verdeckten Hand) bleiben stehen, damit der Griff am Körper 4-verbunden bleibt (der Griff wirkt 1 px länger).
* Blinzeln (Frames 20–22 und 41–43): das Auge schließt sich — (16,14) und (17,14) nehmen die umgebende Hautfarbe Q an (nur dieses eine Auge).
* Metall glänzt (Regel 12/14, nur Rohre, Schlüssel, Metallplatte): ein Lichtband läuft diagonal von links oben nach rechts unten — erst über die Rohre (Frames 2–11 und 26–35), dann über den Schlüssel
  (Frames 12–19 und 38–45), dann die Platte (Frames 20–25 und 30–35); dazu ein vierzackiger Glitzer-Stern am Schlüsselmaul (Frames 14–17) und an der Plattenecke (Frames 38–41).
Frame 0 = Original (Ruhepose), Dampf/Glitzer ausgenommen. Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine (der Schlüssel liegt über Körper und Hintergrund; nichts Verdecktes wird freigelegt).

RUNDE 4 (Nutzer: „der ausgestreckte Arm mit dem Schraubenschlüssel soll sich bewegen und wirklich ‚arbeiten‘, statt gestretcht zu werden“): das frühere „Tippen“ (Schlüssel 1 px hoch, Griff gedehnt) ist ERSETZT durch
eine Schraubbewegung aus drei eigenen, STARREN Posen des Schlüssels (SCHL_POSEN): O = Original (45° nach rechts oben), M = Zwischenpose (≈ 22°), D = waagerecht (0°). Drehpunkt = die Hand am Griffende (21,19); jede
Pose ist als Skelett (helle Pixel) gezeichnet, der dunkle 1-px-Umriss wird wie im Original darum gelegt (4-Nachbarn + je ein Eckpixel an den Maulspitzen; für O ergibt das pixelgenau den Originalschlüssel).
Takt: drei Züge (O M D D M O, je 6 Frames) → 6 Frames Pause → drei Züge → Pause. Der Schlüssel geht beim Auf und ab starr mit (versetzt, nicht gestreckt). Lichtband läuft über die jeweilige Pose; der Glitzerstern
am Maul blitzt in der Pause (Frames 19–22). Leinwand rechts 2 px breiter (waagerechte Pose reicht bis x = 28).

RUNDE 5 (Nutzer: „es bewegt sich jetzt nur der Schraubenschlüssel, ohne dass sich die Hand/der Arm bewegen würde“): der ausgestreckte Unterarm (goldener Balken x 14–20, y 19–22) senkt sich jetzt bei jedem Zug mit
(Pose M: Hand 1 px, Pose D: Hand 2 px tiefer; starrer Spaltenversatz um den Ellbogen, siehe arm_senken), der Schlüssel sitzt starr in der Hand und dreht zusätzlich aus dem Handgelenk. Ergänzt: unter dem Bart
freigelegte Pixel (16–18,19) in Bartschatten (156,156,156), (19,19)/(19,20) in Bartkante (106,106,106). Atmen jetzt über anim_textur (Regel 49).
"""
import math
import sys

import numpy as np

import anim_dwarf as Dw
import anim_humanoide as Hm
import anim_lib as L
import anim_textur as TX   # texturierte Streckzeilen statt Zeilenkopien (Regel 43/49)

N, MS = 48, 62
PAD_L, PAD_R, PAD_T, PAD_B = 7, 5, 10, 2         # Dampf links/oben (folgt den Rohren schräg nach links oben), Rohrzittern ±1 px, Schlüssel ±1 px

spr = L.lade('steam-dwarf-engineer')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
vorhanden = L.deckend(spr)


def f(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


KANTE0 = Hm.kantenmaske(spr)
ERLAUBT = Hm.umrissfarben(spr)
UMRISS = (74, 57, 14)
HAUT = f(14, 14)                                                              # Q (246,189,123)
GRAU = [(62, 62, 62), (81, 81, 81), (82, 82, 82), (85, 85, 85), (106, 106, 106), (108, 108, 108), (130, 130, 130), (156, 156, 156), (162, 162, 162),
        (189, 189, 189), (213, 213, 213), (246, 255, 255)]                    # Grauwerte des Sprites (dunkel → hell)
GRAU_ALLE = set(GRAU) | {(210, 210, 210)}
DAMPF_C, DAMPF_R = (213, 213, 213), (162, 162, 162)

yy, xx = np.mgrid[0:sh, 0:sw]


def maske(bed):
    return np.array([[bool(vorhanden[y, x] and bed(x, y)) for x in range(sw)] for y in range(sh)])


m_schluessel = maske(lambda x, y: x >= 20 and 13 <= y <= 20 and f(x, y) in GRAU_ALLE and (x, y) != (20, 14))
m_rohr = maske(lambda x, y: x <= 11 and y <= 17 and f(x, y) in GRAU_ALLE)
m_platte = maske(lambda x, y: 15 <= x <= 19 and 23 <= y <= 26 and f(x, y) in GRAU_ALLE)
m_rohr_glanz = m_rohr & ~KANTE0
m_schl_glanz = m_schluessel
m_platte_glanz = m_platte & ~KANTE0

# Rohre: (Zeilen, x-Bereich) der obersten drei Zeilen, Periode, Phase
ROHR = {'A': ((0, 1, 2), (5, 10), 12, 0.0), 'B': ((4, 5, 6), (0, 6), 16, 0.0), 'C': ((9, 10, 11), (0, 3), 24, 0.0)}


def rohr_stufe(i, name):
    zeilen, bereich, per, ph = ROHR[name]
    v = math.sin(2 * math.pi * i / per + ph)
    return 1 if v > 0.55 else (-1 if v < -0.55 else 0)                         # Ruhe bei Frame 0, dazwischen kurze Ausschläge


# Dampfquellen (Runde 3, Nutzer: „der Qualm kommt nicht aus den jeweiligen Schloten“): die Wölkchen entstehen exakt über der Rohröffnung (Lücke zwischen den Randpixeln der Öffnung; der schwarze Schlitz liegt
# jeweils eine Zeile unter dem Rohrrand) und steigen entlang der Rohrachse auf (die drei Rohre laufen schräg: oben links, unten rechts zur Schulter — A fast senkrecht, B und C flacher).
# (x des linken Pixels der 2×2-Anfangswolke — sie sitzt mit ihrer unteren Zeile HINTER dem Rohrrand und taucht aus der Öffnung auf —, Zeile des oberen Rohrrands, Gesamtweg dx über die Lebensdauer, Phasenversatz in Frames):
#   A: Öffnung x 7–8, Rand Zeile 0 · B: Öffnung x 3–4, Rand Zeile 4 · C: Öffnung x 1–2, Rand Zeile 9
QUELLEN = {'A': (7, 0, -1, 0), 'B': (3, 4, -2, 3), 'C': (1, 9, -3, 6)}
STEIG = -5                                                                      # Weg nach oben über die Lebensdauer (24 Frames)


def quelle_von(name):
    """Ort der Rohröffnung (Leinwandkoordinaten, 2×2-Anfangswolke: untere Zeile hinter dem Rohrrand) im Frame b: folgt Rohrzittern und Auf und ab, damit die Wölkchen immer an ihrem Schlot beginnen."""
    cx, rand, _, _ = QUELLEN[name]

    def q(b):
        b %= N
        return (PAD_L + cx + rohr_stufe(b, name), PAD_T + rand - 1 - Hm.stufe(b, N / 2, 1))
    return q


# --- Schraubenschlüssel: drei starre Posen (Skelett = helle Pixel relativ zum Griffende (21,19); Umriss automatisch) ---
SCHL_G, SCHL_N = (85, 85, 85), (162, 162, 162)
SCHL_BASIS = (21, 19)
SCHL_POSEN = {                                                                  # (helle Pixel, zusätzliche Eck-Umrisspixel der Maulspitzen)
    'O': ([(0, 0), (1, -1), (2, -2), (2, -3), (2, -4), (3, -5), (3, -2), (4, -2), (5, -3)], [(4, -6), (6, -4)]),
    'M': ([(0, 0), (1, 0), (2, -1), (3, -1), (3, -2), (3, -3), (4, -4), (4, -1), (5, 0), (6, 0)], [(5, -5), (7, -1), (5, -2)]),
    'D': ([(0, 0), (1, 0), (2, 0), (3, 0), (4, -1), (4, -2), (5, -2), (4, 1), (4, 2), (5, 2)], []),
}


def _schl(pose):
    hell, ecken = SCHL_POSEN[pose]
    hs = set(hell)
    rand = {(x + dx, y + dy) for (x, y) in hs for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))} - hs
    rand |= set(ecken)
    a = L.leer(H, W)
    for pts, c in ((rand, SCHL_G), (hs, SCHL_N)):
        for (x, y) in pts:
            X, Y = PAD_L + SCHL_BASIS[0] + x, PAD_T + SCHL_BASIS[1] + y
            a[Y, X, :3] = c
            a[Y, X, 3] = 255
    return a


SCHL_EBENE = {p: _schl(p) for p in SCHL_POSEN}
_schl0, REST = L.trenne(spr, m_schluessel)
assert (SCHL_EBENE['O'] == L.platz(_schl0, H, W, PAD_L, PAD_T)).all(), 'Pose O muss der Originalschlüssel sein'
_ZUG = ['O', 'M', 'D', 'D', 'M', 'O']
SCHL_FOLGE = (_ZUG * 3 + ['O'] * 6) * 2                                          # 48 Frames
assert len(SCHL_FOLGE) == N


# --- Runde 5: der ARM führt die Schraubbewegung aus (Nutzer: „es bewegt sich nur der Schraubenschlüssel, ohne dass sich die Hand/der Arm bewegen würde“) ---
# Der ausgestreckte Unterarm ist der goldene Balken x 14–20, y 19–22 (obere Kontur Zeile 19, Füllung Zeilen 20–21, untere Kontur Zeile 22, Handkante (20,20)/(20,21)); die Hand (helles Ende (19,20)) hält den Griff.
# Je Schlüsselpose senkt sich der Arm starr um den Ellbogen (x 14–15 bleiben): Spaltenversatz nach unten mit Gefälle ≤ 1 px je Spalte, nichts wird gestreckt. Der Schlüssel sitzt starr in der Hand (gleicher Versatz
# wie die Handspalte x 20). Freigelegt wird nur die Zeile unter dem Bart: dort wird der Bart fertiggezeichnet (Schattenstufe D (156,156,156); in der Randspalte x 19 läuft die Bartkante N (106,106,106) weiter).
# Unten liegt der Arm VOR der Metallplatte (verdeckt deren oberste Zeile[n]).
ARM_X = (16, 20)
ARM_ZEILEN = (19, 22)
ARM_SENK = {'O': {}, 'M': {17: 1, 18: 1, 19: 1, 20: 1}, 'D': {16: 1, 17: 1, 18: 1, 19: 2, 20: 2}}          # Spalte → Versatz nach unten
BART_SCHATTEN, BART_KANTE = (156, 156, 156), (106, 106, 106)


def arm_senken(k, pose):
    """Arm auf der Leinwand k (vor dem Atmen) in die Pose bringen; liefert den Versatz der Hand (= Versatz des Schlüssels)."""
    senk = ARM_SENK[pose]
    for x, d in senk.items():
        X = PAD_L + x
        spalte = [k[PAD_T + y, X].copy() for y in range(ARM_ZEILEN[0], ARM_ZEILEN[1] + 1)]
        for n_, y in enumerate(range(ARM_ZEILEN[0], ARM_ZEILEN[1] + 1)):
            if spalte[n_][3]:
                k[PAD_T + y + d, X] = spalte[n_]
        for y in range(ARM_ZEILEN[0], ARM_ZEILEN[0] + d):                       # freigelegt: Bart fertigzeichnen (x 20: dort war nur der Schlüsselgriff → frei)
            if x == 20:
                k[PAD_T + y, X] = 0
            else:
                k[PAD_T + y, X, :3] = BART_KANTE if x == 19 else BART_SCHATTEN
                k[PAD_T + y, X, 3] = 255
    return senk.get(20, 0)


def frame(i, dampf=True, nur=None):
    if nur:
        dampf = False
    k = L.platz(REST, H, W, PAD_L, PAD_T)
    sc = SCHL_EBENE[SCHL_FOLGE[i]].copy()
    gl = L.leer(H, W)
    # --- Glanz (nur Metall): Lichtband über Rohre, Schlüssel, Platte ---
    for start in (2, 26):
        Hm.lichtband(k, m_rohr_glanz, OFF, i, N, start, 10, GRAU, stufen=1, breite=3.0, achse=(1.0, 1.0), kern=2)
    for start in (12, 38):
        Hm.lichtband(sc, sc[..., 3] > 0, (0, 0), i, N, start, 8, GRAU, stufen=1, breite=3.0, achse=(1.0, 1.0), kern=2)
    for start in (20, 30):
        Hm.lichtband(k, m_platte_glanz, OFF, i, N, start, 6, GRAU, stufen=1, breite=2.4, achse=(1.0, 1.0), kern=2)
    # --- Blinzeln: das eine Auge schließt sich (Lid = Hautfarbe) ---
    if Hm.folge(i, 20, [1, 1, 1], N) or Hm.folge(i, 41, [1, 1, 1], N):
        Hm.setze(k, {(16, 14): HAUT, (17, 14): HAUT}, OFF)
    # --- Rohrzittern (je Rohr eigener Takt) ---
    for name, (zeilen, (x0, x1), per, ph) in ROHR.items():
        a = rohr_stufe(i, name)
        if a:
            Hm.bereich_versatz(k, OFF, {y: a for y in zeilen}, x0, x1)
    # --- Auf und ab: Westenzeile 21 wird einmal doppelt eingefügt; Körper und Schlüssel gleichermaßen ---
    hand = arm_senken(k, SCHL_FOLGE[i])                                         # Runde 5: Arm/Hand führen den Zug aus, der Schlüssel sitzt starr in der Hand
    brust = Hm.stufe(i, N / 2, 1)
    k = TX.atmen(k, PAD_T + 21, PAD_T + 14, brust, 0)
    sc = L.versetze(sc, 0, hand - brust)                                        # Schlüssel starr mit Hand und Oberkörper (nicht strecken)
    fig = L.zusammen(H, W, [(k, 0, 0), (sc, 0, 0)])
    Hm.kontur_schliessen(fig, ERLAUBT, UMRISS)
    # --- Glitzer-Sterne (nur Metall): Schlüsselmaul, Plattenecke ---
    for (sx, sy, start, dx_) in (() if nur else ((25, 14, 19, 0), (16, 23, 38, 0))):
        st = Hm.folge(i, start, [0, 1, 2, 1], N)
        Hm.stern4(gl, sx, sy - brust, st, (246, 255, 255), (213, 213, 213), (189, 189, 189), OFF)
    ebenen = []
    if dampf:
        spec = []
        for name, (cx, rand, dxs, off0) in QUELLEN.items():
            q = quelle_von(name)
            for k, o in enumerate((0, 8, 16)):                                  # drei Wölkchen je Rohr, 8 Frames versetzt: ein stetiger Dampfstrahl aus der Öffnung
                spec.append(dict(quelle=q, vx=dxs, vy=STEIG, off=off0 + o, form='m', wackeln=0.4 if k % 2 == 0 else -0.4))
        ebenen.append((Dw.puff_pfad(H, W, i, 24, spec, {'c': DAMPF_C, 'r': DAMPF_R}), 0, 0))
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
    L.speichern('steam-dwarf-engineer', 'Steam Dwarf Engineer', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/steam-dwarf-engineer-strip.png', frames, spalten=12, scale=6)
