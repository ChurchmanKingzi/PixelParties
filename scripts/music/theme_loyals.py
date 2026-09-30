# -*- coding: utf-8 -*-
"""Theme-Track „Faithful to the End“ (Loyals) → public/music/bgm_theme_loyals.ogg

Warmherziger, mutiger Hunde-Marsch in G-Dur, 128 BPM, 64 Takte (120,0 s), nahtlos loopbar.
Oompah-Kontrabass, Nylon-Gitarre und Akkordeon auf den Zählzeiten 2/4, Pfeif-/Flötenmelodie,
Streicher, Hörner und Pauken im Höhepunkt. Das „Wuff-wuff-WUFF“-Motiv (kurz-kurz-lang, z. B.
D-D-G) eröffnet fast jede Phrase und steckt in den Bellen-Rhythmen (Toms + Pizzicato) am
Ende jeder Vier-Takt-Gruppe.

Aufbau (Takte, 0-basiert):
   0– 7  Intro          Marsch-Puls, Akkordeon ruft Thema (Takte 0–3), Pfeife antwortet, Bellen
   8–23  Thema A        Pfeife + Akkordeon; 2. Durchgang mit Flöte in Terzen, Streicher-Pad
  24–39  Steigerung B   Mittelteil (Em Am D G | C G/B Am D), Streicher tragen die Melodie,
                        2. Durchgang mit Pauken, Flötenterzen und dichterem Schlagzeug
  40–55  Höhepunkt A'   Hörner + Pfeife + Flöte + Streicher-Ostinato, Toms/Crash, volle Wucht
  56–63  Rückführung    A-Kurzform leise, dann Snare-Crescendo auf der Dominante D → Takt 0

Harmonie: G-Dur mit em/am-Farben, Dominante D am Ende (Halbschluss, keine Schlusskadenz).
Aufruf:  python3 scripts/music/theme_loyals.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 128, 64                        # 64 × 4 × 60/128 = 120,0 s
song = Song(bpm=BPM, bars=BARS)
song.inst('acbass',  'acbass',  100, 62)
song.inst('guitar',  'guitar',   84, 38)
song.inst('accord',  'accordion',86, 88)
song.inst('whistle', 'whistle',  84, 72)
song.inst('flute',   'flute',    78, 50)
song.inst('pizz',    'pizz',     92, 30)
song.inst('strings', 'strings',  74, 46)
song.inst('horns',   'horns',    84, 64)
song.inst('timp',    'timp',     92, 64)

NAMES = {'C': C, 'Db': Db, 'D': D, 'Eb': Eb, 'E': E, 'F': F, 'Gb': Gb, 'G': G, 'Ab': Ab, 'A': A, 'Bb': Bb, 'B': B, 'F#': Gb}
def nt(s):
    i = 2 if s[1] in '#b' else 1
    return n(NAMES[s[:i]], int(s[i:]))
SCALE = {G, A, B, C, D, E, Gb}                       # G-Dur

# Akkord → (Basston, Grundton, Moll?)
CH = {'G': (G, G, 0), 'C': (C, C, 0), 'D': (D, D, 0), 'Em': (E, E, 1), 'Am': (A, A, 1), 'G/B': (B, G, 0)}
def tri(ch, octv=3):
    r = n(CH[ch][1], octv); return [r, r + (3 if CH[ch][2] else 4), r + 7]
def ramp(i, cnt, a, b): return a + (b - a) * i / max(1, cnt - 1)

A_P = ['G', 'C', 'G', 'D', 'Em', 'C', 'D', 'G']
B_P = ['Em', 'Am', 'D', 'G', 'C', 'G/B', 'Am', 'D']
R_P = ['G', 'Em', 'C', 'D', 'G', 'C', 'D', 'D']

# ---- Melodien (Beat, Dauer, Ton) -----------------------------------------------------
MA = [
 [(0, .5, 'D5'), (.5, .5, 'D5'), (1, 1, 'G5'), (2, .5, 'F#5'), (2.5, .5, 'E5'), (3, 1, 'D5')],
 [(0, .5, 'C5'), (.5, .5, 'C5'), (1, 1, 'E5'), (2, .5, 'D5'), (2.5, .5, 'C5'), (3, 1, 'G4')],
 [(0, .5, 'D5'), (.5, .5, 'D5'), (1, 1, 'G5'), (2, 1, 'A5'), (3, 1, 'G5')],
 [(0, .5, 'F#5'), (.5, .5, 'F#5'), (1, 1, 'A5'), (2, 1.5, 'F#5'), (3.5, .5, 'A4')],
 [(0, .5, 'E5'), (.5, .5, 'E5'), (1, 1, 'B5'), (2, .5, 'A5'), (2.5, .5, 'G5'), (3, 1, 'E5')],
 [(0, .5, 'E5'), (.5, .5, 'E5'), (1, 1, 'G5'), (2, .5, 'E5'), (2.5, .5, 'D5'), (3, 1, 'C5')],
 [(0, 1, 'D5'), (1, 1, 'F#5'), (2, 1, 'A5'), (3, 1, 'C6')],
 [(0, 3, 'G5'), (3, 1, 'D5')],
]
MB = [
 [(0, 1, 'B4'), (1, .5, 'E5'), (1.5, .5, 'G5'), (2, 2, 'B5')],
 [(0, 1, 'A4'), (1, .5, 'C5'), (1.5, .5, 'E5'), (2, 2, 'A5')],
 [(0, 1, 'A5'), (1, .5, 'F#5'), (1.5, .5, 'A5'), (2, 2, 'D6')],
 [(0, 1, 'B5'), (1, 1, 'G5'), (2, 2, 'D5')],
 [(0, 1, 'C5'), (1, .5, 'E5'), (1.5, .5, 'G5'), (2, 2, 'C6')],
 [(0, 1, 'B5'), (1, 1, 'G5'), (2, 1, 'D5'), (3, 1, 'B4')],
 [(0, .5, 'A4'), (.5, .5, 'C5'), (1, 1, 'E5'), (2, 1, 'A5'), (3, 1, 'C6')],
 [(0, .5, 'D6'), (.5, .5, 'C6'), (1, .5, 'A5'), (1.5, .5, 'F#5'), (2, 2, 'D5')],
]
for M in (MA, MB):
    for bar in M:
        for _, _, p in bar: assert nt(p) % 12 in SCALE, p

def third_below(p):
    """Diatonische Terz unter p (G-Dur)."""
    sc = sorted(x for o in range(2, 8) for x in [n(pc, o) for pc in SCALE])
    i = sc.index(p); return sc[i - 2]

def mel(b, notes, insts, vels, terz=None, tvel=60):
    for off, dur, p in notes:
        for inst, v in zip(insts, vels): song.add(inst, song.bar(b) + off, dur * 0.93, nt(p), v + (6 if off == 0 else 0))
        if terz: song.add(terz, song.bar(b) + off, dur * 0.93, third_below(nt(p)), tvel)

# ---- Begleitung -----------------------------------------------------------------------
def bass(b, ch, v=98):
    s = song.bar(b); r = n(CH[ch][0], 2); f = n(CH[ch][1], 2) + 7
    for off, p in ((0, r), (1, f), (2, r), (3, f)): song.add('acbass', s + off, 0.85, p, v + (8 if off in (0, 2) else 0))
def offbeat(b, ch, vg=84, va=86, acc=True):
    s = song.bar(b); t = tri(ch, 3)
    for off in (1, 3):
        for p in t:
            song.add('guitar', s + off, 0.8, p, vg)
            if acc: song.add('accord', s + off, 0.75, p + 12 if p < 52 else p, va)
    for p in t: song.add('guitar', s + 0.5, 0.3, p, vg - 26)   # Auftakt-Strum
def strum8(b, ch, v=70):
    s = song.bar(b); t = tri(ch, 3)
    for i in range(8): song.add('strings', s + i * .5, 0.45, t[(0, 1, 2, 1, 0, 1, 2, 1)[i]] + 12, v + (8 if i % 2 == 0 else 0))
def pad(b, ch, v=66, inst='strings'):
    for p in tri(ch, 3): song.add(inst, song.bar(b), 3.95, p + 12, v)
def bark_pizz(b, ch, full=False, v=94):
    s = song.bar(b); t = tri(ch, 4)
    offs = ((2.5, .25), (3, .25), (3.5, .5)) if full else ((1.5, .25), (2, .25))
    for off, d in offs:
        for p in t: song.add('pizz', s + off, d, p, v)
def horns_hit(b, ch, v=86):
    s = song.bar(b); r = n(CH[ch][1], 3) + (0 if CH[ch][1] >= 5 else 12)
    for off in (0, 2): song.add('horns', s + off, 1.6, r, v)
def timp(b, ch, v=96):
    s = song.bar(b); r = n(CH[ch][1], 2) + (12 if CH[ch][1] < 7 else 0)
    for off in (0, 2): song.add('timp', s + off, 0.5, r, v)
def timp_gallop(b, ch, v=96):
    s = song.bar(b); r = n(CH[ch][1], 2) + (12 if CH[ch][1] < 7 else 0)
    for off, d in ((0, -0), (1, -8), (1.5, -14), (2, -0), (3, -8), (3.5, -14)): song.add('timp', s + off, 0.4, r, v + d)

# ---- Schlagzeug -----------------------------------------------------------------------
def drums(b, lvl):
    """lvl 0 = Marsch, 1 = + Clap/Cowbell, 2 = Höhepunkt (Toms/Crash)."""
    s = song.bar(b); d = lambda off, note, v, du=.2: song.dr(s + off, note, v, du)
    d(0, KICK, 112); d(2, KICK, 104); d(1, SNARE, 104); d(3, SNARE, 108)
    for off in (.5, 1.5, 2.5, 3.5): d(off, SIDESTICK, 96)
    if lvl >= 1:
        d(1, CLAP, 84); d(3, CLAP, 88); d(2.75, KICK, 88)
        for off in (0, 2): d(off, COWBELL, 84)
    if lvl >= 2:
        d(1.5, KICK, 92); d(3.5, KICK, 96)
        if b % 2 == 0: d(0, CRASH, 100, .5)
def bark_toms(b, v=104):
    s = song.bar(b)
    song.dr(s + 2.5, TOM_H, v, .2); song.dr(s + 3, TOM_M, v + 4, .2); song.dr(s + 3.5, TOM_L, v + 12, .5)
def roll(b, a, z, v0, v1):
    s = song.bar(b) + a; cnt = int((z - a) * 4)
    for i in range(cnt): song.dr(s + i * .25, SNARE, ramp(i, cnt, v0, v1), .15)

# ---- Sätze ----------------------------------------------------------------------------
# Intro 0–7
for i, ch in enumerate(A_P):
    b = i
    bass(b, ch, 96); offbeat(b, ch, 80, 78, acc=(i >= 0)); drums(b, 0)
    if i % 4 == 3: bark_toms(b); bark_pizz(b, ch, full=True)
    else: bark_pizz(b, ch)
    if i < 4: mel(b, MA[i], ['accord'], [92])
    else: mel(b, MA[i], ['whistle'], [86])
    if i >= 4: pad(b, ch, 56)
# Thema A 8–23
for r in range(2):
    for i, ch in enumerate(A_P):
        b = 8 + r * 8 + i
        bass(b, ch); offbeat(b, ch, 84, 80); drums(b, 1 if r else 0)
        if i % 4 == 3: bark_toms(b); bark_pizz(b, ch, full=True)
        else: bark_pizz(b, ch)
        mel(b, MA[i], ['whistle', 'accord'], [90, 78], terz='flute' if r else None, tvel=64)
        pad(b, ch, 58 + 8 * r)
    if r == 0: pass
# Steigerung B 24–39
for r in range(2):
    for i, ch in enumerate(B_P):
        b = 24 + r * 8 + i
        bass(b, ch, 100); offbeat(b, ch, 84, 82); drums(b, 1)
        if i % 4 == 3: bark_toms(b); bark_pizz(b, ch, full=True)
        else: bark_pizz(b, ch)
        mel(b, MB[i], ['strings', 'whistle'], [84, 76 + 6 * r], terz='flute' if r else None, tvel=66)
        if r: timp_gallop(b, ch, 94)
        if r and i % 2 == 0: song.dr(song.bar(b) + 2.5, TOM_M, 96, .2)
# Höhepunkt A' 40–55
for r in range(2):
    for i, ch in enumerate(A_P):
        b = 40 + r * 8 + i
        bass(b, ch, 104); offbeat(b, ch, 88, 84); drums(b, 2); strum8(b, ch, 70)
        horns_hit(b, ch, 84); timp(b, ch, 96)
        if i % 4 == 3: bark_toms(b, 110); bark_pizz(b, ch, full=True, v=100)
        mel(b, MA[i], ['whistle', 'horns', 'accord'], [92, 82, 80], terz='flute', tvel=72)
    song.dr(song.bar(40 + r * 8 + 7) + 3.5, CRASH, 100, .5)
# Rückführung 56–63
for i, ch in enumerate(R_P):
    b = 56 + i
    bass(b, ch, 92); offbeat(b, ch, 78, 74); drums(b, 0); pad(b, ch, 62)
    if i % 4 == 3: bark_toms(b, 100); bark_pizz(b, ch, full=True)
    else: bark_pizz(b, ch)
    if i < 4: mel(b, MA[[0, 4, 5, 6][i]] if i < 4 else [], ['accord'], [80])
    if i >= 4: strum8(b, ch, 62 + 3 * (i - 4)); timp(b, ch, 84 + 3 * (i - 4))
roll(63, 0, 3.5, 60, 118)
mel(60, MA[0], ['whistle'], [86]); mel(61, MA[1], ['whistle'], [84]); mel(62, MA[6], ['whistle'], [88])
song.add('whistle', song.bar(63), 1, nt('D5'), 90); song.add('whistle', song.bar(63) + 1, 2.4, nt('A5'), 92)

sf2, out = cli_paths('bgm_theme_loyals.ogg')
song.render(sf2, out)
