'use strict';
// W10a · Q44-Regel (Al, 15.10.2026: „'summon' erfordert grundsätzlich, dass der Beschwörer agieren kann, also nicht Frozen/Stunned ist“) · Gangster Angel
//   Kartentext: „When you summon this Creature, you may immediately summon an "Angler Angel" from your hand as an additional Action …“
// Erwartet: Angler Angel wird nur auf Plätzen eines agierfähigen Helden angeboten/beschworen. Sind alle freien Plätze bei gefrorenen Helden, gibt es kein Angebot,
//   Angler Angel bleibt auf der Hand und der Zug endet nicht. Kontrolle: bei einem agierfähigen Helden mit freiem Platz wird angeboten.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const mk = async (frozen) => {
    const t = await H.fresh({ hand: [['Gangster Angel', 'Angler Angel'], []] });
    t.grantFor(0, 0, 'Gangster Angel'); t.grantFor(0, 1, 'Angler Angel'); t.grantFor(0, 2, 'Angler Angel');
    if (frozen) { t.heroStatus(0, 1, 'frozen'); t.heroStatus(0, 2, 'frozen'); }
    t.put(0, 0, 1, H.INERT.creature); t.put(0, 0, 2, H.INERT.creature);   // Held 0: nur der Platz 0 für Gangster Angel
    return t;
  };
  let t, r;
  t = await mk(false);
  t.script.push({ match: d => d.type === 'confirm' && /Angler Angel/.test(JSON.stringify(d)), answer: () => ({ confirmed: true }) });
  t.script.push({ match: d => d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
  r = await t.play(0, 'Gangster Angel', { hero: 0, slot: 0, noGrant: true });
  R.check('Kontrolle: agierfähige Helden → Angler Angel wird angeboten und beschworen', !!t.find('Angler Angel', 'support'), { r, hand: t.pile(0, 'hand') });
  t = await mk(true);
  t.script.push({ match: d => d.type === 'confirm' && /Angler Angel/.test(JSON.stringify(d)), answer: () => ({ confirmed: true }) });
  r = await t.play(0, 'Gangster Angel', { hero: 0, slot: 0, noGrant: true });
  R.check('nur gefrorene Wirte frei: Angler Angel wird NICHT beschworen', !t.find('Angler Angel', 'support') && t.pile(0, 'hand').includes('Angler Angel'), { r, hand: t.pile(0, 'hand') });
  R.check('nur gefrorene Wirte frei: kein Angebot (Zug bleibt offen)', !t.prompts.some(p => /Angler Angel/.test(JSON.stringify(p.d))) && t.gs.activePlayer === 0, t.prompts.map(p => p.d.type));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
