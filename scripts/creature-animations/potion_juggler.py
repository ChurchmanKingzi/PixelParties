# -*- coding: utf-8 -*-
"""Idle-Animation für „Potion Juggler“ (Creature) — der Clown mit dem blauen Hut und den grünen Ärmeln, der mit erhobenen Händen DREI TRÄNKE (rot, gelb, blau) jongliert.

Quelle: src/potion-juggler.png (32×40 px, 47 Farben) = Clown + die drei Tränke an ihren Plätzen in der Ebene; einzeln: src/potion-juggler-clown.png (gleiche Leinwand, nur der Clown) und
        src/potion-juggler-trank0.png (rot), -trank1.png (gelb), -trank2.png (blau), je 10×12 px.
PICK: [["MotiveCoolhalla", 62, 1], ["MotiveCoolhalla", 61, 1], ["MotiveCoolhalla", 61, 2], ["MotiveCoolhalla", 61, 3]]
  (Ebene 62 „Ebene #163“ = der Clown mit erhobenen Armen, 20×24; Ebene 61 „Ebene #165“ = die drei SCHARFEN Tränke im Dreieck über ihm. In der Kartenkunst liegt darüber Ebene 60 „Ebene #166“: dieselben
  Tränke als verwischte Bewegungsunschärfe – das ist ein weicher Effekt und wird nicht übernommen (Pixelart-Regel); stattdessen fliegen die scharfen Tränke wirklich. Ebene 58 „Ebene #168“ ist derselbe
  Clown mit hängenden Armen und Sonnenbrille, 57/56 sind leere Flaschen und Pfützen (ein anderer Zustand) – nicht verwendet. Der xcf-Abgleich kannte nur Ebene 62 (78 %, weil die Unschärfe die Arme
  überdeckt) und einen Fetzen der Unschärfe.)

Aufruf:   python3 potion_juggler.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/potion-juggler.png + .json

Was im Sprite ist (x, y im 32×40-Sprite):
* CLOWN (x 6–25, y 16–39): blauer Hut mit weißen Bommeln (y 16–21), orange Haare, schwarze Augenmaske/Brille (y 23–24) → blinzelt nicht (Regel 10/21), rote Nase, roter Mund (15–16, 26), rosa Wangen;
  grüne Ärmel schräg nach oben (x 7–12 und 19–24, y 27–31), weiße Handschuhe (7–9 / 22–24, y 25–27); Latzhose halb rot, halb blau (y 30–37), gelbe Schuhe (y 38–39).
* TRÄNKE (je 10×12): bauchige Flasche mit schwarzem Umriss, Korken (orange/gelb), hellem Hals; rot oben in der Mitte (11,0), gelb links (0,10), blau rechts (22,10).
Glas/Flüssigkeit, kein Metall → kein Glanz. Keine Partikel.

Idee: Er JONGLIERT wirklich – echte 3-Ball-Kaskade: jede Flasche fliegt im Bogen von einer Hand über den Scheitelpunkt zur anderen, wird dort kurz gefangen (taucht 3 px in die Hand) und wieder geworfen.
Ablauf (60 Frames à 70 ms = 4,2 s, nahtlos; 1 Schlag = 5 Frames, jede Flasche braucht 6 Schläge für Hin- und Rückweg, die Schleife enthält zwei volle Umläufe):
* Flugbahn je Flasche (starr, nur ganze Pixel, keine Drehung): Schlag 0–2 Wurf links → rechts (Parabel über den Scheitel y 0), Schlag 2–3 in der rechten Hand (Eintauchen 3 px und zurück), Schlag 3–5 Wurf
  rechts → links, Schlag 5–6 in der linken Hand. Die Bahnen der beiden Wurfrichtungen sind waagerecht gegeneinander versetzt (bis ±3 px), so kreuzen sich steigende und fallende Flasche nebeneinander.
  Die drei Flaschen sind um je 2 Schläge versetzt: in Frame 0 steht gelb links (eben geworfen), rot im Scheitel, blau rechts (eben gefangen) = Original.
* Clown: federt im Wurftakt (Periode 10): Hosenzeile 34 wird einmal texturiert eingefügt (anim_textur) – Oberkörper, Arme, Hände und Kopf steigen 1 px, Schuhe bleiben. Der Kopf bewegt sich nicht seitlich.
* Mund: der rote Mund (15–16, 26) schließt sich kurz (Frames 22–25 und 52–55 → Hautweiß wie daneben) – er pustet vor Anstrengung.
Frame 0 = Original. Ergänzungen: keine (der Clown ist als eigene Ebene vollständig; die Flaschen fliegen vor freiem Hintergrund bzw. vor dem Hut).

RUNDE 8 (Nutzer: „Die Potions bleiben etwas zu lange in der Mitte in der Luft hängen, das wirkt unnatürlich“): schnellerer Takt mit echtem Schwerkraft-Timing. 1 Schlag = 3 Frames (vorher 5), ein Wurf dauert
6 Frames (vorher 10) auf derselben Parabel: Höhe je Frame 10 → 4 → 1 → 0 → 1 → 4 → (Hand) – schnell unten, genau EIN Frame am Scheitel, kein Plateau (vorher standen die Flaschen 3 Frames auf Scheitelhöhe).
Außerdem war der seitliche Bahnversatz der beiden Wurfrichtungen (0,15 · sin) so groß, dass die Flasche am Scheitel waagerecht fast stehen blieb (Schritte 7, 3, 1, 1, 3, 7 px) – das war das eigentliche „Hängen“.
Er ist jetzt 0,05 (höchstens ±1 px): die Flasche fliegt waagerecht praktisch gleichförmig (5, 3, 3, 3, 3, 5 px je Frame).
RUNDE 9 (Nutzer: „Sollte noch die Arme beim Jonglieren bewegen“): Beide Arme sind jetzt Posen im Wurftakt (`arm_pose`, ARM_TAKT, Periode 6 = ein Wurf je Hand): trifft die Flasche die Hand, gibt die
Hand 1 px nach unten nach (2 Frames, während die Flasche eintaucht), schnellt zum Abwurf zurück in die Ruhelage und schwingt 1 px nach oben nach, dann Ruhe bis zum nächsten Fang. Linke und rechte Hand
laufen um einen halben Takt versetzt (wie die Flaschen). Bewegt wird Hand + äußerer Ärmel (Spalten 7–9 bzw. 22–24) als starre Einheit, die Schulter bleibt; nichts wird gestreckt oder dicker.
Fertiggezeichnet: Hand unten → Haarumriss (9,25)/(22,25) in (140,34,10), Handschuhrand (10,28)/(21,28) grau; Hand oben → Ärmelkante (9,30)/(22,30) bleibt, Handschuhrand (10,25)/(21,25) grau,
(10,27)/(21,27) Ärmelgrün. Flaschenbahnen, Federn, Mund unverändert.
Schleife jetzt 54 Frames à 70 ms = 3,8 s (drei volle Umläufe à 18 Frames). In der Hand: 3 Frames (taucht 3 px ein). Federn des Clowns im Wurftakt (Periode 6), Mund schließt in den Frames 20–23 und 47–50.
RUNDE 10 (Nutzer: „Soll beim Jonglieren auch mit den Händen tatsächlich die Potions berühren, wenn diese wieder hochgeworfen werden!“): Bisher endeten die Bahnen an den Originalplätzen der Tränke
(0,10)/(22,10) – 3 px ÜBER und 4 px NEBEN den Handschuhen (x 7–10, y 25–27), die Flasche berührte die Hand nie. Jetzt liegen Fang- und Abwurfpunkt genau auf der Hand: Flasche bei (1,14) links bzw.
(21,14) rechts, ihr Boden (Zeile y 25) sitzt auf der Oberkante des Handschuhs, der Handschuh wird VOR den Flaschenboden gezeichnet (er umfasst die Ecke des Bodens). Bahn je Flasche (18 Frames, `BAHN`):
Abwurf aus der linken Hand (u 0) → 5 Flugbilder (Höhe 6, 2, 0, 2, 6 – ein Bild am Scheitel) → landet in der rechten Hand (u 6, Hand in Ruhe) → Hand gibt 1 px nach, Flasche geht mit (u 7, 8) →
Abwurf aus der rechten Hand (u 9, Hand wieder in Ruhe, Flasche noch in der Hand) → Flug zurück; nach dem Abwurf schwingt die Hand 1 px nach oben nach. Solange die Flasche in der Hand liegt (4 Bilder),
folgt sie der Hand pixelgenau (Nachgeben UND Federn des Clowns). Die Arme selbst sind unverändert (Posen aus Runde 9, gleiche Dicke).
Frame 0: rot im Scheitel wie im Original; gelb und blau liegen in den Händen (4 px tiefer und 1 px weiter innen als im Original, wo sie frei über den Händen schwebten) – bewusste Abweichung.
"""
import math
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_n4 as N4
import anim_textur as TX
TX.umleiten()

N, MS = 54, 70
G = N4.Figur('potion-juggler', 2, 2, 2, 2)
spr, H, W, OFF = G.spr, G.H, G.W, G.OFF
f = G.f
clown = L.lade('potion-juggler-clown')
TRANK = [L.lade('potion-juggler-trank%d' % k) for k in range(3)]     # 0 rot (Scheitel), 1 gelb (links), 2 blau (rechts)
G.erlaubt = G.erlaubt | {f(15, 25)}
MUND_ZU = f(14, 26)
# Flaschenbahn (Runde 10): u = 0 Abwurf aus der linken Hand, 1–5 Flug, 6–9 in der rechten Hand (6 landen, 7–8 Hand gibt nach, 9 Abwurf), 10–14 Flug zurück, 15–17 (+0) in der linken Hand.
HAND_X, HAND_Y = 1, 14                                               # Flasche in der linken Hand (Boden = Zeile 25 = Oberkante des Handschuhs); rechts gespiegelt (22 − x)
FLUG = ((5, 6), (9, 2), (11, 0), (13, 2), (17, 6))                   # links → rechts; zurück gespiegelt: steigende und fallende Flasche kreuzen sich nebeneinander
START = {1: 0, 0: 12, 2: 6}                                          # u in Frame 0: gelb wird links geworfen, rot im Scheitel (R→L), blau landet rechts


def bahn(u):
    """(x, y, faellt, hand) der Flasche im Bahnschritt u (Periode 18); hand = None (fliegt), 'l' oder 'r' (liegt in dieser Hand, y dann ohne Handversatz)."""
    u %= 18
    h, v = divmod(u, 9)
    if 1 <= v <= 5:
        x, y = FLUG[v - 1]
        return (22 - x if h else x), y, v >= 3, None
    in_r = (v >= 6) != bool(h)                                       # v ≥ 6: in der Zielhand; v = 0: Abwurf aus der Starthand
    return (22 - HAND_X if in_r else HAND_X), HAND_Y, True, 'r' if in_r else 'l'


ARM_L = {(8, 25), (9, 25), (7, 26), (8, 26), (9, 26), (7, 27), (8, 27), (9, 27), (7, 28), (8, 28), (9, 28), (8, 29), (9, 29), (9, 30)}   # Hand + äußerer Ärmel (Spalten 7–9) des linken Arms
HAAR_RAND, HANDSCHUH_RAND, AERMEL = f(9, 24), f(10, 26), f(10, 28)
for (x_, y_) in ARM_L:
    assert clown[y_, x_, 3] and clown[y_, 31 - x_, 3] and (clown[y_, x_] == clown[y_, 31 - x_]).all(), (x_, y_)   # beide Arme sind spiegelgleich (Achse x 15,5)
# Wurftakt je Hand (Phase 0 = Flasche trifft die Hand): fangen → nachgeben (2 Frames unten) → Abwurf (Ruhe) → Nachschwung oben → Ruhe → Ruhe
ARM_TAKT = (0, 1, 1, 0, -1, 0)


def arm_pose(c, d, rechts):
    """Arm als Pose im Clown-Sprite `c`: Hand + äußerer Ärmel (ARM_L) gehen starr um d px (+1 = unten beim Fangen, −1 = oben nach dem Wurf); die Schulter (Spalten ≥ 10) bleibt.
    Gleiche Dicke (nur senkrechter Versatz), frei werdende/verdeckte Stellen fertiggezeichnet."""
    if not d:
        return c
    X = (lambda x: 31 - x) if rechts else (lambda x: x)
    teil = {(x, y): c[y, X(x)].copy() for (x, y) in ARM_L}
    for (x, y) in ARM_L:
        c[y, X(x)] = 0
    for (x, y), v in teil.items():
        c[y + d, X(x)] = v
    def setz(x, y, farbe):
        c[y, X(x), :3] = farbe
        c[y, X(x), 3] = 255
    if d > 0:
        setz(9, 25, HAAR_RAND)                                       # Haarumriss, den der Handschuh verdeckt hatte
        setz(10, 28, HANDSCHUH_RAND)                                 # rechter Handschuhrand geht mit nach unten
    else:
        setz(9, 30, f(9, 30))                                        # Ärmel-Unterkante bleibt an der Schulter geschlossen
        setz(10, 25, HANDSCHUH_RAND)                                 # Handschuhrand geht mit nach oben (Hand vor dem Haar)
        setz(10, 27, AERMEL)
    return c


HANDSCHUH = ((8, 25), (9, 25), (7, 26), (8, 26), (9, 26), (10, 26), (9, 27), (10, 27))   # linker Handschuh (rechts gespiegelt): liegt VOR dem Boden der gehaltenen Flasche


def frame(i):
    c = clown.copy()
    dl, dr = ARM_TAKT[(i - 3) % 6], ARM_TAKT[i % 6]
    c = arm_pose(c, dl, False)                                       # linke Hand fängt in den Frames 3 (mod 6)
    c = arm_pose(c, dr, True)                                        # rechte Hand fängt in den Frames 0 (mod 6)
    k = G.ebene(quelle=c)
    if Hm.takt(i, 27, 20, 4):
        Hm.setze(k, {(15, 26): MUND_ZU, (16, 26): MUND_ZU}, OFF)
    fed = 1 if Hm.stufe(i, 6, 1) else 0
    if fed:
        k = TX.streck_zeile(k, G.PT + 34, 1)
    k = G.schliessen(k, lambda x, y: (0, 0, 0))
    lagen = []
    for n, tr in enumerate(TRANK):
        x, y, faellt, hand = bahn(START[n] + i)
        if hand:                                                     # in der Hand: die Flasche folgt der Hand (Nachgeben) und dem Federn des Clowns
            y += (dl if hand == 'l' else dr) - fed
        lagen.append((faellt, tr, x, y))
    lagen.sort(key=lambda e: e[0])                                   # steigende Flasche hinten, fallende vorn
    bild = L.zusammen(H, W, [(k, 0, 0)] + [(L.platz(tr, H, W, G.PL + x, G.PT + y), 0, 0) for _, tr, x, y in lagen])
    for d, X in ((dl, lambda x: x), (dr, lambda x: 31 - x)):         # Handschuhe wieder nach vorn: die Hand umfasst den Flaschenboden
        for (x, y) in HANDSCHUH:
            yy_, xx_ = G.PT + y + d - fed, G.PL + X(x)
            bild[yy_, xx_] = k[yy_, xx_]
    return bild


if __name__ == '__main__':
    N4.abschluss(G, 'Potion Juggler', [frame(i) for i in range(N)], MS, sys.argv, scale=4)
