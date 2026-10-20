'use strict';
// W34a · Punkt 4 · Al, 22.10.2026: „Ja, generell darf man unter Dark Ocean immer auf *seine eigenen* Creatures reagieren, nur nicht auf gegnerische."
// Dark Ocean: „neither player can react to or negate the effects of their opponent's Creatures …". ALLGEMEINE REGEL für jedes Reaktionsfenster (Hand-Reaktionen, Surprises, Arrows, Kettenfenster):
// gesperrt ist nur, wer auf eine Creature-Quelle reagiert, deren KONTROLLEUR ein anderer ist als der Reagierende. Die Fenster fragen `engine.darkOceanBlocksReaction(reagierender, null)`;
// die früheren pauschalen Sperren („irgendeine Creature-Quelle ⇒ niemand reagiert") sind entfallen (Fälle, in denen die Creature ihrem eigenen Kontrolleur schadet / ihn trifft).
// Geprüft über alle Hand-Fenster mit quellenneutralen Karten (Strong Shield: Held-/Kreatur-Pre-Damage; Cloud in a Bottle: Held-Nach-Schaden, Kreatur-Nach-Schaden, Kreatur-Pre-Defeat), beide
// Reagierenden-Sitze × Kreatur gehört dem Reagierenden / dem Gegner × mit / ohne Dark Ocean; Surprise-Tor (`_canHeroActivateSurprise`); Greatmaw-Treffer (Arrows des Besitzers ja, Gegner nein).
// Aufruf: node docs/niche-tests/repro/W34/a-04-dark-ocean-eigene-creatures-duerfen-reagiert-werden.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const gefragt = (t, pi, n) => t.prompts.some(p => p.pi === pi && p.d.title === n);
const BIG = H.INERT.big;

/** Szene: `r` = Reagierender (hält die Karte), `c` = Kontrolleur der wirkenden Kreatur; die Kreatur ist die laufende Effektquelle (Dark Ocean liest sie). */
async function szene(r, c, ocean, karte) {
  const hand = [[], []]; hand[r] = [karte];
  const t = await H.fresh({ hand, deckSize: 20, active: c, gold: [100, 100] });
  if (ocean) t.putArea(r, 'Dark Ocean');
  const k = t.put(c, 1, 0, BIG);                       // wirkende Kreatur (Kontrolleur c)
  const opfer = t.put(r, 2, 0, BIG);                   // Kreatur des Reagierenden als Ziel
  t.engine._currentEffectSource = { cardName: BIG, owner: c, cardType: 'CreatureEffect', heroIdx: 1, instId: k.id };
  const src = { name: BIG, owner: c, controller: c, heroIdx: 1, cardType: 'Creature', counters: {}, cardInstance: k };
  return { t, k, opfer, src };
}
const fertig = (t) => { t.engine._currentEffectSource = null; };

(async () => {
  const R = H.runner();
  for (const r of [0, 1]) {
    const o = 1 - r;
    for (const [wer, c] of [['die EIGENE Kreatur', r], ['die GEGNERISCHE Kreatur', o]]) {
      for (const ocean of [false, true]) {
        const soll = !ocean || c === r;
        const tag = `Reagierender Sitz ${r} · ${wer} · ${ocean ? 'unter Dark Ocean' : 'ohne Dark Ocean (Gegenprobe)'}`;
        R.section(tag);
        const was = soll ? 'wird angeboten' : 'wird NICHT angeboten';
        { // Held, Pre-Damage (Strong Shield, ≥ 300)
          const { t, src } = await szene(r, c, ocean, 'Strong Shield');
          await t.run(() => t.engine.actionDealDamage(src, t.hero(r, 0), 300, 'creature'));
          fertig(t);
          R.check(`Strong Shield (Held, Pre-Damage) ${was}`, gefragt(t, r, 'Strong Shield') === soll, t.prompts.map(p => p.pi + ':' + p.d.title));
          R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }
        { // Kreatur, Pre-Damage (Strong Shield) – Schadenstyp Spell, damit Dark Ocean („Creatures take no damage, except …") den Schaden nicht selbst schluckt
          const { t, src, opfer } = await szene(r, c, ocean, 'Strong Shield');
          await t.run(() => t.engine.actionDealCreatureDamage(src, opfer, 300, 'destruction_spell', { sourceOwner: c, canBeNegated: true }));
          fertig(t);
          R.check(`Strong Shield (Kreatur, Pre-Damage) ${was}`, gefragt(t, r, 'Strong Shield') === soll, t.prompts.map(p => p.pi + ':' + p.d.title));
          R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }
        { // Held, Nach-Schaden (Cloud in a Bottle)
          const { t, src } = await szene(r, c, ocean, 'Cloud in a Bottle');
          await t.run(() => t.engine.actionDealDamage(src, t.hero(r, 0), 100, 'creature'));
          fertig(t);
          R.check(`Cloud in a Bottle (Held, Nach-Schaden) ${was}`, gefragt(t, r, 'Cloud in a Bottle') === soll, t.prompts.map(p => p.pi + ':' + p.d.title));
          R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }
        { // Kreatur, Nach-Schaden + Pre-Defeat (Cloud in a Bottle)
          const { t, src, opfer } = await szene(r, c, ocean, 'Cloud in a Bottle');
          await t.run(() => t.engine.actionDealCreatureDamage(src, opfer, 100, 'destruction_spell', { sourceOwner: c, canBeNegated: true }));
          fertig(t);
          R.check(`Cloud in a Bottle (Kreatur, Nach-Schaden) ${was}`, gefragt(t, r, 'Cloud in a Bottle') === soll, t.prompts.map(p => p.pi + ':' + p.d.title));
          R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }
        { // Kreatur, tödlicher Treffer (Pre-Defeat-Fenster: Cloud in a Bottle halbiert)
          const { t, src, opfer } = await szene(r, c, ocean, 'Cloud in a Bottle');
          opfer.counters.currentHp = 60;
          await t.run(() => t.engine.actionDealCreatureDamage(src, opfer, 100, 'destruction_spell', { sourceOwner: c, canBeNegated: true }));
          fertig(t);
          R.check(`Cloud in a Bottle (Kreatur, tödlicher Treffer) ${was}`, gefragt(t, r, 'Cloud in a Bottle') === soll, t.prompts.map(p => p.pi + ':' + p.d.title));
          R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }
      }
    }

    R.section(`Reagierender Sitz ${r} · Surprise-Tor`);
    { const t = await H.fresh({ hand: [[], []] });
      t.putArea(r, 'Dark Ocean');
      t.putSurprise(r, 0, 'Booby Trap'); t.grantFor(r, 0, 'Booby Trap');
      t.engine._currentEffectSource = { cardName: 'Burning Skeleton', owner: r, cardType: 'CreatureEffect', heroIdx: 0 };
      R.check('Dark Ocean: Effekt der EIGENEN Kreatur → die eigene Surprise darf reagieren', t.engine._canHeroActivateSurprise(r, 0, 'Booby Trap', {}) === true, null);
      t.engine._currentEffectSource = { cardName: 'Burning Skeleton', owner: o, cardType: 'CreatureEffect', heroIdx: 0 };
      R.check('Dark Ocean: Effekt der GEGNERISCHEN Kreatur → gesperrt', t.engine._canHeroActivateSurprise(r, 0, 'Booby Trap', {}) === false, null);
      t.engine._currentEffectSource = null;
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }

    R.section(`Reagierender Sitz ${r} · Hook-Fenster ohne Kette (darkOceanBlocksReaction)`);
    { const t = await H.fresh({ hand: [[], []] });
      t.putArea(0, 'Dark Ocean');
      t.engine._currentEffectSource = { cardName: BIG, owner: r, cardType: 'CreatureEffect', heroIdx: 0 };
      R.check('Quelle = Kreatur des Reagierenden → nicht gesperrt', t.engine.darkOceanBlocksReaction(r, null) === false, null);
      R.check('Quelle = Kreatur des Reagierenden → für den Gegner gesperrt', t.engine.darkOceanBlocksReaction(o, null) === true, null);
      t.engine._currentEffectSource = { cardName: 'Fireball', owner: o, cardType: 'Spell', heroIdx: 0 };
      R.check('Quelle = Spell → nie gesperrt', t.engine.darkOceanBlocksReaction(r, null) === false && t.engine.darkOceanBlocksReaction(o, null) === false, null);
      t.engine._currentEffectSource = null; }
  }

  // Greatmaw-Treffer (Kreaturen-Effekt, zählt als Attack des Helden): Arrows des BESITZERS reagieren, die Reaktionen des Gegners bleiben gesperrt (W32a, unverändert)
  for (const me of [0, 1]) {
    const op = 1 - me;
    for (const [karte, besitzer, soll] of [['Angelfeather Arrow', me, true], ['Escape', op, false]]) {
      R.section(`Sitz ${me}: Greatmaw unter Dark Ocean × ${karte} (Hand von Sitz ${besitzer})`);
      const hand = [[], []]; hand[besitzer] = [karte];
      const t = await H.fresh({ hand, deckSize: 20, hp: 800, active: me });
      t.putArea(me, 'Dark Ocean');
      for (let hi = 0; hi < 3; hi++) { t.hero(me, hi).atk = 100; t.hero(me, hi).baseAtk = 100; }
      t.grantFor(besitzer, 0, karte);
      t.hero(op, 0).hp = 60;
      const g = t.put(me, 1, 0, 'Infected Greatmaw'); g.turnPlayed = 1; const x = t.put(me, 2, 0, H.INERT.frail); x.turnPlayed = 1;
      t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
      t.targetFn = (v, cfg) => {
        if (/Sacrifice/.test((cfg && cfg.title) || '')) return [(v.find(z => z.cardName === H.INERT.frail) || v[0]).id];
        if (v.every(z => z.owner === me)) return [(v.find(z => z.type === 'hero' && z.heroIdx === 0) || v[0]).id];
        return [(v.find(z => z.type === 'hero' && z.owner === op && z.heroIdx === 0) || v[0]).id];
      };
      t.phase(2); await t.activateCreature(me, 1, 0);
      R.check(`${karte} ${soll ? 'wird dem Besitzer des Greatmaw angeboten (eigene Kreatur)' : 'wird dem Gegner NICHT angeboten (gegnerische Kreatur)'}`, gefragt(t, besitzer, karte) === soll, t.prompts.map(p => p.pi + ':' + p.d.title));
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
    }
  }
  R.finish();
})();
