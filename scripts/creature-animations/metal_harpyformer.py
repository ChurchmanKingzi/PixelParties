# -*- coding: utf-8 -*-
"""Idle-Animation für „Metal Harpyformer“ (Creature) — Runde 2: Die Harpyie steht am Boden und schwenkt die brennende E-Gitarre wie eine Fackel durch die Luft.

PICK: [["MotiveMoe", 165, "Metal Harpyformer (28×49 px: Harpyie + Gitarre + Feuerkugel in einer Ebene)"]]
Quelle: MotiveMoe.xcf, Ebene 165 „Metal Harpyformer“ (Versatz (244, 349)); sie liegt unverändert als src/metal-harpyformer.png (28×49, 813 Pixel).
Abgleich mit der Kartenkunst (data/card-art/native/Metal_Harpyformer.png, 76×51; Ebene sitzt bei Kartenpixel (24, −9)): alle in der Karte liegenden Ebenenpixel stehen dort genauso; die obersten 9 Zeilen der
Feuerkugel ragen in der Karte über den Rand hinaus und sind nur in der Ebene vollständig. Nachbarebenen im Bereich (Robird, Balloons, Ebene #148 …) sind unsichtbar/Szene; Blumen, Busch, Bühne = Szene.
Die dunkelrote Harpyie in MotiveDeri 41 („Grunge Harpyformer #1“) ist dieselbe Figur ohne Gitarre und Feuer — nicht benutzt.

Aufruf:   python3 metal_harpyformer.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/metal-harpyformer.png + .json  (auf die Figur zugeschnitten, um die Ruhefigur zentriert)

Identifikation (Sprite-Koordinaten x, y; die Teile trennt das Skript per Farbe und Bereich):
* Feuerball (x 3–24, y 0–20; Rot (202,44,41), Orange (244,123,34), Gelb (246,231,14), Creme (247,245,184)): umhüllt das obere Gitarrenende; heller Kern in der Mitte. Wird NEU mit anim_feuer.py gezeichnet (Regel 15).
* Gitarre (x 8–23, y 14–28): rote Korpus-/Halsfläche (233,0,1) (210,0,1) (153,2,0) mit rosa Lichtpixeln (233,114,114); ein diagonaler Hals/Griffbrett-Streifen mit Schwarz-Weiß-Muster (26,33,39) (242,255,255)
  (172,177,179) läuft vom Feuer nach rechts unten zur rechten Hand; rotes Teil rechts (x 17–23, y 19–22); eine rote Säule (x 12–15, y 20–26) endet auf dem Kopf der Harpyie. Ohne Glanz (Saiten sind
  Schwarz-Weiß-Muster, kein erkennbares Metallglanz-Detail; im Zweifel weggelassen).
* Harpyie (x 4–23, y 25–48): rotbraunes Haar/Gesicht, schwarzer Umriss (19,10,10); Gesicht x 9–18, y 29–34 mit Totenkopf-/Corpsepaint-Muster; Augen = hellblaue Iris + dunkelrote Pupille (11,30) (12,30) und (15,30) (16,30);
  weiß-blau-graue Brustplatte (y 35–40); Haarsträhnen/Umhang (x 4–8 und 19–23, y 37–44); Beine/Füße (x 8–20, y 43–48).
* Flügel/Arme: graue Fledermausflügel (Töne (125,125,125) (112,112,112) (89,89,89) (63,63,63) (45,45,45)); sie stehen als hochgereckte Arme: links x 0–9, y 21–37 (Spitze frei bis y 28), rechts x 18–27, y 23–37; die
  rechte Handspitze (x 20–24, y 23–25) hält den Gitarrenhals.

Ablauf (48 Frames à 65 ms = 3,12 s; Frame 0 = Ruhepose bis auf das neu gezeichnete Feuer). Kein Flug, kein Hover-Bob: die Füße stehen fest am Boden (der Oberkörper atmet).
* Fackel-Schwenk (3 pro Schleife, Periode 16 Frames = 1,04 s): die Gitarre samt Hand schwingt sinusförmig bis ±3 px nach links/rechts und kippt dabei oberhalb der Hand (Zeilenversatz, Gefälle ≤ 0,11 px je Zeile,
  der Kippwinkel hinkt dem Schwenk 0,7 rad nach → „Peitscheneffekt“); starr geschoben, nichts kopiert, 4er-Zusammenhang über `A.verbinde4`.
* Rechter Flügel (Hand): schwingt mit der Gitarre (Zeilen bis y 26 voll, bis y 31 abklingend; Schulter y ≥ 29 fest, die Wurzel steht als fester Unterbau darunter), denn er hält den Gitarrenhals.
* Linker Flügel (Runde 3, Rückmeldung „sollte ihre Flügel unabhängig voneinander bewegen“): schwingt jetzt FÜR SICH, nicht mehr an Gitarre/rechten Flügel gekoppelt — eigene Perioden 24 und 12 Frames (Gitarre/rechter Flügel: 16),
  Ausschlag 2,6 + 0,8 px (Zeilenversatz wie beim rechten, Wurzel fest), Frame 0 = Ruhelage.
* Körper (Runde 3, Rückmeldung „bewegt ihren Körper aktuell gar nicht“): sie atmet — Periode 24 (zwei Atemzüge pro Schleife): an den Bauchzeilen y 39 und y 41 (Textur, unter den Flügeln, weder Gesicht noch Hals) wird je eine Zeile mit
  Texturmischung (`L.streck_zeile`) eingefügt, zweistufig mit Nachlauf (zuerst unten, dann oben): Kopf, Flügel, Gitarre samt Hand und Feuer heben sich um 0 … 2 px, Beine/Füße bleiben am Boden; die Funken starten an der angehobenen Fackel.
* Haarsträhnen unten (Runde 3, Rückmeldung „die Haare zucken seltsam“): statt Pixel zu stauchen/verdoppeln (das ließ sie zucken) pendeln sie jetzt ruhig als Ganzes nach außen und zurück (`strang_schwingen`): jede Zeile (Umriss, Füllung und die einzelnen
  Haarfransen außen) wandert starr um 0 … 2 px, die Auslenkung wächst gleichmäßig zur Spitze und folgt der Bewegung mit Nachlauf (Welle), das innerste Pixel bleibt am Körper, die Lücke füllt die Füllfarbe der Strähne. Links Periode 24,
  rechts Periode 16 (gegeneinander versetzt), nach innen nie über die Ruhelage hinaus; Änderungen höchstens 1 px je Zeile und alle 2–4 Frames.
* Feuer (Runde 4, Rückmeldung „sehen die Flammen noch nicht wie richtige, sauber animierte Flammen aus“): klassischer Flammenzyklus mit Aufwärtsfluss aus `anim_feuer3` — eine breite, ruhige Glutbasis um den
  Gitarrenkopf und 5 phasenversetzte Zungen (Tropfen mit verschachtelten Farbbändern Rot → Orange → Gelb → Creme), 8 Posen à 2 Frames (3 Zyklen je Schleife): Bäuche wandern von der Basis zur Spitze, die Spitzen
  schnüren sich ab und steigen als kleine Fetzen weiter. Die Flamme neigt sich entgegen der Schwenkrichtung (Fahrtwind, ganzzahlig) und folgt dem Kippen der Gitarre. Die früheren Einzelfunken entfallen.
* Blinzeln: Frames 19–21 und 41–42, Lid = Hautfarbe (114,63,63) auf Iris und Pupille.

Ergänzungen (Sprite-Koordinaten): Haaransatz unter dem Gitarrenfuß, den die Gitarre sonst verdeckt: (13,25) (14,25) (15,25) = Umrissfarbe (19,10,10), (14,26) = Haarfarbe (168,97,97). Das Feuer wird komplett neu gezeichnet
(Farben der Quelle). Sonst nichts ergänzt: die Flügelwurzel steht unverschoben unter dem verschobenen Flügel.
Randpixel-Test (Regel 16): `B.umriss_je_ebene` setzt Randpixel in Nicht-Umrissfarbe auf die Umrissfarbe der Ebene; randtest: 0 Frames.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger_b as B
import anim_feuer as FEU
import anim_feuer3 as F3
import anim_harpyb as HB
import anim_amorph as A

N, MS = 48, 65
SWING = 16                                                 # Frames je Schwenk (hin und her), 3 pro Schleife
A_SW = 3.0                                                 # Ausschlag der Gitarre (px)
PAD_L, PAD_R, PAD_T, PAD_B = 9, 9, 16, 2

spr = L.lade('metal-harpyformer')                          # Ebene 165 (Ruhepose / Referenz für den Randpixel-Test)
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
fig = spr[..., 3] > 0

ROT, ORANGE, GELB, CREME = (202, 44, 41), (244, 123, 34), (246, 231, 14), (247, 245, 184)
FLAMMEN = [ROT, ORANGE, GELB, CREME]
GRAU = [(45, 45, 45), (125, 125, 125), (89, 89, 89), (112, 112, 112), (63, 63, 63), (70, 68, 71), (0, 2, 0)]
KOERPERFARBEN = [(73, 40, 40), (19, 10, 10), (114, 63, 63), (147, 80, 80), (170, 101, 101), (168, 97, 97)]
LID = (114, 63, 63)
AUGEN = [(11, 30), (12, 30), (15, 30), (16, 30)]           # Iris + Pupille → Lid

# ── Teile trennen ─────────────────────────────────────────────────────────────────────────────────────────────────────
M_FEUER = fig & L.farbmaske(spr, FLAMMEN) & (yy <= 20)
M_GITARRE = fig & ~L.farbmaske(spr, FLAMMEN + GRAU + KOERPERFARBEN) & (yy >= 14) & (yy <= 28) & (xx >= 8) & (xx <= 24)
M_FL_L = fig & L.farbmaske(spr, GRAU) & (xx <= 9) & (yy >= 21) & (yy <= 37)
M_FL_R = fig & L.farbmaske(spr, GRAU) & (xx >= 18) & (yy >= 21) & (yy <= 37)
M_STRANG_L = fig & (xx <= 8) & (yy >= 38) & ~M_FL_L & (yy <= 44)
M_STRANG_R = fig & (xx >= 19) & (yy >= 38) & ~M_FL_R & (yy <= 44)
M_REST = fig & ~(M_FEUER | M_GITARRE | M_FL_L | M_FL_R | M_STRANG_L | M_STRANG_R)


def teil(maske, quelle=spr):
    return L.platz(np.where(maske[..., None], quelle, 0).astype(np.uint8), H, W, PAD_L, PAD_T)


GITARRE, FL_L, FL_R, STR_L, STR_R = (teil(m) for m in (M_GITARRE, M_FL_L, M_FL_R, M_STRANG_L, M_STRANG_R))
# Ergänzung: Kopf unter dem Gitarrenfuß (die Gitarre verdeckt dort Haaransatz, sobald sie wegschwingt)
ERG = {(13, 25): (19, 10, 10), (14, 25): (19, 10, 10), (15, 25): (19, 10, 10), (14, 26): (168, 97, 97)}
_rest_src = spr.copy()
for (x, y), c in ERG.items():
    assert not (M_REST[y, x])
    _rest_src[y, x, :3] = c
    _rest_src[y, x, 3] = 255
M_REST_ERG = M_REST.copy()
for (x, y) in ERG:
    M_REST_ERG[y, x] = True
REST = teil(M_REST_ERG, _rest_src)
UNTER_L = teil(M_FL_L & (yy >= 29))                         # Wurzel der Flügel steht fest unter dem verschobenen Flügel
UNTER_R = teil(M_FL_R & (yy >= 29))

_m = spr[..., 3] > 0
_p = np.pad(_m, 1)
_kante = _m & (~_p[:-2, 1:-1] | ~_p[2:, 1:-1] | ~_p[1:-1, :-2] | ~_p[1:-1, 2:])
ERLAUBT = {tuple(int(v) for v in spr[y, x, :3]) for y, x in zip(*np.nonzero(_kante))}
UMRISS = {1: (45, 45, 45), 2: (45, 45, 45), 3: (19, 10, 10), 4: (19, 10, 10), 5: (19, 10, 10), 6: (153, 2, 0), 7: (202, 44, 41), 8: (62, 56, 50)}
# 1/2 Flügel, 3/4 Strähnen, 5 Körper, 6 Gitarre (rot), 7 Feuer, 8 Gitarrenhals (Schwarz-Weiß-Muster/grau)
HALS_FARBEN = [(242, 255, 255), (172, 177, 179), (26, 33, 39), (62, 56, 50), (102, 81, 74)]

# ── Feuer (anim_feuer.py, eigene Windvariante) ────────────────────────────────────────────────────────────────────────
RAMPE = {'rand': ROT, 'rot': ROT, 'orange': ORANGE, 'gelb': GELB, 'hell': CREME}
SPERRE = np.zeros((H, W), bool)
SPERRE[PAD_T:PAD_T + sh, PAD_L:PAD_L + sw] = M_GITARRE & (yy <= 21)
# Runde 4: klassischer Flammenzyklus mit Aufwärtsfluss (anim_feuer3): breite ruhige Glutbasis um den Gitarrenkopf + 5 phasenversetzte Zungen, 8 Posen à 2 Frames (3 Zyklen je Schleife)
_F = lambda x, y, l, b, **k: F3.Flamme(PAD_L + x, PAD_T + y, l, b, **k)
FLAMMEN3 = [_F(13.5, 14.5, 8, 9.5, bauch=0.22, schlag=0.35, phase=0.2, fuss=5.5),
            _F(6.0, 13.0, 11, 3.2, phase=0.05, richtung=(-0.3, -1)),
            _F(10.0, 11.0, 14, 3.4, phase=0.6, richtung=(-0.1, -1)),
            _F(14.0, 11.0, 17, 4.0, phase=0.3),
            _F(18.0, 11.5, 13, 3.4, phase=0.85, richtung=(0.12, -1)),
            _F(21.5, 13.5, 10, 3.0, phase=0.45, richtung=(0.3, -1))]
FEUER = F3.Feuer(H, W, FLAMMEN3, FLAMMEN, posen=8, halten=2)


# ── Schwenk ─────────────────────────────────────────────────────────────────────────────────────────────────────────
def schwenk(t):
    """Gitarre/Hand: Ausschlag in px (negativ = links), nahtlos über SWING Frames; bei t = 0 genau die Ruhepose."""
    return A_SW * math.sin(2 * math.pi * t / SWING)


def wind(t):
    """Fahrtwind: die Flamme hinkt der Bewegung nach (entgegen der Geschwindigkeit)."""
    return -1.6 * (schwenk(t + 0.5) - schwenk(t - 0.5))


Y_P = 28                                                   # Hand: hier hängt die Gitarre am Flügel; darüber kippt sie
B_T, T_LAG = 0.11, 0.7


def kippen(t):
    """Kippung der Gitarre in px je Zeile oberhalb der Hand (hinkt dem Schwenk nach, bei t = 0 genau 0)."""
    return B_T * (math.sin(2 * math.pi * t / SWING - T_LAG) + math.sin(T_LAG))


def schub_fn(a, b, fest=99):
    """Zeilenversatz der Gitarre/Flamme: Hand verschiebt um a, darüber kippt es um b px je Zeile (höchstens `fest` Zeilen)."""
    def f(y):
        sy = y - PAD_T
        return int(round(a + b * min(max(0, Y_P - sy), fest)))
    return f


def arm_dx(a, y_voll, y_null):
    """Zeilenversatz eines Flügelarms: Zeilen bis y_voll (Quellzeile) schwingen voll mit, bis y_null klingt es auf 0 ab (Schulter fest)."""
    def f(y):
        sy = y - PAD_T
        w = 1.0 if sy <= y_voll else max(0.0, (y_null - sy) / float(y_null - y_voll))
        return int(round(a * w))
    return f


STRANG_Y0, STRANG_Y1 = PAD_T + 37, PAD_T + 44                # Strähnen hängen ab Zeile 37 (Schulter, Flügelunterkante) bis 44


def strang_schwingen(a, links, t, periode, amp, lag=2.0):
    """Haarsträhne schwingt als Pendel nach außen und zurück (Runde 3, Rückmeldung „die Haare zucken seltsam“): in jeder Zeile bleibt das innerste Pixel am Körper stehen, alle anderen Pixel der Zeile (Umriss, Füllung und
    die einzelnen Haarfransen außen) wandern STARR um dx nach außen (nichts wird neu abgetastet, doppelt oder ausgelassen); die Lücke zwischen verschobenem Teil und innerstem Pixel füllt die Füllfarbe des
    nächsten Pixels (die Strähne wird dort etwas breiter, kein dunkler Block). dx wächst gleichmäßig mit dem Abstand zur Schulter (bis `amp` px unten) und folgt der Bewegung mit Nachlauf (`lag` Frames je Strähnenlänge) —
    eine ruhige Welle statt Zucken; bei t = 0 genau die Ruhelage; nach innen geht es nie über die Ruhelage hinaus. links=True: Strähne links vom Körper (außen = links), sonst rechts."""
    out = a.copy()
    h, w = a.shape[:2]
    u = lambda tt: 0.5 * (1 - math.cos(2 * math.pi * tt / periode))
    for y in range(STRANG_Y0 + 1, STRANG_Y1 + 1):
        xs_ = np.nonzero(a[y, :, 3])[0]
        if len(xs_) < 2:
            continue
        f = (y - STRANG_Y0) / float(STRANG_Y1 - STRANG_Y0)
        z = max(0.0, u(t - lag * f) - u(-lag * f))                  # bei t = 0 genau 0 (Ruhepose)
        dx = int(math.floor(amp * (f ** 1.1) * z + 0.5))
        if dx == 0:
            continue
        s = -dx if links else dx
        bewegt = xs_[:-1] if links else xs_[1:]                     # alles außer dem innersten Pixel
        innen = int(xs_[-1]) if links else int(xs_[0])
        naechst = int(bewegt[-1]) if links else int(bewegt[0])      # Pixel direkt außerhalb des innersten
        if bewegt.min() + s < 0 or bewegt.max() + s >= w:
            raise L.ClipError(f'Strähne Zeile {y} würde um {s} px aus der Leinwand geschoben')
        farbe = a[y, naechst].copy()
        out[y, bewegt] = 0
        out[y, bewegt + s] = a[y, bewegt]
        for k in range(1, dx + 1):
            xk = naechst + s + (k if links else -k)
            if (links and xk < innen) or (not links and xk > innen):
                out[y, xk] = farbe
    return out


def blinzeln(i):
    return (19 <= i <= 21) or (41 <= i <= 42)


# ── Atmen: der Oberkörper hebt sich (Füße bleiben am Boden) ─────────────────────────────────────────────────────────────────────
ATEM_PER = 24                                              # zwei Atemzüge pro Schleife
ATEM_Y1, ATEM_Y2 = PAD_T + 39, PAD_T + 41                  # Bauchzeilen mit Textur (unter den Flügeln, nicht Gesicht/Hals): hier wird je eine Zeile eingefügt


def atem(i):
    """(n1, n2): 0/1 eingefügte Zeile an Bauchzeile y 41 (n2, zuerst) und y 39 (n1, mit Nachlauf) → Kopf, Flügel, Gitarre, Feuer heben sich um 0 … 2 px (zweistufig), die Beine bleiben stehen."""
    u = 0.5 * (1 - math.cos(2 * math.pi * i / ATEM_PER))
    return (1 if u >= 0.75 else 0), (1 if u >= 0.25 else 0)


def atmen_ebene(a, n1, n2):
    """Anwendung auf eine Ebene: Zeilen oberhalb der Bauchzeilen rücken um n1 + n2 hoch (die Zeilen y 39/41 werden mit Texturmischung `L.streck_zeile` eingefügt), darunter bleibt alles stehen."""
    if n2:
        a = L.streck_zeile(a, ATEM_Y2, n2)
    if n1:
        a = L.streck_zeile(a, ATEM_Y1 - n2, n1)
    return a


def flügel_links(t):
    """Linker Flügel schwingt für sich (eigene Periode 24 und 12, nicht an Gitarre oder rechten Flügel gekoppelt), Ausschlag in px (negativ = links); bei t = 0 genau 0."""
    return 2.6 * math.sin(2 * math.pi * t / 24.0) + 0.8 * math.sin(2 * math.pi * t / 12.0)


TEST_EBENEN = ('figur',)                                    # für den Randpixel-Test: ohne Funken


def frame(i, partikel=True, nur=None):
    ebenen = nur if nur is not None else TEST_EBENEN
    if nur is not None:
        partikel = False
    a = schwenk(i)
    n1, n2 = atem(i)
    hub = n1 + n2
    schichten = []
    if 'figur' in ebenen:
        rest = REST
        if blinzeln(i):
            rest = rest.copy()
            for (x, y) in AUGEN:
                rest[PAD_T + y, PAD_L + x, :3] = LID
        fl_l = HB.zeilen_schub(FL_L, arm_dx(flügel_links(i), 26, 31))
        fl_r = HB.zeilen_schub(FL_R, arm_dx(a, 26, 31))
        str_l = strang_schwingen(STR_L, True, i, 24.0, 2.2)
        str_r = strang_schwingen(STR_R, False, i, 16.0, 2.0, lag=1.5)
        feuer = FEUER.ebene(i, neigung=round(wind(i)))
        feuer[SPERRE] = 0
        feuer = A.verbinde4(HB.zeilen_schub(feuer, schub_fn(a, kippen(i), 16)))[0]
        gitarre = A.verbinde4(HB.zeilen_schub(GITARRE, schub_fn(a, kippen(i))))[0]
        m_hals = L.farbmaske(gitarre, HALS_FARBEN)
        hals = np.where(m_hals[..., None], gitarre, 0).astype(np.uint8)                 # Hals getrennt: eigene Umrissfarbe beim Randpixel-Test
        gitarre = np.where(m_hals[..., None], 0, gitarre).astype(np.uint8)
        # Atmen: jede Ebene bekommt dieselbe Zeilenabbildung (Oberkörper hebt sich, Beine bleiben)
        teile = [atmen_ebene(e, n1, n2) for e in (UNTER_L, UNTER_R, fl_l, fl_r, str_l, str_r, rest, gitarre, hals, feuer)]
        un_l, un_r, fl_l, fl_r, str_l, str_r, rest, gitarre, hals, feuer = teile
        schichten += [(un_l, 0, 0, 1), (un_r, 0, 0, 2), (fl_l, 0, 0, 1), (fl_r, 0, 0, 2), (str_l, 0, 0, 3), (str_r, 0, 0, 4), (rest, 0, 0, 5),
                      (gitarre, 0, 0, 6), (hals, 0, 0, 8), (feuer, 0, 0, 7)]
    f, karte = B.zusammen_mit_karte(H, W, schichten)
    B.umriss_je_ebene(f, karte, ERLAUBT, UMRISS)
    return f


def zuschneiden(frames, rand=2):
    """Frame auf die Figur zuschneiden und zentrieren: Vereinigung aller Frames + `rand` px, symmetrisch um die Ruhefigur."""
    a = np.stack([f[..., 3] > 0 for f in frames]).any(axis=0)
    ys, xs = np.nonzero(a)
    x0, y0, x1, y1 = int(xs.min()) - rand, int(ys.min()) - rand, int(xs.max()) + rand, int(ys.max()) + rand
    cx = PAD_L + (sw - 1) / 2.0
    half = int(math.ceil(max(cx - x0, x1 - cx)))
    x0, x1 = int(round(cx - half)), int(round(cx + half))
    print('Figur x', int(xs.min()), '…', int(xs.max()), 'y', int(ys.min()), '…', int(ys.max()), '→ Ausschnitt x', x0, x1, 'y', y0, y1)
    return [f[y0:y1 + 1, x0:x1 + 1].copy() for f in frames]


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    frames = zuschneiden(frames)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('metal-harpyformer', 'Metal Harpyformer', frames, MS, prev)
    if prev:
        L.streifen(prev + '/metal-harpyformer-strip.png', frames, spalten=8, scale=5)
