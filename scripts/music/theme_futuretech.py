# -*- coding: utf-8 -*-
"""Theme „Future Tech“ – „Prototype Protocol“ → public/music/bgm_theme_futuretech.ogg

Cyberpunk-/Industrial-Labor-Kampfstück in fis-Moll, 148 BPM, 76 Takte (123,2 s), nahtlos loopbar.
Kalte Synths, ein starrer 16tel-Sequenzer-Bass (Acid-Bass), Arpeggiator-Maschinen mit
Delay-Echo im Stereobild, Kuhglocken-Metronom, Four-on-the-floor-Kick und ein Alarm-Signal
(Tritonus-Sirene) als Warnton des Prototyps. Das Hauptmotiv (fis-fis-a-cis, „Initialisierung“)
wird vom Square-Lead gespielt, die Kristall-Glocke antwortet synkopiert im 3+3+2-Raster.

Aufbau (Takte, 0-basiert):
   0– 7  Intro          Kick, Sequenzer-Bass, Kuhglocke, Alarm-Sirene, ab Takt 4 Arpeggiator + Clap
   8–23  Thema A        Square-Lead mit Hauptmotiv (2 × 8 Takte), Kristall-Antworten, Synth-Pad
  24–39  Steigerung B   Wurzeln steigen (fis-a-h-cis), Lead auf Charang, Arpeggio mit Echo, Snare-Ghosts
  40–55  Höhepunkt C    Hymne: Saw + Square in Oktaven, Synth-Brass-Stabs, volle Drums
  56–67  Break D        Kick + 16tel-Kuhglocke, Kristall-Melodie, Sweep-Riser („System-Neustart“)
  68–75  Rückführung E  Snare-Wirbel, Dominante cis, Alarm → Sprung auf Takt 0
Harmonie: fis-Moll (fis-D-E, Bm, cis-Moll), Loop endet auf Dominante (kein Schluss).
Aufruf:  python3 scripts/music/theme_futuretech.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 148, 76                       # 76 × 4 × 60/148 = 123,2 s
song = Song(bpm=BPM, bars=BARS)
song.inst('acid',  'acidbass', 100, 62)   # Sequenzer-Bass
song.inst('sub',   'sine',      92, 64)   # Sub
song.inst('arp1',  'saw',       70, 36)   # Arpeggiator links
song.inst('arp2',  'square',    56, 94)   # Echo rechts
song.inst('pad',   'synstr2',   70, 64)
song.inst('lead',  'square',    88, 66)
song.inst('lead2', 'charang',   82, 60)
song.inst('sawl',  'saw',       74, 72)
song.inst('bell',  'crystal',   80, 90)
song.inst('brass', 'sbrass',    84, 50)
song.inst('alarm', 'square',    70, 64)
song.inst('sweep', 'sweep',     76, 64)
song.inst('hit',   'hit',       90, 64)

NAMES = {'C': C, 'Db': Db, 'D': D, 'Eb': Eb, 'E': E, 'F': F, 'Gb': Gb, 'G': G, 'Ab': Ab, 'A': A, 'Bb': Bb, 'B': B,
         'C#': Db, 'D#': Eb, 'F#': Gb, 'G#': Ab, 'A#': Bb}
def nt(s): return n(NAMES[s[:-1]], int(s[-1]))
SCALE = {6, 8, 9, 11, 1, 2, 4}            # fis-Moll natürlich
CH = {'F#m': (6, 3), 'D': (2, 4), 'E': (4, 4), 'A': (9, 4), 'C#m': (1, 3), 'Bm': (11, 3), 'C#': (1, 4)}
def ramp(i, cnt, a, b): return a + (b - a) * i / max(1, cnt - 1)
def rt(ch, o): return n(CH[ch][0], o)

# ---- Bausteine ---------------------------------------------------------------------------
BASS_PAT = [(0, 0), (2, 0), (3, 12), (4, 0), (6, 0), (7, 7), (8, 0), (10, 0), (11, 12), (12, 0), (14, 7), (15, 12)]
def seq_bass(b, ch, vel=98):
    s = song.bar(b); r = rt(ch, 1) + 12 if CH[ch][0] < 6 else rt(ch, 1)   # Oktave 1–2
    for st, off in BASS_PAT: song.add('acid', s + st * 0.25, 0.22, r + off, vel + (8 if st % 4 == 0 else -4))
def sub(b, ch, vel=88):
    song.add('sub', song.bar(b), 3.9, rt(ch, 1) + (12 if CH[ch][0] < 6 else 0), vel)
def arp(b, ch, vel=72, echo=False):
    s = song.bar(b); r = rt(ch, 3) + (12 if CH[ch][0] < 6 else 0) + 0; t = CH[ch][1]
    tones = [r, r + t, r + 7, r + 12, r + 12 + t]
    order = [0, 1, 2, 3, 4, 3, 2, 1]
    for i in range(16):
        p = tones[order[i % 8]]; v = vel + (10 if i % 4 == 0 else 0)
        song.add('arp1', s + i * 0.25, 0.2, p, v)
        if echo: song.add('arp2', s + i * 0.25 + 0.75, 0.2, p + 12, int(v * 0.6))
def pad(b, ch, vel=66):
    r = rt(ch, 3) + (12 if CH[ch][0] < 6 else 0); t = CH[ch][1]
    for p in (r, r + t, r + 7): song.add('pad', song.bar(b), 3.95, p, vel)
def pings(b, ch, vel=78):
    r = rt(ch, 5) + (0 if CH[ch][0] < 6 else -12); t = CH[ch][1]
    tones = [r + 7, r + 12, r + t + 12, r + 7, r + 12 + t, r + 19]
    for k, st in enumerate((0, 3, 6, 8, 11, 14)): song.add('bell', song.bar(b) + st * 0.25, 0.4, tones[k], vel - (6 if k % 2 else 0))
def brass_stab(b, ch, vel=90):
    r = rt(ch, 3) + (12 if CH[ch][0] < 6 else 0); t = CH[ch][1]
    for off in (0, 0.75, 1.5, 2.75):
        for p in (r + 7, r + 12, r + 12 + t): song.add('brass', song.bar(b) + off, 0.5, p, vel + (8 if off == 0 else 0))
def line(b, notes, insts, vels, shift=0):
    for off, dur, p in notes:
        assert nt(p) % 12 in SCALE, p
        for inst, v in zip(insts, vels): song.add(inst, song.bar(b) + off, dur * 0.94, nt(p) + shift, v)
def alarm(b, vel=84, bars=1):
    s = song.bar(b)
    for i in range(8 * bars): song.add('alarm', s + i * 0.5, 0.42, nt('F#6') if i % 2 == 0 else nt('C6'), vel)
def hit(b, beat, ch, vel=110, dur=0.9):
    r = rt(ch, 3) + (12 if CH[ch][0] < 6 else 0)
    for p in (r - 12, r, r + 7, r + 12): song.add('hit', song.bar(b) + beat, dur, p, vel)

# ---- Schlagzeug -----------------------------------------------------------------------------
def groove(b, kind, v=1.0):
    s = song.bar(b)
    def d(off, note, vel): song.dr(s + off, note, min(127, vel * v))
    for i in range(4): d(i, KICK, 116 if i == 0 else 106)                     # Four-on-the-floor
    if kind in ('i', 'A', 'B', 'C'):
        for i in range(4): d(i + 0.5, COWBELL, 84 if kind != 'C' else 92)     # Kuhglocke auf den Off-Beats
        for i in range(16): d(i * 0.25, HAT, 106 if i % 4 == 2 else 84)
    if kind == 'D':
        for i in range(16): d(i * 0.25, COWBELL, 78 if i % 4 == 0 else 62)
    if kind in ('A', 'B', 'C'): d(1, CLAP, 100); d(3, CLAP, 104)
    if kind == 'i2': d(1, CLAP, 92); d(3, CLAP, 96)
    if kind in ('B', 'C'):
        d(1, SNARE, 90); d(3, SNARE, 96); d(3.75, SNARE, 70); d(2.75, SNARE, 64)
    if kind == 'C': d(1.75, KICK, 84); d(3.5, TOM_M, 92)

def fill(b, vmax=118):
    s = song.bar(b)
    for i in range(8): song.dr(s + 2.0 + i * 0.25, [TOM_H, TOM_HH, TOM_M, TOM_L][min(3, i // 2)], ramp(i, 8, 84, vmax), 0.2)
    song.dr(s + 3.75, SNARE, vmax)
def snare_roll(b, start, end, v0, v1):
    s = song.bar(b) + start; cnt = int((end - start) * 4)
    for i in range(cnt): song.dr(s + i * 0.25, SNARE, ramp(i, cnt, v0, v1), 0.15)
def crash(b, vel=110): song.dr(song.bar(b), CRASH, vel, 0.5)

# ---- Melodien ---------------------------------------------------------------------------------
M1 = [(0, .75, 'F#5'), (.75, .75, 'F#5'), (1.5, .5, 'A5'), (2, 1, 'C#6'), (3, .5, 'B5'), (3.5, .5, 'A5')]
CH_A = ['F#m', 'F#m', 'D', 'E', 'F#m', 'F#m', 'Bm', 'C#m']
MEL_A = [
    M1,
    [(0, .75, 'F#5'), (.75, .75, 'F#5'), (1.5, .5, 'A5'), (2, 1.5, 'C#6'), (3.5, .5, 'E6')],
    [(0, 1, 'D6'), (1, .5, 'C#6'), (1.5, .5, 'B5'), (2, 1, 'A5'), (3, 1, 'F#5')],
    [(0, 1, 'B5'), (1, .5, 'G#5'), (1.5, .5, 'B5'), (2, 2, 'E6')],
    M1,
    [(0, .75, 'F#5'), (.75, .75, 'F#5'), (1.5, .5, 'A5'), (2, 1, 'C#6'), (3, 1, 'F#6')],
    [(0, 1, 'D6'), (1, 1, 'B5'), (2, .5, 'D6'), (2.5, .5, 'C#6'), (3, 1, 'B5')],
    [(0, 1, 'G#5'), (1, .5, 'A5'), (1.5, .5, 'B5'), (2, 1, 'C#6'), (3, 1, 'E6')],
]
# Steigerung B: Wurzeln fis a h cis, Motiv als Sequenz
CH_B = ['F#m', 'A', 'Bm', 'C#m', 'F#m', 'D', 'Bm', 'C#m']
def mot(a, b_, c, d_, e=None):
    return [(0, .75, a), (.75, .75, a), (1.5, .5, b_), (2, 1, c), (3, 1, d_)]
MEL_B = [mot('F#5', 'A5', 'C#6', 'B5'), mot('A5', 'C#6', 'E6', 'D6'), mot('B5', 'D6', 'F#6', 'E6'),
         mot('C#6', 'E6', 'G#6', 'F#6'),
         mot('F#5', 'A5', 'C#6', 'B5'), [(0, 1, 'D6'), (1, 1, 'C#6'), (2, 1, 'A5'), (3, 1, 'F#5')],
         [(0, 1, 'B5'), (1, 1, 'D6'), (2, 1, 'F#6'), (3, 1, 'D6')], [(0, 1, 'E6'), (1, .5, 'D6'), (1.5, .5, 'C#6'), (2, 1, 'B5'), (3, 1, 'G#5')]]
# Höhepunkt C: Hymne
CH_C1 = ['F#m', 'D', 'A', 'E', 'F#m', 'D', 'Bm', 'C#m']
MEL_C1 = [
    [(0, 1, 'F#5'), (1, 1, 'A5'), (2, 1.5, 'C#6'), (3.5, .5, 'B5')],
    [(0, 1, 'A5'), (1, 1, 'D6'), (2, 1.5, 'F#6'), (3.5, .5, 'E6')],
    [(0, 1, 'C#6'), (1, 1, 'E6'), (2, 1.5, 'A6'), (3.5, .5, 'G#6')],
    [(0, 1, 'B5'), (1, 1, 'E6'), (2, 2, 'G#6')],
    [(0, 1.5, 'F#6'), (1.5, .5, 'E6'), (2, 1, 'C#6'), (3, 1, 'A5')],
    [(0, 1.5, 'D6'), (1.5, .5, 'C#6'), (2, 1, 'A5'), (3, 1, 'F#5')],
    [(0, 1, 'B5'), (1, 1, 'D6'), (2, 1, 'F#6'), (3, 1, 'D6')],
    [(0, 1.5, 'C#6'), (1.5, .5, 'B5'), (2, 1, 'G#5'), (3, 1, 'C#6')],
]
CH_C2 = ['F#m', 'A', 'D', 'E', 'F#m', 'Bm', 'E', 'C#m']
MEL_C2 = [
    M1, [(0, 1, 'E6'), (1, 1, 'C#6'), (2, 2, 'A5')],
    [(0, 1, 'D6'), (1, 1, 'F#6'), (2, 1.5, 'A6'), (3.5, .5, 'F#6')],
    [(0, 1, 'G#6'), (1, 1, 'E6'), (2, 2, 'B5')],
    [(0, .75, 'F#5'), (.75, .75, 'F#5'), (1.5, .5, 'A5'), (2, 1, 'C#6'), (3, 1, 'F#6')],
    [(0, 1, 'D6'), (1, 1, 'F#6'), (2, 1, 'D6'), (3, 1, 'B5')],
    [(0, 1, 'E6'), (1, 1, 'G#6'), (2, 1, 'B6'), (3, 1, 'G#6')],
    [(0, 3, 'C#6'), (3, 1, 'G#5')],
]
CH_D = ['F#m', 'F#m', 'D', 'D', 'Bm', 'Bm', 'C#m', 'C#m', 'F#m', 'D', 'E', 'E']
MEL_D = [
    [(0, 2, 'C#6'), (2, 1, 'A5'), (3, 1, 'F#5')], [(0, 2, 'A5'), (2, 2, 'B5')],
    [(0, 2, 'D6'), (2, 1, 'B5'), (3, 1, 'A5')], [(0, 2, 'F#5'), (2, 2, 'A5')],
    [(0, 2, 'B5'), (2, 1, 'D6'), (3, 1, 'F#6')], [(0, 2, 'E6'), (2, 2, 'D6')],
    [(0, 2, 'G#5'), (2, 1, 'B5'), (3, 1, 'C#6')], [(0, 2, 'E6'), (2, 2, 'G#6')],
    [(0, 1, 'F#5'), (1, 1, 'A5'), (2, 1, 'C#6'), (3, 1, 'F#6')], [(0, 1, 'D6'), (1, 1, 'A5'), (2, 2, 'F#5')],
    [(0, 1, 'E6'), (1, 1, 'B5'), (2, 1, 'G#5'), (3, 1, 'B5')], [(0, 1, 'E6'), (1, 1, 'D6'), (2, 1, 'B5'), (3, 1, 'G#5')],
]

# ==== Arrangement ==============================================================================
# ---- Intro (0–7): fis-Moll-Vamp, dann D und E --------------------------------------------------------
CH_I = ['F#m', 'F#m', 'F#m', 'F#m', 'D', 'D', 'E', 'E']
hit(0, 0, 'F#m', 112, 1.0); crash(0, 108)
for i, ch in enumerate(CH_I):
    b = i
    seq_bass(b, ch, 92 + i * 2); sub(b, ch, 80)
    groove(b, 'i' if i < 4 else 'i2', 0.95 + i * 0.01)
    if i < 4 and i % 2 == 0: alarm(b, 78 + i * 4)      # Alarm-Sirene in Takt 0 und 2
    if i >= 2: arp(b, ch, 62 + i * 3)
    if i >= 4: pad(b, ch, 52 + (i - 4) * 6); pings(b, ch, 66 + (i - 4) * 4)
line(6, [(0, .75, 'F#5'), (.75, .75, 'F#5'), (1.5, .5, 'A5'), (2, 2, 'C#6')], ['lead'], [92])
line(7, [(0, .75, 'E6'), (.75, .75, 'E6'), (1.5, .5, 'C#6'), (2, 2, 'B5')], ['lead'], [96])
alarm(3, 90); fill(3, 108); snare_roll(7, 2, 4, 60, 108); fill(7)

# ---- Thema A (8–23) ----------------------------------------------------------------------------
hit(8, 0, 'F#m', 108, 0.8); crash(8, 112)
for i in range(16):
    b, k = 8 + i, i % 8; second = i >= 8; ch = CH_A[k]
    seq_bass(b, ch, 98 + (4 if second else 0)); sub(b, ch, 86)
    groove(b, 'A', 1.0 + (0.05 if second else 0))
    arp(b, ch, 66 + (8 if second else 0), echo=second)
    pad(b, ch, 60 + (8 if second else 0))
    line(b, MEL_A[k], ['lead'] + (['sawl'] if second else []), [92, 66] if second else [92])
    if k in (2, 3, 6, 7) or second: pings(b, ch, 70)
fill(15); fill(23, 120); snare_roll(22, 2, 4, 60, 100); snare_roll(23, 0, 2, 80, 118)
alarm(23, 70)

# ---- Steigerung B (24–39) ------------------------------------------------------------------------
hit(24, 0, 'F#m', 114, 0.9); crash(24, 114); crash(32, 116)
for i in range(16):
    b, k = 24 + i, i % 8; second = i >= 8; ch = CH_B[k]
    seq_bass(b, ch, 102 + (4 if second else 0)); sub(b, ch, 90)
    groove(b, 'B', 1.0 + (0.05 if second else 0))
    arp(b, ch, 74 + (6 if second else 0), echo=True)
    pad(b, ch, 68)
    line(b, MEL_B[k], ['lead2'] + (['lead'] if second else []), [90, 84] if second else [90])
    pings(b, ch, 74)
    if second: brass_stab(b, ch, 74)
fill(31); fill(35); snare_roll(38, 0, 4, 60, 104); snare_roll(39, 0, 3, 90, 127); fill(39, 124)
hit(32, 0, 'F#m', 116, 0.9)

# ---- Höhepunkt C (40–55) ----------------------------------------------------------------------
hit(40, 0, 'F#m', 122, 1.2); crash(40, 120); hit(48, 0, 'F#m', 118, 0.9); crash(48, 118)
for i in range(16):
    b, k = 40 + i, i % 8; first = i < 8
    ch = (CH_C1 if first else CH_C2)[k]; mel = (MEL_C1 if first else MEL_C2)[k]
    seq_bass(b, ch, 108); sub(b, ch, 94)
    groove(b, 'C', 1.0 + (0 if first else 0.05))
    arp(b, ch, 78, echo=True); pad(b, ch, 72)
    line(b, mel, ['sawl', 'lead'], [96, 84])
    brass_stab(b, ch, 86); pings(b, ch, 72)
    if k % 4 == 0 and b not in (40, 48): crash(b, 100)
fill(43); fill(47); fill(51); snare_roll(54, 0, 4, 70, 110); snare_roll(55, 0, 3, 100, 127); fill(55, 126)

# ---- Break D (56–67): Neustart ---------------------------------------------------------------------
crash(56, 100)
for i in range(12):
    b = 56 + i; ch = CH_D[i]
    seq_bass(b, ch, 92 + i)
    sub(b, ch, 86)
    groove(b, 'D', 1.0)
    arp(b, ch, 62 + i * 2, echo=(i >= 4))
    pad(b, ch, 56 + i * 2)
    line(b, MEL_D[i], ['bell', 'lead2'], [96, 60])
    if i >= 6:
        s = song.bar(b)
        for p in (rt(ch, 3) + (12 if CH[ch][0] < 6 else 0), rt(ch, 4) + (12 if CH[ch][0] < 6 else 0) + CH[ch][1]):
            song.add('sweep', s, 3.95, p, 50 + (i - 6) * 8)
    if i >= 8: song.dr(song.bar(b) + 1, CLAP, 96); song.dr(song.bar(b) + 3, CLAP, 100)
fill(59); fill(63, 112)
alarm(66, 76, 2)

# ---- Rückführung E (68–75): Dominante cis, Wirbel, Alarm -------------------------------------------
CH_E = ['D', 'D', 'E', 'E', 'C#m', 'C#m', 'C#m', 'C#m']
hit(68, 0, 'D', 112, 0.9); crash(68, 108)
for i, ch in enumerate(CH_E):
    b = 68 + i
    seq_bass(b, ch, 100 + i * 2); sub(b, ch, 90); arp(b, ch, 74 + i * 3, echo=True); pad(b, ch, 60 + i * 4)
    if i < 4: groove(b, 'B', 0.95 + i * 0.03)
    else:
        for k2 in range(4): song.dr(song.bar(b) + k2, KICK, 108)
        snare_roll(b, 0, 4, 55 + (i - 4) * 12, 85 + (i - 4) * 14)
    if i >= 4: pings(b, ch, 80)
line(70, [(0, .75, 'E5'), (.75, .75, 'E5'), (1.5, .5, 'G#5'), (2, 2, 'B5')], ['lead', 'sawl'], [94, 70])
line(71, [(0, 1, 'B5'), (1, 1, 'G#5'), (2, 1, 'E5'), (3, 1, 'G#5')], ['lead', 'sawl'], [94, 70])
line(74, [(0, .25, 'C#5'), (.25, .25, 'E5'), (.5, .25, 'G#5'), (.75, .25, 'C#6'), (1, 1, 'E6'), (2, 1.6, 'G#5')], ['lead'], [104])
alarm(72, 74, 3); fill(67); fill(71, 120); fill(75, 124)

sf2, out = cli_paths('bgm_theme_futuretech.ogg')
song.render(sf2, out)
