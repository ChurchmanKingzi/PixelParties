# -*- coding: utf-8 -*-
"""Idle-Animation für „The Weather Orchestra“ (Creature) — die drei Musikantinnen mit den Schachbrett-Hütchen: Trompete (links), Keyboard (Mitte hinten), Geige (rechts).

Quelle: src/the-weather-orchestra.png (59×42 px, 107 Farben) = die drei Figuren in der Anordnung der Kartenkunst; zusätzlich die drei Einzelfiguren
        src/the-weather-orchestra-keys.png (16×27), -trumpet.png (26×25), -violin.png (20×26), damit beim Wippen nichts Verdecktes fehlt (der Trompetentrichter liegt vor den
        Füßen der Keyboarderin).
PICK: [["MotiveHawaii", 165, 1], ["MotiveHawaii", 164, 1], ["MotiveHawaii", 159, 1]] (Keyboard, Trompete, Geige; Reihenfolge = Schichtung von hinten nach vorn, Positionen = Ebenen-
      Positionen in der xcf). Nicht übernommen: Blitze (167), Wirbelstürme (162/163), Regen (158) — das ist das Wetter um das Orchester herum (Szenen-Effekt), kein Teil der Figuren.
      Ebene 166 enthält dieselbe Trompeterin und Keyboarderin noch einmal (Kopien). Abgleich mit The_Weather_Orchestra.png: Anordnung und Figuren stimmen.

Was im Sprite ist (x, y im 59×42-Gesamtbild; Teil-Ursprünge: Keyboard (22,0), Trompete (0,17), Geige (39,16)):
* KEYBOARDERIN: Hütchen mit grünem Edelstein-Knopf (Stoffhut, kein Glanz), braunes Haar, schwarze Augen, Hände (247,206,140) links und rechts auf dem umgehängten KEYBOARD
  (Teil-y 18–24: weiße Tasten (254,255,255), graue Zwischenräume, schwarze Tasten), Schuhe.
* TROMPETERIN: Hütchen mit türkisem Knopf, silbernes Haar, goldene TROMPETE (Teil-x 10–25, y 7–17: Trichter rechts, drei Ventilkappen auf der Röhre bei Teil-(10–11 / 13–14 / 16–17, 11)),
  Faltenrock, Beine.
* GEIGERIN: Hütchen mit rotem Knopf, blondes Haar, geschlossene Augen (blinzelt nicht), braune GEIGE (Teil-x 0–8 Hals mit schwarz-weißen Wirbeln, Korpus y 17–21), weißer BOGEN
  (Diagonale von Teil-(7,13) nach (13,19), brauner Schatten daneben), Bogenhand bei Teil-(14–17, 16–18).
Gold der Trompete: echtes Metall, aber sehr klein und dauernd in Bewegung → bewusst kein Glanzband (Unruhe); keine Partikel, kein Feuer.

Ablauf (48 Frames à 70 ms = 3,36 s, nahtlos); Idee: das Trio SPIELT sichtbar (Runde 8, Nutzerwunsch) — jede in ihrem eigenen Takt, Hände/Arme als Posen.
* Keyboarderin: wippt im Takt (Periode 12; Rumpfzeile Teil-y 16 texturiert eingefügt, Kopf und Schultern +1 px, Hände und Keyboard bleiben liegen). BEIDE HÄNDE spielen: jede Hand
  (Handgelenk + Hand + Umriss, starre Einheit aus den Quellpixeln) wechselt zwischen „gedrückt“ (Originalform, Fingerspitze auf der Taste) und „gehoben“ (ab Frame 2; Hand 1 px kürzer, Fingerspitze
  über der Taste) und greift dabei 1 px nach links/rechts um (linke Hand: Achtel-Muster 0/+1/0/−1, rechte Hand: punktiertes Muster, gegenläufig → die Hände wechseln sichtbar ab).
  Liegt die Fingerspitze auf einer weißen Taste, wird diese beim Drücken grau (189,189,189 – Farbe der Tastenzwischenräume). Das Keyboard unter den Händen ist fertiggezeichnet (ERGÄNZUNG).
* Trompeterin: wippt mit der ganzen Trompete als starrer Einheit (Periode 16; Beinzeile Teil-y 22 texturiert eingefügt → alles darüber +1 px) und BLÄST im selben Takt: solange sie
  oben ist, sind die Backen aufgeblasen (das Wangenrot wächst je 1 px zur Mitte: (4,12) und (7,12)). Die FINGER im Ventilrahmen (Haut bei Teil-(12,16)/(13,16)) drücken die Ventile:
  alle 4 Frames taucht eine der drei Ventilkappen in die Röhre, dazu hebt sich der zugehörige Finger 1 px (linkes Ventil: Finger x 12, mittleres: Finger x 13, rechtes: beide).
* Geigerin: wiegt sich langsam (Periode 24; Beinzeile Teil-y 23 texturiert eingefügt, Oberkörper + Geige + Bogen starr +1 px). Der BOGENARM streicht: Bogen (weiß + brauner Schatten),
  Bogenhand und weißer Ärmel bilden EINE starre Pose-Einheit und fahren entlang der Bogen-Diagonale hin und her (−1 … +2 px in x und y, Periode 16: Abstrich bis ganz nach rechts unten,
  kurzer Halt, Aufstrich). Geige, Griffhand und Körper bleiben; alles, was Bogen/Hand/Ärmel verdeckt hatten, ist fertiggezeichnet (ERGÄNZUNG).
Frame 0 = Original. Köpfe bewegen sich nur senkrecht.
ERGÄNZUNGEN (Teil-Koordinaten, nur Quellfarben):
* Keyboard unter den Händen: Zeile 17 x 2–4 und x 11–13 dunkelrot (64,0,0) (Ärmelunterkante); Zeile 18 x 1–4, 10–13 Keyboard-Oberkante (18,7,13); Zeilen 19–20 x 1–4, 10–13 Tasten nach
  dem Muster der sichtbaren Tasten (gerade Spalte weiß, ungerade grau).
* Geige unter Bogen/Hand/Ärmel: (9,15) dunkelrot (Ärmelumriss der Griffhand), (10,15) Kleid (70,48,51); (10,16) dunkelrot, (11,16) und (15–17,16) Geigenkante (123,69,0);
  Saiten/Griffbrett Zeile 17 x 11–17 und Zeile 18 x 12–17 (Fortsetzung des Musters 210/188, dann dunkel 51 bzw. 26 bis zum Saitenhalter); (13,19) (14,19) Korpus (105,59,0), (15,19) (123,69,0).
"""
import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_n5 as G
import anim_textur as TX
TX.umleiten()

N, MS = 48, 70
F = G.Figur('the-weather-orchestra', (2, 5, 3, 2))
spr = F.spr
KEYS, TRUMP, VIOL = (L.lade('the-weather-orchestra-' + n) for n in ('keys', 'trumpet', 'violin'))
URSPRUNG = {'k': (22, 0), 't': (0, 17), 'v': (39, 16)}
RAND = 2                                                              # Luft über jeder Teilfigur für den Hub


def teil(a, rechts=0):
    return L.platz(a, a.shape[0] + RAND, a.shape[1] + rechts, 0, RAND)


def px(a, x, y, c):
    if c is None:
        a[y + RAND, x] = 0
    else:
        a[y + RAND, x, :3] = c
        a[y + RAND, x, 3] = 255


def farbe(a, x, y):
    assert a[y, x, 3], (x, y)
    return tuple(int(v) for v in a[y, x, :3])


# ---------------------------------------------------------------- Keyboarderin
WEISS, GRAU = (254, 255, 255), (189, 189, 189)
K_ROT, K_KANTE = farbe(KEYS, 2, 17), farbe(KEYS, 5, 18)
HAND_X = {'l': 1, 'r': 10}                                             # linke Spalte der Hand-Einheit (4 breit, Zeilen 17–20)
HAND_AB = {(dx, dy): farbe(KEYS, 1 + dx, 17 + dy) for dx, dy in ((1, 0), (2, 0), (3, 0), (0, 1), (1, 1), (2, 1), (3, 1), (0, 2), (1, 2), (2, 2), (1, 3))}   # gedrückt = Original
HAND_AUF = {k: v for k, v in HAND_AB.items() if k[1] <= 1}
HAND_AUF.update({(1, 2): HAND_AB[(1, 3)], (2, 2): HAND_AB[(2, 2)]})   # gehoben: Fingerspitze fehlt, Umriss schließt eine Zeile höher
for k_, v_ in HAND_AB.items():                                         # rechte Hand hat dieselbe Form
    assert farbe(KEYS, 10 + k_[0], 17 + k_[1]) == v_, k_
# je Schritt (2 Frames): (seitlicher Versatz, gehoben?)
SPIEL_L = [(0, 0), (0, 1), (1, 0), (1, 1), (0, 0), (0, 1), (-1, 0), (-1, 1)] * 3
SPIEL_R = [(0, 0), (0, 0), (0, 1), (-1, 0), (-1, 0), (-1, 1), (0, 0), (0, 0), (0, 1), (1, 0), (1, 0), (1, 1)] * 2
assert len(SPIEL_L) == len(SPIEL_R) == N // 2


def keyboard_leer():
    a = teil(KEYS)
    for x0 in (1, 10):
        for x in range(x0, x0 + 4):
            if x0 + 1 <= x:
                px(a, x, 17, K_ROT)
            px(a, x, 18, K_KANTE)
            for y in (19, 20):
                px(a, x, y, WEISS if x % 2 == 0 else GRAU)
    return a


K_LEER = keyboard_leer()


def keyboard(i):
    a = K_LEER.copy()
    for seite, spiel in (('l', SPIEL_L), ('r', SPIEL_R)):
        dx, auf = spiel[(i // 2) % len(spiel)]
        x0 = HAND_X[seite] + dx
        if not auf and i >= 2 and tuple(int(v) for v in a[21 + RAND, x0 + 1, :3]) == WEISS:      # Taste unter der Fingerspitze
            px(a, x0 + 1, 21, GRAU); px(a, x0 + 1, 22, GRAU)
        for (hx, hy), c in (HAND_AUF if auf else HAND_AB).items():
            px(a, x0 + hx, 17 + hy, c)
    return TX.streck_zeile(a, RAND + 16, 1) if Hm.stufe(i, 12, 1) else a


# ---------------------------------------------------------------- Trompeterin
VENTIL = [None, 1, None, 2, None, 0] * 2                              # je 4 Frames; 0 links, 1 Mitte, 2 rechts
KAPPE = {0: (10, 11), 1: (13, 14), 2: (16, 17)}
FINGER = {0: (12,), 1: (13,), 2: (12, 13)}
ROSA = farbe(TRUMP, 3, 12)
assert ROSA == farbe(TRUMP, 8, 12)


def trompete(i):
    a = teil(TRUMP)
    v = VENTIL[(i // 4) % len(VENTIL)]
    if v is not None:
        for x in KAPPE[v]:
            px(a, x, 11, None)
        for x in FINGER[v]:
            px(a, x, 15, farbe(TRUMP, x, 16)); px(a, x, 16, farbe(TRUMP, x, 15))   # Finger und Rohrstück dahinter tauschen die Zeile
    hoch = Hm.stufe(i, 16, 1)
    if hoch:                                                          # Backen aufgeblasen
        px(a, 4, 12, ROSA); px(a, 7, 12, ROSA)
    return TX.streck_zeile(a, RAND + 22, 1) if hoch else a


# ---------------------------------------------------------------- Geigerin
G_ROT, G_KLEID, G_KANTE, G_KORPUS = farbe(VIOL, 7, 15), farbe(VIOL, 10, 14), farbe(VIOL, 12, 16), farbe(VIOL, 12, 19 + 1)
S_H, S_M, S_D1, S_D2 = farbe(VIOL, 9, 17), farbe(VIOL, 10, 17), farbe(VIOL, 8, 17), farbe(VIOL, 7, 18)
ARM_PX = ([(7 + k, 13 + k) for k in range(7)] + [(8 + k, 13 + k) for k in range(6)]                       # Bogen + Schatten
          + [(15, 16), (13, 17), (14, 17), (15, 17), (14, 18), (15, 18), (14, 19), (15, 19)]                # Bogenhand mit Umriss
          + [(16, 16), (17, 16), (16, 17), (17, 17), (16, 18), (17, 18), (18, 16), (18, 17)])               # Ärmel + Umriss unten/rechts
ARM = {p_: farbe(VIOL, *p_) for p_ in ARM_PX}
G_ERG = {(7, 13): None, (8, 13): None, (8, 14): None, (9, 14): None, (9, 15): G_ROT, (10, 15): G_KLEID, (10, 16): G_ROT, (11, 16): G_KANTE,
         (15, 16): G_KANTE, (16, 16): G_KANTE, (17, 16): G_KANTE,
         (11, 17): S_H, (12, 17): S_M, (13, 17): S_D1, (14, 17): S_D1, (15, 17): S_D1, (16, 17): S_D1, (17, 17): S_D1,
         (12, 18): S_H, (13, 18): S_M, (14, 18): S_D2, (15, 18): S_D2, (16, 18): S_D2, (17, 18): S_D2,
         (13, 19): G_KORPUS, (14, 19): G_KORPUS, (15, 19): G_KANTE}
STRICH = [0, 1, 2, 2, 1, 0, -1, -1]                                   # je 2 Frames: Versatz des Bogenarms entlang der Diagonale


def geige_leer():
    a = teil(VIOL, rechts=3)
    for (x, y), c in G_ERG.items():
        px(a, x, y, c)
    return a


V_LEER = geige_leer()


def geige(i):
    a = V_LEER.copy()
    d = STRICH[(i // 2) % len(STRICH)]
    for (x, y), c in ARM.items():
        px(a, x + d, y + d, c)
    return TX.streck_zeile(a, RAND + 23, 1) if Hm.stufe(i, 24, 1) else a


def frame(i):
    out = L.leer(F.H, F.W)
    for name, a in (('k', keyboard(i)), ('t', trompete(i)), ('v', geige(i))):
        ox, oy = URSPRUNG[name]
        L.einsetzen(out, a, F.pl + ox, F.pt + oy - RAND)
    return out


if __name__ == '__main__':
    G.abschluss(F, 'The Weather Orchestra', [frame(i) for i in range(N)], MS)
