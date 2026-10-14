'use strict';
// W4-J2 · „You may sacrifice a Creature you control that was not summoned this turn to summon this Creature as an additional Action [into the same Support Zone]" (Archer / Guardian / Warrior of Teocuilatl,
//   Suspicious Monster): das Opfer ist der Kostenpunkt und wird VOR dem Reaktionsfenster erbracht (Al, Welle 4); bei Negierung (Off Duty) bleibt das Opfer bezahlt und die neue Kreatur kommt nicht ins Spiel.
// Aufbau: Sitz 0: Dummy-Kreatur (nicht in diesem Zug beschworen) in Held 0 / Platz 0; die Kreatur auf der Hand wird auf den BELEGTEN Platz 0 geworfen (Tausch); Sitz 1 hält Off Duty.
//   Dazu der Fall „freier Platz + Opfer als Zusatzaktion" (Archer/Guardian/Warrior) und Corpse Cannibal in der Hand (darf den gehaltenen Platz nicht wegschnappen).
// Erwartung: (1) Off Duty: beim Fenster ist der Dummy schon geopfert (Ablage), nach der Negierung leer/ohne neue Kreatur, Off Duty verbraucht; (2) Kontrolle ohne Negation: neue Kreatur im Platz 0, Dummy in der Ablage;
//            (3) freier Platz (Opfer-Prompt): Off Duty → Dummy bleibt geopfert; (4) Corpse Cannibal in der Hand nimmt den gehaltenen Platz nicht.
// Aufruf: node docs/niche-tests/repro/W4-kosten/J2-opfer-tausch-teocuilatl-suspicious-monster.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const D = H.INERT.creature;
const KARTEN = ['Archer of Teocuilatl', 'Guardian of Teocuilatl', 'Warrior of Teocuilatl', 'Suspicious Monster'];
const auf = (t, name, slot) => t.inst(c => c.zone === 'support' && c.owner === 0 && c.name === name && (slot == null || c.zoneSlot === slot)).length;
async function bau(name, negieren, extraHand = []) {
  const t = await H.fresh({ hand: [[name, ...extraHand], negieren ? ['Off Duty'] : []] });
  t.put(0, 0, 0, D);
  for (const c of t.inst(c => c.zone === 'support' && c.owner === 0)) c.turnPlayed = 0;
  if (negieren) t.grantFor(1, 0, 'Off Duty');
  t.policy.confirm = true;
  t.targetFn = (v) => v.filter(x => !x.ineligible).slice(0, 1).map(x => x.id);
  t.script.push({ match: d => d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, ...(d.zones[0].owner != null ? { owner: d.zones[0].owner } : {}) }) });
  return t;
}
(async () => {
  const R = H.runner();
  for (const name of KARTEN) {
    {
      const t = await bau(name, true);
      let beimFenster = null;
      t.script.unshift({ match: d => d.type === 'confirm' && /Off Duty/.test(JSON.stringify(d)), answer: () => { beimFenster = { dummy: auf(t, D), abl: t.pile(0, 'discardPile').includes(D) }; return { confirmed: true }; }, once: true });
      const r = await t.play(0, name, { hero: 0, slot: 0 });
      R.check(`${name}: (1) Off Duty gespielt, der Bewohner war beim Fenster schon geopfert`, !!beimFenster && beimFenster.dummy === 0 && beimFenster.abl && !t.pile(1, 'hand').includes('Off Duty'), { beimFenster, r });
      R.check(`${name}: (1) negiert: Opfer bleibt bezahlt, neue Kreatur nicht im Spiel`, auf(t, D) === 0 && auf(t, name) === 0 && t.pile(0, 'discardPile').includes(D), { disc: t.pile(0, 'discardPile') });
      R.check(`${name}: (1) keine Engine-Fehler / Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
    {
      const t = await bau(name, false);
      const r = await t.play(0, name, { hero: 0, slot: 0 });
      R.check(`${name}: (2) Kontrolle: Tausch gelungen (neue Kreatur in Platz 0, Dummy in der Ablage)`, auf(t, name, 0) === 1 && auf(t, D) === 0 && t.pile(0, 'discardPile').includes(D) && !t.pile(0, 'hand').includes(name), { r, hand: t.pile(0, 'hand') });
      R.check(`${name}: (2) keine Engine-Fehler / Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
  }
  // (3) freier Platz + Opfer als Zusatzaktion (nur die drei Teocuilatl-Karten kennen diesen Weg)
  for (const name of KARTEN.slice(0, 3)) {
    {
      const t = await bau(name, true);
      const r = await t.play(0, name, { hero: 0, slot: 1 });
      R.check(`${name}: (3) freier Platz, Off Duty: Opfer bleibt bezahlt, Kreatur negiert`, auf(t, D) === 0 && auf(t, name) === 0 && !t.pile(1, 'hand').includes('Off Duty'), { r, dummies: auf(t, D), da: auf(t, name), hand: t.pile(0, 'hand') });
      R.check(`${name}: (3) keine Engine-Fehler / Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
    {
      const t = await bau(name, false);
      t.targetFn = () => null;   // Mensch: Abbrechen-Knopf der Opferwahl
      const r = await t.play(0, name, { hero: 0, slot: 1 });
      R.check(`${name}: (3b) Abbruch der Opferwahl: nichts bezahlt, Karte bleibt auf der Hand`, auf(t, D) === 1 && auf(t, name) === 0 && t.pile(0, 'hand').includes(name), { r, dummies: auf(t, D), hand: t.pile(0, 'hand') });
    }
  }
  // (4) Corpse Cannibal in der Hand darf den gehaltenen Platz nicht nehmen
  {
    const t = await bau('Suspicious Monster', false, ['Chaorc Corpse Cannibal']);
    t.grantFor(0, 0, 'Chaorc Corpse Cannibal');
    const r = await t.play(0, 'Suspicious Monster', { hero: 0, slot: 0 });
    R.check('(4) Corpse Cannibal übernimmt den gehaltenen Platz nicht: Suspicious Monster steht in Platz 0, Cannibal bleibt auf der Hand', auf(t, 'Suspicious Monster', 0) === 1 && t.pile(0, 'hand').includes('Chaorc Corpse Cannibal') && auf(t, 'Chaorc Corpse Cannibal') === 0, { r, hand: t.pile(0, 'hand') });
    R.check('(4) keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  R.finish();
})();
