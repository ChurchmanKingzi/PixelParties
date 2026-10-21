'use strict';
// W39a · a-14 · Spell-Leser: Alice (zählt als Destruction-Magic-Spell) löst jeden Leser aus, der Spells liest — wie ein echter Spell
// Auftrag (Al, 22.10.2026): "Es gibt viele Karten, die triggern, wenn eine Attack ausgeführt wird … Reagieren die auch ALLE schon auf Broghan und co?" — Regel (W32a/W34a/W35a): Effekte, die als Attack eines
// Helden zählen, lösen JEDEN Attack-Leser genauso aus wie eine echte Attack. Matrix: Leser × Quellen (Referenz "Echte Attack"; Broghan, Brackle, Arthor, Heragas, Kohta, Javelin Throw, Sword in a Bottle,
// Crusader's ×4, Bamboo Staff, Sacrificial Dagger, Infected Greatmaw, Alluring Light, Duel) × beide Sitze × Heldenziel/Kreaturenziel (`_helfer.js`, `_leser.js`, `_pruefe.js`).
// Referenz: Fireball als echter Spell. Gelesen werden alle Karten, die "Attack, Spell or …" lesen (liest = attackOderSpell: Reaktionen, Surprises, Vinepire, Güldefaber, Santa Klaus, Zsos'Ssar, Thorad, Elixir of Cold,
// Dark Ocean, Gigantisaur Stegon, Taio): ein echter Spell UND Alice müssen sie auslösen; Leser, die nur Attacks lesen, dürfen von keinem der beiden ausgelöst werden.
// Ursache der Basis-Lücke: Alice legte ihr Ziel nicht ins Schadensprotokoll (`alsSpellKette` ohne `ziele`): Vinepire ("heals … damage it deals … with Attacks and Spells") und Zsos'Ssar sahen den Treffer nicht.
// Die Spell-Reaktionen im Einzelnen (Silence, MOE Shield, Magic Mirror, Storm Ring, Shamanic Curse) sichert W34/a-02.
// Aufruf: node docs/niche-tests/repro/W39/a-14-spell-leser-alice-und-echter-spell.js   (Exit 0 = korrekt; auf der Basis 72ed5383 Exit 1)
const H = require('./_helfer.js').H;
const P = require('./_pruefe.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
(async () => {
  const R = H.runner();
  const spellLeser = ["Truth-Seeing Eye", "Elixir of Cold (Buff)", "Vinepire", "Gigantisaur Stegon (Opfer)", "Hardy Slime (erzwungene Zielwahl)", "Empty Armor (Umleitung)", "Ghoul Guard (Opfer)", "Dark Ocean (Kreaturenschaden)", "Stealthy Pursuit", "Anti-Magnet", "Challenge", "Martyry", "Invisibility Cloak", "Fireshield", "Escape", "Zombified Assault", "Corpse Explosion", "Future Tech Escape Device", "Test Flight", "Chaorc Interception", "Bluff", "Booby Trap", "Crimson Web", "Firewall", "Flooding", "Frost Rune", "Glass Wall", "Jumper Spider", "Mountain Tear River", "Spike Trap", "Tharxian Horse", "Toxic Trap", "Spider Avalanche", "Jumpscare", "Cute Angel Molinda", "Güldefaber, the King of Dwarfs", "Thorad, Strength of Coolness", "Zsos'Ssar, the Serpent Warlord", "Taio, the Sun Fencer (Kill-Marke)", "Santa Klaus", "Taio, Absorber of the Mountain's Heart (Nachguss)"];
  await P.pruefe(R, { leser: spellLeser, treiber: ['Echter Spell', 'Alice'] });
  await P.gegenproben(R, { leser: spellLeser.concat(["Club of Gobbo", "Idej Sword - Kunagi", "Idej Sword - Onima", "Bow of the Hunt Goddess", "Future Tech Doomsday Bomb", "Elixir of Strength (Buff)", "Guardian Beast Niu (Buff)", "Wavilion", "Rioting Village (Rückstoß)", "Future Tech Jetpack (Träger, 0 Kopien)", "Stealth (Ability Lv 1, Angriff Stufe 1)", "Angelfeather Arrow", "Magic Topaz", "Bomb Arrow", "Flame Arrow", "Poisoned Arrow", "Rainbow's Arrow", "Golden Arrow", "Hydra Blood Arrow", "Racket Arrow", "Arrow Slit", "Spiky Armor", "Earth-Shattering Hammer, Relic of Deri", "The Hands of Big Gwen", "Skullmael's Greatsword", "Future Tech Bazooka", "Legendary Sword of a Barbarian King", "Heart-Shaped Bow, the Final Proof of Cuteness", "The Brewer's Blade", "Shattered Trident, Treasure of the Deepsea", "Phalanx Pike", "Heart of Ice (Träger wird getroffen)", "Heart of Ice (Träger stirbt)", "Nieht, the Blitz Blade", "Reiza, the Chief Tormentor", "Xiong, the Bamboo Guardian", "Devlin, the Masked Butcher", "Null, the Mage Slayer", "Don Quisto, the Gold Seeker", "Bow Sniper Darge"]) });
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
