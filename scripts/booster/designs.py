# -*- coding: utf-8 -*-
"""Farbthemen und Inhalte (Cover-Motive) aller Booster-Packs und ihrer Varianten."""

# Farbthemen: grad = senkrechter Foil-Verlauf, pat = Muster, plate = dunkle Schriftplatte, metal = Rahmenmetall,
# burst = (Strahl1, Strahl2, Leuchtmitte) hinter den Motiven, prism = Regenbogen-Schimmer, tint = Funkelfarbe
THEMES = {
    'sunfire':  dict(name='Sunfire',  grad=[(0, '#ffc050'), (.35, '#ff7a1c'), (.7, '#b62600'), (1, '#4a0a00')], pat='diamonds', plate=('#4a0e06', '#1e0402'), metal='gold',
                     burst=('#a41e14', '#ee6428', '#fff0a0'), tint='#fff3a8', prism=False),
    'skyline':  dict(name='Skyline',  grad=[(0, '#bce8ff'), (.4, '#4a9af0'), (.75, '#1a50c8'), (1, '#0c2a6a')], pat='stars', plate=('#0c1a4a', '#050c26'), metal='gold',
                     burst=('#2a62d0', '#78c0ff', '#ffffff'), tint='#ffffff', prism=False),
    'rosebud':  dict(name='Rosebud',  grad=[(0, '#ffd0ea'), (.4, '#ff6ab8'), (.75, '#b82a8a'), (1, '#4a0a4a')], pat='dots', plate=('#4a0a3a', '#220420'), metal='rose',
                     burst=('#c4286a', '#ff7aa8', '#fff0f8'), tint='#fff0f8', prism=False),
    'verdant':  dict(name='Verdant',  grad=[(0, '#d8ffa0'), (.4, '#44d888'), (.75, '#1a8a50'), (1, '#0a3a22')], pat='scales', plate=('#0a3a22', '#041a10'), metal='emerald',
                     burst=('#1a8a50', '#78e8a0', '#f0ffd0'), tint='#f0fff0', prism=False),
    'royal':    dict(name='Royal',    grad=[(0, '#d0b8ff'), (.4, '#8a4af0'), (.75, '#4a1a9a'), (1, '#1a0a3a')], pat='diamonds', plate=('#2a0e5a', '#10062a'), metal='gold',
                     burst=('#4a1a9a', '#a070f0', '#fff0ff'), tint='#f0e0ff', prism=False),
    'noir':     dict(name='Noir',     grad=[(0, '#7a808c'), (.4, '#323840'), (.75, '#14161c'), (1, '#000000')], pat='hex', plate=('#14161c', '#000000'), metal='gold',
                     burst=('#0a0b10', '#2c313c', '#8a90a0'), tint='#fad54a', prism=False),
    'ocean':    dict(name='Ocean',    grad=[(0, '#b8fff0'), (.4, '#22c0d8'), (.75, '#0c5a9a'), (1, '#061a44')], pat='waves', plate=('#06284a', '#020e22'), metal='cyan',
                     burst=('#0c5a9a', '#4cd8e8', '#e8ffff'), tint='#e8ffff', prism=False),
    'desert':   dict(name='Desert',   grad=[(0, '#fff0b0'), (.4, '#e8a838'), (.75, '#9a5a1a'), (1, '#3a1c08')], pat='chevrons', plate=('#3a1c08', '#1a0c04'), metal='bronze',
                     burst=('#9a5a1a', '#f0c060', '#fffbe0'), tint='#fff3c0', prism=False),
    'frost':    dict(name='Frost',    grad=[(0, '#ffffff'), (.4, '#bcd8f4'), (.75, '#5a8ad8'), (1, '#1a3a8a')], pat='stars', plate=('#1a3a7a', '#08143a'), metal='silver',
                     burst=('#5a8ad8', '#d8ecff', '#ffffff'), tint='#ffffff', prism=False),
    'crimson':  dict(name='Crimson',  grad=[(0, '#ff6a60'), (.35, '#c80a1e'), (.7, '#5a0614'), (1, '#140206')], pat='circuit', plate=('#2a0408', '#0c0204'), metal='gold',
                     burst=('#5a0614', '#d01a2a', '#ffb090'), tint='#ffd8c0', prism=False),
    'amethyst': dict(name='Amethyst', grad=[(0, '#f0c8ff'), (.4, '#c04ae8'), (.75, '#6a1aa8'), (1, '#240a44')], pat='scales', plate=('#3a0a5a', '#160624'), metal='violet',
                     burst=('#6a1aa8', '#d070f8', '#fff0ff'), tint='#fff0ff', prism=False),
    'toxic':    dict(name='Toxic',    grad=[(0, '#e8ff80'), (.4, '#8ad818'), (.75, '#2a7a10'), (1, '#0a2a08')], pat='circuit', plate=('#0a2a08', '#041404'), metal='emerald',
                     burst=('#2a7a10', '#b8f040', '#ffffd0'), tint='#f4ffb0', prism=False),
    'forest':   dict(name='Forest',   grad=[(0, '#7aa84a'), (.35, '#2a6a30'), (.7, '#0e3a1c'), (1, '#030f08')], pat='scales', plate=('#0a2a14', '#020a05'), metal='emerald',
                     burst=('#06220f', '#1e6a34', '#b8f0a0'), tint='#d8ffc0', prism=False),
    'golden':   dict(name='Golden',   grad=[(0, '#fff6b0'), (.35, '#fad54a'), (.7, '#c8821c'), (1, '#6a3a08')], pat='diamonds', plate=('#4a2a08', '#1c0e02'), metal='gold',
                     burst=('#b8741c', '#fad54a', '#fffbe0'), tint='#ffffff', prism=False),
    'platinum': dict(name='Platinum', grad=[(0, '#ffffff'), (.4, '#d4d8e4'), (.75, '#8a90a0'), (1, '#40444e')], pat='diamonds', plate=('#2a2e38', '#0c0e12'), metal='silver',
                     burst=('#8a90a0', '#f0f2f8', '#ffffff'), tint='#ffffff', prism=True),
    'prism':    dict(name='Prism',    grad=[(0, '#fff0f8'), (.3, '#a8e0ff'), (.6, '#d8a8ff'), (1, '#6a4ac8')], pat='stars', plate=('#241a5a', '#0c0824'), metal='silver',
                     burst=('#6a4ac8', '#a8e0ff', '#ffffff'), tint='#ffffff', prism=True),
    'ember':    dict(name='Ember',    grad=[(0, '#ffd890'), (.35, '#e8541c'), (.7, '#780a0a'), (1, '#1c0404')], pat='scales', plate=('#3a0808', '#140202'), metal='gold',
                     burst=('#780a0a', '#ee6428', '#fff0a0'), tint='#fff0a0', prism=True),
}

# Titel in zwei Zeilen
TITLES = {
    'ability':   ('Ability', 'Pack'),
    'hero':      ('Hero', 'Pack'),
    'clash':     ('Clash of', 'Heroes'),
    'monia':     ('Rise of', 'Monia'),
    'future':    ('Dreadful', 'Future'),
    'world1':    ('Around the', 'World 1'),
    'world2':    ('Around the', 'World 2'),
    'community': ('Community', 'Pack'),
    'trials':    ('Trials and', 'Tribulations'),
}
TITLE_FULL = {
    'ability': 'Ability Pack', 'hero': 'Hero Pack', 'clash': 'Clash of Heroes', 'monia': 'Rise of Monia', 'future': 'Dreadful Future',
    'world1': 'Around the World 1', 'world2': 'Around the World 2', 'community': 'Community Pack', 'trials': 'Trials and Tribulations',
}

# Sets, aus denen die Mosaik-Cover ihre Vertreter holen (Reihenfolge = Kachelreihenfolge)
MOSAIC_SETS = {
    'world1': ['MS1', 'MSAZ', 'MSEG', 'MSGB'],
    'world2': ['MSIN', 'MSHW', 'MSRU', 'MSJP', 'MSCH'],
    'trials': ['ART', 'THW', 'WAW', 'SOB', 'SOD', 'CROSS', 'DIB', 'ASQ', 'CRESTMAS'],
}
STAMP = {'MS1': 'MS1', 'MSAZ': 'AZ', 'MSEG': 'EG', 'MSGB': 'GB', 'MSIN': 'IN', 'MSHW': 'HW', 'MSRU': 'RU', 'MSJP': 'JP', 'MSCH': 'CH',
         'ART': 'ART', 'THW': 'THW', 'WAW': 'WAW', 'SOB': 'SOB', 'SOD': 'SOD', 'DD': 'DD', 'GBT': 'GBT', 'CROSS': 'CRS', 'DIB': 'DIB', 'ASQ': 'ASQ', 'CRESTMAS': 'XMS'}

GN = '/home/user/pixelpartiessprites/_effects/MotiveGN/'
FILE = lambda p: 'file:' + GN + p

# Varianten: (Vorlage, Thema, Inhalt). Nur Hero Packs (und Cool Rescuer Monia auf Rise of Monia) zeigen einen einzelnen Helden; hero = ein Held auf Strahlenkranz, scene (eine große Kartenkunst, optional eine Figur),
# focus (große Kartenkunst + drei Kacheln), grid (3x3 Kacheln), mosaic (ein Vertreter je Set).
# Jedes Motiv kommt im ganzen Satz höchstens einmal vor.
VARIANTS = {
    'ability': [
        ('focus', 'sunfire',  dict(big='Fighting', tiles=['Destruction Magic', 'Alchemy', 'Leadership'])),
        ('focus', 'verdant',  dict(big='Alchemy', tiles=['Decay Magic', 'Magic Arts', 'Wealth'])),
        ('focus', 'royal',    dict(big='Leadership', tiles=['Diplomacy', 'Charme', 'Training'])),
        ('focus', 'crimson',  dict(big='Destruction Magic', tiles=['Fighting', 'Resistance', 'Interference'])),
        ('grid',  'noir',     dict(tiles=['Fighting', 'Alchemy', 'Leadership', 'Destruction Magic', 'Decay Magic', 'Support Magic', 'Magic Arts', 'Divinity', 'Training'])),
        ('focus', 'skyline',  dict(big='Magic Arts', tiles=['Support Magic', 'Divinity', 'Singing'])),
        ('grid',  'prism',    dict(tiles=['Hunting', 'Trade', 'Wealth', 'Luck', 'Navigation', 'Toughness', 'Terror', 'Wisdom', 'Learning'])),
        ('focus', 'amethyst', dict(big='Biomancy', tiles=['Cannibalism', 'Premonition', 'Terror'])),
    ],
    'hero': [
        ('hero', 'rosebud',  dict(hero='Cute Angel Molinda')),
        ('hero', 'crimson',  dict(hero='Ida, the Adept of Destruction')),
        ('hero', 'noir',     dict(hero='Alleria, the Queen of Spiders')),
        ('hero', 'forest',   dict(hero='Arthor, the King of Blackport')),
        ('hero', 'sunfire',  dict(hero='Bomb Berserker Bartas')),
        ('hero', 'amethyst', dict(hero='Alice, the Puppeteer Girl')),
        ('hero', 'golden',   dict(hero='Treasure Huntress Semi')),
        ('hero', 'platinum', dict(hero='Monia Bot, the Foretold Rescuer of Coolness')),
    ],
    'clash': [
        ('scene', 'sunfire',  dict(window='Fireball')),
        ('scene', 'skyline',  dict(window='Chain Lightning')),
        ('focus', 'desert',   dict(big='Treasure Chest', tiles='auto')),
        ('scene', 'ember',    dict(window='Flame Avalanche')),
        ('grid',  'royal',    dict(tiles='auto')),
        ('scene', 'frost',    dict(window='Elixir of Cold')),
        ('focus', 'noir',     dict(big='The Sun Sword', tiles='auto')),
        ('grid',  'rosebud',  dict(tiles='auto')),
    ],
    'monia': [
        ('hero',  'skyline',  dict(hero='Cool Rescuer Monia')),
        ('scene', 'rosebud',  dict(window='The Final Trial')),
        ('scene', 'sunfire',  dict(window='Cute Phoenix')),
        ('scene', 'prism',    dict(window='Flying Island in the Sky')),
        ('grid',  'royal',    dict(tiles='auto')),
        ('focus', 'ocean',    dict(big='Singing', tiles='auto')),
        ('scene', 'amethyst', dict(window='Army of the Cute')),
        ('grid',  'platinum', dict(tiles='auto')),
    ],
    'future': [
        ('scene', 'ember',    dict(window='Armageddon')),
        ('scene', 'sunfire',  dict(window='Ifrit')),
        ('scene', 'desert',   dict(window='Guardian Beast Tu')),
        ('scene', 'noir',     dict(window='Lunatic Golem')),
        ('scene', 'royal',    dict(window='Lunar Eclipse')),
        ('focus', 'ocean',    dict(big='Deepsea Castle', tiles='auto')),
        ('grid',  'crimson',  dict(tiles='auto')),
        ('grid',  'forest',   dict(tiles='auto')),
    ],
    'world1': [(('mosaic'), t, {}) for t in ('desert', 'skyline', 'ember', 'verdant', 'royal', 'ocean', 'platinum', 'prism')],
    'world2': [(('mosaic'), t, {}) for t in ('rosebud', 'ocean', 'crimson', 'amethyst', 'sunfire', 'verdant', 'frost', 'prism')],
    'trials': [(('mosaic'), t, {}) for t in ('royal', 'sunfire', 'verdant', 'noir', 'skyline', 'crimson', 'platinum', 'prism')],
    'community': [
        ('scene', 'ocean',    dict(window='Aurora Borealis')),
        ('grid',  'prism',    dict(tiles='auto')),
        ('scene', 'amethyst', dict(window='Greatmaw Siren')),
        ('focus', 'noir',     dict(big='Divine Punishment', tiles='auto')),
        ('scene', 'sunfire',  dict(window='The Fifth Circle of Hell')),
        ('grid',  'verdant',  dict(tiles='auto')),
        ('scene', 'rosebud',  dict(window='Liquid Luck')),
        ('focus', 'royal',    dict(big='Golden Ankh', tiles='auto')),
    ],
}
