# -*- coding: utf-8 -*-
"""Theme „Jaws of the Deep“ (Archetyp Greatmaw: Hai-Jagd + Sirenengesang) → public/music/bgm_theme_greatmaw.ogg

Räuberische Tiefsee-Jagd in h-Moll/phrygisch, 118 BPM, 60 Takte (122,0 s), nahtlos loopbar.
Ein Kontrabass-Ostinato aus Halbtonpulsen (h–c, „Jaws“) beschleunigt sich Stufe für Stufe
(Halbe → Viertel → Achtel → 16tel): der Hai kommt näher. Darüber das Hai-Thema (Fagott/Posaune,
später Trompete), Pauken als Herzschlag, Blech-Schläge und Orchester-Hits als Angriffe und –
als Gegenpol – der Sirenengesang: eine Kunststimme (synvoice) mit „Ooh“-Chor, weit schwingende
Melodiebögen mit chromatischem Klagen (ais, c), dazu Harfen-Wellen.
Räuberisch statt Horror: durchgehend treibender Halbzeit-Beat.

Aufbau (Takte, 0-basiert):
   0– 7  Intro          Ostinato Halbe→Achtel, Herzschlag-Pauke/Toms, Tremolo-Swell, Hits, ab Takt 4 Haithema
   8–23  Thema A        Haithema in Fagott + Posaune, Achtel-Ostinato, Angriffs-Swells alle 4 Takte,
                        zweiter Durchgang mit Violine/Hörnern, Sirenen-Vorahnung (Ooh) ab Takt 20
  24–39  Sirenen B      Sirenengesang (synvoice + Chor) über h G e C | h G C fis, dann e C G D | e C fis fis;
                        Harfen-Wellen, Blechschläge, Pauken-Galopp
  40–51  Angriff C      Ostinato in 16teln, Haithema in Trompete + Posaune + Fagott, Sirenen-Kontrapunkt hoch,
                        Toms/Kick in Vierteln
  52–59  Rückführung D  Ostinato fällt zurück auf Halbe, Haithema leise in Hörnern, Tremolo, Pauken → Sprung auf Takt 0

Harmonie: h-Moll mit Phrygisch-Klagen (c = bII), G/C/e als Farben, Dur-Dominante fis mit ais als
Leitton. Der Loop endet auf der Dominante fis (Halbschluss), keine Schlusskadenz.
Aufruf:  python3 scripts/music/theme_greatmaw.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 118, 60                        # 60 × 4 × 60/118 = 122,0 s
song = Song(bpm=BPM, bars=BARS)

song.inst('contra',   'contra',   110, 64)   # Jaws-Ostinato
song.inst('bass',     'sbass',     84, 60)   # Oktav-Verdopplung ab Achtel-Stufe
song.inst('bassoon',  'bassoon',   96, 44)   # Haithema
song.inst('trombone', 'trombone',  92, 80)
song.inst('timp',     'timp',      98, 64)
song.inst('tremolo',  'tremolo',   80, 84)   # Swells
song.inst('strings',  'strings',   70, 40)
song.inst('violin',   'violin',    78, 30)
song.inst('horns',    'horns',     84, 90)
song.inst('brass',    'brass',     92, 60)   # Blechschläge
song.inst('trumpet',  'trumpet',   88, 70)
song.inst('synvoice', 'synvoice',  92, 64)   # Sirene
song.inst('oohs',     'oohs',      80, 50)
song.inst('harp',     'harp',      82, 98)
song.inst('hit',      'hit',      100, 64)

NAMES = {'C': C, 'Db': Db, 'D': D, 'Eb': Eb, 'E': E, 'F': F, 'Gb': Gb, 'G': G, 'Ab': Ab, 'A': A, 'Bb': Bb, 'B': B,
         'C#': Db, 'D#': Eb, 'F#': Gb, 'G#': Ab, 'A#': Bb}
def nt(s): return n(NAMES[s[:-1]], int(s[-1]))
# erlaubte Melodietöne: h-Moll natürlich + c (phrygisch) + ais (Leitton der Dominante)
SCALE = {B, Db, D, E, Gb, G, A, C, Bb}
CH = {'Bm': (B, 3), 'C': (C, 4), 'G': (G, 4), 'Em': (E, 3), 'F#': (Gb, 4), 'D': (D, 4)}
def ramp(i, cnt, a, b): return a + (b - a) * i / max(1, cnt - 1)
def croot(ch): return 24 + CH[ch][0]                        # Oktave 1–2 (24–35)
def rm(ch): return 48 + CH[ch][0] if CH[ch][0] <= 6 else 36 + CH[ch][0]   # Mittellage 42–54
def line(b, notes, insts, vels):
    for off, dur, p in notes:
        pp = nt(p); assert pp % 12 in SCALE, f'Ton {p} in Takt {b} nicht in Skala'
        for inst, v in zip(insts, vels): song.add(inst, song.bar(b) + off, dur * 0.94, pp, v)

# ---- Jaws-Ostinato ---------------------------------------------------------------------
def jaws(b, ch, level, vel=100):
    """level 0: Halbe · 1: Viertel · 2: Achtel · 3: 16tel — Grundton und Halbton darüber im Wechsel."""
    q = song.bar(b); r = croot(ch)
    step = [2, 1, 0.5, 0.25][level]; cnt = int(4 / step)
    for i in range(cnt):
        p = r if i % 2 == 0 else r + 1
        song.add('contra', q + i * step, step * 0.9, p, vel + (8 if i % 2 == 0 else -4))
        if level >= 2: song.add('bass', q + i * step, step * 0.85, p + 12, vel - 14 + (6 if i % 2 == 0 else 0))

def timp(b, ch, kind='heart', vel=98, v1=None):
    q = song.bar(b)
    p = 36 + CH[ch][0] if CH[ch][0] >= 5 else 48 + CH[ch][0]     # 41–47
    if kind == 'heart':
        for off, v in ((0, 0), (0.5, -14), (2, -4), (2.5, -16)): song.add('timp', q + off, 0.4, p, vel + v)
    elif kind == 'gallop':
        for off, v in ((0, 0), (1, -8), (1.5, -14), (2, -2), (3, -8), (3.5, -14)): song.add('timp', q + off, 0.4, p, vel + v)
    elif kind == 'roll':
        for i in range(16): song.add('timp', q + i * 0.25, 0.25, p, ramp(i, 16, vel, v1 or vel))

def swell(b, ch, v0, v1, inst='tremolo', bars=1):
    """Tremolo-Streicher-Akkord, dessen Lautstärke über `bars` Takte anschwillt (Velocity über 4 Teilnoten)."""
    r = rm(ch) + 12; ct = CH[ch][1]
    for k in range(4 * bars):
        v = ramp(k, 4 * bars, v0, v1)
        for p in (r, r + ct, r + 7): song.add(inst, song.bar(b) + k, 1.0, p, v)

def pad(inst, b, ch, vel=64, octv=12):
    r = rm(ch) + octv
    for p in (r, r + CH[ch][1], r + 7): song.add(inst, song.bar(b), 3.95, p, vel)

def stab(b, beat, ch, vel=100, inst='brass', dur=0.6):
    r = rm(ch) + 12; ct = CH[ch][1]
    for p in (r, r + ct, r + 7, r + 12): song.add(inst, song.bar(b) + beat, dur, p, vel)

def hit(b, beat, ch, vel=110, dur=1.0):
    r = rm(ch) + 12
    for p in (r - 12, r, r + 7, r + 12): song.add('hit', song.bar(b) + beat, dur, p, vel)

def waves(b, ch, vel=70):
    """Harfen-Welle: Akkordtöne in Achteln auf- und absteigend (Wasser)."""
    r = rm(ch) + 12; ct = CH[ch][1]
    seq = [r, r + ct, r + 7, r + 12, r + 12 + ct, r + 12, r + 7, r + ct]
    for i, p in enumerate(seq): song.add('harp', song.bar(b) + i * 0.5, 0.45, p, vel + (8 if i in (0, 3) else 0))

# ---- Schlagzeug ------------------------------------------------------------------------
TOMS = [TOM_H, TOM_HH, TOM_M, TOM_L]
def groove(b, kind, v=1.0):
    q = song.bar(b)
    def d(off, note, vel): song.dr(q + off, note, min(127, vel * v))
    if kind == 'A':      # Halbzeit-Schub
        for off, vel in ((0, 118), (0.75, 96), (2.5, 104)): d(off, KICK, vel)
        d(2, SNARE, 116); d(1, TOM_L, 96); d(3.5, TOM_M, 92)
        for i in range(8): d(i * 0.5, HAT, 108 if i % 2 == 0 else 100)
    elif kind == 'B':
        for off, vel in ((0, 118), (1.5, 100), (2.5, 104), (3.25, 92)): d(off, KICK, vel)
        d(2, SNARE, 118); d(2, CLAP, 92); d(1, TOM_L, 100); d(3, TOM_M, 96)
        for i in range(8): d(i * 0.5, HAT, 110 if i % 2 == 0 else 100)
    elif kind == 'C':    # Angriff: Vierteltreten
        for off in (0, 1, 2, 3): d(off, KICK, 118 if off == 0 else 106)
        d(1, SNARE, 112); d(3, SNARE, 116); d(1, CLAP, 90); d(3, CLAP, 96)
        d(1.5, TOM_L, 98); d(2.5, TOM_M, 96); d(3.5, TOM_H, 96)
        for i in range(8): d(i * 0.5, RIDE, 112 if i % 2 == 0 else 100)
    elif kind == 'heart':
        d(0, KICK, 112); d(0.5, KICK, 92); d(2, KICK, 106); d(2.5, KICK, 88)
        d(1, TOM_L, 92); d(3, SNARE, 100); d(3.5, TOM_M, 84)
        for i in range(8): d(i * 0.5, HAT, 104 if i % 2 == 0 else 96)

def fill(b, big=False):
    q = song.bar(b)
    for i in range(8): song.dr(q + 2 + i * 0.25, TOMS[min(3, i // 2)], ramp(i, 8, 88, 118), 0.2)
    song.dr(q + 3.75, KICK, 118)
    if big:
        for i in range(8): song.dr(q + 1 + i * 0.125, SNARE, ramp(i, 8, 60, 104), 0.1)
def roll(b, st, en, v0, v1):
    q = song.bar(b) + st; cnt = int((en - st) * 4)
    for i in range(cnt): song.dr(q + i * 0.25, SNARE, ramp(i, cnt, v0, v1), 0.15)
def crash(b, vel=112): song.dr(song.bar(b), CRASH, vel, 0.5)

# ---- Melodien --------------------------------------------------------------------------
CH_A = ['Bm', 'Bm', 'C', 'Bm', 'Bm', 'G', 'C', 'F#']
SHARK = [
    [(0, 1.5, 'B3'), (1.5, 0.5, 'C4'), (2, 1.5, 'B3'), (3.5, 0.5, 'F#3')],
    [(0, 1, 'D4'), (1, 1, 'C4'), (2, 2, 'B3')],
    [(0, 1.5, 'C4'), (1.5, 0.5, 'D4'), (2, 1.5, 'E4'), (3.5, 0.5, 'D4')],
    [(0, 2, 'D4'), (2, 1, 'C4'), (3, 1, 'B3')],
    [(0, 1.5, 'B3'), (1.5, 0.5, 'C4'), (2, 1.5, 'B3'), (3.5, 0.5, 'F#3')],
    [(0, 1, 'G3'), (1, 1, 'B3'), (2, 1, 'D4'), (3, 1, 'B3')],
    [(0, 1, 'C4'), (1, 1, 'E4'), (2, 1, 'G4'), (3, 1, 'E4')],
    [(0, 1.5, 'F#4'), (1.5, 0.5, 'A#4'), (2, 1, 'C#5'), (3, 1, 'A#4')],
]
CH_B1 = ['Bm', 'G', 'Em', 'C', 'Bm', 'G', 'C', 'F#']
SIREN1 = [
    [(0, 2, 'F#5'), (2, 1, 'E5'), (3, 1, 'D5')],
    [(0, 2, 'D5'), (2, 1, 'B4'), (3, 1, 'D5')],
    [(0, 2, 'E5'), (2, 1, 'G5'), (3, 1, 'F#5')],
    [(0, 1, 'E5'), (1, 1, 'D5'), (2, 2, 'C5')],
    [(0, 2, 'B5'), (2, 1, 'A5'), (3, 1, 'F#5')],
    [(0, 1, 'G5'), (1, 1, 'F#5'), (2, 1, 'D5'), (3, 1, 'B4')],
    [(0, 2, 'C5'), (2, 1, 'E5'), (3, 1, 'G5')],
    [(0, 2, 'A#5'), (2, 1, 'G5'), (3, 1, 'F#5')],
]
CH_B2 = ['Em', 'C', 'G', 'D', 'Em', 'C', 'F#', 'F#']
SIREN2 = [
    [(0, 1, 'G5'), (1, 1, 'B5'), (2, 2, 'D6')],
    [(0, 2, 'C6'), (2, 1, 'B5'), (3, 1, 'G5')],
    [(0, 1, 'B5'), (1, 1, 'D6'), (2, 2, 'B5')],
    [(0, 2, 'A5'), (2, 1, 'F#5'), (3, 1, 'A5')],
    [(0, 2, 'G5'), (2, 1, 'F#5'), (3, 1, 'E5')],
    [(0, 2, 'E5'), (2, 2, 'G5')],
    [(0, 1, 'F#5'), (1, 1, 'A#5'), (2, 2, 'C#6')],
    [(0, 1, 'A#5'), (1, 1, 'G5'), (2, 2, 'F#5')],
]
CH_C = ['Bm', 'Bm', 'C', 'Bm', 'Bm', 'G', 'C', 'F#', 'Bm', 'C', 'Bm', 'F#']
MEL_C = [
    [(0, 1, 'B4'), (1, 0.5, 'C5'), (1.5, 0.5, 'B4'), (2, 1, 'F#4'), (3, 1, 'B4')],
    [(0, 1, 'D5'), (1, 1, 'C5'), (2, 2, 'B4')],
    [(0, 1, 'C5'), (1, 1, 'E5'), (2, 1.5, 'G5'), (3.5, 0.5, 'E5')],
    [(0, 2, 'D5'), (2, 1, 'F#5'), (3, 1, 'D5')],
    [(0, 1, 'B4'), (1, 0.5, 'C5'), (1.5, 0.5, 'B4'), (2, 1, 'F#4'), (3, 1, 'B4')],
    [(0, 1, 'B4'), (1, 1, 'D5'), (2, 1, 'G5'), (3, 1, 'D5')],
    [(0, 1, 'C5'), (1, 1, 'E5'), (2, 1, 'G5'), (3, 1, 'C6')],
    [(0, 2, 'C#6'), (2, 1, 'A#5'), (3, 1, 'F#5')],
    [(0, 2, 'B5'), (2, 1, 'F#5'), (3, 1, 'D5')],
    [(0, 2, 'E5'), (2, 1, 'G5'), (3, 1, 'E5')],
    [(0, 1, 'F#5'), (1, 1, 'D5'), (2, 1, 'C5'), (3, 1, 'B4')],
    [(0, 1, 'A#4'), (1, 1, 'C#5'), (2, 1, 'F#5'), (3, 1, 'A#5')],
]
# Sirenen-Kontrapunkt im Angriff: hohe Haltetöne (Akkordtöne)
DESC_C = ['F#5', 'F#5', 'G5', 'F#5', 'F#5', 'D5', 'G5', 'C#6', 'D6', 'G5', 'D6', 'C#6']

# ==== Arrangement ===========================================================================
# ---- Intro (0–7) -------------------------------------------------------------------------
CH_I = ['Bm', 'Bm', 'C', 'Bm', 'Bm', 'G', 'C', 'F#']
hit(0, 0, 'Bm', 118, 1.8); crash(0, 108)
for i, ch in enumerate(CH_I):
    b = i
    jaws(b, ch, 0 if i < 2 else (1 if i < 4 else 2), 92 + i * 2)
    timp(b, ch, 'heart', 88 + i * 2)
    groove(b, 'heart', 0.95 + i * 0.01)
    pad('strings', b, ch, 52 + i * 4, 0)
    swell(b, ch, 44 + (i % 4) * 4, 74 + (i % 4) * 6)
    if i >= 4:
        line(b, SHARK[i], ['bassoon'], [84 + (i - 4) * 3])
        if i in (4, 6): hit(b, 0, ch, 96 + (i - 4) * 4, 0.8)
fill(3); fill(6)
roll(7, 0, 3.5, 50, 118); fill(7, True)

# ---- Thema A (8–23) ---------------------------------------------------------------------
hit(8, 0, 'Bm', 116, 1.0); crash(8, 112)
for i in range(16):
    b, k = 8 + i, i % 8; ch = CH_A[k]; second = i >= 8
    jaws(b, ch, 2, 98 + (4 if second else 0))
    timp(b, ch, 'heart', 96)
    groove(b, 'A', 1.0 if not second else 1.05)
    line(b, SHARK[k], ['bassoon', 'trombone'], [96, 74] if not second else [98, 82])
    pad('strings', b, ch, 62, 0)
    if second:
        line(b, SHARK[k], ['violin'], [80])
        if k >= 4: pad('oohs', b, ch, 46 + (k - 4) * 6, 12)
        if k in (1, 3, 5): stab(b, 0, ch, 88, 'horns', 0.9)
    if k % 4 == 3: swell(b, ch, 60, 100)          # Angriffs-Swell zum nächsten Viertakter
    else: swell(b, ch, 44, 60)
    if k % 4 == 0 and b > 8: hit(b, 0, ch, 104, 0.7); crash(b, 100)
fill(15); crash(16, 104); fill(19); fill(23, True)
roll(22, 2, 4, 60, 100); roll(23, 0, 3.5, 90, 124)

# ---- Sirenen B (24–39) -------------------------------------------------------------------
hit(24, 0, 'Bm', 118, 1.2); crash(24, 116); crash(32, 114)
for i in range(16):
    b, k = 24 + i, i % 8; second = i >= 8
    ch = (CH_B1 if not second else CH_B2)[k]
    sir = (SIREN1 if not second else SIREN2)[k]
    jaws(b, ch, 2, 100)
    timp(b, ch, 'gallop', 96)
    groove(b, 'B', 1.0 if not second else 1.05)
    line(b, sir, ['synvoice', 'oohs'], [94 + (4 if second else 0), 70])
    pad('strings', b, ch, 68, 0)
    waves(b, ch, 64 + (6 if second else 0))
    if k % 2 == 0: stab(b, 0, ch, 96 if k % 4 == 0 else 84)
    if k in (3, 7): stab(b, 2.5, ch, 100, 'brass', 0.5); swell(b, ch, 70, 105)
fill(27); fill(31); fill(35); fill(39, True)
roll(38, 0, 4, 60, 105); roll(39, 0, 3.5, 100, 127)

# ---- Angriff C (40–51) -------------------------------------------------------------------
hit(40, 0, 'Bm', 122, 1.2); crash(40, 120); crash(48, 116)
for i in range(12):
    b = 40 + i; ch = CH_C[i]
    jaws(b, ch, 3, 104)
    timp(b, ch, 'gallop', 102)
    groove(b, 'C', 1.0)
    line(b, MEL_C[i], ['trumpet', 'trombone', 'bassoon'], [98, 84, 80])
    pad('strings', b, ch, 76, 0)
    swell(b, ch, 66, 90)
    r = rm(ch) + 24
    song.add('synvoice', song.bar(b), 3.9, nt(DESC_C[i]), 90)
    song.add('oohs', song.bar(b), 3.9, nt(DESC_C[i]) - 5, 66)
    waves(b, ch, 56)
    if i % 4 == 0 and i > 0: crash(b, 100)
    if i % 2 == 0: stab(b, 0, ch, 92, 'horns', 0.9)
fill(43); fill(47); fill(51, True)
roll(50, 2, 4, 70, 110); roll(51, 0, 3.5, 100, 127)

# ---- Rückführung D (52–59) ---------------------------------------------------------------
CH_D = ['Bm', 'C', 'Bm', 'G', 'C', 'Bm', 'F#', 'F#']
crash(52, 104)
for i, ch in enumerate(CH_D):
    b = 52 + i
    jaws(b, ch, 2 if i < 2 else (1 if i < 6 else 2), 100 - i * 2 if i < 6 else 100)
    timp(b, ch, 'heart' if i < 6 else 'roll', 94, 118)
    groove(b, 'A' if i < 4 else 'heart', 1.0)
    line(b, SHARK[i], ['horns', 'bassoon'], [82, 78])
    pad('strings', b, ch, 66, 0)
    swell(b, ch, 50 + i * 3, 70 + i * 5)
    if i >= 4: pad('oohs', b, ch, 50 + (i - 4) * 6, 12)
    if i >= 6: roll(b, 0, 3.5, 55 + (i - 6) * 20, 95 + (i - 6) * 20)
fill(55); fill(59, True)

sf2, out = cli_paths('bgm_theme_greatmaw.ogg')
song.render(sf2, out)
