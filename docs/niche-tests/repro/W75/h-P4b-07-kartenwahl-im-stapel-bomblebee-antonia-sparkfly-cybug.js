'use strict';
// W75 · Darion — Kreaturen, die „eine Karte auf dem Brett" waehlen, treffen aus einem Equip-Stapel genau die gewaehlte Karte, auch bei gleichnamigen Duplikaten (Audit P4b, Klasse A).
// Kartentexte: Dive Bomblebee „… choose a card on your opponent's side of the board that is not a Hero and place it at the bottom of your opponent's deck." ·
//   Smug Mastermind Antonia „… you may discard a card to choose any card on the board that is not a Hero and send it to the discard pile." ·
//   Sparkfly Worker „… you may choose a card on the board that is not a Hero and add it to your hand." ·
//   Cybug RHINOCEROS „Activate this Surprise when your opponent places a card into an Area or Support Zone … Send that card to the discard pile …"
// Stapel: [Club of Gobbo, Blade of the Frostbringer, Club of Gobbo] — gewaehlt wird die LETZTE Karte (zweite Club of Gobbo); die erste Club darf nicht angetastet werden.
// Erwartet: nur die gewaehlte Instanz verlaesst den Platz. Aufruf: node docs/niche-tests/repro/W75/h-P4b-07-kartenwahl-im-stapel-bomblebee-antonia-sparkfly-cybug.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler;
const NAMEN = ['Club of Gobbo', 'Blade of the Frostbringer', 'Club of Gobbo'];
function stapel(t, seat, namen, slot = 1, hi = 0) {
  const ps = t.gs.players[seat]; ps.supportZones[hi][slot] = [];
  return namen.map(n => { ps.supportZones[hi][slot].push(n); const i = t.engine._trackCard(n, seat, 'support', hi, slot); i.turnPlayed = 1; return i; });
}
const imPlatz = (t, seat) => t.inst(c => c.zone === 'support' && c.owner === seat && c.heroIdx === 0 && c.zoneSlot === 1).map(c => c.id);
const nurLetzteWeg = (t, seat, ins) => { const ids = imPlatz(t, seat); return ids.includes(ins[0].id) && ids.includes(ins[1].id) && !ids.includes(ins[2].id) && ids.length === 2; };
const waehle = (t, ins, idx, protokoll) => t.script.push({ match: d => d.type === 'instancePick', answer: (d) => { protokoll.push(d.instances.map(i => i.name)); return { instId: ins[idx].id }; } });
(async () => {
  const R = H.runner();

  R.section('1) Dive Bomblebee — gegnerischer Stapel, die letzte Karte kommt unter das Deck des Gegners');
  {
    const t = await H.fresh({ active: 0, heroes: [[F, null, null], [D, null, null]], hand: [[F], [F]], gold: 100 });
    const b = t.put(0, 0, 0, 'Dive Bomblebee'); b.turnPlayed = 1;
    const ins = stapel(t, 1, NAMEN);
    const frail = t.put(1, 0, 2, H.INERT.frail); frail.turnPlayed = 1;
    const angebot = []; waehle(t, ins, 2, angebot);
    t.targetFn = (valid) => { const v = valid.find(x => x.type === 'equip' && x.owner === 1 && x.slotIdx === 1); return v ? [v.id] : [valid[0].id]; };
    await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Fireball', owner: 0, heroIdx: 0 }, frail, 500, 'spell', { sourceOwner: 0 }));
    await t.drain();
    R.note('ergebnis', JSON.stringify({ zonen: t.gs.players[1].supportZones[0], deckUnten: t.pile(1, 'mainDeck').slice(-2), angebot }));
    R.check('Rueckfrage nannte alle drei Karten', JSON.stringify(angebot[0]) === JSON.stringify(NAMEN), angebot);
    R.check('nur die letzte Instanz verliess den Platz', nurLetzteWeg(t, 1, ins), imPlatz(t, 1));
    R.check('Namen-Array: Club + Blade (Reihenfolge gleichnamiger Karten ist Engine-Konvention: erster Name faellt)', [...t.gs.players[1].supportZones[0][1]].sort().join() === 'Blade of the Frostbringer,Club of Gobbo', t.gs.players[1].supportZones[0]);
    R.check('Club of Gobbo liegt unten im Gegner-Deck', t.pile(1, 'mainDeck')[t.pile(1, 'mainDeck').length - 1] === 'Club of Gobbo');
    R.check('sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }

  for (const stSeat of [1, 0]) {
    R.section(`2) Smug Mastermind Antonia — Stapel bei Sitz ${stSeat}, die letzte Karte in die Ablage`);
    const heroes = [[F, null, null], [F, null, null]]; heroes[stSeat][0] = D;
    const t = await H.fresh({ active: 0, heroes, hand: [[F, F], [F]], gold: 100 });
    const a = t.put(0, 1, 0, 'Smug Mastermind Antonia'); a.turnPlayed = 1; a.counters.attachedHero = 'Cool Rescuer Monia'; a.counters.currentHp = 250; a.counters.maxHp = 250;
    const vic = t.put(0, 1, 2, H.INERT.big); vic.turnPlayed = 1;
    const ins = stapel(t, stSeat, NAMEN);
    const angebot = []; waehle(t, ins, 2, angebot);
    t.targetFn = (valid) => { const v = valid.find(x => x.type === 'equip' && x.owner === stSeat && x.slotIdx === 1); return v ? [v.id] : [valid[0].id]; };
    await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Fireball', owner: 1, heroIdx: 0 }, vic, 50, 'spell', { sourceOwner: 1 }));
    await t.drain();
    R.check('nur die letzte Instanz verliess den Platz', nurLetzteWeg(t, stSeat, ins), imPlatz(t, stSeat));
    R.check('Club of Gobbo in der Ablage', t.pile(stSeat, 'discardPile').includes('Club of Gobbo'), t.pile(stSeat, 'discardPile'));
    R.check('sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }

  for (const stSeat of [1, 0]) {
    R.section(`3) Sparkfly Worker — Stapel bei Sitz ${stSeat}, die letzte Karte auf die Hand`);
    const heroes = [[F, 'Tushu, the Knowledge Keeper', null], [F, null, null]]; heroes[stSeat][0] = D;
    const t = await H.fresh({ active: 0, heroes, hand: [['Sparkfly Worker', F], [F]], gold: 100 });
    const q = t.put(0, 0, 0, 'Sparkfly Queen'); q.turnPlayed = 1;
    const ins = stapel(t, stSeat, NAMEN);
    const angebot = []; waehle(t, ins, 2, angebot);
    t.targetFn = (valid) => { const v = valid.find(x => x.type === 'equip' && x.owner === stSeat && x.slotIdx === 1); return v ? [v.id] : [valid[0].id]; };
    await t.play(0, 'Sparkfly Worker', { hero: stSeat === 0 ? 1 : 0, slot: stSeat === 0 ? 0 : 1 });
    await t.drain();
    R.check('nur die letzte Instanz verliess den Platz', nurLetzteWeg(t, stSeat, ins), imPlatz(t, stSeat));
    R.check('Club of Gobbo auf der Hand des Worker-Spielers', t.pile(0, 'hand').includes('Club of Gobbo'), t.pile(0, 'hand'));
    R.check('sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }

  R.section('4) Cybug RHINOCEROS — Darion legt ein drittes Equip in den Stapel: genau DIESE Karte wird abgeraeumt');
  {
    const t = await H.fresh({ active: 1, heroes: [[F, null, null], [D, null, null]], hand: [['Excavator Bucket', F], ['Glass Sword', F]], gold: 500 });
    t.putSurprise(0, 0, 'Cybug RHINOCEROS'); t.grantFor(0, 0, 'Cybug RHINOCEROS');
    const ins = stapel(t, 1, ['Club of Gobbo', 'Blade of the Frostbringer']);
    t.policy.confirm = true;
    await t.play(1, 'Glass Sword', { hero: 0 });
    await t.drain();
    R.note('ergebnis', JSON.stringify({ zonen: t.gs.players[1].supportZones[0], ablage: t.pile(1, 'discardPile') }));
    R.check('Glass Sword in der Ablage, die beiden Alten bleiben', JSON.stringify(t.gs.players[1].supportZones[0][1]) === '["Club of Gobbo","Blade of the Frostbringer"]' && t.pile(1, 'discardPile').includes('Glass Sword'), [t.gs.players[1].supportZones[0], t.pile(1, 'discardPile')]);
    R.check('beide alten Instanzen unversehrt', imPlatz(t, 1).length === 2 && imPlatz(t, 1).includes(ins[0].id) && imPlatz(t, 1).includes(ins[1].id));
    R.check('sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})();
