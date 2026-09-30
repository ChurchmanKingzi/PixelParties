# -*- coding: utf-8 -*-
"""Theme „Cute“ – „Sugar Rush Showdown“ → public/music/bgm_theme_cute.ogg

Kawaii-Chiptune-Kampf in C-Dur (Refrain in D-Dur), 168 BPM, 80 Takte (114,3 s), nahtlos loopbar.
Hüpfende Square-/Glockenspiel-Melodie, Pizzicato-Offbeats, Xylophon-16tel-Arpeggien, Marimba-Gegenstimme,
Kalimba/Ocarina/Pfeife als Zuckerguss; darunter ein echter Beat (Kick/Snare/Clap, laute Hi-Hat, Kuhglocke).

Aufbau (Takte, 0-basiert):
   0– 7  Intro      Beat, hüpfender Square-Bass, Pizzicato, Xylophon-Arpeggien, Pfeife neckt das Motiv (I-vi-IV-V)
   8–23  Thema A    Square + Glockenspiel: Hüpf-Motiv über I-vi-IV-V / I-iii-IV-V, Marimba-Gegenstimme
  24–39  Teil B     Punktierte „Zuckerwatte“-Melodie (Calliope), vi-IV-I-V / vi-IV-ii-V, Kuhglocke, zweiter Durchgang mit Pfeife
  40–55  Refrain C  Tonartwechsel nach D-Dur (Kawaii-Key-Change): Thema A überdreht, Pfeifen-Läufe, 16tel-Xylophon
  56–63  Break D    Kalimba/Ocarina, leiser Beat (Seitenstock + Kuhglocke), vi-IV-I-V in D
  64–71  Aufbau E   D-Dur, steigende Sequenz + Snare-Wirbel
  72–79  Rückweg F  zurück nach C (Dm-G-C-Am | F-Dm-G-G), endet auf der Dominante → Sprung zum Intro
Kein Schlussakkord. Aufruf:  python3 scripts/music/theme_cute.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 168, 80                        # 80 × 4 × 60/168 = 114,3 s
song = Song(bpm=BPM, bars=BARS)
song.inst('bass',   'sbass',   100, 60)
song.inst('pizz',   'pizz',     92, 44)
song.inst('xylo',   'xylo',     78, 82)
song.inst('marimba','marimba',  84, 36)
song.inst('lead',   'square',   80, 64)
song.inst('glock',  'glock',    82, 74)
song.inst('calli',  'calliope', 84, 56)
song.inst('whistle','whistle',  78, 90)
song.inst('ocarina','ocarina',  86, 50)
song.inst('kalimba','kalimba',  88, 70)

MAJ = [0, 2, 4, 5, 7, 9, 11]
def dp(d, T): return 60 + T + 12 * (d // 7) + MAJ[d % 7]        # Stufe d (0 = C4) in Tonart T
def pcs(r, T): return {(T + MAJ[(r + k) % 7]) % 12 for k in (0, 2, 4)}
I, II, III, IV, V, VI = 0, 1, 2, 3, 4, 5
BAD = []

def mel(inst, b, r, T, notes, vel, shift=0, strict=True):
    """notes = [(beat, dauer, stufe)], Stufe 7 = C5. Ganzzahlige Zählzeiten müssen Akkordtöne sein."""
    for off, dur, d in notes:
        p = dp(d, T)
        if strict and off % 1 == 0 and p % 12 not in pcs(r, T): BAD.append((b, off, d))
        song.add(inst, song.bar(b) + off, dur * 0.9, p + shift, vel + (8 if off == 0 else 0))

def bass(b, r, T, vel=98):
    p = 36 + T + MAJ[r]
    if p >= 46: p -= 12
    s = song.bar(b)
    for off, q in ((0, p), (0.5, p + 12), (1, p), (1.5, p + 12), (2, p), (2.5, p + 7), (3, p + 12), (3.5, p + 7)):
        song.add('bass', s + off, 0.38, q, vel + (8 if off in (0, 2) else -6))

def pizz(b, r, T, vel=80):
    for off in (0.5, 1.5, 2.5, 3.5):
        for k in (0, 2, 4): song.add('pizz', song.bar(b) + off, 0.3, dp(r + k + 7, T) - 12 if k == 0 else dp(r + k + 7, T) - 12, vel)

def arp(b, r, T, vel=60, inst='xylo', up=7):
    for i in range(16):
        song.add(inst, song.bar(b) + i * 0.25, 0.22, dp(r + up + (0, 2, 4, 7)[i % 4], T), vel + (10 if i % 4 == 0 else 0))

# ---- Melodien (Stufe 7 = C5): Akkordfolge I vi IV V | I iii IV V ------------------------------
def A_bar(kind, var=0):
    if kind == 'I':   return [(0, .5, 9), (.5, .5, 11), (1, .5, 14), (1.5, .5, 11), (2, 1, 9), (3, .5, 11), (3.5, .5, 9)]
    if kind == 'vi':  return [(0, .5, 12), (.5, .5, 14), (1, .5, 16), (1.5, .5, 14), (2, 1, 12), (3, .5, 14), (3.5, .5, 12)]
    if kind == 'IV':  return [(0, .5, 10), (.5, .5, 12), (1, .5, 14), (1.5, .5, 12), (2, 1, 10), (3, .5, 12), (3.5, .5, 14)]
    if kind == 'iii': return [(0, .5, 9), (.5, .5, 11), (1, .5, 13), (1.5, .5, 11), (2, 1, 9), (3, 1, 11)]
    if kind == 'V':   return [(0, .5, 11), (.5, .5, 13), (1, .5, 15), (1.5, .5, 13), (2, 1, 11), (3, 1, 15)] if var == 0 else \
                             [(0, .5, 15), (.5, .5, 13), (1, .5, 11), (1.5, .5, 13), (2, 2, 15)]
ROOT = {'I': I, 'ii': II, 'iii': III, 'IV': IV, 'V': V, 'vi': VI}
PROG_A1 = ['I', 'vi', 'IV', 'V']; PROG_A2 = ['I', 'iii', 'IV', 'V']

B_MEL = {  # punktierte Melodie, je Akkord
    'vi': [(0, 1.5, 12), (1.5, .5, 14), (2, 1, 16), (3, 1, 14)],
    'IV': [(0, 1.5, 14), (1.5, .5, 12), (2, 1, 10), (3, 1, 12)],
    'I':  [(0, 1.5, 11), (1.5, .5, 9), (2, 1, 11), (3, 1, 14)],
    'V':  [(0, 1, 13), (1, 1, 11), (2, 1, 13), (3, 1, 15)],
}
B_MEL2 = {
    'vi': [(0, .5, 16), (.5, .5, 14), (1, 1, 12), (2, .5, 14), (2.5, .5, 16), (3, 1, 16)],
    'IV': [(0, .5, 14), (.5, .5, 12), (1, 1, 10), (2, .5, 12), (2.5, .5, 14), (3, 1, 17)],
    'ii': [(0, 1, 15), (1, 1, 17), (2, 1, 15), (3, 1, 12)],
    'V':  [(0, .5, 13), (.5, .5, 15), (1, 1, 13), (2, .5, 11), (2.5, .5, 13), (3, 1, 15)],
}
CH_TONES = {  # generisches Motiv aus Akkordtönen (Break/Aufbau/Rückweg)
    0: [(0, 1, 4), (1, 1, 2), (2, 1, 4), (3, 1, 7)],
    1: [(0, .5, 0), (.5, .5, 2), (1, .5, 4), (1.5, .5, 7), (2, 1, 4), (3, 1, 2)],
    2: [(0, .5, 2), (.5, .5, 4), (1, .5, 7), (1.5, .5, 9), (2, 1, 11), (3, .5, 9), (3.5, .5, 7)],
}
def tones(r, kind): return [(o, d, r + 7 + k) for o, d, k in CH_TONES[kind]]

# ---- Schlagzeug -----------------------------------------------------------------------------
def groove(b, kind, v=1.0):
    s = song.bar(b)
    def d(off, note, vel): song.dr(s + off, note, min(127, vel * v))
    if kind in ('A', 'B', 'C'):
        for off, vel in ((0, 112), (2, 102), (2.5, 88)): d(off, KICK, vel)
        if kind != 'A': d(1.5, KICK, 92)
        d(1, SNARE, 108); d(3, SNARE, 110); d(3, CLAP, 92)
        for i in range(8): d(i * 0.5, HAT, 112 if i % 2 == 0 else 92)
        if kind == 'B': d(0.5, COWBELL, 84); d(2.5, COWBELL, 80)
        if kind == 'C':
            d(1, CLAP, 90); d(3.5, COWBELL, 90); d(0.5, COWBELL, 76); d(3.75, TOM_H, 96); d(2.25, SIDESTICK, 84)
        if kind == 'A': d(3.5, COWBELL, 80)
    elif kind == 'soft':
        d(0, KICK, 96); d(2, KICK, 88); d(1, SIDESTICK, 100); d(3, SIDESTICK, 104)
        for i in range(8): d(i * 0.5, HAT, 104 if i % 2 == 0 else 84)
        d(1.5, COWBELL, 78); d(3.5, COWBELL, 82)
def fill(b, big=False):
    s = song.bar(b)
    for i in range(8): song.dr(s + 2 + i * 0.25, (TOM_H, TOM_HH, TOM_M, TOM_L)[min(3, i // 2)], 88 + i * 4, 0.2)
    song.dr(s + 3.75, KICK, 118)
    if big:
        for i in range(8): song.dr(s + i * 0.25, SNARE, 70 + i * 6, 0.12)
def roll(b, a, z, v0, v1):
    cnt = int((z - a) * 4)
    for i in range(cnt): song.dr(song.bar(b) + a + i * 0.25, SNARE, v0 + (v1 - v0) * i / max(1, cnt - 1), 0.15)
def crash(b, vel=112): song.dr(song.bar(b), CRASH, vel, 0.5)

# ==== Arrangement ==============================================================================
T0, T1 = 0, 2                                              # C-Dur, D-Dur
# ---- Intro 0–7 ---------------------------------------------------------------------------------
for i in range(8):
    k = PROG_A1[i % 4]; r = ROOT[k]
    bass(i, r, T0, 92 + i); pizz(i, r, T0, 76 + i * 2); arp(i, r, T0, 56 + i * 2)
    groove(i, 'A', 0.92 + i * 0.01)
    if i < 4: song.add('glock', song.bar(i), 3.5, dp(r + 14, T0), 84)
    else: mel('whistle', i, r, T0, A_bar(k)[:4] + [(3, 1, A_bar(k)[-1][2])], 82)
crash(0, 108); fill(3); roll(7, 1, 4, 60, 108); fill(7, True)
# ---- Thema A 8–23 -------------------------------------------------------------------------------
crash(8, 114)
for i in range(16):
    b = 8 + i; sec2 = i >= 8; k = (PROG_A2 if sec2 else PROG_A1)[i % 4]; r = ROOT[k]
    bass(b, r, T0, 100); pizz(b, r, T0, 82); arp(b, r, T0, 52 if not sec2 else 62)
    groove(b, 'A', 1.0 + (0.05 if sec2 else 0))
    notes = A_bar(k, 1 if (sec2 and k == 'V') else 0)
    mel('lead', b, r, T0, notes, 92); mel('glock', b, r, T0, notes, 78, 12)
    song.add('marimba', song.bar(b), 1.9, dp(r + 2, T0), 76); song.add('marimba', song.bar(b) + 2, 1.9, dp(r + 4, T0), 72)
    if sec2: mel('whistle', b, r, T0, [(3.5, .5, r + 14)], 70, strict=False)
fill(15); fill(19); roll(23, 1, 4, 60, 112); fill(23, True)
# ---- Teil B 24–39 -------------------------------------------------------------------------------
crash(24, 116)
PB1 = ['vi', 'IV', 'I', 'V', 'vi', 'IV', 'I', 'V']; PB2 = ['vi', 'IV', 'I', 'V', 'vi', 'IV', 'ii', 'V']
for i in range(16):
    b = 24 + i; sec2 = i >= 8; k = (PB2 if sec2 else PB1)[i % 8]; r = ROOT[k]
    bass(b, r, T0, 100); pizz(b, r, T0, 84); arp(b, r, T0, 54, 'kalimba' if not sec2 else 'xylo')
    groove(b, 'B', 1.0 + (0.05 if sec2 else 0))
    m = (B_MEL2 if (sec2 or i % 8 >= 4) else B_MEL)[k] if k in (B_MEL2 if (sec2 or i % 8 >= 4) else B_MEL) else B_MEL[k]
    mel('calli', b, r, T0, m, 92); mel('glock', b, r, T0, m, 72, 12)
    if sec2: mel('whistle', b, r, T0, m, 68, 12)
    song.add('marimba', song.bar(b) + 1.5, 0.4, dp(r + 4, T0), 66); song.add('marimba', song.bar(b) + 3.5, 0.4, dp(r + 7, T0), 68)
fill(31); fill(35); roll(38, 1, 4, 60, 108); roll(39, 0, 3, 90, 124); fill(39, True)
# ---- Refrain C 40–55 (D-Dur) ---------------------------------------------------------------------
crash(40, 122); crash(48, 116)
for i in range(16):
    b = 40 + i; sec2 = i >= 8; k = (PROG_A2 if sec2 else PROG_A1)[i % 4]; r = ROOT[k]
    bass(b, r, T1, 106); pizz(b, r, T1, 88); arp(b, r, T1, 66)
    groove(b, 'C', 1.0 + (0.04 if sec2 else 0))
    notes = A_bar(k, 1 if (sec2 and k == 'V') else 0)
    mel('lead', b, r, T1, notes, 96); mel('glock', b, r, T1, notes, 86, 12); mel('calli', b, r, T1, notes, 76)
    song.add('marimba', song.bar(b), 1.9, dp(r + 4, T1), 76); song.add('marimba', song.bar(b) + 2, 1.9, dp(r + 7, T1), 72)
    for j, d in enumerate((r + 14, r + 16, r + 18, r + 21)):
        song.add('whistle', song.bar(b) + 3 + j * 0.25, 0.22, dp(d, T1), 74 if not sec2 else 84)
fill(43); fill(47); fill(51); roll(54, 1, 4, 70, 110); roll(55, 0, 3, 100, 127); fill(55, True)
# ---- Break D 56–63 (D-Dur: vi IV I V | vi IV V V) -----------------------------------------------
crash(56, 100)
PD = ['vi', 'IV', 'I', 'V', 'vi', 'IV', 'V', 'V']
for i, k in enumerate(PD):
    b = 56 + i; r = ROOT[k]
    bass(b, r, T1, 90); pizz(b, r, T1, 80); arp(b, r, T1, 62, 'kalimba')
    groove(b, 'soft', 1.0)
    mel('ocarina', b, r, T1, tones(r, 0 if i % 2 == 0 else 1), 84)
    if i >= 4: song.add('glock', song.bar(b), 3.9, dp(r + 14, T1), 70 + i * 3)
fill(63)
# ---- Aufbau E 64–71 (D-Dur: I vi IV V | I vi IV V) -----------------------------------------------
crash(64, 108)
for i in range(8):
    b = 64 + i; k = ['I', 'vi', 'IV', 'V'][i % 4]; r = ROOT[k]
    bass(b, r, T1, 100 + i); pizz(b, r, T1, 84); arp(b, r, T1, 64 + i * 2)
    if i < 6: groove(b, 'B', 1.0 + i * 0.01)
    mel('lead', b, r, T1, tones(r, 1 if i < 4 else 2), 90 + i); mel('glock', b, r, T1, tones(r, 1 if i < 4 else 2), 76, 12)
    if i >= 4: mel('calli', b, r, T1, tones(r, 2), 78)
roll(70, 0, 4, 60, 100); roll(71, 0, 3, 90, 127); fill(71, True)
# ---- Rückweg F 72–79 (zurück nach C: ii V I vi | IV ii V V) ----------------------------------------
crash(72, 114)
PF = ['ii', 'V', 'I', 'vi', 'IV', 'ii', 'V', 'V']
for i, k in enumerate(PF):
    b = 72 + i; r = ROOT[k]
    bass(b, r, T0, 102); pizz(b, r, T0, 86); arp(b, r, T0, 66)
    groove(b, 'C', 0.96)
    m = tones(r, 2 if i in (2, 6) else 1)
    mel('lead', b, r, T0, m, 94); mel('glock', b, r, T0, m, 80, 12); mel('whistle', b, r, T0, [(3.5, .5, r + 14)], 70, strict=False)
fill(75); fill(78); roll(79, 0, 3, 80, 118); fill(79, True)

assert not BAD, BAD
sf2, out = cli_paths('bgm_theme_cute.ogg')
song.render(sf2, out)
