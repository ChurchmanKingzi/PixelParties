# -*- coding: utf-8 -*-
"""Battle-Theme „Schelmenstück“ → public/music/bgm_battle10.ogg

Verschmitzt-gefährlicher Zirkus-Gegner: g-Moll, 138 BPM, Swing-Achtel (Triolen-Feel per
Mikro-Timing), Pizzicato-Streicher, Xylophon/Vibraphon/Glockenspiel, Klarinette und Fagott
als freche Melodie, Akkordeon-„Chucks“, Calliope im Höhepunkt, springender Walking-Bass.

Aufbau (64 Takte ≈ 111,3 s, nahtlos loopbar; endet auf D7 → springt in den g-Moll-Anfang):
  Intro        Takt  0– 7   Bass + Pizzicato + Sidestick, Vibraphon deutet das Motiv an
  Thema A      Takt  8–23   Hauptmotiv (Klarinette, Fagott-Gegenstimme), wiederholt mit Xylophon/Akkordeon
  Thema B      Takt 24–39   frecher, springender Mittelteil (Cm–Gm–Es–D7 / Cm–F7–B–Es–Am7♭5–D7), Stopps
  Steigerung   Takt 40–47   Break mit leisem Motiv, dann Wirbel und aufsteigende Läufe
  Höhepunkt    Takt 48–59   Thema A mit Calliope + Klarinette + Xylophon + gedämpfte Trompete
  Rückführung  Takt 60–63   Ausdünnen, D7-Dominante, Fill in den Anfang

Aufruf:  python3 scripts/music/battle10.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os, re, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 138, 64
song = Song(bpm=BPM, bars=BARS)
rnd = random.Random(1382)

# ---- Stimmen (Name, Instrument, Lautstärke, Panorama) ---------------------------------
song.inst('bass',   'acbass',   100, 60)   # Walking-Bass, Oktave 1–2
song.inst('pizz',   'pizz',      96, 46)   # Pizzicato-Akkorde (Mitte)
song.inst('accord', 'accordion', 70, 86)   # Akkordeon-Chucks
song.inst('clar',   'clarinet',  96, 70)   # Hauptmelodie
song.inst('bsn',    'bassoon',   92, 38)   # Gegenstimme / Hiccups
song.inst('xylo',   'xylo',      84, 94)   # Doppelung, Läufe
song.inst('vibes',  'vibes',     82, 28)   # leises Motiv, Farbe
song.inst('glock',  'glock',     68, 104)  # Glitzer
song.inst('calli',  'calliope',  76, 56)   # Höhepunkt-Lead
song.inst('muted',  'muted',     80, 78)   # gedämpfte Trompete: freche Stiche

# ---- Notennamen, Swing, Dynamik --------------------------------------------------------
_PC = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def nm(s):
    m = re.fullmatch(r'([A-G])(#|b)?(-?\d)', s)
    return n(_PC[m.group(1)] + {'#': 1, 'b': -1, None: 0}[m.group(2)], int(m.group(3)))

def sw(x):
    """Swing: Achtel-Offbeat (x.5) rutscht auf das Triolen-Drittel (x.667)."""
    f = x - int(x)
    return x + 1 / 6 if abs(f - 0.5) < 1e-9 else x

# Dynamikfaktor pro Takt (Gesamtverlauf)
DYN = [0.0] * BARS
def _dyn(a, b, v0, v1):
    for i in range(a, b): DYN[i] = v0 + (v1 - v0) * (i - a) / max(1, b - a - 1)
_dyn(0, 8, 0.80, 0.92); _dyn(8, 16, 0.88, 0.92); _dyn(16, 24, 0.94, 1.0)
_dyn(24, 32, 0.96, 1.0); _dyn(32, 40, 1.0, 1.04); _dyn(40, 44, 0.78, 0.82)
_dyn(44, 48, 0.85, 1.05); _dyn(48, 60, 1.04, 1.06); _dyn(60, 64, 0.90, 0.82)

# Stopps: ab welchem Beat im Takt schweigt alles (außer force=True)
STOP = {7: 4, 31: 3, 39: 2, 59: 2, 63: 2.5}

def note(v, beat, dur, pitch, vel=90, art=0.9, force=False, fixdyn=False):
    """Note mit Swing, Stopp-Logik, Mikro-Timing und Dynamik."""
    bar = int(beat // 4)
    if not force and beat - 4 * bar >= STOP.get(bar, 4) - 1e-9: return
    t0 = sw(beat); t1 = sw(beat + dur)
    d = max(0.08, (t1 - t0) * art)
    t0 += rnd.uniform(-0.008, 0.008)
    vel = vel * (1 if fixdyn else DYN[min(bar, BARS - 1)]) + rnd.uniform(-4, 4)
    song.add(v, max(0, t0), d, pitch, vel)

def drum(beat, pitch, vel=100, dur=0.2, force=False):
    bar = int(beat // 4)
    if not force and beat - 4 * bar >= STOP.get(bar, 4) - 1e-9: return
    t0 = sw(beat) + rnd.uniform(-0.006, 0.006)
    song.dr(max(0, t0), pitch, max(1, vel * (0.55 + 0.45 * DYN[min(bar, BARS - 1)]) + rnd.uniform(-5, 5)), dur)

# ---- Harmonik --------------------------------------------------------------------------
# Akkord: (Grundton, Töne [Grund, Terz, Quinte, (Septime)])
CH = {
    'Gm':    (G,  [G, Bb, D]),
    'Cm':    (C,  [C, Eb, G]),
    'D7':    (D,  [D, Gb, A, C]),      # Gb = Fis: Leitton nach g
    'Eb':    (Eb, [Eb, G, Bb]),
    'F7':    (F,  [F, A, C, Eb]),
    'Bb':    (Bb, [Bb, D, F]),
    'Am7b5': (A,  [A, C, Eb, G]),
}
SCALE = {G, A, Bb, C, D, Eb, F, Gb}   # g-Moll natürlich + Fis

P1  = ['Gm', 'Gm', 'Cm', 'D7', 'Eb', 'D7', 'Gm', 'D7']
PB1 = ['Cm', 'Cm', 'Gm', 'Gm', 'Eb', 'Eb', 'D7', 'D7']
PB2 = ['Cm', 'F7', 'Bb', 'Eb', 'Am7b5', 'D7', 'Gm', 'D7']
PC  = ['Gm', 'Gm', 'Cm', 'Cm', 'Eb', 'Cm', 'D7', 'D7']
PD  = P1 + ['Cm', 'Eb', 'D7', 'D7']
PE  = ['Gm', 'Cm', 'D7', 'D7']
CHORDS = P1 + P1 + P1 + PB1 + PB2 + PC + PD + PE
assert len(CHORDS) == BARS

# ---- Themen (pro Takt: (Beat, Dauer, Note)) -------------------------------------------------
# Hauptmotiv „Schelm“: Auftakt-Sprung, Leitton Fis→G, bricht frech vor dem Ende ab.
A_LEAD = [
    [(0, .5, 'G4'), (1, .5, 'Bb4'), (1.5, .5, 'A4'), (2, 1, 'G4'), (3, .5, 'F#4'), (3.5, .5, 'G4')],
    [(0, .5, 'Bb4'), (.5, .5, 'C5'), (1, 1.5, 'D5'), (3, .5, 'C5'), (3.5, .5, 'Bb4')],
    [(0, .5, 'Eb5'), (.5, .5, 'D5'), (1, 1, 'C5'), (2, .5, 'Eb5'), (2.5, .5, 'D5'), (3, .5, 'C5')],
    [(0, 1, 'A4'), (1, .5, 'C5'), (1.5, .5, 'A4'), (2, 1.5, 'F#4')],
    [(0, .5, 'G4'), (.5, .5, 'Bb4'), (1, 1, 'Eb5'), (2, .5, 'D5'), (2.5, .5, 'Eb5'), (3, 1, 'G5')],
    [(0, 1, 'F#5'), (1, .5, 'D5'), (1.5, .5, 'C5'), (2, 1, 'A4')],
    [(0, .5, 'G4'), (1, .5, 'Bb4'), (1.5, .5, 'D5'), (2, 1.5, 'G5'), (3.5, .5, 'F#5')],
    [(0, .5, 'G5'), (.5, .5, 'F#5'), (1, 1, 'D5'), (2, .5, 'A4'), (2.5, .5, 'C5')],
]
# Fagott-Gegenstimme: antwortet in den Lücken
A_COUNTER = [
    [(.5, .5, 'D4'), (2.5, .5, 'Bb3')],
    [(2, .5, 'G3'), (2.5, .5, 'Bb3')],
    [(1.5, .5, 'Eb4'), (3.5, .5, 'G3')],
    [(2.5, .5, 'D4'), (3, .5, 'C4')],
    [(.5, .5, 'Bb3'), (2.5, .5, 'Bb3')],
    [(2.5, .5, 'D4'), (3, .5, 'F#3'), (3.5, .5, 'A3')],
    [(.5, .5, 'D4'), (2.5, .5, 'Bb3'), (3, .5, 'D4')],
    [(3, .5, 'A3'), (3.5, .5, 'C4')],
]
# Mittelteil B: springende Sequenzen
B_LEAD = [
    [(0, .5, 'C5'), (.5, .5, 'Eb5'), (1, .5, 'G5'), (1.5, .5, 'Eb5'), (2, 1, 'C5')],
    [(0, .5, 'D5'), (.5, .5, 'F5'), (1, .5, 'G5'), (1.5, .5, 'F5'), (2, 1, 'Eb5'), (3.5, .5, 'D5')],
    [(0, .5, 'Bb4'), (.5, .5, 'D5'), (1, .5, 'G5'), (1.5, .5, 'D5'), (2, 1, 'Bb4')],
    [(0, .5, 'A4'), (.5, .5, 'C5'), (1, .5, 'F#5'), (1.5, .5, 'G5'), (2, 1.5, 'D5')],
    [(0, .5, 'Eb5'), (.5, .5, 'G5'), (1, .5, 'Bb5'), (1.5, .5, 'G5'), (2, 1, 'Eb5'), (3, .5, 'D5'), (3.5, .5, 'Eb5')],
    [(0, .5, 'F5'), (.5, .5, 'G5'), (1, 1, 'Bb5'), (2, .5, 'G5'), (2.5, .5, 'F5'), (3, 1, 'Eb5')],
    [(0, .5, 'F#5'), (.5, .5, 'A5'), (1, .5, 'F#5'), (1.5, .5, 'D5'), (2, 1, 'C5'), (3, 1, 'A4')],
    [(0, .5, 'C5'), (.5, .5, 'A4'), (1, .5, 'F#4'), (1.5, .5, 'A4'), (2, .5, 'C5'), (2.5, .5, 'D5')],
    [(0, 1, 'G5'), (1, .5, 'Eb5'), (1.5, .5, 'C5'), (2, 1, 'D5'), (3, 1, 'Eb5')],
    [(0, 1, 'F5'), (1, .5, 'A5'), (1.5, .5, 'F5'), (2, 1, 'C5'), (3, 1, 'Eb5')],
    [(0, 1, 'D5'), (1, .5, 'F5'), (1.5, .5, 'D5'), (2, 1, 'Bb4'), (3, .5, 'C5'), (3.5, .5, 'D5')],
    [(0, 1, 'Eb5'), (1, .5, 'G5'), (1.5, .5, 'Bb5'), (2, 1, 'G5'), (3, 1, 'Eb5')],
    [(0, .5, 'C5'), (.5, .5, 'Eb5'), (1, .5, 'G5'), (1.5, .5, 'Eb5'), (2, 1, 'C5'), (3, 1, 'A4')],
    [(0, .5, 'A4'), (.5, .5, 'C5'), (1, .5, 'D5'), (1.5, .5, 'F#5'), (2, 1.5, 'A5'), (3.5, .5, 'G5')],
    [(0, 1.5, 'G5'), (1.5, .5, 'F#5'), (2, 1, 'G5'), (3, 1, 'D5')],
    [(0, .5, 'A4'), (.5, .5, 'C5'), (1, .5, 'D5'), (1.5, .5, 'F#5')],           # Stopp
]
# Steigerung: Motiv-Anfang leise (Takt 40–43), dann aufsteigende Arpeggien (44–47)
C_LEAD = [A_LEAD[0], A_LEAD[1], A_LEAD[2], A_LEAD[2],
          [(0, .5, 'G4'), (.5, .5, 'Bb4'), (1, .5, 'Eb5'), (1.5, .5, 'G5'), (2, 2, 'Bb5')],
          [(0, .5, 'C5'), (.5, .5, 'Eb5'), (1, .5, 'G5'), (1.5, .5, 'C6'), (2, 2, 'G5')],
          [(0, .5, 'A4'), (.5, .5, 'C5'), (1, .5, 'D5'), (1.5, .5, 'F#5'), (2, .5, 'A5'), (2.5, .5, 'C6'), (3, 1, 'A5')],
          [(i * .25, .25, 'A5') for i in range(16)]]
# Höhepunkt, Takte 56–59: Wendung Cm – Es – D7
D_TURN = [
    [(0, .5, 'C5'), (.5, .5, 'Eb5'), (1, .5, 'G5'), (1.5, .5, 'Eb5'), (2, .5, 'C5'), (2.5, .5, 'Eb5'), (3, 1, 'G5')],
    [(0, .5, 'Bb4'), (.5, .5, 'Eb5'), (1, .5, 'G5'), (1.5, .5, 'Bb5'), (2, 1.5, 'G5'), (3.5, .5, 'F5')],
    [(0, 1, 'F#5'), (1, 1, 'A5'), (2, 1, 'F#5'), (3, 1, 'D5')],
    [(0, .5, 'C5'), (.5, .5, 'A4'), (1, .5, 'F#4'), (1.5, .5, 'A4')],           # Stopp bei Beat 2
]
# Rückführung 60–63: Motiv-Fetzen, Leitton zurück nach g
E_LEAD = [
    [(0, .5, 'G4'), (1, .5, 'Bb4'), (1.5, .5, 'A4'), (2, 1, 'G4'), (3, .5, 'F#4'), (3.5, .5, 'G4')],
    [(0, .5, 'Eb5'), (.5, .5, 'D5'), (1, 1, 'C5'), (2, .5, 'G4'), (2.5, .5, 'Bb4')],
    [(0, 1, 'A4'), (1, .5, 'C5'), (1.5, .5, 'A4'), (2, 1, 'F#4'), (3, 1, 'A4')],
    [(0, .5, 'D5'), (.5, .5, 'C5'), (1, .5, 'A4'), (1.5, .5, 'F#4'), (2, .5, 'A4')],
]

_warn = []
def play(v, bar0, bars, tr=0, vel=90, art=0.9, check=True):
    """Melodie spielen; prüft Töne auf Tonleiter/Akkord (Warnung bei Fremdtönen)."""
    for i, lst in enumerate(bars):
        b = bar0 + i
        for x in lst:
            beat, dur, name = x[:3]
            p = nm(name) + tr
            if check and (p - tr) % 12 not in SCALE | set(CH[CHORDS[b]][1]): _warn.append((b, name))
            note(v, 4 * b + beat, dur, p, x[3] if len(x) > 3 else vel, art)

# ---- Begleitung ---------------------------------------------------------------------------
def place(pc, prev, lo=34, hi=52):
    c = [pc + 12 * k for k in range(0, 10) if lo <= pc + 12 * k <= hi]
    return min(c, key=lambda x: (abs(x - prev), x))

def walk(b, vel=88):
    """Walking-Bass: Grundton – Terz/Quinte – chromatischer Anlauf zum nächsten Akkord."""
    root, pcs = CH[CHORDS[b]]
    nxt = CH[CHORDS[(b + 1) % BARS]][0]
    r = place(root, 43)
    third, fifth = place(pcs[1], r), place(pcs[2], r)
    if nxt == root: ap_pc = (root - 2) % 12
    else:
        ap_pc = (nxt - 1) % 12 if b % 2 == 0 else (nxt + 1) % 12
    ap = place(ap_pc, fifth)
    pat = b % 3
    seq = [(r, third, fifth), (r, fifth, third), (r, r + 12 if r + 12 <= 52 else r - 12, fifth)][pat]
    for i, p in enumerate((seq[0], seq[1], seq[2], ap)):
        note('bass', 4 * b + i, 0.9, p, vel + (8 if i == 0 else 0), 0.92)

def voice_in(pcs, lo, hi):
    return sorted(p for pc in pcs for p in range(lo, hi + 1) if p % 12 == pc % 12)

def pizz_comp(b, vel=80, style='ob'):
    ch = voice_in(CH[CHORDS[b]][1], 52, 63)
    beats = {'ob': [1, 3], 'skip': [1, 2.5, 3], 'full': [0, 1, 2, 3]}[style]
    for t in beats:
        for p in ch: note('pizz', 4 * b + t, 0.3, p, vel + rnd.uniform(-3, 3) + (6 if t in (1, 3) else -6), 0.8)

def accord_chuck(b, vel=58):
    ch = voice_in(CH[CHORDS[b]][1][:3], 57, 68)
    for t in (1.5, 3.5):
        for p in ch: note('accord', 4 * b + t, 0.35, p, vel, 0.85)

def hiccup(b, vel=84):
    """Fagott-„Hicks“: freche Achtel auf dem Offbeat."""
    root, pcs = CH[CHORDS[b]]
    lo = place(root, 50, 46, 58)
    note('bsn', 4 * b + 1.5, 0.5, lo, vel, 0.75)
    note('bsn', 4 * b + 3.5, 0.5, place(pcs[2], 52, 46, 58), vel - 6, 0.75)

# ---- Schlagzeug ------------------------------------------------------------------------------
def groove(b, lvl):
    s = 4 * b
    if lvl == 0:
        for t in (1, 3): drum(s + t, SIDESTICK, 60)
        for t in (0, 2, 3): drum(s + t, HAT, 50)
    elif lvl == 1:
        drum(s, KICK, 88); drum(s + 2, KICK, 72)
        for t in (1, 3): drum(s + t, SIDESTICK, 78)
        for t in (0, 1, 1.5, 2, 3, 3.5): drum(s + t, HAT, 58 if t % 1 == 0 else 44)
    elif lvl == 2:
        drum(s, KICK, 104); drum(s + 2, KICK, 96)
        if b % 2 == 1: drum(s + 2.5, KICK, 74)
        drum(s + 1, SNARE, 100); drum(s + 3, SNARE, 104)
        if b % 4 == 3: drum(s + 3.5, SNARE, 46)
        for i in range(8): drum(s + i * .5, HAT, 78 if i % 2 == 0 else 52)
        if b % 2 == 0: drum(s + 2, PHAT, 50)
    else:
        drum(s, KICK, 112); drum(s + 2, KICK, 104); drum(s + 2.5, KICK, 84)
        drum(s + 1, SNARE, 110); drum(s + 3, SNARE, 112)
        drum(s + 1.5, SNARE, 40); drum(s + 3.5, SNARE, 52)
        for i in range(8): drum(s + i * .5, HAT if i != 5 else OHAT, 84 if i % 2 == 0 else 58)
        if b % 2 == 1: drum(s + 3.5, COWBELL, 66)

def fill(b, kind=0):
    s = 4 * b
    if kind == 0:      # Triolen-Snare, crescendo
        for i, t in enumerate([2, 2.333, 2.667, 3, 3.333, 3.667]): drum(s + t, SNARE, 60 + i * 12, 0.15)
    elif kind == 1:    # Toms abwärts
        for t, p in zip([2, 2.333, 2.667, 3, 3.333, 3.667], [TOM_HH, TOM_H, TOM_M, TOM_L, SNARE, KICK]):
            drum(s + t, p, 92, 0.2)
    else:              # 16tel-Wirbel
        for i in range(16): drum(s + i * .25, SNARE, 50 + i * 4, 0.12)

def crash(b, vel=104): drum(4 * b, CRASH, vel, 0.6, force=True)

# ---- Arrangement --------------------------------------------------------------------------------
# Walking-Bass durchgehend (bis auf Breakdown-Takte 40–43: Halbe/Pedal)
for b in range(BARS):
    if 40 <= b < 44:
        root = CH[CHORDS[b]][0]
        note('bass', 4 * b, 1.9, place(root, 43), 86); note('bass', 4 * b + 2, 1.9, place(CH[CHORDS[b]][1][2], 43), 78)
    else:
        walk(b, 78 if b < 8 or b >= 60 else 90)

# Intro (0–7)
for b in range(0, 8):
    pizz_comp(b, 66 if b < 4 else 76, 'ob' if b % 2 == 0 else 'skip')
    groove(b, 0 if b < 4 else 1)
play('vibes', 4, A_LEAD[:4], vel=70, art=0.85)          # Vibraphon deutet das Motiv an
fill(7, 0)
# Thema A (8–23)
crash(8, 100)
for b in range(8, 24):
    pizz_comp(b, 82, 'skip' if b % 4 == 3 else 'ob'); groove(b, 2)
    if b >= 16: accord_chuck(b, 60)
play('clar', 8, A_LEAD, vel=92)
play('bsn', 8, A_COUNTER, vel=78)
play('clar', 16, A_LEAD, vel=94)
play('xylo', 16, A_LEAD, vel=76, art=0.6)
play('bsn', 16, A_COUNTER, vel=80)
for b in (11, 19): note('glock', 4 * b + 3.5, 0.5, nm('D6'), 60, force=True)   # Glitzer im Stopp
fill(15, 1); crash(16, 100); fill(23, 0)
# Thema B (24–39)
crash(24, 104)
for b in range(24, 40):
    pizz_comp(b, 84, 'skip' if b % 2 else 'ob'); groove(b, 2); accord_chuck(b, 62)
    if b < 32: hiccup(b, 80)
play('clar', 24, B_LEAD, vel=90, art=0.7)
play('xylo', 32, B_LEAD[:8], vel=78, art=0.6)
play('calli', 32, B_LEAD[8:], vel=72, art=0.7)
for b in range(32, 40):                                   # Glockenspiel: Akkordton-Glitzer auf Beat 1
    for k, t in enumerate((0, 1.5, 3)):
        note('glock', 4 * b + t, 0.4, place(CH[CHORDS[b]][1][k % 3], 84, 72, 91), 56, 0.6)
note('xylo', 4 * 31 + 3.5, 0.4, nm('D6'), 84, force=True)   # Plink nach dem Stopp
note('pizz', 4 * 31 + 3.5, 0.4, nm('A3'), 80, force=True)
drum(4 * 39 + 3.667, TOM_L, 88, force=True)
crash(32, 106)
# Steigerung (40–47): Break, dann Aufbau
for b in range(40, 44):
    for t in (1, 3): drum(4 * b + t, SIDESTICK, 70)
    if b % 2 == 0: pizz_comp(b, 66, 'ob')
    for t in (0, 2): drum(4 * b + t, HAT, 44)
play('vibes', 40, C_LEAD[:4], vel=78, art=0.85)
for b in range(44, 48):
    pizz_comp(b, 84, 'full' if b >= 46 else 'ob'); groove(b, 1)
    if b >= 46: accord_chuck(b, 60)
play('clar', 44, C_LEAD[4:7], vel=88)
play('xylo', 44, C_LEAD[4:7], vel=70, art=0.6)
play('xylo', 47, C_LEAD[7:], vel=70, art=0.5)
play('bsn', 44, [[(0, .5, 'D4'), (2, .5, 'Bb3')]] * 4, vel=70)
fill(47, 2)
# Höhepunkt (48–59)
crash(48, 112)
for b in range(48, 60):
    pizz_comp(b, 88, 'skip' if b % 2 else 'ob'); groove(b, 3); accord_chuck(b, 66)
play('calli', 48, A_LEAD, vel=88)
play('clar', 48, A_LEAD, vel=92)
play('xylo', 48, A_LEAD, tr=12, vel=70, art=0.5)
play('bsn', 48, A_COUNTER, vel=84)
play('calli', 56, D_TURN, vel=90)
play('clar', 56, D_TURN, vel=94)
play('xylo', 56, D_TURN, tr=12, vel=72, art=0.5)
for b in (48, 52, 56):                                     # freche Trompetenstiche
    for p in voice_in(CH[CHORDS[b]][1], 55, 65): note('muted', 4 * b, 0.5, p, 90)
for b in (51, 55, 58):
    for p in voice_in(CH[CHORDS[b]][1], 55, 65): note('muted', 4 * b + 3.5, 0.4, p, 84)
fill(51, 0); fill(55, 1); crash(52, 104); crash(56, 108); fill(59, 0)
# Rückführung (60–63)
for b in range(60, 64):
    pizz_comp(b, 74, 'ob'); groove(b, 1 if b < 62 else 0)
play('clar', 60, E_LEAD, vel=82)
play('xylo', 60, E_LEAD, vel=64, art=0.6)
play('bsn', 62, [[(2.5, .5, 'D4')], [(0, .5, 'C4')]], vel=70)
for i, t in enumerate([3.333, 3.5, 3.667]): drum(4 * 63 + t, SNARE, 60 + i * 18, 0.12, force=True)
drum(4 * 63 + 2.667, KICK, 84, force=True)

if _warn: print('Hinweis, Töne außerhalb Tonleiter/Akkord:', _warn)
sf2, out = cli_paths('bgm_battle10.ogg'); song.render(sf2, out)
