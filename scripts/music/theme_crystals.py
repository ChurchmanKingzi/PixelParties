# -*- coding: utf-8 -*-
"""Theme-Track „Shards of Radiance“ (Archetyp Crystals) → public/music/bgm_theme_crystals.ogg

Funkelnde Kristallmagie in D-lydisch (das G# ist der Regenbogen-Ton), 144 BPM, 72 Takte
(120,0 s), nahtlos loopbar. Glockenspiel/Vibraphon/Crystal-Arpeggien in 16teln, Harfe,
Glocken-Melodie, hoher Chor; treibender Beat mit Clap und Cowbell. Die Grinsekatze taucht als
schräger, gestopfter Nebenton auf (Marimba: Quinte – b6 – Quinte – #4, Cowbell-Zwinkern) am
Ende der Phrasen. Das lydische Dur-II (E-Dur über D) ist das Kristall-Funkeln der Harmonik.

Aufbau (Takte, 0-basiert):
   0– 7  Intro          Glock/Kristall-16tel, Bass-Puls, Beat; Katzenzwinkern
   8–23  Thema A        Glocke: Hauptmotiv (D-F#-A-D, aufsteigende Kristallkette), Harfe, Vibes-Offbeats;
                        zweiter Durchgang mit Chor und Gegenstimme
  24–39  Steigerung B   Sequenz steigt, Streicher, 16tel-Hi-Hat, Gegenstimme fällt
  40–55  Höhepunkt C    Hymne in D, dann Rückung nach E-lydisch (Takt 48–55), Chor, Kristall-Glanz
  56–63  Rückblick D    Thema A leise (Vibes/Harfe), Katze
  64–71  Rückführung E  Vi–II–iii–V, Wirbel, endet auf der Dominante A → zurück zu Takt 0

Aufruf:  python3 scripts/music/theme_crystals.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 144, 72                       # 72 × 4 × 60/144 = 120,0 s
song = Song(bpm=BPM, bars=BARS)
song.inst('bass',   'sbass2',  96, 62)
song.inst('pizz',   'pizz',    70, 50)
song.inst('glock',  'glock',   84, 80)    # 16tel-Funkeln
song.inst('crystal','crystal', 74, 46)    # Arpeggien
song.inst('vibes',  'vibes',   82, 34)    # Offbeat-Akkorde
song.inst('harp',   'harp',    84, 92)
song.inst('bell',   'bell',    90, 66)    # Hauptmelodie
song.inst('bell2',  'glock',   80, 70)    # Melodie-Oktave / Gegenstimme
song.inst('choir',  'choir',   80, 64)
song.inst('oohs',   'oohs',    72, 60)
song.inst('strings','strings', 74, 40)
song.inst('cat',    'marimba', 88, 96)    # Grinsekatze
song.inst('hit',    'bright',  76, 64)

SC = [0, 2, 4, 6, 7, 9, 11]               # lydisch
def dn(root, d): o, i = divmod(d, 7); return root + 12 * o + SC[i]
def chord(root, k): return [dn(root, k), dn(root, k + 2), dn(root, k + 4)]
def ramp(i, cnt, a, b): return a + (b - a) * i / max(1, cnt - 1)
CHECK = []                                 # (Note, Tonika) für den Skala-Check
def scale_note(p, root): CHECK.append((p, root)); return p

R = n(D, 0)                                # D-Tonika als Pitchclass-Basis (Oktave -1); Töne setzen Oktave selbst
def croot(shift, octv): return n(D, octv) + shift

# ---- Bausteine -----------------------------------------------------------------------
def bass(b, k, shift=0, kind=1, vel=96):
    s = song.bar(b); r = croot(shift, 2) + SC[k % 7] - (12 if SC[k % 7] > 6 else 0)
    if kind == 1:      # synkopiert 3-3-2
        for off, dr_, p in ((0, .6, r), (0.75, .3, r + 12), (1.5, .6, r), (2.25, .3, r + 12), (3, .6, r + 7), (3.5, .4, r + 12)):
            song.add('bass', s + off, dr_, p, vel + (8 if off == 0 else 0))
    elif kind == 2:    # Achtel
        for i in range(8): song.add('bass', s + i * .5, .42, r + (12 if i % 2 else 0), vel + (8 if i == 0 else 0))
    else:              # Viertel/Oktave, ruhig
        for off, p in ((0, r), (1, r + 12), (2, r + 7), (3, r + 12)): song.add('bass', s + off, .8, p, vel)

def pizz(b, k, shift=0, vel=70):
    s = song.bar(b); ch = chord(croot(shift, 3), k)
    for off, p in ((0.5, ch[1]), (1.5, ch[2]), (2.5, ch[1]), (3.5, ch[2])): song.add('pizz', s + off, .3, p, vel)

def arp(b, k, shift=0, inst='glock', octv=5, vel=72, step=.25, pat=0):
    s = song.bar(b); t = chord(croot(shift, octv), k); t = t + [t[0] + 12]
    seq = [0, 1, 2, 3, 2, 1, 2, 3] if pat == 0 else [0, 2, 1, 3, 2, 3, 1, 2]
    for i in range(int(4 / step)):
        song.add(inst, s + i * step, step * 1.6, t[seq[i % 8]], vel + (12 if i % 4 == 0 else 0) - (4 if i % 2 else 0))

def harp_roll(b, k, shift=0, vel=76):
    s = song.bar(b); t = chord(croot(shift, 4), k) + chord(croot(shift, 5), k)
    for i, p in enumerate(t): song.add('harp', s + i * .25, 1.2, p, vel + i)
    for i, p in enumerate(reversed(t[2:])): song.add('harp', s + 2 + i * .25, 1.2, p, vel - 4)

def offbeat(b, k, shift=0, vel=78):
    s = song.bar(b); ch = chord(croot(shift, 4), k)
    for off in (0.5, 1.5, 2.5, 3.5):
        for p in ch: song.add('vibes', s + off, .4, p, vel)

def pad(b, k, shift=0, inst='choir', vel=72, octv=5):
    ch = chord(croot(shift, octv), k)
    for p in ch: song.add(inst, song.bar(b), 3.98, p, vel)

def cat(b, beat=2.0, shift=0, vel=88):
    """Grinsekatze: Quinte – b6 – Quinte – #4 (schräg, gestopft) + Cowbell-Zwinkern."""
    s = song.bar(b) + beat; r = croot(shift, 5)
    for off, dur, p in ((0, .25, r + 7), (.25, .25, r + 8), (.5, .25, r + 7), (.75, .25, r + 6), (1.0, .5, r + 12)):
        song.add('cat', s + off, dur * .9, p, vel)
    song.dr(s + 0.25, COWBELL, 92); song.dr(s + 1.0, COWBELL, 100)

def line(b, notes, insts, vels, shift=0, octv=5):
    """notes = [(beat, dauer, stufe)] – Stufe relativ zur Tonika (0 = D5 bei octv 5)."""
    r = croot(shift, octv)
    for off, dur, d in notes:
        for inst, v in zip(insts, vels):
            song.add(inst, song.bar(b) + off, dur * .94, scale_note(dn(r, d) + (12 if inst == 'bell2' else 0), r), v)

# ---- Schlagzeug ----------------------------------------------------------------------
def groove(b, kind, v=1.0):
    s = song.bar(b)
    def d(off, note, vel): song.dr(s + off, note, min(127, vel * v))
    if kind == 'A':
        for off, vel in ((0, 112), (2, 100), (2.75, 88)): d(off, KICK, vel)
        d(1, CLAP, 104); d(3, CLAP, 108); d(1, SNARE, 80); d(3, SNARE, 86)
        for i in range(8): d(i * .5, HAT, 104 if i % 2 == 0 else 84)
        d(3.5, COWBELL, 70)
    elif kind == 'B':
        for off in (0, 1, 2, 3): d(off, KICK, 108 if off == 0 else 94)
        d(1, SNARE, 106); d(3, SNARE, 110); d(1, CLAP, 96); d(3, CLAP, 100)
        for i in range(16): d(i * .25, HAT, 100 if i % 4 == 0 else (86 if i % 2 == 0 else 72))
        d(1.5, COWBELL, 72); d(3.5, COWBELL, 76)
    elif kind == 'C':
        for off, vel in ((0, 118), (0.75, 90), (1.5, 96), (2, 108), (3.5, 100)): d(off, KICK, vel)
        d(1, SNARE, 112); d(3, SNARE, 116); d(1, CLAP, 100); d(3, CLAP, 104)
        for i in range(8): d(i * .5, RIDE, 100 if i % 2 == 0 else 84)
        for off in (0.5, 1.5, 2.5, 3.5): d(off, COWBELL, 84)
        d(2.5, TOM_M, 84)
    elif kind == 'soft':
        d(0, KICK, 88); d(2, KICK, 80); d(1, SIDESTICK, 96); d(3, SIDESTICK, 100)
        for i in range(8): d(i * .5, HAT, 96 if i % 2 == 0 else 80)
TOMS = [TOM_H, TOM_HH, TOM_M, TOM_L]
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

# ---- Melodien (Stufen; 0 = D) --------------------------------------------------------
CH_A = [0, 1, 5, 4, 0, 1, 2, 5]
MEL_A = [
    [(0, 1, 0), (1, .5, 2), (1.5, .5, 4), (2, 2, 7)],                       # D F# A D  (Kristallkette)
    [(0, 1, 8), (1, .5, 6), (1.5, .5, 5), (2, 1, 6), (3, 1, 4)],           # E D# ...
    [(0, 1, 5), (1, .5, 7), (1.5, .5, 5), (2, 2, 4)],
    [(0, 1, 6), (1, 1, 4), (2, 1, 2), (3, 1, 4)],
    [(0, 1, 0), (1, .5, 2), (1.5, .5, 4), (2, 1, 7), (3, 1, 9)],
    [(0, 1, 8), (1, .5, 6), (1.5, .5, 5), (2, 1, 3), (3, 1, 5)],           # G# (Stufe 3) = lydisch
    [(0, 1, 9), (1, 1, 7), (2, 1, 4), (3, 1, 2)],
    [(0, 1.5, 4), (1.5, .5, 5), (2, 2, 6)],
]
CTR_A = [(-3, 0), (-2, -1), (-1, 0), (0, 2), (-3, 0), (-2, 1), (-1, 2), (-1, 4)]   # 2 Halbe/Takt (Gegenstimme, Oktave 4)
CH_B = [5, 4, 0, 1, 5, 4, 1, 4, 5, 4, 0, 1, 2, 5, 1, 4]
def mel_b(i):                              # aufsteigende Sequenz
    d = [0, 1, 2, 3, 2, 3, 4, 5, 0, 1, 2, 4, 5, 6, 7, 8][i]
    return [(0, .75, d), (.75, .75, d + 1), (1.5, .5, d + 2), (2, 1, d + 4), (3, 1, d + 2)] if i not in (7, 15) else [(0, 1, 9), (1, 1, 7), (2, 1, 6), (3, 1, 4)]
CH_C1 = [0, 4, 5, 2, 0, 1, 4, 1]
MEL_C1 = [
    [(0, 1, 7), (1, 1, 9), (2, 1.5, 11), (3.5, .5, 9)],
    [(0, 1, 11), (1, 1, 9), (2, 2, 7)],
    [(0, 1, 9), (1, 1, 7), (2, 1.5, 5), (3.5, .5, 7)],
    [(0, 1, 9), (1, 1, 7), (2, 2, 4)],
    [(0, 1, 7), (1, 1, 9), (2, 1, 11), (3, 1, 14)],
    [(0, 1.5, 13), (1.5, .5, 11), (2, 2, 8)],
    [(0, 1, 11), (1, 1, 9), (2, 1, 7), (3, 1, 6)],
    [(0, 3, 7), (3, .5, 6), (3.5, .5, 7)],
]
CH_E = [5, 5, 1, 1, 2, 2, 4, 4]

# ==== Arrangement ======================================================================
# ---- Intro 0–7: Vi-Vi... : D D E E Bm Bm A A ----------------------------------------
CH_I = [0, 0, 1, 1, 5, 5, 4, 4]
for b, k in enumerate(CH_I):
    bass(b, k, 0, 3 if b < 4 else 1, 84 + b * 2)
    arp(b, k, 0, 'glock', 5, 70 + b * 3, .25, b % 2)
    if b >= 2: arp(b, k, 0, 'crystal', 4, 58 + b * 3, .5)
    groove(b, 'soft', 1.0 + .03 * b)
    if b >= 4: pizz(b, k, 0, 66); harp_roll(b, k, 0, 70 + (b - 4) * 4)
    if b >= 6: pad(b, k, 0, 'oohs', 56 + (b - 6) * 10)
cat(3, 2.0, 0, 78); cat(7, 2.0, 0, 84)
crash(0, 104); roll(7, 2, 4, 60, 100); fill(7)

# ---- Thema A 8–23 -------------------------------------------------------------------
crash(8, 112)
for i in range(16):
    b, k = 8 + i, i % 8; ch = CH_A[k]; second = i >= 8
    bass(b, ch, 0, 1, 96 + (4 if second else 0))
    groove(b, 'A', 1.0 + (.05 if second else 0))
    offbeat(b, ch, 0, 72 + (6 if second else 0))
    harp_roll(b, ch, 0, 74)
    arp(b, ch, 0, 'crystal', 4, 56, .5) if not second else arp(b, ch, 0, 'glock', 5, 64, .25, 1)
    line(b, MEL_A[k], ['bell'] + (['bell2'] if second else []), [92, 66] if second else [92])
    if second:
        pad(b, ch, 0, 'choir', 60 + (k // 2) * 5, 5)
        for j, d in enumerate(CTR_A[k]): song.add('strings', song.bar(b) + j * 2, 1.95, scale_note(dn(croot(0, 4), d), croot(0, 4)), 66)
        pizz(b, ch, 0, 62)
cat(15, 2.0, 0, 84); cat(23, 2.5, 0, 90)
fill(15); roll(22, 2, 4, 60, 100); roll(23, 0, 3, 80, 122); fill(23, True)

# ---- Steigerung B 24–39 -------------------------------------------------------------
crash(24, 114); crash(32, 116)
for i in range(16):
    b = 24 + i; ch = CH_B[i]; second = i >= 8
    bass(b, ch, 0, 2, 100)
    groove(b, 'B', 1.0 + (.05 if second else 0))
    arp(b, ch, 0, 'glock', 5, 72 + (i % 8) * 2, .25, i % 2)
    arp(b, ch, 0, 'crystal', 4, 62, .5, 1)
    harp_roll(b, ch, 0, 74)
    pad(b, ch, 0, 'strings', 70, 4)
    line(b, mel_b(i), ['bell', 'bell2'] if second else ['bell'], [96, 70] if second else [94])
    if second: pad(b, ch, 0, 'choir', 62 + (i - 8) * 3, 5)
    else: song.add('strings', song.bar(b), 3.95, dn(croot(0, 4), [4, 3, 2, 1, 0, -1, -2, -3][i]), 70)
cat(31, 2.0, 0, 88); cat(39, 2.0, 0, 92)
fill(31); fill(35); roll(38, 0, 4, 60, 100); roll(39, 0, 3, 90, 127); fill(39, True)

# ---- Höhepunkt C 40–55 (Rückung 48–55 nach E-lydisch) ----------------------------------
crash(40, 120); crash(48, 122)
for i in range(16):
    b = 40 + i; k = i % 8; ch = CH_C1[k]; sh = 0 if i < 8 else 2
    bass(b, ch, sh, 1, 104)
    groove(b, 'C', 1.0 + (.04 if i >= 8 else 0))
    arp(b, ch, sh, 'glock', 5, 78, .25, k % 2)
    arp(b, ch, sh, 'crystal', 4, 68, .5)
    harp_roll(b, ch, sh, 76)
    offbeat(b, ch, sh, 68)
    pad(b, ch, sh, 'choir', 84, 5); pad(b, ch, sh, 'oohs', 70, 4)
    pad(b, ch, sh, 'strings', 72, 4)
    line(b, MEL_C1[k], ['bell', 'bell2'], [102, 84], sh)
    song.add('hit', song.bar(b), 1.2 if k % 4 == 0 else .4, dn(croot(sh, 5), CH_C1[k]) + 12, 84 if k % 4 == 0 else 60)
    if k in (0, 4) and b not in (40, 48): crash(b, 100)
cat(47, 2.0, 0, 92); cat(55, 2.0, 2, 92)
fill(43); fill(47); fill(51); roll(54, 0, 4, 70, 110); roll(55, 0, 3, 100, 127); fill(55, True)

# ---- Rückblick D 56–63 --------------------------------------------------------------
crash(56, 100)
for i in range(8):
    b = 56 + i; ch = CH_A[i]
    bass(b, ch, 0, 3 if i < 4 else 1, 90 + i)
    groove(b, 'soft', 1.05 + .03 * i)
    harp_roll(b, ch, 0, 68 + i * 2)
    arp(b, ch, 0, 'glock', 5, 60 + i * 3, .25, i % 2)
    offbeat(b, ch, 0, 60 + i * 2)
    line(b, MEL_A[i], ['vibes'], [78 + i])
    if i >= 4: pad(b, ch, 0, 'oohs', 56 + (i - 4) * 8)
cat(63, 2.0, 0, 84); fill(63)

# ---- Rückführung E 64–71 --------------------------------------------------------------
crash(64, 108)
for i, ch in enumerate(CH_E):
    b = 64 + i
    bass(b, ch, 0, 2, 96 + i * 2)
    arp(b, ch, 0, 'glock', 5, 68 + i * 4, .25, i % 2)
    arp(b, ch, 0, 'crystal', 4, 64, .5)
    harp_roll(b, ch, 0, 74)
    pad(b, ch, 0, 'strings', 66 + i * 3, 4)
    if i >= 2: pad(b, ch, 0, 'choir', 60 + i * 4, 5)
    if i < 4: groove(b, 'B', .92 + i * .03)
    else: roll(b, 0, 4, 55 + (i - 4) * 12, 85 + (i - 4) * 14)
line(68, [(0, 1, 9), (1, 1, 7), (2, 1, 5), (3, 1, 4)], ['bell', 'bell2'], [96, 76])
line(70, [(0, .5, 4), (.5, .5, 5), (1, .5, 6), (1.5, .5, 7), (2, 2, 9)], ['bell', 'bell2'], [100, 80])
line(71, [(0, .25, 0), (.25, .25, 2), (.5, .25, 4), (.75, .25, 7), (1, 1, 9), (2, 1.6, 11)], ['bell', 'bell2'], [106, 86])
cat(67, 2.0, 0, 88); fill(67); fill(71, True)

# ---- Skala-Check + Rendern ---------------------------------------------------------------
for p, r in CHECK:
    assert (p - r) % 12 in SC, (p, r)
sf2, out = cli_paths('bgm_theme_crystals.ogg')
song.render(sf2, out)
