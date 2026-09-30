# -*- coding: utf-8 -*-
"""Battle-Theme „Frostbite Foolery“ (Mischief Militia) → public/music/bgm_theme_mischiefmilitia.ogg

Freche Winterarmee: schräger Kinder-Marsch in B-Dur, 138 BPM, Tuba-Oompah, Militär-Snare,
Piccolo (Flöte) + Glockenspiel als Hauptmotiv, „Kazoo“-Klarinette als Kichern in der Gegenstimme,
Schneekanonen-Hits (Orchester-Hit + Pauke) und verschmitzte Fremdtöne (E statt Es = lydischer
Schmunzler, Es-Moll-Mollstich). Verschmitzt, aber militärisch organisiert.

Aufbau (64 Takte ≈ 111,3 s, nahtlos loopbar; endet auf F7 → springt in den B-Dur-Anfang):
  Intro        Takt  0– 7   Snare-Marsch, Tuba-Oompah, Pauke; Pfeife/Glocken deuten das Motiv an
  Thema A      Takt  8–23   Piccolo + Glockenspiel-Motiv, Kazoo-Gegenstimme; ab 16 Xylophon + Trompetenstiche
  Thema B      Takt 24–39   „Schleichender“ Mittelteil g-Moll/Es-Moll-Stich, Arpeggio-Sequenzen, Stopps
  Steigerung   Takt 40–47   Schneekanonen-Hits auf dem Marsch, Snare-Crescendo, aufsteigende Läufe
  Höhepunkt    Takt 48–59   Thema A mit Piccolo+Klarinette+Trompete+Glocken, Posaunen-Stiche, Klatschen
  Rückführung  Takt 60–63   Ausdünnen, Motivfetzen, F7-Dominante, Wirbel in den Anfang

Aufruf:  python3 scripts/music/theme_mischiefmilitia.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os, re, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 138, 64
song = Song(bpm=BPM, bars=BARS)
rnd = random.Random(1381)

song.inst('tuba',   'tuba',      104, 56)   # Oompah-Bass, Oktave 1–2
song.inst('horns',  'horns',      84, 40)   # Nachschläge
song.inst('timp',   'timp',       80, 64)
song.inst('flute',  'flute',      92, 74)   # „Piccolo“, Hauptmotiv
song.inst('glock',  'glock',      86, 100)
song.inst('clar',   'clarinet',   88, 30)   # Kazoo-Kichern
song.inst('xylo',   'xylo',       82, 92)
song.inst('muted',  'muted',      84, 82)   # freche Stiche
song.inst('tromb',  'trombone',   84, 48)
song.inst('hit',    'hit',        86, 64)   # Schneekanone
song.inst('whistle','whistle',    80, 84)

_PC = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def nm(s):
    m = re.fullmatch(r'([A-G])(#|b)?(-?\d)', s)
    return n(_PC[m.group(1)] + {'#': 1, 'b': -1, None: 0}[m.group(2)], int(m.group(3)))

DYN = [0.0] * BARS
def _dyn(a, b, v0, v1):
    for i in range(a, b): DYN[i] = v0 + (v1 - v0) * (i - a) / max(1, b - a - 1)
_dyn(0, 8, 1.0, 1.0); _dyn(8, 24, 0.92, 0.98); _dyn(24, 40, 0.96, 1.02); _dyn(40, 44, 0.90, 0.92)
_dyn(44, 48, 0.94, 1.05); _dyn(48, 60, 1.04, 1.06); _dyn(60, 64, 0.96, 0.9)
# Stopps: ab diesem Beat schweigt alles (außer force)
STOP = {23: 3, 31: 2, 39: 2, 59: 2}

def note(v, beat, dur, pitch, vel=90, art=0.9, force=False):
    bar = int(beat // 4)
    if not force and beat - 4 * bar >= STOP.get(bar, 4) - 1e-9: return
    t0 = beat + rnd.uniform(-0.006, 0.006)
    song.add(v, max(0, t0), max(0.08, dur * art), pitch, vel * DYN[min(bar, BARS - 1)] + rnd.uniform(-3, 3))

def drum(beat, pitch, vel=100, dur=0.2, force=False):
    bar = int(beat // 4)
    if not force and beat - 4 * bar >= STOP.get(bar, 4) - 1e-9: return
    song.dr(max(0, beat + rnd.uniform(-0.005, 0.005)), pitch, max(1, vel * (0.6 + 0.4 * DYN[min(bar, BARS - 1)]) + rnd.uniform(-4, 4)), dur)

CH = {
    'Bb':  (Bb, [Bb, D, F]),        'Eb':  (Eb, [Eb, G, Bb]),   'F':  (F, [F, A, C]),
    'F7':  (F,  [F, A, C, Eb]),     'Gm':  (G,  [G, Bb, D]),    'G7': (G, [G, B, D, F]),
    'Cm':  (C,  [C, Eb, G]),        'D7':  (D,  [D, Gb, A, C]), 'Ebm': (Eb, [Eb, Gb, Bb]),
}
SCALE = {Bb, C, D, Eb, F, G, A, E}   # B-Dur + E (lydischer Schmunzler)

PA  = ['Bb', 'Bb', 'Eb', 'F', 'Bb', 'G7', 'Cm', 'F7']
PB1 = ['Gm', 'D7', 'Gm', 'Cm', 'Eb', 'Ebm', 'Bb', 'F7']
PB2 = ['Gm', 'Cm', 'F', 'Bb', 'Eb', 'Ebm', 'Bb', 'F7']
PS  = ['Gm', 'Gm', 'Cm', 'Cm', 'Eb', 'F', 'F7', 'F7']
CHORDS = PA * 3 + PB1 + PB2 + PS + PA + ['Eb', 'Ebm', 'Bb', 'F7'] + ['Bb', 'Eb', 'F', 'F7']
assert len(CHORDS) == BARS

# Hauptmotiv „Schneeballschlacht“: punktierter Marschauftakt, Schmunzler-E in Takt 3
A_LEAD = [
    [(0, .75, 'F5'), (.75, .25, 'F5'), (1, .5, 'D5'), (1.5, .5, 'F5'), (2, 1.5, 'Bb5'), (3.5, .5, 'A5')],
    [(0, .75, 'G5'), (.75, .25, 'G5'), (1, .5, 'F5'), (1.5, .5, 'D5'), (2, 2, 'F5')],
    [(0, .75, 'G5'), (.75, .25, 'G5'), (1, .5, 'Bb5'), (1.5, .5, 'G5'), (2, 1.5, 'Eb5'), (3.5, .5, 'E5')],
    [(0, .5, 'F5'), (.5, .5, 'A5'), (1, .5, 'C6'), (1.5, .5, 'A5'), (2, 2, 'F5')],
    [(0, .75, 'F5'), (.75, .25, 'F5'), (1, .5, 'D5'), (1.5, .5, 'F5'), (2, 1, 'Bb5'), (3, 1, 'D6')],
    [(0, .5, 'B5'), (.5, .5, 'D6'), (1, .5, 'B5'), (1.5, .5, 'G5'), (2, 1.5, 'D5'), (3.5, .5, 'F5')],
    [(0, .75, 'Eb5'), (.75, .25, 'Eb5'), (1, .5, 'G5'), (1.5, .5, 'C6'), (2, 1, 'Bb5'), (3, 1, 'G5')],
    [(0, .5, 'A5'), (.5, .5, 'G5'), (1, .5, 'F5'), (1.5, .5, 'Eb5'), (2, 1, 'F5'), (3.5, .5, 'F5')],
]
# Kazoo-Kichern: antwortet in den Lücken, eine Oktave tiefer
A_COUNTER = [
    [(1.5, .5, 'Bb4'), (3, .5, 'D5')], [(2.5, .5, 'Bb4'), (3, .5, 'D5')],
    [(1.5, .5, 'G4'), (3, .5, 'Bb4')], [(2.5, .5, 'F4'), (3.5, .5, 'A4')],
    [(1.5, .5, 'Bb4'), (3, .5, 'F4')], [(2, .5, 'G4'), (3, .5, 'B4')],
    [(1.5, .5, 'G4'), (3.5, .5, 'C5')], [(2.5, .5, 'A4'), (3, .5, 'C5'), (3.5, .5, 'A4')],
]
# Turn im Höhepunkt (Takte 56–59): Eb – Ebm – Bb – F7
D_TURN = [
    [(0, .75, 'G5'), (.75, .25, 'G5'), (1, .5, 'Bb5'), (1.5, .5, 'G5'), (2, 1, 'Eb6'), (3, 1, 'Bb5')],
    [(0, .75, 'Gb5'), (.75, .25, 'Gb5'), (1, .5, 'Bb5'), (1.5, .5, 'Gb5'), (2, 2, 'Eb5')],
    [(0, .5, 'D5'), (.5, .5, 'F5'), (1, .5, 'Bb5'), (1.5, .5, 'D6'), (2, 1.5, 'F6'), (3.5, .5, 'D6')],
    [(0, .5, 'C6'), (.5, .5, 'A5'), (1, .5, 'F5'), (1.5, .5, 'A5'), (2, .5, 'C6')],
]
E_LEAD = [
    [(0, .75, 'F5'), (.75, .25, 'F5'), (1, .5, 'D5'), (1.5, .5, 'F5'), (2, 2, 'Bb5')],
    [(0, .75, 'G5'), (.75, .25, 'G5'), (1, .5, 'Bb5'), (1.5, .5, 'G5'), (2, 2, 'Eb5')],
    [(0, .5, 'F5'), (.5, .5, 'A5'), (1, .5, 'C6'), (1.5, .5, 'A5'), (2, 2, 'F5')],
    [(0, .5, 'A5'), (.5, .5, 'G5'), (1, .5, 'F5'), (1.5, .5, 'Eb5'), (2, .5, 'F5')],
]
# Mittelteil B: Arpeggio-Sequenzen (Akkordtöne aus dem Akkord des Taktes)
def b_bar(b):
    ch = CHORDS[b]; pcs = CH[ch][1]
    tones = sorted(p for pc in pcs for p in range(72, 87) if p % 12 == pc)
    if b % 2 == 0:
        return [(0, .5, tones[0]), (.5, .5, tones[1]), (1, .5, tones[2]), (1.5, .5, tones[1]), (2, 1, tones[3 if len(tones) > 3 else 2]), (3, .5, tones[2]), (3.5, .5, tones[1])]
    return [(0, .5, tones[2]), (.5, .5, tones[1]), (1, .5, tones[0]), (1.5, .5, tones[1]), (2, 1.5, tones[2]), (3.5, .5, tones[0])]

_warn = []
def play(v, bar0, bars, tr=0, vel=90, art=0.9):
    for i, lst in enumerate(bars):
        b = bar0 + i
        for x in lst:
            beat, dur, name = x[:3]
            p = (nm(name) if isinstance(name, str) else name) + tr
            if (p - tr) % 12 not in SCALE | set(CH[CHORDS[b]][1]): _warn.append((b, name))
            note(v, 4 * b + beat, dur, p, x[3] if len(x) > 3 else vel, art)

def place(pc, prev, lo=34, hi=50):
    c = [pc + 12 * k for k in range(0, 10) if lo <= pc + 12 * k <= hi]
    return min(c, key=lambda x: (abs(x - prev), x))
def voice_in(pcs, lo, hi):
    return sorted(p for pc in pcs for p in range(lo, hi + 1) if p % 12 == pc % 12)

def oompah(b, vel=96, pah=76, light=False):
    root, pcs = CH[CHORDS[b]]
    r = place(root, 41); f = place(pcs[2], r)
    nxt = CH[CHORDS[(b + 1) % BARS]][0]
    note('tuba', 4 * b, 0.8, r, vel + 6, 0.85)
    note('tuba', 4 * b + 2, 0.8, f, vel, 0.85)
    if not light:
        note('tuba', 4 * b + 3.5, 0.4, place((nxt + 7) % 12 if b % 2 else nxt, f), vel - 14, 0.8)
    ch = voice_in(pcs, 55, 65)
    for t in (1, 3):
        for p in ch: note('horns', 4 * b + t, 0.6, p, pah, 0.7)

def snare_march(b, lvl):
    s = 4 * b
    if lvl == 0:      # Intro: Rundschlag
        for t in (0, 1, 2, 3): drum(s + t, SNARE, 70 if t % 2 == 0 else 84)
        drum(s + 1.75, SNARE, 62); drum(s + 3.75, SNARE, 64)
        drum(s, KICK, 96); drum(s + 2, KICK, 90)
    elif lvl == 1:
        drum(s, KICK, 104); drum(s + 2, KICK, 100)
        for t in (1, 3): drum(s + t, SNARE, 100)
        for t in (0.5, 1.75, 2.5, 3.75): drum(s + t, SNARE, 58 if t % 1 else 50)
        drum(s + 1.5, SIDESTICK, 74); drum(s + 3.5, SIDESTICK, 74)
        for i in range(8): drum(s + i * .5, HAT, 84 if i % 2 else 100)
    else:
        drum(s, KICK, 112); drum(s + 2, KICK, 106); drum(s + 2.5, KICK, 80)
        for t in (1, 3): drum(s + t, SNARE, 112); drum(s + t, CLAP, 76)
        for t in (0.5, 1.75, 2.5, 3.75): drum(s + t, SNARE, 60)
        for i in range(8): drum(s + i * .5, HAT if i != 5 else OHAT, 100 if i % 2 == 0 else 84)
        drum(s + 1.5, COWBELL, 66); drum(s + 3.5, COWBELL, 62)

def fill(b, kind=0):
    s = 4 * b
    if kind == 0:
        for i, t in enumerate([2, 2.5, 3, 3.25, 3.5, 3.75]): drum(s + t, SNARE, 62 + i * 10, 0.12, force=True)
    elif kind == 1:
        for t, p in zip([2, 2.5, 3, 3.333, 3.667], [TOM_HH, TOM_H, TOM_M, TOM_L, SNARE]): drum(s + t, p, 96, 0.2, force=True)
    else:
        for i in range(16): drum(s + i * .25, SNARE, 46 + i * 4, 0.12, force=True)
def crash(b, vel=104): drum(4 * b, CRASH, vel, 0.6, force=True)
def cannon(b, t=0.0, vel=100):
    root, pcs = CH[CHORDS[b]]
    for p in voice_in(pcs, 48, 60): note('hit', 4 * b + t, 0.5, p, vel, 0.9, force=True)
    note('timp', 4 * b + t, 0.6, place(root, 41, 36, 48) , 100, 0.9, force=True)
    drum(4 * b + t, KICK, 120, force=True)

# ---- Arrangement --------------------------------------------------------------------------------
for b in range(BARS):
    oompah(b, 100, 84 if b < 8 else 80, light=(40 <= b < 44))
# Pauke unterstützt Takt 1 jeder 4er-Gruppe im Intro/Höhepunkt
for b in list(range(0, 8, 2)) + list(range(48, 60, 2)):
    note('timp', 4 * b, 0.5, place(CH[CHORDS[b]][0], 41, 36, 48), 90)

# Intro 0–7
for b in range(0, 8): snare_march(b, 1)
play('whistle', 4, [[(2, .5, 'F5'), (2.5, .5, 'D5'), (3, 1, 'F5')], [(2, 1, 'G5'), (3, 1, 'F5')], [(2, .5, 'F5'), (2.5, .5, 'Bb5'), (3, 1, 'A5')], [(2, .5, 'A5'), (2.5, .5, 'C6'), (3, .5, 'A5')]], vel=78)
for b in range(0, 8):       # Xylophon-Achtelpuls + Kazoo-Kichern im Intro
    for t in (0.5, 1.5, 2.5, 3.5): note('xylo', 4 * b + t, 0.3, place(CH[CHORDS[b]][1][int(t) % 3], 72, 64, 80), 76, 0.6)
    note('clar', 4 * b + 3, 0.5, place(CH[CHORDS[b]][1][2], 62, 58, 70), 80, 0.8)
for b in range(2, 8): note('glock', 4 * b + 1.5, 0.4, place(CH[CHORDS[b]][1][0], 84, 72, 91), 74, 0.6)
fill(7, 0)
# Thema A 8–23
crash(8, 100)
for b in range(8, 24): snare_march(b, 1)
play('flute', 8, A_LEAD, vel=94); play('glock', 8, A_LEAD, tr=12, vel=64, art=0.5)
play('clar', 8, A_COUNTER, vel=82)
play('flute', 16, A_LEAD, vel=96); play('glock', 16, A_LEAD, tr=12, vel=70, art=0.5)
play('xylo', 16, A_LEAD, tr=-12, vel=76, art=0.6)
play('clar', 16, A_COUNTER, vel=86)
for b in (19, 22): note('muted', 4 * b + 3.5, 0.4, nm('F5'), 84, force=True)
note('glock', 4 * 23 + 3.5, 0.4, nm('A6'), 80, force=True)
cannon(23, 3.5, 84)
fill(15, 1); crash(16, 100); fill(23, 0)
# Thema B 24–39
crash(24, 104)
for b in range(24, 40):
    snare_march(b, 1 if b % 8 < 4 else 2)
    for k, t in enumerate((0, 1.5, 3)):
        note('glock', 4 * b + t, 0.4, place(CH[CHORDS[b]][1][k % 3], 84, 76, 93), 60, 0.6)
play('flute', 24, [b_bar(b) for b in range(24, 32)], vel=88, art=0.7)
play('xylo', 24, [b_bar(b) for b in range(24, 32)], tr=-12, vel=74, art=0.6)
play('clar', 32, [b_bar(b) for b in range(32, 40)], tr=-12, vel=88, art=0.7)
play('flute', 32, [b_bar(b) for b in range(32, 40)], tr=12, vel=64, art=0.5)
for b in range(24, 40):
    for p in voice_in(CH[CHORDS[b]][1], 52, 62): note('tromb', 4 * b + 1.5, 0.4, p, 70, 0.8)
note('xylo', 4 * 31 + 3.5, 0.4, nm('D6'), 84, force=True); cannon(31, 3.5, 84)
note('xylo', 4 * 39 + 3.5, 0.4, nm('C6'), 84, force=True); cannon(39, 3.5, 90)
crash(32, 106)
# Steigerung 40–47: Schneekanonen auf den Marsch
for b in range(40, 48):
    snare_march(b, 0 if b < 44 else 1)
    if b < 44: cannon(b, 0.0, 96 if b % 2 == 0 else 84)
    for p in voice_in(CH[CHORDS[b]][1], 60, 70): note('muted', 4 * b + 2, 0.5, p, 78, 0.6)
play('flute', 40, [A_LEAD[0], A_LEAD[1], A_LEAD[2], A_LEAD[2]], tr=-12, vel=76, art=0.8)
for b in range(44, 47):
    tones = voice_in(CH[CHORDS[b]][1], 72, 91)[:6]
    for i in range(8): note('glock', 4 * b + i * .5, 0.4, tones[(i * 2 + b) % len(tones)], 66 + i * 3, 0.6)
play('flute', 44, [[(0, .5, 'G5'), (.5, .5, 'Bb5'), (1, .5, 'D6'), (1.5, .5, 'G6'), (2, 2, 'Bb5')],
                   [(0, .5, 'F5'), (.5, .5, 'A5'), (1, .5, 'C6'), (1.5, .5, 'F6'), (2, 2, 'C6')],
                   [(0, .5, 'F5'), (.5, .5, 'A5'), (1, .5, 'C6'), (1.5, .5, 'Eb6'), (2, 1, 'A5'), (3, 1, 'C6')]], vel=88)
fill(47, 2)
# Höhepunkt 48–59
crash(48, 112)
for b in range(48, 60):
    snare_march(b, 2)
    if b % 2 == 0: cannon(b, 0.0, 70)
for lead in ('flute', 'clar'):
    play(lead, 48, A_LEAD, vel=94 if lead == 'flute' else 84, tr=0 if lead == 'flute' else -12)
    play(lead, 56, D_TURN, vel=94 if lead == 'flute' else 84, tr=0 if lead == 'flute' else -12)
play('glock', 48, A_LEAD, tr=12, vel=70, art=0.5); play('glock', 56, D_TURN, tr=12, vel=72, art=0.5)
play('muted', 48, A_LEAD, tr=-12, vel=70, art=0.85)
play('xylo', 56, D_TURN, tr=-12, vel=76, art=0.6)
for b in (52, 54, 58):
    for p in voice_in(CH[CHORDS[b]][1], 55, 65): note('tromb', 4 * b + 3.5, 0.4, p, 90, 0.7)
fill(51, 0); fill(55, 1); crash(52, 104); crash(56, 108); fill(59, 0)
# Rückführung 60–63
for b in range(60, 64): snare_march(b, 1 if b < 62 else 0)
play('flute', 60, E_LEAD, vel=84); play('glock', 60, E_LEAD, tr=12, vel=64, art=0.5)
play('clar', 60, [[(1.5, .5, 'Bb4'), (3, .5, 'D5')], [(2.5, .5, 'Bb4')], [(1.5, .5, 'A4'), (3, .5, 'C5')], [(2.5, .5, 'Eb5')]], vel=72)
for i, t in enumerate([2.5, 3, 3.25, 3.5, 3.75]): drum(4 * 63 + t, SNARE, 58 + i * 14, 0.12, force=True)

if _warn: print('Hinweis, Töne außerhalb Tonleiter/Akkord:', _warn)
sf2, out = cli_paths('bgm_theme_mischiefmilitia.ogg'); song.render(sf2, out)
