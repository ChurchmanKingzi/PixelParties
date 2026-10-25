'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  Darion-Vergleichsharness (W75 · Partition P1): dieselbe Szene zweimal bauen —
//    (a) „darion":  Darions Equip-Stapel  [N0, X, N1] in EINEM Platz,
//    (b) „kontrolle": dieselben drei Equips getrennt in drei Plaetzen bei einem normalen Helden —
//  dann dieselbe Handlung ausfuehren und die Zustaende vergleichen (Held-ATK/HP/Status/Buffs/Merker, Zaehler der Equips, Haende/Ablagen/Geloescht, Gold, Areas).
//  Jede Abweichung ist ein Befund: im Stapel soll sich jede Karte so verhalten wie ein einzelnes Equip an einem normalen Helden („jede Karte ist eine eigene Karte, nur die Zone ist geteilt").
//
//    const V = require('<...>/lib/darion-vergleich.js');
//    const a = await V.lauf('The White Eye', 'darion', 'destroyX', { pos: 1 });
//    const b = await V.lauf('The White Eye', 'kontrolle', 'destroyX', { pos: 1 });
//    V.unterschiede(a, b)        // [] = gleich
// ═══════════════════════════════════════════════════════════════════════════
const H = require('./h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', T = 'Tushu, the Knowledge Keeper';
const F = H.INERT.filler;
const NACHBARN = ['Club of Gobbo', 'Cute Crown'];

/** Karten, die sich nicht aus der Hand an Darion/Tushu spielen lassen — sie brauchen eine eigene Szene (siehe die Einzeltests h-P1-*). */
const OHNE_HANDWEG = new Set([
  'Cool Tech Jetpack', "Crusader's Arm-Cannon", "Crusader's Cutlass", "Crusader's Flintlock", "Crusader's Hookshot", 'Future Tech Control Device',
  'Idej Blade - Gensui', 'Idej Blade - Hakai', 'Idej Blade - Manabi', 'Idej Blade - Naosu', 'Idej Sword - Kogarasu', 'Idej Sword - Kunagi', 'Idej Sword - Muras', 'Idej Sword - Onima',
  'Lunatic Cycle - Crescent Moon', 'Lunatic Cycle - Full Moon', 'Lunatic Cycle - Gibbous Moon', 'Lunatic Cycle - Half Moon', 'Modnir, Hammer of Coolness', 'Secret Lab Entrance', 'Swellpnir, Mount of Coolness',
]);

/**
 * Eine Karte OHNE Handweg direkt in den Platz legen (Zonen-Name + Instanz) und ihr Anlege-Ereignis feuern (`onPlay` + `onCardEnterZone`, wie ein Ausruesten per Effekt).
 * `vorab`: Zaehler, die vor dem Anlegen auf der Instanz stehen muessen (z. B. `_viaCoolRepair`).
 */
async function legeDirekt(t, seat, hi, slot, name, vorab = {}) {
  const ps = t.gs.players[seat];
  if (!ps.supportZones[hi][slot]) ps.supportZones[hi][slot] = [];
  ps.supportZones[hi][slot].push(name);
  const inst = t.engine._trackCard(name, seat, 'support', hi, slot);
  Object.assign(inst.counters, vorab);
  inst.turnPlayed = 1;
  await t.run(() => t.engine.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, cardName: name, zone: 'support', heroIdx: hi, zoneSlot: slot, _skipReactionCheck: true }));
  await t.run(() => t.engine.runHooks('onCardEnterZone', { enteringCard: inst, toZone: 'support', toHeroIdx: hi, _isEffectEquip: true }));
  return inst;
}

/** Frische Szene: Sitz 0 = Darion bzw. Tushu mit Equips, Sitz 1 = neutral mit einer Kreatur. */
async function szene(X, modus, o = {}) {
  const darion = modus === 'darion';
  const nachbarn = o.nachbarn || NACHBARN;
  const reihe = nachbarn.slice(); reihe.splice(o.pos ?? 1, 0, X);
  if (o.doppel) reihe.splice((o.pos ?? 1) + 1, 0, X);   // zwei gleichnamige Kopien nebeneinander: X (erste) und X2
  const hand0 = [...reihe, ...(o.hand || []), F, F];
  const t = await H.fresh({
    active: 0, heroes: [[darion ? D : T, 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], [T, 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief']],
    hand: [hand0, [F, F]], gold: 900, deckSize: 30, ...(o.opts || {}),
  });
  t.policy.confirm = true;
  // Gleiche Grund-ATK fuer beide Helden (Darion hat eine eigene) — sonst weicht schon der Angriffsschaden ab.
  t.gs.players[0].heroes[0].atk = t.gs.players[0].heroes[0].baseAtk = 50;
  const insts = {};
  for (let i = 0; i < reihe.length; i++) {
    const n = reihe[i];
    const r = (o.direkt && n === X) ? await legeDirekt(t, 0, 0, darion ? 1 : i, n, o.vorab || {}) : await t.play(0, n, { hero: 0, slot: darion ? 1 : i, keepActions: true, phase: H.PHASES.MAIN1 });
    const inst = t.inst(c => c.name === n && c.zone === 'support' && c.owner === 0 && c.heroIdx === 0 && !Object.values(insts).includes(c))[0];
    if (!inst) return { t, fehler: `${n} nicht gelegt (${JSON.stringify(r).slice(0, 80)})` };
    inst.turnPlayed = 1;   // keine Beschwoerungsmuedigkeit u. a.
    const px = o.pos ?? 1;
    insts[i === px ? 'X' : (o.doppel && i === px + 1) ? 'X2' : (i < px ? 'N0' : 'N1')] = inst;
  }
  // Ein gegnerisches Ziel (Kreatur) fuer Angriffe.
  t.put(1, 0, 0, H.INERT.big);
  t.resetActions(0);
  return { t, insts, darion, posX: o.pos ?? 1 };
}

function snap(t) {
  const gs = t.gs;
  const heroes = gs.players.map(ps => ps.heroes.map(h => (h && h.name) ? {
    hp: h.hp, mhp: h.maxHp, atk: h.atk - (h.baseAtk || 0), st: Object.keys(h.statuses || {}).sort().join(),
    bf: Object.keys(h.buffs || {}).sort().join(), fl: Object.keys(h).filter(k => k.startsWith('_') || /Delta|perm|ascension/i.test(k)).sort().join(),
  } : null));
  const piles = gs.players.map(ps => ({ hand: [...ps.hand].sort(), disc: [...ps.discardPile].sort(), del: [...ps.deletedPile].sort(), deck: ps.mainDeck.length, gold: ps.gold }));
  const insts = t.engine.cardInstances.filter(c => c.zone === 'support' && c.owner != null)
    .map(c => ({ n: c.name, ow: c.owner, hi: c.heroIdx, ct: JSON.stringify(c.counters || {}, (k, v) => (/^(id|turnPlayed|_atkTraeger|zoneSlot)$|ByInst$|Id$/.test(k) ? undefined : v)).replace(/[0-9a-f]{8}-[0-9a-f]{3,4}/g, 'ID') }))
    .sort((a, b) => (a.n + a.ct).localeCompare(b.n + b.ct));
  const zonen = gs.players.map(ps => ps.supportZones.map(h => h.map(z => z.length).reduce((a, b) => a + b, 0)));
  return JSON.stringify({ heroes, piles, insts, zonen, areas: gs.areaZones, fehler: t.errors.length });
}

/** Alle Szenarien: (S, insts) → Aktion. */
const SZENEN = {
  destroyX: (S) => S.t.run(() => S.t.engine.actionDestroyCard({ name: 'Test', owner: 1 }, S.insts.X)),
  destroyX2: (S) => S.t.run(() => S.t.engine.actionDestroyCard({ name: 'Test', owner: 1 }, S.insts.X2)),
  steal: async (S) => {   // der Gegner uebernimmt den Helden fuer einen Zug (Charme), dann Zugwechsel (Rueckgabe)
    S.t.engine.actionStealHero(1, 0, 0, { sourceName: 'Test' });
    await S.t.drain();
    S.t.gs.activePlayer = 1; S.t.gs.turn += 1;
    await S.t.turnStart(1);
  },
  stealPerm: async (S) => { await S.t.run(() => S.t.engine.actionTakeHeroPermanently(1, 0, 0)); await S.t.drain(); },
  destroyN0: (S) => S.t.run(() => S.t.engine.actionDestroyCard({ name: 'Test', owner: 1 }, S.insts.N0)),
  destroyN1: (S) => S.t.run(() => S.t.engine.actionDestroyCard({ name: 'Test', owner: 1 }, S.insts.N1)),
  discardX: (S) => S.t.run(() => S.t.engine.sendBoardCardToDiscard(S.insts.X, { source: 'Test', sourceOwner: 1 })),
  bounceX: (S) => S.t.run(() => S.t.engine.actionMoveCard(S.insts.X, 'hand', undefined, undefined, { source: 'Test' })),
  killHero: (S) => S.t.run(() => S.t.engine.actionDealDamage({ name: 'Test', owner: 1 }, S.t.gs.players[0].heroes[0], 9999, 'normal')),
  killRevive: async (S) => {
    await S.t.run(() => S.t.engine.actionDealDamage({ name: 'Test', owner: 1 }, S.t.gs.players[0].heroes[0], 9999, 'normal'));
    await S.t.run(() => S.t.engine.actionReviveHero(0, 0, 400));
  },
  transferX: (S) => S.t.run(() => S.t.engine.actionTransferAttachment(S.insts.X, 0, 1, 0, { skipAnimation: true })),
  transferIn: async (S) => {   // X liegt bei Held 1 und wandert zum Helden 0 (Stapel bzw. freier Platz)
    const t = S.t, e = t.engine, ps = t.gs.players[0];
    // X aus dem Stapel/Platz zuerst zu Held 1, dann zurueck zu Held 0
    await t.run(() => e.actionTransferAttachment(S.insts.X, 0, 1, 0, { skipAnimation: true }));
    await t.run(() => e.actionTransferAttachment(S.insts.X, 0, 0, S.darion ? 2 : S.posX, { skipAnimation: true }));   // Kontrolle: zurueck in den eigenen (jetzt freien) Platz
  },
  attack: async (S) => {
    const t = S.t;
    t.targetFn = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0) || valid.find(x => x.type === 'hero' && x.owner === 1); return v ? [v.id] : undefined; };
    await t.play(0, 'Attack', { hero: 0, active: 0 });
    await t.drain();
  },
  attackCreature: async (S) => {
    const t = S.t;
    t.targetFn = (valid) => { const v = valid.find(x => x.type === 'equip' && x.owner === 1) || valid.find(x => x.type === 'hero' && x.owner === 1); return v ? [v.id] : undefined; };
    await t.play(0, 'Attack', { hero: 0, active: 0 });
    await t.drain();
  },
  hit: async (S) => {
    const t = S.t;
    await t.run(() => t.engine.actionDealDamage({ name: t.gs.players[1].heroes[0].name, owner: 1, heroIdx: 0 }, t.gs.players[0].heroes[0], 100, 'attack'));
  },
  heal: async (S) => {
    const t = S.t, h = t.gs.players[0].heroes[0];
    h.hp = 500;
    await t.run(() => t.engine.actionHealHero({ name: 'Test', owner: 0, heroIdx: 0 }, h, 50));
  },
  // Der Gegner zielt mit einem Zauber / einer Attack auf den Helden (Ausruestungs-Reaktionen: Cool Tech Jetpack, Anti-Magnetic Armor, Weathercock, Future Tech Jetpack …).
  gegnerZauber: async (S) => {
    const t = S.t;
    t.targetFn = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 0 && x.heroIdx === 0) || valid.find(x => x.type === 'hero' && x.owner === 0); return v ? [v.id] : undefined; };
    await t.play(1, 'Fireball', { hero: 0, active: 1 });
    await t.drain();
  },
  gegnerAttack: async (S) => {
    const t = S.t;
    t.targetFn = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 0 && x.heroIdx === 0) || valid.find(x => x.type === 'hero' && x.owner === 0); return v ? [v.id] : undefined; };
    await t.play(1, 'Attack', { hero: 0, active: 1 });
    await t.drain();
  },
  // Secret Lab Entrance: der Traeger nutzt seine Inventing (frei aktivierbar) — die Lab bietet die Zusatznutzung an.
  inventing: async (S) => {
    const t = S.t;
    t.setAbilities(0, 0, [['Inventing'], [], []]);
    t.setHand(0, [F, F, F, F]);
    await t.activateAbility(0, 0, 0, { phase: H.PHASES.MAIN1 });
    await t.drain();
  },
  endTurn: async (S) => { await S.t.endTurn(); await S.t.drain(); },
  turnStart: async (S) => { await S.t.turnStart(0); await S.t.drain(); },
  activate: async (S) => {
    const t = S.t;
    t.phase(H.PHASES.MAIN1); t.gs.activePlayer = 0;
    const liste = t.engine.getActivatableEquips(0) || [];
    for (const a of liste) {
      await t.run(() => t.host.doActivateEquipEffect(t.room, 0, { heroIdx: a.heroIdx, zoneSlot: a.zoneSlot, instId: a.instId, cardName: a.cardName }));
      await t.drain();
    }
    S.aktivierbar = liste.map(a => a.cardName).sort();
  },
};

async function lauf(X, modus, szenenName, o = {}) {
  const S = await szene(X, modus, o);
  if (S.fehler) return { fehler: S.fehler };
  S.t.reset();
  const vorher = snap(S.t);
  await SZENEN[szenenName](S);
  await S.t.drain();
  const nachher = snap(S.t);
  return { vorher, nachher, fehler: null, errors: S.t.errors.slice(0, 3), audit: S.t.audit().slice(0, 3), aktivierbar: S.aktivierbar || null, logs: S.t.logs.map(l => l.type).join(','), prompts: S.t.prompts.map(p => p.d.type + ':' + (p.d.title || '')).join(',') };
}

/** Unterschiede zwischen zwei Laeufen (Darion vs Kontrolle) als lesbare Liste. */
function unterschiede(a, b) {
  const out = [];
  if (a.fehler || b.fehler) { if (a.fehler !== b.fehler) out.push(`Aufbau: darion=${a.fehler} kontrolle=${b.fehler}`); return out; }
  const A = JSON.parse(a.nachher), B = JSON.parse(b.nachher);
  const vergleiche = (pfad, x, y) => {
    if (JSON.stringify(x) === JSON.stringify(y)) return;
    const istObj = (v) => v && typeof v === 'object';
    if (istObj(x) && istObj(y) && pfad.split('.').length < 6 && !/\.insts$/.test(pfad)) { for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) vergleiche(pfad + '.' + k, x[k], y[k]); return; }
    out.push(`${pfad}: darion=${JSON.stringify(x).slice(0, 200)} kontrolle=${JSON.stringify(y).slice(0, 200)}`);
  };
  // Aufbau-Zustand (vor der Handlung) muss ebenfalls gleich sein: Zaehler, Boni, Fragen beim Anlegen.
  {
    const A0 = JSON.parse(a.vorher), B0 = JSON.parse(b.vorher);
    delete A0.zonen; delete B0.zonen;
    const rest = out.length;
    vergleiche('VORHER', A0, B0);
    if (out.length > rest) return out;
  }
  // Zonen-Belegung ist per Konstruktion verschieden (Stapel vs getrennt) — nicht vergleichen.
  delete A.zonen; delete B.zonen;
  vergleiche('', A, B);
  if (a.errors.length || a.audit.length) out.push('FEHLER/AUDIT (darion): ' + JSON.stringify([a.errors, a.audit]).slice(0, 300));
  if (a.aktivierbar && b.aktivierbar && JSON.stringify(a.aktivierbar) !== JSON.stringify(b.aktivierbar)) out.push(`aktivierbar: darion=${a.aktivierbar} kontrolle=${b.aktivierbar}`);
  if (a.logs !== b.logs) out.push(`Log: darion=${a.logs.slice(0, 160)} | kontrolle=${b.logs.slice(0, 160)}`);
  if (a.prompts !== b.prompts) out.push(`Fragen: darion=${a.prompts.slice(0, 160)} | kontrolle=${b.prompts.slice(0, 160)}`);
  return out;
}

module.exports = { legeDirekt, H, D, T, F, NACHBARN, OHNE_HANDWEG, szene, snap, SZENEN, lauf, unterschiede };
