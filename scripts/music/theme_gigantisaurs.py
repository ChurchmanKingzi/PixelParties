# -*- coding: utf-8 -*-
"""Battle-Track „Stampede of Giants“ (Gigantisaurs) → public/music/bgm_theme_gigantisaurs.ogg

Dinosaurier-Ansturm in h-Moll (phrygisch: B C D E F# G A), 100 BPM im Halbzeit-Feel,
48 Takte (115,2 s), nahtlos loopbar. Massive Toms/Pauken stampfen, ein Erdbeben-Kontrabass
liegt darunter, Tuba/Posaune/Fagott brüllen das Hauptmotiv (lang-kurz-lang, primitiv, in Quinten
und Grundtönen, bewusst ohne Terzen im Bass). Kleine Raubsaurier (Raptoren) hetzen als
Marimba-16tel, Pteranos kreischt als fallende Flötenläufe, König Trex brüllt im Höhepunkt
mit Blech und Chor.

Aufbau (Takte, 0-basiert):
   0– 7  Intro     Stampfen (Toms/Pauke), Erdbeben-Bass, ab Takt 4 Fagott mit dem Brüll-Motiv
   8–19  Thema A   Tuba+Posaune mit dem Hauptthema, Fagott-Stöße, Hörner-Antwort, Ankylos-Schlussphrase
  20–31  Jagd B    Raptoren-Marimba in 16teln, Pteranos-Flöte (fallende Läufe), Toms in Achteln
  32–43  Trex C    König Trex: Trompete/Horn/Posaune/Tuba + Chor, Galopp-Pauke, Orchester-Hits
  44–47  Zurück D  Stampfen wird leiser, Fagott-Motiv, Dominant F# → Sprung zurück auf Takt 0

Aufruf:  python3 scripts/music/theme_gigantisaurs.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 100, 48                       # 48 × 4 × 60/100 = 115,2 s
song = Song(bpm=BPM, bars=BARS)

song.inst('contra',   'contra',   100, 64)   # Erdbeben
song.inst('bass',     'bass2',     92, 60)   # Stampf-Riff
song.inst('timp',     'timp',     104, 64)
song.inst('tuba',     'tuba',      96, 58)
song.inst('trombone', 'trombone',  90, 76)
song.inst('bassoon',  'bassoon',   92, 46)
song.inst('horns',    'horns',     86, 40)
song.inst('brass',    'brass',     84, 68)
song.inst('trumpet',  'trumpet',   84, 84)
song.inst('marimba',  'marimba',   88, 90)   # Raptoren
song.inst('flute',    'flute',     80, 30)   # Pteranos
song.inst('choir',    'choir',     82, 64)
song.inst('hit',      'hit',       98, 64)

NAMES = {'C': C, 'C#': Db, 'Db': Db, 'D': D, 'Eb': Eb, 'E': E, 'F': F, 'F#': Gb, 'G': G, 'G#': Ab, 'Ab': Ab, 'A': A, 'Bb': Bb, 'B': B}
def nt(s): return n(NAMES[s[:-1]], int(s[-1]))
SCALE = {B, C, D, E, Gb, G, A}            # h-phrygisch

# Akkord → (Grundton, Terz-Intervall oder None = Kraftakkord)
CH = {'Bm': (B, 3), 'C': (C, 4), 'D': (D, 4), 'Em': (E, 3), 'Am': (A, 3), 'G': (G, 4), 'F#': (Gb, None)}
def rootb(ch): return 36 + CH[ch][0]
def rootc(ch):
    p = 24 + CH[ch][0]; return p + 12 if p < 28 else p
def tri(ch):                                # Mittellage (Oktave 3)
    r, t = 48 + CH[ch][0], CH[ch][1]
    return [r, r + (t if t else 7), r + 7]
def ramp(i, cnt, a, b): return a + (b - a) * i / max(1, cnt - 1)

def line(b, notes, insts, vels, shift=0):
    for off, dur, p in notes:
        assert NAMES[p[:-1]] in SCALE, p
        for inst, v in zip(insts, vels): song.add(inst, song.bar(b) + off, dur * 0.94, nt(p) + shift, v)

# ---- Bausteine ---------------------------------------------------------------------------
def pedal(b, ch, vel=96): song.add('contra', song.bar(b), 3.98, rootc(ch), vel)

def riff(b, ch, vel=92):
    """primitives Stampf-Riff: Grundton lang-kurz, Achtelstoß, Quinte am Ende"""
    s, r = song.bar(b), rootb(ch)
    for off, dur, p, v in ((0, 0.7, r, 8), (0.75, 0.25, r, -8), (1.5, 0.5, r, 0), (2, 0.7, r, 6), (2.75, 0.25, r, -8), (3.5, 0.5, r + 7, 0)):
        song.add('bass', s + off, dur, p, vel + v)

def timp(b, ch, kind='q', vel=100):
    s, p = song.bar(b), rootb(ch) + 0
    if kind == 'q':
        for off in (0, 1.5, 2): song.add('timp', s + off, 0.5, p, vel + (6 if off == 0 else 0))
    elif kind == 'gallop':
        for off, v in ((0, 6), (0.75, -10), (1, -4), (1.5, -6), (2, 4), (2.75, -10), (3, -4), (3.5, -6)): song.add('timp', s + off, 0.35, p, vel + v)
    elif kind == 'roll':
        for i in range(16): song.add('timp', s + i * 0.25, 0.25, p, ramp(i, 16, vel - 40, vel))

def choir(b, ch, vel=80):
    t = [x + 12 for x in tri(ch)]
    for p in t: song.add('choir', song.bar(b), 3.98, p, vel)

def hit(b, beat, ch, vel=110, dur=1.2):
    for p in [x for x in tri(ch)] + [tri(ch)[0] + 12]: song.add('hit', song.bar(b) + beat, dur, p, vel)

def marimba(b, ch, vel=82):
    """Raptoren: 16tel-Zyklus Grundton–Quinte–Oktave–Terz/Quinte"""
    s = song.bar(b); r = tri(ch)[0] + 12; t = r + (CH[ch][1] or 7)
    cyc = [r, r + 7, r + 12, t]
    for i in range(16): song.add('marimba', s + i * 0.25, 0.22, cyc[i % 4], vel + (12 if i % 4 == 0 else 0) + (6 if i % 8 == 6 else 0))

# ---- Schlagzeug --------------------------------------------------------------------------
def groove(b, kind, v=1.0):
    s = song.bar(b)
    def d(off, note, vel): song.dr(s + off, note, min(127, vel * v))
    if kind == 'stomp':                       # Halbzeit: Kick+Tom auf 1, Snare+Clap auf 3
        d(0, KICK, 118); d(0, TOM_L, 112); d(1.5, TOM_M, 96); d(2, SNARE, 112); d(2, CLAP, 92)
        d(2.75, KICK, 100); d(3.5, TOM_L, 104); d(3.75, TOM_M, 92)
        for i in range(4): d(i, COWBELL, 66 if i % 2 == 0 else 50)
    elif kind == 'run':                       # Jagd: Toms in Achteln, Kick vorwärts
        d(0, KICK, 118); d(1.5, KICK, 100); d(2.75, KICK, 100)
        d(2, SNARE, 114); d(2, CLAP, 90); d(3.5, SNARE, 90)
        seq = [TOM_H, TOM_M, TOM_L, TOM_M, TOM_H, TOM_M, TOM_L, TOM_L]
        for i in range(8):
            if i not in (0, 4): d(i * 0.5, seq[i], 78 + (10 if i % 2 == 0 else 0))
        d(1, COWBELL, 70); d(3, COWBELL, 70)
    elif kind == 'trex':                      # König: doppelte Wucht
        d(0, KICK, 124); d(0, TOM_L, 118); d(0, CRASH, 92); d(0.75, KICK, 96); d(1.5, TOM_M, 106)
        d(2, SNARE, 120); d(2, CLAP, 100); d(2, KICK, 110); d(2.75, KICK, 100)
        d(3, TOM_L, 108); d(3.5, TOM_M, 108); d(3.75, TOM_H, 104)
        for i in range(4): d(i, RIDE, 100)
        d(1, COWBELL, 76); d(3, COWBELL, 76)
    elif kind == 'soft':
        d(0, KICK, 100); d(0, TOM_L, 92); d(2, SNARE, 96); d(2, CLAP, 76); d(1.5, TOM_M, 78); d(3.5, TOM_L, 84)
        d(1, COWBELL, 60); d(3, COWBELL, 60)

def fill(b, big=False):
    s = song.bar(b)
    seq = [TOM_H, TOM_HH, TOM_M, TOM_M, TOM_L, TOM_L, TOM_L, TOM_L]
    st = 1.5 if big else 2.0
    for i in range(8): song.dr(s + st + i * ((4 - st - 0.25) / 7), seq[i], ramp(i, 8, 84, 120), 0.2)
    song.dr(s + 3.75, KICK, 122)
def snare_roll(b, start, end, v0, v1):
    s = song.bar(b) + start; cnt = int((end - start) * 4)
    for i in range(cnt): song.dr(s + i * 0.25, SNARE, ramp(i, cnt, v0, v1), 0.15)
def crash(b, vel=112): song.dr(song.bar(b), CRASH, vel, 0.5)

# ---- Melodien ----------------------------------------------------------------------------
CH_A = ['Bm', 'Bm', 'C', 'C', 'Bm', 'Am', 'G', 'F#']
MEL_A = [
    [(0, 1.5, 'B3'), (1.5, 0.5, 'B3'), (2, 2, 'D4')],
    [(0, 1, 'C4'), (1, 1, 'B3'), (2, 2, 'F#3')],
    [(0, 1.5, 'C4'), (1.5, 0.5, 'C4'), (2, 2, 'E4')],
    [(0, 1, 'D4'), (1, 1, 'C4'), (2, 2, 'G3')],
    [(0, 1.5, 'B3'), (1.5, 0.5, 'D4'), (2, 2, 'F#4')],
    [(0, 1, 'E4'), (1, 1, 'D4'), (2, 1, 'C4'), (3, 1, 'A3')],
    [(0, 2, 'D4'), (2, 1, 'B3'), (3, 1, 'G3')],
    [(0, 3, 'F#3'), (3, 1, 'A3')],
]
CH_INTRO = ['Bm', 'Bm', 'C', 'C', 'Bm', 'Bm', 'C', 'C']
MEL_TAIL = [MEL_A[0], MEL_A[1], [(0, 2, 'D4'), (2, 2, 'E4')], [(0, 3, 'F#3'), (3, 1, 'C4')]]   # Ankylos-Schluss
CH_TAIL = ['Bm', 'Bm', 'Am', 'F#']

CH_B = ['Bm', 'C', 'Bm', 'D', 'Em', 'C', 'Am', 'F#']
CH_B2 = ['Bm', 'C', 'Am', 'F#']
PTERA = [
    [(0, .5, 'B5'), (.5, .5, 'A5'), (1, .5, 'F#5'), (1.5, .5, 'D5'), (2, 2, 'B4')],
    [(0, .5, 'C6'), (.5, .5, 'B5'), (1, .5, 'G5'), (1.5, .5, 'E5'), (2, 2, 'C5')],
    [(0, .5, 'D6'), (.5, .5, 'C6'), (1, .5, 'A5'), (1.5, .5, 'F#5'), (2, 2, 'D5')],
    [(0, 1, 'F#5'), (1, 1, 'A5'), (2, 2, 'D6')],
    [(0, .5, 'B5'), (.5, .5, 'G5'), (1, .5, 'E5'), (1.5, .5, 'B4'), (2, 2, 'G4')],
    [(0, .5, 'C6'), (.5, .5, 'G5'), (1, .5, 'E5'), (1.5, .5, 'C5'), (2, 2, 'G5')],
    [(0, 1, 'A5'), (1, 1, 'C6'), (2, 1, 'E6'), (3, 1, 'C6')],
    [(0, 2, 'F#5'), (2, 1, 'E5'), (3, 1, 'C5')],
]

CH_C = ['Bm', 'C', 'Bm', 'Am', 'G', 'Am', 'C', 'F#']
MEL_C = [
    [(0, 1.5, 'B4'), (1.5, 0.5, 'B4'), (2, 1, 'D5'), (3, 1, 'C5')],
    [(0, 2, 'C5'), (2, 1, 'E5'), (3, 1, 'D5')],
    [(0, 1.5, 'B4'), (1.5, 0.5, 'D5'), (2, 2, 'F#5')],
    [(0, 1, 'E5'), (1, 1, 'C5'), (2, 2, 'A4')],
    [(0, 2, 'G4'), (2, 1, 'B4'), (3, 1, 'D5')],
    [(0, 2, 'A4'), (2, 1, 'C5'), (3, 1, 'E5')],
    [(0, 1.5, 'C5'), (1.5, 0.5, 'E5'), (2, 2, 'G5')],
    [(0, 3, 'F#5'), (3, 1, 'E5')],
]
CH_C2 = ['Bm', 'C', 'D', 'F#']
MEL_C2 = [
    [(0, .5, 'B4'), (.5, .5, 'B4'), (1, .5, 'D5'), (1.5, .5, 'D5'), (2, 2, 'F#5')],
    [(0, .5, 'C5'), (.5, .5, 'C5'), (1, .5, 'E5'), (1.5, .5, 'E5'), (2, 2, 'G5')],
    [(0, .5, 'D5'), (.5, .5, 'D5'), (1, .5, 'F#5'), (1.5, .5, 'F#5'), (2, 2, 'A5')],
    [(0, 1, 'F#5'), (1, 1, 'E5'), (2, 1, 'C5'), (3, 1, 'B4')],
]
CH_D = ['Bm', 'C', 'Am', 'F#']
MEL_D = [
    [(0, 1.5, 'B3'), (1.5, 0.5, 'B3'), (2, 2, 'D4')],
    [(0, 1.5, 'C4'), (1.5, 0.5, 'C4'), (2, 2, 'E4')],
    [(0, 4, 'E4')],
    [(0, 3, 'F#3')],
]

# ==== Arrangement ==========================================================================
# ---- Intro 0–7: nur Stampfen ----------------------------------------------------------------
hit(0, 0, 'Bm', 118, 2.0); crash(0, 108)
for i, ch in enumerate(CH_INTRO):
    pedal(i, ch, 92 + i)
    riff(i, ch, 84 + i * 2)
    timp(i, ch, 'q', 92 + i * 2)
    groove(i, 'stomp', 0.95 + i * 0.01)
    if i >= 4:
        line(i, MEL_A[i - 4], ['bassoon'], [92 + (i - 4) * 2], shift=-12)
        line(i, MEL_A[i - 4], ['trombone'], [70 + (i - 4) * 3], shift=0)
    if i >= 6: choir(i, ch, 50 + (i - 6) * 12)
fill(3); fill(7, big=True); snare_roll(7, 0, 1.5, 60, 90)

# ---- Thema A 8–19 -----------------------------------------------------------------------------
hit(8, 0, 'Bm', 112, 1.0); crash(8, 112)
for i in range(12):
    b = 8 + i
    if i < 8: ch, mel = CH_A[i], MEL_A[i]
    else: ch, mel = CH_TAIL[i - 8], MEL_TAIL[i - 8]
    pedal(b, ch, 98); riff(b, ch, 94); timp(b, ch, 'q', 100)
    groove(b, 'stomp', 1.02)
    line(b, mel, ['tuba', 'trombone'], [100, 92])
    line(b, mel, ['bassoon'], [80], shift=12)
    if i >= 4: song.add('horns', song.bar(b) + 1, 0.9, tri(ch)[1] + 12, 78); song.add('horns', song.bar(b) + 3, 0.9, tri(ch)[2] + 12, 82)
    if i >= 8: choir(b, ch, 60 + (i - 8) * 8)
fill(11); fill(15); fill(19, big=True); crash(16, 100)

# ---- Jagd B 20–31 ------------------------------------------------------------------------------
hit(20, 0, 'Bm', 114, 1.0); crash(20, 114)
for i in range(12):
    b = 20 + i
    ch = CH_B[i] if i < 8 else CH_B2[i - 8]
    pedal(b, ch, 98); riff(b, ch, 92); timp(b, ch, 'gallop', 96)
    groove(b, 'run', 1.05)
    marimba(b, ch, 78 + (i // 4) * 4)
    line(b, PTERA[i % 8], ['flute'], [88 + (6 if i >= 8 else 0)])
    r = tri(ch)[0]                              # Posaune stößt auf Grundton (Oktave 3)
    for off in (0, 0.75, 2, 2.75): song.add('trombone', song.bar(b) + off, 0.5, r, 84)
    if i >= 4: song.add('tuba', song.bar(b), 1.9, rootb(ch), 90); song.add('tuba', song.bar(b) + 2, 1.9, rootb(ch) + 7, 86)
    if i >= 8: choir(b, ch, 60 + (i - 8) * 8)
fill(23); fill(27); fill(31, big=True)
snare_roll(30, 2, 4, 60, 100); snare_roll(31, 0, 1.5, 90, 118)

# ---- König Trex C 32–43 ---------------------------------------------------------------------------
hit(32, 0, 'Bm', 124, 1.6); crash(32, 120)
for i in range(12):
    b = 32 + i
    ch, mel = (CH_C[i], MEL_C[i]) if i < 8 else (CH_C2[i - 8], MEL_C2[i - 8])
    pedal(b, ch, 104); riff(b, ch, 100); timp(b, ch, 'gallop', 104)
    groove(b, 'trex', 1.0)
    line(b, mel, ['trumpet', 'brass', 'horns'], [98, 88, 84])
    line(b, mel, ['tuba', 'trombone'], [96, 88], shift=-24)
    choir(b, ch, 88)
    if i >= 8: marimba(b, ch, 84)
    if i % 4 == 0 and i > 0: crash(b, 104)
fill(35); fill(39); fill(43, big=True); snare_roll(42, 0, 4, 60, 100); snare_roll(43, 0, 1.5, 90, 124)

# ---- Zurück D 44–47 ---------------------------------------------------------------------------------
crash(44, 100); hit(44, 0, 'Bm', 104, 0.8)
for i in range(4):
    b = 44 + i; ch = CH_D[i]
    pedal(b, ch, 96); riff(b, ch, 88 - i * 2); timp(b, ch, 'q' if i < 3 else 'roll', 94 if i < 3 else 118)
    groove(b, 'soft', 1.0 + i * 0.04)
    line(b, MEL_D[i], ['bassoon', 'horns'], [92, 74], shift=-12 if i < 2 else 0)
    choir(b, ch, 56 + i * 10)
fill(46); fill(47, big=True)

sf2, out = cli_paths('bgm_theme_gigantisaurs.ogg')
song.render(sf2, out)
