# -*- coding: utf-8 -*-
"""Idle-Animation für „Guardian Beast Hu“ (Creature, Archetyp Guardian Beasts) — der Tiger-König (Zeichen „Hu“ = Tiger) mit goldener Krone, rotem Gesicht, rotem Umhang und goldenem Stab.

Quelle: src/guardian-beast-hu.png (21×31 px, 33 Farben): Figur (x 0–16) + Stab (x 17–20, y 0–30), beides in einer Ebene.
PICK: [["MotiveGuardianBeasts", 75, 1]]      (Ebene „Hu“, Figur 1; Ebene 28 „Ascended Dajan #2“ enthält dieselbe Figur in einer Szene mit anderen Wesen, die Ebenen 76/77 sind Bewegungsunschärfe-Fassungen derselben Figur/des Stabs)
Abgleich mit der Kartenkunst Guardian_Beast_Hu.png (76×51): Sprite sitzt dort bei (29,9), 99,8 % Pixeltreffer. Der Stab gehört zur Figur (er steckt im Sprite, die Hand liegt am Stab); Beiwerk der Karte sind die Felsmuster. Die Quelle war damit vollständig.

Aufruf:   python3 guardian_beast_hu.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/guardian-beast-hu.png + .json

Identifikation (x, y im 21×31-Sprite):
* KRONE (x 3–14, y 2–9): goldene Krone mit Zacken, Gold (153,128,2)/(201,168,3)/(222,188,28)/(255,228,72)/(255,246,129)/(255,252,149), dunkelbrauner Umriss (68,47,0) → Metall/Gold, glänzt.
* OHREN (x 1–2 bzw. 15–16, y 7–10): violette Tigerohren (121,77,138)/(69,49,84) mit dunklem Umriss (42,30,51).
* GESICHT (x 4–13, y 9–15): rote Maske (132,39,50)/(159,31,46)/(206,29,49), goldene Stirnstreifen; AUGEN je ein schwarzer L-förmiger Block (0,0,0) bei (5–6,11)+(5,12) bzw. (11–12,11)+(12,12), außen weiße/hellblaue Weißpixel
  (249,250,252)/(184,203,235)/(172,213,255)/(246,255,255) bei (3–4,11–12)/(6,12–13) bzw. (13–14,11–12)/(11,12–13); Nase (206,29,49) bei (8–9,10–11); Mund: schwarze Öffnung (26,19,27) bei (8–9,14) mit weißen ZÄHNEN (255,255,255) bei (8–9,15)
  (Zähne, bleiben fest, keine Partikel).
* KÖRPER (y 16–27): roter Umhang/Wams (132,39,50)/(159,31,46)/(206,29,49) mit dunklen Rändern, goldenes Gürtelschloss (255,228,72)/(222,188,28) bei (7–9,22), violette Beine/Rock (69,49,84)/(143,106,150), goldene Stiefelspitzen (255,228,72)/(201,168,3) bei (4–7,27)/(11–14,27);
  goldene Armreife/Manschetten (254,255,115)/(238,194,69) bei (1–4,19–22) und (16,18–19).
* STAB (x 17–20, y 0–30): oben violetter Knauf (149,101,159)/(88,56,103) y 2–6, darunter abwechselnd violette/goldene Bänder (x 18: violett/(253,249,152)/(250,220,64)/(227,181,0), x 19: (153,128,2)), die Faust (dunkelbraun (68,47,0)) greift bei (16–18,17–19)
  um den Stab; unten goldene Kappe bei (18,29). Er steht am Boden.
Gold im Sprite: Krone, Stabbänder, Gürtelschloss, Armreife, Stiefelspitzen → nur dort Glanz (Regel 12/14). Kein Feuer, kein Dampf, keine Partikel.

Ablauf (48 Frames à 64 ms = 3,07 s, nahtlos):
* Atmen (Periode 24, zwei Atemzüge): die texturierte Rockzeile 26 wird einmal doppelt eingefügt (mit Texturmischung), Kopf, Krone, Umhang und Arme steigen 1 px; die Stiefel bleiben am Boden, der Stab (mit Faust) bleibt stehen.
* Ohren zucken: das linke Ohr (Frames 6–11) und später das rechte Ohr (Frames 30–35) rutschen ruckhaft 1 px nach unten und wieder hoch, sie bleiben am Kopf.
* Blinzeln (Frames 19–21 und 41–43): die weißen/hellblauen Augenpixel nehmen die Gesichtsfarbe an; es bleibt der schwarze L-Block als Lidstrich (Lid = umgebende Körperfarbe).
* Gold glänzt (Regel 12/14): ein Lichtband läuft diagonal über die Krone (Frames 4–15 und 28–39), ein zweites läuft an den goldenen Stabbändern hinab (Frames 14–25); Glitzersterne sitzen an der Krone (Frames 18–22, 36–40) und am Gürtelschloss (Frames 44–47).
Frame 0 = Original (Ruhepose). Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine (nichts Verdecktes wird freigelegt; die Ohren liegen beim Zucken hinter dem Kopf).
"""
import sys

import anim_gb as G
import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 64
sz = G.Szene('guardian-beast-hu', (2, 2, 2, 2))
spr, OFF, H, W, f = sz.spr, sz.off, sz.H, sz.W, sz.f

GESICHT = f(7, 11)                                               # (159,31,46) rote Gesichtsfarbe
LILA = f(5, 13)                                                  # (121,77,138)
SCHWARZ = f(5, 11)                                               # (0,0,0)
UMRISS = f(3, 2)                                                 # (68,47,0)
GOLD = [(153, 128, 2), (201, 168, 3), (227, 181, 0), (222, 188, 28), (238, 194, 69), (250, 220, 64), (255, 228, 72), (255, 246, 129), (255, 252, 149)]
AUGEN_L = [(3, 11), (4, 11), (4, 12), (6, 12), (6, 13)]
AUGEN_R = [(14, 11), (13, 11), (13, 12), (11, 12), (11, 13)]

stab = sz.maske(17, 0, 20, 30)
krone = sz.maske(3, 2, 14, 8) & ~sz.punkte([(3, 8)])
ohr_l = sz.punkte([(1, 7), (1, 8), (2, 8), (1, 9), (2, 9), (1, 10), (2, 10)])
ohr_r = sz.punkte([(16, 7), (15, 8), (16, 8), (15, 9), (16, 9), (15, 10), (16, 10)])
koerper = sz.vorhanden & ~stab & ~ohr_l & ~ohr_r & ~krone
m_sleeve = sz.maske(0, 24, 3, 27)
sleeve = m_sleeve & koerper
koerper = koerper & ~sleeve
m_krone = sz.vorhanden & L.farbmaske(spr, GOLD) & (sz.yy <= 10) & (sz.xx <= 16)
m_stab_gold = stab & L.farbmaske(spr, GOLD) & (sz.xx >= 18) & (sz.yy >= 7) & (sz.yy <= 28)
AUGEN_FARBE = {}
for p in AUGEN_L + AUGEN_R:
    AUGEN_FARBE[p] = GESICHT
AUGEN_FARBE[(6, 13)] = LILA
AUGEN_FARBE[(11, 13)] = LILA


def frame(i):
    k, sb = sz.ebene(koerper), sz.ebene(stab)
    # --- Blinzeln ---
    if Hm.folge(i, 19, [1, 1, 1], N) or Hm.folge(i, 41, [1, 1, 1], N):
        sz.setze(k, AUGEN_FARBE)
    # --- Gold glänzt: Krone (diagonal), Stabbänder (von oben nach unten), Sterne ---
    Hm.lichtband(k, m_krone, OFF, i, N, 4, 12, GOLD, stufen=1, breite=2.6, achse=(1.0, 1.0), kern=2)
    Hm.lichtband(k, m_krone, OFF, i, N, 28, 12, GOLD, stufen=1, breite=2.6, achse=(-1.0, 1.0), kern=2)
    Hm.lichtband(sb, m_stab_gold, OFF, i, N, 14, 12, GOLD, stufen=1, breite=3.0, achse=(0.0, 1.0), kern=2)
    for (x, y), start in (((8, 6), 18), ((12, 7), 36), ((8, 22), 44)):
        st = Hm.folge(i, start, [0, 1, 1, 0], N)
        if st is not None:
            Hm.stern4(k, x, y, st, GOLD[8], GOLD[7], off=OFF)
    # --- Ohren zucken (1 px nach unten, ruckhaft) ---
    zl = 1 if Hm.folge(i, 6, [1, 1, 0, 1, 1, 0], N) else 0
    zr = 1 if Hm.folge(i, 30, [1, 1, 0, 1, 1, 0], N) else 0
    ol, orr = sz.ebene(ohr_l, 0, zl), sz.ebene(ohr_r, 0, zr)
    # --- Atmen (Rockzeile 26) ---
    brust = Hm.stufe(i, N / 2, 1)
    k, ol, orr = sz.atmen([k, ol, orr], 26, brust)
    fig = L.zusammen(H, W, [(ol, 0, 0), (orr, 0, 0), (k, 0, 0), (sb, 0, 0)])
    return sz.kontur(fig, UMRISS)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    G.abschluss(sz, frames, 'guardian-beast-hu', 'Guardian Beast Hu', MS, prev)
