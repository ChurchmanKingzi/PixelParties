# -*- coding: utf-8 -*-
"""Kampagnen-Score · Dorm-Room → public/music/bgm_score_dorm.ogg                           Titel: „Late Night, Warm Lamp“

Ein Zimmer im Wohnheim: gemütlich, spätnachmittags oder tief in der Nacht, Lampe an, ein bisschen unordentlich, sicher. Lo-Fi-Chill in F-Dur, 84 BPM, 4/4: weiches E-Piano, Nylon-Gitarre, Kontrabass,
gedämpftes Schlagzeug (Rimshot, Staubknistern der Hi-Hat), Vibraphon und Flöte als zarte Stimmen, Oohs wie ein Summen, Glockenspiel wie Lichter in der Nacht.

  • **Ohrwurm** (A): ein faules, gesungenes Motiv („Cis–A–G–A“, dann Sprung) mit Antizipationen über Fmaj7 – Dm7 – B♭maj7 – C7 | …; entspannt und doch hängenbleibend, wie ein Lied, das man beim Aufräumen vor sich hin summt.
  • **B** (die Gitarre erzählt): sanfter Perspektivwechsel in die Moll-Verwandten (Am7 – Dm7 – Gm7 – C7), Flöte und Gitarre abwechselnd.
  • **Bridge** (Einschlafen): wenige lange Töne, Glockenspiel-Lichter.
  • Leitmotiv „Freunde“ (Do–Re–Mi–Sol–La–Sol) in der Intro (E-Piano) und im Outro (Flöte).
Form (36 Takte ≈ 1:43): Intro 4 · A 8 · B 8 · A' 8 · Bridge 4 · Outro 4
Ausklang auf C7 (Dominante) → zurück in die F-Dur-Intro.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
from score_common import pn, LEITMOTIVE
from score_kit import Kit

BPM, BARS = 84, 36
song = Song(BPM, BARS)
CH = {'Fmaj7': (5, 'M7'), 'Dm7': (2, 'm7'), 'Bbmaj7': (10, 'M7'), 'C7': (0, '7'), 'Am7': (9, 'm7'), 'Gm7': (7, 'm7'), 'Em7': (4, 'm7')}
kit = Kit(song, CH, seed=1984, tonic_pc=5)
hv, rng = kit.hv, kit.rng

song.inst('epiano', 'epiano', vol=82, pan=50)
song.inst('guitar', 'guitar', vol=72, pan=24)
song.inst('flute', 'flute', vol=70, pan=82)
song.inst('vibes', 'vibes', vol=66, pan=88)
song.inst('bass', 'acbass', vol=88, pan=62)
song.inst('oohs', 'oohs', vol=52, pan=70)
song.inst('glock', 'glock', vol=54, pan=92)
song.inst('strings', 'slowstr', vol=44, pan=64)
song.inst('piano', 'piano', vol=58, pan=44)

A_CH = ['Fmaj7', 'Dm7', 'Bbmaj7', 'C7', 'Fmaj7', 'Dm7', 'Bbmaj7', 'C7']
A_MEL = [
    [('C6', 1.5), ('A5', .5), ('G5', 1), ('A5', 1)],
    [('F5', 1.5), ('A5', .5), ('D6', 2)],
    [('D6', 1.5), ('C6', .5), ('A5', 1), ('F5', 1)],
    [('G5', 2), ('E5', 1), (None, 1)],
    [('C6', 1.5), ('A5', .5), ('G5', 1), ('A5', 1)],
    [('A5', 1), ('C6', 1), ('D6', 2)],
    [('F6', 1.5), ('D6', .5), ('C6', 2)],
    [('Bb5', 1), ('G5', 1), ('E5', 2)],
]
B_CH = ['Am7', 'Dm7', 'Gm7', 'C7', 'Am7', 'Dm7', 'Bbmaj7', 'C7']
B_MEL = [
    [('E5', 2), ('G5', 1), ('A5', 1)], [('F5', 2), ('A5', 2)], [('G5', 1.5), ('Bb5', .5), ('D6', 2)], [('C6', 2), ('G5', 2)],
    [('E5', 2), ('G5', 1), ('A5', 1)], [('D6', 1.5), ('C6', .5), ('A5', 2)], [('F5', 1), ('A5', 1), ('D6', 2)], [('C6', 1), ('B5', 1), ('G5', 2)],
]
BR_CH = ['Dm7', 'Gm7', 'Bbmaj7', 'C7']
BR_MEL = [[('A5', 4)], [('Bb5', 2), ('G5', 2)], [('F5', 4)], [('E5', 3), (None, 1)]]

def keys(bar0, chords, vel=60, inst='epiano'):
    """E-Piano: weicher, leicht synkopierter Akkord (auf 1 und 2&) + Halbe-Noten-Nachklang."""
    for k, ch in enumerate(chords):
        T = kit.tones(ch, 3)
        t = song.bar(bar0 + k)
        for pos, dur, f in ((0, 1.4, 1.0), (1.5, 1.0, .8), (2.5, 1.2, .85)):
            for m in T: song.add(inst, t + pos, dur, m, hv(int(vel * f)))

def bassline(bar0, chords, vel=84):
    for k, ch in enumerate(chords):
        r = kit.root(ch)
        t = song.bar(bar0 + k)
        song.add('bass', t, 1.4, r, hv(vel)); song.add('bass', t + 1.5, 0.9, r + 7, hv(vel - 10)); song.add('bass', t + 2.5, 1.2, r + 12, hv(vel - 8))

def lights(bar0, nbars, vel=48, shift=0):
    for k in range(nbars):
        if k % 2 == 0:
            for _ in range(2): song.add('glock', song.bar(bar0 + k) + rng.choice((0.5, 1.5, 2.5, 3.5)), 0.5, pn(rng.choice(('C7', 'A6', 'G6', 'D7', 'F6'))) + shift, hv(vel))

def pluck(bar0, chords, vel=52):
    """Nylon-Gitarre: gebrochene Akkorde, träge Achtel."""
    for k, ch in enumerate(chords):
        T = kit.tones(ch, 3)
        pat = (T[0], T[2], T[3] if len(T) > 3 else T[0] + 12, T[1] + 12, T[2] + 12, T[1] + 12, T[3] if len(T) > 3 else T[2], T[2])
        for i in range(8): song.add('guitar', song.bar(bar0 + k) + i * 0.5, 0.9, pat[i], hv(vel + (8 if i % 4 == 0 else 0)))

b = 0
# ── Intro (4): E-Piano tastet sich in den Raum, Leitmotiv „Freunde“ leise, Rimshot-Beat setzt in Takt 3 ein ─────────────────────────────
keys(b, ['Fmaj7', 'Dm7', 'Bbmaj7', 'C7'], vel=54)
bassline(b + 1, ['Dm7', 'Bbmaj7', 'C7'], vel=70)
t0 = song.bar(b + 1)
for off, d in LEITMOTIVE['freunde']:
    song.add('flute', t0, d * .95, pn('F5') + off, hv(62)); t0 += d
kit.drums(b + 2, 2, style='lofi', level=0.7, fills=False)
lights(b, 4, vel=42)
b += 4

# ── A (8): E-Piano singt das faule Motiv, Nylon-Gitarre perlt, Lo-Fi-Beat ────────────────────────────────────────────────────────────────
kit.mel('epiano', b, A_MEL, vel=82, legato=.95)
kit.mel('vibes', b, A_MEL, vel=48, octave=1, legato=.8)
keys(b, A_CH, vel=48, inst='piano')
bassline(b, A_CH)
pluck(b, A_CH, vel=46)
kit.drums(b, 8, style='lofi', level=0.85)
lights(b, 8)
b += 8

# ── B (8): die Gitarre erzählt in den Moll-Verwandten, die Flöte antwortet; Oohs summen ─────────────────────────────────────────────────────
kit.mel('guitar', b, B_MEL, vel=80, legato=1.0)
kit.mel('flute', b, B_MEL, vel=62, octave=1, legato=.95, delay=0.0)
kit.mel('oohs', b, B_MEL, vel=44, harm=-2, legato=1.0)
keys(b, B_CH, vel=54)
bassline(b, B_CH, vel=86)
kit.drums(b, 8, style='lofi', level=0.9)
kit.pad(b, B_CH, vel=26, inst='strings')
lights(b, 8, vel=44)
b += 8

# ── A' (8): E-Piano + Flöte in Oktaven, Vibraphon, Oohs; Strings als Teppich ────────────────────────────────────────────────────────────────
kit.mel('epiano', b, A_MEL, vel=86, legato=.95)
kit.mel('flute', b, A_MEL, vel=62, octave=1, legato=.95)
kit.mel('oohs', b, A_MEL, vel=48, legato=1.0)
kit.mel('vibes', b, A_MEL, vel=54, octave=1, legato=.8)
keys(b, A_CH, vel=50, inst='piano')
bassline(b, A_CH, vel=88)
pluck(b, A_CH, vel=50)
kit.pad(b, A_CH, vel=32, inst='strings')
kit.drums(b, 8, style='lofi', level=0.95)
lights(b, 8, vel=52)
b += 8

# ── Bridge (4): Einschlafen — wenige lange Töne, Glockenspiel-Lichter, der Beat verschwindet ────────────────────────────────────────────────────
kit.mel('flute', b, BR_MEL, vel=64, legato=1.0)
kit.mel('oohs', b, BR_MEL, vel=42, legato=1.0, harm=-2)
keys(b, BR_CH, vel=42)
bassline(b, BR_CH, vel=70)
kit.pad(b, BR_CH, vel=34, inst='strings')
lights(b, 4, vel=48)
kit.drums(b, 4, style='soft', level=0.7)
b += 4

# ── Outro (4): C7 (Dominante zur F-Dur-Intro) — das Leitmotiv „Freunde“ in der Flöte; Lampe aus ────────────────────────────────────────────────
keys(b, ['C7', 'C7', 'C7'], vel=44)
bassline(b, ['C7', 'C7', 'C7'], vel=66)
t0 = song.bar(b)
for off, d in LEITMOTIVE['freunde']:
    song.add('flute', t0, d * 1.9, pn('C5') + off, hv(60)); t0 += d * 2
kit.drums(b, 3, style='soft', level=0.6, fills=False)
lights(b, 4, vel=44)
b += 4
assert b == BARS, (b, BARS)

if os.environ.get('SCORE_NORENDER') != '1':
    sf2, out = cli_paths('bgm_score_dorm.ogg')
    song.render(sf2, out, target_rms=0.22, saturate=False, compress=True, air_cut=0.0)
