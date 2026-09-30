# -*- coding: utf-8 -*-
"""Theme-Track „Bonds Unbroken“ (Bonded Companions) → public/music/bgm_theme_bondedcompanions.ogg

Emotionale Heldenhymne in B-Dur / g-Moll, 126 BPM, 64 Takte (121,9 s), nahtlos loopbar.
Vier Gefährten, vier Stimmen: Horn (Humby), Violine (Mellvy), Klarinette (Orphy) und Flöte (Thuly)
spielen nacheinander dasselbe Thema (vier Takte über B–g–Es–F) und verschmelzen im Höhepunkt zu
einer einzigen Hymne. Klavier-Arpeggien tragen den Puls, Streicher, Chor und Blech die Weite.

Aufbau (Takte, 0-basiert):
   0– 7  Intro          Klavier-Arpeggio, Cello-Ostinato, Trommeln; ab Takt 4 Horn (Humby) mit Thema
   8–23  Gefährten      Einsätze im Abstand von vier Takten: Violine (8), Klarinette (12),
                        Flöte (16); ab 20 alle vier gemeinsam, Chor kommt dazu
  24–39  Tränen         g-Moll-Teil (Gm Es B F | Cm Gm Es F): Klavier + Violine singen, Chor im 2. Durchgang
  40–55  Höhepunkt      Hymne (B F/A Gm Dm | Es B/D Cm F), alle vier Stimmen unisono in Oktaven,
                        Blech, Chor, Pauken, Tom-Wirbel: Entschlossenheit
  56–63  Rückführung    Thema wieder im Horn, Klavier, Crescendo, Dominante F → Takt 0

Harmonie: B-Dur/g-Moll, endet auf der Dominante F (Halbschluss, keine Schlusskadenz).
Aufruf:  python3 scripts/music/theme_bondedcompanions.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 126, 64                        # 64 × 4 × 60/126 = 121,9 s
song = Song(bpm=BPM, bars=BARS)
song.inst('cello',   'contra',   84, 64)
song.inst('bass',    'bass2',    92, 60)
song.inst('piano',   'piano',    92, 50)
song.inst('strings', 'strings',  74, 40)
song.inst('tremolo', 'tremolo',  66, 88)
song.inst('horn',    'horns',    88, 36)   # Humby
song.inst('violin',  'violin',   84, 78)   # Mellvy
song.inst('clar',    'clarinet', 82, 56)   # Orphy
song.inst('flute',   'flute',    82, 90)   # Thuly
song.inst('brass',   'brass',    80, 58)
song.inst('choir',   'choir',    82, 64)
song.inst('timp',    'timp',     92, 64)

NAMES = {'C': C, 'Db': Db, 'D': D, 'Eb': Eb, 'E': E, 'F': F, 'Gb': Gb, 'G': G, 'Ab': Ab, 'A': A, 'Bb': Bb, 'B': B}
def nt(s):
    i = 2 if s[1] in '#b' else 1
    return n(NAMES[s[:i]], int(s[i:]))
SCALE = {Bb, C, D, Eb, F, G, A}                      # B-Dur = g-Moll natürlich

# Akkord → (Basston, Grundton, Moll?)
CH = {'Bb': (Bb, Bb, 0), 'Gm': (G, G, 1), 'Eb': (Eb, Eb, 0), 'F': (F, F, 0), 'Cm': (C, C, 1),
      'Dm': (D, D, 1), 'F/A': (A, F, 0), 'Bb/D': (D, Bb, 0)}
def tri(ch, octv=3):
    r = n(CH[ch][1], octv); return [r, r + (3 if CH[ch][2] else 4), r + 7]
def ramp(i, cnt, a, b): return a + (b - a) * i / max(1, cnt - 1)

CYC = ['Bb', 'Gm', 'Eb', 'F']
T_P = ['Gm', 'Eb', 'Bb', 'F', 'Cm', 'Gm', 'Eb', 'F']
H_P = ['Bb', 'F/A', 'Gm', 'Dm', 'Eb', 'Bb/D', 'Cm', 'F']

# ---- Melodien (Beat, Dauer, Ton) -----------------------------------------------------
THEME = [                       # das Gefährten-Thema, 4 Takte über Bb Gm Eb F
 [(0, 1.5, 'F4'), (1.5, .5, 'F4'), (2, 1, 'Bb4'), (3, 1, 'D5')],
 [(0, 2, 'D5'), (2, 1, 'C5'), (3, 1, 'Bb4')],
 [(0, 1.5, 'G4'), (1.5, .5, 'G4'), (2, 1, 'Bb4'), (3, 1, 'Eb5')],
 [(0, 2, 'D5'), (2, 1, 'C5'), (3, 1, 'A4')],
]
TEAR = [                        # g-Moll-Teil
 [(0, 2, 'D5'), (2, 1, 'G5'), (3, 1, 'Bb5')],
 [(0, 1.5, 'Bb5'), (1.5, .5, 'G5'), (2, 2, 'Eb5')],
 [(0, 2, 'F5'), (2, 1, 'Bb5'), (3, 1, 'D6')],
 [(0, 3, 'C6'), (3, 1, 'A5')],
 [(0, 1, 'G5'), (1, 1, 'Eb5'), (2, 2, 'G5')],
 [(0, 1.5, 'Bb5'), (1.5, .5, 'A5'), (2, 2, 'G5')],
 [(0, 1, 'G5'), (1, 1, 'Bb5'), (2, 2, 'Eb6')],
 [(0, 2, 'D6'), (2, 1, 'C6'), (3, 1, 'A5')],
]
HYMN = [
 [(0, 1, 'D5'), (1, 1, 'F5'), (2, 2, 'Bb5')],
 [(0, 1.5, 'A5'), (1.5, .5, 'G5'), (2, 2, 'F5')],
 [(0, 1, 'G5'), (1, 1, 'Bb5'), (2, 2, 'D6')],
 [(0, 1.5, 'C6'), (1.5, .5, 'Bb5'), (2, 2, 'A5')],
 [(0, 1, 'G5'), (1, 1, 'Bb5'), (2, 2, 'Eb6')],
 [(0, 1.5, 'D6'), (1.5, .5, 'C6'), (2, 1, 'Bb5'), (3, 1, 'F5')],
 [(0, 1, 'G5'), (1, 1, 'C6'), (2, 1, 'Eb6'), (3, 1, 'D6')],
 [(0, 3, 'C6'), (3, 1, 'F5')],
]
for M in (THEME, TEAR, HYMN):
    for bar in M:
        for _, _, p in bar: assert nt(p) % 12 in SCALE, p

def mel(b, notes, insts, vels, shifts=None, sus=0.96):
    for off, dur, p in notes:
        for k, (inst, v) in enumerate(zip(insts, vels)):
            sh = shifts[k] if shifts else 0
            song.add(inst, song.bar(b) + off, dur * sus, nt(p) + sh, v + (6 if off == 0 else 0))

# ---- Begleitung -----------------------------------------------------------------------
def arp(b, ch, v=84, up=False):
    s = song.bar(b); t = tri(ch, 3); r = t[0]
    seq = [r, t[1], t[2], t[1] + 12 - 12 + 12, t[2] + 12, t[1] + 12, t[2], t[1]]
    for i, p in enumerate(seq): song.add('piano', s + i * .5, .5, p, v + (8 if i % 4 == 0 else 0))
def bass(b, ch, v=94, drive=True):
    s = song.bar(b); r = n(CH[ch][0], 2); f = r + 7
    pat = ((0, r), (1.5, r), (2, r), (3, f), (3.5, r + 12)) if drive else ((0, r), (2, r))
    for off, p in pat: song.add('bass', s + off, 0.45 if drive else 1.8, p, v + (8 if off == 0 else 0))
def cello(b, ch, v=84):
    s = song.bar(b); r = n(CH[ch][0], 2)
    for i in range(8): song.add('cello', s + i * .5, .45, r if i % 4 != 3 else r + 7, v + (8 if i % 2 == 0 else 0))
def pad(b, ch, inst='strings', v=68, oct_=4):
    for p in tri(ch, oct_): song.add(inst, song.bar(b), 3.97, p, v)
def choir(b, ch, v=80):
    for p in tri(ch, 4): song.add('choir', song.bar(b), 3.97, p, v)
def brass_hit(b, ch, v=88):
    s = song.bar(b); t = tri(ch, 4)
    for off in (0, 2): 
        for p in (t[0], t[2]): song.add('brass', s + off, 1.6, p, v)
def timp(b, ch, v=94, kind='q'):
    s = song.bar(b); r = n(CH[ch][0], 2) + (12 if CH[ch][0] < 7 else 0)
    offs = (0, 2) if kind == 'q' else (0, 1.5, 2, 3.5)
    for off in offs: song.add('timp', s + off, .5, r, v)

# ---- Schlagzeug -----------------------------------------------------------------------
def drums(b, lvl):
    """lvl 0: Kick/Sidestick + Toms, 1: Snare-Backbeat, 2: Höhepunkt mit Clap/Crash."""
    s = song.bar(b); d = lambda off, note, v, du=.2: song.dr(s + off, note, v, du)
    d(0, KICK, 112); d(2.5, KICK, 100)
    if lvl == 0:
        d(1, SIDESTICK, 100); d(3, SIDESTICK, 104); d(2, TOM_L, 86); d(3.5, TOM_M, 84)
        for off in (.5, 1.5, 2.5): d(off, HAT, 100)
    else:
        d(1, SNARE, 106); d(3, SNARE, 110); d(2, KICK, 96)
        for off in (.5, 1.5, 2.5, 3.5): d(off, HAT, 106)
        if lvl == 2:
            d(1, CLAP, 86); d(3, CLAP, 90); d(3.5, KICK, 96)
            if b % 2 == 0: d(0, CRASH, 104, .5)
def fill(b, big=False):
    s = song.bar(b); toms = [TOM_H, TOM_HH, TOM_M, TOM_L]
    if big:
        for i in range(8): song.dr(s + 1.5 + i * .25, SNARE if i < 4 else toms[min(3, i - 4)], ramp(i, 8, 78, 116), .15)
    else:
        for i in range(4): song.dr(s + 2.5 + i * .375, toms[i], ramp(i, 4, 90, 108), .2)
    song.dr(s + 3.75, KICK, 114)
def roll(b, a, z, v0, v1):
    s = song.bar(b) + a; cnt = int((z - a) * 4)
    for i in range(cnt): song.dr(s + i * .25, SNARE, ramp(i, cnt, v0, v1), .15)

# ---- Sätze ----------------------------------------------------------------------------
# Intro 0–7
for i in range(8):
    ch = CYC[i % 4]
    arp(i, ch, 82); cello(i, ch, 82); bass(i, ch, 84, drive=(i >= 4)); drums(i, 0 if i < 4 else 1)
    pad(i, ch, 'tremolo', 54)
    if i % 4 == 3: fill(i, big=(i == 7))
    if i >= 4: mel(i, THEME[i - 4], ['horn'], [92])
# Gefährten 8–23: Einsatz Violine (8), Klarinette (12), Flöte (16), alle ab 20
ENTRY = [('violin', 8, 0), ('clar', 12, 0), ('flute', 16, 12)]
for i in range(16):
    b = 8 + i; ch = CYC[i % 4]
    arp(b, ch, 84); cello(b, ch, 80); bass(b, ch, 92); drums(b, 1 if i < 8 else 2); pad(b, ch, 'strings', 62 + (i // 4) * 3, 3)
    if i % 4 == 3: fill(b, big=(i == 15))
    if i >= 8: choir(b, ch, 64 + (i - 8) * 2)
    if i >= 8: timp(b, ch, 90)
    for who, start, sh in ENTRY:
        if b >= start: mel(b, THEME[(b - start) % 4], [who], [86 if who != 'violin' else 90], shifts=[sh])
    if i >= 8: mel(b, THEME[i % 4], ['horn'], [82])
# Tränen 24–39
for r in range(2):
    for i, ch in enumerate(T_P):
        b = 24 + r * 8 + i
        arp(b, ch, 78 + 4 * r); bass(b, ch, 90, drive=(r == 1)); cello(b, ch, 74); drums(b, 0 if r == 0 else 1)
        pad(b, ch, 'strings', 66 + 6 * r, 3)
        mel(b, TEAR[i], ['violin', 'clar'], [92, 70], shifts=[0, -12])
        if r == 0: song.add('piano', song.bar(b), 4, nt(TEAR[i][0][2]) - 12, 76)
        if r == 1:
            choir(b, ch, 78); mel(b, TEAR[i], ['flute'], [82]); timp(b, ch, 88)
    fill(24 + r * 8 + 7, big=(r == 1))
# Höhepunkt 40–55
for r in range(2):
    for i, ch in enumerate(H_P):
        b = 40 + r * 8 + i
        arp(b, ch, 88); bass(b, ch, 100); cello(b, ch, 86); drums(b, 2); pad(b, ch, 'strings', 76, 3)
        choir(b, ch, 84); brass_hit(b, ch, 84); timp(b, ch, 98, 'g')
        mel(b, HYMN[i], ['horn', 'violin', 'clar', 'flute', 'brass'], [90, 92, 84, 88, 84], shifts=[-12, 0, -12, 12, 0])
        if i % 4 == 3: fill(b, big=(i == 7))
# Rückführung 56–63
for i in range(8):
    b = 56 + i; ch = CYC[i % 4]
    arp(b, ch, 80 + i * 2); cello(b, ch, 80); bass(b, ch, 90); drums(b, 1); pad(b, ch, 'tremolo', 58 + i * 2)
    if i < 4: mel(b, THEME[i], ['horn', 'clar'], [92, 78], shifts=[0, 0])
    else:
        mel(b, THEME[i - 4], ['horn', 'violin'], [96, 90], shifts=[0, 0]); choir(b, ch, 72 + 3 * (i - 4)); timp(b, ch, 90)
fill(59)
roll(63, 0, 3.5, 60, 118); song.dr(song.bar(63) + 3.75, KICK, 116)

sf2, out = cli_paths('bgm_theme_bondedcompanions.ogg')
song.render(sf2, out)
