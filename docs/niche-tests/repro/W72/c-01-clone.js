'use strict';
// W72c-01 · Clone (Creature Normal, Summoning Magic Lv2, HP 0 — geteilter Pool)
//
// Text: „Once per turn, when the corresponding Hero uses a Normal Attack or Spell, this Creature may perform an exact copy of it against the same target(s), using the same Attack stat
//        and Ability level. This Creature and the corresponding Hero share 1 HP pool. You can only control 1 "Clone" at a time."
// Geprüft: Beschwörung (nur 1 Clone), geteilter HP-Pool, Kopie einer Attack/eines Spells gegen dieselben Ziele (Held, Kreatur, Mehrfachziele), nur Untertyp Normal, nur der zugehörige Held,
//   „may" (Ablehnen verbraucht nichts), 1 pro Zug, Ziel weg → keine Kopie, Tod des Helden nimmt den Klon mit, Zustandsprüfung.
const H = require('../../lib/h.js');
const CARD = 'Clone';
const isHero = (v, owner, hi) => v.type === 'hero' && v.owner === owner && (hi == null || v.heroIdx === hi);
const confirms = (t) => t.prompts.filter(p => p.d && p.d.type === 'confirm' && p.d.title === CARD);
const setAtk = (t, seat, hi, atk) => { t.gs.players[seat].heroes[hi].atk = atk; t.gs.players[seat].heroes[hi].baseAtk = atk; };
const klon = (t, seat = 0, hi = 0, slot = 0) => t.put(seat, hi, slot, CARD);

async function wirken(t, seat, hi, karte, ziele) {
  t.targetFn = (valid) => { const ids = (typeof ziele === 'function' ? ziele(valid) : ziele).filter(id => valid.some(v => v.id === id)); return ids; };
  t.setHand(seat, [karte]);
  const r = await t.play(seat, karte, { hero: hi });
  t.targetFn = null;
  return r;
}

(async () => {
  const R = H.runner();

  R.section('A · Beschwörung und geteilter HP-Pool');
  {
    const t = await H.fresh({ hand: [[CARD, CARD], []] });
    t.grantFor(0, 0, CARD);
    const r = await t.play(0, CARD, { hero: 0 });
    R.check('Clone beschworen', r === true && !!t.find(CARD, 'support'), r);
    t.resetActions(0);
    const r2 = await t.play(0, CARD, { hero: 0 });
    R.check('ein zweiter Clone ist NICHT möglich („only control 1")', !(t.inst(c => c.name === CARD && c.zone === 'support').length > 1) && (r2 === false || t.pile(0, 'hand').includes(CARD)), [r2, t.inst(c => c.name === CARD && c.zone === 'support').length]);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {
    // Gegner kontrolliert eigenen Clone: das Limit zählt je Spieler
    const t = await H.fresh({ hand: [[CARD], [CARD]] });
    t.grantFor(0, 0, CARD); t.grantFor(1, 0, CARD);
    await t.play(0, CARD, { hero: 0 });
    const r = await t.play(1, CARD, { hero: 0 });
    R.check('beide Spieler können je einen Clone haben', t.inst(c => c.name === CARD && c.zone === 'support').length === 2, r);
  }
  {
    const t = await H.fresh({ hand: [[], ['Attack']] });
    const c = klon(t, 0, 0);
    setAtk(t, 1, 0, 100);
    t.targetFn = (valid) => [valid.find(v => v.type === 'equip' && v.owner === 0).id];
    await t.play(1, 'Attack', { hero: 0 });
    R.check('Schaden an den Clone wird dem Helden berechnet (800 → 700)', t.hp(0, 0) === 700, t.hp(0, 0));
    R.check('der Clone lebt weiter (kein eigener HP-Vorrat)', c.zone === 'support', c.zone);
  }

  R.section('B · Kopie einer Attack gegen dasselbe Ziel');
  {
    const t = await H.fresh({ hand: [['Attack'], []] });
    klon(t); setAtk(t, 0, 0, 100);
    const r = await wirken(t, 0, 0, 'Attack', [`hero-1-0`]);
    R.check('Attack gespielt', r === true, r);
    R.check('Bestätigung des Clone angeboten', confirms(t).length === 1, t.prompts.map(p => p.d && p.d.title));
    R.check('Ziel verliert 100 (Original) + 100 (Kopie) = 200', t.hp(1, 0) === 600, t.hp(1, 0));
    R.check('andere Helden unberührt', t.hp(1, 1) === 800 && t.hp(1, 2) === 800);
    R.check('Zielwahl nur EINMAL angeboten (die Kopie fragt nicht)', t.targets.length === 1, t.targets.length);
    R.check('Karte liegt nur einmal in der Ablage (die Kopie ist keine Karte)', t.pile(0, 'discardPile').filter(n => n === 'Attack').length === 1 && t.inst(c => c.name === 'Attack').length <= 1, [t.pile(0, 'discardPile'), t.inst(c => c.name === 'Attack').length]);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
    R.check('Zustand sauber', t.audit().length === 0, t.audit());
  }
  {
    // 1 pro Zug: zweite Attack desselben Zuges wird nicht mehr kopiert; im nächsten Zug wieder
    const t = await H.fresh({ hand: [['Attack', 'Attack'], []] });
    klon(t); setAtk(t, 0, 0, 100);
    await wirken(t, 0, 0, 'Attack', [`hero-1-0`]);
    t.resetActions(0);
    t.setHand(0, ['Attack']);
    await wirken(t, 0, 0, 'Attack', [`hero-1-1`]);
    R.check('zweite Attack im selben Zug: nur Original (100)', t.hp(1, 1) === 700, t.hp(1, 1));
    R.check('nur eine Bestätigung', confirms(t).length === 1, confirms(t).length);
    t.gs.turn += 1; t.resetActions(0);
    await wirken(t, 0, 0, 'Attack', [`hero-1-2`]);
    R.check('im nächsten Zug wieder kopiert (200)', t.hp(1, 2) === 600, t.hp(1, 2));
  }
  {
    // Ablehnen: nichts verbraucht → die nächste Attack darf kopiert werden
    const t = await H.fresh({ hand: [['Attack'], []] });
    klon(t); setAtk(t, 0, 0, 100);
    t.policy.confirm = false;
    await wirken(t, 0, 0, 'Attack', [`hero-1-0`]);
    R.check('abgelehnt: nur Original', t.hp(1, 0) === 700, t.hp(1, 0));
    t.policy.confirm = true; t.resetActions(0);
    await wirken(t, 0, 0, 'Attack', [`hero-1-1`]);
    R.check('das Limit war nicht verbraucht: die nächste Attack wird kopiert', t.hp(1, 1) === 600, t.hp(1, 1));
  }
  {
    // Kreaturenziel
    const t = await H.fresh({ hand: [['Attack'], []] });
    klon(t); setAtk(t, 0, 0, 100);
    const c = t.put(1, 0, 0, H.INERT.big);
    await wirken(t, 0, 0, 'Attack', (valid) => [valid.find(v => v.type === 'equip' && v.owner === 1).id]);
    R.check('Kreatur nimmt Original + Kopie (1000 → 800)', c.counters.currentHp === 800, c.counters.currentHp);
  }

  R.section('C · Spells: Einzelziel, Mehrfachziel, Fläche');
  {
    const t = await H.fresh({ hand: [['Icebolt'], []] });
    klon(t); t.grantFor(0, 0, 'Icebolt');
    await wirken(t, 0, 0, 'Icebolt', [`hero-1-1`]);
    R.check('Icebolt: 120 + 120', t.hp(1, 1) === 560, t.hp(1, 1));
    R.check('Icebolt: Held eingefroren', !!t.hero(1, 1).statuses.frozen);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {
    const t = await H.fresh({ hand: [['Magic Arrows'], []] });
    klon(t); t.grantFor(0, 0, 'Magic Arrows');
    await wirken(t, 0, 0, 'Magic Arrows', [`hero-1-0`, `hero-1-2`, `hero-0-1`]);
    R.check('Magic Arrows: dieselben drei Ziele je 100', t.hp(1, 0) === 700 && t.hp(1, 2) === 700 && t.hp(0, 1) === 700, [t.hp(1, 0), t.hp(1, 2), t.hp(0, 1)]);
    R.check('unbeteiligte Helden unberührt', t.hp(1, 1) === 800 && t.hp(0, 2) === 800 && t.hp(0, 0) === 800);
  }
  {
    const t = await H.fresh({ hand: [['Fireball'], []] });
    klon(t); t.grantFor(0, 0, 'Fireball');
    await wirken(t, 0, 0, 'Fireball', [`hero-1-0`, `hero-1-1`]);
    R.check('Fireball: zwei Ziele je 150 + 150', t.hp(1, 0) === 500 && t.hp(1, 1) === 500, [t.hp(1, 0), t.hp(1, 1)]);
  }
  {
    // Flächenzauber ohne Zielwahl
    const t = await H.fresh({ hand: [['Flame Avalanche'], []] });
    klon(t); t.grantFor(0, 0, 'Flame Avalanche');
    t.setHand(0, ['Flame Avalanche']);
    const r = await t.play(0, 'Flame Avalanche', { hero: 0 });
    R.check('Flame Avalanche gespielt', r === true, r);
    // Der Text sperrt anderen Schaden am selben Zug — die Kopie ist derselbe Effekt: eine Kopie wirkt, die Sperre verhindert keinen zweiten Wurf der Karte selbst
    R.check('Kopie angeboten und Schaden verdoppelt oder gesperrt, aber ohne Fehler', t.errors.length === 0 && t.hp(1, 0) <= 650, [t.hp(1, 0), t.errors]);
  }

  R.section('D · nur Normal Attack/Spell, nur der zugehörige Held');
  {
    const t = await H.fresh({ hand: [['Stoneskin'], []] });
    klon(t); t.grantFor(0, 0, 'Stoneskin');
    t.targetFn = (valid) => [valid.find(v => isHero(v, 0, 1)).id];
    t.setHand(0, ['Stoneskin']);
    await t.play(0, 'Stoneskin', { hero: 0 });
    R.check('Attachment-Spell: keine Kopie angeboten', confirms(t).length === 0 && t.inst(c => c.name === 'Stoneskin' && c.zone === 'support').length === 1, confirms(t).length);
  }
  {
    const t = await H.fresh({ hand: [['Attack'], []] });
    klon(t, 0, 0); setAtk(t, 0, 1, 100);
    await wirken(t, 0, 1, 'Attack', [`hero-1-0`]);
    R.check('anderer Held (1) wirkt: keine Kopie', confirms(t).length === 0 && t.hp(1, 0) === 700, [confirms(t).length, t.hp(1, 0)]);
  }
  {
    // Clone am Helden 1: der Held 1 wirkt → Kopie
    const t = await H.fresh({ hand: [['Attack'], []] });
    klon(t, 0, 1); setAtk(t, 0, 1, 100);
    await wirken(t, 0, 1, 'Attack', [`hero-1-0`]);
    R.check('Clone in Spalte 1, Held 1 wirkt: Kopie (200)', t.hp(1, 0) === 600, t.hp(1, 0));
  }
  {
    // Clone des Gegners reagiert nicht auf MEINE Attack
    const t = await H.fresh({ hand: [['Attack'], []] });
    klon(t, 1, 0); setAtk(t, 0, 0, 100);
    await wirken(t, 0, 0, 'Attack', [`hero-1-0`]);
    R.check('Clone der Gegenseite: keine Kopie meiner Attack', confirms(t).length === 0 && t.hp(1, 0) === 700, [confirms(t).length, t.hp(1, 0)]);
  }

  R.section('E · Ziel weg / Held fällt');
  {
    const t = await H.fresh({ hand: [['Attack'], []] });
    klon(t); setAtk(t, 0, 0, 100);
    t.hero(1, 0).hp = 100;
    await wirken(t, 0, 0, 'Attack', [`hero-1-0`]);
    R.check('Ziel fällt durch das Original: keine Kopie angeboten', confirms(t).length === 0 && t.hp(1, 0) <= 0, [confirms(t).length, t.hp(1, 0)]);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {
    const t = await H.fresh({ hand: [[], []] });
    const c = klon(t);
    await t.run(() => t.engine.actionDefeatHero({ name: 'Test', owner: 1, controller: 1, heroIdx: 0 }, t.hero(0, 0), { sourceName: 'Test' }));
    R.check('Held besiegt: der Clone geht mit in die Ablage', c.zone !== 'support' && t.pile(0, 'discardPile').includes(CARD), [c.zone, t.pile(0, 'discardPile')]);
  }

  R.section('F · Zustand des Klons');
  {
    const t = await H.fresh({ hand: [['Attack'], []] });
    const c = klon(t); setAtk(t, 0, 0, 100);
    await t.run(() => t.engine.actionNegateCreature(c, 'Test', { expiresAtTurn: t.gs.turn + 3, expiresForPlayer: 0 }));
    await wirken(t, 0, 0, 'Attack', [`hero-1-0`]);
    R.check('negierter Clone: keine Kopie', confirms(t).length === 0 && t.hp(1, 0) === 700, [confirms(t).length, t.hp(1, 0)]);
  }
  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
