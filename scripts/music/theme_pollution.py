# -*- coding: utf-8 -*-
"""Theme-Battle-Track „Acid Rain Requiem“ (Archetyp Pollution) → public/music/bgm_theme_pollution.ogg

Giftige Industrie-Ödnis in cis-Phrygisch (cis-Moll mit kleiner Sekunde d), 132 BPM, 64 Takte
(116,4 s), nahtlos loopbar. Schmutziger Acid-/Saw-Bass, hämmernder Fabrik-Beat (Amboss-Toms,
Kuhglocke, Clap), Sirene im Tritonus (gis–d), Glocke „Big Gwen“ (Uhrturm) und Sci-Fi-Pads
mit säuerlicher kleiner Sekunde – darüber eine traurige Requiem-Melodie (Streicher/Saw).

Aufbau (Takte, 0-basiert):
   0– 7  Intro     Hammer-Beat, Acid-Bass, Sirene, Glocke; Bass/Stabs steigen ein
   8–23  Thema A   traurige Melodie (bowed), zweiter Durchgang mit Gegenstimme (Oboe) und Pads
  24–39  Steigerung B  Sequenz abwärts über Hm–A–cism–D, Square-Echo, Cluster-Pads, 16tel-Kicks
  40–55  Höhepunkt C   Saw-Lead + Streicher, Arpeggio-Sequenzer, Sirenen, Crashes
  56–63  Rückführung D leise Wiederkehr des Themas, Glocke, Riser/Fill → zurück auf Takt 0

Harmonie (je 1 Akkord/Takt): cism D Hm A | cism D E gisdim  (Phrygisch, D = kleine Sekunde).
Aufruf:  python3 scripts/music/theme_pollution.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 132, 64                         # 64 × 4 × 60/132 = 116,4 s
song = Song(bpm=BPM, bars=BARS)
song.inst('bass',   'acidbass',  100, 60)
song.inst('bass2',  'squarebass', 84, 68)
song.inst('pad',    'scifi',      74, 40)
song.inst('pad2',   'atmos',      66, 88)
song.inst('stab',   'charang',    72, 92)
song.inst('siren',  'square',     62, 30)
song.inst('bell',   'bell',       84, 64)
song.inst('lead',   'bowed',      92, 64)
song.inst('lead2',  'saw',        70, 74)
song.inst('echo',   'square',     60, 40)
song.inst('oboe',   'oboe',       80, 52)
song.inst('arp',    'bright',     66, 96)
song.inst('strings','strings',    74, 50)

PC = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def nt(s):
    m = re.fullmatch(r'([A-G])(#?)(\d)', s); return n(PC[m[1]] + (1 if m[2] else 0), int(m[3]))
SCALE = {1, 2, 4, 6, 8, 9, 11}               # cis-phrygisch
CH = {'C#m': (1, (1, 4, 8)), 'D': (2, (2, 6, 9)), 'Bm': (11, (11, 2, 6)), 'A': (9, (9, 1, 4)),
      'E': (4, (4, 8, 11)), 'G#d': (8, (8, 11, 2))}
def near(pc, lo):                             # tiefste Note >= lo mit Tonklasse pc
    p = lo + ((pc - lo) % 12); return p
def bassnote(ch, lo=33): return near(CH[ch][0], lo)

PROG_A = ['C#m', 'D', 'Bm', 'A', 'C#m', 'D', 'E', 'G#d']
PROG_B = ['Bm', 'A', 'C#m', 'D', 'Bm', 'A', 'G#d', 'E']

# ---- Melodien (Takt = Liste (Beat, Dauer, Note)) ---------------------------------------
MEL_A = [
    [(0, 1.5, 'E5'), (1.5, .5, 'F#5'), (2, 2, 'G#5')],
    [(0, 1.5, 'F#5'), (1.5, .5, 'E5'), (2, 2, 'D5')],
    [(0, 2, 'D5'), (2, 1, 'F#5'), (3, 1, 'E5')],
    [(0, 1.5, 'C#5'), (1.5, .5, 'E5'), (2, 2, 'A5')],
    [(0, 1.5, 'E5'), (1.5, .5, 'G#5'), (2, 2, 'B5')],
    [(0, 1.5, 'A5'), (1.5, .5, 'F#5'), (2, 1, 'D5'), (3, 1, 'F#5')],
    [(0, 1, 'G#5'), (1, 1, 'E5'), (2, 1, 'B4'), (3, 1, 'E5')],
    [(0, 1, 'D5'), (1, 1, 'B4'), (2, 2, 'G#4')],
]
MEL_B = [
    [(0, 1, 'B5'), (1, 1, 'F#5'), (2, 2, 'D5')],
    [(0, 1, 'A5'), (1, 1, 'E5'), (2, 2, 'C#5')],
    [(0, 1, 'G#5'), (1, 1, 'E5'), (2, 1, 'C#5'), (3, 1, 'E5')],
    [(0, 1.5, 'F#5'), (1.5, .5, 'A5'), (2, 2, 'D6')],
    [(0, 1, 'D6'), (1, 1, 'B5'), (2, 1, 'F#5'), (3, 1, 'D5')],
    [(0, 1, 'C#6'), (1, 1, 'A5'), (2, 1, 'E5'), (3, 1, 'C#5')],
    [(0, 1, 'D6'), (1, 1, 'B5'), (2, 1, 'G#5'), (3, 1, 'D5')],
    [(0, 2, 'B5'), (2, 1, 'G#5'), (3, 1, 'E5')],
]
for M in (MEL_A, MEL_B):
    for bar in M:
        for _, _, p in bar: assert nt(p) % 12 in SCALE, p

def line(b, notes, insts, vels, shift=0):
    for off, dur, p in notes:
        for i, v in zip(insts, vels): song.add(i, song.bar(b) + off, dur * 0.95, nt(p) + shift, v)

# ---- Bausteine -----------------------------------------------------------------------------
ACID = [(0, 1.0, 0), (0.75, .5, 12), (1.5, .5, 0), (2, 1.0, 0), (2.75, .5, 7), (3.5, .5, 12)]
def bass(b, ch, vel=100, dense=False):
    r = bassnote(ch); s = song.bar(b)
    for off, d, iv in ACID: song.add('bass', s + off, d * .8, r + iv, vel + (8 if off == 0 else 0))
    if dense:
        for off in (0.25, 1.0, 2.5, 3.25): song.add('bass', s + off, .2, r, vel - 14)

def pad(b, ch, vel=70, sour=False):
    rt, ps = CH[ch]; s = song.bar(b)
    for pc in ps: song.add('pad', s, 3.98, near(pc, 52), vel)
    song.add('pad2', s, 3.98, near(rt, 40) + 12, vel - 8)
    if sour: song.add('pad', s, 3.98, near((rt + 1) % 12, 64), vel - 6)   # kleine Sekunde

def stab(b, ch, vel=74, offs=(1.5, 3.25)):
    rt, ps = CH[ch]
    for off in offs:
        for pc in ps[:2]: song.add('stab', song.bar(b) + off, .3, near(pc, 60), vel)

def siren(b, bars=2, vel=64):
    for k in range(bars * 4):
        song.add('siren', song.bar(b) + k, .95, nt('G#5') if k % 2 == 0 else nt('D5'), vel)

def toll(b, ch='C#m', vel=88):
    song.add('bell', song.bar(b), 3.9, nt('C#4'), vel); song.add('bell', song.bar(b), 3.9, nt('D4'), vel - 26)

def arp(b, ch, vel=66):
    rt, ps = CH[ch]; cyc = [near(ps[0], 72), near(ps[1], 72), near(ps[2], 72), near(ps[1], 72) + 12]
    for i in range(16): song.add('arp', song.bar(b) + i * .25, .2, cyc[(i * 3) % 4 if i % 5 else i % 4], vel + (8 if i % 4 == 0 else 0))

def drums(b, kind, v=1.0):
    s = song.bar(b)
    def d(o, note, vel): song.dr(s + o, note, vel * v)
    for i in range(4): d(i, KICK, 112 if i % 2 == 0 else 98)
    d(1, SNARE, 108); d(3, SNARE, 112)
    if kind in ('A', 'B', 'C'):
        d(1, CLAP, 84); d(3, CLAP, 88)
        for o in (0.5, 1.5, 2.5, 3.5): d(o, COWBELL, 78)
        d(3.75, TOM_L, 92)
    if kind in ('B', 'C'):
        for o in (0.75, 2.75): d(o, KICK, 84)
        d(2.5, SIDESTICK, 84)
    if kind == 'C':
        for o in (0.25, 1.25, 2.25, 3.25): d(o, SIDESTICK, 70)
        d(2, TOM_M, 92)
    if kind == 'I':
        for o in (0.5, 1.5, 2.5, 3.5): d(o, COWBELL, 72)
        d(3.5, SIDESTICK, 88)
    if kind == 'soft':
        for o in (0.5, 2.5): d(o, COWBELL, 66)
        d(3.5, SIDESTICK, 84)

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
# Intro 0–7
for i in range(8):
    b, ch = i, PROG_A[i]
    bass(b, ch, 84 + i * 2)
    drums(b, 'I', .95 + i * .01)
    pad(b, ch, 58 + i * 3)
    if i % 2 == 0: toll(b, ch, 84)
    if i >= 2: stab(b, ch, 66 + i * 2)
    if i in (0, 1, 4, 5): siren(b, 1, 56)
    if i >= 4: song.add('strings', song.bar(b), 3.9, near(CH[ch][0], 48), 62 + (i - 4) * 4)
crash(0, 108); fill(3); fill(7, True); roll(6, 2, 4, 60, 100)

# Thema A 8–23
crash(8, 112)
for i in range(16):
    b, k = 8 + i, i % 8; ch = PROG_A[k]; two = i >= 8
    bass(b, ch, 96 + (4 if two else 0)); drums(b, 'A', 1.0 + (.04 if two else 0)); pad(b, ch, 68 + (6 if two else 0), sour=(two and k in (0, 4)))
    stab(b, ch, 72)
    line(b, MEL_A[k], ['lead'] + (['echo'] if two else []), [92, 56])
    if two:
        rt, ps = CH[ch]; song.add('oboe', song.bar(b), 1.95, near(ps[1], 60), 76); song.add('oboe', song.bar(b) + 2, 1.95, near(ps[0], 60), 72)
        song.add('strings', song.bar(b), 3.9, near(rt, 48), 70)
    if k in (3, 7): toll(b, ch, 74)
fill(15); crash(16, 104); fill(23, True); roll(22, 2, 4, 60, 100); roll(23, 0, 2, 80, 118)

# Steigerung B 24–39
crash(24, 114); crash(32, 116)
for i in range(16):
    b, k = 24 + i, i % 8; ch = PROG_B[k]; two = i >= 8
    bass(b, ch, 100 + (4 if two else 0), dense=True); drums(b, 'B', 1.03 + (.04 if two else 0)); pad(b, ch, 76, sour=True)
    stab(b, ch, 76, (0.75, 1.5, 3.25))
    line(b, MEL_B[k], ['lead'] + (['lead2', 'echo'] if two else ['echo']), [94, 70, 60] if two else [94, 58])
    song.add('bass2', song.bar(b), 3.9, near(CH[ch][0], 36), 80)
    song.add('strings', song.bar(b), 3.9, near(CH[ch][0], 48), 74 + (6 if two else 0))
    if k in (4, 6): siren(b, 1, 58)
fill(31); fill(35); fill(39, True); roll(38, 0, 4, 60, 100); roll(39, 0, 2, 100, 124)

# Höhepunkt C 40–55
crash(40, 120); crash(48, 118)
for i in range(16):
    b, k = 40 + i, i % 8; ch = (PROG_A if i < 8 else PROG_B)[k]; mel = (MEL_A if i < 8 else MEL_B)[k]
    bass(b, ch, 106, dense=True); drums(b, 'C', 1.06); pad(b, ch, 78, sour=True)
    stab(b, ch, 80, (0.75, 1.5, 2.75, 3.25)); arp(b, ch, 64)
    line(b, mel, ['lead2', 'lead', 'oboe'], [100, 86, 70])
    song.add('bass2', song.bar(b), 3.9, near(CH[ch][0], 36), 90)
    song.add('strings', song.bar(b), 3.9, near(CH[ch][0], 48), 84)
    if k in (0, 4): siren(b, 1, 62)
    if k == 0 and b not in (40, 48): crash(b, 100)
fill(43); fill(47); fill(51); fill(55, True); roll(54, 0, 4, 70, 110); roll(55, 0, 2, 100, 124)

# Rückführung D 56–63
crash(56, 96)
PROG_D = ['C#m', 'D', 'Bm', 'A', 'C#m', 'D', 'E', 'G#d']
for i in range(8):
    b, ch = 56 + i, PROG_D[i]
    bass(b, ch, 90 + i * 2); drums(b, 'soft' if i < 6 else 'A', 1.0 + i * .02); pad(b, ch, 66 + i * 2, sour=(i % 2 == 0))
    line(b, MEL_A[i], ['oboe', 'echo'], [82, 50])
    if i % 2 == 0: toll(b, ch, 84)
    if i >= 4: stab(b, ch, 62 + i * 2)
    if i in (6, 7): siren(b, 1, 60)
    song.add('strings', song.bar(b), 3.9, near(CH[ch][0], 48), 60 + i * 3)
fill(59); fill(63, True); roll(62, 2, 4, 60, 100); roll(63, 0, 2, 90, 124)

sf2, out = cli_paths('bgm_theme_pollution.ogg')
song.render(sf2, out)
