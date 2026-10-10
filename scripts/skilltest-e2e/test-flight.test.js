'use strict';
// Test Flight (Spell, Reaction, Magic Arts Lv1): „Play this card immediately when a Hero you control that can use this Spell would be hit
// by an Attack or Spell whose level is lower than that Hero's Magic Arts level. Negate all effects the Attack/Spell would have on that
// Hero (including damage)."
// Geprueft wird das Post-Target-Fenster der Engine (`preDamageMultiTargetWindow`, derselbe Weg wie bei Escape Device / Barrier of Faith)
// mit gescripteten Antworten, danach der echte Schadenspfad (`actionDealDamage`).
//   node scripts/skilltest-e2e/test-flight.test.js
process.env.PP_ST_SIM = '1';
const { runGame } = require('../../skilltest/sim');
const { loadCardEffect } = require('../../cards/effects/_loader');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

const CARD = 'Test Flight';

/** Spiel mit zwei Sitzen; Sitz 0 haelt Test Flight, Sitz 1 ist der Angreifer. `ma` = Magic-Arts-Stufe je eigenem Helden (0 = keine). */
async function fresh(ma = [2, 0, 0], opts = {}) {
  const oL = console.log, oE = console.error; console.log = () => {}; console.error = () => {};
  let out;
  try { out = await runGame({ seats: 2, setupOnly: true, noProfileSeats: [0, 1], seed: 11 }); }
  finally { console.log = oL; console.error = oE; }
  const { engine, gs } = out;
  gs.turn = 5; gs.currentPhase = 3; gs.firstTurnProtectedPlayer = null;
  const ps = gs.players[0];
  // Ability-Zonen der eigenen Helden: nur Magic Arts in der gewuenschten Stufe (ein Stapel je Held)
  ps.abilityZones = ps.abilityZones.map((_, hi) => [Array.from({ length: ma[hi] || 0 }, () => 'Magic Arts'), [], []]);
  for (const h of ps.heroes) { h.hp = 300; h.maxHp = 300; h.statuses = {}; }
  ps.hand = opts.hand || [CARD];
  ps.discardPile = [];
  gs.players[1].hand = [];
  const t = { engine, gs, ps, prompts: [], events: [], wahl: opts.wahl ?? 1, bestaetigen: true };
  // Der Sim-Sitz ist ein Bot (Wirker-Wahl ohne Nachfrage); `opts.mensch` macht Sitz 0 zum Menschen: dann fragt der Picker.
  if (opts.mensch) { engine.isCpuPlayer = () => false; engine._fastMode = false; engine._inMctsSim = false; }
  engine.promptGeneric = async (pi, d) => {
    t.prompts.push(d);
    if (d.type === 'confirm') return t.bestaetigen;
    if (d.type === 'optionPicker') return { optionId: `hero-${t.wahl}` };
    return undefined;
  };
  const origBc = engine._broadcastEvent.bind(engine);
  engine._broadcastEvent = (ev, data, ...r) => { t.events.push({ ev, data }); return origBc(ev, data, ...r); };
  return t;
}

const DB = require('../../cards/effects/_card-db').getCardDB();
const pick = (pred) => Object.values(DB).filter(pred).sort((a, b) => a.name.localeCompare(b.name))[0].name;
const spellN = (n) => pick(c => c.cardType === 'Spell' && c.subtype === 'Normal' && c.level === n);
const attackN = (n) => pick(c => c.cardType === 'Attack' && c.subtype === 'Normal' && c.level === n);
const SPELL0 = spellN(0), SPELL1 = spellN(1), SPELL2 = spellN(2), ATTACK1 = attackN(1);
const CREATURE = pick(c => c.cardType === 'Creature' && c.level === 0);
const quelle = (name) => ({ name, owner: 1, controller: 1 });
const ziel = (hi, ps) => ({ type: 'hero', owner: 0, heroIdx: hi, cardName: ps.heroes[hi].name });
const fenster = (t, name, hits) => t.engine.preDamageMultiTargetWindow(quelle(name), hits.map(hi => ziel(hi, t.ps)));
const angeboten = (t) => t.prompts.some(p => p.type === 'confirm' && p.title === CARD);
const flug = (t) => t.events.filter(e => e.ev === 'play_zone_animation' && e.data && e.data.type === 'test_flight');

(async () => {
  console.log('Das Skript');
  {
    const s = loadCardEffect(CARD);
    check('Post-Target-Reaktion, nie aktiv spielbar', !!s && s.isPostTargetReaction === true && s.neverPlayable === true && s.canActivate() === false);
    check('der Wirker wird ans Zielfenster gebunden (`reactionCasterAllowed`)', typeof s.reactionCasterAllowed === 'function');
  }
  console.log(`(Testkarten: Spell Lv0 ${SPELL0}, Lv1 ${SPELL1}, Lv2 ${SPELL2}, Attack Lv1 ${ATTACK1})`);

  console.log('Stufe: strikt niedriger als die Magic-Arts-Stufe des getroffenen Helden');
  {
    const t = await fresh([2, 0, 0]);
    await fenster(t, SPELL1, [0]);
    check('MA 2 gegen einen Spell der Stufe 1: angeboten und gewirkt', angeboten(t) && t.engine.hasEffectImmunity(0, 0), { prompts: t.prompts.map(p => p.title) });
    check('die Karte liegt in der Ablage, die Hand ist leer (nicht „deleted")', t.ps.hand.length === 0 && t.ps.discardPile.includes(CARD) && !(t.ps.deletedPile || []).includes(CARD), { hand: t.ps.hand, disc: t.ps.discardPile });
    check('Animation `test_flight` auf diesem Helden', flug(t).length === 1 && flug(t)[0].data.owner === 0 && flug(t)[0].data.heroIdx === 0, flug(t));
    const hp = t.ps.heroes[0].hp;
    await t.engine.actionDealDamage(quelle(SPELL1), t.ps.heroes[0], 100, 'destruction_spell');
    check('der Schaden dieser Karte fällt aus (inkl. Schaden: „negate all effects")', t.ps.heroes[0].hp === hp, [hp, t.ps.heroes[0].hp]);
  }
  {
    const t = await fresh([2, 0, 0]);
    await fenster(t, SPELL2, [0]);
    check('MA 2 gegen Stufe 2: NICHT angeboten (gleich ist nicht niedriger)', !angeboten(t) && t.ps.hand.length === 1 && !t.engine.hasEffectImmunity(0, 0), t.prompts.map(p => p.title));
  }
  {
    const t = await fresh([1, 0, 0]);
    await fenster(t, SPELL0, [0]);
    check('MA 1 gegen Stufe 0: angeboten (Test Flight selbst ist Stufe 1)', angeboten(t) && t.engine.hasEffectImmunity(0, 0));
    const u = await fresh([1, 0, 0]);
    await fenster(u, SPELL1, [0]);
    check('MA 1 gegen Stufe 1: nicht angeboten', !angeboten(u) && !u.engine.hasEffectImmunity(0, 0));
  }
  {
    const t = await fresh([3, 0, 0]);
    await fenster(t, ATTACK1, [0]);
    check('auch ein ATTACK zählt (Stufe 1 gegen MA 3)', angeboten(t) && t.engine.hasEffectImmunity(0, 0), t.prompts.map(p => p.title));
  }

  console.log('Quelle: nur echte Attack-/Spell-Karten');
  {
    const t = await fresh([3, 0, 0]);
    await fenster(t, CREATURE, [0]);
    check('eine Creature-Karte als Quelle: nicht angeboten', !angeboten(t));
    const u = await fresh([3, 0, 0]);
    await u.engine.preDamageMultiTargetWindow({ name: 'Irgendein Heldeneffekt', owner: 1, controller: 1 }, [ziel(0, u.ps)]);
    check('eine Quelle ohne Katalogeintrag (Statusticks, Heldeneffekte): nicht angeboten', !angeboten(u));
  }

  console.log('Der Wirker ist der GETROFFENE Held');
  {
    const t = await fresh([0, 5, 0]);
    await fenster(t, SPELL0, [0]);
    check('Held 0 (keine Magic Arts) wird getroffen, Held 1 (MA 5) nicht: kein Angebot', !angeboten(t) && !t.engine.hasEffectImmunity(0, 0) && !t.engine.hasEffectImmunity(0, 1), t.prompts.map(p => p.title));
  }
  {
    const t = await fresh([2, 2, 0]);
    await fenster(t, SPELL1, [0]);
    check('zwei Helden könnten wirken, aber nur Held 0 wird getroffen: kein Wirker-Picker, Held 0 geschützt',
      angeboten(t) && !t.prompts.some(p => p.type === 'optionPicker') && t.engine.hasEffectImmunity(0, 0) && !t.engine.hasEffectImmunity(0, 1), t.prompts.map(p => p.type + ':' + p.title));
  }
  {
    const t = await fresh([2, 3, 0], { wahl: 1, mensch: true });
    await fenster(t, SPELL1, [0, 1]);
    check('Fläche trifft zwei Helden, beide tauglich: der Spieler wählt den Wirker (optionPicker)', t.prompts.some(p => p.type === 'optionPicker'), t.prompts.map(p => p.type));
    check('…genau dieser Held (1) ist geschützt, Held 0 bleibt getroffen', t.engine.hasEffectImmunity(0, 1) && !t.engine.hasEffectImmunity(0, 0));
    const hp0 = t.ps.heroes[0].hp, hp1 = t.ps.heroes[1].hp;
    await t.engine.actionDealDamage(quelle(SPELL1), t.ps.heroes[0], 80, 'destruction_spell');
    await t.engine.actionDealDamage(quelle(SPELL1), t.ps.heroes[1], 80, 'destruction_spell');
    check('Schaden: Held 0 verliert HP, Held 1 nicht', t.ps.heroes[0].hp < hp0 && t.ps.heroes[1].hp === hp1, [hp0, t.ps.heroes[0].hp, hp1, t.ps.heroes[1].hp]);
  }
  {
    const t = await fresh([2, 3, 0]);
    await fenster(t, SPELL1, [0, 1]);
    check('Bot: kein Picker, die Engine nimmt den ersten tauglichen Helden (Held 0)', angeboten(t) && !t.prompts.some(p => p.type === 'optionPicker') && t.engine.hasEffectImmunity(0, 0) && !t.engine.hasEffectImmunity(0, 1), t.prompts.map(p => p.type));
  }
  {
    const t = await fresh([2, 1, 0], { wahl: 0 });
    await fenster(t, SPELL1, [0, 1]);
    check('Fläche, nur Held 0 hat genug Stufe (MA 2 gegen Lv1; Held 1 MA 1 nicht): kein Picker, Held 0 geschützt',
      angeboten(t) && !t.prompts.some(p => p.type === 'optionPicker') && t.engine.hasEffectImmunity(0, 0) && !t.engine.hasEffectImmunity(0, 1), t.prompts.map(p => p.type));
  }

  console.log('Hero kann die Karte nicht wirken');
  {
    const t = await fresh([3, 0, 0]);
    t.ps.heroes[0].statuses = { frozen: { turns: 2 } };
    await fenster(t, SPELL1, [0]);
    check('ein eingefrorener Held kann nicht wirken: kein Angebot', !angeboten(t) && !t.engine.hasEffectImmunity(0, 0), t.prompts.map(p => p.title));
  }
  {
    const t = await fresh([3, 0, 0]);
    t.bestaetigen = false;
    await fenster(t, SPELL1, [0]);
    check('„No" im Fenster: nichts passiert, die Karte bleibt auf der Hand', angeboten(t) && t.ps.hand.length === 1 && !t.engine.hasEffectImmunity(0, 0));
  }
  {
    const t = await fresh([3, 0, 0], { hand: [] });
    await fenster(t, SPELL1, [0]);
    check('ohne Test Flight auf der Hand: nichts', t.prompts.length === 0);
  }

  console.log('CPU');
  {
    const s = loadCardEffect(CARD);
    const eng = { _cpuPlayerIdx: 0 };
    check('die Bot-Vorstufe wehrt fremde Karten ab …', s.cpuMeta.reactionHeuristic(eng, { _postTargetContext: { sourceOwner: 1 } }) === true);
    check('… aber nicht die eigenen (Heilzauber auf den eigenen Helden)', s.cpuMeta.reactionHeuristic(eng, { _postTargetContext: { sourceOwner: 0 } }) === false);
  }

  console.log(fails ? `\n✗ ${fails} Fehler` : '\n✓ Test-Flight-Tests grün');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
