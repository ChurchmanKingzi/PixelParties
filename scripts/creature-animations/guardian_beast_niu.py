# -*- coding: utf-8 -*-
"""Idle-Animation für „Guardian Beast Niu“ (Creature) — gehörnte Kriegerin (Ochse) zwischen zwei senkrecht aufragenden weißen Klingen.

Quelle: src/guardian-beast-niu.png (26×45 px, 41 Farben).
PICK: [["MotiveGuardianBeasts", 80, 1]]      (Ebene „Niu #3“, Figur 1; Ebene 82 „Niu #1“ ist eine kleinere Pose derselben Figur, Ebene 83 „Niu“ hält die Klingen waagerecht,
Ebene 81 „Niu #2“ sind schwarze Bodenrisse — Szenenteil, nicht Teil der Figur)
Quelle vollständig: ja (Kopf, Hörner, Rumpf, Arme, beide Klingen in einer Ebene). Die Karte zeigt zusätzlich Bodenrisse (Ebene 81) und das dunkle Gestein — beides Szene.

Aufruf:   python3 guardian_beast_niu.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/guardian-beast-niu.png + .json

Identifikation (x, y im 26×45-Sprite):
* KLINGEN (x 0–2 links, 23–25 rechts, y 0–44): zwei hohe weiße Klingen (249,254,255); oben ein 1 px breiter Dorn (y 0–5), dann 3 px breit (y 6–33), unten lavendelfarben
  gesäumt (150,122,153) und zur Spitze hin hellviolett auslaufend (239,219,242)/(213,179,214)/(197,160,201). Die Hände (x 3–5 / 20–22, y 33–37) liegen an den Klingen.
* HÖRNER (x 4–9 / 16–22, y 3–19): oliv-goldene Hörner (144,134,67)/(198,189,92) mit dunklem Rand (91,76,45), je mit einem dünnen Aufsatz bis y 3.
* HELM/HAAR: dunkelgrauer Helm (y 11–17), schwarze Haarsträhnen seitlich des Gesichts (x 3–6 / 19–22, y 20–23), die diagonal nach außen hängen.
* GESICHT (x 8–17, y 17–24): Haut (213,164,98); Augen je 2 px breit/3 px hoch: links (9–10, 18–20), rechts (15–16, 18–20) in Rot (89,10,29) mit schwarzem/dunkelrotem Innenpixel
  und rosa Unterpixel; Mund y 20–23 mit hellen Fangzähnen (255,230,213)/(255,255,255) und dunkelrotem Rachen (113,0,0)/(156,0,0).
* SCHULTERBAND/HALS (y 25–29): grauer Schal/Schulterschutz (80,74,72)/(123,123,123) über die ganze Breite, V-förmiger Ausschnitt mit Haut bis y 27.
* RUMPF/ARME (y 29–41): dunkelroter Kittel (60,24,24)/(79,33,33) mit schrägem grauem Gurt (y 30–36), orange Gürtelschnallen (137,65,30)/(183,81,31) bei y 36–37, braune Ärmel, Hände (hautfarben).
* STIEFEL (y 37–41): dunkel (62,55,53)/(53,46,46) mit weißem Fleck (255,255,255) bei y 38–40 (Schnalle).
Nicht bewegt bleiben: Gesicht (außer Blinzeln), Hörner, Stiefel. Kein Feuer, keine Partikel.

Ablauf (48 Frames à 80 ms = 3,84 s, nahtlos):
* ATMEN: der Oberkörper (Schulterband, Kittel, Arme oberhalb der Hände, dazu Kopf mit Hörnern) hebt sich in einer Stufe um 1 px (Zeile 27 wird einmal eingefügt, mit Nachbartextur
  gemischt, L.streck_zeile) — die Stiefel/Hände/Klingen bleiben (die Hände halten die Klingen, deshalb stehen die Klingen still).
* KOPFNICKEN: der Kopf (Helm, Hörner, Gesicht, Haarsträhnen) sinkt in Frames 36–45 um 1 px in den Schal und hebt sich wieder (nur Senken/Heben, nie seitlich).
* BLINZELN: Frames 18–20 und 44–46 (Haut als Lid; erst Hälfte, dann ganz zu, dann Hälfte).
* HAARSTRÄHNEN: die unteren Enden der schwarzen Strähnen pendeln 1 px nach innen und wieder zurück (links/rechts gegenläufig, Periode 24).
* KLINGEN-GLITZER (Waffen = Metall, Regel 12): ein vierzackiger Stern blitzt für 5 Frames am oberen Dorn der linken (Frames 6–10) und später der rechten Klinge (Frames 30–34) auf;
  die Spitzen der Klingen (lavendelfarbener Auslauf) pulsieren eine Stufe heller/dunkler (Periode 16, beide Klingen versetzt).
Frame 0 = Ruhepose (Original). Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine (Kopf sinkt vor dem Schal, dabei wird nichts freigelegt).
"""
import os
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 80
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 6, 3

spr = L.lade('guardian-beast-niu')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
ERLAUBT = Hm.umrissfarben(spr)


def f(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


HAUT = f(8, 18)                                   # (213,164,98) Gesichtshaut
WEISS, C_, J_, N_ = f(1, 10), f(1, 37), f(1, 42), f(1, 44)
UMRISS = (0, 0, 0)

klinge_l = vorhanden & (xx <= 2)
klinge_r = vorhanden & (xx >= 23)
kopf_m = vorhanden & ~klinge_l & ~klinge_r & (yy <= 24)
rumpf_m = vorhanden & ~klinge_l & ~klinge_r & (yy > 24)

AUGE_L = [(9, 18), (10, 18), (9, 19), (10, 19), (9, 20), (10, 20)]
AUGE_R = [(15, 18), (16, 18), (15, 19), (16, 19), (15, 20), (16, 20)]

# Auslauf der Klingenspitzen (Mittelspalte x=1 bzw. x=24, y 34–44): Index in der Rampe [weiß, hell, mittel, dunkel] je Zeile
RAMPE = [WEISS, C_, J_, N_]
AUSLAUF_Y = list(range(34, 45))
AUSLAUF_IDX = [0, 0, 0, 1, 0, 0, 1, 1, 2, 2, 3]


def ebene(m, dx=0, dy=0):
    t, _ = L.trenne(spr, m)
    return L.platz(t, H, W, PAD_L + dx, PAD_T + dy)


def blinzeln(i):
    k = Hm.folge(i, 18, [1, 2, 1], N) or Hm.folge(i, 44, [1, 2, 1], N)
    return k or 0


def frame(i):
    brust = Hm.stufe(i, N, 1, 0.0)                                     # 0/1: Oberkörper-Hub
    nick = 1 if Hm.folge(i, 36, [1] * 10, N) else 0                      # Kopf sinkt
    # ── Körper (Schulterband abwärts): Atmen durch eine eingefügte Zeile 27 ──
    rumpf = ebene(rumpf_m)
    rumpf = L.streck_zeile(rumpf, PAD_T + 27, brust)
    # ── Kopf ──
    kopf = ebene(kopf_m)
    k = blinzeln(i)
    if k:
        zeilen = (18, 19) if k == 1 else (18, 19, 20)
        Hm.setze(kopf, {p: HAUT for p in AUGE_L + AUGE_R if p[1] in zeilen}, OFF)
    # Haarsträhnen: Enden (Zeilen 22–23) pendeln nach innen
    s = int(round(np.sin(L.sinus(i, 24)) + 0.0001))                      # −1/0/+1
    if s > 0:
        Hm.bereich_versatz(kopf, OFF, {22: 1, 23: 1}, 3, 6)
        Hm.bereich_versatz(kopf, OFF, {22: -1, 23: -1}, 19, 22)
    kopf = L.versetze(kopf, 0, -brust + nick)
    # ── Klingen ──
    kl = ebene(klinge_l)
    kr = ebene(klinge_r)
    # lavendelfarbener Auslauf pulsiert (links/rechts versetzt)
    for lay, x, vorz in ((kl, 1, 1), (kr, 24, -1)):
        sft = vorz * int(round(np.sin(L.sinus(i, 16)) * 1.0))
        pix = {}
        for y, idx in zip(AUSLAUF_Y, AUSLAUF_IDX):
            if idx > 0:                                                   # weiße Zeilen bleiben weiß, der Auslauf wandert eine Stufe
                pix[(x, y)] = RAMPE[max(0, min(3, idx + sft))]
        Hm.setze(lay, pix, OFF)
    # Glitzer: vierzackiger Stern am oberen Dorn
    for lay, cx, start in ((kl, 1, 6), (kr, 24, 30)):
        st = Hm.folge(i, start, [0, 1, 2, 1, 0], N)
        if st is not None:
            Hm.stern4(lay, cx, 2, st, WEISS, WEISS, WEISS, OFF)
    fig = L.zusammen(H, W, [(rumpf, 0, 0), (kl, 0, 0), (kr, 0, 0), (kopf, 0, 0)])
    Hm.kontur_schliessen(fig, ERLAUBT, UMRISS)
    return fig


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    diff = Hm.ruhepose(frames[0], spr, OFF)
    print('Ruhepose weicht vom Original ab bei:', diff if diff else 'nichts')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    e0 = Hm.eckkontakt_typen(frames[0])
    neu = {i: dict(Hm.eckkontakt_typen(g) - e0) for i, g in enumerate(frames) if Hm.eckkontakt_typen(g) - e0}
    print('neue Eckkontakte gegenüber Frame 0:', neu if neu else 'keine')
    L.speichern('guardian-beast-niu', 'Guardian Beast Niu', frames, MS, prev)
    if prev:
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/guardian-beast-niu-strip.png', frames, spalten=12, scale=4)
