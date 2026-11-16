# -*- coding: utf-8 -*-
"""Idle-Animation für „Doctor Fester“ (Creature) — der unheimliche Arzt im weißen Kittel mit dem aufgerissenen, blutunterlaufenen Auge und der erhobenen Hand.

Quelle: src/doctor-fester.png (25×26 px, 45 Farben) = Arzt + Kind zusammengesetzt; einzeln: src/doctor-fester_arzt.png (nur Ebene 379, vollständig) und src/doctor-fester_kind.png (nur Ebene 378).
PICK: [["MotiveGrailWar", 379, 1], ["MotiveGrailWar", 378, 1]] — Ebene „Doctor Fester #7“ (Arzt, komplett) und davor „Doctor Fester #10“: das rothaarige Kind, das er im ausgestreckten
      rechten Arm hält (Runde 8, Nutzerwunsch: „Es fehlt der ausgestreckte Arm mit dem Kind darin“). Lage wie in der Motiv-Datei (Kind 11 px rechts, 5 px höher als der Arzt), Kind VOR dem Arzt –
      so zeigt es auch Doctor_Fester.png. Blutspritzer (368, 375, 376), Wanne und Tisch sind Szenenteile, nicht übernommen.

Was im Sprite ist (x, y im 25×26-Sprite):
* ARZT (x 0–15, y 5–25): KOPF (y 5–14) graubraunes Haar/Haube, schwarze Strähnen über dem linken Auge (5–8, 8–9); RECHTES AUGE (11–12, 10–11) weit aufgerissen, weiß mit roter Pupille (12,10);
  Gesicht fahl, MUND rot (9–10,13)/(9,14), weißer Streifen (10,14)–(10,15) nicht sicher deutbar → fest. LINKER ARM erhoben: Ärmel (x 4–6, y 14–17), HAND (x 0–3, y 14–19).
  KITTEL grau/weiß (y 14–23), SCHUHE orange-rot (y 24–25).
* KIND (x 11–24, y 0–19): rotes Haar (y 0–9), blaugraues Gesicht mit zwei Blutbahnen aus den Augen (y 6–10), blaues Kleid (y 10–16), Füße (y 17–19), Blutstropfen rechts (x 23, y 12–16).
* AUSGESTRECKTER ARM des Arztes: der weiß/hellblaue Ärmel quer über der Brust des Kindes ((14,11) … (22,13)), Hand (22,12). Liegt in der Kind-Ebene, bewegt sich deshalb starr mit dem Kind.
Kein Metall → kein Glanz; keine Partikel.

Ablauf (48 Frames à 75 ms = 3,6 s, nahtlos); Idee: der irre Doktor — das Auge rollt, die Finger zucken, zwischendurch schüttelt ihn ein Kichern; das Kind wippt im Arm.
* Augenrollen: die rote Pupille wandert innerhalb der vier Augenpixel im Kreis ((12,10) → (11,10) → (11,11) → (12,11) → zurück; Frames 10–21), später noch ein kurzer Seitenblick (32–35).
  Nur die vier Augenpixel, nur deren zwei Quellfarben.
* Atmen/Kichern: Kittelzeile 18 wird einmal texturiert eingefügt (TX; nur Arzt-Ebene) — ein langsamer Atemzug (Frames 6–17), dann drei schnelle Kicher-Stöße (Frames 30–41, je 2 Frames
  oben/unten). Kopf, Hand und der Arm mit dem Kind heben sich mit, die Schuhe bleiben stehen.
* Fingerzucken: die erhobene Hand (x ≤ 3, starr) zuckt zweimal 1 px nach oben (Frames 8–9 und 12–13).
* Arm mit Kind wippt (starr, Arm + Kind als Einheit): sackt zweimal je 5 Frames 1 px ab (Frames 2–6 und 22–26) und kommt wieder hoch; darunter ist der Arzt vollständig (eigene Ebene), keine Lücke.
Frame 0 = Original. Kopf nur senkrecht. Ergänzungen: keine.
"""
import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_n5 as G
import anim_textur as TX
TX.umleiten()

N, MS = 48, 75
F = G.Figur('doctor-fester', (2, 2, 3, 2))
ARZT, KIND = L.lade('doctor-fester_arzt'), L.lade('doctor-fester_kind')
spr = F.spr
hand = F.box(0, 14, 3, 19)
rumpf = L.deckend(ARZT) & ~hand
kind = L.deckend(KIND)
WEISS, ROT = F.f(11, 10), F.f(12, 10)
HUB = [0] * 6 + [1] * 12 + [0] * 12 + [1, 1, 0, 0] * 3 + [0] * 6
PUPILLE = {**{i: (11, 10) for i in range(10, 14)}, **{i: (11, 11) for i in range(14, 18)}, **{i: (12, 11) for i in range(18, 22)}, **{i: (11, 10) for i in range(32, 36)}}
ZUCK = (8, 9, 12, 13)
WIPP = (2, 3, 4, 5, 6, 22, 23, 24, 25, 26)


def frame(i):
    k = F.ebene(rumpf, quelle=ARZT)
    if i in PUPILLE:
        F.setze(k, {(12, 10): WEISS, PUPILLE[i]: ROT})
    k = F.streck(k, 18, HUB[i])
    h = F.ebene(hand, 0, -HUB[i] - (1 if i in ZUCK else 0), quelle=ARZT)
    kd = F.ebene(kind, 0, -HUB[i] + (1 if i in WIPP else 0), quelle=KIND)
    return G.ueber(G.ueber(k, h), kd)


if __name__ == '__main__':
    G.abschluss(F, 'Doctor Fester', [frame(i) for i in range(N)], MS)
