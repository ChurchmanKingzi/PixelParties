# -*- coding: utf-8 -*-
"""Theme „Song of the Silverwood“ (Archetyp Elven) → public/music/bgm_theme_elven.ogg

Elfenwald in D-Lydisch (Gis als Klangfarbe, II. Stufe E-Dur), 140 BPM, 64 Takte (109,7 s),
nahtlos loopbar. Leichtfüßig, anmutig und doch gefährlich: statt eines schweren Marsches trägt
ein synkopierter 3+3+2-Puls (Pizzicato, Sidestick, Kick) den Bogenschützen-Rhythmus – jeder
Akzent ein abgeschossener Pfeil. Harfen-Arpeggien, Oboe/Flöte-Bögen, Chor-Oohs und hohe
Glocken (Glockenspiel) für das Silberlicht; keine Pauken/Tuba, Blech nur als Horn im Höhepunkt.

Hauptmotiv: 3+3+2 auf Fis–A–H (aufsteigend), dann Abstieg – kehrt in jedem Abschnitt wieder.

Aufbau (Takte, 0-basiert):
   0– 7  Lichtung      Harfe + Pizzicato-Puls + Sidestick, Chor-Oohs, ab Takt 4 Flöte mit dem Motiv
   8–23  Thema A       Oboe mit dem Bogenthema, Flöte antwortet (2. Durchgang Oboe+Flöte+Violine),
                       Harfen-Arpeggien, Streicher-Staccato, Glocken
  24–39  Die Jagd B    fließende Sechzehntel-Läufe (Flöte/Violine), D-Dur mit G-Natur (Bm G D A),
                       Toms, Streicher-Tremolo; 2. Durchgang mit Chor und Horn, endet auf E
  40–55  Silberwald C  Höhepunkt: Thema in Oktaven (Flöte, Oboe, Violine, Horn), Chor, Glocken
  56–63  Rückweg D     Thema A leise in der Flöte, Harfen-Aufstiege, Puls bleibt → Sprung zum Anfang
Harmonie: D E A E | D E A E; A: D E A D Bm F#m E A; B: Bm G D A Bm G A E; C: D E A D Bm F#m E A |
D E A F#m Bm E A E. Der Loop endet auf E (II. Stufe) → Auflösung in das D des Anfangs.
Aufruf:  python3 scripts/music/theme_elven.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 140, 64                       # 64 × 4 × 60/140 = 109,7 s
song = Song(bpm=BPM, bars=BARS)
song.inst('bass',   'acbass',  96, 60)
song.inst('pizz',   'pizz',    92, 46)    # 3+3+2-Puls
song.inst('harp',   'harp',    90, 30)
song.inst('glock',  'glock',   70, 84)
song.inst('stacc',  'strings', 70, 40)
song.inst('tremolo','tremolo', 68, 90)
song.inst('flute',  'flute',   90, 76)
song.inst('oboe',   'oboe',    88, 54)
song.inst('violin', 'violin',  82, 84)
song.inst('horns',  'horns',   84, 40)
song.inst('oohs',   'oohs',    84, 64)
song.inst('choir',  'choir',   78, 64)

NAMES = {'C': C, 'Db': Db, 'D': D, 'Eb': Eb, 'E': E, 'F': F, 'Gb': Gb, 'G': G, 'Ab': Ab, 'A': A, 'Bb': Bb, 'B': B}
def nt(s):
    s = s.replace('F#', 'Gb').replace('C#', 'Db').replace('G#', 'Ab')
    return n(NAMES[s[:-1]], int(s[-1]))
CH = {'D': (D, 4), 'E': (E, 4), 'A': (A, 4), 'G': (G, 4), 'Bm': (B, 3), 'F#m': (Gb, 3)}
def tones(ch, base):
    pc, t = CH[ch]; r = base + ((pc - base) % 12); return [r, r + t, r + 7]
def bass_root(ch): return 28 + ((CH[ch][0] - 28) % 12)
def ramp(i, cnt, a, b): return a + (b - a) * i / max(1, cnt - 1)

LYD = {D, E, Gb, Ab, A, B, Db}            # D-Lydisch
DMAJ = LYD | {G}                          # Jagd: zusätzlich G-Natur
def check(notes, scale, where):
    for off, dur, p in notes:
        assert nt(p) % 12 in scale, f'{where}: {p} nicht in Skala'

# ---- Bausteine -------------------------------------------------------------------------------
TRES = (0, 1.5, 3)                        # 3+3+2
def pizz_pulse(b, ch, vel, extra=True):
    r, t, f = tones(ch, 62); s = song.bar(b)
    for off, p in zip(TRES, (f, r + 12, t + 12)): song.add('pizz', s + off, 0.4, p, vel + (8 if off == 0 else 0))
    if extra:
        song.add('pizz', s + 2.5, 0.25, t + 12, vel - 12); song.add('pizz', s + 3.5, 0.25, f + 12, vel - 10)
def stacc(b, ch, vel, base=55):
    r, t, f = tones(ch, base); s = song.bar(b)
    for off, p in zip((0, 1.5, 3, 3.5), (r, f, t + 12, f)): song.add('stacc', s + off, 0.3, p, vel + (6 if off == 0 else 0))
def harp(b, ch, vel, base=55):
    r, t, f = tones(ch, base); seq = [r, f, t + 12, f + 12, t + 12, f, t, f]
    for i, p in enumerate(seq): song.add('harp', song.bar(b) + i * 0.5, 0.9, p, vel + (8 if i % 4 == 0 else 0))
def harp_up(b, ch, vel):                  # 16tel-Aufstieg (Harfenlauf)
    r, t, f = tones(ch, 55); seq = [r, t, f, r + 12, t + 12, f + 12, r + 24, t + 24]
    for i, p in enumerate(seq): song.add('harp', song.bar(b) + 2 + i * 0.25, 0.5, p, ramp(i, 8, vel - 12, vel + 8))
def bass(b, ch, vel):
    r = bass_root(ch); s = song.bar(b)
    for off, p, v in ((0, r, 6), (1.5, r + 7, -4), (3, r + 12, -2), (3.5, r + 7, -12)): song.add('bass', s + off, 0.8 if off != 3.5 else 0.4, p, vel + v)
def bells(b, ch, vel):
    r, t, f = tones(ch, 79); s = song.bar(b)
    for off, p in ((0.75, f), (2.25, t), (3.75, r)): song.add('glock', s + off, 0.4, p, vel)
def pad(inst, b, ch, vel, base=55, dur=3.95):
    for p in tones(ch, base): song.add(inst, song.bar(b), dur, p, vel)
def line(b, notes, insts, vels, shift=0):
    for off, dur, p in notes:
        for inst, v in zip(insts, vels):
            sh = shift[inst] if isinstance(shift, dict) else shift
            song.add(inst, song.bar(b) + off, dur * 0.94, nt(p) + sh, v)
def crash(b, vel=104): song.dr(song.bar(b), CRASH, vel, 0.5)
def tomfill(b, vel0=80):
    for i, tm in enumerate([TOM_HH, TOM_H, TOM_M, TOM_L]):
        song.dr(song.bar(b) + 2.5 + i * 0.375, tm, ramp(i, 4, vel0, 112), 0.2)
    song.dr(song.bar(b) + 3.9, KICK, 112)
def snare_roll(b, start, end, v0, v1):
    s = song.bar(b) + start; cnt = int((end - start) * 4)
    for i in range(cnt): song.dr(s + i * 0.25, SNARE, ramp(i, cnt, v0, v1), 0.15)
def groove(b, kind, v=1.0):
    s = song.bar(b)
    def d(off, note, vel): song.dr(s + off, note, min(127, vel * v))
    if kind == 'soft':
        for off, vel in ((0, 84), (1.5, 74), (3, 78)): d(off, KICK, vel)
        d(1, SIDESTICK, 90); d(2.5, SIDESTICK, 86); d(3.5, SIDESTICK, 80)
        for i in range(8): d(i * 0.5, HAT, 108 if i % 2 == 0 else 92)
    elif kind == 'A':
        for off, vel in ((0, 100), (1.5, 88), (3, 92)): d(off, KICK, vel)
        d(1, SNARE, 84); d(2.5, SNARE, 92); d(2, SIDESTICK, 84); d(3.75, SIDESTICK, 76)
        for i in range(8): d(i * 0.5, HAT, 110 if i % 2 == 0 else 94)
    elif kind == 'B':                     # Jagd: treibender, Toms
        for off, vel in ((0, 108), (1, 84), (1.5, 96), (3, 100)): d(off, KICK, vel)
        d(1, SNARE, 100); d(2.5, SNARE, 104); d(3.5, TOM_M, 84)
        d(0.5, CLAP, 70); d(2, CLAP, 80)
        for i in range(8): d(i * 0.5, HAT, 112 if i % 2 == 0 else 96)
    elif kind == 'C':
        for off, vel in ((0, 112), (1.5, 98), (3, 102)): d(off, KICK, vel)
        d(1, SNARE, 106); d(2.5, SNARE, 108); d(1, CLAP, 80); d(2.5, CLAP, 82); d(3.75, TOM_L, 90)
        for i in range(8): d(i * 0.5, RIDE, 110 if i % 2 == 0 else 96)

# ---- Melodien --------------------------------------------------------------------------------
CH_I = ['D', 'E', 'A', 'E', 'D', 'E', 'A', 'E']
INTRO_M = [None] * 4 + [
    [(0, 1.5, 'F#5'), (1.5, 1.5, 'A5')], [(0, 1.5, 'G#5'), (1.5, 1.5, 'B5')],
    [(0, 1.5, 'A5'), (1.5, 1.5, 'C#6')], [(0, 3, 'B5')]]
CH_A = ['D', 'E', 'A', 'D', 'Bm', 'F#m', 'E', 'A']
MEL_A = [
    [(0, 1.5, 'F#5'), (1.5, 1.5, 'A5'), (3, 1, 'B5')],
    [(0, 1.5, 'G#5'), (1.5, 1.5, 'B5'), (3, 1, 'A5')],
    [(0, 1.5, 'A5'), (1.5, .5, 'B5'), (2, .5, 'C#6'), (2.5, .5, 'B5'), (3, 1, 'A5')],
    [(0, 2, 'F#5'), (2, 1, 'E5'), (3, 1, 'D5')],
    [(0, 1.5, 'D5'), (1.5, 1.5, 'F#5'), (3, 1, 'B5')],
    [(0, 1.5, 'C#5'), (1.5, 1.5, 'F#5'), (3, 1, 'A5')],
    [(0, 1, 'B5'), (1, 1, 'G#5'), (2, 1, 'E5'), (3, 1, 'B4')],
    [(0, 2, 'C#5'), (2, 1, 'E5'), (3, 1, 'A4')]]
CH_B = ['Bm', 'G', 'D', 'A', 'Bm', 'G', 'A', 'E']
def run(pitches, tail):
    return [(i * 0.25, 0.25, p) for i, p in enumerate(pitches)] + tail
MEL_B = [
    run(['B4', 'C#5', 'D5', 'E5', 'F#5', 'E5', 'D5', 'C#5'], [(2, 1.5, 'F#5'), (3.5, .5, 'E5')]),
    run(['B4', 'D5', 'G5', 'D5', 'B4', 'D5', 'G5', 'D5'], [(2, 1.5, 'B5'), (3.5, .5, 'A5')]),
    run(['A4', 'D5', 'F#5', 'A5', 'F#5', 'D5', 'F#5', 'A5'], [(2, 2, 'F#5')]),
    run(['A4', 'C#5', 'E5', 'A5', 'E5', 'C#5', 'E5', 'A5'], [(2, 1, 'B5'), (3, 1, 'A5')]),
    run(['F#5', 'E5', 'D5', 'C#5', 'B4', 'C#5', 'D5', 'E5'], [(2, 2, 'F#5')]),
    run(['G5', 'F#5', 'E5', 'D5', 'B4', 'D5', 'E5', 'G5'], [(2, 2, 'B5')]),
    run(['E5', 'A5', 'C#6', 'A5', 'E5', 'A5', 'C#6', 'A5'], [(2, 2, 'A5')]),
    run(['E5', 'G#5', 'B5', 'G#5', 'E5', 'G#5', 'B5', 'G#5'], [(2, 1, 'B5'), (3, 1, 'B4')])]
CH_C1 = CH_A
CH_C2 = ['D', 'E', 'A', 'F#m', 'Bm', 'E', 'A', 'E']
MEL_C2 = [
    [(0, .5, 'A5'), (.5, .5, 'B5'), (1, 1, 'D6'), (2, 1.5, 'B5'), (3.5, .5, 'A5')],
    [(0, 1, 'G#5'), (1, 1, 'B5'), (2, 2, 'G#5')],
    [(0, 1, 'A5'), (1, 1, 'C#6'), (2, 1, 'B5'), (3, 1, 'A5')],
    [(0, 1.5, 'A5'), (1.5, .5, 'F#5'), (2, 2, 'C#6')],
    [(0, 1, 'D6'), (1, 1, 'B5'), (2, 1, 'F#5'), (3, 1, 'D5')],
    [(0, 1, 'E5'), (1, 1, 'G#5'), (2, 1, 'B5'), (3, 1, 'G#5')],
    [(0, 1, 'A5'), (1, 1, 'C#6'), (2, 2, 'E5')],
    [(0, 3, 'B5'), (3, 1, 'G#5')]]
CH_D = ['Bm', 'F#m', 'E', 'A', 'Bm', 'F#m', 'E', 'E']
for m, sc, w in ((INTRO_M[4:], LYD, 'Intro'), (MEL_A, LYD, 'A'), (MEL_B, DMAJ, 'B'), (MEL_C2, LYD, 'C2')):
    for bar in m: check(bar, sc, w)

# ==== Arrangement ===========================================================================
# ---- Lichtung (0–7) ---------------------------------------------------------------------------
for i in range(8):
    b, ch = i, CH_I[i]; v = i / 7
    bass(b, ch, 84 + int(8 * v)); pizz_pulse(b, ch, 78 + int(8 * v)); harp(b, ch, 76 + int(6 * v))
    groove(b, 'soft', 1.0 + 0.08 * v)
    pad('oohs', b, ch, 62 + int(12 * v), 57)
    stacc(b, ch, 66 + 3 * i)
    if i >= 4: line(b, INTRO_M[i], ['flute'], [84 + 2 * (i - 4)])
    bells(b, ch, 66)
crash(0, 96); tomfill(7, 84); snare_roll(7, 1.5, 4, 64, 100)

# ---- Thema A (8–23) ---------------------------------------------------------------------------
crash(8, 104)
for i in range(16):
    b, k = 8 + i, i % 8; ch = CH_A[k]; second = i >= 8
    bass(b, ch, 92 + (4 if second else 0)); pizz_pulse(b, ch, 84 + (4 if second else 0))
    stacc(b, ch, 70 + (6 if second else 0)); harp(b, ch, 78); groove(b, 'A', 1.0 + (0.05 if second else 0))
    bells(b, ch, 70 + (6 if second else 0))
    if not second:
        line(b, MEL_A[k], ['oboe', 'violin'], [92, 56])
        if k >= 4: pad('oohs', b, ch, 60 + (k - 4) * 4, 57)
    else:
        line(b, MEL_A[k], ['oboe', 'flute', 'violin'], [90, 84, 82], {'oboe': 0, 'flute': 12 if False else 0, 'violin': 0})
        pad('oohs', b, ch, 74, 57)
        tr, th, f = tones(ch, 60)
        song.add('horns', song.bar(b), 3.9, th - 12 if th - 12 >= 48 else th, 70)
tomfill(15, 84); crash(16, 100); snare_roll(22, 2, 4, 60, 96); snare_roll(23, 0, 3.5, 78, 122); tomfill(23, 100)

# ---- Die Jagd B (24–39) -----------------------------------------------------------------------
crash(24, 112); crash(32, 112)
for i in range(16):
    b, k = 24 + i, i % 8; ch = CH_B[k]; second = i >= 8
    bass(b, ch, 100 + (4 if second else 0)); pizz_pulse(b, ch, 90); stacc(b, ch, 76 + (6 if second else 0))
    pad('tremolo', b, ch, 60 + (10 if second else 0), 60)
    groove(b, 'B', 1.0 + (0.05 if second else 0))
    bells(b, ch, 68)
    if second: harp(b, ch, 78)
    else: harp_up(b, ch, 82)
    if not second:
        line(b, MEL_B[k], ['flute', 'violin'], [92, 78])
    else:
        line(b, MEL_B[k], ['flute', 'violin', 'oboe'], [96, 88, 72])
        pad('choir', b, ch, 64 + (k // 4) * 6, 57)
        tr, th, f = tones(ch, 55); song.add('horns', song.bar(b), 1.9, f, 78); song.add('horns', song.bar(b) + 2, 1.9, th, 78)
tomfill(27, 88); tomfill(31, 92); tomfill(35, 96)
snare_roll(38, 0, 4, 60, 104); snare_roll(39, 0, 3.5, 90, 127); tomfill(39, 106)

# ---- Silberwald C (40–55) ---------------------------------------------------------------------
crash(40, 118); crash(48, 116)
for i in range(16):
    b, k = 40 + i, i % 8; second = i >= 8
    ch = (CH_C2 if second else CH_C1)[k]; mel = (MEL_C2 if second else MEL_A)[k]
    bass(b, ch, 104); pizz_pulse(b, ch, 92); stacc(b, ch, 84); harp(b, ch, 80, 60)
    pad('choir', b, ch, 86 + (4 if second else 0), 55); pad('oohs', b, ch, 70, 67)
    groove(b, 'C', 1.0 + (0.04 if second else 0)); bells(b, ch, 80)
    line(b, mel, ['flute', 'oboe', 'violin', 'horns'], [94, 90, 88, 84], {'flute': 0, 'oboe': 0, 'violin': 0, 'horns': -12})
    if k % 4 == 0 and b not in (40, 48): crash(b, 96)
tomfill(43, 90); tomfill(47, 96); tomfill(51, 96)
snare_roll(54, 0, 4, 70, 108); snare_roll(55, 0, 3.5, 96, 127); tomfill(55, 108)

# ---- Rückweg D (56–63) ------------------------------------------------------------------------
crash(56, 92)
for i in range(8):
    b, ch = 56 + i, CH_D[i]; v = i / 7
    bass(b, ch, 92); pizz_pulse(b, ch, 84 - int(4 * v)); stacc(b, ch, 66); harp(b, ch, 80)
    groove(b, 'soft', 1.05); bells(b, ch, 68)
    pad('oohs', b, ch, 66 + int(10 * v), 57); pad('tremolo', b, ch, 52 + int(8 * v), 60)
    if i < 4: line(b, MEL_A[4 + i], ['flute', 'violin'], [84, 60])
    else: harp_up(b, ch, 86)
tomfill(63, 88); snare_roll(63, 1, 4, 50, 96)

sf2, out = cli_paths('bgm_theme_elven.ogg')
song.render(sf2, out)
