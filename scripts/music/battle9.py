# -*- coding: utf-8 -*-
"""Battle-Track 9 „Episches Finale“ → public/music/bgm_battle9.ogg

Großes Orchester-Endkampf-Thema in c-Moll, 144 BPM, 72 Takte (120,0 s), nahtlos loopbar.
Chor auf großen Akkorden, treibende Streicher-Ostinati, Blech (Trompete/Posaune/Hörner),
Pauken und Orchester-Hits. Das Schicksalsmotiv (kurz-kurz-kurz-lang, z. B. G-G-G-Es) liegt
als Bassfigur unter dem ganzen Stück und ist zugleich der Kern der Hauptmelodie.

Aufbau (Takte, 0-basiert):
   0– 7  Intro          Paukenwirbel, Tremolo-Streicher, Schicksalsmotiv im Bass, Trompetenruf
   8–23  Thema A        Trompete: Motiv als steigende Sequenz + Antwortphrase, Hörner-Gegenstimme,
                        ab Takt 16 Blech verdoppelt und 16tel-Ostinato, Chor baut sich auf
  24–39  Steigerung B   Wurzeln steigen stufenweise (c-des-es-f-g-as-b), Melodie steigt mit,
                        Gegenstimme fällt; zweiter Durchgang mit Chor, engerem Motiv und Blech
  40–55  Höhepunkt C    Hymne (Trompete + Blech + Chor), Posaune/Bass mit Schicksalsmotiv
  56–63  Rückblick D    leise Wiederkehr von Thema A in den Hörnern, Tremolo-Crescendo
  64–71  Rückführung E  Dominant-Orgelpunkt auf g, Wirbel, Motiv-Ruf → Sprung zurück auf Takt 0

Harmonie: c-Moll mit Neapolitaner (Des) und Dur-Dominante (G, Leitton h). Der Loop endet
bewusst auf der Dominante (Halbschluss) – es gibt keine Schlusskadenz.
Aufruf:  python3 scripts/music/battle9.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 144, 72                       # 72 × 4 × 60/144 = 120,0 s
song = Song(bpm=BPM, bars=BARS)

# ---- Stimmen (Name, Instrument, Lautstärke, Panorama) -------------------------------
song.inst('contra',  'contra',  84, 64)   # Orgelpunkt, tiefste Lage
song.inst('bass',    'bass2',   96, 62)   # Schicksalsmotiv
song.inst('timp',    'timp',    98, 64)
song.inst('strings', 'strings', 80, 44)   # Ostinato
song.inst('tremolo', 'tremolo', 72, 84)   # Flächen, Swells
song.inst('horns',   'horns',   86, 38)   # Gegenstimme / Stabs
song.inst('trombone','trombone',88, 80)   # Motiv im Bass-Tenor
song.inst('trumpet', 'trumpet', 88, 70)   # Melodie
song.inst('brass',   'brass',   82, 56)   # Melodie-Verdopplung
song.inst('choir',   'choir',   84, 64)   # große Akkorde
song.inst('hit',     'hit',    100, 64)   # Orchester-Hits

# ---- Notennamen und Akkorde ----------------------------------------------------------
NAMES = {'C': C, 'Db': Db, 'D': D, 'Eb': Eb, 'E': E, 'F': F, 'Gb': Gb, 'G': G, 'Ab': Ab, 'A': A, 'Bb': Bb, 'B': B}
def nt(s): return n(NAMES[s[:-1]], int(s[-1]))          # 'Eb5' → MIDI

# Akkord → (Grundton, Terz-Intervall)
CH = {'Cm': (C, 3), 'Db': (Db, 4), 'Eb': (Eb, 4), 'Fm': (F, 3), 'G': (G, 4), 'Ab': (Ab, 4), 'Bb': (Bb, 4)}
# Zielton der langen Schicksalsmotiv-Note (fällt eine Terz/Quarte unter den Grundton)
FATE_LONG = {'Cm': 32, 'Ab': 41, 'Eb': 36, 'Bb': 43, 'Fm': 37, 'G': 38, 'Db': 32}
def rootb(ch): return 36 + CH[ch][0]                     # Bass-Grundton, Oktave 2 (36–47)
def contra_p(ch):                                        # Kontrabass: Oktave 1–2
    p = rootb(ch); return p - 12 if p - 12 >= 28 else p
def r3(ch):                                              # Grundton der Mittellage (43–54)
    pc = CH[ch][0]; return 48 + pc if pc <= 6 else 36 + pc
def third(ch): return CH[ch][1]
def ramp(i, cnt, a, b): return a + (b - a) * i / max(1, cnt - 1)

# ---- Bausteine Harmonie/Rhythmus ------------------------------------------------------
def fate(b, ch, inst='bass', shift=0, vel=100):
    """Schicksalsmotiv: drei Achtel auf dem Grundton, dann lange Note (Terz darunter)."""
    s = song.bar(b); r = rootb(ch) + shift
    for off in (0, 0.5, 1): song.add(inst, s + off, 0.42, r, vel + (10 if off == 0 else 0))
    song.add(inst, s + 1.5, 2.3, FATE_LONG[ch] + shift, vel + 4)

def pedal(b, ch, vel=80): song.add('contra', song.bar(b), 3.98, contra_p(ch), vel)

def timp(b, ch, kind='q', vel=98, v1=None):
    s = song.bar(b); p = rootb(ch)
    if kind == 'q':
        for off in (0, 2): song.add('timp', s + off, 0.5, p, vel)
    elif kind == 'gallop':
        for off, v in ((0, 0), (1, -6), (1.5, -12), (2, -2), (3, -6), (3.5, -12)): song.add('timp', s + off, 0.4, p, vel + v)
    elif kind == 'roll':
        for i in range(16): song.add('timp', s + i * 0.25, 0.25, p, ramp(i, 16, vel, v1 if v1 else vel))

def ostinato(b, ch, level, vel=72):
    """Streicher-Ostinato: Stufe 1 = Achtel (Grundton/Quinte/Oktave), Stufe 2 = 16tel mit Terz."""
    s = song.bar(b); r = r3(ch); t = r + third(ch)
    if level == 1: cyc, step, cnt = [r, r + 7, r + 12, r + 7], 0.5, 8
    else: cyc, step, cnt = [r, r + 7, t, r + 7], 0.25, 16
    for i in range(cnt): song.add('strings', s + i * step, step * 0.85, cyc[i % 4], vel + (10 if i % 4 == 0 else 0))

def tremolo(b, ch, vel=70):
    r = r3(ch) + 12
    for p in (r, r + third(ch), r + 7): song.add('tremolo', song.bar(b), 3.98, p, vel)

def choir(b, ch, vel=80):
    r = r3(ch) + 12
    for p in (r, r + third(ch), r + 7): song.add('choir', song.bar(b), 3.98, p, vel)

def horn_stabs(b, ch, vel=84):
    r = r3(ch)
    for off in (0, 1.5, 3):
        for p in (r + 7, r + 12 + third(ch)): song.add('horns', song.bar(b) + off, 0.8, p, vel + (8 if off == 0 else 0))

def hit(b, beat, ch, vel=110, dur=0.9):
    r = r3(ch) + 12
    for p in (r - 12, r, r + 7, r + 12): song.add('hit', song.bar(b) + beat, dur, p, vel)

def line(b, notes, insts, vels, shift=0):
    """Melodiezeile eines Taktes: notes = [(beat, dauer, 'Eb5'), …]; insts parallel zu vels."""
    for off, dur, p in notes:
        for inst, v in zip(insts, vels): song.add(inst, song.bar(b) + off, dur * 0.94, nt(p) + shift, v)

# ---- Schlagzeug -----------------------------------------------------------------------
TOMS = [TOM_H, TOM_HH, TOM_M, TOM_L]
def groove(b, kind, v=1.0):
    s = song.bar(b)
    def d(off, note, vel): song.dr(s + off, note, vel * v)
    if kind == 'A':
        for off, vel in ((0, 112), (2, 100), (2.75, 86)): d(off, KICK, vel)
        d(1, SNARE, 106); d(3, SNARE, 108)
        for i in range(8): d(i * 0.5, HAT, 62 if i % 2 == 0 else 46)
    elif kind == 'B':
        for off, vel in ((0, 114), (1, 96), (2, 104), (2.75, 90)): d(off, KICK, vel)
        d(1, SNARE, 108); d(3, SNARE, 112); d(3, CLAP, 80)
        for i in range(8): d(i * 0.5, HAT, 68 if i % 2 == 0 else 50)
        d(3.5, OHAT, 74)
    elif kind == 'C':
        for off, vel in ((0, 118), (1.5, 96), (2, 108), (3.5, 100)): d(off, KICK, vel)
        d(1, SNARE, 114); d(3, SNARE, 116); d(1, CLAP, 84); d(3, CLAP, 88)
        for i in range(8): d(i * 0.5, RIDE, 74 if i % 2 == 0 else 56)
        d(2.5, TOM_M, 90); d(3.75, TOM_L, 92)
    elif kind == 'soft':
        d(0, KICK, 84); d(2, KICK, 76); d(1, SIDESTICK, 74); d(3, SIDESTICK, 78)
        for i in range(8): d(i * 0.5, HAT, 52 if i % 2 == 0 else 40)

def fill(b, big=False, crash_next=True):
    """Tom-Fill in der zweiten Takthälfte (big: Snare-Wirbel in der ersten + Toms in der zweiten)."""
    s = song.bar(b)
    if big:
        for i in range(8): song.dr(s + 1.5 + i * 0.125 * 2, SNARE, ramp(i, 8, 70, 112), 0.12)
    for i in range(8): song.dr(s + 2.0 + i * 0.25 if not big else s + 2.5 + i * 0.1875,
                               TOMS[min(3, i // 2)], ramp(i, 8, 90, 118), 0.2)
    song.dr(s + 3.75 if big else s + 3.75, KICK, 118)

def snare_roll(b, start, end, v0, v1):
    s = song.bar(b) + start; cnt = int((end - start) * 4)
    for i in range(cnt): song.dr(s + i * 0.25, SNARE, ramp(i, cnt, v0, v1), 0.15)

def crash(b, vel=112): song.dr(song.bar(b), CRASH, vel, 0.5)

# ---- Melodien -------------------------------------------------------------------------
def motif(short, long_, tight=False):
    """Schicksalsmotiv als Melodietakt: 3 kurze + 1 lange Note (tight = engere Fassung)."""
    st = 0.25 if tight else 0.5
    return [(0, st, short), (st, st, short), (2 * st, st, short), (3 * st if tight else 1.5, 2.6 if tight else 2.3, long_)]

# Thema A: 8 Takte über Cm Ab Eb Bb | Fm Cm G G
CHORDS_A = ['Cm', 'Ab', 'Eb', 'Bb', 'Fm', 'Cm', 'G', 'G']
MEL_A = [
    motif('G4', 'Eb5'), motif('Ab4', 'F5'), motif('Bb4', 'G5'), motif('D5', 'F5'),
    [(0, 2, 'Ab5'), (2, 1, 'G5'), (3, 1, 'F5')],
    [(0, 1.5, 'Eb5'), (1.5, 0.5, 'D5'), (2, 1, 'C5'), (3, 1, 'Eb5')],
    [(0, 1, 'D5'), (1, 1, 'B4'), (2, 1, 'G4'), (3, 1, 'B4')],
    [(0, 1, 'D5'), (1, 1, 'F5'), (2, 1, 'D5'), (3, 1, 'B4')],
]
# Gegenstimme (Hörner): zwei Halbe pro Takt
CTR_A = [('Eb4', 'D4'), ('C4', 'Eb4'), ('Bb3', 'Eb4'), ('D4', 'F4'), ('C4', 'F4'), ('G3', 'C4'), ('B3', 'D4'), ('F4', 'D4')]

# Steigerung B: Wurzeln steigen c-des-es-f-g-as-b-g
CHORDS_B = ['Cm', 'Db', 'Eb', 'Fm', 'G', 'Ab', 'Bb', 'G']
SEQ_B = [('G4', 'Eb5'), ('Ab4', 'F5'), ('Bb4', 'G5'), ('C5', 'Ab5'), ('D5', 'G5'), ('Eb5', 'Ab5'), ('F5', 'Bb5')]
MEL_B_END = [(0, 1, 'D5'), (1, 1, 'F5'), (2, 1, 'D5'), (3, 1, 'B4')]
CTR_B = ['Eb4', 'Db4', 'Bb3', 'Ab3', 'G3', 'Eb3', 'D3', 'D4']    # fallende Gegenstimme (ganze Noten)

# Höhepunkt C: Hymne, zweimal 8 Takte
CHORDS_C1 = ['Cm', 'Ab', 'Eb', 'Bb', 'Fm', 'Db', 'G', 'G']
MEL_C1 = [
    [(0, 1, 'G4'), (1, 1, 'C5'), (2, 1.5, 'Eb5'), (3.5, 0.5, 'D5')],
    [(0, 1, 'C5'), (1, 1, 'Eb5'), (2, 1.5, 'Ab5'), (3.5, 0.5, 'G5')],
    [(0, 1, 'Bb4'), (1, 1, 'Eb5'), (2, 1.5, 'G5'), (3.5, 0.5, 'F5')],
    [(0, 1, 'D5'), (1, 1, 'F5'), (2, 2, 'Bb5')],
    [(0, 1.5, 'Ab5'), (1.5, 0.5, 'G5'), (2, 1, 'F5'), (3, 1, 'C5')],
    [(0, 1.5, 'Db5'), (1.5, 0.5, 'F5'), (2, 1, 'Ab5'), (3, 1, 'F5')],
    [(0, 1, 'G5'), (1, 1, 'F5'), (2, 1, 'D5'), (3, 1, 'B4')],
    [(0, 1.5, 'B4'), (1.5, 0.5, 'C5'), (2, 1, 'D5'), (3, 1, 'G4')],
]
CHORDS_C2 = ['Cm', 'Ab', 'Fm', 'Db', 'Eb', 'Bb', 'G', 'G']
MEL_C2 = [
    [(0, 1, 'G4'), (1, 1, 'C5'), (2, 1, 'Eb5'), (3, 1, 'G5')],
    [(0, 1, 'C5'), (1, 1, 'Eb5'), (2, 2, 'Ab5')],
    [(0, 1, 'C5'), (1, 1, 'F5'), (2, 1.5, 'Ab5'), (3.5, 0.5, 'G5')],
    [(0, 1, 'Db5'), (1, 1, 'F5'), (2, 2, 'Ab5')],
    [(0, 1, 'G5'), (1, 1, 'Bb5'), (2, 1.5, 'G5'), (3.5, 0.5, 'F5')],
    [(0, 1, 'D5'), (1, 1, 'F5'), (2, 2, 'Bb5')],
    motif('D5', 'B4'),
    [(0, 3, 'D5'), (3, 1, 'B4')],
]

# ==== Arrangement =========================================================================
# ---- Intro (0–7): Cm Cm Ab Ab Fm Fm G G ------------------------------------------------
CHORDS_I = ['Cm', 'Cm', 'Ab', 'Ab', 'Fm', 'Fm', 'G', 'G']
for i, ch in enumerate(CHORDS_I):
    b = i
    pedal(b, ch, 68 + i * 3)
    tremolo(b, ch, 50 + (i % 4) * 12 + (10 if i >= 4 else 0))
    if b < 4: timp(b, ch, 'roll', 44 + b * 6, 70 + b * 6)
    else: timp(b, ch, 'q', 84 + (b - 4) * 4)
    if b >= 2: fate(b, ch, 'bass', 0, 74 + b * 3)
    if b >= 4:
        fate(b, ch, 'trombone', 12, 76 + (b - 4) * 3)
        ostinato(b, ch, 1, 58 + (b - 4) * 6)
        groove(b, 'soft', 0.9 + (b - 4) * 0.05)
hit(0, 0, 'Cm', 118, 1.6); crash(0, 108)
line(6, motif('D5', 'B4'), ['trumpet'], [90])
line(7, motif('D5', 'G4'), ['trumpet'], [96])
snare_roll(6, 2, 4, 50, 92); fill(6)
snare_roll(7, 0, 3.5, 70, 124); fill(7, big=True)

# ---- Thema A (8–23) ---------------------------------------------------------------------
hit(8, 0, 'Cm', 108, 0.8); crash(8, 112)
for i in range(16):
    b, k = 8 + i, i % 8
    ch = CHORDS_A[k]; second = i >= 8
    pedal(b, ch, 80 + (4 if second else 0))
    fate(b, ch, 'bass', 0, 96 if not second else 100)
    timp(b, ch, 'q', 94 + (4 if second else 0))
    ostinato(b, ch, 2 if second else 1, 66 if not second else 74)
    groove(b, 'A', 1.0 if not second else 1.05)
    line(b, MEL_A[k], ['trumpet'] + (['brass'] if second else []), [88, 74] if not second else [94, 80])
    for j, p in enumerate(CTR_A[k]): song.add('horns', song.bar(b) + j * 2, 1.95, nt(p), 76 + (6 if second else 0))
    if second and k >= 4: choir(b, ch, 56 + (k - 4) * 8)
    if second and k >= 4: fate(b, ch, 'trombone', 12, 78)
fill(15); crash(16, 104)
snare_roll(22, 2, 4, 60, 100); snare_roll(23, 0, 3, 80, 124); fill(23, big=True)

# ---- Steigerung B (24–39) ---------------------------------------------------------------
hit(24, 0, 'Cm', 112, 0.9); crash(24, 114); hit(32, 0, 'Cm', 116, 0.9); crash(32, 116)
for i in range(16):
    b, k = 24 + i, i % 8
    ch = CHORDS_B[k]; second = i >= 8
    pedal(b, ch, 86 + (4 if second else 0))
    fate(b, ch, 'bass', 0, 100 + (4 if second else 0))
    timp(b, ch, 'gallop', 96 + (4 if second else 0))
    ostinato(b, ch, 2, 76 + (6 if second else 0))
    groove(b, 'B', 1.0 if not second else 1.06)
    if k < 7: notes = motif(*SEQ_B[k], tight=second)
    else: notes = MEL_B_END
    line(b, notes, ['trumpet'] + (['brass'] if second else []), [92, 80] if second else [92])
    if not second:                                             # fallende Gegenstimme
        song.add('horns', song.bar(b), 3.95, nt(CTR_B[k]), 80)
        if k >= 4: choir(b, ch, 58 + (k - 4) * 6)
    else:
        choir(b, ch, 82 + (k // 4) * 4)
        fate(b, ch, 'trombone', 12, 86)
        song.add('horns', song.bar(b), 3.95, nt(CTR_B[k]), 82)
fill(31); fill(35)
snare_roll(38, 0, 4, 60, 100); snare_roll(39, 0, 3, 90, 127); fill(39, big=True)

# ---- Höhepunkt C (40–55) ----------------------------------------------------------------
hit(40, 0, 'Cm', 122, 1.2); crash(40, 120); hit(48, 0, 'Cm', 118, 0.9); crash(48, 118)
for i in range(16):
    b, k = 40 + i, i % 8
    ch = (CHORDS_C1 if i < 8 else CHORDS_C2)[k]
    mel = (MEL_C1 if i < 8 else MEL_C2)[k]
    v = 1.0 if i < 8 else 1.05
    pedal(b, ch, 92)
    fate(b, ch, 'bass', 0, 106)
    fate(b, ch, 'trombone', 12, 92)
    timp(b, ch, 'gallop', 102)
    ostinato(b, ch, 2, 84)
    groove(b, 'C', v)
    choir(b, ch, 88 + (4 if i >= 8 else 0))
    horn_stabs(b, ch, 78)
    line(b, mel, ['trumpet', 'brass'], [100, 88])
    if k % 4 == 0 and b not in (40, 48): crash(b, 100)
fill(43); fill(47); fill(51)
snare_roll(54, 0, 4, 70, 110); snare_roll(55, 0, 3, 100, 127); fill(55, big=True)

# ---- Rückblick D (56–63): leise Wiederkehr von Thema A ----------------------------------
crash(56, 96)
for i in range(8):
    b = 56 + i; ch = CHORDS_A[i]
    pedal(b, ch, 74)
    fate(b, ch, 'bass', 0, 82)
    timp(b, ch, 'q', 80)
    ostinato(b, ch, 1, 56 + i * 2)
    tremolo(b, ch, 56 + i * 5)
    groove(b, 'soft', 1.0)
    line(b, MEL_A[i], ['horns'], [76 + i])
    if i >= 4: choir(b, ch, 54 + (i - 4) * 8)
fill(63)

# ---- Rückführung E (64–71): Dominant-Orgelpunkt, Aufbau, Sprung zum Intro --------------
hit(64, 0, 'Fm', 112, 0.9); crash(64, 108)
CHORDS_E = ['Fm', 'Fm', 'Db', 'Db', 'G', 'G', 'G', 'G']
for i, ch in enumerate(CHORDS_E):
    b = 64 + i
    pedal(b, ch, 84 + i * 2)
    fate(b, ch, 'bass', 0, 92 + i * 2)
    fate(b, ch, 'trombone', 12, 80 + i * 3)
    timp(b, ch, 'gallop' if i < 4 else 'roll', 94 + i, 120 if i >= 4 else None)
    ostinato(b, ch, 2, 70 + i * 4)
    tremolo(b, ch, 60 + i * 6)
    if i < 4: groove(b, 'B', 0.9 + i * 0.03)
    else: snare_roll(b, 0, 4, 55 + (i - 4) * 12, 85 + (i - 4) * 14)
    if i >= 2: choir(b, ch, 60 + i * 4)
line(68, motif('D5', 'B4'), ['trumpet', 'brass'], [92, 76])
line(70, motif('D5', 'B4'), ['trumpet', 'brass'], [98, 82])
line(71, [(0, 0.25, 'G4'), (0.25, 0.25, 'B4'), (0.5, 0.25, 'D5'), (0.75, 0.25, 'G5'), (1, 1, 'B5'), (2, 1.6, 'D5')],
     ['trumpet'], [104])
fill(67); fill(71, big=True)

# ---- Rendern ----------------------------------------------------------------------------
sf2, out = cli_paths('bgm_battle9.ogg')
song.render(sf2, out)
