'use strict';
// N4-archetypen-11 · Cloudy Slime: eine per Rocky Slime auf Stufe 0 gesenkte Handkreatur gilt nicht als „level 0 Creature"
// Kartentext (Rocky Slime): „When you summon this Creature, choose any Creature in your hand or on the board and permanently reduce its level by 1."
// Kartentext (Cloudy Slime): „When you summon this Creature, you may immediately place a level 0 Creature from your hand into the free Support Zone of any Hero you control."
// Konvention (Psychic Scout, psychic-scout.js:58): „level 0" in der Hand = `engine.effectiveCardLevel(cd, pi, { handIdx })` (Stufen-Senkungen/Offsets zählen).
// Aufbau: Hand [Rocky Slime, Cloudy Slime, Bomblebee (Lv1), Fiery Slime (Lv0)]; Rocky Slime senkt die Bomblebee dauerhaft auf Stufe 0 (Hand-Offset −1), danach wird Cloudy Slime beschworen.
// Erwartung: Die Galerie von Cloudy Slime bietet Fiery Slime UND die auf Stufe 0 gesenkte Bomblebee an.
// Beobachtet: cloudy-slime.js filtert mit der gedruckten Stufe (`(c.level || 0) === 0`, ebenso Shadowy Slime für die Ablage) → nur Fiery Slime; die Bomblebee (effektiv Stufe 0) fehlt.
// Gegenprobe: ohne Rocky-Wirkung bietet Cloudy Slime nur die echten Stufe-0-Karten an (Rocky Slime, Fiery Slime; Bomblebee Lv1 zu Recht nicht).
const H = require('../../lib/h.js');
async function lauf(mitRocky) {
  const t = await H.fresh({ hand: [['Rocky Slime', 'Cloudy Slime', 'Bomblebee', 'Fiery Slime'], ['ZZ Filler']], deckSize: 30 });
  t.setAbilities(0, 0, [['Summoning Magic'], [], []]);
  t.setAbilities(0, 1, [['Summoning Magic'], [], []]);
  t.put(1, 0, 0, H.INERT.big);
  if (mitRocky) {
    t.targetFn = (valid) => [valid.find(v => v.cardName === 'Bomblebee').id];
    await t.play(0, 'Rocky Slime', { hero: 0, slot: 0 });
  }
  let galerie = null;
  t.script.push({ match: d => d.type === 'confirm' && /Cloudy/.test(d.title || ''), answer: () => ({ confirmed: true }) });
  t.script.push({ match: d => d.type === 'cardGallery' && /Cloudy/.test(d.title || ''), answer: (d) => { galerie = d.cards.map(c => c.name); return null; } });
  await t.play(0, 'Cloudy Slime', { hero: 1, slot: 0 });
  return { t, galerie };
}
(async () => {
  const R = H.runner();
  const k = await lauf(false);
  R.check('Gegenprobe (ohne Rocky-Wirkung): Galerie = [Rocky Slime, Fiery Slime], Bomblebee (Lv1) fehlt zu Recht', JSON.stringify(k.galerie) === '["Rocky Slime","Fiery Slime"]', k.galerie);
  const r = await lauf(true);
  const lvl = r.t.engine.effectiveCardLevel(r.t.engine._getCardDB()['Bomblebee'], 0, { handIdx: r.t.pile(0, 'hand').indexOf('Bomblebee') });
  R.check('Aufbau: Rocky Slime hat die Bomblebee in der Hand effektiv auf Stufe 0 gesenkt', lvl === 0, lvl);
  R.check('Cloudy Slime bietet die effektive Stufe-0-Bomblebee an', !!r.galerie && r.galerie.includes('Bomblebee'), r.galerie);
  R.check('keine Engine-Fehler', r.t.errors.length === 0, r.t.errors);
  R.finish();
})();
