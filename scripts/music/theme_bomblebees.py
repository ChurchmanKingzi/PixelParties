# -*- coding: utf-8 -*-
"""Battle-Theme „Buzzbomb Blitz“ (Archetyp Bomblebees) → public/music/bgm_theme_bomblebees.ogg

Bienenbomber-Angriff in h-Moll, 172 BPM, 84 Takte (117,2 s), nahtlos loopbar.
Hummelflug: chromatische 16tel-Läufe in Violine und Klarinette (Summen), Sturzflug-Glissandi
(Pfeife/Violine fallen), Bombeneinschläge (Pauke, Orchester-Hit, Kick, Crash) und die brennende
Lunte: Ticken (Sidestick/Cowbell), das von Vierteln über Achtel zu 16teln beschleunigt.

Aufbau (Takte, 0-basiert):
   0– 7  Intro       Lunte tickt (Viertel→Achtel), Saw-Bass-Ostinato, erstes Summen, Bombe auf Takt 0
   8–23  Thema A     Violine: Flugmotiv (chromatischer Lauf + Bombenrhythmus), Klarinette-Gegenstimme,
                     Progression Hm–G–D–A, pumpender Bass, Kick/Snare-Groove
  24–39  Sturzflug B Fallende Glissandi (Pfeife/Violine), Blech-Stabs auf Hm–Em–F#, Pauken-Bomben,
                     Lunte in 16teln, steigende Spannung
  40–55  Teppich C   Carpet-Bombing: Saw-Lead + Violine im Oktavlauf, Timpani/Kick-16tel, Crashes
  56–71  Lunte D     Break-Passage: Pfeifen fallender Bomben, Cowbell-Ticken beschleunigt, Bass drückt,
                     Detonation auf Takt 64, danach Nachbeben
  72–83  Rückführung Aufbau (Läufe steigen, Snare-Wirbel), Dominante F# → Sprung auf Takt 0
Läufe sind chromatisch, landen aber immer auf Akkord-/Skalentönen; Motiv-, Bass- und Zieltöne
werden gegen h-Moll (harmonisch, mit Ais) geprüft.
Aufruf:  python3 scripts/music/theme_bomblebees.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 172, 84                      # 84 × 4 × 60/172 = 117,2 s
song = Song(bpm=BPM, bars=BARS)
song.inst('sub',     'squarebass', 92, 64)
song.inst('bass',    'sbass',     100, 60)
song.inst('acid',    'acidbass',   80, 68)
song.inst('violin',  'violin',     96, 58)
song.inst('violin2', 'violin',     84, 76)
song.inst('clar',    'clarinet',   88, 40)
song.inst('saw',     'saw',        78, 88)
song.inst('brass',   'sbrass',     86, 52)
song.inst('whistle', 'whistle',    84, 74)
song.inst('tremolo', 'tremolo',    70, 30)
song.inst('marimba', 'marimba',    84, 92)
song.inst('timp',    'timp',      100, 64)
song.inst('hit',     'hit',       104, 64)

SC = {B, Db, D, E, Gb, G, A, Bb}      # h-Moll (natürlich + Fis-Dur-Dominante: Cis, Ais)
NAMES = {'C': C, 'Db': Db, 'D': D, 'Eb': Eb, 'E': E, 'F': F, 'Gb': Gb, 'G': G, 'Ab': Ab, 'A': A, 'Bb': Bb, 'B': B}
def nt(s): return n(NAMES[s[:-1]], int(s[-1]))
def chk(p): assert p % 12 in SC, f'Ton außerhalb h-Moll: {p}'; return p
def vp(x, lo=1, hi=127):
    return max(lo, min(hi, int(x)))

# Akkord: Grundton-Pitchclass, Terz-Intervall (Moll 3 / Dur 4)
CH = {'Bm': (B, 3), 'G': (G, 4), 'D': (D, 4), 'A': (A, 4), 'Em': (E, 3), 'Gb': (Gb, 4)}
def rt(ch, o): return n(CH[ch][0], o)
def tones(ch, o):
    r = rt(ch, o); return [r, r + CH[ch][1], r + 7]
def ct(ch, o):
    """Akkordtöne über mehrere Oktaven ab Oktave o (aufsteigend, 6 Stück)."""
    t = tones(ch, o); return t + [x + 12 for x in t]
# Zielton der Läufe je Akkord (Grundton bzw. Terz), Register 5
TARGET = {'Bm': 'D6', 'G': 'D6', 'D': 'A5', 'A': 'E6', 'Em': 'G5', 'Gb': 'Gb6'}

def note(inst, b, beat, dur, p, vel): song.add(inst, song.bar(b) + beat, dur, p, vel)

# ---- Hummelflug: chromatischer Lauf ---------------------------------------------------
def buzz(inst, b, beat, hi, lo, vel, step=0.25, stay=None):
    """Chromatischer Lauf von hi abwärts zu lo (MIDI), Zielton lo wird chk-geprüft; 16tel."""
    chk(lo)
    p = hi; t = song.bar(b) + beat; i = 0
    seq = list(range(hi, lo - 1, -1))
    for i, pp in enumerate(seq):
        song.add(inst, t + i * step, step * 1.05, pp, vp(vel + (8 if i == 0 else 0) - i * 0.5, 1, 127))
    return len(seq) * step
def zigzag(inst, b, beat, center, vel, cnt=8, step=0.25):
    """Flattern um einen Ton (c, c-1, c, c+1 …) – Summen auf der Stelle; center wird geprüft."""
    chk(center)
    pat = [0, -1, 0, 1]
    for i in range(cnt): song.add(inst, song.bar(b) + beat + i * step, step * 1.05, center + pat[i % 4], vp(vel + (8 if i % 4 == 0 else 0), 1, 127))
def rise(inst, b, beat, lo, hi, vel, step=0.25):
    chk(hi)
    for i, pp in enumerate(range(lo, hi + 1)): song.add(inst, song.bar(b) + beat + i * step, step * 1.05, pp, vp(vel + i * 0.7, 1, 127))
def dive(inst, b, beat, hi, lo, vel, step=0.125):
    """Sturzflug: schnelles Glissando (32tel) abwärts."""
    chk(lo)
    for i, pp in enumerate(range(hi, lo - 1, -1)): song.add(inst, song.bar(b) + beat + i * step, step * 1.3, pp, vp(vel - i * 0.4, 1, 127))

# ---- Begleitung --------------------------------------------------------------------
def bass_pump(b, ch, vel=100, lvl=1):
    """Achtel-Pumpbass (Oktave 1–2) mit Oktavsprung; lvl 2 = 16tel-Sprengung."""
    s = song.bar(b); r = rt(ch, 2)
    if r > 47: r -= 12
    chk(r)
    if lvl == 1:
        for i in range(8):
            note('bass', b, i * 0.5, 0.42, r + (12 if i % 4 == 3 else 0), vel + (8 if i % 2 == 0 else -8))
    else:
        pat = [0, 0, 12, 0, 0, 12, 0, 7]
        for i in range(16): note('bass', b, i * 0.25, 0.22, chk(r + pat[i % 8]), vel + (10 if i % 4 == 0 else -6))
    note('sub', b, 0, 3.9, chk(r - 12 if r - 12 >= 28 else r), 88)
def acid_off(b, ch, vel=80):
    r = rt(ch, 3)
    for off in (0.5, 1.5, 2.5, 3.5): note('acid', b, off, 0.3, chk(r), vel)
def stabs(b, ch, vel=88, beats=(0, 1.5, 3)):
    for off in beats:
        for p in tones(ch, 4): note('brass', b, off, 0.7, chk(p), vel + (8 if off == 0 else 0))
def marimba8(b, ch, vel=78):
    t = ct(ch, 4)
    for i in range(8): note('marimba', b, i * 0.5, 0.35, chk(t[[0, 2, 1, 2, 3, 2, 1, 2][i]]), vel + (8 if i % 2 == 0 else 0))
def tremolo(b, ch, vel=64):
    for p in tones(ch, 4): note('tremolo', b, 0, 3.98, chk(p), vel)
def bomb(b, beat=0, ch='Bm', vel=118, big=True):
    """Bombeneinschlag: Timpani + Hit + Kick (+ Crash)."""
    s = song.bar(b) + beat
    song.add('timp', s, 1.0, chk(n(CH[ch][0], 2) if n(CH[ch][0], 2) <= 47 else n(CH[ch][0], 1)), vel)
    for p in tones(ch, 3): song.add('hit', s, 0.6, chk(p), vel - 6)
    song.dr(s, KICK, vel)
    if big: song.dr(s, CRASH, vel - 6, 0.5)

# ---- Schlagzeug / Lunte ----------------------------------------------------------------
def fuse(b, level, v=1.0):
    """Lunte: level 0 = Viertel Sidestick, 1 = Achtel, 2 = 16tel Cowbell/Sidestick (Ticken beschleunigt)."""
    s = song.bar(b)
    if level == 0:
        for i in range(4): song.dr(s + i, SIDESTICK, (100 if i == 0 else 90) * v)
    elif level == 1:
        for i in range(8): song.dr(s + i * 0.5, SIDESTICK if i % 2 == 0 else COWBELL, (98 if i % 2 == 0 else 86) * v)
    else:
        for i in range(16): song.dr(s + i * 0.25, SIDESTICK if i % 2 == 0 else COWBELL, (96 if i % 4 == 0 else 84) * v, 0.1)
def groove(b, kind, v=1.0):
    s = song.bar(b)
    def d(off, nn, vel): song.dr(s + off, nn, min(127, vel * v))
    if kind == 'A':          # treibend, vierteln-Kick + Snare auf 2/4 + Achtel-Toms
        for i in range(4): d(i, KICK, 112 if i % 2 == 0 else 96)
        d(1, SNARE, 108); d(3, SNARE, 110)
        d(1.5, TOM_H, 80); d(3.5, TOM_H, 82)
        for i in range(8): d(i * 0.5, HAT, 84 if i % 2 == 0 else 64)
    elif kind == 'B':        # Bomben-Fall: Kick-Achtelgruppen
        for off in (0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5): d(off, KICK, 104 if off % 1 == 0 else 88)
        d(1, SNARE, 112); d(3, SNARE, 114); d(1, CLAP, 90); d(3, CLAP, 92)
        d(2.5, TOM_M, 92); d(3.75, TOM_L, 96)
        for i in range(8): d(i * 0.5, HAT, 80 if i % 2 == 0 else 60)
    elif kind == 'C':        # Teppich: 16tel-Kick-Salven, Snare-Backbeat
        for off in (0, 0.25, 0.75, 1, 1.5, 2, 2.25, 2.75, 3, 3.5): d(off, KICK, 110 if off % 1 == 0 else 92)
        d(1, SNARE, 116); d(3, SNARE, 118); d(1, CLAP, 96); d(3, CLAP, 98)
        for i in range(8): d(i * 0.5, COWBELL if i % 2 == 0 else HAT, 78 if i % 2 == 0 else 72)
    elif kind == 'D':        # Lunte-Groove im Break: Kick auf 1 und 3, ticken
        d(0, KICK, 108); d(2, KICK, 104); d(2.75, KICK, 90)
        d(1, SNARE, 100); d(3, SNARE, 104)
def fill(b, v=1.0, hard=True):
    s = song.bar(b)
    for i, nn in enumerate([TOM_H, TOM_HH, TOM_M, TOM_L, TOM_H, TOM_M, TOM_L, KICK]):
        song.dr(s + 2.0 + i * 0.25, nn, min(127, (90 + i * 4) * v), 0.15)
def roll(b, start, end, v0, v1, nn=SNARE):
    s = song.bar(b) + start; cnt = int((end - start) * 4)
    for i in range(cnt): song.dr(s + i * 0.25, nn, v0 + (v1 - v0) * i / max(1, cnt - 1), 0.12)

# ---- Melodie: Flugmotiv ---------------------------------------------------------------
# Ein Takt Motiv: Lauf 8 16tel (2 Schläge) abwärts auf den Zielton, dann Bombenrhythmus
def flight(b, ch, inst='violin', vel=96, hi_shift=0):
    tgt = nt(TARGET[ch]) + hi_shift
    buzz(inst, b, 0, tgt + 7, tgt, vel)                    # 8 Töne, 2 Schläge
    # Bombenrhythmus: Zielton (Kurz-kurz-lang) , dann Quinte
    note(inst, b, 2.0, 0.4, chk(tgt), vel + 6); note(inst, b, 2.5, 0.4, chk(tgt), vel)
    note(inst, b, 3.0, 0.9, chk(tgt), vel + 8)
def flight_hi(b, ch, inst='violin', vel=100):
    """Variante: zwei Läufe (hoch/tief) pro Takt."""
    tgt = nt(TARGET[ch])
    buzz(inst, b, 0, tgt + 5, tgt, vel); buzz(inst, b, 2, tgt + 5, tgt - 5 if (tgt - 5) % 12 in SC else tgt - 4, vel + 4)
def counter(b, ch, vel=84):
    """Klarinette: Gegenstimme, Halbe Noten + Auftakt-Summen."""
    t = ct(ch, 4)
    note('clar', b, 0, 1.9, chk(t[1]), vel); note('clar', b, 2, 1.9, chk(t[2]), vel + 4)

PROG_A = ['Bm', 'G', 'D', 'A'] * 2
PROG_B = ['Bm', 'G', 'Em', 'Gb'] * 2
PROG_C = ['Bm', 'G', 'D', 'A', 'Bm', 'G', 'Em', 'Gb', 'G', 'D', 'A', 'Bm', 'G', 'A', 'Em', 'Gb']

# ==== Arrangement ==========================================================================
# ---- Intro 0–7: Lunte + Summen ----------------------------------------------------------
bomb(0, 0, 'Bm', 122)
PI = ['Bm', 'Bm', 'G', 'G', 'D', 'D', 'A', 'Gb']
for i, ch in enumerate(PI):
    b = i
    fuse(b, 0 if i < 3 else 1, 1.0 + i * 0.02)
    if i >= 2: groove(b, 'A', 0.85 + i * 0.03)
    else: song.dr(song.bar(b), KICK, 96); song.dr(song.bar(b) + 2, KICK, 90)
    bass_pump(b, ch, 84 + i * 3)
    tremolo(b, ch, 60 + i * 4)
    if i >= 1: zigzag('violin', b, 0, chk(nt(TARGET[ch]) - (12 if ch in ('Bm', 'G') else 0)), 76 + i * 3, cnt=16 if i >= 4 else 8)
    if i >= 2: acid_off(b, ch, 70 + i * 3)
    if i >= 4: marimba8(b, ch, 70 + (i - 4) * 4)
roll(7, 1, 4, 60, 110, SNARE); fill(7, 1.1)

# ---- Thema A 8–23 -----------------------------------------------------------------------
bomb(8, 0, 'Bm', 118)
for i in range(16):
    b, k = 8 + i, i % 8
    ch = PROG_A[k]; second = i >= 8
    fuse(b, 1, 0.8)
    groove(b, 'A', 1.0 + (0.05 if second else 0))
    bass_pump(b, ch, 96 + (4 if second else 0))
    acid_off(b, ch, 74)
    (flight if k % 2 == 0 else flight_hi)(b, ch, 'violin', 96 + (4 if second else 0))
    counter(b, ch, 80)
    if second:
        (flight if k % 2 == 0 else flight_hi)(b, ch, 'violin2', 76)
        marimba8(b, ch, 78); tremolo(b, ch, 64)
    if k in (3, 7): fill(b, 1.0 + 0.05 * second)
    if k == 0 and i: song.dr(song.bar(b), CRASH, 104, 0.5)
roll(23, 0, 3.5, 70, 120, SNARE); fill(23, 1.1)

# ---- Sturzflug B 24–39 -------------------------------------------------------------------
bomb(24, 0, 'Bm', 120)
for i in range(16):
    b, k = 24 + i, i % 8
    ch = PROG_B[k]; second = i >= 8
    fuse(b, 2 if second else 1, 0.8)
    groove(b, 'B', 1.0 + (0.05 if second else 0))
    bass_pump(b, ch, 100, 2 if second else 1)
    stabs(b, ch, 84 + (6 if second else 0), (0, 1.5, 3) if not second else (0, 0.75, 1.5, 2.25, 3))
    tremolo(b, ch, 70); acid_off(b, ch, 78)
    if k % 2 == 0:
        dive('whistle', b, 0, chk(nt(TARGET[ch]) + 12), nt(TARGET[ch]) - 5 if (nt(TARGET[ch]) - 5) % 12 in SC else nt(TARGET[ch]) - 4, 82 + (6 if second else 0))
        dive('violin', b, 0, chk(nt(TARGET[ch]) + 7), chk(nt(TARGET[ch]) - 12 + (0)), 92)
    else:
        flight_hi(b, ch, 'violin', 98 + (4 if second else 0))
        counter(b, ch, 84)
    if k in (3, 7):
        fill(b, 1.05)
        bomb(b, 3.5, ch, 108, big=False)
    if k == 0 and i: song.dr(song.bar(b), CRASH, 108, 0.5)
roll(38, 0, 4, 60, 110, SNARE); roll(39, 0, 3.5, 90, 127, SNARE); fill(39, 1.15)

# ---- Teppich C 40–55 ---------------------------------------------------------------------
bomb(40, 0, 'Bm', 124)
for i in range(16):
    b = 40 + i; ch = PROG_C[i]
    fuse(b, 1, 0.7)
    groove(b, 'C', 1.0 + (0.04 if i >= 8 else 0))
    bass_pump(b, ch, 104, 2)
    acid_off(b, ch, 80); stabs(b, ch, 88, (0, 1.5, 3)); marimba8(b, ch, 80); tremolo(b, ch, 72)
    (flight if i % 2 == 0 else flight_hi)(b, ch, 'violin', 104)
    tgt = nt(TARGET[ch])
    # Saw-Lead: Bombenrhythmus in Oktave darüber, Klarinette im Lauf-Echo
    for off, d_ in ((0, 0.4), (0.5, 0.4), (1.0, 0.9)): note('saw', b, off, d_, chk(tgt + 12 if tgt + 12 <= 96 else tgt), 84)
    counter(b, ch, 88)
    if i % 4 == 0 and i: song.dr(song.bar(b), CRASH, 110, 0.5)
    if i % 4 == 3: fill(b, 1.1); bomb(b, 3.5, ch, 110, big=False)
roll(54, 0, 4, 70, 112, SNARE); roll(55, 0, 3.5, 100, 127, SNARE); fill(55, 1.15)

# ---- Lunte D 56–71: Pfeifen, Ticken, Detonation auf 64 ---------------------------------------
PD = ['Bm', 'Bm', 'G', 'G', 'D', 'D', 'A', 'A'] + ['Bm', 'G', 'Bm', 'G', 'D', 'A', 'Em', 'Gb']
bomb(56, 0, 'Bm', 112)
for i in range(16):
    b = 56 + i; ch = PD[i]
    if i < 8:
        fuse(b, 1 if i < 4 else 2, 0.95)
        groove(b, 'D', 1.0)
        bass_pump(b, ch, 92, 1)
        tremolo(b, ch, 66 + i * 3)
        if i % 2 == 0: dive('whistle', b, 0, chk(nt(TARGET[ch]) + 12), chk(nt(TARGET[ch]) - 12), 84)
        zigzag('violin', b, 2, chk(nt(TARGET[ch])), 80 + i * 2, cnt=8)
        if i >= 4: marimba8(b, ch, 74)
        counter(b, ch, 78)
    else:
        if i == 8: bomb(b, 0, 'Bm', 127); song.dr(song.bar(b), CRASH, 120, 1.0)
        groove(b, 'B' if i < 12 else 'C', 1.0)
        fuse(b, 1, 0.7)
        bass_pump(b, ch, 102, 2 if i >= 10 else 1)
        stabs(b, ch, 86, (0, 1.5, 3)); acid_off(b, ch, 78); tremolo(b, ch, 70)
        (flight if i % 2 == 0 else flight_hi)(b, ch, 'violin', 100)
        if i >= 12: flight_hi(b, ch, 'clar', 82)
        else: counter(b, ch, 84)
        if i % 4 == 3: fill(b, 1.08)
fill(63, 1.1); roll(63, 0, 2, 70, 100, SNARE)

# ---- Rückführung E 72–83: Aufbau, Dominante Fis ---------------------------------------------------
PE = ['Bm', 'G', 'Bm', 'G', 'Em', 'Em', 'Gb', 'Gb', 'Gb', 'Gb', 'Gb', 'Gb']
for i, ch in enumerate(PE):
    b = 72 + i
    fuse(b, 1 if i < 6 else 2, 0.9)
    if i < 8: groove(b, 'B', 0.95)
    else: roll(b, 0, 4, 60 + (i - 8) * 14, 90 + (i - 8) * 8, SNARE)
    bass_pump(b, ch, 96 + i * 2, 2 if i >= 4 else 1)
    stabs(b, ch, 80 + i * 2, (0, 1.5, 3)) if i < 8 else stabs(b, ch, 90, (0, 2))
    tremolo(b, ch, 66 + i * 3)
    acid_off(b, ch, 78)
    if i < 8: (flight if i % 2 == 0 else flight_hi)(b, ch, 'violin', 98 + i)
    else: rise('violin', b, 0, nt('Gb5') - 4, [82, 86, 88, 90][i - 8], 98 + i, step=0.25 if i < 10 else 0.125)
    if i in (3, 7): fill(b, 1.05)
song.dr(song.bar(83) + 3.75, KICK, 118)
for p in tones('Gb', 3): song.add('hit', song.bar(83) + 3.5, 0.5, chk(p), 108)

sf2, out = cli_paths('bgm_theme_bomblebees.ogg')
song.render(sf2, out)
