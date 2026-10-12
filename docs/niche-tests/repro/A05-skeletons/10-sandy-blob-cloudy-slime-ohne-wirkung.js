'use strict';
// A05-skeletons-10 · Sandy Blob löst auch aus, wenn der On-Summon-Effekt gar nicht aktiviert (Regelfrage)
// Kartentext (Sandy Blob): „… when the on-summon effect of a Creature you control activates …"
// Kartentext (Cloudy Slime): „When you summon this Creature, you may immediately place a level 0 Creature from your hand …"
// Aufbau: Cloudy Slime beschworen, keine Lv-0-Kreatur auf der Hand → der Effekt hat nichts zu tun (Skript: stilles Ende).
// Lesart A (Skript): Beschwörung einer Kreatur mit onPlay-Hook zählt als „Effekt aktiviert" → Blob feuert.
// Lesart B (Text): ohne Wirkung/ohne Ziel „aktiviert" nichts → Blob feuert nicht (Mechanismus dafür existiert: `summonEffectActivates`, nur Soul Shards nutzen ihn).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Cloudy Slime'], []] });
  t.setAbilities(0, 0, [['Summoning Magic'], [], []]);
  const blob = t.put(0, 0, 2, 'Sandy Blob'); blob.turnPlayed = 1;
  t.put(1, 0, 0, H.INERT.big);
  t.targetFn = (valid) => [valid[0].id];
  await t.play(0, 'Cloudy Slime', { hero: 0, slot: 0 });
  const n = t.targets.filter(x => x.config && x.config.title === 'Sandy Blob').length;
  R.check('Lesart B: Cloudy Slime ohne Wirkung → kein Blob-Fenster', n === 0, n);
  R.finish();
})();
