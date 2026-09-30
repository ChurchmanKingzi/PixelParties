# -*- coding: utf-8 -*-
"""Battle-Theme „Way of the Blade“ (Archetyp Idej) → public/music/bgm_theme_idej.ogg

Samurai-Duell in d-Hira-joshi (D E F A B♭), 110 BPM, 56 Takte (122,2 s), nahtlos loopbar.
Taiko-Toms treiben von Takt 1 an, Koto zupft die Ostinati, die Shakuhachi (Flöte) singt das
Hauptmotiv (D–F–A, fallender Schwertstreich A–F–D) mit bewussten Atempausen; nach jeder
Phrase fährt ein „Schwertschlag“ (Orchester-Hit + Snare-Crack) in die Stille.

Aufbau (Takte, 0-basiert):
   0– 7  Intro      Taiko-Puls, Bordun D, Tempelglocke, Koto-Ostinato, Schwerthieb im Bass
   8–23  Thema A    Shakuhachi-Hauptmotiv in Frage/Antwort, Koto-Gegenstimme, Pausen + Hiebe
  24–39  Duell B    Streicher-Pizzicato-Achtel, Koto-16tel-Läufe, Flöte höher, Snare-Rimshots
  40–51  Höhepunkt C  Tutti-Unisono (Flöte/Pfeife/Streicher), Taiko-Vollgas, Glocken
  52–55  Rückführung  Ruhe vor dem Schlag: Bordun, Koto-Tremolo, Taiko-Wirbel → Takt 0
Alle Melodie- und Basstöne liegen in Hira-joshi. Loop endet auf der Dominante E (offen).
Aufruf:  python3 scripts/music/theme_idej.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 110, 56                      # 56 × 4 × 60/110 = 122,2 s
song = Song(bpm=BPM, bars=BARS)
song.inst('contra', 'contra', 92, 64)
song.inst('bass',   'pizz',   100, 58)
song.inst('koto',   'koto',    98, 40)
song.inst('koto2',  'koto',    90, 88)
song.inst('flute',  'flute',   96, 70)
song.inst('whistle','whistle', 70, 56)
song.inst('strings','strings', 78, 46)
song.inst('tremolo','tremolo', 74, 82)
song.inst('pizz',   'pizz',    86, 34)
song.inst('bell',   'bell',    76, 96)
song.inst('hit',    'hit',    104, 64)
song.inst('timp',   'timp',    96, 64)
song.inst('brass',  'horns',   80, 50)

SCALE = {D, E, F, A, Bb}
NAMES = {'C': C, 'Db': Db, 'D': D, 'Eb': Eb, 'E': E, 'F': F, 'Gb': Gb, 'G': G, 'Ab': Ab, 'A': A, 'Bb': Bb, 'B': B}
def nt(s): return n(NAMES[s[:-1]], int(s[-1]))
def chk(p): assert p % 12 in SCALE, f'Ton außerhalb Hira-joshi: {p}'; return p

# Harmonie je Takt: Grundton, Arpeggio-Töne (Koto), Bass
HARM = {'D': (D, ['D4', 'A4', 'D5', 'F5']), 'Bb': (Bb, ['Bb3', 'D4', 'F4', 'Bb4']),
        'A': (A, ['A3', 'D4', 'E4', 'A4']), 'F': (F, ['F3', 'A3', 'D4', 'F4']),
        'E': (E, ['E3', 'A3', 'E4', 'A4'])}
def root(h, o): return chk(n(HARM[h][0], o))
PROG_A = ['D', 'D', 'Bb', 'A', 'D', 'D', 'F', 'E']
PROG_B = ['D', 'Bb', 'F', 'A', 'D', 'Bb', 'A', 'E']

def line(b, notes, inst, vel, shift=0, sh=0.94):
    for off, dur, p in notes:
        song.add(inst, song.bar(b) + off, dur * sh, chk(nt(p) + shift), vel)

def drone(b, h, vel=84): song.add('contra', song.bar(b), 3.98, root(h, 1), vel)
def bassfig(b, h, vel=96, busy=False):
    s = song.bar(b); r = root(h, 2)
    song.add('bass', s, 0.45, r, vel)
    song.add('bass', s + 0.75, 0.3, r, vel - 14)
    song.add('bass', s + 1.5, 0.45, r + 7 if (r + 7) % 12 in SCALE else r, vel - 6)
    song.add('bass', s + 2, 0.45, r, vel - 4)
    if busy:
        song.add('bass', s + 2.75, 0.3, r, vel - 14); song.add('bass', s + 3.5, 0.4, r + 12, vel - 8)
def koto_arp(b, h, vel=84, step=0.5, cnt=8):
    ns = [nt(x) for x in HARM[h][1]]
    pat = [0, 1, 2, 1, 3, 2, 1, 2]
    for i in range(cnt):
        song.add('koto', song.bar(b) + i * step, step * 1.6, chk(ns[pat[i % 8] % 4]), vel + (8 if i % 4 == 0 else 0))
def koto_sparse(b, h, vel=84):
    ns = [nt(x) for x in HARM[h][1]]
    for off, k in ((0, 0), (0.75, 2), (1.5, 3), (2.5, 1)): song.add('koto', song.bar(b) + off, 1.2, chk(ns[k]), vel)
def strum(b, h, beat=0, vel=90, inst='koto2'):
    for i, x in enumerate(HARM[h][1]): song.add(inst, song.bar(b) + beat + i * 0.06, 1.5, chk(nt(x) + 12), vel)
def pizz8(b, h, vel=80):
    ns = [nt(x) for x in HARM[h][1]]
    for i in range(8): song.add('pizz', song.bar(b) + i * 0.5, 0.4, chk(ns[[1, 2, 1, 3][i % 4]]), vel + (8 if i % 2 == 0 else 0))
def tremolo(b, h, vel=70):
    for x in HARM[h][1][1:]: song.add('tremolo', song.bar(b), 3.98, chk(nt(x)), vel)
def pad(b, h, vel=70):
    for x in HARM[h][1][:3]: song.add('strings', song.bar(b), 3.98, chk(nt(x)), vel)

def slash(b, beat=3.0, big=False, vel=110):
    """Schwertschlag: Hit + Snare-Crack + Crash (der Hieb ins Schweigen)."""
    s = song.bar(b) + beat
    for p in ('D3', 'A3', 'D4', 'F4'): song.add('hit', s, 0.5, nt(p), vel)
    song.dr(s, SNARE, 118); song.dr(s, CLAP, 100); song.dr(s, KICK, 118)
    if big: song.dr(s, CRASH, 112, 0.5)
    song.add('bell', s, 2.0, nt('D6'), 80)

# ---- Taiko-Grooves (16tel-Raster) -------------------------------------------------
def taiko(b, kind, v=1.0):
    s = song.bar(b)
    def d(off, note, vel): song.dr(s + off, note, min(127, vel * v))
    if kind == 'run':        # Marsch der Trommeln: don . ka don-doko
        for off, note, vel in ((0, TOM_L, 112), (0.75, TOM_L, 84), (1, TOM_M, 96), (1.5, TOM_L, 90),
                               (2, TOM_L, 108), (2.5, TOM_M, 88), (3, TOM_M, 98), (3.25, TOM_L, 84), (3.5, TOM_L, 104)):
            d(off, note, vel)
        d(2, KICK, 96); d(0, KICK, 100)
        d(1, SIDESTICK, 90); d(3, SIDESTICK, 92)
    elif kind == 'duel':
        for i in range(8): d(i * 0.5, TOM_L if i % 2 == 0 else TOM_M, 104 if i % 2 == 0 else 84)
        d(0, KICK, 108); d(1.5, KICK, 92); d(2, KICK, 104); d(3.5, KICK, 92)
        d(1, SNARE, 100); d(3, SNARE, 104); d(1, SIDESTICK, 96); d(3, SIDESTICK, 96)
        d(0.75, SIDESTICK, 80); d(2.75, SIDESTICK, 80)
    elif kind == 'full':
        for i in range(16): d(i * 0.25, [TOM_L, TOM_M, TOM_L, TOM_H][i % 4], (110, 80, 92, 78)[i % 4])
        d(0, KICK, 118); d(1, KICK, 100); d(2, KICK, 112); d(3, KICK, 100); d(3.5, KICK, 96)
        d(1, SNARE, 112); d(3, SNARE, 116); d(1, CLAP, 90); d(3, CLAP, 92)
    elif kind == 'calm':
        d(0, TOM_L, 106); d(1.5, TOM_L, 84); d(2, TOM_L, 100); d(3, TOM_M, 92); d(3.5, TOM_L, 86)
        d(1, SIDESTICK, 86); d(3, SIDESTICK, 88)
def roll(b, start, end, v0, v1, note=TOM_L):
    s = song.bar(b) + start; cnt = int((end - start) * 4)
    for i in range(cnt): song.dr(s + i * 0.25, note, v0 + (v1 - v0) * i / max(1, cnt - 1), 0.15)
def tomfill(b, v=1.0):
    s = song.bar(b)
    for i, note in enumerate([TOM_H, TOM_HH, TOM_M, TOM_L, TOM_M, TOM_L, TOM_L, KICK]):
        song.dr(s + 2.0 + i * 0.25, note, min(127, (92 + i * 4) * v), 0.2)

# ---- Melodien ----------------------------------------------------------------------
# Hauptmotiv: D–F–A steigt, A–F–D fällt (Schwertstreich); Atempausen
A1 = [[(0, 2.5, 'D5'), (3, 1, 'F5')],
      [(0, 1.5, 'E5'), (1.5, 0.5, 'D5'), (2, 2, 'A4')],
      [(0, 2, 'D5'), (2, 1, 'F5'), (3, 1, 'A5')],
      [(0, 3, 'Bb5')]]
A2 = [[(0, 1, 'A5'), (1, 1, 'F5'), (2, 2, 'E5')],
      [(0, 1.5, 'F5'), (1.5, 0.5, 'E5'), (2, 2, 'D5')],
      [(0, 1, 'A4'), (1, 1, 'D5'), (2, 1, 'F5'), (3, 1, 'E5')],
      [(0, 3, 'D5')]]
# Duell-Thema B (dichter, höher)
B1 = [[(0, 0.5, 'D5'), (0.5, 0.5, 'F5'), (1, 1, 'A5'), (2, 1, 'Bb5'), (3, 1, 'A5')],
      [(0, 0.5, 'A5'), (0.5, 0.5, 'F5'), (1, 1, 'D5'), (2, 2, 'E5')],
      [(0, 0.5, 'F5'), (0.5, 0.5, 'A5'), (1, 1, 'D6'), (2, 1, 'Bb5'), (3, 1, 'A5')],
      [(0, 1, 'F5'), (1, 1, 'E5'), (2, 1, 'D5'), (3, 1, 'A4')]]
B2 = [[(0, 1, 'D6'), (1, 0.5, 'A5'), (1.5, 0.5, 'Bb5'), (2, 1, 'A5'), (3, 1, 'F5')],
      [(0, 1, 'E5'), (1, 1, 'F5'), (2, 1, 'A5'), (3, 1, 'F5')],
      [(0, 1, 'D5'), (1, 0.5, 'F5'), (1.5, 0.5, 'A5'), (2, 1, 'Bb5'), (3, 1, 'D6')],
      [(0, 1.5, 'Bb5'), (1.5, 0.5, 'A5'), (2, 2, 'E5')]]
# Höhepunkt C: breite Hymne
C1 = [[(0, 1, 'D5'), (1, 1, 'F5'), (2, 1, 'A5'), (3, 1, 'D6')],
      [(0, 2, 'Bb5'), (2, 1, 'A5'), (3, 1, 'F5')],
      [(0, 1, 'F5'), (1, 1, 'A5'), (2, 2, 'D6')],
      [(0, 1.5, 'E6'), (1.5, 0.5, 'D6'), (2, 2, 'A5')]]
C2 = [[(0, 1, 'A5'), (1, 1, 'Bb5'), (2, 1, 'A5'), (3, 1, 'F5')],
      [(0, 1, 'D6'), (1, 1, 'A5'), (2, 2, 'F5')],
      [(0, 1, 'E5'), (1, 1, 'F5'), (2, 1, 'A5'), (3, 1, 'Bb5')],
      [(0, 1, 'A5'), (1, 1, 'F5'), (2, 1, 'D5'), (3, 1, 'E5')]]

# ==== Arrangement ==========================================================================
# ---- Intro 0–7 -----------------------------------------------------------------------
song.dr(0, CRASH, 100, 0.5)
for p in ('D2', 'A2', 'D3'): song.add('hit', 0, 1.0, nt(p), 112)
song.add('bell', 0, 3.9, nt('D5'), 84)
for b in range(8):
    h = ['D', 'D', 'D', 'D', 'Bb', 'A', 'D', 'E'][b]
    drone(b, h, 80 + b * 2)
    taiko(b, 'run', 1.0 + b * 0.01)
    if b >= 1: koto_sparse(b, h, 80 + b * 2)
    pad(b, h, 66 + b * 2)
    if b >= 2: tremolo(b, h, 64 + b * 3)
    if b >= 1: bassfig(b, h, 88 + b * 2)
line(3, [(2, 1, 'A4'), (3, 1, 'D5')], 'flute', 84)
line(5, [(0, 1, 'D5'), (1, 1, 'F5'), (2, 2, 'A5')], 'flute', 90)
line(7, [(0, 2, 'Bb5'), (2, 1, 'A5')], 'flute', 94)
slash(3, 3.0); tomfill(7); roll(7, 0.5, 2, 70, 100, SNARE); slash(7, 3.5, True)

# ---- Thema A 8–23 -----------------------------------------------------------------------
for i in range(16):
    b, k = 8 + i, i % 8
    h = PROG_A[k]; second = i >= 8
    drone(b, h, 86)
    bassfig(b, h, 98, busy=second)
    taiko(b, 'run', 1.0 + (0.06 if second else 0))
    (koto_sparse if not second else koto_arp)(b, h, 78 if not second else 80)
    if second:
        pad(b, h, 66)
        if k % 2 == 0: strum(b, h, 0, 78)
    ph = A1 if k < 4 else A2
    if i < 8: line(b, ph[k % 4], 'flute', 98)
    else:
        line(b, ph[k % 4], 'flute', 100)
        if k % 4 in (2, 3): line(b, ph[k % 4], 'whistle', 66, 12)
    if k % 4 == 3:
        slash(b, 3.0, big=(k == 7), vel=104 + 4 * second)
tomfill(15); tomfill(23); roll(22, 2, 4, 60, 100, SNARE)

# ---- Duell B 24–39 -----------------------------------------------------------------------
slash(24, 0.0, True, 112); slash(32, 0.0, True, 114)
for i in range(16):
    b, k = 24 + i, i % 8
    h = PROG_B[k]; second = i >= 8
    drone(b, h, 88)
    bassfig(b, h, 104, busy=True)
    taiko(b, 'duel', 1.0 + (0.05 if second else 0))
    pizz8(b, h, 78 + (6 if second else 0))
    koto_arp(b, h, 84, step=0.25 if second else 0.5, cnt=16 if second else 8)
    pad(b, h, 62 + (8 if second else 0))
    ph = (B1 if k < 4 else B2)[k % 4]
    line(b, ph, 'flute', 102)
    if second: line(b, ph, 'koto2', 86)
    if second: tremolo(b, h, 66)
    if k in (3, 7): slash(b, 3.5 if k == 7 else 3.0, big=(k == 7), vel=106)
tomfill(31); tomfill(35); roll(38, 0, 4, 60, 108, SNARE); tomfill(39, 1.1)

# ---- Höhepunkt C 40–51 --------------------------------------------------------------------
slash(40, 0.0, True, 118)
PROG_C = ['D', 'Bb', 'F', 'E', 'D', 'Bb', 'A', 'E', 'Bb', 'F', 'A', 'E']
for i in range(12):
    b = 40 + i; h = PROG_C[i]
    drone(b, h, 92)
    bassfig(b, h, 108, busy=True)
    taiko(b, 'full', 1.0)
    pizz8(b, h, 84)
    koto_arp(b, h, 88, step=0.25, cnt=16)
    tremolo(b, h, 76); pad(b, h, 78)
    ph = (C1 if i < 4 else C2 if i < 8 else C1)[i % 4]
    line(b, ph, 'flute', 108); line(b, ph, 'whistle', 74, 12); line(b, ph, 'strings', 92, -12)
    line(b, ph, 'brass', 86, -12)
    if i % 4 == 0 and i: song.dr(song.bar(b), CRASH, 108, 0.5)
    if i % 2 == 0: song.add('bell', song.bar(b), 2.0, nt('D6') if h != 'E' else nt('A5'), 74)
    if i in (3, 7): slash(b, 3.0, True, 112)
tomfill(43); tomfill(47); roll(50, 0, 4, 70, 112, SNARE); roll(51, 0, 3.5, 90, 127, SNARE); tomfill(51, 1.15)

# ---- Rückführung 52–55: Ruhe vor dem Schlag, Dominante E --------------------------------------
for i in range(4):
    b = 52 + i; h = ['Bb', 'A', 'E', 'E'][i]
    drone(b, h, 88 + i * 3); tremolo(b, h, 62 + i * 8); pad(b, h, 60 + i * 5)
    taiko(b, 'calm', 1.0 + i * 0.05)
    bassfig(b, h, 92 + i * 3)
    koto_sparse(b, h, 84)
line(52, [(0, 2, 'F5'), (2, 1, 'E5'), (3, 1, 'D5')], 'flute', 96)
line(53, [(0, 2, 'A4'), (2, 2, 'E5')], 'flute', 96)
line(54, [(0, 3, 'A4')], 'flute', 90)
slash(52, 3.0, False, 100)
roll(55, 0, 3.5, 60, 118, TOM_L); song.dr(song.bar(55) + 3.75, KICK, 118)

sf2, out = cli_paths('bgm_theme_idej.ogg')
song.render(sf2, out)
