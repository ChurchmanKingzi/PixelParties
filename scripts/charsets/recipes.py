# -*- coding: utf-8 -*-
"""Wiederverwendbare Rezepte, mit denen Seiten-/Rückansichten aus dem Original-Sprite entstehen.

Das Profil-Gesicht folgt dem Aufbau der Referenz-Sheets: vorn eine fast senkrechte Kante (höchstens 1 px
Stufe, KEINE vorstehende Nase), das Auge sitzt 2 px hinter der Kante, dahinter Wange und Haar. Der Körper im
Profil ist nur etwa 7 px breit (die Vorderansicht hat 10-12): er entsteht aus den Original-Spalten ohne den
vorderen Mittelstreifen.

Die Vorlage ist in den Buchstaben von Tobis Palette geschrieben; `mapping` übersetzt sie in die Buchstaben
der jeweiligen Figur.
"""
from rig import G
from figure import sub, build

# 6 Zeilen, Blick nach rechts; die Vorderkante liegt in Spalte 13 (Kontur 'm'). Maße aus 32 Referenz-Profilen:
# Gesicht steht ~2 px vor dem Rumpf, der Hals sitzt mittig über dem Rumpf (hier Spalte 7-8), das Kinn ragt
# 2 px vor den Hals; nirgends ein schwarzer Pixel vor dem Kinn.
#  a b c d = Haar (Kontur, Basis, hell, Schatten) · f i n m = Haut (Schatten, Basis, hell, Kontur)
#  g h j k = Auge (oben hell/dunkel, unten weiß/Iris) · o p = Kragen (Kontur, dunkel)
PROFILE_TEMPLATE = G("""
..acabcdbcdbaa..
..abdbabbfghim..
...abdbbaijkim..
....abdbdniim...
.....abdmiim....
....opmiimp.....
""")


def profile_head(front, hair_rows, mapping, tmpl_rows=6, skip=()):
    """Haarkappe = erste `hair_rows` Zeilen des Originals, darunter die Vorlage (in Figur-Buchstaben).
    tmpl_rows=5 lässt die Hals-Zeile weg, wenn der Rumpf des Originals dort schon beginnt; skip=(3,) lässt die
    Lippen-Zeile weg (Figuren, deren Kinn direkt unter den Augen sitzt)."""
    rows = [r for i, r in enumerate(PROFILE_TEMPLATE[:tmpl_rows]) if i not in skip]
    tmpl = [''.join(mapping.get(c, c) if c != '.' else '.' for c in r) for r in rows]
    return sub(front, 0, len(front[0]), 0, hair_rows), tmpl


def narrow(front, y0, y1, cols):
    """Zeilen y0..y1-1 des Originals, aber nur die Spalten `cols` (in dieser Reihenfolge)."""
    return [''.join(r[c] for c in cols) for r in front[y0:y1]]


def side_body(front, hair_rows, mapping, torso_rows, torso_cols, torso_x=4, patches=(), shoes=None, extra=(),
              tmpl_rows=6, cap_patches=(), skip=(), head_dx=0):
    """Seitenansicht (rechts blickend, ohne nahen Arm) aus Original-Pixeln.

    head_dx     Kopf (Haarkappe + Gesicht) um so viele Spalten verschieben (Figuren mit anderer Körperachse)
    torso_rows  (y0, y1): Zeilen aus dem Original (y1 exklusiv), bleiben auf ihrer Höhe (ausgerichtet!)
    torso_cols  Quellspalten des Originals (schmal: ohne Mittelstreifen), werden ab torso_x gesetzt
    patches     Flicken (Raster, x, y) über dem Rumpf
    shoes       (Raster, x, y) Schuh im Profil, Spitze nach rechts
    """
    cap, tmpl = profile_head(front, hair_rows, mapping, tmpl_rows, skip)
    y0, y1 = torso_rows
    layers = [(cap, head_dx, 0), *cap_patches, (tmpl, head_dx, hair_rows), (narrow(front, y0, y1, torso_cols), torso_x, y0), *patches, *extra]
    if shoes:
        layers.append(shoes)
    return build(len(front[0]) + max(head_dx, 0), len(front), layers)
