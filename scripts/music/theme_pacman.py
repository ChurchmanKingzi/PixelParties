# -*- coding: utf-8 -*-
"""Theme-Track „Curse of the Dunes“ (PACMAN) → public/music/bgm_theme_pacman.ogg

Wüsten-Verfolgungsjagd in d-Phrygisch-Dominant (Hijaz: D Es Fis G A B C), 134 BPM, 64 Takte
(114,6 s), nahtlos loopbar. Markenzeichen ist die übermäßige Sekunde Es→Fis. Darbuka-artige
Toms (Maqsum-Rhythmus) plus Kick/Clap/Kuhglocke treiben von Takt 1 an; Oud-Ostinato (Nylon-
gitarre) und Marimba jagen im 16tel-Lauf durch den Sand, die Oboe singt das Fluch-Motiv,
das Saxophon antwortet, im Höhepunkt kommen Chor (Mumien-Klage) und Blech-Hits dazu.

Aufbau (Takte, 0-basiert):
   0– 7  Intro          Darbuka + Oud-Ostinato + Bass, Marimba-Motiv, Oboen-Ruf ab Takt 4
   8–23  Thema A        Oboe: Fluch-Motiv (D Es Fis), Sax-Antwort, Akkordeon-Offbeats, Streicher
  24–39  Verfolgung B   Sax jagt in 8teln, Oboe darüber in hoher Lage, Bass steigt chromatisch
  40–55  Höhepunkt C    Oboe + Sax in Oktaven, Chor, Blech-Hits, Zweiunddreißigstel-Toms
  56–63  Rückführung D  Thema A leise in der Marimba, Wirbel, Dominant (A) → zurück zu Takt 0

Harmonie: D (Dur, Fis), Es (bII), g-Moll, c-Moll, A als Dominante; alle Melodietöne
liegen in der Hijaz-Skala (per Assert geprüft).
Aufruf:  python3 scripts/music/theme_pacman.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 134, 64                       # 64 × 4 × 60/134 = 114,6 s
song = Song(bpm=BPM, bars=BARS)
song.inst('bass',   'sbass',    100, 60)
song.inst('contra', 'contra',    80, 64)
song.inst('oud',    'guitar',    92, 42)   # Oud-Ostinato
song.inst('marimba','marimba',   90, 84)
song.inst('oboe',   'oboe',      98, 66)
song.inst('sax',    'sax',       88, 50)
song.inst('accord', 'accordion', 74, 76)
song.inst('strings','strings',   70, 30)
song.inst('choir',  'choir',     80, 64)
song.inst('brass',  'brass',     84, 58)
song.inst('hit',    'hit',       92, 64)
song.inst('timp',   'timp',      88, 64)

NAMES = {'C': C, 'D': D, 'E': E, 'F': F, 'G': G, 'A': A, 'B': B}
SCALE = {D, Eb, Gb, G, A, Bb, C}
def nt(s):
    pc = NAMES[s[0]]; i = 1
    if s[i] == '#': pc += 1; i += 1
    elif s[i] == 'b': pc -= 1; i += 1
    p = n(pc % 12, int(s[i:]))
    assert p % 12 in SCALE, f'Ton außerhalb Hijaz: {s}'
    return p

CH = {'D': (D, (0, 4, 7)), 'Eb': (Eb, (0, 4, 7)), 'Gm': (G, (0, 3, 7)), 'Cm': (C, (0, 3, 7)), 'A': (A, (0, 4, 7))}
def root(ch, o=2): return n(CH[ch][0], o)
def ramp(i, cnt, a, b): return a + (b - a) * i / max(1, cnt - 1)
def chord(ch, o): r = n(CH[ch][0], o); return [r + x for x in CH[ch][1]]

CH_A = ['D', 'D', 'Eb', 'D', 'Gm', 'Eb', 'Cm', 'D']
CH_B = ['D', 'Eb', 'D', 'Eb', 'Gm', 'Cm', 'Eb', 'A']
CH_C = ['D', 'Eb', 'Gm', 'D', 'Cm', 'Eb', 'A', 'D']

def line(b, notes, insts, vels, shift=0):
    for off, dur, p in notes:
        for inst, v in zip(insts, vels): song.add(inst, song.bar(b) + off, dur * 0.93, nt(p) + shift, v)

# ---- Begleitung -------------------------------------------------------------------------
def bass(b, ch, vel=100, kind='a'):
    s = song.bar(b); r = root(ch, 2)
    if kind == 'a':       # Achtel-Puls, Oktavsprung
        for i in range(8): song.add('bass', s + i * 0.5, 0.42, r + (12 if i % 4 == 3 else 0), vel + (8 if i % 4 == 0 else 0))
    else:                 # jagend: 8tel mit Halbton-Anschlag
        seq = [0, 0, 12, 0, 0, 7, 0, 1]
        for i, x in enumerate(seq): song.add('bass', s + i * 0.5, 0.42, r + x, vel + (8 if i % 4 == 0 else 0))
def pedal(b, ch, vel=78):
    p = root(ch, 1); song.add('contra', song.bar(b), 3.98, p if p >= 28 else p + 12, vel)

def oud(b, ch, vel=84, fast=True):
    """16tel-Ostinato: Grundton – Sekunde/Terz umspielt (Hijaz-Klang)."""
    s = song.bar(b); r = n(CH[ch][0], 3)
    third = CH[ch][1][1]
    cyc = [0, 7, third, 7, 12, 7, third, 7] if ch != 'D' else [0, 1, 4, 1, 7, 4, 1, 4]   # D: D Es Fis Es A Fis Es Fis
    if ch == 'D': cyc = [0, 1, 4, 1, 7, 4, 1, 0]
    step = 0.25 if fast else 0.5
    cnt = 16 if fast else 8
    for i in range(cnt):
        song.add('oud', s + i * step, step * 0.9, r + cyc[i % 8], vel + (10 if i % 4 == 0 else 0) - (6 if i % 2 else 0))

def marimba_pulse(b, ch, vel=80):
    s = song.bar(b); r = n(CH[ch][0], 4); t = r + CH[ch][1][1]
    for i, x in enumerate([r, t, r + 7, t]): song.add('marimba', s + 0.5 + i, 0.4, x, vel)

def accord(b, ch, vel=66):
    for off in (0.5, 1.5, 2.5, 3.5):
        for p in chord(ch, 4): song.add('accord', song.bar(b) + off, 0.4, p, vel)

def pad(b, ch, vel=60, inst='strings'):
    for p in chord(ch, 4): song.add(inst, song.bar(b), 3.98, p, vel)

def hit(b, beat, ch, vel=110, dur=0.9):
    r = n(CH[ch][0], 3)
    for p in (r - 12, r, r + 7, r + 12): song.add('hit', song.bar(b) + beat, dur, p, vel)

# ---- Darbuka / Schlagzeug ---------------------------------------------------------------
def groove(b, kind, v=1.0):
    s = song.bar(b)
    def d(off, note, vel): song.dr(s + off, note, min(127, vel * v))
    # Maqsum (D T . T D . T .) auf Achteln: Dum = tiefe Tom, Tek = Sidestick/hohe Tom
    for off, note, vel in ((0, TOM_L, 104), (0.5, TOM_H, 88), (1.5, TOM_H, 84), (2, TOM_L, 104), (3, TOM_H, 88)):
        d(off, note, vel)
    d(0, KICK, 112); d(2, KICK, 100)
    d(1, CLAP, 96); d(3, CLAP, 100)
    d(2.5, SIDESTICK, 86)
    if kind in ('B', 'C'):
        d(1, SNARE, 100); d(3, SNARE, 106); d(3.5, TOM_M, 90); d(1.75, SIDESTICK, 80)
        for i in range(4): d(i + 0.5, COWBELL, 60)
    if kind == 'C':
        d(0.75, KICK, 90); d(2.75, KICK, 92); d(3.75, TOM_HH, 94)
        for i in range(8): d(i * 0.5, HAT, 100 if i % 2 == 0 else 80)
    if kind == 'soft':
        d(1, SIDESTICK, 84); d(3, SIDESTICK, 88)
def fill(b, big=False):
    s = song.bar(b); TT = [TOM_H, TOM_HH, TOM_M, TOM_L]
    for i in range(8): song.dr(s + 2 + i * 0.25, TT[min(3, i // 2)], ramp(i, 8, 88, 118), 0.2)
    if big:
        for i in range(8): song.dr(s + 1 + i * 0.125, SNARE, ramp(i, 8, 70, 108), 0.1)
    song.dr(s + 3.75, KICK, 118)
def roll(b, start, end, v0, v1, note=TOM_H):
    s = song.bar(b) + start; cnt = int((end - start) * 4)
    for i in range(cnt): song.dr(s + i * 0.25, note, ramp(i, cnt, v0, v1), 0.15)
def crash(b, vel=112): song.dr(song.bar(b), CRASH, vel, 0.5)

# ---- Melodien (Hijaz) -------------------------------------------------------------------
# Fluch-Motiv: D–Es–Fis (übermäßige Sekunde) und zurück abwärts
M_A = [
    [(0, .5, 'D5'), (.5, .5, 'Eb5'), (1, 1, 'F#5'), (2, .5, 'Eb5'), (2.5, .5, 'D5'), (3, 1, 'C5')],
    [(0, .5, 'D5'), (.5, .5, 'Eb5'), (1, 1, 'F#5'), (2, 1, 'G5'), (3, 1, 'F#5')],
    [(0, 1, 'G5'), (1, .5, 'F#5'), (1.5, .5, 'Eb5'), (2, 1, 'D5'), (3, 1, 'Bb4')],
    [(0, .5, 'A4'), (.5, .5, 'Bb4'), (1, 1, 'D5'), (2, 2, 'A5')],
    [(0, 1, 'Bb5'), (1, .5, 'A5'), (1.5, .5, 'G5'), (2, 1, 'F#5'), (3, 1, 'Eb5')],
    [(0, 1, 'G5'), (1, .5, 'F#5'), (1.5, .5, 'Eb5'), (2, 1, 'D5'), (3, 1, 'Bb4')],
    [(0, 1, 'C5'), (1, 1, 'Eb5'), (2, 1, 'G5'), (3, 1, 'Eb5')],
    [(0, .5, 'D5'), (.5, .5, 'Eb5'), (1, 1, 'F#5'), (2, 2, 'D5')],
]
# Sax-Antwort: kurze fallende Figuren in den Lücken der Oboe (Beat 3–4)
S_A = [
    [(3.0, .5, 'F#4'), (3.5, .5, 'Eb4')], [(3.5, .5, 'D4')],
    [(3.5, .5, 'Bb3')], [],
    [(3.0, .5, 'Bb4'), (3.5, .5, 'G4')], [(3.5, .5, 'D4')],
    [(3.5, .5, 'G4')], [(3.0, .5, 'A4'), (3.5, .5, 'F#4')],
]
# Verfolgung B: Sax jagt in Achteln (auf-ab-Wellen), Oboe hoch mit langen Noten
def chase(b, ch, k):
    pcs = {'D': ['D4', 'Eb4', 'F#4', 'G4', 'A4', 'G4', 'F#4', 'Eb4'],
           'Eb': ['Eb4', 'F#4', 'G4', 'A4', 'Bb4', 'A4', 'G4', 'F#4'],
           'Gm': ['G4', 'A4', 'Bb4', 'C5', 'D5', 'C5', 'Bb4', 'A4'],
           'Cm': ['C4', 'D4', 'Eb4', 'G4', 'A4', 'G4', 'Eb4', 'D4'],
           'A':  ['A4', 'Bb4', 'C5', 'D5', 'Eb5', 'D5', 'C5', 'Bb4']}[ch]
    return [(i * 0.5, 0.5, p) for i, p in enumerate(pcs)]
O_B = [
    [(0, 2, 'A5'), (2, 1, 'F#5'), (3, 1, 'A5')], [(0, 2, 'G5'), (2, 1, 'Bb5'), (3, 1, 'G5')],
    [(0, 1.5, 'F#5'), (1.5, .5, 'A5'), (2, 2, 'D6')], [(0, 1, 'Eb6'), (1, 1, 'D6'), (2, 1, 'Bb5'), (3, 1, 'G5')],
    [(0, 2, 'D6'), (2, 1, 'C6'), (3, 1, 'Bb5')], [(0, 2, 'G5'), (2, 1, 'Eb5'), (3, 1, 'G5')],
    [(0, 1.5, 'Bb5'), (1.5, .5, 'G5'), (2, 2, 'Eb6')], [(0, .5, 'A5'), (.5, .5, 'Bb5'), (1, 1, 'C6'), (2, 2, 'D6')],
]
# Höhepunkt C: breite Melodie, Oboe + Sax in Oktaven
M_C = [
    [(0, 1, 'D5'), (1, .5, 'Eb5'), (1.5, .5, 'F#5'), (2, 1, 'A5'), (3, 1, 'D6')],
    [(0, 1, 'Eb6'), (1, .5, 'D6'), (1.5, .5, 'Bb5'), (2, 1, 'G5'), (3, 1, 'Bb5')],
    [(0, 1, 'G5'), (1, .5, 'A5'), (1.5, .5, 'Bb5'), (2, 1, 'D6'), (3, 1, 'C6')],
    [(0, 1.5, 'A5'), (1.5, .5, 'F#5'), (2, 1, 'Eb5'), (3, 1, 'D5')],
    [(0, 1, 'C6'), (1, .5, 'Bb5'), (1.5, .5, 'G5'), (2, 1, 'Eb5'), (3, 1, 'G5')],
    [(0, 1, 'Bb5'), (1, .5, 'G5'), (1.5, .5, 'Eb5'), (2, 1, 'G5'), (3, 1, 'Bb5')],
    [(0, .5, 'A5'), (.5, .5, 'Bb5'), (1, .5, 'C6'), (1.5, .5, 'D6'), (2, 1, 'Eb6'), (3, 1, 'D6')],
    [(0, 3, 'D6'), (3, 1, 'A5')],
]

# ==== Arrangement ==========================================================================
# ---- Intro (0–7) ------------------------------------------------------------------------
CH_I = ['D', 'D', 'Eb', 'D', 'D', 'Eb', 'D', 'A']
hit(0, 0, 'D', 112, 1.2); crash(0, 104)
for i, ch in enumerate(CH_I):
    b = i
    groove(b, 'soft' if i < 2 else 'A', 1.0 + i * 0.02)
    oud(b, ch, 74 + i * 3, True)
    bass(b, ch, 88 + i * 2, 'a'); pedal(b, ch, 70 + i * 2)
    if i >= 2: marimba_pulse(b, ch, 70 + i * 3)
    if i >= 4: pad(b, ch, 50 + (i - 4) * 6)
line(4, [(0, .5, 'D5'), (.5, .5, 'Eb5'), (1, 1, 'F#5'), (2, 2, 'D5')], ['oboe'], [84])
line(5, [(0, .5, 'D5'), (.5, .5, 'Eb5'), (1, 1, 'F#5'), (2, 2, 'G5')], ['oboe'], [90])
line(6, [(0, .5, 'G5'), (.5, .5, 'F#5'), (1, 1, 'Eb5'), (2, 2, 'D5')], ['oboe'], [94])
line(7, [(0, .5, 'A4'), (.5, .5, 'Bb4'), (1, .5, 'C5'), (1.5, .5, 'D5'), (2, .5, 'Eb5'), (2.5, .5, 'F#5'), (3, 1, 'A5')], ['oboe'], [100])
fill(3); roll(6, 2, 4, 70, 100, TOM_M); fill(7, True)

# ---- Thema A (8–23) ---------------------------------------------------------------------
hit(8, 0, 'D', 108, 0.8); crash(8, 110)
for i in range(16):
    b, k = 8 + i, i % 8; ch = CH_A[k]; second = i >= 8
    groove(b, 'B' if second else 'A', 1.0 + (0.04 if second else 0))
    oud(b, ch, 84 + (4 if second else 0), True)
    bass(b, ch, 96, 'a'); pedal(b, ch, 78)
    accord(b, ch, 62 + (8 if second else 0))
    pad(b, ch, 58 + (8 if second else 0))
    line(b, M_A[k], ['oboe'] + (['sax'] if second else []), [98, 70])
    line(b, S_A[k], ['sax'], [84])
    if k in (0, 2, 4, 6) and not second: marimba_pulse(b, ch, 66)
fill(15); crash(16, 104); roll(22, 2, 4, 70, 106, TOM_M); fill(23, True)

# ---- Verfolgung B (24–39) ---------------------------------------------------------------
hit(24, 0, 'D', 112, 0.9); crash(24, 112); hit(32, 0, 'Gm', 112, 0.9); crash(32, 112)
for i in range(16):
    b, k = 24 + i, i % 8; ch = CH_B[k]; second = i >= 8
    groove(b, 'B', 1.05 if second else 1.0)
    oud(b, ch, 90, True)
    bass(b, ch, 100, 'b'); pedal(b, ch, 82)
    marimba_pulse(b, ch, 76)
    line(b, chase(b, ch, k), ['sax'] + (['marimba'] if second else []), [90, 74], shift=(12 if second else 0))
    line(b, O_B[k], ['oboe'] + (['brass'] if second else []), [98, 70])
    pad(b, ch, 66); accord(b, ch, 64)
    if second and k % 4 == 3: fill(b)
fill(27); fill(31); roll(38, 0, 4, 60, 108, TOM_H); roll(39, 0, 3, 90, 125, SNARE); fill(39, True)

# ---- Höhepunkt C (40–55) ----------------------------------------------------------------
hit(40, 0, 'D', 122, 1.2); crash(40, 118); hit(48, 0, 'D', 118, 0.9); crash(48, 116)
for i in range(16):
    b, k = 40 + i, i % 8; ch = CH_C[k]; second = i >= 8
    groove(b, 'C', 1.0 + (0.05 if second else 0))
    oud(b, ch, 92, True)
    bass(b, ch, 104, 'b'); pedal(b, ch, 88)
    line(b, M_C[k], ['oboe', 'sax', 'brass'], [100, 88, 72], shift=0)
    line(b, M_C[k], ['sax'], [0]) if False else None
    choir(b, ch, 0) if False else None
    for p in chord(ch, 4): song.add('choir', song.bar(b), 3.98, p + 12 if CH[ch][0] >= 5 else p, 84)
    accord(b, ch, 66); marimba_pulse(b, ch, 78)
    if k in (0, 4): crash(b, 100)
    if not second: song.add('timp', song.bar(b), 0.5, root(ch, 2), 96); song.add('timp', song.bar(b) + 2, 0.5, root(ch, 2), 92)
fill(43); fill(47); fill(51)
roll(54, 0, 4, 70, 112, TOM_H); roll(55, 0, 3, 100, 127, SNARE); fill(55, True)

# ---- Rückführung D (56–63) --------------------------------------------------------------
crash(56, 100)
CH_D = ['D', 'D', 'Eb', 'D', 'Gm', 'Eb', 'A', 'A']
for i, ch in enumerate(CH_D):
    b = 56 + i
    groove(b, 'B' if i >= 4 else 'A', 0.95 + i * 0.02)
    oud(b, ch, 78 + i * 2, True)
    bass(b, ch, 92 + i * 2, 'a' if i < 4 else 'b'); pedal(b, ch, 74 + i * 2)
    marimba_pulse(b, ch, 70)
    pad(b, ch, 54 + i * 4)
    if i < 6: line(b, M_A[i], ['marimba'], [86])
    if i >= 4: accord(b, ch, 60 + i * 2)
line(62, [(0, .5, 'A4'), (.5, .5, 'Bb4'), (1, .5, 'C5'), (1.5, .5, 'D5'), (2, 1, 'Eb5'), (3, 1, 'D5')], ['oboe'], [96])
line(63, [(0, .5, 'A4'), (.5, .5, 'Bb4'), (1, .5, 'C5'), (1.5, .5, 'D5'), (2, .5, 'Eb5'), (2.5, .5, 'F#5'), (3, 1, 'A5')], ['oboe'], [104])
roll(62, 2, 4, 70, 104, TOM_M); fill(63, True)

sf2, out = cli_paths('bgm_theme_pacman.ogg')
song.render(sf2, out)
