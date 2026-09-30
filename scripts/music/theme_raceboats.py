# -*- coding: utf-8 -*-
"""Theme-Battle-Track „Regatta Rush“ (Archetyp Race Boats) → public/music/bgm_theme_raceboats.ogg

Fröhlich-hektisches Bootsrennen in D-Dur, 158 BPM, 72 Takte (109,4 s), nahtlos loopbar.
Seemannslied-Shanty im Kampftempo: Fiddle und Akkordeon tragen die Melodie, Oompah-Bass und
Gitarren-Schlag, Ruder-Rhythmus in Toms (Schlag auf jedem Viertel, Akzent auf 1), Bootsglocke
(Cowbell), Schiffshorn-Startsignal, Wellenbewegung (Harfen-Triolen), Crew-Rufe („Hey-Ho!“)
im Chor und eine Zielgeraden-Steigerung mit Tonartwechsel von D nach E.

Aufbau (Takte, 0-basiert):
   0– 7  Intro     Startsignal (Hörner), Ruder-Toms, Bootsglocke, Akkordeon-Bordun, Fiddle-Ruf
   8–23  A Shanty  Fiddle-Melodie (2 x 8 Takte, D G A), Akkordeon-Pah, Oompah-Bass, Polka-Schlagzeug
  24–39  B Wellen  Harfen-Triolenwellen, Akkordeon + Pfeife singen lange Wellenlinien (G A D Hm)
  40–55  C Sprint  Zielgerade in E-Dur (+2 Halbtöne): Shanty in Fiddle + Pfeife + Brass, Gitarre, Tuba, Crew-Chor
  56–71  D Ziel    zurück in D-Dur: Shanty voll, dann 8 Takte Aufbau (h G D A), Wirbel → Sprung auf Takt 0
Aufruf:  python3 scripts/music/theme_raceboats.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 158, 72                       # 72 × 4 × 60/158 = 109,4 s
song = Song(bpm=BPM, bars=BARS)

song.inst('bass',      'acbass',    98, 60)
song.inst('tuba',      'tuba',      84, 52)
song.inst('timp',      'timp',      88, 64)
song.inst('accordion', 'accordion', 84, 46)   # Pah-Akkorde / Melodie
song.inst('accmel',    'accordion', 80, 80)   # Melodie-Verdopplung
song.inst('violin',    'violin',    90, 74)   # Fiddle
song.inst('guitar',    'guitar',    80, 36)   # Schlag
song.inst('harp',      'harp',      80, 68)   # Wellen
song.inst('whistle',   'whistle',   76, 88)   # Bootsmann-Pfeife
song.inst('horns',     'horns',     86, 56)   # Startsignal
song.inst('brass',     'brass',     82, 60)
song.inst('choir',     'oohs',      84, 64)   # Crew
song.inst('piano',     'piano',     70, 42)

NAMES = {'C': C, 'Db': Db, 'C#': Db, 'D': D, 'Eb': Eb, 'D#': Eb, 'E': E, 'F': F, 'Gb': Gb, 'F#': Gb,
         'G': G, 'Ab': Ab, 'G#': Ab, 'A': A, 'Bb': Bb, 'A#': Bb, 'B': B}
def nt(s): return n(NAMES[s[:-1]], int(s[-1]))
SCALE_D = {D, E, Gb, G, A, B, Db}                        # D-Dur
CH = {'D': (D, [0, 4, 7]), 'G': (G, [0, 4, 7]), 'A': (A, [0, 4, 7]), 'Bm': (B, [0, 3, 7]), 'Em': (E, [0, 3, 7])}
def tones(ch, lo, sh=0):
    root, iv = CH[ch]; root = (root + sh) % 12
    return sorted(lo + ((root + i - lo) % 12) for i in iv)
def rootb(ch, sh=0): return 36 + (CH[ch][0] + sh) % 12
def ramp(i, cnt, a, b): return a + (b - a) * i / max(1, cnt - 1)

def line(b, notes, insts, vels, sh=0):
    for off, dur, p in notes:
        for inst, v in zip(insts, vels):
            assert nt(p) % 12 in SCALE_D, (b, p)
            song.add(inst, song.bar(b) + off, dur * 0.92, nt(p) + sh, v)

# ---- Begleitung ------------------------------------------------------------------------
def oompah(b, ch, vel=96, sh=0, tuba=False):
    s = song.bar(b); r = rootb(ch, sh); fifth = r + 7 if r + 7 < 48 else r - 5
    for off, p in ((0, r), (1, fifth), (2, r), (3, fifth)):
        song.add('bass', s + off, 0.45, p, vel + (8 if off in (0, 2) else -6))
        if tuba and off in (0, 2): song.add('tuba', s + off, 0.6, r - 12 if r - 12 >= 28 else r, 88)
def pah(b, ch, vel=78, sh=0, inst='accordion', lo=55):
    s = song.bar(b)
    for off in (0.5, 1.5, 2.5, 3.5):                       # Achtel-Nachschläge (Polka)
        for p in tones(ch, lo, sh): song.add(inst, s + off, 0.4, p, vel + (6 if off in (1.5, 3.5) else 0))
def strum(b, ch, vel=74, sh=0):
    s = song.bar(b)
    for off in (0.5, 1, 1.5, 2.5, 3, 3.5):
        for j, p in enumerate(tones(ch, 52, sh) + [tones(ch, 52, sh)[0] + 12]):
            song.add('guitar', s + off + j * 0.02, 0.4, p, vel)
def wave(b, ch, vel=70, sh=0):
    """Wellenbewegung: Harfen-Triolen auf- und abwärts (2 Wellen pro Takt)."""
    s = song.bar(b); t = tones(ch, 60, sh); arp = [t[0], t[1], t[2], t[0] + 12, t[2], t[1]]
    for i in range(12): song.add('harp', s + i / 3, 0.4, arp[i % 6], vel + (8 if i % 3 == 0 else 0))
def hey(b, beat, ch, vel=88, sh=0):
    """Crew-Ruf „Hey-Ho“: zwei kurze Akkordschläge im Chor."""
    for off in (0, 0.5):
        for p in tones(ch, 55, sh): song.add('choir', song.bar(b) + beat + off, 0.4, p, vel)

# ---- Schlagzeug ---------------------------------------------------------------------------
def groove(b, kind, v=1.0):
    s = song.bar(b)
    def d(off, note, vel): song.dr(s + off, note, min(127, vel * v))
    if kind == 'row':                                  # Ruder-Rhythmus: Toms auf jedem Viertel, Akzent auf 1
        for off, note, vel in ((0, TOM_L, 116), (1, TOM_M, 96), (2, TOM_L, 106), (3, TOM_M, 96)): d(off, note, vel)
        d(3.5, TOM_H, 90); d(0, KICK, 112); d(2, KICK, 100)
        d(1, COWBELL, 90); d(3, COWBELL, 90)           # Bootsglocke
    elif kind == 'polka':
        d(0, KICK, 114); d(2, KICK, 106); d(1, SNARE, 108); d(3, SNARE, 110)
        for i in range(8): d(i * 0.5, HAT, 106 if i % 2 else 92)
        d(0.5, TOM_L, 74); d(2.5, TOM_L, 74)
    elif kind == 'wave':                               # wogend: Ruderschlag + Sidestick
        d(0, KICK, 108); d(2, KICK, 96); d(0, TOM_L, 100); d(2, TOM_M, 92)
        d(1, SIDESTICK, 104); d(3, SIDESTICK, 108); d(3.5, TOM_H, 84)
        for i in range(8): d(i * 0.5, HAT, 104 if i % 2 else 88)
        d(2.5, COWBELL, 80)
    elif kind == 'sprint':
        for off in (0, 1, 2, 3): d(off, KICK, 112 if off in (0, 2) else 98)
        d(1, SNARE, 112); d(3, SNARE, 114); d(1.75, SNARE, 90); d(3.75, SNARE, 92)
        for i in range(8): d(i * 0.5, RIDE, 110 if i % 2 else 96)
        d(0.5, COWBELL, 86); d(1.5, COWBELL, 86); d(2.5, COWBELL, 86); d(3.5, COWBELL, 86)
def fill(b, big=False):
    s = song.bar(b); toms = [TOM_H, TOM_HH, TOM_M, TOM_L]
    for i in range(8): song.dr(s + 2.0 + i * 0.25, toms[min(3, i // 2)], ramp(i, 8, 88, 118), 0.2)
    if big:
        for i in range(8): song.dr(s + 1.0 + i * 0.125, SNARE, ramp(i, 8, 64, 104), 0.1)
    song.dr(s + 3.75, KICK, 118)
def snare_roll(b, start, end, v0, v1):
    s = song.bar(b) + start; cnt = int((end - start) * 4)
    for i in range(cnt): song.dr(s + i * 0.25, SNARE, ramp(i, cnt, v0, v1), 0.15)
def crash(b, vel=112): song.dr(song.bar(b), CRASH, vel, 0.6)

# ---- Melodien -----------------------------------------------------------------------------
CHORDS_A1 = ['D', 'D', 'G', 'D', 'D', 'G', 'A', 'A']
MEL_A1 = [
    [(0, 1, 'A4'), (1, .5, 'B4'), (1.5, .5, 'A4'), (2, 1, 'F#4'), (3, 1, 'A4')],
    [(0, 1, 'D5'), (1, 1, 'D5'), (2, 2, 'A4')],
    [(0, 1, 'B4'), (1, .5, 'A4'), (1.5, .5, 'G4'), (2, 1, 'B4'), (3, 1, 'D5')],
    [(0, 2, 'A4'), (2, 2, 'F#4')],
    [(0, 1, 'A4'), (1, .5, 'B4'), (1.5, .5, 'C#5'), (2, 1, 'D5'), (3, 1, 'F#5')],
    [(0, 1, 'E5'), (1, .5, 'D5'), (1.5, .5, 'B4'), (2, 1, 'G4'), (3, 1, 'B4')],
    [(0, 1, 'C#5'), (1, .5, 'E5'), (1.5, .5, 'C#5'), (2, 1, 'A4'), (3, 1, 'C#5')],
    [(0, 2, 'E5'), (2, 1, 'D5'), (3, 1, 'C#5')],
]
CHORDS_A2 = ['D', 'Bm', 'G', 'D', 'G', 'A', 'D', 'A']
MEL_A2 = [
    [(0, 1, 'F#5'), (1, .5, 'F#5'), (1.5, .5, 'E5'), (2, 1, 'D5'), (3, 1, 'A4')],
    [(0, 1, 'B4'), (1, .5, 'D5'), (1.5, .5, 'F#5'), (2, 2, 'D5')],
    [(0, 1, 'G5'), (1, .5, 'F#5'), (1.5, .5, 'E5'), (2, 1, 'D5'), (3, 1, 'B4')],
    [(0, 1, 'A4'), (1, 1, 'D5'), (2, 2, 'F#5')],
    [(0, 1, 'E5'), (1, .5, 'D5'), (1.5, .5, 'B4'), (2, 1, 'D5'), (3, 1, 'G5')],
    [(0, 1, 'E5'), (1, .5, 'C#5'), (1.5, .5, 'A4'), (2, 1, 'E5'), (3, 1, 'A5')],
    [(0, 1.5, 'F#5'), (1.5, .5, 'E5'), (2, 1, 'D5'), (3, 1, 'A4')],
    [(0, 1, 'E5'), (1, 1, 'C#5'), (2, 1, 'A4'), (3, 1, 'C#5')],
]
CHORDS_B = ['G', 'A', 'D', 'Bm', 'G', 'A', 'D', 'A']
MEL_B = [
    [(0, 1.5, 'B4'), (1.5, .5, 'D5'), (2, 2, 'G5')],
    [(0, 1.5, 'E5'), (1.5, .5, 'C#5'), (2, 2, 'A4')],
    [(0, 1.5, 'F#5'), (1.5, .5, 'A5'), (2, 2, 'F#5')],
    [(0, 1, 'D5'), (1, 1, 'F#5'), (2, 2, 'D5')],
    [(0, 1.5, 'B4'), (1.5, .5, 'D5'), (2, 2, 'G5')],
    [(0, 1.5, 'A5'), (1.5, .5, 'G5'), (2, 1, 'E5'), (3, 1, 'C#5')],
    [(0, 2, 'D5'), (2, 1, 'F#5'), (3, 1, 'A5')],
    [(0, 2, 'E5'), (2, 2, 'C#5')],
]
# Terzgegenstimme der Wellen-Melodie (Pfeife/Akkordeon 2), eine Terz höher/tiefer im D-Dur
MEL_B2 = [
    [(0, 1.5, 'D5'), (1.5, .5, 'G5'), (2, 2, 'B5')],
    [(0, 1.5, 'A4'), (1.5, .5, 'E5'), (2, 2, 'E5')],
    [(0, 1.5, 'A5'), (1.5, .5, 'C#6'), (2, 2, 'A5')],
    [(0, 1, 'F#5'), (1, 1, 'A5'), (2, 2, 'F#5')],
    [(0, 1.5, 'D5'), (1.5, .5, 'G5'), (2, 2, 'B5')],
    [(0, 1.5, 'C#6'), (1.5, .5, 'B5'), (2, 1, 'G5'), (3, 1, 'E5')],
    [(0, 2, 'F#5'), (2, 1, 'A5'), (3, 1, 'C#6')],
    [(0, 2, 'G5'), (2, 2, 'E5')],
]

# ==== Arrangement =========================================================================
# ---- Intro (0–7) ---------------------------------------------------------------------------
CH_I = ['D', 'D', 'D', 'D', 'G', 'D', 'A', 'A']
for i, ch in enumerate(CH_I):
    b = i
    groove(b, 'row', 1.0)
    song.add('bass', song.bar(b), 3.9, rootb(ch), 92)
    for p in tones(ch, 50): song.add('accordion', song.bar(b), 3.9, p, 70 + i * 3)
    if b >= 4: oompah(b, ch, 90); pah(b, ch, 68 + (b - 4) * 4)
for p in (D + 60 - 12, A + 60 - 12, D + 60): song.add('horns', song.bar(0), 3.0, p, 112)
crash(0, 112)
line(2, [(0, 1, 'A4'), (1, .5, 'B4'), (1.5, .5, 'A4'), (2, 2, 'F#4')], ['violin'], [88])
line(3, [(0, 1, 'D5'), (1, 1, 'D5'), (2, 2, 'A4')], ['violin'], [92])
line(6, MEL_A1[6], ['violin'], [92]); line(7, MEL_A1[7], ['violin'], [98])
hey(3, 3.0, 'D', 80)
snare_roll(7, 0, 3.5, 60, 110); fill(3); fill(7, big=True)

# ---- A Shanty (8–23) -------------------------------------------------------------------------
crash(8, 114)
for i in range(16):
    b, k, sec = 8 + i, i % 8, i // 8
    ch = (CHORDS_A1 if sec == 0 else CHORDS_A2)[k]
    mel = (MEL_A1 if sec == 0 else MEL_A2)[k]
    oompah(b, ch, 96 + 4 * sec); pah(b, ch, 74 + 4 * sec)
    groove(b, 'polka', 1.0 + 0.03 * sec)
    line(b, mel, ['violin'] + (['accmel'] if sec == 1 else []), [96, 78])
    if sec == 1: strum(b, ch, 66)
    if k in (3, 7): hey(b, 3.0, ch, 84)
fill(15); fill(23, big=True); crash(16, 104)
snare_roll(22, 2, 4, 60, 96)

# ---- B Wellen (24–39) ------------------------------------------------------------------------
crash(24, 110)
for i in range(16):
    b, k, sec = 24 + i, i % 8, i // 8
    ch = CHORDS_B[k]
    song.add('bass', song.bar(b), 1.9, rootb(ch), 96); song.add('bass', song.bar(b) + 2, 1.9, rootb(ch) + 7 if rootb(ch) + 7 < 48 else rootb(ch) - 5, 90)
    wave(b, ch, 68 + 6 * sec)
    groove(b, 'wave', 1.0 + 0.03 * sec)
    line(b, MEL_B[k], ['accmel'] + ['violin'] * sec, [90, 84])
    line(b, MEL_B2[k], ['whistle'], [70 + 10 * sec]) if sec == 1 else None
    for p in tones(ch, 48): song.add('accordion', song.bar(b), 3.9, p, 64)
    if sec == 1 and k % 2 == 1: hey(b, 3.0, ch, 82)
fill(31); fill(39, big=True)
snare_roll(38, 0, 4, 60, 100); snare_roll(39, 0, 3, 90, 124)

# ---- C Sprint in E-Dur (40–55) ---------------------------------------------------------------
crash(40, 120)
SH = 2
for i in range(16):
    b, k, sec = 40 + i, i % 8, i // 8
    ch = (CHORDS_A1 if sec == 0 else CHORDS_A2)[k]
    mel = (MEL_A1 if sec == 0 else MEL_A2)[k]
    oompah(b, ch, 104, SH, tuba=True); pah(b, ch, 84, SH, lo=57)
    strum(b, ch, 76, SH)
    groove(b, 'sprint', 1.0 + 0.03 * sec)
    line(b, mel, ['violin', 'accmel', 'brass'], [100, 84, 74 if sec == 0 else 84], sh=SH)
    line(b, mel, ['whistle'], [78 + 6 * sec], sh=SH + 12)
    if sec == 1: line(b, mel, ['choir'], [60], sh=SH - 12)
    if k in (1, 3, 5, 7): hey(b, 3.0, ch, 92, SH)
    if k == 0 and b != 40: crash(b, 108)
fill(43); fill(47); fill(51); fill(55, big=True)
snare_roll(54, 0, 4, 70, 110); snare_roll(55, 0, 3, 100, 127)

# ---- D Ziel (56–71) --------------------------------------------------------------------------
crash(56, 122)
for i in range(8):                                     # Shanty voll in D
    b, k = 56 + i, i
    ch = CHORDS_A1[k]
    oompah(b, ch, 104, tuba=True); pah(b, ch, 86); strum(b, ch, 74)
    groove(b, 'sprint', 1.02)
    line(b, MEL_A1[k], ['violin', 'accmel', 'brass'], [100, 86, 76])
    line(b, MEL_A1[k], ['whistle'], [80], sh=12)
    if k in (3, 7): hey(b, 3.0, ch, 92)
CHORDS_E = ['Bm', 'Bm', 'G', 'G', 'D', 'D', 'A', 'A']
MEL_E = [
    [(0, 1, 'F#5'), (1, 1, 'D5'), (2, 1, 'B4'), (3, 1, 'D5')],
    [(0, 1, 'F#5'), (1, 1, 'D5'), (2, 2, 'B4')],
    [(0, 1, 'G5'), (1, 1, 'D5'), (2, 1, 'B4'), (3, 1, 'D5')],
    [(0, 1, 'G5'), (1, 1, 'B5'), (2, 2, 'G5')],
    [(0, 1, 'F#5'), (1, 1, 'A5'), (2, 1, 'F#5'), (3, 1, 'D5')],
    [(0, 1, 'A5'), (1, 1, 'F#5'), (2, 2, 'D5')],
    [(0, 1, 'E5'), (1, 1, 'A5'), (2, 1, 'C#6'), (3, 1, 'A5')],
    [(0, .5, 'E5'), (.5, .5, 'A5'), (1, .5, 'C#6'), (1.5, .5, 'E6'), (2, 2, 'C#6')],
]
for i in range(8):
    b = 64 + i; ch = CHORDS_E[i]
    oompah(b, ch, 100 + i, tuba=True); pah(b, ch, 78 + i * 2)
    if i < 6: groove(b, 'sprint', 1.0)
    else: snare_roll(b, 0, 4, 60 + (i - 6) * 20, 100 + (i - 6) * 20)
    strum(b, ch, 72 + i * 2) if i < 6 else None
    for p in tones(ch, 55): song.add('choir', song.bar(b), 3.9, p, 56 + i * 4)
    if i < 7:
        assert all(nt(p) % 12 in SCALE_D for _, _, p in MEL_E[i])
        line(b, MEL_E[i], ['violin', 'brass', 'whistle'], [98, 80, 72])
line(71, MEL_E[7], ['violin', 'brass', 'whistle'], [104, 90, 84])
fill(67); fill(71, big=True)

sf2, out = cli_paths('bgm_theme_raceboats.ogg')
song.render(sf2, out)
