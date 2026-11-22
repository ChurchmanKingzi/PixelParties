# -*- coding: utf-8 -*-
"""Idle-Animation für „Guardian Beast Hou“ (Creature, Archetyp Guardian Beasts) — die Bombenwerferin mit violetter Spitzmütze, roter Stirnbinde und rotem Stab (Zeichen „Hou“ = Affe).

Quelle: src/guardian-beast-hou.png (17×32 px, 48 Farben): Figur (14 px breit, y 6–31) + roter Stab (x 14–16, y 0–31).
PICK: [["MotiveGuardianBeasts", 124, 1], ["MotiveGuardianBeasts", 123, "Stab"]]      (Ebene „Hou“ Figur 1 = Figur; der Stab ist ein Teil der Ebene „Hou #1“ (123): Spalten x 36–38, y 8–39 der Ebene, 3 px breit, 32 px lang,
nach dem Abgleich mit der Kunst bei Kartenpixel x 44–46, y 7–38; er wird in der Kunst über die Hand der Figur gelegt. Die Ebene 123 enthält außerdem die vier/fünf Bomben mit brennender Lunte um die Figur; Ebene 125 „Ebene“ ist eine
zweite Pose derselben Figur, die eine Bombe über den Kopf hält)
Abgleich mit der Kartenkunst Guardian_Beast_Hou.png (76×51): Figur sitzt bei (30,13), 97 % Pixeltreffer; der Stab steht direkt an ihrer rechten Hand (Kartenpixel x 44–46). Die schwebenden Bomben (Ebene 123) sind Beiwerk der Karte (Angriffs-Effekt),
keine Teile der Figur → nicht übernommen. Die Quelle war damit vollständig (Figur + gehaltener Stab).

Aufruf:   python3 guardian_beast_hou.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/guardian-beast-hou.png + .json

Identifikation (x, y im 17×32-Sprite):
* STAB (x 14–16, y 0–31): dunkelroter Rand (94,0,0), Mitte hellrot (214,30,6)/(207,82,71)/(150,33,13); wird von der rechten Hand gehalten (die Hand liegt hinter dem Stab) und steht am Boden. Lackiertes Holz/Eisen, ohne Glanz.
  Oben (y 0–1) und unten (y 30–31) läuft er in eine 1 px breite Spitze aus; dazwischen y 2–29 Schaft (Rand | Mitte | Rand).
* MÜTZE (x 6–10, y 6–11): violette Spitzmütze (103,54,136)/(146,111,169)/(41,20,61); auf ihr ein kleines Abzeichen bei (7–8, 8–9): schwarz (0,0,0), weiß (255,252,240), Gold (215,192,86).
* STIRNBINDE (y 11–13): rotes V (91,0,3)/(128,16,26)/(179,23,36) mit schwarzen Brauen (0,0,0) bei (5–6,13)/(9–10,13).
* GESICHT (x 5–10, y 14–19): Haut (250,215,151)/(255,240,189)/(255,250,224); Augen: schwarze 2×2-Blöcke (0,0,0) bei (5–6,15)/(9–10,15) mit Pupille (1,1,3) bei (6,16)/(10,16) und weißem Glanzpunkt (246,255,255) bei (5,16)/(9,16);
  Mund: rotes Lächeln (125,0,0) bei (6,18) und (7–8,19); rote Wangen (91,0,3) bei (3,18)/(12,18).
* HAAR/OHREN (x 3–4 und 11–12, y 12–18): olivbraune Strähnen (83,78,56), tan (171,142,100); OHRRINGE: je ein heller Goldpunkt (255,245,194) bei (3,16) und (12,16).
* KRAGEN/RUMPF (y 20–25): graue Weste (139,147,153)/(161,166,169)/(82,82,82), violetter Zierstreifen (118,86,153), goldene Zierstücke (220,190,100)/(249,231,155) bei (6,22), (9,22), (7,24), (7–8,25) (Schnalle/Anhänger).
* LINKER ARM (x 0–4, y 21–27): Ärmel in grau, Manschette cremefarben (249,242,213) bei (1,23) mit Goldreif (220,190,100) bei (2,23). RECHTER ARM (x 11–13): liegt hinter dem Stab.
* HOSE (y 26–28): weiß/grau (230,229,224)/(179,178,174); STIEFEL (y 29–31): braun (105,86,70)/(142,117,95)/(175,146,106) mit dunklem Saum (57,46,54).
Gold im Sprite: Ohrringe, Anhänger/Schnalle, Armreif, Mützenabzeichen (alles winzig) → nur dort kurzes Funkeln als Ein-Pixel-Kleckse; der Stab glänzt nicht (Lack).

Ablauf (48 Frames à 64 ms = 3,07 s, nahtlos):
* Atmen (Periode 24, zwei Atemzüge): die glatte Hosenzeile 26 wird einmal doppelt eingefügt, Rumpf, Arm, Kopf und Mütze steigen 1 px, Stiefel bleiben; der Stab bleibt stehen (die Hand liegt hinter dem Stab).
* Mützenspitze weht: die oberen vier Mützenzeilen (6–9) biegen sich nach rechts (Frames 4–15, bis 2 px an der Spitze, Zeilenversatz-Gefälle ≤ 1 px) und später ein Stück nach links (Frames 28–37, 1 px); Nähte bleiben 4-verbunden.
* Blinzeln (Frames 19–21 und 41–43): beide Augen schließen sich — die oberen Augenpixel nehmen die Stirnhaut an, der Glanzpunkt wird schwarz, es bleibt ein dunkler Lidstrich.  Zwinkern (Frames 28–31): nur das rechte Auge schließt sich.
* Lächeln (Frames 11–16 und 37–41): der rechte Mundwinkel (9,18) wird rot (125,0,0), das Schmunzeln wird zum breiten Lächeln.
* Fußtippen: der linke Stiefel hebt sich zweimal 1 px (Frames 8–15), später der rechte (Frames 36–43); er verschwindet teilweise hinter der Hose.
* STAB FÄHRT EIN UND AUS (Runde 3, Nutzerwunsch „der rote Stab soll von oben ein- und ausfahren“, teleskopartig wie ein Zauberstab): das obere Ende wandert nach unten (der Stab wird kürzer, bis zu 16 Zeilen) und wieder nach oben.
  Der untere Teil bleibt unverändert an seinem Platz (Hand und Boden), nur die oberen Schaftzeilen fallen weg und die 2-px-Spitze sitzt am neuen oberen Ende; die Schaftmuster (Hell/Dunkel-Wechsel) bleiben dabei an ihrer Stelle.
  Zwei Fahrten je Schleife: tief (Frames 6–22: Einfahren in 4 Stufen, halten, Ausfahren in 5 Stufen) und flach (Frames 34–43, bis 6 Zeilen).
* Gold funkelt (Regel 12/14, winzig): die Ohrringe blitzen abwechselnd (Frames 14–16 / 33–35), Anhänger und Schnalle blitzen als einzelne Pixel (Frames 22–24 / 44–46); kein Lichtband (nur 6 Goldpixel), keine Sterne.
Frame 0 = Original (Ruhepose). Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine (nichts Verdecktes wird freigelegt; Stiefel liegen beim Heben hinter der Hose).
"""
import sys

import anim_gb as G
import anim_humanoide as Hm
import anim_lib as L
import anim_textur as TX   # texturierte Streckzeilen statt Zeilenkopien (Regel 43/49)
TX.umleiten()               # auch Streckaufrufe innerhalb der Gruppenmodule liefern texturierte Zeilen

N, MS = 48, 64
sz = G.Szene('guardian-beast-hou', (2, 2, 2, 2))
spr, OFF, H, W, f = sz.spr, sz.off, sz.H, sz.W, sz.f

HAUT = f(5, 14)                                                  # (250,215,151) Stirnhaut = Lid
SCHWARZ = f(5, 15)                                               # (0,0,0)
GLANZ = f(8, 8)                                                  # (255,252,240) Weiß der Quelle
OHRRING = f(3, 16)                                               # (255,245,194)
GOLD_ANH = [f(6, 22), f(9, 22), f(7, 24), f(7, 25), f(8, 25)]
UMRISS = f(3, 12)                                                # (49,24,0)
MUND = f(6, 18)                                                  # (125,0,0) rotes Lächeln

stab = sz.maske(14, 0, 16, 31)
# Stab teleskopartig: Einfahrtiefe r (Zeilen) je Frame; 0 = ausgefahren (Original)
EIN_TIEF = {6: 3, 7: 7, 8: 12, 9: 16, 10: 16, 11: 16, 12: 16, 13: 16, 14: 16, 15: 16, 16: 16, 17: 13, 18: 9, 19: 5, 20: 2,
            34: 2, 35: 5, 36: 6, 37: 6, 38: 6, 39: 6, 40: 4, 41: 2}
hut = sz.maske(6, 6, 9, 9)
stiefel_l = sz.maske(0, 29, 6, 31) & ~stab
stiefel_r = sz.maske(9, 29, 13, 31) & ~stab
koerper = sz.vorhanden & ~stab & ~hut & ~stiefel_l & ~stiefel_r

AUGE_L = {(5, 15): HAUT, (6, 15): HAUT, (5, 16): SCHWARZ}
AUGE_R = {(9, 15): HAUT, (10, 15): HAUT, (9, 16): SCHWARZ}

# Mützenversatz je Zeile 6–9 (Gefälle ≤ 1 px; Spitze oben)
HUT_POSEN = {
    0: (0, 0, 0, 0),
    1: (1, 0, 0, 0),
    2: (1, 1, 0, 0),
    3: (2, 1, 1, 0),
    4: (2, 2, 1, 0),
    -1: (-1, 0, 0, 0),
    -2: (-1, -1, 0, 0),
}
# Verlauf der Mützenspitze: Frame → Pose (0 = gerade)
HUT_ABLAUF = {}
for k, p in enumerate([1, 2, 3, 4, 4, 3, 3, 4, 3, 2, 1, 0]):       # Frames 4–15 nach rechts
    HUT_ABLAUF[4 + k] = p
for k, p in enumerate([-1, -2, -2, -1, -2, -1, 0]):                  # Frames 28–34 nach links
    HUT_ABLAUF[28 + k] = p


def stab_ebene(r):
    """Stab mit um r Zeilen eingefahrenem oberen Ende: Schaftzeilen y < r + 2 entfallen, die Spitze (Zeilen 0–1 des Originals, nur Mittelspalte) sitzt auf Zeile r, r + 1."""
    sb = sz.ebene(stab)
    if not r:
        return sb
    sz.setze(sb, {(x, y): None for x in range(14, 17) for y in range(0, r + 2)})
    sz.setze(sb, {(15, r): f(15, 0), (15, r + 1): f(15, 1)})
    return sb


def frame(i):
    k, h, sb = sz.ebene(koerper), sz.ebene(hut), stab_ebene(EIN_TIEF.get(i, 0))
    bl, br = sz.ebene(stiefel_l), sz.ebene(stiefel_r)
    # --- Blinzeln / Zwinkern ---
    if Hm.folge(i, 19, [1, 1, 1], N) or Hm.folge(i, 41, [1, 1, 1], N):
        sz.setze(k, AUGE_L); sz.setze(k, AUGE_R)
    elif Hm.folge(i, 28, [1, 1, 1, 1], N):
        sz.setze(k, AUGE_R)
    # --- Lächeln: der rechte Mundwinkel (9,18) wird rot (schmales Schmunzeln → breites Lächeln) ---
    if Hm.folge(i, 11, [1, 1, 1, 1, 1, 1], N) or Hm.folge(i, 37, [1, 1, 1, 1, 1], N):
        sz.setze(k, {(9, 18): MUND})
    # --- Goldfunkeln (Ein-Pixel-Kleckse; Ohrringe, Anhänger/Schnalle) ---
    if Hm.folge(i, 14, [1, 1, 1], N):
        sz.setze(k, {(3, 16): GLANZ})
    if Hm.folge(i, 33, [1, 1, 1], N):
        sz.setze(k, {(12, 16): GLANZ})
    for (x, y), start in (((9, 22), 22), ((8, 25), 44)):
        if Hm.folge(i, start, [1, 1, 1], N):
            sz.setze(k, {(x, y): OHRRING})
    # --- Mützenspitze weht ---
    pose = HUT_POSEN[HUT_ABLAUF.get(i, 0)]
    sz.zeilen(h, {6 + j: dx for j, dx in enumerate(pose)})
    # --- Atmen ---
    brust = Hm.stufe(i, N / 2, 1)
    k, h = TX.szene_atmen(sz, [k, h], 26, brust)
    # --- Fußtippen ---
    pat = [1, 1, 0, 0, 1, 1, 0, 0]
    ul = 1 if Hm.folge(i, 8, pat, N) else 0
    ur = 1 if Hm.folge(i, 36, pat, N) else 0
    bl, br = sz.ebene(stiefel_l, 0, -ul), sz.ebene(stiefel_r, 0, -ur)
    fig = L.zusammen(H, W, [(bl, 0, 0), (br, 0, 0), (k, 0, 0), (h, 0, 0), (sb, 0, 0)])
    return sz.kontur(fig, UMRISS)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    G.abschluss(sz, frames, 'guardian-beast-hou', 'Guardian Beast Hou', MS, prev)
