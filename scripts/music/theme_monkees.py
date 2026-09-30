# -*- coding: utf-8 -*-
"""Battle-Theme „Banana Brawl“ (Monkees) → public/music/bgm_theme_monkees.ogg

Dschungel-Chaos als Funk: G-Mixolydisch (mit Blue-Note Bb und Moll-Wendung im Mittelteil),
144 BPM, 16tel-Funk-Bass, Bongo/Tom-Grooves mit Cowbell, „Chicken-Scratch“-Gitarre,
Marimba/Xylophon-Geplapper, freches Sax-Hauptmotiv („Affenlachen“), Posaunen-Stiche,
Affenschrei-Läufe in Flöte/Pfeife. Im Mittelteil schleicht ein chromatisches Ganoven-Riff
(gedämpfte Trompete, „Criminal/NFT-Monkee“), und Glockenspiel-Pings klingeln wie Gold-Gewinn.

Aufbau (72 Takte = 120,0 s, nahtlos loopbar; endet auf D7 → springt nach G7):
  Intro        Takt  0– 7   Funk-Bass, Bongos, Kick, Cowbell, Scratch-Gitarre; Marimba-Geplapper, Affenruf
  Thema A      Takt  8–23   Sax-Motiv (G7–F–C7–F–D7), Posaunenstiche; ab 16 Marimba/Xylophon-Doppelung
  Thema B      Takt 24–39   „Heist“: g-Dorisch/C7/Es7/D7, Ganoven-Riff, Gold-Pings, Sax-Antworten
  Steigerung   Takt 40–55   Bongo-Solo/Break, Call-and-Response Marimba↔Flöte, Läufe, Wirbel
  Höhepunkt    Takt 56–67   Thema A mit Sax+Flöte+Trompete+Xylophon, Brass-Stiche, volle Percussion
  Rückführung  Takt 68–71   Ausdünnen, Bass-Riff, D7-Dominante, Fill in den Anfang

Aufruf:  python3 scripts/music/theme_monkees.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os, re, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 144, 72
song = Song(bpm=BPM, bars=BARS)
rnd = random.Random(1443)

song.inst('bass',   'sbass',     104, 60)   # Funk-Bass, Oktave 1–2
song.inst('gtr',    'cleangtr',   84, 36)   # Chicken-Scratch
song.inst('mar',    'marimba',    92, 88)   # Geplapper
song.inst('xylo',   'xylo',       80, 100)
song.inst('sax',    'sax',        96, 66)   # Hauptmotiv
song.inst('tromb',  'trombone',   86, 44)   # Stiche
song.inst('flute',  'flute',      88, 76)   # Affenschrei-Läufe
song.inst('whistle','whistle',    74, 86)
song.inst('muted',  'muted',      88, 78)   # Ganoven-Riff
song.inst('glock',  'glock',      72, 108)  # Goldpings
song.inst('brass',  'brass',      84, 52)   # Höhepunkt-Stiche
song.inst('kal',    'kalimba',    76, 24)   # Dschungelzupfen

_PC = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def nm(s):
    m = re.fullmatch(r'([A-G])(#|b)?(-?\d)', s)
    return n(_PC[m.group(1)] + {'#': 1, 'b': -1, None: 0}[m.group(2)], int(m.group(3)))

S = 0.25   # eine 16tel in Vierteln
DYN = [0.0] * BARS
def _dyn(a, b, v0, v1):
    for i in range(a, b): DYN[i] = v0 + (v1 - v0) * (i - a) / max(1, b - a - 1)
_dyn(0, 8, 0.86, 0.94); _dyn(8, 24, 0.92, 0.98); _dyn(24, 40, 0.96, 1.0); _dyn(40, 48, 0.90, 0.94)
_dyn(48, 56, 0.94, 1.04); _dyn(56, 68, 1.04, 1.06); _dyn(68, 72, 0.96, 0.9)
STOP = {39: 3, 55: 3, 67: 3}   # ab diesem Beat schweigt alles (außer force)

def note(v, beat, dur, pitch, vel=90, art=0.9, force=False):
    bar = int(beat // 4)
    if not force and beat - 4 * bar >= STOP.get(bar, 4) - 1e-9: return
    song.add(v, max(0, beat + rnd.uniform(-0.005, 0.005)), max(0.06, dur * art), pitch, vel * DYN[min(bar, BARS - 1)] + rnd.uniform(-3, 3))

def drum(beat, pitch, vel=100, dur=0.2, force=False):
    bar = int(beat // 4)
    if not force and beat - 4 * bar >= STOP.get(bar, 4) - 1e-9: return
    song.dr(max(0, beat + rnd.uniform(-0.004, 0.004)), pitch, max(1, vel * (0.6 + 0.4 * DYN[min(bar, BARS - 1)]) + rnd.uniform(-4, 4)), dur)

# Akkord: (Grundton, Töne, „Septime“ des Basses in Halbtönen)
CH = {
    'G7':  (G,  [G, B, D, F],   10), 'F':   (F, [F, A, C, Eb], 10), 'C7':  (C, [C, E, G, Bb], 10),
    'D7':  (D,  [D, Gb, A, C],  10), 'Gm7': (G, [G, Bb, D, F], 10), 'Eb7': (Eb, [Eb, G, Bb, Db], 10),
}
SCALE = {G, A, Bb, B, C, D, Eb, E, F, Gb}
PA  = ['G7', 'G7', 'F', 'F', 'C7', 'C7', 'F', 'D7']
PB  = ['Gm7', 'Gm7', 'C7', 'C7', 'Gm7', 'Gm7', 'Eb7', 'D7']
PK  = ['G7', 'G7', 'F', 'C7', 'G7', 'F', 'C7', 'D7']
CHORDS = PA * 3 + PB * 2 + PK * 2 + PA + ['G7', 'F', 'C7', 'D7'] + ['G7', 'F', 'C7', 'D7']
# 24 (Intro+A) + 16 (B) + 16 (Steigerung) + 12 (Höhepunkt) + 4 (Rückführung)
assert len(CHORDS) == 24 + 16 + 16 + 8 + 4 + 4 == BARS

# Sax-Hauptmotiv „Affenlachen“ – pro Takt (16tel-Slot, Länge in 16teln, Note)
A_LEAD = [
    [(0,2,'G4'),(3,1,'B4'),(4,2,'D5'),(6,1,'B4'),(8,2,'G4'),(10,1,'A4'),(11,1,'Bb4'),(12,2,'B4'),(14,2,'D5')],
    [(0,2,'E5'),(3,1,'D5'),(4,2,'B4'),(6,1,'G4'),(8,4,'D5'),(13,1,'D5'),(14,1,'E5'),(15,1,'F5')],
    [(0,2,'F5'),(3,1,'E5'),(4,2,'C5'),(6,1,'A4'),(8,2,'F4'),(10,1,'A4'),(11,1,'C5'),(12,4,'F5')],
    [(0,2,'E5'),(3,1,'D5'),(4,2,'C5'),(6,1,'A4'),(8,4,'C5'),(14,1,'D5'),(15,1,'Eb5')],
    [(0,2,'C5'),(3,1,'E5'),(4,2,'G5'),(6,1,'E5'),(8,2,'C5'),(10,1,'D5'),(11,1,'E5'),(12,2,'G5'),(14,2,'Bb5')],
    [(0,2,'A5'),(3,1,'G5'),(4,2,'E5'),(6,1,'C5'),(8,4,'G5'),(12,1,'E5'),(13,1,'D5'),(14,2,'C5')],
    [(0,2,'A4'),(3,1,'C5'),(4,2,'F5'),(6,1,'C5'),(8,2,'A5'),(10,2,'G5'),(12,2,'F5'),(14,2,'D5')],
    [(0,2,'F#5'),(3,1,'A5'),(4,2,'D6'),(6,1,'C6'),(8,2,'A5'),(10,2,'F#5'),(12,4,'D5')],
]
# Heist-Sax (Mittelteil): kurze Antworten auf das Ganoven-Riff
B_ANS = [
    [(10,1,'D5'),(11,1,'F5'),(12,2,'G5'),(14,2,'F5')],
    [(10,1,'Bb4'),(11,1,'D5'),(12,4,'G5')],
    [(10,1,'E5'),(11,1,'G5'),(12,2,'Bb5'),(14,2,'G5')],
    [(10,1,'C5'),(11,1,'E5'),(12,4,'G5')],
    [(10,1,'D5'),(11,1,'F5'),(12,2,'G5'),(14,2,'Bb5')],
    [(8,2,'A5'),(10,2,'G5'),(12,2,'F5'),(14,2,'D5')],
    [(0,2,'G5'),(3,1,'Bb5'),(4,2,'G5'),(6,1,'Eb5'),(8,2,'G5'),(10,2,'Bb5'),(12,4,'G5')],
    [(0,2,'F#5'),(3,1,'A5'),(4,2,'C6'),(6,1,'A5'),(8,2,'F#5'),(10,2,'D5'),(12,2,'A4'),(14,2,'C5')],
]
D_TURN = [   # letzte 4 Takte des Höhepunkts: G7 F C7 D7 (Takte 64–67)
    [(0,2,'D5'),(3,1,'G5'),(4,2,'B5'),(6,1,'G5'),(8,2,'D6'),(10,2,'B5'),(12,4,'G5')],
    [(0,2,'C5'),(3,1,'F5'),(4,2,'A5'),(6,1,'F5'),(8,2,'C6'),(10,2,'A5'),(12,4,'F5')],
    [(0,2,'E5'),(3,1,'G5'),(4,2,'Bb5'),(6,1,'G5'),(8,2,'E6'),(10,2,'C6'),(12,2,'G5'),(14,2,'E5')],
    [(0,2,'F#5'),(3,1,'A5'),(4,2,'C6'),(6,1,'A5'),(8,2,'D6'),(10,1,'C6'),(11,1,'A5'),(12,2,'F#5'),(14,1,'A5'),(15,1,'C6')],
]

_warn = []
def play(v, bar0, bars, tr=0, vel=90, art=0.8):
    for i, lst in enumerate(bars):
        b = bar0 + i
        for x in lst:
            slot, dur, name = x[:3]
            p = (nm(name) if isinstance(name, str) else name) + tr
            if (p - tr) % 12 not in SCALE: _warn.append((b, name))
            note(v, 4 * b + slot * S, dur * S, p, vel + (6 if slot % 4 == 0 else 0), art)

def place(pc, prev, lo=31, hi=50):
    c = [pc + 12 * k for k in range(0, 10) if lo <= pc + 12 * k <= hi]
    return min(c, key=lambda x: (abs(x - prev), x))
def voice_in(pcs, lo, hi):
    return sorted(p for pc in pcs for p in range(lo, hi + 1) if p % 12 == pc % 12)

# ---- Begleitung ---------------------------------------------------------------------------------
def funk_bass(b, vel=96, simple=False):
    root, pcs, sev = CH[CHORDS[b]]
    r = place(root, 38); o = r + 12 if r + 12 <= 52 else r - 12
    f = place(pcs[2], r); s = place((root + sev) % 12, r)
    nxt = CH[CHORDS[(b + 1) % BARS]][0]
    ap = place((nxt - 1) % 12, r)
    if simple:
        seq = [(0, 3, r), (4, 1, o), (6, 1, s), (8, 3, r), (12, 1, f), (14, 2, ap)]
    elif b % 2 == 0:
        seq = [(0, 2, r), (3, 1, r), (5, 1, o), (6, 1, s), (8, 2, r), (11, 1, f), (12, 1, s), (14, 1, f), (15, 1, ap)]
    else:
        seq = [(0, 2, r), (2, 1, o), (3, 1, r), (6, 1, s), (7, 1, f), (8, 2, r), (11, 1, r), (12, 2, f), (14, 2, ap)]
    for slot, d, p in seq:
        note('bass', 4 * b + slot * S, d * S, p, vel + (8 if slot in (0, 8) else 0), 0.75)

def scratch(b, vel=70):
    ch = voice_in(CH[CHORDS[b]][1][:4], 55, 66)[:4]
    for slot in (2, 3, 6, 7, 10, 11, 14):
        for p in ch: note('gtr', 4 * b + slot * S, 0.14, p, vel + (10 if slot in (2, 10) else -6), 0.9)

def chatter(b, voice='mar', vel=76, hi=False):
    """Marimba-Geplapper: 16tel-Ostinato über Akkordtöne."""
    tones = voice_in(CH[CHORDS[b]][1], 60 + (12 if hi else 0), 79 + (12 if hi else 0))
    pat = [0, 2, 1, 3, 2, 1, 0, 2, 3, 1, 2, 0, 1, 3, 2, 1]
    for i, k in enumerate(pat):
        if i in (1, 5, 9, 13) and b % 2: continue
        note(voice, 4 * b + i * S, 0.2, tones[k % len(tones)], vel + (8 if i % 4 == 0 else 0), 0.7)

def stab(b, slots, voice='tromb', vel=90, lo=52, hi=64, dur=0.22):
    for slot in slots:
        for p in voice_in(CH[CHORDS[b]][1], lo, hi): note(voice, 4 * b + slot * S, dur, p, vel, 0.8)

# ---- Schlagzeug: Bongo-Funk -------------------------------------------------------------------------
def groove(b, lvl):
    s = 4 * b
    if lvl == 0:      # Intro: Kick, Bongos, Cowbell
        for slot in (0, 3, 8, 11): drum(s + slot * S, KICK, 96)
        for slot in (2, 5, 7, 10, 13, 15): drum(s + slot * S, TOM_HH if slot % 2 else TOM_H, 78)
        for slot in (0, 4, 8, 12): drum(s + slot * S, COWBELL, 62)
        drum(s + 1, SIDESTICK, 80); drum(s + 3, SIDESTICK, 84)
    elif lvl == 1:
        for slot in (0, 3, 8, 11): drum(s + slot * S, KICK, 104)
        drum(s + 1, SNARE, 100); drum(s + 3, SNARE, 106); drum(s + 3.75 * 1, SNARE, 44)
        for slot in (2, 5, 7, 10, 13, 15): drum(s + slot * S, TOM_HH if slot % 2 else TOM_H, 80)
        for i in range(16): drum(s + i * S, HAT, 104 if i % 4 == 0 else 84)
        for slot in (0, 4, 8, 12): drum(s + slot * S, COWBELL, 60)
    else:
        for slot in (0, 3, 6, 8, 11): drum(s + slot * S, KICK, 112)
        drum(s + 1, SNARE, 112); drum(s + 3, SNARE, 114); drum(s + 1, CLAP, 76); drum(s + 3, CLAP, 80)
        drum(s + 2.75, SNARE, 46); drum(s + 3.75, SNARE, 52)
        for slot in (2, 5, 7, 10, 13, 15): drum(s + slot * S, [TOM_HH, TOM_H, TOM_M][slot % 3], 90)
        for i in range(16): drum(s + i * S, HAT if i % 8 != 6 else OHAT, 108 if i % 4 == 0 else 88)
        for slot in (0, 2, 4, 6, 8, 10, 12, 14): drum(s + slot * S, COWBELL, 66 if slot % 4 == 0 else 52)

def bongo_solo(b, kind):
    s = 4 * b
    pats = [
        [(0,TOM_H),(1,TOM_HH),(2,TOM_H),(4,TOM_M),(5,TOM_H),(6,TOM_HH),(8,TOM_L),(9,TOM_M),(10,TOM_H),(12,TOM_HH),(13,TOM_H),(14,TOM_M),(15,TOM_L)],
        [(0,TOM_HH),(2,TOM_H),(3,TOM_H),(4,TOM_M),(6,TOM_M),(8,TOM_H),(9,TOM_HH),(11,TOM_M),(12,TOM_L),(13,TOM_L),(14,TOM_M),(15,TOM_H)],
    ]
    for slot, p in pats[kind % 2]: drum(s + slot * S, p, 96 + (10 if slot % 4 == 0 else 0), 0.15)
    for slot in (0, 8): drum(s + slot * S, KICK, 104)
    for slot in (4, 12): drum(s + slot * S, COWBELL, 72)
    drum(s + 1, SIDESTICK, 84); drum(s + 3, SIDESTICK, 84)

def fill(b, kind=0):
    s = 4 * b
    if kind == 0:
        for i, p in enumerate([TOM_HH, TOM_H, TOM_H, TOM_M, TOM_M, TOM_L, SNARE, SNARE]): drum(s + 2 + i * .25, p, 78 + i * 6, 0.12, force=True)
    elif kind == 1:
        for i in range(16): drum(s + i * S, SNARE, 46 + i * 4, 0.12, force=True)
    else:
        for i, p in enumerate([TOM_HH, TOM_H, TOM_M, TOM_L, SNARE, SNARE, KICK, KICK]): drum(s + 2 + i * .25, p, 96, 0.15, force=True)
def crash(b, vel=104): drum(4 * b, CRASH, vel, 0.6, force=True)

def monkey_run(b, slot0=8, voice='flute', up=True, vel=90):
    """Affenschrei: chromatisch-pentatonische Kaskade (G-Bluesskala) mit Schluss-Kreischer."""
    sc = [nm(x) for x in ('G5','Bb5','C6','D6','F6','G6')]
    seq = sc if up else sc[::-1]
    for i, p in enumerate(seq): note(voice, 4 * b + (slot0 + i) * S, S * 0.9, p, vel + i * 3, 0.9, force=True)
    note(voice, 4 * b + (slot0 + 6) * S, 0.5, nm('G6') if up else nm('G5'), vel + 12, 0.9, force=True)

# ---- Arrangement ------------------------------------------------------------------------------------
for b in range(BARS):
    funk_bass(b, 96 if b < 8 or b >= 68 else 104, simple=(48 <= b < 56 and b % 2 == 1))

# Intro 0–7
for b in range(0, 8):
    groove(b, 0 if b < 4 else 1); scratch(b, 66)
    chatter(b, 'mar', 66 + (b // 2) * 4)
for b in range(4, 8): note('kal', 4 * b + 1.5, 0.4, voice_in(CH[CHORDS[b]][1], 72, 84)[0], 70, force=True)
monkey_run(6, 8, 'whistle', True, 80); monkey_run(7, 12, 'flute', False, 86)
fill(7, 0)
# Thema A 8–23
crash(8, 100)
for b in range(8, 24):
    groove(b, 1); scratch(b, 74); chatter(b, 'mar', 60 if b < 16 else 72)
play('sax', 8, A_LEAD, vel=94); play('sax', 16, A_LEAD, vel=96)
play('xylo', 16, A_LEAD, tr=12, vel=72, art=0.5)
for b in range(8, 24):
    if b % 8 in (3, 7): stab(b, (14,), 'tromb', 88)
    elif b % 2: stab(b, (10,), 'tromb', 84)
for b in range(16, 24): note('glock', 4 * b + 0, 0.3, voice_in(CH[CHORDS[b]][1], 84, 96)[1], 66, force=True) if b % 4 == 0 else None
fill(15, 2); crash(16, 100); fill(23, 1)
# Thema B 24–39 (Heist)
crash(24, 104)
RIFF = [nm('G4'), nm('Ab4'), nm('G4'), nm('F#4')]    # Ganoven-Riff (chromatisch, Halbtonschritt und Rückkehr)
for b in range(24, 40):
    groove(b, 1 if b < 32 else 2); scratch(b, 72)
    ch = CH[CHORDS[b]]
    root = ch[0]
    base = place(root, 47, 43, 58) + 12 * (1 if root in (G, C, D) else 0)
    if base > 59: base -= 12
    for i, (slot, d, iv) in enumerate([(0, 2, 0), (2, 1, 1), (3, 1, 0), (4, 2, -1), (8, 2, 0), (10, 1, 1), (11, 1, 0), (12, 2, -1)]):
        pitch = base + iv
        note('muted', 4 * b + slot * S, d * S, pitch, 88, 0.8)
play('sax', 24, B_ANS, vel=92, art=0.8); play('sax', 32, B_ANS, vel=94, art=0.8)
play('mar', 32, B_ANS, tr=0, vel=70, art=0.6)
for b in range(24, 40, 2):                                   # Gold-Pings (NFT-Klingeling)
    for k, slot in enumerate((13, 14, 15)): note('glock', 4 * b + slot * S, 0.3, nm('D6') + [0, 4, 7][k] + (0 if k < 2 else 0), 78, 0.5, force=True)
for b in range(32, 40): chatter(b, 'xylo', 60, hi=True)
note('glock', 4 * 39 + 3.5, 0.5, nm('G6'), 86, force=True); drum(4 * 39 + 3.5, COWBELL, 90, force=True); drum(4 * 39 + 3.75, TOM_L, 100, force=True)
crash(32, 106); fill(31, 2)
# Steigerung 40–55: Bongo-Solo, Call-and-Response, Läufe
for b in range(40, 48):
    bongo_solo(b, b) if b < 44 else groove(b, 1)
    if b >= 44: scratch(b, 70)
    if b < 44: chatter(b, 'mar', 64)
for b in range(40, 44):
    tones = voice_in(CH[CHORDS[b]][1], 72, 88)
    for i, slot in enumerate((0, 3, 6, 8)): note('kal', 4 * b + slot * S, 0.3, tones[(i + b) % len(tones)], 80, 0.7)
call = [(0,2,'G5'),(3,1,'Bb5'),(4,2,'D6'),(6,1,'C6'),(8,4,'G5')]
for i, b in enumerate(range(44, 48)):
    if i % 2 == 0: play('flute', b, [call], vel=90)
    else: play('mar', b, [[(0,2,'G4'),(3,1,'Bb4'),(4,2,'D5'),(6,1,'C5'),(8,4,'G4')]], vel=88)
    stab(b, (10, 14), 'tromb', 88)
monkey_run(45, 8, 'flute', True, 86); monkey_run(47, 4, 'whistle', True, 88)
fill(47, 1); crash(48, 108)
for b in range(48, 56):
    groove(b, 1 if b < 52 else 2); scratch(b, 74); chatter(b, 'mar', 72, hi=(b >= 52))
    tones = voice_in(CH[CHORDS[b]][1], 60, 79)
play('sax', 48, A_LEAD, vel=94)
play('flute', 52, A_LEAD[4:], tr=12, vel=82, art=0.6)
for b in range(48, 56):
    if b % 2: stab(b, (10, 14), 'tromb', 90, 52, 64)
note('flute', 4 * 55 + 3.25, 0.4, nm('G6'), 96, force=True); note('glock', 4 * 55 + 3.5, 0.5, nm('G6'), 90, force=True)
fill(51, 0); crash(52, 100); fill(55, 2)
# Höhepunkt 56–67
crash(56, 114)
for b in range(56, 68):
    groove(b, 2); scratch(b, 78); chatter(b, 'xylo' if b % 2 else 'mar', 70, hi=(b % 2 == 0))
    if b % 2 == 0: stab(b, (0, 6, 10), 'brass', 86, 55, 67, 0.3)
play('sax', 56, A_LEAD, vel=98); play('sax', 64, D_TURN, vel=100)
play('flute', 56, A_LEAD, tr=12, vel=84, art=0.6); play('flute', 64, D_TURN, tr=12, vel=86, art=0.6)
play('muted', 56, A_LEAD, tr=0, vel=76, art=0.6)
play('xylo', 64, D_TURN, tr=12, vel=72, art=0.5)
for b in (59, 62, 66): stab(b, (14,), 'tromb', 96)
fill(59, 2); fill(63, 0); fill(67, 1)
# Rückführung 68–71
for b in range(68, 72): groove(b, 1 if b < 70 else 0); scratch(b, 66)
play('sax', 68, [[(0,2,'G4'),(3,1,'B4'),(4,2,'D5'),(6,1,'B4'),(8,4,'G4')], [(0,2,'F4'),(3,1,'A4'),(4,2,'C5'),(6,1,'A4'),(8,4,'F4')],
                 [(0,2,'E4'),(3,1,'G4'),(4,2,'C5'),(6,1,'G4'),(8,4,'E4')], [(0,2,'F#4'),(3,1,'A4'),(4,2,'C5'),(6,1,'A4'),(8,2,'F#4')]], vel=82)
chatter(68, 'mar', 66); chatter(69, 'mar', 66)
for i, t in enumerate([2.5, 3, 3.25, 3.5, 3.75]): drum(4 * 71 + t, [TOM_HH, TOM_H, TOM_M, SNARE, SNARE][i], 70 + i * 10, 0.12, force=True)

if _warn: print('Hinweis, Töne außerhalb Tonleiter:', sorted(set(_warn)))
sf2, out = cli_paths('bgm_theme_monkees.ogg'); song.render(sf2, out)
