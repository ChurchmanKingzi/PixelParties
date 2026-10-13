// A08-21 · Paraseed Zombie: „by an opponent's card or effect" wertet den BESITZER der Schadensquelle aus, nicht den Kontrolleur (gestohlene Kreaturen)
//
// Kartentext: „Play this card immediately when a Hero you control would be defeated by an opponent's card or effect. Place a "Paraseed" from your hand or deck into that Hero's free Support Zone,
// and if you do, that Hero's HP drop to 1 instead."
// Aufbau: Sitz 0 hält Paraseed Zombie + Paraseed; Held 0 hat 100 HP. Eine Kreatur trifft Held 0 tödlich (`actionDealDamage(kreatur, held, 900, 'creature')`, genau wie `ctx.dealDamage` einer
//   Kreaturenfähigkeit: die Quelle ist die Kreatur-Instanz, `owner` = Besitzer).
//   (a) Kreatur gehört Sitz 1, wurde aber von Sitz 0 gestohlen (Kontrolleur = ich)   → es ist KEIN gegnerischer Effekt: Zombie darf nicht auslösen.
//   (b) Kreatur gehört Sitz 0, wurde aber von Sitz 1 gestohlen (Kontrolleur = Gegner) → es ist ein gegnerischer Effekt: Zombie muss auslösen.
//   (c) Kontrolle: Gegnerkreatur, nicht gestohlen → Zombie löst aus.
// Beobachtet: (a) Zombie löst aus (HP 1, Zombie gelöscht); (b) Zombie löst NICHT aus, Held 0 stirbt; (c) ✓.
// Ursache: `paraseed-zombie.js` ~Z. 70 `const quellSeite = source?.owner ?? source?.controller;` – bei Kreatur-Instanzen ist `owner` der Besitzer; die Engine-Konvention (Styx 28.9.) ist
//   „Kontrolle statt Besitz" (`inst.controller ?? inst.owner`). Dasselbe Muster steht in punch-in-the-box.js, smug-coin.js, spider-silk-bridge.js, _sc-tracking.js (nicht geprüft).
// Aufruf: node docs/niche-tests/repro/A08-pacman/21-zombie-quellseite-besitzer-statt-kontrolleur.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const D = H.INERT.creature, F = H.INERT.filler;
  const faelle = [
    { name: '(a) Gegnerkreatur von mir gestohlen trifft mich', erwarte: false, bau: (t) => { const c = t.put(1, 0, 0, D); c.turnPlayed = 1; t.engine.actionStealCreature(0, c); return c; } },
    { name: '(b) meine Kreatur vom Gegner gestohlen trifft mich', erwarte: true, bau: (t) => { const c = t.put(0, 0, 0, D); c.turnPlayed = 1; t.engine.actionStealCreature(1, c); return c; } },
    { name: '(c) normale Gegnerkreatur trifft mich', erwarte: true, bau: (t) => { const c = t.put(1, 0, 0, D); c.turnPlayed = 1; return c; } },
  ];
  for (const f of faelle) {
    const t = await H.fresh({ hand: [[], []], deck: [Array(20).fill(F), Array(20).fill(F)] });
    t.hero(0, 0).hp = 100;
    t.engine.handZugangSync(0, 'Paraseed Zombie'); t.engine.handZugangSync(0, 'Paraseed');
    t.grantFor(0, 0, 'Paraseed Zombie');
    t.script.push({ match: d => d && d.type === 'optionPicker' && /casts Paraseed Zombie/.test(d.description || ''), answer: () => ({ optionId: 'hero-0' }) });
    const c = f.bau(t);
    t.gs.activePlayer = 1;
    await t.run(() => t.engine.actionDealDamage(c, t.hero(0, 0), 900, 'creature'));
    const gefeuert = t.pile(0, 'deletedPile').includes('Paraseed Zombie');
    R.note(f.name, JSON.stringify({ ownerQuelle: c.owner, kontrolleur: c.controller, hp: t.hero(0, 0).hp, gefeuert }));
    R.check(`${f.name}: Zombie ${f.erwarte ? 'löst aus (Held auf 1 HP)' : 'löst NICHT aus (eigene Kontrolle)'}`, gefeuert === f.erwarte, { gefeuert, hp: t.hero(0, 0).hp });
    R.check(`${f.name}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.finish();
})();
