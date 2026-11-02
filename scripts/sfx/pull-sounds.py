#!/usr/bin/env python3
# Erzeugt die Klänge der Shop-Pull-Inszenierung (public/sounds/pull_*.ogg) rein synthetisch:
#   python3 scripts/sfx/pull-sounds.py
# Braucht numpy und ffmpeg (libvorbis). Die Klänge folgen den Momenten der Animation (ShopPullReveal, public/app-screens.jsx):
#   pull_circle   Beschwörungskreis zeichnet sich (Drohnen-Swell + Luftrauschen + leise Glöckchen)
#   pull_crack    ein Riss springt über die Karte (Glas-/Eisknacken)
#   pull_note     Glockenton, wird je Riss per playbackRate eine Stufe höher gespielt (Dur-Arpeggio = steigende Spannung)
#   pull_swell    Überladung: steigender Ton + Rauschen + schneller werdendes Zittern, endet abrupt vor dem Einschlag
#   pull_shatter  die Karte zerspringt (Bums + Splitterregen)
#   pull_reveal   Enthüllung: strahlender Akkord mit Funkeln
#   pull_sparkle  schnelles Glockenarpeggio für den Sternenring
import os
import subprocess
import tempfile
import wave

import numpy as np

SR = 44100
RNG = np.random.default_rng(20260211)
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'sounds')


def t_axis(sec):
    return np.arange(int(sec * SR)) / SR


def env_ad(n, attack, decay_tau):
    """Attack (linear) dann exponentieller Abfall."""
    t = np.arange(n) / SR
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    return a * np.exp(-t / decay_tau)


def sine(freq, sec, phase=0.0):
    t = t_axis(sec)
    f = freq if np.ndim(freq) else np.full_like(t, freq)
    return np.sin(2 * np.pi * np.cumsum(f) / SR + phase)


def noise(sec):
    return RNG.standard_normal(int(sec * SR))


def biquad_bp(x, fc, q=2.0):
    """Bandpass (RBJ); fc darf ein Array sein (wandernde Mittenfrequenz)."""
    fc = np.broadcast_to(fc, x.shape).astype(float)
    y = np.zeros_like(x)
    x1 = x2 = y1 = y2 = 0.0
    for i in range(len(x)):
        w0 = 2 * np.pi * min(fc[i], SR * 0.45) / SR
        alpha = np.sin(w0) / (2 * q)
        b0, b2 = alpha, -alpha
        a0, a1, a2 = 1 + alpha, -2 * np.cos(w0), 1 - alpha
        out = (b0 * x[i] + b2 * x2 - a1 * y1 - a2 * y2) / a0
        x2, x1, y2, y1 = x1, x[i], y1, out
        y[i] = out
    return y


def lowpass(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.zeros_like(x)
    s = 0.0
    for i in range(len(x)):
        s = (1 - a) * x[i] + a * s
        y[i] = s
    return y


def highpass(x, fc):
    return x - lowpass(x, fc)


def bell(freq, sec, tau=0.35, index=2.2, ratio=3.5):
    """FM-Glocke: Träger + Modulator mit abklingendem Index."""
    t = t_axis(sec)
    idx = index * np.exp(-t / (tau * 0.6))
    mod = np.sin(2 * np.pi * freq * ratio * t)
    car = np.sin(2 * np.pi * freq * t + idx * mod)
    pure = 0.35 * np.sin(2 * np.pi * freq * 2 * t) * np.exp(-t / (tau * 0.5))
    return (car + pure) * env_ad(len(t), 0.004, tau)


def mix_at(buf, snd, at_sec, gain=1.0):
    i = int(at_sec * SR)
    j = min(len(buf), i + len(snd))
    if i < len(buf):
        buf[i:j] += snd[: j - i] * gain


def finish(x, peak=0.94, fade_out=0.02):
    x = np.asarray(x, dtype=float)
    n = int(fade_out * SR)
    if n:
        x[-n:] *= np.linspace(1, 0, n)
    x = x - np.mean(x)
    m = np.max(np.abs(x)) or 1.0
    return x / m * peak


def write_ogg(name, x):
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2')
    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, name + '.wav')
        with wave.open(wav, 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
        out = os.path.abspath(os.path.join(OUT, name + '.ogg'))
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-c:a', 'libvorbis', '-q:a', '4', out], check=True)
    print('geschrieben', os.path.relpath(out), '%.2f s' % (len(x) / SR))


# ── pull_circle: Kreis zeichnet sich (1,7 s) ──────────────────────────────────────────────
def pull_circle():
    sec = 1.7
    t = t_axis(sec)
    swell = np.clip(t / 1.2, 0, 1) ** 1.6 * np.clip((sec - t) / 0.35, 0, 1)
    f0 = 98 + 28 * (t / sec)                                  # Drohne steigt leicht
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.2 * t)
    drone = (sine(f0 * vib, sec) + 0.6 * sine(f0 * 1.5 * vib, sec, 1.1) + 0.35 * sine(f0 * 2.01 * vib, sec, 2.3)
             + 0.2 * sine(f0 * 3 * vib, sec, 0.4)) * swell
    air = biquad_bp(noise(sec), 350 + 2600 * (t / sec) ** 1.4, q=1.6) * swell * 0.55
    out = drone * 0.9 + air
    for at, f in ((0.35, 1318.5), (0.75, 1760.0), (1.15, 2093.0)):          # leise Glöckchen beim Zeichnen
        mix_at(out, bell(f, 0.8, tau=0.22) * 0.16, at)
    return finish(out, 0.9, 0.04)


# ── pull_crack: Glas-/Eisknacken (0,4 s) ──────────────────────────────────────────────────
def pull_crack():
    sec = 0.4
    n = int(sec * SR)
    t = t_axis(sec)
    out = highpass(noise(sec), 1800) * np.exp(-t / 0.028) * 1.0
    for f, tau, g in ((3100, 0.11, 0.55), (4400, 0.09, 0.45), (5900, 0.07, 0.35), (2300, 0.14, 0.4)):   # Glas-Resonanzen
        out += np.sin(2 * np.pi * f * t + RNG.uniform(0, 6.28)) * np.exp(-t / tau) * g
    out += np.sin(2 * np.pi * 95 * t) * np.exp(-t / 0.05) * 0.6                                         # kleiner Bums darunter
    for _ in range(9):                                                                                   # Knistern
        k = int(RNG.uniform(0.005, 0.16) * SR)
        out[k:k + 40] += RNG.standard_normal(min(40, n - k)) * 0.5 * np.exp(-np.arange(min(40, n - k)) / 9)
    return finish(out, 0.95, 0.03)


# ── pull_note: Glockenton C5 (0,9 s) — wird mit playbackRate hochgespielt ───────────────────
def pull_note():
    return finish(bell(523.25, 0.9, tau=0.4) + 0.4 * bell(523.25 * 2.005, 0.9, tau=0.25, index=1.0), 0.9, 0.05)


# ── pull_swell: Überladung (0,8 s), endet abrupt ──────────────────────────────────────────
def pull_swell():
    sec = 0.8
    t = t_axis(sec)
    p = t / sec
    f = 220 * (8 ** p)                                         # 220 → 1760 Hz
    tone = sine(f, sec) + 0.5 * sine(f * 2, sec, 0.7)
    trem = 0.55 + 0.45 * np.sin(2 * np.pi * (8 + 26 * p ** 1.5) * t)   # Zittern wird schneller
    rush = biquad_bp(noise(sec), 500 + 5500 * p ** 1.3, q=1.4)
    amp = (0.15 + 0.85 * p ** 1.8)
    out = (tone * trem * 0.8 + rush * 0.9) * amp
    n = int(0.012 * SR)
    out[-n:] *= np.linspace(1, 0, n)                           # harter Schnitt vor dem Einschlag
    return finish(out, 0.9, 0.0)


# ── pull_shatter: Karte zerspringt (1,4 s) ────────────────────────────────────────────────
def pull_shatter():
    sec = 1.4
    n = int(sec * SR)
    t = t_axis(sec)
    boom = sine(30 + 60 * np.exp(-t / 0.18), sec) * np.exp(-t / 0.32) * 1.0
    thud = lowpass(noise(sec), 900) * np.exp(-t / 0.12) * 1.1
    crash = highpass(noise(sec), 2800) * np.exp(-t / 0.22) * 0.55
    out = boom + thud + crash
    for _ in range(46):                                         # Splitterregen: vorne dicht, hinten dünn
        at = RNG.exponential(0.22)
        if at > 1.1:
            continue
        f = RNG.uniform(2000, 9500)
        tau = RNG.uniform(0.03, 0.14)
        s = np.sin(2 * np.pi * f * t_axis(0.4)) * np.exp(-t_axis(0.4) / tau) * RNG.uniform(0.1, 0.5)
        mix_at(out, s, at)
    return finish(out, 0.97, 0.06)


# ── pull_reveal: Enthüllung (2,3 s) ───────────────────────────────────────────────────────
def pull_reveal():
    sec = 2.3
    n = int(sec * SR)
    out = np.zeros(n)
    t = t_axis(sec)
    chord = (261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1174.66)   # C-Dur add9, offen
    for k, f in enumerate(chord):
        e = env_ad(n, 0.05 + 0.02 * k, 1.1)
        for det in (-1.6, 0.0, 1.6):                                   # Chor
            out += (np.sin(2 * np.pi * (f + det) * t) + 0.3 * np.sin(2 * np.pi * (f + det) * 2 * t)) * e * (0.22 if k < 4 else 0.13)
    out += sine(65.4, sec) * env_ad(n, 0.02, 0.9) * 0.9                  # Tiefes C
    out += biquad_bp(noise(sec), 3500, q=0.9) * env_ad(n, 0.15, 0.5) * 0.18   # Luft
    for k, f in enumerate((1046.5, 1318.5, 1568.0, 2093.0, 2637.0, 3136.0, 2093.0, 2637.0)):   # Funkeln
        mix_at(out, bell(f, 0.7, tau=0.25) * 0.28, 0.1 + 0.075 * k)
    return finish(out, 0.95, 0.12)


# ── pull_sparkle: Glockenarpeggio (1,0 s) ─────────────────────────────────────────────────
def pull_sparkle():
    sec = 1.0
    out = np.zeros(int(sec * SR))
    notes = (1046.5, 1318.5, 1568.0, 2093.0, 2637.0, 3136.0, 4186.0, 3136.0, 2637.0, 4186.0)
    for k, f in enumerate(notes):
        mix_at(out, bell(f, 0.6, tau=0.18, index=1.4), 0.04 * k, 0.5 + 0.05 * k)
    return finish(out, 0.9, 0.06)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for name, fn in (('pull_circle', pull_circle), ('pull_crack', pull_crack), ('pull_note', pull_note), ('pull_swell', pull_swell),
                     ('pull_shatter', pull_shatter), ('pull_reveal', pull_reveal), ('pull_sparkle', pull_sparkle)):
        write_ogg(name, fn())
