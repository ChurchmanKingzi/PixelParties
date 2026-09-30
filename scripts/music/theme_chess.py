# -*- coding: utf-8 -*-
"""Theme „Checkmate Gambit“ (Archetyp Chess) → public/music/bgm_theme_chess.ogg

Großmeister-Duell in d-Moll (harmonisch, Leitton cis), 120 BPM, 60 Takte (120,0 s), nahtlos loopbar.
Weiß = Klavier (rechts), Schwarz = Cembalo (links): zwei Stimmen im Dialog und Kontrapunkt über
strengen Spiccato-Streichern. Die Schachuhr tickt als Holzblock (hoch/tief) durchgehend auf jedem
Schlag; der Kontrabass geht Zug um Zug. Königs-Thema (8 Takte) wandert zwischen den Spielern.

Aufbau (Takte, 0-basiert):
   0– 7  Eröffnung        Uhr, Bass, Spiccato; Cembalo (Schwarz) eröffnet, Klavier antwortet
   8–23  Thema A          Weiß spielt das Thema, Schwarz kontert mit fallenden Arpeggien;
                          zweiter Durchgang: Rollen getauscht (Cembalo Thema, Klavier Konter)
  24–39  Mittelspiel B    Läufe im Wechsel Takt um Takt (Zug/Gegenzug), Wechsel-Harmonik F-C-Dm-B,
                          Pauken-Galopp, Toms, 16tel-Streicher
  40–51  Mattsetzung C    Thema in Klavier + Streicher + Hörner + Orgel, Cembalo-16tel-Gegenstimme,
                          Pauken/Crash, Kirchen-/Glockenschläge auf dem Matt
  52–59  Rückkehr D       Cembalo allein mit dem Thema, Klavier-Kontra, Uhr; Aufbau über Dominante A
                          (Snare-Wirbel) → Sprung auf Takt 0 (Halbschluss, keine Schlusskadenz)
Aufruf:  python3 scripts/music/theme_chess.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 120, 60                       # 60 × 4 × 60/120 = 120,0 s
song = Song(bpm=BPM, bars=BARS)
song.inst('acbass',  'acbass',  100, 62)
song.inst('timp',    'timp',     92, 64)
song.inst('pizz',    'pizz',     80, 40)
song.inst('strings', 'strings',  74, 46)   # Spiccato
song.inst('pad',     'slowstr',  60, 64)
song.inst('white',   'piano',    96, 84)   # Weiß
song.inst('black',   'harpsichord', 98, 42)  # Schwarz
song.inst('bassoon', 'bassoon',  84, 58)
song.inst('horns',   'horns',    80, 70)
song.inst('organ',   'organ2',   66, 60)
song.inst('marimba', 'marimba',  80, 74)
song.inst('bell',    'bell',     82, 64)

NAMES = {'C': C, 'Db': Db, 'D': D, 'Eb': Eb, 'E': E, 'F': F, 'Gb': Gb, 'G': G, 'Ab': Ab, 'A': A, 'Bb': Bb, 'B': B}
def nt(s):                                   # 'Cs6' = Cis6
    if s[1] == 's': return n(NAMES[s[0]], int(s[2])) + 1
    return n(NAMES[s[:-1]], int(s[-1]))
SCALE = {D, E, F, G, A, Bb, C, Db}     # d-Moll (harmonisch): d e f g a b c + Leitton cis (=Db)
CH = {'Dm': (D, [D, F, A]), 'Bb': (Bb, [Bb, D, F]), 'Gm': (G, [G, Bb, D]), 'A': (A, [A, Db, E]),
      'F': (F, [F, A, C]), 'C': (C, [C, E, G])}
def bassroot(ch):                            # Oktave 1-2 (28–43)
    p = n(CH[ch][0], 2)
    return p if p <= 43 else p - 12
def ramp(i, cnt, a, b): return a + (b - a) * i / max(1, cnt - 1)
def tones(ch, lo, hi): return sorted(p for p in range(lo, hi + 1) if p % 12 in CH[ch][1])

def line(b, notes, insts, vels, shift=0):
    for off, dur, p in notes:
        m = nt(p) + shift
        assert m % 12 in SCALE, (b, p)
        for inst, v in zip(insts, vels): song.add(inst, song.bar(b) + off, dur * 0.94, m, v + (6 if off == 0 else 0))

# ---- Thema (8 Takte über Dm Bb Gm A | Dm F Gm A) ------------------------------------------------
CH_A = ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'F', 'Gm', 'A']
SUBJ = [
    [(0,1,'D5'),(1,.5,'F5'),(1.5,.5,'A5'),(2,1,'D6'),(3,.5,'C6'),(3.5,.5,'A5')],
    [(0,1,'Bb5'),(1,.5,'A5'),(1.5,.5,'F5'),(2,1,'D5'),(3,1,'F5')],
    [(0,1,'G5'),(1,.5,'Bb5'),(1.5,.5,'D6'),(2,1,'Bb5'),(3,.5,'A5'),(3.5,.5,'G5')],
    [(0,1,'E5'),(1,.5,'G5'),(1.5,.5,'A5'),(2,1,'Cs6'),(3,1,'A5')],
    [(0,1,'F5'),(1,.5,'A5'),(1.5,.5,'D6'),(2,1,'F6'),(3,.5,'E6'),(3.5,.5,'D6')],
    [(0,1,'C6'),(1,.5,'A5'),(1.5,.5,'F5'),(2,1,'A5'),(3,1,'C6')],
    [(0,1,'Bb5'),(1,.5,'D6'),(1.5,.5,'G6'),(2,1,'F6'),(3,.5,'E6'),(3.5,.5,'D6')],
    [(0,.5,'Cs6'),(.5,.5,'D6'),(1,.5,'E6'),(1.5,.5,'F6'),(2,2,'E6')],
]
# Schlussgruppe C (Takte 8–11 des Mattsetzungs-Abschnitts): Bb | Gm | A | A
CH_C_END = ['Bb', 'Gm', 'A', 'A']
SUBJ_END = [
    [(0,1,'D6'),(1,1,'F6'),(2,1,'D6'),(3,1,'Bb5')],
    [(0,1,'Bb5'),(1,1,'D6'),(2,1,'G6'),(3,1,'F6')],
    [(0,.5,'E6'),(.5,.5,'D6'),(1,.5,'Cs6'),(1.5,.5,'A5'),(2,2,'E6')],
    [(0,1,'A5'),(1,1,'Cs6'),(2,1,'E6'),(3,1,'A6')],
]
# Eröffnungszug (Cembalo): kurzes Fragment aus dem Thema
OPEN = [[(0,1,'D5'),(1,.5,'F5'),(1.5,.5,'A5'),(2,2,'D6')], [(0,1,'C6'),(1,.5,'Bb5'),(1.5,.5,'A5'),(2,2,'F5')],
        [(0,1,'G5'),(1,.5,'Bb5'),(1.5,.5,'D6'),(2,2,'G5')], [(0,1,'E5'),(1,1,'A5'),(2,1,'Cs6'),(3,1,'E6')]]

# ---- Bausteine -------------------------------------------------------------------------------
def counter(b, ch, inst, vel, cnt=8, lo=58, hi=76):
    """Fallendes Arpeggio (Gegenzug): Akkordtöne von oben nach unten, Achtel oder 16tel."""
    pool = tones(ch, lo, hi); step = 4.0 / cnt
    for i in range(cnt): song.add(inst, song.bar(b) + i * step, step * 0.9, pool[-1 - (i % len(pool))], vel + (6 if i % 4 == 0 else 0))
def rising(b, ch, inst, vel, cnt=8, lo=60, hi=84, start=0):
    pool = tones(ch, lo, hi); step = 4.0 / cnt
    for i in range(cnt): song.add(inst, song.bar(b) + i * step, step * 0.9, pool[(start + i) % len(pool)], vel + (6 if i % 4 == 0 else 0))
def walk(b, ch, vel=98, nxt=None):
    """Bass Zug um Zug: Grundton, Quinte, Grundton, Anlauf (Terz/Halbton zum nächsten Akkord)."""
    s = song.bar(b); r = bassroot(ch); f = r + 7 if r + 7 <= 47 else r - 5
    song.add('acbass', s, 0.9, r, vel + 8); song.add('acbass', s + 1, 0.45, f, vel - 6)
    song.add('acbass', s + 2, 0.9, r, vel); song.add('acbass', s + 3, 0.45, f, vel - 8)
    tgt = bassroot(nxt) if nxt else r
    song.add('acbass', s + 3.5, 0.45, tgt + (1 if tgt < r else -1) if tgt != r else r + 12 - 12, vel - 12)
def spicc(b, ch, vel, sixteenth=False):
    ts = [p for p in tones(ch, 52, 67)]; step = 0.25 if sixteenth else 0.5
    for i in range(int(4 / step)):
        song.add('strings', song.bar(b) + i * step, step * 0.6, ts[[0, 2, 1, 2][i % 4] % len(ts)], vel + (8 if i % 4 == 0 else 0))
def pizz(b, ch, vel):
    ts = tones(ch, 48, 62)
    for i in range(8): song.add('pizz', song.bar(b) + i * 0.5, 0.3, ts[[0, 1, 2, 1][i % 4] % len(ts)], vel + (8 if i % 2 == 0 else 0))
def pad(b, ch, vel, bars=1):
    for p in tones(ch, 55, 70)[:3]: song.add('pad', song.bar(b), 4 * bars - 0.05, p, vel)
def clock(b, vel=104, marim=False):
    """Schachuhr: Holzblock auf jedem Schlag, tick (hoch) / tack (tief)."""
    for i in range(4):
        song.dr(song.bar(b) + i, 76 if i % 2 == 0 else 77, vel + (8 if i == 0 else 0), 0.1)
        if marim: song.add('marimba', song.bar(b) + i, 0.15, n(A, 6) if i % 2 == 0 else n(D, 6), 70)
def drums(b, kind, v=1.0):
    s = song.bar(b)
    def d(off, note, vel): song.dr(s + off, note, min(127, vel * v))
    if kind == 'soft':
        d(0, KICK, 96); d(2, KICK, 90); d(1, SIDESTICK, 96); d(3, SIDESTICK, 100)
        for i in range(8): d(i * 0.5, HAT, 100 if i % 2 == 0 else 84)
    elif kind == 'A':
        d(0, KICK, 110); d(2, KICK, 100); d(2.75, KICK, 84); d(1, SNARE, 100); d(3, SNARE, 106); d(1, SIDESTICK, 90)
        for i in range(8): d(i * 0.5, HAT, 108 if i % 2 == 0 else 92)
    elif kind == 'B':
        for off in (0, 1.5, 2, 3.5): d(off, KICK, 108)
        d(1, SNARE, 108); d(3, SNARE, 112); d(1, CLAP, 90); d(3, CLAP, 96)
        for i in range(8): d(i * 0.5, HAT, 112 if i % 2 == 0 else 96)
        d(2.5, TOM_M, 90)
    elif kind == 'C':
        for off in (0, 1, 2, 3): d(off, KICK, 112)
        d(0.5, TOM_L, 84); d(1, SNARE, 114); d(3, SNARE, 118); d(1, CLAP, 100); d(3, CLAP, 104); d(2.5, TOM_M, 92)
        for i in range(8): d(i * 0.5, HAT, 116 if i % 2 == 0 else 100)
        d(3.5, COWBELL, 96)
def fill(b, big=False):
    s = song.bar(b)
    for i in range(8): song.dr(s + 2 + i * 0.25, [TOM_H, TOM_HH, TOM_M, TOM_L][i // 2], ramp(i, 8, 88, 120), 0.2)
    if big:
        for i in range(8): song.dr(s + 1 + i * 0.125, SNARE, ramp(i, 8, 70, 104), 0.1)
    song.dr(s + 3.75, KICK, 118)
def roll(b, a, z, v0, v1):
    cnt = int((z - a) * 4)
    for i in range(cnt): song.dr(song.bar(b) + a + i * 0.25, SNARE, ramp(i, cnt, v0, v1), 0.15)
def timp(b, ch, kind, vel):
    s = song.bar(b); p = bassroot(ch) + 12
    if kind == 'q':
        for off in (0, 2): song.add('timp', s + off, 0.5, p, vel)
    else:
        for off, v in ((0, 0), (1, -8), (1.5, -14), (2, -2), (3, -8), (3.5, -14)): song.add('timp', s + off, 0.4, p, vel + v)
def crash(b, vel=112): song.dr(song.bar(b), CRASH, vel, 0.5)

# ==== Arrangement ==============================================================================
# ---- Eröffnung (0–7): Dm Dm Bb A | Dm Bb Gm A --------------------------------------------------
CH_I = ['Dm', 'Dm', 'Bb', 'A', 'Dm', 'Bb', 'Gm', 'A']
crash(0, 100)
for i, ch in enumerate(CH_I):
    b = i; nx = CH_I[(i + 1) % 8]
    walk(b, ch, 84 + i * 2, nx); clock(b, 104, marim=(i >= 4)); timp(b, ch, 'q', 80 + i * 2)
    spicc(b, ch, 60 + i * 3); pad(b, ch, 46 + i * 3)
    drums(b, 'soft', 0.95 + i * 0.02)
    if i >= 2: pizz(b, ch, 66)
for i in range(4): line(i, OPEN[i], ['black'], [92])
for i in range(4, 8): line(i, SUBJ[i - 4] if i < 8 else [], ['white'], [92])      # Klavier antwortet mit Phrase 1 (Dm Bb Gm A)
fill(7, big=True); roll(7, 0, 1, 70, 96)

# ---- Thema A (8–23) ---------------------------------------------------------------------------
crash(8, 108)
for i in range(16):
    b, k = 8 + i, i % 8; ch = CH_A[k]; second = i >= 8; nx = CH_A[(k + 1) % 8]
    walk(b, ch, 96 + (4 if second else 0), nx); clock(b, 104); timp(b, ch, 'q', 92)
    spicc(b, ch, 70 + (6 if second else 0)); pizz(b, ch, 64); drums(b, 'A', 1.0 + (0.05 if second else 0))
    pad(b, ch, 50 + (8 if second else 0))
    if not second:
        line(b, SUBJ[k], ['white'], [96]); counter(b, ch, 'black', 82)
    else:
        line(b, SUBJ[k], ['black', 'bassoon'], [100, 70], shift=0)
        counter(b, ch, 'white', 84, lo=55, hi=74)
        if k >= 4: song.add('horns', song.bar(b), 3.9, tones(ch, 55, 66)[-1], 66 + (k - 4) * 4)
fill(15); fill(23, big=True); roll(23, 0, 1, 70, 100)

# ---- Mittelspiel B (24–39): Zug und Gegenzug im Takt-Wechsel ---------------------------------------
CH_B = ['F', 'C', 'Dm', 'Bb', 'Gm', 'Dm', 'A', 'A',   'Bb', 'F', 'Gm', 'Dm', 'Bb', 'A', 'Dm', 'A']
crash(24, 112); crash(32, 114)
for i in range(16):
    b = 24 + i; ch = CH_B[i]; nx = CH_B[(i + 1) % 16]; second = i >= 8
    walk(b, ch, 100 + (4 if second else 0), nx); clock(b, 106, marim=True); timp(b, ch, 'gallop', 94 + (4 if second else 0))
    spicc(b, ch, 74 + (6 if second else 0), sixteenth=True); drums(b, 'B', 1.0 + (0.05 if second else 0)); pad(b, ch, 58)
    if i % 2 == 0:
        rising(b, ch, 'white', 98, cnt=8, lo=64, hi=88, start=i % 3); counter(b, ch, 'black', 70, cnt=4, lo=52, hi=66)
    else:
        counter(b, ch, 'black', 100, cnt=8, lo=64, hi=86); rising(b, ch, 'white', 70, cnt=4, lo=52, hi=66)
    if second: song.add('horns', song.bar(b), 3.9, tones(ch, 55, 66)[-1], 74)
    if i % 4 == 3: fill(b)
fill(39, big=True); roll(39, 0, 1, 80, 110)

# ---- Mattsetzung C (40–51): Thema mit voller Besetzung ---------------------------------------------
crash(40, 122)
CH_CC = CH_A + CH_C_END
for i in range(12):
    b = 40 + i; ch = CH_CC[i]; nx = CH_CC[(i + 1) % 12] if i < 11 else 'Dm'
    mel = SUBJ[i] if i < 8 else SUBJ_END[i - 8]
    walk(b, ch, 106, nx); clock(b, 108, marim=True); timp(b, ch, 'gallop', 102); drums(b, 'C', 1.05)
    spicc(b, ch, 84, sixteenth=True); pizz(b, ch, 60)
    for p in tones(ch, 55, 70)[:3]: song.add('organ', song.bar(b), 3.95, p, 70)
    line(b, mel, ['white', 'strings', 'horns'], [104, 84, 76])
    counter(b, ch, 'black', 86, cnt=8, lo=62, hi=84)
    if i in (0, 4, 8): crash(b, 110)
    if i % 4 == 3: fill(b)
for beat, pn in ((0, n(D, 4)), (0, n(D, 5)), (0, n(A, 4))):
    song.add('bell', song.bar(51) + 3.0, 1.0, pn, 96)                 # Glocken auf dem Matt (Takt 51)
song.add('bell', song.bar(48) + 0, 3.5, n(D, 6), 90)
roll(51, 0, 3, 90, 127)

# ---- Rückkehr D (52–59): Cembalo mit Thema, Klavier-Kontra, dann Aufbau zurück zum Anfang ------------
crash(52, 100)
for i in range(8):
    b = 52 + i; ch = CH_A[i]; nx = CH_A[(i + 1) % 8] if i < 7 else 'Dm'
    walk(b, ch, 90, nx); clock(b, 104, marim=True); timp(b, ch, 'q', 84)
    spicc(b, ch, 64 + i * 3); pad(b, ch, 50 + i * 3); pizz(b, ch, 62)
    drums(b, 'soft' if i < 4 else 'A', 1.0)
    line(b, SUBJ[i], ['black'], [90 + i * 2])
    counter(b, ch, 'white', 74, cnt=4, lo=52, hi=66)
    if i >= 4: song.add('bassoon', song.bar(b), 3.9, tones(ch, 43, 55)[0], 76)
roll(58, 2, 4, 60, 96); roll(59, 0, 3.5, 80, 124); fill(59, big=True)

# ---- Rendern ----------------------------------------------------------------------------------
sf2, out = cli_paths('bgm_theme_chess.ogg')
song.render(sf2, out)
