'use strict';
// A06-rebelliokai-33 · Karten mit eigener Zielwahl (`promptEffectTarget` ohne `sourceCard`) öffnen das Post-Target-Fenster nicht:
//   Castling / Invisibility Cloak greifen nicht
// Kartentexte: Castling „When that Hero would be affected by an opponent's card or effect, you may negate any effects that card or effect
//   would have on that Hero." · Invisibility Cloak (Reaction) feuert nach der Zielwahl eines gegnerischen Attacks/Spells auf genau 1 Ziel.
// Engine (_engine.js ≈ 28286): das Fenster öffnet in `promptEffectTarget` nur mit `config.sourceCard || config.source` – The White Army,
//   Mischief Militia - Thaw Blader / Bear Rider (und Invasion, Heli Troopers, Windstorm, Kappa Sword Slash …) übergeben keine Quelle.
// Beobachtung: Kontrolle Fireball → Castling/Cloak werden angeboten ✓. The White Army friert den Castling-Wirt, Thaw Blader (200) und Bear Rider
//   (150) schlagen auf den gefrorenen Wirt durch, ohne dass ein Angebot erscheint (Castling bleibt liegen).
// Erwartung: dieselbe Reaktion wie beim Fireball (Angebot, Wirkung negiert).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const D = H.INERT.creature;
  const P = 'Pawn of Kings [W]';
  const old = (inst, t) => { inst.turnPlayed = t.gs.turn - 1; return inst; };
  const heroPick = (valid) => { const x = valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 0); return x ? [x.id] : [valid[0].id]; };
  const castlingPrompted = (t) => t.prompts.some(p => p.d.title === 'Castling');
  const prep = async () => {
    const t = await H.fresh({ hand: [['Castling', P], []] });
    t.put(0, 0, 0, P);
    await t.play(0, 'Castling', { hero: 0 });
    t.reset(); t.gs.activePlayer = 1;
    return t;
  };

  let t = await prep();
  t.setHand(1, ['Fireball']); t.targetFn = heroPick;
  await t.play(1, 'Fireball', { hero: 0 });
  R.check('Kontrolle Fireball: Castling wird angeboten, Schaden negiert', castlingPrompted(t) && t.hp(0, 0) === 800, { hp: t.hp(0, 0) });

  t = await prep();
  t.setHand(1, ['The White Army']); t.put(1, 0, 0, D); t.put(1, 0, 1, D); t.targetFn = heroPick;
  await t.play(1, 'The White Army', { hero: 0 });
  R.check('The White Army auf den Castling-Wirt: Castling wird angeboten, Held nicht gefroren', castlingPrompted(t) && !t.hero(0, 0).statuses.frozen, { prompted: castlingPrompted(t), frozen: !!t.hero(0, 0).statuses.frozen });

  for (const [name, dmg] of [['Mischief Militia - Thaw Blader', 200], ['Mischief Militia - Bear Rider', 150]]) {
    t = await prep();
    await t.run(() => t.engine.addHeroStatus(0, 0, 'frozen', { duration: 3, appliedBy: 1 }));
    old(t.put(1, 0, 0, name), t); t.gs.currentPhase = 2; t.resetActions(1); t.targetFn = heroPick;
    await t.activateCreature(1, 0, 0);
    R.check(name + ' auf den gefrorenen Castling-Wirt: Castling wird angeboten, kein Schaden', castlingPrompted(t) && t.hp(0, 0) === 800, { prompted: castlingPrompted(t), hp: t.hp(0, 0) });
  }

  // Invisibility Cloak (Reaktion von Sitz 1) gegen The White Army von Sitz 0
  t = await H.fresh({ hand: [['The White Army'], ['Invisibility Cloak']], gold: [100, 100] });
  t.put(0, 0, 0, D); t.put(0, 0, 1, D);
  t.targetFn = (valid) => { const x = valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0); return x ? [x.id] : [valid[0].id]; };
  await t.play(0, 'The White Army', { hero: 0 });
  R.check('Invisibility Cloak gegen The White Army: Cloak wird angeboten, Held 1/0 nicht gefroren', t.prompts.some(p => /Invisibility Cloak/.test(p.d.title || '')) && !t.hero(1, 0).statuses.frozen,
    { prompts: t.prompts.map(p => p.d.type + ':' + p.d.title), frozen: !!t.hero(1, 0).statuses.frozen });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
