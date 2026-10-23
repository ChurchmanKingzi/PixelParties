# -*- coding: utf-8 -*-
"""Held-Thema „Alice, the Puppeteer Girl“ → public/music/bgm_alice.ogg                   Titel: „The Dolls' Tea Party“

Alice spielt mit lebendigen Puppen und beherrscht unheimliche Magie — ein Alice-im-Wunderland-Take (Card Art: blondes Mädchen mit
roter Schleife, lila-schwarze Robe, umringt von weißen Puppen mit roten Augen, rot/violett geteilter Raum). Das Puppets-Archetyp-Theme
(„Strings of Fate“) ist ein 4/4-Spieluhr-Stück; Alice bekommt deshalb etwas völlig anderes: einen **schiefen Walzer**.

  • 3/4, 168 BPM, Fis-Moll mit Neapolitaner (G) und absichtlich „falschen“ Tönen (Tritonus gegen den Akkord) —
    ein verrückter Tee-Salon-Walzer (Mad Hatter): Cembalo/Glockenspiel als Spieluhr-Thema, Pizzicato „Umpa-pa“, Klarinette, Fagott,
    Akkordeon und Calliope (Jahrmarkt-Orgel) wirbeln durch den Tee-Party-Teil, Kinderchor-Oohs, Harfen-Arpeggien.
  • Kampf-Puls: Walzer-Schlagzeug (Kick auf 1, Rim/Snare auf 2 und 3, Hi-Hat-Achtel), Fills; im Break eine **Hemiole**
    (2er-Gruppen über 3/4 — der Boden verschiebt sich) mit chromatischem Fall (Kaninchenbau); im „Queen's Court“ schwere Pauke,
    Orgel und Chor-Stöße („Off with their heads!“) in Tritonus-Beziehung (C-Dur gegen Fis-Moll).
  • Schluss: Reprise einen Halbton höher (G-Moll-Walzer: „es kippt“), Ausklang auf Cis7 (Dominante) → zurück in die Fis-Moll-Intro.
Form (96 Takte ≈ 1:43): Intro 4 · Walzer A 16 · Tee-Party B 16 · A' 16 (voll) · Kaninchenbau 8 · Queen's Court 8 · A'' +1 16 · B' +1 8 · Coda 4
"""
import os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 168, 96
song = Song(BPM, BARS, beats_per_bar=3)
rng = random.Random(1865)

song.inst('harpsi', 'harpsichord', vol=96, pan=58)
song.inst('glock', 'glock', vol=66, pan=84)
song.inst('pizz', 'pizz', vol=86, pan=34)
song.inst('bass', 'acbass', vol=100, pan=62)
song.inst('clarinet', 'clarinet', vol=84, pan=76)
song.inst('bassoon', 'bassoon', vol=82, pan=46)
song.inst('accordion', 'accordion', vol=76, pan=40)
song.inst('calliope', 'calliope', vol=70, pan=88)
song.inst('oohs', 'oohs', vol=70, pan=70)
song.inst('choir', 'choir', vol=70, pan=58)
song.inst('tremolo', 'tremolo', vol=74, pan=50)
song.inst('organ', 'pipeorgan', vol=66, pan=64)
song.inst('timp', 'timp', vol=100, pan=64)
song.inst('trombone', 'trombone', vol=76, pan=72)
song.inst('harp', 'harp', vol=76, pan=44)

NAMES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def pn(s):
    a, i = 0, 1
    if s[1] in '#b':
        a, i = (1 if s[1] == '#' else -1), 2
    return 12 * (int(s[i:]) + 1) + NAMES[s[0]] + a

CH = {'F#m': (6, 'm'), 'Bm': (11, 'm'), 'D': (2, 'M'), 'C#7': (1, '7'), 'G': (7, 'M'), 'A': (9, 'M'), 'C': (0, 'M')}
QUAL = {'M': (0, 4, 7), 'm': (0, 3, 7), '7': (0, 4, 7, 10)}

def tones(ch, oct_, shift=0):
    root, q = CH[ch]
    r = (root + shift) % 12 + 12 * (oct_ + 1)
    return [r + i for i in QUAL[q]]

def hv(v): return int(v + rng.randint(-3, 3))

def mel(inst, bar0, bars, shift=0, vel=92, octave=0, legato=.9):
    for k, bar in enumerate(bars):
        t = song.bar(bar0 + k)
        for name, dur in bar:
            if name is not None:
                song.add(inst, t, max(0.1, dur * legato), pn(name) + shift + 12 * octave, hv(vel))
            t += dur

def seq(inst, beat0, notes, shift=0, vel=92, octave=0, legato=.9):
    """Notenfolge, die Taktgrenzen ignoriert (für die Hemiole)."""
    t = beat0
    for name, dur in notes:
        if name is not None:
            song.add(inst, t, max(0.1, dur * legato), pn(name) + shift + 12 * octave, hv(vel))
        t += dur

# ═══ Material (Fis-Moll, 3/4) ═══════════════════════════════════════════════════════════════════════
A_CH = ['F#m', 'F#m', 'D', 'C#7', 'F#m', 'Bm', 'G', 'C#7']
A_MEL = [
    [('F#5', .5), ('A5', .5), ('C#6', 1), ('A5', .5), ('F#5', .5)],
    [('E5', .5), ('F#5', .5), ('A5', 1), ('F#5', 1)],
    [('D5', .5), ('F#5', .5), ('A5', 1), ('F#5', .5), ('D5', .5)],
    [('E#5', 1), ('G#5', 1), ('B5', 1)],
    [('C#6', .5), ('A5', .5), ('F#5', 1), ('A5', 1)],
    [('B5', .5), ('D6', .5), ('F#6', 1), ('D6', .5), ('B5', .5)],
    [('G5', .5), ('B5', .5), ('D6', 1), ('C#6', 1)],          # C# gegen G-Dur: der „falsche“ Ton
    [('B5', 1), ('G#5', 1), ('E#5', 1)],
]
A_CH2 = ['F#m', 'F#m', 'D', 'C#7', 'F#m', 'Bm', 'G', 'F#m']
A_MEL2 = A_MEL[:6] + [
    [('G5', .5), ('B5', .5), ('D6', 1), ('C#6', .5), ('B5', .5)],
    [('F#5', 3)],
]

B_CH = ['Bm', 'F#m', 'Bm', 'F#m', 'G', 'D', 'C#7', 'C#7']
B_MEL = [
    [('B5', .5), ('C#6', .5), ('D6', .5), ('C#6', .5), ('B5', .5), ('A5', .5)],
    [('A5', .5), ('B5', .5), ('C#6', .5), ('B5', .5), ('A5', .5), ('F#5', .5)],
    [('D6', .5), ('E6', .5), ('F#6', .5), ('E6', .5), ('D6', .5), ('B5', .5)],
    [('C#6', 1), ('A5', 1), ('F#5', 1)],
    [('B5', .5), ('D6', .5), ('G6', 1), ('F#6', .5), ('D6', .5)],
    [('A5', .5), ('D6', .5), ('F#6', 1), ('E6', .5), ('D6', .5)],
    [('G#5', .5), ('B5', .5), ('E6', .5), ('D6', .5), ('B5', .5), ('G#5', .5)],
    [('E#5', 1), ('G#5', 1), (None, 1)],
]

# Kaninchenbau (Hemiole: 2er-Gruppen über 3/4)
RH_CH = ['F#m', 'F#m', 'Bm', 'Bm', 'G', 'G', 'C#7', 'C#7']
RH = [('A5', 2), ('A5', 2), ('F#5', 2), ('B5', 2), ('B5', 2), ('D6', 2), ('G5', 2), ('B5', 2), ('D6', 2), ('G#5', 2), ('B5', 2), ('E#6', 2)]

# Queen's Court: C-Dur gegen Fis-Moll (Tritonus), schwer und gerade
Q_CH = ['F#m', 'C', 'F#m', 'C', 'D', 'A', 'C#7', 'C#7']
Q_MEL = [
    [('F#5', 1.5), ('F#5', .5), ('A5', 1)],
    [('E5', 1.5), ('E5', .5), ('G5', 1)],
    [('F#5', 1.5), ('F#5', .5), ('C#6', 1)],
    [('E5', 1.5), ('E5', .5), ('C6', 1)],
    [('D6', 2), ('A5', 1)],
    [('C#6', 2), ('E6', 1)],
    [('G#5', 1), ('B5', 1), ('E#6', 1)],
    [('E6', 1), ('C#6', 1), (None, 1)],
]

# ═══ Begleit-Bausteine ═══════════════════════════════════════════════════════════════════════════
def root1(ch, shift=0):
    r = tones(ch, 1, shift)[0]
    return r + 12 if r < 28 else r

def oompah(bar0, chords, shift=0, vel=90, pah=True):
    """Walzer: Bass auf 1, Pizzicato-Akkord auf 2 und 3."""
    for k, ch in enumerate(chords):
        t = song.bar(bar0 + k)
        song.add('bass', t, 0.9, root1(ch, shift), hv(vel))
        if pah:
            T = tones(ch, 4, shift)
            for beat in (1, 2):
                for m in (T[0], T[1], T[2]):
                    song.add('pizz', t + beat, 0.3, m, hv(vel - 20))

def harp_arp(bar0, chords, shift=0, vel=52):
    for k, ch in enumerate(chords):
        T = tones(ch, 3, shift)
        for i, m in enumerate((T[0], T[1], T[2], T[0] + 12, T[2] + 12)):
            song.add('harp', song.bar(bar0 + k) + i * 0.25, 0.9, m, hv(vel + i * 2))

def giggle(bar, shift=0):
    """Puppenkichern: vier absteigende chromatische Glockenspiel-Töne im letzten Schlag."""
    for i, n in enumerate(('C#7', 'C7', 'B6', 'A#6')):
        song.add('glock', song.bar(bar) + 2 + i * 0.25, 0.2, pn(n) + shift, 80 - i * 6)

def waltz_drums(bar0, nbars, level=1.0, style='waltz', fills=True):
    """waltz: Kick 1, Rim 2+3, Hi-Hat-Achtel · tea: dichter, mit Crash auf 1 jeden 4. Takt · court: schwere Pauken-Marsch-Schritte."""
    for k in range(nbars):
        t = song.bar(bar0 + k)
        L = level
        if style == 'court':
            song.dr(t, KICK, int(110 * L), 0.2); song.dr(t + 1, TOM_L, int(96 * L), 0.15); song.dr(t + 2, SNARE, int(104 * L), 0.15)
            if k % 2 == 0: song.dr(t, CRASH, int(104 * L), 1.4)
        else:
            song.dr(t, KICK, int(100 * L), 0.2)
            for beat in (1, 2): song.dr(t + beat, SIDESTICK, int(84 * L), 0.1)
            for i in range(6): song.dr(t + i * 0.5, HAT, int((98 if i % 2 == 0 else 80) * L), 0.06)
            if style == 'tea':
                song.dr(t + 1.5, SNARE, int(48 * L), 0.08); song.dr(t + 2.5, SNARE, int(48 * L), 0.08)
                if k % 4 == 0: song.dr(t, CRASH, int(88 * L), 1.4)
            if fills and k % 8 == 7:
                for j in range(4): song.dr(t + 1.5 + j * 0.375, SNARE, int((70 + 12 * j) * L), 0.1)

def hemiola_drums(bar0, nbars, vel=100):
    """Kick/Snare alle 2 Schläge — gegen den 3er-Takt."""
    total = nbars * 3
    for i in range(0, total, 2):
        beat = song.bar(bar0) + i
        song.dr(beat, KICK, vel, 0.2)
        if i + 1 < total: song.dr(beat + 1, SNARE, vel - 6, 0.15)
        song.dr(beat, HAT, 90, 0.06)

def doom(bar0, chords, shift=0, vel=96):
    for k, ch in enumerate(chords):
        r = tones(ch, 2, shift)[0] + 12
        if r > 55: r -= 12
        t = song.bar(bar0 + k)
        song.add('timp', t, 0.8, r, hv(vel)); song.add('timp', t + 1.5, 0.4, r, hv(vel - 24))

def stab(beat, ch, shift=0, vel=100, dur=0.6):
    T = tones(ch, 3, shift)
    for m in (T[0], T[1], T[2]):
        song.add('organ', beat, dur, m, vel - 10); song.add('trombone', beat, dur, m, vel - 14)
        song.add('choir', beat, dur, m + 12, vel - 18)

def roll(bar0, start, end, v0=50, v1=120):
    t0 = song.bar(bar0) + start
    n = int((end - start) * 4)
    for i in range(n): song.dr(t0 + i * 0.25, SNARE, int(v0 + (v1 - v0) * i / max(1, n - 1)), 0.1)

def pad_oohs(bar0, chords, shift=0, vel=56):
    for k, ch in enumerate(chords):
        T = tones(ch, 4, shift)
        for m in (T[1], T[2]):
            song.add('oohs', song.bar(bar0 + k), 2.9, m, vel)

def waltz_section(base, chords, melody, shift=0, vel=90, full=False, drums=True):
    mel('harpsi', base, melody, shift=shift, vel=vel)
    mel('glock', base, melody, shift=shift, vel=56, octave=1)
    oompah(base, chords, shift=shift, vel=90)
    harp_arp(base, chords, shift=shift)
    if full:
        mel('clarinet', base, melody, shift=shift, vel=66, octave=0)
        mel('bassoon', base, melody, shift=shift, vel=64, octave=-1)
        pad_oohs(base, chords, shift=shift)
        doom(base, chords, shift=shift, vel=90)
    if drums: waltz_drums(base, len(melody), level=1.05 if full else 0.95)

# ═══ Arrangement ══════════════════════════════════════════════════════════════════════════════════
b = 0
# ── Intro (4): Spieluhr-Aufzug (Tick-Tack), der Fall in den Kaninchenbau (chromatisch abwärts), Walzer-Auftakt ─
for k in range(2):
    t = song.bar(b + k)
    for i, n in enumerate(('F#6', 'C#6', 'F#6', 'C#6', 'A6', 'E6')):
        song.add('glock', t + i * 0.5, 0.3, pn(n), 66 + (8 if i % 2 == 0 else 0))
    song.add('bass', t, 0.9, pn('F#2'), 80)
    for beat in (1, 2): song.add('pizz', t + beat, 0.3, pn('A4'), 60); song.add('pizz', t + beat, 0.3, pn('C#5'), 58)
fall = ['A6', 'G#6', 'G6', 'F#6', 'F6', 'E6']
for i, n in enumerate(fall):
    song.add('harp', song.bar(b + 2) + i * 0.5, 0.5, pn(n), 62 + i * 4)
    song.add('clarinet', song.bar(b + 2) + i * 0.5, 0.5, pn(n) - 12, 56 + i * 3)
tr = ['E5', 'D#5', 'D5', 'C#5', 'C5', 'B4']
for i, n in enumerate(tr):
    song.add('harpsi', song.bar(b + 3) + i * 0.5, 0.45, pn(n), 76 + i * 3)
song.add('bass', song.bar(b + 2), 2.9, pn('F#2'), 84)
song.add('bass', song.bar(b + 3), 2.9, pn('C#2') + 12, 90)
waltz_drums(b, 2, level=0.6, fills=False)
waltz_drums(b + 2, 2, level=0.9, fills=False)
song.dr(song.bar(b + 3) + 2, CRASH, 90, 1.0)
b += 4

# ── Walzer A (16): Spieluhr-Thema; zweite Hälfte schließt auf F#m, Puppenkichern im letzten Takt ───────────
waltz_section(b, A_CH, A_MEL)
giggle(b + 7)
b += 8
waltz_section(b, A_CH2, A_MEL2, vel=92)
b += 8

# ── Tee-Party B (16): Klarinette/Akkordeon/Calliope wirbeln; Fagott „schnauft“ Gegenstimme ─────────────
def tea_section(base, shift=0, vel=88, big=False):
    mel('clarinet', base, B_MEL, shift=shift, vel=vel)
    mel('accordion', base, B_MEL, shift=shift, vel=66, octave=-1)
    mel('calliope', base, B_MEL, shift=shift, vel=58, octave=1)
    if big: mel('harpsi', base, B_MEL, shift=shift, vel=70, octave=0)
    oompah(base, B_CH, shift=shift, vel=94)
    mel('bassoon', base, B_MEL, shift=shift, vel=58, octave=-1)
    pad_oohs(base, B_CH, shift=shift, vel=50)
    doom(base, B_CH, shift=shift, vel=84)
    waltz_drums(base, 8, level=1.05, style='tea')

tea_section(b)
giggle(b + 7)
b += 8
tea_section(b, vel=94, big=True)
giggle(b + 7)
roll(b + 7, 0, 2, 50, 110)
b += 8

# ── Walzer A' (16): voll — Klarinette + Fagott + Kinderchor ───────────────────────────────────────────────
waltz_section(b, A_CH, A_MEL, vel=96, full=True)
giggle(b + 7)
b += 8
waltz_section(b, A_CH2, A_MEL2, vel=98, full=True)
b += 8

# ── Kaninchenbau (8): Hemiole, chromatischer Fall im Bass, Streicher-Tremolo schwillt an ──────────────────
seq('harpsi', song.bar(b), RH, vel=96)
seq('clarinet', song.bar(b), RH, vel=62, octave=-1)
seq('glock', song.bar(b), RH, vel=56, octave=1)
for k, ch in enumerate(RH_CH):
    T = tones(ch, 3)
    for m in (T[0], T[1], T[2]): song.add('tremolo', song.bar(b + k), 2.95, m, 50 + k * 5)
    song.add('bass', song.bar(b + k), 2.9, root1(ch), 90)
fallb = [pn(n) for n in ('F#4', 'F4', 'E4', 'D#4', 'D4', 'C#4', 'C4', 'B3')]
for i, m in enumerate(fallb):                                  # eine Note pro Takt: der Fall
    song.add('pizz', song.bar(b + i) + 1, 0.4, m + 12, 70); song.add('pizz', song.bar(b + i) + 2, 0.4, m + 12, 62)
hemiola_drums(b, 8, vel=100)
doom(b + 4, RH_CH[4:], vel=100)
roll(b + 7, 1, 3, 60, 124)
b += 8

# ── Queen's Court (8): Tritonus-Stöße, Pauke, Orgel, Chor — „Off with their heads!“ ─────────────────────
mel('organ', b, Q_MEL, vel=84, octave=-1, legato=.95)
mel('choir', b, Q_MEL, vel=76, octave=0, legato=.8)
mel('trombone', b, Q_MEL, vel=78, octave=-1, legato=.85)
mel('harpsi', b, Q_MEL, vel=92, octave=1, legato=.7)
oompah(b, Q_CH, vel=100, pah=False)
doom(b, Q_CH, vel=106)
for k, ch in enumerate(Q_CH):
    for beat in (0, 2):
        song.add('timp', song.bar(b + k) + beat, 0.3, tones(ch, 2)[0] + 12 if tones(ch, 2)[0] + 12 < 56 else tones(ch, 2)[0], 96)
stab(song.bar(b), 'F#m', vel=106, dur=1.2); stab(song.bar(b + 1), 'C', vel=106, dur=1.2)
stab(song.bar(b + 2), 'F#m', vel=106, dur=1.2); stab(song.bar(b + 3), 'C', vel=106, dur=1.2)
waltz_drums(b, 8, level=1.1, style='court')
roll(b + 7, 1, 3, 60, 126)
b += 8

# ── Walzer A'' (16): einen Halbton höher (G-Moll) — alles, noch schiefer ──────────────────────────────────
waltz_section(b, A_CH, A_MEL, shift=1, vel=100, full=True)
mel('calliope', b, A_MEL, shift=1, vel=56, octave=1)
giggle(b + 7, shift=1)
b += 8
waltz_section(b, A_CH2, A_MEL2, shift=1, vel=102, full=True)
mel('calliope', b, A_MEL2, shift=1, vel=58, octave=1)
b += 8

# ── Tee-Party B' (8): +1, Wirbel; endet auf D7 (= Cis7 + 1), das in die Coda „fällt“ ────────────────────────
tea_section(b, shift=1, vel=98, big=True)
roll(b + 7, 0, 3, 50, 124)
b += 8

# ── Coda (4): D7 fällt einen Halbton auf Cis7 (Dominante der Intro), Puppenkichern, Pauken ────────────────
CODA = ['C#7', 'C#7', 'C#7', 'C#7']
seq('harpsi', song.bar(b), [('E#5', 1), ('G#5', 1), ('B5', 1), ('E6', 1.5), ('C#6', 1.5), ('B5', 1), ('G#5', 2), (None, 1), (None, 3)], vel=100)
seq('clarinet', song.bar(b), [('E#4', 1), ('G#4', 1), ('B4', 1), ('E5', 1.5), ('C#5', 1.5), ('B4', 1), ('G#4', 2), (None, 1)], vel=70)
oompah(b, CODA[:3], vel=96)
doom(b, CODA[:3], vel=100)
waltz_drums(b, 3, level=1.0, style='tea', fills=False)
giggle(b + 2)
song.add('bass', song.bar(b + 3), 2.9, pn('C#2') + 12, 96)
for i in range(6): song.add('harp', song.bar(b + 3) + i * 0.5, 0.5, pn('C#5') + [0, 4, 7, 10, 12, 16][i], 60 + i * 5)
roll(b + 3, 1, 3, 46, 118)
song.dr(song.bar(b + 3) + 2.5, CRASH, 84, 0.5)
b += 4
assert b == BARS, (b, BARS)

if os.environ.get('ALICE_NORENDER') != '1':
    sf2, out = cli_paths('bgm_alice.ogg')
    song.render(sf2, out, target_rms=0.26, saturate=False, compress=True, air_cut=0.3)
