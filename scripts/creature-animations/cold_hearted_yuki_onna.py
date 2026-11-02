# -*- coding: utf-8 -*-
"""Idle-Animation für „Cold-Hearted Yuki-Onna“ (Creature).

Quelle: src/cold-hearted-yuki-onna.png — Ebene „Yuki Onna“ (Motive.xcf, Ebene 760). Die Ebene ist in der Quelle selbst ein 2×-vergrößerter Sprite (32×46 px, jedes Bildpunkt-Paar ein
exakter 2×2-Block; 1040 Pixel, Ebenen-Deckkraft 204 → in der Karte halbtransparent); ich arbeite deshalb auf dem ECHTEN Raster 16×23 (260 Pixel, 19 Farben, 1 Komponente) und vergrößere jeden
Frame am Ende um den Faktor 2 (nearest) — alle Bewegungen sind damit ganze Vielfache von 2 Ausgabepixeln und die Figur behält ihre groben 2×2-Pixel. Der Frame ist 2×-Raster.
Nicht Teil dieses Sprites: das „Heart of Ice“ (Ebene 757, 10×8) und die durchscheinenden Geisterkinder links/rechts/auf der Brust der Karte (andere Ebenen).
PICK: [["Motive", 760, 1]]

Aufruf:   python3 cold_hearted_yuki_onna.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/cold-hearted-yuki-onna.png + .json

Was ist was (im 16×23-Raster; Ausgabe = ×2):
* Lange schwarze Haare (x 2–13, y 0–11; Töne (15,3,7)/(17,15,18)/(29,27,38)/(54,50,71)/(5,4,10)): Scheitel oben, zwei Strähnen links (x 2–3) und rechts (x 12–13) bis y 10.
* Gesicht (x 6–9, y 4–11): schmale, nach unten spitze Raute in blassem Lavendel (188,198,233) mit hellen Flecken (220,217,235)/(207,213,233) und zwei weißen Pixeln (248,254,255) bei (6,8) (9,8); kein Auge erkennbar.
* Kimono (x 2–13, y 11–22): dunkles Blaugrün (19,45,58)/(14,30,46) mit weißen Kragenstreifen (243,254,255) bei y 12–13, eisblauen Zierpixeln (198,225,234)/(99,153,181) und blauen
  Brust-Pixeln (36,50,85)/(67,76,117)/(15,31,65) in der Mitte (7–8, 15–16) (dort liegt in der Karte das Herz aus Eis); Ärmel/Hände (x 0–3 und 12–15, y 14–17) in Lavendel (188,198,233)/(220,217,235); Saum y 19–22.
Fest bleiben: Gesicht, Kimonoform, Kragen, Brustmitte.

Halbtransparenz: JSON-Feld `deckkraft: 0.5` (L.speichern extra) — im Sprite selbst bleibt Alpha 0/255; die Quellebene hatte 80 % Deckkraft, der Nutzer verlangt „halbtransparent“ (Annahme: 50 %).

Ablauf (48 Frames à 65 ms = 3,12 s; Frame 0 = Original, Nebel ausgenommen) — Eis glänzt nicht (Regel 14), kein Feuer (Regel 15):
* Atmen (Periode 24, 0/1 Rasterpixel = 2 Ausgabepixel): die dunkle Kragenzeile y 13 wird eingefügt, Kopf mit Haaren und Schultern heben sich, Hände, Kimono unten und Saum bleiben stehen.
* Haare wehen im Wind (Runde 2, Nutzerfeedback wörtlich: „Die Haare sollen eher im Wind wehen als sich so seltsam seitwärts zu bewegen. Außerdem muss sie halbtransparent sein.“): früher schwangen zwei starre Strähnenblöcke
  (x 2–3 / 12–13) ±1 Rasterpixel hin und her — das las sich als seitliches Wackeln. Jetzt weht das Haar wie von einem Wind von links: die Haarzeilen y 5–11 (alle Haartöne (15,3,7)/(17,15,18)/(29,27,38)/(5,4,10)/(54,50,71)/(0,2,0))
  verschieben sich als FLIESSENDE Welle nach rechts (Windrichtung) — Versatz je Zeile `wind_dx`: Böe (Periode 24 = zweimal je Schleife) × (Abstand zur Wurzel)^1,2 plus eine Welle (Periode 16, Läufe von der Wurzel zur Spitze,
  Phase wandert mit der Zeile), Wurzel y 5 bleibt, Spitze bis 3 Rasterpixel, Gefälle zwischen benachbarten Zeilen ≤ 1 Rasterpixel, nie negativ (in der Flaute liegt das Haar wieder wie im Original). Rechts bleiben in den Zeilen,
  die ans Gesicht grenzen (y 5–9), die ersten dx Originalpixel als „Haar hinter dem Gesicht“ stehen (keine Lücke, das Gesicht behält seinen dunklen Rand); die freie Spitze (y 10–11) löst sich vom Hals und weht frei (nur über die
  Zeile darüber 4-verbunden — pro Frame geprüft). Links drückt der Wind das Haar gegen das Gesicht (Versatz ≤ 1, Gesicht/Kragen liegen darüber). Es werden keine Spalten kopiert, nichts wird breiter als die verschobene Zeile.
  Gesicht, Kragen und Kimono liegen als Basis über dem Haar.
* Ärmel/Hände schwingen starr (links ±1 Rasterpixel Periode 16, rechts 0…1 Rasterpixel nach außen Periode 24 — bei 2 Rasterpixeln rissen früher einzelne Handpixel vom Ärmel ab), der Saum (y ≥ 21) weht ±1 Rasterpixel mit Nachlauf (Periode 16).
* Eisnebel (Partikel, hinter der Figur, 6 Stück, Lebensdauer 48 Frames, langsam aufsteigend, leichtes Wabern): runde Eiswölkchen aus 1×1 bis 2×2 Rasterpixeln (= 2×2 bis 4×4 Ausgabepixel, nie kleiner als 2×2),
  Kern (198,225,234) bzw. (243,254,255), Rand (188,198,233) bzw. (198,225,234); sie steigen an den Seiten der Figur auf.
Randpixel-Test (Regel 16): `U.kontur_schliessen` auf dem Raster (Umrissfarbe (15,3,7)); im Ruhebild nichts. ERGÄNZUNG: keine gemalten Pixel (die Haar-Originalpixel hinter dem Gesicht sind Quellpixel).
Zuschnitt: der Frame ist auf die Figur zugeschnitten (symmetrisch um die Ruhefigur; der Nebel vergrößert ihn höchstens 2 Rasterpixel = 4 Ausgabepixel darüber hinaus, dazu 1 Rasterpixel leerer Rand).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Rasterpixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U

N, MS = 48, 65
GPL, GPR, GPT, GPB = 5, 5, 5, 3                                  # Leinwand im 16×23-Raster

lo = L.lade('cold-hearted-yuki-onna')                            # echtes Raster 16×23
lh, lw = lo.shape[:2]
H, W = lh + GPT + GPB, lw + GPL + GPR
yy, xx = np.mgrid[0:lh, 0:lw]
vorhanden = L.deckend(lo)
col = lambda x, y: tuple(int(v) for v in lo[y, x, :3])
UMRISS = U.umrissfarben(lo)
KONTUR = (15, 3, 7)
assert KONTUR in UMRISS


def hoch(a):
    """2×-Vergrößerung (nearest): jedes Rasterpixel = 2×2 Ausgabepixel."""
    return np.repeat(np.repeat(a, 2, axis=0), 2, axis=1)


spr = hoch(lo)                                                   # der Sprite in Ausgabeauflösung (32×46, wie in der Ebene)
sh, sw = spr.shape[:2]

HAARFARBEN = {(15, 3, 7), (17, 15, 18), (29, 27, 38), (5, 4, 10), (54, 50, 71), (0, 2, 0)}      # Haartöne (B, E, F, H, K, Q der Pixelkarte)
ist_haar = np.array([[vorhanden[y, x] and col(x, y) in HAARFARBEN for x in range(lw)] for y in range(lh)])
FLUSS_Y0, FLUSS_Y1 = 5, 11                                       # Haarzeilen, die im Wind fließen (Wurzel y 5 bleibt, Spitze y 11 am freiesten)
haar_fluss = ist_haar & (yy >= FLUSS_Y0) & (yy <= FLUSS_Y1)      # alle Haarpixel y 5–11 (links x < 7, rechts x ≥ 7); Gesicht/Kragen liegen als Basis DARÜBER
hand_l = vorhanden & (xx <= 3) & (yy >= 14) & (yy <= 17)
hand_r = vorhanden & (xx >= 12) & (yy >= 14) & (yy <= 17)
saum = vorhanden & (yy >= 21)
basis_m = vorhanden & ~haar_fluss & ~hand_l & ~hand_r & ~saum

NEBEL1 = {'c': (198, 225, 234), 'r': (188, 198, 233)}
NEBEL2 = {'c': (243, 254, 255), 'r': (198, 225, 234)}
assert all(v in {col(x, y) for y in range(lh) for x in range(lw) if vorhanden[y, x]} for v in (*NEBEL1.values(), *NEBEL2.values()))
P = lambda x, y: (GPL + x, GPT + y)
PUFFS1 = [
    dict(x=P(0, 18)[0], y=P(0, 18)[1], vx=-1, vy=-10, off=0, form='s', wackeln=0.5),
    dict(x=P(14, 20)[0], y=P(14, 20)[1], vx=1, vy=-10, off=20, form='s', wackeln=0.5),
    dict(x=P(1, 8)[0], y=P(1, 8)[1], vx=-1, vy=-6, off=36, form='k', wackeln=0.5),
]
PUFFS2 = [
    dict(x=P(14, 8)[0], y=P(14, 8)[1], vx=1, vy=-6, off=10, form='k', wackeln=0.5),
    dict(x=P(0, 12)[0], y=P(0, 12)[1], vx=-1, vy=-8, off=26, form='s', wackeln=0.5),
    dict(x=P(15, 14)[0], y=P(15, 14)[1], vx=1, vy=-8, off=42, form='s', wackeln=0.5),
]


def teil(maske):
    t, _ = L.trenne(lo, maske)
    return L.platz(t, H, W, GPL, GPT)                           # sofort auf die volle Leinwand


def pend(i, amp, lag, per):
    f = lambda t: math.sin(2 * math.pi * (t - lag) / per)
    return int(round(amp * (f(i) - f(0))))                       # 0 bei Frame 0


def wind_dx(i):
    """Versatz (ganze Rasterpixel, nach rechts = Windrichtung) der Haarzeilen y 5…11 im Frame i: eine Böe (Periode 24 = zweimal je Schleife) schiebt das Haar je tiefer, desto weiter nach rechts
    (Wurzel y 5 bleibt, Spitze bis 3 px, nie mehr), dazu läuft eine Welle (Periode 16, drei Läufe je Schleife) von der Wurzel zur Spitze nach unten. Frame 0 = 0 (beide Terme verschwinden). Gefälle zwischen
    benachbarten Zeilen ≤ 1 Rasterpixel, Versatz nie negativ (das Haar weht nur in die Windrichtung und kehrt in der Flaute in die Ruhelage zurück)."""
    g = 0.5 * (1 - math.cos(2 * math.pi * i / 24))                # Böe 0…1
    dx, vor = {}, 0
    for y in range(FLUSS_Y0, FLUSS_Y1 + 1):
        sx = (y - FLUSS_Y0) / (FLUSS_Y1 - FLUSS_Y0)               # 0 an der Wurzel … 1 an der Spitze
        k = 2.6 * sx
        welle = 1.2 * sx * (math.sin(2 * math.pi * i / 16 - k) - math.sin(-k))
        roh = 2.4 * g * sx ** 1.2 + welle
        d = max(0, min(3, int(round(roh))))
        d = max(vor - 1, min(vor + 1, d))                         # Gefälle ≤ 1
        dx[y] = d
        vor = d
    return dx


UNTERLAGE_Y1 = 9                                                 # bis hier grenzt das Haar ans Gesicht (y 5–9); darunter (y 10–11) hängt die freie Spitze neben dem Kragen


def haar_ebene(i, n, dx_l_max=1):
    """Fließende Haarsträhnen als eigene Ebene (unter dem Gesicht/Kragen): jede Zeile y 5…11 wird als Ganzes um wind_dx(y) nach rechts geschoben.
    * y 5–9 (Haar grenzt ans Gesicht): Versatz höchstens 2 (links 1: dort weht das Haar gegen das Gesicht und verschwindet dahinter); rechts bleiben die ersten dx Originalpixel der Zeile stehen
      (Haar hinter dem Gesicht → keine Lücke am Gesicht, das Gesicht behält seinen dunklen Rand).
    * y 10–11 (freie Spitze, 3 bzw. 1 Pixel): Versatz bis 3, die Spitze löst sich vom Hals und weht frei im Wind (nur noch über die Zeile darüber verbunden).
    Es werden keine Spalten kopiert. Oberhalb von y 5 (Scheitel) bleibt alles stehen.
    Zusammenhang: Jede Zeile berührt die Zeile darüber über eine KANTE (4-verbunden, nicht nur diagonal) — die schmale Spitze darf nie weiter wegwandern, als die Zeile darüber reicht: der Versatz wird dann
    Schritt für Schritt zum Versatz der Zeile darüber zurückgenommen. Gefälle zwischen benachbarten Zeilen ≤ 1 Rasterpixel."""
    out = L.leer(H, W)
    dx = wind_dx(i)
    vor = {'l': (0, None), 'r': (0, None)}                          # (Versatz, Spaltenmenge) der Zeile darüber je Seite
    for y in range(FLUSS_Y0, FLUSS_Y1 + 1):
        for seite in ('l', 'r'):
            xs_ = sorted(x for x in range(lw) if haar_fluss[y, x] and ((x < 7) == (seite == 'l')))
            if not xs_:
                continue
            frei = y > UNTERLAGE_Y1
            dd = dx[y] if frei else min(dx[y], 2)
            if seite == 'l':
                dd = min(dd, dx_l_max)
            vd, vmenge = vor[seite]
            dd = max(vd - 1, min(vd + 1, dd))                       # Gefälle ≤ 1 auch nach der Begrenzung

            def spalten(d):
                m = {x + d for x in xs_}
                if seite == 'r' and not frei:
                    m |= set(xs_[:d])                               # Originalpixel hinter dem Gesicht
                return m

            if vmenge is not None:
                while dd != vd and not ({x + dd for x in xs_} & vmenge):      # 4-verbunden mit der Zeile darüber, sonst Versatz zurücknehmen
                    dd += 1 if vd > dd else -1
            m = spalten(dd)
            vor[seite] = (dd, m)
            for x in m:
                src = x - dd if (x - dd) in xs_ else x              # verschobenes Pixel bzw. Original (Gesichtsseite)
                out[GPT + y - n, GPL + x] = lo[y, src]
    return out


def frame_gross(i, nur=None):
    n = U.stufe(i, 24, 1)                                        # Atmen 0/1 Rasterpixel
    d_al, d_ar = pend(i, 1.0, 0, 16), pend(i, 0.5, 5, 24)         # Hände (rechts 0…1 px nach außen; bei 2 px risse ein Handpixel vom Ärmel ab)
    d_s = pend(i, 1.0, 3, 16)                                    # Saum
    bs = L.streck_zeile(teil(basis_m), GPT + 13, n)
    koerper = L.zusammen(H, W, [(teil(saum), d_s, 0), (teil(hand_l), d_al, 0), (teil(hand_r), d_ar, 0), (haar_ebene(i, n), 0, 0), (bs, 0, 0)])
    koerper = U.kontur_schliessen(koerper, UMRISS, KONTUR)
    if nur == 'koerper':
        return koerper
    n1 = _glut(H, W, i, N, PUFFS1, NEBEL1)
    n2 = _glut(H, W, i, N, PUFFS2, NEBEL2)
    return L.zusammen(H, W, [(n1, 0, 0), (n2, 0, 0), (koerper, 0, 0)])


TEST_EBENEN = 'koerper'                                          # randtest.py: nur die Figur ohne Eisnebel prüfen
_OHNE_PARTIKEL = [False]


def _glut(*a, **k):
    """Partikelebene (leer, wenn nur die Figur gerendert wird — für den Zuschnitt)."""
    if _OHNE_PARTIKEL[0]:
        return L.leer(a[0], a[1])
    return U.glut_ebene(*a, **k)


# Zuschnitt auf die Figur im Raster: symmetrisch um die Ruhefigur; der Nebel darf den Frame höchstens 2 Rasterpixel über den Figurenrand hinaus vergrößern
BOX = U.zuschnitt([frame_gross(i) for i in range(N)], [frame_gross(i, 'koerper') for i in range(N)], (GPL, GPT, GPL + lw, GPT + lh))
PAD_L, PAD_T = 2 * (GPL - BOX[0]), 2 * (GPT - BOX[1])           # Versatz des Sprites im AUSGABE-Frame (2×-Raster)


def frame(i, nur=None):
    return hoch(U.beschneiden(frame_gross(i, nur), BOX))


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr, min_rand=2)
    L.speichern('cold-hearted-yuki-onna', 'Cold-Hearted Yuki-Onna', frames, MS, prev, extra={'deckkraft': 0.5})
    if prev:
        L.streifen(prev + '/cold-hearted-yuki-onna-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 42)], spalten=4, scale=4)
