# Handoff: Animated Battle Title-Screen Backdrop

## Overview
An animated, layered title/menu **background** for the game. A cast of characters is arranged around a central laser-clash explosion; every character drifts with a gentle idle "float," the whole scene periodically shakes on a laser impact, embers rise, and a vignette + impact flash sell the moment. The centerpiece is a **tethered laser clash**: two characters fire beams that collide in a central burst, and the burst scales in perfect sync with the two shooters so the beams always connect.

It is designed to sit **behind** the game's menu/title UI and loop forever.

## About the Design Files
The file in this bundle (`Battle Backdrop v2.dc.html`) is a **design reference created in HTML** — a working prototype showing the intended look and motion, **not production code to drop into the game engine as-is**. The task is to **recreate this backdrop in the game's actual environment** using its established patterns (whatever the engine/renderer is — a web canvas/DOM layer, Unity, Godot, a native UI layer, etc.). If the game has no suitable layer system yet, pick the most appropriate approach for that engine and implement the design there.

The prototype is authored as a "Design Component" and depends on a small runtime (`support.js`) only so it opens standalone in a browser for reference. **You do not need `support.js` or the DC framework in the real game** — the whole thing is plain layered images + CSS-style keyframe animations. Everything you need to reproduce it is documented below and visible in the HTML.

### How to preview the reference
Open `Battle Backdrop v2.dc.html` in a browser (it loads `support.js` and the `layers2/` images by relative path — keep the folder structure intact). It renders full-viewport.

## Fidelity
**High-fidelity (hifi).** Final art, final layer order, final positions, and final animation timings. Recreate the motion faithfully. All numeric values below are the actual shipping values.

---

## The scene: how it's built

It is a stack of **full-frame layers**. Every character/effect layer is a full-viewport element whose PNG art is positioned within the frame by the art itself (each PNG is 1920×1080 with the character already placed and everything else transparent). Layers are drawn back-to-front in source order. In the prototype each layer is a `<div>` with `background: url(...) center / cover no-repeat`; in a real engine these are simply sprites/quads at the same z-order, each covering the full screen, scaled to "cover."

**Canvas / reference resolution: 1920×1080.** All pixel offsets below are in this space. When rendering at another resolution, scale offsets proportionally (or keep the art on a 1920×1080 virtual stage scaled to fit, which is what the prototype does via `cover`).

### Layer stack (back → front)
| # | Layer | Asset | Role |
|---|-------|-------|------|
| 0 | Background plate | `layers2/background.png` | Static backdrop. Rendered at `inset: -2%` (slightly overscanned so edges never show during shake). |
| 1 | Hammer girl | `layers2/hammer.png` | Idle float. Behind the clash. |
| 2 | **Explosion core** | `layers2/explosion.png` | The central beam-collision burst. **Scales** on the tether clock (see below). |
| 3 | Central bloom | *(none — CSS radial gradient)* | Soft warm glow behind the burst; pulses opacity+scale. |
| 4 | **Broghan (golem)** | `layers2/golem.png` | Right-side shooter. Carries the RIGHT laser beam (baked into the art). Tethered. Offset +111px X, −6px Y. |
| 5 | Kyli (tree girl) | `layers2/horned.png` | Idle float. Offset +161px Y. |
| 6 | Angel girl | `layers2/angel.png` | Idle float. |
| 7 | Blonde girl | `layers2/blonde.png` | Idle float. |
| 8 | **Jiggles (rabbit)** | `layers2/rabbit.png` | Left-side shooter. Carries the LEFT laser beam (baked into the art). Tethered. |
| 9 | Champion (swordsman) | `layers2/ninja.png` | Idle float. Offset +215px Y. |
| 10 | Flying cat — top | `layers2/cat_top.png` | Idle float (independent). |
| 11 | Flying cat — mid | `layers2/cat_mid.png` | Idle float (independent). |
| 12 | Flying cat — bottom | `layers2/cat_bottom.png` | Idle float (independent). |
| 13 | Embers | *(none — generated particles)* | Rising ember particles. |
| — | Impact flash | *(none — CSS radial gradient)* | White flash on impact beats. Sits above the shake group. |
| — | Vignette | *(none — CSS radial gradient)* | Dark edge vignette, gently pulsing. Topmost. |

> The three flying cats were originally one combined art file (`titleCats.png`); it was sliced into three transparent full-frame PNGs at the gaps between cats (x-bands `0–262`, `262–562`, `562–1920` of the 1920-wide source) so each can float independently. If you have the three cats as separate source art, use that instead.

### Static position offsets
Some layers are wrapped in a parent that applies a fixed translate on top of their float (the float animation runs on the inner element so it composes cleanly):
- **Broghan (golem):** `translate(111px, -6px)` — rests flush against the right edge.
- **Kyli (tree girl):** `translateY(161px)`.
- **Champion (swordsman):** `translateY(215px)`.

All other layers have no static offset (their art is already positioned in-frame).

---

## Animations & behavior

All animations **loop infinitely**. There is no user interaction — this is an ambient background. Timings below are exact.

### 1. Idle float (`floaty`) — most characters
Each floating character eases to an offset at 50% of its cycle and back. Per-character parameters: horizontal amount `mx`, vertical amount `my`, rotation `mr`, plus its own `transform-origin`, cycle `duration`, and a negative start `delay` (so they're all out of phase). Easing: `ease-in-out`.

Keyframe (conceptually):
```
0%, 100% : translate(0,0) rotate(0)
50%      : translate(mx * P, my * P) rotate(mr * P)
```
where `P` is the global parallax multiplier (see Tunable parameters; default 1).

Per-character values:
| Layer | transform-origin | mx | my | mr | duration | delay |
|-------|------------------|----|----|----|----------|-------|
| Hammer girl | 72% 28% | 9px | −15px | 2° | 4.2s | −0.6s |
| Kyli (tree girl) | 80% 100% | −11px | −15px | 2.6° | 6s | −2s |
| Angel girl | 20% 30% | 0px | −12px | −1.4° | 5s | 0s |
| Blonde girl | 20% 50% | 4px | −9px | 1° | 6.5s | −1.5s |
| Champion (swordsman) | 16% 80% | 8px | −14px | −2° | 5.5s | −2.5s |
| Cat — top | 23% 5% | 14px | −9px | 3° | 3.4s | −0.5s |
| Cat — mid | 37% 30% | −11px | 9px | −3° | 2.9s | −0.8s |
| Cat — bottom | 5% 48% | 16px | −12px | 4° | 3.0s | −1.7s |

### 2. Tethered laser clash — Broghan + Jiggles + Explosion core
This is the important mechanic. **Two shooters fire beams that collide in the central burst, and the burst must always touch both beam tips.**

- **Jiggles (left, rabbit)** and **Broghan (right, golem)** each have their laser beam **baked into their character art**, pointing toward center.
- All three (Jiggles, Broghan, Explosion) run on **one shared clock**: `duration 4.8s`, `ease-in-out`, **zero delay** — so they are always in perfect phase.
- **Rest state (0%/100%) = fully apart** (beams at max reach, burst at full size). Broghan is pinned to the right screen edge, so it can *only* move inward (left) and back — never right of its start.
- **Mid state (50%) = inward squeeze:** Jiggles moves right, Broghan moves left (exact mirror), and the explosion **scales down** so its edges still meet the (now shorter-reach) beams.

Keyframes (`H` horizontal amp = 9px, `V` vertical amp = 4px, `S` core scale amp = 0.021, `P` = parallax multiplier):
```
Jiggles (jiggleTether):
  0%,100% : translate(0, 0)
  50%     : translate( H*P,  V*P)      // inward = right + slight down

Broghan (broghanTether):   // mirror of Jiggles, horizontally
  0%,100% : translate(0, 0)
  50%     : translate(-H*P,  V*P)      // inward = left + slight down

Explosion core (coreTether):
  0%,100% : translate(0,0) scale(1)                 // full size
  50%     : translate(0, V*P) scale(1 - S*P)        // constrict
```
Notes:
- The shared small vertical bob (`V`) keeps the whole clash assembly rigid so beams never visibly disconnect vertically.
- The explosion's `transform-origin` is `52% 42%` (the burst's visual center) so it scales about the burst, not the frame.
- **The explosion must stay at 100% opacity and constant color at all times** — it only scales, never fades or shifts hue. This was an explicit requirement so it always matches Broghan's (static-colored) beam.

### 3. Screen shake (`shake`) — whole scene
Applied to the group that contains all layers 0–13 (everything except the topmost flash/vignette). A 10s loop that is mostly still, with two short violent shake bursts (around the 1–4% and 50–54% marks) synced to the laser impacts. Uses `steps(1,end)` timing (hard cuts, not eased). Amplitude scaled by a `--shake` multiplier (1 = on, 0 = off).

### 4. Impact flash (`flashburst`)
A white radial flash centered on the burst (`circle at 56% 41%`), `mix-blend: screen`. Opacity spikes briefly at the same two impact beats as the shake (10s loop, `steps(1,end)`), then 0. Peak opacity scales with the shake multiplier.

### 5. Central bloom (`glowpulse`)
Soft warm radial-gradient glow (see Design tokens), `mix-blend: screen`, `blur(9px)`, 860×860px centered at `left 52% / top 42%`. Pulses opacity (0.4→1) and scale (0.98→1.2) on a 10s `ease-in-out` loop, peaking on the impact beats.

### 6. Vignette (`vignettepulse`)
Dark radial vignette over everything; opacity gently breathes 0.5↔0.72 on a 6s `ease-in-out` loop.

### 7. Embers (`emberrise`)
46 small round particles rise from the bottom of the screen to the top and fade out. Each ember is randomized: size 2–7px, duration 7–16s, random start delay (negative, so the field is pre-populated), random horizontal start, random horizontal drift ±50px, and a random warm color from the palette, with a matching glow (`box-shadow`). Keyframe: start at `translateY(20px)` opacity 0 → fade in by 8% → drift up to `translateY(-112vh)` with horizontal `drift`, fading out. Recreate as a simple particle emitter with these ranges.

---

## Tunable parameters
The prototype exposes four controls (implement as whatever config the engine uses). All default to the "on"/`1` values.

| Param | Type | Default | Range | Effect |
|-------|------|---------|-------|--------|
| `parallax` (`P`) | number | 1 | 0 – 2.5 | Global multiplier on every float/tether motion amplitude. 0 freezes all drift; higher = more movement. |
| `explosion` (`ef`) | number | 1 | 0.4 – 2 | Intensity multiplier for the explosion's light throb (brightness/saturation). *(Note: in the current build the core's light-throb keyframe is not applied to keep opacity/color constant; `ef` is retained for the glow feel. Keep or drop per engine.)* |
| `screenShake` | boolean | true | — | Enables the screen-shake + flash amplitude (sets the `--shake` multiplier to 1, else 0). |
| `showEmbers` | boolean | true | — | Toggles the ember particle field. |

---

## Design tokens
- **Scene base / letterbox color:** `#1a1020`
- **Ember palette:** `#ffd36b`, `#ff8a3d`, `#ff5a4d`, `#ffe9a8`, `#ffffff`
- **Central bloom gradient:** `radial-gradient(circle, rgba(255,228,150,.4), rgba(255,152,72,.12) 22%, rgba(255,96,74,.03) 40%, transparent 56%)`, blurred 9px, blend `screen`.
- **Impact flash gradient:** `radial-gradient(circle at 56% 41%, #fff, rgba(255,240,200,.55) 30%, transparent 58%)`, blend `screen`.
- **Vignette gradient:** `radial-gradient(circle at 50% 44%, transparent 40%, rgba(20,8,20,.4) 80%, rgba(15,5,18,.64) 100%)`.
- **Tether amplitudes:** horizontal `H = 9px`, vertical `V = 4px`, core scale `S = 0.021`.
- **Layer fit:** every art layer covers the full frame (`cover`), background plate overscanned to `inset: -2%`.

## Assets
All art is in `layers2/` (1920×1080 PNGs with transparency, character pre-positioned):
`background.png`, `hammer.png`, `explosion.png`, `golem.png` (Broghan), `horned.png` (Kyli), `angel.png`, `blonde.png`, `rabbit.png` (Jiggles), `ninja.png` (Champion), `cat_top.png`, `cat_mid.png`, `cat_bottom.png`.
The bloom, flash, vignette, and embers are **generated** (gradients / particles), not image assets.

## Files
- `Battle Backdrop v2.dc.html` — the design reference (all markup, keyframes, and the ember-generation logic are here; read it alongside this README).
- `support.js` — DC runtime, only needed to open the reference standalone in a browser. Not needed in the game.
- `layers2/*.png` — the art layers listed above.
