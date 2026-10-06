# -*- coding: utf-8 -*-
"""Gemeinsame Werkzeuge für alle Pixel-Parties-Battle-Tracks.

Jeder Track ist ein Skript, das `Song` benutzt:

    from lib import *
    song = Song(bpm=132, bars=64)
    song.add('bass', beat, dauer, note, velocity)   # beat 0-basiert, in Vierteln
    song.dr(beat, KICK, 110)                        # Schlagzeug
    song.render(sf2, out_ogg)

`render` erzwingt die Loop-Eigenschaften, die alle Themes haben müssen:
  • Länge = GANZE Takte (Sample-genau), damit der Web-Audio-Looper (Client:
    Gapless-Looper) ohne Lücke von Ende auf Anfang springt.
  • Hall-Ausklang der Nachlauf-Takte wird auf den Anfang gemischt.
  • Naht-Sprung wird gemessen und muss unter dem üblichen Sample-Schritt
    liegen (kein Knacken), sonst bricht das Rendern ab.
  • Lautheit RMS ≈ 0,29 wie die übrigen Themes, Lookahead-Limiter -0,8 dBFS.
Braucht: mido, numpy, scipy, soundfile, fluidsynth (CLI).
"""
import sys, os, subprocess, tempfile
import mido, numpy as np, soundfile as sf
from scipy.ndimage import minimum_filter1d, uniform_filter1d

TPB = 480
# Tonleiterstufen (Halbtöne über C) und MIDI-Note
C, Db, D, Eb, E, F, Gb, G, Ab, A, Bb, B = range(12)
def n(pc, octv): return 12 * (octv + 1) + pc

# Schlagzeug (Drum-Bank 128)
KICK, SNARE, SIDESTICK, HAT, OHAT, PHAT, CRASH, RIDE = 36, 38, 37, 42, 46, 44, 49, 51
TOM_L, TOM_M, TOM_H, TOM_HH, CLAP, COWBELL = 45, 47, 50, 48, 39, 56

# Instrumente der SoundFont (Programm, Bank) — Namen wie in der SF2
INSTR = {
    'piano': (0, 0), 'epiano': (5, 0), 'glock': (9, 0), 'vibes': (11, 0), 'marimba': (12, 0),
    'xylo': (13, 0), 'bell': (14, 0), 'organ': (16, 0), 'organ2': (17, 0), 'rockorgan': (18, 0),
    'pipeorgan': (19, 0), 'harmonica': (22, 0), 'guitar': (24, 0), 'cleangtr': (27, 0),
    'rockgtr': (30, 0), 'acbass': (32, 0), 'bass': (33, 0), 'bass2': (34, 0), 'sbass': (38, 0),
    'sbass2': (39, 0), 'violin': (40, 0), 'contra': (43, 0), 'tremolo': (44, 0), 'pizz': (45, 0),
    'harp': (46, 0), 'timp': (47, 0), 'strings': (48, 0), 'slowstr': (49, 0), 'synstr': (50, 0),
    'synstr2': (51, 0), 'choir': (52, 0), 'oohs': (53, 0), 'synvoice': (54, 0), 'hit': (55, 0),
    'trumpet': (56, 0), 'trombone': (57, 0), 'tuba': (58, 0), 'muted': (59, 0), 'horns': (60, 0),
    'brass': (61, 0), 'sbrass': (62, 0), 'sbrass2': (63, 0), 'sax': (64, 0), 'oboe': (68, 0),
    'bassoon': (70, 0), 'clarinet': (71, 0), 'flute': (73, 0), 'recorder': (74, 0), 'whistle': (78, 0),
    'ocarina': (79, 0), 'square': (80, 0), 'saw': (81, 0), 'calliope': (82, 0), 'chiff': (83, 0),
    'charang': (84, 0), 'solovoice': (85, 0), 'fifths': (86, 0), 'basslead': (87, 0),
    'newage': (88, 0), 'warm': (89, 0), 'poly': (90, 0), 'bowed': (92, 0), 'sweep': (95, 0),
    'rain': (96, 0), 'soundtrack': (97, 0), 'crystal': (98, 0), 'atmos': (99, 0), 'bright': (100, 0),
    'goblins': (101, 0), 'echoes': (102, 0), 'scifi': (103, 0), 'koto': (107, 0), 'kalimba': (108, 0),
    'bagpipe': (109, 0), 'harpsichord': (6, 0), 'accordion': (21, 0), 'acidbass': (38, 8),
    'squarebass': (38, 22), 'sine': (80, 8), 'triangle': (80, 2), 'wavetable': (85, 1),
}

class Song:
    def __init__(self, bpm, bars, tail_bars=2, beats_per_bar=4):
        self.bpm, self.bars, self.tail_bars, self.bpb = bpm, bars, tail_bars, beats_per_bar
        self.ev, self.ch, self.vol, self.pan = [], {}, {}, {}
        self.next_ch = 0

    def inst(self, name, instrument, vol=90, pan=64):
        """Stimme anlegen. `instrument` ist ein Schlüssel aus INSTR."""
        if name == 'drum': raise ValueError("'drum' ist fest belegt")
        ch = self.next_ch
        if ch == 9: ch = 10
        if ch > 15: raise ValueError('max. 15 melodische Stimmen')
        self.next_ch = ch + 1
        self.ch[name] = (ch, INSTR[instrument]); self.vol[name] = vol; self.pan[name] = pan

    def bar(self, b): return b * self.bpb          # Beat-Position eines Taktanfangs

    def add(self, name, beat, dur, pitch, vel=90):
        ch = 9 if name == 'drum' else self.ch[name][0]
        t0, t1 = int(round(beat * TPB)), int(round((beat + dur) * TPB))
        self.ev.append((t0, 1, mido.Message('note_on', channel=ch, note=int(pitch), velocity=int(max(1, min(127, vel))))))
        self.ev.append((t1, 0, mido.Message('note_off', channel=ch, note=int(pitch), velocity=0)))

    def dr(self, beat, note, vel=100, dur=0.2): self.add('drum', beat, dur, note, vel)

    def program(self, name, beat, instrument):
        """Instrument einer Stimme MITTEN im Stück wechseln (für lange Stücke mit mehr Klangfarben als Kanälen).
        Der Wechsel gilt ab `beat`; Noten, die dort beginnen, klingen schon mit dem neuen Instrument."""
        ch = self.ch[name][0]
        prog, bank = INSTR[instrument]
        t = int(round(beat * TPB))
        self.ev.append((t, -1, mido.Message('control_change', channel=ch, control=0, value=bank)))
        self.ev.append((t, -1, mido.Message('program_change', channel=ch, program=prog)))

    def cc(self, name, beat, control, value):
        ch = 9 if name == 'drum' else self.ch[name][0]
        self.ev.append((int(round(beat * TPB)), 0, mido.Message('control_change', channel=ch, control=control, value=int(value))))

    def render(self, sf2, out, gain=0.7, target_rms=0.29, verbose=True, saturate=True, compress=False):
        """saturate=True  (Standard, bisherige Tracks): weiche tanh-Sättigung vor dem Limiter — macht Schlagzeug-
        lastige Duell-Tracks dicht und laut, verzerrt aber spitzenreiche Klänge (Klavier, Harfe, Zupfer) hörbar.
        saturate=False, compress=True: für akustische/leise Stücke (Draft-Musik …): sanfter Kompressor + Lookahead-
        Limiter statt Sättigung — kein Verzerren, nur Absenken der Spitzen."""
        mid = mido.MidiFile(ticks_per_beat=TPB)
        tr = mido.MidiTrack(); mid.tracks.append(tr)
        tr.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(self.bpm)))
        tr.append(mido.Message('control_change', channel=9, control=7, value=112))
        for name, (ch, (prog, bank)) in self.ch.items():
            tr.append(mido.Message('control_change', channel=ch, control=0, value=bank))
            tr.append(mido.Message('program_change', channel=ch, program=prog))
            tr.append(mido.Message('control_change', channel=ch, control=7, value=self.vol[name]))
            tr.append(mido.Message('control_change', channel=ch, control=10, value=self.pan[name]))
        last = 0
        for t, _, m in sorted(self.ev, key=lambda e: (e[0], e[1])):
            tr.append(m.copy(time=t - last)); last = t
        end = (self.bars + self.tail_bars) * self.bpb * TPB
        tr.append(mido.MetaMessage('end_of_track', time=max(0, end - last)))
        tmp = tempfile.mkdtemp()
        mp, wp = os.path.join(tmp, 'n.mid'), os.path.join(tmp, 'n.wav')
        mid.save(mp)
        subprocess.run(['fluidsynth', '-ni', '-g', str(gain), '-R', '1', '-C', '1', '-r', '44100', '-F', wp, '-T', 'wav', '-O', 'float', sf2, mp],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        data, sr = sf.read(wp, always_2d=True)
        loop_len = int(round(self.bars * self.bpb * 60 / self.bpm * sr))
        body, tail = data[:loop_len].copy(), data[loop_len:]
        k = min(len(tail), len(body)); body[:k] += tail[:k]      # Ausklang auf den Anfang
        # Lautheit + Limiter
        if saturate:
            body = body / np.sqrt((body ** 2).mean()) * 0.30
            body = np.tanh(body / 0.5) * 0.5
            body = body / np.sqrt((body ** 2).mean()) * target_rms
        else:
            body = body / np.sqrt((body ** 2).mean()) * target_rms
            if compress:
                # 40-ms-RMS-Detektor, Schwelle = Ziel-RMS, Verhältnis 3,5:1, Pegel dann wieder auf Ziel-RMS
                env = np.sqrt(np.maximum(uniform_filter1d(np.mean(body ** 2, axis=1), size=int(0.040 * sr), mode='nearest'), 0.0))   # Rundungsfehler in digitaler Stille nie negativ
                gk = np.maximum(env / target_rms, 1.0) ** (1 / 3.5 - 1)
                gk = uniform_filter1d(gk, size=int(0.015 * sr), mode='nearest')
                body = body * gk[:, None]
                body = body / np.sqrt((body ** 2).mean()) * target_rms
        CEIL = 0.91
        need = np.minimum(1.0, CEIL / np.maximum(np.abs(body).max(axis=1), 1e-9))
        la = int(0.004 * sr)
        g = minimum_filter1d(need, size=la * 2, mode='nearest')
        g = np.minimum(uniform_filter1d(g, size=la * 2, mode='nearest'), need)
        alpha = np.exp(-1.0 / (0.12 * sr)); rel = np.copy(g)
        for i in range(1, len(rel)):
            rel[i] = g[i] if g[i] < rel[i - 1] else alpha * rel[i - 1] + (1 - alpha) * g[i]
        body = (body * np.minimum(rel, need)[:, None]).astype(np.float32)
        # Naht prüfen: Sprung Ende→Anfang darf nicht größer sein als der größte übliche Schritt
        m = body.mean(axis=1)
        jump = abs(float(m[0] - m[-1])); step = float(np.percentile(np.abs(np.diff(m)), 99))
        if jump > step: raise SystemExit(f'LOOP-NAHT ZU HART: Sprung {jump:.4f} > {step:.4f}')
        with sf.SoundFile(out, 'w', sr, 2, format='OGG', subtype='VORBIS') as f:   # in Blöcken (libsndfile-Absturz)
            for i in range(0, len(body), sr): f.write(body[i:i + sr])
        # Vorbis überschwingt beim Kodieren: dekodierte Datei prüfen und bei Bedarf leiser neu schreiben.
        for _ in range(3):
            dec, _sr = sf.read(out, dtype='float32', always_2d=True)
            pk = float(np.abs(dec).max())
            if pk <= 0.985: break
            body = (body * (0.95 / pk)).astype(np.float32)
            with sf.SoundFile(out, 'w', sr, 2, format='OGG', subtype='VORBIS') as f:
                for i in range(0, len(body), sr): f.write(body[i:i + sr])
        if verbose:
            print(f'OK {os.path.basename(out)} {len(body)/sr:.1f}s  RMS {np.sqrt((body**2).mean()):.3f}  Peak(dec) {np.abs(dec).max():.2f}  Naht {jump:.4f}<={step:.4f}')

def cli_paths(default_name):
    """(sf2, out) aus argv; Ausgabe standardmäßig public/music/<default_name>."""
    if len(sys.argv) < 2: raise SystemExit('Aufruf: python3 <track>.py <soundfont.sf2> [ausgabe.ogg]')
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'music', default_name)
    return sys.argv[1], out
