# -*- coding: utf-8 -*-
"""Theme „Boiler Room Brawl“ (Steam Dwarfs) → public/music/bgm_theme_steamdwarfs.ogg

Steampunk-Zwergenwerkstatt in e-Dorisch, 126 BPM, 64 Takte (121,9 s), nahtlos loopbar.
Schwingender Shuffle (Achtel als Triolen 2:1) wie ein stampfender Kolben; darunter das
Uhrwerk: Marimba-Triolen als Zahnräder. Tuba-Oompah, Akkordeon-Chops, Posaune, Blech,
Dudelsack-Bordun, Dampfpfeife (whistle), Amboss (Röhrenglocke + Cowbell) und Hammerschläge.
Die Melodie ist keltisch-zwergisch (Quinte, Terz-Sprünge, dorische Sexte cis).

Aufbau (Takte, 0-basiert):
   0– 7  Intro          Kolben-Anlauf: Woodblock/Snare-Shuffle, Tuba, Marimba-Zahnräder, Dampfpfeife
   8–23  Thema A        Akkordeon-Thema (8 Takte), zweiter Durchgang mit Harmonika + Posaune
  24–39  Werkstatt B    Blech-Melodie über G–D–Em–A, Amboss-Schläge, Posaunen-Gegenstimme
  40–55  Höhepunkt C    Hymne: Blech + Akkordeon + Dudelsack + Orgel, Boiler-Pauken, Dampfpfeifen
  56–63  Überdruck D    Kolben beschleunigen (Triolen → 16tel), Dampfpfeife schrillt, Blech-Stabs
                        → Sprung auf Takt 0
Der Loop endet auf der Dominante (A) – keine Schlusskadenz.
Aufruf:  python3 scripts/music/theme_steamdwarfs.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 126, 64                       # 64 × 4 × 60/126 = 121,9 s
song = Song(bpm=BPM, bars=BARS)

song.inst('tuba',    'tuba',      98, 62)
song.inst('timp',    'timp',      94, 64)
song.inst('acc',     'accordion', 92, 50)   # Melodie
song.inst('chop',    'accordion', 78, 76)   # Akkord-Chops auf 2 und 4
song.inst('harm',    'harmonica', 82, 84)
song.inst('marimba', 'marimba',   84, 34)   # Zahnräder
song.inst('tbn',     'trombone',  86, 40)
song.inst('brass',   'brass',     84, 58)
song.inst('tpt',     'trumpet',   84, 72)
song.inst('whistle', 'whistle',   84, 92)
song.inst('pipes',   'bagpipe',   78, 30)
song.inst('organ',   'pipeorgan', 74, 64)
song.inst('bell',    'bell',      80, 88)   # Amboss

NAMES = {'C': C, 'Db': Db, 'D': D, 'Eb': Eb, 'E': E, 'F': F, 'Gb': Gb, 'G': G, 'Ab': Ab, 'A': A, 'Bb': Bb, 'B': B, 'C#': Db, 'F#': Gb}
def nt(s): return n(NAMES[s[:-1]], int(s[-1]))
SCALE = {E, Gb, G, A, B, Db, D}                     # e-Dorisch
def chk(p):
    assert p % 12 in SCALE, f'Ton nicht in e-Dorisch: {p}'
    return p
def ramp(i, cnt, a, b): return a + (b - a) * i / max(1, cnt - 1)

def S(x):
    """Shuffle: Achtel-Nachschlag (…,5) rückt auf die Triole (2/3)."""
    f = x - int(x)
    return int(x) + 2 / 3 if abs(f - .5) < 1e-6 else x
def put(inst, beat, dur, p, vel): song.add(inst, S(beat), dur, chk(p), vel)
def mel(inst, bar, notes, vel=90, shift=0):
    for off, dur, p in notes: put(inst, song.bar(bar) + off, dur * 0.93, nt(p) + shift, vel)
def dr(beat, note, vel, dur=.2): song.dr(S(beat), note, min(127, vel), dur)

# ---- Akkorde --------------------------------------------------------------------------
CH = {'Em': (E, (0, 3, 7)), 'D': (D, (0, 4, 7)), 'A': (A, (0, 4, 7)), 'G': (G, (0, 4, 7)), 'C': (C, (0, 4, 7)), 'Bm': (B, (0, 3, 7))}
INTRO = ['Em'] * 4 + ['Em', 'Em', 'D', 'A']
AP = ['Em', 'Em', 'D', 'D', 'Em', 'A', 'D', 'Em']
BP1 = ['G', 'D', 'Em', 'A', 'G', 'D', 'A', 'A']
BP2 = ['G', 'D', 'Em', 'A', 'G', 'A', 'Bm', 'Bm']
CP1 = ['Em', 'C', 'D', 'Em', 'Em', 'C', 'D', 'A']
CP2 = ['Em', 'C', 'D', 'Em', 'G', 'D', 'A', 'A']
DP = ['Em', 'Em', 'Em', 'Em', 'D', 'D', 'A', 'A']
PROG = INTRO + AP + AP + BP1 + BP2 + CP1 + CP2 + DP
assert len(PROG) == BARS
for c in PROG:
    for iv in CH[c][1]: assert (CH[c][0] + iv) % 12 in SCALE, c
def root(b, octv=2):
    pc = CH[PROG[b]][0]; return n(pc, octv)
def tones(b, octv):
    pc, ivs = CH[PROG[b]]; return [n(pc, octv) + iv for iv in ivs]

# ---- Bausteine --------------------------------------------------------------------------
def oompah(b, vel=98, walk=False):
    """Tuba: Grundton auf 1, Quinte auf 3 (Oompah); walk: Durchgangsnote vor dem nächsten Takt."""
    s = song.bar(b); r = root(b, 2)
    if r > n(G, 2): r -= 12
    put('tuba', s, .9, r, vel); put('tuba', s + 2, .9, r + 7, vel - 8)
    put('tuba', s + 1, .4, r + 12 if False else r, vel - 22) if False else None
    if walk: put('tuba', s + 3.5, .4, r + 7, vel - 12)

def chops(b, vel=80):
    s = song.bar(b); t = tones(b, 3)
    for off in (1, 3):
        for p in t: put('chop', s + off, .45, p + (12 if p < n(E, 3) else 0), vel + (6 if off == 3 else 0))

def gears(b, vel=76, dense=1.0):
    """Zahnräder: Marimba-Triolenarpeggio (3 pro Schlag) auf Akkordtönen."""
    s = song.bar(b); t = tones(b, 4); cyc = [t[0], t[2], t[1], t[2], t[0] + 12, t[2]]
    for i in range(12): song.add('marimba', s + i / 3, .28, chk(cyc[i % 6]), (vel + (10 if i % 3 == 0 else 0)) * dense)

def boiler(b, vel=96, kind='q'):
    s = song.bar(b); p = root(b, 2)
    if p > n(G, 2): p -= 12
    if kind == 'q':
        put('timp', s, .6, p, vel); put('timp', s + 2, .6, p, vel - 8)
    else:
        for off, v in ((0, 0), (1.5, -12), (2, -4), (3.5, -12)): put('timp', s + off, .4, p, vel + v)

def kit(b, kind, v=1.0):
    s = song.bar(b)
    def d(off, note, vel, dur=.2): dr(s + off, note, vel * v, dur)
    if kind == 'intro':      # Kolben: Snare-Shuffle, Woodblock als Ventil-Ticks
        d(0, KICK, 108); d(2, KICK, 100); d(1, SNARE, 100); d(3, SNARE, 104)
        for off in (.5, 1.5, 2.5, 3.5): d(off, SNARE, 58, .1)
        for off in (0, 1, 2, 3): d(off, 76, 100)
        for off in (.5, 1.5, 2.5, 3.5): d(off, 77, 90)
    elif kind == 'A':
        d(0, KICK, 112); d(2, KICK, 104); d(2.5, KICK, 84); d(1, SNARE, 108); d(3, SNARE, 110)
        for off in (.5, 1.5, 2.5, 3.5): d(off, SNARE, 60, .1)
        for off in (0, 1, 2, 3): d(off, 76, 96)
        for off in (.5, 1.5, 2.5, 3.5): d(off, 77, 88)
    elif kind == 'B':        # Werkstatt: Hammer (Cowbell) auf 2 und 4, Kick auf 1, 2+, 3
        d(0, KICK, 114); d(1.5, KICK, 92); d(2, KICK, 106); d(1, SNARE, 110); d(3, SNARE, 112)
        d(1, COWBELL, 100); d(3, COWBELL, 104); d(3.5, TOM_L, 96)
        for off in (.5, 1.5, 2.5, 3.5): d(off, SNARE, 62, .1)
        for off in (0, 2): d(off, 76, 92)
    elif kind == 'C':        # Höhepunkt: Volle Kolben, Clap + Snare, Toms
        d(0, KICK, 120); d(1.5, KICK, 96); d(2, KICK, 112); d(3.5, KICK, 100)
        d(1, SNARE, 116); d(3, SNARE, 118); d(1, CLAP, 92); d(3, CLAP, 96)
        d(0, COWBELL, 92); d(2, COWBELL, 92); d(2.5, TOM_M, 92); d(3.5, TOM_L, 96)
        for off in (.5, 1.5, 2.5, 3.5): d(off, SNARE, 68, .1)
    elif kind == 'D':        # Überdruck: 16tel-artiges Tremolo auf Snare, Kick treibt
        for i in range(4): d(i, KICK, 108 if i % 2 == 0 else 96)
        for i in range(8): d(i * .5, SNARE, 80 + 3 * i, .1)
        for off in (0, 1, 2, 3): d(off, 76, 100)

def crash(b, vel=104): song.dr(song.bar(b), CRASH, vel, 1.0)
TOMS = [TOM_H, TOM_HH, TOM_M, TOM_L]
def fill(b, v0=84, v1=120):
    s = song.bar(b)
    for i in range(6): song.dr(s + 2 + i / 3, TOMS[min(3, i // 2)], ramp(i, 6, v0, v1), .2)   # Triolen
    song.dr(s + 3.75, KICK, 120)
def snare_roll(b, v0, v1, start=0, end=4):
    s = song.bar(b) + start; cnt = int((end - start) * 3)
    for i in range(cnt): song.dr(s + i / 3, SNARE, ramp(i, cnt, v0, v1), .12)

def stab(b, beat, vel=104, dur=.7, inst=('brass', 'tpt')):
    t = tones(b, 4)
    for nm in inst:
        for p in t: put(nm, song.bar(b) + beat, dur, p + (12 if nm == 'tpt' else 0), vel)

def anvil(b, beat=3, vel=86):
    p = n(E, 4) if PROG[b] in ('Em', 'C', 'G') else n(D, 4) if PROG[b] == 'D' else n(A, 4)
    put('bell', song.bar(b) + beat, 1.0, p if p % 12 in SCALE else n(E, 4), vel)

def pedal_pipes(b, vel=70, octv=3):
    pc = CH[PROG[b]][0]
    for p in (n(pc, octv), n(pc, octv) + 7): song.add('pipes', song.bar(b), 3.95, chk(p), vel)

def organ(b, vel=72):
    for p in tones(b, 4): song.add('organ', song.bar(b), 3.95, chk(p), vel)

# ---- Melodien ----------------------------------------------------------------------------
T = [[(0, 1, 'E5'), (1, .5, 'B4'), (1.5, .5, 'E5'), (2, 1, 'G5'), (3, .5, 'F#5'), (3.5, .5, 'E5')],
     [(0, 1.5, 'D5'), (1.5, .5, 'B4'), (2, 2, 'B4')],
     [(0, 1, 'F#5'), (1, .5, 'A5'), (1.5, .5, 'F#5'), (2, 1, 'D5'), (3, .5, 'E5'), (3.5, .5, 'F#5')],
     [(0, 1.5, 'A4'), (1.5, .5, 'D5'), (2, 2, 'F#5')],
     [(0, 1, 'E5'), (1, .5, 'B4'), (1.5, .5, 'E5'), (2, 1, 'G5'), (3, 1, 'B5')],
     [(0, 1, 'E5'), (1, .5, 'C#5'), (1.5, .5, 'A4'), (2, 1, 'C#5'), (3, 1, 'E5')],
     [(0, 1, 'F#5'), (1, 1, 'D5'), (2, 1, 'A4'), (3, 1, 'D5')],
     [(0, 2, 'E5'), (2, 1, 'B4'), (3, .5, 'G4'), (3.5, .5, 'B4')]]
BM1 = [[(0, 1, 'B4'), (1, 1, 'D5'), (2, 1.5, 'G5'), (3.5, .5, 'F#5')],
       [(0, 1, 'A5'), (1, .5, 'F#5'), (1.5, .5, 'D5'), (2, 2, 'A4')],
       [(0, 1, 'G5'), (1, .5, 'F#5'), (1.5, .5, 'E5'), (2, 1, 'B4'), (3, 1, 'E5')],
       [(0, 1, 'C#5'), (1, 1, 'E5'), (2, 1, 'A5'), (3, 1, 'G5')],
       [(0, 1, 'D5'), (1, 1, 'G5'), (2, 1.5, 'B5'), (3.5, .5, 'A5')],
       [(0, 1, 'A5'), (1, 1, 'F#5'), (2, 2, 'D5')],
       [(0, .5, 'E5'), (.5, .5, 'F#5'), (1, .5, 'G5'), (1.5, .5, 'A5'), (2, 2, 'A5')],
       [(0, 2, 'C#5'), (2, 2, 'E5')]]
BM2 = BM1[:5] + [[(0, 1, 'E5'), (1, 1, 'A5'), (2, 2, 'C#6')],
                 [(0, 1, 'D5'), (1, 1, 'F#5'), (2, 1, 'B5'), (3, 1, 'A5')],
                 [(0, 2, 'F#5'), (2, 1, 'D5'), (3, 1, 'F#5')]]
BM2[5:8] = [BM2[5], BM2[6], BM2[7]]
BM2 = [BM1[0], BM1[1], BM1[2], BM1[3], BM1[4], [(0, 1, 'E5'), (1, 1, 'A5'), (2, 2, 'C#6')],
       [(0, 1, 'D5'), (1, 1, 'F#5'), (2, 1, 'B5'), (3, 1, 'A5')], [(0, 2, 'F#5'), (2, 1, 'D5'), (3, 1, 'F#5')]]
HYA = [[(0, 1.5, 'E5'), (1.5, .5, 'G5'), (2, 2, 'B5')],
       [(0, 1, 'G5'), (1, 1, 'E5'), (2, 2, 'G5')],
       [(0, 1, 'F#5'), (1, 1, 'A5'), (2, 2, 'D6')],
       [(0, 1, 'B5'), (1, .5, 'A5'), (1.5, .5, 'G5'), (2, 1, 'F#5'), (3, 1, 'E5')],
       [(0, 1.5, 'E5'), (1.5, .5, 'G5'), (2, 1, 'B5'), (3, 1, 'E6')],
       [(0, 2, 'E5'), (2, 1, 'G5'), (3, 1, 'B5')],
       [(0, 1.5, 'A5'), (1.5, .5, 'F#5'), (2, 2, 'D5')],
       [(0, 1, 'E5'), (1, 1, 'A5'), (2, 2, 'C#6')]]
HYB = HYA[:4] + [[(0, 1, 'D5'), (1, 1, 'G5'), (2, 1, 'B5'), (3, 1, 'D6')],
                 [(0, 2, 'A5'), (2, 2, 'F#5')],
                 [(0, 1, 'E5'), (1, .5, 'F#5'), (1.5, .5, 'G5'), (2, 1, 'A5'), (3, 1, 'C#6')],
                 [(0, 4, 'B5')]]
# Gegenstimme Posaune (tief, Terzen/Quinten unter der Melodie) — Hauptnoten
def tbn_line(b, vel=84):
    t = tones(b, 3); s = song.bar(b)
    for off, p in ((0, t[0]), (1.5, t[2]), (2, t[1] if False else t[0]), (3.5, t[2])): put('tbn', s + off, .9 if off != 1.5 else .4, p + 12 if p < n(E, 3) else p, vel)

# ============================ KOMPOSITION ============================================
# ---- Intro 0–7 ----
for b in range(8):
    kit(b, 'intro', .95 if b < 2 else 1.0); oompah(b, 92, walk=(b == 7)); boiler(b, 90, 'q'); gears(b, 74)
    if b >= 2: chops(b, 72)
    if b >= 4: organ(b, 60)
crash(0, 108)
put('whistle', 1, 1.8, nt('B5'), 84)                        # erster Dampfstoß
for j, ph in enumerate(T[:4]): mel('harm', 4 + j, ph, 80)   # Harmonika-Vorspiel des Themas
put('bell', 6, 1, nt('E4'), 80)
fill(3, 84, 110); fill(7, 92, 122)

# ---- Thema A 8–23 ----
for k, base in enumerate((8, 16)):
    for i in range(8):
        b = base + i
        kit(b, 'A'); oompah(b, 98, walk=(i % 4 == 3)); boiler(b, 96, 'q' if k == 0 else 'g'); chops(b, 82); gears(b, 70 if k == 0 else 78)
        if k == 1: tbn_line(b, 78)
    crash(base, 108)
    for j in range(8):
        mel('acc', base + j, T[j], 96)
        if k == 1: mel('harm', base + j, T[j], 80, 12 if False else 0); mel('tpt', base + j, T[j], 70, -12 if False else 0)
    if k == 1:
        put('whistle', song.bar(base + 3) + 3, .9, nt('B5'), 86)
        for b in (base, base + 4): organ(b, 62)
    anvil(base + 3, 3, 84); anvil(base + 7, 3, 88)
    fill(base + 3, 84, 112); fill(base + 7, 96, 124)

# ---- Werkstatt B 24–39 ----
for k, (base, mm) in enumerate(((24, BM1), (32, BM2))):
    for i in range(8):
        b = base + i
        kit(b, 'B'); oompah(b, 100, walk=(i % 2 == 1)); boiler(b, 98, 'g'); chops(b, 84); gears(b, 66)
        tbn_line(b, 84 if k == 0 else 90)
        anvil(b, 3, 82 if i % 2 == 0 else 76)
        if k == 1: organ(b, 60)
    crash(base, 108)
    for j in range(8):
        mel('tpt', base + j, mm[j], 92); mel('brass', base + j, mm[j], 84, -12)
        if k == 1: mel('acc', base + j, mm[j], 84)
    if k == 1: put('whistle', song.bar(base + 7), 3.8, nt('B5'), 82)
    fill(base + 3, 84, 110); fill(base + 7, 94, 125)

# ---- Höhepunkt C 40–55 ----
for k, (base, hy) in enumerate(((40, HYA), (48, HYB))):
    for i in range(8):
        b = base + i
        kit(b, 'C'); oompah(b, 104, walk=(i % 2 == 1)); boiler(b, 102, 'g'); chops(b, 88); gears(b, 66, .9)
        tbn_line(b, 90); organ(b, 78); pedal_pipes(b, 68)
        if i % 2 == 0: crash(b, 112 if i == 0 else 98)
        anvil(b, 3, 88)
    for j in range(8):
        mel('tpt', base + j, hy[j], 100); mel('brass', base + j, hy[j], 90, -12)
        mel('acc', base + j, hy[j], 92); mel('pipes', base + j, hy[j], 76, -12)
    for b in (base, base + 4): stab(b, 0, 108, 1.3)
    for b in (base + 2, base + 6): stab(b, 2, 100, .7)
    put('whistle', song.bar(base + 3) + 3, .9, nt('B5'), 90)
    put('whistle', song.bar(base + 7) + 2, 1.9, nt('E6') if False else nt('B5'), 88)
    fill(base + 3, 88, 118); fill(base + 7, 100, 127)

# ---- Überdruck D 56–63 ----
for i in range(8):
    b = 56 + i
    kit(b, 'D' if i >= 4 else 'A', 1.0); oompah(b, 100, walk=True); boiler(b, 100, 'g'); chops(b, 84 if i < 4 else 92)
    gears(b, 76 + 3 * i)
    if i >= 4: tbn_line(b, 88); organ(b, 66 + 2 * i)
    anvil(b, 3, 90)
crash(56, 110)
for j in range(4): mel('acc', 56 + j, T[j], 92); mel('harm', 56 + j, T[j], 78)
put('whistle', 58, 3.6, nt('B5'), 84)
for j, b in enumerate((60, 61, 62)):
    stab(b, 0, 96 + 5 * j, .6); stab(b, 1.5, 92 + 5 * j, .4); stab(b, 3, 96 + 5 * j, .6)
put('whistle', song.bar(60) + 2, 5.9, nt('B5'), 90)
fill(59, 90, 116); snare_roll(62, 84, 108, 2, 4); snare_roll(63, 100, 127, 0, 3.75); song.dr(song.bar(63) + 3.75, KICK, 124)

sf2, out = cli_paths('bgm_theme_steamdwarfs.ogg')
song.render(sf2, out)
