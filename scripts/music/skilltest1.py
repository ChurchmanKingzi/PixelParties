# -*- coding: utf-8 -*-
"""Skill Test · Track 1 → public/music/bgm_skilltest1.ogg   Titel: „Eight-Way Scramble“

Hardrock/Electro-Mix für den Chaos-Modus „Skill Test“ (bis zu 8 Spieler gleichzeitig).
e-Moll, 176 BPM, 96 Takte (≈ 130,9 s), nahtlos loopbar (Ende auf H7 = Dominante, danach wieder das Em-Riff).

Gedanke: acht Spieler, acht Stimmen. Jede Stimme sitzt an eigener Stelle im Stereobild und steigt einzeln ein;
das Hauptmotiv („Hook“, 8 Takte: e g h – d – … über Em Em C D Em Em C H7) wandert durch Gitarre, Lead-Synth, Trompete,
Blech und wird von allen acht Stimmen gemeinsam gespielt. Dazu Palm-Mute-16tel-Riff gegen Saw-/Square-Arpeggien,
Doppel-Kick, Rockorgel-Stabs, Blechsätze, harte Stopps mit Stutter-Neustart, Tonartrückungen und ein Gitarren-Duell.

Form (Takte, 0-basiert):
  Intro        0– 7  Acht Einsätze, einer pro Takt: Riff-Gitarre · Bass · Saw-Arpeggio · Square-Gegenrhythmus ·
                     Orgel-Stabs · Blech · zweite Gitarre · Lead (Auftakt zum Thema)       Em
  A            8–15  Hauptthema im Lead-Synth                                              Em Em C D | Em Em C H7
  A'          16–23  Thema + Trompete, Toms; Stopp in Takt 23 mit Stutter-Neustart
  B           24–31  Gegenthema (aufsteigende Terzschichten), Arpeggien-Duell; langer Stopp in 31   C D Em Em C D Am H7
  A''         32–39  Thema in Lead + Gitarre (Oktave tiefer) + Trompete, Doppel-Kick; Stopp in 39
  C1          40–47  Rückung nach fis-Moll (+2), Thema im Blech; Stopp in 47
  C2          48–55  Rückung nach g-Moll (+3): „Scramble“ – acht Stimmen jagen sich in Dreiton-Zellen, Snare-Wirbel
  Duell       56–63  a-Moll (+5): zwei Gitarren wechseln sich in Zwei-Takt-Licks ab (links/rechts), Blast-Beat
  Chaos       64–71  Thema in a-Moll, ACHT Stimmen steigen im Takt-Abstand ein (Kanon-Aufbau), Pivot Am – C – H7
  Reprise     72–79  Thema in e-Moll, Gitarrenduell in Oktaven, Stopp in 79
  B'          80–87  Gegenthema, Arpeggien, Blech
  Rückführung 88–95  Riff + Bass + Thema-Fragmente dünnen aus, Orgel-Stabs, Snare-Wirbel, Ende H7 → Loop
"""
import os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 176, 96
song = Song(BPM, BARS)
rng = random.Random(176)

# ── Die acht „Spieler“ + Zusatzstimmen (Pan verteilt über das ganze Stereobild) ─────────────────────
song.inst('gtrA',  'rockgtr',   84, 20)    # Spieler 1: Riff-Gitarre (links)
song.inst('bass',  'sbass',    104, 64)    # Spieler 2: Bass (Mitte)
song.inst('saw',   'saw',       66, 104)   # Spieler 3: Saw-Arpeggio
song.inst('sq',    'square',    62, 38)    # Spieler 4: Square-Gegenrhythmus (punktierte Achtel)
song.inst('org',   'rockorgan', 76, 82)    # Spieler 5: Rockorgel-Stabs
song.inst('brs',   'brass',     84, 54)    # Spieler 6: Blech
song.inst('gtrB',  'rockgtr',   82, 112)   # Spieler 7: zweite Gitarre (rechts)
song.inst('lead',  'charang',   96, 70)    # Spieler 8: Lead-Synth (Thema)
song.inst('trp',   'trumpet',   86, 46)    # Zusatz: Trompete
song.inst('sbr',   'sbrass',    80, 88)    # Zusatz: Synth-Blech (hohe Stabs)
song.inst('duelL', 'rockgtr',   92, 10)    # Duell-Gitarre links
song.inst('duelR', 'rockgtr',   92, 118)   # Duell-Gitarre rechts

# ── Harmonie ──────────────────────────────────────────────────────────────────────────────────────
QUAL = {'m': (0, 3, 7), 'M': (0, 4, 7), '7': (0, 4, 7, 10)}
SCALE = {0, 2, 3, 5, 7, 8, 10, 11}               # natürliches Moll + Leitton
iM, VI, VII, V7, iv = (0, 'm'), (8, 'M'), (10, 'M'), (7, '7'), (5, 'm')
PA = [iM, iM, VI, VII, iM, iM, VI, V7]            # Em Em C D | Em Em C H7
PB = [VI, VII, iM, iM, VI, VII, iv, V7]           # C D Em Em | C D Am H7
PD = [iM, iM, VI, VII, iM, iv, VII, V7]           # Duell (a-Moll): Am Am F G | Am Dm G E7

CHB, KEY = {}, {}
def setprog(b0, shift, degs):
    for k, d in enumerate(degs):
        KEY[b0 + k] = (4 + shift) % 12
        ds = d if isinstance(d, list) else [d]
        w = 4 / len(ds)
        CHB[b0 + k] = []
        for j, x in enumerate(ds):
            pc, q = (x[1], x[2]) if x[0] == 'abs' else ((4 + shift + x[0]) % 12, x[1])
            CHB[b0 + k].append((j * w, w, pc, q))

setprog(0, 0, PA); setprog(8, 0, PA); setprog(16, 0, PA); setprog(24, 0, PB); setprog(32, 0, PA)
setprog(40, 2, PA); setprog(48, 3, PA); setprog(56, 5, PD)
setprog(64, 5, [iM, iM, VI, VII, iM, iM, ('abs', C, 'M'), ('abs', B, '7')])    # Pivot: Am → C → H7 (= iv – VI – V in e)
KEY[70] = KEY[71] = 4
setprog(72, 0, PA); setprog(80, 0, PB); setprog(88, 0, PA)
assert len(CHB) == BARS

def chord_at(t):
    b = int(t // 4); off = t - 4 * b
    for o, d, pc, q in CHB[b]:
        if o <= off < o + d + 1e-9: return pc, q
    return CHB[b][-1][2:]

def voice(pc, q, lo):
    r = lo + ((pc - lo) % 12)
    return [r + i for i in QUAL[q]]
def tones4(pc, q, lo):
    t = voice(pc, q, lo)
    return (t + [t[0] + 12])[:4]
def gbase(pc): return 40 + ((pc - 4) % 12)       # Gitarre E2…D#3
def bbase(pc): return 28 + ((pc - 4) % 12)       # Bass E1…D#2

# ── Stopp-Fenster: dort schweigen alle regulären Stimmen; Stutter-Neustarts sind erzwungen ───────────
MUTE = []
def A(name, beat, dur, pitch, vel, force=False):
    if not force:
        for ws, we in MUTE:
            if ws <= beat < we: return
            if beat < ws < beat + dur: dur = ws - beat
    song.add(name, beat, dur, pitch, vel)
def D(beat, note, vel=100, dur=0.2, force=False): A('drum', beat, dur, note, vel, force)
def hv(v): return int(max(1, min(127, v + rng.randint(-3, 3))))

STOPS = [  # (Takt, Stopp ab Beat, bis Beat, Stutter-Start, Anzahl, Abstand) — Neustart immer auf dem Taktstrich danach
    (23, 2.25, 4.0, 3.0, 4, .25), (31, 1.25, 4.0, 2.5, 3, .5), (39, 2.0, 4.0, 3.0, 8, .125),
    (47, 1.25, 4.0, 2.0, 4, .5), (55, 2.0, 4.0, 3.0, 6, 1 / 6), (63, 3.0, 4.0, None, 0, 0),
    (71, 1.5, 4.0, 3.0, 4, .25), (79, 3.0, 4.0, 3.5, 2, .25),
]
for bar, ws, we, *_ in STOPS: MUTE.append((bar * 4 + ws, bar * 4 + we))

def stutter(bar, t0, n, sp):
    pc, _ = chord_at(bar * 4 + t0)
    for i in range(n):
        t = bar * 4 + t0 + i * sp
        for g in ('gtrA', 'gtrB'):
            A(g, t, 0.14, gbase(pc), min(127, 98 + 4 * i), True); A(g, t, 0.14, gbase(pc) + 7, min(127, 90 + 4 * i), True)
        D(t, SNARE, min(127, 70 + 9 * i), 0.1, True)
        if i % 2 == 0: D(t, KICK, 112, 0.1, True)
        A('bass', t, 0.14, bbase(pc), 112, True)
        if i == 0: A('brs', t, 0.2, voice(pc, 'M', 58)[1], 100, True)
for bar, ws, we, t0, cnt, sp in STOPS:
    if t0 is not None: stutter(bar, t0, cnt, sp)

# ── Begleit-Bausteine ───────────────────────────────────────────────────────────────────────────────
def sym_off(c, q):
    c = c.lower()
    return {'r': 0, 'o': 12, 'b': 3 if q == 'm' else 4, 'f': 7, 's': 10 if q in ('m', '7') else 12}[c]

def pat_layer(inst, b0, n, pat, unit, base, vel, power=True, short=0.2, long=0.45, vmul=0.82):
    """Muster aus Symbolen: r Grundton, o Oktave, b Terz, f Quinte, s Septime; Großbuchstabe = Akzent (Powerchord, offen)."""
    for b in range(b0, b0 + n):
        for off, dur, pc, q in CHB[b]:
            for s, c in enumerate(pat):
                t = s * unit
                if c == '.' or not (off <= t < off + dur): continue
                low = c.islower()
                p = base(pc) + sym_off(c, q)
                v = vel * (vmul if low else 1.0)
                A(inst, b * 4 + t, short if low else long, p, hv(v))
                if power and not low: A(inst, b * 4 + t, long, p + 7, hv(v - 8))

PM16 = 'RrrRrrRrrRrrSrRr'     # Palm-Mute-16tel mit Akzenten (3-3-3-3-2-2)
CHUNK = 'R..R..R.R..R..R.'    # synkopierte Hiebe
GALL = 'RrbRrbRrRrbRrbSr'     # Galopp mit Terz
OCT = 'RrOrRrOrRrOrRrSr'
BS8 = 'RrOrRrOr'              # Bass-Achtel
BS16 = 'RrOrRrOrRrOrRrSr'     # Bass-16tel (mit Doppel-Kick)

def arp_saw(b0, n, vel, lo=57):
    for b in range(b0, b0 + n):
        for off, dur, pc, q in CHB[b]:
            T = tones4(pc, q, lo)
            for s in range(16):
                t = s * .25
                if off <= t < off + dur:
                    A('saw', b * 4 + t, 0.22, T[[0, 1, 2, 3, 2, 1, 0, 1][s % 8]], hv(vel + (10 if s % 4 == 0 else 0)))

def arp_sq(b0, n, vel, lo=66):
    """Gegenrhythmus: punktierte Achtel (0,75 Beat) laufen taktübergreifend gegen die 16tel."""
    t, k, end = b0 * 4, 0, (b0 + n) * 4
    while t < end - 1e-6:
        pc, q = chord_at(t); T = tones4(pc, q, lo)
        A('sq', t, 0.5, T[[0, 2, 1, 3, 2, 1][k % 6]], hv(vel + (8 if k % 2 == 0 else 0)))
        t += .75; k += 1

def cowbell(b0, n, vel=78):
    t, end = b0 * 4, (b0 + n) * 4
    while t < end - 1e-6:
        D(t, COWBELL, vel, 0.1); t += .75

def stabs(inst, b0, n, beats, lo, vel, dur=0.3, ext=False):
    for b in range(b0, b0 + n):
        for off, d, pc, q in CHB[b]:
            for bt in beats:
                if off <= bt < off + d:
                    T = voice(pc, q, lo) + ([voice(pc, q, lo)[0] + 12] if ext else [])
                    for m in T: A(inst, b * 4 + bt, dur, m, hv(vel))

# ── Drums ─────────────────────────────────────────────────────────────────────────────────────────
def fill(t):
    for i, nt in enumerate([SNARE, SNARE, TOM_H, TOM_H, TOM_M, TOM_L]):
        D(t + 2.5 + i * .25, nt, 92 + i * 6, 0.12)

def drums(b0, n, lvl, fill_last=True, crash=True):
    for k in range(n):
        t = (b0 + k) * 4
        if lvl == 1: kicks = [0, 1.5, 2, 3.5]
        elif lvl == 2: kicks = [0, .5, 1.5, 2, 2.5, 3.5]
        elif lvl == 3: kicks = [s * .25 for s in range(16) if s not in (4, 12)]
        else: kicks = [s * .25 for s in range(16)]
        for kt in kicks: D(t + kt, KICK, 112 if (kt % 1 == 0 or lvl < 3) else 96, 0.12)
        for sb in (1, 3):
            D(t + sb, SNARE, 112, 0.14)
            if lvl >= 3: D(t + sb, CLAP, 88, 0.1)
        if lvl == 4:
            for s in (.5, 1.5, 2.5, 3.5): D(t + s, SNARE, 96, 0.1)
        step = 0.25 if lvl == 4 else 0.5
        for i in range(int(4 / step)):
            D(t + i * step, HAT if (i % 4 or lvl < 4) else OHAT, 122 if i % 2 == 0 else 108, 0.08)
        if crash and ((k == 0) or (lvl >= 3 and k % 4 == 0)): D(t, CRASH, 118 if k == 0 else 100, 1.0)
        if fill_last and k == n - 1 and lvl >= 2: fill(t)

def roll(bar, t0, t1, sp, v0, v1):
    n = int(round((t1 - t0) / sp));
    for i in range(n):
        D(bar * 4 + t0 + i * sp, SNARE, int(v0 + (v1 - v0) * i / max(1, n - 1)), 0.08)

# ── Themen (Töne in e-Moll; werden pro Abschnitt transponiert) ────────────────────────────────────────
NAMES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def pn(s):
    a, i = 0, 1
    if s[1] in '#b': a, i = (1 if s[1] == '#' else -1), 2
    return 12 * (int(s[i:]) + 1) + NAMES[s[0]] + a

THEME = [   # Hauptthema A (Hook) — 8 Takte
    [('E5', .5), ('G5', .5), ('B5', 1), ('D6', 1), ('B5', .5), ('G5', 1.5)],                     # Em: e g h – d h g
    [('E5', .5), ('G5', .5), ('B5', 1), ('D6', 1.5), ('B5', .5)],                                # Em
    [('C6', .5), ('B5', .5), ('G5', 1), ('E5', .5), ('G5', .5), ('C6', 1)],                      # C
    [('D6', .5), ('A5', .5), ('F#5', 1), ('A5', .5), ('D6', .5), ('F#6', 1)],                    # D   Anstieg
    [('E6', 1.5), ('D6', .5), ('B5', 1), ('G5', .5), ('B5', .5)],                                # Em  Gipfel
    [('E6', .5), ('D6', .5), ('B5', .5), ('G5', .5), ('B5', 1), ('E5', 1)],                      # Em
    [('C6', 1), ('B5', .5), ('A5', .5), ('G5', 1), ('E5', .5), ('D5', .5)],                      # C
    [('F#5', .5), ('A5', .5), ('B5', .5), ('D#6', .5), ('B5', 1.5), (None, .5)],                 # H7  Leitton, Schleife
]
THEME_B = [  # Gegenthema B — steigende Terzschichten über C D Em Em C D Am H7
    [('G5', .5), ('C6', .5), ('E6', 1), ('D6', .5), ('C6', .5), ('G5', 1)],
    [('A5', .5), ('D6', .5), ('F#6', 1), ('E6', .5), ('D6', .5), ('A5', 1)],
    [('B5', .5), ('E6', .5), ('G6', 1), ('F#6', .5), ('E6', .5), ('B5', 1)],
    [('G6', 1.5), ('F#6', .5), ('E6', 1), ('B5', 1)],
    [('G5', .5), ('C6', .5), ('E6', 1), ('G6', .5), ('E6', .5), ('C6', 1)],
    [('A5', .5), ('D6', .5), ('F#6', 1), ('A6', .5), ('F#6', .5), ('D6', 1)],
    [('A5', .5), ('C6', .5), ('E6', 1), ('A6', 1.5), ('G6', .5)],
    [('D#6', .5), ('F#6', .5), ('B6', 1), ('A6', .5), ('F#6', .5), ('D#6', .5), ('B5', .5)],
]
warn = []
def theme(inst, b0, tab=THEME, shift=0, vel=100, octave=0, start=0, leg=.92, shift_fn=None):
    for k, bar in enumerate(tab):
        if k < start: continue
        sh = shift_fn(k) if shift_fn else shift
        t = (b0 + k) * 4
        for name, dur in bar:
            if name is not None:
                p = pn(name) + sh + 12 * octave
                assert (p - KEY[b0 + k]) % 12 in SCALE, (inst, b0 + k, name, sh)
                pc, q = chord_at(t)
                ok = {(pc + i) % 12 for i in (*QUAL[q], 10, 2)}
                if t % 1 == 0 and p % 12 not in ok: warn.append((b0 + k, name))
                A(inst, t, dur * leg, p, hv(vel))
            t += dur

# ── Gitarren-Licks fürs Duell (Pentatonik/Moll-Skala, seed-gesetzt, enden auf Akkordton) ───────────────
def lick(inst, b0, vel=100, lo=72, hi=90):
    tonic = KEY[b0]
    pool = [p for p in range(lo, hi + 1) if (p - tonic) % 12 in (0, 2, 3, 5, 7, 8, 10)]
    pc_end, q_end = chord_at((b0 + 1) * 4 + 2.5)
    ends = [p for p in pool if (p - pc_end) % 12 in QUAL[q_end]]
    i = rng.randrange(len(pool) // 3, len(pool) * 2 // 3); t = 0.0
    shapes = [(.25, .25, .25, .25), (.5, .5), (.25, .25, .5), (.75, .25), (.5, .25, .25), (1,)]
    while t < 7.0 - 1e-6:
        for d in rng.choice(shapes):
            if t + d > 7.0 + 1e-6: d = 7.0 - t
            if d <= 0: break
            A(inst, b0 * 4 + t, d * .9, pool[i], hv(vel + (8 if t % 1 == 0 else 0)))
            t += d
            i = max(0, min(len(pool) - 1, i + rng.choice([-2, -1, -1, 0, 1, 1, 2, 3])))
    end = min(ends, key=lambda p: abs(p - pool[i]))
    A(inst, b0 * 4 + 7.0, 0.95, end, hv(vel + 10))

# ═══════════════════════════════════════════════════════════════════════════════════════════════════
# Intro (0–7): acht Einsätze, einer pro Takt
pat_layer('gtrA', 0, 8, PM16, .25, gbase, 86)
pat_layer('bass', 1, 7, BS8, .5, bbase, 100, power=False, short=.4, long=.45, vmul=.9)
arp_saw(2, 6, 62)
arp_sq(3, 5, 60)
stabs('org', 4, 4, (0, 1.5, 2.5), 52, 72)
stabs('brs', 5, 3, (0, 2.5), 58, 80, 0.4)
pat_layer('gtrB', 6, 2, CHUNK, .25, gbase, 92)
theme('lead', 0, start=7, vel=98, octave=0)          # Auftakt: letzter Themen-Takt (H7) kündigt das Thema an
drums(0, 4, 2, fill_last=False); drums(4, 4, 3)
cowbell(4, 4, 70)

# A (8–15): Thema im Lead-Synth
theme('lead', 8, vel=100)
pat_layer('gtrA', 8, 8, PM16, .25, gbase, 88)
pat_layer('gtrB', 8, 8, CHUNK, .25, gbase, 86)
pat_layer('bass', 8, 8, BS16, .25, bbase, 100, power=False, short=.2, long=.3, vmul=.9)
arp_saw(8, 8, 56); arp_sq(8, 8, 52)
stabs('org', 8, 8, (0, 1.5, 2.5), 52, 66)
stabs('brs', 8, 8, (0, 2.5), 58, 72, 0.4)
drums(8, 8, 3); cowbell(8, 8)

# A' (16–23): Thema + Trompete, Gitarre im Oktav-Riff, Stopp in Takt 23
theme('lead', 16, vel=100); theme('trp', 16, vel=84, octave=0)
pat_layer('gtrA', 16, 8, OCT, .25, gbase, 90)
pat_layer('gtrB', 16, 8, CHUNK, .25, gbase, 88)
pat_layer('bass', 16, 8, BS16, .25, bbase, 102, power=False, short=.2, long=.3, vmul=.9)
arp_saw(16, 8, 58); arp_sq(16, 8, 54)
stabs('org', 16, 8, (0, 1.5, 2.5, 3.5), 52, 68)
stabs('brs', 16, 8, (0, 1.5, 2.5), 58, 76, 0.4)
drums(16, 8, 3); cowbell(16, 8)

# B (24–31): Gegenthema, Arpeggien-Duell, langer Stopp in 31
theme('lead', 24, THEME_B, vel=100); theme('trp', 24, THEME_B, vel=80)
pat_layer('gtrA', 24, 8, CHUNK, .25, gbase, 90)
pat_layer('gtrB', 24, 8, PM16, .25, gbase, 84)
pat_layer('bass', 24, 8, BS8, .5, bbase, 102, power=False, short=.4, long=.45, vmul=.9)
arp_saw(24, 8, 70); arp_sq(24, 8, 66)
stabs('org', 24, 8, (0, 1.5, 3), 52, 70)
stabs('sbr', 24, 8, (0, 2.5), 66, 66, 0.4)
drums(24, 8, 3); cowbell(24, 8)

# A'' (32–39): Thema in Lead + Gitarre (Oktave tiefer) + Trompete, Doppel-Kick
theme('lead', 32, vel=102); theme('trp', 32, vel=84); theme('duelL', 32, vel=88, octave=-1)
pat_layer('gtrA', 32, 8, PM16, .25, gbase, 90)
pat_layer('gtrB', 32, 8, GALL, .25, gbase, 88)
pat_layer('bass', 32, 8, BS16, .25, bbase, 104, power=False, short=.2, long=.3, vmul=.9)
arp_saw(32, 8, 54); arp_sq(32, 8, 50)
stabs('org', 32, 8, (0, 1.5, 2.5, 3.5), 52, 70)
stabs('brs', 32, 8, (0, 1.5, 2.5), 58, 78, 0.4)
drums(32, 8, 3); cowbell(32, 8)

# C1 (40–47): fis-Moll (+2), Thema im Blech
S = 2
theme('lead', 40, shift=S, vel=100, octave=0); theme('sbr', 40, shift=S, vel=84, octave=0); theme('trp', 40, shift=S, vel=84, octave=-1)
pat_layer('gtrA', 40, 8, OCT, .25, gbase, 92)
pat_layer('gtrB', 40, 8, CHUNK, .25, gbase, 90)
pat_layer('bass', 40, 8, BS16, .25, bbase, 104, power=False, short=.2, long=.3, vmul=.9)
arp_saw(40, 8, 56); arp_sq(40, 8, 52)
stabs('org', 40, 8, (0, 1.5, 2.5, 3.5), 52, 72)
stabs('brs', 40, 8, (0, 1.5, 2.5), 58, 80, 0.4)
drums(40, 8, 3); cowbell(40, 8)

# C2 (48–55): g-Moll (+3), „Scramble“: acht Stimmen jagen sich in aufsteigenden Dreiton-Zellen
theme('lead', 48, shift=3, vel=96, octave=-1); theme('trp', 48, shift=3, vel=80, octave=-1)
pat_layer('gtrA', 48, 8, PM16, .25, gbase, 92)
pat_layer('gtrB', 48, 8, GALL, .25, gbase, 88)
pat_layer('bass', 48, 8, BS16, .25, bbase, 106, power=False, short=.2, long=.3, vmul=.9)
SCR = [('saw', 60), ('sq', 66), ('org', 56), ('brs', 62), ('sbr', 68), ('trp', 64), ('duelL', 58), ('duelR', 70)]
for b in range(48, 56):
    for off, dur, pc, q in CHB[b]:
        T = tones4(pc, q, 0)
        for k, (inst, lo) in enumerate(SCR):
            t0 = off + k * (dur / 8)
            cell = voice(pc, q, lo)
            seq = cell if (b + k) % 2 == 0 else cell[::-1]
            for j, m in enumerate(seq[:3]):
                A(inst, b * 4 + t0 + j * .125, .12, m, hv(60 + k * 2 + (8 if j == 0 else 0)))
stabs('org', 48, 8, (0, 1.5, 2.5, 3.5), 52, 68)
drums(48, 8, 3); cowbell(48, 8)
roll(53, 3.0, 4.0, .125, 60, 100); roll(54, 2.0, 4.0, .125, 70, 110); roll(55, 0.0, 2.0, .0625, 80, 125)

# Duell (56–63): a-Moll (+5), Blast-Beat, zwei Gitarren wechseln sich ab (links/rechts)
for k, (inst, vel) in enumerate([('duelL', 100), ('duelR', 100), ('duelL', 102), ('duelR', 104)]):
    lick(inst, 56 + 2 * k, vel)
pat_layer('gtrA', 56, 8, PM16, .25, gbase, 92)
pat_layer('gtrB', 56, 8, GALL, .25, gbase, 90)
pat_layer('bass', 56, 8, BS16, .25, bbase, 106, power=False, short=.2, long=.3, vmul=.9)
arp_saw(56, 8, 60)
stabs('org', 56, 8, (0, .75, 1.5, 2.5, 3.25), 52, 72)
stabs('brs', 56, 8, (0, 1.5, 2.5), 58, 80, 0.4)
stabs('sbr', 56, 8, (0, 2.5), 66, 70, 0.4)
drums(56, 8, 4); cowbell(56, 8, 74)

# Chaos (64–71): Thema in a-Moll, acht Stimmen steigen im Takt-Abstand ein; Pivot Am – C – H7
fn = lambda k: 5 if k < 6 else 0
ENTRIES = [('lead', 98, -1), ('trp', 86, -1), ('duelR', 90, -1), ('duelL', 90, -2),
           ('sbr', 78, 0), ('brs', 82, -2), ('saw', 66, -1), ('sq', 62, -2)]
for k, (inst, vel, octv) in enumerate(ENTRIES):
    theme(inst, 64, shift_fn=fn, vel=vel, octave=octv, start=k)
pat_layer('gtrA', 64, 8, OCT, .25, gbase, 94)
pat_layer('gtrB', 64, 8, GALL, .25, gbase, 92)
pat_layer('bass', 64, 8, BS16, .25, bbase, 108, power=False, short=.2, long=.3, vmul=.9)
stabs('org', 64, 8, (0, .75, 1.5, 2.5, 3.25), 52, 72)
drums(64, 8, 4); cowbell(64, 8, 74)

# Reprise (72–79): e-Moll, Thema + Duell-Gitarren in Oktaven, Stopp in 79
theme('lead', 72, vel=100); theme('trp', 72, vel=86); theme('duelL', 72, vel=92, octave=-1); theme('duelR', 72, vel=80, octave=0)
pat_layer('gtrA', 72, 8, PM16, .25, gbase, 92)
pat_layer('gtrB', 72, 8, GALL, .25, gbase, 90)
pat_layer('bass', 72, 8, BS16, .25, bbase, 106, power=False, short=.2, long=.3, vmul=.9)
arp_saw(72, 8, 54); arp_sq(72, 8, 50)
stabs('org', 72, 8, (0, 1.5, 2.5, 3.5), 52, 72)
stabs('brs', 72, 8, (0, 1.5, 2.5), 58, 80, 0.4)
stabs('sbr', 72, 8, (0, 2.5), 66, 70, 0.4)
drums(72, 8, 4); cowbell(72, 8, 74)

# B' (80–87): Gegenthema, Arpeggien, Blech
theme('lead', 80, THEME_B, vel=100); theme('duelR', 80, THEME_B, vel=80, octave=-1); theme('sbr', 80, THEME_B, vel=72, octave=0)
pat_layer('gtrA', 80, 8, CHUNK, .25, gbase, 90)
pat_layer('gtrB', 80, 8, PM16, .25, gbase, 86)
pat_layer('bass', 80, 8, BS16, .25, bbase, 104, power=False, short=.2, long=.3, vmul=.9)
arp_saw(80, 8, 66); arp_sq(80, 8, 62)
stabs('org', 80, 8, (0, 1.5, 3), 52, 70)
stabs('brs', 80, 8, (0, 2.5), 58, 78, 0.4)
drums(80, 8, 3); cowbell(80, 8)

# Rückführung (88–95): Riff + Bass + Thema-Fragmente, Orgel-Stabs, Snare-Wirbel, Ende H7
theme('lead', 88, vel=92, octave=-1, leg=.85)
pat_layer('gtrA', 88, 8, PM16, .25, gbase, 90)
pat_layer('gtrB', 92, 4, CHUNK, .25, gbase, 86)
pat_layer('bass', 88, 8, BS8, .5, bbase, 100, power=False, short=.4, long=.45, vmul=.9)
arp_sq(88, 8, 56); arp_saw(92, 4, 56)
stabs('org', 90, 6, (0, 1.5, 2.5), 52, 70)
stabs('brs', 92, 4, (0, 2.5), 58, 76, 0.4)
drums(88, 4, 2, fill_last=False); drums(92, 4, 3, fill_last=False); cowbell(92, 4, 66)
roll(94, 2.0, 4.0, .25, 70, 100); roll(95, 0.0, 3.5, .125, 90, 125)
A('brs', 95 * 4 + 3.5, 0.45, 59, 110); A('gtrA', 95 * 4 + 3.5, .45, gbase(B), 100); A('gtrA', 95 * 4 + 3.5, .45, gbase(B) + 7, 96)

print('Hinweis: Themenstellen auf schwerer Zeit ohne Akkordton:', len(warn), warn[:6])
if os.environ.get('SKILLTEST_NORENDER') != '1':
    sf2, out = cli_paths('bgm_skilltest1.ogg')
    song.render(sf2, out, target_rms=0.27, saturate=False, compress=True)
