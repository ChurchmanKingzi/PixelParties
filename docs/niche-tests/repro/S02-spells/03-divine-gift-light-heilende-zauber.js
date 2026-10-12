'use strict';
// S02-03 · Divine Gift of The Light löst auch bei Support-Zaubern aus, die HP heilen (Energy Drain, Inheritance Ceremony)
// Kartentext (Divine Gift of The Light): „While this card remains in play, the first time every turn a Hero uses a Support Magic Spell that
//   does NOT heal the HP of one or more targets, that Spell's controller may choose any target on the board and heal it for 100 HP."
// Erwartung: Spells, die HP heilen, lösen die Karte nicht aus. Energy Drain („Heal the user for 100 HP …") und Inheritance Ceremony
//   („… heal the target's HP by the same amount") heilen – Kontrollprobe: Heal (Skript-Flag `includesHealing`) löst nicht aus, Divine Zeal schon.
// Beobachtet: Energy Drain und Inheritance Ceremony (mit übertragenen HP) öffnen das Gift-Fenster.
// Ursache: divine-gift-of-the-light.js Z. 218–219 liest nur das statische Skript-Flag `includesHealing`; es steht nur auf Cure, Heal und
//   Healing Melody (nicht auf Energy Drain, Inheritance Ceremony, Refreshing Night, Light Ball, …). Bei Inheritance Ceremony hängt das Heilen
//   zudem an der gewählten HP-Menge (0 = kein Heilen).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  async function mitGift(spell, setup, tweak) {
    const t = await H.fresh({ hand: [['Divine Gift of The Light'], []] });
    await t.play(0, 'Divine Gift of The Light', { hero: 0 });
    R.check('Gift liegt als Permanent (' + spell + ')', t.gs.players[0].permanents.length === 1);
    setup(t);
    t.reset();
    t.script.push({ match: d => d.type === 'optionPicker' && d._icPhase === 'hp', answer: () => ({ optionId: '60' }) });
    t.targetFn = (valid, cfg) => {
      if (cfg && cfg.title === 'Inheritance Ceremony') return [(valid.find(v => v.type === 'hero' && v.heroIdx === 1) || valid[0]).id];
      return [(valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 2) || valid[0]).id];
    };
    await t.play(0, spell, { hero: 0 });
    return { t, gift: t.targets.filter(x => x.config && x.config.title === 'Divine Gift of The Light').length };
  }
  let g = await mitGift('Heal', t => { t.hero(0, 0).hp = 500; });
  R.check('Kontrolle: Heal (heilt) löst Gift nicht aus', g.gift === 0, g.gift);
  g = await mitGift('Divine Zeal', t => { t.heroStatus(0, 0, 'burned'); });
  R.check('Kontrolle: Divine Zeal (heilt nicht) löst Gift aus', g.gift === 1, g.gift);
  g = await mitGift('Energy Drain', t => { t.hero(0, 0).hp = 500; });
  R.check('Energy Drain (heilt den Nutzer um 100) löst Gift NICHT aus', g.gift === 0, g.gift);
  g = await mitGift('Inheritance Ceremony', t => { t.hero(0, 1).hp = 300; });
  R.check('Inheritance Ceremony (heilt Zielheld um 60) löst Gift NICHT aus', g.gift === 0, { gift: g.gift, hp1: g.t.hp(0, 1) });
  R.check('keine Engine-Fehler', g.t.errors.length === 0, g.t.errors);
  R.finish();
})();
