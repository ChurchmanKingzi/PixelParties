# -*- coding: utf-8 -*-
"""Idle-Animation für „Dark Deepsea God“ (Creature).

Quelle: src/dark-deepsea-god.png — Ebene „DDG“ (75×57 px, 2 107 deckende Pixel, 22 Farben, alle Alpha 255) aus MotiveDeepsea.xcf (Ebene 308). Die Kartenkunst (data/card-art/native/Dark_Deepsea_God.png,
152×102) zeigt dieselbe Figur doppelt aufgelöst und blau getönt; Form, Lage und Größe stimmen mit der Ebene überein. Die Ebene ist vollständig (alle Teile — Kopf, Hörner, beide Flügel, Tentakelbart —
liegen auf dieser einen Ebene, Nachbarebenen 307 „Idol“ / 309 „Witch #1“ sind andere Figuren). Die Figur ist bis auf Dither-Rauschen spiegelsymmetrisch um die Spalte x = 37.
PICK: [["MotiveDeepsea", 308, 1]]

Aufruf:   python3 dark_deepsea_god.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/dark-deepsea-god.png + .json

Was ist was (x/y im Sprite):
* Ein riesiger Cthulhu-artiger Tiefsee-Gott in Dunkelgrün (Schachbrett-Dither aus (13,29,20)/(18,38,26) im Kopf, (27,58,41)/(36,77,52)/(49,104,72) in Flügeln und Tentakeln, Umriss (6,13,7)/(13,26,15)/(18,30,24)).
* Kopf (x 20–54, y 3–23): zwei lange Hörner (links x 19–28, rechts x 46–55, je y 0–7, die Spitzen freistehend bis y 5), Stirnkrone y 3–8, SECHS rote Augen in drei Paaren (Rot (243,1,3)/(182,1,5)/(100,4,0)/(50,2,0)/(91,0,2),
  Glanzpunkt rosa (227,131,131) nur in den beiden großen Augen): kleine schräge Stirnaugen (x 27–30 / 44–47, y 10–13), mittlere Außenaugen (x 23–26 / 48–51, y 13–16), große Hauptaugen (x 28–34 / 40–46, y 17–22).
* Flügel: zwei Fledermausflügel (links x 0–28, rechts x 46–74, je y 8–37) in Grüntönen mit gezackter Unterkante und hellem Rand (20,47,31); sie hängen NUR in den Zeilen y 24–26 am Körper (Flügelwurzel), sonst frei.
* Körper: darunter Tentakelbart/Rumpf (x 18–57, y 24–51), geteilt in mehrere Tentakel mit hellem Außenrand (49,104,72); unten fransen dünne Tentakelfäden (1 px) bis y 56 aus.
Fest bleiben: Gesichtsform, Augenform im Ruhebild, Flügelrippen-Muster, Stirnkrone.

RUNDE 3 (Nutzer-Feedback): „unten die Linien unter der harten Schlusskante noch entfernen und seine Bewegungen langsamer machen; er ist riesig und furchteinflößend.“
  * Die dünnen Tentakelfäden (1 px, Zeilen y 52–56 unter der harten Unterkante y 51) sind aus dem Sprite entfernt (`spr[52:] = 0`); die Unterkante y 51 ist jetzt der Abschluss in jeder Pose.
  * ALLE Bewegungen sind halb so schnell: 96 Frames à 70 ms = 6,72 s (vorher 48 Frames, 3,36 s); Perioden verdoppelt (Flügel 48, Atmen 48, Tentakel 32/48, Hörner 16 Frames, Blinzelwelle 2 Frames je Schritt, Blasen 96).
RUNDE 4 (Nutzer-Feedback): „soll UNTEN verankert sein, nicht oben: die obere Körperseite bewegt sich (wenig), der Unterkörper ist fix.“
  * Das Wehen der Tentakel (Zeilen y ≥ 30, Ausschlag wuchs nach unten) ist ENTFERNT: Tentakelbart/Unterkörper stehen völlig still (Anker = Unterkante).
  * Dafür wiegt sich der Oberkörper (y < 30: Kopf, Hörner, Hals) zusammen mit beiden Flügeln starr um ±1 px seitlich (Periode 32 Frames); das Atmen hebt wie bisher nur den oberen Teil (Unterkante fest).
Ablauf (96 Frames à 70 ms = 6,72 s; Frame 0 = Original, Blasen ausgenommen; Angaben im Folgenden für die ALTE Geschwindigkeit, jetzt jeweils doppelt so lange):
* Flügelschlag: beide Flügel schlagen als Wellen (Periode 24, zweimal pro Schleife; spaltenweise Versatz wächst mit dem Abstand zur Wurzel (x 28/46), bis ±4 px an der Spitze; die Spitze hinkt der Wurzel nach, die Wurzel bleibt am Körper).
* Atmen in zwei Schritten (Brust zuerst, Kopf hinterher): eine Zeile im Rumpf (y 36) und eine am Hals (y 27) werden eingefügt, Periode 24 mit 3 Frames Nachlauf für den Kopf; die Flügel heben sich mit (bis 2 px).
  Die eingefügten Zeilen sind texturgemischt (`L.streck_zeile`), die Tentakel stehen unten fest.
* Tentakel wehen: die Zeilen y ≥ 30 verschieben sich waagerecht als Welle mit Nachlauf (Periode 16 + eine langsamere Periode 24, Ausschlag unten ±2 px), die dünnen Fäden folgen.
* Hörner zucken: je Horn eine kurze Bewegung der freistehenden Spitze (Zeilen 0–5; Spitze bis 2 px nach außen), links Frame 6–13, rechts Frame 30–37.
* Blinzeln als Welle durch die drei Augenpaare (Lid = umgebendes Dither (13,29,20)/(18,38,26)): erst halbe, dann ganze Lider; zweimal (Frame 8–13 von oben nach unten, Frame 33–38 von unten nach oben).
  Kein Farbspiel in den Augen (Regel 21).
* Partikel (hinter der Figur): vier dunkelgrüne Blasen (Kern (49,104,72), Rand (27,58,41)), runde Wölkchen 2×2 → 3×3 → 2×2 (`U.wolke_ebene`), steigen langsam neben den unteren Tentakeln auf (Lebensdauer 48 Frames).
Kein Glanz, kein Feuer (Regel 14/15: Haut, Flügel und Tentakel sind weder Metall noch Feuer; die roten Augen sind keine Flamme). Randpixel-Test (Regel 16): `U.kontur_schliessen` in jeder Pose.
Ergänzungen: keine gemalten Pixel außer Lidern im Dither-Muster der Kopfhaut und Umrisspixeln an bewegten Kanten (Farbe = häufigste Umrissfarbe der Umgebung).
Zuschnitt: Frame auf die Figur zugeschnitten (symmetrisch um die Ruhefigur, Blasen höchstens 2 px darüber hinaus, dazu 1 px leerer Rand).
"""
import sys

import cv2
import numpy as np

import anim_lib as L
import anim_tiefsee as T
import anim_untote as U

N, MS = 96, 70                              # Runde 3: doppelt so lang bei gleicher Bildrate → alle Bewegungen halb so schnell (riesig, furchteinflößend)
spr = L.lade('dark-deepsea-god')
spr[52:] = 0                                # Runde 3: die dünnen Fäden unter der harten Schlusskante (Zeilen 52–56) entfernt
S = T.Szene('dark-deepsea-god', 'Dark Deepsea God', spr, N, MS, rand=(8, 8, 8, 8))
sh, sw, H, W = S.sh, S.sw, S.H, S.W
xx, yy, vorhanden = S.xx, S.yy, S.vorhanden
GPL, GPT = S.GPL, S.GPT
KONTUR = (6, 13, 7)
UMRISS = S.UMRISS
assert KONTUR in UMRISS

# --- Flügel / Körper trennen (die Flügel hängen nur in y 24–26 am Körper) ---------------------------------
links_k = {24: 28, 25: 29, 26: 29}          # linke Körperkante der Wurzelzeilen (Umrisspixel „I“)
rechts_k = {24: 46, 25: 45, 26: 45}
FLUEGEL_L = np.zeros((sh, sw), bool)
FLUEGEL_R = np.zeros((sh, sw), bool)
for y in range(8, 38):
    xs = np.nonzero(vorhanden[y])[0]
    if y in links_k:
        bl, br = links_k[y], rechts_k[y]
    else:
        bl = 37
        while bl > 0 and vorhanden[y, bl - 1]:
            bl -= 1
        br = 37
        while br < sw - 1 and vorhanden[y, br + 1]:
            br += 1
    FLUEGEL_L[y, :bl] = vorhanden[y, :bl]
    FLUEGEL_R[y, br + 1:] = vorhanden[y, br + 1:]
KOERPER = vorhanden & ~FLUEGEL_L & ~FLUEGEL_R
assert FLUEGEL_L.sum() > 300 and FLUEGEL_R.sum() > 300

# --- Augen (rote Komponenten) ---------------------------------------------------------------------------
rot = (spr[..., 3] > 0) & (((spr[..., 0] >= 50) & (spr[..., 1] <= 10)) | ((spr[..., 0] == 227) & (spr[..., 1] == 131)))
_, lab = cv2.connectedComponents(rot.astype(np.uint8), connectivity=8)
AUGEN = {}
for k in range(1, lab.max() + 1):
    ys, xs = np.nonzero(lab == k)
    AUGEN[k] = sorted(zip(xs.tolist(), ys.tolist()))
paare = {}
for k, pts in AUGEN.items():
    cx = np.mean([p[0] for p in pts]); cy = np.mean([p[1] for p in pts])
    paare.setdefault(round(cy / 4), []).append((k, cx))
# Paare nach Höhe: Stirn (oben), außen (mitte), Haupt (unten)
PAARE = [sorted(pts, key=lambda e: e[1]) for _, pts in sorted(paare.items())]
PAARE = [[AUGEN[k] for k, _ in pr] for pr in PAARE]
assert len(PAARE) == 3 and all(len(pr) == 2 for pr in PAARE), [len(p) for p in PAARE]
H_, F_ = (13, 29, 20), (18, 38, 26)
haut = lambda x, y: H_ if (x + y) % 2 == 0 else F_                 # Dither der Kopfhaut (aus dem Ruhebild abgelesen)


def blinz(a, stufe_je_paar):
    """Lider: Stufe 1 = obere Augenhälfte zu, 2 = ganz zu (Dither der Kopfhaut)."""
    for pr, st in zip(PAARE, stufe_je_paar):
        if not st:
            continue
        for pts in pr:
            ys = sorted(set(y for _, y in pts))
            ymitte = ys[0] + (ys[-1] - ys[0] + 1) / 2.0
            for (x, y) in pts:
                if st == 2 or y < ymitte:
                    a[GPT + y, GPL + x, :3] = haut(x, y)
    return a


# Blinzelwelle: Frame → (Stufe Stirn, außen, Haupt)
BLINZ = {}
for k, stufen in enumerate([(1, 0, 0), (2, 1, 0), (1, 2, 1), (0, 1, 2), (0, 0, 1)]):      # von oben nach unten (2 Frames je Schritt)
    BLINZ[16 + 2 * k] = BLINZ[17 + 2 * k] = stufen
for k, stufen in enumerate([(0, 0, 1), (0, 1, 2), (1, 2, 1), (2, 1, 0), (1, 0, 0)]):      # von unten nach oben
    BLINZ[66 + 2 * k] = BLINZ[67 + 2 * k] = stufen

# --- Teile als Ebenen auf der vollen Leinwand -----------------------------------------------------------
HORN_L = KOERPER & (yy <= 5) & (xx <= 29)
HORN_R = KOERPER & (yy <= 5) & (xx >= 45)
FL_L, FL_R, KO = S.teil(FLUEGEL_L), S.teil(FLUEGEL_R), S.teil(KOERPER)
PIVOT_L, PIVOT_R = GPL + 28, GPL + 46


def horn_bump(i, start, dauer=16):
    return U.buckel(i, start, dauer)


def wiegen(i):
    """Seitliches Wiegen des Oberkörpers: −1/0/+1 px, Periode 32 Frames (langsam, 2,2 s), Frame 0 = 0."""
    v = np.sin(L.sinus(i, 32))
    return 1 if v >= 0.5 else -1 if v <= -0.5 else 0


def koerper_ebene(i):
    kb = KO.copy()
    kb = blinz(kb, BLINZ.get(i, (0, 0, 0)))
    # Hörner zucken (Zeilengruppen, Spitze bis 2 px nach außen)
    gl, gr = horn_bump(i, 12), horn_bump(i, 60)
    gruppen = [(GPT + 0, GPT + 1), (GPT + 2, GPT + 3), (GPT + 4, GPT + 5)]
    # linke Spitze: nur Pixel x ≤ 29; rechte x ≥ 45 (die Stirnkrone in der Mitte bleibt stehen)
    for (maske_x, g, vz) in ((lambda x: x <= GPL + 29, gl, -1), (lambda x: x >= GPL + 45, gr, 1)):
        dxs = [vz * int(round(2.2 * g)), vz * int(round(1.3 * g)), vz * int(round(0.4 * g))]
        if not any(dxs):
            continue
        teil = L.leer(H, W)
        for y0, y1 in gruppen:
            for y in range(y0, y1 + 1):
                for x in np.nonzero(kb[y, :, 3])[0]:
                    if maske_x(x):
                        teil[y, x] = kb[y, x]
                        kb[y, x] = 0
        teil = T.gruppen_scher(teil, gruppen, dxs)
        kb = L.zusammen(H, W, [(kb, 0, 0), (teil, 0, 0)])
    # Tentakel wehen (Zeilen ab y 30; zwei Wellen mit verschiedenen Perioden, Fäden folgen)
    unten = kb.copy()
    unten[:GPT + 30] = 0
    oben = kb.copy()
    oben[GPT + 30:] = 0
    # Runde 4 (Nutzer: „UNTEN verankert, nicht oben: die obere Körperseite bewegt sich (wenig), der Unterkörper ist fix“): die Tentakel (y ≥ 30) stehen völlig still;
    # stattdessen wiegt sich der Oberkörper (Kopf, Hörner, Hals, y < 30, samt Flügeln) als starre Einheit um 1 px nach links/rechts.
    dx = wiegen(i)
    kb = L.zusammen(H, W, [(L.versetze(oben, dx, 0) if dx else oben, 0, 0), (unten, 0, 0)])
    # Atmen in zwei Schritten: Hals (y 27) mit Nachlauf, Rumpf (y 36) zuerst
    n_rumpf = U.stufe(i, 48, 1)
    n_hals = U.stufe(i, 48, 1, versatz=-L.sinus(6, 48))               # Kopf hinkt 6 Frames hinterher
    if n_hals:
        kb = L.streck_zeile(kb, GPT + 27, n_hals)
    if n_rumpf:
        kb = L.streck_zeile(kb, GPT + 36, n_rumpf)
    return kb, n_hals + n_rumpf, dx


# freie Bahnen für die Blasen (unten links / rechts neben den Tentakeln), ≥ 3 px unter den Flügelspitzen
P = S.P
PUFFS = [
    dict(x=P(5, 55)[0], y=P(5, 55)[1], vx=0, vy=-9, off=0, wackeln=0.6),
    dict(x=P(11, 55)[0], y=P(11, 55)[1], vx=0, vy=-9, off=48, wackeln=0.6),
    dict(x=P(69, 55)[0], y=P(69, 55)[1], vx=0, vy=-9, off=24, wackeln=0.6),
    dict(x=P(63, 55)[0], y=P(63, 55)[1], vx=0, vy=-9, off=72, wackeln=0.6),
]
BLASE = {'c': (49, 104, 72), 'r': (27, 58, 41)}


def frame_gross(i, nur=None):
    kb, hub, dx = koerper_ebene(i)
    fl = T.fluegel(FL_L, PIVOT_L, 4.4, i, 48, lag=1.0, potenz=1.15, dy0=-hub)
    fr = T.fluegel(FL_R, PIVOT_R, 4.4, i, 48, lag=1.0, potenz=1.15, dy0=-hub)
    if dx:                                                                  # die Flügel hängen am Oberkörper (Wurzel y 24–26) und wiegen sich mit
        fl, fr = L.versetze(fl, dx, 0), L.versetze(fr, dx, 0)
    f = L.zusammen(H, W, [(fl, 0, 0), (fr, 0, 0), (kb, 0, 0)])
    f = U.kontur_schliessen(f, UMRISS, KONTUR)
    if nur == 'koerper':
        return f
    blasen = U.wolke_ebene(H, W, i, N, PUFFS, BLASE)
    return L.zusammen(H, W, [(blasen, 0, 0), (f, 0, 0)])


S.bauen(frame_gross)
frame = S.frame

if __name__ == '__main__':
    S.main([0, 3, 6, 9, 12, 15, 18, 21])
