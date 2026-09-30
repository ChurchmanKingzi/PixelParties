# -*- coding: utf-8 -*-
"""Battle-Theme „Spice Bazaar Standoff“ (Archetyp Spices) → public/music/bgm_theme_spices.ogg

Orientalischer Gewürzbasar-Kampf in A doppelt-harmonisch (A B♭ C♯ D E F G♯), 138 BPM,
72 Takte (125,2 s), nahtlos loopbar. Zamorin, der Gewürz-Rajah, und seine Gewürzgläser
(rot/blau/grün/gold, Elixiere und Tränke): Harmonium-Bordun (Akkordeon), Sitar-artige Gitarre
und Koto als Riff, Tabla aus Toms mit Maqsum-artigem Muster, Oboe als Schlangenbeschwörer,
Sax als zweite Schlange, Xylophon/Marimba-Läufe als Marktgewusel, Kuhglocke als Händlerglocke.
Die Terz-Sekunde B♭–C♯ (übermäßige Sekunde) und der Halbton zum Grundton geben den Flair.

Aufbau (Takte, 0-basiert):
   0– 7  Intro        Bordun, Tabla, Gitarren-Riff, Händlerglocke; ab Takt 4 Oboen-Ruf
   8–23  Thema A      Oboe-Schlangenmelodie über A/B♭-Wechsel, Koto-Riff, Sax-Antwort (ab 16)
  24–39  Steigerung B Marimba-/Xylophon-Läufe (Marktgewusel), Oboe höher, Sax-Gegenlinie,
                      Tabla verdichtet, Streicher-Tremolo
  40–55  Höhepunkt C  Rajah-Fanfare: Trompete + Horn + Oboe im Unisono, volle Tabla + Kick/Snare
  56–63  Break D      Tabla + Bordun, Koto-Solo, Oboe/Sax im Frage-Antwort-Spiel, Snare-Crescendo
  64–71  Rückführung  Riff wächst, Marimba-Läufe, Dominante E → zurück zum A des Intros
Aufruf:  python3 scripts/music/theme_spices.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 138, 72                       # 72 × 4 × 60/138 = 125,2 s
song = Song(bpm=BPM, bars=BARS)

song.inst('bass',   'sbass2',    98, 62)
song.inst('accord', 'accordion', 70, 56)   # Harmonium-Bordun
song.inst('sitar',  'guitar',    88, 40)   # sitar-artiges Riff
song.inst('koto',   'koto',      84, 86)
song.inst('oboe',   'oboe',      96, 66)   # Schlangenbeschwörer
song.inst('sax',    'sax',       82, 60)
song.inst('marimba','marimba',   86, 46)
song.inst('xylo',   'xylo',      74, 82)
song.inst('trumpet','trumpet',   88, 72)
song.inst('horns',  'horns',     80, 52)
song.inst('strings','tremolo',   68, 70)
song.inst('hit',    'hit',       92, 64)

NAMES = {'C': C, 'Db': Db, 'D': D, 'Eb': Eb, 'E': E, 'F': F, 'Gb': Gb, 'G': G, 'Ab': Ab, 'A': A, 'Bb': Bb, 'B': B}
def nt(s):
    if s[1] == '#': return n({'C#': Db, 'D#': Eb, 'F#': Gb, 'G#': Ab, 'A#': Bb}[s[:2]], int(s[-1]))
    return n(NAMES[s[:-1]], int(s[-1]))
SCALE = {A, Bb, Db, D, E, F, Ab}          # A doppelt-harmonisch
def ramp(i, cnt, a, b): return a + (b - a) * i / max(1, cnt - 1)

# Akkorde: Grundton + Töne (alle aus der Skala)
CH = {'A': (A, (0, 4, 7)), 'Bb': (Bb, (0, 4, 7)), 'Dm': (D, (0, 3, 7)), 'E': (E, (0, 4, 10)),   # E7 ohne Quinte: E G♯ D
      'F': (F, (0, 4, 8)), 'G#': (Ab, (0, 3, 6))}
def bassp(ch):
    r = CH[ch][0]; return 24 + r if r >= E else 36 + r
def tones(ch, base): r, iv = CH[ch]; return [n(r, base) + i for i in iv]

# ---- Bausteine ---------------------------------------------------------------------------
def drone(b, ch, vel=68, full=True):
    s = song.bar(b)
    song.add('accord', s, 3.98, n(A, 3), vel); song.add('accord', s, 3.98, n(E, 4), vel - 8)
    if full and ch != 'A':
        for p in tones(ch, 4)[:2]: song.add('accord', s, 3.98, p, vel - 14)

def bass(b, ch, kind='pulse', vel=98):
    s = song.bar(b); r = bassp(ch)
    if kind == 'pulse':               # Dum-Muster: 0, 1.5, 2, 3.5 (maqsum-artig)
        for off, v, dur in ((0, 8, 1.0), (1.5, -8, 0.4), (2, 2, 1.0), (3.5, -6, 0.4)): song.add('bass', s + off, dur, r, vel + v)
    elif kind == 'drive':
        for i in range(8): song.add('bass', s + i * 0.5, 0.4, r + (12 if i in (3, 7) else 0), vel + (8 if i % 2 == 0 else -6))
    elif kind == 'long': song.add('bass', s, 3.9, r, vel - 10)

RIFF = [0, 4, 7, 4, 0, 4, 7, 12]         # 16tel-Riff in Halbtönen relativ zum Grundton (aus Akkord)
def riff(b, ch, inst='sitar', vel=80, octv=4, dens=1):
    """Sitar-Riff (16tel): Grundton – Terz – Quinte mit Akzent auf 3+3+2 (Bordunsaite = Grundton)."""
    s = song.bar(b); r = n(CH[ch][0], octv); iv = CH[ch][1]
    cyc = [r, r + iv[1], r + iv[2], r + iv[1]]
    for i in range(16):
        if dens == 0 and i % 2: continue
        acc = i in (0, 3, 6, 8, 11, 14)          # 3+3+2 + 3+3+2
        song.add(inst, s + i * 0.25, 0.22, cyc[i % 4] + (12 if i in (7, 15) else 0), vel + (14 if acc else -6))

def run(b, ch, inst, vel, octv=5, up=True):
    """Marktgewusel: 16tel-Lauf durch die Skala (steigend/fallend)."""
    s = song.bar(b)
    base = n(A, octv)
    seq = [base + x for x in (0, 1, 4, 5, 7, 8, 11, 12)]           # A B♭ C♯ D E F G♯ A'
    if not up: seq = seq[::-1]
    for i in range(8): song.add(inst, s + 2 + i * 0.25, 0.24, seq[i], vel + i)

def melody(b, notes, vel=92, insts=('oboe',), dv=(0,)):
    for off, dur, p in notes:
        pitch = nt(p) if isinstance(p, str) else p
        assert pitch % 12 in SCALE, (b, p)
        for inst, d in zip(insts, dv):
            song.add(inst, song.bar(b) + off, dur * 0.94, pitch, vel + d + (6 if off == 0 else 0))

def trem(b, ch, vel=64):
    for p in tones(ch, 4): song.add('strings', song.bar(b), 3.98, p, vel)

def hit(b, beat, vel=110, dur=0.9):
    for p in (n(A, 2), n(A, 3), n(E, 4), n(A, 4)): song.add('hit', song.bar(b) + beat, dur, p, vel)

# ---- Schlagzeug: Tabla aus Toms ------------------------------------------------------------
def tabla(b, level, v=1.0):
    """level 1: Maqsum (Dum Tek . Tek Dum . Tek .); 2: + 16tel-Ghosts; 3: dichte Rolls + Kick/Snare-Backbeat."""
    s = song.bar(b)
    def d(off, note, vel): song.dr(s + off, note, min(127, vel * v))
    for off, vel in ((0, 108), (1.5, 96), (2, 104)): d(off, TOM_L, vel)             # Dum
    for off, vel in ((1, 96), (2.5, 90), (3, 98), (3.5, 86)): d(off, TOM_H, vel)     # Tek/Tak
    d(1, SIDESTICK, 88); d(3, SIDESTICK, 92)
    d(0, COWBELL, 74); d(2, COWBELL, 62)                                            # Händlerglocke
    if level >= 2:
        for off in (0.75, 1.75, 2.75, 3.25): d(off, TOM_HH, 78)
        d(3.75, TOM_M, 92)
    if level >= 3:
        d(0, KICK, 112); d(2, KICK, 106); d(1.5, KICK, 96); d(3.5, KICK, 100)
        d(1, SNARE, 108); d(3, SNARE, 112); d(3, CLAP, 92); d(1, CLAP, 86)
        for off in (0.25, 1.25, 2.25, 2.75): d(off, TOM_M, 84)
        for i in range(8): d(i * 0.5, HAT, 110 if i % 2 == 0 else 92)

def fill(b, big=False):
    s = song.bar(b); toms = [TOM_H, TOM_HH, TOM_M, TOM_L]
    for i in range(8): song.dr(s + 2 + i * 0.25, toms[min(3, i // 2)], ramp(i, 8, 88, 118), 0.2)
    if big:
        for i in range(8): song.dr(s + 1.0 + i * 0.25, SNARE, ramp(i, 8, 60, 108), 0.12)
    song.dr(s + 3.75, KICK, 118)

def snare_roll(b, a, z, v0, v1):
    cnt = int((z - a) * 4)
    for i in range(cnt): song.dr(song.bar(b) + a + i * 0.25, SNARE, ramp(i, cnt, v0, v1), 0.14)

def crash(b, vel=112): song.dr(song.bar(b), CRASH, vel, 0.5)

# ---- Melodien (Skala A Bb C# D E F G#) -----------------------------------------------------
# Thema A: 8 Takte über  A A Bb A | Dm Bb E E  ; Schlangenmotiv: A–B♭–C♯–B♭–A (Halbton, übermäßige Sekunde)
CH_A = ['A', 'A', 'Bb', 'A', 'Dm', 'Bb', 'E', 'E']
MEL_A = [
    [(0, 0.5, 'A4'), (0.5, 0.5, 'A#4'), (1, 0.5, 'C#5'), (1.5, 0.5, 'A#4'), (2, 1, 'A4'), (3, 1, 'E5')],
    [(0, 0.5, 'A4'), (0.5, 0.5, 'A#4'), (1, 0.5, 'C#5'), (1.5, 0.5, 'D5'), (2, 1.5, 'C#5'), (3.5, 0.5, 'A#4')],
    [(0, 1, 'A#4'), (1, 0.5, 'D5'), (1.5, 0.5, 'F5'), (2, 1, 'D5'), (3, 1, 'A#4')],
    [(0, 0.5, 'C#5'), (0.5, 0.5, 'A#4'), (1, 1, 'A4'), (2, 0.5, 'G#4'), (2.5, 0.5, 'A4'), (3, 1, 'A#4')],
    [(0, 1, 'D5'), (1, 0.5, 'F5'), (1.5, 0.5, 'E5'), (2, 1, 'D5'), (3, 0.5, 'C#5'), (3.5, 0.5, 'A#4')],
    [(0, 1, 'A#4'), (1, 0.5, 'D5'), (1.5, 0.5, 'C#5'), (2, 1, 'A#4'), (3, 1, 'F4')],
    [(0, 1.5, 'G#4'), (1.5, 0.5, 'A4'), (2, 1, 'A#4'), (3, 0.5, 'A4'), (3.5, 0.5, 'G#4')],
    [(0, 3, 'E4'), (3, 1, 'G#4')],
]
# Sax-Antwort in Takt 2/4 der Phrase (Schlangenlinie eine Oktave tiefer)
SAX_A = {1: [(2, 0.5, 'E4'), (2.5, 0.5, 'F4'), (3, 1, 'E4')], 3: [(2, 0.5, 'C#4'), (2.5, 0.5, 'D4'), (3, 1, 'E4')],
         5: [(2, 1, 'D4'), (3, 1, 'C#4')], 7: [(1, 0.5, 'G#3'), (1.5, 0.5, 'A3'), (2, 1, 'A#3'), (3, 1, 'C#4')]}
# Thema B: höher und rascher, 8 Takte über A Bb Dm Bb | A Bb E A
CH_B = ['A', 'Bb', 'Dm', 'Bb', 'A', 'Bb', 'E', 'E']
MEL_B = [
    [(0, 0.5, 'E5'), (0.5, 0.5, 'F5'), (1, 0.5, 'E5'), (1.5, 0.5, 'C#5'), (2, 1, 'A4'), (3, 1, 'C#5')],
    [(0, 0.5, 'F5'), (0.5, 0.5, 'E5'), (1, 0.5, 'D5'), (1.5, 0.5, 'A#4'), (2, 1, 'D5'), (3, 1, 'F5')],
    [(0, 0.5, 'A5'), (0.5, 0.5, 'F5'), (1, 0.5, 'D5'), (1.5, 0.5, 'F5'), (2, 1.5, 'E5'), (3.5, 0.5, 'D5')],
    [(0, 0.5, 'D5'), (0.5, 0.5, 'C#5'), (1, 0.5, 'A#4'), (1.5, 0.5, 'C#5'), (2, 2, 'D5')],
    [(0, 0.5, 'E5'), (0.5, 0.5, 'F5'), (1, 0.5, 'E5'), (1.5, 0.5, 'C#5'), (2, 1, 'A4'), (3, 1, 'C#5')],
    [(0, 0.5, 'F5'), (0.5, 0.5, 'E5'), (1, 0.5, 'D5'), (1.5, 0.5, 'A#4'), (2, 1, 'D5'), (3, 1, 'F5')],
    [(0, 1, 'G#5'), (1, 0.5, 'F5'), (1.5, 0.5, 'E5'), (2, 0.5, 'D5'), (2.5, 0.5, 'A#4'), (3, 1, 'G#4')],
    [(0, 0.5, 'A4'), (0.5, 0.5, 'A#4'), (1, 0.5, 'C#5'), (1.5, 0.5, 'E5'), (2, 1, 'A5'), (3, 1, 'E5')],
]
SAX_B = ['A3', 'A#3', 'D4', 'A#3', 'A3', 'A#3', 'G#3', 'E4']
# Höhepunkt C: Rajah-Fanfare (Unisono), 8 Takte über A Bb A F | Dm Bb E A ; zweimal
CH_C = ['A', 'Bb', 'A', 'F', 'Dm', 'Bb', 'E', 'A']
MEL_C = [
    [(0, 1, 'A4'), (1, 1, 'C#5'), (2, 1.5, 'E5'), (3.5, 0.5, 'D5')],
    [(0, 1, 'A#4'), (1, 1, 'D5'), (2, 1.5, 'F5'), (3.5, 0.5, 'E5')],
    [(0, 1, 'A4'), (1, 1, 'C#5'), (2, 1, 'E5'), (3, 1, 'A5')],
    [(0, 1.5, 'F5'), (1.5, 0.5, 'E5'), (2, 1, 'C#5'), (3, 1, 'A4')],
    [(0, 1, 'D5'), (1, 1, 'F5'), (2, 1.5, 'A5'), (3.5, 0.5, 'F5')],
    [(0, 1, 'D5'), (1, 0.5, 'C#5'), (1.5, 0.5, 'A#4'), (2, 1, 'C#5'), (3, 1, 'D5')],
    [(0, 1.5, 'G#5'), (1.5, 0.5, 'F5'), (2, 1, 'E5'), (3, 0.5, 'D5'), (3.5, 0.5, 'A#4')],
    [(0, 0.5, 'A4'), (0.5, 0.5, 'A#4'), (1, 0.5, 'C#5'), (1.5, 0.5, 'A#4'), (2, 2, 'A4')],
]

# ==== Arrangement ==========================================================================
# ---- Intro (0–7) ---------------------------------------------------------------------------
CH_I = ['A', 'A', 'Bb', 'A', 'A', 'Bb', 'E', 'E']
hit(0, 0, 112, 1.2); crash(0, 104)
for i, ch in enumerate(CH_I):
    drone(i, ch, 62 + i * 2, full=i >= 4)
    bass(i, ch, 'pulse', 90 + i * 2)
    tabla(i, 1 if i < 4 else 2, 0.95 + i * 0.01)
    riff(i, ch, 'sitar', 72 + i * 2, dens=0 if i < 2 else 1)
    if i >= 4: riff(i, ch, 'koto', 62, 5, dens=0)
melody(4, [(0, 1, 'E5'), (1, 0.5, 'F5'), (1.5, 0.5, 'E5'), (2, 2, 'C#5')], 86)
melody(5, [(0, 1, 'D5'), (1, 0.5, 'C#5'), (1.5, 0.5, 'A#4'), (2, 2, 'A4')], 88)
melody(6, [(0, 0.5, 'A4'), (0.5, 0.5, 'A#4'), (1, 0.5, 'C#5'), (1.5, 0.5, 'A#4'), (2, 1, 'A4'), (3, 1, 'E5')], 92)
melody(7, [(0, 1.5, 'G#4'), (1.5, 0.5, 'A4'), (2, 1, 'A#4'), (3, 1, 'G#4')], 94)
snare_roll(7, 2, 4, 50, 100); fill(3); fill(7)

# ---- Thema A (8–23) ---------------------------------------------------------------------------
hit(8, 0, 108, 0.8); crash(8, 112)
for i in range(16):
    b, k = 8 + i, i % 8; ch = CH_A[k]; second = i >= 8
    drone(b, ch, 68)
    bass(b, ch, 'pulse', 98)
    tabla(b, 2 if not second else 3, 0.98 + (0.04 if second else 0))
    riff(b, ch, 'sitar', 76 + (4 if second else 0))
    riff(b, ch, 'koto', 60, 5, dens=0)
    melody(b, MEL_A[k], 92, ('oboe',) if not second else ('oboe', 'sax'), (0, -14))
    if second and k in SAX_A: melody(b, SAX_A[k], 84, ('sax',), (0,))
    if second and k in (3, 7): trem(b, ch, 60)
fill(15); crash(16, 104); fill(19)
snare_roll(22, 2, 4, 60, 100); snare_roll(23, 0, 3, 80, 124); fill(23, big=True)

# ---- Steigerung B (24–39): Marktgewusel ----------------------------------------------------
hit(24, 0, 112, 0.9); crash(24, 114); hit(32, 0, 114, 0.9); crash(32, 116)
for i in range(16):
    b, k = 24 + i, i % 8; ch = CH_B[k]; second = i >= 8
    drone(b, ch, 70)
    bass(b, ch, 'drive' if second else 'pulse', 100)
    tabla(b, 3, 1.0 + (0.04 if second else 0))
    riff(b, ch, 'sitar', 80)
    melody(b, MEL_B[k], 94, ('oboe',) if not second else ('oboe', 'marimba'), (0, -6))
    song.add('sax', song.bar(b), 3.9, nt(SAX_B[k]), 78 + (6 if second else 0))
    if k % 2 == 1: run(b, ch, 'marimba' if not second else 'xylo', 74, 5, up=(k % 4 == 1))
    if second: trem(b, ch, 66)
fill(31); fill(35); snare_roll(38, 0, 4, 60, 100); snare_roll(39, 0, 3, 90, 127); fill(39, big=True)

# ---- Höhepunkt C (40–55): Rajah-Fanfare -----------------------------------------------------
hit(40, 0, 122, 1.2); crash(40, 120); hit(48, 0, 118, 0.9); crash(48, 118)
for i in range(16):
    b, k = 40 + i, i % 8; ch = CH_C[k]; second = i >= 8
    drone(b, ch, 74)
    bass(b, ch, 'drive', 104)
    tabla(b, 3, 1.06 if second else 1.02)
    riff(b, ch, 'sitar', 82)
    riff(b, ch, 'koto', 70, 5)
    melody(b, MEL_C[k], 100, ('trumpet', 'oboe', 'horns'), (0, -4, -14))
    trem(b, ch, 72)
    if k in (1, 3, 5): run(b, ch, 'xylo', 72, 6, up=True)
    if k == 0 and b != 40 and b != 48: crash(b, 100)
    for off in (1.5, 3.0): 
        for p in tones(ch, 3)[:2]: song.add('horns', song.bar(b) + off, 0.7, p + 12, 72)
fill(43); fill(47); fill(51); snare_roll(54, 0, 4, 70, 110); snare_roll(55, 0, 3, 100, 127); fill(55, big=True)

# ---- Break D (56–63): Koto-Solo, Frage-Antwort -----------------------------------------------
crash(56, 100)
CH_D = ['A', 'A', 'Bb', 'Bb', 'Dm', 'Bb', 'E', 'E']
for i, ch in enumerate(CH_D):
    b = 56 + i
    drone(b, ch, 72)
    bass(b, ch, 'pulse', 90 + i)
    tabla(b, 2, 0.92 + i * 0.02)
    riff(b, ch, 'sitar', 66 + i * 2, dens=1)
    if i % 2 == 0: melody(b, MEL_A[i], 88, ('oboe',))            # Frage (Oboe)
    else: melody(b, [(o, d, p) for o, d, p in MEL_A[i - 1]], 84, ('sax',))   # Antwort (Sax)
    for p in tones(ch, 5)[:2]: song.add('koto', song.bar(b) + 0.0, 1.0, p, 74)
    if i >= 4: trem(b, ch, 54 + (i - 4) * 6)
fill(59); snare_roll(62, 2, 4, 60, 105)

# ---- Rückführung E (64–71): Dominante, Aufbau zurück zum Intro -----------------------------
CH_E = ['Dm', 'Dm', 'Bb', 'Bb', 'E', 'E', 'E', 'E']
hit(64, 0, 112, 0.9); crash(64, 108)
for i, ch in enumerate(CH_E):
    b = 64 + i
    drone(b, ch, 74)
    bass(b, ch, 'drive', 96 + i * 2)
    tabla(b, 3, 0.94 + i * 0.02)
    riff(b, ch, 'sitar', 78 + i * 2)
    riff(b, ch, 'koto', 66 + i * 2, 5)
    trem(b, ch, 60 + i * 5)
    if i >= 4: song.add('oboe', song.bar(b), 3.9, nt('G#4') if i % 2 == 0 else nt('E5'), 90)
    if i in (1, 3, 5): run(b, ch, 'marimba', 74, 5, up=True)
melody(70, [(0, 0.5, 'A4'), (0.5, 0.5, 'A#4'), (1, 0.5, 'C#5'), (1.5, 0.5, 'A#4'), (2, 1, 'A4'), (3, 1, 'E5')], 96, ('oboe', 'trumpet'), (0, -8))
melody(71, [(0, 0.25, 'E4'), (0.25, 0.25, 'G#4'), (0.5, 0.25, 'A#4'), (0.75, 0.25, 'D5'), (1, 1, 'E5'), (2, 1.5, 'G#4')], 100, ('oboe',))
fill(67); snare_roll(70, 2, 4, 60, 100); snare_roll(71, 0, 3.5, 80, 124); fill(71, big=True)

sf2, out = cli_paths('bgm_theme_spices.ogg')
song.render(sf2, out)
