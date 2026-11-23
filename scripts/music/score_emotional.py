# -*- coding: utf-8 -*-
"""Kampagnen-Score · Emotionale Szene → public/music/bgm_score_emotional.ogg                  Titel: „What We Carry“

Eine emotionale Szene: Abschied, Verlust, Trost — ehrlich, nicht kitschig. E-Moll, 4/4, 76 BPM, langsam. Klavier und Solovioline tragen ein sehr einfaches, einprägsames Motiv (eine Linie, die man nach
einmal Hören mitsummt), Streicher wachsen langsam, die Flöte bringt Trost, die Harfe tropft wie Tränen, ein Pauken-Schwellen im Höhepunkt. Kein Schlagzeug.

  • **Ohrwurm** (A, Moll): „B–E–G“ — ein Aufstieg von der Quinte über den Grundton zur kleinen Terz, dann wieder hinab; wiederholt mit kleinen Veränderungen (Em – C – G – D | Em – C – Am – B7).
  • **B** (Trost, G-Dur): dieselbe Gestalt, aber nach oben geöffnet — D6 – B5 – A5 –, die Flöte übernimmt; Dur nimmt dem Schmerz nicht die Tiefe, es hält ihn.
  • **A'** (Höhepunkt): das Thema in der hohen Violine mit allen Streichern; Pauken-Schwellen; es endet nicht tröstlich, sondern aufrichtig — in der Dominante, damit der Loop den Schmerz weiterträgt.
  • Leitmotiv „Freunde“ (Do–Re–Mi–Sol–La–Sol, in G-Dur) ganz leise in der Intro (Klavier) und im Outro (Flöte) — das, was bleibt.
Form (32 Takte ≈ 1:41): Intro 4 · A 8 · B 8 · A' 8 · Outro 4
Ausklang auf H7 (Dominante) → zurück in die E-Moll-Intro.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
from score_common import pn, LEITMOTIVE
from score_kit import Kit

BPM, BARS = 76, 32
song = Song(BPM, BARS)
CH = {'Em': (4, 'm'), 'C': (0, 'M'), 'G': (7, 'M'), 'D': (2, 'M'), 'Am': (9, 'm'), 'B7': (11, '7')}
kit = Kit(song, CH, seed=1912, tonic_pc=7)
hv, rng = kit.hv, kit.rng

song.inst('piano', 'piano', vol=82, pan=52)
song.inst('violin', 'violin', vol=86, pan=74)
song.inst('flute', 'flute', vol=74, pan=84)
song.inst('strings', 'slowstr', vol=66, pan=62)
song.inst('cello', 'violin', vol=64, pan=40)             # tiefe Streicherlinie (Violine eine Oktave tiefer)
song.inst('harp', 'harp', vol=70, pan=30)
song.inst('bass', 'contra', vol=76, pan=62)
song.inst('oohs', 'oohs', vol=52, pan=70)
song.inst('timp', 'timp', vol=72, pan=64)
song.inst('glock', 'glock', vol=54, pan=92)
song.inst('oboe', 'oboe', vol=60, pan=46)

A_CH = ['Em', 'C', 'G', 'D', 'Em', 'C', 'Am', 'B7']
A_MEL = [
    [('B4', 1.5), ('E5', .5), ('G5', 2)],
    [('G5', 1.5), ('E5', .5), ('C5', 2)],
    [('B4', 1.5), ('D5', .5), ('G5', 2)],
    [('F#5', 2), ('A5', 1), ('F#5', 1)],
    [('B4', 1.5), ('E5', .5), ('G5', 1), ('B5', 1)],
    [('C6', 1.5), ('B5', .5), ('G5', 2)],
    [('A5', 1.5), ('G5', .5), ('E5', 2)],
    [('D#5', 1), ('F#5', 1), ('A5', 2)],
]
B_CH = ['G', 'D', 'Em', 'C', 'G', 'D', 'C', 'D']
B_MEL = [
    [('D6', 2), ('B5', 2)], [('A5', 1), ('F#5', 1), ('A5', 2)], [('G5', 2), ('B5', 2)], [('C6', 1.5), ('B5', .5), ('G5', 2)],
    [('D6', 2), ('G6', 2)], [('F#6', 1.5), ('E6', .5), ('D6', 2)], [('E6', 1), ('D6', 1), ('C6', 2)], [('B5', 2), ('A5', 2)],
]

def ballad(bar0, chords, shift=0, vel=56):
    kit.bass(bar0, chords, shift=shift, vel=62, style='half')
    kit.piano(bar0, chords, shift=shift, vel=vel, style='ballad')

def tears(bar0, nbars, vel=50, shift=0):
    """Tropfende Töne: einzelne hohe Harfen-/Glockenspielnoten (Moll-Pentatonik)."""
    for k in range(nbars):
        if k % 2 == 1:
            t = song.bar(bar0 + k) + rng.choice((1.0, 2.0, 3.0))
            song.add('harp', t, 1.5, pn(rng.choice(('E6', 'G6', 'B6', 'D6'))) + shift, hv(vel))
            if k % 4 == 3: song.add('glock', t + 0.5, 0.5, pn('B6') + shift, hv(vel - 8))

b = 0
# ── Intro (4): Klavier allein — das Leitmotiv „Freunde“ in G-Dur ganz leise über Em, dann die Linie des Themas ──────────────────────
kit.bass(b, ['Em', 'Em', 'C', 'D'], vel=66, style='half')
kit.piano(b, ['Em', 'Em', 'C', 'D'], vel=60, style='ballad')
kit.pad(b, ['Em', 'Em', 'C', 'D'], vel=30, inst='strings')
t0 = song.bar(b + 1)
for off, d in LEITMOTIVE['freunde']:
    song.add('piano', t0, d * .92, pn('G5') + off, hv(74)); t0 += d
kit.mel('oboe', b + 3, [[('B4', 1.5), ('E5', .5), ('G5', 2)]], vel=56)
b += 4

# ── A (8): die Solovioline singt das Motiv, Klavier trägt; Streicher hauchen ab Takt 5 ───────────────────────────────────────────────
kit.mel('violin', b, A_MEL, vel=84, legato=1.0)
ballad(b, A_CH)
kit.pad(b, A_CH, vel=26, inst='strings')
for k in range(4, 8): kit.pad(b + k, [A_CH[k]], vel=34, inst='strings')
tears(b, 8)
b += 8

# ── B (8): Trost, G-Dur — Flöte und Violine, Streicher breiter, Harfe; die Gestalt öffnet sich nach oben ─────────────────────────────────
kit.mel('flute', b, B_MEL, vel=82, legato=1.0)
kit.mel('violin', b, B_MEL, vel=62, harm=-2, legato=1.0)
kit.mel('cello', b, B_MEL, vel=54, octave=-1, legato=1.0)
ballad(b, B_CH, vel=58)
kit.pad(b, B_CH, vel=44, inst='strings')
kit.arp(b, B_CH, vel=46, inst='harp', steps=8, step=0.5, pattern=(0, 2, 4, 3, 4, 2, 0, 2))
tears(b, 8, vel=46)
b += 8

# ── A' (8): Höhepunkt — Violine hoch, Streicher voll, Cello trägt die Linie darunter, Pauken-Schwellen; endet in der Dominante ──────────────────
kit.mel('violin', b, A_MEL, vel=98, octave=1, legato=1.0)
kit.mel('cello', b, A_MEL, vel=70, octave=0, legato=1.0)
kit.mel('flute', b, A_MEL, vel=56, octave=1, legato=1.0)
kit.mel('oohs', b, A_MEL, vel=50, legato=1.0)
ballad(b, A_CH, vel=64)
kit.pad(b, A_CH, vel=54, inst='strings')
kit.arp(b, A_CH, vel=46, inst='harp', steps=8, step=0.5, pattern=(0, 2, 4, 3, 4, 2, 0, 2))
for k in (0, 4): song.add('timp', song.bar(b + k), 3.5, pn('E2') + 12, 62)
for i in range(16): song.add('timp', song.bar(b + 6) + i * 0.5, 0.4, pn('E2') + 12, int(44 + 3 * i))
tears(b, 8, vel=54)
b += 8

# ── Outro (4): H7 (Dominante zur E-Moll-Intro) — das Leitmotiv „Freunde“ in der Flöte, ein einzelnes Klavier-Echo ──────────────────────────
kit.bass(b, ['B7', 'B7', 'B7'], vel=56, style='half')
kit.piano(b, ['B7', 'B7', 'B7'], vel=42, style='ballad')
kit.pad(b, ['B7', 'B7', 'B7'], vel=34, inst='strings')
kit.seq('flute', song.bar(b), [(n, d * 1.5) for n, d in [('B5', .5), ('C#6', .5), ('D#6', .5), ('F#6', .5), ('G#6', 1), ('F#6', 1)]], vel=58, legato=.98)
song.add('glock', song.bar(b + 3), 2.0, pn('B6'), 52)
b += 4
assert b == BARS, (b, BARS)

if os.environ.get('SCORE_NORENDER') != '1':
    sf2, out = cli_paths('bgm_score_emotional.ogg')
    song.render(sf2, out, target_rms=0.22, saturate=False, compress=True, air_cut=0.0)
