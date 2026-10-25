'use strict';
// W75 · Darion — Audit P3b: Looting legt ein weiteres Equip in den bestehenden Stapel (Pflicht-Platz), ohne Zonenfrage und auch dann, wenn alle anderen Zonen belegt sind.
// Kartentext Looting: „Choose an Equip Artifact from either discard pile and equip it to the user without paying its Cost." (Reaktion nach dem Besiegen eines Helden)
// Erwartet: Darion (Sitz 0, Held 0) traegt Blade + Crown im Platz 2 (Stapel). (a) Die Plaetze 1 und 3 sind frei: KEINE Zonenwahl („Select a Support Zone …"), Club of Gobbo landet im Stapel.
//          (b) Plaetze 1 und 3 sind mit Kreaturen belegt: Looting funktioniert trotzdem (Darion braucht keine freie Zone fuer ein weiteres Equip), Club liegt im Stapel.
// Aufruf: node docs/niche-tests/repro/W75/h-P3b-03-looting-stapelplatz.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler;
async function lauf(belegt) {
  const t = await H.fresh({ hand: [['Fireball', 'Looting'], []], hp: 800, discard: [['Club of Gobbo'], []] });
  t.setHero(0, 0, D, 800);
  t.hero(1, 2).hp = 100;
  t.setAbilities(0, 0, [['Destruction Magic'], ['Support Magic'], []]);
  t.grantFor(0, 0, 'Fireball'); t.grantFor(0, 0, 'Looting');
  const ps = t.gs.players[0];
  ps.supportZones[0][1] = [];
  const insts = ['Blade of the Frostbringer', 'Cute Crown'].map(n => { ps.supportZones[0][1].push(n); const i = t.engine._trackCard(n, 0, 'support', 0, 1); i.turnPlayed = 1; return i; });
  if (belegt) { t.put(0, 0, 0, 'ZZ Dummy'); t.put(0, 0, 2, 'ZZ Dummy'); }
  t.targetFn = (valid, config) => {
    if (config && config.title === 'Looting') {   // Zonenwahl von Looting: erste Zone, falls ueberhaupt gefragt
      const z = valid.find(v => v.type === 'equip' && v.owner === 0 && v.heroIdx === 0) || valid[0];
      return [z.id];
    }
    const h = valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 2);
    return [(h || valid[0]).id];
  };
  t.policy.confirm = true;
  let galerie = null;
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Looting', answer: d => { galerie = d.cards.map(c => c.name); return { cardName: 'Club of Gobbo' }; } });
  await t.play(0, 'Fireball', { hero: 0, noGrant: true });
  await t.drain();
  const zonenFrage = t.targets.filter(x => x.config && x.config.title === 'Looting');
  return { t, ps, galerie, zonenFrage };
}
(async () => {
  const R = H.runner();
  for (const belegt of [false, true]) {
    R.section(belegt ? '(b) Plaetze 1 und 3 mit Kreaturen belegt' : '(a) Plaetze 1 und 3 frei');
    const r = await lauf(belegt);
    R.note('lauf', JSON.stringify({ galerie: r.galerie, zone1: r.ps.supportZones[0][1], alle: r.ps.supportZones[0], zonenFrage: r.zonenFrage.length }));
    R.check('Looting wurde angeboten (Galerie)', r.galerie !== null && r.galerie.includes('Club of Gobbo'), r.galerie);
    R.check('Club of Gobbo liegt oben im Stapel (Platz 2)', JSON.stringify(r.ps.supportZones[0][1]) === JSON.stringify(['Blade of the Frostbringer', 'Cute Crown', 'Club of Gobbo']), r.ps.supportZones[0]);
    R.check('keine Zonenwahl gestellt (der Stapelplatz ist Pflicht)', r.zonenFrage.length === 0, r.zonenFrage.map(x => x.valid.map(v => v.id)));
    R.check('Sauber', r.t.errors.length === 0 && r.t.audit().length === 0, [r.t.errors, r.t.audit()]);
  }
  R.finish();
})();
