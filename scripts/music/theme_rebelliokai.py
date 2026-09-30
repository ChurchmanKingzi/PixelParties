# -*- coding: utf-8 -*-
"""Theme „Yokai Uprising“ (Rebelliokai) → public/music/bgm_theme_rebelliokai.ogg

Japanische Yokai-Rebellion im Matsuri-Festival-Fieber: Taiko-Toms und Pauken, Kane-Glocke
(Cowbell), Shamisen (Gitarre) und Koto, Flöte/Blockflöte (Shakuhachi-Ersatz), Marimba für den
hüpfenden Kappa-Tanz, Tengu-Pfeife, Chor-Rufe. 150 BPM, 80 Takte (128,0 s), nahtlos loopbar.

Tonart: Zentrum d. Die Skala kippt bewusst zwischen Yo (d e g a h – festlich, offen) und
In/Miyako-bushi (d es g a b – dunkel, bedrohlich, „Maske“). Kern ist das Hauptmotiv
A–D–E–G (M1) – die Kitsune-Läufe (16tel-Kaskaden) sind seine Verzierung.

Aufbau (Takte, 0-basiert):
   0– 7  Intro           Taiko-Aufmarsch, Kane, Shamisen-Ostinato, Blockflöten-Ruf (M1)
   8–23  Thema A         Flöte M1 (Yo) → Antwort über Es (In) → Kitsune-Lauf; Koto, Shamisen
  24–39  Kappa-Tanz B    Zentrum a (In-Skala a b d e f), Marimba-Hüpfer (Oktavsprünge),
                         Flöte mit langem Bogen, Taiko federnd
  40–55  Höhepunkt C     Yo-Hymne in Flöte+Oboe+Chor, Streicher, Pauken, Tengu-Pfeife
  56–63  Kitsune-Bruch D Taiko-Solo mit Kane, Koto-Tremolo, Kitsune-Läufe steigen
  64–79  Rückführung E   Thema A mit Vollbesetzung, dann M1-Sequenz steigt, Tremolo/Taiko-Wirbel
                         → Sprung auf Takt 0 (Taiko-Schlag)
Der Loop endet auf der Dominante (a) – keine Schlusskadenz.
Aufruf:  python3 scripts/music/theme_rebelliokai.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 150, 80                       # 80 × 4 × 60/150 = 128,0 s
song = Song(bpm=BPM, bars=BARS)

song.inst('timp',    'timp',     96, 64)
song.inst('bass',    'acbass',   96, 60)
song.inst('shami',   'guitar',   92, 46)   # Shamisen
song.inst('koto',    'koto',     92, 80)
song.inst('marimba', 'marimba',  86, 36)
song.inst('flute',   'flute',    92, 70)
song.inst('recorder','recorder', 88, 58)
song.inst('oboe',    'oboe',     84, 76)
song.inst('whistle', 'whistle',  80, 90)   # Tengu
song.inst('strings', 'strings',  74, 40)
song.inst('choir',   'choir',    80, 64)
song.inst('hit',     'hit',      92, 64)
song.inst('bell',    'bell',     70, 84)

NAMES = {'C': C, 'Db': Db, 'D': D, 'Eb': Eb, 'E': E, 'F': F, 'Gb': Gb, 'G': G, 'Ab': Ab, 'A': A, 'Bb': Bb, 'B': B}
def nt(s): return n(NAMES[s[:-1]], int(s[-1]))
YO  = {D, E, G, A, B}
IN  = {D, Eb, G, A, Bb}
AIN = {A, Bb, D, E, F}
ALLOWED = YO | IN | AIN
def chk(p):
    assert p % 12 in ALLOWED, f'Ton außerhalb der Skalen: {p}'
    return p

def mel(inst, bar, notes, vel=90, shift=0, vels=None):
    """Melodiezeile: notes = [(beat, dauer, 'D5'), …] ab Takt bar."""
    for i, (off, dur, p) in enumerate(notes):
        song.add(inst, song.bar(bar) + off, dur * 0.93, chk(nt(p) + shift), vels[i] if vels else vel)
def ramp(i, cnt, a, b): return a + (b - a) * i / max(1, cnt - 1)

# ---- Motive ------------------------------------------------------------------------
M1a = [(0, 1, 'A4'), (1, .5, 'D5'), (1.5, .5, 'E5'), (2, 1.5, 'G5'), (3.5, .5, 'E5')]
M1b = [(0, 1.5, 'D5'), (1.5, .5, 'B4'), (2, 2, 'A4')]
M1c = [(0, 1, 'D5'), (1, .5, 'E5'), (1.5, .5, 'G5'), (2, 2, 'A5')]           # Variante mit Aufschwung
M2a = [(0, 1, 'Bb4'), (1, .5, 'G4'), (1.5, .5, 'Bb4'), (2, 1.5, 'D5'), (3.5, .5, 'Eb5')]   # In-Antwort über Es
M2b = [(0, 1.5, 'D5'), (1.5, .5, 'Bb4'), (2, 2, 'G4')]
RUN = [(i * .25, .25, p) for i, p in enumerate(['A5', 'G5', 'Eb5', 'D5', 'Bb4', 'A4', 'G4', 'Eb4'])] + [(2, 2, 'A4')]
CADA = [(0, 1, 'D5'), (1, 1, 'A4'), (2, .5, 'G4'), (2.5, .5, 'A4'), (3, 1, 'A4')]
# Kappa-Tanz (Zentrum a, In-Skala)
KP1 = [(0, .5, 'A4'), (.5, .5, 'A5'), (1, .5, 'A4'), (1.5, .5, 'Bb4'), (2, .5, 'A4'), (2.5, .5, 'A5'), (3, 1, 'F5')]
KP1b = [(0, .5, 'E5'), (.5, .5, 'D5'), (1, .5, 'E5'), (1.5, .5, 'D5'), (2, .5, 'A4'), (2.5, .5, 'Bb4'), (3, 1, 'A4')]
KP2 = [(0, .5, 'Bb4'), (.5, .5, 'Bb5'), (1, .5, 'Bb4'), (1.5, .5, 'A4'), (2, .5, 'F4'), (2.5, .5, 'A4'), (3, 1, 'D5')]
KP2b = [(0, 1, 'E5'), (1, .5, 'D5'), (1.5, .5, 'A4'), (2, 2, 'A4')]
KF = [[(0, 2, 'E5'), (2, 1, 'D5'), (3, 1, 'A4')], [(0, 1, 'F5'), (1, 1, 'E5'), (2, 2, 'D5')],
      [(0, 1, 'F5'), (1, 1, 'D5'), (2, 1, 'Bb4'), (3, 1, 'D5')], [(0, 3, 'E5'), (3, 1, 'A4')]]
# Hymne (Yo)
HY = [[(0, 1, 'D5'), (1, 1, 'A5'), (2, 1.5, 'G5'), (3.5, .5, 'E5')],
      [(0, 1, 'D5'), (1, 1, 'E5'), (2, 2, 'A5')],
      [(0, 1, 'B5'), (1, 1, 'A5'), (2, 1.5, 'G5'), (3.5, .5, 'E5')],
      [(0, 1, 'D5'), (1, 1, 'B4'), (2, 2, 'G4')],
      M1a, M1c,
      [(0, 1, 'E5'), (1, 1, 'A5'), (2, 1, 'B5'), (3, 1, 'A5')],
      [(0, 2, 'G5'), (2, 1, 'E5'), (3, 1, 'A5')]]

# ---- Harmonie (Basswurzeln je Takt) --------------------------------------------------
PA  = [D, D, D, D, Eb, Eb, A, A]
PB1 = [A, A, Bb, A, A, A, Bb, E]
PB2 = [A, A, Bb, A, A, A, Bb, E]
PC1 = [D, D, G, G, D, D, A, A]
PC2 = [G, G, A, A, D, D, A, A]
PD  = [D, Eb, D, Eb, A, A, A, A]
PE2 = [D, D, Eb, Eb, G, G, A, A]
PINTRO = [D, D, D, D, D, D, Eb, A]
ROOTS = PINTRO + PA + PA + PB1 + PB2 + PC1 + PC2 + PD + PA + PE2
assert len(ROOTS) == BARS
def bassnote(pc, octv=2): return n(pc, octv)
CT = {D: [D, A, D + 12], Eb: [Eb, Bb, G], G: [G, D, A], A: [A, E, D + 12], Bb: [Bb, F, D + 12], E: [E, A, D + 12]}

# ---- Bausteine -------------------------------------------------------------------
def bass_line(b, kind='a', vel=96):
    s = song.bar(b); r = ROOTS[b]
    lo, hi = bassnote(r, 2), bassnote(r, 2) + 7
    if r == E: hi = lo + 5
    if kind == 'a':       # Taiko-nah: Grundton, Nachschlag
        for off, p, v in ((0, lo, 0), (0.75, lo, -14), (1.5, hi, -8), (2, lo, -2), (2.75, lo, -14), (3.5, hi, -6)): song.add('bass', s + off, .5, p, vel + v)
    elif kind == 'b':     # federnd, off-beat
        for off, p, v in ((0, lo, 0), (1, hi, -12), (1.5, lo + 12, -6), (2, lo, -2), (3, hi, -12), (3.5, lo + 12, -6)): song.add('bass', s + off, .4, p, vel + v)
    elif kind == 'c':     # Achtel-Drive
        for i in range(8): song.add('bass', s + i * .5, .45, lo if i % 2 == 0 else hi, vel + (6 if i % 4 == 0 else -8))

def timp_b(b, kind='q', vel=96):
    s = song.bar(b); p = bassnote(ROOTS[b], 2)
    if kind == 'q':
        for off in (0, 2): song.add('timp', s + off, .6, p, vel)
    elif kind == 'g':
        for off, v in ((0, 0), (1.5, -10), (2, -2), (3.5, -10)): song.add('timp', s + off, .4, p, vel + v)
    elif kind == 'roll':
        for i in range(16): song.add('timp', s + i * .25, .25, p, ramp(i, 16, vel - 20, vel))

def shami(b, kind='a', vel=88):
    """Shamisen-Ostinato „ben-ben“: Grundton/Quinte im Wechsel mit Zupfakzenten."""
    s = song.bar(b); r = n(ROOTS[b], 3)
    pat = {'a': [(0, 0), (.75, 7), (1.5, 0), (2, 12), (2.75, 7), (3.5, 0)],
           'b': [(0, 0), (.5, 7), (1, 12), (1.5, 7), (2, 0), (2.5, 7), (3, 12), (3.5, 10 if ROOTS[b] in (Bb,) else 7)],
           'c': [(i * .25, [0, 7, 12, 7][i % 4]) for i in range(16)]}[kind]
    for off, iv in pat: song.add('shami', s + off, .3, chk(r + iv) if (r + iv) % 12 in ALLOWED else r + 7, vel + (8 if off == 0 else 0))

def koto_arp(b, vel=80, up=True, step=.5):
    s = song.bar(b); ct = [n(pc % 12, 4) if pc < 12 else n(pc % 12, 5) for pc in CT[ROOTS[b]]]
    seq = ct + [ct[1]] if up else ct[::-1] + [ct[1]]
    for i in range(int(4 / step)): song.add('koto', s + i * step, step * 1.6, seq[i % 4] , vel + (8 if i % 4 == 0 else 0))

def koto_trem(b, vel=76):
    s = song.bar(b); p = n(ROOTS[b], 5)
    for i in range(16): song.add('koto', s + i * .25, .25, p, ramp(i, 16, vel - 12, vel + 10))

def marimba_hop(b, vel=84):
    s = song.bar(b); r = n(ROOTS[b], 3); o = 12
    for off, iv in ((0, 0), (.5, o), (1, 0), (1.5, 7), (2, 0), (2.5, o), (3, 7), (3.5, o)):
        p = r + iv
        song.add('marimba', s + off, .3, p if p % 12 in ALLOWED else r + 7, vel + (8 if off == 0 else 0))

def pad(inst, b, vel, dur=3.95, octv=4):
    s = song.bar(b); r = ROOTS[b]
    for pc in (r, (r + 7) % 12): song.add(inst, s, dur, n(pc, octv) if pc >= r else n(pc, octv + 1), vel)

def kane(b, vel=86, dense=False):
    """Kane (Cowbell): Festival-Glocke. dicht = Achtel, sonst Gegenschläge."""
    s = song.bar(b)
    if dense:
        for i in range(8): song.dr(s + i * .5, COWBELL, vel if i % 2 else vel - 16)
    else:
        for off in (.5, 1.5, 2.5, 3.5): song.dr(s + off, COWBELL, vel)

TOMS = [TOM_H, TOM_HH, TOM_M, TOM_L]
def taiko(b, kind, v=1.0):
    s = song.bar(b)
    def d(off, note, vel): song.dr(s + off, note, min(127, vel * v))
    if kind == 'A':     # „don-doko“
        for off, note, vel in ((0, KICK, 118), (0, TOM_L, 100), (.75, TOM_M, 88), (1, SIDESTICK, 96), (1.5, TOM_M, 96), (2, KICK, 112),
                               (2.5, TOM_L, 94), (2.75, TOM_M, 86), (3, SIDESTICK, 96), (3.5, TOM_H, 100)): d(off, note, vel)
    elif kind == 'B':   # federnd, mit Holzklappern
        for off, note, vel in ((0, KICK, 116), (.5, SIDESTICK, 90), (1, TOM_M, 96), (1.5, SIDESTICK, 88), (2, KICK, 108), (2.5, SIDESTICK, 90),
                               (3, TOM_L, 98), (3.25, TOM_M, 88), (3.5, TOM_H, 100)): d(off, note, vel)
    elif kind == 'C':   # Höhepunkt: volle Wucht
        for off, note, vel in ((0, KICK, 122), (0, TOM_L, 108), (1, CLAP, 100), (1, TOM_M, 100), (1.5, KICK, 100), (2, KICK, 116), (2, TOM_L, 104),
                               (2.5, TOM_M, 96), (3, CLAP, 104), (3, TOM_M, 100), (3.5, TOM_H, 104), (3.75, TOM_HH, 96)): d(off, note, vel)
    elif kind == 'D':   # Taiko-Solo, dichte Schlagfolge
        pat = [(0, KICK, 120), (.5, TOM_M, 92), (.75, TOM_H, 90), (1, TOM_L, 108), (1.5, TOM_M, 94), (1.75, TOM_M, 88), (2, KICK, 118), (2.25, TOM_L, 96),
               (2.5, TOM_M, 100), (2.75, TOM_H, 96), (3, TOM_L, 108), (3.25, TOM_M, 92), (3.5, TOM_H, 100), (3.75, TOM_HH, 98)]
        for off, note, vel in pat: d(off, note, vel)

def crash(b, vel=104): song.dr(song.bar(b), CRASH, vel, 1.0)

def fill(b, vel0=84, vel1=120):
    s = song.bar(b)
    for i in range(8): song.dr(s + 2 + i * .25, TOMS[min(3, i // 2)], ramp(i, 8, vel0, vel1), .2)
    song.dr(s + 3.75, KICK, 120)

def roll(b, v0, v1, start=0, end=4):
    s = song.bar(b) + start; cnt = int((end - start) * 4)
    for i in range(cnt): song.dr(s + i * .25, TOMS[(i // 2) % 4] if i % 2 else SNARE, ramp(i, cnt, v0, v1), .15)

def stab(b, beat, vel=104, dur=.8):
    s = song.bar(b) + beat; r = ROOTS[b]
    for p in (n(r, 3), n(r, 4), n((r + 7) % 12, 4)): song.add('hit', s, dur, p, vel)

# ============================ KOMPOSITION ==========================================
# ---- Intro 0–7 ------------------------------------------------------------------
for b in range(0, 8):
    taiko(b, 'A', 1.0 if b >= 2 else 0.95); kane(b, 82, dense=b >= 4)
    bass_line(b, 'a', 92); timp_b(b, 'q', 92); shami(b, 'a', 84)
    if b >= 2: koto_arp(b, 74)
crash(0, 110)
mel('recorder', 4, M1a, 88); mel('recorder', 5, M1b, 86)
mel('recorder', 6, RUN, 86); mel('recorder', 7, CADA, 84)
song.add('whistle', song.bar(3) + 2, 1.9, nt('A5'), 74)
fill(3, 84, 112); fill(7, 90, 122)

# ---- Thema A 8–23 -----------------------------------------------------------------
for k, base in enumerate((8, 16)):
    for i in range(8):
        b = base + i
        taiko(b, 'A'); kane(b, 88, dense=(k == 1)); bass_line(b, 'a'); timp_b(b, 'q' if k == 0 else 'g')
        shami(b, 'a' if k == 0 else 'b', 90); koto_arp(b, 82, up=(i % 2 == 0))
    crash(base, 108)
    mel('flute', base, M1a, 94); mel('flute', base + 1, M1b, 92)
    mel('flute', base + 2, M1a, 96); mel('flute', base + 3, M1c, 96)
    mel('flute', base + 4, M2a, 94); mel('flute', base + 5, M2b, 92)
    mel('flute', base + 6, RUN, 92); mel('flute', base + 7, CADA, 90)
    if k == 1:            # zweiter Durchgang: Oboe verdoppelt, Chor-Rufe, Tengu-Pfeife
        for j, ph in enumerate((M1a, M1b, M1a, M1c, M2a, M2b)): mel('oboe', base + j, ph, 80, shift=0)
        for b in (base, base + 4): pad('strings', b, 66)
        song.add('whistle', song.bar(base + 3) + 3, .9, nt('A5'), 84)
    fill(base + 3, 84, 116); fill(base + 7, 96, 124)

# ---- Kappa-Tanz B 24–39 ---------------------------------------------------------
for k, base in enumerate((24, 32)):
    for i in range(8):
        b = base + i
        taiko(b, 'B'); kane(b, 88, dense=True); bass_line(b, 'b', 94); timp_b(b, 'g', 90)
        marimba_hop(b, 84); koto_arp(b, 74, up=(i % 2 == 1), step=.5)
        if k == 1 or i >= 4: shami(b, 'b', 84)
    crash(base, 106)
    if k == 0:
        for j, ph in enumerate((KP1, KP1b, KP2, KP2b, KP1, KP1b, KP2, KP2b)): mel('marimba', base + j, ph, 96)
        for j, ph in enumerate((KP1, KP1b, KP2, KP2b)): mel('flute', base + 4 + j, KF[j], 88)
    else:
        for j, ph in enumerate((KP1, KP1b, KP2, KP2b)): mel('marimba', base + j, ph, 96); mel('koto', base + j, ph, 90, shift=12 if j in (0, 2) else 0)
        for j in range(4): mel('flute', base + j, [(0, 2, 'A5')] if j == 0 else [(0, 2, ['A5', 'F5', 'D5', 'E5'][j])], 78)
        for j in range(4): mel('flute', base + 4 + j, KF[j], 92); mel('oboe', base + 4 + j, KF[j], 80)
        for b in (base + 4, base + 6): pad('strings', b, 66)
        song.add('whistle', song.bar(base + 7) + 2, 1.9, nt('A5'), 82)
    fill(base + 3, 82, 108); fill(base + 7, 92, 124)

# ---- Höhepunkt C 40–55 -----------------------------------------------------------
for k, base in enumerate((40, 48)):
    for i in range(8):
        b = base + i
        taiko(b, 'C'); kane(b, 92, dense=True); bass_line(b, 'c', 98); timp_b(b, 'g', 100)
        shami(b, 'c' if i % 2 == 0 else 'b', 90); koto_arp(b, 84, step=.5)
        pad('strings', b, 72); pad('choir', b, 74, octv=4)
        if i % 2 == 0: crash(b, 98 if i else 112)
    for j in range(8):
        mel('flute', base + j, HY[j], 100); mel('oboe', base + j, HY[j], 88, shift=-12 if k == 0 else 0)
        if k == 1: mel('whistle', base + j, [(o, d, p) for o, d, p in HY[j] if d >= 1.5][:1] or [(0, .5, 'A5')], 82)
    for b in (base, base + 4): stab(b, 0, 108, 1.4)
    for b in (base + 2, base + 6): stab(b, 2, 100, .7)
    fill(base + 3, 88, 118); fill(base + 7, 100, 127)

# ---- Kitsune-Bruch D 56–63 ------------------------------------------------------
KIT_UP = ['D4', 'Eb4', 'G4', 'A4', 'Bb4', 'D5', 'Eb5', 'G5', 'A5', 'Bb5', 'D6']
for i in range(8):
    b = 56 + i
    taiko(b, 'D', 1.0); kane(b, 90, dense=True); bass_line(b, 'a', 88); timp_b(b, 'g', 94)
    koto_trem(b, 78) if i < 4 else koto_arp(b, 84, step=.25)
    if i >= 4: shami(b, 'c', 90)
    if i >= 6: pad('strings', b, 66)
crash(56, 108)
for j, ph in enumerate((RUN, [(0, 1, 'D5'), (1, 1, 'Bb4'), (2, 2, 'A4')], RUN, CADA)):
    mel('flute', 56 + j, ph, 90)
# aufsteigende Kitsune-Läufe (16tel, jeder Lauf ein Stück höher)
for j, b in enumerate((60, 61, 62, 63)):
    lo = j * 1
    seq = KIT_UP[lo:lo + 8] if len(KIT_UP) - lo >= 8 else KIT_UP[-8:]
    for i, p in enumerate(seq): song.add('flute', song.bar(b) + i * .25, .24, chk(nt(p)), ramp(i, 8, 82, 104))
    for i, p in enumerate(seq): song.add('oboe', song.bar(b) + 2 + i * .25, .24, chk(nt(p)), ramp(i, 8, 76, 98))
song.add('whistle', song.bar(59) + 2, 1.9, nt('D6'), 84)
fill(59, 90, 118); roll(63, 84, 124, 0, 3); song.dr(song.bar(63) + 3.75, KICK, 122)

# ---- Rückführung E 64–79 ----------------------------------------------------------
for i in range(8):
    b = 64 + i
    taiko(b, 'A', 1.05); kane(b, 92, dense=True); bass_line(b, 'a', 98); timp_b(b, 'g', 98)
    shami(b, 'b', 92); koto_arp(b, 82, up=(i % 2 == 0), step=.5); pad('strings', b, 70)
crash(64, 112)
for j, ph in enumerate((M1a, M1b, M1a, M1c, M2a, M2b, RUN, CADA)):
    mel('flute', 64 + j, ph, 98); mel('oboe', 64 + j, ph, 84); mel('recorder', 64 + j, ph, 76, shift=12)
fill(67, 88, 116); fill(71, 98, 126)
# E2: M1-Kopfmotiv als Sequenz, immer enger und höher
HEAD = [(0, 1, 'A4'), (1, .5, 'D5'), (1.5, .5, 'E5'), (2, 1, 'G5'), (3, 1, 'A5')]
for i in range(8):
    b = 72 + i
    taiko(b, 'C' if i < 6 else 'D', 1.0); kane(b, 94, dense=True); bass_line(b, 'c', 98); timp_b(b, 'g' if i < 6 else 'roll', 100)
    shami(b, 'c', 90); pad('strings', b, 74); pad('choir', b, 70)
crash(72, 108)
for j in range(6):
    mel('flute', 72 + j, HEAD, 98 + j)
    mel('oboe', 72 + j, HEAD, 88)
    song.add('koto', song.bar(72 + j) + 3.5, .4, nt('A5'), 90)
for j in (6, 7):
    for i in range(16): song.add('flute', song.bar(72 + j) + i * .25, .24, chk(nt(['A5', 'G5', 'Eb5', 'D5', 'Bb4', 'A4', 'G4', 'Eb4'][i % 8]) if j == 6 else nt(['Eb4', 'G4', 'A4', 'Bb4', 'D5', 'Eb5', 'G5', 'A5'][i % 8])), ramp(i, 16, 84, 108))
song.add('whistle', song.bar(75) + 3, .9, nt('A5'), 86)
fill(75, 90, 120); roll(78, 90, 118, 2, 4); roll(79, 100, 127, 0, 3.75); song.dr(song.bar(79) + 3.75, KICK, 124)

sf2, out = cli_paths('bgm_theme_rebelliokai.ogg')
song.render(sf2, out)
