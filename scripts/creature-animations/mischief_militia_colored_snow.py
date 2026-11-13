# -*- coding: utf-8 -*-
"""Idle-Animation für „Mischief Militia - Colored Snow“ (Creature) — der Schneemann, auf den die Tränke (rot, gelb) gelandet sind.

RUNDE 4 (Nutzer-Feedback): „Bei Colored Snow kannst du das Grüne weglassen.“ — der grüne Strahl (44 Pixel, x 16–26, y 0–10) ist aus src/mischief-militia-colored-snow.png entfernt. Wo er den Schneemann verdeckte
(20 Pixel: rechte Kopfseite, Kopfumriss, schwarze Haar-/Zweigstriche oben rechts), stehen jetzt die Originalpixel des Schneemanns aus Ebene 84 (MotiveRussia, Lage (7,4) im Sprite); die übrigen 24 Strahlpixel sind leer.
Die Strahl-Animation entfällt; alles andere (Atmen, Pfütze, rote Tropfen, Zweigarme, Dunst, Frame-Maße) ist unverändert. Die Abschnitte unten, die den grünen Strahl beschreiben, gelten nur noch historisch.

RUNDE 3 (Nutzer-Feedback): „Colored Snow ist die Figur, auf der die Potions gelandet sind.“ — der bisherige Rotor-Schneemann war FALSCH. Gemeint ist der Schneemann in der Kartenmitte
(Schneemann mit geschlossenen X-Augen, Schal und Zweigarmen), über den ein roter Farbklecks (Kopf), ein grüner Strahl (von rechts oben) und eine gelbe Pfütze (unten/links) gespritzt sind.

Quelle: src/mischief-militia-colored-snow.png (27×20 px, 16 Farben, deckend) — aus ZWEI Ebenen der xcf „MotiveRussia“ zusammengesetzt (von Hand; creature_show.py findet nur den Rotor-Schneemann):
PICK: [["MotiveRussia", 84, "ganze Ebene"], ["MotiveRussia", 80, "ganze Ebene"]]
  Ebene 84 („Ebene #144“, 15×16, Karte (34,25)) = der Schneemann; Ebene 80 („Ebene #146“, 32×21, Karte (27,20)) = die Farbspritzer (roter Klecks, grüner Strahl, gelbe Pfütze), in der xcf mit 80 % Ebenen-Deckkraft
  über dem Schneemann (Pixel selbst deckend 255 — Regel 22: hier deckend übernommen; der Schneemann scheint dadurch nur durch die Lücken des Kleckses). Lage: Ebene 84 bei (7,5) in der 32×21-Fläche der Ebene 80
  (Abgleich mit data/card-art/native/Mischief_Militia_Colored_Snow.png: stimmt mit der Kartenmitte überein). NICHT übernommen: die Glasflaschen (Ebene 81 und die Flasche in Ebene 83) und der Schatten (Ebene 82) — Beiwerk.
  Ergänzung (einzige gemalte Pixel): die zwei Pfützenteile (links = Guss aus der Gelbflasche, rechts = Lache am Körper) waren in der Ebene durch eine 1-px-Lücke bei x 8 getrennt (dort sitzt in der Karte der Flaschenhals)
  → Brückenpixel (8,16) hellgelb (255,255,80) und (8,17) gelb (196,175,18), Sprite-Koordinaten; damit ist die Pfütze EINE Fläche. Außerdem: der grüne Strahl ist in der Ebene am oberen Rand/rechten Rand abgeschnitten (dort verdeckt in der Karte die Flasche den Strahl). Er wurde oben abgerundet: Pixel x ≥ 27 der Zeilen 0–3 der Ebene
  entfernt, Kappe (26,1) = hellgrün (77,213,36), (26,2) = dunkelgrün (38,105,18) (Sprite-Koordinaten (25,0)/(26,0) hellgrün, (26,1) dunkelgrün). Zeile 0 der Ebene und die Spalten ≥ 27 sind leer → Sprite 27×20.

Aufruf:   python3 mischief_militia_colored_snow.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/mischief-militia-colored-snow.png + .json

Was im Sprite ist (x, y im 27×20-Sprite):
* ROTER KLECKS (x 9–19, y 3–11): dunkelrot B (86,19,19) / rot I (207,46,46) / hellrot P (214,77,77) — Farbe auf dem Kopf; dazwischen scheint der Kopf durch: Augenstriche J (schwarz) = X-Augen (x 11–16, y 8–10),
  braune Mundlinie N (13–14, 12), Kopfumriss M/F/O (lavendel/blau) bei x 10, y 9–11 und x 17–19, y 10–12; schwarze Pixel J bei (17,4),(16,5),(17,5) gehören zum Kopf (Kopfschmuck/Zweigspitze, unklar → fest).
* GRÜNER STRAHL (x 16–26, y 0–10): von rechts oben schräg auf den Kopf, hell D/L oben, mittelgrün D (62,173,30), dunkelgrün E (38,105,18) unten.
* SCHAL (blau F (85,117,169), y 12–13), SCHNEEBALL-KÖRPER (y 13–19) G/H/O/M (lavendel/weiß) mit lavendelfarbenem Umriss M (172,171,232);
  ZWEIGARME N (104,64,32): links (7,11)/(7,12)/(8,13)/(9,14), rechts (21,12)/(20,13)/(19,14).
* GELBE PFÜTZE (x 0–17, y 15–19): gelb A (196,175,18) / hellgelb C (255,255,80) / blassgelb K (255,255,180), liegt vor dem Körperfuß.
Material: Schnee, Zweige, Farbe/Flüssigkeit — KEIN Glanz/Sparkle (Regel 14), kein Feuer.

Ablauf (48 Frames à 66 ms = 3,17 s, nahtlos), alle Bewegungen unabhängig; der Schneemann steht (kein Schweben):
* Atmen (Periode 24): Zeile 15 des Schneeballs wird einmal doppelt eingefügt (Zeile ohne Zweigarm; die von der Pfütze verdeckten Randpixel (9,15)/(10,15) sind ergänzt) — Kopf, roter Klecks, grüner Strahl und Arme steigen 1 px,
  die Pfütze und der Boden bleiben stehen. Der Kopf bewegt sich nur auf und ab, nie seitlich.
* Grüner Strahl fließt (Periode 24): helle/mittlere Grünstreifen laufen entlang des Strahls zum Kopf hin (Bänder von 3 px wechseln hell ↔ mittelgrün; Randpixel und Dunkelgrün bleiben) — Frame 0 = Original.
* Gelbe Pfütze wellt (Periode 24): Bänder zwischen hellgelb und blassgelb laufen von rechts nach links nach außen (der dunkle Rand und alle Randpixel bleiben).
* Rote Tropfen laufen langsam am Schneeball hinunter (3 Tropfen, Perioden 48, versetzt): Kopf und Spur 2–3 px lang, verschwinden in der Pfütze bzw. am Fuß.
* Zweigarme schlenkern (Perioden 24/32, gegenläufig): die Zweigspitzen schwenken um ihre Wurzel, die Linie wird 4-verbunden neu gezogen (nur auf leere Felder).
* Kalter Dunst: 5 Wölkchen ≥ 2×2 steigen langsam seitlich vom Schneemann auf.
Ergänzungen: siehe oben (Strahlkappe, Randpixel (9,15)/(10,15)). Frame 0 = Original (Dunst ausgenommen).
"""
import math
import sys

import numpy as np

import anim_eis as E
import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 66
PAD_L, PAD_R, PAD_T, PAD_B = 8, 10, 6, 4
TEST_EBENEN = ('koerper',)

spr = L.lade('mischief-militia-colored-snow')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
ERLAUBT = Hm.umrissfarben(spr)

# Farben des Sprites
GELB = [(196, 175, 18), (255, 255, 80), (255, 255, 180)]                       # Pfütze A / C / K
GRUEN_HELL, GRUEN_MITTEL, GRUEN_DUNKEL = (77, 213, 36), (62, 173, 30), (38, 105, 18)
ROT_DUNKEL, ROT, ROT_HELL = (86, 19, 19), (207, 46, 46), (214, 77, 77)
ZWEIG = (104, 64, 32)
SCHNEE_RAND, SCHNEE_RAND2 = (172, 171, 232), (204, 204, 242)
E_, D_ = (223, 224, 246), (204, 204, 242)

ERLAUBT |= set(GELB) | {GRUEN_HELL, GRUEN_MITTEL, GRUEN_DUNKEL, ROT_DUNKEL, ROT, ROT_HELL}      # Farbspritzer dürfen am Rand stehen (Strahl: hell/mittel wechseln)
PFUETZE = L.farbmaske(spr, GELB)
GRUEN = L.farbmaske(spr, [GRUEN_HELL, GRUEN_MITTEL, GRUEN_DUNKEL])
assert not GRUEN.any()                                                         # Runde 4: der grüne Strahl ist aus dem Sprite entfernt (Nutzer: „das Grüne weglassen“)
ROTM = L.farbmaske(spr, [ROT_DUNKEL, ROT, ROT_HELL])
KOERPER = (spr[..., 3] > 0) & ~PFUETZE & ~GRUEN & ~ROTM
ATEMZEILE = 15                                                                 # Zeile des Schneeballs, die beim Atmen doppelt eingefügt wird (keine Zweigpixel darin)
ARM_L_FREI, ARM_L_BASIS = [(7, 11), (7, 12), (8, 13)], (9, 14)
ARM_R_FREI, ARM_R_BASIS = [(21, 12), (20, 13)], (19, 14)
for (x, y) in ARM_L_FREI + [ARM_L_BASIS] + ARM_R_FREI + [ARM_R_BASIS]:
    assert tuple(spr[y, x, :3]) == ZWEIG, (x, y)
assert not any(tuple(spr[ATEMZEILE, x, :3]) == ZWEIG for x in range(sw) if spr[ATEMZEILE, x, 3])


def band(s, breite):
    return (np.floor(s / breite).astype(int) % 2) == 0


KANTE = Hm.kantenmaske(spr)


def umschalten(a, maske, farbe_a, farbe_b, s, breite, verschiebung):
    """Streifen, die über `maske`-Pixel der Farben a/b laufen: ein Pixel wechselt a ↔ b, sobald der Streifen (Muster f(s + verschiebung)) von seinem Zustand in Frame 0 abweicht (→ Frame 0 = Original)."""
    ys, xs = np.nonzero(maske)
    for y, x in zip(ys, xs):
        c = tuple(int(v) for v in a[y, x, :3])
        if c not in (farbe_a, farbe_b) or KANTE[y, x]:            # Randpixel (Umriss) bleiben fest
            continue
        b0 = bool(band(np.array([s[y, x]]), breite)[0])
        bt = bool(band(np.array([s[y, x] + verschiebung]), breite)[0])
        if b0 != bt:
            a[y, x, :3] = farbe_b if c == farbe_a else farbe_a
    return a


YY, XX = np.mgrid[0:sh, 0:sw]
S_STROM = 0.857 * XX - 0.514 * YY            # Koordinate entlang des Strahls (wächst zur Quelle oben rechts)
S_PFUETZE = 0.95 * XX + 0.3 * YY             # Pfütze: Wellen laufen nach links


def tropfen(i):
    """Rote Tropfen am Schneeball: [(x, y)] in Sprite-Koordinaten (ungestreckt). Kopf + Spur laufen nach unten und verschwinden am Pfützenrand."""
    out = []
    # (x, Start-Frame, y_start, y_ende, Frames je Pixel)
    for (x, start, y0, y1, spd) in ((12, 6, 13, 15, 4), (15, 20, 13, 16, 4), (18, 34, 13, 17, 4)):
        t = (i - start) % N
        n_a = (y1 - y0) * spd + 1                                  # Kopf läuft von y0 nach y1
        n_b = 3 * spd                                              # Spur holt auf und verschwindet
        if t >= n_a + n_b:
            continue
        if t < n_a:
            kopf = y0 + t // spd
            schwanz = max(y0, kopf - 2)
        else:
            kopf = y1
            schwanz = max(y0, y1 - 2) + (t - n_a) // spd + 1
        for y in range(schwanz, kopf + 1):
            if y <= y1:
                out.append((x, y, y == kopf))
    return out


def koerper(i):
    # Obere Ebene = Schneemann + roter Klecks + grüner Strahl (ohne Pfütze), Pfütze separat
    oben = spr.copy()
    oben[PFUETZE] = 0
    # Randpixel des Körpers unter der Pfütze ergänzen (für die eingefügte Atemzeile)
    oben[ATEMZEILE, 9, :3] = SCHNEE_RAND; oben[ATEMZEILE, 9, 3] = 255
    oben[ATEMZEILE, 10, :3] = SCHNEE_RAND2; oben[ATEMZEILE, 10, 3] = 255
    pf = spr.copy()
    pf[~PFUETZE] = 0
    # Strahl fließt, Pfütze wellt (Frame 0 = Original)
    umschalten(pf, PFUETZE, GELB[1], GELB[2], S_PFUETZE, 4, 16.0 * i / N)
    k = L.platz(oben, H, W, PAD_L, PAD_T)
    pfk = L.platz(pf, H, W, PAD_L, PAD_T)
    # Zweigarme: die Spitze schwenkt um die Wurzel (Länge ≈ Original); ist die Spitze die Originalspitze, bleibt der Originalarm stehen
    atem = E.verlauf3(i, 24, 0.0, 1)
    arme = []
    for basis, frei, ang0, amp, per, ph0, laenge in ((ARM_L_BASIS, ARM_L_FREI, -123.0, 30.0, 24, 0.0, 3.6), (ARM_R_BASIS, ARM_R_FREI, -45.0, 27.0, 32, 1.0, 2.9)):
        ang = ang0 + amp * math.sin(L.sinus(i, per, ph0))
        tip = (int(round(basis[0] + laenge * math.cos(math.radians(ang)))), int(round(basis[1] + laenge * math.sin(math.radians(ang)))))
        orig = frei[0] if frei[0][1] < frei[-1][1] else frei[-1]
        original = tip == (7, 11) or tip == (21, 12)
        if not original:
            for pix in frei:
                Hm.setze(k, {pix: None}, OFF)
            arme.append((basis, tip))
    if atem:
        k = L.streck_zeile(k, PAD_T + ATEMZEILE, atem)
    up = -atem
    for basis, tip in arme:
        bx, by = basis[0], basis[1] + up
        E.zweig_zeichnen(k, OFF, (bx, by), (tip[0], tip[1] + up), ZWEIG)
    # Rote Tropfen (nur auf Körperpixel, Zeilen oberhalb der Atemzeile steigen mit)
    for (x, y, kopf) in tropfen(i):
        yy = y + (up if y < ATEMZEILE else 0)
        X, Y = x + PAD_L, yy + PAD_T
        if k[Y, X, 3] and tuple(int(v) for v in k[Y, X, :3]) not in (ROT, ROT_DUNKEL, ROT_HELL, ZWEIG, (0, 0, 0)):
            k[Y, X, :3] = ROT_DUNKEL if kopf else ROT
    # Pfütze liegt vor dem Körperfuß
    k = L.zusammen(H, W, [(k, 0, 0), (pfk, 0, 0)])
    Hm.kontur_schliessen(k, ERLAUBT, SCHNEE_RAND)
    return k


DUNST = [dict(x=PAD_L + x, y=PAD_T + y, vx=vx, vy=-11, off=o, form=f, wackeln=1.0, ph=p) for (x, y, vx, o, f, p) in
         [(23, 18, 2.0, 0, 'm', 0.0), (25, 15, 1.5, 10, 'o', 0.3), (3, 13, -1.5, 19, 'o', 0.6), (1, 9, -1.0, 28, 'm', 0.1), (6, 13, -1.0, 38, 'm', 0.8)]]
DUNST_FARBEN = {'c': E_, 'r': D_}


def frame(i, nur=None):
    ebenen = []
    if nur is None or 'dunst' in nur:
        ebenen.append((E.dunst_ebene(H, W, i, N, DUNST, DUNST_FARBEN), 0, 0))
    ebenen.append((koerper(i), 0, 0))
    return L.zusammen(H, W, ebenen)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ohne = [frame(i, nur=('koerper',)) for i in range(N)]
    print('Ruhepose weicht vom Original ab bei:', Hm.ruhepose(ohne[0], spr, OFF) or 'nichts')
    L.pruefe(frames, quelle=spr)
    print('Pixel je Frame (Figur):', [int((f[..., 3] > 0).sum()) for f in ohne])
    import anim_amorph as A
    A.ausdruck_pruefen(ohne, spr, 'colored-snow', erlaubt=ERLAUBT)
    L.speichern('mischief-militia-colored-snow', 'Mischief Militia - Colored Snow', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/mischief-militia-colored-snow-strip.png', frames[::2], spalten=12, scale=6)
