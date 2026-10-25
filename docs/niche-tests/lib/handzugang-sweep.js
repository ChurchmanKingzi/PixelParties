'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  W72a — SWEEP „Karte kam aus Deck/Ablage auf die Hand, ohne dass Control Monitors ein Fenster bekam" (Al, Fehlerbericht Magnetic Potion)
//
//  Methode: Jede Karte / Aktivierung läuft über den echten Spielweg (lib/h.js) in einer Szene, in der der GEGNER (Sitz m) Control Monitors + Held + Handkarten bereithält und der
//  Wirker (Sitz w) ein reiches Deck (150 Namen aller Kartenarten, dazu Kopien) und eine reiche Ablage hat. Gemessen wird der ZUSTAND, nicht der Weg:
//     gewinn[n]  = Zuwachs der Hand des Wirkers an Karte n (ohne Ziehen: `actionDrawCards*` werden mitgeschnitten und abgezogen)
//     herkunft   = min(gewinn, Abgang der Karte n aus Deck + Ablage des Wirkers)  → „kam aus Deck/Ablage auf die Hand"
//     fenster    = Karten, die ein Hook `onHandAddFromPile` (playerIdx = Wirker) gemeldet hat
//  Lücke = herkunft[n] > fenster[n]. Control Monitors antwortet nie (Angebot wird abgelehnt) — gemessen wird das Fenster, nicht die Löschung.
//  Ausnahmen (`AUSNAHMEN`) sind Karten, bei denen die Karte nicht „aus dem eigenen Deck/der eigenen Ablage" kommt (fremde Stapel, Potion Deck …) — jede mit Begründung.
// ═══════════════════════════════════════════════════════════════════════════
const H = require('./h.js');
const { DB } = H;
const F = H.INERT.filler, MC = 'Control Monitors';

const hash = (s) => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h || 1; };
const rng = (seed) => { let x = seed; return () => (x = (x * 1664525 + 1013904223) >>> 0) / 4294967296; };
const alleNamen = () => Object.values(DB).filter(c => c.name && !/^ZZ /.test(c.name) && !/Token/.test(c.cardType) && c.cardType !== 'Hero Token').map(c => c.name);

/** Reiches Deck / reiche Ablage — deterministisch je Seed-Name. */
function bestand(seedName) {
  const names = alleNamen(); const r = rng(hash(seedName));
  const pick = (n) => Array.from({ length: n }, () => names[Math.floor(r() * names.length)]);
  const basis = ['Fireball', 'Cute Cat', 'Cute Hydra', 'Cute Phoenix', 'Elven Rider', 'Pawn of Kings', 'Lunatic Cycle - Half Moon', 'Magnetic Glove', 'Gate to the Armory'].filter(n => DB[n]);
  // Deck: JEDE Karte einmal (damit jede Suche ein Ziel findet), dazu Kopien; Ablage: 150 zufällige + Kopien.
  const deck = [...names, ...basis, ...basis.slice(0, 5), ...basis.slice(0, 3)];
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  const disc = [...pick(150), ...basis.slice(0, 6), 'Fireball', 'Fireball'];
  return { deck, disc };
}

const ms = (arr) => { const m = new Map(); for (const n of arr || []) m.set(n, (m.get(n) || 0) + 1); return m; };
const summe = (m) => [...m.values()].reduce((a, b) => a + b, 0);

/** Szene: Wirker `w` (aktiv), Gegner `m` mit Control Monitors. o: { w, seed, abilities, heroes, handW } */
async function szene(o = {}) {
  const w = o.w ?? 1, m = 1 - w;
  const hand = [[], []]; hand[m] = [MC, ...Array(9).fill(F)]; hand[w] = [...Array(5).fill(F), ...(o.handW || [])];
  const { deck, disc } = bestand(o.seed || 'x');
  const decks = [[], []]; decks[w] = deck; decks[m] = Array(10).fill(F);
  const discs = [[], []]; discs[w] = disc; discs[m] = [];
  const t = await H.fresh({ active: w, hand, deck: decks, discard: discs, gold: [400, 400], heroes: o.heroes, abilities: o.abilities, seed: 4321 });
  t.grantFor(m, 0, MC);
  const rec = { w, m, gezogen: ms([]), fenster: [], noten: [], angeboten: 0, vorher: null };
  // Monitors wird angeboten, aber abgelehnt: gemessen wird das Fenster.
  t.script.unshift({ match: d => d && d.type === 'confirm' && d.title === MC, answer: () => { rec.angeboten++; return false; } });
  // Der Wirker sagt zu allem Ja (die Standardpolitik der Harness lehnt Abbrechbares ab → die Karte würde abgebrochen, bevor sie etwas tut).
  t.script.push({ match: (d, pi) => pi === w && d && d.cancellable, answer: (d, pi) => {
    if (d.type === 'confirm') return { confirmed: true };
    try { const r = t.engine._getCpuGenericResponse({ ...d, cancellable: false }, pi); if (r !== undefined && r !== null && r !== true) return r; } catch (e) { /* unten */ }
    return undefined;
  } });
  const { engine } = t;
  const rh = engine.runHooks.bind(engine);
  engine.runHooks = async (name, ctx = {}, ...r) => {
    if (name === 'onHandAddFromPile' || name === 'onHandAddByDiscard') rec.fenster.push({ pi: ctx.playerIdx, namen: (ctx.cardNames || []).slice(), quelle: ctx.sourceName || null, hinzugefuegt: ctx.hinzugefuegt ?? null });
    return rh(name, ctx, ...r);
  };
  if (engine.noteHandZugangAusStapel) {   // (fehlt im Stand vor W72a — dort misst der Sweep nur die Fenster `onHandAddByDiscard`)
    const nn = engine.noteHandZugangAusStapel.bind(engine);
    engine.noteHandZugangAusStapel = (pi, name, op) => { if (pi === w) rec.noten.push({ name, pile: op && op.pile, fromOwner: op && op.fromOwner }); return nn(pi, name, op); };
  }
  // Ziehen abziehen
  let tief = 0;
  for (const fn of ['actionDrawCards', 'actionDrawCardsAnimated']) {
    const orig = engine[fn].bind(engine);
    engine[fn] = async (...a) => {
      const pi = a[0]; const vor = ms(engine.gs.players[pi]?.hand);
      tief++;
      try { return await orig(...a); }
      finally {
        tief--;
        if (tief === 0 && pi === w) { const nach = ms(engine.gs.players[pi]?.hand); for (const [n, c] of nach) { const d = c - (vor.get(n) || 0); if (d > 0) rec.gezogen.set(n, (rec.gezogen.get(n) || 0) + d); } }
      }
    };
  }
  t.rec = rec;
  rec.vorher = schnappschuss(t, w);
  return t;
}

function schnappschuss(t, w) { const ps = t.gs.players[w]; return { hand: ms(ps.hand), deck: ms(ps.mainDeck), disc: ms(ps.discardPile) }; }

/** Auswertung nach dem Lauf: { herkunft: Map(name → n), fenster: Map(name → n), luecken: [..] , ueberschuss: [..] } */
function auswerten(t) {
  const { rec } = t, w = rec.w;
  const nach = schnappschuss(t, w), vor = rec.vorher;
  const herkunft = new Map();
  const namen = new Set([...nach.hand.keys(), ...vor.hand.keys()]);
  for (const n of namen) {
    const gewinn = (nach.hand.get(n) || 0) - (vor.hand.get(n) || 0) - (rec.gezogen.get(n) || 0);
    if (gewinn <= 0) continue;
    const abgang = Math.max(0, (vor.deck.get(n) || 0) - (nach.deck.get(n) || 0)) + Math.max(0, (vor.disc.get(n) || 0) - (nach.disc.get(n) || 0));
    const h = Math.min(gewinn, abgang);
    if (h > 0) herkunft.set(n, h);
  }
  const fenster = new Map();
  for (const f of rec.fenster) if (f.pi === w) for (const n of f.namen) fenster.set(n, (fenster.get(n) || 0) + 1);
  const noten = ms(rec.noten.map(x => x.name));
  const luecken = [], ueberschuss = [];
  for (const [n, h] of herkunft) {
    const f = fenster.get(n) || 0;
    if (h > f) luecken.push({ name: n, herkunft: h, gemeldet: f, notiert: noten.get(n) || 0 });
  }
  return { herkunft, fenster, luecken, noten };
}

/** Handkarten-Lauf: spielt `karte` und wertet aus. */
async function spieleKarte(card, o = {}) {
  const t = await szene({ w: o.w ?? 1, seed: card.name });
  t.rec.vorher.hand.set(card.name, (t.rec.vorher.hand.get(card.name) || 0) + 1);   // die gespielte Karte kommt durch t.play auf die Hand — kein Zugang aus dem Stapel
  try { await t.play(t.rec.w, card.name, { hero: 0, slot: 2 }); } catch (e) { /* weiter */ }
  try { if (t.gs.potionTargeting && t.gs.potionTargeting.ownerIdx === t.rec.w) await t.resolveTargeting(t.rec.w); } catch (e) { /* weiter */ }
  await nachlauf(t);
  return { t, a: auswerten(t) };
}


/** Aktivierungs-Lauf (Held, Area, Kreatur, Ausrüstung, freie/aktive Ability, Permanent, Ablage-Effekt): `[gruppe, name]` aus `lib/zustands-sweep.js aktivierungsListe()`. */
async function aktiviere(g, name, o = {}) {
  const t = await szene({ w: o.w ?? 1, seed: name });
  const seat = t.rec.w, hi = 0, slot = 2;
  try {
    let call;
    if (g === 'held') { t.setHero(seat, hi, name, 800); call = () => t.activateHero(seat, hi); }
    else if (g === 'area') { t.putArea(seat, name); call = () => { t.gs.activePlayer = seat; t.phase(2); return t.engine.activateAreaEffect(seat, seat, name); }; }
    else if (g === 'kreatur') { t.put(seat, hi, slot, name).turnPlayed = 1; call = () => { t.gs.activePlayer = seat; t.phase(2); return t.activateCreature(seat, hi, slot); }; }
    else if (g === 'ausruestung') { t.put(seat, hi, slot, name).turnPlayed = 1; call = () => t.activateEquip(seat, hi, slot); }
    else if (g === 'frei') { t.setAbilities(seat, hi, [[name], [], []]); call = () => { t.gs.activePlayer = seat; t.phase(2); return t.host.doActivateFreeAbility(t.room, seat, { heroIdx: hi, zoneIdx: 0 }); }; }
    else if (g === 'permanent') { t.gs.players[seat].permanents.push({ id: 'perm-w72', name, counters: {} }); call = () => { t.gs.activePlayer = seat; t.phase(2); return t.host.doActivatePermanent(t.room, seat, { permId: 'perm-w72', ownerIdx: seat }); }; }
    else if (g === 'ablage') { t.gs.players[seat].discardPile.push(name); const inst = t.engine._trackCard(name, seat, 'discard'); call = () => { t.gs.activePlayer = seat; t.phase(2); return t.host.doActivateDiscardEffect(t.room, seat, { instId: inst.id }); }; }
    else { t.setAbilities(seat, hi, [[name], [], []]); call = () => { t.gs.activePlayer = seat; t.phase(3); return t.host.doActivateAbility(t.room, seat, { heroIdx: hi, zoneIdx: 0 }); }; }
    t.rec.vorher = schnappschuss(t, seat);
    await t.run(call);
    if (t.gs.potionTargeting && t.gs.potionTargeting.ownerIdx === seat) await t.resolveTargeting(seat);
  } catch (e) { /* weiter */ }
  await nachlauf(t);
  return { t, a: auswerten(t) };
}


/** Passive und Auslöser: der Gegenstand liegt/steht beim Wirker, dann Auslöser (Zugbeginn, Zauber, Beschwörung, Abwurf, Schaden, Opfer/Abgang, Zugwechsel). g: kreatur | held | ability | equip | anhang | area */
async function passiv(g, name, o = {}) {
  const t = await szene({ w: o.w ?? 1, seed: name });
  const w = t.rec.w, m = t.rec.m, hi = 0;
  const step = async (fn) => { try { await t.run(fn); } catch (e) { /* weiter */ } };
  try {
    t.put(m, 0, 0, H.INERT.big).turnPlayed = 1; t.put(m, 1, 0, H.INERT.creature).turnPlayed = 1;
    t.put(w, 1, 0, H.INERT.creature).turnPlayed = 1;
    if (g === 'kreatur') t.put(w, hi, 2, name).turnPlayed = 1;
    else if (g === 'held') t.setHero(w, hi, name, 800);
    else if (g === 'ability') t.setAbilities(w, hi, [[name], [], []]);
    else if (g === 'equip') t.put(w, hi, 2, name).turnPlayed = 1;
    else { t.gs.players[w].hand.unshift(name); t.engine._trackCard(name, w, 'hand'); await step(() => t.play(w, name, { hero: hi, slot: 1 })); }
    t.rec.vorher = schnappschuss(t, w);
    t.targetFn = (valid, config) => { const need = Math.max(1, (config && (config.minTargets || config.minRequired)) || 1); return valid.slice(0, need).map(v => v.id); };
    await step(() => t.turnStart(w));
    await step(() => t.play(w, 'Fireball', { hero: 1 })); await step(() => t.drain());
    await step(() => t.play(w, 'Attack', { hero: 1 })); await step(() => t.drain());
    await step(() => t.play(w, 'ZZ Dummy', { hero: 2, slot: 2 })); await step(() => t.drain());
    await step(() => t.engine.actionDiscardHandCard(w, F, null, { source: 'Test' })); await step(() => t.drain());
    await step(() => t.engine.actionDiscardHandCard(w, F, null, { source: 'Test' })); await step(() => t.drain());
    const v = t.engine.cardInstances.find(x => x.zone === 'support' && x.name === 'ZZ Dummy' && (x.controller ?? x.owner) === w);
    if (v) await step(() => t.engine.actionDestroyCard({ name: 'Test', owner: m, heroIdx: 0 }, v, {})); await step(() => t.drain());
    await step(() => t.engine.actionDealDamage({ name: 'Test', owner: m, heroIdx: 0 }, t.gs.players[w].heroes[hi], 50, 'fire', { sourceOwner: m })); await step(() => t.drain());
    const k = t.engine.cardInstances.find(x => x.zone === 'support' && x.name === H.INERT.creature && (x.controller ?? x.owner) === m);
    if (k) await step(() => t.engine.actionDealCreatureDamage({ name: 'Test', owner: w, heroIdx: 0 }, k, 500, 'fire', { sourceOwner: w })); await step(() => t.drain());
  } catch (e) { /* weiter */ }
  await nachlauf(t);
  return { t, a: auswerten(t) };
}


/** Eigener Lauf (Selbsttest / gezielte Szenarien): `aktion(t, w, m)` verändert den Zustand, dann Nach-Ketten-Aktionen und Auswertung. */
async function eigenlauf(w, aktion, o = {}) {
  const t = await szene({ w, seed: o.seed || 'eigenlauf' });
  t.rec.vorher = schnappschuss(t, w);
  try { await t.run(() => aktion(t, w, t.rec.m)); } catch (e) { /* weiter */ }
  await t.run(() => t.drain());
  return { t, a: auswerten(t) };
}

/** Karten, die der Sweep als Hand-Karte spielt (Spell, Attack, Creature, Artifact, Potion, Ability), Teilmenge `index % mod === rest`. */
function handkartenListe(mod = 1, rest = 0) {
  const kinds = new Set(['Spell', 'Attack', 'Creature', 'Artifact', 'Potion', 'Ability']);
  return Object.values(DB).filter(c => kinds.has(c.cardType) && c.name && !/^ZZ /.test(c.name)).filter((c, i) => i % mod === rest);
}
/** Passive Gegenstände (Kreatur, Held, Ability, Ausrüstung, Anhang, Area), Teilmenge `index % mod === rest`. */
function passivListe(mod = 1, rest = 0) {
  const items = [];
  for (const c of Object.values(DB)) {
    if (!c.name || /^ZZ /.test(c.name)) continue;
    if (/creature/i.test(c.cardType) && c.cardType !== 'Hero' && !/Token/.test(c.cardType)) items.push(['kreatur', c.name]);
    else if (c.cardType === 'Hero' || c.cardType === 'Ascended Hero') items.push(['held', c.name]);
    else if (c.cardType === 'Ability') items.push(['ability', c.name]);
    else if (c.cardType === 'Artifact' && /equipment/i.test(c.subtype || '')) items.push(['equip', c.name]);
    else if (c.cardType === 'Spell' && /attachment/i.test(c.subtype || '')) items.push(['anhang', c.name]);
    else if (c.cardType === 'Spell' && /area/i.test(c.subtype || '')) items.push(['area', c.name]);
  }
  return items.filter((x, i) => i % mod === rest);
}

/** Nach-Ketten-Aktionen, dann zwei Zugwechsel (verzögerte Effekte), jeweils wieder entleeren. */
async function nachlauf(t) {
  const step = async (fn) => { try { await t.run(fn); } catch (e) { /* weiter */ } };
  await step(() => t.drain());
  await step(() => t.endTurn()); await step(() => t.drain());
  await step(() => t.endTurn()); await step(() => t.drain());
}

module.exports = { H, DB, F, MC, szene, spieleKarte, aktiviere, passiv, eigenlauf, handkartenListe, passivListe, auswerten, nachlauf, bestand, alleNamen, ms, schnappschuss, hash };
