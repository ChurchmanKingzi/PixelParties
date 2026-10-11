'use strict';
// Point-Blank Annihilation (Spell/Reaction, Destruction Magic Lv1): „Play this card immediately when the user would be defeated by an opponent's
// Creature effect. Defeat all Creatures your opponent controls before the user is defeated." — Der Nutzer wird trotzdem ganz normal besiegt, die
// Ausführung passiert nur davor. Fenster: das Vor-Schaden-Fenster (`isPreDamageReaction` + `firesOnDefeat` + `casterIsTarget`).
//   node scripts/skilltest-e2e/point-blank-annihilation.test.js
process.env.PP_ST_SIM = '1';
const fs = require('fs');
const path = require('path');
const { runGame } = require('../../skilltest/sim');
const { loadCardEffect } = require('../../cards/effects/_loader');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

const PBA = 'Point-Blank Annihilation';
const DB = require('../../cards/effects/_card-db').getCardDB();
const KRE = Object.values(DB).filter(c => c.cardType === 'Creature' && c.subtype === 'Normal' && c.level === 0 && !/Token|Race Boat/.test(c.name) && (c.hp || 0) > 0)
  .sort((a, b) => a.name.localeCompare(b.name)).map(c => c.name);
const [K1, K2, K3] = KRE;

/** Spiel mit zwei Sitzen: Sitz 0 (der Nutzer) hält die Karte, Held 0 hat Destruction Magic Lv1. Sitz 1 kontrolliert Kreaturen. */
async function fresh(opts = {}) {
  const oL = console.log, oE = console.error; console.log = () => {}; console.error = () => {};
  let out;
  try { out = await runGame({ seats: 2, setupOnly: true, noProfileSeats: [0, 1], seed: 11 }); }
  finally { console.log = oL; console.error = oE; }
  const { room, host, engine, gs } = out;
  gs.turn = 5; gs.activePlayer = 1; gs.currentPhase = 3; gs.firstTurnProtectedPlayer = null;
  for (const c of engine.cardInstances.filter(c => c.zone === 'support' || c.zone === 'surprise' || c.zone === 'hand')) engine._untrackCard(c.id);
  const [p0, p1] = gs.players;
  for (const ps of [p0, p1]) {
    ps.supportZones = ps.supportZones.map(() => [[], [], []]);
    ps.surpriseZones = ps.surpriseZones.map(() => []);
    for (const h of ps.heroes) { h.hp = 300; h.maxHp = 300; h.statuses = {}; }
    ps.hand = []; ps.discardPile = []; ps.deletedPile = [];
    ps.abilityZones = ps.abilityZones.map(() => [[], [], []]);
  }
  if (opts.dm !== false) p0.abilityZones[0] = [['Destruction Magic'], [], []];
  const stelle = (pi, name, hi, slot) => {
    gs.players[pi].supportZones[hi][slot] = [name];
    const inst = engine._trackCard(name, pi, 'support', hi, slot);
    inst.turnPlayed = 1;
    return inst;
  };
  const t = { room, host, engine, gs, p0, p1, stelle, prompts: [], events: [], logs: [], antwort: null };
  const origPg = engine.promptGeneric.bind(engine);
  engine.promptGeneric = async (pi, d, ...r) => {
    t.prompts.push({ pi, d });
    if (t.antwort) { const a = t.antwort(pi, d); if (a !== undefined) return a; }
    if (d.type === 'confirm' && d.title === PBA) return true;
    return origPg(pi, d, ...r);
  };
  const origBc = engine._broadcastEvent.bind(engine);
  engine._broadcastEvent = (ev, data, ...r) => { t.events.push({ ev, data }); return origBc(ev, data, ...r); };
  const origLog = engine.log.bind(engine);
  engine.log = (type, d) => { t.logs.push({ type, d }); return origLog(type, d); };
  return t;
}
function setzeHand(t, names, seat = 0) {
  t.gs.players[seat].hand = [...names];
  for (const n of names) t.engine._trackCard(n, seat, 'hand');
}
const angebot = (t) => t.prompts.filter(p => p.pi === 0 && p.d.type === 'confirm' && p.d.title === PBA);
const anims = (t, typ) => t.events.filter(e => e.ev === 'play_zone_animation' && e.data.type === typ).map(e => e.data);
const kreaturenAuf = (t, seat) => t.engine.cardInstances.filter(c => c.zone === 'support' && (c.controller ?? c.owner) === seat);
// Schaden einer Kreatur des Gegners (Sitz 1) an Held 0 des Nutzers
const kreaturSchaden = (t, betrag, typ = 'creature', quelle = null) =>
  t.engine.actionDealDamage(quelle || { name: K1, owner: 1, heroIdx: 0 }, t.p0.heroes[0], betrag, typ);

(async () => {
  console.log('Karte, Kunst und Skript');
  {
    const cd = DB[PBA], s = loadCardEffect(PBA);
    check('Spell, Reaction, Lv1, Destruction Magic', cd && cd.cardType === 'Spell' && cd.subtype === 'Reaction' && cd.level === 1 && cd.spellSchool1 === 'Destruction Magic', cd);
    check('Kartentext: „would be defeated" und „before the user is defeated"', cd && /when the user would be defeated by an opponent's Creature effect/.test(cd.effect) && /Defeat all Creatures your opponent controls before the user is defeated\./.test(cd.effect), cd && cd.effect);
    check('Skript: Vor-Schaden-Fenster, Insta-Kills, der Nutzer ist der Getroffene, nie aktiv spielbar, AoE-Flag', s.isPreDamageReaction === true && s.firesOnDefeat === true && s.casterIsTarget === true && s.neverPlayable === true && s.hitsMultipleTargets === true);
    const idx = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/card-art/index.json'), 'utf8'));
    check('Kunst nativ 76×51 im Index und als Datei', idx[PBA] && idx[PBA].kind === 'a' && fs.existsSync(path.join(__dirname, '../../data/card-art/native', idx[PBA].id + '.png')));
  }
  console.log(`(Testkreaturen: ${[K1, K2, K3].join(', ')})`);

  console.log('Tödlicher Treffer einer gegnerischen Kreatur');
  {
    const t = await fresh();
    setzeHand(t, [PBA]);
    t.stelle(1, K1, 0, 0); t.stelle(1, K2, 1, 0); t.stelle(1, K3, 2, 1);
    const eigene = t.stelle(0, K1, 1, 1);                             // eine EIGENE Kreatur des Nutzers bleibt unberührt
    await kreaturSchaden(t, 500);
    const a = angebot(t);
    check('die Karte wird dem Nutzer angeboten („is about to take 500 damage")', a.length === 1 && a[0].d._handReactionWindow === true && /about to/.test(a[0].d.message), a.map(x => x.d.message));
    check('ALLE Kreaturen des Gegners sind besiegt', kreaturenAuf(t, 1).length === 0 && t.p1.discardPile.length === 3, { auf: kreaturenAuf(t, 1).map(c => c.name), abl: t.p1.discardPile });
    check('die eigene Kreatur des Nutzers bleibt', kreaturenAuf(t, 0).length === 1 && kreaturenAuf(t, 0)[0] === eigene);
    check('der Nutzer wird TROTZDEM ganz normal besiegt (Treffer nicht verhindert, nicht ersetzt)', t.p0.heroes[0].hp <= 0, t.p0.heroes[0].hp);
    check('Point-Blank Annihilation liegt in der Ablage des Nutzers', t.p0.discardPile.includes(PBA) && !t.p0.hand.includes(PBA), { abl: t.p0.discardPile });
    const an = anims(t, 'point_blank_blast');
    check('Animation `point_blank_blast`: Brett-Animation, Mittelpunkt der Nutzer (Seite 0, Held 0), drei Ziele', an.length === 1 && an[0].zoneType === 'board' && an[0].originOwner === 0 && an[0].originHeroIdx === 0 && an[0].targets.length === 3 && an[0].regionAll === true, an);
    check('Log `point_blank_annihilation` (3 von 3)', t.logs.some(l => l.type === 'point_blank_annihilation' && l.d.defeated === 3 && l.d.of === 3), t.logs.map(l => l.type).slice(-8));
    const ordnung = t.events.map(e => e.ev === 'play_zone_animation' ? e.data.type : e.ev);
    check('die Besiegung der Kreaturen geschieht VOR dem Tod des Nutzers (`hero_ko` kommt nach dem Log der Karte)', t.logs.findIndex(l => l.type === 'point_blank_annihilation') < t.logs.findIndex(l => l.type === 'hero_ko'), t.logs.map(l => l.type));
    void ordnung;
  }
  {
    const t = await fresh();                                           // Insta-Kill durch eine Kreatur: kein Schaden, Betrag = HP
    setzeHand(t, [PBA]);
    t.stelle(1, K1, 0, 0);
    await t.engine.actionDefeatHero({ name: K1, owner: 1, heroIdx: 0 }, t.p0.heroes[0], {});
    check('auch ein Insta-Kill einer Gegner-Kreatur löst sie aus (`firesOnDefeat`)', angebot(t).length === 1 && kreaturenAuf(t, 1).length === 0 && t.p0.heroes[0].hp <= 0, { frage: angebot(t).length, auf: kreaturenAuf(t, 1).length, hp: t.p0.heroes[0].hp });
  }

  console.log('Echter Creature-Effekt (Skeleton Archer des Gegners aktiviert seinen Effekt)');
  {
    const t = await fresh();
    setzeHand(t, [PBA]);
    t.gs.currentPhase = 2;                                           // Kreatur-Effekte laufen in der Main Phase
    t.p0.heroes[0].hp = 40;                                          // der Pfeil (50) ist tödlich
    t.stelle(1, 'Skeleton Archer', 0, 0); t.stelle(1, K2, 1, 0);
    t.engine.promptEffectTarget = async (pi, ziele) => { const z = ziele.find(x => x.id === 'hero-0-0'); return z ? [z.id] : []; };
    await t.host.doActivateCreatureEffect(t.room, 1, { heroIdx: 0, zoneSlot: 0 });
    check('der echte Creature-Effekt (Pfeil, 50 Schaden auf 40 HP) löst das Angebot aus', angebot(t).length === 1, { frage: angebot(t).length, hp: t.p0.heroes[0].hp });
    check('…alle Kreaturen des Gegners fallen (auch der Schütze), der Nutzer wird trotzdem besiegt', kreaturenAuf(t, 1).length === 0 && t.p0.heroes[0].hp <= 0, { auf: kreaturenAuf(t, 1).map(c => c.name), hp: t.p0.heroes[0].hp });
  }

  console.log('Wann sie NICHT angeboten wird');
  {
    const t = await fresh();
    setzeHand(t, [PBA]); t.stelle(1, K1, 0, 0);
    await kreaturSchaden(t, 100);
    check('nicht tödlich (100 < 300 HP): kein Angebot, Kreatur bleibt, Held lebt', angebot(t).length === 0 && kreaturenAuf(t, 1).length === 1 && t.p0.heroes[0].hp === 200 && t.p0.hand.includes(PBA), { frage: angebot(t).length, hp: t.p0.heroes[0].hp });
  }
  {
    const t = await fresh();
    setzeHand(t, [PBA]); t.stelle(1, K1, 0, 0);
    await kreaturSchaden(t, 500, 'destruction_spell', { name: 'Fireball', owner: 1, heroIdx: 0 });
    check('tödlicher ZAUBER des Gegners (kein Creature-Effekt): kein Angebot', angebot(t).length === 0 && kreaturenAuf(t, 1).length === 1, { frage: angebot(t).length });
  }
  {
    const t = await fresh();
    setzeHand(t, [PBA]); t.stelle(1, K1, 0, 0);
    await kreaturSchaden(t, 500, 'creature', { name: K2, owner: 0, heroIdx: 1 });
    check('tödlicher Treffer einer EIGENEN Kreatur („an opponent\'s Creature effect"): kein Angebot', angebot(t).length === 0 && kreaturenAuf(t, 1).length === 1, { frage: angebot(t).length });
  }
  {
    const t = await fresh();
    setzeHand(t, [PBA]);                                               // der Gegner kontrolliert keine Kreatur
    await kreaturSchaden(t, 500);
    check('der Gegner hat keine Kreatur: nichts zu besiegen → kein Angebot', angebot(t).length === 0, { frage: angebot(t).length });
  }
  {
    const t = await fresh({ dm: false });
    setzeHand(t, [PBA]); t.stelle(1, K1, 0, 0);
    await kreaturSchaden(t, 500);
    check('der Nutzer kann die Karte nicht wirken (keine Destruction Magic): kein Angebot', angebot(t).length === 0 && kreaturenAuf(t, 1).length === 1, { frage: angebot(t).length });
  }
  {
    const t = await fresh();
    setzeHand(t, [PBA]); t.stelle(1, K1, 0, 0);
    t.antwort = (pi, d) => (d.type === 'confirm' && d.title === PBA) ? false : undefined;
    await kreaturSchaden(t, 500);
    check('„Nein": die Karte bleibt auf der Hand, die Kreatur bleibt, der Held fällt', t.p0.hand.includes(PBA) && kreaturenAuf(t, 1).length === 1 && t.p0.heroes[0].hp <= 0, { hand: t.p0.hand });
  }

  console.log(fails ? `${fails} Prüfung(en) FEHLGESCHLAGEN` : '✓ Point-Blank-Annihilation-Tests grün');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
