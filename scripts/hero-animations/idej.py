# -*- coding: utf-8 -*-
"""Idle-Animation für Idej Lord Daiyo (MotiveSteamDwarfs.xcf: Geist „Ebene #28“
+ Schwert „Ebene #22“).

Teile: src/idej-lord-daiyo-{ghost,sword}.png (deckungsgleich).
* Er hält das Schwert in der linken Hand: der Griff sitzt in der Hand am Ende
  des Ärmels (der Ärmel liegt darüber), die Klinge zeigt schräg nach unten.
  Er schwingt es zweimal pro Loop langsam vor und zurück; der Schwertarm
  hebt sich dabei mit.
* Der Geist schwebt (sanftes Auf und Ab) und leuchtet: ein halbtransparenter
  grüner Schein liegt 1 px um seine Silhouette und pulsiert.
* Sein Körper lebt: die Helmzier wippt nach, der Saum unten wogt, die Augen
  glühen auf, der Oberkörper atmet (hebt sich im Rhythmus um 1 px).
* Er blinzelt zweimal pro Loop (die weißen Augen schließen sich zu grünen
  Lidern mit dunkler Linie).
* Als Projektion ist er halb durchsichtig und flackert wie die übrigen Idej-Heroes
  (hologram.py: wandernde Abtastzeile, kurz blasser, ein Zeilenstreifen springt zur Seite).
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs, ring8
from flap_common import rotate_part, over, fill_pinholes
from hologram import projection

GHOST = np.array(Image.open('src/idej-lord-daiyo-ghost.png').convert('RGBA')).astype(int)
SWORD = np.array(Image.open('src/idej-lord-daiyo-sword.png').convert('RGBA')).astype(int)
SH, SW = GHOST.shape[:2]
P, PT, PB = 9, 4, 10
H, W = SH + PT + PB, SW + 2 * P
N = 48
GRIP = (3.5, 11.5)                                   # Griff im Schwert-Bild
HAND = (6.5, 17.5)                                   # Hand am Ende des linken Ärmels
GLOW = (96, 255, 120)
EYE = rgb('ffffff')
EYE_GLOW = [rgb('ffffff'), rgb('e8ffd8'), rgb('b8ffa0'), rgb('e8ffd8')]
ARM = {(x, y) for y in range(14, 21) for x in range(3, 10) if GHOST[y, x, 3]}   # Schwertarm
HEM_Y = 21                                           # Saum
BLINK = {14: 'halb', 15: 'zu', 16: 'zu', 17: 'halb', 38: 'halb', 39: 'zu', 40: 'zu', 41: 'halb'}
EYE_TOP, EYE_BOT = 9, 10
LID, LID_LINE = rgb('82f94f'), rgb('00f921')
FLICKER = {9: 0.5, 10: 0.8, 31: 0.55}                # Projektion: kurz blasser …
GLITCH = {9: 12, 31: 20}                             # … und ein Zeilenstreifen springt zur Seite


def bob(i):
    return int(round(math.sin(2 * math.pi * i / 16)))


def sword_pose(i):
    """(Winkel, Hub des Arms): zweimal pro Loop vor und zurück."""
    s = math.sin(2 * math.pi * i / 24)
    return 0.2 + 0.15 * s, -1 if s > 0.5 else 0


def breath(i):
    return -1 if (i % 16) in range(3, 9) else 0


def ghost_offset(x, y, i, lift):
    """(dx, dy) eines Geist-Pixels."""
    if (x, y) in ARM:
        return 0, breath(i) + lift
    if y <= 2:                                       # Helmzier wippt nach
        s = math.sin(2 * math.pi * i / 16 - 1.5)
        return (1 if s > 0.6 else (-1 if s < -0.6 else 0)), breath(i)
    if y >= HEM_Y:                                   # Saum wogt
        return int(round(math.sin(2 * math.pi * i / 12 - (y - HEM_Y) * 0.8))), 0
    return 0, breath(i)


def frame(i):
    out = np.zeros((H, W, 4), int)
    oy = PT + bob(i)
    ang, lift = sword_pose(i)
    glow = EYE_GLOW[(i // 3) % 4]
    ghost = np.zeros((H, W, 4), int)
    for y in range(SH):
        for x in range(SW):
            if GHOST[y, x, 3]:
                dx, dy = ghost_offset(x, y, i, lift)
                c = GHOST[y, x]
                if tuple(c[:3]) == EYE[:3]:              # Augen (halbtransparent wie der Geist)
                    st = BLINK.get(i)
                    col = glow
                    if st == 'halb':
                        col = LID_LINE if y == EYE_TOP else glow
                    elif st == 'zu':
                        col = LID if y == EYE_TOP else LID_LINE
                    c = np.array([*col[:3], max(c[3], 200)])
                ghost[y + oy + dy, x + P + dx] = c
    if breath(i):                                    # Zeile über dem Saum dehnen
        for x in range(SW):
            if GHOST[HEM_Y - 1, x, 3] and not ghost[HEM_Y - 1 + oy, x + P, 3]:
                ghost[HEM_Y - 1 + oy, x + P] = GHOST[HEM_Y - 1, x]
    fill_pinholes(ghost)
    a = int(70 + 60 * (0.5 + 0.5 * math.sin(2 * math.pi * i / 16)))
    for y, x in zip(*np.nonzero(ring8(ghost[:, :, 3] > 0))):   # Schein um den Geist
        out[y, x] = (*GLOW, a)
    # Schwert: Griff in die Hand setzen, um den Griff schwingen
    off = (P + HAND[0] - GRIP[0], oy + breath(i) + lift + HAND[1] - GRIP[1])
    sword = rotate_part(SWORD, SWORD[:, :, 3] > 0, GRIP, ang, (H, W), (int(off[0]), int(off[1])))
    over(out, sword)
    g = ghost[:, :, 3] > 0                           # Ärmel/Hand liegt über dem Griff
    out[g] = ghost[g]
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [projection(frame(i), i, FLICKER, GLITCH, PT) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'idej_idle_{tag}', frames, ms, scale=8, check_edges=True)
