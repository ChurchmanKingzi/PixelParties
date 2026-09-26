# Tarot-Sleeves (Große Arkana)

Serie zu „XIII – Skullmael“ (`data/shop/sleeves/sleeve14.png`): jede Große Arkana mit einem Hero
oder einer Creature aus Pixel Parties. Ergebnisse (750×1050) liegen in `data/sleeve-proposals/tarot/`,
Übersicht: `00_overview.png` (inkl. XIII aus dem Shop).

| Nr. | Arkana | Charakter | Skript |
|---|---|---|---|
| 0 | The Fool | Tobi, the Average Student | `t00_fool.py` |
| I | The Magician | Archibald, the Archmage | `t01_magician.py` |
| II | The High Priestess | Nao, the Barrier Priestess | `t02_high_priestess.py` |
| III | The Empress | Victorica, the Eternal Empress | `t03_empress.py` |
| IV | The Emperor | Zhigao, the Heavenly Emperor | `t04_emperor.py` |
| V | The Hierophant | Saint Nicolas | `t05_hierophant.py` |
| VI | The Lovers | Cute Angel Molinda (+ Cute Bunny, Cute Cat) | `t06_lovers.py` |
| VII | The Chariot | Rubin, the Dragoneer Champion (+ Red/Green Dragoneer) | `t07_chariot.py` |
| VIII | Strength | Thorad, Strength of Coolness (+ Guardian Beast Hu) | `t08_strength.py` |
| IX | The Hermit | Koperniko, the Stargazer | `t09_hermit.py` |
| X | Wheel of Fortune | Willy, the Valiant Leprechaun | `t10_wheel_of_fortune.py` |
| XI | Justice | Madame Guillotine, the Great Equalizer | `t11_justice.py` |
| XII | The Hanged Man | Alleria, the Queen of Spiders | `t12_hanged_man.py` |
| XIII | Death | Skeleton King Skullmael (bereits im Shop) | `../v2_05_tarot.py` |
| XIV | Temperance | Tempeste, the Weather Fairy | `t14_temperance.py` |
| XV | The Devil | Baaliel, the Demon General | `t15_devil.py` |
| XVI | The Tower | Champion, the Stormbringer | `t16_tower.py` |
| XVII | The Star | Cute Starlet Megu | `t17_star.py` |
| XVIII | The Moon | Tsu'Ki, the Lunatic Princess (+ Loyal Beagle, Deepsea Werewolf) | `t18_moon.py` |
| XIX | The Sun | Taio, the Sun Fencer | `t19_sun.py` |
| XX | Judgement | Damus, the Prophet of Apocalypse (+ Skelette) | `t20_judgement.py` |
| XXI | The World | True Fairy Crestina (+ die vier Cardinal Beasts) | `t21_world.py` |

## Aufbau

- `tlib.py` – gemeinsame Basis: gleicher Goldrahmen wie Skullmael (`finish`), Hintergrund-Helfer
  (Himmel, Sterne, Relief-Kugeln, Wolken, Glühen, Strahlen) und `Fig`, ein Material-Karten-Renderer
  für Figuren (Primitive → Kissen-Schattierung mit Bayer-Dithering, Außen- und innere Konturen).
- `tarot_*_helpers.py`, `t08_helpers.py` – Zusatzwerkzeuge einzelner Kartengruppen.
- Rendern: `cd data/sleeve-proposals/generator/tarot && python3 t19_sun.py` (Pillow, NumPy, OpenCV).
