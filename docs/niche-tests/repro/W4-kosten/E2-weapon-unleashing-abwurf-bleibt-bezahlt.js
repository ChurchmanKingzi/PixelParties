'use strict';
// W4-E2 · Weapon Unleashing: „Send all copies of a level 3 Ability from the user to the discard pile TO USE THIS SPELL" — der Abwurf ist ein Kostenpunkt und bleibt bei Ganz-Negierung bezahlt.
// Aufbau: Sitz 0: Held 0 mit Fighting Lv3 (drei Kopien), Weapon Unleashing auf der Hand; Sitz 1 hält Silence.
// Erwartung: (1) negiert (Silence): die 3 Kopien liegen schon VOR dem Silence-Fenster in der Ablage und bleiben dort; die Karte liegt in der Ablage, KEIN Second-Action-Grant;
//            (2) Kontrolle ohne Negation: Abwurf bezahlt, Grant (zweite Aktion) vorhanden; (3) Abbruch der Stapelwahl: nichts bezahlt, Karte bleibt auf der Hand, Stapel bleibt.
// Aufruf: node docs/niche-tests/repro/W4-kosten/E2-weapon-unleashing-abwurf-bleibt-bezahlt.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
async function bau(silence) {
  const t = await H.fresh({ hand: [['Weapon Unleashing'], silence ? ['Silence'] : []], abilities: { 0: { 0: [['Fighting', 'Fighting', 'Fighting'], [], []] } } });
  if (silence) t.grantFor(1, 0, 'Silence');
  t.policy.confirm = true;
  t.targetFn = (v) => [v[0].id];
  return t;
}
const stapel = (t) => (t.gs.players[0].abilityZones[0] || []).flat().filter(n => n === 'Fighting').length;
const abgelegt = (t) => t.pile(0, 'discardPile').filter(n => n === 'Fighting').length;
const grant = (t) => !!t.gs.players[0].heroes[0].buffs?.second_action_grant;
(async () => {
  const R = H.runner();
  {
    const t = await bau(true);
    let beimSilence = null;
    t.script.unshift({ match: d => d.type === 'confirm' && /Silence/.test(JSON.stringify(d)), answer: () => { beimSilence = stapel(t); return { confirmed: true }; }, once: true });
    const r = await t.play(0, 'Weapon Unleashing', { hero: 0 });
    R.check('(1) Silence wurde gespielt', beimSilence !== null && !t.pile(1, 'hand').includes('Silence'), { beimSilence, r });
    R.check('(1) der Stapel war beim Silence-Fenster schon abgeworfen (Kosten vor der Kette)', beimSilence === 0, { beimSilence });
    R.check('(1) negiert: die 3 Kopien bleiben in der Ablage', stapel(t) === 0 && abgelegt(t) === 3, { stapel: stapel(t), abgelegt: abgelegt(t) });
    R.check('(1) negiert: Karte in der Ablage, kein Second-Action-Grant', t.pile(0, 'discardPile').includes('Weapon Unleashing') && !grant(t), { disc: t.pile(0, 'discardPile'), grant: grant(t) });
    R.check('(1) keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  {
    const t = await bau(false);
    await t.play(0, 'Weapon Unleashing', { hero: 0 });
    R.check('(2) Kontrolle ohne Negation: Stapel abgeworfen', stapel(t) === 0 && abgelegt(t) === 3, { stapel: stapel(t), abgelegt: abgelegt(t) });
    R.check('(2) Kontrolle ohne Negation: Second-Action-Grant liegt', grant(t), t.gs.players[0].heroes[0].buffs);
    R.check('(2) keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  {
    const t = await bau(true);
    t.targetFn = () => null;              // Mensch: Abbruch-Knopf (null)
    const r = await t.play(0, 'Weapon Unleashing', { hero: 0 });
    R.check('(3) Abbruch der Stapelwahl: Karte bleibt auf der Hand', t.pile(0, 'hand').includes('Weapon Unleashing'), { hand: t.pile(0, 'hand'), r });
    R.check('(3) Abbruch: Stapel bleibt, Silence nicht verbraucht', stapel(t) === 3 && t.pile(1, 'hand').includes('Silence'), { stapel: stapel(t), silenceHand: t.pile(1, 'hand') });
    R.check('(3) Abbruch: keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  R.finish();
})();
