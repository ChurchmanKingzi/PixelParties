# -*- coding: utf-8 -*-
"""Idle-Animation für „Informant“ (Creature) — der Mann im schwarzen Mantel mit der grauen Schiebermütze, der am Lagerfeuer Neuigkeiten zuflüstert.

Quelle: src/informant.png (16×25 px, 22 Farben).
PICK: [["Motive", 901, 2]]     (Ebene „Informant“, Figur 2 = der Mann im schwarzen Mantel, 92 % Treffer (Rest: Feuerschein der Kunst). Dieselbe Ebene enthält als Figur 1 den grünhaarigen Jungen und als
  Figur 3 die Blonde mit dem roten Auge – das sind die Zuhörer am Feuer (dieselben Figuren wie bei Chatty Town Guard); Ebene 918 „Sid #2“ ist das Lagerfeuer = Kulisse. Gewählt wurde der Mann im
  dunklen Mantel als der Informant; Quelle vollständig, nichts verdeckt.)

Aufruf:   python3 informant.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/informant.png + .json

Was im Sprite ist (x, y im 16×25-Sprite):
* MÜTZE (y 0–6): graue Schiebermütze (106…189) mit schwarzem Umriss, dunkler Schirm (y 5–6). Stoff → kein Glanz.
* GESICHT (y 7–11): Ohren (4, 7–8)/(13, 7–8), schwarze Brauen (6–7,8)/(10–11,8); AUGEN in y 9: braune Iris (148,65,24) bei x 6 und x 10, Augenweiß (246,255,255) bei x 7 und x 11 – er schielt zur Seite
  (nach links im Bild); dunkelroter offener MUND (8–9, 11).
* MANTEL (y 11–22): schwarz (16…72) mit hochgeschlagenem Kragen (y 11–13), Arme anliegend (x 0–2 / 13–15, y 14–19), senkrechte Falten (y 17–19). SCHUHE y 23–24.
Kein Metall → kein Glanz. Keine Partikel.

Idee: Der Informant FLÜSTERT – der Mund geht in zwei Schüben auf und zu, dazwischen huscht sein Blick zur anderen Seite (ob jemand mithört) und wieder zurück.
Ablauf (60 Frames à 70 ms = 4,2 s, nahtlos):
* Flüstern (Frames 2–19 und 32–49): Mund offen (Original) → halb ((8,11) Haut) → zu (beide Haut (213,164,98)) im unregelmäßigen Sprechmuster; außerhalb der Schübe geschlossen (Frame 0/1 offen = Original).
* Blick (Frames 22–29 und 52–57): Iris und Augenweiß tauschen in beiden Augen die Plätze (er schaut nach rechts), sonst Original (nach links). Der Kopf bewegt sich nicht.
* Blinzeln (Frames 20–21 und 50–51, jeweils direkt vor dem Blickwechsel): Augenpixel → Haut (213,164,98).
* Atmen (Periode 30): Mantelzeile 19 wird einmal texturiert eingefügt (anim_textur; die Faltenzeilen 17–19 sind schon im Original gleich) – Oberkörper, Arme und Kopf steigen 1 px, Schuhe bleiben.
Frame 0 = Original. Ergänzungen: keine.
"""
import sys

import anim_humanoide as Hm
import anim_lib as L
import anim_n4 as N4
import anim_textur as TX
TX.umleiten()

N, MS = 60, 70
G = N4.Figur('informant', 2, 2, 3, 2)
spr, H, W, OFF = G.spr, G.H, G.W, G.OFF
f = G.f
HAUT, IRIS, WEISS, MUND_D, MUND_H = f(7, 11), f(6, 9), f(7, 9), f(8, 11), f(9, 11)
MAUL = [0, 0, 1, 2, 1, 0, 0, 1, 2, 2, 1, 0, 1, 2, 1, 0, 0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]      # 30 Frames, 2× je Schleife: 0 offen, 1 halb, 2 zu
SCHWARZ = (0, 0, 0)


def frame(i):
    k = G.ebene()
    st = MAUL[i % 30]
    if st == 1:
        Hm.setze(k, {(8, 11): HAUT}, OFF)
    elif st == 2:
        Hm.setze(k, {(8, 11): HAUT, (9, 11): HAUT}, OFF)
    if Hm.takt(i, 30, 22, 8 if i < 30 else 6):
        Hm.setze(k, {(6, 9): WEISS, (7, 9): IRIS, (10, 9): WEISS, (11, 9): IRIS}, OFF)
    if Hm.takt(i, 30, 20, 2):
        Hm.setze(k, {(x, 9): HAUT for x in (6, 7, 10, 11)}, OFF)
    if Hm.stufe(i, N / 2, 1):
        k = TX.streck_zeile(k, G.PT + 19, 1)
    return G.schliessen(k, lambda x, y: SCHWARZ)


if __name__ == '__main__':
    N4.abschluss(G, 'Informant', [frame(i) for i in range(N)], MS, sys.argv)
