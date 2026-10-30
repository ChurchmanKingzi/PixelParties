# -*- coding: utf-8 -*-
"""Idle-Animation für „Mischief Militia - Chilly Dog“ (Creature).

Quelle: src/mischief-militia-chilly-dog.png — weißer Hund im Profil mit rotem Schal (19×17 px), aus MotiveRussia.xcf:
Ebene 15 „Chilly Dog“ (Hund, 17×18, bei (179,186)) + Ebene 13 „Ebene #169“ (Schal samt fünf schwarzen Gesichtspixeln, 16×9, bei (178,189), im Original zu 90 %
deckend, hier deckend übernommen). Zusätzlich src/mischief-militia-chilly-dog-hund.png = nur der Hund (Ebene 15) auf derselben Leinwand, damit sichtbar wird,
was unter dem Schal liegt (Regel 2). Die Ebene 14 „Ebene #168“ (halbtransparenter Schneehaufen an den Füßen) gehört zu zehn Karten gemeinsam und ist keine
Creature-Grafik — nicht verwendet.
PICK: [["MotiveRussia", 15, 1], ["MotiveRussia", 13, 1]]

Aufruf:   python3 mischief_militia_chilly_dog.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/mischief-militia-chilly-dog.png + .json

Identifikation (Sprite 19×17, Hund nach rechts blickend, weiß-lavendel mit blauvioletten Umrissen A (121,120,207)):
* Ohr: spitz nach oben, Spitze (10,0), Zeilen 0–5, x 10–15; die dunklen Pixel (12,3) (13,3) (11,4) darin liegen in der Schal-Ebene und sind im Kartenbild
  sichtbar (schwarzes Ohrinneres) — gehören zum Kopf und bleiben fest mit ihm verbunden.
* Auge: zwei blaugraue Pixel übereinander (14,5) (14,6); das obere und der Umriss davor (13,5) sind im Kartenbild schwarz überdeckt (Schal-Ebene) — das Auge
  liest sich als schwarzer Strich über dem blaugrauen Pixel.
* Schnauze: Zeilen 7–8 bis x = 18, Nase = zwei graue Pixel R (79,79,91) (18,7) und S (30,31,36) (18,8).
* Schal (rot, Gold und dunkelrot, Zeilen 4–11): ein Band um den Hals (x 9–16) mit zwei Zipfeln — das lange Ende weht links hinter dem Rücken nach oben
  (bis (0,5)), das kurze hängt vorn an der Brust ((13–16, 9)).
* Rücken, Brust, Bauch (Zeilen 8–12), vier Beine: hinten ein kurzer Stumpf (2–4, 13–14) und ein Standbein (4–7, 13–16), vorn ein Standbein (9–12, 13–16)
  und das Gegenbein (13–15, 13–15). Der Schwanz (1–3, 5–8) liegt im Kartenbild komplett unter dem wehenden Schalende.
* Kein Glanz (Regel 14: Eis/Kälte), keine Zähne, keine Zunge.
Bleibt fest: Kopf (bis auf Ohrspitze und Auge), Nase, Bauch/Brust, Schalband am Hals, die beiden Gegenbeine.

Ablauf (54 Frames à 66 ms = 3,56 s), alle Bewegungen unabhängig:
* Atmen (Periode 27, 2× pro Schleife; oben in Frames 3–15 und 30–42): Zeile 12 wird eingefügt — Kopf, Rücken, Schal heben sich 1 px, die Beine bleiben am Boden.
* Schalende weht: die Spalten links vom Hals (x 0–6) schwingen als wandernde Welle bis ±2 px auf und ab (3 Wellen pro Schleife); das Halsband bleibt am Kopf.
  Darunter wird der Hund sichtbar (Schwanz, Rücken) — er liegt als eigene Ebene fertig vor.
* Ohr zuckt nach hinten: 4× pro Schleife (Frames 4, 19, 31, 46, je 6 Frames) schnippen die oberen zwei Zeilen der Ohrspitze 1 px nach links, der rechte Umrisspixel
  der unteren Zeile bleibt stehen (Umriss geschlossen).
* Blinzeln (Frames 10–13 und 37–40): erst der schwarze Augenstrich, dann auch das blaugraue Pixel werden zur Fellfarbe B (214,213,244) des Gesichts, dann wieder auf.
* Frösteln: zweimal pro Schleife (Frames 21–28 und 44–51) zittert der ganze Hund mit 1 px Hub (links/rechts im Takt von 2 Frames) — passend zu „Chilly“.
* Pfoten tippen: Standbein vorn in Frames 7–8, 33–34, 52–53; Standbein hinten in 14–15 und 38–39 (die Fußzeile entfällt, die Fußlinie rückt 1 px hoch).
* Kalter Atem: vier kleine runde Wölkchen (Farben des Fells) entstehen an der Nase, wachsen (Funke → 2×2 → Kreis), steigen langsam nach oben rechts und
  vergehen; sie liegen hinter dem Hund. Der Rahmen ist dafür nur 2 px breiter als der Hund allein (Rand rechts 5 statt 3).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Ergänzungen: siehe ERGAENZUNG (Umrisspixel am Schwanz, nur sichtbar, wenn das Schalende wegweht).
"""
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T

N, MS = 54, 66
PAD_L, PAD_R, PAD_T, PAD_B = 3, 5, 3, 3

spr = L.lade('mischief-militia-chilly-dog')
hund_q = L.lade('mischief-militia-chilly-dog-hund')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]

SCHWARZ = (0, 0, 0)
unterschied = (spr != hund_q).any(axis=2)                          # Pixel, die der Schal (samt Schwarz) deckt oder überdeckt
k_maske = L.deckend(spr) & (spr[..., :3] == SCHWARZ).all(axis=2)   # die fünf schwarzen Gesichtspixel
schal_maske = unterschied & ~k_maske & L.deckend(spr)

FELL = (214, 213, 244)                                             # B: Fell im Gesicht (Lid)
UMRISS = (121, 120, 207)                                           # A
AUGE_OBEN, AUGE_UNTEN = (118, 128, 163), (83, 97, 132)
# Umrisspixel, die im Original unter dem Schal liegen und fehlen: die Schwanzspitze (1,6) hat links keinen Umriss.
ERGAENZUNG = [(0, 6)]
for (x, y) in ERGAENZUNG:
    hund_q[y, x, :3] = UMRISS
    hund_q[y, x, 3] = 255

STAUB = {'fell': ((223, 224, 246), (204, 204, 242))}               # C (Kern) / D (Rand)
ATEM = [dict(x=PAD_L + 19, y=PAD_T + 6, vx=0.5, vy=-5.0, off=0, form='o', farbe='fell', wackeln=0.0),
        dict(x=PAD_L + 19, y=PAD_T + 6, vx=0.4, vy=-4.0, off=14, form='s', farbe='fell', wackeln=0.0),
        dict(x=PAD_L + 19, y=PAD_T + 6, vx=0.5, vy=-5.0, off=27, form='o', farbe='fell', wackeln=0.0),
        dict(x=PAD_L + 19, y=PAD_T + 6, vx=0.4, vy=-4.0, off=40, form='s', farbe='fell', wackeln=0.0)]
TEST_EBENEN = ['hund', 'schal', 'kdet']
RAND = T.rand_farben(spr)
_f, _u, REGEL = T.umriss_regeln(spr, RAND)

ZEILE = 12                                                         # hier wird beim Atmen eine Zeile eingefügt
PFOTE_V = (7, 8, 33, 34, 52, 53)
PFOTE_H = (14, 15, 38, 39)


def ebene(a, maske):
    t = np.zeros_like(a)
    t[maske] = a[maske]
    return L.platz(t, H, W, PAD_L, PAD_T)                          # sofort auf die volle Leinwand


def zustand(i):
    atem = 1 if (i % 27) in range(3, 16) else 0
    ohr = max(T.huellkurve(i, N, s, 6) for s in (4, 19, 31, 46))
    lid = 0
    for s in (10, 37):
        if 0 <= i - s < 4:
            lid = (1, 2, 2, 1)[i - s]
    zit = 0
    for s in (21, 44):
        if 0 <= i - s < 8:
            zit = (0, 1, 0, -1, 0, 1, 0, -1)[i - s]
    return atem, ohr, lid, zit, 1 if i in PFOTE_V else 0, 1 if i in PFOTE_H else 0


def frame(i, nur=None):
    atem, ohr, lid, zit, tipp_v, tipp_h = zustand(i)
    hund = ebene(hund_q, L.deckend(hund_q))
    schal = ebene(spr, schal_maske)
    kdet = ebene(spr, k_maske)
    # Blinzeln: der schwarze Augenstrich (13,5) (14,5) verschwindet in der Fellfarbe, bei „ganz zu“ auch das blaugraue Pixel (14,6)
    if lid:
        for (x, y) in ((13, 5), (14, 5)):
            hund[PAD_T + y, PAD_L + x, :3] = FELL
            kdet[PAD_T + y, PAD_L + x] = 0
        if lid == 2:
            hund[PAD_T + 6, PAD_L + 14, :3] = FELL
    # Schalende weht (Spalten links vom Hals), wandernde Welle
    schal = L.spalten_welle(schal, PAD_L + 7, 1.8, 2 * np.pi * i / 18.0 + 0.22, potenz=1.0, nur_rechts=False, lauf=0.5)   # Frame 0 = Original
    # Atmen: Zeile 12 einfügen, alles darüber steigt
    hund = L.streck_zeile(hund, PAD_T + ZEILE, atem)
    schal = L.streck_zeile(schal, PAD_T + ZEILE, atem)
    kdet = L.streck_zeile(kdet, PAD_T + ZEILE, atem)
    cols = np.arange(W)[None, :]
    rows = np.arange(H)[:, None]
    # Pfoten: die Fußzeile (Zeile 15) des Standbeins entfällt, die Fußlinie rückt hoch
    fv, hund = L.trenne(hund, (rows >= PAD_T + 15) & (cols >= PAD_L + 9) & (cols <= PAD_L + 12))
    fh, hund = L.trenne(hund, (rows >= PAD_T + 15) & (cols >= PAD_L + 4) & (cols <= PAD_L + 7))
    fv = L.heben_unten(fv, PAD_T + 15, tipp_v)
    fh = L.heben_unten(fh, PAD_T + 15, tipp_h)
    # Ohr: obere zwei Zeilen (0–1) zucken 1 px nach hinten (links); der innere Umrisspixel der unteren Zeile bleibt stehen
    spitze, hund = L.trenne(hund, (rows <= PAD_T + 1 - atem) & (cols >= PAD_L + 8) & (cols <= PAD_L + 12) & (rows >= PAD_T - atem))
    ohr_d = T.zucken_zeilen(spitze, PAD_T + 2 - atem, -1.2 * ohr, {PAD_T - atem: 1.0, PAD_T + 1 - atem: 1.0}, innen='rechts')
    koerper = L.zusammen(H, W, [(hund, 0, 0), (fv, 0, 0), (fh, 0, 0), (ohr_d, 0, 0)])
    ebenen = {'hund': koerper, 'schal': schal, 'kdet': kdet}
    wahl = nur or ('atem', 'hund', 'schal', 'kdet')
    teile = []
    if 'atem' in wahl:
        teile.append((T.funken_ebene(H, W, i, N, ATEM, STAUB), 0, 0))
    ganz = L.zusammen(H, W, [(ebenen[n], 0, 0) for n in ('hund', 'schal', 'kdet') if n in wahl])
    # Randpixel-Test (Regel 16): wo das wehende Schalende eine Füllfarbe an den Rand schiebt, wird ein Umrisspixel (Farbe aus dem Original) ergänzt
    ganz = T.umriss_schliessen(ganz, RAND, REGEL)
    teile.append((L.versetze(ganz, zit, 0), 0, 0))
    return L.zusammen(H, W, teile)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('mischief-militia-chilly-dog', 'Mischief Militia - Chilly Dog', frames, MS, prev)
    if prev:
        L.streifen(prev + '/mischief-militia-chilly-dog-strip.png', frames, spalten=12, scale=8)
