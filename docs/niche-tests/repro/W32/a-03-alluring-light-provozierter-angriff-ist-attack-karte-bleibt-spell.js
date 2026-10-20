'use strict';
// W32a · Entscheidung Al (22.10.2026), Punkt 3: Alluring Light (Spell Lv 1: „Choose a Hero your opponent controls and a target you control. Your chosen target takes damage equal to the chosen
// Hero's Attack stat. This is treated as the chosen Hero attacking your chosen target."). Al: „Alluring Light selbst zählt als Lv-1-Spell. Der von Alluring Light provozierte Angriff zählt NICHT
// als Spell, sondern als Attack mit dem Fighting-Level des von Light zum Angriff gezwungenen Heroes."
//  · Die KARTE bleibt ein Spell der Stufe 1 (Kartentyp, Instanz in der Opferwahl).
//  · Der TREFFER ist ein Attack des gezwungenen (gegnerischen) Helden: Quelle = der Held (Name der Heldenkarte), Schadenstyp `attack`, Stempel = Fighting-Level dieses Helden.
//  · Spell-Schutzkarten reagieren nicht auf den Treffer: Anti Magic Shield (Hand), Magic Mirror (Surprise), Anti Magic (Spell-Immunität) – der Treffer landet.
//  · Attack-Reaktionen reagieren: Escape (Hand, Attack-Reaktion), Spike Trap (Surprise „chosen by an Attack or Spell": der Angreifer bekommt den Rückschaden), Magic Topaz (Reaktion des
//    Angreifer-Besitzers auf „one of your Heroes performs an Attack": +60 Schaden).
// Aufruf: node docs/niche-tests/repro/W32/a-03-alluring-light-provozierter-angriff-ist-attack-karte-bleibt-spell.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const gefragt = (t, n) => t.prompts.filter(p => p.d.title === n).length;
const fight = (n) => [Array(n).fill('Fighting'), [], []];

/** Szene: Seat `me` spielt Alluring Light (Caster Held 1), wählt den Gegner-Helden 0 als Angreifer und den EIGENEN Helden 0 als Opfer. */
async function szene(me, op, o = {}) {
  const meHand = ['Alluring Light', ...(o.meHand || [])];
  const t = await H.fresh({ hand: me === 0 ? [meHand, o.opHand || []] : [o.opHand || [], meHand], deckSize: 30, hp: 800, active: me });
  for (let hi = 0; hi < 3; hi++) { t.hero(op, hi).atk = 100; t.hero(op, hi).baseAtk = 100; }
  t.setAbilities(op, 0, fight(o.F ?? 0));
  if (o.vorbereiten) o.vorbereiten(t, me, op);
  t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
  const rec = { quellen: [], fenster: [] };
  const orig = t.engine.actionDealDamage.bind(t.engine);
  t.engine.actionDealDamage = (source, target, amount, type, oo) => { rec.quellen.push({ q: source, type, amount }); return orig(source, target, amount, type, oo); };
  t.targetFn = (v) => {
    const a = v.find(x => x.owner === op && x.type === 'hero' && x.heroIdx === 0);
    if (a) return [a.id];
    return [v.find(x => x.owner === me && x.type === 'hero' && x.heroIdx === 0).id];
  };
  const hp0 = t.hp(me, 0), hpOpp0 = t.hp(op, 0);
  const erg = await t.play(me, 'Alluring Light', { hero: 1 });
  return { t, rec, erg, schaden: hp0 - t.hp(me, 0), schadenAngreifer: hpOpp0 - t.hp(op, 0) };
}
const sauber = (R, r, was) => R.check(`${was}: sauber`, r.t.errors.length === 0 && r.t.audit().length === 0, { e: r.t.errors, a: r.t.audit() });

(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section(`Sitz ${me}: Karte = Spell Lv 1, Treffer = Attack des gezwungenen Helden`);
    const r = await szene(me, op, { F: 2 });
    R.check('die Karte Alluring Light bleibt ein Spell der Stufe 1 (Kartentyp)', H.DB['Alluring Light'].cardType === 'Spell' && H.DB['Alluring Light'].level === 1, H.DB['Alluring Light']);
    R.check('der Treffer landet beim Opfer (Attack-Wert des gewählten Helden)', r.schaden === 100, r.schaden);
    const q = r.rec.quellen.filter(x => x.amount > 0);
    R.check('die Treffer-Quelle ist der GEZWUNGENE HELD (Heldenkarte), Schadenstyp `attack` – kein Spell', q.length === 1 && q[0].type === 'attack' && H.DB[q[0].q.name]?.cardType === 'Hero' && q[0].q.heroIdx === 0 && q[0].q.owner === op, q.map(x => [x.q.name, x.type, x.q.owner, x.q.heroIdx]));
    R.check('die Quellstufe ist das Fighting-Level des gezwungenen Helden (2), nicht die gedruckte Stufe 1', q.length === 1 && r.t.engine._heldenEffektStufe(q[0].q.name, 'attack', q[0].q) === 2, q.length && r.t.engine._heldenEffektStufe(q[0].q.name, 'attack', q[0].q));
    R.check('die Quelle zählt als Attack (Redirect-/Schutzkarten-Art `attack`), nicht als Spell', q.length === 1 && r.t.engine.sourceEffectKind(q[0].q) === 'attack', q.length && r.t.engine.sourceEffectKind(q[0].q));
    sauber(R, r, 'Treffer');

    R.section(`Sitz ${me}: Spell-Schutzkarten reagieren NICHT auf den Treffer`);
    const t0 = await H.fresh({ deckSize: 30, hp: 800, active: me });
    const mm = require('../../../../cards/effects/_loader.js').loadCardEffect('Magic Mirror');
    const sc = t0.engine;
    const trefferQuelle = { name: H.DB[q[0].q.name].name, owner: op, controller: op, heroIdx: 0, usesHeroAtk: true, treatedAsAttack: sc.heldenAngriffStempel(op, 0) };
    const kartenQuelle = { name: 'Alluring Light', owner: me, controller: me, heroIdx: 1 };
    {
      const a = await szene(me, op, { meHand: ['Anti Magic Shield'], vorbereiten: (t) => { t.grantFor(me, 0, 'Anti Magic Shield'); t.setAbilities(me, 0, [['Magic Arts', 'Magic Arts', 'Magic Arts'], [], []]); } });
      R.check('Anti Magic Shield wird nicht angeboten, der Treffer landet', gefragt(a.t, 'Anti Magic Shield') === 0 && a.schaden === 100, { g: gefragt(a.t, 'Anti Magic Shield'), s: a.schaden });
      sauber(R, a, 'Anti Magic Shield');
      // Magic Mirror: die KARTE (die Wahl des Opfers, Spell Lv 1) ist für ihn ein Spell, der TREFFER nicht (Trigger direkt mit den beiden Quellen)
      R.check('Magic Mirror: die Karte Alluring Light (Wahl des Opfers) ist ein Spell Lv 1 → löst aus', !!mm.surpriseTrigger(t0.gs, me, 0, sc._surpriseSourceInfo(kartenQuelle, {}, false, null), sc), null);
      R.check('Magic Mirror: der provozierte Treffer (Attack des gezwungenen Helden) ist KEIN Spell → löst nicht aus', !mm.surpriseTrigger(t0.gs, me, 0, sc._surpriseSourceInfo(trefferQuelle, { damageType: 'attack' }, false, null), sc), null);
      const ams = require('../../../../cards/effects/_loader.js').loadCardEffect('Anti Magic Shield');
      t0.setAbilities(me, 0, [['Magic Arts', 'Magic Arts', 'Magic Arts'], [], []]);
      const ziele = [{ type: 'hero', owner: me, heroIdx: 0, cardName: t0.hero(me, 0).name }];
      R.check('Anti Magic Shield: der Treffer (Attack, Quelle = Held) löst die Reaktion nicht aus', !ams.postTargetCondition(t0.gs, me, sc, ziele, trefferQuelle, { damageType: 'attack' }), null);
      R.check('Anti Magic Shield (Gegenprobe): ein gegnerischer Spell Lv 1 löst sie aus', !!ams.postTargetCondition(t0.gs, me, sc, ziele, { name: 'Fireball', owner: op, controller: op, heroIdx: 0 }, { damageType: 'destruction_spell' }), null);
      const c = await szene(me, op, { vorbereiten: (t) => { t.hero(me, 0).buffs = { ...(t.hero(me, 0).buffs || {}), magic_immune: { level: 3 } }; } });
      R.check('Anti Magic (Spell-Immunität Stufe 3) schützt nicht vor dem Attack-Treffer', c.schaden === 100, c.schaden);
      sauber(R, c, 'Anti Magic');
    }

    R.section(`Sitz ${me}: Attack-Reaktionen reagieren auf den Treffer`);
    {
      const e = await szene(me, op, { meHand: ['Escape', 'ZZ Filler'], vorbereiten: (t) => { t.hero(me, 0).hp = 100; t.grantFor(me, 0, 'Escape'); } });
      R.check('Escape (Attack-Reaktion, tödlicher Treffer) wird angeboten und negiert den Treffer', gefragt(e.t, 'Escape') >= 1 && e.t.hp(me, 0) === 100, { g: gefragt(e.t, 'Escape'), hp: e.t.hp(me, 0) });
      sauber(R, e, 'Escape');
      // Spike Trap (Surprise): der Treffer ist ein Attack → der Trigger (direkt mit der Treffer-Quelle) bejaht ihn
      const st = require('../../../../cards/effects/_loader.js').loadCardEffect('Spike Trap');
      R.check('Spike Trap: der provozierte Treffer (Attack des gezwungenen Helden) löst die Attack-Reaktion aus', !!st.surpriseTrigger(t0.gs, me, 0, sc._surpriseSourceInfo(trefferQuelle, { damageType: 'attack' }, false, null), sc), null);
      R.check('Spike Trap (Gegenprobe): ein gewöhnlicher Heldeneffekt (Siphem) löst nicht aus', !st.surpriseTrigger(t0.gs, me, 0, sc._surpriseSourceInfo({ name: 'Siphem, the Deepsea Demon', owner: op, controller: op, heroIdx: 0 }, { damageType: 'hero' }, false, null), sc), null);
      const m = await szene(me, op, { opHand: ['Magic Topaz'], vorbereiten: (t) => { t.grantFor(op, 0, 'Magic Topaz'); } });
      R.check('Magic Topaz (Reaktion des Besitzers des gezwungenen Helden) wird angeboten: +60 Schaden', gefragt(m.t, 'Magic Topaz') >= 1 && m.schaden === 160, { g: gefragt(m.t, 'Magic Topaz'), s: m.schaden });
      sauber(R, m, 'Magic Topaz');
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
