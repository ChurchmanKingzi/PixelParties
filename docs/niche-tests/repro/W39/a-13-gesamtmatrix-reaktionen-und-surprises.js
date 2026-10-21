'use strict';
// W39a · a-13 · Gesamtmatrix 3/3: Pfeile/Topaz, Hand-Reaktionen und Surprises × alle Quellen, die als Attack zählen
// Auftrag (Al, 22.10.2026): "Es gibt viele Karten, die triggern, wenn eine Attack ausgeführt wird … Reagieren die auch ALLE schon auf Broghan und co?" — Regel (W32a/W34a/W35a): Effekte, die als Attack eines
// Helden zählen, lösen JEDEN Attack-Leser genauso aus wie eine echte Attack. Matrix: Leser × Quellen (Referenz "Echte Attack"; Broghan, Brackle, Arthor, Heragas, Kohta, Javelin Throw, Sword in a Bottle,
// Crusader's ×4, Bamboo Staff, Sacrificial Dagger, Infected Greatmaw, Alluring Light, Duel) × beide Sitze × Heldenziel/Kreaturenziel (`_helfer.js`, `_leser.js`, `_pruefe.js`).
// Pfeile (Angelfeather, Bomb, Flame, Poisoned, Rainbow's, Golden, Hydra Blood, Racket, Arrow Slit), Magic Topaz, Stealthy Pursuit, Anti-Magnet, Challenge, Martyry, Invisibility Cloak, Fireshield, Spiky Armor,
// Escape, Zombified Assault, Corpse Explosion, Future Tech Escape Device, Test Flight, Chaorc Interception; Surprises Bluff, Booby Trap, Crimson Web, Firewall, Flooding, Frost Rune, Glass Wall, Jumper Spider,
// Mountain Tear River, Spike Trap, Tharxian Horse, Toxic Trap, Spider Avalanche, Jumpscare.
// Aufruf: node docs/niche-tests/repro/W39/a-13-gesamtmatrix-reaktionen-und-surprises.js   (Exit 0 = korrekt; auf der Basis 72ed5383 Exit 1)
const H = require('./_helfer.js').H;
const P = require('./_pruefe.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
(async () => {
  const R = H.runner();
  await P.pruefe(R, { leser: ["Angelfeather Arrow", "Magic Topaz", "Bomb Arrow", "Flame Arrow", "Poisoned Arrow", "Rainbow's Arrow", "Golden Arrow", "Hydra Blood Arrow", "Racket Arrow", "Arrow Slit", "Stealthy Pursuit", "Anti-Magnet", "Challenge", "Martyry", "Invisibility Cloak", "Fireshield", "Spiky Armor", "Escape", "Zombified Assault", "Corpse Explosion", "Future Tech Escape Device", "Test Flight", "Chaorc Interception", "Bluff", "Booby Trap", "Crimson Web", "Firewall", "Flooding", "Frost Rune", "Glass Wall", "Jumper Spider", "Mountain Tear River", "Spike Trap", "Tharxian Horse", "Toxic Trap", "Spider Avalanche", "Jumpscare"], treiber: P.POSITIV });
  await P.gegenproben(R, { leser: ["Angelfeather Arrow", "Magic Topaz", "Bomb Arrow", "Flame Arrow", "Poisoned Arrow", "Rainbow's Arrow", "Golden Arrow", "Hydra Blood Arrow", "Racket Arrow", "Arrow Slit", "Stealthy Pursuit", "Anti-Magnet", "Challenge", "Martyry", "Invisibility Cloak", "Fireshield", "Spiky Armor", "Escape", "Zombified Assault", "Corpse Explosion", "Future Tech Escape Device", "Test Flight", "Chaorc Interception", "Bluff", "Booby Trap", "Crimson Web", "Firewall", "Flooding", "Frost Rune", "Glass Wall", "Jumper Spider", "Mountain Tear River", "Spike Trap", "Tharxian Horse", "Toxic Trap", "Spider Avalanche", "Jumpscare"] });
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
