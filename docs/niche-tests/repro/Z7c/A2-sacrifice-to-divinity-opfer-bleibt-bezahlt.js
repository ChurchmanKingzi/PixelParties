'use strict';
// Z7c-A2 · Sacrifice to Divinity: „Sacrifice a Creature you control TO PLAY THIS CARD" — das Opfer ist ein Kostenpunkt und bleibt bei Ganz-Negierung bezahlt.
// Aufbau: Sitz 0: Sacrifice to Divinity + Divinity auf der Hand, eine ältere Kreatur (Opfer); Sitz 1 hält Silence.
// Erwartung: (1) negiert (Silence): Kreatur ist geopfert, Divinity NICHT angehängt, Karte in der Ablage; das Opfer lag schon VOR dem Silence-Fenster bezahlt.
//            (2) Kontrolle ohne Negation: Kreatur geopfert und Divinity angehängt.
//            (3) Abbruch der Opferwahl: nichts bezahlt, Karte bleibt auf der Hand, Kreatur bleibt (Regel 23.9) — auch mit Gegner-Silence (keine Kette, weil vor dem Fenster abgebrochen).
// Aufruf: node docs/niche-tests/repro/Z7c/A2-sacrifice-to-divinity-opfer-bleibt-bezahlt.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
async function bau(silence) {
  const t = await H.fresh({ hand: [['Sacrifice to Divinity', 'Divinity'], silence ? ['Silence'] : []], abilities: { 0: { 0: [[], [], []] } } });
  t.put(0, 0, 0, H.INERT.creature);
  for (const c of t.inst(c => c.zone === 'support' && c.owner === 0)) c.turnPlayed = 0;
  if (silence) t.grantFor(1, 0, 'Silence');
  t.policy.confirm = true;
  t.script.push({ match: d => d.type === 'optionPicker', answer: () => ({ optionId: 'hand' }) });
  return t;
}
const kreaturDa = (t) => t.inst(c => c.zone === 'support' && c.owner === 0 && c.name === H.INERT.creature).length === 1;
(async () => {
  const R = H.runner();
  {
    const t = await bau(true);
    let beimSilence = null;
    t.script.unshift({ match: d => d.type === 'confirm' && /Silence/.test(JSON.stringify(d)), answer: () => { beimSilence = kreaturDa(t); return { confirmed: true }; }, once: true });
    const r = await t.play(0, 'Sacrifice to Divinity', { hero: 0 });
    R.check('(1) Silence wurde gespielt', beimSilence !== null && !t.pile(1, 'hand').includes('Silence'), { beimSilence });
    R.check('(1) die Kreatur war beim Silence-Fenster schon geopfert (Kosten vor der Kette)', beimSilence === false, { beimSilence });
    R.check('(1) negiert: Kreatur bleibt geopfert', !kreaturDa(t));
    R.check('(1) negiert: Divinity nicht angehängt', !t.gs.players[0].abilityZones[0].flat().includes('Divinity'), t.gs.players[0].abilityZones[0]);
    R.check('(1) negiert: Karte in der Ablage', t.pile(0, 'discardPile').includes('Sacrifice to Divinity'), t.pile(0, 'discardPile'));
    R.check('(1) keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit(), r });
  }
  {
    const t = await bau(false);
    await t.play(0, 'Sacrifice to Divinity', { hero: 0 });
    R.check('(2) Kontrolle ohne Negation: Kreatur geopfert', !kreaturDa(t));
    R.check('(2) Kontrolle ohne Negation: Divinity angehängt', t.gs.players[0].abilityZones[0].flat().includes('Divinity'), t.gs.players[0].abilityZones[0]);
    R.check('(2) keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  {
    const t = await bau(true);
    t.policy.cancelTargets = true;        // Mensch: Abbruch-Knopf (null)
    t.policy.cancelStyle = 'null';
    const r = await t.play(0, 'Sacrifice to Divinity', { hero: 0 });
    R.check('(3) Abbruch der Opferwahl: Karte bleibt auf der Hand', t.pile(0, 'hand').includes('Sacrifice to Divinity'), { hand: t.pile(0, 'hand'), r });
    R.check('(3) Abbruch: Kreatur bleibt, Silence nicht verbraucht', kreaturDa(t) && t.pile(1, 'hand').includes('Silence'), { kreatur: kreaturDa(t), silenceHand: t.pile(1, 'hand') });
    R.check('(3) Abbruch: keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  R.finish();
})();
