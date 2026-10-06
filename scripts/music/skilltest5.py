# -*- coding: utf-8 -*-
"""Skill Test (Chaos-Modus, bis zu 8 Spieler) → public/music/bgm_skilltest5.ogg   Titel: „Pandemonium Protocol“

Drum-&-Bass/Electro-Chaos in h-Moll, 174 BPM, 96 Takte (≈ 2:12).  Zerhackte Breakbeats mit Ghost-Notes und Fills
(seed-gesetzt „umgewürfelt“), Reese-/Acid-Bass mit Wobble (CC11), Synth-Stabs, schnelle Arpeggien, Drops nach Breaks.

Hook („Tresillo-Thema“, 8 Takte): jeder Takt beginnt mit 3 + 3 + 2 Sechzehnteln (Grundton – Terz – Quinte hinauf),
auf den Akkorden Bm – G – D – F#; dazu klopft das Cowbell denselben 3 + 3 + 2-Rhythmus.  Es verwandelt sich:
Intro-Andeutung (Charang) → Saw-Lead → Lead + Charang + Gegenstimme → Half-Time (doppelte Notenwerte) →
Acht-Spieler-Aufbau → Chaos-Höhepunkt in d-Moll und e-Moll → Rückführung.

Acht-Spieler-Motiv: im Chaos-Teil steigen acht Layer (Acid-Bass, Arp 1, Stabs, Lead, Gegenstimme, Arp 2, Blech,
Cowbell/Toms) in zufälliger Reihenfolge nacheinander ein; in der Rückführung steigen sie wieder aus.
Dazu Stopps und Neustarts (alles schweigt, dann Crash), Bass-Wechsel Half-Time ↔ Double-Time, Beschleunigung
der Snare-Wirbel (Achtel → Sechzehntel → 32tel) und Rückungen h → d → e, am Ende Pivot auf F# (Dominante) → Loop.

Form (96 Takte): Intro 8 · A 16 · Break 4 · Drop 16 · Half-Time 8 · Chaos-Aufbau 16 · Höhepunkt 16 · Rückführung 12
"""
import os, sys, random, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 174, 96
song = Song(BPM, BARS)
rng = random.Random(1740)          # Seed: alles „Zufällige“ ist reproduzierbar

song.inst('sub', 'sbass2', vol=104, pan=64)
song.inst('acid', 'acidbass', vol=92, pan=58)
song.inst('sqb', 'squarebass', vol=84, pan=70)
song.inst('lead', 'saw', vol=84, pan=60)
song.inst('lead2', 'charang', vol=70, pan=72)
song.inst('arpA', 'square', vol=62, pan=32)
song.inst('arpB', 'poly', vol=58, pan=98)
song.inst('stab', 'sbrass', vol=74, pan=48)
song.inst('brs', 'sbrass2', vol=70, pan=82)
song.inst('counter', 'basslead', vol=72, pan=84)
song.inst('pad', 'warm', vol=58, pan=64)
song.inst('riser', 'sweep', vol=70, pan=64)
song.inst('hit', 'hit', vol=78, pan=64)

# ── Notenwerkzeug ──────────────────────────────────────────────────────────────────────────────────
NAMES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def pn(s):
    a, i = 0, 1
    if s[1] in '#b':
        a, i = (1 if s[1] == '#' else -1), 2
    return 12 * (int(s[i:]) + 1) + NAMES[s[0]] + a

TONIC = B                                   # h-Moll
SCALE = {0, 2, 3, 5, 7, 8, 10, 11}          # natürliches + harmonisches Moll (Leitton A#)
def in_scale(p, sh): return (p - TONIC - sh) % 12 in SCALE

# Akkorde als (Stufe über Tonika, Qualität)
I, VI, III, V, IV, VII = (0, 'm'), (8, 'M'), (3, 'M'), (7, 'M'), (5, 'm'), (10, 'M')   # Bm G D F# Em A
PA = [I, I, VI, VI, III, III, V, V]         # Themen-Gerüst:   Bm Bm G G D D F# F#
PB = [I, VI, IV, V, I, VII, VI, V]          # Chaos-Gerüst:    Bm G Em F# Bm A G F#

def chord(ch, sh, low):
    """Akkordtöne [Grundton, Terz, Quinte, Oktave]; Grundton im Bereich low … low+11."""
    root, q = ch
    pc = (TONIC + sh + root) % 12
    r = low + (pc - low) % 12
    return [r, r + (3 if q == 'm' else 4), r + 7, r + 12]

# ── Stopps (seed-gesetzt): alles schweigt, danach Neustart mit Crash ────────────────────────────────
STOPS = []
def stop(bar, a, b_): STOPS.append((song.bar(bar) + a, song.bar(bar) + b_))
stop(27, 2.5, 4.0)                                       # Break → Drop
stop(43, 3.0, 4.0)                                       # Drop → Half-Time
stop(51, 3.5, 4.0)                                       # Half-Time → Chaos
for bb in rng.sample([61, 63, 65], 3): stop(bb, 3.0, rng.choice([3.75, 4.0]))   # gewürfelt: Stopps im Chaos
stop(67, 2.5, 4.0)                                       # Chaos → Höhepunkt
stop(75, 3.25, 4.0)                                      # Rückung h→d→e: Neustart
stop(79, 3.0, 4.0)
stop(83, 3.5, 4.0)                                       # Pivot auf F#
RESTARTS = sorted({int(e // 4) for s, e in STOPS if e % 4 == 0})   # Takt nach dem Stopp

def put(name, beat, dur, p, v, sh=0):
    assert in_scale(p, sh), (name, beat, p, sh)
    for s, e in STOPS:
        if s <= beat < e: return
        if beat < s < beat + dur: dur = s - beat
    song.add(name, beat, dur, p, v)

DRV = float(os.environ.get('DRV', '0.8'))          # Schlagzeug-Spitzen (Kick/Snare/Crash) zähmen, damit der Limiter nicht den Pegel frisst
def dput(beat, note, v, dur=0.2):
    for s, e in STOPS:
        if s <= beat < e: return
    if note not in (HAT, OHAT, COWBELL): v = v * DRV
    song.dr(beat, note, max(1, min(127, int(v))), dur)

# ── Hook ────────────────────────────────────────────────────────────────────────────────────────────
# (Sechzehntel-Schritt, Ton, Länge in Sechzehnteln); Takt 1–8 auf Bm Bm G G D D F# F#
THEME = [
    [('B4', 0, 3), ('D5', 3, 3), ('F#5', 6, 2), ('B5', 8, 4), ('A5', 12, 2), ('F#5', 14, 2)],
    [('D5', 0, 3), ('E5', 3, 3), ('F#5', 6, 2), ('B5', 8, 6), ('A5', 14, 2)],
    [('G4', 0, 3), ('B4', 3, 3), ('D5', 6, 2), ('G5', 8, 4), ('E5', 12, 2), ('D5', 14, 2)],
    [('D5', 0, 3), ('E5', 3, 3), ('D5', 6, 2), ('B4', 8, 6), ('A4', 14, 2)],
    [('A4', 0, 3), ('D5', 3, 3), ('F#5', 6, 2), ('A5', 8, 4), ('F#5', 12, 2), ('D5', 14, 2)],
    [('D5', 0, 3), ('E5', 3, 3), ('F#5', 6, 2), ('A5', 8, 6), ('C#6', 14, 2)],
    [('C#5', 0, 3), ('F#5', 3, 3), ('A#5', 6, 2), ('C#6', 8, 4), ('A#5', 12, 2), ('F#5', 14, 2)],
    [('F#5', 0, 3), ('A#5', 3, 3), ('C#6', 6, 2), ('A#5', 8, 4)],
    # 9: Stotter-Variante des letzten Takts (Schluss der Wiederholung)
    [('F#5', 0, 3), ('A#5', 3, 3), ('C#6', 6, 2), ('C#6', 8, 1), ('C#6', 9, 1), ('C#6', 10, 1), ('A#5', 12, 2), ('C#6', 14, 2)],
]
def fits(idx, ch):
    """Schwerpunkte (Schritt 0 und 8) sind Akkordtöne des Akkords ch?"""
    root, q = ch
    cts = {root % 12, (root + (3 if q == 'm' else 4)) % 12, (root + 7) % 12}
    return all((pn(nm) - TONIC) % 12 in cts for nm, st, ln in THEME[idx] if st in (0, 8))
for i, ch in enumerate(PA): assert fits(i, ch), i
assert fits(8, V)
def theme_for(ch):
    c = [i for i in range(8) if fits(i, ch)]
    return rng.choice(c)

def theme(inst, bar, idx, sh, vel, octv=0, stretch=1, legato=0.9, accent=True):
    t0 = song.bar(bar)
    for nm, st, ln in THEME[idx]:
        put(inst, t0 + st * 0.25 * stretch, ln * 0.25 * stretch * legato, pn(nm) + sh + 12 * octv,
            vel + (6 if accent and st in (0, 8) else 0) + rng.randint(-3, 3), sh)

# ── Begleit-Bausteine ───────────────────────────────────────────────────────────────────────────────
def L_sub(b, ch, sh, mode, vel):
    t, r = song.bar(b), chord(ch, sh, 28)[0]
    if mode == 'pulse':
        put('sub', t, 1.5, r, vel, sh); put('sub', t + 2.5, 1.4, r, vel - 8, sh)
    elif mode == 'long':
        put('sub', t, 3.9, r, vel, sh)
    else:                                              # 'eighths'
        for i in range(8): put('sub', t + i * 0.5, 0.42, r if i % 4 != 3 else r + 12, vel - (6 if i % 2 else 0), sh)

HALF_A = [[(0, 0, 3), (3, 0, 1), (5, 2, 1), (6, 0, 2)], [(0, 0, 2), (3, 3, 1), (4, 0, 2), (6, 2, 2)],
          [(0, 0, 4), (4, 0, 1), (6, 1, 1), (7, 0, 1)]]
HALF_B = [[(0, 0, 2), (2, 0, 1), (3, 2, 1), (4, 3, 2), (6, 0, 2)], [(0, 0, 3), (3, 0, 1), (4, 2, 2), (6, 1, 1), (7, 0, 1)],
          [(0, 3, 2), (2, 2, 2), (4, 0, 2), (6, 2, 1), (7, 3, 1)], [(0, 0, 4), (4, 0, 2), (6, 2, 2)]]
GROUP = {}
def gchoice(key, pool):
    if key not in GROUP: GROUP[key] = rng.randrange(len(pool))
    return pool[GROUP[key]]

def wobble(name, t, period, lo=52, hi=127):
    for i in range(32):
        ph = (i * 0.125) / period
        song.cc(name, t + i * 0.125, 11, int(lo + (hi - lo) * (0.5 + 0.5 * math.sin(2 * math.pi * ph + math.pi / 2))))

def L_acid(b, ch, sh, mode, vel, wob):
    t, T = song.bar(b), chord(ch, sh, 40)
    if wob: wobble('acid', t, 0.5 if mode != 'half' else 1.0)
    else: song.cc('acid', t, 11, 127)
    if mode == 'half':
        for st, ti, ln in [(0, 0, 11), (11, 2, 2), (13, 0, 3)]:
            put('acid', t + st * 0.25, ln * 0.25 * 0.95, T[ti], vel + (6 if st == 0 else 0), sh)
        return
    pa = gchoice(('A', b // 4), HALF_A)
    pb = rng.choice(HALF_B)
    for st, ti, ln in pa + [(s + 8, a, l) for s, a, l in pb]:
        put('acid', t + st * 0.25, ln * 0.25 * 0.95, T[ti], vel + (8 if st in (0, 8) else 0) + rng.randint(-3, 3), sh)

DBL = [[0, 0, 2, 0, 0, 3, 0, 2, 0, 0, 2, 3, 0, 2, 0, 3], [0, 3, 0, 2, 0, 3, 2, 0, 0, 0, 3, 0, 2, 0, 2, 3]]
def L_sqb(b, ch, sh, vel):
    t, T = song.bar(b), chord(ch, sh, 40)
    p1 = gchoice(('D', b // 4), DBL); p2 = rng.choice(DBL)
    for i in range(16):
        ti = p1[i] if i < 8 else p2[i]
        put('sqb', t + i * 0.25, 0.22, T[ti], vel + (8 if i % 4 == 0 else 0) + rng.randint(-3, 3), sh)

ARP_POOL = [(0, 1, 2, 3, 2, 1), (0, 2, 1, 3), (3, 2, 1, 0, 1, 2), (0, 1, 2, 1), (0, 2, 3, 2, 1, 2, 0, 1)]
def L_arp(name, b, ch, sh, low, vel, three=False, step=0.25):
    t, T = song.bar(b), chord(ch, sh, low)
    pat = rng.choice(ARP_POOL)
    if three: pat = tuple(min(x, 2) if x != 3 else 1 for x in pat)       # nur Dreiklang ohne Oktave
    for i in range(int(4 / step)):
        put(name, t + i * step, step * 0.85, T[pat[i % len(pat)]], vel + (9 if i % 4 == 0 else 0) + rng.randint(-3, 3), sh)

STAB_R = [[0, 1.5, 2.75], [0, 0.75, 2.0, 3.25], [0.5, 1.75, 3.0], [0, 0.75, 1.5, 2.25, 3.0]]
def L_stab(b, ch, sh, vel):
    t, T = song.bar(b), chord(ch, sh, 48)
    for bt in rng.choice(STAB_R):
        for m in T[:3]: put('stab', t + bt, 0.3, m, vel + rng.randint(-3, 3), sh)

def L_brs(b, ch, sh, vel):
    t, T = song.bar(b), chord(ch, sh, 55)
    for bt, d in ((0, 1.1), (1.75, 0.4), (2.5, 0.4)):
        for m in T[:3]: put('brs', t + bt, d, m, vel + (6 if bt == 0 else 0), sh)

def L_counter(b, ch, sh, vel):
    """Gegenstimme: synkopierte Akkordton-Figur zwischen den Hook-Einsätzen."""
    t, T = song.bar(b), chord(ch, sh, 55)
    for st, ti in zip((2, 5, 9, 12, 14), rng.choice([(2, 1, 0, 1, 2), (0, 1, 2, 1, 0), (1, 2, 0, 2, 1)])):
        put('counter', t + st * 0.25 + 0.0, 0.4, T[ti], vel + rng.randint(-3, 3), sh)

def L_tomfx(b, vel):
    t = song.bar(b)
    for st in (0, 3, 6, 8, 11, 14):                    # Hook-Rhythmus 3+3+2 (+ 3+3+2) im Cowbell
        dput(t + st * 0.25, COWBELL, vel + (10 if st in (0, 8) else 0), 0.15)
    dput(t + 3.5, TOM_L, vel + 8, 0.2)

def L_pad(b, ch, sh, vel):
    t, T = song.bar(b), chord(ch, sh, 48)
    for m in T[:3]: put('pad', t, 3.95, m, vel, sh)

# ── Schlagzeug ─────────────────────────────────────────────────────────────────────────────────────
KP = [[0, 2.5], [0, 0.75, 2.5], [0, 2, 2.75], [0, 1.75, 2.5], [0, 0.75, 2.0, 2.75], [0, 1.5, 2.5, 3.25]]
GHOSTS = [0.75, 1.75, 2.25, 3.25, 3.5, 1.25]
def drums(b, level, half=False, fill=False, dice=0.0, crash=False, vel=0):
    t = song.bar(b)
    ev = []                                            # (Beat, Note, Velocity)
    if half:
        for kb in (0, 1.75 if rng.random() < .5 else 0.75):
            ev.append((kb, KICK, 112))
        if rng.random() < .5: ev.append((3.25, KICK, 100))
        ev += [(2, SNARE, 118), (2, CLAP, 80)]
        for i in range(16): ev.append((i * 0.25, HAT, (112 if i % 4 == 2 else 100) + rng.randint(-4, 4)))
        for g in rng.sample(GHOSTS, 2): ev.append((g, SNARE, 44))
    else:
        kp = gchoice(('K', b // 4), KP) if rng.random() >= dice else rng.choice(KP)
        if level == 2: kp = [0, 2.5]
        for kb in kp: ev.append((kb, KICK, 116 if kb in (0, 2.5) else 104))
        ev += [(1, SNARE, 116), (3, SNARE, 118), (1, CLAP, 76), (3, CLAP, 82)]
        if level >= 3:
            for g in rng.sample(GHOSTS, 3): ev.append((g, SNARE, rng.randint(38, 52)))
            for i in range(16):
                if i % 4 != 0 and rng.random() < 0.14: continue
                ev.append((i * 0.25, HAT, (116 if i % 4 == 0 else 108 if i % 2 == 0 else 98) + rng.randint(-4, 4)))
            if rng.random() < 0.35: ev.append((3.5 if rng.random() < .5 else 1.5, OHAT, 108))
            if rng.random() < 0.3: ev.append((rng.choice([0.5, 2.0, 3.75]), TOM_M, 96))
        else:
            for i in range(8): ev.append((i * 0.5, HAT, (118 if i % 2 else 108) + rng.randint(-3, 3)))
            ev.append((rng.choice(GHOSTS), SNARE, 46))
    fs = 4.0
    if fill:
        fs = rng.choice([2.0, 2.5, 3.0])
        kind = rng.randrange(4)
        steps = int(round((4 - fs) / 0.25))
        add = []
        for i in range(steps):
            bt = fs + i * 0.25; k = i / max(1, steps - 1)
            if kind == 0: add.append((bt, SNARE, 68 + 52 * k))
            elif kind == 1:
                add.append((bt, [TOM_HH, TOM_H, TOM_M, TOM_L][i % 4], 100 + 18 * k))
                if i % 4 == 0: add.append((bt, KICK, 110))
            elif kind == 2:
                add.append((bt, SNARE if i % 2 else KICK, 80 + 40 * k))
                if bt >= 3.5: add += [(bt + 0.125, SNARE, 70 + 50 * k)]
            else:
                add.append((bt, [KICK, SNARE, TOM_M, SNARE][i % 4], 90 + 28 * k))
        ev = [e for e in ev if e[0] < fs] + add
    if crash: ev.append((0, CRASH, 112))
    if b in RESTARTS: ev.append((0, CRASH, 120)); ev.append((0, KICK, 124))
    for bt, nt, v in ev: dput(t + bt, nt, min(127, v + vel), 0.15 if nt != CRASH else 1.0)

def acc_roll(b0, nbars, vel0=58, vel1=122):
    """Beschleunigender Snare-Wirbel: Achtel → Sechzehntel → 32tel (Dichte verdoppelt sich je Takt)."""
    total = sum(min(32, 4 * 2 ** k) for k in range(nbars)); c = 0
    for k in range(nbars):
        d = min(32, 4 * 2 ** k)
        for i in range(d):
            dput(song.bar(b0 + k) + i * 4.0 / d, SNARE, vel0 + (vel1 - vel0) * (c + i) / total, 0.1)
        c += d

# ═══════════════════════════════════════════════════════════════════════════════════════════════════
# Plan je Takt: Akkord, Tonart, Layer-Menge, Drum-Optionen, Bass-Modus, Hook-Einsatz
plan = [dict(ch=I, sh=0, L=set(), lvl=3, half=False, dice=0.0, sub='pulse', acid='roll', wob=False,
             theme=None, tv=0, hv=0) for _ in range(BARS)]
def P(b0, n, **kw):
    for b in range(b0, b0 + n):
        for k, v in kw.items():
            plan[b][k] = v(b - b0) if callable(v) else v

# ── Intro (0–7): Beat läuft sofort, Hook-Andeutung im Charang ab Takt 4 ───────────────────────────────
P(0, 8, ch=lambda k: [I, I, VI, VI][k % 4], lvl=2, hv=-2)
for b in range(0, 8): plan[b]['L'] |= {'sub', 'arpA'}
for b in range(2, 8): plan[b]['L'] |= {'stab'}
for b in range(4, 8): plan[b]['L'] |= {'acid', 'lead2'}; plan[b]['theme'] = (b - 4, 1, 'lead2')
plan[0]['L'] |= {'acid'}; plan[1]['L'] |= {'acid'}
# ── A (8–23): Hook im Saw-Lead; zweite Hälfte mit Charang-Doppelung und Gegenstimme ───────────────────
P(8, 16, ch=lambda k: PA[k % 8], lvl=3, dice=0.15)
P(8, 8, lvl=2)
for b in range(8, 24): plan[b]['L'] |= {'sub', 'acid', 'arpA', 'lead', 'stab'}
for b in range(8, 24):
    k = (b - 8) % 8
    plan[b]['theme'] = ((8 if (b == 23) else k), 1, 'lead')
for b in range(16, 24): plan[b]['L'] |= {'lead2', 'counter'}
# ── Break (24–27): Riser, Snare-Beschleunigung, Stopp ─────────────────────────────────────────────────
P(24, 4, ch=lambda k: [VI, IV, V, V][k], lvl=0)
for b in range(24, 28): plan[b]['L'] |= {'pad', 'arpA', 'arpB', 'riser', 'sub', 'brs'}; plan[b]['sub'] = 'long'
# ── Drop (28–43): Reese-Wobble, voller Breakbeat ───────────────────────────────────────────────────────
P(28, 16, ch=lambda k: PA[k % 8], lvl=3, dice=0.3, wob=True, hv=3)
for b in range(28, 44):
    plan[b]['L'] |= {'sub', 'acid', 'arpB', 'stab', 'lead', 'lead2'}
    plan[b]['theme'] = ((8 if b == 43 else (b - 28) % 8), 1, 'lead')
for b in range(36, 44): plan[b]['L'] |= {'counter', 'brs', 'tomfx'}
# ── Half-Time (44–51): Hook in doppelten Notenwerten, Wobble in Halbzeit ───────────────────────────────
P(44, 8, ch=lambda k: PA[k], lvl=3, half=True, sub='long', acid='half', wob=True, dice=0.2)
for b in range(44, 52): plan[b]['L'] |= {'sub', 'acid', 'arpA', 'arpB', 'pad', 'lead'}
for b in (44, 46, 48, 50): plan[b]['theme'] = ((b - 44), 2, 'lead')      # Quelltakte 0, 2, 4, 6 (Bm, G, D, F#)
for b in range(48, 52): plan[b]['L'] |= {'stab'}
# ── Chaos-Aufbau (52–67): acht Layer steigen in gewürfelter Reihenfolge nacheinander ein ────────────────
ORD = ['acid', 'arpA', 'stab', 'lead', 'counter', 'arpB', 'brs', 'tomfx']
rng.shuffle(ORD)
ORD.remove('lead'); ORD.insert(2, 'lead')                 # Hook kommt früh, damit er erkennbar bleibt
P(52, 8, ch=lambda k: PA[k], lvl=3, dice=0.5, sub='pulse')
for b in range(52, 60):
    plan[b]['L'] |= {'sub'} | set(ORD[:b - 52 + 1])
    plan[b]['theme'] = (b - 52, 1, 'lead')
P(60, 8, ch=lambda k: PB[k], lvl=3, dice=0.9)
MODES = ['roll', 'double', 'half', 'double']
for b in range(60, 68):
    m = MODES[(b - 60) // 2]
    plan[b].update(acid=m if m != 'double' else 'double', half=(m == 'half'), wob=(m != 'roll'), sub='long' if m == 'half' else 'eighths' if m == 'double' else 'pulse')
    plan[b]['L'] |= {'sub'} | set(ORD) | {'lead2'}
    plan[b]['theme'] = (theme_for(plan[b]['ch']), 1, 'lead')
P(52, 16, hv=lambda k: 2 + k // 4)
# ── Höhepunkt (68–83): Rückung h → d → e, alle Layer, Double-Time-Bass ─────────────────────────────────
for b in range(68, 84):
    k = b - 68
    sh = 3 if k < 8 else 5
    plan[b].update(ch=PA[k % 8], sh=sh, lvl=3, dice=0.8, hv=6, wob=True)
    plan[b]['L'] |= {'sub', 'acid', 'sqb', 'arpA', 'arpB', 'stab', 'lead', 'lead2', 'counter', 'brs', 'tomfx'}
    plan[b]['theme'] = (8 if k in (7,) else k % 8, 1, 'lead')
    m = ('double', 'double', 'double', 'double', 'half', 'half', 'double', 'double',
         'roll', 'roll', 'double', 'double', 'double', 'double', 'double', 'pivot')[k]
    plan[b]['acid'] = 'roll' if m == 'double' else m
    plan[b]['sub'] = 'long' if m == 'half' else 'eighths' if m == 'double' else 'pulse'
    plan[b]['half'] = (m == 'half')
    plan[b]['sqb'] = (m == 'double')
plan[83].update(ch=V, sh=0, acid='roll', sub='eighths', theme=None, sqb=False)      # Pivot: F# (Dominante von h)
plan[83]['L'] -= {'lead', 'lead2', 'counter', 'sqb'}
# ── Rückführung (84–95): Layer steigen aus, Ende auf F# → Loop ──────────────────────────────────────────
P(84, 12, ch=lambda k: (PA + [I, VI, IV, V])[k], lvl=3, dice=0.3, hv=2)
EXIT = ['brs', 'tomfx', 'arpB', 'counter', 'stab', 'lead2', 'lead']
LAYERS = {'sub', 'acid', 'arpA', 'arpB', 'stab', 'lead', 'lead2', 'counter', 'brs', 'tomfx'}
for b in range(84, 96):
    gone = set(EXIT[:b - 84 + 1])
    plan[b]['L'] |= LAYERS - gone
    if b < 89: plan[b]['theme'] = (b - 84, 1, 'lead')
plan[95]['L'] |= {'pad'}

# ── Umsetzung ──────────────────────────────────────────────────────────────────────────────────────
CRASH_BARS = {8, 16, 28, 36, 44, 52, 60, 68, 76, 84}
for b in range(BARS):
    Q = plan[b]; ch, sh, L, t = Q['ch'], Q['sh'], Q['L'], song.bar(b)
    iv = Q['hv']
    # Schlagzeug
    last4 = (b % 4 == 3)
    if 24 <= b < 28:                                   # Break: kein Kick, Hi-Hat-Achtel + Snare-Wirbel (unten)
        if b == 24:
            dput(t, CRASH, 112, 1.0); song.add('hit', t, 0.8, chord(ch, 0, 36)[0], 100)
        for i in range(8): dput(t + i * 0.5, HAT, 108 + (8 if i % 2 else 0))
    else:
        drums(b, Q['lvl'], half=Q['half'], fill=(last4 or b in (67, 83, 95)),
              dice=Q['dice'], crash=b in CRASH_BARS, vel=iv)
    # Bass
    if 'sub' in L: L_sub(b, ch, sh, Q['sub'], 100 + iv)
    if 'acid' in L:
        if Q['acid'] == 'double': pass
        else: L_acid(b, ch, sh, Q['acid'], 88 + iv, Q['wob'])
    if 'acid' in L and Q['acid'] == 'double':
        L_sqb(b, ch, sh, 84 + iv)
    elif Q.get('sqb') and 'sqb' in L:
        L_sqb(b, ch, sh, 80 + iv)
    # Harmonie/Arpeggien
    if 'arpA' in L:
        L_arp('arpA', b, ch, sh, 48, 56 + iv, three=True, step=0.5 if (24 <= b < 28 or Q['half']) else 0.25)
    if 'arpB' in L: L_arp('arpB', b, ch, sh, 76, 46 + iv, step=0.25)
    if 'stab' in L: L_stab(b, ch, sh, 72 + iv)
    if 'brs' in L: L_brs(b, ch, sh, 70 + iv)
    if 'counter' in L: L_counter(b, ch, sh, 78 + iv)
    if 'tomfx' in L: L_tomfx(b, 92 + iv)
    if 'pad' in L: L_pad(b, ch, sh, 40 if b not in range(24, 28) else 64)
    # Hook
    if Q['theme'] is not None:
        idx, stretch, who = Q['theme']
        if who == 'lead2':
            theme('lead2', b, idx, sh, 78 + iv)
        else:
            theme('lead', b, idx, sh, 92 + iv, stretch=stretch)
            if 'lead2' in L: theme('lead2', b, idx, sh, 66 + iv, stretch=stretch, accent=False)
    # Riser (Break): Sweep mit steigender Expression
    if 'riser' in L:
        T = chord(ch, sh, 60)
        for m in T[:3]: song.add('riser', t, 3.95, m, 80)
        for i in range(8): song.cc('riser', t + i * 0.5, 11, 30 + (b - 24) * 24 + i * 3)

# Break: Snare-Wirbel beschleunigt, Kick setzt aus; letzter Break-Takt endet im Stopp
acc_roll(24, 4, 50, 120)
# Vor dem Chaos-Höhepunkt und vor dem Half-Time-Ende beschleunigende Wirbel
acc_roll(66, 2, 60, 122)
acc_roll(74, 1, 80, 118)
acc_roll(82, 1, 80, 120)
acc_roll(94, 1, 80, 120)
acc_roll(50, 2, 50, 118)
# Crash + Orchestertreffer an den Neustarts
for rb in RESTARTS:
    song.add('hit', song.bar(rb), 0.7, chord(plan[rb]['ch'], plan[rb]['sh'], 36)[0], 104)
song.add('hit', song.bar(28), 0.9, 47, 104)

if os.environ.get('SKILLTEST_NORENDER') != '1':
    sf2, out = cli_paths('bgm_skilltest5.ogg')
    song.render(sf2, out, target_rms=0.27, saturate=False, compress=True)
