# -*- coding: utf-8 -*-
"""Held-Theme „Critical Meltdown“ (Chaos-Diamond, the Cracked Keeper) → public/music/bgm_chaosdiamond.ogg

Ein gesprungener Diamant-Wächter, dessen Steuerung versagt: cis-Moll (mit Neapolitaner D und
Tritonus G), 156 BPM, 80 Takte (123,1 s), nahtlos loopbar. Kalte Maschinen-Präzision, die zerfällt:
Luftschutz-Sirenen (Pitch-Bend-Wails als Gegenstimme und Alarm-Signal), beschleunigende Ostinati
(Achtel → Triolen → 16tel → 32tel), Glitch-Stutter (kurze Noten-Schleifen, die abbrechen),
harte Stopps und Neustarts, splitterndes Glas (Crystal/Glock/Bell, Cowbell).
Hauptmotiv „Riss“: cis-cis-d-cis (kleine Sekunde als Sprung im Diamanten) + lange Note.

Aufbau (Takte, 0-basiert):
   0– 3  Intro „System läuft an“   Puls ab Takt 1, Ostinato in Achteln, erste Sirene, Glas-Klirren
   4–19  Thema A „Riss“            Hauptmotiv (Saw-Lead), Bass-16tel, Sirenen-Gegenstimme in der 2. Hälfte
  20–35  Warnstufen B              Wurzeln steigen (cis-d-e-fis-g-gis-a-h), Ostinato beschleunigt je 4 Takte
                                   (8tel → Triolen → 16tel → 32tel), Alarm-Sirenen, Stutter
  36–47  Kontrollverlust C         Tritonus-Wechsel, Stutter-Schleifen, harte Stopps, Zufalls-Splitter (Seed)
  48–63  Kernschmelze D            Hymne in Oktaven, zwei Sirenen in Gegenbewegung, 16tel-Bass, Doppelfüße
  64–71  Selbstreparatur E         harter Stopp, Neustart-Versuche (Fehlstarts), Reparatur-Arpeggien steigen
  72–79  Rückführung F             Wieder-Anlauf, Ostinato beschleunigt, Sirenen-Anstieg, Dominant gis → Takt 0

Der Loop endet bewusst auf der Dominante (gis, Halbschluss); keine Schlusskadenz.
Aufruf:  python3 scripts/music/hero_chaosdiamond.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os, random, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 156, 80                      # 80 × 4 × 60/156 = 123,1 s
song = Song(bpm=BPM, bars=BARS)
rng = random.Random(1313)                # reproduzierbarer Zufall

# ---- Stimmen ---------------------------------------------------------------------------
song.inst('bass',   'acidbass',   96, 62)
song.inst('sub',    'squarebass', 84, 64)
song.inst('arp',    'square',     70, 36)    # kalte Maschinen-Ostinati
song.inst('lead',   'saw',        88, 70)
song.inst('lead2',  'charang',    80, 58)
song.inst('sir1',   'square',     74, 24)    # Sirene links
song.inst('sir2',   'sine',       86, 104)   # Sirene rechts
song.inst('stab',   'sbrass',     84, 76)
song.inst('hit',    'hit',        98, 64)
song.inst('pad',    'synstr2',    70, 48)
song.inst('bell',   'bell',       80, 90)
song.inst('glock',  'glock',      78, 40)
song.inst('crys',   'crystal',    74, 78)
song.inst('tick',   'marimba',    84, 54)

for nm in ('sir1', 'sir2'):                       # Bend-Range 12 Halbtöne
    song.cc(nm, 0, 101, 0); song.cc(nm, 0, 100, 0); song.cc(nm, 0, 6, 12)

# ---- Tonvorrat: cis-Moll + Neapolitaner (d) + Tritonus (g) ------------------------------
SC = [1, 2, 3, 4, 6, 7, 8, 9, 11]          # cis d dis e fis g gis a h
SCALE_NOTES = [p for p in range(24, 108) if p % 12 in SC]
def step(p, k):
    return SCALE_NOTES[SCALE_NOTES.index(p) + k]
NAMES = {'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'Bb': 10, 'B': 11}
def nt(s):
    i = 2 if s[1] in '#b' else 1
    return n(NAMES[s[:i]], int(s[i:]))
def chk(p):
    assert p % 12 in SC, f'Ton außerhalb der Skala: {p}'
    return p

# Akkord = (Grundton-pc, Art)   Art: m, M, 5 (Powerchord)
CH = {'C#m': (1, 'm'), 'D': (2, 'M'), 'A': (9, 'M'), 'B': (11, 'M'), 'E': (4, 'M'), 'F#m': (6, 'm'),
      'G': (7, 'M'), 'G#': (8, '5'), 'C#5': (1, '5'), 'G5': (7, '5'), 'D5': (2, '5')}
def rootnote(ch, base):              # Grundton im Bereich base..base+11
    pc = CH[ch][0]; return base + (pc - base) % 12
def tones(ch, base):
    r = rootnote(ch, base); k = CH[ch][1]
    return [r, r + {'m': 3, 'M': 4, '5': 7}[k], r + 7, r + 12]
def crack(p): return step(chk(p), 1)   # nächste Skalenstufe über p (bei Wurzel cis: d)

def ramp(i, cnt, a, b): return a + (b - a) * i / max(1, cnt - 1)
def S(b, off=0): return song.bar(b) + off

# ---- Harmonieplan -----------------------------------------------------------------------
PROG = {}
def setp(a, lst):
    for i, c in enumerate(lst): PROG[a + i] = c
setp(0, ['C#m', 'C#m', 'C#m', 'G#'])
setp(4, ['C#m', 'C#m', 'D', 'C#m', 'A', 'B', 'G#', 'G#'] * 2)
setp(20, [c for c in ['C#m', 'D', 'E', 'F#m', 'G', 'G#', 'A', 'B'] for _ in (0, 1)])
setp(36, ['C#5', 'G5', 'C#5', 'G5', 'D5', 'G#', 'D5', 'G#', 'C#5', 'G5', 'G#', 'G#'])
setp(48, ['C#m', 'A', 'E', 'B', 'F#m', 'D', 'G#', 'G#', 'C#m', 'D', 'A', 'B', 'F#m', 'G', 'G#', 'G#'])
setp(64, ['C#m'] * 4 + ['A', 'A', 'B', 'B'])
setp(72, ['C#m', 'C#m', 'A', 'A', 'D', 'B', 'G#', 'G#'])
assert len(PROG) == BARS

# ---- Pitch-Bend: Sirenen ------------------------------------------------------------------
SEMI = 8192 / 12
def bend(name, beat, semi):
    ch = song.ch[name][0]
    song.ev.append((int(round(beat * TPB)), 0, mido.Message('pitchwheel', channel=ch, pitch=int(max(-8192, min(8191, semi * SEMI))))))
def siren(name, beat, dur, pitch, vel, lo, hi, cycles=1.0, shape='wail', steps_per_beat=8):
    """Luftschutz-Wail: Ton gleitet auf-und-ab (wail) oder nur auf/ab (rise/fall) zwischen lo..hi Halbtönen."""
    steps = max(4, int(dur * steps_per_beat))
    for i in range(steps + 1):
        f = i / steps
        if shape == 'wail': x = 0.5 - 0.5 * math.cos(2 * math.pi * cycles * f)
        elif shape == 'rise': x = f ** 1.5
        else: x = 1 - f ** 1.5
        bend(name, beat + dur * f, lo + (hi - lo) * x)
    song.add(name, beat, dur, pitch, vel)
    bend(name, beat + dur + 0.02, 0)

# ---- Bausteine --------------------------------------------------------------------------
def bass16(b, ch, kind, vel=96, lo=36):
    """Bassfiguren: eighth, gallop, sixteenth, sync."""
    s = S(b); r = rootnote(ch, lo); o = r + 12
    if kind == 'eighth':
        for i in range(8): song.add('bass', s + i * .5, .42, r if i % 4 != 3 else o, vel + (8 if i % 2 == 0 else 0))
    elif kind == 'gallop':
        for q in range(4):
            for off, v in ((0, 8), (.5, -8), (.75, -4)): song.add('bass', s + q + off, .22 if off else .4, r, vel + v)
    elif kind == 'sixteenth':
        for i in range(16): song.add('bass', s + i * .25, .2, r if i % 8 != 7 else o, vel + (8 if i % 4 == 0 else -6))
    elif kind == 'sync':
        for off, d in ((0, .75), (.75, .75), (1.5, .5), (2, .75), (2.75, .5), (3.25, .5), (3.75, .25)):
            song.add('bass', s + off, d * .9, r if off != 3.25 else o, vel)
def subpad(b, ch, vel=82):
    song.add('sub', S(b), 3.95, rootnote(ch, 24), vel)

def acc_bar(b, ch, level, vel=70, inst='arp', cyc=None):
    """Beschleunigendes Ostinato: level 0 = Achtel, 1 = Triolen, 2 = 16tel, 3 = 16tel→32tel, 4 = 32tel."""
    s = S(b); t = tones(ch, 48)
    cyc = cyc or [t[0], t[2], t[3], t[2]]
    rates = {0: [2, 2, 2, 2], 1: [3, 3, 3, 3], 2: [4, 4, 4, 4], 3: [4, 4, 8, 8], 4: [8, 8, 8, 8]}[level]
    i = 0
    for q, r in enumerate(rates):
        for k in range(r):
            song.add(inst, s + q + k / r, 0.8 / r, cyc[i % len(cyc)], vel + (10 if k == 0 else 0)); i += 1

def stutter(inst, beat, cell, stepb, count, v0, v1, frac=0.62):
    """Glitch-Stutter: kurze Zell-Schleife, die nach `count` Tönen abrupt abbricht."""
    for i in range(count):
        song.add(inst, beat + i * stepb, stepb * frac, cell[i % len(cell)], ramp(i, count, v0, v1))

def snare_acc(b, start, v0, v1):
    """Snare-Wirbel, der von Achteln über Triolen zu 16teln und 32teln beschleunigt."""
    pos = []; q = start
    seq = [2, 3, 4, 8, 8, 8, 8, 8]
    k = 0
    while q < 4 - 1e-9:
        r = seq[min(k, len(seq) - 1)]; r = r if q + 1 <= 4 else 4
        for j in range(r): pos.append(q + j / r)
        q += 1; k += 1
    for i, p in enumerate(pos): song.dr(S(b, p), SNARE, ramp(i, len(pos), v0, v1), 0.1)

def line(b, notes, insts, vels, shift=0):
    for off, dur, p in notes:
        for inst, v in zip(insts, vels):
            song.add(inst, S(b, off), dur * .94, chk(nt(p) + shift), v)

def hit(b, beat, ch, vel=110, dur=1.0):
    for p in tones(ch, 48): song.add('hit', S(b, beat), dur, p, vel)
def pad(b, ch, vel):
    for p in tones(ch, 60)[:3]: song.add('pad', S(b), 3.95, p, vel)
def stabs(b, ch, vel=84, pat=(0, 1.5, 3)):
    t = tones(ch, 60)
    for off in pat:
        for p in (t[0], t[1], t[2]): song.add('stab', S(b, off), .5, p, vel + (8 if off == 0 else 0))
def glass(b, ch, count, vel=80, lo=84):
    """Splitterndes Glas: Skalentöne hoch, zufällige 16tel-Positionen (Seed)."""
    for _ in range(count):
        inst = rng.choice(['crys', 'glock', 'bell'])
        p = chk(rng.choice([q for q in SCALE_NOTES if lo <= q <= lo + 14]))
        song.add(inst, S(b, rng.randrange(16) * .25), .5, p, vel + rng.randrange(-8, 9))
def alarm(b, beat, ch, vel=100, up=7):
    """Alarmsignal zweier gegenläufiger Sirenen (Übergänge)."""
    r = rootnote(ch, 72)
    siren('sir1', S(b, beat), 2, r, vel, 0, up, 1.0)
    siren('sir2', S(b, beat), 2, r + 7, vel - 6, 0, -up, 1.0)

# ---- Schlagzeug ---------------------------------------------------------------------------
def cow(b, offs, vel, note=COWBELL):
    for o in offs: song.dr(S(b, o), note, vel, 0.1)
def groove(b, kind, v=1.0):
    s = S(b)
    def d(off, note, vel): song.dr(s + off, note, min(127, vel * v), 0.15)
    if kind == 'A':                         # Maschine: Kick-Muster, Snare 2/4, Hat-Achtel, Cowbell-Klirren
        for off, vel in ((0, 114), (0.75, 88), (2, 104), (2.5, 94)): d(off, KICK, vel)
        d(1, SNARE, 108); d(3, SNARE, 112); d(3.75, SNARE, 80)
        for i in range(8): d(i * .5, HAT, 106 if i % 2 == 0 else 84)
        d(1.5, COWBELL, 78); d(3.5, COWBELL, 84)
    elif kind == 'B':                       # Warnstufe: Vierviertel-Kick, Clap, Cowbell-16tel
        for q in range(4): d(q, KICK, 112 if q % 2 == 0 else 98)
        d(1, SNARE, 112); d(3, SNARE, 116); d(1, CLAP, 86); d(3, CLAP, 90)
        for i in range(16): d(i * .25, HAT, 100 if i % 4 == 0 else 78)
        for q in range(4): d(q + .5, COWBELL, 82)
    elif kind == 'C':                       # Kernschmelze: Doppelfuß, Toms, Ride/Crash
        for off in (0, .5, .75, 1.5, 2, 2.5, 2.75, 3.5): d(off, KICK, 110 if off in (0, 2) else 94)
        d(1, SNARE, 118); d(3, SNARE, 120); d(1, CLAP, 90); d(3, CLAP, 94)
        for i in range(8): d(i * .5, RIDE, 104 if i % 2 == 0 else 84)
        d(2.25, TOM_M, 92); d(3.25, TOM_L, 96); d(3.75, TOM_HH, 94)
    elif kind == 'clock':                   # Neustart: leises Zählwerk
        for q in range(4): d(q, KICK, 84 if q % 2 == 0 else 70)
        for q in range(4): d(q + .5, COWBELL, 76)
        d(1, SIDESTICK, 86); d(3, SIDESTICK, 90)
    elif kind == 'chaos':                   # gesetzter Zufall (Seed)
        d(0, KICK, 118)
        for i in range(1, 16):
            if rng.random() < .28: d(i * .25, KICK, rng.randrange(84, 112))
            if rng.random() < .22: d(i * .25, rng.choice([SNARE, SNARE, TOM_H, TOM_M, CLAP]), rng.randrange(84, 116))
            if rng.random() < .32: d(i * .25, COWBELL, rng.randrange(70, 100))
        d(1, SNARE, 112); d(3, SNARE, 114)
        for i in range(8): d(i * .5, HAT, 100 if i % 2 == 0 else 80)
def fill(b, big=False):
    s = S(b)
    toms = [TOM_HH, TOM_H, TOM_M, TOM_L]
    for i in range(8): song.dr(s + 2 + i * .25, toms[min(3, i // 2)] if not big else SNARE, ramp(i, 8, 90, 120), .15)
    song.dr(s + 3.75, KICK, 118); song.dr(s + 3.75, CRASH if big else CLAP, 100, .3)
def crash(b, vel=112): song.dr(S(b), CRASH, vel, .5)

# ==== Arrangement =============================================================================
# ---- Intro (0–3): Puls ab Takt 1, System läuft an --------------------------------------------
for b in range(4):
    ch = PROG[b]
    subpad(b, ch, 78 + b * 2)
    bass16(b, ch, 'eighth', 88 + b * 3)
    acc_bar(b, ch, 0 if b < 3 else 2, 64 + b * 6)
    groove(b, 'A', 0.92 + b * .03)
    pad(b, ch, 50 + b * 6)
    if b >= 1: glass(b, ch, 2 + b, 74)
hit(0, 0, 'C#m', 114, 1.6); crash(0, 110)
siren('sir1', S(1, 0), 4, nt('C#5'), 88, 0, 7, 1.0)                 # erste Warnsirene
siren('sir2', S(2, 0), 8, nt('C#5'), 80, -2, 7, 2.0)
alarm(3, 2, 'G#', 100, 7)
stutter('lead', S(3, 2.5), [nt('C#5'), nt('C#5'), nt('D5')], .25, 5, 84, 100)
snare_acc(3, 2.5, 70, 118)

# ---- Thema A (4–19) -------------------------------------------------------------------------
MEL_A = [
    [(0, .25, 'C#5'), (.25, .25, 'C#5'), (.5, .25, 'D5'), (.75, .25, 'C#5'), (1, 1.5, 'G#5'), (2.5, .5, 'F#5'), (3, 1, 'E5')],
    [(0, .25, 'C#5'), (.25, .25, 'C#5'), (.5, .25, 'D5'), (.75, .25, 'C#5'), (1, 1, 'G5'), (2, 2, 'G#5')],
    [(0, .25, 'D5'), (.25, .25, 'D5'), (.5, .25, 'E5'), (.75, .25, 'D5'), (1, 1.5, 'A5'), (2.5, .5, 'F#5'), (3, 1, 'D5')],
    [(0, .25, 'E5'), (.25, .25, 'E5'), (.5, .25, 'D5'), (.75, .25, 'C#5'), (1, 1, 'B4'), (2, 2, 'C#5')],
    [(0, .25, 'A4'), (.25, .25, 'A4'), (.5, .25, 'B4'), (.75, .25, 'A4'), (1, 1.5, 'E5'), (2.5, .5, 'C#5'), (3, 1, 'A4')],
    [(0, .25, 'B4'), (.25, .25, 'B4'), (.5, .25, 'C#5'), (.75, .25, 'B4'), (1, 1.5, 'F#5'), (2.5, .5, 'D#5'), (3, 1, 'B4')],
    [(0, .5, 'G#5'), (.5, .5, 'F#5'), (1, .5, 'E5'), (1.5, .5, 'D#5'), (2, 1, 'E5'), (3, 1, 'D5')],
    [(0, .25, 'D#5'), (.25, .25, 'D#5'), (.5, .25, 'E5'), (.75, .25, 'D#5'), (1, .5, 'G#5'), (1.5, .5, 'F#5'), (2, 2, 'G#5')],
]
for i in range(16):
    b = 4 + i; ch = PROG[b]; k = i % 8; second = i >= 8
    subpad(b, ch, 84)
    bass16(b, ch, 'eighth' if (not second or k < 4) else 'gallop', 94 + (4 if second else 0))
    acc_bar(b, ch, 0 if not second else (1 if k < 4 else 2), 60 + (8 if second else 0))
    groove(b, 'A', 1.0 + (.05 if second else 0))
    line(b, MEL_A[k], ['lead'] + (['lead2'] if second else []), [92, 76] if second else [90])
    if k in (2, 4, 5, 6) or second: pad(b, ch, 58 + (10 if second else 0))
    if i % 2 == 1: glass(b, ch, 3, 76)
    if second and k in (0, 2, 4):                                    # Sirene als Gegenstimme
        r = rootnote(ch, 72)
        siren('sir2', S(b, 0), 8, r, 78, 0, 7 if ch != 'D' else 6, 1.0)
    if second and k >= 4: stabs(b, ch, 70, (0, 1.5, 3))
hit(4, 0, 'C#m', 112, 1.0); crash(4, 112); crash(12, 100)
fill(11); fill(19, True)
alarm(18, 2, 'G#', 104)
snare_acc(19, 0, 70, 120)

# ---- Warnstufen B (20–35): Ostinato beschleunigt in 4-Takt-Gruppen --------------------------
def riss(root_midi, lng=2):
    r = root_midi; a = step(r, 1)
    return [(0, .25, r), (.25, .25, r), (.5, .25, a), (.75, .25, r), (1, 2.0, step(r, lng)), (3, 1, step(r, 1))]
for i in range(16):
    b = 20 + i; ch = PROG[b]; g, k = i // 4, i % 4
    level = [0, 1, 2, 3][k] if g % 2 == 0 else [1, 2, 3, 4][k]
    subpad(b, ch, 88)
    bass16(b, ch, ['eighth', 'gallop', 'sixteenth', 'sixteenth'][min(3, g if k < 2 else 2 + (g > 1))] if False else ('gallop' if k < 2 else 'sixteenth'), 98)
    acc_bar(b, ch, level, 66 + g * 4 + k * 3, cyc=[tones(ch, 48)[0], tones(ch, 48)[2], tones(ch, 48)[3], crack(tones(ch, 48)[0])] if g >= 2 else None)
    groove(b, 'B', 1.0 + g * .02)
    r5 = rootnote(ch, 72)
    if i % 2 == 0: notes = [(o, d, p) for o, d, p in []]
    mel = riss(r5 if i % 2 == 0 else step(r5, 2), 2 if i % 2 == 0 else 3)
    for off, dur, p in mel: song.add('lead', S(b, off), dur * .94, chk(p), 90 + g * 2)
    if g >= 1:
        for off, dur, p in mel: song.add('lead2', S(b, off), dur * .94, chk(p - 12), 74)
    if i % 2 == 1: pad(b, ch, 64 + g * 4)
    if k in (1, 3): stabs(b, ch, 70 + g * 4, (0, 1.5, 3) if k == 1 else (0, .75, 1.5, 2.25, 3))
    # Alarm-Sirenen steigen mit den Warnstufen
    siren('sir1', S(b, 0), 4, rootnote(ch, 72 + (g % 2) * 0), 76 + g * 4, 0, 5 + g, 1.0 + (g >= 2))
    if g >= 2 and k % 2 == 0: siren('sir2', S(b, 0), 8, rootnote(ch, 60), 74, -3, 6 + g - 2, 2.0)
    if k == 3:                                                       # Stutter-Ausbruch am Gruppenende
        cell = [nt('C#5'), nt('D5'), nt('G5')][:3] if g % 2 == 0 else [chk(step(r5, 0)), chk(step(r5, 1)), chk(step(r5, 3))]
        stutter('lead', S(b, 2.0), cell, .25 if g < 2 else .125, 6 if g < 2 else 10, 92, 112)
        glass(b, ch, 3 + g, 80)
    if k == 0 and i > 0: crash(b, 104)
fill(23); fill(27); fill(31); fill(35, True)
alarm(34, 2, 'B', 108, 6)
snare_acc(35, 0, 76, 124)

# ---- Kontrollverlust C (36–47) ----------------------------------------------------------------
cells = {}
for i in range(12):
    b = 36 + i; ch = PROG[b]
    r4 = rootnote(ch, 60)
    subpad(b, ch, 88)
    groove(b, 'chaos', 1.04)
    kind = rng.choice(['stutter', 'trip', 'burst', 'stutter']) if i % 4 else 'stutter'
    cell = [r4, step(r4, 1), r4, step(r4, 3), step(r4, 4)][:rng.choice([3, 3, 4, 5])]
    cell = [chk(p + 12) for p in cell]
    if kind == 'stutter':
        stutter('lead', S(b, 0), cell, .25, rng.randrange(7, 14), 94, 108)
        stutter('arp', S(b, 0), [c - 24 for c in cell], .25, 16, 78, 78)
        bass16(b, ch, 'sync', 100)
    elif kind == 'trip':
        stutter('lead', S(b, 0), cell, 1 / 3, rng.randrange(7, 13), 94, 110)
        stutter('arp', S(b, 0), [c - 24 for c in cell], 1 / 3, 12, 78, 78)
        bass16(b, ch, 'gallop', 100)
    else:
        stutter('lead', S(b, 0), cell, .125, rng.randrange(10, 22), 90, 112, .7)
        acc_bar(b, ch, 3, 80)
        bass16(b, ch, 'sixteenth', 100)
    # Tritonus-Stabs und Gegenstimme
    stabs(b, ch, 80, rng.choice([(0, 1.5, 3), (0, .75, 2.25), (0, 2, 3.5)]))
    if i % 2 == 0: siren('sir1', S(b, rng.choice([0, 1])), 3, rootnote(ch, 72), 90, 0, rng.choice([6, 7, 12]), rng.choice([1.0, 1.5, 2.0]))
    else: siren('sir2', S(b, rng.choice([0, 1.5])), 2.5, rootnote(ch, 72) + 7, 88, rng.choice([0, -2]), -6, 1.0, 'fall')
    glass(b, ch, 5, 84)
    if i % 4 == 0: crash(b, 104); hit(b, 0, ch, 112, .8)
    pad(b, ch, 66)
# harte Stopps (Stille bis zum Wiedereinsatz), Neustart-Schläge werden nach dem Filter ergänzt
STOPS = [(39, 2.0, 40, 0.0), (43, 2.5, 44, 0.0), (47, 3.0, 48, 0.0), (63, 2.0, 64, 1.0)]
RESTART = [(40, 0, 'D5'), (44, 0, 'C#5'), (48, 0, 'C#m')]

def apply_stops():
    ev = song.ev; out = []; i = 0
    cuts = [(int(round((S(b0, o0)) * TPB)), int(round((S(b1, o1)) * TPB))) for b0, o0, b1, o1 in STOPS]
    while i < len(ev):
        t, o, m = ev[i]
        if m.type == 'note_on' and i + 1 < len(ev) and ev[i + 1][2].type == 'note_off':
            t1 = ev[i + 1][0]; keep = True
            for c0, c1 in cuts:
                if c0 <= t < c1: keep = False
                elif t < c0 < t1: t1 = c0
            if keep: out.append(ev[i]); out.append((t1, ev[i + 1][1], ev[i + 1][2]))
            i += 2; continue
        if m.type in ('pitchwheel',) and any(c0 <= t < c1 for c0, c1 in cuts):
            i += 1; continue
        out.append(ev[i]); i += 1
    song.ev[:] = out

# ---- Kernschmelze D (48–63) ----------------------------------------------------------------
HY1 = [
    [(0, 1, 'C#5'), (1, 1, 'E5'), (2, 1.5, 'G#5'), (3.5, .5, 'F#5')],
    [(0, 1, 'E5'), (1, 1, 'A5'), (2, 1.5, 'C#6'), (3.5, .5, 'B5')],
    [(0, 1, 'E5'), (1, 1, 'G#5'), (2, 1.5, 'B5'), (3.5, .5, 'A5')],
    [(0, 1, 'D#5'), (1, 1, 'F#5'), (2, 2, 'B5')],
    [(0, 1.5, 'A5'), (1.5, .5, 'G#5'), (2, 1, 'F#5'), (3, 1, 'C#5')],
    [(0, 1.5, 'D5'), (1.5, .5, 'F#5'), (2, 1, 'A5'), (3, 1, 'F#5')],
    [(0, .25, 'G#5'), (.25, .25, 'G#5'), (.5, .25, 'G5'), (.75, .25, 'G#5'), (1, 1, 'B5'), (2, .5, 'A5'), (2.5, .5, 'G#5'), (3, 1, 'D#5')],
    [(0, 1.5, 'D#5'), (1.5, .5, 'E5'), (2, 1, 'D5'), (3, 1, 'G#4')],
]
HY2 = [
    [(0, .25, 'C#5'), (.25, .25, 'C#5'), (.5, .25, 'D5'), (.75, .25, 'C#5'), (1, 1, 'G#5'), (2, 1, 'E5'), (3, 1, 'C#6')],
    [(0, .25, 'D5'), (.25, .25, 'D5'), (.5, .25, 'E5'), (.75, .25, 'D5'), (1, 1, 'A5'), (2, 1, 'F#5'), (3, 1, 'D6')],
    [(0, 1, 'C#5'), (1, 1, 'E5'), (2, 2, 'A5')],
    [(0, 1, 'D#5'), (1, 1, 'F#5'), (2, 2, 'B5')],
    [(0, 1, 'A5'), (1, 1, 'F#5'), (2, 1, 'C#6'), (3, 1, 'A5')],
    [(0, 1, 'B5'), (1, 1, 'D6'), (2, 2, 'D6')],
    [(0, .25, 'D#5'), (.25, .25, 'D#5'), (.5, .25, 'E5'), (.75, .25, 'D#5'), (1, 1, 'G#5'), (2, 1, 'B5'), (3, 1, 'D#6')],
    [(0, 2, 'G#5'), (2, 1, 'B5'), (3, 1, 'D#6')],
]
for i in range(16):
    b = 48 + i; ch = PROG[b]; k = i % 8; second = i >= 8
    subpad(b, ch, 94)
    bass16(b, ch, 'sixteenth' if k % 2 == 0 else 'sync', 104)
    acc_bar(b, ch, 2 if not (k == 7) else 4, 76, cyc=[tones(ch, 48)[0], tones(ch, 48)[3], tones(ch, 48)[2], tones(ch, 48)[3]])
    groove(b, 'C', 1.05 + (.03 if second else 0))
    mel = (HY2 if second else HY1)[k]
    line(b, mel, ['lead', 'lead2', 'stab'], [104, 90, 62])
    pad(b, ch, 84)
    stabs(b, ch, 66, (0, 1.5, 3) if k % 2 == 0 else (0.75, 2.25))
    # zwei Sirenen in Gegenbewegung unter/über der Hymne
    if k % 2 == 0:
        siren('sir1', S(b, 0), 8, rootnote(ch, 60), 80, 0, 12, 1.0, 'wail')
        siren('sir2', S(b, 0), 8, rootnote(ch, 72), 76, 0, -12, 1.0, 'wail')
    glass(b, ch, 4, 82)
    if k == 0: crash(b, 118); hit(b, 0, ch, 118, 1.2)
    elif k == 4: crash(b, 104)
fill(51); fill(55); fill(59); alarm(62, 0, 'G#', 112, 12)
snare_acc(62, 2, 80, 120); song.dr(S(63), SNARE, 100)
# ---- Selbstreparatur E (64–71) -------------------------------------------------------------
for i in range(8):
    b = 64 + i; ch = PROG[b]
    subpad(b, ch, 74 + i * 2)
    if i == 0:
        groove(b, 'clock', 0.9)
        for q in range(4): song.add('tick', S(b, q * 1.0), .3, tones(ch, 60)[0] if q % 2 == 0 else tones(ch, 60)[2], 84)
        glass(b, ch, 3, 74)
    elif i in (1, 2):                                                # Fehlstart: kurzer Anlauf, bricht ab
        groove(b, 'clock', 1.0)
        acc_bar(b, ch, 0 if i == 1 else 2, 64 + i * 6, inst='tick')
        bass16(b, ch, 'eighth', 80 + i * 4)
    elif i == 3:                                                     # Reparatur: Arpeggien steigen
        groove(b, 'A', 0.94)
        bass16(b, ch, 'gallop', 92)
        acc_bar(b, ch, 1, 74)
    else:
        groove(b, 'B', 0.88 + (i - 4) * .04)
        bass16(b, ch, 'sixteenth' if i >= 6 else 'gallop', 90 + (i - 4) * 3)
        acc_bar(b, ch, 2 if i < 6 else 3, 74 + (i - 4) * 3)
    pad(b, ch, 70 + i * 3)
    # steigende Reparatur-Arpeggien (Skalenläufe) auf Glocken/Crystal
    base = rootnote(ch, 72)
    run = [chk(step(base, j)) for j in range(0, 8)]
    for j, p in enumerate(run if i >= 2 else run[:3]):
        song.add('glock' if i < 5 else 'crys', S(b, j * .5), .45, p, 74 + i * 3)
    if i >= 3:
        mel = [(0, 1.5, 'C#5'), (1.5, .5, 'D5'), (2, 1, 'E5'), (3, 1, 'C#5')] if i < 6 else [(0, 1, 'A5'), (1, 1, 'G#5'), (2, 1, 'F#5'), (3, 1, 'E5')]
        if ch == 'B': mel = [(0, 1, 'B4'), (1, 1, 'D#5'), (2, 1, 'F#5'), (3, 1, 'B5')]
        line(b, mel, ['lead'] + (['lead2'] if i >= 5 else []), [86, 74])
siren('sir2', S(65, 0), 8, nt('C#5'), 70, -5, 0, 1.0, 'rise')
siren('sir1', S(68, 0), 8, nt('E5'), 74, -7, 0, 1.0, 'rise')
fill(67); fill(71)

# ---- Rückführung F (72–79) --------------------------------------------------------------------
for i in range(8):
    b = 72 + i; ch = PROG[b]; r4 = rootnote(ch, 48)
    subpad(b, ch, 92)
    bass16(b, ch, 'gallop' if i < 4 else 'sixteenth', 100)
    acc_bar(b, ch, [0, 1, 2, 3, 2, 3, 4, 4][i], 74 + i * 3,
            cyc=[tones(ch, 48)[0], tones(ch, 48)[2], tones(ch, 48)[3], crack(tones(ch, 48)[0])])
    if i < 6: groove(b, 'B', 0.98 + i * .02)
    else: snare_acc(b, 0, 70 + (i - 6) * 20, 100 + (i - 6) * 20)
    pad(b, ch, 70 + i * 5)
    if i % 2 == 0: stabs(b, ch, 76, (0, 1.5, 3))
    siren('sir1', S(b, 0), 4, rootnote(ch, 72), 80 + i * 3, 0, 5 + (i // 2) * 1, 1.0 + (i >= 4))
    if i % 2 == 0: glass(b, ch, 4, 84)
line(72, [(0, .25, 'C#5'), (.25, .25, 'C#5'), (.5, .25, 'D5'), (.75, .25, 'C#5'), (1, 1.5, 'G#5'), (2.5, .5, 'F#5'), (3, 1, 'E5')], ['lead'], [92])
line(74, MEL_A[4], ['lead'], [94]); line(76, MEL_A[2], ['lead', 'lead2'], [98, 82])
line(77, MEL_A[5], ['lead', 'lead2'], [100, 84])
line(78, MEL_A[6], ['lead', 'lead2'], [102, 86])
line(79, [(0, .25, 'D#5'), (.25, .25, 'D#5'), (.5, .25, 'E5'), (.75, .25, 'D#5'), (1, .25, 'G#5'), (1.25, .25, 'B5'), (1.5, .25, 'D#6'), (1.75, .25, 'G#6'), (2, 2, 'D#6')], ['lead'], [106])
siren('sir2', S(78, 0), 8, nt('G#4'), 94, 0, 12, 1.0, 'rise')
fill(75); fill(77)
fill(79, True)
crash(72, 108)

# ---- Stopps anwenden, Neustart-Schläge ergänzen -----------------------------------------------
apply_stops()
for b in (40, 44, 48, 64):
    hit(b, 0, PROG[b], 122 if b != 64 else 90, 1.0)
    song.dr(S(b), CRASH if b != 64 else CLAP, 112 if b != 64 else 90, .5); song.dr(S(b), KICK, 120 if b != 64 else 90)
    if b != 64: song.dr(S(b), SNARE, 112)
    song.add('bell', S(b), 1.5, chk(rootnote(PROG[b], 84)), 100)
    song.add('crys', S(b), 1.5, chk(rootnote(PROG[b], 90)), 90)

sf2, out = cli_paths('bgm_chaosdiamond.ogg')
song.render(sf2, out)
