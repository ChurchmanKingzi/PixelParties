# -*- coding: utf-8 -*-
"""Battle-Theme „Gelatinous Groove“ (Archetyp Slimes) → public/music/bgm_theme_slimes.ogg

Glibbrig-hüpfender Kampf in f-Moll/dorisch, 124 BPM, 64 Takte (123,9 s), nahtlos loopbar.
Wabbelnder Acid-Bass mit Oktavsprüngen (Slime hüpft), blubbernde Marimba-/Xylophon-Bläschen,
Fifths-Lead mit dem „Hüpf-Motiv“ (Auftakt-16tel, dann Sprung nach oben), springender Beat mit
Elektro-Toms auf der Vier-und, Clap/Cowbell. Das Hüpf-Motiv kehrt in jedem Abschnitt wieder.

Aufbau (Takte, 0-basiert):
   0– 7  Intro      Beat, Sub + wabbelnder Bass, Marimba-Blubbern, Cowbell-Puls
   8–23  Thema A    Fifths-Lead mit Hüpf-Motiv (8-Takt-Phrase zweimal, 2. Mal mit Gegenstimme),
                    E-Piano-Offbeats, Toms
  24–39  Teil B     Harmoniewechsel (Bb–Db–Eb–Fm–C), Lead als steigende Arpeggien,
                    Square-Gegenstimme, Synth-Brass-Stabs, dichteres Blubbern
  40–55  Höhepunkt  Thema in Oktaven (Fifths + Saw), Stabs, Pad, Toms-Fills, Crash
  56–63  Rückführung Break-artiges Ausdünnen (Bass + Marimba + Toms), Wirbel → zurück auf Takt 0

Harmonie: f-dorisch/äolisch (Fm, Bb, Eb, Db, C-Dur als Dominante). Endet auf C (Halbschluss).
Aufruf:  python3 scripts/music/theme_slimes.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 124, 64                        # 64 × 4 × 60/124 = 123,9 s
song = Song(bpm=BPM, bars=BARS)
rnd = random.Random(7)

song.inst('sub',    'sbass2',  92, 64)
song.inst('acid',   'acidbass', 88, 58)
song.inst('epiano', 'epiano',  76, 40)
song.inst('marimba','marimba', 92, 34)
song.inst('bubble', 'xylo',    74, 92)
song.inst('lead',   'fifths',  88, 72)
song.inst('lead2',  'saw',     70, 56)
song.inst('counter','square',  66, 24)
song.inst('stabs',  'sbrass2', 78, 84)
song.inst('pad',    'warm',    66, 64)
song.inst('bell',   'glock',   70, 100)

NAMES = {'C': C, 'Db': Db, 'D': D, 'Eb': Eb, 'E': E, 'F': F, 'Gb': Gb, 'G': G, 'Ab': Ab, 'A': A, 'Bb': Bb, 'B': B}
def nt(s): return n(NAMES[s[:-1]], int(s[-1]))
# Akkord → (Grundton, Intervalle)
CH = {'Fm': (F, (0, 3, 7, 10)), 'Bb': (Bb, (0, 4, 7, 10)), 'Eb': (Eb, (0, 4, 7, 11)),
      'Db': (Db, (0, 4, 7, 11)), 'C': (C, (0, 4, 7, 10))}
# erlaubte Tonhöhenklassen: f-dorisch + äolisch + Leitton E (Dominante C)
SCALE = {F, G, Ab, Bb, C, D, Db, Eb, E}
def chk(p):
    assert p % 12 in SCALE, f'Ton außerhalb der Skala: {p}'
    return p
def tones(ch, octv):
    r, iv = CH[ch]; base = n(r, octv)
    return [base + i for i in iv]
def rootn(ch, octv): return n(CH[ch][0], octv)

# Akkordfolge je Takt
A8 = ['Fm', 'Fm', 'Bb', 'Bb', 'Fm', 'Eb', 'Db', 'C']
B8 = ['Bb', 'Bb', 'Db', 'Eb', 'Fm', 'Fm', 'Db', 'C']
prog = A8 + A8 * 2 + B8 * 2 + A8 * 2 + A8      # 8+16+16+16+8 = 64
assert len(prog) == 64, len(prog)

def line(inst, b, notes, vel=90, shift=0):
    for off, dur, p in notes:
        song.add(inst, song.bar(b) + off, dur * 0.92, chk(nt(p) + shift), vel + (8 if off % 1 == 0 else 0))

# ---- Hüpf-Motiv-Phrase (8 Takte, Fm Fm Bb Bb Fm Eb Db C) ------------------------------
THEME = [
    [(0, .5, 'C5'), (.75, .25, 'C5'), (1, .5, 'Eb5'), (1.5, 1, 'F5'), (2.75, .25, 'Eb5'), (3, .5, 'C5'), (3.5, .5, 'Ab4')],
    [(0, .75, 'Bb4'), (.75, .75, 'C5'), (1.5, .5, 'Ab4'), (2, 2, 'F4')],
    [(0, .5, 'D5'), (.75, .25, 'D5'), (1, .5, 'F5'), (1.5, 1, 'Bb5'), (2.75, .25, 'Ab5'), (3, .5, 'F5'), (3.5, .5, 'D5')],
    [(0, .75, 'Eb5'), (.75, .75, 'D5'), (1.5, .5, 'Bb4'), (2, 2, 'F4')],
    [(0, .5, 'C5'), (.75, .25, 'C5'), (1, .5, 'F5'), (1.5, 1, 'Ab5'), (2.75, .25, 'G5'), (3, .5, 'F5'), (3.5, .5, 'Eb5')],
    [(0, 1, 'G5'), (1, .5, 'F5'), (1.5, .5, 'Eb5'), (2, 1, 'Bb4'), (3, 1, 'G4')],
    [(0, .5, 'F5'), (.5, .5, 'Ab5'), (1, 1, 'C6'), (2, 1, 'Ab5'), (3, 1, 'F5')],
    [(0, .5, 'E5'), (.5, .5, 'G5'), (1, 1, 'C6'), (2, .5, 'Bb5'), (2.5, .5, 'G5'), (3, .5, 'E5'), (3.5, .5, 'C5')],
]
def theme(b0, inst='lead', vel=88, shift=0):
    for i, notes in enumerate(THEME): line(inst, b0 + i, notes, vel, shift)

# ---- Bass ---------------------------------------------------------------------------
# Wabbel-Muster (Beat, Dauer, Oktavversatz): Oktavsprünge, Synkopen
BASS_PAT = [(0, .5, 0), (.75, .25, 12), (1.5, .5, 0), (2, .5, 0), (2.75, .25, 12), (3.25, .25, 0), (3.5, .25, 7), (3.75, .25, 12)]
BASS_LITE = [(0, .5, 0), (1.5, .5, 0), (2, .5, 12), (3, .5, 0)]
def bass(b, ch, kind=1, vel=94):
    s = song.bar(b); r = rootn(ch, 2)
    for off, dur, o in (BASS_PAT if kind == 1 else BASS_LITE):
        song.add('acid', s + off, dur * 0.9, r + o, vel + (10 if off == 0 else 0))
    song.add('sub', s, 1.9, rootn(ch, 1), 88); song.add('sub', s + 2, 1.9, rootn(ch, 1), 82)

# ---- Marimba-Blubbern: kurze Chromatik-freie Bläschen aus Akkordtönen -----------------
def blubber(b, ch, dens=1, vel=84, inst='marimba', octv=4):
    s = song.bar(b); t = tones(ch, octv) + tones(ch, octv + 1)
    slots = [0.5, 1.25, 2.0, 2.5, 3.0, 3.75] if dens == 1 else [0.25, 0.5, 1.25, 1.5, 2.0, 2.25, 2.5, 3.0, 3.25, 3.75]
    for sl in slots:
        p = rnd.choice(t)
        song.add(inst, s + sl, 0.2, chk(p), vel + rnd.randint(-8, 8))
        if rnd.random() < 0.4: song.add(inst, s + sl + 0.125, 0.12, chk(p + (2 if (p + 2) % 12 in SCALE else 0)), vel - 22)

def epiano(b, ch, vel=70):
    s = song.bar(b); t = tones(ch, 3)
    for off in (0.5, 1.5, 2.5, 3.5):
        for p in t[1:]: song.add('epiano', s + off, 0.3, chk(p), vel)

def stabs(b, ch, vel=88):
    s = song.bar(b); t = tones(ch, 4)
    for off in (0, 0.75, 1.5, 3.25):
        for p in t[:3]: song.add('stabs', s + off, 0.3, chk(p), vel + (10 if off == 0 else 0))

def pad(b, ch, vel=62):
    for p in tones(ch, 3)[:3]: song.add('pad', song.bar(b), 3.98, chk(p), vel)

def arp_lead(b, ch, step, vel=86):
    """Steigende Arpeggien (Teil B): Rhythmus wie das Basspattern, Höhe steigt mit step."""
    s = song.bar(b); t = tones(ch, 5) + tones(ch, 6)
    for k, off in enumerate((0, .75, 1.5, 2, 2.75, 3.25)):
        song.add('lead', s + off, .5, chk(t[min(len(t) - 1, (k + step) % 8)]), vel + (8 if k == 0 else 0))

def counter(b, ch, vel=70):
    s = song.bar(b); t = tones(ch, 4)
    for k, off in enumerate((0.5, 1.25, 2.5, 3.25)): song.add('counter', s + off, .4, chk(t[[1, 2, 3, 2][k]]), vel)

# ---- Schlagzeug -----------------------------------------------------------------------
TOMS = [TOM_H, TOM_M, TOM_L]
def groove(b, kind, v=1.0):
    s = song.bar(b)
    def d(off, note, vel): song.dr(s + off, note, min(127, vel * v))
    for off, vel in ((0, 116), (0.75, 84), (2, 108), (2.75, 92)): d(off, KICK, vel)
    d(1, SNARE, 108); d(3, SNARE, 110); d(1, CLAP, 92); d(3, CLAP, 96)
    for i in range(8): d(i * 0.5, HAT, 104 if i % 2 == 0 else 86)
    d(1.5, COWBELL, 70)
    if kind >= 2:                                    # springende Elektro-Toms auf der Vier-und
        d(3.25, TOM_H, 96); d(3.5, TOM_M, 100); d(3.75, TOM_L, 104)
    if kind >= 3:
        d(2.5, TOM_M, 88); d(0.5, COWBELL, 66); d(2.5, COWBELL, 66)
        for i in (1, 3, 5, 7): d(i * 0.5 + 0.25, HAT, 76)

def fill(b, big=False):
    s = song.bar(b)
    for i in range(8): song.dr(s + 2 + i * .25, TOMS[min(2, i // 3)], ramp(i, 8, 88, 120), 0.2)
    if big:
        for i in range(8): song.dr(s + 1 + i * .125, SNARE, ramp(i, 8, 70, 108), 0.1)
    song.dr(s + 3.75, KICK, 120)
def ramp(i, cnt, a, b): return a + (b - a) * i / max(1, cnt - 1)

# ===== Komposition ======================================================================
for b in range(BARS):
    ch = prog[b]
    if b < 8:                                    # Intro
        groove(b, 1 if b < 4 else 2, 0.95)
        bass(b, ch, 2 if b < 4 else 1, 90)
        blubber(b, ch, 1, 80)
        if b >= 4: epiano(b, ch, 60)
    elif b < 24:                                 # Thema A
        groove(b, 2); bass(b, ch, 1); epiano(b, ch); blubber(b, ch, 1, 70, 'bubble', 5)
        if b >= 16: counter(b, ch, 62); blubber(b, ch, 1, 78)
    elif b < 40:                                 # Teil B
        groove(b, 3); bass(b, ch, 1, 98); stabs(b, ch, 82); blubber(b, ch, 2, 82)
        arp_lead(b, ch, (b - 24) % 4 if b < 32 else (b - 24) % 4 + 2)
        counter(b, ch, 72)
        if b >= 32: pad(b, ch, 58)
    elif b < 56:                                 # Höhepunkt
        groove(b, 3, 1.05); bass(b, ch, 1, 100); stabs(b, ch, 86); pad(b, ch, 64)
        blubber(b, ch, 2, 78, 'bubble', 5)
        if b >= 48: blubber(b, ch, 2, 80)
    else:                                        # Rückführung
        groove(b, 2 if b < 62 else 3, 0.98); bass(b, ch, 2, 92); blubber(b, ch, 1, 82)
        if b >= 60: epiano(b, ch, 66)

theme(8, 'lead', 88); theme(16, 'lead', 90)
for i, notes in enumerate(THEME):                # 2. Durchgang A: Glocken-Verdopplung eine Oktave höher
    line('bell', 16 + i, notes, 66, 12)
theme(40, 'lead', 96); theme(40, 'lead2', 78); theme(48, 'lead', 96); theme(48, 'lead2', 82, 12)
theme(56, 'lead', 84)                            # Rückführung: Motiv leise wiederholt (Hüpfen kehrt zurück)
# Fills an Abschnittsgrenzen
for b in (7, 23, 39, 47, 55): fill(b, big=(b in (39, 55)))
fill(63, True)
for b in (8, 24, 40, 56, 0): song.dr(song.bar(b), CRASH, 110, 1.0)
song.dr(song.bar(48), CRASH, 112, 1.0)

sf2, out = cli_paths('bgm_theme_slimes.ogg')
song.render(sf2, out)
