# -*- coding: utf-8 -*-
"""Idle-Animation für „Front Soldier“ (Creature) — der grau gepanzerte Soldat mit Topfhelm, der die Hand zum Gruß an den Helm hält.

Quelle: src/front-soldier.png (19×24 px, 12 Graustufen).
PICK: kein eigener Ebenen-Treffer (der xcf-Abgleich fand nur die Kisten der Kulisse). Der Soldat ist in die Szenen-Ebenen „Sichtbar #23“/„Sichtbar #22“ (MotiveDeri 129/130, Bildschirmfotos des
      Lagerplatzes) eingebacken und wurde von dort per Farbmaske herausgelöst (graue Pixel |R−G|,|G−B| ≤ 8 = Figur, brauner Sandboden = Hintergrund; größter zusammenhängender Fleck im Fenster
      x 294–319, y 152–179 der Ebene 129; Ursprung des Sprites (297,154)). Abgleich mit der Kartenkunst Front_Soldier.png: Gesichtsausschnitt deckt sich (Abweichung 5/255). Die Figur steht frei
      auf dem Sand, nichts ist verdeckt → Quelle vollständig. Die beiden angeschnittenen Köpfe am unteren Kartenrand sind andere Figuren.

Aufruf:   python3 front_soldier.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/front-soldier.png + .json

Was im Sprite ist (x, y im 19×24-Sprite):
* HELM (x 5–12, y 0–8): Topfhelm mit Kamm (8–11, 0), Sehschlitze (dunkle Spalten x 8 und x 10, y 5–7) und hellem Nasensteg (9, 4–8). Kein Gesicht sichtbar → kein Blinzeln.
* GRUSSARM (x 11–18, y 3–12): rechter Arm (vom Betrachter aus) angewinkelt, Hand am Helmrand (12–15, 3–5), Ellbogen außen (17–18, 8–11), Schulterplatte (14–17, 10–12). Bleibt starr in der Grußhaltung.
* LINKER ARM (x 0–5, y 9–18): hängt, Schulterplatte (2–5, 10–12), Panzerhandschuh (1–3, 15–16).
* BRUSTPANZER (x 6–13, y 9–16) mit heller Platte (7–10, 11–14), Gürtel y 15–16; BEINE y 17–19, STIEFEL (x 4–8 und x 10–15, y 19–23) mit heller Kappe (6–8 / 11–13, 21).
Alles ist Metall (Rüstung) → ein kurzes Lichtband über den Helm und ein kurzer Sparkle am Handschuh sind erlaubt (Regel 12/14/34).

Idee: Der Frontsoldat steht im Gruß stramm und TRITT AUF DER STELLE (Marschieren am Platz): die Stiefel heben sich abwechselnd, der Oberkörper federt mit.
Ablauf (64 Frames à 70 ms = 4,5 s, nahtlos):
* Auf der Stelle treten (Periode 16): linker Stiefel (x ≤ 8, y 19–23) 1 px hoch in den Frames 2–5, rechter (x ≥ 10) in den Frames 10–13 jedes Takts; die Stiefel liegen als starre Einheit vor dem Bein.
* Federn/Atmen (Periode 32): Panzerzeile 16 (Gürtel-Unterkante) wird einmal texturiert eingefügt (anim_textur) – Brust, Grußarm und Helm steigen 1 px als Ganzes, Beine und Stiefel bleiben;
  der hängende linke Unterarm mit dem Panzerhandschuh (x ≤ 4, y ≥ 13) geht als starre Einheit 1 px mit hoch (wird nicht gestreckt).
* Lichtband (Frames 20–27): wandert diagonal über den Helm (eine Graustufe heller auf der Rampe der Quelle). Sparkle am Handschuh (1,15) in den Frames 44–46 (Mitte → Kreuz → Mitte).
Frame 0 = Original. Ergänzungen: keine (beim Stiefelheben wird nichts freigelegt: der Stiefel schiebt sich über das Bein, darunter ist Boden).
"""
import sys

import anim_humanoide as Hm
import anim_lib as L
import anim_n4 as N4
import anim_textur as TX
TX.umleiten()

N, MS = 64, 70
G = N4.Figur('front-soldier', 2, 2, 3, 2)
spr, H, W, OFF = G.spr, G.H, G.W, G.OFF
f = G.f
RAMPE = [(v, v, v) for v in (0, 24, 32, 41, 65, 82, 106, 123, 156, 189, 213, 246)]
SCHWARZ = (0, 0, 0)
fuss_l = G.da & (G.xx <= 8) & (G.yy >= 19)
fuss_r = G.da & (G.xx >= 10) & (G.yy >= 19)
arm_l = G.da & (G.xx <= 4) & (G.yy >= 13)            # hängender Unterarm + Panzerhandschuh: starr, wird nie gestreckt
rumpf = G.da & ~fuss_l & ~fuss_r & ~arm_l
helm = G.da & (G.xx >= 5) & (G.xx <= 12) & (G.yy <= 8)


def frame(i):
    k = G.ebene(rumpf)
    Hm.lichtband(k, helm, OFF, i, N, 20, 8, RAMPE, stufen=1, breite=2.4)
    hub = Hm.stufe(i, N / 2, 1)
    if hub:
        k = TX.streck_zeile(k, G.PT + 16, 1)
    arm = G.ebene(arm_l, 0, -hub)
    N4.funkeln(arm, 1, 15 - hub, Hm.folge(i, 44, [0, 1, 2], N), RAMPE[-1], RAMPE[-2], OFF)
    t = i % 16
    fl = G.ebene(fuss_l, 0, -1 if 2 <= t <= 5 else 0)
    fr = G.ebene(fuss_r, 0, -1 if 10 <= t <= 13 else 0)
    fig = L.zusammen(H, W, [(k, 0, 0), (arm, 0, 0), (fl, 0, 0), (fr, 0, 0)])
    return G.schliessen(fig, lambda x, y: SCHWARZ)


if __name__ == '__main__':
    N4.abschluss(G, 'Front Soldier', [frame(i) for i in range(N)], MS, sys.argv)
