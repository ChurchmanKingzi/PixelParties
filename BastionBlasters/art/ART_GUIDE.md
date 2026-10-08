# Art guide — card art packs (Bastion Blasters)

This guide is for everyone who draws card illustrations in code. Read it fully before you start.

## 1. Deliverable

One or more **packs**: Python files `art/pack_<name>.py` (you may add helper modules `art/pack_<name>_*.py`; every module whose
file name starts with `pack_` is imported by the card renderer). A pack contains

1. **Sprites** for your units / props / towers as functions returning a `pixl.Canvas` (RGBA, ramp ids for the outline).
   Unit sprites: `def spr_<snake_case_name>(anim='idle', f=0) -> Canvas` (only `idle` is required now; keep the signature so
   animations can be added later).
2. **One diorama per assigned card**, registered like this:

```python
from cards_art import *          # helpers, ART registry, everything from pixl / scenekit / landscape / assets_*

@card_art('UA-02')
def _art_ua02():
    w = ground_world('grass', 5)                 # World 144 x 96
    unit_at(w, spr_spark_mage(), 60, 76)         # foot position (x, y)
    prop_at(w, bush(1), 120, 40)
    return finish(w)                             # vignette + RGBA image, exactly 144 x 96
```

Check your work with `cd art && python3 -I packtool.py pack_<name>` (size, palette, determinism, contact sheet in
`art/out/packs/<name>.png`, single images x4 in `art/out/packs/<name>/`). **Look at the sheet and at every card image.**
Iterate until each card reads clearly at its real size (144 x 96 shown 3x).

## 2. Rules

- **Only your own files.** Never edit an existing file (`pixl.py`, `cards_art.py`, `castle.py`, `assets_*.py`, `cards.py` ...).
  If you need something that does not exist, write it inside your pack.
- **Master palette only.** Colors come from `pixl.RAMPS` (20 ramps x 6 tones, index 0 = darkest) plus `INK`/`WHITE`.
  Ramps: stone, wood, grass, dirt, goblin, skin, bone, metal, gold, fire, ice, purple, fur, teamA (crimson), teamB (teal), leaf, slime,
  coal, sky, cloth. Never multiply or blend colors. Darken with `pixl.darken_palette(rgb, steps)`.
- **Deterministic.** Use `random.Random(seed)`; no `random.random()`, no time.
- **No text and no letters** inside the art.
- **Pixel style (16-bit):** light from the top left, 4–6 tones per surface, checkerboard dither between two tones, `c.outline()` at the
  end of every sprite (sel-out: light on the lit side, dark on the shadow side), never pure black. Sprites face **right**
  (the renderer can mirror them). Shadows are not baked into sprites; `unit_at` / `prop_at` add them.
- **Faces stay simple.** 1–2 px eyes (2x2 at most), at most a mouth line, small nose or none. Characters are recognized by silhouette,
  hat and tool, not by the face. (Earlier versions were criticized for over-detailed faces: eyes, noses.)
- **Silhouette first.** Every unit must be unmistakable in a black silhouette. Category read: Artillery shows its gun, Defenders are
  broad and big, Civilians carry their tool large, Assault units are drawn in motion. Humor lives in the design.
- **Size classes:** S 16 x 16 (citizens, tiny creatures), M 32 x 32 (standard), L up to 56 x 40 (bears, trolls, golems),
  XL up to 64 x 64 (giants, dragons, big guns, airships). Everything must fit the 144 x 96 window together with the scenery.
- **Team color:** parts that belong to the player (banners, capes, plumes, trims) use the `teamA` ramp; `swap_team()` turns them into `teamB`.
- **Perspective (one rule):** ground is pure top-down; tall things stand on their footprint and show their **south face**
  (front view), anchored at the bottom edge. Walls are thin (8 px) and sit on cell edges (1 cell = 32 px). Rooms are at least 2 cells deep.

## 3. Composition of a diorama (144 x 96 window)

- 1x pixel density, **no upscaling**. The window shows a small scene from the game world.
- The hero (unit, building) sits near the center; keep roughly the middle 100 x 60 px clear for it. Two to four props at the edges
  (trees, rocks, bushes, crates ...) frame it; foot y between 60 and 90 for ground units.
- Show what the card does when it is simple to show: the shot arc and `zielschatten` (target marker) for artillery, heal crosses for
  healers, a skeleton stuck in the pit trap, enemies approaching a tower. One or two extra units are fine. The picture must still read at a glance.
- Buildings: the finished building as it stands in a castle. **Rooms** use `mini_castle` (walls, door, floor, furniture, towers) with a
  theme (see 5). **Yard buildings** (no walls, standing on cobblestone yard) are free-form on `ground_world('cobble')`. **Towers** can use
  `mini_castle(..., tw=<your tower sprite>)` or a free-form scene. **Walls / gates** are free-form.
- Ground kinds for `ground_world(kind, seed)`: `grass`, `dirt`, `cobble`, `slab`, `planks`, `snow`, `dark` (crypt/graveyard), `sand`, `cloud`,
  `purple` (chaos), `mud`. Pick what the unit or building would stand on.
- Window crop: the card shows the center 86 rows of the 96, so keep important things between y = 5 and y = 91.

## 4. API cheat sheet (read the source files for details)

- `pixl.py`: `Canvas(w, h)` with `.put_ramp(x, y, ramp, idx)`, `.rect(x0,y0,x1,y1,ramp,idx)`, `.line(...)`, `.outline()`, `.blit(other, x, y)`,
  `.flipped()`, `.alpha(x,y)`; shaded primitives `ellipse(c, cx, cy, rx, ry, ramp, lo, hi, ...)`, `round_rect(c, x0,y0,x1,y1, ramp, lo, hi, radius)`,
  `thick_line(c, x0,y0,x1,y1, width, ramp, lo, hi)`, `poly(c, pts, ramp, lo, hi, flat=None)`, `quant(L, lo, hi, x, y)`, `World` (depth-buffer
  scene: `world.draw(sprite, x, y, depth_key, flip)`), `upscale`, `darken_palette`, `palette_violations`.
- `assets_units.py` (reference for style and construction): `skeleton`, `goblin`, `bear`, `guard`, `witch`, `catapult`, `pumpkin`, `builder`,
  `citizen(kind, f)`, `rank_badge`. **Copy ideas, do not call them for new units** (except `citizen` for bystanders).
- `assets_props.py`: bed, bunk, anvil, barrel, trough, crate, rack, herb_table, chest, plant, rug(w, h, team), window, banner_cross, crest(team), forge_decor.
- `assets_buildings.py`: `arrow_tower`, `pudding_wall`, `pit`, `field_tent` (examples of building sprites).
- `landscape.py`: `tree_round`, `tree_blossom`, `tree_pine`, `bush`, `rock`, `giant_mushroom`, `fence`, `signpost`, `lily`, `duck`.
- `scenekit.py`: `shadow(world, cx, cy, rx, ry)`, `zielschatten(world, cx, cy, r, phase)` (target marker), `swap_team(canvas)`.
- `cards_art.py`: `ground_world`, `unit_at(world, spr, foot_x, foot_y, flip=False, team_swap=False, sh=(9,3))`, `prop_at(world, spr, foot_x, foot_y)`,
  `finish(world)`, `spark(world, x, y)`, `mini_castle(rows, ox, oy, world, tw=None, themes=None, gates=())`, `crop_world(world, x0, y0)`,
  `props_for(team)`, `stone_wall_piece(width)`, `stone_projectile_small()`. First-batch scenes in the same file show the pattern.
- `castle.py` / `assets_env.py`: `tile_cobble`, `tile_planks`, `tile_grass`, `tower`, `core`, `Textures`, `FloorTiles`, `CELL = 32`.

## 5. Room themes (for Room buildings)

`mini_castle` draws a small castle from an ASCII plan (`h` yard, `.` outside, one letter per room module; adjacent equal letters form a
module, rooms are at least 2 cells deep). The built-in letters K, S, W, B, Z are taken by the first batch. For a new room give your own
letter and a theme:

```python
def furnish_bath(ctx):                       # ctx: FurnishCtx (castle.py)
    P = ctx.P                                 # prop sprites from props_for(team)
    ctx.decor(P['window'], ctx.X0 + 20)       # wall decoration on the north wall
    ctx.prop(my_tub(), ctx.X0 + 12, ctx.Y0 + 14)       # furniture, top-left corner in world px
    ctx.floor_deco(P['rug'], ctx.X0 + 20, ctx.Y0 + ctx.H - 26)          # floor decoration: lies on the floor, below furniture and units
    # ctx.W, ctx.H = module size in px; ctx.platform(x, y) reports a gun slot; ctx.north_door is True if the door is in the north wall

THEME_BATH = {'floor': tile_rgb, 'furnish': furnish_bath, 'low': False}     # floor: 32x32x3 uint8 array, e.g. tile_planks(...).px[:, :, :3]
world = ground_world('grass', 4, 160, 160)
rows = [".....", ".XXX.", ".XXX.", ".hhh.", "....."]                        # 3 x 2 room module 'X'
c, out = mini_castle(rows, 0, 0, world, themes={'X': THEME_BATH})
...
return finish(crop_world(world, 8, 6))                                       # 144 x 96 crop that centers a 3 x 2 module
```

Module sizes follow the catalog (`Size` column: `Room 3x2`, `Room 2x2`, `Room 3x3`). A 3 x 3 room is taller than the window: the south part
is cropped (that is fine: keep the north half and the door side readable, or crop from y0 = 14). Look at `BH-01`, `BW-01`, `BU-01`,
`BF-01`, `BP-01` in `art/out/cards/` for the target look.

## 6. Source of truth for what to draw

- Card rows: `katalog/01-gebaeude.md` (buildings) and `katalog/02-einheiten.md` (units). The column **Name (EN)** is the game name, **Look** is the German
  visual idea (silhouette + joke), **Effekt / Besonderheit** explains what the card does. Draw the Look as faithfully as the pixel size allows;
  if something cannot be drawn at that size, keep the silhouette and the joke and simplify the rest.
- Names, text and numbers on the cards are written elsewhere; you only draw.
- Existing art (view it first!): `art/out/cards_overview.png`, `art/out/cards/*.png`, `art/out/einheiten.png`, `art/out/szene_1x.png`.

## 7. Quality bar

The target is the look of the first 17 cards: consistent palette, clear silhouettes, readable at 1x, charming, simple faces.
Do not ship a card you cannot recognize at 1x. Do not copy an existing sprite with a recolor unless the catalog says the two are
related; every card needs its own silhouette. Keep render time per card below 20 s.

## 8. Report

When done, answer with a short list: card IDs finished, pack/module names, anything you simplified or could not do. Do not paste code.
