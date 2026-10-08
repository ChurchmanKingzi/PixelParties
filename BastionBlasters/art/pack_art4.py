"""Pack art4 - Verteidiger UV-02 .. UV-11: Kauz-Gargoyle, Schleimschnecke, Schildkroeten-Zwerge, Tuersteher-Troll, Ton-Golem,
Wurzel-Ent, Leere Ruestung, Dreikoepfiger Pudel, Gletscher-Greis, Salamander-Waechter.
Sprites: pack_art4_a.py (UV-02..06), pack_art4_b.py (UV-07..11); Kulissen/Effekte: pack_art4_kit.py."""
from __future__ import annotations

from cards_art import *

from pack_art4_a import spr_owl_gargoyle, spr_slime_snail, spr_turtle_dwarves, spr_bouncer_troll, spr_clay_golem
from pack_art4_b import (spr_root_ent, spr_empty_armor, spr_three_headed_poodle, spr_glacier_elder,
                         spr_salamander_warden)
from pack_art4_kit import *


# --------------------------------------------------------------------------- UV-02 Owl Gargoyle: Statue im Torhof erwacht


@card_art('UV-02')
def _art_uv02():
    w = ground_world('grass', 3)
    gate = a4_gate(span=24, wall_l=26, wall_r=26, crest_spr=crest('teamA'))
    shadow(w, 74, 50, 52, 4)
    w.draw(gate, 72 - gate.w // 2, 46 - gate.h + 1, 46)
    for (sp, x, y) in ((bush(1, True), 14, 86), (bush(2), 134, 62)):
        prop_at(w, sp, x, y)
    unit_at(w, spr_owl_gargoyle('awake'), 62, 84, sh=(15, 4))
    # Feind schleicht heran; die Brillenglaeser des Kauzes funkeln
    unit_at(w, goblin('walk', 1), 114, 86, flip=True)
    spark(w, 53, 52, 'gold')
    spark(w, 71, 52, 'gold')
    return finish(w)


# --------------------------------------------------------------------------- UV-03 Slime Snail: Schleimspur bremst den Feind


@card_art('UV-03')
def _art_uv03():
    w = ground_world('cobble', 5)
    a4_slime_trail(w, [(-6, 80), (14, 76), (34, 79), (52, 75), (66, 74)], width=9, seed=3)
    for (sp, x, y) in ((barrel(), 16, 38), (crate(), 128, 38), (plant(), 56, 36), (plant(), 98, 38), (rack(), 128, 66)):
        prop_at(w, sp, x, y)
    unit_at(w, skeleton('walk', 1), 28, 82, sh=(8, 3))
    unit_at(w, spr_slime_snail(), 88, 84, sh=(22, 4))
    # Schleimtropfen am Fuss des Skeletts
    for (x, y) in ((22, 83), (33, 84), (26, 86)):
        a4_over_put(w, x, y, 'slime', 4, 9000)
        a4_over_put(w, x + 1, y, 'slime', 5, 9000)
    return finish(w)


# --------------------------------------------------------------------------- UV-04 Turtle Dwarves: Panzerkuppel gegen Splash


@card_art('UV-04')
def _art_uv04():
    w = ground_world('slab', 2)
    prop_at(w, core(ring_team='teamA'), 122, 56)
    zielschatten(w, 56, 78, 28, 1)
    unit_at(w, spr_turtle_dwarves(), 58, 86, sh=(28, 4))
    # Felsbrocken faellt auf die Gruppe, Schweif aus Punkten
    for k in range(1, 8):
        tx, ty = 96 - k * 5, 6 + k * 2
        dot = Canvas(3, 3)
        dot.put_ramp(1, 1, 'bone' if k > 3 else 'fire', 5)
        dot.put_ramp(0, 1, 'bone', 4)
        dot.put_ramp(2, 1, 'bone', 4)
        dot.put_ramp(1, 0, 'bone', 4)
        dot.put_ramp(1, 2, 'bone', 4)
        w.draw(dot, tx - 1, ty - 1, 9000 - k)
    st = a4_boulder()
    w.draw(st, 56 - st.w // 2, 26 - st.h // 2, 9000)
    spark(w, 40, 16, 'fire')
    return finish(w)


# --------------------------------------------------------------------------- UV-05 Bouncer Troll: Tor, Samtseil, Warteschlange


@card_art('UV-05')
def _art_uv05():
    w = ground_world('cobble', 7)
    gate = a4_gate(span=26, wall_l=24, wall_r=24, crest_spr=crest('teamA'))
    shadow(w, 72, 46, 54, 4)
    w.draw(gate, 72 - gate.w // 2, 42 - gate.h + 1, 42)
    p = a4_rope_post()
    prop_at(w, p, 32, 80)
    prop_at(w, p, 112, 80)
    unit_at(w, spr_bouncer_troll(), 72, 74, sh=(18, 4))
    a4_rope(w, 33, 62, 111, 62, sag=10)
    unit_at(w, goblin('walk', 2), 104, 90, flip=True, sh=(8, 3))
    unit_at(w, skeleton('idle', 1), 40, 90, sh=(8, 3))
    return finish(w)


# --------------------------------------------------------------------------- UV-06 Clay Golem: Toepferei, Geroell formt sich neu


@card_art('UV-06')
def _art_uv06():
    w = ground_world('slab', 4)
    prop_at(w, a4_wheel(), 24, 52)
    prop_at(w, a4_amphora(), 12, 88)
    prop_at(w, a4_pot(), 124, 44)
    prop_at(w, a4_amphora(2), 134, 50)
    prop_at(w, a4_shards(), 116, 88)
    unit_at(w, spr_clay_golem(), 66, 84, sh=(22, 4))
    # Scherben fliegen zusammen, Restglut
    for (x, y, sd) in ((104, 66, 1), (114, 58, 2), (124, 64, 3), (110, 74, 4)):
        w.draw(a4_shard(sd), x, y, 9000)
    for (x, y) in ((100, 72), (120, 56), (128, 72)):
        spark(w, x, y, 'fire')
    return finish(w)


# --------------------------------------------------------------------------- UV-07 Root Ent: Wurzelgriff haelt den Feind


@card_art('UV-07')
def _art_uv07():
    w = ground_world('grass', 6)
    for (sp, x, y) in ((bush(2, True), 14, 40), (rock(1), 130, 42), (bush(3), 16, 90)):
        prop_at(w, sp, x, y)
    unit_at(w, spr_root_ent(), 56, 86, sh=(22, 4))
    # Skelett steckt im Wurzelgriff
    w.draw(a4_root_grip(False), 106 - 19, 84 - 33, 80)
    unit_at(w, skeleton('attack', 1), 106, 82, flip=True, sh=(8, 3))
    w.draw(a4_root_grip(True), 106 - 19, 86 - 33, 88)
    return finish(w)


# --------------------------------------------------------------------------- UV-08 Empty Armor: Klirren, Furcht, Haufen


@card_art('UV-08')
def _art_uv08():
    w = ground_world('dark', 4)
    wall = stone_wall_piece(144, 22)
    shadow(w, 72, 36, 72, 3)
    w.draw(wall, 0, 34 - wall.h + 1, 34)
    for cx in (34, 110):
        c_ = crest('teamA')
        w.draw(c_, cx - 6, 8, 36)
    prop_at(w, a4_armor_heap(), 22, 86)
    unit_at(w, spr_empty_armor(), 66, 86, sh=(20, 4))
    a4_shock_arc(w, 66, 34, 20, 0)
    a4_shock_arc(w, 66, 34, 30, 1)
    unit_at(w, goblin('walk', 0), 122, 80, sh=(8, 3))
    a4_sweat(w, 112, 56)
    a4_sweat(w, 132, 58)
    return finish(w)


# --------------------------------------------------------------------------- UV-09 Three-Headed Poodle: Bellen, Leine, Furcht


@card_art('UV-09')
def _art_uv09():
    w = ground_world('grass', 3)
    for (sp, x, y) in ((bush(3, True), 14, 38), (tree_pine(1), 132, 56)):
        prop_at(w, sp, x, y)
    prop_at(w, a4_stake(), 118, 56)
    prop_at(w, a4_bowl(), 22, 88)
    unit_at(w, spr_three_headed_poodle(), 62, 84, sh=(26, 4))
    a4_leash(w, 76, 60, 118, 46, sag=8)
    a4_bark(w, 79, 42, 3)
    # Feind flieht
    unit_at(w, goblin('walk', 2), 118, 90, sh=(8, 3))
    a4_sweat(w, 128, 72)
    return finish(w)


# --------------------------------------------------------------------------- UV-10 Glacier Elder: Kaelteaura


@card_art('UV-10')
def _art_uv10():
    w = ground_world('slab', 5)
    prop_at(w, core(ring_team='teamA'), 20, 54)
    a4_frost_ring(w, 76, 80, 54, seed=3)
    prop_at(w, a4_ice_cluster(1), 120, 46)
    prop_at(w, a4_ice_cluster(2), 104, 70)
    unit_at(w, spr_glacier_elder(), 74, 88, sh=(26, 4))
    unit_at(w, skeleton('walk', 2), 124, 90, flip=True, sh=(8, 3))
    for (x, y, b) in ((60, 14, True), (46, 30, False), (104, 22, True), (128, 40, False), (30, 74, False), (112, 80, True), (10, 88, False)):
        a4_snowflake(w, x, y, b)
    return finish(w)


# --------------------------------------------------------------------------- UV-11 Salamander Warden: Feueratem


@card_art('UV-11')
def _art_uv11():
    w = ground_world('slab', 6)
    prop_at(w, core(ring_team='teamA'), 22, 52)
    a4_heat_glow(w, 96, 86, 36, 12, seed=2)
    unit_at(w, spr_salamander_warden('breath'), 50, 84, sh=(26, 4))
    cone = a4_flame_cone(58, 19, seed=2)
    w.draw(cone, 86, 66 - cone.h // 2, 83)
    unit_at(w, skeleton('walk', 1), 128, 90, flip=True, sh=(8, 3))
    w.draw(a4_flames_small(3), 128 - 7, 90 - 34, 9100)
    for (x, y) in ((118, 66), (134, 74), (112, 50)):
        spark(w, x, y, 'gold')
    return finish(w)
