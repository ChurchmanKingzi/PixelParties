# Asset contract for the playable prototype

The prototype (`game/`, TypeScript + PixiJS) draws the battlefield from pixel atlases that are exported from the Python
pixel workshop (`art/`). This file is the contract between the exporters and the game. Everything is 1x native pixels,
master palette only (`pixl.RAMPS`), deterministic. 1 map cell = 32 x 32 px. The camera is the usual one of this project:
the ground is pure top-down, tall things stand on their footprint and show their south face.

## Common rules

- Output directory: `BastionBlasters/game/public/assets/` (the game loads files from `./assets/`).
- Each exporter is one new script in `art/` (`export_game_units.py`, `export_game_rooms.py`, `export_game_world.py`). It runs from
  `art/` with `python3 -I export_game_<name>.py`, writes its files, and writes preview contact sheets to
  `art/out/game_assets/<name>_*.png` (x3, with the key as a caption) so that a human can review them.
- **Never edit an existing file** and never run `cards.py` or `sheets.py` (they overwrite shared outputs). Reading existing outputs is fine.
- Packs: every `art/pack_*.py` registers card illustrations in `cards_art.ART` (see how `cards.main()` imports them). Packs use
  `from cards_art import *`, so helper names such as `unit_at`, `prop_at`, `mini_castle` are bound inside each pack module;
  to record what a diorama draws, patch the name in `cards_art` and in every loaded `pack_*` module, call `ART[card_id]()`, read the
  recorded calls, and restore the originals afterwards. Some dioramas call `world.draw(...)` directly or build sprites inline; read the
  `@card_art` function of the card to find the right sprite function (`spr_*`, `Canvas`) and call it yourself when recording fails.
- Palette check every exported image with `pixl.palette_violations`. Transparent background (alpha 0 or 255 only).
- Atlas JSON schema (all atlases):

```json
{ "image": "units_a.png",
  "frames": { "<key>": { "x": 0, "y": 0, "w": 32, "h": 40, "ax": 16, "ay": 39 } } }
```

`x, y, w, h` = rectangle in the atlas PNG; `ax, ay` = anchor in frame pixels (may lie outside the frame). Pack frames with
1 px of transparent padding between them, atlas width at most 2048 px.

## 1. `units_a.png`, `units_b.png`, `units.json` (exporter `export_game_units.py`)

`units_a.png` shows team A colors (crimson), `units_b.png` has the identical layout with `swap_team()` applied (teal). One JSON for both.
Sprites face **right**. Anchor = the ground contact point: `ax` = horizontal center of the feet, `ay` = pixel row of the feet.
Hovering units (Bat Witch, Zeppelin, Pigeon, bats ...): anchor = the point where the ground shadow belongs, which may be below the frame.

Keys:

- `<CARD-ID>#0`, `<CARD-ID>#1` for **all 77 unit cards** (UA-01 .. UA-18, US-01 .. US-23, UV-01 .. UV-17, UZ-01 .. UZ-19): the hero
  sprite of the card (the unit the card is about, as drawn in its diorama) in two idle frames (call the sprite function with `f=0` and
  `f=1` when it accepts `f`; otherwise export the same frame twice). Trim to the bounding box of non-transparent pixels. For cards with
  several units in the diorama export only the hero. Artillery units include their gun (they stand on a platform in the game).
- `citizen.0` .. `citizen.5`, each with `#0`, `#1`: the standard citizens (`assets_units.citizen(kind, f)`: all kinds/skins you find).
- `proj.<name>` (centered anchor, 1 frame each, `#0` plus optional `#1`): `stone`, `bomb`, `arrow`, `bolt` (lightning), `fire`, `ice`, `poison`
  (spores), `arcane`, `ink`, `goo`, `fish`, `egg`, `shell` (cannon ball). 6 to 16 px, round or pointed in the flight direction (right).
- `fx.<name>#0..n` (centered anchor): `spark` (4 frames), `puff` (smoke, 4 frames), `explosion` (5 frames, up to 48 px), `heal` (plus sign, 3 frames),
  `star` (stun stars, 2 frames), `bones` (skeleton pile), `confetti` (4 frames), `drop` (water), `flame` (3 frames), `snow` (2 frames).
- `rank.1` .. `rank.5` (7 x 7 or 9 x 9 rank badges, anchor center; `assets_units.rank_badge`).
- `shadow` (one soft ellipse shadow 16 x 6 in dither, anchor center).

## 2. `rooms.png`, `rooms.json` (exporter `export_game_rooms.py`)

Interior sprites of all **39 Room cards** (catalog `katalog/01-gebaeude.md`, column Bauart = Raum; `daten/cards.json` field `bauart == "raum"`)
**without** walls, doors, wall decoration, people, units or targets: floor plus furniture only. The sprite covers exactly the module
footprint: `w = cols * 32`, `h = rows * 32`, anchor `ax = ay = 0`.

Keys: `<CARD-ID>@<cols>x<rows>`, e.g. `BH-01@3x2` and `BH-01@2x3` (a rotated room has the footprint 2 x 3: render the same room with
the rotated module, so furniture is laid out for it and **not** a rotated bitmap). Rooms with a square footprint (2x2, 3x3) get only one key.
Furniture stands on its footprint and shows its south face as everywhere in this project; furniture that would normally sit against the
north wall may sit at the top of the sprite.

How: the dioramas of these cards call `mini_castle(rows, ox, oy, world, themes={letter: theme})` (`cards_art.py`, `castle.py`). Reproduce what
`mini_castle` does **without** `draw_walls` and `wall_shadows` (you may copy its code into your script; do not edit `castle.py`): paint the floors, place
the objects with the card's theme, then crop the module's pixel rectangle out of the world. Use the card's own theme (floor tile + furnish function)
for the correct look. Platform rooms (BP-01, BP-02, BP-06 and similar) additionally list the gun-slot positions that
`FurnishCtx.platform(x, y)` reports, as `"slots": [[x, y], ...]` in frame pixels (module-relative) on the frame entry.
Fall back to a plain themed floor when a card cannot be reproduced and say so in the report.

## 3. `world.png`, `world.json`, `bg_field.png`, `bg_field.json`, `../cards/` (exporter `export_game_world.py`)

`world.png` / `world.json`, keys:

- Floors (32 x 32, anchor 0,0): `tile.yard.0` .. `tile.yard.2` (dirt cobble, courtyard), `tile.slab`, `tile.dark`, `tile.planks.0` .. `tile.planks.3` (different tones),
  `tile.grass.0` .. `tile.grass.3`, `tile.rubble` (rubble of a destroyed room or wall, drawn on top of the floor, transparent between stones).
- Walls (south-view strips, tileable in x): `wall.top` (32 x 8, the top of a wall, anchor 0,0), `wall.front.22`, `wall.front.10`, `wall.front.20` (32 x h, the south face, anchor 0,0),
  each also as `.dmg` (cracks, < 50 % HP). Variants for wall cards: `wall.top.pudding`, `wall.front.22.pudding` (and `.10`, `.20`, `.dmg`), the same for `armor` (metal plates), `ward` (crystal runes),
  `wall.post` (corner pillar, 10 x 34, anchor bottom center), `wall.breach` (rubble pile in a wall gap, 32 x 12, anchor 0,0).
- Doors and gates: `door.front` (a door in a south-facing wall, 32 x 22, built from `front_wall_tile` with a 14 px door in the middle, anchor 0,0), `door.front.10` (the same, 10 px high),
  `gate.front@A`, `gate.front@B` (main gate in a south wall, 32 x 24, `castle.front_gate_h_tile`), `gate.open@A/@B` (open), `gate.side` (a side gate: an open passage with a wooden threshold, 8 x 32).
- `tower@A`, `tower@B` (the stone tower of `assets_env.tower`, anchor bottom center of its 32 x 32 cell), `tower.ruin`.
- `core.crystal` (the core standing on its 64 x 64 footprint, anchor bottom center of the footprint, 3 glow frames `core.crystal#0..2`), `core.ruin`.
- **Yard buildings and towers as cards**: for every card with `bauart` `hof` or `turm` (and `BP-03`, `BP-04`, `BP-05`, `BA-*`, `BC-*`, `BU-*` of those kinds) one hero sprite under the key `<CARD-ID>`
  (`#0`, plus `#1` if there is a second frame). Anchor = bottom center of the footprint (footprint size in cells from the catalog; for 2x2 the sprite stands in the middle of the 64 x 64 px).
  Re-use the sprite that the card diorama draws with `prop_at` (see the common rules), and for towers the tower sprite that the diorama passes as `tw=` to `mini_castle`.
  Also export the gate card `BS-07`. Wall cards and Masonry are covered by the wall keys above.
- `label.<CARD-ID>` for all **154 cards**: the English card name in the pixel font (`pixfont.draw_text`, white with `outline=INK`), anchor = bottom center.
- `icon.<name>` (7 px): every icon of `cardicons.ICONS`.
- `marker.build.ok`, `marker.build.bad` (32 x 32 translucent-looking dither squares, green / red) and `marker.blueprint` (blue hatch tile), `marker.range` (a 4 x 4 dither dot).

`bg_field.png` (1792 x 896 = 56 x 28 cells): the whole battlefield ground without any castle: grass with the organic landscape of `styleprobe.py`/`landscape.py` (paths, ponds, forest at the borders,
mushrooms, a few rocks). The two 16 x 16 cell building plots (P1: cells x 2..17, y 6..21; P2: cells x 38..53, y 6..21) stay **plain grass without trees or ponds**. `bg_field.json`:
`{"ponds": [[x0, y0, x1, y1], ...]}` = blocked cell rectangles (inclusive cell coordinates; keep ponds out of the middle corridor y 11..16 so that the path between the bastions stays open) and
`{"trees": [[cx, cy], ...]}` optional decorative sprite positions (pixel coordinates of tree foot points) if you draw trees as separate sprites in `world.png` (`tree.0..2`, anchor bottom center) so that the game can draw units behind them; otherwise bake them into the background.

`../cards/`: copy `art/out/cards/<ID>.png` for all 154 cards and `art/out/card_back.png` to `game/public/cards/` (`<ID>.png`, `back.png`).
