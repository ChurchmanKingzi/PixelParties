# -*- coding: utf-8 -*-
"""Idle-Animation für „Harpthenean War Counselor“ (Creature) — die Harpyien-Kriegerin: Stahlhelm mit rotem Busch, eisblaue Flügel, schwarze Handschuhe, goldener Schurz, großer Rundschild, Krallenfüße.

Quelle: src/harpthenean-war-counselor.png (26×36 px, 49 Farben, 537 Pixel).
PICK: [["MotiveSteamDwarfs", 393, 1]]      (Ebene „Harpthenean War Counsellor“, Figur 1 = Pose mit Schild; nur in dieser Karte)
Vorlage für Verdecktes: Kandidat 4 (MotiveSteamDwarfs 365, „Ebene #45“, 27×32) zeigt dieselbe Figur OHNE Schild: Hüfte/Schurz und beide Beine. Er wird nicht benutzt (der Schild gehört zur Kartenfigur), nur zum Verständnis.
Abgleich mit der Kartenkunst Harpthenean_War_Counselor.png (76×51): Sprite sitzt dort 99,8 % pixelgleich. Der schwarze Schattenfleck unter der Figur (Ebenenteil, 4 Zeilen unter dem Schild) gehört nicht zum
Sprite; er zeigt nur, dass die Harpyie über dem Boden SCHWEBT (Flügel gespreizt, Füße hängen).

Aufruf:   python3 harpthenean_war_counselor.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/harpthenean-war-counselor.png + .json

Was im Sprite ist (x, y im 26×36-Sprite):
* HELMBUSCH (x 10–15, y 0–5): rote Federn (156,0,0)/(214,0,0)/(255,0,0); Basis y 6 mit schwarzen Ecken.
* STAHLHELM (x 8–17, y 6–11): Metall (66,66,66)/(76,74,93)/(112,112,112)/(194,194,194)/(195,195,195), schwarzer Rand.
* GESICHT (x 8–17, y 11–17): helle Haut (246,205,139)/(255,230,213)/(238,156,123); Augen: je ein hellblauer Iris-Pixel (172,213,255) bei (10,13) und (15,13), je ein schwarzer Wimpernpixel bei (11,13) und (14,13),
  je ein weißer Pixel (246,255,255) bei (10,14) und (15,14) und je ein dunkelroter (123,8,24) bei (11,14) und (14,14); braune Haarsträhnen (49,24,0) neben dem Gesicht (x 6–7 und 18–19, y 12–16).
* FLÜGEL (x 0–9 links, x 16–25 rechts, y 5–18): Federn in Weiß/Eisblau (246,255,255)/(222,255,255)/(180,246,255)/(172,213,255)/(139,213,255)/(106,197,255), ohne eigenen Umriss; sie wachsen hinter den Schultern heraus.
* RUMPF (y 17–21): dunkelgrauer Panzer (66,66,66)/(76,74,93)/(194,194,194)/(112,112,112); schwarze Arme/Handschuhe (0,0,0)/(32,32,32)/(41,41,41)/(46,46,46)/(56,56,56) bei (4–6, 18–24) und (19–22, 18–25).
* SCHILD (x 1–14, y 21–35): großer Rundschild, Rand in Gelbgrün (127,134,27)/(164,172,35)/(198,209,42)/(207,217,68), Fläche Silber (194,194,194)–(229,229,229).
* SCHURZ/GOLD (x 14–18, y 21–25): goldene Rüstung (230,131,16)/(255,180,24)/(255,222,90)/(255,246,172); darunter das rechte BEIN (14–19, 25–29): orange Haut (230,131,82)/(189,90,57) mit weißer Kralle.
Metall/Gold im Sprite: Stahlhelm, Schild, goldener Schurz. Nur sie glänzen (Regel 14); Federn, Haut, Haar, Handschuhe nicht. Kein Feuer, kein Dampf, keine Partikel.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos) — die Harpyie SCHWEBT (Schatten in der Quelle, Flügel offen), darum darf sie schweben:
* Flügelschlag (Periode 16 = dreimal pro Schleife): beide Flügel schwenken um die Schulter (L.spalten_welle mit Anschluss am Rumpf): Spitzen +3 px hoch, −2 px nach unten, nach innen auslaufend (Gefälle ≤ 0,4 px je
  Spalte); der Anschluss am Rumpf bleibt stehen (fuell), die Federn bleiben unverändert (keine Spaltenkopie).
* Schweben: während des Abschwungs steigt die ganze Figur starr 1 px (Helm, Gesicht, Schild, Beine zusammen), beim Aufschwung sinkt sie zurück. Nichts wird gestreckt.
* Helmbusch wiegt (Zeilen 0–5): zwei Wellen (3 s und 1 s) bis ±2 px an der Spitze, nach unten auslaufend (Gefälle ≤ 1 px je Zeile).
* Beine baumeln (Zeilen 26–29, rechtes Bein): zweimal pro Schleife schwingt es 1 px nach rechts und zurück (Frames 8–15 und 32–39); der Schild bleibt starr.
* Blinzeln (Frames 19–21 und 41–43): erst der Iris-Pixel, dann auch die weißen/roten Pixel nehmen die Hautfarbe (246,205,139) an (Lid = Haut, schwarze Wimpernpixel bleiben als Lidlinie); kein Augenglanz.
* Metall glänzt (Regel 14): ein Lichtband läuft über den Helm (Frames 4–11), eines über den Schild (Frames 22–33), eines über den Goldschurz (Frames 36–43); je ein Glitzerstern am Helm (Frames 14–17),
  an der Schildkante rechts oben (Frames 26–29) und am Schurz (Frames 38–41), alle vollständig im Metall.
Frame 0 = Original (Ruhepose). Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Ergänzungen: keine (die Flügel verlassen ihre Spalten nicht, die Lücke über dem Rumpf wird durch fuell mit dem untersten Federpixel der Spalte geschlossen — nur Quellfarben).
"""
import math
import sys

import numpy as np

import anim_humanoide as Hm
import anim_krieger as K
import anim_lib as L

N, MS = 48, 62
sz = K.Szene('harpthenean-war-counselor', (3, 5, 3, 3))      # Flügelhub +3/−2 px, Schweben 1 px, Busch ±2 px
spr, OFF, H, W = sz.spr, sz.OFF, sz.H, sz.W
TEST_EBENEN = ('figur',)

FEDER = {(246, 255, 255), (180, 246, 255), (106, 197, 255), (139, 213, 255), (222, 255, 255), (172, 213, 255)}
HELM_R = [(66, 66, 66), (76, 74, 93), (112, 112, 112), (194, 194, 194), (205, 205, 205)]
RAND_R = [(127, 134, 27), (164, 172, 35), (198, 209, 42), (207, 217, 68)]
SILBER_R = [(195, 195, 195), (205, 205, 205), (216, 216, 216), (229, 229, 229)]
GOLD_R = [(230, 131, 16), (255, 180, 24), (255, 222, 90), (255, 246, 172)]
HAUT = sz.f(12, 13)                                             # (246,205,139)
AUGE_OBEN = {(10, 13): HAUT, (15, 13): HAUT}
AUGE_ALLES = {(10, 13): HAUT, (15, 13): HAUT, (10, 14): HAUT, (15, 14): HAUT, (11, 14): HAUT, (14, 14): HAUT}
WEISS, HELL1, HELL2 = (246, 255, 255), (222, 255, 255), (229, 229, 229)

m_fl = sz.farben_in(sz.rechteck(0, 5, 9, 18), FEDER)
m_fr = sz.farben_in(sz.rechteck(16, 5, 25, 18), FEDER)
rest = sz.vor & ~m_fl & ~m_fr
m_helm = sz.farben_in(sz.rechteck(9, 7, 16, 11), set(HELM_R))
m_rand = sz.farben_in(sz.rechteck(1, 21, 14, 35), set(RAND_R))
m_silber = sz.farben_in(sz.rechteck(1, 21, 14, 35), set(SILBER_R))
m_gold = sz.farben_in(sz.rechteck(13, 21, 18, 25), set(GOLD_R))


def flug(i):
    """(Flügelversatz der Spitze, Rumpfversatz): Periode 16, Aufschwung zuerst."""
    phi = 2 * math.pi * i / 16
    s = math.sin(phi)
    v = -3.2 * s if s > 0 else -2.2 * s                          # negativ = Flügelspitze hoch
    body = -int(round(1.3 * max(0.0, -s)))                       # Rumpf steigt im Abschwung
    return v, body


def frame(i, nur=None):
    ebenen = nur if nur is not None else ('figur', 'glitzer')
    k = sz.ebene(rest)
    # --- Blinzeln ---
    lid = Hm.folge(i, 19, [1, 2, 1], N) or Hm.folge(i, 41, [1, 2, 1], N)
    if lid:
        K.blinzeln(k, OFF, AUGE_OBEN if lid == 1 else AUGE_ALLES)
    # --- Metall glänzt ---
    Hm.lichtband(k, m_helm, OFF, i, N, 4, 8, HELM_R, stufen=1, breite=2.4, achse=(1.0, 0.5), kern=2)
    Hm.lichtband(k, m_silber, OFF, i, N, 22, 12, SILBER_R, stufen=1, breite=3.4, achse=(1.0, 1.0), kern=2)
    Hm.lichtband(k, m_rand, OFF, i, N, 22, 12, RAND_R, stufen=1, breite=3.4, achse=(1.0, 1.0), kern=2)
    Hm.lichtband(k, m_gold, OFF, i, N, 36, 8, GOLD_R, stufen=1, breite=2.4, achse=(1.0, 1.0), kern=2)
    # --- Helmbusch wiegt ---
    d = int(round(1.4 * np.sin(2 * np.pi * i / N) + 0.8 * np.sin(2 * np.pi * 3 * i / N)))
    Hm.zeilen_versatz(k, OFF, K.gefaelle(list(range(0, 6)), d))
    # --- Bein baumelt (rechtes Bein, Zeilen 26–29) ---
    sw = 1 if (K.fenster(i, N, 8, 8) is not None or K.fenster(i, N, 32, 8) is not None) else 0
    if sw:
        Hm.bereich_versatz(k, OFF, {26: 0, 27: 1, 28: 1, 29: 1}, 15, 20)
    # --- Flügel: Schwenk um die Schulter, Anschluss am Rumpf bleibt ---
    v, body = flug(i)
    fl = L.spalten_welle(sz.ebene(m_fl), 9 + sz.pl, 0.0, 0.0, bias=v, fuell=k[..., 3] > 0)
    fr = L.spalten_welle(sz.ebene(m_fr), 16 + sz.pl, 0.0, 0.0, bias=v, fuell=k[..., 3] > 0)
    fig = L.zusammen(H, W, [(fl, 0, 0), (fr, 0, 0), (k, 0, 0)])
    K.kontur(fig, sz.ERLAUBT, lambda c, x, y: (156, 0, 0) if (c[1] == 0 and c[2] == 0 and c[0] > 0) else (0, 0, 0))    # Regel 16
    fig = L.versetze(fig, 0, body)                              # Schweben: ganze Figur starr
    out = fig if 'figur' in ebenen else sz.leer()
    if 'glitzer' in ebenen:
        gl = sz.leer()
        Hm.stern4(gl, 14, 8, Hm.folge(i, 14, [0, 1, 2, 1], N), WEISS, HELL1, HELL2, OFF)
        Hm.stern4(gl, 12, 25, Hm.folge(i, 26, [0, 1, 2, 1], N), WEISS, HELL1, HELL2, OFF)
        Hm.stern4(gl, 16, 23, Hm.folge(i, 38, [0, 1, 2, 1], N), (255, 246, 172), (255, 222, 90), (255, 180, 24), OFF)
        gl = L.versetze(gl, 0, body)
        out = L.zusammen(H, W, [(out, 0, 0), (gl, 0, 0)])
    return out


if __name__ == '__main__':
    K.abschluss(sz, frame, N, MS, 'Harpthenean War Counselor', 'harpthenean-war-counselor', K.vorschau_pfad())
