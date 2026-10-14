'use strict';
// W5b-Z1 (zu R02-10) · No Retreat! erkennt auch Mass Routing – Entscheidung Al (Welle 5):
//   „No Retreat soll auch Mass Routing erkennen und negieren, *wenn* 1+ Creatures auf der entsprechenden Boardseite betroffen wären.
//    Generell sollen alle Effekte betroffen sein, die Karten auf der entsprechenden Seite/von entsprechenden Händen shufflen würden."
// No Retreat!: „… shuffling cards from their hand, discard pile or side of the board back into the deck." – „entsprechende Seite" = Brettseite des AKTIVIERENDEN.
// Erwartung: Mass Routing (Sitz 0, Decay Magic 1 => bis Level 1) mit ≥ 1 betroffener Kreatur auf Sitz 0s Seite: No Retreat! (Sitz 1) wird angeboten und negiert (Kreatur bleibt).
//   Nicht angeboten bei: nur Kreaturen auf Sitz 1s Seite; Kreatur über dem Level-Deckel; leerem Brett. Brainstorming/Guard Duty (Hand/Ablage) weiterhin erkannt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  async function lauf(card, aufbau) {
    const t = await H.fresh({ hand: [[card, 'Fireball'], ['No Retreat!']], hp: 800, discard: [['Fireball', 'Fireball', 'Fireball', 'Fireball'], []] });
    t.setAbilities(0, 0, [['Decay Magic'], [], []]);
    t.setAbilities(1, 0, [['Decay Magic'], [], []]);
    t.policy.confirm = true;
    t.targetFn = (valid) => valid.length ? [valid[0].id] : [];
    t.script.push({ match: d => d.type === 'cardGallery' && d.cards && d.cards.length, answer: d => ({ cardName: d.cards[0].name }) });
    aufbau(t);
    const r = await t.play(0, card, { hero: 0 });
    const gefragt = t.prompts.some(p => /No Retreat/.test(JSON.stringify(p.d).slice(0, 500)));
    return { t, r, gefragt };
  }
  const D = H.INERT.creature;
  let x = await lauf('Mass Routing', t => { t.put(0, 0, 0, D); });
  R.check('Mass Routing mit eigener Kreatur (Lv0): No Retreat! wird angeboten', x.gefragt, { r: x.r });
  R.check('  … und negiert: die Kreatur bleibt auf dem Brett, Mass Routing in der Ablage', x.t.inst(c => c.name === D && c.zone === 'support').length === 1 && x.t.pile(1, 'discardPile').includes('No Retreat!'), x.t.pile(1, 'discardPile'));
  x = await lauf('Mass Routing', t => { t.put(1, 0, 0, D); });
  R.check('Mass Routing, nur Kreatur auf der Gegnerseite (No-Retreat-Seite): NICHT angeboten', !x.gefragt, { r: x.r });
  x = await lauf('Mass Routing', t => { t.put(0, 0, 0, 'Chaorc Ruin Mourner'); });
  R.check('Mass Routing, nur Kreatur über dem Level-Deckel (Lv4 > Decay Magic 1): NICHT angeboten', !x.gefragt, { r: x.r });
  x = await lauf('Mass Routing', t => {});
  R.check('Mass Routing auf leerem Brett: NICHT angeboten', !x.gefragt, { r: x.r });
  x = await lauf('Guard Duty', t => {});
  R.check('Kontrolle Guard Duty (Hand/Ablage-Flagge): weiterhin angeboten', x.gefragt);
  R.check('keine Engine-Fehler', x.t.errors.length === 0, x.t.errors);
  R.finish();
})();
