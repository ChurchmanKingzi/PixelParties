# -*- coding: utf-8 -*-
"""Idle-Animation für „Mimic“ (Creature) — die lebendige Truhe: zwei Glubschaugen oben auf dem Deckel, graues Schloss, orange Beschläge und ein großes rotes Maul voller Zähne.

Quelle: src/mimic.png (16×24 px, 33 Farben).
PICK: [["Motive", 932, 1]]     (Ebene „Mimic“, Figur 1; 95 % Treffer – die Kartenkunst ist leicht getönt; einziger Treffer, vollständig.)

Aufruf:   python3 mimic.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/mimic.png + .json

Was im Sprite ist (x, y im 16×24-Sprite):
* AUGEN (x 1–7 und x 8–14, y 0–3): zwei Höcker auf dem Deckel, Augenweiß (197,197,197)/(255,255,255), schwarze Pupillen unten rechts ((4–6,2) und (11–13,2)).
* DECKEL (y 4–10): dunkel, in der Mitte das graue SCHLOSS (x 4–11, y 6–10), orange Beschläge (1–3,7)/(12–14,7), braune Kanten (y 9–12).
* MAUL (x 2–13, y 10–18): schwarz gerahmt; OBERE ZÄHNE hängen in y 11–12 (x 3, 5, 9, 11; hell), dazwischen Rot (103,0,0); RACHEN dunkelrot (69,0,0) in y 13–14, (103,0,0) in y 15; UNTERE ZAHNREIHE y 16–17
  (hell (183…215) im Wechsel mit Rot (208,0,0)).
* KASTEN (y 18–23): braune Leiste y 19, orange Beschläge (2–3 / 12–13, y 20–22), schwarz.
Glanz: keiner (Zähne/Beschläge werden nicht als blankes Metall gelesen). Keine Partikel.

Idee: Der Mimic SCHNAPPT – das Maul reißt auf, klappt zweimal zu (der Deckel fällt bis Zahn auf Zahn), dann stellt er sich TOT: Maul zu, Augen zu = harmlose Truhe … und lugt wieder hervor.
Ablauf (64 Frames à 70 ms = 4,5 s, nahtlos):
* Maul (Deckel als Ganzes über dem Rachen): Stufe +1/+2 = Rachenzeile 14 wird 1–2× eingefügt (die Rachenzeilen 13/14 sind schon im Original einfarbig gleich; die Zahnzeilen bleiben unberührt) → Deckel samt Augen und oberen Zähnen hebt sich;
  Stufe −1…−3 = die Rachenzeilen 14, 13, 15 werden entfernt (L.streck_zeile n < 0) → Deckel senkt sich, bei −3 liegen die oberen Zähne auf der unteren Zahnreihe. Der Kasten bleibt am Boden stehen.
  Frames 4–9 aufreißen (+1, +2), 10–13 zuschnappen (0, −2, −3, −3), 14–15 wieder auf (−1, +1), 16–19 zweiter Biss (−3 …), 20–21 zurück zur Ruhe; Frames 36–55 „Truhe spielen“: langsam schließen (−1, −2, −3),
  12 Frames geschlossen halten, wieder öffnen.
* Augen: Blick nach links (Pupillen nach (2–4,2) bzw. (9–11,2)) in den Frames 24–31; beim Truhe-Spielen (Frames 40–51) sind die Augen geschlossen (Augenfläche in Deckelgrau (38,38,38)), in den
  Frames 52–53 lugt er mit Blick nach links hervor.
Frame 0 = Original. Ergänzungen: keine.
"""
import sys

import anim_humanoide as Hm
import anim_lib as L
import anim_n4 as N4
import anim_textur as TX
TX.umleiten()

N, MS = 64, 70
G = N4.Figur('mimic', 2, 2, 4, 2)
spr, H, W, OFF = G.spr, G.H, G.W, G.OFF
f = G.f
WEISS, PUP, LID, UMRISS = f(2, 2), f(4, 2), f(1, 6), f(0, 5)
MAUL = {4: 1, 5: 1, 6: 2, 7: 2, 8: 2, 9: 2, 10: 0, 11: -2, 12: -3, 13: -3, 14: -1, 15: 1, 16: -3, 17: -3, 18: -3, 19: -1,
        36: -1, 37: -1, 38: -2, 39: -2, **{i: -3 for i in range(40, 52)}, 52: -2, 53: -2, 54: -1, 55: -1}
AUGEN_FLAECHE = [(x, y) for y in (1, 2) for x in (2, 3, 4, 5, 6, 9, 10, 11, 12, 13)]


def frame(i):
    k = G.ebene()
    if Hm.takt(i, N, 24, 8) or Hm.takt(i, N, 52, 2):
        Hm.setze(k, {(2, 2): PUP, (3, 2): PUP, (5, 2): WEISS, (6, 2): WEISS, (9, 2): PUP, (10, 2): PUP, (12, 2): WEISS, (13, 2): WEISS}, OFF)
    if Hm.takt(i, N, 40, 12):
        Hm.setze(k, {p: LID for p in AUGEN_FLAECHE}, OFF)
    m = MAUL.get(i, 0)
    if m > 0:
        k = TX._L_STRECK_ZEILE(k, G.PT + 14, m)                 # Rachenzeilen 13/14 sind im Original einfarbig gleich → Fortsetzung des Rachens, keine Zahnpixel einmischen
    elif m < 0:
        k = L.streck_zeile(k, G.PT + 14, -1)                      # Zeile 14 weg
        if m <= -2:
            k = L.streck_zeile(k, G.PT + 14, -1)                  # dann die frühere Zeile 13 (liegt jetzt in 14)
        if m <= -3:
            k = L.streck_zeile(k, G.PT + 15, -1)                  # Zeile 15 (liegt weiter in 15)
    return G.schliessen(k, lambda x, y: UMRISS)


if __name__ == '__main__':
    N4.abschluss(G, 'Mimic', [frame(i) for i in range(N)], MS, sys.argv)
