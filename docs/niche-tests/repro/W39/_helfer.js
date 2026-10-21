'use strict';
// W39a · Hilfsmodul der Test-Matrix „Attack-Leser × als-Attack-zählende Effekte" (Al, 22.10.2026: „Reagieren die auch ALLE schon auf Broghan und co?").
// Liefert für jede TREFFER-QUELLE einen Treiber (`TREIBER`) und eine Szene (`szene`), in der genau EIN Treffer ausgelöst wird; die Leser-Tabelle steht in `_leser.js`.
//
// Quellen (Art `attack`): die Referenz „Echte Attack" (Karte Attack aus der Hand) und alle Effekte, die als Attack EINES HELDEN zählen — Heldeneffekte (Broghan, Brackle, Arthor, Heragas, Kohta),
// Gegenstandseffekte (Javelin Throw, Sword in a Bottle, Crusader's ×4, Bamboo Staff, Sacrificial Dagger), Infected Greatmaw, Alluring Light (provozierter Angriff des Gegner-Helden), Duel.
// Gegenproben: Siphem/Locke (gewöhnlicher Heldeneffekt, `keiner`), Alice (zählt als SPELL, `spell`).
//
// Jeder Treiber nennt die Brettseite des ANGREIFERS (`angreifer`: 'me' | 'op'; bei Alluring Light schlägt der Gegner-Held zu) und den Index des schlagenden Helden (`held`).
// Leser, die an diesem Helden hängen (Ausrüstung, Heldenpassive), werden von `szene` über `o.vorbereiten(t, k)` aufgebaut; `k` = { me, op, as, vs, held, ziel, zielHeld }.
const H = require('../../lib/h.js');
const CECILIA = 'Cecilia, the Harrowing Crusader';
const HN = {
  Broghan: 'Broghan, the Frozen Guardian of the North', Brackle: 'Brackle, the Catapulting Turtle', Arthor: 'Arthor, Inheritor of the Barbarian Sword',
  Heragas: 'Heragas, the Monster Slayer', Kohta: 'Kohta, Master of Super-Killing', Alice: 'Alice, the Puppeteer Girl', Siphem: 'Siphem, the Deepsea Demon',
};
const posHero = (valid, owner, idx) => valid.find(v => v.type === 'hero' && v.owner === owner && v.heroIdx === idx);
const fight = (n) => [Array(n).fill('Fighting'), [], []];
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;

function waehleOpfer(v, op, o) {
  if (o.ziel === 'creature') return (v.find(x => x.type === 'equip' && x.owner === op) || v[0]).id;
  const w = posHero(v, op, o.zielHeld ?? 0), w1 = posHero(v, op, 1), w2 = posHero(v, op, 2), e = v.find(x => x.type === 'equip' && x.owner === op);
  return (w && !w.ineligible ? w : (w1 || w2 || e || v[0])).id;
}

const TREIBER = {};
/** Heldeneffekte (Broghan …): aktivieren per `t.activateHero`. */
function heldenTreiber(k) {
  const n = HN[k];
  TREIBER[k] = {
    kind: k === 'Alice' ? 'spell' : k === 'Siphem' ? 'keiner' : 'attack', angreifer: 'me', held: 0, festerHeld: true, heldName: n,
    ziele: k === 'Heragas' ? ['creature'] : ['hero', 'creature'],
    aufbau(t, me, op) {
      t.setHero(me, 0, n, 800);
      if (k === 'Alice') for (let i = 0; i < 3; i++) { const c = t.put(me, 1, i, H.INERT.creature); c.turnPlayed = 1; }
      if (k === 'Brackle') { const c = t.put(me, 1, 0, H.INERT.creature); c.turnPlayed = 1; c.counters.currentHp = 100; }
      if (k === 'Siphem') t.hero(me, 0).deepseaCounters = 2;
    },
    async los(t, me, op, o) {
      let gewaehlt = false;
      t.targetFn = (v) => {
        if (k === 'Brackle' && v.every(x => x.type === 'equip' && x.owner === me)) return gewaehlt ? null : [v[0].id];
        gewaehlt = true; return [waehleOpfer(v, op, o)];
      };
      return t.activateHero(me, 0, k === 'Kohta' ? { phase: 3 } : {});
    },
  };
}
for (const k of Object.keys(HN)) heldenTreiber(k);

TREIBER['Echte Attack'] = { kind: 'attack', angreifer: 'me', held: 0, ziele: ['hero', 'creature'], hand: ['Attack'], aufbau() {},
  async los(t, me, op, o) { t.targetFn = (v) => [waehleOpfer(v, op, o)]; return t.play(me, 'Attack', { hero: 0, keepActions: !!o.keep }); } };
TREIBER['Echter Spell'] = { kind: 'spell', angreifer: 'me', held: 0, ziele: ['hero', 'creature'], hand: ['Fireball'], aufbau() {},
  async los(t, me, op, o) { t.targetFn = (v) => [waehleOpfer(v, op, o)]; return t.play(me, 'Fireball', { hero: 0, keepActions: !!o.keep }); } };
TREIBER['Javelin Throw'] = { kind: 'attack', angreifer: 'me', held: 0, ziele: ['hero', 'creature'], hand: ['Javelin Throw'], aufbau(t, me) { t.put(me, 0, 0, H.INERT.artifact); }, belegt: 1,
  async los(t, me, op, o) { t.targetFn = (v) => { if (!v.some(x => x.owner === op)) return [(posHero(v, me, 0) || v[0]).id]; return [waehleOpfer(v, op, o)]; }; return t.play(me, 'Javelin Throw', { hero: 0, keepActions: !!o.keep }); } };
TREIBER['Sword in a Bottle'] = { kind: 'attack', angreifer: 'me', held: 1, ziele: ['hero', 'creature'], hand: ['Sword in a Bottle'], aufbau() {},
  async los(t, me, op, o) { t.targetFn = (v) => { const h = posHero(v, me, 1); if (!h || !v.some(x => x.owner === op)) return undefined; return [h.id, waehleOpfer(v, op, o)]; }; return t.play(me, 'Sword in a Bottle', { hero: 0, keepActions: !!o.keep }); } };
TREIBER['Bamboo Staff'] = { kind: 'attack', angreifer: 'me', held: 0, ziele: ['hero', 'creature'], discard: ['ZZ Filler'], aufbau(t, me) { t.put(me, 0, 0, 'Bamboo Staff'); }, belegt: 1,
  async los(t, me, op, o) { t.targetFn = (v) => [waehleOpfer(v, op, o)]; await t.run(() => t.engine.addCardFromDiscardToHand(me, 'ZZ Filler', me, { source: 'W39a' })); await t.run(() => t.engine._executeDeferredSurprises()); return true; } };   // (der umgebende Aktionspfad löst aufgeschobene Surprises ein)
TREIBER['Sacrificial Dagger'] = { kind: 'attack', angreifer: 'me', held: 0, ziele: ['hero', 'creature'], aufbau(t, me) { t.put(me, 0, 0, 'Sacrificial Dagger'); t.opfer = t.put(me, 1, 0, H.INERT.creature); }, belegt: 1,
  async los(t, me, op, o) { t.targetFn = (v) => [waehleOpfer(v, op, o)]; await t.run(() => t.engine.opfereKreatur(t.opfer, { name: 'Test', owner: me })); await t.run(() => t.engine._executeDeferredSurprises()); return true; } };
TREIBER['Infected Greatmaw'] = { kind: 'attack', angreifer: 'me', held: 0, ziele: ['hero', 'creature'], aufbau(t, me) {
    const g = t.put(me, 1, 0, 'Infected Greatmaw'); g.turnPlayed = 1; const x = t.put(me, 2, 0, H.INERT.frail); x.turnPlayed = 1; },
  async los(t, me, op, o) {
    t.targetFn = (v, cfg) => {
      if (/Sacrifice/.test((cfg && cfg.title) || '')) return [(v.find(z => z.cardName === H.INERT.frail) || v[0]).id];
      if (v.every(z => z.owner === me)) return [(posHero(v, me, 0) || v[0]).id];
      return [waehleOpfer(v, op, o)];
    };
    t.phase(2); return t.activateCreature(me, 1, 0);
  } };
for (const k of ["Crusader's Arm-Cannon", "Crusader's Cutlass", "Crusader's Flintlock", "Crusader's Hookshot"]) {
  TREIBER[k] = { kind: 'attack', angreifer: 'me', held: 0, ziele: ['hero', 'creature'], heldName: CECILIA, festerHeld: true, aufbau(t, me) { t.put(me, 0, 0, k); }, belegt: 1,
    async los(t, me, op, o) { t.targetFn = (v) => [waehleOpfer(v, op, o)]; return t.activateEquip(me, 0, 0); } };
}
// Alluring Light: `me` zwingt einen Gegner-Helden (Index 0) zum Angriff auf EIN EIGENES Ziel – Angreifer = Gegner-Held, Opfer = eigener Held 0 / eigene Kreatur.
TREIBER['Alluring Light'] = { kind: 'attack', angreifer: 'op', opferSeite: 'me', held: 0, ziele: ['hero', 'creature'], hand: ['Alluring Light'], aufbau() {},
  async los(t, me, op, o) {
    t.targetFn = (v) => {
      const a = v.filter(x => x.owner === op && x.type === 'hero');
      if (a.length) return [(a.find(x => x.heroIdx === 0) || a[0]).id];
      if (o.ziel === 'creature') return [(v.find(x => x.owner === me && x.type === 'equip') || v[0]).id];
      return [(v.find(x => x.owner === me && x.type === 'hero' && x.heroIdx === (o.zielHeld ?? 0)) || v[0]).id];
    };
    return t.play(me, 'Alluring Light', { hero: 1, keepActions: !!o.keep });
  } };
// Duel: me (Held 0, Fighting 3) gegen den Gegner-Held 0; jeder Schlag ist eine Attack des schlagenden Helden – gelesen wird der Schlag von me.
TREIBER['Duel'] = { kind: 'attack', angreifer: 'me', held: 0, ziele: ['hero'], hand: ['Duel'], aufbau(t, me) { t.grantFor(me, 0, 'Duel'); },
  async los(t, me, op, o) {
    t.gs._deferGameOverCheck = true;
    t.targetFn = (v) => [(posHero(v, v[0].owner, 0) || v[0]).id];
    return t.play(me, 'Duel', { hero: 0, keepActions: !!o.keep });
  } };

/** Index des ersten freien Support-Slots des Helden (für Ausrüstung / Kreaturen). */
function freierSlot(t, seat, hi) {
  const z = t.gs.players[seat].supportZones[hi];
  for (let i = 0; i < 3; i++) if (!(z[i] || []).length) return i;
  return -1;
}
/** Karte (Ausrüstung/Kreatur) im ersten freien Slot des Helden platzieren. */
function setzeFrei(t, seat, hi, name, opts) {
  const s = freierSlot(t, seat, hi);
  if (s < 0) throw new Error('kein freier Slot: ' + seat + '/' + hi);
  return t.put(seat, hi, s, name, opts);
}

/**
 * Szene: `me` löst die Quelle `name` aus.
 *   o.ziel          'hero' (Standard) | 'creature'     — was getroffen wird (Gegner-Held `zielHeld`, Standard 0, bzw. Kreatur auf Held 1 Slot 0 der Opferseite)
 *   o.kreaturHp     Start-HP der Opfer-Kreatur (Standard 400)
 *   o.attHand       Handkarten der Seite des ANGREIFERS (Besitzer des Angriffs: Arrows, Topaz)
 *   o.vicHand       Handkarten der Opferseite (Reaktionen, Surprises liegen auf dem Brett)
 *   o.meHand        zusätzliche Handkarten von `me`
 *   o.F             Fighting-Level des schlagenden Helden (Standard 1)
 *   o.vorbereiten   (t, k) => … nach dem Aufbau, vor dem Treffer; k = { me, op, as, vs, held, ziel, zielHeld }
 *   o.nicht         true = nur aufbauen, nicht auslösen
 *   o.script        Antwort-Skript-Regeln für `promptGeneric` (vor dem Treffer eingetragen)
 */
async function szene(name, me, op, o = {}) {
  const sp = TREIBER[name];
  if (!sp) throw new Error('Unbekannter Treiber ' + name);
  const as = sp.angreifer === 'op' ? op : me, vs = as === me ? op : me;
  const opferSeite = sp.opferSeite === 'me' ? me : op;
  const hands = [[], []];
  hands[me].push(...(sp.hand || []), ...(o.meHand || []));
  hands[as].push(...(o.attHand || []));
  hands[opferSeite].push(...(o.vicHand || []));
  const disc = [[], []]; disc[me].push(...(sp.discard || [])); if (o.discard) for (const [s, l] of Object.entries(o.discard)) disc[s].push(...l);
  const t = await H.fresh({ hand: hands, discard: disc, deckSize: o.deckSize ?? 30, hp: 800, active: me, potionDeck: o.potionDeck, deck: o.deck });
  for (let hi = 0; hi < 3; hi++) for (const s of [me, op]) { t.hero(s, hi).atk = 100; t.hero(s, hi).baseAtk = 100; }
  if (sp.heldName) t.setHero(me, 0, sp.heldName, 800);
  sp.aufbau(t, me, op);
  const schlagHeld = sp.held;
  if (name !== 'Duel' && name !== 'Echte Attack' && name !== 'Echter Spell') t.setAbilities(as, schlagHeld, fight(o.F ?? 1));
  if (name === 'Alice') t.setAbilities(me, 0, [Array(o.F ?? 1).fill('Destruction Magic'), [], []]);
  const ziel = o.ziel || 'hero';
  const zielHeld = o.zielHeld ?? 0;
  if (ziel === 'creature') { const c = t.put(opferSeite, 1, 0, o.kreaturName || H.INERT.creature); c.turnPlayed = 1; c.counters.currentHp = o.kreaturHp ?? 400; c.counters.maxHp = Math.max(c.counters.maxHp || 0, o.kreaturHp ?? 400); t.opferKreatur = c; }
  const k = { me, op, as, vs, opferSeite, held: schlagHeld, ziel, zielHeld, sp, mehrfach: name === 'Duel' };   // Duel: bis zu 3 Schläge — Zuschläge zählen je Schlag
  t.k = k;
  // Treffer-Mitschnitt: Endbetrag jedes Attack-Treffers (Held: afterDamage, Kreatur: Batch) — Messung von Schadenszuschlägen auch bei Tötung (Kreatur-HP-Differenz allein genügt dort nicht).
  t.treffer = [];
  const _rh = t.engine.runHooks.bind(t.engine);
  t.engine.runHooks = async (hn, c, ...rest) => {
    if (hn === 'afterDamage' && c && (c.type === 'attack' || /_spell$/.test(c.type || ''))) t.treffer.push({ kind: 'hero', amount: c.amount, src: c.source && c.source.name, srcOwner: c.source && (c.source.heroOwner ?? c.source.owner), srcHero: c.source && c.source.heroIdx });
    if (hn === 'afterCreatureDamageBatch' && c && Array.isArray(c.entries)) for (const e of c.entries) if (e.type === 'attack' || /_spell$/.test(e.type || '')) t.treffer.push({ kind: 'creature', amount: e.amount, src: e.source && e.source.name, srcOwner: e.source && (e.source.heroOwner ?? e.source.owner), srcHero: e.source && e.source.heroIdx });
    return _rh(hn, c, ...rest);
  };
  if (o.vorbereiten) await o.vorbereiten(t, k);
  t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
  for (const r of (o.script || [])) t.script.push({ ...r });
  const hp0 = t.hp(opferSeite, zielHeld), hp1 = t.hp(opferSeite, 1);
  const kHp0 = t.opferKreatur ? (t.opferKreatur.counters.currentHp ?? 0) : null;
  const erg = o.nicht ? null : await sp.los(t, me, op, { ziel, zielHeld, keep: o.keep });
  const kreaturDa = t.opferKreatur && t.engine.cardInstances.includes(t.opferKreatur) && t.opferKreatur.zone === 'support';
  const schadenHeld = hp0 - t.hp(opferSeite, zielHeld);
  const schadenKreatur = t.opferKreatur ? kHp0 - (kreaturDa ? (t.opferKreatur.counters.currentHp ?? 0) : 0) : 0;
  const dmg = t.treffer.filter(x => x.srcOwner === as && x.srcHero === schlagHeld && (ziel === 'creature' ? x.kind === 'creature' : x.kind === 'hero')).reduce((a, x) => a + (x.amount || 0), 0);
  return { t, k, erg, dmg, schaden: ziel === 'creature' ? schadenKreatur : schadenHeld, schadenHeld, schadenHeld1: hp1 - t.hp(opferSeite, 1), kreaturTot: t.opferKreatur ? !kreaturDa || (t.opferKreatur.counters.currentHp ?? 1) <= 0 : null };
}
/** Angebotene Prompts mit diesem Titel. */
const gefragt = (t, n) => t.prompts.filter(p => p.d.title === n).length;

module.exports = { H, HN, CECILIA, TREIBER, szene, freierSlot, setzeFrei, posHero, fight, sauber, gefragt, waehleOpfer };
