# -*- coding: utf-8 -*-
"""Helden-Thema „Big Bunny Bounce“ (Bubbles, the Bouncy Bunny) → public/music/bgm_bubbles.ogg

Es-Dur, 138 BPM, 64 Takte (111,3 s), nahtlos loopbar. Ein riesiger, sanfter Hase, der wie ein
Gummiball durchs Feld hüpft und alle beschützt: runde, warme Klänge (Tuba, Fagott, Klarinette,
Okarina, Horn, Harfe, Warm-Pad, Chor) über federnden Synkopen (Pausen als „Sprünge“), Kalimba-/
Marimba-/Pizzicato-Hops, Boing-Glissandi per Pitch-Bend und aufsteigenden Seifenblasen-Arpeggien
(Glockenspiel/Crystal). Schlagzeug (Kick/Snare/Clap/Cowbell/Toms) treibt ab Takt 1.

Aufbau (Takte, 0-basiert):
   0– 7  Aufwachen/Anspringen   Boing-Aufschwung, hüpfender Beat, Tuba-Hops, Seifenblasen steigen
   8–23  Hüpfthema A            Ocarina/Klarinette: Hüpfmotiv (G-B-Es … mit Pausen), 2. Mal mit Flöte
  24–39  Große Umarmung B       Beschützer-Hymne: Horn + Chor + Fagott, Harfe, warmer Pad, 2. Mal mit Ocarina
  40–55  Wilde Hüpfjagd C       Thema A als 16tel-Jagd (Xylophon/Klarinette/Flöte), Marimba-Hops, Toms;
                                ab Takt 48 eine Ganzton höher in F-Dur (Pivot: B-Dur = IV in F / V in Es)
  56–63  Rückführung D          Thema A leise in der Okarina, Crescendo, Dominante B-Dur, Boing → Takt 0
Harmonie: Es-Dur (Es, As, B, c-Moll, f-Moll, g-Moll); der Loop endet auf der Dominante B-Dur.
Aufruf:  python3 scripts/music/hero_bubbles.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 138, 64                       # 64 × 4 × 60/138 = 111,3 s
song = Song(bpm=BPM, bars=BARS)

song.inst('tuba',     'tuba',     100, 60)
song.inst('bassoon',  'bassoon',   84, 54)
song.inst('marimba',  'marimba',   90, 42)
song.inst('kalimba',  'kalimba',   88, 80)
song.inst('pizz',     'pizz',      80, 30)
song.inst('harp',     'harp',      86, 70)
song.inst('glock',    'glock',     80, 88)
song.inst('crystal',  'crystal',   66, 24)
song.inst('warm',     'warm',      80, 64)
song.inst('ocarina',  'ocarina',   96, 62)
song.inst('clarinet', 'clarinet',  92, 46)
song.inst('flute',    'flute',     84, 78)
song.inst('horns',    'horns',     96, 58)
song.inst('choir',    'choir',     80, 64)
song.inst('boing',    'sine',      70, 72)

NAMES = {'C': C, 'Db': Db, 'D': D, 'Eb': Eb, 'E': E, 'F': F, 'Gb': Gb, 'G': G, 'Ab': Ab, 'A': A, 'Bb': Bb, 'B': B}
def nt(s): return n(NAMES[s[:-1]], int(s[-1]))
SC_ES = {Eb, F, G, Ab, Bb, C, D}
SC_F = {F, G, A, Bb, C, D, E}
# Akkord → (Grundton, Terz-Halbtöne)
CH = {'Eb': (Eb, 4), 'Ab': (Ab, 4), 'Bb': (Bb, 4), 'Cm': (C, 3), 'Fm': (F, 3), 'Gm': (G, 3),
      'F': (F, 4), 'Dm': (D, 3), 'Cd': (C, 4)}
def tones(ch, octv): r, t = CH[ch]; b = n(r, octv); return [b, b + t, b + 7, b + 12]
def ramp(i, cnt, a, b): return a + (b - a) * i / max(1, cnt - 1)

# Pitch-Bend (Bereich ±2 Halbtöne, per RPN gesetzt)
BCH = song.ch['boing'][0]
song.ev.append((0, 0, mido.Message('control_change', channel=BCH, control=101, value=0)))
song.ev.append((0, 0, mido.Message('control_change', channel=BCH, control=100, value=0)))
song.ev.append((0, 0, mido.Message('control_change', channel=BCH, control=6, value=2)))
def boing(b, beat, pitch, dur, s0, s1, vel=84, inst='boing'):
    """Boing-Gleitton: Ton mit Pitch-Bend-Weg von s0 nach s1 Halbtönen (max. ±2)."""
    ch = song.ch[inst][0]; t0 = int(round((song.bar(b) + beat) * TPB)); t1 = int(round((song.bar(b) + beat + dur) * TPB))
    def bend(t, semi):
        v = int(max(-8192, min(8191, semi / 2 * 8192)))
        song.ev.append((t, 0, mido.Message('pitchwheel', channel=ch, pitch=v)))
    bend(t0, s0)
    song.add(inst, song.bar(b) + beat, dur, pitch, vel)
    steps = max(3, int(dur * 12))
    for i in range(1, steps + 1): bend(t0 + (t1 - t0) * i // steps, s0 + (s1 - s0) * i / steps)
    bend(t1 + TPB // 2, 0)

# ---- Begleit-Bausteine ----------------------------------------------------------------
def tuba(b, ch, vel=100, kind='hop'):
    s = song.bar(b); r = n(CH[ch][0], 2)
    if kind == 'hop':
        for off, d, p, v in ((0, .45, r, 0), (1.5, .4, r + 12, -8), (2, .45, r, -2), (3.25, .4, r + 7, -10)): song.add('tuba', s + off, d, p, vel + v)
    elif kind == 'soft':
        song.add('tuba', s, 1.5, r, vel); song.add('tuba', s + 2, 1.5, r + 7, vel - 8)
    elif kind == 'run':
        for i, off in enumerate((0, .75, 1.5, 2, 2.75, 3.5)): song.add('tuba', s + off, .4, r + (12 if i % 3 == 1 else 0), vel - (6 if i % 3 else 0))

def bassoon(b, ch, vel=80):
    s = song.bar(b); r = n(CH[ch][0], 3)
    for off, p in ((0, r), (1.5, r + 7), (2.5, r + 12), (3.25, r + 7)): song.add('bassoon', s + off, .4, p, vel - (8 if off else 0))

def kalimba(b, ch, vel=84):
    s = song.bar(b); t = tones(ch, 4)
    for off, i in ((0.5, 1), (1.25, 2), (2.5, 3), (3.25, 2)): song.add('kalimba', s + off, .4, t[i], vel)

def marimba(b, ch, vel=88, fast=False):
    s = song.bar(b); t = tones(ch, 3)
    if not fast:
        for off, i in ((0, 0), (.75, 2), (1.5, 3), (2.75, 2)): song.add('marimba', s + off, .35, t[i] + (12 if i == 3 else 0), vel - (6 if off else 0))
    else:
        for h in (0, 2):
            for off, i in ((0, 0), (.25, 1), (.5, 2), (1, 3), (1.25, 2), (1.5, 1)):
                song.add('marimba', s + h + off, .22, t[i], vel + (6 if off == 0 else 0))

def pizz(b, ch, vel=78):
    s = song.bar(b); t = tones(ch, 3)
    for off, i in ((1, 1), (1.75, 2), (3, 1), (3.75, 2)): song.add('pizz', s + off, .3, t[i], vel)

def pad(b, ch, vel=70, inst='warm', octv=3, dur=3.95):
    for p in tones(ch, octv)[:3]: song.add(inst, song.bar(b), dur, p, vel)

def harp(b, ch, vel=80):
    t = tones(ch, 3)
    for i in range(8): song.add('harp', song.bar(b) + i * .5, .6, t[[0, 1, 2, 3, 2, 1, 2, 3][i]] + (12 if i in (3, 7) else 0), vel - (6 if i % 2 else 0))

def bubbles(b, ch, beat=0, cnt=6, vel=76, inst='glock', octv=5, step=.25):
    t = tones(ch, octv)
    seq = [t[0], t[1], t[2], t[3], t[3] + CH[ch][1], t[3] + 7]
    for i in range(cnt): song.add(inst, song.bar(b) + beat + i * step, .4, seq[i % 6] + 12 * (i // 6), ramp(i, cnt, vel - 12, vel))

def line(b, notes, insts, vels, shift=0, scale=SC_ES):
    for off, dur, p in notes:
        for inst, v in zip(insts, vels):
            pp = nt(p) + shift
            assert pp % 12 in scale, (inst, b, p)
            song.add(inst, song.bar(b) + off, dur * .94, pp, v)

# ---- Schlagzeug -----------------------------------------------------------------------
def groove(b, kind, v=1.0):
    s = song.bar(b)
    def d(off, note, vel): song.dr(s + off, note, min(127, vel * v), .2)
    if kind == 'hop':                       # federnder Synkopen-Beat
        for off, vel in ((0, 114), (1.75, 92), (2.5, 104)): d(off, KICK, vel)
        d(1, SNARE, 106); d(3, SNARE, 108); d(3, CLAP, 84)
        d(.75, COWBELL, 82); d(2.75, COWBELL, 78)
        for i in range(8): d(i * .5, HAT, 108 if i % 2 == 0 else 90)
    elif kind == 'hug':                     # weicher, schwerer Beat (große Umarmung)
        for off, vel in ((0, 116), (2, 106), (2.75, 88)): d(off, KICK, vel)
        d(1, SNARE, 100); d(3, SNARE, 104); d(1, CLAP, 82); d(3, CLAP, 86)
        d(1.5, COWBELL, 70); d(3.5, COWBELL, 72)
        for i in range(8): d(i * .5, HAT, 106 if i % 2 == 0 else 88)
        d(2.5, TOM_L, 84)
    elif kind == 'chase':                   # wilde Jagd
        for off, vel in ((0, 118), (1, 100), (1.5, 92), (2, 112), (3, 100), (3.5, 96)): d(off, KICK, vel)
        d(1, SNARE, 112); d(3, SNARE, 114); d(1, CLAP, 90); d(3, CLAP, 92); d(2.75, SNARE, 80); d(3.75, SNARE, 90)
        for i in range(8): d(i * .5 + .25, COWBELL, 66)
        for i in range(8): d(i * .5, HAT, 112 if i % 2 == 0 else 96)
        d(.75, TOM_M, 88); d(2.5, TOM_L, 92)
    elif kind == 'soft':                    # Rückführung: leiser, aber treibend
        for off, vel in ((0, 106), (1.75, 86), (2.5, 96)): d(off, KICK, vel)
        d(1, SNARE, 92); d(3, SNARE, 96); d(1, SIDESTICK, 90); d(3, SIDESTICK, 94)
        d(.75, COWBELL, 72); d(2.75, COWBELL, 70)
        for i in range(8): d(i * .5, HAT, 104 if i % 2 == 0 else 86)

def fill(b, big=False):
    s = song.bar(b)
    toms = [TOM_HH, TOM_H, TOM_M, TOM_L]
    if big:
        for i in range(8): song.dr(s + 1.5 + i * .25, SNARE, ramp(i, 8, 78, 116), .15)
    for i in range(8): song.dr(s + 2 + i * .25 if not big else s + 2.5 + i * .1875, toms[min(3, i // 2)], ramp(i, 8, 92, 118), .2)
    song.dr(s + 3.75, KICK, 118)

def crash(b, vel=112): song.dr(song.bar(b), CRASH, vel, .5)

# ---- Melodien -------------------------------------------------------------------------
# Hüpfthema A über Es Es As As | cm fm B B
CH_A = ['Eb', 'Eb', 'Ab', 'Ab', 'Cm', 'Fm', 'Bb', 'Bb']
MEL_A = [
    [(0, .5, 'G4'), (.5, .5, 'Bb4'), (1.5, .5, 'Eb5'), (2.5, .5, 'Bb4'), (3, 1, 'G4')],
    [(0, .5, 'G4'), (.5, .5, 'Bb4'), (1.5, .5, 'Eb5'), (2.5, .5, 'F5'), (3, 1, 'G5')],
    [(0, .5, 'Ab4'), (.5, .5, 'C5'), (1.5, .5, 'Eb5'), (2.5, .5, 'C5'), (3, 1, 'Ab4')],
    [(0, .5, 'Ab4'), (.5, .5, 'C5'), (1.5, .5, 'Eb5'), (2.5, .5, 'D5'), (3, 1, 'C5')],
    [(0, .5, 'G4'), (.5, .5, 'C5'), (1.5, .5, 'Eb5'), (2.5, .5, 'G5'), (3, 1, 'Eb5')],
    [(0, .5, 'F5'), (.5, .5, 'Eb5'), (1.5, .5, 'C5'), (2.5, .5, 'Ab4'), (3, 1, 'C5')],
    [(0, .5, 'D5'), (.5, .5, 'F5'), (1.5, .5, 'Bb5'), (2.5, .5, 'F5'), (3, 1, 'D5')],
    [(0, 1, 'F5'), (1.5, .5, 'D5'), (2, .5, 'F5'), (3, 1, 'Bb4')],
]
MEL_A_END2 = [(0, .5, 'Bb5'), (.5, .5, 'F5'), (1, .5, 'D5'), (1.5, .5, 'F5'), (2, 2, 'Bb4')]

# Beschützer-Hymne B über Es As B g | c As B B(/Es)
CH_B1 = ['Eb', 'Ab', 'Bb', 'Gm', 'Cm', 'Ab', 'Bb', 'Bb']
CH_B2 = ['Eb', 'Ab', 'Bb', 'Gm', 'Cm', 'Ab', 'Bb', 'Eb']
HYMN = [
    [(0, 2, 'Bb4'), (2, 1, 'Eb5'), (3, 1, 'G5')],
    [(0, 2, 'Eb5'), (2, 1, 'C5'), (3, 1, 'Eb5')],
    [(0, 1.5, 'F5'), (1.5, .5, 'D5'), (2, 2, 'Bb4')],
    [(0, 2, 'D5'), (2, 1, 'G5'), (3, 1, 'F5')],
    [(0, 2, 'G5'), (2, 1, 'Eb5'), (3, 1, 'G5')],
    [(0, 1.5, 'Ab5'), (1.5, .5, 'G5'), (2, 1, 'F5'), (3, 1, 'Eb5')],
    [(0, 2, 'D5'), (2, 1, 'F5'), (3, 1, 'D5')],
]
HYMN_END1 = [(0, 2, 'D5'), (2, 2, 'F5')]
HYMN_END2 = [(0, 4, 'G5')]
BASS_B = {'Eb': 'Eb', 'Ab': 'Ab', 'Bb': 'Bb', 'Gm': 'G', 'Cm': 'C'}

# ==== Arrangement =========================================================================
# ---- Intro (0–7): Es Es As As cm cm B B -------------------------------------------------
CH_I = ['Eb', 'Eb', 'Ab', 'Ab', 'Cm', 'Cm', 'Bb', 'Bb']
boing(0, 0, nt('Bb3'), 1.0, -2, 0, 80); crash(0, 106)
boing(2, 3, nt('Eb5'), 1.0, 0, 2, 76)                    # Aufschwung
for i, ch in enumerate(CH_I):
    b = i
    pad(b, ch, 72 + i * 2)
    tuba(b, ch, 100, 'hop')
    groove(b, 'hop', 1.0 + i * 0.01)
    bassoon(b, ch, 74)
    kalimba(b, ch, 80)
    if b >= 2: pizz(b, ch, 72)
    if b >= 2: marimba(b, ch, 84)
    if b >= 4: bubbles(b, ch, 0, 6, 74, 'glock', 5, .25)
    if b >= 6: bubbles(b, ch, 2, 6, 74, 'crystal', 5, .25)
line(6, MEL_A[0], ['clarinet'], [90]); line(7, MEL_A[1], ['clarinet'], [96])
boing(5, 3, nt('F4'), .9, -2, 0, 76)
fill(3); fill(7, big=True)

# ---- Hüpfthema A (8–23) ------------------------------------------------------------------
crash(8, 112)
for i in range(16):
    b, k = 8 + i, i % 8; second = i >= 8; ch = CH_A[k]
    pad(b, ch, 66 + (6 if second else 0))
    tuba(b, ch, 100, 'hop')
    groove(b, 'hop', 1.0 + (0.04 if second else 0))
    kalimba(b, ch, 84); pizz(b, ch, 76); marimba(b, ch, 78)
    if second: bassoon(b, ch, 80)
    mel = MEL_A_END2 if (second and k == 7) else MEL_A[k]
    line(b, mel, ['ocarina', 'clarinet'] if not second else ['ocarina', 'flute', 'clarinet'],
         [94, 70] if not second else [96, 80, 70], 0)
    if k % 4 == 3: bubbles(b, ch, 2.5, 4, 72, 'glock', 6, .25)
    if k == 7 and not second: boing(b, 3.25, nt('Bb4'), .7, -2, 1.5, 72)
fill(11); fill(15); crash(16, 108); fill(19)
boing(23, 2.5, nt('F4'), 1.4, -2, 2, 76); fill(23, big=True)

# ---- Große Umarmung B (24–39) -------------------------------------------------------------
crash(24, 114)
for i in range(16):
    b, k = 24 + i, i % 8; second = i >= 8
    ch = (CH_B2 if second else CH_B1)[k]
    pad(b, ch, 78 + (6 if second else 0), 'warm', 3)
    song.add('tuba', song.bar(b), 1.5, n(CH[ch][0], 2), 100)
    song.add('tuba', song.bar(b) + 2, 1.5, n(CH[ch][0], 2) + 7, 92)
    bassoon(b, ch, 78) if second else song.add('bassoon', song.bar(b), 3.9, n(CH[ch][0], 3), 70)
    harp(b, ch, 78)
    groove(b, 'hug', 1.0 + (0.04 if second else 0))
    if k < 7: mel = HYMN[k]
    else: mel = HYMN_END2 if second else HYMN_END1
    line(b, mel, ['horns'] + (['choir', 'ocarina'] if second else ['choir']), [100, 82, 76] if second else [98, 74])
    for p in tones(ch, 4)[:3]: song.add('choir', song.bar(b), 3.9, p - 12 if p > 66 else p, 62 + (10 if second else 0))
    if k % 2 == 1: bubbles(b, ch, 2, 8, 68, 'crystal', 5, .25)
    if second and k % 2 == 0: kalimba(b, ch, 74)
fill(31); crash(32, 116); fill(39, big=True)

# ---- Wilde Hüpfjagd C (40–55): Thema A; 48–55 in F-Dur ----------------------------------
CH_F = ['F', 'F', 'Bb', 'Bb', 'Dm', 'Gm', 'Cd', 'Bb']
crash(40, 118)
for i in range(16):
    b, k = 40 + i, i % 8; second = i >= 8
    ch = CH_F[k] if second else CH_A[k]
    sc = SC_F if second else SC_ES
    pad(b, ch, 70, 'warm', 3)
    tuba(b, ch, 104, 'run')
    groove(b, 'chase', 1.0 + (0.04 if second else 0))
    marimba(b, ch, 90, fast=True)
    bassoon(b, ch, 82)
    mel = MEL_A[k]; sh = 0
    if second and k < 7: sh = 2
    if second and k == 7: sh = 0
    line(b, mel, ['clarinet', 'flute', 'ocarina'], [96, 84, 70], sh, sc)
    kalimba(b, ch, 80)
    if k % 2 == 1: bubbles(b, ch, 0, 8, 80, 'glock', 6, .25)
    if k % 4 == 0 and b != 40: crash(b, 104)
fill(43); fill(47); crash(48, 116); fill(51)
boing(54, 2, nt('C4'), 1.6, -2, 2, 80); fill(55, big=True)

# ---- Rückführung D (56–63): leise Wiederkehr, Dominante B ---------------------------------
CH_D = ['Cm', 'Ab', 'Fm', 'Bb', 'Cm', 'Ab', 'Bb', 'Bb']
MEL_D = [4, 2, 5, 6, 4, 2, 6, 7]
crash(56, 100)
for i in range(8):
    b = 56 + i; ch = CH_D[i]
    pad(b, ch, 66 + i * 3)
    tuba(b, ch, 92 + i * 2, 'hop')
    groove(b, 'soft', 0.96 + i * 0.02)
    kalimba(b, ch, 78); pizz(b, ch, 74)
    if i >= 2: marimba(b, ch, 80)
    line(b, MEL_A[MEL_D[i]], ['ocarina', 'flute'] if i >= 4 else ['ocarina'], [84 + i * 2, 70] if i >= 4 else [84 + i * 2])
    if i >= 4: bubbles(b, ch, 0, 6, 70 + i * 2, 'glock', 5, .5)
    if i >= 6: bubbles(b, ch, 2, 8, 82, 'crystal', 5, .25)
boing(60, 3, nt('Eb4'), .9, -2, 0, 74)
for i in range(16): song.dr(song.bar(62) + 2 + i * .125, SNARE, ramp(i, 16, 60, 110), .1)
boing(63, 0, nt('Bb3'), 3.0, -2, 2, 84)                  # Aufschwung zurück zum Anfang
for i in range(16): song.dr(song.bar(63) + i * .25, SNARE, ramp(i, 16, 84, 122), .12)
fill(59)

# ---- Rendern ----------------------------------------------------------------------------
sf2, out = cli_paths('bgm_bubbles.ogg')
song.render(sf2, out)
