# -*- coding: utf-8 -*-
"""Theme „Slip 'n' Slide Showdown“ (Archetyp Slippery: Eis und Pinguine) → public/music/bgm_theme_slippery.ogg

Frostig-verspielter Schlittschuh-Kampf in A-Dur (lydische Färbung mit dis), 140 BPM, 72 Takte
(123,4 s), nahtlos loopbar. Das ganze Stück liegt im Triolen-Swing (Schlittschuh-Walzer-Schwung im
4/4): hüpfender Bass mit Oktavsprüngen, Klavier-Nachschläge auf den Triolen, Marimba-Bounce,
Vibraphon/Glockenspiel als „glasklare“ Melodiefarbe, Tamburin als Schlittenglöckchen, Harfen-
Läufe als rutschende Glissandi.

Hauptmotiv („Ausrutscher“): A-cis-e-A hoch, dann gis-e zurück – ein kleiner Sprung nach oben und
ein Wegrutschen; in der Bridge wird das Rutschen wörtlich: ganze Oktavläufe in Triolen abwärts.

Aufbau (Takte, 0-basiert):
   0– 7  Intro          Beat + hüpfender Bass + Marimba, Glocken funkeln, ab Takt 4 Motiv im Vibraphon
   8–23  Thema A        Vibraphon-Melodie A E | fis D …, zweiter Durchgang mit Flöten-Gegenstimme,
                        Glockenspiel-Oktave und Pizzicato
  24–39  Bridge B       „Rutsch“-Takte (Triolen-Oktavläufe) im Wechsel mit Hüpf-Takten, Kristall-Pad,
                        Harfen-Glissandi; ab Takt 32 Streicher und Flöte
  40–55  Höhepunkt C    Hymne in Trompete + Vibraphon + Chor; Takte 48–53 einen Ganzton höher (H-Dur),
                        dann über D–E zurück nach A
  56–63  Rückblick D    Thema A leise in Flöte und Glockenspiel über ausgedünntem Beat
  64–71  Rückführung E  fis-Moll–D–H–E, Snare-Wirbel, Dominante E → Sprung auf Takt 0 (A)

Harmonie: I–V–vi–IV-Schleifen mit II (H-Dur, dis = lydisch) als Eisglanz. Kein Schlussakkord;
der Loop endet auf der Dominante E.
Aufruf:  python3 scripts/music/theme_slippery.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 140, 72                        # 72 × 4 × 60/140 = 123,4 s
T = 1 / 3                                   # Triolenachtel
song = Song(bpm=BPM, bars=BARS)

song.inst('bass',    'sbass2',  100, 60)
song.inst('piano',   'piano',    84, 46)
song.inst('marimba', 'marimba',  86, 80)
song.inst('pizz',    'pizz',     78, 34)
song.inst('vibes',   'vibes',    96, 64)
song.inst('glock',   'glock',    82, 90)
song.inst('flute',   'flute',    80, 40)
song.inst('harp',    'harp',     84, 96)
song.inst('crystal', 'crystal',  62, 30)
song.inst('strings', 'strings',  74, 70)
song.inst('trumpet', 'trumpet',  86, 72)
song.inst('choir',   'choir',    74, 64)

NAMES = {'C': C, 'Db': Db, 'D': D, 'Eb': Eb, 'E': E, 'F': F, 'Gb': Gb, 'G': G, 'Ab': Ab, 'A': A, 'Bb': Bb, 'B': B,
         'C#': Db, 'D#': Eb, 'F#': Gb, 'G#': Ab, 'A#': Bb}
def nt(s):
    return n(NAMES[s[:-1]], int(s[-1]))
MAJ = [0, 2, 4, 5, 7, 9, 11]
# Akkorde in A-Dur: (Grundton-Pitchclass, Terz), Stufe im Tonleiter-Index
CH = {'A': (A, 4, 0), 'B': (B, 4, 1), 'C#m': (Db, 3, 2), 'D': (D, 4, 3), 'E': (E, 4, 4), 'F#m': (Gb, 3, 5)}
LYD = {(A + i) % 12 for i in MAJ} | {D + 1}            # A-Dur + dis (lydisch)

def deg(i, s=0):
    """Tonleiterstufe i (0 = A4) in A-Dur, um s Halbtöne transponiert."""
    return 69 + s + 12 * (i // 7) + MAJ[i % 7]
def root_b(ch, s=0): return 36 + (CH[ch][0] + s) % 12                  # Oktave 2 (36–47)
def root_m(ch, s=0): return 48 + (CH[ch][0] + s) % 12                  # Oktave 3 (48–59)
def check(pitch, s, what):
    assert (pitch - s) % 12 in LYD, f'Ton {pitch} nicht in Skala ({what})'

def line(b, notes, insts, vels, s=0):
    """Melodietakt: notes = [(beat, dauer, 'A5'), …]; insts/vels parallel."""
    for off, dur, p in notes:
        pp = nt(p) + s; check(pp, s, f'Takt {b} {p}')
        for inst, v in zip(insts, vels): song.add(inst, song.bar(b) + off, dur * 0.93, pp, v)

# ---- Bausteine ------------------------------------------------------------------------
def bass(b, ch, vel=100, s=0, hop=True):
    r = root_b(ch, s); q = song.bar(b)
    song.add('bass', q, 0.6, r, vel + 8)
    song.add('bass', q + 1, 0.3, r + 12, vel - 10)
    song.add('bass', q + 1 + 2 * T, 0.3, r, vel - 14)
    song.add('bass', q + 2, 0.6, r + 7, vel + 2)
    song.add('bass', q + 3, 0.3, r + 12, vel - 10)
    song.add('bass', q + 3 + 2 * T, 0.3, r + 7, vel - 12)

def comp(b, ch, vel=74, s=0):
    """Klavier-Nachschläge auf den Triolen (Schlittschuh-Schwung)."""
    r = root_m(ch, s); tones = [r, r + CH[ch][1], r + 7]
    for j in range(4):
        if j in (1, 3) or vel > 80:
            for p in tones: song.add('piano', song.bar(b) + j + 2 * T, 0.28, p, vel + (6 if j == 3 else 0))

def bounce(b, ch, vel=78, s=0):
    """Marimba: geswungene Achtel-Arpeggien (lang-kurz)."""
    r = root_m(ch, s) + 12; t3 = CH[ch][1]
    cyc = [r, r + 7, r + t3 + 12, r + 7, r + 12, r + 7, r + t3, r + 7]
    for i in range(8):
        off = (i // 2) + (0 if i % 2 == 0 else 2 * T)
        song.add('marimba', song.bar(b) + off, 0.3, cyc[i], vel + (8 if i % 2 == 0 else 0))

def pizz(b, ch, vel=74, s=0):
    r = root_m(ch, s) + 12; t3 = CH[ch][1]
    for i, p in enumerate([r + 7, r + 12, r + t3 + 12, r + 12]):
        song.add('pizz', song.bar(b) + i + 2 * T, 0.25, p, vel)

def pad(inst, b, ch, vel=60, s=0, octv=12):
    r = root_m(ch, s) + octv
    for p in (r, r + CH[ch][1], r + 7): song.add(inst, song.bar(b), 3.95, p, vel)

def sparkle(b, ch, vel=80, s=0):
    """Glockenspiel: zwei funkelnde Töne am Taktende."""
    r = root_m(ch, s) + 24
    song.add('glock', song.bar(b) + 2 + 2 * T, 0.3, r + 7, vel)
    song.add('glock', song.bar(b) + 3 + T, 0.3, r + CH[ch][1] + 12, vel - 6)
    song.add('glock', song.bar(b) + 3 + 2 * T, 0.3, r + 12, vel + 6)

def gliss(b, beat, start_deg, cnt, s=0, inst='harp', vel=84, up=False):
    """Rutschender Tonleiterlauf in Triolen (Harfe)."""
    for i in range(cnt):
        d = start_deg - i if not up else start_deg + i
        p = deg(d, s); check(p, s, 'Gliss')
        song.add(inst, song.bar(b) + beat + i * T * 0.5, 0.2, p, vel + (10 if i == 0 else -min(i, 8)))

def groove(b, kind, v=1.0):
    q = song.bar(b)
    def d(off, note, vel): song.dr(q + off, note, min(127, vel * v))
    if kind == 'soft':
        d(0, KICK, 96); d(2, KICK, 90); d(1, SIDESTICK, 96); d(3, SIDESTICK, 100)
        for j in range(4): d(j, HAT, 108); d(j + 2 * T, HAT, 96)
        d(2 + 2 * T, TAMB, 100)
        return
    for off, vel in ((0, 116), (2, 106)): d(off, KICK, vel)
    if kind in ('B', 'C'): d(3 + 2 * T, KICK, 98)
    if kind == 'C': d(1 + 2 * T, KICK, 92)
    d(1, SNARE, 112); d(3, SNARE, 114)
    if kind in ('B', 'C'): d(3, CLAP, 100)
    for j in range(4): d(j, HAT, 112 if j % 2 == 0 else 100); d(j + 2 * T, HAT, 100)
    d(1 + 2 * T, TAMB, 108); d(3 + 2 * T, TAMB, 116); d(2 + 2 * T, TAMB, 100)
    if kind == 'C': d(0, TOM_L, 90); d(2, TOM_M, 88)

def fill(b, big=False):
    q = song.bar(b)
    toms = [TOM_HH, TOM_H, TOM_M, TOM_M, TOM_L, TOM_L]
    for i in range(6): song.dr(q + 2 + i * 2 * T * 1.5 * 0.67 + (0 if not big else 0), toms[i], ramp(i, 6, 88, 118), 0.2)
    song.dr(q + 3 + 2 * T, KICK, 118); song.dr(q + 3 + 2 * T, SNARE, 110)
def ramp(i, cnt, a, b_): return a + (b_ - a) * i / max(1, cnt - 1)
def roll(b, st, en, v0, v1):
    q = song.bar(b) + st; cnt = int((en - st) * 3)
    for i in range(cnt): song.dr(q + i * T, SNARE, ramp(i, cnt, v0, v1), 0.15)
def crash(b, vel=112): song.dr(song.bar(b), CRASH, vel, 0.5)

TAMB = 54                                   # Tamburin = Schlittenglöckchen (leise → hohe Velocity)

# ---- Melodien (A-Dur, Triolen-Swing) --------------------------------------------------
CH_A = ['A', 'E', 'F#m', 'D', 'A', 'E', 'D', 'E']
MEL_A = [
    [(0, 1, 'A4'), (1, 2 * T, 'C#5'), (1 + 2 * T, T, 'E5'), (2, 1, 'A5'), (3, 2 * T, 'G#5'), (3 + 2 * T, T, 'E5')],
    [(0, 1, 'F#5'), (1, 2 * T, 'E5'), (1 + 2 * T, T, 'C#5'), (2, 2 * T, 'B4'), (2 + 2 * T, T, 'G#4'), (3, 1, 'B4')],
    [(0, 1, 'C#5'), (1, 2 * T, 'F#5'), (1 + 2 * T, T, 'A5'), (2, 1, 'C#6'), (3, 2 * T, 'B5'), (3 + 2 * T, T, 'A5')],
    [(0, 1, 'F#5'), (1, 2 * T, 'A5'), (1 + 2 * T, T, 'F#5'), (2, 2, 'D5')],
    [(0, 1, 'A4'), (1, 2 * T, 'C#5'), (1 + 2 * T, T, 'E5'), (2, 1, 'A5'), (3, 2 * T, 'B5'), (3 + 2 * T, T, 'C#6')],
    [(0, 1, 'B5'), (1, 2 * T, 'G#5'), (1 + 2 * T, T, 'E5'), (2, 1, 'G#5'), (3, 1, 'B5')],
    [(0, 1, 'A5'), (1, 2 * T, 'F#5'), (1 + 2 * T, T, 'D5'), (2, 1, 'F#5'), (3, 1, 'A5')],
    [(0, 1, 'G#5'), (1, 1, 'E5'), (2, 1, 'B4'), (3, 1, 'G#4')],
]
CTR_A = [('E5', 'C#5'), ('B4', 'G#4'), ('A4', 'C#5'), ('A4', 'F#4'), ('E5', 'A4'), ('G#4', 'B4'), ('F#4', 'A4'), ('G#4', 'E4')]

CH_B1 = ['F#m', 'D', 'A', 'E', 'F#m', 'D', 'B', 'B']
CH_B2 = ['A', 'E', 'F#m', 'D', 'B', 'E', 'B', 'E']
def rut_bar(b, ch, insts, vels, s=0, hop=False):
    """Rutsch-Takt: Grundton, dann Oktavlauf in Triolen abwärts. hop=True: Hüpf-Arpeggio."""
    rd = CH[ch][2]
    if hop:
        r = deg(rd + 7, s); t3 = deg(rd + 9, s); f5 = deg(rd + 11, s)
        seq = [(0, T, r), (T, T, t3), (2 * T, T, f5), (1, 1, t3), (2, 2 * T, r), (2 + 2 * T, T, t3), (3, 1, f5)]
    else:
        d0 = rd + 7
        if d0 > 10: d0 -= 7
        seq = [(0, 1, deg(d0, s))] + [(1 + i * T, T, deg(d0 - 1 - i, s)) for i in range(6)] + [(3, 1, deg(d0 - 7, s))]
    for off, dur, p in seq:
        check(p, s, f'Rutsch {b}')
        for inst, v in zip(insts, vels): song.add(inst, song.bar(b) + off, dur * 0.93, p, v)

CH_C1 = ['A', 'E', 'F#m', 'D', 'A', 'E', 'D', 'E']
MEL_C = [
    [(0, 2, 'A5'), (2, 1, 'G#5'), (3, 1, 'E5')],
    [(0, 2, 'F#5'), (2, 1, 'E5'), (3, 1, 'B4')],
    [(0, 2, 'C#6'), (2, 1, 'B5'), (3, 1, 'A5')],
    [(0, 1, 'D5'), (1, 1, 'F#5'), (2, 2, 'A5')],
    [(0, 2, 'A5'), (2, 1, 'B5'), (3, 1, 'C#6')],
    [(0, 2, 'B5'), (2, 1, 'G#5'), (3, 1, 'B5')],
    [(0, 2, 'A5'), (2, 1, 'F#5'), (3, 1, 'A5')],
    [(0, 1, 'G#5'), (1, 1, 'E5'), (2, 1, 'B4'), (3, 1, 'G#4')],
]

# ==== Arrangement ==========================================================================
# ---- Intro (0–7) ------------------------------------------------------------------------
CH_I = ['A', 'E', 'F#m', 'D', 'A', 'E', 'D', 'E']
song.add('glock', 0, 1.5, nt('A6'), 90)
for i, ch in enumerate(CH_I):
    b = i
    bass(b, ch, 90 + i * 2)
    comp(b, ch, 66 + i * 2)
    bounce(b, ch, 70 + i * 3)
    groove(b, 'A' if i >= 2 else 'soft', 1.0)
    sparkle(b, ch, 70 + i * 3)
    if i >= 4:
        line(b, MEL_A[i - 4], ['vibes'], [88 + (i - 4) * 2])
        pad('strings', b, ch, 56 + (i - 4) * 4)
gliss(3, 2, 14, 12, 0, 'harp', 80)
crash(0, 100); fill(3); fill(6); roll(7, 0, 3.4, 60, 118); fill(7)

# ---- Thema A (8–23) ---------------------------------------------------------------------
crash(8, 112)
for i in range(16):
    b, k = 8 + i, i % 8; ch = CH_A[k]; second = i >= 8
    bass(b, ch, 100)
    comp(b, ch, 76 + (4 if second else 0))
    bounce(b, ch, 74)
    groove(b, 'A', 1.0 if not second else 1.05)
    line(b, MEL_A[k], ['vibes'] + (['glock'] if second else []), [96, 66])
    if second:
        for j, p in enumerate(CTR_A[k]): song.add('flute', song.bar(b) + j * 2, 1.9, nt(p), 78)
        pizz(b, ch, 70)
    else:
        pad('crystal', b, ch, 50)
    if k in (3, 7): gliss(b, 2 + 2 * T if k == 3 else 3, 12, 4, 0, 'harp', 78)
    if k % 2 == 1: sparkle(b, ch, 72)
fill(15); crash(16, 104); fill(23)
roll(22, 2, 4, 60, 100); roll(23, 0, 3.4, 90, 124)

# ---- Bridge B (24–39): Rutsch-Takte ----------------------------------------------------
crash(24, 114); crash(32, 114)
for i in range(16):
    b, k = 24 + i, i % 8; second = i >= 8
    ch = (CH_B1 if not second else CH_B2)[k]
    bass(b, ch, 102)
    comp(b, ch, 80)
    groove(b, 'B', 1.0 if not second else 1.05)
    hop = (k % 2 == 1)
    rut_bar(b, ch, ['vibes'] + (['glock'] if second else []), [98, 70], 0, hop)
    pad('crystal', b, ch, 56)
    if second:
        pad('strings', b, ch, 66)
        r = root_m(ch) + 12
        song.add('flute', song.bar(b), 3.9, r + 12, 74)
    else:
        bounce(b, ch, 70)
    if k in (3, 7): gliss(b, 3, 14, 6, 0, 'harp', 82)
fill(31); fill(35); fill(39, True)
roll(38, 1, 4, 60, 110); roll(39, 0, 3.4, 100, 127)

# ---- Höhepunkt C (40–55): Hymne, zweite Hälfte ein Ganzton höher ------------------------
crash(40, 118); crash(48, 120)
for i in range(16):
    b, k = 40 + i, i % 8
    s = 2 if 8 <= i < 14 else 0
    ch = CH_C1[k]
    bass(b, ch, 106, s)
    comp(b, ch, 86, s)
    bounce(b, ch, 78, s)
    groove(b, 'C', 1.0)
    line(b, MEL_C[k], ['trumpet', 'vibes', 'glock'], [96, 92, 60], s)
    pad('choir', b, ch, 76, s)
    pad('strings', b, ch, 70, s)
    pizz(b, ch, 74, s)
    if k in (3, 7): gliss(b, 3, 14 + (1 if s else 0), 6, s, 'harp', 84)
    if k % 4 == 0 and b not in (40, 48): crash(b, 100)
    sparkle(b, ch, 78, s)
fill(43); fill(47); fill(51); fill(55, True)
roll(54, 2, 4, 70, 110); roll(55, 0, 3.4, 100, 127)

# ---- Rückblick D (56–63): Thema A leise --------------------------------------------------
crash(56, 96)
for i in range(8):
    b = 56 + i; ch = CH_A[i]
    bass(b, ch, 88); comp(b, ch, 70); bounce(b, ch, 66)
    groove(b, 'soft', 1.0)
    line(b, MEL_A[i], ['flute', 'glock'], [82 + i, 62])
    pad('crystal', b, ch, 52)
    if i >= 4: pad('strings', b, ch, 50 + (i - 4) * 6)
    sparkle(b, ch, 68)
fill(63)

# ---- Rückführung E (64–71): Aufbau zur Dominante ----------------------------------------
crash(64, 108)
CH_E = ['F#m', 'D', 'B', 'B', 'E', 'E', 'E', 'E']
for i, ch in enumerate(CH_E):
    b = 64 + i
    bass(b, ch, 96 + i * 2); comp(b, ch, 80 + i * 2); bounce(b, ch, 74)
    pad('strings', b, ch, 60 + i * 4); pad('crystal', b, ch, 56)
    if i < 4: groove(b, 'B', 1.0)
    else: roll(b, 0, 3.4, 60 + (i - 4) * 12, 90 + (i - 4) * 12); song.dr(song.bar(b), KICK, 110); song.dr(song.bar(b) + 2, KICK, 106)
    if i < 4: rut_bar(b, ch, ['vibes'], [94], 0, i % 2 == 1)
    if i >= 4: pad('choir', b, ch, 60 + (i - 4) * 6)
line(68, MEL_A[7], ['flute'], [92]); line(69, MEL_A[5], ['flute'], [94])
line(70, [(0, 1, 'E5'), (1, 2 * T, 'G#5'), (1 + 2 * T, T, 'B5'), (2, 2, 'E6')], ['vibes', 'glock'], [100, 70])
gliss(71, 0, 14, 12, 0, 'harp', 92)
song.add('vibes', song.bar(71) + 2, 1.9, nt('E5'), 100)
fill(67, True); fill(71, True)

sf2, out = cli_paths('bgm_theme_slippery.ogg')
song.render(sf2, out)
