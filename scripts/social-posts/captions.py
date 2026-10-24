#!/usr/bin/env python3
"""Erzeugt die Caption-Vorschläge (Englisch) für alle Reels.

    python3 scripts/social-posts/captions.py

Schreibt scripts/social-posts/captions.md (alle Texte, zum Überarbeiten) und je Reel eine Datei
scripts/social-posts/out/reels/<slug>.txt (Caption zum Einfügen + Alt-Text).

Die Texte stehen unten in HEROES. Jede Aussage folgt dem Kartentext aus data/cards.json; über das Spiel selbst steht nur,
was belegt ist: Online-Kartenspiel, fast 200 animierte Heroes (laut Daten 198) und „free" (vom Auftraggeber bestätigt).
NICHT behauptet wird z. B. „no download" oder Spielerzahlen. Der Link steht in der Bio, denn Links in Instagram-Beschreibungen
sind nicht klickbar.
"""
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / 'out' / 'reels'

BASE_TAGS = '#PixelParties #TCG #CardGame #PixelArt #IndieGame #TradingCardGame #FreeToPlay'

CTAS = [
    "Pixel Parties is a free online TCG about assembling your party of Heroes and annihilating your opponent's party!\n👉 Play for free: pixelpartiestcg.com (link in bio)",
    "Assemble your party of Heroes, then annihilate your opponent's! Pixel Parties is a free online TCG with almost 200 animated pixel Heroes.\n👉 pixelpartiestcg.com (link in bio)",
    "Pick your Heroes, build your party, crush the other side. That's Pixel Parties, the free online TCG!\n👉 Play for free: pixelpartiestcg.com (link in bio)",
    "One of almost 200 animated Heroes you can lead into battle in Pixel Parties, the free online TCG where parties clash!\n👉 pixelpartiestcg.com (link in bio)",
]

# Kartenname: (Aufhänger, Beschreibung der Fähigkeit, Alt-Text-Zusatz, zusätzliche Hashtags)
HEROES = {
    "Cool Rescuer Monia": (
        "Meet Monia, the face of Pixel Parties. 💙🚀",
        "Cool Rescuer Monia swoops in on her jetpack. Once per turn, when Creatures of either player would be affected by a card or effect, she can discard 1 card to negate that effect on all Creatures.",
        "drifting white clouds, floating hearts, glints and falling jet sparks",
        "#Heroine #Jetpack"),
    "Alleria, the Queen of Spiders": (
        "Redirect the attack. Spring the trap. 🕷️",
        "Once per turn, Alleria can redirect an opponent's single-target Attack, Spell or Creature effect to one of your Heroes that has a Surprise waiting. The damage then can't be reduced or negated, except by a Surprise. And whenever a Surprise in her own Surprise Zone activates, you draw a card.",
        "spiders dangling on silk threads and drifting purple poison gas",
        "#DarkFantasy #Spiders"),
    "Andras, the Human Weapon": (
        "Hit one target. Then hit another. 🔥",
        "When Andras hits exactly one target with a normal Attack whose original level is lower than his Fighting level, you may choose a second target for the Attack to hit afterwards. The Human Weapon lives up to his name.",
        "jet flames, embers and smoke",
        "#Warrior #FantasyArt"),
    "Argos, the Eye of the Cosmos": (
        "Your opponent's hand feeds the void. 👁️",
        "Argos collects a Change Counter for every card in your opponent's hand. Then you can cash them in once per turn to place a \"Cosmic Depths\" Creature of that level straight into his Support Zone.",
        "black fog, floating red eyes and stars",
        "#DarkFantasy #Cosmic"),
    "Arthor, Inheritor of the Barbarian Sword": (
        "Once per turn: 300 damage to any target. ⚔️",
        "Arthor ascends on top of \"Arthor, the King of Blackport\" once he is equipped with the Legendary Sword of a Barbarian King and a Summoning Circle. Then, once per turn, he can deal 300 damage to any target. It counts as an Attack.",
        "a blood-red column, blood mist and drifting drops",
        "#DarkFantasy #Barbarian"),
    "Arthor, the King of Blackport": (
        "Every Spell costs your opponent a card. 🏴‍☠️",
        "Whenever the King of Blackport casts a Spell while your opponent holds more than 1 card, they must discard a card of their choice. If he is equipped with \"The White Eye\", they must discard 2 cards instead.",
        "gold coins, sea bubbles and golden sparkles",
        "#Pirates #FantasyArt"),
    "Baaliel, the Demon General": (
        "A general who commands demons. 😈",
        "Baaliel can summon \"Horned Demon\" Creatures regardless of their level, and once per turn such a summon counts as an additional Action. Whenever a target is defeated, every Horned Demon on the board gets a Demon Counter.",
        "bats, embers and dark smoke",
        "#Demon #DarkFantasy"),
    "Bakhm, the Desert Digger": (
        "Traps in the sand. 💀",
        "Bakhm's Support Zones can double as Surprise Zones for face-down Surprise Creatures. And whenever a Surprise is activated, you choose a target and deal 100 damage to it.",
        "swirling desert dust and scattered bones",
        "#Desert #DarkFantasy"),
    "Beato, the Butterfly Witch": (
        "Any level 1 Spell. Any level 1 Creature. 🦋",
        "Beato can use any level 1 Spell and Creature. And she is only the first step: use all 5 Spell Schools, and she can ascend into the Eternal Butterfly.",
        "golden butterflies and golden sparkles",
        "#Witch #Butterfly"),
    "Beato, the Eternal Butterfly": (
        "Every Spell. Every Creature. No limits. 🦋",
        "After using all 5 Spell Schools, Beato ascends from the Butterfly Witch: add up to 2 different Spells or Creatures from your deck to your hand, and from then on she can use any Spell or Creature, regardless of level or school.",
        "golden butterflies, golden light beams and sparkles",
        "#Witch #Butterfly"),
    "Bomb Berserker Bartas": (
        "One spell. Two targets. 💥",
        "When Bomb Berserker Bartas hits exactly one target with a normal Destruction Magic Spell whose original level is lower than his Destruction Magic level, you may choose a second target for it to hit afterwards. A Super Rare that turns every blast into a double hit.",
        "fireballs, explosions and smoke",
        "#Explosion #FantasyArt"),
    "Bow Sniper Darge": (
        "Every arrow counts. 🏹",
        "When Darge hits exactly one target with an Attack, the damage goes up by 50 for each \"Arrow\" Artifact you play in Reaction to it. The bonus is unaffected by effects that double damage.",
        "arrows flying across the card and drifting dust",
        "#Archer #FantasyArt"),
    "Calamitusk, the Chaorc War Chief": (
        "Sacrifice one Creature, summon a Chaorc. 🪓",
        "Once per turn, you may sacrifice a Creature you control that was not summoned this turn to summon a \"Chaorc\" Creature with a different name from your hand or deck as an additional Action. That Chaorc has its level reduced by 1.",
        "embers, dust and dark smoke",
        "#Orc #WarChief"),
    "Champion, the Stormbringer": (
        "Shake up both hands. ⚡",
        "Spend your Action to discard up to 5 cards from your hand and draw that many. Then your opponent must discard the same number of cards and draw that many, and this draw cannot be prevented. Once per turn.",
        "lightning bolts, storm clouds and falling rain",
        "#Lightning #Storm"),
    "Chaos-Diamond, the Cracked Keeper": (
        "Fifteen Spells. One cracked keeper. 💎",
        "As a starting Hero, Chaos-Diamond needs a Potion Deck of exactly 15 Spells with different names. Spend your Action to reveal its top 2 cards and have him perform them in order as additional Actions, regardless of their levels.",
        "pink crystal shards, sparkles and shadow mist",
        "#Crystals #DarkFantasy"),
    "Cute Annoyance Mini": (
        "Discard a card, find a cute friend. 🐾",
        "Once per turn, discard 1 card to search your deck for a \"Cute\" Creature. Discard 1 more, and Mini immediately summons it as an additional Action.",
        "floating hearts and pink sparkles",
        "#Cute #Kawaii"),
    "Damus, the Prophet of Apocalypse": (
        "The Prophet of Apocalypse brings fire. 🔥",
        "Damus places \"Ifrit\" Creatures into your Heroes' free Support Zones and shields them from your opponent's cards and effects. Every Ifrit you control also makes the \"Armageddon\" Spells in your hand cheaper.",
        "embers, ash and smoke",
        "#Prophet #FireMagic"),
    "Ghuanjun, the Undead Martial Artist": (
        "Two attacks in one turn. 🥋",
        "Ghuanjun can perform up to 2 Attacks as additional Actions, but then none of your other Heroes can act this turn. Targets he hits can't drop below 1 HP until the end of the turn.",
        "floating skulls, grave crosses and green ghostly mist",
        "#MartialArts #Undead"),
    "Null, the Mage Slayer": (
        "Negate everything it hits. 🚫",
        "Null's Attacks negate the effects of every target they hit for 2 turns. It counts as a status effect, and he brings 100 Attack to the fight.",
        "purple lightning, dark mist and sparks",
        "#Armor #DarkFantasy"),
    "Hel, the Bound Specter": (
        "Bound to a single Artifact. 👻",
        "At the start of the game, Hel equips an Artifact from your deck for free. If it is lost, you must re-equip one with the same name by paying its cost at the end of your turn, or she is defeated. While equipped this way, she takes half damage.",
        "pale spectral mist, ghostly flames and floating orbs",
        "#Ghost #DarkFantasy"),
    "Idej Lord Daiyo": (
        "100 HP. 120 ATK. Three projections. 🌸",
        "At the start of the game, Daiyo searches your deck for up to 3 \"Idej Projection\" cards and attaches them to himself. A glass cannon with a lot of help.",
        "falling cherry blossom petals and green spirit mist",
        "#Samurai #CherryBlossom"),
    "Kit, the Shark Researcher": (
        "Every Ability opens a new option. 🦈",
        "Whenever an Ability is attached to Kit, you may reveal a Creature from your deck and pick an effect: add it to your hand, make your opponent choose 2 targets to take 50 damage, or make them discard a random card. Each effect once per turn.",
        "fish swimming across the card, bubbles and water",
        "#Shark #Ocean"),
    "Klaus, the Cult Leader": (
        "A Spell, then a servant. 🔮",
        "When Klaus uses a Decay Spell, you may immediately place a Creature from your hand with a lower level than that Spell into one of his free Support Zones.",
        "dark mist, red embers and sparks",
        "#Cult #DarkFantasy"),
    "Layn, Defender of Deri": (
        "Every Creature gets tougher. 🛡️",
        "Any Creature you summon gets +100 current and max HP. A defender in the truest sense.",
        "golden motes, small crowns and sparkles",
        "#Knight #Defender"),
    "Layn, Master of Deri's Relic": (
        "The Earth-Shattering Hammer returns. 🔨",
        "Layn ascends on top of \"Layn, Defender of Deri\" once he is equipped with \"Earth-Shattering Hammer, Relic of Deri\". Then, once per turn, he places up to 3 level 1 Creatures with the same name from your discard pile into free Support Zones.",
        "golden gems, orbs and sparkles",
        "#Knight #Relic"),
    "Lilly, the Charming Infiltrator": (
        "Steal a card, draw a card. 🗝️",
        "Whenever you add a card from your opponent's deck or hand to your hand, Lilly lets you draw 1 card.",
        "floating hearts, gold coins and pink sparkles",
        "#Cute #Charm"),
    "Luna Pele, the Flame Dancer": (
        "Poison that burns forever. 🔥",
        "Whenever a target is Poisoned, it is also Burned for the rest of the game. And up to 4 times per turn, when a target is Burned, you draw a card.",
        "rising flames, embers and sparks",
        "#FireMagic #Dancer"),
    "Mao, the Vengeful Guardian": (
        "Fuel a guardian with the discard piles. 🐾",
        "Once per turn, choose a \"Guardian Beast\" Creature you control that was summoned this turn. Delete 5 cards total from both discard piles to immediately activate its active effect. Its effects are negated until the beginning of your next turn afterwards.",
        "red claw slashes, dark mist and sparks",
        "#Guardian #DarkFantasy"),
    "Mary Crestmas": (
        "A gift for you. A gift for them. 🎄",
        "Whenever you add cards from your hand to your opponent's hand, Mary lets you draw the same number of cards. And once per turn, she can negate damage by forcing your opponent to discard a card originally owned by you.",
        "falling snowflakes, music notes and golden sparkles",
        "#Christmas #Winter"),
    "Maya, the Nature Fairy": (
        "Every Creature makes your Heroes tougher. 🌿",
        "Whenever a Creature is placed into one of your Heroes' Support Zones, you may choose a target you control and increase its current and max HP by 50.",
        "drifting leaves, flower petals and glowing green motes",
        "#Fairy #Nature"),
    "Nao, the Barrier Priestess": (
        "What if healing had no limit? ✨",
        "When Nao heals a Hero, she can restore HP beyond their maximum, while the maximum itself stays unchanged. Build a wall of HP and let your opponent try to break through.",
        "beams of golden light, drifting feathers and sparkles",
        "#Priestess #HolyMagic"),
    "Nero Zira, the Mastermind": (
        "Every Creature adds 30 Attack. 🤖",
        "Up to 5 times per turn, when a Creature is placed into one of your Heroes' Support Zones, Nero Zira permanently gains 30 Attack.",
        "turning gears, blue lightning and sparks",
        "#Robot #Inventor"),
    "Orthos, the Loyal Guard Dog": (
        "One loyal friend calls another. 🐕",
        "Once per turn, if Orthos summons a \"Loyal\" Creature, you may immediately have it summon a second \"Loyal\" Creature from your hand as an additional Action.",
        "rising flames, embers and smoke",
        "#Hellhound #Dog"),
    "Reiza, the Chief Tormentor": (
        "Stun. Poison. Double action. 🦇",
        "Whenever Reiza hits exactly one target with an Attack, it is Stunned for 1 turn and receives 1 Stack of Poison. If all targets your opponent controls are Poisoned, she can perform a second Action every turn.",
        "bats, blood drops and dark mist",
        "#Vampire #DarkFantasy"),
    "Santa Klaus": (
        "A present for your opponent. 🎅",
        "Whenever Santa Klaus uses an Attack or Spell, you must add 2 cards from your hand to your opponent's hand. Merry Christmas?",
        "falling snowflakes, candy canes and golden sparkles",
        "#Christmas #SantaClaus"),
    "Silent Water Mizune": (
        "Cash in a Surprise, draw cards. 💧",
        "Once per turn, send a Surprise from your side of the board to the discard pile to draw a card. Draw another if the Surprise was in a Zone of a Hero that could activate it, and another if it was face-up.",
        "water bubbles, rising droplets and sparkles",
        "#Water #FantasyArt"),
    "Siphem, the Deepsea Demon": (
        "Return cards, unleash the deep. 🌊",
        "Whenever you return cards from your side of the board to your hand, Siphem gains a Deepsea Counter. Once per turn, remove any number of them to deal 50 damage per counter to a target.",
        "dark deep-sea water, bubbles and glowing plankton",
        "#Deepsea #Demon"),
    "Sol Rym, the Thunder Djinn": (
        "Chain Lightning at any level. ⚡",
        "Sol Rym can use the Spell \"Chain Lightning\" regardless of its level. The catch: he can never perform more than 1 Action per turn.",
        "lightning bolts and dark storm clouds",
        "#Lightning #Djinn"),
    "Stellan, the Calm Cat": (
        "Calm, until something touches him. 🐱",
        "Once per turn, when Stellan is affected by an opponent's card or effect or takes damage, you may immediately place up to 3 level 0 Creatures with different names from your hand, or 1 level 0 Creature from your deck, into his free Support Zones.",
        "paw prints, floating hearts and sparkles",
        "#Cat #Cute"),
    "Taio, Absorber of the Mountain's Heart": (
        "The Sun Sword rises. ☀️",
        "Taio ascends on top of \"Taio, the Sun Fencer\" once he is equipped with \"The Sun Sword\" and has defeated an opposing Hero with an Attack or Destruction Magic Spell. Once per turn, he can follow an Attack with a Destruction Magic Spell, or the other way around, as an additional Action.",
        "rising flames, embers and desert dust",
        "#Fire #Swordsman"),
    "Taio, the Sun Fencer": (
        "More Artifacts, more power. ☀️",
        "While Taio has an Artifact with a cost of 10 or more equipped, his Destruction Spells are reduced in level by his Fighting level. And he gains 20 Attack for every Artifact equipped to him.",
        "golden light beams, flames and sparkles",
        "#Fire #Swordsman"),
    "Tarleinn the Traveler": (
        "Every Spell heals a friend. 🎵",
        "Once per turn, when a Hero you control with two or more different Spell Schools uses a Spell, you may choose a target you control and heal its HP by 40, 80 or 150, depending on the Spell's level.",
        "music notes, flower petals and golden sparkles",
        "#Bard #Traveler"),
    "Archibald, the Archmage": (
        "Discard a Spell, cast it anyway. 🧙",
        "Once per turn, when you discard a Normal Spell from your hand, Archibald may use it immediately as an additional Action, at +1 level. He can never perform 2 of the same Spell in one turn.",
        "arcane orbs, sparkles and magic dust",
        "#Wizard #Archmage"),
    "Thep, the Court Scribe": (
        "Souls get a second life. 📜",
        "Once per turn, Thep brings a \"Soul Shard\" Creature back from your discard pile, one that was not sent there this turn, into one of his free Support Zones.",
        "falling feathers, ink drops and golden motes",
        "#Scribe #Quill"),
    "Thorad, Strength of Coolness": (
        "Cool Stack, hot damage. ⚡",
        "Any damage Thorad deals to a single target with Attacks or Spells is increased by 40 for each card in your Coolness Stack.",
        "lightning bolts, storm clouds and sparks",
        "#Thunder #Lightning"),
    "Timeless King Zi": (
        "Let your opponent choose your Spell. ⏳",
        "Spend your Action to reveal 3 Spells with different names and total levels of 6 or less from your deck. Your opponent picks one, Zi performs it regardless of its level, and the other Spells are deleted.",
        "turning gears, arcane orbs and golden sparkles",
        "#King #Time"),
    "Toras, Master of all Weapons": (
        "More weapons, more power. 🗡️",
        "Toras gains 40 Attack for every Artifact with a different name equipped to him. But he can never hit more than 1 target with an Attack.",
        "floating swords, sparks and dust",
        "#Swordsman #Weapons"),
    "Vacarn, the Dark Goblin Necromancer": (
        "Skeletons that strike first. 💀",
        "\"Skeleton\" Creatures Vacarn summons with Necromancy keep their effects and may use their active effects the turn they're summoned. But Creatures in his Support Zones that are defeated are deleted.",
        "purple soul mist, floating skulls and glowing orbs",
        "#Necromancer #Goblin"),
    "Victorica, the Eternal Empress": (
        "An empress against pollution. 👑",
        "Once per turn, Victorica removes a Pollution Token from your side of the board that was not placed there this turn.",
        "golden motes, floating crowns and red gems",
        "#Empress #Royalty"),
    "Cute Princess Mary": (
        "Only cute Creatures. Any level. 👑",
        "Cute Princess Mary can summon \"Cute\" Creatures regardless of their levels. The catch: she can't summon any other Creatures. Pure cuteness, no exceptions.",
        "flaming embers, floating golden crowns, hearts and golden sparkles",
        "#Princess #Cute"),
    "Zsos'Ssar, the Serpent Warlord": (
        "Poison your own team to hit harder. 🐍",
        "Zsos'Ssar deals +40 extra damage for every poisoned target on the board. The catch: every Decay spell he casts forces you to poison one of your own Heroes first. Risky? Absolutely.",
        "drifting purple poison gas",
        "#Snake #Poison"),
    "Xiong, the Bamboo Guardian": (
        "Every defeat is a loot. 🎋",
        "Whenever Xiong defeats a target with an Attack, you may choose a card from either player's discard pile and add it to your hand.",
        "falling bamboo leaves and green motes",
        "#Bamboo #Guardian"),
    "Bubbles, the Bouncy Bunny": (
        "Take the hit for everyone. 🐰",
        "You may redirect any damage Creatures would take to Bubbles. If she is defeated by redirected damage, you draw until you have 7 cards in your hand.",
        "colorful bubbles, sparkles and floating hearts",
        "#Bunny #Cute"),
}


# TikTok-Beschreibungen (kürzer als bei Instagram: Aufhänger, Fähigkeit in einem Satz, Adresse als Text, 5 Hashtags). Link auf TikTok:
# auf einem Privatkonto erst ab 1.000 Followern klickbar, deshalb steht die Adresse im Text. Fähigkeiten folgen dem Kartentext.
TIKTOK_TAGS = '#tcg #cardgame #pixelart #indiegame #freetoplay'
TIKTOK = {
    "Cool Rescuer Monia": ("Meet Monia, the face of Pixel Parties 💙🚀",
                           "Once per turn: discard 1 card and negate an effect on ALL Creatures."),
    "Bomb Berserker Bartas": ("One spell. Two targets. 💥",
                              "Hit exactly one target with a lower-level Destruction Magic Spell and you may pick a second target for it."),
    "Nao, the Barrier Priestess": ("What if healing had no limit? ✨",
                                   "Nao's healing can go beyond a Hero's max HP, while the max itself stays unchanged."),
    "Cute Princess Mary": ("Only cute Creatures. Any level. 👑",
                           "Mary summons \"Cute\" Creatures regardless of their levels. The catch: no other Creatures, ever."),
    "Zsos'Ssar, the Serpent Warlord": ("Poison your own team to hit harder. 🐍",
                                       "+40 damage for every poisoned target on the board. The catch: each Decay spell makes you poison one of your own Heroes first."),
    "Beato, the Butterfly Witch": ("Any level 1 Spell. Any level 1 Creature. 🦋",
                                   "Use all 5 Spell Schools and Beato ascends into the Eternal Butterfly."),
    "Bakhm, the Desert Digger": ("Traps in the sand. 💀",
                                 "His Support Zones double as Surprise Zones, and every activated Surprise lets you deal 100 damage to a target."),
    "Cute Annoyance Mini": ("Discard a card, find a cute friend. 🐾",
                            "Once per turn, discard 1 card to search your deck for a \"Cute\" Creature. Discard 1 more and Mini summons it as an extra Action."),
}


def tiktok(name):
    hook, body = TIKTOK[name]
    return f"{hook}\n{body}\nFree online pixel TCG → pixelpartiestcg.com\n{TIKTOK_TAGS}"


def slugify(n):
    return re.sub(r'^-+|-+$', '', re.sub(r'[^a-z0-9]+', '-', n.lower()))


def build(name, i):
    i = 0 if name == 'Cool Rescuer Monia' else i
    hook, body, alt_bits, tags = HEROES[name]
    cap = f"{hook}\n\n{body}\n\n{CTAS[i % len(CTAS)]}\n\n{BASE_TAGS} {tags}"
    alt = f"Animated pixel art trading card of {name}, a blue-haired girl flying on a flaming jetpack, with {alt_bits} around her." if name == 'Cool Rescuer Monia' else f"Animated pixel art trading card of {name}, with {alt_bits} around the hero."
    return cap, alt


def main():
    import importlib.util
    spec = importlib.util.spec_from_file_location('bb', HERE / 'build-batch.py')
    bb = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(bb)
    rows = bb.heroes_with_music()
    missing = [r['name'] for r in rows if r['name'] not in HEROES]
    extra = [n for n in HEROES if n not in {r['name'] for r in rows}]
    assert not missing, f'ohne Caption: {missing}'
    assert not extra, f'Caption ohne Reel: {extra}'
    lines = [
        '# Captions für alle Reels (Entwürfe, Englisch)',
        '',
        f'{len(rows)} Heroes mit Musikstück (Monia mit eigenem Stück, Mary mit dem Theme ihres Archetyps „Cute“). Je Reel liegt dieselbe Caption als Textdatei neben dem Video '
        '(`scripts/social-posts/out/reels/<slug>.txt`), zum direkten Einfügen. Erzeugt von `captions.py`; dort lassen sich die Texte ändern.',
        '',
        'Hinweise:',
        '',
        '- Links in Instagram-Beschreibungen sind **nicht klickbar**. `pixelpartiestcg.com` muss in der Profil-Bio stehen; die Texte verweisen darauf („link in bio").',
        '- Der erste Satz ist der Aufhänger: Instagram zeigt nur die ersten etwa 125 Zeichen, bevor „mehr" erscheint.',
        '- Jede Fähigkeit folgt dem Kartentext (`data/cards.json`). Über das Spiel steht nur „free", „online", „TCG" und „almost 200 animated pixel Heroes". „Free" ist vom Auftraggeber bestätigt. Nicht behauptet wird z. B. „no download" oder eine Spielerzahl.',
        '- Die vier Aufruf-Varianten wechseln sich ab, damit nicht jeder Beitrag gleich endet.',
        '- Cover: `<slug>.png` neben dem Video (fertiges Bild nach dem Einblenden).',
        '',
        '---',
        '',
    ]
    OUT.mkdir(parents=True, exist_ok=True)
    special = {'Cool Rescuer Monia': 0, 'Cute Princess Mary': 1}                  # feste Aufruf-Variante, damit sich die Texte der übrigen Heroes nicht verschieben
    others = [r for r in rows if r['name'] not in special]
    for r in rows:
        i = others.index(r) if r in others else special[r['name']]
        cap, alt = build(r['name'], i)
        lines += [f"## {r['name']}", '', f"Datei: `{r['slug']}.mp4`", '', '**Caption**', '']
        lines += ['> ' + ln if ln else '>' for ln in cap.split('\n')]
        lines += ['', f'**Alt-Text**: {alt}', '', '---', '']
        (OUT / f"{r['slug']}.txt").write_text(f"{cap}\n\n--- Alt-Text ---\n{alt}\n", encoding='utf-8')
        if r['name'] in TIKTOK:
            (OUT / f"{r['slug']}-tiktok.txt").write_text(tiktok(r['name']) + '\n', encoding='utf-8')
    (HERE / 'captions.md').write_text('\n'.join(lines), encoding='utf-8')
    print(len(rows), 'Captions geschrieben')


if __name__ == '__main__':
    main()
