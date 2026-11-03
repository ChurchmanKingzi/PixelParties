# -*- coding: utf-8 -*-
"""Idle-Animation für „Steam Dwarf Miner“ (Creature) — der Dampfzwerg mit dunkelroter Kapuze, drei Dampfrohren, weißem Bart und dem PRESSLUFTHAMMER vor dem Bauch.

Quelle: src/steam-dwarf-miner.png (22×40 px, 33 Farben) = Komposit aus drei Ebenen derselben xcf (Lage per xcf-Koordinaten, gegen die Kartenkunst Steam_Dwarf_Miner.png abgeglichen):
PICK: [["MotiveSteamDwarfs", 439, 1], ["MotiveSteamDwarfs", 437, 2], ["MotiveSteamDwarfs", 438, 1]]
  * Ebene 439 („Ebene #2“, 22×28 px bei (178,267)): der Zwerg (Kapuze, Rohre, Bart, Umhang) → src/steam-dwarf-miner-koerper.png zusammen mit
  * Ebene 437 („Ebene #4“, 20×5 px bei (179,287)): die beiden dunkelroten Ärmel-/Umhangenden unten seitlich (Teil der Kunst, 100 % Treffer)
  * Ebene 438 („Ebene #3“, 10×19 px bei (184,288)) = der PRESSLUFTHAMMER, der vorne vor dem Bart hängt (fehlte in der alten Fassung; Nutzer: „fehlt vorne der Presslufthammer“) → src/steam-dwarf-miner-hammer.png,
    im Komposit bei (6,21). In der Kartenkunst endet das Bild unten schon in der Bohrerspitze (die Karte schneidet ab); die Ebene zeigt den ganzen Hammer.
Aufruf:   python3 steam_dwarf_miner.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/steam-dwarf-miner.png + .json

Was im Sprite ist (x, y im 22×40-Komposit):
* DREI DAMPFROHRE (grau: (62,62,62) < (81,81,81) < (108,108,108)): links schräg (x 1–6, y 0–7), Mitte senkrecht (x 9–12, y 0–7), rechts schräg (x 15–20, y 0–7); oben offen und flach abgeschnitten.
* KAPUZE (y 8–13): dunkelrote Mütze (75,8,8)/(23,0,0)/(61,0,0) mit schwarzem Umriss; darunter ein dunkelgraues Brillenband (y 11–13).
* GESICHT (y 14–17, x 7–14): braune Brillenfassung (180,123,49), Haut (246,205,139)/(246,189,123)/(255,230,213), zwei verschiedene Augen: links ein hellblaues (172,213,255) Auge (8,16) mit weißem Pixel (8,17),
  rechts ein rotes Pixel (197,32,41) (12,17) (eine Art Linse); seitlich graue Ohr-/Brillenbügel.
* BART: weiß/hellgrau, y 17–26 (ab y 21 vom Hammer verdeckt), grauer Umriss seitlich.
* ÄRMEL/UMHANG links (x 0–5, y 16–26) und rechts (x 16–21, y 16–26): dunkelrot mit schwarzem Umriss; ihre Enden greifen links und rechts an den Hammerkasten.
* PRESSLUFTHAMMER (x 6–15, y 21–39): Kasten (10×5, dunkelbraun (35,15,15) mit Füllung (91,56,56) und vier roten Kontrolllampen (156,0,0) bei (8,23), (9,23), (12,23), (14,23)), darunter grauer Kragen (y 26–27: (77,76,74),
  (105,108,113), (165,169,172)), dann der Bohrer (graues Metall, verjüngt sich bis zur 1-px-Spitze bei (11,39)).
Metall im Sprite: Rohre, Hammerkragen und Bohrer (Regel 14) — nur dort Glanz; Kapuze, Bart, Umhang, Haut, Hammerkasten (braun) glänzen nicht.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* Auf und ab (Periode 24 = zweimal pro Schleife): die Bartzeile 22 des Zwergs (hinter dem Hammerkasten verborgen) wird einmal doppelt eingefügt (L.streck_zeile): Kapuze, Rohre, Gesicht und die oberen Ärmel steigen 1 px,
  der Hammer bleibt unten (die Ärmelenden am Kasten bleiben, die Arme „strecken“ sich).
* PRESSLUFTHAMMER RATTERT (Frames 4–15 und 28–39, je 12 Frames): der ganze Hammer samt den beiden Ärmeln (die ihn halten) stößt jeden zweiten Frame 1 px nach unten und wieder zurück (Rüttelbewegung 0 / +1; die Bohrerspitze
  taucht dabei 1 px tiefer, beim Rückstoß schaut hinter dem Kasten ein Stück Bart hervor — es ist die verdeckte Bartzeile 21 der Ebene 439); der Zwerg selbst (Kapuze, Gesicht, Bart) und die Rohre bleiben stehen. Die vier roten Kontrolllampen
  am Kasten blinken in den Rattern-Frames abwechselnd links/rechts (Lampe = dieselbe rote Farbe oder die Füllfarbe des Kastens). Zwischen den Rattern (Frames 16–27, 40–3) steht der Hammer still.
* Dampfrohre (Runde 3, Nutzer: „die Auspuffrohre bewegen sich viel zu stark!“): kein Zittern mehr, auch nicht beim Rattern. Jedes Rohr neigt nur noch seine obersten ZWEI Zeilen 1 px zur Seite, jeweils 7 Frames lang,
  zweimal je Schleife, bei jedem Rohr zu anderer Zeit (links Frames 9–15 und 33–39 nach rechts, Mitte 17–23 nach rechts / 41–47 nach links, rechts 1–7 und 25–31 nach links); jedes Rohr bleibt 4-verbunden.
  Übrige Rohrbewegung: nur das 1-px-Auf-und-ab des ganzen Zwergs.
* Blinzeln (Frames 19–21 und 40–42): beide Augen schließen sich — Iris/Weiß/Rot nehmen die umgebende Hautfarbe an (links (8,16) und (8,17) → Haut (246,205,139), rechts (12,17) → Haut (246,189,123)).
* Dampf steigt aus allen drei Rohren auf (Partikel): sechs runde Dampfwölkchen (anim_dwarf.puff: wachsen aus 2×2 auf 5×3 bzw. 4×4 und schrumpfen wieder) in Weiß/Hellgrau steigen langsam bis 4 px auf (Periode 24 Frames,
  je Rohr zwei Wölkchen um eine halbe Periode versetzt), hinter der Figur.
* Metall glänzt (Regel 12/14: nur Metall): ein Lichtband läuft zweimal pro Schleife diagonal über die Rohre (Frames 3–16 und 27–40) und je einmal über Hammerkragen und Bohrer (Frames 16–27 und 40–47); je ein vierzackiger
  Glitzer-Stern an der linken Rohrspitze (Frames 10–13), an der rechten (26–29) und an der mittleren (40–43).
Frame 0 = Original (Ruhepose), der Dampf ausgenommen. Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine (der Hammer verdeckt den Bart ohnehin; beim Rattern überdeckt er nur Zeilen, die schon im Original verdeckt sind; die Ärmel bewegen sich als Ganzes).
"""
import math
import sys

import numpy as np

import anim_dwarf as Dw
import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 62
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 9, 3          # Rohrzittern ±1 px, Dampf bis 4 px über den Rohren, Hammer drückt beim Rattern 1 px tiefer (Spitze: +1)

spr = L.lade('steam-dwarf-miner')
koerper = L.lade('steam-dwarf-miner-koerper')
hammer = L.lade('steam-dwarf-miner-hammer')
HX, HY = 6, 21                                    # Lage des Hammers im Komposit
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
kh, kw = koerper.shape[:2]
yy, xx = np.mgrid[0:kh, 0:kw]
vorhanden = L.deckend(koerper)


def f(x, y):
    return tuple(int(v) for v in koerper[y, x, :3])


PIPE_RAMPE = [(62, 62, 62), (81, 81, 81), (108, 108, 108), (156, 156, 156), (189, 189, 189)]
HAMMER_RAMPE = [(77, 76, 74), (105, 108, 113), (165, 169, 172)]
WEISS, HELLGRAU, MITTELGRAU = (246, 255, 255), (189, 189, 189), (156, 156, 156)
HAUT_L, HAUT_R = (246, 205, 139), (246, 189, 123)                 # Hautfarben neben dem linken bzw. rechten Auge
UMHANG_FARBEN = {(0, 0, 0), (84, 0, 0), (61, 0, 0), (23, 0, 0), (110, 0, 0), (47, 0, 0), (32, 24, 0), (27, 27, 27), (75, 8, 8), (35, 15, 15)}
LAMPE, KASTEN = (156, 0, 0), (91, 56, 56)

# Teile des Körpers: Ärmel (links/rechts, ab Zeile 16, nur dunkle Umhangfarben) und der Rest (Kopfteil)
arm_l = vorhanden & (xx <= 5) & (yy >= 16)
arm_r = vorhanden & (xx >= 16) & (yy >= 16)
for m in (arm_l, arm_r):
    for (y, x) in zip(*np.nonzero(m)):
        if f(x, y) not in UMHANG_FARBEN:
            m[y, x] = False
kopfteil = vorhanden & ~arm_l & ~arm_r

KANTE0 = Hm.kantenmaske(spr)
ERLAUBT = Hm.umrissfarben(spr)                                    # Farben der Außenkante im Original (Regel 16)
m_rohr = np.array([[bool(vorhanden[y, x] and y <= 7 and f(x, y) in PIPE_RAMPE and not KANTE0[y, x]) for x in range(kw)] for y in range(kh)])
# Hammer-Metall (Kragen + Bohrer), Maske in Hammer-Koordinaten (ohne Kasten)
m_hammer = np.array([[bool(hammer[y, x, 3] and y >= 5 and tuple(int(v) for v in hammer[y, x, :3]) in HAMMER_RAMPE) for x in range(hammer.shape[1])]
                     for y in range(hammer.shape[0])])

ROHRE = {'l': (0, 6), 'm': (8, 13), 'r': (15, 21)}               # x-Bereich je Rohr für das Zittern (Zeilen 0–2)
BURSTS = (4, 28)                                                  # Beginn der Rattern-Fenster (je 12 Frames)


# Runde 3 (Nutzer: „die Auspuffrohre bewegen sich viel zu stark!“): die Rohre zittern nicht mehr. Jedes Rohr neigt nur noch die obersten ZWEI Zeilen für kurze Zeit (7 Frames) um 1 px — zweimal je Schleife,
# bei jedem Rohr zu anderer Zeit, nie beim Hammerrattern. Sonst stehen die Rohre still (außer dem 1-px-Auf-und-ab des ganzen Zwergs).
ROHR_EREIGNISSE = {'l': ((9, 1), (33, 1)), 'm': ((17, 1), (41, -1)), 'r': ((1, -1), (25, -1))}      # (Start-Frame, Richtung) je 7 Frames


def rohr_stufe(i, name):
    for start, richtung in ROHR_EREIGNISSE[name]:
        if 0 <= (i - start) % N < 7:
            return richtung
    return 0


def rattern(i):
    """(k, aktiv): k = Frame im Rattern-Fenster oder None."""
    for s in BURSTS:
        k = i - s
        if 0 <= k < 12:
            return k
    return None


def teil(maske_):
    t, _ = L.trenne(koerper, maske_)
    return L.platz(t, H, W, PAD_L, PAD_T)


def frame(i, dampf=True, nur=None):
    if nur:
        dampf = False
    kp = teil(kopfteil)
    al = teil(arm_l)
    ar = teil(arm_r)
    ha = L.platz(hammer, H, W, PAD_L + HX, PAD_T + HY)
    gl = L.leer(H, W)
    k = rattern(i)
    # --- Blinzeln: Augenpixel nehmen die umgebende Hautfarbe an ---
    if Hm.folge(i, 19, [1, 1, 1], N) or Hm.folge(i, 40, [1, 1, 1], N):
        Hm.setze(kp, {(8, 16): HAUT_L, (8, 17): HAUT_L, (12, 17): HAUT_R}, OFF)
    # --- Metallglanz (Regel 14: nur Rohre und Hammer-Metall) ---
    for start in (3, 27):
        Hm.lichtband(kp, m_rohr, OFF, i, N, start, 14, PIPE_RAMPE, stufen=1, breite=3.0, achse=(1.0, 1.0), kern=2)
    for start in (16, 40):
        Hm.lichtband(ha, m_hammer, (PAD_L + HX, PAD_T + HY), i, N, start, 8, HAMMER_RAMPE, stufen=1, breite=3.0, achse=(1.0, 1.0), kern=2)
    # --- Dampfrohre neigen sich nur leicht (oberste zwei Zeilen ±1 px, selten) ---
    for name, (x0, x1) in ROHRE.items():
        a = rohr_stufe(i, name)
        if a and k is None:                                                       # beim Hammerrattern bleiben die Rohre ruhig
            Hm.bereich_versatz(kp, OFF, {y: a for y in (0, 1)}, x0, x1)
    # --- Auf und ab: Bartzeile 22 (hinter dem Hammer verborgen) wird einmal doppelt eingefügt; Ärmel gleichermaßen ---
    brust = Hm.stufe(i, N / 2, 1)
    if brust:
        kp = L.streck_zeile(kp, PAD_T + 22, brust)
        al = L.streck_zeile(al, PAD_T + 22, brust)
        ar = L.streck_zeile(ar, PAD_T + 22, brust)
    # --- Presslufthammer rattert: Hammer + Ärmel stoßen jeden zweiten Frame 1 px nach unten (Rüttelbewegung 0 / +1), der Zwerg selbst bleibt stehen ---
    if k is not None:
        dh = 1 if k % 2 else 0
        ha, al, ar = L.versetze(ha, 0, dh), L.versetze(al, 0, dh), L.versetze(ar, 0, dh)
        links = (k % 4) < 2                                                       # 0,1: links an / 2,3: rechts an
        Hm.setze(ha, {(2, 2): LAMPE if links else KASTEN, (3, 2): LAMPE if links else KASTEN,
                      (6, 2): KASTEN if links else LAMPE, (8, 2): KASTEN if links else LAMPE}, (PAD_L + HX, PAD_T + HY + dh))
    fig = L.zusammen(H, W, [(al, 0, 0), (ar, 0, 0), (kp, 0, 0), (ha, 0, 0)])
    Hm.kontur_schliessen(fig, ERLAUBT, (0, 0, 0))                  # Regel 16: Außenkante in jeder Pose in Umrissfarbe
    # --- Glitzer-Sterne an den Rohrspitzen (Effekt über der Figur) ---
    for (sx, sy, start) in (() if nur else ((2, 1, 10), (19, 1, 26), (10, 1, 40))):
        st = Hm.folge(i, start, [0, 1, 2, 1], N)
        Hm.stern4(gl, sx, sy - brust, st, WEISS, HELLGRAU, MITTELGRAU, OFF)
    ebenen = []
    if dampf:
        py = PAD_T - 2                                             # Dampf startet knapp über der Rohrspitze, steigt bis 4 px auf
        spec = []
        for cx, off0, form in ((PAD_L + 2, 0, 'm'), (PAD_L + 11, 8, 'o'), (PAD_L + 19, 16, 'm')):
            spec.append(dict(x=cx, y=py, vx=0, vy=-4, off=off0, form=form, wackeln=0.8))
            spec.append(dict(x=cx, y=py, vx=0, vy=-4, off=off0 + 12, form='o' if form == 'm' else 'm', wackeln=-0.8))
        ebenen.append((Dw.puff(H, W, i % 24, 24, spec, {'c': WEISS, 'r': HELLGRAU}), 0, 0))
    ebenen += [(fig, 0, 0), (gl, 0, 0)]
    return L.zusammen(H, W, ebenen)


TEST_EBENEN = ('figur',)

if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    diff = Hm.ruhepose(frame(0, dampf=False, nur=True), spr, OFF)
    print('Ruhepose (ohne Dampf/Glitzer) weicht vom Original ab bei:', diff if diff else 'nichts')
    n = L.pruefe(frames, quelle=np.concatenate([spr, koerper[:, :, :]], axis=0))
    print('Pixel je Frame:', n)
    ohne = [frame(i, nur=True) for i in range(N)]
    print('Pixel je Frame (nur Figur):', [int((g[..., 3] > 0).sum()) for g in ohne])
    e0 = Hm.eckkontakt_typen(ohne[0])
    neu = {i: dict(Hm.eckkontakt_typen(g) - e0) for i, g in enumerate(ohne) if Hm.eckkontakt_typen(g) - e0}
    print('neue Eckkontakte (Figur ohne Dampf) gegenüber Frame 0:', neu if neu else 'keine')
    L.speichern('steam-dwarf-miner', 'Steam Dwarf Miner', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/steam-dwarf-miner-strip.png', frames, spalten=12, scale=4)
