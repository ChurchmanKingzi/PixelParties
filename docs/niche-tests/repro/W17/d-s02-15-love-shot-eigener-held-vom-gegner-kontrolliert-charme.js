'use strict';
// W17d · S02-15 (Teil 2): Love Shot „choose a Hero your opponent CONTROLS and perform an Attack or Spell from your hand with it“
// — ein vom Gegner kontrollierter Held MEINER Spalte ist wählbar, und der Nachguss läuft mit SEINEN Schulen (Zonen des Helden), MEINER Hand und als Zusatzaktion.
// Aufbau: Sitz 0 spielt Love Shot (Hand: Love Shot, Fireball, Cure). Held 0:2 (meine Spalte) ist vom Gegner kontrolliert (temporär, Charme/Diebstahl: actionStealHero)
//   und trägt Destruction Magic x2 (Fireball Lv2); die Helden 0:0/0:1 haben die Schule nicht.
// Erwartet: 0:2 wird angeboten; Fireball ist über 0:2 spielbar und trifft Gegnerhelden; Fireball verlässt MEINE Hand; die Kontrolle des Gegners über 0:2 ist danach wieder
//   wie vorher (Marken, Status); keine Engine-Fehler. (Ein Spiel je Prozess: darum je Kontrollart eine Datei.)
const H = require('../../lib/h.js');
async function lauf(R, variante) {
  const t = await H.fresh({ hand: [['Love Shot', 'Fireball', 'Cure'], []], deckSize: 30, abilities: { 0: { 2: [['Destruction Magic', 'Destruction Magic'], [], []] } } });
  if (variante === 'a') await t.engine.actionTakeHeroPermanently(1, 0, 2);
  else { const ok = await t.engine.actionStealHero(1, 0, 2); t.say('actionStealHero ->', ok); await new Promise(r => setTimeout(r, 300)); }   // Harness-Falle: der onTakeControl-Hook läuft asynchron nach
  const h2 = t.gs.players[0].heroes[2];
  const vorher = { by: h2.charmedBy, from: h2.charmedFromOwner, perma: h2.permaControlBy, st: JSON.stringify(h2.statuses?.charmed ?? null) };
  t.say('Marken vorher', JSON.stringify(vorher));
  let offered = null, fireballZiele = null, eligible = null;
  t.targetFn = (valid, cfg) => {
    const title = (cfg && cfg.title) || '';
    if (/Love Shot/.test(title)) { offered = valid.map(v => `${v.owner}:${v.heroIdx}`); return ['hero-0-2']; }
    if (/Fireball/.test(title)) { fireballZiele = valid.map(v => `${v.owner}:${v.heroIdx}`); return [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 1).id]; }
    return null;
  };
  t.script.push({ match: d => d.type === 'handPick' && /Love Shot/.test(d.title || ''), once: true, answer: (d) => { eligible = (d.eligibleIndices || []).map(i => t.pile(0, 'hand')[i]); const i = t.pile(0, 'hand').indexOf('Fireball'); return { selectedCards: [{ handIndex: i, cardName: 'Fireball' }] }; } });
  const hpVor = t.hp(1, 1);
  const handVor1 = t.pile(1, 'hand').length;
  const r = await t.play(0, 'Love Shot', { hero: 0 });
  t.say('Love Shot ->', r, '| angeboten', JSON.stringify(offered), '| spielbar', JSON.stringify(eligible), '| Fireball-Ziele', JSON.stringify(fireballZiele));
  R.check(`${variante}: Love Shot gespielt`, r === true, r);
  R.check(`${variante}: eigener, vom Gegner kontrollierter Held 0:2 wird angeboten`, !!offered && offered.includes('0:2'), offered);
  R.check(`${variante}: Fireball ist über 0:2 spielbar (Schule des Helden), Cure (Support Magic) nicht`, !!eligible && eligible.includes('Fireball') && !eligible.includes('Cure'), eligible);
  R.check(`${variante}: Fireball trifft den gewählten Gegnerhelden (−150)`, t.hp(1, 1) === hpVor - 150, [hpVor, t.hp(1, 1)]);
  R.check(`${variante}: Fireball liegt in MEINER Ablage, nicht mehr in meiner Hand`, t.pile(0, 'discardPile').includes('Fireball') && !t.pile(0, 'hand').includes('Fireball'), [t.pile(0, 'hand'), t.pile(0, 'discardPile')]);
  R.check(`${variante}: Hand des Gegners unberührt (Deck-Zug von Love Shot liefert +1 aus SEINEM Deck an mich)`, t.pile(1, 'hand').length === handVor1, [handVor1, t.pile(1, 'hand').length]);
  const nachher = { by: h2.charmedBy, from: h2.charmedFromOwner, perma: h2.permaControlBy, st: JSON.stringify(h2.statuses?.charmed ?? null) };
  R.check(`${variante}: Kontrolle des Gegners über 0:2 danach wie vorher`, JSON.stringify(nachher) === JSON.stringify(vorher), [vorher, nachher]);
  R.check(`${variante}: Held 0:2 weiter vom Gegner kontrolliert (heroSideOf)`, t.engine.heroSideOf(0, h2) === 1, t.engine.heroSideOf(0, h2));
  R.check(`${variante}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  R.check(`${variante}: Zustand sauber`, t.audit().length === 0, t.audit());
}
(async () => {
  const R = H.runner();
  await lauf(R, 'b');
  R.finish();
})();
