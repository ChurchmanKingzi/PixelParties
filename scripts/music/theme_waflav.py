# -*- coding: utf-8 -*-
"""Theme-Track „Shapeshifter's Fury“ (Archetyp Waflav) → public/music/bgm_theme_waflav.ogg

Waflav, das gestaltwandelnde Monster, verwandelt sich Abschnitt für Abschnitt in seine fünf
Elemente – Tonart, Klangfarbe und Rhythmus wechseln, das Bassmotiv (Tonika-Tonika-Terz-Tonika-
Quinte-Tritonus | Tonika-Tonika-Terz-Quarte-Terz-Sekunde) bleibt als „Erkennungszeichen“ des
Monsters durchgehend erhalten und wird nur transponiert und umgefärbt. 130 BPM, 72 Takte
(132,9 s), nahtlos loopbar.

Aufbau (Takte, 0-basiert):
   0– 3  Intro      d-Moll: Bassmotiv nackt, Timpani, Snare-Puls, Streicher-Stabs
   4–15  WASSER     d-dorisch: rollende Harfen-Arpeggien, Flöte, fließende Achtel, Tom-Wellen
  16–27  FEUER      e-phrygisch-dominant: Gitarren-Chugs in 16teln, Blech-Lead, Doppel-Kick
  28–39  STURM      g-Moll: Tremolo-Streicher-Läufe, Pfeif-Lead, galoppierende Toms
  40–51  SUMPF      b-phrygisch: Fagott/Tuba, blubbernde Marimba, schleppender Half-Time-Beat
  52–63  DONNER     c-harmonisch-Moll: Orgel, Blech-Hits, Crash auf jedem Schlag, Pauken
  64–71  Rückwandlung  d-dorisch: alle Elemente geschichtet, dann A-Dominante → Takt 0

Jede Verwandlung: Snare-Wirbel + Orchester-Hit + Crash, Tonartwechsel (D–E–G–B–C–D).
Aufruf:  python3 scripts/music/theme_waflav.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 130, 72                       # 72 × 4 × 60/130 = 132,9 s
song = Song(bpm=BPM, bars=BARS)
song.inst('b_sb',   'sbass',    100, 62)  # Intro/Sturm/Donner/Rückwandlung
song.inst('b_ac',   'acbass',    98, 60)  # Wasser
song.inst('b_pk',   'bass2',     98, 60)  # Feuer
song.inst('b_tu',   'tuba',      96, 60)  # Sumpf
song.inst('timp',   'timp',      96, 64)
song.inst('flute',  'flute',     88, 74)
song.inst('harp',   'harp',      86, 92)
song.inst('gtr',    'rockgtr',   84, 44)
song.inst('brass',  'sbrass',    86, 80)
song.inst('trem',   'tremolo',   76, 34)
song.inst('whistle','whistle',   84, 84)
song.inst('marimba','marimba',   88, 50)
song.inst('bsn',    'bassoon',   88, 70)
song.inst('organ',  'pipeorgan', 82, 64)
song.inst('hit',    'hit',       98, 64)

def dn(root, sc, d): o, i = divmod(d, 7); return root + 12 * o + sc[i]
def tri(root, sc, k): return [dn(root, sc, k), dn(root, sc, k + 2), dn(root, sc, k + 4)]
def ramp(i, cnt, a, b): return a + (b - a) * i / max(1, cnt - 1)
CHECK = []

# Elemente: Bass-Tonika (MIDI), Skala, Melodie-Tonika (Oktave 4/5), Akkordstufen (12 Takte)
DOR = [0, 2, 3, 5, 7, 9, 10]; PHD = [0, 1, 4, 5, 7, 8, 10]; AEO = [0, 2, 3, 5, 7, 8, 10]
PHR = [0, 1, 3, 5, 7, 8, 10]; HAR = [0, 2, 3, 5, 7, 8, 11]
EL = {
    'water':   dict(r=n(D, 2),  sc=DOR, m=n(D, 5),  ch=[0, 3, 6, 3, 0, 3, 6, 4, 3, 6, 0, 0]),
    'fire':    dict(r=n(E, 2),  sc=PHD, m=n(E, 5),  ch=[0, 1, 0, 1, 6, 3, 1, 0, 0, 1, 3, 0]),
    'storm':   dict(r=n(G, 2),  sc=AEO, m=n(G, 4),  ch=[0, 5, 6, 0, 3, 5, 6, 4, 0, 5, 6, 4]),
    'swamp':   dict(r=n(Bb, 1), sc=PHR, m=n(Bb, 4), ch=[0, 0, 1, 0, 3, 3, 1, 0, 5, 6, 1, 0]),
    'thunder': dict(r=n(C, 2),  sc=HAR, m=n(C, 5),  ch=[0, 5, 3, 4, 0, 3, 5, 4, 0, 5, 3, 4]),
    'home':    dict(r=n(D, 2),  sc=DOR, m=n(D, 5),  ch=[0, 3, 6, 3]),
    'dom':     dict(r=n(A, 1),  sc=PHD, m=n(A, 4),  ch=[0, 1, 0, 0]),
}

# ---- Bassmotiv (2 Takte): (Beat, Dauer, Stufe | 'T' = Tritonus) -------------------------
MOTIF = [(0, .75, 0), (.75, .75, 0), (1.5, .5, 2), (2, 1, 0), (3, .5, 4), (3.5, .5, 'T'),
         (4, .75, 0), (4.75, .75, 0), (5.5, .5, 2), (6, 1, 3), (7, .5, 2), (7.5, .5, 1)]
def motif(b, e, inst, oct_shift=0, vel=100, gate=.9):
    E_ = EL[e]
    for off, dur, d in MOTIF:
        p = E_['r'] + 6 if d == 'T' else dn(E_['r'], E_['sc'], d)
        song.add(inst, song.bar(b) + off, dur * gate, p + oct_shift, vel + (8 if off in (0, 4) else 0))

def pad_chord(b, e, k, inst, octv_shift=0, vel=70, dur=3.98):
    E_ = EL[e]
    for p in tri(E_['m'] - 12 + octv_shift, E_['sc'], k): song.add(inst, song.bar(b), dur, p, vel)

def line(b, e, notes, inst, vel=92, shift=0):
    """notes = [(beat, dauer, stufe)] relativ zur Melodie-Tonika des Elements."""
    E_ = EL[e]
    for off, dur, d in notes:
        p = dn(E_['m'], E_['sc'], d) + shift; CHECK.append((p, E_['m'], E_['sc']))
        song.add(inst, song.bar(b) + off, dur * .94, p, vel)

def hit(b, e, vel=104, dur=.9, beat=0):
    E_ = EL[e]
    for d in (0, 4, 7): song.add('hit', song.bar(b) + beat, dur, dn(E_['m'] - 12, E_['sc'], d), vel)
def timp(b, e, kind='q', vel=96, v1=None):
    p = EL[e]['r'] + 12 if EL[e]['r'] < 36 else EL[e]['r']; s = song.bar(b)
    if kind == 'q':
        for off in (0, 2): song.add('timp', s + off, .5, p, vel)
    elif kind == 'gal':
        for off, v in ((0, 0), (1.5, -8), (2, -2), (3, -6), (3.5, -10)): song.add('timp', s + off, .4, p, vel + v)
    elif kind == 'roll':
        for i in range(16): song.add('timp', s + i * .25, .25, p, ramp(i, 16, vel, v1 or vel))

# ---- Schlagzeug -----------------------------------------------------------------------
TOMS = [TOM_H, TOM_HH, TOM_M, TOM_L]
def groove(b, kind, v=1.0):
    s = song.bar(b)
    def d(off, note, vel): song.dr(s + off, note, min(127, vel * v))
    if kind == 'intro':
        d(0, KICK, 112); d(2, KICK, 100); d(1, SNARE, 100); d(3, SNARE, 104); d(0.75, SNARE, 70)
        for i in range(8): d(i * .5, HAT, 100 if i % 2 == 0 else 80)
    elif kind == 'water':
        d(0, KICK, 100); d(2, KICK, 92); d(2.75, KICK, 78); d(1, SIDESTICK, 100); d(3, SIDESTICK, 104)
        for i in range(8): d(i * .5, HAT, 104 if i % 2 == 0 else 84)
        d(3.5, TOM_H, 74); d(3.75, TOM_HH, 78)
    elif kind == 'fire':
        for off in (0, .5, 1.5, 2, 2.5, 3.5): d(off, KICK, 108 if off in (0, 2) else 92)
        d(1, SNARE, 112); d(3, SNARE, 114); d(1, CLAP, 84); d(3, CLAP, 86)
        for i in range(16): d(i * .25, HAT, 100 if i % 4 == 0 else (84 if i % 2 == 0 else 68))
    elif kind == 'storm':
        for off, vel in ((0, 112), (1.5, 96), (2, 106), (3, 90), (3.5, 96)): d(off, KICK, vel)
        d(1, SNARE, 108); d(3, SNARE, 112); d(2.5, TOM_H, 88); d(2.75, TOM_HH, 92); d(3.75, TOM_M, 94)
        for i in range(8): d(i * .5, HAT, 100 if i % 2 == 0 else 80)
    elif kind == 'swamp':
        d(0, KICK, 114); d(0.75, KICK, 92); d(2.5, KICK, 100); d(2, SNARE, 112); d(2, CLAP, 92)
        d(1.5, TOM_L, 96); d(3.25, TOM_L, 90); d(3.5, TOM_M, 92); d(1, COWBELL, 70); d(3, COWBELL, 74)
        for off in (0.5, 1.25, 2.5, 3): d(off, HAT, 96)
    elif kind == 'thunder':
        for off in (0, 1, 2, 3): d(off, KICK, 116 if off == 0 else 104)
        d(1, SNARE, 116); d(3, SNARE, 118); d(1, CLAP, 100); d(3, CLAP, 104); d(0.5, TOM_L, 86); d(2.5, TOM_M, 90)
        for i in range(8): d(i * .5, RIDE, 100 if i % 2 == 0 else 84)
        song.dr(s, CRASH, 100 * v, .5)
def fill(b, big=False):
    s = song.bar(b)
    if big:
        for i in range(8): song.dr(s + 1.5 + i * .25, SNARE, ramp(i, 8, 72, 112), .12)
    for i in range(8): song.dr(s + (2.5 if big else 2.0) + i * (.1875 if big else .25), TOMS[min(3, i // 2)], ramp(i, 8, 90, 118), .2)
    song.dr(s + 3.75, KICK, 118)
def roll(b, a, z, v0, v1):
    s = song.bar(b) + a; cnt = int((z - a) * 4)
    for i in range(cnt): song.dr(s + i * .25, SNARE, ramp(i, cnt, v0, v1), .15)
def crash(b, vel=112): song.dr(song.bar(b), CRASH, vel, .5)
def morph(b_end, nxt):
    """Verwandlung: Wirbel + Fill im letzten Takt, Hit + Crash auf dem nächsten Element."""
    roll(b_end, 0, 3.5, 60, 122); fill(b_end, True); hit(b_end + 1, nxt, 112, 1.2); crash(b_end + 1, 116)

# ==== Arrangement ======================================================================
# ---- Intro 0–3 (d-Moll): Bassmotiv nackt --------------------------------------------------
for b in range(4):
    motif(b - b % 2, 'home', 'b_sb', 0, 92 + b * 2) if b % 2 == 0 else None
    groove(b, 'intro', 1.0 + b * .03)
    timp(b, 'home', 'q', 84 + b * 4)
    pad_chord(b, 'home', [0, 0, 3, 4][b], 'trem', 0, 56 + b * 8)
hit(0, 'home', 112, 1.4); crash(0, 108); roll(3, 0, 3.5, 60, 118); fill(3, True)

# ---- WASSER 4–15 (d-dorisch): fließend ---------------------------------------------------
W_MEL = [  # 12 Takte, Stufen rel. D5
    [(0, 1.5, 4), (1.5, .5, 3), (2, 1, 2), (3, 1, 4)],
    [(0, 1, 5), (1, .5, 4), (1.5, .5, 3), (2, 2, 2)],
    [(0, 1, 6), (1, 1, 4), (2, 1, 2), (3, 1, 3)],
    [(0, 2, 4), (2, 1, 3), (3, 1, 2)],
    [(0, 1.5, 4), (1.5, .5, 5), (2, 1, 7), (3, 1, 5)],
    [(0, 1, 6), (1, .5, 5), (1.5, .5, 4), (2, 2, 3)],
    [(0, 1, 5), (1, 1, 4), (2, 1, 2), (3, 1, 1)],
    [(0, 2, 2), (2, 2, 4)],
    [(0, 1, 7), (1, .5, 6), (1.5, .5, 5), (2, 1, 4), (3, 1, 2)],
    [(0, 1, 5), (1, 1, 6), (2, 2, 4)],
    [(0, 1, 4), (1, .5, 3), (1.5, .5, 2), (2, 1, 1), (3, 1, 0)],
    [(0, 3, 2), (3, 1, 4)],
]
crash(4, 108)
for i in range(12):
    b = 4 + i; k = EL['water']['ch'][i]; E_ = EL['water']
    if i % 2 == 0: motif(b, 'water', 'b_ac', 0, 98)
    groove(b, 'water', 1.0 + (i // 4) * .04)
    timp(b, 'water', 'q', 78)
    t = tri(E_['m'] - 12, E_['sc'], k) + tri(E_['m'], E_['sc'], k)          # rollende Harfe: auf und ab
    seq = t + t[-2::-1]
    for j in range(8): song.add('harp', song.bar(b) + j * .5, 1.0, seq[j], 74 + (10 if j == 0 else 0))
    line(b, 'water', W_MEL[i], 'flute', 90 + (i // 4) * 3)
    if i >= 4:
        for p in tri(E_['m'] - 12, E_['sc'], k): song.add('trem', song.bar(b), 3.98, p, 52 + (i - 4) * 3)
    if i % 4 == 3 and i < 11: fill(b)
morph(15, 'fire')

# ---- FEUER 16–27 (e-phrygisch-dominant): Chugs + Blech -------------------------------------
F_MEL = [
    [(0, .5, 0), (.5, .5, 1), (1, 1, 2), (2, 1, 3), (3, 1, 2)],           # E F G# A G#
    [(0, 1, 3), (1, .5, 2), (1.5, .5, 1), (2, 2, 0)],
    [(0, .5, 0), (.5, .5, 1), (1, 1, 2), (2, 1, 4), (3, 1, 3)],
    [(0, 1, 2), (1, 1, 1), (2, 2, 0)],
    [(0, 1, 4), (1, .5, 5), (1.5, .5, 4), (2, 1, 3), (3, 1, 2)],
    [(0, 1, 5), (1, 1, 4), (2, 1, 2), (3, 1, 1)],
    [(0, .5, 2), (.5, .5, 3), (1, 1, 4), (2, 1, 5), (3, 1, 7)],
    [(0, 2, 7), (2, 1, 5), (3, 1, 4)],
    [(0, 1, 7), (1, .5, 6), (1.5, .5, 5), (2, 1, 4), (3, 1, 2)],
    [(0, 1, 3), (1, 1, 2), (2, 1, 1), (3, 1, 0)],
    [(0, .5, 0), (.5, .5, 1), (1, 1, 2), (2, 2, 4)],
    [(0, 2, 0), (2, 1, 1), (3, 1, 0)],
]
for i in range(12):
    b = 16 + i; k = EL['fire']['ch'][i]; E_ = EL['fire']
    if i % 2 == 0: motif(b, 'fire', 'b_pk', 0, 100)
    groove(b, 'fire', 1.0 + (i // 4) * .04)
    timp(b, 'fire', 'gal', 92)
    root = E_['r'] + 12; ch = tri(E_['r'] + 12, E_['sc'], k)
    for j in range(16):                                                     # palm-muted 16tel-Chugs
        song.add('gtr', song.bar(b) + j * .25, .22, root if j % 4 != 3 else ch[2] - 12 + 12, 76 + (12 if j % 4 == 0 else 0))
    for p in (ch[0] + 12, ch[2] + 12): song.add('gtr', song.bar(b), 1.6, p, 80)
    line(b, 'fire', F_MEL[i], 'brass', 94)
    if i >= 6: line(b, 'fire', F_MEL[i], 'flute', 78, 12)
    if i % 4 == 3 and i < 11: fill(b)
morph(27, 'storm')

# ---- STURM 28–39 (g-Moll): Tremolo-Läufe + Pfeife ------------------------------------------
S_MEL = [
    [(0, 1.5, 0), (1.5, .5, 2), (2, 1, 4), (3, 1, 2)],
    [(0, 1, 5), (1, 1, 4), (2, 1, 2), (3, 1, 0)],
    [(0, 1.5, 6), (1.5, .5, 5), (2, 1, 4), (3, 1, 6)],
    [(0, 2, 7), (2, 1, 6), (3, 1, 4)],
    [(0, 1, 3), (1, 1, 5), (2, 1, 7), (3, 1, 5)],
    [(0, 1.5, 5), (1.5, .5, 4), (2, 2, 2)],
    [(0, 1, 6), (1, 1, 4), (2, 1, 6), (3, 1, 8)],
    [(0, 2, 8), (2, 1, 6), (3, 1, 4)],
    [(0, 1, 7), (1, 1, 9), (2, 1, 7), (3, 1, 4)],
    [(0, 1, 5), (1, 1, 7), (2, 2, 9)],
    [(0, 1, 8), (1, 1, 6), (2, 1, 4), (3, 1, 6)],
    [(0, 1, 4), (1, 1, 2), (2, 2, 4)],
]
for i in range(12):
    b = 28 + i; k = EL['storm']['ch'][i]; E_ = EL['storm']
    if i % 2 == 0: motif(b, 'storm', 'b_sb', 0, 100, .85)
    groove(b, 'storm', 1.0 + (i // 4) * .04)
    timp(b, 'storm', 'gal', 94)
    t = tri(E_['m'], E_['sc'], k); t = t + [t[0] + 12, t[1] + 12]           # 16tel-Wind-Läufe
    up = [0, 1, 2, 3, 4, 3, 2, 1]
    for j in range(16): song.add('trem', song.bar(b) + j * .25, .3, t[up[j % 8] if (i % 2 == 0) else up[::-1][j % 8]], 62 + (j % 4 == 0) * 12 + (i // 4) * 4)
    line(b, 'storm', S_MEL[i], 'whistle', 92 + (i // 4) * 3)
    if i >= 4: line(b, 'storm', S_MEL[i], 'brass', 72, -12)
    if i % 4 == 3 and i < 11: fill(b)
morph(39, 'swamp')

# ---- SUMPF 40–51 (b-phrygisch): schwer, blubbernd ------------------------------------------
M_MEL = [
    [(0, 2, 0), (2, 1, 1), (3, 1, 0)],
    [(0, 1.5, 0), (1.5, .5, 2), (2, 2, 1)],
    [(0, 1, 2), (1, 1, 1), (2, 2, 0)],
    [(0, 2, 3), (2, 1, 2), (3, 1, 1)],
    [(0, 1.5, 3), (1.5, .5, 2), (2, 1, 3), (3, 1, 4)],
    [(0, 1, 4), (1, 1, 3), (2, 2, 2)],
    [(0, 1, 2), (1, 1, 1), (2, 1, 2), (3, 1, 3)],
    [(0, 2, 1), (2, 2, 0)],
    [(0, 1.5, 4), (1.5, .5, 5), (2, 1, 4), (3, 1, 3)],
    [(0, 1, 5), (1, 1, 4), (2, 1, 3), (3, 1, 2)],
    [(0, 1, 3), (1, 1, 2), (2, 1, 1), (3, 1, 0)],
    [(0, 3, 0), (3, 1, 1)],
]
BUB = [0, 1, 2, 4, 2, 1, 0, 2]                                              # Blubber-Muster (Achtel, gleitend)
for i in range(12):
    b = 40 + i; k = EL['swamp']['ch'][i]; E_ = EL['swamp']
    if i % 2 == 0: motif(b, 'swamp', 'b_tu', 0, 100, 1.0)
    groove(b, 'swamp', 1.0 + (i // 4) * .04)
    timp(b, 'swamp', 'q', 88)
    t = tri(E_['m'] - 12, E_['sc'], k) + [tri(E_['m'], E_['sc'], k)[0]]
    for j in range(8): song.add('marimba', song.bar(b) + j * .5, .35, t[[0, 2, 1, 3, 2, 0, 1, 3][j]], 70 + (j % 2 == 0) * 12 + ((i % 4 == 1) * 6))
    line(b, 'swamp', M_MEL[i], 'bsn', 92)
    if i >= 4:
        for p in tri(E_['m'] - 12, E_['sc'], k): song.add('trem', song.bar(b), 3.98, p, 50 + (i - 4) * 3)
    if i % 4 == 3 and i < 11: fill(b)
morph(51, 'thunder')

# ---- DONNER 52–63 (c-harmonisch): Orgel, Blech, alles ------------------------------------------
T_MEL = [
    [(0, 1, 0), (1, 1, 2), (2, 1, 4), (3, 1, 7)],
    [(0, 2, 8), (2, 1, 7), (3, 1, 5)],
    [(0, 1, 5), (1, 1, 3), (2, 2, 2)],
    [(0, 1, 6), (1, 1, 7), (2, 2, 9)],
    [(0, 1, 7), (1, 1, 4), (2, 1, 7), (3, 1, 9)],
    [(0, 2, 10), (2, 1, 9), (3, 1, 7)],
    [(0, 1.5, 8), (1.5, .5, 7), (2, 1, 5), (3, 1, 3)],
    [(0, 2, 6), (2, 2, 4)],
    [(0, 1, 7), (1, 1, 9), (2, 1, 11), (3, 1, 9)],
    [(0, 2, 10), (2, 1, 8), (3, 1, 7)],
    [(0, 1, 5), (1, 1, 3), (2, 1, 5), (3, 1, 6)],
    [(0, 3, 7), (3, .5, 6), (3.5, .5, 7)],
]
for i in range(12):
    b = 52 + i; k = EL['thunder']['ch'][i]; E_ = EL['thunder']
    if i % 2 == 0: motif(b, 'thunder', 'b_sb', 0, 106)
    if i % 2 == 0: motif(b, 'thunder', 'b_tu', 12, 84, .8)
    groove(b, 'thunder', 1.0 + (i // 4) * .03)
    timp(b, 'thunder', 'gal', 100)
    for p in tri(E_['m'] - 12, E_['sc'], k): song.add('organ', song.bar(b), 3.98, p, 84)
    ch = tri(E_['r'] + 24, E_['sc'], k)
    for off in (0, 1.5, 3): [song.add('gtr', song.bar(b) + off, .8, p, 82) for p in (ch[0], ch[0] + 7)]
    line(b, 'thunder', T_MEL[i], 'brass', 100)
    line(b, 'thunder', T_MEL[i], 'flute', 80, 12)
    if i % 4 == 0 and i > 0: hit(b, 'thunder', 100, .6)
    if i % 4 == 3 and i < 11: fill(b)
roll(63, 0, 4, 60, 120); fill(63, True)

# ---- Rückwandlung 64–71: alles geschichtet, dann A-Dominante --------------------------------
hit(64, 'home', 112, 1.2); crash(64, 112)
for i in range(8):
    b = 64 + i; e = 'home' if i < 4 else 'dom'; E_ = EL[e]; k = E_['ch'][i % 4]
    if i % 2 == 0: motif(b, e, 'b_sb', 0, 102 + i * 2); motif(b, e, 'b_ac', 12, 70, .8)
    groove(b, 'storm' if i < 4 else 'fire', .95 + i * .02) if i < 6 else roll(b, 0, 4, 55 + (i - 6) * 20, 90 + (i - 6) * 20)
    timp(b, e, 'gal' if i < 6 else 'roll', 96 + i, 120 if i >= 6 else None)
    for p in tri(E_['m'] - 12, E_['sc'], k): song.add('organ', song.bar(b), 3.98, p, 62 + i * 3)
    for j in range(8): song.add('harp', song.bar(b) + j * .5, .9, tri(E_['m'], E_['sc'], k)[[0, 1, 2, 1, 0, 1, 2, 1][j]], 70 + i * 2)
    if i >= 2: [song.add('trem', song.bar(b), 3.98, p, 58 + i * 4) for p in tri(E_['m'], E_['sc'], k)]
line(64, 'home', [(0, 1.5, 4), (1.5, .5, 3), (2, 1, 2), (3, 1, 4)], 'flute', 90)
line(65, 'home', [(0, 1, 5), (1, .5, 4), (1.5, .5, 3), (2, 2, 2)], 'flute', 90)
line(66, 'home', [(0, 1, 6), (1, 1, 4), (2, 1, 2), (3, 1, 3)], 'brass', 92)
line(67, 'home', [(0, 2, 4), (2, 1, 3), (3, 1, 2)], 'brass', 92)
line(68, 'dom', [(0, .5, 0), (.5, .5, 1), (1, 1, 2), (2, 1, 3), (3, 1, 2)], 'brass', 98)
line(69, 'dom', [(0, 1, 3), (1, .5, 2), (1.5, .5, 1), (2, 2, 0)], 'brass', 98)
line(70, 'dom', [(0, .5, 0), (.5, .5, 1), (1, .5, 2), (1.5, .5, 3), (2, 2, 4)], 'brass', 102)
line(71, 'dom', [(0, .25, 0), (.25, .25, 1), (.5, .25, 2), (.75, .25, 3), (1, 1, 4), (2, 1.6, 2)], 'brass', 106)
fill(67); fill(71, True)

for p, r, sc in CHECK: assert (p - r) % 12 in sc, (p, r)
sf2, out = cli_paths('bgm_theme_waflav.ogg')
song.render(sf2, out)
