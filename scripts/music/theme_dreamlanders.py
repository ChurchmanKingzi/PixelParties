# -*- coding: utf-8 -*-
"""Battle-Theme „Lucid Collision“ (Archetyp Dream Landers) → public/music/bgm_theme_dreamlanders.ogg

Traumwelt-Kampf in h-Moll ↔ H-Dur, 120 BPM, 64 Takte (128,0 s), nahtlos loopbar.
Schwebende Pads (newage/warm/atmos), Glockenspiel-Melodie mit Delay-Echo (Punktierte Achtel),
E-Piano-Arpeggio im 3er-Zyklus, der quer über den 4/4-Takt läuft (Betonungsverschiebung; alle
4 Takte "hakt" der Zyklus mit einem Rest von 2 Achteln), Kick-Muster 3+3+2 gegen den 4/4-Backbeat
der Snare ("Kollision"), Reverse-Swells (sweep mit steigender Expression) vor jedem Abschnitt.
Dur/Moll kippen: die Melodie wechselt zwischen D und Dis, Gm/G, Em/E – wie ein Traum, der umschlägt.
Zu den Karten: Zwei Wesen stapeln sich zu einem (Klaus/Clausss, Lizbeth/Smugbeth …) – darum
"Doppelgänger": jede Melodiezeile hat ein Echo, der Durchbruch (C) spielt Moll und Dur im Wechsel.

Aufbau (Takte, 0-basiert):
   0– 7  Intro        Pad + Arpeggio im 3er-Zyklus, Bass/Drums 3+3+2, Reverse-Swell in Takt 7
   8–23  Thema A      h-Moll: Glockenspiel-Motiv (3+3+2 Rhythmus), Ooh-Gegenstimme, Echo
  24–39  Thema B      Kippen nach H-Dur: helles Traumthema, Kalimba-Gegenstimme, volle Drums
  40–55  Höhepunkt C  "Lucid Collision": Moll/Dur im Taktwechsel, Charang+Glocke, Synth-Stabs,
                      Kick 3+3+2 gegen Snare 2+4
  56–63  Rückführung  Thema A in der Okarina über Pads, Reverse-Swell und Fill → zurück zu Takt 0
Aufruf:  python3 scripts/music/theme_dreamlanders.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 120, 64                       # 64 × 4 × 60/120 = 128,0 s
song = Song(bpm=BPM, bars=BARS)

song.inst('bass',   'sbass',    100, 60)
song.inst('pad',    'newage',    70, 50)
song.inst('warm',   'warm',      62, 78)
song.inst('atmos',  'atmos',     52, 64)
song.inst('sweep',  'sweep',     70, 64)
song.inst('arp',    'epiano',    78, 44)
song.inst('arpe',   'vibes',     56, 88)   # Echo des Arpeggios
song.inst('lead',   'glock',     92, 70)
song.inst('leade',  'bell',      60, 30)   # Echo der Melodie
song.inst('ocar',   'ocarina',   86, 62)
song.inst('oohs',   'oohs',      74, 58)
song.inst('kal',    'kalimba',   84, 34)
song.inst('charang','charang',   78, 74)
song.inst('stab',   'synstr',    70, 52)

NAMES = {'C': C, 'Db': Db, 'D': D, 'Eb': Eb, 'E': E, 'F': F, 'Gb': Gb, 'G': G, 'Ab': Ab, 'A': A, 'Bb': Bb, 'B': B}
SHARP = {'C#': Db, 'D#': Eb, 'F#': Gb, 'G#': Ab, 'A#': Bb}
def nt(s):
    pc = SHARP[s[:2]] if len(s) == 3 and s[1] == '#' else NAMES[s[:-1]]
    return n(pc, int(s[-1]))
SCALE = {B, Db, D, Eb, E, Gb, G, Ab, A, Bb}           # h-Moll ∪ H-Dur (Kipp-Tonvorrat)

MIN, MAJ = (0, 3, 7), (0, 4, 7)
CH = {'Bm': (B, MIN), 'B': (B, MAJ), 'G': (G, MAJ), 'Gm': (G, MIN), 'D': (D, MAJ), 'F#m': (Gb, MIN),
      'F#': (Gb, MAJ), 'Em': (E, MIN), 'E': (E, MAJ), 'G#m': (Ab, MIN)}
def tones(ch, base):                       # Akkordtöne ab Oktave `base`
    r, iv = CH[ch]; return [n(r, base) + i for i in iv]
def bassp(ch):
    r = CH[ch][0]; return 24 + r if r >= E else 36 + r
def melroot(ch):
    r = CH[ch][0]; return 60 + r if r >= 5 else 72 + r
def ramp(i, cnt, a, b): return a + (b - a) * i / max(1, cnt - 1)

# ---- Bausteine ---------------------------------------------------------------------------
def pads(b, ch, vel=68, warm=True, atmos=False):
    s = song.bar(b)
    for p in tones(ch, 3): song.add('pad', s, 3.98, p, vel)
    if warm:
        for p in tones(ch, 4): song.add('warm', s, 3.98, p, vel - 8)
    if atmos:
        song.add('atmos', s, 3.98, tones(ch, 5)[2], vel - 10)

def arp(b, sec_start, ch, vel=74, echo=True):
    """3er-Zyklus in Achteln quer zum 4/4; alle 4 Takte Reset (32 = 10×3 + 2)."""
    s = song.bar(b); t = tones(ch, 4)
    for i in range(8):
        gi = ((b - sec_start) % 4) * 8 + i
        c = gi % 3; p = t[c] + (12 if (gi // 3) % 2 else 0)
        v = vel + (16 if c == 0 else 0)
        song.add('arp', s + i * 0.5, 0.45, p, v)
        if echo: song.add('arpe', s + i * 0.5 + 0.75, 0.4, p + 12, int(v * 0.45))

def bass(b, ch, kind='shift', vel=100):
    s = song.bar(b); r = bassp(ch)
    if kind == 'shift':               # 3+3+2
        song.add('bass', s, 1.4, r, vel + 8); song.add('bass', s + 1.5, 1.4, r, vel - 8)
        song.add('bass', s + 3, 0.9, r + 7, vel); song.add('bass', s + 2.75, 0.2, r + 12, vel - 26)
    elif kind == 'drive':             # Achtelpuls mit Oktavsprung
        for i in range(8): song.add('bass', s + i * 0.5, 0.42, r + (12 if i in (3, 7) else 0), vel + (8 if i % 4 == 0 else -4))
    elif kind == 'long':
        song.add('bass', s, 3.9, r, vel - 10)

def melody(b, notes, vel=92, inst='lead', echo=True):
    for off, dur, p in notes:
        pitch = nt(p) if isinstance(p, str) else p
        assert pitch % 12 in SCALE, (b, p)
        song.add(inst, song.bar(b) + off, dur * 0.94, pitch, vel + (6 if off == 0 else 0))
        if echo and inst == 'lead': song.add('leade', song.bar(b) + off + 0.75, dur * 0.7, pitch, int(vel * 0.5))

def arpline(ch, rev=False):               # Motiv 3+3+2 aus Akkordtönen
    r = melroot(ch); iv = CH[ch][1]; ps = [r + iv[0], r + iv[1], r + iv[2]]
    if rev: ps = ps[::-1]
    return [(0, 1.5, ps[0]), (1.5, 1.5, ps[1]), (3, 1, ps[2])]

def swell(b, vel=90):
    s = song.bar(b); song.cc('sweep', s - 0.01, 11, 20)
    song.add('sweep', s, 4, n(B, 4), vel)
    for i in range(8): song.cc('sweep', s + i * 0.5, 11, 20 + i * 15)

# ---- Schlagzeug --------------------------------------------------------------------------
def groove(b, kind, v=1.0):
    s = song.bar(b)
    def d(off, note, vel): song.dr(s + off, note, min(127, vel * v))
    if kind == 'std':                 # 4/4
        d(0, KICK, 110); d(2, KICK, 100); d(1, SNARE, 104); d(3, SNARE, 106)
        for i in range(8): d(i * 0.5, HAT, 108 if i % 2 == 0 else 92)
    elif kind == 'shift':             # 3+3+2 auf allem
        d(0, KICK, 112); d(1.5, SNARE, 106); d(1.5, CLAP, 84); d(3, KICK, 104); d(2.25, KICK, 88); d(3.75, SNARE, 70)
        for i in range(8): d(i * 0.5, HAT, 116 if i in (0, 3, 6) else 90)
    elif kind == 'collide':           # Kick 3+3+2 gegen Snare 2+4
        for off, vel in ((0, 116), (1.5, 104), (3, 108)): d(off, KICK, vel)
        d(1, SNARE, 112); d(3, SNARE, 114); d(1, CLAP, 80); d(3, CLAP, 84); d(2.5, TOM_M, 90); d(3.75, TOM_L, 90)
        for i in range(8): d(i * 0.5, HAT, 118 if i in (0, 3, 6) else 96)
        d(3.5, COWBELL, 66)

def fill(b, big=False):
    s = song.bar(b); toms = [TOM_H, TOM_HH, TOM_M, TOM_L]
    for i in range(8): song.dr(s + 2 + i * 0.25, toms[min(3, i // 2)], ramp(i, 8, 88, 118), 0.2)
    if big:
        for i in range(8): song.dr(s + 1.0 + i * 0.25, SNARE, ramp(i, 8, 60, 108), 0.12)
    song.dr(s + 3.75, KICK, 118)

def rev_roll(b, v0=30, v1=120):           # "Rückwärts-Snare": Crescendo
    for i in range(16): song.dr(song.bar(b) + i * 0.25, SNARE, ramp(i, 16, v0, v1), 0.12)

def crash(b, vel=112): song.dr(song.bar(b), CRASH, vel, 0.5)

# ==== Arrangement ==========================================================================
# ---- Intro (0–7) ---------------------------------------------------------------------------
CH_I = ['Bm', 'Bm', 'G', 'G', 'Bm', 'Bm', 'F#m', 'F#']
crash(0, 100)
for i, ch in enumerate(CH_I):
    pads(i, ch, 62 + i * 2, warm=i >= 2, atmos=True)
    arp(i, 0, ch, 68 + i * 2, echo=i >= 2)
    bass(i, ch, 'shift', 92 + i * 2)
    groove(i, 'shift' if i % 2 == 0 else 'std', 0.9 + i * 0.02)
melody(6, [(0, 1.5, 'F#5'), (1.5, 1.5, 'C#5'), (3, 1, 'A4')], 84, 'ocar', False)
melody(7, [(0, 1.5, 'A#4'), (1.5, 1.5, 'C#5'), (3, 1, 'F#5')], 90, 'ocar', False)
swell(7, 96); rev_roll(7, 40, 110); fill(3)

# ---- Thema A (8–23) h-Moll ------------------------------------------------------------------
CH_A = ['Bm', 'G', 'D', 'F#m', 'Bm', 'G', 'Em', 'F#']
MEL_A = [
    [(0, 1.5, 'B4'), (1.5, 1.5, 'D5'), (3, 1, 'F#5')],
    [(0, 1.5, 'B4'), (1.5, 1.5, 'D5'), (3, 1, 'G5')],
    [(0, 1.5, 'A4'), (1.5, 1.5, 'D5'), (3, 1, 'F#5')],
    [(0, 1.5, 'C#5'), (1.5, 1.5, 'A4'), (3, 1, 'F#4')],
    [(0, 1.5, 'B4'), (1.5, 1.5, 'D5'), (3, 1, 'F#5')],
    [(0, 1.5, 'D5'), (1.5, 1.5, 'B4'), (3, 1, 'G4')],
    [(0, 1.5, 'E5'), (1.5, 1.5, 'G5'), (3, 1, 'B5')],
    [(0, 1.5, 'C#5'), (1.5, 1.5, 'A#4'), (3, 1, 'F#4')],
]
OOH_A = ['F#4', 'D4', 'A3', 'C#4', 'F#4', 'D4', 'G4', 'C#4']
crash(8, 112)
for i in range(16):
    b, k = 8 + i, i % 8; ch = CH_A[k]; second = i >= 8
    pads(b, ch, 70 + (4 if second else 0), atmos=second)
    arp(b, 8, ch, 66 + (4 if second else 0))
    bass(b, ch, 'shift', 98)
    groove(b, 'shift' if k % 4 != 3 else 'std', 1.0 + (0.05 if second else 0))
    melody(b, MEL_A[k], 90 + (4 if second else 0), 'lead')
    if second:
        song.add('oohs', song.bar(b), 3.95, nt(OOH_A[k]), 66 + (k // 4) * 8)
        if k in (3, 7): melody(b, [(0, 1.5, MEL_A[k][0][2])], 60, 'ocar', False)
fill(15); fill(19); rev_roll(22, 30, 100); swell(23, 100); fill(23, big=True)

# ---- Thema B (24–39) H-Dur: das Traum-Kippen -----------------------------------------------
CH_B = ['B', 'E', 'G#m', 'F#', 'B', 'E', 'F#', 'F#']
MEL_B = [
    [(0, 1.5, 'B4'), (1.5, 1.5, 'D#5'), (3, 1, 'F#5')],
    [(0, 1.5, 'E5'), (1.5, 1.5, 'G#5'), (3, 1, 'B5')],
    [(0, 1.5, 'D#5'), (1.5, 1.5, 'B4'), (3, 1, 'G#4')],
    [(0, 1.5, 'C#5'), (1.5, 1.5, 'A#4'), (3, 1, 'F#4')],
    [(0, 1.5, 'B4'), (1.5, 1.5, 'D#5'), (3, 1, 'F#5')],
    [(0, 1.5, 'G#5'), (1.5, 1.5, 'E5'), (3, 1, 'B4')],
    [(0, 0.5, 'C#5'), (0.5, 0.5, 'F#5'), (1, 1, 'A#5'), (2, 1.5, 'F#5'), (3.5, 0.5, 'C#5')],
    [(0, 3, 'D#5'), (3, 1, 'F#5')],
]
KAL_B = [[(0.75, 'F#5'), (2.25, 'D#5')], [(0.75, 'B5'), (2.25, 'G#5')], [(0.75, 'B4'), (2.25, 'F#4')], [(0.75, 'A#4'), (2.25, 'C#5')]]
crash(24, 114)
for i in range(16):
    b, k = 24 + i, i % 8; ch = CH_B[k]; second = i >= 8
    pads(b, ch, 74 + (4 if second else 0), atmos=True)
    arp(b, 24, ch, 70 + (4 if second else 0))
    bass(b, ch, 'drive' if second else 'shift', 100)
    groove(b, 'collide' if second else ('shift' if k % 4 != 3 else 'std'), 1.0 if not second else 1.04)
    melody(b, MEL_B[k], 92 + (4 if second else 0), 'lead')
    if second: melody(b, [(o, d, p) for o, d, p in MEL_B[k]], 70, 'ocar', False)
    else:
        for o, p in KAL_B[k % 4]: melody(b, [(o, 0.6, p)], 74, 'kal', False)
    if second: song.add('oohs', song.bar(b), 3.95, tones(ch, 4)[2], 72)
fill(31); fill(35); rev_roll(38, 30, 105); swell(39, 104); fill(39, big=True)

# ---- Höhepunkt C (40–55) „Lucid Collision“: Moll/Dur im Taktwechsel ------------------------
CH_C = ['Bm', 'B', 'G', 'Gm', 'Em', 'E', 'F#m', 'F#',
        'Bm', 'B', 'Gm', 'G', 'E', 'Em', 'F#', 'F#']
crash(40, 120); crash(48, 118)
for i in range(16):
    b = 40 + i; ch = CH_C[i]; second = i >= 8; k = i % 8
    pads(b, ch, 78, atmos=True)
    arp(b, 40, ch, 74, echo=True)
    bass(b, ch, 'drive', 104)
    groove(b, 'collide', 1.04 if second else 1.0)
    line = arpline(ch, rev=(i % 2 == 1))
    melody(b, line, 98, 'lead'); melody(b, line, 82, 'charang', False)
    for p in tones(ch, 3): song.add('stab', song.bar(b) + 1.5, 0.8, p + 12, 70); song.add('stab', song.bar(b) + 3, 0.8, p + 12, 74)
    song.add('oohs', song.bar(b), 3.95, tones(ch, 4)[1] + 12, 78)
    if k == 0 and b != 40: crash(b, 104)
fill(43); fill(47); fill(51); rev_roll(54, 30, 110); swell(55, 108); fill(55, big=True)

# ---- Rückführung D (56–63): Thema A in der Okarina ------------------------------------------
crash(56, 104)
for i in range(8):
    b = 56 + i; ch = CH_A[i]
    pads(b, ch, 72, atmos=True)
    arp(b, 56, ch, 66 + i, echo=True)
    bass(b, ch, 'shift' if i < 6 else 'drive', 96)
    groove(b, 'shift' if i % 4 != 3 else 'std', 0.95 + i * 0.01)
    melody(b, MEL_A[i], 86, 'ocar', False)
    song.add('oohs', song.bar(b), 3.95, nt(OOH_A[i]), 60 + i * 3)
rev_roll(62, 30, 100); swell(63, 100); fill(59); fill(63, big=True)

sf2, out = cli_paths('bgm_theme_dreamlanders.ogg')
song.render(sf2, out)
