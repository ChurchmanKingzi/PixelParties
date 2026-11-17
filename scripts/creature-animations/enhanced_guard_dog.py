# -*- coding: utf-8 -*-
"""Idle-Animation für „Enhanced Guard Dog“ (Creature) — der schwarz-lohfarbene Wachhund mit den roten Augen in seiner gelben Kraft-Aura.

PICK: keine xcf-Ebene. Der Hund kommt in keiner Ebene des xcf-Dumps vor (Suche per Template-Abgleich über alle Ebenen: nur Baum/Wiese der Szene wurden gefunden; die Loyal-Hunde und Orthos sind
      andere Sprites). Quelle ist allein die Kartenkunst public/cardgen/art/Enhanced_Guard_Dog.webp (610×400, verlustbehaftet, Pixelraster 96×63 → 1 Sprite-Pixel = 6,35 Bildpixel).
REKONSTRUKTION (siehe Bericht): Die Figur wurde im 96×63-Raster abgetastet (Median der Blockmitte), per Farbtrennung von Wiese und Aura getrennt (Hund = x 42–53, y 28–41 des Rasters), links/rechts
      gemittelt (der Hund steht frontal und ist in der Kunst spiegelsymmetrisch; nur der Brustfleck war um 1 px unsymmetrisch) und auf 8 Farben geclustert (das WebP-Rauschen ist damit weg).
      Die Aura der Kunst (drei Gelbtöne: fast Weiß außen, Hellgelb, Gelb innen) steht als Standbild in src/enhanced-guard-dog.png (19×21 px; Hund darin bei (3,7), 12×14 px).

Was ist was (x/y im 12×14-Hund, Sprite = +(3,7)):
* KOPF (y 0–5): schwarzer Umriss (23,19,7), dunkles Fell (42,38,36)/(59,55,55), lohfarbene Brauenflecken (3–4,1)/(7–8,1), ROTE Augen (4,2) und (7,2), lohfarbene Schnauze (y 3–5) mit schwarzer Nase/Maul
  (5–6, 4–5); Schlappohren seitlich (x 0–2 und x 9–11, y 2–3).
* KÖRPER (y 6–13): dunkelgraue Vorderläufe/Brust (59,55,55), lohfarbener Brustfleck (5–6, 8) mit braunem Schatten (5–6, 9), lohfarbene Pfoten (y 11–12).
* AURA: gelbe Energie rund um den Hund, oben in Zacken auslaufend.
Kein Metall. Die Aura ist kein Feuer, flammt in der Kunst aber wie eine Flamme nach oben → sie wird mit anim_feuer3 (lebhafte Einstellung posen=16, halten=1) in den drei Aura-Farben der Kunst gezeichnet,
HINTER dem Hund: ein breiter ruhiger Sockel um den ganzen Körper + drei Zungen über dem Kopf. Frame 0 zeigt deshalb den Hund im Original, die Aura aber in der ersten Feuer-Pose (nicht pixelgleich zur Kunst).

Ablauf (48 Frames à 70 ms = 3,36 s, nahtlos):
* Aura lodert durchgehend aufwärts (16-Posen-Zyklus, 3× je Schleife), Spitzen reißen ab.
* Atmen (Periode 24): Laufzeile 10 wird texturiert eingefügt (0–1 px): Kopf und Brust heben sich, die Pfoten bleiben am Boden. Kopf nie seitlich.
* Blinzeln (Frames 20–21): die roten Augen nehmen das Fellgrau daneben an.
* Ohrzucken: linkes Ohr Frames 9–11, rechtes Ohr Frames 33–35 — das Ohr klappt 1 px nach unten (Ohr als Einheit, Kopfumriss darüber wird geschlossen).
Ergänzungen: beim Ohrzucken je 1 Umrisspixel an der Kopfseite ((1,2) bzw. (10,2)).
"""
import anim_feuer3 as F3
import anim_lib as L
import anim_n2 as N2
import anim_textur as TX
TX.umleiten()

N, MS = 48, 70
FIG = N2.Figur('enhanced-guard-dog', pad=(4, 4, 12, 2))
spr = FIG.spr
OFF = FIG.off
HX, HY = 3, 7                                   # Hund im Sprite
HOFF = (OFF[0] + HX, OFF[1] + HY)
TEST_EBENEN = 'figur'

A_W, A_P, A_Y = FIG.farbe((251, 254, 236), (254, 253, 192), (248, 250, 156))
AURA = FIG.maske([A_W, A_P, A_Y])
HUND = FIG.op & ~AURA
UMRISS, FELL1, FELL3 = FIG.farbe((23, 19, 7), (42, 38, 36), (59, 55, 55))

CX, BY = OFF[0] + 9, OFF[1] + 20
FEUER = F3.Feuer(FIG.H, FIG.W, [
    F3.Flamme(x=CX, y=BY, laenge=19, breite=8.2, phase=0.0, bauch=0.25, schlag=0.3, puls=0.08, wiegen=0.1, fuss=0, pot=0.55),
    F3.Flamme(x=CX - 5, y=OFF[1] + 9, laenge=9, breite=2.6, phase=0.35, fuss=0),
    F3.Flamme(x=CX, y=OFF[1] + 7, laenge=10, breite=2.8, phase=0.0, fuss=0),
    F3.Flamme(x=CX + 5, y=OFF[1] + 9, laenge=9, breite=2.6, phase=0.7, fuss=0)], farben=[A_W, A_P, A_Y], posen=16, halten=1)

OHR_L = {(0, 2): None, (1, 2): UMRISS, (0, 3): UMRISS, (1, 3): FELL1, (0, 4): UMRISS, (1, 4): FELL3}
OHR_R = {(11 - x, y): c for (x, y), c in OHR_L.items()}


def hund(i):
    a = FIG.platz(HUND)
    if N2.fenster(i, N, 20, [1, 1]):
        N2.setze(a, HOFF, {(4, 2): FELL3, (7, 2): FELL3})
    for start, ohr in ((9, OHR_L), (33, OHR_R)):
        if N2.fenster(i, N, start, [1, 1, 1]):
            N2.loesche(a, HOFF, [p for p, c in ohr.items() if c is None])
            N2.setze(a, HOFF, {p: c for p, c in ohr.items() if c is not None}, neu=True)
    return TX.streck_zeile(a, HOFF[1] + 10, N2.hub(i, 24, 1))


def frame(i, nur=None):
    h = hund(i)
    if nur == 'figur':
        return h
    return L.zusammen(FIG.H, FIG.W, [(FEUER.ebene(i), 0, 0), (h, 0, 0)])


if __name__ == '__main__':
    N2.haupt(__import__(__name__), 'Enhanced Guard Dog')
