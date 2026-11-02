# -*- coding: utf-8 -*-
"""Idle-Animation für „Cykyran War Counselor“ (Creature) — der grüne Zyklop-Krieger mit Stahlhelm, rotem Helmbusch, Riesenauge und schwerer Feuerwaffe.

Quelle: src/cykyran-war-counselor.png (26×33 px, 31 Farben, 432 Pixel).
PICK: [["MotiveSteamDwarfs", 386, 1]]      (Ebene „Cykyran“, ganze Ebene = eine Figur, 26×33 px; nur in dieser Karte)
Abgleich mit der Kartenkunst Cykyran_War_Counselor.png (76×51): Sprite sitzt dort 100 % pixelgleich (nächstbester Treffer 79 %, ein 6×4-Fleck). Auf der Karte stehen außerdem die Steinmauer links,
das Wasser und der Steg (Hintergrund) — nichts davon gehört zur Figur. Die Nachbarebenen (Sichtbar #9/#10, Censpartan 388, Thebinxan 384) sind andere Figuren.

Aufruf:   python3 cykyran_war_counselor.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/cykyran-war-counselor.png + .json

Was im Sprite ist (x, y im 26×33-Sprite):
* HELMBUSCH (x 8–13, y 0–5): rote Federn (156,0,0)/(214,0,0)/(255,0,0), Basis y 6 mit schwarzen Ecken.
* STAHLHELM (x 6–15, y 7–10): Metall (66,66,66)/(76,74,93)/(112,112,112)/(190,190,190)/(194,194,194), schwarzer Rand (0,0,0).
* GESICHT (x 6–16, y 10–17): grüne Haut (95,134,96)/(112,153,113), ein einziges RIESENAUGE (Zyklop) in dunkler Maske (24,24,24): Weiß (190,190,190)/(255,255,255) bei (9–12, 11) und (9, 12–13)/(12, 12–13), Pupille
  (24,24,24) bei (10–11, 12–14); darunter der MUND mit Zähnen (x 9–12, y 16–17): dunkelrot (82,0,0)/(113,0,0) und weiße Zähne (227,227,227). Ohren: grüne Spitzen bei (5–6, 13–14) und (15–16, 13–14).
* WAFFE (x 12–25, y 10–24): schwere Feuerwaffe in Dunkelgrau (23,23,23)/(48,48,48)/(88,88,88)/(112,112,112)/(128,128,128)/(194,194,194), Lauf nach rechts oben, Griff in der grünen rechten Hand (19–23, 19–22).
* RÜCKEN-/LINKER ARM (x 0–10, y 18–26): grün, endet in einer grauen Faust/Manschette (1–3, 23–25).
* TUNIKA (x 5–16, y 23–28): braunes Leder (156,74,0)/(132,66,0)/(154,88,3)/(183,113,13) mit dunklem Saum (82,41,0) bei y 28.
* BEINE (y 29–32): grüne Beine (95,134,96)/(112,153,113), dunkle Sohlen (46,65,47).
Metall im Sprite: Stahlhelm und Waffe. Nur sie glänzen (Regel 14); Haut, Leder, Federn, Zähne nicht. Kein Feuer, kein Dampf, keine Partikel (die Waffe raucht auf der Kunst nicht).

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* Auf und ab (Periode 24 = zweimal pro Schleife): die Tunikazeile 27 wird einmal doppelt eingefügt (Texturmischung): Rumpf, Arme, Waffe, Kopf und Helmbusch steigen 1 px, die Beine/Füße bleiben am Boden; Waffe
  und Faust bewegen sich starr mit den Händen. Der Kopf bleibt dabei starr (kein seitliches Neigen, keine Verlagerung des Oberkörpers).
* Helmbusch wiegt (Zeilen 0–5): die Federn schwingen mit zwei Wellen (3 s und 1 s) bis ±2 px an der Spitze, nach unten auslaufend (Gefälle ≤ 1 px je Zeile), die Basis (y 6) bleibt am Helm.
* Blinzeln (Frames 19–21 und 41–43): das Lid senkt sich — erst die obere Weißzeile (y 11), dann alle acht Weißpixel des Auges nehmen die dunkle Maskenfarbe (24,24,24) an (Lid = umgebende Maske), dann wieder nur die obere
  Zeile; kein Farbtausch, kein Augenglanz.
* Blick (Frames 8–10 links, 30–32 rechts): die beiden mittleren Augenzeilen (12–13) verschieben die Pupille 1 px nach links bzw. rechts (nur Pixeltausch Weiß ↔ Pupille innerhalb des Auges).
* Metall glänzt (Regel 14): ein Lichtband läuft zweimal pro Schleife über die Waffe (Frames 5–16 und 29–40, diagonal), dazu ein Lichtband über den Helm (Frames 20–27) und je ein Glitzerstern am Helm (Frames 28–31)
  und auf der Waffe (Frames 12–15 und 36–39), die Sterne liegen vollständig innerhalb des Metalls.
* Fußtippen: der linke Fuß hebt sich zweimal 1 px hinter das Bein (Frames 10–17), später der rechte (Frames 34–41).
Frame 0 = Original (Ruhepose). Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Ergänzungen: keine (nichts Verdecktes wird freigelegt; die Füße liegen beim Heben hinter dem Bein).
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_krieger as K
import anim_lib as L

N, MS = 48, 62
sz = K.Szene('cykyran-war-counselor', (3, 4, 3, 2))          # Plume ±2 px, Wippen 1 px nach oben, Randabstand ≥ 2
spr, OFF, H, W = sz.spr, sz.OFF, sz.H, sz.W
PT = sz.pt
TEST_EBENEN = ('figur',)                                       # für den Randpixel-Test: ohne Glitzersterne

GUN_R = [(23, 23, 23), (48, 48, 48), (88, 88, 88), (112, 112, 112), (128, 128, 128), (194, 194, 194)]
HELM_R = [(66, 66, 66), (76, 74, 93), (112, 112, 112), (190, 190, 190), (194, 194, 194), (227, 227, 227)]
DUNKEL = (24, 24, 24)
AUGE_WEISS = [(9, 11), (10, 11), (11, 11), (12, 11), (9, 12), (12, 12), (9, 13), (12, 13)]
BLINK_OBEN = {p: DUNKEL for p in AUGE_WEISS if p[1] == 11}      # Lid senkt sich: erst die obere Zeile
BLINK = {p: DUNKEL for p in AUGE_WEISS}
WEISS, HELLGRAU, GRAU = (255, 255, 255), (194, 194, 194), (142, 142, 142)

fuss_l = sz.vor & (sz.yy >= 31) & (sz.xx <= 10)
fuss_r = sz.vor & (sz.yy >= 31) & (sz.xx >= 11)
koerper = sz.vor & ~fuss_l & ~fuss_r
grau = {(23, 23, 23), (48, 48, 48), (88, 88, 88), (112, 112, 112), (128, 128, 128), (194, 194, 194)}
m_waffe = sz.farben_in(((sz.xx >= 17) & (sz.yy >= 10) & (sz.yy <= 18)) | ((sz.xx >= 13) & (sz.yy >= 18) & (sz.yy <= 24)), grau)
m_helm = sz.farben_in(sz.rechteck(7, 7, 14, 9), set(HELM_R))


def frame(i, nur=None):
    ebenen = nur if nur is not None else ('figur', 'glitzer')
    k = sz.ebene(koerper)
    # --- Blinzeln und Blick (Pixeltausch innerhalb des Auges) ---
    lid = Hm.folge(i, 19, [1, 2, 1], N) or Hm.folge(i, 41, [1, 2, 1], N)
    if lid:
        K.blinzeln(k, OFF, BLINK_OBEN if lid == 1 else BLINK)
    elif K.fenster(i, N, 8, 3) is not None:                    # Blick nach links: Pupille wandert 1 px nach links
        Hm.setze(k, {(9, 12): DUNKEL, (9, 13): DUNKEL, (11, 12): sz.f(12, 12), (11, 13): sz.f(12, 13)}, OFF)
    elif K.fenster(i, N, 30, 3) is not None:                   # Blick nach rechts
        Hm.setze(k, {(12, 12): DUNKEL, (12, 13): DUNKEL, (10, 12): sz.f(9, 12), (10, 13): sz.f(9, 13)}, OFF)
    # --- Metall glänzt (Regel 14): Waffe zweimal, Helm einmal ---
    Hm.lichtband(k, m_waffe, OFF, i, N, 5, 12, GUN_R, stufen=1, breite=3.4, achse=(1.0, 0.7), kern=2)
    Hm.lichtband(k, m_waffe, OFF, i, N, 29, 12, GUN_R, stufen=1, breite=3.4, achse=(1.0, 0.7), kern=2)
    Hm.lichtband(k, m_helm, OFF, i, N, 20, 8, HELM_R, stufen=1, breite=2.4, achse=(1.0, 0.0), kern=2)
    # --- Helmbusch wiegt (Zeilen 0–5) ---
    d = int(round(1.4 * np.sin(2 * np.pi * i / N) + 0.8 * np.sin(2 * np.pi * 3 * i / N)))
    Hm.zeilen_versatz(k, OFF, K.gefaelle(list(range(0, 6)), d))
    # --- Auf und ab: Tunikazeile 27 doppelt ---
    brust = Hm.stufe(i, N / 2, 1)
    k = K.bob(k, PT + 27, brust)
    # --- Fußtippen ---
    pat = [1, 1, 1, 1, 1, 1, 1, 1]
    ul = 1 if K.fenster(i, N, 10, 8) is not None else 0
    ur = 1 if K.fenster(i, N, 34, 8) is not None else 0
    fl, fr = sz.ebene(fuss_l, 0, -ul), sz.ebene(fuss_r, 0, -ur)
    fig = L.zusammen(H, W, [(fl, 0, 0), (fr, 0, 0), (k, 0, 0)])
    K.kontur(fig, sz.ERLAUBT, lambda c, x, y: (156, 0, 0) if (c[1] == 0 and c[2] == 0) else (0, 0, 0))     # Regel 16: Federbusch dunkelrot, sonst schwarz
    out = fig if 'figur' in ebenen else sz.leer()
    if 'glitzer' in ebenen:
        gl = sz.leer()
        Hm.stern4(gl, 13, 8 - brust, Hm.folge(i, 28, [0, 1, 1, 0], N), WEISS, HELLGRAU, GRAU, OFF)
        st = Hm.folge(i, 12, [0, 1, 1, 0], N)
        if st is None:
            st = Hm.folge(i, 36, [0, 1, 1, 0], N)
        Hm.stern4(gl, 20, 16 - brust, st, WEISS, HELLGRAU, GRAU, OFF)
        out = L.zusammen(H, W, [(out, 0, 0), (gl, 0, 0)])
    return out


if __name__ == '__main__':
    K.abschluss(sz, frame, N, MS, 'Cykyran War Counselor', 'cykyran-war-counselor', K.vorschau_pfad())
