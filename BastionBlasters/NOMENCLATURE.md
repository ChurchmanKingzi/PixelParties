# Bastion Blasters — Nomenclature

**Strict terminology and rules-text grammar.** This file is authoritative for everything the player reads: card names,
rules text, keywords, tooltips, UI. It is generated from [`daten/keywords.json`](daten/keywords.json) by
`tools/build_nomenclature.py`; do not edit the tables by hand. Cards are checked by `tools/lint_card_text.py`.

The game is in **English**. The design documents (`GDD*.md`, `katalog/*.md`) are written in German and use the
German design term in prose; the column "Design term (DE)" maps each German term to its English game term.

---

## 1. Principles

1. **One concept, one term.** No synonyms, no variants. If two words mean the same thing, one is deleted from the game.
2. **Rules text is mechanical.** It states triggers, conditions, numbers, durations and limits. No adjectives, no
   explanations, no jokes. Humor lives in the card name, the flavor line and the art.
3. **Flavor never goes into the effect box, rules never into the flavor line.** The effect box holds only text that
   changes the game state. A vanilla unit has an empty effect box except for its Rank 3 Talent.
4. **Keywords are bold, automatically.** Every term in the tables below that is marked *bold* is set in bold wherever
   it appears in rules text. The renderer does this; authors never type bold for glossary terms. The only text typed
   in bold is an **ability name** at the start of a sentence: `**Name**: effect.` or `**Name** (condition): effect.`
5. **Reminder text lives in the glossary.** A card says "Stunned 1s", never "Stunned (cannot act) 1s". The tooltip shows
   the definition from the table below.
6. **Standard behavior is not repeated.** What follows from a card's type line (trajectory, doctrine, guard zone, line)
   is defined once in the glossary and never restated on the card.
7. **Capitalization:** glossary terms are capitalized in the middle of a sentence (Stunned, Healing Source, Weapons).
   Common nouns are lowercase: unit, ally, enemy, building, cell, wave, wall segment. Any other capitalized word in
   the middle of a sentence is a lint error.
8. **Everything is checked.** A text that breaks a rule here does not render without a warning, and the linter fails.

## 2. Sentence grammar

- Present tense, third person singular, the card itself is the (omitted) subject: "Heals the most wounded ally."
- Clause order: **Trigger → Condition → Effect → Limit.** Triggers end with a colon.
- Every sentence ends with a period. Several effects are several short sentences.
- Targets: `ally`, `enemy`, `unit`, `building`, `cell`, `wall segment`; plural with `s`. Use `adjacent` for the 4 neighboring cells and `within N cells` for distances.

| Pattern | Example |
|---|---|
| Static effect | `Splash 1.` |
| Effect on a target | `Heals the most wounded ally within 4 cells for 8 HP/s.` |
| Trigger | `On kill (Civilian): +15 XP. Heals 10 HP.` |
| Periodic | `Every 6s hits all adjacent enemies.` |
| Condition | `Block: −30% damage from the front.` |
| Replacement | `Replaces up to 4 wall segments.` |
| Named ability | `**Slide Attack** (3-cell run-up): Knockback 2 cells, Stunned 1s.` |
| Keyword statement | `Healing Source.` / `Flammable.` |
| Aura / buff | `Newly spawned Assault and Defender units gain Hardened.` |
| Limit | `The first 2 enemies each wave fall in: 60 Impact damage, Stunned 4s.` |

Allowed trigger words: `On kill`, `On death`, `On spawn`, `On hit`, `On impact`, `Every Ns`, `While <condition>`, `Once per wave`.
Forbidden words (lint): *cheap, powerful, mighty, huge, tiny, very, quickly, slowly, nice, brave, fierce, mass, strong,
weak, massive, incredibly, extremely, also, simply, just, basically, greatly.*

## 3. Numbers and units

| What | Format | Example |
|---|---|---|
| Time | digits + `s`, no space | `4s`, `1.2s` |
| Rate | `N HP/s` | `8 HP/s` |
| Percent | digits + `%`, no space | `30%` |
| Gain / loss | `+` / `−` (U+2212), never a hyphen | `+15% speed`, `−20% speed` |
| Multiplier | `×` + number | `Structure ×2`, `Fire damage taken ×1.3` |
| Decimals | point, never a comma | `1.2s` |
| Distance | `N cells` (lowercase) | `within 4 cells` |
| Area | `radius N` | `radius 1` |
| Damage | `N <Type> damage` | `60 Fire damage` |
| Ranges | en dash | `1–4s` |
| Approximations | not allowed; give the exact number | `13s`, not `about 13s` |

## 4. Card anatomy

1. **Header:** tier plaque (I–IV), ID, then Gun Slots (cannon) / Squad (person) / Reinforce (arrow, written `+N`) or Crew (person) for buildings, then the star rank.
2. **Art window:** 144 × 86 diorama in game graphics.
3. **Name band:** English card name in Title Case, hyphenated compounds, at most 136 px wide (about 26 characters; the linter measures it).
4. **Type line, derived from data:** `CARD TYPE · Line · Trajectory | Doctrine | Guard zone` for units, `BUILD TYPE size · Group` for buildings. At most 144 px wide; the separators tighten automatically when needed, and the linter fails if it still does not fit.
5. **Stat strip, in this order:** heart = HP (+ armor class abbreviation for units, + material for buildings), sword = damage (blade color = damage type), clock = attack interval in seconds, target = range or radius, boot = speed in cells per second.
6. **Effect box:** at most 6 lines (5 are the norm; with 6 lines the flavor shrinks to one line). First the rules text, then the **Rank 3 Talent** behind the gold `RANK 3` badge (the Talent is unlocked when the unit reaches Rank 3, "Elite", at 300 XP).
7. **Flavor line:** at most 2 lines (1 line when the effect box has 6), below the dotted divider, never bold, never mechanical.

## 5. Naming

- Card names are English, Title Case, no abbreviations. Puns must work in English.
- Catalog column `Name (EN)` holds the game name; the German `Name` is only the design name.
- Ability names are Title Case, 1–3 words, unique per card (`Double Throw`, `Rattle Head`).

## 6. Changing the glossary

1. Edit `daten/keywords.json` (fields: `en`, `de`, `kind`, `bold`, `def`, optional `abbr`, `duration`, `forms`).
2. Run `python3 tools/build_nomenclature.py` and `python3 tools/lint_card_text.py`.
3. Re-render the cards (`cd art && python3 -I cards.py`).

---

## 7. Glossary


### Card types

Top-level category of a card. Shown in the type line in capitals.

| Term | Design term (DE) | Definition |
|---|---|---|
| **Artillery** | Artillerie | Stands on Gun Slots of its own bastion and shoots the enemy bastion. |
| **Assault** | Sturm | Runs to the enemy bastion, kills Civilians and Citizens, occupies the Core Chamber. |
| **Defender** | Verteidiger | Stays inside its own bastion. Blocks Conquest while alive in the Core Chamber. |
| **Civilian** | Zivilist | Stays inside its own bastion and supports: heals, repairs, buffs. |
| **Building** | Bauteil | A card that is placed on the plot. |

### Build types

How a building occupies the plot. Shown first in the type line of building cards.

| Term | Design term (DE) | Definition |
|---|---|---|
| **Room** | Raum | Module of at least 2 cells depth with walls and a door. |
| **Yard** | Hof | Building on yard cells: no walls, no door, open to all units; less HP. |
| **Tower** | Turm | Solid 1×1 cell at the outer edge, a corner, or in the yard. |
| **Wall** | Wand | Wall segments on cell edges. Blocks movement and Line of Fire. |
| **Gate** | Tor | Opening in an outer edge. Open for allies, closed for enemies. |

### Building groups

Catalog group of a building. Shown last in the type line.

| Term | Design term (DE) | Definition |
|---|---|---|
| Defense | Strukturen | Building group (catalog heading). |
| Turrets | Türme | Building group (catalog heading). |
| Healing | Heilung | Building group (catalog heading). |
| Workshops | Werkstätten | Building group (catalog heading). |
| Unlock | Freischalt-Räume | Building group (catalog heading). |
| Platforms | Plattformen | Building group (catalog heading). |
| Utility | Utility | Building group (catalog heading). |
| Countermeasures | Abwehr | Building group (catalog heading). |
| Chaos | Chaos | Building group (catalog heading). |

### Lines

Unlock lines. A card of a line can only be drawn if its Unlock Room is deployed (Basic is always open).

| Term | Design term (DE) | Definition |
|---|---|---|
| **Basic** | Basis | Unlock line. Basic is always available; every other line needs its Unlock Room. |
| **Weapons** | Waffen | Unlock line. Basic is always available; every other line needs its Unlock Room. |
| **Arcane** | Arkan | Unlock line. Basic is always available; every other line needs its Unlock Room. |
| **Beast** | Tier | Unlock line. Basic is always available; every other line needs its Unlock Room. |
| **Tech** | Technik | Unlock line. Basic is always available; every other line needs its Unlock Room. |
| **Crypt** | Gruft | Unlock line. Basic is always available; every other line needs its Unlock Room. |
| **Frost** | Frost | Unlock line. Basic is always available; every other line needs its Unlock Room. |
| **Flora** | Flora | Unlock line. Basic is always available; every other line needs its Unlock Room. |
| **Air** | Luft | Unlock line. Basic is always available; every other line needs its Unlock Room. |
| **Blessing** | Segen | Unlock line. Basic is always available; every other line needs its Unlock Room. |
| **Chaos** | Chaos | Unlock line. Basic is always available; every other line needs its Unlock Room. |

### Trajectories

How an Artillery shot travels. Shown in the type line of Artillery cards.

| Term | Design term (DE) | Definition |
|---|---|---|
| **Flat** | Flach | Needs a free Line of Fire. Hits the first solid obstacle on the line. |
| **Arc** | Bogen | Hits any cell in range. Spread applies. Shows a Target Marker 1.2s before impact. |
| **Vertical** | Senkrecht | Like Arc, but Target Marker 2.0s and small spread. Cannot be intercepted by nets. |
| **Piercing** | Durchschlag | Flat. Continues through 2–5 solid obstacles, −20% damage per obstacle. |
| **Burrowing** | Untergrund | Any cell. Damages buildings only. Ignores domes, nets and mirrors. Warning: 0.8s rumble. |
| **Scatter** | Streu | N small hits on random cells in a 3×3 area. |
| **Aerial** | Luft | Like Arc, fired from the air. The shooter can be attacked. |

### Damage types

Written out in rules text ("60 Fire damage"). The sword icon in the stat strip is colored by damage type.

| Term | Design term (DE) | Definition | Abbr. |
|---|---|---|---|
| Impact | Wucht | Damage type. | IMP |
| Fire | Feuer | Damage type. | FIR |
| Ice | Eis | Damage type. | ICE |
| Lightning | Blitz | Damage type. | LTN |
| Poison | Gift | Damage type. | PSN |
| Arcane | Arkan | Damage type. | ARC |

### Armor classes

Unit armor. Abbreviation after HP in the stat strip.

| Term | Design term (DE) | Definition | Abbr. |
|---|---|---|---|
| Flesh | Fleisch | Armor class of a unit (damage multipliers: see GDD §7.3). | FLS |
| Armor | Panzer | Armor class of a unit (damage multipliers: see GDD §7.3). | ARM |
| Spirit | Geist | Armor class of a unit (damage multipliers: see GDD §7.3). | SPR |
| Bone | Knochen | Armor class of a unit (damage multipliers: see GDD §7.3). | BON |
| Pudding | Pudding | Armor class of a unit (damage multipliers: see GDD §7.3). | PUD |

### Materials

Building materials. Written after HP in the stat strip of building cards.

| Term | Design term (DE) | Definition |
|---|---|---|
| Wood | Holz | Building material (damage multipliers: see GDD §7.3). |
| Stone | Stein | Building material (damage multipliers: see GDD §7.3). |
| Metal | Metall | Building material (damage multipliers: see GDD §7.3). |
| Crystal | Kristall | Building material (damage multipliers: see GDD §7.3). |
| Organic | Organisch | Building material (damage multipliers: see GDD §7.3). |
| Ice | Eis | Building material (damage multipliers: see GDD §7.3). |
| Pudding | Pudding | Building material (damage multipliers: see GDD §7.3). |

### Doctrines

Target behavior of Assault units. Shown in the type line; the behavior is NOT repeated on the card.

| Term | Design term (DE) | Definition |
|---|---|---|
| **Hunter** | Jäger | Prefers Civilians, then Defenders, then everything else. |
| **Breaker** | Brecher | Attacks gates, walls and rooms (Structure ×1.0). |
| **Conqueror** | Eroberer | Runs the shortest path to the Core Chamber and occupies it. Fights only when blocked. |
| **Looter** | Plünderer | Is distracted by Loot. Otherwise acts as Hunter. |
| **Bomber** | Sprenger | Runs to the most expensive building and Detonates. |

### Guard zones

Where a Defender stands guard. Shown in the type line.

| Term | Design term (DE) | Definition |
|---|---|---|
| **Gate** | Tor | Guard zone: the gate. |
| **Patrol** | Mitte | Guard zone: roams the yard. |
| **Core** | Kernkammer | Guard zone: the Core Chamber. |

### Targeting priorities

Artillery targeting modes (chosen in the Timestop).

| Term | Design term (DE) | Definition |
|---|---|---|
| **Precision** | Chirurg | Targets the cell with the highest function value. |
| **Breach** | Brecher | Targets the cell that opens Line of Fire fastest. |
| **Core Hunt** | Kernjagd | Targets the Core when reachable, else the cell that exposes it fastest. |
| **Counter-Battery** | Waffenjäger | Targets platforms, towers and shields. |
| **Spray** | Streuer | Targets random cells in range. |

### Status effects

Temporary or permanent conditions on units and buildings.

| Term | Design term (DE) | Definition | Duration |
|---|---|---|---|
| **Burning** | Brennen | Takes 3 Fire damage/s. Spreads to adjacent flammable buildings. Buildings lose 10 HP/s. | 5s |
| **Chilled** | Eisig | −30% speed and attack speed. | 4s |
| **Frozen** | Eingefroren | Unit: Stunned. Building: effect ×0.5. | 2–5s |
| **Slimed** | Schleim | −25% speed. | 4s |
| **Poisoned** | Vergiftet | Takes 4 Poison damage/s, ignores armor class. Healing −50%. | 6s |
| **Stunned** | Betäubt | Cannot act. | 1–4s |
| **Confused** | Verwirrt | Moves and targets randomly. | 3s |
| **Feared** | Furcht | Flees from the source. | 2–4s |
| **Rooted** | Festgehalten | Cannot move. Can attack. | 2s |
| **Frogged** | Frosch | Transformed: HP and attack greatly reduced, no abilities. A Frogged Civilian leaves its post. | 3–6s |
| **Dancing** | Tanzend | Cannot attack. | 2s |
| **Blinded** | Geblendet | Spread ×2. | 8s |
| **Shorted** | Kurzgeschlossen | Building: 0% effect. | 3s |
| **Wet** | Nass | −10% speed. Lightning damage taken ×1.5. Cannot be Burning. | while raining |
| **Blessed** | Gesegnet | Absorbs the next damage (up to 40). | 15s |
| **Hardened** | Gehärtet | +12% max HP, +10% Impact damage. | permanent |
| **Fed** | Satt | +15% max HP. | 40s |
| **Spurred** | Angespornt | +15% attack speed. | while in aura |
| **Cursed** | Verflucht | −25% damage dealt. | 8s |
| **Invisible** | Unsichtbar | Cannot be targeted unless adjacent or revealed. | variable |
| **Swallowed** | Verschluckt | Removed from the field. Cannot act. | 5s |
| **Floating** | Schwebend | −50% speed. Cannot attack. Falls afterwards. | 3s |
| **Rune Skin** | Runenhaut | Ignores the first Stun, Fear or Confusion. +20% Arcane resistance. | permanent |
| **Burrowed** | Eingegraben | Moves underground and cannot be targeted. | until it surfaces |
| **Chaos-born** | Chaosgeboren | Random bonus: ×1.3 damage, ×1.3 HP, +30% speed or 2 HP/s regeneration. | permanent |

### Game terms

Core terms of the rules.

| Term | Design term (DE) | Definition |
|---|---|---|
| **Healing Source** | Heilquelle | Counts for the Retreat rule: a staffed healing building or a living healer. |
| **Treatment Slot** | Behandlungsplatz | Slot in a Healing Source that holds one wounded unit. |
| **Retreat** | Rückzug | Assault units below 50% HP run to the nearest Healing Source if one exists. |
| **Fleeing** | Fliehend | +30% speed. Does not attack. Targeted first by towers and Assault units. |
| **Last Stand** | Todesmut | No Healing Source: fights to the death, +15% damage. |
| **Flying** | Flieger | Crosses walls and traps. Can only be hit by Flying units and towers with range 8 or more. |
| **Loot** | Beute | Distracts Looters. |
| **Block** | Block | Reduces damage taken from the front. |
| **Splash** | Splash | Damages cells within the radius: 50% structure damage; units in the impact room take full damage. |
| **Detonate** | Explodieren | Dies and deals its explosion damage. |
| **Structure** | Strukturfaktor | Damage multiplier against buildings. Default: Assault ×0.4, Breaker ×1.0, Defender and Civilian ×0. |
| **Gun Slot** | Geschützplatz | Platform slot that holds one Artillery unit. A unit needs 1–4 slots. |
| **Target Marker** | Zielschatten | Ground marker that shows an Arc or Vertical impact. Units in the radius flee. |
| **Line of Fire** | Schusslinie | Straight line from shooter to target cell without enemy solid cells or wall segments. |
| **Spread** | Streuung | Random offset of Arc and Vertical shots: 0.4 + 0.04 × distance cells. |
| **Rubble** | Trümmer | Destroyed building or wall: walkable, −30% speed, no function, no cover. |
| **Breach** | Bresche | Destroyed outer wall segment. Acts as an additional entrance. |
| **Crew** | Posten | Staff a building needs to work. Effect scales with filled posts. 0 filled posts: Abandoned. |
| **Abandoned** | Verwaist | A building without crew: 0% effect. |
| **Citizen** | Bürger | Free basic worker. HP 25. Fills open posts automatically. |
| **Squad** | Soll | Target number of living units of a card. |
| **Reinforce** | Nachschub | Units added per wave until the Squad is full. |
| **Roster** | Kontingent | The troop cards a player has deployed (5 slots, up to 8). |
| **Rank** | Rang | Experience level of a unit: Recruit, Private, Veteran, Elite, Hero, Legend. |
| **Talent** | Talent | Special ability unlocked at Rank 3 (Elite). |
| **Core** | Kern | Center of a bastion. At 0 HP its owner loses. |
| **Core Chamber** | Kernkammer | 2×2 room around the Core. Conquest happens here. |
| **Core Yard** | Kernhof | 6×6 starting yard around the Core. |
| **Inner Yard** | Innenhof | Yard reachable only through room doors: yard buildings there are protected. |
| **Outer Yard** | Außenhof | Yard reachable from the gate or a Breach without passing a door. |
| **Conquest** | Eroberung | Win condition: the Conquest Bar of the Core Chamber reaches 100%. |
| **Timestop** | Zeitstopp | Pause after every 2 waves for drawing and building. |
| **Wave** | Welle | Spawn event of all deployed troop cards. |
| **Flammable** | Leicht entflammbar | Catches Burning from Fire damage and spreads it. |
| **Explosive** | Sprengstoff | Explodes when destroyed. |
| **Knockback** | Rückstoß | Pushes the target away from the source by N cells. |
| **Taunt** | Spott | Enemies in range prefer to attack this unit. |
| **Lifesteal** | Lebensraub | Heals the attacker for N% of the damage dealt. |
| **Alarm** | Alarm | State while enemies are inside the bastion: Defender Leash ×2. |
| **Leash** | Leine | Maximum distance a Defender or summoned unit may move from its zone or owner. |
| **Aura** | Aura | Effect on all matching units or buildings within the stated radius or room. Does not stack with itself. |

### Ranks

Experience ranks of units. Rank 3 (Elite) unlocks the Talent.

| Term | Design term (DE) | Definition | XP |
|---|---|---|---|
| Recruit | Rekrut | Rank at 0 XP. –. | 0 |
| Private | Gefreiter | Rank at 50 XP. +10% HP and damage. | 50 |
| Veteran | Veteran | Rank at 140 XP. +20%. | 140 |
| Elite | Elite | Rank at 300 XP. +30% and Talent. | 300 |
| Hero | Held | Rank at 540 XP. +40%. | 540 |
| Legend | Legende | Rank at 900 XP. +50% and aura (+8% damage within 3 cells). | 900 |

---

*140 terms. Bold terms are set in bold automatically on cards.*
