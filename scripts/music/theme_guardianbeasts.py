# -*- coding: utf-8 -*-
"""Theme-Battle-Track „Temple Guardians' Oath“ → public/music/bgm_theme_guardianbeasts.ogg

Archetyp Guardian Beasts (Tempelwächter, zwölf Tierzeichen, Eid/Wächter-Motiv).
D-Dur-Pentatonik (D E F# A H, Moll-Färbung über h), 118 BPM, 56 Takte (≈ 113,9 s), nahtlos loopbar.
Taiko/Toms und Sidestick tragen den Puls, Koto und Harfe (Dan Tranh) zupfen Arpeggien, Dizi (Flöte),
Erhu (Geige) und Suona (Oboe) singen das Eid-Motiv, tiefe Glocke = Tempelgong, Dudelsack sparsam als Sheng-Bordun.
Harmonik: offene Quinten (D – h – A – E), keine Terzen außerhalb der Pentatonik.

Aufbau (Takte, 0-basiert):
   0– 3  Intro        Gong, Taiko-Puls, Harfe, Dizi-Ruf
   4–11  Eid A        Koto-Hauptmotiv, Harfe, Streicher ab Takt 8
  12–19  Eid A'       Dizi + Koto, Bordun, Toms
  20–27  Steigerung B schnelle Aufwärtsfiguren, Erhu + Dizi, volles Taiko
  28–43  Höhepunkt C  Hymne (Dizi/Erhu/Koto), zweiter Durchgang mit Suona + Dudelsack, Glocken
  44–51  Wächter-Eid D Koto solo über Taiko-Herzschlag, Bordun, Erhu ab Takt 48
  52–55  Rückführung  Tom-Wirbel, Dizi-Ruf → Sprung auf Takt 0
Aufruf:  python3 scripts/music/theme_guardianbeasts.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 118, 56                          # 56 × 4 × 60/118 = 113,9 s
song = Song(bpm=BPM, bars=BARS)
song.inst('bass',   'bass2',   96, 62)
song.inst('koto',   'koto',    98, 40)
song.inst('harp',   'harp',    80, 84)
song.inst('flute',  'flute',   90, 74)
song.inst('erhu',   'violin',  88, 56)
song.inst('suona',  'oboe',    84, 50)
song.inst('pipe',   'bagpipe', 60, 66)
song.inst('strings','strings', 72, 30)
song.inst('gong',   'bell',    90, 64)
song.inst('timp',   'timp',    92, 64)
song.inst('choir',  'oohs',    66, 64)

PENT = {D, E, Gb, A, B}
NAMES = {'C': C, 'D': D, 'E': E, 'F#': Gb, 'G': G, 'A': A, 'B': B}
def nt(s):
    p = n(NAMES[s[:-1]], int(s[-1]))
    return p
def chk(p): assert p % 12 in PENT, p; return p

ROOT = {'D': 38, 'Bm': 35, 'A': 33, 'E': 40}                       # Bass Oktave 1–2
PAD = {'D': [50, 57, 62, 66], 'Bm': [47, 54, 59, 62], 'A': [45, 52, 57, 59], 'E': [52, 59, 64, 57]}
ARP = {'D': [62, 66, 69, 74], 'Bm': [59, 62, 66, 71], 'A': [57, 64, 69, 71], 'E': [64, 69, 71, 76]}
for d in (PAD, ARP):
    for v in d.values(): [chk(x) for x in v]

def line(b, notes, insts, vels, shift=0):
    for off, dur, p in notes:
        for inst, v in zip(insts, vels): song.add(inst, song.bar(b) + off, dur * 0.94, chk(nt(p) + shift), v)

def bass(b, ch, v=96, busy=False):
    s, r = song.bar(b), ROOT[ch]
    song.add('bass', s, 1.4, r, v + 8); song.add('bass', s + 1.5, 0.45, r + 12, v - 8)
    song.add('bass', s + 2, 1.4, r, v); song.add('bass', s + 3.5, 0.45, r + 7, v - 10)
    if busy: song.add('bass', s + 1, 0.4, r, v - 14); song.add('bass', s + 3, 0.4, r + 12, v - 10)

def arp(b, ch, inst='harp', v=70, step=0.5):
    a, s = ARP[ch], song.bar(b)
    pat = [0, 1, 2, 3, 2, 1, 2, 1] if step == 0.5 else [0, 1, 2, 3, 2, 1, 3, 2, 0, 1, 2, 3, 2, 1, 3, 2]
    for i, k in enumerate(pat): song.add(inst, s + i * step, step * 0.9, a[k], v + (8 if i % 4 == 0 else 0))

def pad(b, ch, inst='strings', v=64):
    for p in PAD[ch][:3]: song.add(inst, song.bar(b), 3.98, p + 12 if inst == 'choir' else p, v)

def drone(b, ch, v=52):
    song.add('pipe', song.bar(b), 3.98, PAD[ch][0] + 0, v); song.add('pipe', song.bar(b), 3.98, PAD[ch][1], v - 4)

def gong(b, v=100): song.add('gong', song.bar(b), 3.9, n(D, 2), v); song.dr(song.bar(b), CRASH, v + 10, 0.5)

def groove(b, kind, v=1.0):
    s = song.bar(b)
    def d(o, note, vel): song.dr(s + o, note, vel * v)
    if kind == 1:
        d(0, KICK, 108); d(2, KICK, 98); d(1.5, TOM_L, 96); d(3.5, TOM_L, 100)
        d(1, SIDESTICK, 96); d(3, SIDESTICK, 100)
    elif kind == 2:
        d(0, KICK, 110); d(2, KICK, 100); d(1, TOM_M, 102); d(1.75, TOM_L, 90); d(3, SNARE, 100); d(3.5, TOM_L, 98)
        for o in (0.5, 1.5, 2.5): d(o, SIDESTICK, 82)
    elif kind == 3:
        for o, vv in ((0, 116), (1.5, 100), (2, 108), (3.5, 104)): d(o, KICK, vv)
        d(1, SNARE, 110); d(3, SNARE, 114); d(3, CLAP, 84); d(0.75, TOM_M, 90); d(2.75, TOM_L, 94)
        for i in range(8): d(i * 0.5, COWBELL, 78 if i % 2 == 0 else 60)
    elif kind == 'heart':
        d(0, KICK, 108); d(0.5, TOM_L, 88); d(2, KICK, 100); d(2.5, TOM_L, 84); d(1, SIDESTICK, 86); d(3, SIDESTICK, 90)
    # Taiko-Verstärkung durch Pauke auf dem Grundton
def taiko_timp(b, ch, v=90):
    song.add('timp', song.bar(b), 0.5, ROOT[ch] + 12 if ROOT[ch] < 36 else ROOT[ch], v); song.add('timp', song.bar(b) + 2, 0.5, ROOT[ch] + 12 if ROOT[ch] < 36 else ROOT[ch], v - 6)

def fill(b, big=False):
    s = song.bar(b); toms = [TOM_H, TOM_HH, TOM_M, TOM_L]
    if big:
        for i in range(8): song.dr(s + 1.5 + i * 0.25, SNARE, 70 + i * 6, 0.12)
    for i in range(8): song.dr(s + 2.0 + i * 0.25, toms[min(3, i // 2)], 88 + i * 4, 0.2)
    song.dr(s + 3.75, KICK, 118)

def roll(b, a, z, v0, v1):
    s = song.bar(b) + a
    cnt = int((z - a) * 4)
    for i in range(cnt): song.dr(s + i * 0.25, TOM_M if i % 2 else TOM_L, v0 + (v1 - v0) * i / max(1, cnt - 1), 0.15)

# ---- Melodien --------------------------------------------------------------------------
CH_A = ['D', 'D', 'Bm', 'Bm', 'A', 'A', 'E', 'E']
MEL_A = [
    [(0, 1, 'D5'), (1, .5, 'D5'), (1.5, .5, 'E5'), (2, 1.5, 'F#5'), (3.5, .5, 'E5')],
    [(0, 2, 'D5'), (2, 1, 'B4'), (3, 1, 'A4')],
    [(0, 1, 'B4'), (1, .5, 'B4'), (1.5, .5, 'D5'), (2, 1.5, 'E5'), (3.5, .5, 'D5')],
    [(0, 2, 'B4'), (2, 2, 'F#4')],
    [(0, 1, 'A4'), (1, .5, 'A4'), (1.5, .5, 'B4'), (2, 1.5, 'D5'), (3.5, .5, 'B4')],
    [(0, 2, 'A4'), (2, 1, 'E5'), (3, 1, 'D5')],
    [(0, 1, 'B4'), (1, 1, 'A4'), (2, 1, 'B4'), (3, 1, 'E5')],
    [(0, 3, 'E5'), (3, 1, 'A4')],
]
CH_B = ['Bm', 'A', 'E', 'D', 'Bm', 'A', 'E', 'E']
MEL_B = [
    [(0, .5, 'B4'), (.5, .5, 'D5'), (1, 1, 'F#5'), (2, 1, 'D5'), (3, 1, 'B4')],
    [(0, .5, 'A4'), (.5, .5, 'B4'), (1, 1, 'E5'), (2, 1, 'B4'), (3, 1, 'A4')],
    [(0, .5, 'B4'), (.5, .5, 'E5'), (1, 1, 'A5'), (2, 1, 'E5'), (3, 1, 'B4')],
    [(0, .5, 'A4'), (.5, .5, 'D5'), (1, 1, 'F#5'), (2, 1, 'A5'), (3, 1, 'F#5')],
    [(0, .5, 'D5'), (.5, .5, 'F#5'), (1, 1, 'B5'), (2, 1, 'F#5'), (3, 1, 'D5')],
    [(0, .5, 'E5'), (.5, .5, 'A5'), (1, 1, 'B5'), (2, 1, 'A5'), (3, 1, 'E5')],
    [(0, .5, 'B5'), (.5, .5, 'A5'), (1, .5, 'E5'), (1.5, .5, 'B4'), (2, 2, 'E5')],
    [(0, 1, 'E5'), (1, 1, 'B4'), (2, 2, 'A4')],
]
CH_C = ['D', 'D', 'A', 'A', 'Bm', 'Bm', 'E', 'E']
MEL_C = [
    [(0, 1.5, 'A4'), (1.5, .5, 'D5'), (2, 1, 'F#5'), (3, 1, 'A5')],
    [(0, 2, 'B5'), (2, 1, 'A5'), (3, 1, 'F#5')],
    [(0, 1.5, 'E5'), (1.5, .5, 'A5'), (2, 1, 'B5'), (3, 1, 'A5')],
    [(0, 2, 'F#5'), (2, 2, 'E5')],
    [(0, 1, 'D5'), (1, .5, 'F#5'), (1.5, .5, 'B5'), (2, 1.5, 'A5'), (3.5, .5, 'F#5')],
    [(0, 2, 'D5'), (2, 2, 'B4')],
    [(0, 1, 'E5'), (1, 1, 'A5'), (2, 1, 'B5'), (3, 1, 'A5')],
    [(0, 1, 'E5'), (1, 1, 'F#5'), (2, 1, 'E5'), (3, 1, 'A4')],
]

# ==== Arrangement ========================================================================
# Intro 0–3
for i, ch in enumerate(['D', 'D', 'A', 'E']):
    b = i
    bass(b, ch, 86 + i * 3); arp(b, ch, 'harp', 66 + i * 4); groove(b, 1, 0.92 + i * 0.03); taiko_timp(b, ch, 80 + i * 4)
    pad(b, ch, 'strings', 52 + i * 6)
gong(0, 108)
line(2, [(0, 3, 'A4'), (3, 1, 'B4')], ['flute'], [88]); line(3, [(0, 2, 'D5'), (2, 2, 'E5')], ['flute'], [92])
roll(3, 2, 4, 70, 106)

# Eid A 4–11 und A' 12–19
for i in range(16):
    b, k = 4 + i, i % 8; ch = CH_A[k]; second = i >= 8
    bass(b, ch, 96 + (2 if second else 0), busy=second)
    arp(b, ch, 'harp', 68 + (6 if second else 0))
    groove(b, 2, 1.0 + (0.06 if second else 0)); taiko_timp(b, ch, 90)
    line(b, MEL_A[k], ['koto'] + (['flute'] if second else []), [100, 88] if second else [100])
    if i >= 4: pad(b, ch, 'strings', 60 + (8 if second else 0))
    if second and i >= 12: drone(b, ch, 50)
    if second: pad(b, ch, 'choir', 42 + (k // 4) * 8) if k >= 4 else None
gong(4, 100); gong(12, 100); fill(11); fill(19, big=True)

# Steigerung B 20–27
for i in range(8):
    b = 20 + i; ch = CH_B[i]
    bass(b, ch, 100, busy=True); arp(b, ch, 'harp', 78, step=0.25 if i >= 4 else 0.5)
    groove(b, 3, 1.0 + i * 0.01); taiko_timp(b, ch, 96)
    line(b, MEL_B[i], ['erhu', 'flute', 'koto'], [92, 88, 82])
    pad(b, ch, 'strings', 74); pad(b, ch, 'choir', 60 + i * 3)
gong(20, 108); fill(23); roll(26, 0, 4, 70, 100); roll(27, 0, 3, 100, 126); fill(27, big=True)

# Höhepunkt C 28–43
for i in range(16):
    b, k = 28 + i, i % 8; ch = CH_C[k]; second = i >= 8
    bass(b, ch, 104, busy=True); arp(b, ch, 'koto', 66, step=0.25 if second else 0.5); arp(b, ch, 'harp', 72)
    groove(b, 3, 1.06); taiko_timp(b, ch, 104)
    line(b, MEL_C[k], ['flute', 'erhu', 'koto'] + (['suona'] if second else []), [102, 92, 84, 86])
    if second: line(b, MEL_C[k], ['pipe'], [50], shift=-12)
    pad(b, ch, 'strings', 78); pad(b, ch, 'choir', 76)
    if k % 4 == 0: gong(b, 112)
fill(31); fill(35); fill(39)
roll(42, 0, 4, 76, 106); roll(43, 0, 3, 104, 126); fill(43, big=True)

# Wächter-Eid D 44–51
for i in range(8):
    b = 44 + i; ch = CH_A[i]
    bass(b, ch, 92); arp(b, ch, 'harp', 62)
    groove(b, 'heart', 1.0 + (0.04 if i >= 4 else 0)); taiko_timp(b, ch, 92)
    line(b, MEL_A[i], ['koto'] + (['erhu'] if i >= 4 else []), [100, 88])
    pad(b, ch, 'strings', 62 + i * 3); drone(b, ch, 56)
    if i >= 4: pad(b, ch, 'choir', 56 + (i - 4) * 5)
gong(44, 96); gong(48, 104); fill(51)

# Rückführung 52–55: A A E E, Tom-Wirbel, Ruf
for i, ch in enumerate(['A', 'A', 'E', 'E']):
    b = 52 + i
    bass(b, ch, 98 + i * 3, busy=True); arp(b, ch, 'harp', 74 + i * 3, step=0.25)
    if i < 2: groove(b, 3, 1.0)
    else: roll(b, 0, 4, 76 + (i - 2) * 16, 104 + (i - 2) * 16)
    taiko_timp(b, ch, 98 + i * 3); pad(b, ch, 'strings', 70 + i * 4); pad(b, ch, 'choir', 60 + i * 6); drone(b, ch, 56)
line(54, [(0, .5, 'A4'), (.5, .5, 'B4'), (1, 1, 'E5'), (2, 1, 'B4'), (3, 1, 'A4')], ['flute', 'erhu'], [96, 84])
line(55, [(0, .5, 'B4'), (.5, .5, 'E5'), (1, .5, 'A5'), (1.5, .5, 'E5'), (2, 2, 'A4')], ['flute', 'erhu', 'koto'], [102, 90, 90])
fill(53); fill(55, big=True)

sf2, out = cli_paths('bgm_theme_guardianbeasts.ogg')
song.render(sf2, out)
