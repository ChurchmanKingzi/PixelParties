'use strict';
// NK-05 · Luck und Liquid Luck (Entscheidung Al, 23.10.2026):
//  1. Reaction- und Surprise-Namen sind deklarierbar. Reactions zählen beim Ausspielen, Surprises bei der AKTIVIERUNG (nicht beim verdeckten Setzen).
//  2. Wiederbelebte Creatures aus der Ablage zählen, wiederbelebte Helden nicht.
// Beide Karten hängen am selben Beobachter (`_card-played-shared.js`), die Szenen laufen deshalb für beide.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const LL = 'Liquid Luck';
  const DECK = ['Fireball', 'Healing Potion', 'Treasure Chest', ...Array(9).fill('ZZ Dummy')];
  // Sitz 0 deklariert `name`; liefert { t, gain() } — gain = Handzuwachs von Sitz 0 seit der Deklaration.
  async function szene(variante, name, o = {}) {
    const t = await H.fresh({ hand: [variante === 'liquid' ? [LL] : [], o.hand1 || []], deck: [DECK.slice(), Array(10).fill('ZZ Dummy')], gold: 100 });
    t.script.push({ match: d => d.type === 'cardNamePicker', answer: () => ({ cardName: name }) });
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === LL, answer: () => ({ cardName: 'Treasure Chest' }) });
    if (o.prep) await o.prep(t);
    if (variante === 'liquid') await t.play(0, LL);
    else {
      t.setAbilities(0, 0, [['Luck'], [], []]);
      t.gs.activePlayer = 0; t.phase(2);
      await t.run(() => t.host.doActivateFreeAbility(t.room, 0, { heroIdx: 0, zoneIdx: 0 }));
    }
    const vor = t.pile(0, 'hand').length;
    return { t, gain: () => t.pile(0, 'hand').length - vor, soll: variante === 'liquid' ? 1 : 2 };
  }
  for (const variante of ['luck', 'liquid']) {
    const V = variante === 'luck' ? 'Luck' : 'Liquid Luck';
    R.section(`${V}`);
    {
      const { t } = await szene(variante, 'Gold Trap');
      const pn = t.prompts.find(p => p.d.type === 'cardNamePicker')?.d;
      R.check(`${V}: Wähler bietet Reaction- und Surprise-Namen an`, pn && pn.cardNames.includes('Gold Trap') && pn.cardNames.includes('Divine Gift of the Guardian') && pn.cardNames.includes('Cactus Creature'), pn && pn.cardNames.length);
    }
    // Spell-Reactions in den Engine-Fenstern (Test Flight: Post-Target; Martyry: Umleiter-Fenster) und eine Artefakt-Reaction (Anti-Magnet: Umleiter-Fenster).
    // Die Schule steht am Wirker: Test Flight → Held 0 mit Magic Arts 2 (Meteor Crash ist Stufe 1); Martyry → Held 1 mit Support Magic 1 schützt Held 0.
    for (const [rx, angriff, schulen] of [['Test Flight', 'Meteor Crash', [1, 0, ['Magic Arts', 'Magic Arts']]], ['Anti-Magnet', 'Meteor Crash'], ['Martyry', 'Meteor Crash', [1, 1, ['Support Magic']]]]) {
      const s = await szene(variante, rx, { hand1: [rx], prep: async (t) => { if (schulen) t.setAbilities(1, schulen[1], [schulen[2], [], []]); t.grantFor(1, 0, rx); t.put(1, 0, 1, H.INERT.big); } });
      const { t } = s;
      t.targetFn = (valid) => { const v = valid.find(x => x.owner === 1 && x.type === 'hero' && x.heroIdx === 0) || valid.find(x => x.owner === 1); return v ? [v.id] : null; };
      await t.play(0, angriff, { hero: 0 });
      const ausgespielt = [t.pile(1, 'discardPile'), t.pile(1, 'deletedPile')].flat().includes(rx);
      R.check(`${V}: Reaction ${rx} wird vom Gegner ausgespielt …`, ausgespielt, { discard: t.pile(1, 'discardPile'), hand: t.pile(1, 'hand') });
      if (ausgespielt) R.check(`${V}: … und löst genau einmal aus (${s.soll})`, s.gain() === s.soll, { gain: s.gain(), errors: t.errors.slice(0, 2) });
    }
    {   // Surprise verdeckt setzen: kein Auslöser
      const s = await szene(variante, 'Gold Trap', { hand1: ['Gold Trap'] });
      const { t } = s;
      await s.t.endTurn();
      const v1 = s.gain();
      await t.play(1, 'Gold Trap', { hero: 0 });
      R.check(`${V}: Gold Trap verdeckt gesetzt (Zug des Gegners): KEIN Auslöser`, t.gs.players[1].surpriseZones[0].includes('Gold Trap') && s.gain() === v1 && t.lg('liquid_luck_trigger').length === 0 && t.lg('luck_trigger').length === 0, { gain: s.gain() - v1, zonen: t.gs.players[1].surpriseZones });
    }
    {   // Spell-Surprise aktiviert
      const s = await szene(variante, 'Gold Trap', { prep: async (t) => { t.grantFor(1, 0, 'Gold Trap'); t.putSurprise(1, 0, 'Gold Trap'); } });
      const { t } = s;
      await t.run(() => t.engine.actionGainGold(0, 5));
      R.check(`${V}: Gold Trap AKTIVIERT: löst genau einmal aus`, s.gain() === s.soll, { gain: s.gain(), errors: t.errors.slice(0, 2), log: t.lg('surprise_activated').length });
    }
    {   // Kreatur-Surprise aktiviert
      const s = await szene(variante, 'Cactus Creature', { prep: async (t) => { t.grantFor(1, 0, 'Cactus Creature'); t.putSurprise(1, 0, 'Cactus Creature'); } });
      const { t } = s;
      await t.run(() => t.engine.addHeroStatus(1, 1, 'frozen', { appliedBy: 0 }));
      R.check(`${V}: Cactus Creature (Kreatur-Surprise) AKTIVIERT: löst genau einmal aus`, t.lg('surprise_activated').length > 0 && s.gain() === s.soll, { gain: s.gain(), aktiviert: t.lg('surprise_activated').length, errors: t.errors.slice(0, 2) });
    }
    {   // Wiederbelebung einer Creature aus der Ablage: zählt
      const s = await szene(variante, 'Cute Bird');
      const { t } = s;
      await t.endTurn();
      t.gs.players[1].discardPile = ['Cute Bird'];
      const g0 = s.gain();
      await t.run(() => t.engine.actionPlaceCreature('Cute Bird', 1, 0, 0, { source: 'discard', sourceName: 'Test', fireHooks: true }));
      R.check(`${V}: Wiederbelebung einer Creature vom Discard zählt`, s.gain() - g0 === s.soll, { gain: s.gain() - g0 });
    }
    {   // Wiederbelebung eines Helden: zählt nicht (deklariert: der Heldenname)
      const heldName = H.BLANK_HEROES_B[0];
      const s = await szene(variante, heldName);
      const { t } = s;
      await t.endTurn();
      const h = t.hero(1, 0);
      h.hp = 1;
      await t.run(() => t.engine.actionDealDamage({ name: 'Test', owner: 0, heroIdx: 0 }, h, 50, 'creature'));
      const tot = h.hp <= 0;
      const g0 = s.gain();
      await t.run(() => t.engine.actionReviveHero(1, 0, 100, {}));
      R.check(`${V}: Held ${heldName} war tot und lebt wieder`, tot && h.hp > 0, { tot, hp: h.hp });
      R.check(`${V}: Wiederbelebung eines Helden zählt NICHT`, s.gain() - g0 === 0, { gain: s.gain() - g0, errors: t.errors.slice(0, 2) });
    }
    {   // Gegenprobe: normales Ausspielen einer Normal-Karte zählt weiter
      const s = await szene(variante, 'Fireball', { hand1: ['Fireball'] });
      const { t } = s;
      await t.endTurn();
      t.targetFn = (valid) => { const v = valid.find(x => x.owner === 0) || valid[0]; return v ? [v.id] : null; };
      const g0 = s.gain();
      await t.play(1, 'Fireball', { hero: 0 });
      R.check(`${V}: Gegenprobe Fireball zählt weiter`, s.gain() - g0 === s.soll, { gain: s.gain() - g0 });
      R.check(`${V}: keine Engine-Fehler / Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
  }
  R.finish();
})();
