'use strict';
// W6-01 · Ein Token, das das Brett verlässt, fliegt NICHT mehr zu einem Stapel, sondern zerfällt an seinem Platz (Al, Welle 6, 14.10.2026:
//   „Das optische Token-Fliegen muss weg, stattdessen sollen sie (außer sie haben Träger-Karten wie bei Biomancy) desintegrieren.")
// Engine: `tokenAbgang` sendet EIN Ereignis `token_disintegrate` { owner (Brettseite), heroIdx, slotIdx, cardName, unterkarte };
//   `play_pile_transfer` für einen Token ohne Karte darunter wird in `_broadcastEvent` verworfen. Biomancy-/Boulder-Token (Potion darunter):
//   der Token zerfällt zusätzlich, die ECHTE Karte fliegt weiter – aber in den Gelöscht-Stapel (nie zur Hand/Ablage/ins Deck).
// Gemessen wird, was WIRKLICH an den Client ginge (Spieler 0 bekommt eine Socket-Attrappe, die jede Aussendung mitschneidet) – `t.events` zeigt den Aufruf VOR dem Filter.
const H = require('../../lib/h.js');
const { placeBiomancyToken } = require('../../../../cards/effects/_biomancy-shared.js');
const bio = async (t, seat, hi, slot) => (await placeBiomancyToken(t.engine, seat, hi, 'Healing Potion', 1, { slot, animate: false })).inst;
function wire(t) {
  const out = [];
  t.gs.players.forEach((p, i) => { p.socketId = 'sock' + i; });
  t.engine.io = { to: (sid) => ({ emit: (ev, d) => { if (sid === 'sock0') out.push({ ev, d }); } }), emit() {}, sockets: { sockets: new Map() } };
  return out;
}
const zerf = (out) => out.filter(o => o.ev === 'token_disintegrate').map(o => o.d);
const fluege = (out, nm) => out.filter(o => o.ev === 'play_pile_transfer' && o.d.cardName === nm && o.d.from === 'support').map(o => o.d);
const sauber = (t) => t.audit().length === 0 && t.errors.length === 0;
// Prüfung eines Token-Abgangs: genau ein Zerfall am Platz; Flüge: rein → keiner; bio → höchstens einer, und nur zum Gelöscht-Stapel.
function pruefe(R, tag, art, out, nm, ort) {
  const z = zerf(out).filter(d => d.cardName === nm);
  R.check(`${tag}: genau ein token_disintegrate`, z.length === 1, z);
  if (z[0] && ort) R.check(`${tag}: Zerfall am richtigen Platz (Seite ${ort[0]} / Held ${ort[1]} / Zone ${ort[2]})`, z[0].owner === ort[0] && z[0].heroIdx === ort[1] && z[0].slotIdx === ort[2], z[0]);
  if (z[0]) R.check(`${tag}: unterkarte = ${art === 'bio'}`, z[0].unterkarte === (art === 'bio'), z[0]);
  const f = fluege(out, nm);
  if (art === 'pur') R.check(`${tag}: KEIN Flug des Tokens zu einem Stapel/zur Hand`, f.length === 0, f);
  else R.check(`${tag}: Potion darunter fliegt höchstens zum Gelöscht-Stapel (nie Hand/Ablage/Deck)`, f.every(d => d.to === 'deleted') && f.length <= 1, f);
}
(async () => {
  const R = H.runner();
  for (const art of ['pur', 'bio']) {
    const nm = art === 'pur' ? 'Mummy Token' : 'Healing Potion';
    const mk = async (t, seat, hi, slot) => art === 'pur' ? t.put(seat, hi, slot, 'Mummy Token') : bio(t, seat, hi, slot);

    R.section(`Grundwege (${art}): Schaden / Zerstören / → Ablage / → Hand`);
    for (const weg of ['schaden', 'destroy', 'nachAblage', 'nachHand']) {
      const t = await H.fresh({ hand: [[], []], hp: 800 });
      const out = wire(t);
      const c = await mk(t, 1, 1, 2);
      out.length = 0;
      if (weg === 'schaden') await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Test', owner: 0, heroIdx: 0 }, c, 9999, 'spell'));
      if (weg === 'destroy') await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: 0, heroIdx: 0 }, c));
      if (weg === 'nachAblage') await t.run(() => t.engine.actionMoveCard(c, 'discard'));
      if (weg === 'nachHand') await t.run(() => t.engine.actionMoveCard(c, 'hand'));
      pruefe(R, `${art}/${weg}`, art, out, nm, [art === 'pur' ? 1 : 1, 1, 2]);
      R.check(`${art}/${weg}: Zustand sauber`, sauber(t), { a: t.audit(), e: t.errors });
    }

    R.section(`Gold Trap / Chasing the Legend / Tengu Windstorm / Dive Bomblebee / Missing People / Sparkfly (${art})`);
    {
      const t = await H.fresh({ gold: [100, 100] });
      const out = wire(t);
      t.putSurprise(0, 0, 'Gold Trap'); t.grantFor(0, 0, 'Gold Trap');
      await mk(t, 1, 0, 0);
      t.gs.activePlayer = 1; out.length = 0;
      t.targetFn = (valid) => { const v = valid.find(x => x.type === 'equip' && x.cardName === nm); return v ? [v.id] : undefined; };
      await t.run(() => t.engine.actionGainGold(1, 30));
      pruefe(R, `Gold Trap/${art}`, art, out, nm, [1, 0, 0]);
    }
    {
      const t = await H.fresh({ hand: [['Fireball'], ['Chasing the Legend']] });
      const out = wire(t);
      t.grantFor(1, 0, 'Chasing the Legend');
      await mk(t, 1, 1, 0); out.length = 0;
      t.targetFn = (valid) => { const v = valid.find(x => x.type === 'equip' && x.owner === 1 && x.heroIdx === 1); return v ? [v.id] : undefined; };
      await t.play(0, 'Fireball', { hero: 0 });
      pruefe(R, `Chasing the Legend/${art}`, art, out, nm, [1, 1, 0]);
    }
    {
      const t = await H.fresh({ hand: [['Tengu Windstorm'], []], discard: [['Rebelliokai Terror Tengu'], []] });
      const out = wire(t);
      await mk(t, 1, 0, 0); out.length = 0;
      t.script.push({ match: d => d.type === 'optionPicker', answer: () => ({ optionId: 'top' }) });
      t.targetFn = (valid) => { const a = valid.find(v => v.cardName === nm); return [a ? a.id : valid[0].id]; };
      await t.play(0, 'Tengu Windstorm', { hero: 0 });
      pruefe(R, `Tengu Windstorm/${art}`, art, out, nm, [1, 0, 0]);
    }
    {
      const t = await H.fresh({});
      const out = wire(t);
      const dive = t.put(0, 0, 0, 'Dive Bomblebee'); dive.turnPlayed = 1;
      const opfer = t.put(1, 2, 2, H.INERT.frail);
      await mk(t, 1, 0, 0); out.length = 0;
      t.targetFn = (valid) => { const v = valid.find(x => x.cardName === nm); return v ? [v.id] : [valid[0].id]; };
      await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 0 }, opfer));
      pruefe(R, `Dive Bomblebee/${art}`, art, out, nm, [1, 0, 0]);
    }
    {
      const t = await H.fresh({ hand: [['Missing People'], []], deckSize: 3 });
      const out = wire(t);
      await mk(t, 1, 0, 0); out.length = 0;
      t.targetFn = (valid) => { const v = valid.find(q => q.type === 'equip'); return v ? [v.id] : null; };
      await t.play(0, 'Missing People', { hero: 0 });
      pruefe(R, `Missing People/${art}`, art, out, nm, [1, 0, 0]);
    }
    {
      const t = await H.fresh({ hand: [[], []] });
      const out = wire(t);
      const tok = await mk(t, 1, 0, 0); out.length = 0;
      await t.run(() => require('../../../../cards/effects/_sparkfly-shared.js').stealBoardCardToHand(t.engine, 0, tok, 'Test'));
      pruefe(R, `Sparkfly/${art}`, art, out, nm, [1, 0, 0]);
    }

    R.section(`Inselabbau und Heldentod räumen Tokens ab (${art})`);
    {
      const t = await H.fresh({ hand: [['Flying Island in the Sky'], []], hp: 800 });
      const out = wire(t);
      await t.play(0, 'Flying Island in the Sky', { hero: 0 });
      await mk(t, 0, 0, 3); out.length = 0;
      await t.engine.actionMoveCard(t.find('Flying Island in the Sky', 'support'), 'discard');
      pruefe(R, `Inselabbau/${art}`, art, out, nm, [0, 0, 3]);
      R.check(`Inselabbau/${art}: Zustand sauber`, sauber(t), { a: t.audit(), e: t.errors });
    }
    {
      // Heldentod räumt nur Ausrüstung ab; Tokens/Kreaturen bleiben stehen → weder Zerfall noch Flug.
      const t = await H.fresh({ hand: [[], []], hp: 800 });
      const out = wire(t);
      const c = await mk(t, 1, 0, 0); out.length = 0;
      await t.run(() => t.engine.actionDealDamage({ name: 'Test', owner: 0, heroIdx: 0 }, t.gs.players[1].heroes[0], 9999, 'spell'));
      R.check(`Heldentod/${art}: Token bleibt liegen, kein Zerfall, kein Flug`, c.zone === 'support' && zerf(out).length === 0 && fluege(out, nm).length === 0, { z: c.zone, ev: out.map(o => o.ev) });
    }
    R.section(`Afflicted Pests wählt den Token (${art})`);
    {
      const t = await H.fresh({ gold: [100, 100], hand: [[], []], deck: [Array(20).fill(H.INERT.filler), Array(20).fill(H.INERT.filler)] });
      const out = wire(t);
      t.grantFor(0, 0, 'Afflicted Pests'); t.putSurprise(0, 0, 'Afflicted Pests');
      const c = await mk(t, 0, 0, 0); c.turnPlayed = 1; out.length = 0;
      t.targetFn = (valid) => [valid.find(v => v.cardName === nm).id];
      await t.play(1, 'Club of Gobbo', { hero: 0 });
      pruefe(R, `Afflicted Pests/${art}`, art, out, nm, [0, 0, 0]);
    }
  }

  R.section('Echte Kreatur ist unverändert: Flug zum Stapel bleibt, kein Zerfall');
  {
    const t = await H.fresh({ hand: [[], []], hp: 800 });
    const out = wire(t);
    const c = t.put(1, 0, 1, H.INERT.creature); out.length = 0;
    await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: 0, heroIdx: 0 }, c));
    R.check('echte Kreatur: kein token_disintegrate', zerf(out).length === 0, zerf(out));
    R.check('echte Kreatur: Flug zur Ablage bleibt', fluege(out, H.INERT.creature).length === 1, fluege(out, H.INERT.creature));
  }
  R.section('Umsetzen eines Tokens innerhalb des Bretts (Support → Support) ist kein Abgang');
  {
    const t = await H.fresh({ hand: [[], []], hp: 800 });
    const out = wire(t);
    const c = t.put(1, 0, 0, 'Mummy Token'); out.length = 0;
    await t.run(() => t.engine.actionMoveCard(c, 'support', 1, 3));
    R.check('Token auf dem Brett umgesetzt: kein Zerfall', zerf(out).length === 0, zerf(out));
  }
  R.finish();
})();
