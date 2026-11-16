# -*- coding: utf-8 -*-
"""Idle-Animation für „Cardinal Beast Qinglong“ (Creature) — der Azurdrache des Ostens: ein langer, blassblauer Wolken-/Sturmdrache mit schwarzem Umriss, dessen Kopf vorn links über einem
gehörnten Schädel schwebt; um ihn zucken Blitze.

Quellen: src/cardinal-beast-qinglong.png (Drache + Schädel, 64×54 px, 12 Farben) und src/cardinal-beast-qinglong-blitze.png (die Blitze auf der 80×73-Leinwand der Karte, 8 Farben).
PICK: [["Motive", 1548, 1], ["Motive", 1546, "im Drachen enthalten"], ["Motive", 1547, "Blitze"], ["Motive", 1544, "gelber Blitz"]]
      Gewählt wurde die Ebene „QINLONG #1“ (1548, 64×54 px): der fertig umrandete Drache INKLUSIVE Schädel/Hörnern (Ebene „QINLONG #4“, 1546, ist derselbe Schädel einzeln).
      Der Treffer des Suchlaufs (Ebene 1545 „QINLONG #6“) ist dieselbe Figur in der weich ausgeblendeten Kartenvariante (10 % durchsichtig, Dither-Innenfläche, Schweif läuft per Alpha-Verlauf
      aus, kein Umriss) — das ergäbe halbtransparente Pixel; 1548 ist die saubere Pixelart-Fassung mit geschlossenem schwarzem Umriss. Ebene 1549 („QINLONG“) sind die dunklen Sturmwolken des
      Hintergrunds, Ebene 1543 („QINLONG #2“) zwei blaue Bögen — beides Szene, nicht verwendet.
Quelle vollständig: ja (Drache mit Kopf, Schädel, Schweif, Blitze); die Blitze sind in der Kunst Teil der Karte und deshalb als eigene Ebene (Datei -blitze) mit dabei.

Aufruf:   python3 cardinal_beast_qinglong.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/cardinal-beast-qinglong.png + .json

Identifikation (Drache, x/y im 64×54-Sprite; die Leinwand der Karte beginnt 7 px links und 3 px oberhalb):
* KÖRPER (x 6–63, y 0–38): langer Schlangenleib mit schwarzem Umriss (0,0,0); Füllung blassblau (197,211,219), Schattenband mittelblau (131,170,195), Lichter (230,252,255); er kommt vom Kopf links
  unten, zieht nach rechts und steigt als breiter Schweif (x 43–63) senkrecht nach oben, dessen Ende (y 0–8) sich spitz nach links auszieht.
* KOPF (x 6–22, y 19–37): runder Kopf; die zornigen AUGEN (x 8–11 und 17–20, y 29–35) sind zwei kleine X-Zeichen aus Dunkelgrau/Rosa/Weiß ((93,82,90)/(221,204,208)/(255,255,255)) — sie lesen
  sich als Augen, bleiben aber fest (kein Blinzeln: Rückfrage-Punkt).
* SCHÄDEL (x 0–27, y 33–53): hellgrauer, gehörnter Schädel/Kiefer (128,128,128)/(179,179,179)/(204,204,204)/(242,242,242) mit zwei nach oben gebogenen weißen Hörnern (x 0–2 und 25–27, y 33–41);
  er hängt unter dem Kopf.
* BLITZE (Datei -blitze, 80×73): drei lange, verzweigte cyanfarbene Blitzstämme ((0,255,255) mit weißen Kernen) links, in der Mitte und rechts; links davor ein dicker gelber Blitz
  ((255,221,128)/(237,187,92)/(254,255,218)) mit kleinen Cyan-Funken.
Metall/Gold/Edelsteine: keine (Knochenschädel) → kein Glanz (Regel 14).

Ablauf (48 Frames à 70 ms = 3,36 s, nahtlos):
* KÖRPER (Runde 4: „Oben das ‚Ende‘ des Körpers, das eigentlich aus den Wolken ragt, stellt den Ankerpunkt dar!“): das obere Körperende (senkrechter Schweif samt Bogen x ≥ 44 und die ausgezogene Spitze x 30–43, y ≤ 16)
  steht völlig still (kein Schweben, kein Schwenken der Spitze mehr). Von dort nimmt die Bewegung zum Kopf hin zu: die Spalten x 43 … 22 wandern senkrecht mit wachsender Amplitude (Hebel um den Anker, ±3 px am Hals,
  Periode 24, dazu eine kleine Gegenwelle in der Leibmitte, Spalten 4-verbunden); der Kopf (x ≤ 22) geht starr mit dem Hals mit, Schädel, Bart und gelber Blitz hängen an ihm.
* AUGEN (Runde 4: „Er soll mit allen vier Augen blinzeln“): alle vier Winkel-Augen (oben x 8–10 / 17–19, y 29–31; unten x 9–11 / 16–18, y 33–35) blinzeln gleichzeitig, Frames 9–12 und 31–34 (Lid = Körperblau (197,211,219),
  geschlossen = Lidlinie (93,82,90) in der unteren Augenzeile). Die frühere Angabe „kein Blinzeln“ oben ist überholt.
* GELBER BLITZ (Runde 3: „gehört fest zum Sprite und soll permanent bleiben“): liegt wie in der Kartenkunst VOR dem Kopf, ist in JEDEM Frame sichtbar, folgt dem Kopf und bekommt zweimal je
  Schleife einen Leuchtpuls (ein 5 Zeilen hohes Band läuft von der Spitze zum Kopf, Farben eine Stufe heller auf der Rampe des Blitzes).
* BART (Runde 4: „nahtlos zu dem, was schon an Bart da ist – das Graue ist schon ein Bart, kein Kinn; nur nach unten weiterführen und nach und nach verjüngen“): der vorhandene graue Bart (Zeilen 45–50, zuletzt 8 px breit,
  x 10–17, Aufbau Umriss | Schatten | Fläche | Schatten | Umriss) wird ab Zeile 51 (statt Abschlussumriss + Stiel) in genau diesem Aufbau 26 Zeilen weitergeführt und läuft allmählich spitz zu (siehe BART_ZEILEN); keine
  Verbreiterung, keine neuen Strähnenlinien/Lichter. Er weht: eine Welle läuft vom Ansatz (dort 0) zur Spitze (bis ±3 px, Gefälle ≤ 1 px je Zeile). Der Bart folgt dem Kopf.
* BLITZE (Regel 15 gilt nur für Feuer; Blitze sind harte Ein/Aus-Blitze in Pixelart): die drei cyanfarbenen Blitzstämme leuchten nur kurz in zuckenden Schüben auf und sind sonst aus — links Frames 0–3, 5–6, 27–30;
  Mitte 0–3, 15–17, 36–40; rechts 0–4, 21–24, 43–46; die kleinen Cyan-Funken beim gelben Blitz 0–2, 4–5, 31–34. In Frame 0 sind alle Blitze an (Original).
Keine zusätzlichen Partikel. Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quellen.
Zuschnitt: symmetrisch um die Ruhefigur (Drache + Blitze); die Welle darf den Frame höchstens 3 px vergrößern.
Ergänzungen: keine (die Blitze liegen hinter dem Drachen; die wenigen Blitzpixel, die er in der Ruhepose verdeckt, fehlen auch in der Kunst).
"""
import math
import os
import sys

import cv2
import numpy as np
from PIL import Image

import anim_amorph as A
import anim_flieger_b as FB
import anim_gbb as G
import anim_humanoide as Hm
import anim_lib as L
import anim_untote as U

N, MS = 48, 70
GPL, GPR, GPT, GPB = 8, 8, 8, 12
DX, DY = 7, 3                                                                  # Lage des Drachen auf der 80×73-Kartenleinwand

spr = L.lade('cardinal-beast-qinglong')
BLITZ = np.array(Image.open(os.path.join(L.SRC, 'cardinal-beast-qinglong-blitze.png')).convert('RGBA'))
sh, sw = spr.shape[:2]
KH, KW = BLITZ.shape[:2]
H, W = KH + GPT + GPB, KW + GPL + GPR
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
UMRISS = (0, 0, 0)
ERLAUBT = Hm.umrissfarben(spr)

SCHAEDEL_ALT = (vorhanden & L.farbmaske(spr, [(128, 128, 128), (179, 179, 179), (204, 204, 204), (242, 242, 242)]))
BART_Y0 = 51                                                                   # ab dieser Sprite-Zeile ersetzt der selbstgezeichnete Rauschebart die Kinnspitze (Zeile 51 Abschlussumriss + Stiel (11,52–53))
SCHAEDEL = SCHAEDEL_ALT & (yy < BART_Y0)
KOERPER = vorhanden & ~SCHAEDEL_ALT
HALS_X = 22


def teil(m):
    t, _ = L.trenne(spr, m)
    return L.platz(t, H, W, GPL + DX, GPT + DY)


KOERPER0, SCHAEDEL0 = teil(KOERPER), teil(SCHAEDEL)

# ── Blitze: Zusammenhangskomponenten der Blitzebene, nach Lage/Farbe zu vier Gruppen geordnet ──
n_, lab, st, _ = cv2.connectedComponentsWithStats((BLITZ[..., 3] > 0).astype(np.uint8), connectivity=8)
GELB_C = [(237, 187, 92), (254, 255, 218), (255, 221, 128)]
gelb_m = L.farbmaske(BLITZ, GELB_C)
grp = np.zeros((KH, KW), np.int8)                                              # 1 links, 2 gelb+Funken, 3 Mitte, 4 rechts
for k in range(1, n_):
    comp = lab == k
    cx = st[k, 0] + st[k, 2] / 2.0
    if st[k, 4] > 200:
        grp[comp] = 1 if cx < 30 else (3 if cx < 60 else 4)
    else:
        grp[comp] = 2
grp[gelb_m] = 2
FUNKEN_M = (grp == 2) & ~gelb_m                                                # die kleinen Cyan-Funken um den gelben Blitz (zucken weiter ein/aus)
BLITZ_G = {g: L.platz(np.where(((grp == g) & ~gelb_m)[..., None], BLITZ, 0).astype(np.uint8), H, W, GPL, GPT) for g in (1, 2, 3, 4)}
GELB0 = L.platz(np.where(gelb_m[..., None], BLITZ, 0).astype(np.uint8), H, W, GPL, GPT)   # der gelbe Blitz gehört fest zum Sprite (liegt VOR dem Kopf, bleibt immer sichtbar)
AN = {1: {0, 1, 2, 3, 5, 6, 27, 28, 29, 30},
      2: {0, 1, 2, 4, 5, 31, 32, 33, 34},
      3: {0, 1, 2, 3, 15, 16, 17, 36, 37, 38, 39, 40},
      4: {0, 1, 2, 3, 4, 21, 22, 23, 24, 43, 44, 45, 46}}


# ── Rauschebart (Nutzer-Feedback Runde 3: „Den Bart sollst du nach unten selbstständig weiterzeichnen, ein langer weißer Rauschebart!“) ──
# Die graue Kinnspitze des Schädels (Sprite-Zeilen 45–51) ist der Bart. Er wird ab Zeile 51 selbst weitergezeichnet: ein langer, zottiger, leicht S-förmig geschwungener Strang
# (Sprite-Zeilen 51–75, erst breiter, dann zur Spitze auslaufend) mit welligen Strähnenlinien. Farben nur aus dem Schädel (Umriss (128,128,128), Schatten (179,179,179), Fläche (204,204,204),
# Licht (242,242,242)); Umriss nur außen (1 px, nie doppelt). Er weht: eine Welle läuft vom Kinn zur Spitze (Zeilenversatz, Gefälle ≤ 1 px je Zeile), die Strähnen hängen an den Zeilen.
BART_J, BART_K, BART_L, BART_I = (128, 128, 128), (179, 179, 179), (204, 204, 204), (242, 242, 242)
# Runde 4 („Der neue Bart muss nahtlos zu dem passen, was schon an Bart da ist – das Graue ist schon ein Bart, kein Kinn, du musst ihn nur nach unten weiterführen und nach und nach verjüngen“):
# Der vorhandene graue Bart endet in den Sprite-Zeilen 49–50 als 8 px breiter Strang x 10–17 mit dem Aufbau Umriss (128) | Schatten (179, links 2 px, rechts 1 px) | Fläche (204) | Schatten | Umriss.
# Genau dieser Aufbau wird ab Zeile 51 Zeile für Zeile fortgesetzt (keine neuen Strähnenlinien, keine Lichter, keine Verbreiterung) und verjüngt sich allmählich: je 4 Zeilen 8/7/6/5 px, je 3 Zeilen 4/3 px,
# dann 2 Zeilen 2 px und 2 Zeilen 1 px (Spitze in Umrissgrau wie der alte Stiel (11,52–53)). Abwechselnd rechts und links fällt 1 px weg, die Mitte bleibt bei x ≈ 13.
_J, _K, _L = BART_J, BART_K, BART_L
BART_ZEILEN = ([(10, (_J, _K, _K, _L, _L, _L, _K, _J))] * 4 + [(10, (_J, _K, _K, _L, _L, _K, _J))] * 4 + [(11, (_J, _K, _L, _L, _K, _J))] * 4 + [(11, (_J, _K, _L, _K, _J))] * 4
               + [(12, (_J, _K, _L, _J))] * 3 + [(12, (_J, _K, _J))] * 3 + [(13, (_J, _J))] * 2 + [(13, (_J,))] * 2)
BART_R = len(BART_ZEILEN)


def bart_zeile(r, dx):
    """Pixel (x, Farbe) der Bartzeile r (Sprite-Zeile 51 + r), um dx verschoben."""
    x0, cs = BART_ZEILEN[r]
    return [(x0 + dx + p, c) for p, c in enumerate(cs)]


def bart_dx(i):
    """{r: dx} Welle vom Kinn (r 0) zur Spitze: Amplitude wächst mit dem Abstand (bis ±3 px), die Spitze hinkt nach; dazu eine zweite, schnellere Welle (Periode 24) in der unteren Hälfte."""
    ph = L.sinus(i, 48)
    ph2 = L.sinus(i, 24)
    d = {}
    for r in range(BART_R):
        f = (r + 1) / BART_R
        v = 2.4 * f ** 1.3 * math.sin(ph - 0.20 * r) + 0.9 * max(0.0, f - 0.4) * math.sin(ph2 - 0.45 * r + 1.0)
        d[r] = int(round(v))
    d[0] = 0                                                                    # nahtloser Anschluss an den vorhandenen Bart (Zeile 50 steht)
    for r in range(1, BART_R):                                                  # Gefälle ≤ 1 px je Zeile; wo der Strang schmaler wird, kein zusätzlicher Versatz (Umriss bleibt wie im Original diagonal geschlossen, 1 px)
        lim = 0 if len(BART_ZEILEN[r][1]) != len(BART_ZEILEN[r - 1][1]) else 1
        d[r] = max(d[r - 1] - lim, min(d[r - 1] + lim, d[r]))
    return d


BART_MUSTER = {len(cs): cs for _, cs in BART_ZEILEN}                            # Zeilenaufbau je Breite (Umriss | Schatten | Fläche | Schatten | Umriss)


def bart_ebene(i):
    """Rauschebart als Ebene auf der großen Leinwand (ohne Kopfbewegung `bob`). Je Zeile linker/rechter Rand aus Ruheform + Wellenversatz; einzelne Zeilen, die dadurch 1 px über BEIDE Nachbarzeilen
    hinausstünden (Zacke am Umriss), werden an dieser Seite um 1 px gekürzt — der Umriss bleibt glatt und 1 px stark."""
    a = L.leer(H, W)
    ox, oy = GPL + DX, GPT + DY + BART_Y0
    dxs = bart_dx(i)
    xl = [BART_ZEILEN[r][0] + dxs[r] for r in range(BART_R)]
    xr = [xl[r] + len(BART_ZEILEN[r][1]) - 1 for r in range(BART_R)]
    xl0, xr0 = [10] + xl, [17] + xr                                             # Zeile 50 des Sprites als oberer Nachbar
    for r in range(BART_R - 1):
        if xl[r] < min(xl0[r], xl[r + 1]) and xr[r] > xl[r]:
            xl[r] += 1
        if xr[r] > max(xr0[r], xr[r + 1]) and xr[r] > xl[r]:
            xr[r] -= 1
    for r in range(BART_R - 1):                                                 # ebenso Kerben (Zeile 1 px schmaler als beide Nachbarn) schließen
        xl0, xr0 = [10] + xl, [17] + xr
        if xl[r] > max(xl0[r], xl[r + 1]) and xr[r] - xl[r] + 2 in BART_MUSTER:
            xl[r] -= 1
        if xr[r] < min(xr0[r], xr[r + 1]) and xr[r] - xl[r] + 2 in BART_MUSTER:
            xr[r] += 1
    for r in range(BART_R):
        for p_, c in enumerate(BART_MUSTER[xr[r] - xl[r] + 1]):
            x = xl[r] + p_
            if not (0 <= oy + r < H and 0 <= ox + x < W):
                raise L.ClipError(f'Bartpixel ({x},{r}) außerhalb der Leinwand')
            a[oy + r, ox + x, :3] = c
            a[oy + r, ox + x, 3] = 255
    return a


# ── Gelber Blitz: fester Bestandteil des Sprites (liegt vor dem Kopf, bleibt dauerhaft sichtbar), ein Puls läuft ihn hinunter ──
GELB_STUFE = {(237, 187, 92): (255, 221, 128), (255, 221, 128): (254, 255, 218)}     # eine Stufe heller


def gelb_ebene(i):
    a = GELB0.copy()
    ys = np.nonzero(a[..., 3].any(axis=1))[0]
    y0, y1 = int(ys.min()), int(ys.max())
    t = (i % 24) / 12.0                                                         # Puls alle 24 Frames (zweimal je Schleife), läuft in 12 Frames hinab, dann Pause
    if t < 1.0:
        yc = y0 + t * (y1 - y0 + 6) - 3
        for y in range(y0, y1 + 1):
            if abs(y - yc) <= 2.0:
                for x in np.nonzero(a[y, :, 3])[0]:
                    c = tuple(int(v) for v in a[y, x, :3])
                    if c in GELB_STUFE:
                        a[y, x, :3] = GELB_STUFE[c]
    return a


# ── Körper (Runde 4: „Oben das ‚Ende‘ des Körpers, das eigentlich aus den Wolken ragt, stellt den Ankerpunkt dar!“) ──
# Das obere Körperende (der senkrechte Schweif samt Bogen, x ≥ 44, und die nach links ausgezogene Spitze x 30–43, y ≤ 16) steht völlig still. Von dort nimmt die Bewegung zum Kopf hin zu:
# die Spalten x 43 … 22 wandern senkrecht mit wachsender Amplitude (0 am Anker, ±3 px am Hals, laufende Welle Richtung Kopf), der Kopf (x ≤ 22) geht als starrer Block mit dem Hals mit;
# Schädel, Bart und gelber Blitz hängen am Kopf und folgen ihm um denselben Betrag.
ANKER_X = 44
FEST_M = KOERPER & ((xx >= ANKER_X) | ((yy <= 16) & (xx >= 30)))
BEWEGT_M = KOERPER & ~FEST_M
FEST0, BEWEGT0 = teil(FEST_M), teil(BEWEGT_M)
C_, D_, E_ = (197, 211, 219), (131, 170, 195), (93, 82, 90)
# Vier Augen (Runde 4: „Er soll mit allen vier Augen blinzeln“): je ein kleines Winkelzeichen; (obere Zeilen → Lid in Körperfarbe, untere Zeile → geschlossene Lidlinie)
AUGEN = [([(8, 29)], [(8, 30), (9, 30)], [(8, 31), (9, 31), (10, 31)]), ([(19, 29)], [(19, 30), (18, 30)], [(19, 31), (18, 31), (17, 31)]),
         ([(9, 33)], [(9, 34), (10, 34)], [(9, 35), (10, 35), (11, 35)]), ([(18, 33)], [(18, 34), (17, 34)], [(18, 35), (17, 35), (16, 35)])]
BLINK = [(9, [1, 2, 2, 1]), (31, [1, 2, 2, 1])]


def kopf_dy(i, fr=1.0):
    ph = L.sinus(i, 24)
    fr = min(1.0, fr)
    return 3.0 * fr ** 1.3 * math.sin(ph) + 0.7 * math.sin(math.pi * fr) * math.sin(2 * ph)   # Hebel um den Anker (±3 px am Kopf) + kleine Gegenwelle in der Leibmitte; Frame 0 überall 0


def drache(i):
    bw = BEWEGT0
    k = None
    for st_, w in BLINK:
        k = k or Hm.folge(i, st_, w, N)
    if k:
        bw = bw.copy()
        pix = {}
        for (o, m, u) in AUGEN:
            pix.update({p_: C_ for p_ in o})
            if k == 2:
                pix.update({p_: C_ for p_ in m})
                pix.update({p_: E_ for p_ in u})
        Hm.setze(bw, pix, (GPL + DX, GPT + DY))
    bw = FB.spalten_schub_4verbunden(bw, GPL + DX + ANKER_X, lambda fr: kopf_dy(i, fr), maxd=ANKER_X - HALS_X)
    bob = int(round(kopf_dy(i, 1.0)))
    return L.zusammen(H, W, [(FEST0, 0, 0), (bw, 0, 0)]), SCHAEDEL0, bob


def frame_gross(i, nur=None):
    kp, sk, bob = drache(i)
    dr = L.zusammen(H, W, [(sk, 0, bob), (bart_ebene(i), 0, bob), (kp, 0, 0)])
    G.rand_schliessen(dr, ERLAUBT, UMRISS)                                      # Regel 16: Spaltenstufen legen Füllfarbe an der Kante frei → Umrissschwarz (Bart/Schädel: nur Grau-Umrisse)
    ebenen = []
    if not nur:
        for g in (1, 3, 4, 2):
            if i % N in AN[g]:
                ebenen.append((BLITZ_G[g], 0, 0))
    return L.zusammen(H, W, ebenen + [(dr, 0, 0), (gelb_ebene(i), 0, bob)])


def _frames(nur):
    return [frame_gross(i, nur) for i in range(N)]


TEST_EBENEN = ('drache',)
BOX = U.zuschnitt(_frames(None), _frames(TEST_EBENEN), (GPL, GPT, GPL + KW, max(GPT + KH, GPT + DY + BART_Y0 + BART_R)), zugabe=3, rand=2)
PAD_L, PAD_T = GPL - BOX[0], GPT - BOX[1]


def frame(i, nur=None):
    return U.beschneiden(frame_gross(i, nur), BOX)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    quelle = np.concatenate([spr.reshape(-1, 4), BLITZ.reshape(-1, 4)]).reshape(-1, 1, 4)
    n = L.pruefe(frames, quelle=quelle, min_rand=2)
    print('Pixel je Frame:', n)
    # Ruhepose = Original (Drache + Schädel + alle Blitze)
    orig = L.leer(H, W)
    orig = L.zusammen(H, W, [(BLITZ_G[1], 0, 0), (BLITZ_G[3], 0, 0), (BLITZ_G[4], 0, 0), (BLITZ_G[2], 0, 0), (SCHAEDEL0, 0, 0), (KOERPER0, 0, 0), (GELB0, 0, 0)])
    f0 = frame_gross(0)
    bart_ab = GPT + DY + BART_Y0
    dif = (np.abs(f0.astype(int) - orig.astype(int)).sum(axis=2) > 0)
    print('Ruhepose weicht vom Original ab bei', int(dif[:bart_ab].sum()), 'Pixeln oberhalb des neuen Barts (Sprite-Zeile < %d); darunter: neuer Bart' % BART_Y0)
    L.speichern('cardinal-beast-qinglong', 'Cardinal Beast Qinglong', frames, MS, prev)
    if prev:
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/cardinal-beast-qinglong-strip.png', frames, spalten=8, scale=3)
