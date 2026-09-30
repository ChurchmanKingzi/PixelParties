# -*- coding: utf-8 -*-
"""Battle-Theme „Mystischer Hain“ → public/music/bgm_battle8.ogg

Magisch-abenteuerlicher Kampf in d-Dorisch, 128 BPM, 64 Takte (120 s), nahtlos loopbar.
Flöte/Okarina/Blockflöte tragen das Hauptmotiv, Harfe und Kalimba/Marimba spielen
Ostinati, Koto setzt Akzente und Glissandi, warmer Pad-Teppich, federnder Bass,
Beat mit Toms und Shaker-artigen 16tel-Hi-Hats. Die dorische große Sexte (H) und die
Durakkorde auf IV (G) und III (F) geben den leicht keltischen, verspielten Ton.

Aufbau (Takte, 0-basiert):
  Intro            0–7    Harfe allein, dann Pad/Kalimba, Bass und Shaker
  A  Thema         8–23   Flöte mit Hauptmotiv (Dm–G–Dm–C–Dm–G–Em–Am), 2. Runde mit Blockflöte
  B  Steigerung   24–39   F–C–Dm–Am–F–C–G–G, Okarina, dann Flöte; Marimba, Koto, mehr Beat
  C  Höhepunkt    40–55   Haupt-Hook über Dm–C–G–Dm–F–C–G–Am, Flöte+Blockflöte+Okarina, volle Drums
  D  Rückführung  56–63   Ausdünnen auf Harfe/Pad (wie das Intro), Tom-Wirbel führt in Takt 0
Kein Schlussakkord: Takt 63 endet offen, das Intro (Dm) nimmt die Spannung auf.

Aufruf:  python3 scripts/music/battle8.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

song = Song(bpm=128, bars=64)
# Stimmen: Name, Instrument, Lautstärke, Panorama
song.inst('bass',     'bass',     100, 64)
song.inst('harp',     'harp',      92, 50)
song.inst('kalimba',  'kalimba',   80, 86)
song.inst('marimba',  'marimba',   82, 40)
song.inst('koto',     'koto',      88, 98)
song.inst('flute',    'flute',    100, 66)
song.inst('recorder', 'recorder',  78, 44)
song.inst('ocarina',  'ocarina',   90, 80)
song.inst('pad',      'warm',      68, 64)

# ---- Akkorde: Grundton-Tonklasse und Terz (3 = Moll, 4 = Dur) ------------
CHORDS = {'Dm': (D, 3), 'Em': (E, 3), 'F': (F, 4), 'G': (G, 4), 'Am': (A, 3), 'Cm': (C, 4)}
CHORDS['C'] = CHORDS.pop('Cm')   # C-Dur

# Tonleiterstufe → MIDI-Note (d-Dorisch, Stufe 0 = D4)
DOR = [0, 2, 3, 5, 7, 9, 10]
def deg(k): return 62 + 12 * (k // 7) + DOR[k % 7]

def sc(b, lo=0.55, hi=1.0):
    """Dynamik-Faktor je Takt (Abschnitt)."""
    if b < 8:  return 0.62 + 0.14 * b / 8
    if b < 24: return 0.86
    if b < 40: return 0.92 + 0.06 * (b - 24) / 16
    if b < 56: return 1.05
    return 0.85 - 0.25 * (b - 56) / 8

# ---- Progressionen (je 8 Takte) ---------------------------------------
P_INTRO = ['Dm', 'Dm', 'C', 'C', 'Dm', 'Dm', 'G', 'G']
P_A = ['Dm', 'G', 'Dm', 'C', 'Dm', 'G', 'Em', 'Am']
P_B = ['F', 'C', 'Dm', 'Am', 'F', 'C', 'G', 'G']
P_C = ['Dm', 'C', 'G', 'Dm', 'F', 'C', 'G', 'Am']
PLAN = [(0, P_INTRO), (8, P_A), (16, P_A), (24, P_B), (32, P_B), (40, P_C), (48, P_C), (56, P_INTRO)]
chord_of = {}
for start, prog in PLAN:
    for i, name in enumerate(prog): chord_of[start + i] = name

# ---- Motive (beat, Dauer, Stufe) je 2 Takte -----------------------------
# Thema A: fragende Auftaktfigur D–F–E–D, Sexte nach oben, Kadenz Em–Am
M_A = [
    [(0,1,7),(1,.5,9),(1.5,.5,8),(2,1,7),(3,1,4),(4,1.5,5),(5.5,.5,7),(6,1,8),(7,1,7)],
    [(0,1,7),(1,.5,9),(1.5,.5,8),(2,1,7),(3,1,9),(4,1.5,8),(5.5,.5,6),(6,1,4),(7,1,6)],
    [(0,1,9),(1,.5,10),(1.5,.5,9),(2,1,8),(3,1,7),(4,1,10),(5,.5,9),(5.5,.5,8),(6,1,7),(7,1,5)],
    [(0,1,8),(1,1,10),(2,1,8),(3,1,5),(4,1,6),(5,1,8),(6,1,11),(7,1,9)],
]
# Steigerung B: weiter, geht über F/C nach oben, Anlauf auf G
M_B = [
    [(0,1.5,9),(1.5,.5,8),(2,1,7),(3,1,9),(4,1.5,10),(5.5,.5,9),(6,1,8),(7,1,6)],
    [(0,1,7),(1,1,9),(2,1,11),(3,1,9),(4,1.5,8),(5.5,.5,9),(6,1,8),(7,1,6)],
    [(0,1.5,11),(1.5,.5,10),(2,1,9),(3,1,11),(4,1.5,12),(5.5,.5,10),(6,1,8),(7,1,6)],
    [(0,1,10),(1,1,9),(2,1,8),(3,1,7),(4,1,5),(5,1,7),(6,1,8),(7,1,9)],
]
# Hook C: punktiert-verspielt, Höhepunkt auf A5
M_C = [
    [(0,.5,7),(.5,.5,9),(1,1,11),(2,.5,10),(2.5,.5,9),(3,1,7),(4,.5,8),(4.5,.5,10),(5,1,8),(6,.5,7),(6.5,.5,6),(7,1,8)],
    [(0,.5,10),(.5,.5,9),(1,1,7),(2,.5,5),(2.5,.5,7),(3,1,9),(4,1,8),(5,.5,7),(5.5,.5,9),(6,1,11),(7,1,9)],
    [(0,1,11),(1,.5,10),(1.5,.5,9),(2,1,11),(3,1,9),(4,1,10),(5,.5,9),(5.5,.5,8),(6,1,10),(7,1,8)],
    [(0,1,10),(1,.5,9),(1.5,.5,8),(2,1,7),(3,1,5),(4,1,6),(5,1,8),(6,1,11),(7,1,9)],
]

def phrase(inst, motifs, b0, vel, shift=0, dur_f=0.92):
    """4 Zwei-Takt-Motive ab Takt b0."""
    for i, m in enumerate(motifs):
        for off, dur, d in m:
            beat = song.bar(b0 + 2 * i) + off
            song.add(inst, beat, dur * dur_f, deg(d + shift), vel * sc(b0 + 2 * i) + (6 if off == int(off) else 0))

# ---- Begleitbausteine --------------------------------------------------
def tri(b):
    pc, t = CHORDS[chord_of[b]]; return pc, t

def harp(b, vel=78):
    pc, t = tri(b); base = n(pc, 3)
    for i, s in enumerate([0, 7, 12, t + 12, 12, 7, t, 7]):
        song.add('harp', song.bar(b) + i * 0.5, 0.9, base + s, vel * sc(b) + (8 if i % 4 == 0 else 0))

def kalimba(b, vel=64):
    pc, t = tri(b); base = n(pc, 4)
    for off, s in [(0.5, 7), (1.5, 12), (2.5, 7), (3.25, t + 12)]:
        song.add('kalimba', song.bar(b) + off, 0.4, base + s, vel * sc(b))

def marimba(b, vel=72):
    pc, t = tri(b); base = n(pc, 4)
    for off, s in zip([0, 0.75, 1.5, 2, 2.75, 3.5], [t, 7, 12, 7, t, 7]):
        song.add('marimba', song.bar(b) + off, 0.3, base + s, vel * sc(b) + (8 if off in (0, 2) else 0))

def pad(b, vel=60):
    pc, t = tri(b); base = n(pc, 3)
    for s in (7, 12, 12 + t): song.add('pad', song.bar(b), 3.95, base + s, vel * sc(b))

def bass(b, style=1, vel=92):
    pc, t = tri(b); r = n(pc, 2); v = vel * sc(b)
    if style == 0:      # ruhig: Grundton, Quinte
        song.add('bass', song.bar(b), 1.9, r, v); song.add('bass', song.bar(b) + 2, 1.9, r + 7, v - 10)
    elif style == 1:    # federnd
        for off, dur, s, dv in [(0, .5, 0, 10), (1, .25, 0, -8), (1.5, .5, 7, 0), (2, .5, 0, 6), (3, .5, 12, 0), (3.5, .5, 7, -6)]:
            song.add('bass', song.bar(b) + off, dur, r + s, v + dv)
    else:               # treibend: Achtel mit Oktavsprung und Terz-Auftakt
        for i, st in enumerate([0, 0, 12, 0, 7, 0, 12, 7]):
            song.add('bass', song.bar(b) + i * 0.5, 0.42, r + st, v + (10 if i % 4 == 0 else 0))
        if chord_of.get(b + 1) and chord_of[b + 1] != chord_of[b]:   # Leitton-Auftakt zum nächsten Akkord
            npc, _ = CHORDS[chord_of[b + 1]]
            song.add('bass', song.bar(b) + 3.75, 0.25, n(npc, 2) - 2 if npc != pc else n(npc, 2), v)

def counter(b, vel=62):
    """Blockflöten-Gegenstimme: Terz und Quinte in Halben, Oktave 4."""
    pc, t = tri(b); base = n(pc, 4)
    song.add('recorder', song.bar(b), 1.95, base + t, vel * sc(b))
    song.add('recorder', song.bar(b) + 2, 1.95, base + 7, vel * sc(b))

def koto_gliss(b, vel=84):
    pc, t = tri(b); base = n(pc, 4)
    for i, s in enumerate([0, t, 7, 12, 12 + t, 19]):
        song.add('koto', song.bar(b) + 2 + i * 0.25, 0.8, base + s, vel * sc(b) + i * 2)

def koto_acc(b, vel=76):
    pc, t = tri(b); base = n(pc, 4)
    song.add('koto', song.bar(b) + 1.5, 0.5, base + 7, vel * sc(b))
    song.add('koto', song.bar(b) + 3.5, 0.5, base + 12 + t, vel * sc(b) - 6)

# ---- Schlagzeug --------------------------------------------------------
def shaker(b, v=52, acc=16):
    s = song.bar(b)
    for i in range(16):
        song.dr(s + i * 0.25, HAT, (v + acc if i % 4 == 2 else v + 6 if i % 2 == 0 else v - 14) * sc(b) / 0.9, 0.1)

def groove(b, lvl):
    s = song.bar(b); v = sc(b)
    if lvl == 1:
        song.dr(s, KICK, 96 * v); song.dr(s + 2.5, KICK, 84 * v)
        song.dr(s + 1, SIDESTICK, 70 * v); song.dr(s + 3, SIDESTICK, 76 * v)
    elif lvl == 2:
        for p, kv in [(0, 108), (1.75, 84), (2.5, 96)]: song.dr(s + p, KICK, kv * v)
        song.dr(s + 1, SNARE, 96 * v); song.dr(s + 3, SNARE, 104 * v)
        song.dr(s + 3.5, TOM_L, 72 * v)
    elif lvl == 3:
        for p, kv in [(0, 112), (0.75, 78), (1.75, 88), (2.5, 100)]: song.dr(s + p, KICK, kv * v)
        song.dr(s + 1, SNARE, 100 * v); song.dr(s + 3, SNARE, 108 * v)
        song.dr(s + 2.75, TOM_M, 78 * v); song.dr(s + 3.5, TOM_L, 84 * v); song.dr(s + 1.5, SIDESTICK, 52 * v)
    elif lvl == 4:
        for p, kv in [(0, 116), (1, 76), (1.75, 90), (2.5, 104), (3.25, 78)]: song.dr(s + p, KICK, kv * v)
        song.dr(s + 1, SNARE, 106 * v); song.dr(s + 3, SNARE, 112 * v); song.dr(s + 3, CLAP, 70 * v)
        song.dr(s + 0.75, TOM_H, 74 * v); song.dr(s + 2.75, TOM_M, 82 * v); song.dr(s + 3.5, TOM_L, 90 * v)
        song.dr(s + 1.5, OHAT, 64 * v, 0.3)

def fill(b, big=True, v=1.0):
    """Tom-Fill in der letzten Zählzeit (big: zwei Zählzeiten) samt Crash am nächsten Takt."""
    s = song.bar(b) + (2 if big else 3)
    seq = [TOM_HH, TOM_H, TOM_H, TOM_M, TOM_M, TOM_L, TOM_L, KICK] if big else [TOM_H, TOM_M, TOM_L, TOM_L]
    step = 0.25
    for i, t in enumerate(seq):
        song.dr(s + i * step, t, (80 + 5 * i) * v)
    if big: song.dr(s + 2 - 0.25, SNARE, 110 * v); song.dr(song.bar(b + 1), CRASH, 108 * v, 1.0)

def roll(b, v0=45, v1=120):
    s = song.bar(b)
    for i in range(16): song.dr(s + i * 0.25, SNARE if i % 2 else TOM_M, v0 + (v1 - v0) * i / 15, 0.15)

# ---- Arrangement ------------------------------------------------------
for b in range(64):
    # ---------- Intro 0–7 ----------
    if b < 8:
        harp(b, 74)
        if b >= 2: pad(b, 52); kalimba(b, 56)
        if b >= 4: bass(b, 0, 88); shaker(b, 40)
        if b >= 6: groove(b, 1)
        if b == 7: fill(b, False, 0.9)
    # ---------- A 8–23 ----------
    elif b < 24:
        harp(b, 76); pad(b, 58); kalimba(b, 62); bass(b, 1, 92); shaker(b, 50); groove(b, 2)
        if b >= 16: counter(b, 64)
        if b % 8 == 3 or b >= 20 and b % 4 == 3: koto_gliss(b, 74)
        if b in (15, 23): fill(b, b == 23)
    # ---------- B 24–39 ----------
    elif b < 40:
        harp(b, 78); pad(b, 62); kalimba(b, 60); bass(b, 1 if b < 32 else 2, 96); shaker(b, 54)
        groove(b, 3); koto_acc(b, 76)
        if b >= 28: marimba(b, 66)
        if b >= 32: counter(b, 66)
        if b % 8 == 3: koto_gliss(b, 80)
        if b in (31, 39): fill(b, True)
    # ---------- C 40–55 ----------
    elif b < 56:
        harp(b, 78); pad(b, 66); kalimba(b, 60); marimba(b, 72); bass(b, 2, 100); shaker(b, 58)
        groove(b, 4); koto_acc(b, 80)
        if b % 4 == 3: koto_gliss(b, 88)
        if b in (47, 55): fill(b, True)
    # ---------- Rückführung 56–63 ----------
    else:
        harp(b, 74); pad(b, 54); bass(b, 0, 88)
        if b < 60: kalimba(b, 58)
        if b < 60: groove(b, 1)
        if b < 62: shaker(b, 44)
        if b == 59: fill(b, False, 0.9)

# Melodien
phrase('flute', M_A, 8, 86)
phrase('flute', M_A, 16, 90)
phrase('ocarina', M_B, 24, 82)                # Okarina eröffnet die Steigerung …
phrase('flute', M_B, 32, 92)                  # … Flöte übernimmt in der 2. Runde
phrase('flute', M_C, 40, 98)
phrase('recorder', M_C, 40, 72, shift=-7)     # Oktave tiefer, links
phrase('flute', M_C, 48, 104)
phrase('recorder', M_C, 48, 74, shift=-7)
phrase('ocarina', M_C, 48, 66)
# Rückführung: Erinnerung an das Motiv, verklingend
for off, dur, d in M_A[0][:5]:
    song.add('flute', song.bar(56) + off, dur * 0.92, deg(d), 64)
for off, dur, d in M_A[0][:5]:
    song.add('ocarina', song.bar(58) + off, dur * 0.92, deg(d), 48)

# Abschnittsgrenzen: Crash + Wirbel in den Loop
for b in (8, 24, 40): song.dr(song.bar(b), CRASH, 104, 1.0)
roll(62, 40, 96)
for i, t in enumerate([TOM_HH, TOM_H, TOM_M, TOM_L, TOM_L, TOM_L, KICK, KICK]):
    song.dr(song.bar(63) + 2 + i * 0.25, t, 70 + 5 * i)
song.dr(song.bar(63) + 3.75, KICK, 100)

sf2, out = cli_paths('bgm_battle8.ogg'); song.render(sf2, out)
