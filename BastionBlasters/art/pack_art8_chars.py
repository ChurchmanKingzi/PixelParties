"""pack_art8 Figuren (blicken nach rechts). Gesichter schlicht: 1-2 px Augen, höchstens eine Mundlinie."""
from __future__ import annotations

from pack_art8_kit import *
from pack_art8_props import rune_scroll


# =========================================================================== BH-05 Zahnklempner


def dentist_gnome(f=0):
    """Zahnklempner: weißer Kittel, Mundschutz, Stirnspiegel, riesige Zange mit gezogenem Zahn (30 x 36), blickt nach rechts"""
    c = ShiftCanvas(32, 44, 0, 6)
    bob = [0, -1][f % 2]
    # Beine und Schuhe
    thick_line(c, 11, 28, 11, 34, 3.0, 'metal', lo=1, hi=3)
    thick_line(c, 17, 28, 17, 34, 3.0, 'metal', lo=2, hi=4)
    c.rect(8, 35, 13, 36, 'wood', 2)
    c.rect(15, 35, 21, 36, 'wood', 3)
    c.rect(8, 36, 21, 37, 'wood', 1)
    # Kittel (unten ausgestellt)
    poly(c, [(7, 20 + bob), (21, 20 + bob), (23, 33), (5, 33)], 'bone', lo=3, hi=5)
    round_rect(c, 7, 15 + bob, 21, 28, 'bone', lo=3, hi=5, radius=3)
    for y in (22, 25, 28):
        c.put_ramp(14, y + bob, 'gold', 4)
    for x in range(6, 23):
        c.put_ramp(x, 33, 'bone', 2)
    c.rect(9, 20 + bob, 11, 22 + bob, 'ice', 3)        # Brusttasche
    c.put_ramp(10, 19 + bob, 'teamA', 4)
    c.put_ramp(10, 18 + bob, 'teamA', 3)
    # linker Arm hängt, hält eine Tasche mit Bohrer
    thick_line(c, 7, 17 + bob, 4, 25, 3.0, 'bone', lo=2, hi=4)
    ellipse(c, 4, 26.5, 2.0, 2.0, 'skin', lo=2, hi=5)
    # rechter Arm hoch: Zange
    thick_line(c, 21, 17 + bob, 26, 14 + bob, 3.0, 'bone', lo=3, hi=5)
    ellipse(c, 27, 13 + bob, 2.0, 2.0, 'skin', lo=3, hi=5)
    thick_line(c, 26, 14 + bob, 24, 6 + bob, 2.0, 'wood', lo=2, hi=4)
    thick_line(c, 28, 14 + bob, 27, 6 + bob, 2.0, 'wood', lo=1, hi=3)
    # Zangenmaul mit Zahn
    c.rect(22, 3 + bob, 23, 6 + bob, 'metal', 4)
    c.rect(26, 3 + bob, 27, 6 + bob, 'metal', 3)
    poly(c, [(22, 3 + bob), (28, 3 + bob), (27, 0 + bob), (23, 0 + bob)], 'bone', lo=3, hi=5)
    c.put_ramp(23, 0 + bob, 'bone', 5)
    # Kopf: Mundschutz, ein Auge
    ellipse(c, 14.5, 9 + bob, 6.0, 5.4, 'skin', lo=2, hi=5)
    c.rect(12, 11 + bob, 20, 14 + bob, 'ice', 4)
    c.rect(12, 11 + bob, 20, 11 + bob, 'ice', 5)
    c.rect(12, 14 + bob, 19, 14 + bob, 'ice', 3)
    c.line(9, 9 + bob, 12, 11 + bob, 'ice', 3)
    c.rect(17, 8 + bob, 18, 9 + bob, 'coal', 1)
    c.put_ramp(17, 7 + bob, 'bone', 3)
    c.put_ramp(18, 7 + bob, 'bone', 3)
    # graue Haarbüschel
    for (x, y) in ((9, 5), (8, 6), (8, 7), (9, 8), (10, 4)):
        c.put_ramp(x, y + bob, 'bone', 4)
    # Stirnspiegel: Band + runde Scheibe mit Reflex
    for x in range(9, 20):
        c.put_ramp(x, 5 + bob, 'metal', 2)
    ellipse(c, 17, 3 + bob, 3.4, 3.4, 'metal', lo=2, hi=5)
    c.put_ramp(16, 2 + bob, 'bone', 5)
    c.put_ramp(17, 2 + bob, 'sky', 5)
    c.put_ramp(18, 4 + bob, 'sky', 4)
    c.outline()
    return c


def tooth_patient_chair():
    """Zahnarztstuhl mit grinsendem Patienten (breites Grinsen, ein Goldzahn), Vorderansicht (34 x 42)"""
    c = Canvas(36, 40)
    # Fuß und Säule
    round_rect(c, 10, 35, 25, 39, 'metal', lo=0, hi=3, radius=2)
    c.rect(16, 31, 20, 36, 'metal', 2)
    c.rect(16, 31, 16, 36, 'metal', 4)
    c.rect(20, 31, 20, 36, 'metal', 1)
    # Rücken- und Kopfstütze
    round_rect(c, 8, 8, 28, 29, 'teamA', lo=1, hi=4, radius=4)
    round_rect(c, 11, 0, 25, 9, 'teamA', lo=2, hi=5, radius=3)
    for y in range(11, 28, 4):
        for x in range(10, 27):
            c.put_ramp(x, y, 'teamA', 2)
    for y in range(2, 28):
        c.put_ramp(9, y, 'teamA', 5)
    # Sitz
    round_rect(c, 3, 26, 32, 33, 'teamA', lo=1, hi=4, radius=3)
    for x in range(4, 31):
        c.put_ramp(x, 26, 'teamA', 5 if x < 14 else 4)
    # Armlehnen
    c.rect(1, 20, 6, 22, 'metal', 4)
    c.rect(1, 20, 6, 20, 'metal', 5)
    c.rect(29, 20, 34, 22, 'metal', 3)
    c.rect(2, 22, 3, 30, 'metal', 2)
    c.rect(31, 22, 32, 30, 'metal', 1)
    # Patient: Latz, Arme, Beine
    thick_line(c, 12, 30, 11, 35, 3.6, 'dirt', lo=1, hi=3)
    thick_line(c, 23, 30, 24, 35, 3.6, 'dirt', lo=2, hi=4)
    c.rect(8, 35, 14, 36, 'wood', 2)
    c.rect(21, 35, 27, 36, 'wood', 3)
    round_rect(c, 11, 17, 24, 30, 'ice', lo=3, hi=5, radius=3)
    for k in range(4):
        c.put_ramp(14 + k * 2, 19, 'ice', 2)
    c.put_ramp(17, 18, 'gold', 5)
    c.put_ramp(18, 18, 'gold', 4)
    for (x, y) in ((16, 20), (15, 21), (14, 22), (19, 20), (20, 21), (21, 22)):
        c.put_ramp(x, y, 'gold', 3)
    thick_line(c, 10, 19, 6, 22, 3.0, 'goblin', lo=1, hi=4)
    thick_line(c, 25, 19, 29, 22, 3.0, 'goblin', lo=2, hi=5)
    ellipse(c, 5.5, 22.5, 2.2, 2.0, 'goblin', lo=2, hi=5)
    ellipse(c, 29.5, 22.5, 2.2, 2.0, 'goblin', lo=2, hi=5)
    # Kopf (Vorderansicht), spitze Ohren
    poly(c, [(9, 9), (3, 3), (2, 5), (4, 11), (10, 13)], 'goblin', lo=1, hi=4)
    poly(c, [(26, 9), (32, 3), (33, 5), (31, 11), (25, 13)], 'goblin', lo=2, hi=5)
    c.put_ramp(4, 6, 'skin', 3)
    c.put_ramp(31, 6, 'skin', 3)
    ellipse(c, 17.5, 10, 8.2, 7.0, 'goblin', lo=2, hi=5, ambient=0.2)
    # Augen: schmal und vergnügt
    c.rect(12, 6, 14, 7, 'coal', 1)
    c.rect(21, 6, 23, 7, 'coal', 1)
    c.put_ramp(12, 5, 'goblin', 1)
    c.put_ramp(23, 5, 'goblin', 1)
    # breites Grinsen: Lippenlinie + Zahnreihe + Goldzahn
    for x in range(11, 25):
        c.put_ramp(x, 10, 'coal', 1)
    for x in range(12, 24):
        c.put_ramp(x, 11, 'bone', 5)
        c.put_ramp(x, 12, 'bone', 4)
    for x in range(13, 24, 3):
        c.put_ramp(x, 11, 'bone', 3)
    c.rect(19, 11, 20, 12, 'gold', 5)
    c.put_ramp(19, 11, 'bone', 5)
    c.put_ramp(20, 12, 'gold', 4)
    for x in range(12, 24):
        c.put_ramp(x, 13, 'coal', 1)
    c.put_ramp(10, 9, 'coal', 1)
    c.put_ramp(25, 9, 'coal', 1)
    c.outline()
    return c


def patient_waiting(f=0):
    """wartender Patient mit Zahnschmerz-Verband (um Kinn und Kopf, Schleife oben) (20 x 26), blickt nach rechts"""
    c = ShiftCanvas(20, 28, 0, 4)
    bob = [0, -1][f % 2]
    thick_line(c, 7, 19 + bob, 7, 23, 2.4, 'wood', lo=1, hi=3)
    thick_line(c, 12, 19 + bob, 12, 23, 2.4, 'wood', lo=2, hi=4)
    round_rect(c, 4, 13 + bob, 15, 20 + bob, 'ice', lo=1, hi=4, radius=2)
    c.rect(4, 17 + bob, 15, 17 + bob, 'gold', 2)
    thick_line(c, 4, 14 + bob, 3, 19 + bob, 2.0, 'skin', lo=2, hi=4)
    # Kopf mit dicker Backe
    ellipse(c, 10, 8 + bob, 6.0, 5.4, 'skin', lo=2, hi=5)
    ellipse(c, 13, 11 + bob, 3.6, 3.2, 'skin', lo=3, hi=5)
    c.put_ramp(13, 10 + bob, 'fire', 4)
    c.put_ramp(14, 11 + bob, 'fire', 3)
    # Verband: gebogenes Band von Kinn über den Scheitel, Knoten mit zwei Schlaufen
    thick_line(c, 11, 15 + bob, 8, 3 + bob, 3.0, 'bone', lo=3, hi=5)
    for y in range(4, 15):
        c.put_ramp(8 + (y - 4) // 4 + (0 if y < 9 else 1), y + bob, 'bone', 5)
    ellipse(c, 5.5, 2 + bob, 2.6, 2.2, 'bone', lo=3, hi=5)
    ellipse(c, 11.5, 0.5 + bob, 2.6, 2.2, 'bone', lo=2, hi=4)
    c.put_ramp(8, 3 + bob, 'bone', 2)
    c.put_ramp(9, 2 + bob, 'bone', 2)
    c.put_ramp(7, 0 + bob, 'bone', 5)
    c.put_ramp(3, 4 + bob, 'bone', 3)
    # Gesicht: zusammengekniffenes Auge, Schmerzbrauen, Tränchen, Mundlinie
    c.rect(13, 7 + bob, 14, 7 + bob, 'coal', 1)
    c.put_ramp(12, 5 + bob, 'coal', 2)
    c.put_ramp(13, 6 + bob, 'coal', 2)
    c.put_ramp(15, 8 + bob, 'ice', 5)
    c.put_ramp(15, 9 + bob, 'ice', 4)
    c.put_ramp(14, 13 + bob, 'coal', 1)
    c.put_ramp(15, 13 + bob, 'coal', 1)
    c.outline()
    return c


# =========================================================================== Kriegswerk-Figuren


def powder_gnome(f=0):
    """Pulver-Gnom: rußiges Gesicht, abstehendes Brandhaar, Schutzbrille auf der Stirn, Lederschürze, rauchende Pfeife (30 x 36)"""
    c = ShiftCanvas(32, 44, 2, 8)
    bob = [0, -1][f % 2]
    # Beine, Stiefel
    thick_line(c, 11, 27, 11, 32, 3.0, 'wood', lo=1, hi=3)
    thick_line(c, 17, 27, 17, 32, 3.0, 'wood', lo=2, hi=4)
    c.rect(8, 33, 13, 34, 'coal', 2)
    c.rect(15, 33, 20, 34, 'coal', 3)
    c.rect(8, 34, 20, 34, 'coal', 1)
    # Körper: Hemd + Schürze
    round_rect(c, 7, 15 + bob, 21, 28, 'cloth', lo=1, hi=4, radius=3)
    round_rect(c, 9, 17 + bob, 19, 29, 'wood', lo=2, hi=4, radius=2)
    for (x, y) in ((11, 25), (15, 22), (17, 27), (12, 20)):
        c.put_ramp(x, y, 'coal', 1)
    c.rect(8, 22 + bob, 20, 22 + bob, 'gold', 2)
    # Arm links: Hand auf der Hüfte
    thick_line(c, 7, 17 + bob, 4, 22, 2.6, 'skin', lo=1, hi=4)
    thick_line(c, 4, 22, 8, 24, 2.6, 'skin', lo=2, hi=4)
    # Arm rechts: Pfeife im Mundwinkel, Hand am Kopf
    thick_line(c, 21, 17 + bob, 24, 15 + bob, 2.6, 'skin', lo=3, hi=5)
    ellipse(c, 24.5, 14 + bob, 2.0, 2.0, 'skin', lo=3, hi=5)
    # Kopf (russig) mit Bart
    ellipse(c, 14.5, 9 + bob, 6.0, 5.4, 'skin', lo=2, hi=5)
    for (x, y) in ((10, 8), (11, 12), (12, 7), (17, 6), (18, 12), (9, 10), (16, 13)):
        c.put_ramp(x, y + bob, 'coal', 2)
    ellipse(c, 14.5, 13 + bob, 4.0, 2.2, 'bone', lo=3, hi=5, clip=lambda x, y: y >= 13 + bob)
    c.rect(18, 8 + bob, 19, 9 + bob, 'coal', 1)
    ellipse(c, 21, 10 + bob, 1.8, 1.6, 'skin', lo=3, hi=5)
    # Pfeife: Stiel + Kopf mit Glut
    c.rect(19, 12 + bob, 23, 12 + bob, 'wood', 2)
    c.rect(23, 9 + bob, 26, 12 + bob, 'wood', 1)
    c.rect(23, 9 + bob, 26, 9 + bob, 'coal', 0)
    c.put_ramp(24, 9 + bob, 'fire', 5)
    c.put_ramp(25, 9 + bob, 'gold', 5)
    # Brandhaar: abstehende rußschwarze Stacheln mit Glut
    for (pts, tip) in (([(8, 6), (5, 0), (11, 4)], (5, 0)), ([(10, 4), (9, -4), (14, 3)], (9, -4)), ([(13, 3), (15, -6), (18, 3)], (15, -6)),
                       ([(16, 4), (21, -3), (20, 6)], (21, -3)), ([(19, 6), (25, 1), (21, 8)], (25, 1))):
        poly(c, [(x, y + bob) for x, y in pts], 'coal', lo=1, hi=3)
        c.put_ramp(tip[0], tip[1] + bob, 'fire', 4)
    # Schutzbrille auf der Stirn
    for (gx) in (11, 16):
        ellipse(c, gx, 5.5 + bob, 2.3, 2.1, 'metal', lo=2, hi=5)
        c.put_ramp(gx, 5 + bob, 'sky', 4)
    c.rect(9, 5 + bob, 20, 5 + bob, 'wood', 1)
    c.outline()
    return c


def fireworks_worker(f=0):
    """Feuerwerker: Partyhut mit Streifen, Wunderkerze in der Hand, Rakete unterm Arm, Funken am Kittel (34 x 38)"""
    c = ShiftCanvas(36, 48, 4, 10)
    bob = [0, -1][f % 2]
    # Beine, Stiefel
    thick_line(c, 12, 28, 12, 33, 3.0, 'cloth', lo=1, hi=3)
    thick_line(c, 18, 28, 18, 33, 3.0, 'cloth', lo=2, hi=4)
    c.rect(9, 34, 14, 35, 'wood', 2)
    c.rect(16, 34, 21, 35, 'wood', 3)
    c.rect(9, 35, 21, 35, 'wood', 1)
    # Rakete unterm rechten Arm (schräg nach oben rechts)
    thick_line(c, 18, 30, 31, 12, 3.4, 'fire', lo=1, hi=4)
    thick_line(c, 23, 24, 25, 21, 3.6, 'bone', lo=3, hi=5)
    poly(c, [(29, 12), (34, 15), (33, 6)], 'bone', lo=3, hi=5)
    c.put_ramp(33, 7, 'fire', 4)
    thick_line(c, 18, 30, 12, 38, 1.2, 'wood', lo=2, hi=3)
    # Körper: violetter Kittel mit Goldsternen
    round_rect(c, 8, 16 + bob, 22, 29, 'purple', lo=1, hi=4, radius=3)
    for (x, y) in ((11, 20), (16, 24), (19, 19), (12, 27), (20, 26)):
        c.put_ramp(x, y + bob, 'gold', 5)
        c.put_ramp(x, y + 1 + bob, 'gold', 3)
    c.rect(8, 25 + bob, 22, 25 + bob, 'gold', 2)
    # Arm links hoch: Wunderkerze
    thick_line(c, 8, 18 + bob, 3, 14 + bob, 2.6, 'purple', lo=1, hi=4)
    ellipse(c, 3, 13 + bob, 2.0, 2.0, 'skin', lo=2, hi=5)
    c.line(3, 12 + bob, 2, 3 + bob, 'metal', 4)
    for k in range(14):
        a = k * math.pi / 7.0
        r = 3 + (k % 2) * 2
        c.put_ramp(2 + int(round(math.cos(a) * r)), 2 + bob + int(round(math.sin(a) * r)), 'gold' if k % 3 else 'bone', 5)
    c.put_ramp(2, 2 + bob, 'bone', 5)
    # Arm rechts hält Rakete
    thick_line(c, 22, 19 + bob, 25, 25, 2.6, 'purple', lo=2, hi=5)
    ellipse(c, 25.5, 26, 2.0, 2.0, 'skin', lo=3, hi=5)
    # Kopf, rußiger Fleck, Grinsen
    ellipse(c, 15.5, 11 + bob, 5.8, 5.2, 'skin', lo=2, hi=5)
    c.rect(19, 10 + bob, 20, 11 + bob, 'coal', 1)
    c.rect(17, 14 + bob, 21, 14 + bob, 'coal', 1)
    c.put_ramp(21, 13 + bob, 'coal', 1)
    c.put_ramp(11, 13 + bob, 'coal', 2)
    c.put_ramp(12, 12 + bob, 'coal', 2)
    c.put_ramp(14, 14 + bob, 'skin', 3)
    # Partyhut: Kegel mit Streifen, Bommel
    poly(c, [(9, 7 + bob), (22, 7 + bob), (15.5, -8 + bob)], 'ice', lo=2, hi=5)
    for k in range(5):
        y = 5 - k * 3 + bob
        hw = (y - (-8 + bob)) * 0.5
        for x in range(int(15.5 - hw), int(15.5 + hw) + 1):
            if c.alpha(x, y) and k % 2 == 0:
                c.put_ramp(x, y, 'fire', 4 if x < 15 else 3)
    ellipse(c, 15.5, -9 + bob, 2.4, 2.4, 'gold', lo=3, hi=5)
    c.rect(9, 7 + bob, 22, 8 + bob, 'gold', 3)
    c.outline()
    return c


def foundry_worker(f=0):
    """Gießer: Lederkappe mit Schutzbrille, rote Zottelbart, dicke Arme, riesige Gießkelle mit flüssigem Metall (36 x 38)"""
    c = ShiftCanvas(40, 44, 2, 8)
    bob = [0, -1][f % 2]
    thick_line(c, 12, 27, 12, 33, 3.4, 'metal', lo=0, hi=3)
    thick_line(c, 19, 27, 19, 33, 3.4, 'metal', lo=1, hi=4)
    c.rect(9, 34, 15, 35, 'coal', 2)
    c.rect(17, 34, 23, 35, 'coal', 3)
    c.rect(9, 35, 23, 35, 'coal', 1)
    # Körper + Lederschürze
    round_rect(c, 8, 16 + bob, 23, 29, 'dirt', lo=1, hi=4, radius=3)
    round_rect(c, 10, 18 + bob, 21, 30, 'wood', lo=1, hi=4, radius=2)
    for (x, y) in ((13, 22), (17, 26), (19, 21)):
        c.put_ramp(x, y, 'coal', 1)
    c.rect(9, 23 + bob, 22, 23 + bob, 'metal', 2)
    c.put_ramp(15, 23 + bob, 'gold', 5)
    # Kelle: langer Stiel, Schöpfer mit Glut
    thick_line(c, 12, 26, 28, 14, 2.4, 'wood', lo=1, hi=4)
    ellipse(c, 31, 12 + bob, 5.0, 4.0, 'metal', lo=0, hi=4)
    ellipse(c, 31, 10.8 + bob, 4.0, 2.2, 'fire', lo=3, hi=5, ambient=0.7)
    c.put_ramp(30, 10 + bob, 'gold', 5)
    c.put_ramp(32, 11 + bob, 'gold', 5)
    c.put_ramp(35, 9 + bob, 'gold', 5)
    c.put_ramp(36, 7 + bob, 'fire', 4)
    # Arme (dick)
    thick_line(c, 9, 18 + bob, 7, 24, 3.6, 'skin', lo=1, hi=4)
    thick_line(c, 22, 18 + bob, 20, 26, 3.6, 'skin', lo=3, hi=5)
    ellipse(c, 12, 25.5, 2.4, 2.4, 'skin', lo=2, hi=5)
    ellipse(c, 21, 26.5, 2.4, 2.4, 'skin', lo=3, hi=5)
    # Kopf, Bart
    ellipse(c, 15.5, 10 + bob, 6.2, 5.4, 'skin', lo=2, hi=5)
    poly(c, [(9, 12 + bob), (22, 12 + bob), (20, 21 + bob), (15, 25 + bob), (11, 21 + bob)], 'fire', lo=1, hi=4)
    for (x, y) in ((12, 16), (15, 19), (18, 16), (14, 22)):
        c.put_ramp(x, y + bob, 'fire', 2)
    c.put_ramp(20, 12 + bob, 'skin', 4)
    c.rect(19, 9 + bob, 20, 10 + bob, 'coal', 1)
    ellipse(c, 21.5, 11 + bob, 1.8, 1.6, 'skin', lo=3, hi=5)
    c.put_ramp(21, 11 + bob, 'fire', 4)
    # Lederkappe + Schutzbrille
    ellipse(c, 15.5, 6.5 + bob, 7.0, 4.4, 'wood', lo=1, hi=4, clip=lambda x, y: y <= 8 + bob)
    c.rect(9, 8 + bob, 22, 8 + bob, 'wood', 1)
    for gx in (13, 18):
        ellipse(c, gx, 6 + bob, 2.4, 2.2, 'metal', lo=2, hi=5)
        c.put_ramp(gx, 5 + bob, 'sky', 5)
    c.outline()
    return c


def rune_apprentice(f=0):
    """Runen-Lehrling: schiefer Spitzhut mit Stern, violette Robe, tintenfleckige Nase, hält einen frisch gedruckten leuchtenden Zettel hoch (34 x 40)"""
    c = ShiftCanvas(34, 50, 2, 10)
    bob = [0, -1][f % 2]
    # Robe (ausgestellt)
    poly(c, [(8, 18 + bob), (21, 18 + bob), (25, 34), (4, 34)], 'purple', lo=1, hi=4)
    round_rect(c, 8, 15 + bob, 21, 27, 'purple', lo=1, hi=4, radius=3)
    for x in range(4, 26):
        c.put_ramp(x, 34, 'purple', 0)
        if x % 3 == 0:
            c.put_ramp(x, 33, 'purple', 1)
    c.rect(8, 23 + bob, 21, 24 + bob, 'gold', 3)
    c.put_ramp(14, 23 + bob, 'gold', 5)
    for (x, y) in ((11, 28), (16, 30), (20, 29), (9, 31)):
        c.put_ramp(x, y, 'purple', 3)
    # Füße
    c.rect(9, 35, 13, 36, 'wood', 2)
    c.rect(16, 35, 20, 36, 'wood', 3)
    # linker Arm: Tintenfinger auf der Hüfte
    thick_line(c, 8, 17 + bob, 5, 22, 2.6, 'purple', lo=1, hi=3)
    ellipse(c, 5, 23.5, 1.8, 1.8, 'skin', lo=2, hi=4)
    c.put_ramp(5, 24, 'coal', 2)
    # rechter Arm hoch: Zettel
    thick_line(c, 21, 17 + bob, 28, 11 + bob, 2.8, 'purple', lo=2, hi=5)
    ellipse(c, 28.5, 10 + bob, 2.0, 2.0, 'skin', lo=3, hi=5)
    sc = rune_scroll(2)
    c.blit(sc, 25 + c.dx - 0, 0 - 4 + bob + c.dy - 0) if False else None
    # Kopf
    ellipse(c, 14.5, 11 + bob, 5.6, 5.0, 'skin', lo=2, hi=5)
    c.rect(18, 10 + bob, 19, 11 + bob, 'coal', 1)
    c.put_ramp(20, 13 + bob, 'coal', 3)             # Tintenfleck auf der Nase
    c.put_ramp(21, 13 + bob, 'coal', 2)
    for x in range(16, 20):
        c.put_ramp(x, 15 + bob, 'coal', 2)
    c.put_ramp(20, 14 + bob, 'coal', 2)
    # Spitzhut (schief) mit Goldband und Stern
    ellipse(c, 14.5, 7 + bob, 9.4, 2.4, 'purple', lo=1, hi=4)
    poly(c, [(8, 7 + bob), (21, 7 + bob), (19, 0 + bob), (24, -6 + bob), (16, -7 + bob), (12, 0 + bob)], 'purple', lo=1, hi=4)
    c.rect(8, 6 + bob, 21, 7 + bob, 'gold', 2)
    c.put_ramp(14, 6 + bob, 'gold', 5)
    c.put_ramp(15, 6 + bob, 'gold', 4)
    c.put_ramp(16, 0 + bob, 'gold', 5)
    c.put_ramp(15, 1 + bob, 'gold', 5)
    c.put_ramp(17, 1 + bob, 'gold', 5)
    c.put_ramp(16, 2 + bob, 'gold', 5)
    c.outline()
    # Zettel nach dem Outline über die Hand (Fläche 14x16)
    out = Canvas(c.w + 6, c.h)
    out.blit(c, 0, 0)
    sc = rune_scroll(2)
    out.blit(sc, 27, 0 + bob + 0)
    return out
