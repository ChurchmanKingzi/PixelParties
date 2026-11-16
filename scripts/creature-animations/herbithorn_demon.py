# -*- coding: utf-8 -*-
"""Idle-Animation für „Herbithorn Demon“ (Creature, Archetyp Cycling Demons — Element: Ranken/Dornen).

Quelle: src/herbithorn-demon.png — Ebene „Herbithorne“ (81×33 px, 723 Pixel, 16 Farben) aus MotiveGrailWar.xcf (Ebene 550; sie steht NICHT in der Treffersuche, weil sie nicht als Figur der Karte erkannt wurde —
gefunden über den Ebenennamen, die Farben (Grün (87,157,87)/Rosa (194,134,134)) und den Abgleich mit der Kartenkunst data/card-art/native/Herbithorn_Demon.png: die dornigen Ranken ziehen sich dort quer über die Karte).
PICK: [["MotiveGrailWar", 550, "ganze Ebene (eine Figur, Alpha 0/255)"]]
Die Quelle war vollständig (Dämon samt beiden Dornenranken, eine zusammenhängende Figur).

Aufruf:   python3 herbithorn_demon.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/herbithorn-demon.png + .json

Was ist was (x/y im Sprite):
* Mitte (x 29–50, y 0–32) = der Pflanzendämon: Kopf (x 35–44, y 10–19; Grün (87,157,87) mit hellerem Rand (169,214,121) und dunklem Umriss (35,67,0)), zwei dunkelgrüne Augenschlitze
  (38,13–14) und (41,13–14) (je 1×2 px, Farbe (49,90,32), mit dunklerer Braue (40,78,29) darüber), ein graugrüner Mundfleck (38–41,16) (39–40,17) (Farben (103,134,93)/(128,152,118)).
* Zwei Blattfühler (Antennen, x 29–37 / x 44–51, y 0–8): dunkelgrüne Stiele mit limettengrünen Blattspitzen ((121,175,64)/(144,188,77)) und rosa Knospen am Ansatz ((33–36,7–9) und (43–46,7–9)).
* Rosa Knospen an den Schultern (31–34,17–19) und (47–50,17–19), eine rosa Blüte auf der Brust (38–41,22–24) und rosa Knospen an den Knien (35–38,28–30) / (41–44,28–30).
* Arme (y 19–22): waagerecht gespreizte Blattarme mit hellem Limettenstreifen (31–34,20) / (46–49,20); aus den Armspitzen wachsen die zwei langen Dornenranken (Ranken: Umriss (46,58,0),
  helles Oliv (142,156,107) für die Dornen/Fasern; links x 0–28, rechts x 51–80, y 13–26) — wellenförmig, dornig, werden zum Ende hin dünner.
* Hüftdornen (32–34,24–28) und (45–48,24–27) (Rankenfarben) — Stacheln an den Beinen, bleiben an den Beinen. Beine (35–38 / 41–44, y 25–32) mit Blattfüßen.
Fest bleiben: Gesichtsform, Mund, Blüte, Hüftdornen, Beine/Füße (stehen am Boden).

Ablauf (48 Frames à 65 ms = 3,12 s; Frame 0 = Original, Sporen ausgenommen):
* Beide Dornenranken wellen, unabhängig (links Periode 24, rechts Periode 16): jede Spalte wandert senkrecht, je weiter vom Arm entfernt, desto mehr (Spitze bis ±3 px), mit Wellenlauf
  (die Spitze hinkt hinterher); der Zusammenhang der dünnen Ranken bleibt 4-verbunden (anim_flieger.fluegel_welle zusammenhang=True), die Dornen wandern als Teil der Spalte mit.
  Beide Ranken steigen mit den Armen beim Atmen.
* Atmen zweistufig 0-1-2-1-0 px (Periode 24, zweimal pro Schleife): die Bauchzeile y 25 der Körpermitte (x 35–44) wird 1–2× eingefügt (anim_lib.streck_zeile mit Texturmischung); Brust, Arme, Kopf und Fühler steigen,
  Beine, Füße und Hüftdornen bleiben am Boden. Der Kopf folgt der Brust 2 Frames später (nie höher als die Brust, sinkt höchstens 1 px in die Schultern).
* Blattfühler wiegen sich (links Periode 24, rechts Periode 16, versetzt): die Zeilen über dem Ansatz (y < 9) wandern seitlich, bis ±2 px an der Blattspitze, mit Wellenlauf; Blattspitzen bleiben angewachsen.
* Blinzeln beider Augenschlitze (Lid = Gesichtsgrün (87,157,87)) Frame 9–11 und 33–35.
* Sporen/Blütenstaub (hinter der Figur, 7 Stück, Lebensdauer 48 Frames, langsam aufsteigend, leichtes Wabern, 2×2 → 3×3 → 2×2; Farben Limette (169,214,121) und Oliv (142,156,107) aus dem Sprite).
Kein Glanz/Glitzer (Pflanze, kein Metall — Regel 14), kein Feuer.
ERGÄNZUNG: keine gemalten Pixel nötig. Randpixel-Test: anim_untote.kontur_schliessen (Umrissfarben der Quelle).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle. Zuschnitt auf die Figur (Sporen höchstens 2 px darüber hinaus).
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_textur as TX   # texturierte Streckzeilen statt Zeilenkopien (Regel 43/49)
TX.umleiten()               # auch Streckaufrufe innerhalb der Gruppenmodule liefern texturierte Zeilen
import anim_untote as U
import anim_daemon as D

N, MS = 48, 65
GPL, GPR, GPT, GPB = 5, 5, 8, 6

spr = L.lade('herbithorn-demon')
sh, sw = spr.shape[:2]
H, W = sh + GPT + GPB, sw + GPL + GPR
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
col = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
UMRISS = U.umrissfarben(spr)
KONTUR = (35, 67, 0)
GESICHT = (87, 157, 87)
AUGE_FARBE = (49, 90, 32)
AUGEN = [(38, 13), (41, 13), (38, 14), (41, 14)]
assert all(col(x, y) == AUGE_FARBE for (x, y) in AUGEN) and col(36, 13) == GESICHT

ranke_l = vorhanden & (xx <= 28)
ranke_r = vorhanden & (xx >= 51)
koerper = vorhanden & ~ranke_l & ~ranke_r
fuehler_l = koerper & (yy <= 8) & (xx <= 39)
fuehler_r = koerper & (yy <= 8) & (xx >= 40)
kopf = koerper & (yy >= 9) & (yy <= 18) & ~fuehler_l & ~fuehler_r
dorn_l = koerper & (yy >= 24) & (xx <= 34)                    # Hüftdornen links (liegen an den Beinen)
dorn_r = koerper & (yy >= 24) & (xx >= 45)
beine = koerper & (yy >= 26) & (xx >= 35) & (xx <= 44)
brust = koerper & ~fuehler_l & ~fuehler_r & ~kopf & ~dorn_l & ~dorn_r & ~beine       # Arme, Schultern, Brust, Bauch bis y 25 (+ Hüfte bis y 25)
mitte = brust                                                  # Körpermitte, die beim Atmen gestreckt wird
assert (fuehler_l | fuehler_r | kopf | dorn_l | dorn_r | beine | brust | ranke_l | ranke_r).sum() == vorhanden.sum()

SPORE = {'c': (169, 214, 121), 'r': (142, 156, 107)}
assert all(v in {col(x, y) for y in range(sh) for x in range(sw) if vorhanden[y, x]} for v in SPORE.values())
P = lambda x, y: (GPL + x, GPT + y)
SPOREN = [
    dict(x=P(6, 14)[0], y=P(6, 14)[1], vx=-1, vy=-7, off=0, wackeln=1),
    dict(x=P(17, 13)[0], y=P(17, 13)[1], vx=1, vy=-6, off=20, wackeln=1),
    dict(x=P(26, 17)[0], y=P(26, 17)[1], vx=-1, vy=-7, off=34, wackeln=1),
    dict(x=P(56, 17)[0], y=P(56, 17)[1], vx=1, vy=-7, off=10, wackeln=1),
    dict(x=P(67, 16)[0], y=P(67, 16)[1], vx=-1, vy=-6, off=28, wackeln=1),
    dict(x=P(76, 18)[0], y=P(76, 18)[1], vx=1, vy=-7, off=42, wackeln=1),
    dict(x=P(40, 8)[0], y=P(40, 8)[1], vx=1, vy=-5, off=16, wackeln=1),
]

_OHNE_PARTIKEL = [False]


def spor(*a, **k):
    if _OHNE_PARTIKEL[0]:
        return L.leer(a[0], a[1])
    return D.klekse_ebene(*a, **k)


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, GPL, GPT)                           # sofort auf die volle Leinwand


# Teile auf der vollen Leinwand
T_RANKE_L, T_RANKE_R = teil(ranke_l), teil(ranke_r)
T_KOPF, T_FL, T_FR = teil(kopf), teil(fuehler_l), teil(fuehler_r)
T_BEINE, T_DL, T_DR, T_BRUST = teil(beine), teil(dorn_l), teil(dorn_r), teil(brust)
for m in (T_KOPF,):
    pass


def frame_gross(i, nur=None):
    n = U.stufe(i, 24, 2)                                         # Atmen 0-1-2-1-0
    n_kopf = min(n, U.stufe(i - 2, 24, 2))
    n_kopf = max(n_kopf, n - 1)
    # Ranken wellen
    rl = D.seiten_welle(T_RANKE_L, GPL + 29, 2.4, L.sinus(i, 24), potenz=1.15, lauf=1.9, nur_rechts=False)
    rl = D.seiten_welle(rl, GPL + 29, 0.9, L.sinus(i, 12), potenz=1.2, lauf=2.4, nur_rechts=False)          # zweite, schnellere Welle
    rr = D.seiten_welle(T_RANKE_R, GPL + 50, 2.2, L.sinus(i, 16), potenz=1.15, lauf=1.7, nur_rechts=True)
    rr = D.seiten_welle(rr, GPL + 50, 0.9, L.sinus(i, 24), potenz=1.2, lauf=2.2, nur_rechts=True)
    # Fühler wiegen sich
    fl = D.oben_pendel(T_FL, GPT + 9, 2.0, L.sinus(i, 24), potenz=1.0, lauf=1.0)
    fr = D.oben_pendel(T_FR, GPT + 9, 2.0, -L.sinus(i, 16), potenz=1.0, lauf=1.0)
    # Kopf
    kp = T_KOPF.copy()
    if i in (9, 10, 11, 33, 34, 35):
        for (x, y) in AUGEN:
            kp[GPT + y, GPL + x, :3] = GESICHT
    # Körper
    br = TX.streck_zeile(T_BRUST, GPT + 25, n)
    koerper_teile = [(rl, 0, -n), (rr, 0, -n), (T_BEINE, 0, 0), (T_DL, 0, 0), (T_DR, 0, 0), (br, 0, 0), (kp, 0, -n_kopf), (fl, 0, -n_kopf), (fr, 0, -n_kopf)]
    # Fühler/Kopf lösen sich beim Heben nicht vom Hals: Kopf ist maximal so hoch wie die Brust, Fühler gehören zum Kopf
    f = L.zusammen(H, W, koerper_teile)
    f = U.kontur_schliessen(f, UMRISS, KONTUR)
    if nur == 'koerper':
        return f
    sp = spor(H, W, i, N, SPOREN, SPORE)
    return L.zusammen(H, W, [(sp, 0, 0), (f, 0, 0)])


def _figur(i):
    return frame_gross(i, 'koerper')


BOX = U.zuschnitt([frame_gross(i) for i in range(N)], [_figur(i) for i in range(N)], (GPL, GPT, GPL + sw, GPT + sh))
PAD_L, PAD_T = GPL - BOX[0], GPT - BOX[1]
TEST_EBENEN = 'koerper'


def frame(i, nur=None):
    return U.beschneiden(frame_gross(i, nur), BOX)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr, min_rand=1)
    L.speichern('herbithorn-demon', 'Herbithorn Demon', frames, MS, prev)
    if prev:
        L.streifen(prev + '/herbithorn-demon-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 42)], spalten=2, scale=6)
