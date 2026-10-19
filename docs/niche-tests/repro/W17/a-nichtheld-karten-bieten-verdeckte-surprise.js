'use strict';
// W17a · Karten mit dem Textmuster „any card on the board that is not a Hero" (Al, 19.10.2026, zu Scrap Plow A03-16):
//   „Ja, das gilt grundsätzlich für Effekte, die ‚any card on the board that is not a Hero' treffen können" - also auch verdeckte Surprises.
//
// Geprüft wird die Zielmenge: eine verdeckte Surprise des Gegners wird angeboten, und zwar mit der vom Client klickbaren ID/Art (`surprise-<Seite>-<Held>`, Typ
// 'surprise'; die alte `equip-…-surprise`-ID war im Client unsichtbar und ist bei Coolness Overcharge, Tengu Windstorm, Wall Breaker General Ralzish und
// Sparkfly Worker/Queen angeglichen). The Yeeting teilt die Menge mit Scrap Plow (gemeinsamer Sammler) und dient als Kontrolle.
// Nicht angeglichen (eigene Regel / anderes Muster): Dive Bomblebee ("opponent's side" = vom Gegner kontrolliert, Al 14.10.2026, W5a), Bad Birthday Girl Cecilia (kein Skript).
// Exit 0 = korrekt.
const H = require('../../lib/h.js');
const D = H.INERT.creature;
const hatSurprise = (liste) => (liste || []).some(x => x.type === 'surprise' && x.id === 'surprise-1-1' && x.name === 'Booby Trap');
const kurz = (valid) => valid.map(v => ({ id: v.id, type: v.type, name: v.cardName }));

async function mitSurprise(opts) {
  const t = await H.fresh(opts);
  t.putSurprise(1, 1, 'Booby Trap');
  t.put(1, 0, 0, D);
  return t;
}
function fange(t) {
  const sicht = { liste: null, alle: [] };
  t.targetFn = (valid) => { const l = kurz(valid); sicht.alle.push(l); if ((l || []).some(x => x.type === 'surprise')) sicht.liste = l; return null; };
  return sicht;
}

(async () => {
  const R = H.runner();

  R.section('Coolness Overcharge');
  { const t = await mitSurprise({ hand: [['Coolness Overcharge'], []] });
    t.gs.players[0].coolnessStack = Array(6).fill('Cute Cat');
    const s = fange(t);
    await t.play(0, 'Coolness Overcharge');
    R.check('verdeckte Surprise wird angeboten (surprise-1-1)', hatSurprise(s.liste), s.alle);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

  R.section('Tengu Windstorm');
  { const t = await mitSurprise({ hand: [['Tengu Windstorm'], []] });
    t.setDiscard(0, ['Rebelliokai Terror Tengu']);
    const s = fange(t);
    await t.play(0, 'Tengu Windstorm');
    R.check('verdeckte Surprise wird angeboten (surprise-1-1)', hatSurprise(s.liste), s.alle);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

  R.section('The Yeeting (Kontrolle, gemeinsamer Sammler)');
  { const t = await mitSurprise({ hand: [[], []] });
    const s = fange(t);
    const erst = t.targetFn;
    t.targetFn = (valid, cfg) => (valid.every(v => v.type === 'hero') ? [valid[0].id] : erst(valid, cfg));   // erst „Choose a Hero you control", dann das Brettziel
    await t.play(0, 'The Yeeting');
    R.check('verdeckte Surprise wird angeboten (surprise-1-1)', hatSurprise(s.liste), s.alle);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

  R.section('Wall Breaker General Ralzish');
  { const RZ = 'Wall Breaker General Ralzish';
    const t = await mitSurprise({ hand: [[], []] });
    t.setHero(0, 0, RZ, 800);
    t.put(0, 0, 0, D).turnPlayed = 1; t.put(0, 0, 1, D).turnPlayed = 1;
    const s = fange(t);
    await t.activateHero(0, 0, { effect: RZ, phase: 2 });
    R.check('verdeckte Surprise wird angeboten (surprise-1-1)', hatSurprise(s.liste), s.alle);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

  R.section('Sparkfly Worker (Beschwörung unter Sparkfly Queen)');
  { const t = await mitSurprise({ hand: [['Sparkfly Worker'], []] });
    t.put(0, 0, 0, 'Sparkfly Queen').turnPlayed = 1;
    const s = fange(t);
    await t.play(0, 'Sparkfly Worker', { hero: 0, slot: 1 });
    R.check('verdeckte Surprise wird angeboten (surprise-1-1)', hatSurprise(s.liste), s.alle);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
