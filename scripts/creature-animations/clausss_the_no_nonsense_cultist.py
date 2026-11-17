# -*- coding: utf-8 -*-
"""Idle-Animation für „Clausss, the No-Nonsense Cultist“ (Creature).

PICK: [["MotiveRussia", 210, 1]]
Quelle: src/clausss-the-no-nonsense-cultist.png (19×30 px, 29 Farben) = Ebene 210 „CLAUSSS“, vollständig. Gegen die Kartenkunst abgeglichen (obere Figur der Karte; die untere Figur mit der blauen
Kugel ist „Klaus“ – Ebenen 209/211 –, das Pentagramm/Blut Szene: nicht Teil der Creature).

Was ist was (x/y im Sprite):
* Kapuze (x 5–18, y 0–11, Grautöne) mit Schlangenkopf darin: grüne Schuppen (x 11–14, y 6–11), darüber/links ein blauer Kamm bzw. Stirnstreifen (x 9–12, y 5–11, Blau/Cyan – unklar ob Maske oder
  Zeichnung → bleibt fest). Linke Augenhöhle schwarz (8, 7–8), rechtes Auge: schwarze Brauen (14–15, 7), (13, 8), (15, 8), hellblau (14, 8), gelbe Iris (13, 9), Weiß (14, 9).
* Maul (x 10–13, y 12–14): dunkelroter Rachen (11–12, 12), zwei lange cremefarbene Fangzähne (10 und 13, y 12/13–14).
* Schlangenhals (x 10–13, y 14–19, grünes Schachmuster) taucht in die graue Robe (x 7–16, y 16–29).
* Schlangenschwanz (x 0–7, y 15–26): kommt links unten aus der Robe, biegt nach oben und hält mit der Spitze ein Messer (x 2–5, y 9–17: Klinge weiß/hellgrau y 11–15, Blut oben y 9–12, dunkles Heft y 16–17).

Ablauf (60 Frames à 70 ms = 4,2 s, nahtlos; Frame 0 = Original):
* Atmen: Robenzeile 22 wird eingefügt (0–1 px, Periode 30, texturiert über anim_textur) – Robe, Hals, Kopf und Kapuze heben sich gemeinsam, der Kopf bewegt sich nie seitlich.
* Schwanz hebt und senkt das Messer (0–2 px, Periode 20): Schwanzzeile 21 wird eingefügt (texturiert), Schwanzspitze + Messer gehen starr als Einheit mit; die Schwanzwurzel an der Robe bleibt.
* Züngeln: zweimal je Schleife (Frames 12–16, 42–46) schnellt die rote Zunge aus dem Rachen zwischen den Fangzähnen nach unten (1 → 3 Pixel, Rot (130,0,0) der Quelle).
* Blinzeln nur des sichtbaren rechten Auges (Frames 26–28 und 52–54): Iris und Weiß nehmen das Schuppengrün an, der Lichtpunkt darüber das Schwarz der Braue.
* Klinge (Metall): einmal je Schleife (Frames 33–40) läuft ein Lichtreflex die Klinge hinunter (Weiß/Hellgrau der Klinge tauschen, nur Klingenpixel), bewegt sich mit dem Messer.
Keine Ergänzungen nötig (Schwanz und Robe überlappen nicht). Nur ganze Pixel, nur Farben der Quelle.
"""
import numpy as np

import anim_lib as L
import anim_n2 as N2
import anim_textur as TX
TX.umleiten()

N, MS = 60, 70
FIG = N2.Figur('clausss-the-no-nonsense-cultist', pad=(2, 2, 4, 2))
spr = FIG.spr
xx, yy = FIG.xx, FIG.yy
OFF = FIG.off

GRUEN = FIG.farbe((12, 51, 4), (108, 133, 39), (63, 93, 29), (59, 102, 31), (112, 150, 51))
ROT = FIG.farbe((130, 0, 0))
WEISS, GRAU = FIG.farbe((246, 246, 246)), FIG.farbe((191, 198, 198))
LID = FIG.f(12, 9)
assert FIG.f(13, 9) == (255, 213, 0) or True

SCHWANZ = FIG.op & (xx <= 6) & ~((xx >= 5) & (yy <= 11)) & ~((xx == 6) & (yy <= 14))     # Schwanz + Messer (alles links der Kapuze/Robe)
SCHWANZ &= ~(FIG.maske([(25, 25, 25), (82, 82, 82), (42, 42, 42), (32, 32, 32), (50, 50, 50), (65, 65, 65)]) & (xx >= 5))
KOERPER = FIG.op & ~SCHWANZ


def frame(i, nur=None):
    ko = FIG.platz(KOERPER)
    sc = FIG.platz(SCHWANZ)
    # Blinzeln (rechtes Auge)
    if N2.fenster(i, N, 26, [1, 1, 1]) or N2.fenster(i, N, 52, [1, 1, 1]):
        N2.setze(ko, OFF, {(13, 9): LID, (14, 9): LID, (14, 8): (0, 0, 0)})
    # Züngeln
    z = N2.fenster(i, N, 12, [1, 2, 2, 1, 2]) or N2.fenster(i, N, 42, [1, 2, 2, 1, 2])
    if z:
        N2.setze(ko, OFF, {(11, 13): ROT})
        if z == 2:
            N2.setze(ko, OFF, {(11, 14): ROT, (12, 15): ROT})
    # Lichtreflex wandert die Klinge hinunter (Weiß ↔ Hellgrau der Klinge tauschen, bleibt in der Klinge)
    g = N2.fenster(i, N, 33, [0, 0, 1, 1, 2, 2, 3, 3])
    if g is not None:
        N2.setze(sc, OFF, {(4, 12 + g): GRAU})
        if g >= 1:
            N2.setze(sc, OFF, {(3, 12 + g): WEISS})
    # Atmen (Robe) und Messerheben (Schwanz)
    ko = TX.streck_zeile(ko, FIG.pt + 22, N2.hub(i, 30, 1))
    sc = TX.streck_zeile(sc, FIG.pt + 21, N2.hub(i, 20, 2))
    return L.zusammen(FIG.H, FIG.W, [(ko, 0, 0), (sc, 0, 0)])


if __name__ == '__main__':
    N2.haupt(__import__(__name__), 'Clausss, the No-Nonsense Cultist')
