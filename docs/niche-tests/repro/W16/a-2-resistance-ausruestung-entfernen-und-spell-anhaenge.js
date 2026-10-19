'use strict';
// W16a · Punkt 2 · Al, 19.10.2026: „Soll Resistance auch das Entfernen von Ausrüstung per Effekt (Disarm, Fire Bomb) und angehängte Spell-Anhänge wie Curse blocken?"
//   — „Attachments ja, Ability-Removal wie Fire Bomb nicht, die zielt nicht auf den Hero, sondern die Ability selbst!"
// Erwartet:
//   (a) Resistance blockt das Entfernen von Ausrüstung per Effekt am Resistance-Helden, wenn der Effekt den HELDEN wählt (Disarm; Pressure Projectile am getroffenen Helden).
//   (b) Resistance blockt Spell-Anhänge am Helden (Curse, Overheal Shock, Light Ball … — alles, was `placeAttachment` legt; Idej Projector per Effekt).
//   (c) NICHT geblockt: Entfernen/Zerstören einer Ability per Effekt (Fire Bomb, auch dessen Artefakt-Zweig: die Karte wählt die Artefakte selbst, nicht den Helden).
//   Gegenproben: Held ohne Resistance (alles wirkt wie bisher), Lv1 hat nur EINE Abwehr pro Zug. Exit 0 = korrekt.
const H = require('../../lib/h.js');
const RES = (lv) => Array(lv).fill('Resistance');
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const stuetz = (t, seat, hi) => (t.gs.players[seat].supportZones[hi] || []).flat();
const heroT = (owner, hi) => (valid) => { const h = valid.find(v => v.type === 'hero' && v.owner === owner && v.heroIdx === hi); return h ? [h.id] : [valid[0].id]; };
(async () => {
  const R = H.runner();

  R.section('(a) Disarm: Ausrüstung des Helden löschen');
  for (const [label, seat, lv] of [['Gegnerheld mit Resistance Lv3', 1, 3], ['EIGENER Held mit Resistance Lv3', 0, 3], ['Gegnerheld ohne Resistance (Kontrolle)', 1, 0]]) {
    const t = await H.fresh({ hand: [['Disarm'], []] });
    if (lv) t.setAbilities(seat, 0, [RES(lv), [], []]);
    t.put(seat, 0, 0, 'Club of Gobbo');
    t.targetFn = (valid) => valid.filter(v => v.type === 'equip').map(v => v.id).concat(valid.some(v => v.type === 'equip') ? [] : [valid[0].id]);
    t.script.push({ match: d => d.type === 'optionPicker' || d.type === 'confirm', answer: () => ({ confirmed: true }) });
    const r = await t.play(0, 'Disarm', { hero: 0 });
    const da = stuetz(t, seat, 0).includes('Club of Gobbo');
    R.check(`${label}: Disarm wurde gespielt (Karte weg aus der Hand)`, r === true && !t.pile(0, 'hand').includes('Disarm'), { r, hand: t.pile(0, 'hand') });
    if (lv) R.check(`${label}: Club of Gobbo bleibt am Helden (nicht gelöscht)`, da && !t.pile(seat, 'deletedPile').includes('Club of Gobbo'), { zone: stuetz(t, seat, 0), del: t.pile(seat, 'deletedPile') });
    else R.check(`${label}: Club of Gobbo gelöscht`, !da && t.pile(seat, 'deletedPile').includes('Club of Gobbo'), { zone: stuetz(t, seat, 0), del: t.pile(seat, 'deletedPile') });
    R.check(`${label}: keine Engine-Fehler / Zustand sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }
  {   // Lv1: nur EINE Abwehr pro Zug — der zweite Disarm greift
    const t = await H.fresh({ hand: [['Disarm', 'Disarm'], []] });
    t.setAbilities(1, 0, [RES(1), [], []]);
    t.put(1, 0, 0, 'Club of Gobbo'); t.put(1, 0, 1, 'Club of Gobbo');
    t.targetFn = (valid) => valid.filter(v => v.type === 'equip').slice(0, 1).map(v => v.id);
    await t.play(0, 'Disarm', { hero: 0 });
    const nach1 = stuetz(t, 1, 0).filter(x => x === 'Club of Gobbo').length;
    await t.play(0, 'Disarm', { hero: 0 });
    const nach2 = stuetz(t, 1, 0).filter(x => x === 'Club of Gobbo').length;
    R.check('Resistance Lv1: erster Disarm geblockt (2 Clubs), zweiter gleich am Zug greift (1 Club)', nach1 === 2 && nach2 === 1, { nach1, nach2 });
  }

  R.section('(a) Pressure Projectile: Anhängsel/Ausrüstung des getroffenen Helden wegschicken (der Schaden bleibt)');
  for (const [label, lv] of [['Resistance Lv3', 3], ['ohne Resistance (Kontrolle)', 0]]) {
    const t = await H.fresh({ hand: [['Pressure Projectile'], []] });
    if (lv) t.setAbilities(1, 0, [RES(lv), [], []]);
    t.put(1, 0, 0, 'Club of Gobbo');
    let n = 0;
    t.targetFn = (valid) => { n++; if (n === 1) return heroT(1, 0)(valid); return valid.filter(v => v.type === 'equip' && v.owner === 1).map(v => v.id); };
    const hp0 = t.hp(1, 0);
    await t.play(0, 'Pressure Projectile', { hero: 0 });
    const da = stuetz(t, 1, 0).includes('Club of Gobbo');
    R.check(`${label}: 150 Schaden trifft den Helden`, t.hp(1, 0) === hp0 - 150, { hp: t.hp(1, 0), hp0 });
    if (lv) R.check(`${label}: Ausrüstung bleibt liegen`, da, stuetz(t, 1, 0));
    else R.check(`${label}: Ausrüstung in der Ablage`, !da && t.pile(1, 'discardPile').includes('Club of Gobbo'), { zone: stuetz(t, 1, 0), abl: t.pile(1, 'discardPile') });
    R.check(`${label}: keine Engine-Fehler / Zustand sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }

  R.section('(b) Spell-Anhänge: Curse (Gegnerheld), Overheal Shock (Gegnerheld), Light Ball (EIGENER Held) an einen Helden mit Resistance Lv3');
  const anhaenge = [['Curse', 1, 0, (t) => !!t.hero(1, 0).statuses.cursed], ['Overheal Shock', 1, 0, null], ['Light Ball', 0, 0, null]];
  for (const [karte, seat, hi, status] of anhaenge) {
    for (const [label, lv] of [['Resistance Lv3', 3], ['ohne Resistance (Kontrolle)', 0]]) {
      const t = await H.fresh({ hand: [[karte], []] });
      if (lv) t.setAbilities(seat, hi, [RES(lv), [], []]);
      t.targetFn = heroT(seat, hi);
      t.script.push({ match: d => d.type === 'optionPicker' || d.type === 'zonePick', answer: (d) => d.type === 'zonePick' ? { heroIdx: hi, slotIdx: 0, owner: seat } : { optionId: (d.options || [])[0]?.id } });
      const r = await t.play(0, karte, { hero: 0 });
      const da = stuetz(t, seat, hi).includes(karte);
      R.check(`${karte} / ${label}: gespielt`, r === true, r);
      if (lv) {
        R.check(`${karte} / ${label}: prallt ab — nicht am Helden, Karte in der Ablage von Sitz 0`, !da && t.pile(0, 'discardPile').includes(karte) && !t.pile(0, 'hand').includes(karte), { zone: stuetz(t, seat, hi), abl: t.pile(0, 'discardPile'), hand: t.pile(0, 'hand') });
        if (status) R.check(`${karte} / ${label}: kein Status`, !status(t), t.hero(seat, hi).statuses);
      } else {
        R.check(`${karte} / ${label}: liegt am Helden`, da, { zone: stuetz(t, seat, hi), abl: t.pile(0, 'discardPile') });
        if (status) R.check(`${karte} / ${label}: Status liegt an`, status(t), t.hero(seat, hi).statuses);
      }
      R.check(`${karte} / ${label}: keine Engine-Fehler / Zustand sauber`, sauber(t), { e: t.errors, a: t.audit() });
    }
  }
  {   // Lv1: die einzige Abwehr des Zuges ist verbraucht — der zweite Curse haftet
    const t = await H.fresh({ hand: [['Curse', 'Curse'], []] });
    t.setAbilities(1, 0, [RES(1), [], []]);
    t.targetFn = heroT(1, 0);
    await t.play(0, 'Curse', { hero: 0 });
    const nach1 = stuetz(t, 1, 0).filter(x => x === 'Curse').length;
    await t.play(0, 'Curse', { hero: 0 });
    const nach2 = stuetz(t, 1, 0).filter(x => x === 'Curse').length;
    R.check('Resistance Lv1: erster Curse geblockt (0 am Helden), zweiter gleich am Zug haftet (1)', nach1 === 0 && nach2 === 1, { nach1, nach2 });
  }
  {   // Idej Projector (Artefakt-Effekt, hängt eine Idej Projection per Effekt an)
    for (const [label, lv] of [['Resistance Lv3', 3], ['ohne Resistance (Kontrolle)', 0]]) {
      const t = await H.fresh({ heroes: [['Idej Lord Daiyo', H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [['Idej Projector', 'Idej Projection'], []], gold: [100, 100] });
      t.setAbilities(0, 0, [lv ? RES(lv) : [], [], []]);
      const r = await t.play(0, 'Idej Projector');
      const da = stuetz(t, 0, 0).includes('Idej Projection');
      R.check(`Idej Projector / ${label}: gespielt (Projector verbraucht)`, r === true && !t.pile(0, 'hand').includes('Idej Projector'), { r, hand: t.pile(0, 'hand') });
      if (lv) R.check(`Idej Projector / ${label}: Projection prallt ab — bleibt auf der Hand, nicht angelegt`, !da && t.pile(0, 'hand').includes('Idej Projection'), { zone: stuetz(t, 0, 0), hand: t.pile(0, 'hand') });
      else R.check(`Idej Projector / ${label}: Projection liegt am Helden`, da, { zone: stuetz(t, 0, 0), hand: t.pile(0, 'hand') });
      R.check(`Idej Projector / ${label}: keine Engine-Fehler / Zustand sauber`, sauber(t), { e: t.errors, a: t.audit() });
    }
  }

  R.section('(c) NICHT geblockt: Fire Bomb — Ability-Entfernen UND Artefakt-Zweig bei Resistance Lv3');
  {   // Ability-Zweig: eine Ability des Resistance-Helden (Fighting) wird abgeworfen
    const t = await H.fresh({ hand: [[], []], potionDeck: [[], []] });
    t.setAbilities(1, 0, [RES(3), ['Fighting'], []]);
    t.setHand(0, ['Fire Bomb']);
    t.targetFn = (valid) => { const f = valid.find(v => v.type === 'ability' && v.owner === 1 && v.cardName === 'Fighting'); return f ? [f.id] : []; };
    const r = await t.play(0, 'Fire Bomb');
    const zon = (t.gs.players[1].abilityZones[0] || []).flat();
    R.check('Fire Bomb (Ability-Zweig): Fighting des Resistance-Helden wird abgeworfen', r === true && !zon.includes('Fighting') && t.pile(1, 'discardPile').includes('Fighting'), { r, zon, abl: t.pile(1, 'discardPile') });
    R.check('Fire Bomb (Ability-Zweig): Resistance selbst bleibt, keine Engine-Fehler', zon.filter(x => x === 'Resistance').length === 3 && sauber(t), { zon, e: t.errors, a: t.audit() });
  }
  {   // Artefakt-Zweig
    const t = await H.fresh({ hand: [[], []] });
    t.setAbilities(1, 0, [RES(3), [], []]);
    t.put(1, 0, 0, 'Club of Gobbo');
    t.setHand(0, ['Fire Bomb']);
    t.targetFn = (valid) => valid.filter(v => v.type === 'equip' && v.owner === 1).map(v => v.id);
    const r = await t.play(0, 'Fire Bomb');
    R.check('Fire Bomb (Artefakt-Zweig): Ausrüstung des Resistance-Helden wird zerstört (die Karte wählt die Artefakte, nicht den Helden)', r === true && !stuetz(t, 1, 0).includes('Club of Gobbo') && t.pile(1, 'discardPile').includes('Club of Gobbo'), { r, zone: stuetz(t, 1, 0), abl: t.pile(1, 'discardPile') });
    R.check('Fire Bomb (Artefakt-Zweig): keine Engine-Fehler / Zustand sauber', sauber(t), { e: t.errors, a: t.audit() });
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
