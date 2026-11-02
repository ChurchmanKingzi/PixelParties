# -*- coding: utf-8 -*-
"""Held-Thema „Kyli, the Deceptive Sapling“ → public/music/bgm_kyli.ogg                  Titel: „Field Trip to the Old Tree“

Kyli ist durch und durch bösartig, aus dem Holz eines untoten Baumes, der die ganze Welt befallen will. Sie nimmt die Gestalt eines jungen Mädchens an, lockt Schüler
zum Baum und opfert sie dort. Das Theme klingt bösartig, finster, furchteinflößend — aber **subtil und verborgen**.

Version 2 (v1 mit Wiegenlied-Thema war zu wenig Kampfmusik): ein echtes, treibendes Battle-Theme. Das Subtile und Verborgene steckt nicht mehr in einer Melodie,
sondern in Textur, Harmonie und winzigen Details:

  • C-Moll mit ♭II (D) und Tritonus (G): **Phrygisch** — fremd, giftig. 140 BPM, 4/4, treibender 16tel-Groove: der **Wurzel-Riff** (Kontrabass, Fagott, Tuba, Posaune im Unisono,
    synkopiertes Tresillo-Muster mit kleiner Sekunde und Tritonus) kriecht wie Wurzeln durch den Boden; Marimba und Xylophon (Holz!) klopfen 16tel-Wurzelwerk darüber.
  • **Verborgen**: geflüsterte, rhythmisch gehackte Chor-Silben auf den Offbeats; ein winziges **Kindermotiv** (fallend: Cis–H–Gis) sehr leise, sehr hoch, wie aus einer Wand gesungen, jeweils am
    Ende einer Phrase; Glas-Streicher ppp mit ♭II. Man hört sie erst, wenn man weiß, dass sie da sind.
  • **Täuschung** („False Hope“-Break): ein paar Takte warmes, hell klingendes E-Dur (Kinderchor, Glas-Streicher, Glocke — wie Rettung), dann kippen die Terzen in Moll, der Boden bricht ein, der Wurzel-Riff kehrt
    zurück. Der „Befall“-Teil rückt den Riff alle zwei Takte um einen Halbton hoch (der Baum frisst sich weiter).
Form (64 Takte ≈ 1:50): Intro 4 · Wurzeln A 8 · Blüte B 8 · Der Baum C 8 · False Hope 8 · Wurzeln A' 8 · Befall D 8 · Ernte E 8 · Coda 4
Ausklang auf Gis7 (Dominante) → zurück in die Cis-Moll-Intro. (Cis-Moll geschrieben in absoluten Tonhöhen.)
"""
import os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 140, 64
song = Song(BPM, BARS)
rng = random.Random(1348)

song.inst('bass', 'contra', vol=104, pan=62)
song.inst('bassoon', 'bassoon', vol=82, pan=50)
song.inst('tuba', 'tuba', vol=88, pan=58)
song.inst('trombone', 'trombone', vol=84, pan=42)
song.inst('marimba', 'marimba', vol=76, pan=40)          # Wurzelwerk (16tel)
song.inst('xylo', 'xylo', vol=62, pan=90)                # Klopfen auf Holz
song.inst('pizz', 'pizz', vol=68, pan=30)
song.inst('violin', 'violin', vol=76, pan=76)
song.inst('choir', 'choir', vol=70, pan=68)              # geflüsterte/gehackte Silben, tief
song.inst('oohs', 'oohs', vol=58, pan=84)                # Kindermotiv (hoch, leise) / False Hope
song.inst('goblins', 'goblins', vol=56, pan=88)
song.inst('bowed', 'bowed', vol=56, pan=26)
song.inst('tremolo', 'tremolo', vol=60, pan=46)
song.inst('timp', 'timp', vol=104, pan=64)
song.inst('bell', 'bell', vol=68, pan=70)

NAMES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def pn(s):
    a, i = 0, 1
    if s[1] in '#b':
        a, i = (1 if s[1] == '#' else -1), 2
    return 12 * (int(s[i:]) + 1) + NAMES[s[0]] + a

def hv(v): return int(max(1, min(127, v + rng.randint(-3, 3))))

def mel(inst, bar0, bars, shift=0, vel=88, octave=0, legato=.92, flat=False):
    """flat=True: „Fäulnis“ — Terzen werden klein (Gis→G, Dis→D, E→Es, H→B)."""
    for k, bar in enumerate(bars):
        t = song.bar(bar0 + k)
        for name, dur in bar:
            if name is not None:
                m = pn(name)
                if flat and name in ('G#5', 'D#5', 'D#6', 'G#6', 'G#4'): m -= 1
                song.add(inst, t, max(0.1, dur * legato), m + shift + 12 * octave, hv(vel))
            t += dur

# Pitch-Bend (±12 Halbtöne)
def bend_setup(name):
    ch = song.ch[name][0]
    for cc, v in ((101, 0), (100, 0), (6, 12), (38, 0), (101, 127), (100, 127)):
        song.ev.append((0, -2, mido.Message('control_change', channel=ch, control=cc, value=v)))
for _n in ('goblins', 'violin'): bend_setup(_n)

def glide(name, beat, dur, pitch, vel, lo, hi, steps=16):
    ch = song.ch[name][0]
    song.add(name, beat, dur + 0.2, pitch, vel)
    for i in range(steps + 1):
        f = i / steps
        song.ev.append((int(round((beat + dur * f) * TPB)), 0,
                        mido.Message('pitchwheel', channel=ch, pitch=int(max(-8192, min(8191, (lo + (hi - lo) * f) / 12.0 * 8192))))))
    song.ev.append((int(round((beat + dur + 0.25) * TPB)), 0, mido.Message('pitchwheel', channel=ch, pitch=0)))

# ═══ Material (Cis-Moll / phrygisch) ═══════════════════════════════════════════════════════════════
C1 = 25                                                  # Cis1 (MIDI) — Kontrabass/Tuba werden bei Bedarf oktaviert
ROOTS = [0, 0, 1, 1, 0, 0, -2, -1]                       # Cis Cis | D D | Cis Cis | H C — ♭II und chromatisches Zurückkriechen

# Riff in 16teln (Position, Länge in Schlägen, Halbtöne über Grundton)
RIFF1 = [(0, .45, 0), (3, .2, 0), (6, .2, 1), (8, .45, 0), (11, .2, 6), (14, .2, 1)]
RIFF2 = [(0, .45, 0), (3, .2, 0), (6, .2, 3), (8, .45, 0), (10, .2, 1), (12, .45, 0), (14, .2, -1), (15, .2, 0)]

MELB = [
    [('E5', .5), ('D5', .5), ('C#5', .5), ('D5', .5), ('E5', 1), ('G5', 1)],
    [('E5', .5), ('D5', .5), ('C#5', .5), ('D5', .5), ('E5', .5), ('F#5', .5), ('G5', 1)],
    [('F#5', .5), ('E5', .5), ('D5', .5), ('E5', .5), ('F#5', 1), ('A5', 1)],
    [('G5', 2), ('F#5', 1), ('E5', 1)],
    [('E5', .5), ('D5', .5), ('C#5', .5), ('D5', .5), ('E5', 1), ('G5', 1)],
    [('G5', .5), ('F#5', .5), ('E5', .5), ('D5', .5), ('C#5', 2)],
    [('B4', .5), ('C#5', .5), ('D5', .5), ('C#5', .5), ('B4', 2)],
    [('G5', 1), ('F5', 1), ('E5', 2)],
]

# False Hope (E-Dur): warm — und ab Takt 5 faulen die Terzen
FH_CH_ROOTS = [4, 11, 1, 9, 4, 11, 9, 11]               # E H Cis-Moll A | E H A H (Grundtöne als Halbtonklassen)
FH = [
    [('G#5', 2), ('B5', 2)], [('F#5', 2), ('D#5', 2)], [('E5', 2), ('G#5', 2)], [('A5', 3), ('G#5', 1)],
    [('G#5', 2), ('B5', 2)], [('D#6', 2), ('B5', 2)], [('C#6', 2), ('A5', 2)], [('B5', 3), (None, 1)],
]

# ═══ Bausteine ═══════════════════════════════════════════════════════════════════════════════════
def root_midi(offset, shift=0, oct_=0):
    r = C1 + 12 + offset + shift                           # Cis2 + Offset
    return r + 12 * oct_

def riff(bar0, nbars, shift=0, vel=96, voices=('bass', 'bassoon', 'tuba', 'trombone'), roots=ROOTS):
    for k in range(nbars):
        t = song.bar(bar0 + k)
        pat = RIFF1 if k % 2 == 0 else RIFF2
        r = roots[k % len(roots)]
        for pos, dur, off in pat:
            for v in voices:
                o = 12 if v in ('bassoon', 'trombone') else 0
                vv = vel + (10 if pos in (0, 8) else 0) + (-8 if v in ('bassoon', 'trombone') else 0)
                song.add(v, t + pos * 0.25, dur, root_midi(r + off, shift, 0) + o, hv(vv))

def wood(bar0, nbars, shift=0, vel=60, roots=ROOTS):
    """Wurzelwerk: Marimba spielt 16tel über Grundton (Quinte, Oktave, kleine Sekunde, Tritonus); Xylophon klopft auf 2 und 4."""
    P = (0, 7, 12, 7, 0, 6, 12, 6, 1, 7, 13, 7, 0, 7, 12, 7)
    for k in range(nbars):
        t = song.bar(bar0 + k)
        r = roots[k % len(roots)]
        for i, off in enumerate(P):
            song.add('marimba', t + i * 0.25, 0.2, root_midi(r + off, shift, 1), hv(vel + (14 if i % 4 == 0 else (4 if i % 2 == 0 else -6))))
        for beat in (1, 3):
            song.add('xylo', t + beat, 0.1, root_midi(r + 19, shift, 1), hv(vel + 6)); song.add('xylo', t + beat + 0.25, 0.1, root_midi(r + 12, shift, 1), hv(vel - 8))

def ghost(bar0, nbars, shift=0, vel=50, roots=ROOTS):
    """Pizzicato-Geisternoten auf den Zwischen-Sechzehnteln."""
    for k in range(nbars):
        t = song.bar(bar0 + k)
        r = roots[k % len(roots)]
        for i in (1, 5, 9, 13):
            song.add('pizz', t + i * 0.25, 0.1, root_midi(r, shift, 2), hv(vel))

def chant(bar0, nbars, shift=0, vel=70, roots=ROOTS):
    """Gehackte Silben: tiefer Chor auf den Offbeat-Sechzehnteln 3 und 11 (+ 14), kurz."""
    for k in range(nbars):
        t = song.bar(bar0 + k)
        r = roots[k % len(roots)]
        for pos in (3, 11, 14):
            song.add('choir', t + pos * 0.25, 0.15, root_midi(r, shift, 1), hv(vel + (8 if pos == 3 else 0)))
            song.add('choir', t + pos * 0.25, 0.15, root_midi(r + 7, shift, 1), hv(vel - 8))

def child(bar0, nbars, every=4, shift=0, vel=30):
    """Das verborgene Kindermotiv: Cis–H–Gis, hoch und sehr leise, am Phrasenende (Takt 4/8 …)."""
    for k in range(every - 1, nbars, every):
        t = song.bar(bar0 + k) + 2.0
        for i, n in enumerate(('C#6', 'B5', 'G#5')):
            song.add('oohs', t + i * 0.75, 0.8, pn(n) + shift, vel - i * 2)
        song.add('bell', t, 1.6, pn('C#6') + shift, vel - 4)

def poison(bar0, nbars, shift=0, vel=26):
    for k in range(nbars):
        song.add('bowed', song.bar(bar0 + k), 3.95, pn('D6') + shift, vel)
        if k % 2: song.add('bowed', song.bar(bar0 + k), 3.95, pn('G5') + shift, vel - 4)

def heartbeat(bar0, nbars, vel=46):
    for k in range(nbars):
        t = song.bar(bar0 + k)
        song.add('timp', t, 0.4, pn('C#2') + 12, vel); song.add('timp', t + 0.5, 0.4, pn('C#2') + 12, vel - 14)

def drums(bar0, nbars, level=1.0, style='groove', fills=True, crash=True):
    """groove: Kick 0/3/8/10 (16tel-Positionen), Snare auf 2 und 4, 16tel-Hi-Hat; half: Halbzeit; sparse: nur Kick + Hi-Hat."""
    for k in range(nbars):
        t = song.bar(bar0 + k)
        L = level
        if style == 'groove':
            for pos, v in ((0, 108), (3, 86), (8, 104), (10, 90)): song.dr(t + pos * 0.25, KICK, int(v * L), 0.15)
            for beat in (1, 3): song.dr(t + beat, SNARE, int(106 * L), 0.15)
            for i in range(16): song.dr(t + i * 0.25, HAT, int((96 if i % 4 == 0 else (78 if i % 2 == 0 else 58)) * L), 0.05)
            if fills and k % 4 == 3:
                for j in range(6): song.dr(t + 2.5 + j * 0.25, (TOM_H, TOM_H, TOM_M, TOM_M, TOM_L, TOM_L)[j], int((84 + 5 * j) * L), 0.12)
        elif style == 'sparse':
            for pos, v in ((0, 90), (8, 84)): song.dr(t + pos * 0.25, KICK, int(v * L), 0.15)
            for i in range(0, 16, 2): song.dr(t + i * 0.25, HAT, int((70 if i % 4 == 0 else 54) * L), 0.05)
            song.dr(t + 3, SIDESTICK, int(70 * L), 0.1)
        if k == 0 and crash and style == 'groove': song.dr(t, CRASH, int(106 * L), 1.8)

def roll(bar0, start, end, v0=44, v1=120):
    t0 = song.bar(bar0) + start
    n = int((end - start) * 4)
    for i in range(n): song.dr(t0 + i * 0.25, SNARE, int(v0 + (v1 - v0) * i / max(1, n - 1)), 0.1)

def timp_roll(beat, dur, note, v0=36, v1=112):
    n = int(dur * 4)
    for i in range(n): song.add('timp', beat + i * 0.25, 0.3, note, int(v0 + (v1 - v0) * i / max(1, n - 1)))

def tremolo_pad(bar0, nbars, shift=0, vel=46, roots=ROOTS):
    for k in range(nbars):
        r = roots[k % len(roots)]
        for iv in (0, 1, 6): song.add('tremolo', song.bar(bar0 + k), 3.95, root_midi(r + iv, shift, 2), vel)

def timp_groove(bar0, nbars, shift=0, vel=96, roots=ROOTS):
    for k in range(nbars):
        t = song.bar(bar0 + k)
        r = root_midi(roots[k % len(roots)], shift, 1)
        while r > 55: r -= 12
        for pos in (0, 3, 8, 10): song.add('timp', t + pos * 0.25, 0.3, r, hv(vel - (0 if pos in (0, 8) else 22)))

def melody(bar0, shift=0, vel=88, inst='violin', octave=0, flat=False):
    mel(inst, bar0, MELB, shift=shift, vel=vel, octave=octave, flat=flat)

def screech(bar0, shift=0, vel=76):
    for k in (1, 3, 5, 7):
        glide('violin', song.bar(bar0 + k), 3.6, pn('G5') + shift, vel, -1.0, 3.0)

def swarm(bar0, nbars, vel=52):
    for k in range(nbars):
        t = song.bar(bar0 + k)
        for j in range(2):
            glide('goblins', t + j * 2.0 + rng.random() * 0.5, 1.4, rng.choice((pn('C#5'), pn('G5'), pn('D5'))), vel, rng.choice((-6.0, 6.0)), 0.0, steps=10)

# ═══ Arrangement ══════════════════════════════════════════════════════════════════════════════════
b = 0
# ── Intro (4): Boden knarrt — Glas-Streicher, Herzschlag, Holzklopfen, Riff schleicht ab Takt 3 herein, Kindermotiv ─────
poison(b, 4, vel=30)
heartbeat(b, 4, vel=52)
wood(b + 1, 3, vel=40)
riff(b + 2, 2, vel=70, voices=('bass', 'bassoon'))
for k in range(2, 4):
    song.dr(song.bar(b + k), KICK, 80, 0.15)
    song.dr(song.bar(b + k) + 1, SIDESTICK, 70, 0.1); song.dr(song.bar(b + k) + 3, SIDESTICK, 74, 0.1)
child(b, 4, every=4, vel=30)
timp_roll(song.bar(b + 3) + 2, 2.0, pn('C#2') + 12, 36, 96)
b += 4

# ── Wurzeln A (8): der Riff, Holz, Chor-Silben; das Kindermotiv wie aus der Wand ──────────────────────────────
riff(b, 8, vel=94)
wood(b, 8, vel=58)
ghost(b, 8)
chant(b, 8, vel=60)
poison(b, 8)
heartbeat(b, 8, vel=40)
drums(b, 8, level=0.95, style='groove')
child(b, 8, every=4, vel=34)
b += 8

# ── Blüte B (8): die schlangenhafte Melodie (Geige + Fagott), Chor kräftiger, Tremolo ─────────────────────────
riff(b, 8, vel=98)
wood(b, 8, vel=62)
melody(b, vel=92)
mel('bassoon', b, MELB, vel=62, octave=0)
chant(b, 8, vel=72)
tremolo_pad(b, 8, vel=40)
poison(b, 8, vel=34)
timp_groove(b, 8, vel=92)
drums(b, 8, level=1.0, style='groove')
child(b, 8, every=4, vel=34)
b += 8

# ── Der Baum C (8): alles voll — Blech hämmert den Riff, Violine kreischt, Kindermotiv noch da (kaum hörbar) ──────
riff(b, 8, vel=106)
wood(b, 8, vel=68)
melody(b, vel=100, octave=1)
mel('trombone', b, MELB, vel=88, octave=-1)
mel('tuba', b, MELB, vel=70, octave=-2)
chant(b, 8, vel=84)
tremolo_pad(b, 8, vel=54)
screech(b)
swarm(b, 8, vel=48)
timp_groove(b, 8, vel=104)
drums(b, 8, level=1.12, style='groove')
child(b, 8, every=4, vel=38)
b += 8

# ── False Hope (8): warmes E-Dur (Kinderchor, Glasstreicher, Glocke) — dann kippen die Terzen, der Boden bricht ───────
FH_ROOT = [4, 11, 1, 9, 4, 11, 9, 11]
mel('oohs', b, FH[:4], vel=78, legato=1.0)
mel('oohs', b + 4, FH[4:], vel=76, legato=1.0, flat=True)
for k in range(8):
    base = 52 + FH_ROOT[k]                                  # Halbtonklasse → Oktave 3/4
    third = 3 if (k in (2,) or k >= 5) else 4
    for iv in (0, third, 7):
        song.add('bowed', song.bar(b + k), 3.95, base + 12 + iv, 52 + 2 * k)
        song.add('tremolo', song.bar(b + k), 3.95, base + iv, 36 + 3 * k)
    song.add('bass', song.bar(b + k), 3.95, 28 + ((FH_ROOT[k] - 4) % 12), 60)
    song.add('bell', song.bar(b + k), 3.9, 76 + FH_ROOT[k] % 12, 52)
heartbeat(b, 8, vel=48)
for k in range(4, 8):                                       # ab Takt 5: Dissonanz (♭II, Tritonus), tiefer Chor
    for iv in (1, 6): song.add('bowed', song.bar(b + k), 3.95, pn('D6') + iv - 1, 40 + 6 * (k - 4))
    song.add('choir', song.bar(b + k), 3.95, pn('C#3') + (0 if k < 6 else 1), 44 + 7 * (k - 4))
glide('goblins', song.bar(b + 4), 15.0, pn('G5'), 46, 6.0, -6.0, steps=32)
timp_roll(song.bar(b + 6), 8.0, pn('C#2') + 12, 36, 116)
roll(b + 7, 0, 4, 40, 124)
b += 8

# ── Wurzeln A' (8): der Riff kehrt zurück — mit der Melodie jetzt in Bassoon/Trombone, Geige höher ───────────────
riff(b, 8, vel=102)
wood(b, 8, vel=64)
melody(b, vel=96, octave=1)
mel('trombone', b, MELB, vel=82, octave=-1)
chant(b, 8, vel=78)
ghost(b, 8, vel=56)
tremolo_pad(b, 8, vel=48)
poison(b, 8, vel=38)
timp_groove(b, 8, vel=100)
drums(b, 8, level=1.05, style='groove')
child(b, 8, every=4, vel=36)
crash_pos = song.bar(b)
song.dr(crash_pos, CRASH, 108, 2.0)
b += 8

# ── Befall D (8): der Riff steigt alle 2 Takte um einen Halbton (der Baum frisst sich weiter) ─────────────────────
for blk in range(4):
    sh = blk
    bb = b + 2 * blk
    riff(bb, 2, shift=sh, vel=108)
    wood(bb, 2, shift=sh, vel=70)
    chant(bb, 2, shift=sh, vel=88)
    mel('violin', bb, MELB[2 * blk:2 * blk + 2], shift=sh, vel=100, octave=1)
    mel('trombone', bb, MELB[2 * blk:2 * blk + 2], shift=sh, vel=90, octave=-1)
    tremolo_pad(bb, 2, shift=sh, vel=56)
    timp_groove(bb, 2, shift=sh, vel=106)
swarm(b, 8, vel=58)
screech(b, vel=80)
drums(b, 8, level=1.15, style='groove')
poison(b, 8, vel=44)
child(b, 8, every=2, vel=40)
roll(b + 7, 2, 4, 60, 126)
b += 8

# ── Ernte E (8): alles voll, Ganzschluss; das Kindermotiv nun fast hörbar ──────────────────────────────────────
riff(b, 8, vel=110)
wood(b, 8, vel=72)
melody(b, vel=104, octave=1)
mel('trombone', b, MELB, vel=92, octave=-1)
mel('bassoon', b, MELB, vel=70, octave=0)
mel('tuba', b, MELB, vel=72, octave=-2)
chant(b, 8, vel=90)
ghost(b, 8, vel=58)
tremolo_pad(b, 8, vel=58)
swarm(b, 8, vel=50)
screech(b, vel=84)
poison(b, 8, vel=46)
timp_groove(b, 8, vel=108)
drums(b, 8, level=1.15, style='groove')
child(b, 8, every=2, vel=52)
b += 8

# ── Coda (4): Gis (Dominante zur Cis-Moll-Intro), letzter Riff, abbrechend; das Kindermotiv klar, allein ─────────────
for k in range(3):
    song.add('bass', song.bar(b + k), 3.9, pn('G#1') + 12, 100)
    song.add('tuba', song.bar(b + k), 3.9, pn('G#1') + 12, 92)
    for iv in (0, 1, 7): song.add('tremolo', song.bar(b + k), 3.95, pn('G#3') + iv, 50 + 6 * k)
wood(b, 2, roots=[-6, -6], vel=60)
drums(b, 2, level=0.9, style='sparse')
heartbeat(b, 3, vel=70)
for i, n in enumerate(('C#6', 'B5', 'G#5')):
    song.add('oohs', song.bar(b + 2) + i * 0.75, 1.0, pn(n), 66 - 2 * i)
song.add('bell', song.bar(b + 2), 3.0, pn('C#6'), 66)
timp_roll(song.bar(b + 3), 4.0, pn('G#2') + 12, 50, 96)
roll(b + 3, 0, 4, 40, 112)
b += 4
assert b == BARS, (b, BARS)

if os.environ.get('KYLI_NORENDER') != '1':
    sf2, out = cli_paths('bgm_kyli.ogg')
    song.render(sf2, out, target_rms=0.27, saturate=False, compress=True, air_cut=0.15)
