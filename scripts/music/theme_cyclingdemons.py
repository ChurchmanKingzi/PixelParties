# -*- coding: utf-8 -*-
"""Battle-Track „Infernal Carousel“ (Cycling Demons) → public/music/bgm_theme_cyclingdemons.ogg

Unheimlicher Höllen-Karussell-Walzer im Kampftempo: cis-Moll (harmonisch), 3/4-Takt, 132 BPM,
88 Takte (120,0 s), nahtlos loopbar. Fünf Dämonen im Kreislauf → ein FÜNFER-Zyklus (fünf Achtel,
Marimba) läuft ununterbrochen gegen den Dreiviertel-Takt (sechs Achtel) und wandert dadurch durch
alle Taktpositionen; erst nach fünf Takten (30 Achtel) treffen sich beide wieder – dort schlägt die
Kirchenglocke. Ein zweiter Zyklus (vier Achtel, Pizzicato) und ein dritter (3 Viertel = Takt) legen
den Polyrhythmus. Karussell-Melodie in der Kalliope (Dampforgel), Walzerbegleitung mit Rockorgel
(Bass–Pah–Pah), Kirchenglocken, dämonischer Chor, im Höhepunkt Blech, Pauken und rasende 16tel-Drehungen.

Aufbau (Takte, 0-basiert):
   0– 7  Intro         Glocke, Kontrabass-Pedal, Orgel-Walzer, Kampf-Walzerschlagzeug, Zyklus setzt ein
  8–23   Thema A       Kalliope: Drehfigur (Arpeggio hoch/runter) + Seufzer, Gegenstimme Pfeifenorgel
 24–39   Zyklen B      Hemiolen-Melodie (2 gegen 3), lauter Fünferzyklus, Chor, Glocke alle 5 Takte
 40–55   Höhepunkt C   Blech + Kalliope, Themen-Pass 2 mit rasenden 16tel-Drehungen, Hits, Pauken
 56–63   Brücke D      fallende Bass-Chromatik/Fünf-Dämonen-Abstieg, Glocken, Zyklen laut
 64–79   Thema A'      Rückkehr, Pfeifenorgel-Melodie + Kalliope-Oktave, dichter
 80–87   Rückführung E Dominant-Orgelpunkt gis, Wirbel, Drehfigur → Sprung zurück auf Takt 0
Aufruf:  python3 scripts/music/theme_cyclingdemons.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS, BPB = 132, 88, 3               # 88 × 3 × 60/132 = 120,0 s
song = Song(bpm=BPM, bars=BARS, beats_per_bar=BPB)
song.inst('contra',  'contra',   84, 64)
song.inst('bass',    'bass2',    96, 60)
song.inst('organ',   'rockorgan',78, 46)   # Bass-Pah-Pah
song.inst('pipe',    'pipeorgan',72, 70)
song.inst('calli',   'calliope', 84, 68)   # Karussell-Melodie
song.inst('marimba', 'marimba',  88, 34)   # Fünfer-Zyklus
song.inst('pizz',    'pizz',     80, 94)   # Vierer-Zyklus
song.inst('bell',    'bell',     84, 64)   # Kirchenglocke
song.inst('choir',   'choir',    82, 64)
song.inst('brass',   'brass',    80, 78)
song.inst('trombone','trombone', 82, 50)
song.inst('timp',    'timp',     96, 64)
song.inst('hit',     'hit',      98, 64)
song.inst('trem',    'tremolo',  66, 84)

NAMES = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}
def nt(s): return n(NAMES[s[:-1]], int(s[-1]))
SCALE = {1, 3, 4, 6, 8, 9, 11, 0}          # cis-Moll (harmonisch/natürlich): cis dis e fis gis a h (his=c)
CH = {'C#m': (1, 3, 7), 'A': (9, 4, 7), 'F#m': (6, 3, 7), 'G#': (8, 4, 7), 'E': (4, 4, 7), 'B': (11, 4, 7), 'D#o': (3, 3, 6)}
def ramp(i, cnt, a, b): return a + (b - a) * i / max(1, cnt - 1)
def tones(ch, octv):
    r, t, f = CH[ch]; b = n(r, octv); return [b, b + t, b + f]
def rootp(ch, octv): return n(CH[ch][0], octv)

def mel(inst, b, notes, vel=90, semis=0, sc=True):
    for off, dur, p in notes:
        pitch = nt(p)
        if sc: assert pitch % 12 in SCALE, (b, p)
        song.add(inst, song.bar(b) + off, dur * 0.94, pitch + semis, vel)

def turn(b, ch, inst, octv=5, vel=90, fast=False, semis=0):
    """Drehfigur: Akkord-Arpeggio hinauf und wieder hinunter, füllt den ganzen Takt (Karussell)."""
    a, c, e = tones(ch, octv)
    seq = [a, c, e, a + 12, e, c] if not fast else [a, c, e, a + 12, e, c, a, c, e, a + 12, e + 12 if False else e, c]
    st = 3 / len(seq)
    for i, p in enumerate(seq): song.add(inst, song.bar(b) + i * st, st * 0.9, p + semis, vel + (8 if i % 3 == 0 else 0))

# ---- Walzer-Grundlagen -----------------------------------------------------------------
def waltz(b, ch, vel=1.0, ped=True, pah=True):
    s = song.bar(b); r = rootp(ch, 2); t = tones(ch, 3)
    song.add('bass', s, 0.9, r, 100 * vel)
    song.add('bass', s + 1.5, 0.4, r + 7, 70 * vel)
    if ped: song.add('contra', s, 2.95, rootp(ch, 1) if rootp(ch, 1) >= 28 else r, 80 * vel)
    if pah:
        for off in (1, 2):
            for p in t: song.add('organ', s + off, 0.8, p, (74 if off == 1 else 66) * vel)

def cycles(b, ch, sec_start, v5=70, v4=0, v3=0):
    """Fünfer-Zyklus (Marimba, fünf Achtel) und optional Vierer-Zyklus (Pizzicato) laufen
    über die Taktgrenzen hinweg; Index zählt Achtel ab Abschnittsanfang."""
    c = tones(ch, 4); cyc5 = [c[0], c[2], c[1], c[0] + 12, c[2]]
    cyc4 = [c[2] + 12, c[0] + 12, c[1] + 12, c[0] + 12]
    for j in range(6):
        e = (b - sec_start) * 6 + j; beat = song.bar(b) + j * 0.5
        if v5: song.add('marimba', beat, 0.45, cyc5[e % 5], v5 + (24 if e % 5 == 0 else 0))
        if v4: song.add('pizz', beat, 0.4, cyc4[e % 4], v4 + (14 if e % 4 == 0 else 0))

def toll(b, ch, vel=104, octv=3):
    song.add('bell', song.bar(b), 2.9, rootp(ch, octv), vel); song.add('bell', song.bar(b), 2.9, rootp(ch, octv) + 12, vel - 12)

def drums(b, kind, v=1.0):
    s = song.bar(b)
    def d(off, note, vel): song.dr(s + off, note, vel * v)
    if kind == 'soft':
        d(0, KICK, 104); d(1, SIDESTICK, 84); d(2, SIDESTICK, 80)
        for i in range(6): d(i * 0.5, HAT, 96 if i % 2 == 0 else 80)
    elif kind == 'A':
        d(0, KICK, 114); d(1, SNARE, 96); d(2, SNARE, 90); d(1, CLAP, 70)
        for i in range(6): d(i * 0.5, HAT, 104 if i % 2 == 0 else 86)
        d(2.5, TOM_L, 84)
    elif kind == 'B':
        d(0, KICK, 116); d(1.5, KICK, 92); d(1, SNARE, 104); d(2, SNARE, 98); d(2, CLAP, 82)
        for i in range(6): d(i * 0.5, COWBELL, 76 if i % 2 == 0 else 58)
        for i in range(6): d(i * 0.5, HAT, 100)
        d(2.5, TOM_M, 90)
    elif kind == 'C':
        d(0, KICK, 122); d(1.5, KICK, 100); d(1, SNARE, 112); d(2, SNARE, 106); d(1, CLAP, 84); d(2, CLAP, 80)
        for i in range(6): d(i * 0.5, HAT, 108 if i % 2 == 0 else 92)
        d(0, CRASH, 74); d(2.5, TOM_M, 96); d(2.75, TOM_L, 100)

TOMS = [TOM_HH, TOM_H, TOM_M, TOM_L]
def fill(b, big=False):
    s = song.bar(b)
    for i in range(6): song.dr(s + 1.5 + i * 0.25, TOMS[min(3, i // 2 + (1 if i > 3 else 0))], ramp(i, 6, 88, 118), 0.2)
    if big:
        for i in range(6): song.dr(s + i * 0.25, SNARE, ramp(i, 6, 70, 108), 0.15)
    song.dr(s + 2.75, KICK, 116)
def snare_roll(b, start, end, v0, v1):
    s = song.bar(b) + start; cnt = int((end - start) * 4)
    for i in range(cnt): song.dr(s + i * 0.25, SNARE, ramp(i, cnt, v0, v1), 0.15)
def crash(b, vel=108): song.dr(song.bar(b), CRASH, vel, 0.5)
def chorus(b, ch, vel=84, bars=1, octv=3):
    for p in tones(ch, octv): song.add('choir', song.bar(b), 2.95 * bars + (bars - 1) * 0.05, p, vel)
def stabs(b, ch, vel=88):
    for off in (0, 1.5):
        for p in tones(ch, 4)[1:] : song.add('brass', song.bar(b) + off, 0.9, p, vel)
def hit(b, ch, vel=112, dur=0.9):
    for p in tones(ch, 3) + [rootp(ch, 4)]: song.add('hit', song.bar(b), dur, p, vel)

# ---- Thema (8 Takte), Akkorde: cis cis A A fis gis cis gis --------------------------------------
CHA = ['C#m', 'C#m', 'A', 'A', 'F#m', 'G#', 'C#m', 'G#']
# Melodietakte: None = Drehfigur (aus Akkord erzeugt)
THEME = [None, [(0, 1.5, 'G#5'), (1.5, 0.5, 'F#5'), (2, 1, 'E5')],
         None, [(0, 1.5, 'A5'), (1.5, 0.5, 'G#5'), (2, 1, 'E5')],
         None, [(0, 1, 'D#5'), (1, 1, 'F#5'), (2, 1, 'G#5')],
         [(0, 1.5, 'E5'), (1.5, 0.5, 'D#5'), (2, 1, 'C#5')], [(0, 1, 'D#5'), (1, 1, 'C5'), (2, 1, 'D#5')]]
THEME2 = [None, [(0, 1.5, 'C#6'), (1.5, 0.5, 'B5'), (2, 1, 'G#5')],
          None, [(0, 1.5, 'E6'), (1.5, 0.5, 'C#6'), (2, 1, 'A5')],
          None, [(0, 1, 'F#5'), (1, 1, 'G#5'), (2, 1, 'D#6')],
          [(0, 1.5, 'E6'), (1.5, 0.5, 'D#6'), (2, 1, 'C#6')], [(0, 1, 'D#6'), (1, 1, 'C6'), (2, 1, 'D#6')]]
# Gegenstimme Pfeifenorgel (ganze Takte)
CTR = ['E4', 'C#4', 'C#5', 'A4', 'A4', 'B4', 'G#4', 'B4']
# Zyklen-Teil B: Hemiolen-Melodie (zwei Takte = drei Halbe), Akkord je 2 Takte
CHB = ['C#m', 'A', 'E', 'B', 'F#m', 'G#', 'C#m', 'G#']
HEM = [[('E5'), ('G#5'), ('C#6')], ['A5', 'E5', 'C#5'], ['B5', 'G#5', 'E5'], ['D#5', 'F#5', 'B5'],
       ['A5', 'F#5', 'C#6'], ['D#6', 'C6', 'G#5'], ['G#5', 'E5', 'G#5'], ['D#6', 'C6', 'D#6']]
# Brücke D: absteigende Bass-Chromatik, Akkord je Takt
CHD = ['C#m', 'B', 'A', 'G#', 'F#m', 'E', 'D#o', 'G#']
DESC = ['C#6', 'B5', 'A5', 'G#5', 'F#5', 'E5', 'D#5', 'D#5']
# Rückführung E
CHE = ['F#m', 'F#m', 'D#o', 'D#o', 'G#', 'G#', 'G#', 'G#']

# ==== Arrangement ===========================================================================
# ---- Intro (0–7): cis cis A A fis fis gis gis -----------------------------------------------
CHI = ['C#m', 'C#m', 'A', 'A', 'F#m', 'F#m', 'G#', 'G#']
hit(0, 'C#m', 112, 1.6); crash(0, 108); toll(0, 'C#m', 108)
for b in range(8):
    ch = CHI[b]
    waltz(b, ch, 0.88 + b * 0.02)
    drums(b, 'soft' if b < 4 else 'A', 0.96 + b * 0.02)
    if b >= 2: cycles(b, ch, 2, 60 + b * 2)
    if b >= 4: mel('bell', b, [(0, 1, 'G#5'), (1, 1, 'E5'), (2, 1, 'C#5')] if b % 2 == 0 else [(0, 1, 'A5'), (1, 1, 'E5'), (2, 1, 'C#5')], 84)
    if b >= 6: turn(b, ch, 'calli', 5, 84)
    if b == 4: toll(b, ch, 100)
fill(3); fill(7, True); snare_roll(7, 0, 2, 60, 100)

# ---- Thema A (8–23) --------------------------------------------------------------------------
def theme_pass(start, first, lead, ctr_inst, extra=None, fast_last=False, vel=1.0, sec=None):
    sec = start if sec is None else sec
    for i in range(8):
        b = start + i; ch = CHA[i]
        waltz(b, ch, vel)
        drums(b, 'A', vel)
        cycles(b, ch, sec, 62 if first else 72, 0)
        mm = (THEME if first else THEME2)[i]
        if mm is None: turn(b, ch, lead, 5 if first else 5, 92 * vel, fast=fast_last)
        else: mel(lead, b, mm, 94 * vel)
        song.add(ctr_inst, song.bar(b), 2.95, nt(CTR[i]) - (12 if first is False else 0), 74)
        if extra: extra(b, ch, i)

crash(8, 110); hit(8, 'C#m', 108, 0.9)
theme_pass(8, True, 'calli', 'pipe')
fill(15)
theme_pass(16, False, 'calli', 'pipe', lambda b, ch, i: chorus(b, ch, 56 + i * 4) if i >= 4 else None, sec=16)
crash(16, 104); fill(19); snare_roll(22, 0, 3, 60, 100); fill(23, True)

# ---- Zyklen B (24–39) -----------------------------------------------------------------------------
crash(24, 112); hit(24, 'C#m', 112, 0.9); toll(24, 'C#m', 108)
for i in range(16):
    b = 24 + i; u = i // 2; ch = CHB[u]
    waltz(b, ch, 1.02)
    drums(b, 'B', 1.0 + (0.04 if i >= 8 else 0))
    cycles(b, ch, 24, 82, 66, 0)
    # Hemiolen-Melodie: 3 Halbe über zwei Takte (nur im ersten Takt des Paars gesetzt, Dauer 2 Beats)
    if i % 2 == 0:
        for j, p in enumerate(HEM[u]): mel('organ', b, [(j * 2, 1.95, p)], 96 if i < 8 else 100)
        if i >= 8:
            for j, p in enumerate(HEM[u]): mel('calli', b, [(j * 2, 1.95, p)], 84, 12) if False else mel('calli', b, [(j * 2, 1.95, p)], 82)
    if i >= 8: chorus(b, ch, 66 + (i - 8) * 3, 1, 3)
    if i % 5 == 0: toll(b, ch, 96, 3)
    song.add('pipe', song.bar(b), 2.95, rootp(ch, 3), 66)
fill(27); fill(31); fill(35)
snare_roll(38, 0, 3, 60, 100); snare_roll(39, 0, 3, 90, 127); fill(39, True)

# ---- Höhepunkt C (40–55) ---------------------------------------------------------------------------
crash(40, 118); hit(40, 'C#m', 120, 1.2); crash(48, 116); hit(48, 'C#m', 116, 0.9)
def peak_extra(b, ch, i):
    chorus(b, ch, 90); stabs(b, ch, 84)
    song.add('trombone', song.bar(b), 0.9, rootp(ch, 2) + 12, 96); song.add('trombone', song.bar(b) + 1.5, 0.4, rootp(ch, 2) + 12 + 7, 78)
    if i % 4 == 0: song.add('timp', song.bar(b), 0.6, rootp(ch, 2), 108); song.add('timp', song.bar(b) + 1.5, 0.6, rootp(ch, 2), 96)
    if i % 4 == 0 and b not in (40, 48): crash(b, 100)
theme_pass(40, True, 'calli', 'pipe', lambda b, ch, i: (peak_extra(b, ch, i), mel('brass', b, THEME[i], 84) if THEME[i] else turn(b, ch, 'brass', 4, 80)), vel=1.06, sec=40)
for i in range(8):     # 48–55: alle Drehfiguren als rasende 16tel (Karussell dreht schneller)
    b = 48 + i; ch = CHA[i]
    waltz(b, ch, 1.08); drums(b, 'C', 1.06); cycles(b, ch, 48, 80, 70)
    if THEME2[i] is None: turn(b, ch, 'calli', 5, 96, fast=True)
    else: mel('calli', b, THEME2[i], 98)
    if THEME2[i] is None: turn(b, ch, 'brass', 4, 80)
    else: mel('brass', b, THEME2[i], 84, -12)
    peak_extra(b, ch, i)
fill(43); fill(47); fill(51)
snare_roll(54, 0, 3, 70, 110); snare_roll(55, 0, 3, 100, 127); fill(55, True)

# ---- Brücke D (56–63) --------------------------------------------------------------------------------
crash(56, 100); toll(56, 'C#m', 108, 3)
for i in range(8):
    b = 56 + i; ch = CHD[i]
    waltz(b, ch, 0.96, True, True)
    drums(b, 'B', 0.96)
    cycles(b, ch, 56, 84, 72)
    mel('bell', b, [(0, 3, DESC[i])], 92)
    song.add('choir', song.bar(b), 2.95, rootp(ch, 3) + (3 if ch in ('C#m', 'F#m', 'D#o') else 4), 60 + i * 3)
    song.add('trem', song.bar(b), 2.95, rootp(ch, 4) + 7, 50 + i * 6)
    toll(b, ch, 84, 2) if i % 3 == 0 else None
fill(59); fill(63)

# ---- Thema A' (64–79) --------------------------------------------------------------------------------
crash(64, 112); hit(64, 'C#m', 110, 0.9)
def ret_extra(b, ch, i):
    mel('pipe', b, [(0, 2.95, CTR[i])], 74, 0, False) if False else None
    song.add('trem', song.bar(b), 2.95, rootp(ch, 4) + 7, 60)
    if i >= 4: chorus(b, ch, 60 + (i - 4) * 5)
theme_pass(64, True, 'pipe', 'trem', ret_extra, sec=64, vel=1.0)
for i in range(8):     # Oktavverdopplung Kalliope
    b = 64 + i
    if THEME[i] is None: turn(b, CHA[i], 'calli', 6, 80)
    else: mel('calli', b, THEME[i], 82, 12)
fill(71)
theme_pass(72, False, 'calli', 'pipe', lambda b, ch, i: (chorus(b, ch, 74 + i * 2), stabs(b, ch, 78)), sec=72, vel=1.04, fast_last=True)
crash(72, 110); fill(75)

# ---- Rückführung E (80–87) ----------------------------------------------------------------------------
crash(80, 106); hit(80, 'F#m', 108, 0.9)
for i in range(8):
    b = 80 + i; ch = CHE[i]
    waltz(b, ch, 1.0 + i * 0.01)
    cycles(b, ch, 80, 76 + i * 2, 66)
    song.add('contra', song.bar(b), 2.95, n(8, 1), 84 + i * 2)
    if i < 4: drums(b, 'C', 0.94)
    else: snare_roll(b, 0, 3, 55 + (i - 4) * 14, 88 + (i - 4) * 12)
    if i >= 2: chorus(b, ch, 60 + i * 4)
    song.add('trem', song.bar(b), 2.95, rootp(ch, 4) + 7, 56 + i * 6)
    if i in (4, 5): turn(b, ch, 'calli', 5, 90, fast=(i == 5))
    if i == 6: turn(b, ch, 'calli', 5, 96, fast=True); turn(b, ch, 'brass', 4, 82)
    if i == 7: turn(b, 'C#m', 'calli', 5, 104, fast=True)
fill(83); fill(87, True)

sf2, out = cli_paths('bgm_theme_cyclingdemons.ogg')
song.render(sf2, out)
