# -*- coding: utf-8 -*-
"""Skill Test (Battle Royale) → public/music/bgm_skilltest2.ogg   Titel: „Randomized Reality“

Acht Parteien, zufällig gewürfelte Layouts: Der ganze Track steht in UNGERADEM 7/4 (168 BPM, a-Moll/phrygisch), und
die Takt-Gruppierung wechselt ständig zwischen 4+3, 3+4, 2+2+3 (und im Würfelteil auch 3+2+2, 2+3+2). Kick, Snare,
Bass, Marimba-Ostinato, Pizzicato und Blech-Stabs folgen jeweils der Gruppierung des Takts – der Boden rutscht weg,
der Puls bleibt trotzdem. Alle Würfe sind per Seed festgelegt (reproduzierbar).

Hook (mitsingbar trotz 7/4): „A A C B♭ A – E F E“ – zwei Achtel Anlauf, Quartschritt, dann der phrygische Halbton E–F.
Er wird in jedem Abschnitt anders gekleidet: Synth-Blech, Blech-Chor + Glockenspiel, c-phrygisch (Rückung um eine kleine
Terz), im Chaos-Höhepunkt als Fragmente (Kopf = 4er-Gruppe, Schwanz = 3er-Gruppe), die im Takt-Rhythmus neu gewürfelt werden.

Das „Acht-Spieler“-Motiv: im Intro steigen acht Stimmen nacheinander ein (Kick/Hats/Kuhglocke + Bass, Marimba, Pizzicato,
Toms, Streicher, Blech-Stabs, Hörner/Saw, Lead); im Mittelteil gibt es einen Stopp mit Neustart.

Form (52 Takte à 7/4 = 130 s): Intro 8 (acht Einsätze) · A 8 (Hook) · A' 8 (Hook + Blech-Chor) · B 8 (Würfelteil, Stopp
in Takt 4, Neustart) · C 8 (Hook in c-phrygisch, 16tel-Saw) · D 8 (Chaos-Höhepunkt: Hook, dann geschichtete Fragmente
+ Fanfaren) · Rückführung 4 (endet auf E-Dur, der Dominante → Loop auf Am)
"""
import os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 168, 52
song = Song(BPM, BARS, beats_per_bar=7)
rng = random.Random(7771)          # alle Würfe (Gruppierung, Fragmente, Velocity-Streuung)

song.inst('lead', 'sbrass', vol=98, pan=62)
song.inst('brass', 'brass', vol=84, pan=76)
song.inst('horn', 'horns', vol=74, pan=90)
song.inst('trp', 'trumpet', vol=72, pan=46)
song.inst('mar', 'marimba', vol=92, pan=34)
song.inst('saw', 'saw', vol=52, pan=94)
song.inst('pizz', 'pizz', vol=88, pan=24)
song.inst('str', 'strings', vol=74, pan=44)
song.inst('vln', 'violin', vol=78, pan=56)
song.inst('bass', 'sbass', vol=102, pan=62)
song.inst('glock', 'glock', vol=64, pan=72)

NAMES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def pn(s):
    a, i = 0, 1
    if s[1] in '#b':
        a, i = (1 if s[1] == '#' else -1), 2
    return 12 * (int(s[i:]) + 1) + NAMES[s[0]] + a

CH = {'Am': (9, 'm'), 'Bb': (10, 'M'), 'Gm': (7, 'm'), 'F': (5, 'M'), 'Dm': (2, 'm'), 'E': (4, 'M'), 'C': (0, 'M')}
QUAL = {'M': (0, 4, 7), 'm': (0, 3, 7)}
SCALE = {9, 10, 0, 2, 4, 5, 7}     # a-phrygisch (A B♭ C D E F G); E-Dur bringt das G♯ als Akkordton

def tone(ch, idx, octv, shift=0):
    """Akkordton Nr. idx (0,1,2 = Grundton, Terz, Quinte; 3.. = Oktave darüber) in Oktave octv."""
    root, q = CH[ch]
    r = (root + shift) % 12 + 12 * (octv + 1)
    return r + QUAL[q][idx % 3] + 12 * (idx // 3)

def hv(v): return max(1, min(127, v + rng.randint(-4, 4)))

G43, G34, G223, G322, G232 = (4, 3), (3, 4), (2, 2, 3), (3, 2, 2), (2, 3, 2)
def starts(g):
    o, out = 0, []
    for L in g:
        out.append((o, L)); o += L
    assert o == 7
    return out

def dice(n):
    """Gewürfelte Gruppierungen: nie zweimal dieselbe hintereinander."""
    out, prev = [], None
    for _ in range(n):
        c = rng.choice([G43, G34, G223, G322, G232])
        while c == prev: c = rng.choice([G43, G34, G223, G322, G232])
        out.append(c); prev = c
    return out

# ── Hook (Am Bb Am E | Am Bb Gm E), Gruppierung je Takt wie notiert ──────────────────────────────────
HOOK = [
    [('A4', .5), ('A4', .5), ('C5', 1), ('Bb4', 1), ('A4', 1), ('E5', 1.5), ('F5', .5), ('E5', 1)],          # Am  4+3
    [('D5', 1), ('C5', .5), ('Bb4', .5), ('Bb4', 1), ('F5', 1.5), ('E5', .5), ('D5', 1), ('C5', 1)],         # Bb  3+4
    [('A4', .5), ('C5', .5), ('E5', 1), ('A5', 1), ('G5', .5), ('E5', .5), ('F5', 1), ('E5', 2)],           # Am  2+2+3
    [('E5', .5), ('E5', .5), ('E5', .5), ('E5', .5), ('F5', 1), ('E5', 1), ('D5', 1), ('B4', 1), ('E5', 1)], # E   4+3
    [('A4', .5), ('A4', .5), ('C5', 1), ('E5', 1), ('A5', 1), ('G5', 1.5), ('F5', .5), ('E5', 1)],          # Am  4+3
    [('D5', 1), ('Bb4', 1), ('G4', 1), ('D5', 1.5), ('C5', .5), ('Bb4', 1), ('G4', 1)],                     # Gm  3+4
    [('F5', .5), ('A5', .5), ('C6', 1), ('A5', 1), ('G5', .5), ('F5', .5), ('E5', 1), ('F5', 2)],           # F   2+2+3
    [('E5', .5), ('E5', .5), ('F5', 1), ('E5', 2), ('B4', 1), ('E5', 2)],                                   # E   4+3
]
HOOK_CH = ['Am', 'Bb', 'Am', 'E', 'Am', 'Bb', 'Gm', 'E']
HOOK_G = [G43, G34, G223, G43, G43, G34, G223, G43]

def mel(inst, b0, bars, chords, shift=0, vel=92, octave=0, legato=.93):
    for k, bar in enumerate(bars):
        t = song.bar(b0 + k)
        assert abs(sum(d for _, d in bar) - 7) < 1e-9, (k, bar)
        ok = SCALE | {(CH[chords[k]][0] + i) % 12 for i in QUAL[CH[chords[k]][1]]}
        for name, dur in bar:
            p = pn(name)
            assert p % 12 in ok, (inst, b0 + k, name, chords[k])
            song.add(inst, t, dur * legato, p + shift + 12 * octave, hv(vel))
            t += dur

# ── Fragmente: Hook-Kopf (4er-Gruppe), Schwanz (3er), Kurzform (2er) — folgen der gewürfelten Gruppierung ──
FR = {4: [(0, .5), (0, .5), (1, 1), (2, 1), (1, 1)], 3: [(3, 1.5), (2, .5), (1, 1)], 2: [(2, 1), (1, .5), (0, .5)]}
def frag(inst, b, ch, g, shift=0, octv=4, vel=90, var=0, legato=.9):
    for o, L in starts(g):
        t = song.bar(b) + o
        for idx, d in FR[L]:
            song.add(inst, t, d * legato, tone(ch, idx + var, octv, shift), hv(vel))
            t += d

# ── Begleit-Bausteine (alle nach der Gruppierung g des Takts) ─────────────────────────────────────────
def bass(b, ch, g, shift=0, vel=92, pulse=True):
    root = CH[ch][0]
    r = (root + shift) % 12 + 36
    if r >= 45: r -= 12                                   # Bass ≈ G1–G2
    for o, L in starts(g):
        t = song.bar(b) + o
        if not pulse:
            song.add('bass', t, L * .9, r, vel); continue
        for i in range(2 * L):
            m = r + 12 if i == 2 * L - 1 and L > 2 else r
            song.add('bass', t + i * .5, .42, m, hv(vel + (12 if i == 0 else (-4 if i % 2 else 2))))

def marimba(b, ch, g, shift=0, vel=56):
    pat = (0, 1, 2, 3, 2, 1, 2, 4)
    for o, L in starts(g):
        for i in range(2 * L):
            song.add('mar', song.bar(b) + o + i * .5, .3, tone(ch, pat[i % 8], 4, shift), hv(vel + (16 if i == 0 else 0)))

def saw16(b, ch, g, shift=0, vel=40):
    pat = (0, 2, 1, 2, 3, 2, 1, 2)
    for o, L in starts(g):
        for i in range(4 * L):
            song.add('saw', song.bar(b) + o + i * .25, .2, tone(ch, pat[i % 8], 3, shift), hv(vel + (12 if i == 0 else 0)))

def pizz(b, ch, g, shift=0, vel=84):
    for o, L in starts(g):
        offs = [0] + ([1.5] if L >= 3 else [1]) + ([3] if L == 4 else [])
        for ob in offs:
            for idx in (0, 1, 2):
                song.add('pizz', song.bar(b) + o + ob, .3, tone(ch, idx, 3, shift), hv(vel + (10 if ob == 0 else -6)))

def strings(b, ch, g, shift=0, vel=52):
    for o, L in starts(g):
        for idx in (1, 2, 3):
            song.add('str', song.bar(b) + o, L - .08, tone(ch, idx, 3, shift), hv(vel))

def counter(b, ch, g, shift=0, vel=70):
    for j, (o, L) in enumerate(starts(g)):
        song.add('vln', song.bar(b) + o, L * .92, tone(ch, (3, 4, 5, 4)[(b + j) % 4], 3, shift), hv(vel))

def stabs(b, ch, g, shift=0, vel=78):
    for o, L in starts(g):
        offs = [0] + ([L - 1] if L >= 3 else [])
        for ob in offs:
            for idx in (1, 2, 3):
                song.add('brass', song.bar(b) + o + ob, .6, tone(ch, idx, 3, shift), hv(vel + (6 if ob == 0 else -8)))

def horns(b, ch, g, shift=0, vel=58):
    for o, L in starts(g):
        for idx in (2, 3):
            song.add('horn', song.bar(b) + o, L - .08, tone(ch, idx, 3, shift), hv(vel))

def fanfare(b, ch, g, shift=0, vel=84):
    for o, L in starts(g):
        if L < 3: continue
        t = song.bar(b) + o
        song.add('trp', t, .5, tone(ch, 2, 4, shift), hv(vel))
        song.add('trp', t + .5, .5, tone(ch, 3, 4, shift), hv(vel))
        song.add('trp', t + 1, L - 1.1, tone(ch, 4, 4, shift), hv(vel + 6))

def drums(b, g, hat=True, snare=True, kick=True, cow=False, tom=False, h16=False, crash=False):
    t0 = song.bar(b)
    for o, L in starts(g):
        t = t0 + o
        if kick:
            song.dr(t, KICK, 114 if o == 0 else 102, .2)
            if L == 4: song.dr(t + 2.5, KICK, 86, .2)
        if snare:
            if L == 4: song.dr(t + 2, SNARE, 106, .15)
            elif L == 3: song.dr(t + 1.5, SNARE, 100, .15)
            else: song.dr(t + 1, SIDESTICK, 104, .15)
        if cow and L == 3: song.dr(t, COWBELL, 78, .15)
    if hat:
        gs = {o for o, _ in starts(g)}
        for i in range(14):
            song.dr(t0 + i * .5, HAT, 112 if i * .5 in gs else 100, .08)
            if h16: song.dr(t0 + i * .5 + .25, HAT, 88, .06)
    if tom:
        for i, nt in enumerate((TOM_HH, TOM_H, TOM_M, TOM_L)):
            song.dr(t0 + 6 + i * .25, nt, 96 + i * 4, .15)
    if crash: song.dr(t0, CRASH, 104, 1.5)

def play(b, ch, g, P, shift=0):
    if 'bass' in P: bass(b, ch, g, shift, pulse='b8' in P)
    if 'mar' in P: marimba(b, ch, g, shift, 58 if 'big' in P else 54)
    if 'saw' in P: saw16(b, ch, g, shift)
    if 'pizz' in P: pizz(b, ch, g, shift)
    if 'str' in P: strings(b, ch, g, shift)
    if 'vln' in P: counter(b, ch, g, shift)
    if 'stab' in P: stabs(b, ch, g, shift)
    if 'horn' in P: horns(b, ch, g, shift)
    if 'fan' in P: fanfare(b, ch, g, shift)
    drums(b, g, snare='nosn' not in P, cow='cow' in P, tom='tom' in P, h16='h16' in P, crash='crash' in P)

def stop_bar(b, ch, shift=0):
    """Stopp: ein Schlag, 4,5 Zählzeiten Stille, dann Tom-Auftakt zum Neustart."""
    t = song.bar(b)
    song.dr(t, KICK, 124, .3); song.dr(t, CRASH, 112, 2.0)
    root = (CH[ch][0] + shift) % 12 + 36
    song.add('bass', t, .9, root - 12 if root >= 45 else root, 112)
    for idx in (1, 2, 3):
        song.add('brass', t, .8, tone(ch, idx, 3, shift), 100)
    for bt, nt, v in ((4.5, TOM_L, 98), (5, TOM_L, 102), (5.5, TOM_M, 106), (6, TOM_H, 108), (6.25, TOM_HH, 110), (6.5, SNARE, 100), (6.75, SNARE, 112)):
        song.dr(t + bt, nt, v, .15)

def hook_section(b, shift=0, lead=True, extra=()):
    mel('lead', b, HOOK, HOOK_CH, shift, vel=96)
    for inst, vel, octv, leg in extra:
        mel(inst, b, HOOK, HOOK_CH, shift, vel=vel, octave=octv, legato=leg)

# ═══════════════════════════════════════════════════════════════════════════════════════════════════
b = 0
# ── Intro (8): acht Spieler steigen nacheinander ein, Gruppierung würfelt ──────────────────────────────
INTRO_CH = ['Am', 'Am', 'Bb', 'Am', 'Gm', 'F', 'E', 'E']
INTRO_G = dice(8)
ENTRY = [{'cow', 'bass', 'b8', 'h16', 'crash', 'tom'}, {'mar', 'big'}, {'pizz'}, {'tom'}, {'str'}, {'stab'}, {'horn'}, {'saw'}]
P = set()
for k in range(8):
    P |= ENTRY[k]
    if k == 1: P -= {'crash', 'tom'}
    play(b + k, INTRO_CH[k], INTRO_G[k], P | ({'tom'} if k == 7 else set()), 0)
    if k == 7:
        frag('lead', b + k, 'E', INTRO_G[k], 0, 4, 92)     # Spieler acht: der Hook-Kopf deutet sich an
b += 8

# ── A (8): Hook im Synth-Blech, Marimba-Ostinato, Bass in Achteln ─────────────────────────────────────
hook_section(b)
for k in range(8):
    play(b + k, HOOK_CH[k], HOOK_G[k], {'bass', 'b8', 'mar', 'pizz', 'str', 'cow', 'crash'} if k == 0 else {'bass', 'b8', 'mar', 'pizz', 'str', 'cow'})
drums(b + 7, HOOK_G[7], tom=True)
b += 8

# ── A' (8): Blech-Chor + Glockenspiel verdoppeln, Gegenstimme, Stabs ───────────────────────────────────
hook_section(b, extra=[('brass', 62, 0, .9), ('glock', 50, 1, .7)])
for k in range(8):
    play(b + k, HOOK_CH[k], HOOK_G[k], {'bass', 'b8', 'mar', 'pizz', 'str', 'vln', 'stab', 'cow', 'big'} | ({'crash'} if k == 0 else set()) | ({'tom'} if k in (3, 7) else set()))
b += 8

# ── B (8): Würfelteil — Gruppierung und Fragmente neu gewürfelt, Stopp in Takt 4, Neustart in Takt 5 ───
B_CH = ['Dm', 'F', 'Gm', 'Bb', 'Dm', 'E', 'Am', 'E']
B_G = dice(8)
for k in range(8):
    if k == 3:
        stop_bar(b + k, B_CH[k]); continue
    frag('lead', b + k, B_CH[k], B_G[k], 0, 4, 94, var=rng.choice([0, 0, 1]))
    frag('trp', b + k, B_CH[k], B_G[k], 0, 4, 70, var=rng.choice([1, 2]))
    play(b + k, B_CH[k], B_G[k], {'bass', 'b8', 'mar', 'pizz', 'str', 'stab', 'cow', 'big'} | ({'crash'} if k == 4 else set()) | ({'tom'} if k == 7 else set()))
b += 8

# ── C (8): Hook in c-phrygisch (Rückung um eine kleine Terz), 16tel-Saw, Hat-16tel ───────────────────────
S = 3
hook_section(b, S, extra=[('brass', 68, 0, .9), ('horn', 56, -1, .95), ('glock', 52, 1, .7)])
for k in range(8):
    play(b + k, HOOK_CH[k], HOOK_G[k], {'bass', 'b8', 'mar', 'saw', 'pizz', 'str', 'vln', 'stab', 'horn', 'cow', 'h16', 'big'} | ({'crash'} if k == 0 else set()) | ({'tom'} if k in (3, 7) else set()), S)
b += 8

# ── D (8): Chaos-Höhepunkt. Takt 1–4: Hook mit allen; Takt 5–8: geschichtete, gewürfelte Fragmente + Fanfaren ───
D_CH = HOOK_CH
D_G = HOOK_G[:4] + dice(4)
hook_section(b, 0, extra=[('brass', 74, 0, .9), ('horn', 60, -1, .95), ('glock', 54, 1, .7), ('trp', 66, 1, .85)])
for k in range(4):
    play(b + k, D_CH[k], D_G[k], {'bass', 'b8', 'mar', 'saw', 'pizz', 'str', 'vln', 'stab', 'horn', 'cow', 'h16', 'big'} | ({'crash'} if k == 0 else set()), 0)
for k in range(4, 8):
    ch, g = D_CH[k], D_G[k]
    frag('lead', b + k, ch, g, 0, 4, 98, var=0)
    frag('brass', b + k, ch, g, 0, 4, 72, var=1)
    frag('horn', b + k, ch, g, 0, 3, 62, var=2)
    frag('glock', b + k, ch, g, 0, 5, 54, var=0, legato=.6)
    play(b + k, ch, g, {'bass', 'b8', 'mar', 'saw', 'pizz', 'str', 'vln', 'stab', 'fan', 'cow', 'h16', 'big'} | ({'crash'} if k == 4 else set()) | ({'tom'} if k in (6, 7) else set()), 0)
b += 8

# ── Rückführung (4): Hook einfach und klar, Pegel sinkt, Ende auf E (Dominante → Loop auf Am) ────────────
R_G = HOOK_G[:4]
mel('lead', b, HOOK[:4], HOOK_CH[:4], 0, vel=92)
mel('brass', b, HOOK[:4], HOOK_CH[:4], 0, vel=54, legato=.9)
for k in range(4):
    play(b + k, HOOK_CH[k], R_G[k], {'bass', 'b8', 'mar', 'pizz', 'cow'} | ({'str'} if k >= 2 else set()) | ({'tom'} if k == 3 else set()))
for i in range(8):                                               # Wirbel in die Naht
    song.dr(song.bar(b + 3) + 5.5 + i * .1875, SNARE if i % 2 else TOM_M, 78 + i * 6, .1)
b += 4
assert b == BARS, (b, BARS)

if os.environ.get('SKILLTEST_NORENDER') != '1':
    sf2, out = cli_paths('bgm_skilltest2.ogg')
    song.render(sf2, out, target_rms=0.27, saturate=False, compress=True)
