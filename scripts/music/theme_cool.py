# -*- coding: utf-8 -*-
"""Theme-Battle-Track „Too Cool to Lose“ (Archetyp Cool) → public/music/bgm_theme_cool.ogg

Funk/Acid-Jazz-Kampf in e-Dorisch, 112 BPM, 56 Takte (120,0 s), nahtlos loopbar.
Lässige Überlegenheit: gepickter E-Bass-Groove, Clean-Gitarren-Chops, Rhodes-Stabs, Saxofon-Hook,
Blech-Stabs, gedämpfte Trompete als Antwort, 16tel-Funk-Schlagzeug mit Swing (jede zweite 16tel
leicht verzögert). Nordischer Einschlag der Cool-Karten (Wowhalla, Ragnarock, Yolomungandr):
Gjallarhorn-Ruf (leere Quinte e-h-e im Horn) am Anfang und im Break und Rock-Powerchords
im Refrain („Ragnarock“).

Aufbau (Takte, 0-basiert):
   0– 7  Intro     Groove, Horn-Ruf, Gitarren-Chops, ab Takt 4 Rhodes
   8–23  Thema A   Sax-Hook über Em7/A7 (Vamp), zweiter Durchgang mit Vibraphon und Trompeten-Antworten
  24–31  Bridge B  Gmaj7–A7–Bm7–A7, aufsteigende Sax-Linie, Orgel-Fläche, Blech-Stabs
  32–47  Refrain C „Too cool to lose“: Sax+Trompete, Blech, Rock-Powerchords, Cowbell
  48–51  Break     Bass + Schlagzeug + Clap (Bass-Solo-Figur), Vibes, Horn-Ruf
  52–55  Rückführung  Crescendo, Snare-Wirbel → zurück auf Takt 0

Harmonie: e-Dorisch (E F# G A H C# D); Akkorde Em7, A7 (dorisches Dur-IV), Gmaj7, Bm7, Dmaj7.
Aufruf:  python3 scripts/music/theme_cool.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 112, 56                       # 56 × 4 × 60/112 = 120,0 s
SW = 0.07                                 # Swing: 16tel mit ungeradem Index um 0,07 Schläge verzögert
song = Song(bpm=BPM, bars=BARS)

song.inst('bass',   'bass2',   100, 62)
song.inst('gtr',    'cleangtr', 86, 40)   # Chops
song.inst('epiano', 'epiano',   78, 84)
song.inst('organ',  'organ2',   58, 50)
song.inst('sax',    'sax',      92, 72)
song.inst('muted',  'muted',    84, 30)
song.inst('brass',  'brass',    82, 78)
song.inst('vibes',  'vibes',    76, 92)
song.inst('rock',   'rockgtr',  80, 56)
song.inst('horns',  'horns',    88, 64)
song.inst('timp',   'timp',     90, 64)

NAMES = {'C': C, 'C#': Db, 'D': D, 'D#': Eb, 'E': E, 'F': F, 'F#': Gb, 'G': G, 'G#': Ab, 'A': A, 'A#': Bb, 'B': B}
def nt(s): return n(NAMES[s[:-1]], int(s[-1]))
SCALE = {E, Gb, G, A, B, Db, D}           # e-Dorisch

# Akkord → Töne (Prim, Terz, Quinte, Septime) als Tonklassen; alle in e-Dorisch
CH = {'Em7': (E, G, B, D), 'A7': (A, Db, E, G), 'Gmaj7': (G, B, D, Gb),
      'Bm7': (B, D, Gb, A), 'Dmaj7': (D, Gb, A, Db)}
for v in CH.values(): assert all(p in SCALE for p in v)

def pos(bar, step): return song.bar(bar) + step * 0.25 + (SW if step % 2 else 0)
def low(pc, o=2):  return n(pc, o) if pc >= E else n(pc, o + 1)          # Bass 40–51
def above(pc, base): 
    p = n(pc, 3)
    while p < base: p += 12
    return p

# ---- Bass ---------------------------------------------------------------------------------
BASS_A = [(0, 'r', 2, 104), (3, 'r', 1, 88), (4, 'o', 1, 96), (6, 's', 1, 86), (8, 'r', 2, 100),
          (10, '5', 1, 90), (11, '3', 1, 84), (12, 'r', 1, 96), (14, 's', 1, 86)]
BASS_B = [(0, 'r', 1, 108), (2, 'r', 1, 84), (3, 'o', 1, 96), (5, '5', 1, 86), (6, 's', 1, 92), (8, 'r', 2, 102),
          (10, 'r', 1, 88), (11, '3', 1, 86), (12, '5', 1, 94), (13, 's', 1, 84), (14, 'o', 2, 98)]
def bass(b, ch, pat=BASS_A, v=1.0):
    t = CH[ch]; r = low(t[0])
    for st, k, d, vel in pat:
        if k in 'ro': p = r + (12 if k == 'o' else 0)
        else:
            p = low({'5': t[2], '3': t[1], 's': t[3]}[k])
            if p < r: p += 12
        song.add('bass', pos(b, st), d * 0.25 * 0.9, p, vel * v)

# ---- Gitarren-Chops / Rhodes / Pads --------------------------------------------------------
CHOP = [(0, 100), (3, 82), (6, 96), (10, 90), (11, 76), (14, 92)]
def chops(b, ch, v=1.0, pat=CHOP):
    t = CH[ch]; base = n(t[0], 3)
    notes = [above(t[1], base + 3), above(t[3], base + 3), above(t[2], base + 3)]
    for st, vel in pat:
        for p in notes: song.add('gtr', pos(b, st), 0.2, p, vel * v)
def rhodes(b, ch, v=1.0):
    t = CH[ch]; base = n(t[0], 4)
    for st in (2, 7, 10):
        for p in (above(t[1], base) , above(t[3], base), above(t[2], base) + 12 * 0):
            song.add('epiano', pos(b, st), 0.5, p, 70 * v + (8 if st == 2 else 0))
def organ(b, ch, vel=60):
    t = CH[ch]; base = n(t[0], 3)
    for p in (above(t[1], base), above(t[3], base), above(t[2], base)): song.add('organ', song.bar(b), 3.95, p, vel)
def stabs(b, ch, steps=(0, 6, 10), vel=92, inst='brass'):
    t = CH[ch]; base = n(t[0], 4)
    for st in steps:
        for p in (above(t[1], base), above(t[3], base), above(t[2], base) + 0): song.add(inst, pos(b, st), 0.3, p, vel + (8 if st == 0 else 0))
def power(b, ch, vel=88):
    r = low(CH[ch][0], 2) + 12 * 0
    for st, d in ((0, 1.5), (6, 1.0), (10, 0.5), (12, 0.9)):
        for p in (r, r + 7, r + 12): song.add('rock', pos(b, st), d * 0.9, p, vel + (8 if st == 0 else 0))

# ---- Melodie: Zeilen in 16tel-Schritten [(Schritt, Länge, Ton)] ------------------------------
def line(b, notes, insts, vels, shift=0):
    for st, d, p in notes:
        assert (nt(p) % 12) in SCALE, p
        for inst, v in zip(insts, vels): song.add(inst, pos(b, st), d * 0.25 * 0.92, nt(p) + shift, v)

HA1 = [[(0, 1, 'B4'), (1, 1, 'E5'), (3, 2, 'G5'), (6, 1, 'F#5'), (7, 1, 'E5'), (10, 2, 'D5'), (13, 1, 'E5'), (14, 2, 'B4')],
       [(2, 1, 'B4'), (3, 1, 'D5'), (4, 2, 'E5'), (8, 1, 'G5'), (9, 1, 'F#5'), (10, 1, 'E5'), (12, 4, 'D5')]]
HA2 = [[(0, 1, 'C#5'), (1, 1, 'E5'), (3, 2, 'A5'), (6, 1, 'G5'), (7, 1, 'E5'), (10, 2, 'C#5'), (12, 1, 'E5'), (14, 2, 'C#5')],
       [(0, 2, 'E5'), (3, 1, 'G5'), (4, 2, 'A5'), (8, 2, 'G5'), (10, 1, 'E5'), (11, 1, 'C#5'), (12, 4, 'A4')]]
HA_BM = [(0, 1, 'D5'), (2, 1, 'F#5'), (4, 2, 'B5'), (8, 2, 'A5'), (10, 2, 'F#5'), (12, 4, 'D5')]
B_G = [(0, 3, 'B4'), (4, 2, 'D5'), (6, 2, 'F#5'), (8, 4, 'G5'), (12, 4, 'D5')]
B_A = [(0, 2, 'E5'), (3, 1, 'G5'), (4, 3, 'A5'), (8, 2, 'G5'), (10, 2, 'E5'), (12, 4, 'C#5')]
B_BM = [(0, 2, 'D5'), (2, 2, 'F#5'), (4, 2, 'A5'), (6, 2, 'B5'), (8, 4, 'A5'), (12, 4, 'F#5')]
B_A2 = [(0, 1, 'E5'), (1, 1, 'G5'), (2, 1, 'A5'), (3, 1, 'G5'), (4, 2, 'E5'), (6, 2, 'C#5'), (8, 1, 'E5'), (9, 1, 'C#5'), (10, 2, 'A4'), (12, 4, 'E5')]
B_D = [(0, 2, 'A5'), (3, 1, 'F#5'), (4, 2, 'D5'), (8, 2, 'A4'), (10, 2, 'C#5'), (12, 4, 'D5')]
C_EM = [(0, 2, 'E5'), (3, 1, 'E5'), (4, 1, 'G5'), (6, 2, 'B5'), (10, 1, 'A5'), (11, 1, 'G5'), (12, 4, 'E5')]
C_G = [(0, 2, 'D5'), (3, 1, 'D5'), (4, 1, 'F#5'), (6, 2, 'G5'), (10, 1, 'B5'), (11, 1, 'A5'), (12, 4, 'G5')]
C_A = [(0, 2, 'C#5'), (3, 1, 'C#5'), (4, 1, 'E5'), (6, 2, 'A5'), (10, 1, 'G5'), (11, 1, 'E5'), (12, 4, 'C#5')]
C_BM = [(0, 2, 'D5'), (3, 1, 'F#5'), (4, 1, 'A5'), (6, 2, 'B5'), (8, 2, 'A5'), (10, 2, 'F#5'), (12, 4, 'D5')]
C_A_END = [(0, 1, 'E5'), (1, 1, 'G5'), (2, 1, 'A5'), (4, 4, 'E5'), (8, 2, 'A5'), (10, 2, 'G5'), (12, 4, 'E5')]

# ---- Schlagzeug ------------------------------------------------------------------------------
def groove(b, kind, v=1.0):
    def d(st, note, vel): song.dr(pos(b, st), note, vel * v)
    kicks = {'lite': (0, 6, 10), 'A': (0, 3, 6, 10), 'C': (0, 3, 6, 10, 14)}[kind]
    for st in kicks: d(st, KICK, 112 if st == 0 else 96)
    d(4, SNARE, 108); d(12, SNARE, 110)
    if kind != 'lite':
        for st in (7, 9, 15): d(st, SNARE, 40)                      # Ghost-Notes
    for st in range(16): d(st, HAT, 118 if st % 4 == 0 else (104 if st % 2 == 0 else 84))
    if kind == 'C':
        d(4, CLAP, 90); d(12, CLAP, 92); d(14, OHAT, 110)
        for st in (0, 4, 8, 12): d(st, COWBELL, 84)
    elif kind == 'A':
        d(14, OHAT, 108)
        for st in (2, 6, 10, 14): d(st, SIDESTICK, 66)
    else:
        for st in (2, 10): d(st, SIDESTICK, 70)
def fill(b, big=False):
    for i, (st, note) in enumerate(((10, SNARE), (11, TOM_H), (12, TOM_HH), (13, TOM_M), (14, TOM_L), (15, TOM_L))):
        song.dr(pos(b, st), note, 84 + i * 6 + (8 if big else 0), 0.2)
def roll(b, a, z, v0, v1):
    cnt = int((z - a) * 4)
    for i in range(cnt): song.dr(song.bar(b) + a + i * 0.25, SNARE, v0 + (v1 - v0) * i / max(1, cnt - 1), 0.15)
def crash(b, vel=112): song.dr(song.bar(b), CRASH, vel, 0.5)
def horn_call(b, vel=96):                # Gjallarhorn: leere Quinte e–h–e
    for k, (off, d, p) in enumerate(((0, 1.5, n(E, 3)), (1.5, 1.0, n(B, 3)), (2.5, 1.5, n(E, 4)))):
        song.add('horns', song.bar(b) + off, d, p, vel + k * 4)
        song.add('horns', song.bar(b) + off, d, p + 7 if k < 2 else p + 7, vel - 12)

# ==== Arrangement =============================================================================
# Intro 0–7
CH_I = ['Em7', 'Em7', 'Em7', 'Em7', 'A7', 'A7', 'Bm7', 'A7']
for i, ch in enumerate(CH_I):
    bass(i, ch, BASS_A, 0.95 + i * 0.01)
    groove(i, 'lite' if i < 4 else 'A', 1.0)
    if i >= 2: chops(i, ch, 0.85 + 0.03 * i)
    if i >= 4: rhodes(i, ch, 0.9 + 0.02 * i)
    song.add('timp', song.bar(i), 0.5, low(CH[ch][0], 2), 70 + i * 3)
horn_call(0, 100); crash(0, 108); fill(3); fill(7, True)
line(6, [(0, 1, 'B4'), (2, 1, 'E5'), (4, 2, 'G5')], ['sax'], [84])
line(7, [(0, 1, 'F#5'), (2, 1, 'E5'), (4, 2, 'D5'), (8, 2, 'B4'), (12, 4, 'E5')], ['sax'], [90])

# Thema A 8–23: zweimal Em7 Em7 A7 A7 | Em7 Em7 A7 Bm7
CH_A = ['Em7', 'Em7', 'A7', 'A7', 'Em7', 'Em7', 'A7', 'Bm7']
crash(8, 110)
for i in range(16):
    b, k, second = 8 + i, i % 8, i >= 8
    ch = CH_A[k]
    bass(b, ch, BASS_B if second else BASS_A, 1.0)
    groove(b, 'A', 1.03 if second else 1.0)
    chops(b, ch, 0.95)
    rhodes(b, ch, 0.9)
    if k < 2 or k == 4 or k == 5: notes = HA1[k % 2]
    elif k in (2, 3): notes = HA2[k - 2]
    elif k == 6: notes = HA2[0]
    else: notes = HA_BM
    line(b, notes, ['sax'] + (['muted'] if second else []), [94, 78])
    if second and k in (1, 3, 5):     # Antworten der gedämpften Trompete in Lücken
        line(b, [(13, 1, 'E5'), (14, 2, 'G5')] if ch != 'A7' else [(13, 1, 'C#5'), (14, 2, 'E5')], ['muted'], [86])
    if second:
        t = CH[ch]
        for j, st in enumerate((0, 2, 4, 6, 8, 10, 12, 14)):
            song.add('vibes', pos(b, st), 0.4, n([t[0], t[2], t[3], t[2]][j % 4], 5), 60)
    song.add('timp', song.bar(b), 0.5, low(CH[ch][0], 2), 88)
fill(15); fill(23, True)

# Bridge B 24–31
CH_B = ['Gmaj7', 'A7', 'Bm7', 'A7', 'Gmaj7', 'A7', 'Bm7', 'Dmaj7']
MEL_B = [B_G, B_A, B_BM, B_A2, B_G, B_A, B_BM, B_D]
crash(24, 112)
for i, ch in enumerate(CH_B):
    b = 24 + i
    bass(b, ch, BASS_B, 1.03)
    groove(b, 'A', 1.06)
    chops(b, ch, 0.95)
    organ(b, ch, 52 + i * 2)
    line(b, MEL_B[i], ['sax'] + (['muted'] if i >= 4 else []), [98, 82])
    stabs(b, ch, (0, 10) if i < 4 else (0, 6, 10), 84 + i * 2)
    if i >= 4: rhodes(b, ch, 0.9)
fill(27); fill(31, True); roll(31, 2, 4, 60, 110)

# Refrain C 32–47: Em7 Gmaj7 A7 Bm7 | Em7 Gmaj7 A7 Dmaj7 (dann A7 am Ende des zweiten Durchgangs)
CH_C1 = ['Em7', 'Gmaj7', 'A7', 'Bm7', 'Em7', 'Gmaj7', 'A7', 'Dmaj7']
CH_C2 = ['Em7', 'Gmaj7', 'A7', 'Bm7', 'Em7', 'Gmaj7', 'A7', 'A7']
MEL_C1 = [C_EM, C_G, C_A, C_BM, C_EM, C_G, C_A, B_D]
MEL_C2 = [C_EM, C_G, C_A, C_BM, C_EM, C_G, C_A, C_A_END]
crash(32, 118); crash(40, 116)
for i in range(16):
    b, k, second = 32 + i, i % 8, i >= 8
    ch = (CH_C2 if second else CH_C1)[k]
    bass(b, ch, BASS_B, 1.05)
    groove(b, 'C', 1.04)
    chops(b, ch, 0.9)
    power(b, ch, 84 + (4 if second else 0))
    line(b, (MEL_C2 if second else MEL_C1)[k], ['sax', 'muted'] + (['brass'] if second else []), [100, 88, 78])
    stabs(b, ch, (0, 6, 10) if not second else (0, 3, 6, 10, 14), 88)
    organ(b, ch, 58)
    song.add('timp', song.bar(b), 0.5, low(CH[ch][0], 2), 94)
    if k % 4 == 0 and b not in (32, 40): crash(b, 100)
fill(35); fill(39, True); fill(43); fill(47, True)

# Break 48–51: Bass + Schlagzeug + Clap, Vibes-Arpeggios
CH_K = ['Em7', 'Em7', 'A7', 'A7']
for i, ch in enumerate(CH_K):
    b = 48 + i
    bass(b, ch, BASS_B, 1.08)
    groove(b, 'lite', 1.0)
    for st in (4, 12): song.dr(pos(b, st), CLAP, 96)
    for st in (0, 4, 8, 12): song.dr(pos(b, st), COWBELL, 80)
    t = CH[ch]
    for j, st in enumerate(range(0, 16, 2)): song.add('vibes', pos(b, st), 0.4, n([t[0], t[1], t[2], t[3]][j % 4], 5), 74 + (j % 2) * 8)
    if i >= 2: chops(b, ch, 0.85)
    if i >= 1: rhodes(b, ch, 0.8)
crash(48, 100); fill(51); horn_call(50, 92)

# Rückführung 52–55: Em7 Em7 A7 Bm7
CH_R = ['Em7', 'Em7', 'A7', 'A7']
for i, ch in enumerate(CH_R):
    b = 52 + i
    bass(b, ch, BASS_B, 1.05)
    groove(b, 'A', 1.0 + i * 0.02)
    chops(b, ch, 0.95)
    rhodes(b, ch, 0.95)
    organ(b, ch, 56 + i * 4)
    stabs(b, ch, (0, 6, 10), 84 + i * 4)
    song.add('timp', song.bar(b), 0.5, low(CH[ch][0], 2), 90)
crash(52, 108)
line(54, [(0, 1, 'C#5'), (2, 1, 'E5'), (4, 2, 'A5'), (8, 2, 'G5'), (10, 2, 'E5'), (12, 4, 'C#5')], ['sax'], [96])
line(55, [(0, 1, 'E5'), (1, 1, 'G5'), (2, 1, 'A5'), (3, 1, 'B5'), (4, 4, 'B5')], ['sax', 'muted'], [100, 84])
roll(55, 2, 4, 60, 118); fill(55, True)

sf2, out = cli_paths('bgm_theme_cool.ogg')
song.render(sf2, out)
