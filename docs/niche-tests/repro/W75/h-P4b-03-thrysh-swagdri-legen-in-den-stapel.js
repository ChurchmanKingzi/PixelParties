'use strict';
// W75 · Darion — Thrysh, Robber of Coolness und Swagdri, Forger of Coolness legen ein Equip in den Equip-Stapel (Audit P4b, Klasse C).
// Kartentext Thrysh: „You may once per turn search your deck or Coolness Stack for an Artifact that can be played from the top of your Coolness Stack and immediately play it as if it was the top card of your Coolness Stack."
// Kartentext Swagdri: „Once per turn, if the top card of your Coolness Stack is an Artifact, you may immediately play it without paying its Cost as if it was part of your hand. …"
// Fehler vorher: Thrysh bot nur FREIE Zonen an — Darion mit Stapel und ohne freie Zone: Thrysh war nicht aktivierbar; mit freier Zone wurde eine „freie" Zone angeklickt, obwohl das Equip in den Stapel gehoert.
//                Beide Skripte stellten bei der Platzwahl die sinnlose Rueckfrage „welches Equip meinst du?" (der Stapelplatz ist ein Platz, keine Karte).
// Erwartet: das Equip landet im Stapel, es gibt keinen Zonenwahl-Zwang und keine Kartenrueckfrage. Aufruf: node docs/niche-tests/repro/W75/h-P4b-03-thrysh-swagdri-legen-in-den-stapel.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler, MOD = 'Modnir, Hammer of Coolness';
const THRYSH = 'Thrysh, Robber of Coolness', SWAGDRI = 'Swagdri, Forger of Coolness';
function stapel(t, seat, namen, slot = 1, hi = 0) {
  const ps = t.gs.players[seat]; ps.supportZones[hi][slot] = [];
  return namen.map(n => { ps.supportZones[hi][slot].push(n); const i = t.engine._trackCard(n, seat, 'support', hi, slot); i.turnPlayed = 1; return i; });
}
const NAMEN = ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown'];
(async () => {
  const R = H.runner();
  for (const wer of [THRYSH, SWAGDRI]) {
    for (const mitFreierZone of [false, true]) {
      R.section(`${wer} — Darion mit 3-Karten-Stapel, ${mitFreierZone ? 'eine Zone frei' : 'KEINE Zone frei'}`);
      const t = await H.fresh({ active: 0, heroes: [[D, null, null], [F, null, null]], hand: [[F], [F]], deck: [[MOD, F, F], []], gold: 100 });
      const w = t.put(0, 0, 0, wer); w.turnPlayed = 1;
      if (!mitFreierZone) { const c = t.put(0, 0, 2, H.INERT.creature); c.turnPlayed = 1; }
      stapel(t, 0, NAMEN, 1, 0);
      const ps = t.gs.players[0];
      if (wer === SWAGDRI) { ps.coolnessStack.push(MOD); t.engine._trackCard(MOD, 0, 'coolnessStack'); }
      t.phase(2);
      t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: MOD, source: 'deck' }) });
      let angebot = null;
      t.targetFn = (valid) => { angebot = valid.map(v => v.id); const v = valid.find(x => x.type === 'equip') || valid[0]; return [v.id]; };
      const atk0 = t.hero(0, 0).atk;
      const r = await t.activateCreature(0, 0, 0);
      R.note('ergebnis', JSON.stringify({ r, zonen: ps.supportZones[0], angebot, prompts: t.prompts.map(p => p.d.type + ':' + (p.d.title || '')) }));
      R.check('Aktivierung gelang', r === true, r);
      R.check('Modnir liegt oben im Stapel (Platz 1), nicht in einer anderen Zone', JSON.stringify(ps.supportZones[0][1]) === JSON.stringify([...NAMEN, MOD]), ps.supportZones[0]);
      R.check('angeboten wurde nur der Stapelplatz (+ Held), keine freie Zone', JSON.stringify(angebot) === '["equip-0-0-1","hero-0-0"]', angebot);
      R.check('keine Kartenrueckfrage (instancePick)', !t.prompts.some(p => p.d.type === 'instancePick'), t.prompts.map(p => p.d.type));
      R.check('Modnir wirkt: +100 ATK', t.hero(0, 0).atk === atk0 + 100, [atk0, t.hero(0, 0).atk]);
      R.check('sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
    }
  }

  R.section('Swagdri spielt eine Stack-Spitze „The Yeeting" gratis auf ein Equip im GEGNER-Stapel (mittlere Karte)');
  {
    const t = await H.fresh({ active: 0, heroes: [[F, null, null], [D, null, null]], hand: [[F], [F]], gold: 100 });
    const w = t.put(0, 0, 0, SWAGDRI); w.turnPlayed = 1;
    const ins = stapel(t, 1, NAMEN, 1, 0);
    const ps = t.gs.players[0];
    ps.coolnessStack.push('The Yeeting'); t.engine._trackCard('The Yeeting', 0, 'coolnessStack');
    t.phase(2);
    t.script.push({ match: d => d.type === 'instancePick', answer: () => ({ instId: ins[1].id }) });
    t.targetFn = (valid) => { const v = valid.find(x => x.type === 'equip' && x.owner === 1 && x.slotIdx === 1); return v ? [v.id] : [valid[0].id]; };
    const r = await t.activateCreature(0, 0, 0);
    R.check('nur die mittlere Karte zerstoert', JSON.stringify(t.gs.players[1].supportZones[0][1]) === '["Club of Gobbo","Cute Crown"]' && t.pile(1, 'discardPile').includes('Blade of the Frostbringer'), [t.gs.players[1].supportZones[0], t.pile(1, 'discardPile')]);
    R.check('Yeeting geloescht (Swagdri)', t.pile(0, 'deletedPile').includes('The Yeeting'), t.pile(0, 'deletedPile'));
    R.check('sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})();
