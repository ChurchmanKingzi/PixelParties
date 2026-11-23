# -*- coding: utf-8 -*-
"""Kampagnen-Score · Romantische Szene → public/music/bgm_score_romantik.ogg                  Titel: „Under the Same Sky“

Eine romantische Szene: zart, warm, ein wenig schüchtern, dann offen. Ein Walzer in D-Dur, 3/4, 78 BPM: Oboe und Violine singen die Melodie, Klavier und Harfe wiegen den Takt, Streicher und Flöte
tragen die Wärme, Oohs wie ein Hauch, Glockenspiel wie Sterne. Kein Schlagzeug — der Walzer ist ein Atmen.

  • **Ohrwurm** (A): ein weit schwingender Dreiklangs-Bogen auf der Eins („F#–A–D“, dann Wellen zurück), über D – A – Bm – G | D – A – G – A; singbar, langsam, schwer zu vergessen.
  • **B** (Zweifel und Mut): stufenweise absteigende Linien über Bm – F#m – G – D | Em – A – D – A, Streicher wachsen; am Ende öffnet sich das Thema.
  • Schluss-Thema einen Ganzton höher (E-Dur) mit Violine und Flöte in Terzen — der Moment, in dem sich beide trauen.
  • Leitmotiv „Freunde“ (Do–Re–Mi–Sol–La–Sol) sehr langsam in der Oboe der Intro (die Freundschaft, aus der mehr wird) und im Outro in der Flöte.
Form (40 Takte ≈ 1:33): Intro 4 · A 8 · A' 8 · B 8 · A'' +2 8 · Outro 4
Ausklang auf A (Dominante) → zurück in die D-Dur-Intro.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
from score_common import pn, LEITMOTIVE
from score_kit import Kit, T3

BPM, BARS = 78, 40
song = Song(BPM, BARS, beats_per_bar=3)
CH = {'D': (2, 'M'), 'A': (9, 'M'), 'Bm': (11, 'm'), 'G': (7, 'M'), 'F#m': (6, 'm'), 'Em': (4, 'm')}
kit = Kit(song, CH, seed=1814, tonic_pc=2)
hv, rng = kit.hv, kit.rng

song.inst('oboe', 'oboe', vol=84, pan=44)
song.inst('violin', 'violin', vol=86, pan=76)
song.inst('flute', 'flute', vol=76, pan=84)
song.inst('piano', 'piano', vol=70, pan=50)
song.inst('harp', 'harp', vol=74, pan=30)
song.inst('strings', 'slowstr', vol=62, pan=64)
song.inst('oohs', 'oohs', vol=58, pan=70)
song.inst('bass', 'contra', vol=70, pan=62)
song.inst('glock', 'glock', vol=58, pan=92)
song.inst('guitar', 'guitar', vol=60, pan=22)
song.inst('bell', 'bell', vol=52, pan=76)

A_CH = ['D', 'A', 'Bm', 'G', 'D', 'A', 'G', 'A']
A_MEL = [
    [('F#5', 1.5), ('A5', .5), ('D6', 1)],
    [('C#6', 1.5), ('B5', .5), ('A5', 1)],
    [('B5', 1.5), ('D6', .5), ('F#6', 1)],
    [('E6', 1.5), ('D6', .5), ('B5', 1)],
    [('F#5', 1.5), ('A5', .5), ('D6', 1)],
    [('E6', 1.5), ('D6', .5), ('C#6', 1)],
    [('B5', 1), ('D6', 1), ('G6', 1)],
    [('E6', 2), ('C#6', 1)],
]
A_CLOSE = A_MEL[:7] + [[('D6', 3)]]
A_CH_CLOSE = A_CH[:7] + ['D']
B_CH = ['Bm', 'F#m', 'G', 'D', 'Em', 'A', 'D', 'A']
B_MEL = [
    [('D6', 3)], [('C#6', 2), ('A5', 1)], [('B5', 2), ('D6', 1)], [('A5', 3)],
    [('G5', 1), ('B5', 1), ('E6', 1)], [('E6', 2), ('C#6', 1)], [('D6', 2), ('F#5', 1)], [('E5', 3)],
]

def waltz_bed(bar0, chords, shift=0, vel=60, harp=True, piano=True):
    kit.bass(bar0, chords, shift=shift, vel=64, style='oompah')
    if piano: kit.piano(bar0, chords, shift=shift, vel=vel - 10, style='waltz')
    if harp: kit.arp(bar0, chords, shift=shift, vel=vel - 12, inst='harp', steps=6, step=0.5, pattern=(0, 2, 4, 3, 4, 2))

def star(bar0, nbars, shift=0, vel=50):
    for k in range(nbars):
        if k % 2 == 0:
            song.add('glock', song.bar(bar0 + k) + rng.choice((1.0, 2.0)), 0.5, pn(rng.choice(('A6', 'D7', 'F#6', 'E7'))) + shift, hv(vel))

b = 0
# ── Intro (4): Klavier und Harfe wiegen, die Oboe stellt das Leitmotiv „Freunde“ ganz langsam vor (doppelte Notenwerte) ───────────────
kit.bass(b, ['D', 'D', 'G', 'A'], vel=58, style='oompah')
kit.piano(b, ['D', 'D', 'G', 'A'], vel=46, style='waltz')
kit.arp(b, ['D', 'D', 'G', 'A'], vel=44, inst='harp', steps=6, step=0.5, pattern=(0, 2, 4, 3, 4, 2))
kit.seq('oboe', song.bar(b), [(n, d * 2) for n, d in [('D5', .5), ('E5', .5), ('F#5', .5), ('A5', .5), ('B5', 1), ('A5', 1)]], vel=70, legato=.98)
star(b, 4, vel=44)
b += 4

# ── A (8): der Walzer-Ohrwurm — Oboe singt, Klavier und Harfe wiegen, Streicher hauchen ───────────────────────────────────────────
kit.mel('oboe', b, A_MEL, vel=86, legato=.98)
kit.mel('flute', b, A_MEL, vel=48, octave=1, legato=.95)
waltz_bed(b, A_CH)
kit.pad(b, A_CH, vel=36, inst='strings')
star(b, 8)
b += 8

# ── A' (8): die Violine übernimmt, die Oboe in Terzen darunter, Streicher voller; geschlossen auf D ────────────────────────────────
kit.mel('violin', b, A_CLOSE, vel=88, legato=.98)
kit.mel('oboe', b, A_CLOSE, vel=60, harm=-2, legato=.98)
kit.mel('oohs', b, A_CLOSE, vel=46, octave=0)
waltz_bed(b, A_CH_CLOSE, vel=64)
kit.pad(b, A_CH_CLOSE, vel=46, inst='strings')
kit.strum(b, A_CH_CLOSE, vel=44, style='waltz')
star(b, 8, vel=54)
b += 8

# ── B (8): Zweifel und Mut — absteigende Linien, Streicher wachsen, am Ende öffnet sich das Thema ─────────────────────────────────
kit.mel('violin', b, B_MEL, vel=82, octave=0, legato=1.0)
kit.mel('flute', b, B_MEL, vel=62, octave=0, harm=-2, legato=1.0)
kit.mel('oboe', b, B_MEL, vel=54, octave=-1, legato=1.0)
waltz_bed(b, B_CH, vel=62)
for k, ch in enumerate(B_CH):
    T = kit.tones(ch, 3)
    for m in T: song.add('strings', song.bar(b + k), 2.95, m, 36 + 4 * k)
star(b, 8, vel=52)
b += 8

# ── A'' +2 (8): E-Dur — Violine und Flöte in Terzen, volle Streicher, Oohs; der Moment, in dem sich beide trauen ───────────────────────────
S = 2
kit.mel('violin', b, A_MEL, shift=S, vel=96, legato=.98)
kit.mel('flute', b, A_MEL, shift=S, vel=72, harm=-2, legato=.98)
kit.mel('oboe', b, A_MEL, shift=S, vel=64, octave=-1, legato=.98)
kit.mel('oohs', b, A_MEL, shift=S, vel=52, octave=0)
waltz_bed(b, A_CH, shift=S, vel=66)
kit.pad(b, A_CH, shift=S, vel=52, inst='strings')
kit.strum(b, A_CH, shift=S, vel=48, style='waltz')
star(b, 8, shift=S, vel=56)
song.add('bell', song.bar(b), 3.0, pn('E5'), 56); song.add('bell', song.bar(b + 4), 3.0, pn('E5'), 56)
b += 8

# ── Outro (4): A (Dominante zur D-Dur-Intro) — das Leitmotiv „Freunde“ in der Flöte, Sterne ─────────────────────────────────────────────
kit.bass(b, ['A', 'A', 'A'], vel=56, style='oompah')
kit.piano(b, ['A', 'A', 'A'], vel=44, style='waltz')
kit.arp(b, ['A', 'A', 'A'], vel=42, inst='harp', steps=6, step=0.5, pattern=(0, 2, 4, 3, 4, 2))
kit.seq('flute', song.bar(b), [(n, d * 2) for n, d in [('A4', .5), ('B4', .5), ('C#5', .5), ('E5', .5), ('F#5', 1), ('E5', 1)]], vel=68, legato=.98)
kit.pad(b, ['A', 'A', 'A'], vel=34, inst='strings')
star(b, 4, vel=48)
song.add('bell', song.bar(b + 3), 3.0, pn('A5'), 50)
b += 4
assert b == BARS, (b, BARS)

if os.environ.get('SCORE_NORENDER') != '1':
    sf2, out = cli_paths('bgm_score_romantik.ogg')
    song.render(sf2, out, target_rms=0.22, saturate=False, compress=True, air_cut=0.0)
