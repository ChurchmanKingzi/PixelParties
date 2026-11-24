# -*- coding: utf-8 -*-
"""Kampagnen-Score · Lustige Szene → public/music/bgm_score_lustig.ogg                       Titel: „Banana Peel Polka“

Eine lustige Szene: Slapstick, Missgeschicke, albernes Durcheinander, aber liebevoll. Polka in C-Dur, 150 BPM, 4/4 mit Oompah (Tuba/Klavier). Klarinette und Xylophon spielen die Hauptmelodie (staccato, hüpfend),
das Fagott brummt hinterher, eine Pfeife (Schleifpfeife per Pitch-Bend) quietscht nach oben, die Posaune macht „Wah-wah“ nach unten, Becken und Snare setzen Pointen. Alles ist ein bisschen zu schnell
und zu eifrig — das ist der Witz.

  • **Ohrwurm** (A): „Dum-dum-dum-dum-dum-dum-DAA“ — sechs hüpfende Achtel und eine lange Note auf dem Akkordton, über C – G – C – G | C – F – C – G; im vierten Takt rutscht die Melodie chromatisch aus (D–F–A–G–F–E–D–C♯) —
    die Bananenschale.
  • **B** (Anschleichen und Stolpern): Pizzicato schleicht auf Zehenspitzen (a-Moll), die Klarinette flüstert, dann — Ausrutscher: Schleifpfeife runter, Wirbel, Becken, kurze Stille, weiter.
  • **C** (Verfolgungsjagd): flinke Achtel-Läufe über a-Moll – E – a-Moll – E | F – C – d-Moll – E, alle jagen hinterher.
  • Schluss-Refrain einen Ganzton höher (D-Dur), Ausklang auf G (Dominante) → zurück in die C-Dur-Intro. Leitmotiv „Freunde“ als Auftakt (Klarinette) und Schlusspointe (Xylophon).
Form (56 Takte ≈ 1:30): Intro 4 · A 8 · A' 8 · B 8 · C 8 · A'' 8 · A''' +2 8 · Outro 4
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
from score_common import pn, LEITMOTIVE
from score_kit import Kit

BPM, BARS = 150, 56
song = Song(BPM, BARS)
CH = {'C': (0, 'M'), 'G': (7, 'M'), 'F': (5, 'M'), 'Am': (9, 'm'), 'E': (4, 'M'), 'Dm': (2, 'm')}
kit = Kit(song, CH, seed=1930, tonic_pc=0)
hv, rng = kit.hv, kit.rng

song.inst('clarinet', 'clarinet', vol=90, pan=46)
song.inst('xylo', 'xylo', vol=82, pan=82)
song.inst('accordion', 'accordion', vol=72, pan=40)
song.inst('bassoon', 'bassoon', vol=78, pan=54)
song.inst('tuba', 'tuba', vol=92, pan=62)
song.inst('piano', 'piano', vol=74, pan=56)
song.inst('pizz', 'pizz', vol=80, pan=26)
song.inst('whistle', 'whistle', vol=84, pan=70)
song.inst('trombone', 'trombone', vol=76, pan=36)
song.inst('glock', 'glock', vol=60, pan=92)
song.inst('flute', 'flute', vol=72, pan=84)
kit.bend_setup('whistle', 'trombone')

A_CH = ['C', 'G', 'C', 'G', 'C', 'F', 'C', 'G']
A_MEL = [
    [('E5', .5), ('E5', .5), ('G5', .5), ('E5', .5), ('C5', .5), ('E5', .5), ('G5', 1)],
    [('D5', .5), ('D5', .5), ('F5', .5), ('D5', .5), ('B4', .5), ('D5', .5), ('G5', 1)],
    [('E5', .5), ('E5', .5), ('G5', .5), ('E5', .5), ('C5', .5), ('E5', .5), ('G5', 1)],
    [('D5', .5), ('F5', .5), ('A5', .5), ('G5', .5), ('F5', .5), ('E5', .5), ('D5', .5), ('C#5', .5)],   # ausgerutscht
    [('C6', .5), ('B5', .5), ('A5', .5), ('G5', .5), ('E5', .5), ('G5', .5), ('C6', 1)],
    [('A5', .5), ('A5', .5), ('C6', .5), ('A5', .5), ('F5', .5), ('A5', .5), ('C6', 1)],
    [('G5', .5), ('E5', .5), ('C5', .5), ('E5', .5), ('G5', 1), ('E5', 1)],
    [('D5', .5), ('F5', .5), ('B5', 1), (None, 2)],
]
C_CH = ['Am', 'E', 'Am', 'E', 'F', 'C', 'Dm', 'E']
C_MEL = [
    [('A5', .5), ('B5', .5), ('C6', .5), ('B5', .5), ('A5', .5), ('G#5', .5), ('A5', 1)],
    [('G#5', .5), ('A5', .5), ('B5', .5), ('A5', .5), ('G#5', .5), ('F#5', .5), ('E5', 1)],
    [('A5', .5), ('B5', .5), ('C6', .5), ('B5', .5), ('A5', .5), ('G#5', .5), ('A5', 1)],
    [('B5', .5), ('G#5', .5), ('E5', .5), ('G#5', .5), ('B5', 2)],
    [('C6', .5), ('A5', .5), ('F5', .5), ('A5', .5), ('C6', 2)],
    [('E6', .5), ('C6', .5), ('G5', .5), ('C6', .5), ('E6', 2)],
    [('D6', .5), ('A5', .5), ('F5', .5), ('A5', .5), ('D6', 2)],
    [('E6', .5), ('D6', .5), ('C6', .5), ('B5', .5), ('G#5', 2)],
]

def oompah(bar0, chords, shift=0, vel=88, piano=True):
    """Tuba auf 1 und 3 (Grundton/Quinte), Klavier-Akkord (staccato) auf 2 und 4."""
    for k, ch in enumerate(chords):
        r = kit.root(ch, shift)
        T = kit.tones(ch, 4, shift)
        t = song.bar(bar0 + k)
        song.add('tuba', t, 0.45, r, hv(vel + 6)); song.add('tuba', t + 2, 0.45, r + 7, hv(vel - 4))
        if piano:
            for beat in (1, 3):
                for m in (T[0], T[1], T[2]): song.add('piano', t + beat, 0.25, m, hv(vel - 26))
        song.add('bassoon', t + 1, 0.4, r + 12, hv(vel - 22)); song.add('bassoon', t + 3, 0.4, r + 12 + 7, hv(vel - 26))

def polka_drums(bar0, nbars, level=1.0, crash=True):
    for k in range(nbars):
        t = song.bar(bar0 + k)
        L = level
        song.dr(t, KICK, int(98 * L), 0.15); song.dr(t + 2, KICK, int(94 * L), 0.15)
        for beat in (1, 3): song.dr(t + beat, SNARE, int(86 * L), 0.12)
        for i in range(8): song.dr(t + i * 0.5, HAT, int((68 if i % 2 else 50) * L), 0.05)
        if k == 0 and crash: song.dr(t, CRASH, int(90 * L), 1.2)

def slip(bar, shift=0):
    """Die Bananenschale: Schleifpfeife rutscht abwärts, Posaune „wah-wah“, Becken."""
    t = song.bar(bar) + 2.0
    kit.glide('whistle', t, 1.6, pn('E6') + shift, 86, 4.0, -9.0, steps=16)
    song.add('trombone', t + 1.5, 0.45, pn('G3') + shift, 90); song.add('trombone', t + 2.0, 0.45, pn('F#3') + shift, 90)
    kit.glide('trombone', t + 2.5, 0.8, pn('E3') + shift, 92, 0.0, -3.0, steps=8)
    song.dr(t + 2.0, CRASH, 88, 0.8)

def zip_up(bar, shift=0):
    kit.glide('whistle', song.bar(bar) + 2.0, 1.8, pn('C5') + shift, 84, -6.0, 12.0, steps=18)

def a_section(bar0, shift=0, vel=92, full=False, lead='clarinet'):
    kit.mel(lead, bar0, A_MEL, shift=shift, vel=vel, legato=.55)
    kit.mel('xylo', bar0, A_MEL, shift=shift, vel=vel - 14, octave=1, legato=.4)
    oompah(bar0, A_CH, shift=shift)
    polka_drums(bar0, 8, level=1.0 if not full else 1.12)
    slip(bar0 + 3, shift=shift)
    if full:
        kit.mel('accordion', bar0, A_MEL, shift=shift, vel=vel - 28, octave=-1, legato=.5)
        kit.mel('flute', bar0, A_MEL, shift=shift, vel=vel - 30, octave=1, legato=.5)
        zip_up(bar0 + 7, shift=shift)
        kit.sparkle(bar0, 8, shift=shift, vel=50, notes=('C6', 'E6', 'G6', 'D6'), per_bar=2)

b = 0
# ── Intro (4): das Leitmotiv „Freunde“ als Auftakt, dann ein Fill ─────────────────────────────────────────────────────────
t0 = song.bar(b)
for off, d in LEITMOTIVE['freunde']:
    song.add('clarinet', t0, d * .6, pn('C5') + off, hv(90)); t0 += d
song.add('xylo', song.bar(b + 1), 0.3, pn('G6'), 86)
oompah(b + 1, ['C', 'G', 'G'], vel=80)
polka_drums(b + 1, 3, level=0.9, crash=False)
for j in range(6): song.dr(song.bar(b + 3) + 2.0 + j * 0.333, SNARE, 60 + 10 * j, 0.1)
b += 4

# ── A (8): der Ohrwurm — Klarinette + Xylophon, Oompah, im 4. Takt rutscht die Melodie aus ───────────────────────────────────────────
a_section(b)
b += 8

# ── A' (8): Akkordeon und Flöte dazu, Pfeife „zippt“ nach oben ───────────────────────────────────────────────────────────────────
a_section(b, vel=96, full=True)
b += 8

# ── B (8): Anschleichen — Pizzicato schleicht in a-Moll, die Klarinette flüstert, im Takt 6: Ausrutscher, Wirbel, Pause, weiter ────────────────
creep = ['A4', 'C5', 'E5', 'A5', 'E5', 'C5', 'A4', 'E4']
for k in range(5):
    for i, n in enumerate(creep): song.add('pizz', song.bar(b + k) + i * 0.5, 0.25, pn(n), hv(64 + k * 3))
    song.add('tuba', song.bar(b + k), 0.45, pn('A2') if k % 2 == 0 else pn('E2'), 70)
    song.add('bassoon', song.bar(b + k) + 2, 0.4, pn('A3'), 56)
kit.mel('clarinet', b, [[(None, 4)], [(None, 4)], [('E5', 1), ('C5', 1), ('E5', 1), ('C5', 1)], [('A5', 2), (None, 2)], [('E5', 1), ('G#5', 1), ('B5', 2)]], vel=64, legato=.6)
slip(b + 5)
for i in range(8): song.dr(song.bar(b + 5) + 0.5 + i * 0.25, SNARE, 50 + 8 * i, 0.1)
song.dr(song.bar(b + 6), CRASH, 96, 0.8)                                            # Pause im Takt 7 (Stille nach dem Knall)
for k in (7,):
    for i, n in enumerate(creep[:4]): song.add('pizz', song.bar(b + k) + i * 0.5, 0.25, pn(n), 70)
    kit.mel('clarinet', b + k, [[(None, 2), ('G5', .5), ('E5', .5), ('C5', 1)]], vel=76)
b += 8

# ── C (8): Verfolgungsjagd — flinke Läufe in a-Moll, alle jagen hinterher ─────────────────────────────────────────────────────────────
kit.mel('clarinet', b, C_MEL, vel=94, legato=.5)
kit.mel('xylo', b, C_MEL, vel=76, octave=1, legato=.4)
kit.mel('accordion', b, C_MEL, vel=70, octave=0, legato=.5)
kit.mel('flute', b, C_MEL, vel=60, octave=1, harm=None, legato=.5)
oompah(b, C_CH, vel=94)
polka_drums(b, 8, level=1.15)
kit.sparkle(b, 8, vel=56, notes=('A6', 'C7', 'E6', 'G#6'), per_bar=3)
zip_up(b + 3); zip_up(b + 7)
b += 8

# ── A'' (8): zurück zur Handlung — alles, noch eifriger; geschlossen auf C ───────────────────────────────────────────────────────────────────
a_section(b, vel=98, full=True)
b += 8

# ── A''' +2 (8): D-Dur — Schluss-Refrain, alles; Ganzschluss ─────────────────────────────────────────────────────────────────────────────────
a_section(b, shift=2, vel=102, full=True, lead='clarinet')
song.dr(song.bar(b + 7), CRASH, 100, 1.2)
b += 8

# ── Outro (4): G (Dominante zur C-Dur-Intro) — letzte Pointe: Xylophon spielt das Leitmotiv „Freunde“, Tuba stolpert ──────────────────────────────
oompah(b, ['G', 'G'], vel=82)
polka_drums(b, 2, level=0.95, crash=False)
t0 = song.bar(b + 2)
for off, d in LEITMOTIVE['freunde']:
    song.add('xylo', t0, d * .45, pn('G5') + off, hv(86)); t0 += d * .5
song.add('tuba', song.bar(b + 3) + 0.5, 0.3, pn('F#2') + 12, 88); song.add('tuba', song.bar(b + 3) + 1.0, 0.3, pn('F2') + 12, 88)
song.add('tuba', song.bar(b + 3) + 1.5, 0.3, pn('E2') + 12, 88)
for j in range(4): song.dr(song.bar(b + 3) + 2.0 + j * 0.5, SNARE, 62 + 14 * j, 0.1)
b += 4
assert b == BARS, (b, BARS)

if os.environ.get('SCORE_NORENDER') != '1':
    sf2, out = cli_paths('bgm_score_lustig.ogg')
    song.render(sf2, out, target_rms=0.25, saturate=False, compress=True, air_cut=0.0)
