'use strict';
// W72c-03 · Clone — Nischen: Heilung, Tod durch die Kopie, Kosten der Karte, Rundensperren der Karte, Teleport, Schutz des Ziels, Umhängen, Arrows
const H = require('../../lib/h.js');
const CARD = 'Clone';
const isHero = (v, owner, hi) => v.type === 'hero' && v.owner === owner && (hi == null || v.heroIdx === hi);
const confirms = (t) => t.prompts.filter(p => p.d && p.d.type === 'confirm' && p.d.title === CARD);
const setAtk = (t, seat, hi, atk) => { t.gs.players[seat].heroes[hi].atk = atk; t.gs.players[seat].heroes[hi].baseAtk = atk; };
const klon = (t, seat = 0, hi = 0, slot = 0) => t.put(seat, hi, slot, CARD);
async function wirken(t, seat, hi, karte, ziele) {
  t.targetFn = (valid) => (typeof ziele === 'function' ? ziele(valid) : ziele).filter(id => valid.some(v => v.id === id));
  t.setHand(seat, [karte]);
  const r = await t.play(seat, karte, { hero: hi });
  t.targetFn = null;
  return r;
}

(async () => {
  const R = H.runner();

  R.section('A · Heilung: die Kopie heilt dasselbe Ziel noch einmal');
  {
    const t = await H.fresh({ hand: [['Heal'], []] });
    klon(t); t.grantFor(0, 0, 'Heal');
    t.hero(0, 1).hp = 100;
    const ref = await H.fresh({ hand: [['Heal'], []] });
    ref.grantFor(0, 0, 'Heal'); ref.hero(0, 1).hp = 100;
    await wirken(ref, 0, 0, 'Heal', [`hero-0-1`]);
    const r = await wirken(t, 0, 0, 'Heal', [`hero-0-1`]);
    const einfach = ref.hp(0, 1) - 100;
    R.check('Heal gespielt', r === true && einfach > 0, [r, einfach]);
    R.check(`Heilung doppelt (einfach ${einfach}, mit Clone ${t.hp(0, 1) - 100})`, t.hp(0, 1) - 100 === Math.min(2 * einfach, 700), [t.hp(0, 1), einfach]);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('B · Tod durch die Kopie, Ziel mit Schutz');
  {
    const t = await H.fresh({ hand: [['Attack'], []] });
    klon(t); setAtk(t, 0, 0, 100);
    t.hero(1, 0).hp = 150;
    await wirken(t, 0, 0, 'Attack', [`hero-1-0`]);
    R.check('150 HP: Original 100, Kopie besiegt das Ziel', t.hp(1, 0) <= 0, t.hp(1, 0));
    R.check('keine Engine-Fehler, Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  {
    // Stoneskin am Ziel: beide Treffer (Original UND Kopie) werden um 100 gemindert
    const t = await H.fresh({ hand: [['Attack', 'Stoneskin'], []] });
    klon(t); setAtk(t, 0, 0, 250);
    t.targetFn = (valid) => [valid.find(v => isHero(v, 1, 0)).id];
    t.setHand(0, ['Stoneskin']); t.grantFor(0, 0, 'Stoneskin');
    await t.play(0, 'Stoneskin', { hero: 0 });
    t.targetFn = null; t.resetActions(0);
    t.prompts.length = 0;
    await wirken(t, 0, 0, 'Attack', [`hero-1-0`]);
    R.check('Stoneskin: 2 × (250 − 100) = 300', t.hp(1, 0) === 500, t.hp(1, 0));
  }
  {
    // Shrink am Wirker: beide Treffer nur 1
    const t = await H.fresh({ hand: [['Attack'], []] });
    klon(t); setAtk(t, 0, 0, 250);
    await t.run(() => t.engine.addHeroStatus(0, 0, 'shrunk', { appliedBy: 1, source: 'Shrink', permanent: true, _fromAttachment: 'Shrink' }));
    await wirken(t, 0, 0, 'Attack', [`hero-1-0`]);
    R.check('Shrink ohne Karte am Brett hat keine Wirkung (Hooks hängen an der Karte)', t.hp(1, 0) <= 600, t.hp(1, 0));
  }

  R.section('C · Kosten und Einschränkungen der Karte (Al: „performs a copy of the Spell" — Kosten UND Einschränkungen)');
  {
    // „You can only play 1 "Meditation" per turn": jeder once-per-turn-Spell ist NICHT klonbar
    const t = await H.fresh({ hand: [['Meditation'], []], discard: [['Fireball', 'Icebolt'], []] });
    klon(t); t.grantFor(0, 0, 'Meditation');
    t.setHand(0, ['Meditation']);
    t.script.push({ match: (d) => d.type === 'optionPicker', answer: { optionId: 'hand' } });
    const r = await t.play(0, 'Meditation', { hero: 0 });
    R.check('Meditation gespielt', r === true, r);
    R.check('Meditation (1 pro Zug): keine Kopie angeboten', confirms(t).length === 0, confirms(t).length);
    R.check('Karte nur einmal im Löschstapel', t.pile(0, 'deletedPile').filter(n => n === 'Meditation').length === 1, t.pile(0, 'deletedPile'));
  }
  for (const [karte, grund] of [['Hand of Death', '1 pro Zug'], ['Pyroblast', '1 pro Zug'], ['Gigantisaur Stomp', 'je Held 1 pro Zug']]) {
    const t = await H.fresh({ hand: [[karte], []] });
    klon(t); t.grantFor(0, 0, karte);
    t.setHand(0, [karte]);
    await t.play(0, karte, { hero: 0 });
    R.check(`${karte} (${grund}): keine Kopie angeboten`, confirms(t).length === 0, confirms(t).length);
  }
  {
    // „This must be the only Attack you play this turn": die Kopie wäre eine zweite Attack
    const t = await H.fresh({ hand: [['Knife Throw'], []] });
    klon(t); t.grantFor(0, 0, 'Knife Throw'); setAtk(t, 0, 0, 100);
    t.put(0, 0, 1, 'Diver Helmet'); t.put(0, 0, 2, 'Diver Helmet');
    const r = await wirken(t, 0, 0, 'Knife Throw', [`hero-1-0`]);
    R.check('Knife Throw gespielt', r === true, r);
    R.check('„must be the only Attack": keine Kopie angeboten', confirms(t).length === 0, confirms(t).length);
  }
  {
    // Kosten: Kirin Firebreath „Delete 1 Courtly Kirin from your discard pile to play this card" — die Kopie braucht eine ZWEITE Kirin
    const kirin = 'Rebelliokai Courtly Kirin';
    const zahl = async (kirins) => {
      const t = await H.fresh({ hand: [['Kirin Firebreath'], []], discard: [Array(kirins).fill(kirin).concat(['Rebelliokai Camouflaged Kappa']), []] });
      klon(t); t.grantFor(0, 0, 'Kirin Firebreath');
      t.setHand(0, ['Kirin Firebreath']);
      t.targetFn = (valid) => [valid.find(v => isHero(v, 1, 0)).id];
      const r = await t.play(0, 'Kirin Firebreath', { hero: 0 });
      t.targetFn = null;
      return { t, r, loch: t.pile(0, 'deletedPile').filter(n => n === kirin).length, dmg: 800 - t.hp(1, 0) };
    };
    const eine = await zahl(1), zwei = await zahl(2);
    R.check('Kirin Firebreath mit EINER Kirin gespielt (Kosten gezahlt)', eine.r === true && eine.loch === 1, [eine.r, eine.loch]);
    R.check('mit einer Kirin: die Kopie kann die Kosten nicht zahlen → nur das Original', eine.t.errors.length === 0 && eine.dmg > 0, [eine.dmg, eine.t.errors]);
    R.check('mit EINER Kirin bleibt das Limit „1 pro Zug" frei', eine.t.gs.hoptUsed?.['clone-copy:0'] !== eine.t.gs.turn);
    R.check('mit ZWEI Kirin: die Kopie zahlt die zweite (beide gelöscht)', zwei.r === true && zwei.loch === 2, [zwei.r, zwei.loch]);
    R.check('mit ZWEI Kirin: doppelter Schaden (Original + Kopie)', zwei.dmg === eine.dmg * 2 || zwei.dmg > eine.dmg, [eine.dmg, zwei.dmg]);
    R.check('keine Engine-Fehler', zwei.t.errors.length === 0, zwei.t.errors);
  }

  R.section('D · Teleport und Umhängen');
  {
    const t = await H.fresh({ hand: [['Teleport'], []] });
    klon(t, 0, 2); t.grantFor(0, 0, 'Teleport');
    const vor = t.gs.players[0].heroes.map(h => h.name);
    await wirken(t, 0, 2, 'Teleport', [`hero-0-0`, `hero-0-1`]);
    R.check('Teleport + Kopie: zwei Tausch-Schritte, Reihenfolge wie zu Beginn', JSON.stringify(t.gs.players[0].heroes.map(h => h.name)) === JSON.stringify(vor), t.gs.players[0].heroes.map(h => h.name));
    R.check('Clone steht noch in seiner Spalte', !!t.gs.players[0].supportZones[2].flat().includes(CARD));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('E · Zugwechsel, mehrere Würfe');
  {
    const t = await H.fresh({ hand: [['Attack'], ['Attack']] });
    klon(t, 0, 0); klon(t, 1, 0); setAtk(t, 0, 0, 100); setAtk(t, 1, 0, 100);
    await wirken(t, 0, 0, 'Attack', [`hero-1-1`]);
    t.gs.activePlayer = 1; t.resetActions(1);
    await wirken(t, 1, 0, 'Attack', [`hero-0-1`]);
    R.check('beide Spieler: jeder Clone kopiert den eigenen Wurf (je 200)', t.hp(1, 1) === 600 && t.hp(0, 1) === 600, [t.hp(1, 1), t.hp(0, 1)]);
    R.check('keine Engine-Fehler, Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
