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

Ablauf (48 Frames à 70 ms = 3,36 s, nahtlos); Idee: das Trio spielt — jede in ihrem eigenen Takt.
* Keyboarderin: wippt im Takt (Periode 12; Rumpfzeile Teil-y 16 wird texturiert eingefügt, Kopf und Schultern +1 px, Hände und Keyboard bleiben liegen); alle 3 Frames wird eine
  andere weiße Taste gedrückt (Tastenspalte grau (189,189,189) statt weiß — Farbe der Tastenzwischenräume).
* Trompeterin: wippt mit der ganzen Trompete als starrer Einheit (Periode 16; Beinzeile Teil-y 22 wird texturiert eingefügt → alles darüber +1 px); die mittlere und die rechte Ventilkappe
  werden abwechselnd gedrückt (Kappe verschwindet in der Röhre).
* Geigerin: wiegt sich langsam (Periode 24; Beinzeile Teil-y 23 texturiert eingefügt, Oberkörper + Geige + Bogen starr +1 px); der Bogen streicht entlang seiner eigenen Diagonale:
  die freie Bogenspitze wandert 1 px hinaus und bis 2 px zurück (Periode 16). Eine gerade Diagonale sieht verschoben identisch aus — nur die Spitze ändert sich; das Griffende bleibt in der Hand.
Frame 0 = Original. Köpfe bewegen sich nur senkrecht. Ergänzungen: keine (Verdecktes kommt aus den Einzelfiguren).
"""
import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_n5 as G
import anim_textur as TX
TX.umleiten()

N, MS = 48, 70
F = G.Figur('the-weather-orchestra', (2, 2, 3, 2))
spr = F.spr
KEYS, TRUMP, VIOL = (L.lade('the-weather-orchestra-' + n) for n in ('keys', 'trumpet', 'violin'))
URSPRUNG = {'k': (22, 0), 't': (0, 17), 'v': (39, 16)}
RAND = 2                                                              # Luft über jeder Teilfigur für den Hub


def teil(a):
    return L.platz(a, a.shape[0] + RAND, a.shape[1], 0, RAND)


def px(a, x, y, c):
    if c is None:
        a[y + RAND, x] = 0
    else:
        a[y + RAND, x, :3] = c
        a[y + RAND, x, 3] = 255


WEISS, GRAU = (254, 255, 255), (189, 189, 189)
TASTEN = [4, 8, 6, 14, 8, 4, 6, 14, 6, 8, 4, 14, 8, 6, 4, 8]         # je 3 Frames
BOGEN = [0, 0, -1, -1, -1, 0, 0, 1, 1, 2, 2, 2, 1, 1, 0, 0]


def keyboard(i):
    a = teil(KEYS)
    if i >= 3:                                                        # Frames 0–2: Original (noch keine Taste gedrückt)
        for y in (20, 21, 22):
            px(a, TASTEN[(i // 3) % len(TASTEN)], y, GRAU)
    return TX.streck_zeile(a, RAND + 16, 1) if Hm.stufe(i, 12, 1) else a


def trompete(i):
    a = teil(TRUMP)
    v = (i // 4) % 4                                                  # 0 nichts, 1 mittleres Ventil, 2 nichts, 3 rechtes Ventil
    if v == 1:
        px(a, 13, 11, None); px(a, 14, 11, None)
    elif v == 3:
        px(a, 16, 11, None); px(a, 17, 11, None)
    return TX.streck_zeile(a, RAND + 22, 1) if Hm.stufe(i, 16, 1) else a


def geige(i):
    a = teil(VIOL)
    k = BOGEN[i % 16]
    I, Q = tuple(int(v) for v in VIOL[13, 7, :3]), tuple(int(v) for v in VIOL[13, 8, :3])
    if k == -1:
        px(a, 6, 12, I); px(a, 7, 12, Q)
    if k >= 1:
        px(a, 7, 13, None); px(a, 8, 13, None)
    if k >= 2:
        px(a, 8, 14, None); px(a, 9, 14, None)
    return TX.streck_zeile(a, RAND + 23, 1) if Hm.stufe(i, 24, 1) else a


def frame(i):
    out = L.leer(F.H, F.W)
    for name, a in (('k', keyboard(i)), ('t', trompete(i)), ('v', geige(i))):
        ox, oy = URSPRUNG[name]
        L.einsetzen(out, a, F.pl + ox, F.pt + oy - RAND)
    return out


if __name__ == '__main__':
    G.abschluss(F, 'The Weather Orchestra', [frame(i) for i in range(N)], MS)
