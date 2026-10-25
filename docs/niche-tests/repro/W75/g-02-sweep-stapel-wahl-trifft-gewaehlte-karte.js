'use strict';
// W75 · Darion: Sweep ueber alle Karten, die Ausruestungen angreifen/abwerfen. Im Stapel (Club of Gobbo / Blade of the Frostbringer / Cute Crown, gewaehlt: die MITTLERE) muss
// jede Karte, die per instancePick fragt, genau die gewaehlte Karte treffen (Befund Al: „entfernt wird IMMER das oberste Equip"). Beide Seiten: Stapel beim Gegner, Stapel beim Wirker.
// Kartentext: „All Artifacts equipped to this Hero share 1 Support Zone." Aufruf: node docs/niche-tests/repro/W75/g-02-sweep-stapel-wahl-trifft-gewaehlte-karte.js [Kartenname,…]   (Exit 0 = korrekt; ca. 5 Minuten)
const fs = require('fs'), path = require('path');
const H = require('../../lib/h.js');
const cards = require('../../../../data/cards.json');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler;
const NAMEN = ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown'];
const EFFECTS = path.join(__dirname, '../../../../cards/effects');
const MUSTER = /getArtifactTargets|type === 'equip'|type: 'equip'|sendBoardCardToDiscard|_ability-cost-shared|sendCardsLoop|getFreeSideEquipArtifacts|_targeting-shared|collectNonHeroBoardTargets/;
const slug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const only = process.argv[2] ? process.argv[2].split(',') : null;
const kandidaten = cards.filter(c => ['Spell', 'Attack', 'Artifact', 'Potion'].includes(c.cardType) && !(c.cardType === 'Artifact' && (c.subtype || '').toLowerCase() === 'equipment') && (c.subtype || '').toLowerCase() !== 'reaction' && (c.subtype || '').toLowerCase() !== 'surprise')
  .filter(c => { if (only) return only.includes(c.name); try { return MUSTER.test(fs.readFileSync(path.join(EFFECTS, slug(c.name) + '.js'), 'utf-8')); } catch { return false; } })
  .map(c => c.name);

async function lauf(name, eigene) {
  const t = await H.fresh({ active: 0, heroes: eigene ? [[D, 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'], [F, null, null]] : [['Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief', 'Rick, the Trigger Happy Undertaker'], [D, null, null]],
    hand: [[name, F], [F]], deck: [Array(15).fill(F), Array(15).fill(F)], gold: 500, discard: [['Club of Gobbo'], ['Club of Gobbo']] });
  const seite = eigene ? 0 : 1;
  const ps = t.gs.players[seite];
  ps.supportZones[0][1] = [];
  const insts = NAMEN.map(n => { ps.supportZones[0][1].push(n); const i = t.engine._trackCard(n, seite, 'support', 0, 1); i.turnPlayed = 1; return i; });
  const mitte = insts[1];
  let gefragt = 0;
  t.script.push({ match: d => d.type === 'instancePick', answer: () => { gefragt++; return { instId: mitte.id }; } });
  t.targetFn = (valid) => {
    const eq = valid.find(v => v.type === 'equip' && v.owner === seite && v.heroIdx === 0 && v.slotIdx === 1);
    return [(eq || valid.find(v => v.type === 'hero' && v.owner === 1) || valid[0]).id];
  };
  t.policy.confirm = true;
  const weg0 = () => insts.filter(i => !(i.zone === 'support' && i.heroIdx === 0 && i.zoneSlot === 1 && i.owner === seite)).map(i => i.name);
  let fehler = null;
  try { await Promise.race([t.play(0, name, { hero: 0, noGrant: false }), new Promise((_, rej) => setTimeout(() => rej(new Error('Zeitlimit')), 15000))]); } catch (e) { fehler = e.message; }
  try { await t.drain(); } catch { /* */ }
  return { gefragt, weg: weg0(), fehler, fehlerEngine: t.errors.slice(0, 1) };
}
(async () => {
  const R = H.runner();
  const falsch = [], ohneFrage = [], ok = [];
  for (const name of kandidaten) {
    for (const eigene of [false, true]) {
      let r; try { r = await lauf(name, eigene); } catch (e) { continue; }
      const k = `${name} (${eigene ? 'eigener' : 'gegnerischer'} Stapel)`;
      if (!r.weg.length) continue;
      if (r.weg.length > 1) continue;   // Schleifen („any number": Breaking Strike, Weapon Storm) beantwortet der Sweep nur mit einer festen Karte — siehe g-03
      if (r.gefragt > 0) { (r.weg[0] === NAMEN[1] ? ok : falsch).push(`${k}: weg=${r.weg.join('+')}`); }
      else ohneFrage.push(`${k}: weg=${r.weg.join('+')}`);
    }
  }
  if (process.env.SWEEP_OUT) fs.writeFileSync(process.env.SWEEP_OUT, JSON.stringify({ kandidaten: kandidaten.length, ok, falsch, ohneFrage }, null, 1), 'utf-8');
  R.check('jede Karte mit Rueckfrage trifft die gewaehlte (mittlere) Karte', falsch.length === 0, falsch);
  R.finish();
})();
