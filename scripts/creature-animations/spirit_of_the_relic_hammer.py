# -*- coding: utf-8 -*-
"""Idle-Animation für „Spirit of the Relic Hammer“ (Creature).

PICK: [["MotiveGrailWar", 602, 1]]
Quelle: src/spirit-of-the-relic-hammer.png (40×35 px, 33 Farben) = Ebene 602 „Trident Hammer Absorbed“, Figur 1 (die Ebene enthält daneben Figur 2 = den Dreizack-Geist mit Hammerbeinen der Karte
„Trident Spirit - Hammer Absorbed“; nicht Teil dieser Creature). Identisch in MotiveDeri 207. Gegen die Kartenkunst abgeglichen (Fass, Truhe, Pflaster sind Szene).

Was ist was (x/y im Sprite):
* Drei Reliktenhämmer aus hellem Stahl (Grau (78,80,77) Umriss, (154,155,152), (209,211,208)), jeder mit türkisem Edelstein in der Mitte des Kopfes:
  links (Kopf x 0–12, y 6–14, Stein x 4–8, y 8–12; brauner Stiel schräg nach unten x 6–11, y 13–24), rechts gespiegelt (x 27–39), der dritte sitzt als Helm auf dem Kopf der Figur
  (Kopf x 14–25, y 7–14, Stiel senkrecht nach oben x 19–20, y 0–9, Stein x 18–21, y 10–13).
* Figur darunter: Gesicht im Hammerhelm (x 16–22, y 11–16; winzig, Augen nicht sicher erkennbar → kein Blinzeln), türkis-weiße Rüstung (y 15–21) mit waagerecht ausgestreckten gepanzerten Armen
  (x 8–31, y 18–21), deren Fäuste die beiden Stiele umfassen; orange Hose (y 22–31), braune Stiefel (y 32–34).
Starr: alle drei Hämmer (Kopf + Stiel), sie gehen nur als Einheit mit dem Oberkörper/den Fäusten mit.

Ablauf (60 Frames à 80 ms = 4,8 s, nahtlos, schwer und langsam; Frame 0 = Original):
* Schweres Wippen unter der Last: Hosenzeile 27 wird texturiert eingefügt (0–1 px, Periode 30) – Oberkörper, Arme, Kopf und alle drei Hämmer heben sich starr als Einheit, Stiefel bleiben am Boden.
* Die beiden seitlichen Hämmer wiegen gegenläufig: jeder gleitet als starre Einheit (Kopf + ganzer Stiel) 1 px auf und ab durch die Faust (Periode 30, links/rechts entgegengesetzt);
  die Fäuste und Arme bleiben, nichts wird gestreckt.
* Stahlglanz (Metall): ein diagonales Lichtband wandert nacheinander über den linken, den mittleren und den rechten Hammerkopf (je 10 Frames, Start 2/22/42; eine Stufe heller, Umriss bleibt).
* Edelsteine (Regel 12c): pulsieren nacheinander eine Stufe heller (je 4 Frames, unmittelbar nach dem Lichtband ihres Hammers), der Stein des Helms zusätzlich in der Schleifenmitte.
* Kurzer Sparkle (3 Frames) an einer Ecke des linken (Frame 14) und des rechten Hammerkopfs (Frame 54).
ERGÄNZUNG: die hinter den Armen verdeckten Stielstücke (y 18–21; links x 8–11, rechts gespiegelt) in den zwei Holzfarben der Stiele, damit beim Heben/Senken keine Lücke zwischen Stiel und Faust entsteht. Nur ganze Pixel, nur Farben der Quelle.
"""
import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_n2 as N2
import anim_textur as TX
TX.umleiten()

N, MS = 60, 80
FIG = N2.Figur('spirit-of-the-relic-hammer', pad=(2, 2, 3, 2))
spr = FIG.spr
xx, yy = FIG.xx, FIG.yy
OFF = FIG.off

STAHL = FIG.farbe((78, 80, 77), (154, 155, 152), (209, 211, 208), (242, 255, 255))
STEIN = FIG.farbe((37, 130, 125), (0, 175, 176), (178, 246, 255), (242, 255, 255))
WEISS = STAHL[3]
INNEN = FIG.maske(STAHL[:3]) & ~Hm.kantenmaske(spr) & (yy >= 6) & (yy <= 14)
KOEPFE = [INNEN & (xx <= 12), INNEN & (xx >= 14) & (xx <= 25), INNEN & (xx >= 27)]
STEINE = [FIG.maske(STEIN[:3]) & (yy >= 8) & (yy <= 13) & m for m in ((xx <= 12), (xx >= 17) & (xx <= 22), (xx >= 27))]


def _hammer(spiegel):
    sx = (lambda x: 39 - x) if spiegel else (lambda x: x)
    m = np.zeros((FIG.sh, FIG.sw), bool)
    for y in range(FIG.sh):
        for x in range(FIG.sw):
            if (x <= 12 and y <= 14) or (x <= 11 and y == 15) or (x <= 9 and 16 <= y <= 17) or (10 <= x <= 11 and 22 <= y <= 24):
                m[y, sx(x)] = True
    return m & FIG.op


HAMMER_L, HAMMER_R = _hammer(False), _hammer(True)
KOERPER = FIG.op & ~HAMMER_L & ~HAMMER_R
HOLZ = (FIG.f(10, 22), FIG.f(11, 22))
VERDECKT_L = {(8, 18): HOLZ[0], (9, 18): HOLZ[1], (8, 19): HOLZ[0], (9, 19): HOLZ[1], (9, 20): HOLZ[0], (10, 20): HOLZ[1], (10, 21): HOLZ[0], (11, 21): HOLZ[1]}
VERDECKT_R = {(39 - x - (1 if c == HOLZ[0] else -1), y): c for (x, y), c in VERDECKT_L.items()}
PL, PT = FIG.pl, FIG.pt
ML = L.platz(np.dstack([HAMMER_L] * 4).astype(np.uint8) * 255, FIG.H, FIG.W, PL, PT)[..., 3] > 0
MR = L.platz(np.dstack([HAMMER_R] * 4).astype(np.uint8) * 255, FIG.H, FIG.W, PL, PT)[..., 3] > 0


def frame(i, nur=None):
    a = FIG.platz()
    for k, start in enumerate((2, 22, 42)):
        Hm.lichtband(a, KOEPFE[k], OFF, i, N, start, 10, STAHL, stufen=1, breite=3.0, achse=(1.0, 1.0))
        if N2.fenster(i, N, start + 10, [1, 1, 1, 1]) or (k == 1 and N2.fenster(i, N, 52, [1, 1, 1, 1])):
            for y, x in zip(*np.nonzero(STEINE[k])):
                N2.setze(a, OFF, {(int(x), int(y)): Hm.farbe_stufe(FIG.f(int(x), int(y)), STEIN, 1)})
    hl, rest = L.trenne(a, ML & (a[..., 3] > 0))
    hr, ko = L.trenne(rest, MR & (rest[..., 3] > 0))
    N2.setze(hl, OFF, VERDECKT_L, neu=True)
    N2.setze(hr, OFF, VERDECKT_R, neu=True)
    N2.funke(hl, OFF, 1, 7, N2.fenster(i, N, 14, [0, 1, 0]), WEISS, STAHL[2])
    N2.funke(hr, OFF, 38, 7, N2.fenster(i, N, 54, [0, 1, 0]), WEISS, STAHL[2])
    d = N2.schwing(i, 30, 1)
    fig = L.zusammen(FIG.H, FIG.W, [(hl, 0, d), (hr, 0, -d), (ko, 0, 0)])
    return TX.streck_zeile(fig, FIG.pt + 27, N2.hub(i, 30, 1, versatz=4))


if __name__ == '__main__':
    N2.haupt(__import__(__name__), 'Spirit of the Relic Hammer')
