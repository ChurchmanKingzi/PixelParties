'use strict';
// W14b · Q150 (R01-06, Divine Gift of Time) · Al, 16.10.2026: „Ja, Gift of Time soll auf **alles** reagieren können, was den Discard erreicht, inklusive zerstörter Equips/Attachments oder genutzter Surprises!"
// Kartentext: „Play this card immediately when 1 or more cards are sent to your discard pile from anywhere. Add those cards to your hand instead."
// Erwartet: jede Karte, die die Ablage des Time-Besitzers erreicht, öffnet EINE Abfrage „Divine Gift of Time": Mill, Abwurf, Kreaturentod, zerstörte Ausrüstung,
//   zerstörtes Attachment, ausgelöste/genutzte Surprise, gewirkter Zauber. Doppelte Meldungen (Hook + zentrale Meldung) zählen einmal. Karten des GEGNERS lösen nicht aus.
const H = require('../../lib/h.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const gefragt = (t) => t.prompts.filter(p => p.d.title === 'Divine Gift of Time');
(async () => {
  const R = H.runner();
  const szene = async (extra = {}) => H.fresh({ hand: [['Divine Gift of Time', 'ZZ Filler'], extra.hand1 || []], ...extra.opts });

  R.section('Mill (Kontrolle) – eine Abfrage mit beiden Karten');
  {
    const t = await szene();
    await t.run(() => t.engine.actionMillCards(0, 2, { selfInflicted: true }));
    await sleep(50);
    const f = gefragt(t);
    R.check('Mill 2: genau EINE Abfrage', f.length === 1, f.length);
    R.check('Abfrage nennt zwei Karten (nicht vier)', /^2 cards/.test(f[0]?.d.message || ''), f[0]?.d.message);
    R.check('beide Karten auf der Hand, Time in der Ablage', t.pile(0, 'hand').length === 2 + 2 - 1 && t.pile(0, 'discardPile').includes('Divine Gift of Time'), { hand: t.pile(0, 'hand'), abl: t.pile(0, 'discardPile') });
    R.check('keine Fehler / sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }

  R.section('Handabwurf');
  {
    const t = await szene();
    await t.run(() => t.engine.actionDiscardHandCard(0, 'ZZ Filler', 1, {}));
    await sleep(50);
    R.check('Abwurf öffnet die Abfrage, Karte zurück auf der Hand', gefragt(t).length === 1 && t.pile(0, 'hand').includes('ZZ Filler'), { f: gefragt(t).length, hand: t.pile(0, 'hand') });
  }

  R.section('Kreaturentod');
  {
    const t = await szene();
    const k = t.put(0, 0, 0, H.INERT.frail);
    await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: 1 }, k));
    await sleep(50);
    R.check('Kreaturentod öffnet die Abfrage', gefragt(t).length === 1 && t.pile(0, 'hand').includes(H.INERT.frail), { f: gefragt(t).length, hand: t.pile(0, 'hand') });
  }

  R.section('zerstörtes Attachment (Curse)');
  {
    const t = await szene();
    const c = t.put(0, 0, 0, 'Curse');
    await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: 1 }, c));
    await sleep(50);
    R.check('Attachment → Ablage öffnet die Abfrage, Curse auf der Hand', gefragt(t).length === 1 && t.pile(0, 'hand').includes('Curse'), { f: gefragt(t).length, hand: t.pile(0, 'hand'), abl: t.pile(0, 'discardPile') });
  }

  R.section('zerstörte Ausrüstung (Glass Sword)');
  {
    const t = await szene();
    const e = t.put(0, 0, 0, 'Glass Sword');
    await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: 1 }, e));
    await sleep(50);
    R.check('Ausrüstung → Ablage öffnet die Abfrage, Glass Sword auf der Hand', gefragt(t).length === 1 && t.pile(0, 'hand').includes('Glass Sword'), { f: gefragt(t).length, hand: t.pile(0, 'hand'), abl: t.pile(0, 'discardPile') });
  }

  R.section('ausgelöste Surprise (Booby Trap)');
  {
    const t = await szene({ hand1: ['Fireball'] });
    t.putSurprise(0, 0, 'Booby Trap'); t.grantFor(0, 0, 'Booby Trap');
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 0).id];
    await t.play(1, 'Fireball', { hero: 0 });
    await sleep(50);
    R.check('genutzte Surprise → Ablage öffnet die Abfrage, Booby Trap auf der Hand', gefragt(t).length >= 1 && t.pile(0, 'hand').includes('Booby Trap'), { f: gefragt(t).length, hand: t.pile(0, 'hand'), abl: t.pile(0, 'discardPile') });
  }

  R.section('gewirkter Zauber (eigener Fireball)');
  {
    const t = await szene({ hand1: [] });
    t.setHand(0, ['Divine Gift of Time', 'Fireball']);
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    await t.play(0, 'Fireball', { hero: 0 });
    await sleep(50);
    R.check('gewirkter Zauber → Ablage öffnet die Abfrage, Fireball zurück auf der Hand', gefragt(t).length === 1 && t.pile(0, 'hand').includes('Fireball'), { f: gefragt(t).length, hand: t.pile(0, 'hand'), abl: t.pile(0, 'discardPile') });
    R.check('keine Fehler / sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }

  R.section('Gegenprobe: Karten in die ABLAGE DES GEGNERS lösen nicht aus');
  {
    const t = await szene({ hand1: ['Fireball'] });
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 0).id];
    await t.play(1, 'Fireball', { hero: 0, active: 1 });
    await sleep(50);
    R.check('gegnerischer Zauber (Fireball in der Ablage des Gegners): keine Abfrage', gefragt(t).length === 0, gefragt(t).length);
  }

  R.section('Gegenprobe: ein anderes Divine Gift wirken – Time (selbst ein Gift, 1 pro Spiel) bietet sich nicht an');
  {
    const t = await szene();
    t.setHand(0, ['Divine Gift of Time', 'Divine Gift of Skill']);
    await t.play(0, 'Divine Gift of Skill', { hero: 0 });
    await sleep(100);
    R.check('keine Abfrage, Skill in der Ablage, Time auf der Hand', gefragt(t).length === 0 && t.pile(0, 'discardPile').includes('Divine Gift of Skill') && t.pile(0, 'hand').includes('Divine Gift of Time'), { f: gefragt(t).length, abl: t.pile(0, 'discardPile'), hand: t.pile(0, 'hand') });
  }

  R.section('Ablehnen: Karten bleiben in der Ablage, Time bleibt auf der Hand');
  {
    const t = await szene();
    t.script.push({ match: d => d.title === 'Divine Gift of Time', answer: () => null, once: true });
    const c = t.put(0, 0, 0, 'Curse');
    await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: 1 }, c));
    await sleep(50);
    R.check('Nein: Curse bleibt in der Ablage, Time auf der Hand, kein Einmal-Stempel', t.pile(0, 'discardPile').includes('Curse') && t.pile(0, 'hand').includes('Divine Gift of Time') && !(t.gs.players[0]._oncePerGameUsed || new Set()).has('divineGift'), { abl: t.pile(0, 'discardPile'), hand: t.pile(0, 'hand') });
  }
  R.finish();
})();
