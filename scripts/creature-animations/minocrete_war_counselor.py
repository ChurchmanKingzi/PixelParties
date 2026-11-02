# -*- coding: utf-8 -*-
"""Idle-Animation für „Minocrete War Counselor“ (Creature) — der Minotaurus-Krieger mit Hörnerhelm, rotem Busch, rot glühenden Augen, weißer Pluderhose und riesiger Doppelaxt.

Quelle: src/minocrete-war-counselor.png (52×30 px, 35 Farben, 668 Pixel).
PICK: [["MotiveSteamDwarfs", 391, 1]]      (Ebene „Minocrete War Counsellor“, ganze Ebene = eine Figur samt Axt, 52×30 px; nur in dieser Karte)
Abgleich mit der Kartenkunst Minocrete_War_Counselor.png (76×51): Sprite sitzt dort 100 % pixelgleich. Auf der Karte stehen außerdem Felswand, Busch und Steinturm (Hintergrund) — nichts davon gehört zur Figur.

Aufruf:   python3 minocrete_war_counselor.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/minocrete-war-counselor.png + .json

Was im Sprite ist (x, y im 52×30-Sprite):
* DOPPELAXT (x 0–26, y 7–23): vorn ein großes Doppelblatt (x 0–15) in Stahlgrau (81,83,80)/(104,106,103)/(122,124,121) mit schwarzem Umriss (0,2,0), dahinter der schwarze Stiel (12,12,12)/(44,44,44) bei (13–26, 14–16),
  der in der Faust (27, 14–16) endet. Die Axt wird waagerecht nach links gehalten.
* HELMBUSCH (x 38–43, y 0–6): rote Federn (156,0,0)/(214,0,0)/(255,0,0), Basis y 6.
* HÖRNERHELM (x 34–47, y 4–10): zwei weiße/graue Hörner (213,213,213)/(156,156,156)/(106,106,106) mit braunem Umriss (49,24,0) links (35–37) und rechts (44–46), in der Mitte der Stahlnasenschutz
  (66,66,66)/(76,74,93)/(112,112,112)/(194,194,194) bei (38–43, 6–10), darunter der schwarze Sehschlitz (0,0,0) bei y 9.
* GESICHT (x 34–50, y 10–20): brauner Stierkopf (123,41,16)/(148,65,24)/(164,74,41)/(189,90,57), ZWEI rot glühende Augen: dunkelrot (116,0,0) bei (38,12) und (43,12), rot (196,0,0) bei (38,13) und (42,13);
  Schnauze mit Nasenlöchern (77,23,0) bei (39,17), (41–42,17).
* RUMPF/ARME (x 27–51, y 11–24): muskulöser brauner Oberkörper; der linke Arm (Bildseite) streckt sich zur Axt (x 26–36, y 12–17) mit goldenem Armreif (230,131,16)/(255,222,90) bei (28–29, 14–15);
  der rechte Arm hängt (46–50, 11–24) mit goldenem Armreif bei (48–49, 20–21).
* GÜRTEL/HOSE (x 33–50, y 19–26): schwarzer Gürtel (34,34,34), weiße Pluderhose (245,245,245)/(211,211,211)/(153,153,153)/(111,111,111).
* BEINE/HUFE (x 34–47, y 26–29): braune Beine (123,41,16)/(148,65,24), weiße Hufspitzen (246,246,246)/(189,189,189), schwarze Sohle.
Metall/Gold im Sprite: Axt, Nasenschutz, goldene Armreife. Nur sie glänzen (Regel 14); Hörner, Fell/Haut, Hose, Federn nicht. Kein Feuer, kein Dampf, keine Partikel.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* Auf und ab (Periode 24 = zweimal pro Schleife): die Hosenzeile 25 (Beinansatz) wird einmal doppelt eingefügt (Texturmischung): Rumpf, Kopf, Arme und Helm steigen 1 px, Beine/Hufe bleiben am Boden. Die Axt ist eine
  eigene Ebene und steigt starr mit der Faust (nichts an ihr wird gestreckt). Der Kopf bleibt starr (kein seitliches Neigen, keine Verlagerung).
* Axt schwankt: das schwere Blatt neigt sich um die Faust (L.spalten_welle, Gelenk x 27): Blatt ±2 px, Gefälle ≤ 0,1 px je Spalte, Periode 24 und 3 Neigungen pro Schleife; Faust und Arm bleiben stehen.
* Helmbusch wiegt (Zeilen 0–3): zwei Wellen bis ±2 px an der Spitze, nach unten auslaufend (Gefälle ≤ 1 px je Zeile); die Zeile 4/5 mit den beiden Hörneransätzen bleibt starr.
* Blinzeln (Frames 19–21 und 41–43): die vier roten Augenpixel nehmen die dunkle Gesichtsfarbe (49,24,0) an (Lid = umgebende Fellfarbe), kein Glühen, kein Farbspiel.
* Metall glänzt (Regel 14): ein Lichtband läuft zweimal über das Axtblatt (Frames 3–14 und 27–38, auf der Graurampe des Sprites), ein Lichtband über den Nasenschutz (Frames 16–21) und beide Armreife (Frames 40–45),
  dazu je ein Glitzerstern auf dem Blatt (Frames 10–13, 34–37) und dem Nasenschutz.
* Hufscharren: das linke Bein hebt sich 1 px hinter die Hose (Frames 10–17), später das rechte (Frames 34–41).
Frame 0 = Original (Ruhepose). Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Ergänzungen: keine (nichts Verdecktes wird freigelegt; Beine liegen beim Heben hinter der Hose).
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_krieger as K
import anim_lib as L

N, MS = 48, 62
sz = K.Szene('minocrete-war-counselor', (3, 4, 3, 2))        # Busch ±2 px, Wippen 1 px, Axtneigung ±2 px
spr, OFF, H, W = sz.spr, sz.OFF, sz.H, sz.W
PT = sz.pt
TEST_EBENEN = ('figur',)

AXT_R = [(81, 83, 80), (104, 106, 103), (122, 124, 121), (153, 153, 153), (211, 211, 211), (245, 245, 245)]
HELM_R = [(66, 66, 66), (76, 74, 93), (112, 112, 112), (156, 156, 156), (194, 194, 194), (213, 213, 213)]
GOLD_R = [(230, 131, 16), (255, 222, 90)]
FELL = sz.f(39, 12)                                              # (49,24,0) dunkles Gesicht
BLINK = {(38, 12): FELL, (43, 12): FELL, (38, 13): FELL, (42, 13): FELL}

m_axt = sz.vor & (sz.xx <= 26) & ~((sz.xx == 26) & (sz.yy == 13))
rest = sz.vor & ~m_axt
bein_l = rest & (sz.yy >= 26) & (sz.xx <= 40)
bein_r = rest & (sz.yy >= 26) & (sz.xx >= 41)
koerper = rest & ~bein_l & ~bein_r
m_blatt = sz.farben_in(sz.rechteck(0, 7, 15, 23), set(AXT_R))
m_helm = sz.farben_in(sz.rechteck(38, 6, 43, 10), set(HELM_R))
m_gold = sz.farben_in(sz.rechteck(27, 12, 51, 24), set(GOLD_R))


def frame(i, nur=None):
    ebenen = nur if nur is not None else ('figur', 'glitzer')
    k = sz.ebene(koerper)
    axt = sz.ebene(m_axt)
    # --- Blinzeln ---
    if K.fenster(i, N, 19, 3) is not None or K.fenster(i, N, 41, 3) is not None:
        K.blinzeln(k, OFF, BLINK)
    # --- Metall glänzt: Axtblatt zweimal, Nasenschutz, Armreife ---
    for start in (3, 27):
        Hm.lichtband(axt, m_blatt, OFF, i, N, start, 12, AXT_R, stufen=1, breite=3.4, achse=(1.0, 1.0), kern=2)
    Hm.lichtband(k, m_helm, OFF, i, N, 16, 6, HELM_R, stufen=1, breite=2.4, achse=(1.0, 0.0), kern=2)
    Hm.lichtband(k, m_gold, OFF, i, N, 40, 6, GOLD_R, stufen=1, breite=2.4, achse=(1.0, 1.0), kern=2)
    Hm.lichtband(axt, m_gold, OFF, i, N, 40, 6, GOLD_R, stufen=1, breite=2.4, achse=(1.0, 1.0), kern=2)
    # --- Helmbusch wiegt (Zeilen 0–3) ---
    d = int(round(1.4 * np.sin(2 * np.pi * i / N) + 0.8 * np.sin(2 * np.pi * 3 * i / N)))
    Hm.zeilen_versatz(k, OFF, K.gefaelle(list(range(0, 4)), d))
    # --- Axt schwankt um die Faust ---
    v = 2.4 * np.sin(2 * np.pi * 3 * i / N)
    axt = L.spalten_welle(axt, 27 + sz.pl, 0.0, 0.0, bias=float(v))
    # --- Auf und ab: Hosenzeile 25 doppelt, Axt starr mit ---
    brust = Hm.stufe(i, N / 2, 1)
    k = K.bob(k, PT + 25, brust)
    axt = L.versetze(axt, 0, -brust)
    # --- Hufscharren ---
    ul = 1 if K.fenster(i, N, 10, 8) is not None else 0
    ur = 1 if K.fenster(i, N, 34, 8) is not None else 0
    bl, br = sz.ebene(bein_l, 0, -ul), sz.ebene(bein_r, 0, -ur)
    fig = L.zusammen(H, W, [(bl, 0, 0), (br, 0, 0), (axt, 0, 0), (k, 0, 0)])
    K.kontur(fig, sz.ERLAUBT, lambda c, x, y: (156, 0, 0) if (c[1] == 0 and c[2] == 0 and c[0] > 0) else (0, 2, 0) if x < 30 + sz.pl else (49, 24, 0))   # Regel 16
    out = fig if 'figur' in ebenen else sz.leer()
    if 'glitzer' in ebenen:
        gl = sz.leer()
        st = Hm.folge(i, 10, [0, 1, 2, 1], N)
        if st is None:
            st = Hm.folge(i, 34, [0, 1, 2, 1], N)
        dy_star = int(round(v * abs(4 - 27) / 27.0))                 # das Blatt neigt sich: der Stern folgt der Spalte x = 4
        Hm.stern4(gl, 4, 10 + dy_star - brust, st, (245, 245, 245), (211, 211, 211), (153, 153, 153), OFF)
        Hm.stern4(gl, 40, 8 - brust, Hm.folge(i, 18, [0, 1, 1, 0], N), (245, 245, 245), (211, 211, 211), (153, 153, 153), OFF)
        out = L.zusammen(H, W, [(out, 0, 0), (gl, 0, 0)])
    return out


if __name__ == '__main__':
    K.abschluss(sz, frame, N, MS, 'Minocrete War Counselor', 'minocrete-war-counselor', K.vorschau_pfad())
