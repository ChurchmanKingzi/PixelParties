# -*- coding: utf-8 -*-
"""Battle-Theme "Null, the Mage Slayer" → public/music/bgm_null.ogg

Militärisch, bedrohlich, mechanisch: Marschtrommel + Pauke, tiefer Bass-Ostinato
in d-Moll (Phrygisch ♭2 + Tritonus), Blech-Motiv, ticken­de Marimba (Konstrukt).
Rendert per FluidSynth mit der Pixel-Parties-SoundFont (16-Bit Game Station).

Aufruf:  python3 scripts/music/null_battle.py <soundfont.sf2> [ausgabe.ogg]
Braucht: mido, numpy, soundfile, fluidsynth (CLI). 64 Takte, nahtlos loopbar.
"""
import sys, os, subprocess, tempfile
import mido, numpy as np, soundfile as sf

SF2 = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(
    os.path.dirname(__file__), '..', '..', 'public', 'music', 'bgm_null.ogg')
BPM, BARS, TPB = 132, 64, 480
TAIL_BARS = 2

# Kanäle: (Programm, Bank)
CH = dict(bass=0, contra=1, timp=2, tromb=3, horns=4, stacc=5, choir=6, trump=7,
          hit=8, drum=9, saw=10, marim=11, bell=12, scifi=13, sbrass=14, pizz=15)
PROG = {'bass': (38, 0), 'contra': (43, 0), 'timp': (47, 0), 'tromb': (57, 0),
        'horns': (60, 0), 'stacc': (48, 0), 'choir': (52, 0), 'trump': (56, 0),
        'hit': (55, 0), 'saw': (81, 0), 'marim': (12, 0), 'bell': (14, 0),
        'scifi': (103, 0), 'sbrass': (62, 0), 'pizz': (45, 0)}
VOL = {'bass': 100, 'contra': 90, 'timp': 105, 'tromb': 92, 'horns': 88, 'stacc': 84,
       'choir': 70, 'trump': 88, 'hit': 100, 'drum': 112, 'saw': 66, 'marim': 78,
       'bell': 72, 'scifi': 60, 'sbrass': 86, 'pizz': 90}

C, D, Eb, E, F, G, Ab, A, Bb = 0, 2, 3, 4, 5, 7, 8, 9, 10   # Tonleiterstufen (d-Moll/Phrygisch)
def n(pc, octv): return 12 * (octv + 1) + pc     # MIDI-Note

ev = []  # (tick, order, msg)
def add(ch, beat, dur, pitch, vel=90):
    t0 = int(beat * TPB); t1 = int((beat + dur) * TPB)
    ev.append((t0, 1, mido.Message('note_on', channel=CH[ch], note=int(pitch), velocity=int(min(127, vel)))))
    ev.append((t1, 0, mido.Message('note_off', channel=CH[ch], note=int(pitch), velocity=0)))
def bar(b): return b * 4.0   # Beat-Position des Taktanfangs (0-basiert)

# Schlagzeug (GM-Map der Drum-Bank)
KICK, SNARE, HAT, OHAT, CRASH, TOM_L, TOM_M, TOM_H, RIDE = 36, 38, 42, 46, 49, 45, 47, 50, 51
def dr(beat, note, vel=100, dur=0.2): add('drum', beat, dur, note, vel)

# ---- Bausteine ---------------------------------------------------------
def march(b, intensity=2, fill=False):
    """Marschrhythmus: Kick auf 1/3, Snare-Wirbel-Muster, Hi-Hat 8tel."""
    s = bar(b)
    dr(s + 0, KICK, 118); dr(s + 2, KICK, 112)
    if intensity >= 2: dr(s + 1.5, KICK, 90); dr(s + 3.5, KICK, 96)
    # Marsch-Snare: 1e&a-Muster, Backbeat betont
    for beat, v in [(1, 118), (1.75, 70), (2.5, 80), (3, 120), (3.5, 74), (3.75, 88)]:
        dr(s + beat, SNARE, v)
    if intensity >= 1:
        for i in range(8): dr(s + i * 0.5, HAT, 70 if i % 2 else 88)
    if fill:
        for i, t in enumerate([TOM_H, TOM_H, TOM_M, TOM_M, TOM_L, TOM_L, KICK, KICK]):
            dr(s + 2 + i * 0.25, t, 90 + i * 4)

def snare_roll(b, start=2, end=4, v0=60, v1=120):
    s = bar(b) + start; steps = int((end - start) * 4)
    for i in range(steps):
        dr(s + i * 0.25, SNARE, v0 + (v1 - v0) * i / max(1, steps - 1), 0.15)

def bass_ostinato(b, root=D, oct_=2, vel=100, ch='bass', var=0):
    """Treibendes Achtel-Ostinato; ♭2 und Tritonus für die Bedrohung."""
    s = bar(b)
    pat = [(0, 0), (0.5, 0), (1, 0), (1.5, 1), (2, 0), (2.5, 0), (3, 6), (3.5, 1)]  # Halbtonschritte
    if var == 1: pat = [(0, 0), (0.5, 0), (1, 12), (1.5, 0), (2, 0), (2.5, 1), (3, 0), (3.5, 6)]
    for off, semi in pat:
        add(ch, s + off, 0.42, n(root, oct_) + semi, vel + (8 if off in (0, 2) else 0))

def contra_pedal(b, root=D, beats=4.0, vel=88):
    add('contra', bar(b), beats, n(root, 1), vel)

def stacc_chords(b, chord, vel=84, rhythm='march'):
    s = bar(b)
    pos = {'march': [0, 1.5, 2, 3.5], 'push': [0, 0.75, 1.5, 2, 2.75, 3.5], 'ticks': [i * 0.5 for i in range(8)]}[rhythm]
    for p in pos:
        for pc in chord: add('stacc', s + p, 0.3, pc, vel)

def timp(b, pattern='pulse', vel=104):
    s = bar(b)
    if pattern == 'pulse':
        for p in (0, 2): add('timp', s + p, 0.4, n(D, 2), vel)
        add('timp', s + 3.5, 0.3, n(A, 1), vel - 14)
    elif pattern == 'gallop':
        for p in (0, 0.75, 1, 2, 2.75, 3): add('timp', s + p, 0.3, n(D, 2) if p % 2 == 0 else n(A, 1), vel)
    elif pattern == 'roll':
        for i in range(16): add('timp', s + i * 0.25, 0.25, n(D, 2), 60 + i * 3)

def hit(b, beat=0, chord=(n(D, 3), n(A, 3), n(D, 4)), vel=110, dur=0.6):
    for p in chord: add('hit', bar(b) + beat, dur, p, vel)

# ---- Motive -----------------------------------------------------------
# Hauptmotiv "Die Jagd": punktierter Marsch, ♭2-Druck, fällt auf den Tritonus.
def motif_hunt(b, inst='tromb', oct_=3, vel=96, shift=0):
    s = bar(b)
    notes = [(0, 0.75, D), (0.75, 0.25, D), (1, 0.75, Eb), (1.75, 0.25, D),
             (2, 1.0, F), (3, 0.5, Eb), (3.5, 0.5, D)]
    for off, dur, pc in notes: add(inst, s + off, dur * 0.92, n((pc + shift) % 12, oct_), vel)
def motif_hunt2(b, inst='tromb', oct_=3, vel=96, shift=0):
    s = bar(b)
    notes = [(0, 0.75, D), (0.75, 0.25, D), (1, 0.75, Eb), (1.75, 0.25, D),
             (2, 0.5, G), (2.5, 0.5, F), (3, 0.5, Eb), (3.5, 0.5, Ab)]
    for off, dur, pc in notes: add(inst, s + off, dur * 0.92, n((pc + shift) % 12, oct_), vel)

def fanfare(b, inst='trump', vel=96):
    """Fanfarenruf über zwei Takte: Quarte hoch, gestoppt, Tritonus-Abschluss."""
    s = bar(b)
    seq = [(0, 0.5, A, 4), (0.5, 0.5, A, 4), (1, 1.5, D, 5), (2.5, 0.5, C, 5), (3, 1.0, Bb, 4),
           (4, 0.5, A, 4), (4.5, 0.5, A, 4), (5, 1.5, F, 5), (6.5, 0.5, Eb, 5), (7, 1.0, Ab, 4)]
    for off, dur, pc, o in seq: add(inst, s + off, dur * 0.9, n(pc, o), vel)

def melody_lead(b, inst='sbrass', vel=92):
    """Bedrohliche Lead-Linie (2 Takte): chromatisches Kreisen um die Quinte."""
    s = bar(b)
    seq = [(0, 1, A, 4), (1, 0.5, Bb, 4), (1.5, 0.5, A, 4), (2, 1, F, 4), (3, 1, E, 4),
           (4, 1, D, 5), (5, 0.5, C, 5), (5.5, 0.5, Bb, 4), (6, 1, A, 4), (7, 1, Ab, 4)]
    for off, dur, pc, o in seq: add(inst, s + off, dur * 0.95, n(pc, o), vel)

def saw_arp(b, root=D, vel=64, up=True):
    """Unerbittliche 16tel-Arpeggien — die Jagd läuft."""
    s = bar(b)
    cyc = [0, 3, 7, 12, 7, 3, 6, 3] if up else [12, 7, 3, 0, 3, 7, 6, 7]
    for i in range(16):
        add('saw', s + i * 0.25, 0.22, n(root, 3) + cyc[i % 8], vel + (10 if i % 4 == 0 else 0))

def marimba_tick(b, vel=78, root=D):
    """Mechanisches Ticken: Konstrukt/Zielerfassung."""
    s = bar(b)
    for p, semi in [(0, 0), (0.5, 0), (1, 12), (1.5, 0), (2, 0), (2.5, 6), (3, 0), (3.5, 12)]:
        add('marim', s + p, 0.2, n(root, 4) + semi, vel)

def choir_chord(b, chord, beats=4, vel=72):
    for pc in chord: add('choir', bar(b), beats, pc, vel)

# Akkorde (MIDI)
Dm = [n(D, 3), n(F, 3), n(A, 3)]
Ebc = [n(Eb, 3), n(G, 3), n(Bb, 3)]
Gm = [n(G, 3), n(Bb, 3), n(D, 4)]
Adim = [n(A, 2), n(C, 3), n(Eb, 3)]
Ab5 = [n(Ab, 2), n(3, 3), n(Ab, 3)]
A5 = [n(A, 2), n(D, 3), n(A, 3)]
Dpow = [n(D, 3), n(A, 3), n(D, 4)]

# ---- Arrangement: 64 Takte ---------------------------------------------
# A: Intro (0-7) — Marsch beginnt, Bedrohung kriecht heran
for b in range(0, 8):
    timp(b, 'pulse', 92 + b * 2)
    if b >= 2: march(b, intensity=0 if b < 4 else 1)
    contra_pedal(b, D, 4, 80)
    if b >= 4: bass_ostinato(b, D, 2, 84)
    if b in (0, 4): add('bell', bar(b), 3.5, n(D, 4), 78); add('bell', bar(b) + 2, 1.5, n(Ab, 4), 66)
    if b >= 6: marimba_tick(b, 66)
hit(0, 0, vel=118, dur=1.5)
snare_roll(7, 0, 4, 40, 118)
dr(bar(7) + 3.75, CRASH, 100)

# B: Erstes Thema (8-23) — Blech-Motiv über Marsch
for b in range(8, 24):
    march(b, 2, fill=(b % 8 == 7))
    timp(b, 'pulse')
    bass_ostinato(b, D if b % 4 != 3 else D, 2, 100, var=1 if b % 4 == 3 else 0)
    contra_pedal(b, D, 4, 84)
    stacc_chords(b, Dm if b % 4 != 3 else Ab5, 78, 'march')
    if b % 2 == 0: marimba_tick(b, 70)
    (motif_hunt if b % 4 in (0, 1) else motif_hunt2)(b, 'tromb', 3, 98)
    if b >= 16: (motif_hunt if b % 4 in (0, 1) else motif_hunt2)(b, 'horns', 4, 82)
dr(bar(8), CRASH, 110)
dr(bar(16), CRASH, 108)

# C: Verfolgung (24-39) — Arpeggien, Fanfare, Chor
prog = [Dm, Dm, Ebc, A5]   # d – d – Es (♭2) – A (Dominante)
for b in range(24, 40):
    k = b % 4
    march(b, 2, fill=(b % 4 == 3))
    timp(b, 'gallop' if k == 3 else 'pulse')
    bass_ostinato(b, D if k < 2 else (Eb if k == 2 else A), 2 if k != 3 else 1, 102, var=k % 2)
    contra_pedal(b, D if k < 2 else (Eb if k == 2 else A), 4, 86)
    stacc_chords(b, prog[k], 82, 'push')
    saw_arp(b, D if k < 2 else (Eb if k == 2 else A), 62)
    choir_chord(b, prog[k], 4, 68)
    if k in (0, 2): marimba_tick(b, 72)
for b in (24, 28, 32, 36):
    fanfare(b, 'trump', 100)
    fanfare(b, 'horns', 86)
dr(bar(24), CRASH, 112)
dr(bar(32), CRASH, 112)
hit(31, 3, Dpow, 110, 0.9)
snare_roll(39, 0, 4, 50, 124)
dr(bar(39) + 3.75, CRASH, 118)

# D: Höhepunkt (40-55) — Volle Besetzung, Lead-Melodie, Tritonus-Hämmer
for b in range(40, 56):
    k = b % 4
    march(b, 2, fill=(b % 4 == 3))
    timp(b, 'gallop')
    root = D if k < 2 else (Eb if k == 2 else A)
    bass_ostinato(b, root, 2 if k != 3 else 1, 108, var=k % 2)
    contra_pedal(b, root, 4, 90)
    stacc_chords(b, prog[k], 88, 'ticks')
    saw_arp(b, root, 70, up=(k % 2 == 0))
    choir_chord(b, prog[k], 4, 78)
    if b % 2 == 0: melody_lead(b, 'sbrass', 96); add('scifi', bar(b), 7.5, n(D, 4), 62)
    motif_hunt(b, 'tromb', 3, 100) if k in (0, 1) else motif_hunt2(b, 'tromb', 3, 100)
    motif_hunt(b, 'horns', 4, 88) if k in (0, 1) else motif_hunt2(b, 'horns', 4, 88)
    if b % 8 in (0, 4): hit(b, 0, Dpow, 112, 0.5); dr(bar(b), CRASH, 114)
for b in (44, 52): fanfare(b, 'trump', 104)

# E: Rückführung (56-63) — Wegbrechen, Wirbel, zurück in den Loop
for b in range(56, 64):
    timp(b, 'roll' if b >= 62 else 'pulse', 90 + (b - 56) * 3)
    contra_pedal(b, D, 4, 84)
    if b < 60: bass_ostinato(b, D, 2, 90); march(b, 1)
    else: stacc_chords(b, Dm, 70 + (b - 60) * 6, 'ticks')
    if b < 62: marimba_tick(b, 70)
    if b >= 60: saw_arp(b, D, 54 + (b - 60) * 4)
    if b in (56, 58): add('tromb', bar(b), 3.6, n(D, 3), 90); add('tromb', bar(b) + 2, 1.9, n(Ab, 3), 82)
snare_roll(62, 0, 4, 50, 112); snare_roll(63, 0, 4, 90, 127)
for i in range(4): add('hit', bar(63) + 3 + i * 0.0, 0.9, [n(D, 2), n(A, 2), n(D, 3), n(A, 3)][i], 118)

# ---- MIDI schreiben ---------------------------------------------------
mid = mido.MidiFile(ticks_per_beat=TPB)
tr = mido.MidiTrack(); mid.tracks.append(tr)
tr.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(BPM)))
for name, ch in CH.items():
    if name == 'drum': tr.append(mido.Message('control_change', channel=9, control=7, value=VOL['drum'])); continue
    prog, bank = PROG[name]
    tr.append(mido.Message('control_change', channel=ch, control=0, value=bank))
    tr.append(mido.Message('program_change', channel=ch, program=prog))
    tr.append(mido.Message('control_change', channel=ch, control=7, value=VOL[name]))
    pan = {'bass': 60, 'contra': 64, 'timp': 64, 'tromb': 52, 'horns': 76, 'stacc': 44, 'choir': 64,
           'trump': 72, 'hit': 64, 'saw': 84, 'marim': 40, 'bell': 90, 'scifi': 30, 'sbrass': 64, 'pizz': 64}[name]
    tr.append(mido.Message('control_change', channel=ch, control=10, value=pan))
ev.sort(key=lambda e: (e[0], e[1]))
last = 0
for t, _, m in ev:
    m = m.copy(time=t - last); last = t; tr.append(m)
end = (BARS + TAIL_BARS) * 4 * TPB
tr.append(mido.MetaMessage('end_of_track', time=max(0, end - last)))

tmp = tempfile.mkdtemp()
mp = os.path.join(tmp, 'n.mid'); wp = os.path.join(tmp, 'n.wav')
mid.save(mp)
subprocess.run(['fluidsynth', '-ni', '-g', '0.7', '-R', '1', '-C', '1', '-r', '44100',
                '-F', wp, SF2, mp], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
data, sr = sf.read(wp, always_2d=True)

# Nahtloser Loop: Hall-Ausklang (nach Takt 64) auf den Anfang mischen.
loop_len = int(BARS * 4 * 60 / BPM * sr)
body, tail = data[:loop_len].copy(), data[loop_len:]
k = min(len(tail), len(body))
body[:k] += tail[:k]
# Lautheit an die übrigen Themes angleichen (RMS ≈ 0.27) und mit einem
# Lookahead-Limiter auf -0,8 dBFS begrenzen (sonst überfahren Drums die Spitze).
from scipy.ndimage import minimum_filter1d, uniform_filter1d
body = body / np.sqrt((body ** 2).mean()) * 0.30
body = np.tanh(body / 0.5) * 0.5                                   # weiche Sättigung: Spitzen verdichten
body = body / np.sqrt((body ** 2).mean()) * 0.29
CEIL = 0.91
need = np.minimum(1.0, CEIL / np.maximum(np.abs(body).max(axis=1), 1e-9))
la = int(0.004 * sr)
g = minimum_filter1d(need, size=la * 2, mode='nearest')            # Lookahead: Reduktion vorziehen
g = uniform_filter1d(g, size=la * 2, mode='nearest')               # weich einblenden
g = np.minimum(g, need)                                            # nie über die Grenze
rel = np.copy(g)
alpha = np.exp(-1.0 / (0.12 * sr))                                 # Release ≈ 120 ms
for i in range(1, len(rel)):
    rel[i] = min(g[i], alpha * rel[i - 1] + (1 - alpha) * g[i]) if g[i] < rel[i - 1] else alpha * rel[i - 1] + (1 - alpha) * g[i]
rel = np.minimum(rel, need)
body = body * rel[:, None]
body = body.astype(np.float32)
# In Blöcken schreiben: ein Einzelaufruf stürzt mit libsndfile 1.2.2 (Vorbis) ab.
with sf.SoundFile(OUT, 'w', sr, 2, format='OGG', subtype='VORBIS') as f:
    for i in range(0, len(body), sr):
        f.write(body[i:i + sr])
print('OK', OUT, round(len(body) / sr, 1), 's')
