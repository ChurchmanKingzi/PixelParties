# -*- coding: utf-8 -*-
"""Idle-Animation für „Yolomungandr, Ender of Coolness“ (Creature) — die riesige Weltenschlange: Leib steigt unten auf, biegt sich im Bogen nach rechts, der Kopf blickt rechts herab.

Quelle: src/yolomungandr-ender-of-coolness.png (80×58 px) = Leib + Cappy + Sonnenbrille + Goldketten zusammengesetzt; einzeln (gleiche Leinwand): …_leib.png, …_cappy.png, …_brille.png, …_ketten.png.
PICK: [["MotiveCoolhalla", 185, 1], ["MotiveCoolhalla", 176, 1], ["MotiveCoolhalla", 174, 1], ["MotiveCoolhalla", 175, 1]]
      185 „Ebene #43“ = die ganze Schlange; 176 „Ebene #46“ (= 178) = das Cappy mit hellem Schriftzug, sitzt auf dem Kopf (x 62–79, y 1–18, verdeckt die Hörner); 174 „Ebene #62“ = die schwarze
      Sonnenbrille (zwei Gläser, x 69–76, y 12–21, über den Augen); 175 „Ebene #61“ = zwei Goldketten, die über den Bogen hängen (x 42–51, y 1–23 und x 54–61, y 4–26).
      Lage jeweils wie in der Motiv-Datei (Runde 8, Nutzerwunsch: „Es fehlen sein Cappy, seine Sonnenbrille und sein Goldschmuck“); so zeigt es auch die Kartenkunst.
      Schatten (173/177) und Blitz-/Stern-Ebenen (180–182) sind Kulisse, nicht übernommen.

Was im Sprite ist (x, y):
* RÜCKEN: Schachbrett aus (112,133,152)/(40,58,70) (streng nach (x+y) gerade/ungerade), Umriss (28,29,33); drei große RÜCKENSTACHELN nach links (y 4–7, y 18–25, y 35–43) und Hörner am Kopf (x 64–76, y 4–10).
* BAUCH: Schachbrett aus (239,208,188)/(145,112,71) mit braunen Segmentlinien (71,43,19).
* KOPF (x 62–79, y 4–25): zwei gelbe AUGEN ((243,217,158)/(195,172,66)/(190,147,34), dunkelrot (54,7,0), Pupillen schwarz) bei (71–74, 15–17) und (74–76, 17–19); weiße ZÄHNE (255,255,255) im offenen Maul (x 67–73, y 19–24).
* SCHWANZENDE: flacher grauer Fleck unten links (x 18–25, y 53–56). Liegt am Boden → völlig still.
  Runde 9 (Nutzer: „Die lange dunkle Linie unten links soll weg“): Die Quellebene lief hier als dünne dunkle Linie nach links aus (x 0–18, y 54–57, dazu der Stummel (19–20, 57)); sie ist aus
  src/…png und src/…_leib.png ENTFERNT (nicht wieder aus der xcf-Ebene holen). Der Fleck ist dort mit drei Umrisspixeln geschlossen: (19,54), (19,55), (20,56) in (28,29,33).

Ablauf (72 Frames à 80 ms = 5,76 s – riesiges Wesen, langsam; nahtlos, Frame 0 = Original):
* KOPF WIEGEN (Idle-Idee: die Schlange wiegt ihren Kopf wie eine Kobra in einer liegenden Acht): der Leib schwingt seitlich (Zeilenversatz, unten y ≥ 50 fest, nach oben bis ±2 px, oberhalb y 26 einheitlich – Periode 72),
  der Bogen hebt/senkt den Kopf (ein bis zwei Versatzstufen zwischen x 49 und x 63, ±2 px am Kopf – Periode 36; die Stufen liegen dort, wo am wenigsten Zacken im Umriss entstehen – `beste_grenzen`). Der KOPF (x ≥ 64) bewegt sich dabei als starre Einheit (Hörner, Augen, Zähne unverändert zueinander).
  Gefälle höchstens 1 px je mehrere Zeilen/Spalten, nichts wird gestreckt oder kopiert.
* Das Schachbrett-Muster von Rücken und Bauch wird nach jeder Verschiebung wieder am festen Raster ausgerichtet (kein Flimmern/keine Doppelspalten an den Versatzstufen); Segmentlinien, Augen, Zähne wandern mit.
* Wird an einer Versatzstufe ein Innenpixel zur Außenkante, bekommt es die Umrissfarbe (Umriss bleibt geschlossen, 1 px).
* CAPPY + SONNENBRILLE gehen starr mit dem Kopf mit (gleicher Versatz wie der Kopf, liegen als eigene Ebenen über dem fertigen Leib – werden nie verbogen).
* GOLDKETTEN: jede Kette ist eine starre Einheit und folgt dem Bogen an ihrer Auflagestelle (x 49 bzw. x 58). Kurzer Goldglanz: einmal je Schleife läuft ein schmales Lichtband über beide Ketten
  (Frames 8–21; nur Goldpixel, eine Stufe heller auf der Goldrampe der Kette, dunkler Umriss bleibt), dazu je Kette ein 3-Frame-Sparkle am unteren Bogen (Frames 40–42 bzw. 58–60).
Kein Blinzeln (Sonnenbrille), keine Partikel. Ergänzungen: keine. Farben: nur Quelle.
RUNDE 10 (Nutzer: „Soll periodisch das Maul öffnen.“): Der Kopf blickt nach rechts unten; Oberkopf/Schnauze = der graublaue Teil mit den Augen (x 70–76, y 15–23), UNTERKIEFER = das helle Bauchstück
(x 61–72, y 18–25) mit seinen Zähnen (68,20), (71,23), (72,24); obere Zähne (69,19), (71,20)+(70,21) (Fangzahn), (72,22), (73,23). Kiefergelenk = der Mundwinkel in Zeile 17 (Umriss x 67–69).
Zweimal je Schleife (Start Frame 14 und 50, je 22 Frames) klappt der Unterkiefer als POSE um das Gelenk auf: seine Zeilen 18–25 wandern stufenweise vom Oberkiefer weg nach links (Zeile 18 nie, die Kieferspitze
bis 4 px; Gefälle höchstens 1 px je Zeile, nichts wird gestreckt, die unteren Zähne gehen mit). Zeile 17/18 bleibt stehen → keine Lücke am Gelenk. Der frei werdende Rachen zwischen den Kiefern (Zeilen 18–23)
wird im Dunkelrot (54,7,0) der Augen-Ebene gefüllt (Farbe der Leib-Quelle, im Komposit von der Brille verdeckt → in pruefe freigegeben); die weißen Zähne bleiben davor sichtbar. In der Ruhepose bleibt das
Maul wie im Original (schmaler, durchsichtiger Spalt). Cappy und Sonnenbrille sitzen unverändert starr am Oberkopf. Die Pose wird VOR dem Wiegen auf den Leib gezeichnet und macht alle Kopfbewegungen mit.
"""
import math

import numpy as np

import anim_cool as C
import anim_humanoide as Hm
import anim_lib as L
import anim_n1 as N1

N, MS = 72, 80
SLUG = 'yolomungandr-ender-of-coolness'
spr = L.lade(SLUG)
LEIB, CAP, BRILLE, KETTEN = (L.lade(SLUG + '_' + t) for t in ('leib', 'cappy', 'brille', 'ketten'))
S = N1.Szene(spr, (5, 6, 5, 3))
H, W, OFF = S.H, S.W, S.OFF
PL, PT = OFF
BASIS = L.platz(LEIB, H, W, PL, PT)
# --- Maul (Runde 10): Unterkiefer als Pose um das Gelenk in Zeile 17 ---
RACHEN = (54, 7, 0)
KIEFER = {18: (61, 67), 19: (62, 67), 20: (63, 68), 21: (64, 68), 22: (65, 69), 23: (66, 71), 24: (68, 72), 25: (69, 71)}   # Zeile → Spalten (von, bis) des Unterkiefers samt unterer Zähne
OBERKANTE = {18: 70, 19: 71, 20: 71, 21: 73, 22: 72, 23: 73}                # Zeile → erste Spalte des Oberkiefers (inkl. oberer Zähne außer den frei stehenden (69,19), (70,21))
KLAPP = {1: (0, 0, 0, 0, 1, 1, 1, 1), 2: (0, 0, 1, 1, 1, 2, 2, 2), 3: (0, 1, 1, 2, 2, 2, 3, 3), 4: (0, 1, 1, 2, 2, 3, 3, 4)}   # Öffnung → Linksversatz der Zeilen 18…25
MAUL = (1, 1, 2, 2, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 2, 2, 1, 1)
MAUL_START = (14, 50)


def maul_basis(k):
    """Leib mit um k (0–4) geöffnetem Maul: Unterkieferzeilen nach links versetzt, Rachen dunkelrot gefüllt."""
    if not k:
        return BASIS
    a = BASIS.copy()
    for j, y in enumerate(range(18, 26)):
        x0, x1 = KIEFER[y]
        d = KLAPP[k][j]
        stueck = BASIS[PT + y, PL + x0:PL + x1 + 1].copy()
        a[PT + y, PL + x0:PL + x1 + 1] = 0
        a[PT + y, PL + x0 - d:PL + x1 + 1 - d] = stueck
        if y in OBERKANTE:
            for x in range(x1 + 1 - d, OBERKANTE[y]):
                if not a[PT + y, PL + x, 3]:
                    a[PT + y, PL + x] = RACHEN + (255,)
    return a


BASEN = [maul_basis(k) for k in range(5)]
E_KOPFZEUG = L.platz(np.where((BRILLE[..., 3:] > 0), BRILLE, CAP), H, W, PL, PT)
# zwei Ketten (starr), Auflagespalte = oberstes Kettenglied
KETTE = [(L.platz(np.where((S.xx <= 52)[..., None], KETTEN, 0).astype(np.uint8), H, W, PL, PT), 49),
         (L.platz(np.where((S.xx > 52)[..., None], KETTEN, 0).astype(np.uint8), H, W, PL, PT), 58)]
GOLD = {(160, 101, 0): (255, 216, 79), (255, 216, 79): (254, 245, 142)}
HELL = (254, 245, 142)
FUNKEL = [((43, 20), 40), ((60, 20), 58)]                  # (Sprite-Pixel am unteren Kettenbogen, Startframe)
for (fx, fy), _ in FUNKEL:
    assert tuple(int(v) for v in KETTEN[fy, fx, :3]) in ((255, 216, 79), HELL), KETTEN[fy, fx]
B1, B2 = (112, 133, 152), (40, 58, 70)
T1, T2 = (239, 208, 188), (145, 112, 71)
UMRISS = (28, 29, 33)
INNEN = {B1, B2, T1, T2, (71, 43, 19)}
TEST_EBENEN = 'koerper'


def r(v):
    return int(math.floor(v + 0.5))


def glatt(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def kanten(a):
    """Je Spalte: oberste Pixelzeile, oberste Bauchzeile, unterste Pixelzeile des Bogens (nur Bogenbereich)."""
    out = []
    for x in range(PL + 44, PL + 70):
        ys = np.nonzero(a[:PT + 30, x, 3])[0]
        tan = [y for y in ys if tuple(int(v) for v in a[y, x, :3]) in (T1, T2)]
        out.append((int(ys.min()), min(tan) if tan else -1, int(ys.max())))
    return out


def hoecker(a):
    """Zahl der 1–2 Spalten breiten Zacken/Kerben in den drei Kantenzügen (Maß für unruhige Versatzstufen)."""
    k = kanten(a)
    n = 0
    for j in range(3):
        e = [v[j] for v in k]
        for q in range(1, len(e) - 2):
            if e[q] != e[q - 1] and e[q + 1] == e[q - 1]:
                n += 2
            elif e[q] != e[q - 1] and e[q] == e[q + 1] and e[q + 2] == e[q - 1]:
                n += 1
    return n


def heben(a, grenzen, vz):
    """Spalten ab jeder Grenze (Leinwandspalte) um je 1 px weiter in Richtung vz versetzen (Bogen/Kopf als Hebel; der Kopf rechts aller Grenzen bleibt starr)."""
    return N1.spalten_dy(a, lambda x: vz * sum(1 for g in grenzen if x >= g))


def beste_grenzen(k, vz):
    """Die k Versatzstufen so legen (zwischen x 49 und x 63, vor dem Kopf), dass möglichst keine Zacken entstehen."""
    import itertools
    best = None
    for gs in itertools.combinations(range(PL + 49, PL + 64), k):
        if any(q - p < 4 for p, q in zip(gs, gs[1:])):
            continue
        sc = hoecker(heben(BASIS, gs, vz))
        if best is None or sc < best[0]:
            best = (sc, gs)
    return best[1]


GRENZEN = {(k, vz): beste_grenzen(k, vz) for k in (1, 2) for vz in (-1, 1)}


def frame(i, nur=None):
    th = L.sinus(i, N)
    ax, ay = 2.0 * math.sin(th), 2.0 * math.sin(2 * th)
    dx_oben = r(ax)
    maul = 0
    for m0 in MAUL_START:
        if m0 <= i < m0 + len(MAUL):
            maul = MAUL[i - m0]
    a = N1.zeilen_dx(BASEN[maul], lambda y: r(ax * glatt((50 - (y - PT)) / 24.0)))
    kopf = r(ay)
    if kopf:
        gs = [g + dx_oben for g in GRENZEN[(abs(kopf), 1 if kopf > 0 else -1)]]
        a = heben(a, gs, 1 if kopf > 0 else -1)
    horn = (PT + 5 + kopf, PL + 67 + dx_oben)             # die Hornspitze (67,5) ist schon im Original ein helles Randpixel und bleibt es
    for y, x in zip(*np.nonzero(Hm.kantenmaske(a))):
        if y < PT + 52 and (y, x) != horn and tuple(int(v) for v in a[y, x, :3]) in INNEN:
            a[y, x, :3] = UMRISS
    # Schachbrett am festen Raster ausrichten (nur oberhalb des ruhenden Schwanzendes)
    for y in range(PT + 52):
        for x in np.nonzero(a[y, :, 3])[0]:
            c = tuple(int(v) for v in a[y, x, :3])
            g = (x - PL + y - PT) % 2 == 0
            if c in (B1, B2):
                a[y, x, :3] = B1 if g else B2
            elif c in (T1, T2):
                a[y, x, :3] = T1 if g else T2
    a[horn[0], horn[1], :3] = B1
    # Schmuck und Kopfbedeckung: starre Ebenen über dem Leib
    gs0 = GRENZEN[(abs(kopf), 1 if kopf > 0 else -1)] if kopf else ()
    vz = 1 if kopf > 0 else -1
    band = (i - 8) * 3 + 14 if 8 <= i <= 21 else None      # Lichtband: Diagonale x − y (Sprite), wandert von links nach rechts
    for k, (e, ax_) in enumerate(KETTE):
        e = e.copy()
        if band is not None:
            for y, x in zip(*np.nonzero(e[..., 3])):
                c = tuple(int(v) for v in e[y, x, :3])
                if c in GOLD and abs((x - PL) - (y - PT) - band) <= 1:
                    e[y, x, :3] = GOLD[c]
        dyk = vz * sum(1 for g in gs0 if PL + ax_ >= g)
        e = L.versetze(e, dx_oben, dyk)
        m = e[..., 3] > 0
        a[m] = e[m]
        (fx, fy), f0 = FUNKEL[k]
        if f0 <= i < f0 + 3:
            N1.funkel(a, PL + fx + dx_oben, PT + fy + dyk, (0, 1, 0)[i - f0], HELL, HELL)
    e = L.versetze(E_KOPFZEUG, dx_oben, kopf)
    m = e[..., 3] > 0
    a[m] = e[m]
    return a


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    C.abschluss(SLUG, 'Yolomungandr, Ender of Coolness', frames, MS, spr, OFF, C.vorschau_arg(), erlaubt=[RACHEN], ecken=False)
