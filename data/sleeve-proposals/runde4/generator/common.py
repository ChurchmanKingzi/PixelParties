# -*- coding: utf-8 -*-
"""Gemeinsame Werkzeuge für Runde 4: bindet kit.py und xcfkit.py aus Runde 2 ein (Sprite-Cache: sprites4/)."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'runde2', 'generator'))
import xcfkit
xcfkit.CACHE = os.path.join(HERE, 'sprites4'); os.makedirs(xcfkit.CACHE, exist_ok=True)
import kit
kit.OUT = os.path.abspath(os.path.join(HERE, '..'))
from kit import *            # noqa
from xcfkit import (sprite, compose, layer, layer_info, meta, parts, part_at, split_x, find,  # noqa
                    scene_sprite, scene_crop, scenes_with, scene_layers, card_region_layers, touching, bbox, period)
