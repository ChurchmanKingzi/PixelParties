# -*- coding: utf-8 -*-
"""Theme-Battle-Track „Dragoneer's Ascent“ (Archetyp Drago) → public/music/bgm_theme_drago.ogg

Drachenreiter-Fanfare in d-Mixolydisch (D-Dur mit kleiner Septime c), 136 BPM, 68 Takte (120,0 s),
nahtlos loopbar. Offene Quinten und weite Aufwärts-Sprünge in Hörnern/Trompete/Brass, Pauken und
Toms im Flügelschlag-Rhythmus 3+3+2, Streicher-Ostinato als Flügelschlag, Chor, Harfen-Glissandi
und Feuer-Läufe (16tel-Skalenläufe) in Trompete/Brass. Der Aufstieg (Sprung der Quinte a→d→a')
ist das Drachenruf-Motiv.

Aufbau (Takte, 0-basiert):
   0– 7  Intro     Pauken/Toms 3+3+2, Flügelschlag-Streicher, Hörnerruf in offenen Quinten
  8–23  Thema A    Fanfare (Horn + Trompete), zweiter Durchgang mit Brass, Harfe und Chor
  24–39  Steigerung B  Wurzeln steigen (D–Em–G–Am–C–G–C–D), Melodie steigt mit, Feuer-Läufe
  40–55  Höhepunkt C   Hymne Chor + Brass + Trompete, Pauken-Galopp, Läufe, Crashes
  56–63  Rückblick D   Drachenflug: Harfe/Chor/Hörner leise, Flügelschlag bleibt
  64–67  Rückführung E Wirbel, Feuerlauf, Aufbau auf C → Sprung zurück auf D (Takt 0)

Harmonie (je 1 Akkord/Takt): D C G D | Hm C G C  (bVII–I als Dur-Mixolydisch-Kadenz).
Aufruf:  python3 scripts/music/theme_drago.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 136, 68                         # 68 × 4 × 60/136 = 120,0 s
song = Song(bpm=BPM, bars=BARS)
song.inst('contra', 'contra',  84, 64)
song.inst('tuba',   'tuba',    90, 60)
song.inst('timp',   'timp',    98, 64)
song.inst('strings','tremolo', 74, 40)      # Flügelschlag
song.inst('str2',   'strings', 76, 88)
song.inst('horns',  'horns',   90, 42)
song.inst('brass',  'brass',   84, 60)
song.inst('trumpet','trumpet', 90, 76)
song.inst('trom',   'trombone',82, 84)
song.inst('choir',  'choir',   84, 64)
song.inst('harp',   'harp',    80, 96)
song.inst('hit',    'hit',     94, 64)
song.inst('flute',  'flute',   70, 30)

PC = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def nt(s):
    m = re.fullmatch(r'([A-G])(#?)(\d)', s); return n(PC[m[1]] + (1 if m[2] else 0), int(m[3]))
SCALE = [2, 4, 6, 7, 9, 11, 0]              # d-mixolydisch
CH = {'D': (2, (2, 6, 9)), 'C': (0, (0, 4, 7)), 'G': (7, (7, 11, 2)), 'Bm': (11, (11, 2, 6)),
      'Em': (4, (4, 7, 11)), 'Am': (9, (9, 0, 4))}
def near(pc, lo): return lo + ((pc - lo) % 12)

PROG_A = ['D', 'C', 'G', 'D', 'Bm', 'C', 'G', 'C']
PROG_B = ['D', 'Em', 'G', 'Am', 'C', 'G', 'C', 'D']

MEL_A = [
    [(0, 1, 'A4'), (1, 1, 'D5'), (2, 1.5, 'F#5'), (3.5, .5, 'E5')],
    [(0, 1, 'E5'), (1, 1, 'G5'), (2, 1.5, 'E5'), (3.5, .5, 'D5')],
    [(0, 1, 'B4'), (1, 1, 'D5'), (2, 2, 'G5')],
    [(0, 1, 'F#5'), (1, 1, 'A5'), (2, 2, 'D6')],
    [(0, 1.5, 'D6'), (1.5, .5, 'C6'), (2, 1, 'B5'), (3, 1, 'F#5')],
    [(0, 1, 'G5'), (1, 1, 'C6'), (2, 1.5, 'B5'), (3.5, .5, 'A5')],
    [(0, 1, 'B5'), (1, 1, 'G5'), (2, 1, 'D5'), (3, 1, 'G5')],
    [(0, 1, 'E5'), (1, 1, 'G5'), (2, 2, 'A5')],
]
MEL_B = [
    [(0, .5, 'A4'), (.5, .5, 'D5'), (1, 1, 'F#5'), (2, 2, 'A5')],
    [(0, .5, 'B4'), (.5, .5, 'E5'), (1, 1, 'G5'), (2, 2, 'B5')],
    [(0, .5, 'D5'), (.5, .5, 'G5'), (1, 1, 'B5'), (2, 2, 'D6')],
    [(0, .5, 'E5'), (.5, .5, 'A5'), (1, 1, 'C6'), (2, 2, 'E6')],
    [(0, 1, 'G5'), (1, 1, 'C6'), (2, 1, 'E6'), (3, 1, 'G6')],
    [(0, 1, 'D6'), (1, 1, 'B5'), (2, 1, 'G5'), (3, 1, 'B5')],
    [(0, 1, 'C6'), (1, 1, 'E6'), (2, 2, 'G6')],
    [(0, 1.5, 'F#6'), (1.5, .5, 'E6'), (2, 2, 'D6')],
]
MEL_C = [
    [(0, 2, 'D6'), (2, 1, 'A5'), (3, 1, 'F#5')],
    [(0, 1, 'E6'), (1, 1, 'D6'), (2, 1, 'C6'), (3, 1, 'G5')],
    [(0, 2, 'B5'), (2, 1, 'D6'), (3, 1, 'G6')],
    [(0, 1.5, 'F#6'), (1.5, .5, 'E6'), (2, 2, 'D6')],
    [(0, 2, 'D6'), (2, 1, 'B5'), (3, 1, 'F#5')],
    [(0, 1, 'E6'), (1, 1, 'G6'), (2, 1.5, 'E6'), (3.5, .5, 'D6')],
    [(0, 1, 'D6'), (1, 1, 'B5'), (2, 1, 'G5'), (3, 1, 'D6')],
    [(0, 1, 'E6'), (1, 1, 'G5'), (2, 2, 'A5')],
]
for M in (MEL_A, MEL_B, MEL_C):
    for bar in M:
        for _, _, p in bar: assert nt(p) % 12 in SCALE, p
def line(b, notes, insts, vels, shift=0):
    for off, dur, p in notes:
        for i, v in zip(insts, vels): song.add(i, song.bar(b) + off, dur * 0.95, nt(p) + shift, v)

# ---- Bausteine -----------------------------------------------------------------------------
WING = (0, 1.5, 3)                            # Flügelschlag 3+3+2 (in Achteln)
def timp(b, ch, kind='w', vel=98):
    s = song.bar(b); p = near(CH[ch][0], 38)
    if kind == 'w':
        for o in WING: song.add('timp', s + o, .5, p, vel + (6 if o == 0 else 0))
    elif kind == 'gallop':
        for o, v in ((0, 0), (1, -8), (1.5, -2), (2.5, -10), (3, -2), (3.5, -8)): song.add('timp', s + o, .4, p, vel + v)
    elif kind == 'roll':
        for i in range(16): song.add('timp', s + i * .25, .25, p, 60 + (vel - 60) * i / 15)
def low(b, ch, vel=90):
    p = near(CH[ch][0], 26); s = song.bar(b)
    song.add('contra', s, 3.95, p, vel - 6)
    for o in (0, 1.5, 3): song.add('tuba', s + o, .9 if o == 0 else .8, p + 12, vel + (6 if o == 0 else 0))
def wings(b, ch, vel=72):                     # Streicher: Flügelschlag-Ostinato Quinte↔Oktave
    rt = CH[ch][0]; r = near(rt, 50); s = song.bar(b)
    for i in range(8): song.add('strings', s + i * .5, .45, r + (7 if i in (2, 5) else 0) + (12 if i == 7 else 0), vel + (10 if i in (0, 3, 6) else 0))
def choir(b, ch, vel=80):
    for pc in CH[ch][1]: song.add('choir', song.bar(b), 3.95, near(pc, 57), vel)
    song.add('choir', song.bar(b), 3.95, near(CH[ch][0], 69), vel - 8)
def fifths(b, ch, insts, vel=84):             # Fanfare in offenen Quinten (Grundton+Quinte)
    r = CH[ch][0]; s = song.bar(b)
    for i in insts:
        for o, d in ((0, 1.2), (1.5, 1.2), (3, .9)):
            song.add(i, s + o, d, near(r, 50), vel); song.add(i, s + o, d, near(r, 50) + 7, vel - 4); song.add(i, s + o, d, near(r, 50) + 12, vel - 6)
def harp(b, ch, vel=70, up=True):
    rt, ps = CH[ch]; s = song.bar(b); base = near(rt, 48)
    notes = [base + iv for iv in (0, 7, 12, 16 if ps[1] - rt in (4, -8) else 15, 19, 24, 28, 31)]
    notes = [near(p % 12, 48) + 12 * ((p - 48) // 12) for p in notes]
    for i, p in enumerate(notes[::1 if up else -1]): song.add('harp', s + i * .25, .5, p, vel + i * 2)
def hit(b, beat, ch, vel=110, dur=.9):
    r = near(CH[ch][0], 48)
    for p in (r - 12, r, r + 7, r + 12): song.add('hit', song.bar(b) + beat, dur, p, vel)
def fire(b, beat, start, cnt, ins=('trumpet', 'brass'), up=True, vel=92):
    """Feuer-Lauf: 16tel auf der d-mixolydischen Tonleiter ab Note `start`."""
    sc = [p for p in range(40, 100) if p % 12 in SCALE]; k = sc.index(nt(start))
    for i in range(cnt):
        p = sc[k + i] if up else sc[k - i]
        for j, ins_ in enumerate(ins): song.add(ins_, song.bar(b) + beat + i * .25, .24, p, vel + i - 6 * j)

def drums(b, kind, v=1.0):
    s = song.bar(b)
    def d(o, note, vel): song.dr(s + o, note, vel * v)
    for o in WING: d(o, KICK, 112 if o == 0 else 100)
    if kind == 'I':
        d(1, TOM_L, 96); d(2.5, TOM_M, 90); d(3.5, TOM_L, 84)
    else:
        d(1, SNARE, 106); d(3, SNARE, 110); d(1, CLAP, 76); d(3, CLAP, 80)
        d(2.5, TOM_M, 88); d(3.5, TOM_L, 90)
    if kind in ('B', 'C'):
        for o in (0.5, 2, 2.5): d(o, TOM_H, 84)
        for i in range(8): d(i * .5, RIDE, 80 if i % 2 == 0 else 62)
    if kind == 'C': d(2, CLAP, 84); d(0.5, SIDESTICK, 74)
    if kind == 'soft': pass
def fill(b, big=False):
    s = song.bar(b)
    for i in range(8): song.dr(s + 2 + i * .25, [TOM_H, TOM_HH, TOM_M, TOM_L][i // 2], 88 + i * 4, .2)
    if big:
        for i in range(8): song.dr(s + .5 + i * .25, SNARE, 60 + i * 7, .15)
    song.dr(s + 3.75, KICK, 118)
def crash(b, v=110): song.dr(song.bar(b), CRASH, v, .5)
def roll(b, a, z, v0, v1):
    cnt = int((z - a) * 4)
    for i in range(cnt): song.dr(song.bar(b) + a + i * .25, SNARE, v0 + (v1 - v0) * i / max(1, cnt - 1), .15)

# ==== Arrangement =============================================================================
# Intro 0–7: Ruf in offenen Quinten (D–A–D')
INTRO = ['D', 'D', 'C', 'C', 'G', 'G', 'C', 'C']
hit(0, 0, 'D', 116, 1.5); crash(0, 108)
for i, ch in enumerate(INTRO):
    b = i
    low(b, ch, 74 + i * 3); timp(b, ch, 'w', 88 + i * 2); drums(b, 'I', .95 + i * .015); wings(b, ch, 56 + i * 4)
    if i >= 2: fifths(b, ch, ['horns'], 76 + i * 2)
    if i >= 4: choir(b, ch, 50 + (i - 4) * 8)
line(6, [(0, 1, 'A4'), (1, 1, 'D5'), (2, 2, 'A5')], ['trumpet'], [92])
line(7, [(0, 1, 'D5'), (1, 1, 'A5'), (2, 1.5, 'D6')], ['trumpet', 'horns'], [100, 86])
fire(7, 3, 'A5', 4, ('trumpet',), True, 90); fill(3); fill(7, True); roll(6, 2, 4, 60, 100)

# Thema A 8–23
hit(8, 0, 'D', 112, .9); crash(8, 112)
for i in range(16):
    b, k = 8 + i, i % 8; ch = PROG_A[k]; two = i >= 8
    low(b, ch, 88 + (4 if two else 0)); timp(b, ch, 'w', 96); drums(b, 'A', 1.0 + (.04 if two else 0)); wings(b, ch, 70 + (6 if two else 0))
    line(b, MEL_A[k], ['horns', 'trumpet'] + (['brass'] if two else []), [92, 84, 76])
    if two:
        harp(b, ch, 66 + (k // 2) * 3); choir(b, ch, 60 + (k // 4) * 12)
    else:
        song.add('flute', song.bar(b), 3.9, near(CH[ch][1][2], 74), 60)
fill(15); crash(16, 104); fire(19, 3, 'D5', 4); fire(23, 2, 'A5', 8, ('trumpet', 'brass'), True, 90)
fill(23, True); roll(23, 0, 2, 80, 118)

# Steigerung B 24–39
hit(24, 0, 'D', 114, .9); crash(24, 114); crash(32, 116)
for i in range(16):
    b, k = 24 + i, i % 8; ch = PROG_B[k]; two = i >= 8
    low(b, ch, 96 + (4 if two else 0)); timp(b, ch, 'gallop', 98); drums(b, 'B', 1.03 + (.03 if two else 0)); wings(b, ch, 78)
    line(b, MEL_B[k], ['trumpet', 'horns'] + (['brass', 'trom'] if two else []), [94, 84, 82, 70])
    choir(b, ch, 66 + (k // 2) * 4 + (8 if two else 0)); harp(b, ch, 68, up=(k % 2 == 0))
    if two: song.add('str2', song.bar(b), 3.9, near(CH[ch][0], 60), 72)
fill(31); fill(35); fire(35, 3, 'D5', 4); fire(37, 3, 'G5', 4); fire(39, 1.5, 'A5', 10, ('trumpet', 'brass'), True, 92)
fill(39, True); roll(38, 0, 4, 60, 100); roll(39, 0, 1.5, 100, 124)

# Höhepunkt C 40–55
hit(40, 0, 'D', 122, 1.2); crash(40, 120); hit(48, 0, 'D', 118, .9); crash(48, 118)
for i in range(16):
    b, k = 40 + i, i % 8; ch = (PROG_A if i < 8 else PROG_A)[k]
    low(b, ch, 100); timp(b, ch, 'gallop', 104); drums(b, 'C', 1.06); wings(b, ch, 82)
    line(b, MEL_C[k], ['trumpet', 'brass', 'horns'], [100, 90, 86]); choir(b, ch, 90 + (4 if i >= 8 else 0))
    if i >= 8: fifths(b, ch, ['trom'], 76)
    harp(b, ch, 72, up=True); song.add('str2', song.bar(b), 3.9, near(CH[ch][0], 60), 82)
    if k % 4 == 0 and b not in (40, 48): crash(b, 100)
fill(43); fill(47); fire(43, 3, 'A5', 4, up=False); fire(51, 3, 'A5', 4, up=False); fire(47, 2, 'D5', 8, ('trumpet', 'brass'), True, 96)
fill(51); fill(55, True); roll(54, 0, 4, 70, 110); roll(55, 0, 2, 100, 124)

# Rückblick D 56–63: Drachenflug
crash(56, 96)
for i in range(8):
    b, ch = 56 + i, PROG_A[i]
    low(b, ch, 84 + i); timp(b, ch, 'w', 84 + i); drums(b, 'A', .9 + i * .02); wings(b, ch, 62 + i * 2)
    line(b, MEL_A[i], ['horns', 'flute'], [80 + i, 60]); harp(b, ch, 60 + i * 2, up=(i % 2 == 0))
    if i >= 2: choir(b, ch, 50 + i * 5)
fill(59); fill(63, True); roll(62, 2, 4, 60, 100)

# Rückführung E 64–67: Aufbau auf C, dann Sprung nach D
ERET = ['G', 'G', 'C', 'C']
for i, ch in enumerate(ERET):
    b = 64 + i
    low(b, ch, 94 + i * 3); timp(b, ch, 'gallop' if i < 2 else 'roll', 100 + i * 3); wings(b, ch, 80 + i * 4); choir(b, ch, 78 + i * 6)
    if i < 2: drums(b, 'B', 1.0)
    else: roll(b, 0, 4, 60 + (i - 2) * 30, 96 + (i - 2) * 28)
    fifths(b, ch, ['trumpet'], 84 + i * 4)
hit(64, 0, 'G', 108, .9); crash(64, 104)
line(66, [(0, 1, 'G5'), (1, 1, 'C6'), (2, 2, 'E6')], ['trumpet', 'brass', 'horns'], [100, 88, 84])
fire(67, 0, 'A5', 6, ('trumpet', 'brass'), True, 92); line(67, [(1.5, 2.3, 'A5')], ['horns'], [100])
fill(65); fill(67, True)

sf2, out = cli_paths('bgm_theme_drago.ogg')
song.render(sf2, out)
