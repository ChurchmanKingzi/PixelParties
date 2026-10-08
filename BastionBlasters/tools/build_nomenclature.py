"""Erzeugt NOMENCLATURE.md aus daten/keywords.json (Tabellen) und den Regeln in diesem Skript.

Die Begriffe werden NUR in daten/keywords.json gepflegt; danach dieses Skript ausführen:
    python3 tools/build_nomenclature.py
"""
from __future__ import annotations

import json
import os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
K = json.load(open(os.path.join(ROOT, 'daten', 'keywords.json'), encoding='utf-8'))

KIND_TITLE = [
    ('card_type', 'Card types', 'Top-level category of a card. Shown in the type line in capitals.'),
    ('build_type', 'Build types', 'How a building occupies the plot. Shown first in the type line of building cards.'),
    ('group', 'Building groups', 'Catalog group of a building. Shown last in the type line.'),
    ('line', 'Lines', 'Unlock lines. A card of a line can only be drawn if its Unlock Room is deployed (Basic is always open).'),
    ('trajectory', 'Trajectories', 'How an Artillery shot travels. Shown in the type line of Artillery cards.'),
    ('damage', 'Damage types', 'Written out in rules text ("60 Fire damage"). The sword icon in the stat strip is colored by damage type.'),
    ('armor', 'Armor classes', 'Unit armor. Abbreviation after HP in the stat strip.'),
    ('material', 'Materials', 'Building materials. Written after HP in the stat strip of building cards.'),
    ('doctrine', 'Doctrines', 'Target behavior of Assault units. Shown in the type line; the behavior is NOT repeated on the card.'),
    ('zone', 'Guard zones', 'Where a Defender stands guard. Shown in the type line.'),
    ('priority', 'Targeting priorities', 'Artillery targeting modes (chosen in the Timestop).'),
    ('status', 'Status effects', 'Temporary or permanent conditions on units and buildings.'),
    ('keyword', 'Game terms', 'Core terms of the rules.'),
    ('rank', 'Ranks', 'Experience ranks of units. Rank 3 (Elite) unlocks the Talent.'),
]

HEAD = '''# Bastion Blasters — Nomenclature

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
4. **Type line, derived from data:** `CARD TYPE · Line · Trajectory | Doctrine | Guard zone` for units, `BUILD TYPE size · Group` for buildings.
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
'''


def esc(s):
    return str(s).replace('|', '\\|')


def main():
    out = [HEAD]
    n = 0
    for kind, title, intro in KIND_TITLE:
        rows = [k for k in K if k['kind'] == kind]
        if not rows:
            continue
        out.append(f'\n### {title}\n\n{intro}\n')
        extra = 'abbr' if kind in ('damage', 'armor') else ('duration' if kind == 'status' else ('xp' if kind == 'rank' else None))
        head = '| Term | Design term (DE) | Definition |'
        sep = '|---|---|---|'
        if extra:
            head += f' {({"abbr": "Abbr.", "duration": "Duration", "xp": "XP"}[extra])} |'
            sep += '---|'
        out.append(head)
        out.append(sep)
        for k in rows:
            label = f"**{k['en']}**" if k['bold'] else k['en']
            line = f"| {label} | {esc(k['de'])} | {esc(k['def'])} |"
            if extra:
                line += f" {esc(k.get(extra, ''))} |"
            out.append(line)
            n += 1
    out.append(f'\n---\n\n*{n} terms. Bold terms are set in bold automatically on cards.*\n')
    path = os.path.join(ROOT, 'NOMENCLATURE.md')
    with open(path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(out))
    print(f'NOMENCLATURE.md: {n} terms')


if __name__ == '__main__':
    main()
