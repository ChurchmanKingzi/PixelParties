# -*- coding: utf-8 -*-
"""Kampagnen-Score · Strand → public/music/bgm_score_strand.ogg                           Titel: „Salt & Sunshine“

Ein Strand: warmer Sand, Wellen, Sonne, entspannt und trotzdem schwingend. Calypso-Folk in C-Dur, 100 BPM, 4/4. Marimba (Steeldrum-artig) trägt die Melodie, die Flöte singt dazu, die Gitarre schlägt
Offbeats wie eine Ukulele, der Bass schiebt synkopiert, Shaker und Rahmentrommel; Wellen als Wind-Pad per Pitch-Bend, Harfen-Glissandi wie Gischt, Glockenspiel wie glitzerndes Wasser.

  • **Ohrwurm** (A): die Calypso-Gruppierung 3+3+2 Achtel („dum-dum-DUM“) auf C – G – Am – F | C – G – F – G, kurz, tanzbar, pfeifbar.
  • **B** (Strandspaziergang): weich fließende Flötenbögen über Am – F – C – G, die Wellen tragen.
  • **C** (Sonnenuntergang): Dm – Am – F – C, lange Töne, Pad, die Harfe perlt, der Beat wird leise; danach der Schluss-Refrain einen Ganzton höher (D-Dur).
  • Leitmotiv „Freunde“ (Do–Re–Mi–Sol–La–Sol) in der Intro (Marimba) und im Outro (Flöte).
Form (48 Takte ≈ 1:55): Intro 4 · A 8 · B 8 · A' 8 · C 8 · A'' +2 8 · Outro 4
Ausklang auf G (Dominante) → zurück in die C-Dur-Intro.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
from score_common import pn, LEITMOTIVE
from score_kit import Kit, T3

BPM, BARS = 100, 48
song = Song(BPM, BARS)
CH = {'C': (0, 'M'), 'G': (7, 'M'), 'Am': (9, 'm'), 'F': (5, 'M'), 'Dm': (2, 'm'), 'Em': (4, 'm')}
kit = Kit(song, CH, seed=1977, tonic_pc=0)
hv, rng = kit.hv, kit.rng

song.inst('marimba', 'marimba', vol=92, pan=44)          # Steeldrum-Ersatz
song.inst('vibes', 'vibes', vol=70, pan=84)
song.inst('flute', 'flute', vol=82, pan=74)
song.inst('guitar', 'guitar', vol=80, pan=24)            # Ukulele-Offbeats
song.inst('cleangtr', 'cleangtr', vol=58, pan=98)
song.inst('bass', 'acbass', vol=96, pan=62)
song.inst('harp', 'harp', vol=76, pan=38)
song.inst('glock', 'glock', vol=60, pan=90)
song.inst('oohs', 'oohs', vol=62, pan=70)
song.inst('strings', 'slowstr', vol=54, pan=60)
song.inst('sweep', 'sweep', vol=42, pan=64)
song.inst('whistle', 'whistle', vol=74, pan=58)
kit.bend_setup('sweep')

A_CH = ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G']
A_MEL = [
    [('E5', 1.5), ('G5', 1.5), ('E5', 1)],
    [('D5', 1.5), ('G5', 1.5), ('D5', 1)],
    [('C5', 1.5), ('E5', 1.5), ('A5', 1)],
    [('A5', 1.5), ('G5', 1.5), ('F5', 1)],
    [('E5', 1.5), ('G5', 1.5), ('C6', 1)],
    [('B5', 1.5), ('A5', 1.5), ('G5', 1)],
    [('A5', 1.5), ('F5', 1.5), ('C5', 1)],
    [('D5', 1), ('G5', 1), ('B5', 2)],
]
A_CLOSE = A_MEL[:7] + [[('C6', 2), (None, 2)]]
A_CH_CLOSE = A_CH[:7] + ['C']
B_CH = ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G']
B_MEL = [
    [('A5', 1), ('G5', 1), ('E5', 2)], [('F5', 1), ('A5', 1), ('C6', 2)], [('E5', 1), ('G5', 1), ('C6', 2)], [('B5', 2), ('G5', 2)],
    [('C6', 1), ('B5', 1), ('A5', 2)], [('A5', 1), ('G5', 1), ('F5', 2)], [('G5', 2), ('E5', 1), ('D5', 1)], [('D5', 3), (None, 1)],
]
C_CH = ['Dm', 'Am', 'F', 'C', 'Dm', 'Am', 'F', 'G']
C_MEL = [[('F5', 4)], [('E5', 4)], [('A5', 2), ('G5', 2)], [('E5', 3), (None, 1)],
         [('A5', 4)], [('C6', 2), ('B5', 2)], [('A5', 2), ('F5', 2)], [('G5', 2), (None, 2)]]

def waves(bar0, nbars, vel=40, shift=0):
    for k in range(0, nbars, 4):
        kit.glide('sweep', song.bar(bar0 + k), 6.0, pn('C5') + shift, vel, -3.0, 5.0, steps=24)
        kit.glide('sweep', song.bar(bar0 + k) + 6.0, 8.0, pn('C5') + shift + 5, vel - 6, 5.0, -6.0, steps=24)

def gischt(beat, shift=0, vel=66):
    """Harfen-Glissando abwärts über C-Dur-Pentatonik (Gischt)."""
    for i, n in enumerate(('C7', 'A6', 'G6', 'E6', 'D6', 'C6', 'A5', 'G5')): song.add('harp', beat + i * 0.125, 0.8, pn(n) + shift, hv(vel - i))

def a_section(bar0, shift=0, vel=92, closed=False, full=False):
    mel = A_CLOSE if closed else A_MEL
    ch = A_CH_CLOSE if closed else A_CH
    kit.mel('marimba', bar0, mel, shift=shift, vel=vel, legato=.55)
    kit.mel('vibes', bar0, mel, shift=shift, vel=vel - 28, octave=1, legato=.5)
    kit.mel('flute', bar0, mel, shift=shift, vel=vel - 16, octave=0, legato=.85, harm=-2)
    kit.strum(bar0, ch, shift=shift, vel=70, style='offbeat')
    kit.bass(bar0, ch, shift=shift, vel=94, style='push')
    kit.drums(bar0, 8, style='calypso', level=1.0)
    kit.sparkle(bar0, 8, shift=shift, vel=50, notes=('C6', 'E6', 'G6', 'A6', 'D6'), per_bar=2)
    waves(bar0, 8, vel=30, shift=shift)
    if full:
        kit.mel('oohs', bar0, mel, shift=shift, vel=54, octave=0)
        kit.arp(bar0, ch, shift=shift, vel=46, inst='cleangtr', steps=8, step=0.5)
        kit.mel('whistle', bar0, mel, shift=shift, vel=62, octave=1, legato=.8)

b = 0
# ── Intro (4): Wellen rollen an, Möwen-Pfeife, die Marimba stellt das Leitmotiv „Freunde“ vor, die Gitarre schwingt ein ──────────────────
waves(b, 4, vel=46)
gischt(song.bar(b))
t0 = song.bar(b + 1)
for off, d in LEITMOTIVE['freunde']:
    song.add('marimba', t0, d * .6, pn('C5') + off, hv(90)); t0 += d
kit.strum(b + 2, ['F', 'G'], vel=64, style='offbeat')
kit.bass(b + 2, ['F', 'G'], vel=86, style='push')
kit.drums(b + 2, 2, style='calypso', level=0.85, fills=False, crash=False)
song.add('whistle', song.bar(b + 3) + 2.0, 0.5, pn('E6'), 70); song.add('whistle', song.bar(b + 3) + 2.75, 0.5, pn('G6'), 74)
b += 4

# ── A (8): der Calypso-Ohrwurm — Marimba, Flöte in Terzen, Offbeat-Gitarre, Shaker ────────────────────────────────────
a_section(b)
b += 8

# ── B (8): Strandspaziergang — weiche Flötenbögen, Marimba kichert, Harfe perlt ────────────────────────────────────────
kit.mel('flute', b, B_MEL, vel=86, legato=.95)
kit.mel('vibes', b, B_MEL, vel=60, legato=.8)
kit.mel('oohs', b, B_MEL, vel=48, harm=-2, legato=.95)
kit.strum(b, B_CH, vel=60, style='offbeat')
kit.arp(b, B_CH, vel=48, inst='harp', steps=8, step=0.5, pattern=(0, 2, 4, 3, 4, 2, 0, 2))
kit.bass(b, B_CH, vel=88, style='push')
kit.drums(b, 8, style='calypso', level=0.85)
kit.pad(b, B_CH, vel=36, inst='strings')
waves(b, 8, vel=34)
gischt(song.bar(b + 7) + 1.0, vel=60)
b += 8

# ── A' (8): voll — Oohs, Clean-Arpeggien, Pfeife obendrauf; geschlossen auf C ─────────────────────────────────────────────
a_section(b, vel=96, closed=True, full=True)
b += 8

# ── C (8): Sonnenuntergang — lange Töne, Pad, die Harfe perlt, der Beat wird leise ───────────────────────────────────────
kit.mel('flute', b, C_MEL, vel=80, legato=1.0)
kit.mel('oohs', b, C_MEL, vel=52, legato=1.0, harm=-2)
kit.mel('vibes', b, C_MEL, vel=48, octave=1, legato=.9)
kit.arp(b, C_CH, vel=52, inst='harp', steps=8, step=0.5, pattern=(0, 2, 4, 5, 4, 2, 4, 2))
kit.pad(b, C_CH, vel=46, inst='strings')
kit.bass(b, C_CH, vel=80, style='half')
kit.strum(b, C_CH, vel=48, style='light')
kit.drums(b, 8, style='soft', level=0.85)
kit.sparkle(b, 8, vel=52, notes=('C6', 'E6', 'G6', 'A6', 'D6'), per_bar=2)
waves(b, 8, vel=42)
kit.roll(b + 7, 2, 4, 40, 100)
b += 8

# ── A'' +2 (8): D-Dur — alles, Gischt im letzten Takt ──────────────────────────────────────────────────────────────────────
a_section(b, shift=2, vel=100, full=True)
gischt(song.bar(b + 7) + 1.0, shift=2, vel=72)
b += 8

# ── Outro (4): G (Dominante zur C-Dur-Intro) — das Leitmotiv „Freunde“ in der Flöte, Wellen verebben ─────────────────────────────
t0 = song.bar(b)
for off, d in LEITMOTIVE['freunde']:
    song.add('flute', t0, d * .92, pn('G4') + off, hv(86)); t0 += d
kit.strum(b, ['G', 'G', 'G'], vel=60, style='light')
kit.bass(b, ['G', 'G', 'G'], vel=82, style='half')
kit.drums(b, 3, style='soft', level=0.8)
kit.glide('sweep', song.bar(b + 1), 8.0, pn('G4'), 44, 5.0, -8.0, steps=24)
gischt(song.bar(b + 3), vel=60)
b += 4
assert b == BARS, (b, BARS)

if os.environ.get('SCORE_NORENDER') != '1':
    sf2, out = cli_paths('bgm_score_strand.ogg')
    song.render(sf2, out, target_rms=0.24, saturate=False, compress=True, air_cut=0.0)
