'use strict';
// W74c-01 · Flesh-Eating Swarm Trap (Spell Reaction Lv2, Decay Magic)
// „Immediately play this card when your opponent plays a card from their hand that chooses exactly 1 Hero they control. That card's effect becomes "Deal 150 damage to that Hero.""
// Permanente Karten (Equip, Attachment) gehen nach den 150 Schaden auf die Ablage.
const H = require('../../lib/h.js');
const TRAP = 'Flesh-Eating Swarm Trap';

async function aufbau(o = {}) {
  const t = await H.fresh({ hand: [[TRAP, 'ZZ Filler'], o.gegnerHand || ['Blade of the Swamp Witch']], gold: [50, 100], ...(o.fresh || {}) });
  t.setAbilities(0, 0, [['Decay Magic', 'Decay Magic'], [], []]);   // Fallenbesitzer (Sitz 0) kann Lv2 Decay wirken
  return t;
}
const trapAngebot = (t) => t.prompts.filter(p => p.d && p.d.type === 'confirm' && p.d.title === TRAP).length;

(async () => {
  const R = H.runner();

  R.section('A · Ausrüstung auf den EIGENEN Helden: Effekt wird zu 150 Schaden, die Karte geht auf die Ablage');
  {
    const t = await aufbau();
    const hp0 = t.hp(1, 0);
    const r = await t.play(1, 'Blade of the Swamp Witch', { hero: 0 });
    R.check('Falle angeboten', trapAngebot(t) === 1, t.prompts.map(p => p.d && (p.d.title || p.d.type)));
    R.check('der gewählte Held erleidet 150 Schaden', t.hp(1, 0) === hp0 - 150, [hp0, t.hp(1, 0)]);
    const liegt = t.engine.cardInstances.some(c => c.name === 'Blade of the Swamp Witch' && (c.zone === 'support' || c.zone === 'equip'));
    R.check('Ausrüstung liegt NICHT am Helden', !liegt, t.engine.cardInstances.filter(c => c.name === 'Blade of the Swamp Witch').map(c => c.zone));
    R.check('Ausrüstung liegt auf der Ablage des Spielers', t.pile(1, 'discardPile').includes('Blade of the Swamp Witch'), t.pile(1, 'discardPile'));
    R.check('Falle verbraucht (Ablage des Fallenbesitzers)', t.pile(0, 'discardPile').includes(TRAP) && !t.pile(0, 'hand').includes(TRAP), [t.pile(0, 'hand'), t.pile(0, 'discardPile')]);
    const anim = t.evs('play_zone_animation').filter(e => e.type === 'flesh_swarm');
    R.check('Schwarm-Animation am gewählten Helden (Sitz 1, Held 0)', anim.some(e => e.owner === 1 && e.heroIdx === 0), anim);
    R.check('keine Engine-Fehler, Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
    void r;
  }

  R.section('B · keine Falle: Fallenbesitzer kann Decay Lv2 nicht wirken / eigener Zug / Brett-Aktivierung');
  {
    const t = await aufbau();
    t.setAbilities(0, 0, [['Decay Magic'], [], []]);   // nur Decay 1 → kann die Lv2-Karte nicht wirken
    const hp0 = t.hp(1, 0);
    await t.play(1, 'Blade of the Swamp Witch', { hero: 0 });
    R.check('ohne wirkbaren Helden: kein Angebot, Ausrüstung bleibt liegen', trapAngebot(t) === 0 && t.hp(1, 0) === hp0 && t.engine.cardInstances.some(c => c.name === 'Blade of the Swamp Witch'), [trapAngebot(t), t.hp(1, 0)]);
  }
  {
    // Der Besitzer der Falle spielt selbst eine Ausrüstung: keine Falle gegen sich selbst
    const t = await H.fresh({ hand: [[TRAP, 'Blade of the Swamp Witch'], []], gold: [100, 50] });
    t.setAbilities(0, 0, [['Decay Magic', 'Decay Magic'], [], []]);
    await t.play(0, 'Blade of the Swamp Witch', { hero: 0 });
    R.check('eigene Ausrüstung: kein Angebot', trapAngebot(t) === 0, trapAngebot(t));
  }

  R.section('C · Spell, der seinen Helden im Effekt wählt (Zielfenster): Effekt ersetzt, genau 1 Held');
  {
    const t = await aufbau({ gegnerHand: ['Calm Diatribe'] });
    t.setAbilities(1, 0, [['Magic Arts', 'Magic Arts', 'Magic Arts'], [], []]);
    t.targetFn = (valid) => { const h = valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 1); return h ? [h.id] : undefined; };
    const hp1 = t.hp(1, 1);
    await t.play(1, 'Calm Diatribe', { hero: 0 });
    R.check('Falle angeboten', trapAngebot(t) === 1, t.prompts.map(p => p.d && (p.d.title || p.d.type)));
    R.check('der gewählte Held (Sitz 1, Held 1) erleidet 150 Schaden', t.hp(1, 1) === hp1 - 150, [hp1, t.hp(1, 1)]);
    R.check('der Effekt von Calm Diatribe fand nicht statt (keine zweite Aktion vermerkt)', !(t.gs.players[1]._calmDiatribeHero != null), Object.keys(t.gs.players[1]).filter(k => /calm/i.test(k)));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('D · Trank mit genau einem gewählten eigenen Helden');
  {
    const t = await aufbau({ gegnerHand: ['Elixir of Strength'] });
    t.targetFn = (valid) => { const h = valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0); return h ? [h.id] : undefined; };
    const hp0 = t.hp(1, 0);
    await t.play(1, 'Elixir of Strength', { hero: 0 });
    R.check('Falle angeboten', trapAngebot(t) === 1, t.prompts.map(p => p.d && (p.d.title || p.d.type)));
    R.check('150 Schaden auf den gewählten Helden', t.hp(1, 0) === hp0 - 150, [hp0, t.hp(1, 0)]);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('E · Ability-Anlegen wählt den Helden');
  {
    const t = await aufbau({ gegnerHand: ['Fighting'] });
    const hp0 = t.hp(1, 0);
    await t.play(1, 'Fighting', { hero: 0 });
    R.check('Falle angeboten', trapAngebot(t) === 1, t.prompts.map(p => p.d && (p.d.title || p.d.type)));
    R.check('150 Schaden, Ability nicht am Helden', t.hp(1, 0) === hp0 - 150 && !t.gs.players[1].abilityZones[0].some(z => z.includes('Fighting')), [t.hp(1, 0), t.gs.players[1].abilityZones[0]]);
  }

  R.section('F · kein Auslöser: Beschwörung, Zauber auf einen GEGNERISCHEN Helden');
  {
    const t = await aufbau({ gegnerHand: ['Fireball'] });
    t.setAbilities(1, 0, [['Destruction Magic', 'Destruction Magic'], [], []]);
    t.targetFn = (valid) => { const h = valid.find(v => v.type === 'hero' && v.owner === 0); return h ? [h.id] : undefined; };
    await t.play(1, 'Fireball', { hero: 0 });
    R.check('Fireball auf den Helden der Falle: kein Angebot', trapAngebot(t) === 0, trapAngebot(t));
  }
  {
    const t = await aufbau({ gegnerHand: ['ZZ Dummy'] });
    await t.play(1, 'ZZ Dummy', { hero: 0 });
    R.check('Beschwörung eines Kreatur-Karte: kein Angebot', trapAngebot(t) === 0, trapAngebot(t));
  }

  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
