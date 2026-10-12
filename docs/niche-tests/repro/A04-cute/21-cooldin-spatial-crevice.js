'use strict';
// A04-cute-21 · Cooldin ist gesperrt, sobald IRGENDEINE Area liegt – auch wenn Spatial Crevice (bis zu 3 Areas) Platz lässt
//
// Kartentext (Cooldin): "You may once per turn choose a level 3 or lower Area from your hand or deck and play it as an additional Action, regardless of
//   its level. Immediately end your turn afterwards."  Spatial Crevice: "You may control up to 3 different Areas."
// Erwartung: Cooldin kann eine Area legen, solange `canPlaceAnotherArea` Platz meldet (Gegenprobe mit leerer Area-Zone ✓).
// Beobachtet: Mit liegender Spatial Crevice (Limit 3, `canPlaceAnotherArea(0, Wowhalla) === true`) ist Cooldins Heldeneffekt nicht aktivierbar.
// Ursache: cards/effects/cooldin-king-of-coolness.js:215 `canActivateHeroEffect`: `if ((gs.areaZones?.[pi] || []).length > 0) return false;` statt
//   `engine.canPlaceAnotherArea(pi, cardName)` (der normale Spielweg prüft das, `_engine.js` Z. 20068/20884).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const W = 'Wowhalla, the Hall of the Cool', CO = 'Cooldin, King of Coolness';
  const sp = ['Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'];
  const mk = async () => H.fresh({ heroes: [[CO, ...sp], null], hand: [[W, H.INERT.filler], []], deck: [Array(8).fill(H.INERT.creature), []] });
  const waehle = (t) => t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: W, source: 'hand' }) });
  let t = await mk(); waehle(t);
  let r = await t.activateHero(0, 0, { phase: 2 });
  R.check('Gegenprobe (leere Area-Zone): Cooldin legt Wowhalla', (t.gs.areaZones[0] || []).includes(W), { r });
  t = await mk(); t.putArea(0, 'Spatial Crevice'); waehle(t);
  R.note('canPlaceAnotherArea(0, Wowhalla) mit Spatial Crevice', t.engine.canPlaceAnotherArea(0, W));
  r = await t.activateHero(0, 0, { phase: 2 });
  R.check('Mit Spatial Crevice: Cooldin legt Wowhalla', (t.gs.areaZones[0] || []).includes(W), { r, areas: t.gs.areaZones[0] });
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
