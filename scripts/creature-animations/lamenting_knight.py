# -*- coding: utf-8 -*-
"""Idle-Animation für „Lamenting Knight“ (Creature) — der klagende Ritter in dunkel-goldener Rüstung mit blauem Helmbusch, türkis glühenden Augen, TRÄNEN auf dem Visier und einer riesigen Gleve.

Quelle: src/lamenting-knight.png (46×30 px, 27 Farben).
PICK: [["Motive", 1465, 1]]     (Ebene „Ebene #621“, Figur 1; 100 % Treffer, nur in dieser Karte; Ritter samt Gleve vollständig. Treffer 0 „Poisoned Meat“ ist der Busch der Kulisse.)

Aufruf:   python3 lamenting_knight.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/lamenting-knight.png + .json

Was im Sprite ist (x, y im 46×30-Sprite):
* HELMBUSCH (x 34–41, y 0–6): blau (61,98,139)/(124,178,206)/(148,179,205), weht nach links oben aus. HÖRNER/Helmzier links (x 29–31, y 3–9) und rechts (x 42–44, y 3–9), golden.
* HELM/VISIER (x 32–40, y 7–16): dunkel, zwei türkis glühende AUGEN (33–34,13) und (37–38,13) in (150,214,220); darunter zwei TRÄNEN in derselben Farbe: rechts direkt unter dem Auge (38,14),
  links schon weiter unten (33,16) – daher der Name.
* RÜSTUNG (x 28–45, y 8–29): Gold (209,159,89)/(150,104,55) auf Dunkelbraun; blauer Umhangzipfel rechts (43–45, 14–16).
* GLEVE: Schaft waagerecht in y 19 (x 0–27, dunkel, vorn türkis x 0–10), darüber die große KLINGE (x 1–22, y 10–18): türkis (86,195,204)/(59,162,166) mit heller Schneide (203,201,191) oben und
  dunklem Rücken (83,76,60). Der ARM (x 23–31, y 17–21) hält sie waagerecht.
* Türkise ZACKEN am Boden links (x 26–29, y 22–28) und rechts (x 41–45, y 24–28): Kristalle/Geisterschein um die Füße – nicht eindeutig (Regel 1) → bleiben völlig still.
Metall: Klinge → Lichtband. Kein Feuer.

Idee: Der Ritter weint – die Tränen rinnen eine nach der anderen über das Visier herab, die Augen flackern, der Helmbusch weht, die Klinge blinkt; er atmet schwer und langsam (Regel 37).
Ablauf (72 Frames à 75 ms = 5,4 s, nahtlos):
* Tränen (Takt 24 Frames, 3× je Schleife): je Träne 1 Pixel (150,214,220), das alle 4 Frames 1 px tiefer rutscht: y 14 → 15 → 16 → 17 → weg (8 Frames Pause). Linke Träne in Spalte 33 (startet 8 Frames
  früher, deshalb in Frame 0 bei y 16 = Original), rechte in Spalte 38 (Frame 0 bei y 14 = Original). Unter der Träne steht die Rüstung (siehe Ergänzungen).
* Schweres Atmen (Periode 36): Rumpfzeile 22 wird einmal texturiert eingefügt (anim_textur) – Rumpf, Helm, Busch steigen 1 px; Arm + Gleve (alles x ≤ 27 sowie x ≤ 31 in y 17–21) gehen als STARRE Einheit 1 px mit;
  die Bodenzacken und die Füße bleiben stehen.
* Helmbusch: die oberen Zeilen 0–1 wehen 1 px nach links (Frames 10–19) bzw. nach rechts (Frames 46–55), Zeile 2 als Übergang bleibt.
* Augenflackern (Frames 30–31 und 60–61): die vier Augenpixel eine Stufe dunkler (97,206,219) – bleibt innerhalb der Augenpixel.
* Lichtband über die Klinge (Frames 36–47): türkise Pixel eine Stufe heller ((59,162,166) → (86,195,204) → (150,214,220)).
Frame 0 = Original. Ergänzungen (Quellfarben): unter den Tränen (33,16) → (142,113,77) wie (34,16), (38,14) → (56,46,31) wie (37,14).
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_n4 as N4
import anim_textur as TX
TX.umleiten()

N, MS = 72, 75
G = N4.Figur('lamenting-knight', 3, 2, 3, 2)
spr, H, W, OFF = G.spr, G.H, G.W, G.OFF
f = G.f
TRAENE, AUGE_D = f(33, 13), f(28, 25)                          # (150,214,220), (97,206,219)
TUERKIS = [f(18, 12), f(15, 13), f(12, 14), TRAENE]              # (39,88,85) < (59,162,166) < (86,195,204) < (150,214,220)
UMRISS = f(29, 3)
basis = spr.copy()
basis[16, 33, :3] = f(34, 16)
basis[14, 38, :3] = f(37, 14)
ZACKEN_F = [f(28, 22), f(28, 24), f(27, 25), f(41, 25)]         # türkise Bodenzacken (60,109,109), (97,206,219), (135,207,214) …
zacken = L.farbmaske(spr, [(60, 109, 109), (97, 206, 219), (135, 207, 214)]) & (G.yy >= 22)
gleve = G.da & ((G.xx <= 27) | ((G.xx <= 31) & (G.yy >= 17))) & (G.yy <= 21)
klinge = G.da & (G.xx <= 22) & (G.yy <= 18)
rumpf = G.da & ~zacken & ~gleve
G.erlaubt = G.erlaubt | set(TUERKIS)
AUGEN = [(33, 13), (34, 13), (37, 13), (38, 13)]


def traene(k, x, t):
    t %= 24
    if t < 16:
        Hm.setze(k, {(x, 14 + t // 4): TRAENE}, OFF)


def frame(i):
    k = G.ebene(rumpf, quelle=basis)
    traene(k, 33, i + 8)
    traene(k, 38, i)
    if Hm.folge(i, 30, [1, 1], N) or Hm.folge(i, 60, [1, 1], N):
        Hm.setze(k, {p: AUGE_D for p in AUGEN}, OFF)
    if Hm.takt(i, N, 10, 10):
        Hm.zeilen_versatz(k, OFF, {0: -1, 1: -1})
    elif Hm.takt(i, N, 46, 10):
        Hm.zeilen_versatz(k, OFF, {0: 1, 1: 1})
    g = G.ebene(gleve)
    Hm.lichtband(g, klinge, OFF, i, N, 36, 12, TUERKIS, stufen=1, breite=3.0)
    hub = Hm.stufe(i, N / 2, 1)
    if hub:
        k = TX.streck_zeile(k, G.PT + 22, 1)
    fig = L.zusammen(H, W, [(G.ebene(zacken), 0, 0), (k, 0, 0), (g, 0, -hub)])
    return G.schliessen(fig, lambda x, y: UMRISS)


if __name__ == '__main__':
    N4.abschluss(G, 'Lamenting Knight', [frame(i) for i in range(N)], MS, sys.argv, scale=4)
