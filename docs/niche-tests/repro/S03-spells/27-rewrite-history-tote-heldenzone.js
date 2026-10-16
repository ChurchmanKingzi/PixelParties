'use strict';
// S03-27 · Rewrite History stellt eine Kreatur in die Support Zone eines inzwischen BESIEGTEN Helden zurück (normales Beschwören dorthin ist verboten)
// Kartentext: „… place it into the same Support Zone it was in when it was defeated. This does not trigger that Creature's on-summon effects."
// Aufbau: Held 0 (Magic Arts 3) hat „Lamenting Knight" in Slot 0; Gegner besiegt sie per Fireball-Quelle; danach fällt Held 0 (hp 0); Held 1 (Magic Arts 3) wirkt Rewrite History.
// Kontrolle: `doPlayCreature` in die Zone eines besiegten Helden ⇒ false.
// Beobachtet: Rewrite History setzt die Kreatur in die Zone des toten Helden (`zoneFrei` prüft nur `hero.name`, nicht `hp > 0`).
// Frage an Al: Soll „same Support Zone" auch dann gelten, wenn der Held dieser Zone besiegt ist? (ja / nein)
// ★ Welle 14 (Q179, Al 16.10.2026): „Ja. Bei 'place' ist der Zustand des Heroes generell egal!" – dieses Repro prüft jetzt die NEUE Regel
//   (vorher: Kreatur darf NICHT in die Zone des besiegten Helden).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  {
    const t = await H.fresh({ hand: [[H.INERT.creature], []], hp: 800 });
    t.gs.players[0].heroes[0].hp = 0;
    const r = await t.play(0, H.INERT.creature, { hero: 0, slot: 0, noGrant: true });
    R.note('Kontrolle: normales Beschwören in die Zone eines besiegten Helden', { r, zone: t.gs.players[0].supportZones[0] });
  }
  const t = await H.fresh({ hand: [['Rewrite History'], []], hp: 800, deckSize: 20 });
  t.setAbilities(0, 0, [['Magic Arts', 'Magic Arts', 'Magic Arts'], [], []]);
  t.setAbilities(0, 1, [['Magic Arts', 'Magic Arts', 'Magic Arts'], [], []]);
  const inst = t.put(0, 0, 0, 'Lamenting Knight');
  await t.engine.actionDealCreatureDamage({ name: 'Fireball', owner: 1, controller: 1 }, inst, 9999, 'destruction_spell', { sourceOwner: 1 });
  t.gs.players[0].heroes[0].hp = 0;
  t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => ({ cardName: d.cards[0].name }) });
  const r = await t.play(0, 'Rewrite History', { hero: 1, noGrant: true });
  R.check('Kreatur wird in die Zone des besiegten Helden zurückgestellt (Welle 14: bei „place" ist der Heldenzustand egal)', r === true && t.gs.players[0].supportZones[0][0].includes('Lamenting Knight'), { r, zone: t.gs.players[0].supportZones[0] });
  R.finish();
})();
