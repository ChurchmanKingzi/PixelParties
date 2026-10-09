# -*- coding: utf-8 -*-
"""Held-Thema „Damus, the Prophet of Apocalypse“ → public/music/bgm_damus.ogg      Titel: „The Hour of Ashes“

Deck „End of the World“ (Armageddon, Ifrit, Doom Clock-Anklänge): das Ende der Welt steht unmittelbar bevor.
Dramatisch und stressig — es läuft ein Countdown, und er ist fast abgelaufen.

  • B-Moll, 160 BPM. Totenglocken (Röhrenglocke) schlagen jeden Takt, die Pauke schlägt den Herzschlag „lub-dub“,
    unerbittliche 16tel-Streicher (Spiccato) treiben, tiefes Blech und Chor drücken.
  • Das mittelalterliche „Dies irae“ (gemeinfreie Choralmelodie, hier in B-Dorisch/Moll: Des–C–Des–B–C–As–B) ruft das
    Jüngste Gericht — im Blech, im Chor, im Finale als Gegenstimme zum Hauptthema.
  • Hauptthema (8 Takte, Bbm – Gb – Db – F | Bbm – Gb – Ebm – F): fallende Linie mit großem Sextsprung auf das hohe B,
    endet offen auf der Dominante. Es kehrt in drei Gestalten wieder (Violine/Flöte → mit Trompete und Chor →
    Finale mit Chant als Gegenstimme).
  • Mittelteil „letzte Hoffnung“ in Des-Dur, choralartig, kurz tröstlich — dann schlägt A'' wieder zu.
  • Countdown-Break: die Glocken schlagen immer schneller, Snare-Wirbel, Riser.
Form (88 Takte = 2:12): Intro 8 · A 16 · A' 8 · B 8 · A'' 16 · C 8 · Finale 16 · Outro 8 → endet auf F (Dominante), Loop.
"""
import os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 160, 88
song = Song(BPM, BARS)
rng = random.Random(1313)

song.inst('bell', 'bell', vol=92, pan=64)
song.inst('timp', 'timp', vol=104, pan=64)
song.inst('bass', 'bass', vol=100, pan=60)
song.inst('contra', 'contra', vol=84, pan=66)
song.inst('strings', 'strings', vol=80, pan=36)      # Spiccato-16tel
song.inst('trem', 'tremolo', vol=74, pan=64)
song.inst('violin', 'violin', vol=96, pan=50)
song.inst('flute', 'flute', vol=86, pan=76)
song.inst('trumpet', 'trumpet', vol=88, pan=70)
song.inst('tromb', 'trombone', vol=90, pan=58)
song.inst('horn', 'horns', vol=84, pan=82)
song.inst('choir', 'choir', vol=82, pan=64)
song.inst('organ', 'pipeorgan', vol=70, pan=64)
song.inst('hit', 'hit', vol=96, pan=64)

NAMES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def pn(s):
    """'Db5' → MIDI. Vorzeichen b/# nach dem Buchstaben, dann Oktave."""
    a, i = 0, 1
    if s[1] in '#b':
        a, i = (1 if s[1] == '#' else -1), 2
    return 12 * (int(s[i:]) + 1) + NAMES[s[0]] + a

CH = {'Bbm': (10, 'm'), 'Gb': (6, 'M'), 'Db': (1, 'M'), 'F': (5, 'M'), 'Ebm': (3, 'm'), 'Ab': (8, 'M'), 'F7': (5, '7')}
QUAL = {'M': (0, 4, 7), 'm': (0, 3, 7), '7': (0, 4, 7, 10)}

def tones(ch, oct_):
    root, q = CH[ch]
    r = root + 12 * (oct_ + 1)
    return [r + i for i in QUAL[q]]

def hv(v): return v + rng.randint(-4, 4)

def mel(inst, bar0, bars, vel=92, octave=0, legato=.95):
    """Melodie ab Takt `bar0`; `bars` = Liste von Takten, jeder [(Ton, Dauer)…]."""
    for k, bar in enumerate(bars):
        t = song.bar(bar0 + k)
        for name, dur in bar:
            if name is not None:
                song.add(inst, t, dur * legato, pn(name) + 12 * octave, hv(vel))
            t += dur

# ── Material ──────────────────────────────────────────────────────────────────
# Hauptthema M — 8 Takte
M_BARS = [
    [('F5', 1.5), ('Eb5', .5), ('Db5', 1), ('C5', 1)],        # 1 Bbm  fallende Linie
    [('Bb4', 1.5), ('Db5', .5), ('Gb5', 2)],                  # 2 Gb
    [('F5', 1.5), ('Eb5', .5), ('Db5', 1), ('Ab4', 1)],       # 3 Db
    [('C5', 1.5), ('A4', .5), ('C5', 1), ('F5', 1)],          # 4 F    (A natürlich = Leitton nach B)
    [('F5', 1), ('Bb5', 1.5), ('Ab5', .5), ('F5', 1)],        # 5 Bbm  Sextsprung aufs hohe B
    [('Gb5', 1.5), ('F5', .5), ('Eb5', 1), ('Db5', 1)],       # 6 Gb
    [('Eb5', 1), ('Gb5', 1), ('Bb5', 1), ('Gb5', 1)],         # 7 Ebm  Arpeggio
    [('C6', 1), ('A5', 1), ('F5', 2)],                        # 8 F    offen (Dominante)
]
M_CH = ['Bbm', 'Gb', 'Db', 'F', 'Bbm', 'Gb', 'Ebm', 'F']

# „Dies irae“ in B-Moll/Dorisch: Des–C–Des–B–C–As–B (Halbton ab, auf, kleine Terz ab, Ganzton auf, große Terz ab, Ganzton auf)
CHANT = [
    [('Db4', 2), ('C4', 1), ('Db4', 1)],
    [('Bb3', 3), ('C4', 1)],
    [('Ab3', 2), ('Bb3', 2)],
    [('Bb3', 4)],
]
CHANT_CH = ['Bbm', 'Bbm', 'Ebm', 'Bbm']

# Mittelteil „letzte Hoffnung“ (Des-Dur)
B_BARS = [
    [('Ab4', 2), ('Db5', 2)],
    [('C5', 2), ('Eb5', 2)],
    [('F5', 2), ('Db5', 1), ('Bb4', 1)],
    [('Bb4', 2), ('Db5', 2)],
    [('F5', 2), ('Ab5', 2)],
    [('Eb5', 1.5), ('F5', .5), ('Eb5', 2)],
    [('Bb4', 1.5), ('Db5', .5), ('Gb5', 2)],
    [('Eb5', 4)],
]
B_CH = ['Db', 'Ab', 'Bbm', 'Gb', 'Db', 'Ab', 'Gb', 'F7']

OUTRO_CH = ['Bbm', 'Gb', 'Ebm', 'F']

# ── Begleit-Bausteine ───────────────────────────────────────────────────────────
def bells(bar0, nbars, vel=84, every=1.0):
    """Totenglocken: Grundton + kleine Sekunde darüber (Reibung). every = Abstand in Vierteln."""
    for k in range(nbars):
        t = song.bar(bar0 + k)
        while t < song.bar(bar0 + k) + 4:
            song.add('bell', t, 3.6, pn('Bb3'), vel)
            song.add('bell', t, 3.6, pn('Cb4') + 0, vel - 14)      # H4 gegen B3: scharfe Reibung
            t += 4.0 * every

def heartbeat(bar0, nbars, vel=96, fast=False):
    for k in range(nbars):
        t = song.bar(bar0 + k)
        beats = [0, 0.5, 2, 2.5] if not fast else [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]
        for i, bt in enumerate(beats):
            song.add('timp', t + bt, 0.45, pn('Bb2') if i % 2 == 0 else pn('F2'), hv(vel if i % 2 == 0 else vel - 24))

def ostinato(bar0, chords, vel=62, accent=10):
    """Unerbittliche 16tel, 3+3+2 betont."""
    pat = (0, 0, 2, 0, 0, 2, 0, 3, 0, 0, 2, 0, 0, 2, 3, 2)
    acc = {0, 3, 6, 8, 11, 14}
    for k, ch in enumerate(chords):
        T = tones(ch, 3)
        ext = [T[0], T[1], T[2], T[0] + 12]
        for i in range(16):
            song.add('strings', song.bar(bar0 + k) + i * 0.25, 0.2, ext[pat[i]], hv(vel + (accent if i in acc else 0)))

def bass_drive(bar0, chords, vel=92):
    for k, ch in enumerate(chords):
        root, _ = CH[ch]
        r = root + 36
        r = r - 12 if r >= 45 else r
        for i in range(8):
            song.add('bass', song.bar(bar0 + k) + i * 0.5, 0.42, r + (12 if i == 6 else 0), hv(vel + (8 if i % 2 == 0 else -8)))

def contra_hold(bar0, chords, vel=80):
    for k, ch in enumerate(chords):
        root, _ = CH[ch]
        r = root + 24
        song.add('contra', song.bar(bar0 + k), 3.9, r if r >= 28 else r + 12, vel)

def tremolo(bar0, chords, vel=50, rise=0.0):
    for k, ch in enumerate(chords):
        T = tones(ch, 3)
        for m in (T[1], T[2], T[0] + 12):
            song.add('trem', song.bar(bar0 + k), 3.95, m, min(120, int(vel + rise * k)))

def choir_pad(bar0, chords, vel=60, oct_=3):
    for k, ch in enumerate(chords):
        T = tones(ch, oct_)
        for m in (T[0], T[1], T[2], T[0] + 12):
            song.add('choir', song.bar(bar0 + k), 3.9, m, vel)

def organ_pedal(bar0, chords, vel=54):
    for k, ch in enumerate(chords):
        T = tones(ch, 2)
        for m in (T[0], T[2]):
            song.add('organ', song.bar(bar0 + k), 3.95, m, vel)

def hits(bar0, nbars, every, vel=96):
    for k in range(0, nbars, every):
        t = song.bar(bar0 + k)
        for m in (pn('Bb2'), pn('F3'), pn('Db4')):
            song.add('hit', t, 0.7, m, vel)
        song.dr(t, CRASH, 100, 1.2)

def drums(bar0, nbars, level):
    """1 Kick auf 1/3 · 2 + Snare 2/4 · 3 + Toms-Fill alle 4 Takte."""
    for k in range(nbars):
        t = song.bar(bar0 + k)
        if level >= 1:
            song.dr(t, KICK, 104, 0.2); song.dr(t + 2, KICK, 100, 0.2)
            if level >= 2: song.dr(t + 1.5, KICK, 80, 0.2)
        if level >= 2:
            song.dr(t + 1, SNARE, 104, 0.15); song.dr(t + 3, SNARE, 108, 0.15)
        if level >= 3 and k % 4 == 3:
            for j, tom in enumerate((TOM_H, TOM_M, TOM_L, TOM_L)):
                song.dr(t + 3 + j * 0.25, tom, 86 + 6 * j, 0.15)

def snare_roll(bar0, start, end, v0=50, v1=125):
    t0 = song.bar(bar0) + start
    n = int((end - start) * 4)
    for i in range(n):
        song.dr(t0 + i * 0.25, SNARE, int(v0 + (v1 - v0) * i / max(1, n - 1)), 0.12)

# ═══════════════════════════════════════════════════════════════════════════════════════════════
b = 0
# ── Intro (8): Glocken, Herzschlag, Tremolo — der Countdown beginnt; Chor flüstert den Chant ────────────
bells(b, 8, vel=92)
heartbeat(b, 8, vel=92)                                    # der Herzschlag setzt sofort ein
tremolo(b, ['Bbm'] * 4 + ['Bbm', 'Gb', 'Ebm', 'F'], vel=44, rise=4)
contra_hold(b, ['Bbm'] * 4 + ['Bbm', 'Bbm', 'Ebm', 'F'], vel=80)
ostinato(b + 4, ['Bbm', 'Bbm', 'Ebm', 'F'], vel=44, accent=6)   # ab Takt 5 setzen die 16tel ein
for k in range(4):                                         # Kick auf 1 und 3: der Boden bebt
    song.dr(song.bar(b + 4 + k), KICK, 86, 0.2); song.dr(song.bar(b + 4 + k) + 2, KICK, 80, 0.2)
mel('choir', b + 4, CHANT, vel=50)                         # flüsternder Chant (Oohs/Aahs, leise)
mel('horn', b + 4, CHANT, vel=40, octave=0)
snare_roll(b + 7, 2, 4, 40, 110)
hits(b + 7, 1, 1, vel=86)
b += 8

# ── A (16): Chant im tiefen Blech, dann Thema ──────────────────────────────────────────────────────
ostinato(b, ['Bbm'] * 4 + ['Bbm', 'Bbm', 'Ebm', 'F'] + M_CH, vel=56)
bass_drive(b, ['Bbm'] * 4 + ['Bbm', 'Bbm', 'Ebm', 'F'] + M_CH, vel=88)
heartbeat(b, 16, vel=96)
bells(b, 16, vel=78)
mel('tromb', b, CHANT, vel=96, octave=-1)                  # Chant eine Oktave tiefer (Posaune + Horn)
mel('horn', b, CHANT, vel=80)
mel('choir', b, CHANT, vel=62)
choir_pad(b + 4, ['Bbm', 'Bbm', 'Ebm', 'F'], vel=52)
drums(b, 8, 1)
mel('violin', b + 8, M_BARS, vel=96)
mel('flute', b + 8, M_BARS, vel=62, octave=1)
tremolo(b + 8, M_CH, vel=40)
organ_pedal(b + 8, M_CH, vel=50)
drums(b + 8, 8, 2)
b += 16

# ── A' (8): Thema mit Trompete + Chor, volle Schläge ──────────────────────────────────────────────
mel('violin', b, M_BARS, vel=98)
mel('trumpet', b, M_BARS, vel=78)
mel('flute', b, M_BARS, vel=60, octave=1)
choir_pad(b, M_CH, vel=64)
ostinato(b, M_CH, vel=60)
bass_drive(b, M_CH, vel=94)
contra_hold(b, M_CH, vel=80)
heartbeat(b, 8, vel=100)
bells(b, 8, vel=80)
drums(b, 8, 3)
hits(b, 8, 4, vel=92)
b += 8

# ── B (8): „letzte Hoffnung“, Des-Dur, choralartig, Ostinato fällt weg ─────────────────────────────────
mel('violin', b, B_BARS, vel=88)
mel('flute', b, B_BARS, vel=64, octave=1)
choir_pad(b, B_CH, vel=60)
organ_pedal(b, B_CH, vel=58)
tremolo(b, B_CH, vel=44, rise=2)
contra_hold(b, B_CH, vel=74)
heartbeat(b, 8, vel=80)
bells(b, 8, vel=70)
song.dr(song.bar(b), KICK, 70, 0.2)
snare_roll(b + 7, 1.5, 4, 40, 120)                         # die Hoffnung wird zermalmt
b += 8

# ── A'' (16): Thema, dann Thema + Chant im Bass ────────────────────────────────────────────────────
for rep in range(2):
    base = b + 8 * rep
    mel('violin', base, M_BARS, vel=98)
    mel('trumpet', base, M_BARS, vel=84)
    mel('flute', base, M_BARS, vel=64, octave=1)
    choir_pad(base, M_CH, vel=68)
    ostinato(base, M_CH, vel=64)
    bass_drive(base, M_CH, vel=98)
    contra_hold(base, M_CH, vel=84)
    heartbeat(base, 8, vel=104)
    bells(base, 8, vel=84)
    drums(base, 8, 3)
    hits(base, 8, 4, vel=100)
mel('tromb', b + 8, CHANT + CHANT, vel=94, octave=-1)      # zweiter Durchgang: der Chant dröhnt darunter (2×4 Takte)
mel('horn', b + 8, CHANT + CHANT, vel=78)
b += 16

# ── C (8): Countdown — die Glocken schlagen immer schneller ───────────────────────────────────────
for k in range(8):
    t0 = song.bar(b + k)
    n = [1, 1, 2, 2, 4, 4, 8, 8][k]                         # Schläge pro Takt
    for i in range(n):
        song.add('bell', t0 + i * 4.0 / n, 3.0 / n + 0.2, pn('Bb3'), 86 + k * 2)
        song.add('bell', t0 + i * 4.0 / n, 3.0 / n + 0.2, pn('Cb4'), 70 + k * 2)
tremolo(b, ['Bbm', 'Bbm', 'Gb', 'Gb', 'Ebm', 'Ebm', 'F', 'F'], vel=50, rise=6)
choir_pad(b, ['Bbm', 'Bbm', 'Gb', 'Gb', 'Ebm', 'Ebm', 'F', 'F'], vel=54)
contra_hold(b, ['Bbm', 'Bbm', 'Gb', 'Gb', 'Ebm', 'Ebm', 'F', 'F'], vel=80)
heartbeat(b, 4, vel=100)
heartbeat(b + 4, 4, vel=106, fast=True)
mel('violin', b + 4, [[('F5', 4)], [('Gb5', 4)], [('A5', 4)], [('C6', 4)]], vel=84)   # Riser
snare_roll(b + 4, 0, 16, 40, 125)
snare_roll(b + 7, 0, 4, 90, 127)
b += 8

# ── Finale (16): Thema in allen Stimmen, Chant als Gegenstimme, höchste Dichte ───────────────────────
for rep in range(2):
    base = b + 8 * rep
    mel('violin', base, M_BARS, vel=100)
    mel('trumpet', base, M_BARS, vel=92)
    mel('flute', base, M_BARS, vel=70, octave=1)
    mel('horn', base, M_BARS, vel=70, octave=-1)
    choir_pad(base, M_CH, vel=72)
    organ_pedal(base, M_CH, vel=60)
    ostinato(base, M_CH, vel=68, accent=12)
    bass_drive(base, M_CH, vel=102)
    contra_hold(base, M_CH, vel=86)
    heartbeat(base, 8, vel=108)
    bells(base, 8, vel=88)
    drums(base, 8, 3)
    hits(base, 8, 2, vel=104)
mel('tromb', b, CHANT + CHANT, vel=96, octave=-1)
mel('tromb', b + 8, CHANT + CHANT, vel=100, octave=-1)
snare_roll(b + 15, 1, 4, 80, 127)
b += 16

# ── Outro (8): Glocken, die Welt hält den Atem an — endet auf F (→ Loop) ────────────────────────────────
mel('violin', b, [M_BARS[0], M_BARS[1], M_BARS[2], [('C5', 4)]], vel=74)
mel('flute', b + 4, [[('A4', 4)], [('Bb4', 2), ('A4', 2)], [('C5', 4)], [('A4', 4)]], vel=60)
choir_pad(b, OUTRO_CH + OUTRO_CH, vel=58)
tremolo(b, OUTRO_CH + OUTRO_CH, vel=40)
contra_hold(b, OUTRO_CH + OUTRO_CH, vel=76)
heartbeat(b, 8, vel=84)
bells(b, 8, vel=80)
drums(b, 4, 1)
snare_roll(b + 7, 1, 4, 40, 118)
b += 8
assert b == BARS, (b, BARS)

if os.environ.get('DAMUS_NORENDER') != '1':
    sf2, out = cli_paths('bgm_damus.ogg')
    song.render(sf2, out, target_rms=0.26, saturate=False, compress=True)
