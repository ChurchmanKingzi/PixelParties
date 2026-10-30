# -*- coding: utf-8 -*-
"""Idle-Animation für „Time Bomblebee“ (Creature) — Regeln 14/15/16.

PICK: [["MotiveHawaii", 43, 1], ["MotiveHawaii", 42, 1], ["MotiveHawaii", 41, 1], ["MotiveHawaii", 40, 1]] + Flügel aus src/bomblebee.png
Eigenes Sprite (creature_show.py findet nur Einzelteile): in der Kunst ist die Figur aus Teilen der Ebenen von MotiveHawaii.xcf zusammengesetzt; die Teile wurden
per Abgleich mit der Kartenkunst (Time_Bomblebee.png) platziert (Abweichung: 4 von ~1200 Pixeln, Flügel ausgenommen) und als EBENEN gespeichert:
  src/time-bomblebee.png              das fertige Sprite (72×53 px, 40 Farben) = alle Ebenen übereinander
  src/time-bomblebee-fluegel-l / -r   die Flügel (durchscheinend in der Kunst, hier deckend; es sind die Flügel der Bomblebee, 22×18 px, Abgleich NCC 0,88)
  src/time-bomblebee-uhr              die große Uhr (Ebene 43, Figur 1: Wecker mit Bronzering, weißem Zifferblatt, roten Zeigern)
  src/time-bomblebee-kopf             Ebene 42 als Ganzes: Kopf mit goldenem Ring, Fühler mit Funken, Arme, zwei Haken unten, zwei Beine
  src/time-bomblebee-bombe-ol / -ul / -ur   drei schwarze Bomben mit Lunte und Funke (Ebene 41, Figur 1, dreimal)
  src/time-bomblebee-uhr-klein        kleine goldene Uhr oben rechts (Ebene 40)
Ein verirrtes gelbes Pixel am Wurzelrand des linken Flügels (kam aus dem Körper der Bomblebee) ist durch die Nachbarfarbe ersetzt.

Aufruf:   python3 time_bomblebee.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/time-bomblebee.png + .json  (Frame auf die Figur zugeschnitten)

Identifikation (Sprite-Koordinaten x, y):
* Wecker (x 19–51, y 15–47): Bronzering (115,62,57)/(184,111,80)/(228,166,114), weißes Zifferblatt mit Schattierung, Ziffernstriche (58,68,102)/(90,105,136).
  Stundenzeiger waagerecht nach links (y 30–31, x 29–34; Schatten y 32), Minutenzeiger senkrecht nach oben (x 35–36, y 21–29; Schatten x 34), schwarze Kappe (35–36, 30–31).
* Kopf (x 28–45, y 4–19): schwarze Hummel mit weißen Augen ((33–34,13), (37–38,13), (33,14), (37,14)), goldener Ring, zwei Fühler mit Funken.
* Kleine goldene Uhr (x 40–52, y 6–18) rechts neben dem Kopf; darüber ein Funken-Stern (46–48, 0–3).
* Drei Bomben: oben links (x 12–26, y 6–19), unten links (x 11–25, y 36–47), unten rechts (x 44–58, y 36–47), je mit Lunte und gelbem Funken (Lunten-Feuer).
* Flügel links x 0–21, rechts x 50–71 (y 15–32); Beine unten (x 27–50, y 43–52); Haken/Arme halten die Bomben.

Ablauf (48 Frames à 60 ms = 2,88 s):
* Kräftiger Flügelschlag: sechsmal pro Schleife (Periode 8); jede Flügelspalte wandert senkrecht, je weiter außen, desto mehr: Spitze etwa −6 … +7 px, Spitze hinkt nach
  (F.fluegel_welle, Zusammenhang erzwungen). Wurzelspalten bleiben fest; die Flügel liegen hinter Uhr, Armen und Bomben (nichts Verdecktes fehlt: alle Ebenen sind vollständig).
* Uhrzeiger: der Minutenzeiger (samt Schatten) springt alle 2 Frames um 15° weiter und macht eine ganze Runde pro Schleife (Frame 0 = Original, Ende = wieder Original; Drehung per
  Rückwärtsabbildung, nur Quellfarben). ERGÄNZT: unter dem Minutenzeiger liegen Zifferblatt-Pixel, die im Original verdeckt sind — sie werden mit dem weißen Zifferblatt (255,255,255) gefüllt;
  der Stundenzeiger bleibt, die schwarze Kappe liegt oben.
* Schwebe-Bob zweistufig bis 2 px nach oben (0 → 1 → 2 → 1 → 0, Periode 12); die drei Bomben schaukeln zusätzlich je 1 px (Perioden 24, gegeneinander versetzt), die Beine pendeln unten bis 2 px.
* Brennende Lunten (Regel 15): die gelben Funken (drei Bomben, Fühlerspitzen, Stern) sind Lunten-Feuer: über jedem wachsen Zungen (0…3 px, bei Kopf/Stern höchstens 2), Farbe wandert mit
  (unten hellgold, Mitte gold, Spitze orange; Farben aus dem Ring), der Kern blitzt hellgelb. Kleine runde Funken reißen ab und steigen auf (k, s).
* Blinzeln (Frames 38–39): die weißen Augen schließen sich (schwarz).
* Glanz nur an den goldenen Ringen (Metall, dezent: Kopfring und kleine Uhr, eine Stufe heller, alle 24 Frames); Chitin, Flügel, Uhrglas und Bomben glänzen nicht.

Rahmen: Das Bild ist auf die Figur zugeschnitten (Vereinigung aller Frames + 1 px freier Rand); Feuer/Funken ragen höchstens 2 px über die Figur (mit Bewegung) hinaus.
Randpixel-Test (Regel 16): Flügelversatz und Beinpendel legen Innenfarbe an Kanten frei → F.umranden setzt dort die Umrissfarbe; zusätzlich randtest.py.
Alle Bewegungen laufen auf der vollen (größeren) Arbeitsleinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle, Alpha nur 0/255.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger as F

N, MS = 48, 60
PAD_L, PAD_R, PAD_T, PAD_B = 14, 14, 12, 10               # Arbeitsleinwand (am Ende zugeschnitten)

spr = L.lade('time-bomblebee')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]


def teil(name):
    return L.platz(L.lade('time-bomblebee-' + name), H, W, PAD_L, PAD_T)


P_WL, P_WR, P_UHR, P_KOPF = teil('fluegel-l'), teil('fluegel-r'), teil('uhr'), teil('kopf')
P_BOL, P_BUL, P_BUR, P_KLEIN = teil('bombe-ol'), teil('bombe-ul'), teil('bombe-ur'), teil('uhr-klein')
assert (L.zusammen(H, W, [(p, 0, 0) for p in (P_WL, P_WR, P_UHR, P_KOPF, P_BOL, P_BUL, P_BUR, P_KLEIN)])[PAD_T:PAD_T + sh, PAD_L:PAD_L + sw] == spr).all()

# ── Farben (alle aus dem Sprite) ──────────────────────────────────────────────────────────────────────────────────
GELB, GELB_HELL = (255, 255, 0), (255, 255, 203)
ORANGE, GOLD, HELLGOLD = (236, 163, 60), (224, 195, 67), (238, 213, 129)
SCHWARZ = (0, 0, 0)
WEISS, HELLBLAU, SCHATTEN = (255, 255, 255), (214, 225, 245), (192, 203, 220)
ROT_H, ROT_D = (228, 59, 68), (162, 38, 51)                # Zeigerfarben (hell/dunkel)
GESICHT = {WEISS, HELLBLAU, SCHATTEN}                       # Zifferblattfarben: Feuer darf hier darüber malen
KLEIN_RAMPE = [(153, 105, 0), (204, 141, 0), (255, 176, 0), (255, 230, 0), GELB_HELL]
KOPF_RAMPE = [ORANGE, GOLD, HELLGOLD, GELB_HELL]
UMRISS = F.umriss_farben(spr)

sprKopf = L.lade('time-bomblebee-kopf')
sprKlein = L.lade('time-bomblebee-uhr-klein')
ring_kopf = L.farbmaske(sprKopf, [ORANGE, GOLD, HELLGOLD]) & (yy >= 8) & (xx >= 28) & (xx <= 45)
ring_klein = L.farbmaske(sprKlein, KLEIN_RAMPE[:4])

# ── Beine (Teil der Ebene 42, unterhalb der Uhr) ──────────────────────────────────────────────────────────────────────
M_BEINE = (sprKopf[..., 3] > 0) & (yy >= 43)
Y_BEIN = PAD_T + 43
P_BEINE = P_KOPF.copy(); P_BEINE[PAD_T:PAD_T + sh, PAD_L:PAD_L + sw][~M_BEINE] = 0
P_KOPF_OHNE = P_KOPF.copy(); P_KOPF_OHNE[PAD_T:PAD_T + sh, PAD_L:PAD_L + sw][M_BEINE] = 0

# ── Uhr: Minutenzeiger herauslösen ───────────────────────────────────────────────────────────────────────────────────
HAND_PIX = [(x, y) for y in range(21, 30) for x in (35, 36)] + [(34, y) for y in range(23, 30)]      # Minutenzeiger + Schatten
HAND_PIX = [(x, y) for (x, y) in HAND_PIX if tuple(spr[y, x, :3]) in (ROT_H, ROT_D, SCHATTEN)]
P_UHR_LEER = P_UHR.copy()
P_HAND = L.leer(H, W)
for (x, y) in HAND_PIX:
    P_HAND[PAD_T + y, PAD_L + x] = P_UHR[PAD_T + y, PAD_L + x]
    P_UHR_LEER[PAD_T + y, PAD_L + x, :3] = WEISS            # verdecktes Zifferblatt: weiß (Nachbarn links/rechts sind weiß)
KAPPE = [(35, 30), (36, 30), (35, 31), (36, 31)]
ZX, ZY = PAD_L + 35.5, PAD_T + 30.5                          # Drehpunkt = Mitte der Kappe

# ── Lunten-Feuer: oberste Zeile je Funken-Spalte (x, y_oben) ───────────────────────────────────────────────────────
LUNTEN = {'stern': ([(46, 2), (47, 1), (48, 0)], 2, 'kopf'),
          'kopf_oben': ([(35, 4), (34, 5), (36, 5)], 2, 'kopf'),
          'kopf_links': ([(27, 8), (28, 8), (29, 8), (26, 9), (25, 10)], 3, 'kopf'),
          'bombe_ol': ([(14, 7), (15, 8), (16, 9), (13, 10)], 3, 'bombe_ol'),
          'bombe_ul': ([(13, 36), (14, 37), (15, 38), (12, 39)], 3, 'bombe_ul'),
          'bombe_ur': ([(46, 36), (47, 37), (48, 38), (45, 39)], 3, 'bombe_ur')}
_rng = np.random.RandomState(5)
_K = N // 4
FLAMMEN = {}
for _name, (_cols, _emax, _eltern) in LUNTEN.items():
    for _x, _y in _cols:
        FLAMMEN[(_name, _x, _y)] = ([int(_rng.randint(0, _emax + 1)) for _ in range(_K)], int(_rng.randint(0, _K)), _emax)


def malen(f, x, y, c):
    """Flammenpixel nur auf freie Pixel oder aufs Zifferblatt."""
    py, px_ = PAD_T + y, PAD_L + x
    if not f[py, px_, 3] or tuple(int(v) for v in f[py, px_, :3]) in GESICHT:
        f[py, px_, :3] = c
        f[py, px_, 3] = 255


def lunten_feuer(f, i, dys):
    for (name, x, y0), (tab, off, emax) in FLAMMEN.items():
        dy = dys[LUNTEN[name][2]]
        e = tab[((i // 4) + off) % _K]
        for k, c in enumerate({0: [], 1: [ORANGE], 2: [GOLD, ORANGE], 3: [HELLGOLD, GOLD, ORANGE]}[e]):
            malen(f, x, y0 - 1 - k + dy, c)
        if e == emax and emax >= 2:                             # heiß: Kern blitzt hellgelb
            py, px_ = PAD_T + y0 + dy, PAD_L + x
            if tuple(int(v) for v in f[py, px_, :3]) == GELB:
                f[py, px_, :3] = GELB_HELL


def px(x, y):
    return PAD_L + x, PAD_T + y


def puffs(liste):
    return [dict(x=px(x, y)[0], y=px(x, y)[1], vx=vx, vy=vy, off=off, form=f, wackeln=wk) for (x, y, vx, vy, off, f, wk) in liste]


FUNKEN1 = {'c': GELB, 'r': ORANGE}
FUNKEN2 = {'c': GELB_HELL, 'r': HELLGOLD}
# Quellen: Bomben (oben links, unten links, unten rechts), Fühlerspitze links, Kopf oben (ragen nur wenig über die Figur)
PUFFS1 = puffs([(14, 6, -1, -6, 0, 'k', 1), (27, 6, -1, -6, 8, 's', 1), (35, 3, 0, -4, 16, 'k', 1),
                (13, 35, -1, -7, 24, 'k', 1), (46, 35, 1, -7, 32, 's', 1),
                (15, 6, -1, -6, 28, 's', 1), (13, 34, -1, -6, 4, 's', 1)])
PUFFS2 = puffs([(15, 6, 0, -6, 12, 'k', 1), (28, 6, 0, -6, 20, 'k', 1), (36, 3, 0, -4, 36, 'k', 1),
                (14, 35, 0, -7, 40, 'k', 1), (47, 35, 1, -7, 44, 'k', 1), (47, 34, 1, -6, 14, 'k', 1)])


def frame(i, partikel=True, effekte=True):
    ph = L.sinus(i, N / 6)                                     # Flügelschlag: sechsmal pro Schleife (Periode 8)
    pb = (1 - math.cos(L.sinus(i, N / 4))) / 2                 # Bob: Periode 12
    bob = -int(round(2 * pb))                                  # 0 → −1 → −2 → −1 → 0 (nur nach oben, zweistufig)
    schaukel = {}
    for name, ph0 in (('bombe_ol', 0.0), ('bombe_ul', 2.1), ('bombe_ur', 4.2)):
        schaukel[name] = int(round(math.sin(L.sinus(i, N / 2) + ph0) - math.sin(ph0)))     # ±1 px, Frame 0 = Ruhe

    wl, wr = P_WL.copy(), P_WR.copy()
    uhr, kopf, beine = P_UHR_LEER.copy(), P_KOPF_OHNE.copy(), P_BEINE.copy()
    bombe = {'bombe_ol': P_BOL.copy(), 'bombe_ul': P_BUL.copy(), 'bombe_ur': P_BUR.copy()}
    klein = P_KLEIN.copy()

    # Blinzeln: weiße Augen werden schwarz
    if i in (38, 39):
        F.setze(kopf, PAD_L, PAD_T, {p: SCHWARZ for p in ((33, 13), (34, 13), (37, 13), (38, 13), (33, 14), (37, 14))})

    # Glanz nur an den goldenen Ringen (Metall, dezent)
    if effekte:
        F.lichtband(kopf, ring_kopf, PAD_L, PAD_T, i, N // 2, 4, 9, KOPF_RAMPE, stufen=1, breite=3.0, achse=(1.0, 0.8))
        F.lichtband(klein, ring_klein, PAD_L, PAD_T, i, N // 2, 14, 9, KLEIN_RAMPE, stufen=1, breite=3.0, achse=(1.0, 0.8))

    # Uhrzeiger: Minutenzeiger springt alle 2 Frames um 15° weiter (eine Runde pro Schleife)
    winkel = math.radians(15.0 * (i // 2))
    hand = F.drehen(P_HAND, ZX, ZY, winkel)
    uhr = L.zusammen(H, W, [(uhr, 0, 0), (hand, 0, 0)])
    for (x, y) in KAPPE:                                       # Kappe liegt über den Zeigern
        uhr[PAD_T + y, PAD_L + x] = P_UHR[PAD_T + y, PAD_L + x]

    # Flügelschlag (Spalten wandern, Wurzel fest)
    fl_amp, fl_pot, lauf = 6.7, 1.1, 0.1                       # Spitze etwa −6 … +7 px
    wl = F.fluegel_welle(wl, PAD_L + 17, fl_amp, ph, potenz=fl_pot, nur_rechts=False, lauf=lauf, zusammenhang=True)
    wr = F.fluegel_welle(wr, PAD_L + 54, fl_amp, ph, potenz=fl_pot, nur_rechts=True, lauf=lauf, zusammenhang=True)
    # Beine pendeln (Aufhängung oben fest)
    beine = F.zeilen_pendel(beine, Y_BEIN, 2.4, L.sinus(i, N / 2), 1.0)

    # Bob an allen Ebenen, Bomben zusätzlich ±1 px
    wl, wr, uhr, kopf, beine, klein = (L.versetze(a, 0, bob) for a in (wl, wr, uhr, kopf, beine, klein))
    bombe = {k: L.versetze(b, 0, bob + schaukel[k]) for k, b in bombe.items()}
    dys = {'kopf': bob, 'bombe_ol': bob + schaukel['bombe_ol'], 'bombe_ul': bob + schaukel['bombe_ul'], 'bombe_ur': bob + schaukel['bombe_ur']}

    f = L.zusammen(H, W, [(wl, 0, 0), (wr, 0, 0), (uhr, 0, 0), (beine, 0, 0), (kopf, 0, 0), (bombe['bombe_ol'], 0, 0),
                          (bombe['bombe_ul'], 0, 0), (bombe['bombe_ur'], 0, 0), (klein, 0, 0)])
    # Randpixel-Test (Regel 16): Flügelversatz/Beinpendel legen Innenfarbe frei → Kante in Umrissfarbe
    F.umranden(f, [wl, wr], UMRISS, (47, 59, 59), (135, 100, 60), (135, 100, 60))
    F.umranden(f, [beine], UMRISS, SCHWARZ, SCHWARZ, SCHWARZ)
    if effekte:
        lunten_feuer(f, i, dys)
    if partikel:
        pol = L.zusammen(H, W, [(L.puff_ebene(H, W, i, N, PUFFS1, FUNKEN1), 0, 0), (L.puff_ebene(H, W, i, N, PUFFS2, FUNKEN2), 0, 0)])
        f = L.zusammen(H, W, [(f, 0, 0), (pol, 0, 0)])        # Funken vor der Figur (sonst verdecken Flügel/Uhr sie)
    return f


def zuschneiden(frames, koerper):
    """Frame auf die Figur zuschneiden: Vereinigung aller Frames + 1 px freier Rand. Feuer/Funken dürfen die Vereinigung der Körper-Frames um höchstens 2 px überragen."""
    def bbox(fs):
        a = np.stack([f[..., 3] > 0 for f in fs]).any(axis=0)
        ys, xs = np.nonzero(a)
        return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())
    bx0, by0, bx1, by1 = bbox(koerper)
    ex0, ey0, ex1, ey1 = bbox(frames)
    ueber = (bx0 - ex0, by0 - ey0, ex1 - bx1, ey1 - by1)
    print('Figur (Körper-Frames) x', bx0, '…', bx1, 'y', by0, '…', by1, '| Effekte ragen hinaus (links, oben, rechts, unten):', ueber)
    assert max(ueber) <= 2, f'Effekte ragen mehr als 2 px über die Figur: {ueber}'
    x0, y0, x1, y1 = ex0 - 1, ey0 - 1, ex1 + 1, ey1 + 1
    return [f[y0:y1 + 1, x0:x1 + 1].copy() for f in frames]


if __name__ == '__main__':
    koerper = [frame(i, False, False) for i in range(N)]
    frames = [frame(i) for i in range(N)]
    frames = zuschneiden(frames, koerper)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr, min_rand=1)
    print('Pixel je Frame:', n)
    L.speichern('time-bomblebee', 'Time Bomblebee', frames, MS, prev)
    if prev:
        L.streifen(prev + '/time-bomblebee-strip.png', frames, spalten=8, scale=3)
