# -*- coding: utf-8 -*-
"""Theme-Track „Weighing of the Souls“ (Soul Shards) → public/music/bgm_theme_soulshards.ogg

Altägyptisches Seelengericht in fis-Moll phrygisch-dominant (fis g ais h cis d e; die übermäßige
Sekunde g–ais ist die Signatur), 116 BPM, 56 Takte (115,9 s), nahtlos loopbar.
Sistrum-Rasseln (Hi-Hat 16tel), Toms im 3+3+2-Ritualrhythmus, Harfen-/Koto-Arpeggien (Ankh-Ostinato),
Oboe als Hauptstimme, Klarinette in Terzen, Chor, Hörner und Glocken, die beim „Wiegen“ wie Waagschalen
abwechselnd hoch/tief schlagen. Die sechs Seelenteile (Ba, Ka, Ren, Sah, Ib, Khet) erscheinen als
Motiv-Zellen des Hauptthemas; Bassfigur mit Halbton-Vorhalt (g→fis) als „Waage“.

Aufbau (Takte, 0-basiert):
   0– 3  Intro          Toms + Sistrum, Bass-Ostinato, Harfe, Glocke, Chor-Einsatz, Motivfetzen (Klarinette)
   4–11  Thema A        Oboe: Hauptmotiv über Fis G Fis G | hm G em Fis
  12–19  Thema A'       Oboe + Klarinette in Terzen, Streicher/Chor, dichteres Schlagzeug
  20–27  Teil B „Ba und Ka“  neue Melodie (hm G em Fis | hm em G Fis), Koto-Ostinato, Kuhglocke
  28–31  Aufruf         Thema-Zellen in Oboe + Hörnern, Fills, Crescendo
  32–47  Höhepunkt C    Thema A (1. Hälfte) + B (2. Hälfte) mit Hörnern, Chor, Toms; 2. Durchgang voller
  48–51  Wiegen         Glocken-Waage, Herzschlag (Pauke/Tom), Chor, Oboe hält – noch treibend
  52–55  Rückführung    hm G em G → Halbton-Vorhalt G → Fis (Takt 0), Snare-Wirbel, Harfenlauf

Harmonie: nur Töne der Skala; Akkorde Fis(dur), G(dur, bII), hm, em. Kein Schlussakkord; der Loop
endet auf G und löst phrygisch-dominant nach Fis auf.
Aufruf:  python3 scripts/music/theme_soulshards.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 116, 56                       # 56 × 4 × 60/116 = 115,9 s
song = Song(bpm=BPM, bars=BARS)

song.inst('contra',   'contra',   88, 64)
song.inst('bass',     'bass2',    98, 60)
song.inst('timp',     'timp',     92, 64)
song.inst('harp',     'harp',     84, 40)
song.inst('koto',     'koto',     84, 88)
song.inst('oboe',     'oboe',     96, 66)
song.inst('clarinet', 'clarinet', 86, 46)
song.inst('choir',    'choir',    84, 64)
song.inst('strings',  'slowstr',  78, 84)
song.inst('horns',    'horns',    86, 76)
song.inst('bell',     'bell',     84, 56)

NAMES = {'F#': 6, 'G': 7, 'A#': 10, 'B': 11, 'C#': 1, 'D': 2, 'E': 4}
SCALE = set(NAMES.values())
def nt(s):
    p = n(NAMES[s[:-1]], int(s[-1])); assert p % 12 in SCALE, s; return p
SCL = [p for p in range(24, 100) if p % 12 in SCALE]
def dia(p, k):                            # k Skalenstufen verschieben (diatonisch)
    return SCL[SCL.index(p) + k]

CH = {'F#': (6, 4), 'G': (7, 4), 'Bm': (11, 3), 'Em': (4, 3)}     # Grundton, Terz
for _c, (_r, _t) in CH.items():
    assert all((_r + i) % 12 in SCALE for i in (0, _t, 7)), _c
def rootb(ch): return 36 + CH[ch][0]
def r3(ch): return 48 + CH[ch][0]
def third(ch): return CH[ch][1]
def ramp(i, cnt, a, b): return a + (b - a) * i / max(1, cnt - 1)

def pedal(b, ch, vel=84): song.add('contra', song.bar(b), 3.98, rootb(ch) - 12, vel)

def bass(b, ch, vel=96):
    """Ritual-Bass: 3+3+2 mit Oktavakzent; auf Fis/G der Halbton-Vorhalt (Waage)."""
    s = song.bar(b); r = rootb(ch)
    for off, o, v in ((0, 0, 10), (0.5, 0, -8), (1.5, 12, 4), (2, 0, 0), (2.5, 0, -8), (3, 0, 2)):
        song.add('bass', s + off, 0.42, r + o, vel + v)
    nb = {'F#': r + 1, 'G': r - 1}.get(ch, r + 7)
    song.add('bass', s + 3.5, 0.42, nb, vel - 4)

def timp(b, ch, kind='q', vel=92):
    s = song.bar(b); p = rootb(ch)
    if kind == 'q':
        for off in (0, 1.5, 3): song.add('timp', s + off, 0.6, p, vel)
    elif kind == 'heart':
        for off, v in ((0, 0), (0.5, -14), (2, -4), (2.5, -16)): song.add('timp', s + off, 0.4, p, vel + v)
    elif kind == 'roll':
        for i in range(16): song.add('timp', s + i * 0.25, 0.25, p, ramp(i, 16, vel - 30, vel + 10))

def harp(b, ch, vel=78, inst='harp'):
    """Ankh-Ostinato: Achtel-Arpeggio Grund–Quinte–Oktave–Terz."""
    s = song.bar(b); r = r3(ch); t = third(ch)
    cyc = [0, 7, 12, 12 + t, 19, 12 + t, 12, 7]
    for i, o in enumerate(cyc): song.add(inst, s + i * 0.5, 0.48, r + o, vel + (10 if i % 4 == 0 else 0))

def choir(b, ch, vel=80, inst='choir', oct_=12):
    r = r3(ch) + oct_
    for p in (r, r + third(ch), r + 7): song.add(inst, song.bar(b), 3.98, p, vel)

def line(b, notes, insts, vels, shift=0, steps=None):
    for off, dur, p in notes:
        for k, (inst, v) in enumerate(zip(insts, vels)):
            q = nt(p) + shift
            if steps and steps[k]: q = dia(q, steps[k])
            song.add(inst, song.bar(b) + off, dur * 0.94, q, v)

# ---- Schlagzeug -------------------------------------------------------------------------
def groove(b, kind, v=1.0):
    s = song.bar(b)
    def d(off, note, vel): song.dr(s + off, note, min(127, vel * v))
    for i in range(16): d(i * 0.25, HAT, 104 if i % 4 == 0 else (86 if i % 2 == 0 else 70))   # Sistrum
    if kind in ('A', 'B', 'C'):
        d(0, KICK, 112); d(2.5, KICK, 96); d(1, SNARE, 100); d(3, SNARE, 104)
        d(1.5, TOM_L, 100); d(3.5, TOM_M, 96)
    if kind in ('B', 'C'):
        d(1, CLAP, 84); d(3, CLAP, 88); d(2, KICK, 90)
        for off in (0.5, 1.5, 2.5, 3.5): d(off, COWBELL, 62 if kind == 'B' else 72)
        d(3.75, TOM_H, 90)
    if kind == 'C':
        d(0, CRASH, 90) if b % 4 == 0 else None
        d(2, TOM_L, 104); d(2.75, TOM_M, 96); d(3, TOM_H, 100)
    if kind == 'soft':
        d(0, KICK, 100); d(0.75, KICK, 84); d(2, TOM_L, 96); d(2.75, TOM_L, 80); d(1, SIDESTICK, 90); d(3, SIDESTICK, 90)

def fill(b, big=False):
    s = song.bar(b); toms = [TOM_H, TOM_HH, TOM_M, TOM_L]
    for i in range(8): song.dr(s + 2 + i * 0.25, toms[min(3, i // 2)] if not big else toms[i % 4], ramp(i, 8, 88, 120), 0.2)
    song.dr(s + 3.75, KICK, 118)

def snare_roll(b, start, end, v0, v1):
    s = song.bar(b) + start; cnt = int((end - start) * 4)
    for i in range(cnt): song.dr(s + i * 0.25, SNARE, ramp(i, cnt, v0, v1), 0.15)

def crash(b, vel=108): song.dr(song.bar(b), CRASH, vel, 0.5)

# ---- Melodien ---------------------------------------------------------------------------
CHORDS_A = ['F#', 'G', 'F#', 'G', 'Bm', 'G', 'Em', 'F#']
MEL_A = [
    [(0, 1, 'F#4'), (1, .5, 'G4'), (1.5, .5, 'A#4'), (2, 1, 'C#5'), (3, 1, 'A#4')],
    [(0, 1, 'B4'), (1, .5, 'A#4'), (1.5, .5, 'G4'), (2, 2, 'D5')],
    [(0, 1, 'F#4'), (1, .5, 'G4'), (1.5, .5, 'A#4'), (2, 1, 'C#5'), (3, 1, 'F#5')],
    [(0, 1.5, 'E5'), (1.5, .5, 'D5'), (2, 1, 'B4'), (3, 1, 'G4')],
    [(0, 1, 'D5'), (1, 1, 'B4'), (2, 1, 'F#4'), (3, 1, 'B4')],
    [(0, 1, 'D5'), (1, .5, 'C#5'), (1.5, .5, 'B4'), (2, 2, 'G4')],
    [(0, 1, 'E5'), (1, 1, 'D5'), (2, 1, 'B4'), (3, 1, 'G4')],
    [(0, 1, 'A#4'), (1, .5, 'G4'), (1.5, .5, 'A#4'), (2, 2, 'C#5')],
]
CHORDS_B = ['Bm', 'G', 'Em', 'F#', 'Bm', 'Em', 'G', 'F#']
MEL_B = [
    [(0, 2, 'D5'), (2, 1, 'F#5'), (3, 1, 'E5')],
    [(0, 1.5, 'D5'), (1.5, .5, 'B4'), (2, 2, 'G4')],
    [(0, 1, 'G4'), (1, 1, 'B4'), (2, 1, 'E5'), (3, 1, 'D5')],
    [(0, 1, 'C#5'), (1, .5, 'A#4'), (1.5, .5, 'G4'), (2, 2, 'F#4')],
    [(0, 1, 'F#5'), (1, 1, 'E5'), (2, 1, 'D5'), (3, 1, 'B4')],
    [(0, 1.5, 'G5'), (1.5, .5, 'F#5'), (2, 1, 'E5'), (3, 1, 'B4')],
    [(0, 1, 'D5'), (1, 1, 'G5'), (2, 2, 'D5')],
    [(0, 1, 'A#4'), (1, .5, 'G4'), (1.5, .5, 'A#4'), (2, 1, 'C#5'), (3, 1, 'A#4')],
]
CHORDS_C = ['F#', 'G', 'F#', 'G', 'Bm', 'Em', 'G', 'F#']
MEL_C = MEL_A[:4] + MEL_B[4:]

# ==== Arrangement ==========================================================================
# ---- Intro 0–3 ---------------------------------------------------------------------------
for b, ch in enumerate(['F#', 'G', 'F#', 'G']):
    pedal(b, ch, 78 + b * 3); bass(b, ch, 86 + b * 3); timp(b, ch, 'q', 84 + b * 3)
    harp(b, ch, 66 + b * 4); groove(b, 'A', 0.86 + b * 0.04)
    if b >= 2: choir(b, ch, 58 + (b - 2) * 10)
song.add('bell', 0, 3.8, nt('F#5'), 92); song.add('bell', 0, 3.8, nt('C#5'), 80); crash(0, 100)
line(2, MEL_A[0], ['clarinet'], [80]); line(3, MEL_A[1], ['clarinet'], [86])
fill(3)

# ---- Thema A 4–19 -------------------------------------------------------------------------
crash(4, 108)
for i in range(16):
    b, k, second = 4 + i, i % 8, i >= 8
    ch = CHORDS_A[k]
    pedal(b, ch, 84); bass(b, ch, 96 + (4 if second else 0)); timp(b, ch, 'q', 92)
    harp(b, ch, 76 + (4 if second else 0)); groove(b, 'B' if second else 'A', 1.0)
    if second:
        line(b, MEL_A[k], ['oboe', 'clarinet'], [98, 82], steps=[0, -2])
        choir(b, ch, 66 + (k // 4) * 8); choir(b, ch, 60, 'strings', 0)
    else:
        line(b, MEL_A[k], ['oboe'], [94])
        if k >= 4: choir(b, ch, 54 + (k - 4) * 4)
fill(11); crash(12, 100); fill(19, True)

# ---- Teil B 20–27 --------------------------------------------------------------------------
crash(20, 110); song.add('bell', song.bar(20), 3.8, nt('D5'), 90)
for i in range(8):
    b, ch = 20 + i, CHORDS_B[i]
    pedal(b, ch, 88); bass(b, ch, 100); timp(b, ch, 'q', 96)
    harp(b, ch, 74); harp(b, ch, 72, 'koto'); groove(b, 'B', 1.04)
    line(b, MEL_B[i], ['oboe', 'clarinet'], [98, 84], steps=[0, -2])
    choir(b, ch, 74 + (i // 4) * 6); choir(b, ch, 62, 'strings', 0)
fill(23); fill(27)

# ---- Aufruf 28–31 --------------------------------------------------------------------------
for i, ch in enumerate(['F#', 'G', 'F#', 'G']):
    b = 28 + i
    pedal(b, ch, 92); bass(b, ch, 104); timp(b, ch, 'q', 100)
    harp(b, ch, 80); harp(b, ch, 76, 'koto'); groove(b, 'C', 0.96 + i * 0.03)
    line(b, MEL_A[i], ['oboe', 'horns'], [100, 88], steps=[0, 0])
    choir(b, ch, 78 + i * 4); choir(b, ch, 68, 'strings', 0)
snare_roll(30, 2, 4, 60, 100); snare_roll(31, 0, 3.5, 80, 124); fill(31, True)

# ---- Höhepunkt C 32–47 ---------------------------------------------------------------------
crash(32, 118)
for i in range(16):
    b, k, second = 32 + i, i % 8, i >= 8
    ch = CHORDS_C[k]
    pedal(b, ch, 94); bass(b, ch, 106); timp(b, ch, 'q', 102)
    harp(b, ch, 82); harp(b, ch, 78, 'koto'); groove(b, 'C', 1.0 + (0.05 if second else 0))
    line(b, MEL_C[k], ['oboe', 'horns', 'clarinet'], [102, 90 + (6 if second else 0), 84], steps=[0, 0, -2 if not second else -3])
    choir(b, ch, 88 + (4 if second else 0)); choir(b, ch, 74, 'strings', 0)
    if k == 0 and i: crash(b, 112)
fill(35); fill(39); fill(43); fill(47, True)

# ---- Wiegen 48–51 -------------------------------------------------------------------------
crash(48, 104)
for i, ch in enumerate(['F#', 'G', 'F#', 'G']):
    b = 48 + i
    pedal(b, ch, 84); bass(b, ch, 84 + i * 4); timp(b, ch, 'heart', 96)
    groove(b, 'soft', 1.0 + i * 0.03); choir(b, ch, 70 + i * 6); choir(b, ch, 64, 'strings', 0)
    harp(b, ch, 62 + i * 4, 'koto')
    hi, lo = ('C#6', 'G4') if i % 2 == 0 else ('A#5', 'D5')                # Waagschalen
    song.add('bell', song.bar(b), 1.9, nt(hi), 96); song.add('bell', song.bar(b) + 2, 1.9, nt(lo), 96)
line(48, [(0, 4, 'F#5')], ['oboe'], [92]); line(49, [(0, 3, 'G5'), (3, 1, 'F#5')], ['oboe'], [96])
line(50, [(0, 2, 'C#5'), (2, 2, 'A#4')], ['oboe'], [98]); line(51, [(0, 3, 'B4'), (3, 1, 'G4')], ['oboe'], [100])
snare_roll(51, 2, 4, 60, 96)

# ---- Rückführung 52–55: hm G em G → Fis (Takt 0) --------------------------------------------
for i, ch in enumerate(['Bm', 'G', 'Em', 'G']):
    b = 52 + i
    pedal(b, ch, 92); bass(b, ch, 100 + i * 2); timp(b, ch, 'roll' if i == 3 else 'q', 100)
    harp(b, ch, 78 + i * 3); harp(b, ch, 74, 'koto'); groove(b, 'B' if i < 3 else 'A', 1.05)
    choir(b, ch, 76 + i * 4); choir(b, ch, 66, 'strings', 0)
line(52, MEL_B[0], ['oboe', 'horns'], [98, 84], steps=[0, 0]); line(53, MEL_B[1], ['oboe', 'horns'], [100, 86])
line(54, [(0, 1, 'E5'), (1, 1, 'D5'), (2, 1, 'B4'), (3, 1, 'G4')], ['oboe', 'horns'], [102, 88])
line(55, [(0, .5, 'G4'), (.5, .5, 'B4'), (1, .5, 'D5'), (1.5, .5, 'G5'), (2, 1, 'G5'), (3, 1, 'D5')], ['oboe'], [104])
fill(55, True)

sf2, out = cli_paths('bgm_theme_soulshards.ogg')
song.render(sf2, out)
