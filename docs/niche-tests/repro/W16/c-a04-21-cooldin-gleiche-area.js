'use strict';
// W16c · A04-cute-21 (Gegenprobe): Mit Spatial Crevice (bis zu 3 VERSCHIEDENE Areas) legt Cooldin keine zweite Kopie derselben Area –
// liegt Wowhalla schon aus und ist sie die einzige Area auf der Hand, geschieht nichts (Zug endet nicht); ohne Wowhalla auf dem Brett klappt es.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const W = 'Wowhalla, the Hall of the Cool', CO = 'Cooldin, King of Coolness';
  const sp = ['Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'];
  const mk = async () => H.fresh({ heroes: [[CO, ...sp], null], hand: [[W, H.INERT.filler], []], deck: [Array(8).fill(H.INERT.creature), []] });
  const waehle = (t) => t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: W, source: 'hand' }) });
  let t = await mk(); t.putArea(0, 'Spatial Crevice'); t.putArea(0, W); waehle(t);
  let r = await t.activateHero(0, 0, { phase: 2 });
  R.check('Wowhalla liegt schon aus: Cooldin legt keine zweite Kopie', t.gs.areaZones[0].filter(n => n === W).length === 1 && t.pile(0, 'hand').includes(W), { r, areas: t.gs.areaZones[0].slice(), hand: t.pile(0, 'hand') });
  t = await mk(); t.putArea(0, 'Spatial Crevice'); waehle(t);
  r = await t.activateHero(0, 0, { phase: 2 });
  R.check('Kontrolle: nur Spatial Crevice liegt aus → Cooldin legt Wowhalla', t.gs.areaZones[0].includes(W), { r, areas: t.gs.areaZones[0].slice() });
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
