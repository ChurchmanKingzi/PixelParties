# Sleeve-Entwürfe – Runde 6: Gegner-Sleeves

Jeder der 44 CPU-Gegner (Sample-/Structure-Decks) hat eine eigene Sleeve: Er spielt selbst damit, und wer ihn
**fünfmal besiegt**, schaltet sie frei (Logik: `cpu-sleeves.js`, Zuordnung: `data/shop/cpu-sleeves.json`).
Gegner-Sleeves sind nicht käuflich und stehen deshalb nicht in `sleeve-names.json`; im Shop erscheinen sie im
Reiter „🏆 Opponent Sleeves“ mit Fortschrittsanzeige.

Regeln: `BRIEF.md` (+ `../runde4/BRIEF.md`, `../runde5/BRIEF.md`), Ideen: `concepts.md`, Notizen je Block:
`notes_A.md` … `notes_H.md`. Rohbilder `NN_name.png`, gerahmt in `final/`, Übersichten `00_overview.png` /
`00_overview_final.png`, Skripte `generator/sNN_*.py`.
Rahmen + Shop: `generator/build_frames_r6.py` (erzeugt `frames_r6.json` aus den Notizen) und
`generator/frame_r6.py` (rahmt, kopiert nach `data/shop/sleeves/` und schreibt `data/shop/cpu-sleeves.json`).

| Nr | Name | Gegner | Held | Shop-Datei | Rahmen |
|---|---|---|---|---|---|
| 01 | Searing Grace | Heal Burn | Nao, the Barrier Priestess | searing-grace.png | ornate/gold/ruby/topaz |
| 02 | Blast Radius | Suicide Bombers | Bomb Berserker Bartas | blast-radius.png | industrial/iron/lava |
| 03 | Tainted Fountain | Venom Swamp | Zsos'Ssar, the Serpent Warlord | tainted-fountain.png | twist/bronze/emerald/amethyst |
| 04 | Shield Shrine | Bamboo Warrior | Xiong, the Bamboo Guardian | shield-shrine.png | bamboo/bamboo/jade |
| 05 | Field Study | Big Stomp! | Kit, the Shark Researcher | field-study.png | wave/wood/amber |
| 06 | Crimson Campaign | Bloody King Zi | Timeless King Zi | crimson-campaign.png | cosmic/ice/ruby/sapphire |
| 07 | Bone Tide | Bone Rush | Vacarn, the Dark Goblin Necromancer | bone-tide.png | bone/gothic/ruby/amethyst |
| 08 | Live Fire Test | Boom Boom Kaboom! | Andras, the Human Weapon | live-fire-test.png | industrial/iron/amber/ruby |
| 09 | Caldera Dance | Burning Inferno | Luna Pele, the Flame Dancer | caldera-dance.png | stone/bronze/lava/topaz |
| 10 | Wowhalla Watch | Cool Gang | Thorad, Strength of Coolness | wowhalla-watch.png | twist/iron/topaz/sapphire |
| 11 | Silken Descent | Creepy Crawlies | Alleria, the Queen of Spiders | silken-descent.png | filigree/ebony/ruby/amethyst |
| 12 | Crystal Eve | Crystal Gifts | Mary Crestmas | crystal-eve.png | icicle/ice/ruby/emerald |
| 13 | Phoenix Call | Cute Commando | Cute Annoyance Mini | phoenix-call.png | twist/gold/ruby/sapphire |
| 14 | Moonlit Waltz | Dance of the Butterflies | Beato, the Butterfly Witch | moonlit-waltz.png | double/silver/amethyst/topaz |
| 15 | Red Tide | Deepsea Terror | Siphem, the Deepsea Demon | red-tide.png | wave/sea/ruby |
| 16 | Rift over Earth | Depths of the Cosmos | Argos, the Eye of the Cosmos | rift-over-earth.png | cosmic/cosmic/ruby/emerald |
| 17 | Glade of the Vanguard | Elven Vanguard | Maya, the Nature Fairy | glade-of-the-vanguard.png | filigree/wood/emerald/jade |
| 18 | Sticky Fingers | Flying Sparks | Lilly, the Charming Infiltrator | sticky-fingers.png | moulding/bronze/amber/rose |
| 19 | Hellgate Spring | Gates to Hell | Silent Water Mizune | hellgate-spring.png | wave/sea/ruby |
| 20 | Stormward Drift | Gather That Storm! | Tarleinn the Traveler | stormward-drift.png | twist/silver/sapphire |
| 21 | Hall of Arms | Great Weapon Master | Toras, Master of all Weapons | hall-of-arms.png | ornate/gold/emerald |
| 22 | Vengeful Vigil | Guardians of the Treasure Cave | Mao, the Vengeful Guardian | vengeful-vigil.png | bamboo/lacquer/amber |
| 23 | Hellfire Salvo | Hellfire Battery | Baaliel, the Demon General | hellfire-salvo.png | industrial/iron/lava |
| 24 | Afterimage | Idej Illusions | Idej Lord Daiyo | afterimage.png | arch/lacquer/jade |
| 25 | Initiation Rite | Join our Cult! | Klaus, the Cult Leader | initiation-rite.png | arch/gothic/ruby/sapphire |
| 26 | Thunderhead | Lightning Caller | Sol Rym, the Thunder Djinn | thunderhead.png | wave/sea/topaz/sapphire |
| 27 | Hellhound's Trail | Man's Best Friends | Orthos, the Loyal Guard Dog | hellhounds-trail.png | stone/iron/lava |
| 28 | Specimen Wing | Mawstruck | Nero Zira, the Mastermind | specimen-wing.png | industrial/iron/cyan |
| 29 | Knock at the Window | Morph and Kill! | Waflav, the Metamorphing Monstrosity | knock-at-the-window.png | double/bronze/emerald/amber |
| 30 | Severed Spell | Null and Void | Null, the Mage Slayer | severed-spell.png | moulding/ebony/amethyst/amber |
| 31 | Tiger and Ox | One-Two-Punch! | Ghuanjun, the Undead Martial Artist | tiger-and-ox.png | meander/lacquer/lava/jade |
| 32 | Scribe of Souls | Parts of the Soul | Thep, the Court Scribe | scribe-of-souls.png | arch/gold/cyan/sapphire |
| 33 | Sniper's Ledge | Pew-Pew! | Bow Sniper Darge | snipers-ledge.png | twist/bronze/emerald/amber |
| 34 | Tormentor's Den | Poison Torture | Reiza, the Chief Tormentor | tormentors-den.png | bone/gothic/amethyst/lime |
| 35 | Pyre of the Warband | Sacrificial Demons | Calamitusk, the Chaorc War Chief | pyre-of-the-warband.png | industrial/iron/lava/onyx |
| 36 | Blackport Nightfall | Shadows over Blackport | Arthor, the King of Blackport | blackport-nightfall.png | ornate/gothic/amethyst/ruby |
| 37 | Sandtrap Oasis | Shifting Sandlands | Bakhm, the Desert Digger | sandtrap-oasis.png | stone/stone/amber/jade |
| 38 | New Flock | Slimy Infestation | Stellan, the Calm Cat | new-flock.png | arch/silver/ruby/amethyst |
| 39 | Black Ice Hall | Slip 'n Slide | Hel, the Bound Specter | black-ice-hall.png | icicle/ice/emerald/sapphire |
| 40 | Smog Drill | Spell Industrialization | Victorica, the Eternal Empress | smog-drill.png | industrial/brass/amethyst/topaz |
| 41 | Rampart of Deri | Steam Dwarf Mines | Layn, Defender of Deri | rampart-of-deri.png | industrial/iron/lava |
| 42 | Sunforged Summit | Sun Fencer Frenzy | Taio, the Sun Fencer | sunforged-summit.png | arch/bronze/amber |
| 43 | Wheel of Wisdom | To Attain Divinity | Archibald, the Archmage | wheel-of-wisdom.png | filigree/gothic/amethyst |
| 44 | Sakura Mirror | Grand Rebellion! | Champion, the Stormbringer | sakura-mirror.png | wave/lacquer/rose |

Nutzer-Feedback: `FEEDBACK_1.md` und `FEEDBACK_2.md` (beide umgesetzt), Referenzbilder in `refs/`.
