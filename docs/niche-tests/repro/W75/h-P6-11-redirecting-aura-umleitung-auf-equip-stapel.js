'use strict';
// W75 · Darion · P6 (Engine `applyRedirectWindows`) — Redirecting Aura lenkt eine Artefakt-Wahl (Overheat, „hitsBearer") auf ein Artefakt eines ANDEREN eigenen Helden um. Liegt das neue Ziel in Darions
// Equip-Stapel, muss die Karte des Stapels gewaehlt werden, die dann auch getroffen wird (nicht die oberste/erste).
// Kartentext Redirecting Aura: „When that Hero would be hit by an opponent's Spell or Creature effect, you may redirect that hit to any other target you control …"; Overheat: „Choose an Artifact equipped to a
// Hero. It is sent to the discard pile and its Hero takes … damage."  Darion: „All Artifacts equipped to this Hero share 1 Support Zone."
// Erwartet: Sitz 1: Held 0 (Tushu) traegt Redirecting Aura + Club of Gobbo, Held 1 (Darion) den Stapel [Blade, Crown, Glass Sword]. Sitz 0 waehlt mit Overheat den Club; Sitz 1 lenkt um und waehlt im Stapel die Crown:
// nur die Crown geht in die Ablage, Blade und Glass Sword bleiben liegen, der Club bleibt liegen.
// Aufruf: node docs/niche-tests/repro/W75/h-P6-11-redirecting-aura-umleitung-auf-equip-stapel.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', T = 'Tushu, the Knowledge Keeper', F = H.INERT.filler;
(async () => {
  const R = H.runner();
  const t = await H.fresh({ active: 0, heroes: [[T, null, null], [T, D, null]], hand: [['Overheat'], [F]], gold: 500 });
  t.put(1, 0, 0, 'Redirecting Aura');
  const club = t.put(1, 0, 1, 'Club of Gobbo'); club.turnPlayed = 1;
  const ps = t.gs.players[1];
  ps.supportZones[1][0] = [];
  const ins = ['Blade of the Frostbringer', 'Cute Crown', 'Glass Sword'].map(n => { ps.supportZones[1][0].push(n); const i = t.engine._trackCard(n, 1, 'support', 1, 0); i.turnPlayed = 1; return i; });
  t.targetFn = (valid, cfg) => {
    if (cfg && cfg.title === 'Overheat') return [valid.find(v => v.type === 'equip' && v.owner === 1 && v.heroIdx === 0 && v.slotIdx === 1).id];
    return undefined;
  };
  t.script.push({ match: d => d.type === 'instancePick', answer: () => ({ instId: ins[1].id }) });
  t.policy.confirm = true;
  await t.play(0, 'Overheat', { hero: 0 });
  await t.drain();
  R.note('lauf', JSON.stringify({ darion: ps.supportZones[1][0], tushu: ps.supportZones[0], dis: t.pile(1, 'discardPile'), prompts: t.prompts.map(p => p.pi + ':' + p.d.type + ':' + (p.d.title || '')) }));
  R.check('es gab die Rueckfrage „welches Equip?"', t.prompts.some(p => p.d.type === 'instancePick'), t.prompts.map(p => p.d.type));
  R.check('nur die Crown aus dem Stapel ist in der Ablage', JSON.stringify(ps.supportZones[1][0]) === JSON.stringify(['Blade of the Frostbringer', 'Glass Sword']) && t.pile(1, 'discardPile').includes('Cute Crown'), [ps.supportZones[1][0], t.pile(1, 'discardPile')]);
  R.check('der Club bei Tushu bleibt liegen', ps.supportZones[0][1].includes('Club of Gobbo'), ps.supportZones[0]);
  R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  R.finish();
})();
