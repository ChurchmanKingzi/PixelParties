'use strict';
// W4-E1 · Soul Transmigration Ritual: „Sacrifice 3 level 0 Creatures you control TO USE THIS SPELL" — das Opfer ist ein Kostenpunkt und bleibt bei Ganz-Negierung bezahlt.
// Aufbau: Sitz 0: Held 2 gefallen, 3 Level-0-Kreaturen auf dem Brett, Ritual auf der Hand; Sitz 1 hält Silence.
// Erwartung: (1) negiert (Silence): die 3 Kreaturen sind geopfert (schon VOR dem Silence-Fenster), der Held bleibt gefallen, die Karte liegt in der Ablage;
//            (2) Kontrolle ohne Negation: 3 Opfer, Held lebt und trägt den Debuff; (3) Abbruch der Opferwahl: nichts bezahlt, Karte bleibt auf der Hand, Kreaturen bleiben.
// Aufruf: node docs/niche-tests/repro/W4-kosten/E1-soul-transmigration-opfer-bleibt-bezahlt.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const D = H.INERT.creature;
async function bau(silence) {
  const t = await H.fresh({ hand: [['Soul Transmigration Ritual'], silence ? ['Silence'] : []] });
  t.put(0, 0, 0, D); t.put(0, 0, 1, D); t.put(0, 0, 2, D);
  for (const c of t.inst(c => c.zone === 'support' && c.owner === 0)) c.turnPlayed = 0;
  t.gs.players[0].heroes[2].hp = 0;
  if (silence) t.grantFor(1, 0, 'Silence');
  t.policy.confirm = true;
  t.targetFn = (v) => { const h = v.find(x => x.type === 'hero' && x.owner === 0 && x.heroIdx === 2); return h ? [h.id] : v.filter(x => !x.ineligible).slice(0, 3).map(x => x.id); };   // Heldenwahl oder Opferwahl
  return t;
}
const kreaturen = (t) => t.inst(c => c.zone === 'support' && c.owner === 0 && c.name === D).length;
(async () => {
  const R = H.runner();
  {
    const t = await bau(true);
    let beimSilence = null;
    t.script.unshift({ match: d => d.type === 'confirm' && /Silence/.test(JSON.stringify(d)), answer: () => { beimSilence = kreaturen(t); return { confirmed: true }; }, once: true });
    const r = await t.play(0, 'Soul Transmigration Ritual', { hero: 0 });
    R.check('(1) Silence wurde gespielt', beimSilence !== null && !t.pile(1, 'hand').includes('Silence'), { beimSilence, r });
    R.check('(1) die 3 Kreaturen waren beim Silence-Fenster schon geopfert (Kosten vor der Kette)', beimSilence === 0, { beimSilence });
    R.check('(1) negiert: Kreaturen bleiben geopfert', kreaturen(t) === 0, kreaturen(t));
    R.check('(1) negiert: Held 2 bleibt gefallen', t.hp(0, 2) <= 0, t.hp(0, 2));
    R.check('(1) negiert: Karte in der Ablage', t.pile(0, 'discardPile').includes('Soul Transmigration Ritual'), t.pile(0, 'discardPile'));
    R.check('(1) keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  {
    const t = await bau(false);
    await t.play(0, 'Soul Transmigration Ritual', { hero: 0 });
    R.check('(2) Kontrolle ohne Negation: 3 Kreaturen geopfert', kreaturen(t) === 0, kreaturen(t));
    R.check('(2) Kontrolle ohne Negation: Held 2 lebt', t.hp(0, 2) > 0, t.hp(0, 2));
    R.check('(2) Kontrolle: Debuff „Soul Transmitted" liegt', !!t.gs.players[0].heroes[2].statuses?.soul_transmitted, t.gs.players[0].heroes[2].statuses);
    R.check('(2) keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  {
    const t = await bau(true);
    t.targetFn = () => null;              // Mensch: Abbruch-Knopf (null)
    const r = await t.play(0, 'Soul Transmigration Ritual', { hero: 0 });
    R.check('(3) Abbruch der Opferwahl: Karte bleibt auf der Hand', t.pile(0, 'hand').includes('Soul Transmigration Ritual'), { hand: t.pile(0, 'hand'), r });
    R.check('(3) Abbruch: Kreaturen bleiben, Silence nicht verbraucht', kreaturen(t) === 3 && t.pile(1, 'hand').includes('Silence'), { kreaturen: kreaturen(t), silenceHand: t.pile(1, 'hand') });
    R.check('(3) Abbruch: keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  R.finish();
})();
