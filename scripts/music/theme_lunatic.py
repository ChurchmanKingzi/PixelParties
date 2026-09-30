# -*- coding: utf-8 -*-
"""Theme-Battle-Track „Moonstruck Madness“ → public/music/bgm_theme_lunatic.ogg

Archetyp Lunatic (Lunatic-Cycle: Neumond → Sichel → Halbmond → Gibbous → Vollmond, Wolf, Golem, Hawk).
fis-Moll (mit phrygischer kleiner Sekunde g), 130 BPM, 60 Takte (≈ 110,8 s), nahtlos loopbar.
Der Track ist selbst ein Mondzyklus: die Lautstärke/Dichte wächst von Neumond bis Vollmond und schwindet wieder.
Rhythmus: Walzer-artiger 3+3+2-Swing (Bass auf 1, 2½, 4; Pizzicato-Akkorde dazwischen) im 4/4-Gewand.
Theremin-Stimme = synvoice/fifths/whistle, fahle Spieluhr (glock), Wolfsheulen = gleitende Streicher
(Pitch-Bend), Kirchenglocke (tiefe Röhrenglocke), schiefe Orgel im Vollmond.

Aufbau (Takte, 0-basiert):
   0– 7  Neumond    Spieluhr-Thema, 3+3+2-Bass, Pizzicato-Stabs, Kirchenglocke
   8–15  Sichel     Theremin übernimmt das Thema, Tremolo-Streicher
  16–23  Halbmond   neue Harmonik (D – A – E – g), Orgel, Toms
  24–31  Gibbous    Thema hoch (Pfeife + Theremin), 16tel-Streicher, Wolfsheulen am Ende
  32–47  Vollmond   ekstatisch: Theremin + Fifths-Lead, rasende Läufe, Orgel, Heulen, Glocken
  48–55  Abnehmend  Halbmond-Harmonik, Gegenstimme fällt, Glocken
  56–59  Rückführung Schwund → Dominante cis, Wirbel → Sprung zum Neumond
Aufruf:  python3 scripts/music/theme_lunatic.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
import mido

BPM, BARS = 130, 60                          # 60 × 4 × 60/130 = 110,8 s
song = Song(bpm=BPM, bars=BARS)
song.inst('bass',   'sbass',    100, 60)
song.inst('pizz',   'pizz',      92, 40)
song.inst('tremolo','tremolo',   70, 86)
song.inst('theremin','synvoice', 90, 72)
song.inst('lead2',  'fifths',    72, 52)
song.inst('whistle','whistle',   64, 78)
song.inst('music',  'glock',     84, 58)
song.inst('organ',  'rockorgan', 66, 46)
song.inst('howl',   'slowstr',   84, 66)
song.inst('bell',   'bell',      92, 64)
song.inst('timp',   'timp',      90, 64)

SCALE = {Gb, G, A, B, Db, D, E, F}           # fis-Moll, phrygisches g, harmonisches Eis(=f)
NAMES = {'C': C, 'C#': Db, 'D': D, 'E': E, 'F': F, 'F#': Gb, 'G': G, 'G#': Ab, 'A': A, 'B': B}
def nt(s): return n(NAMES[s[:-1]], int(s[-1]))
def chk(p): assert p % 12 in SCALE, p; return p

ROOT = {'F#m': 30, 'G': 31, 'D': 38, 'A': 33, 'E': 40, 'C#': 37}     # Bass, Oktave 1–2
TRI = {'F#m': [54, 57, 61], 'G': [55, 59, 62], 'D': [50, 54, 57], 'A': [57, 61, 64], 'E': [52, 56, 59], 'C#': [49, 53, 56]}

def line(b, notes, insts, vels, shift=0):
    for off, dur, p in notes:
        for inst, v in zip(insts, vels): song.add(inst, song.bar(b) + off, dur * 0.94, chk(nt(p) + shift), v)

def bass(b, ch, v=100, busy=False):
    """3+3+2: Achtel 0, 3, 6 (Beat 0, 1,5, 3)."""
    s, r = song.bar(b), ROOT[ch]
    song.add('bass', s, 1.4, r, v + 8); song.add('bass', s + 1.5, 1.4, r + 12 if busy else r, v - 6)
    song.add('bass', s + 3, 0.9, r + 7 if busy else r, v - 2)
    if busy: song.add('bass', s + 2.5, 0.4, r, v - 16)

def stabs(b, ch, v=84, full=False):
    """Walzer-Pizzicato: Akkord auf den schwachen Achteln zwischen den Bassschlägen."""
    s = song.bar(b)
    offs = (0.5, 1.0, 2.0, 2.5, 3.5) if not full else (0.5, 1.0, 2.0, 2.5, 3.5, 1.75)
    for off in offs:
        for p in TRI[ch]: song.add('pizz', s + off, 0.4, p + 12, v + (6 if off in (1.0, 2.5) else 0))

def tremolo(b, ch, v=64, rapid=False):
    if rapid:
        for i in range(16):
            for p in TRI[ch][1:]: song.add('tremolo', song.bar(b) + i * 0.25, 0.22, p + 12, v + (8 if i % 4 == 0 else 0))
    else:
        for p in TRI[ch]: song.add('tremolo', song.bar(b), 3.98, p + 12, v)

def organ(b, ch, v=66):
    for p in TRI[ch]: song.add('organ', song.bar(b), 3.98, p, v)

def toll(b, beat=0, pitch=54, v=100): song.add('bell', song.bar(b) + beat, 3.8, pitch, v)

def howl(b, beat, dur, pitch, v=96):
    ch = song.ch['howl'][0]; t0 = int(round((song.bar(b) + beat) * TPB)); t1 = int(round((song.bar(b) + beat + dur) * TPB))
    steps = 24
    for i in range(steps + 1):
        f = i / steps
        val = -6000 + (14000 * (f / 0.55) if f < 0.55 else 14000 - 12000 * ((f - 0.55) / 0.45))
        song.ev.append((t0 + int((t1 - t0) * f), 0, mido.Message('pitchwheel', channel=ch, pitch=int(max(-8192, min(8191, val))))))
    song.add('howl', song.bar(b) + beat, dur, pitch, v)

def groove(b, kind, v=1.0):
    s = song.bar(b)
    def d(o, note, vel): song.dr(s + o, note, vel * v)
    if kind == 'A':
        d(0, KICK, 108); d(1.5, TOM_L, 96); d(3, KICK, 100)
        for o in (0.5, 1.0, 2.0, 2.5): d(o, SIDESTICK, 84)
        d(3.5, COWBELL, 84)
    elif kind == 'B':
        for o, vv in ((0, 112), (1.5, 100), (3, 104)): d(o, KICK, vv)
        d(2, SNARE, 100); d(1.5, CLAP, 76); d(3, CLAP, 80)
        for o in (0.5, 1.0, 2.5, 3.5): d(o, SIDESTICK, 88)
        d(2.75, TOM_M, 80)
    elif kind == 'C':
        for o, vv in ((0, 118), (0.75, 88), (1.5, 106), (3, 110)): d(o, KICK, vv)
        d(1, SNARE, 108); d(2.5, SNARE, 112); d(3, CLAP, 88); d(1.5, CLAP, 84)
        d(3.5, TOM_L, 98); d(2, TOM_M, 92)
        for i in range(8): d(i * 0.5, COWBELL, 76 if i % 2 == 0 else 58)

def fill(b, big=False):
    s = song.bar(b); toms = [TOM_H, TOM_HH, TOM_M, TOM_L]
    if big:
        for i in range(8): song.dr(s + 1.5 + i * 0.25, SNARE, 70 + i * 6, 0.12)
    for i in range(8): song.dr(s + 2.0 + i * 0.25, toms[min(3, i // 2)], 88 + i * 4, 0.2)
    song.dr(s + 3.75, KICK, 118)

def roll(b, a, z, v0, v1):
    s = song.bar(b) + a; cnt = int((z - a) * 4)
    for i in range(cnt): song.dr(s + i * 0.25, SNARE, v0 + (v1 - v0) * i / max(1, cnt - 1), 0.15)

def crash(b, v=110): song.dr(song.bar(b), CRASH, v, 0.5)

# ---- Themen ---------------------------------------------------------------------------
CH_T = ['F#m', 'G', 'F#m', 'E', 'D', 'A', 'G', 'C#']
MEL_T = [
    [(0, 1.5, 'C#5'), (1.5, 1.5, 'F#5'), (3, 1, 'E5')],
    [(0, 1.5, 'D5'), (1.5, 1.5, 'G5'), (3, 1, 'F#5')],
    [(0, 1.5, 'A5'), (1.5, 1.5, 'F#5'), (3, 1, 'C#5')],
    [(0, 1.5, 'B4'), (1.5, 1.5, 'E5'), (3, 1, 'C#5')],
    [(0, 1.5, 'A4'), (1.5, 1.5, 'D5'), (3, 1, 'F#5')],
    [(0, 1.5, 'E5'), (1.5, 1.5, 'A5'), (3, 1, 'G5')],
    [(0, 1.5, 'B5'), (1.5, 1.5, 'G5'), (3, 1, 'D5')],
    [(0, 1.5, 'E5'), (1.5, 1.5, 'C#5'), (3, 1, 'B4')],
]
CH_H = ['F#m', 'D', 'A', 'E', 'F#m', 'D', 'G', 'C#']
MEL_H = [
    [(0, 1.5, 'A4'), (1.5, 1.5, 'C#5'), (3, 1, 'A4')],
    [(0, 1.5, 'D5'), (1.5, 1.5, 'F#5'), (3, 1, 'A5')],
    [(0, 1.5, 'E5'), (1.5, 1.5, 'C#5'), (3, 1, 'A4')],
    [(0, 1.5, 'B4'), (1.5, 1.5, 'E5'), (3, 1, 'D5')],
    [(0, 1.5, 'C#5'), (1.5, 1.5, 'F#5'), (3, 1, 'A5')],
    [(0, 1.5, 'A5'), (1.5, 1.5, 'F#5'), (3, 1, 'D5')],
    [(0, 1.5, 'B4'), (1.5, 1.5, 'D5'), (3, 1, 'G5')],
    [(0, 1.5, 'E5'), (1.5, 1.5, 'C#5'), (3, 1, 'B4')],
]
CH_V = ['F#m', 'G', 'A', 'E', 'D', 'G', 'C#', 'C#']
MEL_V = [
    [(0, .5, 'C#5'), (.5, .5, 'F#5'), (1, .5, 'A5'), (1.5, 1.5, 'C#6'), (3, 1, 'B5')],
    [(0, .5, 'D5'), (.5, .5, 'G5'), (1, .5, 'B5'), (1.5, 1.5, 'D6'), (3, 1, 'C#6')],
    [(0, .5, 'E5'), (.5, .5, 'A5'), (1, .5, 'C#6'), (1.5, 1.5, 'E6'), (3, 1, 'D6')],
    [(0, 1.5, 'B5'), (1.5, 1.5, 'G5'), (3, 1, 'E5')],
    [(0, .5, 'A4'), (.5, .5, 'D5'), (1, .5, 'F#5'), (1.5, 1.5, 'A5'), (3, 1, 'F#5')],
    [(0, 1.5, 'G5'), (1.5, 1.5, 'D5'), (3, 1, 'B4')],
    [(0, .5, 'E5'), (.5, .5, 'C#5'), (1, .5, 'B4'), (1.5, 1.5, 'E5'), (3, 1, 'C#5')],
    [(0, 3, 'C#5'), (3, 1, 'B4')],
]
# Gegenstimme (Orgel/Streicher): fallende Linie, eine Note pro Takt
CTR = ['A4', 'B4', 'A4', 'G5', 'F#4', 'E4', 'D4', 'E4']

# ==== Arrangement ========================================================================
# Neumond 0–7: fahl, Spieluhr + Pizzicato, Puls von Anfang an
for i in range(8):
    b = i; ch = CH_T[i]
    bass(b, ch, 92); stabs(b, ch, 78); groove(b, 'A', 1.0)
    line(b, MEL_T[i], ['music', 'theremin'], [96, 56])
    tremolo(b, ch, 46 + i * 2)
toll(0, 0, 54, 96); toll(4, 0, 54, 92); fill(7); crash(0, 100)

# Sichel 8–15: Theremin führt, Tremolo-Streicher
for i in range(8):
    b = 8 + i; ch = CH_T[i]
    bass(b, ch, 96); stabs(b, ch, 82); groove(b, 'B', 0.95 + i * 0.01)
    line(b, MEL_T[i], ['theremin', 'music'], [98, 80]); tremolo(b, ch, 62 + i * 2)
toll(8, 0, 54, 96); toll(12, 0, 54, 92); crash(8, 104); fill(15, big=True)

# Halbmond 16–23: neue Harmonik, Orgel, Toms
for i in range(8):
    b = 16 + i; ch = CH_H[i]
    bass(b, ch, 100, busy=True); stabs(b, ch, 86); groove(b, 'B', 1.05)
    line(b, MEL_H[i], ['theremin', 'music'], [100, 80]); tremolo(b, ch, 72); organ(b, ch, 58 + i * 2)
    song.add('timp', song.bar(b), 0.5, ROOT[ch] + 12 if ROOT[ch] < 36 else ROOT[ch], 88)
toll(16, 0, 54, 100); toll(20, 0, 61, 96); crash(16, 108); fill(19); fill(23, big=True)

# Gibbous 24–31: Thema hoch, 16tel-Streicher, Heulen am Ende
for i in range(8):
    b = 24 + i; ch = CH_T[i]
    bass(b, ch, 104, busy=True); stabs(b, ch, 90, full=True); groove(b, 'C', 1.0)
    line(b, MEL_T[i], ['theremin', 'whistle', 'music'], [100, 76, 80])
    line(b, MEL_T[i], ['lead2'], [70], shift=-12)
    tremolo(b, ch, 66, rapid=True); organ(b, ch, 68)
    song.add('timp', song.bar(b), 0.5, ROOT[ch] + 12 if ROOT[ch] < 36 else ROOT[ch], 94)
toll(24, 0, 54, 104); toll(28, 0, 61, 100); crash(24, 112)
howl(30, 0, 4, nt('C#5'), 88); howl(31, 0, 2.5, nt('F#5'), 92); fill(27); fill(31, big=True); roll(30, 0, 4, 60, 96)

# Vollmond 32–47: Ekstase (2 × 8 Takte: Thema, dann Läufe)
for i in range(16):
    b, k = 32 + i, i % 8; second = i >= 8
    ch = (CH_T if not second else CH_V)[k]
    bass(b, ch, 108, busy=True); stabs(b, ch, 92, full=True); groove(b, 'C', 1.08)
    mel = MEL_T[k] if not second else MEL_V[k]
    line(b, mel, ['theremin', 'lead2', 'music'] + (['whistle'] if second else []), [104, 84, 84, 70])
    tremolo(b, ch, 74, rapid=True); organ(b, ch, 74)
    song.add('timp', song.bar(b), 0.5, ROOT[ch] + 12 if ROOT[ch] < 36 else ROOT[ch], 98)
    if k % 2 == 0: toll(b, 0, 54 if k % 4 == 0 else 61, 100)
    if k % 4 == 0 and b != 32: crash(b, 104)
crash(32, 118); crash(40, 114)
for b, p in ((35, 'C#5'), (39, 'F#5'), (43, 'C#5'), (47, 'A5')): howl(b, 0, 3.5, nt(p), 94)
fill(35); fill(39); fill(43); roll(46, 0, 4, 70, 106); roll(47, 0, 3, 104, 126); fill(47, big=True)

# Abnehmender Mond 48–55: Halbmond-Harmonik, Gegenstimme fällt
for i in range(8):
    b = 48 + i; ch = CH_H[i]
    bass(b, ch, 98, busy=True); stabs(b, ch, 84); groove(b, 'B', 1.04 - i * 0.01)
    line(b, MEL_H[i], ['theremin', 'music'], [98 - i, 84]); tremolo(b, ch, 70 - i * 2); organ(b, ch, 62)
    song.add('howl', song.bar(b), 3.9, chk(nt(CTR[i]) - 12), 50)
    if i % 2 == 0: toll(b, 0, 54, 96 - i * 2)
crash(48, 108); howl(52, 0, 4, nt('E5'), 84); fill(51); fill(55)

# Rückführung 56–59: Schwund, Dominante cis, Wirbel → Neumond
for i, ch in enumerate(['F#m', 'G', 'C#', 'C#']):
    b = 56 + i
    bass(b, ch, 96 + i * 3, busy=True); stabs(b, ch, 84)
    if i < 2: groove(b, 'B', 1.0)
    else: roll(b, 0, 4, 66 + (i - 2) * 20, 96 + (i - 2) * 22)
    tremolo(b, ch, 62 + i * 4, rapid=(i >= 2))
    song.add('timp', song.bar(b), 0.5, ROOT[ch] + 12 if ROOT[ch] < 36 else ROOT[ch], 90)
line(56, [(0, 1.5, 'A4'), (1.5, 1.5, 'C#5'), (3, 1, 'A4')], ['theremin', 'music'], [92, 80])
line(57, [(0, 1.5, 'B4'), (1.5, 1.5, 'D5'), (3, 1, 'G5')], ['theremin', 'music'], [92, 80])
line(58, [(0, 1, 'E5'), (1, 1, 'C#5'), (2, 1, 'B4'), (3, 1, 'E5')], ['theremin', 'music'], [96, 84])
line(59, [(0, .5, 'E5'), (.5, .5, 'D5'), (1, .5, 'C#5'), (1.5, .5, 'B4'), (2, 2, 'C#5')], ['theremin', 'music'], [100, 88])
toll(58, 0, 61, 98); fill(57); fill(59, big=True)

sf2, out = cli_paths('bgm_theme_lunatic.ogg')
song.render(sf2, out)
