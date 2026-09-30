# -*- coding: utf-8 -*-
"""Battle-Theme „Dunkle Kathedrale“ → public/music/bgm_battle5.ogg

Gotisch-barocker Bosskampf in e-Moll (harmonisch: Leitton dis), 118 BPM, 64 Takte
(≈ 130,2 s), nahtlos loopbar. Pfeifenorgel und Cembalo mit fugenartigen Einsätzen,
Chor, Kontrabass, düstere Streicher, Kirchenglocken und Pauken.

Hauptmotiv („Subjekt“, 2 Takte über e-Moll | C-Dur): punktierter Aufstieg h – e – g,
fis als Wechselnote, danach absteigend e – d – c – h. Das Gegensubjekt (g – fis – e,
e – d – c) läuft in Gegenbewegung darunter. Die Fortsetzung über a-Moll | H7 führt
über den Leitton dis wieder zur Tonika – so schließt auch der Loop (H7 → e-Moll).

Aufbau (Takte, 0-basiert):
  A   0– 7  Intro: Fugenexposition – Orgel, Cembalo, Chor setzen nacheinander mit dem
            Subjekt ein, Glocken und Pauke.
  B   8–23  Thema: Orgel-Melodie (e C a H7 | e C a H7 | G D C H7 | e C a H7),
            Cembalo-Figuration, Streicher; ab Takt 12 Gegenstimme (Violine), ab 20 Chor.
  C  24–39  Steigerung: Quintfall-Sequenz e a D G | C fis° H7 H7; erst Cembalo, dann
            Orgel mit Violin-Gegenstimme, Tremolo-Streicher, Chor, treibender Bass.
  D  40–55  Höhepunkt: volle Besetzung, Orgel + Chor-Oohs, Pedal, Glocken, Pauken-Galopp.
  E  56–63  Rückführung: Fugen-Echo, Ausdünnen, Wirbel auf der Dominante H7 → Takt 0.

Aufruf:  python3 scripts/music/battle5.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 118, 64
song = Song(bpm=BPM, bars=BARS)

# ---- Stimmen (Name, Instrument, Lautstärke, Panorama) -------------------------
song.inst('organ',   'pipeorgan',   92, 64)   # Melodie / Fugenstimme
song.inst('orgch',   'pipeorgan',   64, 60)   # Orgel-Akkorde (Höhepunkt)
song.inst('orgped',  'pipeorgan',   78, 64)   # Pedal (Oktave 1–2)
song.inst('harp',    'harpsichord', 96, 38)   # Cembalo: Subjekt, Figuration
song.inst('choir',   'choir',       76, 74)   # Chor-Akkorde
song.inst('oohs',    'oohs',        70, 54)   # Chor-Oohs (Oktavdopplung)
song.inst('contra',  'contra',     100, 62)   # Kontrabass
song.inst('slowstr', 'slowstr',     78, 46)   # düstere Streicher (Pad)
song.inst('tremolo', 'tremolo',     70, 86)   # Tremolo-Streicher (Spannung)
song.inst('violin',  'violin',      84, 94)   # Gegenstimme
song.inst('bell',    'bell',        76, 100)  # Kirchenglocken
song.inst('timp',    'timp',       104, 64)   # Pauken
song.inst('hit',     'hit',         84, 64)   # Orchesterschlag

# ---- Hilfen ---------------------------------------------------------------------
_PC = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def N(s):
    """Notenname → MIDI ('F#5', 'D#5', 'B4')."""
    m = re.fullmatch(r'([A-G])([#b]?)(-?\d)', s)
    return n(_PC[m.group(1)] + {'#': 1, 'b': -1, '': 0}[m.group(2)], int(m.group(3)))

Fs, Ds = Gb, Eb
PCS = {'Em': [E, G, B], 'C': [C, E, G], 'Am': [A, C, E], 'B7': [B, Ds, Fs, A],
       'G': [G, B, D], 'D': [D, Fs, A], 'F#dim': [Fs, A, C, Ds]}
def vo(ch, lo):       # Akkordtöne als engste Lage ab MIDI-Note `lo`
    return sorted(next(m for m in range(lo, lo + 12) if m % 12 == pc) for pc in PCS[ch])
def root(ch, lo): return next(m for m in range(lo, lo + 12) if m % 12 == PCS[ch][0])

# Dynamikkurve über die Takte (Faktor auf alle Velocities)
_DYN = [(0, .62), (8, .78), (16, .86), (24, .92), (32, 1.0), (40, 1.08), (56, 1.0),
        (60, .80), (63, .90), (64, .70)]
def dyn(bar): return float(np.interp(bar, [p[0] for p in _DYN], [p[1] for p in _DYN]))
def ad(name, beat, dur, pitch, vel): song.add(name, beat, dur, pitch, vel * dyn(beat / 4))

def line(name, b0, bars, vel, shift=0, art=0.95):
    """Melodiezeilen: bars = Liste von Takten mit (Offset, Dauer, Notenname)."""
    for i, bar in enumerate(bars):
        for off, dur, nm in bar:
            ad(name, (b0 + i) * 4 + off, dur * art, N(nm) + shift, vel + (7 if off == 0 else 0))

def pad(name, b, ch, lo, vel, beats=4.0):
    for m in vo(ch, lo): ad(name, b * 4, beats * 0.98, m, vel)

def arp(name, b, ch, lo, vel, sixteenth=False):
    """Barocke Akkordbrechung (Cembalo)."""
    v = vo(ch, lo); ext = v + [x + 12 for x in v]
    if sixteenth: pat, step = [0, 1, 2, 3, 4, 3, 2, 1] * 2, 0.25
    else: pat, step = [0, 1, 2, 3, 2, 1, 2, 1], 0.5
    for i, k in enumerate(pat):
        ad(name, b * 4 + i * step, step * 0.9, ext[k % len(ext)], vel + (8 if i % 4 == 0 else 0))

def cm(name, b, ch, hi, vel):
    """Gegenstimme: Achtel-Wellenlinie aus Akkordtönen unterhalb `hi`."""
    tones = sorted(m for m in range(hi - 24, hi + 1) if m % 12 in [p % 12 for p in PCS[ch]])
    s = len(tones) - 1
    for i, off in enumerate([0, -1, -2, -1, 0, -1, -2, -3]):
        ad(name, b * 4 + i * 0.5, 0.48, tones[max(0, s + off)], vel + (6 if i % 4 == 0 else 0))

def bass(b, ch, kind, vel=100):
    r = root(ch, 31); s = b * 4
    if kind == 'whole': pats = [(0, 3.9, r)]
    elif kind == 'quarter': pats = [(0, .9, r), (1, .9, r), (2, .9, r + 7), (3, .9, r)]
    else: pats = [(0, .5, r), (.5, .5, r), (1, .5, r + 12), (1.5, .5, r), (2, .5, r), (2.5, .5, r),
                  (3, .5, r + 7), (3.5, .5, r + 12)]
    for off, dur, p in pats: ad('contra', s + off, dur, p, vel + (8 if off in (0, 2) else 0))

def pedal(b, ch, vel=84, beats=4.0): ad('orgped', b * 4, beats * 0.98, root(ch, 28), vel)

def timp(b, ch, kind='pulse', vel=104):
    r = root(ch, 36); s = b * 4
    if kind == 'pulse':
        for p in (0, 2): ad('timp', s + p, 0.4, r, vel)
    elif kind == 'gallop':
        for p in (0, 0.75, 1, 2, 2.75, 3): ad('timp', s + p, 0.3, r if p in (0, 2, 2.75) else r + 7, vel - (0 if p in (0, 2) else 12))
    elif kind == 'roll':
        for i in range(16): ad('timp', s + i * 0.25, 0.25, r, 58 + i * 4)

def bell(b, ch, vel=82, octave=False):
    r = root(ch, 64); ad('bell', b * 4, 3.8, r, vel)
    if octave: ad('bell', b * 4, 3.0, r + 12, vel - 12)

def hit(b, ch, vel=100, beat=0):
    for m in vo(ch, 40): ad('hit', b * 4 + beat, 1.2, m, vel)

# ---- Schlagzeug ------------------------------------------------------------------
def dk(b, kind, fill=False):
    s = b * 4; hats8 = lambda note, a, c: [(i * .5, note, a if i % 2 == 0 else c) for i in range(8)]
    if kind == 'lite':
        ev = [(0, KICK, 92), (2, KICK, 80), (1, SIDESTICK, 66), (3, SIDESTICK, 70)] + hats8(HAT, 56, 44)
    elif kind == 'drive':
        ev = [(0, KICK, 108), (1.5, KICK, 84), (2, KICK, 100), (1, SNARE, 104), (3, SNARE, 108),
              (3.5, OHAT, 60)] + hats8(HAT, 72, 58)
    else:  # full
        ev = [(0, KICK, 116), (1.5, KICK, 88), (2, KICK, 108), (3.5, KICK, 92), (1, SNARE, 112), (3, SNARE, 116),
              (1, CLAP, 76), (3, CLAP, 82), (3.75, TOM_L, 84)] + hats8(RIDE, 78, 62)
    if fill: ev = [e for e in ev if e[0] < 2]
    for off, note, v in ev: song.dr(s + off, note, min(127, v * (0.55 + 0.45 * dyn(b))))
    if fill:
        for i, t in enumerate([TOM_H, TOM_H, TOM_M, TOM_M, TOM_L, TOM_L, SNARE, SNARE]):
            song.dr(s + 2 + i * .25, t, min(127, 80 + i * 6))

def snare_roll(b, v0, v1, start=0):
    steps = int((4 - start) * 4)
    for i in range(steps): song.dr(b * 4 + start + i * .25, SNARE, v0 + (v1 - v0) * i / max(1, steps - 1), 0.15)

# ---- Motive -----------------------------------------------------------------------
# Subjekt (e | C), Gegensubjekt und Fortsetzung (a | H7)
S1 = [[(0, 1.5, 'B4'), (1.5, .5, 'E5'), (2, 1, 'G5'), (3, 1, 'F#5')],
      [(0, 1.5, 'E5'), (1.5, .5, 'D5'), (2, 1, 'C5'), (3, 1, 'B4')]]
CS = [[(0, 2, 'G4'), (2, 1, 'F#4'), (3, 1, 'E4')],
      [(0, 2, 'E4'), (2, 1, 'D4'), (3, 1, 'C4')]]
S2 = [[(0, 1.5, 'C5'), (1.5, .5, 'B4'), (2, 1, 'A4'), (3, 1, 'E5')],
      [(0, 1, 'F#5'), (1, 1, 'D#5'), (2, 1, 'A4'), (3, 1, 'D#5')]]
P1 = S1 + S2
P2 = [[(0, 1.5, 'E5'), (1.5, .5, 'G5'), (2, 1, 'B5'), (3, 1, 'A5')],
      [(0, 1.5, 'G5'), (1.5, .5, 'E5'), (2, 1, 'D5'), (3, 1, 'B4')],
      [(0, 1, 'A4'), (1, 1, 'C5'), (2, 1, 'E5'), (3, 1, 'A5')],
      [(0, 1.5, 'F#5'), (1.5, .5, 'D#5'), (2, 1, 'A4'), (3, 1, 'D#5')]]
P3 = [[(0, 1, 'B4'), (1, 1, 'D5'), (2, 1.5, 'G5'), (3.5, .5, 'F#5')],
      [(0, 1, 'A4'), (1, 1, 'D5'), (2, 1.5, 'F#5'), (3.5, .5, 'E5')],
      [(0, 1, 'G4'), (1, 1, 'C5'), (2, 1.5, 'E5'), (3.5, .5, 'D5')],
      [(0, 1, 'D#5'), (1, 1, 'F#5'), (2, 1, 'A5'), (3, 1, 'F#5')]]
SEQ = [[(0, 1.5, 'B4'), (1.5, .5, 'E5'), (2, 1, 'G5'), (3, 1, 'F#5')],      # e
       [(0, 1.5, 'C5'), (1.5, .5, 'E5'), (2, 1, 'A5'), (3, 1, 'G5')],       # a
       [(0, 1.5, 'A4'), (1.5, .5, 'D5'), (2, 1, 'F#5'), (3, 1, 'E5')],      # D
       [(0, 1.5, 'B4'), (1.5, .5, 'D5'), (2, 1, 'G5'), (3, 1, 'F#5')],      # G
       [(0, 1.5, 'G4'), (1.5, .5, 'C5'), (2, 1, 'E5'), (3, 1, 'D5')],       # C
       [(0, 1.5, 'A4'), (1.5, .5, 'C5'), (2, 1, 'F#5'), (3, 1, 'D#5')],     # fis° (dis = verm. Septime)
       [(0, 1, 'F#5'), (1, 1, 'D#5'), (2, 1, 'B4'), (3, 1, 'A4')],          # H7
       [(0, 2, 'D#5'), (2, 1, 'F#5'), (3, 1, 'B4')]]                        # H7 → Tonika

# ---- Harmonieplan ----------------------------------------------------------------
Q1, Q3 = ['Em', 'C', 'Am', 'B7'], ['G', 'D', 'C', 'B7']
CIRCLE = ['Em', 'Am', 'D', 'G', 'C', 'F#dim', 'B7', 'B7']
CB = (['Em', 'C', 'Em', 'C', 'Em', 'C', 'Am', 'B7']                # A  0–7
      + Q1 + Q1 + Q3 + Q1                                          # B  8–23
      + CIRCLE + CIRCLE                                            # C 24–39
      + Q1 + Q1 + Q3 + Q1                                          # D 40–55
      + ['Em', 'C', 'Am', 'B7', 'C', 'Am', 'B7', 'B7'])            # E 56–63
assert len(CB) == BARS

# ============================ A: Intro (0–7) — Fugenexposition =====================
line('organ', 0, S1, 84, shift=-12, art=0.97)             # 1. Einsatz: Orgel, Oktave 4
pedal(0, 'Em', 80, 4.0); pedal(4, 'Em', 80, 2.0)          # Pedal-Halteton E
line('organ', 2, CS, 74, art=0.97)                        # Gegensubjekt
line('harp', 2, S1, 92, shift=0)                          # 2. Einsatz: Cembalo, Oktave 5
line('choir', 4, S1, 78, shift=-12, art=0.97)             # 3. Einsatz: Chor, Oktave 4
line('harp', 4, CS, 84, shift=12)                         # Gegensubjekt im Cembalo darüber
line('harp', 6, S2, 92)                                   # Fortsetzung a | H7
for b in range(0, 8):
    if b >= 2: bass(b, CB[b], 'whole', 78 if b < 6 else 90)
    if b >= 4: pad('slowstr', b, CB[b], 50, 58 + 4 * (b - 4)); timp(b, CB[b], 'pulse', 96)
    if b % 2 == 0: bell(b, CB[b], 84, octave=(b == 0))
    if b >= 6: pad('tremolo', b, CB[b], 60, 52 + 8 * (b - 6))
    if b in (4, 5): pad('orgch', b, CB[b], 50, 52)
    if b >= 4: dk(b, 'lite', fill=(b == 7))
    if b >= 6: pad('choir', b, CB[b], 60, 66)
ad('timp', 0, 3.5, root('Em', 36), 100)
timp(3, 'Em', 'roll', 60)
song.dr(0, CRASH, 100)

# ============================ B: Thema (8–23) ======================================
song.dr(8 * 4, CRASH, 104)
line('organ', 8, P1, 88, art=0.97); line('organ', 12, P2, 92, art=0.97)
line('organ', 16, P3, 88, art=0.97); line('organ', 20, P1, 92, art=0.97)
for b in range(8, 24):
    ch = CB[b]
    bass(b, ch, 'quarter' if b < 12 else 'drive', 92 if b < 12 else 98)
    arp('harp', b, ch, 48, 70)
    pad('slowstr', b, ch, 50, 64)
    timp(b, ch, 'pulse', 98)
    if b % 4 == 0: bell(b, ch, 78)
    if 12 <= b < 16: cm('violin', b, ch, 71, 68)
    if b >= 20: pad('choir', b, ch, 60, 70)
    dk(b, 'lite' if b < 16 else 'drive', fill=(b in (15, 23)))
for b in (16, 20): song.dr(b * 4, CRASH, 96)

# ============================ C: Steigerung (24–39) ================================
song.dr(24 * 4, CRASH, 108)
line('harp', 24, SEQ, 100)                                # Cembalo trägt das Subjekt in der Sequenz
line('organ', 32, SEQ, 92, art=0.97)                      # zweiter Durchgang: Orgel
for b in range(24, 40):
    ch = CB[b]; lap2 = b >= 32
    bass(b, ch, 'drive', 100)
    pad('orgch', b, ch, 50, 60 if not lap2 else 56)
    pad('tremolo', b, ch, 60, 64 if not lap2 else 72)
    timp(b, ch, 'gallop' if b % 8 == 7 else 'pulse', 102)
    if lap2:
        arp('harp', b, ch, 45, 76, sixteenth=True)
        cm('violin', b, ch, 71, 74)
        pad('choir', b, ch, 60, 62) if (b - 32) % 8 >= 4 else None
    if b % 2 == 0: bell(b, ch, 80, octave=(b % 8 == 0))
    dk(b, 'drive' if b < 32 else 'full', fill=(b in (31, 39)))
song.dr(32 * 4, CRASH, 112)

# ============================ D: Höhepunkt (40–55) =================================
song.dr(40 * 4, CRASH, 118); hit(40, 'Em', 104)
line('organ', 40, P2, 98, art=0.97); line('organ', 44, P1, 98, art=0.97)
line('organ', 48, P3, 98, art=0.97); line('organ', 52, P2, 100, art=0.97)
line('oohs', 40, P2, 84, shift=-12, art=0.97); line('oohs', 44, P1, 84, shift=-12, art=0.97)
line('oohs', 52, P2, 88, shift=-12, art=0.97)
for b in range(40, 56):
    ch = CB[b]
    bass(b, ch, 'drive', 108)
    pedal(b, ch, 86)
    pad('orgch', b, ch, 50, 66)
    pad('slowstr', b, ch, 55, 68)
    arp('harp', b, ch, 45, 80, sixteenth=True)
    timp(b, ch, 'gallop', 108)
    bell(b, ch, 84, octave=(b % 4 == 0))
    if 48 <= b < 52: cm('violin', b, ch, 71, 78); pad('choir', b, ch, 60, 68)
    dk(b, 'full', fill=(b in (47, 55)))
    if b % 8 == 0: song.dr(b * 4, CRASH, 112)
hit(48, 'G', 100)

# ============================ E: Rückführung (56–63) ===============================
song.dr(56 * 4, CRASH, 96)
line('organ', 56, S1, 88, shift=-12, art=0.97)            # Fugen-Echo wie im Intro
line('harp', 58, S2, 92)
line('choir', 56, CS, 66, art=0.97)
for b in range(56, 64):
    ch = CB[b]
    bass(b, ch, 'quarter' if b < 60 else 'whole', 92 if b < 60 else 88)
    pad('slowstr', b, ch, 50, 66 if b < 60 else 60)
    if b < 60: timp(b, ch, 'pulse', 96); dk(b, 'lite')
    else:
        pad('tremolo', b, ch, 60, 56 + (b - 60) * 12)
        arp('harp', b, ch, 45, 60 + (b - 60) * 8, sixteenth=True)
        pad('choir', b, ch, 60, 56 + (b - 60) * 8, 4.0)
        timp(b, ch, 'roll' if b >= 62 else 'pulse', 90 + (b - 60) * 6)
    if b in (56, 58, 60, 62): bell(b, ch, 80)
    if b >= 60: pedal(b, ch, 70 + (b - 60) * 4)
snare_roll(63, 44, 118)
hit(63, 'B7', 92, beat=3.0)      # Schlag auf der Dominante → Takt 0 (Loop)

sf2, out = cli_paths('bgm_battle5.ogg')
song.render(sf2, out)
