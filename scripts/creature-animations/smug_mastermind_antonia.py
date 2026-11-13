# -*- coding: utf-8 -*-
"""Idle-Animation für „Smug Mastermind Antonia“ (Creature).

PICK: [["MotiveRussia", 21, 1]]
Quelle: src/smug-mastermind-antonia.png (24×27 px, 41 Farben) = Ebene 21, vollständig (die Ebenen 28/128 sind dieselbe Figur mit anderer Mimik, „Motive“ 1172 eine Kopie). Gegen die Kartenkunst abgeglichen;
die verschneiten Tannen und das Dorf sind Szene.

Was ist was (x/y im Sprite):
* Kopf (x 5–18, y 3–13): schwarze Kapuze/Fell mit rundem Ohr links (x 5–9, y 3–7), weißgraues Haar um das dunkle Gesicht, weiße Brauen (y 8), rote Augen (9–10 und 13–14, y 11), dazwischen weiß (Nase),
  rosa Wangen (8 und 15, y 12), schwarzer Mund (11–12, y 12–13) mit roter Zunge (12–13, y 14). Gesicht bleibt bis aufs Blinzeln fest.
* Goldener Würfel/Ornament rechts oben auf dem Kopf (x 12–21, y 0–9; Gold in vier Stufen, drei rote Punkte) – starr, geht mit dem Kopf.
* Dunkelroter Umhang (x 4–19, y 12–24), darunter schwarzes Gewand mit weißgrauer Schleife/Gürtel (y 18–21), schwarze Füße (y 25).
* Arme waagerecht ausgestreckt (schwarz, x 0–4 und 19–23, y 12–14), an jeder Hand hängt ein roter Kristall (x 1–3 bzw. 20–22, y 15–21: heller Kern oben, dunkle Spitze unten).
* Unter jedem Kristall ein rotes Funkel-Kreuz am Boden (3×3, y 24–26) = Sparkle des Edelsteins (im Motiv der Partnerkarte Monia sind es weiße Sparkles).

Ablauf (60 Frames à 70 ms = 4,2 s, nahtlos; Frame 0 = Original):
* Atmen: Saumzeile 23 (unter der Schleife) wird texturiert eingefügt (0–1 px, Periode 30); Kopf und Goldwürfel heben sich starr mit, der Kopf bewegt sich nie seitlich.
* Arme + Kristalle heben und senken sich als starre Einheiten (Arm, Hand, Kristall): Atemhub plus eigenes Anheben 0–1 px (Periode 20, rechter Arm 5 Frames versetzt) – nichts wird gestreckt.
* Kristalle (Edelstein): der helle Kern wandert von oben nach unten durch den Kristall (5 Stellungen; links à 4 Frames = 3 Durchläufe, rechts à 3 Frames = 4 Durchläufe; nur die Rot-Stufen der Quelle).
* Funkel-Kreuze am Boden: bleiben am Boden stehen und funkeln (Kreuz → Punkt → aus → Punkt → Kreuz), jeweils wenn der Kern unten ankommt; links und rechts versetzt.
* Goldwürfel (Gold): zweimal je Schleife ein diagonales Lichtband (eine Stufe heller auf der Gold-Rampe, der dunkle Goldrand bleibt), dazu ein kurzer Sparkle an seiner oberen Ecke (3 Frames).
* Blinzeln beider Augen (Frames 24–26 und 50–52): Rot → dunkles Gesichtsgrau.
ERGÄNZUNG: (4, 14) und (19, 14) – Umhangrand unter den Achseln in Umrissschwarz (0,2,0), sichtbar nur, wenn der Arm 1 px über der Schulter steht (sonst entstünde dort eine Lücke). Nur ganze Pixel, nur Farben der Quelle.
"""
import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_n2 as N2
import anim_textur as TX
TX.umleiten()

N, MS = 60, 70
FIG = N2.Figur('smug-mastermind-antonia', pad=(2, 2, 4, 2))
spr = FIG.spr
xx, yy = FIG.xx, FIG.yy
OFF = FIG.off

GOLD = FIG.farbe((201, 99, 0), (249, 203, 25), FIG.f(15, 4), (255, 254, 130))
GOLD = sorted(GOLD, key=sum)
R_HELL, R_MITTE, R_ROT, R_DUNKEL = FIG.f(2, 15), FIG.f(1, 15), FIG.f(1, 17), FIG.f(1, 20)
GESICHT = FIG.f(11, 10)
WEISS = FIG.farbe((255, 255, 247))
DUNKEL = FIG.f(4, 15)

KREUZE = FIG.op & (yy >= 24) & ((xx <= 3) | (xx >= 20))
ARM_L = FIG.op & ~KREUZE & (((xx <= 4) & (yy >= 12) & (yy <= 14)) | ((xx <= 3) & (yy >= 15)))
ARM_R = FIG.op & ~KREUZE & (((xx >= 19) & (yy >= 12) & (yy <= 14)) | ((xx >= 20) & (yy >= 15)))
KOERPER = FIG.op & ~KREUZE & ~ARM_L & ~ARM_R
M_GOLD = FIG.maske(GOLD) & (yy <= 9) & (xx >= 12)


def kristall(a, x0, pos):
    """Kristall (Spalten x0…x0+2, Zeilen 15–20): heller Kern (2 Zeilen) an Stellung pos (0 = oben = Original … 4)."""
    for y in range(15, 20):
        hell = y in (15 + pos, 16 + pos)
        N2.setze(a, OFF, {(x0, y): R_MITTE if hell else R_ROT, (x0 + 1, y): R_HELL if hell else R_MITTE, (x0 + 2, y): R_MITTE if hell else R_ROT})
    if pos == 4:
        N2.setze(a, OFF, {(x0 + 1, 20): R_MITTE})


def kreuz(x0, stufe):
    """Funkel-Kreuz (Mitte x0, y 25): 2 = Original, 1 = nur Mitte, 0 = aus."""
    a = L.leer(FIG.H, FIG.W)
    if stufe >= 1:
        N2.setze(a, OFF, {(x0, 25): R_ROT}, neu=True)
    if stufe >= 2:
        N2.setze(a, OFF, {(x0 - 1, 25): R_DUNKEL, (x0 + 1, 25): R_DUNKEL, (x0, 24): R_DUNKEL, (x0, 26): R_DUNKEL}, neu=True)
    return a


FUNKEL = [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 0, 0, 1, 1, 2, 2]      # je 20 Frames (ein Kerndurchlauf)
FUNKEL_R = [2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 0, 0, 1, 1]                           # rechter Kristall: 15 Frames je Durchlauf


def frame(i, nur=None):
    ko = FIG.platz(KOERPER)
    N2.setze(ko, OFF, {(4, 14): DUNKEL, (19, 14): DUNKEL}, neu=True)             # Ergänzung: Umhangrand unter den Armen
    al, ar = FIG.platz(ARM_L), FIG.platz(ARM_R)
    # Blinzeln
    if N2.fenster(i, N, 24, [1, 1, 1]) or N2.fenster(i, N, 50, [1, 1, 1]):
        N2.setze(ko, OFF, {(9, 11): GESICHT, (10, 11): GESICHT, (13, 11): GESICHT, (14, 11): GESICHT})
    # Gold: Lichtband + Sparkle
    for start in (6, 36):
        Hm.lichtband(ko, M_GOLD, OFF, i, N, start, 12, GOLD[1:], stufen=1, breite=3.0, achse=(1.0, 1.0))
    N2.funke(ko, OFF, 16, 1, N2.fenster(i, N, 17, [0, 1, 0]), WEISS, GOLD[-1])
    # Kristalle
    kristall(al, 1, (i // 4) % 5)
    kristall(ar, 20, (i // 3) % 5)
    # Bewegung
    b = N2.hub(i, 30, 1)
    ko = TX.streck_zeile(ko, FIG.pt + 23, b)
    al = L.versetze(al, 0, -b - N2.hub(i, 20, 1))
    ar = L.versetze(ar, 0, -b - N2.hub(i, 20, 1, versatz=5))
    kl = kreuz(2, FUNKEL[i % 20])
    kr = kreuz(21, FUNKEL_R[i % 15])
    return L.zusammen(FIG.H, FIG.W, [(kl, 0, 0), (kr, 0, 0), (ko, 0, 0), (al, 0, 0), (ar, 0, 0)])


if __name__ == '__main__':
    N2.haupt(__import__(__name__), 'Smug Mastermind Antonia')
